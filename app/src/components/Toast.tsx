import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '@/lib/theme';

/** 畫面上方的小提示，例如「不在字庫中」。 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback((msg: string, ms = 1600) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), ms);
  }, []);

  const element = message ? (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.toast} testID="toast">
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  ) : null;

  return { show, element };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  toast: {
    backgroundColor: C.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    maxWidth: 320,
  },
  text: { color: C.white, fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
