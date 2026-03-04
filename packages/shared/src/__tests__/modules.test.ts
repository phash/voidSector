import { describe, it, expect } from 'vitest';
import { MODULES } from '../constants';
import type { ModuleDefinition, ModuleTier } from '../types';

const TIER_4_5_MODULES = Object.entries(MODULES).filter(
  ([, m]) => m.tier === 4 || m.tier === 5
);

const DRIVE_CHAIN = ['drive_mk1', 'drive_mk2', 'drive_mk3', 'drive_mk4', 'drive_mk5'];
const SCANNER_CHAIN = ['scanner_mk1', 'scanner_mk2', 'scanner_mk3', 'scanner_mk4', 'scanner_mk5'];
const ARMOR_CHAIN = ['armor_mk1', 'armor_mk2', 'armor_mk3', 'armor_mk4', 'armor_mk5'];
const CARGO_CHAIN = ['cargo_mk1', 'cargo_mk2', 'cargo_mk3', 'cargo_mk4', 'cargo_mk5'];
const MINING_CHAIN = ['mining_laser_mk1', 'mining_laser_mk2', 'mining_laser_mk3', 'mining_laser_mk4', 'mining_laser_mk5'];

const ALL_CHAINS = [DRIVE_CHAIN, SCANNER_CHAIN, ARMOR_CHAIN, CARGO_CHAIN, MINING_CHAIN];

describe('Tier 4-5 module definitions', () => {
  it('all tier 4-5 modules exist in MODULES', () => {
    const expected = [
      'drive_mk4', 'drive_mk5',
      'scanner_mk4', 'scanner_mk5',
      'armor_mk4', 'armor_mk5',
      'cargo_mk4', 'cargo_mk5',
      'mining_laser_mk4', 'mining_laser_mk5',
    ];
    for (const id of expected) {
      expect(MODULES[id], `${id} should exist`).toBeDefined();
    }
  });

  it('all tier 4-5 modules have correct tier value', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      expect([4, 5]).toContain(mod.tier);
    }
  });

  it('all tier 4-5 modules have primaryEffect with stat, delta, and label', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      expect(mod.primaryEffect, `${id} missing primaryEffect`).toBeDefined();
      expect(mod.primaryEffect.stat, `${id} primaryEffect missing stat`).toBeTruthy();
      expect(typeof mod.primaryEffect.delta, `${id} primaryEffect delta not number`).toBe('number');
      expect(mod.primaryEffect.label, `${id} primaryEffect missing label`).toBeTruthy();
    }
  });

  it('all tier 4-5 modules have at least one secondary effect', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      expect(
        mod.secondaryEffects.length,
        `${id} should have at least one secondary effect`
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('all tier 4-5 modules have effects matching their primaryEffect stat', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      const statKey = mod.primaryEffect.stat;
      expect(
        mod.effects[statKey as keyof typeof mod.effects],
        `${id} effects should contain ${statKey}`
      ).toBeDefined();
    }
  });
});

describe('Artefact costs for tier 4-5', () => {
  it('all tier 4-5 modules require artefacts in purchaseCost', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      expect(
        mod.cost.artefact,
        `${id} should require artefacts to purchase`
      ).toBeGreaterThan(0);
    }
  });

  it('all tier 4-5 modules require artefacts in researchCost', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      expect(mod.researchCost, `${id} should have researchCost`).toBeDefined();
      expect(
        mod.researchCost!.artefact,
        `${id} researchCost should include artefacts`
      ).toBeGreaterThan(0);
    }
  });

  it('mk5 modules cost more artefacts than mk4 in same chain', () => {
    for (const chain of ALL_CHAINS) {
      const mk4 = MODULES[chain[3]];
      const mk5 = MODULES[chain[4]];
      expect(
        mk5.cost.artefact!,
        `${chain[4]} purchase artefact cost should exceed ${chain[3]}`
      ).toBeGreaterThan(mk4.cost.artefact!);
      expect(
        mk5.researchCost!.artefact!,
        `${chain[4]} research artefact cost should exceed ${chain[3]}`
      ).toBeGreaterThan(mk4.researchCost!.artefact!);
    }
  });

  it('mk5 modules cost more credits than mk4', () => {
    for (const chain of ALL_CHAINS) {
      const mk4 = MODULES[chain[3]];
      const mk5 = MODULES[chain[4]];
      expect(
        mk5.cost.credits,
        `${chain[4]} purchase credits should exceed ${chain[3]}`
      ).toBeGreaterThan(mk4.cost.credits);
    }
  });
});

describe('Prerequisite chains', () => {
  it('mk4 requires mk3 as prerequisite', () => {
    for (const chain of ALL_CHAINS) {
      const mk4 = MODULES[chain[3]];
      expect(
        mk4.prerequisite,
        `${chain[3]} should require ${chain[2]} as prerequisite`
      ).toBe(chain[2]);
    }
  });

  it('mk5 requires mk4 as prerequisite', () => {
    for (const chain of ALL_CHAINS) {
      const mk5 = MODULES[chain[4]];
      expect(
        mk5.prerequisite,
        `${chain[4]} should require ${chain[3]} as prerequisite`
      ).toBe(chain[3]);
    }
  });

  it('full prerequisite chains are valid (each module points to previous tier)', () => {
    for (const chain of ALL_CHAINS) {
      // mk1 has no prerequisite (freely available)
      const mk1 = MODULES[chain[0]];
      expect(mk1.prerequisite).toBeUndefined();

      // mk2..mk5 chain back
      for (let i = 1; i < chain.length; i++) {
        const mod = MODULES[chain[i]];
        expect(
          mod.prerequisite,
          `${chain[i]} should have prerequisite ${chain[i - 1]}`
        ).toBe(chain[i - 1]);
      }
    }
  });

  it('prerequisite references point to existing modules', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.prerequisite) {
        expect(
          MODULES[mod.prerequisite],
          `${id} prerequisite '${mod.prerequisite}' does not exist`
        ).toBeDefined();
      }
    }
  });
});

describe('Mining laser modules', () => {
  it('mining laser mk1-mk5 all exist', () => {
    for (const id of MINING_CHAIN) {
      expect(MODULES[id], `${id} should exist`).toBeDefined();
    }
  });

  it('mining laser modules have category "mining"', () => {
    for (const id of MINING_CHAIN) {
      expect(MODULES[id].category).toBe('mining');
    }
  });

  it('mining laser primary effect is miningBonus', () => {
    for (const id of MINING_CHAIN) {
      expect(MODULES[id].primaryEffect.stat).toBe('miningBonus');
    }
  });

  it('mining bonus increases with tier', () => {
    let prevBonus = 0;
    for (const id of MINING_CHAIN) {
      const bonus = MODULES[id].primaryEffect.delta;
      expect(bonus, `${id} miningBonus should exceed previous tier`).toBeGreaterThan(prevBonus);
      prevBonus = bonus;
    }
  });

  it('mining_laser_mk1 is freely available (no researchCost)', () => {
    expect(MODULES['mining_laser_mk1'].researchCost).toBeUndefined();
  });
});

describe('Drive mk4/mk5 specifics', () => {
  it('drive_mk4 has hyperdriveRange 25', () => {
    expect(MODULES['drive_mk4'].effects.hyperdriveRange).toBe(25);
  });

  it('drive_mk5 has hyperdriveRange 50', () => {
    expect(MODULES['drive_mk5'].effects.hyperdriveRange).toBe(50);
  });

  it('drive_mk4 costs 3 artefacts to purchase', () => {
    expect(MODULES['drive_mk4'].cost.artefact).toBe(3);
  });

  it('drive_mk5 costs 8 artefacts to purchase', () => {
    expect(MODULES['drive_mk5'].cost.artefact).toBe(8);
  });

  it('drive tier progression increases jump range', () => {
    let prevRange = 0;
    for (const id of DRIVE_CHAIN) {
      const range = MODULES[id].effects.jumpRange ?? 0;
      expect(range, `${id} jumpRange should exceed previous`).toBeGreaterThan(prevRange);
      prevRange = range;
    }
  });
});

describe('Scanner mk4/mk5 specifics', () => {
  it('scanner_mk4 has scannerLevel 3 in effects', () => {
    expect(MODULES['scanner_mk4'].effects.scannerLevel).toBe(3);
  });

  it('scanner_mk4 costs 2 artefacts to purchase', () => {
    expect(MODULES['scanner_mk4'].cost.artefact).toBe(2);
  });

  it('scanner_mk4 has miningBonus secondary effect', () => {
    expect(
      MODULES['scanner_mk4'].secondaryEffects.some(e => e.stat === 'miningBonus')
    ).toBe(true);
  });
});

describe('Armor mk4/mk5 specifics', () => {
  it('armor_mk4 hp +150 with shield +15', () => {
    expect(MODULES['armor_mk4'].effects.hp).toBe(150);
    expect(MODULES['armor_mk4'].effects.shieldHp).toBe(15);
  });

  it('armor_mk4 costs 2 artefacts to purchase', () => {
    expect(MODULES['armor_mk4'].cost.artefact).toBe(2);
  });

  it('armor hp increases with tier', () => {
    let prevHp = 0;
    for (const id of ARMOR_CHAIN) {
      const hp = MODULES[id].effects.hp ?? 0;
      expect(hp, `${id} hp should exceed previous`).toBeGreaterThan(prevHp);
      prevHp = hp;
    }
  });
});

describe('Cargo mk4/mk5 specifics', () => {
  it('cargo capacity increases with tier', () => {
    let prevCap = 0;
    for (const id of CARGO_CHAIN) {
      const cap = MODULES[id].effects.cargoCap ?? 0;
      expect(cap, `${id} cargoCap should exceed previous`).toBeGreaterThan(prevCap);
      prevCap = cap;
    }
  });

  it('cargo mk4 and mk5 have fuel tank bonus', () => {
    expect(MODULES['cargo_mk4'].effects.fuelMax).toBeGreaterThan(0);
    expect(MODULES['cargo_mk5'].effects.fuelMax).toBeGreaterThan(0);
    expect(MODULES['cargo_mk5'].effects.fuelMax!).toBeGreaterThan(MODULES['cargo_mk4'].effects.fuelMax!);
  });
});

describe('ModuleTier type coverage', () => {
  it('MODULES contains at least one module of each tier 1-5', () => {
    const tiers = new Set<number>();
    for (const mod of Object.values(MODULES)) {
      tiers.add(mod.tier);
    }
    for (let t = 1; t <= 5; t++) {
      expect(tiers.has(t), `tier ${t} should have at least one module`).toBe(true);
    }
  });

  it('each tier 4-5 module has a researchDurationMin', () => {
    for (const [id, mod] of TIER_4_5_MODULES) {
      expect(
        mod.researchDurationMin,
        `${id} should have researchDurationMin`
      ).toBeGreaterThan(0);
    }
  });
});
