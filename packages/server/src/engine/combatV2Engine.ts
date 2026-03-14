import type {
  PirateEncounter,
  ShipStats,
  CombatV2State,
  CombatRound,
  CombatTactic,
  SpecialAction,
} from '../../../shared/src/types.js';

// ─── Tactic Modifiers ─────────────────────────────────────────────────────────

const TACTIC_MODIFIERS: Record<CombatTactic, { atk: number; def: number }> = {
  assault: { atk: 1.30, def: 0.80 },
  balanced: { atk: 1.00, def: 1.00 },
  defensive: { atk: 0.75, def: 1.35 },
};

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

/**
 * Deterministic roll in [0.85, 1.15] using a hash-based seeded RNG.
 * offset differentiates player vs enemy roll within the same round.
 */
function seededRoll(seed: number, roundNum: number, offset: number): number {
  const hash = ((seed * 2654435761 + roundNum * 31 + offset * 17) >>> 0);
  return hash / 0x100000000 * 0.30 + 0.85;
}

// ─── Deep Clone ───────────────────────────────────────────────────────────────

function cloneState(state: CombatV2State): CombatV2State {
  return {
    ...state,
    encounter: { ...state.encounter },
    rounds: [...state.rounds],
    specialActionsUsed: { ...state.specialActionsUsed },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize a CombatV2State from encounter data and ship stats.
 *
 * Player HP/shield from shipStats, enemy HP from encounter.
 * Enemy gets shields at pirateLevel >= 4 (pirateLevel * 10).
 */
export function initCombatV2(encounter: PirateEncounter, shipStats: ShipStats): CombatV2State {
  const enemyShield = encounter.pirateLevel >= 4
    ? encounter.pirateLevel * 10
    : 0;

  return {
    encounter,
    currentRound: 0,
    maxRounds: 5,
    playerHp: shipStats.hp,
    playerMaxHp: shipStats.hp,
    playerShield: shipStats.shieldHp,
    playerMaxShield: shipStats.shieldHp,
    playerShieldRegen: shipStats.shieldRegen,
    enemyHp: encounter.pirateHp,
    enemyMaxHp: encounter.pirateHp,
    enemyShield,
    enemyMaxShield: enemyShield,
    rounds: [],
    specialActionsUsed: { aim: false, evade: false },
    empDisableRounds: 0,
    status: 'active',
  };
}

/**
 * Resolve one round of combat V2.
 *
 * Pure function — returns the new round data and updated state without mutating input.
 */
export function resolveRoundV2(
  state: CombatV2State,
  tactic: CombatTactic,
  specialAction: SpecialAction,
  shipStats: ShipStats,
  seed: number,
): { round: CombatRound; newState: CombatV2State } {
  const s = cloneState(state);
  const roundNum = s.currentRound + 1;
  s.currentRound = roundNum;

  const tacticMod = TACTIC_MODIFIERS[tactic];
  const specialEffects: string[] = [];

  // ── Shield regen at start of round ──────────────────────────────────────────
  s.playerShield = Math.min(
    s.playerMaxShield,
    s.playerShield + s.playerShieldRegen,
  );

  // ── Determine effective special action ──────────────────────────────────────
  let effectiveAim = false;
  let effectiveEvade = false;

  if (specialAction === 'aim' && !s.specialActionsUsed.aim) {
    effectiveAim = true;
    s.specialActionsUsed.aim = true;
    specialEffects.push('AIM: Attack power increased by 50%!');
  }
  if (specialAction === 'evade' && !s.specialActionsUsed.evade) {
    effectiveEvade = true;
    s.specialActionsUsed.evade = true;
  }

  // ── Player attack ───────────────────────────────────────────────────────────
  const baseAttack = 10 + shipStats.weaponAttack;
  const playerRoll = seededRoll(seed, roundNum, 0);
  let playerAttackRaw = baseAttack * tacticMod.atk * playerRoll;

  // Aim: +50% attack multiplier
  if (effectiveAim) {
    playerAttackRaw *= 1.5;
  }

  // Apply damageMod
  playerAttackRaw *= shipStats.damageMod;

  const playerAttack = Math.round(playerAttackRaw);

  // ── Player damage → enemy (piercing + shield absorption) ────────────────────
  const piercingFraction = shipStats.weaponPiercing;
  const piercingDamage = Math.floor(playerAttack * piercingFraction);
  const shieldableDamage = playerAttack - piercingDamage;

  const enemyShieldAbsorbed = Math.min(s.enemyShield, shieldableDamage);
  s.enemyShield -= enemyShieldAbsorbed;
  const enemyShieldDmg = enemyShieldAbsorbed;

  const throughShieldDamage = shieldableDamage - enemyShieldAbsorbed;
  const enemyHullDmg = throughShieldDamage + piercingDamage;
  s.enemyHp = Math.max(0, s.enemyHp - enemyHullDmg);

  // ── Enemy attack ────────────────────────────────────────────────────────────
  const enemyRoll = seededRoll(seed, roundNum, 1);
  let enemyAttackRaw = state.encounter.pirateDamage * enemyRoll;

  // Point defense reduces enemy attack
  if (shipStats.pointDefense > 0) {
    enemyAttackRaw = Math.max(0, enemyAttackRaw - shipStats.pointDefense);
  }

  // ECM reduces enemy attack
  if (shipStats.ecmReduction > 0) {
    enemyAttackRaw = Math.max(0, enemyAttackRaw - shipStats.ecmReduction);
  }

  // Evade: ~50% chance enemy attack becomes 0
  if (effectiveEvade) {
    const evadeRoll = seededRoll(seed, roundNum, 2);
    if (evadeRoll < 1.0) {
      // evade range [0.85, 1.15], < 1.0 is ~50%
      enemyAttackRaw = 0;
      specialEffects.push('EVADE: Enemy attack nullified!');
    } else {
      specialEffects.push('EVADE: Failed to dodge!');
    }
  }

  const enemyAttack = Math.round(enemyAttackRaw);

  // ── Enemy damage → player (shield absorption, defense modifier) ─────────────
  const playerShieldAbsorbed = Math.min(s.playerShield, enemyAttack);
  s.playerShield -= playerShieldAbsorbed;
  const playerShieldDmg = playerShieldAbsorbed;

  const remainingDamage = enemyAttack - playerShieldAbsorbed;
  // Defense modifier from tactic reduces hull damage
  const playerHullDmg = Math.round(remainingDamage / tacticMod.def);
  s.playerHp = Math.max(0, s.playerHp - playerHullDmg);

  // ── Build round record ──────────────────────────────────────────────────────
  const round: CombatRound = {
    round: roundNum,
    tactic,
    specialAction,
    playerAttack,
    enemyAttack,
    playerShieldDmg,
    playerHullDmg,
    enemyShieldDmg,
    enemyHullDmg,
    playerShieldAfter: s.playerShield,
    playerHpAfter: s.playerHp,
    enemyShieldAfter: s.enemyShield,
    enemyHpAfter: s.enemyHp,
    specialEffects,
  };

  s.rounds.push(round);

  // ── Determine outcome ───────────────────────────────────────────────────────
  if (s.enemyHp <= 0) {
    s.status = 'victory';
  } else if (s.playerHp <= 0) {
    s.status = 'defeat';
  } else if (s.currentRound >= s.maxRounds) {
    s.status = 'auto_flee';
  }

  return { round, newState: s };
}

/**
 * Attempt to flee from combat.
 *
 * 60% base success chance, always costs 2 AP.
 * On success, status becomes 'escaped'.
 */
export function attemptFleeV2(
  state: CombatV2State,
  seed: number,
): { success: boolean; apCost: number; newState: CombatV2State } {
  const s = cloneState(state);
  const apCost = 2;

  // Deterministic flee roll using seed
  const roll = ((seed * 2654435761) >>> 0) / 0x100000000;
  const success = roll < 0.60;

  if (success) {
    s.status = 'escaped';
  }

  return { success, apCost, newState: s };
}
