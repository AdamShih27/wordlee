import type { LetterState } from '@wordlee/shared';

/** 白底 + 藍色系;字母狀態維持 綠/黃/灰 的慣例。 */
export const C = {
  bg: '#FFFFFF',
  surface: '#F4F7FD',
  surfaceAlt: '#E8EFFB',
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#DBE7FE',
  primarySoft: '#EFF5FF',
  text: '#0F1B33',
  textMuted: '#5B6B86',
  textFaint: '#94A3B8',
  border: '#D5DEEC',
  borderStrong: '#7C93B8',
  danger: '#DC2626',
  white: '#FFFFFF',
  overlay: 'rgba(15, 27, 51, 0.45)',

  correct: '#3FA55D',
  present: '#D6A92A',
  absent: '#8792A6',
  keyIdle: '#E3EAF6',
} as const;

export const stateColor: Record<LetterState, string> = {
  correct: C.correct,
  present: C.present,
  absent: C.absent,
};

export const radius = { sm: 6, md: 10, lg: 16, xl: 24 } as const;

/** 遊戲區塊最大寬度（網頁版不會被拉太寬） */
export const MAX_WIDTH = 520;
