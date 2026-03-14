import { describe, it, expect } from 'vitest';
import {
  createPirateEncounter,
  validateAcceptQuest,
  calculateLevel,
  getReputationTier,
} from '../commands.js';

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
  });
});

describe('Quest validation', () => {
  it('accepts quest when under limit', () => {
    expect(validateAcceptQuest(0).valid).toBe(true);
    expect(validateAcceptQuest(2).valid).toBe(true);
  });

  it('rejects quest when at max', () => {
    expect(validateAcceptQuest(20).valid).toBe(false);
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
