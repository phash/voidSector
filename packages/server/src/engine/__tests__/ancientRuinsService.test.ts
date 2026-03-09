import { describe, it, expect } from 'vitest';
import {
  ANCIENT_LORE_FRAGMENTS,
  ANCIENT_RUIN_FRAGMENT_COUNT,
  RUIN_ARTEFACT_CHANCE,
  getRuinFragmentIndex,
  getRuinLevel,
  resolveAncientRuinScan,
} from '../ancientRuinsService.js';

describe('ANCIENT_LORE_FRAGMENTS', () => {
  it('has 24 fragments', () => {
    expect(ANCIENT_LORE_FRAGMENTS).toHaveLength(24);
    expect(ANCIENT_RUIN_FRAGMENT_COUNT).toBe(24);
  });

  it('each fragment is a non-empty string', () => {
    for (const frag of ANCIENT_LORE_FRAGMENTS) {
      expect(typeof frag).toBe('string');
      expect(frag.length).toBeGreaterThan(0);
    }
  });
});

describe('getRuinFragmentIndex', () => {
  it('returns an index within valid range', () => {
    for (let x = 0; x < 200; x += 13) {
      const idx = getRuinFragmentIndex(x, x * 3 + 7, 12345);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(ANCIENT_RUIN_FRAGMENT_COUNT);
    }
  });

  it('is deterministic — same input produces same output', () => {
    const a = getRuinFragmentIndex(42, 99, 99999);
    const b = getRuinFragmentIndex(42, 99, 99999);
    expect(a).toBe(b);
  });

  it('produces different indices for different sectors', () => {
    const indices = new Set<number>();
    for (let x = 0; x < 500; x += 7) {
      indices.add(getRuinFragmentIndex(x, x + 3, 12345));
    }
    // Should get more than 1 unique index across 71 sectors
    expect(indices.size).toBeGreaterThan(1);
  });
});

describe('getRuinLevel', () => {
  it('returns only valid levels (1, 2, or 3)', () => {
    for (let x = 0; x < 1000; x += 7) {
      const level = getRuinLevel(x, x * 2 + 5, 99999);
      expect([1, 2, 3]).toContain(level);
    }
  });

  it('is deterministic — same input produces same output', () => {
    const a = getRuinLevel(42, 99, 99999);
    const b = getRuinLevel(42, 99, 99999);
    expect(a).toBe(b);
  });

  it('level 1 is most common (~60%), level 3 is rarest (~10%)', () => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    const N = 10000;
    for (let x = 0; x < N; x++) {
      const level = getRuinLevel(x, x * 3 + 7, 12345);
      counts[level]++;
    }
    // Level 1: expect ~60% ± 5%
    expect(counts[1] / N).toBeGreaterThan(0.55);
    expect(counts[1] / N).toBeLessThan(0.65);
    // Level 2: expect ~30% ± 5%
    expect(counts[2] / N).toBeGreaterThan(0.25);
    expect(counts[2] / N).toBeLessThan(0.35);
    // Level 3: expect ~10% ± 5%
    expect(counts[3] / N).toBeGreaterThan(0.05);
    expect(counts[3] / N).toBeLessThan(0.15);
  });
});

describe('RUIN_ARTEFACT_CHANCE', () => {
  it('has chances for all levels', () => {
    expect(RUIN_ARTEFACT_CHANCE[1]).toBe(0.05);
    expect(RUIN_ARTEFACT_CHANCE[2]).toBe(0.12);
    expect(RUIN_ARTEFACT_CHANCE[3]).toBe(0.25);
  });

  it('higher level means higher chance', () => {
    expect(RUIN_ARTEFACT_CHANCE[3]).toBeGreaterThan(RUIN_ARTEFACT_CHANCE[2]);
    expect(RUIN_ARTEFACT_CHANCE[2]).toBeGreaterThan(RUIN_ARTEFACT_CHANCE[1]);
  });
});

describe('resolveAncientRuinScan', () => {
  it('returns valid result structure', () => {
    const result = resolveAncientRuinScan(42, 99, 12345, 67890);
    expect(typeof result.fragmentIndex).toBe('number');
    expect(typeof result.fragmentText).toBe('string');
    expect([1, 2, 3]).toContain(result.ruinLevel);
    expect(typeof result.artefactFound).toBe('boolean');
  });

  it('fragmentText matches ANCIENT_LORE_FRAGMENTS[fragmentIndex]', () => {
    const result = resolveAncientRuinScan(10, 20, 12345, 0);
    expect(result.fragmentText).toBe(ANCIENT_LORE_FRAGMENTS[result.fragmentIndex]);
  });

  it('fragment index is within valid range', () => {
    for (let x = 0; x < 200; x += 11) {
      const result = resolveAncientRuinScan(x, x + 7, 12345, x * 31);
      expect(result.fragmentIndex).toBeGreaterThanOrEqual(0);
      expect(result.fragmentIndex).toBeLessThan(ANCIENT_RUIN_FRAGMENT_COUNT);
    }
  });

  it('same sector always gives same fragment and level (deterministic)', () => {
    const a = resolveAncientRuinScan(42, 99, 12345, 111);
    const b = resolveAncientRuinScan(42, 99, 12345, 222);
    // fragmentIndex and ruinLevel are world-seed based, scanSeed only affects artefact
    expect(a.fragmentIndex).toBe(b.fragmentIndex);
    expect(a.ruinLevel).toBe(b.ruinLevel);
  });

  it('artefact found when scanSeed produces roll below chance threshold', () => {
    // seed = 0xdeadbeef → XOR gives 0 → roll = 0 → artefact always found (any level)
    const seedWithArtefact = 0xdeadbeef;
    // seed = 0 → XOR gives 0xdeadbeef → roll ≈ 0.87 → no artefact (any level)
    const seedWithoutArtefact = 0;
    const withArtefact = resolveAncientRuinScan(42, 99, 12345, seedWithArtefact);
    const withoutArtefact = resolveAncientRuinScan(42, 99, 12345, seedWithoutArtefact);
    expect(withArtefact.artefactFound).toBe(true);
    expect(withoutArtefact.artefactFound).toBe(false);
  });
});
