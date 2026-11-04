import { MAX_GUESSES } from '@wordlee/shared';
import { KEYS, load, save } from '@/lib/storage';

/** 只有「每日挑戰」會計入統計（練習模式不算），跟每日一題的玩法一致。 */
export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** dist[i] = 第 i+1 次猜中的次數 */
  dist: number[];
  lastPlayedIndex: number | null;
  lastWonIndex: number | null;
  /** 最近一次贏的時候猜了幾次（統計圖上會標出來） */
  lastGuesses?: number;
}

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  dist: Array(MAX_GUESSES).fill(0),
  lastPlayedIndex: null,
  lastWonIndex: null,
});

export const loadStats = () => load<Stats>(KEYS.stats, emptyStats());

export async function recordDaily(dayIndex: number, won: boolean, guesses: number): Promise<Stats> {
  const s = await loadStats();
  if (s.lastPlayedIndex === dayIndex) return s; // 同一天不重複計算
  s.played += 1;
  s.lastPlayedIndex = dayIndex;
  if (won) {
    s.wins += 1;
    s.dist[guesses - 1] += 1;
    s.currentStreak = s.lastWonIndex === dayIndex - 1 ? s.currentStreak + 1 : 1;
    s.lastWonIndex = dayIndex;
    s.lastGuesses = guesses;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  } else {
    s.currentStreak = 0;
  }
  await save(KEYS.stats, s);
  return s;
}
