import { describe, it, expect } from 'vitest';
import {
  calculateCurrentStock,
  getStationLevel,
  applyXpDecay,
  buildInventoryItems,
  calcTradeXp,
  getBasePrice,
} from '../npcStation.js';

describe('calculateCurrentStock', () => {
  it('reduces stock via consumption over time', () => {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    // stock=100, max=100, consumption=10/h, restock=0, elapsed=1h → 90
    expect(calculateCurrentStock(100, 100, 10, 0, oneHourAgo, now)).toBe(90);
  });

  it('increases stock via restock over time', () => {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    // stock=50, max=100, consumption=0, restock=20/h, elapsed=1h → 70
    expect(calculateCurrentStock(50, 100, 0, 20, oneHourAgo, now)).toBe(70);
  });

  it('clamps stock to 0 minimum', () => {
    const now = Date.now();
    const tenHoursAgo = now - 36_000_000;
    // stock=5, consumption=10/h, elapsed=10h → would be -95, clamped to 0
    expect(calculateCurrentStock(5, 100, 10, 0, tenHoursAgo, now)).toBe(0);
  });

  it('clamps stock to maxStock', () => {
    const now = Date.now();
    const tenHoursAgo = now - 36_000_000;
    // stock=90, restock=10/h, elapsed=10h → would be 190, clamped to max 100
    expect(calculateCurrentStock(90, 100, 0, 10, tenHoursAgo, now)).toBe(100);
  });

  it('handles no time elapsed', () => {
    const now = Date.now();
    expect(calculateCurrentStock(42, 100, 5, 3, now, now)).toBe(42);
  });
});

describe('getStationLevel', () => {
  it('level 1 for 0 xp', () => {
    expect(getStationLevel(0)).toBe(1);
  });
  it('level 2 at 500 xp', () => {
    expect(getStationLevel(500)).toBe(2);
  });
  it('level 3 at 2000 xp', () => {
    expect(getStationLevel(2000)).toBe(3);
  });
  it('level 5 at 15000 xp', () => {
    expect(getStationLevel(15000)).toBe(5);
  });
  it('level 4 at 10000 xp (between 6000 and 15000)', () => {
    expect(getStationLevel(10000)).toBe(4);
  });
});

describe('applyXpDecay', () => {
  it('decays XP over time', () => {
    const now = Date.now();
    const tenHoursAgo = now - 36_000_000; // 10 hours
    // level 1 min xp = 0; decay = 1/h; elapsed=10h → decay 10
    const result = applyXpDecay(100, 1, tenHoursAgo, now);
    expect(result).toBe(90);
  });

  it('does not decay below level minimum XP', () => {
    const now = Date.now();
    const hundredHoursAgo = now - 360_000_000;
    // level 2 min xp = 500; decay could go to -inf but clamped to 500
    const result = applyXpDecay(520, 2, hundredHoursAgo, now);
    expect(result).toBe(500);
  });
});

describe('calcTradeXp', () => {
  it('computes XP from unit count', () => {
    expect(calcTradeXp(10)).toBe(10);
    expect(calcTradeXp(100)).toBe(100);
  });
});

describe('getBasePrice', () => {
  it('returns NPC_PRICES for raw resources', () => {
    expect(getBasePrice('ore')).toBe(10);
    expect(getBasePrice('gas')).toBe(15);
    expect(getBasePrice('crystal')).toBe(25);
  });

  it('returns NPC_PROCESSED_PRICES for processed items', () => {
    expect(getBasePrice('fuel_cell')).toBe(25);
    expect(getBasePrice('circuit_board')).toBe(70);
    expect(getBasePrice('alloy_plate')).toBe(40);
    expect(getBasePrice('void_shard')).toBe(200);
    expect(getBasePrice('bio_extract')).toBe(100);
  });
});

describe('buildInventoryItems', () => {
  it('builds items for level 1 station', () => {
    const now = Date.now();
    const stockMap = new Map([
      ['ore', { stock: 40, maxStock: 80, consumptionRate: 2, restockRate: 3, lastUpdated: now }],
    ]);
    const items = buildInventoryItems(1, stockMap, 'neutral', now);
    const ore = items.find(i => i.itemType === 'ore');
    expect(ore).toBeDefined();
    expect(ore!.stock).toBe(40);
    expect(ore!.maxStock).toBe(80);
    expect(ore!.available).toBe(true);
    expect(ore!.accepts).toBe(true);
  });

  it('marks item unavailable when stock is 0', () => {
    const now = Date.now();
    const stockMap = new Map([
      ['ore', { stock: 0, maxStock: 80, consumptionRate: 0, restockRate: 0, lastUpdated: now }],
    ]);
    const items = buildInventoryItems(1, stockMap, 'neutral', now);
    const ore = items.find(i => i.itemType === 'ore');
    expect(ore!.available).toBe(false);
    expect(ore!.sellPrice).toBe(0);
  });

  it('marks item as not accepting when stock is full', () => {
    const now = Date.now();
    const stockMap = new Map([
      ['ore', { stock: 80, maxStock: 80, consumptionRate: 0, restockRate: 0, lastUpdated: now }],
    ]);
    const items = buildInventoryItems(1, stockMap, 'neutral', now);
    const ore = items.find(i => i.itemType === 'ore');
    expect(ore!.accepts).toBe(false);
  });

  it('applies reputation modifier to prices', () => {
    const now = Date.now();
    const stockMap = new Map([
      ['ore', { stock: 40, maxStock: 80, consumptionRate: 0, restockRate: 0, lastUpdated: now }],
    ]);
    const neutralItems = buildInventoryItems(1, stockMap, 'neutral', now);
    const honoredItems = buildInventoryItems(1, stockMap, 'honored', now);

    const neutralOre = neutralItems.find(i => i.itemType === 'ore')!;
    const honoredOre = honoredItems.find(i => i.itemType === 'ore')!;

    // honored tier gets REP_PRICE_MODIFIERS = 0.75, so prices should be lower
    expect(honoredOre.sellPrice).toBeLessThan(neutralOre.sellPrice);
    expect(honoredOre.buyPrice).toBeLessThan(neutralOre.buyPrice);
  });
});
