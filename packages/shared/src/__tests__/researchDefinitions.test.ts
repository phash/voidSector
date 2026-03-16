import { describe, it, expect } from 'vitest';
import { RESEARCH_DEFINITIONS } from '../researchDefinitions.js';

describe('RESEARCH_DEFINITIONS', () => {
  it('has 52 nodes', () => { expect(RESEARCH_DEFINITIONS).toHaveLength(52); });
  it('all have wissenCost 10', () => {
    for (const r of RESEARCH_DEFINITIONS) expect(r.wissenCost).toBe(10);
  });
  it('all have prerequisiteModuleId', () => {
    for (const r of RESEARCH_DEFINITIONS) expect(r.prerequisiteModuleId).toBeTruthy();
  });
  it('covers all expected branches', () => {
    const branches = new Set(RESEARCH_DEFINITIONS.map(r => r.branch));
    expect(branches.size).toBeGreaterThanOrEqual(13);
  });
});
