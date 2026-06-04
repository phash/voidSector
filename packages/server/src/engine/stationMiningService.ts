import {
  QUADRANT_SIZE,
  STATION_MINING_SHIPS_PER_WERFT_LEVEL,
  stationTierForVolume,
  type CivShip,
  type MineableResourceType,
} from '@void-sector/shared';
import {
  getAllStationMiningShips,
  createStationMiningShip,
  updateStationMiningShip,
  countStationMiningShips,
  getStationsEligibleForMining,
  toCivShip,
} from '../db/stationMiningQueries.js';
import {
  getPlayerStationById,
  addTradeVolume,
  setStationLevel,
  updateStationCargo,
} from '../db/stationQueries.js';
import { addCredits } from '../db/queries.js';
import { civShipBus } from '../civShipBus.js';
import { nextShipState } from './civShipService.js';
import { resolveMiningDelivery } from './stationMiningDelivery.js';
import { logger } from '../utils/logger.js';

function sectorToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return { qx: Math.floor(x / QUADRANT_SIZE), qy: Math.floor(y / QUADRANT_SIZE) };
}

/** Ensure each Werft-equipped station operates up to (werft_level) mining ships. */
export async function spawnMissingStationMiningShips(): Promise<void> {
  const stations = await getStationsEligibleForMining();
  for (const st of stations) {
    const cap = st.werft_level * STATION_MINING_SHIPS_PER_WERFT_LEVEL;
    const have = await countStationMiningShips(st.id);
    for (let i = have; i < cap; i++) {
      await createStationMiningShip({
        station_id: st.id,
        owner_id: st.owner_id,
        x: st.sector_x,
        y: st.sector_y,
        home_x: st.sector_x,
        home_y: st.sector_y,
      });
    }
  }
}

/** Apply a station mining ship's haul on its return: auto-sell (Markt) or store. */
async function deliverHaul(stationId: string, resource: MineableResourceType, amount: number): Promise<void> {
  const station = await getPlayerStationById(stationId);
  if (!station) return;
  const decision = resolveMiningDelivery(
    { markt_level: station.markt_level, cargo_level: station.cargo_level, cargo_contents: station.cargo_contents },
    resource,
    amount,
  );
  if (decision.mode === 'sell') {
    if (decision.credits > 0) await addCredits(station.owner_id, decision.credits);
    const updated = await addTradeVolume(stationId, decision.volume);
    if (updated) {
      const newTier = stationTierForVolume(updated.trade_volume);
      if (newTier > updated.level) await setStationLevel(stationId, newTier);
    }
  } else {
    await updateStationCargo(stationId, decision.newCargo);
  }
}

/**
 * Tick player-station mining ships ONLY (a few dozen). Bounded: it never loads
 * the disabled NPC civ-ship fleet. Movement reuses nextShipState; rendering reuses
 * the civShipBus -> SectorRoom -> radar (mining_drone) path.
 *
 * Note: station ships are broadcast via the same civShipBus channel + CivShip shape
 * as NPC civ ships. The NPC civ tick (processCivTick) is currently DISABLED, so the
 * integer id spaces (station_mining_ships.id vs civ_ships.id) never collide live; if
 * the NPC tick is ever re-enabled, namespace one set's ids before broadcasting.
 * spawnMissingStationMiningShips runs each tick (a count query per eligible station);
 * cheap given few player stations.
 */
export async function processStationMiningTick(): Promise<void> {
  try {
    await spawnMissingStationMiningShips();

    const rows = await getAllStationMiningShips();
    if (rows.length === 0) return;

    const quadrantShips = new Map<string, CivShip[]>();

    for (const row of rows) {
      const ship = toCivShip(row);
      const updates = nextShipState(ship, null, 0);
      if (Object.keys(updates).length === 0) continue;
      const updated: CivShip = { ...ship, ...updates };

      await updateStationMiningShip(row.id, {
        state: updated.state,
        x: updated.x,
        y: updated.y,
        target_x: updated.target_x ?? null,
        target_y: updated.target_y ?? null,
        spiral_step: updated.spiral_step ?? 0,
        resources_carried: updated.resources_carried ?? 0,
        mined_resource: updated.mined_resource ?? null,
      });

      // Delivery: ship just arrived home with a haul.
      if (row.state === 'returning' && updated.state === 'idle' && (row.resources_carried ?? 0) > 0) {
        const resource = (row.mined_resource ?? 'ore') as MineableResourceType;
        try {
          await deliverHaul(row.station_id, resource, row.resources_carried);
        } catch (err) {
          logger.error({ err, stationId: row.station_id }, 'Station mining delivery failed');
        }
      }

      const { qx, qy } = sectorToQuadrant(updated.x, updated.y);
      const key = `${qx}:${qy}`;
      if (!quadrantShips.has(key)) quadrantShips.set(key, []);
      quadrantShips.get(key)!.push(updated);
    }

    for (const [key, ships] of quadrantShips) {
      const [qx, qy] = key.split(':').map(Number);
      civShipBus.broadcastTick({ qx, qy, ships });
    }
  } catch (err) {
    logger.error({ err }, 'processStationMiningTick error');
  }
}
