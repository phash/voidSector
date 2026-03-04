import { describe, it, expect } from 'vitest';
import { legacySectorType, deriveEnvironment, deriveContents } from '../types';

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
  it('returns pirate for pirate_zone + asteroid_field', () => {
    expect(legacySectorType('empty', ['pirate_zone', 'asteroid_field'])).toBe('pirate');
  });
  it('returns pirate for pirate_zone alone', () => {
    expect(legacySectorType('empty', ['pirate_zone'])).toBe('pirate');
  });
  it('returns anomaly for anomaly content', () => {
    expect(legacySectorType('empty', ['anomaly'])).toBe('anomaly');
  });
  it('station takes priority over asteroid_field', () => {
    expect(legacySectorType('empty', ['asteroid_field', 'station'])).toBe('station');
  });
});

describe('deriveEnvironment', () => {
  it('returns nebula for nebula type', () => {
    expect(deriveEnvironment('nebula')).toBe('nebula');
  });
  it('returns empty for all other types', () => {
    expect(deriveEnvironment('empty')).toBe('empty');
    expect(deriveEnvironment('station')).toBe('empty');
    expect(deriveEnvironment('asteroid_field')).toBe('empty');
    expect(deriveEnvironment('pirate')).toBe('empty');
    expect(deriveEnvironment('anomaly')).toBe('empty');
  });
});

describe('deriveContents', () => {
  it('returns empty array for empty/nebula', () => {
    expect(deriveContents('empty')).toEqual([]);
    expect(deriveContents('nebula')).toEqual([]);
  });
  it('returns asteroid_field for asteroid_field', () => {
    expect(deriveContents('asteroid_field')).toEqual(['asteroid_field']);
  });
  it('returns station for station', () => {
    expect(deriveContents('station')).toEqual(['station']);
  });
  it('returns pirate_zone + asteroid_field for pirate', () => {
    expect(deriveContents('pirate')).toEqual(['pirate_zone', 'asteroid_field']);
  });
  it('returns anomaly for anomaly', () => {
    expect(deriveContents('anomaly')).toEqual(['anomaly']);
  });
});
