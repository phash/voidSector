import { PRODUCTION_RECIPES, RESEARCH_TREE } from '@void-sector/shared';
import type { ProcessedItemType, StorageInventory, FactoryStatus, ActiveResearch } from '@void-sector/shared';

export interface FactoryRow {
  structure_id: string;
  owner_id: string;
  active_recipe_id: string | null;
  cycle_started_at: number | null;
  fuel_cell: number;
  circuit_board: number;
  alloy_plate: number;
  void_shard: number;
  bio_extract: number;
}

/**
 * Compute how many completed batches have accumulated since cycle started.
 * Returns batches completed and the timestamp of the last completed cycle start.
 */
export function calculateCompletedBatches(
  recipeId: string,
  cycleStartedAt: number,
  now: number = Date.now(),
): { batches: number; nextCycleStart: number } {
  const recipe = PRODUCTION_RECIPES[recipeId];
  if (!recipe || !cycleStartedAt) return { batches: 0, nextCycleStart: cycleStartedAt ?? now };

  const elapsed = now - cycleStartedAt;
  const cycleMs = recipe.cycleSeconds * 1000;
  const batches = Math.floor(elapsed / cycleMs);
  const nextCycleStart = cycleStartedAt + batches * cycleMs;

  return { batches, nextCycleStart };
}

/**
 * Build a FactoryStatus for the client from a DB row.
 */
export function buildFactoryStatus(row: FactoryRow, now: number = Date.now()): FactoryStatus {
  const output: Partial<Record<ProcessedItemType, number>> = {
    fuel_cell: row.fuel_cell,
    circuit_board: row.circuit_board,
    alloy_plate: row.alloy_plate,
    void_shard: row.void_shard,
    bio_extract: row.bio_extract,
  };

  let progress = 0;
  let cycleSeconds = 0;

  if (row.active_recipe_id && row.cycle_started_at) {
    const recipe = PRODUCTION_RECIPES[row.active_recipe_id];
    if (recipe) {
      cycleSeconds = recipe.cycleSeconds;
      const elapsed = now - row.cycle_started_at;
      const cycleMs = recipe.cycleSeconds * 1000;
      const batchProgress = elapsed % cycleMs;
      progress = Math.min(1, batchProgress / cycleMs);
    }
  }

  return {
    structureId: row.structure_id,
    activeRecipeId: row.active_recipe_id,
    cycleStartedAt: row.cycle_started_at,
    cycleSeconds,
    output,
    progress,
  };
}

/**
 * Check if storage has enough resources for one batch of a recipe.
 */
export function canProduceBatch(recipeId: string, storage: StorageInventory): boolean {
  const recipe = PRODUCTION_RECIPES[recipeId];
  if (!recipe) return false;
  for (const input of recipe.inputs) {
    if ((storage[input.resource] ?? 0) < input.amount) return false;
  }
  return true;
}

/**
 * Deduct inputs for N batches from storage. Returns updated storage.
 */
export function deductRecipeInputs(
  recipeId: string,
  batches: number,
  storage: StorageInventory,
): StorageInventory {
  const recipe = PRODUCTION_RECIPES[recipeId];
  if (!recipe || batches <= 0) return storage;

  const updated = { ...storage };
  for (const input of recipe.inputs) {
    updated[input.resource] = Math.max(0, (updated[input.resource] ?? 0) - input.amount * batches);
  }
  return updated;
}

/**
 * Validate that a player can start researching a recipe.
 */
export function validateResearch(
  recipeId: string,
  unlockedRecipes: string[],
  activeResearch: ActiveResearch | null,
  credits: number,
): { valid: boolean; error?: string; creditCost: number; durationMs: number } {
  const research = RESEARCH_TREE[recipeId];
  if (!research) return { valid: false, error: 'Unknown recipe', creditCost: 0, durationMs: 0 };
  if (unlockedRecipes.includes(recipeId)) return { valid: false, error: 'Already researched', creditCost: 0, durationMs: 0 };
  if (activeResearch) return { valid: false, error: 'Research already in progress', creditCost: 0, durationMs: 0 };
  if (research.prerequisite && !unlockedRecipes.includes(research.prerequisite)) {
    return { valid: false, error: `Requires: ${RESEARCH_TREE[research.prerequisite]?.name ?? research.prerequisite}`, creditCost: 0, durationMs: 0 };
  }
  if (credits < research.creditCost) {
    return { valid: false, error: `Benötige ${research.creditCost} CR (habe ${credits})`, creditCost: research.creditCost, durationMs: 0 };
  }
  return {
    valid: true,
    creditCost: research.creditCost,
    durationMs: research.durationMinutes * 60 * 1000,
  };
}

/**
 * Check if active research has completed. Returns recipeId if done, null otherwise.
 */
export function checkResearchComplete(active: ActiveResearch | null, now: number = Date.now()): string | null {
  if (!active) return null;
  return now >= active.completesAt ? active.recipeId : null;
}
