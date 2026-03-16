import { describe, it, expect } from 'vitest';
import { MODULE_DEFINITIONS } from '../moduleDefinitions.js';

describe('MODULE_DEFINITIONS', () => {
  it('has 76 modules', () => { expect(MODULE_DEFINITIONS).toHaveLength(76); });
  it('all have required fields', () => {
    for (const m of MODULE_DEFINITIONS) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.tier).toBeGreaterThan(0);
      expect(m.hitpoints).toBeGreaterThan(0);
    }
  });
  it('Ion Drive Mk1 has correct stats', () => {
    const m = MODULE_DEFINITIONS.find(m => m.id === 'ion_drive_mk1')!;
    expect(m.tier).toBe(1);
    expect(m.stats.jumpDistance).toBe(32);
    expect(m.costCredits).toBe(250);
  });
  it('found-only modules have isFoundOnly=true', () => {
    const found = MODULE_DEFINITIONS.filter(m => m.isFoundOnly);
    expect(found.length).toBe(12);
  });
  it('generators have negative energyCost (= produces)', () => {
    const gens = MODULE_DEFINITIONS.filter(m => m.category === 'generator');
    for (const g of gens) expect(g.energyCost).toBeLessThan(0);
  });
});
