import { describe, it, expect } from 'vitest';
import { validateFactionAction } from '../commands.js';

describe('validateFactionAction', () => {
  it('leader can kick members', () => {
    const result = validateFactionAction('kick', 'leader', 'member');
    expect(result.valid).toBe(true);
  });

  it('leader can kick officers', () => {
    const result = validateFactionAction('kick', 'leader', 'officer');
    expect(result.valid).toBe(true);
  });

  it('officer can kick members', () => {
    const result = validateFactionAction('kick', 'officer', 'member');
    expect(result.valid).toBe(true);
  });

  it('officer cannot kick officers', () => {
    const result = validateFactionAction('kick', 'officer', 'officer');
    expect(result.valid).toBe(false);
  });

  it('member cannot kick anyone', () => {
    const result = validateFactionAction('kick', 'member', 'member');
    expect(result.valid).toBe(false);
  });

  it('only leader can promote', () => {
    expect(validateFactionAction('promote', 'leader', 'member').valid).toBe(true);
    expect(validateFactionAction('promote', 'officer', 'member').valid).toBe(false);
  });

  it('only leader can demote', () => {
    expect(validateFactionAction('demote', 'leader', 'officer').valid).toBe(true);
    expect(validateFactionAction('demote', 'officer', 'member').valid).toBe(false);
  });

  it('only leader can disband', () => {
    expect(validateFactionAction('disband', 'leader', undefined).valid).toBe(true);
    expect(validateFactionAction('disband', 'officer', undefined).valid).toBe(false);
  });

  it('only leader can setJoinMode', () => {
    expect(validateFactionAction('setJoinMode', 'leader', undefined).valid).toBe(true);
    expect(validateFactionAction('setJoinMode', 'officer', undefined).valid).toBe(false);
  });

  it('leader and officer can invite', () => {
    expect(validateFactionAction('invite', 'leader', undefined).valid).toBe(true);
    expect(validateFactionAction('invite', 'officer', undefined).valid).toBe(true);
    expect(validateFactionAction('invite', 'member', undefined).valid).toBe(false);
  });
});
