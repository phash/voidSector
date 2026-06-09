// packages/server/src/engine/__tests__/originTradeStation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB layer that npcStationEngine uses — preserve all real exports
// so getStationLevel, initStationInventory, resolveTraderExport, etc. keep working.
vi.mock('../../db/npcStationQueries.js', async (orig) => ({
  ...(await orig<typeof import('../../db/npcStationQueries.js')>()),
  upsertStationData: vi.fn().mockResolvedValue(undefined),
  upsertInventoryItem: vi.fn().mockResolvedValue(undefined),
}));

import { upsertStationData, upsertInventoryItem } from '../../db/npcStationQueries.js';
import { ensureOriginTradeStation, getStationLevel } from '../npcStationEngine.js';

describe('ensureOriginTradeStation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getStationLevel(15000) sanity: level 5, maxStock 8000', () => {
    const level = getStationLevel(15000);
    expect(level.level).toBe(5);
    expect(level.maxStock).toBe(8000);
  });

  it('upserts station at 0,0 with level 5 and xp >= 15000', async () => {
    await ensureOriginTradeStation();

    expect(vi.mocked(upsertStationData)).toHaveBeenCalledOnce();
    const arg = vi.mocked(upsertStationData).mock.calls[0][0];
    expect(arg).toMatchObject({ stationX: 0, stationY: 0, level: 5 });
    expect(arg.xp).toBeGreaterThanOrEqual(15000);
  });

  it('seeds inventory for ore, gas, and crystal with maxStock 8000', async () => {
    await ensureOriginTradeStation();

    const calls = vi.mocked(upsertInventoryItem).mock.calls;
    const itemTypes = calls.map((c) => c[0].itemType);
    expect(itemTypes).toContain('ore');
    expect(itemTypes).toContain('gas');
    expect(itemTypes).toContain('crystal');
    expect(calls).toHaveLength(3);
    for (const [arg] of calls) {
      expect(arg.maxStock).toBe(8000);
    }
  });

  it('is idempotent — calling twice calls upsert twice without error', async () => {
    await ensureOriginTradeStation();
    await ensureOriginTradeStation();

    expect(vi.mocked(upsertStationData)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(upsertInventoryItem)).toHaveBeenCalledTimes(6);
  });
});
