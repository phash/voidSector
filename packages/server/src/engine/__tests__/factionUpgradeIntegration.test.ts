import { describe, it, expect } from 'vitest';
import { calculateBonuses } from '../factionBonuses.js';
import { MINING_RATE_PER_SECOND } from '@void-sector/shared';

describe('Faction Bonus Application', () => {
  it('should increase mining rate with tier 1A', () => {
    const bonuses = calculateBonuses([{ tier: 1, choice: 'A' }]);
    const boostedRate = MINING_RATE_PER_SECOND * bonuses.miningRateMultiplier;
    expect(boostedRate).toBeCloseTo(1.15);
  });

  it('should add cargo capacity with tier 1B', () => {
    const bonuses = calculateBonuses([{ tier: 1, choice: 'B' }]);
    const baseCargo = 5;
    expect(baseCargo + bonuses.cargoCapBonus).toBe(8);
  });

  it('should reduce NPC trade prices with tier 3B', () => {
    const bonuses = calculateBonuses([
      { tier: 1, choice: 'A' },
      { tier: 2, choice: 'A' },
      { tier: 3, choice: 'B' },
    ]);
    const basePrice = 100;
    const discounted = basePrice * bonuses.tradePriceMultiplier;
    expect(discounted).toBe(90);
  });

  it('should increase AP regen with tier 2B', () => {
    const bonuses = calculateBonuses([
      { tier: 1, choice: 'A' },
      { tier: 2, choice: 'B' },
    ]);
    expect(bonuses.apRegenMultiplier).toBe(1.2);
  });

  it('should stack all bonuses from full A path', () => {
    const bonuses = calculateBonuses([
      { tier: 1, choice: 'A' },
      { tier: 2, choice: 'A' },
      { tier: 3, choice: 'A' },
    ]);
    expect(bonuses.miningRateMultiplier).toBe(1.15);
    expect(bonuses.scanRadiusBonus).toBe(1);
    expect(bonuses.combatMultiplier).toBe(1.15);
    expect(bonuses.cargoCapBonus).toBe(0);
    expect(bonuses.apRegenMultiplier).toBe(1);
    expect(bonuses.tradePriceMultiplier).toBe(1);
  });
});
