import type { CombatV3State, CombatModule, CombatV3RoundResult, NpcCombatStats } from '@void-sector/shared';

const TACTIC_MODIFIERS = {
  assault: { weaponDmg: 1.25, shieldRegen: 0.8 },
  balanced: { weaponDmg: 1.0, shieldRegen: 1.0 },
  defensive: { weaponDmg: 0.75, shieldRegen: 1.5 },
};

const BASE_ACCURACY = 0.85;
const MAX_ROUNDS = 10;
const FLEE_BASE_CHANCE = 0.6;
const SHIELD_VS_KINETIC = 0.25;  // kinetic does only 25% to shield
const SHIELD_VS_MISSILE = 0.25;  // missile does only 25% to shield

function seededRandom(seed: number, offset: number): number {
  let h = ((seed + offset) * 2654435761) >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  return ((h >> 16) ^ h >>> 0) / 0xFFFFFFFF;
}

export function initCombatV3(
  playerModules: CombatModule[],
  npcStats: NpcCombatStats,
): CombatV3State {
  // Find shield module
  const shieldMod = playerModules.find(m => m.category === 'shield');
  const playerShield = shieldMod ? (shieldMod.stats['shield'] ?? 0) : 0;
  const playerShieldRegen = shieldMod ? (shieldMod.stats['regen'] ?? 0) : 0;

  // Find armor module
  const armorMod = playerModules.find(m => m.category === 'armor');
  const playerArmorHp = armorMod ? armorMod.maxHp : 0;

  // Find generator — energyCost is negative for generators
  const generatorMod = playerModules.find(m => m.category === 'generator');
  const playerEnergyBudget = generatorMod ? Math.abs(generatorMod.energyCost) : 0;

  // All modules start active with hp = maxHp
  const modules: CombatModule[] = playerModules.map(m => ({
    ...m,
    active: true,
    hp: m.maxHp,
  }));

  return {
    round: 0,
    maxRounds: MAX_ROUNDS,
    playerShield,
    playerShieldMax: playerShield,
    playerShieldRegen,
    playerArmorHp,
    playerArmorMax: playerArmorHp,
    playerModules: modules,
    playerEnergyBudget,
    playerTactic: 'balanced',
    enemyShield: npcStats.shield,
    enemyShieldMax: npcStats.shield,
    enemyShieldRegen: npcStats.shieldRegen,
    enemyArmorHp: npcStats.armorHp,
    enemyArmorMax: npcStats.armorHp,
    enemyWeapons: npcStats.weapons,
    enemyAccuracy: npcStats.accuracy,
    enemyPvIntercept: npcStats.pvIntercept,
    enemyEcmReduction: npcStats.ecmReduction,
  };
}

export function validateEnergyBudget(
  state: CombatV3State,
  activeModuleIds: string[],
): { valid: boolean; totalCost: number; budget: number; error?: string } {
  const activeSet = new Set(activeModuleIds);
  // Sum energyCost of active modules — only positive costs count (generators have negative cost)
  const totalCost = state.playerModules
    .filter(m => activeSet.has(m.moduleId) && m.energyCost > 0)
    .reduce((sum, m) => sum + m.energyCost, 0);

  const budget = state.playerEnergyBudget;
  const valid = totalCost <= budget;

  return {
    valid,
    totalCost,
    budget,
    ...(valid ? {} : { error: `Energy cost ${totalCost} exceeds budget ${budget}` }),
  };
}

interface WeaponDamageResult {
  shieldDmg: number;
  armorDmg: number;
  moduleDmg: number;
  intercepted: boolean;
  missed: boolean;
  log: string;
}

function resolveWeaponDamage(
  weapon: { type: string; atk: number; piercing?: number },
  targetShield: number,
  targetArmorHp: number,
  targetModules: CombatModule[] | null,
  accuracy: number,
  pvIntercept: number,
  tacticMod: number,
  seed: number,
  seedOffset: number,
): WeaponDamageResult {
  let offset = seedOffset;

  // 1. Accuracy roll
  const accuracyRoll = seededRandom(seed, offset++);
  if (accuracyRoll >= accuracy) {
    return { shieldDmg: 0, armorDmg: 0, moduleDmg: 0, intercepted: false, missed: true, log: `${weapon.type} MISSED` };
  }

  // 2. Missile only: PV intercept roll
  if (weapon.type === 'missile') {
    const pvRoll = seededRandom(seed, offset++);
    if (pvRoll < pvIntercept) {
      return { shieldDmg: 0, armorDmg: 0, moduleDmg: 0, intercepted: true, missed: false, log: `${weapon.type} INTERCEPTED by point defense` };
    }
  }

  // 3. Apply tactic modifier to ATK
  const atk = weapon.atk * tacticMod;

  // 4. Shield phase
  let shieldDmg = 0;
  let overflow = 0;

  if (weapon.type === 'energy') {
    // Energy: 100% to shield
    shieldDmg = Math.min(targetShield, atk);
    overflow = atk - shieldDmg;
  } else {
    // kinetic/missile: 25% to shield, 75% passes through
    const shieldFactor = weapon.type === 'kinetic' ? SHIELD_VS_KINETIC : SHIELD_VS_MISSILE;
    const shieldHit = atk * shieldFactor;
    shieldDmg = Math.min(targetShield, shieldHit);
    // The 75% that bypasses shield
    overflow = atk * (1 - shieldFactor);
  }

  // 5. Hull phase
  let armorDmg = 0;
  let moduleDmg = 0;

  if (overflow > 0) {
    const piercing = weapon.piercing ?? 0;
    const directDmg = overflow * piercing;
    const armorHit = overflow * (1 - piercing);

    // Armor absorbs what it can
    armorDmg = Math.min(targetArmorHp, armorHit);
    const armorOverflow = armorHit - armorDmg + directDmg;

    // Overflow to random module (if modules tracked)
    if (armorOverflow > 0 && targetModules !== null && targetModules.length > 0) {
      const aliveModules = targetModules.filter(m => m.hp > 0);
      if (aliveModules.length > 0) {
        moduleDmg = Math.floor(armorOverflow);
      }
    }
  }

  const log = `${weapon.type} hit: shield-${Math.round(shieldDmg)} armor-${Math.round(armorDmg)}${moduleDmg > 0 ? ` module-${Math.round(moduleDmg)}` : ''}`;
  return { shieldDmg, armorDmg, moduleDmg, intercepted: false, missed: false, log };
}

export function resolveRoundV3(
  state: CombatV3State,
  input: { activeModules: string[]; tactic: 'assault' | 'balanced' | 'defensive' },
  seed: number,
): { newState: CombatV3State; roundResult: CombatV3RoundResult } {
  // 1. Clone state, increment round
  const newState: CombatV3State = {
    ...state,
    round: state.round + 1,
    playerTactic: input.tactic,
    playerModules: state.playerModules.map(m => ({ ...m })),
    enemyWeapons: [...state.enemyWeapons],
  };

  const roundLog: string[] = [];
  const tacticMod = TACTIC_MODIFIERS[input.tactic];
  let playerDamageDealt = 0;
  let enemyDamageDealt = 0;
  const modulesDestroyed: string[] = [];

  // 2. Shield regen (modified by tactic)
  const playerRegenAmount = newState.playerShieldRegen * tacticMod.shieldRegen;
  newState.playerShield = Math.min(newState.playerShieldMax, newState.playerShield + playerRegenAmount);
  newState.enemyShield = Math.min(newState.enemyShieldMax, newState.enemyShield + newState.enemyShieldRegen);

  // 3. Set active modules based on input
  const activeSet = new Set(input.activeModules);
  newState.playerModules = newState.playerModules.map(m => ({
    ...m,
    active: activeSet.has(m.moduleId),
  }));

  // 4. Player fires all active weapons → damage pipeline against enemy
  const playerWeaponModules = newState.playerModules.filter(
    m => m.active && m.hp > 0 && (m.category.startsWith('weapon_') || m.category === 'weapon'),
  );

  let seedOffset = 0;
  for (const weaponMod of playerWeaponModules) {
    const weaponType = weaponMod.category.replace('weapon_', '');
    const atk = weaponMod.stats['atk'] ?? 0;
    const piercing = weaponMod.stats['piercing'] as number | undefined;
    const weapon = { type: weaponType, atk, piercing };

    const result = resolveWeaponDamage(
      weapon,
      newState.enemyShield,
      newState.enemyArmorHp,
      null, // NPC: no module tracking
      BASE_ACCURACY,
      newState.enemyPvIntercept,
      tacticMod.weaponDmg,
      seed,
      seedOffset,
    );
    seedOffset += 3;

    roundLog.push(`[Player] ${result.log}`);
    newState.enemyShield = Math.max(0, newState.enemyShield - result.shieldDmg);
    newState.enemyArmorHp = Math.max(0, newState.enemyArmorHp - result.armorDmg);
    playerDamageDealt += result.shieldDmg + result.armorDmg;
  }

  // 5. Enemy fires all weapons → damage pipeline against player
  for (const enemyWeapon of newState.enemyWeapons) {
    const result = resolveWeaponDamage(
      enemyWeapon,
      newState.playerShield,
      newState.playerArmorHp,
      newState.playerModules,
      newState.enemyAccuracy,
      0, // player doesn't have PV intercept unless a module provides it
      1.0, // enemy always uses base damage
      seed,
      seedOffset,
    );
    seedOffset += 3;

    roundLog.push(`[Enemy] ${result.log}`);
    newState.playerShield = Math.max(0, newState.playerShield - result.shieldDmg);
    newState.playerArmorHp = Math.max(0, newState.playerArmorHp - result.armorDmg);
    enemyDamageDealt += result.shieldDmg + result.armorDmg;

    // Apply module damage to random living module
    if (result.moduleDmg > 0 && newState.playerModules.length > 0) {
      const aliveModules = newState.playerModules.filter(m => m.hp > 0);
      if (aliveModules.length > 0) {
        const idx = Math.floor(seededRandom(seed, seedOffset++) * aliveModules.length);
        const targetMod = aliveModules[idx];
        const modIdx = newState.playerModules.findIndex(m => m.moduleId === targetMod.moduleId);
        if (modIdx >= 0) {
          newState.playerModules[modIdx] = {
            ...newState.playerModules[modIdx],
            hp: Math.max(0, newState.playerModules[modIdx].hp - result.moduleDmg),
          };
          if (newState.playerModules[modIdx].hp <= 0) {
            modulesDestroyed.push(newState.playerModules[modIdx].moduleId);
            roundLog.push(`[Module destroyed] ${newState.playerModules[modIdx].name}`);
          }
        }
      }
    }
  }

  // 6. Repair modules heal lowest-HP% player module
  const repairModules = newState.playerModules.filter(
    m => m.active && m.hp > 0 && m.category === 'repair',
  );
  for (const repairMod of repairModules) {
    const healAmount = repairMod.stats['repairHpPerRound'] ?? repairMod.stats['heal'] ?? 10;
    const damagedModules = newState.playerModules
      .filter(m => m.hp < m.maxHp && m.moduleId !== repairMod.moduleId)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));

    if (damagedModules.length > 0) {
      const target = damagedModules[0];
      const modIdx = newState.playerModules.findIndex(m => m.moduleId === target.moduleId);
      if (modIdx >= 0) {
        newState.playerModules[modIdx] = {
          ...newState.playerModules[modIdx],
          hp: Math.min(newState.playerModules[modIdx].maxHp, newState.playerModules[modIdx].hp + healAmount),
        };
        roundLog.push(`[Repair] healed ${newState.playerModules[modIdx].name} for ${healAmount}`);
      }
    }
  }

  // 7. Check outcomes
  const enemyDefeated = newState.enemyArmorHp <= 0;
  const playerDefeated = newState.playerModules.every(m => m.hp <= 0);

  if (enemyDefeated) {
    newState.outcome = 'victory';
    roundLog.push('[Outcome] Enemy defeated!');
  } else if (playerDefeated) {
    newState.outcome = 'defeat';
    roundLog.push('[Outcome] Player defeated!');
  } else if (newState.round >= MAX_ROUNDS) {
    // 8. Round 10 = draw (if no other outcome)
    newState.outcome = 'draw';
    roundLog.push('[Outcome] Draw — maximum rounds reached');
  }

  const roundResult: CombatV3RoundResult = {
    round: newState.round,
    playerDamageDealt,
    enemyDamageDealt,
    playerShield: newState.playerShield,
    enemyShield: newState.enemyShield,
    playerArmorHp: newState.playerArmorHp,
    enemyArmorHp: newState.enemyArmorHp,
    modulesDestroyed,
    roundLog,
  };

  return { newState, roundResult };
}

export function attemptFleeV3(
  state: CombatV3State,
  seed: number,
): { success: boolean; newState: CombatV3State; log: string } {
  // Round must be >= 2
  if (state.round < 2) {
    return {
      success: false,
      newState: { ...state },
      log: 'Cannot flee before round 2',
    };
  }

  const newState: CombatV3State = {
    ...state,
    playerModules: state.playerModules.map(m => ({ ...m })),
    enemyWeapons: [...state.enemyWeapons],
  };

  const fleeRoll = seededRandom(seed, 0);
  if (fleeRoll < FLEE_BASE_CHANCE) {
    newState.outcome = 'fled';
    return { success: true, newState, log: 'Successfully fled combat' };
  }

  // On fail: enemy gets a free attack (resolve all enemy weapons once)
  let log = 'Flee failed! Enemy fires!';
  let seedOffset = 100; // use different offset range for flee attacks
  for (const enemyWeapon of newState.enemyWeapons) {
    const result = resolveWeaponDamage(
      enemyWeapon,
      newState.playerShield,
      newState.playerArmorHp,
      newState.playerModules,
      newState.enemyAccuracy,
      0,
      1.0,
      seed,
      seedOffset,
    );
    seedOffset += 3;

    newState.playerShield = Math.max(0, newState.playerShield - result.shieldDmg);
    newState.playerArmorHp = Math.max(0, newState.playerArmorHp - result.armorDmg);
    log += ` | ${result.log}`;

    if (result.moduleDmg > 0) {
      const aliveModules = newState.playerModules.filter(m => m.hp > 0);
      if (aliveModules.length > 0) {
        const idx = Math.floor(seededRandom(seed, seedOffset++) * aliveModules.length);
        const targetMod = aliveModules[idx];
        const modIdx = newState.playerModules.findIndex(m => m.moduleId === targetMod.moduleId);
        if (modIdx >= 0) {
          newState.playerModules[modIdx] = {
            ...newState.playerModules[modIdx],
            hp: Math.max(0, newState.playerModules[modIdx].hp - result.moduleDmg),
          };
        }
      }
    }
  }

  return { success: false, newState, log };
}
