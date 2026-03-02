import { SYMBOLS, RADAR_RADIUS } from '@void-sector/shared';
import type { SectorData, Coords } from '@void-sector/shared';
import type { PlayerPresence } from '../state/gameSlice';

const CELL_W = 72;
const CELL_H = 56;
const FONT_SIZE = 14;
const COORD_FONT_SIZE = 8;
const FONT = `${FONT_SIZE}px 'Share Tech Mono', 'Courier New', monospace`;
const COORD_FONT = `${COORD_FONT_SIZE}px 'Share Tech Mono', 'Courier New', monospace`;

interface RadarState {
  position: Coords;
  discoveries: Record<string, SectorData>;
  players: Record<string, PlayerPresence>;
  currentSector: SectorData | null;
  themeColor: string;
  dimColor: string;
}

export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;
  const radius = RADAR_RADIUS;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const sx = state.position.x + dx;
      const sy = state.position.y + dy;
      const cellX = centerX + dx * CELL_W;
      const cellY = centerY + dy * CELL_H;

      const key = `${sx}:${sy}`;
      const sector = state.discoveries[key];
      const isCenter = dx === 0 && dy === 0;
      const isHome = sx === 0 && sy === 0;

      // Cell border
      ctx.strokeStyle = 'rgba(255, 176, 0, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);

      // Coordinates label
      ctx.font = COORD_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (sector || isCenter) {
        ctx.fillStyle = state.dimColor;
      } else {
        ctx.fillStyle = 'rgba(255, 176, 0, 0.15)';
      }
      ctx.fillText(`[${sx}/${sy}]`, cellX, cellY - CELL_H / 2 + 3);

      // Sector content
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isCenter) {
        drawGlowText(ctx, SYMBOLS.ship, cellX, cellY, state.themeColor, 10);
        ctx.font = COORD_FONT;
        ctx.fillStyle = state.themeColor;
        ctx.textBaseline = 'bottom';
        ctx.fillText(isHome ? 'HOME BASE' : 'YOU', cellX, cellY + CELL_H / 2 - 2);
      } else if (sector) {
        const symbol = isHome ? SYMBOLS.homeBase : getSectorSymbol(sector.type);
        ctx.fillStyle = state.dimColor;
        ctx.shadowBlur = 0;
        ctx.fillText(symbol, cellX, cellY);

        ctx.font = COORD_FONT;
        ctx.textBaseline = 'bottom';
        const label = isHome ? 'HOME' : getSectorLabel(sector.type);
        ctx.fillText(label, cellX, cellY + CELL_H / 2 - 2);
      } else {
        ctx.fillStyle = 'rgba(255, 176, 0, 0.1)';
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
    const dx = player.x - state.position.x;
    const dy = player.y - state.position.y;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius && !(dx === 0 && dy === 0)) {
      const px = centerX + dx * CELL_W + 12;
      const py = centerY + dy * CELL_H;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawGlowText(ctx, SYMBOLS.player, px, py, state.themeColor, 6);
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
}
