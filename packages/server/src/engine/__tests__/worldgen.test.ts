import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords, isInNebulaZone, coordsToQuadrant, generateQuadrantConfig, generateQuadrantAutoName, rollEmptyEncounter } from '../worldgen.js';
import { WORLD_SEED, SECTOR_TYPES, RESOURCE_TYPES, QUAD_SECTOR_SIZE, QUAD_AUTONAME_PREFIXES, QUAD_AUTONAME_SUFFIXES } from '@void-sector/shared';

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

describe('quadrant system', () => {
  it('coordsToQuadrant maps sectors to correct quadrant', () => {
    expect(coordsToQuadrant(0, 0)).toEqual({ qx: 0, qy: 0 });
    expect(coordsToQuadrant(QUAD_SECTOR_SIZE - 1, QUAD_SECTOR_SIZE - 1)).toEqual({ qx: 0, qy: 0 });
    expect(coordsToQuadrant(QUAD_SECTOR_SIZE, 0)).toEqual({ qx: 1, qy: 0 });
    expect(coordsToQuadrant(-1, -1)).toEqual({ qx: -1, qy: -1 });
    expect(coordsToQuadrant(10_000_000, 0)).toEqual({ qx: 10_000, qy: 0 });
  });

  it('generateQuadrantConfig is deterministic', () => {
    const a = generateQuadrantConfig(100, 200);
    const b = generateQuadrantConfig(100, 200);
    expect(a.seed).toBe(b.seed);
    expect(a.config.resourceFactor).toBe(b.config.resourceFactor);
    expect(a.config.stationDensity).toBe(b.config.stationDensity);
  });

  it('generateQuadrantConfig factors are within [0.5, 1.5]', () => {
    for (let i = 0; i < 50; i++) {
      const { config } = generateQuadrantConfig(i * 31, i * 17 - 100);
      for (const key of ['resourceFactor', 'stationDensity', 'pirateDensity', 'nebulaThreshold', 'emptyRatio'] as const) {
        expect(config[key]).toBeGreaterThanOrEqual(0.5);
        expect(config[key]).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('generateQuadrantConfig differs for different quadrants', () => {
    const a = generateQuadrantConfig(0, 0);
    const b = generateQuadrantConfig(1, 0);
    const c = generateQuadrantConfig(0, 1);
    expect(a.seed).not.toBe(b.seed);
    expect(a.seed).not.toBe(c.seed);
  });

  it('generateQuadrantAutoName produces valid word pair from lists', () => {
    for (let i = 0; i < 20; i++) {
      const seed = (i * 0x12345678) | 0;
      const name = generateQuadrantAutoName(seed);
      const parts = name.split(' ');
      expect(parts.length).toBe(2);
      expect(QUAD_AUTONAME_PREFIXES).toContain(parts[0] as any);
      expect(QUAD_AUTONAME_SUFFIXES).toContain(parts[1] as any);
    }
  });

  it('generateSector with quadrantConfig applies resource factor', () => {
    const { config } = generateQuadrantConfig(50, 50);
    const configHigh = { ...config, resourceFactor: 1.5 };
    const configLow = { ...config, resourceFactor: 0.5 };
    // Use an asteroid_field sector for non-zero base resources
    let highSector, lowSector;
    for (let i = 0; i < 10000; i++) {
      const s = generateSector(i, i * 13, null);
      if (s.type === 'asteroid_field') {
        highSector = generateSector(i, i * 13, null, configHigh);
        lowSector = generateSector(i, i * 13, null, configLow);
        break;
      }
    }
    if (highSector && lowSector) {
      expect(highSector.resources!.ore).toBeGreaterThan(lowSector.resources!.ore);
    }
  });

  it('rollEmptyEncounter is deterministic for same coords', () => {
    const a = rollEmptyEncounter(500, 300, 1);
    const b = rollEmptyEncounter(500, 300, 1);
    expect(a).toEqual(b);
  });

  it('rollEmptyEncounter returns valid encounter type or null', () => {
    const VALID_TYPES = ['driftingNpc', 'alienSig', 'artifactWreck'];
    let foundEncounter = false;
    for (let i = 0; i < 5000; i++) {
      const r = rollEmptyEncounter(i * 7 + 1000, i * 11 - 500, 1);
      if (r !== null) {
        expect(VALID_TYPES).toContain(r.type);
        expect(typeof r.message).toBe('string');
        foundEncounter = true;
        break;
      }
    }
    expect(foundEncounter).toBe(true);
  });

  it('rollEmptyEncounter scanner bonus increases detection rate', () => {
    let lvl1Hits = 0, lvl3Hits = 0;
    for (let i = 0; i < 10000; i++) {
      if (rollEmptyEncounter(i * 3, i * 7, 1) !== null) lvl1Hits++;
      if (rollEmptyEncounter(i * 3, i * 7, 3) !== null) lvl3Hits++;
    }
    // Level 3 scanner should yield more encounters than level 1
    expect(lvl3Hits).toBeGreaterThan(lvl1Hits);
  });
});
