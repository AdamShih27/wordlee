/**
 * ===== 積分規則（暫定版，之後可以自己改）=====
 *
 * 每局結束時，Server 會對每位玩家呼叫一次 `scoreRound`,回傳的分數會加進排行榜。
 * 想改規則只要改這個檔案，App 端不用動(App 只顯示 Server 算好的分數）。
 *
 * 目前的暫定規則：
 *   - 沒解出來:0 分
 *   - 解出來:基本分 50
 *   - 猜越少次越高分:每少猜一次 +10(1 次猜中 +50,6 次猜中 +0)
 *   - 名次獎勵（只算有解出來的）:第 1 名 +30、第 2 名 +15、第 3 名 +5
 */
export interface RoundOutcome {
  solved: boolean;
  /** 用了幾次猜測 (1–6) */
  guesses: number;
  /** 從開局到解出的毫秒數，沒解出為 null */
  timeMs: number | null;
  /** 名次，1 = 最快解出 */
  rank: number;
  /** 這局總人數 */
  playerCount: number;
}

export const SCORING = {
  base: 50,
  perGuessSaved: 10,
  rankBonus: [30, 15, 5] as number[],
};

export function scoreRound(o: RoundOutcome): number {
  if (!o.solved) return 0;
  const guessBonus = Math.max(0, 6 - o.guesses) * SCORING.perGuessSaved;
  const rankBonus = SCORING.rankBonus[o.rank - 1] ?? 0;
  return SCORING.base + guessBonus + rankBonus;
}

/** 給 App 顯示的規則說明（改了上面的規則記得一起改這段文字）。 */
export function describeScoring(): string {
  const [a, b, c] = SCORING.rankBonus;
  return `解出 +${SCORING.base}，每少猜一次 +${SCORING.perGuessSaved}，第 1/2/3 名再 +${a}/${b}/${c}，沒解出 0 分。`;
}
