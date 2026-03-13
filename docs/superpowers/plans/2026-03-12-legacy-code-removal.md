# Legacy Code Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dead, deprecated, and legacy code from the codebase (#277).

**Architecture:** Bottom-up removal — shared constants/types first, then server queries/services, then client UI, finally DB migration. Each task is independent after shared is rebuilt. Tests are cleaned alongside each removal.

**Tech Stack:** TypeScript monorepo (packages/shared, packages/server, packages/client), Vitest, PostgreSQL

---

## File Structure

**Modify:**
- `packages/shared/src/constants.ts` — remove SHIP_CLASSES, SECTOR_WEIGHTS, EMERGENCY_WARP_* constants
- `packages/shared/src/types.ts` — remove deriveEnvironment, deriveContents, isPlanetEnvironment
- `packages/shared/src/__tests__/constants.test.ts` — remove SECTOR_WEIGHTS tests
- `packages/shared/src/__tests__/fuelRework.test.ts` — remove FEATURE_EMERGENCY_WARP test
- `packages/server/src/db/queries.ts` — remove 6 legacy query functions
- `packages/server/src/rooms/SectorRoom.ts` — remove 2 message handlers
- `packages/server/src/rooms/services/NavigationService.ts` — remove handleEmergencyWarp + imports
- `packages/server/src/rooms/services/ShipService.ts` — remove handleGetModuleInventory
- `packages/server/src/__tests__/moduleInventory.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/economyInventory.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/werkstatt.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/blueprintInventory.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/miningInventory.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/kontorExtension.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/questInventory.test.ts` — remove legacy mocks
- `packages/server/src/__tests__/scanInventory.test.ts` — remove legacy mocks
- `packages/server/src/engine/__tests__/kontorEngine.test.ts` — remove legacy mocks
- `packages/client/src/components/NavControls.tsx` — remove emergency warp UI + imports
- `packages/client/src/network/client.ts` — remove sendEmergencyWarp + emergencyWarpResult handler
- `packages/client/src/ui-strings.ts` — remove EMERGENCY_WARP string

**Create:**
- `packages/server/src/db/migrations/059_drop_legacy_columns.sql`

---

### Task 1: Remove deprecated shared constants

**Files:**
- Modify: `packages/shared/src/constants.ts` — remove SHIP_CLASSES (~lines 478–517), SECTOR_WEIGHTS (~lines 24–32), EMERGENCY_WARP_* (~lines 2393–2400)
- Modify: `packages/shared/src/__tests__/constants.test.ts` — remove SECTOR_WEIGHTS tests (~lines 19–28)
- Modify: `packages/shared/src/__tests__/fuelRework.test.ts` — remove FEATURE_EMERGENCY_WARP test (~lines 28–30)

- [ ] **Step 1: Remove SHIP_CLASSES constant**

Remove the entire `SHIP_CLASSES` export (Record with aegis_scout_mk1 and void_seeker_mk2 definitions, ~lines 478–517). Also remove the comment line above it.

- [ ] **Step 2: Remove SECTOR_WEIGHTS constant**

Remove the `@deprecated` comment and the `SECTOR_WEIGHTS` export (~lines 24–32).

- [ ] **Step 3: Remove EMERGENCY_WARP constants**

Remove all 4 exports (~lines 2393–2400):
- `EMERGENCY_WARP_FREE_RADIUS`
- `EMERGENCY_WARP_CREDIT_PER_SECTOR`
- `EMERGENCY_WARP_FUEL_GRANT`
- `FEATURE_EMERGENCY_WARP`

Including their `@deprecated` comments.

- [ ] **Step 4: Remove SECTOR_WEIGHTS tests from constants.test.ts**

Remove the two tests (~lines 19–28):
- `'sector weights sum to 1'`
- `'every sector type has a weight'`

Also remove the `SECTOR_WEIGHTS` import.

- [ ] **Step 5: Remove FEATURE_EMERGENCY_WARP test from fuelRework.test.ts**

Remove the test (~lines 28–30):
- `'should disable emergency warp via feature flag'`

Also remove `FEATURE_EMERGENCY_WARP` from the imports.

- [ ] **Step 6: Rebuild shared package**

Run: `cd packages/shared && npm run build`
Expected: compiles without errors

- [ ] **Step 7: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/shared/
git commit -m "refactor: remove SHIP_CLASSES, SECTOR_WEIGHTS, EMERGENCY_WARP constants (#277)"
```

---

### Task 2: Remove unused type helper functions

**Files:**
- Modify: `packages/shared/src/types.ts` — remove deriveEnvironment (~lines 124–127), isPlanetEnvironment (~lines 134–137), deriveContents (~lines 139–153)

- [ ] **Step 1: Remove deriveEnvironment function**

Remove the comment + function (~lines 124–127):
```typescript
/** Derive environment from legacy SectorType */
export function deriveEnvironment(type: SectorType): SectorEnvironment {
  return type === 'nebula' ? 'nebula' : 'empty';
}
```

- [ ] **Step 2: Remove isPlanetEnvironment function**

Remove the comment + function (~lines 134–137):
```typescript
/** Returns true if an environment is a planet type */
export function isPlanetEnvironment(env: SectorEnvironment): boolean {
  return env === 'planet';
}
```

- [ ] **Step 3: Remove deriveContents function**

Remove the comment + function (~lines 139–153):
```typescript
/** Derive contents from legacy SectorType */
export function deriveContents(type: SectorType): SectorContent[] { ... }
```

- [ ] **Step 4: Rebuild shared and run tests**

Run: `cd packages/shared && npm run build && npx vitest run`
Expected: compiles and all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "refactor: remove unused type helpers deriveEnvironment, deriveContents, isPlanetEnvironment (#277)"
```

---

### Task 3: Remove legacy DB query functions

**Files:**
- Modify: `packages/server/src/db/queries.ts` — remove 6 functions
- Modify: 9 test files — remove legacy mocks/imports

The following functions are to be removed from `queries.ts`:
- `getModuleInventory()` (~lines 237–243)
- `addModuleToInventory()` (~lines 245–250)
- `removeModuleFromInventory()` (~lines 252–270)
- `getPlayerCargo()` (~lines 445–459)
- `addToCargo()` (~lines 461–473)
- `deductCargo()` (~lines 577–588)

- [ ] **Step 1: Remove the 6 legacy query functions from queries.ts**

Remove `getModuleInventory`, `addModuleToInventory`, `removeModuleFromInventory`, `getPlayerCargo`, `addToCargo`, `deductCargo` — entire function bodies including their exports.

- [ ] **Step 2: Clean up moduleInventory.test.ts**

Remove from the `vi.mock` block (~lines 10–40):
- `getModuleInventory: vi.fn(),`
- `addModuleToInventory: vi.fn(),`
- `removeModuleFromInventory: vi.fn(),`
- `getPlayerCargo: vi.fn(),`
- `deductCargo: vi.fn(),`

Remove from imports (~lines 89–100):
- `getPlayerCargo`
- `deductCargo`
- `addModuleToInventory`
- `removeModuleFromInventory`

- [ ] **Step 3: Clean up economyInventory.test.ts**

Remove from the `vi.mock` block:
- `addToCargo: vi.fn(),`
- `deductCargo: vi.fn(),`
- `getPlayerCargo: vi.fn(),`
- `getCargoTotal: vi.fn(),`

Remove from imports:
- `addToCargo`, `deductCargo`, `getPlayerCargo`, `getCargoTotal`

Keep the test assertions that verify these functions are NOT called — but change them to verify the new functions ARE called (the tests may need adjustment if they import removed symbols). If a test only exists to assert a legacy function is not called, remove the test.

- [ ] **Step 4: Clean up remaining 7 test files**

For each of these files, remove mock entries and imports for the removed functions:
- `werkstatt.test.ts`
- `blueprintInventory.test.ts`
- `miningInventory.test.ts`
- `kontorExtension.test.ts`
- `questInventory.test.ts`
- `scanInventory.test.ts`
- `kontorEngine.test.ts`

Pattern: search for `getPlayerCargo`, `addToCargo`, `deductCargo`, `getModuleInventory`, `addModuleToInventory`, `removeModuleFromInventory` in each file and remove the mock line + any import.

- [ ] **Step 5: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/
git commit -m "refactor: remove legacy cargo and module inventory query functions (#277)"
```

---

### Task 4: Remove emergency warp from server

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts` — remove handleEmergencyWarp (~lines 1338–1425) + EMERGENCY_WARP imports (~lines 77–79)
- Modify: `packages/server/src/rooms/SectorRoom.ts` — remove emergencyWarp message handler (~lines 408–410)

- [ ] **Step 1: Remove handleEmergencyWarp method from NavigationService**

Remove the entire method (~lines 1338–1425).

Remove the EMERGENCY_WARP imports (~lines 77–79):
```typescript
  EMERGENCY_WARP_FREE_RADIUS,
  EMERGENCY_WARP_CREDIT_PER_SECTOR,
  EMERGENCY_WARP_FUEL_GRANT,
```

- [ ] **Step 2: Remove emergencyWarp message handler from SectorRoom**

Remove (~lines 408–410):
```typescript
    this.onMessage('emergencyWarp', async (client) => {
      await this.navigation.handleEmergencyWarp(client);
    });
```

- [ ] **Step 3: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/server/
git commit -m "refactor: remove emergency warp feature from server (#277)"
```

---

### Task 5: Remove legacy module inventory handler from server

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` — remove getModuleInventory handler (~lines 665–667)
- Modify: `packages/server/src/rooms/services/ShipService.ts` — remove handleGetModuleInventory (~lines 224–232)

- [ ] **Step 1: Remove getModuleInventory message handler from SectorRoom**

Remove (~lines 665–667):
```typescript
    this.onMessage('getModuleInventory', async (client) => {
      await this.ships.handleGetModuleInventory(client);
    });
```

- [ ] **Step 2: Remove handleGetModuleInventory from ShipService**

Remove the entire method (~lines 224–232):
```typescript
  async handleGetModuleInventory(client: Client): Promise<void> { ... }
```

- [ ] **Step 3: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/server/
git commit -m "refactor: remove legacy getModuleInventory handler (#277)"
```

---

### Task 6: Remove emergency warp from client

**Files:**
- Modify: `packages/client/src/components/NavControls.tsx` — remove emergency warp UI (~lines 210–238) + imports of EMERGENCY_WARP_FREE_RADIUS, EMERGENCY_WARP_CREDIT_PER_SECTOR (~lines 8–9)
- Modify: `packages/client/src/network/client.ts` — remove sendEmergencyWarp (~lines 2286–2292) + emergencyWarpResult handler (~lines 1550–1581)
- Modify: `packages/client/src/ui-strings.ts` — remove EMERGENCY_WARP string (~line 69)

- [ ] **Step 1: Remove emergency warp UI from NavControls.tsx**

Remove the EMERGENCY_WARP constant imports (~lines 8–9):
```typescript
  EMERGENCY_WARP_FREE_RADIUS,
  EMERGENCY_WARP_CREDIT_PER_SECTOR,
```

Remove the entire emergency warp UI block (~lines 210–238) — the div with `EMERGENCY_WARP` status, cost calculation, and warp button.

- [ ] **Step 2: Remove sendEmergencyWarp from client.ts**

Remove the method (~lines 2286–2292):
```typescript
  sendEmergencyWarp() { ... }
```

- [ ] **Step 3: Remove emergencyWarpResult handler from client.ts**

Remove the `room.onMessage('emergencyWarpResult', ...)` block (~lines 1550–1581).

- [ ] **Step 4: Remove EMERGENCY_WARP from ui-strings.ts**

Remove (~line 69):
```typescript
    EMERGENCY_WARP: 'EMERGENCY WARP AVAILABLE',
```

- [ ] **Step 5: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/client/
git commit -m "refactor: remove emergency warp UI from client (#277)"
```

---

### Task 7: Add DB migration to drop legacy columns

**Files:**
- Create: `packages/server/src/db/migrations/059_drop_legacy_columns.sql`

- [ ] **Step 1: Create migration file**

Create `packages/server/src/db/migrations/059_drop_legacy_columns.sql`:

```sql
-- Drop legacy columns no longer referenced by application code
ALTER TABLE players DROP COLUMN IF EXISTS home_base;
ALTER TABLE players DROP COLUMN IF EXISTS module_inventory;
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/
git commit -m "chore: add migration 059 to drop legacy columns home_base, module_inventory (#277)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Rebuild shared**

Run: `cd packages/shared && npm run build`

- [ ] **Step 2: Run all tests**

Run server tests: `cd packages/server && npx vitest run`
Run client tests: `cd packages/client && npx vitest run`
Run shared tests: `cd packages/shared && npx vitest run`

Expected: all pass

- [ ] **Step 3: Verify no remaining references to removed code**

Search for: `SHIP_CLASSES`, `SECTOR_WEIGHTS`, `EMERGENCY_WARP`, `getModuleInventory` (as export), `addModuleToInventory` (as export), `removeModuleFromInventory` (as export), `getPlayerCargo` (as export), `addToCargo` (as export), `deriveEnvironment`, `deriveContents`, `isPlanetEnvironment`, `handleEmergencyWarp`, `sendEmergencyWarp`

Expected: no matches in `.ts`/`.tsx` source files (only in `.d.ts` build artifacts and this plan/spec)
