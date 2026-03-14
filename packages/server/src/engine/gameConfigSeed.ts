// gameConfigSeed.ts — Catalogue of all game balance constants for the config system.
// Each entry maps to a DB row in game_config. getDefault() returns the current
// in-memory value so we can snapshot before any overrides are applied.

import {
  AP_DEFAULTS,
  AP_COSTS,
  AP_COSTS_BY_SCANNER,
  AP_COSTS_LOCAL_SCAN,
  BASE_HULL_AP_REGEN,
  MINING_RATE_PER_SECOND,
  RESOURCE_REGEN_DELAY_TICKS,
  RESOURCE_REGEN_INTERVAL_TICKS,
  SECTOR_RESOURCE_YIELDS,
  ARTEFACT_DROP_CHANCES,
  PIRATE_LEVEL_DISTANCE_DIVISOR,
  PIRATE_MAX_LEVEL,
  PIRATE_BASE_HP,
  PIRATE_HP_PER_LEVEL,
  PIRATE_BASE_DAMAGE,
  PIRATE_DAMAGE_PER_LEVEL,
  COMBAT_V2_MAX_ROUNDS,
  COMBAT_V2_ROLL_MIN,
  COMBAT_V2_ROLL_MAX,
  AIM_ACCURACY_BONUS,
  AIM_DISABLE_CHANCE,
  AIM_DISABLE_ROUNDS,
  EVADE_CHANCE,
  EMP_HIT_CHANCE,
  EMP_DISABLE_ROUNDS,
  TACTIC_MODS,
  BATTLE_AP_COST_FLEE,
  BATTLE_CARGO_LOSS_MIN,
  BATTLE_CARGO_LOSS_MAX,
  BATTLE_NEGOTIATE_COST_PER_LEVEL,
  BATTLE_FLEE_BASE_CHANCE,
  STATION_BASE_HP,
  STATION_REPAIR_CR_PER_HP,
  STATION_REPAIR_ORE_PER_HP,
  STATION_COMBAT_MAX_ROUNDS,
  STATION_DEFENSE_DEFS,
  FUEL_COST_PER_UNIT,
  FUEL_MIN_TANK,
  FREE_REFUEL_MAX_SHIPS,
  STATION_FUEL_BASELINE_PER_TICK,
  STATION_FUEL_GAS_RATE_PER_TICK,
  STATION_FUEL_PER_GAS,
  STATION_FUEL_MAX_STOCK,
  STATION_FUEL_LEVEL_EFFICIENCY,
  HYPERDRIVE_CHARGE_PER_GAS,
  HYPERJUMP_FUEL_PER_SECTOR,
  EMPTY_FUEL_MODIFIER,
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  NPC_XP_DECAY_PER_HOUR,
  NPC_XP_VISIT,
  NPC_XP_PER_TRADE_UNIT,
  NPC_XP_QUEST_COMPLETE,
  NPC_STATION_LEVELS,
  STORAGE_TIERS,
  TRADING_POST_TIERS,
  REP_PRICE_MODIFIERS,
  STATION_REP_VISIT,
  STATION_REP_TRADE,
  MAX_TRADE_ROUTES,
  TRADE_ROUTE_MIN_CYCLE,
  TRADE_ROUTE_MAX_CYCLE,
  TRADE_ROUTE_FUEL_PER_DISTANCE,
  ANCIENT_STATION_CHANCE,
  NEBULA_ZONE_GRID,
  NEBULA_ZONE_CHANCE,
  NEBULA_ZONE_MIN_RADIUS,
  NEBULA_ZONE_MAX_RADIUS,
  NEBULA_SAFE_ORIGIN,
  CONTENT_WEIGHTS,
  SECTOR_ENVIRONMENT_WEIGHTS,
  DENSITY_STATION_NEAR,
  DENSITY_STATION_FAR,
  DENSITY_PIRATE_NEAR,
  DENSITY_PIRATE_FAR,
  DENSITY_DISTANCE_THRESHOLD,
  NEBULA_SCANNER_MALUS,
  NEBULA_PIRATE_SPAWN_MODIFIER,
  NEBULA_CONTENT_ENABLED,
  BLACK_HOLE_SPAWN_CHANCE,
  BLACK_HOLE_MIN_DISTANCE,
  BLACK_HOLE_CLUSTER_GRID,
  BLACK_HOLE_CLUSTER_CHANCE,
  BLACK_HOLE_CLUSTER_MIN_RADIUS,
  BLACK_HOLE_CLUSTER_MAX_RADIUS,
  CONQUEST_POOL_DRAIN_PER_TICK,
  CONQUEST_POOL_MAX,
  CONQUEST_RATE,
  JUMPGATE_CHANCE,
  JUMPGATE_FUEL_COST,
  JUMPGATE_TRAVEL_COST_CREDITS,
  JUMPGATE_MIN_RANGE,
  JUMPGATE_MAX_RANGE,
  JUMPGATE_MINIGAME_CHANCE,
  JUMPGATE_CODE_CHANCE,
  JUMPGATE_MAX_CHAIN_HOPS,
  JUMPGATE_DISTANCE_LIMITS,
  JUMPGATE_CONNECTION_LIMITS,
  PLAYER_GATE_TRAVEL_COST_CREDITS,
  HYPERJUMP_BASE_AP,
  HYPERJUMP_AP_PER_SPEED,
  HYPERJUMP_MIN_AP,
  HYPERJUMP_AP_DISCOUNT,
  HYPERJUMP_PIRATE_FUEL_PENALTY,
  HYPERJUMP_FUEL_DIST_FACTOR,
  HYPERJUMP_FUEL_MAX_FACTOR,
  STALENESS_DIM_HOURS,
  STALENESS_FADE_DAYS,
  AUTOPILOT_STEP_MS,
  MODULES,
  STRUCTURE_COSTS,
  STRUCTURE_AP_COSTS,
  JUMPGATE_BUILD_COST,
  JUMPGATE_UPGRADE_COSTS,
  MAX_ACTIVE_QUESTS,
  QUEST_EXPIRY_DAYS,
  SCAN_EVENT_CHANCE,
  RESCUE_AP_COST,
  RESCUE_DELIVER_AP_COST,
  RESCUE_EXPIRY_MINUTES,
  DISTRESS_CALL_CHANCE,
  DISTRESS_DIRECTION_VARIANCE,
  DISTRESS_INTERVAL_MIN_MS,
  DISTRESS_INTERVAL_MAX_MS,
  RESCUE_REWARDS,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
  ACEP_EXTRA_SLOT_THRESHOLDS,
  ACEP_PATH_CAP_SHARED,
  ACEP_BOOST_COST_TIERS,
  XP_LEVELS,
  SLATE_AP_COST_SECTOR,
  SLATE_AP_COST_AREA,
  SLATE_NPC_PRICE_PER_SECTOR,
  SLATE_AREA_RADIUS,
  BASE_SCANNER_MEMORY,
  CUSTOM_SLATE_AP_COST,
  CUSTOM_SLATE_CREDIT_COST,
  CUSTOM_SLATE_MAX_COORDS,
  CUSTOM_SLATE_MAX_CODES,
  CUSTOM_SLATE_MAX_NOTES_LENGTH,
  BASE_FUEL_CAPACITY,
  BASE_FUEL_PER_JUMP,
  BASE_CARGO,
  BASE_MODULE_SLOTS,
  BASE_HP,
  BASE_JUMP_RANGE,
  BASE_ENGINE_SPEED,
  BASE_COMM_RANGE,
  BASE_SCANNER_LEVEL,
  LAB_WISSEN_MULTIPLIER,
  RESEARCH_TICK_MS,
  WRECK_BASE_DIFFICULTY,
  WRECK_SALVAGE_DURATION_MS,
  WRECK_SIZE_ITEM_COUNT,
  WRECK_MAX_PER_QUADRANT,
  WRECK_DIFFICULTY_FAIL_DELTA,
  WRECK_DIFFICULTY_SUCCESS_DELTA,
  WRECK_DIFFICULTY_MAX,
  WRECK_DIFFICULTY_MIN,
  WRECK_SLATE_CAP,
  WRECK_EXPLORER_CHANCE_PER_XP,
  WRECK_HELION_ARTEFACT_MIN_CHANCE,
  WRECK_INVESTIGATE_AP_COST,
  WRECK_SALVAGE_AP_COST,
  WRECK_SLATE_SELL_BASE,
  WRECK_SLATE_SELL_PER_TIER,
  WRECK_SLATE_JUMPGATE_HUMANITY_TAX,
} from '@void-sector/shared';

export interface ConfigSeedEntry {
  key: string;
  category: string;
  description: string;
  getDefault: () => any;
}

// ─── Static (non-module) seed entries ────────────────────────────────────────

const STATIC_SEED: ConfigSeedEntry[] = [
  // ══════════════════════════════════════════════════════════════════════════════
  // AP
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'AP_DEFAULTS.max', category: 'ap', description: 'Maximum AP', getDefault: () => AP_DEFAULTS.max },
  { key: 'AP_DEFAULTS.startingAP', category: 'ap', description: 'Starting AP for new players', getDefault: () => AP_DEFAULTS.startingAP },
  { key: 'AP_DEFAULTS.regenPerSecond', category: 'ap', description: 'AP regeneration per second (base, without generator)', getDefault: () => AP_DEFAULTS.regenPerSecond },
  { key: 'AP_COSTS.jump', category: 'ap', description: 'AP cost per sector jump', getDefault: () => AP_COSTS.jump },
  { key: 'AP_COSTS.scan', category: 'ap', description: 'AP cost for scan action', getDefault: () => AP_COSTS.scan },
  { key: 'AP_COSTS.mine', category: 'ap', description: 'AP cost for mining', getDefault: () => AP_COSTS.mine },
  { key: 'AP_COSTS_LOCAL_SCAN', category: 'ap', description: 'AP cost for local scan', getDefault: () => AP_COSTS_LOCAL_SCAN },
  { key: 'AP_COSTS_BY_SCANNER', category: 'ap', description: 'Area scan AP costs and radii by scanner level', getDefault: () => AP_COSTS_BY_SCANNER },
  { key: 'BASE_HULL_AP_REGEN', category: 'ap', description: 'Base AP regen per second without generator module', getDefault: () => BASE_HULL_AP_REGEN },

  // ══════════════════════════════════════════════════════════════════════════════
  // Mining
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'MINING_RATE_PER_SECOND', category: 'mining', description: 'Mining rate per second (base)', getDefault: () => MINING_RATE_PER_SECOND },
  { key: 'RESOURCE_REGEN_DELAY_TICKS', category: 'mining', description: 'Ticks before sector resources start regenerating', getDefault: () => RESOURCE_REGEN_DELAY_TICKS },
  { key: 'RESOURCE_REGEN_INTERVAL_TICKS', category: 'mining', description: 'Ticks between resource regen steps', getDefault: () => RESOURCE_REGEN_INTERVAL_TICKS },
  { key: 'SECTOR_RESOURCE_YIELDS', category: 'mining', description: 'Resource yields per sector type', getDefault: () => SECTOR_RESOURCE_YIELDS },
  { key: 'ARTEFACT_DROP_CHANCES', category: 'mining', description: 'Artefact drop chance by event type', getDefault: () => ARTEFACT_DROP_CHANCES },

  // ══════════════════════════════════════════════════════════════════════════════
  // Combat
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'PIRATE_LEVEL_DISTANCE_DIVISOR', category: 'combat', description: 'Distance divisor for pirate level calculation', getDefault: () => PIRATE_LEVEL_DISTANCE_DIVISOR },
  { key: 'PIRATE_MAX_LEVEL', category: 'combat', description: 'Maximum pirate level', getDefault: () => PIRATE_MAX_LEVEL },
  { key: 'PIRATE_BASE_HP', category: 'combat', description: 'Pirate base HP', getDefault: () => PIRATE_BASE_HP },
  { key: 'PIRATE_HP_PER_LEVEL', category: 'combat', description: 'HP gained per pirate level', getDefault: () => PIRATE_HP_PER_LEVEL },
  { key: 'PIRATE_BASE_DAMAGE', category: 'combat', description: 'Pirate base damage', getDefault: () => PIRATE_BASE_DAMAGE },
  { key: 'PIRATE_DAMAGE_PER_LEVEL', category: 'combat', description: 'Damage gained per pirate level', getDefault: () => PIRATE_DAMAGE_PER_LEVEL },
  { key: 'COMBAT_V2_MAX_ROUNDS', category: 'combat', description: 'Maximum combat rounds', getDefault: () => COMBAT_V2_MAX_ROUNDS },
  { key: 'COMBAT_V2_ROLL_MIN', category: 'combat', description: 'Minimum damage roll multiplier', getDefault: () => COMBAT_V2_ROLL_MIN },
  { key: 'COMBAT_V2_ROLL_MAX', category: 'combat', description: 'Maximum damage roll multiplier', getDefault: () => COMBAT_V2_ROLL_MAX },
  { key: 'AIM_ACCURACY_BONUS', category: 'combat', description: 'Aim action accuracy bonus', getDefault: () => AIM_ACCURACY_BONUS },
  { key: 'AIM_DISABLE_CHANCE', category: 'combat', description: 'Aim action disable chance', getDefault: () => AIM_DISABLE_CHANCE },
  { key: 'AIM_DISABLE_ROUNDS', category: 'combat', description: 'Rounds target is disabled by aimed shot', getDefault: () => AIM_DISABLE_ROUNDS },
  { key: 'EVADE_CHANCE', category: 'combat', description: 'Evade action dodge chance', getDefault: () => EVADE_CHANCE },
  { key: 'EMP_HIT_CHANCE', category: 'combat', description: 'EMP hit chance', getDefault: () => EMP_HIT_CHANCE },
  { key: 'EMP_DISABLE_ROUNDS', category: 'combat', description: 'Rounds target is disabled by EMP', getDefault: () => EMP_DISABLE_ROUNDS },
  { key: 'TACTIC_MODS', category: 'combat', description: 'Tactic modifier table (assault/balanced/defensive)', getDefault: () => TACTIC_MODS },
  { key: 'BATTLE_AP_COST_FLEE', category: 'combat', description: 'AP cost to flee from battle', getDefault: () => BATTLE_AP_COST_FLEE },
  { key: 'BATTLE_CARGO_LOSS_MIN', category: 'combat', description: 'Minimum cargo loss fraction on defeat', getDefault: () => BATTLE_CARGO_LOSS_MIN },
  { key: 'BATTLE_CARGO_LOSS_MAX', category: 'combat', description: 'Maximum cargo loss fraction on defeat', getDefault: () => BATTLE_CARGO_LOSS_MAX },
  { key: 'BATTLE_NEGOTIATE_COST_PER_LEVEL', category: 'combat', description: 'Credits per pirate level to negotiate', getDefault: () => BATTLE_NEGOTIATE_COST_PER_LEVEL },
  { key: 'BATTLE_FLEE_BASE_CHANCE', category: 'combat', description: 'Base chance to flee from battle', getDefault: () => BATTLE_FLEE_BASE_CHANCE },
  { key: 'STATION_BASE_HP', category: 'combat', description: 'Station base hit points', getDefault: () => STATION_BASE_HP },
  { key: 'STATION_REPAIR_CR_PER_HP', category: 'combat', description: 'Credits per HP to repair station', getDefault: () => STATION_REPAIR_CR_PER_HP },
  { key: 'STATION_REPAIR_ORE_PER_HP', category: 'combat', description: 'Ore per HP to repair station', getDefault: () => STATION_REPAIR_ORE_PER_HP },
  { key: 'STATION_COMBAT_MAX_ROUNDS', category: 'combat', description: 'Maximum station combat rounds', getDefault: () => STATION_COMBAT_MAX_ROUNDS },
  { key: 'STATION_DEFENSE_DEFS', category: 'combat', description: 'Station defense structure definitions', getDefault: () => STATION_DEFENSE_DEFS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Fuel
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'FUEL_COST_PER_UNIT', category: 'fuel', description: 'Credits per fuel unit', getDefault: () => FUEL_COST_PER_UNIT },
  { key: 'FUEL_MIN_TANK', category: 'fuel', description: 'Minimum fuel tank size', getDefault: () => FUEL_MIN_TANK },
  { key: 'FREE_REFUEL_MAX_SHIPS', category: 'fuel', description: 'Max ships for free refuel', getDefault: () => FREE_REFUEL_MAX_SHIPS },
  { key: 'STATION_FUEL_BASELINE_PER_TICK', category: 'fuel', description: 'Station fuel produced per tick without gas', getDefault: () => STATION_FUEL_BASELINE_PER_TICK },
  { key: 'STATION_FUEL_GAS_RATE_PER_TICK', category: 'fuel', description: 'Station fuel produced per tick with gas', getDefault: () => STATION_FUEL_GAS_RATE_PER_TICK },
  { key: 'STATION_FUEL_PER_GAS', category: 'fuel', description: 'Gas consumed per gas-enhanced fuel tick', getDefault: () => STATION_FUEL_PER_GAS },
  { key: 'STATION_FUEL_MAX_STOCK', category: 'fuel', description: 'Maximum fuel stock per station', getDefault: () => STATION_FUEL_MAX_STOCK },
  { key: 'STATION_FUEL_LEVEL_EFFICIENCY', category: 'fuel', description: 'Fuel production efficiency by station level', getDefault: () => STATION_FUEL_LEVEL_EFFICIENCY },
  { key: 'HYPERDRIVE_CHARGE_PER_GAS', category: 'fuel', description: 'Hyperdrive charge gained per gas unit from cargo', getDefault: () => HYPERDRIVE_CHARGE_PER_GAS },
  { key: 'HYPERJUMP_FUEL_PER_SECTOR', category: 'fuel', description: 'Base fuel cost per sector of hyperjump distance', getDefault: () => HYPERJUMP_FUEL_PER_SECTOR },
  { key: 'EMPTY_FUEL_MODIFIER', category: 'fuel', description: 'Fuel cost modifier in empty space', getDefault: () => EMPTY_FUEL_MODIFIER },

  // ══════════════════════════════════════════════════════════════════════════════
  // Economy
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'NPC_PRICES', category: 'economy', description: 'NPC base prices per resource unit', getDefault: () => NPC_PRICES },
  { key: 'NPC_BUY_SPREAD', category: 'economy', description: 'NPC buy price spread multiplier', getDefault: () => NPC_BUY_SPREAD },
  { key: 'NPC_SELL_SPREAD', category: 'economy', description: 'NPC sell price spread multiplier', getDefault: () => NPC_SELL_SPREAD },
  { key: 'NPC_XP_DECAY_PER_HOUR', category: 'economy', description: 'NPC station XP decay per hour', getDefault: () => NPC_XP_DECAY_PER_HOUR },
  { key: 'NPC_XP_VISIT', category: 'economy', description: 'XP gained per station visit', getDefault: () => NPC_XP_VISIT },
  { key: 'NPC_XP_PER_TRADE_UNIT', category: 'economy', description: 'XP gained per traded unit', getDefault: () => NPC_XP_PER_TRADE_UNIT },
  { key: 'NPC_XP_QUEST_COMPLETE', category: 'economy', description: 'XP gained per quest completion at station', getDefault: () => NPC_XP_QUEST_COMPLETE },
  { key: 'NPC_STATION_LEVELS', category: 'economy', description: 'NPC station level progression', getDefault: () => NPC_STATION_LEVELS },
  { key: 'STORAGE_TIERS', category: 'economy', description: 'Storage structure tier capacity and upgrade costs', getDefault: () => STORAGE_TIERS },
  { key: 'TRADING_POST_TIERS', category: 'economy', description: 'Trading post tier names and upgrade costs', getDefault: () => TRADING_POST_TIERS },
  { key: 'REP_PRICE_MODIFIERS', category: 'economy', description: 'Faction reputation price modifier table', getDefault: () => REP_PRICE_MODIFIERS },
  { key: 'STATION_REP_VISIT', category: 'economy', description: 'Reputation gained per station visit', getDefault: () => STATION_REP_VISIT },
  { key: 'STATION_REP_TRADE', category: 'economy', description: 'Reputation gained per trade at station', getDefault: () => STATION_REP_TRADE },
  { key: 'MAX_TRADE_ROUTES', category: 'economy', description: 'Maximum active trade routes', getDefault: () => MAX_TRADE_ROUTES },
  { key: 'TRADE_ROUTE_MIN_CYCLE', category: 'economy', description: 'Minimum trade route cycle time (minutes)', getDefault: () => TRADE_ROUTE_MIN_CYCLE },
  { key: 'TRADE_ROUTE_MAX_CYCLE', category: 'economy', description: 'Maximum trade route cycle time (minutes)', getDefault: () => TRADE_ROUTE_MAX_CYCLE },
  { key: 'TRADE_ROUTE_FUEL_PER_DISTANCE', category: 'economy', description: 'Fuel consumed per distance unit on trade routes', getDefault: () => TRADE_ROUTE_FUEL_PER_DISTANCE },

  // ══════════════════════════════════════════════════════════════════════════════
  // World
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'ANCIENT_STATION_CHANCE', category: 'world', description: 'Chance of ancient station variant', getDefault: () => ANCIENT_STATION_CHANCE },
  { key: 'NEBULA_ZONE_GRID', category: 'world', description: 'Nebula zone grid spacing', getDefault: () => NEBULA_ZONE_GRID },
  { key: 'NEBULA_ZONE_CHANCE', category: 'world', description: 'Chance that a nebula zone center activates', getDefault: () => NEBULA_ZONE_CHANCE },
  { key: 'NEBULA_ZONE_MIN_RADIUS', category: 'world', description: 'Minimum nebula zone radius', getDefault: () => NEBULA_ZONE_MIN_RADIUS },
  { key: 'NEBULA_ZONE_MAX_RADIUS', category: 'world', description: 'Maximum nebula zone radius', getDefault: () => NEBULA_ZONE_MAX_RADIUS },
  { key: 'NEBULA_SAFE_ORIGIN', category: 'world', description: 'No nebula zones within this distance of origin', getDefault: () => NEBULA_SAFE_ORIGIN },
  { key: 'CONTENT_WEIGHTS', category: 'world', description: 'Sector content generation weights', getDefault: () => CONTENT_WEIGHTS },
  { key: 'SECTOR_ENVIRONMENT_WEIGHTS', category: 'world', description: 'Sector environment type weights', getDefault: () => SECTOR_ENVIRONMENT_WEIGHTS },
  { key: 'DENSITY_STATION_NEAR', category: 'world', description: 'Station density multiplier near origin', getDefault: () => DENSITY_STATION_NEAR },
  { key: 'DENSITY_STATION_FAR', category: 'world', description: 'Station density multiplier far from origin', getDefault: () => DENSITY_STATION_FAR },
  { key: 'DENSITY_PIRATE_NEAR', category: 'world', description: 'Pirate density multiplier near origin', getDefault: () => DENSITY_PIRATE_NEAR },
  { key: 'DENSITY_PIRATE_FAR', category: 'world', description: 'Pirate density multiplier far from origin', getDefault: () => DENSITY_PIRATE_FAR },
  { key: 'DENSITY_DISTANCE_THRESHOLD', category: 'world', description: 'Chebyshev distance for density transition', getDefault: () => DENSITY_DISTANCE_THRESHOLD },
  { key: 'NEBULA_SCANNER_MALUS', category: 'world', description: 'Scanner range penalty in nebula', getDefault: () => NEBULA_SCANNER_MALUS },
  { key: 'NEBULA_PIRATE_SPAWN_MODIFIER', category: 'world', description: 'Pirate spawn modifier in nebula', getDefault: () => NEBULA_PIRATE_SPAWN_MODIFIER },
  { key: 'NEBULA_CONTENT_ENABLED', category: 'world', description: 'Whether nebula sectors get content rolls', getDefault: () => NEBULA_CONTENT_ENABLED },
  { key: 'BLACK_HOLE_SPAWN_CHANCE', category: 'world', description: 'Black hole spawn chance', getDefault: () => BLACK_HOLE_SPAWN_CHANCE },
  { key: 'BLACK_HOLE_MIN_DISTANCE', category: 'world', description: 'Minimum distance from origin for black holes', getDefault: () => BLACK_HOLE_MIN_DISTANCE },
  { key: 'BLACK_HOLE_CLUSTER_GRID', category: 'world', description: 'Black hole cluster grid spacing', getDefault: () => BLACK_HOLE_CLUSTER_GRID },
  { key: 'BLACK_HOLE_CLUSTER_CHANCE', category: 'world', description: 'Chance a grid cell is a black hole cluster center', getDefault: () => BLACK_HOLE_CLUSTER_CHANCE },
  { key: 'BLACK_HOLE_CLUSTER_MIN_RADIUS', category: 'world', description: 'Minimum black hole cluster radius', getDefault: () => BLACK_HOLE_CLUSTER_MIN_RADIUS },
  { key: 'BLACK_HOLE_CLUSTER_MAX_RADIUS', category: 'world', description: 'Maximum black hole cluster radius', getDefault: () => BLACK_HOLE_CLUSTER_MAX_RADIUS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Conquest
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'CONQUEST_POOL_DRAIN_PER_TICK', category: 'conquest', description: 'Conquest pool drain per tick', getDefault: () => CONQUEST_POOL_DRAIN_PER_TICK },
  { key: 'CONQUEST_POOL_MAX', category: 'conquest', description: 'Maximum conquest pool', getDefault: () => CONQUEST_POOL_MAX },
  { key: 'CONQUEST_RATE', category: 'conquest', description: 'Conquest rate table by tier', getDefault: () => CONQUEST_RATE },

  // ══════════════════════════════════════════════════════════════════════════════
  // Navigation
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'JUMPGATE_CHANCE', category: 'navigation', description: 'Natural jumpgate spawn chance', getDefault: () => JUMPGATE_CHANCE },
  { key: 'JUMPGATE_FUEL_COST', category: 'navigation', description: 'Fuel cost to use a jumpgate', getDefault: () => JUMPGATE_FUEL_COST },
  { key: 'JUMPGATE_TRAVEL_COST_CREDITS', category: 'navigation', description: 'Credits to use a public jumpgate', getDefault: () => JUMPGATE_TRAVEL_COST_CREDITS },
  { key: 'JUMPGATE_MIN_RANGE', category: 'navigation', description: 'Minimum jumpgate connection range', getDefault: () => JUMPGATE_MIN_RANGE },
  { key: 'JUMPGATE_MAX_RANGE', category: 'navigation', description: 'Maximum jumpgate connection range', getDefault: () => JUMPGATE_MAX_RANGE },
  { key: 'JUMPGATE_MINIGAME_CHANCE', category: 'navigation', description: 'Chance of jumpgate minigame on use', getDefault: () => JUMPGATE_MINIGAME_CHANCE },
  { key: 'JUMPGATE_CODE_CHANCE', category: 'navigation', description: 'Chance of jumpgate code challenge', getDefault: () => JUMPGATE_CODE_CHANCE },
  { key: 'JUMPGATE_MAX_CHAIN_HOPS', category: 'navigation', description: 'Maximum jumpgate chain hops', getDefault: () => JUMPGATE_MAX_CHAIN_HOPS },
  { key: 'JUMPGATE_DISTANCE_LIMITS', category: 'navigation', description: 'Jumpgate max distance by upgrade tier', getDefault: () => JUMPGATE_DISTANCE_LIMITS },
  { key: 'JUMPGATE_CONNECTION_LIMITS', category: 'navigation', description: 'Jumpgate max connections by upgrade tier', getDefault: () => JUMPGATE_CONNECTION_LIMITS },
  { key: 'PLAYER_GATE_TRAVEL_COST_CREDITS', category: 'navigation', description: 'Credits to use a player-built jumpgate', getDefault: () => PLAYER_GATE_TRAVEL_COST_CREDITS },
  { key: 'HYPERJUMP_BASE_AP', category: 'navigation', description: 'Base AP cost for hyperjump', getDefault: () => HYPERJUMP_BASE_AP },
  { key: 'HYPERJUMP_AP_PER_SPEED', category: 'navigation', description: 'AP reduction per engine speed level', getDefault: () => HYPERJUMP_AP_PER_SPEED },
  { key: 'HYPERJUMP_MIN_AP', category: 'navigation', description: 'Minimum AP cost for hyperjump', getDefault: () => HYPERJUMP_MIN_AP },
  { key: 'HYPERJUMP_AP_DISCOUNT', category: 'navigation', description: 'AP discount for known hyperjump routes', getDefault: () => HYPERJUMP_AP_DISCOUNT },
  { key: 'HYPERJUMP_PIRATE_FUEL_PENALTY', category: 'navigation', description: 'Fuel penalty multiplier for pirate sectors', getDefault: () => HYPERJUMP_PIRATE_FUEL_PENALTY },
  { key: 'HYPERJUMP_FUEL_DIST_FACTOR', category: 'navigation', description: 'Hyperjump fuel distance scaling factor', getDefault: () => HYPERJUMP_FUEL_DIST_FACTOR },
  { key: 'HYPERJUMP_FUEL_MAX_FACTOR', category: 'navigation', description: 'Hyperjump fuel maximum scaling factor', getDefault: () => HYPERJUMP_FUEL_MAX_FACTOR },
  { key: 'STALENESS_DIM_HOURS', category: 'navigation', description: 'Hours until scanned sectors dim', getDefault: () => STALENESS_DIM_HOURS },
  { key: 'STALENESS_FADE_DAYS', category: 'navigation', description: 'Days until scanned sectors fade to coords-only', getDefault: () => STALENESS_FADE_DAYS },
  { key: 'AUTOPILOT_STEP_MS', category: 'navigation', description: 'Milliseconds per sector during autopilot', getDefault: () => AUTOPILOT_STEP_MS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Structures
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'STRUCTURE_COSTS', category: 'structures', description: 'Resource costs to build structures', getDefault: () => STRUCTURE_COSTS },
  { key: 'STRUCTURE_AP_COSTS', category: 'structures', description: 'AP costs to build structures', getDefault: () => STRUCTURE_AP_COSTS },
  { key: 'JUMPGATE_BUILD_COST', category: 'structures', description: 'Cost to build player jumpgate', getDefault: () => JUMPGATE_BUILD_COST },
  { key: 'JUMPGATE_UPGRADE_COSTS', category: 'structures', description: 'Jumpgate upgrade costs by type', getDefault: () => JUMPGATE_UPGRADE_COSTS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Quests
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'MAX_ACTIVE_QUESTS', category: 'quests', description: 'Maximum active quests per player', getDefault: () => MAX_ACTIVE_QUESTS },
  { key: 'QUEST_EXPIRY_DAYS', category: 'quests', description: 'Days until a quest expires', getDefault: () => QUEST_EXPIRY_DAYS },
  { key: 'SCAN_EVENT_CHANCE', category: 'quests', description: 'Chance of scan event triggering', getDefault: () => SCAN_EVENT_CHANCE },
  { key: 'RESCUE_AP_COST', category: 'quests', description: 'AP cost to attempt rescue', getDefault: () => RESCUE_AP_COST },
  { key: 'RESCUE_DELIVER_AP_COST', category: 'quests', description: 'AP cost to deliver rescued cargo', getDefault: () => RESCUE_DELIVER_AP_COST },
  { key: 'RESCUE_EXPIRY_MINUTES', category: 'quests', description: 'Minutes until rescue mission expires', getDefault: () => RESCUE_EXPIRY_MINUTES },
  { key: 'DISTRESS_CALL_CHANCE', category: 'quests', description: 'Chance of distress call per eligible tick', getDefault: () => DISTRESS_CALL_CHANCE },
  { key: 'DISTRESS_DIRECTION_VARIANCE', category: 'quests', description: 'Direction variance for distress call signals', getDefault: () => DISTRESS_DIRECTION_VARIANCE },
  { key: 'DISTRESS_INTERVAL_MIN_MS', category: 'quests', description: 'Minimum ms between distress calls per quadrant', getDefault: () => DISTRESS_INTERVAL_MIN_MS },
  { key: 'DISTRESS_INTERVAL_MAX_MS', category: 'quests', description: 'Maximum ms between distress calls per quadrant', getDefault: () => DISTRESS_INTERVAL_MAX_MS },
  { key: 'RESCUE_REWARDS', category: 'quests', description: 'Rescue mission reward table', getDefault: () => RESCUE_REWARDS },

  // ══════════════════════════════════════════════════════════════════════════════
  // ACEP
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'ACEP_LEVEL_THRESHOLDS', category: 'acep', description: 'ACEP XP thresholds per level', getDefault: () => ACEP_LEVEL_THRESHOLDS },
  { key: 'ACEP_LEVEL_MULTIPLIERS', category: 'acep', description: 'ACEP stat multipliers per level', getDefault: () => ACEP_LEVEL_MULTIPLIERS },
  { key: 'ACEP_EXTRA_SLOT_THRESHOLDS', category: 'acep', description: 'Ausbau XP thresholds for extra module slots', getDefault: () => ACEP_EXTRA_SLOT_THRESHOLDS },
  { key: 'ACEP_PATH_CAP_SHARED', category: 'acep', description: 'Maximum XP per ACEP path', getDefault: () => ACEP_PATH_CAP_SHARED },
  { key: 'ACEP_BOOST_COST_TIERS', category: 'acep', description: 'ACEP boost cost tiers (credits + wissen)', getDefault: () => ACEP_BOOST_COST_TIERS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Progression
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'XP_LEVELS', category: 'progression', description: 'XP required per player level', getDefault: () => XP_LEVELS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Scanning
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'SLATE_AP_COST_SECTOR', category: 'scanning', description: 'AP cost for sector data slate', getDefault: () => SLATE_AP_COST_SECTOR },
  { key: 'SLATE_AP_COST_AREA', category: 'scanning', description: 'AP cost for area data slate', getDefault: () => SLATE_AP_COST_AREA },
  { key: 'SLATE_NPC_PRICE_PER_SECTOR', category: 'scanning', description: 'NPC price per sector for data slate', getDefault: () => SLATE_NPC_PRICE_PER_SECTOR },
  { key: 'SLATE_AREA_RADIUS', category: 'scanning', description: 'Area scan radius by scanner level', getDefault: () => SLATE_AREA_RADIUS },
  { key: 'BASE_SCANNER_MEMORY', category: 'scanning', description: 'Base scanner memory slots', getDefault: () => BASE_SCANNER_MEMORY },
  { key: 'CUSTOM_SLATE_AP_COST', category: 'scanning', description: 'AP cost for custom data slate', getDefault: () => CUSTOM_SLATE_AP_COST },
  { key: 'CUSTOM_SLATE_CREDIT_COST', category: 'scanning', description: 'Credit cost for custom data slate', getDefault: () => CUSTOM_SLATE_CREDIT_COST },
  { key: 'CUSTOM_SLATE_MAX_COORDS', category: 'scanning', description: 'Maximum coords in custom data slate', getDefault: () => CUSTOM_SLATE_MAX_COORDS },
  { key: 'CUSTOM_SLATE_MAX_CODES', category: 'scanning', description: 'Maximum codes in custom data slate', getDefault: () => CUSTOM_SLATE_MAX_CODES },
  { key: 'CUSTOM_SLATE_MAX_NOTES_LENGTH', category: 'scanning', description: 'Maximum notes length in custom data slate', getDefault: () => CUSTOM_SLATE_MAX_NOTES_LENGTH },

  // ══════════════════════════════════════════════════════════════════════════════
  // Ship (base stats)
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'BASE_FUEL_CAPACITY', category: 'ship', description: 'Base fuel capacity', getDefault: () => BASE_FUEL_CAPACITY },
  { key: 'BASE_FUEL_PER_JUMP', category: 'ship', description: 'Base fuel consumed per jump', getDefault: () => BASE_FUEL_PER_JUMP },
  { key: 'BASE_CARGO', category: 'ship', description: 'Base cargo capacity', getDefault: () => BASE_CARGO },
  { key: 'BASE_MODULE_SLOTS', category: 'ship', description: 'Base module slots', getDefault: () => BASE_MODULE_SLOTS },
  { key: 'BASE_HP', category: 'ship', description: 'Base hit points', getDefault: () => BASE_HP },
  { key: 'BASE_JUMP_RANGE', category: 'ship', description: 'Base jump range', getDefault: () => BASE_JUMP_RANGE },
  { key: 'BASE_ENGINE_SPEED', category: 'ship', description: 'Base engine speed', getDefault: () => BASE_ENGINE_SPEED },
  { key: 'BASE_COMM_RANGE', category: 'ship', description: 'Base communication range', getDefault: () => BASE_COMM_RANGE },
  { key: 'BASE_SCANNER_LEVEL', category: 'ship', description: 'Base scanner level', getDefault: () => BASE_SCANNER_LEVEL },

  // ══════════════════════════════════════════════════════════════════════════════
  // Research
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'LAB_WISSEN_MULTIPLIER', category: 'research', description: 'Lab tier Wissen generation multiplier', getDefault: () => LAB_WISSEN_MULTIPLIER },
  { key: 'RESEARCH_TICK_MS', category: 'research', description: 'Research tick interval in milliseconds', getDefault: () => RESEARCH_TICK_MS },

  // ══════════════════════════════════════════════════════════════════════════════
  // Timers
  // ══════════════════════════════════════════════════════════════════════════════
  // AUTOPILOT_STEP_MS already in navigation
  // DISTRESS_INTERVAL_*_MS already in quests
  // RESEARCH_TICK_MS already in research

  // ══════════════════════════════════════════════════════════════════════════════
  // Wrecks
  // ══════════════════════════════════════════════════════════════════════════════
  { key: 'WRECK_BASE_DIFFICULTY', category: 'wrecks', description: 'Base difficulty per wreck loot type', getDefault: () => WRECK_BASE_DIFFICULTY },
  { key: 'WRECK_SALVAGE_DURATION_MS', category: 'wrecks', description: 'Salvage duration by wreck size (ms)', getDefault: () => WRECK_SALVAGE_DURATION_MS },
  { key: 'WRECK_SIZE_ITEM_COUNT', category: 'wrecks', description: 'Item count range by wreck size [min, max]', getDefault: () => WRECK_SIZE_ITEM_COUNT },
  { key: 'WRECK_MAX_PER_QUADRANT', category: 'wrecks', description: 'Maximum wrecks per quadrant', getDefault: () => WRECK_MAX_PER_QUADRANT },
  { key: 'WRECK_DIFFICULTY_FAIL_DELTA', category: 'wrecks', description: 'Difficulty increase on failed salvage', getDefault: () => WRECK_DIFFICULTY_FAIL_DELTA },
  { key: 'WRECK_DIFFICULTY_SUCCESS_DELTA', category: 'wrecks', description: 'Difficulty change on successful salvage', getDefault: () => WRECK_DIFFICULTY_SUCCESS_DELTA },
  { key: 'WRECK_DIFFICULTY_MAX', category: 'wrecks', description: 'Maximum difficulty delta', getDefault: () => WRECK_DIFFICULTY_MAX },
  { key: 'WRECK_DIFFICULTY_MIN', category: 'wrecks', description: 'Minimum difficulty delta', getDefault: () => WRECK_DIFFICULTY_MIN },
  { key: 'WRECK_SLATE_CAP', category: 'wrecks', description: 'Maximum data slates from wrecks', getDefault: () => WRECK_SLATE_CAP },
  { key: 'WRECK_EXPLORER_CHANCE_PER_XP', category: 'wrecks', description: 'Extra salvage chance per explorer XP', getDefault: () => WRECK_EXPLORER_CHANCE_PER_XP },
  { key: 'WRECK_HELION_ARTEFACT_MIN_CHANCE', category: 'wrecks', description: 'Minimum artefact chance at max explorer XP', getDefault: () => WRECK_HELION_ARTEFACT_MIN_CHANCE },
  { key: 'WRECK_INVESTIGATE_AP_COST', category: 'wrecks', description: 'AP cost to investigate a wreck', getDefault: () => WRECK_INVESTIGATE_AP_COST },
  { key: 'WRECK_SALVAGE_AP_COST', category: 'wrecks', description: 'AP cost to salvage a wreck', getDefault: () => WRECK_SALVAGE_AP_COST },
  { key: 'WRECK_SLATE_SELL_BASE', category: 'wrecks', description: 'Base sell price for wreck data slates', getDefault: () => WRECK_SLATE_SELL_BASE },
  { key: 'WRECK_SLATE_SELL_PER_TIER', category: 'wrecks', description: 'Extra sell price per wreck tier', getDefault: () => WRECK_SLATE_SELL_PER_TIER },
  { key: 'WRECK_SLATE_JUMPGATE_HUMANITY_TAX', category: 'wrecks', description: 'Humanity tax for jumpgate data slates from wrecks', getDefault: () => WRECK_SLATE_JUMPGATE_HUMANITY_TAX },
];

// ─── Module seed entries (generated from MODULES object) ─────────────────────

function buildModuleEntries(): ConfigSeedEntry[] {
  const entries: ConfigSeedEntry[] = [];
  for (const moduleId of Object.keys(MODULES)) {
    entries.push({
      key: `MODULES.${moduleId}`,
      category: 'modules',
      description: `Module definition: ${MODULES[moduleId].name}`,
      getDefault: () => MODULES[moduleId],
    });
  }
  return entries;
}

// ─── Combined seed ───────────────────────────────────────────────────────────

export const CONFIG_SEED: ConfigSeedEntry[] = [
  ...STATIC_SEED,
  ...buildModuleEntries(),
];
