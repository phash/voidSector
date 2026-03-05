import { describe, it, expect } from 'vitest';
import { findReachableGates } from '../jumpgateRouting.js';

const makeGate = (id: string, x: number, y: number, toll: number) => ({
  id, sectorX: x, sectorY: y, tollCredits: toll,
});

describe('findReachableGates', () => {
  it('returns direct link as single hop', () => {
    const gates = new Map([
      ['A', makeGate('A', 0, 0, 5)],
      ['B', makeGate('B', 10, 10, 10)],
    ]);
    const links = new Map([['A', ['B']], ['B', ['A']]]);
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ gateId: 'B', totalCost: 5, hops: 1 });
  });

  it('returns multi-hop chain with accumulated cost', () => {
    const gates = new Map([
      ['A', makeGate('A', 0, 0, 5)],
      ['B', makeGate('B', 10, 0, 10)],
      ['C', makeGate('C', 20, 0, 15)],
    ]);
    const links = new Map([['A', ['B']], ['B', ['A', 'C']], ['C', ['B']]]);
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(2);
    const toC = result.find((r) => r.gateId === 'C');
    expect(toC).toMatchObject({ gateId: 'C', totalCost: 15, hops: 2 }); // 5 (A toll) + 10 (B toll)
  });

  it('respects max hop limit', () => {
    const gates = new Map<string, any>();
    const links = new Map<string, string[]>();
    const ids = 'ABCDEFGHIJKL'.split('');
    for (let i = 0; i < ids.length; i++) {
      gates.set(ids[i], makeGate(ids[i], i * 10, 0, 1));
      const neighbors = [];
      if (i > 0) neighbors.push(ids[i - 1]);
      if (i < ids.length - 1) neighbors.push(ids[i + 1]);
      links.set(ids[i], neighbors);
    }
    const result = findReachableGates('A', gates, links);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.find((r) => r.gateId === 'L')).toBeUndefined();
  });

  it('handles cycles without infinite loops', () => {
    const gates = new Map([
      ['A', makeGate('A', 0, 0, 5)],
      ['B', makeGate('B', 10, 0, 5)],
      ['C', makeGate('C', 10, 10, 5)],
    ]);
    const links = new Map([
      ['A', ['B', 'C']],
      ['B', ['A', 'C']],
      ['C', ['A', 'B']],
    ]);
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(2);
  });

  it('returns empty for gate with no links', () => {
    const gates = new Map([['A', makeGate('A', 0, 0, 5)]]);
    const links = new Map<string, string[]>();
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(0);
  });
});
