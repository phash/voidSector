import Redis from 'ioredis';
import type { Redis as RedisType } from 'ioredis';
import dotenv from 'dotenv';
import type { InventoryItem } from '@void-sector/shared';
import { transferInventoryItem, deductCredits, addCredits } from '../db/queries.js';

dotenv.config();

interface TradeSession {
  fromPlayerId: string;
  toPlayerId: string;
  fromItems: InventoryItem[];
  fromCredits: number;
  toItems: InventoryItem[];
  toCredits: number;
  confirmedBy: string[];
  expiresAt: number;
}

const TRADE_TTL_S = 60;

export class DirectTradeService {
  constructor(private redis: RedisType) {}

  async initiateTrade(fromPlayerId: string, toPlayerId: string): Promise<string> {
    const tradeId = `trade:${fromPlayerId}:${toPlayerId}:${Date.now()}`;
    const session: TradeSession = {
      fromPlayerId,
      toPlayerId,
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
    if (playerId === session.fromPlayerId) {
      session.fromItems = items;
      session.fromCredits = credits;
    } else {
      session.toItems = items;
      session.toCredits = credits;
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

  async executeTrade(tradeId: string): Promise<void> {
    const session = await this.getSession(tradeId);
    if (!session) throw new Error('Trade session not found');

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

    await this.redis.del(tradeId);
  }

  async cancelTrade(tradeId: string): Promise<void> {
    await this.redis.del(tradeId);
  }
}

// Module-level singleton for use in SectorRoom message handlers
const _tradeRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
export const directTradeService = new DirectTradeService(_tradeRedis);
