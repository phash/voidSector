import type { APState, MiningState, ResourceType, SectorResources, StructureType, CargoState, StorageInventory, BattleAction, BattleOutcome, BattleResult, PirateEncounter } from '@void-sector/shared';
import {
  AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, STRUCTURE_COSTS, STRUCTURE_AP_COSTS,
  NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, STORAGE_TIERS,
  SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_AREA_RADIUS, SLATE_NPC_PRICE_PER_SECTOR,
  BATTLE_AP_COST_FLEE, BATTLE_FLEE_BASE_CHANCE, BATTLE_CARGO_LOSS_MIN, BATTLE_CARGO_LOSS_MAX,
  BATTLE_NEGOTIATE_COST_PER_LEVEL, PIRATE_BASE_HP, PIRATE_HP_PER_LEVEL,
  PIRATE_BASE_DAMAGE, PIRATE_DAMAGE_PER_LEVEL, MAX_ACTIVE_QUESTS, XP_LEVELS,
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

export function validateNpcCargoTrade(
  action: 'buy' | 'sell',
  resource: ResourceType,
  amount: number,
  credits: number,
  cargo: { ore: number; gas: number; crystal: number },
  cargoTotal: number,
  cargoCap: number,
): NpcTradeValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive', totalPrice: 0 };
  if (!['ore', 'gas', 'crystal'].includes(resource)) return { valid: false, error: 'Invalid resource', totalPrice: 0 };

  const basePrice = NPC_PRICES[resource];

  if (action === 'buy') {
    const totalPrice = Math.ceil(basePrice * NPC_BUY_SPREAD * amount);
    if (credits < totalPrice) return { valid: false, error: `Need ${totalPrice} credits (have ${credits})`, totalPrice };
    if (cargoTotal + amount > cargoCap) {
      return { valid: false, error: 'Cargo full', totalPrice };
    }
    return { valid: true, totalPrice };
  } else {
    const totalPrice = Math.floor(basePrice * NPC_SELL_SPREAD * amount);
    if (cargo[resource] < amount) return { valid: false, error: `Not enough ${resource} in cargo`, totalPrice };
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
    pirateHp: PIRATE_BASE_HP + pirateLevel * PIRATE_HP_PER_LEVEL,
    pirateDamage: PIRATE_BASE_DAMAGE + pirateLevel * PIRATE_DAMAGE_PER_LEVEL,
    sectorX,
    sectorY,
    canNegotiate: pirateReputation >= 1,
    negotiateCost: pirateLevel * BATTLE_NEGOTIATE_COST_PER_LEVEL,
  };
}

export interface BattleValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
  result?: BattleResult;
}

export function validateBattleAction(
  action: BattleAction,
  ap: APState,
  encounter: PirateEncounter,
  credits: number,
  cargo: CargoState,
  shipAttack: number,
  battleSeed: number,
): BattleValidation {
  if (action === 'flee') {
    const newAP = spendAP(ap, BATTLE_AP_COST_FLEE);
    if (!newAP) return { valid: false, error: 'Not enough AP to flee (need 2)' };

    const fleeChance = BATTLE_FLEE_BASE_CHANCE + (shipAttack * 0.02) - (encounter.pirateLevel * 0.05);
    const roll = ((battleSeed >>> 0) % 100) / 100;
    if (roll < fleeChance) {
      return { valid: true, newAP, result: { outcome: 'escaped' } };
    }
    const fightResult = resolveFight(encounter, shipAttack, cargo, battleSeed);
    return { valid: true, newAP, result: fightResult };
  }

  if (action === 'fight') {
    const result = resolveFight(encounter, shipAttack, cargo, battleSeed);
    return { valid: true, result };
  }

  if (action === 'negotiate') {
    if (!encounter.canNegotiate) return { valid: false, error: 'Pirates won\'t negotiate (need Friendly rep)' };
    if (credits < encounter.negotiateCost) {
      return { valid: false, error: `Not enough credits (need ${encounter.negotiateCost})` };
    }
    return {
      valid: true,
      result: { outcome: 'negotiated', repChange: 1 },
    };
  }

  return { valid: false, error: 'Invalid battle action' };
}

function resolveFight(
  encounter: PirateEncounter,
  shipAttack: number,
  cargo: CargoState,
  seed: number,
): BattleResult {
  const playerPower = shipAttack + ((seed >>> 8) % 20);
  const piratePower = encounter.pirateDamage + ((seed >>> 16) % 10);

  if (playerPower >= piratePower) {
    const lootCredits = encounter.pirateLevel * 10 + ((seed >>> 4) % 50);
    const lootOre = ((seed >>> 6) % 3);
    const lootCrystal = ((seed >>> 10) % 2);
    return {
      outcome: 'victory',
      lootCredits,
      lootResources: { ore: lootOre, crystal: lootCrystal },
      repChange: -3,
      xpGained: encounter.pirateLevel * 5,
    };
  } else {
    const lossRatio = BATTLE_CARGO_LOSS_MIN + ((seed >>> 12) % 100) / 100 * (BATTLE_CARGO_LOSS_MAX - BATTLE_CARGO_LOSS_MIN);
    return {
      outcome: 'defeat',
      cargoLost: {
        ore: Math.floor(cargo.ore * lossRatio),
        gas: Math.floor(cargo.gas * lossRatio),
        crystal: Math.floor(cargo.crystal * lossRatio),
      },
      xpGained: Math.ceil(encounter.pirateLevel * 2),
    };
  }
}

// --- Phase 4: Quest Validation ---

export interface AcceptQuestValidation {
  valid: boolean;
  error?: string;
}

export function validateAcceptQuest(activeQuestCount: number): AcceptQuestValidation {
  if (activeQuestCount >= MAX_ACTIVE_QUESTS) {
    return { valid: false, error: `Maximum ${MAX_ACTIVE_QUESTS} active quests reached` };
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
