import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JumpGateMapEntry } from '@void-sector/shared';

vi.mock('../../db/client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/client.js';
import { getPlayerKnownJumpGates, addPlayerKnownJumpGate } from '../../db/queries.js';

const mockQuery = vi.mocked(query);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// getPlayerKnownJumpGates
// ---------------------------------------------------------------------------
describe('getPlayerKnownJumpGates', () => {
  it('returns empty array when player has no known gates', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] } as any);
    const result = await getPlayerKnownJumpGates('player-1');
    expect(result).toEqual([]);
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('player_known_jumpgates'),
      ['player-1'],
    );
  });

  it('returns mapped JumpGateMapEntry array', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { gate_id: 'gate_10_20', from_x: 10, from_y: 20, to_x: 100, to_y: 200, gate_type: 'bidirectional' },
        { gate_id: 'gate_30_40', from_x: 30, from_y: 40, to_x: 300, to_y: 400, gate_type: 'wormhole' },
      ],
      rowCount: 2, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const result = await getPlayerKnownJumpGates('player-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      gateId: 'gate_10_20',
      fromX: 10,
      fromY: 20,
      toX: 100,
      toY: 200,
      gateType: 'bidirectional',
    });
    expect(result[1]).toEqual({
      gateId: 'gate_30_40',
      fromX: 30,
      fromY: 40,
      toX: 300,
      toY: 400,
      gateType: 'wormhole',
    });
  });

  it('passes correct playerId to query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] } as any);
    await getPlayerKnownJumpGates('uuid-abc-123');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['uuid-abc-123'],
    );
  });
});

// ---------------------------------------------------------------------------
// addPlayerKnownJumpGate
// ---------------------------------------------------------------------------
describe('addPlayerKnownJumpGate', () => {
  it('inserts gate with correct parameters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] } as any);

    await addPlayerKnownJumpGate('player-1', 'gate_10_20', 10, 20, 100, 200, 'bidirectional');

    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('player_known_jumpgates'),
      ['player-1', 'gate_10_20', 10, 20, 100, 200, 'bidirectional'],
    );
  });

  it('uses ON CONFLICT DO NOTHING for idempotent inserts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'INSERT', oid: 0, fields: [] } as any);

    await addPlayerKnownJumpGate('player-1', 'gate_10_20', 10, 20, 100, 200, 'wormhole');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO NOTHING');
  });

  it('handles wormhole gate type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] } as any);

    await addPlayerKnownJumpGate('player-1', 'gate_50_60', 50, 60, 500, 600, 'wormhole');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['player-1', 'gate_50_60', 50, 60, 500, 600, 'wormhole'],
    );
  });

  it('handles negative coordinates', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] } as any);

    await addPlayerKnownJumpGate('player-1', 'gate_-10_-20', -10, -20, -100, -200, 'bidirectional');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['player-1', 'gate_-10_-20', -10, -20, -100, -200, 'bidirectional'],
    );
  });
});

// ---------------------------------------------------------------------------
// JumpGateMapEntry type shape
// ---------------------------------------------------------------------------
describe('JumpGateMapEntry type', () => {
  it('conforms to expected interface shape', () => {
    const entry: JumpGateMapEntry = {
      gateId: 'gate_10_20',
      fromX: 10,
      fromY: 20,
      toX: 100,
      toY: 200,
      gateType: 'bidirectional',
    };
    expect(entry.gateId).toBe('gate_10_20');
    expect(entry.fromX).toBe(10);
    expect(entry.fromY).toBe(20);
    expect(entry.toX).toBe(100);
    expect(entry.toY).toBe(200);
    expect(entry.gateType).toBe('bidirectional');
  });

  it('accepts wormhole gateType', () => {
    const entry: JumpGateMapEntry = {
      gateId: 'gate_worm',
      fromX: 0,
      fromY: 0,
      toX: 9999,
      toY: 9999,
      gateType: 'wormhole',
    };
    expect(entry.gateType).toBe('wormhole');
  });
});
