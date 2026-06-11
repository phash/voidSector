import { describe, it, expect } from 'vitest';
import { getDynamicPrice, getDynamicSellPrice, BASE_PRICES } from '../dynamicPriceService.js';

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
