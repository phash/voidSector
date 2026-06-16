import { query } from './client.js';

export interface ShipProgramRow {
  id: string;
  player_id: string;
  name: string;
  source: string;
  mode: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProgramStateRow {
  player_id: string;
  program_id: string;
  pc: number;
  vm_state: unknown;
  status: string;
  paused_reason: string | null;
  last_tick?: string;
}

export interface ProgramStateInput {
  programId: string;
  pc: number;
  vmState: unknown;
  status: string;
  pausedReason: string | null;
}

export async function createProgram(
  playerId: string,
  name: string,
  source: string,
  mode: string,
): Promise<ShipProgramRow> {
  const { rows } = await query<ShipProgramRow>(
    `INSERT INTO ship_programs (player_id, name, source, mode)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id, name)
     DO UPDATE SET source = EXCLUDED.source, mode = EXCLUDED.mode, updated_at = NOW()
     RETURNING *`,
    [playerId, name, source, mode],
  );
  return rows[0];
}

export async function listProgramsForPlayer(playerId: string): Promise<ShipProgramRow[]> {
  const { rows } = await query<ShipProgramRow>(
    'SELECT * FROM ship_programs WHERE player_id = $1 ORDER BY updated_at DESC',
    [playerId],
  );
  return rows;
}

export async function getProgram(id: string): Promise<ShipProgramRow | null> {
  const { rows } = await query<ShipProgramRow>('SELECT * FROM ship_programs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function deleteProgram(playerId: string, id: string): Promise<void> {
  await query('DELETE FROM ship_programs WHERE id = $1 AND player_id = $2', [id, playerId]);
}

export async function setActiveProgram(playerId: string, programId: string): Promise<void> {
  await query('UPDATE ship_programs SET is_active = FALSE WHERE player_id = $1', [playerId]);
  await query('UPDATE ship_programs SET is_active = TRUE WHERE id = $1 AND player_id = $2', [programId, playerId]);
}

export async function saveProgramState(playerId: string, s: ProgramStateInput): Promise<void> {
  await query(
    `INSERT INTO ship_program_state (player_id, program_id, pc, vm_state, status, paused_reason, last_tick)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (player_id) DO UPDATE SET
       program_id = EXCLUDED.program_id, pc = EXCLUDED.pc, vm_state = EXCLUDED.vm_state,
       status = EXCLUDED.status, paused_reason = EXCLUDED.paused_reason, last_tick = NOW()`,
    [playerId, s.programId, s.pc, JSON.stringify(s.vmState), s.status, s.pausedReason],
  );
}

export async function getActiveProgramState(playerId: string): Promise<ProgramStateRow | null> {
  const { rows } = await query<ProgramStateRow>('SELECT * FROM ship_program_state WHERE player_id = $1', [playerId]);
  return rows[0] ?? null;
}

export async function clearProgramState(playerId: string): Promise<void> {
  await query('DELETE FROM ship_program_state WHERE player_id = $1', [playerId]);
}

export async function appendProgramLog(
  playerId: string,
  programId: string | null,
  level: string,
  message: string,
): Promise<void> {
  await query(
    'INSERT INTO ship_program_logs (player_id, program_id, level, message) VALUES ($1, $2, $3, $4)',
    [playerId, programId, level, message],
  );
}

export async function getRecentLogs(
  playerId: string,
  limit = 50,
): Promise<Array<{ ts: string; level: string; message: string }>> {
  const { rows } = await query<{ ts: string; level: string; message: string }>(
    'SELECT ts, level, message FROM ship_program_logs WHERE player_id = $1 ORDER BY ts DESC LIMIT $2',
    [playerId, limit],
  );
  return rows;
}

/** Active programs whose runtime state is running/paused — the offline scheduler's work-list (Plan 3). */
export async function getOfflineActivePrograms(): Promise<ProgramStateRow[]> {
  const { rows } = await query<ProgramStateRow>(
    `SELECT st.* FROM ship_program_state st
     JOIN ship_programs p ON p.id = st.program_id AND p.is_active = TRUE
     WHERE st.status IN ('running', 'paused')`,
  );
  return rows;
}
