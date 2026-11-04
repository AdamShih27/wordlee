export type LetterState = 'correct' | 'present' | 'absent';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * 比對猜測與答案，回傳每個字母的狀態。
 * - correct：字母在正確位置（綠）
 * - present：答案有這個字母但位置不對（黃）
 * - absent：答案沒有這個字母，或重複字母已經用完（灰）
 *
 * 重複字母的處理:先標出所有 correct,再依剩餘數量由左到右標 present。
 * 例:答案 ABBEY、猜 BOBBY → B（黃） O（灰） B（綠） B（灰） Y（綠）
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const result: LetterState[] = Array(g.length).fill('absent');
  const remaining: Record<string, number> = {};

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct';
    } else {
      remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i];
    if (remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch]--;
    }
  }
  return result;
}

export function isSolved(states: LetterState[]): boolean {
  return states.length > 0 && states.every((s) => s === 'correct');
}

const RANK: Record<LetterState, number> = { absent: 1, present: 2, correct: 3 };

/** 合併鍵盤上每個字母目前「最好」的狀態（綠 > 黃 > 灰）。 */
export function mergeKeyStates(
  current: Record<string, LetterState>,
  guess: string,
  states: LetterState[],
): Record<string, LetterState> {
  const next = { ...current };
  guess
    .toLowerCase()
    .split('')
    .forEach((ch, i) => {
      const s = states[i];
      if (!next[ch] || RANK[s] > RANK[next[ch]]) next[ch] = s;
    });
  return next;
}

/** 分享用的 emoji 方塊。 */
export function toEmojiGrid(rows: LetterState[][]): string {
  const map: Record<LetterState, string> = { correct: '🟩', present: '🟨', absent: '⬜' };
  return rows.map((r) => r.map((s) => map[s]).join('')).join('\n');
}

/**
 * 困難模式:之前得到的提示一定要用上。
 * - 綠色字母要留在同一個位置
 * - 黃色字母一定要出現在這次的猜測裡
 * 回傳錯誤訊息;符合規則回傳 null。
 */
export function hardModeError(guess: string, rows: { word: string; states: LetterState[] }[]): string | null {
  const g = guess.toLowerCase();
  for (const { word, states } of rows) {
    const w = word.toLowerCase();
    for (let i = 0; i < w.length; i++) {
      if (states[i] === 'correct' && g[i] !== w[i]) {
        return `第 ${i + 1} 個字母必須是 ${w[i].toUpperCase()}`;
      }
    }
    const need: Record<string, number> = {};
    for (let i = 0; i < w.length; i++) {
      if (states[i] === 'correct' || states[i] === 'present') need[w[i]] = (need[w[i]] ?? 0) + 1;
    }
    for (const [ch, n] of Object.entries(need)) {
      const have = g.split('').filter((c) => c === ch).length;
      if (have < n) return `猜測中必須包含 ${ch.toUpperCase()}`;
    }
  }
  return null;
}
