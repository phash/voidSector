# Sole-Station Clean Slate (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make **0:0 the only NPC station** (a strong level-5 trade station), stop the two generators that keep minting stations, freeze alien expansion, and ship a one-off script that cleans the existing prod data — without wiping player accounts or progress.

**Architecture:** Three small code changes plus one operational script. (1) Worldgen stops rolling `station` sectors. (2) Two launch kill-switch constants gate `ensureCivStations` and `processAlienExpansion` at their call sites. (3) `ensureOriginTradeStation()` upgrades 0:0 to level 5 + stocked inventory. (4) `cleanSlateReset.ts` deletes the leftover `civ_stations`/`civ_ships`/in-flight fleets and reduces `quadrant_control` to home quadrants. Code deploys first, the script runs once after.

**Tech Stack:** TypeScript (ESM, `.js` import extensions on server), Vitest, PostgreSQL via `db/client.ts` `query()`, the `@void-sector/shared` constants package (must be rebuilt after edits).

**Scope note:** This is Phase 1 of the `2026-06-09-world-model-reset-design.md` spec. It deliberately uses simple *kill-switches* for alien expansion (default off). Phase 2 (separate plan) replaces those with the `aliens_awakened` wake-trigger, relocates alien homes into the 1000–5000 sector ring, and adds the always-buy sink. Phase 3 adds the 100 frontier NPCs.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/constants.ts` | `CONTENT_WEIGHTS` (worldgen) + two new kill-switch constants | Modify |
| `packages/shared/src/__tests__/contentWeights.test.ts` | Test weights sum to 1 and `station===0` | Create |
| `packages/server/src/engine/universeBootstrap.ts` | Gate `ensureCivStations()` behind `CIV_STATIONS_ENABLED`; gate strategic expansion call | Modify |
| `packages/server/src/engine/strategicTickService.ts` | Gate `processAlienExpansion` behind `ALIEN_EXPANSION_ENABLED` | Modify |
| `packages/server/src/engine/npcStationEngine.ts` | New `ensureOriginTradeStation()` (0:0 → level 5 + inventory) | Modify |
| `packages/server/src/engine/__tests__/originTradeStation.test.ts` | Test the 0:0 upgrade | Create |
| `packages/server/src/scripts/cleanSlateReset.ts` | One-off prod cleanup + exported pure helpers | Create |
| `packages/server/src/scripts/__tests__/cleanSlateReset.test.ts` | Test the pure helpers (table list, home set, SQL) | Create |
| `packages/server/package.json` | `clean-slate` npm script | Modify |

---

## Task 1: Worldgen stops minting station sectors

**Files:**
- Modify: `packages/shared/src/constants.ts:639-645`
- Test: `packages/shared/src/__tests__/contentWeights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/__tests__/contentWeights.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CONTENT_WEIGHTS } from '../constants';

describe('CONTENT_WEIGHTS (worldgen)', () => {
  it('never rolls a station sector (only 0:0 is a station)', () => {
    expect(CONTENT_WEIGHTS.station).toBe(0);
  });

  it('weights still sum to 1.0', () => {
    const sum = Object.values(CONTENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/contentWeights.test.ts`
Expected: FAIL — `expected 0.016 to be 0`.

- [ ] **Step 3: Make the change**

In `packages/shared/src/constants.ts`, change the `CONTENT_WEIGHTS` block (currently lines 639-645) so `station` is 0 and its weight moves to `none` (keeps the sum at 1.0):

```typescript
export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.926, // +0.016 absorbed from station (worldgen no longer mints stations; only 0:0 is one)
  asteroid_field: 0.05,
  pirate: 0.02,
  station: 0, // sole-station world: stations are 0:0 + player-built only
  ruin: 0.004,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/__tests__/contentWeights.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Rebuild shared (REQUIRED — server consumes the compiled dist)**

Run: `cd packages/shared && npm run build`
Expected: builds with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/contentWeights.test.ts packages/shared/dist
git commit -m "feat: worldgen no longer mints station sectors (CONTENT_WEIGHTS.station=0)"
```

---

## Task 2: Kill-switches freeze the two station/territory generators

The two generators that refill the galaxy are `ensureCivStations()` (boot) and `processAlienExpansion()` (strategic tick). We gate them at their **call sites** so the functions themselves stay unchanged (existing `civStationsBulk.test.ts` keeps passing). Both default **off** for the sole-station launch.

**Files:**
- Modify: `packages/shared/src/constants.ts` (add two constants near `QUADRANT_SIZE`, ~line 971)
- Modify: `packages/server/src/engine/universeBootstrap.ts:45`
- Modify: `packages/server/src/engine/strategicTickService.ts` (call at line 108)
- Test: `packages/shared/src/__tests__/contentWeights.test.ts` (extend — same worldgen-flags file)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/__tests__/contentWeights.test.ts`:

```typescript
import { CIV_STATIONS_ENABLED, ALIEN_EXPANSION_ENABLED } from '../constants';

describe('world-generation kill-switches (sole-station launch)', () => {
  it('NPC civ-station generation is off', () => {
    expect(CIV_STATIONS_ENABLED).toBe(false);
  });
  it('alien expansion is frozen (Phase 2 replaces this with the wake-trigger)', () => {
    expect(ALIEN_EXPANSION_ENABLED).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/contentWeights.test.ts`
Expected: FAIL — `CIV_STATIONS_ENABLED` is undefined.

- [ ] **Step 3: Add the constants**

In `packages/shared/src/constants.ts`, directly below `export const QUADRANT_SIZE = 500;` add:

```typescript
// ── Sole-station world launch flags ────────────────────────────────────────
// Only 0:0 is an NPC station; everything else is player-built. These freeze the
// two generators that otherwise refill the galaxy. Phase 2 of the world-model
// reset replaces ALIEN_EXPANSION_ENABLED with the `aliens_awakened` wake-trigger.
export const CIV_STATIONS_ENABLED = false;
export const ALIEN_EXPANSION_ENABLED = false;
```

- [ ] **Step 4: Run test to verify it passes, then rebuild shared**

Run: `cd packages/shared && npx vitest run src/__tests__/contentWeights.test.ts`
Expected: PASS (4 tests).
Run: `cd packages/shared && npm run build`
Expected: builds clean.

- [ ] **Step 5: Gate `ensureCivStations` at the boot call site**

In `packages/server/src/engine/universeBootstrap.ts`:

- Add `CIV_STATIONS_ENABLED` and `ALIEN_EXPANSION_ENABLED` to the existing `@void-sector/shared` import on line 8:

```typescript
import { QUADRANT_SIZE, BACKGROUND_TICK_INTERVAL, CIV_STATIONS_ENABLED } from '@void-sector/shared';
```

- Replace the unconditional call on line 45:

```typescript
  if (CIV_STATIONS_ENABLED) {
    await ensureCivStations();
    logger.info('CivShips: stations seeded (drones spawn lazily near players)');
  } else {
    logger.info('CivShips: NPC station generation DISABLED (sole-station world)');
  }
```

- [ ] **Step 6: Gate `processAlienExpansion` in the strategic tick**

In `packages/server/src/engine/strategicTickService.ts`:

- Add the import (top of file, with the other `@void-sector/shared` imports):

```typescript
import { ALIEN_EXPANSION_ENABLED } from '@void-sector/shared';
```

- At the call site (currently line 108 `await this.processAlienExpansion(allControls);`) gate it:

```typescript
    // 2. Alien expansion into unclaimed space (frozen for the sole-station launch;
    //    Phase 2 re-enables this behind the aliens_awakened wake-trigger).
    if (ALIEN_EXPANSION_ENABLED) {
      await this.processAlienExpansion(allControls);
    }
```

- [ ] **Step 7: Run the affected server tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/civStationsBulk.test.ts src/__tests__/universeBootstrap.test.ts`
Expected: PASS (existing tests unaffected — the functions themselves are unchanged).

> Note: vitest may print a benign `EACCES … results.json` line after the run — check the `Test Files … passed` line, not that.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/contentWeights.test.ts packages/shared/dist packages/server/src/engine/universeBootstrap.ts packages/server/src/engine/strategicTickService.ts
git commit -m "feat: freeze civ-station + alien-expansion generators (sole-station launch flags)"
```

---

## Task 3: Upgrade 0:0 to a level-5 trade station

`ensureKernweltStation()` (queries.ts) creates the 0:0 row at **level 1** with `ON CONFLICT DO NOTHING`, so it never upgrades an existing station. We add `ensureOriginTradeStation()` to `npcStationEngine.ts` (which already owns the station helpers — no import cycle with `queries.ts`) to upsert 0:0 to **level 5** and seed ore/gas/crystal inventory. It is called at boot (so fresh worlds get it) and by the cleanup script.

**Files:**
- Modify: `packages/server/src/engine/npcStationEngine.ts` (new export; reuses `getStationLevel`, `initStationInventory`, `upsertStationData`)
- Modify: `packages/server/src/engine/universeBootstrap.ts` (call after `ensureKernweltStation()`)
- Test: `packages/server/src/engine/__tests__/originTradeStation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/engine/__tests__/originTradeStation.test.ts`. Mock the DB helpers `npcStationEngine` calls, following the `civStationsBulk.test.ts` mock style:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upsertStationData = vi.fn().mockResolvedValue(undefined);
const initStationInventory = vi.fn();

vi.mock('../../db/queries.js', async (orig) => {
  const actual = await orig<typeof import('../../db/queries.js')>();
  return { ...actual, upsertStationData };
});

import { ensureOriginTradeStation, getStationLevel } from '../npcStationEngine.js';

describe('ensureOriginTradeStation (0:0 trade hub)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts 0:0 at level 5 (Megastation) with megastation xp', async () => {
    const spy = vi.spyOn(await import('../npcStationEngine.js'), 'initStationInventory')
      .mockResolvedValue(undefined);
    await ensureOriginTradeStation();
    expect(upsertStationData).toHaveBeenCalledTimes(1);
    const arg = upsertStationData.mock.calls[0][0];
    expect(arg).toMatchObject({ stationX: 0, stationY: 0, level: 5 });
    expect(arg.xp).toBeGreaterThanOrEqual(15000);
    // Inventory seeded at level-5 maxStock (8000)
    expect(spy).toHaveBeenCalledWith(0, 0, getStationLevel(15000).maxStock);
    expect(getStationLevel(15000).maxStock).toBe(8000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/originTradeStation.test.ts`
Expected: FAIL — `ensureOriginTradeStation` is not exported.

- [ ] **Step 3: Implement `ensureOriginTradeStation`**

In `packages/server/src/engine/npcStationEngine.ts`, add (near `getOrInitStation`, reusing the existing imports for `upsertStationData`, `getStationLevel`, `initStationInventory`, `NPC_STATION_LEVELS`):

```typescript
/** Megastation XP floor — getStationLevel(MEGASTATION_XP) === level 5. */
const MEGASTATION_XP = 15000;

/**
 * Ensure 0:0 is the galaxy's strong trade station: level 5 (Megastation,
 * maxStock 8000) with ore/gas/crystal seeded. Idempotent — upgrades an
 * existing level-1 Kernwelt row in place. Called at boot and by cleanSlateReset.
 */
export async function ensureOriginTradeStation(): Promise<void> {
  const level = getStationLevel(MEGASTATION_XP); // { level: 5, maxStock: 8000, ... }
  await upsertStationData({
    stationX: 0,
    stationY: 0,
    level: level.level,
    xp: MEGASTATION_XP,
    visitCount: 0,
    tradeVolume: 0,
    lastXpDecay: new Date().toISOString(),
  });
  await initStationInventory(0, 0, level.maxStock);
}
```

> If `upsertStationData` is not already imported in this file, add it to the existing `../db/queries.js` (or `../db/stationQueries.js`) import — check which module `getStationData`/`upsertStationData` come from at the top of `npcStationEngine.ts` and reuse that same import line.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/engine/__tests__/originTradeStation.test.ts`
Expected: PASS.

- [ ] **Step 5: Call it at boot**

In `packages/server/src/engine/universeBootstrap.ts`, add to the `civStationService`/`npcStationEngine` imports and call right after `ensureKernweltStation()` (line 38):

```typescript
// add import near the top:
import { ensureOriginTradeStation } from './npcStationEngine.js';
// ...
  await ensureKernweltStation();
  await ensureOriginTradeStation(); // 0:0 → level-5 trade hub
  await ensureZentrumQuadrant();
```

- [ ] **Step 6: Run the bootstrap test**

Run: `cd packages/server && npx vitest run src/__tests__/universeBootstrap.test.ts`
Expected: PASS (or, if it stubs the ensure* functions, it remains green — add a stub for `ensureOriginTradeStation` if the test mocks `npcStationEngine`).

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/engine/npcStationEngine.ts packages/server/src/engine/universeBootstrap.ts packages/server/src/engine/__tests__/originTradeStation.test.ts
git commit -m "feat: ensureOriginTradeStation upgrades 0:0 to a level-5 stocked trade hub"
```

---

## Task 4: `cleanSlateReset.ts` one-off cleanup script

Deletes the leftover non-0:0 stations and in-flight expansion, reduces `quadrant_control` to home quadrants, and upgrades 0:0 — **keeps accounts + player progress + explored sectors**. Pure helpers are exported and unit-tested (the DB run is operational, like `resetWorld.ts`).

**Files:**
- Create: `packages/server/src/scripts/cleanSlateReset.ts`
- Test: `packages/server/src/scripts/__tests__/cleanSlateReset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/scripts/__tests__/cleanSlateReset.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CLEAN_SLATE_WIPE_TABLES, homeQuadrantSet, nonHomeDeleteSql } from '../cleanSlateReset.js';

describe('cleanSlateReset — wipe table list', () => {
  it('wipes the station + in-flight-expansion tables', () => {
    for (const t of ['civ_stations', 'civ_ships', 'npc_fleet', 'cosmic_npc_fleets', 'expansion_log']) {
      expect(CLEAN_SLATE_WIPE_TABLES).toContain(t);
    }
  });
  it('never wipes accounts, config, or player progress', () => {
    for (const t of ['players', 'game_config', 'faction_config', 'ships', 'player_stations', 'sectors']) {
      expect(CLEAN_SLATE_WIPE_TABLES).not.toContain(t);
    }
  });
});

describe('cleanSlateReset — home quadrants', () => {
  it('always includes the human home 0:0', () => {
    const homes = homeQuadrantSet([{ faction_id: 'humans', home_qx: 0, home_qy: 0 }]);
    expect(homes.has('0:0')).toBe(true);
  });
  it('includes each alien faction home and excludes nothing else', () => {
    const homes = homeQuadrantSet([
      { faction_id: 'humans', home_qx: 0, home_qy: 0 },
      { faction_id: 'kthari', home_qx: 270, home_qy: 280 },
    ]);
    expect(homes.has('0:0')).toBe(true);
    expect(homes.has('270:280')).toBe(true);
    expect(homes.size).toBe(2);
  });
});

describe('cleanSlateReset — non-home delete SQL', () => {
  it('keeps the home quadrants and deletes everything else', () => {
    const { sql, params } = nonHomeDeleteSql(new Set(['0:0', '270:280']));
    expect(sql).toMatch(/DELETE FROM quadrant_control/i);
    expect(sql).toMatch(/NOT IN/i);
    expect(params).toEqual([0, 0, 270, 280]);
  });
  it('deletes ALL when there are no homes (defensive)', () => {
    const { sql } = nonHomeDeleteSql(new Set());
    expect(sql).toBe('DELETE FROM quadrant_control');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/scripts/__tests__/cleanSlateReset.test.ts`
Expected: FAIL — module `../cleanSlateReset.js` not found.

- [ ] **Step 3: Implement the script + pure helpers**

Create `packages/server/src/scripts/cleanSlateReset.ts`:

```typescript
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query, runMigrations } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  ensureZentrumQuadrant,
  ensureAlienHomeQuadrants,
  ensureKernweltStation,
  getAllFactionConfigs,
} from '../db/queries.js';
import { ensureOriginTradeStation } from '../engine/npcStationEngine.js';

dotenv.config();

/**
 * Tables fully wiped so only 0:0 + alien homes remain. Stations + NPC ships +
 * any in-flight colonization fleets + the expansion log. NOT here: accounts,
 * config, player progress, or the sectors/quadrants map (those are preserved).
 */
export const CLEAN_SLATE_WIPE_TABLES = [
  'civ_stations',
  'civ_ships',
  'npc_fleet',
  'cosmic_npc_fleets',
  'expansion_log',
];

/** Set of "qx:qy" keys for the home quadrants (human 0:0 + every alien home). */
export function homeQuadrantSet(
  factions: { faction_id: string; home_qx: number; home_qy: number }[],
): Set<string> {
  const homes = new Set<string>(['0:0']);
  for (const f of factions) {
    if (f.faction_id === 'humans') continue;
    homes.add(`${f.home_qx}:${f.home_qy}`);
  }
  return homes;
}

/** Build the parameterised DELETE that keeps only the given home quadrants. */
export function nonHomeDeleteSql(homes: Set<string>): { sql: string; params: number[] } {
  if (homes.size === 0) return { sql: 'DELETE FROM quadrant_control', params: [] };
  const params: number[] = [];
  const tuples: string[] = [];
  for (const key of homes) {
    const [qx, qy] = key.split(':').map(Number);
    tuples.push(`($${params.length + 1}, $${params.length + 2})`);
    params.push(qx, qy);
  }
  return {
    sql: `DELETE FROM quadrant_control WHERE (qx, qy) NOT IN (${tuples.join(', ')})`,
    params,
  };
}

async function wipe(table: string): Promise<void> {
  try {
    const del = await query(`DELETE FROM ${table}`);
    logger.info({ table, rowCount: del.rowCount }, 'clean-slate: cleared');
  } catch (err) {
    logger.warn({ table, error: (err as Error).message }, 'clean-slate: delete failed');
  }
}

export async function cleanSlateReset(): Promise<void> {
  await runMigrations();

  // 1. Wipe stations / NPC ships / in-flight expansion.
  for (const t of CLEAN_SLATE_WIPE_TABLES) await wipe(t);

  // 2. Reduce quadrant_control to home quadrants, then re-seed the homes.
  const factions = await getAllFactionConfigs();
  const homes = homeQuadrantSet(factions);
  const { sql, params } = nonHomeDeleteSql(homes);
  const delRes = await query(sql, params);
  logger.info({ rowCount: delRes.rowCount, kept: homes.size }, 'clean-slate: quadrant_control reduced to homes');
  await ensureZentrumQuadrant();
  await ensureAlienHomeQuadrants();

  // 3. Remove non-origin station sectors + stray station data/inventory.
  await query("DELETE FROM sectors WHERE type = 'station' AND NOT (x = 0 AND y = 0)");
  await query('DELETE FROM npc_station_inventory WHERE NOT (station_x = 0 AND station_y = 0)');
  await query('DELETE FROM npc_station_data WHERE NOT (station_x = 0 AND station_y = 0)');

  // 4. Ensure 0:0 exists and is a strong trade station.
  await ensureKernweltStation();
  await ensureOriginTradeStation();

  logger.info('clean-slate: complete — only 0:0 is a station; territory reset to homes.');
}

// Only auto-run when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.endsWith('cleanSlateReset.ts')
  || process.argv[1]?.endsWith('cleanSlateReset.js');
if (invokedDirectly) {
  cleanSlateReset()
    .then(async () => {
      // Clear stale civ-presence Redis keys without nuking AP/fuel/position state.
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.del('war_ticker', 'trace:recent').catch(() => undefined);
      await redis.quit();
      logger.info('clean-slate: done. Restart not required — generators are already off in code.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'clean-slate failed');
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/scripts/__tests__/cleanSlateReset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/scripts/cleanSlateReset.ts packages/server/src/scripts/__tests__/cleanSlateReset.test.ts
git commit -m "feat: cleanSlateReset script — only 0:0 stays a station, territory reset to homes"
```

---

## Task 5: npm script + full server test sweep + runbook

**Files:**
- Modify: `packages/server/package.json` (line 12 area — alongside `reset:world`)

- [ ] **Step 1: Add the npm script**

In `packages/server/package.json`, in `"scripts"`, next to `"reset:world"`:

```json
    "reset:world": "tsx src/scripts/resetWorld.ts",
    "clean-slate": "tsx src/scripts/cleanSlateReset.ts"
```

- [ ] **Step 2: Run the full server + shared test suites (no regressions)**

Run: `cd packages/shared && npx vitest run`
Expected: all pass.
Run: `cd packages/server && npx vitest run`
Expected: `Test Files … passed` (ignore any trailing benign `EACCES … results.json` line).

- [ ] **Step 3: Commit**

```bash
git add packages/server/package.json
git commit -m "chore: add npm run clean-slate script"
```

- [ ] **Step 4: Deploy + run the cleanup on prod (operational runbook — do NOT automate)**

Order matters: **code first** (generators are off), **then** the one-off cleanup.

```bash
# 1. Merge feat/world-model-reset → master, then on the prod box:
ssh musikersuche@musikersuche.org
cd /opt/voidsector && git pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build server client

# 2. Run the cleanup once (server keeps running; script connects to the same DB):
docker compose -f docker-compose.yml -f docker-compose.caddy.yml \
  run --rm --workdir /app/packages/server --no-deps server npm run clean-slate
```

- [ ] **Step 5: Verify prod end-state (read-only SQL)**

```bash
ssh musikersuche@musikersuche.org "docker exec voidsector-postgres-1 bash -c 'psql -h localhost -U \$POSTGRES_USER -d \$POSTGRES_DB -t -A -F\"|\" -c \"
SELECT '\''civ_stations'\'', COUNT(*)::text FROM civ_stations
UNION ALL SELECT '\''station_sectors_nonorigin'\'', COUNT(*)::text FROM sectors WHERE type='\''station'\'' AND NOT (x=0 AND y=0)
UNION ALL SELECT '\''quadrant_control'\'', COUNT(*)::text FROM quadrant_control
UNION ALL SELECT '\''origin_level'\'', level::text FROM npc_station_data WHERE station_x=0 AND station_y=0;\"'"
```

Expected: `civ_stations=0`, `station_sectors_nonorigin=0`, `quadrant_control=11` (1 human + 10 alien homes), `origin_level=5`.

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 1 sections of `2026-06-09-world-model-reset-design.md`):**
- §1.1 worldgen station off → Task 1 ✓; `ensureCivStations` off → Task 2 ✓.
- §1.2 0:0 level 5 + inventory → Task 3 ✓. *(The always-buy "echter Sink" special-case is intentionally deferred to Phase 2 — Task 3 delivers the strong level-5 buyer; this is called out in the Scope note.)*
- §1.3 cleanup script (civ_stations, civ_ships, quadrant_control→homes, station sectors) → Task 4 ✓. *(Adds `npc_fleet`/`cosmic_npc_fleets`/`expansion_log` so no in-flight colonization survives — beyond the spec's list, required for correctness.)*
- §1.4 tests → each task is TDD ✓.
- Expansion freeze: spec puts the gate in Phase 2 via `aliens_awakened`; this plan adds an interim `ALIEN_EXPANSION_ENABLED=false` kill-switch (Task 2) so Phase 1 ships safely without territory regrowing. Documented in the Scope note.

**Placeholder scan:** none — every code/test step has complete content.

**Type/name consistency:** `ensureOriginTradeStation` (Tasks 3, 4), `CLEAN_SLATE_WIPE_TABLES` / `homeQuadrantSet` / `nonHomeDeleteSql` (Task 4 impl + test), `CIV_STATIONS_ENABLED` / `ALIEN_EXPANSION_ENABLED` (Task 2 impl + test) all match across tasks. `getStationLevel(15000).maxStock === 8000` matches `NPC_STATION_LEVELS[4]` (verified in spec §3).

**Known verification point for the executor:** confirm the module that exports `upsertStationData` / `getStationData` at the top of `npcStationEngine.ts` and reuse that exact import path in Task 3 (queries.ts vs stationQueries.ts); and confirm `npc_station_inventory` is keyed `(station_x, station_y, item_type)` (migration 020) — `initStationInventory` already relies on this, so reuse it rather than hand-writing inventory SQL.
