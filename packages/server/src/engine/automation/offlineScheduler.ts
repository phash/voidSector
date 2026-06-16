/**
 * Offline program scheduler (Plan 3, Task 6).
 *
 * ONE global, strictly-capped timer that advances OFFLINE players' active ship
 * programs server-side, so an automated ship keeps working while the player is
 * away. Online players are handled by the per-room ShipComputerService executor
 * and are SKIPPED here (they're in the Redis `online_players` set).
 *
 * Hard caps (OOM-safety — see project memory on disabled-tick OOMs):
 *  - at most AUTOMATION_MAX_CONCURRENT_OFFLINE programs are processed per tick;
 *  - the per-tick instruction budget (AUTOMATION_TICK_WORK_BUDGET) is divided
 *    across the processed programs;
 *  - offline execution requires a Bordcomputer MK.IV (level >= 4) and is bounded
 *    by an offline window (4h MK.IV / 12h MK.V) tracked in the program vm_state.
 *
 * Combat-free MVP: cores never trigger combat.
 */
import {
  compileProgram,
  getShipComputerLevel,
  AUTOMATION_PROGRAM_LIMITS,
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK4,
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK5,
  AUTOMATION_MAX_CONCURRENT_OFFLINE,
  AUTOMATION_TICK_WORK_BUDGET,
  AUTOMATION_SCHEDULER_INTERVAL_MS,
} from '@void-sector/shared';
import { getConfig } from '../gameConfigApply.js';
import { logger } from '../../utils/logger.js';
import { getActiveShip } from '../../db/queries.js';
import { redis } from '../../rooms/services/RedisAPStore.js';
import {
  getOfflineActivePrograms,
  getProgram,
  saveProgramState,
  appendProgramLog,
  type ProgramStateRow,
} from '../../db/programQueries.js';
import { initialVmState, stepProgram } from './vm.js';
import type { VmCtx, VmState } from './vm.js';
import { coreMoveOneSector, coreScan, coreMine, coreSell } from './cores.js';
import { evaluateCondition } from './conditions.js';

const MK4_REASON = 'Offline-Ausführung braucht Bordcomputer MK.IV';
const WINDOW_REASON = 'Offline-Reichweite erreicht';

/** Offline vm_state carries an extra `offlineSince` epoch-ms marker. */
type OfflineVmState = VmState & { offlineSince?: number };

export class OfflineScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly vmCtx: VmCtx = {
    move: coreMoveOneSector,
    scan: coreScan,
    mine: coreMine,
    // coreSell ignores the resource target (always sells all) — adapt the type.
    sell: (pid) => coreSell(pid, 'all'),
    evalCond: evaluateCondition,
  };

  // ─── Config helpers (DB override → shared-constant fallback) ────────────────

  private maxLengthFor(level: number): number {
    return (getConfig(`AUTOMATION_MAXLEN_MK${level}`) as number) ?? AUTOMATION_PROGRAM_LIMITS[level];
  }

  private maxConcurrent(): number {
    return (getConfig('AUTOMATION_MAX_CONCURRENT_OFFLINE') as number) ?? AUTOMATION_MAX_CONCURRENT_OFFLINE;
  }

  private workBudget(): number {
    return (getConfig('AUTOMATION_TICK_WORK_BUDGET') as number) ?? AUTOMATION_TICK_WORK_BUDGET;
  }

  private intervalMs(): number {
    return (getConfig('AUTOMATION_SCHEDULER_INTERVAL_MS') as number) ?? AUTOMATION_SCHEDULER_INTERVAL_MS;
  }

  private windowHoursFor(level: number): number {
    return level >= 5
      ? (getConfig('AUTOMATION_OFFLINE_WINDOW_HOURS_MK5') as number) ?? AUTOMATION_OFFLINE_WINDOW_HOURS_MK5
      : (getConfig('AUTOMATION_OFFLINE_WINDOW_HOURS_MK4') as number) ?? AUTOMATION_OFFLINE_WINDOW_HOURS_MK4;
  }

  /** True if the player is currently connected (handled by a room executor). */
  private async isOnline(playerId: string): Promise<boolean> {
    try {
      return (await redis.sismember('online_players', playerId)) === 1;
    } catch {
      // If Redis is unreachable, be conservative and treat as online (skip).
      return true;
    }
  }

  // ─── Tick ──────────────────────────────────────────────────────────────────

  /**
   * Advance offline programs by one budgeted tick. Each program is wrapped in its
   * own try/catch so a single failure never aborts the rest of the tick.
   */
  async tickOffline(): Promise<void> {
    try {
      const states = await getOfflineActivePrograms();
      if (states.length === 0) return;

      // Build the offline work-list (skip online players), capped by concurrency.
      const offline: ProgramStateRow[] = [];
      const cap = this.maxConcurrent();
      for (const state of states) {
        if (offline.length >= cap) break;
        if (await this.isOnline(state.player_id)) continue;
        offline.push(state);
      }
      if (offline.length === 0) return;

      const stepsPerProgram = Math.max(1, Math.floor(this.workBudget() / offline.length));

      for (const state of offline) {
        try {
          await this.processProgram(state, stepsPerProgram);
        } catch (err) {
          logger.error({ err, playerId: state.player_id }, 'offline program processing failed');
        }
      }
    } catch (err) {
      logger.error({ err }, 'offline scheduler tickOffline failed');
    }
  }

  /** Step a single offline program up to `maxSteps`, enforcing MK.IV + window gates. */
  private async processProgram(state: ProgramStateRow, maxSteps: number): Promise<void> {
    const playerId = state.player_id;

    // 1. Gate on computer level — offline execution needs MK.IV+.
    const ship = await getActiveShip(playerId);
    const level = getShipComputerLevel(ship?.modules ?? []);
    if (level < 4) {
      const vm = (state.vm_state as OfflineVmState | null) ?? initialVmState();
      await saveProgramState(playerId, {
        programId: state.program_id,
        pc: state.pc,
        vmState: vm,
        status: 'paused',
        pausedReason: MK4_REASON,
      });
      await appendProgramLog(playerId, state.program_id, 'warn', MK4_REASON);
      return;
    }

    // 2. Offline-window cap — initialize offlineSince lazily, then enforce.
    let vm: OfflineVmState = (state.vm_state as OfflineVmState | null) ?? initialVmState();
    const now = Date.now();
    if (typeof vm.offlineSince !== 'number') {
      vm = { ...vm, offlineSince: now };
      // Persist the initialized marker so the window starts ticking from now.
      await saveProgramState(playerId, {
        programId: state.program_id,
        pc: state.pc,
        vmState: vm,
        status: state.status,
        pausedReason: state.paused_reason,
      });
    }

    const windowMs = this.windowHoursFor(level) * 3600 * 1000;
    if (now - (vm.offlineSince ?? now) > windowMs) {
      await saveProgramState(playerId, {
        programId: state.program_id,
        pc: state.pc,
        vmState: vm,
        status: 'paused',
        pausedReason: WINDOW_REASON,
      });
      await appendProgramLog(playerId, state.program_id, 'warn', WINDOW_REASON);
      return;
    }

    // 3. Authoritative recompile from source (never trust persisted bytecode).
    const program = await getProgram(state.program_id);
    if (!program) return;
    const compiled = compileProgram(program.source, { level, maxLength: this.maxLengthFor(level) });
    if (!compiled.ok) {
      await saveProgramState(playerId, {
        programId: state.program_id,
        pc: state.pc,
        vmState: vm,
        status: 'paused',
        pausedReason: 'Programm kompiliert nicht mehr',
      });
      return;
    }
    const instr = compiled.instructions;
    const mode = program.mode === 'once' ? 'once' : 'loop';

    // 4. Step up to the budget; stop early on pause/idle/finished.
    let pc = state.pc;
    let status = state.status;
    for (let i = 0; i < maxSteps; i++) {
      const r = await stepProgram(playerId, instr, pc, vm, this.vmCtx, mode);
      pc = r.pc;
      // Preserve the offlineSince marker across vm transitions.
      vm = { ...(r.vm as OfflineVmState), offlineSince: vm.offlineSince };
      status = r.status;

      if (r.log) {
        await appendProgramLog(playerId, state.program_id, r.log.level, r.log.message);
      }

      if (r.status !== 'running') break;
    }

    // 5. Persist the final runtime state (preserve offlineSince in vm_state).
    await saveProgramState(playerId, {
      programId: state.program_id,
      pc,
      vmState: vm,
      status,
      pausedReason: status === 'paused' ? (state.paused_reason ?? null) : null,
    });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /** Start the single global interval. Safe to call once at boot. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tickOffline().catch((err) => logger.error({ err }, 'offline scheduler tick failed'));
    }, this.intervalMs());
    logger.info('offline program scheduler started');
  }

  /** Stop the interval (used in tests / shutdown). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** Module-level singleton — one capped timer for the whole process. */
const scheduler = new OfflineScheduler();

/** Wire up + start the global offline scheduler. Call once from universeBootstrap. */
export function startOfflineScheduler(): void {
  scheduler.start();
}
