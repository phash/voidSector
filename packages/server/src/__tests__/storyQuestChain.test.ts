// packages/server/src/__tests__/storyQuestChain.test.ts
import { describe, it, expect } from 'vitest';
import {
  STORY_CHAPTERS,
  canUnlockChapter,
  getChapterForDistance,
  applyBranchEffects,
  type StoryProgress,
} from '../engine/storyQuestChain.js';

describe('storyQuestChain', () => {
  it('has 9 chapters (0–8)', () => {
    expect(STORY_CHAPTERS).toHaveLength(9);
    expect(STORY_CHAPTERS[0].id).toBe(0);
    expect(STORY_CHAPTERS[8].id).toBe(8);
  });

  it('chapter 0 requires qDist >= 6', () => {
    expect(STORY_CHAPTERS[0].minQDist).toBe(6);
  });

  it('chapter 1 requires qDist >= 40', () => {
    expect(STORY_CHAPTERS[1].minQDist).toBe(40);
  });

  it('canUnlockChapter returns false if distance too low', () => {
    const progress: StoryProgress = { currentChapter: 0, completedChapters: [], branchChoices: {} };
    expect(canUnlockChapter(0, 5, progress)).toBe(false);
  });

  it('canUnlockChapter returns true if distance sufficient and previous complete', () => {
    const progress: StoryProgress = { currentChapter: 0, completedChapters: [], branchChoices: {} };
    expect(canUnlockChapter(0, 6, progress)).toBe(true);
  });

  it('canUnlockChapter requires previous chapter completed for chapter > 0', () => {
    const noProgress: StoryProgress = { currentChapter: 0, completedChapters: [], branchChoices: {} };
    expect(canUnlockChapter(1, 50, noProgress)).toBe(false);

    const withCh0: StoryProgress = { currentChapter: 1, completedChapters: [0], branchChoices: {} };
    expect(canUnlockChapter(1, 50, withCh0)).toBe(true);
  });

  it('getChapterForDistance returns correct chapter', () => {
    expect(getChapterForDistance(5)).toBe(null);   // below ch0
    expect(getChapterForDistance(6)).toBe(0);
    expect(getChapterForDistance(40)).toBe(1);
    expect(getChapterForDistance(100)).toBe(2);
  });

  it('applyBranchEffects returns rep deltas for chapter 2 choice A', () => {
    const effects = applyBranchEffects(2, 'A');
    expect(effects.archivists).toBe(30);
  });

  it('applyBranchEffects returns rep deltas for chapter 4 choice B', () => {
    const effects = applyBranchEffects(4, 'B');
    expect(effects.kthari).toBe(-20);
  });

  it('applyBranchEffects returns empty object for non-branch chapter', () => {
    const effects = applyBranchEffects(0, 'none');
    expect(Object.keys(effects)).toHaveLength(0);
  });
});
