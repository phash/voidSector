import type { SectorType, ShipClass, ResourceType } from './types.js';

export const SECTOR_TYPES: SectorType[] = [
  'empty', 'nebula', 'asteroid_field', 'station', 'anomaly', 'pirate'
];

export const SECTOR_WEIGHTS: Record<SectorType, number> = {
  empty: 0.55,
  asteroid_field: 0.15,
  nebula: 0.10,
  anomaly: 0.08,
  station: 0.05,
  pirate: 0.07,
};

export const AP_DEFAULTS = {
  max: 100,
  startingAP: 100,
  regenPerSecond: 0.5,  // 1 AP every 2 seconds
};

export const AP_COSTS = {
  jump: 1,  // base/default jump cost when no ship context is available
  scan: 3,
  mine: 0,
  // per-ship jump cost comes from ship.apCostJump
};

export const WORLD_SEED = 42;

export const RADAR_RADIUS = 3;  // visible sectors around player on scan

export const RECONNECTION_TIMEOUT_S = 15;

export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<ResourceType, number>> = {
  empty:          { ore: 5,  gas: 5,  crystal: 5  },
  nebula:         { ore: 2,  gas: 20, crystal: 3  },
  asteroid_field: { ore: 20, gas: 2,  crystal: 3  },
  anomaly:        { ore: 3,  gas: 3,  crystal: 20 },
  station:        { ore: 0,  gas: 0,  crystal: 0  },
  pirate:         { ore: 8,  gas: 3,  crystal: 8  },
};

export const MINING_RATE_PER_SECOND = 0.1;

export const RESOURCE_TYPES: ResourceType[] = ['ore', 'gas', 'crystal'];

// Ship class definitions (from visual reference material)
export const SHIP_CLASSES: Record<ShipClass, {
  name: string;
  displayName: string;
  jumpRange: number;
  apCostJump: number;
  fuelMax: number;
  fuelPerJump: number;
  cargoCap: number;
  scannerLevel: number;
  safeSlots: number;
}> = {
  aegis_scout_mk1: {
    name: 'VOID SCOUT MK. I',
    displayName: '"AEGIS"',
    jumpRange: 4,
    apCostJump: 1,
    fuelMax: 100,
    fuelPerJump: 5,
    cargoCap: 5,
    scannerLevel: 1,
    safeSlots: 1,
  },
  void_seeker_mk2: {
    name: 'VOID SEEKER MK. II',
    displayName: '"HELIOS"',
    jumpRange: 12,
    apCostJump: 2,
    fuelMax: 200,
    fuelPerJump: 3,
    cargoCap: 25,
    scannerLevel: 3,
    safeSlots: 3,
  },
};

// UI Symbols for grid rendering
export const SYMBOLS = {
  ship: '\u25A0',
  empty: '\u00B7',
  unexplored: '.',
  asteroid_field: '\u2593',
  nebula: '\u2592',
  station: '\u25B3',
  anomaly: '\u25CA',
  pirate: '\u2620',
  player: '\u25C6',
  iron: '\u26CF',
  homeBase: '\u2302',
} as const;

// Colors — Amber-Monochrom as per visual_design.md
export const THEME = {
  amber: {
    primary: '#FFB000',
    dim: 'rgba(255, 176, 0, 0.4)',
    bg: '#050505',
    danger: '#FF3333',
    bezel: '#1a1a1a',
    bezelLight: '#2a2a2a',
  },
} as const;

// Monitor IDs (Multi-Monitor-System)
export const MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
} as const;
