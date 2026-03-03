import { HULLS, MODULES } from './constants.js';
import type { HullType, ShipModule, ShipStats } from './types.js';

export function calculateShipStats(hullType: HullType, modules: ShipModule[]): ShipStats {
  const hull = HULLS[hullType];
  const stats: ShipStats = {
    fuelMax: hull.baseFuel,
    cargoCap: hull.baseCargo,
    jumpRange: hull.baseJumpRange,
    apCostJump: hull.baseApPerJump,
    hp: hull.baseHp,
    commRange: hull.baseCommRange,
    scannerLevel: hull.baseScannerLevel,
    damageMod: 1.0,
  };

  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.effects)) {
      if (key === 'damageMod') {
        stats.damageMod += value as number; // additive: 1.0 + (-0.25) = 0.75
      } else {
        (stats as any)[key] += value as number;
      }
    }
  }

  // Clamp minimums
  stats.apCostJump = Math.max(0.5, stats.apCostJump);
  stats.jumpRange = Math.max(1, stats.jumpRange);
  stats.damageMod = Math.max(0.25, stats.damageMod);

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
