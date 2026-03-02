import type { APState, MiningState, ResourceType, SectorResources } from '@void-sector/shared';
import { spendAP } from './ap.js';
import { startMining, createMiningState } from './mining.js';

export interface JumpValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
}

export function validateJump(
  ap: APState,
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  jumpRange: number,
  apCost: number,
): JumpValidation {
  const dx = Math.abs(targetX - currentX);
  const dy = Math.abs(targetY - currentY);
  if (dx > jumpRange || dy > jumpRange || (dx === 0 && dy === 0)) {
    return { valid: false, error: 'Target out of range' };
  }
  const newAP = spendAP(ap, apCost);
  if (!newAP) return { valid: false, error: 'Not enough AP' };
  return { valid: true, newAP };
}

export interface ScanValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
}

export function validateScan(ap: APState, apCost: number): ScanValidation {
  const newAP = spendAP(ap, apCost);
  if (!newAP) return { valid: false, error: 'Not enough AP to scan' };
  return { valid: true, newAP };
}

export interface MineValidation {
  valid: boolean;
  error?: string;
  state?: MiningState;
}

export function validateMine(
  resource: ResourceType,
  sectorResources: SectorResources,
  currentMining: MiningState,
  cargoTotal: number,
  cargoCap: number,
  sectorX: number,
  sectorY: number,
): MineValidation {
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    return { valid: false, error: 'Invalid resource type' };
  }
  if (currentMining.active) {
    return { valid: false, error: 'Already mining — stop first' };
  }
  if (sectorResources[resource] <= 0) {
    return { valid: false, error: `No ${resource} in this sector` };
  }
  if (cargoTotal >= cargoCap) {
    return { valid: false, error: 'Cargo hold is full' };
  }
  const state = startMining(resource, sectorX, sectorY, sectorResources[resource]);
  return { valid: true, state };
}

export interface JettisonValidation {
  valid: boolean;
  error?: string;
}

export function validateJettison(resource: ResourceType, currentAmount: number): JettisonValidation {
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    return { valid: false, error: 'Invalid resource type' };
  }
  if (currentAmount <= 0) {
    return { valid: false, error: `No ${resource} to jettison` };
  }
  return { valid: true };
}
