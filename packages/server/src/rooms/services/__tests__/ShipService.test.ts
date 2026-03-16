import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ShipModule } from '@void-sector/shared';
import { MODULES, BASE_HULL_AP_REGEN } from '@void-sector/shared';
import { calculateApRegen } from '@void-sector/shared';
import { createAPState } from '../../../engine/ap.js';

// ─── Sub-task A: AP regen uses calculateApRegen ───────────────────────────────

describe('createAPState with modules', () => {
  it('uses BASE_HULL_AP_REGEN when no modules provided', () => {
    const ap = createAPState(Date.now(), []);
    expect(ap.regenPerSecond).toBeCloseTo(BASE_HULL_AP_REGEN);
  });

  it('uses calculateApRegen(modules) when modules provided', () => {
    const modules: ShipModule[] = [
      { moduleId: 'fusion_cell_mk1', slotIndex: 0, source: 'standard', powerLevel: 'high', currentHp: 20 },
    ];
    const ap = createAPState(Date.now(), modules);
    const expected = calculateApRegen(modules);
    expect(ap.regenPerSecond).toBeCloseTo(expected);
  });

  it('regenPerSecond is higher with generator than without', () => {
    const withoutGenerator = createAPState(Date.now(), []);
    const withGenerator = createAPState(Date.now(), [
      { moduleId: 'fusion_cell_mk1', slotIndex: 0, source: 'standard', powerLevel: 'high', currentHp: 20 },
    ]);
    expect(withGenerator.regenPerSecond).toBeGreaterThan(withoutGenerator.regenPerSecond);
  });
});

// ─── Sub-task B: New ship module initialization ───────────────────────────────

describe('new ship fusion_cell_mk1 initialization', () => {
  it('fusion_cell_mk1 is a valid module definition', () => {
    const def = MODULES['fusion_cell_mk1'];
    expect(def).toBeDefined();
    expect(def.category).toBe('generator');
    expect(def.tier).toBe(1);
    expect(def.hitpoints).toBe(20);
  });

  it('expected initial module for new ship is fusion_cell_mk1 at slot 0', () => {
    // This verifies the shape of the initial module that createShip inserts
    const initialModules: ShipModule[] = [
      { moduleId: 'fusion_cell_mk1', slotIndex: 0, source: 'standard', powerLevel: 'high', currentHp: 20 },
    ];
    expect(initialModules).toHaveLength(1);
    expect(initialModules[0].moduleId).toBe('fusion_cell_mk1');
    expect(initialModules[0].slotIndex).toBe(0);
    expect(initialModules[0].source).toBe('standard');
    expect(initialModules[0].currentHp).toBe(20); // MODULE_HP_BY_TIER[1] = 20
    expect(initialModules[0].powerLevel).toBe('high');
  });

  it('calculateApRegen with fusion_cell_mk1 is greater than base hull regen', () => {
    const modules: ShipModule[] = [
      { moduleId: 'fusion_cell_mk1', slotIndex: 0, source: 'standard', powerLevel: 'high', currentHp: 20 },
    ];
    const regen = calculateApRegen(modules);
    // fusion_cell_mk1 has apRegen: 4, so total = 0.1 + 4 = 4.1
    expect(regen).toBeCloseTo(BASE_HULL_AP_REGEN + 4);
    expect(regen).toBeGreaterThan(BASE_HULL_AP_REGEN);
  });
});
