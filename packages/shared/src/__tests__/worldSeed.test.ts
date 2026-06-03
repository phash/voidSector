import { describe, it, expect } from 'vitest';
import { WORLD_SEED } from '../constants.js';

describe('WORLD_SEED', () => {
  it('is set to the fresh-world value 104729', () => {
    expect(WORLD_SEED).toBe(104729);
  });
});
