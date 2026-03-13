import { describe, it, expect } from 'vitest';
import type { ShipModule, ModuleCategory } from '../types.js';

describe('combat type extensions', () => {
  it('ShipModule accepts powerLevel field', () => {
    const m: ShipModule = {
      moduleId: 'generator_mk1', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 20,
    };
    expect(m.powerLevel).toBe('high');
    expect(m.currentHp).toBe(20);
  });

  it('powerLevel defaults are typed correctly', () => {
    const levels: ShipModule['powerLevel'][] = ['off', 'low', 'mid', 'high'];
    expect(levels).toHaveLength(4);
  });

  it('ModuleCategory includes generator and repair', () => {
    const cat1: ModuleCategory = 'generator';
    const cat2: ModuleCategory = 'repair';
    expect(cat1).toBe('generator');
    expect(cat2).toBe('repair');
  });
});
