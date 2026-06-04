import { query } from './client.js';
import { QUADRANT_SIZE, STATION_EXPANSION_TYPES, type StationExpansionType } from '@void-sector/shared';

const QUADRANT_SIZE_VALUE = QUADRANT_SIZE;
const QUADRANT_SIZE_HALF = Math.floor(QUADRANT_SIZE / 2);

export interface PlayerStationRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  quadrant_x: number;
  quadrant_y: number;
  level: number;
  factory_level: number;
  cargo_level: number;
  markt_level: number;
  werft_level: number;
  refinery_level: number;
  sensor_level: number;
  cargo_contents: Record<string, number>;
  trade_volume: number;
  building_expansion: StationExpansionType | null;
  build_complete_at: string | null;
  created_at: string;
}

/** Column name on player_stations for an expansion's level.
 *  Validates against the shared allowlist so the interpolated column name can
 *  never be attacker-controlled (defense in depth for the SQL in completeStationBuild). */
export function expansionLevelColumn(type: StationExpansionType): string {
  if (!STATION_EXPANSION_TYPES.includes(type)) {
    throw new Error(`Invalid station expansion type: ${String(type)}`);
  }
  return `${type}_level`;
}


export async function getPlayerStationAt(sectorX: number, sectorY: number): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE sector_x = $1 AND sector_y = $2',
    [sectorX, sectorY],
  );
  return result.rows[0] ?? null;
}

export async function getPlayerStations(ownerId: string): Promise<PlayerStationRow[]> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE owner_id = $1 ORDER BY created_at ASC',
    [ownerId],
  );
  return result.rows;
}

export async function getPlayerStationInQuadrant(
  ownerId: string,
  qx: number,
  qy: number,
): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE owner_id = $1 AND quadrant_x = $2 AND quadrant_y = $3',
    [ownerId, qx, qy],
  );
  return result.rows[0] ?? null;
}

export async function insertPlayerStation(
  ownerId: string,
  sectorX: number,
  sectorY: number,
  quadrantX: number,
  quadrantY: number,
): Promise<PlayerStationRow> {
  const result = await query<PlayerStationRow>(
    `INSERT INTO player_stations (owner_id, sector_x, sector_y, quadrant_x, quadrant_y)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [ownerId, sectorX, sectorY, quadrantX, quadrantY],
  );
  return result.rows[0];
}

export async function upgradeStationLevel(stationId: string): Promise<PlayerStationRow> {
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations SET level = level + 1
     WHERE id = $1 AND level < 5 RETURNING *`,
    [stationId],
  );
  return result.rows[0];
}

export async function upgradeStationModule(
  stationId: string,
  module: 'factory' | 'cargo',
  stationLevel: number,
): Promise<PlayerStationRow | null> {
  const col = module === 'factory' ? 'factory_level' : 'cargo_level';
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations SET ${col} = ${col} + 1
     WHERE id = $1 AND ${col} < $2 RETURNING *`,
    [stationId, stationLevel],
  );
  return result.rows[0] ?? null;
}

export async function getPlayerStationById(stationId: string): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE id = $1',
    [stationId],
  );
  return result.rows[0] ?? null;
}

// ── Blueprint Memory ─────────────────────────────────────────────────

export async function getStationBlueprints(stationId: string): Promise<string[]> {
  const result = await query<{ module_id: string }>(
    'SELECT module_id FROM station_blueprints WHERE station_id = $1 ORDER BY consumed_at ASC',
    [stationId],
  );
  return result.rows.map((r) => r.module_id);
}

export async function consumeBlueprintIntoStation(stationId: string, moduleId: string): Promise<boolean> {
  try {
    await query(
      'INSERT INTO station_blueprints (station_id, module_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [stationId, moduleId],
    );
    return true;
  } catch {
    return false;
  }
}

export async function getAcepBlueprints(playerId: string): Promise<string[]> {
  const result = await query<{ module_id: string }>(
    'SELECT module_id FROM acep_blueprints WHERE player_id = $1 ORDER BY consumed_at ASC',
    [playerId],
  );
  return result.rows.map((r) => r.module_id);
}

// ── Production Queue ─────────────────────────────────────────────────

export interface ProductionQueueRow {
  id: string;
  station_id: string;
  module_id: string;
  quantity: number;
  completed: number;
  started_at: number;
  time_per_item_ms: number;
}

export async function getProductionQueue(stationId: string): Promise<ProductionQueueRow[]> {
  const result = await query<ProductionQueueRow>(
    'SELECT * FROM station_production_queue WHERE station_id = $1 ORDER BY created_at ASC',
    [stationId],
  );
  return result.rows;
}

export async function insertProductionJob(
  stationId: string,
  moduleId: string,
  quantity: number,
  startedAt: number,
  timePerItemMs: number,
): Promise<ProductionQueueRow> {
  const result = await query<ProductionQueueRow>(
    `INSERT INTO station_production_queue (station_id, module_id, quantity, started_at, time_per_item_ms)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [stationId, moduleId, quantity, startedAt, timePerItemMs],
  );
  return result.rows[0];
}

export async function updateProductionCompleted(jobId: string, completed: number): Promise<void> {
  await query(
    'UPDATE station_production_queue SET completed = $2 WHERE id = $1',
    [jobId, completed],
  );
}

export async function deleteProductionJob(jobId: string): Promise<void> {
  await query('DELETE FROM station_production_queue WHERE id = $1', [jobId]);
}

export async function updateStationCargo(
  stationId: string,
  cargoContents: Record<string, number>,
): Promise<void> {
  await query(
    'UPDATE player_stations SET cargo_contents = $2::jsonb WHERE id = $1',
    [stationId, JSON.stringify(cargoContents)],
  );
}

export async function consumeBlueprintIntoAcep(playerId: string, moduleId: string): Promise<boolean> {
  try {
    await query(
      'INSERT INTO acep_blueprints (player_id, module_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [playerId, moduleId],
    );
    return true;
  } catch {
    return false;
  }
}

/** Start a timed expansion build. Returns null if the station is already building. */
export async function startStationBuild(
  stationId: string,
  type: StationExpansionType,
  completeAtIso: string,
): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations
       SET building_expansion = $2, build_complete_at = $3
     WHERE id = $1 AND building_expansion IS NULL
     RETURNING *`,
    [stationId, type, completeAtIso],
  );
  return result.rows[0] ?? null;
}

/** Fetch stations whose timed build is due. */
export async function getDueStationBuilds(): Promise<PlayerStationRow[]> {
  const result = await query<PlayerStationRow>(
    `SELECT * FROM player_stations
     WHERE building_expansion IS NOT NULL AND build_complete_at <= NOW()`,
  );
  return result.rows;
}

/** Complete a build: bump the expansion level and clear the build fields. */
export async function completeStationBuild(
  stationId: string,
  type: StationExpansionType,
): Promise<void> {
  const col = expansionLevelColumn(type);
  await query(
    `UPDATE player_stations
       SET ${col} = ${col} + 1, building_expansion = NULL, build_complete_at = NULL
     WHERE id = $1`,
    [stationId],
  );
}

/** Add to trade volume; returns the updated row. */
export async function addTradeVolume(stationId: string, amount: number): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations
       SET trade_volume = trade_volume + $2
     WHERE id = $1 RETURNING *`,
    [stationId, amount],
  );
  return result.rows[0] ?? null;
}

export async function setStationLevel(stationId: string, level: number): Promise<void> {
  await query(`UPDATE player_stations SET level = $2 WHERE id = $1`, [stationId, level]);
}

export async function getAllPlayerStationsWithRefinery(): Promise<Pick<PlayerStationRow, 'owner_id' | 'refinery_level'>[]> {
  const result = await query<Pick<PlayerStationRow, 'owner_id' | 'refinery_level'>>(
    `SELECT owner_id, refinery_level FROM player_stations WHERE refinery_level > 0`,
  );
  return result.rows;
}

/** Player stations with a refinery — id + cargo for the gas→fuel conversion tick. */
export async function getRefineryStationsWithCargo(): Promise<
  Pick<PlayerStationRow, 'id' | 'owner_id' | 'refinery_level' | 'cargo_contents'>[]
> {
  const result = await query<Pick<PlayerStationRow, 'id' | 'owner_id' | 'refinery_level' | 'cargo_contents'>>(
    `SELECT id, owner_id, refinery_level, cargo_contents
       FROM player_stations WHERE refinery_level > 0`,
  );
  return result.rows;
}

/**
 * Highest sensor_level among the owner's stations located in quadrant (qx,qy).
 * Uses the centered quadrant convention: quadrant = FLOOR((sector + half) / size),
 * matching quadrantEngine.sectorToQuadrant.
 */
export async function getPlayerSensorLevelInQuadrant(
  ownerId: string,
  qx: number,
  qy: number,
): Promise<number> {
  const result = await query<{ max: number | null }>(
    `SELECT MAX(sensor_level) AS max FROM player_stations
       WHERE owner_id = $1
         AND FLOOR((sector_x + $4) / $5) = $2
         AND FLOOR((sector_y + $4) / $5) = $3`,
    [ownerId, qx, qy, QUADRANT_SIZE_HALF, QUADRANT_SIZE_VALUE],
  );
  return result.rows[0]?.max ?? 0;
}
