import { describe, it, expect } from 'vitest';
import { initCombat, calculateAvailableEp, calculateEpCost, resolveRound } from '../combatEngine.js';
import type { CombatState, EnemyModule, RoundInput } from '../combatTypes.js';
import type { ShipModule } from '../../../../shared/src/types.js';
import { MODULE_HP_BY_TIER } from '../../../../shared/src/constants.js';

// Helper: minimal generator ShipModule using real module IDs from constants
function makeGenerator(tier: number = 2): ShipModule {
  const moduleId = `generator_mk${tier}`;
  return {
    moduleId,
    slotIndex: 0,
    source: 'standard',
    powerLevel: 'high',
    currentHp: MODULE_HP_BY_TIER[tier as keyof typeof MODULE_HP_BY_TIER],
  };
}

// Use real weapon module IDs from constants (laser_mk1, laser_mk2, laser_mk3)
function makeWeapon(tier: number = 2): ShipModule {
  const tierToId: Record<number, string> = {
    1: 'laser_mk1',
    2: 'laser_mk2',
    3: 'laser_mk3',
  };
  const moduleId = tierToId[tier] ?? 'laser_mk1';
  return {
    moduleId,
    slotIndex: 2,
    source: 'standard',
    powerLevel: 'high',
    currentHp: MODULE_HP_BY_TIER[tier as keyof typeof MODULE_HP_BY_TIER],
  };
}

function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  const generator = makeGenerator(2);
  return {
    playerId: 'p1',
    playerHp: 100,
    playerMaxHp: 100,
    playerModules: [generator, makeWeapon(2)],
    epBuffer: 0,
    maxEpBuffer: 4, // generatorTier(2) * 2
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
    ...overrides,
  };
}

describe('initCombat', () => {
  it('initializes combat state correctly', () => {
    const state = initCombat({
      playerId: 'p1',
      playerHp: 100,
      playerMaxHp: 100,
      playerModules: [makeGenerator(2)],
      enemyType: 'pirate',
      enemyLevel: 1,
      enemyHp: 80,
      enemyMaxHp: 80,
      enemyModules: [],
    });
    expect(state.round).toBe(1);
    expect(state.ancientAbilityUsed).toBe(false);
    expect(state.epBuffer).toBe(0);
    expect(state.maxEpBuffer).toBe(4); // tier 2 generator * 2
  });

  it('sets maxEpBuffer based on generator tier', () => {
    const state = initCombat({
      playerId: 'p2',
      playerHp: 100,
      playerMaxHp: 100,
      playerModules: [makeGenerator(3)],
      enemyType: 'pirate',
      enemyLevel: 1,
      enemyHp: 80,
      enemyMaxHp: 80,
      enemyModules: [],
    });
    expect(state.maxEpBuffer).toBe(6); // tier 3 * 2
  });
});

describe('calculateAvailableEp', () => {
  it('calculates EP from generator tier 2 at full HP', () => {
    const state = makeCombatState();
    const ep = calculateAvailableEp(state);
    // Generator tier 2 = 9 EP/round, full HP, high power (multiplier 1.0)
    expect(ep).toBeGreaterThan(0);
    expect(ep).toBeCloseTo(9); // 9 * 1.0 * 1.0 + 0 buffer
  });

  it('includes buffer in available EP', () => {
    const state = makeCombatState({ epBuffer: 3 });
    const ep = calculateAvailableEp(state);
    expect(ep).toBeCloseTo(12); // 9 from generator + 3 from buffer
  });

  it('returns only buffer EP when generator is destroyed', () => {
    const state = makeCombatState({
      playerModules: [
        { ...makeGenerator(2), currentHp: 1 }, // < 25% of 35 → destroyed
      ],
      epBuffer: 2,
    });
    const ep = calculateAvailableEp(state);
    // Generator is destroyed → 0 from generator, only buffer
    expect(ep).toBe(2);
  });
});

describe('calculateEpCost', () => {
  it('sums EP costs correctly', () => {
    const allocations = [
      { moduleId: 'weapon_mk1', category: 'weapon', powerLevel: 'high' as const },
      { moduleId: 'shield_mk1', category: 'shield', powerLevel: 'mid' as const },
    ];
    const cost = calculateEpCost(allocations);
    // weapon HIGH = 6, shield MID = 2 → total 8
    expect(cost).toBe(8);
  });

  it('returns 0 for empty allocations', () => {
    expect(calculateEpCost([])).toBe(0);
  });

  it('handles all power levels', () => {
    expect(calculateEpCost([{ moduleId: 'w', category: 'weapon', powerLevel: 'off' }])).toBe(0);
    expect(calculateEpCost([{ moduleId: 'w', category: 'weapon', powerLevel: 'low' }])).toBe(2);
    expect(calculateEpCost([{ moduleId: 'w', category: 'weapon', powerLevel: 'mid' }])).toBe(4);
    expect(calculateEpCost([{ moduleId: 'w', category: 'weapon', powerLevel: 'high' }])).toBe(6);
  });
});

describe('resolveRound - attack', () => {
  it('deals damage to enemy on attack', () => {
    const state = makeCombatState({ enemyHp: 80, enemyMaxHp: 80 });
    const input: RoundInput = {
      energyAllocations: [{ moduleId: 'laser_mk2', category: 'weapon', powerLevel: 'high' }],
      primaryAction: { type: 'attack' },
    };
    const result = resolveRound(state, input);
    expect(result.enemyDamageTaken).toBeGreaterThan(0);
    expect(result.newState.enemyHp).toBeLessThan(80);
  });

  it('victory when enemy HP reaches 0', () => {
    const state = makeCombatState({ enemyHp: 1, enemyMaxHp: 80 });
    const input: RoundInput = {
      energyAllocations: [{ moduleId: 'laser_mk2', category: 'weapon', powerLevel: 'high' }],
      primaryAction: { type: 'attack' },
    };
    const result = resolveRound(state, input);
    expect(result.outcome).toBe('victory');
  });

  it('increments round after resolution', () => {
    const state = makeCombatState({ round: 3 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const result = resolveRound(state, input);
    expect(result.newState.round).toBe(4);
  });
});

describe('resolveRound - aim', () => {
  it('aim attack deals damage and creates module damage event', () => {
    const enemyModules: EnemyModule[] = [
      { category: 'shield', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'off', revealed: true },
    ];
    const state = makeCombatState({ enemyHp: 80, enemyModules });
    const input: RoundInput = {
      energyAllocations: [{ moduleId: 'laser_mk2', category: 'weapon', powerLevel: 'high' }],
      primaryAction: { type: 'aim', targetModuleCategory: 'shield' },
    };
    const result = resolveRound(state, input);
    expect(result.enemyDamageTaken).toBeGreaterThan(0);
    expect(result.moduleDamageEvents.length).toBeGreaterThan(0);
    expect(result.moduleDamageEvents[0].category).toBe('shield');
  });
});

describe('resolveRound - scan', () => {
  it('reveals one unrevealed enemy module', () => {
    const enemyModules: EnemyModule[] = [
      { category: 'weapon', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'high', revealed: false },
    ];
    const state = makeCombatState({ enemyModules });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'scan' },
    };
    const result = resolveRound(state, input);
    expect(result.newState.enemyModules[0].revealed).toBe(true);
  });
});

describe('resolveRound - flee', () => {
  it('flee fails without drive module allocation', () => {
    const state = makeCombatState();
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'flee' },
    };
    const result = resolveRound(state, input);
    expect(result.fled).toBe(false);
  });

  it('flee succeeds with drive EP > enemy drive EP', () => {
    const enemyModules: EnemyModule[] = []; // no enemy drive → enemy drive EP = 0
    const driveModule: ShipModule = {
      moduleId: 'drive_mk1',
      slotIndex: 1,
      source: 'standard',
      powerLevel: 'high',
      currentHp: 20,
    };
    const state = makeCombatState({
      playerModules: [makeGenerator(2), driveModule],
      enemyModules,
    });
    const input: RoundInput = {
      energyAllocations: [{ moduleId: 'drive_mk1', category: 'drive', powerLevel: 'high' }],
      primaryAction: { type: 'flee' },
    };
    const result = resolveRound(state, input);
    expect(result.fled).toBe(true);
    expect(result.outcome).toBe('fled');
  });
});

describe('resolveRound - wait', () => {
  it('accumulates EP buffer on wait', () => {
    const state = makeCombatState({ epBuffer: 0, maxEpBuffer: 4 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const result = resolveRound(state, input);
    // Buffer should accumulate (capped at maxEpBuffer)
    expect(result.newState.epBuffer).toBeGreaterThan(0);
  });
});

describe('resolveRound - draw', () => {
  it('draw after round 10', () => {
    const state = makeCombatState({ round: 10 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const result = resolveRound(state, input);
    expect(result.outcome).toBe('draw');
  });

  it('ongoing before round 10', () => {
    const state = makeCombatState({ round: 9 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const result = resolveRound(state, input);
    expect(result.outcome).toBe('ongoing');
  });
});

describe('resolveRound - emergency eject', () => {
  it('eject when HP < 15%', () => {
    const state = makeCombatState({ playerHp: 10, playerMaxHp: 100 }); // 10% < 15%
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      reactionChoice: { type: 'emergency_eject' },
    };
    const result = resolveRound(state, input);
    expect(result.ejected).toBe(true);
    expect(result.outcome).toBe('ejected');
  });

  it('no eject when HP is exactly 15% (strict less-than boundary)', () => {
    // Exactly 15% — must NOT trigger eject (spec requires strictly < 15%)
    const state = makeCombatState({ playerHp: 15, playerMaxHp: 100, enemyLevel: 0 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      reactionChoice: { type: 'emergency_eject' },
    };
    const result = resolveRound(state, input);
    // Enemy level 0 deals 0 damage, so HP stays at exactly 15 → eject must be blocked
    expect(result.ejected).toBe(false);
  });

  it('no eject when HP is above 15%', () => {
    // Need playerHp > 15% of playerMaxHp, but account for enemy damage taken
    const state = makeCombatState({ playerHp: 100, playerMaxHp: 100 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      reactionChoice: { type: 'emergency_eject' },
    };
    const result = resolveRound(state, input);
    // playerHp should still be above 15% even after enemy damage
    expect(result.ejected).toBe(false);
  });
});

describe('resolveRound - ancient abilities', () => {
  it('explorer_passive reveals all enemy modules when charged (>= 3 rounds)', () => {
    const enemyModules: EnemyModule[] = [
      { category: 'weapon', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'high', revealed: false },
      { category: 'shield', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'mid', revealed: false },
    ];
    const state = makeCombatState({ enemyModules, ancientChargeRounds: 3 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      ancientAbility: { type: 'explorer_passive' },
    };
    const result = resolveRound(state, input);
    expect(result.newState.enemyModules.every((m) => m.revealed)).toBe(true);
    expect(result.newState.ancientChargeRounds).toBe(0);
    expect(result.newState.ancientAbilityUsed).toBe(true);
  });

  it('energy_pulse deals direct damage ignoring shields when charged (>= 3 rounds)', () => {
    const enemyModules: EnemyModule[] = [
      { category: 'shield', tier: 2, currentHp: 35, maxHp: 35, powerLevel: 'high', revealed: true },
    ];
    const state = makeCombatState({ enemyHp: 80, enemyModules, ancientChargeRounds: 3 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      ancientAbility: { type: 'energy_pulse' },
    };
    const result = resolveRound(state, input);
    expect(result.enemyDamageTaken).toBeGreaterThan(0);
    expect(result.newState.enemyHp).toBeLessThan(80);
  });

  it('ancientChargeRounds increments when ability not used', () => {
    const state = makeCombatState({ ancientChargeRounds: 2 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const result = resolveRound(state, input);
    expect(result.newState.ancientChargeRounds).toBe(3);
  });

  it('ancientAbility is ignored if charge rounds < 3 (server validation)', () => {
    const enemyModules: EnemyModule[] = [
      { category: 'weapon', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'high', revealed: false },
    ];
    // Only 2 charge rounds — ability should NOT fire
    const state = makeCombatState({ enemyModules, ancientChargeRounds: 2 });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      ancientAbility: { type: 'explorer_passive' },
    };
    const result = resolveRound(state, input);
    // Modules must NOT be revealed — ability was ignored
    expect(result.newState.enemyModules.every((m) => m.revealed)).toBe(false);
    // ancientAbilityUsed must remain false
    expect(result.newState.ancientAbilityUsed).toBe(false);
    // charge rounds stay unchanged when ability is sent but blocked (no increment branch fires)
    expect(result.newState.ancientChargeRounds).toBe(2);
  });

  it('ancientAbility is ignored if already used (server validation)', () => {
    const enemyModules: EnemyModule[] = [
      { category: 'weapon', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'high', revealed: false },
    ];
    // Charged but already used
    const state = makeCombatState({ enemyModules, ancientChargeRounds: 5, ancientAbilityUsed: true });
    const input: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      ancientAbility: { type: 'explorer_passive' },
    };
    const result = resolveRound(state, input);
    // Modules must NOT be revealed — ability was already used
    expect(result.newState.enemyModules.every((m) => m.revealed)).toBe(false);
    // charge rounds stay unchanged — ability was sent but blocked, no increment fires
    expect(result.newState.ancientChargeRounds).toBe(5);
  });
});

describe('resolveRound - reactions', () => {
  it('shield_boost reduces player damage taken', () => {
    const state = makeCombatState({ playerHp: 100, playerMaxHp: 100 });
    const inputWithBoost: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      reactionChoice: { type: 'shield_boost' },
    };
    const inputNoBoost: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const resultBoost = resolveRound(state, inputWithBoost);
    const resultNoBoost = resolveRound(state, inputNoBoost);
    expect(resultBoost.playerDamageTaken).toBeLessThanOrEqual(resultNoBoost.playerDamageTaken);
  });

  it('ecm_pulse reduces player damage taken by 50%', () => {
    const state = makeCombatState({ playerHp: 100, playerMaxHp: 100, enemyLevel: 10 });
    const inputEcm: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
      reactionChoice: { type: 'ecm_pulse' },
    };
    const inputNone: RoundInput = {
      energyAllocations: [],
      primaryAction: { type: 'wait' },
    };
    const resultEcm = resolveRound(state, inputEcm);
    const resultNone = resolveRound(state, inputNone);
    expect(resultEcm.playerDamageTaken).toBeLessThan(resultNone.playerDamageTaken);
  });
});
