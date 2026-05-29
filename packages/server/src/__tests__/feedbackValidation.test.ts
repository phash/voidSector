import { describe, it, expect } from 'vitest';
import { validateFeedbackInput } from '../feedbackValidation.js';

describe('validateFeedbackInput', () => {
  it('accepts a valid message + category', () => {
    expect(validateFeedbackInput({ category: 'bug', message: 'kaputt' })).toEqual({
      category: 'bug',
      message: 'kaputt',
    });
  });

  it('trims the message', () => {
    expect(validateFeedbackInput({ category: 'idea', message: '  hallo  ' })).toEqual({
      category: 'idea',
      message: 'hallo',
    });
  });

  it('defaults a missing category to other', () => {
    expect(validateFeedbackInput({ message: 'x' })).toEqual({ category: 'other', message: 'x' });
  });

  it('falls back an unknown category to other', () => {
    expect(validateFeedbackInput({ category: 'nope', message: 'x' })).toEqual({
      category: 'other',
      message: 'x',
    });
  });

  it('rejects an empty/whitespace message', () => {
    expect('error' in validateFeedbackInput({ category: 'bug', message: '   ' })).toBe(true);
    expect('error' in validateFeedbackInput({ category: 'bug' })).toBe(true);
  });

  it('rejects an oversized message (>2000)', () => {
    expect('error' in validateFeedbackInput({ message: 'a'.repeat(2001) })).toBe(true);
  });
});
