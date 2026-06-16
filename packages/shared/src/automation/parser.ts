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
