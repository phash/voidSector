import { describe, it, expect } from 'vitest';
import { canStartResearch, isModuleUnlocked, isModuleFreelyAvailable } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';
import type { ResearchState } from '@void-sector/shared';

const emptyResearch: ResearchState = {
  unlockedModules: [],
  blueprints: [],
  activeResearch: null,
};

const fullRes = { credits: 99999, ore: 9999, gas: 9999, crystal: 9999, artefact: 99 };

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
    const result = canStartResearch('drive_mk3', emptyResearch, fullRes);
    expect(result.valid).toBe(false);
  });

  it('can research drive_mk3 after drive_mk2', () => {
    const after: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    const result = canStartResearch('drive_mk3', after, fullRes);
    expect(result.valid).toBe(true);
  });

  it('void_drive requires ancient honored', () => {
    const after: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk3'] };
    const result = canStartResearch('void_drive', after, fullRes, { ancients: 'friendly' });
    expect(result.valid).toBe(false);
  });

  it('all research modules have valid prerequisites', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.prerequisite) {
        expect(MODULES[mod.prerequisite], `${id} has invalid prerequisite ${mod.prerequisite}`).toBeDefined();
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
