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
  stats: (length = 5) => `wordlee:stats:v2:${length}`,
  /** 還沒玩完的那一局（每種長度各一局），關掉 App 再打開可以接著玩 */
  current: (length = 5) => `wordlee:current:v1:${length}`,
  hangman: 'wordlee:hangman:v1',
  /** AI 批改(LLM)的連線設定 */
  llm: 'wordlee:llm:v1',
  settings: 'wordlee:settings:v1',
  profile: 'wordlee:profile:v1',
  seenHelp: 'wordlee:seen-help',
};
