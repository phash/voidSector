import { describe, it, expect } from 'vitest';
import { calculateSpawnNeeds } from '../engine/npcSpawner.js';

describe('calculateSpawnNeeds', () => {
  it('inner quadrant needs 3 military, 2 outlaw, 4 trader when empty', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs).toEqual({ military: 3, outlaw: 2, trader: 4 });
  });

  it('returns 0 when at capacity', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 4, military: 3, outlaw: 2 });
    expect(needs).toEqual({ military: 0, outlaw: 0, trader: 0 });
  });

  it('outer quadrant has 12 military', () => {
    const needs = calculateSpawnNeeds(10, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs.military).toBe(12);
  });

  it('middle quadrant has 6 outlaw', () => {
    const needs = calculateSpawnNeeds(5, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs.outlaw).toBe(6);
  });
});
