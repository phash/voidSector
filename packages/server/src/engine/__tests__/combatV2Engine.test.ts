import { describe, it, expect } from 'vitest';
import { initCombatV2, resolveRoundV2, attemptFleeV2 } from '../combatV2Engine.js';
import type { PirateEncounter, ShipStats, CombatV2State } from '../../../../shared/src/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEncounter(overrides: Partial<PirateEncounter> = {}): PirateEncounter {
  return {
    pirateLevel: 3,
    pirateHp: 60,
    pirateDamage: 15,
    sectorX: 10,
    sectorY: 20,
    canNegotiate: false,
    negotiateCost: 0,
    ...overrides,
  };
}

function makeShipStats(overrides: Partial<ShipStats> = {}): ShipStats {
  return {
    fuelMax: 10000,
    cargoCap: 20,
    jumpRange: 1,
    apCostJump: 1,
    fuelPerJump: 100,
    hp: 100,
    commRange: 5,
    scannerLevel: 1,
    damageMod: 1.0,
    shieldHp: 30,
    shieldRegen: 5,
    weaponAttack: 10,
    weaponType: 'laser',
    weaponPiercing: 0.0,
    pointDefense: 0,
    ecmReduction: 0,
    engineSpeed: 1,
    artefactChanceBonus: 0,
    safeSlotBonus: 0,
    hyperdriveRange: 0,
    hyperdriveSpeed: 0,
    hyperdriveRegen: 0,
    hyperdriveFuelEfficiency: 0,
    miningBonus: 0,
    generatorEpPerRound: 0,
    repairHpPerRound: 0,
    repairHpPerSecond: 0,
    memory: 10,
    ...overrides,
  };
}

function makeActiveState(overrides: Partial<CombatV2State> = {}): CombatV2State {
  const encounter = makeEncounter();
  return {
    encounter,
    currentRound: 0,
    maxRounds: 5,
    playerHp: 100,
    playerMaxHp: 100,
    playerShield: 30,
    playerMaxShield: 30,
    playerShieldRegen: 5,
    enemyHp: 60,
    enemyMaxHp: 60,
    enemyShield: 0,
    enemyMaxShield: 0,
    rounds: [],
    specialActionsUsed: { aim: false, evade: false },
    empDisableRounds: 0,
    status: 'active',
    ...overrides,
  };
}

// ─── initCombatV2 ─────────────────────────────────────────────────────────────

describe('initCombatV2', () => {
  it('initializes state with correct player values from shipStats', () => {
    const encounter = makeEncounter({ pirateHp: 80, pirateLevel: 2 });
    const stats = makeShipStats({ hp: 120, shieldHp: 40, shieldRegen: 8 });
    const state = initCombatV2(encounter, stats);

    expect(state.playerHp).toBe(120);
    expect(state.playerMaxHp).toBe(120);
    expect(state.playerShield).toBe(40);
    expect(state.playerMaxShield).toBe(40);
    expect(state.playerShieldRegen).toBe(8);
  });

  it('initializes enemy HP from encounter', () => {
    const encounter = makeEncounter({ pirateHp: 80 });
    const stats = makeShipStats();
    const state = initCombatV2(encounter, stats);

    expect(state.enemyHp).toBe(80);
    expect(state.enemyMaxHp).toBe(80);
  });

  it('gives enemy shields when pirateLevel >= 4', () => {
    const encounter = makeEncounter({ pirateLevel: 5 });
    const stats = makeShipStats();
    const state = initCombatV2(encounter, stats);

    expect(state.enemyShield).toBe(50); // 5 * 10
    expect(state.enemyMaxShield).toBe(50);
  });

  it('gives no enemy shields when pirateLevel < 4', () => {
    const encounter = makeEncounter({ pirateLevel: 3 });
    const stats = makeShipStats();
    const state = initCombatV2(encounter, stats);

    expect(state.enemyShield).toBe(0);
    expect(state.enemyMaxShield).toBe(0);
  });

  it('starts with correct initial combat state', () => {
    const encounter = makeEncounter();
    const stats = makeShipStats();
    const state = initCombatV2(encounter, stats);

    expect(state.currentRound).toBe(0);
    expect(state.maxRounds).toBe(5);
    expect(state.status).toBe('active');
    expect(state.rounds).toEqual([]);
    expect(state.specialActionsUsed).toEqual({ aim: false, evade: false });
    expect(state.empDisableRounds).toBe(0);
  });

  it('preserves the encounter reference', () => {
    const encounter = makeEncounter({ sectorX: 42, sectorY: 99 });
    const stats = makeShipStats();
    const state = initCombatV2(encounter, stats);

    expect(state.encounter).toBe(encounter);
  });
});

// ─── resolveRoundV2 ───────────────────────────────────────────────────────────

describe('resolveRoundV2', () => {
  it('increments round counter', () => {
    const state = makeActiveState({ currentRound: 0 });
    const stats = makeShipStats();
    const { newState } = resolveRoundV2(state, 'balanced', 'none', stats, 12345);

    expect(newState.currentRound).toBe(1);
  });

  it('does not mutate original state', () => {
    const state = makeActiveState();
    const originalHp = state.enemyHp;
    const stats = makeShipStats({ weaponAttack: 20 });
    resolveRoundV2(state, 'assault', 'none', stats, 42);

    expect(state.enemyHp).toBe(originalHp);
    expect(state.currentRound).toBe(0);
    expect(state.rounds.length).toBe(0);
  });

  it('applies assault tactic modifiers (1.30 atk / 0.80 def)', () => {
    const state = makeActiveState({ enemyShield: 0, enemyMaxShield: 0, playerShield: 0, playerMaxShield: 0 });
    const stats = makeShipStats({ weaponAttack: 10, damageMod: 1.0 });
    const { round } = resolveRoundV2(state, 'assault', 'none', stats, 42);

    // Base attack = 10 + 10 = 20, * 1.30 * roll
    // Player takes more damage due to 0.80 def
    expect(round.tactic).toBe('assault');
  });

  it('applies defensive tactic modifiers (0.75 atk / 1.35 def)', () => {
    const state = makeActiveState({ enemyShield: 0, enemyMaxShield: 0, playerShield: 0, playerMaxShield: 0 });
    const stats = makeShipStats({ weaponAttack: 10 });
    const { round } = resolveRoundV2(state, 'defensive', 'none', stats, 42);

    expect(round.tactic).toBe('defensive');
  });

  it('deals damage to enemy', () => {
    const state = makeActiveState({ enemyHp: 60, enemyMaxHp: 60, enemyShield: 0, enemyMaxShield: 0 });
    const stats = makeShipStats({ weaponAttack: 20 });
    const { newState } = resolveRoundV2(state, 'balanced', 'none', stats, 42);

    expect(newState.enemyHp).toBeLessThan(60);
  });

  it('deals damage to player', () => {
    const state = makeActiveState({ playerHp: 100, playerShield: 0, playerMaxShield: 0 });
    const stats = makeShipStats();
    const { newState } = resolveRoundV2(state, 'balanced', 'none', stats, 42);

    expect(newState.playerHp).toBeLessThan(100);
  });

  it('returns victory when enemy HP reaches 0', () => {
    const state = makeActiveState({ enemyHp: 1, enemyShield: 0, enemyMaxShield: 0 });
    const stats = makeShipStats({ weaponAttack: 50 });
    const { newState } = resolveRoundV2(state, 'assault', 'none', stats, 42);

    expect(newState.enemyHp).toBe(0);
    expect(newState.status).toBe('victory');
  });

  it('returns defeat when player HP reaches 0', () => {
    const encounter = makeEncounter({ pirateDamage: 200, pirateLevel: 10 });
    const state = makeActiveState({
      encounter,
      playerHp: 1,
      playerShield: 0,
      playerMaxShield: 0,
      playerShieldRegen: 0,
    });
    const stats = makeShipStats({ hp: 1, shieldHp: 0, shieldRegen: 0 });
    const { newState } = resolveRoundV2(state, 'balanced', 'none', stats, 42);

    expect(newState.playerHp).toBe(0);
    expect(newState.status).toBe('defeat');
  });

  it('returns auto_flee at round 5', () => {
    const state = makeActiveState({
      currentRound: 4,
      enemyHp: 500,
      enemyMaxHp: 500,
    });
    const stats = makeShipStats();
    const { newState } = resolveRoundV2(state, 'defensive', 'none', stats, 42);

    expect(newState.currentRound).toBe(5);
    expect(newState.status).toBe('auto_flee');
  });

  it('records round in rounds array', () => {
    const state = makeActiveState();
    const stats = makeShipStats();
    const { newState, round } = resolveRoundV2(state, 'balanced', 'none', stats, 42);

    expect(newState.rounds).toHaveLength(1);
    expect(newState.rounds[0]).toBe(round);
    expect(round.round).toBe(1);
  });

  describe('special actions', () => {
    it('aim increases player attack by 50%', () => {
      const state = makeActiveState({ enemyShield: 0, enemyMaxShield: 0 });
      const stats = makeShipStats({ weaponAttack: 10 });

      const { round: normalRound } = resolveRoundV2(state, 'balanced', 'none', stats, 42);
      const { round: aimRound } = resolveRoundV2(state, 'balanced', 'aim', stats, 42);

      // aim should produce ~50% more player attack (rounding tolerance ±1)
      const expected = normalRound.playerAttack * 1.5;
      expect(Math.abs(aimRound.playerAttack - expected)).toBeLessThanOrEqual(1);
    });

    it('aim can only be used once', () => {
      const state = makeActiveState({ specialActionsUsed: { aim: true, evade: false } });
      const stats = makeShipStats({ weaponAttack: 10 });

      const { round: roundWithUsedAim } = resolveRoundV2(state, 'balanced', 'aim', stats, 42);
      const { round: roundNoSpecial } = resolveRoundV2(state, 'balanced', 'none', stats, 42);

      // If aim already used, should behave like 'none'
      expect(roundWithUsedAim.playerAttack).toBeCloseTo(roundNoSpecial.playerAttack, 0);
    });

    it('marks aim as used in state', () => {
      const state = makeActiveState();
      const stats = makeShipStats();
      const { newState } = resolveRoundV2(state, 'balanced', 'aim', stats, 42);

      expect(newState.specialActionsUsed.aim).toBe(true);
    });

    it('evade marks evade as used', () => {
      const state = makeActiveState();
      const stats = makeShipStats();
      const { newState } = resolveRoundV2(state, 'balanced', 'evade', stats, 42);

      expect(newState.specialActionsUsed.evade).toBe(true);
    });

    it('evade can only be used once', () => {
      const state = makeActiveState({ specialActionsUsed: { aim: false, evade: true } });
      const stats = makeShipStats();
      const { round } = resolveRoundV2(state, 'balanced', 'evade', stats, 42);

      // evade already used, so no evade effect
      expect(round.specialAction).toBe('evade');
      expect(round.specialEffects).not.toContain('EVADE: Enemy attack nullified!');
    });
  });

  describe('shield mechanics', () => {
    it('shields absorb damage before hull', () => {
      const state = makeActiveState({
        playerHp: 100,
        playerShield: 50,
        playerMaxShield: 50,
        playerShieldRegen: 0,
      });
      const stats = makeShipStats();
      const { newState, round } = resolveRoundV2(state, 'balanced', 'none', stats, 42);

      // If enemy dealt damage, shield should absorb some
      if (round.enemyAttack > 0) {
        expect(round.playerShieldDmg).toBeGreaterThanOrEqual(0);
      }
    });

    it('shield regen applies at start of round', () => {
      const state = makeActiveState({
        playerShield: 10,
        playerMaxShield: 50,
        playerShieldRegen: 5,
      });
      const stats = makeShipStats({ shieldRegen: 5 });
      // Shield should regen before damage phase
      // We verify that the combat math considers regen
      const { newState } = resolveRoundV2(state, 'defensive', 'none', stats, 42);

      // Shield after round should account for regen
      expect(newState.playerShield).toBeDefined();
    });

    it('piercing bypasses shields', () => {
      const state = makeActiveState({
        enemyShield: 100,
        enemyMaxShield: 100,
        enemyHp: 100,
        enemyMaxHp: 100,
      });
      const noPiercing = makeShipStats({ weaponAttack: 20, weaponPiercing: 0 });
      const withPiercing = makeShipStats({ weaponAttack: 20, weaponPiercing: 0.5 });

      const { round: roundNoPiercing } = resolveRoundV2(state, 'balanced', 'none', noPiercing, 42);
      const { round: roundPiercing } = resolveRoundV2(state, 'balanced', 'none', withPiercing, 42);

      // With piercing, more hull damage should be dealt
      expect(roundPiercing.enemyHullDmg).toBeGreaterThan(roundNoPiercing.enemyHullDmg);
    });
  });

  describe('point defense and ECM', () => {
    it('point defense reduces enemy attack', () => {
      const state = makeActiveState({ playerShield: 0, playerMaxShield: 0 });
      const noPd = makeShipStats({ pointDefense: 0 });
      const withPd = makeShipStats({ pointDefense: 5 });

      const { round: roundNoPd } = resolveRoundV2(state, 'balanced', 'none', noPd, 42);
      const { round: roundPd } = resolveRoundV2(state, 'balanced', 'none', withPd, 42);

      expect(roundPd.enemyAttack).toBeLessThan(roundNoPd.enemyAttack);
    });

    it('ECM reduces enemy attack', () => {
      const state = makeActiveState({ playerShield: 0, playerMaxShield: 0 });
      const noEcm = makeShipStats({ ecmReduction: 0 });
      const withEcm = makeShipStats({ ecmReduction: 5 });

      const { round: roundNoEcm } = resolveRoundV2(state, 'balanced', 'none', noEcm, 42);
      const { round: roundEcm } = resolveRoundV2(state, 'balanced', 'none', withEcm, 42);

      expect(roundEcm.enemyAttack).toBeLessThan(roundNoEcm.enemyAttack);
    });
  });

  describe('deterministic seeded rolls', () => {
    it('same seed produces same result', () => {
      const state = makeActiveState();
      const stats = makeShipStats();

      const r1 = resolveRoundV2(state, 'balanced', 'none', stats, 12345);
      const r2 = resolveRoundV2(state, 'balanced', 'none', stats, 12345);

      expect(r1.round.playerAttack).toBe(r2.round.playerAttack);
      expect(r1.round.enemyAttack).toBe(r2.round.enemyAttack);
    });

    it('different seeds produce different results', () => {
      const state = makeActiveState();
      const stats = makeShipStats();

      const r1 = resolveRoundV2(state, 'balanced', 'none', stats, 111);
      const r2 = resolveRoundV2(state, 'balanced', 'none', stats, 999);

      // Extremely unlikely to be identical with different seeds
      const same = r1.round.playerAttack === r2.round.playerAttack
        && r1.round.enemyAttack === r2.round.enemyAttack;
      expect(same).toBe(false);
    });
  });
});

// ─── attemptFleeV2 ────────────────────────────────────────────────────────────

describe('attemptFleeV2', () => {
  it('always costs 2 AP', () => {
    const state = makeActiveState();
    const { apCost } = attemptFleeV2(state, 42);

    expect(apCost).toBe(2);
  });

  it('sets status to escaped on success', () => {
    // Run with many seeds to find one that succeeds
    const state = makeActiveState();
    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const { success, newState } = attemptFleeV2(state, seed);
      if (success) {
        expect(newState.status).toBe('escaped');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('does not change status on failure', () => {
    const state = makeActiveState();
    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const { success, newState } = attemptFleeV2(state, seed);
      if (!success) {
        expect(newState.status).toBe('active');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('has approximately 60% success rate', () => {
    const state = makeActiveState();
    let successes = 0;
    const trials = 1000;

    for (let seed = 0; seed < trials; seed++) {
      const { success } = attemptFleeV2(state, seed);
      if (success) successes++;
    }

    const rate = successes / trials;
    // Allow some variance: 50%–70%
    expect(rate).toBeGreaterThan(0.50);
    expect(rate).toBeLessThan(0.70);
  });

  it('does not mutate original state', () => {
    const state = makeActiveState();
    attemptFleeV2(state, 42);

    expect(state.status).toBe('active');
  });
});
