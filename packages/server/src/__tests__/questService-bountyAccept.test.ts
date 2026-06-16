import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB queries
vi.mock('../db/queries.js', () => ({
  getActiveQuestCount: vi.fn().mockResolvedValue(0),
  getPlayerReputations: vi.fn().mockResolvedValue([{ faction_id: 'pirates', reputation: 100 }]),
  insertQuest: vi.fn().mockResolvedValue('quest-id-1'),
  getActiveQuests: vi.fn().mockResolvedValue([]),
  getTrackedQuests: vi.fn().mockResolvedValue([]),
  getAcceptedQuestTemplateIds: vi.fn().mockResolvedValue([]),
  addCredits: vi.fn(),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  updateQuestStatus: vi.fn(),
  updateQuestObjectives: vi.fn(),
  addPlayerXp: vi.fn().mockResolvedValue({ xp: 10, level: 1 }),
  setPlayerLevel: vi.fn(),
  addWissen: vi.fn(),
}));

vi.mock('../engine/inventoryService.js', () => ({
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, artefact: 0 }),
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
}));

vi.mock('../engine/npcgen.js', () => ({
  generateStationNpcs: vi.fn().mockReturnValue([
    { name: 'Korax', factionId: 'pirates', role: 'boss' },
  ]),
  getStationFaction: vi.fn().mockReturnValue('pirates'),
}));

vi.mock('../engine/questgen.js', () => ({
  generateStationQuests: vi.fn().mockReturnValue([
    {
      templateId: 'pirates_bounty_chase',
      npcName: 'Korax',
      npcFactionId: 'pirates',
      title: 'Kopfgeld-Auftrag',
      description: 'Verfolge und fange den Piraten ???. Bringe ihn lebend zurück.',
      objectives: [
        { type: 'bounty_trail', description: 'Verfolge die Spur des Ziels', fulfilled: false },
        { type: 'bounty_combat', description: 'Schalte das Ziel aus', fulfilled: false },
        { type: 'bounty_deliver', description: 'Liefere den Gefangenen ab', fulfilled: false },
      ],
      rewards: { credits: 120, xp: 40, reputation: 12, wissen: 3 },
      requiredTier: 'neutral',
    },
  ]),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

import { QuestService } from '../rooms/services/QuestService.js';
import { insertQuest } from '../db/queries.js';
import { generateStationQuests } from '../engine/questgen.js';
import { getCargoState } from '../engine/inventoryService.js';

function makeCtx(overrides = {}) {
  return {
    send: vi.fn(),
    checkRate: vi.fn().mockReturnValue(true),
    checkQuestProgress: vi.fn(),
    contributeToCommunityQuest: vi.fn(),
    getPlayerBonuses: vi.fn().mockResolvedValue({}),
    _px: vi.fn().mockReturnValue(10),
    _py: vi.fn().mockReturnValue(10),
    quadrantX: 0,
    quadrantY: 0,
    ...overrides,
  };
}

function makeClient(overrides = {}) {
  return {
    auth: { userId: 'player-1' },
    send: vi.fn(),
    ...overrides,
  };
}

describe('QuestService.handleAcceptQuest — bounty_chase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts 3 objectives with bounty_trail, bounty_combat, bounty_deliver', async () => {
    const ctx = makeCtx() as any;
    const service = new QuestService(ctx);
    const client = makeClient() as any;

    await service.handleAcceptQuest(client, {
      templateId: 'pirates_bounty_chase',
      stationX: 10,
      stationY: 10,
    });

    expect(insertQuest).toHaveBeenCalled();
    const call = (insertQuest as any).mock.calls[0];
    // Find the objectives parameter — it's the one that's an array
    const objectives = call.find((arg: any) => Array.isArray(arg));
    expect(objectives).toHaveLength(3);
    expect(objectives[0].type).toBe('bounty_trail');
    expect(objectives[1].type).toBe('bounty_combat');
    expect(objectives[2].type).toBe('bounty_deliver');
  });

  it('bounty_trail objective has trail array and targetName', async () => {
    const ctx = makeCtx() as any;
    const service = new QuestService(ctx);
    const client = makeClient() as any;

    await service.handleAcceptQuest(client, {
      templateId: 'pirates_bounty_chase',
      stationX: 10,
      stationY: 10,
    });

    const call = (insertQuest as any).mock.calls[0];
    const objectives = call.find((arg: any) => Array.isArray(arg));
    const trailObj = objectives[0];
    expect(Array.isArray(trailObj.trail)).toBe(true);
    expect(trailObj.trail.length).toBeGreaterThanOrEqual(2);
    expect(typeof trailObj.targetName).toBe('string');
    expect(trailObj.targetName).not.toBe('???');
    expect(typeof trailObj.targetLevel).toBe('number');
    expect(trailObj.currentStep).toBe(0);
    expect(trailObj.fulfilled).toBe(false);
  });

  it('bounty_combat objective has sectorX/Y and targetName', async () => {
    const ctx = makeCtx() as any;
    const service = new QuestService(ctx);
    const client = makeClient() as any;

    await service.handleAcceptQuest(client, {
      templateId: 'pirates_bounty_chase',
      stationX: 10,
      stationY: 10,
    });

    const call = (insertQuest as any).mock.calls[0];
    const objectives = call.find((arg: any) => Array.isArray(arg));
    const combatObj = objectives[1];
    expect(typeof combatObj.sectorX).toBe('number');
    expect(typeof combatObj.sectorY).toBe('number');
    expect(typeof combatObj.targetName).toBe('string');
    expect(combatObj.fulfilled).toBe(false);
  });

  it('bounty_deliver objective has stationX/Y', async () => {
    const ctx = makeCtx() as any;
    const service = new QuestService(ctx);
    const client = makeClient() as any;

    await service.handleAcceptQuest(client, {
      templateId: 'pirates_bounty_chase',
      stationX: 10,
      stationY: 10,
    });

    const call = (insertQuest as any).mock.calls[0];
    const objectives = call.find((arg: any) => Array.isArray(arg));
    const deliverObj = objectives[2];
    expect(deliverObj.stationX).toBe(10);
    expect(deliverObj.stationY).toBe(10);
    expect(deliverObj.fulfilled).toBe(false);
  });
});

describe('QuestService.handleAcceptQuest — fetch quest with full cargo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a fetch quest even when cargo is full (delivery verifies items, not accept)', async () => {
    // A fetch quest: "beschaffe 2 Crystal".
    vi.mocked(generateStationQuests).mockReturnValue([
      {
        templateId: 'fetch_crystal',
        npcName: 'Quartermaster',
        npcFactionId: 'humanity',
        title: 'Beschaffe 2 Crystal',
        description: 'Liefere 2 Crystal an die Station.',
        objectives: [
          {
            type: 'fetch',
            description: 'Beschaffe 2 Crystal',
            fulfilled: false,
            resource: 'crystal',
            amount: 2,
          },
        ],
        rewards: { credits: 80, xp: 20, reputation: 5, wissen: 1 },
        requiredTier: 'neutral',
      },
    ] as any);

    // Cargo completely full — the old accept-time check would have rejected here.
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 50,
      gas: 50,
      crystal: 50,
      slates: 0,
      artefact: 0,
    } as any);

    const ctx = makeCtx() as any;
    const service = new QuestService(ctx);
    const client = makeClient() as any;

    await service.handleAcceptQuest(client, {
      templateId: 'fetch_crystal',
      stationX: 10,
      stationY: 10,
    });

    const sendCalls = (ctx.send as any).mock.calls;
    const acceptResult = sendCalls.find((c: any[]) => c[1] === 'acceptQuestResult');
    expect(acceptResult).toBeDefined();
    // Must NOT be rejected for cargo space.
    expect(acceptResult[2].error).not.toBe('Zu wenig Laderaum für diese Quest');
    expect(acceptResult[2].success).toBe(true);
    expect(insertQuest).toHaveBeenCalled();
  });
});
