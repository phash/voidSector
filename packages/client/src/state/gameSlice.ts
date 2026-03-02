import type { StateCreator } from 'zustand';
import type { APState, SectorData, Coords, FuelState, ShipData, MiningState, CargoState, ChatMessage, ChatChannel } from '@void-sector/shared';

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or private mode */ }
}

function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

export interface PlayerPresence {
  sessionId: string;
  username: string;
  x: number;
  y: number;
  connected: boolean;
}

export interface GameSlice {
  // Auth
  token: string | null;
  playerId: string | null;
  username: string | null;

  // Position
  position: Coords;

  // AP & Fuel
  ap: APState | null;
  fuel: FuelState | null;

  // Ship
  ship: ShipData | null;

  // Current sector
  currentSector: SectorData | null;

  // Players in current sector
  players: Record<string, PlayerPresence>;

  // Discovered sectors (fog of war map)
  discoveries: Record<string, SectorData>;

  // Event log
  log: string[];

  // Mining
  mining: MiningState | null;

  // Cargo
  cargo: CargoState;

  // Active monitor
  activeMonitor: string;

  // Chat / COMMS
  chatMessages: ChatMessage[];
  chatChannel: ChatChannel;

  // Alerts
  alerts: Record<string, boolean>;

  // Selected sector (radar click)
  selectedSector: { x: number; y: number } | null;

  // Base
  baseStructures: any[];

  // Actions
  setAuth: (token: string, playerId: string, username: string) => void;
  clearAuth: () => void;
  setPosition: (pos: Coords) => void;
  setAP: (ap: APState) => void;
  setFuel: (fuel: FuelState) => void;
  setShip: (ship: ShipData) => void;
  setCurrentSector: (sector: SectorData) => void;
  setPlayer: (sessionId: string, player: PlayerPresence) => void;
  removePlayer: (sessionId: string) => void;
  clearPlayers: () => void;
  addDiscoveries: (sectors: SectorData[]) => void;
  addLogEntry: (message: string) => void;
  setActiveMonitor: (monitor: string) => void;
  setMining: (mining: MiningState) => void;
  setCargo: (cargo: CargoState) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatChannel: (channel: ChatChannel) => void;
  setAlert: (monitorId: string, active: boolean) => void;
  clearAlert: (monitorId: string) => void;
  setSelectedSector: (sector: { x: number; y: number } | null) => void;
  setBaseStructures: (structures: any[]) => void;
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set) => ({
  token: safeGetItem('vs_token'),
  playerId: safeGetItem('vs_playerId'),
  username: safeGetItem('vs_username'),
  position: { x: 0, y: 0 },
  ap: null,
  fuel: null,
  ship: null,
  currentSector: null,
  players: {},
  discoveries: {},
  log: [],
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0 },
  activeMonitor: 'NAV-COM',
  chatMessages: [],
  chatChannel: 'local' as ChatChannel,
  alerts: {},
  selectedSector: null,
  baseStructures: [],

  setAuth: (token, playerId, username) => {
    safeSetItem('vs_token', token);
    safeSetItem('vs_playerId', playerId);
    safeSetItem('vs_username', username);
    set({ token, playerId, username });
  },

  clearAuth: () => {
    safeRemoveItem('vs_token');
    safeRemoveItem('vs_playerId');
    safeRemoveItem('vs_username');
    set({ token: null, playerId: null, username: null });
  },

  setPosition: (position) => set({ position }),
  setAP: (ap) => set({ ap }),
  setFuel: (fuel) => set({ fuel }),
  setShip: (ship) => set({ ship }),
  setCurrentSector: (sector) => set({ currentSector: sector }),

  setPlayer: (sessionId, player) =>
    set((s) => ({ players: { ...s.players, [sessionId]: player } })),

  removePlayer: (sessionId) =>
    set((s) => {
      const next = { ...s.players };
      delete next[sessionId];
      return { players: next };
    }),

  clearPlayers: () => set({ players: {} }),

  addDiscoveries: (sectors) =>
    set((s) => {
      const next = { ...s.discoveries };
      for (const sector of sectors) {
        next[`${sector.x}:${sector.y}`] = sector;
      }
      return { discoveries: next };
    }),

  addLogEntry: (message) =>
    set((s) => ({
      log: [...s.log.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`],
    })),

  setActiveMonitor: (activeMonitor) => set({ activeMonitor }),
  setMining: (mining) => set({ mining }),
  setCargo: (cargo) => set({ cargo }),

  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages.slice(-199), msg],
    })),
  setChatChannel: (chatChannel) => set({ chatChannel }),
  setAlert: (monitorId, active) => set((s) => ({
    alerts: { ...s.alerts, [monitorId]: active },
  })),
  clearAlert: (monitorId) => set((s) => {
    const next = { ...s.alerts };
    delete next[monitorId];
    return { alerts: next };
  }),
  setSelectedSector: (selectedSector) => set({ selectedSector }),
  setBaseStructures: (baseStructures) => set({ baseStructures }),
});
