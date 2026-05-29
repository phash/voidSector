import { describe, it, expect } from 'vitest';
import { getAcepLevelForXp, getAcepAutoXpThreshold, ACEP_PATH_CAP } from '../constants.js';

describe('getAcepLevelForXp', () => {
  it('is 0 below the level-1 threshold', () => {
    expect(getAcepLevelForXp(0)).toBe(0);
    expect(getAcepLevelForXp(9)).toBe(0);
  });

  it('reaches level 1 at threshold 10 and level 2 at 30', () => {
    expect(getAcepLevelForXp(10)).toBe(1);
    expect(getAcepLevelForXp(29)).toBe(1);
    expect(getAcepLevelForXp(30)).toBe(2);
  });

  it('a single +50 scan lands at level 2, not maxed', () => {
    expect(getAcepLevelForXp(50)).toBe(2);
  });

  it('caps at ACEP_PATH_CAP', () => {
    expect(getAcepLevelForXp(getAcepAutoXpThreshold(ACEP_PATH_CAP))).toBe(ACEP_PATH_CAP);
    expect(getAcepLevelForXp(9_999_999)).toBe(ACEP_PATH_CAP);
  });

  it('is the inverse of getAcepAutoXpThreshold at every level boundary', () => {
    for (let l = 0; l <= ACEP_PATH_CAP; l++) {
      expect(getAcepLevelForXp(getAcepAutoXpThreshold(l))).toBe(l);
    }
  });
});
