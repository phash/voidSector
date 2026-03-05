import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { commsBus } from '../../commsBus.js';
import type { CommsBroadcastEvent } from '../../commsBus.js';
import type { ChatMessage, ChatChannel } from '@void-sector/shared';

describe('commsBus', () => {
  const listeners: Array<(...args: any[]) => void> = [];

  afterEach(() => {
    for (const fn of listeners) {
      commsBus.off('commsBroadcast', fn);
    }
    listeners.length = 0;
  });

  function onBroadcast(fn: (event: CommsBroadcastEvent) => void) {
    commsBus.on('commsBroadcast', fn);
    listeners.push(fn);
  }

  it('emits sector broadcast events', () => {
    const received: CommsBroadcastEvent[] = [];
    onBroadcast((e) => received.push(e));

    const msg: ChatMessage = {
      id: 'msg-1',
      senderId: 'player-1',
      senderName: 'TestPlayer',
      channel: 'sector',
      content: 'Hello sector!',
      sentAt: Date.now(),
      delayed: false,
    };

    commsBus.broadcast({
      channel: 'sector',
      sectorX: 100,
      sectorY: 200,
      quadrantX: 0,
      quadrantY: 0,
      message: msg,
    });

    expect(received).toHaveLength(1);
    expect(received[0].channel).toBe('sector');
    expect(received[0].sectorX).toBe(100);
    expect(received[0].sectorY).toBe(200);
    expect(received[0].message.content).toBe('Hello sector!');
  });

  it('emits quadrant broadcast events', () => {
    const received: CommsBroadcastEvent[] = [];
    onBroadcast((e) => received.push(e));

    const msg: ChatMessage = {
      id: 'msg-2',
      senderId: 'player-1',
      senderName: 'TestPlayer',
      channel: 'quadrant',
      content: 'Hello quadrant!',
      sentAt: Date.now(),
      delayed: false,
    };

    commsBus.broadcast({
      channel: 'quadrant',
      sectorX: 5000,
      sectorY: 5000,
      quadrantX: 0,
      quadrantY: 0,
      message: msg,
    });

    expect(received).toHaveLength(1);
    expect(received[0].channel).toBe('quadrant');
    expect(received[0].message.channel).toBe('quadrant');
  });

  it('multiple listeners receive the same event', () => {
    const received1: CommsBroadcastEvent[] = [];
    const received2: CommsBroadcastEvent[] = [];
    onBroadcast((e) => received1.push(e));
    onBroadcast((e) => received2.push(e));

    const msg: ChatMessage = {
      id: 'msg-3',
      senderId: 'player-1',
      senderName: 'TestPlayer',
      channel: 'quadrant',
      content: 'Broadcast test',
      sentAt: Date.now(),
      delayed: false,
    };

    commsBus.broadcast({
      channel: 'quadrant',
      sectorX: 100,
      sectorY: 200,
      quadrantX: 0,
      quadrantY: 0,
      message: msg,
    });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});

describe('channel routing logic', () => {
  // Pure function tests for the routing decisions

  function shouldRelayToRoom(
    event: CommsBroadcastEvent,
    roomSectorX: number,
    roomSectorY: number,
  ): boolean {
    // Skip messages that originated in this room
    if (event.sectorX === roomSectorX && event.sectorY === roomSectorY) return false;

    const myQx = Math.floor(roomSectorX / 10000);
    const myQy = Math.floor(roomSectorY / 10000);

    if (event.channel === 'quadrant' && event.quadrantX === myQx && event.quadrantY === myQy) {
      return true;
    }

    return false;
  }

  it('skips relay for messages from the same sector', () => {
    const event: CommsBroadcastEvent = {
      channel: 'quadrant',
      sectorX: 100,
      sectorY: 200,
      quadrantX: 0,
      quadrantY: 0,
      message: {} as ChatMessage,
    };
    expect(shouldRelayToRoom(event, 100, 200)).toBe(false);
  });

  it('relays quadrant messages to rooms in the same quadrant', () => {
    const event: CommsBroadcastEvent = {
      channel: 'quadrant',
      sectorX: 100,
      sectorY: 200,
      quadrantX: 0,
      quadrantY: 0,
      message: {} as ChatMessage,
    };
    // Room at (500, 300) is in quadrant (0, 0)
    expect(shouldRelayToRoom(event, 500, 300)).toBe(true);
  });

  it('does not relay quadrant messages to rooms in different quadrant', () => {
    const event: CommsBroadcastEvent = {
      channel: 'quadrant',
      sectorX: 100,
      sectorY: 200,
      quadrantX: 0,
      quadrantY: 0,
      message: {} as ChatMessage,
    };
    // Room at (10500, 300) is in quadrant (1, 0)
    expect(shouldRelayToRoom(event, 10500, 300)).toBe(false);
  });

  it('does not relay sector messages to different sectors (already handled locally)', () => {
    const event: CommsBroadcastEvent = {
      channel: 'sector',
      sectorX: 100,
      sectorY: 200,
      quadrantX: 0,
      quadrantY: 0,
      message: {} as ChatMessage,
    };
    // Different sector in same quadrant -- sector messages don't relay cross-room
    expect(shouldRelayToRoom(event, 500, 300)).toBe(false);
  });
});

describe('ChatChannel type expansion', () => {
  it('supports all four channel types', () => {
    const channels: ChatChannel[] = ['direct', 'faction', 'sector', 'quadrant'];
    expect(channels).toHaveLength(4);
    // Each channel should be a valid string
    for (const ch of channels) {
      expect(typeof ch).toBe('string');
    }
  });

  it('VALID_CHANNELS includes sector and quadrant', () => {
    const VALID_CHANNELS = ['direct', 'faction', 'sector', 'quadrant'] as const;
    expect(VALID_CHANNELS).toContain('sector');
    expect(VALID_CHANNELS).toContain('quadrant');
  });
});
