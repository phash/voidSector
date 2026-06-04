import type {
  SectorType,
  ResourceType,
  MineableResourceType,
  StructureType,
  ModuleCategory,
  SectorEnvironment,
  SectorContent,
  ProductionRecipe,
  WreckSize,
} from './types.js';

export const SECTOR_TYPES: SectorType[] = [
  'empty',
  'nebula',
  'asteroid_field',
  'station',
  'anomaly',
  'pirate',
];


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
  1: { areaScan: 3, areaScanRadius: 4 },
  2: { areaScan: 5, areaScanRadius: 8 },
  3: { areaScan: 8, areaScanRadius: 12 },
  4: { areaScan: 14, areaScanRadius: 16 },
  5: { areaScan: 18, areaScanRadius: 20 },
};

export const AP_COSTS_LOCAL_SCAN = 1;

export const WORLD_SEED = 104729;

export const RECONNECTION_TIMEOUT_S = 15;

export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<MineableResourceType, number>> = {
  empty: { ore: 0, gas: 0, crystal: 0 },
  nebula: { ore: 0, gas: 15, crystal: 0 },
  asteroid_field: { ore: 50, gas: 2, crystal: 8 },
  anomaly: { ore: 3, gas: 3, crystal: 20 },
  station: { ore: 0, gas: 0, crystal: 0 },
  pirate: { ore: 8, gas: 3, crystal: 8 },
};

export const MINING_RATE_PER_SECOND = 1;
export const MINING_RATE_NO_LASER = 0.1; // mining rate without mining laser module
export const MINING_AP_COST_NO_LASER = 1; // AP cost per second when mining without laser

export const RESOURCE_REGEN_DELAY_TICKS = 50;
export const RESOURCE_REGEN_INTERVAL_TICKS = 12; // 1 unit per 12 ticks (60s)

export const RESOURCE_TYPES: MineableResourceType[] = ['ore', 'gas', 'crystal'];

export const STRUCTURE_COSTS: Record<StructureType, Record<MineableResourceType, number>> = {
  jumpgate: { ore: 0, gas: 0, crystal: 20 },
};

export const STRUCTURE_AP_COSTS: Record<StructureType, number> = {
  jumpgate: 10,
};

// ── Player Stations ──────────────────────────────────────────────────

export const MAX_STATION_LEVEL = 5;
export const MAX_STATIONS_PER_QUADRANT = 1;

export const STATION_BUILD_COSTS: Record<number, { credits: number; crystal: number; artefact: number }> = {
  1: { credits: 500, crystal: 5, artefact: 1 },
  2: { credits: 1000, crystal: 10, artefact: 2 },
  3: { credits: 2000, crystal: 20, artefact: 4 },
  4: { credits: 4000, crystal: 40, artefact: 8 },
  5: { credits: 8000, crystal: 80, artefact: 16 },
};

export const STATION_MODULE_UPGRADE_COST = (level: number): number => 200 * level * level;

// ── Station tiers (Betrieb-driven growth) ──────────────────────────────
// trade_volume thresholds; index = tier-1. Station level auto-rises to the
// highest tier whose threshold the volume meets.
export const STATION_TIER_THRESHOLDS = [0, 1000, 4000, 12000, 30000] as const;

export function stationTierForVolume(volume: number): number {
  let tier = 1;
  for (let i = 0; i < STATION_TIER_THRESHOLDS.length; i++) {
    if (volume >= STATION_TIER_THRESHOLDS[i]) tier = i + 1;
  }
  return Math.min(tier, MAX_STATION_LEVEL);
}

// ── Station expansions ────────────────────────────────────────────────
export type StationExpansionType =
  | 'factory' | 'cargo' | 'markt' | 'werft' | 'refinery' | 'sensor';

export const STATION_EXPANSION_TYPES: StationExpansionType[] = [
  'factory', 'cargo', 'markt', 'werft', 'refinery', 'sensor',
];

export interface ExpansionResourceCost {
  ore: number; gas: number; crystal: number; credits: number; artefact: number;
}

/** Base cost for level 1; expansionCost() scales by target level. */
export const STATION_EXPANSION_BASE_COSTS: Record<StationExpansionType, ExpansionResourceCost> = {
  factory:  { ore: 20, gas: 10, crystal: 15, credits: 200, artefact: 0 },
  cargo:    { ore: 30, gas: 5,  crystal: 5,  credits: 100, artefact: 0 },
  markt:    { ore: 15, gas: 20, crystal: 10, credits: 300, artefact: 0 },
  werft:    { ore: 40, gas: 20, crystal: 25, credits: 400, artefact: 2 },
  refinery: { ore: 25, gas: 30, crystal: 10, credits: 250, artefact: 0 },
  sensor:   { ore: 20, gas: 15, crystal: 20, credits: 250, artefact: 1 },
};

export function expansionCost(type: StationExpansionType, targetLevel: number): ExpansionResourceCost {
  const b = STATION_EXPANSION_BASE_COSTS[type];
  return {
    ore: b.ore * targetLevel,
    gas: b.gas * targetLevel,
    crystal: b.crystal * targetLevel,
    credits: b.credits * targetLevel,
    artefact: b.artefact * targetLevel,
  };
}

/** Build time for reaching targetLevel of any expansion. */
export const STATION_EXPANSION_BUILD_TIME_MS = (targetLevel: number): number => 60_000 * targetLevel;

// Station cargo (resource storage) capacity by cargo_level.
export const STATION_CARGO_BASE = 200;
export const STATION_CARGO_PER_LEVEL = 300;
export function stationCargoCapacity(cargoLevel: number): number {
  return STATION_CARGO_BASE + cargoLevel * STATION_CARGO_PER_LEVEL;
}

// Markt: each level improves the trade spread in the player's favour.
export const MARKT_SPREAD_PER_LEVEL = 0.04;

// Refinery: credits trickle per universe tick per refinery level.
export const REFINERY_CREDITS_PER_TICK = 2;

// Sensor: +1 scan sector per sensor level around the station's quadrant.
export const SENSOR_SCAN_BONUS_PER_LEVEL = 1;

// Refinery: passive gas → fuel conversion stored in the station's cargo_contents.fuel.
export const REFINERY_GAS_PER_TICK = 1;   // gas consumed per universe tick per refinery level
export const REFINERY_FUEL_PER_GAS = 100; // fuel produced per gas consumed
export const REFINERY_FUEL_MAX = 20000;   // cap on a station's stored fuel

// Sensor: chance that pirate_zone auto-combat is made optional in the sensor station's quadrant.
export const SENSOR_PIRATE_REDUCTION_PER_LEVEL = 0.15; // per sensor level
export const SENSOR_PIRATE_REDUCTION_MAX = 0.9;        // cap

// Phase 2 (#549) — mining ships per werft level.
export const STATION_MINING_SHIPS_PER_WERFT_LEVEL = 1;

// Station production
export const PRODUCTION_BASE_TIME_MS = 60_000; // 60s base per item
export const PRODUCTION_TIER_COST_FACTOR = 2; // cost multiplier per tier above factory level
export const PRODUCTION_MAX_QUEUE = 9;

/** Basic recipes available to every factory (no blueprint needed) */
export const BASIC_FACTORY_RECIPES: Record<string, { inputs: Record<string, number>; outputs: Record<string, number>; timeMs: number }> = {
  fuel: { inputs: { gas: 4 }, outputs: { fuel: 100 }, timeMs: 30_000 },
};

/**
 * Calculate production time for a module at a given factory level.
 * Tier difference increases time exponentially.
 */
export function calculateProductionTime(moduleTier: number, factoryLevel: number): number {
  const tierDiff = Math.max(0, moduleTier - factoryLevel);
  return PRODUCTION_BASE_TIME_MS * moduleTier * Math.pow(PRODUCTION_TIER_COST_FACTOR, tierDiff);
}

/**
 * Calculate resource cost multiplier for producing above factory level.
 */
export function calculateCostMultiplier(moduleTier: number, factoryLevel: number): number {
  const tierDiff = Math.max(0, moduleTier - factoryLevel);
  return Math.pow(PRODUCTION_TIER_COST_FACTOR, tierDiff);
}

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
export const JUMPGATE_MAX_PER_QUADRANT = 4;

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

export const BASE_SCANNER_MEMORY = 10;

export function getPhysicalCargoTotal(cargo: { ore: number; gas: number; crystal: number; artefact: number }): number {
  return cargo.ore + cargo.gas + cargo.crystal + cargo.artefact;
}

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


export const MAX_ACTIVE_QUESTS = 20;
export const MAX_TRACKED_QUESTS = 5;
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



// ─── ACEP SLOT SYSTEM ────────────────────────────────────────────────────────

export const SPECIALIZED_SLOT_CATEGORIES: ModuleCategory[] = [
  'generator', // slot 0
  'drive',     // slot 1
  'weapon',    // slot 2
  'armor',     // slot 3
  'shield',    // slot 4
  'scanner',   // slot 5
  'mining',    // slot 6
  'cargo',     // slot 7
  'factory',   // slot 8
];

export const SPECIALIZED_SLOT_INDEX: Partial<Record<ModuleCategory, number>> = {
  generator: 0,
  drive:     1,
  weapon:    2,
  armor:     3,
  shield:    4,
  scanner:   5,
  mining:    6,
  cargo:     7,
  factory:   8,
};

export const UNIQUE_MODULE_CATEGORIES: ModuleCategory[] = ['factory']; // only factory stays unique
export const DEFENSE_ONLY_CATEGORIES: ModuleCategory[] = ['defense', 'special'];

/** Legacy — replaced by ACEP_PATH_SLOT_UNLOCKS */
export const ACEP_EXTRA_SLOT_THRESHOLDS: number[] = [];

/** Pfad-Slot-Freischaltungen: path → [level, slotLabel, allowedCategories[]] */
export interface AcepSlotDef {
  path: import('./types.js').AcepPath;
  level: number;
  label: string;
  categories: string[];
}

export const ACEP_PATH_SLOT_UNLOCKS: AcepSlotDef[] = [
  // KAMPF: weapon slots at 2, 4, 7, 10
  { path: 'kampf', level: 2, label: 'WPN', categories: ['weapon_energy', 'weapon_kinetic', 'weapon_missile'] },
  { path: 'kampf', level: 4, label: 'WPN', categories: ['weapon_energy', 'weapon_kinetic', 'weapon_missile'] },
  { path: 'kampf', level: 7, label: 'WPN', categories: ['weapon_energy', 'weapon_kinetic', 'weapon_missile'] },
  { path: 'kampf', level: 10, label: 'WPN', categories: ['weapon_energy', 'weapon_kinetic', 'weapon_missile'] },
  // DEFENSE: def-kombi slots at 2, 4, 6, 8, 10
  { path: 'defense', level: 2, label: 'DEF', categories: ['armor', 'shield', 'defense_pv', 'defense_ecm'] },
  { path: 'defense', level: 4, label: 'DEF', categories: ['armor', 'shield', 'defense_pv', 'defense_ecm'] },
  { path: 'defense', level: 6, label: 'DEF', categories: ['armor', 'shield', 'defense_pv', 'defense_ecm'] },
  { path: 'defense', level: 8, label: 'DEF', categories: ['armor', 'shield', 'defense_pv', 'defense_ecm'] },
  { path: 'defense', level: 10, label: 'DEF', categories: ['armor', 'shield', 'defense_pv', 'defense_ecm'] },
  // TRADER: cargo slots at 2, 4, 8, 10
  { path: 'trader', level: 2, label: 'CGO', categories: ['cargo'] },
  { path: 'trader', level: 4, label: 'CGO', categories: ['cargo'] },
  { path: 'trader', level: 8, label: 'CGO', categories: ['cargo'] },
  { path: 'trader', level: 10, label: 'CGO', categories: ['cargo'] },
  // MINER: mining slots at 2, 4, 8, 10
  { path: 'miner', level: 2, label: 'MIN', categories: ['mining'] },
  { path: 'miner', level: 4, label: 'MIN', categories: ['mining'] },
  { path: 'miner', level: 8, label: 'MIN', categories: ['mining'] },
  { path: 'miner', level: 10, label: 'MIN', categories: ['mining'] },
  // EXPLORER: kombi slots at 3, 6, 9
  { path: 'explorer', level: 3, label: 'EXP', categories: ['cargo', 'mining', 'scanner', 'repair'] },
  { path: 'explorer', level: 6, label: 'EXP', categories: ['cargo', 'mining', 'scanner', 'repair'] },
  { path: 'explorer', level: 9, label: 'EXP', categories: ['cargo', 'mining', 'scanner', 'repair'] },
  // AUSBAU: engine/gen/repair slots at 2, 4, 8, 10
  { path: 'ausbau', level: 2, label: 'ENG', categories: ['drive', 'generator', 'repair'] },
  { path: 'ausbau', level: 4, label: 'ENG', categories: ['drive', 'generator', 'repair'] },
  { path: 'ausbau', level: 8, label: 'ENG', categories: ['drive', 'generator', 'repair'] },
  { path: 'ausbau', level: 10, label: 'ENG', categories: ['drive', 'generator', 'repair'] },
];

/** Get unlocked extra slots based on ACEP path levels */
export function getAcepUnlockedSlots(
  pathLevels: Record<string, number>,
): AcepSlotDef[] {
  return ACEP_PATH_SLOT_UNLOCKS.filter(
    (s) => (pathLevels[s.path] ?? 0) >= s.level,
  );
}

// ─── ACEP LEVEL THRESHOLDS ───────────────────────────────────────────────────

export const ACEP_LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 500,
  3: 2500,
  4: 7500,
  5: 20000,
};

export const ACEP_LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.2,
  4: 1.35,
  5: 1.5,
};

/** Modul-HP pro Tier */
export const MODULE_HP_BY_TIER: Record<number, number> = {
  1: 20, 2: 35, 3: 55, 4: 80, 5: 110,
};

/** Basis AP/s des Schiffs ohne Generator */
export const BASE_HULL_AP_REGEN = 0.1;

// NOTE: MODULES is a compatibility shim for the old Record<string, ModuleDefinition> shape.
// Prefer MODULE_MAP (Map) or MODULE_DEFINITIONS (array) for new code.
import { MODULE_MAP } from './moduleDefinitions.js';
import type { ModuleDefinition } from './moduleDefinitions.js';
export const MODULES: Record<string, ModuleDefinition> = Object.fromEntries(MODULE_MAP);

export const SECTOR_COLORS: Record<string, string> = {
  empty: '#FFB000',
  asteroid_field: '#FF8C00',
  nebula: '#00BFFF',
  station: '#00FF88',
  anomaly: '#FF00FF',
  pirate: '#FF3333',
  star: '#FFFFAA',
  planet: '#44BBAA',
  ruin: '#AA88FF',
  jumpgate: '#8888FF',
  construction_site: '#FFB000',
  wreck: '#888888',
};

export const SPAWN_MIN_DISTANCE = 10_000_000;
export const SPAWN_DISTANCE_VARIANCE = 2_000_000;
export const SPAWN_CLUSTER_RADIUS = 300; // wider clusters so group members have some distance
export const SPAWN_CLUSTER_MAX_PLAYERS = 5;
export const ANCIENT_STATION_CHANCE = 0.15; // 15% of stations are ancient/special variants

// Nebula zone system — seed-based blob generation
// Target: 1–2 contiguous nebula blobs per quadrant (500×500 quadrant),
// each blob 20–200 sectors in area (circular radius 3–8 sectors).
export const NEBULA_ZONE_GRID = 25;     // dichtes Zentren-Raster für ~5 % Abdeckung
export const NEBULA_ZONE_CHANCE = 0.54;  // gemessen: ~5,0–5,3 % Abdeckung
export const NEBULA_ZONE_MIN_RADIUS = 2.5; // gefüllte Scheibe ≈ 21 Sektoren (≥ 12)
export const NEBULA_ZONE_MAX_RADIUS = 6;   // gefüllte Scheibe ≈ 113 Sektoren
export const NEBULA_SAFE_ORIGIN = 25;      // nebelfreie Start-Blase um (0,0)

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
// Note: anomaly is no longer part of this roll — it uses its own environment-aware roll (see below).
export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.91,
  asteroid_field: 0.05,
  pirate: 0.02,
  station: 0.016,
  ruin: 0.004,
};

// Umgebungsabhängige Anomalie-Wahrscheinlichkeit (eigener, dekorrelierter Roll).
export const EMPTY_ANOMALY_CHANCE = 0.0001; // 0,01 % im normalen, leeren Raum
export const NEBULA_ANOMALY_CHANCE = 0.1;   // 10 % im Nebel (jedes 10. Nebelfeld)

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
  jumpgate: '\u25CE', // ◎
  star: '\u2605',        // ★
  planet: '\u25CF',      // ●
  ruin: '\u0394',        // Δ
  construction_site: '\u2699', // ⚙
  wreck: '\u22A0',       // ⊠
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
  player_base: 'B',
  anomaly: '\u25CA', // ◊
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
  ACEP: 'ACEP',
  FRIENDS: 'FRIENDS',
  FABRIK: 'FABRIK',
  XENO: 'XENO',
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
  MONITORS.ACEP,
  MONITORS.FRIENDS,
  MONITORS.FABRIK,
  MONITORS.XENO,
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
  ACEP: 'ACEP',
  FRIENDS: 'FRIENDS',
  FABRIK: 'FABRIK',
  XENO: 'XENO',
};

// --- Phase 5: Deep Systems ---

// Fuel
export const FUEL_COST_PER_UNIT = 0.01; // 0.01 credits per fuel unit → 100 fuel = 1 credit
export const FUEL_MIN_TANK = 10_000; // minimum tank size regardless of hull+modules
export const FREE_REFUEL_MAX_SHIPS = 3;

// Base ship stats (replaces hull-specific values after hull system removal)
export const BASE_FUEL_CAPACITY = 10_000;
export const BASE_FUEL_PER_JUMP = 100;
export const BASE_CARGO = 20;
export const BASE_MODULE_SLOTS = 3;
export const BASE_HP = 100;
export const BASE_JUMP_RANGE = 5;
export const BASE_ENGINE_SPEED = 2;
export const BASE_COMM_RANGE = 100;
export const BASE_SCANNER_LEVEL = 1;

// Station fuel production
export const STATION_FUEL_BASELINE_PER_TICK = 10; // fuel produced per tick without gas
export const STATION_FUEL_GAS_RATE_PER_TICK = 100; // fuel produced per tick when gas available (before efficiency)
export const STATION_FUEL_PER_GAS = 1; // GAS units consumed per gas-enhanced tick
export const STATION_FUEL_MAX_STOCK = 50_000; // cap per station
/** Efficiency multiplier per station level: level → rate multiplier (1.0 = 100 fuel/tick, 1.2 = 120 fuel/tick) */
export const STATION_FUEL_LEVEL_EFFICIENCY: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.4,
  4: 1.6,
  5: 2.0,
};

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
export const JUMPGATE_CHANCE = 0; // disabled — only ancient jumpgates remain
export const JUMPGATE_SALT = 777;
export const JUMPGATE_FUEL_PER_HOP = 10; // fuel cost per hop through jumpgate network
export const JUMPGATE_TRAVEL_COST_CREDITS = 50; // credits to use a public jumpgate
export const PLAYER_GATE_TRAVEL_COST_CREDITS = 25; // credits to use a player-built gate (cheaper)
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
export const DISTRESS_INTERVAL_MIN_MS = 60 * 60 * 1000;   // 1h min between distress per quadrant
export const DISTRESS_INTERVAL_MAX_MS = 2 * 60 * 60 * 1000; // 2h max
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

// Blueprint Crafting
export const BLUEPRINT_COPY_BASE_COST = 100; // CR per tier

// Hyperjump Navigation
export const HYPERJUMP_AP_DISCOUNT = 0.5; // 50% AP cost for known routes (legacy)
export const HYPERJUMP_PIRATE_FUEL_PENALTY = 1.5; // 50% extra fuel for pirate sectors

// --- Fuel Rework (#94): only hyperjumps cost fuel ---
export const HYPERJUMP_FUEL_PER_SECTOR = 1; // base fuel cost per sector of hyperjump distance
export const SCAN_FUEL_COST = 0; // scans are free (#94)
export const MINE_FUEL_COST = 0; // mining is free (#94)

// Only stations at this NPC level or above have a shipyard
export const STATION_SHIPYARD_LEVEL_THRESHOLD = 3;

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
export const ARTEFACT_RESEARCH_TIME_BONUS = 0.1; // -10% research time when typed artefacts present

export const CRAFT_TICK_INTERVAL_MS = 5_000; // 5 seconds, same as construction ticks
export const AUTOPILOT_STEP_MS = 800; // ms per sector during autopilot
export const STALENESS_DIM_HOURS = 24; // dim sectors after 24h
export const STALENESS_FADE_DAYS = 7; // coords-only after 7 days

export const QUADRANT_SIZE = 500;

/**
 * Convert absolute coordinate to inner sector coordinate (-half..half-1).
 * Origin (0) is at center of quadrant (0,0). Range: [-250, 249].
 */
export function innerCoord(abs: number): number {
  const half = Math.floor(QUADRANT_SIZE / 2);
  return abs - Math.floor((abs + half) / QUADRANT_SIZE) * QUADRANT_SIZE;
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

// Human starting territory: quadrant 0:0 only (single starting base)
export const HUMAN_STARTING_TERRITORY: Array<[number, number]> = [
  [0, 0],
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
  const { ausbau, intel, kampf, explorer } = xp;
  const total = ausbau + intel + kampf + explorer;
  if (total === 0) return 'none';
  const entries: Array<[AcepDominantPath, number]> = [
    ['ausbau', ausbau], ['intel', intel], ['kampf', kampf], ['explorer', explorer],
  ];
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

export const ACEP_PATH_CAP = 10; // max level per path
export const ACEP_ALL_PATHS: import('./types.js').AcepPath[] = ['ausbau', 'intel', 'kampf', 'explorer', 'defense', 'trader', 'miner'];
export const ACEP_PATH_COLORS: Record<string, string> = {
  ausbau: '#FFB000', intel: '#4488FF', kampf: '#FF4444', explorer: '#44FFAA',
  defense: '#FF44FF', trader: '#FFDD22', miner: '#88FF44',
};

/** Boost cost for +1 level. Credits = 100×2^(level-1), Wissen = 5×2^(level-1).
 *  Soft global cap: costMult = 1 + totalLevels/10 */
export function getAcepBoostCost(
  currentLevel: number,
  totalLevels: number,
): { credits: number; wissen: number } | null {
  if (currentLevel >= ACEP_PATH_CAP) return null;
  const nextLevel = currentLevel + 1;
  const baseCr = 100 * Math.pow(2, nextLevel - 1);
  const baseW = 5 * Math.pow(2, nextLevel - 1);
  const mult = 1 + totalLevels / 10;
  return {
    credits: Math.round(baseCr * mult),
    wissen: Math.round(baseW * mult),
  };
}

/** Auto-XP threshold to reach a level passively */
export function getAcepAutoXpThreshold(level: number): number {
  return 10 * (Math.pow(2, level) - 1);
}

/**
 * Derives the ACEP path level (0..ACEP_PATH_CAP) from accumulated raw XP,
 * using the exponential auto-XP thresholds. Inverse of getAcepAutoXpThreshold.
 */
export function getAcepLevelForXp(rawXp: number): number {
  let level = 0;
  for (let l = 1; l <= ACEP_PATH_CAP; l++) {
    if (rawXp >= getAcepAutoXpThreshold(l)) level = l;
    else break;
  }
  return level;
}

// Legacy compat
export const ACEP_PATH_CAP_SHARED = ACEP_PATH_CAP;

// Universe Tick Engine constants
export const UNIVERSE_TICK_MS = 5_000; // 5 seconds per tick
export const FACTION_EXPANSION_INTERVAL_TICKS = 360; // 30 min (360 × 5s) — base interval, scaled per faction

/** Expansion rate per faction: lower = faster. Base=10 → interval*1.0, rate=5 → interval*0.5 */
export const FACTION_EXPANSION_RATES: Record<string, number> = {
  humans: 0,       // humans expand via player activity only
  kthari: 5,       // aggressive, fast
  silent_swarm: 4, // very fast swarm invasion
  archivists: 15,  // slow, conservative
  consortium: 10,  // normal
  mycelians: 12,   // slow, organic
  mirror_minds: 10, // normal, reactive
  tourist_guild: 20, // very slow, harmless
  helions: 8,
  axioms: 10,
  voids: 6,        // steady expansion
};

/** Radar render radius for NPC mining drones (hollow circle, px at zoom 2) */
export const CIV_DRONE_RADIUS = 5;

/** Max mining drones per NPC station */
export const CIV_MAX_DRONES_PER_STATION = 3;

/** Mining drone fills up after this many ticks */
export const CIV_MINING_TICKS_TO_FULL = 20;

/** Max Ulam spiral steps before drone gives up and idles */
export const CIV_SPIRAL_MAX_STEPS = 200;

// NPC Ship Roles
export const NPC_SPAWN_COUNTS = {
  inner: { military: 8, outlaw: 5, trader: 10 },    // x2-3 (outlaws weak Lv1 — training)
  middle: { military: 15, outlaw: 15, trader: 10 },  // x2-3
  outer: { military: 25, outlaw: 8, trader: 10 },    // x2
} as const;

export function getNpcZone(qx: number, qy: number): 'inner' | 'middle' | 'outer' {
  const dist = Math.max(Math.abs(qx), Math.abs(qy));
  if (dist <= 3) return 'inner';
  if (dist <= 7) return 'middle';
  return 'outer';
}

export const NPC_MILITARY_LEVELS: Record<string, number> = { inner: 2, middle: 4, outer: 6 };
export const NPC_OUTLAW_LEVEL_RANGE: Record<string, [number, number]> = {
  inner: [1, 1], middle: [2, 5], outer: [3, 7],
};
export const NPC_TRADE_BASE_PRICES: Record<string, number> = { ore: 8, gas: 12, crystal: 20 };
export const NPC_TRADE_MAX_DISTANCE_BONUS = 0.5;
export const NPC_TRADE_DISTANCE_DIVISOR = 500;
export const NPC_TRADE_CAPACITY = 100;
export const NPC_OUTLAW_DISCOUNT = 0.8;
export const NPC_OUTLAW_ARTEFACT_CHANCE = 0.3;
export const NPC_OUTLAW_RESPAWN_MS = 2 * 60 * 60 * 1000;
export const NPC_OUTLAW_AMBUSH_CHANCE = 0.7;
export const NPC_OUTLAW_ROAM_RADIUS = 8;
export const NPC_MILITARY_PATROL_STEPS = 50;
export const NPC_TRADE_WAIT_TICKS = 5;
export const NPC_TRADE_MAX_RANGE = 1000;
export const NPC_OUTLAW_COMBAT_REP_GAIN = 5;

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

// ─── Wreck POI ────────────────────────────────────────────────────────────────

export const WRECK_BASE_DIFFICULTY: Record<string, number> = {
  resource: 0.20,
  module: 0.50,
  blueprint: 0.70,
  data_slate: 0.65,
  artefact: 0.90,  // artefacts are stored as resource but use this key for difficulty
};

export const WRECK_SALVAGE_DURATION_MS: Record<WreckSize, number> = {
  small: 4000,
  medium: 6000,
  large: 8000,
};

export const WRECK_SIZE_ITEM_COUNT: Record<WreckSize, [number, number]> = {
  small: [2, 3],
  medium: [4, 6],
  large: [7, 10],
};

export const WRECK_MAX_PER_QUADRANT = 2;
export const WRECK_DIFFICULTY_FAIL_DELTA = 0.15;
export const WRECK_DIFFICULTY_SUCCESS_DELTA = -0.10;
export const WRECK_DIFFICULTY_MAX = 0.3;
export const WRECK_DIFFICULTY_MIN = -0.3;
export const WRECK_SLATE_CAP = 5;
export const WRECK_EXPLORER_CHANCE_PER_XP = 0.005;  // +0.5% per explorer XP, max +25%
export const WRECK_HELION_ARTEFACT_MIN_CHANCE = 0.35; // at explorer=50, artefacts min 35%
export const WRECK_INVESTIGATE_AP_COST = 2;
export const WRECK_SALVAGE_AP_COST = 3;
export const WRECK_SLATE_SELL_BASE = 50;
export const WRECK_SLATE_SELL_PER_TIER = 75;
export const WRECK_SLATE_JUMPGATE_HUMANITY_TAX = 25;

/** Get visual config for a race, or ancients-themed fallback. */
export function getRaceVisual(raceId: AlienFactionId): RaceVisualConfig {
  return RACE_VISUAL_CONFIGS[raceId] ?? RACE_VISUAL_CONFIGS.ancients;
}

// ─── Conquest ──────────────────────────────────────────────────────────────

export const CONQUEST_POOL_DRAIN_PER_TICK = 50;
export const CONQUEST_POOL_MAX = 500;

export const CONQUEST_RATE: Record<number, { base: number; boosted: number }> = {
  1: { base: 1.0, boosted: 1.5 },
  2: { base: 1.1, boosted: 2.0 },
  3: { base: 1.2, boosted: 3.0 },
};

export const HYPERDRIVE_CHARGE_PER_GAS = 4; // 1 GAS from cargo → 4 hyperdrive charge

export function getConquestPriceBonus(qx: number, qy: number): number {
  const dist = Math.floor(Math.sqrt(qx * qx + qy * qy));
  if (dist <= 10) return dist;
  if (dist <= 50) return 10 + (dist - 10) * 2;
  if (dist <= 100) return 90 + (dist - 50) * 3;
  return 240 + (dist - 100) * 5;
}
