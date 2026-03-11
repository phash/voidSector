// packages/server/src/__tests__/CommunityQuestService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getActiveCommunityAlienQuest: vi.fn().mockResolvedValue(null),
  insertCommunityAlienQuest: vi.fn().mockResolvedValue({
    id: 1,
    title: 'Test',
    current_count: 0,
    target_count: 100,
    status: 'active',
    alien_faction_id: 'archivists',
    quest_type: 'community_scan',
    description: 'test',
    reward_type: 'test',
    started_at: Date.now(),
    expires_at: Date.now() + 1000,
    completed_at: null,
  }),
  addCommunityQuestContribution: vi.fn().mockResolvedValue(undefined),
  expireOldCommunityQuests: vi.fn().mockResolvedValue(undefined),
  completeCommunityQuest: vi.fn().mockResolvedValue(undefined),
  contributeHumanityRep: vi.fn().mockResolvedValue(undefined),
  addWissen: vi.fn().mockResolvedValue(undefined),
  recordNewsEvent: vi.fn().mockResolvedValue(undefined),
}));

import { CommunityQuestService } from '../rooms/services/CommunityQuestService.js';

describe('CommunityQuestService', () => {
  let service: CommunityQuestService;

  beforeEach(() => {
    service = new CommunityQuestService();
    vi.clearAllMocks();
  });

  it('seedInitialIfEmpty creates quest when none active', async () => {
    const { insertCommunityAlienQuest } = await import('../db/queries.js');
    await service.seedInitialIfEmpty();
    expect(insertCommunityAlienQuest).toHaveBeenCalled();
  });

  it('seedInitialIfEmpty does not create quest when one is active', async () => {
    const { getActiveCommunityAlienQuest, insertCommunityAlienQuest } =
      await import('../db/queries.js');
    vi.mocked(getActiveCommunityAlienQuest).mockResolvedValueOnce({
      id: 1,
      status: 'active',
      alien_faction_id: 'archivists',
      quest_type: 'test',
      title: 'Active Quest',
      description: null,
      target_count: 100,
      current_count: 5,
      reward_type: null,
      started_at: Date.now(),
      expires_at: null,
      completed_at: null,
    });
    await service.seedInitialIfEmpty();
    expect(insertCommunityAlienQuest).not.toHaveBeenCalled();
  });

  it('contribute calls addCommunityQuestContribution', async () => {
    const { addCommunityQuestContribution, getActiveCommunityAlienQuest } =
      await import('../db/queries.js');
    vi.mocked(getActiveCommunityAlienQuest).mockResolvedValueOnce({
      id: 42,
      status: 'active',
      current_count: 5,
      target_count: 100,
      alien_faction_id: 'archivists',
      quest_type: 'test',
      title: 'Test',
      description: null,
      reward_type: null,
      started_at: Date.now(),
      expires_at: null,
      completed_at: null,
    });
    await service.contribute('player1', 3);
    expect(addCommunityQuestContribution).toHaveBeenCalledWith(42, 'player1', 3);
  });
});
