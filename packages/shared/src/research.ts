import { MODULES } from './constants.js';
import type { ResearchState } from './types.js';

/** Returns true if a module is available without research (no researchCost) */
export function isModuleFreelyAvailable(moduleId: string): boolean {
  const mod = MODULES[moduleId];
  if (!mod) return false;
  return !mod.researchCost;
}

/** Returns true if a module is unlocked (researched, blueprint, or freely available) */
export function isModuleUnlocked(moduleId: string, research: ResearchState): boolean {
  if (isModuleFreelyAvailable(moduleId)) return true;
  return research.unlockedModules.includes(moduleId) || research.blueprints.includes(moduleId);
}

/**
 * @deprecated Old research validation — replaced by TechTreeService.
 * Kept temporarily for client compatibility; will be removed in a future cleanup.
 */
export function canStartResearch(
  moduleId: string,
  research: ResearchState,
  artefacts: Partial<Record<string, number>>,
  labTier?: number,
  slot?: 1 | 2,
  factionTiers?: Record<string, string>,
): { valid: boolean; error?: string } {
  const mod = MODULES[moduleId];
  if (!mod) return { valid: false, error: 'Unknown module' };
  if (!mod.researchCost) return { valid: false, error: 'Module does not require research' };
  if (isModuleUnlocked(moduleId, research)) return { valid: false, error: 'Already unlocked' };

  // Prerequisite
  if (mod.prerequisite && !isModuleUnlocked(mod.prerequisite, research)) {
    return {
      valid: false,
      error: `Prerequisite not met: ${MODULES[mod.prerequisite]?.name ?? mod.prerequisite}`,
    };
  }

  // Faction requirement
  if (mod.factionRequirement) {
    const playerTier = factionTiers?.[mod.factionRequirement.factionId];
    if (!playerTier || !meetsMinTier(playerTier, mod.factionRequirement.minTier)) {
      return {
        valid: false,
        error: `Faction requirement: ${mod.factionRequirement.factionId} ${mod.factionRequirement.minTier}`,
      };
    }
  }

  // Wissen check
  const rc = mod.researchCost;
  if ((research.wissen ?? 0) < rc.wissen) {
    return {
      valid: false,
      error: `Not enough Wissen (need ${rc.wissen}, have ${research.wissen ?? 0})`,
    };
  }

  return { valid: true };
}

const TIER_ORDER = ['hostile', 'unfriendly', 'neutral', 'friendly', 'honored'];

function meetsMinTier(current: string, required: string): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}
