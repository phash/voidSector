import { hashCoords } from './worldgen.js';
import { generateDistressMessage } from './distressStories.js';
import { WORLD_SEED, SCAN_EVENT_CHANCE, QUADRANT_SIZE, MODULES, ARTEFACT_TYPES } from '@void-sector/shared';
import type { ScanEventType, SectorEnvironment } from '@void-sector/shared';

const SCAN_EVENT_SALT = 5555;

export interface ScanEventResult {
  hasEvent: boolean;
  eventType?: ScanEventType;
  isImmediate?: boolean;
  data?: Record<string, unknown>;
}

const EVENT_TYPE_WEIGHTS: { type: ScanEventType; weight: number; immediate: boolean }[] = [
  { type: 'pirate_ambush', weight: 0.4, immediate: true },
  { type: 'distress_signal', weight: 0.05, immediate: false },
  { type: 'anomaly_reading', weight: 0.3, immediate: false },
  { type: 'artifact_find', weight: 0.15, immediate: false },
  { type: 'blueprint_find', weight: 0.1, immediate: false },
];

/** Distance from nearest quadrant edge (0 = at edge) */
function quadrantEdgeDistance(x: number, y: number): number {
  const modX = ((x % QUADRANT_SIZE) + QUADRANT_SIZE) % QUADRANT_SIZE;
  const modY = ((y % QUADRANT_SIZE) + QUADRANT_SIZE) % QUADRANT_SIZE;
  return Math.min(modX, QUADRANT_SIZE - modX, modY, QUADRANT_SIZE - modY);
}

/**
 * Effective scan event chance varies by environment and location.
 *
 * Target pirate rates (pirate_ambush weight = 0.35):
 *   empty near spawn:     ~0.4% → chance = 0.012
 *   empty at quad edges:  ~1%   → chance = 0.03
 *   nebula:               ~10%  → chance = 0.30
 *   nebula at quad edges: ~33%  → chance = 0.95
 */
export function getEffectiveEventChance(
  environment: SectorEnvironment,
  x: number,
  y: number,
): number {
  const edgeDist = quadrantEdgeDistance(x, y);
  const nearEdge = edgeDist < 500;

  if (environment === 'nebula') {
    return nearEdge ? 0.95 : 0.3;
  }
  // empty / black_hole
  return nearEdge ? 0.03 : 0.012;
}

export function checkScanEvent(
  sectorX: number,
  sectorY: number,
  environment: SectorEnvironment = 'empty',
): ScanEventResult {
  const seed = hashCoords(sectorX, sectorY, WORLD_SEED + SCAN_EVENT_SALT);
  const normalized = (seed >>> 0) / 0x100000000;

  const effectiveChance = getEffectiveEventChance(environment, sectorX, sectorY);
  if (normalized >= effectiveChance) {
    return { hasEvent: false };
  }

  const typeSeed = ((seed >>> 16) >>> 0) / 0x10000;
  let cumulative = 0;
  for (const entry of EVENT_TYPE_WEIGHTS) {
    cumulative += entry.weight;
    if (typeSeed < cumulative) {
      return {
        hasEvent: true,
        eventType: entry.type,
        isImmediate: entry.immediate,
        data: generateEventData(entry.type, sectorX, sectorY, seed),
      };
    }
  }

  return { hasEvent: false };
}

/**
 * Returns a deterministic ArtefactType for a given numeric seed.
 * Used to assign a type to found artefacts.
 */
export function getArtefactTypeForSeed(seed: number): string {
  const idx = Math.abs(seed) % ARTEFACT_TYPES.length;
  return ARTEFACT_TYPES[idx];
}

function generateEventData(
  eventType: ScanEventType,
  sectorX: number,
  sectorY: number,
  seed: number,
): Record<string, unknown> {
  switch (eventType) {
    case 'pirate_ambush':
      return {
        pirateLevel: Math.min(
          Math.floor(Math.sqrt(sectorX * sectorX + sectorY * sectorY) / 50) + 1,
          10,
        ),
      };
    case 'distress_signal':
      return {
        rewardCredits: 20 + ((seed >>> 4) % 80),
        rewardRep: 5,
        message: generateDistressMessage(sectorX, sectorY, seed),
      };
    case 'anomaly_reading':
      return {
        rewardXp: 15 + ((seed >>> 6) % 35),
        rewardRep: 5,
        rewardArtefact: (seed >>> 14) % 100 < 8 ? 1 : 0,
        rewardArtefactType: (seed >>> 14) % 100 < 8 ? getArtefactTypeForSeed(seed >>> 18) : undefined,
      };
    case 'artifact_find':
      return {
        rewardCredits: 50 + ((seed >>> 8) % 150),
        rewardRep: 10,
        rewardArtefact: (seed >>> 16) % 100 < 50 ? 1 : 0,
        rewardArtefactType: getArtefactTypeForSeed(seed >>> 20),
      };
    case 'blueprint_find': {
      const researchModules = Object.values(MODULES).filter((m) => m.researchCost);
      if (researchModules.length === 0) {
        return { moduleId: 'unknown', moduleName: 'Unknown Blueprint' };
      }
      const pick =
        researchModules[
          ((seed % researchModules.length) + researchModules.length) % researchModules.length
        ];
      return { moduleId: pick.id, moduleName: pick.name };
    }
    default:
      return {};
  }
}
