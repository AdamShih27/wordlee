import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, GameEnd, RoomState, ServerToClientEvents } from '@wordlee/shared';
import { createApp } from './app';
import { scoreRound } from './scoring';

type C = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: ReturnType<typeof createApp>;
let url: string;
const clients: C[] = [];

before(async () => {
  app = createApp({ dbPath: ':memory:', countdownMs: 50, timeLimitMs: 2_000, pickAnswer: () => 'crane' });
  await new Promise<void>((r) => app.httpServer.listen(0, '127.0.0.1', () => r()));
  url = `http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
});

after(async () => {
  clients.forEach((c) => c.disconnect());
  await app.close();
  await new Promise<void>((r) => app.httpServer.close(() => r()));
});

function client(playerId: string, name: string, setup?: (c: C) => void): Promise<C> {
  const c: C = connect(url, { auth: { playerId, name }, transports: ['websocket'], forceNew: true, autoConnect: false });
  clients.push(c);
  setup?.(c); // 監聽要在連線前掛上，不然會漏掉 server 一連上就送的事件
  c.connect();
  return new Promise((resolve, reject) => {
    c.once('connect', () => resolve(c));
    c.once('connect_error', reject);
  });
}

const once = <E extends keyof ServerToClientEvents>(c: C, ev: E) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((r) => c.once(ev, ((x: any) => r(x)) as any));

const emitAck = <T,>(c: C, ev: any, ...args: any[]) =>
  new Promise<T>((r) => (c.emit as any)(ev, ...args, (res: T) => r(res)));

const waitState = (c: C, pred: (s: RoomState) => boolean) =>
  new Promise<RoomState>((r) => {
    const h = (s: RoomState) => {
      if (pred(s)) {
        c.off('room:state', h);
        r(s);
      }
    };
    c.on('room:state', h);
  });

test('scoring: placeholder rules', () => {
  assert.equal(scoreRound({ solved: false, guesses: 6, timeMs: null, rank: 2, playerCount: 2 }), 0);
  assert.equal(scoreRound({ solved: true, guesses: 3, timeMs: 1000, rank: 1, playerCount: 2 }), 50 + 30 + 30);
  assert.equal(scoreRound({ solved: true, guesses: 6, timeMs: 1000, rank: 4, playerCount: 4 }), 50);
});

test('rejects connections without a playerId', async () => {
  const c: C = connect(url, { auth: {}, transports: ['websocket'], forceNew: true });
  clients.push(c);
  const err = await new Promise<Error>((r) => c.once('connect_error', r));
  assert.match(err.message, /playerId/);
});

test('full room flow: create, join, race, results, leaderboard', async () => {
  const alice = await client('alice-0001', 'Alice');
  const bob = await client('bob-000001', 'Bob');

  const created = await emitAck<any>(alice, 'room:create');
  assert.ok(created.ok);
  assert.match(created.code, /^[A-Z2-9]{4}$/);

  const bad = await emitAck<any>(bob, 'room:join', 'ZZZZ');
  assert.equal(bad.ok, false);

  const lobby = waitState(alice, (s) => s.players.length === 2);
  const joined = await emitAck<any>(bob, 'room:join', created.code.toLowerCase());
  assert.ok(joined.ok);
  const st = await lobby;
  assert.equal(st.hostId, 'alice-0001');

  const notHost = await emitAck<any>(bob, 'room:start');
  assert.equal(notHost.ok, false);

  const started = once(bob, 'game:start');
  const playing = waitState(bob, (s) => s.status === 'playing');
  assert.ok((await emitAck<any>(alice, 'room:start')).ok);
  const info = await started;
  assert.equal(info.round, 1);

  // 倒數中不能猜
  const early = await emitAck<any>(bob, 'game:guess', 'crane');
  assert.equal(early.ok, false);
  await playing;

  // 不在字庫中
  const invalid = await emitAck<any>(alice, 'game:guess', 'zzzzz');
  assert.deepEqual(invalid, { ok: false, error: '不在字庫中' });

  // Bob 看到 Alice 的進度只有顏色
  const progress = once(bob, 'game:progress');
  const g1 = await emitAck<any>(alice, 'game:guess', 'react');
  assert.ok(g1.ok);
  assert.deepEqual(g1.states, ['present', 'present', 'correct', 'present', 'absent']);
  const prog = await progress;
  assert.equal(prog.playerId, 'alice-0001');
  assert.equal((prog as any).words, undefined, 'opponent letters must not leak');

  const ended = once(alice, 'game:end');
  const b1 = await emitAck<any>(bob, 'game:guess', 'crane');
  assert.ok(b1.solved && b1.finished);
  const a2 = await emitAck<any>(alice, 'game:guess', 'crane');
  assert.ok(a2.solved);

  const end = (await ended) as GameEnd;
  assert.equal(end.answer, 'crane');
  assert.equal(end.reason, 'all-finished');
  assert.equal(end.results[0].playerId, 'bob-000001');
  assert.equal(end.results[0].rank, 1);
  assert.equal(end.results[0].points, 50 + 50 + 30); // 1 次猜中 + 第一名
  assert.equal(end.results[1].rank, 2);
  assert.equal(end.results[1].points, 50 + 40 + 15);
  assert.deepEqual(end.results[1].words, ['react', 'crane']);

  const res = await fetch(`${url}/api/leaderboard`);
  const board = await res.json();
  assert.equal(board[0].name, 'Bob');
  assert.equal(board[0].wins, 1);
  assert.equal(board[1].name, 'Alice');

  const me = await (await fetch(`${url}/api/players/alice-0001`)).json();
  assert.equal(me.rank, 2);
  assert.equal(me.games, 1);

  alice.emit('room:leave');
  bob.emit('room:leave');
});

test('quick match pairs two players and starts automatically', async () => {
  const c1 = await client('carol-0001', 'Carol');
  const c2 = await client('dave-00001', 'Dave');
  const m1 = once(c1, 'queue:matched');
  const s2 = once(c2, 'game:start');
  assert.ok((await emitAck<any>(c1, 'queue:join')).ok);
  assert.ok((await emitAck<any>(c2, 'queue:join')).ok);
  const { code } = await m1;
  assert.match(code, /^[A-Z2-9]{4}$/);
  await s2;
  c1.emit('room:leave');
  c2.emit('room:leave');
});

test('time limit ends the round with unsolved players at 0 points', async () => {
  const e1 = await client('erin-00001', 'Erin');
  const f1 = await client('frank-0001', 'Frank');
  const { code } = await emitAck<any>(e1, 'room:create');
  await emitAck<any>(f1, 'room:join', code);
  const ended = once(f1, 'game:end');
  await emitAck<any>(e1, 'room:start');
  const end = (await ended) as GameEnd;
  assert.equal(end.reason, 'time-up');
  assert.ok(end.results.every((r) => r.points === 0 && !r.solved));
});

test('reconnecting during a game keeps your seat and progress', async () => {
  const g1 = await client('gina-00001', 'Gina');
  const h1 = await client('hank-00001', 'Hank');
  const { code } = await emitAck<any>(g1, 'room:create');
  await emitAck<any>(h1, 'room:join', code);
  const playing = waitState(h1, (s) => s.status === 'playing');
  await emitAck<any>(g1, 'room:start');
  await playing;
  await emitAck<any>(h1, 'game:guess', 'react');

  h1.disconnect();
  let rejoined!: Promise<RoomState>;
  const h2 = await client('hank-00001', 'Hank', (c) => (rejoined = waitState(c, (s) => s.code === code)));
  const st = await rejoined;
  assert.equal(st.status, 'playing');
  const ended = once(h2, 'game:end');
  await emitAck<any>(h2, 'game:guess', 'crane');
  await emitAck<any>(g1, 'game:guess', 'crane');
  const end = (await ended) as GameEnd;
  const hank = end.results.find((r) => r.playerId === 'hank-00001')!;
  assert.deepEqual(hank.words, ['react', 'crane']);
});
