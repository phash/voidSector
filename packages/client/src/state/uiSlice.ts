import type { StateCreator } from 'zustand';

export type Screen = 'login' | 'game';
export type ThemeColor = 'amber';

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or private mode */ }
}

export interface UISlice {
  screen: Screen;
  theme: ThemeColor;
  jumpPending: boolean;

  setScreen: (screen: Screen) => void;
  setTheme: (theme: ThemeColor) => void;
  setJumpPending: (pending: boolean) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  screen: 'login',
  theme: (safeGetItem('vs_theme') as ThemeColor) || 'amber',
  jumpPending: false,

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    safeSetItem('vs_theme', theme);
    set({ theme });
  },
  setJumpPending: (jumpPending) => set({ jumpPending }),
});
