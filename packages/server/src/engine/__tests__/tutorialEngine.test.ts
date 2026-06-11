import { describe, expect, it } from 'vitest';
import { TUTORIAL_MINE_ORE_TARGET, TUTORIAL_TOTAL_STEPS } from '@void-sector/shared';
import { applyTutorialEvent, type TutorialEngineState } from '../tutorialEngine.js';

const fresh: TutorialEngineState = { step: 0, oreMined: 0, done: false };

describe('applyTutorialEvent', () => {
  it('advances step 0 → 1 on move', () => {
    const r = applyTutorialEvent(fresh, { type: 'move' });
    expect(r.state.step).toBe(1);
    expect(r.changed).toBe(true);
    expect(r.completed).toBe(false);
  });

  it('ignores scan at step 0 (wrong order)', () => {
    const r = applyTutorialEvent(fresh, { type: 'scan' });
    expect(r.state).toEqual(fresh);
    expect(r.changed).toBe(false);
  });

  it('advances step 1 → 2 on scan', () => {
    const r = applyTutorialEvent({ ...fresh, step: 1 }, { type: 'scan' });
    expect(r.state.step).toBe(2);
    expect(r.changed).toBe(true);
  });

  it('ignores repeated move at step 1', () => {
    const r = applyTutorialEvent({ ...fresh, step: 1 }, { type: 'move' });
    expect(r.changed).toBe(false);
  });

  it('accumulates ore at step 2 without advancing below target', () => {
    const r = applyTutorialEvent({ ...fresh, step: 2 }, { type: 'mine', resource: 'ore', amount: 2 });
    expect(r.state.step).toBe(2);
    expect(r.state.oreMined).toBe(2);
    expect(r.changed).toBe(true);
  });

  it('advances step 2 → 3 when ore target reached across calls', () => {
    const mid = applyTutorialEvent({ ...fresh, step: 2 }, { type: 'mine', resource: 'ore', amount: 3 });
    const r = applyTutorialEvent(mid.state, {
      type: 'mine',
      resource: 'ore',
      amount: TUTORIAL_MINE_ORE_TARGET - 3,
    });
    expect(r.state.step).toBe(3);
    expect(r.changed).toBe(true);
    expect(r.completed).toBe(false);
  });

  it('ignores non-ore mining at step 2', () => {
    const r = applyTutorialEvent({ ...fresh, step: 2 }, { type: 'mine', resource: 'gas', amount: 5 });
    expect(r.changed).toBe(false);
  });

  it('ignores ore mined before step 2', () => {
    const r = applyTutorialEvent(fresh, { type: 'mine', resource: 'ore', amount: 5 });
    expect(r.state.oreMined).toBe(0);
    expect(r.changed).toBe(false);
  });

  it('completes on starter bounty at step 3', () => {
    const r = applyTutorialEvent({ step: 3, oreMined: 5, done: false }, { type: 'starter_bounty' });
    expect(r.state.done).toBe(true);
    expect(r.completed).toBe(true);
    expect(r.changed).toBe(true);
  });

  it('is a no-op once done', () => {
    const doneState: TutorialEngineState = { step: TUTORIAL_TOTAL_STEPS - 1, oreMined: 5, done: true };
    for (const ev of [
      { type: 'move' } as const,
      { type: 'scan' } as const,
      { type: 'mine', resource: 'ore', amount: 5 } as const,
      { type: 'starter_bounty' } as const,
    ]) {
      const r = applyTutorialEvent(doneState, ev);
      expect(r.changed).toBe(false);
      expect(r.completed).toBe(false);
    }
  });
});
