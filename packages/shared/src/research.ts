import { MODULES } from './constants.js';
import { getTechTreeEffects } from './techTreeEffects.js';

/** Returns true if a module is available without research (no researchCost) */
export function isModuleFreelyAvailable(moduleId: string): boolean {
  const mod = MODULES[moduleId];
  if (!mod) return false;
  return !mod.researchCost;
}

/** Returns true if a module is unlocked (freely available, blueprint + tier, or tech-tree tier) */
export function isModuleUnlocked(
  moduleId: string,
  mod: { category: string; tier: number },
  researchedNodes: Record<string, number>,
  blueprints: string[],
): boolean {
  if (isModuleFreelyAvailable(moduleId)) return true;

  const hasBP = blueprints.includes(moduleId);
  const branchForCategory = getCategoryBranch(mod.category);

  // Special-category modules have no tech-tree branch — blueprint is the only path
  if (!branchForCategory) return hasBP;

  // Check tech tree tier unlock
  const effects = getTechTreeEffects(researchedNodes);
  const unlockedTier = effects.unlockedTiers[branchForCategory] ?? 1;
  const tierSatisfied = mod.tier <= unlockedTier;

  // Blueprint grants recipe but still requires the tier to be unlocked
  if (hasBP && tierSatisfied) return true;

  // Full tech-tree unlock (tier satisfied via branch research)
  if (tierSatisfied) return true;

  return false;
}

/** Map module category to tech tree branch */
function getCategoryBranch(category: string): string | undefined {
  const mapping: Record<string, string | undefined> = {
    weapon: 'kampf',
    shield: 'ausbau',
    armor: 'ausbau',
    defense: 'ausbau',
    cargo: 'ausbau',
    mining: 'ausbau',
    scanner: 'intel',
    drive: 'explorer',
    generator: 'ausbau',
    special: undefined,
    repair: 'ausbau',
  };
  return mapping[category];
}
