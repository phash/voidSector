import type { SectorType, ShipClass, ResourceType, StructureType, HullType, HullDefinition, ModuleDefinition } from './types.js';

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

export const AP_COSTS_BY_SCANNER: Record<number, { areaScan: number; areaScanRadius: number }> = {
  1: { areaScan: 3, areaScanRadius: 2 },
  2: { areaScan: 5, areaScanRadius: 3 },
  3: { areaScan: 8, areaScanRadius: 5 },
};

export const AP_COSTS_LOCAL_SCAN = 1;

export const WORLD_SEED = 77;

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

export const STRUCTURE_COSTS: Record<StructureType, Record<ResourceType, number>> = {
  comm_relay: { ore: 5, gas: 0, crystal: 2 },
  mining_station: { ore: 30, gas: 15, crystal: 10 },
  base: { ore: 50, gas: 30, crystal: 25 },
  storage: { ore: 20, gas: 10, crystal: 5 },
  trading_post: { ore: 30, gas: 20, crystal: 15 },
};

export const STRUCTURE_AP_COSTS: Record<StructureType, number> = {
  comm_relay: 5,
  mining_station: 15,
  base: 25,
  storage: 10,
  trading_post: 15,
};

export const RELAY_RANGES: Record<StructureType, number> = {
  comm_relay: 500,
  mining_station: 500,
  base: 1000,
  storage: 0,
  trading_post: 0,
};

// NPC Trade Prices (base prices per unit in credits)
export const NPC_PRICES: Record<ResourceType, number> = {
  ore: 10,
  gas: 15,
  crystal: 25,
};

export const NPC_BUY_SPREAD = 1.2;
export const NPC_SELL_SPREAD = 0.8;

// Data Slate constants
export const SLATE_AP_COST_SECTOR = 1;
export const SLATE_AP_COST_AREA = 3;
export const SLATE_NPC_PRICE_PER_SECTOR = 5;
export const SLATE_AREA_RADIUS: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
};

// --- Phase 4: NPC Ecosystem ---

export const NPC_FACTION_WEIGHTS: Record<string, number> = {
  independent: 0.30,
  traders: 0.28,
  scientists: 0.25,
  pirates: 0.16,
  ancients: 0.01,
};

export const REP_TIERS: Record<string, { min: number; max: number }> = {
  hostile:    { min: -100, max: -51 },
  unfriendly: { min: -50, max: -1 },
  neutral:    { min: 0, max: 0 },
  friendly:   { min: 1, max: 50 },
  honored:    { min: 51, max: 100 },
};

export const REP_PRICE_MODIFIERS: Record<string, number> = {
  hostile: 1.5,
  unfriendly: 1.0,
  neutral: 1.0,
  friendly: 0.9,
  honored: 0.75,
};

export const FACTION_UPGRADES: Record<string, { factionId: string; name: string; effect: string }> = {
  cargo_expansion:  { factionId: 'traders',    name: 'CARGO EXPANSION',  effect: '+3 cargo capacity' },
  advanced_scanner: { factionId: 'scientists', name: 'ADVANCED SCANNER', effect: '+1 areaScan radius' },
  combat_plating:   { factionId: 'pirates',    name: 'COMBAT PLATING',   effect: '+20% combat bonus' },
  void_drive:       { factionId: 'ancients',   name: 'VOID DRIVE',       effect: '-1 AP movement cost' },
};

export const BATTLE_AP_COST_FLEE = 2;
export const BATTLE_CARGO_LOSS_MIN = 0.25;
export const BATTLE_CARGO_LOSS_MAX = 0.50;
export const BATTLE_NEGOTIATE_COST_PER_LEVEL = 10;
export const BATTLE_FLEE_BASE_CHANCE = 0.6;
export const PIRATE_LEVEL_DISTANCE_DIVISOR = 50;
export const PIRATE_MAX_LEVEL = 10;

export const PIRATE_BASE_HP = 20;
export const PIRATE_HP_PER_LEVEL = 10;
export const PIRATE_BASE_DAMAGE = 5;
export const PIRATE_DAMAGE_PER_LEVEL = 3;

// Combat v2 — Feature flag
export const FEATURE_COMBAT_V2 = true;

// Combat v2 — Tactic multipliers
export const TACTIC_MODS: Record<string, { dmg: number; def: number }> = {
  assault:   { dmg: 1.30, def: 0.80 },
  balanced:  { dmg: 1.00, def: 1.00 },
  defensive: { dmg: 0.75, def: 1.35 },
};

// Combat v2 — Special actions
export const AIM_ACCURACY_BONUS = 0.50;
export const AIM_DISABLE_CHANCE = 0.35;
export const AIM_DISABLE_ROUNDS = 2;
export const EVADE_CHANCE = 0.50;
export const EMP_HIT_CHANCE = 0.75;
export const EMP_DISABLE_ROUNDS = 2;

// Combat v2 — General
export const COMBAT_V2_MAX_ROUNDS = 5;
export const COMBAT_V2_ROLL_MIN = 0.85;
export const COMBAT_V2_ROLL_MAX = 1.15;

// Station defense
export const STATION_BASE_HP = 500;
export const STATION_REPAIR_CR_PER_HP = 5;
export const STATION_REPAIR_ORE_PER_HP = 1;
export const STATION_COMBAT_MAX_ROUNDS = 10;

export const STATION_DEFENSE_DEFS: Record<string, {
  damage?: number;
  shieldHp?: number;
  shieldRegen?: number;
  oncePer?: 'combat';
  bypassShields?: boolean;
  cost: { credits: number; ore?: number; crystal?: number; gas?: number };
}> = {
  defense_turret_mk1: { damage: 15, cost: { credits: 500, ore: 50 } },
  defense_turret_mk2: { damage: 30, cost: { credits: 1500, ore: 100, crystal: 20 } },
  defense_turret_mk3: { damage: 50, cost: { credits: 4000, ore: 200, crystal: 60 } },
  station_shield_mk1: { shieldHp: 150, shieldRegen: 10, cost: { credits: 1000, crystal: 50 } },
  station_shield_mk2: { shieldHp: 350, shieldRegen: 25, cost: { credits: 3000, crystal: 100, gas: 30 } },
  ion_cannon: { damage: 80, oncePer: 'combat', bypassShields: true, cost: { credits: 8000, ore: 300, crystal: 100, gas: 50 } },
};

export const MAX_ACTIVE_QUESTS = 3;
export const QUEST_EXPIRY_DAYS = 7;

export const SCAN_EVENT_CHANCE = 0.15;

export const XP_LEVELS: Record<number, number> = {
  1: 0, 2: 100, 3: 300, 4: 600, 5: 1000,
  6: 1500, 7: 2200, 8: 3000, 9: 4000, 10: 5000,
};

// Storage tiers
export const STORAGE_TIERS: Record<number, { capacity: number; upgradeCost: number }> = {
  1: { capacity: 50, upgradeCost: 0 },
  2: { capacity: 150, upgradeCost: 200 },
  3: { capacity: 500, upgradeCost: 1000 },
};

// Trading Post tiers
export const TRADING_POST_TIERS: Record<number, { name: string; upgradeCost: number }> = {
  1: { name: 'NPC TRADE', upgradeCost: 0 },
  2: { name: 'MARKTPLATZ', upgradeCost: 500 },
  3: { name: 'AUTO-TRADE', upgradeCost: 3000 },
};

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
  commRange: number;
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
    commRange: 50,
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
    commRange: 200,
  },
};

// --- Phase 7: Ship Designer ---
export const HULLS: Record<HullType, HullDefinition> = {
  scout: {
    name: 'VOID SCOUT', size: 'small', slots: 3,
    baseFuel: 80, baseCargo: 3, baseJumpRange: 5, baseApPerJump: 1, baseFuelPerJump: 1,
    baseHp: 50, baseCommRange: 50, baseScannerLevel: 1,
    unlockLevel: 1, unlockCost: 0,
  },
  freighter: {
    name: 'VOID FREIGHTER', size: 'medium', slots: 4,
    baseFuel: 120, baseCargo: 15, baseJumpRange: 3, baseApPerJump: 2, baseFuelPerJump: 2,
    baseHp: 80, baseCommRange: 75, baseScannerLevel: 1,
    unlockLevel: 3, unlockCost: 500,
  },
  cruiser: {
    name: 'VOID CRUISER', size: 'medium', slots: 4,
    baseFuel: 150, baseCargo: 8, baseJumpRange: 4, baseApPerJump: 1, baseFuelPerJump: 1,
    baseHp: 100, baseCommRange: 100, baseScannerLevel: 1,
    unlockLevel: 4, unlockCost: 1000,
  },
  explorer: {
    name: 'VOID EXPLORER', size: 'large', slots: 5,
    baseFuel: 200, baseCargo: 10, baseJumpRange: 6, baseApPerJump: 1, baseFuelPerJump: 1,
    baseHp: 70, baseCommRange: 150, baseScannerLevel: 2,
    unlockLevel: 5, unlockCost: 2000,
  },
  battleship: {
    name: 'VOID BATTLESHIP', size: 'large', slots: 5,
    baseFuel: 180, baseCargo: 5, baseJumpRange: 2, baseApPerJump: 2, baseFuelPerJump: 3,
    baseHp: 150, baseCommRange: 75, baseScannerLevel: 1,
    unlockLevel: 6, unlockCost: 3000,
  },
};

export const MODULES: Record<string, ModuleDefinition> = {
  drive_mk1: {
    id: 'drive_mk1', category: 'drive', tier: 1,
    name: 'ION DRIVE MK.I', displayName: 'ION MK.I',
    effects: { jumpRange: 1 },
    cost: { credits: 100, ore: 10 },
  },
  drive_mk2: {
    id: 'drive_mk2', category: 'drive', tier: 2,
    name: 'ION DRIVE MK.II', displayName: 'ION MK.II',
    effects: { jumpRange: 2, apCostJump: -0.2 },
    cost: { credits: 300, ore: 20, crystal: 5 },
  },
  drive_mk3: {
    id: 'drive_mk3', category: 'drive', tier: 3,
    name: 'ION DRIVE MK.III', displayName: 'ION MK.III',
    effects: { jumpRange: 3, apCostJump: -0.5 },
    cost: { credits: 800, ore: 40, crystal: 15 },
  },
  cargo_mk1: {
    id: 'cargo_mk1', category: 'cargo', tier: 1,
    name: 'CARGO BAY MK.I', displayName: 'CARGO MK.I',
    effects: { cargoCap: 5 },
    cost: { credits: 80 },
  },
  cargo_mk2: {
    id: 'cargo_mk2', category: 'cargo', tier: 2,
    name: 'CARGO BAY MK.II', displayName: 'CARGO MK.II',
    effects: { cargoCap: 12 },
    cost: { credits: 250, ore: 15 },
  },
  cargo_mk3: {
    id: 'cargo_mk3', category: 'cargo', tier: 3,
    name: 'CARGO BAY MK.III', displayName: 'CARGO MK.III',
    effects: { cargoCap: 25 },
    cost: { credits: 600, ore: 30, gas: 10 },
  },
  scanner_mk1: {
    id: 'scanner_mk1', category: 'scanner', tier: 1,
    name: 'SCANNER MK.I', displayName: 'SCAN MK.I',
    effects: { scannerLevel: 1 },
    cost: { credits: 120, crystal: 5 },
  },
  scanner_mk2: {
    id: 'scanner_mk2', category: 'scanner', tier: 2,
    name: 'SCANNER MK.II', displayName: 'SCAN MK.II',
    effects: { scannerLevel: 1, commRange: 50 },
    cost: { credits: 350, crystal: 15 },
  },
  scanner_mk3: {
    id: 'scanner_mk3', category: 'scanner', tier: 3,
    name: 'SCANNER MK.III', displayName: 'SCAN MK.III',
    effects: { scannerLevel: 2, commRange: 100 },
    cost: { credits: 900, crystal: 30, gas: 10 },
  },
  armor_mk1: {
    id: 'armor_mk1', category: 'armor', tier: 1,
    name: 'ARMOR PLATING MK.I', displayName: 'ARM MK.I',
    effects: { hp: 25 },
    cost: { credits: 100, ore: 15 },
  },
  armor_mk2: {
    id: 'armor_mk2', category: 'armor', tier: 2,
    name: 'ARMOR PLATING MK.II', displayName: 'ARM MK.II',
    effects: { hp: 50, damageMod: -0.10 },
    cost: { credits: 300, ore: 30, crystal: 10 },
  },
  armor_mk3: {
    id: 'armor_mk3', category: 'armor', tier: 3,
    name: 'ARMOR PLATING MK.III', displayName: 'ARM MK.III',
    effects: { hp: 100, damageMod: -0.25 },
    cost: { credits: 800, ore: 50, crystal: 25 },
  },
  // Weapon modules
  laser_mk1: {
    id: 'laser_mk1', category: 'weapon', tier: 1,
    name: 'PULS-LASER MK.I', displayName: 'LASER MK.I',
    effects: { weaponAttack: 8, weaponType: 'laser' as any },
    cost: { credits: 150, crystal: 10 },
  },
  laser_mk2: {
    id: 'laser_mk2', category: 'weapon', tier: 2,
    name: 'PULS-LASER MK.II', displayName: 'LASER MK.II',
    effects: { weaponAttack: 16, weaponType: 'laser' as any },
    cost: { credits: 450, crystal: 25, gas: 10 },
  },
  laser_mk3: {
    id: 'laser_mk3', category: 'weapon', tier: 3,
    name: 'PULS-LASER MK.III', displayName: 'LASER MK.III',
    effects: { weaponAttack: 28, weaponType: 'laser' as any },
    cost: { credits: 1200, crystal: 50, gas: 20 },
  },
  railgun_mk1: {
    id: 'railgun_mk1', category: 'weapon', tier: 1,
    name: 'RAIL-KANONE MK.I', displayName: 'RAIL MK.I',
    effects: { weaponAttack: 12, weaponPiercing: 0.30, weaponType: 'railgun' as any },
    cost: { credits: 300, ore: 30, crystal: 15 },
  },
  railgun_mk2: {
    id: 'railgun_mk2', category: 'weapon', tier: 2,
    name: 'RAIL-KANONE MK.II', displayName: 'RAIL MK.II',
    effects: { weaponAttack: 22, weaponPiercing: 0.50, weaponType: 'railgun' as any },
    cost: { credits: 900, ore: 60, crystal: 30 },
  },
  missile_mk1: {
    id: 'missile_mk1', category: 'weapon', tier: 1,
    name: 'RAKETEN-POD MK.I', displayName: 'RAKET MK.I',
    effects: { weaponAttack: 18, weaponType: 'missile' as any },
    cost: { credits: 250, ore: 20, crystal: 5 },
  },
  missile_mk2: {
    id: 'missile_mk2', category: 'weapon', tier: 2,
    name: 'RAKETEN-POD MK.II', displayName: 'RAKET MK.II',
    effects: { weaponAttack: 30, weaponType: 'missile' as any },
    cost: { credits: 750, ore: 40, crystal: 15 },
  },
  emp_array: {
    id: 'emp_array', category: 'weapon', tier: 2,
    name: 'EMP-EMITTER', displayName: 'EMP',
    effects: { weaponAttack: 0, weaponType: 'emp' as any },
    cost: { credits: 500, crystal: 20, gas: 20 },
  },
  // Shield modules
  shield_mk1: {
    id: 'shield_mk1', category: 'shield', tier: 1,
    name: 'SCHILD-GEN MK.I', displayName: 'SHLD MK.I',
    effects: { shieldHp: 30, shieldRegen: 3 },
    cost: { credits: 200, crystal: 15 },
  },
  shield_mk2: {
    id: 'shield_mk2', category: 'shield', tier: 2,
    name: 'SCHILD-GEN MK.II', displayName: 'SHLD MK.II',
    effects: { shieldHp: 60, shieldRegen: 6 },
    cost: { credits: 600, crystal: 35, gas: 10 },
  },
  shield_mk3: {
    id: 'shield_mk3', category: 'shield', tier: 3,
    name: 'SCHILD-GEN MK.III', displayName: 'SHLD MK.III',
    effects: { shieldHp: 100, shieldRegen: 12 },
    cost: { credits: 1500, crystal: 70, gas: 25 },
  },
  // Defensive modules
  point_defense: {
    id: 'point_defense', category: 'defense', tier: 2,
    name: 'PUNKT-VERTEIDIGUNG', displayName: 'PD',
    effects: { pointDefense: 0.60 },
    cost: { credits: 350, ore: 20, crystal: 10 },
  },
  ecm_suite: {
    id: 'ecm_suite', category: 'defense', tier: 2,
    name: 'ECM-SUITE', displayName: 'ECM',
    effects: { ecmReduction: 0.15 },
    cost: { credits: 400, crystal: 25, gas: 15 },
  },
};

export const SECTOR_COLORS: Record<SectorType | 'home_base', string> = {
  empty: '#FFB000',
  asteroid_field: '#FF8C00',
  nebula: '#00BFFF',
  station: '#00FF88',
  anomaly: '#FF00FF',
  pirate: '#FF3333',
  home_base: '#FFFFFF',
};

export const SPAWN_MIN_DISTANCE = 10_000_000;
export const SPAWN_DISTANCE_VARIANCE = 2_000_000;
export const SPAWN_CLUSTER_RADIUS = 300; // wider clusters so group members have some distance
export const SPAWN_CLUSTER_MAX_PLAYERS = 5;
export const ANCIENT_STATION_CHANCE = 0.15; // 15% of stations are ancient/special variants

// Nebula zone system — seed-based blob generation
export const NEBULA_ZONE_GRID = 300;    // coarse grid spacing (sectors) for nebula zone centers
export const NEBULA_ZONE_CHANCE = 0.08; // 8% of grid cells become nebula centers
export const NEBULA_ZONE_MIN_RADIUS = 15; // minimum zone radius in sectors
export const NEBULA_ZONE_MAX_RADIUS = 50; // maximum zone radius in sectors
export const NEBULA_SAFE_ORIGIN = 200;  // no nebula zones within this many sectors of origin

// Hull-specific pixel patterns for radar rendering (3x3 grids, 1 = filled pixel)
export const HULL_RADAR_PATTERNS: Record<HullType, number[][]> = {
  scout:      [[0,1,0], [1,1,1], [0,1,0]],    // cross — nimble interceptor
  freighter:  [[1,1,1], [1,1,1], [0,1,0]],    // wide body + single thruster
  cruiser:    [[1,0,1], [1,1,1], [0,1,0]],    // spread wings + fuselage + tail
  explorer:   [[0,1,0], [0,1,0], [1,1,1]],    // tall forward sensor array
  battleship: [[1,1,1], [1,1,1], [1,0,1]],    // heavy armored block + dual thrusters
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
    dim: 'rgba(255, 176, 0, 0.6)',
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
  COMMS: 'COMMS',
  BASE_LINK: 'BASE-LINK',
  LOG: 'LOG',
  TRADE: 'TRADE',
  FACTION: 'FACTION',
  QUESTS: 'QUESTS',
} as const;

export type MonitorId = typeof MONITORS[keyof typeof MONITORS];

export const RIGHT_SIDEBAR_MONITORS: MonitorId[] = [
  MONITORS.SHIP_SYS,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
  MONITORS.TRADE,
  MONITORS.FACTION,
  MONITORS.QUESTS,
];

export const LEFT_SIDEBAR_MONITORS: MonitorId[] = [
  MONITORS.LOG,
  MONITORS.SHIP_SYS,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
  MONITORS.TRADE,
  MONITORS.FACTION,
  MONITORS.QUESTS,
];

export const MAIN_MONITORS: MonitorId[] = [
  MONITORS.NAV_COM,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
  MONITORS.TRADE,
  MONITORS.FACTION,
  MONITORS.QUESTS,
];

/** @deprecated Use RIGHT_SIDEBAR_MONITORS instead */
export const SIDEBAR_MONITORS = RIGHT_SIDEBAR_MONITORS;

// --- Phase 5: Deep Systems ---

// Fuel
export const FUEL_COST_PER_UNIT = 2;
export const FREE_REFUEL_MAX_SHIPS = 3;

// Faction Upgrade Tree
export const FACTION_UPGRADE_TIERS: Record<number, {
  optionA: { name: string; effect: string; };
  optionB: { name: string; effect: string; };
  cost: number;
}> = {
  1: {
    optionA: { name: 'MINING BOOST', effect: '+15% mining rate' },
    optionB: { name: 'CARGO EXPANSION', effect: '+3 cargo capacity' },
    cost: 500,
  },
  2: {
    optionA: { name: 'SCAN RANGE', effect: '+1 area scan radius' },
    optionB: { name: 'AP REGEN', effect: '+20% AP regeneration' },
    cost: 1500,
  },
  3: {
    optionA: { name: 'COMBAT BONUS', effect: '+15% combat bonus' },
    optionB: { name: 'TRADE DISCOUNT', effect: '-10% NPC trade prices' },
    cost: 5000,
  },
};

// JumpGates
export const JUMPGATE_CHANCE = 0.02;
export const JUMPGATE_SALT = 777;
export const JUMPGATE_FUEL_COST = 1;
export const JUMPGATE_MIN_RANGE = 50;
export const JUMPGATE_MAX_RANGE = 10000;
export const JUMPGATE_CODE_LENGTH = 8;
export const JUMPGATE_MINIGAME_CHANCE = 0.3;
export const JUMPGATE_CODE_CHANCE = 0.5;
export const FREQUENCY_MATCH_THRESHOLD = 0.9;

// Rescue Missions
export const RESCUE_AP_COST = 5;
export const RESCUE_DELIVER_AP_COST = 3;
export const RESCUE_EXPIRY_MINUTES = 30;
export const DISTRESS_CALL_CHANCE = 0.08;
export const DISTRESS_DIRECTION_VARIANCE = 0.3;
export const RESCUE_REWARDS = {
  scan_event: { credits: 50, rep: 10, xp: 25 },
  npc_quest: { credits: 80, rep: 15, xp: 40 },
  comm_distress: { credits: 100, rep: 20, xp: 50 },
} as const;

// Trade Routes
export const MAX_TRADE_ROUTES = 3;
export const TRADE_ROUTE_MIN_CYCLE = 15;
export const TRADE_ROUTE_MAX_CYCLE = 120;
export const TRADE_ROUTE_FUEL_PER_DISTANCE = 0.5;

// Custom Data Slates
export const CUSTOM_SLATE_AP_COST = 2;
export const CUSTOM_SLATE_CREDIT_COST = 5;
export const CUSTOM_SLATE_MAX_COORDS = 20;
export const CUSTOM_SLATE_MAX_CODES = 10;
export const CUSTOM_SLATE_MAX_NOTES_LENGTH = 500;

// Multi-content sectors
export const SECTOR_MAX_FEATURES = 3;

// Emergency Warp (Notruf)
export const EMERGENCY_WARP_FREE_RADIUS = 200;      // free within 200 Manhattan distance of home base
export const EMERGENCY_WARP_CREDIT_PER_SECTOR = 5;   // credits per sector beyond free radius
export const EMERGENCY_WARP_FUEL_GRANT = 10;          // fuel granted after emergency warp

// Hyperjump Navigation
export const HYPERJUMP_AP_DISCOUNT = 0.5;   // 50% AP cost for known routes
export const HYPERJUMP_PIRATE_FUEL_PENALTY = 1.5; // 50% extra fuel for pirate sectors
export const AUTOPILOT_STEP_MS = 100;       // ms per sector during autopilot
export const STALENESS_DIM_HOURS = 24;      // dim sectors after 24h
export const STALENESS_FADE_DAYS = 7;       // coords-only after 7 days
