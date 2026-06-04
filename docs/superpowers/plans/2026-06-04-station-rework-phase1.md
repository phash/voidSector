# Station Rework Phase 1 (#548) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Player stations grow their tier automatically from trade volume ("Betrieb") and build six resource-funded expansions (factory, cargo, markt, werft, refinery, sensor) over a build timer, with a market for trading.

**Architecture:** Pure tier/cost helpers in `packages/shared`; new columns on `player_stations` (migration 087); a single `buildStationExpansion` flow (resource cost deducted from player → timed build → expansion level +1 via the universe tick) replacing the old credits-only level/module upgrades; a `stationMarketTrade` flow that drives `trade_volume` → auto tier-up; refinery + sensor effects read their levels. Phase 2 (#549, mining ships) is a separate plan written after this lands.

**Tech Stack:** TypeScript (strict, ESM `.js` imports server-side), PostgreSQL, Colyseus rooms, Vitest, React + Zustand client.

> **Build rule:** after editing `packages/shared/src/constants.ts`, run `cd packages/shared && npm run build` before server tests see the change.

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/server/src/db/migrations/087_station_expansions.sql` | new station columns | Create |
| `packages/shared/src/constants.ts` | tier thresholds, expansion types/costs, build time, cargo cap, markt spread + pure helpers | Modify |
| `packages/server/src/db/stationQueries.ts` | row type + queries for new columns, build set/complete, volume, cargo mutate | Modify |
| `packages/server/src/engine/stationBuildTick.ts` | completes timed expansion builds each universe tick | Create |
| `packages/server/src/engine/universeBootstrap.ts` | wire the build tick | Modify |
| `packages/server/src/rooms/services/WorldService.ts` | `handleBuildStationExpansion`, `handleStationMarketTrade`; remove old level/module upgrade handlers | Modify |
| `packages/server/src/rooms/SectorRoom.ts` | register/unregister station messages | Modify |
| `packages/server/src/engine/stationFuelEngine.ts` | refinery boost + credits trickle | Modify |
| `packages/server/src/rooms/services/ScanService.ts` | sensor scan-range bonus | Modify |
| `packages/client/src/components/StationManagePanel.tsx` | betrieb bar, expansion list + build buttons/timer, market tab | Modify |
| `packages/client/src/network/client.ts` | new senders | Modify |
| `packages/client/src/state/helpSlice.ts` (or help content) | `first_station_expansions` HelpSlice | Modify |

---

## Task 1: Shared constants + pure helpers

**Files:**
- Modify: `packages/shared/src/constants.ts` (after the Player Stations block, ~line 94)
- Test: `packages/shared/src/__tests__/stationExpansion.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/__tests__/stationExpansion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  stationTierForVolume,
  expansionCost,
  stationCargoCapacity,
  STATION_EXPANSION_TYPES,
  STATION_TIER_THRESHOLDS,
} from '../constants.js';

describe('stationTierForVolume', () => {
  it('maps trade volume to tiers via thresholds', () => {
    expect(stationTierForVolume(0)).toBe(1);
    expect(stationTierForVolume(999)).toBe(1);
    expect(stationTierForVolume(1000)).toBe(2);
    expect(stationTierForVolume(4000)).toBe(3);
    expect(stationTierForVolume(12000)).toBe(4);
    expect(stationTierForVolume(30000)).toBe(5);
    expect(stationTierForVolume(99999999)).toBe(5); // capped at MAX_STATION_LEVEL
  });
  it('threshold table has 5 entries starting at 0', () => {
    expect(STATION_TIER_THRESHOLDS.length).toBe(5);
    expect(STATION_TIER_THRESHOLDS[0]).toBe(0);
  });
});

describe('expansionCost', () => {
  it('scales the base cost by target level', () => {
    expect(expansionCost('cargo', 1)).toEqual({ ore: 30, gas: 5, crystal: 5, credits: 100, artefact: 0 });
    expect(expansionCost('cargo', 3)).toEqual({ ore: 90, gas: 15, crystal: 15, credits: 300, artefact: 0 });
    expect(expansionCost('werft', 2)).toEqual({ ore: 80, gas: 40, crystal: 50, credits: 800, artefact: 4 });
  });
  it('covers all six expansion types', () => {
    expect(STATION_EXPANSION_TYPES).toEqual(['factory', 'cargo', 'markt', 'werft', 'refinery', 'sensor']);
    for (const t of STATION_EXPANSION_TYPES) {
      expect(expansionCost(t, 1).ore).toBeGreaterThan(0);
    }
  });
});

describe('stationCargoCapacity', () => {
  it('grows with cargo level', () => {
    expect(stationCargoCapacity(0)).toBe(200);
    expect(stationCargoCapacity(3)).toBe(1100);
  });
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `cd packages/shared && npx vitest run src/__tests__/stationExpansion.test.ts`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Add the constants + helpers**

In `packages/shared/src/constants.ts`, immediately AFTER the existing line
`export const STATION_MODULE_UPGRADE_COST = (level: number): number => 200 * level * level;`
add:

```typescript
// ── Station tiers (Betrieb-driven growth) ──────────────────────────────
// trade_volume thresholds; index = tier-1. Station level auto-rises to the
// highest tier whose threshold the volume meets.
export const STATION_TIER_THRESHOLDS = [0, 1000, 4000, 12000, 30000] as const;

export function stationTierForVolume(volume: number): number {
  let tier = 1;
  for (let i = 0; i < STATION_TIER_THRESHOLDS.length; i++) {
    if (volume >= STATION_TIER_THRESHOLDS[i]) tier = i + 1;
  }
  return Math.min(tier, MAX_STATION_LEVEL);
}

// ── Station expansions ────────────────────────────────────────────────
export type StationExpansionType =
  | 'factory' | 'cargo' | 'markt' | 'werft' | 'refinery' | 'sensor';

export const STATION_EXPANSION_TYPES: StationExpansionType[] = [
  'factory', 'cargo', 'markt', 'werft', 'refinery', 'sensor',
];

export interface ExpansionResourceCost {
  ore: number; gas: number; crystal: number; credits: number; artefact: number;
}

/** Base cost for level 1; expansionCost() scales by target level. */
export const STATION_EXPANSION_BASE_COSTS: Record<StationExpansionType, ExpansionResourceCost> = {
  factory:  { ore: 20, gas: 10, crystal: 15, credits: 200, artefact: 0 },
  cargo:    { ore: 30, gas: 5,  crystal: 5,  credits: 100, artefact: 0 },
  markt:    { ore: 15, gas: 20, crystal: 10, credits: 300, artefact: 0 },
  werft:    { ore: 40, gas: 20, crystal: 25, credits: 400, artefact: 2 },
  refinery: { ore: 25, gas: 30, crystal: 10, credits: 250, artefact: 0 },
  sensor:   { ore: 20, gas: 15, crystal: 20, credits: 250, artefact: 1 },
};

export function expansionCost(type: StationExpansionType, targetLevel: number): ExpansionResourceCost {
  const b = STATION_EXPANSION_BASE_COSTS[type];
  return {
    ore: b.ore * targetLevel,
    gas: b.gas * targetLevel,
    crystal: b.crystal * targetLevel,
    credits: b.credits * targetLevel,
    artefact: b.artefact * targetLevel,
  };
}

/** Build time for reaching targetLevel of any expansion. */
export const STATION_EXPANSION_BUILD_TIME_MS = (targetLevel: number): number => 60_000 * targetLevel;

// Station cargo (resource storage) capacity by cargo_level.
export const STATION_CARGO_BASE = 200;
export const STATION_CARGO_PER_LEVEL = 300;
export function stationCargoCapacity(cargoLevel: number): number {
  return STATION_CARGO_BASE + cargoLevel * STATION_CARGO_PER_LEVEL;
}

// Markt: each level improves the trade spread in the player's favour.
export const MARKT_SPREAD_PER_LEVEL = 0.04;

// Refinery: credits trickle per universe tick per refinery level.
export const REFINERY_CREDITS_PER_TICK = 2;

// Sensor: +1 scan sector per sensor level around the station's quadrant.
export const SENSOR_SCAN_BONUS_PER_LEVEL = 1;

// Phase 2 (#549) — mining ships per werft level.
export const STATION_MINING_SHIPS_PER_WERFT_LEVEL = 1;
```

- [ ] **Step 4: Build shared + run test — must PASS**

Run: `cd packages/shared && npm run build && npx vitest run src/__tests__/stationExpansion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/dist packages/shared/src/__tests__/stationExpansion.test.ts
git commit -m "feat: station tier/expansion constants + pure helpers (#548)"
```

---

## Task 2: Migration 087 + stationQueries row type & new-column queries

**Files:**
- Create: `packages/server/src/db/migrations/087_station_expansions.sql`
- Modify: `packages/server/src/db/stationQueries.ts`
- Test: `packages/server/src/db/__tests__/stationQueries.expansions.test.ts` (new) — pure-shape test only (no live DB)

> The server test suite runs without a live DB (DB-touching code is exercised via handlers in later tasks with mocked queries). This task's test only asserts the new `PlayerStationRow` fields exist on the type via a constructor helper, keeping it DB-free.

- [ ] **Step 1: Write the migration**

Create `packages/server/src/db/migrations/087_station_expansions.sql`:

```sql
ALTER TABLE player_stations
  ADD COLUMN IF NOT EXISTS trade_volume   BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markt_level    INTEGER NOT NULL DEFAULT 0 CHECK (markt_level    BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS werft_level    INTEGER NOT NULL DEFAULT 0 CHECK (werft_level    BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS refinery_level INTEGER NOT NULL DEFAULT 0 CHECK (refinery_level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS sensor_level   INTEGER NOT NULL DEFAULT 0 CHECK (sensor_level   BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS building_expansion TEXT,
  ADD COLUMN IF NOT EXISTS build_complete_at  TIMESTAMPTZ;
```

- [ ] **Step 2: Write the failing test**

Create `packages/server/src/db/__tests__/stationQueries.expansions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emptyExpansionLevels, type PlayerStationRow } from '../stationQueries.js';

describe('PlayerStationRow expansion fields', () => {
  it('emptyExpansionLevels returns all six expansion levels at 0', () => {
    expect(emptyExpansionLevels()).toEqual({
      factory: 0, cargo: 0, markt: 0, werft: 0, refinery: 0, sensor: 0,
    });
  });

  it('row type carries the new columns', () => {
    const row: PlayerStationRow = {
      id: 'x', owner_id: 'o', sector_x: 1, sector_y: 2, quadrant_x: 0, quadrant_y: 0,
      level: 1, factory_level: 0, cargo_level: 0, cargo_contents: {},
      trade_volume: 0, markt_level: 0, werft_level: 0, refinery_level: 0, sensor_level: 0,
      building_expansion: null, build_complete_at: null, created_at: 'now',
    };
    expect(row.markt_level).toBe(0);
  });
});
```

- [ ] **Step 3: Run it — must FAIL**

Run: `cd packages/server && npx vitest run src/db/__tests__/stationQueries.expansions.test.ts`
Expected: FAIL — `emptyExpansionLevels` not exported; row type missing fields.

- [ ] **Step 4: Extend stationQueries.ts**

In `packages/server/src/db/stationQueries.ts`, replace the `PlayerStationRow` interface with the extended version and add the new helpers/queries. Replace:

```typescript
export interface PlayerStationRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  quadrant_x: number;
  quadrant_y: number;
  level: number;
  factory_level: number;
  cargo_level: number;
  cargo_contents: Record<string, number>;
  created_at: string;
}
```

with:

```typescript
import type { StationExpansionType } from '@void-sector/shared';

export interface PlayerStationRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  quadrant_x: number;
  quadrant_y: number;
  level: number;
  factory_level: number;
  cargo_level: number;
  markt_level: number;
  werft_level: number;
  refinery_level: number;
  sensor_level: number;
  cargo_contents: Record<string, number>;
  trade_volume: number;
  building_expansion: StationExpansionType | null;
  build_complete_at: string | null;
  created_at: string;
}

/** Column name on player_stations for an expansion's level. */
export function expansionLevelColumn(type: StationExpansionType): string {
  return `${type}_level`;
}

export function emptyExpansionLevels(): Record<StationExpansionType, number> {
  return { factory: 0, cargo: 0, markt: 0, werft: 0, refinery: 0, sensor: 0 };
}
```

Then add these queries at the end of the file (before any trailing exports):

```typescript
/** Start a timed expansion build. Returns null if the station is already building. */
export async function startStationBuild(
  stationId: string,
  type: StationExpansionType,
  completeAtIso: string,
): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations
       SET building_expansion = $2, build_complete_at = $3
     WHERE id = $1 AND building_expansion IS NULL
     RETURNING *`,
    [stationId, type, completeAtIso],
  );
  return result.rows[0] ?? null;
}

/** Fetch stations whose timed build is due. */
export async function getDueStationBuilds(): Promise<PlayerStationRow[]> {
  const result = await query<PlayerStationRow>(
    `SELECT * FROM player_stations
     WHERE building_expansion IS NOT NULL AND build_complete_at <= NOW()`,
  );
  return result.rows;
}

/** Complete a build: bump the expansion level and clear the build fields. */
export async function completeStationBuild(
  stationId: string,
  type: StationExpansionType,
): Promise<void> {
  const col = expansionLevelColumn(type);
  await query(
    `UPDATE player_stations
       SET ${col} = ${col} + 1, building_expansion = NULL, build_complete_at = NULL
     WHERE id = $1`,
    [stationId],
  );
}

/** Add to trade volume and raise level to the matching tier (never lowers). */
export async function addTradeVolume(stationId: string, amount: number): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations
       SET trade_volume = trade_volume + $2
     WHERE id = $1 RETURNING *`,
    [stationId, amount],
  );
  return result.rows[0] ?? null;
}

export async function setStationLevel(stationId: string, level: number): Promise<void> {
  await query(`UPDATE player_stations SET level = $2 WHERE id = $1`, [stationId, level]);
}

/** Overwrite station cargo_contents (resource storage). */
export async function setStationCargo(stationId: string, contents: Record<string, number>): Promise<void> {
  await query(
    `UPDATE player_stations SET cargo_contents = $2::jsonb WHERE id = $1`,
    [stationId, JSON.stringify(contents)],
  );
}
```

Note: `query` is already imported at the top of the file; `expansionLevelColumn` only ever receives a fixed `StationExpansionType` (never user input), so the interpolated column name is safe.

- [ ] **Step 5: Build shared (for the type import) + run test — must PASS**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/db/__tests__/stationQueries.expansions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/migrations/087_station_expansions.sql packages/server/src/db/stationQueries.ts packages/server/src/db/__tests__/stationQueries.expansions.test.ts
git commit -m "feat: migration 087 + station expansion queries (#548)"
```

---

## Task 3: Build-expansion validation helper (pure)

**Files:**
- Create: `packages/server/src/engine/stationExpansionService.ts`
- Test: `packages/server/src/engine/__tests__/stationExpansionService.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/engine/__tests__/stationExpansionService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateExpansionBuild } from '../stationExpansionService.js';

const baseStation = {
  level: 2, factory_level: 0, cargo_level: 0, markt_level: 0,
  werft_level: 0, refinery_level: 0, sensor_level: 0,
  building_expansion: null as string | null,
};

describe('validateExpansionBuild', () => {
  it('allows a build when target level <= station level and not already building', () => {
    const r = validateExpansionBuild(baseStation, 'markt');
    expect(r.ok).toBe(true);
    expect(r.targetLevel).toBe(1);
  });

  it('rejects when target level would exceed station tier', () => {
    const r = validateExpansionBuild({ ...baseStation, markt_level: 2 }, 'markt'); // target 3 > level 2
    expect(r.ok).toBe(false);
    expect(r.code).toBe('TIER_LOCKED');
  });

  it('rejects when expansion already at max level 5', () => {
    const r = validateExpansionBuild({ ...baseStation, level: 5, markt_level: 5 }, 'markt');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('MAX_LEVEL');
  });

  it('rejects when the station is already building something', () => {
    const r = validateExpansionBuild({ ...baseStation, building_expansion: 'cargo' }, 'markt');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BUSY');
  });
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationExpansionService.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helper**

Create `packages/server/src/engine/stationExpansionService.ts`:

```typescript
import { MAX_STATION_LEVEL, type StationExpansionType } from '@void-sector/shared';

/** Minimal station shape needed for build validation. */
export interface StationLevels {
  level: number;
  factory_level: number;
  cargo_level: number;
  markt_level: number;
  werft_level: number;
  refinery_level: number;
  sensor_level: number;
  building_expansion: string | null;
}

export type BuildValidation =
  | { ok: true; targetLevel: number }
  | { ok: false; code: 'BUSY' | 'TIER_LOCKED' | 'MAX_LEVEL'; message: string };

export function currentExpansionLevel(station: StationLevels, type: StationExpansionType): number {
  return station[`${type}_level` as keyof StationLevels] as number;
}

/** Validate that an expansion can be built one level higher right now. */
export function validateExpansionBuild(
  station: StationLevels,
  type: StationExpansionType,
): BuildValidation {
  if (station.building_expansion) {
    return { ok: false, code: 'BUSY', message: 'Station baut bereits eine Erweiterung' };
  }
  const current = currentExpansionLevel(station, type);
  const targetLevel = current + 1;
  if (current >= MAX_STATION_LEVEL) {
    return { ok: false, code: 'MAX_LEVEL', message: 'Erweiterung ist auf Maximalstufe' };
  }
  if (targetLevel > station.level) {
    return {
      ok: false,
      code: 'TIER_LOCKED',
      message: `Stations-Stufe (${station.level}) zu niedrig — mehr Handel nötig`,
    };
  }
  return { ok: true, targetLevel };
}
```

- [ ] **Step 4: Run test — must PASS**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationExpansionService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/stationExpansionService.ts packages/server/src/engine/__tests__/stationExpansionService.test.ts
git commit -m "feat: station expansion build validation (#548)"
```

---

## Task 4: Build-completion tick

**Files:**
- Create: `packages/server/src/engine/stationBuildTick.ts`
- Modify: `packages/server/src/engine/universeBootstrap.ts`
- Test: `packages/server/src/engine/__tests__/stationBuildTick.test.ts` (new)

- [ ] **Step 1: Write the failing test (DB queries mocked)**

Create `packages/server/src/engine/__tests__/stationBuildTick.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDueStationBuilds = vi.fn();
const completeStationBuild = vi.fn().mockResolvedValue(undefined);

vi.mock('../../db/stationQueries.js', () => ({
  getDueStationBuilds: (...a: unknown[]) => getDueStationBuilds(...a),
  completeStationBuild: (...a: unknown[]) => completeStationBuild(...a),
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processStationBuildTick } from '../stationBuildTick.js';

beforeEach(() => {
  getDueStationBuilds.mockReset();
  completeStationBuild.mockReset().mockResolvedValue(undefined);
});

describe('processStationBuildTick', () => {
  it('completes each due build with its expansion type', async () => {
    getDueStationBuilds.mockResolvedValue([
      { id: 's1', building_expansion: 'markt' },
      { id: 's2', building_expansion: 'werft' },
    ]);
    await processStationBuildTick();
    expect(completeStationBuild).toHaveBeenCalledWith('s1', 'markt');
    expect(completeStationBuild).toHaveBeenCalledWith('s2', 'werft');
    expect(completeStationBuild).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no builds are due', async () => {
    getDueStationBuilds.mockResolvedValue([]);
    await processStationBuildTick();
    expect(completeStationBuild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationBuildTick.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the tick**

Create `packages/server/src/engine/stationBuildTick.ts`:

```typescript
import { getDueStationBuilds, completeStationBuild } from '../db/stationQueries.js';
import { logger } from '../utils/logger.js';
import type { StationExpansionType } from '@void-sector/shared';

/**
 * Completes any player-station expansion builds whose timer has elapsed.
 * Lightweight: only touches player_stations rows currently building.
 */
export async function processStationBuildTick(): Promise<void> {
  const due = await getDueStationBuilds();
  for (const station of due) {
    const type = station.building_expansion as StationExpansionType | null;
    if (!type) continue;
    try {
      await completeStationBuild(station.id, type);
      logger.info({ stationId: station.id, type }, 'Station expansion build complete');
    } catch (err) {
      logger.error({ err, stationId: station.id }, 'Station build completion failed');
    }
  }
}
```

- [ ] **Step 4: Run test — must PASS**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationBuildTick.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the universe tick**

In `packages/server/src/engine/universeBootstrap.ts`: add the import near the other engine imports:

```typescript
import { processStationBuildTick } from './stationBuildTick.js';
```

Then in the `UniverseTickEngine` callback, directly after the existing
`await processConstructionTick();` line, add:

```typescript
    await processStationBuildTick();
```

- [ ] **Step 6: Typecheck touched file**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "universeBootstrap|stationBuildTick" || echo "no type errors in touched files"`
Expected: `no type errors in touched files`.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/engine/stationBuildTick.ts packages/server/src/engine/universeBootstrap.ts packages/server/src/engine/__tests__/stationBuildTick.test.ts
git commit -m "feat: station expansion build-completion tick (#548)"
```

---

## Task 5: `buildStationExpansion` handler (replaces old level/module upgrades)

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Test: `packages/server/src/rooms/services/__tests__/stationExpansionHandler.test.ts` (new)

> Context: existing handlers `handleUpgradeStation` and `handleUpgradeStationModule` (credits-only) are replaced by one resource-funded `handleBuildStationExpansion`. The old handlers and their message registrations are removed. Resource deduction uses: `getPlayerCredits(userId)`, `deductCredits(userId, amount)`, `getCargoState(userId)` → `{ore,gas,crystal,artefact,...}`, `removeFromInventory(userId, 'resource', resourceId, amount)`. Station fetched via `getPlayerStationById`. Player position via `this.ctx._px(sessionId)` / `_py`.

- [ ] **Step 1: Write the failing handler test**

Create `packages/server/src/rooms/services/__tests__/stationExpansionHandler.test.ts`. This tests the pure decision via a thin exported function `resolveExpansionBuild` (so it stays DB-free):

```typescript
import { describe, it, expect } from 'vitest';
import { resolveExpansionBuild } from '../stationExpansionDecision.js';

const station = {
  level: 2, factory_level: 0, cargo_level: 0, markt_level: 0,
  werft_level: 0, refinery_level: 0, sensor_level: 0, building_expansion: null,
};

describe('resolveExpansionBuild', () => {
  it('returns the cost + target level when affordable and tier-allowed', () => {
    const r = resolveExpansionBuild(station, 'markt', {
      credits: 1000, cargo: { ore: 100, gas: 100, crystal: 100, artefact: 5 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.targetLevel).toBe(1);
      expect(r.cost).toEqual({ ore: 15, gas: 20, crystal: 10, credits: 300, artefact: 0 });
    }
  });

  it('fails with INSUFFICIENT when resources are short', () => {
    const r = resolveExpansionBuild(station, 'werft', {
      credits: 10, cargo: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INSUFFICIENT');
  });

  it('fails with TIER_LOCKED when target exceeds station level', () => {
    const r = resolveExpansionBuild({ ...station, markt_level: 2 }, 'markt', {
      credits: 99999, cargo: { ore: 999, gas: 999, crystal: 999, artefact: 999 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('TIER_LOCKED');
  });
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/stationExpansionHandler.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the pure decision**

Create `packages/server/src/rooms/services/stationExpansionDecision.ts`:

```typescript
import { expansionCost, type ExpansionResourceCost, type StationExpansionType } from '@void-sector/shared';
import { validateExpansionBuild, type StationLevels } from '../../engine/stationExpansionService.js';

export interface PlayerResources {
  credits: number;
  cargo: { ore?: number; gas?: number; crystal?: number; artefact?: number };
}

export type ExpansionDecision =
  | { ok: true; targetLevel: number; cost: ExpansionResourceCost }
  | { ok: false; code: 'BUSY' | 'TIER_LOCKED' | 'MAX_LEVEL' | 'INSUFFICIENT'; message: string };

export function resolveExpansionBuild(
  station: StationLevels,
  type: StationExpansionType,
  res: PlayerResources,
): ExpansionDecision {
  const valid = validateExpansionBuild(station, type);
  if (!valid.ok) return valid;
  const cost = expansionCost(type, valid.targetLevel);
  const c = res.cargo;
  if (
    res.credits < cost.credits ||
    (c.ore ?? 0) < cost.ore ||
    (c.gas ?? 0) < cost.gas ||
    (c.crystal ?? 0) < cost.crystal ||
    (c.artefact ?? 0) < cost.artefact
  ) {
    return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug Ressourcen/Credits' };
  }
  return { ok: true, targetLevel: valid.targetLevel, cost };
}
```

- [ ] **Step 4: Run test — must PASS**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/stationExpansionHandler.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the handler in WorldService**

In `packages/server/src/rooms/services/WorldService.ts`:

5a. Add imports (extend the existing `@void-sector/shared` and stationQueries imports; add the decision import):

```typescript
import { expansionCost, STATION_EXPANSION_TYPES, STATION_EXPANSION_BUILD_TIME_MS, type StationExpansionType } from '@void-sector/shared';
import { startStationBuild } from '../../db/stationQueries.js';
import { resolveExpansionBuild } from './stationExpansionDecision.js';
```

5b. DELETE the methods `handleUpgradeStation` and `handleUpgradeStationModule` (lines ~561–652) and add this method in their place:

```typescript
  async handleBuildStationExpansion(
    client: Client,
    data: { stationId: string; expansionType: string },
  ): Promise<void> {
    if (rejectGuest(client, 'Erweiterung bauen')) return;
    const auth = client.auth as AuthPayload;

    const type = data.expansionType as StationExpansionType;
    if (!STATION_EXPANSION_TYPES.includes(type)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Unbekannte Erweiterung' });
      return;
    }
    const station = await getPlayerStationById(data.stationId);
    if (!station || station.owner_id !== auth.userId) {
      client.send('error', { code: 'NOT_FOUND', message: 'Station nicht gefunden' });
      return;
    }
    if (this.ctx._px(client.sessionId) !== station.sector_x || this.ctx._py(client.sessionId) !== station.sector_y) {
      client.send('error', { code: 'TOO_FAR', message: 'Du musst an der Station sein' });
      return;
    }

    const credits = await getPlayerCredits(auth.userId);
    const cargo = await getCargoState(auth.userId);
    const decision = resolveExpansionBuild(station, type, { credits, cargo });
    if (!decision.ok) {
      client.send('error', { code: decision.code, message: decision.message });
      return;
    }

    const { cost, targetLevel } = decision;
    await deductCredits(auth.userId, cost.credits);
    if (cost.ore > 0) await removeFromInventory(auth.userId, 'resource', 'ore', cost.ore);
    if (cost.gas > 0) await removeFromInventory(auth.userId, 'resource', 'gas', cost.gas);
    if (cost.crystal > 0) await removeFromInventory(auth.userId, 'resource', 'crystal', cost.crystal);
    if (cost.artefact > 0) await removeFromInventory(auth.userId, 'resource', 'artefact', cost.artefact);

    const completeAt = new Date(Date.now() + STATION_EXPANSION_BUILD_TIME_MS(targetLevel)).toISOString();
    const started = await startStationBuild(data.stationId, type, completeAt);
    if (!started) {
      client.send('error', { code: 'BUSY', message: 'Station baut bereits' });
      return;
    }

    client.send('buildStationExpansionResult', { success: true, station: started });
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('logEntry', `STATION baut ${type.toUpperCase()} → Stufe ${targetLevel}`);
  }
```

> Note: `getPlayerCredits`, `deductCredits`, `getCargoState`, `removeFromInventory`, `getPlayerStationById` are already imported in WorldService.ts (used by the deleted handlers). Keep those imports.

- [ ] **Step 6: Update message registration in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, replace the two registrations:

```typescript
    this.onMessage('upgradeStation', async (client, data) => {
      await this.world.handleUpgradeStation(client, data);
    });
    this.onMessage('upgradeStationModule', async (client, data) => {
      await this.world.handleUpgradeStationModule(client, data);
    });
```

with:

```typescript
    this.onMessage('buildStationExpansion', async (client, data: { stationId: string; expansionType: string }) => {
      await this.world.handleBuildStationExpansion(client, data);
    });
```

- [ ] **Step 7: Typecheck + run the handler test**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "WorldService|SectorRoom|stationExpansionDecision" || echo "clean"; npx vitest run src/rooms/services/__tests__/stationExpansionHandler.test.ts`
Expected: `clean` and PASS. (If tsc reports an unused-import error for a now-deleted symbol, remove that import.)

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/services/WorldService.ts packages/server/src/rooms/services/stationExpansionDecision.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/__tests__/stationExpansionHandler.test.ts
git commit -m "feat: buildStationExpansion handler replaces credits-only upgrades (#548)"
```

---

## Task 6: `stationMarketTrade` handler + trade volume → tier

**Files:**
- Create: `packages/server/src/rooms/services/stationMarketDecision.ts`
- Modify: `packages/server/src/rooms/services/WorldService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Test: `packages/server/src/rooms/services/__tests__/stationMarket.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/rooms/services/__tests__/stationMarket.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveMarketTrade, tradeVolumeDelta } from '../stationMarketDecision.js';

const station = { markt_level: 1, cargo_level: 1, cargo_contents: { ore: 0 } };

describe('resolveMarketTrade', () => {
  it('sell: moves resource from player to station, pays player, reports volume', () => {
    const r = resolveMarketTrade(station, { action: 'sell', resource: 'ore', amount: 10 }, { cargoOre: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.creditsToPlayer).toBeGreaterThan(0);
      expect(r.creditsFromPlayer).toBe(0);
      expect(r.volume).toBe(tradeVolumeDelta('ore', 10));
    }
  });

  it('sell: rejects when station cargo would exceed capacity', () => {
    const full = { markt_level: 1, cargo_level: 0, cargo_contents: { ore: 200 } }; // cap 200
    const r = resolveMarketTrade(full, { action: 'sell', resource: 'ore', amount: 10 }, { cargoOre: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STATION_FULL');
  });

  it('requires a built market (markt_level >= 1)', () => {
    const noMarket = { markt_level: 0, cargo_level: 1, cargo_contents: {} };
    const r = resolveMarketTrade(noMarket, { action: 'sell', resource: 'ore', amount: 10 }, { cargoOre: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_MARKET');
  });
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/stationMarket.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the pure decision**

Create `packages/server/src/rooms/services/stationMarketDecision.ts`:

```typescript
import {
  NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, MARKT_SPREAD_PER_LEVEL,
  stationCargoCapacity, type MineableResourceType,
} from '@void-sector/shared';

export interface MarketStation {
  markt_level: number;
  cargo_level: number;
  cargo_contents: Record<string, number>;
}

export interface MarketRequest {
  action: 'buy' | 'sell';
  resource: MineableResourceType;
  amount: number;
}

export type MarketDecision =
  | {
      ok: true;
      creditsToPlayer: number;
      creditsFromPlayer: number;
      volume: number;
      newStationContents: Record<string, number>;
      resourceToPlayer: number;   // units moved into player's ship (buy)
      resourceFromPlayer: number; // units taken from player's ship (sell)
    }
  | { ok: false; code: 'NO_MARKET' | 'STATION_FULL' | 'STATION_EMPTY' | 'INSUFFICIENT' | 'INVALID'; message: string };

/** Trade volume contribution = traded units × base price (independent of spread). */
export function tradeVolumeDelta(resource: MineableResourceType, amount: number): number {
  return Math.round(amount * NPC_PRICES[resource]);
}

export function resolveMarketTrade(
  station: MarketStation,
  req: MarketRequest,
  player: { cargoOre?: number; credits?: number; cargoAmount?: number },
): MarketDecision {
  if (station.markt_level < 1) return { ok: false, code: 'NO_MARKET', message: 'Kein Markt gebaut' };
  if (req.amount <= 0) return { ok: false, code: 'INVALID', message: 'Ungültige Menge' };

  const base = NPC_PRICES[req.resource];
  const levelBonus = MARKT_SPREAD_PER_LEVEL * station.markt_level;
  const sellPrice = base * (NPC_SELL_SPREAD + levelBonus); // player sells → station pays
  const buyPrice = base * Math.max(1, NPC_BUY_SPREAD - levelBonus); // player buys → player pays
  const cap = stationCargoCapacity(station.cargo_level);
  const have = station.cargo_contents[req.resource] ?? 0;
  const contents = { ...station.cargo_contents };

  if (req.action === 'sell') {
    const playerHas = player.cargoAmount ?? 0;
    if (playerHas < req.amount) return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug im Schiff' };
    if (have + req.amount > cap) return { ok: false, code: 'STATION_FULL', message: 'Stationslager voll' };
    contents[req.resource] = have + req.amount;
    return {
      ok: true,
      creditsToPlayer: Math.round(sellPrice * req.amount),
      creditsFromPlayer: 0,
      volume: tradeVolumeDelta(req.resource, req.amount),
      newStationContents: contents,
      resourceToPlayer: 0,
      resourceFromPlayer: req.amount,
    };
  }

  // buy: player buys from station stock
  if (have < req.amount) return { ok: false, code: 'STATION_EMPTY', message: 'Station hat zu wenig Bestand' };
  const cost = Math.round(buyPrice * req.amount);
  if ((player.credits ?? 0) < cost) return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug Credits' };
  contents[req.resource] = have - req.amount;
  return {
    ok: true,
    creditsToPlayer: 0,
    creditsFromPlayer: cost,
    volume: tradeVolumeDelta(req.resource, req.amount),
    newStationContents: contents,
    resourceToPlayer: req.amount,
    resourceFromPlayer: 0,
  };
}
```

- [ ] **Step 4: Run test — must PASS**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/stationMarket.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the handler in WorldService**

In `packages/server/src/rooms/services/WorldService.ts` add imports:

```typescript
import { stationTierForVolume, type MineableResourceType } from '@void-sector/shared';
import { addTradeVolume, setStationLevel, setStationCargo } from '../../db/stationQueries.js';
import { addToInventory } from '../../engine/inventoryService.js';
import { resolveMarketTrade } from './stationMarketDecision.js';
```

Add this method:

```typescript
  async handleStationMarketTrade(
    client: Client,
    data: { stationId: string; action: 'buy' | 'sell'; resource: MineableResourceType; amount: number },
  ): Promise<void> {
    if (rejectGuest(client, 'Handel')) return;
    const auth = client.auth as AuthPayload;
    const station = await getPlayerStationById(data.stationId);
    if (!station || station.owner_id !== auth.userId) {
      client.send('error', { code: 'NOT_FOUND', message: 'Station nicht gefunden' });
      return;
    }
    if (this.ctx._px(client.sessionId) !== station.sector_x || this.ctx._py(client.sessionId) !== station.sector_y) {
      client.send('error', { code: 'TOO_FAR', message: 'Du musst an der Station sein' });
      return;
    }

    const cargo = await getCargoState(auth.userId);
    const credits = await getPlayerCredits(auth.userId);
    const decision = resolveMarketTrade(
      station,
      { action: data.action, resource: data.resource, amount: data.amount },
      { cargoAmount: cargo[data.resource] ?? 0, credits },
    );
    if (!decision.ok) {
      client.send('error', { code: decision.code, message: decision.message });
      return;
    }

    // Move resources between player ship and station storage
    if (decision.resourceFromPlayer > 0) {
      await removeFromInventory(auth.userId, 'resource', data.resource, decision.resourceFromPlayer);
    }
    if (decision.resourceToPlayer > 0) {
      await addToInventory(auth.userId, 'resource', data.resource, decision.resourceToPlayer);
    }
    if (decision.creditsToPlayer > 0) await addCredits(auth.userId, decision.creditsToPlayer);
    if (decision.creditsFromPlayer > 0) await deductCredits(auth.userId, decision.creditsFromPlayer);
    await setStationCargo(data.stationId, decision.newStationContents);

    // Drive Betrieb → tier
    const updated = await addTradeVolume(data.stationId, decision.volume);
    if (updated) {
      const newTier = stationTierForVolume(updated.trade_volume);
      if (newTier > updated.level) await setStationLevel(data.stationId, newTier);
    }

    const fresh = await getPlayerStationById(data.stationId);
    client.send('stationMarketResult', { success: true, station: fresh });
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    client.send('cargoUpdate', await getCargoState(auth.userId));
  }
```

> Note: `addCredits` must be imported if not already — add to the existing `../../db/queries.js` import in WorldService.ts.

- [ ] **Step 6: Register the message in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, after the `buildStationExpansion` registration from Task 5, add:

```typescript
    this.onMessage('stationMarketTrade', async (client, data: { stationId: string; action: 'buy' | 'sell'; resource: 'ore' | 'gas' | 'crystal'; amount: number }) => {
      await this.world.handleStationMarketTrade(client, data);
    });
```

- [ ] **Step 7: Typecheck + run test**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "WorldService|SectorRoom|stationMarketDecision" || echo "clean"; npx vitest run src/rooms/services/__tests__/stationMarket.test.ts`
Expected: `clean` and PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/services/stationMarketDecision.ts packages/server/src/rooms/services/WorldService.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/__tests__/stationMarket.test.ts
git commit -m "feat: station market trade drives trade_volume -> tier (#548)"
```

---

## Task 7: Refinery effect (credits trickle) + Sensor scan bonus

**Files:**
- Create: `packages/server/src/engine/stationPassiveEffects.ts`
- Test: `packages/server/src/engine/__tests__/stationPassiveEffects.test.ts` (new)
- Modify: `packages/server/src/rooms/services/ScanService.ts` (sensor bonus — minimal read)

> Keep effects minimal and pure where possible. Refinery: credits trickle to owner per tick = `REFINERY_CREDITS_PER_TICK × refinery_level`. Sensor: a pure helper computing scan-range bonus = `SENSOR_SCAN_BONUS_PER_LEVEL × sensor_level`, consumed by ScanService when the scanning player is at/owns a station in the sector.

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/engine/__tests__/stationPassiveEffects.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { refineryCreditsPerTick, sensorScanBonus } from '../stationPassiveEffects.js';

describe('refineryCreditsPerTick', () => {
  it('is zero without a refinery and scales with level', () => {
    expect(refineryCreditsPerTick(0)).toBe(0);
    expect(refineryCreditsPerTick(3)).toBe(6); // 2 * 3
  });
});

describe('sensorScanBonus', () => {
  it('is zero without a sensor and scales with level', () => {
    expect(sensorScanBonus(0)).toBe(0);
    expect(sensorScanBonus(4)).toBe(4); // 1 * 4
  });
});
```

- [ ] **Step 2: Run it — must FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationPassiveEffects.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helpers**

Create `packages/server/src/engine/stationPassiveEffects.ts`:

```typescript
import { REFINERY_CREDITS_PER_TICK, SENSOR_SCAN_BONUS_PER_LEVEL } from '@void-sector/shared';

/** Passive credits produced per universe tick by a refinery of the given level. */
export function refineryCreditsPerTick(refineryLevel: number): number {
  return REFINERY_CREDITS_PER_TICK * refineryLevel;
}

/** Extra scan-range sectors granted by a station's sensor array. */
export function sensorScanBonus(sensorLevel: number): number {
  return SENSOR_SCAN_BONUS_PER_LEVEL * sensorLevel;
}
```

- [ ] **Step 4: Run test — must PASS**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationPassiveEffects.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply the refinery trickle in the build tick**

In `packages/server/src/engine/stationBuildTick.ts`, extend the tick to also pay refinery owners. Add the imports at top:

```typescript
import { getAllPlayerStationsWithRefinery } from '../db/stationQueries.js';
import { addCredits } from '../db/queries.js';
import { refineryCreditsPerTick } from './stationPassiveEffects.js';
```

Add a query to `stationQueries.ts`:

```typescript
export async function getAllPlayerStationsWithRefinery(): Promise<Pick<PlayerStationRow, 'owner_id' | 'refinery_level'>[]> {
  const result = await query<Pick<PlayerStationRow, 'owner_id' | 'refinery_level'>>(
    `SELECT owner_id, refinery_level FROM player_stations WHERE refinery_level > 0`,
  );
  return result.rows;
}
```

At the END of `processStationBuildTick()` (after the due-build loop) add:

```typescript
  // Refinery passive income: pay each station owner a credits trickle.
  try {
    const refineries = await getAllPlayerStationsWithRefinery();
    for (const r of refineries) {
      const credits = refineryCreditsPerTick(r.refinery_level);
      if (credits > 0) await addCredits(r.owner_id, credits);
    }
  } catch (err) {
    logger.error({ err }, 'Refinery trickle failed');
  }
```

- [ ] **Step 6: Apply sensor bonus in ScanService**

In `packages/server/src/rooms/services/ScanService.ts`, find where the area-scan radius is computed for a player. Read the player's station at the current sector (if any) and add `sensorScanBonus(station.sensor_level)` to the radius. Add the import:

```typescript
import { sensorScanBonus } from '../../engine/stationPassiveEffects.js';
import { getPlayerStationAt } from '../../db/stationQueries.js';
```

At the point where the scan radius `radius` is finalized for an area scan, insert:

```typescript
    const stationHere = await getPlayerStationAt(sectorX, sectorY);
    if (stationHere && stationHere.owner_id === auth.userId) {
      radius += sensorScanBonus(stationHere.sensor_level);
    }
```

> The exact variable names (`radius`, `sectorX`, `sectorY`, `auth`) must match the surrounding code — adapt to the local scope. If the area-scan path is not obvious, report DONE_WITH_CONCERNS describing what you found rather than guessing.

- [ ] **Step 7: Typecheck + run effects test**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "stationBuildTick|stationPassiveEffects|ScanService|stationQueries" || echo "clean"; npx vitest run src/engine/__tests__/stationPassiveEffects.test.ts src/engine/__tests__/stationBuildTick.test.ts`
Expected: `clean` and PASS (the stationBuildTick test still passes — its mock must add `getAllPlayerStationsWithRefinery` returning []; update that mock in the test to include `getAllPlayerStationsWithRefinery: vi.fn().mockResolvedValue([])` and mock `../../db/queries.js` `addCredits`).

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/engine/stationPassiveEffects.ts packages/server/src/engine/stationBuildTick.ts packages/server/src/engine/__tests__/stationPassiveEffects.test.ts packages/server/src/engine/__tests__/stationBuildTick.test.ts packages/server/src/db/stationQueries.ts packages/server/src/rooms/services/ScanService.ts
git commit -m "feat: refinery credits trickle + sensor scan bonus (#548)"
```

---

## Task 8: Client UI — expansions, build buttons/timer, betrieb bar, market tab, HelpSlice

**Files:**
- Modify: `packages/client/src/components/StationManagePanel.tsx`
- Modify: `packages/client/src/network/client.ts`
- Modify: HelpSlice content per `docs/onboardingInstructions.md`
- Test: client tests for the panel (RTL) — `packages/client/src/components/__tests__/StationManagePanel.expansions.test.tsx` (new)

> Context: the client previously sent `upgradeStation` / `upgradeStationModule`; these are removed server-side. Replace with `buildStationExpansion` and add `stationMarketTrade`. The station object now carries `trade_volume`, `markt_level`, `werft_level`, `refinery_level`, `sensor_level`, `building_expansion`, `build_complete_at`. Follow the existing `StationManagePanel.tsx` structure and Zustand `useStore` patterns. Verify client with **vitest/Vite, not tsc** (the client has ~111 pre-existing tsc errors — see project memory).

- [ ] **Step 1: Add network senders**

In `packages/client/src/network/client.ts`, locate the existing `sendUpgradeStation` / `sendUpgradeStationModule` senders. Replace them with:

```typescript
  sendBuildStationExpansion(stationId: string, expansionType: string) {
    this.room?.send('buildStationExpansion', { stationId, expansionType });
  }

  sendStationMarketTrade(stationId: string, action: 'buy' | 'sell', resource: 'ore' | 'gas' | 'crystal', amount: number) {
    this.room?.send('stationMarketTrade', { stationId, action, resource, amount });
  }
```

(Match the surrounding sender style — e.g. if senders are arrow-fn properties vs methods, follow that. Keep `this.room?.send(...)` pattern as used by other senders.)

- [ ] **Step 2: Write the failing panel test**

Create `packages/client/src/components/__tests__/StationManagePanel.expansions.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationManagePanel } from '../StationManagePanel';

const station = {
  id: 's1', level: 2, factory_level: 0, cargo_level: 0,
  markt_level: 1, werft_level: 0, refinery_level: 0, sensor_level: 0,
  trade_volume: 1500, building_expansion: null, build_complete_at: null,
  sector_x: 1, sector_y: 2,
};

describe('StationManagePanel expansions', () => {
  it('shows the six expansions and a betrieb (trade volume) indicator', () => {
    render(<StationManagePanel station={station as any} />);
    expect(screen.getByText(/Markt/i)).toBeInTheDocument();
    expect(screen.getByText(/Werft/i)).toBeInTheDocument();
    expect(screen.getByText(/Betrieb|Handelsvolumen|1500/i)).toBeInTheDocument();
  });
});
```

> If `StationManagePanel` takes different props than `station`, adapt the test to the real prop contract you find in the file. The test must render the real component and assert the new expansions + betrieb display are present.

- [ ] **Step 3: Run it — must FAIL**

Run: `cd packages/client && npx vitest run src/components/__tests__/StationManagePanel.expansions.test.tsx`
Expected: FAIL — new expansions/betrieb not rendered yet.

- [ ] **Step 4: Implement the panel changes**

In `packages/client/src/components/StationManagePanel.tsx`:
- Replace the level/module upgrade buttons with an **expansion list** rendering all six `STATION_EXPANSION_TYPES` (import from `@void-sector/shared`): each row shows the expansion name (DE labels: Fabrik, Lager, Markt, Werft, Raffinerie, Sensor), its current level, the next-level cost via `expansionCost(type, currentLevel+1)`, a **Bauen** button calling `network.sendBuildStationExpansion(station.id, type)`, disabled when `currentLevel+1 > station.level` (tier-locked, show hint) or when `station.building_expansion` is set.
- If `station.building_expansion` is set, show a **build-in-progress** row with a countdown to `station.build_complete_at`.
- Add a **Betrieb bar**: `station.trade_volume` vs the next entry in `STATION_TIER_THRESHOLDS` (import it), labelled "Betrieb".
- Add a **Markt tab/section** (visible when `markt_level >= 1`): buy/sell ore/gas/crystal with an amount input, calling `network.sendStationMarketTrade(...)`.

Use the existing styling/CRT classes already in the component. Keep the file focused; if it grows large, extract the market section into a sibling component `StationMarketTab.tsx`.

- [ ] **Step 5: Run the panel test — must PASS**

Run: `cd packages/client && npx vitest run src/components/__tests__/StationManagePanel.expansions.test.tsx`
Expected: PASS (check the `Test Files ... passed` line; ignore the benign EACCES on results.json).

- [ ] **Step 6: Add the HelpSlice**

Per `docs/onboardingInstructions.md`, add a HelpSlice `first_station_expansions` (German, ≤6 lines, concrete → steps) explaining: Station wächst durch Handel (Betrieb); Erweiterungen mit Rohstoffen bauen; Markt zum Handeln; Werft schaltet Minenschiffe frei. Place a `[?]` button next to the panel title calling `showTip('first_station_expansions')`. Follow the existing HelpSlice registration pattern used by other screens.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/StationManagePanel.tsx packages/client/src/network/client.ts packages/client/src/components/__tests__/StationManagePanel.expansions.test.tsx
git commit -m "feat: station expansion + market UI, betrieb bar, HelpSlice (#548)"
```

---

## Task 9: Full regression + cleanup

**Files:** none (verification)

- [ ] **Step 1: Build shared + run all suites**

Run:
```bash
cd packages/shared && npm run build && npx vitest run
cd ../server && npx vitest run
cd ../client && npx vitest run
```
Expected: all pass. The server suite must show no failures from removed handlers — search for any remaining references to `handleUpgradeStation`/`handleUpgradeStationModule`/`upgradeStation`/`upgradeStationModule` and update or remove them:

Run: `grep -rnE "handleUpgradeStation|handleUpgradeStationModule|upgradeStationModule|sendUpgradeStation" packages/server/src packages/client/src --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: no stray references (other than the new build-expansion flow). Fix any found.

- [ ] **Step 2: Commit any cleanup**

```bash
git add -A
git commit -m "chore: remove stale station upgrade references after expansion rework (#548)"
```

---

## Self-Review (done by plan author)

**Spec coverage (Phase 1 of the spec):**
- P1.1 migration 087 → Task 2 ✓
- P1.2 trade_volume → tier (stationTierForVolume, recompute on trade) → Task 1 + Task 6 ✓
- P1.3 six expansions + effects → factory/cargo (existing) + markt (Task 6) + werft level (Task 1 const; behaviour Phase 2) + refinery/sensor (Task 7) ✓
- P1.4 cost review (expansionCost table) → Task 1 ✓
- P1.5 build-by-resources + timer + tick → Tasks 3,4,5 ✓
- P1.6 market trade → Task 6 ✓
- P1.7 server structure → stationExpansionService/decision, stationBuildTick, queries ✓
- P1.8 UI + HelpSlice → Task 8 ✓
- P1.9 tests → each task is TDD ✓

**Placeholder scan:** Tasks 7-Step6 (ScanService) and Task 8 (client UI) contain "adapt to local scope / follow existing pattern" guidance rather than exact line edits, because the exact integration points depend on code not fully quoted here; both include explicit fallback instructions (report DONE_WITH_CONCERNS; verify with vitest). All server-logic tasks have complete code. Acceptable: these are genuinely pattern-following UI/integration edits.

**Type consistency:** `StationExpansionType`, `expansionCost`, `stationTierForVolume`, `stationCargoCapacity`, `PlayerStationRow` (extended), `resolveExpansionBuild`, `resolveMarketTrade`, `startStationBuild`/`getDueStationBuilds`/`completeStationBuild`/`addTradeVolume`/`setStationLevel`/`setStationCargo` are defined once and reused consistently across tasks.

**Note:** Phase 2 (#549, station mining ships) is a SEPARATE plan, authored after Phase 1 lands so its tasks reference the real Phase-1 signatures (werft_level, station cargo, tier helpers). It adds `station_mining_ships`, `stationMiningService`, the bounded `processStationMiningTick`, client radar wiring, and the `station_mining_ships` entry in `resetWorld.ts`.
