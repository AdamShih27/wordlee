import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LetterState } from '@wordlee/shared';
import { Icon } from '@/components/Icon';
import { C, stateColor } from '@/lib/theme';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Props {
  onKey: (key: string) => void;
  keyStates: Record<string, LetterState>;
  disabled?: boolean;
  keyHeight?: number;
}

export function Keyboard({ onKey, keyStates, disabled, keyHeight = 54 }: Props) {
  const press = (key: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onKey(key);
  };

  return (
    <View style={[styles.keyboard, disabled && { opacity: 0.6 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      {ROWS.map((row, i) => (
        <View key={row} style={styles.row}>
          {i === 1 && <View style={{ flex: 0.5 }} />}
          {i === 2 && <Key label="送出" wide height={keyHeight} onPress={() => press('enter')} testID="key-enter" />}
          {row.split('').map((ch) => (
            <Key key={ch} label={ch.toUpperCase()} state={keyStates[ch]} height={keyHeight} onPress={() => press(ch)} testID={`key-${ch}`} />
          ))}
          {i === 2 && (
            <Key wide height={keyHeight} onPress={() => press('back')} testID="key-back" accessibilityLabel="刪除">
              <Icon name="backspace" size={22} color={C.text} />
            </Key>
          )}
          {i === 1 && <View style={{ flex: 0.5 }} />}
        </View>
      ))}
    </View>
  );
}

function Key({
  label,
  state,
  wide,
  height,
  onPress,
  children,
  testID,
  accessibilityLabel,
}: {
  label?: string;
  state?: LetterState;
  wide?: boolean;
  height: number;
  onPress: () => void;
  children?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const bg = state ? stateColor[state] : C.keyIdle;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.key, { flex: wide ? 1.5 : 1, height, backgroundColor: bg }, pressed && { opacity: 0.7 }]}>
      {children ?? (
        <Text style={[styles.label, wide && styles.wideLabel, { color: state ? C.white : C.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keyboard: { width: '100%', maxWidth: 500, gap: 7, paddingHorizontal: 6, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 5 },
  key: { borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17, fontWeight: '700' },
  wideLabel: { fontSize: 14 },
});
