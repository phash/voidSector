import { describe, it, expect } from 'vitest';
import { generateSector, anomalyChanceForEnvironment } from '../worldgen.js';
import { EMPTY_ANOMALY_CHANCE, NEBULA_ANOMALY_CHANCE } from '@void-sector/shared';

describe('anomalyChanceForEnvironment', () => {
  it('returns the empty-space rate (0.01%) for empty', () => {
    expect(anomalyChanceForEnvironment('empty')).toBe(0.0001);
    expect(EMPTY_ANOMALY_CHANCE).toBe(0.0001);
  });
  it('returns the nebula rate (10%) for nebula', () => {
    expect(anomalyChanceForEnvironment('nebula')).toBe(0.1);
    expect(NEBULA_ANOMALY_CHANCE).toBe(0.1);
  });
  it('returns 0 for black holes', () => {
    expect(anomalyChanceForEnvironment('black_hole')).toBe(0);
  });
});

describe('anomaly distribution over generated sectors', () => {
  it('makes ~10% of nebula sectors anomalies and keeps empty-space anomalies very rare', () => {
    let nebula = 0;
    let nebulaAnomaly = 0;
    let empty = 0;
    let emptyAnomaly = 0;
    // 400x400 region far from origin (~160k sectors, ~8k nebula).
    for (let x = 1000; x < 1400; x++) {
      for (let y = 1000; y < 1400; y++) {
        const s = generateSector(x, y, null);
        const isAnomaly = s.contents.includes('anomaly');
        if (s.environment === 'nebula') {
          nebula++;
          if (isAnomaly) nebulaAnomaly++;
        } else if (s.environment === 'empty') {
          empty++;
          if (isAnomaly) emptyAnomaly++;
        }
      }
    }
    expect(nebula).toBeGreaterThan(2000); // enough samples to be meaningful
    const nebulaFraction = nebulaAnomaly / nebula;
    expect(nebulaFraction).toBeGreaterThanOrEqual(0.08);
    expect(nebulaFraction).toBeLessThanOrEqual(0.12);
    // Empty-space anomalies are ~0.01% — assert they are at least an order of
    // magnitude rarer than 0.1% (statistical exactness of 0.0001 is covered by
    // the deterministic helper test above, not flaky sampling).
    const emptyFraction = emptyAnomaly / empty;
    expect(emptyFraction).toBeLessThan(0.001);
  });

  it('nebula+anomaly sectors keep environment=nebula (Nebel UND Anomalie)', () => {
    let checked = 0;
    for (let x = 1000; x < 1600 && checked < 1; x++) {
      for (let y = 1000; y < 1600; y++) {
        const s = generateSector(x, y, null);
        if (s.environment === 'nebula' && s.contents.includes('anomaly')) {
          expect(s.type).toBe('anomaly'); // legacy type prioritises anomaly
          expect(s.environment).toBe('nebula'); // but it is still a nebula
          checked++;
          break;
        }
      }
    }
    expect(checked).toBe(1);
  });
});
