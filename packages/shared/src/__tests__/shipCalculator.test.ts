import { describe, it, expect } from 'vitest';
import { calculateShipStats, validateModuleInstall } from '../shipCalculator';
import { getPhysicalCargoTotal } from '../constants';

describe('calculateShipStats', () => {
  it('returns hull base stats with no modules', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.fuelMax).toBe(80);
    expect(stats.cargoCap).toBe(3);
    expect(stats.jumpRange).toBe(5);
    expect(stats.apCostJump).toBe(1);
    expect(stats.hp).toBe(50);
    expect(stats.damageMod).toBe(1.0);
  });

  it('adds module bonuses', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'drive_mk2', slotIndex: 0 },
      { moduleId: 'cargo_mk1', slotIndex: 1 },
    ]);
    expect(stats.jumpRange).toBe(7); // 5 + 2
    expect(stats.cargoCap).toBe(8); // 3 + 5
    expect(stats.apCostJump).toBe(0.8); // 1 - 0.2
  });

  it('clamps AP cost to minimum 0.5', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk3', slotIndex: 0 }]);
    expect(stats.apCostJump).toBe(0.5); // 1 - 0.5 = 0.5
  });

  it('stacks armor damage reduction', () => {
    const stats = calculateShipStats('cruiser', [{ moduleId: 'armor_mk3', slotIndex: 0 }]);
    expect(stats.hp).toBe(200); // 100 + 100
    expect(stats.damageMod).toBe(0.75); // 1.0 + (-0.25)
  });

  it('ignores unknown modules', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'nonexistent', slotIndex: 0 }]);
    expect(stats.fuelMax).toBe(80); // unchanged
  });

  it('works with all hull types', () => {
    const stats = calculateShipStats('battleship', []);
    expect(stats.fuelMax).toBe(180);
    expect(stats.hp).toBe(150);
    expect(stats.cargoCap).toBe(5);
  });

  it('should include fuelPerJump in calculated stats', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.fuelPerJump).toBe(1);
  });

  it('should have higher fuelPerJump for heavy hulls', () => {
    const freighterStats = calculateShipStats('freighter', []);
    const scoutStats = calculateShipStats('scout', []);
    expect(freighterStats.fuelPerJump).toBeGreaterThan(scoutStats.fuelPerJump);
  });

  it('returns zero combat stats with no modules', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.shieldHp).toBe(0);
    expect(stats.shieldRegen).toBe(0);
    expect(stats.weaponAttack).toBe(0);
    expect(stats.weaponType).toBe('none');
    expect(stats.weaponPiercing).toBe(0);
    expect(stats.pointDefense).toBe(0);
    expect(stats.ecmReduction).toBe(0);
  });

  it('adds weapon stats from laser module', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'laser_mk2', slotIndex: 0 }]);
    expect(stats.weaponAttack).toBe(16);
    expect(stats.weaponType).toBe('laser');
  });

  it('adds shield stats from shield module', () => {
    const stats = calculateShipStats('cruiser', [{ moduleId: 'shield_mk1', slotIndex: 0 }]);
    expect(stats.shieldHp).toBe(30);
    expect(stats.shieldRegen).toBe(3);
  });

  it('sets piercing from railgun', () => {
    const stats = calculateShipStats('battleship', [{ moduleId: 'railgun_mk2', slotIndex: 0 }]);
    expect(stats.weaponAttack).toBe(22);
    expect(stats.weaponPiercing).toBe(0.5);
    expect(stats.weaponType).toBe('railgun');
  });

  it('adds point defense and ecm', () => {
    const stats = calculateShipStats('cruiser', [
      { moduleId: 'point_defense', slotIndex: 0 },
      { moduleId: 'ecm_suite', slotIndex: 1 },
    ]);
    expect(stats.pointDefense).toBe(0.6);
    expect(stats.ecmReduction).toBe(0.15);
  });

  it('combines weapon + shield + armor', () => {
    const stats = calculateShipStats('battleship', [
      { moduleId: 'laser_mk3', slotIndex: 0 },
      { moduleId: 'shield_mk2', slotIndex: 1 },
      { moduleId: 'armor_mk2', slotIndex: 2 },
    ]);
    expect(stats.weaponAttack).toBe(28);
    expect(stats.shieldHp).toBe(60);
    expect(stats.hp).toBe(150 + 50); // battleship base + armor
    expect(stats.damageMod).toBe(0.9); // 1.0 + (-0.10)
  });

  it('preserves existing stat behavior', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk1', slotIndex: 0 }]);
    expect(stats.jumpRange).toBe(5 + 1); // scout base (5) + drive_mk1 (+1)
    expect(stats.weaponAttack).toBe(0);
  });

  it('adds artefactChanceBonus from scanner_mk3', () => {
    const stats = calculateShipStats('explorer', [{ moduleId: 'scanner_mk3', slotIndex: 0 }]);
    expect(stats.artefactChanceBonus).toBeCloseTo(0.03);
  });

  it('adds safeSlotBonus from cargo_mk2', () => {
    const stats = calculateShipStats('freighter', [{ moduleId: 'cargo_mk2', slotIndex: 0 }]);
    expect(stats.safeSlotBonus).toBe(1);
  });

  it('stacks safeSlotBonus from multiple cargo modules', () => {
    const stats = calculateShipStats('explorer', [
      { moduleId: 'cargo_mk2', slotIndex: 0 },
      { moduleId: 'cargo_mk3', slotIndex: 1 },
    ]);
    expect(stats.safeSlotBonus).toBe(3); // 1 + 2
  });
});

describe('validateModuleInstall', () => {
  it('rejects wrong category for specialized slot', () => {
    // slot 6 is mining; drive_mk1 is category drive → mismatch
    const result = validateModuleInstall('scout', [], 'drive_mk1', 6);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Specialized Slot');
  });

  it('rejects occupied slot', () => {
    const result = validateModuleInstall(
      'scout',
      [{ moduleId: 'drive_mk1', slotIndex: 1, source: 'standard' }],
      'drive_mk2',
      1,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('belegt');
  });

  it('rejects unknown module', () => {
    const result = validateModuleInstall('scout', [], 'fake_module', 0);
    expect(result.valid).toBe(false);
  });

  it('accepts valid install', () => {
    const result = validateModuleInstall('scout', [], 'drive_mk1', 1);
    expect(result.valid).toBe(true);
  });

  it('accepts cargo module in cargo slot (slot 7)', () => {
    const result = validateModuleInstall(
      'freighter',
      [{ moduleId: 'drive_mk1', slotIndex: 1, source: 'standard' }],
      'cargo_mk1',
      7,
    );
    expect(result.valid).toBe(true);
  });
});

describe('memory stat', () => {
  it('returns BASE_SCANNER_MEMORY with no scanner modules', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.memory).toBe(2);
  });

  it('adds scanner module memory to base', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'scanner_mk1', slotIndex: 0 }]);
    expect(stats.memory).toBe(6); // 2 base + 4
  });

  it('accumulates memory from multiple scanners', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'scanner_mk1', slotIndex: 0 },
      { moduleId: 'quantum_scanner', slotIndex: 1 },
    ]);
    expect(stats.memory).toBe(16); // 2 + 4 + 10
  });

  it('war_scanner adds 0 memory', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'war_scanner', slotIndex: 0 }]);
    expect(stats.memory).toBe(2); // 2 base + 0
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
