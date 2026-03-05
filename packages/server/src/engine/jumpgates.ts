import { hashCoords } from './worldgen.js';
import {
  WORLD_SEED,
  JUMPGATE_SALT,
  JUMPGATE_CHANCE,
  JUMPGATE_MIN_RANGE,
  JUMPGATE_MAX_RANGE,
  JUMPGATE_CODE_CHANCE,
  JUMPGATE_MINIGAME_CHANCE,
  JUMPGATE_CODE_LENGTH,
} from '@void-sector/shared';
import type { JumpGateType } from '@void-sector/shared';

export function checkJumpGate(sectorX: number, sectorY: number): boolean {
  const hash = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT);
  return ((hash >>> 0) % 10000) / 10000 < JUMPGATE_CHANCE;
}

export function generateGateTarget(
  sectorX: number,
  sectorY: number,
): {
  targetX: number;
  targetY: number;
  gateType: JumpGateType;
  requiresCode: boolean;
  requiresMinigame: boolean;
  accessCode: string | null;
} {
  const hash = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT + 1);
  const hash2 = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT + 2);
  const hash3 = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT + 3);

  // Distance: weighted toward shorter ranges (quadratic distribution)
  const distNorm = ((hash >>> 0) % 10000) / 10000;
  const distance = Math.floor(
    JUMPGATE_MIN_RANGE + distNorm ** 2 * (JUMPGATE_MAX_RANGE - JUMPGATE_MIN_RANGE),
  );

  // Angle for target direction
  const angle = (((hash2 >>> 0) % 3600) / 3600) * 2 * Math.PI;
  const targetX = sectorX + Math.round(Math.cos(angle) * distance);
  const targetY = sectorY + Math.round(Math.sin(angle) * distance);

  // Gate type: 60% bidirectional, 40% wormhole
  const gateType: JumpGateType = (hash3 >>> 0) % 100 < 60 ? 'bidirectional' : 'wormhole';

  // Code/minigame requirements
  const requiresCode = ((hash3 >>> 8) % 100) / 100 < JUMPGATE_CODE_CHANCE;
  const requiresMinigame = ((hash3 >>> 16) % 100) / 100 < JUMPGATE_MINIGAME_CHANCE;

  const accessCode = requiresCode ? generateAccessCode(hash3) : null;

  return { targetX, targetY, gateType, requiresCode, requiresMinigame, accessCode };
}

function generateAccessCode(seed: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let s = seed;
  for (let i = 0; i < JUMPGATE_CODE_LENGTH; i++) {
    code += chars[Math.abs(s) % chars.length];
    s = (s * 1103515245 + 12345) | 0;
  }
  return code;
}

export function getDirectionFromAngle(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

export function calculateDirection(fromX: number, fromY: number, toX: number, toY: number): string {
  const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
  return getDirectionFromAngle(angle);
}

export function estimateDistance(actual: number, variance: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * variance;
  return Math.max(1, Math.round(actual * factor));
}
