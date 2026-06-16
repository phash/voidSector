import type { Instr, Condition } from '@void-sector/shared';

export interface VmState {
  loops: number[];
  fly: { tx: number; ty: number } | null;
}

export const initialVmState = (): VmState => ({ loops: [], fly: null });

export interface VmCtx {
  move: (
    playerId: string,
    tx: number,
    ty: number,
  ) => Promise<{ ok: true; x: number; y: number; arrived: boolean } | { ok: false; reason: string }>;
  scan: (
    playerId: string,
  ) => Promise<{ ok: true; resources: { ore: number; gas: number; crystal: number } } | { ok: false; reason: string }>;
  mine: (
    playerId: string,
    mode: 'until_full' | 'amount',
    amount: number,
  ) => Promise<{ ok: true; mined: number } | { ok: false; reason: string }>;
  sell: (
    playerId: string,
    target: 'all' | 'ore' | 'gas' | 'crystal',
  ) => Promise<{ ok: true; credits: number } | { ok: false; reason: string }>;
  evalCond: (playerId: string, c: Condition) => Promise<boolean>;
}

export interface StepResult {
  pc: number;
  vm: VmState;
  status: 'running' | 'paused' | 'idle';
  finished: boolean;
  log?: { level: 'info' | 'warn'; message: string };
}

/** Execute exactly one VM step. `mode` controls end-of-program behavior. */
export async function stepProgram(
  playerId: string,
  instr: Instr[],
  pc: number,
  vm: VmState,
  ctx: VmCtx,
  mode: 'once' | 'loop' = 'loop',
): Promise<StepResult> {
  if (pc >= instr.length) {
    if (mode === 'loop') return { pc: 0, vm, status: 'running', finished: false };
    return { pc, vm, status: 'idle', finished: true };
  }

  const op = instr[pc];
  const loops = [...vm.loops];

  switch (op.op) {
    case 'FLY': {
      const r = await ctx.move(playerId, op.x, op.y);
      if (!r.ok) {
        return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      }
      if (r.arrived) {
        return { pc: pc + 1, vm: { ...vm, fly: null }, status: 'running', finished: false };
      }
      return { pc, vm: { ...vm, fly: { tx: op.x, ty: op.y } }, status: 'running', finished: false };
    }

    case 'SCAN': {
      const r = await ctx.scan(playerId);
      if (!r.ok) {
        return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      }
      return { pc: pc + 1, vm, status: 'running', finished: false };
    }

    case 'MINE': {
      const r = await ctx.mine(playerId, op.mode, op.amount);
      if (!r.ok) {
        return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      }
      return {
        pc: pc + 1,
        vm,
        status: 'running',
        finished: false,
        log: { level: 'info', message: `${r.mined} abgebaut` },
      };
    }

    case 'SELL': {
      const r = await ctx.sell(playerId, op.target);
      if (!r.ok) {
        return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      }
      return {
        pc: pc + 1,
        vm,
        status: 'running',
        finished: false,
        log: { level: 'info', message: `${r.credits} Credits erhalten` },
      };
    }

    case 'JUMP_IF_FALSE': {
      const truthy = await ctx.evalCond(playerId, op.cond);
      return { pc: truthy ? pc + 1 : op.target, vm, status: 'running', finished: false };
    }

    case 'JUMP':
      return { pc: op.target, vm, status: 'running', finished: false };

    case 'PUSH_LOOP':
      loops.push(op.count);
      return { pc: pc + 1, vm: { ...vm, loops }, status: 'running', finished: false };

    case 'LOOP_CHECK': {
      const top = loops[loops.length - 1];
      if (top === 0) {
        loops.pop();
        return { pc: op.target, vm: { ...vm, loops }, status: 'running', finished: false };
      }
      return { pc: pc + 1, vm, status: 'running', finished: false };
    }

    case 'LOOP_NEXT': {
      if (loops[loops.length - 1] > 0) {
        loops[loops.length - 1] -= 1;
      }
      return { pc: op.target, vm: { ...vm, loops }, status: 'running', finished: false };
    }
  }
}
