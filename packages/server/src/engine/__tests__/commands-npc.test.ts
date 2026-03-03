import { describe, it, expect } from 'vitest';
import {
  createPirateEncounter, validateBattleAction, validateAcceptQuest,
  calculateLevel, getReputationTier,
} from '../commands.js';
import type { APState, CargoState } from '@void-sector/shared';

const fullAP: APState = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
const emptyCargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0 };

describe('Battle validation', () => {
  it('createPirateEncounter scales with level', () => {
    const e1 = createPirateEncounter(1, 10, 10, 0);
    const e5 = createPirateEncounter(5, 10, 10, 0);
    expect(e5.pirateHp).toBeGreaterThan(e1.pirateHp);
    expect(e5.pirateDamage).toBeGreaterThan(e1.pirateDamage);
    expect(e1.canNegotiate).toBe(false);
  });

  it('negotiate requires friendly reputation', () => {
    const encounter = createPirateEncounter(3, 10, 10, 1);
    expect(encounter.canNegotiate).toBe(true);
    const result = validateBattleAction('negotiate', fullAP, encounter, 100, emptyCargo, 10, 42);
    expect(result.valid).toBe(true);
    expect(result.result!.outcome).toBe('negotiated');
  });

  it('negotiate fails without friendly rep', () => {
    const encounter = createPirateEncounter(3, 10, 10, 0);
    const result = validateBattleAction('negotiate', fullAP, encounter, 100, emptyCargo, 10, 42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negotiate');
  });

  it('negotiate fails without enough credits', () => {
    const encounter = createPirateEncounter(3, 10, 10, 1);
    const result = validateBattleAction('negotiate', fullAP, encounter, 0, emptyCargo, 10, 42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('credits');
  });

  it('flee costs AP', () => {
    const lowAP: APState = { ...fullAP, current: 1 };
    const encounter = createPirateEncounter(1, 10, 10, 0);
    const result = validateBattleAction('flee', lowAP, encounter, 100, emptyCargo, 10, 42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });

  it('fight produces victory or defeat', () => {
    const encounter = createPirateEncounter(1, 10, 10, 0);
    const result = validateBattleAction('fight', fullAP, encounter, 50, emptyCargo, 10, 42);
    expect(result.valid).toBe(true);
    expect(['victory', 'defeat']).toContain(result.result!.outcome);
  });

  it('victory gives loot and XP', () => {
    const encounter = createPirateEncounter(1, 10, 10, 0);
    // Use high shipAttack to maximize victory chance
    const result = validateBattleAction('fight', fullAP, encounter, 200, emptyCargo, 10, 1);
    expect(result.valid).toBe(true);
    if (result.result!.outcome === 'victory') {
      expect(result.result!.lootCredits).toBeGreaterThan(0);
      expect(result.result!.xpGained).toBeGreaterThan(0);
    }
  });
});

describe('Quest validation', () => {
  it('accepts quest when under limit', () => {
    expect(validateAcceptQuest(0).valid).toBe(true);
    expect(validateAcceptQuest(2).valid).toBe(true);
  });

  it('rejects quest when at max', () => {
    expect(validateAcceptQuest(3).valid).toBe(false);
  });
});

describe('calculateLevel', () => {
  it('returns correct levels', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    expect(calculateLevel(5000)).toBe(10);
  });
});

describe('getReputationTier', () => {
  it('returns correct tiers', () => {
    expect(getReputationTier(-100)).toBe('hostile');
    expect(getReputationTier(-51)).toBe('hostile');
    expect(getReputationTier(-50)).toBe('unfriendly');
    expect(getReputationTier(0)).toBe('neutral');
    expect(getReputationTier(1)).toBe('friendly');
    expect(getReputationTier(50)).toBe('friendly');
    expect(getReputationTier(51)).toBe('honored');
  });
});
