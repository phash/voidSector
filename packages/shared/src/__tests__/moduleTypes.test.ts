import { describe, it, expect } from 'vitest';
import type { ShipModule, ModuleSource, AcepPath, AcepXpSnapshot, ModuleDrawback } from '../types.js';

describe('module type extensions', () => {
  it('ShipModule has source field', () => {
    const m: ShipModule = { moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' };
    expect(m.source).toBe('standard');
  });

  it('ModuleSource covers all variants', () => {
    const sources: ModuleSource[] = ['standard', 'found', 'researched'];
    expect(sources).toHaveLength(3);
  });

  it('AcepPath covers all 4 paths', () => {
    const paths: AcepPath[] = ['ausbau', 'intel', 'kampf', 'explorer'];
    expect(paths).toHaveLength(4);
  });

  it('AcepXpSnapshot has all 4 path fields', () => {
    const snap: AcepXpSnapshot = { ausbau: 10, intel: 5, kampf: 20, explorer: 3 };
    expect(snap.ausbau).toBe(10);
    expect(snap.explorer).toBe(3);
  });

  it('ModuleDrawback supports both passive and runtime forms', () => {
    const passive: ModuleDrawback = { stat: 'hp', delta: -10, description: 'test' };
    const runtime: ModuleDrawback = { runtimeEffect: 'pulse_overheat', description: 'test' };
    expect(passive.stat).toBe('hp');
    expect(runtime.runtimeEffect).toBe('pulse_overheat');
  });
});
