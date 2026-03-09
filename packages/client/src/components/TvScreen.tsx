import { useEffect, useRef } from 'react';

const ADS = [
  'VOID-CORP™',
  'MINING ISN\'T JUST A JOB,',
  'IT\'S A LIFESTYLE.',
  '---',
  'VISIT QUADRANT 0:0',
  'HUMANITY\'S PROUD CENTER™',
  '(TERMS APPLY)',
  '---',
  'BUY ORE. SELL ORE.',
  'REPEAT.',
  'VOID-MART™',
  '---',
  'TIRED OF THE EDGE?',
  'THERE IS NO EDGE.',
  'QUADRANT BOARD OF TOURISM',
  '---',
  'INSURANCE FOR YOUR SHIP.',
  'ASK ABOUT OUR',
  'PIRATE COVERAGE.',
  '---',
  'SECTOR 0:0 REALTY',
  'PRIME LOCATION.',
  'ZERO PIRATES.*',
  '* PIRATES NOT INCLUDED',
];

const LINE_INTERVAL_MS = 2200;
const VISIBLE_LINES = 8;

export function TvScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineIndexRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastLineTimeRef = useRef(performance.now());
  const displayedLinesRef = useRef<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      const w = (canvas!.width = canvas!.offsetWidth);
      const h = (canvas!.height = canvas!.offsetHeight);
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const now = performance.now();
      if (now - lastLineTimeRef.current > LINE_INTERVAL_MS) {
        const line = ADS[lineIndexRef.current % ADS.length];
        displayedLinesRef.current = [line, ...displayedLinesRef.current].slice(0, VISIBLE_LINES);
        lineIndexRef.current++;
        lastLineTimeRef.current = now;
      }

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      // Scanline effect
      ctx.fillStyle = 'rgba(0,255,0,0.015)';
      const scanY = ((now / 12) % h);
      ctx.fillRect(0, scanY, w, 2);

      // CRT noise
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 6; i++) {
        const nx = Math.random() * w;
        const ny = Math.random() * h;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(nx, ny, Math.random() * 80 + 20, 1);
      }
      ctx.globalAlpha = 1;

      const fontSize = Math.max(10, Math.min(14, w / 22));
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx.textAlign = 'center';

      // Station ident header
      ctx.fillStyle = 'rgba(0,200,0,0.25)';
      ctx.fillText('■ VOID-NET BROADCAST CHANNEL ■', w / 2, 20);

      const lineH = fontSize + 6;
      const startY = h / 2 - (displayedLinesRef.current.length * lineH) / 2;

      displayedLinesRef.current.forEach((line, i) => {
        const age = displayedLinesRef.current.length - i;
        const alpha = Math.max(0.1, 1 - age * 0.1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = line === '---' ? 'rgba(0,180,0,0.4)' : '#00cc00';
        ctx.fillText(line, w / 2, startY + i * lineH);
      });
      ctx.globalAlpha = 1;

      // Blinking cursor
      if (Math.floor(now / 500) % 2 === 0) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText('_', w / 2, startY + displayedLinesRef.current.length * lineH + 4);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      data-testid="tv-screen"
    />
  );
}
