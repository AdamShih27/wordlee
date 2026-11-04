import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage 的 JSON 包裝;讀寫失敗（例如網頁無痕模式）時不會讓 App 壞掉。 */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略:只是少了本機紀錄
  }
}

export const KEYS = {
  vocab: 'wordlee:vocab:v1',
  // 5 個字母沿用最早的 key,舊的進度和統計不會不見
  stats: (length = 5) => (length === 5 ? 'wordlee:stats:v1' : `wordlee:stats:v1:${length}`),
  daily: (index: number, length = 5) => (length === 5 ? `wordlee:daily:${index}` : `wordlee:daily:${length}:${index}`),
  hangman: 'wordlee:hangman:v1',
  settings: 'wordlee:settings:v1',
  profile: 'wordlee:profile:v1',
  seenHelp: 'wordlee:seen-help',
};
