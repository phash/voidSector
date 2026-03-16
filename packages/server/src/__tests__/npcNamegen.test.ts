import { describe, it, expect } from 'vitest';
import { generateNpcName } from '../engine/npcNamegen.js';

describe('generateNpcName', () => {
  it('generates trader names with Händler prefix', () => {
    const name = generateNpcName('trader', 12345);
    expect(name).toMatch(/^Händler /);
    expect(name.length).toBeGreaterThan(8);
  });

  it('generates military names with Patrouille prefix', () => {
    const name = generateNpcName('military', 67890);
    expect(name).toMatch(/^Patrouille /);
  });

  it('generates outlaw names with Outlaw prefix', () => {
    const name = generateNpcName('outlaw', 11111);
    expect(name).toMatch(/^Outlaw /);
  });

  it('is deterministic for same seed', () => {
    expect(generateNpcName('trader', 999)).toBe(generateNpcName('trader', 999));
  });

  it('differs for different seeds', () => {
    expect(generateNpcName('trader', 1)).not.toBe(generateNpcName('trader', 2));
  });
});
