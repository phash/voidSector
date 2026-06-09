import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import {
  insertOriginBounty,
  getOpenBounties,
  fulfillBounty,
  deductCredits,
  addCredits,
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
