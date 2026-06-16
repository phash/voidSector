import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  getPlayerPosition: vi.fn(),
  getFuelState: vi.fn(),
  getActiveShip: vi.fn(),
  getSector: vi.fn(),
  calculateShipStats: vi.fn(),
  getResourceTotal: vi.fn(),
  getStationData: vi.fn(),
}));

vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition,
  getFuelState: m.getFuelState,
}));

vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip,
  getSector: m.getSector,
}));

vi.mock('@void-sector/shared', () => ({
  calculateShipStats: m.calculateShipStats,
}));

vi.mock('../../inventoryService.js', () => ({
  getResourceTotal: m.getResourceTotal,
}));

vi.mock('../../../db/npcStationQueries.js', () => ({
  getStationData: m.getStationData,
}));

import { evaluateCondition } from '../conditions.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults
  m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
  m.getFuelState.mockResolvedValue(1000);
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ cargoCap: 20 });
  m.getResourceTotal.mockResolvedValue(0);
  m.getSector.mockResolvedValue({ type: 'asteroid', resources: { ore: 0, gas: 0, crystal: 0 } });
  m.getStationData.mockResolvedValue(null);
});

describe('evaluateCondition — resources', () => {
  it('returns true when sector has ore', async () => {
    m.getSector.mockResolvedValue({ type: 'asteroid', resources: { ore: 50, gas: 0, crystal: 0 } });
    const result = await evaluateCondition('p1', { kind: 'resources', negate: false });
    expect(result).toBe(true);
  });

  it('returns true when sector has gas', async () => {
    m.getSector.mockResolvedValue({ type: 'nebula', resources: { ore: 0, gas: 20, crystal: 0 } });
    const result = await evaluateCondition('p1', { kind: 'resources', negate: false });
    expect(result).toBe(true);
  });

  it('returns true when sector has crystal', async () => {
    m.getSector.mockResolvedValue({ type: 'asteroid', resources: { ore: 0, gas: 0, crystal: 10 } });
    const result = await evaluateCondition('p1', { kind: 'resources', negate: false });
    expect(result).toBe(true);
  });

  it('returns false when all resources are zero', async () => {
    m.getSector.mockResolvedValue({ type: 'empty', resources: { ore: 0, gas: 0, crystal: 0 } });
    const result = await evaluateCondition('p1', { kind: 'resources', negate: false });
    expect(result).toBe(false);
  });

  it('returns false when sector is null', async () => {
    m.getSector.mockResolvedValue(null);
    const result = await evaluateCondition('p1', { kind: 'resources', negate: false });
    expect(result).toBe(false);
  });
});

describe('evaluateCondition — full', () => {
  it('returns true when cargo equals capacity', async () => {
    m.getResourceTotal.mockResolvedValue(20);
    m.calculateShipStats.mockReturnValue({ cargoCap: 20 });
    const result = await evaluateCondition('p1', { kind: 'full', negate: false });
    expect(result).toBe(true);
  });

  it('returns true when cargo exceeds capacity', async () => {
    m.getResourceTotal.mockResolvedValue(25);
    m.calculateShipStats.mockReturnValue({ cargoCap: 20 });
    const result = await evaluateCondition('p1', { kind: 'full', negate: false });
    expect(result).toBe(true);
  });

  it('returns false when cargo is below capacity', async () => {
    m.getResourceTotal.mockResolvedValue(5);
    m.calculateShipStats.mockReturnValue({ cargoCap: 20 });
    const result = await evaluateCondition('p1', { kind: 'full', negate: false });
    expect(result).toBe(false);
  });
});

describe('evaluateCondition — empty', () => {
  it('returns true when cargo is zero', async () => {
    m.getResourceTotal.mockResolvedValue(0);
    const result = await evaluateCondition('p1', { kind: 'empty', negate: false });
    expect(result).toBe(true);
  });

  it('returns false when cargo has items', async () => {
    m.getResourceTotal.mockResolvedValue(3);
    const result = await evaluateCondition('p1', { kind: 'empty', negate: false });
    expect(result).toBe(false);
  });
});

describe('evaluateCondition — fuel_lt', () => {
  it('returns true when fuel is below the threshold', async () => {
    m.getFuelState.mockResolvedValue(100);
    const result = await evaluateCondition('p1', { kind: 'fuel_lt', value: 500, negate: false });
    expect(result).toBe(true);
  });

  it('returns false when fuel equals the threshold', async () => {
    m.getFuelState.mockResolvedValue(500);
    const result = await evaluateCondition('p1', { kind: 'fuel_lt', value: 500, negate: false });
    expect(result).toBe(false);
  });

  it('returns false when fuel is above the threshold', async () => {
    m.getFuelState.mockResolvedValue(900);
    const result = await evaluateCondition('p1', { kind: 'fuel_lt', value: 500, negate: false });
    expect(result).toBe(false);
  });

  it('treats null fuel as 0 (below threshold)', async () => {
    m.getFuelState.mockResolvedValue(null);
    const result = await evaluateCondition('p1', { kind: 'fuel_lt', value: 500, negate: false });
    expect(result).toBe(true);
  });
});

describe('evaluateCondition — at', () => {
  it('returns true when player is at the given coordinates', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 3, y: 4 });
    const result = await evaluateCondition('p1', { kind: 'at', x: 3, y: 4, negate: false });
    expect(result).toBe(true);
  });

  it('returns false when player is elsewhere', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    const result = await evaluateCondition('p1', { kind: 'at', x: 3, y: 4, negate: false });
    expect(result).toBe(false);
  });

  it('returns false when position is null (defaults 0:0) and target differs', async () => {
    m.getPlayerPosition.mockResolvedValue(null);
    const result = await evaluateCondition('p1', { kind: 'at', x: 3, y: 4, negate: false });
    expect(result).toBe(false);
  });
});

describe('evaluateCondition — station', () => {
  it('returns true when a station is present at the current sector', async () => {
    m.getStationData.mockResolvedValue({ stationX: 0, stationY: 0, level: 1, xp: 0 });
    const result = await evaluateCondition('p1', { kind: 'station', negate: false });
    expect(result).toBe(true);
  });

  it('returns false when no station is present', async () => {
    m.getStationData.mockResolvedValue(null);
    const result = await evaluateCondition('p1', { kind: 'station', negate: false });
    expect(result).toBe(false);
  });
});

describe('evaluateCondition — negation', () => {
  it('negates full: negate:true with full cargo returns false', async () => {
    m.getResourceTotal.mockResolvedValue(20);
    m.calculateShipStats.mockReturnValue({ cargoCap: 20 });
    const result = await evaluateCondition('p1', { kind: 'full', negate: true });
    expect(result).toBe(false);
  });

  it('negates empty: negate:true with empty cargo returns false', async () => {
    m.getResourceTotal.mockResolvedValue(0);
    const result = await evaluateCondition('p1', { kind: 'empty', negate: true });
    expect(result).toBe(false);
  });

  it('negates resources: negate:true with resources returns false', async () => {
    m.getSector.mockResolvedValue({ type: 'asteroid', resources: { ore: 50, gas: 0, crystal: 0 } });
    const result = await evaluateCondition('p1', { kind: 'resources', negate: true });
    expect(result).toBe(false);
  });

  it('negates station: negate:true with station present returns false', async () => {
    m.getStationData.mockResolvedValue({ stationX: 0, stationY: 0, level: 1, xp: 0 });
    const result = await evaluateCondition('p1', { kind: 'station', negate: true });
    expect(result).toBe(false);
  });

  it('negates fuel_lt: negate:true with low fuel returns false', async () => {
    m.getFuelState.mockResolvedValue(100);
    const result = await evaluateCondition('p1', { kind: 'fuel_lt', value: 500, negate: true });
    expect(result).toBe(false);
  });
});
