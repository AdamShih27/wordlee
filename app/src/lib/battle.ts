import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  GameEnd,
  LetterState,
  PlayerProgress,
  RoomState,
  ServerToClientEvents,
} from '@wordlee/shared';
import { SERVER_URL } from '@/lib/config';
import type { EvalResult } from '@/lib/useGuessGame';

type S = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface RoundInfo {
  round: number;
  /** 換算成本機時間的開局時間 */
  startAt: number;
  timeLimitMs: number;
}

/**
 * 連線對戰的狀態。答案在 Server,這裡只拿得到自己的結果和對手的顏色。
 */
export function useBattle(playerId: string, name: string, enabled: boolean) {
  const socketRef = useRef<S | null>(null);
  const offsetRef = useRef(0); // 本機時間 - Server 時間
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [queueing, setQueueing] = useState(false);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [progress, setProgress] = useState<Record<string, PlayerProgress>>({});
  const [end, setEnd] = useState<GameEnd | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !playerId) return;
    const s: S = io(SERVER_URL, {
      auth: { playerId, name },
      transports: ['websocket'],
      reconnectionDelayMax: 4000,
      timeout: 6000,
      autoConnect: false,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setConnected(true);
      setError(null);
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => {
      setConnected(false);
      setError(`連不到對戰伺服器(${SERVER_URL})`);
    });
    s.on('room:state', (st) => {
      setRoom(st);
      setQueueing(false);
      if (st.startAt !== undefined) {
        setRound((r) =>
          r && r.round === st.round ? r : { round: st.round, startAt: st.startAt! + offsetRef.current, timeLimitMs: st.timeLimitMs },
        );
      }
    });
    s.on('game:start', (info) => {
      offsetRef.current = Date.now() - info.serverNow;
      setRound({ round: info.round, startAt: info.startAt + offsetRef.current, timeLimitMs: info.timeLimitMs });
      setProgress({});
      setEnd(null);
    });
    s.on('game:progress', (p) => setProgress((prev) => ({ ...prev, [p.playerId]: p })));
    s.on('game:end', (e) => setEnd(e));
    s.on('queue:matched', () => setQueueing(false));
    s.connect();

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // name 改變時重新連線，讓 Server 拿到新暱稱
  }, [enabled, playerId, name, attempt]);

  const emit = useCallback(<T extends object>(fn: (s: S, ack: (r: Ack<T>) => void) => void) => {
    return new Promise<Ack<T>>((resolve) => {
      const s = socketRef.current;
      if (!s?.connected) return resolve({ ok: false, error: '尚未連線到伺服器' });
      const timer = setTimeout(() => resolve({ ok: false, error: '伺服器沒有回應' }), 6000);
      fn(s, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
  }, []);

  const clearRoom = () => {
    setRoom(null);
    setRound(null);
    setProgress({});
    setEnd(null);
  };

  return {
    connected,
    error,
    room,
    queueing,
    round,
    progress,
    end,
    retry: () => setAttempt((n) => n + 1),
    createRoom: () => emit<{ code: string }>((s, ack) => s.emit('room:create', ack)),
    joinRoom: (code: string) => emit<{ code: string }>((s, ack) => s.emit('room:join', code, ack)),
    start: () => emit((s, ack) => s.emit('room:start', ack)),
    leave: () => {
      socketRef.current?.emit('room:leave');
      clearRoom();
    },
    quickMatch: async () => {
      clearRoom();
      const r = await emit((s, ack) => s.emit('queue:join', ack));
      if (r.ok) setQueueing(true);
      return r;
    },
    cancelQueue: () => {
      socketRef.current?.emit('queue:leave');
      setQueueing(false);
    },
    guess: async (word: string): Promise<EvalResult> => {
      const r = await emit<{ states: LetterState[]; solved: boolean; finished: boolean }>((s, ack) =>
        s.emit('game:guess', word, ack),
      );
      return r.ok ? { ok: true, states: r.states } : { ok: false, error: r.error };
    },
  };
}
