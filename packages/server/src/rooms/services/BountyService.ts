import type { Client } from 'colyseus';
import { getStarterBountyDef } from '@void-sector/shared';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import { validateStarterClaim } from '../../engine/starterBountyEngine.js';
import { awardWissenAndNotify } from '../../engine/wissenService.js';
import { getCargoState, removeFromInventory } from '../../engine/inventoryService.js';
import { logger } from '../../utils/logger.js';
import {
  insertOriginBounty,
  getOpenBounties,
  fulfillBounty,
  deductCredits,
  addCredits,
  getPlayerCredits,
  getStarterBountyClaims,
  insertStarterBountyClaim,
  deleteStarterBountyClaim,
} from '../../db/queries.js';

export const BOUNTY_MAX_REWARD = 1_000_000;
export type BountyKind = 'combat' | 'reach';

export function validateBounty(
  objectiveType: string,
  data: any,
  reward: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(reward) || reward < 1 || reward > BOUNTY_MAX_REWARD)
    return { ok: false, reason: 'BAD_REWARD' };
  if (objectiveType === 'pirate_defeat') {
    if (!Number.isInteger(data?.qx) || !Number.isInteger(data?.qy))
      return { ok: false, reason: 'BAD_TARGET' };
    return { ok: true };
  }
  if (objectiveType === 'reach_sector') {
    if (!Number.isInteger(data?.sectorX) || !Number.isInteger(data?.sectorY))
      return { ok: false, reason: 'BAD_TARGET' };
    return { ok: true };
  }
  return { ok: false, reason: 'BAD_TYPE' };
}

export class BountyService {
  constructor(private ctx: ServiceContext) {}

  async handlePost(
    client: Client,
    data: { objectiveType: string; objectiveData: any; reward: number },
    px: number,
    py: number,
  ): Promise<void> {
    if (px !== 0 || py !== 0) {
      this.ctx.send(client, 'error', {
        code: 'NOT_AT_ORIGIN',
        message: 'Nur am Zentrum (0:0) kannst du Bounties aussetzen.',
      });
      return;
    }
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    const v = validateBounty(data?.objectiveType, data?.objectiveData, data?.reward);
    if (!v.ok) {
      this.ctx.send(client, 'error', { code: 'INVALID_BOUNTY', message: 'Ungültige Bounty.' });
      return;
    }
    const od =
      data.objectiveType === 'pirate_defeat'
        ? { qx: data.objectiveData.qx, qy: data.objectiveData.qy }
        : { sectorX: data.objectiveData.sectorX, sectorY: data.objectiveData.sectorY };
    const ok = await deductCredits(auth.userId, data.reward);
    if (!ok) {
      this.ctx.send(client, 'error', {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Nicht genug Credits.',
      });
      return;
    }
    let bounty;
    try {
      bounty = await insertOriginBounty(
        auth.userId,
        auth.username,
        data.reward,
        data.objectiveType,
        od,
      );
    } catch {
      bounty = null;
    }
    if (!bounty) {
      await addCredits(auth.userId, data.reward).catch(() => undefined); // refund the escrow
      this.ctx.send(client, 'error', {
        code: 'BOUNTY_FAILED',
        message: 'Bounty fehlgeschlagen — Credits zurückerstattet.',
      });
      return;
    }
    await this.sendOpen(client);
  }

  async sendOpen(client: Client): Promise<void> {
    this.ctx.send(client, 'bountiesResult', { bounties: await getOpenBounties(50) });
  }

  async sendStarter(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    this.ctx.send(client, 'starterBountiesResult', {
      claims: await getStarterBountyClaims(auth.userId),
    });
  }

  async handleClaimStarter(
    client: Client,
    data: { key: string },
    px: number,
    py: number,
  ): Promise<void> {
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    const def = getStarterBountyDef(data?.key ?? '');
    if (!def) {
      this.ctx.send(client, 'error', { code: 'INVALID_BOUNTY', message: 'Unbekannter Auftrag.' });
      return;
    }
    const cargo = await getCargoState(auth.userId);
    const v = validateStarterClaim(def, cargo, px, py);
    if (!v.ok) {
      const messages = {
        NOT_AT_ORIGIN: 'Nur am Origin Hub (0:0) kannst du Starthilfe-Aufträge abgeben.',
        INSUFFICIENT_RESOURCES: `Nicht genug ${def.resource.toUpperCase()} an Bord (${def.amount} benötigt).`,
      };
      this.ctx.send(client, 'error', { code: v.code, message: messages[v.code] });
      return;
    }
    const claimed = await insertStarterBountyClaim(auth.userId, def.key);
    if (!claimed) {
      this.ctx.send(client, 'error', {
        code: 'ALREADY_CLAIMED',
        message: 'Diesen Starthilfe-Auftrag hast du bereits abgeschlossen.',
      });
      return;
    }
    try {
      await removeFromInventory(auth.userId, 'resource', def.resource, def.amount);
    } catch (err) {
      logger.error({ err, key: def.key }, 'starter bounty deduction failed — rolling back claim');
      await deleteStarterBountyClaim(auth.userId, def.key).catch(() => undefined);
      this.ctx.send(client, 'error', {
        code: 'INSUFFICIENT_RESOURCES',
        message: `Nicht genug ${def.resource.toUpperCase()} an Bord (${def.amount} benötigt).`,
      });
      return;
    }
    await addCredits(auth.userId, def.rewardCredits);
    awardWissenAndNotify(client, auth.userId, def.rewardWissen);
    this.ctx.send(client, 'cargoUpdate', await getCargoState(auth.userId));
    this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    this.ctx.send(client, 'starterBountyClaimed', {
      key: def.key,
      rewardCredits: def.rewardCredits,
      rewardWissen: def.rewardWissen,
    });
    await this.sendStarter(client);
    await this.ctx.tutorial?.onStarterBounty(client, auth.userId);
  }

  async tryFulfill(
    playerId: string,
    playerName: string,
    x: number,
    y: number,
    kind: BountyKind,
  ): Promise<{ reward: number } | null> {
    if (kind === 'combat') {
      const { qx, qy } = sectorToQuadrant(x, y);
      const b = await fulfillBounty(playerId, playerName, 'pirate_defeat', { qx, qy });
      if (b) {
        await addCredits(playerId, b.reward_credits);
        return { reward: b.reward_credits };
      }
      return null;
    }
    const b = await fulfillBounty(playerId, playerName, 'reach_sector', {
      sectorX: x,
      sectorY: y,
    });
    if (b) {
      await addCredits(playerId, b.reward_credits);
      return { reward: b.reward_credits };
    }
    return null;
  }
}
