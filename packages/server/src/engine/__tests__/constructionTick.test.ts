import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/constructionQueries.js', () => ({
  getAllConstructionSites: vi.fn(),
  setProgress: vi.fn(),
  markPaused: vi.fn(),
  deleteConstructionSiteById: vi.fn(),
}));
vi.mock('../../db/queries.js', () => ({
  createStructure: vi.fn(),
  insertPlayerJumpGate: vi.fn(),
  upgradeJumpGate: vi.fn(),
}));
vi.mock('../../db/stationQueries.js', () => ({
  insertPlayerStation: vi.fn(),
}));
vi.mock('../quadrantEngine.js', () => ({
  sectorToQuadrant: vi.fn().mockReturnValue({ qx: 0, qy: 0 }),
}));

import { processConstructionTick } from '../constructionTickService.js';
import {
  getAllConstructionSites,
  setProgress,
  markPaused,
  deleteConstructionSiteById,
} from '../../db/constructionQueries.js';
import { createStructure } from '../../db/queries.js';
import { constructionBus } from '../../constructionBus.js';

const baseSite = {
  id: 'site-1',
  owner_id: 'player-1',
  type: 'mining_station',
  sector_x: 5,
  sector_y: 5,
  needed_ore: 30,
  needed_gas: 15,
  needed_crystal: 10,
  needed_credits: 0,
  needed_artefact: 0,
  deposited_credits: 0,
  deposited_artefact: 0,
  metadata: null,
  paused: false,
};

describe('processConstructionTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no sites', async () => {
    (getAllConstructionSites as any).mockResolvedValue([]);
    await processConstructionTick();
    expect(setProgress).not.toHaveBeenCalled();
  });

  it('advances when resources meet threshold at progress 0→1', async () => {
    (getAllConstructionSites as any).mockResolvedValue([{
      ...baseSite, progress: 0,
      deposited_ore: 1, deposited_gas: 1, deposited_crystal: 1,
    }]);
    (setProgress as any).mockResolvedValue(undefined);
    await processConstructionTick();
    expect(setProgress).toHaveBeenCalledWith('site-1', 1);
    expect(markPaused).not.toHaveBeenCalled();
  });

  it('pauses when insufficient resources', async () => {
    (getAllConstructionSites as any).mockResolvedValue([{
      ...baseSite, progress: 50,
      deposited_ore: 0, deposited_gas: 0, deposited_crystal: 0,
    }]);
    await processConstructionTick();
    expect(markPaused).toHaveBeenCalledWith('site-1');
    expect(setProgress).not.toHaveBeenCalled();
  });

  it('does not re-pause an already-paused site', async () => {
    (getAllConstructionSites as any).mockResolvedValue([{
      ...baseSite, progress: 50, paused: true,
      deposited_ore: 0, deposited_gas: 0, deposited_crystal: 0,
    }]);
    await processConstructionTick();
    expect(markPaused).not.toHaveBeenCalled();
  });

  it('creates structure and deletes site when progress reaches 100', async () => {
    (getAllConstructionSites as any).mockResolvedValue([{
      ...baseSite, progress: 99,
      deposited_ore: 30, deposited_gas: 15, deposited_crystal: 10,
    }]);
    (createStructure as any).mockResolvedValue({ id: 'struct-1' });
    (deleteConstructionSiteById as any).mockResolvedValue(undefined);
    const emitSpy = vi.spyOn(constructionBus, 'emit');
    await processConstructionTick();
    expect(createStructure).toHaveBeenCalledWith('player-1', 'mining_station', 5, 5);
    expect(deleteConstructionSiteById).toHaveBeenCalledWith('site-1');
    expect(emitSpy).toHaveBeenCalledWith('completed', {
      siteId: 'site-1', sectorX: 5, sectorY: 5,
      type: 'mining_station', ownerId: 'player-1', metadata: null,
    });
  });
});
