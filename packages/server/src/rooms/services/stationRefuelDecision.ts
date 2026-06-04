import { stationRefuelAmount } from '../../engine/stationPassiveEffects.js';

export interface RefuelStation {
  owner_id: string;
  cargo_contents: Record<string, number>;
}

export type OwnStationRefuel =
  | { ok: true; amount: number; newStationFuel: number }
  | { ok: false };

/**
 * If the requester owns this station and it has stored fuel, compute a free refuel
 * (capped by tank space). ok:false → fall through to the normal NPC refuel path.
 */
export function resolveOwnStationRefuel(
  station: RefuelStation | null,
  requesterId: string,
  tankSpace: number,
): OwnStationRefuel {
  if (!station || station.owner_id !== requesterId) return { ok: false };
  const stationFuel = station.cargo_contents.fuel ?? 0;
  const amount = stationRefuelAmount(tankSpace, stationFuel);
  if (amount <= 0) return { ok: false };
  return { ok: true, amount, newStationFuel: stationFuel - amount };
}
