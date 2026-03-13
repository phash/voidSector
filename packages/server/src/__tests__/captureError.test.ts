import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/adminQueries.js', () => {
  const mockUpsert = vi.fn().mockResolvedValue(undefined);
  return {
    upsertErrorLog: mockUpsert,
  };
});

import { captureError } from '../utils/errorLogTransport.js';
import * as adminQueries from '../db/adminQueries.js';

describe('captureError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls upsertErrorLog with 64-char fingerprint', async () => {
    const err = new Error('test error');
    err.stack = 'Error: test error\n    at handleJump (src/rooms/SectorRoom.ts:123:5)\n    at node_modules/colyseus/Room.js:45:10';
    await captureError(err, 'handleJump');
    expect(adminQueries.upsertErrorLog).toHaveBeenCalledTimes(1);
    const [fingerprint, message, location] = (adminQueries.upsertErrorLog as any).mock.calls[0];
    expect(fingerprint).toHaveLength(64);
    expect(message).toBe('test error');
    expect(location).toContain('SectorRoom.ts');
  });

  it('same error → same fingerprint', async () => {
    const make = () => {
      const e = new Error('dup');
      e.stack = 'Error: dup\n    at foo (src/foo.ts:1:1)';
      return e;
    };
    await captureError(make(), 'foo');
    await captureError(make(), 'foo');
    expect((adminQueries.upsertErrorLog as any).mock.calls[0][0]).toBe((adminQueries.upsertErrorLog as any).mock.calls[1][0]);
  });

  it('does not throw if upsertErrorLog fails', async () => {
    vi.mocked(adminQueries.upsertErrorLog).mockRejectedValueOnce(new Error('DB down'));
    await expect(captureError(new Error('x'), 'ctx')).resolves.toBeUndefined();
  });
});
