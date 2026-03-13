import { MODULES } from './constants.js';
import { getTechTreeEffects } from './techTreeEffects.js';

/** Returns true if a module is available without research (no researchCost) */
export function isModuleFreelyAvailable(moduleId: string): boolean {
  const mod = MODULES[moduleId];
  if (!mod) return false;
  return !mod.researchCost;
}

/** Returns true if a module is unlocked (freely available, blueprint, or tech-tree tier) */
export function isModuleUnlocked(
  moduleId: string,
  mod: { category: string; tier: number },
  researchedNodes: Record<string, number>,
  blueprints: string[],
): boolean {
  if (isModuleFreelyAvailable(moduleId)) return true;
  if (blueprints.includes(moduleId)) return true;

  // Check tech tree tier unlock
  const effects = getTechTreeEffects(researchedNodes);
  const branchForCategory = getCategoryBranch(mod.category);
  if (branchForCategory) {
    const unlockedTier = effects.unlockedTiers[branchForCategory] ?? 1;
    return mod.tier <= unlockedTier;
  }
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
