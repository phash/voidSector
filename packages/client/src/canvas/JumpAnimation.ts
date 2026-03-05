export interface JumpAnimationState {
  active: boolean;
  phase: 'glitch' | 'slide' | 'settle' | 'none';
  progress: number; // 0-1 within current phase
  direction: { dx: number; dy: number };
  startTime: number;
  /** Distance in sectors — used to scale CRT effects for long jumps. */
  distance: number;
  /** Whether this is a heavy/long jump (>20 sectors). */
  isLongJump: boolean;
}

/** Threshold in sectors above which the heavy CRT effect kicks in. */
export const LONG_JUMP_THRESHOLD = 20;

const PHASE_DURATIONS = {
  glitch: 200,
  slide: 400,
  settle: 200,
};

const TOTAL_DURATION = 800;

/** Heavy phase durations for long jumps — scales with distance. */
function longJumpDurations(distance: number) {
  const scale = Math.min(3, 1 + (distance - LONG_JUMP_THRESHOLD) / 40);
  return {
    glitch: Math.round(300 * scale),
    slide: Math.round(600 * scale),
    settle: Math.round(300 * scale),
    total: Math.round(1200 * scale),
  };
}

export function createJumpAnimation(dx: number, dy: number, distance?: number): JumpAnimationState {
  const dist = distance ?? Math.abs(dx) + Math.abs(dy);
  return {
    active: true,
    phase: 'glitch',
    progress: 0,
    direction: { dx, dy },
    startTime: performance.now(),
    distance: dist,
    isLongJump: dist > LONG_JUMP_THRESHOLD,
  };
}

export function updateJumpAnimation(state: JumpAnimationState, now: number): JumpAnimationState {
  if (!state.active) return state;

  const elapsed = now - state.startTime;

  if (state.isLongJump) {
    const durations = longJumpDurations(state.distance);
    if (elapsed >= durations.total) {
      return { ...state, active: false, phase: 'none', progress: 1 };
    }
    if (elapsed < durations.glitch) {
      return { ...state, phase: 'glitch', progress: elapsed / durations.glitch };
    }
    if (elapsed < durations.glitch + durations.slide) {
      const slideElapsed = elapsed - durations.glitch;
      return { ...state, phase: 'slide', progress: slideElapsed / durations.slide };
    }
    const settleElapsed = elapsed - durations.glitch - durations.slide;
    return { ...state, phase: 'settle', progress: settleElapsed / durations.settle };
  }

  // Standard jump animation
  if (elapsed >= TOTAL_DURATION) {
    return { ...state, active: false, phase: 'none', progress: 1 };
  }

  if (elapsed < PHASE_DURATIONS.glitch) {
    return { ...state, phase: 'glitch', progress: elapsed / PHASE_DURATIONS.glitch };
  }
  if (elapsed < PHASE_DURATIONS.glitch + PHASE_DURATIONS.slide) {
    const slideElapsed = elapsed - PHASE_DURATIONS.glitch;
    return { ...state, phase: 'slide', progress: slideElapsed / PHASE_DURATIONS.slide };
  }
  const settleElapsed = elapsed - PHASE_DURATIONS.glitch - PHASE_DURATIONS.slide;
  return { ...state, phase: 'settle', progress: settleElapsed / PHASE_DURATIONS.settle };
}

/**
 * Draw heavy CRT effects for long-distance jumps.
 * Called from the radar renderer after normal glitch overlay.
 * Adds intense scanlines, chromatic aberration, and noise overlay.
 */
export function drawLongJumpCRTEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: JumpAnimationState,
) {
  if (!state.active || !state.isLongJump) return;

  const intensity =
    state.phase === 'glitch'
      ? 0.6 + 0.4 * (1 - state.progress)
      : state.phase === 'slide'
        ? 0.4 * (1 - state.progress)
        : 0.2 * (1 - state.progress);

  // Intense scanlines
  ctx.save();
  ctx.globalAlpha = intensity * 0.3;
  ctx.fillStyle = '#000';
  for (let y = 0; y < height; y += 2) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();

  // Chromatic aberration — shift red and blue channels
  if (intensity > 0.2) {
    const shift = Math.round(intensity * 6);
    if (shift > 0) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const copy = new Uint8ClampedArray(data);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          // Shift red channel right
          const srcRedX = Math.min(width - 1, x + shift);
          const srcRedIdx = (y * width + srcRedX) * 4;
          data[idx] = copy[srcRedIdx]; // R

          // Shift blue channel left
          const srcBlueX = Math.max(0, x - shift);
          const srcBlueIdx = (y * width + srcBlueX) * 4;
          data[idx + 2] = copy[srcBlueIdx]; // B
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  // Noise overlay
  if (intensity > 0.1) {
    ctx.save();
    ctx.globalAlpha = intensity * 0.15;
    const noiseCount = Math.round(intensity * 200);
    for (let i = 0; i < noiseCount; i++) {
      const nx = Math.random() * width;
      const ny = Math.random() * height;
      const brightness = Math.random() > 0.5 ? '#FFF' : '#000';
      ctx.fillStyle = brightness;
      ctx.fillRect(nx, ny, 2, 1);
    }
    ctx.restore();
  }
}
