import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  answerForDay,
  dailyIndex,
  evaluateGuess,
  hardModeError,
  isValidWord,
  isWordLength,
  LENGTHS,
  MAX_GUESSES,
  randomAnswer,
  toEmojiGrid,
  type WordLength,
} from '@wordlee/shared';
import { Board } from '@/components/Board';
import { useDictionary } from '@/components/DictionarySheet';
import { HelpSheet, SettingsSheet, StatsSheet } from '@/components/GameSheets';
import { Keyboard } from '@/components/Keyboard';
import { ResultPanel } from '@/components/ResultPanel';
import { useToast } from '@/components/Toast';
import { IconButton, Segmented } from '@/components/ui';
import { shareText } from '@/lib/share';
import { recordDaily } from '@/lib/stats';
import { KEYS, load, save } from '@/lib/storage';
import { useGuessGame, type GameStatus, type Row } from '@/lib/useGuessGame';
import { usePhysicalKeyboard } from '@/lib/usePhysicalKeyboard';
import { C, MAX_WIDTH } from '@/lib/theme';

type Mode = 'daily' | 'practice';

interface Settings {
  hardMode: boolean;
  /** 每日挑戰和練習模式的單字長度 */
  length: WordLength;
}

const DEFAULT_SETTINGS: Settings = { hardMode: false, length: 5 };

interface DailySave {
  rows: Row[];
  hardMode: boolean;
  /** 這份進度是哪個長度的（切換長度時避免顯示到上一個長度的盤面） */
  length?: WordLength;
}

const PRAISE = ['天才！', '太神了！', '很厲害！', '很棒！', '不錯喔！', '好險！'];

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('daily');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const length = settings.length;
  const [sheet, setSheet] = useState<'help' | 'stats' | 'settings' | null>(null);

  // 每日挑戰:依當地日期決定題目，進度存在手機裡
  const [day, setDay] = useState(() => dailyIndex());
  const [dailySave, setDailySave] = useState<DailySave | null>(null);
  const [practice, setPractice] = useState(() => ({ answer: randomAnswer(), id: 0 }));

  useEffect(() => {
    load<Partial<Settings>>(KEYS.settings, DEFAULT_SETTINGS).then((s) => {
      const next = { ...DEFAULT_SETTINGS, ...s };
      if (!isWordLength(next.length)) next.length = 5;
      setSettings(next);
      if (next.length !== 5) setPractice((p) => ({ answer: randomAnswer(Math.random, next.length), id: p.id + 1 }));
    });
    load<boolean>(KEYS.seenHelp, false).then((seen) => {
      if (!seen) {
        setSheet('help');
        save(KEYS.seenHelp, true);
      }
    });
  }, []);

  useEffect(() => {
    let alive = true;
    load<DailySave>(KEYS.daily(day, length), { rows: [], hardMode: false }).then((s) => alive && setDailySave({ ...s, length }));
    return () => {
      alive = false;
    };
  }, [day, length]);

  // 過了午夜自動換成新的一題
  useEffect(() => {
    const t = setInterval(() => {
      const d = dailyIndex();
      if (d !== day) setDay(d);
    }, 30_000);
    return () => clearInterval(t);
  }, [day]);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    save(KEYS.settings, s);
  };

  const changeLength = (n: WordLength) => {
    if (n === length) return;
    updateSettings({ ...settings, length: n });
    setPractice((p) => ({ answer: randomAnswer(Math.random, n), id: p.id + 1 }));
  };

  const lengthLabel = length === 5 ? '' : `（${length} 字母）`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <IconButton name="help" label="玩法說明" onPress={() => setSheet('help')} testID="open-help" />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Wordlee
        </Text>
        <View style={[styles.headerSide, { justifyContent: 'flex-end' }]}>
          <IconButton name="stats" label="統計" onPress={() => setSheet('stats')} testID="open-stats" />
          <IconButton name="settings" label="設定" onPress={() => setSheet('settings')} testID="open-settings" />
        </View>
      </View>

      <View style={styles.modeBar}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'daily', label: `每日挑戰 #${day + 1}` },
            { value: 'practice', label: '練習模式' },
          ]}
        />
        <View style={styles.lengths} accessibilityRole="radiogroup" accessibilityLabel="單字長度">
          {LENGTHS.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ selected: n === length }}
              testID={`length-${n}`}
              onPress={() => changeLength(n)}
              style={[styles.lengthChip, n === length && styles.lengthChipOn]}>
              <Text style={[styles.lengthText, n === length && styles.lengthTextOn]}>{n} 個字母</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'daily' && dailySave && dailySave.length === length && (
        <GamePanel
          key={`daily-${length}-${day}`}
          length={length}
          answer={answerForDay(day, length)}
          initialRows={dailySave.rows}
          hardMode={dailySave.rows.length ? dailySave.hardMode : settings.hardMode}
          shareTitle={`Wordlee 每日 #${day + 1}${lengthLabel}`}
          onRevealed={(rows, status) => {
            const hardMode = dailySave.rows.length ? dailySave.hardMode : settings.hardMode;
            save(KEYS.daily(day, length), { rows, hardMode });
            if (status !== 'playing') {
              recordDaily(day, status === 'won', rows.length, length).then(() => setTimeout(() => setSheet('stats'), 1200));
            }
          }}
          onShowStats={() => setSheet('stats')}
        />
      )}
      {mode === 'practice' && (
        <GamePanel
          key={`practice-${practice.id}`}
          length={practice.answer.length}
          answer={practice.answer}
          initialRows={[]}
          hardMode={settings.hardMode}
          shareTitle={`Wordlee 練習${lengthLabel}`}
          onNewGame={() => setPractice((p) => ({ answer: randomAnswer(Math.random, length), id: p.id + 1 }))}
        />
      )}

      <HelpSheet visible={sheet === 'help'} onClose={() => setSheet(null)} />
      <StatsSheet visible={sheet === 'stats'} onClose={() => setSheet(null)} day={day} length={length} />
      <SettingsSheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        hardMode={settings.hardMode}
        onChangeHardMode={(v) => updateSettings({ ...settings, hardMode: v })}
      />
    </View>
  );
}

function GamePanel({
  length,
  answer,
  initialRows,
  hardMode,
  shareTitle,
  onRevealed,
  onNewGame,
  onShowStats,
}: {
  length: number;
  answer: string;
  initialRows: Row[];
  hardMode: boolean;
  shareTitle: string;
  onRevealed?: (rows: Row[], status: GameStatus) => void;
  onNewGame?: () => void;
  onShowStats?: () => void;
}) {
  const toast = useToast();
  const dictionary = useDictionary();
  const { height } = useWindowDimensions();

  const game = useGuessGame({
    initialRows,
    length,
    evaluate: (word, rows) => {
      if (!isValidWord(word, length)) return { ok: false, error: '不在字庫中' };
      if (hardMode) {
        const err = hardModeError(word, rows);
        if (err) return { ok: false, error: err };
      }
      return { ok: true, states: evaluateGuess(word, answer) };
    },
    onError: (msg) => toast.show(msg),
    onRevealed: (rows, status) => {
      if (status === 'won') toast.show(PRAISE[rows.length - 1] ?? '答對了！');
      if (status === 'lost') toast.show(answer.toUpperCase(), 2500);
      onRevealed?.(rows, status);
    },
  });

  usePhysicalKeyboard(game.onKey, game.status === 'playing');

  const over = game.status !== 'playing' && game.revealingRow === null;
  const share = async () => {
    const score = game.status === 'won' ? game.rows.length : 'X';
    const text = `${shareTitle} ${score}/${MAX_GUESSES}${hardMode ? '*' : ''}\n\n${toEmojiGrid(game.rows.map((r) => r.states))}`;
    const res = await shareText(text);
    if (res === 'copied') toast.show('已複製到剪貼簿');
  };

  return (
    <View style={styles.panel}>
      {toast.element}
      <Board
        rows={game.rows}
        current={game.current}
        revealingRow={game.revealingRow}
        shake={game.shake}
        onLookup={dictionary.open}
        length={length}
      />
      <View style={styles.bottom}>
        {over ? (
          <ResultPanel
            answer={answer}
            won={game.status === 'won'}
            guesses={game.rows.length}
            onLookup={dictionary.open}
            onShare={share}
            onNewGame={onNewGame}
            onShowStats={onShowStats}
          />
        ) : (
          <Keyboard onKey={game.onKey} keyStates={game.keyStates} keyHeight={height < 700 ? 48 : 56} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerSide: { width: 90, flexDirection: 'row' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 1,
  },
  modeBar: { paddingTop: 10, paddingBottom: 4, gap: 8, alignItems: 'center' },
  lengths: { flexDirection: 'row', gap: 6 },
  lengthChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  lengthChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  lengthText: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  lengthTextOn: { color: C.white },
  panel: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 8 },
  bottom: { paddingBottom: 10, paddingTop: 6 },
});
