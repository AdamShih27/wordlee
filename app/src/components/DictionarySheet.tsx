import { useAudioPlayer } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Chip, SectionTitle, Sheet } from '@/components/ui';
import { fetchOnlineInfo, useOfflineInfo, type OnlineInfo } from '@/lib/dictionary';
import { useVocab } from '@/lib/vocab';
import { C, radius } from '@/lib/theme';

interface DictionaryContext {
  open: (word: string) => void;
}

const Ctx = createContext<DictionaryContext | null>(null);

/** 全 App 共用一個字典面板:任何地方呼叫 useDictionary().open('crane') 就會打開。 */
export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<string[]>([]);
  const word = history[history.length - 1];
  const open = useCallback((w: string) => setHistory([w.toLowerCase()]), []);
  const push = useCallback((w: string) => setHistory((h) => [...h, w.toLowerCase()]), []);
  const back = useCallback(() => setHistory((h) => h.slice(0, -1)), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet
        visible={!!word}
        onClose={() => setHistory([])}
        title="字典"
        testID="dictionary-sheet"
        headerRight={
          history.length > 1 ? (
            <Pressable onPress={back} style={styles.backBtn} accessibilityRole="button">
              <Icon name="left" size={16} color={C.primary} />
              <Text style={styles.backText}>{history[history.length - 2].toUpperCase()}</Text>
            </Pressable>
          ) : null
        }>
        {word && <WordDetails key={word} word={word} onOpenWord={push} />}
      </Sheet>
    </Ctx.Provider>
  );
}

export function useDictionary() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDictionary must be used inside DictionaryProvider');
  return v;
}

function WordDetails({ word, onOpenWord }: { word: string; onOpenWord: (w: string) => void }) {
  const offline = useOfflineInfo(word)!;
  const offlineReady = offline.ready;
  const [online, setOnline] = useState<OnlineInfo | null>(null);
  const vocab = useVocab();
  const saved = vocab.has(word);

  useEffect(() => {
    let alive = true;
    fetchOnlineInfo(word).then((r) => alive && setOnline(r));
    return () => {
      alive = false;
    };
  }, [word]);

  const phonetic = online?.phonetic ?? (offline.phonetic ? `/${offline.phonetic}/` : undefined);
  const number =
    offline.number ?? (online?.pluralOf ? { kind: 'plural' as const, other: online.pluralOf, alsoThirdPerson: false } : null);
  const posList = [...new Set(offline.zh.map((m) => m.posZh).filter((p) => p && p !== '複數'))];
  const nothing = offlineReady && !offline.found && online?.status === 'notfound';

  return (
    <View testID={`word-${word}`}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.word}>{word}</Text>
          <View style={styles.phoneticRow}>
            {phonetic && <Text style={styles.phonetic}>{phonetic}</Text>}
            {online?.audio && <SpeakButton url={online.audio} />}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          testID="save-word"
          onPress={() => vocab.toggle(word)}
          style={({ pressed }) => [styles.saveBtn, saved && styles.saveBtnOn, pressed && { opacity: 0.7 }]}>
          <Icon name={saved ? 'bookmarked' : 'bookmark'} size={18} color={saved ? C.white : C.primary} />
          <Text style={[styles.saveText, saved && { color: C.white }]}>{saved ? '已收藏' : '收藏'}</Text>
        </Pressable>
      </View>

      {(posList.length > 0 || number) && (
        <View style={styles.badges}>
          {posList.map((p) => (
            <Chip key={p} label={p} />
          ))}
          {number?.kind === 'plural' && <Chip label="複數形" color="#9A3412" bg="#FFEDD5" />}
          {number?.kind === 'singular' && <Chip label="單數名詞" color="#166534" bg="#DCFCE7" />}
        </View>
      )}

      {nothing && <Text style={styles.muted}>字典裡找不到這個字。它可能是比較少見的拼法或專有名詞。</Text>}

      {offline.zh.length > 0 && (
        <>
          <SectionTitle>中文意思</SectionTitle>
          {offline.zh.map((m, i) => (
            <View key={i} style={styles.meaning}>
              {!!m.posZh && <Text style={styles.pos}>{m.posZh}</Text>}
              <Text style={styles.meaningText}>{m.text}</Text>
            </View>
          ))}
        </>
      )}

      {number && (
        <>
          <SectionTitle>單複數</SectionTitle>
          <View style={styles.card}>
            {number.kind === 'plural' ? (
              <Text style={styles.cardText}>
                <Text style={styles.bold}>{word}</Text> 是 <WordLink w={number.other} onPress={onOpenWord} /> 的
                <Text style={styles.bold}>複數形</Text>
                {number.alsoThirdPerson ? '（當動詞時也是第三人稱單數）' : ''}
              </Text>
            ) : (
              <Text style={styles.cardText}>
                單數名詞，複數形是 <Text style={styles.bold}>{number.other}</Text>
              </Text>
            )}
          </View>
        </>
      )}

      {offline.lemma && number?.kind !== 'plural' && (
        <>
          <SectionTitle>原形</SectionTitle>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              <Text style={styles.bold}>{word}</Text> 是 <WordLink w={offline.lemma.word} onPress={onOpenWord} /> 的
              {offline.lemma.label}
            </Text>
          </View>
        </>
      )}
      {offline.lemma && offline.lemma.zh.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {offline.lemma.zh.map((m, i) => (
            <View key={i} style={styles.meaning}>
              {!!m.posZh && <Text style={styles.pos}>{m.posZh}</Text>}
              <Text style={[styles.meaningText, { color: C.textMuted }]}>
                {offline.lemma!.word}：{m.text}
              </Text>
            </View>
          ))}
        </View>
      )}

      {offline.forms.length > 0 && (
        <>
          <SectionTitle>詞形變化</SectionTitle>
          <View style={styles.forms}>
            {offline.forms.map((f) => (
              <View key={f.key} style={styles.form}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <Text style={styles.formValue}>{f.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <SectionTitle>例句</SectionTitle>
      {!online && <Loading />}
      {online?.status === 'unavailable' ? (
        <Text style={styles.muted}>試玩版只有離線字典。例句、英文解釋和發音要在安裝版才看得到。</Text>
      ) : (
        online && <Examples word={word} online={online} />
      )}

      {online?.status === 'ok' && online.english.length > 0 && (
        <>
          <SectionTitle>英文解釋</SectionTitle>
          {online.english.map((s) => (
            <View key={s.pos} style={{ marginBottom: 10 }}>
              <Text style={styles.enPos}>
                {s.pos}
                {s.posZh !== s.pos ? ` · ${s.posZh}` : ''}
              </Text>
              {s.definitions.map((d, i) => (
                <Text key={i} style={styles.def}>
                  {i + 1}. {d.text}
                </Text>
              ))}
              {s.synonyms.length > 0 && (
                <Text style={styles.syn}>
                  同義詞：{' '}
                  {s.synonyms.map((x, i) => (
                    <Text key={x}>
                      {i > 0 ? ', ' : ''}
                      <Text style={styles.link} onPress={() => onOpenWord(x)}>
                        {x}
                      </Text>
                    </Text>
                  ))}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
      {online?.status === 'error' && (
        <Text style={styles.muted}>
          <Icon name="wifiOff" size={14} color={C.textMuted} /> 英文解釋和發音暫時載入失敗（可能是網路不穩），等一下再打開試試。
        </Text>
      )}

      <Text style={styles.credit}>資料來源:ECDICT · Free Dictionary API (Wiktionary) · Tatoeba (CC BY 2.0 FR)</Text>
    </View>
  );
}

function Examples({ word, online }: { word: string; online: OnlineInfo }) {
  const fromDefs = online.english
    .flatMap((s) => s.definitions)
    .map((d) => d.example)
    .filter((x): x is string => !!x)
    .slice(0, 2)
    .map((en) => ({ en, zh: undefined as string | undefined }));
  const list = [...online.examples, ...fromDefs].slice(0, 4);
  if (list.length === 0) return <Text style={styles.muted}>暫時找不到例句。</Text>;
  return (
    <View style={{ gap: 10 }}>
      {list.map((ex, i) => (
        <View key={i} style={styles.example}>
          <Highlight text={ex.en} word={word} />
          {ex.zh && <Text style={styles.exampleZh}>{ex.zh}</Text>}
        </View>
      ))}
    </View>
  );
}

function Highlight({ text, word }: { text: string; word: string }) {
  const parts = text.split(new RegExp(`(\\b${word}\\w*)`, 'i'));
  return (
    <Text style={styles.exampleEn}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.hl}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

function WordLink({ w, onPress }: { w: string; onPress: (w: string) => void }) {
  return (
    <Text style={[styles.bold, styles.link]} onPress={() => onPress(w)}>
      {w}
    </Text>
  );
}

function SpeakButton({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="播放發音"
      onPress={() => {
        player.seekTo(0);
        player.play();
      }}
      hitSlop={8}
      style={styles.speak}>
      <Icon name="speaker" size={18} color={C.primary} />
    </Pressable>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={C.primary} />
      <Text style={styles.muted}>載入例句與英文解釋…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  word: { fontSize: 34, fontWeight: '800', color: C.text, letterSpacing: 0.5 },
  phoneticRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26 },
  phonetic: { fontSize: 16, color: C.textMuted },
  speak: { padding: 4, borderRadius: 14, backgroundColor: C.primarySoft },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 6,
  },
  saveBtnOn: { backgroundColor: C.primary },
  saveText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  meaning: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  pos: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
    backgroundColor: C.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    minWidth: 44,
    textAlign: 'center',
    marginTop: 2,
  },
  meaningText: { flex: 1, fontSize: 16, color: C.text, lineHeight: 23 },
  card: { backgroundColor: C.surface, borderRadius: radius.md, padding: 12 },
  cardText: { fontSize: 15, color: C.text, lineHeight: 22 },
  bold: { fontWeight: '800' },
  link: { color: C.primary, textDecorationLine: 'underline' },
  forms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  form: { backgroundColor: C.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  formLabel: { fontSize: 11, color: C.textMuted, fontWeight: '700' },
  formValue: { fontSize: 15, color: C.text, fontWeight: '600' },
  example: { borderLeftWidth: 3, borderLeftColor: C.primaryLight, paddingLeft: 10 },
  exampleEn: { fontSize: 15, color: C.text, lineHeight: 22 },
  exampleZh: { fontSize: 14, color: C.textMuted, marginTop: 2, lineHeight: 20 },
  hl: { color: C.primary, fontWeight: '800' },
  enPos: { fontSize: 14, fontWeight: '800', color: C.primaryDark, marginBottom: 4, fontStyle: 'italic' },
  def: { fontSize: 14, color: C.text, lineHeight: 21, marginBottom: 3 },
  syn: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  muted: { fontSize: 14, color: C.textMuted, lineHeight: 20 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  credit: { fontSize: 11, color: C.textFaint, marginTop: 20, textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4 },
  backText: { color: C.primary, fontWeight: '700', fontSize: 13 },
});
