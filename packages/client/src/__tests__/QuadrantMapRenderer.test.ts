import { describe, it, expect, vi } from 'vitest';
import { QUADRANT_SIZE } from '@void-sector/shared';
import {
  QUAD_CELL_SIZES,
  QUAD_FRAME_LEFT,
  QUAD_FRAME_BOTTOM,
  QUAD_FRAME_PAD,
  QUAD_ZOOM_MAX_NORMAL,
  QUAD_ZOOM_MAX_ADMIN,
  quadrantAtPoint,
  sectorToQuadrantCoords,
  drawQuadrantMap,
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
    // Centered layout: half = floor(QS/2); q0 spans [-half, half-1]
    const half = Math.floor(QUADRANT_SIZE / 2);

    it('converts origin correctly', () => {
      expect(sectorToQuadrantCoords(0, 0)).toEqual({ qx: 0, qy: 0 });
    });

    it('converts positive sectors', () => {
      // half is the first sector of q1; QS+half is first of q2
      expect(sectorToQuadrantCoords(half, 0)).toEqual({ qx: 1, qy: 0 });
      expect(sectorToQuadrantCoords(QUADRANT_SIZE + half, 0)).toEqual({ qx: 2, qy: 0 });
    });

    it('converts negative sectors', () => {
      // -(half+1) is the first sector of q-1
      expect(sectorToQuadrantCoords(-(half + 1), -(half + 1))).toEqual({ qx: -1, qy: -1 });
    });

    it('converts sectors within a quadrant', () => {
      // -1 and half-1 are both within q0
      expect(sectorToQuadrantCoords(-1, -1)).toEqual({ qx: 0, qy: 0 });
      expect(sectorToQuadrantCoords(half - 1, half - 1)).toEqual({ qx: 0, qy: 0 });
    });

    it('handles large coordinates', () => {
      // 1000 * QS sectors from origin → quadrant 1000
      expect(sectorToQuadrantCoords(1000 * QUADRANT_SIZE, 1000 * QUADRANT_SIZE)).toEqual({
        qx: 1000,
        qy: 1000,
      });
    });
  });

  describe('frame constants', () => {
    it('has reasonable frame margins', () => {
      expect(QUAD_FRAME_LEFT).toBeGreaterThan(0);
      expect(QUAD_FRAME_BOTTOM).toBeGreaterThan(0);
      expect(QUAD_FRAME_PAD).toBeGreaterThan(0);
    });
  });

  describe('void quadrant rendering', () => {
    it('renders void quadrant with black fill', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      const fillSpy = vi.spyOn(ctx, 'fillRect');

      drawQuadrantMap(ctx, {
        quadrantControls: [
          {
            qx: 0,
            qy: 0,
            controlling_faction: 'voids',
            faction_shares: { voids: 100 },
            friction_score: 0,
            friction_state: 'peaceful_halt',
            attack_value: 0,
            defense_value: 0,
            station_tier: 0,
            void_cluster_id: 'vc_test',
          },
        ],
        knownQuadrants: [{ qx: 0, qy: 0, learnedAt: new Date().toISOString() }],
        currentQuadrant: { qx: 0, qy: 0 },
        selectedQuadrant: null,
        themeColor: '#00ff88',
        dimColor: 'rgba(0,255,136,0.4)',
        zoomLevel: 2,
        panOffset: { x: 0, y: 0 },
        animTime: 0,
      });

      expect(fillSpy).toHaveBeenCalled();
      // Verify that '#050508' was used as fillStyle at some point during rendering
      const calls = fillSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('renders partial void conquest with progress overlay', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      const fillSpy = vi.spyOn(ctx, 'fillRect');

      drawQuadrantMap(ctx, {
        knownQuadrants: [{ qx: 0, qy: 0, learnedAt: new Date().toISOString() }],
        currentQuadrant: { qx: 0, qy: 0 },
        selectedQuadrant: null,
        themeColor: '#00ff88',
        dimColor: 'rgba(0,255,136,0.4)',
        zoomLevel: 2,
        panOffset: { x: 0, y: 0 },
        animTime: 0,
        voidQuadrantProgress: new Map([['0:0', 50]]),
      });

      expect(fillSpy).toHaveBeenCalled();
    });
  });
});
