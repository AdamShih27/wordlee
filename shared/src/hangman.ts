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
