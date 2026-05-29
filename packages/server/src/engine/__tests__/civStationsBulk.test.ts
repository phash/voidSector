/**
 * Startup-scaling fix: ensureCivStations must issue ONE set-based bulk upsert,
 * not one DB round-trip per faction-controlled quadrant. On a large world
 * (e.g. 76k+ alien-controlled quadrants) the per-row loop blocked beforeListen,
 * so the server never bound its port.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/civQueries.js', () => ({
  civQueries: {
    bulkEnsureFactionStations: vi.fn().mockResolvedValue(3),
    upsertStation: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../db/queries.js', () => ({
  getAllQuadrantControls: vi.fn().mockResolvedValue([
    { qx: 1, qy: 1, controlling_faction: 'kthari' },
    { qx: 2, qy: 2, controlling_faction: 'axioms' },
  ]),
}));

import { ensureCivStations, getQuadrantCenter } from '../civStationService.js';
import { civQueries } from '../../db/civQueries.js';
import { getAllQuadrantControls } from '../../db/queries.js';
import { QUADRANT_SIZE } from '@void-sector/shared';

describe('ensureCivStations — bulk upsert (startup scaling)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a single bulk upsert and never loops per-quadrant', async () => {
    await ensureCivStations();
    expect(civQueries.bulkEnsureFactionStations).toHaveBeenCalledTimes(1);
    // The old O(N) path is gone: no per-quadrant upsert, no loading every control row.
    expect((civQueries as unknown as { upsertStation: ReturnType<typeof vi.fn> }).upsertStation)
      .not.toHaveBeenCalled();
    expect(getAllQuadrantControls).not.toHaveBeenCalled();
  });

  it('passes quadrant size + half-size offset so the SQL computes centers', async () => {
    await ensureCivStations();
    const half = Math.floor(QUADRANT_SIZE / 2);
    expect(civQueries.bulkEnsureFactionStations).toHaveBeenCalledWith(QUADRANT_SIZE, half);
  });
});

describe('getQuadrantCenter', () => {
  it('computes center as qx*size + floor(size/2)', () => {
    const half = Math.floor(QUADRANT_SIZE / 2);
    expect(getQuadrantCenter(2, 3)).toEqual({
      x: 2 * QUADRANT_SIZE + half,
      y: 3 * QUADRANT_SIZE + half,
    });
  });
});
