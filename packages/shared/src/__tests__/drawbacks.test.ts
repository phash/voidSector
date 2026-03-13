import { describe, it, expect } from 'vitest';
import { getActiveDrawbacks } from '../shipCalculator.js';

describe('getActiveDrawbacks', () => {
  it('returns runtime effect IDs for found modules', () => {
    const mods = [{ moduleId: 'pulse_drive', slotIndex: 0, source: 'found' as const }];
    const effects = getActiveDrawbacks(mods);
    expect(effects).toContain('pulse_drive_overheat');
  });

  it('returns empty for standard modules without drawbacks', () => {
    const mods = [{ moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' as const }];
    expect(getActiveDrawbacks(mods)).toHaveLength(0);
  });

  it('returns empty for empty module list', () => {
    expect(getActiveDrawbacks([])).toHaveLength(0);
  });

  it('collects drawbacks from multiple found modules', () => {
    const mods = [
      { moduleId: 'pulse_drive', slotIndex: 0, source: 'found' as const },
      { moduleId: 'ghost_drive', slotIndex: 1, source: 'found' as const },
    ];
    const effects = getActiveDrawbacks(mods);
    expect(effects).toContain('pulse_drive_overheat');
    expect(effects.some((e) => e.includes('ghost_drive'))).toBe(true);
  });
});
