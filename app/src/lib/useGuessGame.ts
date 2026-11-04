import { useCallback, useEffect, useRef, useState } from 'react';
import { isSolved, MAX_GUESSES, mergeKeyStates, WORD_LENGTH, type LetterState } from '@wordlee/shared';

export interface Row {
  word: string;
  states: LetterState[];
}
export type GameStatus = 'playing' | 'won' | 'lost';
export type EvalResult = { ok: true; states: LetterState[] } | { ok: false; error: string };

interface Options {
  /** 判斷一個猜測:單人模式在本機算，對戰模式送給 Server 算 */
  evaluate: (word: string, rows: Row[]) => Promise<EvalResult> | EvalResult;
  initialRows?: Row[];
  maxGuesses?: number;
  /** 翻牌動畫總長(ms) */
  revealMs?: number;
  /** 每一行翻完之後呼叫（用來存檔、算統計） */
  onRevealed?: (rows: Row[], status: GameStatus) => void;
  onError?: (message: string) => void;
}

function statusOf(rows: Row[], max: number): GameStatus {
  const last = rows[rows.length - 1];
  if (last && isSolved(last.states)) return 'won';
  if (rows.length >= max) return 'lost';
  return 'playing';
}

function keyStatesOf(rows: Row[]) {
  return rows.reduce<Record<string, LetterState>>((acc, r) => mergeKeyStates(acc, r.word, r.states), {});
}

export function useGuessGame({
  evaluate,
  initialRows = [],
  maxGuesses = MAX_GUESSES,
  revealMs = 1500,
  onRevealed,
  onError,
}: Options) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState<GameStatus>(() => statusOf(initialRows, maxGuesses));
  const [keyStates, setKeyStates] = useState(() => keyStatesOf(initialRows));
  const [shake, setShake] = useState(0);
  /** 正在翻牌的那一行（只有這一行要播動畫） */
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const locked = busy || revealingRow !== null || status !== 'playing';

  const reset = useCallback(
    (next: Row[] = []) => {
      if (timer.current) clearTimeout(timer.current);
      setRows(next);
      setCurrent('');
      setStatus(statusOf(next, maxGuesses));
      setKeyStates(keyStatesOf(next));
      setRevealingRow(null);
      setBusy(false);
    },
    [maxGuesses],
  );

  const typeLetter = (ch: string) => {
    if (locked) return;
    setCurrent((c) => (c.length < WORD_LENGTH ? c + ch.toLowerCase() : c));
  };

  const backspace = () => {
    if (locked) return;
    setCurrent((c) => c.slice(0, -1));
  };

  const fail = (msg: string) => {
    setShake((n) => n + 1);
    onError?.(msg);
  };

  const submit = async () => {
    if (locked) return;
    if (current.length < WORD_LENGTH) return fail('字母不足');
    setBusy(true);
    let res: EvalResult;
    try {
      res = await evaluate(current, rows);
    } catch {
      res = { ok: false, error: '連線失敗，請再試一次' };
    }
    setBusy(false);
    if (!res.ok) return fail(res.error);

    const nextRows = [...rows, { word: current, states: res.states }];
    const nextStatus = statusOf(nextRows, maxGuesses);
    setRows(nextRows);
    setCurrent('');
    setRevealingRow(nextRows.length - 1);
    timer.current = setTimeout(() => {
      setRevealingRow(null);
      setKeyStates(keyStatesOf(nextRows));
      setStatus(nextStatus);
      onRevealed?.(nextRows, nextStatus);
    }, revealMs);
  };

  const onKey = (key: string) => {
    if (key === 'enter') submit();
    else if (key === 'back') backspace();
    else if (/^[a-z]$/i.test(key)) typeLetter(key);
  };

  return { rows, current, status, keyStates, shake, revealingRow, busy, locked, onKey, reset };
}
