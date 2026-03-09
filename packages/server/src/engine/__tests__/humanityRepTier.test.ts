import { describe, it, expect } from 'vitest';
import { getRepTier, getChanceModifier } from '../humanityRepTier.js';

describe('getRepTier', () => {
  it('returns FEINDSELIG below -200', () => expect(getRepTier(-201)).toBe('FEINDSELIG'));
  it('returns NEUTRAL at -200', () => expect(getRepTier(-200)).toBe('NEUTRAL'));
  it('returns NEUTRAL at 0', () => expect(getRepTier(0)).toBe('NEUTRAL'));
  it('returns NEUTRAL at +200', () => expect(getRepTier(200)).toBe('NEUTRAL'));
  it('returns FREUNDLICH above +200', () => expect(getRepTier(201)).toBe('FREUNDLICH'));
});

describe('getChanceModifier', () => {
  it('returns 0.5 for FEINDSELIG', () => expect(getChanceModifier('FEINDSELIG')).toBe(0.5));
  it('returns 1.0 for NEUTRAL', () => expect(getChanceModifier('NEUTRAL')).toBe(1.0));
  it('returns 1.5 for FREUNDLICH', () => expect(getChanceModifier('FREUNDLICH')).toBe(1.5));
});
