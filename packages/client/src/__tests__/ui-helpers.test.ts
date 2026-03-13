import { describe, it, expect } from 'vitest';
import { btn, btnDisabled } from '../ui-helpers';

describe('btn', () => {
  it('wraps label in brackets', () => {
    expect(btn('ACCEPT')).toBe('[ACCEPT]');
  });
});

describe('btnDisabled', () => {
  it('wraps label with reason', () => {
    expect(btnDisabled('JUMP', 'NO AP')).toBe('[JUMP — NO AP]');
  });
});
