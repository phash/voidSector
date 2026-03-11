import type { SectorEnvironment } from '@void-sector/shared';
import { isTraversable } from '@void-sector/shared';

export interface TraversabilityResult {
  canEnter: boolean;
  moveCostMultiplier: number; // 1.0 = normal, >1.0 = more AP/fuel
  message?: string;
}

/**
 * Returns traversability info for a sector environment.
 * Stars and black holes block movement; nebula increases cost.
 */
export function getSectorTraversability(environment: SectorEnvironment): TraversabilityResult {
  if (!isTraversable(environment)) {
    return {
      canEnter: false,
      moveCostMultiplier: Infinity,
      message:
        environment === 'star'
          ? 'Sternensektoren können nicht betreten werden.'
          : 'Schwarze Löcher können nicht betreten werden.',
    };
  }

  switch (environment) {
    case 'nebula':
      return { canEnter: true, moveCostMultiplier: 1.5 }; // +50% AP/fuel cost in nebula
    case 'planet':
      return { canEnter: true, moveCostMultiplier: 1.1 }; // slight orbital approach cost
    default:
      return { canEnter: true, moveCostMultiplier: 1.0 };
  }
}

/**
 * A* pathfinder that avoids impassable sectors and accounts for nebula cost.
 * Finds shortest traversable path between two sector coordinates.
 *
 * Note: This operates on absolute sector coordinates within a quadrant.
 * For large-scale autopilot (cross-quadrant), the caller should chain quadrant paths.
 */
export interface PathNode {
  x: number;
  y: number;
}

export interface PathResult {
  found: boolean;
  path: PathNode[];
  /** Total movement cost (sum of multipliers, length = 1 means adjacent) */
  totalCost: number;
}

/** Callback to look up an environment for a given sector. */
export type EnvironmentLookup = (x: number, y: number) => SectorEnvironment | 'unknown';

/**
 * Simplified BFS pathfinder for direct navigation (avoids impassable sectors).
 * Uses BFS with cost weighting for nebula sectors.
 *
 * For performance, limits search to maxSteps steps.
 */
export function findPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  lookupEnvironment: EnvironmentLookup,
  maxSteps: number = 200,
): PathResult {
  if (fromX === toX && fromY === toY) {
    return { found: true, path: [{ x: fromX, y: fromY }], totalCost: 0 };
  }

  type State = { x: number; y: number; cost: number; path: PathNode[] };
  const visited = new Set<string>();
  const queue: State[] = [{ x: fromX, y: fromY, cost: 0, path: [{ x: fromX, y: fromY }] }];

  while (queue.length > 0) {
    // Simple BFS — sort by cost for a basic weighted BFS
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (current.path.length > maxSteps) continue;

    // Check neighbors (cardinal directions only)
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const neighbor of neighbors) {
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (visited.has(nKey)) continue;

      const env = lookupEnvironment(neighbor.x, neighbor.y);
      const traversability = getSectorTraversability(env === 'unknown' ? 'empty' : env);

      if (!traversability.canEnter) continue;

      const newCost = current.cost + traversability.moveCostMultiplier;
      const newPath = [...current.path, { x: neighbor.x, y: neighbor.y }];

      if (neighbor.x === toX && neighbor.y === toY) {
        return { found: true, path: newPath, totalCost: newCost };
      }

      queue.push({ x: neighbor.x, y: neighbor.y, cost: newCost, path: newPath });
    }
  }

  return { found: false, path: [], totalCost: 0 };
}

/**
 * Validates if a hyperjump destination is legal (not impassable).
 */
export function validateJumpTarget(targetEnvironment: SectorEnvironment): {
  valid: boolean;
  error?: string;
} {
  if (!isTraversable(targetEnvironment)) {
    return {
      valid: false,
      error:
        targetEnvironment === 'black_hole'
          ? 'Schwarze Löcher sind kein gültiges Sprungziel.'
          : 'Sterne sind kein gültiges Sprungziel.',
    };
  }
  return { valid: true };
}

/**
 * Returns true if (x, y) is a void-blocked sector and the player has no void_shield.
 * Check order:
 *  1. Is the sector's quadrant fully void (controlling_faction='voids')? → blocked
 *  2. Is (x, y) in the frontier set? → blocked
 *  3. Otherwise → not blocked
 */
export function isVoidBlocked(
  x: number,
  y: number,
  quadrantControls: Array<{ qx: number; qy: number; controlling_faction: string }>,
  voidFrontierSet: Set<string>,
  playerModules: string[],
): boolean {
  if (playerModules.includes('void_shield')) return false;

  const qx = Math.floor(x / 10_000);
  const qy = Math.floor(y / 10_000);
  const ctrl = quadrantControls.find((c) => c.qx === qx && c.qy === qy);
  if (ctrl?.controlling_faction === 'voids') return true;

  return voidFrontierSet.has(`${x},${y}`);
}
