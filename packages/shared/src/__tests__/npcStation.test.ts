import { describe, it, expect } from 'vitest';
import {
  NPC_STATION_LEVELS,
  NPC_XP_DECAY_PER_HOUR,
  NPC_XP_VISIT,
  NPC_XP_PER_TRADE_UNIT,
  NPC_XP_QUEST_COMPLETE,
} from '../constants';

describe('NPC Station constants', () => {
  it('has 5 station levels', () => {
    expect(NPC_STATION_LEVELS).toHaveLength(5);
  });

  it('levels are ordered by xpThreshold', () => {
    for (let i = 1; i < NPC_STATION_LEVELS.length; i++) {
      expect(NPC_STATION_LEVELS[i].xpThreshold).toBeGreaterThan(
        NPC_STATION_LEVELS[i - 1].xpThreshold,
      );
    }
  });

  it('level 1 starts at xpThreshold 0', () => {
    expect(NPC_STATION_LEVELS[0].xpThreshold).toBe(0);
  });

  it('maxStock increases with level', () => {
    for (let i = 1; i < NPC_STATION_LEVELS.length; i++) {
      expect(NPC_STATION_LEVELS[i].maxStock).toBeGreaterThan(NPC_STATION_LEVELS[i - 1].maxStock);
    }
  });

  it('XP constants are positive', () => {
    expect(NPC_XP_DECAY_PER_HOUR).toBeGreaterThan(0);
    expect(NPC_XP_VISIT).toBeGreaterThan(0);
    expect(NPC_XP_PER_TRADE_UNIT).toBeGreaterThan(0);
    expect(NPC_XP_QUEST_COMPLETE).toBeGreaterThan(0);
  });
});
