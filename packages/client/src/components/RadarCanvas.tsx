import { useCallback, useEffect, useRef } from 'react';
import { useCanvas } from '../canvas/useCanvas';
import {
  drawRadar,
  CELL_SIZES,
  FRAME_LEFT,
  FRAME_PAD,
  FRAME_BOTTOM,
  calculateVisibleRadius,
} from '../canvas/RadarRenderer';
import { updateJumpAnimation } from '../canvas/JumpAnimation';
import { updateScanAnimation, drawScanOverlay } from '../canvas/ScanAnimation';
import { useStore } from '../state/store';
import { COLOR_PROFILES } from '../styles/themes';

const DOUBLE_TAP_DELAY = 300;

export function RadarCanvas() {
  const lastTapRef = useRef(0);

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

    // Update scan animation each frame
    let scanAnimation = state.scanAnimation;
    if (scanAnimation && scanAnimation.active) {
      scanAnimation = updateScanAnimation(scanAnimation, performance.now());
      if (!scanAnimation.active) {
        useStore.getState().clearScanAnimation();
        scanAnimation = null;
      }
    }

    // Update ship move animation (#155)
    let shipMoveAnimation = state.shipMoveAnimation;
    if (shipMoveAnimation) {
      const elapsed = performance.now() - shipMoveAnimation.startTime;
      if (elapsed >= shipMoveAnimation.duration) {
        useStore.getState().clearShipMoveAnimation();
        shipMoveAnimation = null;
      }
    }

    const radarState = {
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
      acepXp: state.ship?.acepXp ?? null,
      homeBase: state.homeBase,
      bookmarks: state.bookmarks,
      animTime: performance.now(),
      scanBurstTimestamps: state.scanBurstTimestamps,
      navTarget: state.navTarget,
      visitedTrail: state.visitedTrail,
      shipMoveAnimation,
      activeQuests: state.activeQuests,
      miningActive: !!state.mining?.active,
    };

    drawRadar(ctx, radarState);

    // Draw scan overlay after radar — centered on player (offset by pan)
    if (scanAnimation?.active) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const cellEntry = CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1];
      const cellW = cellEntry.w;
      const cellH = cellEntry.h;
      const gridCenterX = FRAME_LEFT + (w - FRAME_LEFT - FRAME_PAD) / 2;
      const gridCenterY = FRAME_PAD + (h - FRAME_PAD - FRAME_BOTTOM) / 2;
      // Player is at grid center minus pan offset (pan moves the viewport, not the player)
      const playerCenterX = gridCenterX - state.panOffset.x * cellW;
      const playerCenterY = gridCenterY - state.panOffset.y * cellH;
      // Use the full visible radar radius so waves reach the edge of the viewport
      const { radiusX, radiusY } = calculateVisibleRadius(w, h, state.zoomLevel);
      const scanRange = Math.ceil(Math.sqrt(radiusX * radiusX + radiusY * radiusY));
      drawScanOverlay(ctx, w, h, playerCenterX, playerCenterY, cellW, scanAnimation, scanRange);
    }
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

  // Drag pan + double-click recenter + double-tap recenter
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let dragMoved = false;
    let dragStartX = 0,
      dragStartY = 0;
    let panStartX = 0,
      panStartY = 0;

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
      const newX = Math.max(-100, Math.min(100, panStartX - dx));
      const newY = Math.max(-100, Math.min(100, panStartY + dy));
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

    const onDblClick = () => {
      useStore.getState().resetPan();
    };

    // Double-tap detection for touch devices
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        e.preventDefault();
        useStore.getState().resetPan();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    const current = useStore.getState().zoomLevel;
    useStore.getState().setZoomLevel(Math.min(4, current + 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    const current = useStore.getState().zoomLevel;
    useStore.getState().setZoomLevel(Math.max(0, current - 1));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
        }}
      />
      <div className="mobile-zoom-controls">
        <button className="mobile-zoom-btn" onClick={handleZoomIn} aria-label="Zoom in">
          +
        </button>
        <button className="mobile-zoom-btn" onClick={handleZoomOut} aria-label="Zoom out">
          −
        </button>
      </div>
    </div>
  );
}
