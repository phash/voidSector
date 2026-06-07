import type { Redis as RedisType } from 'ioredis';
import type { InventoryItem } from '@void-sector/shared';
import {
  transferInventoryItem,
  deductCredits,
  addCredits,
  getInventoryItem,
  getPlayerCredits,
} from '../db/queries.js';
import { redis as sharedRedis } from '../rooms/services/RedisAPStore.js';

export interface TradeSession {
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  fromItems: InventoryItem[];
  fromCredits: number;
  toItems: InventoryItem[];
  toCredits: number;
  confirmedBy: string[];
  expiresAt: number;
}

/** Keep only positive integer quantities; drop junk/negative offers. */
function sanitizeItems(items: InventoryItem[]): InventoryItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i && Number.isInteger(i.quantity) && i.quantity > 0)
    .map((i) => ({ itemType: i.itemType, itemId: i.itemId, quantity: i.quantity }));
}

const TRADE_TTL_S = 60;

export class DirectTradeService {
  constructor(private redis: RedisType) {}

  async initiateTrade(
    fromPlayerId: string,
    fromPlayerName: string,
    toPlayerId: string,
    toPlayerName: string,
  ): Promise<string> {
    const tradeId = `trade:${fromPlayerId}:${toPlayerId}:${Date.now()}`;
    const session: TradeSession = {
      fromPlayerId,
      fromPlayerName,
      toPlayerId,
      toPlayerName,
      fromItems: [],
      fromCredits: 0,
      toItems: [],
      toCredits: 0,
      confirmedBy: [],
      expiresAt: Date.now() + TRADE_TTL_S * 1000,
    };
    await this.redis.setex(tradeId, TRADE_TTL_S, JSON.stringify(session));
    return tradeId;
  }

  async getSession(tradeId: string): Promise<TradeSession | null> {
    const raw = await this.redis.get(tradeId);
    if (!raw) return null;
    return JSON.parse(raw) as TradeSession;
  }

  async updateOffer(
    tradeId: string,
    playerId: string,
    items: InventoryItem[],
    credits: number,
  ): Promise<void> {
    const session = await this.getSession(tradeId);
    if (!session || Date.now() > session.expiresAt) throw new Error('Trade expired');
    const safeItems = sanitizeItems(items);
    const safeCredits = Math.max(0, Math.floor(credits) || 0);
    if (playerId === session.fromPlayerId) {
      session.fromItems = safeItems;
      session.fromCredits = safeCredits;
    } else if (playerId === session.toPlayerId) {
      session.toItems = safeItems;
      session.toCredits = safeCredits;
    } else {
      throw new Error('Not a participant');
    }
    session.confirmedBy = []; // reset on offer change
    await this.redis.setex(tradeId, TRADE_TTL_S, JSON.stringify(session));
  }

  async confirm(tradeId: string, playerId: string): Promise<boolean> {
    const session = await this.getSession(tradeId);
    if (!session || Date.now() > session.expiresAt) return false;
    if (!session.confirmedBy.includes(playerId)) {
      session.confirmedBy.push(playerId);
    }
    await this.redis.setex(tradeId, TRADE_TTL_S, JSON.stringify(session));
    return (
      session.confirmedBy.includes(session.fromPlayerId) &&
      session.confirmedBy.includes(session.toPlayerId)
    );
  }

  /** Throws if the player cannot cover the offered items + credits. */
  private async assertCanCover(
    playerId: string,
    items: InventoryItem[],
    credits: number,
  ): Promise<void> {
    for (const item of items) {
      const have = await getInventoryItem(playerId, item.itemType, item.itemId);
      if (have < item.quantity) {
        throw new Error('INSUFFICIENT_ITEMS');
      }
    }
    if (credits > 0) {
      const have = await getPlayerCredits(playerId);
      if (have < credits) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
    }
  }

  async executeTrade(tradeId: string): Promise<void> {
    const session = await this.getSession(tradeId);
    if (!session) throw new Error('Trade session not found');

    // Claim the session atomically before transferring: redis.del returns the
    // number of keys removed, so exactly one of two concurrent confirmations can
    // win (del === 1). A loser (del === 0) aborts — prevents double-execution.
    const claimed = await this.redis.del(tradeId);
    if (claimed === 0) return;

    // Validate both sides actually own what they offered BEFORE moving anything.
    // (deductInventory silently no-ops on shortfall while the receiver is still
    // credited → without this check, offering items you don't have dupes them.)
    await this.assertCanCover(session.fromPlayerId, session.fromItems, session.fromCredits);
    await this.assertCanCover(session.toPlayerId, session.toItems, session.toCredits);

    // Transfer items A→B
    for (const item of session.fromItems) {
      await transferInventoryItem(
        session.fromPlayerId,
        session.toPlayerId,
        item.itemType,
        item.itemId,
        item.quantity,
      );
    }
    // Transfer items B→A
    for (const item of session.toItems) {
      await transferInventoryItem(
        session.toPlayerId,
        session.fromPlayerId,
        item.itemType,
        item.itemId,
        item.quantity,
      );
    }
    // Transfer credits A→B
    if (session.fromCredits > 0) {
      await deductCredits(session.fromPlayerId, session.fromCredits);
      await addCredits(session.toPlayerId, session.fromCredits);
    }
    // Transfer credits B→A
    if (session.toCredits > 0) {
      await deductCredits(session.toPlayerId, session.toCredits);
      await addCredits(session.fromPlayerId, session.toCredits);
    }
    // Session already removed by the atomic claim above.
  }

  async cancelTrade(tradeId: string): Promise<void> {
    await this.redis.del(tradeId);
  }
}

// Lazy singleton — uses the project's shared Redis client, no extra connection on import
let _instance: DirectTradeService | null = null;

export function getDirectTradeService(): DirectTradeService {
  if (!_instance) {
    _instance = new DirectTradeService(sharedRedis);
  }
  return _instance;
}
