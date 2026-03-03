import { describe, it, expect } from 'vitest';
import { checkDistressCall, calculateRescueReward, canRescue } from '../rescue.js';
import { RESCUE_REWARDS, SHIP_CLASSES } from '@void-sector/shared';

describe('Rescue System', () => {
  it('should check distress call chance (~8%)', () => {
    let calls = 0;
    for (let i = 0; i < 10000; i++) {
      if (checkDistressCall(i, i * 3)) calls++;
    }
    const ratio = calls / 10000;
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.12);
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

  it('should check if rescue is possible (safeSlots)', () => {
    const scout = SHIP_CLASSES.aegis_scout_mk1;
    expect(canRescue(scout.safeSlots, 0)).toBe(true);
    expect(canRescue(scout.safeSlots, 1)).toBe(false);
  });

  it('void_seeker should have more safe slots', () => {
    const seeker = SHIP_CLASSES.void_seeker_mk2;
    expect(canRescue(seeker.safeSlots, 2)).toBe(true);
    expect(canRescue(seeker.safeSlots, 3)).toBe(false);
  });
});
