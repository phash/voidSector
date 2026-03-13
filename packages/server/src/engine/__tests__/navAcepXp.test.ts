import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';

vi.mock('../../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 }),
}));

describe('navigation ACEP XP triggers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awards AUSBAU XP on jump', async () => {
    await addAcepXpForPlayer('user1', 'ausbau', 2);
    expect(addAcepXpForPlayer).toHaveBeenCalledWith('user1', 'ausbau', 2);
  });

  it('awards EXPLORER XP for first sector discovery', async () => {
    await addAcepXpForPlayer('user1', 'explorer', 10);
    expect(addAcepXpForPlayer).toHaveBeenCalledWith('user1', 'explorer', 10);
  });

  it('awards bonus EXPLORER XP for first quadrant discovery', async () => {
    await addAcepXpForPlayer('user1', 'explorer', 50);
    expect(addAcepXpForPlayer).toHaveBeenCalledWith('user1', 'explorer', 50);
  });
});
