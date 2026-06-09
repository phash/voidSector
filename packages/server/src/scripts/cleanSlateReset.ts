import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query, runMigrations } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  ensureZentrumQuadrant,
  ensureAlienHomeQuadrants,
  ensureKernweltStation,
} from '../db/queries.js';
import { ensureOriginTradeStation } from '../engine/npcStationEngine.js';

dotenv.config();

/**
 * Tables fully wiped so only 0:0 + alien homes remain: stations + NPC ships +
 * any in-flight colonization fleets + the expansion log. NOT here: accounts,
 * config, player progress, or the sectors/quadrants map (those are preserved).
 */
export const CLEAN_SLATE_WIPE_TABLES = [
  'civ_stations',
  'civ_ships',
  'npc_fleet',
  'cosmic_npc_fleets',
  'expansion_log',
];

async function wipe(table: string): Promise<void> {
  try {
    // table names are compile-time constants from CLEAN_SLATE_WIPE_TABLES — no injection risk.
    const del = await query(`DELETE FROM ${table}`);
    logger.info({ table, rowCount: del.rowCount }, 'clean-slate: cleared');
  } catch (err) {
    logger.warn({ table, error: (err as Error).message }, 'clean-slate: delete failed');
  }
}

export async function cleanSlateReset(): Promise<void> {
  await runMigrations();

  // 1. Wipe stations / NPC ships / in-flight expansion.
  for (const t of CLEAN_SLATE_WIPE_TABLES) await wipe(t);

  // 2. Drop ALL non-human quadrant control, then re-seed homes fresh from
  //    faction_config. We delete rather than "keep home coords" because a ring
  //    home quadrant may have been pre-claimed by ANOTHER faction during the old
  //    sprawl; keeping it would leave the home owned by the wrong faction (and
  //    ensureAlienHomeQuadrants' ON CONFLICT DO NOTHING can't fix it). A clean
  //    delete + re-seed guarantees each alien home is owned by its own faction.
  const delRes = await query("DELETE FROM quadrant_control WHERE controlling_faction IS DISTINCT FROM 'humans'");
  logger.info({ rowCount: delRes.rowCount }, 'clean-slate: cleared non-human quadrant_control');
  await ensureZentrumQuadrant();
  await ensureAlienHomeQuadrants();

  // 3. Remove non-origin station sectors + stray station data/inventory.
  await query("DELETE FROM sectors WHERE type = 'station' AND NOT (x = 0 AND y = 0)");
  await query('DELETE FROM npc_station_inventory WHERE NOT (station_x = 0 AND station_y = 0)');
  await query('DELETE FROM npc_station_data WHERE NOT (station_x = 0 AND station_y = 0)');

  // 4. Ensure 0:0 exists and is a strong trade station.
  await ensureKernweltStation();
  await ensureOriginTradeStation();

  logger.info('clean-slate: complete — only 0:0 is a station; territory reset to homes.');
}

// Only auto-run when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.endsWith('cleanSlateReset.ts')
  || process.argv[1]?.endsWith('cleanSlateReset.js');
if (invokedDirectly) {
  cleanSlateReset()
    .then(async () => {
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.del('war_ticker', 'trace:recent').catch(() => undefined);
      await redis.quit();
      logger.info('clean-slate: done. Restart not required — generators are already off in code.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'clean-slate failed');
      process.exit(1);
    });
}
