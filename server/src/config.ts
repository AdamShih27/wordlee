/** 伺服器設定，都可以用環境變數覆寫。 */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  /** 排行榜資料庫位置 */
  dbPath: process.env.DB_PATH ?? new URL('../data/wordlee.db', import.meta.url).pathname,
  /** 每局時間上限（毫秒），預設 5 分鐘 */
  timeLimitMs: Number(process.env.TIME_LIMIT_MS ?? 5 * 60_000),
  /** 開局倒數（毫秒） */
  countdownMs: Number(process.env.COUNTDOWN_MS ?? 3_000),
  /** 一間房最多幾人 */
  maxPlayers: Number(process.env.MAX_PLAYERS ?? 8),
};
