import { describe, it, expect } from 'vitest';
import { compileProgram, AUTOMATION_PROGRAM_LIMITS } from '../index.js';

describe('automation public API (via package index)', () => {
  it('compileProgram and limits are re-exported from the package root', () => {
    expect(typeof compileProgram).toBe('function');
    expect(AUTOMATION_PROGRAM_LIMITS[3]).toBe(50);
  });
});
