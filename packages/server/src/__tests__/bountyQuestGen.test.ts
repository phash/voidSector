import { describe, it, expect } from 'vitest';
import {
  generateBountyName,
  generateBountyTrail,
  BOUNTY_TRAIL_SALT,
  BOUNTY_NAME_SALT,
} from '../engine/bountyQuestGen.js';

describe('generateBountyName', () => {
  it('returns a non-empty string', () => {
    expect(generateBountyName(42)).toBeTruthy();
  });

  it('is deterministic — same seed → same name', () => {
    expect(generateBountyName(1234)).toBe(generateBountyName(1234));
  });

  it('differs for different seeds', () => {
    expect(generateBountyName(1)).not.toBe(generateBountyName(9999));
  });

  it('matches format: PREFIX+MID LAST', () => {
    // Name contains a space (first part + last name)
    expect(generateBountyName(0)).toMatch(/\S+ \S+/);
  });
});

describe('generateBountyTrail', () => {
  it('level 1 produces 2 trail steps', () => {
    const trail = generateBountyTrail(10, 10, 1, 100);
    expect(trail.steps).toHaveLength(2);
  });

  it('level 3 produces 3 trail steps', () => {
    const trail = generateBountyTrail(10, 10, 3, 200);
    expect(trail.steps).toHaveLength(3);
  });

  it('level 5 produces 4 trail steps', () => {
    const trail = generateBountyTrail(10, 10, 5, 300);
    expect(trail.steps).toHaveLength(4);
  });

  it('is deterministic', () => {
    const a = generateBountyTrail(5, 5, 2, 42);
    const b = generateBountyTrail(5, 5, 2, 42);
    expect(a.steps[0].x).toBe(b.steps[0].x);
    expect(a.combatX).toBe(b.combatX);
  });

  it('includes hint strings on each step', () => {
    const trail = generateBountyTrail(10, 10, 1, 100);
    for (const step of trail.steps) {
      expect(step.hint).toBeTruthy();
    }
  });

  it('level 1 hint reveals exact next sector', () => {
    const trail = generateBountyTrail(10, 10, 1, 100);
    // First step hint should reference the next step coords (or combat sector on last step)
    expect(trail.steps[0].hint).toMatch(/S \d+:\d+/);
  });

  it('level 5 hint only reveals quadrant', () => {
    const trail = generateBountyTrail(10, 10, 5, 300);
    // Higher level: hint mentions Quadrant, not exact sector
    expect(trail.steps[0].hint).toMatch(/Quadrant/i);
  });

  it('combat sector is beyond last trail step', () => {
    const trail = generateBountyTrail(10, 10, 2, 42);
    const lastStep = trail.steps[trail.steps.length - 1];
    // combat sector differs from last trail step
    expect(trail.combatX !== lastStep.x || trail.combatY !== lastStep.y).toBe(true);
  });

  it('exports salt constants', () => {
    expect(typeof BOUNTY_TRAIL_SALT).toBe('number');
    expect(typeof BOUNTY_NAME_SALT).toBe('number');
  });
});
