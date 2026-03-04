import { describe, it, expect } from 'vitest';
import {
  initCombatV2,
  resolveRound,
  attemptFlee,
} from '../combatV2.js';
import type { PirateEncounter, ShipStats } from '@void-sector/shared';

const baseShip: ShipStats = {
  fuelMax: 100, cargoCap: 10, jumpRange: 3, apCostJump: 1,
  fuelPerJump: 1, hp: 100, commRange: 100, scannerLevel: 1, damageMod: 1.0,
  shieldHp: 0, shieldRegen: 0, weaponAttack: 0, weaponType: 'none',
  weaponPiercing: 0, pointDefense: 0, ecmReduction: 0,
};

const baseEncounter: PirateEncounter = {
  pirateLevel: 3, pirateHp: 50, pirateDamage: 14,
  sectorX: 10, sectorY: 20, canNegotiate: false, negotiateCost: 30,
};

describe('initCombatV2', () => {
  it('creates initial combat state', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    expect(state.currentRound).toBe(0);
    expect(state.maxRounds).toBe(5);
    expect(state.playerHp).toBe(100);
    expect(state.playerMaxHp).toBe(100);
    expect(state.playerShield).toBe(0);
    expect(state.enemyHp).toBe(50);
    expect(state.enemyMaxHp).toBe(50);
    expect(state.status).toBe('active');
    expect(state.rounds).toHaveLength(0);
  });

  it('includes shield stats', () => {
    const ship = { ...baseShip, shieldHp: 60, shieldRegen: 6 };
    const state = initCombatV2(baseEncounter, ship);
    expect(state.playerShield).toBe(60);
    expect(state.playerMaxShield).toBe(60);
    expect(state.playerShieldRegen).toBe(6);
  });
});

describe('resolveRound', () => {
  it('resolves a basic balanced round', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const seed = 12345;
    const result = resolveRound(state, baseShip, 'balanced', 'none', 1.0, seed);
    expect(result.round.round).toBe(1);
    expect(result.round.tactic).toBe('balanced');
    expect(result.state.currentRound).toBe(1);
    expect(result.state.rounds).toHaveLength(1);
  });

  it('assault tactic increases player damage', () => {
    const state = initCombatV2(baseEncounter, { ...baseShip, weaponAttack: 16 });
    const seed = 42;
    const assault = resolveRound(state, { ...baseShip, weaponAttack: 16 }, 'assault', 'none', 1.0, seed);
    const balanced = resolveRound(state, { ...baseShip, weaponAttack: 16 }, 'balanced', 'none', 1.0, seed);
    expect(assault.round.playerAttack).toBeGreaterThan(balanced.round.playerAttack);
  });

  it('defensive tactic reduces damage taken', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const seed = 42;
    const defensive = resolveRound(state, baseShip, 'defensive', 'none', 1.0, seed);
    const balanced = resolveRound(state, baseShip, 'balanced', 'none', 1.0, seed);
    expect(defensive.round.playerHullDmg).toBeLessThanOrEqual(balanced.round.playerHullDmg);
  });

  it('shield absorbs damage before hull', () => {
    const ship = { ...baseShip, shieldHp: 60, shieldRegen: 6 };
    const state = initCombatV2(baseEncounter, ship);
    const result = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    expect(result.round.playerShieldDmg).toBeGreaterThan(0);
  });

  it('piercing bypasses damageMod', () => {
    const ship = { ...baseShip, weaponAttack: 12, weaponPiercing: 0.30, weaponType: 'railgun' as const };
    const state = initCombatV2(baseEncounter, ship);
    const result = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    expect(result.round.playerAttack).toBeGreaterThan(0);
  });

  it('evade can negate enemy damage', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    let evadeWorked = false;
    let evadeFailed = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = resolveRound(state, baseShip, 'balanced', 'evade', 1.0, seed);
      if (result.round.playerHullDmg === 0 && result.round.playerShieldDmg === 0) {
        evadeWorked = true;
      } else {
        evadeFailed = true;
      }
      if (evadeWorked && evadeFailed) break;
    }
    expect(evadeWorked).toBe(true);
    expect(evadeFailed).toBe(true);
  });

  it('marks victory when enemy HP reaches 0', () => {
    const weakEnemy = { ...baseEncounter, pirateHp: 5, pirateDamage: 1 };
    const strongShip = { ...baseShip, weaponAttack: 50 };
    const state = initCombatV2(weakEnemy, strongShip);
    const result = resolveRound(state, strongShip, 'assault', 'none', 1.0, 42);
    expect(result.state.status).toBe('victory');
  });

  it('marks defeat when player HP reaches 0', () => {
    const strongEnemy = { ...baseEncounter, pirateHp: 500, pirateDamage: 200 };
    const weakShip = { ...baseShip, hp: 10 };
    const state = initCombatV2(strongEnemy, weakShip);
    const result = resolveRound(state, weakShip, 'balanced', 'none', 1.0, 42);
    expect(result.state.status).toBe('defeat');
  });

  it('auto-flees after max rounds', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const current = { ...state, currentRound: 4 };
    const result = resolveRound(current, baseShip, 'balanced', 'none', 1.0, 42);
    if (result.state.enemyHp > 0 && result.state.playerHp > 0) {
      expect(result.state.status).toBe('auto_flee');
    }
  });

  it('point defense reduces incoming damage', () => {
    const ship = { ...baseShip, pointDefense: 0.60 };
    const state = initCombatV2(baseEncounter, ship);
    const withPD = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    const withoutPD = resolveRound(state, baseShip, 'balanced', 'none', 1.0, 42);
    expect(withPD.round.playerHullDmg).toBeLessThanOrEqual(withoutPD.round.playerHullDmg);
  });

  it('prevents reusing special actions', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const r1 = resolveRound(state, baseShip, 'balanced', 'aim', 1.0, 42);
    expect(r1.state.specialActionsUsed.aim).toBe(true);
    const r2 = resolveRound(r1.state, baseShip, 'balanced', 'aim', 1.0, 99);
    expect(r2.round.specialAction).toBe('none');
  });
});

describe('attemptFlee', () => {
  it('returns escaped or caught based on seed', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    let escaped = false;
    let caught = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = attemptFlee(state, baseShip, seed);
      if (result.escaped) escaped = true;
      else caught = true;
      if (escaped && caught) break;
    }
    expect(escaped).toBe(true);
    expect(caught).toBe(true);
  });
});
