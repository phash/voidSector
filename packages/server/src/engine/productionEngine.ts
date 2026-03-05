import { PRODUCTION_RECIPES } from '@void-sector/shared';
import type { ProductionRecipe, FactoryState, ProcessedItemType } from '@void-sector/shared';
import { getFactoryState, upsertFactoryState, updateFactoryOutput } from '../db/factoryQueries.js';

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * How many full production cycles have completed since `startedAt`.
 * Lazy evaluation: cycles accumulate over time without a tick loop.
 */
export function calculateCompletedCycles(
  recipe: ProductionRecipe,
  startedAt: number,
  now: number,
): number {
  const elapsed = (now - startedAt) / 1000;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / recipe.cycleSeconds);
}

/**
 * Progress through the current cycle as a fraction [0, 1).
 * Returns 0 when a cycle just completed, approaches 1 near the next completion.
 */
export function calculateProgress(
  recipe: ProductionRecipe,
  startedAt: number,
  now: number,
): number {
  const elapsed = (now - startedAt) / 1000;
  if (elapsed < 0) return 0;
  const inCycle = elapsed % recipe.cycleSeconds;
  return Math.min(1, inCycle / recipe.cycleSeconds);
}

/**
 * Map a ProcessedItemType to the corresponding FactoryState key.
 */
const ITEM_TO_STATE_KEY: Record<ProcessedItemType, keyof FactoryState> = {
  fuel_cell: 'fuelCell',
  circuit_board: 'circuitBoard',
  alloy_plate: 'alloyPlate',
  void_shard: 'voidShard',
  bio_extract: 'bioExtract',
};

// ---------------------------------------------------------------------------
// DB-backed functions
// ---------------------------------------------------------------------------

/**
 * Get factory state for a structure, creating a blank state if none exists.
 */
export async function getOrCreateFactoryState(
  structureId: string,
  ownerId: string,
): Promise<FactoryState> {
  let state = await getFactoryState(structureId);
  if (!state) {
    state = {
      structureId,
      ownerId,
      activeRecipeId: null,
      cycleStartedAt: null,
      fuelCell: 0,
      circuitBoard: 0,
      alloyPlate: 0,
      voidShard: 0,
      bioExtract: 0,
    };
    await upsertFactoryState(state);
  }
  return state;
}

/**
 * Set the active recipe on a factory.
 * Validates that the recipe exists and is unlocked via player blueprints.
 * Resets the cycle timer to now.
 */
export async function setActiveRecipe(
  structureId: string,
  recipeId: string,
  playerBlueprints: string[],
): Promise<{ success: boolean; error?: string }> {
  const recipe = PRODUCTION_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { success: false, error: 'Unknown recipe' };
  if (recipe.researchRequired && !playerBlueprints.includes(recipe.researchRequired)) {
    return { success: false, error: 'Recipe not researched' };
  }
  const state = await getFactoryState(structureId);
  if (!state) return { success: false, error: 'Factory not found' };

  state.activeRecipeId = recipeId;
  state.cycleStartedAt = Date.now();
  await upsertFactoryState(state);
  return { success: true };
}

/**
 * Collect completed production cycles.
 *
 * `storageInventory` represents resources available in the player's base storage.
 * The function determines how many cycles the storage can support, deducts inputs,
 * and adds outputs to the factory's internal inventory (factory_state columns).
 */
export async function collectOutput(
  structureId: string,
  storageInventory: Record<string, number>,
): Promise<{
  collected: Record<string, number>;
  consumed: Record<string, number>;
  error?: string;
}> {
  const state = await getFactoryState(structureId);
  if (!state || !state.activeRecipeId || !state.cycleStartedAt) {
    return { collected: {}, consumed: {}, error: 'No active production' };
  }
  const recipe = PRODUCTION_RECIPES.find((r) => r.id === state.activeRecipeId);
  if (!recipe) return { collected: {}, consumed: {}, error: 'Invalid recipe' };

  const now = Date.now();
  const timeCycles = calculateCompletedCycles(recipe, state.cycleStartedAt, now);
  if (timeCycles === 0) return { collected: {}, consumed: {} };

  // Determine max affordable cycles based on storage resources
  let affordableCycles = timeCycles;
  for (const input of recipe.inputs) {
    const available = storageInventory[input.resource] ?? 0;
    const maxForThis = Math.floor(available / input.amount);
    affordableCycles = Math.min(affordableCycles, maxForThis);
  }

  if (affordableCycles === 0) {
    return { collected: {}, consumed: {}, error: 'Insufficient resources in storage' };
  }

  return collectWithCycles(state, recipe, affordableCycles, now);
}

/**
 * Internal helper: apply `cycles` completed production cycles.
 * Deducts inputs from the consumed record, adds output to factory state,
 * and advances the cycle timer.
 */
async function collectWithCycles(
  state: FactoryState,
  recipe: ProductionRecipe,
  cycles: number,
  now: number,
): Promise<{ collected: Record<string, number>; consumed: Record<string, number> }> {
  const consumed: Record<string, number> = {};
  for (const input of recipe.inputs) {
    consumed[input.resource] = input.amount * cycles;
  }

  const outputAmount = recipe.outputAmount * cycles;
  const collected: Record<string, number> = {
    [recipe.outputItem]: outputAmount,
  };

  // Add output to factory internal inventory
  await updateFactoryOutput(state.structureId, recipe.outputItem, outputAmount);

  // Advance the cycle timer: keep remainder time so partial progress is preserved
  const elapsedMs = now - state.cycleStartedAt!;
  const usedMs = cycles * recipe.cycleSeconds * 1000;
  const remainderMs = elapsedMs - usedMs;
  state.cycleStartedAt = now - remainderMs;
  state.activeRecipeId = recipe.id;
  await upsertFactoryState(state);

  return { collected, consumed };
}

/**
 * Get current factory status for display.
 */
export async function getFactoryStatus(structureId: string): Promise<{
  activeRecipe: ProductionRecipe | null;
  progress: number;
  completedCycles: number;
  output: Record<string, number>;
}> {
  const state = await getFactoryState(structureId);
  if (!state || !state.activeRecipeId || !state.cycleStartedAt) {
    const output: Record<string, number> = state
      ? {
          fuel_cell: state.fuelCell,
          circuit_board: state.circuitBoard,
          alloy_plate: state.alloyPlate,
          void_shard: state.voidShard,
          bio_extract: state.bioExtract,
        }
      : {};
    return { activeRecipe: null, progress: 0, completedCycles: 0, output };
  }

  const recipe = PRODUCTION_RECIPES.find((r) => r.id === state.activeRecipeId) ?? null;
  const now = Date.now();

  return {
    activeRecipe: recipe,
    progress: recipe ? calculateProgress(recipe, state.cycleStartedAt, now) : 0,
    completedCycles: recipe ? calculateCompletedCycles(recipe, state.cycleStartedAt, now) : 0,
    output: {
      fuel_cell: state.fuelCell,
      circuit_board: state.circuitBoard,
      alloy_plate: state.alloyPlate,
      void_shard: state.voidShard,
      bio_extract: state.bioExtract,
    },
  };
}

/**
 * Transfer items from factory internal inventory to player cargo.
 * Deducts from the factory state; the caller is responsible for
 * adding the items to the player's cargo.
 */
export async function transferOutputToCargo(
  structureId: string,
  itemType: ProcessedItemType,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Invalid amount' };

  const state = await getFactoryState(structureId);
  if (!state) return { success: false, error: 'Factory not found' };

  const stateKey = ITEM_TO_STATE_KEY[itemType];
  if (!stateKey) return { success: false, error: 'Invalid item type' };

  const available = state[stateKey] as number;
  if (available < amount) {
    return { success: false, error: 'Insufficient factory output' };
  }

  await updateFactoryOutput(structureId, itemType, -amount);
  return { success: true };
}
