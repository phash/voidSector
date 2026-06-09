import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/civQueries.js', () => ({
  civQueries: { updateShip: vi.fn() },
  getShipsAfterId: vi.fn(),
}));
vi.mock('../civShipService.js', () => ({
  nextShipState: vi.fn(),
}));
vi.mock('../npcShipAI.js', () => ({
  nextExplorerState: vi.fn().mockReturnValue({ state: 'traveling', x: 10, y: 20, spiral_step: 0 }),
}));
vi.mock('../npcStationEngine.js', () => ({
  applyTraderExport: vi.fn().mockResolvedValue(null),
}));
vi.mock('../playerTraceService.js', () => ({
  recordTrace: vi.fn().mockResolvedValue(undefined),
  recordSectorTrace: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../worldgen.js', () => ({
  generateSector: vi.fn().mockReturnValue({ type: 'empty' }),
}));

import {
  advanceCursor,
  processBackgroundTick,
  _resetBackgroundCursor,
} from '../backgroundTickService.js';
import { civQueries, getShipsAfterId } from '../../db/civQueries.js';
import { nextShipState } from '../civShipService.js';
import { nextExplorerState } from '../npcShipAI.js';
import { recordTrace, recordSectorTrace } from '../playerTraceService.js';

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

describe('processBackgroundTick — explorer branch (H1 + M1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetBackgroundCursor();
  });

  it('uses nextExplorerState (not nextShipState) for explorer ships and persists the hop result', async () => {
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([
      { id: 6, x: 5, y: 5, state: 'traveling', role: 'explorer', spiral_step: 3, name: 'Scout' } as any,
    ]);
    vi.mocked(nextExplorerState).mockReturnValueOnce({ state: 'traveling', x: 6, y: 5, spiral_step: 4 } as any);

    await processBackgroundTick();

    // Explorer must be persisted via updateShip with the hop result.
    expect(vi.mocked(civQueries.updateShip)).toHaveBeenCalledOnce();
    expect(vi.mocked(civQueries.updateShip)).toHaveBeenCalledWith(6, expect.objectContaining({ x: 6, y: 5, spiral_step: 4 }));

    // nextShipState must NOT be called for explorers (no 8-step catch-up).
    expect(vi.mocked(nextShipState)).not.toHaveBeenCalled();
  });

  it('routes to recordTrace (global feed) when (ship.id + spiral_step) % 6 === 0', async () => {
    // id=3, spiral_step=3 → (3+3)=6, 6%6===0 → global feed
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([
      { id: 3, x: 1, y: 1, state: 'traveling', role: 'explorer', spiral_step: 0, name: 'Pioneer' } as any,
    ]);
    vi.mocked(nextExplorerState).mockReturnValueOnce({ state: 'traveling', x: 2, y: 1, spiral_step: 3 } as any);

    await processBackgroundTick();

    expect(vi.mocked(recordTrace)).toHaveBeenCalledOnce();
    expect(vi.mocked(recordSectorTrace)).not.toHaveBeenCalled();
  });

  it('routes to recordSectorTrace (sector-only) when (ship.id + spiral_step) % 6 !== 0', async () => {
    // id=3, spiral_step=2 → (3+2)=5, 5%6!==0 → sector-only
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([
      { id: 3, x: 1, y: 1, state: 'traveling', role: 'explorer', spiral_step: 0, name: 'Pioneer' } as any,
    ]);
    vi.mocked(nextExplorerState).mockReturnValueOnce({ state: 'traveling', x: 2, y: 1, spiral_step: 2 } as any);

    await processBackgroundTick();

    expect(vi.mocked(recordSectorTrace)).toHaveBeenCalledOnce();
    expect(vi.mocked(recordTrace)).not.toHaveBeenCalled();
  });

  it('covers both trace branches with two explorers in the same sweep', async () => {
    // Ship id=6, spiral_step=0 → (6+0)=6 → 6%6===0 → global
    // Ship id=7, spiral_step=0 → (7+0)=7 → 7%6===1 → sector-only
    vi.mocked(getShipsAfterId).mockResolvedValueOnce([
      { id: 6, x: 0, y: 0, state: 'traveling', role: 'explorer', spiral_step: 0, name: 'Alpha' } as any,
      { id: 7, x: 1, y: 0, state: 'traveling', role: 'explorer', spiral_step: 0, name: 'Beta' } as any,
    ]);
    vi.mocked(nextExplorerState)
      .mockReturnValueOnce({ state: 'traveling', x: 1, y: 0, spiral_step: 0 } as any)
      .mockReturnValueOnce({ state: 'traveling', x: 2, y: 0, spiral_step: 0 } as any);

    await processBackgroundTick();

    expect(vi.mocked(civQueries.updateShip)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(recordTrace)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordSectorTrace)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nextShipState)).not.toHaveBeenCalled();
  });
});
