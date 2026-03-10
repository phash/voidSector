import { describe, it, expect } from 'vitest';
import { btn, btnDisabled, UI } from '../ui-strings';

describe('btn', () => {
  it('wraps label in brackets', () => {
    expect(btn('ACCEPT')).toBe('[ACCEPT]');
  });

  it('wraps interpolated label', () => {
    expect(btn('JETTISON ORE')).toBe('[JETTISON ORE]');
  });
});

describe('btnDisabled', () => {
  it('wraps label with reason', () => {
    expect(btnDisabled('JUMP', 'NO AP')).toBe('[JUMP — NO AP]');
  });

  it('works with UI.reasons constants', () => {
    expect(btnDisabled(UI.actions.JUMP, UI.reasons.NO_AP)).toBe('[JUMP — NO AP]');
  });

  it('works with dynamic AP cost reason', () => {
    expect(btnDisabled(UI.actions.SCAN, UI.reasons.AP_COST(3))).toBe('[SCAN — COSTS 3 AP]');
  });
});

describe('UI constants', () => {
  it('actions are plain strings without brackets', () => {
    expect(UI.actions.ACCEPT).toBe('ACCEPT');
    expect(UI.actions.CANCEL).toBe('CANCEL');
    expect(UI.actions.JETTISON).toBe('JETTISON');
  });

  it('tabs are plain uppercase strings', () => {
    expect(UI.tabs.RESOURCES).toBe('RESOURCES');
    expect(UI.tabs.BLUEPRINTS).toBe('BLUEPRINTS');
  });

  it('programs.TRADING_POST is correct', () => {
    expect(UI.programs.TRADING_POST).toBe('TRADING POST');
  });

  it('reasons.AP_COST is a function returning string', () => {
    expect(UI.reasons.AP_COST(5)).toBe('COSTS 5 AP');
  });
});
