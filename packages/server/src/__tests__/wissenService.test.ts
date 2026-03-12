import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));
vi.mock('../db/queries.js', () => ({
  addWissen: vi.fn(),
  getResearchLabTier: vi.fn(),
}));

import { awardWissen } from '../engine/wissenService.js';
import { addWissen, getResearchLabTier } from '../db/queries.js';

const mockAddWissen = vi.mocked(addWissen);
const mockGetLabTier = vi.mocked(getResearchLabTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('awardWissen', () => {
  it('adds base wissen when no lab', async () => {
    mockGetLabTier.mockResolvedValue(0);
    await awardWissen('p1', 5);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 5);
  });

  it('applies lab tier 3 multiplier (3.0)', async () => {
    mockGetLabTier.mockResolvedValue(3);
    await awardWissen('p1', 5);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 15); // 5 * 3.0
  });

  it('floors fractional wissen', async () => {
    mockGetLabTier.mockResolvedValue(1);
    await awardWissen('p1', 3);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 4); // 3 * 1.5 = 4.5 → 4
  });

  it('does nothing for 0 base', async () => {
    mockGetLabTier.mockResolvedValue(5);
    await awardWissen('p1', 0);
    expect(mockAddWissen).not.toHaveBeenCalled();
  });
});
