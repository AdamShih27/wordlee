import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
import { HintCard, type HintLevel } from '@/components/HintCard';
import { useDictionary } from '@/components/DictionarySheet';
import { HelpSheet, SettingsSheet, StatsSheet } from '@/components/GameSheets';
import { Keyboard } from '@/components/Keyboard';
import { ResultPanel } from '@/components/ResultPanel';
import { useToast } from '@/components/Toast';
import { IconButton } from '@/components/ui';
import { IS_DEMO } from '@/lib/config';
import { shareText } from '@/lib/share';
import { recordGame } from '@/lib/stats';
import { KEYS, load, save } from '@/lib/storage';
import { useGuessGame, type GameStatus, type Row } from '@/lib/useGuessGame';
import { usePhysicalKeyboard } from '@/lib/usePhysicalKeyboard';
import { C, MAX_WIDTH } from '@/lib/theme';

interface Settings {
  hardMode: boolean;
  /** 單字長度 */
  length: WordLength;
}

const DEFAULT_SETTINGS: Settings = { hardMode: false, length: 5 };

/** 還沒玩完的那一局 */
interface CurrentGame {
  id: number;
  length: WordLength;
  answer: string;
  rows: Row[];
  /** 這局開始時的困難模式設定（中途改設定，下一局才生效） */
  hardMode: boolean;
  /** 這局看了幾段提示 */
  hint?: HintLevel;
}

const PRAISE = ['天才！', '太神了！', '很厲害！', '很棒！', '不錯喔！', '好險！'];

let nextId = 1;
const newGame = (length: WordLength, hardMode: boolean): CurrentGame => ({
  id: nextId++,
  length,
  answer: randomAnswer(Math.random, length),
  rows: [],
  hardMode,
});

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const length = settings.length;
  const [sheet, setSheet] = useState<'help' | 'stats' | 'settings' | null>(null);
  const [game, setGame] = useState<CurrentGame | null>(null);

  // 讀設定;有沒玩完的局就接著玩
  useEffect(() => {
    load<Partial<Settings>>(KEYS.settings, DEFAULT_SETTINGS).then(async (s) => {
      const next = { ...DEFAULT_SETTINGS, ...s };
      if (!isWordLength(next.length)) next.length = 5;
      setSettings(next);
      setGame(await resumeOrNew(next.length, next.hardMode));
    });
    load<boolean>(KEYS.seenHelp, false).then((seen) => {
      if (!seen) {
        setSheet('help');
        save(KEYS.seenHelp, true);
      }
    });
  }, []);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    save(KEYS.settings, s);
  };

  const changeLength = async (n: WordLength) => {
    if (n === length) return;
    updateSettings({ ...settings, length: n });
    setGame(await resumeOrNew(n, settings.hardMode));
  };

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

      {game && game.length === length && (
        <GamePanel
          key={game.id}
          length={game.length}
          answer={game.answer}
          initialRows={game.rows}
          hardMode={game.hardMode}
          hintLevel={game.hint ?? 0}
          onHintChange={(hint, rows) => {
            const next = { ...game, hint };
            setGame(next);
            save(KEYS.current(game.length), { ...next, rows });
          }}
          shareTitle={`Wordlee ${game.length} 字母`}
          onRevealed={(rows, status) => {
            if (status === 'playing') {
              save(KEYS.current(game.length), { ...game, rows });
            } else {
              save(KEYS.current(game.length), null);
              recordGame(status === 'won', rows.length, game.length);
            }
          }}
          onNewGame={() => setGame(newGame(length, settings.hardMode))}
          onShowStats={() => setSheet('stats')}
        />
      )}

      <HelpSheet visible={sheet === 'help'} onClose={() => setSheet(null)} />
      <StatsSheet visible={sheet === 'stats'} onClose={() => setSheet(null)} length={length} />
      <SettingsSheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        hardMode={settings.hardMode}
        onChangeHardMode={(v) => updateSettings({ ...settings, hardMode: v })}
      />
    </View>
  );
}

/** 這個長度有沒玩完的局就接著玩，沒有就開新的一局。 */
async function resumeOrNew(length: WordLength, hardMode: boolean): Promise<CurrentGame> {
  const saved = await load<CurrentGame | null>(KEYS.current(length), null);
  if (saved && saved.answer?.length === length && Array.isArray(saved.rows) && saved.rows.length < MAX_GUESSES) {
    return { ...saved, id: nextId++ };
  }
  return newGame(length, hardMode);
}

function GamePanel({
  length,
  answer,
  initialRows,
  hardMode,
  hintLevel,
  onHintChange,
  shareTitle,
  onRevealed,
  onNewGame,
  onShowStats,
}: {
  length: number;
  answer: string;
  initialRows: Row[];
  hardMode: boolean;
  hintLevel: HintLevel;
  onHintChange: (level: HintLevel, rows: Row[]) => void;
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
    const text = `${shareTitle} ${score}/${MAX_GUESSES}${hardMode ? '*' : ''}${hintLevel ? ' 💡' : ''}\n\n${toEmojiGrid(game.rows.map((r) => r.states))}`;
    const res = await shareText(text);
    if (res === 'copied') toast.show('已複製到剪貼簿');
  };

  return (
    <View style={styles.panel}>
      {toast.element}
      {!over && (
        <View style={styles.hintRow}>
          <HintCard answer={answer} level={hintLevel} onChange={(l) => onHintChange(l, game.rows)} />
        </View>
      )}
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
            onPractice={IS_DEMO ? undefined : dictionary.practice}
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
  modeBar: { paddingTop: 12, paddingBottom: 4, alignItems: 'center' },
  lengths: { flexDirection: 'row', gap: 6 },
  lengthChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  lengthChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  lengthText: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  lengthTextOn: { color: C.white },
  panel: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 8 },
  bottom: { paddingBottom: 10, paddingTop: 6 },
  hintRow: { paddingTop: 8 },
});
