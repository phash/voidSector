/**
 * CombatService unit tests
 *
 * Tests the pure/isolated methods of CombatService:
 * - generateLoot() (private, tested via type casting)
 *
 * We instantiate CombatService with a minimal mock ServiceContext so we never
 * touch Colyseus, DB, or Redis.
 */

import { describe, it, expect, vi } from 'vitest';
import { CombatService } from '../CombatService.js';

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
