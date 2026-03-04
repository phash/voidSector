import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPC_STATION_LEVELS, NPC_XP_VISIT, NPC_XP_PER_TRADE_UNIT } from '@void-sector/shared';
import type { NpcStationData, NpcStationInventoryItem } from '@void-sector/shared';

vi.mock('../../db/npcStationQueries.js', () => ({
  getStationData: vi.fn(),
  upsertStationData: vi.fn(),
  getStationInventory: vi.fn(),
  upsertInventoryItem: vi.fn(),
  getStationInventoryItem: vi.fn(),
}));

import {
  getStationData,
  upsertStationData,
  upsertInventoryItem,
  getStationInventoryItem,
} from '../../db/npcStationQueries.js';
import {
  getStationLevel,
  calculateCurrentStock,
  applyXpDecay,
  calculatePrice,
  getOrInitStation,
  recordVisit,
  recordTrade,
  canBuyFromStation,
  canSellToStation,
} from '../npcStationEngine.js';

const mockGetStationData = vi.mocked(getStationData);
const mockUpsertStationData = vi.mocked(upsertStationData);
const mockUpsertInventoryItem = vi.mocked(upsertInventoryItem);
const mockGetStationInventoryItem = vi.mocked(getStationInventoryItem);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// getStationLevel
// ---------------------------------------------------------------------------
describe('getStationLevel', () => {
  it('returns level 1 for 0 XP', () => {
    const result = getStationLevel(0);
    expect(result.level).toBe(1);
    expect(result.name).toBe('Outpost');
    expect(result.maxStock).toBe(200);
  });

  it('returns level 2 for 500 XP', () => {
    const result = getStationLevel(500);
    expect(result.level).toBe(2);
    expect(result.name).toBe('Station');
  });

  it('returns level 3 for 2000 XP', () => {
    const result = getStationLevel(2000);
    expect(result.level).toBe(3);
    expect(result.name).toBe('Hub');
  });

  it('returns level 4 for 6000 XP', () => {
    const result = getStationLevel(6000);
    expect(result.level).toBe(4);
    expect(result.name).toBe('Port');
  });

  it('returns level 5 for 15000 XP', () => {
    const result = getStationLevel(15000);
    expect(result.level).toBe(5);
    expect(result.name).toBe('Megastation');
    expect(result.maxStock).toBe(8000);
  });

  it('returns level 1 for XP just below level 2', () => {
    const result = getStationLevel(499);
    expect(result.level).toBe(1);
  });

  it('returns level 5 for XP well above max threshold', () => {
    const result = getStationLevel(100000);
    expect(result.level).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// calculateCurrentStock
// ---------------------------------------------------------------------------
describe('calculateCurrentStock', () => {
  const baseItem: NpcStationInventoryItem = {
    stationX: 10,
    stationY: 20,
    itemType: 'ore',
    stock: 100,
    maxStock: 200,
    consumptionRate: 5,
    restockRate: 10,
    lastUpdated: new Date('2026-01-01T00:00:00Z').toISOString(),
  };

  it('returns current stock when no time has passed', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(calculateCurrentStock(baseItem, now)).toBe(100);
  });

  it('accumulates stock over time (restock > consumption)', () => {
    // 2 hours later: stock + (10 - 5) * 2 = 100 + 10 = 110
    const now = new Date('2026-01-01T02:00:00Z');
    expect(calculateCurrentStock(baseItem, now)).toBe(110);
  });

  it('clamps stock at maxStock', () => {
    // 100 hours later: stock + (10 - 5) * 100 = 100 + 500 => capped at 200
    const now = new Date('2026-01-05T04:00:00Z');
    expect(calculateCurrentStock(baseItem, now)).toBe(200);
  });

  it('clamps stock at 0 when consumption exceeds restock', () => {
    const depletingItem: NpcStationInventoryItem = {
      ...baseItem,
      stock: 50,
      consumptionRate: 20,
      restockRate: 5,
    };
    // 10 hours: 50 + (5 - 20) * 10 = 50 - 150 => capped at 0
    const now = new Date('2026-01-01T10:00:00Z');
    expect(calculateCurrentStock(depletingItem, now)).toBe(0);
  });

  it('handles zero elapsed time gracefully', () => {
    const now = new Date(baseItem.lastUpdated);
    expect(calculateCurrentStock(baseItem, now)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// applyXpDecay
// ---------------------------------------------------------------------------
describe('applyXpDecay', () => {
  const baseStation: NpcStationData = {
    stationX: 10,
    stationY: 20,
    level: 2,
    xp: 600,
    visitCount: 10,
    tradeVolume: 100,
    lastXpDecay: new Date('2026-01-01T00:00:00Z').toISOString(),
  };

  it('decays XP over time', () => {
    // 10 hours: 600 - 1 * 10 = 590
    const now = new Date('2026-01-01T10:00:00Z');
    const result = applyXpDecay(baseStation, now);
    expect(result.xp).toBe(590);
    expect(result.level).toBe(2);
  });

  it('does not decay below current level threshold', () => {
    // Level 2 threshold is 500. At 600 XP, decaying for 200 hours
    // would be 600 - 200 = 400, but clamped to 500.
    const now = new Date('2026-01-09T08:00:00Z'); // ~200 hours later
    const result = applyXpDecay(baseStation, now);
    expect(result.xp).toBe(500);
    expect(result.level).toBe(2);
  });

  it('returns unchanged station when no time has passed', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = applyXpDecay(baseStation, now);
    expect(result.xp).toBe(600);
  });

  it('updates lastXpDecay timestamp', () => {
    const now = new Date('2026-01-01T05:00:00Z');
    const result = applyXpDecay(baseStation, now);
    expect(result.lastXpDecay).toBe(now.toISOString());
  });

  it('decays level 1 station XP to 0', () => {
    const lvl1Station: NpcStationData = {
      ...baseStation,
      level: 1,
      xp: 50,
    };
    // 100 hours: 50 - 100 = clamped to level 1 threshold (0)
    const now = new Date('2026-01-05T04:00:00Z');
    const result = applyXpDecay(lvl1Station, now);
    expect(result.xp).toBe(0);
    expect(result.level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculatePrice
// ---------------------------------------------------------------------------
describe('calculatePrice', () => {
  it('returns 1x base price at 100% stock', () => {
    expect(calculatePrice(10, 1.0)).toBe(10);
  });

  it('returns 2x base price at 0% stock', () => {
    expect(calculatePrice(10, 0.0)).toBe(20);
  });

  it('returns 1.5x base price at 50% stock', () => {
    expect(calculatePrice(10, 0.5)).toBe(15);
  });

  it('rounds to nearest integer', () => {
    // basePrice=7, stockRatio=0.3: 7*(2-0.3)=7*1.7=11.9 => 12
    expect(calculatePrice(7, 0.3)).toBe(12);
  });

  it('handles zero base price', () => {
    expect(calculatePrice(0, 0.5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getOrInitStation
// ---------------------------------------------------------------------------
describe('getOrInitStation', () => {
  it('returns existing station from DB', async () => {
    const existing: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 2,
      xp: 600,
      visitCount: 5,
      tradeVolume: 50,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(existing);

    const result = await getOrInitStation(5, 10);
    expect(result).toEqual(existing);
    expect(mockUpsertStationData).not.toHaveBeenCalled();
  });

  it('creates new station when not in DB', async () => {
    mockGetStationData.mockResolvedValueOnce(null);
    mockUpsertStationData.mockResolvedValueOnce(undefined);
    mockUpsertInventoryItem.mockResolvedValue(undefined);

    const result = await getOrInitStation(5, 10);
    expect(result.stationX).toBe(5);
    expect(result.stationY).toBe(10);
    expect(result.level).toBe(1);
    expect(result.xp).toBe(0);
    expect(result.visitCount).toBe(0);
    expect(result.tradeVolume).toBe(0);
    expect(mockUpsertStationData).toHaveBeenCalledTimes(1);
    // initStationInventory creates 3 items (ore, gas, crystal)
    expect(mockUpsertInventoryItem).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// recordVisit
// ---------------------------------------------------------------------------
describe('recordVisit', () => {
  it('increments XP by NPC_XP_VISIT', async () => {
    const station: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 1,
      xp: 100,
      visitCount: 3,
      tradeVolume: 0,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(station);
    mockUpsertStationData.mockResolvedValueOnce(undefined);

    await recordVisit(5, 10);

    expect(mockUpsertStationData).toHaveBeenCalledTimes(1);
    const savedData = mockUpsertStationData.mock.calls[0][0];
    expect(savedData.xp).toBe(100 + NPC_XP_VISIT);
    expect(savedData.visitCount).toBe(4);
  });

  it('creates station if not exists, then records visit', async () => {
    mockGetStationData
      .mockResolvedValueOnce(null) // getOrInitStation -> getStationData
      .mockResolvedValueOnce(null); // shouldn't be called again since getOrInitStation returns inline
    mockUpsertStationData.mockResolvedValue(undefined);
    mockUpsertInventoryItem.mockResolvedValue(undefined);

    // getOrInitStation creates the station, then recordVisit gets it via getOrInitStation.
    // First call: getOrInitStation from recordVisit -> calls getStationData (null),
    // then creates + inits inventory, returns new station.
    // The new station has xp: 0, visitCount: 0
    // recordVisit then applies decay + adds NPC_XP_VISIT
    await recordVisit(5, 10);

    // upsertStationData: once from getOrInitStation init, once from recordVisit itself
    expect(mockUpsertStationData).toHaveBeenCalledTimes(2);
    const lastSaved = mockUpsertStationData.mock.calls[1][0];
    expect(lastSaved.xp).toBe(NPC_XP_VISIT);
    expect(lastSaved.visitCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// recordTrade
// ---------------------------------------------------------------------------
describe('recordTrade', () => {
  it('increments XP based on units traded', async () => {
    const station: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 1,
      xp: 50,
      visitCount: 2,
      tradeVolume: 20,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(station);
    mockUpsertStationData.mockResolvedValueOnce(undefined);

    await recordTrade(5, 10, 15);

    expect(mockUpsertStationData).toHaveBeenCalledTimes(1);
    const savedData = mockUpsertStationData.mock.calls[0][0];
    expect(savedData.xp).toBe(50 + 15 * NPC_XP_PER_TRADE_UNIT);
    expect(savedData.tradeVolume).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// canBuyFromStation / canSellToStation
// ---------------------------------------------------------------------------
describe('canBuyFromStation', () => {
  it('returns ok when stock is sufficient', async () => {
    const station: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 1,
      xp: 0,
      visitCount: 0,
      tradeVolume: 0,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(station);
    const item: NpcStationInventoryItem = {
      stationX: 5,
      stationY: 10,
      itemType: 'ore',
      stock: 100,
      maxStock: 200,
      consumptionRate: 0,
      restockRate: 0,
      lastUpdated: new Date().toISOString(),
    };
    mockGetStationInventoryItem.mockResolvedValueOnce(item);

    const result = await canBuyFromStation(5, 10, 'ore', 10);
    expect(result.ok).toBe(true);
    expect(result.stock).toBe(100);
    expect(result.price).toBeGreaterThan(0);
  });

  it('returns not ok when stock is insufficient', async () => {
    const station: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 1,
      xp: 0,
      visitCount: 0,
      tradeVolume: 0,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(station);
    const item: NpcStationInventoryItem = {
      stationX: 5,
      stationY: 10,
      itemType: 'ore',
      stock: 5,
      maxStock: 200,
      consumptionRate: 0,
      restockRate: 0,
      lastUpdated: new Date().toISOString(),
    };
    mockGetStationInventoryItem.mockResolvedValueOnce(item);

    const result = await canBuyFromStation(5, 10, 'ore', 10);
    expect(result.ok).toBe(false);
    expect(result.stock).toBe(5);
  });
});

describe('canSellToStation', () => {
  it('returns ok when capacity is available', async () => {
    const station: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 1,
      xp: 0,
      visitCount: 0,
      tradeVolume: 0,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(station);
    const item: NpcStationInventoryItem = {
      stationX: 5,
      stationY: 10,
      itemType: 'ore',
      stock: 50,
      maxStock: 200,
      consumptionRate: 0,
      restockRate: 0,
      lastUpdated: new Date().toISOString(),
    };
    mockGetStationInventoryItem.mockResolvedValueOnce(item);

    const result = await canSellToStation(5, 10, 'ore', 10);
    expect(result.ok).toBe(true);
    expect(result.capacity).toBe(150);
    expect(result.price).toBeGreaterThan(0);
  });

  it('returns not ok when station is full', async () => {
    const station: NpcStationData = {
      stationX: 5,
      stationY: 10,
      level: 1,
      xp: 0,
      visitCount: 0,
      tradeVolume: 0,
      lastXpDecay: new Date().toISOString(),
    };
    mockGetStationData.mockResolvedValueOnce(station);
    const item: NpcStationInventoryItem = {
      stationX: 5,
      stationY: 10,
      itemType: 'ore',
      stock: 200,
      maxStock: 200,
      consumptionRate: 0,
      restockRate: 0,
      lastUpdated: new Date().toISOString(),
    };
    mockGetStationInventoryItem.mockResolvedValueOnce(item);

    const result = await canSellToStation(5, 10, 'ore', 10);
    expect(result.ok).toBe(false);
    expect(result.capacity).toBe(0);
  });
});
