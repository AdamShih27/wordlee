import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { C, radius } from '@/lib/theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
  testID,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  small?: boolean;
}) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.75 },
        style,
      ]}>
      {icon && <Icon name={icon} size={small ? 16 : 19} color={v.fg} />}
      <Text style={[styles.btnText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

const variants = {
  primary: { bg: C.primary, fg: C.white, border: C.primary },
  secondary: { bg: C.primarySoft, fg: C.primary, border: C.primaryLight },
  ghost: { bg: 'transparent', fg: C.primary, border: 'transparent' },
  danger: { bg: '#FEF2F2', fg: C.danger, border: '#FECACA' },
};

export function IconButton({
  name,
  onPress,
  label,
  color = C.text,
  size = 24,
  testID,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

/** 從下方滑出的面板（字典、統計、說明都用這個）。 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  headerRight,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="關閉" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} testID={testID}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.sheetHeaderRight}>
              {headerRight}
              <IconButton name="close" label="關閉" onPress={onClose} testID="sheet-close" />
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            testID={`seg-${o.value}`}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && styles.segActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, color = C.primary, bg = C.primarySoft }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  btnSmall: { paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
  iconBtn: { padding: 6, borderRadius: 20 },
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: C.text },
  sheetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  seg: {
    flexDirection: 'row',
    backgroundColor: C.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
    alignSelf: 'center',
  },
  segItem: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  segActive: {
    backgroundColor: C.bg,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  segTextActive: { color: C.primary },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '800', color: C.textMuted, marginTop: 18, marginBottom: 8, letterSpacing: 0.5 },
});
