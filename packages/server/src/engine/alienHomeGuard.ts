/**
 * Guardrail: keep alien faction homes far from the human origin (0,0).
 * Pure, DB-free helpers so they can be unit-tested in isolation.
 */

export interface FactionHome {
  faction_id: string;
  home_qx: number;
  home_qy: number;
}

/** Distance (in sectors, per axis) from origin to the nearest edge of a quadrant. */
function nearestAxisDistance(q: number, quadrantSize: number): number {
  if (q > 0) return q * quadrantSize;
  if (q < 0) return Math.abs(q) * quadrantSize - (quadrantSize - 1);
  return 0;
}

/**
 * Chebyshev distance from origin to the closest sector contained in quadrant (qx,qy).
 * Each axis is independent, so the closest sector minimises both axes simultaneously.
 */
export function quadrantNearestSectorDistance(
  qx: number,
  qy: number,
  quadrantSize: number,
): number {
  return Math.max(
    nearestAxisDistance(qx, quadrantSize),
    nearestAxisDistance(qy, quadrantSize),
  );
}

/**
 * Throws if any non-human faction home is closer than minDist sectors to origin.
 * Used as a startup guardrail after alien homes are seeded.
 */
export function assertAlienHomesFarFromOrigin(
  homes: FactionHome[],
  quadrantSize: number,
  minDist: number,
): void {
  for (const h of homes) {
    if (h.faction_id === 'human' || h.faction_id === 'humans') continue;
    const dist = quadrantNearestSectorDistance(h.home_qx, h.home_qy, quadrantSize);
    if (dist < minDist) {
      throw new Error(
        `Alien home "${h.faction_id}" at quadrant (${h.home_qx},${h.home_qy}) is only ` +
          `${dist} sectors from origin (minimum ${minDist}).`,
      );
    }
  }
}
