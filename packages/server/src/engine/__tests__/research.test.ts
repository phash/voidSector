import { describe, it, expect } from 'vitest';
import { canStartResearch, isModuleUnlocked, isModuleFreelyAvailable } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';
import type { ResearchState } from '@void-sector/shared';

const emptyResearch: ResearchState = {
  unlockedModules: [],
  blueprints: [],
  wissen: 0,
};

// Plenty of every artefact category
const fullArtefacts: Partial<Record<string, number>> = {
  drive: 99,
  cargo: 99,
  scanner: 99,
  armor: 99,
  weapon: 99,
  shield: 99,
  defense: 99,
  special: 99,
  mining: 99,
};

describe('research flow integration', () => {
  it('new player can only buy tier 1 modules', () => {
    expect(isModuleUnlocked('drive_mk1', emptyResearch)).toBe(true);
    expect(isModuleUnlocked('drive_mk2', emptyResearch)).toBe(false);
    expect(isModuleUnlocked('void_drive', emptyResearch)).toBe(false);
  });

  it('researching drive_mk2 unlocks it', () => {
    const after: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    expect(isModuleUnlocked('drive_mk2', after)).toBe(true);
  });

  it('blueprint unlocks module without research', () => {
    const after: ResearchState = { ...emptyResearch, blueprints: ['scanner_mk3'] };
    expect(isModuleUnlocked('scanner_mk3', after)).toBe(true);
  });

  it('cannot research drive_mk3 without drive_mk2', () => {
    // drive_mk3: T3, needs 800 wissen, prereq drive_mk2
    const rs: ResearchState = { ...emptyResearch, wissen: 99999 };
    const result = canStartResearch('drive_mk3', rs, fullArtefacts);
    expect(result.valid).toBe(false);
  });

  it('can research drive_mk3 after drive_mk2', () => {
    // drive_mk3: T3, needs 800 wissen
    const after: ResearchState = {
      ...emptyResearch,
      unlockedModules: ['drive_mk2'],
      wissen: 99999,
    };
    const result = canStartResearch('drive_mk3', after, fullArtefacts);
    expect(result.valid).toBe(true);
  });

  it('void_drive requires ancient honored', () => {
    // void_drive: T3, needs 800 wissen, prereq drive_mk3, ancients: honored
    const after: ResearchState = {
      ...emptyResearch,
      unlockedModules: ['drive_mk3'],
      wissen: 99999,
    };
    const result = canStartResearch('void_drive', after, fullArtefacts, undefined, undefined, {
      ancients: 'friendly',
    });
    expect(result.valid).toBe(false);
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
