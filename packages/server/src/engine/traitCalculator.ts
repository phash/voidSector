/**
 * ACEP Trait Calculator
 * Derives personality traits from a ship's XP distribution.
 * Traits are stored as a string array in ships.acep_traits.
 */

import type { AcepXpSummary } from './acepXpService.js';

export type AcepTrait =
  | 'veteran' // Combat-hardened — high kampf XP
  | 'curious' // Constantly scanning — high intel XP
  | 'reckless' // Fighter, ignores logistics — high kampf, low ausbau
  | 'cautious' // Builder, avoids conflict — high ausbau, low kampf
  | 'ancient-touched' // Has discovered ruins — high explorer XP
  | 'scarred'; // Mostly combat, little else — tunnel-vision fighter

/**
 * Derive a ship's trait set from its current XP summary.
 * A ship can have multiple traits simultaneously.
 */
export function calculateTraits(xp: AcepXpSummary): AcepTrait[] {
  const traits: AcepTrait[] = [];

  // Thresholds are on the ACEP path LEVEL scale (0-10) since #523/#524 —
  // the columns hold levels, not the old 0-50 raw-XP scale.
  if (xp.kampf >= 7) {
    traits.push('veteran');
  }

  if (xp.intel >= 7) {
    traits.push('curious');
  }

  if (xp.explorer >= 5) {
    traits.push('ancient-touched');
  }

  // Reckless: heavy fighter who doesn't build
  if (xp.kampf >= 5 && xp.ausbau <= 2) {
    traits.push('reckless');
  }

  // Cautious: builder who avoids combat
  if (xp.ausbau >= 7 && xp.kampf <= 2) {
    traits.push('cautious');
  }

  // Scarred: mostly combat, almost nothing else (tunnel-vision)
  if (xp.kampf >= 4 && xp.intel + xp.ausbau + xp.explorer <= xp.kampf * 0.4) {
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
    'ancient-touched',
    'veteran',
    'scarred',
    'reckless',
    'cautious',
    'curious',
  ];
  for (const t of priority) {
    if (traits.includes(t)) return t;
  }
  return null;
}
