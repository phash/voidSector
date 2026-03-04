import {
  STATION_COMBAT_MAX_ROUNDS,
  PIRATE_BASE_DAMAGE,
  PIRATE_DAMAGE_PER_LEVEL,
  PIRATE_BASE_HP,
  PIRATE_HP_PER_LEVEL,
  COMBAT_V2_ROLL_MIN,
  COMBAT_V2_ROLL_MAX,
} from '@void-sector/shared';

interface StationCombatInput {
  stationHp: number;
  stationMaxHp: number;
  stationShieldHp: number;
  stationShieldRegen: number;
  turretDamage: number;
  ionCannonDamage: number;
  pirateLevel: number;
  seed: number;
}

interface StationCombatResult {
  outcome: 'defended' | 'damaged' | 'destroyed';
  hpLost: number;
  roundsPlayed: number;
}

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

export function resolveStationCombat(input: StationCombatInput): StationCombatResult {
  let stationHp = input.stationHp;
  let shield = input.stationShieldHp;
  const shieldMax = input.stationShieldHp;
  let pirateHp = PIRATE_BASE_HP + input.pirateLevel * PIRATE_HP_PER_LEVEL;
  const pirateDmg = PIRATE_BASE_DAMAGE + input.pirateLevel * PIRATE_DAMAGE_PER_LEVEL;
  let ionFired = false;
  let round = 0;

  for (round = 1; round <= STATION_COMBAT_MAX_ROUNDS; round++) {
    // Shield regen
    shield = Math.min(shieldMax, shield + input.stationShieldRegen);

    // Station attacks
    const turretRoll = combatRoll(input.seed, round);
    const turretDmg = Math.floor(input.turretDamage * turretRoll);
    pirateHp -= turretDmg;

    // Ion cannon (once per combat, bypasses shields)
    if (!ionFired && input.ionCannonDamage > 0) {
      pirateHp -= input.ionCannonDamage;
      ionFired = true;
    }

    if (pirateHp <= 0) break;

    // Pirate attacks
    const pirateRoll = combatRoll(input.seed, round + 50);
    const rawPirateDmg = Math.floor(pirateDmg * pirateRoll);

    // Shield absorbs first
    const shieldAbsorb = Math.min(rawPirateDmg, shield);
    shield -= shieldAbsorb;
    const hullDmg = rawPirateDmg - shieldAbsorb;
    stationHp -= hullDmg;

    if (stationHp <= 0) break;
  }

  const hpLost = Math.max(0, input.stationHp - Math.max(0, stationHp));

  if (stationHp <= 0) {
    return { outcome: 'destroyed', hpLost: input.stationHp, roundsPlayed: round };
  }
  if (hpLost > 0) {
    return { outcome: 'damaged', hpLost, roundsPlayed: round };
  }
  return { outcome: 'defended', hpLost: 0, roundsPlayed: round };
}
