import { describe, it, expect } from 'vitest';
import {
  getFactionEnvironmentWeight,
  getPreferredEnvironment,
  getEligibleFactions,
  getFactionSpawnModifier,
} from '../sectorTypeAwarenessService.js';
import { getDynamicPrice, getDynamicSellPrice, BASE_PRICES } from '../dynamicPriceService.js';

describe('sectorTypeAwarenessService', () => {
  it('traders prefer empty sectors', () => {
    const emptyWeight = getFactionEnvironmentWeight('traders', 'empty');
    const nebulaWeight = getFactionEnvironmentWeight('traders', 'nebula');
    expect(emptyWeight).toBeGreaterThan(nebulaWeight);
  });

  it('scientists prefer planet and nebula', () => {
    const planetWeight = getFactionEnvironmentWeight('scientists', 'planet');
    const emptyWeight = getFactionEnvironmentWeight('scientists', 'empty');
    expect(planetWeight).toBeGreaterThan(emptyWeight);
  });

  it('pirates prefer black_hole sectors', () => {
    const blackHoleWeight = getFactionEnvironmentWeight('pirates', 'black_hole');
    const planetWeight = getFactionEnvironmentWeight('pirates', 'planet');
    expect(blackHoleWeight).toBeGreaterThan(planetWeight);
  });

  it('ancients prefer nebula', () => {
    const preferred = getPreferredEnvironment('ancients');
    expect(preferred).toBe('nebula');
  });

  it('pirates preferred environment is black_hole', () => {
    expect(getPreferredEnvironment('pirates')).toBe('black_hole');
  });

  it('traders preferred environment is empty', () => {
    expect(getPreferredEnvironment('traders')).toBe('empty');
  });

  it('impassable environments (star/black_hole) have zero weight for non-pirate factions', () => {
    expect(getFactionEnvironmentWeight('traders', 'star')).toBe(0);
    expect(getFactionEnvironmentWeight('scientists', 'black_hole')).toBe(0);
    expect(getFactionEnvironmentWeight('ancients', 'star')).toBe(0);
  });

  it('getEligibleFactions for nebula returns scientists and ancients', () => {
    const eligible = getEligibleFactions('nebula');
    expect(eligible).toContain('scientists');
    expect(eligible).toContain('ancients');
  });

  it('getEligibleFactions for black_hole returns only pirates', () => {
    const eligible = getEligibleFactions('black_hole');
    expect(eligible).toContain('pirates');
    expect(eligible).not.toContain('traders');
    expect(eligible).not.toContain('scientists');
  });

  it('spawn modifier is 0 for factions not in that environment', () => {
    expect(getFactionSpawnModifier('traders', 'star')).toBe(0);
    expect(getFactionSpawnModifier('ancients', 'empty')).toBe(0);
  });

  it('spawn modifier is positive for preferred environments', () => {
    expect(getFactionSpawnModifier('ancients', 'nebula')).toBeGreaterThan(1);
    expect(getFactionSpawnModifier('pirates', 'black_hole')).toBeGreaterThan(1);
  });
});

describe('dynamicPriceService', () => {
  it('buy price at origin is base price', () => {
    const price = getDynamicPrice('ore', 0, 0, 'empty', 0);
    // At distance 0, distanceFactor = 1.0, no nebula, no rep modifier
    expect(price).toBe(BASE_PRICES.ore);
  });

  it('prices increase with distance from origin', () => {
    const near = getDynamicPrice('ore', 100, 100, 'empty', 0);
    const far = getDynamicPrice('ore', 8000, 8000, 'empty', 0);
    expect(far).toBeGreaterThan(near);
  });

  it('nebula prices are higher than empty at same distance', () => {
    const empty = getDynamicPrice('crystal', 500, 500, 'empty', 0);
    const nebula = getDynamicPrice('crystal', 500, 500, 'nebula', 0);
    expect(nebula).toBeGreaterThan(empty);
  });

  it('honored reputation gives lower price (positive rep = cheaper)', () => {
    const neutral = getDynamicPrice('gas', 200, 200, 'empty', 0);
    const honored = getDynamicPrice('gas', 200, 200, 'empty', 1.0); // max rep
    expect(honored).toBeLessThan(neutral);
  });

  it('hostile reputation gives higher price', () => {
    const neutral = getDynamicPrice('gas', 200, 200, 'empty', 0);
    const hostile = getDynamicPrice('gas', 200, 200, 'empty', -1.0);
    expect(hostile).toBeGreaterThan(neutral);
  });

  it('sell price is always less than buy price', () => {
    const resources: Array<'ore' | 'gas' | 'crystal' | 'exotic'> = [
      'ore',
      'gas',
      'crystal',
      'exotic',
    ];
    for (const r of resources) {
      const buy = getDynamicPrice(r, 500, 500, 'empty', 0);
      const sell = getDynamicSellPrice(r, 500, 500, 'empty', 0);
      expect(sell).toBeLessThan(buy);
    }
  });

  it('exotic has the highest base price', () => {
    expect(BASE_PRICES.exotic).toBeGreaterThan(BASE_PRICES.ore);
    expect(BASE_PRICES.exotic).toBeGreaterThan(BASE_PRICES.gas);
    expect(BASE_PRICES.exotic).toBeGreaterThan(BASE_PRICES.crystal);
  });
});
