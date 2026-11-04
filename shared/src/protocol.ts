import type { LetterState } from './evaluate';

/**
 * 連線對戰的 Socket.IO 事件定義。App 與 Server 共用，改這裡兩邊都會被型別檢查到。
 * 答案只存在 Server,直到該局結束才會送給玩家。
 */

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'ended';

export interface PlayerPublic {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: PlayerPublic[];
  /** 該局開始的 server 時間(ms),倒數結束才會有 */
  startAt?: number;
  /** 該局時間上限(ms) */
  timeLimitMs: number;
  round: number;
}

/** 對手進度:只給顏色，不給字母，避免偷看。 */
export interface PlayerProgress {
  playerId: string;
  rows: LetterState[][];
  solved: boolean;
  finished: boolean;
  /** 從開局到完成的毫秒數 */
  timeMs?: number;
  /** 只有送給「自己」的進度才會有（斷線重連時還原盤面用） */
  words?: string[];
}

export interface PlayerResult {
  playerId: string;
  name: string;
  solved: boolean;
  guesses: number;
  timeMs: number | null;
  rank: number;
  points: number;
  /** 該玩家這局猜過的字（結束後才公開，方便查字典） */
  words: string[];
}

export interface GameEnd {
  answer: string;
  results: PlayerResult[];
  reason: 'all-finished' | 'time-up' | 'opponents-left';
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'game:start': (info: { round: number; startAt: number; timeLimitMs: number; serverNow: number }) => void;
  'game:progress': (progress: PlayerProgress) => void;
  'game:end': (end: GameEnd) => void;
  'queue:matched': (info: { code: string }) => void;
  'error:message': (msg: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (ack: (res: Ack<{ code: string }>) => void) => void;
  'room:join': (code: string, ack: (res: Ack<{ code: string }>) => void) => void;
  'room:leave': () => void;
  'room:start': (ack: (res: Ack) => void) => void;
  'queue:join': (ack: (res: Ack) => void) => void;
  'queue:leave': () => void;
  'game:guess': (word: string, ack: (res: Ack<{ states: LetterState[]; solved: boolean; finished: boolean }>) => void) => void;
}

export interface SocketAuth {
  playerId: string;
  name: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  points: number;
  wins: number;
  games: number;
  bestTimeMs: number | null;
}
