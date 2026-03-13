import { describe, it, expect } from 'vitest';
import {
  getScarcityMultiplier,
  calculatePassiveGen,
  advanceProductionQueue,
} from '../stationProductionEngine.js';
import { getTierConfig } from '@void-sector/shared';
import type { StationProductionRow } from '../../db/stationProductionQueries.js';

const TIER1 = getTierConfig(1);

function makeRow(overrides: Partial<StationProductionRow> = {}): StationProductionRow {
  return {
    sector_x: 3,
    sector_y: 3,
    resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
    passive_gen_last_tick: new Date(),
    queue_index: 0,
    current_item_started_at: null,
    finished_goods: {},
    ...overrides,
  };
}

describe('getScarcityMultiplier', () => {
  it('returns 1.5 when ratio < 0.25', () => {
    expect(getScarcityMultiplier(20, 100)).toBe(1.5);
  });
  it('returns 1.2 when ratio is 0.25–0.49', () => {
    expect(getScarcityMultiplier(40, 100)).toBe(1.2);
  });
  it('returns 1.0 when ratio is 0.50–0.74', () => {
    expect(getScarcityMultiplier(60, 100)).toBe(1.0);
  });
  it('returns 0.8 when ratio >= 0.75', () => {
    expect(getScarcityMultiplier(80, 100)).toBe(0.8);
  });
  it('returns 1.5 when max is 0', () => {
    expect(getScarcityMultiplier(0, 0)).toBe(1.5);
  });
});

describe('calculatePassiveGen', () => {
  it('generates correct amounts after 1 hour for tier 1', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3_600_000);
    const result = calculatePassiveGen({ ore: 10, gas: 5, crystal: 0 }, oneHourAgo, now, TIER1);
    expect(result.ore).toBeCloseTo(12, 0);
    expect(result.gas).toBeCloseTo(6, 0);
    expect(result.crystal).toBeCloseTo(0, 0);
  });
  it('caps at maxStockpilePerResource', () => {
    const now = new Date();
    const longAgo = new Date(now.getTime() - 100 * 3_600_000);
    const result = calculatePassiveGen({ ore: 0, gas: 0, crystal: 0 }, longAgo, now, TIER1);
    expect(result.ore).toBe(TIER1.maxStockpilePerResource);
    expect(result.gas).toBe(TIER1.maxStockpilePerResource);
  });
});

describe('advanceProductionQueue', () => {
  it('starts item and deducts resources when not yet started', () => {
    const row = makeRow({
      queue_index: 0,
      current_item_started_at: null,
      resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.current_item_started_at).not.toBeNull();
    expect(result.resource_stockpile.gas).toBe(47); // fuel costs gas:3
    expect(result.resource_stockpile.crystal).toBe(49); // fuel costs crystal:1
  });
  it('does not start when resources missing', () => {
    const row = makeRow({
      queue_index: 0,
      current_item_started_at: null,
      resource_stockpile: { ore: 0, gas: 0, crystal: 0 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.current_item_started_at).toBeNull();
  });
  it('completes item and adds to finished_goods when time elapsed', () => {
    const startedAt = new Date(Date.now() - 200_000); // 200s ago, fuel=60s
    const row = makeRow({
      queue_index: 0,
      current_item_started_at: startedAt,
      resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.finished_goods['fuel']).toBeGreaterThan(0);
  });
  it('cycles back to index 0 after last item', () => {
    const lastIdx = TIER1.items.length - 1;
    const startedAt = new Date(Date.now() - 100_000_000);
    const row = makeRow({
      queue_index: lastIdx,
      current_item_started_at: startedAt,
      resource_stockpile: { ore: 0, gas: 0, crystal: 0 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.queue_index).toBe(0);
  });
  it('does not exceed maxStock', () => {
    const fuelCfg = TIER1.items.find(i => i.itemId === 'fuel')!;
    const startedAt = new Date(Date.now() - 100_000_000);
    const row = makeRow({
      queue_index: 0,
      current_item_started_at: startedAt,
      resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
      finished_goods: { fuel: fuelCfg.maxStock },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.finished_goods['fuel']).toBe(fuelCfg.maxStock);
  });
});
