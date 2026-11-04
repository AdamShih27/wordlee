import { MAX_GUESSES } from '@wordlee/shared';
import { KEYS, load, save } from '@/lib/storage';

/** 每種字母數各自統計，每玩完一局記一次。 */
export interface Stats {
  played: number;
  wins: number;
  /** 目前連續答對幾局 */
  currentStreak: number;
  maxStreak: number;
  /** dist[i] = 第 i+1 次猜中的次數 */
  dist: number[];
  /** 最近一局是不是答對、用了幾次（統計圖上會標出來） */
  lastWon?: boolean;
  lastGuesses?: number;
}

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  dist: Array(MAX_GUESSES).fill(0),
});

export const loadStats = (length = 5) => load<Stats>(KEYS.stats(length), emptyStats());

export async function recordGame(won: boolean, guesses: number, length = 5): Promise<Stats> {
  const s = await loadStats(length);
  s.played += 1;
  s.lastWon = won;
  s.lastGuesses = guesses;
  if (won) {
    s.wins += 1;
    s.dist[guesses - 1] += 1;
    s.currentStreak += 1;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  } else {
    s.currentStreak = 0;
  }
  await save(KEYS.stats(length), s);
  return s;
}
