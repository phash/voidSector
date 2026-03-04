import { HULLS, MODULES } from './constants.js';
import type { HullType, ShipModule, ShipStats } from './types.js';

export function calculateShipStats(hullType: HullType, modules: ShipModule[]): ShipStats {
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
  };

  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.effects)) {
      if (key === 'damageMod') {
        stats.damageMod += value as number;
      } else if (key === 'weaponType') {
        stats.weaponType = value as ShipStats['weaponType'];
      } else {
        (stats as any)[key] += value as number;
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
  hullType: HullType, currentModules: ShipModule[], moduleId: string, slotIndex: number
): { valid: boolean; error?: string } {
  const hull = HULLS[hullType];
  const moduleDef = MODULES[moduleId];
  if (!moduleDef) return { valid: false, error: 'Unknown module' };
  if (slotIndex < 0 || slotIndex >= hull.slots) return { valid: false, error: 'Invalid slot' };
  if (currentModules.some(m => m.slotIndex === slotIndex)) {
    return { valid: false, error: 'Slot occupied' };
  }
  return { valid: true };
}
