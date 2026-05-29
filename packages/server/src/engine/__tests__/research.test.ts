import { describe, it, expect } from 'vitest';
import { isModuleUnlocked } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';

describe('research flow integration', () => {
  it('non-foundOnly tier-1 modules are unlocked with empty categoryTiers (default tier 1)', () => {
    // ion_drive_mk1 is tier 1, non-foundOnly → unlocked when categoryTiers defaults to 1
    expect(isModuleUnlocked('ion_drive_mk1', {}, [])).toBe(true);
    // puls_laser_mk1 is tier 1, non-foundOnly → unlocked
    expect(isModuleUnlocked('puls_laser_mk1', {}, [])).toBe(true);
  });

  it('non-foundOnly tier-2 modules are locked when category tier is 1 (default)', () => {
    // ion_drive_mk2 is tier 2 → locked without category tier unlock
    expect(isModuleUnlocked('ion_drive_mk2', {}, [])).toBe(false);
    expect(isModuleUnlocked('ion_drive_mk2', { drive: 1 }, [])).toBe(false);
    expect(isModuleUnlocked('ion_drive_mk2', { drive: 2 }, [])).toBe(true);
  });

  it('foundOnly modules are gated by blueprint (isFoundOnly flag)', () => {
    // void_drive is foundOnly → only unlocked via blueprint (isFoundOnly uses blueprints path)
    expect(isModuleUnlocked('void_drive', {}, [])).toBe(false);
    expect(isModuleUnlocked('void_drive', {}, ['void_drive'])).toBe(true);
  });

  it('tech tree category tier unlocks higher tiers for non-foundOnly modules', () => {
    // puls_laser_mk2 is tier 2, weapon_energy category
    expect(isModuleUnlocked('puls_laser_mk2', { weapon_energy: 1 }, [])).toBe(false);
    expect(isModuleUnlocked('puls_laser_mk2', { weapon_energy: 2 }, [])).toBe(true);
  });

  it('blueprint alone unlocks foundOnly module (isFoundOnly check only)', () => {
    // void_drive is foundOnly → blueprint is sufficient
    expect(isModuleUnlocked('void_drive', {}, ['void_drive'])).toBe(true);
  });

  it('all research modules have valid prerequisites', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.prerequisite) {
        expect(
          MODULES[mod.prerequisite],
          `${id} has invalid prerequisite ${mod.prerequisite}`,
        ).toBeDefined();
      }
    }
  });

  it('all research modules have positive duration', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.researchCost) {
        expect(mod.researchDurationMin, `${id} missing researchDurationMin`).toBeGreaterThan(0);
      }
    }
  });
});
