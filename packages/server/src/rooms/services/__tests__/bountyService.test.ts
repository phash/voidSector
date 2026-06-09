import { describe, it, expect } from 'vitest';
import { validateBounty, BOUNTY_MAX_REWARD } from '../BountyService.js';

describe('validateBounty', () => {
  it('accepts pirate_defeat with a quadrant target + valid reward', () => {
    expect(validateBounty('pirate_defeat', { qx: 0, qy: 0 }, 500)).toMatchObject({ ok: true });
  });
  it('accepts reach_sector with a sector target', () => {
    expect(validateBounty('reach_sector', { sectorX: 5, sectorY: 3 }, 500)).toMatchObject({ ok: true });
  });
  it('rejects an unknown objective type', () => {
    expect(validateBounty('deliver', { qx: 0, qy: 0 }, 500).ok).toBe(false);
  });
  it('rejects pirate_defeat missing qx/qy', () => {
    expect(validateBounty('pirate_defeat', { sectorX: 1, sectorY: 2 }, 500).ok).toBe(false);
  });
  it('rejects reward < 1, non-integer, or over the cap', () => {
    expect(validateBounty('reach_sector', { sectorX: 1, sectorY: 1 }, 0).ok).toBe(false);
    expect(validateBounty('reach_sector', { sectorX: 1, sectorY: 1 }, 1.5).ok).toBe(false);
    expect(validateBounty('reach_sector', { sectorX: 1, sectorY: 1 }, BOUNTY_MAX_REWARD + 1).ok).toBe(false);
  });
});
