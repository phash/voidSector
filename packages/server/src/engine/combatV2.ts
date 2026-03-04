import {
  COMBAT_V2_MAX_ROUNDS,
  COMBAT_V2_ROLL_MIN,
  COMBAT_V2_ROLL_MAX,
  TACTIC_MODS,
  AIM_ACCURACY_BONUS,
  AIM_DISABLE_CHANCE,
  EVADE_CHANCE,
  EMP_HIT_CHANCE,
  EMP_DISABLE_ROUNDS,
  BATTLE_FLEE_BASE_CHANCE,
  PIRATE_BASE_DAMAGE,
  PIRATE_DAMAGE_PER_LEVEL,
} from '@void-sector/shared';
import type {
  PirateEncounter,
  ShipStats,
  CombatTactic,
  SpecialAction,
  CombatV2State,
  CombatRound,
} from '@void-sector/shared';

/** Seeded pseudo-random: returns 0..1 */
function seededRng(seed: number, offset: number): number {
  let h = ((seed * 2654435761) ^ (offset * 1597334677)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 10000) / 10000;
}

/** Roll within combat range */
function combatRoll(seed: number, offset: number): number {
  const r = seededRng(seed, offset);
  return COMBAT_V2_ROLL_MIN + r * (COMBAT_V2_ROLL_MAX - COMBAT_V2_ROLL_MIN);
}

export function initCombatV2(
  encounter: PirateEncounter,
  ship: ShipStats,
): CombatV2State {
  return {
    encounter,
    currentRound: 0,
    maxRounds: COMBAT_V2_MAX_ROUNDS,
    playerHp: ship.hp,
    playerMaxHp: ship.hp,
    playerShield: ship.shieldHp,
    playerMaxShield: ship.shieldHp,
    playerShieldRegen: ship.shieldRegen,
    enemyHp: encounter.pirateHp,
    enemyMaxHp: encounter.pirateHp,
    enemyShield: 0,
    enemyMaxShield: 0,
    rounds: [],
    specialActionsUsed: { aim: false, evade: false },
    empDisableRounds: 0,
    status: 'active',
  };
}

export function resolveRound(
  state: CombatV2State,
  ship: ShipStats,
  tactic: CombatTactic,
  specialAction: SpecialAction,
  combatMultiplier: number,
  seed: number,
): { round: CombatRound; state: CombatV2State } {
  const roundNum = state.currentRound + 1;

  // Prevent reuse of special actions
  let effectiveSpecial = specialAction;
  if (specialAction === 'aim' && state.specialActionsUsed.aim) effectiveSpecial = 'none';
  if (specialAction === 'evade' && state.specialActionsUsed.evade) effectiveSpecial = 'none';

  // Shield regeneration at round start
  let currentShield = Math.min(
    state.playerMaxShield,
    state.playerShield + state.playerShieldRegen,
  );
  let playerHp = state.playerHp;
  let enemyHp = state.enemyHp;
  let enemyShield = state.enemyShield;

  // EMP countdown
  let empDisableRounds = Math.max(0, state.empDisableRounds - 1);

  const tacticMod = TACTIC_MODS[tactic] ?? TACTIC_MODS.balanced;
  const specialEffects: string[] = [];

  // --- PLAYER ATTACK ---
  const baseAttack = 10;
  const weaponBonus = ship.weaponAttack;
  let rawPlayerAtk = (baseAttack + weaponBonus) * combatMultiplier * tacticMod.dmg;

  // AIM bonus
  if (effectiveSpecial === 'aim') {
    rawPlayerAtk *= (1 + AIM_ACCURACY_BONUS);
    specialEffects.push('ZIELEN aktiv \u2014 +50% Trefferchance');
  }

  const playerRoll = combatRoll(seed, roundNum);
  let playerFinalAtk = Math.floor(rawPlayerAtk * playerRoll);

  // EMP: no direct damage, but disables enemy shields
  if (ship.weaponType === 'emp') {
    playerFinalAtk = 0;
    const empRoll = seededRng(seed, roundNum + 100);
    if (empRoll < EMP_HIT_CHANCE) {
      empDisableRounds = EMP_DISABLE_ROUNDS;
      specialEffects.push('EMP TREFFER \u2014 Feind-Schilde deaktiviert f\u00fcr 2 Runden');
    } else {
      specialEffects.push('EMP VERFEHLT');
    }
  }

  // AIM disable chance
  if (effectiveSpecial === 'aim' && ship.weaponType !== 'emp') {
    const disableRoll = seededRng(seed, roundNum + 200);
    if (disableRoll < AIM_DISABLE_CHANCE) {
      specialEffects.push('SYSTEM GETROFFEN \u2014 Feind-Waffe/Schild deaktiviert');
    }
  }

  // Apply player damage to enemy
  let enemyShieldDmg = 0;
  let enemyHullDmg = 0;
  if (playerFinalAtk > 0) {
    if (ship.weaponPiercing > 0) {
      const piercedDmg = Math.floor(playerFinalAtk * ship.weaponPiercing);
      const normalDmg = playerFinalAtk - piercedDmg;
      if (empDisableRounds <= 0 && enemyShield > 0) {
        enemyShieldDmg = Math.min(normalDmg, enemyShield);
        enemyShield -= enemyShieldDmg;
        const afterShield = normalDmg - enemyShieldDmg;
        enemyHullDmg = piercedDmg + afterShield;
      } else {
        enemyHullDmg = piercedDmg + normalDmg;
      }
    } else {
      if (empDisableRounds <= 0 && enemyShield > 0) {
        enemyShieldDmg = Math.min(playerFinalAtk, enemyShield);
        enemyShield -= enemyShieldDmg;
        enemyHullDmg = playerFinalAtk - enemyShieldDmg;
      } else {
        enemyHullDmg = playerFinalAtk;
      }
    }
  }
  enemyHp = Math.max(0, enemyHp - enemyHullDmg);

  // --- ENEMY ATTACK ---
  const enemyBase = PIRATE_BASE_DAMAGE + state.encounter.pirateLevel * PIRATE_DAMAGE_PER_LEVEL;
  const ecmPenalty = 1.0 - ship.ecmReduction;
  const enemyRoll = combatRoll(seed, roundNum + 50);
  let rawEnemyDmg = Math.floor(enemyBase * enemyRoll * ecmPenalty);

  // EVADE check
  let evadeSucceeded = false;
  if (effectiveSpecial === 'evade') {
    const evadeRoll = seededRng(seed, roundNum + 300);
    if (evadeRoll < EVADE_CHANCE) {
      rawEnemyDmg = 0;
      evadeSucceeded = true;
      specialEffects.push('AUSWEICHMAN\u00d6VER ERFOLGREICH \u2014 kein Schaden');
    } else {
      specialEffects.push('AUSWEICHMAN\u00d6VER GESCHEITERT');
    }
  }

  // Point defense
  if (!evadeSucceeded && ship.pointDefense > 0) {
    const pdReduction = Math.floor(rawEnemyDmg * ship.pointDefense);
    rawEnemyDmg = Math.max(0, rawEnemyDmg - pdReduction);
    if (pdReduction > 0) {
      specialEffects.push(`PUNKT-VERTEIDIGUNG f\u00e4ngt ${pdReduction} DMG ab`);
    }
  }

  // Apply defensive tactic mod
  const defMod = tacticMod.def;
  const enemyFinalDmg = evadeSucceeded ? 0 : Math.floor(rawEnemyDmg / defMod);

  // Apply enemy damage to player
  let playerShieldDmg = 0;
  let playerHullDmg = 0;
  if (enemyFinalDmg > 0) {
    playerShieldDmg = Math.min(enemyFinalDmg, currentShield);
    currentShield -= playerShieldDmg;
    const afterShield = enemyFinalDmg - playerShieldDmg;
    const armorFactor = ship.damageMod;
    playerHullDmg = Math.floor(afterShield * armorFactor);
    playerHp = Math.max(0, playerHp - playerHullDmg);
  }

  // Update special actions used
  const specialActionsUsed = { ...state.specialActionsUsed };
  if (effectiveSpecial === 'aim') specialActionsUsed.aim = true;
  if (effectiveSpecial === 'evade') specialActionsUsed.evade = true;

  // Determine status
  let status: CombatV2State['status'] = 'active';
  if (enemyHp <= 0) status = 'victory';
  else if (playerHp <= 0) status = 'defeat';
  else if (roundNum >= state.maxRounds) status = 'auto_flee';

  const round: CombatRound = {
    round: roundNum,
    tactic,
    specialAction: effectiveSpecial,
    playerAttack: playerFinalAtk,
    enemyAttack: enemyFinalDmg,
    playerShieldDmg,
    playerHullDmg,
    enemyShieldDmg,
    enemyHullDmg,
    playerShieldAfter: currentShield,
    playerHpAfter: playerHp,
    enemyShieldAfter: enemyShield,
    enemyHpAfter: enemyHp,
    specialEffects,
  };

  const newState: CombatV2State = {
    ...state,
    currentRound: roundNum,
    playerHp,
    playerShield: currentShield,
    enemyHp,
    enemyShield,
    rounds: [...state.rounds, round],
    specialActionsUsed,
    empDisableRounds,
    status,
  };

  return { round, state: newState };
}

export function attemptFlee(
  state: CombatV2State,
  ship: ShipStats,
  seed: number,
): { escaped: boolean; state: CombatV2State } {
  const fleeChance = BATTLE_FLEE_BASE_CHANCE + (ship.weaponAttack * 0.002) - (state.encounter.pirateLevel * 0.05);
  const roll = seededRng(seed, state.currentRound + 500);

  if (roll < fleeChance) {
    return {
      escaped: true,
      state: { ...state, status: 'escaped' },
    };
  }
  return { escaped: false, state };
}

/** Generate a BattleResult from a completed combat */
export function combatV2ToResult(
  state: CombatV2State,
  seed: number,
): {
  outcome: string;
  lootCredits?: number;
  lootResources?: Record<string, number>;
  lootArtefact?: number;
  repChange?: number;
  xpGained?: number;
} {
  if (state.status === 'victory') {
    const level = state.encounter.pirateLevel;
    const lootCredits = level * 10 + Math.floor(seededRng(seed, 900) * 50);
    const lootArtefact = seededRng(seed, 903) < 0.03 ? 1 : 0;  // 3% chance
    return {
      outcome: 'victory',
      lootCredits,
      lootResources: {
        ore: Math.floor(seededRng(seed, 901) * 3),
        crystal: Math.floor(seededRng(seed, 902) * 2),
      },
      lootArtefact,
      repChange: -3,
      xpGained: level * 5 + state.currentRound * 2,
    };
  }
  if (state.status === 'defeat') {
    return {
      outcome: 'defeat',
      xpGained: Math.ceil(state.encounter.pirateLevel * 2),
    };
  }
  return { outcome: 'escaped' };
}
