import { describe, it, expect } from 'vitest';
import { CONFIG_SEED } from '../engine/gameConfigSeed.js';

describe('automation config seed', () => {
  it('seeds program-length limits for MK.I-V and scheduler caps under category "automation"', () => {
    const keys = CONFIG_SEED.filter((e) => e.category === 'automation').map((e) => e.key);
    for (const k of ['AUTOMATION_MAXLEN_MK1', 'AUTOMATION_MAXLEN_MK5', 'AUTOMATION_OFFLINE_WINDOW_HOURS_MK4', 'AUTOMATION_MAX_CONCURRENT_OFFLINE', 'AUTOMATION_TICK_WORK_BUDGET', 'AUTOMATION_SCHEDULER_INTERVAL_MS']) {
      expect(keys).toContain(k);
    }
  });
  it('MK.I length default resolves to 10', () => {
    const e = CONFIG_SEED.find((x) => x.key === 'AUTOMATION_MAXLEN_MK1')!;
    expect(e.getDefault()).toBe(10);
  });
});
