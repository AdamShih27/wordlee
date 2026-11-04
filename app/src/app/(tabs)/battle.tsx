import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_GUESSES, WORD_LENGTH, type GameEnd, type LetterState, type PlayerProgress } from '@wordlee/shared';
import { Board } from '@/components/Board';
import { useDictionary } from '@/components/DictionarySheet';
import { Icon } from '@/components/Icon';
import { Keyboard } from '@/components/Keyboard';
import { Tile } from '@/components/Tile';
import { useToast } from '@/components/Toast';
import { Button, Chip, SectionTitle } from '@/components/ui';
import { useBattle, type RoundInfo } from '@/lib/battle';
import { SERVER_URL } from '@/lib/config';
import { useProfile } from '@/lib/profile';
import { useGuessGame } from '@/lib/useGuessGame';
import { usePhysicalKeyboard } from '@/lib/usePhysicalKeyboard';
import { useVocab } from '@/lib/vocab';
import { C, MAX_WIDTH, radius, stateColor } from '@/lib/theme';

type Battle = ReturnType<typeof useBattle>;

export default function BattleScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const battle = useBattle(profile.playerId, profile.name, profile.ready);
  const toast = useToast();
  const { room, round, end } = battle;

  const inGame = room && (room.status === 'countdown' || room.status === 'playing') && round;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {toast.element}
      <View style={styles.header}>
        <Text style={styles.title}>連線對戰</Text>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: battle.connected ? C.correct : C.danger }]} />
          <Text style={styles.statusText}>{battle.connected ? '已連線' : '未連線'}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {!battle.connected ? (
          <Offline battle={battle} />
        ) : inGame ? (
          <Match battle={battle} round={round} myId={profile.playerId} toast={toast.show} />
        ) : room ? (
          <Lobby battle={battle} myId={profile.playerId} toast={toast.show} end={end} />
        ) : battle.queueing ? (
          <Queue battle={battle} />
        ) : (
          <Home key={profile.name} battle={battle} toast={toast.show} />
        )}
      </View>
    </View>
  );
}

function Offline({ battle }: { battle: Battle }) {
  return (
    <View style={styles.center}>
      {battle.error ? (
        <>
          <Icon name="wifiOff" size={40} color={C.textMuted} />
          <Text style={styles.centerTitle}>暫時連不到對戰伺服器</Text>
          <Text style={styles.muted}>
            伺服器位址：{SERVER_URL}
            {'\n'}開發時請先在電腦上執行 npm run server
          </Text>
          <Button title="重新連線" icon="refresh" onPress={battle.retry} />
        </>
      ) : (
        <>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.muted}>連線中…</Text>
        </>
      )}
    </View>
  );
}

function Home({ battle, toast }: { battle: Battle; toast: (m: string) => void }) {
  const profile = useProfile();
  const [name, setName] = useState(profile.name);
  const [code, setCode] = useState('');

  const join = async () => {
    const r = await battle.joinRoom(code.trim().toUpperCase());
    if (!r.ok) toast(r.error);
  };

  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.label}>你的暱稱</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            onBlur={() => profile.setName(name)}
            onSubmitEditing={() => profile.setName(name)}
            maxLength={16}
            style={styles.input}
            placeholder="輸入暱稱"
            placeholderTextColor={C.textFaint}
            testID="name-input"
          />
          {name !== profile.name && <Button small title="儲存" onPress={() => profile.setName(name)} />}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>同一題，看誰解得快</Text>
        <Text style={styles.muted}>所有人猜同一個字。你看得到對手的顏色進度，但看不到他猜了哪些字母。最快解出來的拿最多分。</Text>
        <Button title="快速配對" icon="battle" onPress={() => battle.quickMatch()} testID="quick-match" />
        <Button
          title="建立房間"
          icon="group"
          variant="secondary"
          testID="create-room"
          onPress={async () => {
            const r = await battle.createRoom();
            if (!r.ok) toast(r.error);
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>用房號加入朋友的房間</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
            onSubmitEditing={join}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, styles.codeInput]}
            placeholder="ABCD"
            placeholderTextColor={C.textFaint}
            testID="room-code-input"
          />
          <Button title="加入" onPress={join} disabled={code.length !== 4} testID="join-room" />
        </View>
      </View>
    </ScrollView>
  );
}

function Queue({ battle }: { battle: Battle }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={C.primary} size="large" />
      <Text style={styles.centerTitle}>正在尋找對手…</Text>
      <Text style={styles.muted}>找到人就會自動開始</Text>
      <Button title="取消" variant="secondary" onPress={battle.cancelQueue} />
    </View>
  );
}

function Lobby({
  battle,
  myId,
  toast,
  end,
}: {
  battle: Battle;
  myId: string;
  toast: (m: string) => void;
  end: GameEnd | null;
}) {
  const room = battle.room!;
  const isHost = room.hostId === myId;
  const online = room.players.filter((p) => p.connected).length;

  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
      {end && <Results end={end} myId={myId} />}

      <View style={styles.card}>
        <View style={styles.roomHead}>
          <View>
            <Text style={styles.label}>房號</Text>
            <Text style={styles.roomCode} testID="room-code">
              {room.code}
            </Text>
          </View>
          <Button
            small
            title="複製"
            icon="copy"
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(room.code);
              toast('已複製房號');
            }}
          />
        </View>
        <Text style={styles.muted}>把房號給朋友，在「用房號加入」輸入就能進來。</Text>

        <SectionTitle>玩家 ({room.players.length})</SectionTitle>
        {room.players.map((p) => (
          <View key={p.id} style={styles.player}>
            <View style={[styles.dot, { backgroundColor: p.connected ? C.correct : C.textFaint }]} />
            <Text style={styles.playerName}>
              {p.name}
              {p.id === myId ? '（你）' : ''}
            </Text>
            {p.isHost && <Chip label="房主" />}
          </View>
        ))}
      </View>

      {isHost ? (
        <Button
          title={end ? '再來一局' : '開始對戰'}
          icon="battle"
          onPress={async () => {
            const r = await battle.start();
            if (!r.ok) toast(r.error);
          }}
          disabled={online < 2}
          testID="start-game"
        />
      ) : (
        <Text style={[styles.muted, { textAlign: 'center' }]}>等待房主開始…</Text>
      )}
      {isHost && online < 2 && <Text style={[styles.muted, { textAlign: 'center' }]}>至少要 2 個人才能開始</Text>}
      <Button title="離開房間" variant="ghost" onPress={battle.leave} testID="leave-room" />
    </ScrollView>
  );
}

function fmtTime(ms: number | null) {
  if (ms == null) return '—';
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} 秒` : `${Math.floor(s / 60)} 分 ${Math.round(s % 60)} 秒`;
}

function Results({ end, myId }: { end: GameEnd; myId: string }) {
  const dictionary = useDictionary();
  const vocab = useVocab();
  const me = end.results.find((r) => r.playerId === myId);
  const iWon = me?.solved && me.rank === 1;
  return (
    <View style={[styles.card, { backgroundColor: C.primarySoft, borderColor: C.primaryLight }]} testID="battle-results">
      <Text style={styles.resultTitle}>{iWon ? '你贏了！' : me?.solved ? `第 ${me.rank} 名` : '這局沒解出來'}</Text>
      {end.reason === 'time-up' && <Text style={[styles.muted, { textAlign: 'center' }]}>時間到</Text>}
      <View style={styles.answerRow}>
        {end.answer.split('').map((ch, i) => (
          <Tile key={i} letter={ch} state="correct" size={36} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        <Button small title="查字典" icon="book" variant="secondary" onPress={() => dictionary.open(end.answer)} />
        <Button
          small
          title={vocab.has(end.answer) ? '已收藏' : '收藏'}
          icon={vocab.has(end.answer) ? 'bookmarked' : 'bookmark'}
          variant="secondary"
          onPress={() => vocab.toggle(end.answer)}
        />
      </View>

      <View style={{ gap: 6, marginTop: 6 }}>
        {end.results.map((r) => (
          <View key={r.playerId} style={[styles.resultRow, r.playerId === myId && styles.resultMe]}>
            <Text style={styles.rank}>{r.solved ? r.rank : '—'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName} numberOfLines={1}>
                {r.name}
                {r.playerId === myId ? '（你）' : ''}
              </Text>
              <Text style={styles.small}>
                {r.solved ? `${r.guesses} 次 · ${fmtTime(r.timeMs)}` : `沒解出 · 猜了 ${r.guesses} 次`}
              </Text>
            </View>
            <Text style={styles.points}>+{r.points}</Text>
          </View>
        ))}
      </View>

      {me && me.words.length > 0 && (
        <>
          <Text style={[styles.label, { marginTop: 8 }]}>你這局猜過的字（點一下查字典）</Text>
          <View style={styles.wordChips}>
            {me.words.map((w, i) => (
              <Text key={i} style={styles.wordChip} onPress={() => dictionary.open(w)}>
                {w}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Match({
  battle,
  round,
  myId,
  toast,
}: {
  battle: Battle;
  round: RoundInfo;
  myId: string;
  toast: (m: string) => void;
}) {
  const room = battle.room!;
  const now = useNow(true);
  const countdown = Math.ceil((round.startAt - now) / 1000);
  const remaining = Math.min(round.timeLimitMs, Math.max(0, round.startAt + round.timeLimitMs - now));
  const opponents = room.players.filter((p) => p.id !== myId);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.matchBar}>
        <View style={styles.timer}>
          <Icon name="timer" size={18} color={remaining < 30_000 ? C.danger : C.primary} />
          <Text style={[styles.timerText, remaining < 30_000 && { color: C.danger }]}>
            {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
          </Text>
        </View>
        <Text style={styles.small}>房號 {room.code}</Text>
      </View>

      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={styles.opponents} showsHorizontalScrollIndicator={false}>
        {opponents.map((p) => (
          <Opponent key={p.id} name={p.name} connected={p.connected} progress={battle.progress[p.id]} />
        ))}
      </ScrollView>

      <MyBoard key={round.round} battle={battle} myId={myId} toast={toast} locked={countdown > 0} />

      {countdown > 0 && (
        <View style={styles.countdown} pointerEvents="none">
          <Text style={styles.countdownN} testID="countdown">
            {countdown}
          </Text>
          <Text style={styles.countdownText}>準備開始</Text>
        </View>
      )}
    </View>
  );
}

function MyBoard({
  battle,
  myId,
  toast,
  locked,
}: {
  battle: Battle;
  myId: string;
  toast: (m: string) => void;
  locked: boolean;
}) {
  const dictionary = useDictionary();
  const { height } = useWindowDimensions();
  const game = useGuessGame({
    evaluate: (word) => battle.guess(word),
    revealMs: 900, // 對戰動畫短一點
    onError: toast,
    onRevealed: (rows, status) => {
      if (status === 'won') toast(`解出來了！用了 ${rows.length} 次`);
      if (status === 'lost') toast('6 次都用完了');
    },
  });

  // 斷線重連（或重開 App)後，用 Server 給的紀錄還原自己的盤面
  const mine = battle.progress[myId];
  useEffect(() => {
    if (mine?.words && mine.words.length > game.rows.length && game.revealingRow === null) {
      game.reset(mine.words.map((w, i) => ({ word: w, states: mine.rows[i] })));
    }
  }, [mine, game]);

  const onKey = (k: string) => {
    if (!locked) game.onKey(k);
  };
  usePhysicalKeyboard(onKey, game.status === 'playing');
  const done = game.status !== 'playing' && game.revealingRow === null;

  return (
    <View style={{ flex: 1 }}>
      <Board
        rows={game.rows}
        current={game.current}
        revealingRow={game.revealingRow}
        shake={game.shake}
        revealMs={900}
        onLookup={dictionary.open}
        maxTile={54}
      />
      <View style={{ paddingBottom: 10, paddingTop: 6 }}>
        {done ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Icon name={game.status === 'won' ? 'check' : 'timer'} size={28} color={game.status === 'won' ? C.correct : C.textMuted} />
            <Text style={styles.cardTitle}>{game.status === 'won' ? '你完成了！' : '這局猜完了'}</Text>
            <Text style={styles.muted}>等其他玩家完成或時間到，就會公布答案和名次</Text>
          </View>
        ) : (
          <Keyboard onKey={onKey} keyStates={game.keyStates} disabled={locked} keyHeight={height < 700 ? 44 : 52} />
        )}
      </View>
    </View>
  );
}

function Opponent({ name, connected, progress }: { name: string; connected: boolean; progress?: PlayerProgress }) {
  const rows = progress?.rows ?? [];
  return (
    <View style={[styles.opp, progress?.solved && { borderColor: C.correct }]}>
      <Text style={styles.oppName} numberOfLines={1}>
        {name}
        {!connected ? '（斷線）' : ''}
      </Text>
      <View style={{ gap: 2 }}>
        {Array.from({ length: MAX_GUESSES }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 2 }}>
            {Array.from({ length: WORD_LENGTH }, (_, c) => {
              const s: LetterState | undefined = rows[r]?.[c];
              return <View key={c} style={[styles.mini, { backgroundColor: s ? stateColor[s] : C.surfaceAlt }]} />;
            })}
          </View>
        ))}
      </View>
      <Text style={[styles.small, { textAlign: 'center' }]}>
        {progress?.solved ? `✓ ${fmtTime(progress.timeMs ?? null)}` : progress?.finished ? '沒解出' : `${rows.length}/${MAX_GUESSES}`}
      </Text>
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
    paddingBottom: 6,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: C.text },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 13, color: C.textMuted, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  body: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  centerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  muted: { fontSize: 14, color: C.textMuted, lineHeight: 20 },
  small: { fontSize: 12, color: C.textMuted },
  card: {
    backgroundColor: C.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  label: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: C.text,
    backgroundColor: C.surface,
  },
  codeInput: { letterSpacing: 6, fontWeight: '800', fontSize: 20, textAlign: 'center' },
  roomHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomCode: { fontSize: 38, fontWeight: '900', color: C.primary, letterSpacing: 6 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  playerName: { fontSize: 15, fontWeight: '700', color: C.text, flexShrink: 1 },
  resultTitle: { fontSize: 22, fontWeight: '900', color: C.primaryDark, textAlign: 'center' },
  answerRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: radius.md,
    padding: 10,
  },
  resultMe: { borderWidth: 1.5, borderColor: C.primary },
  rank: { width: 22, fontSize: 18, fontWeight: '900', color: C.primary, textAlign: 'center' },
  points: { fontSize: 16, fontWeight: '900', color: C.correct },
  wordChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordChip: {
    backgroundColor: C.bg,
    color: C.primary,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  matchBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontSize: 18, fontWeight: '800', color: C.primary, fontVariant: ['tabular-nums'] },
  opponents: { gap: 8, paddingBottom: 6 },
  opp: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: radius.md,
    padding: 6,
    gap: 4,
    width: 84,
    alignItems: 'center',
  },
  oppName: { fontSize: 12, fontWeight: '800', color: C.text, maxWidth: 72 },
  mini: { width: 11, height: 11, borderRadius: 2 },
  countdown: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownN: { fontSize: 96, fontWeight: '900', color: C.primary },
  countdownText: { fontSize: 18, fontWeight: '700', color: C.textMuted },
});
