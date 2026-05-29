import { describe, it, expect } from 'vitest';
import { calculateSpawnNeeds } from '../engine/npcSpawner.js';

// Targets come from NPC_SPAWN_COUNTS (shared):
//   inner  (dist<=3): military 8,  outlaw 5,  trader 10
//   middle (dist<=7): military 15, outlaw 15, trader 10
//   outer  (else):    military 25, outlaw 8,  trader 10
describe('calculateSpawnNeeds', () => {
  it('inner quadrant needs the full inner target when empty', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs).toEqual({ military: 8, outlaw: 5, trader: 10 });
  });

  it('returns 0 when at capacity', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 10, military: 8, outlaw: 5 });
    expect(needs).toEqual({ military: 0, outlaw: 0, trader: 0 });
  });

  it('outer quadrant targets 25 military', () => {
    const needs = calculateSpawnNeeds(10, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs.military).toBe(25);
  });

  it('middle quadrant targets 15 outlaw', () => {
    const needs = calculateSpawnNeeds(5, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs.outlaw).toBe(15);
  });

  it('only fills the deficit, never negative', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 12, military: 2, outlaw: 5 });
    expect(needs).toEqual({ military: 6, outlaw: 0, trader: 0 });
  });
});
