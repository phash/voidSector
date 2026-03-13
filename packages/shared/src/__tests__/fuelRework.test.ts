import { describe, it, expect } from 'vitest';
import { calcHyperjumpFuelV2 } from '../jumpCalc.js';
import { SCAN_FUEL_COST, MINE_FUEL_COST } from '../constants.js';

describe('Fuel Rework (#94 / #291)', () => {
  describe('fuel constants', () => {
    it('scan fuel cost is 0', () => {
      expect(SCAN_FUEL_COST).toBe(0);
    });
    it('mine fuel cost is 0', () => {
      expect(MINE_FUEL_COST).toBe(0);
    });
  });

  describe('calcHyperjumpFuelV2 — 3-arg signature', () => {
    it('base case: 100/sector * 10 sectors * no efficiency = 1000', () => {
      expect(calcHyperjumpFuelV2(100, 10, 0)).toBe(1000);
    });
    it('50% drive efficiency halves cost', () => {
      expect(calcHyperjumpFuelV2(100, 10, 0.5)).toBe(500);
    });
    it('100% efficiency clamps to minimum 1', () => {
      expect(calcHyperjumpFuelV2(100, 1, 1.0)).toBe(1);
    });
    it('20% efficiency: 100*5*0.8 = 400', () => {
      expect(calcHyperjumpFuelV2(100, 5, 0.2)).toBe(400);
    });
    it('efficiency clamped to max 1 even if > 1', () => {
      expect(calcHyperjumpFuelV2(100, 10, 1.5)).toBe(1);
    });
    it('efficiency clamped to min 0 even if negative', () => {
      expect(calcHyperjumpFuelV2(100, 5, -0.5)).toBe(500);
    });
    it('distance 1 * base 100 * 0 efficiency = 100', () => {
      expect(calcHyperjumpFuelV2(100, 1, 0)).toBe(100);
    });
  });
});
