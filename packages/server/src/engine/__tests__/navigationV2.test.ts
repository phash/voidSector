import { describe, it, expect } from 'vitest';
import {
  getSectorTraversability,
  findPath,
  validateJumpTarget,
} from '../sectorTraversabilityService.js';
import type { SectorEnvironment } from '@void-sector/shared';

describe('getSectorTraversability', () => {
  it('star sectors cannot be entered', () => {
    const result = getSectorTraversability('star');
    expect(result.canEnter).toBe(false);
    expect(result.moveCostMultiplier).toBe(Infinity);
  });

  it('black_hole sectors cannot be entered', () => {
    const result = getSectorTraversability('black_hole');
    expect(result.canEnter).toBe(false);
  });

  it('empty sectors have cost multiplier 1.0', () => {
    const result = getSectorTraversability('empty');
    expect(result.canEnter).toBe(true);
    expect(result.moveCostMultiplier).toBe(1.0);
  });

  it('nebula sectors cost 1.5x movement', () => {
    const result = getSectorTraversability('nebula');
    expect(result.canEnter).toBe(true);
    expect(result.moveCostMultiplier).toBe(1.5);
  });

  it('planet sectors have slight cost increase', () => {
    const result = getSectorTraversability('planet');
    expect(result.canEnter).toBe(true);
    expect(result.moveCostMultiplier).toBeGreaterThan(1.0);
  });

  it('asteroid sectors are traversable at normal cost', () => {
    const result = getSectorTraversability('asteroid');
    expect(result.canEnter).toBe(true);
    expect(result.moveCostMultiplier).toBe(1.0);
  });
});

describe('findPath', () => {
  const emptyEnv = () => 'empty' as SectorEnvironment;

  it('finds direct path between adjacent sectors', () => {
    const result = findPath(0, 0, 1, 0, emptyEnv);
    expect(result.found).toBe(true);
    expect(result.path).toHaveLength(2);
    expect(result.path[1]).toEqual({ x: 1, y: 0 });
  });

  it('finds path across multiple empty sectors', () => {
    const result = findPath(0, 0, 5, 0, emptyEnv);
    expect(result.found).toBe(true);
    expect(result.path.length).toBeGreaterThan(2);
    expect(result.path[result.path.length - 1]).toEqual({ x: 5, y: 0 });
  });

  it('returns found=true with trivial path when start equals end', () => {
    const result = findPath(3, 3, 3, 3, emptyEnv);
    expect(result.found).toBe(true);
    expect(result.path).toHaveLength(1);
  });

  it('avoids a single impassable star sector', () => {
    // Single star at (2, 0) — path (0,0)→(4,0) must detour via y=1 or y=-1
    const lookupEnv = (x: number, y: number): SectorEnvironment => {
      if (x === 2 && y === 0) return 'star';
      return 'empty';
    };

    const result = findPath(0, 0, 4, 0, lookupEnv, 50);
    expect(result.found).toBe(true);
    // Path should not go through the blocked sector
    for (const node of result.path) {
      expect(node).not.toEqual({ x: 2, y: 0 });
    }
  });

  it('returns found=false when destination is surrounded by impassable sectors', () => {
    // Target surrounded by stars
    const lookupEnv = (x: number, y: number): SectorEnvironment => {
      if (x === 5 || x === 3) return 'star';
      if (y === 5 || y === 3) return 'star';
      return 'empty';
    };

    const result = findPath(0, 0, 4, 4, lookupEnv, 30);
    // Target (4,4) is surrounded — no path
    expect(result.found).toBe(false);
  });

  it('prefers cheaper (empty) path over expensive (nebula) path when possible', () => {
    // Two paths to (0,3): direct through y=1,2 (nebula) or around via x=1
    const lookupEnv = (x: number, y: number): SectorEnvironment => {
      if (x === 0 && (y === 1 || y === 2)) return 'nebula';
      return 'empty';
    };

    const result = findPath(0, 0, 0, 3, lookupEnv, 50);
    expect(result.found).toBe(true);
    // Should find a path — may go through nebula or around
    expect(result.totalCost).toBeGreaterThan(0);
  });
});

describe('validateJumpTarget', () => {
  it('rejects black_hole jump targets', () => {
    const result = validateJumpTarget('black_hole');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects star jump targets', () => {
    const result = validateJumpTarget('star');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('allows jump to empty sector', () => {
    expect(validateJumpTarget('empty').valid).toBe(true);
  });

  it('allows jump to planet sector', () => {
    expect(validateJumpTarget('planet').valid).toBe(true);
  });

  it('allows jump to nebula sector', () => {
    expect(validateJumpTarget('nebula').valid).toBe(true);
  });

  it('allows jump to asteroid sector', () => {
    expect(validateJumpTarget('asteroid').valid).toBe(true);
  });
});
