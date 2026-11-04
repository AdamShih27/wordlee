import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ONLINE_ENABLED } from '@/lib/config';
import { C } from '@/lib/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textFaint,
        // 中文標籤比英文高，預設高度會切到字，所以自己算高度（含 iPhone 底部安全區）
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
          height: 60 + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11, lineHeight: 15 },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: '遊戲', tabBarIcon: ({ color }) => <Icon name="game" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="hangman"
        options={{ title: 'Hangman', tabBarIcon: ({ color }) => <Icon name="spell" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="battle"
        options={{
          title: '對戰',
          // 對戰和排行榜需要伺服器，先從分頁列隱藏（程式都還在）
          href: ONLINE_ENABLED ? undefined : null,
          tabBarIcon: ({ color }) => <Icon name="battle" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{ title: '單字卡', tabBarIcon: ({ color }) => <Icon name="cards" color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: '排行榜',
          href: ONLINE_ENABLED ? undefined : null,
          tabBarIcon: ({ color }) => <Icon name="trophy" color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
