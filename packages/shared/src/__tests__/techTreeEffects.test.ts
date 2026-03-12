import { describe, it, expect } from 'vitest';
import { getTechTreeEffects, calculateResearchCost } from '../techTreeEffects.js';

describe('getTechTreeEffects', () => {
  it('returns empty effects for empty nodes', () => {
    const effects = getTechTreeEffects({});
    expect(effects.unlockedTiers).toEqual({});
    expect(effects.statBonuses).toEqual({});
  });

  it('branch level determines unlocked tier', () => {
    const effects = getTechTreeEffects({ kampf: 2 });
    // kampf level 2 → tier 3 for weapon category
    expect(effects.unlockedTiers['kampf']).toBe(3);
  });

  it('leaf bonuses accumulate by level', () => {
    const effects = getTechTreeEffects({
      'kampf': 1,
      'kampf.laser': 1,
      'kampf.laser.dmg': 2,
    });
    // weapon_damage = 0.15 * 2 = 0.30
    expect(effects.statBonuses['weapon_damage']).toBeCloseTo(0.30);
  });

  it('leaf penalties also accumulate', () => {
    const effects = getTechTreeEffects({
      'kampf': 1,
      'kampf.laser': 1,
      'kampf.laser.dmg': 3,
    });
    // penalty: weapon_efficiency -0.05 * 3 = -0.15
    expect(effects.statBonuses['weapon_efficiency']).toBeCloseTo(-0.15);
  });

  it('multiple branches aggregate independently', () => {
    const effects = getTechTreeEffects({ kampf: 1, ausbau: 2 });
    expect(effects.unlockedTiers['kampf']).toBe(2);
    expect(effects.unlockedTiers['ausbau']).toBe(3);
  });

  it('parent module leaf effects cascade to child specialization (top-down inheritance)', () => {
    const effects = getTechTreeEffects({
      'kampf': 1,
      'kampf.laser': 1,
      'kampf.laser.dmg': 1,      // +0.15 weapon_damage, -0.05 weapon_efficiency
      'kampf.laser.phaser': 1,   // specialization: -0.20 weapon_damage own effect
    });
    // weapon_damage = leaf +0.15 + phaser own -0.20 = -0.05
    // (leaf bonus cascades to child spec)
    expect(effects.statBonuses['weapon_damage']).toBeCloseTo(-0.05);
    // weapon_efficiency = leaf penalty -0.05
    expect(effects.statBonuses['weapon_efficiency']).toBeCloseTo(-0.05);
  });
});

describe('calculateResearchCost', () => {
  it('branch level 1 costs 150 with 0 total', () => {
    expect(calculateResearchCost('kampf', 0, 0)).toBe(150);
  });

  it('applies global escalation', () => {
    // 150 * (1 + 10 * 0.05) = 150 * 1.5 = 225
    expect(calculateResearchCost('kampf', 0, 10)).toBe(225);
  });

  it('branch level 2 uses costPerLevel', () => {
    // costPerLevel[1] = 450, with 5 total: 450 * 1.25 = 562.5 → 563
    expect(calculateResearchCost('kampf', 1, 5)).toBe(563);
  });

  it('leaf level uses costPerLevel', () => {
    // costPerLevel[1] = 540, with 3 total: 540 * 1.15 = 621
    expect(calculateResearchCost('kampf.laser.dmg', 1, 3)).toBe(621);
  });

  it('module (maxLevel 1) uses baseCost', () => {
    // 280 * (1 + 0 * 0.05) = 280
    expect(calculateResearchCost('kampf.laser', 0, 0)).toBe(280);
  });
});
