import { toTraditional } from '@wordlee/shared/src/s2t';
import { IS_DEMO } from '@/lib/config';

/**
 * 字典資料來源：
 * - 離線:ECDICT（中文翻譯、詞性、詞形變化），打包在 App 裡，沒網路也能查
 * - 線上:Free Dictionary API（英文解釋、音標、發音）、Tatoeba（英文例句 + 中文翻譯）
 */

interface OfflineEntry {
  /** [詞性， 中文] */
  t: [string, string][];
  ph?: string;
  /** 詞形變化:s 複數、p 過去式、d 過去分詞、i 現在分詞、3 第三人稱單數、r 比較級、t 最高級 */
  f?: Record<string, string>;
  /** 這個字是 lemma 的變化形 */
  lemma?: string;
  /** 是哪一種變化形（同上代號，可能多個，例如 "s3") */
  lt?: string;
  lt_tr?: [string, string][];
}

// 用 require 讀大型 JSON,避免 TypeScript 去推導一百萬字元的型別
const OFFLINE: Record<string, OfflineEntry> = require('@wordlee/shared/src/data/dict.json');

export const POS_ZH: Record<string, string> = {
  'n.': '名詞',
  'v.': '動詞',
  'vt.': '及物動詞',
  'vi.': '不及物動詞',
  'a.': '形容詞',
  'adj.': '形容詞',
  's.': '形容詞',
  'adv.': '副詞',
  'ad.': '副詞',
  'prep.': '介系詞',
  'pron.': '代名詞',
  'conj.': '連接詞',
  'int.': '感嘆詞',
  'interj.': '感嘆詞',
  'num.': '數詞',
  'art.': '冠詞',
  'pl.': '複數',
  'abbr.': '縮寫',
  'aux.': '助動詞',
  'pref.': '字首',
  'suf.': '字尾',
  'det.': '限定詞',
  noun: '名詞',
  verb: '動詞',
  adjective: '形容詞',
  adverb: '副詞',
  preposition: '介系詞',
  pronoun: '代名詞',
  conjunction: '連接詞',
  interjection: '感嘆詞',
  determiner: '限定詞',
  numeral: '數詞',
  article: '冠詞',
  exclamation: '感嘆詞',
  'proper noun': '專有名詞',
  abbreviation: '縮寫',
  prefix: '字首',
  suffix: '字尾',
};

export const FORM_ZH: Record<string, string> = {
  s: '複數',
  p: '過去式',
  d: '過去分詞',
  i: '現在分詞',
  '3': '第三人稱單數',
  r: '比較級',
  t: '最高級',
};

export interface Meaning {
  pos: string;
  posZh: string;
  text: string;
}

export interface NumberInfo {
  /** plural：這個字本身是複數;singular：是單數名詞，附上複數形 */
  kind: 'plural' | 'singular';
  /** kind=plural 時是單數原形，kind=singular 時是複數形 */
  other: string;
  /** 例如 books 同時也是動詞 book 的第三人稱單數 */
  alsoThirdPerson?: boolean;
}

export interface OfflineInfo {
  word: string;
  phonetic?: string;
  zh: Meaning[];
  forms: { key: string; label: string; value: string }[];
  number: NumberInfo | null;
  lemma?: { word: string; label: string; zh: Meaning[] };
  found: boolean;
}

const toMeanings = (t: [string, string][] = []): Meaning[] =>
  t.map(([pos, text]) => ({ pos, posZh: POS_ZH[pos] ?? (pos ? pos.replace(/\.$/, '') : ''), text }));

export function offlineInfo(word: string): OfflineInfo {
  const w = word.toLowerCase();
  const e = OFFLINE[w];
  if (!e) return { word: w, zh: [], forms: [], number: null, found: false };

  const forms = Object.entries(e.f ?? {})
    .filter(([k]) => FORM_ZH[k])
    .sort(([a], [b]) => 'sp3dirt'.indexOf(a) - 'sp3dirt'.indexOf(b))
    .filter(([k, v], i, arr) => !(k === '3' && arr.some(([k2, v2]) => k2 === 's' && v2 === v))) // 名詞複數和動詞第三人稱一樣時只列一次
    .map(([k, v]) => ({ key: k, label: FORM_ZH[k], value: v }));

  let number: NumberInfo | null = null;
  const lt = e.lt ?? '';
  if (e.lemma && lt.includes('s')) {
    number = { kind: 'plural', other: e.lemma, alsoThirdPerson: lt.includes('3') };
  } else if (e.t.some(([p]) => p === 'pl.') && e.lemma) {
    number = { kind: 'plural', other: e.lemma };
  } else if (e.f?.s) {
    number = { kind: 'singular', other: e.f.s };
  }

  const lemmaLabel = lt
    .split('')
    .map((c) => FORM_ZH[c])
    .filter(Boolean)
    .join(' / ');

  return {
    word: w,
    phonetic: e.ph,
    zh: toMeanings(e.t),
    forms,
    number,
    lemma: e.lemma
      ? { word: e.lemma, label: lemmaLabel || '變化形', zh: toMeanings(e.lt_tr).filter((m) => m.pos || !m.text.startsWith('[')) }
      : undefined,
    found: true,
  };
}

/** 單字卡用的一行中文摘要 */
export function shortMeaning(word: string, max = 2): string {
  const info = offlineInfo(word);
  const src = info.zh.length ? info.zh : (info.lemma?.zh ?? []);
  return src
    .filter((m) => !m.text.startsWith('['))
    .slice(0, max)
    .map((m) => (m.pos ? `${m.pos} ${m.text}` : m.text))
    .join(';');
}

// ───────────────────────── 線上資料 ─────────────────────────

export interface EnglishSense {
  pos: string;
  posZh: string;
  definitions: { text: string; example?: string }[];
  synonyms: string[];
}

export interface Example {
  en: string;
  zh?: string;
}

export interface OnlineInfo {
  /** unavailable：試玩版不查線上資料 */
  status: 'ok' | 'notfound' | 'error' | 'unavailable';
  phonetic?: string;
  audio?: string;
  english: EnglishSense[];
  /** 從英文解釋中找到的「plural of X」 */
  pluralOf?: string;
  examples: Example[];
}

const cache = new Map<string, Promise<OnlineInfo>>();

async function getJson(url: string, ms = 8000): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = res.ok ? await res.json() : null;
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function fetchDefinitions(word: string) {
  const { status, body } = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (status === 404) return { status: 'notfound' as const, english: [] as EnglishSense[] };
  if (!Array.isArray(body)) throw new Error(`dictionary ${status}`);

  let phonetic: string | undefined;
  let audio: string | undefined;
  const byPos = new Map<string, EnglishSense>();
  for (const entry of body) {
    for (const p of entry.phonetics ?? []) {
      if (!phonetic && p.text) phonetic = p.text;
      if (p.audio && (!audio || /-us\.mp3$/.test(p.audio))) audio = p.audio;
    }
    phonetic ??= entry.phonetic;
    for (const m of entry.meanings ?? []) {
      const pos = String(m.partOfSpeech ?? '');
      const sense = byPos.get(pos) ?? { pos, posZh: POS_ZH[pos] ?? pos, definitions: [], synonyms: [] };
      for (const d of m.definitions ?? []) {
        if (sense.definitions.length < 4) sense.definitions.push({ text: d.definition, example: d.example });
      }
      for (const s of m.synonyms ?? []) if (sense.synonyms.length < 6 && !sense.synonyms.includes(s)) sense.synonyms.push(s);
      byPos.set(pos, sense);
    }
  }
  const english = [...byPos.values()];
  const pluralOf = english
    .flatMap((s) => s.definitions)
    .map((d) => d.text.match(/^plural of ([a-z]+)/i)?.[1])
    .find(Boolean);
  return { status: 'ok' as const, phonetic, audio, english, pluralOf };
}

async function fetchExamples(word: string): Promise<Example[]> {
  const search = async (q: string) => {
    const url =
      `https://api.tatoeba.org/unstable/sentences?lang=eng&sort=relevance&limit=20&trans:lang=cmn` +
      `&q=${encodeURIComponent(q)}`;
    const { body } = await getJson(url);
    return (body?.data ?? []) as any[];
  };
  let data = await search(`=${word}`);
  if (data.length < 2) data = data.concat(await search(word));

  const re = new RegExp(`\\b${word}\\b`, 'i');
  const seen = new Set<string>();
  const picked = data
    .filter((s) => !s.is_unapproved && typeof s.text === 'string' && s.text.length <= 110)
    .map((s) => {
      const zh = (s.translations ?? []).flat().filter((t: any) => t?.lang === 'cmn' && !t.is_unapproved);
      const best = zh.find((t: any) => t.script === 'Hant') ?? zh[0];
      return {
        en: s.text as string,
        zh: best ? (best.script === 'Hans' ? toTraditional(best.text) : best.text) : undefined,
        score: (re.test(s.text) ? 0 : 10) + (best ? 0 : 5) + s.text.length / 100,
      };
    })
    .filter((x) => (seen.has(x.en) ? false : (seen.add(x.en), true)))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  return picked.map(({ en, zh }) => ({ en, zh }));
}

export function fetchOnlineInfo(word: string): Promise<OnlineInfo> {
  if (IS_DEMO) return Promise.resolve({ status: 'unavailable', english: [], examples: [] });
  const w = word.toLowerCase();
  const hit = cache.get(w);
  if (hit) return hit;
  const p = (async (): Promise<OnlineInfo> => {
    const [defs, examples] = await Promise.allSettled([fetchDefinitions(w), fetchExamples(w)]);
    const ex = examples.status === 'fulfilled' ? examples.value : [];
    if (defs.status === 'rejected') return { status: 'error', english: [], examples: ex };
    return { ...defs.value, examples: ex };
  })();
  cache.set(w, p);
  // 失敗的結果不要快取，下次打開再試
  p.then((r) => r.status === 'error' && cache.delete(w));
  return p;
}
