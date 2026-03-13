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
  }): Promise<void> {
    await query(
      `UPDATE civ_ships SET state=$2, x=$3, y=$4, target_x=$5, target_y=$6,
       spiral_step=$7, resources_carried=$8 WHERE id=$1`,
      [id, data.state, data.x, data.y,
       data.target_x ?? null, data.target_y ?? null,
       data.spiral_step ?? 0, data.resources_carried ?? 0],
    );
  },

  async getAllShips(): Promise<CivShip[]> {
    const res = await query<{
      id: number; faction: string; ship_type: string; state: string;
      x: number; y: number; home_x: number; home_y: number;
      target_x: number | null; target_y: number | null;
      spiral_step: number; resources_carried: number;
    }>('SELECT * FROM civ_ships ORDER BY id');
    return res.rows.map((r) => ({
      id: r.id, faction: r.faction, ship_type: r.ship_type as any,
      state: r.state as any, x: r.x, y: r.y,
      home_x: r.home_x, home_y: r.home_y,
      target_x: r.target_x ?? undefined,
      target_y: r.target_y ?? undefined,
      spiral_step: r.spiral_step,
      resources_carried: r.resources_carried,
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
