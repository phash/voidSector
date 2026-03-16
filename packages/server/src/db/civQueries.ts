import { query } from './client.js';
import type { CivShip, CivStation } from '@void-sector/shared';

export const civQueries = {
  async getAllStations(): Promise<CivStation[]> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number; faction: string;
      has_shipyard: boolean; has_warehouse: boolean; has_kontor: boolean;
      mode: string; conquest_pool: number; level: number;
    }>('SELECT * FROM civ_stations ORDER BY id');
    return res.rows.map((r) => ({
      id: r.id, sector_x: r.sector_x, sector_y: r.sector_y,
      faction: r.faction, has_shipyard: r.has_shipyard,
      has_warehouse: r.has_warehouse, has_kontor: r.has_kontor,
      mode: (r.mode ?? 'factory') as CivStation['mode'],
      conquest_pool: r.conquest_pool ?? 0,
      level: r.level ?? 1,
    }));
  },

  async getStationsForFaction(faction: string): Promise<CivStation[]> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number; faction: string;
      has_shipyard: boolean; has_warehouse: boolean; has_kontor: boolean;
      mode: string; conquest_pool: number; level: number;
    }>('SELECT * FROM civ_stations WHERE faction = $1', [faction]);
    return res.rows.map((r) => ({
      id: r.id, sector_x: r.sector_x, sector_y: r.sector_y,
      faction: r.faction, has_shipyard: r.has_shipyard,
      has_warehouse: r.has_warehouse, has_kontor: r.has_kontor,
      mode: (r.mode ?? 'factory') as CivStation['mode'],
      conquest_pool: r.conquest_pool ?? 0,
      level: r.level ?? 1,
    }));
  },

  async upsertStation(
    sector_x: number, sector_y: number, faction: string,
    has_shipyard = true, has_warehouse = true, has_kontor = false,
  ): Promise<void> {
    await query(
      `INSERT INTO civ_stations (sector_x, sector_y, faction, has_shipyard, has_warehouse, has_kontor)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sector_x, sector_y) DO NOTHING`,
      [sector_x, sector_y, faction, has_shipyard, has_warehouse, has_kontor],
    );
  },

  async createShip(data: {
    faction: string; ship_type: string; state: string;
    x: number; y: number; home_x: number; home_y: number;
  }): Promise<number> {
    const res = await query<{ id: number }>(
      `INSERT INTO civ_ships (faction, ship_type, state, x, y, home_x, home_y)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.faction, data.ship_type, data.state, data.x, data.y, data.home_x, data.home_y],
    );
    return res.rows[0].id;
  },

  async updateShip(id: number, data: {
    state: string; x: number; y: number;
    target_x?: number | null; target_y?: number | null;
    spiral_step?: number; resources_carried?: number;
    mined_resource?: string;
  }): Promise<void> {
    await query(
      `UPDATE civ_ships SET state=$2, x=$3, y=$4, target_x=$5, target_y=$6,
       spiral_step=$7, resources_carried=$8, mined_resource=COALESCE($9, mined_resource) WHERE id=$1`,
      [id, data.state, data.x, data.y,
       data.target_x ?? null, data.target_y ?? null,
       data.spiral_step ?? 0, data.resources_carried ?? 0,
       data.mined_resource ?? null],
    );
  },

  async getAllShips(): Promise<CivShip[]> {
    const res = await query<{
      id: number; faction: string; ship_type: string; state: string;
      x: number; y: number; home_x: number; home_y: number;
      target_x: number | null; target_y: number | null;
      spiral_step: number; resources_carried: number;
      mined_resource: string;
    }>('SELECT * FROM civ_ships ORDER BY id');
    return res.rows.map((r) => ({
      id: r.id, faction: r.faction, ship_type: r.ship_type as any,
      state: r.state as any, x: r.x, y: r.y,
      home_x: r.home_x, home_y: r.home_y,
      target_x: r.target_x ?? undefined,
      target_y: r.target_y ?? undefined,
      spiral_step: r.spiral_step,
      resources_carried: r.resources_carried,
      mined_resource: r.mined_resource,
    }));
  },

  async getShipsInQuadrant(qx: number, qy: number, quadrantSize: number): Promise<CivShip[]> {
    const minX = qx * quadrantSize;
    const maxX = minX + quadrantSize - 1;
    const minY = qy * quadrantSize;
    const maxY = minY + quadrantSize - 1;
    const res = await query<{
      id: number; faction: string; ship_type: string; state: string;
      x: number; y: number; home_x: number; home_y: number;
      target_x: number | null; target_y: number | null;
      spiral_step: number; resources_carried: number;
    }>(
      `SELECT * FROM civ_ships WHERE x BETWEEN $1 AND $2 AND y BETWEEN $3 AND $4`,
      [minX, maxX, minY, maxY],
    );
    return res.rows.map((r) => ({
      id: r.id, faction: r.faction, ship_type: r.ship_type as any,
      state: r.state as any, x: r.x, y: r.y,
      home_x: r.home_x, home_y: r.home_y,
      target_x: r.target_x ?? undefined, target_y: r.target_y ?? undefined,
      spiral_step: r.spiral_step, resources_carried: r.resources_carried,
    }));
  },

  async deleteShip(id: number): Promise<void> {
    await query('DELETE FROM civ_ships WHERE id = $1', [id]);
  },

  async countDronesAtStation(home_x: number, home_y: number): Promise<number> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM civ_ships
       WHERE home_x=$1 AND home_y=$2 AND ship_type='mining_drone'`,
      [home_x, home_y],
    );
    return parseInt(res.rows[0].count, 10);
  },

  // --- Conquest queries ---

  async getConquestStations(): Promise<Array<{
    id: number; sector_x: number; sector_y: number;
    faction: string; mode: string; conquest_pool: number; level: number;
  }>> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number;
      faction: string; mode: string; conquest_pool: number; level: number;
    }>(`SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level
        FROM civ_stations WHERE mode != 'factory'`);
    return res.rows;
  },

  async getStationById(id: number): Promise<{
    id: number; sector_x: number; sector_y: number;
    faction: string; mode: string; conquest_pool: number; level: number;
  } | null> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number;
      faction: string; mode: string; conquest_pool: number; level: number;
    }>('SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level FROM civ_stations WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  },

  async updateStationMode(id: number, mode: string): Promise<void> {
    await query('UPDATE civ_stations SET mode = $1 WHERE id = $2', [mode, id]);
  },

  async drainConquestPool(id: number, amount: number): Promise<void> {
    await query(
      'UPDATE civ_stations SET conquest_pool = GREATEST(0, conquest_pool - $1) WHERE id = $2',
      [amount, id],
    );
  },

  async getStationBySector(x: number, y: number): Promise<{
    id: number; sector_x: number; sector_y: number;
    faction: string; mode: string; conquest_pool: number; level: number;
  } | null> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number;
      faction: string; mode: string; conquest_pool: number; level: number;
    }>('SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level FROM civ_stations WHERE sector_x = $1 AND sector_y = $2', [x, y]);
    return res.rows[0] ?? null;
  },

  async depositConquestPool(id: number, amount: number, maxPool: number): Promise<number> {
    const res = await query<{ conquest_pool: number }>(
      `UPDATE civ_stations
       SET conquest_pool = LEAST($3, conquest_pool + $1)
       WHERE id = $2
       RETURNING conquest_pool`,
      [amount, id, maxPool],
    );
    return res.rows[0]?.conquest_pool ?? 0;
  },
};

export async function getNpcShipsInSector(x: number, y: number): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM civ_ships
     WHERE x = $1 AND y = $2 AND role IN ('trader', 'military', 'outlaw')
       AND (dead_until IS NULL OR dead_until < NOW())`,
    [x, y],
  );
  return rows;
}

export async function getNpcShipById(id: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT * FROM civ_ships WHERE id = $1 AND role IN ('trader', 'military', 'outlaw')`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getAliveNpcsByRole(
  qx: number, qy: number, quadrantSize: number, role: string,
): Promise<any[]> {
  const minX = qx * quadrantSize;
  const maxX = minX + quadrantSize - 1;
  const minY = qy * quadrantSize;
  const maxY = minY + quadrantSize - 1;
  const { rows } = await query(
    `SELECT * FROM civ_ships
     WHERE role = $1 AND x >= $2 AND x <= $3 AND y >= $4 AND y <= $5
       AND (dead_until IS NULL OR dead_until < NOW())`,
    [role, minX, maxX, minY, maxY],
  );
  return rows;
}

export async function getStationsInRange(x: number, y: number, maxDist: number): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM civ_stations
     WHERE ABS(sector_x - $1) + ABS(sector_y - $2) <= $3`,
    [x, y, maxDist],
  );
  return rows;
}

export async function updateNpcShip(
  id: number,
  fields: Partial<{
    x: number; y: number; state: string;
    target_x: number | null; target_y: number | null;
    inventory: Record<string, number>;
    patrol_state: Record<string, any>;
    dead_until: string | null;
    resources_carried: number;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${i}`);
    vals.push(k === 'patrol_state' || k === 'inventory' ? JSON.stringify(v) : v);
    i++;
  }
  if (sets.length === 0) return;
  vals.push(id);
  await query(`UPDATE civ_ships SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function spawnNpcShip(data: {
  faction: string; ship_type: string; role: string;
  x: number; y: number; home_x: number; home_y: number;
  level?: number; name?: string; inventory?: Record<string, number>;
  patrol_state?: Record<string, any>;
}): Promise<number> {
  const { rows } = await query(
    `INSERT INTO civ_ships (faction, ship_type, state, x, y, home_x, home_y, role, level, name, inventory, patrol_state)
     VALUES ($1, $2, 'idle', $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [data.faction, data.ship_type, data.x, data.y, data.home_x, data.home_y,
     data.role, data.level ?? 1, data.name ?? '',
     JSON.stringify(data.inventory ?? {}), JSON.stringify(data.patrol_state ?? {})],
  );
  return rows[0].id;
}

export async function resetDeadOutlaws(): Promise<number> {
  const { rowCount } = await query(
    `UPDATE civ_ships SET dead_until = NULL WHERE role = 'outlaw' AND dead_until IS NOT NULL AND dead_until < NOW()`,
    [],
  );
  return rowCount ?? 0;
}

export async function getNpcPosition(npcId: number): Promise<{ x: number; y: number } | null> {
  const { rows } = await query('SELECT x, y FROM civ_ships WHERE id = $1', [npcId]);
  return rows[0] ?? null;
}
