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
