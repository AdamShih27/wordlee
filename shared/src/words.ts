import answers5 from './data/answers-5.json';
import answers6 from './data/answers-6.json';
import answers7 from './data/answers-7.json';
import valid5 from './data/valid-5.json';
import valid6 from './data/valid-6.json';
import valid7 from './data/valid-7.json';
import { WORD_LENGTH } from './evaluate';

/** 支援的單字長度 */
export const LENGTHS = [5, 6, 7] as const;
export type WordLength = (typeof LENGTHS)[number];

/** 每種長度可能成為答案的常見單字(build_words.py 已打亂順序）。 */
const ANSWERS_BY_LENGTH: Record<WordLength, readonly string[]> = {
  5: answers5 as string[],
  6: answers6 as string[],
  7: answers7 as string[],
};

/** 5 個字母的答案（對戰模式用） */
export const ANSWERS = ANSWERS_BY_LENGTH[5];

const VALID = new Set<string>([
  ...ANSWERS_BY_LENGTH[5],
  ...ANSWERS_BY_LENGTH[6],
  ...ANSWERS_BY_LENGTH[7],
  ...(valid5 as string[]),
  ...(valid6 as string[]),
  ...(valid7 as string[]),
]);

export function isWordLength(n: number): n is WordLength {
  return (LENGTHS as readonly number[]).includes(n);
}

export function answersFor(length: WordLength = WORD_LENGTH): readonly string[] {
  return ANSWERS_BY_LENGTH[length];
}

/** 是不是字庫裡的字。有給 length 的話，長度也要相符。 */
export function isValidWord(word: string, length?: number): boolean {
  const w = word.toLowerCase();
  if (length !== undefined && w.length !== length) return false;
  return isWordLength(w.length) && VALID.has(w);
}

/** 每日題目從這天開始算第 1 題。 */
export const DAILY_EPOCH = { year: 2026, month: 11, day: 1 };

/** 以「當地日期」計算第幾天（跟手機時區走，半夜 12 點換題）。 */
export function dailyIndex(date: Date = new Date()): number {
  const start = Date.UTC(DAILY_EPOCH.year, DAILY_EPOCH.month - 1, DAILY_EPOCH.day);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86_400_000);
}

export function answerForDay(index: number, length: WordLength = WORD_LENGTH): string {
  const list = ANSWERS_BY_LENGTH[length];
  const n = list.length;
  return list[((index % n) + n) % n];
}

export function dailyAnswer(date: Date = new Date(), length: WordLength = WORD_LENGTH): string {
  return answerForDay(dailyIndex(date), length);
}

export function randomAnswer(rand: () => number = Math.random, length: WordLength = WORD_LENGTH): string {
  const list = ANSWERS_BY_LENGTH[length];
  return list[Math.floor(rand() * list.length)];
}

/** 當地日期字串 YYYY-MM-DD,用來當每日進度的 key。 */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
