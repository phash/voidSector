import { describe, it, expect } from 'vitest';
import { resolveStrategicTick, calculateBaseDefense, STATION_DEFENSE } from '../engine/warfareEngine.js';

describe('resolveStrategicTick', () => {
  it('attacker wins when attack > defense * 1.2', () => {
    const result = resolveStrategicTick({ attack: 1300, defense: 1000 });
    expect(result.outcome).toBe('attacker_wins');
    expect(result.newDefense).toBe(900); // 10% reduction: 1000 * 0.9
    expect(result.newAttack).toBe(1300); // unchanged
    expect(result.conquest).toBe(false);
  });

  it('defender wins when defense > attack * 1.2', () => {
    const result = resolveStrategicTick({ attack: 800, defense: 1000 });
    expect(result.outcome).toBe('defender_wins');
    expect(result.newAttack).toBe(720); // 10% reduction: 800 * 0.9
    expect(result.newDefense).toBe(1000); // unchanged
    expect(result.invasionRepelled).toBe(false);
  });

  it('stalemate when neither side has 1.2x advantage', () => {
    const result = resolveStrategicTick({ attack: 1000, defense: 1000 });
    expect(result.outcome).toBe('stalemate');
    expect(result.newAttack).toBe(950);  // 5% reduction: 1000 * 0.95
    expect(result.newDefense).toBe(950); // 5% reduction: 1000 * 0.95
  });

  it('signals conquest when defense reaches 0', () => {
    const result = resolveStrategicTick({ attack: 9999, defense: 50 });
    expect(result.outcome).toBe('attacker_wins');
    expect(result.conquest).toBe(true);
    expect(result.newDefense).toBe(0);
  });

  it('signals invasionRepelled when attack reaches 0', () => {
    const result = resolveStrategicTick({ attack: 50, defense: 9999 });
    expect(result.outcome).toBe('defender_wins');
    expect(result.invasionRepelled).toBe(true);
    expect(result.newAttack).toBe(0);
  });

  it('player attack bonus shifts outcome — attacker wins with bonus', () => {
    // Without bonus: attack=800 vs defense=1000 → defender wins
    // With bonus: effectiveAttack=800+300=1100 → still 1100 < 1000*1.2=1200 → stalemate
    const result = resolveStrategicTick({ attack: 800, defense: 1000, playerAttackBonus: 300 });
    expect(result.outcome).toBe('stalemate');
  });

  it('player attack bonus can push to attacker win', () => {
    // effectiveAttack=800+500=1300 > 1000*1.2=1200 → attacker wins
    const result = resolveStrategicTick({ attack: 800, defense: 1000, playerAttackBonus: 500 });
    expect(result.outcome).toBe('attacker_wins');
  });

  it('player defense bonus can prevent attacker win but needs 1.2x to reach defender win', () => {
    // Without bonus: attack=1300 vs defense=1000 → attacker wins (1300 > 1000*1.2=1200)
    // With bonus: effectiveAttack=1300, effectiveDefense=1400
    //   1300 > 1400*1.2=1680? No → not attacker_wins
    //   1400 > 1300*1.2=1560? No → not defender_wins
    //   → stalemate
    const result = resolveStrategicTick({ attack: 1300, defense: 1000, playerDefenseBonus: 400 });
    expect(result.outcome).toBe('stalemate');
  });

  it('attack multiplier applies to effective attack', () => {
    // effectiveAttack = 800 * 1.5 = 1200, effectiveDefense = 1000
    // 1200 = exactly 1000*1.2 → NOT strictly greater, so stalemate
    const result = resolveStrategicTick({ attack: 800, defense: 1000, attackMultiplier: 1.5 });
    expect(result.outcome).toBe('stalemate');
  });
});

describe('STATION_DEFENSE', () => {
  it('has correct values for all tiers', () => {
    expect(STATION_DEFENSE[0]).toBe(0);
    expect(STATION_DEFENSE[1]).toBe(100);
    expect(STATION_DEFENSE[2]).toBe(300);
    expect(STATION_DEFENSE[3]).toBe(700);
    expect(STATION_DEFENSE[4]).toBe(1500);
  });
});

describe('calculateBaseDefense', () => {
  it('sums station defense and fleet strength', () => {
    expect(calculateBaseDefense(3, 200)).toBe(900); // 700 + 200
    expect(calculateBaseDefense(1, 0)).toBe(100);   // 100 + 0
    expect(calculateBaseDefense(0, 500)).toBe(500); // 0 + 500
  });
});
