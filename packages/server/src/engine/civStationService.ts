import { QUADRANT_SIZE, CIV_MAX_DRONES_PER_STATION } from '@void-sector/shared';
import { civQueries } from '../db/civQueries.js';
import { getAllQuadrantControls } from '../db/queries.js';
import { logger } from '../utils/logger.js';

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
 * Idempotent — uses INSERT ON CONFLICT DO NOTHING.
 */
export async function ensureCivStations(): Promise<void> {
  const controls = await getAllQuadrantControls();
  let seeded = 0;

  for (const q of controls) {
    if (!q.controlling_faction || q.controlling_faction === 'human') continue;

    const center = getQuadrantCenter(q.qx, q.qy);
    await civQueries.upsertStation(center.x, center.y, q.controlling_faction);
    seeded++;
  }

  logger.info({ seeded }, 'CivStations: ensured stations for faction quadrants');
}

/**
 * Spawn mining drones at shipyard stations that are below drone cap.
 */
export async function spawnMissingDrones(): Promise<void> {
  const stations = await civQueries.getAllStations();
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
