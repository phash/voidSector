import { describe, it, expect } from 'vitest';
import { MODULES } from '../constants.js';

describe('found modules', () => {
  it('pulse_drive is found-only with drawback', () => {
    expect(MODULES['pulse_drive']).toBeDefined();
    expect(MODULES['pulse_drive'].isFoundOnly).toBe(true);
    expect(MODULES['pulse_drive'].drawbacks?.length).toBeGreaterThan(0);
  });

  it('ancient_lance has higher ATK than laser_mk3', () => {
    const lance = MODULES['ancient_lance'].effects.weaponAttack ?? 0;
    const laser = MODULES['laser_mk3'].effects.weaponAttack ?? 0;
    expect(lance).toBeGreaterThan(laser);
  });

  it('mirror_shield is unique and found-only', () => {
    expect(MODULES['mirror_shield'].isUnique).toBe(true);
    expect(MODULES['mirror_shield'].isFoundOnly).toBe(true);
  });

  it('deep_whisper is unique scanner', () => {
    expect(MODULES['deep_whisper'].category).toBe('scanner');
    expect(MODULES['deep_whisper'].isUnique).toBe(true);
  });

  it('all found modules have drawbacks defined', () => {
    const foundModules = Object.values(MODULES).filter((m) => m.isFoundOnly);
    expect(foundModules.length).toBe(31);
    for (const mod of foundModules) {
      expect(mod.drawbacks, `${mod.id} missing drawbacks`).toBeDefined();
      expect(mod.drawbacks!.length, `${mod.id} drawbacks empty`).toBeGreaterThan(0);
    }
  });

  it('all modules have acepPaths defined', () => {
    for (const mod of Object.values(MODULES)) {
      expect(mod.acepPaths, `${mod.id} missing acepPaths`).toBeDefined();
      expect(mod.acepPaths!.length, `${mod.id} acepPaths empty`).toBeGreaterThan(0);
    }
  });

  it('shield and scanner standard modules are unique', () => {
    expect(MODULES['shield_mk1'].isUnique).toBe(true);
    expect(MODULES['scanner_mk1'].isUnique).toBe(true);
  });
});
