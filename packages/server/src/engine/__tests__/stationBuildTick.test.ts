import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDueStationBuilds = vi.fn();
const completeStationBuild = vi.fn().mockResolvedValue(undefined);
const getAllPlayerStationsWithRefinery = vi.fn().mockResolvedValue([]);
const getRefineryStationsWithCargo = vi.fn().mockResolvedValue([]);
const updateStationCargo = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/stationQueries.js', () => ({
  getDueStationBuilds: (...a: unknown[]) => getDueStationBuilds(...a),
  completeStationBuild: (...a: unknown[]) => completeStationBuild(...a),
  getAllPlayerStationsWithRefinery: (...a: unknown[]) => getAllPlayerStationsWithRefinery(...a),
  getRefineryStationsWithCargo: (...a: unknown[]) => getRefineryStationsWithCargo(...a),
  updateStationCargo: (...a: unknown[]) => updateStationCargo(...a),
}));
vi.mock('../../db/queries.js', () => ({
  addCredits: vi.fn().mockResolvedValue(0),
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processStationBuildTick } from '../stationBuildTick.js';

beforeEach(() => {
  getDueStationBuilds.mockReset();
  completeStationBuild.mockReset().mockResolvedValue(undefined);
  getAllPlayerStationsWithRefinery.mockReset().mockResolvedValue([]);
  getRefineryStationsWithCargo.mockReset().mockResolvedValue([]);
  updateStationCargo.mockReset().mockResolvedValue(undefined);
});

describe('processStationBuildTick', () => {
  it('completes each due build with its expansion type', async () => {
    getDueStationBuilds.mockResolvedValue([
      { id: 's1', building_expansion: 'markt' },
      { id: 's2', building_expansion: 'werft' },
    ]);
    await processStationBuildTick();
    expect(completeStationBuild).toHaveBeenCalledWith('s1', 'markt');
    expect(completeStationBuild).toHaveBeenCalledWith('s2', 'werft');
    expect(completeStationBuild).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no builds are due', async () => {
    getDueStationBuilds.mockResolvedValue([]);
    await processStationBuildTick();
    expect(completeStationBuild).not.toHaveBeenCalled();
  });

  it('continues to the next station when one completion throws', async () => {
    getDueStationBuilds.mockResolvedValue([
      { id: 's1', building_expansion: 'markt' },
      { id: 's2', building_expansion: 'werft' },
    ]);
    completeStationBuild.mockRejectedValueOnce(new Error('db blip')); // s1 fails
    await processStationBuildTick();
    // s2 still attempted despite s1 throwing
    expect(completeStationBuild).toHaveBeenCalledWith('s2', 'werft');
  });

  it('refines gas into fuel for stations with a refinery', async () => {
    getDueStationBuilds.mockResolvedValue([]);
    getAllPlayerStationsWithRefinery.mockResolvedValue([]);
    getRefineryStationsWithCargo.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', refinery_level: 2, cargo_contents: { gas: 10 } },
    ]);
    await processStationBuildTick();
    expect(updateStationCargo).toHaveBeenCalledWith('st1', expect.objectContaining({ gas: 8, fuel: 200 }));
  });

  it('skips stations whose cargo is unchanged by refining', async () => {
    getDueStationBuilds.mockResolvedValue([]);
    getAllPlayerStationsWithRefinery.mockResolvedValue([]);
    getRefineryStationsWithCargo.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', refinery_level: 2, cargo_contents: { gas: 0 } },
    ]);
    await processStationBuildTick();
    expect(updateStationCargo).not.toHaveBeenCalled();
  });
});
