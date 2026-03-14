import { query } from './client.js';

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
  cargo_contents: Record<string, number>;
  created_at: string;
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
