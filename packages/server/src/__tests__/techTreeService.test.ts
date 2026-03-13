import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));
vi.mock('../db/techTreeQueries.js', () => ({
  getOrCreateTechTree: vi.fn(),
  saveTechTree: vi.fn(),
  resetTechTree: vi.fn(),
}));
vi.mock('../db/queries.js', () => ({
  deductWissen: vi.fn(),
  getWissen: vi.fn(),
}));

import { getOrCreateTechTree, saveTechTree, resetTechTree } from '../db/techTreeQueries.js';
import { deductWissen, getWissen } from '../db/queries.js';

const mockGetTree = vi.mocked(getOrCreateTechTree);
const mockSaveTree = vi.mocked(saveTechTree);
const mockResetTree = vi.mocked(resetTechTree);
const mockDeductWissen = vi.mocked(deductWissen);
const mockGetWissen = vi.mocked(getWissen);

// Import the validation function we'll test
import { validateResearch } from '../rooms/services/TechTreeService.js';
import { TECH_TREE_NODES } from '@void-sector/shared';

describe('validateResearch', () => {
  it('rejects unknown nodeId', () => {
    const result = validateResearch('nonexistent', {}, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects if parent not researched', () => {
    // kampf.laser requires kampf >= 1
    const result = validateResearch('kampf.laser', {}, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Parent');
  });

  it('rejects if exclusive group blocked', () => {
    // kampf.laser is in group kampf.weapons, kampf.missile is too
    const result = validateResearch('kampf.missile', { kampf: 1, 'kampf.laser': 1 }, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Exclusive');
  });

  it('rejects if max level reached', () => {
    const result = validateResearch('kampf', { kampf: 3 }, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('max level');
  });

  it('accepts valid research (branch level up)', () => {
    const result = validateResearch('kampf', {}, 0);
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(150);
  });

  it('accepts valid module research when parent is at level 1', () => {
    const result = validateResearch('kampf.laser', { kampf: 1 }, 0);
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(280);
  });

  it('applies global cost escalation', () => {
    const result = validateResearch('kampf', {}, 10);
    // 150 * (1 + 10 * 0.05) = 225
    expect(result.cost).toBe(225);
  });
});
