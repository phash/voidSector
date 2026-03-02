import { useCallback } from 'react';
import { useCanvas } from '../canvas/useCanvas';
import { drawRadar } from '../canvas/RadarRenderer';
import { useStore } from '../state/store';
import { THEME } from '@void-sector/shared';

export function RadarCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const state = useStore.getState();
    const themeColors = THEME[state.theme];

    drawRadar(ctx, {
      position: state.position,
      discoveries: state.discoveries,
      players: state.players,
      currentSector: state.currentSector,
      themeColor: themeColors.primary,
      dimColor: themeColors.dim,
    });
  }, []);

  const canvasRef = useCanvas(draw);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
