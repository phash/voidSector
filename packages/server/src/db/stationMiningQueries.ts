import { query } from './client.js';
import type { CivShip } from '@void-sector/shared';

export interface StationMiningShipRow {
  id: number;
  station_id: string;
  owner_id: string;
  state: string;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
  target_x: number | null;
  target_y: number | null;
  spiral_step: number;
  resources_carried: number;
  mined_resource: string | null;
  created_at: string;
}

/** A player station eligible to operate mining ships. */
export interface MiningStationRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  werft_level: number;
}

/** Map a DB row to the CivShip shape consumed by nextShipState + the radar render path. */
export function toCivShip(row: StationMiningShipRow): CivShip {
  return {
    id: row.id,
    faction: 'humans',
    ship_type: 'mining_drone',
    state: row.state as CivShip['state'],
    x: row.x,
    y: row.y,
    home_x: row.home_x,
    home_y: row.home_y,
    target_x: row.target_x ?? undefined,
    target_y: row.target_y ?? undefined,
    spiral_step: row.spiral_step,
    resources_carried: row.resources_carried,
    mined_resource: row.mined_resource ?? undefined,
    role: 'drone',
  };
}

export async function getAllStationMiningShips(): Promise<StationMiningShipRow[]> {
  const res = await query<StationMiningShipRow>('SELECT * FROM station_mining_ships');
  return res.rows;
}

export async function createStationMiningShip(data: {
  station_id: string;
  owner_id: string;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO station_mining_ships (station_id, owner_id, state, x, y, home_x, home_y)
     VALUES ($1, $2, 'idle', $3, $4, $5, $6) RETURNING id`,
    [data.station_id, data.owner_id, data.x, data.y, data.home_x, data.home_y],
  );
  return res.rows[0].id;
}

export async function updateStationMiningShip(
  id: number,
  data: {
    state: string;
    x: number;
    y: number;
    target_x?: number | null;
    target_y?: number | null;
    spiral_step?: number;
    resources_carried?: number;
    mined_resource?: string | null;
  },
): Promise<void> {
  await query(
    `UPDATE station_mining_ships
       SET state=$2, x=$3, y=$4, target_x=$5, target_y=$6,
           spiral_step=$7, resources_carried=$8, mined_resource=$9
     WHERE id=$1`,
    [
      id, data.state, data.x, data.y,
      data.target_x ?? null, data.target_y ?? null,
      data.spiral_step ?? 0, data.resources_carried ?? 0,
      data.mined_resource ?? null,
    ],
  );
}

export async function countStationMiningShips(stationId: string): Promise<number> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM station_mining_ships WHERE station_id = $1',
    [stationId],
  );
  return Number(res.rows[0]?.count ?? 0);
}

/** Player stations that have at least one Werft level — eligible to operate mining ships. */
export async function getStationsEligibleForMining(): Promise<MiningStationRow[]> {
  const res = await query<MiningStationRow>(
    `SELECT id, owner_id, sector_x, sector_y, werft_level
       FROM player_stations WHERE werft_level >= 1`,
  );
  return res.rows;
}
