# Programmable Ship — Plan 1: DSL Core (shared) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the safe, deterministic DSL compiler in `packages/shared` that turns a player's ship-program source text into a validated, level-gated instruction list (VM bytecode) — with clear, line-numbered errors.

**Architecture:** Pure functions in `packages/shared/src/automation/`. `parseProgram(source)` does line-based, indentation-aware recursive-descent parsing into an AST. `compileProgram(source, {level, maxLength})` parses, then gates features by computer level, enforces a length limit, and emits a flat `Instr[]` with resolved jump targets. No DB, no I/O — fully unit-testable, runnable in both client and server.

**Tech Stack:** TypeScript (strict, ESM with `.js` import extensions), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-15-programmable-ship-design.md`

> **4-plan roadmap** (this is Plan 1):
> 1. **DSL Core (shared)** ← this plan
> 2. **Module, Schema & Persistence** — `computer` module defs + slot integration, migration 099, `queries.ts`, `game_config` keys
> 3. **Execution Engine (server)** — headless action-cores refactor, VM runtime, online executor, offline scheduler + caps, safety-net drift, `ShipComputerService` + room messages
> 4. **Client & Onboarding** — `AUTOMAT` tab, editor, level-aware palette, templates, store slice, network wiring, `first_automat` HelpSlice + tutorial step + Kompendium article
>
> Plans 2–4 are written after the preceding plan is implemented, so they reflect the real APIs built.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/automation/types.ts` (create) | All DSL types: `Condition`, `Stmt` (AST), `Instr` (bytecode), `CompileResult`, `CompileOptions`, `ResourceId`, default limits constant. |
| `packages/shared/src/automation/parser.ts` (create) | `parseProgram(source)` → `{ ast, errors }`. Line lexing, indentation, comments, commands, conditions, control blocks. |
| `packages/shared/src/automation/compiler.ts` (create) | `compileProgram(source, opts)` + `compileAst(ast, opts)` → `CompileResult`. Gating, length check, bytecode emission with jump targets. |
| `packages/shared/src/automation/__tests__/parser.test.ts` (create) | Parser unit tests. |
| `packages/shared/src/automation/__tests__/compiler.test.ts` (create) | Compiler + gating + integration tests. |
| `packages/shared/src/index.ts` (modify) | Re-export the automation public API. |

**Test command (always from the package dir):**
```bash
cd packages/shared && npx vitest run src/automation
```

---

### Task 1: DSL types & limits constant

**Files:**
- Create: `packages/shared/src/automation/types.ts`
- Test: `packages/shared/src/automation/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/automation/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SELLABLE_RESOURCES, AUTOMATION_PROGRAM_LIMITS } from '../types.js';

describe('automation types', () => {
  it('exposes the MVP sellable resources', () => {
    expect(SELLABLE_RESOURCES).toEqual(['ore', 'gas', 'crystal']);
  });

  it('defines a program-length limit for every computer level MK.I-V', () => {
    expect(AUTOMATION_PROGRAM_LIMITS).toEqual({ 1: 10, 2: 25, 3: 50, 4: 75, 5: 120 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation`
Expected: FAIL — `Cannot find module '../types.js'`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/automation/types.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation`
Expected: PASS — `types.test.ts` 2 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/types.ts packages/shared/src/automation/__tests__/types.test.ts
git commit -m "feat: programmable-ship DSL types & program-length limits"
```

---

### Task 2: Parser — lexing, comments, indentation, simple commands

**Files:**
- Create: `packages/shared/src/automation/parser.ts`
- Test: `packages/shared/src/automation/__tests__/parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/automation/__tests__/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseProgram } from '../parser.js';

describe('parser — commands', () => {
  it('parses fly/scan/mine/sell on separate lines', () => {
    const { ast, errors } = parseProgram('fly 3:5\nscan\nmine until full\nsell all');
    expect(errors).toEqual([]);
    expect(ast).toEqual([
      { type: 'fly', x: 3, y: 5, line: 1 },
      { type: 'scan', line: 2 },
      { type: 'mine', mode: 'until_full', amount: 0, line: 3 },
      { type: 'sell', target: 'all', line: 4 },
    ]);
  });

  it('treats bare `mine` as `mine until full` and `mine 50` as an amount', () => {
    expect(parseProgram('mine').ast[0]).toEqual({ type: 'mine', mode: 'until_full', amount: 0, line: 1 });
    expect(parseProgram('mine 50').ast[0]).toEqual({ type: 'mine', mode: 'amount', amount: 50, line: 1 });
  });

  it('parses negative fly coordinates and a specific resource sell', () => {
    expect(parseProgram('fly -2:-7').ast[0]).toEqual({ type: 'fly', x: -2, y: -7, line: 1 });
    expect(parseProgram('sell ore').ast[0]).toEqual({ type: 'sell', target: 'ore', line: 1 });
  });

  it('ignores blank lines and # comments', () => {
    const { ast, errors } = parseProgram('# do a scan\n\nscan   # inline comment\n');
    expect(errors).toEqual([]);
    expect(ast).toEqual([{ type: 'scan', line: 3 }]);
  });

  it('reports unknown commands and unknown resources with line numbers', () => {
    expect(parseProgram('warp 1:1').errors).toEqual([{ line: 1, message: "Unbekannter Befehl: 'warp 1:1'." }]);
    expect(parseProgram('sell gold').errors[0]).toMatchObject({ line: 1 });
    expect(parseProgram('sell gold').errors[0].message).toContain("Unbekannter Rohstoff 'gold'");
  });

  it('rejects tabs and non-multiple-of-2 indentation', () => {
    expect(parseProgram('\tscan').errors.some((e) => e.message.includes('Tabs'))).toBe(true);
    expect(parseProgram(' scan').errors.some((e) => e.message.includes('Einrückung'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/parser.test.ts`
Expected: FAIL — `Cannot find module '../parser.js'`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/automation/parser.ts`:

```ts
import type { CompileError, Condition, ResourceId, Stmt } from './types.js';
import { SELLABLE_RESOURCES } from './types.js';

interface Line {
  indent: number; // in indent units (2 spaces = 1)
  text: string; // trimmed, comment-stripped
  line: number; // 1-based source line number
}

export interface ParseResult {
  ast: Stmt[];
  errors: CompileError[];
}

const INDENT_UNIT = 2;

function lex(source: string): { lines: Line[]; errors: CompileError[] } {
  const errors: CompileError[] = [];
  const lines: Line[] = [];
  const raw = source.replace(/\r\n/g, '\n').split('\n');
  raw.forEach((original, i) => {
    const lineNo = i + 1;
    const noComment = original.replace(/#.*$/, '');
    if (noComment.trim() === '') return; // blank or comment-only
    if (/\t/.test(noComment)) {
      errors.push({ line: lineNo, message: 'Tabs nicht erlaubt — bitte 2 Leerzeichen je Ebene.' });
    }
    const leading = noComment.length - noComment.trimStart().length;
    if (leading % INDENT_UNIT !== 0) {
      errors.push({ line: lineNo, message: `Einrückung muss ein Vielfaches von ${INDENT_UNIT} Leerzeichen sein.` });
    }
    lines.push({ indent: Math.floor(leading / INDENT_UNIT), text: noComment.trim(), line: lineNo });
  });
  return { lines, errors };
}

function parseCommand(text: string, line: number, errors: CompileError[]): Stmt | null {
  const fly = text.match(/^fly\s+(-?\d+):(-?\d+)$/);
  if (fly) return { type: 'fly', x: Number(fly[1]), y: Number(fly[2]), line };
  if (text === 'scan') return { type: 'scan', line };
  if (text === 'mine' || text === 'mine until full') return { type: 'mine', mode: 'until_full', amount: 0, line };
  const mineN = text.match(/^mine\s+(\d+)$/);
  if (mineN) return { type: 'mine', mode: 'amount', amount: Number(mineN[1]), line };
  if (text === 'sell all') return { type: 'sell', target: 'all', line };
  const sellR = text.match(/^sell\s+(\w+)$/);
  if (sellR) {
    const r = sellR[1] as ResourceId;
    if ((SELLABLE_RESOURCES as string[]).includes(r)) return { type: 'sell', target: r, line };
    errors.push({ line, message: `Unbekannter Rohstoff '${sellR[1]}'. Erlaubt: ${SELLABLE_RESOURCES.join(', ')}, all.` });
    return null;
  }
  errors.push({ line, message: `Unbekannter Befehl: '${text}'.` });
  return null;
}

export function parseProgram(source: string): ParseResult {
  const { lines, errors } = lex(source);
  const cursor = { i: 0 };
  const ast = parseBlock(lines, cursor, 0, errors);
  if (cursor.i < lines.length) {
    errors.push({ line: lines[cursor.i].line, message: 'Unerwartete Einrückung.' });
  }
  return { ast, errors };
}

// parseBlock / parseStatement / parseCondition are completed in Task 3 & 4.
// For Task 2, provide a minimal parseBlock that only handles flat command lines:
function parseBlock(lines: Line[], cursor: { i: number }, indent: number, errors: CompileError[]): Stmt[] {
  const stmts: Stmt[] = [];
  while (cursor.i < lines.length) {
    const ln = lines[cursor.i];
    if (ln.indent < indent) break;
    if (ln.indent > indent) {
      errors.push({ line: ln.line, message: 'Unerwartete Einrückung.' });
      cursor.i++;
      continue;
    }
    cursor.i++;
    const stmt = parseCommand(ln.text, ln.line, errors);
    if (stmt) stmts.push(stmt);
  }
  return stmts;
}

// placeholder so Task 3 can import without a forward-reference error
export function parseCondition(_text: string, _line: number, _errors: CompileError[]): Condition {
  return { kind: 'resources', negate: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/parser.test.ts`
Expected: PASS — `parser.test.ts` (commands block) passed.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/parser.ts packages/shared/src/automation/__tests__/parser.test.ts
git commit -m "feat: DSL parser — lexing, indentation, simple commands"
```

---

### Task 3: Parser — condition expressions

**Files:**
- Modify: `packages/shared/src/automation/parser.ts` (replace `parseCondition`)
- Test: `packages/shared/src/automation/__tests__/parser.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/automation/__tests__/parser.test.ts`:

```ts
import { parseCondition } from '../parser.js';

describe('parser — conditions', () => {
  function cond(text: string) {
    const errors: { line: number; message: string }[] = [];
    const c = parseCondition(text, 1, errors);
    return { c, errors };
  }

  it('parses simple flag conditions', () => {
    expect(cond('resources').c).toEqual({ kind: 'resources', negate: false });
    expect(cond('full').c).toEqual({ kind: 'full', negate: false });
    expect(cond('empty').c).toEqual({ kind: 'empty', negate: false });
    expect(cond('station').c).toEqual({ kind: 'station', negate: false });
  });

  it('parses `not <cond>`', () => {
    expect(cond('not resources').c).toEqual({ kind: 'resources', negate: true });
  });

  it('parses `fuel < N` and `at X:Y`', () => {
    expect(cond('fuel < 500').c).toEqual({ kind: 'fuel_lt', value: 500, negate: false });
    expect(cond('at 0:0').c).toEqual({ kind: 'at', x: 0, y: 0, negate: false });
    expect(cond('not at -3:4').c).toEqual({ kind: 'at', x: -3, y: 4, negate: true });
  });

  it('records an error for an unknown condition', () => {
    const { errors } = cond('weather sunny');
    expect(errors[0]).toMatchObject({ line: 1 });
    expect(errors[0].message).toContain("Unbekannte Bedingung");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/parser.test.ts`
Expected: FAIL — placeholder `parseCondition` returns `{ kind: 'resources', negate: false }` for everything (e.g. `full` assertion fails).

- [ ] **Step 3: Write the implementation**

In `packages/shared/src/automation/parser.ts`, replace the placeholder `parseCondition` with:

```ts
export function parseCondition(text: string, line: number, errors: CompileError[]): Condition {
  let negate = false;
  let body = text.trim();
  const notM = body.match(/^not\s+(.+)$/);
  if (notM) {
    negate = true;
    body = notM[1].trim();
  }
  if (body === 'resources') return { kind: 'resources', negate };
  if (body === 'full') return { kind: 'full', negate };
  if (body === 'empty') return { kind: 'empty', negate };
  if (body === 'station') return { kind: 'station', negate };
  const fuel = body.match(/^fuel\s*<\s*(\d+)$/);
  if (fuel) return { kind: 'fuel_lt', value: Number(fuel[1]), negate };
  const at = body.match(/^at\s+(-?\d+):(-?\d+)$/);
  if (at) return { kind: 'at', x: Number(at[1]), y: Number(at[2]), negate };
  errors.push({ line, message: `Unbekannte Bedingung: '${text}'.` });
  return { kind: 'resources', negate }; // shape placeholder; compile fails due to the recorded error
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/parser.test.ts`
Expected: PASS — conditions block passed.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/parser.ts packages/shared/src/automation/__tests__/parser.test.ts
git commit -m "feat: DSL parser — condition expressions"
```

---

### Task 4: Parser — control blocks (if/else, repeat, repeat N times)

**Files:**
- Modify: `packages/shared/src/automation/parser.ts` (replace `parseBlock`, add `parseStatement`)
- Test: `packages/shared/src/automation/__tests__/parser.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/automation/__tests__/parser.test.ts`:

```ts
describe('parser — control blocks', () => {
  it('parses if/else with indented blocks', () => {
    const src = ['if resources:', '  mine until full', 'else:', '  fly 7:9'].join('\n');
    const { ast, errors } = parseProgram(src);
    expect(errors).toEqual([]);
    expect(ast).toEqual([
      {
        type: 'if',
        cond: { kind: 'resources', negate: false },
        then: [{ type: 'mine', mode: 'until_full', amount: 0, line: 2 }],
        otherwise: [{ type: 'fly', x: 7, y: 9, line: 4 }],
        line: 1,
      },
    ]);
  });

  it('parses repeat (infinite) and repeat N times', () => {
    expect(parseProgram('repeat:\n  scan').ast[0]).toEqual({
      type: 'repeat',
      count: -1,
      body: [{ type: 'scan', line: 2 }],
      line: 1,
    });
    expect(parseProgram('repeat 3 times:\n  scan').ast[0]).toMatchObject({ type: 'repeat', count: 3 });
  });

  it('nests control structures', () => {
    const src = ['repeat:', '  if full:', '    sell all'].join('\n');
    const ast = parseProgram(src).ast as any;
    expect(ast[0].type).toBe('repeat');
    expect(ast[0].body[0].type).toBe('if');
    expect(ast[0].body[0].then[0]).toEqual({ type: 'sell', target: 'all', line: 3 });
  });

  it('errors on an if without a body and an else without an if', () => {
    expect(parseProgram('if resources:').errors.some((e) => e.message.includes('eingerückten Block'))).toBe(true);
    expect(parseProgram('else:\n  scan').errors.some((e) => e.message.includes('ohne zugehöriges'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/parser.test.ts`
Expected: FAIL — current `parseBlock` treats `if resources:` as an unknown command.

- [ ] **Step 3: Write the implementation**

In `packages/shared/src/automation/parser.ts`, replace the Task-2 `parseBlock` with the following `parseBlock` + new `parseStatement` (keep `parseCommand` and `parseCondition` as-is):

```ts
function parseBlock(lines: Line[], cursor: { i: number }, indent: number, errors: CompileError[]): Stmt[] {
  const stmts: Stmt[] = [];
  while (cursor.i < lines.length) {
    const ln = lines[cursor.i];
    if (ln.indent < indent) break;
    if (ln.indent > indent) {
      errors.push({ line: ln.line, message: 'Unerwartete Einrückung.' });
      cursor.i++;
      continue;
    }
    const stmt = parseStatement(lines, cursor, indent, errors);
    if (stmt) stmts.push(stmt);
  }
  return stmts;
}

function parseStatement(lines: Line[], cursor: { i: number }, indent: number, errors: CompileError[]): Stmt | null {
  const ln = lines[cursor.i];
  const text = ln.text;

  if (text === 'repeat:') {
    cursor.i++;
    const body = parseBlock(lines, cursor, indent + 1, errors);
    if (body.length === 0) errors.push({ line: ln.line, message: '`repeat` braucht einen eingerückten Block.' });
    return { type: 'repeat', count: -1, body, line: ln.line };
  }

  const repN = text.match(/^repeat\s+(\d+)\s+times:$/);
  if (repN) {
    cursor.i++;
    const body = parseBlock(lines, cursor, indent + 1, errors);
    if (body.length === 0) errors.push({ line: ln.line, message: '`repeat N times` braucht einen eingerückten Block.' });
    return { type: 'repeat', count: Number(repN[1]), body, line: ln.line };
  }

  const ifm = text.match(/^if\s+(.+):$/);
  if (ifm) {
    cursor.i++;
    const cond = parseCondition(ifm[1].trim(), ln.line, errors);
    const thenBlock = parseBlock(lines, cursor, indent + 1, errors);
    if (thenBlock.length === 0) errors.push({ line: ln.line, message: '`if` braucht einen eingerückten Block.' });
    let otherwise: Stmt[] | null = null;
    if (cursor.i < lines.length && lines[cursor.i].indent === indent && lines[cursor.i].text === 'else:') {
      const elseLn = lines[cursor.i];
      cursor.i++;
      otherwise = parseBlock(lines, cursor, indent + 1, errors);
      if (otherwise.length === 0) errors.push({ line: elseLn.line, message: '`else` braucht einen eingerückten Block.' });
    }
    return { type: 'if', cond, then: thenBlock, otherwise, line: ln.line };
  }

  if (text === 'else:') {
    cursor.i++;
    errors.push({ line: ln.line, message: '`else` ohne zugehöriges `if`.' });
    return null;
  }

  cursor.i++;
  return parseCommand(text, ln.line, errors);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/parser.test.ts`
Expected: PASS — all parser blocks pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/parser.ts packages/shared/src/automation/__tests__/parser.test.ts
git commit -m "feat: DSL parser — if/else and repeat control blocks"
```

---

### Task 5: Compiler — sequential commands → bytecode

**Files:**
- Create: `packages/shared/src/automation/compiler.ts`
- Test: `packages/shared/src/automation/__tests__/compiler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/automation/__tests__/compiler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: FAIL — `Cannot find module '../compiler.js'`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/automation/compiler.ts`:

```ts
import type { CompileError, CompileOptions, CompileResult, Instr, Stmt } from './types.js';
import { parseProgram } from './parser.js';

function emit(ast: Stmt[], out: Instr[]): void {
  for (const s of ast) {
    switch (s.type) {
      case 'fly':
        out.push({ op: 'FLY', x: s.x, y: s.y, line: s.line });
        break;
      case 'scan':
        out.push({ op: 'SCAN', line: s.line });
        break;
      case 'mine':
        out.push({ op: 'MINE', mode: s.mode, amount: s.amount, line: s.line });
        break;
      case 'sell':
        out.push({ op: 'SELL', target: s.target, line: s.line });
        break;
      // 'if' and 'repeat' handled in Task 6 & 7
    }
  }
}

function countStatements(ast: Stmt[]): number {
  let n = 0;
  for (const s of ast) {
    n++;
    if (s.type === 'if') {
      n += countStatements(s.then);
      if (s.otherwise) n += countStatements(s.otherwise);
    } else if (s.type === 'repeat') {
      n += countStatements(s.body);
    }
  }
  return n;
}

export function compileAst(ast: Stmt[], opts: CompileOptions): CompileResult {
  const errors: CompileError[] = [];
  const count = countStatements(ast);
  if (count > opts.maxLength) {
    errors.push({
      line: 1,
      message: `Programm zu lang: ${count} Anweisungen (Limit ${opts.maxLength} bei MK.${opts.level}).`,
    });
  }
  if (errors.length) return { ok: false, errors };
  const instructions: Instr[] = [];
  emit(ast, instructions);
  return { ok: true, instructions, statementCount: count };
}

export function compileProgram(source: string, opts: CompileOptions): CompileResult {
  const { ast, errors } = parseProgram(source);
  if (errors.length) return { ok: false, errors };
  return compileAst(ast, opts);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: PASS — sequential-commands block passes.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/compiler.ts packages/shared/src/automation/__tests__/compiler.test.ts
git commit -m "feat: DSL compiler — sequential commands to bytecode"
```

---

### Task 6: Compiler — if/else jump targets

**Files:**
- Modify: `packages/shared/src/automation/compiler.ts` (extend `emit`)
- Test: `packages/shared/src/automation/__tests__/compiler.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/automation/__tests__/compiler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: FAIL — `emit` ignores `if`, so `instructions` is empty.

- [ ] **Step 3: Write the implementation**

In `packages/shared/src/automation/compiler.ts`, add the `if` case to the `switch` inside `emit` (before the closing brace of the switch):

```ts
      case 'if': {
        const jif = { op: 'JUMP_IF_FALSE' as const, cond: s.cond, target: -1, line: s.line };
        out.push(jif);
        emit(s.then, out);
        if (s.otherwise) {
          const jmp = { op: 'JUMP' as const, target: -1, line: s.line };
          out.push(jmp);
          jif.target = out.length; // else block starts here
          emit(s.otherwise, out);
          jmp.target = out.length; // continue after else
        } else {
          jif.target = out.length; // continue after then
        }
        break;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: PASS — if/else block passes.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/compiler.ts packages/shared/src/automation/__tests__/compiler.test.ts
git commit -m "feat: DSL compiler — if/else jump targets"
```

---

### Task 7: Compiler — repeat / repeat N times loop ops

**Files:**
- Modify: `packages/shared/src/automation/compiler.ts` (extend `emit`)
- Test: `packages/shared/src/automation/__tests__/compiler.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/automation/__tests__/compiler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: FAIL — `emit` ignores `repeat`, so `instructions` is empty.

- [ ] **Step 3: Write the implementation**

In `packages/shared/src/automation/compiler.ts`, add the `repeat` case to the `switch` inside `emit`:

```ts
      case 'repeat': {
        out.push({ op: 'PUSH_LOOP', count: s.count, line: s.line });
        const checkPc = out.length;
        const check = { op: 'LOOP_CHECK' as const, target: -1, line: s.line };
        out.push(check);
        emit(s.body, out);
        out.push({ op: 'LOOP_NEXT', target: checkPc, line: s.line });
        check.target = out.length; // jump here when the loop is done
        break;
      }
```

> **Runtime contract (for Plan 3):** `PUSH_LOOP count` pushes `count` onto a loop-counter stack (`-1` = infinite). `LOOP_CHECK target`: if the top counter is `0`, pop it and jump to `target`; otherwise fall through. `LOOP_NEXT target`: if the top counter is `> 0`, decrement it; then jump to `target` (the `LOOP_CHECK`). A `-1` counter is never decremented and never `0` → runs until the program is stopped.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: PASS — loops block passes.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/compiler.ts packages/shared/src/automation/__tests__/compiler.test.ts
git commit -m "feat: DSL compiler — repeat loop ops with counter stack"
```

---

### Task 8: Compiler — level gating

**Files:**
- Modify: `packages/shared/src/automation/compiler.ts` (add `checkGating` + `checkCondition`, call from `compileAst`)
- Test: `packages/shared/src/automation/__tests__/compiler.test.ts` (add a `describe` block)

Gating ladder (from spec §2):
- **MK.I (1):** sequence only — `fly`/`scan`/`mine`/`sell`.
- **MK.II (2):** + `if`/`else`, infinite `repeat`, conditions `resources`/`full`/`empty`.
- **MK.III (3):** + `repeat N times`, nested control structures, `not`, conditions `fuel < N`/`at`/`station`.

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/automation/__tests__/compiler.test.ts`:

```ts
describe('compiler — level gating', () => {
  const at = (level: number) => ({ level, maxLength: 120 });

  it('MK.I rejects if and repeat but allows a plain sequence', () => {
    expect(compileProgram('scan\nfly 1:1', at(1)).ok).toBe(true);
    const ifRes = compileProgram('if resources:\n  scan', at(1));
    expect(ifRes.ok).toBe(false);
    if (!ifRes.ok) expect(ifRes.errors[0].message).toContain('MK.II');
    const repRes = compileProgram('repeat:\n  scan', at(1));
    expect(repRes.ok).toBe(false);
  });

  it('MK.II allows if/else + infinite repeat + basic conditions', () => {
    const src = ['repeat:', '  if resources:', '    mine until full'].join('\n');
    // nested (if inside repeat) → needs MK.III, so this fails at MK.II
    expect(compileProgram(src, at(2)).ok).toBe(false);
    // flat if at MK.II with a basic condition → ok
    expect(compileProgram('if full:\n  scan', at(2)).ok).toBe(true);
  });

  it('MK.II rejects repeat N times, `not`, and advanced conditions', () => {
    expect(compileProgram('repeat 2 times:\n  scan', at(2)).ok).toBe(false);
    expect(compileProgram('if not full:\n  scan', at(2)).ok).toBe(false);
    expect(compileProgram('if fuel < 100:\n  scan', at(2)).ok).toBe(false);
    expect(compileProgram('if at 0:0:\n  scan', at(2)).ok).toBe(false);
    expect(compileProgram('if station:\n  sell all', at(2)).ok).toBe(false);
  });

  it('MK.III allows nesting, repeat N times, not, and advanced conditions', () => {
    const src = ['repeat:', '  if not full:', '    mine until full', '  if station:', '    sell all'].join('\n');
    expect(compileProgram(src, at(3)).ok).toBe(true);
    expect(compileProgram('repeat 3 times:\n  scan', at(3)).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: FAIL — no gating yet, so `compileProgram('if resources:...', level 1)` returns `ok: true`.

- [ ] **Step 3: Write the implementation**

In `packages/shared/src/automation/compiler.ts`, add these functions and call `checkGating` at the start of `compileAst`:

```ts
import type { Condition } from './types.js';

function checkCondition(c: Condition, level: number, line: number, errors: CompileError[]): void {
  if (c.negate && level < 3) errors.push({ line, message: '`not` braucht Computer MK.III.' });
  if ((c.kind === 'fuel_lt' || c.kind === 'at' || c.kind === 'station') && level < 3) {
    errors.push({ line, message: `Bedingung '${c.kind}' braucht Computer MK.III.` });
  }
}

function checkGating(ast: Stmt[], level: number, errors: CompileError[], depth = 0): void {
  for (const s of ast) {
    if (s.type === 'if') {
      if (level < 2) errors.push({ line: s.line, message: '`if` braucht Computer MK.II.' });
      if (depth >= 1 && level < 3) errors.push({ line: s.line, message: 'Verschachtelte Kontrollstrukturen brauchen Computer MK.III.' });
      checkCondition(s.cond, level, s.line, errors);
      checkGating(s.then, level, errors, depth + 1);
      if (s.otherwise) checkGating(s.otherwise, level, errors, depth + 1);
    } else if (s.type === 'repeat') {
      if (level < 2) errors.push({ line: s.line, message: '`repeat` braucht Computer MK.II.' });
      if (s.count >= 0 && level < 3) errors.push({ line: s.line, message: '`repeat N times` braucht Computer MK.III.' });
      if (depth >= 1 && level < 3) errors.push({ line: s.line, message: 'Verschachtelte Kontrollstrukturen brauchen Computer MK.III.' });
      checkGating(s.body, level, errors, depth + 1);
    }
  }
}
```

Then update `compileAst` so gating runs first and short-circuits:

```ts
export function compileAst(ast: Stmt[], opts: CompileOptions): CompileResult {
  const errors: CompileError[] = [];
  checkGating(ast, opts.level, errors);
  const count = countStatements(ast);
  if (count > opts.maxLength) {
    errors.push({
      line: 1,
      message: `Programm zu lang: ${count} Anweisungen (Limit ${opts.maxLength} bei MK.${opts.level}).`,
    });
  }
  if (errors.length) return { ok: false, errors };
  const instructions: Instr[] = [];
  emit(ast, instructions);
  return { ok: true, instructions, statementCount: count };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/automation/__tests__/compiler.test.ts`
Expected: PASS — level-gating block passes; all earlier blocks still green.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/automation/compiler.ts packages/shared/src/automation/__tests__/compiler.test.ts
git commit -m "feat: DSL compiler — level gating (MK.I-III feature ladder)"
```

---

### Task 9: Public API export, length-limit test, full-example integration & build

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/automation/__tests__/compiler.test.ts` (add an integration `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/automation/__tests__/compiler.test.ts`:

```ts
import { AUTOMATION_PROGRAM_LIMITS } from '../types.js';

describe('compiler — length limit & full example', () => {
  it('rejects a program longer than the MK level limit', () => {
    const longSrc = Array.from({ length: 11 }, () => 'scan').join('\n'); // 11 > MK.I limit 10
    const res = compileProgram(longSrc, { level: 1, maxLength: AUTOMATION_PROGRAM_LIMITS[1] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0].message).toContain('zu lang');
  });

  it('compiles the spec example at MK.III', () => {
    const src = [
      'repeat:',
      '  fly 3:5',
      '  scan',
      '  if resources:',
      '    mine until full',
      '  else:',
      '    fly 7:9',
      '    scan',
      '    mine until full',
      '  if full:',
      '    fly 0:0',
      '    sell all',
    ].join('\n');
    const res = compileProgram(src, { level: 3, maxLength: AUTOMATION_PROGRAM_LIMITS[3] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // sanity: first op opens the loop, last op closes it
    expect(res.instructions[0].op).toBe('PUSH_LOOP');
    expect(res.instructions[res.instructions.length - 1].op).toBe('LOOP_NEXT');
  });
});
```

Also add a top-level package re-export test — create `packages/shared/src/__tests__/automationExports.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compileProgram, AUTOMATION_PROGRAM_LIMITS } from '../index.js';

describe('automation public API (via package index)', () => {
  it('compileProgram and limits are re-exported from the package root', () => {
    expect(typeof compileProgram).toBe('function');
    expect(AUTOMATION_PROGRAM_LIMITS[3]).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/automation src/__tests__/automationExports.test.ts`
Expected: FAIL — `automationExports.test.ts` fails: `compileProgram` is not exported from `../index.js`.

- [ ] **Step 3: Write the implementation**

In `packages/shared/src/index.ts`, add the automation exports (after the existing `export type { ResearchNode }` line):

```ts
export { compileProgram, compileAst } from './automation/compiler.js';
export { parseProgram } from './automation/parser.js';
export type { ParseResult } from './automation/parser.js';
export * from './automation/types.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run src/automation src/__tests__/automationExports.test.ts`
Expected: PASS — length-limit, full-example, and export tests all green.

- [ ] **Step 5: Build shared (REQUIRED after changing shared/)**

Run: `cd packages/shared && npm run build`
Expected: `tsc` exits 0 with no errors (new `dist/automation/*` emitted).

- [ ] **Step 6: Full shared test run (no regressions)**

Run: `cd packages/shared && npx vitest run`
Expected: All shared tests pass (previously ~295, now higher with the new automation tests).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/automation/__tests__/compiler.test.ts packages/shared/src/__tests__/automationExports.test.ts packages/shared/dist
git commit -m "feat: export DSL compiler API + full-example integration test"
```

---

## Self-Review

**Spec coverage (§1 DSL + §2 gating):**
- DSL commands `fly`/`scan`/`mine [until full|<n>]`/`sell [all|<resource>]` → Tasks 2, 5. ✅
- Conditions `resources`/`full`/`empty`/`fuel < N`/`at X:Y`/`station` + `not` → Tasks 3, 8. ✅
- Control flow `if`/`else`, `repeat`, `repeat N times` → Tasks 4, 6, 7. ✅
- Indentation blocks + `#` comments → Task 2. ✅
- Compile to flat instruction list with jump targets (VM contract for Plan 3) → Tasks 5–7. ✅
- Level gating MK.I–III ladder → Task 8. ✅
- Length limit per level → Tasks 8, 9. ✅
- Line-numbered errors, never run invalid programs → all parse/compile tasks return `CompileFailure`. ✅
- Spec items NOT in this plan (correctly deferred): `computer` module/slot, DB, runtime VM execution, client UI, onboarding → Plans 2–4.

**Placeholder scan:** No TBD/TODO. Task 2 intentionally ships a minimal `parseBlock` + a stub `parseCondition`, each fully replaced (with real, complete code) in Tasks 3 & 4 — flagged inline, not left vague.

**Type consistency:** `Stmt`/`Instr`/`Condition`/`CompileResult`/`CompileOptions` are fixed in Task 1 and used verbatim afterward. `compileProgram(source, opts)` and `compileAst(ast, opts)` signatures are stable from Task 5 on. `parseProgram` returns `{ ast, errors }` (`ParseResult`) throughout; `parseCondition(text, line, errors)` signature is identical in Tasks 2 (stub) and 3 (real). Loop op runtime semantics are documented once (Task 7) as the contract Plan 3 implements.

**Verification caveat:** shared uses real `tsc` (clean) — unlike the client. `npm run build` in Task 9 is a meaningful gate.
