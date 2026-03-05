import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { SendChatMessage, ChatMessage } from '@void-sector/shared';
import { isGuest } from './utils.js';
import { commsBus } from '../../commsBus.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import { saveMessage, getPlayerFaction, getFactionMembersByPlayerIds } from '../../db/queries.js';

function sanitizeChat(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
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
    if (isGuest(client) && data.channel === 'faction') {
      this.ctx.send(client, 'error', {
        code: 'GUEST_RESTRICTED',
        message: 'Fraktions-Chat ist für Gäste nicht verfügbar',
      });
      return;
    }
    const auth = client.auth as AuthPayload;

    // Validate channel
    const VALID_CHANNELS = ['direct', 'faction', 'sector', 'quadrant'] as const;
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

    if (data.channel === 'sector') {
      const senderX = this.ctx._px(client.sessionId);
      const senderY = this.ctx._py(client.sessionId);
      this.ctx.broadcastToSector(chatMsg, senderX, senderY);
      // Also emit to commsBus for other rooms at the same coordinates
      const { qx, qy } = sectorToQuadrant(senderX, senderY);
      commsBus.broadcast({
        channel: 'sector',
        sectorX: senderX,
        sectorY: senderY,
        quadrantX: qx,
        quadrantY: qy,
        message: chatMsg,
      });
    } else if (data.channel === 'quadrant') {
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
