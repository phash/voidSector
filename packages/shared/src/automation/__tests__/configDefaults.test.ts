import { describe, it, expect } from 'vitest';
import {
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK4,
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK5,
  AUTOMATION_MAX_CONCURRENT_OFFLINE,
  AUTOMATION_TICK_WORK_BUDGET,
  AUTOMATION_SCHEDULER_INTERVAL_MS,
} from '../types.js';

describe('automation config defaults', () => {
  it('defines offline windows for MK.IV and MK.V', () => {
    expect(AUTOMATION_OFFLINE_WINDOW_HOURS_MK4).toBe(4);
    expect(AUTOMATION_OFFLINE_WINDOW_HOURS_MK5).toBe(12);
  });
  it('defines scheduler safety caps', () => {
    expect(AUTOMATION_MAX_CONCURRENT_OFFLINE).toBeGreaterThan(0);
    expect(AUTOMATION_TICK_WORK_BUDGET).toBeGreaterThan(0);
    expect(AUTOMATION_SCHEDULER_INTERVAL_MS).toBeGreaterThanOrEqual(250);
  });
});
