import { hashCoords } from './worldgen.js';
import { generateDistressMessage } from './distressStories.js';
import { WORLD_SEED, SCAN_EVENT_CHANCE } from '@void-sector/shared';
import type { ScanEventType } from '@void-sector/shared';

const SCAN_EVENT_SALT = 5555;

export interface ScanEventResult {
  hasEvent: boolean;
  eventType?: ScanEventType;
  isImmediate?: boolean;
  data?: Record<string, unknown>;
}

const EVENT_TYPE_WEIGHTS: { type: ScanEventType; weight: number; immediate: boolean }[] = [
  { type: 'pirate_ambush', weight: 0.35, immediate: true },
  { type: 'distress_signal', weight: 0.30, immediate: false },
  { type: 'anomaly_reading', weight: 0.25, immediate: false },
  { type: 'artifact_find', weight: 0.10, immediate: false },
];

export function checkScanEvent(sectorX: number, sectorY: number): ScanEventResult {
  const seed = hashCoords(sectorX, sectorY, WORLD_SEED + SCAN_EVENT_SALT);
  const normalized = (seed >>> 0) / 0x100000000;

  if (normalized >= SCAN_EVENT_CHANCE) {
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

function generateEventData(
  eventType: ScanEventType,
  sectorX: number,
  sectorY: number,
  seed: number,
): Record<string, unknown> {
  switch (eventType) {
    case 'pirate_ambush':
      return { pirateLevel: Math.min(Math.floor(Math.sqrt(sectorX * sectorX + sectorY * sectorY) / 50) + 1, 10) };
    case 'distress_signal':
      return { rewardCredits: 20 + ((seed >>> 4) % 80), rewardRep: 5, message: generateDistressMessage(sectorX, sectorY, seed) };
    case 'anomaly_reading':
      return {
        rewardXp: 15 + ((seed >>> 6) % 35),
        rewardRep: 5,
        rewardArtefact: ((seed >>> 14) % 100) < 8 ? 1 : 0,
      };
    case 'artifact_find':
      return {
        rewardCredits: 50 + ((seed >>> 8) % 150),
        rewardRep: 10,
        rewardArtefact: ((seed >>> 16) % 100) < 50 ? 1 : 0,
      };
    default:
      return {};
  }
}
