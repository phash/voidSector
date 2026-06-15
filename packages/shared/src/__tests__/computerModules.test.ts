import { describe, it, expect } from 'vitest';
import { MODULE_DEFINITIONS, MODULE_MAP } from '../moduleDefinitions.js';

describe('computer modules MK.I-V', () => {
  const computers = MODULE_DEFINITIONS.filter((m) => m.category === 'computer');

  it('defines exactly 5 computer modules, tiers 1-5, slot "computer"', () => {
    expect(computers).toHaveLength(5);
    expect(computers.map((m) => m.tier).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const m of computers) {
      expect(m.slot).toBe('computer');
      expect(m.hitpoints).toBeGreaterThan(0);
      expect(m.isFoundOnly).toBe(false);
    }
  });

  it('MK.I is the cheapest and chains via prerequisites', () => {
    expect(MODULE_MAP.get('computer_mk1')!.tier).toBe(1);
    expect(MODULE_MAP.get('computer_mk2')!.prerequisiteModuleId).toBe('computer_mk1');
    expect(MODULE_MAP.get('computer_mk5')!.prerequisiteModuleId).toBe('computer_mk4');
  });
});
