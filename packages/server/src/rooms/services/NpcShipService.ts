import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { logger } from '../../utils/logger.js';
import { rejectGuest } from './utils.js';
import * as civQueries from '../../db/civQueries.js';
import { getPlayerCredits, addCredits, deductCredits } from '../../db/queries.js';
import { getCargoState, addToInventory, removeFromInventory, getInventoryItem } from '../../engine/inventoryService.js';
import {
  NPC_TRADE_BASE_PRICES,
  NPC_TRADE_MAX_DISTANCE_BONUS,
  NPC_TRADE_DISTANCE_DIVISOR,
  NPC_TRADE_CAPACITY,
  NPC_OUTLAW_DISCOUNT,
} from '@void-sector/shared';

export class NpcShipService {
  constructor(private ctx: ServiceContext) {}

  private async validateNpc(client: Client, npcId: number): Promise<any | null> {
    const npc = await civQueries.getNpcShipById(npcId);
    if (!npc || npc.dead_until) {
      client.send('error', { code: 'NPC_FAIL', message: 'NPC nicht verfügbar' });
      return null;
    }
    const px = this.ctx._px(client.sessionId);
    const py = this.ctx._py(client.sessionId);
    if (npc.x !== px || npc.y !== py) {
      client.send('error', { code: 'NPC_FAIL', message: 'NPC nicht in diesem Sektor' });
      return null;
    }
    return npc;
  }

  async handleNpcShipTrade(
    client: Client,
    data: { npcId: number; resource: string; amount: number; action: 'buy' | 'sell' },
  ): Promise<void> {
    if (rejectGuest(client, 'NPC-Handel')) return;
    if (!this.ctx.checkRate(client.sessionId, 'npcTrade', 1000)) return;
    const auth = client.auth as AuthPayload;
    const npc = await this.validateNpc(client, data.npcId);
    if (!npc) return;
    if (npc.role !== 'trader' && npc.role !== 'outlaw') {
      client.send('error', { code: 'NPC_FAIL', message: 'Dieser NPC handelt nicht' });
      return;
    }

    const inv = npc.inventory
      ? typeof npc.inventory === 'string'
        ? JSON.parse(npc.inventory)
        : npc.inventory
      : {};
    const basePrice = NPC_TRADE_BASE_PRICES[data.resource] ?? 10;
    const distBonus = Math.min(
      NPC_TRADE_MAX_DISTANCE_BONUS,
      (Math.abs(npc.x - npc.home_x) + Math.abs(npc.y - npc.home_y)) / NPC_TRADE_DISTANCE_DIVISOR,
    );
    let price = Math.round(basePrice * (1 + distBonus));
    if (npc.role === 'outlaw') price = Math.round(price * NPC_OUTLAW_DISCOUNT);

    if (data.action === 'buy') {
      const available = inv[data.resource] ?? 0;
      const qty = Math.min(data.amount, available);
      if (qty <= 0) {
        client.send('error', { code: 'NPC_FAIL', message: 'Nicht vorrätig' });
        return;
      }
      const totalCost = qty * price;
      const credits = await getPlayerCredits(auth.userId);
      if (credits < totalCost) {
        client.send('error', { code: 'NPC_FAIL', message: 'Nicht genug Credits' });
        return;
      }
      await deductCredits(auth.userId, totalCost);
      await addToInventory(auth.userId, 'resource', data.resource, qty);
      inv[data.resource] = available - qty;
      await civQueries.updateNpcShip(npc.id, { inventory: inv });
      client.send('npcTradeResult', {
        success: true,
        resource: data.resource,
        amount: qty,
        credits: await getPlayerCredits(auth.userId),
      });
      client.send('cargoUpdate', await getCargoState(auth.userId));
    } else {
      const playerHas = await getInventoryItem(auth.userId, 'resource', data.resource);
      const qty = Math.min(data.amount, playerHas, NPC_TRADE_CAPACITY - (inv[data.resource] ?? 0));
      if (qty <= 0) {
        client.send('error', { code: 'NPC_FAIL', message: 'Nichts zu verkaufen' });
        return;
      }
      const totalEarned = qty * Math.round(price * 0.8);
      await removeFromInventory(auth.userId, 'resource', data.resource, qty);
      await addCredits(auth.userId, totalEarned);
      inv[data.resource] = (inv[data.resource] ?? 0) + qty;
      await civQueries.updateNpcShip(npc.id, { inventory: inv });
      client.send('npcTradeResult', {
        success: true,
        resource: data.resource,
        amount: qty,
        credits: await getPlayerCredits(auth.userId),
      });
      client.send('cargoUpdate', await getCargoState(auth.userId));
    }

    logger.info(
      { playerId: auth.userId, npcId: data.npcId, resource: data.resource, amount: data.amount, action: data.action },
      'NpcShipService: trade complete',
    );
  }

  async handleCommunicateNpc(client: Client, data: { npcId: number }): Promise<void> {
    if (rejectGuest(client, 'NPC-Kommunikation')) return;
    if (!this.ctx.checkRate(client.sessionId, 'npcComm', 1000)) return;
    const auth = client.auth as AuthPayload;
    const npc = await this.validateNpc(client, data.npcId);
    if (!npc) return;

    await this.ctx.checkQuestProgress(client, auth.userId, 'communicate_npc', { npcId: data.npcId });
    client.send('npcCommunicateResult', { success: true, npcName: npc.name, role: npc.role });

    logger.info({ playerId: auth.userId, npcId: data.npcId }, 'NpcShipService: communicate');
  }

  async handleAttackNpc(client: Client, data: { npcId: number }): Promise<void> {
    if (rejectGuest(client, 'NPC-Angriff')) return;
    if (!this.ctx.checkRate(client.sessionId, 'npcAttack', 1000)) return;
    const npc = await this.validateNpc(client, data.npcId);
    if (!npc) return;
    if (npc.role !== 'outlaw') {
      client.send('error', { code: 'NPC_FAIL', message: 'Kann nur Outlaws angreifen' });
      return;
    }
    // TODO: Wire NPC attack to CombatV3Service.handleCombatV3Start once DB-backed
    // module loading is in place. Integration will be completed during legacy removal.
    client.send('npcCombatStart', { npcId: npc.id, npcName: npc.name, level: npc.level });

    logger.info({ npcId: data.npcId }, 'NpcShipService: attack initiated');
  }
}
