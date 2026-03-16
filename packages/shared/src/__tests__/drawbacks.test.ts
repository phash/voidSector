import { describe, it, expect } from 'vitest';
import { getActiveDrawbacks } from '../shipCalculator.js';

describe('getActiveDrawbacks', () => {
  it('returns empty for standard modules', () => {
    const mods = [{ moduleId: 'puls_laser_mk1', slotIndex: 1, source: 'standard' as const }];
    expect(getActiveDrawbacks(mods)).toHaveLength(0);
  });

  it('returns empty for empty module list', () => {
    expect(getActiveDrawbacks([])).toHaveLength(0);
  });

  it('returns empty for found modules (new system has no drawbacks)', () => {
    const mods = [
      { moduleId: 'rift_drive', slotIndex: 0, source: 'found' as const },
      { moduleId: 'ancient_lance', slotIndex: 1, source: 'found' as const },
    ];
    const effects = getActiveDrawbacks(mods);
    expect(effects).toHaveLength(0);
  });

  it('returns empty for unknown modules', () => {
    const mods = [{ moduleId: 'nonexistent', slotIndex: 0, source: 'found' as const }];
    expect(getActiveDrawbacks(mods)).toHaveLength(0);
  });
});
