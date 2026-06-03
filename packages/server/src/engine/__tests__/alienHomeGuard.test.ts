import { describe, it, expect } from 'vitest';
import {
  quadrantNearestSectorDistance,
  assertAlienHomesFarFromOrigin,
} from '../alienHomeGuard.js';

const S = 500;

describe('quadrantNearestSectorDistance', () => {
  it('uses the centered quadrant convention (matches sectorToQuadrant)', () => {
    // Quadrant Q spans [Q*500-250, Q*500+249]; nearest sector to origin = |Q|*500-250.
    expect(quadrantNearestSectorDistance(2, 0, S)).toBe(750);  // 2*500-250
    expect(quadrantNearestSectorDistance(1, 0, S)).toBe(250);  // too close
    expect(quadrantNearestSectorDistance(0, 0, S)).toBe(0);    // origin quadrant
    expect(quadrantNearestSectorDistance(-5, -25, S)).toBe(12250); // max(2250,12250)
  });
});

describe('assertAlienHomesFarFromOrigin', () => {
  it('passes when all non-human homes are >= minDist', () => {
    const homes = [
      { faction_id: 'human', home_qx: 0, home_qy: 0 },
      { faction_id: 'kthari', home_qx: 20, home_qy: -15 },
      { faction_id: 'tourist_guild', home_qx: -5, home_qy: -25 },
    ];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).not.toThrow();
  });

  it('throws when an alien home is closer than minDist', () => {
    const homes = [
      { faction_id: 'human', home_qx: 0, home_qy: 0 },
      { faction_id: 'too_close', home_qx: 1, home_qy: 0 }, // 500 < 1000
    ];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).toThrow(/too_close/);
  });

  it('ignores the human faction (live id is "humans")', () => {
    const homes = [{ faction_id: 'humans', home_qx: 0, home_qy: 0 }];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).not.toThrow();
  });
});
