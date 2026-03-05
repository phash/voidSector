import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/quadrantQueries.js', () => ({
  getQuadrant: vi.fn(),
  upsertQuadrant: vi.fn(),
  addPlayerKnownQuadrant: vi.fn(),
  quadrantNameExists: vi.fn(),
  updateQuadrantName: vi.fn(),
  getPlayerKnownQuadrants: vi.fn(),
}));

import {
  getQuadrant,
  upsertQuadrant,
  addPlayerKnownQuadrant,
  quadrantNameExists,
  updateQuadrantName,
} from '../../db/quadrantQueries.js';
import {
  sectorToQuadrant,
  generateQuadrantConfig,
  generateQuadrantName,
  validateQuadrantName,
  getOrCreateQuadrant,
  nameQuadrant,
} from '../quadrantEngine.js';
import { applyQuadrantFactors } from '../worldgen.js';
import type { QuadrantData, QuadrantConfig, SectorResources } from '@void-sector/shared';
import { QUADRANT_SIZE } from '@void-sector/shared';

const mockGetQuadrant = vi.mocked(getQuadrant);
const mockUpsertQuadrant = vi.mocked(upsertQuadrant);
const mockAddPlayerKnownQuadrant = vi.mocked(addPlayerKnownQuadrant);
const mockQuadrantNameExists = vi.mocked(quadrantNameExists);
const mockUpdateQuadrantName = vi.mocked(updateQuadrantName);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// sectorToQuadrant
// ---------------------------------------------------------------------------
describe('sectorToQuadrant', () => {
  it('maps positive coordinates correctly', () => {
    expect(sectorToQuadrant(0, 0)).toEqual({ qx: 0, qy: 0 });
    expect(sectorToQuadrant(9999, 9999)).toEqual({ qx: 0, qy: 0 });
    expect(sectorToQuadrant(10000, 10000)).toEqual({ qx: 1, qy: 1 });
    expect(sectorToQuadrant(25000, 15000)).toEqual({ qx: 2, qy: 1 });
  });

  it('maps negative coordinates correctly', () => {
    expect(sectorToQuadrant(-1, -1)).toEqual({ qx: -1, qy: -1 });
    expect(sectorToQuadrant(-10000, -10000)).toEqual({ qx: -1, qy: -1 });
    expect(sectorToQuadrant(-10001, -10001)).toEqual({ qx: -2, qy: -2 });
  });

  it('handles boundary values', () => {
    // Right at the boundary: QUADRANT_SIZE should be in the next quadrant
    expect(sectorToQuadrant(QUADRANT_SIZE, 0)).toEqual({ qx: 1, qy: 0 });
    expect(sectorToQuadrant(0, QUADRANT_SIZE)).toEqual({ qx: 0, qy: 1 });
    // Just below boundary
    expect(sectorToQuadrant(QUADRANT_SIZE - 1, QUADRANT_SIZE - 1)).toEqual({ qx: 0, qy: 0 });
  });

  it('handles mixed positive/negative', () => {
    expect(sectorToQuadrant(15000, -5000)).toEqual({ qx: 1, qy: -1 });
    expect(sectorToQuadrant(-15000, 5000)).toEqual({ qx: -2, qy: 0 });
  });
});

// ---------------------------------------------------------------------------
// generateQuadrantConfig
// ---------------------------------------------------------------------------
describe('generateQuadrantConfig', () => {
  it('is deterministic — same coords always produce same config', () => {
    const a = generateQuadrantConfig(3, 7);
    const b = generateQuadrantConfig(3, 7);
    expect(a).toEqual(b);
  });

  it('produces different configs for different coordinates', () => {
    const a = generateQuadrantConfig(0, 0);
    const b = generateQuadrantConfig(1, 0);
    const c = generateQuadrantConfig(0, 1);
    // At least one factor should differ
    expect(a.seed).not.toBe(b.seed);
    expect(a.seed).not.toBe(c.seed);
  });

  it('all factors are in range [0.5, ~1.5]', () => {
    // Test across many quadrants
    for (let qx = -5; qx <= 5; qx++) {
      for (let qy = -5; qy <= 5; qy++) {
        const config = generateQuadrantConfig(qx, qy);
        const factors = [
          config.resourceFactor,
          config.stationDensity,
          config.pirateDensity,
          config.nebulaThreshold,
          config.emptyRatio,
        ];
        for (const f of factors) {
          expect(f).toBeGreaterThanOrEqual(0.5);
          expect(f).toBeLessThanOrEqual(1.5 + 0.004); // 0.5 + 255/255 = 1.5
        }
      }
    }
  });

  it('has a numeric seed', () => {
    const config = generateQuadrantConfig(0, 0);
    expect(typeof config.seed).toBe('number');
  });

  it('factors vary across quadrants', () => {
    const resourceFactors = new Set<number>();
    for (let qx = 0; qx < 20; qx++) {
      const config = generateQuadrantConfig(qx, 0);
      resourceFactors.add(config.resourceFactor);
    }
    // Should see meaningful variation
    expect(resourceFactors.size).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// generateQuadrantName
// ---------------------------------------------------------------------------
describe('generateQuadrantName', () => {
  it('is deterministic — same seed always produces same name', () => {
    const a = generateQuadrantName(12345);
    const b = generateQuadrantName(12345);
    expect(a).toBe(b);
  });

  it('produces non-empty name', () => {
    const name = generateQuadrantName(42);
    expect(name.length).toBeGreaterThan(0);
  });

  it('capitalizes first letter', () => {
    const name = generateQuadrantName(99);
    expect(name[0]).toBe(name[0].toUpperCase());
  });

  it('includes a numeric suffix', () => {
    const name = generateQuadrantName(12345);
    expect(name).toMatch(/-\d+$/);
  });

  it('produces different names for different seeds', () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i++) {
      names.add(generateQuadrantName(i * 7919)); // use primes for good spread
    }
    // Most should be unique
    expect(names.size).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// validateQuadrantName
// ---------------------------------------------------------------------------
describe('validateQuadrantName', () => {
  it('rejects empty name', () => {
    const result = validateQuadrantName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects name too short', () => {
    const result = validateQuadrantName('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least');
  });

  it('rejects name too long', () => {
    const result = validateQuadrantName('a'.repeat(25));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most');
  });

  it('accepts valid name', () => {
    expect(validateQuadrantName('Alpha-7')).toEqual({ valid: true });
    expect(validateQuadrantName('Nexus Prime')).toEqual({ valid: true });
    expect(validateQuadrantName("Star's Edge")).toEqual({ valid: true });
    expect(validateQuadrantName('Sector 42')).toEqual({ valid: true });
  });

  it('rejects special characters', () => {
    expect(validateQuadrantName('Alpha@7')).toEqual({
      valid: false,
      error: expect.stringContaining('letters, numbers'),
    });
    expect(validateQuadrantName('Test!Zone')).toEqual({
      valid: false,
      error: expect.stringContaining('letters, numbers'),
    });
  });

  it('accepts names at boundary lengths', () => {
    expect(validateQuadrantName('abc')).toEqual({ valid: true }); // min length
    expect(validateQuadrantName('a'.repeat(24))).toEqual({ valid: true }); // max length
  });
});

// ---------------------------------------------------------------------------
// getOrCreateQuadrant
// ---------------------------------------------------------------------------
describe('getOrCreateQuadrant', () => {
  it('returns existing quadrant from DB', async () => {
    const existing: QuadrantData = {
      qx: 1,
      qy: 2,
      seed: 999,
      name: 'TestQuad',
      discoveredBy: 'player-1',
      discoveredAt: '2026-01-01T00:00:00.000Z',
      config: {
        seed: 999,
        resourceFactor: 1.0,
        stationDensity: 1.0,
        pirateDensity: 1.0,
        nebulaThreshold: 1.0,
        emptyRatio: 1.0,
      },
    };
    mockGetQuadrant.mockResolvedValueOnce(existing);

    const result = await getOrCreateQuadrant(1, 2, 'player-2');
    expect(result).toEqual(existing);
    expect(mockUpsertQuadrant).not.toHaveBeenCalled();
  });

  it('creates new quadrant when not in DB', async () => {
    mockGetQuadrant.mockResolvedValueOnce(null);
    mockUpsertQuadrant.mockResolvedValueOnce(undefined);
    mockAddPlayerKnownQuadrant.mockResolvedValueOnce(undefined);

    const result = await getOrCreateQuadrant(3, 4, 'player-1');
    expect(result.qx).toBe(3);
    expect(result.qy).toBe(4);
    expect(result.discoveredBy).toBe('player-1');
    expect(result.name).toBeTruthy();
    expect(result.config).toBeDefined();
    expect(result.config.seed).toBe(result.seed);

    expect(mockUpsertQuadrant).toHaveBeenCalledOnce();
    expect(mockAddPlayerKnownQuadrant).toHaveBeenCalledWith('player-1', 3, 4);
  });

  it('creates quadrant without discoveredBy when no player given', async () => {
    mockGetQuadrant.mockResolvedValueOnce(null);
    mockUpsertQuadrant.mockResolvedValueOnce(undefined);

    const result = await getOrCreateQuadrant(0, 0);
    expect(result.discoveredBy).toBeNull();
    expect(mockAddPlayerKnownQuadrant).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// nameQuadrant
// ---------------------------------------------------------------------------
describe('nameQuadrant', () => {
  function recentQuadrant(overrides: Partial<QuadrantData> = {}): QuadrantData {
    return {
      qx: 1,
      qy: 2,
      seed: 123,
      name: 'AutoName-3',
      discoveredBy: 'player-1',
      discoveredAt: new Date(Date.now() - 10_000).toISOString(), // 10s ago (within window)
      config: {
        seed: 123,
        resourceFactor: 1.0,
        stationDensity: 1.0,
        pirateDensity: 1.0,
        nebulaThreshold: 1.0,
        emptyRatio: 1.0,
      },
      ...overrides,
    };
  }

  it('validates name before checking DB', async () => {
    const result = await nameQuadrant(1, 2, '', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least');
    expect(mockGetQuadrant).not.toHaveBeenCalled();
  });

  it('fails if quadrant not found', async () => {
    mockGetQuadrant.mockResolvedValueOnce(null);
    const result = await nameQuadrant(1, 2, 'NewName', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails if player is not the discoverer', async () => {
    mockGetQuadrant.mockResolvedValueOnce(recentQuadrant());
    const result = await nameQuadrant(1, 2, 'NewName', 'player-2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('discoverer');
  });

  it('fails if naming window expired (60s)', async () => {
    mockGetQuadrant.mockResolvedValueOnce(
      recentQuadrant({
        discoveredAt: new Date(Date.now() - 61_000).toISOString(),
      }),
    );
    const result = await nameQuadrant(1, 2, 'TooLate', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Naming window expired');
  });

  it('fails if name already taken', async () => {
    mockGetQuadrant.mockResolvedValueOnce(recentQuadrant());
    mockQuadrantNameExists.mockResolvedValueOnce(true);
    const result = await nameQuadrant(1, 2, 'TakenName', 'player-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('taken');
  });

  it('succeeds with valid name from discoverer within window', async () => {
    mockGetQuadrant.mockResolvedValueOnce(recentQuadrant());
    mockQuadrantNameExists.mockResolvedValueOnce(false);
    mockUpdateQuadrantName.mockResolvedValueOnce(undefined);

    const result = await nameQuadrant(1, 2, 'Nebula Prime', 'player-1');
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockUpdateQuadrantName).toHaveBeenCalledWith(1, 2, 'Nebula Prime');
  });
});

// ---------------------------------------------------------------------------
// applyQuadrantFactors (in worldgen.ts)
// ---------------------------------------------------------------------------
describe('applyQuadrantFactors', () => {
  it('scales resources by the config resourceFactor', () => {
    const resources: SectorResources = { ore: 10, gas: 20, crystal: 5 };
    const config: QuadrantConfig = {
      seed: 0,
      resourceFactor: 1.5,
      stationDensity: 1.0,
      pirateDensity: 1.0,
      nebulaThreshold: 1.0,
      emptyRatio: 1.0,
    };
    const result = applyQuadrantFactors(resources, config);
    expect(result.ore).toBe(15);
    expect(result.gas).toBe(30);
    expect(result.crystal).toBe(8); // Math.round(5 * 1.5) = 8
  });

  it('does not modify the original resources object', () => {
    const resources: SectorResources = { ore: 10, gas: 20, crystal: 5 };
    const config: QuadrantConfig = {
      seed: 0,
      resourceFactor: 2.0,
      stationDensity: 1.0,
      pirateDensity: 1.0,
      nebulaThreshold: 1.0,
      emptyRatio: 1.0,
    };
    applyQuadrantFactors(resources, config);
    expect(resources.ore).toBe(10);
    expect(resources.gas).toBe(20);
    expect(resources.crystal).toBe(5);
  });

  it('handles factor less than 1 (reduction)', () => {
    const resources: SectorResources = { ore: 20, gas: 10, crystal: 6 };
    const config: QuadrantConfig = {
      seed: 0,
      resourceFactor: 0.5,
      stationDensity: 1.0,
      pirateDensity: 1.0,
      nebulaThreshold: 1.0,
      emptyRatio: 1.0,
    };
    const result = applyQuadrantFactors(resources, config);
    expect(result.ore).toBe(10);
    expect(result.gas).toBe(5);
    expect(result.crystal).toBe(3);
  });

  it('handles zero resources', () => {
    const resources: SectorResources = { ore: 0, gas: 0, crystal: 0 };
    const config: QuadrantConfig = {
      seed: 0,
      resourceFactor: 1.5,
      stationDensity: 1.0,
      pirateDensity: 1.0,
      nebulaThreshold: 1.0,
      emptyRatio: 1.0,
    };
    const result = applyQuadrantFactors(resources, config);
    expect(result.ore).toBe(0);
    expect(result.gas).toBe(0);
    expect(result.crystal).toBe(0);
  });

  it('rounds results to integers', () => {
    const resources: SectorResources = { ore: 7, gas: 3, crystal: 1 };
    const config: QuadrantConfig = {
      seed: 0,
      resourceFactor: 0.7,
      stationDensity: 1.0,
      pirateDensity: 1.0,
      nebulaThreshold: 1.0,
      emptyRatio: 1.0,
    };
    const result = applyQuadrantFactors(resources, config);
    expect(Number.isInteger(result.ore)).toBe(true);
    expect(Number.isInteger(result.gas)).toBe(true);
    expect(Number.isInteger(result.crystal)).toBe(true);
  });
});
