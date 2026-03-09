import { describe, it, expect } from 'vitest';
import {
  QUAD_CELL_SIZES,
  QUAD_FRAME_LEFT,
  QUAD_FRAME_BOTTOM,
  QUAD_FRAME_PAD,
  QUAD_ZOOM_MAX_NORMAL,
  QUAD_ZOOM_MAX_ADMIN,
  quadrantAtPoint,
  sectorToQuadrantCoords,
} from '../canvas/QuadrantMapRenderer';

describe('QuadrantMapRenderer', () => {
  describe('QUAD_CELL_SIZES', () => {
    it('exports 6 zoom levels (4 normal + 2 admin deep-zoom)', () => {
      expect(QUAD_CELL_SIZES).toHaveLength(6);
    });

    it('zoom 0 has smallest cells', () => {
      expect(QUAD_CELL_SIZES[0].w).toBe(8);
      expect(QUAD_CELL_SIZES[0].h).toBe(8);
    });

    it('zoom 3 is the last normal zoom level (48px)', () => {
      expect(QUAD_CELL_SIZES[3].w).toBe(48);
      expect(QUAD_CELL_SIZES[3].h).toBe(48);
    });

    it('zoom 4 is admin 250× deep-zoom (128px)', () => {
      expect(QUAD_CELL_SIZES[4].w).toBe(128);
      expect(QUAD_CELL_SIZES[4].h).toBe(128);
    });

    it('zoom 5 is admin 1000× deep-zoom (512px)', () => {
      expect(QUAD_CELL_SIZES[5].w).toBe(512);
      expect(QUAD_CELL_SIZES[5].h).toBe(512);
    });

    it('QUAD_ZOOM_MAX_NORMAL is 3', () => {
      expect(QUAD_ZOOM_MAX_NORMAL).toBe(3);
    });

    it('QUAD_ZOOM_MAX_ADMIN is 5', () => {
      expect(QUAD_ZOOM_MAX_ADMIN).toBe(5);
    });

    it('cell sizes increase with zoom level', () => {
      for (let i = 1; i < QUAD_CELL_SIZES.length; i++) {
        expect(QUAD_CELL_SIZES[i].w).toBeGreaterThan(QUAD_CELL_SIZES[i - 1].w);
        expect(QUAD_CELL_SIZES[i].h).toBeGreaterThan(QUAD_CELL_SIZES[i - 1].h);
      }
    });
  });

  describe('quadrantAtPoint', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;

    it('returns current quadrant when clicking center', () => {
      const result = quadrantAtPoint(
        canvasWidth,
        canvasHeight,
        QUAD_FRAME_LEFT + (canvasWidth - QUAD_FRAME_LEFT - QUAD_FRAME_PAD) / 2,
        QUAD_FRAME_PAD + (canvasHeight - QUAD_FRAME_PAD - QUAD_FRAME_BOTTOM) / 2,
        { currentQuadrant: { qx: 5, qy: 3 }, panOffset: { x: 0, y: 0 }, zoomLevel: 1 },
      );
      expect(result).toEqual({ qx: 5, qy: 3 });
    });

    it('offsets by pan offset', () => {
      const result = quadrantAtPoint(
        canvasWidth,
        canvasHeight,
        QUAD_FRAME_LEFT + (canvasWidth - QUAD_FRAME_LEFT - QUAD_FRAME_PAD) / 2,
        QUAD_FRAME_PAD + (canvasHeight - QUAD_FRAME_PAD - QUAD_FRAME_BOTTOM) / 2,
        { currentQuadrant: { qx: 0, qy: 0 }, panOffset: { x: 2, y: 3 }, zoomLevel: 1 },
      );
      expect(result).toEqual({ qx: 2, qy: 3 });
    });

    it('returns null quadrant coords when no current quadrant', () => {
      const result = quadrantAtPoint(
        canvasWidth,
        canvasHeight,
        QUAD_FRAME_LEFT + (canvasWidth - QUAD_FRAME_LEFT - QUAD_FRAME_PAD) / 2,
        QUAD_FRAME_PAD + (canvasHeight - QUAD_FRAME_PAD - QUAD_FRAME_BOTTOM) / 2,
        { currentQuadrant: null, panOffset: { x: 0, y: 0 }, zoomLevel: 1 },
      );
      expect(result).toEqual({ qx: 0, qy: 0 });
    });

    it('calculates offset from center for right click', () => {
      const cellW = QUAD_CELL_SIZES[1].w; // 16
      const gridCenterX = QUAD_FRAME_LEFT + (canvasWidth - QUAD_FRAME_LEFT - QUAD_FRAME_PAD) / 2;
      const gridCenterY = QUAD_FRAME_PAD + (canvasHeight - QUAD_FRAME_PAD - QUAD_FRAME_BOTTOM) / 2;

      // Click one cell to the right
      const result = quadrantAtPoint(canvasWidth, canvasHeight, gridCenterX + cellW, gridCenterY, {
        currentQuadrant: { qx: 0, qy: 0 },
        panOffset: { x: 0, y: 0 },
        zoomLevel: 1,
      });
      expect(result).toEqual({ qx: 1, qy: 0 });
    });

    it('works with different zoom levels', () => {
      const cellW0 = QUAD_CELL_SIZES[0].w; // 8
      const cellW3 = QUAD_CELL_SIZES[3].w; // 48
      const gridCenterX = QUAD_FRAME_LEFT + (canvasWidth - QUAD_FRAME_LEFT - QUAD_FRAME_PAD) / 2;
      const gridCenterY = QUAD_FRAME_PAD + (canvasHeight - QUAD_FRAME_PAD - QUAD_FRAME_BOTTOM) / 2;

      // Same pixel offset, different zoom = different quadrant
      const result0 = quadrantAtPoint(canvasWidth, canvasHeight, gridCenterX + 50, gridCenterY, {
        currentQuadrant: { qx: 0, qy: 0 },
        panOffset: { x: 0, y: 0 },
        zoomLevel: 0,
      });
      const result3 = quadrantAtPoint(canvasWidth, canvasHeight, gridCenterX + 50, gridCenterY, {
        currentQuadrant: { qx: 0, qy: 0 },
        panOffset: { x: 0, y: 0 },
        zoomLevel: 3,
      });
      // At zoom 0 (8px cells), 50px = ~6 cells. At zoom 3 (48px cells), 50px = ~1 cell
      expect(result0!.qx).toBeGreaterThan(result3!.qx);
    });
  });

  describe('sectorToQuadrantCoords', () => {
    it('converts origin correctly', () => {
      expect(sectorToQuadrantCoords(0, 0)).toEqual({ qx: 0, qy: 0 });
    });

    it('converts positive sectors', () => {
      // QUADRANT_SIZE is 10000
      expect(sectorToQuadrantCoords(10000, 20000)).toEqual({ qx: 1, qy: 2 });
    });

    it('converts negative sectors', () => {
      expect(sectorToQuadrantCoords(-1, -1)).toEqual({ qx: -1, qy: -1 });
    });

    it('converts sectors within a quadrant', () => {
      expect(sectorToQuadrantCoords(5000, 5000)).toEqual({ qx: 0, qy: 0 });
      expect(sectorToQuadrantCoords(9999, 9999)).toEqual({ qx: 0, qy: 0 });
    });

    it('handles large coordinates', () => {
      expect(sectorToQuadrantCoords(10_000_000, 10_000_000)).toEqual({ qx: 1000, qy: 1000 });
    });
  });

  describe('frame constants', () => {
    it('has reasonable frame margins', () => {
      expect(QUAD_FRAME_LEFT).toBeGreaterThan(0);
      expect(QUAD_FRAME_BOTTOM).toBeGreaterThan(0);
      expect(QUAD_FRAME_PAD).toBeGreaterThan(0);
    });
  });
});
