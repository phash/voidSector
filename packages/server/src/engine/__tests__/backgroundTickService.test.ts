import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/civQueries.js', () => ({
  civQueries: { updateShip: vi.fn() },
  getShipsAfterId: vi.fn(),
}));
vi.mock('../civShipService.js', () => ({
  nextShipState: vi.fn(),
}));
vi.mock('../npcStationEngine.js', () => ({
  applyTraderExport: vi.fn().mockResolvedValue(null),
}));

import {
  advanceCursor,
  processBackgroundTick,
  _resetBackgroundCursor,
} from '../backgroundTickService.js';
import { civQueries, getShipsAfterId } from '../../db/civQueries.js';
import { nextShipState } from '../civShipService.js';

describe('advanceCursor (BB1)', () => {
  it('wraps to 0 when fewer than a full page returned (end of table)', () => {
    expect(advanceCursor(999, 5, 300)).toBe(0);
  });
  it('continues past the last id on a full page', () => {
    expect(advanceCursor(999, 300, 300)).toBe(999);
  });
});

describe('processBackgroundTick (BB1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetBackgroundCursor();
  });

  it('advances each ship in the page (one persist per ship) and reports the count', async () => {
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([
      { id: 1, x: 0, y: 0, state: 'idle', role: 'trader' },
      { id: 2, x: 5, y: 5, state: 'idle', role: 'outlaw' },
    ]);
    // One AI step then settle (returns {} → loop stops).
    vi.mocked(nextShipState)
      .mockReturnValueOnce({ x: 1 } as any)
      .mockReturnValueOnce({} as any)
      .mockReturnValueOnce({ x: 6 } as any)
      .mockReturnValueOnce({} as any);

    const n = await processBackgroundTick();
    expect(n).toBe(2);
    expect(vi.mocked(civQueries.updateShip)).toHaveBeenCalledTimes(2);
    // Persists the caught-up position (ship 1 moved to x=1) + patrol_state field present.
    expect(vi.mocked(civQueries.updateShip)).toHaveBeenCalledWith(1, expect.objectContaining({ x: 1 }));
  });

  it('catch-up applies up to BACKGROUND_CATCHUP_STEPS AI steps per ship', async () => {
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([{ id: 1, x: 0, y: 0, state: 'traveling' }]);
    // Always returns a move → should be capped by BACKGROUND_CATCHUP_STEPS (8).
    vi.mocked(nextShipState).mockReturnValue({ x: 1 } as any);
    await processBackgroundTick();
    expect(vi.mocked(nextShipState)).toHaveBeenCalledTimes(8);
  });

  it('empty page wraps the cursor and reports 0', async () => {
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([]);
    const n = await processBackgroundTick();
    expect(n).toBe(0);
    expect(vi.mocked(civQueries.updateShip)).not.toHaveBeenCalled();
  });
});
