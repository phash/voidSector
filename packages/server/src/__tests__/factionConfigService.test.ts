import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FactionConfigService } from '../engine/factionConfigService.js';

// Mock the DB queries module
vi.mock('../db/queries.js', () => ({
  getAllFactionConfigs: vi.fn(),
}));

import { getAllFactionConfigs } from '../db/queries.js';

const mockGetAllFactionConfigs = vi.mocked(getAllFactionConfigs);

describe('FactionConfigService', () => {
  let service: FactionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FactionConfigService();
  });

  it('loads faction configs on init', async () => {
    mockGetAllFactionConfigs.mockResolvedValue([
      {
        faction_id: 'kthari',
        home_qx: 20,
        home_qy: -15,
        expansion_rate: 5,
        aggression: 2.0,
        expansion_style: 'sphere',
        active: true,
      },
      {
        faction_id: 'consortium',
        home_qx: -10,
        home_qy: -20,
        expansion_rate: 10,
        aggression: 0.4,
        expansion_style: 'sphere',
        active: true,
      },
    ]);
    await service.init();
    expect(service.getConfig('kthari')?.aggression).toBe(2.0);
    expect(service.getConfig('consortium')?.aggression).toBe(0.4);
  });

  it('returns null for unknown faction', async () => {
    mockGetAllFactionConfigs.mockResolvedValue([]);
    await service.init();
    expect(service.getConfig('unknown_faction')).toBeNull();
  });

  it('getActiveFactions returns all loaded factions', async () => {
    mockGetAllFactionConfigs.mockResolvedValue([
      {
        faction_id: 'kthari',
        home_qx: 20,
        home_qy: -15,
        expansion_rate: 5,
        aggression: 2.0,
        expansion_style: 'sphere',
        active: true,
      },
    ]);
    await service.init();
    expect(service.getActiveFactions()).toHaveLength(1);
  });

  it('distanceTo calculates euclidean distance from faction home', async () => {
    mockGetAllFactionConfigs.mockResolvedValue([
      {
        faction_id: 'kthari',
        home_qx: 0,
        home_qy: 0,
        expansion_rate: 5,
        aggression: 2.0,
        expansion_style: 'sphere',
        active: true,
      },
    ]);
    await service.init();
    // Distance from (0,0) to (3,4) = 5
    expect(service.distanceTo('kthari', 3, 4)).toBe(5);
  });

  it('distanceTo returns Infinity for unknown faction', async () => {
    mockGetAllFactionConfigs.mockResolvedValue([]);
    await service.init();
    expect(service.distanceTo('nonexistent', 0, 0)).toBe(Infinity);
  });
});
