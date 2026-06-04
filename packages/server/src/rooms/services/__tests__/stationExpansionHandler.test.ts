import { describe, it, expect } from 'vitest';
import { resolveExpansionBuild } from '../stationExpansionDecision.js';

const station = {
  level: 2, factory_level: 0, cargo_level: 0, markt_level: 0,
  werft_level: 0, refinery_level: 0, sensor_level: 0, building_expansion: null,
};

describe('resolveExpansionBuild', () => {
  it('returns the cost + target level when affordable and tier-allowed', () => {
    const r = resolveExpansionBuild(station, 'markt', {
      credits: 1000, cargo: { ore: 100, gas: 100, crystal: 100, artefact: 5 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.targetLevel).toBe(1);
      expect(r.cost).toEqual({ ore: 15, gas: 20, crystal: 10, credits: 300, artefact: 0 });
    }
  });

  it('fails with INSUFFICIENT when resources are short', () => {
    const r = resolveExpansionBuild(station, 'werft', {
      credits: 10, cargo: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INSUFFICIENT');
  });

  it('fails with TIER_LOCKED when target exceeds station level', () => {
    const r = resolveExpansionBuild({ ...station, markt_level: 2 }, 'markt', {
      credits: 99999, cargo: { ore: 999, gas: 999, crystal: 999, artefact: 999 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TIER_LOCKED');
  });
});
