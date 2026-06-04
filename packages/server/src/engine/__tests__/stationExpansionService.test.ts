import { describe, it, expect } from 'vitest';
import type { StationExpansionType } from '@void-sector/shared';
import { validateExpansionBuild } from '../stationExpansionService.js';

const baseStation = {
  level: 2, factory_level: 0, cargo_level: 0, markt_level: 0,
  werft_level: 0, refinery_level: 0, sensor_level: 0,
  building_expansion: null as StationExpansionType | null,
};

describe('validateExpansionBuild', () => {
  it('allows a build when target level <= station level and not already building', () => {
    const r = validateExpansionBuild(baseStation, 'markt');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.targetLevel).toBe(1);
  });

  it('rejects when target level would exceed station tier', () => {
    const r = validateExpansionBuild({ ...baseStation, markt_level: 2 }, 'markt'); // target 3 > level 2
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TIER_LOCKED');
  });

  it('rejects when expansion already at max level 5', () => {
    const r = validateExpansionBuild({ ...baseStation, level: 5, markt_level: 5 }, 'markt');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MAX_LEVEL');
  });

  it('rejects when the station is already building something', () => {
    const r = validateExpansionBuild({ ...baseStation, building_expansion: 'cargo' }, 'markt');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('BUSY');
  });
});
