import type { SectorType, MineableResourceType, StructureType, HullType, HullDefinition, ModuleDefinition, ModuleCategory, SectorEnvironment, SectorContent, ProductionRecipe } from './types.js';
export declare const SECTOR_TYPES: SectorType[];
/** @deprecated Not used in worldgen. See CONTENT_WEIGHTS + ENVIRONMENT_WEIGHTS in packages/server/src/engine/worldgen.ts. */
export declare const SECTOR_WEIGHTS: Record<SectorType, number>;
export declare const AP_DEFAULTS: {
    max: number;
    startingAP: number;
    regenPerSecond: number;
};
export declare const AP_COSTS: {
    jump: number;
    scan: number;
    mine: number;
};
export declare const AP_COSTS_BY_SCANNER: Record<number, {
    areaScan: number;
    areaScanRadius: number;
}>;
export declare const AP_COSTS_LOCAL_SCAN = 1;
export declare const WORLD_SEED = 77;
export declare const RADAR_RADIUS = 3;
export declare const RECONNECTION_TIMEOUT_S = 15;
export declare const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<MineableResourceType, number>>;
export declare const MINING_RATE_PER_SECOND = 1;
export declare const RESOURCE_REGEN_DELAY_TICKS = 50;
export declare const RESOURCE_REGEN_INTERVAL_TICKS = 12;
export declare const RESOURCE_TYPES: MineableResourceType[];
export declare const STRUCTURE_COSTS: Record<StructureType, Record<MineableResourceType, number>>;
export declare const STRUCTURE_AP_COSTS: Record<StructureType, number>;
/** Base Wissen generation per hour by research lab tier (1–5) */
export declare const RESEARCH_LAB_WISSEN_RATE: Record<number, number>;
export declare const RESEARCH_LAB_NAMES: Record<number, string>;
/** Maximum research lab tier */
export declare const RESEARCH_LAB_MAX_TIER = 5;
/** Lab tier required to research modules of each module tier */
export declare const RESEARCH_LAB_TIER_FOR_MODULE_TIER: Record<number, number>;
/** Wissen multipliers by sector type/environment present in the station's sector */
export declare const WISSEN_SECTOR_MULTIPLIERS: Record<string, number>;
/** Base Wissen cost to research a module, by module tier */
export declare const WISSEN_COST_BY_TIER: Record<number, number>;
/** Required artefacts (matching module category) per module tier */
export declare const ARTEFACT_REQUIRED_BY_TIER: Record<number, number>;
/** Wissen cost reduction per matching artefact used */
export declare const ARTEFACT_WISSEN_BONUS = 500;
/** Research time reduction per matching artefact used (fraction, e.g. 0.1 = 10%) */
export declare const ARTEFACT_TIME_BONUS_PER = 0.1;
/** Maximum artefacts that can be used per research */
export declare const MAX_ARTEFACTS_PER_RESEARCH = 3;
/** Credits + material cost to upgrade research lab to the given tier */
export declare const RESEARCH_LAB_UPGRADE_COSTS: Record<number, {
    credits: number;
    ore: number;
    crystal: number;
}>;
export declare const RELAY_RANGES: Record<StructureType, number>;
export declare const JUMPGATE_BUILD_COST: {
    credits: number;
    crystal: number;
    artefact: number;
};
export declare const JUMPGATE_UPGRADE_COSTS: Record<string, Record<string, number>>;
export declare const JUMPGATE_DISTANCE_LIMITS: Record<number, number>;
export declare const JUMPGATE_CONNECTION_LIMITS: Record<number, number>;
export declare const JUMPGATE_MAX_CHAIN_HOPS = 10;
export declare const NPC_PRICES: Record<MineableResourceType, number>;
export declare const NPC_BUY_SPREAD = 1.2;
export declare const NPC_SELL_SPREAD = 0.8;
export declare const NPC_STATION_LEVELS: readonly [{
    readonly level: 1;
    readonly name: "Outpost";
    readonly maxStock: 200;
    readonly xpThreshold: 0;
}, {
    readonly level: 2;
    readonly name: "Station";
    readonly maxStock: 500;
    readonly xpThreshold: 500;
}, {
    readonly level: 3;
    readonly name: "Hub";
    readonly maxStock: 1200;
    readonly xpThreshold: 2000;
}, {
    readonly level: 4;
    readonly name: "Port";
    readonly maxStock: 3000;
    readonly xpThreshold: 6000;
}, {
    readonly level: 5;
    readonly name: "Megastation";
    readonly maxStock: 8000;
    readonly xpThreshold: 15000;
}];
export declare const PRODUCTION_RECIPES: ProductionRecipe[];
export declare const NPC_XP_DECAY_PER_HOUR = 1;
export declare const NPC_XP_VISIT = 5;
export declare const NPC_XP_PER_TRADE_UNIT = 1;
export declare const NPC_XP_QUEST_COMPLETE = 15;
export declare const ARTEFACT_DROP_CHANCES: {
    readonly artifact_find_event: 0.5;
    readonly anomaly_scan: 0.08;
    readonly pirate_loot: 0.03;
};
export declare const ARTEFACT_COLOR = "#FF6B35";
export declare const ARTEFACT_SYMBOL = "\u273B";
export declare const SLATE_AP_COST_SECTOR = 1;
export declare const SLATE_AP_COST_AREA = 3;
export declare const SLATE_NPC_PRICE_PER_SECTOR = 5;
export declare const SLATE_AREA_RADIUS: Record<number, number>;
export declare const BASE_SCANNER_MEMORY = 2;
export declare function getPhysicalCargoTotal(cargo: {
    ore: number;
    gas: number;
    crystal: number;
    artefact: number;
}): number;
export declare const NPC_FACTION_WEIGHTS: Record<string, number>;
export declare const REP_TIERS: Record<string, {
    min: number;
    max: number;
}>;
export declare const REP_PRICE_MODIFIERS: Record<string, number>;
export declare const FACTION_UPGRADES: Record<string, {
    factionId: string;
    name: string;
    effect: string;
}>;
export declare const BATTLE_AP_COST_FLEE = 2;
export declare const BATTLE_CARGO_LOSS_MIN = 0.25;
export declare const BATTLE_CARGO_LOSS_MAX = 0.5;
export declare const BATTLE_NEGOTIATE_COST_PER_LEVEL = 10;
export declare const BATTLE_FLEE_BASE_CHANCE = 0.6;
export declare const PIRATE_LEVEL_DISTANCE_DIVISOR = 50;
export declare const PIRATE_MAX_LEVEL = 10;
export declare const PIRATE_BASE_HP = 20;
export declare const PIRATE_HP_PER_LEVEL = 10;
export declare const PIRATE_BASE_DAMAGE = 5;
export declare const PIRATE_DAMAGE_PER_LEVEL = 3;
export declare const FEATURE_HYPERDRIVE_V2 = false;
export declare const TACTIC_MODS: Record<string, {
    dmg: number;
    def: number;
}>;
export declare const AIM_ACCURACY_BONUS = 0.5;
export declare const AIM_DISABLE_CHANCE = 0.35;
export declare const AIM_DISABLE_ROUNDS = 2;
export declare const EVADE_CHANCE = 0.5;
export declare const EMP_HIT_CHANCE = 0.75;
export declare const EMP_DISABLE_ROUNDS = 2;
export declare const COMBAT_V2_MAX_ROUNDS = 5;
export declare const COMBAT_V2_ROLL_MIN = 0.85;
export declare const COMBAT_V2_ROLL_MAX = 1.15;
export declare const STATION_BASE_HP = 500;
export declare const STATION_REPAIR_CR_PER_HP = 5;
export declare const STATION_REPAIR_ORE_PER_HP = 1;
export declare const STATION_COMBAT_MAX_ROUNDS = 10;
export declare const STATION_DEFENSE_DEFS: Record<string, {
    damage?: number;
    shieldHp?: number;
    shieldRegen?: number;
    oncePer?: 'combat';
    bypassShields?: boolean;
    cost: {
        credits: number;
        ore?: number;
        crystal?: number;
        gas?: number;
    };
}>;
export declare const MAX_ACTIVE_QUESTS = 3;
export declare const QUEST_EXPIRY_DAYS = 7;
export declare const SCAN_EVENT_CHANCE = 0.15;
export declare const XP_LEVELS: Record<number, number>;
export declare const STORAGE_TIERS: Record<number, {
    capacity: number;
    upgradeCost: number;
}>;
export declare const TRADING_POST_TIERS: Record<number, {
    name: string;
    upgradeCost: number;
}>;
export declare const SHIP_CLASSES: Record<string, {
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
}>;
export declare const SPECIALIZED_SLOT_CATEGORIES: ModuleCategory[];
export declare const SPECIALIZED_SLOT_INDEX: Partial<Record<ModuleCategory, number>>;
export declare const UNIQUE_MODULE_CATEGORIES: ModuleCategory[];
export declare const DEFENSE_ONLY_CATEGORIES: ModuleCategory[];
/** ausbau-XP-Schwellwerte für Extra-Slot-Freischaltung */
export declare const ACEP_EXTRA_SLOT_THRESHOLDS: number[];
export declare const ACEP_LEVEL_THRESHOLDS: Record<number, number>;
export declare const ACEP_LEVEL_MULTIPLIERS: Record<number, number>;
/** Modul-HP pro Tier */
export declare const MODULE_HP_BY_TIER: Record<number, number>;
/** EP-Kosten pro Power-Level pro Modul-Kategorie (im Kampf) */
export declare const MODULE_EP_COSTS: Partial<Record<ModuleCategory, Record<string, number>>>;
/** Basis AP/s des Schiffs ohne Generator */
export declare const BASE_HULL_AP_REGEN = 0.08;
/** Power-Level-Multiplikatoren für AP-Regen und EP-Output */
export declare const POWER_LEVEL_MULTIPLIERS: Record<string, number>;
export declare const HULLS: Record<HullType, HullDefinition>;
export declare const MODULES: Record<string, ModuleDefinition>;
export declare const SECTOR_COLORS: Record<SectorType | 'home_base', string>;
export declare const SPAWN_MIN_DISTANCE = 10000000;
export declare const SPAWN_DISTANCE_VARIANCE = 2000000;
export declare const SPAWN_CLUSTER_RADIUS = 300;
export declare const SPAWN_CLUSTER_MAX_PLAYERS = 5;
export declare const ANCIENT_STATION_CHANCE = 0.15;
export declare const NEBULA_ZONE_GRID = 250;
export declare const NEBULA_ZONE_CHANCE = 0.4;
export declare const NEBULA_ZONE_MIN_RADIUS = 2.5;
export declare const NEBULA_ZONE_MAX_RADIUS = 8;
export declare const NEBULA_SAFE_ORIGIN = 50;
export declare const ENVIRONMENT_WEIGHTS: Record<string, number>;
export declare const SECTOR_ENVIRONMENT_WEIGHTS: Record<string, number>;
export declare const PLANET_SUBTYPE_WEIGHTS: Record<string, number>;
export declare const DENSITY_STATION_NEAR = 2.5;
export declare const DENSITY_STATION_FAR = 0.3;
export declare const DENSITY_PIRATE_NEAR = 0.3;
export declare const DENSITY_PIRATE_FAR = 3;
export declare const DENSITY_DISTANCE_THRESHOLD = 5000;
export declare const CONTENT_WEIGHTS: Record<string, number>;
export declare const BLACK_HOLE_SPAWN_CHANCE = 0.005;
export declare const BLACK_HOLE_MIN_DISTANCE = 50;
export declare const BLACK_HOLE_CLUSTER_GRID = 200;
export declare const BLACK_HOLE_CLUSTER_CHANCE = 0.003;
export declare const BLACK_HOLE_CLUSTER_MIN_RADIUS = 0;
export declare const BLACK_HOLE_CLUSTER_MAX_RADIUS = 4;
export declare const NEBULA_CONTENT_ENABLED = true;
export declare const NEBULA_SCANNER_MALUS = 1;
export declare const NEBULA_PIRATE_SPAWN_MODIFIER = 0.7;
export declare const EMPTY_FUEL_MODIFIER = 0.8;
export declare const HULL_RADAR_PATTERNS: Record<HullType, number[][]>;
export declare const SYMBOLS: {
    readonly ship: "■";
    readonly empty: "·";
    readonly unexplored: ".";
    readonly asteroid_field: "▓";
    readonly nebula: "▒";
    readonly station: "△";
    readonly anomaly: "◊";
    readonly pirate: "☠";
    readonly player: "◆";
    readonly iron: "⛏";
    readonly homeBase: "⌂";
    readonly jumpgate: "◎";
};
export declare const ENVIRONMENT_COLORS: Record<SectorEnvironment, string>;
export declare const ENVIRONMENT_SYMBOLS: Record<SectorEnvironment, string>;
export declare const CONTENT_SYMBOLS: Partial<Record<SectorContent, string>>;
export declare const CONTENT_COLORS: Partial<Record<SectorContent, string>>;
export declare const THEME: {
    readonly amber: {
        readonly primary: "#FFB000";
        readonly dim: "rgba(255, 176, 0, 0.6)";
        readonly bg: "#050505";
        readonly danger: "#FF3333";
        readonly bezel: "#1a1a1a";
        readonly bezelLight: "#2a2a2a";
    };
};
export declare const MONITORS: {
    readonly NAV_COM: "NAV-COM";
    readonly SHIP_SYS: "SHIP-SYS";
    readonly MINING: "MINING";
    readonly CARGO: "CARGO";
    readonly COMMS: "COMMS";
    readonly BASE_LINK: "BASE-LINK";
    readonly LOG: "LOG";
    readonly TRADE: "TRADE";
    readonly FACTION: "FACTION";
    readonly QUESTS: "QUESTS";
    readonly TECH: "TECH";
    readonly QUAD_MAP: "QUAD-MAP";
    readonly NEWS: "NEWS";
    readonly ACEP: "ACEP";
};
export type MonitorId = (typeof MONITORS)[keyof typeof MONITORS];
/** Programs selectable in Section 1 of the cockpit layout (#107) */
export declare const COCKPIT_PROGRAMS: MonitorId[];
/** Labels for cockpit program buttons */
export declare const COCKPIT_PROGRAM_LABELS: Record<string, string>;
export declare const FUEL_COST_PER_UNIT = 0.1;
export declare const FUEL_MIN_TANK = 1000;
export declare const FREE_REFUEL_MAX_SHIPS = 3;
export declare const STATION_FUEL_BASELINE_PER_TICK = 10;
export declare const STATION_FUEL_GAS_RATE_PER_TICK = 100;
export declare const STATION_FUEL_PER_GAS = 1;
export declare const STATION_FUEL_MAX_STOCK = 50000;
/** Efficiency multiplier per station level: level → rate multiplier (1.0 = 100 fuel/tick, 1.2 = 120 fuel/tick) */
export declare const STATION_FUEL_LEVEL_EFFICIENCY: Record<number, number>;
export declare function getFuelRepPriceModifier(reputation: number): number;
export declare const STATION_REP_VISIT = 1;
export declare const STATION_REP_TRADE = 2;
export declare const FACTION_UPGRADE_TIERS: Record<number, {
    optionA: {
        name: string;
        effect: string;
    };
    optionB: {
        name: string;
        effect: string;
    };
    cost: number;
}>;
export declare const JUMPGATE_CHANCE = 0.005;
export declare const JUMPGATE_SALT = 777;
export declare const JUMPGATE_FUEL_COST = 1;
export declare const JUMPGATE_TRAVEL_COST_CREDITS = 50;
export declare const PLAYER_GATE_TRAVEL_COST_CREDITS = 25;
export declare const JUMPGATE_MIN_RANGE = 50;
export declare const JUMPGATE_MAX_RANGE = 10000;
export declare const JUMPGATE_CODE_LENGTH = 8;
export declare const JUMPGATE_MINIGAME_CHANCE = 0.3;
export declare const JUMPGATE_CODE_CHANCE = 0.5;
export declare const FREQUENCY_MATCH_THRESHOLD = 0.9;
export declare const ANCIENT_JUMPGATE_SPAWN_RATE = 0.0001;
export declare const ANCIENT_JUMPGATE_SALT = 778;
export declare const ANCIENT_JUMPGATE_MIN_RANGE = 30000;
export declare const ANCIENT_JUMPGATE_MAX_RANGE = 100000;
export declare const RESCUE_AP_COST = 5;
export declare const RESCUE_DELIVER_AP_COST = 3;
export declare const RESCUE_EXPIRY_MINUTES = 30;
export declare const DISTRESS_CALL_CHANCE = 0.005;
export declare const DISTRESS_DIRECTION_VARIANCE = 0.3;
export declare const RESCUE_REWARDS: {
    readonly scan_event: {
        readonly credits: 50;
        readonly rep: 10;
        readonly xp: 25;
    };
    readonly npc_quest: {
        readonly credits: 80;
        readonly rep: 15;
        readonly xp: 40;
    };
    readonly comm_distress: {
        readonly credits: 100;
        readonly rep: 20;
        readonly xp: 50;
    };
};
export declare const MAX_TRADE_ROUTES = 3;
export declare const TRADE_ROUTE_MIN_CYCLE = 15;
export declare const TRADE_ROUTE_MAX_CYCLE = 120;
export declare const TRADE_ROUTE_FUEL_PER_DISTANCE = 0.5;
export declare const CUSTOM_SLATE_AP_COST = 2;
export declare const CUSTOM_SLATE_CREDIT_COST = 5;
export declare const CUSTOM_SLATE_MAX_COORDS = 20;
export declare const CUSTOM_SLATE_MAX_CODES = 10;
export declare const CUSTOM_SLATE_MAX_NOTES_LENGTH = 500;
export declare const SECTOR_MAX_FEATURES = 3;
export declare const HOME_BASE_SAFE_RADIUS = 5;
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export declare const EMERGENCY_WARP_FREE_RADIUS = 200;
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export declare const EMERGENCY_WARP_CREDIT_PER_SECTOR = 5;
/** @deprecated Emergency warp disabled — use FEATURE_EMERGENCY_WARP flag */
export declare const EMERGENCY_WARP_FUEL_GRANT = 10;
export declare const FEATURE_EMERGENCY_WARP = false;
export declare const HYPERJUMP_AP_DISCOUNT = 0.5;
export declare const HYPERJUMP_PIRATE_FUEL_PENALTY = 1.5;
export declare const HYPERJUMP_FUEL_PER_SECTOR = 1;
export declare const SCAN_FUEL_COST = 0;
export declare const MINE_FUEL_COST = 0;
export declare const HULL_PRICES: Record<HullType, number>;
export declare const STATION_SHIPYARD_LEVEL_THRESHOLD = 3;
export declare const HULL_FUEL_MULTIPLIER: Record<HullType, number>;
export declare const JUMP_NORMAL_AP_COST = 1;
export declare const JUMP_NORMAL_FUEL_COST = 0;
export declare const JUMP_NORMAL_MAX_RANGE = 1;
export declare const HYPERJUMP_BASE_AP = 5;
export declare const HYPERJUMP_AP_PER_SPEED = 1;
export declare const HYPERJUMP_MIN_AP = 1;
export declare const HYPERJUMP_FUEL_DIST_FACTOR = 0.1;
export declare const HYPERJUMP_FUEL_MAX_FACTOR = 2;
export declare const ENGINE_SPEED: Record<string, number>;
export declare const RESEARCH_TICK_MS = 60000;
export declare const AUTOPILOT_STEP_MS = 100;
export declare const STALENESS_DIM_HOURS = 24;
export declare const STALENESS_FADE_DAYS = 7;
export declare const QUADRANT_SIZE = 500;
/**
 * Convert absolute coordinate to inner sector coordinate (-half..half-1).
 * Origin (0) is at center of quadrant (0,0). Range: [-250, 249].
 */
export declare function innerCoord(abs: number): number;
export declare const SPAWN_QUADRANT_DISTANCE = 10000000;
export declare const SPAWN_QUADRANT_BAND = 10;
export declare const SPAWN_CLUSTER_MAX_PLAYERS_QUAD = 5;
export declare const QUADRANT_NAME_MAX_LENGTH = 24;
export declare const QUADRANT_NAME_MIN_LENGTH = 3;
export declare const COSMIC_FACTION_IDS: readonly ["humans", "archivists", "consortium", "kthari", "mycelians", "mirror_minds", "tourist_guild", "silent_swarm", "helions", "axioms", "scrappers"];
export type CosmicFactionId = (typeof COSMIC_FACTION_IDS)[number];
export declare const HUMAN_STARTING_TERRITORY: Array<[number, number]>;
export declare const ALIEN_STARTING_REGIONS: Record<CosmicFactionId, {
    qx: number;
    qy: number;
    radius: number;
}[]>;
export declare const COSMIC_FACTION_COLORS: Record<CosmicFactionId, string>;
export type AcepDominantPath = 'ausbau' | 'intel' | 'kampf' | 'explorer' | 'none';
/** Pixel patterns per tier × dominant path. */
export declare const ACEP_RADAR_PATTERNS: Record<1 | 2 | 3 | 4, Record<AcepDominantPath, number[][]>>;
/** XP tier thresholds (max 100 total XP). */
export declare const ACEP_XP_TIERS: Array<{
    min: number;
    tier: 1 | 2 | 3 | 4;
}>;
export declare function getAcepIconTier(totalXp: number): 1 | 2 | 3 | 4;
export declare function getAcepDominantPath(xp: {
    ausbau: number;
    intel: number;
    kampf: number;
    explorer: number;
}): AcepDominantPath;
export declare function getAcepRadarPattern(xp: {
    ausbau: number;
    intel: number;
    kampf: number;
    explorer: number;
    total: number;
}): number[][];
export declare const ACEP_PATH_CAP_SHARED = 50;
export declare const ACEP_BOOST_COST_TIERS: readonly [{
    readonly minXp: 40;
    readonly credits: 600;
    readonly wissen: 15;
}, {
    readonly minXp: 20;
    readonly credits: 300;
    readonly wissen: 8;
}, {
    readonly minXp: 0;
    readonly credits: 100;
    readonly wissen: 3;
}];
/** Returns boost cost for +5 XP at the given current-path XP, or null if at cap. */
export declare function getAcepBoostCost(currentXp: number): {
    credits: number;
    wissen: number;
} | null;
export declare const UNIVERSE_TICK_MS = 5000;
export declare const FACTION_EXPANSION_INTERVAL_TICKS = 360;
/** Radar render radius for NPC mining drones (hollow circle, px at zoom 2) */
export declare const CIV_DRONE_RADIUS = 5;
/** Max mining drones per NPC station */
export declare const CIV_MAX_DRONES_PER_STATION = 3;
/** Mining drone fills up after this many ticks */
export declare const CIV_MINING_TICKS_TO_FULL = 20;
/** Max Ulam spiral steps before drone gives up and idles */
export declare const CIV_SPIRAL_MAX_STEPS = 200;
export declare const FACTION_MAX_STATIONS_PER_QUADRANT = 5;
export declare const HUMAN_CIVILIZATION_METER_MAX = 10000;
export type AlienFactionId = 'ancients' | 'scrappers' | 'archivists' | 'consortium' | 'kthari' | 'mycelians' | 'mirror_minds' | 'tourist_guild' | 'silent_swarm' | 'helions' | 'axioms';
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
export declare const RACE_VISUAL_CONFIGS: Record<AlienFactionId, RaceVisualConfig>;
/** Get visual config for a race, or ancients-themed fallback. */
export declare function getRaceVisual(raceId: AlienFactionId): RaceVisualConfig;
//# sourceMappingURL=constants.d.ts.map