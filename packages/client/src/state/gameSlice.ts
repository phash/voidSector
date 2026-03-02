import type { StateCreator } from 'zustand';
import type { APState, SectorData, Coords, FuelState, ShipData } from '@void-sector/shared';

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

  // Active monitor
  activeMonitor: string;

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
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set) => ({
  token: localStorage.getItem('vs_token'),
  playerId: localStorage.getItem('vs_playerId'),
  username: localStorage.getItem('vs_username'),
  position: { x: 0, y: 0 },
  ap: null,
  fuel: null,
  ship: null,
  currentSector: null,
  players: {},
  discoveries: {},
  log: [],
  activeMonitor: 'NAV-COM',

  setAuth: (token, playerId, username) => {
    localStorage.setItem('vs_token', token);
    localStorage.setItem('vs_playerId', playerId);
    localStorage.setItem('vs_username', username);
    set({ token, playerId, username });
  },

  clearAuth: () => {
    localStorage.removeItem('vs_token');
    localStorage.removeItem('vs_playerId');
    localStorage.removeItem('vs_username');
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
});
