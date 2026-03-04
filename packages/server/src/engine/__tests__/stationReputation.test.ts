import { describe, it, expect } from 'vitest';
import {
  getFuelRepPriceModifier,
  FUEL_COST_PER_UNIT,
  STATION_REP_VISIT,
  STATION_REP_TRADE,
  REP_PRICE_MODIFIERS,
} from '@void-sector/shared';
import { getReputationTier } from '../commands.js';

describe('Station Reputation', () => {
  describe('FUEL_REP_PRICE_MODIFIERS', () => {
    it('should return 2.0 for hostile reputation (< -50)', () => {
      expect(getFuelRepPriceModifier(-100)).toBe(2.0);
      expect(getFuelRepPriceModifier(-51)).toBe(2.0);
      expect(getFuelRepPriceModifier(-75)).toBe(2.0);
    });

    it('should return 1.3 for unfriendly reputation (-50 to -11)', () => {
      expect(getFuelRepPriceModifier(-50)).toBe(1.3);
      expect(getFuelRepPriceModifier(-11)).toBe(1.3);
      expect(getFuelRepPriceModifier(-30)).toBe(1.3);
    });

    it('should return 1.0 for neutral reputation (-10 to +25)', () => {
      expect(getFuelRepPriceModifier(-10)).toBe(1.0);
      expect(getFuelRepPriceModifier(0)).toBe(1.0);
      expect(getFuelRepPriceModifier(25)).toBe(1.0);
    });

    it('should return 0.85 for friendly reputation (+26 to +50)', () => {
      expect(getFuelRepPriceModifier(26)).toBe(0.85);
      expect(getFuelRepPriceModifier(50)).toBe(0.85);
      expect(getFuelRepPriceModifier(40)).toBe(0.85);
    });

    it('should return 0.65 for honored reputation (> +50)', () => {
      expect(getFuelRepPriceModifier(51)).toBe(0.65);
      expect(getFuelRepPriceModifier(100)).toBe(0.65);
      expect(getFuelRepPriceModifier(75)).toBe(0.65);
    });
  });

  describe('reputation accumulation', () => {
    it('should define visit reputation gain', () => {
      expect(STATION_REP_VISIT).toBe(1);
    });

    it('should define trade reputation gain', () => {
      expect(STATION_REP_TRADE).toBe(2);
    });

    it('should accumulate rep from visits to reach friendly tier', () => {
      // Need rep > 25 for friendly fuel modifier
      const visitsNeeded = Math.ceil(26 / STATION_REP_VISIT);
      expect(visitsNeeded).toBe(26);
    });

    it('should accumulate rep from trades faster than visits', () => {
      expect(STATION_REP_TRADE).toBeGreaterThan(STATION_REP_VISIT);
    });
  });

  describe('fuel price modifier selection (faction vs station)', () => {
    it('should use the lower modifier when station rep is better', () => {
      // Station rep: honored (0.65), Faction rep: neutral tier (1.0)
      const stationModifier = getFuelRepPriceModifier(60);
      const factionRep = 0;
      const factionTier = getReputationTier(factionRep);
      const factionModifier = REP_PRICE_MODIFIERS[factionTier] ?? 1.0;

      const result = Math.min(factionModifier, stationModifier);
      expect(result).toBe(0.65);
    });

    it('should use the lower modifier when faction rep is better', () => {
      // Station rep: neutral (1.0), Faction rep: honored tier (0.75)
      const stationModifier = getFuelRepPriceModifier(0);
      const factionRep = 60;
      const factionTier = getReputationTier(factionRep);
      const factionModifier = REP_PRICE_MODIFIERS[factionTier] ?? 1.0;

      const result = Math.min(factionModifier, stationModifier);
      expect(result).toBe(0.75);
    });

    it('should apply the fuel modifier to fuel cost correctly', () => {
      const amount = 50;
      const modifier = getFuelRepPriceModifier(60); // honored = 0.65
      const cost = Math.ceil(amount * FUEL_COST_PER_UNIT * modifier);
      expect(cost).toBe(Math.ceil(50 * 2 * 0.65));
      expect(cost).toBe(65);
    });

    it('should make hostile fuel very expensive', () => {
      const amount = 50;
      const modifier = getFuelRepPriceModifier(-80); // hostile = 2.0
      const cost = Math.ceil(amount * FUEL_COST_PER_UNIT * modifier);
      expect(cost).toBe(200);
    });

    it('should apply no change at neutral', () => {
      const amount = 50;
      const modifier = getFuelRepPriceModifier(0); // neutral = 1.0
      const cost = Math.ceil(amount * FUEL_COST_PER_UNIT * modifier);
      expect(cost).toBe(100);
    });
  });

  describe('boundary conditions', () => {
    it('should handle exact boundary at -50 (unfriendly, not hostile)', () => {
      expect(getFuelRepPriceModifier(-50)).toBe(1.3);
    });

    it('should handle exact boundary at -10 (neutral, not unfriendly)', () => {
      expect(getFuelRepPriceModifier(-10)).toBe(1.0);
    });

    it('should handle exact boundary at +25 (neutral, not friendly)', () => {
      expect(getFuelRepPriceModifier(25)).toBe(1.0);
    });

    it('should handle exact boundary at +50 (friendly, not honored)', () => {
      expect(getFuelRepPriceModifier(50)).toBe(0.85);
    });

    it('should handle max reputation (+100)', () => {
      expect(getFuelRepPriceModifier(100)).toBe(0.65);
    });

    it('should handle min reputation (-100)', () => {
      expect(getFuelRepPriceModifier(-100)).toBe(2.0);
    });
  });

  describe('fuel rep modifiers are more granular than faction modifiers', () => {
    it('should have more price tiers than faction REP_PRICE_MODIFIERS', () => {
      // Fuel rep: 5 tiers (hostile/unfriendly/neutral/friendly/honored) with different thresholds
      // Faction rep: also 5 tiers but with different thresholds and values
      // Fuel rep hostile is more punitive (2.0 vs 1.5)
      expect(getFuelRepPriceModifier(-100)).toBeGreaterThan(REP_PRICE_MODIFIERS['hostile']);
    });

    it('should give better honored discount for fuel than faction', () => {
      // Fuel honored: 0.65, Faction honored: 0.75
      expect(getFuelRepPriceModifier(100)).toBeLessThan(REP_PRICE_MODIFIERS['honored']);
    });
  });
});
