import {
  HYPERJUMP_BASE_AP,
  HYPERJUMP_AP_PER_SPEED,
  HYPERJUMP_MIN_AP,
  HYPERJUMP_FUEL_DIST_FACTOR,
  HYPERJUMP_FUEL_MAX_FACTOR,
  ENGINE_SPEED,
} from './constants.js';

export function calcHyperjumpAP(engineSpeed: number): number {
  return Math.max(HYPERJUMP_MIN_AP, HYPERJUMP_BASE_AP - (engineSpeed - 1) * HYPERJUMP_AP_PER_SPEED);
}

export function calcHyperjumpFuel(fuelPerJump: number, distance: number): number {
  const factor = Math.min(
    HYPERJUMP_FUEL_MAX_FACTOR,
    1.0 + (distance - 1) * HYPERJUMP_FUEL_DIST_FACTOR,
  );
  return Math.ceil(fuelPerJump * factor);
}

/**
 * V2 fuel formula (#291): only hyperjumps cost fuel.
 * cost = ceil(BASE_FUEL_PER_JUMP * distance * (1 - driveEfficiency))
 * @param baseFuelPerSector  BASE_FUEL_PER_JUMP (100)
 * @param distance           sector distance of hyperjump
 * @param driveEfficiency    0..1 — better drives reduce cost (0 = no reduction)
 */
export function calcHyperjumpFuelV2(
  baseFuelPerSector: number,
  distance: number,
  driveEfficiency: number,
): number {
  const clampedEfficiency = Math.max(0, Math.min(1, driveEfficiency));
  return Math.max(
    1,
    Math.ceil(baseFuelPerSector * distance * (1 - clampedEfficiency)),
  );
}

export function getEngineSpeed(moduleId: string | null): number {
  return ENGINE_SPEED[moduleId ?? 'none'] ?? 1;
}
