import { describe, it, expect } from 'vitest';
import { compileProgram } from '../compiler.js';

const MK5 = { level: 5, maxLength: 120 };

describe('compiler — sequential commands', () => {
  it('emits FLY/SCAN/MINE/SELL in order', () => {
    const res = compileProgram('fly 3:5\nscan\nmine until full\nsell all', MK5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.instructions).toEqual([
      { op: 'FLY', x: 3, y: 5, line: 1 },
      { op: 'SCAN', line: 2 },
      { op: 'MINE', mode: 'until_full', amount: 0, line: 3 },
      { op: 'SELL', target: 'all', line: 4 },
    ]);
    expect(res.statementCount).toBe(4);
  });

  it('propagates parser errors as a compile failure', () => {
    const res = compileProgram('warp 9:9', MK5);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0].message).toContain('Unbekannter Befehl');
  });
});
