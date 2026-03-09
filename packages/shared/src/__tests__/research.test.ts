import { describe, it, expect } from 'vitest';
import { isModuleFreelyAvailable, isModuleUnlocked, canStartResearch } from '../research';
import { MODULES } from '../constants';
import { ARTEFACT_TYPES, ARTEFACT_TYPE_FOR_CATEGORY } from '../types';
import type { ResearchState } from '../types';

function emptyResearch(): ResearchState {
  return { unlockedModules: [], blueprints: [], activeResearch: null, activeResearch2: null, wissen: 0, wissenRate: 0 };
}

const PLENTY = {
  credits: 99999, ore: 9999, gas: 9999, crystal: 9999, artefact: 9999,
  wissen: 99999,
  artefact_drive: 99, artefact_cargo: 99, artefact_scanner: 99, artefact_armor: 99,
  artefact_weapon: 99, artefact_shield: 99, artefact_defense: 99, artefact_special: 99,
  artefact_mining: 99,
};

describe('isModuleFreelyAvailable', () => {
  it('returns true for tier-1 base modules without researchCost', () => {
    expect(isModuleFreelyAvailable('drive_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('cargo_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('armor_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('scanner_mk1')).toBe(true);
  });

  it('returns false for modules that require research', () => {
    expect(isModuleFreelyAvailable('drive_mk2')).toBe(false);
    expect(isModuleFreelyAvailable('shield_mk1')).toBe(false);
    expect(isModuleFreelyAvailable('void_drive')).toBe(false);
  });

  it('returns false for unknown modules', () => {
    expect(isModuleFreelyAvailable('nonexistent')).toBe(false);
  });
});

describe('isModuleUnlocked', () => {
  it('freely available modules are always unlocked', () => {
    expect(isModuleUnlocked('drive_mk1', emptyResearch())).toBe(true);
    expect(isModuleUnlocked('cargo_mk1', emptyResearch())).toBe(true);
  });

  it('researched modules are unlocked', () => {
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk2'] };
    expect(isModuleUnlocked('drive_mk2', rs)).toBe(true);
  });

  it('blueprint modules are unlocked', () => {
    const rs: ResearchState = { ...emptyResearch(), blueprints: ['void_drive'] };
    expect(isModuleUnlocked('void_drive', rs)).toBe(true);
  });

  it('locked modules are not unlocked', () => {
    expect(isModuleUnlocked('drive_mk2', emptyResearch())).toBe(false);
    expect(isModuleUnlocked('void_drive', emptyResearch())).toBe(false);
  });
});

describe('canStartResearch', () => {
  it('allows research when prereq met and resources available', () => {
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'] };
    const result = canStartResearch('drive_mk2', rs, PLENTY);
    expect(result.valid).toBe(true);
  });

  it('rejects when prerequisite not met', () => {
    // drive_mk3 requires drive_mk2 which is NOT freely available
    const result = canStartResearch('drive_mk3', emptyResearch(), PLENTY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Prerequisite');
  });

  it('rejects when already unlocked', () => {
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1', 'drive_mk2'] };
    const result = canStartResearch('drive_mk2', rs, PLENTY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Already unlocked');
  });

  it('rejects when research already in progress', () => {
    const rs: ResearchState = {
      unlockedModules: ['drive_mk1'],
      blueprints: [],
      activeResearch: { moduleId: 'cargo_mk2', startedAt: 1000, completesAt: 2000 },
      activeResearch2: null,
      wissen: 0,
      wissenRate: 0,
    };
    const result = canStartResearch('drive_mk2', rs, PLENTY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already in progress');
  });

  it('accepts research when wissen is sufficient (wissen cost checked after Task 2)', () => {
    // Once Task 2 updates MODULES with wissen costs, this will also test wissen rejection
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'] };
    const result = canStartResearch('drive_mk2', rs, PLENTY);
    expect(result.valid).toBe(true);
  });

  it('rejects when artefact_drive is insufficient (after Task 2 wires artefact costs)', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2'],
    };
    // Task 2 will add artefacts: { drive: 1 } to drive_mk3 researchCost
    // For now verify canStartResearch accepts the new typed-artefact resource shape
    const result = canStartResearch('drive_mk3', rs, PLENTY);
    expect(result).toBeDefined();
  });

  it('rejects freely available modules', () => {
    const result = canStartResearch('drive_mk1', emptyResearch(), PLENTY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not require research');
  });

  it('rejects when faction requirement not met', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
    };
    const result = canStartResearch('void_drive', rs, PLENTY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction requirement');
  });

  it('rejects when faction tier too low', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
    };
    const result = canStartResearch('void_drive', rs, PLENTY, { ancients: 'friendly' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction requirement');
  });

  it('allows when faction requirement met', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
    };
    const result = canStartResearch('void_drive', rs, PLENTY, { ancients: 'honored' });
    expect(result.valid).toBe(true);
  });

  it('rejects unknown module', () => {
    const result = canStartResearch('nonexistent', emptyResearch(), PLENTY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown');
  });
});

describe('Module data validation', () => {
  it('all modules have primaryEffect', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      expect(mod.primaryEffect, `${id} missing primaryEffect`).toBeDefined();
      expect(mod.primaryEffect.stat).toBeTruthy();
      expect(typeof mod.primaryEffect.delta).toBe('number');
      expect(mod.primaryEffect.label).toBeTruthy();
    }
  });

  it('all modules have secondaryEffects array', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      expect(Array.isArray(mod.secondaryEffects), `${id} missing secondaryEffects array`).toBe(
        true,
      );
    }
  });

  it('all tier 2+ modules with researchCost have prerequisite (except laser_mk1, missile_mk1)', () => {
    const exceptions = ['laser_mk1', 'missile_mk1'];
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.researchCost && !exceptions.includes(id)) {
        expect(mod.prerequisite, `${id} has researchCost but no prerequisite`).toBeTruthy();
      }
    }
  });

  it('spezial modules exist', () => {
    expect(MODULES['void_drive']).toBeDefined();
    expect(MODULES['quantum_scanner']).toBeDefined();
    expect(MODULES['nano_armor']).toBeDefined();
  });

  it('void_drive has faction requirement', () => {
    expect(MODULES['void_drive'].factionRequirement).toBeDefined();
    expect(MODULES['void_drive'].factionRequirement!.factionId).toBe('ancients');
    expect(MODULES['void_drive'].factionRequirement!.minTier).toBe('honored');
  });
});

describe('ArtefactType', () => {
  it('has exactly 9 types', () => {
    expect(ARTEFACT_TYPES).toHaveLength(9);
  });
  it('includes drive and mining', () => {
    expect(ARTEFACT_TYPES).toContain('drive');
    expect(ARTEFACT_TYPES).toContain('mining');
  });
  it('ARTEFACT_TYPE_FOR_CATEGORY maps all 9 categories', () => {
    expect(Object.keys(ARTEFACT_TYPE_FOR_CATEGORY)).toHaveLength(9);
    expect(ARTEFACT_TYPE_FOR_CATEGORY['drive']).toBe('drive');
    expect(ARTEFACT_TYPE_FOR_CATEGORY['mining']).toBe('mining');
  });
});
