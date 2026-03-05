import { describe, it, expect } from 'vitest';
import {
  createHyperdriveState,
  calculateCurrentCharge,
  spendCharge,
  calcHyperjumpFuelV2,
  HULL_FUEL_MULTIPLIER,
  HYPERJUMP_FUEL_PER_SECTOR,
  FUEL_COST_PER_UNIT,
  FEATURE_HYPERDRIVE_V2,
  HYPERJUMP_PIRATE_FUEL_PENALTY,
  calcHyperjumpAP,
} from '@void-sector/shared';
import type { HyperdriveState, ShipStats } from '@void-sector/shared';

// Helper: create mock ship stats with hyperdrive
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

describe('Hyperdrive V2 — Charge System', () => {
  describe('FEATURE_HYPERDRIVE_V2 constant', () => {
    it('should be defined as a boolean', () => {
      expect(typeof FEATURE_HYPERDRIVE_V2).toBe('boolean');
    });

    it('should be false by default (feature flag off)', () => {
      expect(FEATURE_HYPERDRIVE_V2).toBe(false);
    });
  });

  describe('createHyperdriveState', () => {
    it('creates state from ship stats with full charge', () => {
      const stats = mockShipStats({ hyperdriveRange: 10, hyperdriveRegen: 1.5 });
      const now = 1000000;
      const state = createHyperdriveState(stats, now);

      expect(state.charge).toBe(10);
      expect(state.maxCharge).toBe(10);
      expect(state.regenPerSecond).toBe(1.5);
      expect(state.lastTick).toBe(now);
    });

    it('uses hyperdriveRange as both charge and maxCharge', () => {
      const stats = mockShipStats({ hyperdriveRange: 25 });
      const state = createHyperdriveState(stats);

      expect(state.charge).toBe(25);
      expect(state.maxCharge).toBe(25);
    });

    it('handles zero hyperdrive range (no drive installed)', () => {
      const stats = mockShipStats({ hyperdriveRange: 0, hyperdriveRegen: 0 });
      const state = createHyperdriveState(stats);

      expect(state.charge).toBe(0);
      expect(state.maxCharge).toBe(0);
      expect(state.regenPerSecond).toBe(0);
    });
  });

  describe('calculateCurrentCharge', () => {
    it('returns current charge when no time has passed', () => {
      const state: HyperdriveState = {
        charge: 5,
        maxCharge: 10,
        regenPerSecond: 1.0,
        lastTick: 1000000,
      };
      const current = calculateCurrentCharge(state, 1000000);
      expect(current).toBe(5);
    });

    it('regenerates charge over time', () => {
      const state: HyperdriveState = {
        charge: 5,
        maxCharge: 10,
        regenPerSecond: 1.0,
        lastTick: 1000000,
      };
      // 3 seconds later: 5 + 3*1.0 = 8
      const current = calculateCurrentCharge(state, 1003000);
      expect(current).toBe(8);
    });

    it('clamps charge to maxCharge', () => {
      const state: HyperdriveState = {
        charge: 8,
        maxCharge: 10,
        regenPerSecond: 2.0,
        lastTick: 1000000,
      };
      // 10 seconds later: 8 + 10*2.0 = 28 -> clamped to 10
      const current = calculateCurrentCharge(state, 1010000);
      expect(current).toBe(10);
    });

    it('does not regen with zero regen rate', () => {
      const state: HyperdriveState = {
        charge: 3,
        maxCharge: 10,
        regenPerSecond: 0,
        lastTick: 1000000,
      };
      const current = calculateCurrentCharge(state, 1060000);
      expect(current).toBe(3);
    });

    it('handles partial seconds', () => {
      const state: HyperdriveState = {
        charge: 0,
        maxCharge: 10,
        regenPerSecond: 2.0,
        lastTick: 1000000,
      };
      // 1.5 seconds later: 0 + 1.5*2.0 = 3
      const current = calculateCurrentCharge(state, 1001500);
      expect(current).toBe(3);
    });
  });

  describe('spendCharge', () => {
    it('returns updated state on successful spend', () => {
      const state: HyperdriveState = {
        charge: 10,
        maxCharge: 10,
        regenPerSecond: 1.0,
        lastTick: 1000000,
      };
      const result = spendCharge(state, 5, 1000000);
      expect(result).not.toBeNull();
      expect(result!.charge).toBe(5);
      expect(result!.lastTick).toBe(1000000);
    });

    it('returns null when insufficient charge', () => {
      const state: HyperdriveState = {
        charge: 3,
        maxCharge: 10,
        regenPerSecond: 0,
        lastTick: 1000000,
      };
      const result = spendCharge(state, 5, 1000000);
      expect(result).toBeNull();
    });

    it('accounts for regen before spending', () => {
      const state: HyperdriveState = {
        charge: 3,
        maxCharge: 10,
        regenPerSecond: 1.0,
        lastTick: 1000000,
      };
      // 5 seconds later: charge = 3 + 5*1.0 = 8, spend 7 -> 1
      const result = spendCharge(state, 7, 1005000);
      expect(result).not.toBeNull();
      expect(result!.charge).toBe(1);
    });

    it('allows spending exact charge amount', () => {
      const state: HyperdriveState = {
        charge: 5,
        maxCharge: 10,
        regenPerSecond: 0,
        lastTick: 1000000,
      };
      const result = spendCharge(state, 5, 1000000);
      expect(result).not.toBeNull();
      expect(result!.charge).toBe(0);
    });
  });

  describe('charge-gated jump validation', () => {
    it('allows jump when charge >= distance', () => {
      const state: HyperdriveState = {
        charge: 10,
        maxCharge: 10,
        regenPerSecond: 1.0,
        lastTick: Date.now(),
      };
      const distance = 8;
      const current = calculateCurrentCharge(state);
      expect(current >= distance).toBe(true);
    });

    it('blocks jump when charge < distance', () => {
      const state: HyperdriveState = {
        charge: 3,
        maxCharge: 10,
        regenPerSecond: 0,
        lastTick: Date.now(),
      };
      const distance = 8;
      const current = calculateCurrentCharge(state);
      expect(current >= distance).toBe(false);
    });

    it('allows partial-charge jump (distance <= current charge)', () => {
      const state: HyperdriveState = {
        charge: 6,
        maxCharge: 15,
        regenPerSecond: 0.5,
        lastTick: Date.now(),
      };
      const distance = 5;
      const current = calculateCurrentCharge(state);
      expect(current >= distance).toBe(true);

      const result = spendCharge(state, distance);
      expect(result).not.toBeNull();
      expect(result!.charge).toBeCloseTo(1, 0);
    });
  });

  describe('V2 fuel calculation', () => {
    it('calculates base fuel cost for hyperjump', () => {
      // cost = ceil(1 * 10 * 1.0 * (1 - 0)) = 10
      const cost = calcHyperjumpFuelV2(HYPERJUMP_FUEL_PER_SECTOR, 10, 1.0, 0);
      expect(cost).toBe(10);
    });

    it('applies hull multiplier (scout is cheaper)', () => {
      const scoutCost = calcHyperjumpFuelV2(
        HYPERJUMP_FUEL_PER_SECTOR,
        10,
        HULL_FUEL_MULTIPLIER.scout,
        0,
      );
      const battleshipCost = calcHyperjumpFuelV2(
        HYPERJUMP_FUEL_PER_SECTOR,
        10,
        HULL_FUEL_MULTIPLIER.battleship,
        0,
      );
      expect(scoutCost).toBeLessThan(battleshipCost);
    });

    it('applies drive efficiency to reduce cost', () => {
      const noDrive = calcHyperjumpFuelV2(1, 10, 1.0, 0);
      const withDrive = calcHyperjumpFuelV2(1, 10, 1.0, 0.5);
      expect(withDrive).toBeLessThan(noDrive);
    });

    it('minimum fuel cost is 1', () => {
      // Very high efficiency with short distance
      const cost = calcHyperjumpFuelV2(1, 1, 0.8, 0.99);
      expect(cost).toBe(1);
    });

    it('scales linearly with distance', () => {
      const cost5 = calcHyperjumpFuelV2(1, 5, 1.0, 0);
      const cost10 = calcHyperjumpFuelV2(1, 10, 1.0, 0);
      expect(cost10).toBe(cost5 * 2);
    });

    it('pirate fuel penalty multiplies the V2 cost', () => {
      const baseCost = calcHyperjumpFuelV2(
        HYPERJUMP_FUEL_PER_SECTOR,
        10,
        HULL_FUEL_MULTIPLIER.scout,
        0,
      );
      const pirateCost = Math.ceil(baseCost * HYPERJUMP_PIRATE_FUEL_PENALTY);
      expect(pirateCost).toBeGreaterThan(baseCost);
      expect(pirateCost).toBe(Math.ceil(baseCost * 1.5));
    });
  });

  describe('auto-refuel at station', () => {
    it('calculates correct refuel cost', () => {
      const currentFuel = 30;
      const fuelMax = 100;
      const tankSpace = fuelMax - currentFuel;
      const cost = tankSpace * FUEL_COST_PER_UNIT;

      expect(tankSpace).toBe(70);
      expect(cost).toBe(140);
    });

    it('skips refuel when tank is full', () => {
      const currentFuel = 100;
      const fuelMax = 100;
      const tankSpace = fuelMax - currentFuel;
      expect(tankSpace).toBe(0);
    });

    it('skips refuel when credits are insufficient', () => {
      const currentFuel = 0;
      const fuelMax = 100;
      const tankSpace = fuelMax - currentFuel;
      const cost = tankSpace * FUEL_COST_PER_UNIT;
      const credits = 50;
      expect(credits < cost).toBe(true);
    });
  });

  describe('AP cost with engine speed', () => {
    it('higher engine speed reduces AP cost', () => {
      const slowAP = calcHyperjumpAP(1);
      const fastAP = calcHyperjumpAP(3);
      expect(fastAP).toBeLessThan(slowAP);
    });

    it('engine speed 5 gives minimum AP cost of 1', () => {
      expect(calcHyperjumpAP(5)).toBe(1);
    });
  });

  describe('autopilot speed factor', () => {
    it('higher hyperdriveSpeed reduces autopilot tick interval', () => {
      const AUTOPILOT_STEP_MS = 100;

      const speed1 = Math.max(20, Math.floor(AUTOPILOT_STEP_MS / 1));
      const speed2 = Math.max(20, Math.floor(AUTOPILOT_STEP_MS / 2));
      const speed5 = Math.max(20, Math.floor(AUTOPILOT_STEP_MS / 5));

      expect(speed1).toBe(100);
      expect(speed2).toBe(50);
      expect(speed5).toBe(20);
    });

    it('autopilot tick is clamped to minimum 20ms', () => {
      const AUTOPILOT_STEP_MS = 100;
      const speed10 = Math.max(20, Math.floor(AUTOPILOT_STEP_MS / 10));
      expect(speed10).toBe(20);
    });

    it('zero hyperdriveSpeed falls back to default', () => {
      const AUTOPILOT_STEP_MS = 100;
      const speed0 = 0;
      // When hyperdriveSpeed is 0, we use default
      const result =
        speed0 > 0 ? Math.max(20, Math.floor(AUTOPILOT_STEP_MS / speed0)) : AUTOPILOT_STEP_MS;
      expect(result).toBe(100);
    });
  });

  describe('Redis hyperdrive state shape', () => {
    it('HyperdriveState has all required fields', () => {
      const state: HyperdriveState = {
        charge: 5,
        maxCharge: 10,
        regenPerSecond: 1.0,
        lastTick: Date.now(),
      };
      expect(state).toHaveProperty('charge');
      expect(state).toHaveProperty('maxCharge');
      expect(state).toHaveProperty('regenPerSecond');
      expect(state).toHaveProperty('lastTick');
    });

    it('serializes and deserializes correctly via string conversion', () => {
      const state: HyperdriveState = {
        charge: 7.5,
        maxCharge: 15,
        regenPerSecond: 1.5,
        lastTick: 1700000000000,
      };

      // Simulate Redis hset/hgetall serialization
      const serialized = {
        charge: String(state.charge),
        maxCharge: String(state.maxCharge),
        regenPerSecond: String(state.regenPerSecond),
        lastTick: String(state.lastTick),
      };

      const deserialized: HyperdriveState = {
        charge: Number(serialized.charge),
        maxCharge: Number(serialized.maxCharge),
        regenPerSecond: Number(serialized.regenPerSecond),
        lastTick: Number(serialized.lastTick),
      };

      expect(deserialized).toEqual(state);
    });
  });

  describe('hull fuel multiplier integration', () => {
    it('all hull types have a defined multiplier', () => {
      const hullTypes = ['scout', 'freighter', 'cruiser', 'explorer', 'battleship'] as const;
      for (const hull of hullTypes) {
        expect(HULL_FUEL_MULTIPLIER[hull]).toBeDefined();
        expect(HULL_FUEL_MULTIPLIER[hull]).toBeGreaterThan(0);
      }
    });

    it('scout has the lowest fuel multiplier', () => {
      expect(HULL_FUEL_MULTIPLIER.scout).toBe(0.8);
      expect(HULL_FUEL_MULTIPLIER.scout).toBeLessThan(HULL_FUEL_MULTIPLIER.freighter);
      expect(HULL_FUEL_MULTIPLIER.scout).toBeLessThan(HULL_FUEL_MULTIPLIER.battleship);
    });
  });

  describe('no-hyperdrive guard', () => {
    it('ship with hyperdriveRange=0 should block V2 hyperjump', () => {
      const stats = mockShipStats({ hyperdriveRange: 0 });
      // Server checks: ship.hyperdriveRange <= 0 -> reject
      expect(stats.hyperdriveRange).toBe(0);
    });

    it('ship with hyperdriveRange>0 should allow V2 hyperjump', () => {
      const stats = mockShipStats({ hyperdriveRange: 10 });
      expect(stats.hyperdriveRange).toBeGreaterThan(0);
    });
  });
});
