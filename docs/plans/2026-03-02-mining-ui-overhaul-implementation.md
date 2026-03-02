# Mining, Cargo & UI Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken navigation, improve UI readability with 4-tab monitor bar, add idle mining with 3 resource types (ore/gas/crystal), add cargo system with jettison, and add unit tests for all server room commands.

**Architecture:** Hybrid Redis+PostgreSQL — active mining timer in Redis (lazy evaluation like AP), persistent cargo in PostgreSQL. Extends existing SectorRoom with new message handlers. Client gets two new monitor screens (MINING, CARGO) selectable via improved bottom bar.

**Tech Stack:** Colyseus 0.15, React 18, Zustand, Vitest, PostgreSQL, Redis, Canvas, TypeScript

**Reference:** See `docs/plans/2026-03-02-mining-ui-overhaul-design.md` for the approved design.

**Important Colyseus CJS/ESM notes:**
- `colyseus` must be imported as `import colyseus from 'colyseus'; const { Room, ServerError } = colyseus;`
- `@colyseus/schema` uses `defineTypes()` instead of `@type()` decorators (tsx/esbuild limitation)
- `@colyseus/tools` requires `const config = (toolsPkg as any).default ?? toolsPkg;`

---

## Task 1: Fix Navigation Bug

**Problem:** After login, `setScreen('game')` runs before `network.joinSector(0, 0)` completes. If the WebSocket room join fails, `sectorRoom` stays `null` and all buttons silently do nothing.

**Files:**
- Modify: `packages/client/src/components/LoginScreen.tsx:34-36`
- Modify: `packages/client/src/network/client.ts:126-145`

**Step 1: Fix login flow ordering in LoginScreen.tsx**

In `packages/client/src/components/LoginScreen.tsx`, change the `handleSubmit` function so `joinSector` succeeds **before** switching screens:

```typescript
// OLD (lines 34-36):
setAuth(data.token, data.player.id, data.player.username);
setScreen('game');
await network.joinSector(0, 0);

// NEW:
setAuth(data.token, data.player.id, data.player.username);
await network.joinSector(0, 0);
setScreen('game');
```

Also update the catch block to give a more specific error:

```typescript
} catch (err) {
  setError(err instanceof Error ? err.message : 'Connection failed');
}
```

**Step 2: Add feedback when room not connected**

In `packages/client/src/network/client.ts`, update `sendJump`, `sendScan`, and `requestAP` to log when disconnected:

```typescript
sendJump(targetX: number, targetY: number) {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  useStore.getState().setJumpPending(true);
  this.sectorRoom.send('jump', { targetX, targetY });
}

sendScan() {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('scan', {});
}

requestAP() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getAP', {});
}
```

**Step 3: Add reconnect on disconnect**

In `packages/client/src/network/client.ts`, update the `onLeave` handler in `setupRoomListeners`:

```typescript
room.onLeave(async (code) => {
  if (code > 1000) {
    useStore.getState().addLogEntry(`Disconnected (code: ${code}) — reconnecting...`);
    const store = useStore.getState();
    try {
      await this.joinSector(store.position.x, store.position.y);
      useStore.getState().addLogEntry('Reconnected');
    } catch {
      useStore.getState().addLogEntry('Reconnect failed');
    }
  }
});
```

**Step 4: Verify manually**

Run: `npm run dev:server` and `npm run dev:client`
1. Open http://localhost:3000
2. Login with existing credentials
3. Click direction buttons — they should work
4. Check Event Log for "Entered sector (0, 0)"

**Step 5: Commit**

```bash
git add packages/client/src/components/LoginScreen.tsx packages/client/src/network/client.ts
git commit -m "fix: fix navigation by ensuring room join before screen switch"
```

---

## Task 2: Extend Shared Types for Mining & Cargo

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/__tests__/constants.test.ts`

**Step 1: Add types to `packages/shared/src/types.ts`**

Add after the existing types:

```typescript
export type ResourceType = 'ore' | 'gas' | 'crystal';

export interface SectorResources {
  ore: number;
  gas: number;
  crystal: number;
}

export interface MiningState {
  active: boolean;
  resource: ResourceType | null;
  sectorX: number;
  sectorY: number;
  startedAt: number | null;   // Unix timestamp ms
  rate: number;               // units per second
  sectorYield: number;        // max minable for this resource in this sector
}

export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
}

// New messages
export interface MineMessage {
  resource: ResourceType;
}

export interface JettisonMessage {
  resource: ResourceType;
}
```

Extend `SectorData` to include resources:

```typescript
export interface SectorData {
  x: number;
  y: number;
  type: SectorType;
  seed: number;
  discoveredBy: string | null;
  discoveredAt: string | null;
  metadata: Record<string, unknown>;
  resources: SectorResources;  // ADD THIS
}
```

**Step 2: Add constants to `packages/shared/src/constants.ts`**

Add resource-related constants:

```typescript
import type { SectorType, ShipClass, ResourceType } from './types.js';

// Sector resource yields by type (base values, varied ±30% by seed)
export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<ResourceType, number>> = {
  empty:          { ore: 5,  gas: 5,  crystal: 5  },
  nebula:         { ore: 2,  gas: 20, crystal: 3  },
  asteroid_field: { ore: 20, gas: 2,  crystal: 3  },
  anomaly:        { ore: 3,  gas: 3,  crystal: 20 },
  station:        { ore: 0,  gas: 0,  crystal: 0  },
  pirate:         { ore: 8,  gas: 3,  crystal: 8  },
};

export const MINING_RATE_PER_SECOND = 0.1;  // base mining rate

export const AP_COSTS = {
  jump: 1,
  scan: 3,
  mine: 0,  // mining is free, it's idle
};

export const RESOURCE_TYPES: ResourceType[] = ['ore', 'gas', 'crystal'];
```

Add MINING and CARGO to the `MONITORS` constant:

```typescript
export const MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
} as const;
```

Remove the post-MVP monitors (BASE_LINK, MKT_NET, COMM_DL) since they don't exist yet.

**Step 3: Update constants test**

In `packages/shared/src/__tests__/constants.test.ts`, add:

```typescript
import { SECTOR_RESOURCE_YIELDS, SECTOR_TYPES, RESOURCE_TYPES } from '../constants';

it('every sector type has resource yields', () => {
  for (const type of SECTOR_TYPES) {
    const yields = SECTOR_RESOURCE_YIELDS[type];
    expect(yields).toBeDefined();
    for (const res of RESOURCE_TYPES) {
      expect(typeof yields[res]).toBe('number');
      expect(yields[res]).toBeGreaterThanOrEqual(0);
    }
  }
});

it('station sectors have zero resources', () => {
  const station = SECTOR_RESOURCE_YIELDS.station;
  expect(station.ore + station.gas + station.crystal).toBe(0);
});
```

**Step 4: Run tests**

Run: `npm test -w packages/shared`
Expected: All tests pass

**Step 5: Build shared package**

Run: `npm run build -w packages/shared`
Expected: No errors

**Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/__tests__/constants.test.ts
git commit -m "feat: add mining, cargo, and resource types to shared package"
```

---

## Task 3: Extend World Generation for Sector Resources

**Files:**
- Modify: `packages/server/src/engine/worldgen.ts`
- Modify: `packages/server/src/engine/__tests__/worldgen.test.ts`

**Step 1: Write the failing test**

Add to `packages/server/src/engine/__tests__/worldgen.test.ts`:

```typescript
import { RESOURCE_TYPES } from '@void-sector/shared';

it('generateSector includes resource yields', () => {
  const sector = generateSector(10, -5, null);
  expect(sector.resources).toBeDefined();
  for (const res of RESOURCE_TYPES) {
    expect(typeof sector.resources[res]).toBe('number');
    expect(sector.resources[res]).toBeGreaterThanOrEqual(0);
  }
});

it('resource yields vary by seed (±30% of base)', () => {
  // Generate many sectors and check range
  const yields: number[] = [];
  for (let i = 0; i < 100; i++) {
    const s = generateSector(i, 0, null);
    yields.push(s.resources.ore);
  }
  // Should not all be identical (seed variation)
  const unique = new Set(yields);
  expect(unique.size).toBeGreaterThan(1);
});

it('station sectors have zero resources', () => {
  // Find a station sector by brute force
  for (let i = 0; i < 10000; i++) {
    const s = generateSector(i, i * 17, null);
    if (s.type === 'station') {
      expect(s.resources.ore).toBe(0);
      expect(s.resources.gas).toBe(0);
      expect(s.resources.crystal).toBe(0);
      return;
    }
  }
  // If no station found in 10000 tries, skip (very unlikely)
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -w packages/server -- --run src/engine/__tests__/worldgen.test.ts`
Expected: FAIL — `sector.resources` is undefined

**Step 3: Implement resource generation**

In `packages/server/src/engine/worldgen.ts`, update `generateSector`:

```typescript
import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED, SECTOR_RESOURCE_YIELDS } from '@void-sector/shared';
import type { SectorData, SectorType, SectorResources, ResourceType } from '@void-sector/shared';

function generateResources(type: SectorType, seed: number): SectorResources {
  const base = SECTOR_RESOURCE_YIELDS[type];
  const resources: SectorResources = { ore: 0, gas: 0, crystal: 0 };
  const types: ResourceType[] = ['ore', 'gas', 'crystal'];
  for (let i = 0; i < types.length; i++) {
    const res = types[i];
    if (base[res] === 0) continue;
    // Use seed bits to vary ±30%
    const variation = ((seed >>> (i * 8)) & 0xFF) / 255; // 0..1
    const factor = 0.7 + variation * 0.6; // 0.7..1.3
    resources[res] = Math.round(base[res] * factor);
  }
  return resources;
}

export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);
  const type = sectorTypeFromSeed(seed);

  return {
    x,
    y,
    type,
    seed,
    discoveredBy,
    discoveredAt: null,
    metadata: {},
    resources: generateResources(type, seed),
  };
}
```

**Step 4: Run tests**

Run: `npm test -w packages/server -- --run src/engine/__tests__/worldgen.test.ts`
Expected: All pass

**Step 5: Commit**

```bash
git add packages/server/src/engine/worldgen.ts packages/server/src/engine/__tests__/worldgen.test.ts
git commit -m "feat: add seed-based resource yields to sector generation"
```

---

## Task 4: Mining Engine with Lazy Evaluation

**Files:**
- Create: `packages/server/src/engine/mining.ts`
- Create: `packages/server/src/engine/__tests__/mining.test.ts`

**Step 1: Write the tests first**

Create `packages/server/src/engine/__tests__/mining.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  createMiningState,
  calculateMinedAmount,
  startMining,
  stopMining,
} from '../mining.js';

describe('mining engine', () => {
  it('createMiningState returns inactive state', () => {
    const state = createMiningState();
    expect(state.active).toBe(false);
    expect(state.resource).toBeNull();
  });

  it('startMining activates mining', () => {
    const now = Date.now();
    const state = startMining('ore', 3, 5, 20, now);
    expect(state.active).toBe(true);
    expect(state.resource).toBe('ore');
    expect(state.sectorX).toBe(3);
    expect(state.sectorY).toBe(5);
    expect(state.startedAt).toBe(now);
    expect(state.rate).toBeGreaterThan(0);
    expect(state.sectorYield).toBe(20);
  });

  it('calculateMinedAmount returns correct amount based on elapsed time', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 20, now - 10_000); // started 10s ago
    const mined = calculateMinedAmount(state, 50, now); // 50 cargo space
    // rate = MINING_RATE_PER_SECOND (0.1), 10s => 1 unit
    expect(mined).toBe(1);
  });

  it('calculateMinedAmount caps at sectorYield', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 2, now - 1_000_000); // long time ago, yield=2
    const mined = calculateMinedAmount(state, 50, now);
    expect(mined).toBe(2); // capped at sectorYield
  });

  it('calculateMinedAmount caps at cargo space', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 100, now - 1_000_000); // long time, high yield
    const mined = calculateMinedAmount(state, 3, now); // only 3 cargo space
    expect(mined).toBe(3);
  });

  it('calculateMinedAmount returns 0 when not active', () => {
    const state = createMiningState();
    expect(calculateMinedAmount(state, 50)).toBe(0);
  });

  it('stopMining returns mined amount and resets state', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 20, now - 10_000);
    const result = stopMining(state, 50, now);
    expect(result.mined).toBe(1);
    expect(result.resource).toBe('ore');
    expect(result.newState.active).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -w packages/server -- --run src/engine/__tests__/mining.test.ts`
Expected: FAIL — module not found

**Step 3: Implement mining engine**

Create `packages/server/src/engine/mining.ts`:

```typescript
import { MINING_RATE_PER_SECOND } from '@void-sector/shared';
import type { MiningState, ResourceType } from '@void-sector/shared';

export function createMiningState(): MiningState {
  return {
    active: false,
    resource: null,
    sectorX: 0,
    sectorY: 0,
    startedAt: null,
    rate: 0,
    sectorYield: 0,
  };
}

export function startMining(
  resource: ResourceType,
  sectorX: number,
  sectorY: number,
  sectorYield: number,
  now: number = Date.now(),
): MiningState {
  return {
    active: true,
    resource,
    sectorX,
    sectorY,
    startedAt: now,
    rate: MINING_RATE_PER_SECOND,
    sectorYield,
  };
}

export function calculateMinedAmount(
  state: MiningState,
  cargoSpace: number,
  now: number = Date.now(),
): number {
  if (!state.active || !state.startedAt) return 0;
  const elapsed = (now - state.startedAt) / 1000;
  if (elapsed <= 0) return 0;
  const raw = elapsed * state.rate;
  return Math.floor(Math.min(raw, state.sectorYield, cargoSpace));
}

export function stopMining(
  state: MiningState,
  cargoSpace: number,
  now: number = Date.now(),
): { mined: number; resource: ResourceType | null; newState: MiningState } {
  const mined = calculateMinedAmount(state, cargoSpace, now);
  return {
    mined,
    resource: state.resource,
    newState: createMiningState(),
  };
}
```

**Step 4: Run tests**

Run: `npm test -w packages/server -- --run src/engine/__tests__/mining.test.ts`
Expected: All pass

**Step 5: Commit**

```bash
git add packages/server/src/engine/mining.ts packages/server/src/engine/__tests__/mining.test.ts
git commit -m "feat: add mining engine with lazy evaluation and tests"
```

---

## Task 5: Database Migration for Cargo Table

**Files:**
- Create: `packages/server/src/db/migrations/002_cargo.sql`
- Modify: `packages/server/src/db/queries.ts` (add cargo queries)

**Step 1: Create migration**

Create `packages/server/src/db/migrations/002_cargo.sql`:

```sql
CREATE TABLE IF NOT EXISTS cargo (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  resource VARCHAR(16) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_cargo_player ON cargo(player_id);
```

**Step 2: Add cargo queries to `packages/server/src/db/queries.ts`**

Add the following functions at the end of the file:

```typescript
import type { SectorData, PlayerData, CargoState, ResourceType } from '@void-sector/shared';

export async function getPlayerCargo(playerId: string): Promise<CargoState> {
  const result = await query<{ resource: string; quantity: number }>(
    'SELECT resource, quantity FROM cargo WHERE player_id = $1',
    [playerId]
  );
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0 };
  for (const row of result.rows) {
    if (row.resource in cargo) {
      cargo[row.resource as ResourceType] = row.quantity;
    }
  }
  return cargo;
}

export async function addToCargo(
  playerId: string,
  resource: ResourceType,
  amount: number,
): Promise<void> {
  await query(
    `INSERT INTO cargo (player_id, resource, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, resource)
     DO UPDATE SET quantity = cargo.quantity + $3`,
    [playerId, resource, amount]
  );
}

export async function jettisonCargo(
  playerId: string,
  resource: ResourceType,
): Promise<number> {
  const result = await query<{ quantity: number }>(
    `DELETE FROM cargo WHERE player_id = $1 AND resource = $2 RETURNING quantity`,
    [playerId, resource]
  );
  return result.rows.length > 0 ? result.rows[0].quantity : 0;
}

export async function getCargoTotal(playerId: string): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM cargo WHERE player_id = $1',
    [playerId]
  );
  return Number(result.rows[0].total);
}
```

**Step 3: Run migration**

Run: `npx tsx packages/server/src/db/run-migrations.ts`
Expected: "Migration applied: 002_cargo.sql"

**Step 4: Commit**

```bash
git add packages/server/src/db/migrations/002_cargo.sql packages/server/src/db/queries.ts
git commit -m "feat: add cargo table migration and query functions"
```

---

## Task 6: Redis Mining Store

**Files:**
- Modify: `packages/server/src/rooms/services/RedisAPStore.ts` (add mining state functions)

**Step 1: Add mining state functions**

Add to `packages/server/src/rooms/services/RedisAPStore.ts`:

```typescript
import type { APState, MiningState } from '@void-sector/shared';
import { createAPState } from '../../engine/ap.js';
import { createMiningState } from '../../engine/mining.js';

const MINING_PREFIX = 'player:mining:';

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
  };
}

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
  });
}
```

**Step 2: Commit**

```bash
git add packages/server/src/rooms/services/RedisAPStore.ts
git commit -m "feat: add Redis mining state store"
```

---

## Task 7: Extend SectorRoom with Mining & Cargo Handlers

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add imports**

At the top of `packages/server/src/rooms/SectorRoom.ts`, add:

```typescript
import { startMining, stopMining, calculateMinedAmount } from '../engine/mining.js';
import { getMiningState, saveMiningState } from './services/RedisAPStore.js';
import { getPlayerCargo, addToCargo, jettisonCargo, getCargoTotal } from '../db/queries.js';
import type { MineMessage, JettisonMessage, ResourceType, CargoState } from '@void-sector/shared';
```

**Step 2: Register new message handlers in `onCreate`**

Add inside the `onCreate` method, after the existing `getDiscoveries` handler:

```typescript
// Handle mine start
this.onMessage('mine', async (client, data: MineMessage) => {
  await this.handleMine(client, data);
});

// Handle mine stop
this.onMessage('stopMine', async (client) => {
  await this.handleStopMine(client);
});

// Handle jettison
this.onMessage('jettison', async (client, data: JettisonMessage) => {
  await this.handleJettison(client, data);
});

// Handle cargo query
this.onMessage('getCargo', async (client) => {
  const auth = client.auth as AuthPayload;
  const cargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', cargo);
});

// Handle mining status query
this.onMessage('getMiningStatus', async (client) => {
  const auth = client.auth as AuthPayload;
  const mining = await getMiningState(auth.userId);
  client.send('miningUpdate', mining);
});
```

**Step 3: Add handler methods**

Add these private methods to the `SectorRoom` class:

```typescript
private async handleMine(client: Client, data: MineMessage) {
  const auth = client.auth as AuthPayload;
  const { resource } = data;

  // Validate resource type
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    client.send('error', { code: 'INVALID_RESOURCE', message: 'Invalid resource type' });
    return;
  }

  // Check if already mining
  const current = await getMiningState(auth.userId);
  if (current.active) {
    client.send('error', { code: 'ALREADY_MINING', message: 'Already mining — stop first' });
    return;
  }

  // Get sector resource yield
  const sectorData = await getSector(this.state.sector.x, this.state.sector.y);
  if (!sectorData || !sectorData.resources) {
    client.send('error', { code: 'NO_RESOURCES', message: 'No resources in this sector' });
    return;
  }

  const sectorYield = sectorData.resources[resource];
  if (sectorYield <= 0) {
    client.send('error', { code: 'NO_RESOURCE', message: `No ${resource} in this sector` });
    return;
  }

  // Check cargo space
  const cargoTotal = await getCargoTotal(auth.userId);
  const ship = SHIP_CLASSES.aegis_scout_mk1; // MVP: default ship
  if (cargoTotal >= ship.cargoCap) {
    client.send('error', { code: 'CARGO_FULL', message: 'Cargo hold is full' });
    return;
  }

  // Start mining
  const state = startMining(
    resource,
    this.state.sector.x,
    this.state.sector.y,
    sectorYield,
  );
  await saveMiningState(auth.userId, state);
  client.send('miningUpdate', state);
  useStore is server-side, just send message
}

private async handleStopMine(client: Client) {
  const auth = client.auth as AuthPayload;

  const mining = await getMiningState(auth.userId);
  if (!mining.active) {
    client.send('error', { code: 'NOT_MINING', message: 'Not currently mining' });
    return;
  }

  // Calculate mined amount
  const cargoTotal = await getCargoTotal(auth.userId);
  const ship = SHIP_CLASSES.aegis_scout_mk1;
  const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
  const result = stopMining(mining, cargoSpace);

  // Save to cargo DB
  if (result.mined > 0 && result.resource) {
    await addToCargo(auth.userId, result.resource, result.mined);
  }

  // Clear mining state from Redis
  await saveMiningState(auth.userId, result.newState);

  // Send updates
  const cargo = await getPlayerCargo(auth.userId);
  client.send('miningUpdate', result.newState);
  client.send('cargoUpdate', cargo);
}

private async handleJettison(client: Client, data: JettisonMessage) {
  const auth = client.auth as AuthPayload;
  const { resource } = data;

  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    client.send('error', { code: 'INVALID_RESOURCE', message: 'Invalid resource type' });
    return;
  }

  const jettisoned = await jettisonCargo(auth.userId, resource);
  if (jettisoned === 0) {
    client.send('error', { code: 'EMPTY', message: `No ${resource} to jettison` });
    return;
  }

  const cargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', cargo);
}
```

**Step 4: Auto-stop mining on leave**

In the `onLeave` method, before the player is removed, stop any active mining:

```typescript
async onLeave(client: Client, consented: boolean) {
  const player = this.state.players.get(client.sessionId);
  if (player) player.connected = false;

  // Auto-stop mining when leaving
  const auth = client.auth as AuthPayload;
  const mining = await getMiningState(auth.userId);
  if (mining.active) {
    const cargoTotal = await getCargoTotal(auth.userId);
    const ship = SHIP_CLASSES.aegis_scout_mk1;
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    const result = stopMining(mining, cargoSpace);
    if (result.mined > 0 && result.resource) {
      await addToCargo(auth.userId, result.resource, result.mined);
    }
    await saveMiningState(auth.userId, result.newState);
  }

  if (!consented) {
    // ... existing reconnection logic ...
  }
  // ... rest of existing onLeave ...
}
```

**Step 5: Send initial cargo and mining state on join**

In `onJoin`, after sending AP state, add:

```typescript
// Send initial cargo
const cargo = await getPlayerCargo(auth.userId);
client.send('cargoUpdate', cargo);

// Send mining state
const mining = await getMiningState(auth.userId);
client.send('miningUpdate', mining);
```

**Step 6: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: add mining, cargo, and jettison handlers to SectorRoom"
```

---

## Task 8: Fix Worldgen — Store Resources in Sectors Table

The `sectors` table currently stores metadata as JSONB. We'll store resources in the `metadata` field and update `getSector`/`saveSector` to include resources.

**Files:**
- Modify: `packages/server/src/db/queries.ts` (update getSector/saveSector)

**Step 1: Update `saveSector` to include resources in metadata**

```typescript
export async function saveSector(sector: SectorData): Promise<void> {
  await query(
    `INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (x, y) DO NOTHING`,
    [
      sector.x,
      sector.y,
      sector.type,
      sector.seed,
      sector.discoveredBy,
      JSON.stringify({ resources: sector.resources }),
    ]
  );
}
```

**Step 2: Update `getSector` to read resources from metadata**

```typescript
export async function getSector(
  x: number,
  y: number
): Promise<SectorData | null> {
  const result = await query<{
    x: number;
    y: number;
    type: string;
    seed: number;
    discovered_by: string | null;
    discovered_at: string | null;
    metadata: Record<string, unknown>;
  }>(
    'SELECT x, y, type, seed, discovered_by, discovered_at, metadata FROM sectors WHERE x = $1 AND y = $2',
    [x, y]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const meta = row.metadata || {};
  const resources = (meta.resources as SectorData['resources']) || { ore: 0, gas: 0, crystal: 0 };
  return {
    x: row.x,
    y: row.y,
    type: row.type as SectorData['type'],
    seed: row.seed,
    discoveredBy: row.discovered_by,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
    resources,
  };
}
```

**Step 3: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat: store and retrieve sector resources via metadata JSONB"
```

---

## Task 9: Unit Tests for Room Commands

Test the core handler logic by extracting it into testable functions.

**Files:**
- Create: `packages/server/src/engine/commands.ts`
- Create: `packages/server/src/engine/__tests__/commands.test.ts`

**Step 1: Create `packages/server/src/engine/commands.ts`**

Extract the pure validation/logic from SectorRoom handlers:

```typescript
import type { APState, MiningState, ResourceType, SectorResources } from '@void-sector/shared';
import { spendAP, calculateCurrentAP } from './ap.js';
import { calculateMinedAmount, startMining, stopMining, createMiningState } from './mining.js';

export interface JumpValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
}

export function validateJump(
  ap: APState,
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  jumpRange: number,
  apCost: number,
): JumpValidation {
  const dx = Math.abs(targetX - currentX);
  const dy = Math.abs(targetY - currentY);
  if (dx > jumpRange || dy > jumpRange || (dx === 0 && dy === 0)) {
    return { valid: false, error: 'Target out of range' };
  }
  const newAP = spendAP(ap, apCost);
  if (!newAP) return { valid: false, error: 'Not enough AP' };
  return { valid: true, newAP };
}

export interface ScanValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
}

export function validateScan(ap: APState, apCost: number): ScanValidation {
  const newAP = spendAP(ap, apCost);
  if (!newAP) return { valid: false, error: 'Not enough AP to scan' };
  return { valid: true, newAP };
}

export interface MineValidation {
  valid: boolean;
  error?: string;
  state?: MiningState;
}

export function validateMine(
  resource: ResourceType,
  sectorResources: SectorResources,
  currentMining: MiningState,
  cargoTotal: number,
  cargoCap: number,
  sectorX: number,
  sectorY: number,
): MineValidation {
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    return { valid: false, error: 'Invalid resource type' };
  }
  if (currentMining.active) {
    return { valid: false, error: 'Already mining — stop first' };
  }
  if (sectorResources[resource] <= 0) {
    return { valid: false, error: `No ${resource} in this sector` };
  }
  if (cargoTotal >= cargoCap) {
    return { valid: false, error: 'Cargo hold is full' };
  }
  const state = startMining(resource, sectorX, sectorY, sectorResources[resource]);
  return { valid: true, state };
}

export interface JettisonValidation {
  valid: boolean;
  error?: string;
}

export function validateJettison(resource: ResourceType, currentAmount: number): JettisonValidation {
  if (!['ore', 'gas', 'crystal'].includes(resource)) {
    return { valid: false, error: 'Invalid resource type' };
  }
  if (currentAmount <= 0) {
    return { valid: false, error: `No ${resource} to jettison` };
  }
  return { valid: true };
}
```

**Step 2: Write comprehensive tests**

Create `packages/server/src/engine/__tests__/commands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateJump, validateScan, validateMine, validateJettison } from '../commands.js';
import { createAPState } from '../ap.js';
import { createMiningState } from '../mining.js';
import { AP_COSTS } from '@void-sector/shared';

describe('validateJump', () => {
  const fullAP = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };

  it('valid jump within range', () => {
    const result = validateJump(fullAP, 0, 0, 1, 0, 4, AP_COSTS.jump);
    expect(result.valid).toBe(true);
    expect(result.newAP).toBeDefined();
    expect(result.newAP!.current).toBe(100 - AP_COSTS.jump);
  });

  it('rejects jump to same position', () => {
    const result = validateJump(fullAP, 5, 5, 5, 5, 4, AP_COSTS.jump);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('range');
  });

  it('rejects jump beyond range', () => {
    const result = validateJump(fullAP, 0, 0, 10, 0, 4, AP_COSTS.jump);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('range');
  });

  it('rejects jump with insufficient AP', () => {
    const lowAP = { ...fullAP, current: 0 };
    const result = validateJump(lowAP, 0, 0, 1, 0, 4, AP_COSTS.jump);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });
});

describe('validateScan', () => {
  it('valid scan with enough AP', () => {
    const ap = { current: 10, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateScan(ap, AP_COSTS.scan);
    expect(result.valid).toBe(true);
    expect(result.newAP!.current).toBe(10 - AP_COSTS.scan);
  });

  it('rejects scan with insufficient AP', () => {
    const ap = { current: 1, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateScan(ap, AP_COSTS.scan);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });
});

describe('validateMine', () => {
  const resources = { ore: 20, gas: 5, crystal: 0 };
  const inactive = createMiningState();

  it('valid mine start', () => {
    const result = validateMine('ore', resources, inactive, 0, 50, 3, -2);
    expect(result.valid).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state!.active).toBe(true);
    expect(result.state!.resource).toBe('ore');
  });

  it('rejects mining when already active', () => {
    const active = { ...inactive, active: true, resource: 'gas' as const };
    const result = validateMine('ore', resources, active, 0, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Already mining');
  });

  it('rejects mining unavailable resource', () => {
    const result = validateMine('crystal', resources, inactive, 0, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('crystal');
  });

  it('rejects mining when cargo full', () => {
    const result = validateMine('ore', resources, inactive, 50, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('full');
  });

  it('rejects invalid resource type', () => {
    const result = validateMine('unobtanium' as any, resources, inactive, 0, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid');
  });
});

describe('validateJettison', () => {
  it('valid jettison', () => {
    const result = validateJettison('ore', 10);
    expect(result.valid).toBe(true);
  });

  it('rejects jettison of empty resource', () => {
    const result = validateJettison('ore', 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No ore');
  });

  it('rejects invalid resource type', () => {
    const result = validateJettison('unobtanium' as any, 10);
    expect(result.valid).toBe(false);
  });
});
```

**Step 3: Run tests**

Run: `npm test -w packages/server -- --run src/engine/__tests__/commands.test.ts`
Expected: All pass

**Step 4: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/commands.test.ts
git commit -m "feat: add testable command validators with comprehensive tests"
```

---

## Task 10: UI Overhaul — Readability & Bottom Bar

**Files:**
- Modify: `packages/client/src/styles/global.css`
- Modify: `packages/client/src/styles/crt.css`
- Modify: `packages/client/src/components/GameScreen.tsx`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Increase font sizes in `global.css`**

Update the following values:

```css
/* Update .vs-btn */
.vs-btn {
  padding: 8px 14px;
  font-size: 0.9rem;
  border: 2px solid var(--color-primary);
}
```

**Step 2: Increase radar sizes in `RadarRenderer.ts`**

Update the constants at the top of the file:

```typescript
const CELL_W = 80;       // was 72
const CELL_H = 64;       // was 56
const FONT_SIZE = 16;    // was 14
const COORD_FONT_SIZE = 10; // was 8
```

Update the grid line width:

```typescript
// Cell border — find the line with lineWidth = 0.5 and change to:
ctx.lineWidth = 1.0;
```

**Step 3: Update bottom bar in `GameScreen.tsx`**

Replace the bottom bar section with the new 4-tab design using inverted active style:

```typescript
import { MONITORS } from '@void-sector/shared';

// In GameScreen component, replace the bottom bar div:
<div style={{
  display: 'flex',
  gap: '2px',
  padding: '4px',
  background: '#111',
  borderTop: '2px solid #2a2a2a',
}}>
  {[MONITORS.NAV_COM, MONITORS.SHIP_SYS, MONITORS.MINING, MONITORS.CARGO].map((id) => (
    <button
      key={id}
      className="vs-btn"
      style={{
        flex: 1,
        fontSize: '0.85rem',
        padding: '8px 4px',
        border: '2px solid var(--color-primary)',
        background: activeMonitor === id ? 'var(--color-primary)' : 'transparent',
        color: activeMonitor === id ? '#050505' : 'var(--color-primary)',
      }}
      onClick={() => setActiveMonitor(id)}
    >
      [{id}]
    </button>
  ))}
</div>
```

**Step 4: Update NavComScreen header font**

```typescript
// In NavComScreen, update header padding/size:
<div style={{ padding: '6px 12px', fontSize: '0.85rem', letterSpacing: '0.2em', opacity: 0.6 }}>
```

**Step 5: Verify visually**

Run: `npm run dev:client`
1. Check that tabs show NAV-COM, SHIP-SYS, MINING, CARGO
2. Check active tab is amber background with black text
3. Check inactive tabs are black background with amber text
4. Verify radar grid lines are thicker
5. Verify text is more readable

**Step 6: Commit**

```bash
git add packages/client/src/styles/global.css packages/client/src/styles/crt.css packages/client/src/components/GameScreen.tsx packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat: improve UI readability and add 4-tab monitor bottom bar"
```

---

## Task 11: Client State — Mining & Cargo Slices

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`

**Step 1: Add mining and cargo state**

Add to the `GameSlice` interface:

```typescript
import type { APState, SectorData, Coords, FuelState, ShipData, MiningState, CargoState } from '@void-sector/shared';

export interface GameSlice {
  // ... existing fields ...

  // Mining
  mining: MiningState | null;

  // Cargo
  cargo: CargoState;

  // ... existing actions ...

  // New actions
  setMining: (mining: MiningState) => void;
  setCargo: (cargo: CargoState) => void;
}
```

Add default values and action implementations:

```typescript
// Default values
mining: null,
cargo: { ore: 0, gas: 0, crystal: 0 },

// Actions
setMining: (mining) => set({ mining }),
setCargo: (cargo) => set({ cargo }),
```

**Step 2: Commit**

```bash
git add packages/client/src/state/gameSlice.ts
git commit -m "feat: add mining and cargo state to game store"
```

---

## Task 12: Client Network — New Message Handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add new message handlers in `setupRoomListeners`**

Add after the existing `error` handler:

```typescript
// Mining updates
room.onMessage('miningUpdate', (data: MiningState) => {
  useStore.getState().setMining(data);
});

// Cargo updates
room.onMessage('cargoUpdate', (data: CargoState) => {
  useStore.getState().setCargo(data);
});
```

Add the import:

```typescript
import type { APState, SectorData, MiningState, CargoState } from '@void-sector/shared';
```

**Step 2: Add new send methods to GameNetwork class**

```typescript
sendMine(resource: string) {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('mine', { resource });
}

sendStopMine() {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('stopMine', {});
}

sendJettison(resource: string) {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('jettison', { resource });
}

requestCargo() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getCargo', {});
}

requestMiningStatus() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getMiningStatus', {});
}
```

**Step 3: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: add mining and cargo network handlers"
```

---

## Task 13: Mining Monitor Component

**Files:**
- Create: `packages/client/src/components/MiningScreen.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Create `packages/client/src/components/MiningScreen.tsx`**

```typescript
import { useStore } from '../state/store';
import { network } from '../network/client';
import { RESOURCE_TYPES } from '@void-sector/shared';
import type { ResourceType } from '@void-sector/shared';

function ResourceBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = 10;
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const bar = '\u2587'.repeat(filled) + '\u2591'.repeat(width - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
      {label.padEnd(10)} {bar} {String(value).padStart(3)}
    </div>
  );
}

export function MiningScreen() {
  const mining = useStore((s) => s.mining);
  const currentSector = useStore((s) => s.currentSector);
  const position = useStore((s) => s.position);

  const resources = currentSector?.resources || { ore: 0, gas: 0, crystal: 0 };
  const maxYield = Math.max(resources.ore, resources.gas, resources.crystal, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px' }}>
        MINING OPERATIONS
      </div>

      <div style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
        SECTOR ({position.x}, {position.y}) — {currentSector?.type?.toUpperCase() || 'UNKNOWN'}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <ResourceBar label="ORE" value={resources.ore} max={maxYield} />
        <ResourceBar label="GAS" value={resources.gas} max={maxYield} />
        <ResourceBar label="CRYSTAL" value={resources.crystal} max={maxYield} />
      </div>

      <div style={{
        fontSize: '0.9rem',
        marginBottom: '16px',
        padding: '8px',
        border: '1px solid var(--color-dim)',
      }}>
        {mining?.active ? (
          <>
            <div>STATUS: MINING {mining.resource?.toUpperCase()}</div>
            <div>RATE: {mining.rate}u/s</div>
          </>
        ) : (
          <div>STATUS: IDLE</div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {RESOURCE_TYPES.map((res: ResourceType) => (
          <button
            key={res}
            className="vs-btn"
            disabled={mining?.active === true || resources[res] <= 0}
            onClick={() => network.sendMine(res)}
          >
            [MINE {res.toUpperCase()}]
          </button>
        ))}
        <button
          className="vs-btn"
          disabled={!mining?.active}
          onClick={() => network.sendStopMine()}
        >
          [STOP]
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Wire into GameScreen**

In `packages/client/src/components/GameScreen.tsx`, add:

```typescript
import { MiningScreen } from './MiningScreen';

// In the GameScreen component, add rendering for MINING monitor:
{activeMonitor === MONITORS.MINING && <MiningScreen />}
```

**Step 3: Commit**

```bash
git add packages/client/src/components/MiningScreen.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat: add MINING monitor screen component"
```

---

## Task 14: Cargo Monitor Component

**Files:**
- Create: `packages/client/src/components/CargoScreen.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Create `packages/client/src/components/CargoScreen.tsx`**

```typescript
import { useStore } from '../state/store';
import { network } from '../network/client';
import { SHIP_CLASSES, RESOURCE_TYPES } from '@void-sector/shared';
import type { ResourceType } from '@void-sector/shared';

function CargoBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = 10;
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
      {label.padEnd(10)} {bar} {String(value).padStart(3)}
    </div>
  );
}

export function CargoScreen() {
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const cargoCap = ship ? SHIP_CLASSES[ship.shipClass].cargoCap : SHIP_CLASSES.aegis_scout_mk1.cargoCap;
  const total = cargo.ore + cargo.gas + cargo.crystal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px' }}>
        CARGO HOLD
      </div>

      <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
        VESSEL: {ship ? SHIP_CLASSES[ship.shipClass].name : 'VOID SCOUT MK. I'}
      </div>

      <div style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
        CAPACITY: {total}/{cargoCap}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <CargoBar label="ORE" value={cargo.ore} max={cargoCap} />
        <CargoBar label="GAS" value={cargo.gas} max={cargoCap} />
        <CargoBar label="CRYSTAL" value={cargo.crystal} max={cargoCap} />
      </div>

      <div style={{
        borderTop: '1px solid var(--color-dim)',
        paddingTop: '8px',
        marginBottom: '16px',
        fontSize: '0.9rem',
      }}>
        <CargoBar label="TOTAL" value={total} max={cargoCap} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {RESOURCE_TYPES.map((res: ResourceType) => (
          <button
            key={res}
            className="vs-btn"
            disabled={cargo[res] <= 0}
            onClick={() => network.sendJettison(res)}
          >
            [JETTISON {res.toUpperCase()}]
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Wire into GameScreen**

In `packages/client/src/components/GameScreen.tsx`, add:

```typescript
import { CargoScreen } from './CargoScreen';

// In the GameScreen component, add rendering for CARGO monitor:
{activeMonitor === MONITORS.CARGO && <CargoScreen />}
```

**Step 3: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat: add CARGO monitor screen component"
```

---

## Task 15: Integration Verification

**Step 1: Build shared**

Run: `npm run build -w packages/shared`
Expected: No errors

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass (AP, worldgen, mining, commands, constants)

**Step 3: TypeScript check**

Run: `npx tsc --noEmit -p packages/server/tsconfig.json && npx tsc --noEmit -p packages/client/tsconfig.json`
Expected: No errors

**Step 4: Start server and client**

Run: `npm run dev:server` (in one terminal)
Run: `npm run dev:client` (in another terminal)

**Step 5: Manual test flow**

1. Login as existing user
2. Verify NAV-COM loads with radar
3. Click arrow buttons — should navigate between sectors
4. Click [SCAN] — should reveal sectors
5. Switch to MINING tab
6. Click [MINE ORE] — should start mining
7. Click [STOP] — should stop and update cargo
8. Switch to CARGO tab — verify ore quantity
9. Click [JETTISON ORE] — should clear ore
10. Verify all 4 tabs switch with correct amber/black inversion

**Step 6: Build client for production**

Run: `npm run build -w packages/client`
Expected: Build succeeds

**Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: integration verification and fixes"
```
