import { describe, it, expect } from 'vitest';
import {
  getConfig,
  applyConfigValue,
  snapshotDefaults,
  getDefaultValue,
} from '../gameConfigApply.js';

describe('gameConfigApply getConfig fallback chain (SP5)', () => {
  it('returns undefined for a key in neither cache nor defaults', () => {
    expect(getConfig('TOTALLY_UNKNOWN_KEY_XYZ')).toBeUndefined();
  });

  it('applyConfigValue puts a scalar in the runtime cache, getConfig reads it', () => {
    applyConfigValue('MINING_RATE_PER_SECOND', 3.5);
    expect(getConfig('MINING_RATE_PER_SECOND')).toBe(3.5);
  });

  it('snapshotDefaults populates defaults from the seed; getConfig falls back to them', () => {
    snapshotDefaults();
    // A seeded scalar that has NOT been overridden resolves to its default.
    const def = getDefaultValue('STATION_BASE_HP');
    expect(def).toBeDefined();
    expect(getConfig('STATION_BASE_HP')).toBe(def);
  });
});
