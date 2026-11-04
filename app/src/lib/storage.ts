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
  stats: 'wordlee:stats:v1',
  daily: (index: number) => `wordlee:daily:${index}`,
  settings: 'wordlee:settings:v1',
  profile: 'wordlee:profile:v1',
  seenHelp: 'wordlee:seen-help',
};
