import { useCallback, useEffect } from 'react';
import { useCanvas } from '../canvas/useCanvas';
import { drawRadar, CELL_SIZES, FRAME_LEFT, FRAME_PAD, FRAME_BOTTOM } from '../canvas/RadarRenderer';
import { updateJumpAnimation } from '../canvas/JumpAnimation';
import { useStore } from '../state/store';
import { COLOR_PROFILES } from '../styles/themes';

export function RadarCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const state = useStore.getState();
    const themeColors = COLOR_PROFILES[state.colorProfile];

    // Update jump animation each frame
    let jumpAnimation = state.jumpAnimation;
    if (jumpAnimation && jumpAnimation.active) {
      jumpAnimation = updateJumpAnimation(jumpAnimation, performance.now());
      // Write back updated animation state (without triggering unnecessary re-renders)
      if (!jumpAnimation.active) {
        useStore.getState().clearJumpAnimation();
        jumpAnimation = null;
      }
    }

    drawRadar(ctx, {
      position: state.position,
      discoveries: state.discoveries,
      players: state.players,
      currentSector: state.currentSector,
      themeColor: themeColors.primary,
      dimColor: themeColors.dim,
      zoomLevel: state.zoomLevel,
      panOffset: state.panOffset,
      jumpAnimation,
      selectedSector: state.selectedSector,
      jumpGateInfo: state.jumpGateInfo,
      scanEvents: state.scanEvents,
      discoveryTimestamps: state.discoveryTimestamps,
      hullType: state.ship?.hullType,
      homeBase: state.homeBase,
      bookmarks: state.bookmarks,
      animTime: performance.now(),
    });
  }, []);

  const canvasRef = useCanvas(draw);

  // Mousewheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const current = useStore.getState().zoomLevel;
      const next = e.deltaY < 0 ? Math.min(4, current + 1) : Math.max(0, current - 1);
      useStore.getState().setZoomLevel(next);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Drag pan + double-click recenter
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let dragMoved = false;
    let dragStartX = 0, dragStartY = 0;
    let panStartX = 0, panStartY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const pan = useStore.getState().panOffset;
      panStartX = pan.x;
      panStartY = pan.y;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const movedX = Math.abs(e.clientX - dragStartX);
      const movedY = Math.abs(e.clientY - dragStartY);
      if (movedX > 5 || movedY > 5) dragMoved = true;
      const cellW = CELL_SIZES[useStore.getState().zoomLevel]?.w ?? 64;
      const cellH = CELL_SIZES[useStore.getState().zoomLevel]?.h ?? 50;
      const dx = Math.round((e.clientX - dragStartX) / cellW);
      const dy = Math.round((e.clientY - dragStartY) / cellH);
      const newX = Math.max(-3, Math.min(3, panStartX - dx));
      const newY = Math.max(-3, Math.min(3, panStartY + dy));
      useStore.getState().setPanOffset({ x: newX, y: newY });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragMoved && dragging && canvas) {
        // Click — calculate which cell was clicked
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const state = useStore.getState();
        const { w: cellW, h: cellH } = CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1];
        const gridCenterX = FRAME_LEFT + (rect.width - FRAME_LEFT - FRAME_PAD) / 2;
        const gridCenterY = FRAME_PAD + (rect.height - FRAME_PAD - FRAME_BOTTOM) / 2;
        const dx = Math.round((clickX - gridCenterX) / cellW);
        const dy = Math.round((clickY - gridCenterY) / cellH);
        const viewX = state.position.x + state.panOffset.x;
        const viewY = state.position.y + state.panOffset.y;
        state.setSelectedSector({ x: viewX + dx, y: viewY + dy });
      }
      dragging = false;
    };

    const onDblClick = () => { useStore.getState().resetPan(); };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, []);

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
