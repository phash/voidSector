import { SYMBOLS, RADAR_RADIUS, SECTOR_COLORS } from '@void-sector/shared';
import type { SectorData, Coords } from '@void-sector/shared';
import type { PlayerPresence } from '../state/gameSlice';
import type { JumpAnimationState } from './JumpAnimation';

export const CELL_SIZES = [
  { w: 48, h: 38, fontSize: 12, coordSize: 8 },
  { w: 64, h: 50, fontSize: 14, coordSize: 9 },
  { w: 80, h: 64, fontSize: 16, coordSize: 10 },
  { w: 96, h: 76, fontSize: 18, coordSize: 11 },
];

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
}

export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState) {
  const { w: CELL_W, h: CELL_H, fontSize, coordSize } = CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1];
  const FONT = `${fontSize}px 'Share Tech Mono', 'Courier New', monospace`;
  const COORD_FONT = `${coordSize}px 'Share Tech Mono', 'Courier New', monospace`;
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;
  const radius = RADAR_RADIUS;

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

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const sx = viewX + dx;
      const sy = viewY + dy;
      const cellX = centerX + dx * CELL_W;
      const cellY = centerY + dy * CELL_H;

      const key = `${sx}:${sy}`;
      const sector = state.discoveries[key];
      const isPlayer = sx === state.position.x && sy === state.position.y;
      const isCenter = dx === 0 && dy === 0;
      const isHome = sx === 0 && sy === 0;

      // Cell border
      ctx.strokeStyle = state.dimColor.replace(/[\d.]+\)$/, '0.4)');
      ctx.lineWidth = 2;
      ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);

      // Selected cell highlight
      if (state.selectedSector && sx === state.selectedSector.x && sy === state.selectedSector.y) {
        ctx.strokeStyle = state.themeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
      }

      // Coordinates label
      ctx.font = COORD_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (sector || isPlayer) {
        ctx.fillStyle = state.dimColor;
      } else {
        ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.25)');
      }
      ctx.fillText(`(${sx},${sy})`, cellX, cellY - CELL_H / 2 + 3);

      // Sector content
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isPlayer) {
        drawGlowText(ctx, SYMBOLS.ship, cellX, cellY, state.themeColor, 10);
        ctx.font = COORD_FONT;
        ctx.fillStyle = state.themeColor;
        ctx.textBaseline = 'bottom';
        ctx.fillText(isHome ? 'HOME BASE' : 'YOU', cellX, cellY + CELL_H / 2 - 2);
      } else if (sector) {
        const symbol = isHome ? SYMBOLS.homeBase : getSectorSymbol(sector.type);
        const sectorColor = isHome
          ? SECTOR_COLORS.home_base
          : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty;
        ctx.fillStyle = sectorColor;
        ctx.shadowBlur = 0;
        ctx.fillText(symbol, cellX, cellY);

        ctx.font = COORD_FONT;
        ctx.fillStyle = sectorColor;
        ctx.textBaseline = 'bottom';
        const label = isHome ? 'HOME' : getSectorLabel(sector.type);
        ctx.fillText(label, cellX, cellY + CELL_H / 2 - 2);
      } else {
        ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.15)');
        ctx.textBaseline = 'bottom';
        ctx.font = COORD_FONT;
        ctx.fillText('UNEXPLORED', cellX, cellY + CELL_H / 2 - 2);
      }
    }
  }

  // Draw other players
  const playerList = Object.values(state.players);
  for (let i = 0; i < playerList.length; i++) {
    const player = playerList[i];
    const dx = player.x - viewX;
    const dy = player.y - viewY;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius && !(player.x === state.position.x && player.y === state.position.y)) {
      const px = centerX + dx * CELL_W + 12;
      const py = centerY + dy * CELL_H;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawGlowText(ctx, SYMBOLS.player, px, py, state.themeColor, 6);
    }
  }

  // Restore translate after slide phase drawing
  if (animActive && anim.phase === 'slide') {
    ctx.restore();
  }

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

function getSectorSymbol(type: string): string {
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

function getSectorLabel(type: string): string {
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
