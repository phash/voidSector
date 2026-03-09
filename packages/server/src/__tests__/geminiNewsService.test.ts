// packages/server/src/__tests__/geminiNewsService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateFirstContactNews, FALLBACK_NEWS } from '../engine/geminiNewsService.js';

describe('geminiNewsService', () => {
  it('FALLBACK_NEWS covers all 10 alien factions', () => {
    const factions = [
      'archivists',
      'consortium',
      'kthari',
      'mycelians',
      'mirror_minds',
      'tourist_guild',
      'silent_swarm',
      'helions',
      'axioms',
      'scrappers',
    ];
    for (const f of factions) {
      expect(FALLBACK_NEWS[f]).toBeDefined();
      expect(typeof FALLBACK_NEWS[f]).toBe('string');
    }
  });

  it('generateFirstContactNews returns a string', async () => {
    // With gemini not available in test env, should return fallback
    const result = await generateFirstContactNews('archivists', 'TestPilot', 100, 200);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
