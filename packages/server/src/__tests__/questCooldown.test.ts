/**
 * Tests for Redis-based quest cooldown (#233):
 * - After acceptQuest, a Redis cooldown key is set (TTL = 10 universe ticks)
 * - handleGetStationNpcs filters out quests with an active cooldown key
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// --- Mock Redis (hoisted so vi.mock factory can reference it) ---
const redisMock = vi.hoisted(() => ({
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  redis: redisMock,
}));

// --- Mock inventoryService ---
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  canAddResource: vi.fn().mockResolvedValue(true),
  getResourceTotal: vi.fn().mockResolvedValue(0),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock DB queries ---
vi.mock('../db/queries.js', () => ({
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getPlayerReputation: vi.fn().mockResolvedValue(0),
  setPlayerReputation: vi.fn().mockResolvedValue(5),
  getPlayerUpgrades: vi.fn().mockResolvedValue([]),
  upsertPlayerUpgrade: vi.fn().mockResolvedValue(undefined),
  getActiveQuests: vi.fn().mockResolvedValue([]),
  getActiveQuestCount: vi.fn().mockResolvedValue(0),
  insertQuest: vi.fn().mockResolvedValue('quest-abc'),
  updateQuestStatus: vi.fn().mockResolvedValue(true),
  updateQuestObjectives: vi.fn().mockResolvedValue(undefined),
  addPlayerXp: vi.fn().mockResolvedValue({ xp: 10, level: 1 }),
  setPlayerLevel: vi.fn().mockResolvedValue(undefined),
  addCredits: vi.fn().mockResolvedValue(1100),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  trackQuest: vi.fn().mockResolvedValue(undefined),
  getTrackedQuests: vi.fn().mockResolvedValue([]),
  getAcceptedQuestTemplateIds: vi.fn().mockResolvedValue([]),
  addWissen: vi.fn().mockResolvedValue(undefined),
  getQuestById: vi.fn().mockResolvedValue(null),
  upsertInventory: vi.fn().mockResolvedValue(undefined),
  deductInventory: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getCargoCapForPlayer: vi.fn().mockResolvedValue(50),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../engine/npcgen.js', () => ({
  generateStationNpcs: vi.fn().mockReturnValue([{ name: 'NPC-1' }]),
  getStationFaction: vi.fn().mockReturnValue('traders'),
}));

vi.mock('../engine/questgen.js', () => ({
  generateStationQuests: vi.fn().mockReturnValue([
    {
      templateId: 'traders_fetch_1',
      npcName: 'Vendor',
      npcFactionId: 'traders',
      title: 'Fetch Quest',
      description: 'Fetch resources',
      objectives: [],
      rewards: { credits: 100, xp: 10 },
      requiredTier: 'neutral',
    },
    {
      templateId: 'traders_scan_1',
      npcName: 'Scout',
      npcFactionId: 'traders',
      title: 'Scan Quest',
      description: 'Scan a sector',
      objectives: [],
      rewards: { credits: 150, xp: 15 },
      requiredTier: 'neutral',
    },
  ]),
}));

vi.mock('../engine/commands.js', () => ({
  validateAcceptQuest: vi.fn().mockReturnValue({ valid: true }),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
  calculateLevel: vi.fn().mockReturnValue(1),
}));

import { QuestService } from '../rooms/services/QuestService.js';
import { UNIVERSE_TICK_MS } from '@void-sector/shared';

function makeClient(userId = 'user-123', sessionId = 'session-abc'): Client {
  return {
    sessionId,
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    _px: vi.fn().mockReturnValue(5),
    _py: vi.fn().mockReturnValue(10),
    send: vi.fn(),
    getPlayerBonuses: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as import('../rooms/services/ServiceContext.js').ServiceContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue('OK');
});

describe('QuestService cooldown — handleAcceptQuest', () => {
  it('sets Redis cooldown key after successful quest acceptance', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new QuestService(ctx);

    await svc.handleAcceptQuest(client, {
      templateId: 'traders_fetch_1',
      stationX: 3,
      stationY: 7,
    });

    const expectedKey = 'quest_cooldown:user-123:3:7:traders_fetch_1';
    const expectedTtl = Math.ceil(UNIVERSE_TICK_MS * 10 / 1000);

    expect(redisMock.set).toHaveBeenCalledWith(expectedKey, '1', 'EX', expectedTtl);
  });

  it('does not set cooldown key when quest template is not found', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new QuestService(ctx);

    await svc.handleAcceptQuest(client, {
      templateId: 'nonexistent_template',
      stationX: 3,
      stationY: 7,
    });

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(client, 'acceptQuestResult', {
      success: false,
      error: 'Quest not available',
    });
  });
});

describe('QuestService cooldown — handleGetStationNpcs', () => {
  it('returns all quests when no cooldown keys are active', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    redisMock.get.mockResolvedValue(null); // no cooldowns

    const svc = new QuestService(ctx);
    await svc.handleGetStationNpcs(client, { sectorX: 3, sectorY: 7 });

    const sendCall = (ctx.send as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[1] === 'stationNpcsResult',
    );
    expect(sendCall).toBeDefined();
    const result = sendCall![2] as { quests: typeof mockQuests };
    expect(result.quests).toHaveLength(2);
  });

  it('filters out quests with active cooldown keys', async () => {
    const client = makeClient();
    const ctx = makeCtx();

    // First quest has cooldown, second does not
    redisMock.get.mockImplementation((key: string) => {
      if (key === 'quest_cooldown:user-123:3:7:traders_fetch_1') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    const svc = new QuestService(ctx);
    await svc.handleGetStationNpcs(client, { sectorX: 3, sectorY: 7 });

    const sendCall = (ctx.send as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[1] === 'stationNpcsResult',
    );
    expect(sendCall).toBeDefined();
    const result = sendCall![2] as { quests: typeof mockQuests };
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].templateId).toBe('traders_scan_1');
  });

  it('returns empty quests when all have active cooldowns', async () => {
    const client = makeClient();
    const ctx = makeCtx();

    // All quests have cooldown
    redisMock.get.mockResolvedValue('1');

    const svc = new QuestService(ctx);
    await svc.handleGetStationNpcs(client, { sectorX: 3, sectorY: 7 });

    const sendCall = (ctx.send as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[1] === 'stationNpcsResult',
    );
    expect(sendCall).toBeDefined();
    const result = sendCall![2] as { quests: typeof mockQuests };
    expect(result.quests).toHaveLength(0);
  });
});
