import { describe, it, expect } from 'vitest';
import {
  calculateCompletedBatches,
  buildFactoryStatus,
  canProduceBatch,
  deductRecipeInputs,
  validateResearch,
  checkResearchComplete,
} from '../production.js';
import type { StorageInventory, ActiveResearch } from '@void-sector/shared';

describe('calculateCompletedBatches', () => {
  it('returns 0 batches if no time has elapsed', () => {
    const now = Date.now();
    const result = calculateCompletedBatches('fuel_cell_basic', now, now);
    expect(result.batches).toBe(0);
  });

  it('calculates one completed batch after one cycle', () => {
    const now = Date.now();
    const cycleMs = 120 * 1000; // fuel_cell_basic = 120s
    const result = calculateCompletedBatches('fuel_cell_basic', now - cycleMs - 1000, now);
    expect(result.batches).toBe(1);
  });

  it('calculates multiple batches', () => {
    const now = Date.now();
    const cycleMs = 120 * 1000;
    const result = calculateCompletedBatches('fuel_cell_basic', now - cycleMs * 3.5, now);
    expect(result.batches).toBe(3);
  });

  it('returns 0 for unknown recipe', () => {
    const now = Date.now();
    const result = calculateCompletedBatches('nonexistent', now - 999999, now);
    expect(result.batches).toBe(0);
  });
});

describe('canProduceBatch', () => {
  it('returns true when storage has enough resources', () => {
    const storage: StorageInventory = { ore: 5, gas: 5, crystal: 0 };
    expect(canProduceBatch('fuel_cell_basic', storage)).toBe(true);
  });

  it('returns false when storage is insufficient', () => {
    const storage: StorageInventory = { ore: 1, gas: 5, crystal: 0 };
    // fuel_cell_basic needs 2 ore
    expect(canProduceBatch('fuel_cell_basic', storage)).toBe(false);
  });

  it('returns false for unknown recipe', () => {
    const storage: StorageInventory = { ore: 100, gas: 100, crystal: 100 };
    expect(canProduceBatch('nonexistent', storage)).toBe(false);
  });
});

describe('deductRecipeInputs', () => {
  it('deducts correct amounts for one batch', () => {
    const storage: StorageInventory = { ore: 10, gas: 10, crystal: 5 };
    // fuel_cell_basic: 2 ore + 3 gas
    const result = deductRecipeInputs('fuel_cell_basic', 1, storage);
    expect(result.ore).toBe(8);
    expect(result.gas).toBe(7);
    expect(result.crystal).toBe(5);
  });

  it('deducts for multiple batches', () => {
    const storage: StorageInventory = { ore: 20, gas: 20, crystal: 5 };
    const result = deductRecipeInputs('fuel_cell_basic', 3, storage);
    // 3 batches × 2 ore = 6 ore deducted; 3 × 3 gas = 9 gas
    expect(result.ore).toBe(14);
    expect(result.gas).toBe(11);
  });

  it('clamps to 0, does not go negative', () => {
    const storage: StorageInventory = { ore: 1, gas: 0, crystal: 0 };
    const result = deductRecipeInputs('fuel_cell_basic', 1, storage);
    expect(result.ore).toBe(0);
    expect(result.gas).toBe(0);
  });

  it('returns unchanged storage for 0 batches', () => {
    const storage: StorageInventory = { ore: 10, gas: 10, crystal: 5 };
    const result = deductRecipeInputs('fuel_cell_basic', 0, storage);
    expect(result.ore).toBe(10);
    expect(result.gas).toBe(10);
  });
});

describe('validateResearch', () => {
  it('rejects unknown recipe', () => {
    const r = validateResearch('nonexistent', [], null, 9999);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Unknown');
  });

  it('rejects already researched recipe', () => {
    const r = validateResearch('circuit_board_t1', ['circuit_board_t1'], null, 9999);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Already');
  });

  it('rejects when research in progress', () => {
    const active: ActiveResearch = { recipeId: 'fuel_cell_efficient', startedAt: Date.now(), completesAt: Date.now() + 999999 };
    const r = validateResearch('circuit_board_t1', [], active, 9999);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('in progress');
  });

  it('rejects when prerequisite not met', () => {
    // void_shard_t1 requires circuit_board_t1
    const r = validateResearch('void_shard_t1', [], null, 99999);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Requires');
  });

  it('rejects when insufficient credits', () => {
    const r = validateResearch('circuit_board_t1', [], null, 100); // needs 300 cr
    expect(r.valid).toBe(false);
    expect(r.error).toContain('300');
  });

  it('accepts valid research', () => {
    const r = validateResearch('circuit_board_t1', [], null, 9999);
    expect(r.valid).toBe(true);
    expect(r.creditCost).toBe(300);
    expect(r.durationMs).toBe(30 * 60 * 1000);
  });
});

describe('checkResearchComplete', () => {
  it('returns null when no active research', () => {
    expect(checkResearchComplete(null)).toBeNull();
  });

  it('returns recipeId when complete', () => {
    const active: ActiveResearch = { recipeId: 'fuel_cell_efficient', startedAt: Date.now() - 99999, completesAt: Date.now() - 1 };
    expect(checkResearchComplete(active, Date.now())).toBe('fuel_cell_efficient');
  });

  it('returns null when not yet complete', () => {
    const active: ActiveResearch = { recipeId: 'fuel_cell_efficient', startedAt: Date.now(), completesAt: Date.now() + 999999 };
    expect(checkResearchComplete(active, Date.now())).toBeNull();
  });
});

describe('buildFactoryStatus', () => {
  it('returns correct status for inactive factory', () => {
    const row = {
      structure_id: 'f1',
      owner_id: 'u1',
      active_recipe_id: null,
      cycle_started_at: null,
      fuel_cell: 3,
      circuit_board: 0,
      alloy_plate: 1,
      void_shard: 0,
      bio_extract: 0,
    };
    const status = buildFactoryStatus(row);
    expect(status.structureId).toBe('f1');
    expect(status.activeRecipeId).toBeNull();
    expect(status.progress).toBe(0);
    expect(status.output.fuel_cell).toBe(3);
    expect(status.output.alloy_plate).toBe(1);
  });

  it('computes progress for active recipe', () => {
    const now = Date.now();
    const halfCycle = 60 * 1000; // half of 120s cycle
    const row = {
      structure_id: 'f1',
      owner_id: 'u1',
      active_recipe_id: 'fuel_cell_basic',
      cycle_started_at: now - halfCycle,
      fuel_cell: 0,
      circuit_board: 0,
      alloy_plate: 0,
      void_shard: 0,
      bio_extract: 0,
    };
    const status = buildFactoryStatus(row, now);
    expect(status.progress).toBeGreaterThan(0.4);
    expect(status.progress).toBeLessThan(0.6);
    expect(status.cycleSeconds).toBe(120);
  });
});
