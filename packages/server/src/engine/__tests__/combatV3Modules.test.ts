import { describe, it, expect } from 'vitest';
import { buildCombatModules } from '../combatV3Engine.js';
import type { ShipModule } from '@void-sector/shared';

const sm = (moduleId: string, extra: Partial<ShipModule> = {}): ShipModule => ({
  moduleId,
  slotIndex: 0,
  source: 'standard',
  ...extra,
});

describe('buildCombatModules', () => {
  it('maps an installed weapon module into a CombatModule', () => {
    const [mod] = buildCombatModules([sm('puls_laser_mk1', { slotIndex: 2 })]);
    expect(mod).toMatchObject({
      moduleId: 'puls_laser_mk1',
      category: 'weapon_energy',
      maxHp: 40,
      hp: 40,
      active: true,
      energyCost: 14,
    });
    expect(mod.stats.atk).toBe(8);
  });

  it('respects currentHp when set (damaged module)', () => {
    const [mod] = buildCombatModules([sm('puls_laser_mk1', { currentHp: 12 })]);
    expect(mod.hp).toBe(12);
    expect(mod.maxHp).toBe(40);
  });

  it('skips unknown module ids', () => {
    const mods = buildCombatModules([sm('does_not_exist'), sm('puls_laser_mk1')]);
    expect(mods).toHaveLength(1);
    expect(mods[0].moduleId).toBe('puls_laser_mk1');
  });

  it('returns an empty array for no modules', () => {
    expect(buildCombatModules([])).toEqual([]);
  });

  it('maps a generator with its (negative) energyCost preserved', () => {
    const [gen] = buildCombatModules([sm('fusion_cell_mk1')]);
    expect(gen.category).toBe('generator');
    // generators carry a negative energyCost; initCombatV3 reads |energyCost| as the budget
    expect(gen.energyCost).toBeLessThan(0);
  });
});
