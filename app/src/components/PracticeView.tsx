import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GradeResult } from '@wordlee/shared';
import { LlmSettingsForm } from '@/components/LlmSettingsForm';
import { Button, SectionTitle } from '@/components/ui';
import { shortMeaning, useOfflineInfo } from '@/lib/dictionary';
import { gradeSentence, useLlm } from '@/lib/llm';
import { C, radius } from '@/lib/theme';

const VERDICT = {
  correct: { label: '很好！句子正確又自然', color: C.correct, bg: '#E7F6EC' },
  minor: { label: '意思對了，有小地方可以更好', color: '#A16207', bg: '#FEF9C3' },
  incorrect: { label: '需要修改', color: C.danger, bg: '#FEF2F2' },
} as const;

/** 造句練習:用指定的字寫一句，交給 LLM 批改。 */
export function PracticeView({ word }: { word: string }) {
  const llm = useLlm();
  const info = useOfflineInfo(word);
  const [sentence, setSentence] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitted, setSubmitted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(!llm.configured);

  const meaning = info?.ready ? shortMeaning(word, 1) : undefined;

  const submit = async () => {
    const s = sentence.trim();
    if (!s || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await gradeSentence(llm.client, word, s, meaning);
      setResult(r);
      setSubmitted(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="practice-view">
      <Text style={styles.word}>{word}</Text>
      {!!meaning && <Text style={styles.meaning}>{meaning}</Text>}

      <SectionTitle>用這個字造一個句子</SectionTitle>
      <TextInput
        value={sentence}
        onChangeText={setSentence}
        placeholder={`例如：I saw a ${word} ...`}
        placeholderTextColor={C.textFaint}
        multiline
        maxLength={200}
        autoCapitalize="sentences"
        style={styles.input}
        testID="practice-input"
      />
      <View style={styles.actions}>
        <Button
          title={busy ? 'AI 批改中…' : '批改'}
          icon="check"
          onPress={submit}
          disabled={busy || !sentence.trim() || !llm.configured}
          style={{ flex: 1 }}
          testID="practice-submit"
        />
      </View>
      {busy && (
        <View style={styles.loading}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.muted}>模型第一次載入要等比較久</Text>
        </View>
      )}
      {!llm.configured && <Text style={styles.muted}>還沒設定 AI 批改，請在下方填好 Ollama 網址並選一個模型。</Text>}
      {error && (
        <Text style={styles.error} testID="practice-error">
          {error}
        </Text>
      )}

      {result && (
        <View style={styles.result} testID="practice-result">
          <View style={[styles.verdict, { backgroundColor: VERDICT[result.verdict].bg }]}>
            <Text style={[styles.verdictText, { color: VERDICT[result.verdict].color }]}>{VERDICT[result.verdict].label}</Text>
          </View>
          {!result.usesWord && <Text style={styles.error}>這個句子好像沒有用到「{word}」，再試一次？</Text>}
          {result.corrected !== submitted && (
            <>
              <Text style={styles.label}>修改後</Text>
              <Text style={styles.corrected} testID="practice-corrected">
                {result.corrected}
              </Text>
            </>
          )}
          {result.explanations.length > 0 && (
            <View style={{ gap: 4 }}>
              {result.explanations.map((x, i) => (
                <Text key={i} style={styles.explain}>
                  • {x}
                </Text>
              ))}
            </View>
          )}
          {result.example && (
            <>
              <Text style={styles.label}>例句</Text>
              <Text style={styles.example}>{result.example}</Text>
            </>
          )}
          <Text style={styles.note}>AI 批改僅供參考，偶爾會出錯；字義以字典為準。</Text>
        </View>
      )}

      <Pressable onPress={() => setShowSettings((v) => !v)} style={styles.settingsToggle} testID="practice-settings-toggle">
        <Text style={styles.settingsToggleText}>
          {showSettings ? '收起 AI 批改設定' : `AI 批改設定${llm.configured ? `（${llm.settings.model}）` : ''}`}
        </Text>
      </Pressable>
      {showSettings && <LlmSettingsForm />}
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontSize: 30, fontWeight: '800', color: C.text },
  meaning: { fontSize: 15, color: C.textMuted, marginTop: 2 },
  input: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: C.primaryLight,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 16,
    lineHeight: 23,
    color: C.text,
    backgroundColor: C.surface,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  muted: { fontSize: 13, color: C.textMuted, marginTop: 8, lineHeight: 19 },
  error: { fontSize: 14, color: C.danger, marginTop: 8, lineHeight: 20 },
  result: { marginTop: 14, gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border },
  verdict: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  verdictText: { fontWeight: '800', fontSize: 14 },
  label: { fontSize: 12, fontWeight: '800', color: C.textMuted, marginTop: 4 },
  corrected: { fontSize: 16, color: C.text, fontWeight: '600', lineHeight: 23 },
  explain: { fontSize: 15, color: C.text, lineHeight: 22 },
  example: { fontSize: 15, color: C.text, fontStyle: 'italic', lineHeight: 22 },
  note: { fontSize: 11, color: C.textFaint, marginTop: 4 },
  settingsToggle: { marginTop: 18, alignSelf: 'flex-start' },
  settingsToggleText: { color: C.primary, fontWeight: '700', fontSize: 13 },
});
