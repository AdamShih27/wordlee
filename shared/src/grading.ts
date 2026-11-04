import { toTraditional } from './s2t';

/**
 * 造句批改:給 LLM 的提示詞，以及把 LLM 回覆整理成固定格式。
 * 跟用哪個模型無關(Ollama、Claude 都用同一份），App 只負責送出和顯示。
 */

export type Verdict = 'correct' | 'minor' | 'incorrect';

export interface GradeResult {
  /** 句子有沒有用到指定的字（含變化形） */
  usesWord: boolean;
  verdict: Verdict;
  /** 修改後的完整句子;本來就正確時跟原句一樣 */
  corrected: string;
  /** 繁體中文說明，每點一句 */
  explanations: string[];
  /** 用這個字寫的自然例句 */
  example?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const GRADING_SYSTEM_PROMPT = `你是一位英文老師，學生是母語為中文（台灣）的英文學習者。學生會用一個指定的英文單字造句，請你批改。

規則：
- 只輸出一個 JSON 物件，不要有其他文字。
- verdict：correct = 文法正確而且自然；minor = 意思對，但有小錯或不夠道地；incorrect = 文法錯誤、用錯字義或意思不通。
- uses_word：句子有沒有用到指定的單字（複數、過去式等變化形也算）。
- corrected：修改後的完整英文句子；句子已經正確時就原樣照抄。
- explanations：用繁體中文（台灣用語）說明，每點一句話，最多 3 點。句子沒問題時，給一句肯定，或提供更道地的說法。
- example：用這個單字寫一個自然、程度適中的英文例句。

JSON 格式：
{"uses_word": true, "verdict": "correct", "corrected": "...", "explanations": ["..."], "example": "..."}`;

export function buildGradingMessages(word: string, sentence: string, meaning?: string): ChatMessage[] {
  const target = meaning ? `${word}（${meaning}）` : word;
  return [
    { role: 'system', content: GRADING_SYSTEM_PROMPT },
    { role: 'user', content: `單字：${target}\n學生的句子：${sentence.trim()}` },
  ];
}

export class GradeParseError extends Error {}

const VERDICTS: Verdict[] = ['correct', 'minor', 'incorrect'];

/**
 * 把模型回覆解析成 GradeResult。小模型常會多講話、包 ```json、或帶 <think> 段落，
 * 這裡都先清掉再找 JSON。
 */
export function parseGradeResponse(text: string, originalSentence: string): GradeResult {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new GradeParseError('模型沒有回傳 JSON');
  let raw: any;
  try {
    raw = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new GradeParseError('模型回傳的 JSON 格式不正確');
  }

  const verdict: Verdict = VERDICTS.includes(raw.verdict) ? raw.verdict : 'minor';
  const corrected = typeof raw.corrected === 'string' && raw.corrected.trim() ? raw.corrected.trim() : originalSentence.trim();
  const list = Array.isArray(raw.explanations) ? raw.explanations : typeof raw.explanations === 'string' ? [raw.explanations] : [];
  const explanations = list
    .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x: string) => toTraditional(x.trim()))
    .slice(0, 3);
  const example = typeof raw.example === 'string' && raw.example.trim() ? raw.example.trim() : undefined;
  return {
    usesWord: raw.uses_word !== false,
    verdict,
    corrected,
    explanations,
    example,
  };
}
