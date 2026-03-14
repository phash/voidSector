// gameConfigApply.ts — Apply DB-stored config values to in-memory constants.
//
// Constants fall into two categories:
//   1. Object properties / complex objects — CAN be mutated in-place
//      (e.g. AP_DEFAULTS.max, MODULES.drive_mk1, SECTOR_RESOURCE_YIELDS, ...)
//   2. Standalone scalar `const` values — CANNOT be reassigned from outside
//      the module. For these we provide a `getConfig(key)` helper that checks
//      the runtime cache first, falling back to the compiled constant.
//
// This file handles both: applyConfigValue() mutates what it can, and
// getConfig() resolves anything from the cache.

import { CONFIG_SEED } from './gameConfigSeed.js';
import {
  AP_DEFAULTS,
  AP_COSTS,
  AP_COSTS_BY_SCANNER,
  SECTOR_RESOURCE_YIELDS,
  TACTIC_MODS,
  STATION_DEFENSE_DEFS,
  STATION_FUEL_LEVEL_EFFICIENCY,
  NPC_PRICES,
  REP_PRICE_MODIFIERS,
  CONTENT_WEIGHTS,
  SECTOR_ENVIRONMENT_WEIGHTS,
  CONQUEST_RATE,
  JUMPGATE_DISTANCE_LIMITS,
  JUMPGATE_CONNECTION_LIMITS,
  JUMPGATE_BUILD_COST,
  JUMPGATE_UPGRADE_COSTS,
  STRUCTURE_COSTS,
  STRUCTURE_AP_COSTS,
  STORAGE_TIERS,
  TRADING_POST_TIERS,
  LAB_WISSEN_MULTIPLIER,
  XP_LEVELS,
  SLATE_AREA_RADIUS,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
  WRECK_BASE_DIFFICULTY,
  WRECK_SALVAGE_DURATION_MS,
  WRECK_SIZE_ITEM_COUNT,
  MODULES,
  RESCUE_REWARDS,
} from '@void-sector/shared';

// ─── Defaults snapshot ───────────────────────────────────────────────────────

/** Snapshot of all default values, taken BEFORE any DB overrides are applied. */
const DEFAULTS = new Map<string, any>();

/**
 * Take a deep-copy snapshot of every seed entry's current value.
 * Must be called once at server startup, before applyAllConfig().
 */
export function snapshotDefaults(): void {
  for (const entry of CONFIG_SEED) {
    DEFAULTS.set(entry.key, structuredClone(entry.getDefault()));
  }
}

/** Return the snapshotted default for a given key. */
export function getDefaultValue(key: string): any {
  return DEFAULTS.get(key);
}

/** Return all snapshotted defaults. */
export function getAllDefaults(): Map<string, any> {
  return DEFAULTS;
}

// ─── Runtime config cache ────────────────────────────────────────────────────
// For standalone scalar constants that can't be mutated (e.g. MINING_RATE_PER_SECOND),
// consumers should call getConfig('MINING_RATE_PER_SECOND') instead of importing
// the constant directly. The cache is populated by applyAllConfig / applyConfigValue.

const RUNTIME_CACHE = new Map<string, any>();

/**
 * Get the current effective value for a config key.
 * Returns the DB-overridden value if one was applied, otherwise the default.
 *
 * Usage for standalone scalars that cannot be mutated:
 *   import { getConfig } from './gameConfigApply.js';
 *   const rate = getConfig('MINING_RATE_PER_SECOND') as number;
 */
export function getConfig(key: string): any {
  if (RUNTIME_CACHE.has(key)) return RUNTIME_CACHE.get(key);
  return DEFAULTS.get(key);
}

// ─── Apply a single value ────────────────────────────────────────────────────

/**
 * Apply a single config value to the in-memory constants.
 *
 * For object properties this mutates the live object. For standalone scalars
 * it only updates the runtime cache — consumers must use getConfig().
 */
export function applyConfigValue(key: string, value: any): void {
  if (value === null || value === undefined) return;

  // Always store in cache (for getConfig() resolution)
  RUNTIME_CACHE.set(key, value);

  // ── AP_DEFAULTS (mutable object properties) ──────────────────────────────
  if (key === 'AP_DEFAULTS.max') { AP_DEFAULTS.max = value; return; }
  if (key === 'AP_DEFAULTS.startingAP') { AP_DEFAULTS.startingAP = value; return; }
  if (key === 'AP_DEFAULTS.regenPerSecond') { AP_DEFAULTS.regenPerSecond = value; return; }

  // ── AP_COSTS (mutable object properties) ─────────────────────────────────
  if (key === 'AP_COSTS.jump') { AP_COSTS.jump = value; return; }
  if (key === 'AP_COSTS.scan') { AP_COSTS.scan = value; return; }
  if (key === 'AP_COSTS.mine') { AP_COSTS.mine = value; return; }

  // ── Complex objects — deep-merge to preserve references ──────────────────

  if (key === 'AP_COSTS_BY_SCANNER') {
    deepAssign(AP_COSTS_BY_SCANNER, value);
    return;
  }
  if (key === 'SECTOR_RESOURCE_YIELDS') {
    deepAssign(SECTOR_RESOURCE_YIELDS, value);
    return;
  }
  if (key === 'TACTIC_MODS') {
    deepAssign(TACTIC_MODS, value);
    return;
  }
  if (key === 'STATION_DEFENSE_DEFS') {
    deepAssign(STATION_DEFENSE_DEFS, value);
    return;
  }
  if (key === 'STATION_FUEL_LEVEL_EFFICIENCY') {
    deepAssign(STATION_FUEL_LEVEL_EFFICIENCY, value);
    return;
  }
  if (key === 'NPC_PRICES') {
    deepAssign(NPC_PRICES, value);
    return;
  }
  if (key === 'REP_PRICE_MODIFIERS') {
    deepAssign(REP_PRICE_MODIFIERS, value);
    return;
  }
  if (key === 'CONTENT_WEIGHTS') {
    deepAssign(CONTENT_WEIGHTS, value);
    return;
  }
  if (key === 'SECTOR_ENVIRONMENT_WEIGHTS') {
    deepAssign(SECTOR_ENVIRONMENT_WEIGHTS, value);
    return;
  }
  if (key === 'CONQUEST_RATE') {
    deepAssign(CONQUEST_RATE, value);
    return;
  }
  if (key === 'JUMPGATE_DISTANCE_LIMITS') {
    deepAssign(JUMPGATE_DISTANCE_LIMITS, value);
    return;
  }
  if (key === 'JUMPGATE_CONNECTION_LIMITS') {
    deepAssign(JUMPGATE_CONNECTION_LIMITS, value);
    return;
  }
  if (key === 'JUMPGATE_BUILD_COST') {
    Object.assign(JUMPGATE_BUILD_COST, value);
    return;
  }
  if (key === 'JUMPGATE_UPGRADE_COSTS') {
    deepAssign(JUMPGATE_UPGRADE_COSTS, value);
    return;
  }
  if (key === 'STRUCTURE_COSTS') {
    deepAssign(STRUCTURE_COSTS, value);
    return;
  }
  if (key === 'STRUCTURE_AP_COSTS') {
    deepAssign(STRUCTURE_AP_COSTS, value);
    return;
  }
  if (key === 'STORAGE_TIERS') {
    deepAssign(STORAGE_TIERS, value);
    return;
  }
  if (key === 'TRADING_POST_TIERS') {
    deepAssign(TRADING_POST_TIERS, value);
    return;
  }
  if (key === 'LAB_WISSEN_MULTIPLIER') {
    deepAssign(LAB_WISSEN_MULTIPLIER, value);
    return;
  }
  if (key === 'XP_LEVELS') {
    deepAssign(XP_LEVELS, value);
    return;
  }
  if (key === 'SLATE_AREA_RADIUS') {
    deepAssign(SLATE_AREA_RADIUS, value);
    return;
  }
  if (key === 'ACEP_LEVEL_THRESHOLDS') {
    deepAssign(ACEP_LEVEL_THRESHOLDS, value);
    return;
  }
  if (key === 'ACEP_LEVEL_MULTIPLIERS') {
    deepAssign(ACEP_LEVEL_MULTIPLIERS, value);
    return;
  }
  if (key === 'WRECK_BASE_DIFFICULTY') {
    deepAssign(WRECK_BASE_DIFFICULTY, value);
    return;
  }
  if (key === 'WRECK_SALVAGE_DURATION_MS') {
    deepAssign(WRECK_SALVAGE_DURATION_MS, value);
    return;
  }
  if (key === 'WRECK_SIZE_ITEM_COUNT') {
    deepAssign(WRECK_SIZE_ITEM_COUNT, value);
    return;
  }
  if (key === 'RESCUE_REWARDS') {
    deepAssign(RESCUE_REWARDS as any, value);
    return;
  }

  // ── MODULES — deep-merge individual module definitions ───────────────────
  if (key.startsWith('MODULES.')) {
    const moduleId = key.replace('MODULES.', '');
    if ((MODULES as any)[moduleId]) {
      Object.assign((MODULES as any)[moduleId], value);
    }
    return;
  }

  // ── Standalone scalar constants (cannot be reassigned from here) ─────────
  // These are handled exclusively via RUNTIME_CACHE + getConfig().
  // Consumers must use: getConfig('MINING_RATE_PER_SECOND') instead of the
  // direct constant import.
  //
  // Full list of scalar-only keys:
  //   AP_COSTS_LOCAL_SCAN, BASE_HULL_AP_REGEN,
  //   MINING_RATE_PER_SECOND, RESOURCE_REGEN_DELAY_TICKS, RESOURCE_REGEN_INTERVAL_TICKS,
  //   PIRATE_LEVEL_DISTANCE_DIVISOR, PIRATE_MAX_LEVEL, PIRATE_BASE_HP,
  //   PIRATE_HP_PER_LEVEL, PIRATE_BASE_DAMAGE, PIRATE_DAMAGE_PER_LEVEL,
  //   COMBAT_V2_MAX_ROUNDS, COMBAT_V2_ROLL_MIN, COMBAT_V2_ROLL_MAX,
  //   AIM_ACCURACY_BONUS, AIM_DISABLE_CHANCE, AIM_DISABLE_ROUNDS,
  //   EVADE_CHANCE, EMP_HIT_CHANCE, EMP_DISABLE_ROUNDS,
  //   BATTLE_AP_COST_FLEE, BATTLE_CARGO_LOSS_MIN, BATTLE_CARGO_LOSS_MAX,
  //   BATTLE_NEGOTIATE_COST_PER_LEVEL, BATTLE_FLEE_BASE_CHANCE,
  //   STATION_BASE_HP, STATION_REPAIR_CR_PER_HP, STATION_REPAIR_ORE_PER_HP,
  //   STATION_COMBAT_MAX_ROUNDS,
  //   FUEL_COST_PER_UNIT, FUEL_MIN_TANK, FREE_REFUEL_MAX_SHIPS,
  //   STATION_FUEL_BASELINE_PER_TICK, STATION_FUEL_GAS_RATE_PER_TICK,
  //   STATION_FUEL_PER_GAS, STATION_FUEL_MAX_STOCK,
  //   HYPERDRIVE_CHARGE_PER_GAS, HYPERJUMP_FUEL_PER_SECTOR, EMPTY_FUEL_MODIFIER,
  //   NPC_BUY_SPREAD, NPC_SELL_SPREAD,
  //   NPC_XP_DECAY_PER_HOUR, NPC_XP_VISIT, NPC_XP_PER_TRADE_UNIT, NPC_XP_QUEST_COMPLETE,
  //   STATION_REP_VISIT, STATION_REP_TRADE,
  //   MAX_TRADE_ROUTES, TRADE_ROUTE_MIN_CYCLE, TRADE_ROUTE_MAX_CYCLE, TRADE_ROUTE_FUEL_PER_DISTANCE,
  //   ANCIENT_STATION_CHANCE,
  //   NEBULA_ZONE_GRID, NEBULA_ZONE_CHANCE, NEBULA_ZONE_MIN_RADIUS, NEBULA_ZONE_MAX_RADIUS,
  //   NEBULA_SAFE_ORIGIN,
  //   DENSITY_STATION_NEAR, DENSITY_STATION_FAR, DENSITY_PIRATE_NEAR, DENSITY_PIRATE_FAR,
  //   DENSITY_DISTANCE_THRESHOLD,
  //   NEBULA_SCANNER_MALUS, NEBULA_PIRATE_SPAWN_MODIFIER, NEBULA_CONTENT_ENABLED,
  //   BLACK_HOLE_SPAWN_CHANCE, BLACK_HOLE_MIN_DISTANCE, BLACK_HOLE_CLUSTER_GRID,
  //   BLACK_HOLE_CLUSTER_CHANCE, BLACK_HOLE_CLUSTER_MIN_RADIUS, BLACK_HOLE_CLUSTER_MAX_RADIUS,
  //   CONQUEST_POOL_DRAIN_PER_TICK, CONQUEST_POOL_MAX,
  //   JUMPGATE_CHANCE, JUMPGATE_FUEL_COST, JUMPGATE_TRAVEL_COST_CREDITS,
  //   JUMPGATE_MIN_RANGE, JUMPGATE_MAX_RANGE, JUMPGATE_MINIGAME_CHANCE,
  //   JUMPGATE_CODE_CHANCE, JUMPGATE_MAX_CHAIN_HOPS,
  //   PLAYER_GATE_TRAVEL_COST_CREDITS,
  //   HYPERJUMP_BASE_AP, HYPERJUMP_AP_PER_SPEED, HYPERJUMP_MIN_AP,
  //   HYPERJUMP_AP_DISCOUNT, HYPERJUMP_PIRATE_FUEL_PENALTY,
  //   HYPERJUMP_FUEL_DIST_FACTOR, HYPERJUMP_FUEL_MAX_FACTOR,
  //   STALENESS_DIM_HOURS, STALENESS_FADE_DAYS, AUTOPILOT_STEP_MS,
  //   MAX_ACTIVE_QUESTS, QUEST_EXPIRY_DAYS, SCAN_EVENT_CHANCE,
  //   RESCUE_AP_COST, RESCUE_DELIVER_AP_COST, RESCUE_EXPIRY_MINUTES,
  //   DISTRESS_CALL_CHANCE, DISTRESS_DIRECTION_VARIANCE,
  //   DISTRESS_INTERVAL_MIN_MS, DISTRESS_INTERVAL_MAX_MS,
  //   ACEP_PATH_CAP_SHARED,
  //   BASE_SCANNER_MEMORY,
  //   CUSTOM_SLATE_AP_COST, CUSTOM_SLATE_CREDIT_COST,
  //   CUSTOM_SLATE_MAX_COORDS, CUSTOM_SLATE_MAX_CODES, CUSTOM_SLATE_MAX_NOTES_LENGTH,
  //   SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_NPC_PRICE_PER_SECTOR,
  //   BASE_FUEL_CAPACITY, BASE_FUEL_PER_JUMP, BASE_CARGO, BASE_MODULE_SLOTS,
  //   BASE_HP, BASE_JUMP_RANGE, BASE_ENGINE_SPEED, BASE_COMM_RANGE, BASE_SCANNER_LEVEL,
  //   RESEARCH_LAB_MAX_TIER, RESEARCH_TICK_MS,
  //   WRECK_MAX_PER_QUADRANT, WRECK_DIFFICULTY_FAIL_DELTA, WRECK_DIFFICULTY_SUCCESS_DELTA,
  //   WRECK_DIFFICULTY_MAX, WRECK_DIFFICULTY_MIN, WRECK_SLATE_CAP,
  //   WRECK_EXPLORER_CHANCE_PER_XP, WRECK_HELION_ARTEFACT_MIN_CHANCE,
  //   WRECK_INVESTIGATE_AP_COST, WRECK_SALVAGE_AP_COST,
  //   WRECK_SLATE_SELL_BASE, WRECK_SLATE_SELL_PER_TIER, WRECK_SLATE_JUMPGATE_HUMANITY_TAX,
  //
  // Already stored in RUNTIME_CACHE above — no further action needed.
}

// ─── Apply all config ────────────────────────────────────────────────────────

/**
 * Apply all config entries from DB. Called once at startup after snapshotDefaults().
 * @param entries Map of key → JSONB value from the game_config table.
 */
export function applyAllConfig(entries: Map<string, any>): void {
  for (const [key, value] of entries) {
    applyConfigValue(key, value);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Deep-assign: for each key in `source`, if the value is an object (and target
 * has the same key as an object), recurse. Otherwise overwrite.
 * Preserves the target object reference.
 */
function deepAssign(target: any, source: any): void {
  for (const k of Object.keys(source)) {
    if (
      source[k] !== null &&
      typeof source[k] === 'object' &&
      !Array.isArray(source[k]) &&
      target[k] !== null &&
      typeof target[k] === 'object' &&
      !Array.isArray(target[k])
    ) {
      deepAssign(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
}
