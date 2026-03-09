import type { StateCreator } from 'zustand';
import type { ColorProfileName } from '../styles/themes';
import { createJumpAnimation, type JumpAnimationState } from '../canvas/JumpAnimation';
import { createScanAnimation, type ScanAnimationState } from '../canvas/ScanAnimation';

export type Screen = 'login' | 'game';
export type ThemeColor = 'amber';

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded or private mode */
  }
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export interface UISlice {
  screen: Screen;
  theme: ThemeColor;
  jumpPending: boolean;
  brightness: number;
  colorProfile: ColorProfileName;
  /** True when admin deep-zoom mode is enabled (toggled via ADMIN button or localStorage key vs_admin_mode=1) */
  isAdmin: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  jumpAnimation: JumpAnimationState | null;
  autoFollow: boolean;
  detailView: { type: string; data?: Record<string, any> } | null;
  monitorPower: Record<string, boolean>;
  monitorChromeVisible: Record<string, boolean>;
  monitorModes: Record<string, string>;
  moreOverlayOpen: boolean;
  scanAnimation: ScanAnimationState | null;
  scanPending: boolean;
  activeProgram: string;
  navReturnProgram: string | null;
  contextMenu: { playerId: string; playerName: string; x: number; y: number } | null;

  setScreen: (screen: Screen) => void;
  setTheme: (theme: ThemeColor) => void;
  setIsAdmin: (val: boolean) => void;
  setJumpPending: (pending: boolean) => void;
  setBrightness: (val: number) => void;
  setColorProfile: (profile: ColorProfileName) => void;
  setZoomLevel: (level: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  resetPan: () => void;
  startJumpAnimation: (dx: number, dy: number, distance?: number) => void;
  clearJumpAnimation: () => void;
  setAutoFollow: (val: boolean) => void;
  setDetailView: (view: { type: string; data?: Record<string, any> } | null) => void;
  setMonitorPower: (monitorId: string, on: boolean) => void;
  setMonitorChromeVisible: (monitorId: string, visible: boolean) => void;
  setMonitorMode: (monitorId: string, mode: string) => void;
  setMoreOverlayOpen: (open: boolean) => void;
  startScanAnimation: (type: 'local' | 'area') => void;
  clearScanAnimation: () => void;
  setScanPending: (pending: boolean) => void;
  setActiveProgram: (program: string) => void;
  navigateToProgram: (program: string) => void;
  clearNavReturn: () => void;
  openContextMenu: (playerId: string, playerName: string, x: number, y: number) => void;
  closeContextMenu: () => void;

  // Station terminal
  stationTerminalOpen: boolean;
  openStationTerminal: () => void;
  closeStationTerminal: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  screen: 'login',
  theme: (safeGetItem('vs_theme') as ThemeColor) || 'amber',
  jumpPending: false,
  brightness: parseFloat(safeGetItem('vs-brightness') || '1'),
  colorProfile: (safeGetItem('vs-color-profile') as ColorProfileName) || 'Amber Classic',
  isAdmin: safeGetItem('vs_admin_mode') === '1',
  zoomLevel: 2,
  panOffset: { x: 0, y: 0 },
  jumpAnimation: null,
  autoFollow: false,
  detailView: null,
  monitorPower: {},
  monitorChromeVisible: {},
  monitorModes: {},
  moreOverlayOpen: false,
  scanAnimation: null,
  scanPending: false,
  activeProgram: safeGetItem('vs-active-program') || 'NAV-COM',
  navReturnProgram: null,
  contextMenu: null,

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    safeSetItem('vs_theme', theme);
    set({ theme });
  },
  setIsAdmin: (val) => {
    safeSetItem('vs_admin_mode', val ? '1' : '0');
    set({ isAdmin: val });
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
  setPanOffset: (offset) =>
    set((s) => {
      if (s.zoomLevel === 4) return {}; // no pan in 3×3 detail view
      return {
        panOffset: {
          x: Math.max(-50, Math.min(50, Math.round(offset.x))),
          y: Math.max(-50, Math.min(50, Math.round(offset.y))),
        },
      };
    }),
  resetPan: () => set({ panOffset: { x: 0, y: 0 } }),
  startJumpAnimation: (dx, dy, distance?) =>
    set({ jumpAnimation: createJumpAnimation(dx, dy, distance) }),
  clearJumpAnimation: () => set({ jumpAnimation: null }),
  setAutoFollow: (autoFollow) => set({ autoFollow }),
  setDetailView: (view) => set({ detailView: view }),
  setMonitorPower: (monitorId, on) =>
    set((s) => ({
      monitorPower: { ...s.monitorPower, [monitorId]: on },
    })),
  setMonitorChromeVisible: (monitorId, visible) =>
    set((s) => ({
      monitorChromeVisible: { ...s.monitorChromeVisible, [monitorId]: visible },
    })),
  setMonitorMode: (monitorId, mode) =>
    set((s) => ({
      monitorModes: { ...s.monitorModes, [monitorId]: mode },
    })),
  setMoreOverlayOpen: (open) => set({ moreOverlayOpen: open }),
  startScanAnimation: (type) =>
    set({ scanAnimation: createScanAnimation(type), scanPending: true }),
  clearScanAnimation: () => set({ scanAnimation: null, scanPending: false }),
  setScanPending: (pending) => set({ scanPending: pending }),
  setActiveProgram: (program) => {
    safeSetItem('vs-active-program', program);
    set({ activeProgram: program });
  },
  navigateToProgram: (program) => {
    const current = get().activeProgram;
    safeSetItem('vs-active-program', program);
    set({ activeProgram: program, navReturnProgram: current });
  },
  clearNavReturn: () => set({ navReturnProgram: null }),
  openContextMenu: (playerId, playerName, x, y) =>
    set({ contextMenu: { playerId, playerName, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  stationTerminalOpen: false,
  openStationTerminal: () => set({ stationTerminalOpen: true }),
  closeStationTerminal: () => set({ stationTerminalOpen: false }),
});
