// packages/server/src/engine/expansionEngine.ts
import type { QuadrantControlRow } from '../db/queries.js';

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
): { qx: number; qy: number } | null {
  const claimedSet = new Set(allControls.map((q) => `${q.qx},${q.qy}`));
  const ownedQuadrants = allControls.filter((q) => q.controlling_faction === faction);

  if (ownedQuadrants.length === 0) return null;

  const candidates = new Set<string>();
  for (const own of ownedQuadrants) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const key = `${own.qx + dx},${own.qy + dy}`;
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
