import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getActiveQuests: vi.fn(),
  getSector: vi.fn().mockResolvedValue(null),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  addCredits: vi.fn(),
  addPlayerXp: vi.fn().mockResolvedValue({ xp: 0, level: 1 }),
  setPlayerLevel: vi.fn(),
  upsertSector: vi.fn(),
  updateQuestObjectives: vi.fn(),
  updateQuestStatus: vi.fn(),
  // Additional stubs for ScanService imports
  saveSector: vi.fn().mockResolvedValue(undefined),
  addDiscoveriesBatch: vi.fn().mockResolvedValue(undefined),
  addDiscovery: vi.fn().mockResolvedValue(undefined),
  getSectorsInRange: vi.fn().mockResolvedValue([]),
  insertScanEvent: vi.fn().mockResolvedValue('event-1'),
  getPlayerScanEvents: vi.fn().mockResolvedValue([]),
  completeScanEvent: vi.fn().mockResolvedValue(true),
  getPlayerReputation: vi.fn().mockResolvedValue(0),
  getPlayerFaction: vi.fn().mockResolvedValue(null),
  getFactionMembersByPlayerIds: vi.fn().mockResolvedValue([]),
  hasScannedRuin: vi.fn().mockResolvedValue(false),
  insertAncientRuinScan: vi.fn().mockResolvedValue(undefined),
  getActiveShip: vi.fn().mockResolvedValue(null),
  recordAlienEncounter: vi.fn().mockResolvedValue(undefined),
  addTypedArtefact: vi.fn().mockResolvedValue(undefined),
  getAllQuadrantControls: vi.fn().mockResolvedValue([]),
  addWissen: vi.fn().mockResolvedValue(undefined),
  getPlayerJumpGate: vi.fn().mockResolvedValue(null),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
  getAPState: vi.fn().mockResolvedValue({ current: 10, max: 10, lastUpdate: Date.now(), regenRate: 1 }),
  saveAPState: vi.fn(),
  getPlayerPosition: vi.fn(),
  savePlayerPosition: vi.fn(),
}));

vi.mock('../engine/ap.js', () => ({
  calculateCurrentAP: vi.fn().mockReturnValue(100),
}));

vi.mock('../engine/commands.js', () => ({
  validateLocalScan: vi.fn().mockReturnValue({ valid: true, newAP: { current: 90 }, hiddenSignatures: 0 }),
  validateAreaScan: vi.fn().mockReturnValue({ valid: true, newAP: { current: 80 }, radius: 3 }),
  createPirateEncounter: vi.fn().mockReturnValue({}),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
}));

vi.mock('../engine/scanEvents.js', () => ({
  checkScanEvent: vi.fn().mockReturnValue({ hasEvent: false }),
}));

vi.mock('../engine/worldgen.js', () => ({
  generateSector: vi.fn().mockReturnValue({ x: 0, y: 0, type: 'empty', environment: 'empty', resources: {}, contents: [], metadata: {} }),
}));

vi.mock('../engine/ancientRuinsService.js', () => ({
  resolveAncientRuinScan: vi.fn().mockReturnValue({ fragmentIndex: 0, fragmentText: 'Fragment', ruinLevel: 1, artefactFound: false }),
}));

vi.mock('../engine/permadeathService.js', () => ({
  getWrecksInSector: vi.fn().mockResolvedValue([]),
  salvageWreckModule: vi.fn().mockResolvedValue(null),
}));

vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
  getAcepXpSummary: vi.fn().mockResolvedValue({}),
}));

vi.mock('../engine/traitCalculator.js', () => ({
  calculateTraits: vi.fn().mockReturnValue([]),
}));

vi.mock('../engine/personalityMessages.js', () => ({
  getPersonalityComment: vi.fn().mockReturnValue(null),
}));

vi.mock('../engine/universeBootstrap.js', () => ({
  getUniverseTickCount: vi.fn().mockReturnValue(1000),
}));

vi.mock('../engine/expansionEngine.js', () => ({
  isFrontierQuadrant: vi.fn().mockReturnValue(false),
}));

vi.mock('../engine/quadrantEngine.js', () => ({
  sectorToQuadrant: vi.fn().mockReturnValue({ qx: 0, qy: 0 }),
}));

vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  canAddResource: vi.fn().mockResolvedValue(true),
  getResourceTotal: vi.fn().mockResolvedValue(0),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

import { getActiveQuests } from '../db/queries.js';
import { redis } from '../rooms/services/RedisAPStore.js';

// Test the exported helper function
import { checkBountyAmbush } from '../rooms/services/ScanService.js';

describe('checkBountyAmbush', () => {
  const COMBAT_QUEST = {
    id: 'q1',
    objectives: [
      { type: 'bounty_trail', fulfilled: true },
      { type: 'bounty_combat', fulfilled: false, sectorX: 20, sectorY: 20, targetName: "Zyr'ex Korath", targetLevel: 3 },
      { type: 'bounty_deliver', fulfilled: false },
    ],
  };

  beforeEach(() => vi.clearAllMocks());

  it('returns ambush data when trail fulfilled, scan at combat sector, no Redis key', async () => {
    (getActiveQuests as any).mockResolvedValue([COMBAT_QUEST]);
    (redis.get as any).mockResolvedValue(null);

    const result = await checkBountyAmbush('player-1', 20, 20);
    expect(result).not.toBeNull();
    expect(result!.targetName).toBe("Zyr'ex Korath");
    expect(result!.targetLevel).toBe(3);
    expect(result!.questId).toBe('q1');
  });

  it('returns null when scan is NOT at combat sector', async () => {
    (getActiveQuests as any).mockResolvedValue([COMBAT_QUEST]);
    const result = await checkBountyAmbush('player-1', 15, 15);
    expect(result).toBeNull();
  });

  it('returns null when bounty_trail not yet fulfilled', async () => {
    const notReady = { ...COMBAT_QUEST, objectives: JSON.parse(JSON.stringify(COMBAT_QUEST.objectives)) };
    notReady.objectives[0].fulfilled = false;
    (getActiveQuests as any).mockResolvedValue([notReady]);
    const result = await checkBountyAmbush('player-1', 20, 20);
    expect(result).toBeNull();
  });

  it('returns null when Redis key present (already triggered)', async () => {
    (getActiveQuests as any).mockResolvedValue([COMBAT_QUEST]);
    (redis.get as any).mockResolvedValue('1');
    const result = await checkBountyAmbush('player-1', 20, 20);
    expect(result).toBeNull();
  });

  it('returns null when bounty_combat already fulfilled', async () => {
    const done = { ...COMBAT_QUEST, objectives: JSON.parse(JSON.stringify(COMBAT_QUEST.objectives)) };
    done.objectives[1].fulfilled = true;
    (getActiveQuests as any).mockResolvedValue([done]);
    const result = await checkBountyAmbush('player-1', 20, 20);
    expect(result).toBeNull();
  });
});
