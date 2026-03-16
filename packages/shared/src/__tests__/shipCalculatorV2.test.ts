import { describe, it, expect } from 'vitest';
import { calculateShipStats } from '../shipCalculator.js';

describe('calculateShipStats V2', () => {
  it('default ship with Fusion Cell Mk1 + Ion Drive Mk1', () => {
    const stats = calculateShipStats([
      { moduleId: 'fusion_cell_mk1', slot: 'generator' },
      { moduleId: 'ion_drive_mk1', slot: 'engine' },
    ]);
    expect(stats.apRegen).toBe(4);
    expect(stats.energyBudget).toBe(100);
    expect(stats.jumpDistance).toBe(32);
    expect(stats.fuelCapacity).toBe(2000);
  });

  it('adds cargo capacity', () => {
    const stats = calculateShipStats([
      { moduleId: 'fusion_cell_mk1', slot: 'generator' },
      { moduleId: 'ion_drive_mk1', slot: 'engine' },
      { moduleId: 'cargo_bay_mk3', slot: 'cargo' },
    ]);
    expect(stats.cargoCap).toBe(120); // base 20 + 100
  });

  it('derives combat stats', () => {
    const stats = calculateShipStats([
      { moduleId: 'fusion_cell_mk3', slot: 'generator' },
      { moduleId: 'ion_drive_mk1', slot: 'engine' },
      { moduleId: 'schild_gen_mk2', slot: 'shield' },
      { moduleId: 'armor_plating_mk1', slot: 'armor' },
    ]);
    expect(stats.energyBudget).toBe(200);
    expect(stats.shieldHp).toBe(200);
    expect(stats.shieldRegen).toBe(6);
    expect(stats.armorHp).toBe(200);
  });

  it('returns defaults for empty modules', () => {
    const stats = calculateShipStats([]);
    expect(stats.apRegen).toBe(0);
    expect(stats.cargoCap).toBe(20); // base only
  });
});
