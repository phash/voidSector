import type {
  SectorType,
  ShipClass,
  ResourceType,
  MineableResourceType,
  StructureType,
  HullType,
  HullDefinition,
  ModuleDefinition,
  SectorEnvironment,
  SectorContent,
  ProductionRecipe,
} from './types.js';

export const SECTOR_TYPES: SectorType[] = [
  'empty',
  'nebula',
  'asteroid_field',
  'station',
  'anomaly',
  'pirate',
];

export const SECTOR_WEIGHTS: Record<SectorType, number> = {
  empty: 0.55,
  asteroid_field: 0.15,
  nebula: 0.1,
  anomaly: 0.08,
  station: 0.05,
  pirate: 0.07,
};

export const AP_DEFAULTS = {
  max: 100,
  startingAP: 100,
  regenPerSecond: 0.5, // 1 AP every 2 seconds
};

export const AP_COSTS = {
  jump: 1, // base/default jump cost when no ship context is available
  scan: 3,
  mine: 0,
  // per-ship jump cost comes from ship.apCostJump
};

export const AP_COSTS_BY_SCANNER: Record<number, { areaScan: number; areaScanRadius: number }> = {
  1: { areaScan: 3, areaScanRadius: 3 },
  2: { areaScan: 6, areaScanRadius: 6 },
  3: { areaScan: 10, areaScanRadius: 9 },
  4: { areaScan: 14, areaScanRadius: 12 },
  5: { areaScan: 18, areaScanRadius: 15 },
};

export const AP_COSTS_LOCAL_SCAN = 1;

export const WORLD_SEED = 77;

export const RADAR_RADIUS = 3; // visible sectors around player on scan

export const RECONNECTION_TIMEOUT_S = 15;

export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<MineableResourceType, number>> = {
  empty: { ore: 0, gas: 0, crystal: 0 },
  nebula: { ore: 0, gas: 30, crystal: 5 },
  asteroid_field: { ore: 50, gas: 0, crystal: 8 },
  anomaly: { ore: 3, gas: 3, crystal: 20 },
  station: { ore: 0, gas: 0, crystal: 0 },
  pirate: { ore: 8, gas: 3, crystal: 8 },
};

export const MINING_RATE_PER_SECOND = 1;

export const RESOURCE_REGEN_PER_MINUTE = 1;
export const CRYSTAL_REGEN_PER_MINUTE = 1 / 3;
export const RESOURCE_REGEN_DELAY_MINUTES = 5;

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
  jumpgate: { ore: 0, gas: 0, crystal: 20 },
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
  jumpgate: 10,
};

// ── Research Lab / Wissen ─────────────────────────────────────────────

/** Base Wissen generation per hour by research lab tier (1–5) */
export const RESEARCH_LAB_WISSEN_RATE: Record<number, number> = {
  1: 5, // Grundlabor
  2: 12, // Forschungslabor
  3: 25, // Analysestation
  4: 45, // Forschungsturm
  5: 80, // Observatorium
};

export const RESEARCH_LAB_NAMES: Record<number, string> = {
  1: 'GRUNDLABOR',
  2: 'FORSCHUNGSLABOR',
  3: 'ANALYSESTATION',
  4: 'FORSCHUNGSTURM',
  5: 'OBSERVATORIUM',
};

/** Maximum research lab tier */
export const RESEARCH_LAB_MAX_TIER = 5;

/** Lab tier required to research modules of each module tier */
export const RESEARCH_LAB_TIER_FOR_MODULE_TIER: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

/** Wissen multipliers by sector type/environment present in the station's sector */
export const WISSEN_SECTOR_MULTIPLIERS: Record<string, number> = {
  asteroid_field: 1.2,
  nebula: 1.5,
  anomaly: 2.0,
  black_hole_adjacent: 2.5,
  ancient_jumpgate: 5.0,
};

/** Base Wissen cost to research a module, by module tier */
export const WISSEN_COST_BY_TIER: Record<number, number> = {
  1: 100,
  2: 300,
  3: 800,
  4: 2000,
  5: 5000,
};

/** Required artefacts (matching module category) per module tier */
export const ARTEFACT_REQUIRED_BY_TIER: Record<number, number> = {
  1: 0,
  2: 0,
  3: 1,
  4: 2,
  5: 3,
};

/** Wissen cost reduction per matching artefact used */
export const ARTEFACT_WISSEN_BONUS = 500;

/** Research time reduction per matching artefact used (fraction, e.g. 0.1 = 10%) */
export const ARTEFACT_TIME_BONUS_PER = 0.1;

/** Maximum artefacts that can be used per research */
export const MAX_ARTEFACTS_PER_RESEARCH = 3;

/** Credits + material cost to upgrade research lab to the given tier */
export const RESEARCH_LAB_UPGRADE_COSTS: Record<
  number,
  { credits: number; ore: number; crystal: number }
> = {
  2: { credits: 500, ore: 30, crystal: 20 },
  3: { credits: 1200, ore: 60, crystal: 40 },
  4: { credits: 2500, ore: 100, crystal: 80 },
  5: { credits: 5000, ore: 150, crystal: 120 },
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
  jumpgate: 0,
};

// Player Jumpgate costs
export const JUMPGATE_BUILD_COST = { credits: 500, crystal: 20, artefact: 5 };
export const JUMPGATE_UPGRADE_COSTS: Record<string, Record<string, number>> = {
  connection_2: { credits: 300, ore: 15, artefact: 3 },
  connection_3: { credits: 800, ore: 30, artefact: 8 },
  distance_2: { credits: 300, crystal: 15, artefact: 3 },
  distance_3: { credits: 800, crystal: 30, artefact: 8 },
};

export const JUMPGATE_DISTANCE_LIMITS: Record<number, number> = {
  1: 250,
  2: 500,
  3: 2500,
};

export const JUMPGATE_CONNECTION_LIMITS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
};

export const JUMPGATE_MAX_CHAIN_HOPS = 10;

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
  { level: 1, name: 'Outpost', maxStock: 200, xpThreshold: 0 },
  { level: 2, name: 'Station', maxStock: 500, xpThreshold: 500 },
  { level: 3, name: 'Hub', maxStock: 1200, xpThreshold: 2000 },
  { level: 4, name: 'Port', maxStock: 3000, xpThreshold: 6000 },
  { level: 5, name: 'Megastation', maxStock: 8000, xpThreshold: 15000 },
] as const;

// --- Production Recipes (Factory) ---
export const PRODUCTION_RECIPES: ProductionRecipe[] = [
  // Basic (no research needed)
  {
    id: 'fuel_cell_basic',
    outputItem: 'fuel_cell',
    outputAmount: 1,
    inputs: [
      { resource: 'ore', amount: 2 },
      { resource: 'gas', amount: 3 },
    ],
    cycleSeconds: 120,
    researchRequired: null,
  },
  {
    id: 'alloy_plate_basic',
    outputItem: 'alloy_plate',
    outputAmount: 1,
    inputs: [
      { resource: 'ore', amount: 3 },
      { resource: 'crystal', amount: 1 },
    ],
    cycleSeconds: 180,
    researchRequired: null,
  },
  // Researchable
  {
    id: 'circuit_board_t1',
    outputItem: 'circuit_board',
    outputAmount: 1,
    inputs: [
      { resource: 'crystal', amount: 2 },
      { resource: 'gas', amount: 2 },
    ],
    cycleSeconds: 240,
    researchRequired: 'circuit_board_t1',
  },
  {
    id: 'void_shard_t1',
    outputItem: 'void_shard',
    outputAmount: 1,
    inputs: [
      { resource: 'crystal', amount: 3 },
      { resource: 'ore', amount: 2 },
    ],
    cycleSeconds: 300,
    researchRequired: 'void_shard_t1',
  },
  {
    id: 'bio_extract_t1',
    outputItem: 'bio_extract',
    outputAmount: 1,
    inputs: [
      { resource: 'gas', amount: 4 },
      { resource: 'crystal', amount: 1 },
    ],
    cycleSeconds: 360,
    researchRequired: 'bio_extract_t1',
  },
];

export const NPC_XP_DECAY_PER_HOUR = 1;
export const NPC_XP_VISIT = 5;
export const NPC_XP_PER_TRADE_UNIT = 1;
export const NPC_XP_QUEST_COMPLETE = 15;

// Artefact drop chances
export const ARTEFACT_DROP_CHANCES = {
  artifact_find_event: 0.5, // 50% on artifact_find scan event (vs crystal)
  anomaly_scan: 0.08, // 8% bonus on anomaly_reading
  pirate_loot: 0.03, // 3% on pirate victory
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
  independent: 0.3,
  traders: 0.28,
  scientists: 0.25,
  pirates: 0.16,
  ancients: 0.01,
};

export const REP_TIERS: Record<string, { min: number; max: number }> = {
  hostile: { min: -100, max: -51 },
  unfriendly: { min: -50, max: -1 },
  neutral: { min: 0, max: 0 },
  friendly: { min: 1, max: 50 },
  honored: { min: 51, max: 100 },
};

export const REP_PRICE_MODIFIERS: Record<string, number> = {
  hostile: 1.5,
  unfriendly: 1.0,
  neutral: 1.0,
  friendly: 0.9,
  honored: 0.75,
};

export const FACTION_UPGRADES: Record<string, { factionId: string; name: string; effect: string }> =
  {
    cargo_expansion: { factionId: 'traders', name: 'CARGO EXPANSION', effect: '+3 cargo capacity' },
    advanced_scanner: {
      factionId: 'scientists',
      name: 'ADVANCED SCANNER',
      effect: '+1 areaScan radius',
    },
    combat_plating: { factionId: 'pirates', name: 'COMBAT PLATING', effect: '+20% combat bonus' },
    void_drive: { factionId: 'ancients', name: 'VOID DRIVE', effect: '-1 AP movement cost' },
  };

export const BATTLE_AP_COST_FLEE = 2;
export const BATTLE_CARGO_LOSS_MIN = 0.25;
export const BATTLE_CARGO_LOSS_MAX = 0.5;
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

// Hyperdrive v2 — Feature flag (charge-based hyperdrive system)
export const FEATURE_HYPERDRIVE_V2 = false;

// Combat v2 — Tactic multipliers
export const TACTIC_MODS: Record<string, { dmg: number; def: number }> = {
  assault: { dmg: 1.3, def: 0.8 },
  balanced: { dmg: 1.0, def: 1.0 },
  defensive: { dmg: 0.75, def: 1.35 },
};

// Combat v2 — Special actions
export const AIM_ACCURACY_BONUS = 0.5;
export const AIM_DISABLE_CHANCE = 0.35;
export const AIM_DISABLE_ROUNDS = 2;
export const EVADE_CHANCE = 0.5;
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

export const STATION_DEFENSE_DEFS: Record<
  string,
  {
    damage?: number;
    shieldHp?: number;
    shieldRegen?: number;
    oncePer?: 'combat';
    bypassShields?: boolean;
    cost: { credits: number; ore?: number; crystal?: number; gas?: number };
  }
> = {
  defense_turret_mk1: { damage: 15, cost: { credits: 500, ore: 50 } },
  defense_turret_mk2: { damage: 30, cost: { credits: 1500, ore: 100, crystal: 20 } },
  defense_turret_mk3: { damage: 50, cost: { credits: 4000, ore: 200, crystal: 60 } },
  station_shield_mk1: { shieldHp: 150, shieldRegen: 10, cost: { credits: 1000, crystal: 50 } },
  station_shield_mk2: {
    shieldHp: 350,
    shieldRegen: 25,
    cost: { credits: 3000, crystal: 100, gas: 30 },
  },
  ion_cannon: {
    damage: 80,
    oncePer: 'combat',
    bypassShields: true,
    cost: { credits: 8000, ore: 300, crystal: 100, gas: 50 },
  },
};

export const MAX_ACTIVE_QUESTS = 3;
export const QUEST_EXPIRY_DAYS = 7;

export const SCAN_EVENT_CHANCE = 0.15;

export const XP_LEVELS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
  6: 1500,
  7: 2200,
  8: 3000,
  9: 4000,
  10: 5000,
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
export const SHIP_CLASSES: Record<
  ShipClass,
  {
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
  }
> = {
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
    name: 'VOID SCOUT',
    size: 'small',
    slots: 3,
    baseFuel: 80,
    baseCargo: 3,
    baseJumpRange: 5,
    baseApPerJump: 1,
    baseFuelPerJump: 1,
    baseHp: 50,
    baseCommRange: 50,
    baseScannerLevel: 1,
    baseEngineSpeed: 2,
    baseHyperdriveRange: 0,
    baseHyperdriveSpeed: 0,
    baseHyperdriveRegen: 0,
    baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 1,
    unlockCost: 0,
  },
  freighter: {
    name: 'VOID FREIGHTER',
    size: 'medium',
    slots: 4,
    baseFuel: 120,
    baseCargo: 15,
    baseJumpRange: 3,
    baseApPerJump: 2,
    baseFuelPerJump: 2,
    baseHp: 80,
    baseCommRange: 75,
    baseScannerLevel: 1,
    baseEngineSpeed: 1,
    baseHyperdriveRange: 0,
    baseHyperdriveSpeed: 0,
    baseHyperdriveRegen: 0,
    baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 3,
    unlockCost: 500,
  },
  cruiser: {
    name: 'VOID CRUISER',
    size: 'medium',
    slots: 4,
    baseFuel: 150,
    baseCargo: 8,
    baseJumpRange: 4,
    baseApPerJump: 1,
    baseFuelPerJump: 1,
    baseHp: 100,
    baseCommRange: 100,
    baseScannerLevel: 1,
    baseEngineSpeed: 2,
    baseHyperdriveRange: 0,
    baseHyperdriveSpeed: 0,
    baseHyperdriveRegen: 0,
    baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 4,
    unlockCost: 1000,
  },
  explorer: {
    name: 'VOID EXPLORER',
    size: 'large',
    slots: 5,
    baseFuel: 200,
    baseCargo: 10,
    baseJumpRange: 6,
    baseApPerJump: 1,
    baseFuelPerJump: 1,
    baseHp: 70,
    baseCommRange: 150,
    baseScannerLevel: 2,
    baseEngineSpeed: 2,
    baseHyperdriveRange: 0,
    baseHyperdriveSpeed: 0,
    baseHyperdriveRegen: 0,
    baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 5,
    unlockCost: 2000,
  },
  battleship: {
    name: 'VOID BATTLESHIP',
    size: 'large',
    slots: 5,
    baseFuel: 180,
    baseCargo: 5,
    baseJumpRange: 2,
    baseApPerJump: 2,
    baseFuelPerJump: 3,
    baseHp: 150,
    baseCommRange: 75,
    baseScannerLevel: 1,
    baseEngineSpeed: 1,
    baseHyperdriveRange: 0,
    baseHyperdriveSpeed: 0,
    baseHyperdriveRegen: 0,
    baseHyperdriveFuelEfficiency: 0,
    unlockLevel: 6,
    unlockCost: 3000,
  },
};

export const MODULES: Record<string, ModuleDefinition> = {
  // === DRIVE ===
  drive_mk1: {
    id: 'drive_mk1',
    category: 'drive',
    tier: 1,
    name: 'ION DRIVE MK.I',
    displayName: 'ION MK.I',
    primaryEffect: { stat: 'jumpRange', delta: 1, label: 'Sprungweite +1' },
    secondaryEffects: [{ stat: 'engineSpeed', delta: 1, label: 'Engine-Speed +1' }],
    effects: {
      jumpRange: 1,
      engineSpeed: 1,
      hyperdriveRange: 4,
      hyperdriveSpeed: 2,
      hyperdriveRegen: 1.0,
    },
    cost: { credits: 100, ore: 10 },
  },
  drive_mk2: {
    id: 'drive_mk2',
    category: 'drive',
    tier: 2,
    name: 'ION DRIVE MK.II',
    displayName: 'ION MK.II',
    primaryEffect: { stat: 'jumpRange', delta: 2, label: 'Sprungweite +2' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 2, label: 'Engine-Speed +2' },
      { stat: 'apCostJump', delta: -0.2, label: 'AP/Sprung -0.2' },
    ],
    effects: {
      jumpRange: 2,
      apCostJump: -0.2,
      engineSpeed: 2,
      hyperdriveRange: 8,
      hyperdriveSpeed: 3,
      hyperdriveRegen: 1.5,
      hyperdriveFuelEfficiency: 0.1,
    },
    cost: { credits: 300, ore: 20, crystal: 5 },
    researchCost: { wissen: 300 },
    researchDurationMin: 5,
    prerequisite: 'drive_mk1',
  },
  drive_mk3: {
    id: 'drive_mk3',
    category: 'drive',
    tier: 3,
    name: 'ION DRIVE MK.III',
    displayName: 'ION MK.III',
    primaryEffect: { stat: 'jumpRange', delta: 3, label: 'Sprungweite +3' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 3, label: 'Engine-Speed +3' },
      { stat: 'apCostJump', delta: -0.5, label: 'AP/Sprung -0.5' },
    ],
    effects: {
      jumpRange: 3,
      apCostJump: -0.5,
      engineSpeed: 3,
      hyperdriveRange: 16,
      hyperdriveSpeed: 5,
      hyperdriveRegen: 2.0,
      hyperdriveFuelEfficiency: 0.2,
    },
    cost: { credits: 800, ore: 40, crystal: 15 },
    researchCost: { wissen: 800, artefacts: { drive: 1 } },
    researchDurationMin: 12,
    prerequisite: 'drive_mk2',
  },

  // === CARGO ===
  cargo_mk1: {
    id: 'cargo_mk1',
    category: 'cargo',
    tier: 1,
    name: 'CARGO BAY MK.I',
    displayName: 'CARGO MK.I',
    primaryEffect: { stat: 'cargoCap', delta: 5, label: 'Frachtraum +5' },
    secondaryEffects: [],
    effects: { cargoCap: 5 },
    cost: { credits: 80 },
  },
  cargo_mk2: {
    id: 'cargo_mk2',
    category: 'cargo',
    tier: 2,
    name: 'CARGO BAY MK.II',
    displayName: 'CARGO MK.II',
    primaryEffect: { stat: 'cargoCap', delta: 12, label: 'Frachtraum +12' },
    secondaryEffects: [{ stat: 'safeSlotBonus', delta: 1, label: 'Safe-Slot +1' }],
    effects: { cargoCap: 12, safeSlotBonus: 1 },
    cost: { credits: 250, ore: 15 },
    researchCost: { wissen: 300 },
    researchDurationMin: 5,
    prerequisite: 'cargo_mk1',
  },
  cargo_mk3: {
    id: 'cargo_mk3',
    category: 'cargo',
    tier: 3,
    name: 'CARGO BAY MK.III',
    displayName: 'CARGO MK.III',
    primaryEffect: { stat: 'cargoCap', delta: 25, label: 'Frachtraum +25' },
    secondaryEffects: [
      { stat: 'safeSlotBonus', delta: 2, label: 'Safe-Slot +2' },
      { stat: 'fuelMax', delta: 20, label: 'Fuel-Tank +20' },
    ],
    effects: { cargoCap: 25, safeSlotBonus: 2, fuelMax: 20 },
    cost: { credits: 600, ore: 30, gas: 10 },
    researchCost: { wissen: 800, artefacts: { cargo: 1 } },
    researchDurationMin: 10,
    prerequisite: 'cargo_mk2',
  },

  // === SCANNER ===
  scanner_mk1: {
    id: 'scanner_mk1',
    category: 'scanner',
    tier: 1,
    name: 'SCANNER MK.I',
    displayName: 'SCAN MK.I',
    primaryEffect: { stat: 'scannerLevel', delta: 1, label: 'Scan-Level +1' },
    secondaryEffects: [],
    effects: { scannerLevel: 1 },
    cost: { credits: 120, crystal: 5 },
  },
  scanner_mk2: {
    id: 'scanner_mk2',
    category: 'scanner',
    tier: 2,
    name: 'SCANNER MK.II',
    displayName: 'SCAN MK.II',
    primaryEffect: { stat: 'scannerLevel', delta: 1, label: 'Scan-Level +1' },
    secondaryEffects: [{ stat: 'commRange', delta: 50, label: 'Komm-Reichweite +50' }],
    effects: { scannerLevel: 1, commRange: 50 },
    cost: { credits: 350, crystal: 15 },
    researchCost: { wissen: 300 },
    researchDurationMin: 5,
    prerequisite: 'scanner_mk1',
  },
  scanner_mk3: {
    id: 'scanner_mk3',
    category: 'scanner',
    tier: 3,
    name: 'SCANNER MK.III',
    displayName: 'SCAN MK.III',
    primaryEffect: { stat: 'scannerLevel', delta: 2, label: 'Scan-Level +2' },
    secondaryEffects: [
      { stat: 'commRange', delta: 100, label: 'Komm-Reichweite +100' },
      { stat: 'artefactChanceBonus', delta: 0.03, label: 'Artefakt-Chance +3%' },
    ],
    effects: { scannerLevel: 2, commRange: 100, artefactChanceBonus: 0.03 },
    cost: { credits: 900, crystal: 30, gas: 10 },
    researchCost: { wissen: 800, artefacts: { scanner: 1 } },
    researchDurationMin: 15,
    prerequisite: 'scanner_mk2',
  },

  // === ARMOR ===
  armor_mk1: {
    id: 'armor_mk1',
    category: 'armor',
    tier: 1,
    name: 'ARMOR PLATING MK.I',
    displayName: 'ARM MK.I',
    primaryEffect: { stat: 'hp', delta: 25, label: 'HP +25' },
    secondaryEffects: [],
    effects: { hp: 25 },
    cost: { credits: 100, ore: 15 },
  },
  armor_mk2: {
    id: 'armor_mk2',
    category: 'armor',
    tier: 2,
    name: 'ARMOR PLATING MK.II',
    displayName: 'ARM MK.II',
    primaryEffect: { stat: 'hp', delta: 50, label: 'HP +50' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.1, label: 'Schadensreduktion -10%' }],
    effects: { hp: 50, damageMod: -0.1 },
    cost: { credits: 300, ore: 30, crystal: 10 },
    researchCost: { wissen: 300 },
    researchDurationMin: 5,
    prerequisite: 'armor_mk1',
  },
  armor_mk3: {
    id: 'armor_mk3',
    category: 'armor',
    tier: 3,
    name: 'ARMOR PLATING MK.III',
    displayName: 'ARM MK.III',
    primaryEffect: { stat: 'hp', delta: 100, label: 'HP +100' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.25, label: 'Schadensreduktion -25%' }],
    effects: { hp: 100, damageMod: -0.25 },
    cost: { credits: 800, ore: 50, crystal: 25 },
    researchCost: { wissen: 800, artefacts: { armor: 1 } },
    researchDurationMin: 12,
    prerequisite: 'armor_mk2',
  },

  // === WEAPONS ===
  laser_mk1: {
    id: 'laser_mk1',
    category: 'weapon',
    tier: 1,
    name: 'PULS-LASER MK.I',
    displayName: 'LASER MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 8, label: 'ATK +8' },
    secondaryEffects: [],
    effects: { weaponAttack: 8, weaponType: 'laser' as any },
    cost: { credits: 150, crystal: 10 },
    researchCost: { wissen: 100 },
    researchDurationMin: 5,
  },
  laser_mk2: {
    id: 'laser_mk2',
    category: 'weapon',
    tier: 2,
    name: 'PULS-LASER MK.II',
    displayName: 'LASER MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 16, label: 'ATK +16' },
    secondaryEffects: [],
    effects: { weaponAttack: 16, weaponType: 'laser' as any },
    cost: { credits: 450, crystal: 25, gas: 10 },
    researchCost: { wissen: 300 },
    researchDurationMin: 10,
    prerequisite: 'laser_mk1',
  },
  laser_mk3: {
    id: 'laser_mk3',
    category: 'weapon',
    tier: 3,
    name: 'PULS-LASER MK.III',
    displayName: 'LASER MK.III',
    primaryEffect: { stat: 'weaponAttack', delta: 28, label: 'ATK +28' },
    secondaryEffects: [],
    effects: { weaponAttack: 28, weaponType: 'laser' as any },
    cost: { credits: 1200, crystal: 50, gas: 20 },
    researchCost: { wissen: 800, artefacts: { weapon: 1 } },
    researchDurationMin: 18,
    prerequisite: 'laser_mk2',
  },
  railgun_mk1: {
    id: 'railgun_mk1',
    category: 'weapon',
    tier: 1,
    name: 'RAIL-KANONE MK.I',
    displayName: 'RAIL MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 12, label: 'ATK +12' },
    secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.3, label: 'Panzerbrechend 30%' }],
    effects: { weaponAttack: 12, weaponPiercing: 0.3, weaponType: 'railgun' as any },
    cost: { credits: 300, ore: 30, crystal: 15 },
    researchCost: { wissen: 100 },
    researchDurationMin: 8,
    prerequisite: 'laser_mk1',
  },
  railgun_mk2: {
    id: 'railgun_mk2',
    category: 'weapon',
    tier: 2,
    name: 'RAIL-KANONE MK.II',
    displayName: 'RAIL MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 22, label: 'ATK +22' },
    secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.5, label: 'Panzerbrechend 50%' }],
    effects: { weaponAttack: 22, weaponPiercing: 0.5, weaponType: 'railgun' as any },
    cost: { credits: 900, ore: 60, crystal: 30 },
    researchCost: { wissen: 300 },
    researchDurationMin: 15,
    prerequisite: 'railgun_mk1',
  },
  missile_mk1: {
    id: 'missile_mk1',
    category: 'weapon',
    tier: 1,
    name: 'RAKETEN-POD MK.I',
    displayName: 'RAKET MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 18, label: 'ATK +18' },
    secondaryEffects: [],
    effects: { weaponAttack: 18, weaponType: 'missile' as any },
    cost: { credits: 250, ore: 20, crystal: 5 },
    researchCost: { wissen: 100 },
    researchDurationMin: 7,
  },
  missile_mk2: {
    id: 'missile_mk2',
    category: 'weapon',
    tier: 2,
    name: 'RAKETEN-POD MK.II',
    displayName: 'RAKET MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 30, label: 'ATK +30' },
    secondaryEffects: [],
    effects: { weaponAttack: 30, weaponType: 'missile' as any },
    cost: { credits: 750, ore: 40, crystal: 15 },
    researchCost: { wissen: 300 },
    researchDurationMin: 12,
    prerequisite: 'missile_mk1',
  },
  emp_array: {
    id: 'emp_array',
    category: 'weapon',
    tier: 2,
    name: 'EMP-EMITTER',
    displayName: 'EMP',
    primaryEffect: { stat: 'weaponAttack', delta: 0, label: 'EMP (kein Schaden)' },
    secondaryEffects: [],
    effects: { weaponAttack: 0, weaponType: 'emp' as any },
    cost: { credits: 500, crystal: 20, gas: 20 },
    researchCost: { wissen: 300 },
    researchDurationMin: 12,
    prerequisite: 'laser_mk2',
  },

  // === SHIELDS ===
  shield_mk1: {
    id: 'shield_mk1',
    category: 'shield',
    tier: 1,
    name: 'SCHILD-GEN MK.I',
    displayName: 'SHLD MK.I',
    primaryEffect: { stat: 'shieldHp', delta: 30, label: 'Schild +30' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 3, label: 'Schild-Regen +3' }],
    effects: { shieldHp: 30, shieldRegen: 3 },
    cost: { credits: 200, crystal: 15 },
    researchCost: { wissen: 100 },
    researchDurationMin: 7,
    prerequisite: 'armor_mk1',
  },
  shield_mk2: {
    id: 'shield_mk2',
    category: 'shield',
    tier: 2,
    name: 'SCHILD-GEN MK.II',
    displayName: 'SHLD MK.II',
    primaryEffect: { stat: 'shieldHp', delta: 60, label: 'Schild +60' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 6, label: 'Schild-Regen +6' }],
    effects: { shieldHp: 60, shieldRegen: 6 },
    cost: { credits: 600, crystal: 35, gas: 10 },
    researchCost: { wissen: 300 },
    researchDurationMin: 15,
    prerequisite: 'shield_mk1',
  },
  shield_mk3: {
    id: 'shield_mk3',
    category: 'shield',
    tier: 3,
    name: 'SCHILD-GEN MK.III',
    displayName: 'SHLD MK.III',
    primaryEffect: { stat: 'shieldHp', delta: 100, label: 'Schild +100' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 12, label: 'Schild-Regen +12' }],
    effects: { shieldHp: 100, shieldRegen: 12 },
    cost: { credits: 1500, crystal: 70, gas: 25 },
    researchCost: { wissen: 800, artefacts: { shield: 1 } },
    researchDurationMin: 20,
    prerequisite: 'shield_mk2',
  },

  // === DEFENSE ===
  point_defense: {
    id: 'point_defense',
    category: 'defense',
    tier: 2,
    name: 'PUNKT-VERTEIDIGUNG',
    displayName: 'PD',
    primaryEffect: { stat: 'pointDefense', delta: 0.6, label: 'Punkt-Verteidigung 60%' },
    secondaryEffects: [],
    effects: { pointDefense: 0.6 },
    cost: { credits: 350, ore: 20, crystal: 10 },
    researchCost: { wissen: 300 },
    researchDurationMin: 8,
    prerequisite: 'armor_mk2',
  },
  ecm_suite: {
    id: 'ecm_suite',
    category: 'defense',
    tier: 2,
    name: 'ECM-SUITE',
    displayName: 'ECM',
    primaryEffect: { stat: 'ecmReduction', delta: 0.15, label: 'ECM -15% feindl. Genauigkeit' },
    secondaryEffects: [],
    effects: { ecmReduction: 0.15 },
    cost: { credits: 400, crystal: 25, gas: 15 },
    researchCost: { wissen: 300 },
    researchDurationMin: 10,
    prerequisite: 'scanner_mk2',
  },

  // === SPEZIAL-MODULE ===
  void_drive: {
    id: 'void_drive',
    category: 'drive',
    tier: 3,
    name: 'VOID DRIVE',
    displayName: 'VOID',
    primaryEffect: { stat: 'jumpRange', delta: 6, label: 'Sprungweite +6' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 5, label: 'Engine-Speed MAX' },
      { stat: 'fuelPerJump', delta: -3, label: 'Fuel/Sprung -3' },
    ],
    effects: {
      jumpRange: 6,
      engineSpeed: 5,
      fuelPerJump: -3,
      hyperdriveRange: 30,
      hyperdriveSpeed: 8,
      hyperdriveRegen: 3.0,
      hyperdriveFuelEfficiency: 0.35,
    },
    cost: { credits: 2000, artefact: 5 },
    researchCost: { wissen: 800, artefacts: { special: 1 } },
    researchDurationMin: 30,
    prerequisite: 'drive_mk3',
    factionRequirement: { factionId: 'ancients', minTier: 'honored' },
  },
  quantum_scanner: {
    id: 'quantum_scanner',
    category: 'scanner',
    tier: 3,
    name: 'QUANTUM-SCANNER',
    displayName: 'Q-SCAN',
    primaryEffect: { stat: 'scannerLevel', delta: 3, label: 'Scan-Level +3' },
    secondaryEffects: [
      { stat: 'commRange', delta: 200, label: 'Komm-Reichweite +200' },
      { stat: 'artefactChanceBonus', delta: 0.05, label: 'Artefakt-Chance +5%' },
    ],
    effects: { scannerLevel: 3, commRange: 200, artefactChanceBonus: 0.05 },
    cost: { credits: 1500, crystal: 50 },
    researchCost: { wissen: 800, artefacts: { scanner: 1 } },
    researchDurationMin: 25,
    prerequisite: 'scanner_mk3',
  },
  nano_armor: {
    id: 'nano_armor',
    category: 'armor',
    tier: 3,
    name: 'NANO-PANZERUNG',
    displayName: 'NANO',
    primaryEffect: { stat: 'hp', delta: 150, label: 'HP +150' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.35, label: 'Schadensreduktion -35%' }],
    effects: { hp: 150, damageMod: -0.35 },
    cost: { credits: 1800, ore: 50, crystal: 50 },
    researchCost: { wissen: 800, artefacts: { armor: 1 } },
    researchDurationMin: 30,
    prerequisite: 'armor_mk3',
  },

  // === MINING LASER ===
  mining_laser_mk1: {
    id: 'mining_laser_mk1',
    category: 'mining',
    tier: 1,
    name: 'MINING LASER MK.I',
    displayName: 'MINE MK.I',
    primaryEffect: { stat: 'miningBonus', delta: 0.15, label: 'Mining +15%' },
    secondaryEffects: [],
    effects: { miningBonus: 0.15 },
    cost: { credits: 100, ore: 10 },
  },
  mining_laser_mk2: {
    id: 'mining_laser_mk2',
    category: 'mining',
    tier: 2,
    name: 'MINING LASER MK.II',
    displayName: 'MINE MK.II',
    primaryEffect: { stat: 'miningBonus', delta: 0.3, label: 'Mining +30%' },
    secondaryEffects: [{ stat: 'artefactChanceBonus', delta: 0.01, label: 'Artefakt-Chance +1%' }],
    effects: { miningBonus: 0.3, artefactChanceBonus: 0.01 },
    cost: { credits: 300, ore: 20, crystal: 5 },
    researchCost: { wissen: 300 },
    researchDurationMin: 5,
    prerequisite: 'mining_laser_mk1',
  },
  mining_laser_mk3: {
    id: 'mining_laser_mk3',
    category: 'mining',
    tier: 3,
    name: 'MINING LASER MK.III',
    displayName: 'MINE MK.III',
    primaryEffect: { stat: 'miningBonus', delta: 0.5, label: 'Mining +50%' },
    secondaryEffects: [{ stat: 'artefactChanceBonus', delta: 0.02, label: 'Artefakt-Chance +2%' }],
    effects: { miningBonus: 0.5, artefactChanceBonus: 0.02 },
    cost: { credits: 700, ore: 35, crystal: 15 },
    researchCost: { wissen: 800, artefacts: { mining: 1 } },
    researchDurationMin: 10,
    prerequisite: 'mining_laser_mk2',
  },
  mining_laser_mk4: {
    id: 'mining_laser_mk4',
    category: 'mining',
    tier: 4,
    name: 'MINING LASER MK.IV',
    displayName: 'MINE MK.IV',
    primaryEffect: { stat: 'miningBonus', delta: 0.75, label: 'Mining +75%' },
    secondaryEffects: [
      { stat: 'artefactChanceBonus', delta: 0.04, label: 'Artefakt-Chance +4%' },
      { stat: 'cargoCap', delta: 3, label: 'Frachtraum +3' },
    ],
    effects: { miningBonus: 0.75, artefactChanceBonus: 0.04, cargoCap: 3 },
    cost: { credits: 1500, ore: 60, crystal: 30, artefact: 2 },
    researchCost: { wissen: 2000, artefacts: { mining: 2 } },
    researchDurationMin: 20,
    prerequisite: 'mining_laser_mk3',
  },
  mining_laser_mk5: {
    id: 'mining_laser_mk5',
    category: 'mining',
    tier: 5,
    name: 'MINING LASER MK.V',
    displayName: 'MINE MK.V',
    primaryEffect: { stat: 'miningBonus', delta: 1.0, label: 'Mining +100%' },
    secondaryEffects: [
      { stat: 'artefactChanceBonus', delta: 0.08, label: 'Artefakt-Chance +8%' },
      { stat: 'cargoCap', delta: 5, label: 'Frachtraum +5' },
    ],
    effects: { miningBonus: 1.0, artefactChanceBonus: 0.08, cargoCap: 5 },
    cost: { credits: 4000, ore: 100, crystal: 60, artefact: 6 },
    researchCost: { wissen: 5000, artefacts: { mining: 3 } },
    researchDurationMin: 35,
    prerequisite: 'mining_laser_mk4',
  },

  // === DRIVE MK.IV & MK.V ===
  drive_mk4: {
    id: 'drive_mk4',
    category: 'drive',
    tier: 4,
    name: 'ION DRIVE MK.IV',
    displayName: 'ION MK.IV',
    primaryEffect: { stat: 'jumpRange', delta: 4, label: 'Sprungweite +4' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 4, label: 'Engine-Speed +4' },
      { stat: 'hyperdriveRegen', delta: 2.5, label: 'Hyperdrive-Regen +2.5' },
      { stat: 'hyperdriveFuelEfficiency', delta: 0.3, label: 'Fuel-Effizienz +30%' },
    ],
    effects: {
      jumpRange: 4,
      apCostJump: -0.7,
      engineSpeed: 4,
      hyperdriveRange: 25,
      hyperdriveSpeed: 6,
      hyperdriveRegen: 2.5,
      hyperdriveFuelEfficiency: 0.3,
    },
    cost: { credits: 2000, ore: 60, crystal: 30, artefact: 3 },
    researchCost: { wissen: 2000, artefacts: { drive: 2 } },
    researchDurationMin: 20,
    prerequisite: 'drive_mk3',
  },
  drive_mk5: {
    id: 'drive_mk5',
    category: 'drive',
    tier: 5,
    name: 'ION DRIVE MK.V',
    displayName: 'ION MK.V',
    primaryEffect: { stat: 'jumpRange', delta: 6, label: 'Sprungweite +6' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 5, label: 'Engine-Speed MAX' },
      { stat: 'hyperdriveRegen', delta: 4.0, label: 'Hyperdrive-Regen +4.0' },
      { stat: 'hyperdriveFuelEfficiency', delta: 0.5, label: 'Fuel-Effizienz +50%' },
    ],
    effects: {
      jumpRange: 6,
      apCostJump: -1.0,
      engineSpeed: 5,
      hyperdriveRange: 50,
      hyperdriveSpeed: 10,
      hyperdriveRegen: 4.0,
      hyperdriveFuelEfficiency: 0.5,
    },
    cost: { credits: 5000, ore: 120, crystal: 60, artefact: 8 },
    researchCost: { wissen: 5000, artefacts: { drive: 3 } },
    researchDurationMin: 40,
    prerequisite: 'drive_mk4',
  },

  // === SCANNER MK.IV & MK.V ===
  scanner_mk4: {
    id: 'scanner_mk4',
    category: 'scanner',
    tier: 4,
    name: 'SCANNER MK.IV',
    displayName: 'SCAN MK.IV',
    primaryEffect: { stat: 'scannerLevel', delta: 3, label: 'Scan-Level +3' },
    secondaryEffects: [
      { stat: 'commRange', delta: 150, label: 'Komm-Reichweite +150' },
      { stat: 'artefactChanceBonus', delta: 0.05, label: 'Artefakt-Chance +5%' },
      { stat: 'miningBonus', delta: 0.1, label: 'Mining +10%' },
    ],
    effects: { scannerLevel: 3, commRange: 150, artefactChanceBonus: 0.05, miningBonus: 0.1 },
    cost: { credits: 2000, crystal: 50, gas: 20, artefact: 2 },
    researchCost: { wissen: 2000, artefacts: { scanner: 2 } },
    researchDurationMin: 22,
    prerequisite: 'scanner_mk3',
  },
  scanner_mk5: {
    id: 'scanner_mk5',
    category: 'scanner',
    tier: 5,
    name: 'SCANNER MK.V',
    displayName: 'SCAN MK.V',
    primaryEffect: { stat: 'scannerLevel', delta: 4, label: 'Scan-Level +4' },
    secondaryEffects: [
      { stat: 'commRange', delta: 250, label: 'Komm-Reichweite +250' },
      { stat: 'artefactChanceBonus', delta: 0.08, label: 'Artefakt-Chance +8%' },
      { stat: 'miningBonus', delta: 0.15, label: 'Mining +15%' },
    ],
    effects: { scannerLevel: 4, commRange: 250, artefactChanceBonus: 0.08, miningBonus: 0.15 },
    cost: { credits: 5000, crystal: 100, gas: 40, artefact: 6 },
    researchCost: { wissen: 5000, artefacts: { scanner: 3 } },
    researchDurationMin: 35,
    prerequisite: 'scanner_mk4',
  },

  // === ARMOR MK.IV & MK.V ===
  armor_mk4: {
    id: 'armor_mk4',
    category: 'armor',
    tier: 4,
    name: 'ARMOR PLATING MK.IV',
    displayName: 'ARM MK.IV',
    primaryEffect: { stat: 'hp', delta: 150, label: 'HP +150' },
    secondaryEffects: [
      { stat: 'damageMod', delta: -0.3, label: 'Schadensreduktion -30%' },
      { stat: 'shieldHp', delta: 15, label: 'Schild +15' },
    ],
    effects: { hp: 150, damageMod: -0.3, shieldHp: 15 },
    cost: { credits: 1800, ore: 80, crystal: 40, artefact: 2 },
    researchCost: { wissen: 2000, artefacts: { armor: 2 } },
    researchDurationMin: 20,
    prerequisite: 'armor_mk3',
  },
  armor_mk5: {
    id: 'armor_mk5',
    category: 'armor',
    tier: 5,
    name: 'ARMOR PLATING MK.V',
    displayName: 'ARM MK.V',
    primaryEffect: { stat: 'hp', delta: 250, label: 'HP +250' },
    secondaryEffects: [
      { stat: 'damageMod', delta: -0.4, label: 'Schadensreduktion -40%' },
      { stat: 'shieldHp', delta: 30, label: 'Schild +30' },
    ],
    effects: { hp: 250, damageMod: -0.4, shieldHp: 30 },
    cost: { credits: 4500, ore: 150, crystal: 80, artefact: 6 },
    researchCost: { wissen: 5000, artefacts: { armor: 3 } },
    researchDurationMin: 35,
    prerequisite: 'armor_mk4',
  },

  // === CARGO MK.IV & MK.V ===
  cargo_mk4: {
    id: 'cargo_mk4',
    category: 'cargo',
    tier: 4,
    name: 'CARGO BAY MK.IV',
    displayName: 'CARGO MK.IV',
    primaryEffect: { stat: 'cargoCap', delta: 40, label: 'Frachtraum +40' },
    secondaryEffects: [
      { stat: 'safeSlotBonus', delta: 3, label: 'Safe-Slot +3' },
      { stat: 'fuelMax', delta: 40, label: 'Fuel-Tank +40' },
    ],
    effects: { cargoCap: 40, safeSlotBonus: 3, fuelMax: 40 },
    cost: { credits: 1500, ore: 50, gas: 20, artefact: 2 },
    researchCost: { wissen: 2000, artefacts: { cargo: 2 } },
    researchDurationMin: 18,
    prerequisite: 'cargo_mk3',
  },
  cargo_mk5: {
    id: 'cargo_mk5',
    category: 'cargo',
    tier: 5,
    name: 'CARGO BAY MK.V',
    displayName: 'CARGO MK.V',
    primaryEffect: { stat: 'cargoCap', delta: 60, label: 'Frachtraum +60' },
    secondaryEffects: [
      { stat: 'safeSlotBonus', delta: 5, label: 'Safe-Slot +5' },
      { stat: 'fuelMax', delta: 80, label: 'Fuel-Tank +80' },
    ],
    effects: { cargoCap: 60, safeSlotBonus: 5, fuelMax: 80 },
    cost: { credits: 4000, ore: 100, gas: 40, artefact: 5 },
    researchCost: { wissen: 5000, artefacts: { cargo: 3 } },
    researchDurationMin: 30,
    prerequisite: 'cargo_mk4',
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
// Target: 1–2 contiguous nebula blobs per quadrant (10 000-sector grid square),
// each blob 20–200 sectors in area (circular radius 3–8 sectors).
export const NEBULA_ZONE_GRID = 5_000; // coarse grid spacing: ~4 potential centers per quadrant
export const NEBULA_ZONE_CHANCE = 0.4; // 40% of centers activate → ~1.6 blobs per quadrant
export const NEBULA_ZONE_MIN_RADIUS = 3; // min radius → ~28 sectors per blob
export const NEBULA_ZONE_MAX_RADIUS = 8; // max radius → ~201 sectors per blob
export const NEBULA_SAFE_ORIGIN = 200; // no nebula zones within this many sectors of origin

// Two-stage worldgen: environment weights (first roll).
// Nebula is handled purely via zone system (NEBULA_ZONE_*) — no scattered random nebula.
// The entire 'empty' weight falls to 'empty'; the gap falls through to 'empty' as well.
export const ENVIRONMENT_WEIGHTS: Record<string, number> = {
  empty: 1.0,
  // nebula: handled exclusively by zone system (isInNebulaZone check before this roll)
  // black_hole: handled separately via BLACK_HOLE_SPAWN_CHANCE
};

// Extended environment weights for Phase 2 worldgen (sector environment types)
// Sums to 1.0. star/black_hole are impassable.
export const SECTOR_ENVIRONMENT_WEIGHTS: Record<string, number> = {
  empty: 0.55,
  nebula: 0.12,
  planet: 0.1,
  asteroid: 0.12,
  star: 0.08,
  black_hole: 0.03,
};

// Planet subtype distribution
export const PLANET_SUBTYPE_WEIGHTS: Record<string, number> = {
  terrestrial: 0.4,
  water: 0.25,
  ice: 0.2,
  lava: 0.12,
  exotic_a: 0.01,
  exotic_b: 0.01,
  exotic_c: 0.01,
};

// Distance-based density multipliers for sector content generation
// At distance 0 (origin): stations 2.5× more common, pirates 0.3×
// At distance 5000+: stations 0.3×, pirates 3×
export const DENSITY_STATION_NEAR = 2.5;
export const DENSITY_STATION_FAR = 0.3;
export const DENSITY_PIRATE_NEAR = 0.3;
export const DENSITY_PIRATE_FAR = 3.0;
export const DENSITY_DISTANCE_THRESHOLD = 5000; // Chebyshev distance in absolute sectors

// Two-stage worldgen: content weights (second roll, for non-blackhole).
// Target: 90% of all sectors completely empty; remaining 10% keep prior ratios.
export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.9,
  asteroid_field: 0.05,
  pirate: 0.02,
  anomaly: 0.01,
  station: 0.016,
  ruin: 0.004,
};

// Black hole generation
export const BLACK_HOLE_SPAWN_CHANCE = 0.005; // 0.5% of sectors far from origin
export const BLACK_HOLE_MIN_DISTANCE = 50; // minimum Chebyshev distance from origin
export const BLACK_HOLE_CLUSTER_GRID = 200; // coarse grid spacing for cluster centers
export const BLACK_HOLE_CLUSTER_CHANCE = 0.003; // chance a grid cell is a cluster center
export const BLACK_HOLE_CLUSTER_MIN_RADIUS = 0; // minimum cluster radius (0 = single sector)
export const BLACK_HOLE_CLUSTER_MAX_RADIUS = 4; // maximum cluster radius (4 = up to 9x9)

// Nebula content toggle — when true, nebula sectors get a content roll
export const NEBULA_CONTENT_ENABLED = true;

// Environment modifiers
export const NEBULA_SCANNER_MALUS = 1; // -1 sector scan range in nebula
export const NEBULA_PIRATE_SPAWN_MODIFIER = 0.7; // -30% pirate spawn in nebula
export const EMPTY_FUEL_MODIFIER = 0.8; // -20% fuel cost in empty space

// Hull-specific pixel patterns for radar rendering (3x3 grids, 1 = filled pixel)
export const HULL_RADAR_PATTERNS: Record<HullType, number[][]> = {
  scout: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ], // cross — nimble interceptor
  freighter: [
    [1, 1, 1],
    [1, 1, 1],
    [0, 1, 0],
  ], // wide body + single thruster
  cruiser: [
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 0],
  ], // spread wings + fuselage + tail
  explorer: [
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ], // tall forward sensor array
  battleship: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 0, 1],
  ], // heavy armored block + dual thrusters
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
  jumpgate: '\u25CE', // ◎
} as const;

// Environment-specific radar colors
export const ENVIRONMENT_COLORS: Record<SectorEnvironment, string> = {
  empty: '#FFB000',
  nebula: '#00BFFF',
  black_hole: '#1A1A1A',
  star: '#FFF700',
  planet: '#44FF88',
  asteroid: '#CC8844',
};

// Environment-specific radar symbols
export const ENVIRONMENT_SYMBOLS: Record<SectorEnvironment, string> = {
  empty: '\u00B7', // ·
  nebula: '\u2592', // ▒
  black_hole: 'o',
  star: '*',
  planet: '\u25CF', // ●
  asteroid: '\u25C6', // ◆
};

// Content overlay symbols for radar
export const CONTENT_SYMBOLS: Partial<Record<SectorContent, string>> = {
  asteroid_field: '\u25C6', // ◆
  station: 'S',
  home_base: 'H',
  player_base: 'B',
  anomaly: '\u25CA', // ◊
  pirate_zone: '\u2620', // ☠
  meteor: 'm',
  relic: 'R',
  npc_ship: '\u25B8', // ▸
  ruin: '\u2627', // ☧ (ancient cross/ruin marker)
};

// Content overlay colors
export const CONTENT_COLORS: Partial<Record<SectorContent, string>> = {
  asteroid_field: '#FF8C00',
  station: '#00FF88',
  anomaly: '#FF00FF',
  pirate_zone: '#FF3333',
  home_base: '#FFFFFF',
  player_base: '#FFFFFF',
  meteor: '#FFD700',
  relic: '#CC44FF',
  npc_ship: '#44AAFF',
  ruin: '#c8a96e', // amber-gold — Ancient aesthetic
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
  NEWS: 'NEWS',
} as const;

export type MonitorId = (typeof MONITORS)[keyof typeof MONITORS];

/** Programs selectable in Section 1 of the cockpit layout (#107) */
export const COCKPIT_PROGRAMS: MonitorId[] = [
  MONITORS.NAV_COM,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.BASE_LINK,
  MONITORS.TRADE,
  MONITORS.FACTION,
  MONITORS.QUESTS,
  MONITORS.TECH,
  MONITORS.QUAD_MAP,
  MONITORS.NEWS,
  MONITORS.LOG,
];

/** Labels for cockpit program buttons */
export const COCKPIT_PROGRAM_LABELS: Record<string, string> = {
  'NAV-COM': 'NAV-COM',
  MINING: 'MINING',
  CARGO: 'CARGO',
  'BASE-LINK': 'BASE',
  TRADE: 'TRADE',
  FACTION: 'FACTION',
  QUESTS: 'QUESTS',
  TECH: 'TECH',
  'QUAD-MAP': 'QUAD-MAP',
  NEWS: 'NEWS',
  LOG: 'LOG',
  MODULES: 'MODULES',
  HANGAR: 'HANGAR',
};

// --- Phase 5: Deep Systems ---

// Fuel
export const FUEL_COST_PER_UNIT = 2;
export const FREE_REFUEL_MAX_SHIPS = 3;

// Per-station reputation fuel price modifiers (more granular than faction REP_PRICE_MODIFIERS)
// Takes a reputation score (-100..+100) and returns a price multiplier.
export function getFuelRepPriceModifier(reputation: number): number {
  if (reputation < -50) return 2.0; // hostile
  if (reputation < -10) return 1.3; // unfriendly
  if (reputation <= 25) return 1.0; // neutral
  if (reputation <= 50) return 0.85; // friendly
  return 0.65; // honored
}

// Station reputation gains
export const STATION_REP_VISIT = 1;
export const STATION_REP_TRADE = 2;

// Faction Upgrade Tree
export const FACTION_UPGRADE_TIERS: Record<
  number,
  {
    optionA: { name: string; effect: string };
    optionB: { name: string; effect: string };
    cost: number;
  }
> = {
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
export const JUMPGATE_CHANCE = 0.005; // natural bidirectional/wormhole gates (1 in 200 sectors)
export const JUMPGATE_SALT = 777;
export const JUMPGATE_FUEL_COST = 1;
export const JUMPGATE_MIN_RANGE = 50;
export const JUMPGATE_MAX_RANGE = 10000;
export const JUMPGATE_CODE_LENGTH = 8;
export const JUMPGATE_MINIGAME_CHANCE = 0.3;
export const JUMPGATE_CODE_CHANCE = 0.5;
export const FREQUENCY_MATCH_THRESHOLD = 0.9;

// Ancient Jumpgates (extremely rare, long-range portals)
export const ANCIENT_JUMPGATE_SPAWN_RATE = 0.0001; // 1 per 10,000 sectors
export const ANCIENT_JUMPGATE_SALT = 778;
export const ANCIENT_JUMPGATE_MIN_RANGE = 30000; // ~3 quadrants minimum
export const ANCIENT_JUMPGATE_MAX_RANGE = 100000; // up to ~10 quadrants

// Rescue Missions
export const RESCUE_AP_COST = 5;
export const RESCUE_DELIVER_AP_COST = 3;
export const RESCUE_EXPIRY_MINUTES = 30;
export const DISTRESS_CALL_CHANCE = 0.005;
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

// Home base safe zone — no pirate spawns within this Manhattan distance
export const HOME_BASE_SAFE_RADIUS = 5;

// Emergency Warp (Notruf)
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export const EMERGENCY_WARP_FREE_RADIUS = 200; // free within 200 Manhattan distance of home base
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export const EMERGENCY_WARP_CREDIT_PER_SECTOR = 5; // credits per sector beyond free radius
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export const EMERGENCY_WARP_FUEL_GRANT = 10; // fuel granted after emergency warp
export const FEATURE_EMERGENCY_WARP = false;

// Hyperjump Navigation
export const HYPERJUMP_AP_DISCOUNT = 0.5; // 50% AP cost for known routes (legacy)
export const HYPERJUMP_PIRATE_FUEL_PENALTY = 1.5; // 50% extra fuel for pirate sectors

// --- Fuel Rework (#94): only hyperjumps cost fuel ---
export const HYPERJUMP_FUEL_PER_SECTOR = 1; // base fuel cost per sector of hyperjump distance
export const SCAN_FUEL_COST = 0; // scans are free (#94)
export const MINE_FUEL_COST = 0; // mining is free (#94)

// Ship purchasing — prices in credits per hull (separate from unlockCost which is initial unlock)
export const HULL_PRICES: Record<HullType, number> = {
  scout: 0,
  freighter: 500,
  cruiser: 1000,
  explorer: 2000,
  battleship: 3000,
};

// Only stations at this NPC level or above have a shipyard
export const STATION_SHIPYARD_LEVEL_THRESHOLD = 3;

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
  drive_mk4: 5,
  drive_mk5: 5,
  void_drive: 5,
};
// Research system
export const RESEARCH_TICK_MS = 60_000; // 1 tick = 1 minute

export const AUTOPILOT_STEP_MS = 100; // ms per sector during autopilot
export const STALENESS_DIM_HOURS = 24; // dim sectors after 24h
export const STALENESS_FADE_DAYS = 7; // coords-only after 7 days

export const QUADRANT_SIZE = 10_000;

/** Convert absolute coordinate to inner sector coordinate (0..QUADRANT_SIZE-1) */
export function innerCoord(abs: number): number {
  return ((abs % QUADRANT_SIZE) + QUADRANT_SIZE) % QUADRANT_SIZE;
}
export const SPAWN_QUADRANT_DISTANCE = 10_000_000;
export const SPAWN_QUADRANT_BAND = 10;
export const SPAWN_CLUSTER_MAX_PLAYERS_QUAD = 5;
export const QUADRANT_NAME_MAX_LENGTH = 24;
export const QUADRANT_NAME_MIN_LENGTH = 3;

// ---- Lebendiges Universum (Living Universe) ----

export const COSMIC_FACTION_IDS = [
  'humans',
  'archivists',
  'consortium',
  'kthari',
  'mycelians',
  'mirror_minds',
  'tourist_guild',
  'silent_swarm',
  'helions',
  'axioms',
  'scrappers',
] as const;
export type CosmicFactionId = (typeof COSMIC_FACTION_IDS)[number];

// Human starting territory: quadrants 0:0 to 4:4 (25 quadrants)
export const HUMAN_STARTING_TERRITORY: Array<[number, number]> = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
  [4, 0],
  [4, 1],
  [4, 2],
  [4, 3],
  [0, 4],
  [1, 4],
  [2, 4],
  [3, 4],
  [4, 4],
];

// Alien starting regions (distant from humans, no overlap with 0:0–4:4)
export const ALIEN_STARTING_REGIONS: Record<
  CosmicFactionId,
  { qx: number; qy: number; radius: number }[]
> = {
  humans: [],
  archivists: [
    { qx: 95, qy: 105, radius: 3 },
    { qx: 110, qy: 90, radius: 2 },
  ],
  consortium: [{ qx: 200, qy: 210, radius: 4 }],
  kthari: [
    { qx: 270, qy: 280, radius: 5 },
    { qx: 290, qy: 260, radius: 3 },
  ],
  mycelians: [{ qx: 410, qy: 420, radius: 3 }],
  mirror_minds: [{ qx: 550, qy: 560, radius: 2 }],
  tourist_guild: [{ qx: 690, qy: 700, radius: 6 }],
  silent_swarm: [{ qx: 1090, qy: 1100, radius: 8 }],
  helions: [{ qx: 1400, qy: 1390, radius: 4 }],
  axioms: [{ qx: 2800, qy: 2790, radius: 2 }],
  scrappers: [
    { qx: 65, qy: 70, radius: 2 },
    { qx: 80, qy: 65, radius: 2 },
  ],
};

// Hex colors for each cosmic faction (for QUAD-MAP rendering)
export const COSMIC_FACTION_COLORS: Record<CosmicFactionId, string> = {
  humans: '#4488FF',
  archivists: '#88FF88',
  consortium: '#FF8844',
  kthari: '#FF4488',
  mycelians: '#88FFCC',
  mirror_minds: '#CCCCFF',
  tourist_guild: '#FFCC44',
  silent_swarm: '#884488',
  helions: '#FF8800',
  axioms: '#44CCFF',
  scrappers: '#AAAAAA',
};

// ── ACEP Radar Icon Evolution ──────────────────────────────────────────────
// Icon grows with total XP. Dominant path shapes the pattern.
// Tiers: 0-19 (T1 3×3), 20-49 (T2 5×5), 50-79 (T3 7×7), 80-100 (T4 9×9)

export type AcepDominantPath = 'ausbau' | 'intel' | 'kampf' | 'explorer' | 'none';

/** Pixel patterns per tier × dominant path. */
export const ACEP_RADAR_PATTERNS: Record<1 | 2 | 3 | 4, Record<AcepDominantPath, number[][]>> = {
  1: {
    none: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    ausbau: [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    intel: [
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ],
    kampf: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    explorer: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  2: {
    none: [
      [0, 1, 1, 1, 0],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
    ],
    ausbau: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
    ], // fortress
    intel: [
      [0, 0, 1, 0, 0],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0],
    ], // diamond
    kampf: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 0, 0],
    ], // spear
    explorer: [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 0, 1, 1],
      [0, 0, 0, 0, 1],
    ], // asymmetric
  },
  3: {
    none: [
      [0, 0, 1, 1, 1, 0, 0],
      [0, 1, 0, 0, 0, 1, 0],
      [1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 1, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1],
      [0, 1, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
    ],
    ausbau: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [0, 1, 1, 1, 1, 1, 0],
    ], // fortress
    intel: [
      [0, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 0, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 0],
      [1, 0, 1, 1, 1, 0, 1],
      [0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 0],
    ], // crystal
    kampf: [
      [0, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 1, 0, 0, 0],
      [0, 1, 0, 1, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0, 0, 0],
      [0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0],
    ], // lance
    explorer: [
      [1, 0, 0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 0],
      [1, 0, 1, 0, 1, 0, 0],
      [0, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 1],
    ], // star-reach
  },
  4: {
    none: [
      [0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 1, 1, 1, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0],
    ],
    ausbau: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 1, 1, 1, 1, 1, 1, 1, 0],
    ], // citadel
    intel: [
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 1, 0, 0, 0],
      [0, 0, 1, 0, 1, 0, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
    ], // radiant star
    kampf: [
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 1, 0, 0, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0],
    ], // war cross
    explorer: [
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 1, 0, 0, 1, 0, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 1, 0, 0, 0],
      [1, 0, 0, 0, 1, 0, 0, 0, 1],
      [0, 0, 0, 1, 0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 1, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
    ], // galaxy
  },
};

/** XP tier thresholds (max 100 total XP). */
export const ACEP_XP_TIERS: Array<{ min: number; tier: 1 | 2 | 3 | 4 }> = [
  { min: 80, tier: 4 },
  { min: 50, tier: 3 },
  { min: 20, tier: 2 },
  { min: 0, tier: 1 },
];

export function getAcepIconTier(totalXp: number): 1 | 2 | 3 | 4 {
  for (const t of ACEP_XP_TIERS) {
    if (totalXp >= t.min) return t.tier;
  }
  return 1;
}

export function getAcepDominantPath(xp: {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
}): AcepDominantPath {
  const total = xp.ausbau + xp.intel + xp.kampf + xp.explorer;
  if (total === 0) return 'none';
  const entries = Object.entries(xp) as Array<[AcepDominantPath, number]>;
  const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  // Require dominant path to have > 40% of total to "count"
  return max[1] / total > 0.4 ? max[0] : 'none';
}

export function getAcepRadarPattern(xp: {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
  total: number;
}): number[][] {
  const tier = getAcepIconTier(xp.total);
  const path = getAcepDominantPath(xp);
  return ACEP_RADAR_PATTERNS[tier][path];
}

// Universe Tick Engine constants
export const UNIVERSE_TICK_MS = 5_000; // 5 seconds per tick
export const FACTION_EXPANSION_INTERVAL_TICKS = 360; // 30 min (360 × 5s)
export const FACTION_MAX_STATIONS_PER_QUADRANT = 5;
export const HUMAN_CIVILIZATION_METER_MAX = 10_000; // max civ level

// ─────────────────────────────────────────────────────────────────────────────
// Race Visual Identity — #187
// Framework for alien race aesthetics: colors, radar icons, terminal style
// ─────────────────────────────────────────────────────────────────────────────

export type AlienFactionId =
  | 'ancients'
  | 'scrappers'
  | 'archivists'
  | 'consortium'
  | 'kthari'
  | 'mycelians'
  | 'mirror_minds'
  | 'tourist_guild'
  | 'silent_swarm'
  | 'helions'
  | 'axioms';

export interface RaceVisualConfig {
  /** Primary UI accent color (hex) */
  accentColor: string;
  /** Secondary/dim color for backgrounds and inactive elements */
  dimColor: string;
  /** Terminal font style hint: 'normal' | 'symbols' | 'math' */
  fontStyle: 'normal' | 'symbols' | 'math';
  /** 5×5 pixel pattern for NPC ship icon on radar */
  radarPattern: number[][];
  /** Short description of the aesthetic feel */
  aesthetic: string;
}

/**
 * Visual configuration for each alien faction.
 * Used by station terminals (accent colors) and radar renderer (NPC ship icons).
 */
export const RACE_VISUAL_CONFIGS: Record<AlienFactionId, RaceVisualConfig> = {
  ancients: {
    accentColor: '#c8a96e',
    dimColor: '#6b5a38',
    fontStyle: 'symbols',
    aesthetic: 'ruined organic-crystal, warm amber glow',
    radarPattern: [
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
    ],
  },
  scrappers: {
    accentColor: '#aaaaaa',
    dimColor: '#555555',
    fontStyle: 'normal',
    aesthetic: 'salvage-heap asymmetric, industrial grey',
    radarPattern: [
      [1, 0, 1, 1, 0],
      [0, 1, 0, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 0, 1, 0],
      [0, 1, 1, 0, 1],
    ],
  },
  archivists: {
    accentColor: '#88ffcc',
    dimColor: '#224433',
    fontStyle: 'normal',
    aesthetic: 'geometric clean precision, cool mint',
    radarPattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  consortium: {
    accentColor: '#ffaa44',
    dimColor: '#7a5020',
    fontStyle: 'normal',
    aesthetic: 'corporate efficient, warm gold-orange',
    radarPattern: [
      [0, 1, 1, 1, 0],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [0, 1, 1, 1, 0],
    ],
  },
  kthari: {
    accentColor: '#ff4444',
    dimColor: '#7a1111',
    fontStyle: 'normal',
    aesthetic: 'military angular combat-jet, sharp red',
    radarPattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  mycelians: {
    accentColor: '#44ff88',
    dimColor: '#114422',
    fontStyle: 'symbols',
    aesthetic: 'organic growing mycellium, bio-green',
    radarPattern: [
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
      [0, 0, 1, 0, 0],
      [1, 0, 0, 0, 1],
      [0, 1, 0, 1, 0],
    ],
  },
  mirror_minds: {
    accentColor: '#cc88ff',
    dimColor: '#441166',
    fontStyle: 'normal',
    aesthetic: 'mirrored symmetric reflective, violet',
    radarPattern: [
      [1, 0, 0, 0, 1],
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
    ],
  },
  tourist_guild: {
    accentColor: '#ffff44',
    dimColor: '#7a7a11',
    fontStyle: 'normal',
    aesthetic: 'colorful overloaded cruise-ship, bright yellow',
    radarPattern: [
      [1, 1, 0, 1, 1],
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
      [1, 1, 0, 1, 1],
    ],
  },
  silent_swarm: {
    accentColor: '#ff8844',
    dimColor: '#7a3311',
    fontStyle: 'normal',
    aesthetic: 'insectoid modular swarm-cluster, burnt orange',
    radarPattern: [
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
    ],
  },
  helions: {
    accentColor: '#ff44ff',
    dimColor: '#7a1177',
    fontStyle: 'normal',
    aesthetic: 'plasma radiant solar-wind, vivid magenta',
    radarPattern: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  axioms: {
    accentColor: '#ffffff',
    dimColor: '#888888',
    fontStyle: 'math',
    aesthetic: 'abstract mathematical pure-geometry, white',
    radarPattern: [
      [1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1],
    ],
  },
};

/** Get visual config for a race, or ancients-themed fallback. */
export function getRaceVisual(raceId: AlienFactionId): RaceVisualConfig {
  return RACE_VISUAL_CONFIGS[raceId] ?? RACE_VISUAL_CONFIGS.ancients;
}
