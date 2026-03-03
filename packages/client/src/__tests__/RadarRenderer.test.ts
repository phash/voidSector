import { describe, it, expect } from 'vitest';
import { CELL_SIZES, calculateVisibleRadius } from '../canvas/RadarRenderer';

describe('calculateVisibleRadius', () => {
  it('returns larger radius for smaller cells', () => {
    const zoom0 = calculateVisibleRadius(800, 600, 0); // 48x38 cells
    const zoom3 = calculateVisibleRadius(800, 600, 3); // 96x76 cells
    expect(zoom0.radiusX).toBeGreaterThan(zoom3.radiusX);
    expect(zoom0.radiusY).toBeGreaterThan(zoom3.radiusY);
  });

  it('returns at least radius 2 for tiny canvas', () => {
    const r = calculateVisibleRadius(100, 100, 3);
    expect(r.radiusX).toBeGreaterThanOrEqual(2);
    expect(r.radiusY).toBeGreaterThanOrEqual(2);
  });

  it('calculates from canvas size and cell size', () => {
    // (800 - 40) / 80 / 2 = 4.75 → floor = 4 for radiusX
    // (640 - 28) / 64 / 2 = 4.78 → floor = 4 for radiusY
    const r = calculateVisibleRadius(800, 640, 2); // zoom 2 = 80x64
    expect(r.radiusX).toBe(4);
    expect(r.radiusY).toBe(4);
  });

  it('falls back to zoom level 2 for invalid zoom', () => {
    const r = calculateVisibleRadius(800, 640, 99);
    // Falls back to CELL_SIZES[2] = { w: 80, h: 64 }
    // (800 - 40) / 80 / 2 = 4.75 → floor = 4
    expect(r.radiusX).toBe(4);
    expect(r.radiusY).toBe(4);
  });

  it('exports CELL_SIZES with all 4 zoom levels', () => {
    expect(CELL_SIZES).toHaveLength(4);
    expect(CELL_SIZES[0].w).toBe(48);
    expect(CELL_SIZES[3].w).toBe(96);
  });
});
