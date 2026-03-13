/**
 * CombatService unit tests
 *
 * Tests the pure/isolated methods of CombatService:
 * - generateEnemyModules()
 * - generateLoot() (via finalizeCombat indirectly — tested via module-level helper)
 * - EP validation logic (calculateAvailableEp / calculateEpCost from combatEngine)
 *
 * We instantiate CombatService with a minimal mock ServiceContext so we never
 * touch Colyseus, DB, or Redis.
 */

import { describe, it, expect, vi } from 'vitest';
import { CombatService } from '../CombatService.js';
import {
  calculateAvailableEp,
  calculateEpCost,
  initCombat,
} from '../../../engine/combatEngine.js';
import type { CombatState, EnemyModule } from '../../../engine/combatTypes.js';
import type { ShipModule } from '../../../../../shared/src/types.js';
import { MODULE_HP_BY_TIER } from '../../../../../shared/src/constants.js';

// ─── Minimal mock ServiceContext ──────────────────────────────────────────────

function makeCtx(): any {
  return {
    state: {} as any,
    quadrantX: 0,
    quadrantY: 0,
    clientShips: new Map(),
    autopilotTimers: new Map(),
    playerSectorData: new Map(),
    checkRate: () => true,
    getShipForClient: () => ({ hp: 100 } as any),
    getPlayerBonuses: vi.fn().mockResolvedValue({ combatMultiplier: 1 }),
    _px: () => 0,
    _py: () => 0,
    _pst: () => 'empty',
    send: vi.fn(),
    broadcast: vi.fn(),
    broadcastToFaction: vi.fn(),
    broadcastToSector: vi.fn(),
    sendToPlayer: vi.fn(),
    disposeCallbacks: [],
    roomId: 'test-room',
    checkFirstContact: vi.fn(),
    checkQuestProgress: vi.fn(),
    checkAndEmitDistressCalls: vi.fn(),
    applyReputationChange: vi.fn(),
    applyXpGain: vi.fn(),
  };
}

// ─── generateEnemyModules tests ───────────────────────────────────────────────

describe('CombatService.generateEnemyModules', () => {
  const service = new CombatService(makeCtx());

  it('level 1 enemy has exactly 2 modules (weapon + drive)', () => {
    const mods = service.generateEnemyModules('pirate', 1);
    expect(mods).toHaveLength(2);
    expect(mods.map((m) => m.category).sort()).toEqual(['drive', 'weapon']);
  });

  it('level 2 enemy has 3 modules (weapon + drive + shield)', () => {
    const mods = service.generateEnemyModules('pirate', 2);
    expect(mods).toHaveLength(3);
    const cats = mods.map((m) => m.category).sort();
    expect(cats).toEqual(['drive', 'shield', 'weapon']);
  });

  it('level 4 enemy has 4 modules (weapon + drive + shield + generator)', () => {
    const mods = service.generateEnemyModules('pirate', 4);
    expect(mods).toHaveLength(4);
    const cats = mods.map((m) => m.category).sort();
    expect(cats).toEqual(['drive', 'generator', 'shield', 'weapon']);
  });

  it('level 5 enemy has 4 modules (>= 4 still gives generator)', () => {
    const mods = service.generateEnemyModules('pirate', 5);
    expect(mods).toHaveLength(4);
  });

  it('all modules start unrevealed', () => {
    const mods = service.generateEnemyModules('pirate', 4);
    expect(mods.every((m) => m.revealed === false)).toBe(true);
  });

  it('tier is capped at 5', () => {
    const mods = service.generateEnemyModules('pirate', 10);
    expect(mods.every((m) => m.tier === 5)).toBe(true);
  });

  it('tier 1 enemy has tier 1 modules with 20 HP each', () => {
    const mods = service.generateEnemyModules('pirate', 1);
    const expectedHp = MODULE_HP_BY_TIER[1]; // 20
    expect(mods.every((m) => m.tier === 1)).toBe(true);
    expect(mods.every((m) => m.currentHp === expectedHp)).toBe(true);
    expect(mods.every((m) => m.maxHp === expectedHp)).toBe(true);
  });

  it('tier 3 enemy (level 5-6) has tier 3 modules with 55 HP each', () => {
    const mods = service.generateEnemyModules('pirate', 5); // tier = ceil(5/2) = 3
    const expectedHp = MODULE_HP_BY_TIER[3]; // 55
    expect(mods.every((m) => m.tier === 3)).toBe(true);
    expect(mods.every((m) => m.currentHp === expectedHp)).toBe(true);
  });

  it('all modules have powerLevel high', () => {
    const mods = service.generateEnemyModules('pirate', 3);
    expect(mods.every((m) => m.powerLevel === 'high')).toBe(true);
  });
});

// ─── EP validation tests (using combatEngine directly) ────────────────────────

describe('EP validation: calculateAvailableEp + calculateEpCost', () => {
  function makeGenerator(tier: number = 2): ShipModule {
    return {
      moduleId: `generator_mk${tier}`,
      slotIndex: 0,
      source: 'standard',
      powerLevel: 'high',
      currentHp: MODULE_HP_BY_TIER[tier as keyof typeof MODULE_HP_BY_TIER],
    };
  }

  function makeState(playerModules: ShipModule[]): CombatState {
    return initCombat({
      playerId: 'test-player',
      playerHp: 100,
      playerMaxHp: 100,
      playerModules,
      enemyType: 'pirate',
      enemyLevel: 1,
      enemyHp: 50,
      enemyMaxHp: 50,
      enemyModules: [
        { category: 'weapon', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'high', revealed: false },
      ],
    });
  }

  it('player without generator has 0 EP available', () => {
    const state = makeState([]);
    expect(calculateAvailableEp(state)).toBe(0);
  });

  it('player with generator_mk2 at full HP has positive EP', () => {
    const state = makeState([makeGenerator(2)]);
    const ep = calculateAvailableEp(state);
    expect(ep).toBeGreaterThan(0);
  });

  it('EP cost of empty allocations is 0', () => {
    expect(calculateEpCost([])).toBe(0);
  });

  it('EP cost of weapon at high power is positive', () => {
    const cost = calculateEpCost([
      { moduleId: 'laser_mk1', category: 'weapon', powerLevel: 'high' },
    ]);
    expect(cost).toBeGreaterThan(0);
  });

  it('EP validation: cost within available EP passes', () => {
    const state = makeState([makeGenerator(3)]);
    const available = calculateAvailableEp(state);
    const cost = calculateEpCost([
      { moduleId: 'laser_mk1', category: 'weapon', powerLevel: 'low' },
    ]);
    expect(cost).toBeLessThanOrEqual(available);
  });

  it('EP validation: cost exceeding available EP fails', () => {
    // No generator → 0 EP available, any allocation should exceed
    const state = makeState([]);
    const available = calculateAvailableEp(state);
    const cost = calculateEpCost([
      { moduleId: 'laser_mk1', category: 'weapon', powerLevel: 'high' },
    ]);
    expect(cost).toBeGreaterThan(available);
  });
});

// ─── Loot generation tests (private method exposed via type casting) ───────────

describe('CombatService loot generation', () => {
  const service = new CombatService(makeCtx()) as any;

  it('level 1 loot: only credits (no ore or crystal)', () => {
    const loot = service.generateLoot(1);
    expect(loot.credits).toBeGreaterThanOrEqual(50); // base = 50, range [50..99]
    expect(loot.ore).toBeUndefined();
    expect(loot.crystal).toBeUndefined();
  });

  it('level 2 loot: credits + ore', () => {
    const loot = service.generateLoot(2);
    expect(loot.credits).toBeGreaterThanOrEqual(100);
    expect(loot.ore).toBeDefined();
    expect(loot.crystal).toBeUndefined();
  });

  it('level 4 loot: credits + ore + crystal', () => {
    const loot = service.generateLoot(4);
    expect(loot.credits).toBeGreaterThanOrEqual(200);
    expect(loot.ore).toBeDefined();
    expect(loot.crystal).toBeDefined();
  });

  it('credits scale with enemy level', () => {
    const loot1 = service.generateLoot(1);
    const loot5 = service.generateLoot(5);
    // loot5.credits minimum is 250, loot1.credits max is 99
    expect(loot5.credits).toBeGreaterThan(loot1.credits - 1); // at least same order
    // More reliable: min of level 5 is 250, max of level 1 is 99
    expect(loot5.credits).toBeGreaterThanOrEqual(250);
  });
});
