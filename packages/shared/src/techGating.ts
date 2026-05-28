import { MODULE_DEFINITIONS, MODULE_MAP } from './moduleDefinitions.js';

export const RESEARCH_TIER_BASE_WISSEN = 15;

export function getResearchCost(targetTier: number): number {
  return RESEARCH_TIER_BASE_WISSEN * (targetTier - 1);
}

const MAX_TIER_BY_CATEGORY: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const def of MODULE_DEFINITIONS) {
    m[def.category] = Math.max(m[def.category] ?? 1, def.tier);
  }
  return m;
})();

export function getMaxTier(category: string): number {
  return MAX_TIER_BY_CATEGORY[category] ?? 1;
}

export function isModuleUnlocked(
  moduleId: string,
  categoryTiers: Record<string, number>,
  blueprints: string[],
): boolean {
  const def = MODULE_MAP.get(moduleId);
  if (!def) return false;
  if (def.isFoundOnly) return blueprints.includes(moduleId);
  const unlocked = categoryTiers[def.category] ?? 1;
  return def.tier <= unlocked;
}

/** True if a module is available at tier 1 (no research needed) and not blueprint-only. */
export function isModuleFreelyAvailable(moduleId: string): boolean {
  const def = MODULE_MAP.get(moduleId);
  if (!def) return false;
  return !def.isFoundOnly && def.tier === 1;
}
