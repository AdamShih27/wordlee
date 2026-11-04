/**
 * Hangman（看中文拼英文）:一次猜一個字母，猜錯 6 次就輸。
 * 純邏輯，App 只負責畫面。
 */
export const HANGMAN_LIVES = 6;

export type HangmanStatus = 'playing' | 'won' | 'lost';

export interface HangmanView {
  /** 每個位置:猜到了就是字母，還沒猜到是 null */
  slots: (string | null)[];
  /** 猜錯的字母（依猜的順序） */
  wrong: string[];
  livesLeft: number;
  status: HangmanStatus;
}

export function hangmanView(word: string, guessed: readonly string[]): HangmanView {
  const w = word.toLowerCase();
  const set = new Set(guessed.map((g) => g.toLowerCase()));
  const slots = w.split('').map((ch) => (set.has(ch) ? ch : null));
  const wrong = [...new Set(guessed.map((g) => g.toLowerCase()))].filter((g) => !w.includes(g));
  const livesLeft = Math.max(0, HANGMAN_LIVES - wrong.length);
  const status: HangmanStatus = slots.every(Boolean) ? 'won' : livesLeft === 0 ? 'lost' : 'playing';
  return { slots, wrong, livesLeft, status };
}

/** 猜一個字母。已經猜過、不是字母、或遊戲已結束時，回傳原本的陣列。 */
export function guessLetter(word: string, guessed: readonly string[], letter: string): readonly string[] {
  const l = letter.toLowerCase();
  if (!/^[a-z]$/.test(l) || guessed.includes(l)) return guessed;
  if (hangmanView(word, guessed).status !== 'playing') return guessed;
  return [...guessed, l];
}

/** 挖空用的符號 */
export const BLANK = '_____';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 把提示文字裡的答案挖空，連變化形一起（例如 crane、cranes、craned)。
 * `forms` 傳字典裡的詞形變化;另外也會挖掉「答案 + 字尾」（如 cranelike)。
 */
export function maskWord(text: string, word: string, forms: readonly string[] = []): string {
  const all = [...new Set([word, ...forms].map((f) => f.toLowerCase()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (all.length === 0) return text;
  const re = new RegExp(`\\b(?:${all.map(escapeRegExp).join('|')})[a-z]*\\b`, 'gi');
  return text.replace(re, BLANK);
}

/** 這段文字裡有沒有出現答案（或它的變化形）,用來挑「挖空後還看得出用法」的例句 */
export function containsWord(text: string, word: string, forms: readonly string[] = []): boolean {
  return maskWord(text, word, forms) !== text;
}
