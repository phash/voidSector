import { describe, it, expect } from 'vitest';
import { legacySectorType } from '../types';

describe('legacySectorType', () => {
  it('returns empty for empty env with no contents', () => {
    expect(legacySectorType('empty', [])).toBe('empty');
  });
  it('returns nebula for nebula env with no contents', () => {
    expect(legacySectorType('nebula', [])).toBe('nebula');
  });
  it('returns empty for black_hole (no legacy equivalent)', () => {
    expect(legacySectorType('black_hole', [])).toBe('empty');
  });
  it('returns station when contents include station', () => {
    expect(legacySectorType('empty', ['station'])).toBe('station');
  });
  it('returns station even in nebula env', () => {
    expect(legacySectorType('nebula', ['station'])).toBe('station');
  });
  it('returns asteroid_field for asteroid content', () => {
    expect(legacySectorType('empty', ['asteroid_field'])).toBe('asteroid_field');
  });
  it('returns asteroid_field for pirate_zone + asteroid_field (pirate hidden)', () => {
    expect(legacySectorType('empty', ['pirate_zone', 'asteroid_field'])).toBe('asteroid_field');
  });
  it('returns empty for pirate_zone alone (pirate hidden)', () => {
    expect(legacySectorType('empty', ['pirate_zone'])).toBe('empty');
  });
  it('returns anomaly for anomaly content', () => {
    expect(legacySectorType('empty', ['anomaly'])).toBe('anomaly');
  });
  it('station takes priority over asteroid_field', () => {
    expect(legacySectorType('empty', ['asteroid_field', 'station'])).toBe('station');
  });
});

