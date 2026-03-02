import type { StateCreator } from 'zustand';

export type Screen = 'login' | 'game';
export type ThemeColor = 'amber';

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
  theme: (localStorage.getItem('vs_theme') as ThemeColor) || 'amber',
  jumpPending: false,

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    localStorage.setItem('vs_theme', theme);
    set({ theme });
  },
  setJumpPending: (jumpPending) => set({ jumpPending }),
});
