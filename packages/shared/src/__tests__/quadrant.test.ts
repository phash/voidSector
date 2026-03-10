import { describe, it, expect } from 'vitest';
import { QUADRANT_SIZE, QUADRANT_NAME_MAX_LENGTH, QUADRANT_NAME_MIN_LENGTH } from '../constants';

describe('Quadrant constants', () => {
  it('QUADRANT_SIZE is 500', () => {
    expect(QUADRANT_SIZE).toBe(500);
  });
  it('name length constraints are valid', () => {
    expect(QUADRANT_NAME_MIN_LENGTH).toBeLessThan(QUADRANT_NAME_MAX_LENGTH);
    expect(QUADRANT_NAME_MIN_LENGTH).toBeGreaterThan(0);
  });
});
