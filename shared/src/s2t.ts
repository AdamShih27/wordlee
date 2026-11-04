import table from './data/s2t.json';

/**
 * 精簡版簡體 → 台灣繁體轉換（資料由 scripts/build_words.py 從 OpenCC 產生）。
 * 先用詞組（最長 4 字）比對，處理「发→發/髮」「干→乾/幹」這類一對多的字，其餘逐字轉換。
 */
const chars = new Map<string, string>();
for (let i = 0; i + 1 < table.c.length; i += 2) chars.set(table.c[i], table.c[i + 1]);
const phrases = table.p as Record<string, string>;
const MAX_PHRASE = 4;

export function toTraditional(text: string): string {
  let out = '';
  let i = 0;
  outer: while (i < text.length) {
    for (let len = Math.min(MAX_PHRASE, text.length - i); len >= 2; len--) {
      const seg = text.slice(i, i + len);
      const hit = phrases[seg];
      if (hit) {
        out += hit;
        i += len;
        continue outer;
      }
    }
    const c = text[i];
    out += chars.get(c) ?? c;
    i++;
  }
  return out;
}
