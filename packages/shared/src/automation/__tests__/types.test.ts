import { describe, it, expect } from 'vitest';
import { SELLABLE_RESOURCES, AUTOMATION_PROGRAM_LIMITS } from '../types.js';

describe('automation types', () => {
  it('exposes the MVP sellable resources', () => {
    expect(SELLABLE_RESOURCES).toEqual(['ore', 'gas', 'crystal']);
  });

  it('defines a program-length limit for every computer level MK.I-V', () => {
    expect(AUTOMATION_PROGRAM_LIMITS).toEqual({ 1: 10, 2: 25, 3: 50, 4: 75, 5: 120 });
  });
});
