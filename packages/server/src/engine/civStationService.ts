import { QUADRANT_SIZE, CIV_MAX_DRONES_PER_STATION } from '@void-sector/shared';
import { civQueries, getStationsInRange } from '../db/civQueries.js';
import { logger } from '../utils/logger.js';

/** SP10: only spawn drones at shipyard stations within this range of an online player. */
export const DRONE_SPAWN_RADIUS = 200;

/** Returns the center sector coordinates of a quadrant */
export function getQuadrantCenter(
  qx: number, qy: number, size: number = QUADRANT_SIZE,
): { x: number; y: number } {
  return {
    x: qx * size + Math.floor(size / 2),
    y: qy * size + Math.floor(size / 2),
  };
}

export function shouldSpawnDrone(currentCount: number, max: number): boolean {
  return currentCount < max;
}

/**
 * Ensure all faction-controlled quadrants have a civ station at their center.
 * Idempotent — uses INSERT ON CONFLICT DO NOTHING. Runs as ONE set-based query
 * (centers computed in SQL) so it stays O(1) round-trips even on huge worlds;
 * the previous per-quadrant loop blocked startup at 76k+ alien-controlled quadrants.
 */
export async function ensureCivStations(): Promise<void> {
  const half = Math.floor(QUADRANT_SIZE / 2);
  const seeded = await civQueries.bulkEnsureFactionStations(QUADRANT_SIZE, half);
  logger.info({ seeded }, 'CivStations: ensured stations for faction quadrants');
}

/**
 * Spawn mining drones at shipyard stations below the drone cap.
 *
 * SP10: when `anchors` (online-player positions) are given, only stations within
 * DRONE_SPAWN_RADIUS of a player are considered — this bounds the work by player
 * count instead of iterating all ~8k stations (the OOM that disabled this).
 * With no anchors there is nothing to do. `undefined` = legacy all-stations.
 */
export async function spawnMissingDrones(anchors?: Array<{ x: number; y: number }>): Promise<void> {
  let stations: any[];
  if (anchors === undefined) {
    stations = await civQueries.getAllStations();
  } else {
    if (anchors.length === 0) return;
    const byKey = new Map<string, any>();
    for (const a of anchors) {
      const near = await getStationsInRange(a.x, a.y, DRONE_SPAWN_RADIUS);
      for (const s of near) byKey.set(`${s.sector_x}:${s.sector_y}`, s);
    }
    stations = Array.from(byKey.values());
  }
  let spawned = 0;

  for (const station of stations) {
    if (!station.has_shipyard) continue;

    const count = await civQueries.countDronesAtStation(station.sector_x, station.sector_y);
    if (!shouldSpawnDrone(count, CIV_MAX_DRONES_PER_STATION)) continue;

    await civQueries.createShip({
      faction: station.faction,
      ship_type: 'mining_drone',
      state: 'idle',
      x: station.sector_x,
      y: station.sector_y,
      home_x: station.sector_x,
      home_y: station.sector_y,
    });
    spawned++;
  }

  if (spawned > 0) {
    logger.info({ spawned }, 'CivStation: spawned mining drones');
  }
}
