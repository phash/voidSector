// packages/server/src/engine/__tests__/voidTraversability.test.ts
import { describe, it, expect } from 'vitest';
import { isVoidBlocked } from '../sectorTraversabilityService.js';

describe('isVoidBlocked', () => {
  it('returns false when sector is not in void set and not in void quadrant', () => {
    const controls: Array<{ qx: number; qy: number; controlling_faction: string }> = [];
    const frontierSet = new Set<string>();
    expect(isVoidBlocked(500, 500, controls, frontierSet, [])).toBe(false);
  });

  it('returns true when sector is in a fully void quadrant', () => {
    // Sector (5000, 5000) is in quadrant (0,0) — qx=floor(5000/10000)=0
    const controls = [{ qx: 0, qy: 0, controlling_faction: 'voids' }];
    const frontierSet = new Set<string>();
    expect(isVoidBlocked(5000, 5000, controls, frontierSet, [])).toBe(true);
  });

  it('returns true when sector is in frontier set', () => {
    const controls: Array<{ qx: number; qy: number; controlling_faction: string }> = [];
    const frontierSet = new Set(['100,200']);
    expect(isVoidBlocked(100, 200, controls, frontierSet, [])).toBe(true);
  });

  it('returns false when player has void_shield module', () => {
    const controls = [{ qx: 0, qy: 0, controlling_faction: 'voids' }];
    const frontierSet = new Set<string>();
    expect(isVoidBlocked(5000, 5000, controls, frontierSet, ['void_shield'])).toBe(false);
  });

  it('returns false for frontier sector with void_shield', () => {
    const controls: Array<{ qx: number; qy: number; controlling_faction: string }> = [];
    const frontierSet = new Set(['100,200']);
    expect(isVoidBlocked(100, 200, controls, frontierSet, ['void_shield'])).toBe(false);
  });
});
