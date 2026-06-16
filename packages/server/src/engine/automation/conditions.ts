/**
 * Condition evaluator for the ship automation DSL.
 * Evaluates a Condition against live Redis + Postgres state without a Colyseus client.
 */
import type { Condition } from '@void-sector/shared';
import { calculateShipStats } from '@void-sector/shared';
import {
  getPlayerPosition,
  getFuelState,
} from '../../rooms/services/RedisAPStore.js';
import { getActiveShip, getSector } from '../../db/queries.js';
import { getStationData } from '../../db/npcStationQueries.js';
import { getResourceTotal } from '../inventoryService.js';

/**
 * Returns true if the condition holds for the given player, false otherwise.
 * Respects the `negate` flag to invert the result.
 */
export async function evaluateCondition(playerId: string, c: Condition): Promise<boolean> {
  const v = await rawCondition(playerId, c);
  return c.negate ? !v : v;
}

async function rawCondition(playerId: string, c: Condition): Promise<boolean> {
  const pos = (await getPlayerPosition(playerId)) ?? { x: 0, y: 0 };

  switch (c.kind) {
    case 'resources': {
      const s = await getSector(pos.x, pos.y);
      const r = s?.resources ?? { ore: 0, gas: 0, crystal: 0 };
      return (r.ore ?? 0) > 0 || (r.gas ?? 0) > 0 || (r.crystal ?? 0) > 0;
    }

    case 'full': {
      const ship = await getActiveShip(playerId);
      const cap = calculateShipStats(ship?.modules ?? []).cargoCap ?? 0;
      return (await getResourceTotal(playerId)) >= cap;
    }

    case 'empty':
      return (await getResourceTotal(playerId)) === 0;

    case 'fuel_lt':
      return ((await getFuelState(playerId)) ?? 0) < c.value;

    case 'at':
      return pos.x === c.x && pos.y === c.y;

    case 'station':
      return isStationHere(pos.x, pos.y);
  }
}

/**
 * Returns true if an NPC station exists at (x, y).
 * Mirrors the check in coreSell — both use getStationData so sell and station
 * condition are always consistent.
 */
async function isStationHere(x: number, y: number): Promise<boolean> {
  const station = await getStationData(x, y);
  return station !== null;
}
