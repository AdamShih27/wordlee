import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { C } from '@/lib/theme';

/** 試玩版沒有對戰伺服器時顯示的說明。 */
export function DemoNotice({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Icon name={icon} size={34} color={C.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  text: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21 },
});
