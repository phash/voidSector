// packages/server/src/engine/__tests__/combatTypes.test.ts
import { describe, it, expect } from 'vitest';
import type {
  CombatState,
  RoundInput,
  RoundResult,
  EnergyAllocation,
  EnemyModule,
  ModuleDamageEvent,
} from '../combatTypes.js';

describe('combatTypes', () => {
  it('CombatState has required fields', () => {
    const state: CombatState = {
      playerId: 'p1',
      playerHp: 100,
      playerMaxHp: 100,
      playerModules: [],
      epBuffer: 0,
      maxEpBuffer: 4,
      enemyType: 'pirate',
      enemyLevel: 1,
      enemyHp: 80,
      enemyMaxHp: 80,
      enemyModules: [],
      enemyEpBuffer: 0,
      round: 1,
      ancientChargeRounds: 0,
      ancientAbilityUsed: false,
      log: [],
    };
    expect(state.round).toBe(1);
    expect(state.maxEpBuffer).toBe(4);
  });

  it('RoundInput supports all primary action types', () => {
    const inputs: RoundInput[] = [
      { energyAllocations: [], primaryAction: { type: 'attack' } },
      { energyAllocations: [], primaryAction: { type: 'scan' } },
      { energyAllocations: [], primaryAction: { type: 'flee' } },
      { energyAllocations: [], primaryAction: { type: 'wait' } },
      { energyAllocations: [], primaryAction: { type: 'repair', targetModuleId: 'mod1' } },
      { energyAllocations: [], primaryAction: { type: 'aim', targetModuleCategory: 'weapon' } },
    ];
    expect(inputs).toHaveLength(6);
  });

  it('RoundResult outcome covers all cases', () => {
    const outcomes: RoundResult['outcome'][] = [
      'ongoing', 'victory', 'defeat', 'fled', 'draw', 'ejected',
    ];
    expect(outcomes).toHaveLength(6);
  });

  it('EnergyAllocation has moduleId + powerLevel', () => {
    const alloc: EnergyAllocation = {
      moduleId: 'weapon_mk1',
      category: 'weapon',
      powerLevel: 'high',
    };
    expect(alloc.powerLevel).toBe('high');
  });

  it('EnemyModule tracks revealed state', () => {
    const mod: EnemyModule = {
      category: 'weapon',
      tier: 2,
      currentHp: 35,
      maxHp: 35,
      powerLevel: 'high',
      revealed: false,
    };
    expect(mod.revealed).toBe(false);
  });
});
