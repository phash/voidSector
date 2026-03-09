import { describe, it, expect } from 'vitest';
import { getHumanityRepTier, getHumanityChanceModifier } from '../humanityRepTier.js';

describe('getHumanityRepTier', () => {
  it('returns FEINDSELIG below -200', () => expect(getHumanityRepTier(-201)).toBe('FEINDSELIG'));
  it('returns NEUTRAL at -200', () => expect(getHumanityRepTier(-200)).toBe('NEUTRAL'));
  it('returns NEUTRAL at 0', () => expect(getHumanityRepTier(0)).toBe('NEUTRAL'));
  it('returns NEUTRAL at +200', () => expect(getHumanityRepTier(200)).toBe('NEUTRAL'));
  it('returns FREUNDLICH above +200', () => expect(getHumanityRepTier(201)).toBe('FREUNDLICH'));
});

describe('getHumanityChanceModifier', () => {
  it('returns 0.5 for FEINDSELIG', () => expect(getHumanityChanceModifier('FEINDSELIG')).toBe(0.5));
  it('returns 1.0 for NEUTRAL', () => expect(getHumanityChanceModifier('NEUTRAL')).toBe(1.0));
  it('returns 1.5 for FREUNDLICH', () => expect(getHumanityChanceModifier('FREUNDLICH')).toBe(1.5));
});
