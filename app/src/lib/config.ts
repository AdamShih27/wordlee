import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 對戰伺服器位址。
 * 1. 有設定 EXPO_PUBLIC_SERVER_URL 就用它（正式上線時設定成部署的網址）
 * 2. 網頁版:同一台電腦的 3001 port
 * 3. 手機用 Expo Go 開發:自動用電腦在區網的 IP（跟 Metro 同一台）
 */
function resolveServerUrl(): string {
  const env = process.env.EXPO_PUBLIC_SERVER_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3001`;
}

export const SERVER_URL = resolveServerUrl();
