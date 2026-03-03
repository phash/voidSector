import { describe, it, expect } from 'vitest';
import { calculateShipStats, validateModuleInstall } from '../shipCalculator';

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
    expect(stats.jumpRange).toBe(7);  // 5 + 2
    expect(stats.cargoCap).toBe(8);   // 3 + 5
    expect(stats.apCostJump).toBe(0.8); // 1 - 0.2
  });

  it('clamps AP cost to minimum 0.5', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'drive_mk3', slotIndex: 0 },
    ]);
    expect(stats.apCostJump).toBe(0.5);  // 1 - 0.5 = 0.5
  });

  it('stacks armor damage reduction', () => {
    const stats = calculateShipStats('cruiser', [
      { moduleId: 'armor_mk3', slotIndex: 0 },
    ]);
    expect(stats.hp).toBe(200);         // 100 + 100
    expect(stats.damageMod).toBe(0.75); // 1.0 + (-0.25)
  });

  it('ignores unknown modules', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'nonexistent', slotIndex: 0 },
    ]);
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
});

describe('validateModuleInstall', () => {
  it('rejects slot index beyond hull capacity', () => {
    const result = validateModuleInstall('scout', [], 'drive_mk1', 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid slot');
  });

  it('rejects occupied slot', () => {
    const result = validateModuleInstall('scout', [{ moduleId: 'drive_mk1', slotIndex: 0 }], 'cargo_mk1', 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('occupied');
  });

  it('rejects unknown module', () => {
    const result = validateModuleInstall('scout', [], 'fake_module', 0);
    expect(result.valid).toBe(false);
  });

  it('accepts valid install', () => {
    const result = validateModuleInstall('scout', [], 'drive_mk1', 0);
    expect(result.valid).toBe(true);
  });

  it('accepts install in different slot', () => {
    const result = validateModuleInstall('freighter', [{ moduleId: 'drive_mk1', slotIndex: 0 }], 'cargo_mk1', 1);
    expect(result.valid).toBe(true);
  });
});
