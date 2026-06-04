import { getDueStationBuilds, completeStationBuild } from '../db/stationQueries.js';
import { logger } from '../utils/logger.js';
import type { StationExpansionType } from '@void-sector/shared';

/**
 * Completes any player-station expansion builds whose timer has elapsed.
 * Lightweight: only touches player_stations rows currently building.
 */
export async function processStationBuildTick(): Promise<void> {
  const due = await getDueStationBuilds();
  for (const station of due) {
    const type = station.building_expansion as StationExpansionType | null;
    if (!type) continue;
    try {
      await completeStationBuild(station.id, type);
      logger.info({ stationId: station.id, type }, 'Station expansion build complete');
    } catch (err) {
      logger.error({ err, stationId: station.id }, 'Station build completion failed');
    }
  }
}
