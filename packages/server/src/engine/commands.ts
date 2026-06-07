import type {
  APState,
  MiningState,
  ResourceType,
  MineableResourceType,
  SectorResources,
  StructureType,
  CargoState,
  StorageInventory,
  PirateEncounter,
} from '@void-sector/shared';
import {
  AP_COSTS_LOCAL_SCAN,
  AP_COSTS_BY_SCANNER,
  STRUCTURE_COSTS,
  STRUCTURE_AP_COSTS,
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  SLATE_AP_COST_SECTOR,
  SLATE_AP_COST_AREA,
  SLATE_AREA_RADIUS,
  SLATE_NPC_PRICE_PER_SECTOR,
  BATTLE_NEGOTIATE_COST_PER_LEVEL,
  PIRATE_BASE_HP,
  PIRATE_HP_PER_LEVEL,
  PIRATE_BASE_DAMAGE,
  PIRATE_DAMAGE_PER_LEVEL,
  MAX_ACTIVE_QUESTS,
  XP_LEVELS,
} from '@void-sector/shared';
import { spendAP } from './ap.js';
import { startMining, createMiningState } from './mining.js';
import { getConfig } from './gameConfigApply.js';

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
  isMining: boolean = false,
): JumpValidation {
  if (isMining) {
    return { valid: false, error: 'Cannot jump while mining — stop mining first' };
  }
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
  cost: number = (getConfig('AP_COSTS_LOCAL_SCAN') as typeof AP_COSTS_LOCAL_SCAN) ?? AP_COSTS_LOCAL_SCAN,
  _scannerLevel: number = 1,
): { valid: boolean; error?: string; newAP?: APState; hiddenSignatures: boolean } {
  const newAP = spendAP(ap, cost);
  if (!newAP) {
    return { valid: false, error: 'Insufficient AP', hiddenSignatures: false };
  }
  // hiddenSignatures is now determined in ScanService based on actual sector events
  return { valid: true, newAP, hiddenSignatures: false };
}

export function validateAreaScan(
  ap: APState,
  scannerLevel: number = 1,
): { valid: boolean; error?: string; newAP?: APState; radius: number; cost: number } {
  const config = AP_COSTS_BY_SCANNER[scannerLevel] ?? AP_COSTS_BY_SCANNER[1];
  const newAP = spendAP(ap, config.areaScan);
  if (!newAP) {
    return {
      valid: false,
      error: 'Insufficient AP',
      radius: config.areaScanRadius,
      cost: config.areaScan,
    };
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
  mineAll: boolean = false,
): MineValidation {
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    return { valid: false, error: 'Invalid resource type' };
  }
  const mineableRes = resource as MineableResourceType;
  if (currentMining.active) {
    return { valid: false, error: 'Already mining — stop first' };
  }
  if (sectorResources[mineableRes] <= 0) {
    return { valid: false, error: `No ${resource} in this sector` };
  }
  if (cargoTotal >= cargoCap) {
    return { valid: false, error: 'Cargo hold is full' };
  }
  const state = startMining(resource, sectorX, sectorY, sectorResources[mineableRes], Date.now(), mineAll);
  return { valid: true, state };
}

export interface JettisonValidation {
  valid: boolean;
  error?: string;
}

export function validateJettison(
  resource: ResourceType,
  currentAmount: number,
): JettisonValidation {
  if (!['ore', 'gas', 'crystal', 'artefact'].includes(resource)) {
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
  structureType: StructureType,
): BuildValidation {
  const costs = STRUCTURE_COSTS[structureType];
  const apCost = STRUCTURE_AP_COSTS[structureType];

  for (const [resource, required] of Object.entries(costs)) {
    const have = cargo[resource as keyof CargoState] ?? 0;
    if (have < required) {
      return {
        valid: false,
        error: `Insufficient ${resource}: need ${required}, have ${have}`,
        costs,
      };
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
  storage: { ore: number; gas: number; crystal: number; artefact: number },
  storageTier: number,
): TransferValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive' };
  if (!['ore', 'gas', 'crystal', 'artefact'].includes(resource))
    return { valid: false, error: 'Invalid resource' };

  if (direction === 'toStorage') {
    if (cargo[resource] < amount) return { valid: false, error: `Not enough ${resource} in cargo` };
  } else {
    if (storage[resource] < amount)
      return { valid: false, error: `Not enough ${resource} in storage` };
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
  storage: { ore: number; gas: number; crystal: number; artefact: number },
  storageTier: number,
): NpcTradeValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive', totalPrice: 0 };
  if (resource === 'artefact')
    return {
      valid: false,
      error: 'Artefakte können nicht an NPCs gehandelt werden',
      totalPrice: 0,
    };
  if (!['ore', 'gas', 'crystal'].includes(resource))
    return { valid: false, error: 'Invalid resource', totalPrice: 0 };

  const basePrice = NPC_PRICES[resource as MineableResourceType];

  if (action === 'buy') {
    const totalPrice = Math.ceil(basePrice * ((getConfig('NPC_BUY_SPREAD') as typeof NPC_BUY_SPREAD) ?? NPC_BUY_SPREAD) * amount);
    if (credits < totalPrice)
      return { valid: false, error: `Need ${totalPrice} credits (have ${credits})`, totalPrice };
    return { valid: true, totalPrice };
  } else {
    const totalPrice = Math.floor(basePrice * ((getConfig('NPC_SELL_SPREAD') as typeof NPC_SELL_SPREAD) ?? NPC_SELL_SPREAD) * amount);
    if (storage[resource as MineableResourceType] < amount)
      return { valid: false, error: `Not enough ${resource} in storage`, totalPrice };
    return { valid: true, totalPrice };
  }
}

export function validateNpcCargoTrade(
  action: 'buy' | 'sell',
  resource: ResourceType,
  amount: number,
  credits: number,
  cargo: { ore: number; gas: number; crystal: number; artefact: number },
  cargoTotal: number,
  cargoCap: number,
): NpcTradeValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive', totalPrice: 0 };
  if (resource === 'artefact')
    return {
      valid: false,
      error: 'Artefakte können nicht an NPCs gehandelt werden',
      totalPrice: 0,
    };
  if (!['ore', 'gas', 'crystal'].includes(resource))
    return { valid: false, error: 'Invalid resource', totalPrice: 0 };

  const basePrice = NPC_PRICES[resource as MineableResourceType];

  if (action === 'buy') {
    const totalPrice = Math.ceil(basePrice * ((getConfig('NPC_BUY_SPREAD') as typeof NPC_BUY_SPREAD) ?? NPC_BUY_SPREAD) * amount);
    if (credits < totalPrice)
      return { valid: false, error: `Need ${totalPrice} credits (have ${credits})`, totalPrice };
    if (cargoTotal + amount > cargoCap) {
      return { valid: false, error: 'Cargo full', totalPrice };
    }
    return { valid: true, totalPrice };
  } else {
    const totalPrice = Math.floor(basePrice * ((getConfig('NPC_SELL_SPREAD') as typeof NPC_SELL_SPREAD) ?? NPC_SELL_SPREAD) * amount);
    if (cargo[resource] < amount)
      return { valid: false, error: `Not enough ${resource} in cargo`, totalPrice };
    return { valid: true, totalPrice };
  }
}

// --- Data Slate Validation ---

interface CreateSlateState {
  ap: number;
  scannerLevel: number;
  slateCount: number;
  memory: number;
}

interface CreateSlateResult {
  valid: boolean;
  error?: string;
  apCost?: number;
  radius?: number;
}

export function validateCreateSlate(state: CreateSlateState, slateType: string): CreateSlateResult {
  const apCost =
    slateType === 'sector'
      ? (getConfig('SLATE_AP_COST_SECTOR') as typeof SLATE_AP_COST_SECTOR) ?? SLATE_AP_COST_SECTOR
      : ((getConfig('SLATE_AP_COST_AREA') as typeof SLATE_AP_COST_AREA) ?? SLATE_AP_COST_AREA) +
        state.scannerLevel * 2;

  if (state.ap < apCost) {
    return { valid: false, error: `Not enough AP (need ${apCost}, have ${state.ap})` };
  }

  if (state.slateCount >= state.memory) {
    return { valid: false, error: 'Memory full — no space for slate' };
  }

  const radius =
    slateType === 'area'
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
  return {
    valid: true,
    payout:
      sectorCount *
      ((getConfig('SLATE_NPC_PRICE_PER_SECTOR') as typeof SLATE_NPC_PRICE_PER_SECTOR) ??
        SLATE_NPC_PRICE_PER_SECTOR),
  };
}

// --- Faction Validation ---

interface FactionActionResult {
  valid: boolean;
  error?: string;
}

export function validateFactionAction(
  action: string,
  actorRank: string,
  targetRank?: string,
): FactionActionResult {
  if (['promote', 'demote', 'disband', 'setJoinMode'].includes(action)) {
    if (actorRank !== 'leader') {
      return { valid: false, error: 'Only the faction leader can do this' };
    }
    return { valid: true };
  }

  if (action === 'kick') {
    if (actorRank === 'leader') return { valid: true };
    if (actorRank === 'officer' && targetRank === 'member') return { valid: true };
    return { valid: false, error: 'Insufficient rank to kick this member' };
  }

  if (action === 'invite') {
    if (actorRank === 'leader' || actorRank === 'officer') return { valid: true };
    return { valid: false, error: 'Only leaders and officers can invite' };
  }

  return { valid: true };
}

// --- Phase 4: Battle Validation ---

export function createPirateEncounter(
  pirateLevel: number,
  sectorX: number,
  sectorY: number,
  pirateReputation: number,
): PirateEncounter {
  return {
    pirateLevel,
    pirateHp:
      ((getConfig('PIRATE_BASE_HP') as typeof PIRATE_BASE_HP) ?? PIRATE_BASE_HP) +
      pirateLevel * ((getConfig('PIRATE_HP_PER_LEVEL') as typeof PIRATE_HP_PER_LEVEL) ?? PIRATE_HP_PER_LEVEL),
    pirateDamage:
      ((getConfig('PIRATE_BASE_DAMAGE') as typeof PIRATE_BASE_DAMAGE) ?? PIRATE_BASE_DAMAGE) +
      pirateLevel *
        ((getConfig('PIRATE_DAMAGE_PER_LEVEL') as typeof PIRATE_DAMAGE_PER_LEVEL) ??
          PIRATE_DAMAGE_PER_LEVEL),
    sectorX,
    sectorY,
    canNegotiate: pirateReputation >= 1,
    negotiateCost:
      pirateLevel *
      ((getConfig('BATTLE_NEGOTIATE_COST_PER_LEVEL') as typeof BATTLE_NEGOTIATE_COST_PER_LEVEL) ??
        BATTLE_NEGOTIATE_COST_PER_LEVEL),
  };
}

// --- Phase 4: Quest Validation ---

export interface AcceptQuestValidation {
  valid: boolean;
  error?: string;
}

export function validateAcceptQuest(activeQuestCount: number): AcceptQuestValidation {
  const maxActiveQuests = (getConfig('MAX_ACTIVE_QUESTS') as typeof MAX_ACTIVE_QUESTS) ?? MAX_ACTIVE_QUESTS;
  if (activeQuestCount >= maxActiveQuests) {
    return { valid: false, error: `Maximum ${maxActiveQuests} active quests reached` };
  }
  return { valid: true };
}

// --- Phase 4: Level Calculation ---

export function calculateLevel(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(XP_LEVELS)) {
    if (xp >= threshold) level = parseInt(lvl, 10);
  }
  return level;
}

// --- Phase 4: Reputation Tier ---

export function getReputationTier(reputation: number): string {
  if (reputation <= -51) return 'hostile';
  if (reputation < 0) return 'unfriendly';
  if (reputation === 0) return 'neutral';
  if (reputation <= 50) return 'friendly';
  return 'honored';
}

