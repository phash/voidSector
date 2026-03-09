import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getInventory: vi.fn(),
  getInventoryItem: vi.fn(),
  upsertInventory: vi.fn(),
  deductInventory: vi.fn(),
  transferInventoryItem: vi.fn(),
  getCargoCapForPlayer: vi.fn(),
}));

import {
  addToInventory,
  removeFromInventory,
  getResourceTotal,
  canAddResource,
} from '../engine/inventoryService.js';
import {
  getInventory,
  upsertInventory,
  deductInventory,
  getCargoCapForPlayer,
} from '../db/queries.js';

beforeEach(() => vi.clearAllMocks());

describe('inventoryService', () => {
  it('addToInventory delegates to upsertInventory', async () => {
    vi.mocked(upsertInventory).mockResolvedValue(undefined);
    await addToInventory('p1', 'resource', 'ore', 5);
    expect(upsertInventory).toHaveBeenCalledWith('p1', 'resource', 'ore', 5);
  });

  it('removeFromInventory delegates to deductInventory', async () => {
    vi.mocked(deductInventory).mockResolvedValue(undefined);
    await removeFromInventory('p1', 'module', 'drive_mk2', 1);
    expect(deductInventory).toHaveBeenCalledWith('p1', 'module', 'drive_mk2', 1);
  });

  it('getResourceTotal sums only resource items', async () => {
    vi.mocked(getInventory).mockResolvedValue([
      { itemType: 'resource', itemId: 'ore', quantity: 10 },
      { itemType: 'resource', itemId: 'gas', quantity: 5 },
      { itemType: 'module', itemId: 'drive_mk2', quantity: 1 }, // should NOT count
    ]);
    const total = await getResourceTotal('p1');
    expect(total).toBe(15);
  });

  it('canAddResource returns true when under cap', async () => {
    vi.mocked(getInventory).mockResolvedValue([
      { itemType: 'resource', itemId: 'ore', quantity: 5 },
    ]);
    vi.mocked(getCargoCapForPlayer).mockResolvedValue(20);
    expect(await canAddResource('p1', 3)).toBe(true);
  });

  it('canAddResource returns false when at cap', async () => {
    vi.mocked(getInventory).mockResolvedValue([
      { itemType: 'resource', itemId: 'ore', quantity: 18 },
      { itemType: 'resource', itemId: 'gas', quantity: 4 },
    ]);
    vi.mocked(getCargoCapForPlayer).mockResolvedValue(20);
    expect(await canAddResource('p1', 3)).toBe(false);
  });
});
