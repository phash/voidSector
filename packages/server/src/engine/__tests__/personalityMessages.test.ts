import { describe, it, expect } from 'vitest';
import { getPersonalityComment, PERSONALITY_COMMENT_CHANCE } from '../personalityMessages.js';
import type { AcepTrait } from '../traitCalculator.js';

describe('getPersonalityComment', () => {
  it('returns null when roll >= PERSONALITY_COMMENT_CHANCE', () => {
    const result = getPersonalityComment(['veteran'], 'scan', PERSONALITY_COMMENT_CHANCE);
    expect(result).toBeNull();
  });

  it('returns null for no traits', () => {
    const result = getPersonalityComment([], 'scan', 0);
    expect(result).toBeNull();
  });

  it('returns a string for veteran + scan with roll = 0', () => {
    const result = getPersonalityComment(['veteran'], 'scan', 0);
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('returns a string for curious + scan_ruin with roll = 0', () => {
    const result = getPersonalityComment(['curious'], 'scan_ruin', 0);
    expect(typeof result).toBe('string');
  });

  it('returns null when no messages defined for context', () => {
    // cautious has no scan_ruin messages
    const result = getPersonalityComment(['cautious'], 'scan_ruin', 0);
    expect(result).toBeNull();
  });

  it('returns null for unknown trait × context combo', () => {
    // If we had a trait with no lines for a context, returns null
    const result = getPersonalityComment(['veteran'], 'build', 0);
    expect(result).toBeNull();
  });

  it('PERSONALITY_COMMENT_CHANCE is 0.25', () => {
    expect(PERSONALITY_COMMENT_CHANCE).toBe(0.25);
  });

  it('each defined trait has at least one message for at least one context', () => {
    const traits: AcepTrait[] = [
      'veteran',
      'curious',
      'ancient-touched',
      'reckless',
      'cautious',
      'scarred',
    ];
    for (const trait of traits) {
      // Try all contexts, at least one should return a message
      const contexts = [
        'scan',
        'scan_ruin',
        'combat_victory',
        'combat_defeat',
        'mine',
        'build',
      ] as const;
      const hasAnyMessage = contexts.some((ctx) => getPersonalityComment([trait], ctx, 0) !== null);
      expect(hasAnyMessage, `trait ${trait} has no messages at all`).toBe(true);
    }
  });
});
