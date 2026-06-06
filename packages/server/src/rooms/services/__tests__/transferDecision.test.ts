import { describe, it, expect } from 'vitest';
import { resolveTransfer } from '../transferDecision.js';

describe('resolveTransfer', () => {
  it('allows depositing when the ship holds enough', () => {
    expect(resolveTransfer('toStorage', 'ore', 5, 10, 0, true)).toEqual({ ok: true });
  });

  it('allows withdrawing when storage holds enough and ship has space', () => {
    expect(resolveTransfer('fromStorage', 'gas', 3, 0, 5, true)).toEqual({ ok: true });
  });

  it('rejects deposit when the ship holds too little', () => {
    const r = resolveTransfer('toStorage', 'ore', 5, 4, 0, true);
    expect(r).toEqual({ ok: false, code: 'INSUFFICIENT', message: 'Nicht genug im Schiff' });
  });

  it('rejects withdraw when storage holds too little', () => {
    const r = resolveTransfer('fromStorage', 'crystal', 5, 0, 4, true);
    expect(r).toEqual({ ok: false, code: 'INSUFFICIENT', message: 'Nicht genug im Lager' });
  });

  it('rejects withdraw when the ship has no cargo space', () => {
    const r = resolveTransfer('fromStorage', 'ore', 5, 0, 10, false);
    expect(r).toEqual({ ok: false, code: 'CARGO_FULL', message: 'Nicht genug Frachtraum' });
  });

  it('rejects an unknown resource', () => {
    expect(resolveTransfer('toStorage', 'plutonium', 1, 10, 0, true).ok).toBe(false);
  });

  it('rejects non-positive or non-integer amounts', () => {
    expect(resolveTransfer('toStorage', 'ore', 0, 10, 0, true).ok).toBe(false);
    expect(resolveTransfer('toStorage', 'ore', -3, 10, 0, true).ok).toBe(false);
    expect(resolveTransfer('toStorage', 'ore', 1.5, 10, 0, true).ok).toBe(false);
  });

  it('does not require cargo space for deposits (space flag ignored toStorage)', () => {
    expect(resolveTransfer('toStorage', 'ore', 5, 10, 0, false)).toEqual({ ok: true });
  });
});
