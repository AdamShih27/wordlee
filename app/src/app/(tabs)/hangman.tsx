import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  answersFor,
  guessLetter,
  HANGMAN_LIVES,
  hangmanView,
  LENGTHS,
  type LetterState,
} from '@wordlee/shared';
import { useDictionary } from '@/components/DictionarySheet';
import { Icon } from '@/components/Icon';
import { Keyboard } from '@/components/Keyboard';
import { ResultPanel } from '@/components/ResultPanel';
import { Tile } from '@/components/Tile';
import { Button, Segmented } from '@/components/ui';
import { useOfflineInfo } from '@/lib/dictionary';
import { KEYS, load, save } from '@/lib/storage';
import { usePhysicalKeyboard } from '@/lib/usePhysicalKeyboard';
import { useVocab, type VocabCard } from '@/lib/vocab';
import { C, MAX_WIDTH, radius } from '@/lib/theme';

type Source = 'common' | 'cards';

interface Round {
  id: number;
  word: string;
  source: Source;
}

function pickCommon(prev?: string): string {
  const n = LENGTHS[Math.floor(Math.random() * LENGTHS.length)];
  const list = answersFor(n);
  let w = list[Math.floor(Math.random() * list.length)];
  if (w === prev) w = list[(list.indexOf(w) + 1) % list.length];
  return w;
}

function pickCard(cards: VocabCard[], prev?: string): string | null {
  if (cards.length === 0) return null;
  const pool = cards.length > 1 ? cards.filter((c) => c.word !== prev) : cards;
  return pool[Math.floor(Math.random() * pool.length)].word;
}

/** 中文提示裡如果直接出現英文答案（例如「book 的複數」），先遮起來。 */
function maskWord(text: string, word: string) {
  return text.replace(new RegExp(word, 'gi'), '＿'.repeat(2));
}

export default function HangmanScreen() {
  const insets = useSafeAreaInsets();
  const vocab = useVocab();
  const [source, setSource] = useState<Source>('common');
  const [round, setRound] = useState<Round>(() => ({ id: 0, word: pickCommon(), source: 'common' }));
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    load<{ best: number }>(KEYS.hangman, { best: 0 }).then((s) => setBest(s.best ?? 0));
  }, []);

  const next = (src: Source = source) => {
    if (src === 'cards') {
      const w = pickCard(vocab.cards, round.word);
      if (w) setRound((r) => ({ id: r.id + 1, word: w, source: 'cards' }));
      else setRound((r) => ({ ...r, id: r.id + 1, source: 'cards' }));
    } else {
      setRound((r) => ({ id: r.id + 1, word: pickCommon(r.word), source: 'common' }));
    }
  };

  const changeSource = (s: Source) => {
    setSource(s);
    next(s);
  };

  const onFinish = (won: boolean) => {
    if (won) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) {
        setBest(s);
        save(KEYS.hangman, { best: s });
      }
      if (round.source === 'cards') vocab.markKnown(round.word);
    } else {
      setStreak(0);
    }
  };

  // 回到這個分頁時，如果正在用單字卡出題但題目已經不在單字卡裡（或剛收藏了第一張），換一題
  const stale = source === 'cards' && vocab.cards.length > 0 && !vocab.has(round.word);
  useFocusEffect(
    useCallback(() => {
      if (stale) next('cards');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stale]),
  );

  const noCards = source === 'cards' && vocab.cards.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hangman</Text>
          <Text style={styles.subtitle}>看中文意思，拼出英文單字</Text>
        </View>
        <View style={styles.streak} accessibilityLabel={`連續答對 ${streak} 題，最佳 ${best} 題`}>
          <Text style={styles.streakN}>{streak}</Text>
          <Text style={styles.streakLabel}>連勝 · 最佳 {best}</Text>
        </View>
      </View>
      <View style={{ paddingBottom: 6 }}>
        <Segmented<Source>
          value={source}
          onChange={changeSource}
          options={[
            { value: 'common', label: '常見單字' },
            { value: 'cards', label: `我的單字卡（${vocab.cards.length}）` },
          ]}
        />
      </View>

      <View style={styles.body}>
        {noCards ? (
          <View style={styles.empty}>
            <Icon name="cards" size={36} color={C.primary} />
            <Text style={styles.emptyTitle}>單字卡還是空的</Text>
            <Text style={styles.emptyText}>
              玩 Wordlee 時把不會的字收藏起來，這裡就會用它們出題，幫你練習拼字。
            </Text>
            <Button title="先用常見單字玩" variant="secondary" onPress={() => changeSource('common')} />
          </View>
        ) : (
          <HangmanGame key={round.id} word={round.word} fromCards={round.source === 'cards'} onFinish={onFinish} onNext={() => next()} />
        )}
      </View>
    </View>
  );
}

function HangmanGame({
  word,
  fromCards,
  onFinish,
  onNext,
}: {
  word: string;
  fromCards: boolean;
  onFinish: (won: boolean) => void;
  onNext: () => void;
}) {
  const dictionary = useDictionary();
  const vocab = useVocab();
  const { width, height } = useWindowDimensions();
  const info = useOfflineInfo(word);
  const [guessed, setGuessed] = useState<readonly string[]>([]);
  const view = hangmanView(word, guessed);
  const over = view.status !== 'playing';

  const card = vocab.cards.find((c) => c.word === word);
  const meanings = (info?.zh.length ? info.zh : (info?.lemma?.zh ?? []))
    .filter((m) => !m.text.startsWith('['))
    .slice(0, 2);
  const hintFallback = card?.zh;

  const onKey = (key: string) => {
    if (over) {
      if (key === 'enter') onNext();
      return;
    }
    if (!/^[a-z]$/.test(key)) return;
    const g = guessLetter(word, guessed, key);
    if (g === guessed) return;
    setGuessed(g);
    const v = hangmanView(word, g);
    if (v.status !== 'playing') onFinish(v.status === 'won');
  };
  usePhysicalKeyboard(onKey);

  const keyStates: Record<string, LetterState> = {};
  for (const g of guessed) keyStates[g] = word.includes(g) ? 'correct' : 'absent';

  const tile = Math.min(48, Math.floor((Math.min(width, MAX_WIDTH) - 32 - 6 * (word.length - 1)) / word.length));
  const compact = height < 700;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.hint} testID="hangman-hint">
        <Text style={styles.hintLabel}>中文提示 · {word.length} 個字母</Text>
        {meanings.length > 0 ? (
          meanings.map((m, i) => (
            <Text key={i} style={styles.hintText}>
              {m.posZh ? <Text style={styles.hintPos}>{m.posZh} </Text> : null}
              {maskWord(m.text, word)}
            </Text>
          ))
        ) : hintFallback ? (
          <Text style={styles.hintText}>{maskWord(hintFallback, word)}</Text>
        ) : (
          <Text style={styles.hintText}>載入中…</Text>
        )}
      </View>

      <Balloons left={view.livesLeft} />

      <View style={styles.slots} accessibilityLabel={`答案：${view.slots.map((s) => s ?? '空格').join(' ')}`}>
        {word.split('').map((ch, i) => {
          const found = view.slots[i];
          const show = found ?? (view.status === 'lost' ? ch : undefined);
          const state: LetterState | undefined = found ? 'correct' : view.status === 'lost' ? 'absent' : undefined;
          return <Tile key={i} letter={show} state={state} size={tile} />;
        })}
      </View>

      <Text style={styles.wrong} testID="hangman-wrong">
        {view.wrong.length ? `猜錯：${view.wrong.map((w) => w.toUpperCase()).join(' ')}` : ' '}
      </Text>

      <View style={{ flex: 1 }} />

      <View style={{ paddingBottom: 10 }}>
        {over ? (
          <ResultPanel
            answer={word}
            won={view.status === 'won'}
            guesses={guessed.length}
            headline={
              view.status === 'won'
                ? view.wrong.length === 0
                  ? '完美！一次都沒猜錯'
                  : `拼出來了！猜錯 ${view.wrong.length} 次`
                : '氣球都破了'
            }
            onLookup={dictionary.open}
            onNewGame={onNext}
            tip={fromCards ? null : '不認識這個字的話，按「收藏」把它加進單字卡，之後可以用單字卡出題複習'}
            extra={
              fromCards && card && view.status === 'won' ? (
                <Text style={styles.known}>這張單字卡你已經拼對 {card.known ?? 0} 次</Text>
              ) : null
            }
          />
        ) : (
          <Keyboard onKey={onKey} keyStates={keyStates} actionKeys={false} keyHeight={compact ? 46 : 54} />
        )}
      </View>
    </View>
  );
}

const BALLOON_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#1D4ED8', '#38BDF8', '#6366F1'];

/** 生命值:6 顆氣球，猜錯一次破一顆。 */
function Balloons({ left }: { left: number }) {
  return (
    <View style={styles.balloons} accessibilityLabel={`還剩 ${left} 次機會`} testID="balloons">
      {Array.from({ length: HANGMAN_LIVES }, (_, i) => (
        <Balloon key={i} alive={i < left} color={BALLOON_COLORS[i]} />
      ))}
    </View>
  );
}

function Balloon({ alive, color }: { alive: boolean; color: string }) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (alive) return;
    // 破掉:先脹大一點再縮小
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 90, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(scale, { toValue: 0.45, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [alive, scale]);
  return (
    <View style={styles.balloonWrap}>
      <Animated.View
        style={[
          styles.balloon,
          { backgroundColor: alive ? color : 'transparent', borderColor: alive ? color : C.border, transform: [{ scale }] },
        ]}>
        {alive && <View style={styles.shine} />}
      </Animated.View>
      <View style={[styles.knot, { borderBottomColor: alive ? color : 'transparent' }]} />
      <View style={[styles.string, { backgroundColor: alive ? C.borderStrong : 'transparent' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: C.text },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  streak: { alignItems: 'flex-end' },
  streakN: { fontSize: 24, fontWeight: '900', color: C.primary, fontVariant: ['tabular-nums'] },
  streakLabel: { fontSize: 11, color: C.textMuted, fontWeight: '700' },
  body: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 12 },
  hint: {
    backgroundColor: C.primarySoft,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  hintLabel: { fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5 },
  hintText: { fontSize: 18, color: C.text, lineHeight: 26 },
  hintPos: { color: C.primary, fontWeight: '800', fontSize: 15 },
  balloons: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16, height: 64 },
  balloonWrap: { alignItems: 'center', width: 30 },
  balloon: {
    width: 28,
    height: 34,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: 'solid',
  },
  shine: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 6,
    height: 9,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  knot: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '180deg' }],
  },
  string: { width: 1.5, height: 18 },
  slots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 },
  wrong: { textAlign: 'center', color: C.textMuted, fontWeight: '700', marginTop: 12, letterSpacing: 1 },
  known: { fontSize: 13, color: C.primaryDark, textAlign: 'center', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21 },
});
