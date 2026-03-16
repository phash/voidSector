import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));
vi.mock('../db/queries.js', () => ({
  addWissen: vi.fn(),
}));

import { awardWissen } from '../engine/wissenService.js';
import { addWissen } from '../db/queries.js';

const mockAddWissen = vi.mocked(addWissen);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('awardWissen', () => {
  it('adds base wissen amount (multiplier always 1.0)', async () => {
    await awardWissen('p1', 5);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 5);
  });

  it('floors fractional wissen', async () => {
    await awardWissen('p1', 4.7);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 4);
  });

  it('does nothing for 0 base', async () => {
    await awardWissen('p1', 0);
    expect(mockAddWissen).not.toHaveBeenCalled();
  });
});
