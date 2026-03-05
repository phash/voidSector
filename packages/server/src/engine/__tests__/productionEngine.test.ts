import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRODUCTION_RECIPES } from '@void-sector/shared';
import type { FactoryState, ProductionRecipe } from '@void-sector/shared';

vi.mock('../../db/factoryQueries.js', () => ({
  getFactoryState: vi.fn(),
  upsertFactoryState: vi.fn(),
  updateFactoryOutput: vi.fn(),
}));

import {
  getFactoryState,
  upsertFactoryState,
  updateFactoryOutput,
} from '../../db/factoryQueries.js';
import {
  calculateCompletedCycles,
  calculateProgress,
  getOrCreateFactoryState,
  setActiveRecipe,
  collectOutput,
  getFactoryStatus,
  transferOutputToCargo,
} from '../productionEngine.js';

const mockGetFactoryState = vi.mocked(getFactoryState);
const mockUpsertFactoryState = vi.mocked(upsertFactoryState);
const mockUpdateFactoryOutput = vi.mocked(updateFactoryOutput);

beforeEach(() => {
  vi.resetAllMocks();
});

// Convenience: grab a recipe from the shared constants
const fuelCellRecipe = PRODUCTION_RECIPES.find((r) => r.id === 'fuel_cell_basic')!;
const alloyPlateRecipe = PRODUCTION_RECIPES.find((r) => r.id === 'alloy_plate_basic')!;
const circuitBoardRecipe = PRODUCTION_RECIPES.find((r) => r.id === 'circuit_board_t1')!;

function makeState(overrides: Partial<FactoryState> = {}): FactoryState {
  return {
    structureId: 'factory-1',
    ownerId: 'user-1',
    activeRecipeId: null,
    cycleStartedAt: null,
    fuelCell: 0,
    circuitBoard: 0,
    alloyPlate: 0,
    voidShard: 0,
    bioExtract: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateCompletedCycles
// ---------------------------------------------------------------------------
describe('calculateCompletedCycles', () => {
  it('returns 0 when no time has elapsed', () => {
    const now = 1000000;
    expect(calculateCompletedCycles(fuelCellRecipe, now, now)).toBe(0);
  });

  it('returns 0 when less than one cycle has passed', () => {
    const start = 1000000;
    const now = start + (fuelCellRecipe.cycleSeconds - 1) * 1000;
    expect(calculateCompletedCycles(fuelCellRecipe, start, now)).toBe(0);
  });

  it('returns 1 when exactly one cycle has passed', () => {
    const start = 1000000;
    const now = start + fuelCellRecipe.cycleSeconds * 1000;
    expect(calculateCompletedCycles(fuelCellRecipe, start, now)).toBe(1);
  });

  it('returns multiple cycles for longer elapsed time', () => {
    const start = 1000000;
    // 5.5 cycles worth of time => 5 completed
    const now = start + fuelCellRecipe.cycleSeconds * 5.5 * 1000;
    expect(calculateCompletedCycles(fuelCellRecipe, start, now)).toBe(5);
  });

  it('returns 0 for negative elapsed time', () => {
    const start = 1000000;
    const now = start - 5000;
    expect(calculateCompletedCycles(fuelCellRecipe, start, now)).toBe(0);
  });

  it('handles different recipe cycle durations', () => {
    // alloy_plate_basic has 180s cycle
    const start = 0;
    const now = 180 * 3 * 1000; // 3 full cycles
    expect(calculateCompletedCycles(alloyPlateRecipe, start, now)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calculateProgress
// ---------------------------------------------------------------------------
describe('calculateProgress', () => {
  it('returns 0 when cycle just started', () => {
    const now = 1000000;
    expect(calculateProgress(fuelCellRecipe, now, now)).toBe(0);
  });

  it('returns ~0.5 at half cycle', () => {
    const start = 0;
    const now = (fuelCellRecipe.cycleSeconds / 2) * 1000;
    expect(calculateProgress(fuelCellRecipe, start, now)).toBeCloseTo(0.5, 5);
  });

  it('returns close to 1 near cycle end', () => {
    const start = 0;
    // 119.9 seconds into a 120-second cycle
    const now = 119.9 * 1000;
    const progress = calculateProgress(fuelCellRecipe, start, now);
    expect(progress).toBeGreaterThan(0.99);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it('wraps back after a full cycle (shows progress of next cycle)', () => {
    const start = 0;
    // Exactly 1 cycle + 60 seconds (half of next cycle)
    const now = (fuelCellRecipe.cycleSeconds + fuelCellRecipe.cycleSeconds / 2) * 1000;
    expect(calculateProgress(fuelCellRecipe, start, now)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 for negative elapsed time', () => {
    expect(calculateProgress(fuelCellRecipe, 5000, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getOrCreateFactoryState
// ---------------------------------------------------------------------------
describe('getOrCreateFactoryState', () => {
  it('returns existing state from DB', async () => {
    const existing = makeState({ fuelCell: 5 });
    mockGetFactoryState.mockResolvedValueOnce(existing);

    const result = await getOrCreateFactoryState('factory-1', 'user-1');
    expect(result).toEqual(existing);
    expect(mockUpsertFactoryState).not.toHaveBeenCalled();
  });

  it('creates and persists new state when none exists', async () => {
    mockGetFactoryState.mockResolvedValueOnce(null);
    mockUpsertFactoryState.mockResolvedValueOnce(undefined);

    const result = await getOrCreateFactoryState('factory-1', 'user-1');
    expect(result.structureId).toBe('factory-1');
    expect(result.ownerId).toBe('user-1');
    expect(result.activeRecipeId).toBeNull();
    expect(result.fuelCell).toBe(0);
    expect(mockUpsertFactoryState).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// setActiveRecipe
// ---------------------------------------------------------------------------
describe('setActiveRecipe', () => {
  it('sets recipe and resets cycle timer', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState());
    mockUpsertFactoryState.mockResolvedValueOnce(undefined);

    const result = await setActiveRecipe('factory-1', 'fuel_cell_basic', []);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const saved = mockUpsertFactoryState.mock.calls[0][0];
    expect(saved.activeRecipeId).toBe('fuel_cell_basic');
    expect(saved.cycleStartedAt).toBeGreaterThan(0);
  });

  it('rejects unknown recipe', async () => {
    const result = await setActiveRecipe('factory-1', 'nonexistent_recipe', []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown recipe');
    expect(mockGetFactoryState).not.toHaveBeenCalled();
  });

  it('rejects recipe that requires research the player lacks', async () => {
    const result = await setActiveRecipe('factory-1', 'circuit_board_t1', []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Recipe not researched');
  });

  it('allows researched recipe when blueprint is present', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState());
    mockUpsertFactoryState.mockResolvedValueOnce(undefined);

    const result = await setActiveRecipe('factory-1', 'circuit_board_t1', ['circuit_board_t1']);
    expect(result.success).toBe(true);
  });

  it('returns error when factory not found', async () => {
    mockGetFactoryState.mockResolvedValueOnce(null);

    const result = await setActiveRecipe('factory-1', 'fuel_cell_basic', []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Factory not found');
  });
});

// ---------------------------------------------------------------------------
// collectOutput
// ---------------------------------------------------------------------------
describe('collectOutput', () => {
  it('returns error when no active production', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState());

    const result = await collectOutput('factory-1', {});
    expect(result.error).toBe('No active production');
    expect(result.collected).toEqual({});
    expect(result.consumed).toEqual({});
  });

  it('returns empty when 0 cycles completed', async () => {
    const state = makeState({
      activeRecipeId: 'fuel_cell_basic',
      cycleStartedAt: Date.now(), // just started
    });
    mockGetFactoryState.mockResolvedValueOnce(state);

    const result = await collectOutput('factory-1', { ore: 100, gas: 100 });
    expect(result.collected).toEqual({});
    expect(result.consumed).toEqual({});
    expect(result.error).toBeUndefined();
  });

  it('collects cycles and consumes resources', async () => {
    // 2 full cycles elapsed (fuel_cell_basic: 120s each)
    const start = Date.now() - 120 * 2 * 1000;
    const state = makeState({
      activeRecipeId: 'fuel_cell_basic',
      cycleStartedAt: start,
    });
    mockGetFactoryState.mockResolvedValueOnce(state);
    mockUpdateFactoryOutput.mockResolvedValueOnce(undefined);
    mockUpsertFactoryState.mockResolvedValueOnce(undefined);

    const result = await collectOutput('factory-1', { ore: 100, gas: 100 });
    expect(result.collected).toEqual({ fuel_cell: 2 }); // 1 per cycle * 2
    expect(result.consumed).toEqual({ ore: 4, gas: 6 }); // 2 ore + 3 gas per cycle * 2
    expect(result.error).toBeUndefined();

    // Check factory output was updated
    expect(mockUpdateFactoryOutput).toHaveBeenCalledWith('factory-1', 'fuel_cell', 2);
  });

  it('limits cycles when storage resources are insufficient', async () => {
    // 10 full cycles elapsed
    const start = Date.now() - 120 * 10 * 1000;
    const state = makeState({
      activeRecipeId: 'fuel_cell_basic',
      cycleStartedAt: start,
    });
    mockGetFactoryState.mockResolvedValueOnce(state);
    mockUpdateFactoryOutput.mockResolvedValueOnce(undefined);
    mockUpsertFactoryState.mockResolvedValueOnce(undefined);

    // Only enough ore for 3 cycles (2 ore/cycle = 6 ore) and gas for 2 cycles (3 gas/cycle = 6 gas)
    const result = await collectOutput('factory-1', { ore: 6, gas: 6 });
    // Limited by gas: floor(6/3) = 2 cycles
    expect(result.collected).toEqual({ fuel_cell: 2 });
    expect(result.consumed).toEqual({ ore: 4, gas: 6 });
  });

  it('returns error when storage has zero of a required resource', async () => {
    const start = Date.now() - 120 * 5 * 1000;
    const state = makeState({
      activeRecipeId: 'fuel_cell_basic',
      cycleStartedAt: start,
    });
    mockGetFactoryState.mockResolvedValueOnce(state);

    const result = await collectOutput('factory-1', { ore: 100 }); // no gas
    expect(result.error).toBe('Insufficient resources in storage');
    expect(result.collected).toEqual({});
  });

  it('returns error for invalid recipe in state', async () => {
    const state = makeState({
      activeRecipeId: 'bogus_recipe',
      cycleStartedAt: Date.now() - 500000,
    });
    mockGetFactoryState.mockResolvedValueOnce(state);

    const result = await collectOutput('factory-1', {});
    expect(result.error).toBe('Invalid recipe');
  });

  it('preserves remainder time after collection', async () => {
    // 2.5 cycles elapsed (120s * 2.5 = 300s)
    const now = Date.now();
    const start = now - 300 * 1000;
    const state = makeState({
      activeRecipeId: 'fuel_cell_basic',
      cycleStartedAt: start,
    });
    mockGetFactoryState.mockResolvedValueOnce(state);
    mockUpdateFactoryOutput.mockResolvedValueOnce(undefined);
    mockUpsertFactoryState.mockResolvedValueOnce(undefined);

    await collectOutput('factory-1', { ore: 100, gas: 100 });

    // Verify cycle timer was advanced, preserving the 0.5 cycle remainder
    const savedState = mockUpsertFactoryState.mock.calls[0][0];
    // The new cycleStartedAt should be approximately now - 60s (half a cycle)
    const remainderSecs = (now - savedState.cycleStartedAt!) / 1000;
    expect(remainderSecs).toBeGreaterThan(55);
    expect(remainderSecs).toBeLessThan(65);
  });
});

// ---------------------------------------------------------------------------
// getFactoryStatus
// ---------------------------------------------------------------------------
describe('getFactoryStatus', () => {
  it('returns null recipe when no state exists', async () => {
    mockGetFactoryState.mockResolvedValueOnce(null);

    const status = await getFactoryStatus('factory-1');
    expect(status.activeRecipe).toBeNull();
    expect(status.progress).toBe(0);
    expect(status.completedCycles).toBe(0);
    expect(status.output).toEqual({});
  });

  it('returns null recipe when no active recipe set', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState({ fuelCell: 3 }));

    const status = await getFactoryStatus('factory-1');
    expect(status.activeRecipe).toBeNull();
    expect(status.progress).toBe(0);
    expect(status.completedCycles).toBe(0);
    expect(status.output).toEqual({
      fuel_cell: 3,
      circuit_board: 0,
      alloy_plate: 0,
      void_shard: 0,
      bio_extract: 0,
    });
  });

  it('returns progress and completed cycles for active recipe', async () => {
    // 1.5 cycles elapsed
    const start = Date.now() - 120 * 1.5 * 1000;
    const state = makeState({
      activeRecipeId: 'fuel_cell_basic',
      cycleStartedAt: start,
      fuelCell: 5,
      alloyPlate: 2,
    });
    mockGetFactoryState.mockResolvedValueOnce(state);

    const status = await getFactoryStatus('factory-1');
    expect(status.activeRecipe).toEqual(fuelCellRecipe);
    expect(status.completedCycles).toBe(1);
    expect(status.progress).toBeCloseTo(0.5, 1);
    expect(status.output.fuel_cell).toBe(5);
    expect(status.output.alloy_plate).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// transferOutputToCargo
// ---------------------------------------------------------------------------
describe('transferOutputToCargo', () => {
  it('deducts items from factory output', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState({ fuelCell: 10 }));
    mockUpdateFactoryOutput.mockResolvedValueOnce(undefined);

    const result = await transferOutputToCargo('factory-1', 'fuel_cell', 5);
    expect(result.success).toBe(true);
    expect(mockUpdateFactoryOutput).toHaveBeenCalledWith('factory-1', 'fuel_cell', -5);
  });

  it('rejects when amount exceeds available', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState({ fuelCell: 3 }));

    const result = await transferOutputToCargo('factory-1', 'fuel_cell', 5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient factory output');
    expect(mockUpdateFactoryOutput).not.toHaveBeenCalled();
  });

  it('rejects invalid amount', async () => {
    const result = await transferOutputToCargo('factory-1', 'fuel_cell', 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('rejects negative amount', async () => {
    const result = await transferOutputToCargo('factory-1', 'fuel_cell', -1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('returns error when factory not found', async () => {
    mockGetFactoryState.mockResolvedValueOnce(null);

    const result = await transferOutputToCargo('factory-1', 'fuel_cell', 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Factory not found');
  });

  it('handles different item types correctly', async () => {
    mockGetFactoryState.mockResolvedValueOnce(makeState({ circuitBoard: 7 }));
    mockUpdateFactoryOutput.mockResolvedValueOnce(undefined);

    const result = await transferOutputToCargo('factory-1', 'circuit_board', 3);
    expect(result.success).toBe(true);
    expect(mockUpdateFactoryOutput).toHaveBeenCalledWith('factory-1', 'circuit_board', -3);
  });
});
