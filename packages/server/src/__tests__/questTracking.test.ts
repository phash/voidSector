/**
 * Tests for quest tracking functionality (#214):
 * - trackQuest DB function
 * - getTrackedQuests DB function
 * - QuestService.handleTrackQuest — enforces max 5, sends trackedQuestsUpdate
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

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
  insertQuest: vi.fn().mockResolvedValue('quest-1'),
  updateQuestStatus: vi.fn().mockResolvedValue(true),
  updateQuestObjectives: vi.fn().mockResolvedValue(undefined),
  addPlayerXp: vi.fn().mockResolvedValue({ xp: 10, level: 1 }),
  setPlayerLevel: vi.fn().mockResolvedValue(undefined),
  addCredits: vi.fn().mockResolvedValue(1100),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  trackQuest: vi.fn().mockResolvedValue(undefined),
  getTrackedQuests: vi.fn().mockResolvedValue([]),
  upsertInventory: vi.fn().mockResolvedValue(undefined),
  deductInventory: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getCargoCapForPlayer: vi.fn().mockResolvedValue(50),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../engine/npcgen.js', () => ({
  generateStationNpcs: vi.fn().mockReturnValue([]),
  getStationFaction: vi.fn().mockReturnValue('traders'),
}));

vi.mock('../engine/questgen.js', () => ({
  generateStationQuests: vi.fn().mockReturnValue([]),
}));

vi.mock('../engine/commands.js', () => ({
  validateAcceptQuest: vi.fn().mockReturnValue({ valid: true }),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
  calculateLevel: vi.fn().mockReturnValue(1),
}));

import { QuestService } from '../rooms/services/QuestService.js';
import { trackQuest, getTrackedQuests } from '../db/queries.js';

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

beforeEach(() => vi.clearAllMocks());

describe('QuestService.handleTrackQuest', () => {
  it('calls trackQuest and sends trackedQuestsUpdate on success', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const tracked = [{ questId: 'q1', title: 'Test Quest', type: 'fetch' }];
    vi.mocked(getTrackedQuests).mockResolvedValue(tracked as any);

    const svc = new QuestService(ctx);
    await svc.handleTrackQuest(client, { questId: 'q1', tracked: true });

    expect(trackQuest).toHaveBeenCalledWith('user-123', 'q1', true);
    expect(ctx.send).toHaveBeenCalledWith(client, 'trackedQuestsUpdate', { quests: tracked });
    expect(ctx.send).toHaveBeenCalledWith(client, 'trackQuestResult', { success: true });
  });

  it('calls trackQuest with tracked=false to untrack', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    vi.mocked(getTrackedQuests).mockResolvedValue([]);

    const svc = new QuestService(ctx);
    await svc.handleTrackQuest(client, { questId: 'q1', tracked: false });

    expect(trackQuest).toHaveBeenCalledWith('user-123', 'q1', false);
  });

  it('rejects tracking when already at max 5 tracked quests', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const maxTracked = [
      { questId: 'q1', title: 'Q1', type: 'fetch' },
      { questId: 'q2', title: 'Q2', type: 'scan' },
      { questId: 'q3', title: 'Q3', type: 'delivery' },
      { questId: 'q4', title: 'Q4', type: 'bounty' },
      { questId: 'q5', title: 'Q5', type: 'fetch' },
    ];
    vi.mocked(getTrackedQuests).mockResolvedValue(maxTracked as any);

    const svc = new QuestService(ctx);
    await svc.handleTrackQuest(client, { questId: 'q6', tracked: true });

    expect(trackQuest).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(client, 'trackQuestResult', {
      success: false,
      error: 'MAX_TRACKED_REACHED',
    });
  });

  it('allows untracking even when at max 5', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    // When untracking, getTrackedQuests is called after the update
    vi.mocked(getTrackedQuests).mockResolvedValue([]);

    const svc = new QuestService(ctx);
    await svc.handleTrackQuest(client, { questId: 'q1', tracked: false });

    // trackQuest should be called even if tracked=false (untrack)
    expect(trackQuest).toHaveBeenCalledWith('user-123', 'q1', false);
  });
});

describe('QuestService.handleGetTrackedQuests', () => {
  it('sends current tracked quests to client', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const tracked = [
      { questId: 'q1', title: 'Delivery Quest', type: 'delivery', targetX: 10, targetY: 20 },
    ];
    vi.mocked(getTrackedQuests).mockResolvedValue(tracked as any);

    const svc = new QuestService(ctx);
    await svc.handleGetTrackedQuests(client);

    expect(getTrackedQuests).toHaveBeenCalledWith('user-123');
    expect(ctx.send).toHaveBeenCalledWith(client, 'trackedQuestsUpdate', { quests: tracked });
  });

  it('sends empty array when no quests are tracked', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    vi.mocked(getTrackedQuests).mockResolvedValue([]);

    const svc = new QuestService(ctx);
    await svc.handleGetTrackedQuests(client);

    expect(ctx.send).toHaveBeenCalledWith(client, 'trackedQuestsUpdate', { quests: [] });
  });
});
