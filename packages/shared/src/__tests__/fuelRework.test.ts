import { describe, it, expect } from 'vitest';
import { calcHyperjumpFuelV2 } from '../jumpCalc.js';
import {
  HYPERJUMP_FUEL_PER_SECTOR,
  HULL_FUEL_MULTIPLIER,
  SCAN_FUEL_COST,
  MINE_FUEL_COST,
  FEATURE_EMERGENCY_WARP,
  HULLS,
} from '../constants.js';
import type { AutoRefuelConfig, HullType } from '../types.js';

describe('Fuel Rework (#94)', () => {
  // --- Constants ---
  describe('fuel constants', () => {
    it('should define HYPERJUMP_FUEL_PER_SECTOR = 1', () => {
      expect(HYPERJUMP_FUEL_PER_SECTOR).toBe(1);
    });

    it('should set scan fuel cost to 0', () => {
      expect(SCAN_FUEL_COST).toBe(0);
    });

    it('should set mine fuel cost to 0', () => {
      expect(MINE_FUEL_COST).toBe(0);
    });

    it('should disable emergency warp via feature flag', () => {
      expect(FEATURE_EMERGENCY_WARP).toBe(false);
    });

    it('should define hull fuel multipliers for all hull types', () => {
      const hullTypes: HullType[] = ['scout', 'freighter', 'cruiser', 'explorer', 'battleship'];
      for (const hull of hullTypes) {
        expect(HULL_FUEL_MULTIPLIER[hull]).toBeGreaterThan(0);
      }
    });

    it('should have scout as lightest hull multiplier', () => {
      expect(HULL_FUEL_MULTIPLIER.scout).toBeLessThan(HULL_FUEL_MULTIPLIER.cruiser);
    });

    it('should have battleship as heaviest hull multiplier', () => {
      expect(HULL_FUEL_MULTIPLIER.battleship).toBeGreaterThan(HULL_FUEL_MULTIPLIER.cruiser);
    });
  });

  // --- V2 Fuel Formula ---
  describe('calcHyperjumpFuelV2', () => {
    it('should calculate base cost: 1 * 10 * 1.0 * (1 - 0) = 10', () => {
      const cost = calcHyperjumpFuelV2(1, 10, 1.0, 0);
      expect(cost).toBe(10);
    });

    it('should scale with distance', () => {
      const cost5 = calcHyperjumpFuelV2(1, 5, 1.0, 0);
      const cost10 = calcHyperjumpFuelV2(1, 10, 1.0, 0);
      expect(cost10).toBe(cost5 * 2);
    });

    it('should apply hull multiplier', () => {
      const scout = calcHyperjumpFuelV2(1, 10, HULL_FUEL_MULTIPLIER.scout, 0);
      const battleship = calcHyperjumpFuelV2(1, 10, HULL_FUEL_MULTIPLIER.battleship, 0);
      expect(battleship).toBeGreaterThan(scout);
    });

    it('should reduce cost with drive efficiency', () => {
      const noEff = calcHyperjumpFuelV2(1, 10, 1.0, 0);
      const halfEff = calcHyperjumpFuelV2(1, 10, 1.0, 0.5);
      expect(halfEff).toBeLessThan(noEff);
      expect(halfEff).toBe(5);
    });

    it('should return at least 1 fuel', () => {
      const cost = calcHyperjumpFuelV2(1, 1, 0.8, 0.99);
      expect(cost).toBeGreaterThanOrEqual(1);
    });

    it('should clamp drive efficiency to [0, 1]', () => {
      const over = calcHyperjumpFuelV2(1, 10, 1.0, 1.5);
      const atOne = calcHyperjumpFuelV2(1, 10, 1.0, 1.0);
      // efficiency > 1 is clamped to 1, so cost = ceil(1*10*1.0*0) = 0 -> min 1
      expect(over).toBe(atOne);

      const under = calcHyperjumpFuelV2(1, 10, 1.0, -0.5);
      const atZero = calcHyperjumpFuelV2(1, 10, 1.0, 0);
      // efficiency < 0 is clamped to 0
      expect(under).toBe(atZero);
    });

    it('should ceil fractional results', () => {
      // 1 * 3 * 0.8 * 1.0 = 2.4 -> ceil = 3
      const cost = calcHyperjumpFuelV2(1, 3, 0.8, 0);
      expect(cost).toBe(3);
    });

    it('should use all hull multipliers correctly', () => {
      const distance = 10;
      const hullTypes: HullType[] = ['scout', 'freighter', 'cruiser', 'explorer', 'battleship'];
      const costs = hullTypes.map((h) =>
        calcHyperjumpFuelV2(HYPERJUMP_FUEL_PER_SECTOR, distance, HULL_FUEL_MULTIPLIER[h], 0),
      );
      // scout (0.8) < explorer (0.9) < cruiser (1.0) < freighter (1.2) < battleship (1.5)
      expect(costs[0]).toBeLessThan(costs[2]); // scout < cruiser
      expect(costs[4]).toBeGreaterThan(costs[2]); // battleship > cruiser
    });

    it('should handle high efficiency reducing cost significantly', () => {
      // 1 * 20 * 1.0 * (1 - 0.9) = 2
      const cost = calcHyperjumpFuelV2(1, 20, 1.0, 0.9);
      expect(cost).toBe(2);
    });
  });

  // --- AutoRefuelConfig type ---
  describe('AutoRefuelConfig', () => {
    it('should type-check correctly', () => {
      const config: AutoRefuelConfig = { enabled: true, maxPricePerUnit: 5 };
      expect(config.enabled).toBe(true);
      expect(config.maxPricePerUnit).toBe(5);
    });

    it('should allow disabled config', () => {
      const config: AutoRefuelConfig = { enabled: false, maxPricePerUnit: 10 };
      expect(config.enabled).toBe(false);
    });
  });
});
