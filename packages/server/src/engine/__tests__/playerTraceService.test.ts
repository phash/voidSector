import { describe, it, expect } from 'vitest';
import { formatTraceAge, traceMessage, parseTraces } from '../playerTraceService.js';
import type { PlayerTrace } from '../playerTraceService.js';

const NOW = 1_000_000_000_000;

describe('formatTraceAge (BB5)', () => {
  it('soeben under a minute', () => {
    expect(formatTraceAge(NOW - 30_000, NOW)).toBe('soeben');
  });
  it('minutes / hours / days', () => {
    expect(formatTraceAge(NOW - 5 * 60_000, NOW)).toBe('vor 5m');
    expect(formatTraceAge(NOW - 3 * 3600_000, NOW)).toBe('vor 3h');
    expect(formatTraceAge(NOW - 2 * 24 * 3600_000, NOW)).toBe('vor 2t');
  });
});

describe('traceMessage (BB5)', () => {
  it('formats per action with name + age', () => {
    expect(
      traceMessage({ playerId: 'p', playerName: 'Alice', action: 'explored', x: 1, y: 2, ts: NOW - 60_000 }, NOW),
    ).toBe('◈ Alice erkundete diesen Sektor (vor 1m)');
    expect(
      traceMessage({ playerId: 'p', playerName: 'Bob', action: 'defeated_pirates', x: 0, y: 0, ts: NOW }, NOW),
    ).toBe('◈ Bob besiegte hier Piraten (soeben)');
  });
});

describe('parseTraces (BB5)', () => {
  const good: PlayerTrace = { playerId: 'p', playerName: 'Alice', action: 'explored', x: 1, y: 2, ts: NOW };

  it('parses a clean list', () => {
    expect(parseTraces([JSON.stringify(good)])).toEqual([good]);
  });

  it('skips a single corrupt entry without dropping the rest', () => {
    const raw = [JSON.stringify(good), 'not-json{', JSON.stringify({ ...good, playerName: 'Bob' })];
    const parsed = parseTraces(raw);
    expect(parsed.map((t) => t.playerName)).toEqual(['Alice', 'Bob']);
  });

  it('returns empty for an empty list', () => {
    expect(parseTraces([])).toEqual([]);
  });
});
