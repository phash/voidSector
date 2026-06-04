# Station Rework Phase 2 (#549) — Station Mining Ships — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Player stations with a Werft build their own mining ships that fly to resource sectors, harvest, return home, and (with a Markt) auto-sell the haul for credits + trade volume — visible as drones on the radar.

**Architecture:** A new `station_mining_ships` table + a bounded `processStationMiningTick()` that loads ONLY player-station ships (a few dozen, never the 8000 disabled NPC stations → OOM-safe). It reuses the existing pure mining state machine `nextShipState` (`engine/civShipService.ts`) for movement/harvest, and the existing `civShipBus` → `SectorRoom` → client `RadarRenderer` (`mining_drone` ○) path for rendering — so there are NO client changes. Delivery either auto-sells (markt_level ≥ 1: credits to owner + trade_volume → tier) or stores into the station's capped cargo.

**Tech Stack:** TypeScript (strict, ESM `.js` imports), PostgreSQL, Colyseus, Vitest.

> **Build rule:** after editing `packages/shared/src/constants.ts`, run `cd packages/shared && npm run build` before tests see the change. (Phase 2 mostly consumes existing shared exports; `STATION_MINING_SHIPS_PER_WERFT_LEVEL` already exists from Phase 1.)

## Reused / pre-existing (do NOT reimplement)
- `engine/civShipService.ts`: `nextShipState(ship, null, 0)` — pure drone state machine (idle→exploring→traveling→mining→returning, Ulam spiral search for a sector whose `generateSector` type is mineable, harvest to `CIV_MINING_TICKS_TO_FULL`, return home). Operates on a `CivShip` shape; returns `Partial<CivShip>`. Also exports `ulamSpiralStep`, `stepToward`.
- `civShipBus.broadcastTick({qx, qy, ships})` → `SectorRoom` `onCivShipsTick` forwards `civ_ships_tick` to clients in that quadrant; client renders `ship_type: 'mining_drone'` as `○`. A `role:'drone'` ship passes the room's outlaw filter.
- `CivShip` (shared/types.ts): `{ id:number, faction, ship_type, state, x, y, home_x, home_y, target_x?, target_y?, spiral_step?, resources_carried?, mined_resource?, role? }`.
- Phase-1 station helpers — `db/stationQueries.ts`: `getPlayerStationById`, `addTradeVolume(id, amount)→row`, `setStationLevel(id, level)`, `updateStationCargo(id, contents)`. `db/queries.ts`: `addCredits(userId, amount)`. shared: `NPC_PRICES`, `NPC_SELL_SPREAD`, `MARKT_SPREAD_PER_LEVEL`, `stationCargoCapacity`, `stationTierForVolume`, `STATION_MINING_SHIPS_PER_WERFT_LEVEL`, `MAX_STATION_LEVEL`, `MineableResourceType`.

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/server/src/db/migrations/088_station_mining_ships.sql` | new table | Create |
| `packages/server/src/db/stationMiningQueries.ts` | row type + CRUD + eligible-station query | Create |
| `packages/server/src/engine/stationMiningDelivery.ts` | pure delivery decision (sell vs store) | Create |
| `packages/server/src/engine/stationMiningService.ts` | spawn + `processStationMiningTick` (reuses nextShipState + civShipBus) | Create |
| `packages/server/src/engine/universeBootstrap.ts` | wire the mining tick | Modify |
| `packages/server/src/scripts/resetWorld.ts` | add `station_mining_ships` to wipe list | Modify |
| `packages/server/src/__tests__/universeBootstrap.test.ts` | mock the new tick | Modify |
| Tests for each new module | — | Create |

---

## Task 1: Migration 088 + `stationMiningQueries.ts`

**Files:**
- Create: `packages/server/src/db/migrations/088_station_mining_ships.sql`
- Create: `packages/server/src/db/stationMiningQueries.ts`
- Test: `packages/server/src/db/__tests__/stationMiningQueries.test.ts`

- [ ] **Step 1: Create the migration**

`packages/server/src/db/migrations/088_station_mining_ships.sql`:

```sql
CREATE TABLE IF NOT EXISTS station_mining_ships (
  id                BIGSERIAL PRIMARY KEY,
  station_id        UUID NOT NULL REFERENCES player_stations(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  state             TEXT NOT NULL DEFAULT 'idle',
  x                 INTEGER NOT NULL,
  y                 INTEGER NOT NULL,
  home_x            INTEGER NOT NULL,
  home_y            INTEGER NOT NULL,
  target_x          INTEGER,
  target_y          INTEGER,
  spiral_step       INTEGER NOT NULL DEFAULT 0,
  resources_carried INTEGER NOT NULL DEFAULT 0,
  mined_resource    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_station_mining_ships_station ON station_mining_ships(station_id);
```

- [ ] **Step 2: Write the failing test**

`packages/server/src/db/__tests__/stationMiningQueries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toCivShip, type StationMiningShipRow } from '../stationMiningQueries.js';

const row: StationMiningShipRow = {
  id: 7, station_id: 'st', owner_id: 'ow', state: 'exploring',
  x: 10, y: 20, home_x: 5, home_y: 5, target_x: null, target_y: null,
  spiral_step: 3, resources_carried: 0, mined_resource: null, created_at: 'now',
};

describe('toCivShip', () => {
  it('maps a station mining ship row to a CivShip drone', () => {
    const cs = toCivShip(row);
    expect(cs.id).toBe(7);
    expect(cs.faction).toBe('humans');
    expect(cs.ship_type).toBe('mining_drone');
    expect(cs.role).toBe('drone');
    expect(cs.state).toBe('exploring');
    expect(cs.x).toBe(10);
    expect(cs.home_x).toBe(5);
    expect(cs.target_x).toBeUndefined(); // null → undefined
    expect(cs.spiral_step).toBe(3);
  });
});
```

- [ ] **Step 3: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/db/__tests__/stationMiningQueries.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Create `packages/server/src/db/stationMiningQueries.ts`**

```typescript
import { query } from './client.js';
import type { CivShip } from '@void-sector/shared';

export interface StationMiningShipRow {
  id: number;
  station_id: string;
  owner_id: string;
  state: string;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
  target_x: number | null;
  target_y: number | null;
  spiral_step: number;
  resources_carried: number;
  mined_resource: string | null;
  created_at: string;
}

/** A player station eligible to operate mining ships. */
export interface MiningStationRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  werft_level: number;
}

/** Map a DB row to the CivShip shape consumed by nextShipState + the radar render path. */
export function toCivShip(row: StationMiningShipRow): CivShip {
  return {
    id: row.id,
    faction: 'humans',
    ship_type: 'mining_drone',
    state: row.state as CivShip['state'],
    x: row.x,
    y: row.y,
    home_x: row.home_x,
    home_y: row.home_y,
    target_x: row.target_x ?? undefined,
    target_y: row.target_y ?? undefined,
    spiral_step: row.spiral_step,
    resources_carried: row.resources_carried,
    mined_resource: row.mined_resource ?? undefined,
    role: 'drone',
  };
}

export async function getAllStationMiningShips(): Promise<StationMiningShipRow[]> {
  const res = await query<StationMiningShipRow>('SELECT * FROM station_mining_ships');
  return res.rows;
}

export async function createStationMiningShip(data: {
  station_id: string;
  owner_id: string;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO station_mining_ships (station_id, owner_id, state, x, y, home_x, home_y)
     VALUES ($1, $2, 'idle', $3, $4, $5, $6) RETURNING id`,
    [data.station_id, data.owner_id, data.x, data.y, data.home_x, data.home_y],
  );
  return res.rows[0].id;
}

export async function updateStationMiningShip(
  id: number,
  data: {
    state: string;
    x: number;
    y: number;
    target_x?: number | null;
    target_y?: number | null;
    spiral_step?: number;
    resources_carried?: number;
    mined_resource?: string | null;
  },
): Promise<void> {
  await query(
    `UPDATE station_mining_ships
       SET state=$2, x=$3, y=$4, target_x=$5, target_y=$6,
           spiral_step=$7, resources_carried=$8, mined_resource=$9
     WHERE id=$1`,
    [
      id, data.state, data.x, data.y,
      data.target_x ?? null, data.target_y ?? null,
      data.spiral_step ?? 0, data.resources_carried ?? 0,
      data.mined_resource ?? null,
    ],
  );
}

export async function countStationMiningShips(stationId: string): Promise<number> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM station_mining_ships WHERE station_id = $1',
    [stationId],
  );
  return Number(res.rows[0]?.count ?? 0);
}

/** Player stations that have at least one Werft level — eligible to operate mining ships. */
export async function getStationsEligibleForMining(): Promise<MiningStationRow[]> {
  const res = await query<MiningStationRow>(
    `SELECT id, owner_id, sector_x, sector_y, werft_level
       FROM player_stations WHERE werft_level >= 1`,
  );
  return res.rows;
}
```

- [ ] **Step 5: Build shared + run test — MUST PASS**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/db/__tests__/stationMiningQueries.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck touched file**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "stationMiningQueries" || echo clean`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db/migrations/088_station_mining_ships.sql packages/server/src/db/stationMiningQueries.ts packages/server/src/db/__tests__/stationMiningQueries.test.ts
git commit -m "feat: station_mining_ships table + queries (#549)"
```

---

## Task 2: Pure delivery decision (auto-sell vs store)

**Files:**
- Create: `packages/server/src/engine/stationMiningDelivery.ts`
- Test: `packages/server/src/engine/__tests__/stationMiningDelivery.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/server/src/engine/__tests__/stationMiningDelivery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveMiningDelivery } from '../stationMiningDelivery.js';
import { NPC_PRICES } from '@void-sector/shared';

describe('resolveMiningDelivery', () => {
  it('auto-sells when the station has a Markt (markt_level >= 1)', () => {
    const station = { markt_level: 1, cargo_level: 0, cargo_contents: {} };
    const r = resolveMiningDelivery(station, 'ore', 20);
    expect(r.mode).toBe('sell');
    expect(r.credits).toBeGreaterThan(0);
    expect(r.volume).toBe(Math.round(NPC_PRICES.ore * 20)); // base price, spread-independent
  });

  it('stores into station cargo (capped) when there is no Markt', () => {
    const station = { markt_level: 0, cargo_level: 1, cargo_contents: { ore: 0 } }; // cap 500
    const r = resolveMiningDelivery(station, 'ore', 20);
    expect(r.mode).toBe('store');
    expect(r.credits).toBe(0);
    expect(r.volume).toBe(0);
    expect(r.newCargo.ore).toBe(20);
  });

  it('drops overflow when the cargo cap is reached (no Markt)', () => {
    const station = { markt_level: 0, cargo_level: 0, cargo_contents: { ore: 195 } }; // cap 200
    const r = resolveMiningDelivery(station, 'ore', 20);
    expect(r.mode).toBe('store');
    expect(r.newCargo.ore).toBe(200); // only 5 fit, 15 lost
  });

  it('higher Markt level pays more per unit', () => {
    const low = resolveMiningDelivery({ markt_level: 1, cargo_level: 0, cargo_contents: {} }, 'crystal', 10);
    const high = resolveMiningDelivery({ markt_level: 5, cargo_level: 0, cargo_contents: {} }, 'crystal', 10);
    expect(high.mode === 'sell' && low.mode === 'sell').toBe(true);
    if (high.mode === 'sell' && low.mode === 'sell') {
      expect(high.credits).toBeGreaterThan(low.credits);
    }
  });
});
```

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationMiningDelivery.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `packages/server/src/engine/stationMiningDelivery.ts`**

```typescript
import {
  NPC_PRICES, NPC_SELL_SPREAD, MARKT_SPREAD_PER_LEVEL,
  stationCargoCapacity, type MineableResourceType,
} from '@void-sector/shared';

export interface DeliveryStation {
  markt_level: number;
  cargo_level: number;
  cargo_contents: Record<string, number>;
}

export type MiningDelivery =
  | { mode: 'sell'; credits: number; volume: number; newCargo: Record<string, number> }
  | { mode: 'store'; credits: number; volume: number; newCargo: Record<string, number> };

/**
 * Decide what happens to a station mining ship's haul on delivery.
 * With a Markt: auto-sell for credits (+ trade volume). Without: store in the
 * station's capped cargo, dropping any overflow.
 */
export function resolveMiningDelivery(
  station: DeliveryStation,
  resource: MineableResourceType,
  amount: number,
): MiningDelivery {
  const base = NPC_PRICES[resource];
  if (station.markt_level >= 1) {
    const unit = base * (NPC_SELL_SPREAD + MARKT_SPREAD_PER_LEVEL * station.markt_level);
    return {
      mode: 'sell',
      credits: Math.round(unit * amount),
      volume: Math.round(base * amount),
      newCargo: station.cargo_contents,
    };
  }
  const cap = stationCargoCapacity(station.cargo_level);
  const have = station.cargo_contents[resource] ?? 0;
  const stored = Math.max(0, Math.min(amount, cap - have));
  return {
    mode: 'store',
    credits: 0,
    volume: 0,
    newCargo: { ...station.cargo_contents, [resource]: have + stored },
  };
}
```

- [ ] **Step 4: Run test — MUST PASS**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationMiningDelivery.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/stationMiningDelivery.ts packages/server/src/engine/__tests__/stationMiningDelivery.test.ts
git commit -m "feat: station mining delivery decision (auto-sell vs store) (#549)"
```

---

## Task 3: `stationMiningService` — spawn + tick

**Files:**
- Create: `packages/server/src/engine/stationMiningService.ts`
- Test: `packages/server/src/engine/__tests__/stationMiningService.test.ts`

> Reuses `nextShipState` (drone branch) from `civShipService.ts` for movement/harvest, and `civShipBus.broadcastTick` for rendering. The delivery side-effects (auto-sell → credits + trade_volume + tier; or store → cargo) apply `resolveMiningDelivery` then the Phase-1 DB helpers. `STATION_MINING_SHIPS_PER_WERFT_LEVEL` (=1) × werft_level = ship cap per station.

- [ ] **Step 1: Write the failing test (all DB + bus mocked)**

`packages/server/src/engine/__tests__/stationMiningService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const q = {
  getAllStationMiningShips: vi.fn(),
  createStationMiningShip: vi.fn().mockResolvedValue(1),
  updateStationMiningShip: vi.fn().mockResolvedValue(undefined),
  countStationMiningShips: vi.fn().mockResolvedValue(0),
  getStationsEligibleForMining: vi.fn().mockResolvedValue([]),
  toCivShip: (row: any) => ({
    id: row.id, faction: 'humans', ship_type: 'mining_drone', role: 'drone',
    state: row.state, x: row.x, y: row.y, home_x: row.home_x, home_y: row.home_y,
    target_x: row.target_x ?? undefined, target_y: row.target_y ?? undefined,
    spiral_step: row.spiral_step, resources_carried: row.resources_carried,
    mined_resource: row.mined_resource ?? undefined,
  }),
};
vi.mock('../../db/stationMiningQueries.js', () => q);

const station = {
  getPlayerStationById: vi.fn(),
  addTradeVolume: vi.fn().mockResolvedValue({ trade_volume: 500, level: 1 }),
  setStationLevel: vi.fn().mockResolvedValue(undefined),
  updateStationCargo: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../../db/stationQueries.js', () => station);

const addCredits = vi.fn().mockResolvedValue(0);
vi.mock('../../db/queries.js', () => ({ addCredits: (...a: unknown[]) => addCredits(...a) }));

const broadcastTick = vi.fn();
vi.mock('../../civShipBus.js', () => ({ civShipBus: { broadcastTick: (...a: unknown[]) => broadcastTick(...a) } }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { processStationMiningTick, spawnMissingStationMiningShips } from '../stationMiningService.js';

beforeEach(() => {
  Object.values(q).forEach((f) => typeof f === 'function' && (f as any).mockReset?.());
  q.createStationMiningShip.mockResolvedValue(1);
  q.updateStationMiningShip.mockResolvedValue(undefined);
  q.countStationMiningShips.mockResolvedValue(0);
  q.getStationsEligibleForMining.mockResolvedValue([]);
  q.getAllStationMiningShips.mockResolvedValue([]);
  station.getPlayerStationById.mockReset();
  station.addTradeVolume.mockReset().mockResolvedValue({ trade_volume: 500, level: 1 });
  station.setStationLevel.mockReset().mockResolvedValue(undefined);
  station.updateStationCargo.mockReset().mockResolvedValue(undefined);
  addCredits.mockReset().mockResolvedValue(0);
  broadcastTick.mockReset();
});

describe('spawnMissingStationMiningShips', () => {
  it('creates ships up to werft_level per station', async () => {
    q.getStationsEligibleForMining.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', sector_x: 5, sector_y: 5, werft_level: 2 },
    ]);
    q.countStationMiningShips.mockResolvedValue(0);
    await spawnMissingStationMiningShips();
    expect(q.createStationMiningShip).toHaveBeenCalledTimes(2); // 2 - 0
    expect(q.createStationMiningShip).toHaveBeenCalledWith(
      expect.objectContaining({ station_id: 'st1', owner_id: 'o1', home_x: 5, home_y: 5 }),
    );
  });

  it('does not exceed the werft cap', async () => {
    q.getStationsEligibleForMining.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', sector_x: 5, sector_y: 5, werft_level: 2 },
    ]);
    q.countStationMiningShips.mockResolvedValue(2);
    await spawnMissingStationMiningShips();
    expect(q.createStationMiningShip).not.toHaveBeenCalled();
  });
});

describe('processStationMiningTick', () => {
  it('advances and persists each ship', async () => {
    q.getAllStationMiningShips.mockResolvedValue([
      { id: 1, station_id: 'st1', owner_id: 'o1', state: 'idle', x: 5, y: 5, home_x: 5, home_y: 5, target_x: null, target_y: null, spiral_step: 0, resources_carried: 0, mined_resource: null },
    ]);
    await processStationMiningTick();
    // idle → exploring is a state change → persisted
    expect(q.updateStationMiningShip).toHaveBeenCalledWith(1, expect.objectContaining({ state: 'exploring' }));
    expect(broadcastTick).toHaveBeenCalled();
  });

  it('auto-sells the haul on delivery when the station has a Markt', async () => {
    // ship returning home with cargo, one step from home → becomes idle this tick
    q.getAllStationMiningShips.mockResolvedValue([
      { id: 1, station_id: 'st1', owner_id: 'o1', state: 'returning', x: 6, y: 5, home_x: 5, home_y: 5, target_x: 5, target_y: 5, spiral_step: 10, resources_carried: 20, mined_resource: 'ore' },
    ]);
    station.getPlayerStationById.mockResolvedValue({ id: 'st1', owner_id: 'o1', markt_level: 1, cargo_level: 0, cargo_contents: {}, level: 1, trade_volume: 0 });
    await processStationMiningTick();
    expect(addCredits).toHaveBeenCalledWith('o1', expect.any(Number));
    expect(station.addTradeVolume).toHaveBeenCalledWith('st1', expect.any(Number));
  });
});
```

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationMiningService.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `packages/server/src/engine/stationMiningService.ts`**

```typescript
import { QUADRANT_SIZE, STATION_MINING_SHIPS_PER_WERFT_LEVEL, stationTierForVolume, type CivShip, type MineableResourceType } from '@void-sector/shared';
import {
  getAllStationMiningShips, createStationMiningShip, updateStationMiningShip,
  countStationMiningShips, getStationsEligibleForMining, toCivShip,
} from '../db/stationMiningQueries.js';
import { getPlayerStationById, addTradeVolume, setStationLevel, updateStationCargo } from '../db/stationQueries.js';
import { addCredits } from '../db/queries.js';
import { civShipBus } from '../civShipBus.js';
import { nextShipState } from './civShipService.js';
import { resolveMiningDelivery } from './stationMiningDelivery.js';
import { logger } from '../utils/logger.js';

function sectorToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return { qx: Math.floor(x / QUADRANT_SIZE), qy: Math.floor(y / QUADRANT_SIZE) };
}

/** Ensure each Werft-equipped station operates up to (werft_level) mining ships. */
export async function spawnMissingStationMiningShips(): Promise<void> {
  const stations = await getStationsEligibleForMining();
  for (const st of stations) {
    const cap = st.werft_level * STATION_MINING_SHIPS_PER_WERFT_LEVEL;
    const have = await countStationMiningShips(st.id);
    for (let i = have; i < cap; i++) {
      await createStationMiningShip({
        station_id: st.id,
        owner_id: st.owner_id,
        x: st.sector_x,
        y: st.sector_y,
        home_x: st.sector_x,
        home_y: st.sector_y,
      });
    }
  }
}

/** Apply a station mining ship's haul on its return: auto-sell (Markt) or store. */
async function deliverHaul(stationId: string, resource: MineableResourceType, amount: number): Promise<void> {
  const station = await getPlayerStationById(stationId);
  if (!station) return;
  const decision = resolveMiningDelivery(
    { markt_level: station.markt_level, cargo_level: station.cargo_level, cargo_contents: station.cargo_contents },
    resource,
    amount,
  );
  if (decision.mode === 'sell') {
    if (decision.credits > 0) await addCredits(station.owner_id, decision.credits);
    const updated = await addTradeVolume(stationId, decision.volume);
    if (updated) {
      const newTier = stationTierForVolume(updated.trade_volume);
      if (newTier > updated.level) await setStationLevel(stationId, newTier);
    }
  } else {
    await updateStationCargo(stationId, decision.newCargo);
  }
}

/**
 * Tick player-station mining ships ONLY (a few dozen). Bounded: it never loads
 * the disabled NPC civ-ship fleet. Movement reuses nextShipState; rendering reuses
 * the civShipBus → SectorRoom → radar (mining_drone) path.
 */
export async function processStationMiningTick(): Promise<void> {
  try {
    await spawnMissingStationMiningShips();

    const rows = await getAllStationMiningShips();
    if (rows.length === 0) return;

    const quadrantShips = new Map<string, CivShip[]>();

    for (const row of rows) {
      const ship = toCivShip(row);
      const updates = nextShipState(ship, null, 0);
      const updated: CivShip = { ...ship, ...updates };

      if (Object.keys(updates).length > 0) {
        await updateStationMiningShip(row.id, {
          state: updated.state,
          x: updated.x,
          y: updated.y,
          target_x: updated.target_x ?? null,
          target_y: updated.target_y ?? null,
          spiral_step: updated.spiral_step ?? 0,
          resources_carried: updated.resources_carried ?? 0,
          mined_resource: updated.mined_resource ?? null,
        });

        // Delivery: ship just arrived home with a haul.
        if (row.state === 'returning' && updated.state === 'idle' && (row.resources_carried ?? 0) > 0) {
          const resource = (row.mined_resource ?? 'ore') as MineableResourceType;
          try {
            await deliverHaul(row.station_id, resource, row.resources_carried);
          } catch (err) {
            logger.error({ err, stationId: row.station_id }, 'Station mining delivery failed');
          }
        }
      }

      const { qx, qy } = sectorToQuadrant(updated.x, updated.y);
      const key = `${qx}:${qy}`;
      if (!quadrantShips.has(key)) quadrantShips.set(key, []);
      quadrantShips.get(key)!.push(updated);
    }

    for (const [key, ships] of quadrantShips) {
      const [qx, qy] = key.split(':').map(Number);
      civShipBus.broadcastTick({ qx, qy, ships });
    }
  } catch (err) {
    logger.error({ err }, 'processStationMiningTick error');
  }
}
```

- [ ] **Step 4: Build shared + run test — MUST PASS**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/engine/__tests__/stationMiningService.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck touched file**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "stationMiningService" || echo clean`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/stationMiningService.ts packages/server/src/engine/__tests__/stationMiningService.test.ts
git commit -m "feat: station mining service — spawn + bounded tick + auto-sell (#549)"
```

---

## Task 4: Wire the tick + reset support

**Files:**
- Modify: `packages/server/src/engine/universeBootstrap.ts`
- Modify: `packages/server/src/__tests__/universeBootstrap.test.ts`
- Modify: `packages/server/src/scripts/resetWorld.ts`
- Modify: `packages/server/src/scripts/__tests__/resetWorld.test.ts`

- [ ] **Step 1: Add the reset-list test assertion (failing)**

In `packages/server/src/scripts/__tests__/resetWorld.test.ts`, add inside the existing `describe('resetWorld table lists', ...)`:

```typescript
  it('wipes player-station mining ships', () => {
    expect(WORLD_RESET_TABLES).toContain('station_mining_ships');
  });
```

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/scripts/__tests__/resetWorld.test.ts`
Expected: FAIL — `station_mining_ships` not in the list yet.

- [ ] **Step 3: Add `station_mining_ships` to the reset list**

In `packages/server/src/scripts/resetWorld.ts`, in `WORLD_RESET_TABLES`, add `'station_mining_ships'` near the other player-station-related entries — place it BEFORE `'player_stations'` (it FK-references player_stations; the retry loop tolerates order, but children-first is cleaner). For example add the line immediately after `'player_drones',` and before `'player_stations',`:

```typescript
  'station_mining_ships',
  'player_stations',
```

- [ ] **Step 4: Run the reset test — MUST PASS**

Run: `cd packages/server && npx vitest run src/scripts/__tests__/resetWorld.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the tick into the universe loop**

In `packages/server/src/engine/universeBootstrap.ts`:
- Add the import next to `processStationBuildTick`:
```typescript
import { processStationMiningTick } from './stationMiningService.js';
```
- In the `UniverseTickEngine` callback, directly AFTER the existing `await processStationBuildTick();` line, add:
```typescript
    await processStationMiningTick();
```

- [ ] **Step 6: Mock the new tick in universeBootstrap.test.ts**

In `packages/server/src/__tests__/universeBootstrap.test.ts`, add a sibling `vi.mock` next to the `stationBuildTick.js` mock:

```typescript
vi.mock('../engine/stationMiningService.js', () => ({
  processStationMiningTick: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 7: Typecheck + run the affected tests**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "universeBootstrap|stationMiningService|resetWorld" || echo clean`
Then: `npx vitest run src/__tests__/universeBootstrap.test.ts src/scripts/__tests__/resetWorld.test.ts`
Expected: clean; all pass (universeBootstrap 7, resetWorld 9).

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/engine/universeBootstrap.ts packages/server/src/__tests__/universeBootstrap.test.ts packages/server/src/scripts/resetWorld.ts packages/server/src/scripts/__tests__/resetWorld.test.ts
git commit -m "feat: wire station mining tick + reset support (#549)"
```

---

## Task 5: Full regression + render-path verification

**Files:** none (verification)

- [ ] **Step 1: Build shared + run all suites**

Run:
```bash
cd packages/shared && npm run build && npx vitest run
cd ../server && npx vitest run
cd ../client && npx vitest run
```
Expected: all pass (shared, server, client). The 2 skipped server tests are pre-existing.

- [ ] **Step 2: Confirm the client render path is intact (no client change needed)**

Run: `grep -rn "civ_ships_tick\|mining_drone" packages/client/src/network/client.ts packages/client/src/canvas/RadarRenderer.ts`
Expected: the `civ_ships_tick` onMessage listener still exists in `client.ts` and `RadarRenderer.ts` still renders `mining_drone`. (Phase 2 emits via the same channel; these were NOT removed by Phase 1.) If either is missing, report it — the drones would tick server-side but not render.

- [ ] **Step 3: Commit any fixups (if needed)**

```bash
git add -A
git commit -m "test: align suites with station mining ships (#549)"
```

---

## Self-Review (by plan author)

**Spec coverage (Phase 2 / P2.1–P2.6):**
- P2.1 Werft prerequisite + cap (`werft_level × STATION_MINING_SHIPS_PER_WERFT_LEVEL`) → Task 3 `spawnMissingStationMiningShips` ✓
- P2.2 `station_mining_ships` table → Task 1 ✓
- P2.3 `stationMiningService` reusing the state machine; spiral target / harvest / deliver → Task 3 (reuses `nextShipState`) ✓; auto-sell + tier or store → Tasks 2+3 ✓
- P2.4 OOM-safe: loads only player-station ships, NPC civ-tick stays disabled → Task 3 (`getAllStationMiningShips` only) ✓
- P2.5 client render via existing `civ_ships_tick`/radar → reused, verified in Task 5; no client change ✓
- P2.6 tests per layer → Tasks 1-3 ✓
- resetWorld + `station_mining_ships` → Task 4 ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `StationMiningShipRow`, `toCivShip`, `MiningStationRow`, `resolveMiningDelivery`/`DeliveryStation`/`MiningDelivery`, `getStationsEligibleForMining`/`countStationMiningShips`/`createStationMiningShip`/`updateStationMiningShip`/`getAllStationMiningShips`, `processStationMiningTick`/`spawnMissingStationMiningShips` are defined once and used consistently. `nextShipState`, `civShipBus.broadcastTick`, and the Phase-1 helpers (`addTradeVolume`, `setStationLevel`, `updateStationCargo`, `addCredits`, `stationTierForVolume`, `stationCargoCapacity`) match their real signatures.

**Note (auto-sell price duplication):** `resolveMiningDelivery` recomputes the sell price inline with the same formula as Phase-1's `stationMarketDecision` (`NPC_PRICES × (NPC_SELL_SPREAD + MARKT_SPREAD_PER_LEVEL·level)`). Minor duplication of one formula; acceptable rather than refactoring the merged-and-deployed Phase-1 market code. If a reviewer prefers, extract a shared `stationSellUnitPrice(resource, marktLevel)` helper.

**Migration number:** 088 (087 was Phase 1's last). Confirm `ls packages/server/src/db/migrations/ | tail` shows 087 as the current max before starting.
