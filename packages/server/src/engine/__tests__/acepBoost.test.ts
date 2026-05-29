import { describe, it, expect } from 'vitest';
import { getBoostCost } from '../acepXpService.js';

// getBoostCost is an alias of the shared getAcepBoostCost(currentLevel, totalLevels):
//   nextLevel = currentLevel + 1
//   credits = round(100 * 2^(nextLevel-1) * (1 + totalLevels/10))
//   wissen  = round(5   * 2^(nextLevel-1) * (1 + totalLevels/10))
//   null at/above the level cap (10)
describe('getBoostCost (exponential, level-based)', () => {
  it('level 0 -> 1 with no other levels costs 100 Cr / 5 W', () => {
    expect(getBoostCost(0, 0)).toEqual({ credits: 100, wissen: 5 });
  });

  it('doubles per level', () => {
    expect(getBoostCost(1, 0)).toEqual({ credits: 200, wissen: 10 });
    expect(getBoostCost(2, 0)).toEqual({ credits: 400, wissen: 20 });
  });

  it('scales with total levels across all paths', () => {
    // mult = 1 + totalLevels/10 -> 2x at 10 total levels
    expect(getBoostCost(0, 10)).toEqual({ credits: 200, wissen: 10 });
  });

  it('returns null at and above the cap (level 10)', () => {
    expect(getBoostCost(10, 0)).toBeNull();
    expect(getBoostCost(11, 0)).toBeNull();
  });

  it('last affordable step (9 -> 10) is the most expensive', () => {
    expect(getBoostCost(9, 0)).toEqual({ credits: 51200, wissen: 2560 });
  });
});
