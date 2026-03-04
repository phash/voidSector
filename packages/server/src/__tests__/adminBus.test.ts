import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminBus } from '../adminBus.js';
import type { AdminBroadcastEvent, AdminQuestEvent } from '../adminBus.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeBroadcast(overrides: Partial<AdminBroadcastEvent> = {}): AdminBroadcastEvent {
  return {
    senderName: 'SYSTEM',
    content: 'Hello, commanders!',
    scope: 'universal',
    targetPlayers: [],
    channel: 'direct',
    allowReply: false,
    messageId: 'msg-1',
    ...overrides,
  };
}

function makeQuest(overrides: Partial<AdminQuestEvent> = {}): AdminQuestEvent {
  return {
    questId: 'quest-1',
    title: 'Test Quest',
    description: 'Do a thing',
    scope: 'universal',
    targetPlayers: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('adminBus', () => {
  beforeEach(() => {
    adminBus.removeAllListeners();
  });

  // ── broadcast() ────────────────────────────────────────────────

  describe('broadcast()', () => {
    it('emits adminBroadcast event with correct data', () => {
      const handler = vi.fn();
      adminBus.on('adminBroadcast', handler);

      const event = makeBroadcast({ content: 'Server restarting in 5 minutes' });
      adminBus.broadcast(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('delivers universal broadcast to all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      adminBus.on('adminBroadcast', handler1);
      adminBus.on('adminBroadcast', handler2);

      const event = makeBroadcast({ scope: 'universal' });
      adminBus.broadcast(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('passes individual scope with targetPlayers to listeners', () => {
      const handler = vi.fn();
      adminBus.on('adminBroadcast', handler);

      const event = makeBroadcast({
        scope: 'individual',
        targetPlayers: ['player-a', 'player-b'],
        content: 'Private notice',
      });
      adminBus.broadcast(event);

      expect(handler).toHaveBeenCalledOnce();
      const received = handler.mock.calls[0][0] as AdminBroadcastEvent;
      expect(received.scope).toBe('individual');
      expect(received.targetPlayers).toEqual(['player-a', 'player-b']);
    });

    it('preserves all event fields', () => {
      const handler = vi.fn();
      adminBus.on('adminBroadcast', handler);

      const event = makeBroadcast({
        senderName: 'GM_Admin',
        content: 'Event starting!',
        scope: 'universal',
        channel: 'sector',
        allowReply: true,
        messageId: 'msg-42',
      });
      adminBus.broadcast(event);

      const received = handler.mock.calls[0][0] as AdminBroadcastEvent;
      expect(received.senderName).toBe('GM_Admin');
      expect(received.content).toBe('Event starting!');
      expect(received.channel).toBe('sector');
      expect(received.allowReply).toBe(true);
      expect(received.messageId).toBe('msg-42');
    });
  });

  // ── questCreated() ─────────────────────────────────────────────

  describe('questCreated()', () => {
    it('emits adminQuestCreated event with correct data', () => {
      const handler = vi.fn();
      adminBus.on('adminQuestCreated', handler);

      const event = makeQuest({ title: 'Salvage Run' });
      adminBus.questCreated(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('delivers quest event to all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      adminBus.on('adminQuestCreated', handler1);
      adminBus.on('adminQuestCreated', handler2);

      const event = makeQuest();
      adminBus.questCreated(event);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('passes individual scope with targetPlayers', () => {
      const handler = vi.fn();
      adminBus.on('adminQuestCreated', handler);

      const event = makeQuest({
        scope: 'individual',
        targetPlayers: ['player-x'],
      });
      adminBus.questCreated(event);

      const received = handler.mock.calls[0][0] as AdminQuestEvent;
      expect(received.scope).toBe('individual');
      expect(received.targetPlayers).toEqual(['player-x']);
    });

    it('passes sector scope with coordinates', () => {
      const handler = vi.fn();
      adminBus.on('adminQuestCreated', handler);

      const event = makeQuest({
        scope: 'sector',
        sectorX: 10,
        sectorY: -5,
      });
      adminBus.questCreated(event);

      const received = handler.mock.calls[0][0] as AdminQuestEvent;
      expect(received.scope).toBe('sector');
      expect(received.sectorX).toBe(10);
      expect(received.sectorY).toBe(-5);
    });

    it('preserves all event fields', () => {
      const handler = vi.fn();
      adminBus.on('adminQuestCreated', handler);

      const event = makeQuest({
        questId: 'quest-99',
        title: 'Deep Space Recon',
        description: 'Scout the outer rim',
        scope: 'universal',
      });
      adminBus.questCreated(event);

      const received = handler.mock.calls[0][0] as AdminQuestEvent;
      expect(received.questId).toBe('quest-99');
      expect(received.title).toBe('Deep Space Recon');
      expect(received.description).toBe('Scout the outer rim');
    });
  });

  // ── Listener management ────────────────────────────────────────

  describe('listener management', () => {
    it('does not fire after listener is removed', () => {
      const handler = vi.fn();
      adminBus.on('adminBroadcast', handler);
      adminBus.removeListener('adminBroadcast', handler);

      adminBus.broadcast(makeBroadcast());

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire quest listener after removal', () => {
      const handler = vi.fn();
      adminBus.on('adminQuestCreated', handler);
      adminBus.removeListener('adminQuestCreated', handler);

      adminBus.questCreated(makeQuest());

      expect(handler).not.toHaveBeenCalled();
    });

    it('removeAllListeners clears all handlers', () => {
      const broadcastHandler = vi.fn();
      const questHandler = vi.fn();
      adminBus.on('adminBroadcast', broadcastHandler);
      adminBus.on('adminQuestCreated', questHandler);

      adminBus.removeAllListeners();

      adminBus.broadcast(makeBroadcast());
      adminBus.questCreated(makeQuest());

      expect(broadcastHandler).not.toHaveBeenCalled();
      expect(questHandler).not.toHaveBeenCalled();
    });

    it('does not fire broadcast listeners on quest events', () => {
      const broadcastHandler = vi.fn();
      adminBus.on('adminBroadcast', broadcastHandler);

      adminBus.questCreated(makeQuest());

      expect(broadcastHandler).not.toHaveBeenCalled();
    });

    it('does not fire quest listeners on broadcast events', () => {
      const questHandler = vi.fn();
      adminBus.on('adminQuestCreated', questHandler);

      adminBus.broadcast(makeBroadcast());

      expect(questHandler).not.toHaveBeenCalled();
    });
  });

  // ── Scope filtering (consumer responsibility) ──────────────────

  describe('scope filtering by consumer', () => {
    it('consumer can filter universal broadcasts', () => {
      const received: AdminBroadcastEvent[] = [];
      adminBus.on('adminBroadcast', (event: AdminBroadcastEvent) => {
        if (event.scope === 'universal') {
          received.push(event);
        }
      });

      adminBus.broadcast(makeBroadcast({ scope: 'universal' }));
      adminBus.broadcast(makeBroadcast({ scope: 'individual', targetPlayers: ['p1'] }));

      expect(received).toHaveLength(1);
      expect(received[0].scope).toBe('universal');
    });

    it('consumer can filter individual broadcasts by player ID', () => {
      const myPlayerId = 'player-abc';
      const received: AdminBroadcastEvent[] = [];
      adminBus.on('adminBroadcast', (event: AdminBroadcastEvent) => {
        if (event.scope === 'universal' || event.targetPlayers.includes(myPlayerId)) {
          received.push(event);
        }
      });

      adminBus.broadcast(makeBroadcast({ scope: 'individual', targetPlayers: ['player-abc'] }));
      adminBus.broadcast(makeBroadcast({ scope: 'individual', targetPlayers: ['player-xyz'] }));
      adminBus.broadcast(makeBroadcast({ scope: 'universal' }));

      expect(received).toHaveLength(2);
    });

    it('consumer can filter sector quests by coordinates', () => {
      const myX = 10;
      const myY = 20;
      const received: AdminQuestEvent[] = [];
      adminBus.on('adminQuestCreated', (event: AdminQuestEvent) => {
        if (event.scope === 'universal' ||
            (event.scope === 'sector' && event.sectorX === myX && event.sectorY === myY)) {
          received.push(event);
        }
      });

      adminBus.questCreated(makeQuest({ scope: 'sector', sectorX: 10, sectorY: 20 }));
      adminBus.questCreated(makeQuest({ scope: 'sector', sectorX: 99, sectorY: 99 }));
      adminBus.questCreated(makeQuest({ scope: 'universal' }));

      expect(received).toHaveLength(2);
    });
  });
});
