# Civilization Expansion System – Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** NPC factions have visible sector-level ships (mining drones, station builders, combat ships) that move 1 sector per 5s tick, appear on player radar, and bring civilizations to life.

**Architecture:** DB tables (`civ_stations`, `civ_ships`) store persistent state. A server-side `CivShipService` runs on every universe tick (5s) to move ships and update their state machines. A `civShipBus` EventEmitter broadcasts per-quadrant ship positions to `SectorRoom`, which sends `civ_ships_tick` to clients. The React client stores ships in Zustand and draws hollow circles on the `RadarRenderer` canvas.

**Tech Stack:** PostgreSQL (raw SQL migrations), Node.js/TypeScript (server engine + Colyseus), React + Zustand + Canvas (client)

**Worktree:** `/e/claude/voidSector/.worktrees/civ-expansion`
**Branch:** `feat/civ-expansion`

---

## Context

- `UNIVERSE_TICK_MS = 5000` → tick every 5 seconds
- `QUADRANT_SIZE = 500` → sectors per quadrant side
- `COSMIC_FACTION_IDS` in `packages/shared/src/constants.ts` — list of all factions
- `COSMIC_FACTION_COLORS` in same file — hex color per faction
- Faction territory: `quadrant_control` DB table (`qx`, `qy`, `controlling_faction`)
- Resource-bearing sector types: `nebula` (gas), `asteroid_field` (ore), `anomaly` (crystal), `pirate` (mixed)
- `generateSector(x, y, null)` from `worldgen.ts` — deterministic sector content (no DB needed)
- Broadcasting pattern: `civShipBus` EventEmitter (like `commsBus`) → `SectorRoom` subscribes → `this.broadcast('civ_ships_tick', data)`
- `universeBootstrap.ts:startUniverseEngine()` is the hook point for initialization

---

## Task 1: DB Migration — `civ_stations` + `civ_ships`

**Files:**
- Create: `packages/server/src/db/migrations/049_civ_ships.sql`

**Step 1: Write the migration**

```sql
-- Migration 049: Civilization ships and stations
-- NPC faction stations seeded from quadrant_control; ships move 1 sector per tick

CREATE TABLE IF NOT EXISTS civ_stations (
  id         SERIAL PRIMARY KEY,
  sector_x   INTEGER NOT NULL,
  sector_y   INTEGER NOT NULL,
  faction    VARCHAR(50) NOT NULL,
  has_shipyard  BOOLEAN NOT NULL DEFAULT TRUE,
  has_warehouse BOOLEAN NOT NULL DEFAULT TRUE,
  has_kontor    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sector_x, sector_y)
);

CREATE TABLE IF NOT EXISTS civ_ships (
  id               SERIAL PRIMARY KEY,
  faction          VARCHAR(50) NOT NULL,
  ship_type        VARCHAR(20) NOT NULL,   -- 'mining_drone'|'station_builder'|'combat'
  state            VARCHAR(20) NOT NULL,   -- 'idle'|'exploring'|'traveling'|'mining'|'returning'
  x                INTEGER NOT NULL,
  y                INTEGER NOT NULL,
  home_x           INTEGER NOT NULL,
  home_y           INTEGER NOT NULL,
  target_x         INTEGER,               -- NULL when idle/exploring
  target_y         INTEGER,
  spiral_step      INTEGER NOT NULL DEFAULT 0,
  resources_carried INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_civ_ships_xy ON civ_ships(x, y);
CREATE INDEX IF NOT EXISTS idx_civ_ships_faction ON civ_ships(faction);
```

**Step 2: Verify migration file exists**

```bash
ls packages/server/src/db/migrations/049_civ_ships.sql
```

**Step 3: Commit**

```bash
git add packages/server/src/db/migrations/049_civ_ships.sql
git commit -m "feat(civ): add migration 049 for civ_stations and civ_ships tables"
```

---

## Task 2: Shared Types — `CivShip`, `CivStation`

**Files:**
- Modify: `packages/shared/src/types.ts` (add interfaces near line 1340, after `NpcFleetState`)
- Modify: `packages/shared/src/constants.ts` (add CIV_DRONE_RADIUS constant near FACTION constants)

**Step 1: Write failing test in `packages/shared/src/__tests__/civShipTypes.test.ts`**

```typescript
import { CIV_DRONE_RADIUS } from '../constants';
import type { CivShip, CivStation } from '../types';

test('CIV_DRONE_RADIUS is a positive number', () => {
  expect(CIV_DRONE_RADIUS).toBeGreaterThan(0);
});

test('CivShip type has required fields', () => {
  const ship: CivShip = {
    id: 1,
    faction: 'archivists',
    ship_type: 'mining_drone',
    state: 'idle',
    x: 100,
    y: 200,
    home_x: 100,
    home_y: 200,
  };
  expect(ship.id).toBe(1);
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/shared && npx jest --testPathPattern=civShipTypes --no-coverage 2>&1 | tail -5
```
Expected: FAIL — `CIV_DRONE_RADIUS` not found

**Step 3: Add types to `packages/shared/src/types.ts`** after the `NpcFleetState` interface (~line 1341):

```typescript
export type CivShipType = 'mining_drone' | 'station_builder' | 'combat';
export type CivShipState = 'idle' | 'exploring' | 'traveling' | 'mining' | 'returning';

export interface CivShip {
  id: number;
  faction: string;
  ship_type: CivShipType;
  state: CivShipState;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
  target_x?: number;
  target_y?: number;
  spiral_step?: number;
  resources_carried?: number;
}

export interface CivStation {
  id: number;
  sector_x: number;
  sector_y: number;
  faction: string;
  has_shipyard: boolean;
  has_warehouse: boolean;
  has_kontor: boolean;
}
```

**Step 4: Add constant to `packages/shared/src/constants.ts`** after `FACTION_EXPANSION_INTERVAL_TICKS` (~line 2044):

```typescript
/** Radar render radius for NPC mining drones (hollow circle, px at zoom 2) */
export const CIV_DRONE_RADIUS = 5;

/** Max mining drones per NPC station */
export const CIV_MAX_DRONES_PER_STATION = 3;

/** Mining drone fills up after this many ticks */
export const CIV_MINING_TICKS_TO_FULL = 20;

/** Max Ulam spiral steps before drone gives up and idles */
export const CIV_SPIRAL_MAX_STEPS = 200;
```

**Step 5: Run test to verify it passes**

```bash
cd packages/shared && npx jest --testPathPattern=civShipTypes --no-coverage 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/__tests__/civShipTypes.test.ts
git commit -m "feat(civ): add CivShip/CivStation types and civ constants to shared"
```

---

## Task 3: DB Queries — `civQueries.ts`

**Files:**
- Create: `packages/server/src/db/civQueries.ts`
- Create: `packages/server/src/__tests__/civQueries.test.ts`

**Step 1: Write the failing test** (`packages/server/src/__tests__/civQueries.test.ts`):

```typescript
import { civQueries } from '../db/civQueries';

// Integration test — requires running DB
// Skip in unit-only mode
describe('civQueries', () => {
  it('exports all required functions', () => {
    expect(typeof civQueries.getStationsForFaction).toBe('function');
    expect(typeof civQueries.upsertStation).toBe('function');
    expect(typeof civQueries.getAllStations).toBe('function');
    expect(typeof civQueries.createShip).toBe('function');
    expect(typeof civQueries.updateShip).toBe('function');
    expect(typeof civQueries.getAllShips).toBe('function');
    expect(typeof civQueries.deleteShip).toBe('function');
    expect(typeof civQueries.getShipsInQuadrant).toBe('function');
    expect(typeof civQueries.countDronesAtStation).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx jest --testPathPattern=civQueries --no-coverage 2>&1 | tail -5
```

**Step 3: Implement `packages/server/src/db/civQueries.ts`**

```typescript
import { query } from './client.js';
import type { CivShip, CivStation } from '@void-sector/shared';

export const civQueries = {
  async getAllStations(): Promise<CivStation[]> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number; faction: string;
      has_shipyard: boolean; has_warehouse: boolean; has_kontor: boolean;
    }>('SELECT * FROM civ_stations ORDER BY id');
    return res.rows.map((r) => ({
      id: r.id, sector_x: r.sector_x, sector_y: r.sector_y,
      faction: r.faction, has_shipyard: r.has_shipyard,
      has_warehouse: r.has_warehouse, has_kontor: r.has_kontor,
    }));
  },

  async getStationsForFaction(faction: string): Promise<CivStation[]> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number; faction: string;
      has_shipyard: boolean; has_warehouse: boolean; has_kontor: boolean;
    }>('SELECT * FROM civ_stations WHERE faction = $1', [faction]);
    return res.rows.map((r) => ({
      id: r.id, sector_x: r.sector_x, sector_y: r.sector_y,
      faction: r.faction, has_shipyard: r.has_shipyard,
      has_warehouse: r.has_warehouse, has_kontor: r.has_kontor,
    }));
  },

  async upsertStation(
    sector_x: number, sector_y: number, faction: string,
    has_shipyard = true, has_warehouse = true, has_kontor = false,
  ): Promise<void> {
    await query(
      `INSERT INTO civ_stations (sector_x, sector_y, faction, has_shipyard, has_warehouse, has_kontor)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sector_x, sector_y) DO NOTHING`,
      [sector_x, sector_y, faction, has_shipyard, has_warehouse, has_kontor],
    );
  },

  async createShip(data: {
    faction: string; ship_type: string; state: string;
    x: number; y: number; home_x: number; home_y: number;
  }): Promise<number> {
    const res = await query<{ id: number }>(
      `INSERT INTO civ_ships (faction, ship_type, state, x, y, home_x, home_y)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.faction, data.ship_type, data.state, data.x, data.y, data.home_x, data.home_y],
    );
    return res.rows[0].id;
  },

  async updateShip(id: number, data: {
    state: string; x: number; y: number;
    target_x?: number | null; target_y?: number | null;
    spiral_step?: number; resources_carried?: number;
  }): Promise<void> {
    await query(
      `UPDATE civ_ships SET state=$2, x=$3, y=$4, target_x=$5, target_y=$6,
       spiral_step=$7, resources_carried=$8 WHERE id=$1`,
      [id, data.state, data.x, data.y,
       data.target_x ?? null, data.target_y ?? null,
       data.spiral_step ?? 0, data.resources_carried ?? 0],
    );
  },

  async getAllShips(): Promise<CivShip[]> {
    const res = await query<{
      id: number; faction: string; ship_type: string; state: string;
      x: number; y: number; home_x: number; home_y: number;
      target_x: number | null; target_y: number | null;
      spiral_step: number; resources_carried: number;
    }>('SELECT * FROM civ_ships ORDER BY id');
    return res.rows.map((r) => ({
      id: r.id, faction: r.faction, ship_type: r.ship_type as any,
      state: r.state as any, x: r.x, y: r.y,
      home_x: r.home_x, home_y: r.home_y,
      target_x: r.target_x ?? undefined,
      target_y: r.target_y ?? undefined,
      spiral_step: r.spiral_step,
      resources_carried: r.resources_carried,
    }));
  },

  async getShipsInQuadrant(qx: number, qy: number, quadrantSize: number): Promise<CivShip[]> {
    const minX = qx * quadrantSize;
    const maxX = minX + quadrantSize - 1;
    const minY = qy * quadrantSize;
    const maxY = minY + quadrantSize - 1;
    const res = await query<{
      id: number; faction: string; ship_type: string; state: string;
      x: number; y: number; home_x: number; home_y: number;
      target_x: number | null; target_y: number | null;
      spiral_step: number; resources_carried: number;
    }>(
      `SELECT * FROM civ_ships WHERE x BETWEEN $1 AND $2 AND y BETWEEN $3 AND $4`,
      [minX, maxX, minY, maxY],
    );
    return res.rows.map((r) => ({
      id: r.id, faction: r.faction, ship_type: r.ship_type as any,
      state: r.state as any, x: r.x, y: r.y,
      home_x: r.home_x, home_y: r.home_y,
      target_x: r.target_x ?? undefined, target_y: r.target_y ?? undefined,
      spiral_step: r.spiral_step, resources_carried: r.resources_carried,
    }));
  },

  async deleteShip(id: number): Promise<void> {
    await query('DELETE FROM civ_ships WHERE id = $1', [id]);
  },

  async countDronesAtStation(home_x: number, home_y: number): Promise<number> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM civ_ships
       WHERE home_x=$1 AND home_y=$2 AND ship_type='mining_drone'`,
      [home_x, home_y],
    );
    return parseInt(res.rows[0].count, 10);
  },
};
```

**Step 4: Run test to verify it passes**

```bash
cd packages/server && npx jest --testPathPattern=civQueries --no-coverage 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add packages/server/src/db/civQueries.ts packages/server/src/__tests__/civQueries.test.ts
git commit -m "feat(civ): add civQueries for civ_stations and civ_ships DB access"
```

---

## Task 4: `civShipBus` EventEmitter

**Files:**
- Create: `packages/server/src/civShipBus.ts`
- Create: `packages/server/src/__tests__/civShipBus.test.ts`

**Step 1: Write the failing test**

```typescript
import { civShipBus } from '../civShipBus';

test('civShipBus emits civShipsTick event', (done) => {
  const handler = (data: { qx: number; qy: number; ships: unknown[] }) => {
    expect(data.qx).toBe(1);
    expect(data.ships).toHaveLength(0);
    civShipBus.off('civShipsTick', handler);
    done();
  };
  civShipBus.on('civShipsTick', handler);
  civShipBus.broadcastTick({ qx: 1, qy: 0, ships: [] });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx jest --testPathPattern=civShipBus --no-coverage 2>&1 | tail -5
```

**Step 3: Implement `packages/server/src/civShipBus.ts`**

```typescript
import { EventEmitter } from 'events';
import type { CivShip } from '@void-sector/shared';

export interface CivShipsTickEvent {
  qx: number;
  qy: number;
  ships: CivShip[];
}

class CivShipBus extends EventEmitter {
  broadcastTick(event: CivShipsTickEvent): void {
    this.emit('civShipsTick', event);
  }
}

export const civShipBus = new CivShipBus();
```

**Step 4: Run test to verify it passes**

```bash
cd packages/server && npx jest --testPathPattern=civShipBus --no-coverage 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add packages/server/src/civShipBus.ts packages/server/src/__tests__/civShipBus.test.ts
git commit -m "feat(civ): add civShipBus EventEmitter for cross-room ship broadcasts"
```

---

## Task 5: `CivStationService` — Station Seeding + Ship Spawning

**Files:**
- Create: `packages/server/src/engine/civStationService.ts`
- Create: `packages/server/src/__tests__/civStationService.test.ts`

**Step 1: Write the failing tests**

```typescript
import { getQuadrantCenter, shouldSpawnDrone } from '../engine/civStationService';

test('getQuadrantCenter returns center sector of quadrant', () => {
  // Quadrant (0,0): sectors 0-499, center = (250, 250)
  expect(getQuadrantCenter(0, 0, 500)).toEqual({ x: 250, y: 250 });
  // Quadrant (1,0): sectors 500-999, center = (750, 250)
  expect(getQuadrantCenter(1, 0, 500)).toEqual({ x: 750, y: 250 });
});

test('shouldSpawnDrone returns true when drone count < max', () => {
  expect(shouldSpawnDrone(0, 3)).toBe(true);
  expect(shouldSpawnDrone(2, 3)).toBe(true);
  expect(shouldSpawnDrone(3, 3)).toBe(false);
  expect(shouldSpawnDrone(4, 3)).toBe(false);
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx jest --testPathPattern=civStationService --no-coverage 2>&1 | tail -5
```

**Step 3: Implement `packages/server/src/engine/civStationService.ts`**

```typescript
import { QUADRANT_SIZE, CIV_MAX_DRONES_PER_STATION } from '@void-sector/shared';
import { civQueries } from '../db/civQueries.js';
import { getAllQuadrantControls } from '../db/queries.js';
import { logger } from '../utils/logger.js';

/** Returns the center sector coordinates of a quadrant */
export function getQuadrantCenter(
  qx: number, qy: number, size: number = QUADRANT_SIZE,
): { x: number; y: number } {
  return {
    x: qx * size + Math.floor(size / 2),
    y: qy * size + Math.floor(size / 2),
  };
}

export function shouldSpawnDrone(currentCount: number, max: number): boolean {
  return currentCount < max;
}

/**
 * Ensure all faction-controlled quadrants have a civ station at their center.
 * Idempotent — uses INSERT ON CONFLICT DO NOTHING.
 */
export async function ensureCivStations(): Promise<void> {
  const controls = await getAllQuadrantControls();
  let seeded = 0;

  for (const q of controls) {
    if (!q.controlling_faction || q.controlling_faction === 'human') continue;

    const center = getQuadrantCenter(q.qx, q.qy);
    await civQueries.upsertStation(center.x, center.y, q.controlling_faction);
    seeded++;
  }

  logger.info({ seeded }, 'CivStations: ensured stations for faction quadrants');
}

/**
 * Spawn mining drones at shipyard stations that are below drone cap.
 */
export async function spawnMissingDrones(): Promise<void> {
  const stations = await civQueries.getAllStations();
  let spawned = 0;

  for (const station of stations) {
    if (!station.has_shipyard) continue;

    const count = await civQueries.countDronesAtStation(station.sector_x, station.sector_y);
    if (!shouldSpawnDrone(count, CIV_MAX_DRONES_PER_STATION)) continue;

    await civQueries.createShip({
      faction: station.faction,
      ship_type: 'mining_drone',
      state: 'idle',
      x: station.sector_x,
      y: station.sector_y,
      home_x: station.sector_x,
      home_y: station.sector_y,
    });
    spawned++;
  }

  if (spawned > 0) {
    logger.info({ spawned }, 'CivStation: spawned mining drones');
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/server && npx jest --testPathPattern=civStationService --no-coverage 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/civStationService.ts packages/server/src/__tests__/civStationService.test.ts
git commit -m "feat(civ): add CivStationService for station seeding and drone spawning"
```

---

## Task 6: `CivShipService` — Tick Logic, Movement, State Machine

**Files:**
- Create: `packages/server/src/engine/civShipService.ts`
- Create: `packages/server/src/__tests__/civShipService.test.ts`

**Step 1: Write the failing tests**

```typescript
import {
  ulamSpiralStep,
  stepToward,
  nextShipState,
} from '../engine/civShipService';
import type { CivShip } from '@void-sector/shared';

test('ulamSpiralStep(0) returns (0,0)', () => {
  expect(ulamSpiralStep(0)).toEqual({ dx: 0, dy: 0 });
});

test('ulamSpiralStep generates spiral sequence', () => {
  const steps = Array.from({ length: 9 }, (_, i) => ulamSpiralStep(i));
  // Spiral: (0,0), (1,0), (1,1), (0,1), (-1,1), (-1,0), (-1,-1), (0,-1), (1,-1)
  expect(steps[1]).toEqual({ dx: 1, dy: 0 });
  // All steps within radius 1 from origin
  for (const s of steps) {
    expect(Math.abs(s.dx)).toBeLessThanOrEqual(1);
    expect(Math.abs(s.dy)).toBeLessThanOrEqual(1);
  }
});

test('stepToward moves 1 step toward target', () => {
  expect(stepToward(0, 0, 5, 3)).toEqual({ x: 1, y: 1 });
  expect(stepToward(5, 3, 5, 3)).toEqual({ x: 5, y: 3 }); // already there
  expect(stepToward(0, 0, 0, 3)).toEqual({ x: 0, y: 1 }); // only y
});

test('nextShipState: idle drone with no known target starts exploring', () => {
  const ship: CivShip = {
    id: 1, faction: 'archivists', ship_type: 'mining_drone',
    state: 'idle', x: 100, y: 100, home_x: 100, home_y: 100,
    spiral_step: 0, resources_carried: 0,
  };
  const result = nextShipState(ship, null, 0, 20);
  expect(result.state).toBe('exploring');
});

test('nextShipState: mining drone fills up and returns', () => {
  const ship: CivShip = {
    id: 2, faction: 'archivists', ship_type: 'mining_drone',
    state: 'mining', x: 105, y: 100, home_x: 100, home_y: 100,
    resources_carried: 19,
  };
  const result = nextShipState(ship, null, 0, 20);
  expect(result.state).toBe('returning');
  expect(result.target_x).toBe(100);
  expect(result.target_y).toBe(100);
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx jest --testPathPattern=civShipService --no-coverage 2>&1 | tail -5
```

**Step 3: Implement `packages/server/src/engine/civShipService.ts`**

```typescript
import {
  QUADRANT_SIZE,
  CIV_MINING_TICKS_TO_FULL,
  CIV_SPIRAL_MAX_STEPS,
} from '@void-sector/shared';
import type { CivShip } from '@void-sector/shared';
import { civQueries } from '../db/civQueries.js';
import { civShipBus } from '../civShipBus.js';
import { generateSector } from './worldgen.js';
import { logger } from '../utils/logger.js';

// ── Pure helpers (exported for testing) ────────────────────────────────────

/**
 * Generate an Ulam spiral (dx, dy) for step n.
 * Step 0 = origin. Steps 1–8 = ring 1. Steps 9–24 = ring 2. Etc.
 */
export function ulamSpiralStep(n: number): { dx: number; dy: number } {
  if (n === 0) return { dx: 0, dy: 0 };
  // Walk the spiral: right, up, left, left, down, down, right, right, right, ...
  let x = 0, y = 0;
  let step = 1, stepCount = 0, dir = 0;
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 0, dy: -1 },
    { dx: -1, dy: 0 }, { dx: 0, dy: 1 },
  ];
  for (let i = 1; i <= n; i++) {
    const d = dirs[dir % 4];
    x += d.dx;
    y += d.dy;
    stepCount++;
    if (stepCount === step) {
      stepCount = 0;
      dir++;
      if (dir % 2 === 0) step++;
    }
  }
  return { dx: x, dy: y };
}

/** Move 1 step from (x,y) toward (tx,ty). Returns new position. */
export function stepToward(
  x: number, y: number, tx: number, ty: number,
): { x: number; y: number } {
  if (x === tx && y === ty) return { x, y };
  const nx = x + Math.sign(tx - x);
  const ny = y + Math.sign(ty - y);
  return { x: nx, y: ny };
}

/** Check if the sector at (x, y) has any mineable resources */
function hasMineableResources(x: number, y: number): boolean {
  const sector = generateSector(x, y, null);
  const t = sector.type;
  return t === 'asteroid_field' || t === 'nebula' || t === 'anomaly' || t === 'pirate';
}

/**
 * Compute next state and position for a ship in a single tick.
 * Pure function — no DB I/O. Returns the updated ship fields.
 *
 * @param ship     Current ship state
 * @param _unused  Reserved for future known-resource hints
 * @param tickCount Current universe tick (unused, reserved)
 * @param maxResources Max resources before returning home
 */
export function nextShipState(
  ship: CivShip,
  _unused: null,
  tickCount: number,
  maxResources: number = CIV_MINING_TICKS_TO_FULL,
): Partial<CivShip> {
  switch (ship.state) {
    case 'idle': {
      // Start exploring
      return { state: 'exploring', spiral_step: 0 };
    }

    case 'exploring': {
      const step = (ship.spiral_step ?? 0) + 1;
      if (step > CIV_SPIRAL_MAX_STEPS) {
        // Give up, go idle
        return { state: 'idle', spiral_step: 0 };
      }
      const { dx, dy } = ulamSpiralStep(step);
      const newX = ship.home_x + dx;
      const newY = ship.home_y + dy;

      if (hasMineableResources(newX, newY)) {
        // Found resource — start traveling to it
        return {
          state: 'traveling',
          x: newX,
          y: newY,
          target_x: newX,
          target_y: newY,
          spiral_step: step,
        };
      }
      // Keep exploring (move to spiral position)
      return { state: 'exploring', x: newX, y: newY, spiral_step: step };
    }

    case 'traveling': {
      const tx = ship.target_x ?? ship.home_x;
      const ty = ship.target_y ?? ship.home_y;
      const { x: nx, y: ny } = stepToward(ship.x, ship.y, tx, ty);

      if (nx === tx && ny === ty) {
        // Arrived at target
        if (tx === ship.home_x && ty === ship.home_y) {
          // Arrived home
          return { state: 'idle', x: nx, y: ny, resources_carried: 0, target_x: null, target_y: null };
        }
        // Arrived at resource sector
        return { state: 'mining', x: nx, y: ny };
      }
      return { x: nx, y: ny };
    }

    case 'mining': {
      const carried = (ship.resources_carried ?? 0) + 1;
      if (carried >= maxResources) {
        return {
          state: 'returning',
          resources_carried: carried,
          target_x: ship.home_x,
          target_y: ship.home_y,
        };
      }
      return { resources_carried: carried };
    }

    case 'returning': {
      const tx = ship.target_x ?? ship.home_x;
      const ty = ship.target_y ?? ship.home_y;
      const { x: nx, y: ny } = stepToward(ship.x, ship.y, tx, ty);

      if (nx === tx && ny === ty) {
        return { state: 'idle', x: nx, y: ny, resources_carried: 0, target_x: null, target_y: null };
      }
      return { x: nx, y: ny };
    }

    default:
      return {};
  }
}

// ── Effectful tick (DB + bus) ───────────────────────────────────────────────

function sectorToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return {
    qx: Math.floor(x / QUADRANT_SIZE),
    qy: Math.floor(y / QUADRANT_SIZE),
  };
}

/**
 * Process one universe tick for all civ ships.
 * Reads all ships, computes next state, writes back, broadcasts per quadrant.
 */
export async function processCivTick(): Promise<void> {
  try {
    const ships = await civQueries.getAllShips();
    if (ships.length === 0) return;

    // Track which quadrants get updated ships
    const quadrantShips = new Map<string, CivShip[]>();

    for (const ship of ships) {
      const updates = nextShipState(ship, null, 0);
      if (Object.keys(updates).length === 0) continue;

      const updated: CivShip = { ...ship, ...updates };
      await civQueries.updateShip(ship.id, {
        state: updated.state,
        x: updated.x,
        y: updated.y,
        target_x: updated.target_x ?? null,
        target_y: updated.target_y ?? null,
        spiral_step: updated.spiral_step ?? 0,
        resources_carried: updated.resources_carried ?? 0,
      });

      const { qx, qy } = sectorToQuadrant(updated.x, updated.y);
      const key = `${qx}:${qy}`;
      if (!quadrantShips.has(key)) quadrantShips.set(key, []);
      quadrantShips.get(key)!.push(updated);
    }

    // Broadcast per quadrant
    for (const [key, qShips] of quadrantShips) {
      const [qx, qy] = key.split(':').map(Number);
      civShipBus.broadcastTick({ qx, qy, ships: qShips });
    }
  } catch (err) {
    logger.error({ err }, 'processCivTick error');
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/server && npx jest --testPathPattern=civShipService --no-coverage 2>&1 | tail -10
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/civShipService.ts packages/server/src/__tests__/civShipService.test.ts
git commit -m "feat(civ): add CivShipService with state machine, Ulam spiral, and tick processing"
```

---

## Task 7: Bootstrap Integration

**Files:**
- Modify: `packages/server/src/engine/universeBootstrap.ts`

**Step 1: Read the current file**

File is at `packages/server/src/engine/universeBootstrap.ts` — already read in session.

**Step 2: Add imports and initialization**

In `universeBootstrap.ts`, add after existing imports:

```typescript
import { ensureCivStations, spawnMissingDrones } from './civStationService.js';
import { processCivTick } from './civShipService.js';
```

In `startUniverseEngine()`, add after `ensureAlienHomeQuadrants()`:

```typescript
await ensureCivStations();
await spawnMissingDrones();
logger.info('CivShips: stations seeded and initial drones spawned');
```

Change the `UniverseTickEngine` callback to also call `processCivTick()`:

```typescript
const engine = new UniverseTickEngine(async (result) => {
  // Run civ ship tick on every universe tick
  await processCivTick();

  if (result.tickCount % STRATEGIC_TICK_INTERVAL !== 0) return;
  // ... rest of strategic tick ...
});
```

**Step 3: Verify server compiles**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only pre-existing errors)

**Step 4: Commit**

```bash
git add packages/server/src/engine/universeBootstrap.ts
git commit -m "feat(civ): hook CivStationService + CivShipService into universe bootstrap"
```

---

## Task 8: SectorRoom Integration — Subscribe + Broadcast

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add import** near the top with other bus imports (line ~17):

```typescript
import { civShipBus } from '../civShipBus.js';
import type { CivShipsTickEvent } from '../civShipBus.js';
```

**Step 2: Add civShipBus listener** in the `onCreate` setup block (near the `commsBus.on` call, ~line 1016):

```typescript
// CivShips — broadcast visible NPC ships to clients in this quadrant
const onCivShipsTick = (event: CivShipsTickEvent) => {
  if (event.qx !== this.quadrantX || event.qy !== this.quadrantY) return;
  this.broadcast('civ_ships_tick', event.ships);
};
civShipBus.on('civShipsTick', onCivShipsTick);

this.disposeCallbacks.push(() => {
  civShipBus.off('civShipsTick', onCivShipsTick);
});
```

Note: The existing `disposeCallbacks.push` block for commsBus is at ~line 1018. Add the civShipBus cleanup to the SAME disposeCallbacks push to keep it tidy. Alternatively add a separate push.

**Step 3: Verify server compiles**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(civ): SectorRoom subscribes to civShipBus and broadcasts civ_ships_tick"
```

---

## Task 9: Client — Add `civShips` to Zustand gameSlice

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`

**Step 1: Add import** for `CivShip` type (near other shared type imports, ~line 46):

```typescript
  CivShip,
```

**Step 2: Add `civShips` state field** (near `npcFleets` definition, ~line 435):

```typescript
  civShips: CivShip[];
```

**Step 3: Add `setCivShips` action** (near `setNpcFleets`, ~line 546):

```typescript
  setCivShips: (ships: CivShip[]) => void;
```

**Step 4: Initialize state** (near `npcFleets: []`, ~line 664):

```typescript
  civShips: [],
```

**Step 5: Implement action** (near `setNpcFleets` implementation, ~line 879):

```typescript
  setCivShips: (ships) => set({ civShips: ships }),
```

**Step 6: Verify client compiles**

```bash
cd packages/client && npx tsc --noEmit 2>&1 | head -20
```

**Step 7: Commit**

```bash
git add packages/client/src/state/gameSlice.ts
git commit -m "feat(civ): add civShips state to gameSlice"
```

---

## Task 10: Client — Network Handler for `civ_ships_tick`

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add import** for `CivShip` at the top of the imports from `@void-sector/shared`:

```typescript
  CivShip,
```

**Step 2: Add message handler** near the `npcFleets` handler (~line 1596):

```typescript
room.onMessage('civ_ships_tick', (data: CivShip[]) => {
  useStore.getState().setCivShips(data);
});
```

**Step 3: Verify client compiles**

```bash
cd packages/client && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(civ): handle civ_ships_tick network message in client"
```

---

## Task 11: Client — RadarRenderer — Draw NPC Ships

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: any component that calls `drawRadar(ctx, state)` to pass `civShips`

**Step 1: Add `civShips` to `RadarState` interface** (~line 64):

```typescript
  civShips?: CivShip[];
```

Also add import at top:
```typescript
import type { CivShip } from '@void-sector/shared';
import { COSMIC_FACTION_COLORS } from '@void-sector/shared';
```

**Step 2: Draw NPC ships after the "other players" block** (~line 626, after the players block closes):

```typescript
// Draw NPC civ ships — zoom >= 1 (always visible when in range)
{
  const civShipList = state.civShips ?? [];
  for (const ship of civShipList) {
    const dx = ship.x - viewX;
    const dy = ship.y - viewY;
    if (Math.abs(dx) > radiusX || Math.abs(dy) > radiusY) continue;

    const px = gridCenterX + dx * CELL_W;
    const py = gridCenterY + dy * CELL_H;
    const factionColor =
      (COSMIC_FACTION_COLORS as Record<string, string>)[ship.faction] ?? '#AAAAAA';

    ctx.save();
    ctx.strokeStyle = factionColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;

    if (ship.ship_type === 'mining_drone') {
      // Hollow circle ○
      const radius = 3 + state.zoomLevel;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ship.ship_type === 'station_builder') {
      // Small square □
      const half = 3 + state.zoomLevel;
      ctx.strokeRect(px - half, py - half, half * 2, half * 2);
    } else {
      // Combat — diamond ◇
      const s = 3 + state.zoomLevel;
      ctx.beginPath();
      ctx.moveTo(px, py - s);
      ctx.lineTo(px + s, py);
      ctx.lineTo(px, py + s);
      ctx.lineTo(px - s, py);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}
```

**Step 3: Pass `civShips` from store to `drawRadar`**

Find where `drawRadar(ctx, { ... })` is called (likely in a component or hook). Search:

```bash
grep -rn "drawRadar\|civShips" packages/client/src/ | grep -v ".test."
```

Add `civShips: useStore.getState().civShips` (or from hook) to the state object passed to `drawRadar`.

**Step 4: Verify client compiles**

```bash
cd packages/client && npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Run client unit tests**

```bash
cd packages/client && npx jest --no-coverage 2>&1 | tail -10
```

**Step 6: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(civ): render NPC ships on radar (hollow circle for drones, square for builders, diamond for combat)"
```

---

## Final Verification

**Step 1: Build all packages**

```bash
cd /e/claude/voidSector/.worktrees/civ-expansion && npm run build 2>&1 | tail -20
```

**Step 2: Run all tests**

```bash
cd /e/claude/voidSector/.worktrees/civ-expansion && npm test 2>&1 | tail -20
```

**Step 3: Start server + client (docker or local) and visually verify**

- Log in, navigate to any sector
- Check browser console for `civ_ships_tick` messages
- Verify hollow circles appear on radar for nearby NPC factions
- Wait a few ticks and observe circles moving

**Step 4: Final commit if needed, then invoke finishing-a-development-branch**
