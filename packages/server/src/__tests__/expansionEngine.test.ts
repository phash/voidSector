import { describe, it, expect } from 'vitest';
import {
  checkBorderContact,
  getExpansionTarget,
  findAllBorderPairs,
} from '../engine/expansionEngine.js';
import type { QuadrantControlRow } from '../db/queries.js';

function makeQuadrant(qx: number, qy: number, faction: string): QuadrantControlRow {
  return {
    qx,
    qy,
    controlling_faction: faction,
    faction_shares: { [faction]: 100 },
    attack_value: 0,
    defense_value: 0,
    friction_score: 0,
    station_tier: 1,
    last_strategic_tick: null,
  };
}

describe('checkBorderContact', () => {
  it('detects contact between neighboring different-faction quadrants', () => {
    const result = checkBorderContact(makeQuadrant(1, 0, 'human'), makeQuadrant(2, 0, 'kthari'));
    expect(result.hasContact).toBe(true);
    expect(result.factions).toContain('human');
    expect(result.factions).toContain('kthari');
  });

  it('no contact for same-faction quadrants', () => {
    const result = checkBorderContact(makeQuadrant(0, 0, 'human'), makeQuadrant(1, 0, 'human'));
    expect(result.hasContact).toBe(false);
  });

  it('no contact for non-neighboring different-faction quadrants', () => {
    const result = checkBorderContact(makeQuadrant(0, 0, 'human'), makeQuadrant(5, 5, 'kthari'));
    expect(result.hasContact).toBe(false);
  });

  it('detects diagonal neighbor contact', () => {
    const result = checkBorderContact(makeQuadrant(0, 0, 'human'), makeQuadrant(1, 1, 'kthari'));
    expect(result.hasContact).toBe(true);
  });
});

describe('getExpansionTarget', () => {
  it('returns an unclaimed neighbor of the faction', () => {
    const allControls = [makeQuadrant(0, 0, 'human')];
    const target = getExpansionTarget('human', allControls, 'wave');
    expect(target).not.toBeNull();
    // Must be adjacent to (0,0)
    expect(Math.abs(target!.qx) + Math.abs(target!.qy)).toBeGreaterThan(0);
    expect(Math.abs(target!.qx)).toBeLessThanOrEqual(1);
    expect(Math.abs(target!.qy)).toBeLessThanOrEqual(1);
  });

  it('returns null when all neighbors are claimed', () => {
    const allControls: QuadrantControlRow[] = [];
    // Center + all 8 neighbors all claimed
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        allControls.push(makeQuadrant(dx, dy, dx === 0 && dy === 0 ? 'human' : 'kthari'));
      }
    }
    const target = getExpansionTarget('human', allControls, 'wave');
    expect(target).toBeNull();
  });

  it('returns null when faction has no quadrants', () => {
    const allControls = [makeQuadrant(0, 0, 'kthari')];
    const target = getExpansionTarget('human', allControls, 'wave');
    expect(target).toBeNull();
  });
});

describe('findAllBorderPairs', () => {
  it('finds border pairs between different factions', () => {
    const allControls = [
      makeQuadrant(0, 0, 'human'),
      makeQuadrant(1, 0, 'kthari'),
      makeQuadrant(2, 0, 'human'),
    ];
    const pairs = findAllBorderPairs(allControls);
    expect(pairs.length).toBeGreaterThan(0);
    // human[0,0] ↔ kthari[1,0] and kthari[1,0] ↔ human[2,0]
    expect(pairs.length).toBe(2);
  });

  it('finds no pairs when all quadrants belong to same faction', () => {
    const allControls = [makeQuadrant(0, 0, 'human'), makeQuadrant(1, 0, 'human')];
    const pairs = findAllBorderPairs(allControls);
    expect(pairs.length).toBe(0);
  });
});
