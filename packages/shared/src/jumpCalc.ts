import {
  HYPERJUMP_BASE_AP, HYPERJUMP_AP_PER_SPEED, HYPERJUMP_MIN_AP,
  HYPERJUMP_FUEL_DIST_FACTOR, HYPERJUMP_FUEL_MAX_FACTOR,
  ENGINE_SPEED,
} from './constants.js';

export function calcHyperjumpAP(engineSpeed: number): number {
  return Math.max(
    HYPERJUMP_MIN_AP,
    HYPERJUMP_BASE_AP - (engineSpeed - 1) * HYPERJUMP_AP_PER_SPEED
  );
}

export function calcHyperjumpFuel(fuelPerJump: number, distance: number): number {
  const factor = Math.min(
    HYPERJUMP_FUEL_MAX_FACTOR,
    1.0 + (distance - 1) * HYPERJUMP_FUEL_DIST_FACTOR
  );
  return Math.ceil(fuelPerJump * factor);
}

export function getEngineSpeed(moduleId: string | null): number {
  return ENGINE_SPEED[moduleId ?? 'none'] ?? 1;
}
