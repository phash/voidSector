import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { SendChatMessage, ChatMessage } from '@void-sector/shared';
import { isGuest } from './utils.js';
import { commsBus } from '../../commsBus.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import { saveMessage, getPlayerFaction, getFactionMembersByPlayerIds } from '../../db/queries.js';
import { friendQueries } from '../../db/friendQueries.js';

function sanitizeChat(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// Sliding-window spam protection: max 5 messages per 60 seconds
const SPAM_WINDOW_MS = 60_000;
const SPAM_MAX_MESSAGES = 5;
const messageTimestamps = new Map<string, number[]>();

function checkSpam(playerId: string): boolean {
  const now = Date.now();
  let timestamps = messageTimestamps.get(playerId);
  if (!timestamps) {
    timestamps = [];
    messageTimestamps.set(playerId, timestamps);
  }
  // Remove timestamps outside window
  timestamps = timestamps.filter((t) => now - t < SPAM_WINDOW_MS);
  messageTimestamps.set(playerId, timestamps);
  if (timestamps.length >= SPAM_MAX_MESSAGES) return false;
  timestamps.push(now);
  return true;
}

export class ChatService {
  constructor(private ctx: ServiceContext) {}

  async handleChat(client: Client, data: SendChatMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'chat', 500)) {
      this.ctx.send(client, 'error', {
        code: 'RATE_LIMIT',
        message: 'Zu viele Nachrichten — bitte kurz warten',
      });
      return;
    }

    const auth = client.auth as AuthPayload;

    // Broadcast channel is system-only (distress calls, story quests, etc.)
    if (data.channel === 'broadcast') {
      this.ctx.send(client, 'error', {
        code: 'BROADCAST_READONLY',
        message: 'Broadcast-Kanal ist nur für Systemnachrichten',
      });
      return;
    }

    // Guest restrictions: can only read or reply in direct chat
    if (isGuest(client) && data.channel !== 'direct') {
      this.ctx.send(client, 'error', {
        code: 'GUEST_RESTRICTED',
        message: 'Gäste können nur Direktnachrichten senden',
      });
      return;
    }

    // Block check for direct messages
    if (data.channel === 'direct' && data.recipientId) {
      const blocked = await friendQueries.isBlocked(auth.userId, data.recipientId);
      if (blocked) {
        this.ctx.send(client, 'error', { code: 'CHAT_BLOCKED', message: 'Nachricht konnte nicht zugestellt werden.' });
        return;
      }
    }

    // Validate channel
    const VALID_CHANNELS = ['direct', 'faction', 'quadrant'] as const;
    if (!VALID_CHANNELS.includes(data.channel as any)) {
      this.ctx.send(client, 'error', { code: 'INVALID_CHANNEL', message: 'Unknown channel' });
      return;
    }

    const cleanContent = sanitizeChat(data.content.trim());
    if (!cleanContent || cleanContent.length === 0) return;
    if (data.content.length > 500) {
      this.ctx.send(client, 'error', {
        code: 'MSG_TOO_LONG',
        message: 'Message too long (max 500 chars)',
      });
      return;
    }

    // Spam protection: 5 messages per minute
    if (!checkSpam(auth.userId)) {
      this.ctx.send(client, 'error', {
        code: 'SPAM_LIMIT',
        message: 'Maximal 5 Nachrichten pro Minute',
      });
      return;
    }

    if (data.channel === 'faction') {
      const faction = await getPlayerFaction(auth.userId);
      if (!faction) {
        this.ctx.send(client, 'error', { code: 'NO_FACTION', message: 'Not in a faction' });
        return;
      }
      const msg = await saveMessage(auth.userId, null, 'faction', cleanContent);
      const chatMsg: ChatMessage = {
        id: msg.id,
        senderId: auth.userId,
        senderName: auth.username,
        channel: 'faction',
        content: cleanContent,
        sentAt: new Date(msg.sent_at).getTime(),
        delayed: false,
      };
      const memberIds = new Set(await getFactionMembersByPlayerIds(faction.id));
      this.ctx.broadcastToFaction(chatMsg, memberIds);
      return;
    }

    const msg = await saveMessage(
      auth.userId,
      data.recipientId ?? null,
      data.channel,
      cleanContent,
    );

    const chatMsg: ChatMessage = {
      id: msg.id,
      senderId: auth.userId,
      senderName: auth.username,
      channel: data.channel,
      recipientId: data.recipientId,
      content: cleanContent,
      sentAt: new Date(msg.sent_at).getTime(),
      delayed: false,
    };

    if (data.channel === 'quadrant') {
      // Broadcast to all players in this room (same quadrant)
      this.ctx.broadcast('chatMessage', chatMsg);
      // Emit to commsBus for other rooms in the same quadrant
      const { qx, qy } = sectorToQuadrant(
        this.ctx._px(client.sessionId),
        this.ctx._py(client.sessionId),
      );
      commsBus.broadcast({
        channel: 'quadrant',
        sectorX: this.ctx._px(client.sessionId),
        sectorY: this.ctx._py(client.sessionId),
        quadrantX: qx,
        quadrantY: qy,
        message: chatMsg,
      });
    } else if (data.channel === 'direct' && data.recipientId) {
      this.ctx.sendToPlayer(data.recipientId, 'chatMessage', chatMsg);
      // Also emit to commsBus for cross-room direct delivery
      const { qx, qy } = sectorToQuadrant(
        this.ctx._px(client.sessionId),
        this.ctx._py(client.sessionId),
      );
      commsBus.broadcast({
        channel: 'sector', // use sector channel for routing, message.channel is 'direct'
        sectorX: this.ctx._px(client.sessionId),
        sectorY: this.ctx._py(client.sessionId),
        quadrantX: qx,
        quadrantY: qy,
        message: chatMsg,
      });
      this.ctx.send(client, 'chatMessage', chatMsg);
    }
  }
}
