import { describe, it, expect } from 'vitest';
import {
  HYPERJUMP_AP_DISCOUNT,
  AUTOPILOT_STEP_MS,
  STALENESS_DIM_HOURS,
  STALENESS_FADE_DAYS,
  SHIP_CLASSES,
} from '@void-sector/shared';

describe('Hyperjump Navigation', () => {
  const scout = SHIP_CLASSES.aegis_scout_mk1;
  const seeker = SHIP_CLASSES.void_seeker_mk2;

  describe('cost calculations', () => {
    it('calculates AP cost with discount for scout', () => {
      const distance = 10;
      const apCost = Math.ceil(distance * scout.apCostJump * HYPERJUMP_AP_DISCOUNT);
      expect(apCost).toBe(5);
    });

    it('calculates AP cost with discount for seeker', () => {
      const distance = 7;
      const apCost = Math.ceil(distance * seeker.apCostJump * HYPERJUMP_AP_DISCOUNT);
      expect(apCost).toBe(7);
    });

    it('applies ceil to non-integer AP costs', () => {
      const distance = 3;
      // 3 * 1 * 0.5 = 1.5 -> ceil = 2
      const apCost = Math.ceil(distance * scout.apCostJump * HYPERJUMP_AP_DISCOUNT);
      expect(apCost).toBe(2);
    });

    it('calculates fuel cost for scout', () => {
      const distance = 10;
      const fuelCost = distance * scout.fuelPerJump;
      expect(fuelCost).toBe(50);
    });

    it('calculates fuel cost for seeker', () => {
      const distance = 10;
      const fuelCost = distance * seeker.fuelPerJump;
      expect(fuelCost).toBe(30);
    });
  });

  describe('route generation (Manhattan X-first)', () => {
    // Mirrors the route-building logic in SectorRoom.handleHyperJump
    function generateRoute(fromX: number, fromY: number, toX: number, toY: number) {
      const steps: { x: number; y: number }[] = [];
      let cx = fromX;
      let cy = fromY;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
      const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      for (let i = 0; i < Math.abs(dx); i++) {
        cx += stepX;
        steps.push({ x: cx, y: cy });
      }
      for (let i = 0; i < Math.abs(dy); i++) {
        cy += stepY;
        steps.push({ x: cx, y: cy });
      }
      return steps;
    }

    it('generates Manhattan path X-first then Y', () => {
      const steps = generateRoute(0, 0, 3, 2);
      expect(steps).toEqual([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ]);
    });

    it('handles negative directions', () => {
      const steps = generateRoute(0, 0, -2, 1);
      expect(steps).toEqual([
        { x: -1, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: 1 },
      ]);
    });

    it('handles same-axis movement (Y only)', () => {
      const steps = generateRoute(5, 5, 5, 8);
      expect(steps).toEqual([
        { x: 5, y: 6 },
        { x: 5, y: 7 },
        { x: 5, y: 8 },
      ]);
    });

    it('handles same-axis movement (X only)', () => {
      const steps = generateRoute(2, 3, 5, 3);
      expect(steps).toEqual([
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 3 },
      ]);
    });

    it('returns empty array for zero distance', () => {
      const steps = generateRoute(4, 4, 4, 4);
      expect(steps).toEqual([]);
    });

    it('total steps equals Manhattan distance', () => {
      const steps = generateRoute(0, 0, 3, 2);
      expect(steps.length).toBe(5); // |3| + |2|
    });

    it('starts from non-origin positions correctly', () => {
      const steps = generateRoute(10, 20, 12, 18);
      expect(steps[0]).toEqual({ x: 11, y: 20 });
      expect(steps[steps.length - 1]).toEqual({ x: 12, y: 18 });
      expect(steps.length).toBe(4); // |2| + |-2|
    });
  });

  describe('constants', () => {
    it('has correct AP discount of 50%', () => {
      expect(HYPERJUMP_AP_DISCOUNT).toBe(0.5);
    });

    it('has correct autopilot step interval', () => {
      expect(AUTOPILOT_STEP_MS).toBe(100);
    });

    it('has correct staleness dim threshold (hours)', () => {
      expect(STALENESS_DIM_HOURS).toBe(24);
    });

    it('has correct staleness fade threshold (days)', () => {
      expect(STALENESS_FADE_DAYS).toBe(7);
    });
  });
});
