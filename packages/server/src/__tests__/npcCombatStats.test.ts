import { describe, it, expect } from 'vitest';
import { generateNpcCombatStats } from '../engine/npcCombatStats.js';

describe('generateNpcCombatStats', () => {
  it('level 1 basics', () => {
    const s = generateNpcCombatStats(1);
    expect(s.energy).toBe(80);
    expect(s.shield).toBe(80);
    expect(s.armorHp).toBe(160);
    expect(s.weapons).toHaveLength(1);
    expect(s.weapons[0].atk).toBe(11);
    expect(s.pvIntercept).toBe(0);
    expect(s.ecmReduction).toBe(0);
  });
  it('level 3 has 2 weapons', () => {
    const s = generateNpcCombatStats(3);
    expect(s.weapons).toHaveLength(2);
  });
  it('level 5 has PV', () => {
    expect(generateNpcCombatStats(5).pvIntercept).toBe(0.25);
  });
  it('level 7 has ECM', () => {
    expect(generateNpcCombatStats(7).ecmReduction).toBe(0.10);
  });
  it('level 10 max stats', () => {
    const s = generateNpcCombatStats(10);
    expect(s.energy).toBe(350);
    expect(s.shield).toBe(800);
    expect(s.armorHp).toBe(700);
  });
});
