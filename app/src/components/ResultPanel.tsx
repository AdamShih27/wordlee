import { StyleSheet, Text, View } from 'react-native';
import { Tile } from '@/components/Tile';
import { Button } from '@/components/ui';
import { useVocab } from '@/lib/vocab';
import { C, radius } from '@/lib/theme';

/** 一局結束後取代鍵盤的區塊:公布答案、查字典、收藏、分享。 */
export function ResultPanel({
  answer,
  won,
  guesses,
  onLookup,
  onShare,
  onNewGame,
  onShowStats,
  extra,
  headline,
  onPractice,
  tip = '點每一行右邊的書本圖示，可以查你猜過的字並收藏到單字卡',
}: {
  headline?: string;
  /** 用這個字造句（AI 批改） */
  onPractice?: (w: string) => void;
  /** 面板最下面的小提示，傳 null 不顯示 */
  tip?: string | null;
  answer: string;
  won: boolean;
  guesses: number;
  onLookup: (w: string) => void;
  onShare?: () => void;
  onNewGame?: () => void;
  onShowStats?: () => void;
  extra?: React.ReactNode;
}) {
  const vocab = useVocab();
  const saved = vocab.has(answer);
  return (
    <View style={styles.card} testID="result-panel">
      <Text style={styles.headline}>{headline ?? (won ? `答對了！用了 ${guesses} 次` : '這次沒猜到')}</Text>
      <View style={styles.answerRow}>
        {answer.split('').map((ch, i) => (
          <Tile key={i} letter={ch} state="correct" size={answer.length > 5 ? 34 : 40} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button small title="查字典" icon="book" variant="secondary" onPress={() => onLookup(answer)} testID="lookup-answer" />
        <Button
          small
          title={saved ? '已收藏' : '收藏'}
          icon={saved ? 'bookmarked' : 'bookmark'}
          variant="secondary"
          onPress={() => vocab.toggle(answer)}
          testID="save-answer"
        />
        {onPractice && (
          <Button small title="造句" icon="edit" variant="secondary" onPress={() => onPractice(answer)} testID="practice-answer" />
        )}
        {onShare && <Button small title="分享" icon="share" variant="secondary" onPress={onShare} />}
      </View>
      {extra}
      <View style={styles.actions}>
        {onShowStats && <Button title="看統計" icon="stats" onPress={onShowStats} style={{ flex: 1 }} />}
        {onNewGame && <Button title="再玩一局" icon="refresh" onPress={onNewGame} style={{ flex: 1 }} testID="new-game" />}
      </View>
      {tip && <Text style={styles.tip}>{tip}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.primarySoft,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.primaryLight,
    marginHorizontal: 4,
  },
  headline: { fontSize: 17, fontWeight: '800', color: C.primaryDark, textAlign: 'center' },
  answerRow: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  tip: { fontSize: 12, color: C.textMuted, textAlign: 'center' },
});
