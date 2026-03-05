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

/** Checks if research can be started for a module */
export function canStartResearch(
  moduleId: string,
  research: ResearchState,
  resources: { credits: number; ore: number; gas: number; crystal: number; artefact: number },
  factionTiers?: Record<string, string>,
): { valid: boolean; error?: string } {
  const mod = MODULES[moduleId];
  if (!mod) return { valid: false, error: 'Unknown module' };
  if (!mod.researchCost) return { valid: false, error: 'Module does not require research' };
  if (isModuleUnlocked(moduleId, research)) return { valid: false, error: 'Already unlocked' };
  if (research.activeResearch) return { valid: false, error: 'Research already in progress' };

  // Check prerequisite
  if (mod.prerequisite && !isModuleUnlocked(mod.prerequisite, research)) {
    return {
      valid: false,
      error: `Prerequisite not met: ${MODULES[mod.prerequisite]?.name ?? mod.prerequisite}`,
    };
  }

  // Check faction requirement
  if (mod.factionRequirement) {
    const playerTier = factionTiers?.[mod.factionRequirement.factionId];
    if (!playerTier || !meetsMinTier(playerTier, mod.factionRequirement.minTier)) {
      return {
        valid: false,
        error: `Faction requirement: ${mod.factionRequirement.factionId} ${mod.factionRequirement.minTier}`,
      };
    }
  }

  // Check resources
  const cost = mod.researchCost;
  if (resources.credits < cost.credits) return { valid: false, error: 'Not enough credits' };
  if ((cost.ore ?? 0) > resources.ore) return { valid: false, error: 'Not enough ore' };
  if ((cost.gas ?? 0) > resources.gas) return { valid: false, error: 'Not enough gas' };
  if ((cost.crystal ?? 0) > resources.crystal) return { valid: false, error: 'Not enough crystal' };
  if ((cost.artefact ?? 0) > resources.artefact)
    return { valid: false, error: 'Not enough artefacts' };

  return { valid: true };
}

const TIER_ORDER = ['hostile', 'unfriendly', 'neutral', 'friendly', 'honored'];

function meetsMinTier(current: string, required: string): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}
