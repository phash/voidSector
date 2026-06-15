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

describe('compiler — if/else', () => {
  it('compiles if-without-else: JUMP_IF_FALSE skips the then-block', () => {
    // 0: JUMP_IF_FALSE -> 2
    // 1: SCAN
    // (2: end)
    const res = compileProgram('if resources:\n  scan', { level: 5, maxLength: 120 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.instructions).toEqual([
      { op: 'JUMP_IF_FALSE', cond: { kind: 'resources', negate: false }, target: 2, line: 1 },
      { op: 'SCAN', line: 2 },
    ]);
  });

  it('compiles if/else: false jumps to else, then-block jumps over else', () => {
    // 0: JUMP_IF_FALSE -> 3 (else start)
    // 1: SCAN (then)
    // 2: JUMP -> 4 (after else)
    // 3: FLY (else)
    const res = compileProgram('if full:\n  scan\nelse:\n  fly 0:0', { level: 5, maxLength: 120 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.instructions).toEqual([
      { op: 'JUMP_IF_FALSE', cond: { kind: 'full', negate: false }, target: 3, line: 1 },
      { op: 'SCAN', line: 2 },
      { op: 'JUMP', target: 4, line: 1 },
      { op: 'FLY', x: 0, y: 0, line: 4 },
    ]);
  });
});

describe('compiler — loops', () => {
  it('compiles infinite repeat with count -1 and a back-edge to LOOP_CHECK', () => {
    // 0: PUSH_LOOP -1
    // 1: LOOP_CHECK -> 4
    // 2: SCAN
    // 3: LOOP_NEXT -> 1
    // (4: end)
    const res = compileProgram('repeat:\n  scan', { level: 5, maxLength: 120 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.instructions).toEqual([
      { op: 'PUSH_LOOP', count: -1, line: 1 },
      { op: 'LOOP_CHECK', target: 4, line: 1 },
      { op: 'SCAN', line: 2 },
      { op: 'LOOP_NEXT', target: 1, line: 1 },
    ]);
  });

  it('compiles `repeat 3 times` with count 3', () => {
    const res = compileProgram('repeat 3 times:\n  scan', { level: 5, maxLength: 120 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.instructions[0]).toEqual({ op: 'PUSH_LOOP', count: 3, line: 1 });
  });
});
