/**
 * ACEP Trait Calculator
 * Derives personality traits from a ship's XP distribution.
 * Traits are stored as a string array in ships.acep_traits.
 */

import type { AcepXpSummary } from './acepXpService.js';

export type AcepTrait =
  | 'veteran'       // Combat-hardened — high kampf XP
  | 'curious'       // Constantly scanning — high intel XP
  | 'reckless'      // Fighter, ignores logistics — high kampf, low ausbau
  | 'cautious'      // Builder, avoids conflict — high ausbau, low kampf
  | 'ancient-touched' // Has discovered ruins — high explorer XP
  | 'scarred';      // Mostly combat, little else — tunnel-vision fighter

/**
 * Derive a ship's trait set from its current XP summary.
 * A ship can have multiple traits simultaneously.
 */
export function calculateTraits(xp: AcepXpSummary): AcepTrait[] {
  const traits: AcepTrait[] = [];

  if (xp.kampf >= 20) {
    traits.push('veteran');
  }

  if (xp.intel >= 20) {
    traits.push('curious');
  }

  if (xp.explorer >= 15) {
    traits.push('ancient-touched');
  }

  // Reckless: heavy fighter who doesn't build
  if (xp.kampf >= 15 && xp.ausbau <= 5) {
    traits.push('reckless');
  }

  // Cautious: builder who avoids combat
  if (xp.ausbau >= 20 && xp.kampf <= 5) {
    traits.push('cautious');
  }

  // Scarred: mostly combat, almost nothing else (tunnel-vision)
  if (xp.kampf >= 10 && (xp.intel + xp.ausbau + xp.explorer) <= xp.kampf * 0.4) {
    traits.push('scarred');
  }

  return traits;
}

/**
 * Pick the dominant trait for personality tone selection.
 * Priority order: ancient-touched > veteran > scarred > reckless > cautious > curious
 */
export function dominantTrait(traits: AcepTrait[]): AcepTrait | null {
  const priority: AcepTrait[] = [
    'ancient-touched', 'veteran', 'scarred', 'reckless', 'cautious', 'curious',
  ];
  for (const t of priority) {
    if (traits.includes(t)) return t;
  }
  return null;
}
