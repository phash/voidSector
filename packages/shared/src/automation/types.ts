/** A resource id that can be mined/sold in the MVP. */
export type ResourceId = 'ore' | 'gas' | 'crystal';

export const SELLABLE_RESOURCES: ResourceId[] = ['ore', 'gas', 'crystal'];

/** A runtime condition the VM evaluates against ship/sector state. */
export type Condition =
  | { kind: 'resources'; negate: boolean }
  | { kind: 'full'; negate: boolean }
  | { kind: 'empty'; negate: boolean }
  | { kind: 'station'; negate: boolean }
  | { kind: 'fuel_lt'; value: number; negate: boolean }
  | { kind: 'at'; x: number; y: number; negate: boolean };

/** AST statement — the parser's output. */
export type Stmt =
  | { type: 'fly'; x: number; y: number; line: number }
  | { type: 'scan'; line: number }
  | { type: 'mine'; mode: 'until_full' | 'amount'; amount: number; line: number }
  | { type: 'sell'; target: 'all' | ResourceId; line: number }
  | { type: 'if'; cond: Condition; then: Stmt[]; otherwise: Stmt[] | null; line: number }
  | { type: 'repeat'; count: number; body: Stmt[]; line: number }; // count = -1 => infinite

/** VM instruction — the compiler's output. `target` is an index into the instruction array. */
export type Instr =
  | { op: 'FLY'; x: number; y: number; line: number }
  | { op: 'SCAN'; line: number }
  | { op: 'MINE'; mode: 'until_full' | 'amount'; amount: number; line: number }
  | { op: 'SELL'; target: 'all' | ResourceId; line: number }
  | { op: 'JUMP_IF_FALSE'; cond: Condition; target: number; line: number }
  | { op: 'JUMP'; target: number; line: number }
  | { op: 'PUSH_LOOP'; count: number; line: number }
  | { op: 'LOOP_CHECK'; target: number; line: number }
  | { op: 'LOOP_NEXT'; target: number; line: number };

export interface CompileError {
  line: number;
  message: string;
}

export interface CompileSuccess {
  ok: true;
  instructions: Instr[];
  statementCount: number;
}

export interface CompileFailure {
  ok: false;
  errors: CompileError[];
}

export type CompileResult = CompileSuccess | CompileFailure;

export interface CompileOptions {
  /** Ship computer level (1-5). Gates which language features are allowed. */
  level: number;
  /** Max number of statements allowed for this computer level. */
  maxLength: number;
}

/** Default program-length limits per computer level (MK.I-V). Server may override via game_config. */
export const AUTOMATION_PROGRAM_LIMITS: Record<number, number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 75,
  5: 120,
};
