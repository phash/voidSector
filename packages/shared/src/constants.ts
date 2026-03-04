import type { SectorType, ShipClass, ResourceType, MineableResourceType, StructureType, HullType, HullDefinition, ModuleDefinition, SectorEnvironment, SectorContent, ProductionRecipe } from './types.js';

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

export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<MineableResourceType, number>> = {
  empty:          { ore: 0,  gas: 0,  crystal: 0  },
  nebula:         { ore: 2,  gas: 20, crystal: 3  },
  asteroid_field: { ore: 20, gas: 2,  crystal: 3  },
  anomaly:        { ore: 3,  gas: 3,  crystal: 20 },
  station:        { ore: 0,  gas: 0,  crystal: 0  },
  pirate:         { ore: 8,  gas: 3,  crystal: 8  },
};

export const MINING_RATE_PER_SECOND = 0.1;

export const RESOURCE_TYPES: MineableResourceType[] = ['ore', 'gas', 'crystal'];

export const STRUCTURE_COSTS: Record<StructureType, Record<MineableResourceType, number>> = {
  comm_relay: { ore: 5, gas: 0, crystal: 2 },
  mining_station: { ore: 30, gas: 15, crystal: 10 },
  base: { ore: 50, gas: 30, crystal: 25 },
  storage: { ore: 20, gas: 10, crystal: 5 },
  trading_post: { ore: 30, gas: 20, crystal: 15 },
  defense_turret: { ore: 40, gas: 10, crystal: 20 },
  station_shield: { ore: 30, gas: 25, crystal: 30 },
  ion_cannon: { ore: 60, gas: 30, crystal: 40 },
  factory: { ore: 40, gas: 20, crystal: 15 },
  research_lab: { ore: 30, gas: 25, crystal: 30 },
  kontor: { ore: 20, gas: 10, crystal: 10 },
};

export const STRUCTURE_AP_COSTS: Record<StructureType, number> = {
  comm_relay: 5,
  mining_station: 15,
  base: 25,
  storage: 10,
  trading_post: 15,
  defense_turret: 20,
  station_shield: 20,
  ion_cannon: 25,
  factory: 20,
  research_lab: 25,
  kontor: 15,
};

export const RELAY_RANGES: Record<StructureType, number> = {
  comm_relay: 500,
  mining_station: 500,
  base: 1000,
  storage: 0,
  trading_post: 0,
  defense_turret: 0,
  station_shield: 0,
  ion_cannon: 0,
  factory: 0,
  research_lab: 0,
  kontor: 0,
};

// NPC Trade Prices (base prices per unit in credits)
export const NPC_PRICES: Record<MineableResourceType, number> = {
  ore: 10,
  gas: 15,
  crystal: 25,
};

export const NPC_BUY_SPREAD = 1.2;
export const NPC_SELL_SPREAD = 0.8;

// NPC Station Levels
export const NPC_STATION_LEVELS = [
  { level: 1, name: 'Outpost',     maxStock: 200,   xpThreshold: 0 },
  { level: 2, name: 'Station',     maxStock: 500,   xpThreshold: 500 },
  { level: 3, name: 'Hub',         maxStock: 1200,  xpThreshold: 2000 },
  { level: 4, name: 'Port',        maxStock: 3000,  xpThreshold: 6000 },
  { level: 5, name: 'Megastation', maxStock: 8000,  xpThreshold: 15000 },
] as const;

// --- Production Recipes (Factory) ---
export const PRODUCTION_RECIPES: ProductionRecipe[] = [
  // Basic (no research needed)
  { id: 'fuel_cell_basic', outputItem: 'fuel_cell', outputAmount: 1,
    inputs: [{ resource: 'ore', amount: 2 }, { resource: 'gas', amount: 3 }],
    cycleSeconds: 120, researchRequired: null },
  { id: 'alloy_plate_basic', outputItem: 'alloy_plate', outputAmount: 1,
    inputs: [{ resource: 'ore', amount: 3 }, { resource: 'crystal', amount: 1 }],
    cycleSeconds: 180, researchRequired: null },
  // Researchable
  { id: 'circuit_board_t1', outputItem: 'circuit_board', outputAmount: 1,
    inputs: [{ resource: 'crystal', amount: 2 }, { resource: 'gas', amount: 2 }],
    cycleSeconds: 240, researchRequired: 'circuit_board_t1' },
  { id: 'void_shard_t1', outputItem: 'void_shard', outputAmount: 1,
    inputs: [{ resource: 'crystal', amount: 3 }, { resource: 'ore', amount: 2 }],
    cycleSeconds: 300, researchRequired: 'void_shard_t1' },
  { id: 'bio_extract_t1', outputItem: 'bio_extract', outputAmount: 1,
    inputs: [{ resource: 'gas', amount: 4 }, { resource: 'crystal', amount: 1 }],
    cycleSeconds: 360, researchRequired: 'bio_extract_t1' },
];

export const NPC_XP_DECAY_PER_HOUR = 1;
export const NPC_XP_VISIT = 5;
export const NPC_XP_PER_TRADE_UNIT = 1;
export const NPC_XP_QUEST_COMPLETE = 15;

// Artefact drop chances
export const ARTEFACT_DROP_CHANCES = {
  artifact_find_event: 0.50,  // 50% on artifact_find scan event (vs crystal)
  anomaly_scan: 0.08,         // 8% bonus on anomaly_reading
  pirate_loot: 0.03,          // 3% on pirate victory
} as const;

// Artefact UI constants
export const ARTEFACT_COLOR = '#FF6B35';
export const ARTEFACT_SYMBOL = '\u273B'; // ❋

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
    baseEngineSpeed: 2,
    baseHyperdriveRange: 0, baseHyperdriveSpeed: 0, baseHyperdriveRegen: 0, baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 1, unlockCost: 0,
  },
  freighter: {
    name: 'VOID FREIGHTER', size: 'medium', slots: 4,
    baseFuel: 120, baseCargo: 15, baseJumpRange: 3, baseApPerJump: 2, baseFuelPerJump: 2,
    baseHp: 80, baseCommRange: 75, baseScannerLevel: 1,
    baseEngineSpeed: 1,
    baseHyperdriveRange: 0, baseHyperdriveSpeed: 0, baseHyperdriveRegen: 0, baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 3, unlockCost: 500,
  },
  cruiser: {
    name: 'VOID CRUISER', size: 'medium', slots: 4,
    baseFuel: 150, baseCargo: 8, baseJumpRange: 4, baseApPerJump: 1, baseFuelPerJump: 1,
    baseHp: 100, baseCommRange: 100, baseScannerLevel: 1,
    baseEngineSpeed: 2,
    baseHyperdriveRange: 0, baseHyperdriveSpeed: 0, baseHyperdriveRegen: 0, baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 4, unlockCost: 1000,
  },
  explorer: {
    name: 'VOID EXPLORER', size: 'large', slots: 5,
    baseFuel: 200, baseCargo: 10, baseJumpRange: 6, baseApPerJump: 1, baseFuelPerJump: 1,
    baseHp: 70, baseCommRange: 150, baseScannerLevel: 2,
    baseEngineSpeed: 2,
    baseHyperdriveRange: 0, baseHyperdriveSpeed: 0, baseHyperdriveRegen: 0, baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 5, unlockCost: 2000,
  },
  battleship: {
    name: 'VOID BATTLESHIP', size: 'large', slots: 5,
    baseFuel: 180, baseCargo: 5, baseJumpRange: 2, baseApPerJump: 2, baseFuelPerJump: 3,
    baseHp: 150, baseCommRange: 75, baseScannerLevel: 1,
    baseEngineSpeed: 1,
    baseHyperdriveRange: 0, baseHyperdriveSpeed: 0, baseHyperdriveRegen: 0, baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 6, unlockCost: 3000,
  },
};

export const MODULES: Record<string, ModuleDefinition> = {
  // === DRIVE ===
  drive_mk1: {
    id: 'drive_mk1', category: 'drive', tier: 1,
    name: 'ION DRIVE MK.I', displayName: 'ION MK.I',
    primaryEffect: { stat: 'jumpRange', delta: 1, label: 'Sprungweite +1' },
    secondaryEffects: [{ stat: 'engineSpeed', delta: 1, label: 'Engine-Speed +1' }],
    effects: { jumpRange: 1, engineSpeed: 1, hyperdriveRange: 4, hyperdriveSpeed: 2, hyperdriveRegen: 1.0 },
    cost: { credits: 100, ore: 10 },
  },
  drive_mk2: {
    id: 'drive_mk2', category: 'drive', tier: 2,
    name: 'ION DRIVE MK.II', displayName: 'ION MK.II',
    primaryEffect: { stat: 'jumpRange', delta: 2, label: 'Sprungweite +2' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 2, label: 'Engine-Speed +2' },
      { stat: 'apCostJump', delta: -0.2, label: 'AP/Sprung -0.2' },
    ],
    effects: { jumpRange: 2, apCostJump: -0.2, engineSpeed: 2, hyperdriveRange: 8, hyperdriveSpeed: 3, hyperdriveRegen: 1.5, hyperdriveFuelEfficiency: 0.1 },
    cost: { credits: 300, ore: 20, crystal: 5 },
    researchCost: { credits: 200, ore: 15 },
    researchDurationMin: 5,
    prerequisite: 'drive_mk1',
  },
  drive_mk3: {
    id: 'drive_mk3', category: 'drive', tier: 3,
    name: 'ION DRIVE MK.III', displayName: 'ION MK.III',
    primaryEffect: { stat: 'jumpRange', delta: 3, label: 'Sprungweite +3' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 3, label: 'Engine-Speed +3' },
      { stat: 'apCostJump', delta: -0.5, label: 'AP/Sprung -0.5' },
    ],
    effects: { jumpRange: 3, apCostJump: -0.5, engineSpeed: 3, hyperdriveRange: 16, hyperdriveSpeed: 5, hyperdriveRegen: 2.0, hyperdriveFuelEfficiency: 0.2 },
    cost: { credits: 800, ore: 40, crystal: 15 },
    researchCost: { credits: 500, ore: 30, crystal: 10, artefact: 2 },
    researchDurationMin: 12,
    prerequisite: 'drive_mk2',
  },

  // === CARGO ===
  cargo_mk1: {
    id: 'cargo_mk1', category: 'cargo', tier: 1,
    name: 'CARGO BAY MK.I', displayName: 'CARGO MK.I',
    primaryEffect: { stat: 'cargoCap', delta: 5, label: 'Frachtraum +5' },
    secondaryEffects: [],
    effects: { cargoCap: 5 },
    cost: { credits: 80 },
  },
  cargo_mk2: {
    id: 'cargo_mk2', category: 'cargo', tier: 2,
    name: 'CARGO BAY MK.II', displayName: 'CARGO MK.II',
    primaryEffect: { stat: 'cargoCap', delta: 12, label: 'Frachtraum +12' },
    secondaryEffects: [{ stat: 'safeSlotBonus', delta: 1, label: 'Safe-Slot +1' }],
    effects: { cargoCap: 12, safeSlotBonus: 1 },
    cost: { credits: 250, ore: 15 },
    researchCost: { credits: 150, ore: 10 },
    researchDurationMin: 5,
    prerequisite: 'cargo_mk1',
  },
  cargo_mk3: {
    id: 'cargo_mk3', category: 'cargo', tier: 3,
    name: 'CARGO BAY MK.III', displayName: 'CARGO MK.III',
    primaryEffect: { stat: 'cargoCap', delta: 25, label: 'Frachtraum +25' },
    secondaryEffects: [
      { stat: 'safeSlotBonus', delta: 2, label: 'Safe-Slot +2' },
      { stat: 'fuelMax', delta: 20, label: 'Fuel-Tank +20' },
    ],
    effects: { cargoCap: 25, safeSlotBonus: 2, fuelMax: 20 },
    cost: { credits: 600, ore: 30, gas: 10 },
    researchCost: { credits: 400, ore: 25, artefact: 1 },
    researchDurationMin: 10,
    prerequisite: 'cargo_mk2',
  },

  // === SCANNER ===
  scanner_mk1: {
    id: 'scanner_mk1', category: 'scanner', tier: 1,
    name: 'SCANNER MK.I', displayName: 'SCAN MK.I',
    primaryEffect: { stat: 'scannerLevel', delta: 1, label: 'Scan-Level +1' },
    secondaryEffects: [],
    effects: { scannerLevel: 1 },
    cost: { credits: 120, crystal: 5 },
  },
  scanner_mk2: {
    id: 'scanner_mk2', category: 'scanner', tier: 2,
    name: 'SCANNER MK.II', displayName: 'SCAN MK.II',
    primaryEffect: { stat: 'scannerLevel', delta: 1, label: 'Scan-Level +1' },
    secondaryEffects: [{ stat: 'commRange', delta: 50, label: 'Komm-Reichweite +50' }],
    effects: { scannerLevel: 1, commRange: 50 },
    cost: { credits: 350, crystal: 15 },
    researchCost: { credits: 200, crystal: 10 },
    researchDurationMin: 5,
    prerequisite: 'scanner_mk1',
  },
  scanner_mk3: {
    id: 'scanner_mk3', category: 'scanner', tier: 3,
    name: 'SCANNER MK.III', displayName: 'SCAN MK.III',
    primaryEffect: { stat: 'scannerLevel', delta: 2, label: 'Scan-Level +2' },
    secondaryEffects: [
      { stat: 'commRange', delta: 100, label: 'Komm-Reichweite +100' },
      { stat: 'artefactChanceBonus', delta: 0.03, label: 'Artefakt-Chance +3%' },
    ],
    effects: { scannerLevel: 2, commRange: 100, artefactChanceBonus: 0.03 },
    cost: { credits: 900, crystal: 30, gas: 10 },
    researchCost: { credits: 600, crystal: 20, artefact: 3 },
    researchDurationMin: 15,
    prerequisite: 'scanner_mk2',
  },

  // === ARMOR ===
  armor_mk1: {
    id: 'armor_mk1', category: 'armor', tier: 1,
    name: 'ARMOR PLATING MK.I', displayName: 'ARM MK.I',
    primaryEffect: { stat: 'hp', delta: 25, label: 'HP +25' },
    secondaryEffects: [],
    effects: { hp: 25 },
    cost: { credits: 100, ore: 15 },
  },
  armor_mk2: {
    id: 'armor_mk2', category: 'armor', tier: 2,
    name: 'ARMOR PLATING MK.II', displayName: 'ARM MK.II',
    primaryEffect: { stat: 'hp', delta: 50, label: 'HP +50' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.10, label: 'Schadensreduktion -10%' }],
    effects: { hp: 50, damageMod: -0.10 },
    cost: { credits: 300, ore: 30, crystal: 10 },
    researchCost: { credits: 200, ore: 20 },
    researchDurationMin: 5,
    prerequisite: 'armor_mk1',
  },
  armor_mk3: {
    id: 'armor_mk3', category: 'armor', tier: 3,
    name: 'ARMOR PLATING MK.III', displayName: 'ARM MK.III',
    primaryEffect: { stat: 'hp', delta: 100, label: 'HP +100' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.25, label: 'Schadensreduktion -25%' }],
    effects: { hp: 100, damageMod: -0.25 },
    cost: { credits: 800, ore: 50, crystal: 25 },
    researchCost: { credits: 500, ore: 40, artefact: 2 },
    researchDurationMin: 12,
    prerequisite: 'armor_mk2',
  },

  // === WEAPONS ===
  laser_mk1: {
    id: 'laser_mk1', category: 'weapon', tier: 1,
    name: 'PULS-LASER MK.I', displayName: 'LASER MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 8, label: 'ATK +8' },
    secondaryEffects: [],
    effects: { weaponAttack: 8, weaponType: 'laser' as any },
    cost: { credits: 150, crystal: 10 },
    researchCost: { credits: 200, crystal: 10 },
    researchDurationMin: 5,
  },
  laser_mk2: {
    id: 'laser_mk2', category: 'weapon', tier: 2,
    name: 'PULS-LASER MK.II', displayName: 'LASER MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 16, label: 'ATK +16' },
    secondaryEffects: [],
    effects: { weaponAttack: 16, weaponType: 'laser' as any },
    cost: { credits: 450, crystal: 25, gas: 10 },
    researchCost: { credits: 600, crystal: 25, gas: 10 },
    researchDurationMin: 10,
    prerequisite: 'laser_mk1',
  },
  laser_mk3: {
    id: 'laser_mk3', category: 'weapon', tier: 3,
    name: 'PULS-LASER MK.III', displayName: 'LASER MK.III',
    primaryEffect: { stat: 'weaponAttack', delta: 28, label: 'ATK +28' },
    secondaryEffects: [],
    effects: { weaponAttack: 28, weaponType: 'laser' as any },
    cost: { credits: 1200, crystal: 50, gas: 20 },
    researchCost: { credits: 1500, crystal: 50, gas: 20 },
    researchDurationMin: 18,
    prerequisite: 'laser_mk2',
  },
  railgun_mk1: {
    id: 'railgun_mk1', category: 'weapon', tier: 1,
    name: 'RAIL-KANONE MK.I', displayName: 'RAIL MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 12, label: 'ATK +12' },
    secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.30, label: 'Panzerbrechend 30%' }],
    effects: { weaponAttack: 12, weaponPiercing: 0.30, weaponType: 'railgun' as any },
    cost: { credits: 300, ore: 30, crystal: 15 },
    researchCost: { credits: 400, ore: 30, crystal: 15 },
    researchDurationMin: 8,
    prerequisite: 'laser_mk1',
  },
  railgun_mk2: {
    id: 'railgun_mk2', category: 'weapon', tier: 2,
    name: 'RAIL-KANONE MK.II', displayName: 'RAIL MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 22, label: 'ATK +22' },
    secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.50, label: 'Panzerbrechend 50%' }],
    effects: { weaponAttack: 22, weaponPiercing: 0.50, weaponType: 'railgun' as any },
    cost: { credits: 900, ore: 60, crystal: 30 },
    researchCost: { credits: 1000, ore: 60, crystal: 30, artefact: 1 },
    researchDurationMin: 15,
    prerequisite: 'railgun_mk1',
  },
  missile_mk1: {
    id: 'missile_mk1', category: 'weapon', tier: 1,
    name: 'RAKETEN-POD MK.I', displayName: 'RAKET MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 18, label: 'ATK +18' },
    secondaryEffects: [],
    effects: { weaponAttack: 18, weaponType: 'missile' as any },
    cost: { credits: 250, ore: 20, crystal: 5 },
    researchCost: { credits: 300, ore: 20, crystal: 5 },
    researchDurationMin: 7,
  },
  missile_mk2: {
    id: 'missile_mk2', category: 'weapon', tier: 2,
    name: 'RAKETEN-POD MK.II', displayName: 'RAKET MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 30, label: 'ATK +30' },
    secondaryEffects: [],
    effects: { weaponAttack: 30, weaponType: 'missile' as any },
    cost: { credits: 750, ore: 40, crystal: 15 },
    researchCost: { credits: 900, ore: 40, crystal: 15 },
    researchDurationMin: 12,
    prerequisite: 'missile_mk1',
  },
  emp_array: {
    id: 'emp_array', category: 'weapon', tier: 2,
    name: 'EMP-EMITTER', displayName: 'EMP',
    primaryEffect: { stat: 'weaponAttack', delta: 0, label: 'EMP (kein Schaden)' },
    secondaryEffects: [],
    effects: { weaponAttack: 0, weaponType: 'emp' as any },
    cost: { credits: 500, crystal: 20, gas: 20 },
    researchCost: { credits: 600, crystal: 20, gas: 20, artefact: 2 },
    researchDurationMin: 12,
    prerequisite: 'laser_mk2',
  },

  // === SHIELDS ===
  shield_mk1: {
    id: 'shield_mk1', category: 'shield', tier: 1,
    name: 'SCHILD-GEN MK.I', displayName: 'SHLD MK.I',
    primaryEffect: { stat: 'shieldHp', delta: 30, label: 'Schild +30' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 3, label: 'Schild-Regen +3' }],
    effects: { shieldHp: 30, shieldRegen: 3 },
    cost: { credits: 200, crystal: 15 },
    researchCost: { credits: 300, crystal: 15 },
    researchDurationMin: 7,
    prerequisite: 'armor_mk1',
  },
  shield_mk2: {
    id: 'shield_mk2', category: 'shield', tier: 2,
    name: 'SCHILD-GEN MK.II', displayName: 'SHLD MK.II',
    primaryEffect: { stat: 'shieldHp', delta: 60, label: 'Schild +60' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 6, label: 'Schild-Regen +6' }],
    effects: { shieldHp: 60, shieldRegen: 6 },
    cost: { credits: 600, crystal: 35, gas: 10 },
    researchCost: { credits: 700, crystal: 35, gas: 10, artefact: 2 },
    researchDurationMin: 15,
    prerequisite: 'shield_mk1',
  },
  shield_mk3: {
    id: 'shield_mk3', category: 'shield', tier: 3,
    name: 'SCHILD-GEN MK.III', displayName: 'SHLD MK.III',
    primaryEffect: { stat: 'shieldHp', delta: 100, label: 'Schild +100' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 12, label: 'Schild-Regen +12' }],
    effects: { shieldHp: 100, shieldRegen: 12 },
    cost: { credits: 1500, crystal: 70, gas: 25 },
    researchCost: { credits: 1500, crystal: 70, gas: 25 },
    researchDurationMin: 20,
    prerequisite: 'shield_mk2',
  },

  // === DEFENSE ===
  point_defense: {
    id: 'point_defense', category: 'defense', tier: 2,
    name: 'PUNKT-VERTEIDIGUNG', displayName: 'PD',
    primaryEffect: { stat: 'pointDefense', delta: 0.60, label: 'Punkt-Verteidigung 60%' },
    secondaryEffects: [],
    effects: { pointDefense: 0.60 },
    cost: { credits: 350, ore: 20, crystal: 10 },
    researchCost: { credits: 400, ore: 20, crystal: 10 },
    researchDurationMin: 8,
    prerequisite: 'armor_mk2',
  },
  ecm_suite: {
    id: 'ecm_suite', category: 'defense', tier: 2,
    name: 'ECM-SUITE', displayName: 'ECM',
    primaryEffect: { stat: 'ecmReduction', delta: 0.15, label: 'ECM -15% feindl. Genauigkeit' },
    secondaryEffects: [],
    effects: { ecmReduction: 0.15 },
    cost: { credits: 400, crystal: 25, gas: 15 },
    researchCost: { credits: 500, crystal: 25, gas: 15 },
    researchDurationMin: 10,
    prerequisite: 'scanner_mk2',
  },

  // === SPEZIAL-MODULE ===
  void_drive: {
    id: 'void_drive', category: 'drive', tier: 3,
    name: 'VOID DRIVE', displayName: 'VOID',
    primaryEffect: { stat: 'jumpRange', delta: 6, label: 'Sprungweite +6' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 5, label: 'Engine-Speed MAX' },
      { stat: 'fuelPerJump', delta: -3, label: 'Fuel/Sprung -3' },
    ],
    effects: { jumpRange: 6, engineSpeed: 5, fuelPerJump: -3, hyperdriveRange: 30, hyperdriveSpeed: 8, hyperdriveRegen: 3.0, hyperdriveFuelEfficiency: 0.35 },
    cost: { credits: 2000, artefact: 5 },
    researchCost: { credits: 2000, artefact: 10 },
    researchDurationMin: 30,
    prerequisite: 'drive_mk3',
    factionRequirement: { factionId: 'ancients', minTier: 'honored' },
  },
  quantum_scanner: {
    id: 'quantum_scanner', category: 'scanner', tier: 3,
    name: 'QUANTUM-SCANNER', displayName: 'Q-SCAN',
    primaryEffect: { stat: 'scannerLevel', delta: 3, label: 'Scan-Level +3' },
    secondaryEffects: [
      { stat: 'commRange', delta: 200, label: 'Komm-Reichweite +200' },
      { stat: 'artefactChanceBonus', delta: 0.05, label: 'Artefakt-Chance +5%' },
    ],
    effects: { scannerLevel: 3, commRange: 200, artefactChanceBonus: 0.05 },
    cost: { credits: 1500, crystal: 50 },
    researchCost: { credits: 1500, crystal: 50, artefact: 8 },
    researchDurationMin: 25,
    prerequisite: 'scanner_mk3',
  },
  nano_armor: {
    id: 'nano_armor', category: 'armor', tier: 3,
    name: 'NANO-PANZERUNG', displayName: 'NANO',
    primaryEffect: { stat: 'hp', delta: 150, label: 'HP +150' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.35, label: 'Schadensreduktion -35%' }],
    effects: { hp: 150, damageMod: -0.35 },
    cost: { credits: 1800, ore: 50, crystal: 50 },
    researchCost: { credits: 1800, ore: 50, crystal: 50, artefact: 15 },
    researchDurationMin: 30,
    prerequisite: 'armor_mk3',
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

// Two-stage worldgen: environment weights (first roll).
// Weights intentionally sum to 0.70; the remaining 0.30 gap falls through
// to 'empty' as the default in rollEnvironment().
export const ENVIRONMENT_WEIGHTS: Record<string, number> = {
  empty: 0.55,
  nebula: 0.15,
  // black_hole is handled separately via BLACK_HOLE_SPAWN_CHANCE
};

// Two-stage worldgen: content weights (second roll, for non-blackhole)
export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.57,
  asteroid_field: 0.20,
  pirate: 0.10,
  anomaly: 0.05,
  station: 0.08,
};

// Black hole generation
export const BLACK_HOLE_SPAWN_CHANCE = 0.005;    // 0.5% of sectors far from origin
export const BLACK_HOLE_MIN_DISTANCE = 50;        // minimum Chebyshev distance from origin
export const BLACK_HOLE_CLUSTER_GRID = 200;       // coarse grid spacing for cluster centers
export const BLACK_HOLE_CLUSTER_CHANCE = 0.003;   // chance a grid cell is a cluster center
export const BLACK_HOLE_CLUSTER_MIN_RADIUS = 0;   // minimum cluster radius (0 = single sector)
export const BLACK_HOLE_CLUSTER_MAX_RADIUS = 4;   // maximum cluster radius (4 = up to 9x9)

// Nebula content toggle — when true, nebula sectors get a content roll
export const NEBULA_CONTENT_ENABLED = true;

// Environment modifiers
export const NEBULA_SCANNER_MALUS = 1;            // -1 sector scan range in nebula
export const NEBULA_PIRATE_SPAWN_MODIFIER = 0.7;  // -30% pirate spawn in nebula
export const EMPTY_FUEL_MODIFIER = 0.8;           // -20% fuel cost in empty space

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

// Environment-specific radar colors
export const ENVIRONMENT_COLORS: Record<SectorEnvironment, string> = {
  empty: '#FFB000',
  nebula: '#00BFFF',
  black_hole: '#1A1A1A',
};

// Environment-specific radar symbols
export const ENVIRONMENT_SYMBOLS: Record<SectorEnvironment, string> = {
  empty: '\u00B7',     // ·
  nebula: '\u2592',    // ▒
  black_hole: 'o',
};

// Content overlay symbols for radar
export const CONTENT_SYMBOLS: Partial<Record<SectorContent, string>> = {
  asteroid_field: '\u25C6', // ◆
  station: 'S',
  home_base: 'H',
  player_base: 'B',
  anomaly: '\u25CA',        // ◊
  pirate_zone: '\u2620',    // ☠
};

// Content overlay colors
export const CONTENT_COLORS: Partial<Record<SectorContent, string>> = {
  asteroid_field: '#FF8C00',
  station: '#00FF88',
  anomaly: '#FF00FF',
  pirate_zone: '#FF3333',
  home_base: '#FFFFFF',
  player_base: '#FFFFFF',
};

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
  TECH: 'TECH',
  QUAD_MAP: 'QUAD-MAP',
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
  MONITORS.TECH,
  MONITORS.QUAD_MAP,
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
  MONITORS.TECH,
  MONITORS.QUAD_MAP,
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
  MONITORS.TECH,
  MONITORS.QUAD_MAP,
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
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export const EMERGENCY_WARP_FREE_RADIUS = 200;      // free within 200 Manhattan distance of home base
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export const EMERGENCY_WARP_CREDIT_PER_SECTOR = 5;   // credits per sector beyond free radius
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export const EMERGENCY_WARP_FUEL_GRANT = 10;          // fuel granted after emergency warp
export const FEATURE_EMERGENCY_WARP = false;

// Hyperjump Navigation
export const HYPERJUMP_AP_DISCOUNT = 0.5;   // 50% AP cost for known routes (legacy)
export const HYPERJUMP_PIRATE_FUEL_PENALTY = 1.5; // 50% extra fuel for pirate sectors

// --- Fuel Rework (#94): only hyperjumps cost fuel ---
export const HYPERJUMP_FUEL_PER_SECTOR = 1;   // base fuel cost per sector of hyperjump distance
export const SCAN_FUEL_COST = 0;               // scans are free (#94)
export const MINE_FUEL_COST = 0;               // mining is free (#94)

// Hull-specific fuel multiplier for hyperjumps
export const HULL_FUEL_MULTIPLIER: Record<HullType, number> = {
  scout: 0.8,
  freighter: 1.2,
  cruiser: 1.0,
  explorer: 0.9,
  battleship: 1.5,
};

// Normal jump constants
export const JUMP_NORMAL_AP_COST = 1;
export const JUMP_NORMAL_FUEL_COST = 0;
export const JUMP_NORMAL_MAX_RANGE = 1;

// Hyperjump AP formula constants
export const HYPERJUMP_BASE_AP = 5;
export const HYPERJUMP_AP_PER_SPEED = 1;
export const HYPERJUMP_MIN_AP = 1;

// Hyperjump fuel scaling
export const HYPERJUMP_FUEL_DIST_FACTOR = 0.1;
export const HYPERJUMP_FUEL_MAX_FACTOR = 2.0;

// Engine-Speed mapping (drive module → speed level)
export const ENGINE_SPEED: Record<string, number> = {
  none: 1,
  drive_mk1: 2,
  drive_mk2: 3,
  drive_mk3: 4,
  void_drive: 5,
};
// Research system
export const RESEARCH_TICK_MS = 60_000; // 1 tick = 1 minute

export const AUTOPILOT_STEP_MS = 100;       // ms per sector during autopilot
export const STALENESS_DIM_HOURS = 24;      // dim sectors after 24h
export const STALENESS_FADE_DAYS = 7;       // coords-only after 7 days

export const QUADRANT_SIZE = 10_000;
export const SPAWN_QUADRANT_DISTANCE = 10_000_000;
export const SPAWN_QUADRANT_BAND = 10;
export const SPAWN_CLUSTER_MAX_PLAYERS_QUAD = 5;
export const QUADRANT_NAME_MAX_LENGTH = 24;
export const QUADRANT_NAME_MIN_LENGTH = 3;
