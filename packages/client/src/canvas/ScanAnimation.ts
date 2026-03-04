/**
 * Scan animation state machine — mirrors JumpAnimation.ts pattern.
 *
 * Area scan: 3 expanding pulse rings from ship position, CRT flicker between pulses.
 * Local scan: 3 pulses on current cell only, CRT flicker.
 */

export interface ScanAnimationState {
  active: boolean;
  type: 'local' | 'area';
  pulseCount: number;      // current pulse (0, 1, 2)
  progress: number;        // 0–1 within current pulse
  startTime: number;
  totalDuration: number;   // ms
}

const AREA_PULSE_DURATION = 800;  // ms per pulse ring
const LOCAL_PULSE_DURATION = 500;
const SETTLE_PAUSE = 200;         // ms pause between pulses
const NUM_PULSES = 3;

export function createScanAnimation(type: 'local' | 'area'): ScanAnimationState {
  const pulseDur = type === 'area' ? AREA_PULSE_DURATION : LOCAL_PULSE_DURATION;
  return {
    active: true,
    type,
    pulseCount: 0,
    progress: 0,
    startTime: performance.now(),
    totalDuration: NUM_PULSES * (pulseDur + SETTLE_PAUSE),
  };
}

export function updateScanAnimation(state: ScanAnimationState, now: number): ScanAnimationState {
  if (!state.active) return state;

  const pulseDur = state.type === 'area' ? AREA_PULSE_DURATION : LOCAL_PULSE_DURATION;
  const cycleDur = pulseDur + SETTLE_PAUSE;
  const elapsed = now - state.startTime;

  if (elapsed >= state.totalDuration) {
    return { ...state, active: false, pulseCount: NUM_PULSES - 1, progress: 1 };
  }

  const currentPulse = Math.min(Math.floor(elapsed / cycleDur), NUM_PULSES - 1);
  const pulseElapsed = elapsed - currentPulse * cycleDur;
  const progress = Math.min(pulseElapsed / pulseDur, 1);

  return { ...state, pulseCount: currentPulse, progress };
}

/**
 * Draw scan animation overlay on the radar canvas.
 * Called after grid is drawn — renders expanding rings and status text.
 */
export function drawScanOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerX: number,
  centerY: number,
  cellSize: number,
  state: ScanAnimationState,
  scanRange: number,
): void {
  if (!state.active) return;

  const now = performance.now();
  const { type, pulseCount, progress } = state;

  // --- Expanding pulse rings ---
  if (type === 'area') {
    // Each pulse covers 0→scanRange cells
    for (let p = 0; p <= pulseCount; p++) {
      const pProgress = p < pulseCount ? 1 : progress;
      const radius = pProgress * scanRange * cellSize;
      const alpha = p < pulseCount
        ? 0.08  // older pulses are faint
        : 0.25 * (1 - progress * 0.6);  // current pulse fades

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 176, 0, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner glow ring
      if (p === pulseCount && progress < 0.9) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 220, 80, ${alpha * 0.5})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
  } else {
    // Local scan: pulse on current cell only
    const maxRadius = cellSize * 0.8;
    const radius = progress * maxRadius;
    const alpha = 0.35 * (1 - progress * 0.5);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 176, 0, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill pulse
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 176, 0, ${alpha * 0.15})`;
    ctx.fill();
  }

  // --- CRT glitch/scanline flash during pulses ---
  const glitchIntensity = 0.15 * (1 - progress);
  if (glitchIntensity > 0.02) {
    // Horizontal scanline displacement
    const numBars = 2 + pulseCount;
    for (let i = 0; i < numBars; i++) {
      const barY = ((now * 0.3 + i * 137) % h);
      const barH = 2 + Math.random() * 3;
      const shift = (Math.random() - 0.5) * 6 * glitchIntensity;
      ctx.save();
      ctx.globalAlpha = glitchIntensity * 0.6;
      ctx.drawImage(ctx.canvas, 0, barY, w, barH, shift, barY, w, barH);
      ctx.restore();
    }

    // Static noise flash at pulse transitions
    if (progress < 0.1 || progress > 0.9) {
      ctx.save();
      ctx.globalAlpha = glitchIntensity * 0.3;
      ctx.fillStyle = `rgba(255, 176, 0, ${glitchIntensity * 0.1})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // --- Blinking status text ---
  const blink = Math.sin(now / 200) > 0;
  if (blink) {
    const label = type === 'area' ? 'AREA SCAN LÄUFT' : 'SEKTOR SCAN LÄUFT';
    ctx.save();
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 176, 0, 0.9)';
    ctx.shadowColor = '#FFB000';
    ctx.shadowBlur = 8;
    ctx.fillText(label, w / 2, 30);
    ctx.shadowBlur = 3;
    ctx.fillText(label, w / 2, 30);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
