import { getMaxTier, getResearchCost } from '@void-sector/shared';

export interface ResearchTierPlan { ok: boolean; nextTier?: number; cost?: number; error?: string; }

/** Pure: decide whether the next tier of a category can be researched. */
export function planCategoryResearch(
  category: string,
  currentTiers: Record<string, number>,
  wissen: number,
): ResearchTierPlan {
  const max = getMaxTier(category);
  const current = currentTiers[category] ?? 1;
  if (max <= 1) return { ok: false, error: 'Kategorie hat keine höheren Tiers' };
  if (current >= max) return { ok: false, error: 'Maximales Tier erreicht' };
  const nextTier = current + 1;
  const cost = getResearchCost(nextTier);
  if (wissen < cost) return { ok: false, error: `Nicht genug Wissen (${cost} benötigt)` };
  return { ok: true, nextTier, cost };
}
