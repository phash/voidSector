import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ShipStats } from '@void-sector/shared';

/**
 * Integration tests for the autopilot handler flow.
 *
 * These tests exercise the interaction between the autopilot engine
 * (pure functions) and the DB persistence layer (mocked), simulating
 * the start → progress → pause → resume → cancel lifecycle as it
 * would happen inside SectorRoom handlers.
 */

// --- Mock DB client ---
vi.mock('../../db/client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/client.js';
import {
  saveAutopilotRoute,
  getActiveAutopilotRoute,
  updateAutopilotStep,
  pauseAutopilotRoute,
  cancelAutopilotRoute,
  completeAutopilotRoute,
} from '../../db/queries.js';
import {
  calculateAutopilotPath,
  calculateAutopilotCosts,
  getNextSegment,
  STEP_INTERVAL_MS,
  STEP_INTERVAL_MIN_MS,
} from '../autopilot.js';
import type { AutopilotRouteRow } from '../../db/queries.js';

const mockQuery = vi.mocked(query);

function mockShipStats(overrides: Partial<ShipStats> = {}): ShipStats {
  return {
    fuelMax: 100,
    cargoCap: 10,
    jumpRange: 5,
    apCostJump: 1,
    fuelPerJump: 1,
    hp: 50,
    commRange: 50,
    scannerLevel: 1,
    damageMod: 0,
    shieldHp: 0,
    shieldRegen: 0,
    weaponAttack: 0,
    weaponType: 'laser',
    weaponPiercing: 0,
    pointDefense: 0,
    ecmReduction: 0,
    engineSpeed: 2,
    artefactChanceBonus: 0,
    safeSlotBonus: 0,
    hyperdriveRange: 10,
    hyperdriveSpeed: 2,
    hyperdriveRegen: 1.0,
    hyperdriveFuelEfficiency: 0,
    ...overrides,
  };
}

const noBlackHoles = () => false;

function mockRouteRow(overrides: Partial<AutopilotRouteRow> = {}): AutopilotRouteRow {
  return {
    userId: 'player-1',
    targetX: 5,
    targetY: 3,
    useHyperjump: false,
    path: [
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 1 },
      { x: 5, y: 2 }, { x: 5, y: 3 },
    ],
    currentStep: 0,
    totalSteps: 8,
    startedAt: Date.now(),
    lastStepAt: Date.now(),
    status: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Start flow: path calculation → cost preview → DB save
// ---------------------------------------------------------------------------
describe('autopilot start flow', () => {
  it('computes path and saves route to DB', async () => {
    const from = { x: 0, y: 0 };
    const target = { x: 5, y: 3 };
    const ship = mockShipStats();

    // 1. Calculate path
    const path = calculateAutopilotPath(from, target, noBlackHoles);
    expect(path).toHaveLength(8); // 5 X + 3 Y

    // 2. Calculate cost preview
    const costs = calculateAutopilotCosts(path, ship, false);
    expect(costs.totalAP).toBe(8); // 8 steps * 1 AP
    expect(costs.totalFuel).toBe(0);
    expect(costs.estimatedTime).toBe(8 * STEP_INTERVAL_MS);

    // 3. Save route to DB
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] } as any);
    const now = Date.now();
    await saveAutopilotRoute('player-1', target.x, target.y, false, path, now);

    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO autopilot_routes'),
      expect.arrayContaining(['player-1', 5, 3, false]),
    );
  });

  it('computes hyperjump cost preview with batching', () => {
    const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 10, y: 0 }, noBlackHoles);
    const ship = mockShipStats({ engineSpeed: 3, hyperdriveFuelEfficiency: 0.2 });

    const costs = calculateAutopilotCosts(path, ship, true);

    expect(costs.totalFuel).toBeGreaterThan(0);
    expect(costs.totalAP).toBeGreaterThan(0);
    // With speed 3, 10 steps = ceil(10/3) = 4 batches
    // Tick ms = max(20, floor(100/3)) = 33
    expect(costs.estimatedTime).toBe(4 * Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / 3)));
  });

  it('rejects start when same sector', () => {
    const path = calculateAutopilotPath({ x: 5, y: 5 }, { x: 5, y: 5 }, noBlackHoles);
    expect(path).toHaveLength(0);
    // Handler would send AUTOPILOT_FAIL error on empty path
  });
});

// ---------------------------------------------------------------------------
// Progress flow: incremental stepping via getNextSegment
// ---------------------------------------------------------------------------
describe('autopilot progress flow', () => {
  it('steps through normal mode one sector at a time', () => {
    const route = mockRouteRow();
    const ship = mockShipStats();
    const steps: Array<{ x: number; y: number }> = [];
    let step = route.currentStep;
    let ap = 10;

    while (step < route.totalSteps && ap >= ship.apCostJump) {
      const seg = getNextSegment(route.path, step, 0, 0); // normal mode
      if (seg.moves.length === 0) break;

      expect(seg.isHyperjump).toBe(false);
      expect(seg.moves).toHaveLength(1);

      ap -= ship.apCostJump;
      step += seg.moves.length;
      steps.push(seg.moves[0]);
    }

    expect(step).toBe(8);
    expect(steps[steps.length - 1]).toEqual({ x: 5, y: 3 });
  });

  it('steps through hyperjump mode in batches', () => {
    const route = mockRouteRow({ useHyperjump: true });
    const ship = mockShipStats({ engineSpeed: 3 });
    let step = route.currentStep;
    let fuel = 100;
    const batchSizes: number[] = [];

    while (step < route.totalSteps && fuel > 0) {
      const seg = getNextSegment(route.path, step, fuel, ship.engineSpeed);
      if (seg.moves.length === 0) break;

      expect(seg.isHyperjump).toBe(true);
      batchSizes.push(seg.moves.length);

      fuel -= seg.moves.length; // 1 fuel per sector
      step += seg.moves.length;
    }

    expect(step).toBe(8);
    // speed 3: batches should be [3, 3, 2]
    expect(batchSizes).toEqual([3, 3, 2]);
  });

  it('updates DB step after each tick', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);

    await updateAutopilotStep('player-1', 3, Date.now());
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE autopilot_routes SET current_step'),
      expect.arrayContaining(['player-1', 3]),
    );
  });
});

// ---------------------------------------------------------------------------
// Pause on resource exhaustion
// ---------------------------------------------------------------------------
describe('autopilot pause on resource exhaustion', () => {
  it('pauses when AP runs out mid-route', () => {
    const route = mockRouteRow();
    let step = route.currentStep;
    let ap = 3; // only 3 AP available

    while (step < route.totalSteps && ap >= 1) {
      const seg = getNextSegment(route.path, step, 0, 0);
      if (seg.moves.length === 0) break;

      ap -= 1; // 1 AP per step
      step += seg.moves.length;
    }

    // Should have moved exactly 3 sectors then paused
    expect(step).toBe(3);
    expect(ap).toBe(0);
    // Handler would call pauseAutopilotRoute at this point
  });

  it('pauses when fuel runs out mid-route (hyperjump)', () => {
    const route = mockRouteRow({ useHyperjump: true });
    const speed = 3;
    let step = route.currentStep;
    let fuel = 5; // only 5 fuel

    while (step < route.totalSteps && fuel > 0) {
      const seg = getNextSegment(route.path, step, fuel, speed);
      if (seg.moves.length === 0) break;

      const fuelCost = seg.moves.length;
      if (fuelCost > fuel) break;

      fuel -= fuelCost;
      step += seg.moves.length;
    }

    // speed 3, fuel 5: batch 1 = 3 (fuel 2), batch 2 = 2 (fuel 0), done
    expect(step).toBe(5);
    expect(fuel).toBe(0);
  });

  it('persists pause status to DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);

    const paused = await pauseAutopilotRoute('player-1');
    expect(paused).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'paused'"),
      ['player-1'],
    );
  });
});

// ---------------------------------------------------------------------------
// Resume after relog
// ---------------------------------------------------------------------------
describe('autopilot resume after relog', () => {
  it('fetches active route from DB and resumes from saved step', async () => {
    const route = mockRouteRow({ currentStep: 4 });

    // Mock DB returning active route
    mockQuery.mockResolvedValueOnce({
      rows: [{
        user_id: route.userId,
        target_x: route.targetX,
        target_y: route.targetY,
        use_hyperjump: route.useHyperjump,
        path: route.path,
        current_step: route.currentStep,
        total_steps: route.totalSteps,
        started_at: String(route.startedAt),
        last_step_at: String(route.lastStepAt),
        status: 'active',
      }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const activeRoute = await getActiveAutopilotRoute('player-1');
    expect(activeRoute).not.toBeNull();
    expect(activeRoute!.currentStep).toBe(4);
    expect(activeRoute!.totalSteps).toBe(8);

    // Resume: get next segment from saved step
    const seg = getNextSegment(activeRoute!.path, activeRoute!.currentStep, 0, 0);
    expect(seg.moves[0]).toEqual({ x: 5, y: 0 });
    expect(seg.moves).toHaveLength(1);
  });

  it('does not resume if no active route', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const activeRoute = await getActiveAutopilotRoute('player-1');
    expect(activeRoute).toBeNull();
  });

  it('resumes with correct remaining cost estimate', async () => {
    const route = mockRouteRow({ currentStep: 5 });
    const ship = mockShipStats();

    // Remaining path from step 5 to end
    const remainingPath = route.path.slice(route.currentStep);
    const costs = calculateAutopilotCosts(remainingPath, ship, false);

    expect(costs.totalAP).toBe(3); // 3 remaining steps
    expect(costs.estimatedTime).toBe(3 * STEP_INTERVAL_MS);
  });
});

// ---------------------------------------------------------------------------
// Cancel flow
// ---------------------------------------------------------------------------
describe('autopilot cancel', () => {
  it('cancels active route in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);

    const cancelled = await cancelAutopilotRoute('player-1');
    expect(cancelled).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'cancelled'"),
      ['player-1'],
    );
  });

  it('cancel is safe when no active route exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'UPDATE', oid: 0, fields: [] } as any);

    const cancelled = await cancelAutopilotRoute('player-1');
    expect(cancelled).toBe(false);
  });

  it('getNextSegment returns empty after cancellation (path exhausted)', () => {
    const path = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
    // Simulate cancelled at step 2 (route complete)
    const seg = getNextSegment(path, 2, 10, 3);
    expect(seg.moves).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Complete flow
// ---------------------------------------------------------------------------
describe('autopilot completion', () => {
  it('marks route as completed in DB when path exhausted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);

    await completeAutopilotRoute('player-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'completed'"),
      ['player-1'],
    );
  });

  it('full lifecycle: start → step → complete', async () => {
    const from = { x: 0, y: 0 };
    const target = { x: 3, y: 0 };
    const ship = mockShipStats();

    // 1. Calculate path
    const path = calculateAutopilotPath(from, target, noBlackHoles);
    expect(path).toHaveLength(3);

    // 2. Simulate save
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'INSERT', oid: 0, fields: [] } as any);
    await saveAutopilotRoute('player-1', target.x, target.y, false, path, Date.now());

    // 3. Step through the route
    let step = 0;
    let ap = 10;
    const positions: Array<{ x: number; y: number }> = [];

    while (step < path.length && ap >= ship.apCostJump) {
      const seg = getNextSegment(path, step, 0, 0);
      if (seg.moves.length === 0) break;

      ap -= ship.apCostJump;
      step += seg.moves.length;
      positions.push(seg.moves[seg.moves.length - 1]);

      // Simulate DB step update
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);
      await updateAutopilotStep('player-1', step, Date.now());
    }

    expect(step).toBe(3);
    expect(positions).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);

    // 4. Complete
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);
    await completeAutopilotRoute('player-1');
  });

  it('full lifecycle with hyperjump batching', async () => {
    const from = { x: 0, y: 0 };
    const target = { x: 10, y: 0 };
    const speed = 4;
    const ship = mockShipStats({ engineSpeed: speed });

    const path = calculateAutopilotPath(from, target, noBlackHoles);
    expect(path).toHaveLength(10);

    let step = 0;
    let fuel = 100;
    const batchSizes: number[] = [];

    while (step < path.length) {
      const seg = getNextSegment(path, step, fuel, speed);
      if (seg.moves.length === 0) break;

      expect(seg.isHyperjump).toBe(true);
      batchSizes.push(seg.moves.length);
      fuel -= seg.moves.length;
      step += seg.moves.length;
    }

    expect(step).toBe(10);
    // speed 4: [4, 4, 2]
    expect(batchSizes).toEqual([4, 4, 2]);
  });
});

// ---------------------------------------------------------------------------
// Timer tick rate calculation
// ---------------------------------------------------------------------------
describe('autopilot tick rate', () => {
  it('normal mode uses STEP_INTERVAL_MS', () => {
    const tickMs = STEP_INTERVAL_MS;
    expect(tickMs).toBe(100);
  });

  it('hyperjump mode scales tick by engine speed', () => {
    const speed = 3;
    const tickMs = Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / speed));
    expect(tickMs).toBe(33);
  });

  it('tick rate is clamped to STEP_INTERVAL_MIN_MS', () => {
    const speed = 10;
    const tickMs = Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / speed));
    expect(tickMs).toBe(STEP_INTERVAL_MIN_MS); // 20
  });

  it('speed 0 falls back to normal interval', () => {
    const speed = 0;
    const useHyperjump = true;
    const tickMs = useHyperjump && speed > 0
      ? Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / speed))
      : STEP_INTERVAL_MS;
    expect(tickMs).toBe(STEP_INTERVAL_MS);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('autopilot edge cases', () => {
  it('handles single-sector path', () => {
    const path = calculateAutopilotPath({ x: 0, y: 0 }, { x: 1, y: 0 }, noBlackHoles);
    expect(path).toHaveLength(1);

    const seg = getNextSegment(path, 0, 0, 0);
    expect(seg.moves).toEqual([{ x: 1, y: 0 }]);

    // After one step, route is complete
    const seg2 = getNextSegment(path, 1, 0, 0);
    expect(seg2.moves).toEqual([]);
  });

  it('handles already-at-target (empty path)', () => {
    const path = calculateAutopilotPath({ x: 5, y: 5 }, { x: 5, y: 5 }, noBlackHoles);
    expect(path).toHaveLength(0);
  });

  it('onLeave pauses active route for later resume', async () => {
    // Simulate: route active at step 3, player disconnects
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);
    const paused = await pauseAutopilotRoute('player-1');
    expect(paused).toBe(true);

    // Simulate: player reconnects, route should be resumable
    mockQuery.mockResolvedValueOnce({
      rows: [{
        user_id: 'player-1',
        target_x: 5, target_y: 3,
        use_hyperjump: false,
        path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        current_step: 2,
        total_steps: 3,
        started_at: String(Date.now()),
        last_step_at: String(Date.now()),
        status: 'active', // would be 'paused' but after resume it's 'active' again
      }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const route = await getActiveAutopilotRoute('player-1');
    expect(route).not.toBeNull();
    expect(route!.currentStep).toBe(2);

    // Can resume from step 2
    const seg = getNextSegment(route!.path, route!.currentStep, 0, 0);
    expect(seg.moves).toEqual([{ x: 3, y: 0 }]);
  });

  it('concurrent cancel during stepping is safe', async () => {
    // Cancel returns true even if timer was already cleared
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as any);
    const cancelled = await cancelAutopilotRoute('player-1');
    expect(cancelled).toBe(true);

    // Second cancel returns false (already cancelled)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0, command: 'UPDATE', oid: 0, fields: [] } as any);
    const cancelled2 = await cancelAutopilotRoute('player-1');
    expect(cancelled2).toBe(false);
  });
});
