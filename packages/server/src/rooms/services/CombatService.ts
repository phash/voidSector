import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';

import { getAcepXpSummary } from '../../engine/acepXpService.js';
import { calculateTraits } from '../../engine/traitCalculator.js';
import { getPersonalityComment } from '../../engine/personalityMessages.js';
import { destroyShipAndCreateLegacy, ejectPod } from '../../engine/permadeathService.js';
import { rejectGuest } from './utils.js';
import {
  getCargoState,
  removeFromInventory,
} from '../../engine/inventoryService.js';
import {
  getPlayerCredits,
  deductCredits,
  getStructureHp,
  updateStructureHp,
  getActiveShip,
} from '../../db/queries.js';
import {
  STATION_REPAIR_CR_PER_HP,
  STATION_REPAIR_ORE_PER_HP,
  calculateShipStats,
} from '@void-sector/shared';
import { getConfig } from '../../engine/gameConfigApply.js';
import { logger } from '../../utils/logger.js';

// ─── CombatService ────────────────────────────────────────────────────────────

export class CombatService {
  constructor(private ctx: ServiceContext) {}


  // ══════════════════════════════════════════════════════════════════════════
  // Loot generation
  // ══════════════════════════════════════════════════════════════════════════

  private generateLoot(enemyLevel: number): { credits: number; ore?: number; crystal?: number } {
    const base = enemyLevel * 50;
    return {
      credits: base + Math.floor(Math.random() * base),
      ore: enemyLevel >= 2 ? Math.floor(Math.random() * 5 * enemyLevel) : undefined,
      crystal: enemyLevel >= 4 ? Math.floor(Math.random() * 2 * enemyLevel) : undefined,
    };
  }

  async handleRepairStation(
    client: Client,
    data: { sectorX: number; sectorY: number },
  ): Promise<void> {
    if (rejectGuest(client, 'Reparieren')) return;
    const auth = client.auth as AuthPayload;

    const hp = await getStructureHp(auth.userId, data.sectorX, data.sectorY);
    if (!hp) {
      client.send('repairResult', { success: false, error: 'Keine Basis gefunden' });
      return;
    }
    if (hp.currentHp >= hp.maxHp) {
      client.send('repairResult', { success: false, error: 'Basis ist nicht beschädigt' });
      return;
    }

    const hpToRepair = hp.maxHp - hp.currentHp;
    const costCredits = hpToRepair * ((getConfig('STATION_REPAIR_CR_PER_HP') as typeof STATION_REPAIR_CR_PER_HP) ?? STATION_REPAIR_CR_PER_HP);
    const costOre = hpToRepair * ((getConfig('STATION_REPAIR_ORE_PER_HP') as typeof STATION_REPAIR_ORE_PER_HP) ?? STATION_REPAIR_ORE_PER_HP);

    const credits = await getPlayerCredits(auth.userId);
    if (credits < costCredits) {
      client.send('repairResult', {
        success: false,
        error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Credits`,
      });
      return;
    }
    const cargo = await getCargoState(auth.userId);
    if ((cargo.ore ?? 0) < costOre) {
      client.send('repairResult', {
        success: false,
        error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Erz`,
      });
      return;
    }

    await deductCredits(auth.userId, costCredits);
    await removeFromInventory(auth.userId, 'resource', 'ore', costOre);
    await updateStructureHp(auth.userId, data.sectorX, data.sectorY, hp.maxHp);

    client.send('repairResult', { success: true, newHp: hp.maxHp, maxHp: hp.maxHp });
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  }

  /** Emergency pod eject — clears all cargo. */
  async handleEjectPod(client: Client, _data: { sectorX: number; sectorY: number }): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (rejectGuest(client, 'ejectPod')) return;

    // Clear all cargo (pod jettison)
    await ejectPod(auth.userId);

    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send(
      'logEntry',
      'NOTAUSSTIEG — Kapsel ausgestoßen. Gesamte Ladung verloren. Schiff überlebt.',
    );
    client.send('ejectPodResult', { success: true });
  }

  /** Destroy the active ship on permadeath and create a legacy successor. */
  private async _handlePermadeath(
    client: Client,
    auth: AuthPayload,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    const ship = await getActiveShip(auth.userId);
    if (!ship) return;

    const result = await destroyShipAndCreateLegacy({
      playerId: auth.userId,
      shipId: ship.id,
      playerName: auth.username,
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      sectorX,
      sectorY,
      modules: ship.modules.map((m: any) => (typeof m === 'string' ? m : (m.type ?? String(m)))),
      lastLogEntry: `Zerstört im Kampf bei [${sectorX}:${sectorY}]`,
    });

    // Look up and send new ship data to client
    const newShip = await getActiveShip(auth.userId);
    if (newShip) {
      const stats = calculateShipStats(newShip.modules);
      // Update room's ship cache
      this.ctx.clientShips.set(client.sessionId, stats);
      const acepXp = await getAcepXpSummary(newShip.id);
      client.send('shipData', {
        id: newShip.id,
        ownerId: auth.userId,
        name: newShip.name,
        modules: newShip.modules,
        stats,
        fuel: stats.fuelMax,
        active: true,
        acepXp,
      });
    }

    // Notify client of permadeath
    client.send('permadeath', {
      wreckId: result.wreckId,
      newShipId: result.newShipId,
      legacyXp: result.legacyXp,
      message:
        '[ PERMADEATH ] Schiff zerstört — Erbschafts-Protokoll aktiviert. Neue Einheit übernimmt Kommando.',
    });
    client.send('logEntry', '[ PERMADEATH ] Schiff vernichtet. Erbschafts-Protokoll aktiviert.');
  }

  private async _emitPersonalityComment(
    client: Client,
    playerId: string,
    context: Parameters<typeof getPersonalityComment>[1],
  ): Promise<void> {
    const ship = await getActiveShip(playerId);
    if (!ship) return;
    const xp = await getAcepXpSummary(ship.id);
    const traits = calculateTraits(xp);
    const comment = getPersonalityComment(traits, context);
    if (comment) {
      client.send('logEntry', comment);
    }
  }
}
