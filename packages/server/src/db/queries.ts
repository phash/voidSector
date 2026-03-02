import { query } from './client.js';
import type { SectorData, PlayerData, CargoState, ResourceType } from '@void-sector/shared';

export async function createPlayer(
  username: string,
  passwordHash: string
): Promise<PlayerData> {
  const result = await query<{
    id: string;
    username: string;
    home_base: { x: number; y: number };
    xp: number;
    level: number;
  }>(
    `INSERT INTO players (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, home_base, xp, level`,
    [username, passwordHash]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    homeBase: row.home_base,
    xp: row.xp,
    level: row.level,
  };
}

export async function findPlayerByUsername(
  username: string
): Promise<(PlayerData & { passwordHash: string }) | null> {
  const result = await query<{
    id: string;
    username: string;
    password_hash: string;
    home_base: { x: number; y: number };
    xp: number;
    level: number;
  }>(
    'SELECT id, username, password_hash, home_base, xp, level FROM players WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    homeBase: row.home_base,
    xp: row.xp,
    level: row.level,
  };
}

export async function getSector(
  x: number,
  y: number
): Promise<SectorData | null> {
  const result = await query<{
    x: number;
    y: number;
    type: string;
    seed: number;
    discovered_by: string | null;
    discovered_at: string | null;
    metadata: Record<string, unknown>;
  }>(
    'SELECT x, y, type, seed, discovered_by, discovered_at, metadata FROM sectors WHERE x = $1 AND y = $2',
    [x, y]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const meta = row.metadata || {};
  const resources = (meta.resources as SectorData['resources']) || { ore: 0, gas: 0, crystal: 0 };
  return {
    x: row.x,
    y: row.y,
    type: row.type as SectorData['type'],
    seed: row.seed,
    discoveredBy: row.discovered_by,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
    resources,
  };
}

export async function saveSector(sector: SectorData): Promise<void> {
  await query(
    `INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (x, y) DO NOTHING`,
    [
      sector.x,
      sector.y,
      sector.type,
      sector.seed,
      sector.discoveredBy,
      JSON.stringify({ resources: sector.resources || { ore: 0, gas: 0, crystal: 0 } }),
    ]
  );
}

export async function addDiscovery(
  playerId: string,
  sectorX: number,
  sectorY: number
): Promise<void> {
  await query(
    `INSERT INTO player_discoveries (player_id, sector_x, sector_y)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, sector_x, sector_y) DO NOTHING`,
    [playerId, sectorX, sectorY]
  );
}

export async function getPlayerDiscoveries(
  playerId: string
): Promise<Array<{ x: number; y: number }>> {
  const result = await query<{ sector_x: number; sector_y: number }>(
    'SELECT sector_x, sector_y FROM player_discoveries WHERE player_id = $1',
    [playerId]
  );
  return result.rows.map((row) => ({ x: row.sector_x, y: row.sector_y }));
}

export async function getPlayerCargo(playerId: string): Promise<CargoState> {
  const result = await query<{ resource: string; quantity: number }>(
    'SELECT resource, quantity FROM cargo WHERE player_id = $1',
    [playerId]
  );
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0 };
  for (const row of result.rows) {
    if (row.resource in cargo) {
      cargo[row.resource as ResourceType] = row.quantity;
    }
  }
  return cargo;
}

export async function addToCargo(
  playerId: string,
  resource: ResourceType,
  amount: number,
): Promise<void> {
  await query(
    `INSERT INTO cargo (player_id, resource, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, resource)
     DO UPDATE SET quantity = cargo.quantity + $3`,
    [playerId, resource, amount]
  );
}

export async function jettisonCargo(
  playerId: string,
  resource: ResourceType,
): Promise<number> {
  const result = await query<{ quantity: number }>(
    `DELETE FROM cargo WHERE player_id = $1 AND resource = $2 RETURNING quantity`,
    [playerId, resource]
  );
  return result.rows.length > 0 ? result.rows[0].quantity : 0;
}

export async function getCargoTotal(playerId: string): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM cargo WHERE player_id = $1',
    [playerId]
  );
  return Number(result.rows[0].total);
}
