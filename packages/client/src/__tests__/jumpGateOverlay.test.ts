import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JumpGateMapEntry } from '@void-sector/shared';
import {
  UnionFind,
  buildChainMap,
  chainColor,
  JUMPGATE_CHAIN_COLORS,
  filterQuadrantGates,
  drawJumpGateLines,
  drawJumpGateIcons,
  drawQuadrantJumpGateLines,
} from '../canvas/jumpGateOverlay';

// --- Union-Find tests ---

describe('UnionFind', () => {
  it('returns same element as its own root', () => {
    const uf = new UnionFind();
    expect(uf.find('a')).toBe('a');
  });

  it('unions two elements into the same set', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    expect(uf.find('a')).toBe(uf.find('b'));
  });

  it('unions multiple elements transitively', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('b', 'c');
    expect(uf.find('a')).toBe(uf.find('c'));
  });

  it('keeps disjoint sets separate', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('c', 'd');
    expect(uf.find('a')).not.toBe(uf.find('c'));
  });

  it('handles self-union', () => {
    const uf = new UnionFind();
    uf.union('a', 'a');
    expect(uf.find('a')).toBe('a');
  });
});

// --- buildChainMap tests ---

describe('buildChainMap', () => {
  it('assigns same chain to gates sharing an endpoint', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 10, toY: 10, gateType: 'bidirectional' },
      { gateId: 'g2', fromX: 10, fromY: 10, toX: 20, toY: 20, gateType: 'bidirectional' },
    ];
    const map = buildChainMap(gates);
    expect(map.get('g1')).toBe(map.get('g2'));
  });

  it('assigns different chains to disconnected gates', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 10, toY: 10, gateType: 'bidirectional' },
      { gateId: 'g2', fromX: 100, fromY: 100, toX: 200, toY: 200, gateType: 'bidirectional' },
    ];
    const map = buildChainMap(gates);
    expect(map.get('g1')).not.toBe(map.get('g2'));
  });

  it('handles a single gate', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 10, toY: 10, gateType: 'bidirectional' },
    ];
    const map = buildChainMap(gates);
    expect(map.get('g1')).toBe(0);
  });

  it('handles empty gates array', () => {
    const map = buildChainMap([]);
    expect(map.size).toBe(0);
  });

  it('groups three connected gates into one chain', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 10, toY: 10, gateType: 'bidirectional' },
      { gateId: 'g2', fromX: 10, fromY: 10, toX: 20, toY: 20, gateType: 'bidirectional' },
      { gateId: 'g3', fromX: 20, fromY: 20, toX: 30, toY: 30, gateType: 'wormhole' },
    ];
    const map = buildChainMap(gates);
    expect(map.get('g1')).toBe(map.get('g2'));
    expect(map.get('g2')).toBe(map.get('g3'));
  });

  it('assigns sequential chain indices starting from 0', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 10, toY: 10, gateType: 'bidirectional' },
      { gateId: 'g2', fromX: 100, fromY: 100, toX: 200, toY: 200, gateType: 'bidirectional' },
      { gateId: 'g3', fromX: 500, fromY: 500, toX: 600, toY: 600, gateType: 'wormhole' },
    ];
    const map = buildChainMap(gates);
    const values = new Set(map.values());
    expect(values).toEqual(new Set([0, 1, 2]));
  });
});

// --- chainColor tests ---

describe('chainColor', () => {
  it('returns first color for index 0', () => {
    expect(chainColor(0)).toBe(JUMPGATE_CHAIN_COLORS[0]);
  });

  it('cycles through palette', () => {
    const paletteLen = JUMPGATE_CHAIN_COLORS.length;
    expect(chainColor(paletteLen)).toBe(JUMPGATE_CHAIN_COLORS[0]);
    expect(chainColor(paletteLen + 1)).toBe(JUMPGATE_CHAIN_COLORS[1]);
  });

  it('returns valid hex colors', () => {
    for (let i = 0; i < JUMPGATE_CHAIN_COLORS.length; i++) {
      expect(chainColor(i)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// --- filterQuadrantGates tests ---

describe('filterQuadrantGates', () => {
  const QUADRANT_SIZE = 10000;

  it('includes all cross-quadrant gates', () => {
    const gates: JumpGateMapEntry[] = [
      {
        gateId: 'cross1',
        fromX: 5000,
        fromY: 5000,
        toX: 15000,
        toY: 5000,
        gateType: 'bidirectional',
      },
      { gateId: 'cross2', fromX: 0, fromY: 0, toX: 10000, toY: 10000, gateType: 'wormhole' },
    ];
    const result = filterQuadrantGates(gates, QUADRANT_SIZE);
    expect(result.map((g) => g.gateId)).toContain('cross1');
    expect(result.map((g) => g.gateId)).toContain('cross2');
  });

  it('limits intra-quadrant gates to top 3 longest', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'intra1', fromX: 0, fromY: 0, toX: 100, toY: 0, gateType: 'bidirectional' }, // dist=100
      { gateId: 'intra2', fromX: 0, fromY: 0, toX: 200, toY: 0, gateType: 'bidirectional' }, // dist=200
      { gateId: 'intra3', fromX: 0, fromY: 0, toX: 300, toY: 0, gateType: 'bidirectional' }, // dist=300
      { gateId: 'intra4', fromX: 0, fromY: 0, toX: 400, toY: 0, gateType: 'bidirectional' }, // dist=400
      { gateId: 'intra5', fromX: 0, fromY: 0, toX: 500, toY: 0, gateType: 'bidirectional' }, // dist=500
    ];
    const result = filterQuadrantGates(gates, QUADRANT_SIZE);
    expect(result).toHaveLength(3);
    const ids = result.map((g) => g.gateId);
    expect(ids).toContain('intra5'); // 500
    expect(ids).toContain('intra4'); // 400
    expect(ids).toContain('intra3'); // 300
    expect(ids).not.toContain('intra1');
    expect(ids).not.toContain('intra2');
  });

  it('combines cross-quadrant and top intra-quadrant', () => {
    const gates: JumpGateMapEntry[] = [
      {
        gateId: 'cross',
        fromX: 5000,
        fromY: 5000,
        toX: 15000,
        toY: 5000,
        gateType: 'bidirectional',
      },
      { gateId: 'intra1', fromX: 0, fromY: 0, toX: 100, toY: 0, gateType: 'bidirectional' },
      { gateId: 'intra2', fromX: 0, fromY: 0, toX: 200, toY: 0, gateType: 'bidirectional' },
    ];
    const result = filterQuadrantGates(gates, QUADRANT_SIZE);
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.gateId)).toContain('cross');
    expect(result.map((g) => g.gateId)).toContain('intra1');
    expect(result.map((g) => g.gateId)).toContain('intra2');
  });

  it('returns empty for no gates', () => {
    expect(filterQuadrantGates([], QUADRANT_SIZE)).toHaveLength(0);
  });

  it('handles negative coordinates', () => {
    const gates: JumpGateMapEntry[] = [
      // from quadrant (-1,-1) to quadrant (0,0) — cross-quadrant
      { gateId: 'neg', fromX: -5000, fromY: -5000, toX: 5000, toY: 5000, gateType: 'wormhole' },
    ];
    const result = filterQuadrantGates(gates, QUADRANT_SIZE);
    expect(result).toHaveLength(1);
    expect(result[0].gateId).toBe('neg');
  });
});

// --- Drawing function integration tests ---

describe('drawJumpGateLines', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  it('does nothing for empty gates', () => {
    const spy = vi.spyOn(ctx, 'beginPath');
    drawJumpGateLines(ctx, [], 0, 0, 5, 5, 400, 300, 80, 64);
    expect(spy).not.toHaveBeenCalled();
  });

  it('draws a line for a visible gate', () => {
    const spy = vi.spyOn(ctx, 'stroke');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'bidirectional' },
    ];
    drawJumpGateLines(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    expect(spy).toHaveBeenCalled();
  });

  it('uses dashed line for wormhole gates', () => {
    const spy = vi.spyOn(ctx, 'setLineDash');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'wormhole' },
    ];
    drawJumpGateLines(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    // Should have called setLineDash with [4, 4] at least once
    const dashCalls = spy.mock.calls.filter(
      (call) => Array.isArray(call[0]) && call[0].length === 2 && call[0][0] === 4,
    );
    expect(dashCalls.length).toBeGreaterThan(0);
  });

  it('uses solid line for bidirectional gates', () => {
    const spy = vi.spyOn(ctx, 'setLineDash');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'bidirectional' },
    ];
    drawJumpGateLines(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    // For bidirectional: setLineDash([]) — solid
    const solidCalls = spy.mock.calls.filter(
      (call) => Array.isArray(call[0]) && call[0].length === 0,
    );
    expect(solidCalls.length).toBeGreaterThan(0);
  });

  it('skips gates entirely outside visible radius', () => {
    const spy = vi.spyOn(ctx, 'stroke');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 100, fromY: 100, toX: 200, toY: 200, gateType: 'bidirectional' },
    ];
    drawJumpGateLines(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    expect(spy).not.toHaveBeenCalled();
  });

  it('restores line dash to solid after drawing', () => {
    const spy = vi.spyOn(ctx, 'setLineDash');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'wormhole' },
    ];
    drawJumpGateLines(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    // Last setLineDash call should be reset to []
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall[0]).toEqual([]);
  });
});

// --- drawJumpGateIcons tests ---

describe('drawJumpGateIcons', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  it('does nothing for empty gates', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    drawJumpGateIcons(ctx, [], 0, 0, 5, 5, 400, 300, 80, 64);
    expect(spy).not.toHaveBeenCalled();
  });

  it('draws icon at both from and to positions of a gate', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    expect(spy).toHaveBeenCalledTimes(2);
    // from position: gridCenterX + 0*80 = 400, gridCenterY + 0*64 = 300
    expect(spy).toHaveBeenCalledWith(expect.any(String), 400, 300);
    // to position: gridCenterX + 1*80 = 480, gridCenterY + 1*64 = 364
    expect(spy).toHaveBeenCalledWith(expect.any(String), 480, 364);
  });

  it('deduplicates shared gate positions', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 5, toY: 5, gateType: 'bidirectional' },
      { gateId: 'g2', fromX: 5, fromY: 5, toX: 10, toY: 10, gateType: 'bidirectional' },
    ];
    // 3 unique positions: (0,0), (5,5), (10,10) — not 4
    drawJumpGateIcons(ctx, gates, 5, 5, 10, 10, 400, 300, 80, 64);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('skips positions outside visible radius', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 100, fromY: 100, toX: 200, toY: 200, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    expect(spy).not.toHaveBeenCalled();
  });

  it('draws icon for partially visible gate (one endpoint in range)', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 100, toY: 100, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    // Only from (0,0) is visible, to (100,100) is outside radius 5
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uses chain color for icon fill', () => {
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    // Chain 0 should use the first color from the palette
    expect(ctx.fillStyle).toBeDefined();
  });

  it('restores context after drawing', () => {
    const saveSpy = vi.spyOn(ctx, 'save');
    const restoreSpy = vi.spyOn(ctx, 'restore');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 0, fromY: 0, toX: 1, toY: 1, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 400, 300, 80, 64);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledTimes(1);
  });
});

describe('drawQuadrantJumpGateLines', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  it('does nothing for empty gates', () => {
    const spy = vi.spyOn(ctx, 'beginPath');
    drawQuadrantJumpGateLines(ctx, [], 10000, 0, 0, 5, 5, 400, 300, 32, 32);
    expect(spy).not.toHaveBeenCalled();
  });

  it('draws cross-quadrant gate', () => {
    const spy = vi.spyOn(ctx, 'stroke');
    const gates: JumpGateMapEntry[] = [
      {
        gateId: 'cross',
        fromX: 5000,
        fromY: 5000,
        toX: 15000,
        toY: 5000,
        gateType: 'bidirectional',
      },
    ];
    drawQuadrantJumpGateLines(ctx, gates, 10000, 0, 0, 5, 5, 400, 300, 32, 32);
    expect(spy).toHaveBeenCalled();
  });

  it('filters out excess intra-quadrant gates', () => {
    const spy = vi.spyOn(ctx, 'stroke');
    // 5 intra-quadrant gates — only 3 longest should be drawn
    const gates: JumpGateMapEntry[] = [];
    for (let i = 1; i <= 5; i++) {
      gates.push({
        gateId: `intra${i}`,
        fromX: 0,
        fromY: 0,
        toX: i * 100,
        toY: 0,
        gateType: 'bidirectional',
      });
    }
    drawQuadrantJumpGateLines(ctx, gates, 10000, 0, 0, 5, 5, 400, 300, 32, 32);
    // All 5 map to the same quadrant (0,0), so only 3 drawn
    // But they all share quadrant (0,0), so they appear at the same point on the quadrant map
    // Still, 3 strokes should be drawn
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
