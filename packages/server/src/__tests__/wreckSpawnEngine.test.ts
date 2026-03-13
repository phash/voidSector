import { describe, it, expect } from 'vitest';
import {
  calcSpawnChance,
  calcWreckTier,
  generateWreckItems,
  calcSalvageChance,
} from '../engine/wreckSpawnEngine.js';

describe('calcSpawnChance', () => {
  it('returns ~2% at origin', () => {
    expect(calcSpawnChance(0, 0)).toBeCloseTo(0.02);
  });

  it('increases with distance', () => {
    expect(calcSpawnChance(10, 0)).toBeGreaterThan(calcSpawnChance(0, 0));
  });

  it('caps at 20%', () => {
    expect(calcSpawnChance(1000, 0)).toBe(0.20);
  });
});

describe('calcWreckTier', () => {
  it('returns 1 at origin', () => {
    expect(calcWreckTier(0, 0)).toBe(1);
  });

  it('returns 3 at distance ~20', () => {
    expect(calcWreckTier(15, 5)).toBe(3);
  });

  it('returns 5 far out', () => {
    expect(calcWreckTier(50, 50)).toBe(5);
  });
});

describe('generateWreckItems', () => {
  it('returns 2–3 items for small tier-1 wreck', () => {
    const items = generateWreckItems(1, 'small');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it('items have valid baseDifficulty', () => {
    const items = generateWreckItems(2, 'medium');
    items.forEach((item) => {
      expect(item.baseDifficulty).toBeGreaterThanOrEqual(0);
      expect(item.baseDifficulty).toBeLessThanOrEqual(1);
    });
  });

  it('higher tier wrecks can contain modules/blueprints', () => {
    // Run many times — tier 3+ should produce non-resource items occasionally
    const allItems = Array.from({ length: 50 }, () => generateWreckItems(3, 'medium')).flat();
    const hasNonResource = allItems.some((i) => i.itemType !== 'resource');
    expect(hasNonResource).toBe(true);
  });
});

describe('calcSalvageChance', () => {
  it('resource at modifier=0, explorerXp=0 → 0.80', () => {
    expect(calcSalvageChance(0.20, 0, 0)).toBeCloseTo(0.80);
  });

  it('explorerXp adds bonus', () => {
    expect(calcSalvageChance(0.20, 0, 10)).toBeGreaterThan(calcSalvageChance(0.20, 0, 0));
  });

  it('positive modifier reduces chance', () => {
    expect(calcSalvageChance(0.50, 0.15, 0)).toBeLessThan(calcSalvageChance(0.50, 0, 0));
  });

  it('clamps to [0.05, 0.95]', () => {
    expect(calcSalvageChance(0.99, 0.3, 0)).toBeGreaterThanOrEqual(0.05);
    expect(calcSalvageChance(0.01, -0.3, 50)).toBeLessThanOrEqual(0.95);
  });
});
