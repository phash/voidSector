import { describe, it, expect } from 'vitest';
import { compileProgram } from '../compiler.js';
import { AUTOMATION_PROGRAM_LIMITS } from '../types.js';
import type { CompileResult } from '../types.js';

/**
 * Realistische Missions-Szenarien für autonome Schiffe.
 *
 * Diese Skripte sind doppelt nützlich:
 *  1. Sie validieren das DSL-Sprachdesign End-to-End (parse → gate → emit) gegen
 *     echte Missionen statt Mikro-Beispiele.
 *  2. Sie sind die Vorlagen-Bibliothek für den Template-Picker im AUTOMAT-Tab (Plan 4).
 *
 * Konvention: jedes Szenario nennt das benötigte Mindest-Computer-Level (MK.x).
 */

const opts = (level: number) => ({ level, maxLength: AUTOMATION_PROGRAM_LIMITS[level] });

function ok(src: string, level: number): Extract<CompileResult, { ok: true }> {
  const res = compileProgram(src, opts(level));
  if (!res.ok) throw new Error(`erwartete erfolgreiche Kompilierung, bekam Fehler: ${JSON.stringify(res.errors)}`);
  return res;
}

// ── Vorlagen-Bibliothek (Templates für den AUTOMAT-Tab) ──────────────────────

/** MK.I — reine Sequenz: hinfliegen, abbauen, heimfliegen, verkaufen. */
const S1_LIEFERLAUF = `fly 5:5
scan
mine until full
fly 0:0
sell all`;

/** MK.II — bedingter Abbau (flaches if + Basis-Bedingung). */
const S2_BEDINGTER_ABBAU = `fly 5:5
scan
if resources:
  mine until full
else:
  scan`;

/** MK.III — voll-autonomer Mining-Loop (verschachteltes if im repeat) = Spec-Beispiel. */
const S3_AUTONOMER_LOOP = `repeat:
  fly 3:5
  scan
  if resources:
    mine until full
  else:
    fly 7:9
    scan
    mine until full
  if full:
    fly 0:0
    sell all`;

/** MK.III — treibstoff-bewusster Sammler (fuel < N, repeat N times). */
const S4_TREIBSTOFF_WACHE = `repeat 5 times:
  if fuel < 500:
    fly 0:0
  scan
  if resources:
    mine until full
  if full:
    fly 0:0
    sell all`;

/** MK.III — Verkaufsrunde mit Stations-Check (station + not). */
const S5_VERKAUFSRUNDE = `repeat:
  if not full:
    mine until full
  if station:
    sell all
  else:
    fly 0:0`;

describe('autonome Schiffe — Missions-Szenarien (Templates)', () => {
  it('S1 Lieferlauf kompiliert ab MK.I (reine Sequenz)', () => {
    const res = ok(S1_LIEFERLAUF, 1);
    expect(res.statementCount).toBe(5);
    expect(res.instructions.map((i) => i.op)).toEqual(['FLY', 'SCAN', 'MINE', 'FLY', 'SELL']);
  });

  it('S2 Bedingter Abbau kompiliert ab MK.II', () => {
    const res = ok(S2_BEDINGTER_ABBAU, 2);
    // if/else erzeugt JUMP_IF_FALSE + JUMP irgendwo im Bytecode
    expect(res.instructions.some((i) => i.op === 'JUMP_IF_FALSE')).toBe(true);
    expect(res.instructions.some((i) => i.op === 'JUMP')).toBe(true);
  });

  it('S3 Autonomer Loop kompiliert ab MK.III (Spec-Beispiel)', () => {
    const res = ok(S3_AUTONOMER_LOOP, 3);
    expect(res.instructions[0].op).toBe('PUSH_LOOP');
    expect(res.instructions[res.instructions.length - 1].op).toBe('LOOP_NEXT');
    expect(res.statementCount).toBeLessThanOrEqual(AUTOMATION_PROGRAM_LIMITS[3]);
  });

  it('S4 Treibstoff-Wache kompiliert ab MK.III (fuel < N + repeat N times)', () => {
    const res = ok(S4_TREIBSTOFF_WACHE, 3);
    expect(res.instructions[0]).toMatchObject({ op: 'PUSH_LOOP', count: 5 });
  });

  it('S5 Verkaufsrunde kompiliert ab MK.III (station + not)', () => {
    const res = ok(S5_VERKAUFSRUNDE, 3);
    expect(res.instructions[0].op).toBe('PUSH_LOOP');
  });
});

describe('autonome Schiffe — Gating greift szenario-weit', () => {
  it('Lieferlauf (MK.I) läuft auch auf höheren Stufen', () => {
    expect(compileProgram(S1_LIEFERLAUF, opts(3)).ok).toBe(true);
    expect(compileProgram(S1_LIEFERLAUF, opts(5)).ok).toBe(true);
  });

  it('Bedingter Abbau wird auf MK.I abgelehnt (kein if)', () => {
    const res = compileProgram(S2_BEDINGTER_ABBAU, opts(1));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0].message).toContain('MK.II');
  });

  it('Autonomer Loop wird auf MK.II abgelehnt (Verschachtelung braucht MK.III)', () => {
    const res = compileProgram(S3_AUTONOMER_LOOP, opts(2));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.message.includes('MK.III'))).toBe(true);
  });

  it('Treibstoff-Wache wird auf MK.II abgelehnt (repeat N times + fuel<N brauchen MK.III)', () => {
    expect(compileProgram(S4_TREIBSTOFF_WACHE, opts(2)).ok).toBe(false);
  });

  it('zu langes Skript wird am MK.I-Längenlimit abgelehnt', () => {
    const tooLong = Array.from({ length: AUTOMATION_PROGRAM_LIMITS[1] + 1 }, () => 'scan').join('\n');
    const res = compileProgram(tooLong, opts(1));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0].message).toContain('zu lang');
  });
});
