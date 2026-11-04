import { useMemo, useState } from 'react';
import { Alert, Animated, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDictionary } from '@/components/DictionarySheet';
import { Icon } from '@/components/Icon';
import { Button, IconButton, Segmented } from '@/components/ui';
import { offlineInfo } from '@/lib/dictionary';
import { useVocab, type VocabCard } from '@/lib/vocab';
import { C, MAX_WIDTH, radius } from '@/lib/theme';

type View_ = 'list' | 'review';

/** 手機用系統對話框確認;網頁版的 confirm() 在嵌入頁面裡常被擋，改成在卡片上直接確認。 */
function confirmNative(message: string, onYes: () => void) {
  Alert.alert('確認', message, [
    { text: '取消', style: 'cancel' },
    { text: '刪除', style: 'destructive', onPress: onYes },
  ]);
}

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const vocab = useVocab();
  const [view, setView] = useState<View_>('list');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>我的單字卡</Text>
        <Text style={styles.count}>{vocab.cards.length} 個字</Text>
      </View>
      {vocab.cards.length > 0 && (
        <View style={{ paddingVertical: 10 }}>
          <Segmented<View_>
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: '清單' },
              { value: 'review', label: '複習模式' },
            ]}
          />
        </View>
      )}
      <View style={styles.body}>
        {vocab.cards.length === 0 ? <Empty /> : view === 'list' ? <CardList /> : <Review cards={vocab.cards} />}
      </View>
    </View>
  );
}

function Empty() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="cards" size={36} color={C.primary} />
      </View>
      <Text style={styles.emptyTitle}>還沒有收藏的單字</Text>
      <Text style={styles.emptyText}>
        玩遊戲時，點每一行右邊的書本圖示查字典，看到不會的字就按「收藏」，它會出現在這裡讓你複習。
      </Text>
    </View>
  );
}

function CardList() {
  const vocab = useVocab();
  const dictionary = useDictionary();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'az'>('new');
  const [confirming, setConfirming] = useState<string | null>(null);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    const filtered = vocab.cards.filter((c) => !k || c.word.includes(k) || c.zh.includes(k));
    return sort === 'az' ? [...filtered].sort((a, b) => a.word.localeCompare(b.word)) : filtered;
  }, [vocab.cards, q, sort]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={C.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="搜尋英文或中文"
            placeholderTextColor={C.textFaint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={() => setSort((s) => (s === 'new' ? 'az' : 'new'))} style={styles.sortBtn}>
          <Text style={styles.sortText}>{sort === 'new' ? '最新' : 'A→Z'}</Text>
        </Pressable>
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.word}
        contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            testID={`card-${item.word}`}
            onPress={() => dictionary.open(item.word)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardHead}>
                <Text style={styles.cardWord}>{item.word}</Text>
                {item.phonetic && <Text style={styles.cardPh}>/{item.phonetic}/</Text>}
              </View>
              <Text style={styles.cardZh} numberOfLines={2}>
                {item.zh || '（點開看線上解釋）'}
              </Text>
              <Text style={styles.cardDate}>收藏於 {new Date(item.addedAt).toLocaleDateString('zh-TW')}</Text>
            </View>
            {confirming === item.word ? (
              <View style={styles.confirmRow}>
                <Button small title="取消" variant="ghost" onPress={() => setConfirming(null)} />
                <Button
                  small
                  title="刪除"
                  variant="danger"
                  testID={`confirm-delete-${item.word}`}
                  onPress={() => {
                    vocab.remove(item.word);
                    setConfirming(null);
                  }}
                />
              </View>
            ) : (
              <IconButton
                name="trash"
                label={`刪除 ${item.word}`}
                size={20}
                color={C.textFaint}
                testID={`delete-${item.word}`}
                onPress={() =>
                  Platform.OS === 'web'
                    ? setConfirming(item.word)
                    : confirmNative(`要把「${item.word}」從單字卡移除嗎？`, () => vocab.remove(item.word))
                }
              />
            )}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>找不到符合的單字</Text>}
      />
    </View>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Review({ cards }: { cards: VocabCard[] }) {
  const dictionary = useDictionary();
  const vocab = useVocab();
  const [order, setOrder] = useState(() => shuffle(cards.map((c) => c.word)));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flip] = useState(() => new Animated.Value(0));

  // 單字卡數量變了（新增/刪除）就重新排
  const words = order.filter((w) => cards.some((c) => c.word === w));
  const word = words[Math.min(i, words.length - 1)];
  const info = useMemo(() => (word ? offlineInfo(word) : null), [word]);
  if (!word || !info) return null;

  const native = Platform.OS !== 'web';
  const turn = () => {
    Animated.timing(flip, { toValue: 1, duration: 120, useNativeDriver: native }).start(() => {
      setFlipped((f) => !f);
      Animated.timing(flip, { toValue: 0, duration: 120, useNativeDriver: native }).start();
    });
  };
  const go = (d: number) => {
    setFlipped(false);
    setI((x) => (x + d + words.length) % words.length);
  };
  const scaleX = flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const meanings = info.zh.length ? info.zh : (info.lemma?.zh ?? []);

  return (
    <View style={{ flex: 1, gap: 14 }}>
      <Text style={styles.progress}>
        {Math.min(i, words.length - 1) + 1} / {words.length}
      </Text>
      <Pressable onPress={turn} style={{ flex: 1 }} testID="flashcard">
        <Animated.View style={[styles.flash, flipped && styles.flashBack, { transform: [{ scaleX }] }]}>
          {!flipped ? (
            <>
              <Text style={styles.flashWord}>{word}</Text>
              {info.phonetic && <Text style={styles.flashPh}>/{info.phonetic}/</Text>}
              <Text style={styles.flashHint}>點卡片看意思</Text>
            </>
          ) : (
            <>
              <Text style={[styles.flashWordSmall]}>{word}</Text>
              <View style={{ gap: 8, alignSelf: 'stretch' }}>
                {meanings.slice(0, 4).map((m, k) => (
                  <Text key={k} style={styles.flashMeaning}>
                    {m.posZh ? <Text style={styles.flashPos}>{m.posZh} </Text> : null}
                    {m.text}
                  </Text>
                ))}
                {meanings.length === 0 && <Text style={styles.flashMeaning}>離線字典沒有這個字，點下方「完整解釋」查線上字典</Text>}
              </View>
            </>
          )}
        </Animated.View>
      </Pressable>
      <View style={styles.reviewBtns}>
        <Button title="上一張" icon="left" variant="secondary" onPress={() => go(-1)} style={{ flex: 1 }} />
        <Button title="翻面" icon="flip" onPress={turn} style={{ flex: 1 }} />
        <Button title="下一張" icon="right" variant="secondary" onPress={() => go(1)} style={{ flex: 1 }} />
      </View>
      <View style={styles.reviewBtns}>
        <Button small title="完整解釋" icon="book" variant="ghost" onPress={() => dictionary.open(word)} />
        <Button
          small
          title="洗牌"
          icon="shuffle"
          variant="ghost"
          onPress={() => {
            setOrder(shuffle(cards.map((c) => c.word)));
            setI(0);
            setFlipped(false);
          }}
        />
        <Button
          small
          title="記住了，移除"
          icon="check"
          variant="ghost"
          onPress={() => {
            vocab.remove(word);
            setFlipped(false);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: C.text },
  count: { fontSize: 14, color: C.textMuted, fontWeight: '700' },
  body: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: C.text },
  sortBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: C.primarySoft,
  },
  sortText: { color: C.primary, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
  },
  confirmRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardWord: { fontSize: 20, fontWeight: '800', color: C.text },
  cardPh: { fontSize: 13, color: C.textMuted },
  cardZh: { fontSize: 14, color: C.text, marginTop: 4, lineHeight: 20 },
  cardDate: { fontSize: 11, color: C.textFaint, marginTop: 6 },
  progress: { textAlign: 'center', color: C.textMuted, fontWeight: '700' },
  flash: {
    flex: 1,
    minHeight: 260,
    borderRadius: radius.xl,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  flashBack: { backgroundColor: C.bg, borderWidth: 2, borderColor: C.primaryLight, justifyContent: 'flex-start' },
  flashWord: { fontSize: 44, fontWeight: '900', color: C.white, letterSpacing: 1 },
  flashWordSmall: { fontSize: 26, fontWeight: '900', color: C.primary, marginBottom: 8 },
  flashPh: { fontSize: 18, color: C.primaryLight },
  flashHint: { fontSize: 13, color: C.primaryLight, marginTop: 20 },
  flashMeaning: { fontSize: 17, color: C.text, lineHeight: 25 },
  flashPos: { color: C.primary, fontWeight: '800' },
  reviewBtns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
});
