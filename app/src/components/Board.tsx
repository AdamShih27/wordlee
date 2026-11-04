import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { MAX_GUESSES, WORD_LENGTH } from '@wordlee/shared';
import { Icon } from '@/components/Icon';
import { Tile } from '@/components/Tile';
import type { Row } from '@/lib/useGuessGame';
import { C } from '@/lib/theme';

const GAP = 6;
const native = Platform.OS !== 'web';

interface Props {
  rows: Row[];
  current: string;
  revealingRow: number | null;
  shake: number;
  revealMs?: number;
  maxRows?: number;
  /** 點每一行旁邊的字典按鈕 */
  onLookup?: (word: string) => void;
  maxTile?: number;
  /** 單字長度(5–7) */
  length?: number;
}

export function Board({
  rows,
  current,
  revealingRow,
  shake,
  revealMs = 1500,
  maxRows = MAX_GUESSES,
  onLookup,
  maxTile = 62,
  length = WORD_LENGTH,
}: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const side = onLookup ? (length > 5 ? 36 : 40) : 0;
  const tile = Math.floor(
    Math.max(
      24,
      Math.min(maxTile, (box.w - side * 2 - GAP * (length - 1)) / length, (box.h - GAP * (maxRows - 1)) / maxRows),
    ),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const flipMs = Math.min(320, revealMs / 3);
  const stagger = (revealMs - flipMs) / (length - 1);
  const currentIndex = rows.length;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {box.w > 0 && (
        <View style={{ gap: GAP }}>
          {Array.from({ length: maxRows }, (_, r) => {
            const row = rows[r];
            const isCurrent = r === currentIndex;
            const letters = row ? row.word : isCurrent ? current : '';
            const done = !!row && revealingRow !== r;
            return (
              <ShakeRow key={r} shake={isCurrent ? shake : 0}>
                <View style={{ width: side }} />
                {Array.from({ length }, (_, c) => (
                  <Tile
                    key={c}
                    size={tile}
                    letter={letters[c]}
                    state={row?.states[c]}
                    reveal={revealingRow === r}
                    delay={c * stagger}
                    flipMs={flipMs}
                  />
                ))}
                <View style={[styles.side, { width: side }]}>
                  {onLookup && done && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`查 ${row.word} 的意思`}
                      testID={`lookup-${row.word}`}
                      onPress={() => onLookup(row.word)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.lookup, pressed && { opacity: 0.6 }]}>
                      <Icon name="book" size={17} color={C.primary} />
                    </Pressable>
                  )}
                </View>
              </ShakeRow>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ShakeRow({ shake, children }: { shake: number; children: React.ReactNode }) {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!shake) return;
    const step = (to: number) => Animated.timing(x, { toValue: to, duration: 50, useNativeDriver: native });
    Animated.sequence([step(-8), step(8), step(-6), step(6), step(-3), step(0)]).start();
  }, [shake, x]);
  return <Animated.View style={[styles.row, { transform: [{ translateX: x }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
  side: { alignItems: 'center', justifyContent: 'center' },
  lookup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
