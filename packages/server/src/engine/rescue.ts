import { hashCoords } from './worldgen.js';
import { calculateDirection, estimateDistance } from './jumpgates.js';
import {
  WORLD_SEED, DISTRESS_CALL_CHANCE,
  DISTRESS_DIRECTION_VARIANCE, RESCUE_REWARDS,
} from '@void-sector/shared';

const DISTRESS_SALT = 999;

export function checkDistressCall(sectorX: number, sectorY: number): boolean {
  const hash = hashCoords(sectorX, sectorY, WORLD_SEED + DISTRESS_SALT);
  return ((hash >>> 0) % 10000) / 10000 < DISTRESS_CALL_CHANCE;
}

export function generateDistressCallData(
  playerX: number, playerY: number,
  targetX: number, targetY: number,
): { direction: string; estimatedDistance: number } {
  const actualDistance = Math.sqrt((targetX - playerX) ** 2 + (targetY - playerY) ** 2);
  const direction = calculateDirection(playerX, playerY, targetX, targetY);
  const estimated = estimateDistance(actualDistance, DISTRESS_DIRECTION_VARIANCE);
  return { direction, estimatedDistance: estimated };
}

export function calculateRescueReward(sourceType: 'scan_event' | 'npc_quest' | 'comm_distress'): {
  credits: number; rep: number; xp: number;
} {
  return { ...RESCUE_REWARDS[sourceType] };
}

export function canRescue(safeSlots: number, usedSlots: number): boolean {
  return usedSlots < safeSlots;
}
