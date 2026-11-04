import type { Server, Socket } from 'socket.io';
import {
  evaluateGuess,
  isSolved,
  isValidWord,
  MAX_GUESSES,
  randomAnswer,
  type ClientToServerEvents,
  type GameEnd,
  type LetterState,
  type PlayerProgress,
  type PlayerResult,
  type RoomState,
  type RoomStatus,
  type ServerToClientEvents,
  type SocketAuth,
} from '@wordlee/shared';
import { config } from './config';
import type { Leaderboard } from './leaderboard';
import { scoreRound } from './scoring';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type WSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface SocketData {
  playerId: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
  socketId: string | null;
}

interface Progress {
  words: string[];
  rows: LetterState[][];
  solved: boolean;
  finished: boolean;
  timeMs?: number;
}

interface Room {
  code: string;
  hostId: string;
  members: Map<string, Member>;
  status: RoomStatus;
  round: number;
  answer: string | null;
  startAt?: number;
  timer?: NodeJS.Timeout;
  /** 這局開始時在場的玩家（包含中途離開的） */
  roster: Map<string, { name: string; progress: Progress }>;
}

export interface BattleOptions {
  timeLimitMs?: number;
  countdownMs?: number;
  maxPlayers?: number;
  /** 測試時可以指定答案 */
  pickAnswer?: () => string;
  now?: () => number;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易看錯的 I O 0 1

export function sanitizeName(raw: unknown): string {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 16);
  return s || `玩家${Math.floor(1000 + Math.random() * 9000)}`;
}

export class BattleServer {
  private rooms = new Map<string, Room>();
  /** playerId → room code */
  private playerRoom = new Map<string, string>();
  private queue: string[] = [];
  private sockets = new Map<string, WSocket>(); // playerId → socket
  private opts: Required<BattleOptions>;

  constructor(
    private io: IO,
    private leaderboard: Leaderboard,
    opts: BattleOptions = {},
  ) {
    this.opts = {
      timeLimitMs: opts.timeLimitMs ?? config.timeLimitMs,
      countdownMs: opts.countdownMs ?? config.countdownMs,
      maxPlayers: opts.maxPlayers ?? config.maxPlayers,
      pickAnswer: opts.pickAnswer ?? (() => randomAnswer()),
      now: opts.now ?? Date.now,
    };

    io.use((socket, next) => {
      const auth = socket.handshake.auth as Partial<SocketAuth>;
      const playerId = typeof auth.playerId === 'string' ? auth.playerId.slice(0, 64) : '';
      if (!/^[\w-]{8,64}$/.test(playerId)) return next(new Error('missing playerId'));
      socket.data.playerId = playerId;
      socket.data.name = sanitizeName(auth.name);
      next();
    });

    io.on('connection', (socket) => this.onConnection(socket as WSocket));
  }

  // ───────────────────────── connection ─────────────────────────

  private onConnection(socket: WSocket) {
    const { playerId } = socket.data;
    const old = this.sockets.get(playerId);
    this.sockets.set(playerId, socket); // 先換成新連線，舊連線的 disconnect 才不會把人踢出房間
    if (old && old.id !== socket.id) old.disconnect(true); // 同一個玩家只保留最新連線

    // 斷線重連:回到原本的房間
    const code = this.playerRoom.get(playerId);
    const room = code ? this.rooms.get(code) : undefined;
    if (room) {
      const m = room.members.get(playerId);
      if (m) {
        m.socketId = socket.id;
        m.name = socket.data.name;
        socket.join(room.code);
        this.broadcastState(room);
        this.sendAllProgress(room, socket);
      }
    }

    socket.on('room:create', (ack) => {
      if (typeof ack !== 'function') return;
      this.leaveCurrent(playerId);
      const room = this.createRoom(playerId);
      this.addMember(room, socket);
      ack({ ok: true, code: room.code });
    });

    socket.on('room:join', (rawCode, ack) => {
      if (typeof ack !== 'function') return;
      const code = String(rawCode ?? '').trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!room) return ack({ ok: false, error: '找不到這個房間' });
      if (this.playerRoom.get(playerId) === code) return ack({ ok: true, code });
      if (room.members.size >= this.opts.maxPlayers) return ack({ ok: false, error: '房間人數已滿' });
      this.leaveCurrent(playerId);
      this.addMember(room, socket);
      ack({ ok: true, code });
    });

    socket.on('room:leave', () => this.leaveCurrent(playerId));

    socket.on('room:start', (ack) => {
      if (typeof ack !== 'function') return;
      const room = this.roomOf(playerId);
      if (!room) return ack({ ok: false, error: '你不在房間裡' });
      if (room.hostId !== playerId) return ack({ ok: false, error: '只有房主可以開始' });
      if (room.status === 'countdown' || room.status === 'playing') return ack({ ok: false, error: '遊戲進行中' });
      const online = [...room.members.values()].filter((m) => m.socketId);
      if (online.length < 2) return ack({ ok: false, error: '至少要 2 個人才能開始' });
      this.startRound(room);
      ack({ ok: true });
    });

    socket.on('queue:join', (ack) => {
      if (typeof ack !== 'function') return;
      this.leaveCurrent(playerId);
      if (!this.queue.includes(playerId)) this.queue.push(playerId);
      ack({ ok: true });
      this.tryMatch();
    });

    socket.on('queue:leave', () => {
      this.queue = this.queue.filter((id) => id !== playerId);
    });

    socket.on('game:guess', (rawWord, ack) => {
      if (typeof ack !== 'function') return;
      const room = this.roomOf(playerId);
      if (!room || room.status !== 'playing' || !room.answer || room.startAt === undefined) {
        return ack({ ok: false, error: '遊戲還沒開始' });
      }
      if (this.opts.now() < room.startAt) return ack({ ok: false, error: '倒數中' });
      const entry = room.roster.get(playerId);
      if (!entry) return ack({ ok: false, error: '你不在這局裡' });
      const p = entry.progress;
      if (p.finished) return ack({ ok: false, error: '你已經完成這局了' });

      const word = String(rawWord ?? '').toLowerCase();
      if (word.length !== room.answer.length) return ack({ ok: false, error: '字母數不對' });
      if (!isValidWord(word)) return ack({ ok: false, error: '不在字庫中' });

      const states = evaluateGuess(word, room.answer);
      p.words.push(word);
      p.rows.push(states);
      if (isSolved(states)) {
        p.solved = true;
        p.finished = true;
        p.timeMs = this.opts.now() - room.startAt;
      } else if (p.rows.length >= MAX_GUESSES) {
        p.finished = true;
      }
      ack({ ok: true, states, solved: p.solved, finished: p.finished });
      this.io.to(room.code).emit('game:progress', this.progressOf(playerId, p));
      this.maybeEnd(room);
    });

    socket.on('disconnect', () => {
      if (this.sockets.get(playerId)?.id !== socket.id) return; // 已被新連線取代
      this.sockets.delete(playerId);
      this.queue = this.queue.filter((id) => id !== playerId);
      const room = this.roomOf(playerId);
      if (!room) return;
      const m = room.members.get(playerId);
      if (!m) return;
      if (room.status === 'lobby' || room.status === 'ended') {
        this.removeMember(room, playerId);
      } else {
        // 遊戲中斷線先保留位置，讓手機切 App 回來還能繼續
        m.socketId = null;
        this.broadcastState(room);
        this.maybeEnd(room);
      }
    });
  }

  // ───────────────────────── rooms ─────────────────────────

  private createRoom(hostId: string): Room {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      hostId,
      members: new Map(),
      status: 'lobby',
      round: 0,
      answer: null,
      roster: new Map(),
    };
    this.rooms.set(code, room);
    return room;
  }

  private addMember(room: Room, socket: WSocket) {
    const { playerId, name } = socket.data;
    room.members.set(playerId, { id: playerId, name, socketId: socket.id });
    this.playerRoom.set(playerId, room.code);
    socket.join(room.code);
    this.broadcastState(room);
    if (room.status === 'playing' || room.status === 'countdown') this.sendAllProgress(room, socket);
  }

  private removeMember(room: Room, playerId: string) {
    room.members.delete(playerId);
    this.playerRoom.delete(playerId);
    this.sockets.get(playerId)?.leave(room.code);

    if (room.members.size === 0) {
      clearTimeout(room.timer);
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === playerId) {
      room.hostId = [...room.members.values()].find((m) => m.socketId)?.id ?? [...room.members.keys()][0];
    }
    this.broadcastState(room);
    this.maybeEnd(room);
  }

  private leaveCurrent(playerId: string) {
    this.queue = this.queue.filter((id) => id !== playerId);
    const room = this.roomOf(playerId);
    if (room) this.removeMember(room, playerId);
  }

  private roomOf(playerId: string): Room | undefined {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  private tryMatch() {
    // 清掉已經斷線的
    this.queue = this.queue.filter((id) => this.sockets.has(id));
    while (this.queue.length >= 2) {
      const [a, b] = this.queue.splice(0, 2);
      const sa = this.sockets.get(a)!;
      const sb = this.sockets.get(b)!;
      const room = this.createRoom(a);
      this.addMember(room, sa);
      this.addMember(room, sb);
      sa.emit('queue:matched', { code: room.code });
      sb.emit('queue:matched', { code: room.code });
      this.startRound(room);
    }
  }

  // ───────────────────────── game flow ─────────────────────────

  private startRound(room: Room) {
    clearTimeout(room.timer);
    const now = this.opts.now();
    room.round += 1;
    room.answer = this.opts.pickAnswer();
    room.status = 'countdown';
    room.startAt = now + this.opts.countdownMs;
    room.roster = new Map(
      [...room.members.values()]
        .filter((m) => m.socketId)
        .map((m) => [m.id, { name: m.name, progress: { words: [], rows: [], solved: false, finished: false } }]),
    );

    this.io.to(room.code).emit('game:start', {
      round: room.round,
      startAt: room.startAt,
      timeLimitMs: this.opts.timeLimitMs,
      serverNow: now,
    });
    this.broadcastState(room);

    room.timer = setTimeout(() => {
      room.status = 'playing';
      this.broadcastState(room);
      room.timer = setTimeout(() => this.endRound(room, 'time-up'), this.opts.timeLimitMs);
    }, this.opts.countdownMs);
  }

  /** 在場（還在房間裡且連線中）的人都完成了就結束;全部人都不在了也結束。 */
  private maybeEnd(room: Room) {
    if (room.status !== 'playing' && room.status !== 'countdown') return;
    const active = [...room.roster.entries()].filter(([id]) => room.members.get(id)?.socketId);
    if (active.length === 0 || active.every(([, e]) => e.progress.finished)) {
      this.endRound(room, 'all-finished');
    }
  }

  private endRound(room: Room, reason: GameEnd['reason']) {
    if (room.status !== 'playing' && room.status !== 'countdown') return;
    clearTimeout(room.timer);
    room.status = 'ended';

    const entries = [...room.roster.entries()];
    const solved = entries
      .filter(([, e]) => e.progress.solved)
      .sort(([, x], [, y]) => (x.progress.timeMs! - y.progress.timeMs!) || x.progress.rows.length - y.progress.rows.length);
    const unsolved = entries.filter(([, e]) => !e.progress.solved);

    const results: PlayerResult[] = [];
    solved.forEach(([id, e], i) => results.push(this.result(id, e, i + 1, entries.length)));
    unsolved.forEach(([id, e]) => results.push(this.result(id, e, solved.length + 1, entries.length)));

    const end: GameEnd = { answer: room.answer!, results, reason };
    this.io.to(room.code).emit('game:end', end);
    this.broadcastState(room);

    if (entries.length >= 2) {
      try {
        this.leaderboard.recordMatch(room.code, room.answer!, results);
      } catch (e) {
        console.error('[leaderboard] failed to record match', e);
      }
    }

    // 遊戲中斷線、一直沒回來的人，結束後移出房間
    for (const m of [...room.members.values()]) {
      if (!m.socketId) this.removeMember(room, m.id);
    }
  }

  private result(id: string, e: { name: string; progress: Progress }, rank: number, playerCount: number): PlayerResult {
    const p = e.progress;
    const outcome = {
      solved: p.solved,
      guesses: p.rows.length,
      timeMs: p.solved ? p.timeMs! : null,
      rank,
      playerCount,
    };
    return {
      playerId: id,
      name: e.name,
      ...outcome,
      points: scoreRound(outcome),
      words: p.words,
    };
  }

  // ───────────────────────── broadcasting ─────────────────────────

  private progressOf(playerId: string, p: Progress): PlayerProgress {
    return { playerId, rows: p.rows, solved: p.solved, finished: p.finished, timeMs: p.timeMs };
  }

  private sendAllProgress(room: Room, socket: WSocket) {
    for (const [id, e] of room.roster) {
      const p = this.progressOf(id, e.progress);
      // 自己的進度附上猜過的字，手機重開 App 才能還原盤面;別人的只給顏色
      socket.emit('game:progress', id === socket.data.playerId ? { ...p, words: e.progress.words } : p);
    }
  }

  private broadcastState(room: Room) {
    this.io.to(room.code).emit('room:state', this.stateOf(room));
  }

  private stateOf(room: Room): RoomState {
    return {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: [...room.members.values()].map((m) => ({
        id: m.id,
        name: m.name,
        connected: !!m.socketId,
        isHost: m.id === room.hostId,
      })),
      startAt: room.startAt,
      timeLimitMs: this.opts.timeLimitMs,
      round: room.round,
    };
  }

  /** 給測試與健康檢查用 */
  stats() {
    return { rooms: this.rooms.size, queue: this.queue.length, online: this.sockets.size };
  }

  shutdown() {
    for (const r of this.rooms.values()) clearTimeout(r.timer);
  }
}
