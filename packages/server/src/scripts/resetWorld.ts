import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query, runMigrations } from '../db/client.js';
import { logger } from '../utils/logger.js';

dotenv.config();

/**
 * World + cosmic + npc + world-activity tables — fully cleared. The fresh world
 * is re-seeded on next server start by the ensure* functions. Reference/config
 * tables (game_config, faction_config, *_definitions, etc.) are intentionally NOT
 * here — deleting them would break the game.
 */
export const WORLD_RESET_TABLES = [
  // NPC / civ presence
  'civ_ships',
  'civ_stations',
  'npc_station_inventory',
  'npc_station_data',
  'cosmic_npc_fleets',
  'npc_fleet',
  // structures / production (children before player_stations)
  'station_production_queue',
  'station_production',
  'station_blueprints',
  'station_battle_log',
  'factory_state',
  'construction_sites',
  'craft_sites',
  'wreck_slate_metadata',
  'ship_wrecks',
  'wrecks',
  'drone_missions',
  'drone_routes',
  'player_drones',
  'player_stations',
  // economy / trade
  'trade_orders',
  'trade_routes',
  'kontor_orders',
  // jumpgates (links before gates)
  'jumpgate_links',
  'jumpgates',
  // world activity / events / logs
  'distress_calls',
  'rescued_survivors',
  'alien_encounters',
  'news_events',
  'battle_log',
  'combat_log',
  'spawn_clusters',
  'territory_claims',
  // expansion + quadrant control (control deleted before void_clusters: FK void_cluster_id)
  'expansion_log',
  'quadrant_control',
  'quadrant_territory',
  // void lifecycle (children before parent void_clusters)
  'void_hives',
  'void_frontier_sectors',
  'void_cluster_quadrants',
  'void_clusters',
  // map (last)
  'sectors',
  'quadrants',
];

/**
 * Per-player progress tables — rows deleted, but the `players` account rows are
 * kept. Lazy regeneration on next login restores a fresh ship/position/ACEP.
 * `ships` is last (other player tables may reference it).
 */
export const PLAYER_PROGRESS_TABLES = [
  'cargo',
  'inventory',
  'storage_inventory',
  'acep_blueprints',
  'player_discoveries',
  'player_known_jumpgates',
  'player_known_quadrants',
  'player_quadrant_visits',
  'player_bookmarks',
  'autopilot_routes',
  'player_auto_refuel',
  'player_station_reputation',
  'player_reputation',
  'alien_reputation',
  'player_quests',
  'story_quest_progress',
  'player_research',
  'active_research',
  'player_research_v2',
  'player_modules_v2',
  'player_tech_tree',
  'player_upgrades',
  'player_civ_contributions',
  'player_distress_calls',
  'player_friends',
  'friend_requests',
  'player_blocks',
  'faction_invites',
  'faction_members',
  'faction_upgrades',
  'factions',
  'humanity_reputation',
  'civilization_meter',
  'messages',
  'ships',
];

/** Deletes one table. Returns true on success, false on error (e.g. FK order). */
async function deleteTable(table: string): Promise<boolean> {
  try {
    const del = await query(`DELETE FROM ${table}`);
    logger.info({ table, rowCount: del.rowCount }, 'Cleared table');
    return true;
  } catch (err) {
    logger.info({ table, error: (err as Error).message }, 'Delete failed (will retry)');
    return false;
  }
}

/**
 * Wipe tables with retry-until-stable: a table whose delete fails due to FK order
 * is retried on a later pass once its dependents are gone. Tables still failing
 * after the passes are warned (likely a missing table or a real FK we can't clear).
 */
async function wipeTables(tables: string[]): Promise<void> {
  let remaining = [...tables];
  for (let pass = 0; pass < 3 && remaining.length > 0; pass++) {
    const stillFailing: string[] = [];
    for (const table of remaining) {
      const ok = await deleteTable(table);
      if (!ok) stillFailing.push(table);
    }
    remaining = stillFailing;
  }
  if (remaining.length > 0) {
    logger.warn({ tables: remaining }, 'Tables could not be cleared after retries');
  }
}

async function resetWorld(): Promise<void> {
  await runMigrations();
  logger.info('Migrations complete');

  await wipeTables(WORLD_RESET_TABLES);
  await wipeTables(PLAYER_PROGRESS_TABLES);

  // Keep accounts, reset their scalar progress fields.
  try {
    const upd = await query(
      'UPDATE players SET xp = 0, level = 1, credits = 0, alien_credits = 0',
    );
    logger.info({ rowCount: upd.rowCount }, 'Reset player scalar fields');
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to reset player fields');
  }

  // Flush Redis (AP / fuel / mining / position / online caches).
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await redis.flushall();
  await redis.quit();
  logger.info('Redis flushed');

  logger.info(
    'Reset complete. Restart the server — ensure* functions re-seed the fresh world ' +
      '(Kernwelt station @0:0, Zentrum quadrant, alien homes).',
  );
  process.exit(0);
}

// Only auto-run when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.endsWith('resetWorld.ts')
  || process.argv[1]?.endsWith('resetWorld.js');
if (invokedDirectly) {
  resetWorld().catch((err) => {
    logger.error({ err }, 'Reset failed');
    process.exit(1);
  });
}
