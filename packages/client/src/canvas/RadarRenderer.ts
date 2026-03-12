import {
  SYMBOLS,
  SECTOR_COLORS,
  STALENESS_DIM_HOURS,
  STALENESS_FADE_DAYS,
  HULL_RADAR_PATTERNS,
  innerCoord,
  getAcepRadarPattern,
  COSMIC_FACTION_COLORS,
} from '@void-sector/shared';
import type {
  SectorData,
  Coords,
  JumpGateInfo,
  JumpGateMapEntry,
  ScanEvent,
  HullType,
  Bookmark,
  Quest,
  CivShip,
} from '@void-sector/shared';
import type { PlayerPresence, TrackedQuest } from '../state/gameSlice';
import type { JumpAnimationState } from './JumpAnimation';
import { drawLongJumpCRTEffect } from './JumpAnimation';
import { drawJumpGateLines, drawJumpGateIcons } from './jumpGateOverlay';

export const BURST_DURATION = 1500;

const BOOKMARK_COLORS: Record<number, string> = {
  0: '#33FF33', // HOME — green
  1: '#FF6644', // Slot 1 — red-orange
  2: '#44AAFF', // Slot 2 — blue
  3: '#FFDD22', // Slot 3 — yellow
  4: '#44FF88', // Slot 4 — teal
  5: '#FF44FF', // Slot 5 — magenta
};

export const CELL_SIZES = [
  { w: 48, h: 38, fontSize: 12, coordSize: 8 },
  { w: 64, h: 50, fontSize: 14, coordSize: 9 },
  { w: 80, h: 64, fontSize: 16, coordSize: 10 },
  { w: 96, h: 76, fontSize: 18, coordSize: 11 },
];

// Coordinate frame margins (exported for click offset calculation)
export const FRAME_LEFT = 40; // space for row numbers (Y coordinates)
export const FRAME_BOTTOM = 24; // space for column numbers (X coordinates)
export const FRAME_PAD = 8; // padding on right/top

export function calculateVisibleRadius(
  canvasW: number,
  canvasH: number,
  zoomLevel: number,
): { radiusX: number; radiusY: number } {
  if (zoomLevel === 4) {
    return { radiusX: 1, radiusY: 1 }; // always 3×3
  }
  const { w, h } = CELL_SIZES[zoomLevel] ?? CELL_SIZES[2];
  const gridW = canvasW - FRAME_LEFT - FRAME_PAD;
  const gridH = canvasH - FRAME_BOTTOM - FRAME_PAD;
  const radiusX = Math.max(2, Math.floor(gridW / w / 2));
  const radiusY = Math.max(2, Math.floor(gridH / h / 2));
  return { radiusX, radiusY };
}

interface RadarState {
  position: Coords;
  discoveries: Record<string, SectorData>;
  players: Record<string, PlayerPresence>;
  currentSector: SectorData | null;
  themeColor: string;
  dimColor: string;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  jumpAnimation?: JumpAnimationState | null;
  selectedSector?: { x: number; y: number } | null;
  jumpGateInfo?: JumpGateInfo | null;
  knownJumpGates?: JumpGateMapEntry[];
  scanEvents?: ScanEvent[];
  discoveryTimestamps?: Record<string, number>;
  hullType?: HullType;
  acepXp?: { ausbau: number; intel: number; kampf: number; explorer: number; total: number } | null;
  homeBase?: { x: number; y: number };
  bookmarks?: Bookmark[];
  animTime?: number;
  scanBurstTimestamps?: Record<string, number>;
  navTarget?: { x: number; y: number } | null;
  visitedTrail?: Coords[];
  shipMoveAnimation?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    startTime: number;
    duration: number;
  } | null;
  activeQuests?: Quest[];
  trackedQuests?: TrackedQuest[];
  miningActive?: boolean;
  civShips?: CivShip[];
  /** Set of "x,y" strings that are void frontier sectors */
  voidFrontierSectors?: Set<string>;
  /** True if the player's current quadrant is fully void */
  quadrantIsVoid?: boolean;
  /** Slow flight path from current position to target — drawn as dashed overlay */
  slowFlightPath?: Array<{ x: number; y: number }>;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  const isDetailView = state.zoomLevel === 4;
  const cellEntry = isDetailView
    ? {
        w: Math.floor((w - FRAME_LEFT - FRAME_PAD) / 3),
        h: Math.floor((h - FRAME_BOTTOM - FRAME_PAD) / 3),
        fontSize: 20,
        coordSize: 10,
      }
    : (CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1]);
  const { w: CELL_W, h: CELL_H, fontSize, coordSize } = cellEntry;
  const FONT = `${fontSize}px 'Share Tech Mono', 'Courier New', monospace`;
  const COORD_FONT = `${coordSize}px 'Share Tech Mono', 'Courier New', monospace`;

  // Build bookmark lookup: "x,y" → slot number
  const bookmarkMap = new Map<string, number>();
  for (const bm of state.bookmarks ?? []) {
    bookmarkMap.set(`${bm.sectorX},${bm.sectorY}`, bm.slot);
  }

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, h);

  // Grid area bounded to ~80% of canvas
  const gridLeft = FRAME_LEFT;
  const gridTop = FRAME_PAD;
  const gridRight = w - FRAME_PAD;
  const gridBottom = h - FRAME_BOTTOM;
  const gridW = gridRight - gridLeft;
  const gridH = gridBottom - gridTop;

  // Recalculate visible cells based on grid area
  const visibleCols = Math.max(1, Math.floor(gridW / CELL_W));
  const visibleRows = Math.max(1, Math.floor(gridH / CELL_H));
  const radiusX = Math.floor(visibleCols / 2);
  const radiusY = Math.floor(visibleRows / 2);

  // Grid center within bounded area
  const gridCenterX = gridLeft + gridW / 2;
  const gridCenterY = gridTop + gridH / 2;

  const viewX = state.position.x + state.panOffset.x;
  const viewY = state.position.y + state.panOffset.y;

  const anim = state.jumpAnimation;
  const animActive = anim && anim.active;

  // Apply slide translate during slide phase
  const slideActive = animActive && anim.phase === 'slide';
  if (slideActive) {
    ctx.save();
    const slideX = anim.direction.dx * anim.progress * CELL_W;
    const slideY = anim.direction.dy * anim.progress * CELL_H;
    ctx.translate(-slideX, -slideY);
  }

  try {

  for (let dx = -radiusX; dx <= radiusX; dx++) {
    for (let dy = -radiusY; dy <= radiusY; dy++) {
      const sx = viewX + dx;
      const sy = viewY + dy;
      const cellX = gridCenterX + dx * CELL_W;
      const cellY = gridCenterY + dy * CELL_H;

      const key = `${sx}:${sy}`;
      const sector = state.discoveries[key];
      const isPlayer = sx === state.position.x && sy === state.position.y;
      const isCenter = dx === 0 && dy === 0;
      const hb = state.homeBase ?? { x: 0, y: 0 };
      const isHome = sx === hb.x && sy === hb.y;

      // Void frontier rendering — black fill with optional blue border
      const isVoidFrontier = state.voidFrontierSectors?.has(`${sx},${sy}`) ?? false;
      const isInVoidQuadrant = state.quadrantIsVoid ?? false;

      if (isVoidFrontier || isInVoidQuadrant) {
        ctx.fillStyle = '#050508';
        ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
        if (isVoidFrontier && !isInVoidQuadrant) {
          ctx.strokeStyle = '#aaaacc';
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
        }
        continue; // skip normal sector rendering
      }

      // Staleness rendering — dim/fade old discoveries
      if (sector && !isPlayer) {
        const discoveryTimestamp = state.discoveryTimestamps?.[key];
        if (discoveryTimestamp) {
          const now = Date.now();
          const hoursSinceDiscovery = (now - discoveryTimestamp) / (1000 * 60 * 60);
          if (hoursSinceDiscovery > STALENESS_FADE_DAYS * 24) {
            ctx.globalAlpha = 0.2;
          } else if (hoursSinceDiscovery > STALENESS_DIM_HOURS) {
            ctx.globalAlpha = 0.5;
          }
        }
      }

      // Cell border
      ctx.strokeStyle = state.dimColor.replace(/[\d.]+\)$/, '0.4)');
      ctx.lineWidth = 2;
      ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);

      // Bookmark border (colored per slot)
      const bmSlot = bookmarkMap.get(`${sx},${sy}`);
      if (bmSlot !== undefined && BOOKMARK_COLORS[bmSlot]) {
        ctx.strokeStyle = BOOKMARK_COLORS[bmSlot];
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Background highlight for non-empty discovered sectors (also shown when player is here)
      if (sector && sector.type !== 'empty') {
        const sectorBgColor = isHome
          ? SECTOR_COLORS.home_base
          : (sector as any).environment === 'black_hole'
            ? '#1A1A1A'
            : (SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty);
        const prevAlpha = ctx.globalAlpha;
        ctx.fillStyle = sectorBgColor;
        ctx.globalAlpha = prevAlpha * 0.08;
        ctx.fillRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
        ctx.globalAlpha = prevAlpha;
      }

      // Pulsing player border
      if (isPlayer) {
        const t = state.animTime ?? 0;
        const pulse = 0.6 + 0.4 * Math.sin(t / 400);
        const alpha = Math.round(pulse * 255)
          .toString(16)
          .padStart(2, '0');
        ctx.strokeStyle = state.themeColor + alpha;
        ctx.lineWidth = 3 + pulse * 1.5;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Selected cell highlight
      if (
        state.selectedSector &&
        sx === state.selectedSector.x &&
        sy === state.selectedSector.y &&
        !isPlayer
      ) {
        ctx.strokeStyle = state.themeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Quest target marker (#151): amber ◎ border for sectors targeted by active quest objectives
      if (state.activeQuests && !isPlayer) {
        const isQuestTarget = state.activeQuests.some((q) =>
          q.objectives.some((o) => o.targetX === sx && o.targetY === sy && !o.fulfilled),
        );
        if (isQuestTarget) {
          const t = state.animTime ?? 0;
          const pulse = 0.5 + 0.5 * Math.sin(t / 600);
          ctx.strokeStyle = `rgba(255,176,0,${0.4 + pulse * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cellX - CELL_W / 2 + 2, cellY - CELL_H / 2 + 2, CELL_W - 4, CELL_H - 4);
        }
      }

      // Tracked quest target marker (#214): blue pulsing border for tracked quest target sectors
      if (state.trackedQuests && state.trackedQuests.length > 0 && !isPlayer) {
        const isTrackedTarget = state.trackedQuests.some(
          (tq) => tq.targetX === sx && tq.targetY === sy,
        );
        if (isTrackedTarget) {
          const t = state.animTime ?? 0;
          const alpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t / 600));
          ctx.strokeStyle = `rgba(0,120,255,${alpha})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX - CELL_W / 2 + 3, cellY - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6);
        }
      }

      // Coordinates label — only at zoom >= 1 (frame handles coords at zoom 0)
      if (state.zoomLevel >= 1) {
        ctx.font = COORD_FONT;
        // Zoom 2-3: left-align to avoid collision with player icons on right
        const coordLeftAlign = state.zoomLevel >= 2 && !isDetailView;
        ctx.textAlign = coordLeftAlign ? 'left' : 'center';
        ctx.textBaseline = 'top';
        if (sector || isPlayer) {
          ctx.fillStyle = state.dimColor;
        } else {
          ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.25)');
        }
        const coordX = coordLeftAlign ? cellX - CELL_W / 2 + 3 : cellX;
        ctx.fillText(`(${innerCoord(sx)},${innerCoord(sy)})`, coordX, cellY - CELL_H / 2 + 3);
      }

      // Sector content
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Zoom 2-3: left-align bottom labels to avoid collision with player icons
      const labelLeftAlign = state.zoomLevel >= 2 && !isDetailView;
      const labelX = labelLeftAlign ? cellX - CELL_W / 2 + 3 : cellX;

      if (isPlayer) {
        const ownHull = state.hullType ?? 'scout';
        // ACEP/3: use evolved icon when XP >= 20 (Tier 2+)
        const ownPattern =
          state.acepXp && state.acepXp.total >= 20
            ? (getAcepRadarPattern(state.acepXp) ?? HULL_RADAR_PATTERNS[ownHull])
            : HULL_RADAR_PATTERNS[ownHull];
        const ownPixelSize = isDetailView ? Math.max(8, 2 + state.zoomLevel) : 2 + state.zoomLevel;
        // #155: animate ship icon from old position
        let iconX = cellX;
        let iconY = cellY;
        const moveAnim = state.shipMoveAnimation;
        if (moveAnim && state.animTime !== undefined) {
          const elapsed = state.animTime - moveAnim.startTime;
          const progress = easeInOutCubic(Math.min(1, elapsed / moveAnim.duration));
          iconX = cellX + (1 - progress) * (moveAnim.fromX - moveAnim.toX) * CELL_W;
          iconY = cellY + (1 - progress) * (moveAnim.fromY - moveAnim.toY) * CELL_H;
        }
        drawHullIcon(ctx, ownPattern, iconX, iconY, state.themeColor, ownPixelSize);
        // #140: pulsing mining ring
        if (state.miningActive) {
          const t = state.animTime ?? 0;
          const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.003));
          ctx.save();
          ctx.strokeStyle = `rgba(255, 176, 0, ${0.3 + pulse * 0.5})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(iconX, iconY, 9 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        if (state.zoomLevel >= 1) {
          ctx.font = COORD_FONT;
          ctx.fillStyle = state.themeColor;
          ctx.textAlign = labelLeftAlign ? 'left' : 'center';
          ctx.textBaseline = 'bottom';
          // Show sector type above player label if sector has info (#154)
          if (sector && sector.type !== 'empty' && (sector as any).environment !== 'black_hole') {
            const sectorLabel = getSectorLabel(sector.type, (sector as any).environment);
            const sectorColor =
              SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty;
            ctx.fillStyle = sectorColor;
            ctx.textBaseline = 'top';
            ctx.fillText(sectorLabel, labelX, cellY - CELL_H / 2 + 3);
          }
          ctx.fillStyle = state.themeColor;
          ctx.textBaseline = 'bottom';
          ctx.fillText(isHome ? 'HOME BASE' : 'YOU', labelX, cellY + CELL_H / 2 - 2);
        }
      } else if (sector) {
        if (sector.type === 'empty' && (sector as any).environment !== 'black_hole' && !isHome) {
          // Empty sectors: just a small centered dot
          ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.3)');
          ctx.beginPath();
          ctx.arc(cellX, cellY, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const symbol = isHome
            ? SYMBOLS.homeBase
            : getSectorSymbol(sector.type, (sector as any).environment);
          const sectorColor = isHome
            ? SECTOR_COLORS.home_base
            : (sector as any).environment === 'black_hole'
              ? '#1A1A1A'
              : (SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty);
          ctx.fillStyle = sectorColor;
          ctx.shadowBlur = 0;
          ctx.fillText(symbol, cellX, cellY);

          if (state.zoomLevel >= 1) {
            ctx.font = COORD_FONT;
            ctx.fillStyle = sectorColor;
            ctx.textAlign = labelLeftAlign ? 'left' : 'center';
            ctx.textBaseline = 'bottom';
            const label = isHome
              ? 'HOME'
              : getSectorLabel(sector.type, (sector as any).environment);
            ctx.fillText(label, labelX, cellY + CELL_H / 2 - 2);
          }
        }
      } else {
        if (state.zoomLevel >= 1) {
          ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.15)');
          ctx.textAlign = labelLeftAlign ? 'left' : 'center';
          ctx.textBaseline = 'bottom';
          ctx.font = COORD_FONT;
          ctx.fillText('UNEXPLORED', labelX, cellY + CELL_H / 2 - 2);
        }
      }

      // Zoom-4 detail: resources + discovery age
      if (isDetailView && sector) {
        const lineH = 16;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let detailY = cellY + CELL_H / 2 + 6;

        const res = sector.resources;
        if (res) {
          ctx.font = `13px 'Share Tech Mono', monospace`;
          if (res.ore > 0) {
            ctx.fillStyle = state.themeColor;
            ctx.fillText(`Ore: ${res.ore}`, cellX, detailY);
            detailY += lineH;
          }
          if (res.gas > 0) {
            ctx.fillStyle = state.themeColor;
            ctx.fillText(`Gas: ${res.gas}`, cellX, detailY);
            detailY += lineH;
          }
          if (res.crystal > 0) {
            ctx.fillStyle = state.themeColor;
            ctx.fillText(`Cry: ${res.crystal}`, cellX, detailY);
            detailY += lineH;
          }
        }

        // Discovery age
        const ts = state.discoveryTimestamps?.[key];
        if (ts) {
          ctx.font = `12px 'Share Tech Mono', monospace`;
          const ageMs = Date.now() - ts;
          const ageH = Math.floor(ageMs / 3600000);
          const label = ageH < 1 ? '<1h' : ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`;
          ctx.fillStyle = state.dimColor;
          ctx.fillText(`~${label} ago`, cellX, detailY);
        }
      }

      // Feature dots (jumpgate, scan events) — zoom >= 2
      if (state.zoomLevel >= 2 && (sector || isPlayer)) {
        const features: string[] = [];
        if (state.jumpGateInfo && isPlayer) {
          features.push('#00BFFF'); // cyan for jumpgate
        }
        if (state.scanEvents) {
          const sectorEvents = state.scanEvents.filter(
            (e) => e.sectorX === sx && e.sectorY === sy && e.status === 'discovered',
          );
          for (const ev of sectorEvents) {
            features.push(ev.eventType === 'distress_signal' ? '#FF3333' : '#FF00FF');
          }
        }
        const dotY = cellY - CELL_H / 2 + 4;
        const dotStartX = cellX + CELL_W / 2 - 5;
        for (let fi = 0; fi < features.length; fi++) {
          drawFeatureDot(ctx, dotStartX - fi * 5, dotY, features[fi]);
        }
      }

      // Structure indicator — zoom >= 2
      if (state.zoomLevel >= 2 && sector) {
        const hasStructure = (sector as any).structures?.length > 0 || sector.type === 'station';
        if (hasStructure && !isPlayer) {
          ctx.font = `${coordSize + 2}px 'Share Tech Mono', monospace`;
          ctx.fillStyle = '#FFB000';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('◊', cellX - CELL_W / 2 + 3, cellY - CELL_H / 2 + 3);
        }
      }

      // Resource fill indicator dots — left edge, vertically stacked
      if (sector?.resources && state.zoomLevel >= 1) {
        const res = sector.resources;
        const dotSpacing = 4;
        const dotR = 1.5;
        const dotBaseX = cellX - CELL_W / 2 + 5;

        // Helper to draw 3-dot indicator (horizontal row)
        const drawDots = (
          baseX: number,
          baseY: number,
          value: number,
          maxValue: number,
          color: string,
        ) => {
          if (maxValue <= 0) return;
          const pct = Math.min(1, value / maxValue);
          if (pct >= 1) {
            // Full: solid bar
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(baseX, baseY - 1, dotSpacing * 2 + dotR * 2, 2);
            ctx.globalAlpha = 1;
            return;
          }
          const active = Math.ceil(pct * 3);
          for (let d = 0; d < 3; d++) {
            ctx.fillStyle = color;
            ctx.globalAlpha = d < active ? 0.8 : 0.15;
            ctx.beginPath();
            ctx.arc(baseX + d * dotSpacing, baseY, dotR, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        };

        // Count how many resource types are present
        const hasOre = res.ore > 0;
        const hasGas = res.gas > 0;
        const hasCrystal = res.crystal > 0;
        const rowCount = (hasOre ? 1 : 0) + (hasGas ? 1 : 0) + (hasCrystal ? 1 : 0);
        const rowSpacing = 5;
        const totalHeight = (rowCount - 1) * rowSpacing;
        let rowY = cellY - totalHeight / 2;

        // Ore: top row
        if (hasOre) {
          drawDots(dotBaseX, rowY, res.ore, res.ore, state.themeColor);
          rowY += rowSpacing;
        }

        // Gas: middle row
        if (hasGas) {
          drawDots(dotBaseX, rowY, res.gas, res.gas, state.themeColor);
          rowY += rowSpacing;
        }

        // Crystal: bottom row
        if (hasCrystal) {
          drawDots(dotBaseX, rowY, res.crystal, res.crystal, '#66CCFF');
        }
      }

      // Scan brightness burst — newly revealed sectors glow brighter for 1500ms
      const burstTs = state.scanBurstTimestamps?.[key];
      if (burstTs !== undefined) {
        const elapsed = (state.animTime ?? Date.now()) - burstTs;
        if (elapsed >= 0 && elapsed < BURST_DURATION) {
          const t = elapsed / BURST_DURATION;
          // Lerp alpha from 0.5 down to 0 — bright amber fill fades out
          const burstAlpha = 0.5 * (1 - t);
          ctx.save();
          ctx.globalAlpha = burstAlpha;
          ctx.fillStyle = '#FFB000';
          ctx.fillRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
          // Inner glow ring
          ctx.strokeStyle = '#FFD050';
          ctx.lineWidth = 1;
          ctx.globalAlpha = burstAlpha * 0.8;
          ctx.strokeRect(cellX - CELL_W / 2 + 2, cellY - CELL_H / 2 + 2, CELL_W - 4, CELL_H - 4);
          ctx.restore();
        }
      }

      // Reset alpha after each cell (staleness rendering)
      ctx.globalAlpha = 1.0;
    }
  }

  // Draw nebula cloud overlay — soft glow between adjacent nebula sectors
  for (let dx = -radiusX; dx <= radiusX; dx++) {
    for (let dy = -radiusY; dy <= radiusY; dy++) {
      const sx = viewX + dx;
      const sy = viewY + dy;
      const key = `${sx}:${sy}`;
      const sector = state.discoveries[key];
      if (!sector || (sector as any).environment !== 'nebula') continue;

      const cellX = gridCenterX + dx * CELL_W;
      const cellY = gridCenterY + dy * CELL_H;

      // Soft nebula glow fill
      ctx.save();
      ctx.globalAlpha = 0.12;
      const grad = ctx.createRadialGradient(cellX, cellY, 0, cellX, cellY, CELL_W * 0.8);
      grad.addColorStop(0, '#8844CC');
      grad.addColorStop(0.6, '#5522AA');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(cellX - CELL_W, cellY - CELL_H, CELL_W * 2, CELL_H * 2);
      ctx.restore();

      // Animated particle wisps
      const t = state.animTime ?? 0;
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.05 * Math.sin(t / 1200 + sx * 0.7);
      for (let p = 0; p < 3; p++) {
        const px = cellX + Math.sin(t / 2000 + p * 2.1 + sx) * CELL_W * 0.3;
        const py = cellY + Math.cos(t / 1800 + p * 1.7 + sy) * CELL_H * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, 2 + p, 0, Math.PI * 2);
        ctx.fillStyle = '#AA66DD';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Draw other players — zoom >= 2
  if (state.zoomLevel >= 2) {
    const otherPattern = HULL_RADAR_PATTERNS.scout;
    const otherPixelSize = 1 + state.zoomLevel;
    const otherColor = '#FFDD22';
    const playerList = Object.values(state.players);
    // Only draw one icon per sector — track which sectors already have an icon
    const drawnSectors = new Set<string>();
    for (let i = 0; i < playerList.length; i++) {
      const player = playerList[i];
      const dx = player.x - viewX;
      const dy = player.y - viewY;
      if (
        Math.abs(dx) <= radiusX &&
        Math.abs(dy) <= radiusY &&
        !(player.x === state.position.x && player.y === state.position.y)
      ) {
        const sectorKey = `${player.x}:${player.y}`;
        if (drawnSectors.has(sectorKey)) continue;
        drawnSectors.add(sectorKey);
        const px = gridCenterX + dx * CELL_W + 12;
        const py = gridCenterY + dy * CELL_H;
        drawHullIcon(ctx, otherPattern, px, py, otherColor, otherPixelSize);
        // Player username at zoom >= 3
        if (state.zoomLevel >= 3) {
          const displayName = player.username?.slice(0, 8) ?? '';
          if (displayName) {
            ctx.font = COORD_FONT;
            ctx.fillStyle = otherColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayName, px + 10, py);
          }
        }
      }
    }
  }

  // Draw NPC civ ships — visible at all zoom levels
  {
    const civShipList = state.civShips ?? [];
    for (const ship of civShipList) {
      const dx = ship.x - viewX;
      const dy = ship.y - viewY;
      if (Math.abs(dx) > radiusX || Math.abs(dy) > radiusY) continue;

      const px = gridCenterX + dx * CELL_W;
      const py = gridCenterY + dy * CELL_H;
      const factionColor =
        (COSMIC_FACTION_COLORS as Record<string, string>)[ship.faction] ?? '#AAAAAA';

      ctx.save();
      ctx.strokeStyle = factionColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;

      if (ship.ship_type === 'mining_drone') {
        // Hollow circle ○ — slightly larger than player pixels
        const radius = 3 + state.zoomLevel;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ship.ship_type === 'station_builder') {
        // Small square □
        const half = 3 + state.zoomLevel;
        ctx.strokeRect(px - half, py - half, half * 2, half * 2);
      } else {
        // Combat — diamond ◇
        const s = 3 + state.zoomLevel;
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s, py);
        ctx.lineTo(px, py + s);
        ctx.lineTo(px - s, py);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  } catch (error) {
    // Log rendering error but don't crash
    if (error instanceof Error) {
      console.error('[radar] render exception:', error.message);
    }
  } finally {
    // Guarantee ctx.restore() is called if ctx.save() was called, even on exception
    if (slideActive) {
      ctx.restore();
    }
  }

  // === Trail line ===
  if (state.visitedTrail && state.visitedTrail.length > 0 && !animActive) {
    const trail = state.visitedTrail;
    let prevSX = gridCenterX + (state.position.x - viewX) * CELL_W;
    let prevSY = gridCenterY + (state.position.y - viewY) * CELL_H;

    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const screenX = gridCenterX + (t.x - viewX) * CELL_W;
      const screenY = gridCenterY + (t.y - viewY) * CELL_H;
      const inBounds = Math.abs(t.x - viewX) <= radiusX && Math.abs(t.y - viewY) <= radiusY;
      if (!inBounds) {
        prevSX = screenX;
        prevSY = screenY;
        continue;
      }

      const opacity = 0.8 - (i / trail.length) * 0.7;
      ctx.save();
      ctx.strokeStyle = state.themeColor;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(prevSX, prevSY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
      ctx.fillStyle = state.themeColor;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      prevSX = screenX;
      prevSY = screenY;
    }
  }

  // --- JumpGate connection lines ---
  if (state.knownJumpGates && state.knownJumpGates.length > 0 && !animActive) {
    drawJumpGateLines(
      ctx,
      state.knownJumpGates,
      viewX,
      viewY,
      radiusX,
      radiusY,
      gridCenterX,
      gridCenterY,
      CELL_W,
      CELL_H,
    );
    drawJumpGateIcons(
      ctx,
      state.knownJumpGates,
      viewX,
      viewY,
      radiusX,
      radiusY,
      gridCenterX,
      gridCenterY,
      CELL_W,
      CELL_H,
    );
  }

  // --- Nav target dashed line ---
  if (state.navTarget && !animActive) {
    const ntDx = state.navTarget.x - viewX;
    const ntDy = state.navTarget.y - viewY;
    const playerDx = state.position.x - viewX;
    const playerDy = state.position.y - viewY;

    // Only draw if both endpoints are within the visible grid
    const ntVisible = Math.abs(ntDx) <= radiusX && Math.abs(ntDy) <= radiusY;
    const playerVisible = Math.abs(playerDx) <= radiusX && Math.abs(playerDy) <= radiusY;

    if (ntVisible || playerVisible) {
      const fromX = gridCenterX + playerDx * CELL_W;
      const fromY = gridCenterY + playerDy * CELL_H;
      const toX = gridCenterX + ntDx * CELL_W;
      const toY = gridCenterY + ntDy * CELL_H;

      ctx.save();
      ctx.strokeStyle = '#FFB000';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // Draw target marker (diamond)
      if (ntVisible) {
        ctx.fillStyle = '#FFB000';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(toX, toY - 5);
        ctx.lineTo(toX + 5, toY);
        ctx.lineTo(toX, toY + 5);
        ctx.lineTo(toX - 5, toY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();
    }
  }

  // --- Slow flight path overlay ---
  if (state.slowFlightPath && state.slowFlightPath.length >= 2) {
    const start = state.slowFlightPath[0];
    const end = state.slowFlightPath[state.slowFlightPath.length - 1];

    const startDx = start.x - viewX;
    const startDy = start.y - viewY;
    const endDx = end.x - viewX;
    const endDy = end.y - viewY;

    const x1 = gridCenterX + startDx * CELL_W;
    const y1 = gridCenterY + startDy * CELL_H;
    const x2 = gridCenterX + endDx * CELL_W;
    const y2 = gridCenterY + endDy * CELL_H;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = state.themeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // --- Coordinate frame (tightly wraps actual cells) ---
  const totalCellsW = (2 * radiusX + 1) * CELL_W;
  const totalCellsH = (2 * radiusY + 1) * CELL_H;
  const frameLeft = gridCenterX - totalCellsW / 2;
  const frameTop = gridCenterY - totalCellsH / 2;
  const frameRight = gridCenterX + totalCellsW / 2;
  const frameBottom = gridCenterY + totalCellsH / 2;

  ctx.font = COORD_FONT;
  ctx.fillStyle = state.dimColor;

  // Row labels (left side) — Y galaxy coordinates
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let dy = -radiusY; dy <= radiusY; dy++) {
    const sy = viewY + dy;
    const cellY = gridCenterY + dy * CELL_H;
    ctx.fillText(String(innerCoord(sy)), frameLeft - 8, cellY);
  }

  // Column labels (bottom) — X galaxy coordinates
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let dx = -radiusX; dx <= radiusX; dx++) {
    const sx = viewX + dx;
    const cellX = gridCenterX + dx * CELL_W;
    ctx.fillText(String(innerCoord(sx)), cellX, frameBottom + 4);
  }

  // Frame border — tightly wraps the cell grid
  ctx.strokeStyle = state.dimColor.replace(/[\d.]+\)$/, '0.5)');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(frameLeft - 1, frameTop - 1);
  ctx.lineTo(frameRight + 1, frameTop - 1);
  ctx.lineTo(frameRight + 1, frameBottom + 1);
  ctx.lineTo(frameLeft - 1, frameBottom + 1);
  ctx.closePath();
  ctx.stroke();

  // Apply glitch overlay based on animation phase
  if (animActive) {
    const pixelW = Math.floor(w * dpr);
    const pixelH = Math.floor(h * dpr);
    if (anim.phase === 'glitch') {
      drawGlitchOverlay(ctx, pixelW, pixelH, 1 - anim.progress);
    } else if (anim.phase === 'slide') {
      drawGlitchOverlay(ctx, pixelW, pixelH, (1 - anim.progress) * 0.5);
    } else if (anim.phase === 'settle') {
      drawGlitchOverlay(ctx, pixelW, pixelH, (1 - anim.progress) * 0.3);
    }
    // Heavy CRT effect for long-distance jumps (>20 sectors)
    if (anim.isLongJump) {
      drawLongJumpCRTEffect(ctx, pixelW, pixelH, anim);
    }
  }
}

function getSectorSymbol(type: string, environment?: string): string {
  if (environment === 'black_hole') return 'o';
  switch (type) {
    case 'asteroid_field':
      return SYMBOLS.asteroid_field;
    case 'nebula':
      return SYMBOLS.nebula;
    case 'station':
      return SYMBOLS.station;
    case 'anomaly':
      return SYMBOLS.anomaly;
    case 'pirate':
      return SYMBOLS.pirate;
    case 'empty':
    default:
      return SYMBOLS.empty;
  }
}

function getSectorLabel(type: string, environment?: string): string {
  if (environment === 'black_hole') return 'BLACK HOLE';
  switch (type) {
    case 'asteroid_field':
      return 'ASTEROID';
    case 'nebula':
      return 'NEBULA';
    case 'station':
      return 'STATION';
    case 'anomaly':
      return 'ANOMALY';
    case 'pirate':
      return 'PIRATE';
    case 'empty':
      return 'EMPTY';
    default:
      return type.toUpperCase();
  }
}

function drawFeatureDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGlitchOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
) {
  // Bounds check to prevent IndexSizeError
  if (width <= 0 || height <= 0 || width > 32767 || height > 32767) {
    return;
  }

  try {
    // Scanline displacement
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let y = 0; y < height; y++) {
      if (Math.random() < intensity * 0.3) {
        const shift = Math.floor((Math.random() - 0.5) * intensity * 20);
        const row = y * width * 4;
        const temp = new Uint8ClampedArray(width * 4);
        for (let x = 0; x < width; x++) {
          const srcX = Math.max(0, Math.min(width - 1, x + shift));
          temp.set(data.subarray(row + srcX * 4, row + srcX * 4 + 4), x * 4);
        }
        data.set(temp, row);
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Static noise flash
    if (intensity > 0.5) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(intensity - 0.5) * 0.1})`;
      for (let i = 0; i < intensity * 50; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 1);
      }
    }
  } catch (error) {
    // Silently skip glitch overlay on error (prevents crash)
    // This can happen with invalid canvas dimensions
  }
}

function drawHullIcon(
  ctx: CanvasRenderingContext2D,
  pattern: number[][],
  centerX: number,
  centerY: number,
  color: string,
  pixelSize: number = 2,
) {
  const rows = pattern.length;
  const cols = pattern[0].length;
  const offsetX = centerX - (cols * pixelSize) / 2;
  const offsetY = centerY - (rows * pixelSize) / 2;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern[r][c]) {
        ctx.fillRect(offsetX + c * pixelSize, offsetY + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  blur: number,
) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur / 3;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}
