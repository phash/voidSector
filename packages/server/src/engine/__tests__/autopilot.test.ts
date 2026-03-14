import { describe, it, expect } from 'vitest';
import type { Coords, ShipStats } from '@void-sector/shared';
import {
  calculateAutopilotPath,
  calculateAutopilotCosts,
  getNextSegment,
  STEP_INTERVAL_MS,
  STEP_INTERVAL_MIN_MS,
} from '../autopilot.js';

// Helper: create mock ship stats
function mockShipStats(overrides: Partial<ShipStats> = {}): ShipStats {
  return {
    fuelMax: 100,
    cargoCap: 10,
    jumpRange: 5,
    apCostJump: 1,
    fuelPerJump: 1,
    hp: 50,
    commRange: 50,
    scannerLevel: 1,
    damageMod: 0,
    shieldHp: 0,
    shieldRegen: 0,
    weaponAttack: 0,
    weaponType: 'laser',
    weaponPiercing: 0,
    pointDefense: 0,
    ecmReduction: 0,
    engineSpeed: 2,
    artefactChanceBonus: 0,
    safeSlotBonus: 0,
    hyperdriveRange: 10,
    hyperdriveSpeed: 2,
    hyperdriveRegen: 1.0,
    hyperdriveFuelEfficiency: 0,
    miningBonus: 0,
    ...overrides,
  };
}

// Helper: no black holes (default open map)
const noBlackHoles = () => false;

describe('Autopilot Engine', () => {
  // --- calculateAutopilotPath ---

  describe('calculateAutopilotPath', () => {
    it('returns empty path when from === to', () => {
      const path = calculateAutopilotPath({ x: 5, y: 5 }, { x: 5, y: 5 }, noBlackHoles);
      expect(path).toEqual([]);
    });

    it('moves along X axis first, then Y axis (Manhattan)', () => {
      const from: Coords = { x: 0, y: 0 };
      const to: Coords = { x: 3, y: 2 };
      const path = calculateAutopilotPath(from, to, noBlackHoles);

      expect(path).toHaveLength(5); // 3 X-steps + 2 Y-steps

      // First 3 steps should move along X
      expect(path[0]).toEqual({ x: 1, y: 0 });
      expect(path[1]).toEqual({ x: 2, y: 0 });
      expect(path[2]).toEqual({ x: 3, y: 0 });

      // Last 2 steps should move along Y
      expect(path[3]).toEqual({ x: 3, y: 1 });
      expect(path[4]).toEqual({ x: 3, y: 2 });
    });

    it('handles negative direction movement', () => {
      const from: Coords = { x: 5, y: 5 };
      const to: Coords = { x: 3, y: 2 };
      const path = calculateAutopilotPath(from, to, noBlackHoles);

      expect(path).toHaveLength(5); // 2 X-steps + 3 Y-steps
      expect(path[0]).toEqual({ x: 4, y: 5 });
      expect(path[1]).toEqual({ x: 3, y: 5 });
      expect(path[2]).toEqual({ x: 3, y: 4 });
      expect(path[3]).toEqual({ x: 3, y: 3 });
      expect(path[4]).toEqual({ x: 3, y: 2 });
    });

    it('handles pure X-axis movement', () => {
      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 4, y: 0 }, noBlackHoles);
      expect(path).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(path[i]).toEqual({ x: i + 1, y: 0 });
      }
    });

    it('handles pure Y-axis movement', () => {
      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 0, y: 3 }, noBlackHoles);
      expect(path).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(path[i]).toEqual({ x: 0, y: i + 1 });
      }
    });

    it('each step in the path is exactly 1 sector from the previous', () => {
      const from: Coords = { x: -5, y: 10 };
      const to: Coords = { x: 5, y: -3 };
      const path = calculateAutopilotPath(from, to, noBlackHoles);

      let prev = from;
      for (const step of path) {
        const dist = Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y);
        expect(dist).toBe(1);
        prev = step;
      }
      // Last step should be the destination
      expect(path[path.length - 1]).toEqual(to);
    });

    it('path length equals Manhattan distance', () => {
      const from: Coords = { x: -3, y: 7 };
      const to: Coords = { x: 10, y: -5 };
      const path = calculateAutopilotPath(from, to, noBlackHoles);
      const manhattan = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      expect(path.length).toBe(manhattan);
    });
  });

  // --- Black hole avoidance ---

  describe('black hole avoidance', () => {
    it('detours around a single black hole on the X-axis', () => {
      // Black hole at (2, 0) blocks direct X path from (0,0) to (4,0)
      const blackHoles = new Set(['2,0']);
      const isBlackHole = (x: number, y: number) => blackHoles.has(`${x},${y}`);

      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 4, y: 0 }, isBlackHole);

      // Path must not include the black hole
      for (const step of path) {
        expect(isBlackHole(step.x, step.y)).toBe(false);
      }

      // Path must reach destination
      expect(path[path.length - 1]).toEqual({ x: 4, y: 0 });

      // Path should be longer than Manhattan due to detour
      expect(path.length).toBeGreaterThan(4);
    });

    it('detours around a cluster of black holes', () => {
      // Block a 3x1 wall at y=0, x in [3,4,5]
      const blackHoles = new Set(['3,0', '4,0', '5,0']);
      const isBlackHole = (x: number, y: number) => blackHoles.has(`${x},${y}`);

      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 8, y: 0 }, isBlackHole);

      // No black holes in path
      for (const step of path) {
        expect(isBlackHole(step.x, step.y)).toBe(false);
      }

      // Must reach destination
      expect(path[path.length - 1]).toEqual({ x: 8, y: 0 });
    });

    it('handles black hole on the Y-axis', () => {
      const blackHoles = new Set(['3,2']);
      const isBlackHole = (x: number, y: number) => blackHoles.has(`${x},${y}`);

      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 3, y: 4 }, isBlackHole);

      for (const step of path) {
        expect(isBlackHole(step.x, step.y)).toBe(false);
      }
      expect(path[path.length - 1]).toEqual({ x: 3, y: 4 });
    });

    it('returns partial path when completely blocked', () => {
      // Surround the destination with black holes
      const blackHoles = new Set(['4,0', '4,1', '4,-1', '6,0', '6,1', '6,-1', '5,2', '5,-2']);
      // Also block the destination itself
      blackHoles.add('5,0');

      const isBlackHole = (x: number, y: number) => blackHoles.has(`${x},${y}`);
      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 5, y: 0 }, isBlackHole);

      // Path should not contain any black holes
      for (const step of path) {
        expect(isBlackHole(step.x, step.y)).toBe(false);
      }
    });

    it('all steps in detour path are exactly 1 sector apart', () => {
      const blackHoles = new Set(['2,0', '2,1', '2,-1']);
      const isBlackHole = (x: number, y: number) => blackHoles.has(`${x},${y}`);

      const from: Coords = { x: 0, y: 0 };
      const path = calculateAutopilotPath(from, { x: 5, y: 0 }, isBlackHole);

      let prev = from;
      for (const step of path) {
        const dist = Math.abs(step.x - prev.x) + Math.abs(step.y - prev.y);
        expect(dist).toBe(1);
        prev = step;
      }
    });
  });

  // --- calculateAutopilotCosts ---

  describe('calculateAutopilotCosts', () => {
    it('returns zero costs for empty path', () => {
      const costs = calculateAutopilotCosts([], mockShipStats(), false);
      expect(costs).toEqual({ totalFuel: 0, totalAP: 0, estimatedTime: 0 });
    });

    it('calculates normal mode costs (no fuel, AP per step)', () => {
      const path: Coords[] = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ];
      const stats = mockShipStats({ apCostJump: 1 });
      const costs = calculateAutopilotCosts(path, stats, false);

      expect(costs.totalFuel).toBe(0);
      expect(costs.totalAP).toBe(5); // 5 steps * 1 AP each
      expect(costs.estimatedTime).toBe(5 * STEP_INTERVAL_MS);
    });

    it('higher apCostJump increases normal mode AP cost', () => {
      const path: Coords[] = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ];
      const stats = mockShipStats({ apCostJump: 2 });
      const costs = calculateAutopilotCosts(path, stats, false);

      expect(costs.totalAP).toBe(4); // 2 steps * 2 AP
    });

    it('calculates hyperjump mode costs (fuel + AP)', () => {
      const path: Coords[] = Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 0 }));
      const stats = mockShipStats({ engineSpeed: 2, hyperdriveFuelEfficiency: 0 });
      const costs = calculateAutopilotCosts(path, stats, true);

      // Fuel should be > 0
      expect(costs.totalFuel).toBeGreaterThan(0);
      // AP should be > 0
      expect(costs.totalAP).toBeGreaterThan(0);
      // Time should reflect batching
      expect(costs.estimatedTime).toBeGreaterThan(0);
    });

    it('higher engine speed reduces number of batches', () => {
      const path: Coords[] = Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 0 }));
      const slowStats = mockShipStats({ engineSpeed: 1 });
      const fastStats = mockShipStats({ engineSpeed: 5 });

      const slowCosts = calculateAutopilotCosts(path, slowStats, true);
      const fastCosts = calculateAutopilotCosts(path, fastStats, true);

      // Faster speed = fewer batches = less estimated time
      expect(fastCosts.estimatedTime).toBeLessThanOrEqual(slowCosts.estimatedTime);
    });

    it('fuel efficiency reduces fuel cost', () => {
      const path: Coords[] = Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 0 }));
      const noEfficiency = mockShipStats({ hyperdriveFuelEfficiency: 0 });
      const withEfficiency = mockShipStats({ hyperdriveFuelEfficiency: 0.5 });

      const costNoEff = calculateAutopilotCosts(path, noEfficiency, true);
      const costWithEff = calculateAutopilotCosts(path, withEfficiency, true);

      expect(costWithEff.totalFuel).toBeLessThan(costNoEff.totalFuel);
    });
  });

  // --- getNextSegment ---

  describe('getNextSegment', () => {
    const path: Coords[] = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ];

    it('returns empty moves when at end of path', () => {
      const segment = getNextSegment(path, 5, 10, 2);
      expect(segment.moves).toEqual([]);
      expect(segment.isHyperjump).toBe(false);
    });

    it('returns single move in normal mode (no charge)', () => {
      const segment = getNextSegment(path, 0, 0, 0);
      expect(segment.moves).toEqual([{ x: 1, y: 0 }]);
      expect(segment.isHyperjump).toBe(false);
    });

    it('returns single move when charge is 0', () => {
      const segment = getNextSegment(path, 2, 0, 3);
      expect(segment.moves).toEqual([{ x: 3, y: 0 }]);
      expect(segment.isHyperjump).toBe(false);
    });

    it('returns batch of moves in hyperjump mode', () => {
      const segment = getNextSegment(path, 0, 10, 3);
      expect(segment.moves).toEqual([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]);
      expect(segment.isHyperjump).toBe(true);
    });

    it('batch size is limited by speed', () => {
      const segment = getNextSegment(path, 0, 10, 2);
      expect(segment.moves).toHaveLength(2);
      expect(segment.isHyperjump).toBe(true);
    });

    it('batch size is limited by remaining path', () => {
      const segment = getNextSegment(path, 4, 10, 5);
      expect(segment.moves).toHaveLength(1); // only 1 step left
      expect(segment.isHyperjump).toBe(true);
    });

    it('batch size is limited by hyperdrive charge', () => {
      const segment = getNextSegment(path, 0, 2, 5);
      expect(segment.moves).toHaveLength(2); // charge only for 2
      expect(segment.isHyperjump).toBe(true);
    });

    it('advances from correct step position', () => {
      const segment = getNextSegment(path, 2, 10, 2);
      expect(segment.moves).toEqual([
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ]);
    });
  });

  // --- Incremental deduction pattern ---

  describe('incremental deduction pattern', () => {
    it('demonstrates fuel deduction per segment (not upfront)', () => {
      const path: Coords[] = Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 0 }));
      const speed = 3;
      let fuel = 100;
      let step = 0;
      const fuelPerSector = 1;
      const segments: number[] = [];

      while (step < path.length && fuel > 0) {
        const seg = getNextSegment(path, step, fuel, speed);
        if (seg.moves.length === 0) break;

        // Deduct fuel for this segment
        const fuelCost = seg.moves.length * fuelPerSector;
        fuel -= fuelCost;
        step += seg.moves.length;
        segments.push(seg.moves.length);
      }

      // All 10 steps should be covered across segments
      expect(step).toBe(10);
      expect(segments.reduce((a, b) => a + b, 0)).toBe(10);
      expect(fuel).toBe(90); // 100 - 10
    });

    it('pauses on fuel exhaustion (mid-route)', () => {
      const path: Coords[] = Array.from({ length: 20 }, (_, i) => ({ x: i + 1, y: 0 }));
      const speed = 5;
      let fuel = 7; // only enough for 7 sectors
      let step = 0;
      const fuelPerSector = 1;

      while (step < path.length && fuel > 0) {
        const seg = getNextSegment(path, step, fuel, speed);
        if (seg.moves.length === 0) break;

        const fuelCost = seg.moves.length * fuelPerSector;
        if (fuelCost > fuel) {
          // Can't afford this batch — pause
          break;
        }
        fuel -= fuelCost;
        step += seg.moves.length;
      }

      // Should have moved exactly 7 sectors (5 + 2)
      expect(step).toBe(7);
      expect(fuel).toBe(0);
    });

    it('pauses on AP exhaustion', () => {
      const path: Coords[] = Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 0 }));
      let ap = 3;
      let step = 0;
      const apPerStep = 1;

      while (step < path.length && ap >= apPerStep) {
        const seg = getNextSegment(path, step, 0, 0); // normal mode
        if (seg.moves.length === 0) break;

        ap -= apPerStep;
        step += seg.moves.length;
      }

      expect(step).toBe(3);
      expect(ap).toBe(0);
    });
  });

  // --- Pause / Resume / Cancel ---

  describe('pause, resume, and cancel', () => {
    it('can resume from a saved step position', () => {
      const path: Coords[] = Array.from({ length: 10 }, (_, i) => ({ x: i + 1, y: 0 }));
      const savedStep = 5;

      // Resume: get next segment from savedStep
      const segment = getNextSegment(path, savedStep, 10, 3);
      expect(segment.moves[0]).toEqual({ x: 6, y: 0 });
      expect(segment.isHyperjump).toBe(true);
    });

    it('segment from final step returns empty moves (route complete)', () => {
      const path: Coords[] = [{ x: 1, y: 0 }];
      const segment = getNextSegment(path, 1, 10, 3);
      expect(segment.moves).toEqual([]);
    });

    it('cancel is idempotent: requesting moves after path exhaustion returns nothing', () => {
      const path: Coords[] = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ];

      // Complete the path
      const seg1 = getNextSegment(path, 0, 10, 5);
      expect(seg1.moves).toHaveLength(2);

      // Try to get more
      const seg2 = getNextSegment(path, 2, 10, 5);
      expect(seg2.moves).toEqual([]);
    });
  });

  // --- Constants ---

  describe('constants', () => {
    it('STEP_INTERVAL_MS is 800ms', () => {
      expect(STEP_INTERVAL_MS).toBe(800);
    });

    it('STEP_INTERVAL_MIN_MS is 100ms', () => {
      expect(STEP_INTERVAL_MIN_MS).toBe(100);
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('handles large distance without black holes', () => {
      const from: Coords = { x: 0, y: 0 };
      const to: Coords = { x: 100, y: 50 };
      const path = calculateAutopilotPath(from, to, noBlackHoles);

      expect(path).toHaveLength(150); // 100 + 50
      expect(path[path.length - 1]).toEqual(to);
    });

    it('handles single-step movement', () => {
      const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 1, y: 0 }, noBlackHoles);
      expect(path).toHaveLength(1);
      expect(path[0]).toEqual({ x: 1, y: 0 });
    });

    it('getNextSegment with fractional charge floors batch size', () => {
      const path: Coords[] = Array.from({ length: 5 }, (_, i) => ({ x: i + 1, y: 0 }));
      const segment = getNextSegment(path, 0, 2.7, 5);
      // floor(2.7) = 2
      expect(segment.moves).toHaveLength(2);
    });
  });
});
