import { describe, it, expect } from 'vitest';
import { ARTEFACT_TYPE_FOR_CATEGORY } from '../types.js';
import { ACEP_PATH_SLOT_UNLOCKS } from '../constants.js';

describe('computer slot & category integration', () => {
  it('maps the computer category to itself in ARTEFACT_TYPE_FOR_CATEGORY', () => {
    expect(ARTEFACT_TYPE_FOR_CATEGORY.computer).toBe('computer');
  });

  it('allows the computer category in every AUSBAU extra slot', () => {
    const ausbau = ACEP_PATH_SLOT_UNLOCKS.filter((s) => s.path === 'ausbau');
    expect(ausbau.length).toBeGreaterThan(0);
    for (const slot of ausbau) {
      expect(slot.categories).toContain('computer');
    }
  });
});
