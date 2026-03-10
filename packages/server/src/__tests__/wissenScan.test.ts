import { describe, it, expect, vi } from 'vitest';
import { addWissenCapped, WISSEN_DAILY_CAP_BASE, WISSEN_DAILY_CAP_FRONTIER } from '../rooms/services/ScanService.js';

describe('addWissenCapped', () => {
  function makeRedis(current: string | null): any {
    return {
      get: vi.fn().mockResolvedValue(current),
      set: vi.fn().mockResolvedValue('OK'),
    };
  }

  it('adds wissen up to base cap', async () => {
    const redis = makeRedis('150');
    const added = await addWissenCapped(redis, 'u1', 100, false);
    expect(added).toBe(50);
    expect(redis.set).toHaveBeenCalledWith('wissen_daily:u1:' + new Date().toISOString().slice(0, 10), '200', 'EX', 93600);
  });

  it('uses frontier cap when isFrontier=true', async () => {
    const redis = makeRedis('150');
    const added = await addWissenCapped(redis, 'u1', 100, true);
    expect(added).toBe(100);
  });

  it('returns 0 when cap exhausted', async () => {
    const redis = makeRedis('200');
    const added = await addWissenCapped(redis, 'u1', 50, false);
    expect(added).toBe(0);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('handles null redis value (first call)', async () => {
    const redis = makeRedis(null);
    const added = await addWissenCapped(redis, 'u1', 10, false);
    expect(added).toBe(10);
  });
});
