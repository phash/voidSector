import { describe, it, expect } from 'vitest';
import { checkDistressCall, calculateRescueReward, canRescue } from '../rescue.js';
import { RESCUE_REWARDS } from '@void-sector/shared';

describe('Rescue System', () => {
  it('should check distress call chance (~0.5%)', () => {
    let calls = 0;
    for (let i = 0; i < 10000; i++) {
      if (checkDistressCall(i, i * 3)) calls++;
    }
    const ratio = calls / 10000;
    expect(ratio).toBeGreaterThan(0.002);
    expect(ratio).toBeLessThan(0.01);
  });

  it('should calculate rewards by source type', () => {
    expect(calculateRescueReward('scan_event')).toEqual(RESCUE_REWARDS.scan_event);
    expect(calculateRescueReward('npc_quest')).toEqual(RESCUE_REWARDS.npc_quest);
    expect(calculateRescueReward('comm_distress')).toEqual(RESCUE_REWARDS.comm_distress);
  });

  it('comm_distress should give highest reward', () => {
    const scan = calculateRescueReward('scan_event');
    const comm = calculateRescueReward('comm_distress');
    expect(comm.credits).toBeGreaterThan(scan.credits);
  });

  it('should check if rescue is possible (1 safe slot)', () => {
    const safeSlots = 1; // scout hull
    expect(canRescue(safeSlots, 0)).toBe(true);
    expect(canRescue(safeSlots, 1)).toBe(false);
  });

  it('explorer hull should support more safe slots', () => {
    const safeSlots = 3; // explorer-tier hull with safe slot modules
    expect(canRescue(safeSlots, 2)).toBe(true);
    expect(canRescue(safeSlots, 3)).toBe(false);
  });
});
