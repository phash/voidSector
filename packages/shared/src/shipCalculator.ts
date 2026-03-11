import {
  HULLS,
  MODULES,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
  ACEP_EXTRA_SLOT_THRESHOLDS,
} from './constants.js';
import type { HullType, ShipModule, ShipStats, AcepXpSnapshot } from './types.js';

/** Returns ACEP level (1–5) for a given XP value. */
export function getAcepLevel(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(ACEP_LEVEL_THRESHOLDS)) {
    if (xp >= threshold) {
      level = Number(lvl);
    }
  }
  return level;
}

/** Returns the number of extra slots unlocked based on ausbau XP. */
export function getExtraSlotCount(ausbauXp: number): number {
  return ACEP_EXTRA_SLOT_THRESHOLDS.filter((t) => ausbauXp >= t).length;
}

export function calculateShipStats(
  hullType: HullType,
  modules: ShipModule[],
  acepXp?: AcepXpSnapshot,
): ShipStats {
  const hull = HULLS[hullType];
  const stats: ShipStats = {
    fuelMax: hull.baseFuel,
    cargoCap: hull.baseCargo,
    jumpRange: hull.baseJumpRange,
    apCostJump: hull.baseApPerJump,
    fuelPerJump: hull.baseFuelPerJump,
    hp: hull.baseHp,
    commRange: hull.baseCommRange,
    scannerLevel: hull.baseScannerLevel,
    damageMod: 1.0,
    // Combat v2
    shieldHp: 0,
    shieldRegen: 0,
    weaponAttack: 0,
    weaponType: 'none',
    weaponPiercing: 0,
    pointDefense: 0,
    ecmReduction: 0,
    engineSpeed: hull.baseEngineSpeed,
    artefactChanceBonus: 0,
    safeSlotBonus: 0,
    // Hyperdrive
    hyperdriveRange: hull.baseHyperdriveRange,
    hyperdriveSpeed: hull.baseHyperdriveSpeed,
    hyperdriveRegen: hull.baseHyperdriveRegen,
    hyperdriveFuelEfficiency: hull.baseHyperdriveFuelEfficiency,
    miningBonus: 0,
  };

  // Pre-compute ACEP levels per path
  const levels: Record<string, number> = acepXp
    ? {
        ausbau: getAcepLevel(acepXp.ausbau),
        intel: getAcepLevel(acepXp.intel),
        kampf: getAcepLevel(acepXp.kampf),
        explorer: getAcepLevel(acepXp.explorer),
      }
    : {};

  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def) continue;

    // Determine multiplier: highest level among module's ACEP paths
    const modPaths = def.acepPaths ?? [];
    const multiplier =
      modPaths.length > 0 && acepXp
        ? Math.max(...modPaths.map((p) => ACEP_LEVEL_MULTIPLIERS[levels[p]] ?? 1.0))
        : 1.0;

    for (const [key, value] of Object.entries(def.effects)) {
      if (typeof value !== 'number') {
        // e.g. weaponType — not a number, assign directly
        (stats as any)[key] = value;
        continue;
      }
      if (key === 'damageMod') {
        // damageMod is always additive, never multiplied
        stats.damageMod += value;
      } else {
        // Positive values are multiplied by ACEP multiplier; negatives are not
        (stats as any)[key] += value > 0 ? value * multiplier : value;
      }
    }
  }

  // Clamp minimums
  stats.apCostJump = Math.max(0.5, stats.apCostJump);
  stats.jumpRange = Math.max(1, stats.jumpRange);
  stats.damageMod = Math.max(0.25, stats.damageMod);
  stats.engineSpeed = Math.max(1, Math.min(5, stats.engineSpeed));
  stats.hyperdriveFuelEfficiency = Math.max(0, Math.min(1, stats.hyperdriveFuelEfficiency));

  return stats;
}

export function validateModuleInstall(
  hullType: HullType,
  currentModules: ShipModule[],
  moduleId: string,
  slotIndex: number,
): { valid: boolean; error?: string } {
  const hull = HULLS[hullType];
  const moduleDef = MODULES[moduleId];
  if (!moduleDef) return { valid: false, error: 'Unknown module' };
  if (slotIndex < 0 || slotIndex >= hull.slots) return { valid: false, error: 'Invalid slot' };
  if (currentModules.some((m) => m.slotIndex === slotIndex)) {
    return { valid: false, error: 'Slot occupied' };
  }
  return { valid: true };
}
