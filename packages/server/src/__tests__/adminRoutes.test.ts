import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock adminBus before importing the router
vi.mock('../adminBus.js', () => ({
  adminBus: {
    broadcast: vi.fn(),
    questCreated: vi.fn(),
    playerUpdated: vi.fn(),
  },
}));

// Mock RedisAPStore
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: vi.fn(),
  savePlayerPosition: vi.fn(),
}));

// Mock adminQueries before importing the router
vi.mock('../db/adminQueries.js', () => ({
  getAllPlayers: vi.fn(),
  getPlayerById: vi.fn(),
  getPlayerFullProfile: vi.fn(),
  adminSetPlayerCredits: vi.fn(),
  adminSetCargoItem: vi.fn(),
  createAdminQuest: vi.fn(),
  getAdminQuests: vi.fn(),
  getAdminQuestById: vi.fn(),
  updateAdminQuestStatus: vi.fn(),
  createAdminMessage: vi.fn(),
  getAdminMessages: vi.fn(),
  getAdminReplies: vi.fn(),
  logAdminEvent: vi.fn(),
  getAdminEvents: vi.fn(),
  getServerStats: vi.fn(),
  createAdminStory: vi.fn(),
  getAdminStories: vi.fn(),
  getAdminStoryById: vi.fn(),
}));

import { adminAuth, adminRouter } from '../adminRoutes.js';
import { getPlayerPosition, savePlayerPosition } from '../rooms/services/RedisAPStore.js';
const mockGetPlayerPosition = vi.mocked(getPlayerPosition);
const mockSavePlayerPosition = vi.mocked(savePlayerPosition);
import {
  getAllPlayers,
  getPlayerById,
  getPlayerFullProfile,
  adminSetPlayerCredits,
  adminSetCargoItem,
  createAdminQuest,
  getAdminQuests,
  getAdminQuestById,
  updateAdminQuestStatus,
  createAdminMessage,
  getAdminMessages,
  getAdminReplies,
  logAdminEvent,
  getAdminEvents,
  getServerStats,
  createAdminStory,
  getAdminStories,
  getAdminStoryById,
} from '../db/adminQueries.js';

const mockGetAllPlayers = vi.mocked(getAllPlayers);
const mockGetPlayerById = vi.mocked(getPlayerById);
const mockGetPlayerFullProfile = vi.mocked(getPlayerFullProfile);
const mockAdminSetPlayerCredits = vi.mocked(adminSetPlayerCredits);
const mockAdminSetCargoItem = vi.mocked(adminSetCargoItem);
const mockCreateAdminQuest = vi.mocked(createAdminQuest);
const mockGetAdminQuests = vi.mocked(getAdminQuests);
const mockGetAdminQuestById = vi.mocked(getAdminQuestById);
const mockUpdateAdminQuestStatus = vi.mocked(updateAdminQuestStatus);
const mockCreateAdminMessage = vi.mocked(createAdminMessage);
const mockGetAdminMessages = vi.mocked(getAdminMessages);
const mockGetAdminReplies = vi.mocked(getAdminReplies);
const mockLogAdminEvent = vi.mocked(logAdminEvent);
const mockGetAdminEvents = vi.mocked(getAdminEvents);
const mockGetServerStats = vi.mocked(getServerStats);
const mockCreateAdminStory = vi.mocked(createAdminStory);
const mockGetAdminStories = vi.mocked(getAdminStories);
const mockGetAdminStoryById = vi.mocked(getAdminStoryById);

// ── Test Helpers ────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    on: vi.fn(),
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

// Extract a route handler from the router's internal stack
function getRouteHandler(
  method: string,
  path: string,
): ((req: Request, res: Response) => Promise<void>) | undefined {
  const layer = (adminRouter as any).stack.find((l: any) => {
    if (!l.route) return false;
    return l.route.path === path && l.route.methods[method];
  });
  if (!layer) return undefined;
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('adminRoutes', () => {
  const ORIGINAL_TOKEN = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'test-token';
    vi.clearAllMocks();
    mockLogAdminEvent.mockResolvedValue(1);
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN !== undefined) {
      process.env.ADMIN_TOKEN = ORIGINAL_TOKEN;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  // ── Auth Middleware ──────────────────────────────────────────────

  describe('adminAuth middleware', () => {
    it('rejects request with no authorization header', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      adminAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Missing or invalid authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects request with wrong token', () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer wrong-token' } as any,
      });
      const res = createMockRes();
      const next = vi.fn();

      adminAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Invalid admin token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects request with non-Bearer auth scheme', () => {
      const req = createMockReq({
        headers: { authorization: 'Basic dXNlcjpwYXNz' } as any,
      });
      const res = createMockRes();
      const next = vi.fn();

      adminAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Missing or invalid authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts request with valid token', () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer test-token' } as any,
      });
      const res = createMockRes();
      const next = vi.fn();

      adminAuth(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res._status).toBe(200); // unchanged
    });

    it('returns 500 when ADMIN_TOKEN is not configured', () => {
      delete process.env.ADMIN_TOKEN;
      const req = createMockReq({
        headers: { authorization: 'Bearer test-token' } as any,
      });
      const res = createMockRes();
      const next = vi.fn();

      adminAuth(req, res, next);

      expect(res._status).toBe(500);
      expect(res._json).toEqual({ error: 'ADMIN_TOKEN not configured' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── Players ─────────────────────────────────────────────────────

  describe('GET /players', () => {
    it('returns list of players', async () => {
      const players = [
        {
          id: 'p1',
          username: 'alice',
          positionX: 0,
          positionY: 0,
          xp: 100,
          level: 2,
          factionId: null,
        },
      ];
      mockGetAllPlayers.mockResolvedValueOnce(players);

      const handler = getRouteHandler('get', '/players')!;
      expect(handler).toBeDefined();

      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ players });
      expect(mockLogAdminEvent).toHaveBeenCalledWith('list_players', { count: 1 });
    });
  });

  describe('GET /players/:id', () => {
    it('returns full player profile when found', async () => {
      const player = {
        id: 'p1',
        username: 'alice',
        positionX: 0,
        positionY: 0,
        xp: 100,
        level: 2,
        factionId: null,
        credits: 500,
        cargo: { ore: 10 },
        ships: [
          { id: 's1', name: 'AEGIS', active: true, modules: [], fuel: 100 },
        ],
      };
      mockGetPlayerFullProfile.mockResolvedValueOnce(player);
      mockGetPlayerPosition.mockResolvedValueOnce({ x: 42, y: 99 });

      const handler = getRouteHandler('get', '/players/:id')!;
      const req = createMockReq({ params: { id: 'p1' } as any });
      const res = createMockRes();
      await handler(req, res);

      expect((res._json as any).player.positionX).toBe(42);
      expect((res._json as any).player.positionY).toBe(99);
      expect(mockLogAdminEvent).toHaveBeenCalledWith('get_player', { playerId: 'p1' });
    });

    it('returns 404 when player not found', async () => {
      mockGetPlayerFullProfile.mockResolvedValueOnce(null);

      const handler = getRouteHandler('get', '/players/:id')!;
      const req = createMockReq({ params: { id: 'nonexistent' } as any });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ error: 'Player not found' });
    });
  });

  describe('PATCH /players/:id/position', () => {
    it('sets player position in Redis and emits event', async () => {
      mockGetPlayerById.mockResolvedValueOnce({
        id: 'p1',
        username: 'alice',
        positionX: 0,
        positionY: 0,
        xp: 0,
        level: 1,
        factionId: null,
      });
      mockSavePlayerPosition.mockResolvedValueOnce(undefined);

      const handler = getRouteHandler('patch', '/players/:id/position')!;
      const req = createMockReq({ params: { id: 'p1' } as any, body: { x: 100, y: 200 } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ ok: true });
      expect(mockSavePlayerPosition).toHaveBeenCalledWith('p1', 100, 200);
      expect(mockLogAdminEvent).toHaveBeenCalledWith('set_player_position', {
        playerId: 'p1',
        x: 100,
        y: 200,
      });
    });

    it('returns 400 for invalid coordinates', async () => {
      const handler = getRouteHandler('patch', '/players/:id/position')!;
      const req = createMockReq({ params: { id: 'p1' } as any, body: { x: 'bad', y: 200 } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual({ error: 'x and y must be numbers' });
    });

    it('returns 404 when player not found', async () => {
      mockGetPlayerById.mockResolvedValueOnce(null);

      const handler = getRouteHandler('patch', '/players/:id/position')!;
      const req = createMockReq({ params: { id: 'nope' } as any, body: { x: 0, y: 0 } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
    });
  });

  describe('PATCH /players/:id/credits', () => {
    it('sets player credits and emits event', async () => {
      mockAdminSetPlayerCredits.mockResolvedValueOnce(true);

      const handler = getRouteHandler('patch', '/players/:id/credits')!;
      const req = createMockReq({ params: { id: 'p1' } as any, body: { amount: 9999 } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ ok: true });
      expect(mockAdminSetPlayerCredits).toHaveBeenCalledWith('p1', 9999);
    });

    it('returns 400 for negative amount', async () => {
      const handler = getRouteHandler('patch', '/players/:id/credits')!;
      const req = createMockReq({ params: { id: 'p1' } as any, body: { amount: -1 } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
    });
  });

  describe('PATCH /players/:id/cargo', () => {
    it('sets cargo item for player', async () => {
      mockGetPlayerById.mockResolvedValueOnce({
        id: 'p1',
        username: 'alice',
        positionX: 0,
        positionY: 0,
        xp: 0,
        level: 1,
        factionId: null,
      });
      mockAdminSetCargoItem.mockResolvedValueOnce(undefined);

      const handler = getRouteHandler('patch', '/players/:id/cargo')!;
      const req = createMockReq({
        params: { id: 'p1' } as any,
        body: { resource: 'ore', amount: 50 },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ ok: true });
      expect(mockAdminSetCargoItem).toHaveBeenCalledWith('p1', 'ore', 50);
    });

    it('returns 400 when resource is missing', async () => {
      const handler = getRouteHandler('patch', '/players/:id/cargo')!;
      const req = createMockReq({ params: { id: 'p1' } as any, body: { amount: 10 } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
    });

    it('returns 404 when player not found', async () => {
      mockGetPlayerById.mockResolvedValueOnce(null);

      const handler = getRouteHandler('patch', '/players/:id/cargo')!;
      const req = createMockReq({
        params: { id: 'nope' } as any,
        body: { resource: 'ore', amount: 10 },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
    });
  });

  // ── Quests ──────────────────────────────────────────────────────

  describe('POST /quests', () => {
    it('creates quest from JSON body', async () => {
      mockCreateAdminQuest.mockResolvedValueOnce('quest-1');

      const handler = getRouteHandler('post', '/quests')!;
      const req = createMockReq({
        headers: { 'content-type': 'application/json' } as any,
        body: { title: 'Test Quest', description: 'A quest for testing' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toEqual({ id: 'quest-1' });
      expect(mockCreateAdminQuest).toHaveBeenCalledWith({
        title: 'Test Quest',
        description: 'A quest for testing',
      });
      expect(mockLogAdminEvent).toHaveBeenCalledWith('create_quest', {
        questId: 'quest-1',
        title: 'Test Quest',
      });
    });

    it('creates quest from YAML body', async () => {
      mockCreateAdminQuest.mockResolvedValueOnce('quest-2');
      const yamlBody = 'title: YAML Quest\ndescription: From YAML\nscope: universal\n';

      const handler = getRouteHandler('post', '/quests')!;
      const req = createMockReq({
        headers: { 'content-type': 'application/x-yaml' } as any,
        body: {},
        on: vi.fn((event: string, cb: (data?: any) => void) => {
          if (event === 'data') cb(Buffer.from(yamlBody));
          if (event === 'end') cb();
          return req;
        }),
      } as any);
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toEqual({ id: 'quest-2' });
      expect(mockCreateAdminQuest).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'YAML Quest',
          description: 'From YAML',
          scope: 'universal',
        }),
      );
    });

    it('rejects quest without title', async () => {
      const handler = getRouteHandler('post', '/quests')!;
      const req = createMockReq({
        headers: { 'content-type': 'application/json' } as any,
        body: { description: 'No title' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual({ error: 'title and description are required' });
    });

    it('rejects quest without description', async () => {
      const handler = getRouteHandler('post', '/quests')!;
      const req = createMockReq({
        headers: { 'content-type': 'application/json' } as any,
        body: { title: 'No desc' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual({ error: 'title and description are required' });
    });
  });

  describe('GET /quests', () => {
    it('returns quests without filter', async () => {
      const quests = [
        {
          id: 'q1',
          title: 'Quest 1',
          description: 'Desc',
          scope: 'universal',
          questType: 'fetch',
          npcName: null,
          npcFaction: null,
          objectives: [],
          rewards: {},
          flavor: {},
          sectorX: null,
          sectorY: null,
          targetPlayers: [],
          maxAcceptances: 0,
          expiresDays: 7,
          status: 'active',
          createdAt: '2026-01-01',
        },
      ];
      mockGetAdminQuests.mockResolvedValueOnce(quests);

      const handler = getRouteHandler('get', '/quests')!;
      const req = createMockReq({ query: {} });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ quests });
      expect(mockGetAdminQuests).toHaveBeenCalledWith(undefined);
    });

    it('passes status filter when provided', async () => {
      mockGetAdminQuests.mockResolvedValueOnce([]);

      const handler = getRouteHandler('get', '/quests')!;
      const req = createMockReq({ query: { status: 'paused' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockGetAdminQuests).toHaveBeenCalledWith('paused');
    });
  });

  describe('GET /quests/:id', () => {
    it('returns quest with assignment count', async () => {
      const quest = {
        id: 'q1',
        title: 'Quest 1',
        description: 'Desc',
        scope: 'universal',
        questType: 'fetch',
        npcName: null,
        npcFaction: null,
        objectives: [],
        rewards: {},
        flavor: {},
        sectorX: null,
        sectorY: null,
        targetPlayers: [],
        maxAcceptances: 0,
        expiresDays: 7,
        status: 'active',
        createdAt: '2026-01-01',
        assignmentCount: 3,
      };
      mockGetAdminQuestById.mockResolvedValueOnce(quest);

      const handler = getRouteHandler('get', '/quests/:id')!;
      const req = createMockReq({ params: { id: 'q1' } as any });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ quest });
      expect(mockLogAdminEvent).toHaveBeenCalledWith('get_quest', { questId: 'q1' });
    });

    it('returns 404 when quest not found', async () => {
      mockGetAdminQuestById.mockResolvedValueOnce(null);

      const handler = getRouteHandler('get', '/quests/:id')!;
      const req = createMockReq({ params: { id: 'nonexistent' } as any });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ error: 'Quest not found' });
    });
  });

  describe('PATCH /quests/:id', () => {
    it('updates quest status', async () => {
      const quest = {
        id: 'q1',
        title: 'Quest 1',
        description: 'Desc',
        scope: 'universal',
        questType: 'fetch',
        npcName: null,
        npcFaction: null,
        objectives: [],
        rewards: {},
        flavor: {},
        sectorX: null,
        sectorY: null,
        targetPlayers: [],
        maxAcceptances: 0,
        expiresDays: 7,
        status: 'paused',
        createdAt: '2026-01-01',
      };
      mockUpdateAdminQuestStatus.mockResolvedValueOnce(quest);

      const handler = getRouteHandler('patch', '/quests/:id')!;
      const req = createMockReq({
        params: { id: 'q1' } as any,
        body: { status: 'paused' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ quest });
      expect(mockUpdateAdminQuestStatus).toHaveBeenCalledWith('q1', 'paused');
      expect(mockLogAdminEvent).toHaveBeenCalledWith('update_quest_status', {
        questId: 'q1',
        status: 'paused',
      });
    });

    it('rejects missing status', async () => {
      const handler = getRouteHandler('patch', '/quests/:id')!;
      const req = createMockReq({
        params: { id: 'q1' } as any,
        body: {},
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual({ error: 'status is required' });
    });

    it('rejects invalid status value', async () => {
      const handler = getRouteHandler('patch', '/quests/:id')!;
      const req = createMockReq({
        params: { id: 'q1' } as any,
        body: { status: 'invalid-status' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual({
        error: 'Invalid status. Must be one of: active, paused, completed, cancelled',
      });
    });

    it('returns 404 when quest not found', async () => {
      mockUpdateAdminQuestStatus.mockResolvedValueOnce(null);

      const handler = getRouteHandler('patch', '/quests/:id')!;
      const req = createMockReq({
        params: { id: 'nonexistent' } as any,
        body: { status: 'completed' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ error: 'Quest not found' });
    });
  });

  // ── Messages ────────────────────────────────────────────────────

  describe('POST /messages', () => {
    it('creates a broadcast message', async () => {
      mockCreateAdminMessage.mockResolvedValueOnce('msg-1');

      const handler = getRouteHandler('post', '/messages')!;
      const req = createMockReq({
        body: { content: 'Server maintenance in 30 minutes', senderName: 'Admin' },
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toEqual({ id: 'msg-1' });
      expect(mockCreateAdminMessage).toHaveBeenCalledWith({
        content: 'Server maintenance in 30 minutes',
        senderName: 'Admin',
      });
      expect(mockLogAdminEvent).toHaveBeenCalledWith('create_message', {
        messageId: 'msg-1',
        content: 'Server maintenance in 30 minutes',
      });
    });

    it('rejects message without content', async () => {
      const handler = getRouteHandler('post', '/messages')!;
      const req = createMockReq({ body: { senderName: 'Admin' } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toEqual({ error: 'content is required' });
    });
  });

  describe('GET /messages', () => {
    it('returns messages with default limit', async () => {
      const messages = [
        {
          id: 'msg-1',
          senderName: 'SYSTEM',
          content: 'Hello',
          scope: 'universal',
          targetPlayers: [],
          channel: 'direct',
          allowReply: false,
          createdAt: '2026-01-01',
        },
      ];
      mockGetAdminMessages.mockResolvedValueOnce(messages);

      const handler = getRouteHandler('get', '/messages')!;
      const req = createMockReq({ query: {} });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ messages });
      expect(mockGetAdminMessages).toHaveBeenCalledWith(50);
    });

    it('passes custom limit when provided', async () => {
      mockGetAdminMessages.mockResolvedValueOnce([]);

      const handler = getRouteHandler('get', '/messages')!;
      const req = createMockReq({ query: { limit: '10' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockGetAdminMessages).toHaveBeenCalledWith(10);
    });
  });

  describe('GET /messages/:id/replies', () => {
    it('returns replies for a message', async () => {
      const replies = [
        {
          id: 'r1',
          messageId: 'msg-1',
          playerId: 'p1',
          content: 'Thanks!',
          createdAt: '2026-01-01',
        },
      ];
      mockGetAdminReplies.mockResolvedValueOnce(replies);

      const handler = getRouteHandler('get', '/messages/:id/replies')!;
      const req = createMockReq({ params: { id: 'msg-1' } as any });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ replies });
      expect(mockGetAdminReplies).toHaveBeenCalledWith('msg-1');
    });
  });

  // ── Events ──────────────────────────────────────────────────────

  describe('GET /events', () => {
    it('returns events with default limit', async () => {
      const events = [
        { id: 1, action: 'quest_created', details: { questId: 'q1' }, createdAt: '2026-01-01' },
      ];
      mockGetAdminEvents.mockResolvedValueOnce(events);

      const handler = getRouteHandler('get', '/events')!;
      const req = createMockReq({ query: {} });
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ events });
      expect(mockGetAdminEvents).toHaveBeenCalledWith(100);
    });

    it('passes custom limit', async () => {
      mockGetAdminEvents.mockResolvedValueOnce([]);

      const handler = getRouteHandler('get', '/events')!;
      const req = createMockReq({ query: { limit: '25' } });
      const res = createMockRes();
      await handler(req, res);

      expect(mockGetAdminEvents).toHaveBeenCalledWith(25);
    });
  });

  // ── Stats ───────────────────────────────────────────────────────

  describe('GET /stats', () => {
    it('returns server statistics', async () => {
      const stats = { playerCount: 42, structureCount: 15, discoveredSectorCount: 200 };
      mockGetServerStats.mockResolvedValueOnce(stats);

      const handler = getRouteHandler('get', '/stats')!;
      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(res._json).toEqual({ stats });
      expect(mockLogAdminEvent).toHaveBeenCalledWith('get_stats');
    });

    it('returns 500 on error', async () => {
      mockGetServerStats.mockRejectedValueOnce(new Error('DB down'));

      const handler = getRouteHandler('get', '/stats')!;
      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(500);
      expect(res._json).toEqual({ error: 'Internal server error' });
    });
  });

  // ── Stories ────────────────────────────────────────────────────────

  describe('stories routes', () => {
    describe('POST /stories', () => {
      it('creates a story and returns id', async () => {
        mockCreateAdminStory.mockResolvedValueOnce('story-1');

        const handler = getRouteHandler('post', '/stories')!;
        expect(handler).toBeDefined();

        const req = createMockReq({
          body: { title: 'Login Test', summary: 'Testing the login flow' },
        });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(201);
        expect(res._json).toEqual({ id: 'story-1' });
        expect(mockCreateAdminStory).toHaveBeenCalledWith({
          title: 'Login Test',
          summary: 'Testing the login flow',
        });
        expect(mockLogAdminEvent).toHaveBeenCalledWith('create_story', {
          storyId: 'story-1',
          title: 'Login Test',
        });
      });

      it('rejects story without title', async () => {
        const handler = getRouteHandler('post', '/stories')!;
        const req = createMockReq({
          body: { summary: 'No title here' },
        });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'title and summary are required' });
      });

      it('rejects story without summary', async () => {
        const handler = getRouteHandler('post', '/stories')!;
        const req = createMockReq({
          body: { title: 'No summary' },
        });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(400);
        expect(res._json).toEqual({ error: 'title and summary are required' });
      });

      it('returns 500 on error', async () => {
        mockCreateAdminStory.mockRejectedValueOnce(new Error('DB down'));

        const handler = getRouteHandler('post', '/stories')!;
        const req = createMockReq({
          body: { title: 'Failing Story', summary: 'Will fail' },
        });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: 'Internal server error' });
      });
    });

    describe('GET /stories', () => {
      it('returns stories with default limit', async () => {
        const stories = [
          {
            id: 's1',
            title: 'Story 1',
            summary: 'Summary 1',
            scenario: 'Scenario 1',
            steps: [],
            findings: [],
            screenshotPaths: [],
            status: 'draft',
            createdAt: '2026-01-01',
          },
        ];
        mockGetAdminStories.mockResolvedValueOnce(stories);

        const handler = getRouteHandler('get', '/stories')!;
        expect(handler).toBeDefined();

        const req = createMockReq({ query: {} });
        const res = createMockRes();
        await handler(req, res);

        expect(res._json).toEqual({ stories });
        expect(mockGetAdminStories).toHaveBeenCalledWith(50);
        expect(mockLogAdminEvent).toHaveBeenCalledWith('list_stories', { count: 1 });
      });

      it('passes custom limit when provided', async () => {
        mockGetAdminStories.mockResolvedValueOnce([]);

        const handler = getRouteHandler('get', '/stories')!;
        const req = createMockReq({ query: { limit: '10' } });
        const res = createMockRes();
        await handler(req, res);

        expect(mockGetAdminStories).toHaveBeenCalledWith(10);
      });

      it('returns 500 on error', async () => {
        mockGetAdminStories.mockRejectedValueOnce(new Error('DB down'));

        const handler = getRouteHandler('get', '/stories')!;
        const req = createMockReq({ query: {} });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: 'Internal server error' });
      });
    });

    describe('GET /stories/:id', () => {
      it('returns story when found', async () => {
        const story = {
          id: 's1',
          title: 'Story 1',
          summary: 'Summary 1',
          scenario: 'Scenario 1',
          steps: [{ step: 1, action: 'Click', result: 'Opened' }],
          findings: [],
          screenshotPaths: ['/img/s1.png'],
          status: 'published',
          createdAt: '2026-01-01',
        };
        mockGetAdminStoryById.mockResolvedValueOnce(story);

        const handler = getRouteHandler('get', '/stories/:id')!;
        expect(handler).toBeDefined();

        const req = createMockReq({ params: { id: 's1' } as any });
        const res = createMockRes();
        await handler(req, res);

        expect(res._json).toEqual({ story });
        expect(mockLogAdminEvent).toHaveBeenCalledWith('get_story', { storyId: 's1' });
      });

      it('returns 404 when story not found', async () => {
        mockGetAdminStoryById.mockResolvedValueOnce(null);

        const handler = getRouteHandler('get', '/stories/:id')!;
        const req = createMockReq({ params: { id: 'nonexistent' } as any });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(404);
        expect(res._json).toEqual({ error: 'Story not found' });
      });

      it('returns 500 on error', async () => {
        mockGetAdminStoryById.mockRejectedValueOnce(new Error('DB down'));

        const handler = getRouteHandler('get', '/stories/:id')!;
        const req = createMockReq({ params: { id: 's1' } as any });
        const res = createMockRes();
        await handler(req, res);

        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: 'Internal server error' });
      });
    });
  });
});
