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
  breadcrumbStack: Array<{ label: string; program: string }>;
  contextMenu: { playerId: string; playerName: string; x: number; y: number } | null;

  // ACEP program tab state
  acepActiveTab: 'acep' | 'module' | 'shop';
  acepHoveredModuleId: string | null;
  setAcepActiveTab: (tab: 'acep' | 'module' | 'shop') => void;
  setAcepHoveredModuleId: (id: string | null) => void;

  selectedSlateId: string | null;
  setSelectedSlateId: (id: string | null) => void;

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
  pushBreadcrumb: (crumb: { label: string; program: string }) => void;
  popBreadcrumb: () => void;
  clearBreadcrumbs: () => void;
  openContextMenu: (playerId: string, playerName: string, x: number, y: number) => void;
  closeContextMenu: () => void;

  // Area scan summary notification
  areaScanSummary: { sectorsScanned: number; newSectors: number; notable: string[] } | null;
  setAreaScanSummary: (summary: { sectorsScanned: number; newSectors: number; notable: string[] } | null) => void;

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
  breadcrumbStack: [],
  contextMenu: null,
  acepActiveTab: 'acep',
  acepHoveredModuleId: null,
  selectedSlateId: null,

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
  setPanOffset: (offset) =>
    set((s) => {
      if (s.zoomLevel >= 4) return {}; // no pan in 3×3 detail view or admin deep-zoom
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
    set({ activeProgram: program, breadcrumbStack: [] });
  },
  navigateToProgram: (program) => {
    const current = get().activeProgram;
    safeSetItem('vs-active-program', program);
    set({ activeProgram: program, navReturnProgram: current });
  },
  clearNavReturn: () => set({ navReturnProgram: null }),
  pushBreadcrumb: (crumb) =>
    set((s) => {
      const stack = s.breadcrumbStack;
      if (stack.length >= 3) {
        return { breadcrumbStack: [...stack.slice(0, -1), crumb] };
      }
      return { breadcrumbStack: [...stack, crumb] };
    }),
  popBreadcrumb: () => {
    const s = get();
    const stack = [...s.breadcrumbStack];
    const last = stack.pop();
    if (last) {
      safeSetItem('vs-active-program', last.program);
      set({ breadcrumbStack: stack, activeProgram: last.program });
    }
  },
  clearBreadcrumbs: () => set({ breadcrumbStack: [], navReturnProgram: null }),
  openContextMenu: (playerId, playerName, x, y) =>
    set({ contextMenu: { playerId, playerName, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),
  setAcepActiveTab: (tab) => set({ acepActiveTab: tab }),
  setAcepHoveredModuleId: (id) => set({ acepHoveredModuleId: id }),
  setSelectedSlateId: (id) => set({ selectedSlateId: id }),

  areaScanSummary: null,
  setAreaScanSummary: (summary) => set({ areaScanSummary: summary }),

  stationTerminalOpen: false,
  openStationTerminal: () => set({ stationTerminalOpen: true }),
  closeStationTerminal: () => set({ stationTerminalOpen: false }),
});
