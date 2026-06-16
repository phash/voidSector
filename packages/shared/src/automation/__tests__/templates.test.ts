import { describe, it, expect } from 'vitest';
import { PROGRAM_TEMPLATES } from '../templates.js';
import { compileProgram, AUTOMATION_PROGRAM_LIMITS } from '../../index.js';

describe('PROGRAM_TEMPLATES', () => {
  it('has 5 templates, each compiling at its declared minLevel', () => {
    expect(PROGRAM_TEMPLATES).toHaveLength(5);
    for (const t of PROGRAM_TEMPLATES) {
      const res = compileProgram(t.source, { level: t.minLevel, maxLength: AUTOMATION_PROGRAM_LIMITS[t.minLevel] });
      expect(res.ok, `${t.name} should compile at MK.${t.minLevel}`).toBe(true);
    }
  });
  it('the MK.III loop template does NOT compile at MK.II (nesting gate)', () => {
    const loop = PROGRAM_TEMPLATES.find((t) => t.minLevel === 3)!;
    expect(compileProgram(loop.source, { level: 2, maxLength: 99 }).ok).toBe(false);
  });
});
