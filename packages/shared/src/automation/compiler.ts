import type { CompileError, Condition, CompileOptions, CompileResult, Instr, Stmt } from './types.js';
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

export function compileProgram(source: string, opts: CompileOptions): CompileResult {
  const { ast, errors } = parseProgram(source);
  if (errors.length) return { ok: false, errors };
  return compileAst(ast, opts);
}
