import { TUTORIAL_MINE_ORE_TARGET } from '@void-sector/shared';

export interface TutorialEngineState {
  step: number;
  oreMined: number;
  done: boolean;
}

export type TutorialEvent =
  | { type: 'move' }
  | { type: 'scan' }
  | { type: 'mine'; resource: string; amount: number }
  | { type: 'starter_bounty' };

export interface TutorialEventResult {
  state: TutorialEngineState;
  /** true wenn Schritt oder Erz-Zähler sich geändert hat (→ Update senden + persistieren) */
  changed: boolean;
  /** true genau beim Übergang in den Abschluss (→ Reward auszahlen) */
  completed: boolean;
}

/**
 * Pure Zustandsmaschine der Tutorial-Kette: BEWEGEN → SCANNEN → MINEN → LIEFERN.
 * Aktionen außerhalb des aktuellen Schritts zählen nicht (kein Vorab-Fortschritt).
 */
export function applyTutorialEvent(
  state: TutorialEngineState,
  event: TutorialEvent,
): TutorialEventResult {
  const noop: TutorialEventResult = { state, changed: false, completed: false };
  if (state.done) return noop;

  switch (event.type) {
    case 'move':
      if (state.step !== 0) return noop;
      return { state: { ...state, step: 1 }, changed: true, completed: false };
    case 'scan':
      if (state.step !== 1) return noop;
      return { state: { ...state, step: 2 }, changed: true, completed: false };
    case 'mine': {
      if (state.step !== 2 || event.resource !== 'ore' || event.amount <= 0) return noop;
      const oreMined = state.oreMined + event.amount;
      const reached = oreMined >= TUTORIAL_MINE_ORE_TARGET;
      return {
        state: { ...state, oreMined, step: reached ? 3 : 2 },
        changed: true,
        completed: false,
      };
    }
    case 'starter_bounty':
      if (state.step !== 3) return noop;
      return { state: { ...state, done: true }, changed: true, completed: true };
    default:
      return noop;
  }
}
