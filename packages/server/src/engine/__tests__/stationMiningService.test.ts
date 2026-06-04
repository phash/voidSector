import { describe, it, expect, vi, beforeEach } from 'vitest';

const q = vi.hoisted(() => ({
  getAllStationMiningShips: vi.fn(),
  createStationMiningShip: vi.fn().mockResolvedValue(1),
  updateStationMiningShip: vi.fn().mockResolvedValue(undefined),
  countStationMiningShips: vi.fn().mockResolvedValue(0),
  getStationsEligibleForMining: vi.fn().mockResolvedValue([]),
  toCivShip: (row: any) => ({
    id: row.id, faction: 'humans', ship_type: 'mining_drone', role: 'drone',
    state: row.state, x: row.x, y: row.y, home_x: row.home_x, home_y: row.home_y,
    target_x: row.target_x ?? undefined, target_y: row.target_y ?? undefined,
    spiral_step: row.spiral_step, resources_carried: row.resources_carried,
    mined_resource: row.mined_resource ?? undefined,
  }),
}));
vi.mock('../../db/stationMiningQueries.js', () => q);

const station = vi.hoisted(() => ({
  getPlayerStationById: vi.fn(),
  addTradeVolume: vi.fn().mockResolvedValue({ trade_volume: 500, level: 1 }),
  setStationLevel: vi.fn().mockResolvedValue(undefined),
  updateStationCargo: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../db/stationQueries.js', () => station);

const addCredits = vi.hoisted(() => vi.fn().mockResolvedValue(0));
vi.mock('../../db/queries.js', () => ({ addCredits: (...a: unknown[]) => addCredits(...a) }));

const broadcastTick = vi.hoisted(() => vi.fn());
vi.mock('../../civShipBus.js', () => ({ civShipBus: { broadcastTick: (...a: unknown[]) => broadcastTick(...a) } }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { processStationMiningTick, spawnMissingStationMiningShips } from '../stationMiningService.js';

beforeEach(() => {
  q.createStationMiningShip.mockReset().mockResolvedValue(1);
  q.updateStationMiningShip.mockReset().mockResolvedValue(undefined);
  q.countStationMiningShips.mockReset().mockResolvedValue(0);
  q.getStationsEligibleForMining.mockReset().mockResolvedValue([]);
  q.getAllStationMiningShips.mockReset().mockResolvedValue([]);
  station.getPlayerStationById.mockReset();
  station.addTradeVolume.mockReset().mockResolvedValue({ trade_volume: 500, level: 1 });
  station.setStationLevel.mockReset().mockResolvedValue(undefined);
  station.updateStationCargo.mockReset().mockResolvedValue(undefined);
  addCredits.mockReset().mockResolvedValue(0);
  broadcastTick.mockReset();
});

describe('spawnMissingStationMiningShips', () => {
  it('creates ships up to werft_level per station', async () => {
    q.getStationsEligibleForMining.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', sector_x: 5, sector_y: 5, werft_level: 2 },
    ]);
    q.countStationMiningShips.mockResolvedValue(0);
    await spawnMissingStationMiningShips();
    expect(q.createStationMiningShip).toHaveBeenCalledTimes(2);
    expect(q.createStationMiningShip).toHaveBeenCalledWith(
      expect.objectContaining({ station_id: 'st1', owner_id: 'o1', home_x: 5, home_y: 5 }),
    );
  });

  it('does not exceed the werft cap', async () => {
    q.getStationsEligibleForMining.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', sector_x: 5, sector_y: 5, werft_level: 2 },
    ]);
    q.countStationMiningShips.mockResolvedValue(2);
    await spawnMissingStationMiningShips();
    expect(q.createStationMiningShip).not.toHaveBeenCalled();
  });
});

describe('processStationMiningTick', () => {
  it('advances and persists each ship and broadcasts', async () => {
    q.getAllStationMiningShips.mockResolvedValue([
      { id: 1, station_id: 'st1', owner_id: 'o1', state: 'idle', x: 5, y: 5, home_x: 5, home_y: 5, target_x: null, target_y: null, spiral_step: 0, resources_carried: 0, mined_resource: null },
    ]);
    await processStationMiningTick();
    expect(q.updateStationMiningShip).toHaveBeenCalledWith(1, expect.objectContaining({ state: 'exploring' }));
    expect(broadcastTick).toHaveBeenCalled();
  });

  it('stores the haul into station cargo when the station has no Markt', async () => {
    q.getAllStationMiningShips.mockResolvedValue([
      { id: 1, station_id: 'st1', owner_id: 'o1', state: 'returning', x: 6, y: 5, home_x: 5, home_y: 5, target_x: 5, target_y: 5, spiral_step: 10, resources_carried: 20, mined_resource: 'ore' },
    ]);
    station.getPlayerStationById.mockResolvedValue({ id: 'st1', owner_id: 'o1', markt_level: 0, cargo_level: 1, cargo_contents: {}, level: 1, trade_volume: 0 });
    await processStationMiningTick();
    expect(station.updateStationCargo).toHaveBeenCalledWith('st1', expect.objectContaining({ ore: 20 }));
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('auto-sells the haul on delivery when the station has a Markt', async () => {
    q.getAllStationMiningShips.mockResolvedValue([
      { id: 1, station_id: 'st1', owner_id: 'o1', state: 'returning', x: 6, y: 5, home_x: 5, home_y: 5, target_x: 5, target_y: 5, spiral_step: 10, resources_carried: 20, mined_resource: 'ore' },
    ]);
    station.getPlayerStationById.mockResolvedValue({ id: 'st1', owner_id: 'o1', markt_level: 1, cargo_level: 0, cargo_contents: {}, level: 1, trade_volume: 0 });
    await processStationMiningTick();
    expect(addCredits).toHaveBeenCalledWith('o1', expect.any(Number));
    expect(station.addTradeVolume).toHaveBeenCalledWith('st1', expect.any(Number));
  });
});
