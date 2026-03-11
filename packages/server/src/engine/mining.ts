import { MINING_RATE_PER_SECOND } from '@void-sector/shared';
import type { MiningState, ResourceType } from '@void-sector/shared';

export function createMiningState(): MiningState {
  return {
    active: false,
    resource: null,
    sectorX: 0,
    sectorY: 0,
    startedAt: null,
    rate: 0,
    sectorYield: 0,
    mineAll: false,
  };
}

export function startMining(
  resource: ResourceType,
  sectorX: number,
  sectorY: number,
  sectorYield: number,
  now: number = Date.now(),
  mineAll: boolean = false,
): MiningState {
  return {
    active: true,
    resource,
    sectorX,
    sectorY,
    startedAt: now,
    rate: MINING_RATE_PER_SECOND,
    sectorYield,
    mineAll,
  };
}

export function calculateMinedAmount(
  state: MiningState,
  cargoSpace: number,
  now: number = Date.now(),
): number {
  if (!state.active || !state.startedAt) return 0;
  const elapsed = (now - state.startedAt) / 1000;
  if (elapsed <= 0) return 0;
  const raw = elapsed * state.rate;
  return Math.floor(Math.min(raw, state.sectorYield, cargoSpace));
}

export function stopMining(
  state: MiningState,
  cargoSpace: number,
  now: number = Date.now(),
): { mined: number; resource: ResourceType | null; newState: MiningState } {
  const mined = calculateMinedAmount(state, cargoSpace, now);
  return {
    mined,
    resource: state.resource,
    newState: createMiningState(),
  };
}
