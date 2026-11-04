import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LeaderboardEntry } from '@wordlee/shared';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { ONLINE_ENABLED, SERVER_URL } from '@/lib/config';
import { DemoNotice } from '@/components/DemoNotice';
import { useProfile } from '@/lib/profile';
import { C, MAX_WIDTH, radius } from '@/lib/theme';

const MEDAL = ['#E8B923', '#A8B3C4', '#C98A4B'];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { playerId } = useProfile();
  const [list, setList] = useState<LeaderboardEntry[] | null>(null);
  const [me, setMe] = useState<LeaderboardEntry | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!ONLINE_ENABLED) return;
    try {
      const [a, b] = await Promise.all([
        fetch(`${SERVER_URL}/api/leaderboard?limit=100`),
        playerId ? fetch(`${SERVER_URL}/api/players/${playerId}`) : Promise.resolve(null),
      ]);
      if (!a.ok) throw new Error(String(a.status));
      setList(await a.json());
      setMe(b && b.ok ? await b.json() : null);
      setError(false);
      fetch(`${SERVER_URL}/api/scoring`)
        .then((r) => r.json())
        .then((r) => setRules(r.text))
        .catch(() => {});
    } catch {
      setError(true);
    }
  }, [playerId]);

  // 每次切到這個分頁就更新
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>排行榜</Text>
      </View>
      <View style={styles.body}>
        {!ONLINE_ENABLED && (
          <DemoNotice icon="trophy" title="排行榜還沒開放">
            排行榜記錄的是連線對戰的積分，等對戰伺服器架好就會出現。
          </DemoNotice>
        )}
        {me && (
          <View style={styles.meCard} testID="my-rank">
            <View>
              <Text style={styles.meLabel}>我的排名</Text>
              <Text style={styles.meRank}>#{me.rank}</Text>
            </View>
            <View style={styles.meStats}>
              <MeStat n={me.points} label="積分" />
              <MeStat n={me.wins} label="勝場" />
              <MeStat n={me.games} label="場次" />
            </View>
          </View>
        )}

        {!ONLINE_ENABLED ? null : error && !list ? (
          <View style={styles.center}>
            <Icon name="wifiOff" size={36} color={C.textMuted} />
            <Text style={styles.muted}>連不到伺服器({SERVER_URL})</Text>
            <Button title="重試" icon="refresh" onPress={refresh} />
          </View>
        ) : !list ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(e) => e.playerId}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}
            contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Icon name="trophy" size={36} color={C.primaryLight} />
                <Text style={styles.muted}>還沒有人上榜，去「對戰」打一場吧！</Text>
              </View>
            }
            ListFooterComponent={rules ? <Text style={styles.rules}>積分規則（暫定）：{rules}</Text> : undefined}
            renderItem={({ item }) => (
              <View style={[styles.row, item.playerId === playerId && styles.rowMe]}>
                <View style={[styles.rankBadge, item.rank <= 3 && { backgroundColor: MEDAL[item.rank - 1] }]}>
                  <Text style={[styles.rankText, item.rank <= 3 && { color: C.white }]}>{item.rank}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                    {item.playerId === playerId ? '（你）' : ''}
                  </Text>
                  <Text style={styles.sub}>
                    {item.wins} 勝 / {item.games} 場
                    {item.bestTimeMs != null ? ` · 最快 ${(item.bestTimeMs / 1000).toFixed(1)} 秒` : ''}
                  </Text>
                </View>
                <Text style={styles.points}>{item.points}</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

function MeStat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.meN}>{n}</Text>
      <Text style={styles.meStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: C.text },
  body: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  muted: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.primary,
    borderRadius: radius.lg,
    padding: 16,
  },
  meLabel: { color: C.primaryLight, fontSize: 13, fontWeight: '700' },
  meRank: { color: C.white, fontSize: 32, fontWeight: '900' },
  meStats: { flexDirection: 'row', gap: 18 },
  meN: { color: C.white, fontSize: 20, fontWeight: '800' },
  meStatLabel: { color: C.primaryLight, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  rowMe: { borderColor: C.primary, backgroundColor: C.primarySoft },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontWeight: '900', color: C.textMuted },
  name: { fontSize: 16, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  points: { fontSize: 20, fontWeight: '900', color: C.primary },
  rules: { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
