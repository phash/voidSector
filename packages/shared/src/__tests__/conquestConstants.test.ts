import { describe, it, expect } from 'vitest';
import {
  CONQUEST_RATE,
  CONQUEST_POOL_DRAIN_PER_TICK,
  CONQUEST_POOL_MAX,
  getConquestPriceBonus,
} from '../constants.js';

describe('CONQUEST_RATE', () => {
  it('level 1 base = 1.0', () => expect(CONQUEST_RATE[1].base).toBe(1.0));
  it('level 2 boosted = 2.0', () => expect(CONQUEST_RATE[2].boosted).toBe(2.0));
  it('level 3 boosted = 3.0', () => expect(CONQUEST_RATE[3].boosted).toBe(3.0));
});

describe('getConquestPriceBonus', () => {
  it('dist 5 → +5', () => expect(getConquestPriceBonus(3, 4)).toBe(5));
  it('dist 10 → +10', () => expect(getConquestPriceBonus(6, 8)).toBe(10));
  it('dist 30 → +50', () => expect(getConquestPriceBonus(18, 24)).toBe(50));
  it('origin (0,0) → 0', () => expect(getConquestPriceBonus(0, 0)).toBe(0));
});

describe('pool constants', () => {
  it('drain is 50', () => expect(CONQUEST_POOL_DRAIN_PER_TICK).toBe(50));
  it('max is 500', () => expect(CONQUEST_POOL_MAX).toBe(500));
});
