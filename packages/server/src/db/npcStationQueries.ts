import { query } from './client.js';
import type { NpcStationData, NpcStationInventoryItem } from '@void-sector/shared';

export async function getStationData(x: number, y: number): Promise<NpcStationData | null> {
  const result = await query<{
    station_x: number;
    station_y: number;
    level: number;
    xp: number;
    visit_count: number;
    trade_volume: number;
    last_xp_decay: string;
  }>(
    `SELECT station_x, station_y, level, xp, visit_count, trade_volume, last_xp_decay
     FROM npc_station_data
     WHERE station_x = $1 AND station_y = $2`,
    [x, y],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    stationX: row.station_x,
    stationY: row.station_y,
    level: row.level,
    xp: row.xp,
    visitCount: row.visit_count,
    tradeVolume: row.trade_volume,
    lastXpDecay: row.last_xp_decay,
  };
}

export async function upsertStationData(data: NpcStationData): Promise<void> {
  await query(
    `INSERT INTO npc_station_data (station_x, station_y, level, xp, visit_count, trade_volume, last_xp_decay)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (station_x, station_y) DO UPDATE SET
       level = EXCLUDED.level,
       xp = EXCLUDED.xp,
       visit_count = EXCLUDED.visit_count,
       trade_volume = EXCLUDED.trade_volume,
       last_xp_decay = EXCLUDED.last_xp_decay`,
    [
      data.stationX,
      data.stationY,
      data.level,
      data.xp,
      data.visitCount,
      data.tradeVolume,
      data.lastXpDecay,
    ],
  );
}

export async function getStationInventory(
  x: number,
  y: number,
): Promise<NpcStationInventoryItem[]> {
  const result = await query<{
    station_x: number;
    station_y: number;
    item_type: string;
    stock: number;
    max_stock: number;
    consumption_rate: number;
    restock_rate: number;
    last_updated: string;
  }>(
    `SELECT station_x, station_y, item_type, stock, max_stock, consumption_rate, restock_rate, last_updated
     FROM npc_station_inventory
     WHERE station_x = $1 AND station_y = $2`,
    [x, y],
  );
  return result.rows.map((row) => ({
    stationX: row.station_x,
    stationY: row.station_y,
    itemType: row.item_type,
    stock: row.stock,
    maxStock: row.max_stock,
    consumptionRate: row.consumption_rate,
    restockRate: row.restock_rate,
    lastUpdated: row.last_updated,
  }));
}

export async function upsertInventoryItem(item: NpcStationInventoryItem): Promise<void> {
  await query(
    `INSERT INTO npc_station_inventory (station_x, station_y, item_type, stock, max_stock, consumption_rate, restock_rate, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (station_x, station_y, item_type) DO UPDATE SET
       stock = EXCLUDED.stock,
       max_stock = EXCLUDED.max_stock,
       consumption_rate = EXCLUDED.consumption_rate,
       restock_rate = EXCLUDED.restock_rate,
       last_updated = EXCLUDED.last_updated`,
    [
      item.stationX,
      item.stationY,
      item.itemType,
      item.stock,
      item.maxStock,
      item.consumptionRate,
      item.restockRate,
      item.lastUpdated,
    ],
  );
}

export async function getStationInventoryItem(
  x: number,
  y: number,
  itemType: string,
): Promise<NpcStationInventoryItem | null> {
  const result = await query<{
    station_x: number;
    station_y: number;
    item_type: string;
    stock: number;
    max_stock: number;
    consumption_rate: number;
    restock_rate: number;
    last_updated: string;
  }>(
    `SELECT station_x, station_y, item_type, stock, max_stock, consumption_rate, restock_rate, last_updated
     FROM npc_station_inventory
     WHERE station_x = $1 AND station_y = $2 AND item_type = $3`,
    [x, y, itemType],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    stationX: row.station_x,
    stationY: row.station_y,
    itemType: row.item_type,
    stock: row.stock,
    maxStock: row.max_stock,
    consumptionRate: row.consumption_rate,
    restockRate: row.restock_rate,
    lastUpdated: row.last_updated,
  };
}

/** Returns { fuel, gas } stock for a station. Missing items treated as 0. */
export async function getStationFuelAndGas(
  x: number,
  y: number,
): Promise<{ fuel: number; gas: number }> {
  const result = await query<{ item_type: string; stock: number; max_stock: number }>(
    `SELECT item_type, stock, max_stock
     FROM npc_station_inventory
     WHERE station_x = $1 AND station_y = $2 AND item_type IN ('fuel', 'gas')`,
    [x, y],
  );
  const fuel = result.rows.find((r) => r.item_type === 'fuel')?.stock ?? 0;
  const gas  = result.rows.find((r) => r.item_type === 'gas')?.stock  ?? 0;
  return { fuel, gas };
}

/** Upserts the fuel stock for a station. Caps at maxStock. */
export async function updateStationFuelStock(
  x: number,
  y: number,
  newStock: number,
  maxStock: number,
): Promise<void> {
  const capped = Math.min(newStock, maxStock);
  await query(
    `INSERT INTO npc_station_inventory (station_x, station_y, item_type, stock, max_stock, consumption_rate, restock_rate, last_updated)
     VALUES ($1, $2, $3, $4, $5, 0, 0, NOW())
     ON CONFLICT (station_x, station_y, item_type) DO UPDATE SET
       stock = EXCLUDED.stock,
       max_stock = EXCLUDED.max_stock,
       last_updated = NOW()`,
    [x, y, 'fuel', capped, maxStock],
  );
}

/** Decrements gas stock by amount, applying lazy restock first. Does nothing if gas stock is already 0. */
export async function consumeStationGas(
  x: number,
  y: number,
  amount: number,
): Promise<void> {
  // Apply lazy restock before consuming: gas regenerates over time based on restock_rate.
  // This prevents gas from staying at 0 indefinitely — it refills naturally when not being consumed.
  await query(
    `UPDATE npc_station_inventory
     SET stock = GREATEST(0,
       LEAST(max_stock,
         stock + (restock_rate - consumption_rate) *
           EXTRACT(EPOCH FROM (NOW() - last_updated::timestamptz)) / 3600.0
       ) - $4
     ),
     last_updated = NOW()
     WHERE station_x = $1 AND station_y = $2 AND item_type = $3`,
    [x, y, 'gas', amount],
  );
}

/** Returns all stations from npc_station_data (each runs fuel production regardless of current stock). */
export async function getAllStationsForFuelProduction(): Promise<
  Array<{ x: number; y: number; level: number }>
> {
  const result = await query<{ station_x: number; station_y: number; level: number }>(
    `SELECT DISTINCT d.station_x, d.station_y, d.level
     FROM npc_station_data d`,
    [],
  );
  return result.rows.map((r) => ({ x: r.station_x, y: r.station_y, level: r.level }));
}

/**
 * Atomically deducts amount from station fuel stock, clamped to 0.
 * Returns the actual amount deducted (may be less than requested if stock was low).
 */
export async function deductStationFuelStock(
  x: number,
  y: number,
  amount: number,
): Promise<number> {
  // CTE captures pre-update stock to compute exact deducted amount
  const result = await query<{ deducted: number }>(
    `WITH pre AS (
       SELECT stock FROM npc_station_inventory
       WHERE station_x = $1 AND station_y = $2 AND item_type = 'fuel'
       FOR UPDATE
     )
     UPDATE npc_station_inventory
     SET stock = GREATEST(0, npc_station_inventory.stock - $3),
         last_updated = NOW()
     FROM pre
     WHERE npc_station_inventory.station_x = $1
       AND npc_station_inventory.station_y = $2
       AND npc_station_inventory.item_type = 'fuel'
     RETURNING LEAST($3::integer, pre.stock) AS deducted`,
    [x, y, amount],
  );
  return result.rows[0]?.deducted ?? 0;
}
