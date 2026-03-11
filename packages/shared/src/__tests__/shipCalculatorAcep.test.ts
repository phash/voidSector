import { describe, it, expect } from 'vitest';
import { calculateShipStats, getAcepLevel, getExtraSlotCount } from '../shipCalculator.js';
import { HULLS } from '../constants.js';
import type { AcepXpSnapshot } from '../types.js';

const noAcep: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };

describe('ACEP level calculation', () => {
  it('level 1 at 0 XP', () => expect(getAcepLevel(0)).toBe(1));
  it('level 2 at 8 XP', () => expect(getAcepLevel(8)).toBe(2));
  it('level 3 at 18 XP', () => expect(getAcepLevel(18)).toBe(3));
  it('level 4 at 32 XP', () => expect(getAcepLevel(32)).toBe(4));
  it('level 5 at 50 XP', () => expect(getAcepLevel(50)).toBe(5));
  it('level 4 at 31 XP (below threshold)', () => expect(getAcepLevel(31)).toBe(3));
});

describe('extra slot count', () => {
  it('0 extra slots at ausbau 0', () => expect(getExtraSlotCount(0)).toBe(0));
  it('1 extra slot at ausbau 10', () => expect(getExtraSlotCount(10)).toBe(1));
  it('2 extra slots at ausbau 25', () => expect(getExtraSlotCount(25)).toBe(2));
  it('4 extra slots at ausbau 50', () => expect(getExtraSlotCount(50)).toBe(4));
  it('1 extra slot at ausbau 24', () => expect(getExtraSlotCount(24)).toBe(1));
});

describe('calculateShipStats with ACEP multiplier', () => {
  it('no ACEP XP = base stats unchanged', () => {
    const mods = [{ moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' as const }];
    const stats = calculateShipStats('scout', mods, noAcep);
    // laser_mk1 effect.weaponAttack = 8, multiplier = 1.0
    const baseWeaponAttack = stats.weaponAttack;
    expect(baseWeaponAttack).toBeGreaterThan(0);
  });

  it('kampf level 5 multiplies weapon attack by 1.5', () => {
    const mods = [{ moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' as const }];
    const base = calculateShipStats('scout', mods, noAcep);
    const boosted = calculateShipStats('scout', mods, { ...noAcep, kampf: 50 });
    // laser_mk1 weaponAttack +8, at KAMPF level 5 = 8 * 1.5 = 12
    expect(boosted.weaponAttack).toBeGreaterThan(base.weaponAttack);
    expect(boosted.weaponAttack - base.weaponAttack).toBeCloseTo(4, 0); // 8*1.5 - 8 = 4
  });

  it('ausbau level 3 multiplies cargo by 1.2', () => {
    const mods = [{ moduleId: 'cargo_mk1', slotIndex: 6, source: 'standard' as const }];
    const base = calculateShipStats('scout', mods, noAcep);
    const boosted = calculateShipStats('scout', mods, { ...noAcep, ausbau: 18 });
    expect(boosted.cargoCap).toBeGreaterThan(base.cargoCap);
  });

  it('negative effects (drawbacks) are NOT multiplied', () => {
    // salvage_skin has cargoCap: -5 (drawback) and hp: 80 (bonus)
    const mods = [{ moduleId: 'salvage_skin', slotIndex: 2, source: 'found' as const }];
    const base = calculateShipStats('scout', mods, noAcep);
    const boosted = calculateShipStats('scout', mods, { ...noAcep, kampf: 50 });
    // cargoCap -5 should NOT be multiplied → stays -5 regardless of level
    const scoutBaseCargo = HULLS['scout'].baseCargo;
    const baseCargoLoss = base.cargoCap - scoutBaseCargo;
    const boostedCargoLoss = boosted.cargoCap - scoutBaseCargo;
    expect(baseCargoLoss).toBeCloseTo(boostedCargoLoss, 0);
  });

  it('weapons without ACEP have multiplier 1.0', () => {
    const mods = [{ moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' as const }];
    const s1 = calculateShipStats('scout', mods, noAcep);
    const s2 = calculateShipStats('scout', mods); // no acepXp arg
    expect(s1.weaponAttack).toBe(s2.weaponAttack);
  });
});
