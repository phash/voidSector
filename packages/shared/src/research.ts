import {
  MODULES,
  RESEARCH_LAB_TIER_FOR_MODULE_TIER,
  RESEARCH_LAB_NAMES,
  ARTEFACT_REQUIRED_BY_TIER,
} from './constants.js';
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
 * Validates whether a research can be started.
 *
 * @param moduleId      - Module to research
 * @param research      - Current ResearchState (includes wissen balance)
 * @param artefacts     - Player's typed artefacts: Record<ArtefactType, number>
 * @param labTier       - Player's current research lab tier (0 = no lab)
 * @param slot          - Research slot to use (1 or 2); slot 2 requires lab tier >= 3
 * @param factionTiers  - Optional faction tier map for faction-gated modules
 */
export function canStartResearch(
  moduleId: string,
  research: ResearchState,
  artefacts: Partial<Record<string, number>>,
  labTier: number,
  slot: 1 | 2 = 1,
  factionTiers?: Record<string, string>,
): { valid: boolean; error?: string } {
  const mod = MODULES[moduleId];
  if (!mod) return { valid: false, error: 'Unknown module' };
  if (!mod.researchCost) return { valid: false, error: 'Module does not require research' };
  if (isModuleUnlocked(moduleId, research)) return { valid: false, error: 'Already unlocked' };

  // Slot availability
  if (slot === 1 && research.activeResearch) {
    return { valid: false, error: 'Research slot 1 already busy' };
  }
  if (slot === 2) {
    if (labTier < 3) return { valid: false, error: 'Slot 2 requires Analysestation (Lab III+)' };
    if (research.activeResearch2) return { valid: false, error: 'Research slot 2 already busy' };
  }

  // Lab tier check
  const requiredLab = RESEARCH_LAB_TIER_FOR_MODULE_TIER[mod.tier] ?? mod.tier;
  if (labTier < requiredLab) {
    const labName = RESEARCH_LAB_NAMES[requiredLab] ?? `Lab ${requiredLab}`;
    const haveName = labTier > 0 ? (RESEARCH_LAB_NAMES[labTier] ?? `Lab ${labTier}`) : 'kein Labor';
    return { valid: false, error: `Requires ${labName} (you have: ${haveName})` };
  }

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

  // Artefact requirement (mandatory artefacts by module tier)
  const requiredCount = ARTEFACT_REQUIRED_BY_TIER[mod.tier] ?? 0;
  if (requiredCount > 0) {
    const artefactType = mod.category; // ArtefactType = ModuleCategory
    const playerHas = artefacts[artefactType] ?? 0;
    if (playerHas < requiredCount) {
      return {
        valid: false,
        error: `Requires ${requiredCount}× ${artefactType} artefact (you have ${playerHas})`,
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
