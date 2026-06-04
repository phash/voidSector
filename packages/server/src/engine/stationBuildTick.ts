import { getDueStationBuilds, completeStationBuild, getAllPlayerStationsWithRefinery } from '../db/stationQueries.js';
import { addCredits } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { refineryCreditsPerTick } from './stationPassiveEffects.js';

/**
 * Completes any player-station expansion builds whose timer has elapsed.
 * Lightweight: only touches player_stations rows currently building.
 */
export async function processStationBuildTick(): Promise<void> {
  const due = await getDueStationBuilds();
  for (const station of due) {
    const type = station.building_expansion;
    if (!type) continue;
    try {
      await completeStationBuild(station.id, type);
      logger.info({ stationId: station.id, type }, 'Station expansion build complete');
    } catch (err) {
      logger.error({ err, stationId: station.id }, 'Station build completion failed');
    }
  }

  // Refinery passive income: pay each station owner a credits trickle.
  try {
    const refineries = await getAllPlayerStationsWithRefinery();
    for (const r of refineries) {
      const credits = refineryCreditsPerTick(r.refinery_level);
      if (credits > 0) await addCredits(r.owner_id, credits);
    }
  } catch (err) {
    logger.error({ err }, 'Refinery trickle failed');
  }
}
