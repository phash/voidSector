import { describe, it, expect } from 'vitest';
import { parseProgram, parseCondition } from '../parser.js';

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
