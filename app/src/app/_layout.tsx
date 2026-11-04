import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DictionaryProvider } from '@/components/DictionarySheet';
import { LlmProvider } from '@/lib/llm';
import { ProfileProvider } from '@/lib/profile';
import { VocabProvider } from '@/lib/vocab';
import { C } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <VocabProvider>
          <LlmProvider>
            <DictionaryProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
            </DictionaryProvider>
          </LlmProvider>
        </VocabProvider>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
