import type { Client } from 'colyseus';
import type { AuthPayload } from '../../auth.js';
import type { ServiceContext } from './ServiceContext.js';
import type { FriendEntry, FriendRequestEntry, BlockEntry, PlayerCardData } from '@void-sector/shared';
import { friendQueries } from '../../db/friendQueries.js';
import { friendsBus } from '../../friendsBus.js';
import { logger } from '../../utils/logger.js';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export function validateSendRequest(
  fromId: string, toId: string,
  isFriend: boolean, hasPending: boolean, isBlocked: boolean,
): string | null {
  if (fromId === toId) return 'FRIEND_SELF';
  if (isFriend) return 'ALREADY_FRIENDS';
  if (hasPending) return 'ALREADY_REQUESTED';
  if (isBlocked) return 'BLOCKED';
  return null;
}

export class FriendsService {
  constructor(private ctx: ServiceContext) {}

  async sendRequest(client: Client, targetId: string): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'friendReq', 1000)) return;
    const auth = client.auth as AuthPayload;
    const fromId = auth.userId;

    const [isFriend, hasPending, isBlocked] = await Promise.all([
      friendQueries.isFriend(fromId, targetId),
      friendQueries.hasPendingRequest(fromId, targetId),
      friendQueries.isBlocked(fromId, targetId),
    ]);

    const err = validateSendRequest(fromId, targetId, isFriend, hasPending, isBlocked);
    if (err) {
      client.send('error', { code: err, message: 'Freundschaftsanfrage nicht möglich.' });
      return;
    }

    const requestId = await friendQueries.insertRequest(fromId, targetId);
    if (!requestId) return;

    friendsBus.notify({
      type: 'friendRequest',
      targetPlayerId: targetId,
      payload: { id: requestId, fromId, fromName: auth.username, createdAt: Date.now() },
    });
    logger.info({ fromId, targetId, requestId }, 'Friend request sent');
  }

  async acceptRequest(client: Client, requestId: string): Promise<void> {
    const auth = client.auth as AuthPayload;
    const request = await friendQueries.getRequestById(requestId);
    if (!request || request.to_player !== auth.userId) {
      client.send('error', { code: 'INVALID_REQUEST', message: 'Anfrage nicht gefunden.' });
      return;
    }

    await friendQueries.deleteRequest(requestId, auth.userId);
    await friendQueries.insertFriendship(auth.userId, request.from_player);

    const fromPlayer = await friendQueries.getPlayerCardRow(request.from_player);
    client.send('friendAccepted', { friendId: request.from_player, friendName: fromPlayer?.username ?? '' });
    friendsBus.notify({
      type: 'friendAccepted',
      targetPlayerId: request.from_player,
      payload: { friendId: auth.userId, friendName: auth.username },
    });
    logger.info({ acceptor: auth.userId, requester: request.from_player }, 'Friend request accepted');
  }

  async declineRequest(client: Client, requestId: string): Promise<void> {
    const auth = client.auth as AuthPayload;
    await friendQueries.deleteRequest(requestId, auth.userId);
  }

  async removeFriend(client: Client, friendId: string): Promise<void> {
    const auth = client.auth as AuthPayload;
    await friendQueries.deleteFriendship(auth.userId, friendId);
    client.send('friendRemoved', { friendId });
    friendsBus.notify({
      type: 'friendRemoved',
      targetPlayerId: friendId,
      payload: { friendId: auth.userId },
    });
  }

  async blockPlayer(client: Client, targetId: string): Promise<void> {
    const auth = client.auth as AuthPayload;
    await friendQueries.insertBlock(auth.userId, targetId);
    const wasFriend = await friendQueries.isFriend(auth.userId, targetId);
    if (wasFriend) {
      await friendQueries.deleteFriendship(auth.userId, targetId);
      friendsBus.notify({
        type: 'friendRemoved',
        targetPlayerId: targetId,
        payload: { friendId: auth.userId },
      });
    }
    await friendQueries.deleteRequestsBetween(auth.userId, targetId);
  }

  async unblockPlayer(client: Client, targetId: string): Promise<void> {
    const auth = client.auth as AuthPayload;
    await friendQueries.deleteBlock(auth.userId, targetId);
  }

  async getFriendsListWithOnline(playerId: string): Promise<FriendEntry[]> {
    const rows = await friendQueries.getFriends(playerId);
    if (rows.length === 0) return [];
    const pipeline = redis.pipeline();
    rows.forEach(r => pipeline.sismember('online_players', r.friend_id));
    const results = await pipeline.exec();
    return rows.map((r, i) => ({
      id: r.friend_id,
      name: r.username,
      level: r.level,
      online: results?.[i]?.[1] === 1,
    }));
  }

  async getPendingRequestsList(playerId: string): Promise<FriendRequestEntry[]> {
    const rows = await friendQueries.getPendingRequests(playerId);
    return rows.map(r => ({
      id: r.id,
      fromId: r.from_player,
      fromName: r.username,
      createdAt: new Date(r.created_at).getTime(),
    }));
  }

  async getBlockedList(playerId: string): Promise<BlockEntry[]> {
    const rows = await friendQueries.getBlocked(playerId);
    return rows.map(r => ({ id: r.blocked_id, name: r.username }));
  }

  async getPlayerCard(client: Client, targetId: string): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'playerCard', 500)) return;
    const auth = client.auth as AuthPayload;
    const player = await friendQueries.getPlayerCardRow(targetId);
    if (!player) {
      client.send('error', { code: 'PLAYER_NOT_FOUND', message: 'Spieler nicht gefunden.' });
      return;
    }

    const [isFriend, isBlocked, pendingSent, pendingReceived, isOnline] = await Promise.all([
      friendQueries.isFriend(auth.userId, targetId),
      friendQueries.isBlocked(auth.userId, targetId),
      friendQueries.hasPendingRequest(auth.userId, targetId),
      friendQueries.hasPendingRequest(targetId, auth.userId),
      redis.sismember('online_players', targetId),
    ]);

    const data: PlayerCardData = {
      id: player.id,
      name: player.username,
      level: player.level,
      online: isOnline === 1,
      position: null,
      isFriend,
      isBlocked,
      pendingDirection: pendingSent ? 'sent' : pendingReceived ? 'received' : null,
    };
    client.send('playerCard', data);
  }
}
