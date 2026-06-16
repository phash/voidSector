import { describe, it, expect, vi } from 'vitest';
import { compileProgram } from '@void-sector/shared';
import { stepProgram, initialVmState } from '../vm.js';

function fakeCtx(over: Partial<any> = {}) {
  return {
    move: vi.fn(async () => ({ ok: true, x: 0, y: 0, arrived: true })),
    scan: vi.fn(async () => ({ ok: true, resources: { ore: 0, gas: 0, crystal: 0 } })),
    mine: vi.fn(async () => ({ ok: true, mined: 0 })),
    sell: vi.fn(async () => ({ ok: true, credits: 0 })),
    evalCond: vi.fn(async () => true),
    ...over,
  };
}
const ok = (src: string) => { const r = compileProgram(src, { level: 5, maxLength: 120 }); if (!r.ok) throw new Error('compile'); return r.instructions; };

describe('stepProgram', () => {
  it('fly takes one sector per step until arrival', async () => {
    const instr = ok('fly 2:0\nscan');
    const ctx = fakeCtx({
      move: vi.fn()
        .mockResolvedValueOnce({ ok: true, x: 1, y: 0, arrived: false })
        .mockResolvedValueOnce({ ok: true, x: 2, y: 0, arrived: true }),
    });
    let pc = 0, vm = initialVmState();
    let r = await stepProgram('u1', instr, pc, vm, ctx); pc = r.pc; vm = r.vm;
    expect(ctx.move).toHaveBeenCalledTimes(1); expect(pc).toBe(0);
    r = await stepProgram('u1', instr, pc, vm, ctx); pc = r.pc; vm = r.vm;
    expect(pc).toBe(1);
  });

  it('pauses without advancing when a core fails', async () => {
    const instr = ok('scan');
    const ctx = fakeCtx({ scan: vi.fn(async () => ({ ok: false, reason: 'Nicht genug AP' })) });
    const r = await stepProgram('u1', instr, 0, initialVmState(), ctx);
    expect(r.status).toBe('paused'); expect(r.pc).toBe(0);
  });

  it('if-false jumps past the then-block', async () => {
    const instr = ok('if resources:\n  mine until full\nscan');
    const ctx = fakeCtx({ evalCond: vi.fn(async () => false) });
    const r = await stepProgram('u1', instr, 0, initialVmState(), ctx);
    expect(ctx.mine).not.toHaveBeenCalled();
    expect(instr[r.pc].op).toBe('SCAN');
  });

  it('if-true enters the then-block', async () => {
    const instr = ok('if resources:\n  mine until full\nscan');
    const ctx = fakeCtx({ evalCond: vi.fn(async () => true) });
    const r = await stepProgram('u1', instr, 0, initialVmState(), ctx);
    expect(instr[r.pc].op).toBe('MINE');
  });

  it('repeat 2 times runs the body twice then exits', async () => {
    const instr = ok('repeat 2 times:\n  scan');
    let pc = 0, vm = initialVmState(); let scans = 0;
    const ctx = fakeCtx({ scan: vi.fn(async () => { scans++; return { ok: true, resources: { ore: 0, gas: 0, crystal: 0 } }; }) });
    for (let i = 0; i < 30; i++) { const r = await stepProgram('u1', instr, pc, vm, ctx, 'once'); pc = r.pc; vm = r.vm; if (r.finished || r.status === 'idle') break; }
    expect(scans).toBe(2);
  });

  it('infinite repeat loops back to the top (mode loop)', async () => {
    const instr = ok('repeat:\n  scan');
    let pc = 0, vm = initialVmState(); let scans = 0;
    const ctx = fakeCtx({ scan: vi.fn(async () => { scans++; return { ok: true, resources: { ore: 0, gas: 0, crystal: 0 } }; }) });
    for (let i = 0; i < 10; i++) { const r = await stepProgram('u1', instr, pc, vm, ctx); pc = r.pc; vm = r.vm; }
    expect(scans).toBeGreaterThanOrEqual(3);
  });

  it('once-mode program finishes at end', async () => {
    const instr = ok('scan');
    let pc = 0, vm = initialVmState();
    let r = await stepProgram('u1', instr, pc, vm, ctx2(), 'once'); pc = r.pc; vm = r.vm; // scan → pc 1
    r = await stepProgram('u1', instr, pc, vm, ctx2(), 'once'); // pc 1 >= len → finished
    expect(r.finished).toBe(true); expect(r.status).toBe('idle');
    function ctx2() { return fakeCtx(); }
  });
});
