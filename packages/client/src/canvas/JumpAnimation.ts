export interface JumpAnimationState {
  active: boolean;
  phase: 'glitch' | 'slide' | 'settle' | 'none';
  progress: number; // 0-1 within current phase
  direction: { dx: number; dy: number };
  startTime: number;
}

const PHASE_DURATIONS = {
  glitch: 200,
  slide: 400,
  settle: 200,
};

const TOTAL_DURATION = 800;

export function createJumpAnimation(dx: number, dy: number): JumpAnimationState {
  return {
    active: true,
    phase: 'glitch',
    progress: 0,
    direction: { dx, dy },
    startTime: performance.now(),
  };
}

export function updateJumpAnimation(state: JumpAnimationState, now: number): JumpAnimationState {
  if (!state.active) return state;

  const elapsed = now - state.startTime;
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
