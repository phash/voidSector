import { describe, it, expect } from 'vitest';
import { buildExplorerSpawnPlan, EXPLORER_TARGET } from '../explorerFleet.js';

describe('buildExplorerSpawnPlan', () => {
  it('plans exactly `count` ships', () => {
    expect(buildExplorerSpawnPlan(5).length).toBe(5);
  });
  it('mixes trader (consortium) and tourist (tourist_guild) factions', () => {
    const plan = buildExplorerSpawnPlan(EXPLORER_TARGET);
    const factions = new Set(plan.map((p) => p.faction));
    expect(factions.has('consortium')).toBe(true);
    expect(factions.has('tourist_guild')).toBe(true);
  });
  it('every ship is role=explorer, spawns near origin, has a name', () => {
    for (const p of buildExplorerSpawnPlan(10)) {
      expect(p.role).toBe('explorer');
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThanOrEqual(500);
    }
  });
  it('is deterministic', () => {
    expect(buildExplorerSpawnPlan(8)).toEqual(buildExplorerSpawnPlan(8));
  });
});
