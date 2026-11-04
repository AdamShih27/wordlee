import answersJson from './data/answers.json';
import validJson from './data/valid.json';
import { WORD_LENGTH } from './evaluate';

/** 可能成為答案的常見單字(build_words.py 已打亂順序）。 */
export const ANSWERS: readonly string[] = answersJson as string[];

const VALID = new Set<string>([...ANSWERS, ...(validJson as string[])]);

export function isValidWord(word: string): boolean {
  const w = word.toLowerCase();
  return w.length === WORD_LENGTH && VALID.has(w);
}

/** 每日題目從這天開始算第 1 題。 */
export const DAILY_EPOCH = { year: 2026, month: 11, day: 1 };

/** 以「當地日期」計算第幾天（跟手機時區走，半夜 12 點換題）。 */
export function dailyIndex(date: Date = new Date()): number {
  const start = Date.UTC(DAILY_EPOCH.year, DAILY_EPOCH.month - 1, DAILY_EPOCH.day);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000);
}

export function answerForDay(index: number): string {
  const n = ANSWERS.length;
  return ANSWERS[((index % n) + n) % n];
}

export function dailyAnswer(date: Date = new Date()): string {
  return answerForDay(dailyIndex(date));
}

export function randomAnswer(rand: () => number = Math.random): string {
  return ANSWERS[Math.floor(rand() * ANSWERS.length)];
}

/** 當地日期字串 YYYY-MM-DD,用來當每日進度的 key。 */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
