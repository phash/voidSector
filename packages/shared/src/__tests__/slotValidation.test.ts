import { describe, it, expect } from 'vitest';
import { validateModuleInstall } from '../shipCalculator.js';
import type { ShipModule, AcepXpSnapshot } from '../types.js';

const noAcep: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0, defense: 0, trader: 0, miner: 0 };
const acepWithKampf2: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 2, explorer: 0, defense: 0, trader: 0, miner: 0 };
const acepWithDefense2: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0, defense: 2, trader: 0, miner: 0 };

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
    expect(result.error).toMatch(/generator/i);
  });

  it('rejects drive in weapon slot (slot 2)', () => {
    const result = validateModuleInstall([], 'ion_drive_mk1', 2, noAcep);
    expect(result.valid).toBe(false);
  });

  it('rejects defense module in specialized armor slot', () => {
    // slot 3 is armor; defense category doesn't match armor
    const result = validateModuleInstall([], 'punkt_verteidigung_mk2', 3, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/armor/i);
  });

  it('allows armor in extra DEF slot when defense path >= 2', () => {
    // defense path level 2 unlocks a DEF slot that allows armor/shield/defense_pv/defense_ecm
    // kampf path at 0 = no kampf slots; defense at 2 = 1 DEF slot at extra index 0 → slot 9
    const result = validateModuleInstall([], 'armor_plating_mk2', 9, acepWithDefense2);
    expect(result.valid).toBe(true);
  });

  it('rejects extra slot when no ACEP path levels', () => {
    const result = validateModuleInstall([], 'puls_laser_mk1', 9, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/freigeschaltet/i);
  });

  it('allows weapon in extra WPN slot (slot 9) when kampf path >= 2', () => {
    // kampf path level 2 unlocks first WPN slot at extra index 0 → slot 9
    const result = validateModuleInstall([], 'puls_laser_mk2', 9, acepWithKampf2);
    expect(result.valid).toBe(true);
  });

  it('allows second shield (shield is not unique)', () => {
    const existing: ShipModule[] = [
      { moduleId: 'schild_gen_mk1', slotIndex: 4, source: 'standard' },
    ];
    // defense path level 2 unlocks a DEF slot that allows shield
    const result = validateModuleInstall(existing, 'schild_gen_mk2', 9, acepWithDefense2);
    expect(result.valid).toBe(true);
  });

  it('allows second scanner (scanner is not unique)', () => {
    const existing: ShipModule[] = [
      { moduleId: 'scanner_mk1', slotIndex: 5, source: 'standard' },
    ];
    // explorer path level 3 unlocks an EXP slot that allows scanner
    const acepWithExplorer3: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 3, defense: 0, trader: 0, miner: 0 };
    const result = validateModuleInstall(existing, 'scanner_mk2', 9, acepWithExplorer3);
    expect(result.valid).toBe(true);
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
    // Second weapon in extra WPN slot (kampf path level 2 unlocks slot 9)
    const result = validateModuleInstall(existing, 'puls_laser_mk2', 9, acepWithKampf2);
    expect(result.valid).toBe(true);
  });

  it('rejects unknown module', () => {
    const result = validateModuleInstall([], 'nonexistent_module', 0, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unbekannt/i);
  });
});
