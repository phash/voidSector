import { describe, it, expect } from 'vitest';
import { ARTEFACT_TYPES } from '@void-sector/shared';
import { getArtefactTypeForSeed } from '../engine/scanEvents.js';

describe('getArtefactTypeForSeed', () => {
  it('returns a valid ArtefactType', () => {
    for (let seed = 0; seed < 20; seed++) {
      const type = getArtefactTypeForSeed(seed);
      expect(ARTEFACT_TYPES).toContain(type);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(getArtefactTypeForSeed(42)).toBe(getArtefactTypeForSeed(42));
    expect(getArtefactTypeForSeed(999)).toBe(getArtefactTypeForSeed(999));
  });

  it('produces varied types across different seeds', () => {
    const types = new Set(Array.from({ length: 50 }, (_, i) => getArtefactTypeForSeed(i * 7)));
    expect(types.size).toBeGreaterThan(5);
  });
});
