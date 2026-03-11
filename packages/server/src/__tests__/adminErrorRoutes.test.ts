import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

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
  getRecentExpansionLog: vi.fn(),
  createAdminStory: vi.fn(),
  getAdminStories: vi.fn(),
  getAdminStoryById: vi.fn(),
  getAdminQuadrantMap: vi.fn(),
  getActiveFactionHomes: vi.fn(),
  getErrorLogs: vi.fn(),
  updateErrorLogStatus: vi.fn(),
  deleteErrorLog: vi.fn(),
}));
vi.mock('../engine/universeBootstrap.js', () => ({ getUniverseTickCount: vi.fn().mockReturnValue(0) }));
vi.mock('../rooms/services/RedisAPStore.js', () => ({ getPlayerPosition: vi.fn(), savePlayerPosition: vi.fn() }));
vi.mock('../adminBus.js', () => ({ adminBus: { broadcast: vi.fn(), questCreated: vi.fn(), playerUpdated: vi.fn() } }));
vi.mock('../constructionBus.js', () => ({ constructionBus: { emit: vi.fn() } }));
vi.mock('../db/constructionQueries.js', () => ({
  getAllConstructionSites: vi.fn(),
  getConstructionSiteById: vi.fn(),
  deleteConstructionSiteById: vi.fn(),
}));
vi.mock('../db/queries.js', () => ({ createStructure: vi.fn() }));

import { adminRouter } from '../adminRoutes.js';
import {
  getErrorLogs,
  updateErrorLogStatus,
  deleteErrorLog,
  logAdminEvent,
} from '../db/adminQueries.js';

const mockGetErrorLogs = vi.mocked(getErrorLogs);
const mockUpdateErrorLogStatus = vi.mocked(updateErrorLogStatus);
const mockDeleteErrorLog = vi.mocked(deleteErrorLog);
const mockLogAdminEvent = vi.mocked(logAdminEvent);

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

const MOCK_ERRORS = [
  {
    id: 1,
    fingerprint: 'abc123',
    message: 'Test error',
    location: 'foo.ts:1',
    stack: null,
    count: 3,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: 'new',
    github_issue_url: null,
  },
];

describe('Admin /errors routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAdminEvent.mockResolvedValue(1);
  });

  describe('GET /errors', () => {
    it('returns errors list', async () => {
      mockGetErrorLogs.mockResolvedValue(MOCK_ERRORS as any);
      const handler = getRouteHandler('get', '/errors');
      expect(handler).toBeDefined();

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(200);
      expect((res._json as any).errors).toEqual(MOCK_ERRORS);
      expect(mockGetErrorLogs).toHaveBeenCalledWith('new');
    });

    it('passes status query param to getErrorLogs', async () => {
      mockGetErrorLogs.mockResolvedValue([]);
      const handler = getRouteHandler('get', '/errors');

      const req = createMockReq({ query: { status: 'ignored' } as any });
      const res = createMockRes();
      await handler!(req, res);

      expect(mockGetErrorLogs).toHaveBeenCalledWith('ignored');
      expect((res._json as any).errors).toEqual([]);
    });

    it('returns 500 on DB error', async () => {
      mockGetErrorLogs.mockRejectedValue(new Error('DB fail'));
      const handler = getRouteHandler('get', '/errors');

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(500);
      expect((res._json as any).error).toBe('Internal server error');
    });
  });

  describe('POST /errors/:id/ignore', () => {
    it('ignores error and returns success', async () => {
      mockUpdateErrorLogStatus.mockResolvedValue(true as any);
      const handler = getRouteHandler('post', '/errors/:id/ignore');
      expect(handler).toBeDefined();

      const req = createMockReq({ params: { id: '1' } });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(200);
      expect((res._json as any).success).toBe(true);
      expect(mockUpdateErrorLogStatus).toHaveBeenCalledWith(1, 'ignored');
    });

    it('returns 500 on DB error', async () => {
      mockUpdateErrorLogStatus.mockRejectedValue(new Error('DB fail'));
      const handler = getRouteHandler('post', '/errors/:id/ignore');

      const req = createMockReq({ params: { id: '1' } });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(500);
    });
  });

  describe('POST /errors/:id/resolve', () => {
    it('resolves error and returns success', async () => {
      mockUpdateErrorLogStatus.mockResolvedValue(true as any);
      const handler = getRouteHandler('post', '/errors/:id/resolve');
      expect(handler).toBeDefined();

      const req = createMockReq({ params: { id: '2' } });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(200);
      expect((res._json as any).success).toBe(true);
      expect(mockUpdateErrorLogStatus).toHaveBeenCalledWith(2, 'resolved');
    });

    it('returns 500 on DB error', async () => {
      mockUpdateErrorLogStatus.mockRejectedValue(new Error('DB fail'));
      const handler = getRouteHandler('post', '/errors/:id/resolve');

      const req = createMockReq({ params: { id: '2' } });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(500);
    });
  });

  describe('DELETE /errors/:id', () => {
    it('deletes error and returns success', async () => {
      mockDeleteErrorLog.mockResolvedValue(true as any);
      const handler = getRouteHandler('delete', '/errors/:id');
      expect(handler).toBeDefined();

      const req = createMockReq({ params: { id: '3' } });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(200);
      expect((res._json as any).success).toBe(true);
      expect(mockDeleteErrorLog).toHaveBeenCalledWith(3);
    });

    it('returns 500 on DB error', async () => {
      mockDeleteErrorLog.mockRejectedValue(new Error('DB fail'));
      const handler = getRouteHandler('delete', '/errors/:id');

      const req = createMockReq({ params: { id: '3' } });
      const res = createMockRes();
      await handler!(req, res);

      expect(res._status).toBe(500);
    });
  });
});
