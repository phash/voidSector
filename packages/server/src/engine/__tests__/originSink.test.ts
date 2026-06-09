import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/npcStationQueries.js', async (orig) => {
  const fullItem = {
    itemType: 'ore',
    stock: 8000,
    maxStock: 8000,
    restockRate: 0,
    consumptionRate: 0,
    lastUpdated: new Date().toISOString(),
  };
  return {
    ...(await orig<typeof import('../../db/npcStationQueries.js')>()),
    getStationData: vi.fn().mockResolvedValue({
      stationX: 0,
      stationY: 0,
      level: 5,
      xp: 15000,
      visitCount: 0,
      tradeVolume: 0,
      lastXpDecay: new Date().toISOString(),
    }),
    getStationInventory: vi.fn().mockResolvedValue([fullItem]),
    getStationInventoryItem: vi.fn().mockImplementation(
      async (_x: number, _y: number, t: string) =>
        t === fullItem.itemType ? fullItem : { ...fullItem, itemType: t },
    ),
    upsertStationData: vi.fn(),
    upsertInventoryItem: vi.fn(),
    decrementStationStock: vi.fn(),
  };
});

import { canSellToStation } from '../npcStationEngine.js';

describe('0:0 always-buy sink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('0:0 accepts the FULL amount of ore even when inventory is full', async () => {
    const r = await canSellToStation(0, 0, 'ore', 500);
    expect(r.ok).toBe(true);
    expect(r.effectiveAmount).toBe(500); // not clamped to remaining capacity (0)
    expect(r.price).toBeGreaterThan(0); // pays a floor price at full stock
  });

  it('a non-origin station at full stock takes nothing (normal capacity rule)', async () => {
    const r = await canSellToStation(7, 7, 'ore', 500);
    expect(r.effectiveAmount).toBe(0);
    expect(r.ok).toBe(false);
  });

  it('0:0 does NOT special-case non-basic resources', async () => {
    const r = await canSellToStation(0, 0, 'fuel', 500); // 'fuel' is not ore/gas/crystal
    expect(r.effectiveAmount).toBe(0); // full station, no sink for non-basics
  });
});
