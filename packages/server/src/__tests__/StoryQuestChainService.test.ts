// packages/server/src/__tests__/StoryQuestChainService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB queries
vi.mock('../db/queries.js', () => ({
  getStoryProgress: vi.fn().mockResolvedValue({
    player_id: 'p1',
    current_chapter: 0,
    completed_chapters: [],
    branch_choices: {},
    last_progress: Date.now(),
  }),
  upsertStoryProgress: vi.fn().mockResolvedValue(undefined),
  addAlienReputation: vi.fn().mockResolvedValue(undefined),
}));

import { StoryQuestChainService } from '../rooms/services/StoryQuestChainService.js';

describe('StoryQuestChainService', () => {
  let service: StoryQuestChainService;

  beforeEach(() => {
    service = new StoryQuestChainService();
    vi.clearAllMocks();
  });

  it('checkTrigger returns null when distance too low', async () => {
    const result = await service.checkTrigger('p1', 3, 3);
    expect(result).toBeNull();
  });

  it('checkTrigger returns chapter 0 event at qDist 6', async () => {
    const result = await service.checkTrigger('p1', 6, 0); // qDist = 6
    expect(result).not.toBeNull();
    expect(result?.chapterId).toBe(0);
  });

  it('completeChapter marks chapter as completed', async () => {
    const { upsertStoryProgress } = await import('../db/queries.js');
    await service.completeChapter('p1', 0, null);
    expect(upsertStoryProgress).toHaveBeenCalledWith('p1', 1, [0], {});
  });

  it('completeChapter with branch saves branch choice', async () => {
    const { upsertStoryProgress, getStoryProgress } = await import('../db/queries.js');
    vi.mocked(getStoryProgress).mockResolvedValueOnce({
      player_id: 'p1',
      current_chapter: 2,
      completed_chapters: [0, 1],
      branch_choices: {},
      last_progress: Date.now(),
    });
    await service.completeChapter('p1', 2, 'A');
    expect(upsertStoryProgress).toHaveBeenCalledWith('p1', 3, [0, 1, 2], { '2': 'A' });
  });
});
