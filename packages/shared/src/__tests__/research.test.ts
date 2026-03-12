import { describe, it, expect } from 'vitest';
import { isModuleFreelyAvailable, isModuleUnlocked } from '../research';
import { MODULES } from '../constants';
import { ARTEFACT_TYPES, ARTEFACT_TYPE_FOR_CATEGORY } from '../types';

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
    expect(isModuleUnlocked('drive_mk1', { category: 'drive', tier: 1 }, {}, [])).toBe(true);
    expect(isModuleUnlocked('cargo_mk1', { category: 'cargo', tier: 1 }, {}, [])).toBe(true);
  });

  it('blueprint modules are unlocked', () => {
    expect(
      isModuleUnlocked('void_drive', { category: 'drive', tier: 3 }, {}, ['void_drive']),
    ).toBe(true);
  });

  it('locked modules are not unlocked with empty tech tree', () => {
    expect(isModuleUnlocked('drive_mk2', { category: 'drive', tier: 2 }, {}, [])).toBe(false);
    expect(isModuleUnlocked('void_drive', { category: 'drive', tier: 3 }, {}, [])).toBe(false);
  });

  it('tier-2 module unlocks when branch level >= 1', () => {
    // explorer branch level 1 → unlocked tier 2
    const researchedNodes = { explorer: 1 };
    expect(
      isModuleUnlocked('drive_mk2', { category: 'drive', tier: 2 }, researchedNodes, []),
    ).toBe(true);
  });

  it('tier-3 module requires branch level >= 2', () => {
    const nodes1 = { explorer: 1 };
    expect(
      isModuleUnlocked('drive_mk3', { category: 'drive', tier: 3 }, nodes1, []),
    ).toBe(false);
    const nodes2 = { explorer: 2 };
    expect(
      isModuleUnlocked('drive_mk3', { category: 'drive', tier: 3 }, nodes2, []),
    ).toBe(true);
  });

  it('special category modules cannot be unlocked by tech tree (no branch mapping)', () => {
    const nodes = { ausbau: 5, intel: 5, kampf: 5, explorer: 5 };
    expect(
      isModuleUnlocked('some_special', { category: 'special', tier: 2 }, nodes, []),
    ).toBe(false);
  });

  it('ausbau branch unlocks shield, armor, cargo, mining, defense, generator, repair', () => {
    const nodes = { ausbau: 2 };
    for (const cat of ['shield', 'armor', 'cargo', 'mining', 'defense', 'generator', 'repair']) {
      expect(
        isModuleUnlocked(`test_${cat}`, { category: cat, tier: 3 }, nodes, []),
      ).toBe(true);
    }
  });

  it('kampf branch unlocks weapon category', () => {
    const nodes = { kampf: 1 };
    expect(
      isModuleUnlocked('laser_mk2', { category: 'weapon', tier: 2 }, nodes, []),
    ).toBe(true);
  });

  it('intel branch unlocks scanner category', () => {
    const nodes = { intel: 1 };
    expect(
      isModuleUnlocked('scanner_mk2', { category: 'scanner', tier: 2 }, nodes, []),
    ).toBe(true);
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
