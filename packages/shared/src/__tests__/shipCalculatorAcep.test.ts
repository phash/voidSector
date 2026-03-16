import { describe, it, expect } from 'vitest';
import { calculateShipStats, getAcepLevel, getExtraSlotCount } from '../shipCalculator.js';
import type { AcepXpSnapshot } from '../types.js';

const noAcep: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };

describe('ACEP level calculation', () => {
  it('level 1 at 0 XP', () => expect(getAcepLevel(0)).toBe(1));
  it('level 2 at 500 XP', () => expect(getAcepLevel(500)).toBe(2));
  it('level 3 at 2500 XP', () => expect(getAcepLevel(2500)).toBe(3));
  it('level 4 at 7500 XP', () => expect(getAcepLevel(7500)).toBe(4));
  it('level 5 at 20000 XP', () => expect(getAcepLevel(20000)).toBe(5));
  it('level 2 at 499 XP (below threshold)', () => expect(getAcepLevel(499)).toBe(1));
});

describe('extra slot count', () => {
  it('0 extra slots at ausbau 0', () => expect(getExtraSlotCount(0)).toBe(0));
  it('1 extra slot at ausbau 500', () => expect(getExtraSlotCount(500)).toBe(1));
  it('2 extra slots at ausbau 2500', () => expect(getExtraSlotCount(2500)).toBe(2));
  it('4 extra slots at ausbau 20000', () => expect(getExtraSlotCount(20000)).toBe(4));
  it('0 extra slots at ausbau 499', () => expect(getExtraSlotCount(499)).toBe(0));
});

describe('calculateShipStats with modules', () => {
  it('base stats with no modules', () => {
    const stats = calculateShipStats([], noAcep);
    expect(stats.cargoCap).toBe(20); // BASE_CARGO
    expect(stats.shieldHp).toBe(0);
    expect(stats.weaponAttack).toBe(0);
  });

  it('drive module sets V2 fields', () => {
    const mods = [{ moduleId: 'ion_drive_mk1', slotIndex: 1, source: 'standard' as const }];
    const stats = calculateShipStats(mods, noAcep);
    expect(stats.jumpDistance).toBe(32);
    expect(stats.fuelCapacity).toBe(2000);
  });

  it('cargo module adds to cargoCap', () => {
    const mods = [{ moduleId: 'cargo_bay_mk1', slotIndex: 7, source: 'standard' as const }];
    const stats = calculateShipStats(mods, noAcep);
    expect(stats.cargoCap).toBe(45); // BASE_CARGO 20 + 25
  });

  it('shield module adds shieldHp and shieldRegen', () => {
    const mods = [{ moduleId: 'schild_gen_mk1', slotIndex: 4, source: 'standard' as const }];
    const stats = calculateShipStats(mods, noAcep);
    expect(stats.shieldHp).toBe(100);
    expect(stats.shieldRegen).toBe(3);
  });

  it('generator module sets apRegen and energyBudget', () => {
    const mods = [{ moduleId: 'fusion_cell_mk1', slotIndex: 0, source: 'standard' as const }];
    const stats = calculateShipStats(mods, noAcep);
    expect(stats.apRegen).toBe(4);
    expect(stats.energyBudget).toBe(100);
  });

  it('without ACEP or with ACEP, basic V2 stats are the same', () => {
    const mods = [{ moduleId: 'ion_drive_mk1', slotIndex: 1, source: 'standard' as const }];
    const s1 = calculateShipStats(mods, noAcep);
    const s2 = calculateShipStats(mods); // no acepXp arg
    expect(s1.jumpDistance).toBe(s2.jumpDistance);
  });
});
