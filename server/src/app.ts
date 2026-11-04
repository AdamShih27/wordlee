import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@wordlee/shared';
import { BattleServer, type BattleOptions } from './battle';
import { Leaderboard } from './leaderboard';
import { describeScoring } from './scoring';

export function createApp(opts: { dbPath: string } & BattleOptions) {
  const leaderboard = new Leaderboard(opts.dbPath);
  let battle: BattleServer;

  const httpServer = createServer((req, res) => handleHttp(req, res));
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });
  battle = new BattleServer(io, leaderboard, opts);

  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(body));
  }

  function handleHttp(req: IncomingMessage, res: ServerResponse) {
    if (req.url?.startsWith('/socket.io')) return; // 交給 Socket.IO
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
      return res.end();
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });

    if (url.pathname === '/health') return json(res, 200, { ok: true, ...battle.stats() });
    if (url.pathname === '/api/scoring') return json(res, 200, { text: describeScoring() });
    if (url.pathname === '/api/leaderboard') {
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
      return json(res, 200, leaderboard.top(limit));
    }
    const m = url.pathname.match(/^\/api\/players\/([\w-]{8,64})$/);
    if (m) {
      const p = leaderboard.player(m[1]);
      return p ? json(res, 200, p) : json(res, 404, { error: 'not found' });
    }
    json(res, 404, { error: 'not found' });
  }

  return {
    httpServer,
    io,
    battle,
    leaderboard,
    close: async () => {
      battle.shutdown();
      await new Promise<void>((r) => io.close(() => r()));
      leaderboard.close();
    },
  };
}
