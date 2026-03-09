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

  it('grants veteran at kampf >= 20', () => {
    expect(calculateTraits(xp({ kampf: 20 }))).toContain('veteran');
    expect(calculateTraits(xp({ kampf: 19 }))).not.toContain('veteran');
  });

  it('grants curious at intel >= 20', () => {
    expect(calculateTraits(xp({ intel: 20 }))).toContain('curious');
    expect(calculateTraits(xp({ intel: 19 }))).not.toContain('curious');
  });

  it('grants ancient-touched at explorer >= 15', () => {
    expect(calculateTraits(xp({ explorer: 15 }))).toContain('ancient-touched');
    expect(calculateTraits(xp({ explorer: 14 }))).not.toContain('ancient-touched');
  });

  it('grants reckless when kampf >= 15 and ausbau <= 5', () => {
    expect(calculateTraits(xp({ kampf: 15, ausbau: 5 }))).toContain('reckless');
    expect(calculateTraits(xp({ kampf: 15, ausbau: 6 }))).not.toContain('reckless');
    expect(calculateTraits(xp({ kampf: 14, ausbau: 0 }))).not.toContain('reckless');
  });

  it('grants cautious when ausbau >= 20 and kampf <= 5', () => {
    expect(calculateTraits(xp({ ausbau: 20, kampf: 5 }))).toContain('cautious');
    expect(calculateTraits(xp({ ausbau: 20, kampf: 6 }))).not.toContain('cautious');
    expect(calculateTraits(xp({ ausbau: 19, kampf: 0 }))).not.toContain('cautious');
  });

  it('grants scarred for tunnel-vision fighter', () => {
    // kampf=15, intel+ausbau+explorer must be <= 15*0.4 = 6
    expect(calculateTraits(xp({ kampf: 15, intel: 2, ausbau: 2, explorer: 2 }))).toContain('scarred');
    // kampf=10, others must be <= 4
    expect(calculateTraits(xp({ kampf: 10, intel: 5 }))).not.toContain('scarred');
  });

  it('can have multiple traits simultaneously', () => {
    const traits = calculateTraits(xp({ kampf: 25, intel: 22 }));
    expect(traits).toContain('veteran');
    expect(traits).toContain('curious');
  });

  it('reckless and veteran can coexist', () => {
    const traits = calculateTraits(xp({ kampf: 20, ausbau: 0 }));
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
