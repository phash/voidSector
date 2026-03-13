import { describe, it, expect } from 'vitest';
import { isModuleUnlocked, isModuleFreelyAvailable } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';

describe('research flow integration', () => {
  it('new player can only buy tier 1 modules (freely available)', () => {
    const driveMk1 = MODULES['drive_mk1'];
    const driveMk2 = MODULES['drive_mk2'];
    const voidDrive = MODULES['void_drive'];
    expect(isModuleUnlocked('drive_mk1', driveMk1, {}, [])).toBe(true);
    expect(isModuleUnlocked('drive_mk2', driveMk2, {}, [])).toBe(false);
    expect(isModuleUnlocked('void_drive', voidDrive, {}, [])).toBe(false);
  });

  it('tech tree branch unlock makes tier 2 available', () => {
    const driveMk2 = MODULES['drive_mk2'];
    // explorer branch level 1 → unlocked tier 2
    expect(isModuleUnlocked('drive_mk2', driveMk2, { explorer: 1 }, [])).toBe(true);
  });

  it('blueprint unlocks module without tech tree', () => {
    const scannerMk3 = MODULES['scanner_mk3'];
    expect(isModuleUnlocked('scanner_mk3', scannerMk3, {}, ['scanner_mk3'])).toBe(true);
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
