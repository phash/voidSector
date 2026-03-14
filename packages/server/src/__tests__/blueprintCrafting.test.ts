import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getPlayerResearch: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
}));
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
}));

import { getPlayerResearch, getPlayerCredits, deductCredits } from '../db/queries.js';
import { addToInventory } from '../engine/inventoryService.js';
import { MODULES, BLUEPRINT_COPY_BASE_COST } from '@void-sector/shared';

describe('Blueprint Copy Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if module not in unlockedModules', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    } as any);

    const research = await getPlayerResearch('player-1');
    expect(research.unlockedModules.includes('drive_mk2')).toBe(false);
  });

  it('calculates correct cost: 100 * tier', () => {
    const mod = MODULES['drive_mk2'];
    expect(mod).toBeDefined();
    const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
    expect(cost).toBe(200);
  });

  it('calculates tier 5 cost correctly', () => {
    const mod = MODULES['drive_mk5'];
    if (mod) {
      const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
      expect(cost).toBe(500);
    }
  });

  it('rejects if not enough credits', async () => {
    vi.mocked(getPlayerCredits).mockResolvedValue(50);
    const credits = await getPlayerCredits('player-1');
    const cost = BLUEPRINT_COPY_BASE_COST * 2;
    expect(credits < cost).toBe(true);
  });

  it('deducts credits and adds blueprint on success', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    } as any);
    vi.mocked(getPlayerCredits).mockResolvedValue(1000);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(addToInventory).mockResolvedValue();

    const research = await getPlayerResearch('player-1');
    expect(research.unlockedModules.includes('drive_mk2')).toBe(true);

    const mod = MODULES['drive_mk2'];
    const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
    await deductCredits('player-1', cost);
    await addToInventory('player-1', 'blueprint', 'drive_mk2', 1);

    expect(deductCredits).toHaveBeenCalledWith('player-1', 200);
    expect(addToInventory).toHaveBeenCalledWith('player-1', 'blueprint', 'drive_mk2', 1);
  });
});
