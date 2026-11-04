import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { evaluateGuess, MAX_GUESSES, type LetterState } from '@wordlee/shared';
import { Icon } from '@/components/Icon';
import { Tile } from '@/components/Tile';
import { SectionTitle, Sheet } from '@/components/ui';
import { emptyStats, loadStats, type Stats } from '@/lib/stats';
import { C, radius } from '@/lib/theme';

function ExampleRow({ word, states }: { word: string; states: (LetterState | undefined)[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginVertical: 6 }}>
      {word.split('').map((ch, i) => (
        <Tile key={i} letter={ch} state={states[i]} size={36} />
      ))}
    </View>
  );
}

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="怎麼玩" testID="help-sheet">
      <Text style={styles.p}>用 6 次機會猜出一個 5 個字母的英文單字。每猜一次，方塊的顏色會告訴你有多接近：</Text>
      <ExampleRow word="crane" states={['correct']} />
      <Text style={styles.p}>
        <Text style={styles.b}>C</Text> 是<Text style={{ color: C.correct, fontWeight: '800' }}>綠色</Text>
        ：字母在正確位置。
      </Text>
      <ExampleRow word="pilot" states={[undefined, 'present']} />
      <Text style={styles.p}>
        <Text style={styles.b}>I</Text> 是<Text style={{ color: C.present, fontWeight: '800' }}>黃色</Text>
        ：答案有這個字母，但位置不對。
      </Text>
      <ExampleRow word="vague" states={[undefined, undefined, undefined, 'absent']} />
      <Text style={styles.p}>
        <Text style={styles.b}>U</Text> 是<Text style={{ color: C.absent, fontWeight: '800' }}>灰色</Text>
        ：答案沒有這個字母。
      </Text>

      <SectionTitle>字典與單字卡</SectionTitle>
      <View style={styles.tipRow}>
        <View style={styles.bookBadge}>
          <Icon name="book" size={16} color={C.primary} />
        </View>
        <Text style={[styles.p, { flex: 1 }]}>
          每送出一個字，那一行右邊會出現書本按鈕。點一下就能看中文意思、詞性、單複數和例句，看不懂的字按「收藏」就會加進你的單字卡。
        </Text>
      </View>

      <SectionTitle>模式</SectionTitle>
      <Text style={styles.p}>
        <Text style={styles.b}>每日挑戰</Text>：每天一題，所有人同一題，半夜 12 點換題，會記錄連勝。{'\n'}
        <Text style={styles.b}>練習模式</Text>：隨機出題，可以一直玩，不計入統計。{'\n'}
        <Text style={styles.b}>對戰</Text>：跟朋友連線猜同一題，看誰最快解出來。
      </Text>
    </Sheet>
  );
}

function msToNextDay() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export function StatsSheet({ visible, onClose, day }: { visible: boolean; onClose: () => void; day: number }) {
  const [stats, setStats] = useState<Stats>(emptyStats());
  const [left, setLeft] = useState(msToNextDay());

  useEffect(() => {
    if (!visible) return;
    loadStats().then(setStats);
    const t = setInterval(() => setLeft(msToNextDay()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  // 昨天沒玩的話，連勝已經斷了
  const streak = stats.lastWonIndex !== null && stats.lastWonIndex >= day - 1 ? stats.currentStreak : 0;
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <Sheet visible={visible} onClose={onClose} title="每日挑戰統計" testID="stats-sheet">
      <View style={styles.statRow}>
        <Stat n={stats.played} label="已玩" />
        <Stat n={winRate} label="勝率 %" />
        <Stat n={streak} label="目前連勝" />
        <Stat n={stats.maxStreak} label="最長連勝" />
      </View>

      <SectionTitle>猜中次數分布</SectionTitle>
      {Array.from({ length: MAX_GUESSES }, (_, i) => (
        <View key={i} style={styles.distRow}>
          <Text style={styles.distLabel}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.distBar,
                { width: `${Math.max(8, (stats.dist[i] / maxDist) * 100)}%` },
                !(stats.lastWonIndex === day && stats.lastGuesses === i + 1) && { backgroundColor: C.absent },
              ]}>
              <Text style={styles.distN}>{stats.dist[i]}</Text>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.next}>
        <Text style={styles.nextLabel}>下一題倒數</Text>
        <Text style={styles.nextTime}>{fmtCountdown(left)}</Text>
      </View>
    </Sheet>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function SettingsSheet({
  visible,
  onClose,
  hardMode,
  onChangeHardMode,
}: {
  visible: boolean;
  onClose: () => void;
  hardMode: boolean;
  onChangeHardMode: (v: boolean) => void;
}) {
  const sample = evaluateGuess('react', 'crane');
  return (
    <Sheet visible={visible} onClose={onClose} title="設定" testID="settings-sheet">
      <View style={styles.setting}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>困難模式</Text>
          <Text style={styles.settingDesc}>
            得到的提示一定要用上:綠色字母要留在原位，黃色字母一定要出現在下一次猜測。每日挑戰開始猜之後就不能切換。
          </Text>
        </View>
        <Switch
          value={hardMode}
          onValueChange={onChangeHardMode}
          trackColor={{ true: C.primary, false: C.border }}
          thumbColor={C.white}
          testID="hard-mode-switch"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
        {'react'.split('').map((ch, i) => (
          <Tile key={i} letter={ch} state={sample[i]} size={28} />
        ))}
      </View>

      <SectionTitle>關於</SectionTitle>
      <Text style={styles.settingDesc}>
        Wordlee v0.1 · 字典資料:ECDICT (MIT)、Free Dictionary API、Tatoeba (CC BY 2.0 FR);字庫:ENABLE (Public Domain)
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 15, color: C.text, lineHeight: 23 },
  b: { fontWeight: '800' },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bookBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 },
  stat: { alignItems: 'center', minWidth: 64 },
  statN: { fontSize: 30, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 12, color: C.textMuted },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  distLabel: { width: 14, fontWeight: '700', color: C.text },
  distBar: {
    backgroundColor: C.primary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'flex-end',
  },
  distN: { color: C.white, fontWeight: '800', fontSize: 13 },
  next: {
    marginTop: 18,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
  },
  nextLabel: { fontSize: 13, color: C.textMuted, fontWeight: '700' },
  nextTime: { fontSize: 28, fontWeight: '800', color: C.primaryDark, fontVariant: ['tabular-nums'] },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  settingDesc: { fontSize: 13, color: C.textMuted, lineHeight: 19, marginTop: 2 },
});
