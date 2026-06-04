import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDueStationBuilds = vi.fn();
const completeStationBuild = vi.fn().mockResolvedValue(undefined);
const getAllPlayerStationsWithRefinery = vi.fn().mockResolvedValue([]);

vi.mock('../../db/stationQueries.js', () => ({
  getDueStationBuilds: (...a: unknown[]) => getDueStationBuilds(...a),
  completeStationBuild: (...a: unknown[]) => completeStationBuild(...a),
  getAllPlayerStationsWithRefinery: (...a: unknown[]) => getAllPlayerStationsWithRefinery(...a),
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
});
