import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getActiveQuests: vi.fn(),
  updateQuestObjectives: vi.fn(),
  updateQuestStatus: vi.fn(),
  addCredits: vi.fn(),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  addPlayerXp: vi.fn().mockResolvedValue({ xp: 40, level: 1 }),
  setPlayerLevel: vi.fn(),
  addWissen: vi.fn(),
  getQuestById: vi.fn(),
  setPlayerReputation: vi.fn().mockResolvedValue(12),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getPlayerUpgrades: vi.fn().mockResolvedValue([]),
  upsertPlayerUpgrade: vi.fn(),
  getTrackedQuests: vi.fn().mockResolvedValue([]),
}));

vi.mock('../engine/inventoryService.js', () => ({
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, artefact: 0 }),
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
  getInventoryItem: vi.fn().mockResolvedValue(1),
}));

import { QuestService } from '../rooms/services/QuestService.js';
import { getActiveQuests, updateQuestObjectives, updateQuestStatus, getQuestById } from '../db/queries.js';
import { addToInventory, removeFromInventory, getInventoryItem } from '../engine/inventoryService.js';

const BOUNTY_QUEST_ROW = {
  id: 'quest-1',
  template_id: 'pirates_bounty_chase',
  station_x: 10,
  station_y: 10,
  rewards: { credits: 120, xp: 40, reputation: 12, wissen: 3 },
  objectives: [
    {
      type: 'bounty_trail',
      description: 'Verfolge die Spur',
      fulfilled: false,
      trail: [
        { x: 15, y: 15, hint: 'Hint 1' },
        { x: 18, y: 18, hint: 'Hint 2' },
      ],
      currentStep: 0,
      targetName: "Zyr'ex Korath",
      targetLevel: 2,
      currentHint: 'Hint 1',
    },
    {
      type: 'bounty_combat',
      description: 'Kampf',
      fulfilled: false,
      sectorX: 20,
      sectorY: 20,
      targetName: "Zyr'ex Korath",
      targetLevel: 2,
    },
    {
      type: 'bounty_deliver',
      description: 'Abliefern',
      fulfilled: false,
      stationX: 10,
      stationY: 10,
    },
  ],
};

function makeCtx() {
  return {
    send: vi.fn(),
    checkRate: vi.fn().mockReturnValue(true),
  };
}

function makeClient() {
  return { auth: { userId: 'player-1' }, send: vi.fn() };
}

describe('checkQuestProgress — bounty_trail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getActiveQuests as any).mockResolvedValue([
      { ...BOUNTY_QUEST_ROW, objectives: JSON.parse(JSON.stringify(BOUNTY_QUEST_ROW.objectives)) },
    ]);
  });

  it('advances currentStep when scan matches trail step 0', async () => {
    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'scan', {
      sectorX: 15,
      sectorY: 15,
    });

    expect(updateQuestObjectives).toHaveBeenCalled();
    const updated = (updateQuestObjectives as any).mock.calls[0][1];
    expect(updated[0].currentStep).toBe(1);
    expect(updated[0].fulfilled).toBe(false);
  });

  it('marks bounty_trail fulfilled when all steps done', async () => {
    const row = {
      ...BOUNTY_QUEST_ROW,
      objectives: JSON.parse(JSON.stringify(BOUNTY_QUEST_ROW.objectives)),
    };
    row.objectives[0].currentStep = 1; // already at step 1, scan step 1 finishes it
    (getActiveQuests as any).mockResolvedValue([row]);

    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'scan', {
      sectorX: 18,
      sectorY: 18,
    });

    const updated = (updateQuestObjectives as any).mock.calls[0][1];
    expect(updated[0].fulfilled).toBe(true);
  });

  it('does NOT match scan at combat sector (sectorX:20, sectorY:20)', async () => {
    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'scan', {
      sectorX: 20,
      sectorY: 20,
    });
    expect(updateQuestObjectives).not.toHaveBeenCalled();
  });

  it('does NOT match scan at wrong trail coordinates', async () => {
    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'scan', {
      sectorX: 99,
      sectorY: 99,
    });
    expect(updateQuestObjectives).not.toHaveBeenCalled();
  });
});

describe('checkQuestProgress — bounty_combat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getActiveQuests as any).mockResolvedValue([
      { ...BOUNTY_QUEST_ROW, objectives: JSON.parse(JSON.stringify(BOUNTY_QUEST_ROW.objectives)) },
    ]);
  });

  it('marks bounty_combat fulfilled on battle_won and adds prisoner to inventory', async () => {
    const row = {
      ...BOUNTY_QUEST_ROW,
      objectives: JSON.parse(JSON.stringify(BOUNTY_QUEST_ROW.objectives)),
    };
    row.objectives[0].fulfilled = true; // trail done
    (getActiveQuests as any).mockResolvedValue([row]);

    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'battle_won', {
      sectorX: 20,
      sectorY: 20,
    });

    const updated = (updateQuestObjectives as any).mock.calls[0][1];
    expect(updated[1].fulfilled).toBe(true);
    expect(addToInventory).toHaveBeenCalledWith('player-1', 'prisoner', 'quest-1', 1);
  });
});

describe('checkQuestProgress — bounty_deliver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getInventoryItem as any).mockResolvedValue(1);
  });

  it('marks bounty_deliver fulfilled on arrive at station with prisoner', async () => {
    const row = {
      ...BOUNTY_QUEST_ROW,
      objectives: JSON.parse(JSON.stringify(BOUNTY_QUEST_ROW.objectives)),
    };
    row.objectives[0].fulfilled = true;
    row.objectives[1].fulfilled = true;
    (getActiveQuests as any).mockResolvedValue([row]);
    (getInventoryItem as any).mockResolvedValue(1); // prisoner in inventory

    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'arrive', {
      sectorX: 10,
      sectorY: 10,
    });

    const updated = (updateQuestObjectives as any).mock.calls[0][1];
    expect(updated[2].fulfilled).toBe(true);
    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'prisoner', 'quest-1', 1);
  });

  it('does NOT fulfill bounty_deliver if prisoner not in inventory', async () => {
    const row = {
      ...BOUNTY_QUEST_ROW,
      objectives: JSON.parse(JSON.stringify(BOUNTY_QUEST_ROW.objectives)),
    };
    row.objectives[0].fulfilled = true;
    row.objectives[1].fulfilled = true;
    (getActiveQuests as any).mockResolvedValue([row]);
    (getInventoryItem as any).mockResolvedValue(0); // no prisoner

    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'arrive', {
      sectorX: 10,
      sectorY: 10,
    });

    expect(updateQuestObjectives).not.toHaveBeenCalled();
  });
});

describe('handleAbandonQuest — bounty_chase prisoner cleanup', () => {
  it('removes prisoner from inventory when bounty_combat is fulfilled', async () => {
    const questWithPrisoner = {
      id: 'quest-1',
      template_id: 'pirates_bounty_chase',
      objectives: [
        { type: 'bounty_trail', fulfilled: true, trail: [], currentStep: 0, targetName: 'X', targetLevel: 2 },
        { type: 'bounty_combat', fulfilled: true, sectorX: 20, sectorY: 20, targetName: 'X', targetLevel: 2 },
        { type: 'bounty_deliver', fulfilled: false, stationX: 10, stationY: 10 },
      ],
    };
    vi.clearAllMocks();
    (getQuestById as any).mockResolvedValue(questWithPrisoner);
    (updateQuestStatus as any).mockResolvedValue(true);
    (getActiveQuests as any).mockResolvedValue([]);

    const service = new QuestService(makeCtx() as any);
    await service.handleAbandonQuest(makeClient() as any, { questId: 'quest-1' });

    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'prisoner', 'quest-1', 1);
  });

  it('does NOT remove prisoner if bounty_combat not yet fulfilled', async () => {
    const questWithoutPrisoner = {
      id: 'quest-1',
      template_id: 'pirates_bounty_chase',
      objectives: [
        { type: 'bounty_trail', fulfilled: false, trail: [], currentStep: 0, targetName: 'X', targetLevel: 2 },
        { type: 'bounty_combat', fulfilled: false, sectorX: 20, sectorY: 20 },
        { type: 'bounty_deliver', fulfilled: false, stationX: 10, stationY: 10 },
      ],
    };
    vi.clearAllMocks();
    (getQuestById as any).mockResolvedValue(questWithoutPrisoner);
    (updateQuestStatus as any).mockResolvedValue(true);
    (getActiveQuests as any).mockResolvedValue([]);

    const service = new QuestService(makeCtx() as any);
    await service.handleAbandonQuest(makeClient() as any, { questId: 'quest-1' });

    expect(removeFromInventory).not.toHaveBeenCalled();
  });
});

describe('bounty combat victory → prisoner capture (integration)', () => {
  it('checkQuestProgress battle_won at combat sector captures prisoner', async () => {
    const row = {
      id: 'quest-1',
      template_id: 'pirates_bounty_chase',
      station_x: 10,
      station_y: 10,
      rewards: { credits: 120, xp: 40, reputation: 12, wissen: 3 },
      objectives: [
        { type: 'bounty_trail', fulfilled: true, trail: [], currentStep: 2, targetName: "Zyr'ex Korath", targetLevel: 2 },
        { type: 'bounty_combat', fulfilled: false, sectorX: 20, sectorY: 20, targetName: "Zyr'ex Korath", targetLevel: 2 },
        { type: 'bounty_deliver', fulfilled: false, stationX: 10, stationY: 10 },
      ],
    };
    vi.clearAllMocks();
    (getActiveQuests as any).mockResolvedValue([row]);

    const service = new QuestService(makeCtx() as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'battle_won', { sectorX: 20, sectorY: 20 });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'prisoner', 'quest-1', 1);
    const updated = (updateQuestObjectives as any).mock.calls[0][1];
    expect(updated[1].fulfilled).toBe(true);
  });
});
