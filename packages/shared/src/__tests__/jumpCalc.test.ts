import { describe, it, expect } from 'vitest';
import { calcHyperjumpAP, calcHyperjumpFuel, getEngineSpeed } from '../jumpCalc.js';
import { calculateShipStats } from '../shipCalculator.js';
import { ENGINE_SPEED, HULLS } from '../constants.js';

describe('calcHyperjumpAP', () => {
  it('returns 5 AP at engine speed 1', () => {
    expect(calcHyperjumpAP(1)).toBe(5);
  });

  it('returns 4 AP at engine speed 2', () => {
    expect(calcHyperjumpAP(2)).toBe(4);
  });

  it('returns 3 AP at engine speed 3', () => {
    expect(calcHyperjumpAP(3)).toBe(3);
  });

  it('returns 2 AP at engine speed 4', () => {
    expect(calcHyperjumpAP(4)).toBe(2);
  });

  it('returns 1 AP at engine speed 5', () => {
    expect(calcHyperjumpAP(5)).toBe(1);
  });

  it('clamps to minimum 1 AP for speed > 5', () => {
    expect(calcHyperjumpAP(10)).toBe(1);
  });
});

describe('calcHyperjumpFuel', () => {
  it('returns base fuel at distance 1 (factor 1.0)', () => {
    expect(calcHyperjumpFuel(5, 1)).toBe(5);
  });

  it('scales fuel with distance', () => {
    // distance 5: factor = 1.0 + (5-1)*0.1 = 1.4 → ceil(5*1.4) = 7
    expect(calcHyperjumpFuel(5, 5)).toBe(7);
  });

  it('caps fuel factor at 2.0', () => {
    // distance 11: factor = 1.0 + (11-1)*0.1 = 2.0 → ceil(5*2.0) = 10
    expect(calcHyperjumpFuel(5, 11)).toBe(10);
  });

  it('caps fuel factor for very large distances', () => {
    // distance 100: factor capped at 2.0 → ceil(5*2.0) = 10
    expect(calcHyperjumpFuel(5, 100)).toBe(10);
  });

  it('rounds up fractional fuel', () => {
    // distance 2: factor = 1.0 + 0.1 = 1.1 → ceil(3*1.1) = ceil(3.3) = 4
    expect(calcHyperjumpFuel(3, 2)).toBe(4);
  });
});

describe('getEngineSpeed', () => {
  it('returns 1 for null (no module)', () => {
    expect(getEngineSpeed(null)).toBe(1);
  });

  it('returns correct speed for drive_mk1', () => {
    expect(getEngineSpeed('drive_mk1')).toBe(2);
  });

  it('returns correct speed for drive_mk2', () => {
    expect(getEngineSpeed('drive_mk2')).toBe(3);
  });

  it('returns correct speed for drive_mk3', () => {
    expect(getEngineSpeed('drive_mk3')).toBe(4);
  });

  it('returns correct speed for void_drive', () => {
    expect(getEngineSpeed('void_drive')).toBe(5);
  });

  it('returns 1 for unknown module', () => {
    expect(getEngineSpeed('unknown_module')).toBe(1);
  });
});

describe('ENGINE_SPEED mapping', () => {
  it('has all expected entries', () => {
    expect(ENGINE_SPEED.none).toBe(1);
    expect(ENGINE_SPEED.drive_mk1).toBe(2);
    expect(ENGINE_SPEED.drive_mk2).toBe(3);
    expect(ENGINE_SPEED.drive_mk3).toBe(4);
    expect(ENGINE_SPEED.void_drive).toBe(5);
  });
});

describe('hull baseEngineSpeed values', () => {
  it('scout has baseEngineSpeed 2', () => {
    expect(HULLS.scout.baseEngineSpeed).toBe(2);
  });

  it('freighter has baseEngineSpeed 1', () => {
    expect(HULLS.freighter.baseEngineSpeed).toBe(1);
  });

  it('cruiser has baseEngineSpeed 2', () => {
    expect(HULLS.cruiser.baseEngineSpeed).toBe(2);
  });

  it('explorer has baseEngineSpeed 2', () => {
    expect(HULLS.explorer.baseEngineSpeed).toBe(2);
  });

  it('battleship has baseEngineSpeed 1', () => {
    expect(HULLS.battleship.baseEngineSpeed).toBe(1);
  });
});

describe('calculateShipStats with engineSpeed', () => {
  it('includes base engineSpeed for scout', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.engineSpeed).toBe(2);
  });

  it('adds module engineSpeed bonus', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk2', slotIndex: 0 }]);
    // scout base 2 + drive_mk2 engineSpeed 2 = 4
    expect(stats.engineSpeed).toBe(4);
  });

  it('clamps engineSpeed to max 5', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'drive_mk3', slotIndex: 0 },
      { moduleId: 'drive_mk3', slotIndex: 1 },
    ]);
    // scout base 2 + 3 + 3 = 8, clamped to 5
    expect(stats.engineSpeed).toBe(5);
  });

  it('freighter with no modules has engineSpeed 1', () => {
    const stats = calculateShipStats('freighter', []);
    expect(stats.engineSpeed).toBe(1);
  });
});
