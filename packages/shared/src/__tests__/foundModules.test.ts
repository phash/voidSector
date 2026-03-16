import { describe, it, expect } from 'vitest';
import { MODULE_MAP, MODULE_DEFINITIONS } from '../moduleDefinitions.js';

describe('found modules', () => {
  it('rift_drive is found-only', () => {
    const mod = MODULE_MAP.get('rift_drive');
    expect(mod).toBeDefined();
    expect(mod!.isFoundOnly).toBe(true);
  });

  it('ancient_lance has higher ATK than puls_laser_mk3', () => {
    const lance = MODULE_MAP.get('ancient_lance')!;
    const laser = MODULE_MAP.get('puls_laser_mk3')!;
    expect(lance.stats['atk'] ?? 0).toBeGreaterThan(laser.stats['atk'] ?? 0);
  });

  it('void_drive is unique and found-only', () => {
    const mod = MODULE_MAP.get('void_drive')!;
    expect(mod.isUnique).toBe(true);
    expect(mod.isFoundOnly).toBe(true);
  });

  it('quantum_scanner is unique scanner', () => {
    const mod = MODULE_MAP.get('quantum_scanner')!;
    expect(mod.category).toBe('scanner');
    expect(mod.isUnique).toBe(true);
  });

  it('found-only modules exist', () => {
    const foundModules = MODULE_DEFINITIONS.filter((m) => m.isFoundOnly);
    expect(foundModules.length).toBeGreaterThan(0);
  });

  it('all modules have category defined', () => {
    for (const mod of MODULE_DEFINITIONS) {
      expect(mod.category, `${mod.id} missing category`).toBeTruthy();
    }
  });

  it('shield and scanner standard modules are not unique', () => {
    const shieldMk1 = MODULE_MAP.get('schild_gen_mk1')!;
    const scannerMk1 = MODULE_MAP.get('scanner_mk1')!;
    expect(shieldMk1.isUnique).toBe(false);
    expect(scannerMk1.isUnique).toBe(false);
  });
});
