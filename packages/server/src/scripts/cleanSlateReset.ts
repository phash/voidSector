import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query, runMigrations } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  ensureZentrumQuadrant,
  ensureAlienHomeQuadrants,
  ensureKernweltStation,
  getAllFactionConfigs,
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

/** Set of "qx:qy" keys for the home quadrants (human 0:0 + every alien home). */
export function homeQuadrantSet(
  factions: { faction_id: string; home_qx: number; home_qy: number }[],
): Set<string> {
  const homes = new Set<string>(['0:0']);
  for (const f of factions) {
    if (f.faction_id === 'humans') continue;
    homes.add(`${f.home_qx}:${f.home_qy}`);
  }
  return homes;
}

/** Build the parameterised DELETE that keeps only the given home quadrants. */
export function nonHomeDeleteSql(homes: Set<string>): { sql: string; params: number[] } {
  if (homes.size === 0) return { sql: 'DELETE FROM quadrant_control', params: [] };
  const params: number[] = [];
  const tuples: string[] = [];
  for (const key of homes) {
    const [qx, qy] = key.split(':').map(Number);
    tuples.push(`($${params.length + 1}, $${params.length + 2})`);
    params.push(qx, qy);
  }
  return {
    sql: `DELETE FROM quadrant_control WHERE (qx, qy) NOT IN (${tuples.join(', ')})`,
    params,
  };
}

async function wipe(table: string): Promise<void> {
  try {
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

  // 2. Reduce quadrant_control to home quadrants, then re-seed the homes.
  const factions = await getAllFactionConfigs();
  const homes = homeQuadrantSet(factions);
  const { sql, params } = nonHomeDeleteSql(homes);
  const delRes = await query(sql, params);
  logger.info({ rowCount: delRes.rowCount, kept: homes.size }, 'clean-slate: quadrant_control reduced to homes');
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
