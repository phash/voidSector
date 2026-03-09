import type { SectorEnvironment } from '@void-sector/shared';
import { isTraversable } from '@void-sector/shared';

export type FirstBaseValidationError =
  | 'IMPASSABLE_SECTOR'
  | 'NEBULA_FORBIDDEN'
  | 'ACTIVE_PIRATES'
  | 'ALREADY_HAS_BASE'
  | 'SECTOR_OCCUPIED';

export interface FirstBaseValidationResult {
  valid: boolean;
  error?: FirstBaseValidationError;
  message?: string;
}

export interface FirstBaseContext {
  /** Environment of the target sector */
  environment: SectorEnvironment;
  /** True if sector has an active pirate_zone content that hasn't been defeated */
  hasActivePirates: boolean;
  /** True if player already owns a starter base */
  playerHasStarterBase: boolean;
  /** True if another player's base is in this sector */
  sectorOccupied: boolean;
}

/**
 * Validates whether a player can place their first (free) base in the given sector.
 * Checks: impassable environment, nebula restriction, pirate presence,
 * existing starter base, and sector occupation.
 */
export function validateFirstBasePlacement(ctx: FirstBaseContext): FirstBaseValidationResult {
  if (!isTraversable(ctx.environment)) {
    return {
      valid: false,
      error: 'IMPASSABLE_SECTOR',
      message: 'Sektoren mit Sternen oder Schwarzen Löchern sind nicht begehbar.',
    };
  }

  if (ctx.environment === 'nebula') {
    return {
      valid: false,
      error: 'NEBULA_FORBIDDEN',
      message: 'Erste Basis kann nicht in einem Nebel errichtet werden.',
    };
  }

  if (ctx.hasActivePirates) {
    return {
      valid: false,
      error: 'ACTIVE_PIRATES',
      message: 'Piraten müssen zuerst besiegt werden oder wähle einen anderen Sektor.',
    };
  }

  if (ctx.playerHasStarterBase) {
    return {
      valid: false,
      error: 'ALREADY_HAS_BASE',
      message: 'Du hast bereits eine Startbasis.',
    };
  }

  if (ctx.sectorOccupied) {
    return {
      valid: false,
      error: 'SECTOR_OCCUPIED',
      message: 'Dieser Sektor wird bereits von einem anderen Spieler genutzt.',
    };
  }

  return { valid: true };
}

/**
 * Returns the cost of placing the first base (always 0 — free placement).
 */
export function getFirstBaseCost(): Record<string, number> {
  return { ore: 0, gas: 0, crystal: 0, credits: 0 };
}

/**
 * Returns the best sector types for base placement (informational for UI hints).
 */
export function getRecommendedBaseEnvironments(): SectorEnvironment[] {
  return ['empty', 'planet', 'asteroid'];
}
