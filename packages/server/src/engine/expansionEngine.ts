// packages/server/src/engine/expansionEngine.ts
import type { QuadrantControlRow } from '../db/queries.js';
import { ALIEN_WAKE_FRONTIER_QUADRANTS, EXPANSION_FRONTIER_MARGIN } from '@void-sector/shared';

/** True when aliens should transition from dormant to awake this tick. */
export function shouldWakeAliens(alreadyAwake: boolean, humanFrontierQuadrants: number): boolean {
  return !alreadyAwake && humanFrontierQuadrants >= ALIEN_WAKE_FRONTIER_QUADRANTS;
}

/** The outermost quadrant-distance aliens may expand to, given the human frontier. */
export function expansionFrontierMax(humanFrontierQuadrants: number): number {
  return humanFrontierQuadrants + EXPANSION_FRONTIER_MARGIN;
}

export interface BorderContactResult {
  hasContact: boolean;
  factions: string[];
}

export function checkBorderContact(
  a: QuadrantControlRow,
  b: QuadrantControlRow,
): BorderContactResult {
  if (a.controlling_faction === b.controlling_faction) {
    return { hasContact: false, factions: [] };
  }
  const isNeighbor = Math.abs(a.qx - b.qx) <= 1 && Math.abs(a.qy - b.qy) <= 1;
  if (!isNeighbor) {
    return { hasContact: false, factions: [] };
  }
  return {
    hasContact: true,
    factions: [a.controlling_faction, b.controlling_faction],
  };
}

// TODO: expansion style ('sphere' vs 'wave' vs 'jumpgate') is not yet used in
// target selection — all factions use the same nearest-neighbor logic for now.
// Implement per-style spatial patterns in Phase EW follow-up.
export function getExpansionTarget(
  faction: string,
  allControls: QuadrantControlRow[],
  _style: 'sphere' | 'wave' | 'jumpgate',
  maxDistance?: number,
): { qx: number; qy: number } | null {
  const claimedSet = new Set(allControls.map((q) => `${q.qx},${q.qy}`));
  const ownedQuadrants = allControls.filter((q) => q.controlling_faction === faction);

  if (ownedQuadrants.length === 0) return null;

  const candidates = new Set<string>();
  for (const own of ownedQuadrants) {
    // Frontier bound: don't generate candidates from quadrants already at or beyond the limit.
    if (maxDistance !== undefined && Math.max(Math.abs(own.qx), Math.abs(own.qy)) >= maxDistance) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = own.qx + dx;
        const ny = own.qy + dy;
        // Frontier bound: aliens only expand within the player frontier + margin.
        if (maxDistance !== undefined && Math.max(Math.abs(nx), Math.abs(ny)) > maxDistance) continue;
        const key = `${nx},${ny}`;
        if (!claimedSet.has(key)) {
          candidates.add(key);
        }
      }
    }
  }

  if (candidates.size === 0) return null;

  const [first] = candidates;
  const [qx, qy] = first.split(',').map(Number);
  return { qx, qy };
}

export function findAllBorderPairs(
  allControls: QuadrantControlRow[],
): Array<{ a: QuadrantControlRow; b: QuadrantControlRow }> {
  const pairs: Array<{ a: QuadrantControlRow; b: QuadrantControlRow }> = [];
  for (let i = 0; i < allControls.length; i++) {
    for (let j = i + 1; j < allControls.length; j++) {
      const result = checkBorderContact(allControls[i], allControls[j]);
      if (result.hasContact) {
        pairs.push({ a: allControls[i], b: allControls[j] });
      }
    }
  }
  return pairs;
}

/**
 * A quadrant is a "frontier" if it has between 1 and 5 unclaimed/empty
 * neighboring quadrants. 0 empty = deep interior; 6-8 empty = deep wilderness.
 * Pirates only exist and fight in frontier quadrants.
 */
export function isFrontierQuadrant(
  qx: number,
  qy: number,
  allControls: QuadrantControlRow[],
): boolean {
  const controlled = new Set(allControls.map((q) => `${q.qx},${q.qy}`));
  let emptyNeighbors = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (!controlled.has(`${qx + dx},${qy + dy}`)) emptyNeighbors++;
    }
  }
  return emptyNeighbors >= 1 && emptyNeighbors <= 5;
}
