import { describe, it, expect } from 'vitest';
import { validateModuleInstall } from '../shipCalculator.js';
import type { ShipModule, AcepXpSnapshot } from '../types.js';

const noAcep: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };
const acepWith1ExtraSlot: AcepXpSnapshot = { ausbau: 500, intel: 0, kampf: 0, explorer: 0 };

describe('validateModuleInstall — specialized slots', () => {
  it('allows generator in slot 0 (specialized)', () => {
    const result = validateModuleInstall([], 'fusion_cell_mk1', 0, noAcep);
    expect(result.valid).toBe(true);
  });

  it('allows drive in slot 1 (specialized)', () => {
    const result = validateModuleInstall([], 'ion_drive_mk1', 1, noAcep);
    expect(result.valid).toBe(true);
  });

  it('weapon_energy module rejected in weapon slot (category mismatch: weapon vs weapon_energy)', () => {
    // puls_laser_mk1 has category 'weapon_energy', slot 2 expects 'weapon'
    // Current validator does strict category match, so weapon sub-categories don't match
    const result = validateModuleInstall([], 'puls_laser_mk1', 2, noAcep);
    expect(result.valid).toBe(false);
  });

  it('rejects weapon_energy in generator slot (slot 0)', () => {
    const result = validateModuleInstall([], 'puls_laser_mk1', 0, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/specialized/i);
  });

  it('rejects drive in weapon slot (slot 2)', () => {
    const result = validateModuleInstall([], 'ion_drive_mk1', 2, noAcep);
    expect(result.valid).toBe(false);
  });

  it('rejects defense module in specialized slot', () => {
    const result = validateModuleInstall([], 'punkt_verteidigung_mk2', 3, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extra/i);
  });

  it('allows defense in extra slot when AUSBAU >= 500', () => {
    const result = validateModuleInstall([], 'punkt_verteidigung_mk2', 9, acepWith1ExtraSlot);
    expect(result.valid).toBe(true);
  });

  it('rejects extra slot when AUSBAU = 0', () => {
    const result = validateModuleInstall([], 'puls_laser_mk1', 9, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ausbau/i);
  });

  it('allows weapon in extra slot (slot 9) when AUSBAU >= 500', () => {
    const result = validateModuleInstall([], 'puls_laser_mk2', 9, acepWith1ExtraSlot);
    expect(result.valid).toBe(true);
  });

  it('rejects second shield if one already installed (unique)', () => {
    const existing: ShipModule[] = [
      { moduleId: 'schild_gen_mk1', slotIndex: 4, source: 'standard' },
    ];
    const result = validateModuleInstall(existing, 'schild_gen_mk2', 9, acepWith1ExtraSlot);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unique/i);
  });

  it('rejects second scanner if one already installed', () => {
    const existing: ShipModule[] = [
      { moduleId: 'scanner_mk1', slotIndex: 5, source: 'standard' },
    ];
    const result = validateModuleInstall(existing, 'scanner_mk2', 9, acepWith1ExtraSlot);
    expect(result.valid).toBe(false);
  });

  it('rejects install if slot already occupied', () => {
    const existing: ShipModule[] = [
      { moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard' },
    ];
    const result = validateModuleInstall(existing, 'puls_laser_mk2', 2, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/slot/i);
  });

  it('allows multiple weapon modules in different slots', () => {
    const existing: ShipModule[] = [
      { moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard' },
    ];
    // Second weapon in extra slot
    const result = validateModuleInstall(existing, 'puls_laser_mk2', 9, acepWith1ExtraSlot);
    expect(result.valid).toBe(true);
  });

  it('rejects unknown module', () => {
    const result = validateModuleInstall([], 'nonexistent_module', 0, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unbekannt/i);
  });
});
