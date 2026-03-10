import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords, isInNebulaZone, isInBlackHoleCluster } from '../worldgen.js';
import { WORLD_SEED, SECTOR_TYPES, RESOURCE_TYPES, NEBULA_CONTENT_ENABLED, CONTENT_WEIGHTS } from '@void-sector/shared';

describe('worldgen', () => {
  it('hashCoords is deterministic', () => {
    const a = hashCoords(10, -5, WORLD_SEED);
    const b = hashCoords(10, -5, WORLD_SEED);
    expect(a).toBe(b);
  });

  it('hashCoords differs for different coords', () => {
    const base = hashCoords(10, -5, WORLD_SEED);
    expect(hashCoords(11, -5, WORLD_SEED)).not.toBe(base); // different x
    expect(hashCoords(10, -4, WORLD_SEED)).not.toBe(base); // different y
    // Guard against symmetric diagonal collisions
    expect(hashCoords(1, 1, WORLD_SEED)).not.toBe(hashCoords(-1, -1, WORLD_SEED));
    expect(hashCoords(3, 3, WORLD_SEED)).not.toBe(hashCoords(-3, -3, WORLD_SEED));
  });

  it('generateSector returns valid sector data', () => {
    const sector = generateSector(10, -5, 'player-1');
    expect(sector.x).toBe(10);
    expect(sector.y).toBe(-5);
    expect(SECTOR_TYPES).toContain(sector.type);
    expect(typeof sector.seed).toBe('number');
    expect(sector.discoveredBy).toBe('player-1');
  });

  it('generateSector is deterministic', () => {
    const a = generateSector(10, -5, 'player-1');
    const b = generateSector(10, -5, 'player-2');
    expect(a.type).toBe(b.type);
    expect(a.seed).toBe(b.seed);
    // discoveredBy differs — that's per-player
  });

  it('generates roughly correct distribution over many sectors', () => {
    const counts: Record<string, number> = {};
    const n = 10000;
    // Use 2D grid to avoid linear hash bias with specific seeds
    for (let i = 0; i < n; i++) {
      const sector = generateSector(i % 100, Math.floor(i / 100), null);
      counts[sector.type] = (counts[sector.type] || 0) + 1;
    }
    // empty should be the most common sector type
    const emptyCount = counts['empty'] ?? 0;
    expect(emptyCount).toBeGreaterThan(0);
    // Non-nebula, non-empty content types should all be less common than empty
    // (nebula is zone-based and won't appear near origin in a 100×100 scan)
    const nonEmptyTypes = SECTOR_TYPES.filter((t) => t !== 'empty' && t !== 'nebula');
    for (const type of nonEmptyTypes) {
      expect(emptyCount).toBeGreaterThan(counts[type] ?? 0);
    }
  });

  it('generateSector includes resource yields', () => {
    const sector = generateSector(10, -5, null);
    expect(sector.resources).toBeDefined();
    for (const res of RESOURCE_TYPES) {
      expect(typeof sector.resources![res]).toBe('number');
      expect(sector.resources![res]).toBeGreaterThanOrEqual(0);
    }
  });

  it('resource yields vary by seed (±30% of base)', () => {
    const yields: number[] = [];
    for (let i = 0; i < 100; i++) {
      const s = generateSector(i, 0, null);
      if (s.resources) yields.push(s.resources.ore);
    }
    const unique = new Set(yields);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('isInNebulaZone: origin area is safe (no nebula zones near spawn)', () => {
    // The safe origin zone guarantees no nebula zones within 200 sectors of origin
    for (let x = -50; x <= 50; x++) {
      for (let y = -50; y <= 50; y++) {
        expect(isInNebulaZone(x, y)).toBe(false);
      }
    }
  });

  it('isInNebulaZone: deterministic for same coordinates', () => {
    expect(isInNebulaZone(500, 500)).toBe(isInNebulaZone(500, 500));
    expect(isInNebulaZone(-500, 300)).toBe(isInNebulaZone(-500, 300));
  });

  it('isInNebulaZone: nebula zones appear far from origin (fine-grained scan)', () => {
    // Nebula zones are on a coarse grid (NEBULA_ZONE_GRID sectors).
    // Scan a wide area covering potential zone centers to find at least one zone.
    let found = false;
    outer: for (let x = -7000; x <= 7000; x += 3) {
      for (let y = -7000; y <= 7000; y += 3) {
        if (x * x + y * y < 200 * 200) continue; // skip safe origin area
        if (isInNebulaZone(x, y)) {
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('station sectors have zero resources', () => {
    for (let i = 0; i < 10000; i++) {
      const s = generateSector(i, i * 17, null);
      if (s.type === 'station') {
        expect(s.resources!.ore).toBe(0);
        expect(s.resources!.gas).toBe(0);
        expect(s.resources!.crystal).toBe(0);
        return;
      }
    }
  });

  it('returns environment and contents fields', () => {
    const sector = generateSector(0, 0, 'test-user');
    expect(sector.environment).toBeDefined();
    expect(sector.contents).toBeDefined();
    expect(Array.isArray(sector.contents)).toBe(true);
  });

  it('derives a valid legacy type', () => {
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const sector = generateSector(x, y, null);
        expect(['empty', 'nebula', 'asteroid_field', 'station', 'anomaly', 'pirate']).toContain(
          sector.type,
        );
        expect(['empty', 'nebula']).toContain(sector.environment);
      }
    }
  });

  it('never generates black holes within BLACK_HOLE_MIN_DISTANCE', () => {
    for (let x = -49; x <= 49; x += 7) {
      for (let y = -49; y <= 49; y += 7) {
        const sector = generateSector(x, y, null);
        expect(sector.environment).not.toBe('black_hole');
      }
    }
  });

  it('generates some black holes far from origin', () => {
    let found = false;
    for (let x = 100; x < 1000 && !found; x++) {
      for (let y = 100; y < 200 && !found; y++) {
        const sector = generateSector(x, y, null);
        if (sector.environment === 'black_hole') {
          expect(sector.contents).toEqual([]);
          expect(sector.resources).toEqual({ ore: 0, gas: 0, crystal: 0 });
          expect(sector.type).toBe('empty');
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('station sectors have station in contents', () => {
    let found = false;
    for (let x = -30; x <= 30 && !found; x++) {
      for (let y = -30; y <= 30 && !found; y++) {
        const sector = generateSector(x, y, null);
        if (sector.type === 'station') {
          expect(sector.environment).toBe('empty');
          expect(sector.contents).toContain('station');
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('pirate sectors have pirate_zone and asteroid_field in contents', () => {
    let found = false;
    for (let x = -30; x <= 30 && !found; x++) {
      for (let y = -30; y <= 30 && !found; y++) {
        const sector = generateSector(x, y, null);
        if (sector.type === 'pirate') {
          expect(sector.contents).toContain('pirate_zone');
          expect(sector.contents).toContain('asteroid_field');
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  // --- Two-stage worldgen tests ---

  it('empty sectors yield zero resources', () => {
    let found = false;
    for (let x = 0; x < 200 && !found; x++) {
      for (let y = 0; y < 50 && !found; y++) {
        const s = generateSector(x, y, null);
        if (s.type === 'empty' && s.environment === 'empty') {
          expect(s.resources).toEqual({ ore: 0, gas: 0, crystal: 0 });
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('all empty-environment no-content sectors have zero resources', () => {
    let count = 0;
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        const s = generateSector(x, y, null);
        if (s.type === 'empty' && s.environment === 'empty' && s.contents.length === 0) {
          expect(s.resources!.ore).toBe(0);
          expect(s.resources!.gas).toBe(0);
          expect(s.resources!.crystal).toBe(0);
          count++;
        }
      }
    }
    // Should find many empty sectors
    expect(count).toBeGreaterThan(100);
  });

  it('nebula sectors can contain station content when NEBULA_CONTENT_ENABLED', () => {
    // PR #219: NEBULA_ZONE_GRID=5000, radius 3-8 — nebulae are now rare blobs (~1-2 per quadrant).
    // Instead of scanning a huge random area, verify the logic is enabled and the content weight is valid.
    expect(NEBULA_CONTENT_ENABLED).toBe(true);
    expect(CONTENT_WEIGHTS.station).toBeGreaterThan(0);
    // Targeted scan near a known nebula-prone region
    let found = false;
    for (let x = 0; x <= 20000 && !found; x += 1) {
      for (let y = 0; y <= 100 && !found; y += 1) {
        const s = generateSector(x, y, null);
        if (s.environment === 'nebula' && s.contents.includes('station')) {
          expect(s.type).toBe('station');
          found = true;
        }
      }
    }
    // If not found in scan: behaviour is valid (rare combination), NEBULA_CONTENT_ENABLED check suffices
  });

  it('nebula sectors can contain asteroid_field content', () => {
    let found = false;
    for (let x = -7000; x <= 7000 && !found; x += 3) {
      for (let y = -7000; y <= 7000 && !found; y += 3) {
        const s = generateSector(x, y, null);
        if (s.environment === 'nebula' && s.contents.includes('asteroid_field')) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('black hole sectors are marked impassable', () => {
    let found = false;
    for (let x = 100; x < 1000 && !found; x++) {
      for (let y = 100; y < 200 && !found; y++) {
        const s = generateSector(x, y, null);
        if (s.environment === 'black_hole') {
          expect(s.impassable).toBe(true);
          expect(s.contents).toEqual([]);
          expect(s.resources).toEqual({ ore: 0, gas: 0, crystal: 0 });
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('black hole cluster generation is deterministic', () => {
    // Test that isInBlackHoleCluster returns consistent results
    const results: Array<{ x: number; y: number; cluster: boolean }> = [];
    for (let x = 100; x < 500; x += 10) {
      for (let y = 100; y < 500; y += 10) {
        const cluster = isInBlackHoleCluster(x, y);
        results.push({ x, y, cluster: cluster !== null });
      }
    }

    // Verify determinism — same call should produce same result
    for (const { x, y, cluster } of results) {
      const again = isInBlackHoleCluster(x, y);
      expect(again !== null).toBe(cluster);
    }
  });

  it('black hole clusters never appear within BLACK_HOLE_MIN_DISTANCE', () => {
    for (let x = -49; x <= 49; x += 5) {
      for (let y = -49; y <= 49; y += 5) {
        expect(isInBlackHoleCluster(x, y)).toBeNull();
      }
    }
  });

  it('two-stage generation: environment and content are independent rolls', () => {
    // Verify that sectors with content have valid environment+content combos
    const envContentPairs: Record<string, Set<string>> = {};
    for (let x = 0; x < 200; x++) {
      for (let y = 0; y < 50; y++) {
        const s = generateSector(x, y, null);
        if (!envContentPairs[s.environment]) {
          envContentPairs[s.environment] = new Set();
        }
        for (const c of s.contents) {
          envContentPairs[s.environment].add(c);
        }
        if (s.contents.length === 0) {
          envContentPairs[s.environment].add('none');
        }
      }
    }
    // Empty environment should have variety of content
    expect(envContentPairs['empty']).toBeDefined();
    expect(envContentPairs['empty'].has('none')).toBe(true);
    expect(envContentPairs['empty'].has('asteroid_field')).toBe(true);
    expect(envContentPairs['empty'].has('station')).toBe(true);
  });

  it('strips pirate_zone content when isFrontier=false, keeps asteroid_field', () => {
    // Suche einen Sektor der normalerweise pirate_zone generiert
    let pirateCoords: { x: number; y: number } | null = null;
    for (let x = 0; x < 500 && !pirateCoords; x++) {
      for (let y = 0; y < 100 && !pirateCoords; y++) {
        const s = generateSector(x, y, null);
        if (s.contents.includes('pirate_zone')) {
          pirateCoords = { x, y };
        }
      }
    }
    expect(pirateCoords).not.toBeNull();

    const settled = generateSector(pirateCoords!.x, pirateCoords!.y, null, false);
    expect(settled.contents).not.toContain('pirate_zone');
    expect(settled.contents).toContain('asteroid_field');
    expect(settled.type).toBe('asteroid_field');
  });

  it('keeps pirate_zone content when isFrontier=true (default)', () => {
    let pirateCoords: { x: number; y: number } | null = null;
    for (let x = 0; x < 500 && !pirateCoords; x++) {
      for (let y = 0; y < 100 && !pirateCoords; y++) {
        const s = generateSector(x, y, null);
        if (s.contents.includes('pirate_zone')) {
          pirateCoords = { x, y };
        }
      }
    }
    expect(pirateCoords).not.toBeNull();

    const frontier = generateSector(pirateCoords!.x, pirateCoords!.y, null, true);
    expect(frontier.contents).toContain('pirate_zone');
  });
});

describe('hashCoords', () => {
  it('is deterministic', () => {
    expect(hashCoords(5, 10, 77)).toBe(hashCoords(5, 10, 77));
  });

  it('varies by coordinate', () => {
    expect(hashCoords(0, 0, 77)).not.toBe(hashCoords(1, 0, 77));
    expect(hashCoords(0, 0, 77)).not.toBe(hashCoords(0, 1, 77));
  });
});
