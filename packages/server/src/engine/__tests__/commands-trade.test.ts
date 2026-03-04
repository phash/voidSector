import { describe, it, expect } from 'vitest';
import { validateTransfer, validateNpcTrade } from '../commands.js';

describe('validateTransfer', () => {
  const cargo = { ore: 10, gas: 5, crystal: 2 };
  const storage = { ore: 20, gas: 10, crystal: 5 };

  it('allows toStorage when cargo has enough', () => {
    const result = validateTransfer('toStorage', 'ore', 5, cargo, storage, 1);
    expect(result.valid).toBe(true);
  });

  it('rejects toStorage when cargo insufficient', () => {
    const result = validateTransfer('toStorage', 'ore', 20, cargo, storage, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Not enough');
  });

  it('rejects toStorage when storage full', () => {
    const fullStorage = { ore: 45, gas: 3, crystal: 2 };
    const result = validateTransfer('toStorage', 'ore', 1, cargo, fullStorage, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Storage full');
  });

  it('allows fromStorage when storage has enough', () => {
    const result = validateTransfer('fromStorage', 'ore', 10, cargo, storage, 1);
    expect(result.valid).toBe(true);
  });

  it('rejects fromStorage when storage insufficient', () => {
    const result = validateTransfer('fromStorage', 'ore', 30, cargo, storage, 1);
    expect(result.valid).toBe(false);
  });

  it('rejects zero amount', () => {
    const result = validateTransfer('toStorage', 'ore', 0, cargo, storage, 1);
    expect(result.valid).toBe(false);
  });

  it('respects tier 2 capacity (150)', () => {
    const bigStorage = { ore: 100, gas: 30, crystal: 10 };
    const result = validateTransfer('toStorage', 'ore', 10, cargo, bigStorage, 2);
    expect(result.valid).toBe(true);
  });
});

describe('validateNpcTrade', () => {
  const storage = { ore: 20, gas: 10, crystal: 5 };

  it('allows selling when storage has resources', () => {
    const result = validateNpcTrade('sell', 'ore', 5, 0, storage, 1);
    expect(result.valid).toBe(true);
    expect(result.totalPrice).toBe(40);
  });

  it('allows buying when credits sufficient', () => {
    const result = validateNpcTrade('buy', 'ore', 5, 100, storage, 2);
    expect(result.valid).toBe(true);
    expect(result.totalPrice).toBe(60);
  });

  it('rejects buying when credits insufficient', () => {
    const result = validateNpcTrade('buy', 'crystal', 10, 50, storage, 2);
    expect(result.valid).toBe(false);
  });

  it('rejects selling when storage empty', () => {
    const result = validateNpcTrade('sell', 'ore', 30, 0, storage, 1);
    expect(result.valid).toBe(false);
  });

  it('rejects buying when storage full', () => {
    const fullStorage = { ore: 45, gas: 3, crystal: 2 };
    const result = validateNpcTrade('buy', 'ore', 5, 1000, fullStorage, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Storage full');
  });
});
