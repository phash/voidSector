/**
 * TDD: QuestService uses unified inventory instead of cargo table.
 * Verifies getCargoState / removeFromInventory are used,
 * NOT getPlayerCargo / deductCargo from the legacy cargo table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// --- Mock DB client (for direct query function tests) ---
vi.mock('../db/client.js', () => ({
  query: vi.fn(),
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
  // Legacy cargo fns — should NOT be called after migration
  getPlayerCargo: vi.fn(),
  deductCargo: vi.fn(),
  // Other queries QuestService needs
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
  upsertInventory: vi.fn().mockResolvedValue(undefined),
  deductInventory: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getCargoCapForPlayer: vi.fn().mockResolvedValue(50),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(null),
  getAcceptedQuestTemplateIds: vi.fn().mockResolvedValue([]),
  trackQuest: vi.fn().mockResolvedValue(undefined),
  getTrackedQuests: vi.fn().mockResolvedValue([]),
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
import { getPlayerCargo, deductCargo, getAcceptedQuestTemplateIds } from '../db/queries.js';
import { getCargoState, removeFromInventory } from '../engine/inventoryService.js';
import { generateStationQuests } from '../engine/questgen.js';

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

// Build a mock active quest row with fetch objective
function makeFetchQuestRow(playerId = 'user-123') {
  return {
    id: 'quest-1',
    template_id: 'traders_fetch_ore',
    title: 'Deliver Ore',
    station_x: 5,
    station_y: 10,
    objectives: [{ type: 'fetch', resource: 'ore', amount: 5, fulfilled: false }],
    rewards: { credits: 200, xp: 50 },
    status: 'active',
    accepted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    player_id: playerId,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// checkQuestProgress — fetch quest with enough resources
// ──────────────────────────────────────────────────────────────────────────────
describe('QuestService.checkQuestProgress fetch quest — inventory migration', () => {
  it('uses getCargoState (not getPlayerCargo) to check resources', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getActiveQuests, updateQuestObjectives, updateQuestStatus } =
      await import('../db/queries.js');

    vi.mocked(getActiveQuests).mockResolvedValue([makeFetchQuestRow()] as any);
    vi.mocked(updateQuestObjectives).mockResolvedValue(true);
    vi.mocked(updateQuestStatus).mockResolvedValue(true);
    // Player has enough ore
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });

    const svc = new QuestService(ctx);
    // arrive action triggers fetch quest check
    await svc.checkQuestProgress(client, 'user-123', 'arrive', { sectorX: 5, sectorY: 10 });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
  });

  it('uses removeFromInventory (not deductCargo) when deducting fetch resources', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getActiveQuests, updateQuestObjectives, updateQuestStatus } =
      await import('../db/queries.js');

    vi.mocked(getActiveQuests).mockResolvedValue([makeFetchQuestRow()] as any);
    vi.mocked(updateQuestObjectives).mockResolvedValue(true);
    vi.mocked(updateQuestStatus).mockResolvedValue(true);
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new QuestService(ctx);
    await svc.checkQuestProgress(client, 'user-123', 'arrive', { sectorX: 5, sectorY: 10 });

    expect(removeFromInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 5);
    expect(deductCargo).not.toHaveBeenCalled();
  });

  it('sends cargoUpdate using getCargoState (not getPlayerCargo) after quest completion', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getActiveQuests, updateQuestObjectives, updateQuestStatus } =
      await import('../db/queries.js');

    vi.mocked(getActiveQuests)
      .mockResolvedValueOnce([makeFetchQuestRow()] as any) // first call during checkQuestProgress
      .mockResolvedValueOnce([] as any); // second call in sendActiveQuests
    vi.mocked(updateQuestObjectives).mockResolvedValue(true);
    vi.mocked(updateQuestStatus).mockResolvedValue(true);
    const afterCargo = { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 };
    vi.mocked(getCargoState).mockResolvedValue(afterCargo);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new QuestService(ctx);
    await svc.checkQuestProgress(client, 'user-123', 'arrive', { sectorX: 5, sectorY: 10 });

    // ctx.send is used in QuestService (not client.send)
    expect(ctx.send).toHaveBeenCalledWith(client, 'cargoUpdate', afterCargo);
    expect(getPlayerCargo).not.toHaveBeenCalled();
    expect(deductCargo).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getAcceptedQuestTemplateIds — DB query for filtering already-accepted quests
// ──────────────────────────────────────────────────────────────────────────────
describe('getAcceptedQuestTemplateIds', () => {
  it('returns template_ids of active quests at given station', async () => {
    const { query } = await import('../db/client.js');
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ template_id: 'delivery_ore_basic' }, { template_id: 'scan_sector' }],
      rowCount: 2,
    } as any);

    const { getAcceptedQuestTemplateIds } = await vi.importActual<
      typeof import('../db/queries.js')
    >('../db/queries.js');
    const result = await getAcceptedQuestTemplateIds('player-1', 5, 10);

    expect(result).toEqual(['delivery_ore_basic', 'scan_sector']);
  });

  it('returns empty array when player has no active quests at station', async () => {
    const { query } = await import('../db/client.js');
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const { getAcceptedQuestTemplateIds } = await vi.importActual<
      typeof import('../db/queries.js')
    >('../db/queries.js');
    const result = await getAcceptedQuestTemplateIds('player-1', 5, 10);

    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleGetStationNpcs — quest filtering
// ──────────────────────────────────────────────────────────────────────────────
describe('handleGetStationNpcs — quest filtering', () => {
  it('filters out quests the player already has active at this station', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new QuestService(ctx);

    // Mock: player has 'delivery_ore_basic' active already
    vi.mocked(getAcceptedQuestTemplateIds).mockResolvedValueOnce(['delivery_ore_basic']);
    // Mock: station offers 2 quests
    vi.mocked(generateStationQuests).mockReturnValueOnce([
      {
        templateId: 'delivery_ore_basic',
        title: 'Lieferquest',
        npcName: 'NPC1',
        npcFactionId: 'terran',
        description: '',
        objectives: [],
        rewards: {},
      },
      {
        templateId: 'scan_sector',
        title: 'Scan-Quest',
        npcName: 'NPC2',
        npcFactionId: 'terran',
        description: '',
        objectives: [],
        rewards: {},
      },
    ] as any);

    await svc.handleGetStationNpcs(client, { sectorX: 5, sectorY: 10 });

    const sentQuests = ctx.send.mock.calls.find(
      ([, msg]: [unknown, string]) => msg === 'stationNpcsResult',
    )?.[2]?.quests as Array<{ templateId: string }>;
    expect(sentQuests).toBeDefined();
    expect(sentQuests.map((q) => q.templateId)).not.toContain('delivery_ore_basic');
    expect(sentQuests.map((q) => q.templateId)).toContain('scan_sector');
  });
});
