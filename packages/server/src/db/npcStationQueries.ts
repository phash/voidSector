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
