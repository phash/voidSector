# Fuel-Rebalance, Hyperjump-Aktivierung & Hull-Legacy-Cleanup

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the hull system legacy code, permanently activate the Hyperjump V2 system, and improve the Fuel UI in ShipStatusPanel.

**Architecture:** Work outward from the shared package (types → constants → calculators), then server, then client. Each task leaves the codebase compilable and tests green before the next commit.

**Tech Stack:** TypeScript strict, Vitest, React + Zustand, Colyseus (server), PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-13-fuel-hyperjump-hull-cleanup-design.md`

---

## Chunk 1: Shared Package — Foundation

### Task 1: Add BASE_* constants

**Files:**
- Modify: `packages/shared/src/constants.ts`

Context: All `HULLS[x].baseFoo` lookups in `shipCalculator.ts` and elsewhere will be replaced with these constants. Add them near the top of the constants file, after the existing base AP/fuel constants section.

- [ ] **Step 1: Add constants to `constants.ts`**

In `packages/shared/src/constants.ts`, find the block near `FUEL_MIN_TANK` and add after it:

```typescript
// Base ship stats (replaces hull-specific values after hull system removal)
export const BASE_FUEL_CAPACITY = 10_000;
export const BASE_FUEL_PER_JUMP = 100;
export const BASE_CARGO = 3;
export const BASE_MODULE_SLOTS = 3;
export const BASE_HP = 100;
export const BASE_JUMP_RANGE = 5;
export const BASE_ENGINE_SPEED = 2;
export const BASE_COMM_RANGE = 100;
export const BASE_SCANNER_LEVEL = 1;
```

- [ ] **Step 2: Export from index**

Check `packages/shared/src/index.ts` — ensure the new constants are exported (they will be if `constants.ts` is already re-exported via `export * from './constants.js'`). Verify with:

```bash
grep "constants" packages/shared/src/index.ts
```

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: add BASE_* ship stat constants to replace HULLS lookups (#291)"
```

---

### Task 2: Update `calcHyperjumpFuelV2` — remove `hullMultiplier`

**Files:**
- Modify: `packages/shared/src/jumpCalc.ts`
- Modify: `packages/shared/src/__tests__/fuelRework.test.ts`

Context: The function currently has signature `calcHyperjumpFuelV2(baseFuelPerSector, distance, hullMultiplier, driveEfficiency)`. We remove `hullMultiplier` (always 1.0). We also update `fuelRework.test.ts` which tests the old 4-arg signature.

- [ ] **Step 1: Update the test first (TDD)**

Open `packages/shared/src/__tests__/fuelRework.test.ts`.

Replace the entire file with tests for the new 3-arg signature. Key assertions to keep:
- `calcHyperjumpFuelV2(100, 10, 0)` = `1000` (100 * 10 * (1 - 0))
- `calcHyperjumpFuelV2(100, 10, 0.5)` = `500` (50% efficiency)
- `calcHyperjumpFuelV2(100, 1, 1.0)` = `1` (minimum clamp: max(1, ceil(0)))
- `calcHyperjumpFuelV2(100, 5, 0.2)` = `400` (100 * 5 * 0.8)

Remove all tests that reference `HULL_FUEL_MULTIPLIER`, `HullType`, or `HULLS`.

New file content:

```typescript
import { describe, it, expect } from 'vitest';
import { calcHyperjumpFuelV2 } from '../jumpCalc.js';
import { SCAN_FUEL_COST, MINE_FUEL_COST } from '../constants.js';

describe('Fuel Rework (#94 / #291)', () => {
  describe('fuel constants', () => {
    it('scan fuel cost is 0', () => {
      expect(SCAN_FUEL_COST).toBe(0);
    });
    it('mine fuel cost is 0', () => {
      expect(MINE_FUEL_COST).toBe(0);
    });
  });

  describe('calcHyperjumpFuelV2 — 3-arg signature', () => {
    it('base case: 100/sector * 10 sectors * no efficiency = 1000', () => {
      expect(calcHyperjumpFuelV2(100, 10, 0)).toBe(1000);
    });
    it('50% drive efficiency halves cost', () => {
      expect(calcHyperjumpFuelV2(100, 10, 0.5)).toBe(500);
    });
    it('100% efficiency clamps to minimum 1', () => {
      expect(calcHyperjumpFuelV2(100, 1, 1.0)).toBe(1);
    });
    it('20% efficiency: 100*5*0.8 = 400', () => {
      expect(calcHyperjumpFuelV2(100, 5, 0.2)).toBe(400);
    });
    it('efficiency clamped to max 1 even if > 1', () => {
      expect(calcHyperjumpFuelV2(100, 10, 1.5)).toBe(1);
    });
    it('efficiency clamped to min 0 even if negative', () => {
      expect(calcHyperjumpFuelV2(100, 5, -0.5)).toBe(500);
    });
    it('distance 1 * base 100 * 0 efficiency = 100', () => {
      expect(calcHyperjumpFuelV2(100, 1, 0)).toBe(100);
    });
  });
});
```

- [ ] **Step 2: Run test — verify it FAILS**

```bash
cd packages/shared && npx vitest run src/__tests__/fuelRework.test.ts
```

Expected: FAIL — `calcHyperjumpFuelV2` is called with 3 args but expects 4.

- [ ] **Step 3: Update `jumpCalc.ts`**

In `packages/shared/src/jumpCalc.ts`, update `calcHyperjumpFuelV2`:

```typescript
/**
 * V2 fuel formula (#291): only hyperjumps cost fuel.
 * cost = ceil(BASE_FUEL_PER_JUMP * distance * (1 - driveEfficiency))
 * @param baseFuelPerSector  BASE_FUEL_PER_JUMP (100)
 * @param distance           sector distance of hyperjump
 * @param driveEfficiency    0..1 — better drives reduce cost (0 = no reduction)
 */
export function calcHyperjumpFuelV2(
  baseFuelPerSector: number,
  distance: number,
  driveEfficiency: number,
): number {
  const clampedEfficiency = Math.max(0, Math.min(1, driveEfficiency));
  return Math.max(
    1,
    Math.ceil(baseFuelPerSector * distance * (1 - clampedEfficiency)),
  );
}
```

- [ ] **Step 4: Run test — verify it PASSES**

```bash
cd packages/shared && npx vitest run src/__tests__/fuelRework.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Build shared**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/jumpCalc.ts packages/shared/src/__tests__/fuelRework.test.ts
git commit -m "refactor: remove hullMultiplier from calcHyperjumpFuelV2, update tests (#291)"
```

---

### Task 3: Update `shipCalculator.ts` — remove `hullType` parameter

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts`
- Modify: `packages/shared/src/__tests__/shipCalculatorAcep.test.ts`

Context: `calculateShipStats(hullType, modules, acepXp)` currently looks up `HULLS[hullType]` for base stats. Replace with `BASE_*` constants. Same for `validateModuleInstall`. Note: `shipCalculator.ts` imports `HULLS` and `HullType` — both will be removed.

- [ ] **Step 1: Check `validateModuleInstall` signature**

```bash
grep -n "validateModuleInstall" packages/shared/src/shipCalculator.ts | head -5
```

Note the exact signature and all usages of `hullType` inside the function.

- [ ] **Step 2: Update `calculateShipStats` in `shipCalculator.ts`**

Change the import block at the top of the file — remove `HULLS` and add new constants:

```typescript
import {
  MODULES,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
  ACEP_EXTRA_SLOT_THRESHOLDS,
  DEFENSE_ONLY_CATEGORIES,
  SPECIALIZED_SLOT_CATEGORIES,
  UNIQUE_MODULE_CATEGORIES,
  BASE_HULL_AP_REGEN,
  POWER_LEVEL_MULTIPLIERS,
  BASE_SCANNER_MEMORY,
  FUEL_MIN_TANK,
  BASE_FUEL_CAPACITY,
  BASE_FUEL_PER_JUMP,
  BASE_CARGO,
  BASE_MODULE_SLOTS,
  BASE_HP,
  BASE_JUMP_RANGE,
  BASE_ENGINE_SPEED,
  BASE_COMM_RANGE,
  BASE_SCANNER_LEVEL,
} from './constants.js';
import type { ShipModule, ShipStats, AcepXpSnapshot } from './types.js';
```

Remove the `import type { HullType, ... }` line (or remove `HullType` from it).

Replace lines 33–60 of the file (function signature through the stats object literal). The exact region to replace is everything from `export function calculateShipStats(` through the closing `};` of the initial `const stats: ShipStats = { ... }` block (which ends around line 66). Replace with:

```typescript
export function calculateShipStats(
  modules: ShipModule[],
  acepXp?: AcepXpSnapshot,
): ShipStats {
  const stats: ShipStats = {
    fuelMax: BASE_FUEL_CAPACITY,
    cargoCap: BASE_CARGO,
    jumpRange: BASE_JUMP_RANGE,
    apCostJump: 1,
    fuelPerJump: BASE_FUEL_PER_JUMP,
    hp: BASE_HP,
    commRange: BASE_COMM_RANGE,
    scannerLevel: BASE_SCANNER_LEVEL,
    damageMod: 1.0,
    shieldHp: 0,
    shieldRegen: 0,
    weaponAttack: 0,
    weaponType: 'none',
    weaponPiercing: 0,
    pointDefense: 0,
    ecmReduction: 0,
    engineSpeed: BASE_ENGINE_SPEED,
    artefactChanceBonus: 0,
    safeSlotBonus: 0,
    hyperdriveRange: 0,
    hyperdriveSpeed: 0,
    hyperdriveRegen: 0,
    hyperdriveFuelEfficiency: 0,
    miningBonus: 0,
    generatorEpPerRound: 0,
    repairHpPerRound: 0,
    repairHpPerSecond: 0,
    memory: BASE_SCANNER_MEMORY,
  };
```

The rest of the function body (ACEP level computation, module loop, etc.) is unchanged.

- [ ] **Step 3: Update `validateModuleInstall` in `shipCalculator.ts`**

The function signature (lines 121–127) accepts `hullType: HullType` as its first parameter but **never uses it** in the body — all validation is based on module category, slot index, and ACEP XP. Simply remove the `hullType: HullType` parameter from the signature:

```typescript
// Before (line 121-127):
export function validateModuleInstall(
  hullType: HullType,
  currentModules: ShipModule[],
  moduleId: string,
  slotIndex: number,
  acepXp: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 },
): { valid: boolean; error?: string }

// After:
export function validateModuleInstall(
  currentModules: ShipModule[],
  moduleId: string,
  slotIndex: number,
  acepXp: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 },
): { valid: boolean; error?: string }
```

No body changes needed — the function body doesn't reference `hullType` at all.

- [ ] **Step 4: Fix `shipCalculatorAcep.test.ts`**

```bash
grep -n "HULLS\|hullType\|hull" packages/shared/src/__tests__/shipCalculatorAcep.test.ts | head -10
```

Replace `HULLS['scout'].baseCargo` with `3`, and update all `calculateShipStats('scout', ...)` calls to `calculateShipStats(...)` (remove first arg).

- [ ] **Step 5: Run shared tests**

```bash
cd packages/shared && npx vitest run
```

Fix any remaining compilation errors. The main expected failures are calls to `calculateShipStats` with a `hullType` first arg — these will be in tests. Fix them by removing the first arg.

- [ ] **Step 6: Build shared**

```bash
cd packages/shared && npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/shipCalculator.ts packages/shared/src/__tests__/shipCalculatorAcep.test.ts
git commit -m "refactor: remove hullType from calculateShipStats and validateModuleInstall (#291)"
```

---

### Task 4: Remove hull types and hull constants from shared

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

Context: Now that no shared code uses `HullType` or `HULLS`, we can safely delete them. `FEATURE_HYPERDRIVE_V2` is also deleted here.

- [ ] **Step 1: Remove from `types.ts`**

Delete these three items from `packages/shared/src/types.ts`:
- `export type HullType = 'scout' | 'freighter' | 'cruiser' | 'explorer' | 'battleship';`
- `export type HullSize = 'small' | 'medium' | 'large';`
- The entire `HullDefinition` interface (18 lines)
- The `hullType: HullType;` field from `ShipRecord`

- [ ] **Step 2: Remove from `constants.ts`**

Delete from `packages/shared/src/constants.ts`:
- `export const FEATURE_HYPERDRIVE_V2 = false;` (single line, ~line 380)
- The entire `HULLS` constant (~lines 540–641, 106 lines)
- The entire `HULL_PRICES` constant (~6 lines)
- The entire `HULL_FUEL_MULTIPLIER` constant (~7 lines)
- The `HullType` import at the top of `constants.ts` if present

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && npm run build
```

Expected: errors about missing `HullType` in server/client — that's normal, we haven't updated them yet. Shared itself should compile cleanly.

- [ ] **Step 4: Run shared tests**

```bash
cd packages/shared && npx vitest run
```

Fix any test that still references `HULLS`, `HullType`, `HULL_FUEL_MULTIPLIER`, or `FEATURE_HYPERDRIVE_V2`.

- [ ] **Step 5: Fix remaining shared tests**

For `jumpCalc.test.ts`: delete the tests that use `HULLS[hull].baseEngineSpeed` (hull-based engine speed tests). Keep the `ENGINE_SPEED` tests (those are module-based).

For `hyperdriveV2.test.ts`: remove `hullMultiplier` argument from all `calcHyperjumpFuelV2()` calls, and delete any `expect(FEATURE_HYPERDRIVE_V2).toBe(false)` assertion.

For `shipLookup.test.ts` (server package, `packages/server/src/engine/__tests__/shipLookup.test.ts`): **delete the file** — it only tests hull definitions.

- [ ] **Step 6: Run shared tests again**

```bash
cd packages/shared && npx vitest run
```

Expected: all shared tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/__tests__/
git commit -m "refactor: delete HullType, HULLS, HULL_PRICES, HULL_FUEL_MULTIPLIER, FEATURE_HYPERDRIVE_V2 from shared (#291)"
```

---

## Chunk 2: Server — DB + Queries + Services

### Task 5: DB migration + update `queries.ts` and `adminQueries.ts`

**Files:**
- Create: `packages/server/src/db/migrations/060_drop_hull_type.sql`
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/db/adminQueries.ts`

Context: The `ships` table has a `hull_type` column we no longer need. Migration 059 is the current last migration. After dropping the column, `queries.ts` must stop selecting/inserting it.

- [ ] **Step 1: Create migration**

Create `packages/server/src/db/migrations/060_drop_hull_type.sql`:

```sql
-- Migration 060: remove hull_type column (hull system removed in #291)
ALTER TABLE ships DROP COLUMN IF EXISTS hull_type;
```

- [ ] **Step 2: Update `createShip()` in `queries.ts`**

Current signature:
```typescript
export async function createShip(
  playerId: string,
  hullType: HullType,
  name: string,
  initialFuel: number,
): Promise<ShipRecord>
```

New signature (remove `hullType` param, remove from INSERT):
```typescript
export async function createShip(
  playerId: string,
  name: string,
  initialFuel: number,
): Promise<ShipRecord>
```

Update the INSERT statement:
```typescript
// Before:
`INSERT INTO ships (owner_id, hull_type, name, fuel, active) VALUES ($1, $2, $3, $4, true) RETURNING *`
[playerId, hullType, name, initialFuel]

// After:
`INSERT INTO ships (owner_id, name, fuel, active) VALUES ($1, $2, $3, true) RETURNING *`
[playerId, name, initialFuel]
```

- [ ] **Step 3: Update all `SELECT` query return mappings in `queries.ts`**

Find all places that map `row.hull_type as HullType` or include `hullType` in a returned object:
- `getActiveShip()` — remove `hullType: row.hull_type as HullType`
- `getShips()` / `getPlayerShips()` — same
- `getShipForPermadeath()` — remove `hullType` mapping and its usage in `calculateShipStats` call (now 2-arg)

The `ShipRecord` type no longer has `hullType`, so TypeScript will flag these.

- [ ] **Step 4: Update `adminQueries.ts`**

Remove `hull_type` from the SELECT statement and from the returned object mapping in the admin ship-listing query.

- [ ] **Step 5: Remove `HullType` import from `queries.ts`**

```bash
grep -n "HullType" packages/server/src/db/queries.ts
```

Remove the import line.

- [ ] **Step 6: Run server type-check**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -50
```

Fix type errors in queries.ts and adminQueries.ts only (other files will error — that's expected for now).

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db/migrations/060_drop_hull_type.sql \
        packages/server/src/db/queries.ts \
        packages/server/src/db/adminQueries.ts
git commit -m "refactor: drop hull_type column (migration 060), remove from queries (#291)"
```

---

### Task 6: Update server services — remove hull references

**Files:**
- Modify: `packages/server/src/rooms/services/ServiceContext.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/rooms/services/NavigationService.ts`
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Modify: `packages/server/src/rooms/services/CombatService.ts`
- Modify: `packages/server/src/engine/autopilot.ts`
- Modify: `packages/server/src/engine/permadeathService.ts`

- [ ] **Step 1: `ServiceContext.ts`**

Remove the `clientHullTypes: Map<string, HullType>` field from the interface/class. Remove any `HullType` import.

- [ ] **Step 2: `SectorRoom.ts`**

Make these changes:
1. Delete `private clientHullTypes = new Map<string, HullType>();`
2. Delete all `.clientHullTypes.set(...)`, `.clientHullTypes.get(...)`, `.clientHullTypes.delete(...)` calls
3. Update the `createShip` call (around line 1164) — remove `hullType` arg, replace `HULLS.scout.baseFuel` with `BASE_FUEL_CAPACITY`:
   ```typescript
   // Before:
   await createShip(auth.userId, 'scout', 'AEGIS', HULLS.scout.baseFuel);
   // After:
   await createShip(auth.userId, 'AEGIS', BASE_FUEL_CAPACITY);
   ```
4. Remove `HullType` and `HULLS` imports. Add `BASE_FUEL_CAPACITY` import from shared.

- [ ] **Step 3: `NavigationService.ts` — remove hull references**

1. Remove import of `HULL_FUEL_MULTIPLIER`
2. Remove `const hullType = this.ctx.clientHullTypes.get(...) ?? 'scout';` (two occurrences: hyperjump handler + autopilot handler)
3. Remove `const hullMult = HULL_FUEL_MULTIPLIER[hullType] ?? 1.0;` (two occurrences)
4. Update `calcHyperjumpFuelV2()` calls — remove `hullMult` argument:
   ```typescript
   // Before:
   calcHyperjumpFuelV2(HYPERJUMP_FUEL_PER_SECTOR, distance, hullMult, ship.hyperdriveFuelEfficiency)
   // After:
   calcHyperjumpFuelV2(BASE_FUEL_PER_JUMP, distance, ship.hyperdriveFuelEfficiency)
   ```
   Note: use `BASE_FUEL_PER_JUMP` (100) instead of `HYPERJUMP_FUEL_PER_SECTOR` (1).

- [ ] **Step 4: `NavigationService.ts` — activate hyperjump (resolve all FEATURE_HYPERDRIVE_V2 sites)**

There are 4 distinct sites to handle:

**Site A — around line 507 (hyperjump handler, main if/else):**
```typescript
// Remove: if (FEATURE_HYPERDRIVE_V2) { ... } else { ... }
// Keep only the V2 block contents (unwrap the if, delete the else branch)
```

**Site B — around line 1141 (autopilot completion, inline &&):**
```typescript
// Before:
if (FEATURE_HYPERDRIVE_V2 && (targetSector.contents?.includes('station') || ...)) {
  await this.tryAutoRefuel(client, auth, ship);
}
// After (remove flag, keep logic):
if (targetSector.contents?.includes('station') || targetSector.type === 'station') {
  await this.tryAutoRefuel(client, auth, ship);
}
```

**Site C — around line 1155 (autopilot charge fetch, if/else):**
```typescript
// Before:
if (useHyperjump && FEATURE_HYPERDRIVE_V2) {
  // get charge from hyperdriveState
} else if (useHyperjump) {
  // V1: treat charge as fuel
}
// After (keep V2 branch, remove else-if):
if (useHyperjump) {
  const hdState = await getHyperdriveState(auth.userId);
  if (hdState) { hyperdriveCharge = calculateCurrentCharge(hdState); }
}
```

**Site D — around line 1235 (autopilot segment, inline &&):**
```typescript
// Before:
if (segment.isHyperjump && FEATURE_HYPERDRIVE_V2) {
// After:
if (segment.isHyperjump) {
```

Remove the `FEATURE_HYPERDRIVE_V2` import from `NavigationService.ts`.

- [ ] **Step 5: `SectorRoom.ts` — activate hyperjump (resolve FEATURE_HYPERDRIVE_V2 sites)**

Find all `if (FEATURE_HYPERDRIVE_V2)` blocks in `SectorRoom.ts`. Keep V2 code, delete V1 branches and if-wrappers. Remove the import.

- [ ] **Step 5b: `NavigationService.ts` — fix inline autopilot fuel calculation**

The autopilot segment fuel cost around lines 1197–1209 does NOT call `calcHyperjumpFuelV2` — it inlines the formula with `hullMul`. Replace this block:

```typescript
// Before (lines 1197-1209):
let fuelCost = 0;
if (segment.isHyperjump) {
  const segHullType = this.ctx.clientHullTypes.get(client.sessionId) ?? 'scout';
  const hullMul = HULL_FUEL_MULTIPLIER[segHullType] ?? 1.0;
  fuelCost = Math.max(
    1,
    Math.ceil(
      HYPERJUMP_FUEL_PER_SECTOR * segment.moves.length * hullMul * (1 - ship.hyperdriveFuelEfficiency),
    ),
  );

// After:
let fuelCost = 0;
if (segment.isHyperjump) {
  fuelCost = calcHyperjumpFuelV2(BASE_FUEL_PER_JUMP, segment.moves.length, ship.hyperdriveFuelEfficiency);
```

Ensure `calcHyperjumpFuelV2` and `BASE_FUEL_PER_JUMP` are imported at the top of `NavigationService.ts`.

- [ ] **Step 6: `ShipService.ts`**

Update all calls to `calculateShipStats()` and `validateModuleInstall()` — remove the first `hullType` argument:
```typescript
// Before:
calculateShipStats(ship.hullType, ship.modules, acepXp)
// After:
calculateShipStats(ship.modules, acepXp)

// Before:
validateModuleInstall(ship.hullType, ship.modules, moduleId, slotIndex)
// After:
validateModuleInstall(ship.modules, moduleId, slotIndex)
```

- [ ] **Step 7: `CombatService.ts`**

Delete the line: `this.ctx.clientHullTypes.set(client.sessionId, newShip.hullType);`
Remove `HullType` import if present.

- [ ] **Step 8: `autopilot.ts`**

Delete the `getHullTypeFromStats()` function and its call site. Remove `HULL_FUEL_MULTIPLIER` import. Update the fuel cost calculation in autopilot to call `calcHyperjumpFuelV2` with 3 args (no hull multiplier).

- [ ] **Step 9: `permadeathService.ts`**

Remove `hull_type` from the INSERT statement. The column no longer exists (migration 060).

- [ ] **Step 10: Run server type-check**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -50
```

Expected: zero errors. Fix any remaining `HullType`/`HULLS` references flagged by TypeScript.

- [ ] **Step 11: Run server tests**

```bash
cd packages/server && npx vitest run
```

Fix test mock contexts that still initialize `clientHullTypes: new Map()` — delete those lines. Fix `farNav.test.ts` and `fuel.test.ts` that reference `HULLS.scout/freighter/explorer` — replace with hardcoded constants (`baseFuel: 10_000`, `baseFuelPerJump: 100`, etc.).

- [ ] **Step 12: Commit**

```bash
git add packages/server/src/
git commit -m "refactor: remove hull system from server, activate FEATURE_HYPERDRIVE_V2 permanently (#291)"
```

---

## Chunk 3: Client — Remove Hull References + Fuel UI

### Task 7: Update client state and components

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/components/ShipBlock.tsx`
- Modify: `packages/client/src/components/ShipDetailPanel.tsx`
- Modify: `packages/client/src/components/ShipStatusPanel.tsx`
- Modify: `packages/client/src/components/NavTargetPanel.tsx`
- Modify: `packages/client/src/components/AcepDetailPanel.tsx`
- Modify: `packages/client/src/components/ModuleTab.tsx`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/components/RadarCanvas.tsx`

- [ ] **Step 1: `gameSlice.ts`**

Remove `hullType: HullType` from `ClientShipData` interface. Remove `HullType` import from `@void-sector/shared`.

- [ ] **Step 2: `ShipBlock.tsx`**

Remove `import { HULLS } from '@void-sector/shared'`.
Remove `const hull = HULLS[hullType];` and any usage of `hull.name`, `hull.size`, etc.
The ship name comes from `ship.name` directly (ACEP name or AEGIS). Remove hull name display entirely.

- [ ] **Step 3: `ShipDetailPanel.tsx`**

Replace `HULLS[ship.hullType]?.slots ?? 3` with `BASE_MODULE_SLOTS` (import from `@void-sector/shared`).
Update `validateModuleInstall()` call — remove `ship.hullType` first arg.

- [ ] **Step 4: `ShipStatusPanel.tsx` — remove hull reference**

In `ShipStatusPanel.tsx`, line ~34:
```typescript
// Remove this:
const { id: shipId, name: shipName, hullType, stats, acepXp: xp } = ship;
const hull = HULLS[hullType];

// Replace with:
const { id: shipId, name: shipName, stats, acepXp: xp } = ship;
```

Remove `import { HULLS } from '@void-sector/shared'`.
Remove any hull name display (the `hull.name` usage in the component header).

- [ ] **Step 5: `ShipStatusPanel.tsx` — add Fuel UI**

Replace the current fuel text row in the Stats tab with a Fuel section. The stats array currently contains:
```typescript
['FUEL', fuel ? `${fuel.current}/${fuel.max}` : `—/${stats.fuelMax}`],
```

Remove this entry from the stats array.

After the stats array `.map()` block, add a new FUEL section (before the existing HYPERDRIVE section):

```tsx
{/* Fuel section */}
<div style={hdr}>FUEL</div>
<div style={row}>
  <span style={dim}>TANK</span>
  <span style={pri}>
    {fuel ? fuel.current.toLocaleString() : '—'}
    <span style={{ opacity: 0.4 }}> / {(fuel?.max ?? stats.fuelMax).toLocaleString()}</span>
  </span>
</div>
{fuel && (
  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, margin: '2px 0 4px' }}>
    <div style={{
      height: '100%',
      width: `${Math.min(100, Math.round((fuel.current / fuel.max) * 100))}%`,
      background: 'linear-gradient(90deg, #f97316, #fb923c)',
      borderRadius: 2,
      transition: 'width 0.3s',
    }} />
  </div>
)}
<div style={row}>
  <span style={dim}>COST/SEKTOR</span>
  <span style={pri}>{stats.fuelPerJump}</span>
</div>
```

- [ ] **Step 6: `AcepDetailPanel.tsx`**

Lines 93, 96, 97 call `calculateShipStats(ship.hullType, modules, acepXp)`. Remove the first argument from all three calls:
```typescript
// Before:
calculateShipStats(ship.hullType, withoutModule, acepXp)
calculateShipStats(ship.hullType, [...withoutModule, ...], acepXp)
calculateShipStats(ship.hullType, currentModules, acepXp)
// After:
calculateShipStats(withoutModule, acepXp)
calculateShipStats([...withoutModule, ...], acepXp)
calculateShipStats(currentModules, acepXp)
```

- [ ] **Step 7: `ModuleTab.tsx`**

Line 80 calls `validateModuleInstall(ship.hullType, ship.modules, ...)`. Remove the first argument:
```typescript
// Before:
validateModuleInstall(ship.hullType, ship.modules, selectedModuleId, slot.index, acepXp)
// After:
validateModuleInstall(ship.modules, selectedModuleId, slot.index, acepXp)
```

- [ ] **Step 8: `RadarRenderer.ts` and `RadarCanvas.tsx`**

In `RadarRenderer.ts`:
- Line 17: remove `HullType` from the import
- Line 81: remove `hullType?: HullType;` from the state interface
- Line 317: replace `const ownHull = state.hullType ?? 'scout';` — the `ownHull` variable is likely used for something visual (check what it's used for immediately after line 317 and either hardcode the visual value or remove the logic if it was only hull-dependent)

In `RadarCanvas.tsx`:
- Line 74: remove `hullType: state.ship?.hullType,` from the props/state passed to the renderer.

- [ ] **Step 9: `NavTargetPanel.tsx` — fix hull reference and add color**

Replace:
```typescript
import { innerCoord, calcHyperjumpFuel, HULLS } from '@void-sector/shared';
const fuelPerJump = ship?.stats?.fuelPerJump ?? HULLS.scout.baseFuelPerJump;
```

With:
```typescript
import { innerCoord, calcHyperjumpFuel, BASE_FUEL_PER_JUMP } from '@void-sector/shared';
const fuelPerJump = ship?.stats?.fuelPerJump ?? BASE_FUEL_PER_JUMP;
```

Then find where `estimatedFuel` is displayed in the JSX (the `AP: ~X | Fuel: ~Y | Zeit: ~Zs` line) and add color to the fuel part:

```tsx
<span style={{ color: (fuel?.current ?? 0) >= estimatedFuel ? '#4ade80' : '#f87171' }}>
  Fuel: ~{estimatedFuel}
</span>
```

- [ ] **Step 10: Run client type-check**

```bash
cd packages/client && npx tsc --noEmit 2>&1 | head -50
```

Fix any remaining `hullType`/`HULLS`/`HullType` references.

- [ ] **Step 11: Fix client test files**

Search for `hullType` in all client test files:

```bash
grep -rn "hullType" packages/client/src --include="*.test.tsx" --include="*.test.ts"
```

For each match: remove `hullType: 'scout' as HullType` (or similar) from mock ship objects. The `ClientShipData` type no longer has this field. Example fix:
```typescript
// Before:
const mockShip: ClientShipData = { id: '1', hullType: 'scout', name: 'AEGIS', ... };
// After:
const mockShip: ClientShipData = { id: '1', name: 'AEGIS', ... };
```

Expected files to fix: `ShipStatusPanel.test.tsx`, `ShipDetailPanel.test.tsx`, `AcepDetailPanel.test.tsx`, `ModuleTab.test.tsx`, possibly others.

- [ ] **Step 12: Run client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all client tests pass.

- [ ] **Step 13: Commit**

```bash
git add packages/client/src/
git commit -m "refactor: remove hull system from client, add fuel bar to ShipStatusPanel (#291)"
```

---

## Chunk 4: Final Verification

### Task 8: Full test run + cleanup check

- [ ] **Step 1: Run all three test suites**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected: all green (~205 shared, ~973 server, ~499 client).

- [ ] **Step 2: Verify no hull references remain**

```bash
grep -r "HullType\|HULLS\|HULL_FUEL_MULTIPLIER\|FEATURE_HYPERDRIVE_V2\|hull_type\|hullType" \
  packages/shared/src packages/server/src packages/client/src \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=__tests__ | grep -v ".d.ts" | grep -v "node_modules"
```

Expected: zero output. If any remain, fix them.

- [ ] **Step 3: Check test files too**

```bash
grep -r "HullType\|HULLS\|HULL_FUEL_MULTIPLIER\|FEATURE_HYPERDRIVE_V2" \
  packages/shared/src/__tests__ packages/server/src/__tests__ packages/server/src/engine/__tests__ \
  --include="*.ts"
```

Expected: zero output. Fix any remaining test references.

- [ ] **Step 4: Verify `shipLookup.test.ts` is deleted**

```bash
ls packages/server/src/engine/__tests__/shipLookup.test.ts 2>&1
```

Expected: `No such file or directory`. If it still exists, delete it:
```bash
rm packages/server/src/engine/__tests__/shipLookup.test.ts
```

- [ ] **Step 5: Start server locally and verify Hyperjump works**

```bash
npm run docker:up   # start DB + Redis if not running
npm run dev:server
```

Connect a client. Navigate to a sector with a drive module installed. Verify:
- Hyperjump button available when target is set
- Charge bar visible in ShipStatusPanel
- Fuel bar visible in ShipStatusPanel (orange)
- `COST/SEKTOR` shows the fuel per sector
- Fuel cost in NavTargetPanel shows green/red based on available fuel

- [ ] **Step 6: Final commit**

```bash
git add -u
git commit -m "test: cleanup hull-related tests, verify all suites green (#291)"
```

---

## Summary

| Chunk | Files | Tests |
|-------|-------|-------|
| 1 — Shared | `constants.ts`, `jumpCalc.ts`, `shipCalculator.ts`, `types.ts` | fuelRework, shipCalculatorAcep, hyperdriveV2, jumpCalc |
| 2 — Server | `queries.ts`, `adminQueries.ts`, `SectorRoom.ts`, `ServiceContext.ts`, `NavigationService.ts`, `ShipService.ts`, `CombatService.ts`, `autopilot.ts`, `permadeathService.ts`, migration 060 | farNav, fuel, server mocks, delete shipLookup |
| 3 — Client | `gameSlice.ts`, `ShipBlock.tsx`, `ShipDetailPanel.tsx`, `ShipStatusPanel.tsx`, `NavTargetPanel.tsx` | client component tests |
| 4 — Verify | grep checks, manual test | all suites |
