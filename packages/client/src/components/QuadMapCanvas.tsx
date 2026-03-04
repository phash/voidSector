import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { COLOR_PROFILES } from '../styles/themes';
import type { QuadrantData } from '@void-sector/shared';
import { QUAD_SECTOR_SIZE } from '@void-sector/shared';

const CELL_PX = 12; // pixels per quadrant cell

function coordsToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return { qx: Math.floor(x / QUAD_SECTOR_SIZE), qy: Math.floor(y / QUAD_SECTOR_SIZE) };
}

function drawQuadMap(
  ctx: CanvasRenderingContext2D,
  quadrants: QuadrantData[],
  playerQx: number,
  playerQy: number,
  panOffset: { x: number; y: number },
  themeColor: string,
  dimColor: string,
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, width, height);

  if (quadrants.length === 0) {
    ctx.fillStyle = dimColor;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NO QUADRANT DATA', width / 2, height / 2);
    ctx.textAlign = 'left';
    return;
  }

  const centerX = Math.floor(width / 2) + panOffset.x * CELL_PX;
  const centerY = Math.floor(height / 2) + panOffset.y * CELL_PX;

  ctx.font = '9px monospace';

  for (const q of quadrants) {
    const dx = q.qx - playerQx;
    const dy = q.qy - playerQy;
    const px = centerX + dx * CELL_PX;
    const py = centerY + dy * CELL_PX;

    if (px < -CELL_PX || px > width + CELL_PX || py < -CELL_PX || py > height + CELL_PX) continue;

    const isPlayer = q.qx === playerQx && q.qy === playerQy;

    ctx.fillStyle = isPlayer ? themeColor : dimColor;
    ctx.fillRect(px - CELL_PX / 2 + 1, py - CELL_PX / 2 + 1, CELL_PX - 2, CELL_PX - 2);

    if (q.name) {
      ctx.fillStyle = isPlayer ? themeColor : dimColor;
      ctx.fillText(q.name.slice(0, 10), px - CELL_PX / 2, py - CELL_PX / 2 - 2);
    }
  }

  // Draw player marker
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1;
  const s = CELL_PX / 2;
  ctx.strokeRect(
    centerX - s - 1,
    centerY - s - 1,
    CELL_PX + 2,
    CELL_PX + 2,
  );

  // Legend
  ctx.fillStyle = dimColor;
  ctx.font = '9px monospace';
  ctx.fillText(`POS (${playerQx}, ${playerQy})`, 4, height - 4);
  ctx.fillText(`${quadrants.length} QUADRANTS KNOWN`, 4, height - 14);
}

export function QuadMapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = useStore.getState();
    const colors = COLOR_PROFILES[state.colorProfile];
    const { qx, qy } = coordsToQuadrant(state.position.x, state.position.y);

    drawQuadMap(ctx, state.knownQuadrants, qx, qy, panRef.current, colors.primary, colors.dim);

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(render);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [render]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    obs.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => obs.disconnect();
  }, []);

  // Pan drag
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      dragStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = (e.clientX - dragStart.current.mx) / CELL_PX;
      const dy = (e.clientY - dragStart.current.my) / CELL_PX;
      panRef.current = { x: dragStart.current.px + dx, y: dragStart.current.py + dy };
    };
    const onUp = () => { dragging.current = false; };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
    />
  );
}
