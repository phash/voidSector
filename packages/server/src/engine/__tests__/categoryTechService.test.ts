import { describe, it, expect } from 'vitest';
import { planCategoryResearch } from '../categoryTechService.js';
import { getMaxTier } from '@void-sector/shared';

describe('planCategoryResearch', () => {
  it('plans tier 2 from default with enough Wissen', () => {
    expect(planCategoryResearch('weapon_energy', {}, 100)).toMatchObject({ ok: true, nextTier: 2, cost: 15 });
  });
  it('rejects when Wissen is insufficient', () => {
    expect(planCategoryResearch('weapon_energy', {}, 5).ok).toBe(false);
  });
  it('rejects at max tier', () => {
    const max = getMaxTier('weapon_energy');
    expect(planCategoryResearch('weapon_energy', { weapon_energy: max }, 9999).ok).toBe(false);
  });
});
