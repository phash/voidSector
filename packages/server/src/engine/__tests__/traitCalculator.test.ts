import { describe, it, expect } from 'vitest';
import { calculateTraits, dominantTrait } from '../traitCalculator.js';
import type { AcepXpSummary } from '../acepXpService.js';

function xp(overrides: Partial<AcepXpSummary> = {}): AcepXpSummary {
  const base = { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0, ...overrides };
  base.total = base.ausbau + base.intel + base.kampf + base.explorer;
  return base;
}

describe('calculateTraits', () => {
  it('returns empty array for a fresh ship', () => {
    expect(calculateTraits(xp())).toEqual([]);
  });

  // Thresholds are on the ACEP path LEVEL scale (0-10) since #523/#524.
  it('grants veteran at kampf level >= 7', () => {
    expect(calculateTraits(xp({ kampf: 7 }))).toContain('veteran');
    expect(calculateTraits(xp({ kampf: 6 }))).not.toContain('veteran');
  });

  it('grants curious at intel level >= 7', () => {
    expect(calculateTraits(xp({ intel: 7 }))).toContain('curious');
    expect(calculateTraits(xp({ intel: 6 }))).not.toContain('curious');
  });

  it('grants ancient-touched at explorer level >= 5', () => {
    expect(calculateTraits(xp({ explorer: 5 }))).toContain('ancient-touched');
    expect(calculateTraits(xp({ explorer: 4 }))).not.toContain('ancient-touched');
  });

  it('grants reckless when kampf >= 5 and ausbau <= 2', () => {
    expect(calculateTraits(xp({ kampf: 5, ausbau: 2 }))).toContain('reckless');
    expect(calculateTraits(xp({ kampf: 5, ausbau: 3 }))).not.toContain('reckless');
    expect(calculateTraits(xp({ kampf: 4, ausbau: 0 }))).not.toContain('reckless');
  });

  it('grants cautious when ausbau >= 7 and kampf <= 2', () => {
    expect(calculateTraits(xp({ ausbau: 7, kampf: 2 }))).toContain('cautious');
    expect(calculateTraits(xp({ ausbau: 7, kampf: 3 }))).not.toContain('cautious');
    expect(calculateTraits(xp({ ausbau: 6, kampf: 0 }))).not.toContain('cautious');
  });

  it('grants scarred for tunnel-vision fighter', () => {
    // kampf=10, intel+ausbau+explorer must be <= 10*0.4 = 4
    expect(calculateTraits(xp({ kampf: 10, intel: 1, ausbau: 1, explorer: 1 }))).toContain(
      'scarred',
    );
    // kampf=10, others sum 5 > 4
    expect(calculateTraits(xp({ kampf: 10, intel: 5 }))).not.toContain('scarred');
  });

  it('can have multiple traits simultaneously', () => {
    const traits = calculateTraits(xp({ kampf: 8, intel: 8 }));
    expect(traits).toContain('veteran');
    expect(traits).toContain('curious');
  });

  it('reckless and veteran can coexist', () => {
    const traits = calculateTraits(xp({ kampf: 7, ausbau: 0 }));
    expect(traits).toContain('veteran');
    expect(traits).toContain('reckless');
  });
});

describe('dominantTrait', () => {
  it('returns null for no traits', () => {
    expect(dominantTrait([])).toBeNull();
  });

  it('ancient-touched has highest priority', () => {
    expect(dominantTrait(['veteran', 'curious', 'ancient-touched'])).toBe('ancient-touched');
  });

  it('veteran beats curious', () => {
    expect(dominantTrait(['curious', 'veteran'])).toBe('veteran');
  });

  it('returns sole trait', () => {
    expect(dominantTrait(['cautious'])).toBe('cautious');
  });
});
