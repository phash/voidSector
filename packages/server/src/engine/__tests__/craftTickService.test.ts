import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/craftSiteQueries.js', () => ({
  getAllActiveCraftSites: vi.fn(),
  setCraftProgress: vi.fn(),
  deleteCraftSite: vi.fn(),
}));

vi.mock('../../db/queries.js', () => ({
  addWissen: vi.fn(),
  getWissen: vi.fn().mockResolvedValue(10),
  upsertInventory: vi.fn(),
}));

vi.mock('../inventoryService.js', () => ({
  addToInventory: vi.fn(),
}));

import { processCraftTick } from '../craftTickService.js';
import { getAllActiveCraftSites, setCraftProgress, deleteCraftSite } from '../../db/craftSiteQueries.js';
import { addToInventory } from '../inventoryService.js';
import { addWissen } from '../../db/queries.js';

const mockGetAll = vi.mocked(getAllActiveCraftSites);
const mockSetProgress = vi.mocked(setCraftProgress);
const mockDelete = vi.mocked(deleteCraftSite);
const mockAddInventory = vi.mocked(addToInventory);
const mockAddWissen = vi.mocked(addWissen);

function makeSite(overrides: Partial<any> = {}) {
  return {
    id: 'site-1',
    player_id: 'player-1',
    ship_id: 'ship-1',
    module_id: 'ion_drive_mk2',
    progress: 0,
    duration: 10,
    needed_ore: 25,
    needed_gas: 40,
    needed_crystal: 80,
    needed_credits: 750,
    deposited_ore: 25,
    deposited_gas: 40,
    deposited_crystal: 80,
    deposited_credits: 750,
    paused: false,
    created_at: new Date(),
    ...overrides,
  };
}

describe('processCraftTick', () => {
  let notifyPlayer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    notifyPlayer = vi.fn();
  });

  it('skips paused sites', async () => {
    mockGetAll.mockResolvedValue([makeSite({ paused: true })]);
    await processCraftTick(notifyPlayer);
    expect(mockSetProgress).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('skips sites with insufficient deposits', async () => {
    mockGetAll.mockResolvedValue([makeSite({ deposited_ore: 10 })]);
    await processCraftTick(notifyPlayer);
    expect(mockSetProgress).not.toHaveBeenCalled();
  });

  it('increments progress by 5 for fully-deposited active sites', async () => {
    mockGetAll.mockResolvedValue([makeSite({ progress: 3, duration: 100 })]);
    await processCraftTick(notifyPlayer);
    expect(mockSetProgress).toHaveBeenCalledWith('site-1', 8);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('completes and deletes site when progress reaches duration', async () => {
    mockGetAll.mockResolvedValue([makeSite({ progress: 8, duration: 10 })]);
    await processCraftTick(notifyPlayer);

    expect(mockAddInventory).toHaveBeenCalledWith('player-1', 'module', 'ion_drive_mk2', 1);
    expect(mockAddWissen).toHaveBeenCalledWith('player-1', 3);
    expect(mockDelete).toHaveBeenCalledWith('site-1');
    expect(notifyPlayer).toHaveBeenCalledWith('player-1', 'craftComplete', { moduleId: 'ion_drive_mk2' });
    expect(notifyPlayer).toHaveBeenCalledWith('player-1', 'inventoryUpdated', {});
  });

  it('does not increment when no sites exist', async () => {
    mockGetAll.mockResolvedValue([]);
    await processCraftTick(notifyPlayer);
    expect(mockSetProgress).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
