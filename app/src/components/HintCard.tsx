import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { maskWord } from '@wordlee/shared';
import { Icon } from '@/components/Icon';
import { fetchOnlineInfo, useOfflineInfo, type OnlineInfo } from '@/lib/dictionary';
import { C, radius } from '@/lib/theme';

/** 提示等級:0 還沒看、1 只看開頭、2 完整英文解釋 */
export type HintLevel = 0 | 1 | 2;

/** 第一段提示只給解釋的前半（最多 4 個字），不要一看就知道答案 */
function firstWords(text: string) {
  const words = text.split(/\s+/);
  const n = Math.max(2, Math.min(4, Math.ceil(words.length / 2)));
  return words.length > n ? `${words.slice(0, n).join(' ')} …` : text;
}

/**
 * Wordlee 的提示:按一次看詞性 + 英文解釋的開頭，再按一次看完整解釋。
 * 解釋裡出現答案或它的變化形會挖空。
 */
export function HintCard({
  answer,
  level,
  onChange,
}: {
  answer: string;
  level: HintLevel;
  onChange: (level: HintLevel) => void;
}) {
  const info = useOfflineInfo(answer);
  const [online, setOnline] = useState<OnlineInfo | null>(null);
  const offlineDef = info?.en[0];

  // 少數答案字沒有離線英文解釋，要用的時候才上網查
  useEffect(() => {
    if (level === 0 || offlineDef || !info?.ready) return;
    let alive = true;
    fetchOnlineInfo(answer).then((r) => alive && setOnline(r));
    return () => {
      alive = false;
    };
  }, [level, offlineDef, info?.ready, answer]);

  const onlineSense = online?.status === 'ok' ? online.english[0] : undefined;
  const def = offlineDef ?? (onlineSense ? { pos: onlineSense.pos, text: onlineSense.definitions[0]?.text ?? '' } : undefined);
  const forms = [...(info?.forms.map((f) => f.value) ?? [])];
  const text = def ? maskWord(def.text, answer, forms) : '';

  if (level === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="提示"
        testID="hint-button"
        onPress={() => onChange(1)}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}>
        <Icon name="hint" size={16} color={C.primary} />
        <Text style={styles.pillText}>提示</Text>
      </Pressable>
    );
  }

  const loading = !def && (!info?.ready || (!offlineDef && !online));
  return (
    <View style={styles.card} testID="hint-card">
      <Icon name="hint" size={16} color={C.present} />
      <View style={{ flex: 1 }}>
        {loading ? (
          <Text style={styles.muted}>載入提示…</Text>
        ) : def ? (
          <Text style={styles.text} testID="hint-text">
            <Text style={styles.pos}>{def.pos} </Text>
            {level === 1 ? firstWords(text) : text}
          </Text>
        ) : (
          <Text style={styles.muted}>這個字暫時沒有英文提示</Text>
        )}
      </View>
      {def && level === 1 && (
        <Pressable accessibilityRole="button" testID="hint-more" onPress={() => onChange(2)} hitSlop={8}>
          <Text style={styles.more}>多一點</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  pillText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  text: { fontSize: 14, color: C.text, lineHeight: 20 },
  pos: { color: C.primary, fontWeight: '800', fontStyle: 'italic' },
  more: { color: C.primary, fontWeight: '700', fontSize: 13, paddingTop: 1 },
  muted: { fontSize: 13, color: C.textMuted },
});
