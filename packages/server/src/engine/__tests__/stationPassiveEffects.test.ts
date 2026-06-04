import { describe, it, expect } from 'vitest';
import { refineryCreditsPerTick, sensorScanBonus, refineGasToFuel, pirateCombatAvoidable, stationRefuelAmount } from '../stationPassiveEffects.js';

describe('refineryCreditsPerTick', () => {
  it('is zero without a refinery and scales with level', () => {
    expect(refineryCreditsPerTick(0)).toBe(0);
    expect(refineryCreditsPerTick(3)).toBe(6); // 2 * 3
  });
});

describe('sensorScanBonus', () => {
  it('is zero without a sensor and scales with level', () => {
    expect(sensorScanBonus(0)).toBe(0);
    expect(sensorScanBonus(4)).toBe(4); // 1 * 4
  });
});

describe('refineGasToFuel', () => {
  it('is a no-op at refinery level 0', () => {
    const cargo = { gas: 50 };
    expect(refineGasToFuel(cargo, 0)).toEqual({ gas: 50 });
  });
  it('converts level*REFINERY_GAS_PER_TICK gas into fuel', () => {
    const r = refineGasToFuel({ gas: 10 }, 3); // consume 3 gas -> 300 fuel
    expect(r.gas).toBe(7);
    expect(r.fuel).toBe(300);
  });
  it('consumes only as much gas as is available', () => {
    const r = refineGasToFuel({ gas: 2 }, 5); // wants 5, only 2 available
    expect(r.gas).toBe(0);
    expect(r.fuel).toBe(200);
  });
  it('respects the fuel cap and never burns gas beyond what fits', () => {
    const r = refineGasToFuel({ gas: 100, fuel: 19950 }, 5); // room = 50 fuel = ceil(50/100)=1 gas
    expect(r.fuel).toBe(20000);
    expect(r.gas).toBe(99);
  });
  it('does not mutate the input', () => {
    const cargo = { gas: 10 };
    refineGasToFuel(cargo, 1);
    expect(cargo).toEqual({ gas: 10 });
  });
});

describe('pirateCombatAvoidable', () => {
  it('never avoidable at sensor level 0', () => {
    expect(pirateCombatAvoidable(0, 0)).toBe(false);
  });
  it('scales with level and is deterministic given the roll', () => {
    expect(pirateCombatAvoidable(3, 0.4)).toBe(true);  // chance 0.45
    expect(pirateCombatAvoidable(3, 0.5)).toBe(false);
  });
  it('caps at SENSOR_PIRATE_REDUCTION_MAX (0.9)', () => {
    expect(pirateCombatAvoidable(10, 0.89)).toBe(true);
    expect(pirateCombatAvoidable(10, 0.95)).toBe(false);
  });
});

describe('stationRefuelAmount', () => {
  it('is the min of tank space and station fuel', () => {
    expect(stationRefuelAmount(100, 40)).toBe(40);
    expect(stationRefuelAmount(30, 40)).toBe(30);
    expect(stationRefuelAmount(0, 40)).toBe(0);
  });
});
