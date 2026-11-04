import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildGradingMessages, parseGradeResponse, type ChatMessage, type GradeResult } from '@wordlee/shared';
import { KEYS, load, save } from '@/lib/storage';

/**
 * AI 批改用的 LLM。介面跟「用哪個模型」分開：
 * 現在接自己電腦上的 Ollama;之後要換成 Claude API 等服務，只要多寫一個 LlmClient 實作
 * (呼叫雲端服務時金鑰要放在後端，不能放進 App)。
 */

export interface LlmSettings {
  provider: 'ollama';
  /** 例如 http://localhost:11434 或 Tailscale 的 https 網址 */
  baseUrl: string;
  model: string;
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = { provider: 'ollama', baseUrl: 'http://localhost:11434', model: '' };

export interface LlmClient {
  /** 列出可用的模型（用來在設定頁選） */
  listModels(): Promise<string[]>;
  /** 送出對話，回傳模型的文字回覆 */
  chat(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string>;
}

export class LlmError extends Error {}

const trimSlash = (u: string) => u.trim().replace(/\/+$/, '');

async function request(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new LlmError('等太久沒有回應。模型第一次載入會比較慢，可以再試一次。');
    throw new LlmError(
      `連不到 Ollama（${url.replace(/\/api\/.*/, '')}）。請確認電腦上的 Ollama 有開、網址正確；網頁版還要設定 OLLAMA_ORIGINS。`,
    );
  } finally {
    clearTimeout(t);
  }
}

export function createOllamaClient(settings: LlmSettings): LlmClient {
  const base = trimSlash(settings.baseUrl);
  return {
    async listModels() {
      const res = await request(`${base}/api/tags`, { method: 'GET' }, 8000);
      if (!res.ok) throw new LlmError(`Ollama 回應錯誤（HTTP ${res.status}）`);
      const data = await res.json();
      return ((data?.models ?? []) as { name?: string }[]).map((m) => m.name ?? '').filter(Boolean);
    },
    async chat(messages, opts) {
      if (!settings.model) throw new LlmError('還沒選模型');
      const res = await request(
        `${base}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.model,
            messages,
            stream: false,
            ...(opts?.json ? { format: 'json' } : {}),
            options: { temperature: 0.2 },
          }),
        },
        120_000,
      );
      if (res.status === 404) {
        throw new LlmError(`電腦上找不到模型「${settings.model}」，先執行 ollama pull ${settings.model}`);
      }
      if (!res.ok) throw new LlmError(`Ollama 回應錯誤（HTTP ${res.status}）`);
      const data = await res.json();
      return String(data?.message?.content ?? '');
    },
  };
}

export function createClient(settings: LlmSettings): LlmClient {
  switch (settings.provider) {
    case 'ollama':
    default:
      return createOllamaClient(settings);
  }
}

/** 造句批改:組提示詞 → 呼叫模型 → 解析成固定格式 */
export async function gradeSentence(
  client: LlmClient,
  word: string,
  sentence: string,
  meaning?: string,
): Promise<GradeResult> {
  const reply = await client.chat(buildGradingMessages(word, sentence, meaning), { json: true });
  try {
    return parseGradeResponse(reply, sentence);
  } catch (e) {
    throw new LlmError(`${(e as Error).message}，可以再按一次批改，或換一個比較大的模型。`);
  }
}

interface LlmContext {
  settings: LlmSettings;
  ready: boolean;
  configured: boolean;
  update: (s: Partial<LlmSettings>) => void;
  client: LlmClient;
}

const Ctx = createContext<LlmContext | null>(null);

export function LlmProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<LlmSettings>(DEFAULT_LLM_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    load<Partial<LlmSettings>>(KEYS.llm, DEFAULT_LLM_SETTINGS).then((s) => {
      setSettings({ ...DEFAULT_LLM_SETTINGS, ...s });
      setReady(true);
    });
  }, []);

  const value = useMemo<LlmContext>(
    () => ({
      settings,
      ready,
      configured: !!settings.baseUrl.trim() && !!settings.model,
      update: (s) =>
        setSettings((prev) => {
          const next = { ...prev, ...s };
          save(KEYS.llm, next);
          return next;
        }),
      client: createClient(settings),
    }),
    [settings, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLlm() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLlm must be used inside LlmProvider');
  return v;
}
