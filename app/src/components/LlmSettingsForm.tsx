import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui';
import { createClient, useLlm } from '@/lib/llm';
import { C, radius } from '@/lib/theme';

/** AI 批改的連線設定:填 Ollama 網址 → 測試連線 → 從電腦上已下載的模型挑一個。 */
export function LlmSettingsForm() {
  const llm = useLlm();
  const [url, setUrl] = useState(llm.settings.baseUrl);
  const [models, setModels] = useState<string[] | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({ kind: 'idle' });

  const test = async () => {
    llm.update({ baseUrl: url.trim() });
    setStatus({ kind: 'testing' });
    try {
      // 用輸入框裡的網址測試（設定在下一次 render 才會更新）
      const list = await createClient({ ...llm.settings, baseUrl: url.trim() }).listModels();
      setModels(list);
      setStatus(
        list.length
          ? { kind: 'ok', message: `連線成功，電腦上有 ${list.length} 個模型` }
          : { kind: 'error', message: '連線成功，但電腦上還沒有模型，先執行 ollama pull <模型名稱>' },
      );
      if (list.length && !list.includes(llm.settings.model)) llm.update({ model: list[0] });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    }
  };

  return (
    <View style={{ gap: 8 }} testID="llm-settings">
      <Text style={styles.label}>Ollama 網址</Text>
      <View style={styles.row}>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://localhost:11434"
          placeholderTextColor={C.textFaint}
          style={styles.input}
          testID="llm-url"
        />
        <Button small title="測試連線" onPress={test} testID="llm-test" />
      </View>
      {status.kind === 'testing' && <ActivityIndicator color={C.primary} style={{ alignSelf: 'flex-start' }} />}
      {status.message && (
        <Text style={[styles.status, { color: status.kind === 'ok' ? C.correct : C.danger }]} testID="llm-status">
          {status.message}
        </Text>
      )}
      {(models ?? (llm.settings.model ? [llm.settings.model] : [])).length > 0 && (
        <>
          <Text style={styles.label}>模型</Text>
          <View style={styles.models}>
            {(models ?? [llm.settings.model]).map((m) => {
              const on = m === llm.settings.model;
              return (
                <Pressable
                  key={m}
                  onPress={() => llm.update({ model: m })}
                  style={[styles.model, on && styles.modelOn]}
                  testID={`llm-model-${m}`}>
                  <Text style={[styles.modelText, on && { color: C.white }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <Text style={styles.help}>
        在電腦上安裝 Ollama 並下載模型（例如 ollama pull 加上模型名稱）。手機或網頁版要連回家裡電腦時，請看 README 的「AI 批改」一節。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.surface,
  },
  status: { fontSize: 13, lineHeight: 19 },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  model: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  modelOn: { backgroundColor: C.primary, borderColor: C.primary },
  modelText: { fontSize: 13, fontWeight: '700', color: C.text },
  help: { fontSize: 12, color: C.textMuted, lineHeight: 18 },
});
