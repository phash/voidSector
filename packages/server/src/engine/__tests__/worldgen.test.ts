import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords, isInNebulaZone } from '../worldgen.js';
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
});
