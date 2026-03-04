import { useRef, useEffect } from 'react';

const COLORS = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000'];

export function TestPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      const w = canvas!.width = canvas!.offsetWidth;
      const h = canvas!.height = canvas!.offsetHeight;
      if (w === 0 || h === 0) return;

      // Color bars (top 60%)
      const barH = h * 0.6;
      const barW = w / COLORS.length;
      COLORS.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(i * barW, 0, barW + 1, barH);
      });

      // Grayscale ramp (middle 15%)
      const grayH = h * 0.15;
      const grayY = barH;
      for (let i = 0; i < 16; i++) {
        const v = Math.round((i / 15) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect((i / 16) * w, grayY, w / 16 + 1, grayH);
      }

      // Black area with "KEIN SIGNAL" (bottom 25%)
      const bottomY = grayY + grayH;
      const bottomH = h - bottomY;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, bottomY, w, bottomH);

      // Text
      ctx.font = `bold ${Math.max(14, w * 0.04)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#aaa';
      ctx.fillText('KEIN SIGNAL', w / 2, bottomY + bottomH * 0.5);

      // Noise overlay
      const now = performance.now();
      ctx.globalAlpha = 0.06 + Math.sin(now / 300) * 0.02;
      const imageData = ctx.createImageData(w, Math.min(bottomH, 40));
      for (let i = 0; i < imageData.data.length; i += 4) {
        const v = Math.random() * 255;
        imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = v;
        imageData.data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, bottomY + bottomH - 40);
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      data-testid="test-pattern"
    />
  );
}
