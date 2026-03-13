import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getMiningStoryIndex: vi.fn(),
  updateMiningStoryIndex: vi.fn(),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getMiningStoryCounter: vi.fn(),
  setMiningStoryCounter: vi.fn(),
}));

import { getMiningStoryIndex, updateMiningStoryIndex } from '../db/queries.js';
import { getMiningStoryCounter, setMiningStoryCounter } from '../rooms/services/RedisAPStore.js';
import { updateStoryProgress } from '../rooms/services/MiningService.js';

const mockGetIndex = vi.mocked(getMiningStoryIndex);
const mockUpdateIndex = vi.mocked(updateMiningStoryIndex);
const mockGetCounter = vi.mocked(getMiningStoryCounter);
const mockSetCounter = vi.mocked(setMiningStoryCounter);

beforeEach(() => vi.resetAllMocks());

describe('updateStoryProgress', () => {
  it('does not advance when mined < threshold remainder', async () => {
    mockGetCounter.mockResolvedValue(0);
    mockGetIndex.mockResolvedValue(5);

    const result = await updateStoryProgress('player1', 7);

    expect(mockSetCounter).toHaveBeenCalledWith('player1', 7);
    expect(mockUpdateIndex).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('advances one fragment when counter crosses 10', async () => {
    mockGetCounter.mockResolvedValue(5);
    mockGetIndex.mockResolvedValue(3);
    mockUpdateIndex.mockResolvedValue(undefined);

    const result = await updateStoryProgress('player1', 8);
    // 5 + 8 = 13, floor(13/10) = 1 advancement, remainder = 3

    expect(mockUpdateIndex).toHaveBeenCalledWith('player1', 4);
    expect(mockSetCounter).toHaveBeenCalledWith('player1', 3);
    expect(result).toBe(4);
  });

  it('advances multiple fragments for large mined amounts', async () => {
    mockGetCounter.mockResolvedValue(2);
    mockGetIndex.mockResolvedValue(0);
    mockUpdateIndex.mockResolvedValue(undefined);

    const result = await updateStoryProgress('player1', 25);
    // 2 + 25 = 27, floor(27/10) = 2 advancements, remainder = 7

    expect(mockUpdateIndex).toHaveBeenCalledWith('player1', 2);
    expect(mockSetCounter).toHaveBeenCalledWith('player1', 7);
    expect(result).toBe(2);
  });

  it('does nothing when mined is 0', async () => {
    const result = await updateStoryProgress('player1', 0);

    expect(mockGetCounter).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
