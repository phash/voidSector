import type { Coords, ShipStats } from '@void-sector/shared';
import { HYPERJUMP_FUEL_PER_SECTOR, HULL_FUEL_MULTIPLIER, HYPERJUMP_BASE_AP, HYPERJUMP_AP_PER_SPEED, HYPERJUMP_MIN_AP } from '@void-sector/shared';

/**
 * Autopilot Engine — pure functions for path calculation, cost estimation,
 * and incremental segment extraction.
 *
 * Pathfinding uses Manhattan movement (X-axis first, then Y-axis) with
 * BFS detours around impassable black holes when encountered.
 */

// --- Path Calculation ---

/**
 * Calculate a Manhattan path from `from` to `to`, detouring around black holes.
 * Strategy: move along X axis first, then Y axis. When a black hole blocks,
 * use BFS to find the shortest detour around it, then resume Manhattan movement.
 */
export function calculateAutopilotPath(
  from: Coords,
  to: Coords,
  isBlackHole: (x: number, y: number) => boolean,
): Coords[] {
  // Same sector — no movement needed
  if (from.x === to.x && from.y === to.y) return [];

  const path: Coords[] = [];
  let current = { ...from };

  // Maximum iterations to prevent infinite loops
  const maxIterations = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + 1000;
  let iterations = 0;

  while ((current.x !== to.x || current.y !== to.y) && iterations < maxIterations) {
    iterations++;

    // Determine next Manhattan step: X first, then Y
    const next = getNextManhattanStep(current, to);

    if (!isBlackHole(next.x, next.y)) {
      path.push({ ...next });
      current = next;
    } else {
      // Black hole in the way — use BFS to find a detour
      const detour = bfsDetour(current, to, isBlackHole);
      if (detour.length === 0) {
        // No path found — return what we have so far
        break;
      }
      for (const step of detour) {
        path.push({ ...step });
      }
      current = detour[detour.length - 1];
    }
  }

  return path;
}

/**
 * Get the next Manhattan step toward `to` (X-axis priority).
 */
function getNextManhattanStep(current: Coords, to: Coords): Coords {
  if (current.x !== to.x) {
    return { x: current.x + (to.x > current.x ? 1 : -1), y: current.y };
  }
  return { x: current.x, y: current.y + (to.y > current.y ? 1 : -1) };
}

/**
 * BFS detour around black holes. Finds the shortest path from `current`
 * to a cell that is strictly closer to `to` (Manhattan distance) and from
 * which normal Manhattan pathfinding can resume without immediately hitting
 * another black hole.
 */
function bfsDetour(
  current: Coords,
  to: Coords,
  isBlackHole: (x: number, y: number) => boolean,
): Coords[] {
  const MAX_BFS_RANGE = 50; // limit search radius
  const startDist = manhattanDist(current, to);

  /**
   * A cell is a valid resume point if:
   * 1) It is the destination itself, OR
   * 2) It is strictly closer to the destination than `current`, AND
   *    the next Manhattan step from it is not a black hole.
   */
  function isValidResume(c: Coords): boolean {
    if (c.x === to.x && c.y === to.y) return true;
    const dist = manhattanDist(c, to);
    if (dist >= startDist) return false; // must make progress
    const next = getNextManhattanStep(c, to);
    return !isBlackHole(next.x, next.y);
  }

  type BfsNode = { x: number; y: number; parent: BfsNode | null };
  const start: BfsNode = { x: current.x, y: current.y, parent: null };
  const visited = new Set<string>();
  visited.add(`${current.x},${current.y}`);

  const queue: BfsNode[] = [start];
  const dirs = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];

  while (queue.length > 0) {
    const node = queue.shift()!;

    for (const d of dirs) {
      const nx = node.x + d.dx;
      const ny = node.y + d.dy;
      const key = `${nx},${ny}`;

      if (visited.has(key)) continue;
      if (Math.abs(nx - current.x) > MAX_BFS_RANGE || Math.abs(ny - current.y) > MAX_BFS_RANGE) continue;
      if (isBlackHole(nx, ny)) {
        visited.add(key);
        continue;
      }

      visited.add(key);
      const child: BfsNode = { x: nx, y: ny, parent: node };

      // Check if we can resume Manhattan movement from here
      if (isValidResume({ x: nx, y: ny })) {
        // Reconstruct path (skip the start node, which is `current`)
        const detourPath: Coords[] = [];
        let trace: BfsNode | null = child;
        while (trace !== null && trace !== start) {
          detourPath.unshift({ x: trace.x, y: trace.y });
          trace = trace.parent;
        }
        return detourPath;
      }

      queue.push(child);
    }
  }

  // No detour found within range
  return [];
}

/** Manhattan distance between two coordinates. */
function manhattanDist(a: Coords, b: Coords): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// --- Cost Estimation ---

export interface AutopilotCosts {
  totalFuel: number;
  totalAP: number;
  estimatedTime: number; // ms
}

/**
 * Calculate estimated costs for traversing a path.
 * Normal mode: 1 sector at a time, no fuel cost, 1 AP per step.
 * Hyperjump mode: `engineSpeed` sectors per batch, fuel cost per sector, reduced AP.
 */
export function calculateAutopilotCosts(
  path: Coords[],
  shipStats: ShipStats,
  useHyperjump: boolean,
): AutopilotCosts {
  if (path.length === 0) {
    return { totalFuel: 0, totalAP: 0, estimatedTime: 0 };
  }

  const totalSteps = path.length;

  if (!useHyperjump) {
    // Normal movement: 1 AP per sector, no fuel, 1 sector per tick
    return {
      totalFuel: 0,
      totalAP: totalSteps * shipStats.apCostJump,
      estimatedTime: totalSteps * STEP_INTERVAL_MS,
    };
  }

  // Hyperjump mode
  const speed = Math.max(1, shipStats.engineSpeed);
  const numBatches = Math.ceil(totalSteps / speed);

  // Fuel: total fuel cost based on hull multiplier and efficiency
  const hullType = getHullTypeFromStats(shipStats);
  const hullMul = hullType ? HULL_FUEL_MULTIPLIER[hullType] : 1.0;
  const rawFuel = HYPERJUMP_FUEL_PER_SECTOR * totalSteps * hullMul * (1 - shipStats.hyperdriveFuelEfficiency);
  const totalFuel = Math.max(1, Math.ceil(rawFuel));

  // AP: one AP charge per batch
  const apPerBatch = Math.max(HYPERJUMP_MIN_AP, HYPERJUMP_BASE_AP - speed * HYPERJUMP_AP_PER_SPEED);
  const totalAP = numBatches * apPerBatch;

  // Time estimate: one tick per batch
  const tickMs = Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / speed));
  const estimatedTime = numBatches * tickMs;

  return { totalFuel, totalAP, estimatedTime };
}

/**
 * Infer hull type from ship stats for fuel multiplier lookup.
 * Matches against base stats; returns null if unknown.
 */
function getHullTypeFromStats(stats: ShipStats): keyof typeof HULL_FUEL_MULTIPLIER | null {
  // Best-effort match by checking fuelMax ranges
  // This is a heuristic; in practice the server knows the hull type
  for (const [hull, mul] of Object.entries(HULL_FUEL_MULTIPLIER)) {
    if (mul === 1.0 && stats.fuelMax >= 140 && stats.fuelMax <= 160) return hull as keyof typeof HULL_FUEL_MULTIPLIER;
  }
  return null;
}

// --- Segment Extraction ---

export interface AutopilotSegment {
  moves: Coords[];
  isHyperjump: boolean;
}

/** Default step interval in ms (for normal movement). */
export const STEP_INTERVAL_MS = 100;
/** Minimum tick interval in ms (clamped for high-speed drives). */
export const STEP_INTERVAL_MIN_MS = 20;

/**
 * Extract the next segment of moves from a path for one autopilot tick.
 *
 * Normal mode: returns 1 move.
 * Hyperjump mode: returns up to `speed` moves (batch).
 *
 * The caller is responsible for deducting fuel/AP per move in the segment.
 */
export function getNextSegment(
  path: Coords[],
  currentStep: number,
  hyperdriveCharge: number,
  speed: number,
): AutopilotSegment {
  const remaining = path.length - currentStep;
  if (remaining <= 0) {
    return { moves: [], isHyperjump: false };
  }

  const useHyperjump = hyperdriveCharge > 0 && speed > 0;

  if (!useHyperjump) {
    // Normal movement: 1 sector
    return {
      moves: [path[currentStep]],
      isHyperjump: false,
    };
  }

  // Hyperjump: batch up to `speed` sectors (limited by remaining path and charge)
  const batchSize = Math.min(speed, remaining, Math.floor(hyperdriveCharge));
  const moves = path.slice(currentStep, currentStep + batchSize);

  return {
    moves,
    isHyperjump: true,
  };
}
