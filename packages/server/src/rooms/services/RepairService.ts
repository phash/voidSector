import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { getDamageState } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';
import {
  getActiveShip,
  updateShipModules,
  getPlayerCredits,
  deductCredits,
} from '../../db/queries.js';
import {
  getCargoState,
  removeFromInventory,
} from '../../engine/inventoryService.js';
import { rejectGuest } from './utils.js';
import { logger } from '../../utils/logger.js';

// ─── RepairService ────────────────────────────────────────────────────────────

/**
 * Handles onboard module repair and station full repair.
 *
 * Onboard repair (`repairModule`):
 *   - Requires a `repair` category module installed at powerLevel != off
 *   - Costs Ore/Crystal from cargo based on damage bracket and repair module tier
 *   - Moves one damage bracket per call (destroyed→heavy, heavy→light, light→intact)
 *   - Tier 1–2 can only repair light→intact; Tier 3+ can repair all brackets
 *
 * Station repair (`stationRepair`):
 *   - Only available at station sectors
 *   - Repairs all modules to full HP
 *   - Costs (maxHp - currentHp) × 2 credits per module
 */
export class RepairService {
  constructor(private ctx: ServiceContext) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Onboard repair
  // ══════════════════════════════════════════════════════════════════════════

  async handleRepairModule(client: Client, data: { moduleId: string }): Promise<void> {
    if (rejectGuest(client, 'Modul-Reparatur')) return;

    if (!this.ctx.checkRate(client.sessionId, 'repairModule', 1500)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }

    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    // 1. Get ship from DB
    const ship = await getActiveShip(playerId);
    if (!ship) {
      client.send('repairModuleResult', { success: false, error: 'Kein aktives Schiff gefunden' });
      return;
    }

    // 2. Find target module by ID
    const targetMod = ship.modules.find((m) => m.moduleId === data.moduleId);
    if (!targetMod) {
      client.send('repairModuleResult', {
        success: false,
        error: `Modul '${data.moduleId}' nicht installiert`,
      });
      return;
    }

    const targetDef = MODULES[targetMod.moduleId];
    if (!targetDef) {
      client.send('repairModuleResult', { success: false, error: 'Unbekanntes Modul' });
      return;
    }

    const maxHp = targetDef.maxHp ?? 20;
    const currentHp = targetMod.currentHp ?? maxHp;
    const damageState = getDamageState(currentHp, maxHp);

    if (damageState === 'intact') {
      client.send('repairModuleResult', {
        success: false,
        error: 'Modul ist bereits intakt — keine Reparatur notwendig',
      });
      return;
    }

    // 3. Find the player's repair module (category='repair', not powered off)
    const repairMod = ship.modules.find((m) => {
      const def = MODULES[m.moduleId];
      return def?.category === 'repair' && (m.powerLevel ?? 'high') !== 'off';
    });

    if (!repairMod) {
      client.send('repairModuleResult', {
        success: false,
        error: 'Kein aktives Reparatur-Modul installiert',
      });
      return;
    }

    const repairDef = MODULES[repairMod.moduleId];
    if (!repairDef) {
      client.send('repairModuleResult', { success: false, error: 'Reparatur-Modul unbekannt' });
      return;
    }

    // Check if repair module itself is destroyed
    const repairModMaxHp = repairDef.maxHp ?? 20;
    const repairModCurrentHp = repairMod.currentHp ?? repairModMaxHp;
    if (getDamageState(repairModCurrentHp, repairModMaxHp) === 'destroyed') {
      client.send('repairModuleResult', {
        success: false,
        error: 'Reparatur-Modul ist zerstört — kann nicht verwendet werden',
      });
      return;
    }

    const repairTier = repairDef.tier;

    // 4. Check tier capability
    if (damageState === 'destroyed' || damageState === 'heavy') {
      if (repairTier < 3) {
        client.send('repairModuleResult', {
          success: false,
          error: `Schwer-/Zerstört-Reparatur benötigt Reparatur-Drohne Tier 3+ (installiert: Tier ${repairTier})`,
        });
        return;
      }
    }

    // 5. Calculate resource costs based on damage bracket
    const cost = calculateRepairCost(damageState, repairTier);

    // 6. Check cargo
    const cargo = await getCargoState(playerId);
    if ((cargo.ore ?? 0) < cost.ore) {
      client.send('repairModuleResult', {
        success: false,
        error: `Nicht genug Erz (benötigt: ${cost.ore}, vorhanden: ${cargo.ore ?? 0})`,
      });
      return;
    }
    if ((cargo.crystal ?? 0) < cost.crystal) {
      client.send('repairModuleResult', {
        success: false,
        error: `Nicht genug Kristall (benötigt: ${cost.crystal}, vorhanden: ${cargo.crystal ?? 0})`,
      });
      return;
    }

    // 7. Deduct resources
    if (cost.ore > 0) {
      await removeFromInventory(playerId, 'resource', 'ore', cost.ore);
    }
    if (cost.crystal > 0) {
      await removeFromInventory(playerId, 'resource', 'crystal', cost.crystal);
    }

    // 8. Calculate new HP (move one bracket up)
    const newHp = calculateNextBracketHp(damageState, maxHp);

    // 9. Persist updated modules
    const updatedModules = ship.modules.map((m) => {
      if (m.moduleId === data.moduleId) {
        return { ...m, currentHp: newHp };
      }
      return m;
    });
    await updateShipModules(ship.id, updatedModules);

    const newDamageState = getDamageState(newHp, maxHp);

    logger.info(
      { playerId, moduleId: data.moduleId, from: damageState, to: newDamageState, cost },
      'repairModule: module repaired',
    );

    client.send('repairModuleResult', {
      success: true,
      moduleId: data.moduleId,
      oldState: damageState,
      newState: newDamageState,
      newHp,
      maxHp,
      cost,
    });
    client.send('cargoUpdate', await getCargoState(playerId));
    client.send(
      'logEntry',
      `REPARATUR: ${targetDef.displayName ?? targetDef.name} — ${formatDamageState(damageState)} → ${formatDamageState(newDamageState)} (-${cost.ore} Erz, -${cost.crystal} Kristall)`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Station repair
  // ══════════════════════════════════════════════════════════════════════════

  async handleStationRepair(client: Client, _data: Record<string, never>): Promise<void> {
    if (rejectGuest(client, 'Stations-Reparatur')) return;

    if (!this.ctx.checkRate(client.sessionId, 'stationRepair', 2000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }

    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    // 1. Check that player is at a station
    const sectorType = this.ctx._pst(client.sessionId);
    if (sectorType !== 'station') {
      client.send('stationRepairResult', {
        success: false,
        error: 'Stations-Reparatur nur an Stationen verfügbar',
      });
      return;
    }

    // 2. Get ship from DB
    const ship = await getActiveShip(playerId);
    if (!ship) {
      client.send('stationRepairResult', { success: false, error: 'Kein aktives Schiff gefunden' });
      return;
    }

    // 3. Check whether any module needs repair
    const damagedModules = ship.modules.filter((m) => {
      const def = MODULES[m.moduleId];
      if (!def) return false;
      const maxHp = def.maxHp ?? 20;
      const currentHp = m.currentHp ?? maxHp;
      return currentHp < maxHp;
    });

    if (damagedModules.length === 0) {
      client.send('stationRepairResult', {
        success: false,
        error: 'Alle Module sind bereits intakt',
      });
      return;
    }

    // 4. Calculate total credit cost: sum of (maxHp - currentHp) × 2
    let totalCost = 0;
    for (const mod of damagedModules) {
      const def = MODULES[mod.moduleId];
      if (!def) continue;
      const maxHp = def.maxHp ?? 20;
      const currentHp = mod.currentHp ?? maxHp;
      totalCost += (maxHp - currentHp) * 2;
    }
    totalCost = Math.ceil(totalCost);

    // 5. Check player credits
    const credits = await getPlayerCredits(playerId);
    if (credits < totalCost) {
      client.send('stationRepairResult', {
        success: false,
        error: `Nicht genug Credits (benötigt: ${totalCost} CR, vorhanden: ${credits} CR)`,
      });
      return;
    }

    // 6. Deduct credits
    await deductCredits(playerId, totalCost);

    // 7. Set all module currentHp = maxHp
    const repairedModules = ship.modules.map((m) => {
      const def = MODULES[m.moduleId];
      if (!def) return m;
      const maxHp = def.maxHp ?? 20;
      return { ...m, currentHp: maxHp };
    });
    await updateShipModules(ship.id, repairedModules);

    logger.info(
      { playerId, modulesRepaired: damagedModules.length, cost: totalCost },
      'stationRepair: all modules restored',
    );

    client.send('stationRepairResult', {
      success: true,
      modulesRepaired: damagedModules.length,
      cost: totalCost,
    });
    client.send('creditsUpdate', { credits: await getPlayerCredits(playerId) });
    client.send(
      'logEntry',
      `STATIONS-REPARATUR: ${damagedModules.length} Module vollständig repariert. -${totalCost} CR`,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate the resource cost to repair one damage bracket.
 *
 * destroyed → heavy:  Crystal only  (tier × 5 crystal)
 * heavy → light:      Ore + Crystal  (tier × 3 ore, tier × 2 crystal)
 * light → intact:     Ore only       (tier × 5 ore)
 */
export function calculateRepairCost(
  damageState: 'light' | 'heavy' | 'destroyed',
  repairTier: number,
): { ore: number; crystal: number } {
  switch (damageState) {
    case 'destroyed':
      return { ore: 0, crystal: repairTier * 5 };
    case 'heavy':
      return { ore: repairTier * 3, crystal: repairTier * 2 };
    case 'light':
      return { ore: repairTier * 5, crystal: 0 };
  }
}

/**
 * Returns the target HP for the next bracket up.
 *
 * destroyed (<25%) → heavy  (50%): ceil(maxHp × 0.50)
 * heavy (25–50%)   → light  (75%): ceil(maxHp × 0.75)
 * light (50–75%)   → intact (100%): maxHp
 */
export function calculateNextBracketHp(
  damageState: 'light' | 'heavy' | 'destroyed',
  maxHp: number,
): number {
  switch (damageState) {
    case 'destroyed':
      return Math.ceil(maxHp * 0.5);
    case 'heavy':
      return Math.ceil(maxHp * 0.75);
    case 'light':
      return maxHp;
  }
}

function formatDamageState(state: string): string {
  switch (state) {
    case 'destroyed':
      return 'ZERSTÖRT';
    case 'heavy':
      return 'SCHWER';
    case 'light':
      return 'LEICHT';
    case 'intact':
      return 'INTAKT';
    default:
      return state.toUpperCase();
  }
}
