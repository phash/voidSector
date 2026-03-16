import { describe, it, expect } from 'vitest';
import { MODULE_MAP, MODULE_DEFINITIONS } from '../moduleDefinitions.js';

const DRIVE_CHAIN = ['ion_drive_mk1', 'ion_drive_mk2', 'ion_drive_mk3', 'proto_am_drive', 'am_drive_mk1'];
const SCANNER_CHAIN = ['scanner_mk1', 'scanner_mk2', 'scanner_mk3', 'scanner_mk4', 'scanner_mk5'];
const ARMOR_CHAIN = ['armor_plating_mk1', 'armor_plating_mk2', 'armor_plating_mk3', 'armor_plating_mk4', 'armor_plating_mk5'];
const CARGO_CHAIN = ['cargo_bay_mk1', 'cargo_bay_mk2', 'cargo_bay_mk3', 'cargo_bay_mk4', 'cargo_bay_mk5'];
const MINING_CHAIN = [
  'mining_laser_mk1',
  'mining_laser_mk2',
  'mining_laser_mk3',
  'mining_laser_mk4',
  'mining_laser_mk5',
];

const ALL_CHAINS = [DRIVE_CHAIN, SCANNER_CHAIN, ARMOR_CHAIN, CARGO_CHAIN, MINING_CHAIN];

const TIER_4_5_MODULES = MODULE_DEFINITIONS.filter(
  (m) => (m.tier === 4 || m.tier === 5) && !m.isFoundOnly,
);

describe('Tier 4-5 module definitions', () => {
  it('all tier 4-5 chain modules exist in MODULE_MAP', () => {
    const expected = [
      'proto_am_drive',
      'am_drive_mk1',
      'scanner_mk4',
      'scanner_mk5',
      'armor_plating_mk4',
      'armor_plating_mk5',
      'cargo_bay_mk4',
      'cargo_bay_mk5',
      'mining_laser_mk4',
      'mining_laser_mk5',
    ];
    for (const id of expected) {
      expect(MODULE_MAP.get(id), `${id} should exist`).toBeDefined();
    }
  });

  it('all tier 4-5 modules have correct tier value', () => {
    for (const mod of TIER_4_5_MODULES) {
      expect([4, 5]).toContain(mod.tier);
    }
  });

  it('all tier 4-5 modules have description', () => {
    for (const mod of TIER_4_5_MODULES) {
      expect(mod.description, `${mod.id} missing description`).toBeTruthy();
    }
  });

  it('all tier 4-5 modules have stats or hitpoints', () => {
    for (const mod of TIER_4_5_MODULES) {
      const hasStats = Object.keys(mod.stats).length > 0;
      const hasHitpoints = mod.hitpoints > 0;
      expect(
        hasStats || hasHitpoints,
        `${mod.id} should have stats or hitpoints`,
      ).toBe(true);
    }
  });
});

describe('Artefact costs for tier 4-5', () => {
  it('tier 4-5 modules with artefact costs have non-zero costArtefact', () => {
    const modulesWithArtefacts = TIER_4_5_MODULES.filter(m => m.costArtefact !== '0');
    expect(modulesWithArtefacts.length).toBeGreaterThan(0);
  });

  it('tier 5 modules cost more credits than tier 4 in same chain', () => {
    for (const chain of ALL_CHAINS) {
      const mk4 = MODULE_MAP.get(chain[3])!;
      const mk5 = MODULE_MAP.get(chain[4])!;
      expect(
        mk5.costCredits,
        `${chain[4]} purchase credits should exceed ${chain[3]}`,
      ).toBeGreaterThan(mk4.costCredits);
    }
  });
});

describe('Prerequisite chains', () => {
  it('tier 4 requires tier 3 as prerequisite', () => {
    for (const chain of ALL_CHAINS) {
      const mk4 = MODULE_MAP.get(chain[3])!;
      expect(mk4.prerequisiteModuleId, `${chain[3]} should require ${chain[2]} as prerequisite`).toBe(
        chain[2],
      );
    }
  });

  it('tier 5 requires tier 4 as prerequisite', () => {
    for (const chain of ALL_CHAINS) {
      const mk5 = MODULE_MAP.get(chain[4])!;
      expect(mk5.prerequisiteModuleId, `${chain[4]} should require ${chain[3]} as prerequisite`).toBe(
        chain[3],
      );
    }
  });

  it('full prerequisite chains are valid (each module points to previous tier)', () => {
    for (const chain of ALL_CHAINS) {
      // mk1 has no prerequisite (freely available)
      const mk1 = MODULE_MAP.get(chain[0])!;
      expect(mk1.prerequisiteModuleId).toBeUndefined();

      // mk2..mk5 chain back
      for (let i = 1; i < chain.length; i++) {
        const mod = MODULE_MAP.get(chain[i])!;
        expect(mod.prerequisiteModuleId, `${chain[i]} should have prerequisite ${chain[i - 1]}`).toBe(
          chain[i - 1],
        );
      }
    }
  });

  it('prerequisite references point to existing modules', () => {
    for (const mod of MODULE_DEFINITIONS) {
      if (mod.prerequisiteModuleId) {
        expect(
          MODULE_MAP.get(mod.prerequisiteModuleId),
          `${mod.id} prerequisite '${mod.prerequisiteModuleId}' does not exist`,
        ).toBeDefined();
      }
    }
  });
});

describe('Mining laser modules', () => {
  it('mining laser mk1-mk5 all exist', () => {
    for (const id of MINING_CHAIN) {
      expect(MODULE_MAP.get(id), `${id} should exist`).toBeDefined();
    }
  });

  it('mining laser modules have category "mining"', () => {
    for (const id of MINING_CHAIN) {
      expect(MODULE_MAP.get(id)!.category).toBe('mining');
    }
  });

  it('mining speed increases with tier', () => {
    let prevSpeed = 0;
    for (const id of MINING_CHAIN) {
      const speed = MODULE_MAP.get(id)!.stats['miningSpeed'] ?? 0;
      expect(speed, `${id} miningSpeed should exceed previous tier`).toBeGreaterThan(prevSpeed);
      prevSpeed = speed;
    }
  });

  it('mining_laser_mk1 is not found-only', () => {
    expect(MODULE_MAP.get('mining_laser_mk1')!.isFoundOnly).toBe(false);
  });
});

describe('Drive specifics', () => {
  it('am_drive_mk1 has jumpDistance 150', () => {
    expect(MODULE_MAP.get('am_drive_mk1')!.stats['jumpDistance']).toBe(150);
  });

  it('am_drive_mk2 has jumpDistance 250', () => {
    expect(MODULE_MAP.get('am_drive_mk2')!.stats['jumpDistance']).toBe(250);
  });

  it('drive tier progression increases jump distance', () => {
    let prevDistance = 0;
    for (const id of DRIVE_CHAIN) {
      const distance = MODULE_MAP.get(id)!.stats['jumpDistance'] ?? 0;
      expect(distance, `${id} jumpDistance should exceed previous`).toBeGreaterThan(prevDistance);
      prevDistance = distance;
    }
  });
});

describe('Scanner specifics', () => {
  it('scanner_mk4 has scanRange 12', () => {
    expect(MODULE_MAP.get('scanner_mk4')!.stats['scanRange']).toBe(12);
  });
});

describe('Armor specifics', () => {
  it('armor_plating_mk4 has hitpoints 600', () => {
    expect(MODULE_MAP.get('armor_plating_mk4')!.hitpoints).toBe(600);
  });

  it('armor hitpoints increase with tier', () => {
    let prevHp = 0;
    for (const id of ARMOR_CHAIN) {
      const hp = MODULE_MAP.get(id)!.hitpoints;
      expect(hp, `${id} hitpoints should exceed previous`).toBeGreaterThan(prevHp);
      prevHp = hp;
    }
  });
});

describe('Cargo specifics', () => {
  it('cargo capacity increases with tier', () => {
    let prevCap = 0;
    for (const id of CARGO_CHAIN) {
      const cap = MODULE_MAP.get(id)!.stats['cargoCapacity'] ?? 0;
      expect(cap, `${id} cargoCapacity should exceed previous`).toBeGreaterThan(prevCap);
      prevCap = cap;
    }
  });
});

describe('ModuleTier type coverage', () => {
  it('MODULE_DEFINITIONS contains at least one module of each tier 1-5', () => {
    const tiers = new Set<number>();
    for (const mod of MODULE_DEFINITIONS) {
      tiers.add(mod.tier);
    }
    for (let t = 1; t <= 5; t++) {
      expect(tiers.has(t), `tier ${t} should have at least one module`).toBe(true);
    }
  });
});
