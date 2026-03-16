import { describe, it, expect } from 'vitest';
import { isModuleUnlocked, isModuleFreelyAvailable } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';

describe('research flow integration', () => {
  it('non-foundOnly modules are freely available (all tiers)', () => {
    const driveMk1 = MODULES['ion_drive_mk1'];
    const driveMk2 = MODULES['ion_drive_mk2'];
    const voidDrive = MODULES['void_drive'];
    // All non-foundOnly modules are freely available in the new system
    expect(isModuleUnlocked('ion_drive_mk1', driveMk1, {}, [])).toBe(true);
    expect(isModuleUnlocked('ion_drive_mk2', driveMk2, {}, [])).toBe(true);
    // foundOnly modules require blueprint + tech tree tier
    expect(isModuleUnlocked('void_drive', voidDrive, {}, [])).toBe(false);
  });

  it('tech tree branch unlock satisfies tier for foundOnly modules', () => {
    const riftDrive = MODULES['rift_drive'];
    // rift_drive is foundOnly, tier 5 — tech tree alone can unlock via tier
    expect(isModuleUnlocked('rift_drive', riftDrive, { explorer: 4 }, [])).toBe(true);
    // But without sufficient tier, it stays locked
    expect(isModuleUnlocked('rift_drive', riftDrive, { explorer: 2 }, [])).toBe(false);
  });

  it('blueprint alone does NOT unlock foundOnly module without tech tree tier', () => {
    const riftDrive = MODULES['rift_drive'];
    // rift_drive is foundOnly, tier 5, category drive → branch explorer
    // Blueprint without required tier → NOT unlocked
    expect(isModuleUnlocked('rift_drive', riftDrive, {}, ['rift_drive'])).toBe(false);
  });

  it('blueprint + required tech tree tier unlocks foundOnly module', () => {
    const riftDrive = MODULES['rift_drive'];
    // rift_drive is foundOnly, tier 5, category drive → branch explorer
    // explorer branch level 4 → unlockedTiers.explorer = 5; blueprint provides the recipe
    expect(isModuleUnlocked('rift_drive', riftDrive, { explorer: 4 }, ['rift_drive'])).toBe(true);
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
