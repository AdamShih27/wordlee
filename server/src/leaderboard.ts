import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { LeaderboardEntry, PlayerResult } from '@wordlee/shared';

/** 用 Node 內建的 SQLite 存排行榜(Node 22.13+ 免安裝）。 */
export class Leaderboard {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        games INTEGER NOT NULL DEFAULT 0,
        best_time_ms INTEGER,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        answer TEXT NOT NULL,
        played_at INTEGER NOT NULL,
        results TEXT NOT NULL
      );
    `);
  }

  recordMatch(room: string, answer: string, results: PlayerResult[]): void {
    const now = Date.now();
    const upsert = this.db.prepare(`
      INSERT INTO players (id, name, points, wins, games, best_time_ms, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        points = points + excluded.points,
        wins = wins + excluded.wins,
        games = games + 1,
        best_time_ms = CASE
          WHEN excluded.best_time_ms IS NULL THEN best_time_ms
          WHEN best_time_ms IS NULL OR excluded.best_time_ms < best_time_ms THEN excluded.best_time_ms
          ELSE best_time_ms END,
        updated_at = excluded.updated_at
    `);
    this.db.exec('BEGIN');
    try {
      for (const r of results) {
        const win = r.solved && r.rank === 1 ? 1 : 0;
        upsert.run(r.playerId, r.name, r.points, win, r.solved ? r.timeMs : null, now);
      }
      this.db
        .prepare('INSERT INTO matches (room, answer, played_at, results) VALUES (?, ?, ?, ?)')
        .run(room, answer, now, JSON.stringify(results));
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  top(limit = 50): LeaderboardEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, points, wins, games, best_time_ms FROM players
         ORDER BY points DESC, wins DESC, games ASC, updated_at ASC LIMIT ?`,
      )
      .all(limit) as any[];
    return rows.map((r, i) => ({
      rank: i + 1,
      playerId: r.id,
      name: r.name,
      points: r.points,
      wins: r.wins,
      games: r.games,
      bestTimeMs: r.best_time_ms ?? null,
    }));
  }

  player(id: string): LeaderboardEntry | null {
    const r = this.db
      .prepare('SELECT id, name, points, wins, games, best_time_ms, updated_at FROM players WHERE id = ?')
      .get(id) as any;
    if (!r) return null;
    const ahead = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM players WHERE points > ? OR (points = ? AND wins > ?)
         OR (points = ? AND wins = ? AND games < ?)
         OR (points = ? AND wins = ? AND games = ? AND updated_at < ?)`,
      )
      .get(r.points, r.points, r.wins, r.points, r.wins, r.games, r.points, r.wins, r.games, r.updated_at) as any;
    return {
      rank: Number(ahead.n) + 1,
      playerId: r.id,
      name: r.name,
      points: r.points,
      wins: r.wins,
      games: r.games,
      bestTimeMs: r.best_time_ms ?? null,
    };
  }

  close(): void {
    this.db.close();
  }
}
