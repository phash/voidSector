import { SYMBOLS, SECTOR_COLORS, STALENESS_DIM_HOURS, STALENESS_FADE_DAYS, HULL_RADAR_PATTERNS } from '@void-sector/shared';
import type { SectorData, Coords, JumpGateInfo, ScanEvent, HullType, Bookmark } from '@void-sector/shared';
import type { PlayerPresence } from '../state/gameSlice';
import type { JumpAnimationState } from './JumpAnimation';

const BOOKMARK_COLORS: Record<number, string> = {
  0: '#33FF33',   // HOME — green
  1: '#FF6644',   // Slot 1 — red-orange
  2: '#44AAFF',   // Slot 2 — blue
  3: '#FFDD22',   // Slot 3 — yellow
  4: '#44FF88',   // Slot 4 — teal
  5: '#FF44FF',   // Slot 5 — magenta
};

export const CELL_SIZES = [
  { w: 48, h: 38, fontSize: 12, coordSize: 8 },
  { w: 64, h: 50, fontSize: 14, coordSize: 9 },
  { w: 80, h: 64, fontSize: 16, coordSize: 10 },
  { w: 96, h: 76, fontSize: 18, coordSize: 11 },
];

// Coordinate frame margins (exported for click offset calculation)
export const FRAME_LEFT = 40;   // space for row numbers (Y coordinates)
export const FRAME_BOTTOM = 24; // space for column numbers (X coordinates)
export const FRAME_PAD = 8;     // padding on right/top

export function calculateVisibleRadius(canvasW: number, canvasH: number, zoomLevel: number): { radiusX: number; radiusY: number } {
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
  scanEvents?: ScanEvent[];
  discoveryTimestamps?: Record<string, number>;
  hullType?: HullType;
  homeBase?: { x: number; y: number };
  bookmarks?: Bookmark[];
  animTime?: number;
}

export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  const isDetailView = state.zoomLevel === 4;
  const cellEntry = isDetailView
    ? { w: Math.floor((w - FRAME_LEFT - FRAME_PAD) / 3), h: Math.floor((h - FRAME_BOTTOM - FRAME_PAD) / 3), fontSize: 20, coordSize: 10 }
    : (CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1]);
  const { w: CELL_W, h: CELL_H, fontSize, coordSize } = cellEntry;
  const FONT = `${fontSize}px 'Share Tech Mono', 'Courier New', monospace`;
  const COORD_FONT = `${coordSize}px 'Share Tech Mono', 'Courier New', monospace`;

  // Build bookmark lookup: "x,y" → slot number
  const bookmarkMap = new Map<string, number>();
  for (const bm of (state.bookmarks ?? [])) {
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
  if (animActive && anim.phase === 'slide') {
    ctx.save();
    const slideX = anim.direction.dx * anim.progress * CELL_W;
    const slideY = anim.direction.dy * anim.progress * CELL_H;
    ctx.translate(-slideX, -slideY);
  }

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

      // Pulsing player border
      if (isPlayer) {
        const t = state.animTime ?? 0;
        const pulse = 0.6 + 0.4 * Math.sin(t / 400);
        const alpha = Math.round(pulse * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = state.themeColor + alpha;
        ctx.lineWidth = 3 + pulse * 1.5;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Selected cell highlight
      if (state.selectedSector && sx === state.selectedSector.x && sy === state.selectedSector.y && !isPlayer) {
        ctx.strokeStyle = state.themeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Coordinates label — only at zoom >= 1 (frame handles coords at zoom 0)
      if (state.zoomLevel >= 1) {
        ctx.font = COORD_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        if (sector || isPlayer) {
          ctx.fillStyle = state.dimColor;
        } else {
          ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.25)');
        }
        ctx.fillText(`(${sx},${sy})`, cellX, cellY - CELL_H / 2 + 3);
      }

      // Sector content
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isPlayer) {
        const ownHull = state.hullType ?? 'scout';
        const ownPattern = HULL_RADAR_PATTERNS[ownHull];
        const ownPixelSize = isDetailView ? Math.max(8, 2 + state.zoomLevel) : 2 + state.zoomLevel;
        drawHullIcon(ctx, ownPattern, cellX, cellY, state.themeColor, ownPixelSize);
        if (state.zoomLevel >= 1) {
          ctx.font = COORD_FONT;
          ctx.fillStyle = state.themeColor;
          ctx.textBaseline = 'bottom';
          ctx.fillText(isHome ? 'HOME BASE' : 'YOU', cellX, cellY + CELL_H / 2 - 2);
        }
      } else if (sector) {
        const symbol = isHome ? SYMBOLS.homeBase : getSectorSymbol(sector.type, (sector as any).environment);
        const sectorColor = isHome
          ? SECTOR_COLORS.home_base
          : (sector as any).environment === 'black_hole'
            ? '#1A1A1A'
            : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty;
        ctx.fillStyle = sectorColor;
        ctx.shadowBlur = 0;
        ctx.fillText(symbol, cellX, cellY);

        if (state.zoomLevel >= 1) {
          ctx.font = COORD_FONT;
          ctx.fillStyle = sectorColor;
          ctx.textBaseline = 'bottom';
          const label = isHome ? 'HOME' : getSectorLabel(sector.type, (sector as any).environment);
          ctx.fillText(label, cellX, cellY + CELL_H / 2 - 2);
        }
      } else {
        if (state.zoomLevel >= 1) {
          ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.15)');
          ctx.textBaseline = 'bottom';
          ctx.font = COORD_FONT;
          ctx.fillText('UNEXPLORED', cellX, cellY + CELL_H / 2 - 2);
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
          if (res.ore > 0)     { ctx.fillStyle = state.themeColor; ctx.fillText(`Ore: ${res.ore}`,     cellX, detailY); detailY += lineH; }
          if (res.gas > 0)     { ctx.fillStyle = state.themeColor; ctx.fillText(`Gas: ${res.gas}`,     cellX, detailY); detailY += lineH; }
          if (res.crystal > 0) { ctx.fillStyle = state.themeColor; ctx.fillText(`Cry: ${res.crystal}`, cellX, detailY); detailY += lineH; }
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
            e => e.sectorX === sx && e.sectorY === sy && e.status === 'discovered'
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

      // Reset alpha after each cell (staleness rendering)
      ctx.globalAlpha = 1.0;
    }
  }

  // Draw other players — zoom >= 3
  if (state.zoomLevel >= 3) {
    const otherPattern = HULL_RADAR_PATTERNS.scout;
    const otherPixelSize = 1 + state.zoomLevel;
    const otherColor = state.dimColor;
    const playerList = Object.values(state.players);
    for (let i = 0; i < playerList.length; i++) {
      const player = playerList[i];
      const dx = player.x - viewX;
      const dy = player.y - viewY;
      if (Math.abs(dx) <= radiusX && Math.abs(dy) <= radiusY && !(player.x === state.position.x && player.y === state.position.y)) {
        const px = gridCenterX + dx * CELL_W + 12;
        const py = gridCenterY + dy * CELL_H;
        drawHullIcon(ctx, otherPattern, px, py, otherColor, otherPixelSize);
        // Player username at zoom 3
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

  // Restore translate after slide phase drawing
  if (animActive && anim.phase === 'slide') {
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
    ctx.fillText(String(sy), frameLeft - 8, cellY);
  }

  // Column labels (bottom) — X galaxy coordinates
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let dx = -radiusX; dx <= radiusX; dx++) {
    const sx = viewX + dx;
    const cellX = gridCenterX + dx * CELL_W;
    ctx.fillText(String(sx), cellX, frameBottom + 4);
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
  }
}

function getSectorSymbol(type: string, environment?: string): string {
  if (environment === 'black_hole') return 'o';
  switch (type) {
    case 'asteroid_field': return SYMBOLS.asteroid_field;
    case 'nebula': return SYMBOLS.nebula;
    case 'station': return SYMBOLS.station;
    case 'anomaly': return SYMBOLS.anomaly;
    case 'pirate': return SYMBOLS.pirate;
    case 'empty':
    default: return SYMBOLS.empty;
  }
}

function getSectorLabel(type: string, environment?: string): string {
  if (environment === 'black_hole') return 'BLACK HOLE';
  switch (type) {
    case 'asteroid_field': return 'ASTEROID';
    case 'nebula': return 'NEBULA';
    case 'station': return 'STATION';
    case 'anomaly': return 'ANOMALY';
    case 'pirate': return 'PIRATE';
    case 'empty': return 'EMPTY';
    default: return type.toUpperCase();
  }
}

function drawFeatureDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGlitchOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
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
}

function drawHullIcon(
  ctx: CanvasRenderingContext2D,
  pattern: number[][],
  centerX: number,
  centerY: number,
  color: string,
  pixelSize: number = 2
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
        ctx.fillRect(
          offsetX + c * pixelSize,
          offsetY + r * pixelSize,
          pixelSize,
          pixelSize
        );
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
  blur: number
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
