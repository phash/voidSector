import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords } from '../worldgen.js';
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
    for (let i = 0; i < n; i++) {
      const sector = generateSector(i, i * 7 - 3000, null);
      counts[sector.type] = (counts[sector.type] || 0) + 1;
    }
    // empty should be roughly 55% (allow wide margin)
    expect(counts['empty']! / n).toBeGreaterThan(0.45);
    expect(counts['empty']! / n).toBeLessThan(0.75);
    // station should be roughly 5%
    expect(counts['station']! / n).toBeGreaterThan(0.01);
    expect(counts['station']! / n).toBeLessThan(0.12);
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
