# Fuel System Overhaul (#291-A) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale fuel costs to 100/sector, set default tank to 10,000, add drive-module tank bonuses, and implement station GAS→FUEL tick production.

**Architecture:** All HULL `baseFuel` values become 10,000; `baseFuelPerJump` becomes 100 (the canonical cost per sector). Drive modules gain a `fuelMax` effect (bonus tank capacity), mirroring how scanner modules add `memory`. Station fuel production runs every 2 universe ticks (10 s) inside `universeBootstrap.ts`, calling a new pure function in `stationFuelEngine.ts` that converts station GAS stock into fuel stock using `npcStationQueries.ts`. `EconomyService.handleRefuel` is updated to draw from station fuel stock instead of treating fuel as unlimited.

**Tech Stack:** TypeScript · Colyseus (server) · PostgreSQL (npc_station_inventory) · Vitest

---

## Chunk 1: Constants, Types, ShipCalculator

### Task 1: Update HULLS baseFuel / baseFuelPerJump + FUEL_COST_PER_UNIT

**Files:**
- Modify: `packages/shared/src/constants.ts` (HULLS block ~lines 590–700, FUEL_COST_PER_UNIT ~line 2280)
- Test: `packages/server/src/engine/__tests__/fuel.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/server/src/engine/__tests__/fuel.test.ts
import { describe, it, expect } from 'vitest';
import { FUEL_COST_PER_UNIT, HULLS } from '@void-sector/shared';

describe('Fuel System (new values)', () => {
  it('all hulls have baseFuel 10_000', () => {
    for (const hull of Object.values(HULLS)) {
      expect(hull.baseFuel).toBe(10_000);
    }
  });

  it('all hulls have baseFuelPerJump 100', () => {
    for (const hull of Object.values(HULLS)) {
      expect(hull.baseFuelPerJump).toBe(100);
    }
  });

  it('FUEL_COST_PER_UNIT is 0.1', () => {
    expect(FUEL_COST_PER_UNIT).toBe(0.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/engine/__tests__/fuel.test.ts -t "new values"
```
Expected: FAIL — values still 80–200 and cost=2

- [ ] **Step 3: Update constants**

In `packages/shared/src/constants.ts`, set `baseFuel: 10_000` and `baseFuelPerJump: 100` in all 5 HULL definitions (scout, freighter, cruiser, explorer, battleship):

```typescript
// Each hull gets:
baseFuel: 10_000,
baseFuelPerJump: 100,
```

Also change `FUEL_COST_PER_UNIT`:
```typescript
export const FUEL_COST_PER_UNIT = 0.1; // 0.1 credits per fuel unit (was 2)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/engine/__tests__/fuel.test.ts -t "new values"
```
Expected: PASS

- [ ] **Step 5: Run full shared test suite to catch regressions**

```bash
cd packages/shared && npx vitest run
```
Fix any test that hard-codes old baseFuel/baseFuelPerJump values.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/server/src/engine/__tests__/fuel.test.ts
git commit -m "feat(fuel): set baseFuel=10k baseFuelPerJump=100 FUEL_COST_PER_UNIT=0.1"
```

---

### Task 2: Add fuelMax + fuelPerJump effects to drive modules + scale cargo_hold

**Files:**
- Modify: `packages/shared/src/constants.ts` (drive_mk1–5, void_drive, cargo_hold modules)
- Test: `packages/shared/src/__tests__/hyperdriveCalc.test.ts` (new assertions)

Context: `calculateShipStats` in `shipCalculator.ts` accumulates module `effects` into `stats`. Adding `fuelMax` to drive effects will automatically increase tank capacity. The `fuelPerJump` reduction on drives reduces per-sector cost (enhances range).

- [ ] **Step 1: Write failing test**

```typescript
// packages/shared/src/__tests__/hyperdriveCalc.test.ts — add to existing file:
describe('drive fuelMax bonus', () => {
  it('drive_mk1 adds 2_000 fuelMax', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk1', slotIndex: 0 }]);
    expect(stats.fuelMax).toBe(12_000); // 10_000 base + 2_000
  });

  it('drive_mk3 adds 7_000 fuelMax', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk3', slotIndex: 0 }]);
    expect(stats.fuelMax).toBe(17_000);
  });

  it('drive_mk5 adds 18_000 fuelMax', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk5', slotIndex: 0 }]);
    expect(stats.fuelMax).toBe(28_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/shared && npx vitest run src/__tests__/hyperdriveCalc.test.ts -t "drive fuelMax"
```
Expected: FAIL — no fuelMax effect on drives yet

- [ ] **Step 3: Add effects to drive modules in constants.ts**

```typescript
// drive_mk1 effects — add:
fuelMax: 2_000,

// drive_mk2 effects — add:
fuelMax: 4_000,

// drive_mk3 effects — add:
fuelMax: 7_000,

// drive_mk4 effects — add:
fuelMax: 12_000,

// drive_mk5 effects — add:
fuelMax: 18_000,

// void_drive: scale existing fuelPerJump from -3 to -30:
fuelPerJump: -30,
// void_drive secondaryEffects label: change 'Fuel/Sprung -3' → 'Fuel/Sprung -30'

// cargo modules (the 3 variants with fuelMax effect) — scale fuelMax: 20/40/80 → 2_000/4_000/8_000
// and their primaryEffect stat+label accordingly:
// cargo_mk3:  fuelMax: 2_000,  label: 'Fuel-Tank +2.000'
// cargo_mk4:  fuelMax: 4_000,  label: 'Fuel-Tank +4.000'
// cargo_mk5:  fuelMax: 8_000,  label: 'Fuel-Tank +8.000'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/shared && npx vitest run src/__tests__/hyperdriveCalc.test.ts -t "drive fuelMax"
```
Expected: PASS

- [ ] **Step 5: Extract FUEL_MIN_TANK constant + add clamp**

First add the constant to `packages/shared/src/constants.ts` near the other fuel constants:
```typescript
export const FUEL_MIN_TANK = 1_000; // minimum tank size regardless of hull+modules
```

Then in `packages/shared/src/shipCalculator.ts`, import and use it after existing clamps (line ~109):
```typescript
stats.fuelMax = Math.max(FUEL_MIN_TANK, stats.fuelMax);
```

Also add a test in `packages/shared/src/__tests__/hyperdriveCalc.test.ts`:
```typescript
it('fuelMax never falls below FUEL_MIN_TANK even with penalty modules', () => {
  // scout base 10_000 minus nothing = should be >= FUEL_MIN_TANK
  const stats = calculateShipStats('scout', []);
  expect(stats.fuelMax).toBeGreaterThanOrEqual(FUEL_MIN_TANK);
});
```

- [ ] **Step 6: Run full shared test suite**

```bash
cd packages/shared && npx vitest run
```
Fix any test checking exact fuelMax values.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/shipCalculator.ts packages/shared/src/__tests__/hyperdriveCalc.test.ts
git commit -m "feat(fuel): drive modules add fuelMax bonus (2k–18k), scale cargo_hold + void_drive"
```

---

### Task 3: Add station fuel production constants

**Files:**
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/shared/src/__tests__/stationFuel.test.ts (new file)
import { describe, it, expect } from 'vitest';
import {
  STATION_FUEL_BASELINE_PER_TICK,
  STATION_FUEL_GAS_RATE_PER_TICK,
  STATION_FUEL_PER_GAS,
  STATION_FUEL_MAX_STOCK,
  STATION_FUEL_LEVEL_EFFICIENCY,
} from '@void-sector/shared';

describe('station fuel production constants', () => {
  it('baseline is 10 fuel/tick', () => {
    expect(STATION_FUEL_BASELINE_PER_TICK).toBe(10);
  });

  it('gas rate is 100 fuel/tick at level 1', () => {
    expect(STATION_FUEL_GAS_RATE_PER_TICK * STATION_FUEL_LEVEL_EFFICIENCY[1]).toBe(100);
  });

  it('level 2 produces 120 fuel/tick', () => {
    expect(STATION_FUEL_GAS_RATE_PER_TICK * STATION_FUEL_LEVEL_EFFICIENCY[2]).toBe(120);
  });

  it('STATION_FUEL_PER_GAS is 1', () => {
    expect(STATION_FUEL_PER_GAS).toBe(1);
  });

  it('max stock defined', () => {
    expect(STATION_FUEL_MAX_STOCK).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/shared && npx vitest run src/__tests__/stationFuel.test.ts
```
Expected: FAIL — constants not defined

- [ ] **Step 3: Add constants to shared/constants.ts**

Near the existing fuel constants (~line 2280):
```typescript
// Station fuel production
export const STATION_FUEL_BASELINE_PER_TICK = 10;   // fuel produced per tick without gas
export const STATION_FUEL_GAS_RATE_PER_TICK = 100;  // fuel produced per tick when gas available (before efficiency)
export const STATION_FUEL_PER_GAS = 1;              // GAS units consumed per gas-enhanced tick
export const STATION_FUEL_MAX_STOCK = 50_000;       // cap per station
/** Efficiency multiplier per station level: level → rate multiplier (1.0 = 100 fuel/tick, 1.2 = 120 fuel/tick) */
export const STATION_FUEL_LEVEL_EFFICIENCY: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.4,
  4: 1.6,
  5: 2.0,
};
```

Note: `STATION_FUEL_GAS_RATE_PER_TICK * STATION_FUEL_LEVEL_EFFICIENCY[level]` gives fuel per tick when gas available: 100 at level 1, 120 at level 2, up to 200 at level 5. Consuming 1 GAS per tick triggers the enhanced rate.

- [ ] **Step 4: Run test**

```bash
cd packages/shared && npx vitest run src/__tests__/stationFuel.test.ts
```
Expected: PASS

- [ ] **Step 4b: Rebuild shared for downstream packages**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/stationFuel.test.ts
git commit -m "feat(fuel): add station fuel production constants (baseline/gas/level-efficiency)"
```

---

## Chunk 2: Station Fuel Production Engine

### Task 4: Station fuel production queries

**Files:**
- Modify: `packages/server/src/db/npcStationQueries.ts`
- Test: `packages/server/src/__tests__/stationFuelQueries.test.ts` (new)

Context: `npc_station_inventory` already tracks per-station item stocks. We add 'fuel' and 'gas' rows via the existing `upsertInventoryItem`. New helper functions wrap read-modify-write for the production tick.

- [ ] **Step 1: Write failing test**

```typescript
// packages/server/src/__tests__/stationFuelQueries.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../db/client.js';
import {
  getStationFuelAndGas,
  updateStationFuelStock,
  consumeStationGas,
  getAllStationsForFuelProduction,
} from '../db/npcStationQueries.js';

const mockQuery = vi.mocked(query);

describe('station fuel queries', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('getStationFuelAndGas returns fuel and gas rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { item_type: 'fuel', stock: 500, max_stock: 50000 },
        { item_type: 'gas',  stock: 10,  max_stock: 1000  },
      ],
    } as any);
    const result = await getStationFuelAndGas(3, 4);
    expect(result.fuel).toBe(500);
    expect(result.gas).toBe(10);
  });

  it('updateStationFuelStock calls upsert with capped value', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await updateStationFuelStock(3, 4, 1000, 50_000);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('npc_station_inventory'),
      expect.arrayContaining([3, 4, 'fuel', 1000]),
    );
  });

  it('consumeStationGas decrements gas stock', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    await consumeStationGas(3, 4, 1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('npc_station_inventory'),
      expect.arrayContaining([3, 4, 'gas', 1]),
    );
  });

  it('getAllStationsForFuelProduction maps columns to x/y/level', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ station_x: 10, station_y: 20, level: 3 }],
    } as any);
    const result = await getAllStationsForFuelProduction();
    expect(result).toEqual([{ x: 10, y: 20, level: 3 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/stationFuelQueries.test.ts
```
Expected: FAIL — functions not defined

- [ ] **Step 3: Add functions to npcStationQueries.ts**

```typescript
// packages/server/src/db/npcStationQueries.ts — append:

/** Returns { fuel, gas } stock for a station. Missing items treated as 0. */
export async function getStationFuelAndGas(
  x: number,
  y: number,
): Promise<{ fuel: number; gas: number }> {
  const result = await query<{ item_type: string; stock: number; max_stock: number }>(
    `SELECT item_type, stock, max_stock
     FROM npc_station_inventory
     WHERE station_x = $1 AND station_y = $2 AND item_type IN ('fuel', 'gas')`,
    [x, y],
  );
  const fuel = result.rows.find((r) => r.item_type === 'fuel')?.stock ?? 0;
  const gas  = result.rows.find((r) => r.item_type === 'gas')?.stock  ?? 0;
  return { fuel, gas };
}

/** Upserts the fuel stock for a station. Caps at maxStock. */
export async function updateStationFuelStock(
  x: number,
  y: number,
  newStock: number,
  maxStock: number,
): Promise<void> {
  const capped = Math.min(newStock, maxStock);
  await query(
    `INSERT INTO npc_station_inventory (station_x, station_y, item_type, stock, max_stock, consumption_rate, restock_rate, last_updated)
     VALUES ($1, $2, 'fuel', $3, $4, 0, 0, NOW())
     ON CONFLICT (station_x, station_y, item_type) DO UPDATE SET
       stock = EXCLUDED.stock,
       max_stock = EXCLUDED.max_stock,
       last_updated = NOW()`,
    [x, y, capped, maxStock],
  );
}

/** Decrements gas stock by amount. Does nothing if gas stock is already 0. */
export async function consumeStationGas(
  x: number,
  y: number,
  amount: number,
): Promise<void> {
  await query(
    `UPDATE npc_station_inventory
     SET stock = GREATEST(0, stock - $3), last_updated = NOW()
     WHERE station_x = $1 AND station_y = $2 AND item_type = 'gas'`,
    [x, y, amount],
  );
}

/** Returns all stations from npc_station_data (each runs fuel production regardless of current stock). */
export async function getAllStationsForFuelProduction(): Promise<
  Array<{ x: number; y: number; level: number }>
> {
  const result = await query<{ station_x: number; station_y: number; level: number }>(
    `SELECT DISTINCT d.station_x, d.station_y, d.level
     FROM npc_station_data d`,
    [],
  );
  return result.rows.map((r) => ({ x: r.station_x, y: r.station_y, level: r.level }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/__tests__/stationFuelQueries.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/npcStationQueries.ts packages/server/src/__tests__/stationFuelQueries.test.ts
git commit -m "feat(fuel): add station fuel/gas query helpers in npcStationQueries"
```

---

### Task 5: Station fuel production engine

**Files:**
- Create: `packages/server/src/engine/stationFuelEngine.ts`
- Test: `packages/server/src/engine/__tests__/stationFuelEngine.test.ts` (new)

- [ ] **Step 1: Write failing test**

```typescript
// packages/server/src/engine/__tests__/stationFuelEngine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateFuelProduction, runStationFuelProductionTick } from '../stationFuelEngine.js';

vi.mock('../../db/npcStationQueries.js', () => ({
  getAllStationsForFuelProduction: vi.fn(),
  getStationFuelAndGas: vi.fn(),
  updateStationFuelStock: vi.fn(),
  consumeStationGas: vi.fn(),
}));

import {
  getAllStationsForFuelProduction,
  getStationFuelAndGas,
  updateStationFuelStock,
  consumeStationGas,
} from '../../db/npcStationQueries.js';

describe('runStationFuelProductionTick', () => {
  it('calls updateStationFuelStock when fuel was added', async () => {
    vi.mocked(getAllStationsForFuelProduction).mockResolvedValue([{ x: 1, y: 2, level: 1 }]);
    vi.mocked(getStationFuelAndGas).mockResolvedValue({ fuel: 0, gas: 0 });
    vi.mocked(updateStationFuelStock).mockResolvedValue();
    vi.mocked(consumeStationGas).mockResolvedValue();

    await runStationFuelProductionTick();

    // baseline: 10 fuel/tick → updateStationFuelStock called with 10
    expect(updateStationFuelStock).toHaveBeenCalledWith(1, 2, 10, 50_000);
    expect(consumeStationGas).not.toHaveBeenCalled();
  });

  it('skips updateStationFuelStock when tank is full', async () => {
    vi.mocked(getAllStationsForFuelProduction).mockResolvedValue([{ x: 1, y: 2, level: 1 }]);
    vi.mocked(getStationFuelAndGas).mockResolvedValue({ fuel: 50_000, gas: 0 });
    vi.mocked(updateStationFuelStock).mockResolvedValue();

    await runStationFuelProductionTick();

    expect(updateStationFuelStock).not.toHaveBeenCalled();
  });
});

describe('calculateFuelProduction', () => {
  it('produces baseline fuel when no gas', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 0,
      fuelStock: 0,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(10);
    expect(gasToConsume).toBe(0);
  });

  it('produces gas-enhanced fuel when gas available', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 5,
      fuelStock: 0,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(100);
    expect(gasToConsume).toBe(1);
  });

  it('level 2 produces 120 fuel per gas', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 5,
      fuelStock: 0,
      maxFuelStock: 50_000,
      stationLevel: 2,
    });
    expect(fuelToAdd).toBe(120);
    expect(gasToConsume).toBe(1);
  });

  it('caps production at remaining tank space', () => {
    const { fuelToAdd } = calculateFuelProduction({
      gasStock: 0,
      fuelStock: 49_998,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(2); // only 2 space left
  });

  it('produces nothing when tank is full', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 10,
      fuelStock: 50_000,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(0);
    expect(gasToConsume).toBe(0);
  });

  it('caps gas-enhanced production at remaining tank space', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 5,
      fuelStock: 49_995,
      maxFuelStock: 50_000,
      stationLevel: 1, // gas rate = 100, space = 5
    });
    expect(fuelToAdd).toBe(5); // capped at remaining space
    expect(gasToConsume).toBe(1); // gas still consumed when gas path is chosen
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/engine/__tests__/stationFuelEngine.test.ts
```
Expected: FAIL — file doesn't exist

- [ ] **Step 3: Create stationFuelEngine.ts**

```typescript
// packages/server/src/engine/stationFuelEngine.ts
import {
  STATION_FUEL_BASELINE_PER_TICK,
  STATION_FUEL_GAS_RATE_PER_TICK,
  STATION_FUEL_PER_GAS,
  STATION_FUEL_MAX_STOCK,
  STATION_FUEL_LEVEL_EFFICIENCY,
} from '@void-sector/shared';
import {
  getAllStationsForFuelProduction,
  getStationFuelAndGas,
  updateStationFuelStock,
  consumeStationGas,
} from '../db/npcStationQueries.js';

export interface FuelProductionInput {
  gasStock: number;
  fuelStock: number;
  maxFuelStock: number;
  stationLevel: number;
}

export interface FuelProductionResult {
  fuelToAdd: number;
  gasToConsume: number;
}

/** Pure calculation — no DB calls. */
export function calculateFuelProduction(input: FuelProductionInput): FuelProductionResult {
  const { gasStock, fuelStock, maxFuelStock, stationLevel } = input;
  const space = maxFuelStock - fuelStock;
  if (space <= 0) return { fuelToAdd: 0, gasToConsume: 0 };

  const efficiency = STATION_FUEL_LEVEL_EFFICIENCY[stationLevel] ?? 1.0;
  const hasGas = gasStock >= STATION_FUEL_PER_GAS;

  const rawFuel = hasGas
    ? Math.round(STATION_FUEL_GAS_RATE_PER_TICK * efficiency)
    : STATION_FUEL_BASELINE_PER_TICK;

  return {
    fuelToAdd: Math.min(rawFuel, space),
    gasToConsume: hasGas ? STATION_FUEL_PER_GAS : 0,
  };
}

/** Runs one production tick across all known stations. */
export async function runStationFuelProductionTick(): Promise<void> {
  const stations = await getAllStationsForFuelProduction();
  await Promise.all(
    stations.map(async (station) => {
      const { fuel, gas } = await getStationFuelAndGas(station.x, station.y);
      const { fuelToAdd, gasToConsume } = calculateFuelProduction({
        gasStock: gas,
        fuelStock: fuel,
        maxFuelStock: STATION_FUEL_MAX_STOCK,
        stationLevel: station.level,
      });
      if (fuelToAdd > 0) {
        await updateStationFuelStock(station.x, station.y, fuel + fuelToAdd, STATION_FUEL_MAX_STOCK);
      }
      if (gasToConsume > 0) {
        await consumeStationGas(station.x, station.y, gasToConsume);
      }
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/engine/__tests__/stationFuelEngine.test.ts
```
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/stationFuelEngine.ts packages/server/src/engine/__tests__/stationFuelEngine.test.ts
git commit -m "feat(fuel): stationFuelEngine — pure calculateFuelProduction + runStationFuelProductionTick"
```

---

### Task 6: Wire fuel production into universe tick loop

**Files:**
- Modify: `packages/server/src/engine/universeBootstrap.ts`
- Test: verify via existing universeBootstrap or integration test

Context: `universeBootstrap.ts` runs a universe tick every `UNIVERSE_TICK_MS = 5000 ms`. `STRATEGIC_TICK_INTERVAL = 12` means strategic tick runs every 60 s. Fuel production should run every 2 ticks (every 10 s). The tick callback receives `result.tickCount`.

- [ ] **Step 1: Read universeBootstrap.ts tick loop**

Read `packages/server/src/engine/universeBootstrap.ts` lines 40–65 to understand the tick callback structure before editing.

- [ ] **Step 2: Add FUEL_PRODUCTION_TICK_INTERVAL constant**

At top of `universeBootstrap.ts`, after the existing constant:
```typescript
const FUEL_PRODUCTION_TICK_INTERVAL = 2; // every 2 universe ticks = 10 s
```

- [ ] **Step 3: Import and call runStationFuelProductionTick**

Add import at top:
```typescript
import { runStationFuelProductionTick } from './stationFuelEngine.js';
```

**⚠️ HAZARD:** The tick callback contains an early-return guard for the strategic tick:
```typescript
if (result.tickCount % STRATEGIC_TICK_INTERVAL !== 0) return;
```
Place the fuel production call **BEFORE** this guard, not after it — otherwise fuel production only runs on strategic ticks (every 60 s), not every 10 s.

Inside the tick callback, **before** the strategic tick early-return:
```typescript
// Fuel production tick (every 10 s) — must come BEFORE strategic tick early-return guard
if (result.tickCount % FUEL_PRODUCTION_TICK_INTERVAL === 0) {
  runStationFuelProductionTick().catch((err) =>
    logger.error({ err }, 'stationFuelProduction tick error'),
  );
}
```

- [ ] **Step 4: Run server tests**

```bash
cd packages/server && npx vitest run
```
Expected: all pass (no structural changes, just new fire-and-forget call)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/universeBootstrap.ts
git commit -m "feat(fuel): wire runStationFuelProductionTick into universe tick loop (every 10s)"
```

---

## Chunk 3: Refuel from Station Stock + Navigation Guards

### Task 7: EconomyService — refuel draws from station fuel stock

**Files:**
- Modify: `packages/server/src/rooms/services/EconomyService.ts` (~line 502–580)
- Modify: `packages/server/src/db/npcStationQueries.ts` (add atomic deduct helper)
- Test: `packages/server/src/__tests__/stationRefuel.test.ts` (new)

Context: Currently `handleRefuel` has no stock limit at stations — any amount can be bought. After this change, station refuel is limited to available fuel stock. On partial fills (stock < requested), refuel as much as available. **Note:** `getStationFuelAndGas` and `updateStationFuelStock` are defined in Task 4.

- [ ] **Step 1: Write failing test**

```typescript
// packages/server/src/__tests__/stationRefuel.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be hoisted before imports that use these modules
vi.mock('../db/npcStationQueries.js', () => ({
  getStationFuelAndGas: vi.fn(),
  deductStationFuelStock: vi.fn(),
}));

import { getStationFuelAndGas, deductStationFuelStock } from '../db/npcStationQueries.js';

const mockGetFuelAndGas = vi.mocked(getStationFuelAndGas);
const mockDeductFuelStock = vi.mocked(deductStationFuelStock);

/**
 * Thin helper that encapsulates the station-stock check logic from handleRefuel.
 * Test this helper; the full EconomyService test is an integration concern.
 */
async function stationRefuelCapped(
  stationX: number,
  stationY: number,
  requestedAmount: number,
): Promise<{ fillAmount: number; depleted: boolean }> {
  const { fuel } = await getStationFuelAndGas(stationX, stationY);
  const fillAmount = Math.min(requestedAmount, fuel);
  if (fillAmount <= 0) return { fillAmount: 0, depleted: true };
  await deductStationFuelStock(stationX, stationY, fillAmount);
  return { fillAmount, depleted: false };
}

describe('station refuel stock check', () => {
  beforeEach(() => {
    mockGetFuelAndGas.mockReset();
    mockDeductFuelStock.mockReset();
    mockDeductFuelStock.mockResolvedValue(undefined);
  });

  it('caps fill at station stock when stock < requested', async () => {
    mockGetFuelAndGas.mockResolvedValue({ fuel: 500, gas: 0 });
    const result = await stationRefuelCapped(3, 4, 1_000);
    expect(result.fillAmount).toBe(500);
    expect(result.depleted).toBe(false);
    expect(mockDeductFuelStock).toHaveBeenCalledWith(3, 4, 500);
  });

  it('returns depleted when station fuel is 0', async () => {
    mockGetFuelAndGas.mockResolvedValue({ fuel: 0, gas: 0 });
    const result = await stationRefuelCapped(3, 4, 1_000);
    expect(result.depleted).toBe(true);
    expect(mockDeductFuelStock).not.toHaveBeenCalled();
  });

  it('fills full requested amount when station has plenty', async () => {
    mockGetFuelAndGas.mockResolvedValue({ fuel: 50_000, gas: 0 });
    const result = await stationRefuelCapped(3, 4, 2_000);
    expect(result.fillAmount).toBe(2_000);
    expect(mockDeductFuelStock).toHaveBeenCalledWith(3, 4, 2_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/stationRefuel.test.ts
```
Expected: FAIL — `deductStationFuelStock` not defined yet in npcStationQueries

- [ ] **Step 3: Add deductStationFuelStock to npcStationQueries.ts + update EconomyService**

First add an **atomic** deduct helper to `packages/server/src/db/npcStationQueries.ts` (avoids race condition from read-then-write):
```typescript
/**
 * Atomically deducts amount from station fuel stock, clamped to 0.
 * Returns the actual amount deducted (may be less than requested if stock was low).
 */
export async function deductStationFuelStock(
  x: number,
  y: number,
  amount: number,
): Promise<number> {
  // CTE captures pre-update stock to compute exact deducted amount
  const result = await query<{ deducted: number }>(
    `WITH pre AS (
       SELECT stock FROM npc_station_inventory
       WHERE station_x = $1 AND station_y = $2 AND item_type = 'fuel'
       FOR UPDATE
     )
     UPDATE npc_station_inventory
     SET stock = GREATEST(0, npc_station_inventory.stock - $3),
         last_updated = NOW()
     FROM pre
     WHERE npc_station_inventory.station_x = $1
       AND npc_station_inventory.station_y = $2
       AND npc_station_inventory.item_type = 'fuel'
     RETURNING LEAST($3::integer, pre.stock) AS deducted`,
    [x, y, amount],
  );
  return result.rows[0]?.deducted ?? 0;
}
```

Then in `packages/server/src/rooms/services/EconomyService.ts`, import:
```typescript
import { getStationFuelAndGas, deductStationFuelStock } from '../../db/npcStationQueries.js';
```

Inside `handleRefuel`, after the "must be at station" check and the free-refuel gate, add:
```typescript
// Check station fuel stock (not applicable to free home-base refuel)
let availableAmount = data.amount;
if (isStation && !isFreeRefuel) {
  const { fuel: stationFuel } = await getStationFuelAndGas(pos.x, pos.y);
  availableAmount = Math.min(data.amount, stationFuel);
  if (availableAmount <= 0) {
    client.send('refuelResult', { success: false, error: 'Station fuel depleted' });
    return;
  }
}
```

Replace all references to `data.amount` in the remaining refuel logic with `availableAmount`.

After a successful refuel, atomically deduct from station stock:
```typescript
if (isStation && !isFreeRefuel) {
  await deductStationFuelStock(pos.x, pos.y, availableAmount);
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/stationRefuel.test.ts
cd packages/server && npx vitest run
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/npcStationQueries.ts packages/server/src/rooms/services/EconomyService.ts packages/server/src/__tests__/stationRefuel.test.ts
git commit -m "feat(fuel): refuel at station draws from fuel stock; atomic deductStationFuelStock"
```

---

### Task 8: Update farNav and fuel tests for new values

**Files:**
- Modify: `packages/server/src/engine/__tests__/farNav.test.ts`
- Modify: `packages/server/src/engine/__tests__/fuel.test.ts`
- Modify any other test file that hard-codes old fuel values

Context: After the constants changes in Tasks 1–2, several tests that compare expected fuel costs with old baseFuelPerJump (1–5) values will fail.

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npx vitest run 2>&1 | grep FAIL
```
List all failing tests.

- [ ] **Step 2: Fix farNav.test.ts**

In `farNav.test.ts`, update fuel cost assertions. With `baseFuelPerJump=100`:
```typescript
it('calculates fuel cost for scout hull', () => {
  const distance = 10;
  const fuelCost = distance * scout.baseFuelPerJump;
  expect(fuelCost).toBe(1_000); // was 10
});

it('calculates fuel cost for freighter hull', () => {
  const distance = 10;
  const fuelCost = distance * freighter.baseFuelPerJump;
  expect(fuelCost).toBe(1_000); // both are now 100/sector
});
```

- [ ] **Step 3: Fix all tests with hard-coded old fuel values**

Search for hard-coded `fuelMax: 100` and `baseFuel * FUEL_COST_PER_UNIT` assertions across all packages:
```bash
grep -rn "fuelMax: 100\b\|fuelMax:100\b" packages/ --include="*.test.*" --include="*.test.ts" --include="*.spec.ts"
grep -rn "baseFuel \* FUEL_COST_PER_UNIT\|\.baseFuel\b" packages/server/src/engine/__tests__/fuel.test.ts
```
Update `fuelMax: 100` → `fuelMax: 10_000` everywhere found (server tests, client tests, engine tests).

Also in `packages/server/src/engine/__tests__/fuel.test.ts`, find and update any assertion like:
```typescript
expect(hull.baseFuel * FUEL_COST_PER_UNIT).toBe(160); // old: baseFuel=80, cost=2
```
→ With new values: `baseFuel=10_000, FUEL_COST_PER_UNIT=0.1 → 10_000 * 0.1 = 1_000`:
```typescript
expect(hull.baseFuel * FUEL_COST_PER_UNIT).toBe(1_000);
```

- [ ] **Step 4: Run full server + client + shared test suites**

```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
# Stage only the test files identified by the grep in Step 3
git add packages/server/src/engine/__tests__/farNav.test.ts
git add packages/server/src/engine/__tests__/fuel.test.ts
# Add any additional files identified in Steps 1-3:
git status  # verify only test files are staged; do NOT use 'git add .' or 'git add packages/client/src'
git commit -m "test(fuel): update all tests for new 10k baseFuel / 100 baseFuelPerJump values"
```

---

## Chunk 4: Client — Fuel Display Validation

### Task 9: Verify fuel UI works with new scale

**Files:**
- Read: `packages/client/src/components/HUD.tsx` — fuel bar + low-fuel LED thresholds
- Read: `packages/client/src/components/ShipStatusPanel.tsx` — fuel bar display
- Read: `packages/client/src/components/NavTargetPanel.tsx` — autopilot engage gate (~line 56)
- Read: `packages/client/src/components/DetailPanel.tsx` — hyperjump button (~line 960)

Context: Fuel display components use `fuel.current / fuel.max` percentage comparisons — these are already scale-independent. However, two specific locations need fixing: (1) `NavTargetPanel.tsx` autopilot engage uses `fuel?.current >= 1` as "has enough fuel" guard, which is now meaningless at 10k scale; (2) the hyperjump button in `DetailPanel.tsx` has no fuel-sufficiency guard at all — it fires `sendHyperJump` unconditionally. The server will reject invalid jumps, but the client UX suffers.

- [ ] **Step 1: Verify percentage-based thresholds are unchanged**

```bash
grep -rn "fuel.*current\|fuel\.max\|fuelMax\|fuelCurrent" packages/client/src --include="*.tsx" | grep -v test | grep -v node_modules
```

Confirm that `HUD.tsx` and `ShipStatusPanel.tsx` use `fuel.current / fuel.max` style ratios (not absolute numbers < 100). These are already correct.

- [ ] **Step 2: Fix NavTargetPanel.tsx autopilot fuel gate**

In `packages/client/src/components/NavTargetPanel.tsx` (~line 56), find:
```typescript
fuel?.current >= 1
```
**Note:** `NavTargetPanel.tsx` does not currently subscribe to `ship` from the store. Add it alongside the existing subscriptions near the top of the component:
```typescript
const ship = useStore((s) => s.ship);
```
Then replace the gate with a meaningful check:
```typescript
const jumpCost = ship?.fuelPerJump ?? 100;
const canAffordNextHop = (fuel?.current ?? 0) >= jumpCost;
```
Use `canAffordNextHop` in place of the old `>= 1` check.

Also update the estimated fuel preview (~line 46) — the formula `Math.ceil(distance * 0.5)` assumed the old ~1 fuel/sector scale. With `baseFuelPerJump = 100`, replace with:
```typescript
const estimatedFuel = useHyperjump ? Math.ceil(distance * (ship?.fuelPerJump ?? 100)) : 0;
```

- [ ] **Step 3: Add fuel check to hyperjump button in DetailPanel.tsx**

In `packages/client/src/components/DetailPanel.tsx` (~line 960), find the hyperjump button. Read the component — `ship`, `fuel`, and `shipStats` are already subscribed; `fuelCost` is computed at ~line 955 via `calcHyperjumpFuel(shipStats.fuelPerJump, distance)` — it already reflects the full jump cost for the specific distance. Use it directly:
```typescript
const hasEnoughFuel = (fuel?.current ?? 0) >= fuelCost;
```
Disable the button when `!hasEnoughFuel`, mirroring how combat buttons check ammo. The server still validates, but disabled state prevents user confusion.

- [ ] **Step 4: Run client test suite**

```bash
cd packages/client && npx vitest run
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git status  # verify clean before commit
git add packages/client/src/components/NavTargetPanel.tsx packages/client/src/components/DetailPanel.tsx
git commit -m "fix(client): update fuel guards for 10k fuel scale (NavTargetPanel + DetailPanel)"
```

---

## Final Verification

- [ ] Verify all changes committed:
  ```bash
  git status  # should show clean working tree
  ```
- [ ] Rebuild shared package:
  ```bash
  cd packages/shared && npm run build
  ```
- [ ] Run all test suites:
  ```bash
  cd packages/shared && npx vitest run
  cd packages/server && npx vitest run
  cd packages/client && npx vitest run
  ```
- [ ] All green → ready for PR
