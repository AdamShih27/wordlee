import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KEYS, load, save } from '@/lib/storage';
import { ensureOffline, offlineInfo, shortMeaning } from '@/lib/dictionary';

export interface VocabCard {
  word: string;
  /** 一行中文摘要 */
  zh: string;
  phonetic?: string;
  addedAt: number;
  /** 複習時按「記住了」的次數 */
  known?: number;
}

interface VocabContext {
  cards: VocabCard[];
  ready: boolean;
  has: (word: string) => boolean;
  add: (word: string) => void;
  remove: (word: string) => void;
  toggle: (word: string) => void;
  markKnown: (word: string) => void;
}

const Ctx = createContext<VocabContext | null>(null);

export function VocabProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    load<VocabCard[]>(KEYS.vocab, []).then((c) => {
      setCards(c);
      setReady(true);
    });
  }, []);

  const update = useCallback((fn: (c: VocabCard[]) => VocabCard[]) => {
    setCards((prev) => {
      const next = fn(prev);
      save(KEYS.vocab, next);
      return next;
    });
  }, []);

  const value = useMemo<VocabContext>(() => {
    const set = new Set(cards.map((c) => c.word));
    const add = (word: string) => {
      const w = word.toLowerCase();
      // 先放進單字卡（按下去馬上有反應），離線字典載入後再補上中文摘要
      update((c) => (c.some((x) => x.word === w) ? c : [{ word: w, zh: shortMeaning(w), phonetic: offlineInfo(w).phonetic, addedAt: Date.now() }, ...c]));
      ensureOffline(w).then(() =>
        update((c) => c.map((x) => (x.word === w && !x.zh ? { ...x, zh: shortMeaning(w), phonetic: offlineInfo(w).phonetic } : x))),
      );
    };
    const remove = (word: string) => update((c) => c.filter((x) => x.word !== word.toLowerCase()));
    return {
      cards,
      ready,
      has: (w) => set.has(w.toLowerCase()),
      add,
      remove,
      toggle: (w) => (set.has(w.toLowerCase()) ? remove(w) : add(w)),
      markKnown: (w) => update((c) => c.map((x) => (x.word === w ? { ...x, known: (x.known ?? 0) + 1 } : x))),
    };
  }, [cards, ready, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVocab() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVocab must be used inside VocabProvider');
  return v;
}
