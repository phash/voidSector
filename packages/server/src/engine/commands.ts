import type { APState, MiningState, ResourceType, SectorResources, StructureType, CargoState, StorageInventory } from '@void-sector/shared';
import {
  AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, STRUCTURE_COSTS, STRUCTURE_AP_COSTS,
  NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, STORAGE_TIERS,
  SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_AREA_RADIUS, SLATE_NPC_PRICE_PER_SECTOR,
} from '@void-sector/shared';
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

export function validateLocalScan(
  ap: APState,
  cost: number = AP_COSTS_LOCAL_SCAN,
  scannerLevel: number = 1
): { valid: boolean; error?: string; newAP?: APState; hiddenSignatures: boolean } {
  const newAP = spendAP(ap, cost);
  if (!newAP) {
    return { valid: false, error: 'Insufficient AP', hiddenSignatures: false };
  }
  const hiddenSignatures = scannerLevel < 3;
  return { valid: true, newAP, hiddenSignatures };
}

export function validateAreaScan(
  ap: APState,
  scannerLevel: number = 1
): { valid: boolean; error?: string; newAP?: APState; radius: number; cost: number } {
  const config = AP_COSTS_BY_SCANNER[scannerLevel] ?? AP_COSTS_BY_SCANNER[1];
  const newAP = spendAP(ap, config.areaScan);
  if (!newAP) {
    return { valid: false, error: 'Insufficient AP', radius: config.areaScanRadius, cost: config.areaScan };
  }
  return { valid: true, newAP, radius: config.areaScanRadius, cost: config.areaScan };
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

export interface BuildValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
  costs: Record<string, number>;
}

export function validateBuild(
  ap: APState,
  cargo: CargoState,
  structureType: StructureType
): BuildValidation {
  const costs = STRUCTURE_COSTS[structureType];
  const apCost = STRUCTURE_AP_COSTS[structureType];

  for (const [resource, required] of Object.entries(costs)) {
    const have = cargo[resource as keyof CargoState] ?? 0;
    if (have < required) {
      return { valid: false, error: `Insufficient ${resource}: need ${required}, have ${have}`, costs };
    }
  }

  const newAP = spendAP(ap, apCost, Date.now());
  if (!newAP) {
    return { valid: false, error: `Insufficient AP: need ${apCost}`, costs };
  }

  return { valid: true, newAP, costs };
}

export interface TransferValidation {
  valid: boolean;
  error?: string;
}

export function validateTransfer(
  direction: 'toStorage' | 'fromStorage',
  resource: ResourceType,
  amount: number,
  cargo: CargoState,
  storage: { ore: number; gas: number; crystal: number },
  storageTier: number,
): TransferValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive' };
  if (!['ore', 'gas', 'crystal'].includes(resource)) return { valid: false, error: 'Invalid resource' };

  const tierConfig = STORAGE_TIERS[storageTier];
  if (!tierConfig) return { valid: false, error: 'Invalid storage tier' };

  if (direction === 'toStorage') {
    if (cargo[resource] < amount) return { valid: false, error: `Not enough ${resource} in cargo` };
    const storageTotal = storage.ore + storage.gas + storage.crystal;
    if (storageTotal + amount > tierConfig.capacity) {
      return { valid: false, error: `Storage full (${storageTotal}/${tierConfig.capacity})` };
    }
  } else {
    if (storage[resource] < amount) return { valid: false, error: `Not enough ${resource} in storage` };
  }

  return { valid: true };
}

export interface NpcTradeValidation {
  valid: boolean;
  error?: string;
  totalPrice: number;
}

export function validateNpcTrade(
  action: 'buy' | 'sell',
  resource: ResourceType,
  amount: number,
  credits: number,
  storage: { ore: number; gas: number; crystal: number },
  storageTier: number,
): NpcTradeValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive', totalPrice: 0 };
  if (!['ore', 'gas', 'crystal'].includes(resource)) return { valid: false, error: 'Invalid resource', totalPrice: 0 };

  const basePrice = NPC_PRICES[resource];
  const tierConfig = STORAGE_TIERS[storageTier];

  if (action === 'buy') {
    const totalPrice = Math.ceil(basePrice * NPC_BUY_SPREAD * amount);
    if (credits < totalPrice) return { valid: false, error: `Need ${totalPrice} credits (have ${credits})`, totalPrice };
    const storageTotal = storage.ore + storage.gas + storage.crystal;
    if (storageTotal + amount > tierConfig.capacity) {
      return { valid: false, error: 'Storage full', totalPrice };
    }
    return { valid: true, totalPrice };
  } else {
    const totalPrice = Math.floor(basePrice * NPC_SELL_SPREAD * amount);
    if (storage[resource] < amount) return { valid: false, error: `Not enough ${resource} in storage`, totalPrice };
    return { valid: true, totalPrice };
  }
}

// --- Data Slate Validation ---

interface CreateSlateState {
  ap: number;
  scannerLevel: number;
  cargoTotal: number;
  cargoCap: number;
}

interface CreateSlateResult {
  valid: boolean;
  error?: string;
  apCost?: number;
  radius?: number;
}

export function validateCreateSlate(state: CreateSlateState, slateType: string): CreateSlateResult {
  const apCost = slateType === 'sector'
    ? SLATE_AP_COST_SECTOR
    : SLATE_AP_COST_AREA + (state.scannerLevel - 1);

  if (state.ap < apCost) {
    return { valid: false, error: `Not enough AP (need ${apCost}, have ${state.ap})` };
  }

  if (state.cargoTotal >= state.cargoCap) {
    return { valid: false, error: 'Cargo full — no space for slate' };
  }

  const radius = slateType === 'area'
    ? (SLATE_AREA_RADIUS[state.scannerLevel] ?? SLATE_AREA_RADIUS[1])
    : undefined;

  return { valid: true, apCost, radius };
}

interface NpcBuybackResult {
  valid: boolean;
  error?: string;
  payout?: number;
}

export function validateNpcBuyback(hasTradingPost: boolean, sectorCount: number): NpcBuybackResult {
  if (!hasTradingPost) {
    return { valid: false, error: 'No trading post — cannot sell to NPC' };
  }
  return { valid: true, payout: sectorCount * SLATE_NPC_PRICE_PER_SECTOR };
}
