import type { NpcCombatStats } from '@void-sector/shared';

export function generateNpcCombatStats(level: number): NpcCombatStats {
  return {
    energy: 50 + level * 30,
    shield: level * 80,
    shieldRegen: level * 2,
    armorHp: 100 + level * 60,
    weapons: [
      { type: 'energy', atk: 5 + level * 6 },
      ...(level >= 3 ? [{ type: level % 2 === 0 ? 'kinetic' : 'missile', atk: level * 4, ...(level % 2 === 0 ? { piercing: 0.3 } : {}) }] : []),
    ],
    accuracy: (80 + level) / 100,
    pvIntercept: level >= 5 ? 0.25 : 0,
    ecmReduction: level >= 7 ? 0.10 : 0,
  };
}
