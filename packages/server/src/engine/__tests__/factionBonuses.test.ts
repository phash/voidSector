import { describe, it, expect } from 'vitest';
import { calculateBonuses } from '../factionBonuses.js';
import type { FactionUpgradeChoice } from '@void-sector/shared';

describe('Faction Bonuses', () => {
  it('should return default bonuses for no upgrades', () => {
    const b = calculateBonuses([]);
    expect(b.miningRateMultiplier).toBe(1.0);
    expect(b.cargoCapBonus).toBe(0);
    expect(b.scanRadiusBonus).toBe(0);
    expect(b.apRegenMultiplier).toBe(1.0);
    expect(b.combatMultiplier).toBe(1.0);
    expect(b.tradePriceMultiplier).toBe(1.0);
  });

  it('tier 1A: mining boost +15%', () => {
    const b = calculateBonuses([{ tier: 1, choice: 'A' as FactionUpgradeChoice }]);
    expect(b.miningRateMultiplier).toBe(1.15);
    expect(b.cargoCapBonus).toBe(0);
  });

  it('tier 1B: cargo expansion +3', () => {
    const b = calculateBonuses([{ tier: 1, choice: 'B' as FactionUpgradeChoice }]);
    expect(b.cargoCapBonus).toBe(3);
    expect(b.miningRateMultiplier).toBe(1.0);
  });

  it('tier 2A: scan range +1', () => {
    const b = calculateBonuses([
      { tier: 1, choice: 'A' as FactionUpgradeChoice },
      { tier: 2, choice: 'A' as FactionUpgradeChoice },
    ]);
    expect(b.scanRadiusBonus).toBe(1);
  });

  it('tier 2B: AP regen +20%', () => {
    const b = calculateBonuses([
      { tier: 1, choice: 'B' as FactionUpgradeChoice },
      { tier: 2, choice: 'B' as FactionUpgradeChoice },
    ]);
    expect(b.apRegenMultiplier).toBe(1.2);
  });

  it('tier 3A: combat bonus +15%', () => {
    const b = calculateBonuses([
      { tier: 1, choice: 'A' as FactionUpgradeChoice },
      { tier: 2, choice: 'A' as FactionUpgradeChoice },
      { tier: 3, choice: 'A' as FactionUpgradeChoice },
    ]);
    expect(b.combatMultiplier).toBe(1.15);
  });

  it('tier 3B: trade discount -10%', () => {
    const b = calculateBonuses([
      { tier: 1, choice: 'A' as FactionUpgradeChoice },
      { tier: 2, choice: 'B' as FactionUpgradeChoice },
      { tier: 3, choice: 'B' as FactionUpgradeChoice },
    ]);
    expect(b.tradePriceMultiplier).toBe(0.9);
  });

  it('should stack all three tiers', () => {
    const b = calculateBonuses([
      { tier: 1, choice: 'A' as FactionUpgradeChoice },
      { tier: 2, choice: 'B' as FactionUpgradeChoice },
      { tier: 3, choice: 'B' as FactionUpgradeChoice },
    ]);
    expect(b.miningRateMultiplier).toBe(1.15);
    expect(b.apRegenMultiplier).toBe(1.2);
    expect(b.tradePriceMultiplier).toBe(0.9);
  });
});
