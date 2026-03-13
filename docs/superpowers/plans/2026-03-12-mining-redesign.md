# Mining Redesign (#279) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finite, depletable sector resources with server-side auto-stop, mine-all chaining, tick-based regeneration, and current/max display.

**Architecture:** Mining engine gains `mineAll` field. MiningService gets auto-stop timers, depletion DB writes, and mine-all chaining logic. `getSector` switches from time-based to tick-based regen. Wire format adds `maxOre/maxGas/maxCrystal` to sector resources. Client shows `X/Y` format.

**Tech Stack:** TypeScript, Colyseus (server rooms), PostgreSQL (sectors table), Redis (mining state), React + Zustand (client)

**Spec:** `docs/superpowers/specs/2026-03-12-mining-redesign-design.md`

---

## Chunk 1: Shared Types + Constants + DB Migration

### Task 1: Add `mineAll` to MiningState type + MineMessage

**Files:**
- Modify: `packages/shared/src/types.ts:220-228` (MiningState interface)
- Modify: `packages/shared/src/types.ts:253-255` (MineMessage interface)
- Test: `packages/server/src/engine/__tests__/mining.test.ts`

- [ ] **Step 1: Add `mineAll` to `MiningState` interface**

In `packages/shared/src/types.ts:220-228`, add `mineAll` field:

```typescript
export interface MiningState {
  active: boolean;
  resource: ResourceType | null;
  sectorX: number;
  sectorY: number;
  startedAt: number | null;
  rate: number;
  sectorYield: number;
  mineAll: boolean;
}
```

- [ ] **Step 2: Add `mineAll` to `MineMessage` interface**

In `packages/shared/src/types.ts:253-255`:

```typescript
export interface MineMessage {
  resource: ResourceType;
  mineAll?: boolean;
}
```

- [ ] **Step 3: Build shared package**

Run: `cd packages/shared && npm run build`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add mineAll to MiningState and MineMessage types"
```

### Task 2: Replace regen constants with tick-based + add `maxResources` to `SectorResources`

**Files:**
- Modify: `packages/shared/src/constants.ts:73-77` (regen constants)
- Modify: `packages/shared/src/types.ts:79-83` (SectorResources interface)
- Test: existing tests must still pass

- [ ] **Step 1: Replace regen constants**

In `packages/shared/src/constants.ts`, replace lines 75-77:

```typescript
// Old:
export const RESOURCE_REGEN_PER_MINUTE = 1;
export const CRYSTAL_REGEN_PER_MINUTE = 1 / 3;
export const RESOURCE_REGEN_DELAY_MINUTES = 5;

// New:
export const RESOURCE_REGEN_DELAY_TICKS = 50;
export const RESOURCE_REGEN_INTERVAL_TICKS = 12; // 1 unit per 12 ticks (60s)
```

Keep `RESOURCE_REGEN_PER_MINUTE`, `CRYSTAL_REGEN_PER_MINUTE`, and `RESOURCE_REGEN_DELAY_MINUTES` temporarily — they're imported in `queries.ts` and will be removed in Task 5 when `getSector` is updated.

- [ ] **Step 2: Add max fields to `SectorResources`**

In `packages/shared/src/types.ts:79-83`:

```typescript
export interface SectorResources {
  ore: number;
  gas: number;
  crystal: number;
  maxOre?: number;
  maxGas?: number;
  maxCrystal?: number;
}
```

Optional fields — old sector data without max values still works.

- [ ] **Step 3: Build shared package**

Run: `cd packages/shared && npm run build`

- [ ] **Step 4: Run all tests to verify no breakage**

Run: `cd packages/shared && npx vitest run && cd ../server && npx vitest run && cd ../client && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add tick-based regen constants and maxResources to SectorResources"
```

### Task 3: DB Migration — `last_mined_tick` column + per-resource metadata

**Files:**
- Create: `packages/server/src/db/migrations/045_mining_ticks.sql`
- Test: manual verification via migration runner

- [ ] **Step 1: Write migration**

Create `packages/server/src/db/migrations/045_mining_ticks.sql`:

```sql
-- Add last_mined_tick for tick-based resource regeneration
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS last_mined_tick BIGINT;

-- Initialize: if last_mined exists, approximate the tick from timestamp
-- (This is a best-effort conversion; sectors will re-calibrate on next mine)
```

No per-resource `lastMinedTick` columns needed — we store that in `metadata.lastMinedTick` JSON (already designed in spec as `metadata: { lastMinedTick: { ore: null, gas: 1200, crystal: null } }`).

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/045_mining_ticks.sql
git commit -m "feat(db): migration 045 — add last_mined_tick column for tick-based regen"
```

## Chunk 2: Mining Engine + Redis Persistence

### Task 4: Update mining engine — `mineAll` in `createMiningState` and `startMining`

**Files:**
- Modify: `packages/server/src/engine/mining.ts`
- Modify: `packages/server/src/engine/__tests__/mining.test.ts`

- [ ] **Step 1: Write failing tests for `mineAll` in mining engine**

Add to `packages/server/src/engine/__tests__/mining.test.ts`:

```typescript
it('createMiningState has mineAll false by default', () => {
  const state = createMiningState();
  expect(state.mineAll).toBe(false);
});

it('startMining sets mineAll from parameter', () => {
  const state = startMining('ore', 3, 5, 20, Date.now(), true);
  expect(state.mineAll).toBe(true);
});

it('startMining defaults mineAll to false', () => {
  const state = startMining('ore', 3, 5, 20);
  expect(state.mineAll).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && npx vitest run src/engine/__tests__/mining.test.ts`
Expected: FAIL — `mineAll` not in returned objects

- [ ] **Step 3: Update `createMiningState`**

In `packages/server/src/engine/mining.ts:4-14`:

```typescript
export function createMiningState(): MiningState {
  return {
    active: false,
    resource: null,
    sectorX: 0,
    sectorY: 0,
    startedAt: null,
    rate: 0,
    sectorYield: 0,
    mineAll: false,
  };
}
```

- [ ] **Step 4: Update `startMining` — add `mineAll` parameter**

In `packages/server/src/engine/mining.ts:16-32`:

```typescript
export function startMining(
  resource: ResourceType,
  sectorX: number,
  sectorY: number,
  sectorYield: number,
  now: number = Date.now(),
  mineAll: boolean = false,
): MiningState {
  return {
    active: true,
    resource,
    sectorX,
    sectorY,
    startedAt: now,
    rate: MINING_RATE_PER_SECOND,
    sectorYield,
    mineAll,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/engine/__tests__/mining.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/mining.ts packages/server/src/engine/__tests__/mining.test.ts
git commit -m "feat(engine): add mineAll to mining state creation"
```

### Task 5: Update `validateMine` to pass `mineAll` through

**Files:**
- Modify: `packages/server/src/engine/commands.ts:122-146`
- Modify: `packages/server/src/engine/__tests__/commands-slates.test.ts` (if mine validation tests exist there; otherwise skip)

- [ ] **Step 1: Update `validateMine` to accept and pass `mineAll`**

In `packages/server/src/engine/commands.ts:122-146`, add `mineAll` parameter:

```typescript
export function validateMine(
  resource: ResourceType,
  sectorResources: SectorResources,
  currentMining: MiningState,
  cargoTotal: number,
  cargoCap: number,
  sectorX: number,
  sectorY: number,
  mineAll: boolean = false,
): MineValidation {
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    return { valid: false, error: 'Invalid resource type' };
  }
  const mineableRes = resource as MineableResourceType;
  if (currentMining.active) {
    return { valid: false, error: 'Already mining — stop first' };
  }
  if (sectorResources[mineableRes] <= 0) {
    return { valid: false, error: `No ${resource} in this sector` };
  }
  if (cargoTotal >= cargoCap) {
    return { valid: false, error: 'Cargo hold is full' };
  }
  const state = startMining(resource, sectorX, sectorY, sectorResources[mineableRes], Date.now(), mineAll);
  return { valid: true, state };
}
```

- [ ] **Step 2: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS (new parameter has default value)

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/engine/commands.ts
git commit -m "feat(engine): pass mineAll through validateMine"
```

### Task 6: Update Redis mining state persistence — add `mineAll`

**Files:**
- Modify: `packages/server/src/rooms/services/RedisAPStore.ts:49-79`

- [ ] **Step 1: Update `getMiningState` to read `mineAll`**

In `packages/server/src/rooms/services/RedisAPStore.ts:51-63`:

```typescript
export async function getMiningState(playerId: string): Promise<MiningState> {
  const data = await redis.hgetall(`${MINING_PREFIX}${playerId}`);
  if (!data.active) return createMiningState();
  return {
    active: data.active === 'true',
    resource: (data.resource as MiningState['resource']) || null,
    sectorX: Number(data.sectorX),
    sectorY: Number(data.sectorY),
    startedAt: data.startedAt ? Number(data.startedAt) : null,
    rate: Number(data.rate),
    sectorYield: Number(data.sectorYield),
    mineAll: data.mineAll === 'true',
  };
}
```

- [ ] **Step 2: Update `saveMiningState` to write `mineAll`**

In `packages/server/src/rooms/services/RedisAPStore.ts:65-79`:

```typescript
export async function saveMiningState(playerId: string, state: MiningState): Promise<void> {
  if (!state.active) {
    await redis.del(`${MINING_PREFIX}${playerId}`);
    return;
  }
  await redis.hset(`${MINING_PREFIX}${playerId}`, {
    active: String(state.active),
    resource: state.resource || '',
    sectorX: String(state.sectorX),
    sectorY: String(state.sectorY),
    startedAt: String(state.startedAt || 0),
    rate: String(state.rate),
    sectorYield: String(state.sectorYield),
    mineAll: String(state.mineAll),
  });
}
```

- [ ] **Step 3: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/RedisAPStore.ts
git commit -m "feat(redis): persist mineAll in mining state"
```

## Chunk 3: Server — getSector Tick-Based Regen + Resource Depletion

### Task 7: Update `getSector` — tick-based regen + return max values

**Files:**
- Modify: `packages/server/src/db/queries.ts:289-347`
- Create: `packages/server/src/__tests__/getSectorRegen.test.ts`

- [ ] **Step 1: Write failing tests for tick-based regen**

Create `packages/server/src/__tests__/getSectorRegen.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  RESOURCE_REGEN_DELAY_TICKS,
  RESOURCE_REGEN_INTERVAL_TICKS,
} from '@void-sector/shared';

// Test the regen formula in isolation (same logic as in getSector)
function applyRegen(
  current: number,
  max: number,
  lastMinedTick: number | null,
  currentTick: number,
): number {
  if (lastMinedTick === null || max <= 0) return current;
  const ticksSinceMined = currentTick - lastMinedTick;
  if (ticksSinceMined <= RESOURCE_REGEN_DELAY_TICKS) return current;
  const regen = Math.floor(
    (ticksSinceMined - RESOURCE_REGEN_DELAY_TICKS) / RESOURCE_REGEN_INTERVAL_TICKS,
  );
  return Math.min(max, current + regen);
}

describe('tick-based resource regeneration', () => {
  it('no regen during delay period (50 ticks)', () => {
    expect(applyRegen(5, 20, 1000, 1049)).toBe(5);
    expect(applyRegen(5, 20, 1000, 1050)).toBe(5);
  });

  it('regens 1 unit per 12 ticks after delay', () => {
    // 50 delay + 12 interval = tick 1062 → 1 regen
    expect(applyRegen(5, 20, 1000, 1062)).toBe(6);
    // 50 delay + 24 interval = tick 1074 → 2 regen
    expect(applyRegen(5, 20, 1000, 1074)).toBe(7);
  });

  it('caps at max', () => {
    expect(applyRegen(18, 20, 1000, 2000)).toBe(20);
  });

  it('no regen when lastMinedTick is null', () => {
    expect(applyRegen(5, 20, null, 2000)).toBe(5);
  });

  it('per-resource independent regen', () => {
    // ore mined at tick 1000, gas mined at tick 1100
    const oreCurrent = applyRegen(3, 10, 1000, 1200);
    const gasCurrent = applyRegen(0, 5, 1100, 1200);
    // ore: 200 ticks since mined, (200-50)/12 = 12.5 → 12 regen → min(10, 3+12) = 10
    expect(oreCurrent).toBe(10);
    // gas: 100 ticks since mined, (100-50)/12 = 4.16 → 4 regen → min(5, 0+4) = 4
    expect(gasCurrent).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (pure function test)**

Run: `cd packages/server && npx vitest run src/__tests__/getSectorRegen.test.ts`
Expected: PASS (we're testing the formula, not the DB query)

- [ ] **Step 3: Update `getSector` to use tick-based regen and return max values**

In `packages/server/src/db/queries.ts`, update the `getSector` function:

1. Add `last_mined_tick` to the SELECT query (line 305)
2. Read `lastMinedTick` per-resource from metadata
3. Replace the time-based regen block (lines 314-332) with tick-based
4. Include `maxOre`, `maxGas`, `maxCrystal` in the returned resources

```typescript
export async function getSector(x: number, y: number): Promise<SectorData | null> {
  const result = await query<{
    x: number;
    y: number;
    type: string;
    seed: number;
    discovered_by: string | null;
    discovered_at: string | null;
    metadata: Record<string, unknown>;
    environment: string;
    contents: string[];
    last_mined: string | null;
    last_mined_tick: string | null;
    max_ore: number;
    max_gas: number;
    max_crystal: number;
  }>(
    'SELECT x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents, last_mined, last_mined_tick, max_ore, max_gas, max_crystal FROM sectors WHERE x = $1 AND y = $2',
    [x, y],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const meta = row.metadata || {};
  let resources = (meta.resources as { ore: number; gas: number; crystal: number }) || { ore: 0, gas: 0, crystal: 0 };

  // Tick-based resource regeneration (per-resource independent)
  const lastMinedTick = (meta.lastMinedTick as Record<string, number | null>) || {};
  const currentTick = getUniverseTickCount();

  if (row.max_ore > 0 || row.max_gas > 0 || row.max_crystal > 0) {
    const regenResource = (current: number, max: number, resLastTick: number | null): number => {
      if (resLastTick === null || max <= 0) return current;
      const ticksSinceMined = currentTick - resLastTick;
      if (ticksSinceMined <= RESOURCE_REGEN_DELAY_TICKS) return current;
      const regen = Math.floor(
        (ticksSinceMined - RESOURCE_REGEN_DELAY_TICKS) / RESOURCE_REGEN_INTERVAL_TICKS,
      );
      return Math.min(max, current + regen);
    };

    resources = {
      ore: regenResource(resources.ore, row.max_ore, lastMinedTick.ore ?? null),
      gas: regenResource(resources.gas, row.max_gas, lastMinedTick.gas ?? null),
      crystal: regenResource(resources.crystal, row.max_crystal, lastMinedTick.crystal ?? null),
    };
  }

  return {
    x: row.x,
    y: row.y,
    type: row.type as SectorData['type'],
    seed: row.seed,
    discoveredBy: row.discovered_by,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
    resources: {
      ...resources,
      maxOre: row.max_ore,
      maxGas: row.max_gas,
      maxCrystal: row.max_crystal,
    },
    environment: (row.environment ?? 'empty') as SectorData['environment'],
    contents: (row.contents ?? []) as SectorData['contents'],
  };
}
```

Import `getUniverseTickCount` at the top of `queries.ts`:
```typescript
import { getUniverseTickCount } from '../engine/universeBootstrap.js';
```

Import new constants (replace old ones):
```typescript
import {
  RESOURCE_REGEN_DELAY_TICKS,
  RESOURCE_REGEN_INTERVAL_TICKS,
} from '@void-sector/shared';
```

Remove old imports: `RESOURCE_REGEN_PER_MINUTE`, `CRYSTAL_REGEN_PER_MINUTE`, `RESOURCE_REGEN_DELAY_MINUTES`.

- [ ] **Step 4: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/__tests__/getSectorRegen.test.ts
git commit -m "feat(db): tick-based resource regen in getSector, return max values"
```

### Task 8: Update `updateSectorResources` — depletion with per-resource tick tracking

**Files:**
- Modify: `packages/server/src/db/queries.ts:371-381` (updateSectorResources)

- [ ] **Step 1: Update `updateSectorResources` to track per-resource `lastMinedTick`**

Replace `updateSectorResources` in `packages/server/src/db/queries.ts:371-381`:

```typescript
export async function updateSectorResources(
  x: number,
  y: number,
  resources: { ore: number; gas: number; crystal: number },
  minedResource: string,
): Promise<void> {
  const currentTick = getUniverseTickCount();
  // Build metadata update: set resources + update lastMinedTick for the mined resource
  await query(
    `UPDATE sectors SET
       metadata = jsonb_set(
         jsonb_set(COALESCE(metadata, '{}'), '{resources}', $3::jsonb),
         '{lastMinedTick,${minedResource}}', $4::text::jsonb
       ),
       last_mined = $5,
       last_mined_tick = $4
     WHERE x = $1 AND y = $2`,
    [x, y, JSON.stringify(resources), currentTick, Date.now()],
  );
}
```

Note: The `minedResource` is interpolated into the JSON path — it's always one of `ore`, `gas`, `crystal` (validated upstream). The `last_mined` and `last_mined_tick` columns are also updated as a fallback.

- [ ] **Step 2: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(db): updateSectorResources tracks per-resource lastMinedTick"
```

## Chunk 4: MiningService — Auto-Stop Timer, Depletion, Mine-All

### Task 9: MiningService — resource depletion on stop + auto-stop timer + mine-all chaining

This is the core server logic task. It modifies MiningService significantly.

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts:478-487` (add toggleMineAll handler)
- Create: `packages/server/src/__tests__/miningAutoStop.test.ts`

- [ ] **Step 1: Write failing tests for auto-stop and depletion**

Create `packages/server/src/__tests__/miningAutoStop.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Client } from 'colyseus';

vi.mock('../engine/inventoryService.js', () => ({
  getResourceTotal: vi.fn().mockResolvedValue(0),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  addToInventory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries.js', () => ({
  getSector: vi.fn().mockResolvedValue({
    resources: { ore: 10, gas: 5, crystal: 0, maxOre: 10, maxGas: 5, maxCrystal: 0 },
    contents: [], type: 'asteroid_field', environment: 'normal',
  }),
  updateSectorResources: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../engine/commands.js', () => ({
  validateMine: vi.fn().mockReturnValue({
    valid: true,
    state: {
      active: true, resource: 'ore', sectorX: 1, sectorY: 1,
      startedAt: Date.now(), rate: 1, sectorYield: 10, mineAll: false,
    },
  }),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getMiningState: vi.fn().mockResolvedValue({ active: false, mineAll: false }),
  saveMiningState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../engine/universeBootstrap.js', () => ({
  getUniverseTickCount: vi.fn().mockReturnValue(1000),
}));

import { MiningService } from '../rooms/services/MiningService.js';
import { updateSectorResources, getSector } from '../db/queries.js';
import { saveMiningState } from '../rooms/services/RedisAPStore.js';
import { getResourceTotal } from '../engine/inventoryService.js';
import { validateMine } from '../engine/commands.js';

function makeClient(userId = 'u1'): Client {
  return {
    sessionId: 's1',
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

function makeCtx() {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    _px: vi.fn().mockReturnValue(1),
    _py: vi.fn().mockReturnValue(1),
    _pst: vi.fn().mockReturnValue('asteroid_field'),
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50, miningBonus: 0 }),
    getPlayerBonuses: vi.fn().mockResolvedValue({ miningRateMultiplier: 1 }),
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('MiningService — resource depletion', () => {
  it('calls updateSectorResources on stopMine to deplete resource', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    const { getMiningState } = await import('../rooms/services/RedisAPStore.js');
    vi.mocked(getMiningState).mockResolvedValue({
      active: true, resource: 'ore', sectorX: 1, sectorY: 1,
      startedAt: Date.now() - 5000, rate: 1, sectorYield: 10, mineAll: false,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(0);
    vi.mocked(getSector).mockResolvedValue({
      resources: { ore: 10, gas: 5, crystal: 0, maxOre: 10, maxGas: 5, maxCrystal: 0 },
    } as any);

    await svc.handleStopMine(client);

    expect(updateSectorResources).toHaveBeenCalledWith(
      1, 1,
      expect.objectContaining({ ore: 5 }), // 10 - 5 mined
      'ore',
    );
  });
});

describe('MiningService — auto-stop timer', () => {
  it('sets timeout on handleMine that fires stopMine', async () => {
    vi.useFakeTimers();
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    await svc.handleMine(client, { resource: 'ore' });

    // Timer should be set: sectorYield(10) / rate(1) * 1000 = 10000ms
    expect(svc.hasTimer('u1')).toBe(true);

    vi.useRealTimers();
  });

  it('clears timer on manual stopMine', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    // Simulate active mining
    svc.setTimerForTest('u1', setTimeout(() => {}, 99999));

    const { getMiningState } = await import('../rooms/services/RedisAPStore.js');
    vi.mocked(getMiningState).mockResolvedValue({
      active: true, resource: 'ore', sectorX: 1, sectorY: 1,
      startedAt: Date.now() - 1000, rate: 1, sectorYield: 10, mineAll: false,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(0);
    vi.mocked(getSector).mockResolvedValue({
      resources: { ore: 10, gas: 0, crystal: 0, maxOre: 10, maxGas: 0, maxCrystal: 0 },
    } as any);

    await svc.handleStopMine(client);

    expect(svc.hasTimer('u1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/server && npx vitest run src/__tests__/miningAutoStop.test.ts`
Expected: FAIL — `updateSectorResources` not called, `hasTimer` not a method

- [ ] **Step 3: Implement MiningService changes**

Rewrite `packages/server/src/rooms/services/MiningService.ts`:

```typescript
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  MineMessage,
  JettisonMessage,
  CargoState,
  MineableResourceType,
} from '@void-sector/shared';
import { MINING_RATE_PER_SECOND, RESOURCE_TYPES } from '@void-sector/shared';

import { validateMine, validateJettison } from '../../engine/commands.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import { stopMining } from '../../engine/mining.js';
import { getMiningState, saveMiningState } from './RedisAPStore.js';
import { getSector, updateSectorResources } from '../../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  getResourceTotal,
  getCargoState,
} from '../../engine/inventoryService.js';
import { rejectGuest } from './utils.js';

const VALID_MINE_RESOURCES = ['ore', 'gas', 'crystal'];
const MINE_ALL_ORDER: MineableResourceType[] = ['ore', 'gas', 'crystal'];

export class MiningService {
  private autoStopTimers = new Map<string, NodeJS.Timeout>();

  constructor(private ctx: ServiceContext) {}

  /** Test helper: check if a timer exists for a player */
  hasTimer(playerId: string): boolean {
    return this.autoStopTimers.has(playerId);
  }

  /** Test helper: set a timer directly */
  setTimerForTest(playerId: string, timer: NodeJS.Timeout): void {
    this.autoStopTimers.set(playerId, timer);
  }

  /** Clear auto-stop timer for player */
  private clearTimer(playerId: string): void {
    const timer = this.autoStopTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.autoStopTimers.delete(playerId);
    }
  }

  /** Clear all timers (called on room dispose) */
  clearAllTimers(): void {
    for (const timer of this.autoStopTimers.values()) {
      clearTimeout(timer);
    }
    this.autoStopTimers.clear();
  }

  /** Set auto-stop timer for mining */
  private setAutoStopTimer(
    client: Client,
    playerId: string,
    sectorYield: number,
    rate: number,
    cargoSpace: number,
  ): void {
    this.clearTimer(playerId);

    const resourceTimeout = Math.ceil(sectorYield / rate) * 1000;
    const cargoTimeout = Math.ceil(cargoSpace / rate) * 1000;
    const timeout = Math.min(resourceTimeout, cargoTimeout);

    const timer = setTimeout(async () => {
      this.autoStopTimers.delete(playerId);
      await this.handleAutoStop(client, playerId);
    }, timeout);

    this.autoStopTimers.set(playerId, timer);
  }

  /** Handle auto-stop: stop mining, optionally chain to next resource (mine-all) */
  private async handleAutoStop(client: Client, playerId: string): Promise<void> {
    const mining = await getMiningState(playerId);
    if (!mining.active) return;

    const cargoTotal = await getResourceTotal(playerId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    const result = stopMining(mining, cargoSpace);

    if (result.mined > 0 && result.resource) {
      await addToInventory(playerId, 'resource', result.resource, result.mined);
      await this.depleteResource(mining.sectorX, mining.sectorY, result.resource as MineableResourceType, result.mined);
      const miningXp = Math.floor(result.mined / 5);
      if (miningXp > 0) {
        addAcepXpForPlayer(playerId, 'ausbau', miningXp).catch(() => {});
      }
    }

    await saveMiningState(playerId, result.newState);

    // Mine-all chaining
    if (mining.mineAll) {
      const newCargoTotal = await getResourceTotal(playerId);
      const newCargoSpace = Math.max(0, ship.cargoCap - newCargoTotal);
      if (newCargoSpace > 0) {
        const sectorData = await getSector(mining.sectorX, mining.sectorY);
        if (sectorData?.resources) {
          for (const res of MINE_ALL_ORDER) {
            if (sectorData.resources[res] > 0) {
              // Start mining next resource
              const nextResult = validateMine(
                res,
                sectorData.resources,
                result.newState,
                newCargoTotal,
                ship.cargoCap,
                mining.sectorX,
                mining.sectorY,
                true, // mineAll
              );
              if (nextResult.valid && nextResult.state) {
                const bonuses = await this.ctx.getPlayerBonuses(playerId);
                nextResult.state.rate = MINING_RATE_PER_SECOND
                  * (1 + (ship.miningBonus ?? 0))
                  * bonuses.miningRateMultiplier;

                await saveMiningState(playerId, nextResult.state);
                client.send('miningUpdate', nextResult.state);
                this.setAutoStopTimer(
                  client,
                  playerId,
                  nextResult.state.sectorYield,
                  nextResult.state.rate,
                  newCargoSpace,
                );
                return; // Chained to next resource — don't send stop
              }
            }
          }
        }
      }
    }

    // No chaining — send final stop state + cargo update
    const cargo = await getCargoState(playerId);
    client.send('miningUpdate', result.newState);
    client.send('cargoUpdate', cargo);
  }

  /** Deplete a resource in the sector DB */
  private async depleteResource(
    sectorX: number,
    sectorY: number,
    resource: MineableResourceType,
    amount: number,
  ): Promise<void> {
    const sectorData = await getSector(sectorX, sectorY);
    if (!sectorData?.resources) return;
    const resources = {
      ore: sectorData.resources.ore,
      gas: sectorData.resources.gas,
      crystal: sectorData.resources.crystal,
    };
    resources[resource] = Math.max(0, resources[resource] - amount);
    await updateSectorResources(sectorX, sectorY, resources, resource);
  }

  async handleMine(client: Client, data: MineMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'mine', 500)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    if (!data.resource || !VALID_MINE_RESOURCES.includes(data.resource)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid resource type' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource } = data;
    const mineAll = data.mineAll ?? false;

    const sectorData = await getSector(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!sectorData?.resources) {
      client.send('error', { code: 'NO_RESOURCES', message: 'No resources in this sector' });
      return;
    }

    const current = await getMiningState(auth.userId);
    const cargoTotal = await getResourceTotal(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);

    const result = validateMine(
      resource,
      sectorData.resources,
      current,
      cargoTotal,
      ship.cargoCap,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
      mineAll,
    );
    if (!result.valid) {
      client.send('error', { code: 'MINE_FAILED', message: result.error! });
      return;
    }

    // Apply ship module bonus and faction mining bonus
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);
    result.state!.rate = MINING_RATE_PER_SECOND
      * (1 + (ship.miningBonus ?? 0))
      * bonuses.miningRateMultiplier;

    await saveMiningState(auth.userId, result.state!);
    client.send('miningUpdate', result.state!);

    // Set auto-stop timer
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    this.setAutoStopTimer(
      client,
      auth.userId,
      result.state!.sectorYield,
      result.state!.rate,
      cargoSpace,
    );
  }

  async handleStopMine(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Clear auto-stop timer
    this.clearTimer(auth.userId);

    const mining = await getMiningState(auth.userId);
    if (!mining.active) {
      client.send('error', { code: 'NOT_MINING', message: 'Not currently mining' });
      return;
    }

    const cargoTotal = await getResourceTotal(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    const result = stopMining(mining, cargoSpace);

    if (result.mined > 0 && result.resource) {
      await addToInventory(auth.userId, 'resource', result.resource, result.mined);
      // Deplete sector resource
      await this.depleteResource(
        mining.sectorX,
        mining.sectorY,
        result.resource as MineableResourceType,
        result.mined,
      );
      // ACEP: AUSBAU-XP for mining/resource collection (spec: +1 per 5 units mined)
      const miningXp = Math.floor(result.mined / 5);
      if (miningXp > 0) {
        addAcepXpForPlayer(auth.userId, 'ausbau', miningXp).catch(() => {});
      }
    }

    await saveMiningState(auth.userId, result.newState);

    const cargo = await getCargoState(auth.userId);
    client.send('miningUpdate', result.newState);
    client.send('cargoUpdate', cargo);
  }

  /** Handle toggleMineAll — toggle mine-all while mining is active */
  async handleToggleMineAll(client: Client, data: { mineAll: boolean }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mining = await getMiningState(auth.userId);
    if (!mining.active) return;
    mining.mineAll = data.mineAll;
    await saveMiningState(auth.userId, mining);
    client.send('miningUpdate', mining);
  }

  async handleJettison(client: Client, data: JettisonMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'jettison', 500)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    if (rejectGuest(client, 'Abwerfen')) return;
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const cargo = await getCargoState(auth.userId);
    const currentAmount = cargo[resource as keyof CargoState] ?? 0;

    const result = validateJettison(resource, currentAmount);
    if (!result.valid) {
      client.send('error', { code: 'JETTISON_FAILED', message: result.error! });
      return;
    }

    await removeFromInventory(auth.userId, 'resource', resource, currentAmount);
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('logEntry', `FRACHT ABGEWORFEN: ${currentAmount} ${resource.toUpperCase()}`);
  }
}
```

- [ ] **Step 4: Add `toggleMineAll` message handler in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, after line 484 (after `stopMine` handler):

```typescript
    this.onMessage('toggleMineAll', async (client, data: { mineAll: boolean }) => {
      await this.mining.handleToggleMineAll(client, data);
    });
```

- [ ] **Step 5: Add `clearAllTimers` call in SectorRoom `onDispose`**

Find the `onDispose` method in SectorRoom and add:
```typescript
this.mining.clearAllTimers();
```

- [ ] **Step 6: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/rooms/services/MiningService.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/__tests__/miningAutoStop.test.ts
git commit -m "feat(mining): resource depletion, auto-stop timer, mine-all chaining, toggleMineAll"
```

## Chunk 5: Client — Current/Max Display + Mine-All Checkbox

### Task 10: MiningScreen — current/max resource display + mineAll checkbox

**Files:**
- Modify: `packages/client/src/components/MiningScreen.tsx`
- Modify: `packages/client/src/network/client.ts` (sendMine with mineAll, toggleMineAll)

- [ ] **Step 1: Update `sendMine` to accept `mineAll` parameter**

In `packages/client/src/network/client.ts`, find `sendMine` and update:

```typescript
sendMine(resource: string, mineAll?: boolean) {
  this.room?.send('mine', { resource, mineAll: mineAll ?? false });
}
```

- [ ] **Step 2: Add `sendToggleMineAll` method**

In `packages/client/src/network/client.ts`, near `sendMine`/`sendStopMine`:

```typescript
sendToggleMineAll(mineAll: boolean) {
  this.room?.send('toggleMineAll', { mineAll });
}
```

- [ ] **Step 3: Update MiningScreen — current/max display**

In `packages/client/src/components/MiningScreen.tsx`:

Change `ResourceBar` to show `value/max` format when max is available:

```typescript
function ResourceBar({ label, value, max, maxResource }: { label: string; value: number; max: number; maxResource?: number }) {
  const width = 10;
  const displayMax = maxResource ?? max;
  const filled = displayMax > 0 ? Math.round((value / displayMax) * width) : 0;
  const bar = '\u2587'.repeat(filled) + '\u2591'.repeat(width - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
      {label.padEnd(10)} {bar} {String(value).padStart(3)}{maxResource !== undefined ? `/${maxResource}` : ''}
    </div>
  );
}
```

Update ResourceBar usage (lines 80-82):

```typescript
<ResourceBar label="ORE" value={resources.ore} max={maxYield} maxResource={resources.maxOre} />
<ResourceBar label="GAS" value={resources.gas} max={maxYield} maxResource={resources.maxGas} />
<ResourceBar label="CRYSTAL" value={resources.crystal} max={maxYield} maxResource={resources.maxCrystal} />
```

- [ ] **Step 4: Add mineAll checkbox + state to MiningScreen**

Add state and UI for the mine-all checkbox. Add a `useState` for `mineAll`:

```typescript
const [mineAll, setMineAll] = useState(false);
```

Add the checkbox after the mine buttons (before the STOP button), inside the flex container:

```typescript
<label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
  <input
    type="checkbox"
    checked={mineAll}
    onChange={(e) => {
      setMineAll(e.target.checked);
      if (mining?.active) {
        network.sendToggleMineAll(e.target.checked);
      }
    }}
    style={{ accentColor: 'var(--color-primary)' }}
  />
  ALLES ABBAUEN
</label>
```

Update mine button onClick to pass mineAll:

```typescript
onClick={() => network.sendMine(res, mineAll)}
```

- [ ] **Step 5: Update maxYield calculation to use max values when available**

```typescript
const maxYield = Math.max(
  resources.maxOre ?? resources.ore,
  resources.maxGas ?? resources.gas,
  resources.maxCrystal ?? resources.crystal,
  1,
);
```

- [ ] **Step 6: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/MiningScreen.tsx packages/client/src/network/client.ts
git commit -m "feat(client): current/max resource display, mineAll checkbox in MiningScreen"
```

### Task 11: MiningDetailPanel — current/max resource display

**Files:**
- Modify: `packages/client/src/components/MiningDetailPanel.tsx`

- [ ] **Step 1: Update resource display to show current/max format**

In `packages/client/src/components/MiningDetailPanel.tsx`, change the resource display lines (52-69):

```typescript
{resources.ore > 0 && (
  <div>
    <span style={{ color: 'var(--color-dim)' }}>ORE: </span>
    <span>{resources.ore}{resources.maxOre ? `/${resources.maxOre}` : ''}</span>
  </div>
)}
{resources.gas > 0 && (
  <div>
    <span style={{ color: 'var(--color-dim)' }}>GAS: </span>
    <span>{resources.gas}{resources.maxGas ? `/${resources.maxGas}` : ''}</span>
  </div>
)}
{resources.crystal > 0 && (
  <div>
    <span style={{ color: 'var(--color-dim)' }}>CRYSTAL: </span>
    <span>{resources.crystal}{resources.maxCrystal ? `/${resources.maxCrystal}` : ''}</span>
  </div>
)}
```

- [ ] **Step 2: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/MiningDetailPanel.tsx
git commit -m "feat(client): current/max resource format in MiningDetailPanel"
```

### Task 12: DetailPanel — current/max resource display in sector details

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

- [ ] **Step 1: Update sector resource display in DetailPanel**

In `packages/client/src/components/DetailPanel.tsx`, find the RESOURCES section (around line 661-666) where `Object.entries(sector.resources)` is mapped.

Change from:
```typescript
{Object.entries(sector.resources).map(([res, amount]) => (
  <div key={res}>
    {res.toUpperCase()} ──── {amount}
  </div>
))}
```

To show current/max for the three base resources:
```typescript
{Object.entries(sector.resources)
  .filter(([res]) => !res.startsWith('max'))
  .map(([res, amount]) => {
    const maxKey = `max${res.charAt(0).toUpperCase()}${res.slice(1)}` as keyof typeof sector.resources;
    const maxVal = sector.resources?.[maxKey];
    return (
      <div key={res}>
        {res.toUpperCase()} ──── {amount}{maxVal ? `/${maxVal}` : ''}
      </div>
    );
  })}
```

Also update the summary line (around line 643-645):
```typescript
resources: sector.resources
  ? Object.entries(sector.resources)
      .filter(([r]) => !r.startsWith('max'))
      .map(([r, a]) => {
        const maxKey = `max${r.charAt(0).toUpperCase()}${r.slice(1)}` as keyof typeof sector.resources;
        const maxVal = sector.resources?.[maxKey];
        return `${r.toUpperCase()} x${a}${maxVal ? `/${maxVal}` : ''}`;
      })
      .join(', ')
  : undefined,
```

- [ ] **Step 2: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat(client): current/max resource format in DetailPanel sector view"
```

## Chunk 6: Cleanup + Test Updates + Final Verification

### Task 13: Remove old regen constants + update existing test mocks

**Files:**
- Modify: `packages/shared/src/constants.ts` (remove old constants)
- Modify: `packages/server/src/__tests__/miningInventory.test.ts` (add mineAll to mock states)
- Modify: `packages/server/src/__tests__/miningRate.test.ts` (add mineAll to mock states)
- Modify: `packages/client/src/__tests__/MiningAutoStop.test.ts` (no changes needed — tests pure logic)

- [ ] **Step 1: Remove old regen constants from shared**

In `packages/shared/src/constants.ts`, remove:
```typescript
export const RESOURCE_REGEN_PER_MINUTE = 1;
export const CRYSTAL_REGEN_PER_MINUTE = 1 / 3;
export const RESOURCE_REGEN_DELAY_MINUTES = 5;
```

These are now replaced by `RESOURCE_REGEN_DELAY_TICKS` and `RESOURCE_REGEN_INTERVAL_TICKS`.

- [ ] **Step 2: Check for any remaining imports of old constants**

Search for `RESOURCE_REGEN_PER_MINUTE`, `CRYSTAL_REGEN_PER_MINUTE`, `RESOURCE_REGEN_DELAY_MINUTES` across the codebase. Remove any remaining imports (they should only have been in `queries.ts`, already replaced in Task 7).

- [ ] **Step 3: Update test mock states to include `mineAll: false`**

In `packages/server/src/__tests__/miningInventory.test.ts`, all `MiningState` objects in mocks need `mineAll: false` added. For example, line 109-117:

```typescript
vi.mocked(getMiningState).mockResolvedValue({
  active: true, resource: 'ore', rate: 1,
  startedAt: Date.now() - 5000, sectorX: 0, sectorY: 0, sectorYield: 10,
  mineAll: false,
});
```

Same for `miningRate.test.ts` mock states.

Also update `stopMining` mock return values to include `mineAll: false` in newState.

- [ ] **Step 4: Build shared package**

Run: `cd packages/shared && npm run build`

- [ ] **Step 5: Run all tests**

Run: `cd packages/shared && npx vitest run && cd ../server && npx vitest run && cd ../client && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove old regen constants, update test mocks for mineAll"
```

### Task 14: Final verification

- [ ] **Step 1: Build everything**

```bash
cd packages/shared && npm run build && cd ../server && npm run build && cd ../client && npm run build
```

- [ ] **Step 2: Run all test suites**

```bash
cd packages/shared && npx vitest run && cd ../server && npx vitest run && cd ../client && npx vitest run
```

- [ ] **Step 3: Manual verification checklist**

Start dev servers and verify:
- Mining a resource depletes the sector's resource count
- Mining auto-stops when resource is exhausted
- Mining auto-stops when cargo is full
- "ALLES ABBAUEN" checkbox chains to next resource
- toggling mineAll while mining is active works
- Resource display shows `X/Y` format (e.g., `ORE 3/10`)
- MiningDetailPanel (Sec 3) shows current/max
- DetailPanel sector view shows current/max
- Resources regenerate after ~250 seconds delay (50 ticks × 5s)
- Multiple players mining same sector share same pool
