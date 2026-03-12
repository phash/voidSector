# voidSector Mobile Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the mobile voidSector UX — new 5-tab layout (HOME/NAV/MINE/QUESTS/MEHR), a Dashboard home screen, per-resource MINE tab, combined Radar+Bookmarks NAV tab, and Slow Flight (automatic intra-quadrant navigation as a complement to Hyperjump).

**Architecture:** Slow Flight extends the existing autopilot machinery in `NavigationService.ts` — same `setInterval` pattern, same messages (`autopilotStart`/`autopilotUpdate`/`autopilotComplete`) with an added `source: 'slow_flight'` field, a fixed 3000ms tick (not speed-dependent), and an intra-quadrant-only constraint. On the client, three new mobile-only React components (`MobileDashboard`, `MobileNavTab`, `MobileMineTab`) are rendered by a `renderMobileScreen` dispatcher in `GameScreen.tsx`; `useMobileTabs.ts` is updated to the new 5-tab structure.

**Tech Stack:** TypeScript, React, Zustand, Vitest/RTL (client tests), Vitest (server tests), Colyseus (server rooms)

---

## Chunk 1: Server — Slow Flight

### Task 1: Add `overrideTickMs` to `startAutopilotTimer`

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts` (~l.979)
- Test: `packages/server/src/rooms/services/__tests__/NavigationService.slowFlight.test.ts` (new)

**Context:** `startAutopilotTimer` currently computes tick speed from `useHyperjump` and `ship.engineSpeed`. Slow Flight needs a fixed 3000ms tick. Add an optional override parameter rather than duplicating the timer logic.

- [ ] **Step 1: Write failing test — overrideTickMs is used when provided**

Create `packages/server/src/rooms/services/__tests__/NavigationService.slowFlight.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationService } from '../NavigationService.js';
import { STEP_INTERVAL_MS } from '../../../engine/autopilot.js';

// NavigationService imports from two places:
//   - '../../db/queries.js'      for getSector, addDiscovery, isRouteDiscovered, saveAutopilotRoute, etc.
//   - './RedisAPStore.js'        for getAPState, saveAPState, getMiningState, getFuelState, getPlayerPosition, savePlayerPosition
vi.mock('../../../db/queries.js', () => ({
  addDiscovery: vi.fn(),
  isRouteDiscovered: vi.fn(),
  getSector: vi.fn(),
  saveSector: vi.fn(),
  saveAutopilotRoute: vi.fn(),
  completeAutopilotRoute: vi.fn(),
  pauseAutopilotRoute: vi.fn(),
  cancelAutopilotRoute: vi.fn(),
  getActiveAutopilotRoute: vi.fn(),
  updateAutopilotStep: vi.fn(),
  getAllQuadrantControls: vi.fn().mockResolvedValue([]),
  // stub other exports NavigationService may reference
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  getPlayerHomeBase: vi.fn(),
  playerHasGateCode: vi.fn(),
  recordNewsEvent: vi.fn(),
  awardBadge: vi.fn(),
  hasAnyoneBadge: vi.fn(),
  getPlayerReputation: vi.fn(),
  updatePlayerStationRep: vi.fn(),
  getPlayerStationRep: vi.fn(),
  addPlayerKnownJumpGate: vi.fn(),
  getPlayerJumpGate: vi.fn(),
  getAllPlayerGates: vi.fn(),
  getAllJumpGateLinks: vi.fn(),
  getJumpGateLinks: vi.fn(),
  getJumpGate: vi.fn(),
  insertJumpGate: vi.fn(),
}));
vi.mock('../RedisAPStore.js', () => ({
  getAPState: vi.fn(),
  saveAPState: vi.fn(),
  getMiningState: vi.fn(),
  getFuelState: vi.fn(),
  getPlayerPosition: vi.fn(),
  savePlayerPosition: vi.fn(),
  getHyperdriveState: vi.fn(),
  setHyperdriveState: vi.fn(),
}));
vi.mock('../../../engine/worldgen.js', () => ({
  generateSector: vi.fn(),
  isFrontierQuadrant: vi.fn(),
  hashCoords: vi.fn().mockReturnValue(0),
  isInBlackHoleCluster: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../engine/quadrantEngine.js', () => ({
  sectorToQuadrant: vi.fn().mockReturnValue({ qx: 0, qy: 0 }),
  isFrontierQuadrant: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../engine/expansionEngine.js', () => ({
  isFrontierQuadrant: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn(),
}));
vi.mock('../../../engine/ap.js', () => ({
  calculateCurrentAP: vi.fn().mockReturnValue({ current: 100, max: 100 }),
}));
vi.mock('../../../engine/npcgen.js', () => ({ getStationFaction: vi.fn() }));
vi.mock('../../../engine/npcStationEngine.js', () => ({ recordVisit: vi.fn() }));
vi.mock('../../../engine/jumpgates.js', () => ({
  checkJumpGate: vi.fn(),
  checkAncientJumpGate: vi.fn(),
  generateGateTarget: vi.fn(),
}));
vi.mock('../../../engine/jumpgateRouting.js', () => ({ findReachableGates: vi.fn() }));
vi.mock('../../../engine/commands.js', () => ({
  validateJump: vi.fn(),
  getReputationTier: vi.fn(),
}));
vi.mock('../../auth.js', () => ({}));

import {
  addDiscovery,
  isRouteDiscovered,
  saveAutopilotRoute,
  completeAutopilotRoute,
  getSector,
} from '../../../db/queries.js';
import {
  getAPState,
  getMiningState,
  getPlayerPosition,
  savePlayerPosition,
} from '../RedisAPStore.js';
import { sectorToQuadrant } from '../../../engine/quadrantEngine.js';
import { calculateCurrentAP } from '../../../engine/ap.js';

function makeCtx(overrides: Partial<any> = {}): any {
  return {
    state: { players: new Map() },
    quadrantX: 0,
    quadrantY: 0,
    clientShips: new Map(),
    clientHullTypes: new Map(),
    autopilotTimers: new Map(),
    playerSectorData: new Map(),
    checkRate: () => true,
    getShipForClient: () =>
      ({
        apCostJump: 2,
        engineSpeed: 1,
        hullType: 'interceptor',
        stats: { cargoCap: 10 },
      } as any),
    getPlayerBonuses: vi.fn().mockResolvedValue({}),
    _px: () => 0,
    _py: () => 0,
    _pst: () => 'empty',
    send: vi.fn(),
    broadcast: vi.fn(),
    broadcastToFaction: vi.fn(),
    broadcastToSector: vi.fn(),
    checkFirstContact: vi.fn(),
    checkQuestProgress: vi.fn(),
    checkAndEmitDistressCalls: vi.fn(),
    applyReputationChange: vi.fn(),
    applyXpGain: vi.fn(),
    ...overrides,
  };
}

function makeClient(sessionId = 'sess1', auth = { userId: 'user1' }): any {
  return { sessionId, auth, send: vi.fn() };
}

describe('startAutopilotTimer — overrideTickMs', () => {
  it('accepts overrideTickMs as 7th parameter and registers a timer', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();
    const auth = { userId: 'user1' };
    const ship = ctx.getShipForClient();
    const path = [{ x: 1, y: 1 }, { x: 2, y: 1 }];

    vi.mocked(getAPState).mockResolvedValue({ current: 100, max: 100, lastUpdated: Date.now() } as any);
    vi.mocked(savePlayerPosition).mockResolvedValue(undefined);
    vi.mocked(addDiscovery).mockResolvedValue(undefined);
    vi.mocked(completeAutopilotRoute).mockResolvedValue(undefined);
    vi.mocked(getSector).mockResolvedValue({ type: 'empty' } as any);

    // Should not throw with 7 args — timer is registered
    service.startAutopilotTimer(client, auth, path, 0, false, ship, 3000);
    expect(ctx.autopilotTimers.has('sess1')).toBe(true);

    // At STEP_INTERVAL_MS (100ms), the async tick has NOT fired (overrideTickMs is 3000)
    vi.advanceTimersByTime(STEP_INTERVAL_MS);
    expect(client.send).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd packages/server && npx vitest run src/rooms/services/__tests__/NavigationService.slowFlight.test.ts
```
Expected: FAIL (startAutopilotTimer does not accept 7th param)

- [ ] **Step 3: Add `overrideTickMs` param to `startAutopilotTimer`**

In `packages/server/src/rooms/services/NavigationService.ts`, find `startAutopilotTimer` signature (~l.979) and update:

```typescript
startAutopilotTimer(
  client: Client,
  auth: AuthPayload,
  path: Array<{ x: number; y: number }>,
  startStep: number,
  useHyperjump: boolean,
  ship: ShipStats,
  overrideTickMs?: number,   // ← ADD
): void {
  let currentStep = startStep;
  const speed = ship.engineSpeed;
  const tickMs =
    overrideTickMs ??                          // ← ADD
    (useHyperjump && speed > 0
      ? Math.max(STEP_INTERVAL_MIN_MS, Math.floor(STEP_INTERVAL_MS / speed))
      : STEP_INTERVAL_MS);
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd packages/server && npx vitest run src/rooms/services/__tests__/NavigationService.slowFlight.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/services/NavigationService.ts packages/server/src/rooms/services/__tests__/NavigationService.slowFlight.test.ts
git commit -m "feat(server): add overrideTickMs to startAutopilotTimer for slow flight"
```

---

### Task 2: `handleSlowFlight` in NavigationService

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts`
- Test: `packages/server/src/rooms/services/__tests__/NavigationService.slowFlight.test.ts`

**Context:** `handleSlowFlight` validates the target is in the same quadrant (intra-quadrant only), then starts the existing autopilot with `useHyperjump: false` and a 3000ms tick. It sends `autopilotStart` with `source: 'slow_flight'`. The `cancelAutopilot` message already stops it via `autopilotTimers.delete`.

Add this constant near the top of NavigationService.ts (after existing imports/constants):

```typescript
const SLOW_FLIGHT_INTERVAL_MS = 3000;
```

- [ ] **Step 1: Write failing tests for handleSlowFlight**

Add to `NavigationService.slowFlight.test.ts`:

```typescript
describe('handleSlowFlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sectorToQuadrant).mockImplementation((_x, _y) => ({ qx: 0, qy: 0 }));
    vi.mocked(getMiningState).mockResolvedValue(null);
    vi.mocked(getPlayerPosition).mockResolvedValue({ x: 1, y: 1 });
    vi.mocked(getAPState).mockResolvedValue({
      current: 100,
      max: 100,
      lastUpdated: Date.now(),
    } as any);
    vi.mocked(saveAutopilotRoute).mockResolvedValue(undefined);
    vi.mocked(isRouteDiscovered).mockResolvedValue(true);
  });

  it('rejects with error when target is in a different quadrant', async () => {
    vi.mocked(sectorToQuadrant)
      .mockReturnValueOnce({ qx: 0, qy: 0 }) // current pos
      .mockReturnValueOnce({ qx: 1, qy: 0 }); // target pos — different!

    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();

    await service.handleSlowFlight(client, { targetX: 10001, targetY: 1 });

    expect(client.send).toHaveBeenCalledWith('error', {
      code: 'SLOW_FLIGHT_FAIL',
      message: expect.stringContaining('intra-quadrant'),
    });
    expect(ctx.autopilotTimers.has('sess1')).toBe(false);
  });

  it('rejects when autopilot already active', async () => {
    const ctx = makeCtx();
    ctx.autopilotTimers.set('sess1', {} as any);
    const service = new NavigationService(ctx);
    const client = makeClient();

    await service.handleSlowFlight(client, { targetX: 3, targetY: 1 });

    expect(client.send).toHaveBeenCalledWith('error', {
      code: 'SLOW_FLIGHT_FAIL',
      message: expect.any(String),
    });
  });

  it('sends autopilotStart with source slow_flight when valid', async () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();

    await service.handleSlowFlight(client, { targetX: 3, targetY: 1 });

    expect(client.send).toHaveBeenCalledWith(
      'autopilotStart',
      expect.objectContaining({ source: 'slow_flight', targetX: 3, targetY: 1 }),
    );
    expect(ctx.autopilotTimers.has('sess1')).toBe(true);
    vi.useRealTimers();
  });

  it('stops when AP below apCostJump', async () => {
    vi.useFakeTimers();
    vi.mocked(getAPState).mockResolvedValue({ current: 1, max: 100, lastUpdated: Date.now() } as any);
    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();

    // AP is 1, apCostJump is 2 — should still start (checked before first tick)
    // but once timer runs, it will find AP < cost and pause
    await service.handleSlowFlight(client, { targetX: 3, targetY: 1 });
    // autopilotStart is still sent (AP check happens at tick time, not before)
    expect(client.send).toHaveBeenCalledWith('autopilotStart', expect.objectContaining({ source: 'slow_flight' }));
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

```bash
cd packages/server && npx vitest run src/rooms/services/__tests__/NavigationService.slowFlight.test.ts
```
Expected: FAIL (`handleSlowFlight` not defined)

- [ ] **Step 3: Implement `handleSlowFlight` in NavigationService**

Add after the existing `handleGetAutopilotStatus` method (~l.972), before `startAutopilotTimer`:

```typescript
/**
 * Slow Flight: automatic sector-by-sector navigation, intra-quadrant only.
 * Extends the existing autopilot with a fixed 3000ms tick and no fuel cost.
 */
async handleSlowFlight(
  client: Client,
  data: { targetX: number; targetY: number },
): Promise<void> {
  const { targetX, targetY } = data;
  const auth = client.auth as AuthPayload;

  // Reject if autopilot already active
  if (this.ctx.autopilotTimers.has(client.sessionId)) {
    client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Autopilot already active' });
    return;
  }

  // Reject guests
  if (rejectGuest(client, 'SlowFlight')) return;

  // Check mining state
  const mining = await getMiningState(auth.userId);
  if (mining?.active) {
    client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Cannot start while mining' });
    return;
  }

  // Get current position
  const pos = await getPlayerPosition(auth.userId);
  if (!pos) {
    client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Position unknown' });
    return;
  }

  if (pos.x === targetX && pos.y === targetY) {
    client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Already at target' });
    return;
  }

  // Validate intra-quadrant
  const { qx: curQx, qy: curQy } = sectorToQuadrant(pos.x, pos.y);
  const { qx: tgtQx, qy: tgtQy } = sectorToQuadrant(targetX, targetY);
  if (curQx !== tgtQx || curQy !== tgtQy) {
    client.send('error', {
      code: 'SLOW_FLIGHT_FAIL',
      message: 'Slow Flight is intra-quadrant only — use Hyperjump for cross-quadrant',
    });
    return;
  }

  const ship = this.ctx.getShipForClient(client.sessionId);

  // Calculate path (reuse existing black-hole avoidance)
  const isBlackHole = (x: number, y: number): boolean => {
    if (isInBlackHoleCluster(x, y)) return true;
    const dist = Math.max(Math.abs(x), Math.abs(y));
    if (dist > BLACK_HOLE_MIN_DISTANCE) {
      const seed = hashCoords(x, y, WORLD_SEED);
      const bhRoll = (seed >>> 0) / 0x100000000;
      if (bhRoll < BLACK_HOLE_SPAWN_CHANCE) return true;
    }
    return false;
  };

  const path = calculateAutopilotPath(
    { x: pos.x, y: pos.y },
    { x: targetX, y: targetY },
    isBlackHole,
  );

  if (path.length === 0) {
    client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'No path found' });
    return;
  }

  // Validate AP
  const ap = await getAPState(auth.userId);
  const updated = calculateCurrentAP(ap);
  if (updated.current < ship.apCostJump) {
    client.send('error', { code: 'SLOW_FLIGHT_FAIL', message: 'Not enough AP' });
    return;
  }

  // Save route to DB so cancelAutopilot / completeAutopilotRoute work correctly
  const now = Date.now();
  await saveAutopilotRoute(auth.userId, targetX, targetY, false, path, now);

  // Send start message with source identifier
  client.send('autopilotStart', {
    targetX,
    targetY,
    totalSteps: path.length,
    currentStep: 0,
    source: 'slow_flight',
  });

  // Begin stepping at SLOW_FLIGHT_INTERVAL_MS (3000ms per sector)
  this.startAutopilotTimer(client, auth, path, 0, false, ship, SLOW_FLIGHT_INTERVAL_MS);
}
```

Also add `SLOW_FLIGHT_INTERVAL_MS` constant near other constants at the top of the file (after the imports section):
```typescript
const SLOW_FLIGHT_INTERVAL_MS = 3000;
```

Also add `source?: 'slow_flight'` to the `autopilotComplete` send call in `startAutopilotTimer` (~l.1024), so the client knows the source when complete. Find the line:
```typescript
client.send('autopilotComplete', { x: target.x, y: target.y, sector: targetSector });
```
This is called regardless of slow flight / regular — we only want to add source when it's slow flight. Since `useHyperjump` is passed in, and slow flight always has `useHyperjump: false`, we can't distinguish reliably here. Instead, pass a `isSlowFlight` boolean alongside `overrideTickMs` to `startAutopilotTimer`.

Change the signature to:
```typescript
startAutopilotTimer(
  client: Client,
  auth: AuthPayload,
  path: Array<{ x: number; y: number }>,
  startStep: number,
  useHyperjump: boolean,
  ship: ShipStats,
  overrideTickMs?: number,
  isSlowFlight?: boolean,   // ← ADD
): void {
```

And in the complete send:
```typescript
client.send('autopilotComplete', {
  x: target.x,
  y: target.y,
  sector: targetSector,
  ...(isSlowFlight ? { source: 'slow_flight' } : {}),
});
```

Update `handleSlowFlight` to pass `true` as last arg:
```typescript
this.startAutopilotTimer(client, auth, path, 0, false, ship, SLOW_FLIGHT_INTERVAL_MS, true);
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
cd packages/server && npx vitest run src/rooms/services/__tests__/NavigationService.slowFlight.test.ts
```

- [ ] **Step 5: Run full server test suite**

```bash
cd packages/server && npx vitest run
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/NavigationService.ts packages/server/src/rooms/services/__tests__/NavigationService.slowFlight.test.ts
git commit -m "feat(server): handleSlowFlight — intra-quadrant autopilot at 3s/sector"
```

---

### Task 3: Register `startSlowFlight` in SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Context:** `SectorRoom` registers all `onMessage` handlers in `onCreate`. Add `startSlowFlight` alongside `startAutopilot` (~l.412).

- [ ] **Step 1: Add message handler in SectorRoom.ts**

Find the block (~l.412):
```typescript
this.onMessage('startAutopilot', async (client, data) => {
  await this.navigation.handleStartAutopilot(client, data);
});
```

Add directly after it:
```typescript
this.onMessage('startSlowFlight', async (client, data: { targetX: number; targetY: number }) => {
  await this.navigation.handleSlowFlight(client, data);
});
```

- [ ] **Step 2: Run server tests**

```bash
cd packages/server && npx vitest run
```
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): register startSlowFlight message handler"
```

---

## Chunk 2: Client State & Radar

### Task 4: `slowFlightActive` state + `sendSlowFlight` network method

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

**Context:** The spec states "Kein neuer State nötig" — but the existing `autopilot.active` flag alone cannot distinguish Slow Flight from a regular hyperjump autopilot. This distinction is needed in three places: (1) the Dashboard Slow-Flight-Card visibility, (2) the radar `slowFlightPath` visualization, (3) auto-opening MINE tab on arrival. Adding `slowFlightActive: boolean` to gameSlice is simpler than extending the shared `AutopilotState` type (which would require a shared rebuild). This is a deliberate, narrow deviation from the spec's "no new state" guidance.

`sendSlowFlight` is the network method that sends `startSlowFlight` to the server.

- [ ] **Step 1: Write failing test for slowFlightActive**

In `packages/client/src/__tests__/gameSlice.test.ts` (add test case — check if this file exists first, otherwise add to an appropriate test file):

```bash
find packages/client/src/__tests__ -name "gameSlice*" -o -name "store*" | head -5
```

If no gameSlice test file exists, create `packages/client/src/__tests__/slowFlightActive.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

describe('slowFlightActive state', () => {
  beforeEach(() => {
    useStore.setState({ slowFlightActive: false });
  });

  it('is false by default', () => {
    expect(useStore.getState().slowFlightActive).toBe(false);
  });

  it('setSlowFlightActive(true) sets it to true', () => {
    useStore.getState().setSlowFlightActive(true);
    expect(useStore.getState().slowFlightActive).toBe(true);
  });

  it('setSlowFlightActive(false) resets it', () => {
    useStore.getState().setSlowFlightActive(true);
    useStore.getState().setSlowFlightActive(false);
    expect(useStore.getState().slowFlightActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/slowFlightActive.test.ts
```

- [ ] **Step 3: Add `slowFlightActive` to gameSlice.ts**

In `packages/client/src/state/gameSlice.ts`:

1. Add to the state interface (find where `autopilot: AutopilotState | null` is declared ~l.392):
```typescript
slowFlightActive: boolean;
```

2. Add action to the interface (near `setAutopilot` ~l.611):
```typescript
setSlowFlightActive: (active: boolean) => void;
```

3. Add initial value (near `autopilot: null` ~l.741):
```typescript
slowFlightActive: false,
```

4. Add implementation (near `setAutopilot` ~l.938):
```typescript
setSlowFlightActive: (slowFlightActive) => set({ slowFlightActive }),
```

- [ ] **Step 4: Run test, verify PASS**

```bash
cd packages/client && npx vitest run src/__tests__/slowFlightActive.test.ts
```

- [ ] **Step 5: Add `sendSlowFlight` to network client**

In `packages/client/src/network/client.ts`, find `sendJump` (~l.1793) and add after it:

```typescript
sendSlowFlight(targetX: number, targetY: number) {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED');
    return;
  }
  this.sectorRoom.send('startSlowFlight', { targetX, targetY });
}
```

- [ ] **Step 6: Update `autopilotStart` handler to detect slow flight**

In `client.ts`, find the `autopilotStart` handler (~l.1384). Update the type and set `slowFlightActive`:

```typescript
room.onMessage(
  'autopilotStart',
  (data: {
    targetX: number;
    targetY: number;
    totalSteps: number;
    costs?: { totalFuel: number; totalAP: number; estimatedTime: number };
    currentStep?: number;
    source?: 'slow_flight';   // ← ADD
  }) => {
    const store = useStore.getState();
    store.setAutopilot({
      targetX: data.targetX,
      targetY: data.targetY,
      remaining: data.totalSteps,
      active: true,
    });
    store.setNavTarget({ x: data.targetX, y: data.targetY });
    store.setAutopilotStatus({
      targetX: data.targetX,
      targetY: data.targetY,
      currentStep: data.currentStep ?? 0,
      totalSteps: data.totalSteps,
      status: 'active',
      useHyperjump: false,
    });
    if (data.source === 'slow_flight') {   // ← ADD
      store.setSlowFlightActive(true);     // ← ADD
    }                                       // ← ADD
  },
);
```

- [ ] **Step 7: Update `autopilotComplete` and `autopilotPaused` handlers — clear slowFlightActive + auto-open MINE tab**

The `autopilotPaused` message is sent when AP is exhausted mid-flight. It must also clear `slowFlightActive` — otherwise the UI stays stuck showing the slow-flight overlay. Find the `autopilotPaused` handler (search for `'autopilotPaused'` in client.ts). If it exists, add `store.setSlowFlightActive(false)` to its body. If it doesn't exist yet, add a new handler alongside `autopilotComplete`:

```typescript
room.onMessage('autopilotPaused', (data: { reason: string; currentStep: number }) => {
  const store = useStore.getState();
  store.setSlowFlightActive(false);
  store.setAutopilot(null);
  store.setAutopilotStatus(null);
  store.addLogEntry(`Autopilot pausiert: ${data.reason}`);
});
```

Find the `autopilotComplete` handler (~l.1442). Update type and add slow flight handling:

```typescript
room.onMessage('autopilotComplete', async (data: {
  x: number;
  y: number;
  sector?: import('@void-sector/shared').SectorData;
  source?: 'slow_flight';                          // ← ADD
}) => {
  const store = useStore.getState();
  store.setAutopilot(null);
  store.setAutopilotStatus(null);
  store.setNavTarget(null);
  store.setSlowFlightActive(false);                // ← ADD
  if (data.x >= 0 && data.y >= 0) {
    store.setPosition({ x: data.x, y: data.y });
    store.addLogEntry(`Autopilot: Ankunft bei (${data.x}, ${data.y})`);
    // Auto-open MINE tab when slow flight lands on asteroid sector
    if (data.source === 'slow_flight' && data.sector?.type === 'asteroid_field') {   // ← ADD
      store.setActiveMonitor(MONITORS.MINING);                                  // ← ADD
    }                                                                            // ← ADD
    try {
      await this.joinSector(data.x, data.y);
    } catch (err) {
      store.addLogEntry(`Sector-Join nach Autopilot fehlgeschlagen: ${(err as Error).message}`);
    }
  } else {
    // ... existing cancel handling unchanged
```

Confirm `MONITORS` is imported in client.ts:
```bash
grep -n "import.*MONITORS" packages/client/src/network/client.ts | head -3
```
`MONITORS` is not currently imported. Find the existing `@void-sector/shared` import at the top of `client.ts` and add `MONITORS` to it, e.g.:
```typescript
import { ..., MONITORS } from '@void-sector/shared';
```

- [ ] **Step 8: Run client tests**

```bash
cd packages/client && npx vitest run
```
Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/__tests__/slowFlightActive.test.ts
git commit -m "feat(client): slowFlightActive state + sendSlowFlight + autopilot handler updates"
```

---

### Task 5: RadarRenderer — `slowFlightPath` visualization

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/components/RadarCanvas.tsx`

**Context:** When slow flight is active, the NAV tab radar shows a dim dashed line from current position to target. `RadarState` gets an optional `slowFlightPath`. `RadarCanvas` reads `slowFlightActive` + `autopilot` from store and computes the 2-point path.

- [ ] **Step 1: Write failing test for slowFlightPath rendering**

Create `packages/client/src/__tests__/RadarRenderer.slowFlight.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawRadar } from '../canvas/RadarRenderer';

describe('drawRadar — slowFlightPath', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      canvas: { width: 800, height: 600 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
    };
  });

  const baseState = {
    position: { x: 5, y: 5 },
    discoveries: {},
    players: {},
    currentSector: null,
    themeColor: '#FFB000',
    dimColor: '#444',
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
  };

  it('calls setLineDash and draws a line when slowFlightPath is set', () => {
    drawRadar(ctx, {
      ...baseState,
      slowFlightPath: [{ x: 5, y: 5 }, { x: 8, y: 5 }],
    });

    expect(ctx.setLineDash).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]));
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does NOT draw path line when slowFlightPath is absent', () => {
    const setLineDashCalls: any[] = [];
    ctx.setLineDash = vi.fn((d) => setLineDashCalls.push(d));

    drawRadar(ctx, { ...baseState });

    // setLineDash should not be called with a dashed pattern for path
    const dashedCalls = setLineDashCalls.filter((d) => d.length > 0 && d[0] > 0);
    expect(dashedCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/RadarRenderer.slowFlight.test.ts
```

- [ ] **Step 3: Add `slowFlightPath` to `RadarState` and draw it in `drawRadar`**

In `packages/client/src/canvas/RadarRenderer.ts`:

1. Add to `RadarState` interface (~l.66):
```typescript
slowFlightPath?: Array<{ x: number; y: number }>;
```

2. At the end of `drawRadar`, just before the `return` (or after all sector rendering, before the function ends, around l.900+), add the path drawing:

```typescript
// Draw slow flight path overlay
if (state.slowFlightPath && state.slowFlightPath.length >= 2) {
  const start = state.slowFlightPath[0];
  const end = state.slowFlightPath[state.slowFlightPath.length - 1];

  const startDx = start.x - viewX;
  const startDy = start.y - viewY;
  const endDx = end.x - viewX;
  const endDy = end.y - viewY;

  const x1 = gridCenterX + startDx * CELL_W;
  const y1 = gridCenterY + startDy * CELL_H;
  const x2 = gridCenterX + endDx * CELL_W;
  const y2 = gridCenterY + endDy * CELL_H;

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = state.themeColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
```

Note: `gridCenterX`, `gridCenterY`, `viewX`, `viewY`, `CELL_W`, `CELL_H` are all local variables in `drawRadar` — this code must be placed inside the function body where those variables are in scope.

- [ ] **Step 4: Add `onSectorTap` prop to `RadarCanvas` and pass `slowFlightPath`**

In `packages/client/src/components/RadarCanvas.tsx`:

1. Add prop interface:
```typescript
interface RadarCanvasProps {
  onSectorTap?: (x: number, y: number) => void;
}

export function RadarCanvas({ onSectorTap }: RadarCanvasProps = {}) {
```

2. In the draw callback, after `miningActive: !!state.mining?.active`, add:
```typescript
slowFlightPath:
  state.slowFlightActive && state.autopilot?.active
    ? [
        state.position,
        { x: state.autopilot.targetX, y: state.autopilot.targetY },
      ]
    : undefined,
```

3. Add a ref for `onSectorTap` **above** the existing pointer-event `useEffect` so the stale-closure is avoided:

```typescript
const onSectorTapRef = useRef(onSectorTap);
useEffect(() => { onSectorTapRef.current = onSectorTap; }, [onSectorTap]);
```

4. In the existing pointer-event `useEffect` (deps=`[]`), find the `onPointerUp` handler. This is an **in-place replacement** of the existing tap-handling block — replace the line `state.setSelectedSector({ x: viewX + dx, y: viewY + dy })` with:

```typescript
const tappedX = viewX + dx;
const tappedY = viewY + dy;
if (onSectorTapRef.current) {
  onSectorTapRef.current(tappedX, tappedY);  // mobile nav: navigate directly, no popup
} else {
  state.setSelectedSector({ x: tappedX, y: tappedY }); // desktop: show detail popup
}
```

Do NOT add a new `onPointerUp` listener — only modify the body of the existing one.

- [ ] **Step 5: Run tests, verify PASS**

```bash
cd packages/client && npx vitest run src/__tests__/RadarRenderer.slowFlight.test.ts
```

- [ ] **Step 6: Run full client tests**

```bash
cd packages/client && npx vitest run
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts packages/client/src/components/RadarCanvas.tsx packages/client/src/__tests__/RadarRenderer.slowFlight.test.ts
git commit -m "feat(client): slowFlightPath radar visualization + RadarCanvas onSectorTap prop"
```

---

## Chunk 3: Mobile UI Components

### Task 6: `useMobileTabs` — new 5-tab structure

**Files:**
- Modify: `packages/client/src/hooks/useMobileTabs.ts`
- Modify: `packages/client/src/__tests__/useMobileTabs.test.ts`

**Context:** Replace the existing NAV/SHIP/CARGO-or-TRADE/COMMS/MEHR structure with HOME/NAV/MINE/QUESTS/MEHR. SHIP-SYS and COMMS move to the MEHR grid. CARGO is shown inline in the MINE tab (not as a standalone tab). HOME uses a new id `'__HOME__'`. QUESTS tab gets an alert badge from the store's `alerts[MONITORS.QUESTS]`.

**New tab structure:**

| Position | ID | Label | Notes |
|----------|----|-------|-------|
| 1 | `'__HOME__'` | HOME | new dashboard |
| 2 | `MONITORS.NAV_COM` | NAV | mobile radar + bookmarks |
| 3 | `MONITORS.MINING` | MINE | resource cards |
| 4 | `MONITORS.QUESTS` | QUESTS | existing QuestsScreen |
| 5 | `'__MEHR__'` | MEHR | overflow grid |

**New MEHR_MONITORS:** SHIP-SYS, COMMS, BASE-LINK, TRADE, FACTION, TECH, QUAD-MAP, LOG, NEWS, ACEP

- [ ] **Step 1: Update `useMobileTabs.test.ts` to match new structure**

Replace the entire content of `packages/client/src/__tests__/useMobileTabs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMobileTabs } from '../hooks/useMobileTabs';
import { mockStoreState } from '../test/mockStore';
import { MONITORS } from '@void-sector/shared';
import type { SectorData } from '@void-sector/shared';

const emptySector: SectorData = {
  x: 0, y: 0, type: 'empty', seed: 42,
  discoveredBy: null, discoveredAt: null, metadata: {}, environment: 'empty', contents: [],
};

const MOBILE_HOME_ID = '__HOME__';

describe('useMobileTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ currentSector: emptySector, alerts: {} });
  });

  it('returns exactly 5 tabs', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs).toHaveLength(5);
  });

  it('HOME is first tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[0].id).toBe(MOBILE_HOME_ID);
    expect(result.current.tabs[0].label).toBe('HOME');
  });

  it('NAV is second tab with NAV-COM id', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[1].id).toBe(MONITORS.NAV_COM);
    expect(result.current.tabs[1].label).toBe('NAV');
  });

  it('MINE is third tab with MINING id', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[2].id).toBe(MONITORS.MINING);
    expect(result.current.tabs[2].label).toBe('MINE');
  });

  it('QUESTS is fourth tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[3].id).toBe(MONITORS.QUESTS);
    expect(result.current.tabs[3].label).toBe('QUESTS');
  });

  it('MEHR is fifth tab with isMehr flag', () => {
    const { result } = renderHook(() => useMobileTabs());
    const mehr = result.current.tabs[4];
    expect(mehr.label).toBe('MEHR');
    expect(mehr.isMehr).toBe(true);
  });

  it('MEHR contains SHIP-SYS', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.SHIP_SYS);
  });

  it('MEHR contains COMMS', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.COMMS);
  });

  it('MEHR contains TRADE', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.TRADE);
  });

  it('MEHR does NOT contain MINING (it is a main tab)', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).not.toContain(MONITORS.MINING);
  });

  it('MEHR does NOT contain QUESTS (it is a main tab)', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).not.toContain(MONITORS.QUESTS);
  });

  it('counts alerts only for monitors in MEHR list', () => {
    mockStoreState({
      currentSector: emptySector,
      alerts: {
        [MONITORS.COMMS]: true,
        [MONITORS.SHIP_SYS]: true,
        [MONITORS.NAV_COM]: true, // not in MEHR
      },
    });
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.mehrAlertCount).toBe(2);
  });

  it('returns 0 mehrAlertCount when no alerts', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.mehrAlertCount).toBe(0);
  });

  it('handles null currentSector gracefully', () => {
    mockStoreState({ currentSector: null, alerts: {} });
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL** (old structure tests will fail)

```bash
cd packages/client && npx vitest run src/__tests__/useMobileTabs.test.ts
```

- [ ] **Step 3: Rewrite `useMobileTabs.ts`**

Replace the full content of `packages/client/src/hooks/useMobileTabs.ts`:

```typescript
import { useMemo } from 'react';
import { useStore } from '../state/store';
import { MONITORS } from '@void-sector/shared';

export const MOBILE_HOME_ID = '__HOME__';

export interface MobileTab {
  id: string;
  icon: string;
  label: string;
  isMehr?: boolean;
}

const TAB_HOME: MobileTab = { id: MOBILE_HOME_ID, icon: '\u2302', label: 'HOME' };
const TAB_NAV: MobileTab = { id: MONITORS.NAV_COM, icon: '\u25C9', label: 'NAV' };
const TAB_MINE: MobileTab = { id: MONITORS.MINING, icon: '\u26CF', label: 'MINE' };
const TAB_QUESTS: MobileTab = { id: MONITORS.QUESTS, icon: '\u2605', label: 'QUESTS' };
const TAB_MEHR: MobileTab = { id: '__MEHR__', icon: '\u2630', label: 'MEHR', isMehr: true };

const FIXED_TABS: MobileTab[] = [TAB_HOME, TAB_NAV, TAB_MINE, TAB_QUESTS, TAB_MEHR];

/** All monitors shown in the MEHR overflow grid. */
export const MEHR_MONITORS: Array<{ id: string; icon: string; label: string }> = [
  { id: MONITORS.SHIP_SYS, icon: '\u2699', label: 'SHIP-SYS' },
  { id: MONITORS.COMMS, icon: '\u2318', label: 'COMMS' },
  { id: MONITORS.TRADE, icon: '\u25A4', label: 'HANDEL' },
  { id: MONITORS.BASE_LINK, icon: '\u2302', label: 'BASE' },
  { id: MONITORS.FACTION, icon: '\u2694', label: 'FRAKTION' },
  { id: MONITORS.TECH, icon: '\u2697', label: 'TECH' },
  { id: MONITORS.QUAD_MAP, icon: '\u25A6', label: 'QUAD-MAP' },
  { id: MONITORS.LOG, icon: '\u25B6', label: 'LOG' },
  { id: MONITORS.NEWS, icon: '\u2261', label: 'NEWS' },
  { id: MONITORS.ACEP, icon: '\u26C9', label: 'ACEP' },
];

/**
 * Mobile tabs hook — returns the fixed 5-tab structure for the new mobile layout:
 *   HOME · NAV · MINE · QUESTS · MEHR
 *
 * SHIP-SYS and COMMS moved to MEHR grid.
 * CARGO is shown inline in the MINE tab.
 */
export function useMobileTabs() {
  const alerts = useStore((s) => s.alerts);

  const mehrAlertCount = useMemo(
    () => MEHR_MONITORS.filter((m) => alerts[m.id]).length,
    [alerts],
  );

  return { tabs: FIXED_TABS, mehrMonitors: MEHR_MONITORS, mehrAlertCount };
}
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
cd packages/client && npx vitest run src/__tests__/useMobileTabs.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/hooks/useMobileTabs.ts packages/client/src/__tests__/useMobileTabs.test.ts
git commit -m "feat(mobile): new 5-tab structure HOME/NAV/MINE/QUESTS/MEHR"
```

---

### Task 7: `MobileDashboard` component

**Files:**
- Create: `packages/client/src/components/MobileDashboard.tsx`
- Create: `packages/client/src/__tests__/MobileDashboard.test.tsx`

**Context:** The dashboard is the first thing users see on mobile. It shows at-a-glance status via stacked cards: Mining (status + timer + stop), Cargo (used/cap + sell if at station), Next Destination (first bookmark + fly button), Slow Flight (when active, with stop + ETA), and an AP bar.

- [ ] **Step 1: Write failing tests**

Create `packages/client/src/__tests__/MobileDashboard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileDashboard } from '../components/MobileDashboard';
import { mockStoreState } from '../test/mockStore';
import { MONITORS } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {
    sendStopMine: vi.fn(),
    sendCancelAutopilot: vi.fn(),
    sendSlowFlight: vi.fn(),
    sendJump: vi.fn(),
  },
}));

const baseState = {
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0, materials: [] },
  ship: { stats: { cargoCap: 50 } },
  bookmarks: [],
  autopilot: null,
  slowFlightActive: false,
  ap: { current: 80, max: 100, lastUpdated: Date.now(), regenRate: 1 },
  currentSector: { type: 'empty', contents: [] },
  position: { x: 5, y: 5 },
};

describe('MobileDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState(baseState as any);
  });

  it('renders the MINING card', () => {
    render(<MobileDashboard />);
    expect(screen.getByText(/MINING/i)).toBeInTheDocument();
  });

  it('shows INAKTIV when mining is not active', () => {
    render(<MobileDashboard />);
    expect(screen.getByText(/INAKTIV/i)).toBeInTheDocument();
  });

  it('shows AKTIV and resource name when mining is active', () => {
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/AKTIV/i)).toBeInTheDocument();
  });

  it('renders the CARGO card with used/cap', () => {
    mockStoreState({ ...baseState, cargo: { ore: 5, gas: 3, crystal: 0, materials: [] } } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/CARGO/i)).toBeInTheDocument();
    expect(screen.getByText(/8\s*\/\s*50/)).toBeInTheDocument();
  });

  it('does not render slow flight card when inactive', () => {
    render(<MobileDashboard />);
    expect(screen.queryByText(/SLOW FLIGHT/i)).not.toBeInTheDocument();
  });

  it('renders slow flight card when slowFlightActive is true', () => {
    mockStoreState({
      ...baseState,
      slowFlightActive: true,
      autopilot: { active: true, targetX: 8, targetY: 5, remaining: 3 },
    } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/SLOW FLIGHT/i)).toBeInTheDocument();
    expect(screen.getByText(/8\s*\/\s*5/)).toBeInTheDocument();
  });

  it('renders next destination card when bookmarks exist', () => {
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid 1' }],
    } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/NÄCHSTES ZIEL/i)).toBeInTheDocument();
    expect(screen.getByText(/Asteroid 1/i)).toBeInTheDocument();
  });

  it('does not render next destination card when no bookmarks', () => {
    render(<MobileDashboard />);
    expect(screen.queryByText(/NÄCHSTES ZIEL/i)).not.toBeInTheDocument();
  });

  it('renders AP bar', () => {
    render(<MobileDashboard />);
    expect(screen.getByText(/AP/i)).toBeInTheDocument();
  });

  it('STOP button on mining card calls sendStopMine', async () => {
    const { network } = await import('../network/client');
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(network.sendStopMine).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/MobileDashboard.test.tsx
```

- [ ] **Step 3: Implement `MobileDashboard.tsx`**

Create `packages/client/src/components/MobileDashboard.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { getPhysicalCargoTotal } from '@void-sector/shared';
import { MONITORS } from '@void-sector/shared';

function MiningCard() {
  const mining = useStore((s) => s.mining);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!mining?.active || mining.startedAt === null) {
      setElapsed(0);
      return;
    }
    const startedAt = mining.startedAt;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [mining?.active, mining?.startedAt]);

  const progress = mining?.active && mining.sectorYield > 0
    ? Math.min(1, (elapsed * (mining.rate ?? 1)) / mining.sectorYield)
    : 0;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div
      className="mobile-dashboard-card"
      style={mining?.active ? { borderColor: 'var(--color-primary)' } : undefined}
    >
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">⛏ MINING</span>
        {mining?.active ? (
          <span className="mobile-card-status-active">AKTIV {mm}:{ss}</span>
        ) : (
          <span className="mobile-card-status-dim">INAKTIV</span>
        )}
        {mining?.active && (
          <button
            className="mobile-card-stop-btn"
            onClick={() => network.sendStopMine()}
            aria-label="Stop mining"
          >
            STOP
          </button>
        )}
      </div>
      {mining?.active && mining.resource && (
        <div className="mobile-card-subtitle">{mining.resource.toUpperCase()}</div>
      )}
      <div className="mobile-progress-bar">
        <div className="mobile-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

function CargoCard() {
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const currentSector = useStore((s) => s.currentSector);

  const used = getPhysicalCargoTotal(cargo);
  const cap = ship?.stats?.cargoCap ?? 5;
  const pct = cap > 0 ? used / cap : 0;
  const atStation = currentSector?.contents?.includes('station') ?? false;

  return (
    <div className="mobile-dashboard-card">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">📦 CARGO</span>
        <span>{used} / {cap}</span>
        {atStation && (
          <button
            className="mobile-card-action-btn"
            onClick={() => useStore.getState().setActiveMonitor(MONITORS.TRADE)}
          >
            VERKAUFEN
          </button>
        )}
      </div>
      <div className="mobile-progress-bar">
        <div
          className="mobile-progress-fill"
          style={{
            width: `${Math.round(pct * 100)}%`,
            background: pct > 0.8 ? '#ff4444' : 'var(--color-primary)',
          }}
        />
      </div>
    </div>
  );
}

function NextDestCard() {
  const bookmarks = useStore((s) => s.bookmarks);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);

  if (bookmarks.length === 0) return null;

  const first = bookmarks[0];

  return (
    <div className="mobile-dashboard-card">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">🗺 NÄCHSTES ZIEL</span>
      </div>
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-subtitle">
          ⭐ {first.label} ({first.sectorX}/{first.sectorY})
        </span>
        <button
          className="mobile-card-action-btn"
          onClick={() => setActiveMonitor(MONITORS.NAV_COM)}
        >
          FLIEGEN →
        </button>
      </div>
    </div>
  );
}

function SlowFlightCard() {
  const slowFlightActive = useStore((s) => s.slowFlightActive);
  const autopilot = useStore((s) => s.autopilot);

  if (!slowFlightActive || !autopilot?.active) return null;

  return (
    <div className="mobile-dashboard-card" style={{ borderColor: 'var(--color-primary)' }}>
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">✈ SLOW FLIGHT</span>
        <button
          className="mobile-card-stop-btn"
          onClick={() => network.sendCancelAutopilot()}
        >
          STOP
        </button>
      </div>
      <div className="mobile-card-subtitle">
        → ({autopilot.targetX}/{autopilot.targetY}) · {autopilot.remaining} Sektoren
      </div>
    </div>
  );
}

function ApBar() {
  const ap = useStore((s) => s.ap);
  const current = ap?.current ?? 0;
  const max = ap?.max ?? 100;
  const pct = max > 0 ? current / max : 0;

  return (
    <div className="mobile-dashboard-card mobile-ap-bar">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">AP</span>
        <span>{Math.round(current)} / {max}</span>
      </div>
      <div className="mobile-progress-bar">
        <div className="mobile-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

export function MobileDashboard() {
  return (
    <div className="mobile-dashboard">
      <SlowFlightCard />
      <MiningCard />
      <CargoCard />
      <NextDestCard />
      <ApBar />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
cd packages/client && npx vitest run src/__tests__/MobileDashboard.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/MobileDashboard.tsx packages/client/src/__tests__/MobileDashboard.test.tsx
git commit -m "feat(mobile): MobileDashboard — status cards for mining, cargo, slow flight, AP"
```

---

### Task 8: `MobileNavTab` component

**Files:**
- Create: `packages/client/src/components/MobileNavTab.tsx`

**Context:** The NAV tab shows a mode toggle (SLOW↔JUMP), the radar canvas with direct-navigate-on-tap behavior, and a bookmark list with GO buttons. `navMode` is persisted in localStorage under `vs_mobile_nav_mode`. Tapping a sector or pressing GO sends `startSlowFlight` or `jump` based on the active mode.

- [ ] **Step 1: Write failing test**

Create `packages/client/src/__tests__/MobileNavTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNavTab } from '../components/MobileNavTab';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendSlowFlight: vi.fn(),
    sendJump: vi.fn(),
    sendCancelAutopilot: vi.fn(),
  },
}));

// RadarCanvas is a canvas element — mock it to avoid jsdom canvas issues
vi.mock('../components/RadarCanvas', () => ({
  RadarCanvas: ({ onSectorTap }: { onSectorTap?: (x: number, y: number) => void }) => (
    <div
      data-testid="radar-canvas-mock"
      onClick={() => onSectorTap?.(10, 7)}
    />
  ),
}));

const baseState = {
  bookmarks: [],
  autopilot: null,
  slowFlightActive: false,
  position: { x: 5, y: 5 },
};

describe('MobileNavTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('vs_mobile_nav_mode');
    mockStoreState(baseState as any);
  });

  it('renders mode toggle with SLOW and JUMP buttons', () => {
    render(<MobileNavTab />);
    expect(screen.getByText(/SLOW/i)).toBeInTheDocument();
    expect(screen.getByText(/JUMP/i)).toBeInTheDocument();
  });

  it('defaults to JUMP mode', () => {
    render(<MobileNavTab />);
    const jumpBtn = screen.getByRole('button', { name: /JUMP/i });
    expect(jumpBtn.className).toContain('active');
  });

  it('tapping radar in JUMP mode calls sendJump', async () => {
    const { network } = await import('../network/client');
    render(<MobileNavTab />);
    await userEvent.click(screen.getByTestId('radar-canvas-mock'));
    expect(network.sendJump).toHaveBeenCalledWith(10, 7);
  });

  it('switching to SLOW mode and tapping radar calls sendSlowFlight', async () => {
    const { network } = await import('../network/client');
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /SLOW/i }));
    await userEvent.click(screen.getByTestId('radar-canvas-mock'));
    expect(network.sendSlowFlight).toHaveBeenCalledWith(10, 7);
  });

  it('persists navMode to localStorage when toggled', async () => {
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /SLOW/i }));
    expect(localStorage.getItem('vs_mobile_nav_mode')).toBe('slow');
  });

  it('reads navMode from localStorage on mount', () => {
    localStorage.setItem('vs_mobile_nav_mode', 'slow');
    render(<MobileNavTab />);
    const slowBtn = screen.getByRole('button', { name: /SLOW/i });
    expect(slowBtn.className).toContain('active');
  });

  it('renders bookmark list when bookmarks exist', () => {
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid Base' }],
    } as any);
    render(<MobileNavTab />);
    expect(screen.getByText(/Asteroid Base/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /→ GO/i })).toBeInTheDocument();
  });

  it('bookmark GO sends sendSlowFlight in SLOW mode', async () => {
    const { network } = await import('../network/client');
    localStorage.setItem('vs_mobile_nav_mode', 'slow');
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid Base' }],
    } as any);
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /→ GO/i }));
    expect(network.sendSlowFlight).toHaveBeenCalledWith(10, 7);
  });

  it('bookmark GO sends sendJump in JUMP mode', async () => {
    const { network } = await import('../network/client');
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid Base' }],
    } as any);
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /→ GO/i }));
    expect(network.sendJump).toHaveBeenCalledWith(10, 7);
  });

  it('shows slow flight progress when active', () => {
    mockStoreState({
      ...baseState,
      slowFlightActive: true,
      autopilot: { active: true, targetX: 8, targetY: 5, remaining: 3 },
    } as any);
    render(<MobileNavTab />);
    expect(screen.getByText(/3 Sektoren/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/MobileNavTab.test.tsx
```

- [ ] **Step 3: Implement `MobileNavTab.tsx`**

Create `packages/client/src/components/MobileNavTab.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { RadarCanvas } from './RadarCanvas';

type NavMode = 'slow' | 'jump';

function useNavMode(): [NavMode, (m: NavMode) => void] {
  const [mode, setModeState] = useState<NavMode>(
    () => (localStorage.getItem('vs_mobile_nav_mode') as NavMode) ?? 'jump',
  );

  const setMode = (m: NavMode) => {
    localStorage.setItem('vs_mobile_nav_mode', m);
    setModeState(m);
  };

  return [mode, setMode];
}

export function MobileNavTab() {
  const [navMode, setNavMode] = useNavMode();
  const bookmarks = useStore((s) => s.bookmarks);
  const slowFlightActive = useStore((s) => s.slowFlightActive);
  const autopilot = useStore((s) => s.autopilot);

  const handleSectorTap = useCallback(
    (x: number, y: number) => {
      if (navMode === 'slow') {
        network.sendSlowFlight(x, y);
      } else {
        network.sendJump(x, y);
      }
    },
    [navMode],
  );

  const handleBookmarkGo = (sectorX: number, sectorY: number) => {
    if (navMode === 'slow') {
      network.sendSlowFlight(sectorX, sectorY);
    } else {
      network.sendJump(sectorX, sectorY);
    }
  };

  return (
    <div className="mobile-nav-tab">
      {/* Mode toggle */}
      <div className="mobile-nav-mode-toggle">
        <button
          className={`mobile-nav-mode-btn${navMode === 'slow' ? ' active' : ''}`}
          onClick={() => setNavMode('slow')}
        >
          🐌 SLOW
        </button>
        <button
          className={`mobile-nav-mode-btn${navMode === 'jump' ? ' active' : ''}`}
          onClick={() => setNavMode('jump')}
        >
          ⚡ JUMP
        </button>
      </div>

      {/* Radar */}
      <div className="mobile-nav-radar">
        <RadarCanvas onSectorTap={handleSectorTap} />
      </div>

      {/* Slow flight progress */}
      {slowFlightActive && autopilot?.active && (
        <div className="mobile-nav-flight-progress">
          <span>
            ✈ → ({autopilot.targetX}/{autopilot.targetY}) · {autopilot.remaining} Sektoren
          </span>
          <button
            className="mobile-card-stop-btn"
            onClick={() => network.sendCancelAutopilot()}
          >
            STOP
          </button>
        </div>
      )}

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <div className="mobile-nav-bookmarks">
          <div className="mobile-nav-bookmarks-header">⭐ BOOKMARKS</div>
          {bookmarks.map((bm) => (
            <div key={bm.slot} className="mobile-nav-bookmark-row">
              <span className="mobile-nav-bookmark-label">
                {bm.label} ({bm.sectorX}/{bm.sectorY})
              </span>
              <button
                className="mobile-card-action-btn"
                onClick={() => handleBookmarkGo(bm.sectorX, bm.sectorY)}
                aria-label="→ GO"
              >
                → GO
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
cd packages/client && npx vitest run src/__tests__/MobileNavTab.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/MobileNavTab.tsx packages/client/src/__tests__/MobileNavTab.test.tsx
git commit -m "feat(mobile): MobileNavTab — SLOW/JUMP toggle, radar tap navigation, bookmarks GO"
```

---

### Task 9: `MobileMineTab` component

**Files:**
- Create: `packages/client/src/components/MobileMineTab.tsx`
- Create: `packages/client/src/__tests__/MobileMineTab.test.tsx`

**Context:** Replaces the embedded `MiningScreen` on mobile. Shows one card per resource (ORE, GAS, CRYSTAL) with current/max and a MINE or STOP button. Mine-All row at the bottom triggers auto-chaining. Shows cargo inline. Shows "no mining" message when sector type is not mineable.

- [ ] **Step 1: Write failing tests**

Create `packages/client/src/__tests__/MobileMineTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileMineTab } from '../components/MobileMineTab';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
  },
}));

const asteroidSector = {
  x: 3, y: 3, type: 'asteroid_field', seed: 1,
  discoveredBy: null, discoveredAt: null, metadata: {}, environment: 'asteroid',
  contents: [],
  resources: { ore: 5, gas: 3, crystal: 1, maxOre: 10, maxGas: 8, maxCrystal: 4 },
};

const baseState = {
  currentSector: asteroidSector,
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0, materials: [] },
  ship: { stats: { cargoCap: 50 } },
  position: { x: 3, y: 3 },
};

describe('MobileMineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState(baseState as any);
  });

  it('renders ORE, GAS, CRYSTAL resource cards', () => {
    render(<MobileMineTab />);
    expect(screen.getByText(/ORE/i)).toBeInTheDocument();
    expect(screen.getByText(/GAS/i)).toBeInTheDocument();
    expect(screen.getByText(/CRYSTAL/i)).toBeInTheDocument();
  });

  it('shows current/max for each resource', () => {
    render(<MobileMineTab />);
    expect(screen.getByText(/5\s*\/\s*10/)).toBeInTheDocument(); // ore
    expect(screen.getByText(/3\s*\/\s*8/)).toBeInTheDocument();  // gas
  });

  it('renders MINE button for available resources', () => {
    render(<MobileMineTab />);
    const mineButtons = screen.getAllByRole('button', { name: /^MINE$/i });
    expect(mineButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('MINE button calls sendMine with resource', async () => {
    const { network } = await import('../network/client');
    render(<MobileMineTab />);
    const [firstMineBtn] = screen.getAllByRole('button', { name: /^MINE$/i });
    await userEvent.click(firstMineBtn);
    expect(network.sendMine).toHaveBeenCalledWith(expect.any(String), false);
  });

  it('shows STOP button when mining is active on a resource', () => {
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileMineTab />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('STOP button calls sendStopMine', async () => {
    const { network } = await import('../network/client');
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileMineTab />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(network.sendStopMine).toHaveBeenCalled();
  });

  it('renders Mine-All button', () => {
    render(<MobileMineTab />);
    expect(screen.getByRole('button', { name: /ALLE ABBAUEN/i })).toBeInTheDocument();
  });

  it('Mine-All calls sendMine with mineAll=true', async () => {
    const { network } = await import('../network/client');
    render(<MobileMineTab />);
    await userEvent.click(screen.getByRole('button', { name: /ALLE ABBAUEN/i }));
    expect(network.sendMine).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('shows no-mining message when sector is not mineable', () => {
    mockStoreState({
      ...baseState,
      currentSector: { ...asteroidSector, type: 'station', resources: undefined },
    } as any);
    render(<MobileMineTab />);
    expect(screen.getByText(/kein mining/i)).toBeInTheDocument();
  });

  it('disables MINE button when resource is depleted (value 0)', () => {
    mockStoreState({
      ...baseState,
      currentSector: {
        ...asteroidSector,
        resources: { ore: 0, gas: 3, crystal: 1, maxOre: 10, maxGas: 8, maxCrystal: 4 },
      },
    } as any);
    render(<MobileMineTab />);
    // Find ORE card's button — should be disabled
    // gas and crystal should have enabled buttons
    const mineButtons = screen.getAllByRole('button', { name: /^MINE$/i });
    expect(mineButtons.length).toBe(2); // only gas and crystal
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/MobileMineTab.test.tsx
```

- [ ] **Step 3: Implement `MobileMineTab.tsx`**

Create `packages/client/src/components/MobileMineTab.tsx`:

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';
import { getPhysicalCargoTotal } from '@void-sector/shared';
import type { MineableResourceType } from '@void-sector/shared';

const RESOURCE_LABELS: Record<MineableResourceType, string> = {
  ore: 'ORE',
  gas: 'GAS',
  crystal: 'CRYSTAL',
};

interface ResourceCardProps {
  resource: MineableResourceType;
  current: number;
  max: number;
  miningActive: boolean;
  miningResource: string | null;
}

function ResourceCard({ resource, current, max, miningActive, miningResource }: ResourceCardProps) {
  const isThisResourceMining = miningActive && miningResource === resource;
  const pct = max > 0 ? current / max : 0;
  const depleted = current <= 0;

  return (
    <div className="mobile-mine-card">
      <div className="mobile-dashboard-card-row">
        <span className="mobile-card-title">{RESOURCE_LABELS[resource]}</span>
        <span className="mobile-card-value">
          {current} / {max}
        </span>
        {isThisResourceMining ? (
          <button
            className="mobile-card-stop-btn"
            onClick={() => network.sendStopMine()}
            aria-label="Stop"
          >
            STOP
          </button>
        ) : (
          !depleted && !miningActive && (
            <button
              className="mobile-card-action-btn"
              onClick={() => network.sendMine(resource, false)}
              aria-label="MINE"
            >
              MINE
            </button>
          )
        )}
      </div>
      <div className="mobile-progress-bar">
        <div className="mobile-progress-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

export function MobileMineTab() {
  const currentSector = useStore((s) => s.currentSector);
  const mining = useStore((s) => s.mining);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);

  const resources = currentSector?.resources;
  const isMineable = currentSector?.type === 'asteroid_field' || currentSector?.type === 'nebula';

  const used = getPhysicalCargoTotal(cargo);
  const cap = ship?.stats?.cargoCap ?? 5;

  if (!isMineable || !resources) {
    return (
      <div className="mobile-mine-tab">
        <div className="mobile-mine-no-sector">
          Kein Mining in diesem Sektor
        </div>
      </div>
    );
  }

  const resourceList: MineableResourceType[] = ['ore', 'gas', 'crystal'];
  const maxMap: Record<MineableResourceType, number> = {
    ore: resources.maxOre ?? resources.ore,
    gas: resources.maxGas ?? resources.gas,
    crystal: resources.maxCrystal ?? resources.crystal,
  };
  const currentMap: Record<MineableResourceType, number> = {
    ore: resources.ore,
    gas: resources.gas,
    crystal: resources.crystal,
  };

  // First available resource for Mine-All
  const firstAvailable = resourceList.find((r) => currentMap[r] > 0);

  return (
    <div className="mobile-mine-tab">
      {/* Sector header */}
      <div className="mobile-mine-header">
        {currentSector?.type?.toUpperCase()} ({currentSector?.x}/{currentSector?.y})
      </div>

      {/* Resource cards */}
      {resourceList.map((r) => (
        <ResourceCard
          key={r}
          resource={r}
          current={currentMap[r]}
          max={maxMap[r]}
          miningActive={!!mining?.active}
          miningResource={mining?.resource ?? null}
        />
      ))}

      {/* Cargo inline */}
      <div className="mobile-mine-cargo-row">
        <span>CARGO: {used} / {cap}</span>
      </div>

      {/* Mine-All */}
      {firstAvailable && !mining?.active && (
        <div className="mobile-mine-all-row">
          <button
            className="mobile-mine-all-btn"
            onClick={() => network.sendMine(firstAvailable, true)}
            aria-label="ALLE ABBAUEN"
          >
            ▶ ALLE ABBAUEN
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify PASS**

```bash
cd packages/client && npx vitest run src/__tests__/MobileMineTab.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/MobileMineTab.tsx packages/client/src/__tests__/MobileMineTab.test.tsx
git commit -m "feat(mobile): MobileMineTab — per-resource cards with MINE/STOP + Mine-All"
```

---

### Task 10: `GameScreen` wiring + CSS

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`
- Modify: CSS (find the mobile styles file — check `packages/client/src/styles/` or `index.css`)

**Context:** `GameScreen` currently renders `{renderScreen(activeMonitor)}` in the mobile content area. Introduce `renderMobileScreen` that intercepts HOME, NAV-COM, and MINING monitor ids to render the new mobile-specific components. MEHR overlay already handles `__MEHR__`. Update the tab rendering to match new `useMobileTabs` structure (no more contextual logic needed). Add minimal CSS for new components.

- [ ] **Step 1: Find the CSS file for mobile styles**

```bash
grep -rn "mobile-content\|mobile-tabs\|mobile-tab-btn" packages/client/src --include="*.css" -l
```

- [ ] **Step 2: Add `renderMobileScreen` and update `GameScreen`**

In `packages/client/src/components/GameScreen.tsx`:

1. Add imports at the top:
```typescript
import { MobileDashboard } from './MobileDashboard';
import { MobileNavTab } from './MobileNavTab';
import { MobileMineTab } from './MobileMineTab';
import { MOBILE_HOME_ID } from '../hooks/useMobileTabs';
```

2. Add `renderMobileScreen` function alongside `renderScreen` (no explicit return type needed — consistent with existing `renderScreen`):
```typescript
function renderMobileScreen(monitorId: string) {
  switch (monitorId) {
    case MOBILE_HOME_ID:
      return <MobileDashboard />;
    case MONITORS.NAV_COM:
      return <MobileNavTab />;
    case MONITORS.MINING:
      return <MobileMineTab />;
    default:
      return renderScreen(monitorId);
  }
}
```

3. Update the mobile content div:
```tsx
{/* Mobile content (< 1024px): full-screen active monitor */}
<div className="mobile-content">{renderMobileScreen(activeMonitor)}</div>
```

4. Remove the `atStation` / contextual tab logic that no longer exists in `useMobileTabs` (the hook no longer returns `atStation`). The `useMobileTabs` call becomes:
```typescript
const { tabs: mobileTabs, mehrMonitors, mehrAlertCount } = useMobileTabs();
```
(Remove the `atStation` destructure if present.)

5. On mount, if the user is on mobile (viewport < 1024px) and `activeMonitor` is a monitor that is no longer a main tab (e.g., SHIP-SYS, COMMS), redirect to HOME. This guard is mobile-only — never touch `activeMonitor` on desktop. Add a `useEffect` that runs once:
```typescript
useEffect(() => {
  // Only run on mobile viewports to avoid affecting desktop activeProgram logic
  if (window.innerWidth >= 1024) return;
  const mainTabIds = [MOBILE_HOME_ID, MONITORS.NAV_COM, MONITORS.MINING, MONITORS.QUESTS, '__MEHR__'];
  if (!mainTabIds.includes(activeMonitor)) {
    setActiveMonitor(MOBILE_HOME_ID);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Add CSS for new mobile components**

Find the CSS file from Step 1 and add:

```css
/* ── Mobile Dashboard ──────────────────────────────────────── */
.mobile-dashboard {
  padding: 8px;
  overflow-y: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-dashboard-card {
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  padding: 8px 10px;
  background: #060606;
}

.mobile-dashboard-card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.mobile-card-title {
  color: var(--color-primary);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.mobile-card-subtitle {
  color: #888;
  font-size: 0.75rem;
  margin-top: 3px;
}

.mobile-card-value {
  color: #ccc;
  font-size: 0.8rem;
}

.mobile-card-status-active {
  color: #63ff84;
  font-size: 0.8rem;
}

.mobile-card-status-dim {
  color: #555;
  font-size: 0.8rem;
}

.mobile-card-stop-btn {
  border: 1px solid #ff4444;
  color: #ff4444;
  background: transparent;
  padding: 4px 10px;
  font-size: 0.75rem;
  min-height: 44px;
  min-width: 60px;
  cursor: pointer;
  font-family: var(--font-mono);
}

.mobile-card-action-btn {
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  background: transparent;
  padding: 4px 10px;
  font-size: 0.75rem;
  min-height: 44px;
  cursor: pointer;
  font-family: var(--font-mono);
}

.mobile-progress-bar {
  height: 4px;
  background: #1a1a1a;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.mobile-progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.mobile-ap-bar {
  margin-top: auto;
}

/* ── Mobile NAV Tab ──────────────────────────────────────────── */
.mobile-nav-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.mobile-nav-mode-toggle {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #2a2a2a;
}

.mobile-nav-mode-btn {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  border-right: 1px solid #2a2a2a;
  color: #555;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  min-height: 44px;
  cursor: pointer;
}

.mobile-nav-mode-btn:last-child {
  border-right: none;
}

.mobile-nav-mode-btn.active {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}

.mobile-nav-radar {
  flex: 0 0 40vh;
  min-height: 200px;
  position: relative;
}

.mobile-nav-flight-progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #2a2a2a;
  color: var(--color-primary);
  font-size: 0.8rem;
}

.mobile-nav-bookmarks {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.mobile-nav-bookmarks-header {
  color: var(--color-primary);
  font-size: 0.8rem;
  margin-bottom: 6px;
  letter-spacing: 0.05em;
}

.mobile-nav-bookmark-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #1a1a1a;
}

.mobile-nav-bookmark-label {
  color: #aaa;
  font-size: 0.8rem;
  flex: 1;
}

/* ── Mobile MINE Tab ──────────────────────────────────────────── */
.mobile-mine-tab {
  padding: 8px;
  overflow-y: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mobile-mine-header {
  color: var(--color-primary);
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  padding-bottom: 4px;
  border-bottom: 1px solid #2a2a2a;
}

.mobile-mine-card {
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  padding: 8px 10px;
  background: #060606;
}

.mobile-mine-no-sector {
  color: #555;
  text-align: center;
  margin-top: 40px;
  font-size: 0.9rem;
}

.mobile-mine-cargo-row {
  color: #888;
  font-size: 0.8rem;
  padding: 4px 0;
}

.mobile-mine-all-row {
  margin-top: auto;
  padding-top: 8px;
}

.mobile-mine-all-btn {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  font-family: var(--font-mono);
  font-size: 0.9rem;
  min-height: 44px;
  cursor: pointer;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 4: Run full client test suite**

```bash
cd packages/client && npx vitest run
```
Expected: all tests pass

- [ ] **Step 5: Run full server test suite**

```bash
cd packages/server && npx vitest run
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx packages/client/src/styles/
git commit -m "feat(mobile): wire MobileDashboard/MobileNavTab/MobileMineTab into GameScreen + CSS"
```

---

## Final Integration

- [ ] **Build and verify TypeScript compilation**

```bash
cd packages/client && npx tsc --noEmit
cd packages/server && npx tsc --noEmit
```
Expected: no type errors

- [ ] **Run all tests one final time**

```bash
cd packages/server && npx vitest run && cd ../client && npx vitest run && cd ../shared && npx vitest run
```
Expected: all pass

- [ ] **Final commit and push**

```bash
git add -A
git commit -m "feat(mobile): complete mobile redesign — HOME/NAV/MINE/QUESTS/MEHR + Slow Flight"
git push
```
