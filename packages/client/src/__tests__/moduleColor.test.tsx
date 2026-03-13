import { describe, it, expect } from 'vitest';
import { getModuleSourceColor } from '../components/moduleUtils.js';

describe('module source color', () => {
  it('standard = green', () => expect(getModuleSourceColor('standard')).toBe('#4a9'));
  it('found = amber', () => expect(getModuleSourceColor('found')).toBe('#b8860b'));
  it('researched = blue', () => expect(getModuleSourceColor('researched')).toBe('#4499cc'));
  it('undefined = green (default)', () => expect(getModuleSourceColor(undefined)).toBe('#4a9'));
});
