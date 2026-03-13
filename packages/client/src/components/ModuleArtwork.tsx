import { useRef, useEffect } from 'react';
import type { ModuleCategory } from '@void-sector/shared';

interface ModuleArtworkProps {
  category: ModuleCategory;
  tier: number;
}

function tierGlow(tier: number): { blur: number; alpha: number } {
  const t = Math.max(1, Math.min(5, tier));
  const BLUR = [0, 3, 6, 9, 12, 15];       // index 1-5
  const ALPHA = [0, 0.5, 0.65, 0.75, 0.9, 1.0]; // index 1-5
  return { blur: BLUR[t], alpha: ALPHA[t] };
}

function amberColor(alpha: number): string {
  const r = Math.round(255 * alpha);
  const g = Math.round(176 * alpha);
  const b = 0;
  return `rgb(${r},${g},${b})`;
}

type DrawFn = (ctx: CanvasRenderingContext2D, s: number) => void;

// s = scale factor (2 for retina). All coords are in 0-48 logical space, multiply by s.
const DRAW_ROUTINES: Record<ModuleCategory, DrawFn> = {
  drive: (ctx, s) => {
    ctx.fillRect(16 * s, 10 * s, 16 * s, 28 * s);
    ctx.fillRect(12 * s, 14 * s, 4 * s, 20 * s);
    ctx.fillRect(32 * s, 14 * s, 4 * s, 20 * s);
    for (let i = 0; i < 3; i++) {
      const y = (38 + i * 3) * s;
      ctx.fillRect((18 + i * 4) * s, y, 2 * s, 4 * s);
    }
  },

  cargo: (ctx, s) => {
    ctx.strokeRect(10 * s, 12 * s, 28 * s, 24 * s);
    ctx.beginPath();
    ctx.moveTo(10 * s, 24 * s);
    ctx.lineTo(38 * s, 24 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24 * s, 12 * s);
    ctx.lineTo(24 * s, 36 * s);
    ctx.stroke();
  },

  scanner: (ctx, s) => {
    ctx.beginPath();
    ctx.arc(24 * s, 28 * s, 14 * s, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.fillRect(22 * s, 28 * s, 4 * s, 10 * s);
    ctx.beginPath();
    ctx.moveTo(24 * s, 28 * s);
    ctx.lineTo(14 * s, 16 * s);
    ctx.stroke();
  },

  armor: (ctx, s) => {
    for (let i = 0; i < 3; i++) {
      const y = (12 + i * 10) * s;
      ctx.beginPath();
      ctx.moveTo(10 * s, y + 8 * s);
      ctx.lineTo(24 * s, y);
      ctx.lineTo(38 * s, y + 8 * s);
      ctx.stroke();
    }
  },

  weapon: (ctx, s) => {
    ctx.fillRect(10 * s, 20 * s, 22 * s, 8 * s);
    ctx.fillRect(32 * s, 18 * s, 6 * s, 12 * s);
    ctx.beginPath();
    ctx.moveTo(38 * s, 24 * s);
    ctx.lineTo(46 * s, 20 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38 * s, 24 * s);
    ctx.lineTo(46 * s, 24 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38 * s, 24 * s);
    ctx.lineTo(46 * s, 28 * s);
    ctx.stroke();
  },

  shield: (ctx, s) => {
    ctx.beginPath();
    ctx.arc(24 * s, 24 * s, 16 * s, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(24 * s, 24 * s, 10 * s, 0, 2 * Math.PI);
    ctx.stroke();
  },

  defense: (ctx, s) => {
    ctx.fillRect(14 * s, 28 * s, 20 * s, 8 * s);
    ctx.fillRect(18 * s, 18 * s, 12 * s, 10 * s);
    ctx.fillRect(22 * s, 8 * s, 4 * s, 12 * s);
  },

  special: (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(24 * s, 6 * s);
    ctx.lineTo(38 * s, 24 * s);
    ctx.lineTo(24 * s, 42 * s);
    ctx.lineTo(10 * s, 24 * s);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24 * s, 14 * s);
    ctx.lineTo(24 * s, 34 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16 * s, 24 * s);
    ctx.lineTo(32 * s, 24 * s);
    ctx.stroke();
  },

  mining: (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(24 * s, 38 * s);
    ctx.lineTo(16 * s, 18 * s);
    ctx.lineTo(32 * s, 18 * s);
    ctx.closePath();
    ctx.stroke();
    ctx.fillRect(22 * s, 8 * s, 4 * s, 12 * s);
    ctx.fillRect(12 * s, 38 * s, 2 * s, 2 * s);
    ctx.fillRect(34 * s, 36 * s, 2 * s, 2 * s);
    ctx.fillRect(18 * s, 42 * s, 2 * s, 2 * s);
  },

  generator: (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(28 * s, 6 * s);
    ctx.lineTo(18 * s, 22 * s);
    ctx.lineTo(26 * s, 22 * s);
    ctx.lineTo(16 * s, 42 * s);
    ctx.lineTo(30 * s, 22 * s);
    ctx.lineTo(22 * s, 22 * s);
    ctx.lineTo(32 * s, 6 * s);
    ctx.closePath();
    ctx.fill();
  },

  repair: (ctx, s) => {
    ctx.fillRect(20 * s, 8 * s, 8 * s, 32 * s);
    ctx.fillRect(10 * s, 18 * s, 28 * s, 8 * s);
    ctx.beginPath();
    ctx.arc(24 * s, 10 * s, 4 * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(24 * s, 38 * s, 4 * s, 0, 2 * Math.PI);
    ctx.fill();
  },
};

export function ModuleArtwork({ category, tier }: ModuleArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const S = 2; // retina scale
    const { blur, alpha } = tierGlow(tier);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Set glow
    ctx.shadowColor = `rgba(255, 176, 0, ${alpha})`;
    ctx.shadowBlur = blur * S; // scale to canvas coords (visual = blur CSS px)

    // Set draw color
    const color = amberColor(alpha);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * S;

    // Draw category icon
    DRAW_ROUTINES[category](ctx, S);

    ctx.restore();
  }, [category, tier]);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={96}
      style={{ width: '48px', height: '48px', display: 'block', margin: '0 auto 8px' }}
    />
  );
}
