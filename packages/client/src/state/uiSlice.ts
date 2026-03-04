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

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
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
  sidebarSlots: [string, string];
  leftSidebarSlots: [string, string];
  mainMonitorMode: 'split' | string;
  autoFollow: boolean;
  detailView: { type: string; data?: Record<string, any> } | null;
  leftCollapsed: boolean;
  rightCollapsed: boolean;

  setScreen: (screen: Screen) => void;
  setTheme: (theme: ThemeColor) => void;
  setJumpPending: (pending: boolean) => void;
  setBrightness: (val: number) => void;
  setColorProfile: (profile: ColorProfileName) => void;
  setZoomLevel: (level: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  resetPan: () => void;
  startJumpAnimation: (dx: number, dy: number, distance?: number) => void;
  clearJumpAnimation: () => void;
  setSidebarSlot: (index: 0 | 1, monitor: string) => void;
  setLeftSidebarSlot: (index: 0 | 1, monitor: string) => void;
  setMainMonitorMode: (mode: 'split' | string) => void;
  setAutoFollow: (val: boolean) => void;
  setDetailView: (view: { type: string; data?: Record<string, any> } | null) => void;
  setLeftCollapsed: (val: boolean) => void;
  setRightCollapsed: (val: boolean) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  screen: 'login',
  theme: (safeGetItem('vs_theme') as ThemeColor) || 'amber',
  jumpPending: false,
  brightness: parseFloat(safeGetItem('vs-brightness') || '1'),
  colorProfile: (safeGetItem('vs-color-profile') as ColorProfileName) || 'Amber Classic',
  zoomLevel: 2,
  panOffset: { x: 0, y: 0 },
  jumpAnimation: null,
  sidebarSlots: safeJsonParse<[string, string]>(safeGetItem('vs-sidebar-slots'), ['SHIP-SYS', 'COMMS']),
  leftSidebarSlots: safeJsonParse<[string, string]>(safeGetItem('vs-left-sidebar-slots'), ['LOG', 'SHIP-SYS']),
  mainMonitorMode: 'split' as 'split' | string,
  autoFollow: false,
  detailView: null,
  leftCollapsed: false,
  rightCollapsed: false,

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
  setZoomLevel: (level) => set({ zoomLevel: Math.max(0, Math.min(4, level)) }),
  setPanOffset: (offset) => set((s) => {
    if (s.zoomLevel === 4) return {}; // no pan in 3×3 detail view
    return {
      panOffset: {
        x: Math.max(-50, Math.min(50, Math.round(offset.x))),
        y: Math.max(-50, Math.min(50, Math.round(offset.y))),
      },
    };
  }),
  resetPan: () => set({ panOffset: { x: 0, y: 0 } }),
  startJumpAnimation: (dx, dy, distance?) => set({ jumpAnimation: createJumpAnimation(dx, dy, distance) }),
  clearJumpAnimation: () => set({ jumpAnimation: null }),
  setSidebarSlot: (index, monitor) => set((s) => {
    const slots = [...s.sidebarSlots] as [string, string];
    slots[index] = monitor;
    safeSetItem('vs-sidebar-slots', JSON.stringify(slots));
    return { sidebarSlots: slots };
  }),
  setLeftSidebarSlot: (index, monitor) => set((s) => {
    const slots = [...s.leftSidebarSlots] as [string, string];
    slots[index] = monitor;
    safeSetItem('vs-left-sidebar-slots', JSON.stringify(slots));
    return { leftSidebarSlots: slots };
  }),
  setMainMonitorMode: (mode) => set({ mainMonitorMode: mode }),
  setAutoFollow: (autoFollow) => set({ autoFollow }),
  setDetailView: (view) => set({ detailView: view }),
  setLeftCollapsed: (val) => set({ leftCollapsed: val }),
  setRightCollapsed: (val) => set({ rightCollapsed: val }),
});
