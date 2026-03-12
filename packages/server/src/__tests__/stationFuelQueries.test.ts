import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../db/client.js';
import {
  getStationFuelAndGas,
  updateStationFuelStock,
  consumeStationGas,
  getAllStationsForFuelProduction,
} from '../db/npcStationQueries.js';

const mockQuery = vi.mocked(query);

describe('station fuel queries', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('getStationFuelAndGas returns fuel and gas rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { item_type: 'fuel', stock: 500, max_stock: 50000 },
        { item_type: 'gas',  stock: 10,  max_stock: 1000  },
      ],
    } as any);
    const result = await getStationFuelAndGas(3, 4);
    expect(result.fuel).toBe(500);
    expect(result.gas).toBe(10);
  });

  it('updateStationFuelStock calls upsert with capped value', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await updateStationFuelStock(3, 4, 1000, 50_000);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('npc_station_inventory'),
      expect.arrayContaining([3, 4, 'fuel', 1000]),
    );
  });

  it('consumeStationGas decrements gas stock', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await consumeStationGas(3, 4, 1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('npc_station_inventory'),
      expect.arrayContaining([3, 4, 'gas', 1]),
    );
  });

  it('getAllStationsForFuelProduction maps columns to x/y/level', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ station_x: 10, station_y: 20, level: 3 }],
    } as any);
    const result = await getAllStationsForFuelProduction();
    expect(result).toEqual([{ x: 10, y: 20, level: 3 }]);
  });
});
