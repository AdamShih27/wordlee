import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KEYS, load, save } from '@/lib/storage';
import { offlineInfo, shortMeaning } from '@/lib/dictionary';

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
    const add = (word: string) =>
      update((c) => {
        const w = word.toLowerCase();
        if (c.some((x) => x.word === w)) return c;
        return [{ word: w, zh: shortMeaning(w), phonetic: offlineInfo(w).phonetic, addedAt: Date.now() }, ...c];
      });
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
