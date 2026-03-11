import type { ShipModule } from '../../../shared/src/types.js';

// Enemy module layout (what player sees when scanned)
export interface EnemyModule {
  category: string;
  tier: number;
  currentHp: number;
  maxHp: number;
  powerLevel: 'off' | 'low' | 'mid' | 'high';
  revealed: boolean; // false until scan or EXPLORER L5 reveals
}

// How player distributes energy to their modules each round
export interface EnergyAllocation {
  moduleId: string;
  category: string;
  powerLevel: 'off' | 'low' | 'mid' | 'high';
}

// Primary actions available to player each round
export type PrimaryAction =
  | { type: 'attack' }
  | { type: 'scan' }
  | { type: 'repair'; targetModuleId: string }
  | { type: 'flee' }
  | { type: 'wait' }
  | { type: 'aim'; targetModuleCategory: string }; // aimed attack at specific enemy module

// Optional reaction choices (one per round)
export type ReactionChoice =
  | { type: 'shield_boost' }
  | { type: 'ecm_pulse' }
  | { type: 'emergency_eject' }; // < 15% HP, loses cargo, guaranteed escape

// Ancient ability (once per combat, charges after 3 rounds unused)
export type AncientAbility =
  | { type: 'explorer_passive' }  // EXPLORER L5: auto-reveals enemy modules round 1
  | { type: 'energy_pulse' };     // Ancient Core module: ignores shields, hits HP directly

// Full combat state (persisted between rounds)
export interface CombatState {
  playerId: string;
  playerHp: number;
  playerMaxHp: number;
  playerModules: ShipModule[];
  epBuffer: number;           // unspent EP from previous rounds
  maxEpBuffer: number;        // = generatorTier * 2

  enemyType: string;
  enemyLevel: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyModules: EnemyModule[];
  enemyEpBuffer: number;      // enemy's EP buffer (for flee check)

  round: number;              // 1-based, max 10
  ancientChargeRounds: number; // rounds since last ancient ability use (starts 0)
  ancientAbilityUsed: boolean;
  log: string[];              // combat log lines
}

// Player's full input for one round
export interface RoundInput {
  energyAllocations: EnergyAllocation[];
  primaryAction: PrimaryAction;
  reactionChoice?: ReactionChoice;
  ancientAbility?: AncientAbility;
}

// Damage event on a specific module
export interface ModuleDamageEvent {
  moduleId: string;
  category: string;
  hpBefore: number;
  hpAfter: number;
}

// Result of resolving one round
export interface RoundResult {
  newState: CombatState;
  playerDamageTaken: number;
  enemyDamageTaken: number;
  moduleDamageEvents: ModuleDamageEvent[];
  fled: boolean;
  ejected: boolean;
  outcome: 'ongoing' | 'victory' | 'defeat' | 'fled' | 'draw' | 'ejected';
  logLines: string[];         // new lines added this round
}
