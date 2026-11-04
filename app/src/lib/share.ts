import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/** 手機用系統分享;網頁支援 Web Share 就用，不支援就複製到剪貼簿。 */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      if (nav?.share && /Mobi|Android|iPhone/i.test(nav.userAgent ?? '')) {
        await nav.share({ text });
        return 'shared';
      }
      await Clipboard.setStringAsync(text);
      return 'copied';
    }
    await Share.share({ message: text });
    return 'shared';
  } catch {
    try {
      await Clipboard.setStringAsync(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
