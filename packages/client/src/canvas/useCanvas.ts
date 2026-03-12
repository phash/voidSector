import { useRef, useLayoutEffect, useEffect, useCallback } from 'react';

type DrawFn = (ctx: CanvasRenderingContext2D) => void;

export function useCanvas(draw: DrawFn) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [resize]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frameId: number;
    const render = () => {
      try {
        // Get fresh context on every frame to avoid stale context errors
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        draw(ctx);
      } catch (e) {
        // Silently handle InvalidStateError and other transient errors
        if (e instanceof Error && e.name === 'InvalidStateError') {
          // Canvas context was invalidated, will recover on next frame
          return;
        }
        console.error('[radar] render exception:', e);
      }
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  return canvasRef;
}
