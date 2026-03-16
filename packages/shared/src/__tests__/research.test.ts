import { describe, it, expect } from 'vitest';
import { isModuleFreelyAvailable, isModuleUnlocked } from '../research';
import { MODULES } from '../constants';
import { MODULE_MAP, MODULE_DEFINITIONS } from '../moduleDefinitions';
import { ARTEFACT_TYPES, ARTEFACT_TYPE_FOR_CATEGORY } from '../types';

describe('isModuleFreelyAvailable', () => {
  it('returns true for tier-1 base modules (not foundOnly)', () => {
    expect(isModuleFreelyAvailable('ion_drive_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('cargo_bay_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('armor_plating_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('scanner_mk1')).toBe(true);
  });

  it('returns false for found-only modules', () => {
    expect(isModuleFreelyAvailable('void_drive')).toBe(false);
    expect(isModuleFreelyAvailable('rift_drive')).toBe(false);
    expect(isModuleFreelyAvailable('ancient_lance')).toBe(false);
  });

  it('returns false for unknown modules', () => {
    expect(isModuleFreelyAvailable('nonexistent')).toBe(false);
  });
});

describe('isModuleUnlocked', () => {
  it('freely available modules are always unlocked', () => {
    expect(isModuleUnlocked('ion_drive_mk1', { category: 'drive', tier: 1 }, {}, [])).toBe(true);
    expect(isModuleUnlocked('cargo_bay_mk1', { category: 'cargo', tier: 1 }, {}, [])).toBe(true);
  });

  it('blueprint alone does NOT unlock without required tier', () => {
    expect(
      isModuleUnlocked('void_drive', { category: 'drive', tier: 3 }, {}, ['void_drive']),
    ).toBe(false);
  });

  it('blueprint + required tier unlocks module', () => {
    // explorer branch level 2 → unlocked tier 3; blueprint provides the recipe
    expect(
      isModuleUnlocked('void_drive', { category: 'drive', tier: 3 }, { explorer: 2 }, ['void_drive']),
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

  it('special category modules can be unlocked with blueprint (no tier needed)', () => {
    expect(
      isModuleUnlocked('some_special', { category: 'special', tier: 2 }, {}, ['some_special']),
    ).toBe(true);
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

describe('Module data validation (new system)', () => {
  it('all modules have description', () => {
    for (const mod of MODULE_DEFINITIONS) {
      expect(mod.description, `${mod.id} missing description`).toBeTruthy();
    }
  });

  it('all modules have category and tier', () => {
    for (const mod of MODULE_DEFINITIONS) {
      expect(mod.category, `${mod.id} missing category`).toBeTruthy();
      expect(mod.tier, `${mod.id} missing tier`).toBeGreaterThan(0);
    }
  });

  it('all tier 2+ modules with prerequisiteModuleId reference existing modules', () => {
    for (const mod of MODULE_DEFINITIONS) {
      if (mod.prerequisiteModuleId) {
        expect(
          MODULE_MAP.get(mod.prerequisiteModuleId),
          `${mod.id} prerequisite '${mod.prerequisiteModuleId}' does not exist`,
        ).toBeDefined();
      }
    }
  });

  it('spezial modules exist', () => {
    expect(MODULE_MAP.get('void_drive')).toBeDefined();
    expect(MODULE_MAP.get('quantum_scanner')).toBeDefined();
    expect(MODULE_MAP.get('nano_armor')).toBeDefined();
  });

  it('void_drive is found-only and unique', () => {
    const vd = MODULE_MAP.get('void_drive')!;
    expect(vd.isFoundOnly).toBe(true);
    expect(vd.isUnique).toBe(true);
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
  it('ARTEFACT_TYPE_FOR_CATEGORY maps all 12 categories', () => {
    expect(Object.keys(ARTEFACT_TYPE_FOR_CATEGORY)).toHaveLength(12);
    expect(ARTEFACT_TYPE_FOR_CATEGORY['drive']).toBe('drive');
    expect(ARTEFACT_TYPE_FOR_CATEGORY['mining']).toBe('mining');
  });
});

describe('MODULE_DEFINITIONS artefact costs', () => {
  it('some modules require artefacts via costArtefact', () => {
    const modulesWithArtefactCost = MODULE_DEFINITIONS.filter(
      (m) => m.costArtefact !== '0' && m.costArtefact !== '',
    );
    expect(modulesWithArtefactCost.length).toBeGreaterThan(0);
  });

  it('T4+ modules may require artefacts', () => {
    const t4plus = MODULE_DEFINITIONS.filter(
      (m) => m.tier >= 4 && !m.isFoundOnly && m.costArtefact !== '0',
    );
    expect(t4plus.length).toBeGreaterThan(0);
  });
});
