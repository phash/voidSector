import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from '../test/mockFactories.js';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../db/client.js';
import {
  upsertErrorLog,
  getErrorLogs,
  updateErrorLogStatus,
  deleteErrorLog,
  ErrorLog,
} from '../db/adminQueries.js';

const mockQuery = vi.mocked(query);

describe('adminQueries error_logs functions', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('upsertErrorLog', () => {
    it('calls query with correct INSERT ON CONFLICT parameters', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]));

      await upsertErrorLog('fp123', 'Test error', 'test.ts:10', 'Error stack trace');

      expect(mockQuery).toHaveBeenCalledWith(
        `INSERT INTO error_logs (fingerprint, message, location, stack)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (fingerprint)
     DO UPDATE SET count = error_logs.count + 1, last_seen = NOW()`,
        ['fp123', 'Test error', 'test.ts:10', 'Error stack trace'],
      );
    });

    it('handles null location and stack', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]));

      await upsertErrorLog('fp456', 'Another error', null, null);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['fp456', 'Another error', null, null],
      );
    });
  });

  describe('getErrorLogs', () => {
    it('returns all error logs when no status filter', async () => {
      const mockLogs: ErrorLog[] = [
        {
          id: 1,
          fingerprint: 'fp1',
          message: 'Error 1',
          location: 'test.ts:10',
          stack: 'stack 1',
          count: 1,
          first_seen: '2026-03-11T00:00:00Z',
          last_seen: '2026-03-11T00:00:00Z',
          status: 'new',
          github_issue_url: null,
        },
      ];
      mockQuery.mockResolvedValueOnce(mockQueryResult(mockLogs));

      const result = await getErrorLogs();

      expect(result).toHaveLength(1);
      expect(result[0].fingerprint).toBe('fp1');
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT * FROM error_logs ORDER BY last_seen DESC LIMIT 200`,
        [],
      );
    });

    it('returns filtered error logs when status is provided', async () => {
      const mockLogs: ErrorLog[] = [
        {
          id: 2,
          fingerprint: 'fp2',
          message: 'Error 2',
          location: 'test.ts:20',
          stack: 'stack 2',
          count: 2,
          first_seen: '2026-03-10T00:00:00Z',
          last_seen: '2026-03-11T00:00:00Z',
          status: 'resolved',
          github_issue_url: 'https://github.com/test/issues/1',
        },
      ];
      mockQuery.mockResolvedValueOnce(mockQueryResult(mockLogs));

      const result = await getErrorLogs('resolved');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('resolved');
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT * FROM error_logs WHERE status = $1 ORDER BY last_seen DESC LIMIT 200`,
        ['resolved'],
      );
    });

    it('ignores "all" status filter', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]));

      await getErrorLogs('all');

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT * FROM error_logs ORDER BY last_seen DESC LIMIT 200`,
        [],
      );
    });
  });

  describe('updateErrorLogStatus', () => {
    it('returns true when update succeeds', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 1 }]));

      const result = await updateErrorLogStatus(1, 'resolved');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        `UPDATE error_logs SET status = $1 WHERE id = $2 RETURNING id`,
        ['resolved', 1],
      );
    });

    it('returns false when no rows affected', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]));

      const result = await updateErrorLogStatus(999, 'ignored');

      expect(result).toBe(false);
    });

    it('accepts new, ignored, or resolved status', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 1 }]));

      await updateErrorLogStatus(1, 'new');

      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.any(String),
        ['new', 1],
      );
    });
  });

  describe('deleteErrorLog', () => {
    it('returns true when delete succeeds', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 1 }]));

      const result = await deleteErrorLog(1);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        `DELETE FROM error_logs WHERE id = $1 RETURNING id`,
        [1],
      );
    });

    it('returns false when no rows deleted', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([]));

      const result = await deleteErrorLog(999);

      expect(result).toBe(false);
    });
  });
});
