import { describe, it, expect } from 'vitest';
import { calculateShipStats, validateModuleInstall } from '../shipCalculator';
import { getPhysicalCargoTotal } from '../constants';

describe('calculateShipStats', () => {
  it('returns base stats with no modules', () => {
    const stats = calculateShipStats([]);
    expect(stats.fuelMax).toBe(10_000);
    expect(stats.cargoCap).toBe(20); // BASE_CARGO = 20
    expect(stats.jumpRange).toBe(5);
    expect(stats.apCostJump).toBe(1);
    expect(stats.hp).toBe(100);
    expect(stats.damageMod).toBe(1.0);
  });

  it('adds drive module V2 stats', () => {
    const stats = calculateShipStats([
      { moduleId: 'ion_drive_mk2', slotIndex: 0 },
    ]);
    expect(stats.jumpDistance).toBe(48);
    expect(stats.fuelCapacity).toBe(4000);
    expect(stats.rechargeRate).toBe(6);
  });

  it('adds cargo module capacity', () => {
    const stats = calculateShipStats([
      { moduleId: 'cargo_bay_mk1', slotIndex: 0 },
    ]);
    expect(stats.cargoCap).toBe(45); // 20 + 25
  });

  it('adds armor hitpoints', () => {
    const stats = calculateShipStats([{ moduleId: 'armor_plating_mk3', slotIndex: 0 }]);
    expect(stats.armorHp).toBe(400); // armor_plating_mk3 hitpoints = 400
  });

  it('ignores unknown modules', () => {
    const stats = calculateShipStats([{ moduleId: 'nonexistent', slotIndex: 0 }]);
    expect(stats.fuelMax).toBe(10_000); // unchanged
  });

  it('works with no modules', () => {
    const stats = calculateShipStats([]);
    expect(stats.fuelMax).toBe(10_000);
    expect(stats.hp).toBe(100);
    expect(stats.cargoCap).toBe(20); // BASE_CARGO = 20
  });

  it('should include fuelPerJump in calculated stats', () => {
    const stats = calculateShipStats([]);
    expect(stats.fuelPerJump).toBe(100);
  });

  it('returns zero combat stats with no modules', () => {
    const stats = calculateShipStats([]);
    expect(stats.shieldHp).toBe(0);
    expect(stats.shieldRegen).toBe(0);
    expect(stats.weaponAttack).toBe(0);
    expect(stats.weaponType).toBe('none');
    expect(stats.weaponPiercing).toBe(0);
    expect(stats.pointDefense).toBe(0);
    expect(stats.ecmReduction).toBe(0);
  });

  it('adds shield stats from shield module', () => {
    const stats = calculateShipStats([{ moduleId: 'schild_gen_mk1', slotIndex: 0 }]);
    expect(stats.shieldHp).toBe(100);
    expect(stats.shieldRegen).toBe(3);
  });

  it('adds shield stats from schild_gen_mk2', () => {
    const stats = calculateShipStats([{ moduleId: 'schild_gen_mk2', slotIndex: 0 }]);
    expect(stats.shieldHp).toBe(200);
    expect(stats.shieldRegen).toBe(6);
  });

  it('adds generator stats (apRegen and energyBudget)', () => {
    const stats = calculateShipStats([{ moduleId: 'fusion_cell_mk1', slotIndex: 0 }]);
    expect(stats.apRegen).toBe(4);
    expect(stats.energyBudget).toBe(100);
  });

  it('adds mining speed from mining module', () => {
    const stats = calculateShipStats([{ moduleId: 'mining_laser_mk1', slotIndex: 0 }]);
    expect(stats.miningSpeed).toBe(1);
  });

  it('stacks mining speed from multiple mining modules', () => {
    const stats = calculateShipStats([
      { moduleId: 'mining_laser_mk1', slotIndex: 0 },
      { moduleId: 'mining_laser_mk2', slotIndex: 1 },
    ]);
    expect(stats.miningSpeed).toBe(5); // 1 + 4
  });

  it('combines shield + armor', () => {
    const stats = calculateShipStats([
      { moduleId: 'schild_gen_mk2', slotIndex: 0 },
      { moduleId: 'armor_plating_mk1', slotIndex: 1 },
    ]);
    expect(stats.shieldHp).toBe(200);
    expect(stats.armorHp).toBe(200);
  });

  it('preserves drive V2 stats', () => {
    const stats = calculateShipStats([{ moduleId: 'ion_drive_mk1', slotIndex: 0 }]);
    expect(stats.jumpDistance).toBe(32);
    expect(stats.fuelCapacity).toBe(2000);
  });

  it('scanner sets scanRange', () => {
    const stats = calculateShipStats([{ moduleId: 'scanner_mk1', slotIndex: 0 }]);
    expect(stats.scanRange).toBe(3);
  });
});

describe('validateModuleInstall', () => {
  it('rejects wrong category for specialized slot', () => {
    // slot 6 is mining; ion_drive_mk1 is category drive → mismatch
    const result = validateModuleInstall([], 'ion_drive_mk1', 6);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Specialized Slot');
  });

  it('rejects occupied slot', () => {
    const result = validateModuleInstall(
      [{ moduleId: 'ion_drive_mk1', slotIndex: 1, source: 'standard' }],
      'ion_drive_mk2',
      1,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('belegt');
  });

  it('rejects unknown module', () => {
    const result = validateModuleInstall([], 'fake_module', 0);
    expect(result.valid).toBe(false);
  });

  it('accepts valid install', () => {
    const result = validateModuleInstall([], 'ion_drive_mk1', 1);
    expect(result.valid).toBe(true);
  });

  it('accepts cargo module in cargo slot (slot 7)', () => {
    const result = validateModuleInstall(
      [{ moduleId: 'ion_drive_mk1', slotIndex: 1, source: 'standard' }],
      'cargo_bay_mk1',
      7,
    );
    expect(result.valid).toBe(true);
  });
});

describe('memory stat', () => {
  it('returns BASE_SCANNER_MEMORY with no scanner modules', () => {
    const stats = calculateShipStats([]);
    expect(stats.memory).toBe(10); // BASE_SCANNER_MEMORY = 10
  });
});

describe('getPhysicalCargoTotal', () => {
  it('sums ore + gas + crystal + artefact, excludes slates', () => {
    const cargo = { ore: 5, gas: 3, crystal: 2, slates: 10, artefact: 1 };
    expect(getPhysicalCargoTotal(cargo)).toBe(11);
  });

  it('returns 0 for empty cargo', () => {
    expect(getPhysicalCargoTotal({ ore: 0, gas: 0, crystal: 0, artefact: 0 })).toBe(0);
  });
});
