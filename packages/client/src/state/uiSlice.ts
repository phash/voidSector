import type { StateCreator } from 'zustand';
import type { ColorProfileName } from '../styles/themes';
import { createJumpAnimation, type JumpAnimationState } from '../canvas/JumpAnimation';

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
  brightness: number;
  colorProfile: ColorProfileName;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  jumpAnimation: JumpAnimationState | null;

  setScreen: (screen: Screen) => void;
  setTheme: (theme: ThemeColor) => void;
  setJumpPending: (pending: boolean) => void;
  setBrightness: (val: number) => void;
  setColorProfile: (profile: ColorProfileName) => void;
  setZoomLevel: (level: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  resetPan: () => void;
  startJumpAnimation: (dx: number, dy: number) => void;
  clearJumpAnimation: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  screen: 'login',
  theme: (safeGetItem('vs_theme') as ThemeColor) || 'amber',
  jumpPending: false,
  brightness: parseFloat(safeGetItem('vs-brightness') || '1'),
  colorProfile: (safeGetItem('vs-color-profile') as ColorProfileName) || 'Amber Classic',
  zoomLevel: 1,
  panOffset: { x: 0, y: 0 },
  jumpAnimation: null,

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    safeSetItem('vs_theme', theme);
    set({ theme });
  },
  setJumpPending: (jumpPending) => set({ jumpPending }),
  setBrightness: (val) => {
    safeSetItem('vs-brightness', String(val));
    set({ brightness: val });
  },
  setColorProfile: (profile) => {
    safeSetItem('vs-color-profile', profile);
    set({ colorProfile: profile });
  },
  setZoomLevel: (level) => set({ zoomLevel: Math.max(0, Math.min(2, level)) }),
  setPanOffset: (offset) => set({
    panOffset: {
      x: Math.max(-3, Math.min(3, offset.x)),
      y: Math.max(-3, Math.min(3, offset.y)),
    },
  }),
  resetPan: () => set({ panOffset: { x: 0, y: 0 } }),
  startJumpAnimation: (dx, dy) => set({ jumpAnimation: createJumpAnimation(dx, dy) }),
  clearJumpAnimation: () => set({ jumpAnimation: null }),
});
