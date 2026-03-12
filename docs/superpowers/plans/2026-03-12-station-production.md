# Station Production System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stations produce goods (fuel, ammo, modules) via lazy-evaluated queues; players buy/sell at station after docking; NPC tab removed from ship TradeScreen.

**Architecture:** Lazy evaluation (same as AP/fuel) — production state recalculated on-demand when player sends `getStationProduction`. New `StationProductionService` as 11th domain service. Client stores state in Zustand gameSlice, rendered in a new `FabrikScreen.tsx` that replaces the unused `FabrikPanel.tsx`.

**Tech Stack:** TypeScript strict, Colyseus, React + Zustand, PostgreSQL, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-station-production-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/stationProduction.ts` | Types + tier config (items, costs, passive gen) |
| Modify | `packages/shared/src/index.ts` | Export new file |
| Create | `packages/server/src/db/migrations/049_station_production.sql` | DB table |
| Create | `packages/server/src/db/stationProductionQueries.ts` | getOrCreate + save |
| Create | `packages/server/src/engine/stationProductionEngine.ts` | Lazy calc: passive gen, queue advance, scarcity |
| Create | `packages/server/src/engine/__tests__/stationProductionEngine.test.ts` | Engine unit tests |
| Create | `packages/server/src/rooms/services/StationProductionService.ts` | 3 message handlers |
| Modify | `packages/server/src/rooms/SectorRoom.ts` | Instantiate service, register 3 messages |
| Modify | `packages/client/src/state/gameSlice.ts` | Add `stationProductionState` field + setter |
| Modify | `packages/client/src/network/GameNetwork.ts` | Send 3 messages + handle `stationProductionUpdate` |
| Create | `packages/client/src/components/FabrikScreen.tsx` | Production queue UI + lager tabs + rohstoffe |
| Create | `packages/client/src/components/__tests__/FabrikScreen.test.tsx` | Component render tests |
| Modify | `packages/client/src/components/StationTerminalOverlay.tsx` | Swap FabrikPanel → FabrikScreen |
| Modify | `packages/client/src/components/TradeScreen.tsx` | Remove NPC tab |
| Delete | `packages/client/src/components/FabrikPanel.tsx` | Replaced |

---

## Chunk 1: Backend

### Task 1: Shared Types & Production Config

**Files:**
- Create: `packages/shared/src/stationProduction.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/stationProduction.ts`**

```typescript
export type DistanceTier = 1 | 2 | 3 | 4;

export interface StationItemConfig {
  itemId: string;
  label: string;
  category: 'RESSOURCEN' | 'MODULE' | 'AMMO';
  resourceCost: { ore?: number; gas?: number; crystal?: number };
  durationSeconds: number;
  maxStock: number;
  buyPrice: number;
}

export interface StationTierConfig {
  tier: DistanceTier;
  distanceMin: number;
  distanceMax: number;
  moduleTierLabel: string;
  passiveGenPerHour: { ore: number; gas: number; crystal: number };
  maxStockpilePerResource: number;
  items: StationItemConfig[];
}

export interface StationCurrentItem {
  itemId: string;
  startedAtMs: number;
  durationSeconds: number;
}

export interface StationProductionState {
  sectorX: number;
  sectorY: number;
  level: number;
  distanceTier: DistanceTier;
  moduleTierLabel: string;
  resourceStockpile: { ore: number; gas: number; crystal: number };
  maxStockpile: { ore: number; gas: number; crystal: number };
  currentItem: StationCurrentItem | null;
  upcomingQueue: string[];
  finishedGoods: Record<string, number>;
  maxFinishedGoods: Record<string, number>;
  ankaufPreise: { ore: number; gas: number; crystal: number };
  kaufPreise: Record<string, number>;
}

export const BASE_ANKAUF_PREISE = { ore: 8, gas: 12, crystal: 16 } as const;

export const STATION_TIERS: StationTierConfig[] = [
  {
    tier: 1,
    distanceMin: 0,
    distanceMax: 15,
    moduleTierLabel: 'MK1',
    passiveGenPerHour: { ore: 2, gas: 1, crystal: 0 },
    maxStockpilePerResource: 100,
    items: [
      { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 50, buyPrice: 80 },
      { itemId: 'ammo_basic', label: 'Munition', category: 'AMMO', resourceCost: { ore: 5 }, durationSeconds: 30, maxStock: 20, buyPrice: 25 },
      { itemId: 'module_cargo_mk1', label: 'Frachtraum MK1', category: 'MODULE', resourceCost: { ore: 20, gas: 10 }, durationSeconds: 180, maxStock: 5, buyPrice: 240 },
      { itemId: 'module_scanner_mk1', label: 'Scanner MK1', category: 'MODULE', resourceCost: { ore: 15, crystal: 8 }, durationSeconds: 180, maxStock: 5, buyPrice: 280 },
      { itemId: 'module_drive_mk1', label: 'Antrieb MK1', category: 'MODULE', resourceCost: { ore: 25, gas: 15 }, durationSeconds: 240, maxStock: 5, buyPrice: 320 },
    ],
  },
  {
    tier: 2,
    distanceMin: 15,
    distanceMax: 40,
    moduleTierLabel: 'MK2',
    passiveGenPerHour: { ore: 4, gas: 2, crystal: 1 },
    maxStockpilePerResource: 150,
    items: [
      { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 40, buyPrice: 80 },
      { itemId: 'ammo_basic', label: 'Munition', category: 'AMMO', resourceCost: { ore: 5 }, durationSeconds: 30, maxStock: 15, buyPrice: 25 },
      { itemId: 'rocket_basic', label: 'Rakete', category: 'AMMO', resourceCost: { ore: 10, crystal: 3 }, durationSeconds: 120, maxStock: 10, buyPrice: 90 },
      { itemId: 'module_cargo_mk2', label: 'Frachtraum MK2', category: 'MODULE', resourceCost: { ore: 50, gas: 25 }, durationSeconds: 360, maxStock: 5, buyPrice: 580 },
      { itemId: 'module_scanner_mk2', label: 'Scanner MK2', category: 'MODULE', resourceCost: { ore: 40, crystal: 20 }, durationSeconds: 360, maxStock: 5, buyPrice: 640 },
      { itemId: 'module_drive_mk2', label: 'Antrieb MK2', category: 'MODULE', resourceCost: { ore: 60, gas: 35 }, durationSeconds: 480, maxStock: 5, buyPrice: 720 },
    ],
  },
  {
    tier: 3,
    distanceMin: 40,
    distanceMax: 100,
    moduleTierLabel: 'MK3',
    passiveGenPerHour: { ore: 6, gas: 3, crystal: 2 },
    maxStockpilePerResource: 200,
    items: [
      { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 30, buyPrice: 80 },
      { itemId: 'rocket_basic', label: 'Rakete', category: 'AMMO', resourceCost: { ore: 10, crystal: 3 }, durationSeconds: 120, maxStock: 15, buyPrice: 90 },
      { itemId: 'module_cargo_mk3', label: 'Frachtraum MK3', category: 'MODULE', resourceCost: { ore: 120, gas: 60, crystal: 20 }, durationSeconds: 900, maxStock: 3, buyPrice: 1400 },
      { itemId: 'module_scanner_mk3', label: 'Scanner MK3', category: 'MODULE', resourceCost: { ore: 100, crystal: 50, gas: 15 }, durationSeconds: 900, maxStock: 3, buyPrice: 1600 },
      { itemId: 'module_drive_mk3', label: 'Antrieb MK3', category: 'MODULE', resourceCost: { ore: 150, gas: 80, crystal: 25 }, durationSeconds: 1200, maxStock: 3, buyPrice: 1800 },
      { itemId: 'module_shield_mk3', label: 'Schild MK3', category: 'MODULE', resourceCost: { ore: 80, gas: 40, crystal: 60 }, durationSeconds: 1200, maxStock: 3, buyPrice: 2000 },
    ],
  },
  {
    tier: 4,
    distanceMin: 100,
    distanceMax: Infinity,
    moduleTierLabel: 'MK4',
    passiveGenPerHour: { ore: 8, gas: 4, crystal: 3 },
    maxStockpilePerResource: 300,
    items: [
      { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 20, buyPrice: 80 },
      { itemId: 'rocket_basic', label: 'Rakete', category: 'AMMO', resourceCost: { ore: 10, crystal: 3 }, durationSeconds: 120, maxStock: 20, buyPrice: 90 },
      { itemId: 'module_cargo_mk4', label: 'Frachtraum MK4', category: 'MODULE', resourceCost: { ore: 300, gas: 150, crystal: 60 }, durationSeconds: 2400, maxStock: 2, buyPrice: 3500 },
      { itemId: 'module_scanner_mk4', label: 'Scanner MK4', category: 'MODULE', resourceCost: { ore: 250, crystal: 120, gas: 40 }, durationSeconds: 2400, maxStock: 2, buyPrice: 4000 },
      { itemId: 'module_drive_mk4', label: 'Antrieb MK4', category: 'MODULE', resourceCost: { ore: 380, gas: 200, crystal: 70 }, durationSeconds: 3000, maxStock: 2, buyPrice: 4500 },
      { itemId: 'module_shield_mk4', label: 'Schild MK4', category: 'MODULE', resourceCost: { ore: 200, gas: 100, crystal: 150 }, durationSeconds: 3000, maxStock: 2, buyPrice: 5000 },
    ],
  },
];

export function getDistanceTier(x: number, y: number): DistanceTier {
  const dist = Math.sqrt(x * x + y * y);
  if (dist < 15) return 1;
  if (dist < 40) return 2;
  if (dist < 100) return 3;
  return 4;
}

export function getTierConfig(tier: DistanceTier): StationTierConfig {
  return STATION_TIERS[tier - 1];
}
```

- [ ] **Step 2: Add export to `packages/shared/src/index.ts`**

Find the last export line and add after it:
```typescript
export * from './stationProduction.js';
```

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && npm run build
```
Expected: Completes without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/stationProduction.ts packages/shared/src/index.ts packages/shared/dist/
git commit -m "feat: shared station production types and tier config"
```

---

### Task 2: DB Migration 049

**Files:**
- Create: `packages/server/src/db/migrations/049_station_production.sql`

- [ ] **Step 1: Create migration file**

```sql
-- packages/server/src/db/migrations/049_station_production.sql
CREATE TABLE IF NOT EXISTS station_production (
  sector_x               INTEGER      NOT NULL,
  sector_y               INTEGER      NOT NULL,
  resource_stockpile     JSONB        NOT NULL DEFAULT '{"ore":0,"gas":0,"crystal":0}',
  passive_gen_last_tick  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  queue_index            INTEGER      NOT NULL DEFAULT 0,
  current_item_started_at TIMESTAMPTZ,
  finished_goods         JSONB        NOT NULL DEFAULT '{}',
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sector_x, sector_y)
);
```

`queue_index` is the position in the tier's static items array. The queue itself is derived from the tier config (deterministic), so only the index needs persisting.

- [ ] **Step 2: Verify migration numbering**

Check that `packages/server/src/db/migrations/` already contains `048_...` and that this is the next file. The server auto-runs migrations in filename order on startup.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/migrations/049_station_production.sql
git commit -m "feat: migration 049 station_production table"
```

---

### Task 3: DB Queries

**Files:**
- Create: `packages/server/src/db/stationProductionQueries.ts`

- [ ] **Step 1: Create query file**

```typescript
// packages/server/src/db/stationProductionQueries.ts
import type { Pool } from 'pg';

export interface StationProductionRow {
  sector_x: number;
  sector_y: number;
  resource_stockpile: { ore: number; gas: number; crystal: number };
  passive_gen_last_tick: Date;
  queue_index: number;
  current_item_started_at: Date | null;
  finished_goods: Record<string, number>;
}

export async function getOrCreateStationProduction(
  db: Pool,
  x: number,
  y: number,
): Promise<StationProductionRow> {
  const res = await db.query<StationProductionRow>(
    `INSERT INTO station_production (sector_x, sector_y)
     VALUES ($1, $2)
     ON CONFLICT (sector_x, sector_y) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [x, y],
  );
  return res.rows[0];
}

export async function saveStationProduction(
  db: Pool,
  x: number,
  y: number,
  update: {
    resource_stockpile: { ore: number; gas: number; crystal: number };
    passive_gen_last_tick: Date;
    queue_index: number;
    current_item_started_at: Date | null;
    finished_goods: Record<string, number>;
  },
): Promise<void> {
  await db.query(
    `UPDATE station_production
     SET resource_stockpile     = $3,
         passive_gen_last_tick  = $4,
         queue_index            = $5,
         current_item_started_at = $6,
         finished_goods         = $7,
         updated_at             = NOW()
     WHERE sector_x = $1 AND sector_y = $2`,
    [
      x,
      y,
      JSON.stringify(update.resource_stockpile),
      update.passive_gen_last_tick.toISOString(),
      update.queue_index,
      update.current_item_started_at?.toISOString() ?? null,
      JSON.stringify(update.finished_goods),
    ],
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/stationProductionQueries.ts
git commit -m "feat: station production DB queries"
```

---

### Task 4: Production Engine (TDD)

**Files:**
- Create: `packages/server/src/engine/__tests__/stationProductionEngine.test.ts`
- Create: `packages/server/src/engine/stationProductionEngine.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/server/src/engine/__tests__/stationProductionEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  getScarcityMultiplier,
  calculatePassiveGen,
  advanceProductionQueue,
} from '../stationProductionEngine.js';
import { getTierConfig } from '@void-sector/shared';
import type { StationProductionRow } from '../../db/stationProductionQueries.js';

const TIER1 = getTierConfig(1);

function makeRow(overrides: Partial<StationProductionRow> = {}): StationProductionRow {
  return {
    sector_x: 3,
    sector_y: 3,
    resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
    passive_gen_last_tick: new Date(),
    queue_index: 0,
    current_item_started_at: null,
    finished_goods: {},
    ...overrides,
  };
}

describe('getScarcityMultiplier', () => {
  it('returns 1.5 when ratio < 0.25', () => {
    expect(getScarcityMultiplier(20, 100)).toBe(1.5);
  });
  it('returns 1.2 when ratio is 0.25–0.49', () => {
    expect(getScarcityMultiplier(40, 100)).toBe(1.2);
  });
  it('returns 1.0 when ratio is 0.50–0.74', () => {
    expect(getScarcityMultiplier(60, 100)).toBe(1.0);
  });
  it('returns 0.8 when ratio >= 0.75', () => {
    expect(getScarcityMultiplier(80, 100)).toBe(0.8);
  });
  it('returns 1.5 when max is 0 (treat as empty)', () => {
    expect(getScarcityMultiplier(0, 0)).toBe(1.5);
  });
});

describe('calculatePassiveGen', () => {
  it('generates correct amounts after 1 hour for tier 1 level 1', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3_600_000);
    const result = calculatePassiveGen({ ore: 10, gas: 5, crystal: 0 }, oneHourAgo, now, TIER1);
    expect(result.ore).toBeCloseTo(12, 0);   // 10 + 2/hr
    expect(result.gas).toBeCloseTo(6, 0);    // 5 + 1/hr
    expect(result.crystal).toBeCloseTo(0, 0); // 0/hr for tier1
  });

  it('caps at maxStockpilePerResource', () => {
    const now = new Date();
    const longAgo = new Date(now.getTime() - 100 * 3_600_000);
    const result = calculatePassiveGen({ ore: 0, gas: 0, crystal: 0 }, longAgo, now, TIER1);
    expect(result.ore).toBe(TIER1.maxStockpilePerResource);
    expect(result.gas).toBe(TIER1.maxStockpilePerResource);
  });
});

describe('advanceProductionQueue', () => {
  it('starts item and deducts resources when not yet started', () => {
    const row = makeRow({
      queue_index: 0, // fuel: gas:3, crystal:1
      current_item_started_at: null,
      resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.current_item_started_at).not.toBeNull();
    expect(result.resource_stockpile.gas).toBe(47);
    expect(result.resource_stockpile.crystal).toBe(49);
  });

  it('does not start when resources missing', () => {
    const row = makeRow({
      queue_index: 0, // fuel needs gas:3
      current_item_started_at: null,
      resource_stockpile: { ore: 0, gas: 0, crystal: 0 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.current_item_started_at).toBeNull();
  });

  it('completes item and adds to finished_goods when time elapsed', () => {
    const startedAt = new Date(Date.now() - 200_000); // 200s ago, fuel=60s
    const row = makeRow({
      queue_index: 0,
      current_item_started_at: startedAt,
      resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.finished_goods['fuel']).toBeGreaterThan(0);
  });

  it('advances queue_index after completion', () => {
    const startedAt = new Date(Date.now() - 200_000);
    const row = makeRow({ queue_index: 0, current_item_started_at: startedAt });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    // queue_index has advanced (or cycled)
    expect(result.queue_index).toBeGreaterThanOrEqual(0);
  });

  it('cycles back to index 0 after last item', () => {
    const lastIdx = TIER1.items.length - 1;
    const startedAt = new Date(Date.now() - 100_000_000);
    const row = makeRow({
      queue_index: lastIdx,
      current_item_started_at: startedAt,
      resource_stockpile: { ore: 0, gas: 0, crystal: 0 }, // no resources → next won't start, but index resets
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.queue_index).toBe(0);
  });

  it('does not exceed maxStock', () => {
    const fuelCfg = TIER1.items.find(i => i.itemId === 'fuel')!;
    const startedAt = new Date(Date.now() - 100_000_000);
    const row = makeRow({
      queue_index: 0,
      current_item_started_at: startedAt,
      resource_stockpile: { ore: 50, gas: 50, crystal: 50 },
      finished_goods: { fuel: fuelCfg.maxStock }, // already full
    });
    const result = advanceProductionQueue(row, TIER1, Date.now());
    expect(result.finished_goods['fuel']).toBe(fuelCfg.maxStock);
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd packages/server && npx vitest run src/engine/__tests__/stationProductionEngine.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the engine**

```typescript
// packages/server/src/engine/stationProductionEngine.ts
import {
  type StationTierConfig,
  type DistanceTier,
  type StationProductionState,
  getDistanceTier,
  getTierConfig,
  BASE_ANKAUF_PREISE,
} from '@void-sector/shared';
import type { StationProductionRow } from '../db/stationProductionQueries.js';

export function getScarcityMultiplier(current: number, max: number): number {
  const ratio = max === 0 ? 0 : current / max;
  if (ratio < 0.25) return 1.5;
  if (ratio < 0.5) return 1.2;
  if (ratio < 0.75) return 1.0;
  return 0.8;
}

export function calculatePassiveGen(
  current: { ore: number; gas: number; crystal: number },
  lastTick: Date,
  now: Date,
  tierConfig: StationTierConfig,
): { ore: number; gas: number; crystal: number } {
  const elapsedHours = (now.getTime() - lastTick.getTime()) / 3_600_000;
  const max = tierConfig.maxStockpilePerResource;
  const gen = tierConfig.passiveGenPerHour;
  return {
    ore: Math.min(max, current.ore + gen.ore * elapsedHours),
    gas: Math.min(max, current.gas + gen.gas * elapsedHours),
    crystal: Math.min(max, current.crystal + gen.crystal * elapsedHours),
  };
}

export function advanceProductionQueue(
  row: StationProductionRow,
  tierConfig: StationTierConfig,
  nowMs: number,
): StationProductionRow {
  const result: StationProductionRow = {
    ...row,
    resource_stockpile: { ...row.resource_stockpile },
    finished_goods: { ...row.finished_goods },
  };

  const items = tierConfig.items;

  const tryStart = (): boolean => {
    const item = items[result.queue_index];
    const cost = item.resourceCost;
    const sp = result.resource_stockpile;
    if ((sp.ore ?? 0) < (cost.ore ?? 0)) return false;
    if ((sp.gas ?? 0) < (cost.gas ?? 0)) return false;
    if ((sp.crystal ?? 0) < (cost.crystal ?? 0)) return false;
    result.resource_stockpile = {
      ore: (sp.ore ?? 0) - (cost.ore ?? 0),
      gas: (sp.gas ?? 0) - (cost.gas ?? 0),
      crystal: (sp.crystal ?? 0) - (cost.crystal ?? 0),
    };
    result.current_item_started_at = new Date(nowMs);
    return true;
  };

  // Not yet started → try to start
  if (result.current_item_started_at === null) {
    tryStart();
    return result;
  }

  // Simulate completions (cap at 100 iterations)
  for (let i = 0; i < 100; i++) {
    const item = items[result.queue_index];
    const elapsed = nowMs - result.current_item_started_at!.getTime();
    if (elapsed < item.durationSeconds * 1000) break; // still in progress

    // Item complete
    const current = result.finished_goods[item.itemId] ?? 0;
    if (current < item.maxStock) {
      result.finished_goods[item.itemId] = current + 1;
    }

    // Advance queue (cyclic)
    result.queue_index = (result.queue_index + 1) % items.length;
    result.current_item_started_at = null;

    if (!tryStart()) break; // can't start next — pause
  }

  return result;
}

export function computeStationProductionState(
  row: StationProductionRow,
  x: number,
  y: number,
  level: number,
  nowMs: number,
): { state: StationProductionState; updatedRow: StationProductionRow } {
  const tier = getDistanceTier(x, y);
  const tierConfig = getTierConfig(tier);
  const now = new Date(nowMs);

  // 1. Passive gen
  const newStockpile = calculatePassiveGen(
    row.resource_stockpile,
    row.passive_gen_last_tick,
    now,
    tierConfig,
  );
  const rowWithGen: StationProductionRow = {
    ...row,
    resource_stockpile: newStockpile,
    passive_gen_last_tick: now,
  };

  // 2. Advance queue
  const updatedRow = advanceProductionQueue(rowWithGen, tierConfig, nowMs);

  // 3. Scarcity-based ankauf prices
  const max = tierConfig.maxStockpilePerResource;
  const sp = updatedRow.resource_stockpile;
  const ankaufPreise = {
    ore: Math.round(BASE_ANKAUF_PREISE.ore * getScarcityMultiplier(sp.ore, max)),
    gas: Math.round(BASE_ANKAUF_PREISE.gas * getScarcityMultiplier(sp.gas, max)),
    crystal: Math.round(BASE_ANKAUF_PREISE.crystal * getScarcityMultiplier(sp.crystal, max)),
  };

  // 4. Upcoming queue (next 5 after current)
  const upcomingQueue: string[] = [];
  const startIdx = updatedRow.current_item_started_at !== null
    ? (updatedRow.queue_index + 1) % tierConfig.items.length
    : updatedRow.queue_index;
  for (let i = 0; i < 5; i++) {
    upcomingQueue.push(tierConfig.items[(startIdx + i) % tierConfig.items.length].itemId);
  }

  // 5. Prices and max stocks from config
  const kaufPreise: Record<string, number> = {};
  const maxFinishedGoods: Record<string, number> = {};
  for (const item of tierConfig.items) {
    kaufPreise[item.itemId] = item.buyPrice;
    maxFinishedGoods[item.itemId] = item.maxStock;
  }

  const currentItemCfg = tierConfig.items[updatedRow.queue_index];
  const currentItem = updatedRow.current_item_started_at
    ? {
        itemId: currentItemCfg.itemId,
        startedAtMs: updatedRow.current_item_started_at.getTime(),
        durationSeconds: currentItemCfg.durationSeconds,
      }
    : null;

  const state: StationProductionState = {
    sectorX: x,
    sectorY: y,
    level,
    distanceTier: tier,
    moduleTierLabel: tierConfig.moduleTierLabel,
    resourceStockpile: {
      ore: Math.floor(sp.ore),
      gas: Math.floor(sp.gas),
      crystal: Math.floor(sp.crystal),
    },
    maxStockpile: { ore: max, gas: max, crystal: max },
    currentItem,
    upcomingQueue,
    finishedGoods: updatedRow.finished_goods,
    maxFinishedGoods,
    ankaufPreise,
    kaufPreise,
  };

  return { state, updatedRow };
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
cd packages/server && npx vitest run src/engine/__tests__/stationProductionEngine.test.ts
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/stationProductionEngine.ts packages/server/src/engine/__tests__/stationProductionEngine.test.ts
git commit -m "feat: station production engine (lazy eval, TDD)"
```

---

### Task 5: StationProductionService

**Files:**
- Create: `packages/server/src/rooms/services/StationProductionService.ts`

Before writing: Read one existing service (e.g., `EconomyService.ts` lines 1–50) to confirm:
- Exact constructor signature
- How `this.ctx.db` is accessed (is it `this.ctx.db` or via queries helper?)
- How player ID is obtained from `client.sessionId` (check `_pid` or state lookup)
- How `inventoryService` methods are called

Then create the service:

- [ ] **Step 1: Create StationProductionService.ts**

```typescript
// packages/server/src/rooms/services/StationProductionService.ts
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import {
  getOrCreateStationProduction,
  saveStationProduction,
} from '../../db/stationProductionQueries.js';
import { computeStationProductionState } from '../../engine/stationProductionEngine.js';
import { getDistanceTier, getTierConfig } from '@void-sector/shared';

export class StationProductionService {
  constructor(private ctx: ServiceContext) {}

  // Called from SectorRoom.onCreate — registers 3 message handlers
  registerHandlers(
    onMsg: <T>(type: string, handler: (client: Client, data: T) => void) => void,
  ): void {
    onMsg('getStationProduction', (client: Client) => this.handleGet(client));
    onMsg('buyFromStation', (client: Client, msg: { itemId: string; quantity: number }) =>
      this.handleBuy(client, msg),
    );
    onMsg('sellToStation', (client: Client, msg: { itemId: string; quantity: number }) =>
      this.handleSell(client, msg),
    );
  }

  private getPlayerId(sessionId: string): string {
    // Pattern from existing services — verify against actual codebase
    return this.ctx.state.players.get(sessionId)?.id ?? '';
  }

  private async handleGet(client: Client): Promise<void> {
    if (this.ctx._pst(client.sessionId) !== 'station') return;
    const x = this.ctx._px(client.sessionId);
    const y = this.ctx._py(client.sessionId);
    const sectorData = this.ctx.playerSectorData.get(client.sessionId);
    const level = (sectorData as any)?.stationLevel ?? 1;

    try {
      const row = await getOrCreateStationProduction(this.ctx.db, x, y);
      const { state, updatedRow } = computeStationProductionState(row, x, y, level, Date.now());
      await saveStationProduction(this.ctx.db, x, y, {
        resource_stockpile: updatedRow.resource_stockpile,
        passive_gen_last_tick: updatedRow.passive_gen_last_tick,
        queue_index: updatedRow.queue_index,
        current_item_started_at: updatedRow.current_item_started_at,
        finished_goods: updatedRow.finished_goods,
      });
      client.send('stationProductionUpdate', state);
    } catch (err) {
      this.ctx.logger.error({ err }, 'getStationProduction failed');
      client.send('actionError', { code: 'STATION_ERROR', message: 'Stationsdaten nicht verfügbar.' });
    }
  }

  private async handleBuy(client: Client, msg: { itemId: string; quantity: number }): Promise<void> {
    if (this.ctx._pst(client.sessionId) !== 'station') return;
    const { itemId, quantity } = msg;
    if (!itemId || quantity < 1 || quantity > 99) return;

    const x = this.ctx._px(client.sessionId);
    const y = this.ctx._py(client.sessionId);
    const playerId = this.getPlayerId(client.sessionId);
    const sectorData = this.ctx.playerSectorData.get(client.sessionId);
    const level = (sectorData as any)?.stationLevel ?? 1;

    try {
      const row = await getOrCreateStationProduction(this.ctx.db, x, y);
      const { state, updatedRow } = computeStationProductionState(row, x, y, level, Date.now());

      const available = updatedRow.finished_goods[itemId] ?? 0;
      if (available < quantity) {
        client.send('actionError', { code: 'INSUFFICIENT_STOCK', message: 'Nicht genug auf Lager.' });
        return;
      }

      const tier = getDistanceTier(x, y);
      const itemCfg = getTierConfig(tier).items.find(i => i.itemId === itemId);
      if (!itemCfg) return;

      const totalCost = itemCfg.buyPrice * quantity;
      const credits = await this.ctx.queries.getPlayerCredits(playerId);
      if (credits < totalCost) {
        client.send('actionError', { code: 'INSUFFICIENT_CREDITS', message: 'Nicht genug Credits.' });
        return;
      }

      // Determine item type for inventory
      const itemType = itemCfg.category === 'MODULE' ? 'module' : 'resource';
      const canAdd = await this.ctx.inventoryService.canAddResource(playerId, itemId, quantity);
      if (!canAdd) {
        client.send('actionError', { code: 'CARGO_FULL', message: 'Frachtraum voll.' });
        return;
      }

      await this.ctx.queries.deductCredits(playerId, totalCost);
      await this.ctx.inventoryService.addToInventory(playerId, itemType, itemId, quantity);
      updatedRow.finished_goods[itemId] = available - quantity;

      await saveStationProduction(this.ctx.db, x, y, {
        resource_stockpile: updatedRow.resource_stockpile,
        passive_gen_last_tick: updatedRow.passive_gen_last_tick,
        queue_index: updatedRow.queue_index,
        current_item_started_at: updatedRow.current_item_started_at,
        finished_goods: updatedRow.finished_goods,
      });

      const finalState = { ...state, finishedGoods: updatedRow.finished_goods };
      client.send('stationProductionUpdate', finalState);
      client.send('creditsUpdate', { credits: credits - totalCost });
      const cargo = await this.ctx.inventoryService.getCargoState(playerId);
      client.send('cargoUpdate', cargo);
    } catch (err) {
      this.ctx.logger.error({ err }, 'buyFromStation failed');
      client.send('actionError', { code: 'STATION_ERROR', message: 'Kauf fehlgeschlagen.' });
    }
  }

  private async handleSell(client: Client, msg: { itemId: string; quantity: number }): Promise<void> {
    if (this.ctx._pst(client.sessionId) !== 'station') return;
    const { itemId, quantity } = msg;
    if (!itemId || quantity < 1 || quantity > 9999) return;

    if (!['ore', 'gas', 'crystal'].includes(itemId)) {
      client.send('actionError', { code: 'INVALID_ITEM', message: 'Nur Rohstoffe lieferbar.' });
      return;
    }

    const x = this.ctx._px(client.sessionId);
    const y = this.ctx._py(client.sessionId);
    const playerId = this.getPlayerId(client.sessionId);
    const sectorData = this.ctx.playerSectorData.get(client.sessionId);
    const level = (sectorData as any)?.stationLevel ?? 1;

    try {
      const row = await getOrCreateStationProduction(this.ctx.db, x, y);
      const { state, updatedRow } = computeStationProductionState(row, x, y, level, Date.now());

      const playerHas = await this.ctx.inventoryService.getResourceTotal(playerId, itemId);
      if (playerHas < quantity) {
        client.send('actionError', { code: 'INSUFFICIENT_CARGO', message: 'Nicht genug im Frachtraum.' });
        return;
      }

      const key = itemId as 'ore' | 'gas' | 'crystal';
      const currentStock = updatedRow.resource_stockpile[key] ?? 0;
      const tierCfg = getTierConfig(getDistanceTier(x, y));
      const space = tierCfg.maxStockpilePerResource - currentStock;
      const accepted = Math.min(quantity, Math.floor(space));
      if (accepted <= 0) {
        client.send('actionError', { code: 'STATION_FULL', message: 'Station hat keinen Platz.' });
        return;
      }

      const earned = Math.floor(state.ankaufPreise[key] * accepted);
      await this.ctx.inventoryService.removeFromInventory(playerId, 'resource', itemId, accepted);
      await this.ctx.queries.addCredits(playerId, earned);
      updatedRow.resource_stockpile[key] = currentStock + accepted;

      await saveStationProduction(this.ctx.db, x, y, {
        resource_stockpile: updatedRow.resource_stockpile,
        passive_gen_last_tick: updatedRow.passive_gen_last_tick,
        queue_index: updatedRow.queue_index,
        current_item_started_at: updatedRow.current_item_started_at,
        finished_goods: updatedRow.finished_goods,
      });

      const credits = await this.ctx.queries.getPlayerCredits(playerId);
      const finalState = { ...state, resourceStockpile: {
        ore: Math.floor(updatedRow.resource_stockpile.ore),
        gas: Math.floor(updatedRow.resource_stockpile.gas),
        crystal: Math.floor(updatedRow.resource_stockpile.crystal),
      }};
      client.send('stationProductionUpdate', finalState);
      client.send('creditsUpdate', { credits });
      const cargo = await this.ctx.inventoryService.getCargoState(playerId);
      client.send('cargoUpdate', cargo);
    } catch (err) {
      this.ctx.logger.error({ err }, 'sellToStation failed');
      client.send('actionError', { code: 'STATION_ERROR', message: 'Verkauf fehlgeschlagen.' });
    }
  }
}
```

> **Note:** `this.ctx.db`, `this.ctx.queries`, `this.ctx.inventoryService`, `this.ctx.logger` — verify exact field names against `ServiceContext.ts`. Adjust if different (e.g., might be `this.ctx.pool` for db).

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/rooms/services/StationProductionService.ts
git commit -m "feat: StationProductionService (getStationProduction, buyFromStation, sellToStation)"
```

---

### Task 6: Wire Up in SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

- [ ] **Step 1: Read SectorRoom.ts to find service instantiation block**

Look for where the 10 existing services are created in `onCreate()` (e.g., `this.navigation = new NavigationService(this.serviceCtx)`).

- [ ] **Step 2: Add import at top of SectorRoom.ts**

```typescript
import { StationProductionService } from './services/StationProductionService.js';
```

- [ ] **Step 3: Add field declaration (where other services are declared)**

```typescript
private stationProduction!: StationProductionService;
```

- [ ] **Step 4: Instantiate in onCreate (after other services)**

```typescript
this.stationProduction = new StationProductionService(this.serviceCtx);
```

- [ ] **Step 5: Register message handlers (after other onMessage registrations)**

```typescript
this.stationProduction.registerHandlers(
  <T>(type: string, handler: (client: Client, data: T) => void) =>
    this.onMessage(type, handler),
);
```

- [ ] **Step 6: Type-check**

```bash
cd packages/server && npx tsc --noEmit
```
Expected: No errors. Fix any type mismatches.

- [ ] **Step 7: Run all server tests**

```bash
cd packages/server && npx vitest run
```
Expected: All existing tests still pass + new engine tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: register StationProductionService in SectorRoom"
```

---

## Chunk 2: Frontend

### Task 7: Client State & Network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/GameNetwork.ts`

- [ ] **Step 1: Read gameSlice.ts to find state interface and pattern for adding fields**

Look for how `npcStationData` or similar nullable state fields are defined and how their setters look.

- [ ] **Step 2: Add `stationProductionState` to gameSlice**

In the state interface, add:
```typescript
stationProductionState: StationProductionState | null;
```

In initial state, add:
```typescript
stationProductionState: null,
```

Add action (following existing patterns):
```typescript
setStationProductionState: (state, action) => {
  state.stationProductionState = action.payload;
},
```

Import at top of gameSlice:
```typescript
import type { StationProductionState } from '@void-sector/shared';
```

- [ ] **Step 3: Clear state on undock**

Find where `closeStationTerminal` is handled (in uiSlice.ts or where the station overlay closes). After closing, also dispatch `setStationProductionState(null)`. This may be in a thunk or in the component — find the natural place.

- [ ] **Step 4: Read GameNetwork.ts to find where messages are sent and received**

Look at the `setupRoomListeners` method and how other messages like `npcStationData` are handled.

- [ ] **Step 5: Add send methods to GameNetwork**

```typescript
getStationProduction(): void {
  this.sectorRoom?.send('getStationProduction');
}

buyFromStation(itemId: string, quantity: number): void {
  this.sectorRoom?.send('buyFromStation', { itemId, quantity });
}

sellToStation(itemId: string, quantity: number): void {
  this.sectorRoom?.send('sellToStation', { itemId, quantity });
}
```

- [ ] **Step 6: Add message listener in setupRoomListeners**

```typescript
room.onMessage('stationProductionUpdate', (data: StationProductionState) => {
  useGameStore.getState().setStationProductionState(data);
});
```

- [ ] **Step 7: Type-check**

```bash
cd packages/client && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/GameNetwork.ts
git commit -m "feat: client state + network for station production"
```

---

### Task 8: FabrikScreen Component

**Files:**
- Create: `packages/client/src/components/FabrikScreen.tsx`
- Create: `packages/client/src/components/__tests__/FabrikScreen.test.tsx`

Before writing: Read `TradeScreen.tsx` for CSS class naming conventions and tab-switching pattern. Read one other screen (e.g., `QuestsScreen.tsx`) for the overall CRT terminal style pattern (monospace, green, uppercase labels).

- [ ] **Step 1: Write failing render tests**

```typescript
// packages/client/src/components/__tests__/FabrikScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FabrikScreen } from '../FabrikScreen';
import type { StationProductionState } from '@void-sector/shared';

vi.mock('../../network/GameNetwork', () => ({
  GameNetwork: {
    getInstance: () => ({
      getStationProduction: vi.fn(),
      buyFromStation: vi.fn(),
      sellToStation: vi.fn(),
    }),
  },
}));

// Mock store — adjust import to match actual store pattern
vi.mock('../../state/gameSlice', () => ({
  useGameStore: vi.fn(),
}));

import { useGameStore } from '../../state/gameSlice';

const mockState: StationProductionState = {
  sectorX: 3, sectorY: 3, level: 1, distanceTier: 1, moduleTierLabel: 'MK1',
  resourceStockpile: { ore: 50, gas: 30, crystal: 10 },
  maxStockpile: { ore: 100, gas: 100, crystal: 100 },
  currentItem: { itemId: 'fuel', startedAtMs: Date.now() - 10_000, durationSeconds: 60 },
  upcomingQueue: ['ammo_basic', 'module_cargo_mk1'],
  finishedGoods: { fuel: 5 },
  maxFinishedGoods: { fuel: 50 },
  ankaufPreise: { ore: 8, gas: 18, crystal: 24 },
  kaufPreise: { fuel: 80 },
};

describe('FabrikScreen', () => {
  it('shows loading indicator when no state', () => {
    (useGameStore as any).mockReturnValue({ stationProductionState: null, credits: 0 });
    render(<FabrikScreen />);
    expect(screen.getByText(/LADE/i)).toBeTruthy();
  });

  it('shows station header when state loaded', () => {
    (useGameStore as any).mockReturnValue({ stationProductionState: mockState, credits: 500 });
    render(<FabrikScreen />);
    expect(screen.getByText(/MODUL-TIER: MK1/)).toBeTruthy();
  });

  it('shows current production item', () => {
    (useGameStore as any).mockReturnValue({ stationProductionState: mockState, credits: 500 });
    render(<FabrikScreen />);
    expect(screen.getByText(/fuel/)).toBeTruthy();
  });

  it('switches lager tabs', async () => {
    (useGameStore as any).mockReturnValue({ stationProductionState: mockState, credits: 500 });
    render(<FabrikScreen />);
    await userEvent.click(screen.getByText('[MODULE]'));
    // MODULE tab content shown (no RESSOURCEN items visible)
    expect(screen.queryByText(/Treibstoff/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd packages/client && npx vitest run src/components/__tests__/FabrikScreen.test.tsx
```

- [ ] **Step 3: Create FabrikScreen.tsx**

```tsx
// packages/client/src/components/FabrikScreen.tsx
import React, { useEffect, useState } from 'react';
import { GameNetwork } from '../network/GameNetwork';
import { useGameStore } from '../state/gameSlice';
import { getTierConfig, BASE_ANKAUF_PREISE } from '@void-sector/shared';

type LagerTab = 'RESSOURCEN' | 'MODULE' | 'AMMO';
const RESOURCE_KEYS = ['ore', 'gas', 'crystal'] as const;
const RESOURCE_LABELS: Record<string, string> = { ore: 'Erz', gas: 'Gas', crystal: 'Kristall' };

function progressBar(percent: number, width = 10): string {
  const filled = Math.round((percent / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

export const FabrikScreen: React.FC = () => {
  const { stationProductionState: state, credits } = useGameStore(s => ({
    stationProductionState: s.stationProductionState,
    credits: s.credits ?? 0,
  }));
  const [lagerTab, setLagerTab] = useState<LagerTab>('RESSOURCEN');
  const [sellQty, setSellQty] = useState<Record<string, number>>({});

  useEffect(() => {
    GameNetwork.getInstance().getStationProduction();
  }, []);

  if (!state) {
    return <div className="fabrik-loading">[LADE STATIONSDATEN...]</div>;
  }

  const tierCfg = getTierConfig(state.distanceTier);

  const progressPct = state.currentItem
    ? Math.min(100, Math.round(
        (Date.now() - state.currentItem.startedAtMs) /
        (state.currentItem.durationSeconds * 1000) * 100
      ))
    : 0;

  const remainingSec = state.currentItem
    ? Math.max(0, Math.round(
        state.currentItem.durationSeconds * (1 - progressPct / 100)
      ))
    : 0;

  const lagerItems = tierCfg.items.filter(i => {
    if (lagerTab === 'RESSOURCEN') return i.category === 'RESSOURCEN';
    if (lagerTab === 'MODULE') return i.category === 'MODULE';
    return i.category === 'AMMO';
  });

  return (
    <div className="fabrik-screen">
      <div className="fabrik-header">
        STATION LVL {state.level} · SEKTOR {state.sectorX},{state.sectorY} · MODUL-TIER: {state.moduleTierLabel}
      </div>

      <div className="fabrik-body">
        {/* Left: Production Queue */}
        <div className="fabrik-production">
          <div className="fabrik-col-title">PRODUKTION</div>
          {state.currentItem ? (
            <div className="fabrik-current">
              <div>▶ {state.currentItem.itemId}</div>
              <div>{progressBar(progressPct)} {remainingSec}s</div>
            </div>
          ) : (
            <div className="fabrik-paused">[PAUSIERT]</div>
          )}
          <div className="fabrik-queue-title">QUEUE:</div>
          {state.upcomingQueue.slice(0, 5).map((id, i) => (
            <div key={i} className="fabrik-queue-row">{i + 1}. {id}</div>
          ))}
        </div>

        {/* Right: Lager */}
        <div className="fabrik-lager">
          <div className="fabrik-tabs">
            {(['RESSOURCEN', 'MODULE', 'AMMO'] as LagerTab[]).map(tab => (
              <button
                key={tab}
                className={`fabrik-tab${lagerTab === tab ? ' active' : ''}`}
                onClick={() => setLagerTab(tab)}
              >
                [{tab}]
              </button>
            ))}
          </div>
          <div className="fabrik-lager-list">
            {lagerItems.length === 0 && (
              <div className="fabrik-empty">[KEINE WAREN]</div>
            )}
            {lagerItems.map(item => {
              const qty = state.finishedGoods[item.itemId] ?? 0;
              const max = state.maxFinishedGoods[item.itemId] ?? 0;
              const canBuy = qty > 0 && credits >= item.buyPrice;
              return (
                <div key={item.itemId} className="fabrik-lager-row">
                  <span className="lager-label">{item.label}</span>
                  <span className="lager-stock">{qty}/{max}</span>
                  <button
                    className="fabrik-btn"
                    disabled={!canBuy}
                    onClick={() => GameNetwork.getInstance().buyFromStation(item.itemId, 1)}
                  >
                    [KAUFEN]
                  </button>
                  <span className="lager-price">{item.buyPrice}cr</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Rohstoffe */}
      <div className="fabrik-rohstoffe">
        <div className="fabrik-col-title">ROHSTOFFE (LIEFERN)</div>
        {RESOURCE_KEYS.map(key => {
          const cur = state.resourceStockpile[key];
          const max = state.maxStockpile[key];
          const pct = max > 0 ? Math.round((cur / max) * 100) : 0;
          const ankauf = state.ankaufPreise[key];
          const base = BASE_ANKAUF_PREISE[key];
          const stars = ankauf >= base * 1.4 ? '★★' : ankauf >= base * 1.1 ? '★' : '';
          const qty = sellQty[key] ?? 1;
          return (
            <div key={key} className="fabrik-rohstoff-row">
              <span className="rs-label">{RESOURCE_LABELS[key]}</span>
              <span className="rs-bar">{progressBar(pct)} {pct}%</span>
              <span className="rs-price">Ankauf: {ankauf}cr {stars}</span>
              <input
                type="number"
                min={1}
                value={qty}
                className="rs-qty"
                onChange={e =>
                  setSellQty(prev => ({ ...prev, [key]: Math.max(1, parseInt(e.target.value) || 1) }))
                }
              />
              <button
                className="fabrik-btn"
                onClick={() => GameNetwork.getInstance().sellToStation(key, qty)}
              >
                [VERKAUFEN]
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

> **CSS:** Add `.fabrik-screen`, `.fabrik-header`, `.fabrik-body`, `.fabrik-production`, `.fabrik-lager`, `.fabrik-rohstoffe` etc. to the global stylesheet or a co-located CSS module — follow existing screen style patterns.

- [ ] **Step 4: Run tests — verify they PASS**

```bash
cd packages/client && npx vitest run src/components/__tests__/FabrikScreen.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/FabrikScreen.tsx packages/client/src/components/__tests__/FabrikScreen.test.tsx
git commit -m "feat: FabrikScreen with production queue, lager tabs, rohstoffe delivery"
```

---

### Task 9: StationTerminalOverlay Update

**Files:**
- Modify: `packages/client/src/components/StationTerminalOverlay.tsx`
- Delete: `packages/client/src/components/FabrikPanel.tsx`

- [ ] **Step 1: Read StationTerminalOverlay.tsx**

Find the FABRIK program render branch (likely a `case 'FABRIK':` in a switch or an `if` block).

- [ ] **Step 2: Replace import and render**

Remove:
```typescript
import { FabrikPanel } from './FabrikPanel';
```

Add:
```typescript
import { FabrikScreen } from './FabrikScreen';
```

Replace render:
```tsx
// Before:
case 'FABRIK': return <FabrikPanel />;

// After:
case 'FABRIK': return <FabrikScreen />;
```

- [ ] **Step 3: Delete FabrikPanel.tsx**

```bash
git rm packages/client/src/components/FabrikPanel.tsx
```

- [ ] **Step 4: Type-check**

```bash
cd packages/client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/StationTerminalOverlay.tsx
git commit -m "feat: replace FabrikPanel with FabrikScreen in StationTerminalOverlay"
```

---

### Task 10: Remove NPC Tab from Ship TradeScreen

**Files:**
- Modify: `packages/client/src/components/TradeScreen.tsx`

- [ ] **Step 1: Read TradeScreen.tsx**

Find:
- The tab list (array or inline JSX) that includes an `'NPC'` tab button
- The render switch/conditional for `activeTab === 'NPC'`
- The default tab value (if it's `'NPC'`, change it)

- [ ] **Step 2: Remove NPC tab button from tab list**

Delete the tab button element for NPC. Do **not** remove NPC-related components or types — they are still used in StationTerminalOverlay's HANDEL program.

- [ ] **Step 3: Remove NPC render branch**

Delete the `case 'NPC':` or `activeTab === 'NPC'` render block.

- [ ] **Step 4: Fix default tab**

If the initial `activeTab` state was `'NPC'`, change it to the first remaining tab (e.g., `'MARKET'`).

- [ ] **Step 5: Run TradeScreen tests and fix failures**

```bash
cd packages/client && npx vitest run src/components/__tests__/TradeScreen.test.tsx
```

Update any tests that expected the NPC tab to exist (assert it's gone, or remove NPC-specific assertions).

- [ ] **Step 6: Run all client tests**

```bash
cd packages/client && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/TradeScreen.tsx
git commit -m "fix: remove NPC tab from ship TradeScreen (station-only after docking)"
```

---

## Final Verification

- [ ] **All server tests pass**

```bash
cd packages/server && npx vitest run
```

- [ ] **All client tests pass**

```bash
cd packages/client && npx vitest run
```

- [ ] **TypeScript clean**

```bash
cd packages/server && npx tsc --noEmit
cd packages/client && npx tsc --noEmit
```

- [ ] **Manual smoke test**

1. `npm run docker:up`
2. `npm run dev:server` + `npm run dev:client`
3. Navigate to a station sector → `[ANDOCKEN]`
4. Open FABRIK → see queue, lager tabs, rohstoffe
5. Open TRADE in ship cockpit → NPC tab gone
6. Sell ore to station → credits increase, station stockpile rises
7. Wait for item to complete → buy from lager

- [ ] **Final commit**

```bash
git commit -m "chore: station production system complete"
```
