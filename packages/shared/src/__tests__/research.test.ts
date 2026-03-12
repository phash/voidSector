import { describe, it, expect } from 'vitest';
import { isModuleFreelyAvailable, isModuleUnlocked, canStartResearch } from '../research';
import { MODULES } from '../constants';
import { ARTEFACT_TYPES, ARTEFACT_TYPE_FOR_CATEGORY } from '../types';
import type { ResearchState } from '../types';

function emptyResearch(): ResearchState {
  return {
    unlockedModules: [],
    blueprints: [],
    wissen: 0,
  };
}

/** Artefacts with plenty of every type */
const PLENTY_ARTEFACTS: Partial<Record<string, number>> = {
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
    // drive_mk2: tier 2, requires 300 wissen
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 300 };
    const result = canStartResearch('drive_mk2', rs, {});
    expect(result.valid).toBe(true);
  });

  it('rejects when prerequisite not met', () => {
    // drive_mk3 requires drive_mk2 which is NOT freely available
    const rs: ResearchState = { ...emptyResearch(), wissen: 99999 };
    const result = canStartResearch('drive_mk3', rs, PLENTY_ARTEFACTS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Prerequisite');
  });

  it('rejects when already unlocked', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2'],
      wissen: 99999,
    };
    const result = canStartResearch('drive_mk2', rs, {});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Already unlocked');
  });

  it('rejects freely available modules', () => {
    const result = canStartResearch('drive_mk1', emptyResearch(), {});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not require research');
  });

  it('rejects when faction requirement not met', () => {
    // void_drive: tier 3, requires ancients honored, prereq drive_mk3
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
      wissen: 99999,
    };
    const result = canStartResearch('void_drive', rs, PLENTY_ARTEFACTS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction requirement');
  });

  it('rejects when faction tier too low', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
      wissen: 99999,
    };
    const result = canStartResearch('void_drive', rs, PLENTY_ARTEFACTS, undefined, undefined, {
      ancients: 'friendly',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction requirement');
  });

  it('allows when faction requirement met', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
      wissen: 99999,
    };
    const result = canStartResearch('void_drive', rs, PLENTY_ARTEFACTS, undefined, undefined, {
      ancients: 'honored',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects when not enough wissen', () => {
    // drive_mk2 costs 300 wissen
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 100 };
    const result = canStartResearch('drive_mk2', rs, {});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Wissen');
  });

  it('rejects unknown module', () => {
    const result = canStartResearch('nonexistent', emptyResearch(), {});
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
  it('has exactly 11 types', () => {
    expect(ARTEFACT_TYPES).toHaveLength(11);
  });
  it('includes drive and mining', () => {
    expect(ARTEFACT_TYPES).toContain('drive');
    expect(ARTEFACT_TYPES).toContain('mining');
  });
  it('ARTEFACT_TYPE_FOR_CATEGORY maps all 11 categories', () => {
    expect(Object.keys(ARTEFACT_TYPE_FOR_CATEGORY)).toHaveLength(11);
    expect(ARTEFACT_TYPE_FOR_CATEGORY['drive']).toBe('drive');
    expect(ARTEFACT_TYPE_FOR_CATEGORY['mining']).toBe('mining');
  });
});

describe('MODULES researchCost (new format)', () => {
  it('all researchCost values use wissen (not credits)', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!mod.researchCost) continue;
      expect((mod.researchCost as any).credits, `${id} should not have credits`).toBeUndefined();
      expect(mod.researchCost.wissen, `${id} should have wissen`).toBeGreaterThan(0);
    }
  });

  it('T3+ modules require matching artefacts', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!mod.researchCost || mod.tier < 3) continue;
      const total = Object.values(mod.researchCost.artefacts ?? {}).reduce((s, v) => s + v, 0);
      expect(total, `${id} T${mod.tier} needs artefacts`).toBeGreaterThan(0);
    }
  });

  it('T5 modules require 3 artefacts', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!mod.researchCost || mod.tier !== 5) continue;
      const total = Object.values(mod.researchCost.artefacts ?? {}).reduce((s, v) => s + v, 0);
      expect(total, `${id} T5 should require 3 artefacts`).toBe(3);
    }
  });
});
