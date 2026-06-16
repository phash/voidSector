import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { Instr } from '@void-sector/shared';
import {
  compileProgram,
  getShipComputerLevel,
  AUTOMATION_PROGRAM_LIMITS,
  AUTOMATION_SCHEDULER_INTERVAL_MS,
} from '@void-sector/shared';
import { getConfig } from '../../engine/gameConfigApply.js';
import { logger } from '../../utils/logger.js';
import { getActiveShip, getPlayerCredits, getSector } from '../../db/queries.js';
import { getCargoState } from '../../engine/inventoryService.js';
import { getPlayerPosition } from './RedisAPStore.js';
import {
  createProgram,
  listProgramsForPlayer,
  getProgram,
  deleteProgram,
  setActiveProgram,
  saveProgramState,
  getActiveProgramState,
  clearProgramState,
  appendProgramLog,
} from '../../db/programQueries.js';
import { initialVmState, stepProgram } from '../../engine/automation/vm.js';
import type { VmCtx, VmState } from '../../engine/automation/vm.js';
import {
  coreMoveOneSector,
  coreScan,
  coreMine,
  coreSell,
} from '../../engine/automation/cores.js';
import { evaluateCondition } from '../../engine/automation/conditions.js';

/**
 * ShipComputerService — program CRUD + the ONLINE per-player executor.
 *
 * CRUD handlers wrap programQueries and push results to the client.
 * The executor steps a compiled VM program live (one VM step per scheduler tick)
 * while the player is connected, persists VM state to DB after every step, and
 * pushes HUD updates so the player sees the ship act. The persisted runtime state
 * (status 'running') is left untouched on leave so the offline scheduler (Plan 3,
 * Task 6) can resume it server-side.
 */
export class ShipComputerService {
  /** Live executor timers, keyed by client.sessionId. */
  private executors = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private ctx: ServiceContext) {}

  // ─── Config helpers ──────────────────────────────────────────────────────

  private maxLengthFor(level: number): number {
    return (getConfig(`AUTOMATION_MAXLEN_MK${level}`) as number) ?? AUTOMATION_PROGRAM_LIMITS[level];
  }

  private schedulerIntervalMs(): number {
    return (getConfig('AUTOMATION_SCHEDULER_INTERVAL_MS') as number) ?? AUTOMATION_SCHEDULER_INTERVAL_MS;
  }

  private userId(client: Client): string {
    return (client.auth as AuthPayload | null)?.userId ?? '';
  }

  /** Current ship computer level (0 = none installed). */
  private async computerLevel(playerId: string): Promise<number> {
    const ship = await getActiveShip(playerId);
    return getShipComputerLevel(ship?.modules ?? []);
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async handleSaveProgram(
    client: Client,
    data: { name: string; source: string; mode: string },
  ): Promise<void> {
    const playerId = this.userId(client);
    const level = await this.computerLevel(playerId);
    if (level <= 0) {
      client.send('programError', { errors: [{ line: 0, message: 'Kein Bordcomputer installiert' }] });
      return;
    }

    const result = compileProgram(data.source, { level, maxLength: this.maxLengthFor(level) });
    if (!result.ok) {
      client.send('programError', { errors: result.errors });
      return;
    }

    const mode = data.mode === 'once' ? 'once' : 'loop';
    const row = await createProgram(playerId, data.name, data.source, mode);
    client.send('programSaved', row);
  }

  async handleListPrograms(client: Client): Promise<void> {
    const playerId = this.userId(client);
    const rows = await listProgramsForPlayer(playerId);
    client.send('programList', rows);
  }

  async handleDeleteProgram(client: Client, data: { id: string }): Promise<void> {
    const playerId = this.userId(client);
    await deleteProgram(playerId, data.id);
    const rows = await listProgramsForPlayer(playerId);
    client.send('programList', rows);
  }

  async handleSetActive(client: Client, data: { id: string }): Promise<void> {
    const playerId = this.userId(client);
    await setActiveProgram(playerId, data.id);
    const rows = await listProgramsForPlayer(playerId);
    client.send('programList', rows);
  }

  async handleStartProgram(client: Client, data: { id: string }): Promise<void> {
    const playerId = this.userId(client);
    const program = await getProgram(data.id);
    if (!program || program.player_id !== playerId) {
      client.send('programError', { errors: [{ line: 0, message: 'Programm nicht gefunden' }] });
      return;
    }

    // Authoritative recompile from source (never trust client-side bytecode).
    const level = await this.computerLevel(playerId);
    if (level <= 0) {
      client.send('programError', { errors: [{ line: 0, message: 'Kein Bordcomputer installiert' }] });
      return;
    }
    const result = compileProgram(program.source, { level, maxLength: this.maxLengthFor(level) });
    if (!result.ok) {
      client.send('programError', { errors: result.errors });
      return;
    }

    await setActiveProgram(playerId, data.id);
    await saveProgramState(playerId, {
      programId: data.id,
      pc: 0,
      vmState: initialVmState(),
      status: 'running',
      pausedReason: null,
    });

    const mode = program.mode === 'once' ? 'once' : 'loop';
    this.startExecutor(client, playerId, result.instructions, mode);
    client.send('programState', { status: 'running', pc: 0 });
  }

  async handleStopProgram(client: Client): Promise<void> {
    const playerId = this.userId(client);
    this.stopExecutor(client.sessionId);
    const state = await getActiveProgramState(playerId);
    if (state) {
      await saveProgramState(playerId, {
        programId: state.program_id,
        pc: state.pc,
        vmState: state.vm_state,
        status: 'idle',
        pausedReason: null,
      });
    }
    client.send('programState', { status: 'idle', pc: state?.pc ?? 0 });
  }

  // ─── Online executor ─────────────────────────────────────────────────────

  /**
   * Start the live executor for a client. One VM step per scheduler tick;
   * VM state is reloaded from DB each tick so it stays in sync with the offline
   * scheduler should both ever touch the same player.
   */
  private startExecutor(client: Client, playerId: string, instr: Instr[], mode: 'once' | 'loop'): void {
    // Replace any existing timer for this session.
    this.stopExecutor(client.sessionId);

    const vmCtx: VmCtx = {
      move: coreMoveOneSector,
      scan: coreScan,
      mine: coreMine,
      // coreSell ignores the resource target (always sells all) — adapt the type.
      sell: (pid, _target) => coreSell(pid, 'all'),
      evalCond: evaluateCondition,
    };

    const timer = setInterval(async () => {
      try {
        const state = await getActiveProgramState(playerId);
        if (!state || state.status !== 'running') {
          this.stopExecutor(client.sessionId);
          return;
        }

        const vm = (state.vm_state as VmState | null) ?? initialVmState();
        const r = await stepProgram(playerId, instr, state.pc, vm, vmCtx, mode);

        await saveProgramState(playerId, {
          programId: state.program_id,
          pc: r.pc,
          vmState: r.vm,
          status: r.status,
          pausedReason: r.status === 'paused' ? (r.log?.message ?? null) : null,
        });

        if (r.log) {
          await appendProgramLog(playerId, state.program_id, r.log.level, r.log.message);
        }

        client.send('programState', { status: r.status, pc: r.pc, log: r.log });

        // Push HUD updates so the player sees the ship act.
        await this.pushHud(client, playerId, instr[state.pc]);

        if (r.status !== 'running') {
          this.stopExecutor(client.sessionId);
        }
      } catch (err) {
        logger.error({ err, playerId }, 'ship-computer executor tick failed');
        // Pause the program so a transient error doesn't busy-loop forever.
        try {
          const state = await getActiveProgramState(playerId);
          if (state) {
            await saveProgramState(playerId, {
              programId: state.program_id,
              pc: state.pc,
              vmState: state.vm_state,
              status: 'paused',
              pausedReason: 'Interner Fehler',
            });
          }
        } catch {
          // best-effort
        }
        client.send('programState', { status: 'paused', pc: 0, log: { level: 'warn', message: 'Interner Fehler' } });
        this.stopExecutor(client.sessionId);
      }
    }, this.schedulerIntervalMs());

    this.executors.set(client.sessionId, timer);
  }

  /** Push fresh HUD state to the client after a VM step (best-effort). */
  private async pushHud(client: Client, playerId: string, op: Instr | undefined): Promise<void> {
    if (!op) return;
    try {
      if (op.op === 'MINE' || op.op === 'SELL') {
        const [cargo, credits] = await Promise.all([
          getCargoState(playerId),
          getPlayerCredits(playerId),
        ]);
        client.send('cargoUpdate', cargo);
        client.send('creditsUpdate', { credits });
      }
      if (op.op === 'FLY') {
        const pos = await getPlayerPosition(playerId);
        if (pos) {
          // Reflect position in the room schema (radar/HUD read this).
          const player = this.ctx.state.players.get(client.sessionId);
          if (player) {
            player.x = pos.x;
            player.y = pos.y;
          }
          // Push the new sector so the main monitor updates (core already saved it).
          const sector = await getSector(pos.x, pos.y);
          if (sector) {
            this.ctx.playerSectorData.set(client.sessionId, sector);
            client.send('sectorData', sector);
          }
        }
      }
    } catch {
      // HUD push is best-effort — never let it break the executor.
    }
  }

  /** Stop + clear the live executor timer for a session (no DB change). */
  stopExecutor(sessionId: string): void {
    const timer = this.executors.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.executors.delete(sessionId);
    }
  }

  /**
   * Called from onJoin — if the player has a 'running' active program, recompile
   * its source and resume the live executor so the ship keeps acting in-browser.
   */
  async resumeIfActive(client: Client, playerId: string): Promise<void> {
    if (!playerId) return;
    try {
      const state = await getActiveProgramState(playerId);
      if (!state || state.status !== 'running') return;

      const program = await getProgram(state.program_id);
      if (!program) return;

      const level = await this.computerLevel(playerId);
      if (level <= 0) return;
      const result = compileProgram(program.source, { level, maxLength: this.maxLengthFor(level) });
      if (!result.ok) {
        // Source no longer compiles (e.g. computer downgraded) — stop it.
        await clearProgramState(playerId);
        return;
      }

      const mode = program.mode === 'once' ? 'once' : 'loop';
      this.startExecutor(client, playerId, result.instructions, mode);
      client.send('programState', { status: 'running', pc: state.pc });
    } catch (err) {
      logger.error({ err, playerId }, 'ship-computer resumeIfActive failed');
    }
  }
}
