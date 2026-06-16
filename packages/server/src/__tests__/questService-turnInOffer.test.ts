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
  getWissen: vi.fn().mockResolvedValue(0),
  getQuestById: vi.fn(),
  setPlayerReputation: vi.fn().mockResolvedValue(12),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getPlayerUpgrades: vi.fn().mockResolvedValue([]),
  upsertPlayerUpgrade: vi.fn(),
  getTrackedQuests: vi.fn().mockResolvedValue([]),
  getInventory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../engine/inventoryService.js', () => ({
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, artefact: 0 }),
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
  getInventoryItem: vi.fn().mockResolvedValue(0),
}));

import { QuestService } from '../rooms/services/QuestService.js';
import {
  getActiveQuests,
  updateQuestObjectives,
  updateQuestStatus,
  getQuestById,
  addCredits,
} from '../db/queries.js';
import {
  removeFromInventory,
  getInventoryItem,
} from '../engine/inventoryService.js';

// A recon/scan quest: scan a sector, then deliver the data slate back to the
// giver station at 10:10. Once the scan is done, arriving at 10:10 should OFFER
// turn-in (not auto-complete).
function reconQuestRow(scanFulfilled: boolean) {
  return {
    id: 'quest-1',
    template_id: 'scientists_recon',
    title: 'Aufklärung Sektor 30:30',
    station_x: 10,
    station_y: 10,
    status: 'active',
    rewards: { credits: 150, xp: 30, reputation: 8, wissen: 4 },
    objectives: [
      {
        type: 'scan',
        description: 'Scanne Sektor 30:30',
        fulfilled: scanFulfilled,
        targetX: 30,
        targetY: 30,
      },
      {
        type: 'scan_deliver',
        description: 'Liefere die Daten zurück',
        fulfilled: false,
        stationX: 10,
        stationY: 10,
      },
    ],
  };
}

function makeCtx() {
  return {
    send: vi.fn(),
    checkRate: vi.fn().mockReturnValue(true),
    contributeToCommunityQuest: vi.fn(),
    broadcast: vi.fn(),
    _px: vi.fn().mockReturnValue(10),
    _py: vi.fn().mockReturnValue(10),
  };
}

function makeClient() {
  return { sessionId: 's-1', auth: { userId: 'player-1' }, send: vi.fn() };
}

describe('checkQuestProgress — scan_deliver arrival offers turn-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends questTurnInOffer (not auto-complete) when arriving with scan done', async () => {
    const row = reconQuestRow(true);
    (getActiveQuests as any).mockResolvedValue([row]);
    (getInventoryItem as any).mockResolvedValue(1); // slate present

    const ctx = makeCtx();
    const service = new QuestService(ctx as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'arrive', {
      sectorX: 10,
      sectorY: 10,
    });

    const offerCall = (ctx.send as any).mock.calls.find((c: any[]) => c[1] === 'questTurnInOffer');
    expect(offerCall).toBeDefined();
    expect(offerCall[2]).toMatchObject({ questId: 'quest-1', title: 'Aufklärung Sektor 30:30' });
    expect(offerCall[2].rewardCredits).toBe(150);

    // Does NOT auto-complete and does NOT consume the slate.
    expect(updateQuestStatus).not.toHaveBeenCalled();
    expect(removeFromInventory).not.toHaveBeenCalled();
    const completeCall = (ctx.send as any).mock.calls.find((c: any[]) => c[1] === 'questComplete');
    expect(completeCall).toBeUndefined();
    // The scan_deliver objective stays unfulfilled (not persisted as done).
    const objSave = (updateQuestObjectives as any).mock.calls[0];
    if (objSave) {
      const saved = objSave[1];
      expect(saved.find((o: any) => o.type === 'scan_deliver').fulfilled).toBe(false);
    }
  });

  it('does nothing when arriving while the scan is NOT yet done', async () => {
    const row = reconQuestRow(false);
    (getActiveQuests as any).mockResolvedValue([row]);
    (getInventoryItem as any).mockResolvedValue(0);

    const ctx = makeCtx();
    const service = new QuestService(ctx as any);
    await service.checkQuestProgress(makeClient() as any, 'player-1', 'arrive', {
      sectorX: 10,
      sectorY: 10,
    });

    const offerCall = (ctx.send as any).mock.calls.find((c: any[]) => c[1] === 'questTurnInOffer');
    expect(offerCall).toBeUndefined();
    expect(updateQuestStatus).not.toHaveBeenCalled();
    expect(removeFromInventory).not.toHaveBeenCalled();
  });
});

describe('handleTurnInQuest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a ready quest at the giver station and consumes the slate', async () => {
    const row = reconQuestRow(true);
    (getQuestById as any).mockResolvedValue(row);
    (getInventoryItem as any).mockResolvedValue(1); // slate present
    (updateQuestStatus as any).mockResolvedValue(true);

    const ctx = makeCtx();
    const service = new QuestService(ctx as any);
    await service.handleTurnInQuest(makeClient() as any, { questId: 'quest-1' });

    // Slate consumed.
    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'data_slate', 'quest-1', 1);
    // Quest completed → status + reward + questComplete pushed.
    expect(updateQuestStatus).toHaveBeenCalledWith('quest-1', 'completed');
    expect(addCredits).toHaveBeenCalledWith('player-1', 150);
    const completeCall = (ctx.send as any).mock.calls.find((c: any[]) => c[1] === 'questComplete');
    expect(completeCall).toBeDefined();
    expect(completeCall[2]).toMatchObject({ id: 'quest-1' });
    // scan_deliver objective marked fulfilled + persisted.
    const objSave = (updateQuestObjectives as any).mock.calls.find(
      (c: any[]) => c[0] === 'quest-1',
    );
    expect(objSave).toBeDefined();
    expect(objSave[1].find((o: any) => o.type === 'scan_deliver').fulfilled).toBe(true);
  });

  it('still completes when the data_slate is MISSING (robustness)', async () => {
    const row = reconQuestRow(true);
    (getQuestById as any).mockResolvedValue(row);
    (getInventoryItem as any).mockResolvedValue(0); // slate gone
    (updateQuestStatus as any).mockResolvedValue(true);

    const ctx = makeCtx();
    const service = new QuestService(ctx as any);
    await service.handleTurnInQuest(makeClient() as any, { questId: 'quest-1' });

    // Did not attempt to remove a non-existent slate.
    expect(removeFromInventory).not.toHaveBeenCalled();
    // But still completed.
    expect(updateQuestStatus).toHaveBeenCalledWith('quest-1', 'completed');
    const completeCall = (ctx.send as any).mock.calls.find((c: any[]) => c[1] === 'questComplete');
    expect(completeCall).toBeDefined();
  });

  it('sends TURNIN_FAIL and does NOT complete when the scan is not yet done', async () => {
    const row = reconQuestRow(false);
    (getQuestById as any).mockResolvedValue(row);
    (getInventoryItem as any).mockResolvedValue(0);

    const ctx = makeCtx();
    const service = new QuestService(ctx as any);
    await service.handleTurnInQuest(makeClient() as any, { questId: 'quest-1' });

    const errCall = (ctx.send as any).mock.calls.find(
      (c: any[]) => c[1] === 'error' && c[2]?.code === 'TURNIN_FAIL',
    );
    expect(errCall).toBeDefined();
    expect(updateQuestStatus).not.toHaveBeenCalled();
  });

  it('sends TURNIN_FAIL when not at the giver station', async () => {
    const row = reconQuestRow(true);
    (getQuestById as any).mockResolvedValue(row);
    (getInventoryItem as any).mockResolvedValue(1);

    const ctx = makeCtx();
    // Player is somewhere else.
    ctx._px.mockReturnValue(99);
    ctx._py.mockReturnValue(99);
    const service = new QuestService(ctx as any);
    await service.handleTurnInQuest(makeClient() as any, { questId: 'quest-1' });

    const errCall = (ctx.send as any).mock.calls.find(
      (c: any[]) => c[1] === 'error' && c[2]?.code === 'TURNIN_FAIL',
    );
    expect(errCall).toBeDefined();
    expect(updateQuestStatus).not.toHaveBeenCalled();
  });
});
