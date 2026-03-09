import { QUADRANT_SIZE } from '@void-sector/shared';
import type { JumpGateMapEntry, QuadrantControlState, NpcFleetState } from '@void-sector/shared';
import { drawQuadrantJumpGateLines } from './jumpGateOverlay';

export interface QuadrantMapState {
  knownQuadrants: Array<{
    qx: number;
    qy: number;
    learnedAt: string;
    name?: string;
    discoveredByName?: string;
  }>;
  currentQuadrant: { qx: number; qy: number } | null;
  selectedQuadrant: { qx: number; qy: number } | null;
  themeColor: string;
  dimColor: string;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  animTime: number;
  knownJumpGates?: JumpGateMapEntry[];
  /** Map of quadrantKey ("qx:qy") → faction hex color. Optional — renders when present */
  factionTerritoryColors?: Map<string, string>;
  /** Expansion warfare: quadrant control state per quadrant */
  quadrantControls?: QuadrantControlState[];
  /** Expansion warfare: NPC fleets in transit */
  npcFleets?: NpcFleetState[];
}

// ─── Expansion Warfare Overlay Helpers ───────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  human: 'rgba(64, 128, 255, 0.30)',
  kthari: 'rgba(255, 68, 68, 0.30)',
  silent_swarm: 'rgba(255, 136, 68, 0.30)',
  archivists: 'rgba(136, 255, 204, 0.30)',
  consortium: 'rgba(255, 170, 68, 0.30)',
  mycelians: 'rgba(68, 255, 136, 0.30)',
  mirror_minds: 'rgba(204, 136, 255, 0.30)',
  tourist_guild: 'rgba(255, 255, 68, 0.30)',
};

function getOverlayColor(qx: number, qy: number, controls: QuadrantControlState[]): string | null {
  const ctrl = controls.find((c) => c.qx === qx && c.qy === qy);
  if (!ctrl) return null;
  return FACTION_COLORS[ctrl.controlling_faction] ?? 'rgba(128,128,128,0.2)';
}

function getFrictionGlowColor(ctrl: QuadrantControlState): string | null {
  if (ctrl.friction_score < 50) return null;
  if (ctrl.friction_score >= 71) return 'rgba(255,68,68,0.75)';
  return 'rgba(255,165,0,0.55)';
}

// Cell sizes per zoom level
export const QUAD_CELL_SIZES = [
  { w: 8, h: 8 }, // zoom 0: overview (1 pixel per quadrant)
  { w: 16, h: 16 }, // zoom 1
  { w: 32, h: 32 }, // zoom 2
  { w: 48, h: 48 }, // zoom 3: detail
  { w: 128, h: 128 }, // zoom 4: admin 250× (single-quadrant focus)
  { w: 512, h: 512 }, // zoom 5: admin 1000× (single-quadrant fills canvas)
];

/** Maximum zoom index for regular (non-admin) users */
export const QUAD_ZOOM_MAX_NORMAL = 3;
/** Maximum zoom index for admin users */
export const QUAD_ZOOM_MAX_ADMIN = 5;

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
  const knownSet = new Map<string, { learnedAt: string; name?: string }>();
  for (const q of state.knownQuadrants) {
    knownSet.set(`${q.qx}:${q.qy}`, { learnedAt: q.learnedAt, name: q.name });
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
      const knownEntry = knownSet.get(key);
      const isKnown = knownEntry !== undefined;
      const quadrantName = knownEntry?.name;
      const isCurrent =
        state.currentQuadrant !== null &&
        qx === state.currentQuadrant.qx &&
        qy === state.currentQuadrant.qy;
      const isSelected =
        state.selectedQuadrant !== null &&
        qx === state.selectedQuadrant.qx &&
        qy === state.selectedQuadrant.qy;

      // Faction territory color underlay (if faction data is available)
      const factionColor = state.factionTerritoryColors?.get(key);
      if (factionColor) {
        ctx.fillStyle = factionColor + '22'; // 13% opacity tint
        ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
      }

      // Expansion warfare: controlling faction color overlay
      const controls = state.quadrantControls;
      const ctrl = controls?.find((c) => c.qx === qx && c.qy === qy) ?? null;
      if (ctrl) {
        const overlayColor = getOverlayColor(qx, qy, controls!);
        if (overlayColor) {
          ctx.fillStyle = overlayColor;
          ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
        }
      }

      // Cell background
      if (isKnown) {
        // Known quadrant: green tinted fill (layered over faction tint)
        ctx.fillStyle = isCurrent ? 'rgba(0, 255, 136, 0.25)' : 'rgba(0, 255, 136, 0.08)';
        ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
      }

      // Cell border
      ctx.strokeStyle = isKnown
        ? state.dimColor.replace(/[\d.]+\)$/, '0.4)')
        : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);

      // Expansion warfare: friction glow border
      if (ctrl) {
        const glowColor = getFrictionGlowColor(ctrl);
        if (glowColor) {
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = ctrl.friction_score >= 71 ? 2.5 : 1.5;
          ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
        }
      }

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
        // Show ★ prefix if quadrant has a name
        const coordLabel = quadrantName ? `★ ${qx},${qy}` : `${qx},${qy}`;
        ctx.fillText(coordLabel, cellX, cellY - (quadrantName ? CELL_H * 0.15 : 0));
        // Show short name below coordinates at zoom 3
        if (quadrantName && state.zoomLevel >= 3) {
          const nameFont = `${Math.max(6, CELL_W * 0.25)}px 'Share Tech Mono', 'Courier New', monospace`;
          ctx.font = nameFont;
          ctx.fillStyle = isCurrent ? state.themeColor : 'rgba(0,255,136,0.6)';
          const shortName = quadrantName.length > 8 ? quadrantName.slice(0, 7) + '…' : quadrantName;
          ctx.fillText(shortName, cellX, cellY + CELL_H * 0.2);
        }
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

      // Expansion warfare: conflict icons (at zoom >= 1)
      if (state.zoomLevel >= 1) {
        const iconFontSize = Math.max(6, CELL_W * 0.35);
        ctx.font = `${iconFontSize}px 'Share Tech Mono', 'Courier New', monospace`;

        // Total war icon ⚔ (top-right corner)
        if (ctrl?.friction_state === 'total_war') {
          ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillText('\u2694', cellX + CELL_W / 2 - 1, cellY - CELL_H / 2 + 1);
        }

        // Incoming fleet indicator ▶ (bottom-right corner)
        const hasFleet = state.npcFleets?.some((f) => f.to_qx === qx && f.to_qy === qy) ?? false;
        if (hasFleet) {
          ctx.fillStyle = 'rgba(180, 180, 180, 0.75)';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText('\u25BA', cellX + CELL_W / 2 - 1, cellY + CELL_H / 2 - 1);
        }
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
  const ZOOM_LABELS = ['5×', '10×', '25×', '50×', '250×', '1000×'];
  const zoomLabel = ZOOM_LABELS[state.zoomLevel] ?? `${state.zoomLevel}`;
  ctx.font = `10px 'Share Tech Mono', 'Courier New', monospace`;
  ctx.fillStyle = state.dimColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `QUADRANT MAP  [${state.knownQuadrants.length} KNOWN]  ZOOM:${zoomLabel}`,
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
