# Pirate Frontier Rules — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pirates only exist in frontier quadrants (1–5 unclaimed neighbor quadrants); new sectors never generate pirates outside the frontier, and combat is blocked in settled space (existing pirate_zone DB entries stay intact).

**Architecture:** New pure function `isFrontierQuadrant` in `expansionEngine.ts`. `generateSector` gets an optional `isFrontier` boolean — strips `pirate_zone` from content when false. All 9 sector-generation call sites pass the frontier flag. `CombatService` guards both v1 and v2 combat entry points.

**Tech Stack:** TypeScript, Vitest, Colyseus, PostgreSQL (`quadrant_control` table)

---

## File Map

| File | Change |
|---|---|
| `packages/server/src/engine/expansionEngine.ts` | Add `isFrontierQuadrant()` |
| `packages/server/src/engine/worldgen.ts` | Add `isFrontier` param to `generateSector` |
| `packages/server/src/rooms/services/NavigationService.ts` | Update 8 `generateSector` call sites + add imports |
| `packages/server/src/rooms/services/ScanService.ts` | Update 1 `generateSector` call site + add imports |
| `packages/server/src/rooms/SectorRoom.ts` | Update 1 `generateSector` call site |
| `packages/server/src/rooms/services/CombatService.ts` | Add frontier guard + add imports |
| `packages/server/src/engine/__tests__/expansionEngine.test.ts` | **New** — unit tests for `isFrontierQuadrant` |
| `packages/server/src/engine/__tests__/worldgen.test.ts` | Add tests for `isFrontier=false` behaviour |

---

## Chunk 1: Core Logic

### Task 1: `isFrontierQuadrant` in `expansionEngine.ts`

**Files:**
- Modify: `packages/server/src/engine/expansionEngine.ts`
- Create: `packages/server/src/engine/__tests__/expansionEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/engine/__tests__/expansionEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isFrontierQuadrant } from '../expansionEngine.js';
import type { QuadrantControlRow } from '../../db/queries.js';

function row(qx: number, qy: number, faction = 'human'): QuadrantControlRow {
  return {
    qx, qy,
    controlling_faction: faction,
    faction_shares: { [faction]: 100 },
    attack_value: 0,
    defense_value: 0,
    friction_score: 0,
    station_tier: 1,
    last_strategic_tick: new Date().toISOString(),
  } as QuadrantControlRow;
}

describe('isFrontierQuadrant', () => {
  it('returns false when all 8 neighbors are controlled (deep interior)', () => {
    const controls = [
      row(0, 0), // the quadrant itself
      row(-1,-1), row(0,-1), row(1,-1),
      row(-1, 0),             row(1, 0),
      row(-1, 1), row(0, 1), row(1, 1),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(false);
  });

  it('returns true with exactly 1 empty neighbor', () => {
    // 7 controlled neighbors, 1 missing
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
      row(-1, 0),             row(1, 0),
      row(-1, 1), row(0, 1),
      // (1,1) is missing → 1 empty neighbor
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(true);
  });

  it('returns true with 5 empty neighbors', () => {
    // only 3 controlled neighbors
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
      // 5 remaining neighbors are empty
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(true);
  });

  it('returns false with 6 empty neighbors (deep wilderness)', () => {
    // only 2 controlled neighbors
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(false);
  });

  it('returns false with 8 empty neighbors (completely isolated)', () => {
    const controls = [row(0, 0)];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(false);
  });

  it('does not count the quadrant itself as a neighbor', () => {
    // 5 controlled neighbors → 3 empty → should be true
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
      row(-1, 0), row(1, 0),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/engine/__tests__/expansionEngine.test.ts
```
Expected: FAIL — `isFrontierQuadrant is not a function`

- [ ] **Step 3: Add `isFrontierQuadrant` to `expansionEngine.ts`**

Append after the last export in `packages/server/src/engine/expansionEngine.ts`:

```typescript
/**
 * A quadrant is a "frontier" if it has between 1 and 5 unclaimed/empty
 * neighboring quadrants. 0 empty = deep interior; 6-8 empty = deep wilderness.
 * Pirates only exist and fight in frontier quadrants.
 */
export function isFrontierQuadrant(
  qx: number,
  qy: number,
  allControls: QuadrantControlRow[],
): boolean {
  const controlled = new Set(allControls.map((q) => `${q.qx},${q.qy}`));
  let emptyNeighbors = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (!controlled.has(`${qx + dx},${qy + dy}`)) emptyNeighbors++;
    }
  }
  return emptyNeighbors >= 1 && emptyNeighbors <= 5;
}
```

Note: `QuadrantControlRow` is already imported by consumers via `../../db/queries.js`. You must add the import at the top of `expansionEngine.ts`:

```typescript
import type { QuadrantControlRow } from '../db/queries.js';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/engine/__tests__/expansionEngine.test.ts
```
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/expansionEngine.ts packages/server/src/engine/__tests__/expansionEngine.test.ts
git commit -m "feat: add isFrontierQuadrant — pirates only in 1–5 empty-neighbor quadrants"
```

---

### Task 2: `generateSector` — `isFrontier` parameter

**Files:**
- Modify: `packages/server/src/engine/worldgen.ts`
- Modify: `packages/server/src/engine/__tests__/worldgen.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('generateSector')` block in `packages/server/src/engine/__tests__/worldgen.test.ts`:

```typescript
it('strips pirate_zone content when isFrontier=false, keeps asteroid_field', () => {
  // Find a sector that would normally generate pirate content
  let pirateCoords: { x: number; y: number } | null = null;
  for (let x = 0; x < 500 && !pirateCoords; x++) {
    for (let y = 0; y < 100 && !pirateCoords; y++) {
      const s = generateSector(x, y, null);
      if (s.contents.includes('pirate_zone')) {
        pirateCoords = { x, y };
      }
    }
  }
  expect(pirateCoords).not.toBeNull();

  const settled = generateSector(pirateCoords!.x, pirateCoords!.y, null, false);
  expect(settled.contents).not.toContain('pirate_zone');
  expect(settled.contents).toContain('asteroid_field');
  expect(settled.type).toBe('asteroid_field');
});

it('keeps pirate_zone content when isFrontier=true (default)', () => {
  let pirateCoords: { x: number; y: number } | null = null;
  for (let x = 0; x < 500 && !pirateCoords; x++) {
    for (let y = 0; y < 100 && !pirateCoords; y++) {
      const s = generateSector(x, y, null);
      if (s.contents.includes('pirate_zone')) {
        pirateCoords = { x, y };
      }
    }
  }
  expect(pirateCoords).not.toBeNull();

  const frontier = generateSector(pirateCoords!.x, pirateCoords!.y, null, true);
  expect(frontier.contents).toContain('pirate_zone');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/engine/__tests__/worldgen.test.ts -t "isFrontier"
```
Expected: FAIL — `generateSector` has no fourth argument / behaviour not yet changed

- [ ] **Step 3: Update `generateSector` signature and strip logic**

In `packages/server/src/engine/worldgen.ts`, change the function signature and add the stripping logic after `rollContent`:

```typescript
export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null,
  isFrontier = true,
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);

  // Stage 1: Roll environment
  const environment = rollEnvironment(x, y, seed);

  // Black holes are impassable with no content or resources
  if (environment === 'black_hole') {
    return {
      x, y, seed, environment,
      contents: [],
      type: 'empty',
      discoveredBy,
      discoveredAt: null,
      metadata: {},
      resources: { ore: 0, gas: 0, crystal: 0 },
      impassable: true,
    };
  }

  // Stage 2: Roll content
  let contents = rollContent(seed, environment);

  // Frontier rule: pirates only spawn in frontier quadrants.
  // Strip pirate_zone but preserve asteroid_field (the rocks remain).
  if (!isFrontier && contents.includes('pirate_zone')) {
    contents = contents.filter((c) => c !== 'pirate_zone');
  }

  // Derive legacy type from environment + contents
  const type = legacySectorType(environment, contents);

  // Special metadata: some stations are ancient variants
  const metadata: Record<string, unknown> = {};
  if (contents.includes('station')) {
    const secondaryRoll = hashSecondary(seed);
    if (secondaryRoll < ANCIENT_STATION_CHANCE) {
      metadata.stationVariant = 'ancient';
    }
  }

  return {
    x, y, seed, environment, contents, type,
    resources: generateResources(type, seed),
    discoveredBy,
    discoveredAt: null,
    metadata,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/server && npx vitest run src/engine/__tests__/worldgen.test.ts
```
Expected: All existing tests PASS + 2 new tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/worldgen.ts packages/server/src/engine/__tests__/worldgen.test.ts
git commit -m "feat: generateSector strips pirate_zone when isFrontier=false"
```

---

## Chunk 2: Call Sites

### Task 3: NavigationService — update 9 `generateSector` call sites

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts`

NavigationService already imports `sectorToQuadrant` (line 25). You must add two more imports.

- [ ] **Step 1: Add imports to NavigationService**

In `packages/server/src/rooms/services/NavigationService.ts`, find the existing import block and add:

```typescript
// Add to the queries.ts import block (find the existing import from '../../db/queries.js'):
import { getAllQuadrantControls, /* ...existing imports... */ } from '../../db/queries.js';

// Add to the expansionEngine import (new import line):
import { isFrontierQuadrant } from '../../engine/expansionEngine.js';
```

- [ ] **Step 2: Update all 9 `generateSector` call sites**

Every occurrence of the pattern:
```typescript
sectorData = generateSector(X, Y, auth.userId);
```
must become:
```typescript
{
  const { qx, qy } = sectorToQuadrant(X, Y);
  const _controls = await getAllQuadrantControls();
  sectorData = generateSector(X, Y, auth.userId, isFrontierQuadrant(qx, qy, _controls));
}
```

Use `grep -n "generateSector" packages/server/src/rooms/services/NavigationService.ts` to find all 8 call sites (lines ~116, ~271, ~623, ~740, ~990, ~1253, ~1425 plus the SectorRoom.ts one).

For the `SectorRoom.ts` call site (line ~1066), `getAllQuadrantControls` is already imported — use the same pattern.

> **Note:** `_controls` is a block-scoped variable name to avoid collision with any outer variable named `controls`. Each call site gets its own `getAllQuadrantControls()` call since generation is rare and these are independent actions.

- [ ] **Step 3: Run full server tests**

```bash
cd packages/server && npx vitest run
```
Expected: All tests PASS (no signature errors)

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/NavigationService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: pass isFrontier to generateSector in NavigationService and SectorRoom"
```

---

### Task 4: ScanService — update `generateSector` call site

**Files:**
- Modify: `packages/server/src/rooms/services/ScanService.ts`

The area scan generates many sectors in a loop — fetch `allControls` **once before the loop**.

- [ ] **Step 1: Add imports to ScanService**

In `packages/server/src/rooms/services/ScanService.ts`, add:

```typescript
import { getAllQuadrantControls } from '../../db/queries.js';
import { isFrontierQuadrant } from '../../engine/expansionEngine.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
```

- [ ] **Step 2: Update the scan loop**

Find the area-scan loop (around line 180). Change from:

```typescript
const sectors: SectorData[] = [];
const newSectors: SectorData[] = [];
// ...
for (let dx = -radius; dx <= radius; dx++) {
  for (let dy = -radius; dy <= radius; dy++) {
    // ...
    if (!sector) {
      sector = generateSector(tx, ty, auth.userId);
      newSectors.push(sector);
    }
```

To:

```typescript
const sectors: SectorData[] = [];
const newSectors: SectorData[] = [];
const scanControls = await getAllQuadrantControls(); // fetch once for all sectors in batch
// ...
for (let dx = -radius; dx <= radius; dx++) {
  for (let dy = -radius; dy <= radius; dy++) {
    // ...
    if (!sector) {
      const { qx, qy } = sectorToQuadrant(tx, ty);
      const frontier = isFrontierQuadrant(qx, qy, scanControls);
      sector = generateSector(tx, ty, auth.userId, frontier);
      newSectors.push(sector);
    }
```

- [ ] **Step 3: Run server tests**

```bash
cd packages/server && npx vitest run
```
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/ScanService.ts
git commit -m "feat: pass isFrontier to generateSector in ScanService area scan"
```

---

## Chunk 3: Combat Guard

### Task 5: CombatService — frontier guard

**Files:**
- Modify: `packages/server/src/rooms/services/CombatService.ts`

The guard runs at the entry of both v1 (`handleBattleAction`) and v2 (`handleCombatV2Action`) combat. Existing `pirate_zone` sectors in the DB are **not affected** — only the combat trigger is blocked for non-frontier quadrants.

- [ ] **Step 1: Add imports to CombatService**

In `packages/server/src/rooms/services/CombatService.ts`, add:

```typescript
import { getAllQuadrantControls } from '../../db/queries.js';
import { isFrontierQuadrant } from '../../engine/expansionEngine.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
```

- [ ] **Step 2: Add frontier guard to `handleBattleAction`**

In `handleBattleAction`, add the guard right after the AP/credits/cargo reads, before `getPirateLevel`:

```typescript
// Frontier guard: pirates only fight in frontier quadrants
const { qx: bQx, qy: bQy } = sectorToQuadrant(data.sectorX, data.sectorY);
const bControls = await getAllQuadrantControls();
if (!isFrontierQuadrant(bQx, bQy, bControls)) {
  client.send('actionError', {
    code: 'NO_PIRATES',
    message: 'Dieser Sektor liegt tief im Zivilisationsgebiet. Keine Piraten mehr aktiv.',
  });
  return;
}
```

- [ ] **Step 3: Find and guard `handleCombatV2Action` entry point**

Search for `handleCombatV2Action` (or wherever `initCombatV2` is called / the v2 combat begins). Add the same guard at the top of that handler, before any state initialization:

```typescript
// Frontier guard
const { qx: v2Qx, qy: v2Qy } = sectorToQuadrant(data.sectorX, data.sectorY);
const v2Controls = await getAllQuadrantControls();
if (!isFrontierQuadrant(v2Qx, v2Qy, v2Controls)) {
  client.send('actionError', {
    code: 'NO_PIRATES',
    message: 'Dieser Sektor liegt tief im Zivilisationsgebiet. Keine Piraten mehr aktiv.',
  });
  return;
}
```

> **Note on v2 continuation:** `handleCombatV2Round` and `handleCombatV2Flee` operate on an existing in-memory state (`combatV2States.get(sessionId)`). These do NOT need a frontier check — a fight already in progress continues to conclusion.

- [ ] **Step 4: Run full server tests**

```bash
cd packages/server && npx vitest run
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/services/CombatService.ts
git commit -m "feat: block pirate combat in non-frontier quadrants (settled space)"
```

---

## Final Verification

- [ ] **Run all package tests**

```bash
cd packages/server && npx vitest run
cd packages/shared && npx vitest run
cd packages/client && npx vitest run
```
Expected: All pass, no regressions.

- [ ] **Smoke-check the logic mentally**

Quadrant (0,0) = human homeworld, fully surrounded by civilization as factions expand → `isFrontierQuadrant(0,0,controls)` → eventually returns `false` → no new pirate sectors, no combat. Quadrant at the edge of expansion with 3 empty neighbors → `frontier = true` → pirates generate and fight normally.
