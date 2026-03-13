import { describe, it, expect } from 'vitest';

describe('Mining auto-stop logic', () => {
  const shouldAutoStop = (miningActive: boolean, cargoTotal: number, cargoCap: number) =>
    miningActive && cargoTotal >= cargoCap;

  it('stops when cargo full and mining active', () => {
    expect(shouldAutoStop(true, 50, 50)).toBe(true);
  });
  it('does not stop when cargo not full', () => {
    expect(shouldAutoStop(true, 49, 50)).toBe(false);
  });
  it('does not stop when not mining', () => {
    expect(shouldAutoStop(false, 50, 50)).toBe(false);
  });
});
