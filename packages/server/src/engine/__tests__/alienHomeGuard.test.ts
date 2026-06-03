import { describe, it, expect } from 'vitest';
import {
  quadrantNearestSectorDistance,
  assertAlienHomesFarFromOrigin,
} from '../alienHomeGuard.js';

const S = 500;

describe('quadrantNearestSectorDistance', () => {
  it('is the Chebyshev distance to the nearest sector of the quadrant', () => {
    expect(quadrantNearestSectorDistance(2, 0, S)).toBe(1000); // 2*500
    expect(quadrantNearestSectorDistance(1, 0, S)).toBe(500);  // too close
    expect(quadrantNearestSectorDistance(0, 0, S)).toBe(0);    // origin
    // Negative quadrant -5 spans [-2500,-2001]; nearest sector x=-2001.
    expect(quadrantNearestSectorDistance(-5, -25, S)).toBe(12001); // max(2001,12001)
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

  it('ignores the human faction', () => {
    const homes = [{ faction_id: 'human', home_qx: 0, home_qy: 0 }];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).not.toThrow();
  });
});
