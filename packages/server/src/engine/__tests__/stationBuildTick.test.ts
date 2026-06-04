import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDueStationBuilds = vi.fn();
const completeStationBuild = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/stationQueries.js', () => ({
  getDueStationBuilds: (...a: unknown[]) => getDueStationBuilds(...a),
  completeStationBuild: (...a: unknown[]) => completeStationBuild(...a),
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processStationBuildTick } from '../stationBuildTick.js';

beforeEach(() => {
  getDueStationBuilds.mockReset();
  completeStationBuild.mockReset().mockResolvedValue(undefined);
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
});
