// packages/server/src/rooms/services/StoryQuestChainService.ts
import {
  STORY_CHAPTERS,
  canUnlockChapter,
  applyBranchEffects,
  quadrantDistance,
  type StoryProgress,
} from '../../engine/storyQuestChain.js';
import { getStoryProgress, upsertStoryProgress, addAlienReputation } from '../../db/queries.js';

export interface StoryTriggerEvent {
  chapterId: number;
  title: string;
  flavorText: string;
  branches?: Array<{ id: string; label: string }>;
}

export class StoryQuestChainService {
  async checkTrigger(playerId: string, qx: number, qy: number): Promise<StoryTriggerEvent | null> {
    const qDist = quadrantDistance(qx, qy);
    const row = await getStoryProgress(playerId);
    const progress: StoryProgress = {
      currentChapter: row.current_chapter,
      completedChapters: row.completed_chapters,
      branchChoices: row.branch_choices,
    };

    const nextChapter = row.current_chapter;
    if (!canUnlockChapter(nextChapter, qDist, progress)) return null;

    const chapter = STORY_CHAPTERS[nextChapter];
    if (!chapter) return null;

    return {
      chapterId: chapter.id,
      title: chapter.title,
      flavorText: chapter.flavorText,
      branches: chapter.branches?.map((b) => ({ id: b.id, label: b.label })),
    };
  }

  async completeChapter(
    playerId: string,
    chapterId: number,
    branchChoice: string | null,
  ): Promise<boolean> {
    const row = await getStoryProgress(playerId);
    // Idempotency: ignore if already completed
    if (row.completed_chapters.includes(chapterId)) return false;
    const completedChapters = [...row.completed_chapters, chapterId];
    const branchChoices = { ...row.branch_choices };
    if (branchChoice) branchChoices[String(chapterId)] = branchChoice;

    await upsertStoryProgress(playerId, chapterId + 1, completedChapters, branchChoices);

    if (branchChoice) {
      const effects = applyBranchEffects(chapterId, branchChoice);
      for (const [factionId, delta] of Object.entries(effects)) {
        if (delta) {
          await addAlienReputation(playerId, factionId, delta).catch(() => {});
        }
      }
    }

    return true;
  }

  async getProgress(playerId: string): Promise<{
    currentChapter: number;
    completedChapters: number[];
    branchChoices: Record<string, string>;
    chapters: Array<{ id: number; title: string; minQDist: number; hasBranch: boolean }>;
  }> {
    const row = await getStoryProgress(playerId);
    return {
      currentChapter: row.current_chapter,
      completedChapters: row.completed_chapters,
      branchChoices: row.branch_choices,
      chapters: STORY_CHAPTERS.map((ch) => ({
        id: ch.id,
        title: ch.title,
        minQDist: ch.minQDist,
        hasBranch: !!ch.branches,
      })),
    };
  }
}
