import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** 網頁版 / 實體鍵盤輸入。只在該分頁顯示中時才監聽。 */
export function usePhysicalKeyboard(onKey: (key: string) => void, enabled = true) {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || !enabled || typeof document === 'undefined') return;
      const listener = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        // 字典/統計面板開著的時候不要把字打到底下的盤面
        if (document.querySelector('[aria-modal="true"]')) return;
        if (e.key === 'Enter') handler.current('enter');
        else if (e.key === 'Backspace') handler.current('back');
        else if (/^[a-zA-Z]$/.test(e.key)) handler.current(e.key.toLowerCase());
        else return;
        // 用滑鼠點過按鈕後按 Enter,不要觸發那個按鈕（例如又按一次虛擬鍵盤的字母）
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement | null)?.blur?.();
      };
      // capture 階段先攔截，才能搶在獲得焦點的按鈕之前處理
      document.addEventListener('keydown', listener, true);
      return () => document.removeEventListener('keydown', listener, true);
    }, [enabled]),
  );
}
