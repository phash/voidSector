/**
 * Guardrail: keep alien faction homes far from the human origin (0,0).
 * Pure, DB-free helpers so they can be unit-tested in isolation.
 */

export interface FactionHome {
  faction_id: string;
  home_qx: number;
  home_qy: number;
}

/**
 * Distance (in sectors) from the origin on one axis to the nearest sector of a
 * quadrant index `q`, using the CENTERED quadrant convention of the canonical
 * `sectorToQuadrant` (see quadrantEngine.ts): quadrant Q spans
 * [Q*size - half, Q*size + half - 1], so quadrant 0 straddles the origin.
 * Conservative: for negative q it under-reports by at most 1 sector, which only
 * makes the >=minDist guard slightly stricter (the safe direction).
 */
function nearestAxisDistance(q: number, quadrantSize: number): number {
  if (q === 0) return 0;
  const half = Math.floor(quadrantSize / 2);
  return Math.abs(q) * quadrantSize - half;
}

/**
 * Chebyshev distance from the origin to the nearest sector contained in quadrant
 * (qx, qy). We take the nearest sector along each axis independently; the
 * Chebyshev distance of that nearest corner is max(dx, dy).
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
 * Throws if any non-human faction home is outside [minDist, maxDist] sectors of
 * origin. `maxDist` is optional (omit for a min-only guard). Startup guardrail
 * after alien homes are seeded.
 */
export function assertAlienHomesFarFromOrigin(
  homes: FactionHome[],
  quadrantSize: number,
  minDist: number,
  maxDist?: number,
): void {
  for (const h of homes) {
    // 'humans' is the live faction_config id (migration 063); 'human' kept for any pre-migration data.
    if (h.faction_id === 'human' || h.faction_id === 'humans') continue;
    const dist = quadrantNearestSectorDistance(h.home_qx, h.home_qy, quadrantSize);
    if (dist < minDist) {
      throw new Error(
        `Alien home "${h.faction_id}" at quadrant (${h.home_qx},${h.home_qy}) is only ` +
          `${dist} sectors from origin (minimum ${minDist}).`,
      );
    }
    if (maxDist !== undefined && dist > maxDist) {
      throw new Error(
        `Alien home "${h.faction_id}" at quadrant (${h.home_qx},${h.home_qy}) is ` +
          `${dist} sectors from origin (maximum ${maxDist}).`,
      );
    }
  }
}
