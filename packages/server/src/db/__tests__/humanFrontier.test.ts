import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.fn();
vi.mock('../client.js', () => ({ query: (...a: unknown[]) => query(...a), withTransaction: vi.fn(), runMigrations: vi.fn() }));

import { getHumanFrontierMaxDistance } from '../queries.js';

describe('getHumanFrontierMaxDistance', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the max Chebyshev quadrant distance any human has visited', async () => {
    query.mockResolvedValue({ rows: [{ max_dist: 7 }] });
    await expect(getHumanFrontierMaxDistance()).resolves.toBe(7);
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toMatch(/player_quadrant_visits/);
  });
  it('returns 0 when nobody has explored', async () => {
    query.mockResolvedValue({ rows: [{ max_dist: 0 }] });
    await expect(getHumanFrontierMaxDistance()).resolves.toBe(0);
  });
});
