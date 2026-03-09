import type { SectorEnvironment, PlanetSubtype } from '@void-sector/shared';

export interface ResourceYield {
  ore: { min: number; max: number };
  gas: { min: number; max: number };
  crystal: { min: number; max: number };
  exotic: { min: number; max: number; chance: number };
  respawnHours: number | null; // null = permanent
}

/**
 * Returns resource yield ranges for a given environment + planet subtype.
 * Based on P2 design doc resource reference table.
 */
export function getResourceYield(
  environment: SectorEnvironment,
  planetSubtype?: PlanetSubtype | null,
): ResourceYield {
  if (environment === 'planet' && planetSubtype) {
    return getPlanetYield(planetSubtype);
  }

  switch (environment) {
    case 'asteroid':
      return {
        ore: { min: 50, max: 100 },
        gas: { min: 5, max: 10 },
        crystal: { min: 8, max: 15 },
        exotic: { min: 0, max: 1, chance: 0.005 },
        respawnHours: 1,
      };
    case 'nebula':
      return {
        ore: { min: 10, max: 30 },
        gas: { min: 15, max: 35 },
        crystal: { min: 5, max: 12 },
        exotic: { min: 0, max: 0, chance: 0 },
        respawnHours: 6,
      };
    case 'empty':
    default:
      return {
        ore: { min: 20, max: 50 },
        gas: { min: 2, max: 8 },
        crystal: { min: 3, max: 10 },
        exotic: { min: 0, max: 0, chance: 0 },
        respawnHours: 2,
      };
  }
}

/**
 * Returns resource yields for meteor content (main exotic source, temporary).
 */
export function getMeteorYield(): ResourceYield {
  return {
    ore: { min: 20, max: 50 },
    gas: { min: 2, max: 5 },
    crystal: { min: 3, max: 8 },
    exotic: { min: 15, max: 40, chance: 0.35 },
    respawnHours: 2,
  };
}

function getPlanetYield(subtype: PlanetSubtype): ResourceYield {
  switch (subtype) {
    case 'terrestrial':
      return {
        ore: { min: 100, max: 150 },
        gas: { min: 10, max: 20 },
        crystal: { min: 5, max: 10 },
        exotic: { min: 0, max: 1, chance: 0.01 },
        respawnHours: 4,
      };
    case 'water':
      return {
        ore: { min: 50, max: 80 },
        gas: { min: 40, max: 60 },
        crystal: { min: 3, max: 8 },
        exotic: { min: 0, max: 1, chance: 0.005 },
        respawnHours: 4,
      };
    case 'ice':
      return {
        ore: { min: 60, max: 100 },
        gas: { min: 20, max: 30 },
        crystal: { min: 8, max: 15 },
        exotic: { min: 0, max: 2, chance: 0.01 },
        respawnHours: 6,
      };
    case 'lava':
      return {
        ore: { min: 80, max: 120 },
        gas: { min: 30, max: 50 },
        crystal: { min: 12, max: 25 },
        exotic: { min: 2, max: 5, chance: 0.04 },
        respawnHours: 8,
      };
    case 'exotic_a':
      return {
        ore: { min: 200, max: 300 },
        gas: { min: 10, max: 20 },
        crystal: { min: 5, max: 10 },
        exotic: { min: 50, max: 100, chance: 1 },
        respawnHours: 24,
      };
    case 'exotic_b':
      return {
        ore: { min: 20, max: 30 },
        gas: { min: 10, max: 20 },
        crystal: { min: 30, max: 50 },
        exotic: { min: 80, max: 150, chance: 1 },
        respawnHours: 24,
      };
    case 'exotic_c':
      return {
        ore: { min: 10, max: 20 },
        gas: { min: 20, max: 50 },
        crystal: { min: 20, max: 40 },
        exotic: { min: 100, max: 200, chance: 1 },
        respawnHours: 24,
      };
    default:
      return getPlanetYield('terrestrial');
  }
}

/**
 * Rolls an actual harvest amount from a yield range using a 0..1 rng value.
 */
export function rollYieldAmount(min: number, max: number, rng: number): number {
  return Math.floor(min + rng * (max - min));
}

/**
 * Determines if exotic resource drops this roll.
 */
export function rollExotic(exotic: ResourceYield['exotic'], rng: number): number {
  if (rng > exotic.chance) return 0;
  return rollYieldAmount(exotic.min, exotic.max, rng / exotic.chance);
}
