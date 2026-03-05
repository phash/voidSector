import { query } from './client.js';
import type { FactoryState } from '@void-sector/shared';

const VALID_ITEM_COLUMNS = new Set([
  'fuel_cell',
  'circuit_board',
  'alloy_plate',
  'void_shard',
  'bio_extract',
]);

export async function getFactoryState(structureId: string): Promise<FactoryState | null> {
  const { rows } = await query<{
    structure_id: string;
    owner_id: string;
    active_recipe_id: string | null;
    cycle_started_at: string | null;
    fuel_cell: number;
    circuit_board: number;
    alloy_plate: number;
    void_shard: number;
    bio_extract: number;
  }>('SELECT * FROM factory_state WHERE structure_id = $1', [structureId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    structureId: r.structure_id,
    ownerId: r.owner_id,
    activeRecipeId: r.active_recipe_id,
    cycleStartedAt: r.cycle_started_at ? Number(r.cycle_started_at) : null,
    fuelCell: r.fuel_cell,
    circuitBoard: r.circuit_board,
    alloyPlate: r.alloy_plate,
    voidShard: r.void_shard,
    bioExtract: r.bio_extract,
  };
}

export async function upsertFactoryState(state: FactoryState): Promise<void> {
  await query(
    `INSERT INTO factory_state (structure_id, owner_id, active_recipe_id, cycle_started_at, fuel_cell, circuit_board, alloy_plate, void_shard, bio_extract)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (structure_id) DO UPDATE SET
       active_recipe_id = EXCLUDED.active_recipe_id,
       cycle_started_at = EXCLUDED.cycle_started_at,
       fuel_cell = EXCLUDED.fuel_cell,
       circuit_board = EXCLUDED.circuit_board,
       alloy_plate = EXCLUDED.alloy_plate,
       void_shard = EXCLUDED.void_shard,
       bio_extract = EXCLUDED.bio_extract`,
    [
      state.structureId,
      state.ownerId,
      state.activeRecipeId,
      state.cycleStartedAt,
      state.fuelCell,
      state.circuitBoard,
      state.alloyPlate,
      state.voidShard,
      state.bioExtract,
    ],
  );
}

export async function updateFactoryOutput(
  structureId: string,
  itemType: string,
  delta: number,
): Promise<void> {
  if (!VALID_ITEM_COLUMNS.has(itemType)) {
    throw new Error(`Invalid item type: ${itemType}`);
  }
  // itemType is validated above against the known set of column names
  await query(`UPDATE factory_state SET ${itemType} = ${itemType} + $1 WHERE structure_id = $2`, [
    delta,
    structureId,
  ]);
}
