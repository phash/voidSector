# Legacy Code Removal (#277)

## Goal

Remove all dead, deprecated, and legacy code that no longer matches the current spec. Clean sweep across shared, server, and client packages plus a DB migration to drop orphaned columns.

## Removals

### Shared Package (`packages/shared/src/`)

#### Constants (`constants.ts`)
- **`SHIP_CLASSES`** — old ship definitions (aegis_scout_mk1, void_seeker_mk2), replaced by `HULLS`
- **`SECTOR_WEIGHTS`** — marked `@deprecated`, unused in code (only in tests)
- **`EMERGENCY_WARP_FREE_RADIUS`** (200)
- **`EMERGENCY_WARP_CREDIT_PER_SECTOR`** (5)
- **`EMERGENCY_WARP_FUEL_GRANT`** (10)
- **`FEATURE_EMERGENCY_WARP`** (false) — note: this flag is never checked anywhere; emergency warp is fully active despite it. This is an active feature removal, not dead code cleanup.

#### Types (`types.ts`)
- **`deriveEnvironment()`** — unused outside tests
- **`deriveContents()`** — unused outside tests
- **`isPlanetEnvironment()`** — unused outside tests

### Server Package (`packages/server/src/`)

#### DB Queries (`db/queries.ts`)
- **`getModuleInventory()`** — reads legacy `module_inventory` JSONB column
- **`addModuleToInventory()`** — writes legacy `module_inventory` JSONB column
- **`removeModuleFromInventory()`** — writes legacy `module_inventory` JSONB column
- **`getPlayerCargo()` / `addToCargo()` / `deductCargo()`** — superseded by unified inventory (`getCargoState`/`addToInventory`/`removeFromInventory`); not called from any service code, only from test mocks

#### SectorRoom (`rooms/SectorRoom.ts`)
- **`getModuleInventory` message handler** — wired to legacy ShipService method
- **`emergencyWarp` message handler** — routes to NavigationService

#### ShipService (`rooms/services/ShipService.ts`)
- **`handleGetModuleInventory()`** — legacy method, now delegates to unified `getInventory()` but still wired through old message path

#### NavigationService (`rooms/services/NavigationService.ts`)
- **`handleEmergencyWarp()`** method — entire emergency warp feature

#### Client Package (`packages/client/src/`)
- **`NavControls.tsx`** — imports `EMERGENCY_WARP_FREE_RADIUS`, `EMERGENCY_WARP_CREDIT_PER_SECTOR`; renders emergency warp UI section with button
- **`network/client.ts`** — `sendEmergencyWarp()` method + `emergencyWarpResult` message handler
- **`ui-strings.ts`** — emergency warp string
- **`NavControls.test.tsx`** — mocks `sendEmergencyWarp`

### Database Migration 059

```sql
ALTER TABLE players DROP COLUMN IF EXISTS home_base;
ALTER TABLE players DROP COLUMN IF EXISTS module_inventory;
```

Note: `base_name` column stays — it is actively used by `renameBase()` / `getPlayerBaseName()` in ShipService.

### Tests

All tests referencing removed code must be updated or removed:
- `constants.test.ts` — SECTOR_WEIGHTS tests
- `fuelRework.test.ts` — EMERGENCY_WARP constant verification
- `moduleInventory.test.ts` — legacy module inventory function mocks
- `economyInventory.test.ts` — `getPlayerCargo`/`addToCargo`/`deductCargo` mocks
- `werkstatt.test.ts` — legacy query mocks
- `blueprintInventory.test.ts` — legacy query mocks
- `miningInventory.test.ts` — legacy cargo mocks
- `kontorEngine.test.ts` — legacy cargo mocks
- `kontorExtension.test.ts` — legacy cargo mocks
- `questInventory.test.ts` — legacy cargo mocks
- `scanInventory.test.ts` — legacy cargo mocks

## Deferred: `legacySectorType()` and SectorType Migration

The initial exploration proposed removing `legacySectorType()` and refactoring worldgen. After review, `SectorType` is **deeply embedded** across the entire stack:

- **shared**: `SectorData.type` field, `SECTOR_TYPES` array, `SECTOR_RESOURCE_YIELDS`, `SECTOR_COLORS`
- **server**: worldgen `generateResources()`, WorldService, ScanService, RepairService, SectorState, civShipService
- **client**: RadarRenderer (~10 refs), DetailPanel (~8 refs), LegendOverlay (iterates `SECTOR_TYPES`)

Removing `legacySectorType()` without migrating all consumers would break the build. This is a **separate, larger refactor** (migrate all code from `sector.type` to `sector.environment` + `sector.contents`) and should be its own issue, not part of this cleanup.

## Not In Scope

- **HullTypes / HULLS** — actively used, stays
- **`base_name` column + queries** — actively used by ShipService rename feature
- **Duplicate migration numbers** (044, 045, 051) — cosmetic, `IF NOT EXISTS` makes them safe
- **`artefact` in CargoState** — actively used
- **`SectorType` / `legacySectorType()` / worldgen refactor** — deferred to own issue (see above)
- **`SECTOR_TYPES`, `SECTOR_RESOURCE_YIELDS`, `SECTOR_COLORS`** — all depend on SectorType, stays until that refactor

## Approach

1. **Shared first** — remove constants, types, functions; rebuild shared (intermediate state will not compile until server+client are also cleaned)
2. **Server second** — remove dead queries, SectorRoom handlers, ShipService legacy method, NavigationService emergency warp
3. **Client third** — remove emergency warp UI, references to deleted shared exports
4. **Migration last** — drop DB columns
5. **Tests throughout** — fix/remove broken tests at each step

## Risks

- **Emergency warp is live** — despite `FEATURE_EMERGENCY_WARP = false`, the feature is fully functional (flag is never checked). Removing it is intentional but should be noted.
- **Legacy cargo queries in tests** — 9+ test files mock these functions. Each needs careful cleanup to ensure only the mock line is removed, not the test logic.
- **`module_inventory` column drop** — verify no external tools or admin scripts read this column before dropping.
