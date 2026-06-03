import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query, runMigrations } from '../db/client.js';
import { logger } from '../utils/logger.js';

dotenv.config();

/** World + cosmic + npc tables — fully cleared. Re-seeded on next server start. */
export const WORLD_RESET_TABLES = [
  'civ_ships',
  'civ_stations',
  'npc_station_inventory',
  'npc_station_data',
  'cosmic_npc_fleets',
  'npc_fleet',
  'construction_sites',
  'craft_sites',
  'wreck_slate_metadata',
  'ship_wrecks',
  'wrecks',
  'player_drones',
  'player_stations',
  'void_cluster_quadrants',
  'expansion_log',
  'quadrant_territory',
  'quadrant_control',
  'sectors',
  'quadrants',
];

/**
 * Per-player progress tables — rows deleted, but the `players` account rows are
 * kept. Order matters: children before parents (e.g. cargo/inventory before ships).
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

async function deleteTable(table: string): Promise<void> {
  try {
    const del = await query(`DELETE FROM ${table}`);
    logger.info({ table, rowCount: del.rowCount }, 'Cleared table');
  } catch (err) {
    logger.info({ table, error: (err as Error).message }, 'Skipped table');
  }
}

async function resetWorld(): Promise<void> {
  await runMigrations();
  logger.info('Migrations complete');

  for (const table of WORLD_RESET_TABLES) await deleteTable(table);
  for (const table of PLAYER_PROGRESS_TABLES) await deleteTable(table);

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
