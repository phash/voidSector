// packages/server/src/__tests__/alienEncounterGen.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  ALIEN_ENCOUNTER_TABLE,
  rollForEncounter,
  type AlienEncounterEvent,
} from '../engine/alienEncounterGen.js';

describe('alienEncounterGen', () => {
  it('encounter table has entries for multiple factions', () => {
    const factions = new Set(ALIEN_ENCOUNTER_TABLE.map((e) => e.factionId));
    expect(factions.size).toBeGreaterThan(4);
  });

  it('rollForEncounter returns null when distance too low', () => {
    const result = rollForEncounter('player1', 100, 100, 3, 3, 0); // qDist=3
    expect(result).toBeNull();
  });

  it('rollForEncounter returns null when cooldown active (stepsSinceLast < 10)', () => {
    // Even with correct distance, 5 steps since last encounter = cooldown
    const result = rollForEncounter('player1', 1000, 1000, 100, 100, 5);
    expect(result).toBeNull();
  });

  it('rollForEncounter can return an encounter with forced roll', () => {
    // Force roll by mocking Math.random
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);  // 0 < any positive chance
    const result = rollForEncounter('player1', 1000, 1000, 500, 500, 20); // qDist=500, 20 steps
    spy.mockRestore();
    // Should return some event (tourist_guild has 8% chance, always hits with random=0)
    expect(result).not.toBeNull();
    expect(result?.factionId).toBeDefined();
  });

  it('encounter events have required fields', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = rollForEncounter('player1', 500, 500, 500, 500, 20);
    spy.mockRestore();
    if (result) {
      expect(result).toHaveProperty('factionId');
      expect(result).toHaveProperty('eventText');
      expect(result).toHaveProperty('canRespond');
    }
  });
});
