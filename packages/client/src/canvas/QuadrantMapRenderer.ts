import { QUADRANT_SIZE } from '@void-sector/shared';
import type { JumpGateMapEntry } from '@void-sector/shared';
import { drawQuadrantJumpGateLines } from './jumpGateOverlay';

export interface QuadrantMapState {
  knownQuadrants: Array<{ qx: number; qy: number; learnedAt: string }>;
  currentQuadrant: { qx: number; qy: number } | null;
  selectedQuadrant: { qx: number; qy: number } | null;
  themeColor: string;
  dimColor: string;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  animTime: number;
  knownJumpGates?: JumpGateMapEntry[];
}

// Cell sizes per zoom level
export const QUAD_CELL_SIZES = [
  { w: 8, h: 8 }, // zoom 0: overview (1 pixel per quadrant)
  { w: 16, h: 16 }, // zoom 1
  { w: 32, h: 32 }, // zoom 2
  { w: 48, h: 48 }, // zoom 3: detail
];

export const QUAD_FRAME_LEFT = 48;
export const QUAD_FRAME_BOTTOM = 24;
export const QUAD_FRAME_PAD = 8;

export function drawQuadrantMap(ctx: CanvasRenderingContext2D, state: QuadrantMapState) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;

  // Clear
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const cellEntry = QUAD_CELL_SIZES[state.zoomLevel] ?? QUAD_CELL_SIZES[1];
  const { w: CELL_W, h: CELL_H } = cellEntry;

  // Grid area bounded
  const gridLeft = QUAD_FRAME_LEFT;
  const gridTop = QUAD_FRAME_PAD;
  const gridRight = w - QUAD_FRAME_PAD;
  const gridBottom = h - QUAD_FRAME_BOTTOM;
  const gridW = gridRight - gridLeft;
  const gridH = gridBottom - gridTop;

  // How many cells fit
  const visibleCols = Math.max(1, Math.floor(gridW / CELL_W));
  const visibleRows = Math.max(1, Math.floor(gridH / CELL_H));
  const radiusX = Math.floor(visibleCols / 2);
  const radiusY = Math.floor(visibleRows / 2);

  // Grid center
  const gridCenterX = gridLeft + gridW / 2;
  const gridCenterY = gridTop + gridH / 2;

  // View center: current quadrant + pan
  const viewQx = (state.currentQuadrant?.qx ?? 0) + state.panOffset.x;
  const viewQy = (state.currentQuadrant?.qy ?? 0) + state.panOffset.y;

  // Build lookup set for known quadrants
  const knownSet = new Map<string, string>();
  for (const q of state.knownQuadrants) {
    knownSet.set(`${q.qx}:${q.qy}`, q.learnedAt);
  }

  const FONT = `${Math.max(8, CELL_W * 0.6)}px 'Share Tech Mono', 'Courier New', monospace`;
  const COORD_FONT = `${Math.max(7, CELL_W * 0.4)}px 'Share Tech Mono', 'Courier New', monospace`;

  // Draw cells
  for (let dx = -radiusX; dx <= radiusX; dx++) {
    for (let dy = -radiusY; dy <= radiusY; dy++) {
      const qx = viewQx + dx;
      const qy = viewQy + dy;
      const cellX = gridCenterX + dx * CELL_W;
      const cellY = gridCenterY + dy * CELL_H;
      const key = `${qx}:${qy}`;
      const isKnown = knownSet.has(key);
      const isCurrent =
        state.currentQuadrant !== null &&
        qx === state.currentQuadrant.qx &&
        qy === state.currentQuadrant.qy;
      const isSelected =
        state.selectedQuadrant !== null &&
        qx === state.selectedQuadrant.qx &&
        qy === state.selectedQuadrant.qy;

      // Cell background
      if (isKnown) {
        // Known quadrant: green tinted fill
        ctx.fillStyle = isCurrent ? 'rgba(0, 255, 136, 0.25)' : 'rgba(0, 255, 136, 0.08)';
        ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
      }

      // Cell border
      ctx.strokeStyle = isKnown
        ? state.dimColor.replace(/[\d.]+\)$/, '0.4)')
        : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);

      // Current quadrant pulsing border
      if (isCurrent) {
        const pulse = 0.6 + 0.4 * Math.sin(state.animTime / 400);
        const alpha = Math.round(pulse * 255)
          .toString(16)
          .padStart(2, '0');
        ctx.strokeStyle = state.themeColor + alpha;
        ctx.lineWidth = 2 + pulse;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Selected quadrant highlight
      if (isSelected && !isCurrent) {
        ctx.strokeStyle = state.themeColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Draw content for known quadrants at higher zoom
      if (isKnown && state.zoomLevel >= 2) {
        ctx.font = COORD_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isCurrent ? state.themeColor : '#00FF88';
        ctx.fillText(`${qx},${qy}`, cellX, cellY);
      } else if (isKnown && state.zoomLevel >= 1) {
        // Just a dot at zoom 1
        ctx.fillStyle = isCurrent ? state.themeColor : '#00FF88';
        ctx.beginPath();
        ctx.arc(cellX, cellY, Math.max(2, CELL_W * 0.2), 0, Math.PI * 2);
        ctx.fill();
      } else if (isKnown) {
        // Zoom 0: single pixel
        ctx.fillStyle = isCurrent ? state.themeColor : '#00FF88';
        ctx.fillRect(cellX - 1, cellY - 1, 3, 3);
      }

      // Fog-of-war symbol for unknown quadrants at higher zoom
      if (!isKnown && state.zoomLevel >= 2) {
        ctx.font = COORD_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillText('?', cellX, cellY);
      }
    }
  }

  // --- JumpGate connection lines ---
  if (state.knownJumpGates && state.knownJumpGates.length > 0) {
    drawQuadrantJumpGateLines(
      ctx,
      state.knownJumpGates,
      QUADRANT_SIZE,
      viewQx,
      viewQy,
      radiusX,
      radiusY,
      gridCenterX,
      gridCenterY,
      CELL_W,
      CELL_H,
    );
  }

  // --- Coordinate frame ---
  const totalCellsW = (2 * radiusX + 1) * CELL_W;
  const totalCellsH = (2 * radiusY + 1) * CELL_H;
  const frameLeft = gridCenterX - totalCellsW / 2;
  const frameTop = gridCenterY - totalCellsH / 2;
  const frameRight = gridCenterX + totalCellsW / 2;
  const frameBottom = gridCenterY + totalCellsH / 2;

  const frameFontSize = Math.max(7, Math.min(9, CELL_W * 0.5));
  ctx.font = `${frameFontSize}px 'Share Tech Mono', 'Courier New', monospace`;
  ctx.fillStyle = state.dimColor;

  // Row labels (left side) — QY coordinates
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let dy = -radiusY; dy <= radiusY; dy++) {
    const qy = viewQy + dy;
    const cellY = gridCenterY + dy * CELL_H;
    ctx.fillText(String(qy), frameLeft - 6, cellY);
  }

  // Column labels (bottom) — QX coordinates
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let dx = -radiusX; dx <= radiusX; dx++) {
    const qx = viewQx + dx;
    const cellX = gridCenterX + dx * CELL_W;
    ctx.fillText(String(qx), cellX, frameBottom + 4);
  }

  // Frame border
  ctx.strokeStyle = state.dimColor.replace(/[\d.]+\)$/, '0.5)');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(frameLeft - 1, frameTop - 1);
  ctx.lineTo(frameRight + 1, frameTop - 1);
  ctx.lineTo(frameRight + 1, frameBottom + 1);
  ctx.lineTo(frameLeft - 1, frameBottom + 1);
  ctx.closePath();
  ctx.stroke();

  // Header label
  ctx.font = `10px 'Share Tech Mono', 'Courier New', monospace`;
  ctx.fillStyle = state.dimColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `QUADRANT MAP  [${state.knownQuadrants.length} KNOWN]  ZOOM:${state.zoomLevel}`,
    4,
    2,
  );
}

/**
 * Given a click position on the canvas, returns the quadrant coordinates.
 */
export function quadrantAtPoint(
  canvasWidth: number,
  canvasHeight: number,
  clickX: number,
  clickY: number,
  state: Pick<QuadrantMapState, 'currentQuadrant' | 'panOffset' | 'zoomLevel'>,
): { qx: number; qy: number } | null {
  const cellEntry = QUAD_CELL_SIZES[state.zoomLevel] ?? QUAD_CELL_SIZES[1];
  const { w: CELL_W, h: CELL_H } = cellEntry;

  const gridW = canvasWidth - QUAD_FRAME_LEFT - QUAD_FRAME_PAD;
  const gridH = canvasHeight - QUAD_FRAME_PAD - QUAD_FRAME_BOTTOM;
  const gridCenterX = QUAD_FRAME_LEFT + gridW / 2;
  const gridCenterY = QUAD_FRAME_PAD + gridH / 2;

  const dx = Math.round((clickX - gridCenterX) / CELL_W);
  const dy = Math.round((clickY - gridCenterY) / CELL_H);

  const viewQx = (state.currentQuadrant?.qx ?? 0) + state.panOffset.x;
  const viewQy = (state.currentQuadrant?.qy ?? 0) + state.panOffset.y;

  return { qx: viewQx + dx, qy: viewQy + dy };
}

/**
 * Convert sector coordinates to quadrant coordinates.
 */
export function sectorToQuadrantCoords(x: number, y: number): { qx: number; qy: number } {
  return {
    qx: Math.floor(x / QUADRANT_SIZE),
    qy: Math.floor(y / QUADRANT_SIZE),
  };
}
