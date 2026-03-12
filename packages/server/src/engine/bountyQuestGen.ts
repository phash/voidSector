import { hashCoords } from './worldgen.js';

export const BOUNTY_TRAIL_SALT = 0x42b01;
export const BOUNTY_NAME_SALT = 0x9c3a7;

// Note on seeding: generateBountyTrail takes a plain `dayOfYear` integer and applies
// the salts internally. Callers must NOT pre-add any salt.

// ─── Name Generator ───────────────────────────────────────────────────────────

const PREFIXES = ["Zyr'", "Vel'", 'Kael', 'Dra', 'Xan', "Mor'", 'Thal', 'Ix'];
const MIDS = ['ex', 'an', 'dran', 'ix', 'aen', 'ven', 'kar'];
const LASTS = ['Korath', 'Skaros', 'Veth', 'Arix', 'Moor', 'Drath', 'Xen'];

/**
 * Generate a deterministic sci-fi pirate name from a seed.
 * Result format: "{PREFIX}{MID} {LAST}" e.g. "Zyr'ex Korath"
 */
export function generateBountyName(seed: number): string {
  const h1 = hashCoords(seed, 0, BOUNTY_NAME_SALT);
  const h2 = hashCoords(seed, 1, BOUNTY_NAME_SALT);
  const h3 = hashCoords(seed, 2, BOUNTY_NAME_SALT);
  const prefix = PREFIXES[Math.abs(h1) % PREFIXES.length];
  const mid = MIDS[Math.abs(h2) % MIDS.length];
  const last = LASTS[Math.abs(h3) % LASTS.length];
  return `${prefix}${mid} ${last}`;
}

// ─── Trail Types ──────────────────────────────────────────────────────────────

export interface BountyTrailStep {
  x: number;
  y: number;
  hint: string;
}

export interface BountyTrail {
  steps: BountyTrailStep[];
  combatX: number;
  combatY: number;
  targetName: string;
  targetLevel: number;
}

// ─── Trail Generation ─────────────────────────────────────────────────────────

/** Number of trail steps by level */
function trailLength(level: number): number {
  if (level <= 2) return 2;
  if (level <= 4) return 3;
  return 4;
}

/** Generate a hint for a trail step based on target level */
function generateHint(
  level: number,
  nextX: number,
  nextY: number,
  stepIndex: number,
  totalSteps: number,
  targetName: string,
): string {
  const isLastStep = stepIndex === totalSteps - 1;

  if (level <= 2) {
    // Exact next sector
    if (isLastStep) {
      return `Das Ziel ist in der Nähe! Letzte Spur bei S ${nextX}:${nextY}.`;
    }
    return `${targetName} hat S ${nextX}:${nextY} verlassen. Kurs weiter.`;
  }

  if (level <= 4) {
    // Approximate: exact X, Y obscured
    const quadX = Math.floor(nextX / 10);
    const quadY = Math.floor(nextY / 10);
    if (isLastStep) {
      return `Spur endet irgendwo nördlich von S ${nextX}:x. Quadrant ${quadX}:${quadY}.`;
    }
    return `Spur endet irgendwo in der Nähe von S ${nextX}:x.`;
  }

  // Level 5+: Quadrant only
  const quadX = Math.floor(nextX / 10);
  const quadY = Math.floor(nextY / 10);
  return `Letzte bekannte Position: Quadrant ${quadX}:${quadY}.`;
}

/**
 * Generate a bounty trail deterministically from station coords, level, and dayOfYear.
 * Salts are applied internally — callers pass plain dayOfYear without any pre-added salt.
 */
export function generateBountyTrail(
  stationX: number,
  stationY: number,
  level: number,
  dayOfYear: number,
): BountyTrail {
  const seed = dayOfYear + BOUNTY_TRAIL_SALT;
  const numSteps = trailLength(level);
  const targetName = generateBountyName(hashCoords(stationX, stationY, dayOfYear + BOUNTY_NAME_SALT));

  // Determine initial direction from station
  const dirHash = hashCoords(stationX, stationY, seed + 1);
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  const [baseDx, baseDy] = directions[Math.abs(dirHash) % directions.length];

  // Initial distance range by level
  let minDist = 3;
  let maxDist = 5;
  if (level >= 3 && level <= 4) {
    minDist = 5;
    maxDist = 10;
  } else if (level >= 5) {
    minDist = 10;
    maxDist = 20;
  }

  const distHash = hashCoords(stationX, stationY, seed + 2);
  const startDist = minDist + (Math.abs(distHash) % (maxDist - minDist + 1));

  const steps: BountyTrailStep[] = [];
  let cx = stationX + baseDx * startDist;
  let cy = stationY + baseDy * startDist;

  for (let i = 0; i < numSteps; i++) {
    // Next position (1–4 sectors in roughly consistent direction with ±45° variance)
    const stepHash = hashCoords(cx, cy, seed + i + 10);
    const stepDist = 1 + (Math.abs(stepHash) % 4);
    const varHash = hashCoords(cx, cy, seed + i + 100);
    const variance = [-1, 0, 0, 1][Math.abs(varHash) % 4];
    const nextX = cx + baseDx * stepDist + variance;
    const nextY = cy + baseDy * stepDist + variance;

    const hint = generateHint(level, nextX, nextY, i, numSteps, targetName);

    steps.push({ x: cx, y: cy, hint });
    cx = nextX;
    cy = nextY;
  }

  // Combat sector: 1–3 sectors beyond last trail step
  const combatHash = hashCoords(cx, cy, seed + 999);
  const combatDist = 1 + (Math.abs(combatHash) % 3);
  const combatX = cx + baseDx * combatDist;
  const combatY = cy + baseDy * combatDist;

  return {
    steps,
    combatX,
    combatY,
    targetName,
    targetLevel: level,
  };
}
