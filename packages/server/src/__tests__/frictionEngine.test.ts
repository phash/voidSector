import { describe, it, expect } from 'vitest';
import {
  calculateFriction,
  frictionFromBase,
  pairEnmity,
  repValueToTier,
} from '../engine/frictionEngine.js';

describe('pairEnmity (BB3)', () => {
  it('is symmetric and deterministic', () => {
    expect(pairEnmity('kthari', 'mycelians')).toBe(pairEnmity('mycelians', 'kthari'));
  });
  it('voids are hostile to everyone (high enmity)', () => {
    expect(pairEnmity('voids', 'kthari')).toBe(75);
    expect(pairEnmity('helions', 'voids')).toBe(75);
  });
  it('alien pairs fall in the 10..80 baseline band', () => {
    for (const [a, b] of [['kthari', 'helions'], ['axioms', 'scrappers'], ['archivists', 'consortium']]) {
      const e = pairEnmity(a, b);
      expect(e).toBeGreaterThanOrEqual(10);
      expect(e).toBeLessThanOrEqual(80);
    }
  });
});

describe('frictionFromBase (BB3)', () => {
  it('high base + aggression escalates to total_war', () => {
    expect(frictionFromBase(80, 1.5).state).toBe('total_war'); // 80 + 10 = 90
  });
  it('low base stays peaceful', () => {
    expect(frictionFromBase(10, 1.0).state).toBe('peaceful_halt');
  });
  it('clamps score to [0,100]', () => {
    expect(frictionFromBase(95, 2.0).score).toBe(100);
    expect(frictionFromBase(0, 0.0).score).toBe(0);
  });
});

describe('calculateFriction', () => {
  it('returns score 0 and peaceful_halt for ally rep', () => {
    const result = calculateFriction('ally', 1.0);
    expect(result.score).toBe(0);
    expect(result.state).toBe('peaceful_halt');
  });

  it('returns peaceful_halt for friendly rep with neutral aggression', () => {
    const result = calculateFriction('friendly', 1.0);
    expect(result.score).toBe(10);
    expect(result.state).toBe('peaceful_halt');
  });

  it('returns skirmish for neutral rep with neutral aggression', () => {
    const result = calculateFriction('neutral', 1.0);
    expect(result.score).toBe(35);
    expect(result.state).toBe('skirmish');
  });

  it('returns escalation for hostile rep with neutral aggression', () => {
    const result = calculateFriction('hostile', 1.0);
    expect(result.score).toBe(65);
    expect(result.state).toBe('escalation');
  });

  it('returns total_war for enemy rep with neutral aggression', () => {
    const result = calculateFriction('enemy', 1.0);
    expect(result.score).toBe(90);
    expect(result.state).toBe('total_war');
  });

  it("increases friction for high aggression (K'thari aggression=2.0)", () => {
    const result = calculateFriction('neutral', 2.0);
    // neutral base=35, delta=(2.0-1.0)*20=20 → score=55 → escalation
    expect(result.score).toBe(55);
    expect(result.state).toBe('escalation');
  });

  it('decreases friction for low aggression (Konsortium aggression=0.4)', () => {
    const result = calculateFriction('hostile', 0.4);
    // hostile base=65, delta=(0.4-1.0)*20=-12 → score=53 → escalation but lower
    expect(result.score).toBe(53);
    expect(result.state).toBe('escalation');
  });

  it('clamps score to 0 minimum', () => {
    const result = calculateFriction('ally', 0.1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('clamps score to 100 maximum', () => {
    const result = calculateFriction('enemy', 5.0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('repValueToTier', () => {
  it('maps high positive rep to ally', () => {
    expect(repValueToTier(80)).toBe('ally');
  });

  it('maps moderate positive rep to friendly', () => {
    expect(repValueToTier(50)).toBe('friendly');
  });

  it('maps near-zero rep to neutral', () => {
    expect(repValueToTier(0)).toBe('neutral');
  });

  it('maps moderate negative rep to hostile', () => {
    expect(repValueToTier(-50)).toBe('hostile');
  });

  it('maps very negative rep to enemy', () => {
    expect(repValueToTier(-80)).toBe('enemy');
  });
});
