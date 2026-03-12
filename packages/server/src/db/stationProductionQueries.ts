import type { Pool } from 'pg';

export interface StationProductionRow {
  sector_x: number;
  sector_y: number;
  resource_stockpile: { ore: number; gas: number; crystal: number };
  passive_gen_last_tick: Date;
  queue_index: number;
  current_item_started_at: Date | null;
  finished_goods: Record<string, number>;
}

export async function getOrCreateStationProduction(
  db: Pool,
  x: number,
  y: number,
): Promise<StationProductionRow> {
  const res = await db.query<StationProductionRow>(
    `INSERT INTO station_production (sector_x, sector_y)
     VALUES ($1, $2)
     ON CONFLICT (sector_x, sector_y) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [x, y],
  );
  return res.rows[0];
}

export async function saveStationProduction(
  db: Pool,
  x: number,
  y: number,
  update: {
    resource_stockpile: { ore: number; gas: number; crystal: number };
    passive_gen_last_tick: Date;
    queue_index: number;
    current_item_started_at: Date | null;
    finished_goods: Record<string, number>;
  },
): Promise<void> {
  await db.query(
    `UPDATE station_production
     SET resource_stockpile      = $3,
         passive_gen_last_tick   = $4,
         queue_index             = $5,
         current_item_started_at = $6,
         finished_goods          = $7,
         updated_at              = NOW()
     WHERE sector_x = $1 AND sector_y = $2`,
    [
      x,
      y,
      JSON.stringify(update.resource_stockpile),
      update.passive_gen_last_tick.toISOString(),
      update.queue_index,
      update.current_item_started_at?.toISOString() ?? null,
      JSON.stringify(update.finished_goods),
    ],
  );
}
