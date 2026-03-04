import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords, isInNebulaZone, isInBlackHoleCluster } from '../worldgen.js';
import { WORLD_SEED, SECTOR_TYPES, RESOURCE_TYPES } from '@void-sector/shared';

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
    // All sector types should appear in a large sample
    for (const type of SECTOR_TYPES) {
      expect(counts[type] ?? 0).toBeGreaterThan(0);
    }
    // empty should be the most common type (weight 0.55)
    const emptyCount = counts['empty'] ?? 0;
    for (const type of SECTOR_TYPES) {
      if (type !== 'empty') {
        expect(emptyCount).toBeGreaterThan(counts[type] ?? 0);
      }
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
    // Fine-grained scan across all quadrants — step=5 ensures min-radius-15 zones are hit
    let found = false;
    outer: for (let x = -1500; x <= 1500; x += 5) {
      for (let y = -1500; y <= 1500; y += 5) {
        if (x * x + y * y < 200 * 200) continue; // skip safe origin area
        if (isInNebulaZone(x, y)) { found = true; break outer; }
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
        expect(['empty', 'nebula', 'asteroid_field', 'station', 'anomaly', 'pirate']).toContain(sector.type);
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

  it('nebula sectors can contain station content', () => {
    // Scan nebula zones for sectors with station content
    let found = false;
    // Use a very wide scan of nebula zone coordinates
    for (let x = -1500; x <= 1500 && !found; x += 3) {
      for (let y = -1500; y <= 1500 && !found; y += 3) {
        const s = generateSector(x, y, null);
        if (s.environment === 'nebula' && s.contents.includes('station')) {
          expect(s.type).toBe('station');
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('nebula sectors can contain asteroid_field content', () => {
    let found = false;
    for (let x = -1500; x <= 1500 && !found; x += 3) {
      for (let y = -1500; y <= 1500 && !found; y += 3) {
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
      expect((again !== null)).toBe(cluster);
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
