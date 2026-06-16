import { describe, it, expect } from 'vitest';
import { getShipComputerLevel } from '../shipCalculator.js';
import type { ShipModule } from '../types.js';

const mod = (moduleId: string, slotIndex = 0): ShipModule => ({ moduleId, slotIndex, source: 'standard' });

describe('getShipComputerLevel', () => {
  it('returns 0 when no computer is installed', () => {
    expect(getShipComputerLevel([mod('ion_drive_mk1'), mod('fusion_cell_mk1', 1)])).toBe(0);
  });

  it('returns the tier of the installed computer', () => {
    expect(getShipComputerLevel([mod('computer_mk3', 9)])).toBe(3);
  });

  it('returns the MAX tier when several computers are present', () => {
    expect(getShipComputerLevel([mod('computer_mk1', 9), mod('computer_mk4', 10)])).toBe(4);
  });
});
