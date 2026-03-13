import type { ShipModule } from '../../../shared/src/types.js';
import { getDamageState, getModuleEffectivePowerLevel } from '../../../shared/src/shipCalculator.js';
import { MODULE_EP_COSTS, POWER_LEVEL_MULTIPLIERS, MODULE_HP_BY_TIER, MODULES } from '../../../shared/src/constants.js';
import type {
  CombatState,
  EnemyModule,
  EnergyAllocation,
  RoundInput,
  RoundResult,
  ModuleDamageEvent,
} from './combatTypes.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find generator module in player modules list */
function findGeneratorModule(playerModules: ShipModule[]): ShipModule | undefined {
  return playerModules.find((m) => {
    const def = MODULES[m.moduleId];
    return def?.category === 'generator';
  });
}

/** Get generator tier from module definition */
function getGeneratorTier(generatorModule: ShipModule): number {
  const def = MODULES[generatorModule.moduleId];
  return def?.tier ?? 1;
}

/** Get generator EP/round output from module definition */
function getGeneratorEpPerRound(generatorModule: ShipModule): number {
  const def = MODULES[generatorModule.moduleId];
  return (def?.effects as any)?.generatorEpPerRound ?? 0;
}

/** Deep clone combat state to avoid mutation */
function cloneState(state: CombatState): CombatState {
  return {
    ...state,
    playerModules: state.playerModules.map((m) => ({ ...m })),
    enemyModules: state.enemyModules.map((m) => ({ ...m })),
    log: [...state.log],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Initialize combat state from ship and enemy data */
export function initCombat(params: {
  playerId: string;
  playerHp: number;
  playerMaxHp: number;
  playerModules: ShipModule[];
  enemyType: string;
  enemyLevel: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyModules: EnemyModule[];
}): CombatState {
  const generator = params.playerModules.find((m) => {
    const def = MODULES[m.moduleId];
    return def?.category === 'generator';
  });
  const generatorTier = generator ? getGeneratorTier(generator) : 1;
  const maxEpBuffer = generatorTier * 2;

  return {
    playerId: params.playerId,
    playerHp: params.playerHp,
    playerMaxHp: params.playerMaxHp,
    playerModules: params.playerModules.map((m) => ({ ...m })),
    epBuffer: 0,
    maxEpBuffer,
    enemyType: params.enemyType,
    enemyLevel: params.enemyLevel,
    enemyHp: params.enemyHp,
    enemyMaxHp: params.enemyMaxHp,
    enemyModules: params.enemyModules.map((m) => ({ ...m })),
    enemyEpBuffer: 0,
    round: 1,
    ancientChargeRounds: 0,
    ancientAbilityUsed: false,
    log: [],
  };
}

/**
 * Calculate available EP for this round.
 * EP = generator output + buffer carryover
 * Generator output = generatorEpPerRound * (currentHp/maxHp) * powerLevelMultiplier
 * If generator destroyed → 0 EP from generator
 * Available EP is capped by maxEpBuffer for the buffer portion
 */
export function calculateAvailableEp(state: CombatState): number {
  const generator = findGeneratorModule(state.playerModules);
  let generatorEp = 0;

  if (generator) {
    const def = MODULES[generator.moduleId];
    const maxHp = def?.maxHp ?? MODULE_HP_BY_TIER[1];
    const currentHp = generator.currentHp ?? maxHp;
    const damageState = getDamageState(currentHp, maxHp);

    if (damageState !== 'destroyed') {
      const epPerRound = getGeneratorEpPerRound(generator);
      const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
      const effectivePowerLevel = getModuleEffectivePowerLevel(generator);
      const powerMultiplier = POWER_LEVEL_MULTIPLIERS[effectivePowerLevel] ?? 0;
      generatorEp = epPerRound * hpRatio * powerMultiplier;
    }
  }

  return generatorEp + state.epBuffer;
}

/** Calculate total EP cost of a set of energy allocations */
export function calculateEpCost(allocations: EnergyAllocation[]): number {
  let total = 0;
  for (const alloc of allocations) {
    const categoryCosts = MODULE_EP_COSTS[alloc.category as keyof typeof MODULE_EP_COSTS];
    if (categoryCosts) {
      total += categoryCosts[alloc.powerLevel] ?? 0;
    }
  }
  return total;
}

/** Resolve one full round of combat */
export function resolveRound(state: CombatState, input: RoundInput): RoundResult {
  const newState = cloneState(state);
  const logLines: string[] = [];
  const moduleDamageEvents: ModuleDamageEvent[] = [];
  let playerDamageTaken = 0;
  let enemyDamageTaken = 0;
  let fled = false;
  let ejected = false;
  let outcome: RoundResult['outcome'] = 'ongoing';

  // ── Step 1: Apply Energy Allocations ───────────────────────────────────────
  const availableEp = calculateAvailableEp(newState);
  const epSpent = calculateEpCost(input.energyAllocations);
  const epRemaining = Math.max(0, availableEp - epSpent);
  newState.epBuffer = Math.min(epRemaining, newState.maxEpBuffer);

  // Apply power level updates to player modules
  for (const alloc of input.energyAllocations) {
    const mod = newState.playerModules.find((m) => m.moduleId === alloc.moduleId);
    if (mod) {
      mod.powerLevel = alloc.powerLevel;
    }
  }

  // ── Step 2: Primary Action ─────────────────────────────────────────────────
  if (outcome === 'ongoing') {
    const action = input.primaryAction;

    if (action.type === 'attack' || action.type === 'aim') {
      // Find player's weapon module and its effective power level
      const weaponMod = newState.playerModules.find((m) => {
        const def = MODULES[m.moduleId];
        return def?.category === 'weapon';
      });

      if (weaponMod) {
        const weaponDef = MODULES[weaponMod.moduleId];
        const weaponTier = weaponDef?.tier ?? 1;
        const weaponPowerLevel = getModuleEffectivePowerLevel(weaponMod);
        const powerMultiplier = POWER_LEVEL_MULTIPLIERS[weaponPowerLevel] ?? 0;
        let weaponDamage = weaponTier * 8 * powerMultiplier;

        if (action.type === 'aim') {
          weaponDamage *= 1.2; // +20% for aimed attack
        }

        // Find enemy shield module
        const enemyShieldMod = newState.enemyModules.find((m) => m.category === 'shield');
        const shieldAbsorption = enemyShieldMod
          ? enemyShieldMod.tier * 4 * POWER_LEVEL_MULTIPLIERS[enemyShieldMod.powerLevel]
          : 0;

        const netDamage = Math.max(0, weaponDamage - shieldAbsorption);
        newState.enemyHp = Math.max(0, newState.enemyHp - netDamage);
        enemyDamageTaken += netDamage;

        if (action.type === 'aim') {
          // Also apply damage to targeted enemy module
          const targetMod = newState.enemyModules.find(
            (m) => m.category === action.targetModuleCategory,
          );
          if (targetMod) {
            const modHpBefore = targetMod.currentHp;
            const modDamage = Math.floor(netDamage * 0.5);
            targetMod.currentHp = Math.max(0, targetMod.currentHp - modDamage);
            moduleDamageEvents.push({
              moduleId: `enemy_${targetMod.category}`,
              category: targetMod.category,
              hpBefore: modHpBefore,
              hpAfter: targetMod.currentHp,
            });
            logLines.push(
              `AIM ATTACK: ${Math.round(netDamage)} damage to enemy HP, ${modDamage} to enemy ${action.targetModuleCategory} module.`,
            );
          } else {
            logLines.push(`AIM ATTACK: ${Math.round(netDamage)} damage to enemy. Target module not found.`);
          }
        } else {
          logLines.push(`ATTACK: ${Math.round(netDamage)} damage to enemy (weapon dmg ${Math.round(weaponDamage)}, shield absorbed ${Math.round(shieldAbsorption)}).`);
        }

        if (newState.enemyHp <= 0) {
          outcome = 'victory';
          logLines.push('ENEMY DESTROYED. Victory!');
        }
      } else {
        logLines.push('ATTACK: No weapon module installed.');
      }
    } else if (action.type === 'scan') {
      // Reveal one random unrevealed enemy module
      const unrevealed = newState.enemyModules.filter((m) => !m.revealed);
      if (unrevealed.length > 0) {
        const idx = Math.floor(Math.random() * unrevealed.length);
        unrevealed[idx].revealed = true;
        logLines.push(`SCAN: Revealed enemy module [${unrevealed[idx].category}].`);
      } else {
        logLines.push('SCAN: All enemy modules already revealed.');
      }
    } else if (action.type === 'repair') {
      // Repair target module using repair module
      const repairMod = newState.playerModules.find((m) => {
        const def = MODULES[m.moduleId];
        return def?.category === 'repair';
      });

      if (repairMod) {
        const repairPowerLevel = getModuleEffectivePowerLevel(repairMod);
        const powerLevels = ['off', 'low', 'mid', 'high'];
        const powerIdx = powerLevels.indexOf(repairPowerLevel);

        if (powerIdx >= 1) {
          // Must be at LOW+
          const repairDef = MODULES[repairMod.moduleId];
          const repairHpPerRound = (repairDef?.effects as any)?.repairHpPerRound ?? 5;

          const targetMod = newState.playerModules.find(
            (m) => m.moduleId === action.targetModuleId,
          );
          if (targetMod) {
            const targetDef = MODULES[targetMod.moduleId];
            const maxHp = targetDef?.maxHp ?? MODULE_HP_BY_TIER[targetDef?.tier ?? 1] ?? 20;
            const hpBefore = targetMod.currentHp ?? maxHp;
            const hpAfter = Math.min(maxHp, hpBefore + repairHpPerRound);
            targetMod.currentHp = hpAfter;

            moduleDamageEvents.push({
              moduleId: targetMod.moduleId,
              category: targetDef?.category ?? 'unknown',
              hpBefore,
              hpAfter,
            });
            logLines.push(`REPAIR: Restored ${hpAfter - hpBefore} HP to module [${targetMod.moduleId}].`);
          } else {
            logLines.push('REPAIR: Target module not found.');
          }
        } else {
          logLines.push('REPAIR: Repair module is off — cannot repair.');
        }
      } else {
        logLines.push('REPAIR: No repair module installed.');
      }
    } else if (action.type === 'flee') {
      // Compare player drive EP vs enemy drive EP
      const playerDriveAlloc = input.energyAllocations
        .filter((a) => a.category === 'drive')
        .reduce((sum, a) => {
          const costs = MODULE_EP_COSTS['drive'];
          return sum + (costs ? (costs[a.powerLevel] ?? 0) : 0);
        }, 0);

      const enemyDriveMod = newState.enemyModules.find((m) => m.category === 'drive');
      const enemyDriveEp = enemyDriveMod
        ? MODULE_EP_COSTS['drive']?.[enemyDriveMod.powerLevel] ?? 0
        : 0;

      if (playerDriveAlloc > enemyDriveEp) {
        fled = true;
        outcome = 'fled';
        logLines.push('FLEE: Successfully escaped!');
      } else {
        logLines.push(`FLEE: Failed! (player drive EP: ${playerDriveAlloc} vs enemy drive EP: ${enemyDriveEp})`);
      }
    } else if (action.type === 'wait') {
      logLines.push('WAIT: Round skipped.');
    }
  }

  // ── Step 3: Enemy Action ────────────────────────────────────────────────────
  if (outcome === 'ongoing' || outcome === 'victory') {
    // Enemy always attacks (even on victory round, to show the hit that was taken)
    if (outcome === 'ongoing') {
      const enemyWeaponDamage = newState.enemyLevel * 5;

      // Player shield absorption
      const playerShieldMod = newState.playerModules.find((m) => {
        const def = MODULES[m.moduleId];
        return def?.category === 'shield';
      });

      let shieldAbsorption = 0;
      if (playerShieldMod) {
        const shieldDef = MODULES[playerShieldMod.moduleId];
        const shieldTier = shieldDef?.tier ?? 1;
        const shieldPowerLevel = getModuleEffectivePowerLevel(playerShieldMod);
        shieldAbsorption = shieldTier * 4 * (POWER_LEVEL_MULTIPLIERS[shieldPowerLevel] ?? 0);
      }

      const netPlayerDamage = Math.max(0, enemyWeaponDamage - shieldAbsorption);
      newState.playerHp = Math.max(0, newState.playerHp - netPlayerDamage);
      playerDamageTaken += netPlayerDamage;

      logLines.push(
        `ENEMY ATTACK: ${Math.round(netPlayerDamage)} damage to player (enemy dmg ${enemyWeaponDamage}, shield absorbed ${Math.round(shieldAbsorption)}).`,
      );

      // Apply damage to a random player module
      const damagableModules = newState.playerModules.filter((m) => {
        const def = MODULES[m.moduleId];
        const maxHp = def?.maxHp ?? 20;
        return (m.currentHp ?? maxHp) > 0;
      });

      if (damagableModules.length > 0) {
        const randomIdx = Math.floor(Math.random() * damagableModules.length);
        const hitMod = damagableModules[randomIdx];
        const hitDef = MODULES[hitMod.moduleId];
        const hitMaxHp = hitDef?.maxHp ?? MODULE_HP_BY_TIER[hitDef?.tier ?? 1] ?? 20;
        const hpBefore = hitMod.currentHp ?? hitMaxHp;
        const moduleDamage = Math.max(1, Math.floor(netPlayerDamage * 0.3));
        const hpAfter = Math.max(0, hpBefore - moduleDamage);
        hitMod.currentHp = hpAfter;

        moduleDamageEvents.push({
          moduleId: hitMod.moduleId,
          category: hitDef?.category ?? 'unknown',
          hpBefore,
          hpAfter,
        });
        logLines.push(`MODULE DAMAGE: [${hitMod.moduleId}] ${hpBefore} → ${hpAfter} HP.`);
      }
    }
  }

  // ── Step 4: Reaction Choice ─────────────────────────────────────────────────
  if (input.reactionChoice) {
    const reaction = input.reactionChoice;

    if (reaction.type === 'shield_boost') {
      const reduction = Math.floor(playerDamageTaken * 0.3);
      playerDamageTaken = Math.max(0, playerDamageTaken - reduction);
      newState.playerHp = Math.min(newState.playerMaxHp, newState.playerHp + reduction);
      logLines.push(`SHIELD BOOST: Reduced incoming damage by ${reduction}.`);
    } else if (reaction.type === 'ecm_pulse') {
      const reduction = Math.floor(playerDamageTaken * 0.5);
      playerDamageTaken = Math.max(0, playerDamageTaken - reduction);
      newState.playerHp = Math.min(newState.playerMaxHp, newState.playerHp + reduction);
      logLines.push(`ECM PULSE: Reduced incoming damage by ${reduction}.`);
    } else if (reaction.type === 'emergency_eject') {
      if (newState.playerHp < newState.playerMaxHp * 0.15) {
        ejected = true;
        outcome = 'ejected';
        logLines.push('EMERGENCY EJECT: Escape pod launched! Cargo lost.');
      } else {
        logLines.push('EMERGENCY EJECT: HP too high — eject threshold not met (requires <15% HP).');
      }
    }
  }

  // ── Step 5: Ancient Ability ─────────────────────────────────────────────────
  if (input.ancientAbility && newState.ancientChargeRounds >= 3 && !newState.ancientAbilityUsed) {
    const ability = input.ancientAbility;

    if (ability.type === 'explorer_passive') {
      for (const enemyMod of newState.enemyModules) {
        enemyMod.revealed = true;
      }
      logLines.push('EXPLORER PASSIVE: All enemy modules revealed.');
    } else if (ability.type === 'energy_pulse') {
      const pulseDamage = 20; // flat damage ignoring shields
      newState.enemyHp = Math.max(0, newState.enemyHp - pulseDamage);
      enemyDamageTaken += pulseDamage;
      logLines.push(`ENERGY PULSE: ${pulseDamage} direct damage to enemy (shields bypassed).`);
      if (newState.enemyHp <= 0) {
        outcome = 'victory';
      }
    }

    newState.ancientAbilityUsed = true;
    newState.ancientChargeRounds = 0;
  } else if (!input.ancientAbility) {
    // Increment charge rounds when ability is NOT used
    newState.ancientChargeRounds += 1;
  }

  // ── Step 6: Check End Conditions ────────────────────────────────────────────
  if (outcome === 'ongoing') {
    // Player generator destroyed?
    const generatorMod = findGeneratorModule(newState.playerModules);
    if (generatorMod) {
      const genDef = MODULES[generatorMod.moduleId];
      const genMaxHp = genDef?.maxHp ?? 20;
      const genCurrentHp = generatorMod.currentHp ?? genMaxHp;
      if (getDamageState(genCurrentHp, genMaxHp) === 'destroyed') {
        outcome = 'defeat';
        logLines.push('DEFEAT: Generator destroyed — ship inoperable.');
      }
    }

    if (outcome === 'ongoing' && newState.playerHp <= 0) {
      outcome = 'defeat';
      logLines.push('DEFEAT: Hull integrity lost.');
    }

    if (outcome === 'ongoing' && newState.enemyHp <= 0) {
      outcome = 'victory';
      logLines.push('VICTORY: Enemy destroyed.');
    }

    if (outcome === 'ongoing' && newState.round >= 10) {
      outcome = 'draw';
      logLines.push('DRAW: Maximum rounds reached.');
    }
  }

  // Increment round
  newState.round += 1;
  newState.log.push(...logLines);

  return {
    newState,
    playerDamageTaken,
    enemyDamageTaken,
    moduleDamageEvents,
    fled,
    ejected,
    outcome,
    logLines,
  };
}
