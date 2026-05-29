import { describe, it, expect } from 'vitest';
import { isValidEmail, validateRegisterInput } from '../emailValidation.js';

describe('isValidEmail', () => {
  it('accepts normal addresses incl. +tags', () => {
    expect(isValidEmail('a@b.de')).toBe(true);
    expect(isValidEmail('mroedig+vs1@gmail.com')).toBe(true);
  });
  it('rejects garbage', () => {
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a @b.de')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('validateRegisterInput', () => {
  it('accepts valid input and trims the email', () => {
    expect(validateRegisterInput({ username: 'pilot', email: '  p@x.de ', password: 'secret1' })).toEqual({
      ok: true,
      email: 'p@x.de',
    });
  });
  it('rejects short username', () => {
    expect(validateRegisterInput({ username: 'ab', email: 'p@x.de', password: 'secret1' })).toEqual({
      ok: false,
      error: 'Username must be 3-32 characters',
    });
  });
  it('rejects short password', () => {
    const r = validateRegisterInput({ username: 'pilot', email: 'p@x.de', password: '123' });
    expect(r.ok).toBe(false);
  });
  it('rejects invalid email', () => {
    const r = validateRegisterInput({ username: 'pilot', email: 'nope', password: 'secret1' });
    expect(r).toEqual({ ok: false, error: 'Valid email required' });
  });
});
