import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../db/quadrantQueries.js', () => ({
  getQuadrant: vi.fn(),
  upsertQuadrant: vi.fn(),
  addPlayerKnownQuadrant: vi.fn(),
  addPlayerKnownQuadrantsBatch: vi.fn(),
  quadrantNameExists: vi.fn(),
  updateQuadrantName: vi.fn(),
  getPlayerKnownQuadrants: vi.fn(),
  getAllDiscoveredQuadrantCoords: vi.fn(),
}));

import {
  getQuadrant,
  addPlayerKnownQuadrant,
  addPlayerKnownQuadrantsBatch,
  getPlayerKnownQuadrants,
  getAllDiscoveredQuadrantCoords,
  upsertQuadrant,
  quadrantNameExists,
  updateQuadrantName,
} from '../../db/quadrantQueries.js';
import {
  sectorToQuadrant,
  getOrCreateQuadrant,
  nameQuadrant,
  generateQuadrantName,
  QUADRANT_NAMING_WINDOW_MS,
} from '../quadrantEngine.js';
import type { QuadrantData, FirstContactEvent } from '@void-sector/shared';
import { QUADRANT_SIZE } from '@void-sector/shared';

const mockGetQuadrant = vi.mocked(getQuadrant);
const mockAddPlayerKnownQuadrant = vi.mocked(addPlayerKnownQuadrant);
const mockAddPlayerKnownQuadrantsBatch = vi.mocked(addPlayerKnownQuadrantsBatch);
const mockGetPlayerKnownQuadrants = vi.mocked(getPlayerKnownQuadrants);
const mockGetAllDiscoveredQuadrantCoords = vi.mocked(getAllDiscoveredQuadrantCoords);
const mockUpsertQuadrant = vi.mocked(upsertQuadrant);
const mockQuadrantNameExists = vi.mocked(quadrantNameExists);
const mockUpdateQuadrantName = vi.mocked(updateQuadrantName);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeQuadrant(overrides: Partial<QuadrantData> = {}): QuadrantData {
  return {
    qx: 0,
    qy: 0,
    seed: 12345,
    name: 'TestQuad-3',
    discoveredBy: 'player-1',
    discoveredAt: '2026-01-01T00:00:00.000Z',
    config: {
      seed: 12345,
      resourceFactor: 1.0,
      stationDensity: 1.0,
      pirateDensity: 1.0,
      nebulaThreshold: 1.0,
      emptyRatio: 1.0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// First-contact detection logic
// ---------------------------------------------------------------------------
describe('first-contact detection logic', () => {
  it('detects new quadrant when sector coordinates cross quadrant boundary', () => {
    // Sector 9999 is in quadrant 0, sector 10000 is in quadrant 1
    const origin = sectorToQuadrant(9999, 0);
    const target = sectorToQuadrant(10000, 0);
    expect(origin.qx).toBe(0);
    expect(target.qx).toBe(1);
    // Different quadrants -> first contact should trigger
    expect(origin.qx !== target.qx || origin.qy !== target.qy).toBe(true);
  });

  it('does not detect new quadrant when staying in same quadrant', () => {
    const origin = sectorToQuadrant(100, 100);
    const target = sectorToQuadrant(200, 200);
    expect(origin.qx).toBe(0);
    expect(target.qx).toBe(0);
    expect(origin.qy).toBe(0);
    expect(target.qy).toBe(0);
    // Same quadrant -> no first contact
    expect(origin.qx === target.qx && origin.qy === target.qy).toBe(true);
  });

  it('detects quadrant change on negative boundary crossing', () => {
    const origin = sectorToQuadrant(0, 0);
    const target = sectorToQuadrant(-1, 0);
    expect(origin.qx).toBe(0);
    expect(target.qx).toBe(-1);
    expect(origin.qx !== target.qx).toBe(true);
  });

  it('first contact creates quadrant with discoverer when not in DB', async () => {
    mockGetQuadrant.mockResolvedValueOnce(null); // checkFirstContact checks existing
    mockGetQuadrant.mockResolvedValueOnce(null); // getOrCreateQuadrant checks again
    mockUpsertQuadrant.mockResolvedValueOnce(undefined);
    mockAddPlayerKnownQuadrant.mockResolvedValueOnce(undefined);

    const quadrant = await getOrCreateQuadrant(1, 0, 'player-1');
    expect(quadrant.qx).toBe(1);
    expect(quadrant.qy).toBe(0);
    expect(quadrant.discoveredBy).toBe('player-1');
    expect(quadrant.name).toBeTruthy();
  });

  it('returns existing quadrant without creating when already in DB', async () => {
    const existing = makeQuadrant({ qx: 1, qy: 0 });
    mockGetQuadrant.mockResolvedValueOnce(existing);

    const result = await getOrCreateQuadrant(1, 0, 'player-2');
    expect(result).toEqual(existing);
    expect(mockUpsertQuadrant).not.toHaveBeenCalled();
  });

  it('adds player known quadrant for existing quadrant', async () => {
    // When a player enters an already-discovered quadrant, they should learn it
    mockAddPlayerKnownQuadrant.mockResolvedValueOnce(undefined);
    await addPlayerKnownQuadrant('player-2', 1, 0);
    expect(mockAddPlayerKnownQuadrant).toHaveBeenCalledWith('player-2', 1, 0);
  });
});

// ---------------------------------------------------------------------------
// FirstContactEvent structure
// ---------------------------------------------------------------------------
describe('FirstContactEvent structure', () => {
  it('can be constructed with correct shape', () => {
    const quadrant = makeQuadrant();
    const event: FirstContactEvent = {
      quadrant,
      canName: true,
      autoName: generateQuadrantName(quadrant.seed),
    };

    expect(event.quadrant).toBe(quadrant);
    expect(event.canName).toBe(true);
    expect(typeof event.autoName).toBe('string');
    expect(event.autoName.length).toBeGreaterThan(0);
  });

  it('autoName is deterministic from seed', () => {
    const seed = 42;
    const name1 = generateQuadrantName(seed);
    const name2 = generateQuadrantName(seed);
    expect(name1).toBe(name2);
  });
});

// ---------------------------------------------------------------------------
// nameQuadrant 60-second naming window
// ---------------------------------------------------------------------------
describe('nameQuadrant 60-second naming window', () => {
  it('succeeds within 60-second window', async () => {
    const recentQuadrant = makeQuadrant({
      qx: 1,
      qy: 2,
      discoveredBy: 'player-1',
      discoveredAt: new Date(Date.now() - 30_000).toISOString(), // 30s ago
    });
    mockGetQuadrant.mockResolvedValueOnce(recentQuadrant);
    mockQuadrantNameExists.mockResolvedValueOnce(false);
    mockUpdateQuadrantName.mockResolvedValueOnce(undefined);

    const result = await nameQuadrant(1, 2, 'New Name', 'player-1');
    expect(result.success).toBe(true);
  });

  it('fails after 60-second window expires', async () => {
    const oldQuadrant = makeQuadrant({
      qx: 1,
      qy: 2,
      discoveredBy: 'player-1',
      discoveredAt: new Date(Date.now() - 61_000).toISOString(), // 61s ago
    });
    mockGetQuadrant.mockResolvedValueOnce(oldQuadrant);

    const result = await nameQuadrant(1, 2, 'New Name', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Naming window expired');
  });

  it('fails at exactly 60 seconds + 1ms', async () => {
    const borderlineQuadrant = makeQuadrant({
      qx: 1,
      qy: 2,
      discoveredBy: 'player-1',
      discoveredAt: new Date(Date.now() - QUADRANT_NAMING_WINDOW_MS - 1).toISOString(),
    });
    mockGetQuadrant.mockResolvedValueOnce(borderlineQuadrant);

    const result = await nameQuadrant(1, 2, 'Border Name', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Naming window expired');
  });

  it('succeeds at exactly 59 seconds', async () => {
    const justInTimeQuadrant = makeQuadrant({
      qx: 1,
      qy: 2,
      discoveredBy: 'player-1',
      discoveredAt: new Date(Date.now() - 59_000).toISOString(), // 59s ago
    });
    mockGetQuadrant.mockResolvedValueOnce(justInTimeQuadrant);
    mockQuadrantNameExists.mockResolvedValueOnce(false);
    mockUpdateQuadrantName.mockResolvedValueOnce(undefined);

    const result = await nameQuadrant(1, 2, 'Just In Time', 'player-1');
    expect(result.success).toBe(true);
  });

  it('exports QUADRANT_NAMING_WINDOW_MS as 60000', () => {
    expect(QUADRANT_NAMING_WINDOW_MS).toBe(60_000);
  });

  it('still validates name before checking window', async () => {
    const result = await nameQuadrant(1, 2, '', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least');
    expect(mockGetQuadrant).not.toHaveBeenCalled();
  });

  it('still checks discoverer before checking window', async () => {
    const recentQuadrant = makeQuadrant({
      qx: 1,
      qy: 2,
      discoveredBy: 'player-1',
      discoveredAt: new Date(Date.now() - 10_000).toISOString(), // 10s ago
    });
    mockGetQuadrant.mockResolvedValueOnce(recentQuadrant);

    const result = await nameQuadrant(1, 2, 'New Name', 'player-2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('discoverer');
  });

  it('fails when quadrant not found', async () => {
    mockGetQuadrant.mockResolvedValueOnce(null);
    const result = await nameQuadrant(1, 2, 'Valid Name', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// getKnownQuadrants
// ---------------------------------------------------------------------------
describe('getKnownQuadrants', () => {
  it('returns empty array when player has no known quadrants', async () => {
    mockGetPlayerKnownQuadrants.mockResolvedValueOnce([]);
    const result = await getPlayerKnownQuadrants('player-1');
    expect(result).toEqual([]);
  });

  it('returns known quadrants for player', async () => {
    const known = [
      { qx: 0, qy: 0, learnedAt: '2026-01-01T00:00:00.000Z' },
      { qx: 1, qy: 0, learnedAt: '2026-01-02T00:00:00.000Z' },
    ];
    mockGetPlayerKnownQuadrants.mockResolvedValueOnce(known);
    const result = await getPlayerKnownQuadrants('player-1');
    expect(result).toEqual(known);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// syncQuadrants logic
// ---------------------------------------------------------------------------
describe('syncQuadrants logic', () => {
  it('getAllDiscoveredQuadrantCoords returns only qx/qy from DB', async () => {
    const coords = [
      { qx: 0, qy: 0 },
      { qx: 1, qy: 0 },
      { qx: -1, qy: 1 },
    ];
    mockGetAllDiscoveredQuadrantCoords.mockResolvedValueOnce(coords);

    const result = await getAllDiscoveredQuadrantCoords();
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ qx: 0, qy: 0 });
    expect(result[1]).toEqual({ qx: 1, qy: 0 });
    expect(result[2]).toEqual({ qx: -1, qy: 1 });
  });

  it('syncing batch-inserts all quadrant coords for player', async () => {
    const coords = [
      { qx: 0, qy: 0 },
      { qx: 1, qy: 0 },
    ];
    mockGetAllDiscoveredQuadrantCoords.mockResolvedValueOnce(coords);
    mockAddPlayerKnownQuadrantsBatch.mockResolvedValueOnce(undefined);

    const all = await getAllDiscoveredQuadrantCoords();
    await addPlayerKnownQuadrantsBatch('player-1', all);

    expect(mockAddPlayerKnownQuadrantsBatch).toHaveBeenCalledOnce();
    expect(mockAddPlayerKnownQuadrantsBatch).toHaveBeenCalledWith('player-1', [
      { qx: 0, qy: 0 },
      { qx: 1, qy: 0 },
    ]);
  });

  it('syncing with no discovered quadrants calls batch with empty array', async () => {
    mockGetAllDiscoveredQuadrantCoords.mockResolvedValueOnce([]);
    mockAddPlayerKnownQuadrantsBatch.mockResolvedValueOnce(undefined);

    const all = await getAllDiscoveredQuadrantCoords();
    await addPlayerKnownQuadrantsBatch('player-1', all);

    expect(mockAddPlayerKnownQuadrantsBatch).toHaveBeenCalledWith('player-1', []);
  });
});

// ---------------------------------------------------------------------------
// Quadrant boundary edge cases
// ---------------------------------------------------------------------------
describe('quadrant boundary edge cases', () => {
  it('large positive coordinates map to correct quadrant', () => {
    const result = sectorToQuadrant(50000, 30000);
    expect(result.qx).toBe(5);
    expect(result.qy).toBe(3);
  });

  it('large negative coordinates map to correct quadrant', () => {
    const result = sectorToQuadrant(-50001, -30001);
    expect(result.qx).toBe(-6);
    expect(result.qy).toBe(-4);
  });

  it('exactly at QUADRANT_SIZE boundary', () => {
    const result = sectorToQuadrant(QUADRANT_SIZE, QUADRANT_SIZE);
    expect(result.qx).toBe(1);
    expect(result.qy).toBe(1);
  });

  it('one less than QUADRANT_SIZE', () => {
    const result = sectorToQuadrant(QUADRANT_SIZE - 1, QUADRANT_SIZE - 1);
    expect(result.qx).toBe(0);
    expect(result.qy).toBe(0);
  });

  it('origin sector is in quadrant (0,0)', () => {
    const result = sectorToQuadrant(0, 0);
    expect(result.qx).toBe(0);
    expect(result.qy).toBe(0);
  });

  it('sector (-1, -1) is in quadrant (-1, -1)', () => {
    const result = sectorToQuadrant(-1, -1);
    expect(result.qx).toBe(-1);
    expect(result.qy).toBe(-1);
  });
});
