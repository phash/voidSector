import { describe, it, expect } from 'vitest';
import { getBoostCost, BOOST_COST_TIERS } from '../acepXpService.js';

describe('getBoostCost', () => {
  it('returns tier 0 cost at 0 XP (100 Cr, 3 W)', () => {
    expect(getBoostCost(0)).toEqual({ credits: 100, wissen: 3 });
  });
  it('returns tier 0 cost at 19 XP', () => {
    expect(getBoostCost(19)).toEqual({ credits: 100, wissen: 3 });
  });
  it('returns tier 1 cost at 20 XP (300 Cr, 8 W)', () => {
    expect(getBoostCost(20)).toEqual({ credits: 300, wissen: 8 });
  });
  it('returns tier 1 cost at 39 XP', () => {
    expect(getBoostCost(39)).toEqual({ credits: 300, wissen: 8 });
  });
  it('returns tier 2 cost at 40 XP (600 Cr, 15 W)', () => {
    expect(getBoostCost(40)).toEqual({ credits: 600, wissen: 15 });
  });
  it('returns null at cap (50 XP)', () => {
    expect(getBoostCost(50)).toBeNull();
  });
  it('returns null above cap', () => {
    expect(getBoostCost(55)).toBeNull();
  });
});
