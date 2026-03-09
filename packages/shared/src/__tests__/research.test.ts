import { describe, it, expect } from 'vitest';
import { isModuleFreelyAvailable, isModuleUnlocked, canStartResearch } from '../research';
import {
  MODULES,
  WISSEN_COST_BY_TIER,
  ARTEFACT_REQUIRED_BY_TIER,
  MAX_ARTEFACTS_PER_RESEARCH,
  WISSEN_SECTOR_MULTIPLIERS,
} from '../constants';
import { ARTEFACT_TYPES, ARTEFACT_TYPE_FOR_CATEGORY } from '../types';
import type { ResearchState } from '../types';

function emptyResearch(): ResearchState {
  return { unlockedModules: [], blueprints: [], activeResearch: null, activeResearch2: null, wissen: 0, wissenRate: 0 };
}

/** Artefacts with plenty of every type */
const PLENTY_ARTEFACTS: Partial<Record<string, number>> = {
  drive: 99, cargo: 99, scanner: 99, armor: 99,
  weapon: 99, shield: 99, defense: 99, special: 99, mining: 99,
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
    // drive_mk2: tier 2, requires lab 2, 300 wissen, no artefacts
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 300 };
    const result = canStartResearch('drive_mk2', rs, {}, 2);
    expect(result.valid).toBe(true);
  });

  it('rejects when prerequisite not met', () => {
    // drive_mk3 requires drive_mk2 which is NOT freely available
    const rs: ResearchState = { ...emptyResearch(), wissen: 99999 };
    const result = canStartResearch('drive_mk3', rs, PLENTY_ARTEFACTS, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Prerequisite');
  });

  it('rejects when already unlocked', () => {
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1', 'drive_mk2'], wissen: 99999 };
    const result = canStartResearch('drive_mk2', rs, {}, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Already unlocked');
  });

  it('rejects when research slot 1 already busy', () => {
    const rs: ResearchState = {
      unlockedModules: ['drive_mk1'],
      blueprints: [],
      activeResearch: { moduleId: 'cargo_mk2', startedAt: 1000, completesAt: 2000 },
      activeResearch2: null,
      wissen: 99999,
      wissenRate: 0,
    };
    const result = canStartResearch('drive_mk2', rs, {}, 2, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('slot 1 already busy');
  });

  it('rejects slot 2 when lab tier < 3', () => {
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 99999 };
    const result = canStartResearch('drive_mk2', rs, {}, 2, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Slot 2 requires');
  });

  it('rejects slot 2 when slot 2 already busy', () => {
    const rs: ResearchState = {
      unlockedModules: ['drive_mk1'],
      blueprints: [],
      activeResearch: null,
      activeResearch2: { moduleId: 'cargo_mk2', startedAt: 1000, completesAt: 2000 },
      wissen: 99999,
      wissenRate: 0,
    };
    const result = canStartResearch('drive_mk2', rs, {}, 3, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('slot 2 already busy');
  });

  it('allows slot 2 when lab tier >= 3 and slot is free', () => {
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 300 };
    const result = canStartResearch('drive_mk2', rs, {}, 3, 2);
    expect(result.valid).toBe(true);
  });

  it('rejects when lab tier too low', () => {
    // drive_mk2 requires lab tier 2; labTier = 1
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 99999 };
    const result = canStartResearch('drive_mk2', rs, {}, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Requires');
  });

  it('rejects when artefact_drive is insufficient', () => {
    // drive_mk3: tier 3, requires 1 drive artefact
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2'],
      wissen: 99999,
    };
    const result = canStartResearch('drive_mk3', rs, { drive: 0 }, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('artefact');
  });

  it('rejects freely available modules', () => {
    const result = canStartResearch('drive_mk1', emptyResearch(), {}, 1);
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
    const result = canStartResearch('void_drive', rs, PLENTY_ARTEFACTS, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction requirement');
  });

  it('rejects when faction tier too low', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
      wissen: 99999,
    };
    const result = canStartResearch('void_drive', rs, PLENTY_ARTEFACTS, 3, 1, { ancients: 'friendly' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction requirement');
  });

  it('allows when faction requirement met', () => {
    const rs: ResearchState = {
      ...emptyResearch(),
      unlockedModules: ['drive_mk1', 'drive_mk2', 'drive_mk3'],
      wissen: 99999,
    };
    const result = canStartResearch('void_drive', rs, PLENTY_ARTEFACTS, 3, 1, { ancients: 'honored' });
    expect(result.valid).toBe(true);
  });

  it('rejects when not enough wissen', () => {
    // drive_mk2 costs 300 wissen
    const rs: ResearchState = { ...emptyResearch(), unlockedModules: ['drive_mk1'], wissen: 100 };
    const result = canStartResearch('drive_mk2', rs, {}, 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Wissen');
  });

  it('rejects unknown module', () => {
    const result = canStartResearch('nonexistent', emptyResearch(), {}, 1);
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

describe('Wissen constants', () => {
  it('WISSEN_COST_BY_TIER covers tiers 1-5', () => {
    for (let t = 1; t <= 5; t++) {
      expect(WISSEN_COST_BY_TIER[t]).toBeGreaterThan(0);
    }
  });

  it('costs increase with tier', () => {
    for (let t = 1; t < 5; t++) {
      expect(WISSEN_COST_BY_TIER[t + 1]).toBeGreaterThan(WISSEN_COST_BY_TIER[t]);
    }
  });

  it('T1-T2 require no artefacts, T3-T5 require some', () => {
    expect(ARTEFACT_REQUIRED_BY_TIER[1]).toBe(0);
    expect(ARTEFACT_REQUIRED_BY_TIER[2]).toBe(0);
    expect(ARTEFACT_REQUIRED_BY_TIER[3]).toBeGreaterThan(0);
    expect(ARTEFACT_REQUIRED_BY_TIER[5]).toBe(MAX_ARTEFACTS_PER_RESEARCH);
  });

  it('ancient_jumpgate has highest multiplier', () => {
    const max = Math.max(...Object.values(WISSEN_SECTOR_MULTIPLIERS));
    expect(WISSEN_SECTOR_MULTIPLIERS['ancient_jumpgate']).toBe(max);
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
