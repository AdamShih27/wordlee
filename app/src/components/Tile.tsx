import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import type { LetterState } from '@wordlee/shared';
import { C, stateColor } from '@/lib/theme';

const native = Platform.OS !== 'web';

interface Props {
  letter?: string;
  state?: LetterState;
  size: number;
  /** 這格要播翻牌動畫 */
  reveal?: boolean;
  delay?: number;
  flipMs?: number;
}

export function Tile({ letter, state, size, reveal = false, delay = 0, flipMs = 300 }: Props) {
  const [flip] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  // 翻牌動畫播完的那一格（用「字母+狀態」當 key);不需要動畫的格子直接顯示顏色
  const key = `${letter}-${state}`;
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const shown = state && (!reveal || revealedKey === key) ? state : undefined;

  // 打字時輕輕放大一下
  useEffect(() => {
    if (!letter || state) return;
    pop.setValue(1.1);
    Animated.timing(pop, { toValue: 1, duration: 100, useNativeDriver: native }).start();
  }, [letter, state, pop]);

  // 翻牌:先壓扁 → 換顏色 → 展開
  useEffect(() => {
    if (!state || !reveal) return;
    let cancelled = false;
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(flip, { toValue: 1, duration: flipMs / 2, useNativeDriver: native }),
    ]).start(() => {
      if (cancelled) return;
      setRevealedKey(key);
      Animated.timing(flip, { toValue: 0, duration: flipMs / 2, useNativeDriver: native }).start();
    });
    return () => {
      cancelled = true;
      flip.setValue(0);
    };
  }, [state, reveal, delay, flipMs, flip, key]);

  const scaleY = flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const filled = !!letter;
  const bg = shown ? stateColor[shown] : C.bg;
  const border = shown ? stateColor[shown] : filled ? C.borderStrong : C.border;

  return (
    <Animated.View
      accessibilityLabel={letter ? `${letter} ${shown ? labels[shown] : ''}` : '空格'}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderColor: border,
          transform: [{ scaleY }, { scale: pop }],
        },
      ]}>
      <Text style={[styles.letter, { fontSize: size * 0.52, color: shown ? C.white : C.text }]}>
        {letter?.toUpperCase() ?? ''}
      </Text>
    </Animated.View>
  );
}

const labels: Record<LetterState, string> = { correct: '位置正確', present: '位置錯誤', absent: '沒有這個字母' };

const styles = StyleSheet.create({
  tile: {
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '800',
    includeFontPadding: false,
  },
});
