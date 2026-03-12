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
- **`FEATURE_EMERGENCY_WARP`** (false)

#### Types (`types.ts`)
- **`legacySectorType()`** — converts Environment+Contents back to old SectorType; worldgen must be refactored to stop using it
- **`deriveEnvironment()`** — unused outside tests
- **`deriveContents()`** — unused outside tests
- **`isPlanetEnvironment()`** — unused outside tests
- Any associated type exports only used by removed functions (e.g. `ShipClass` type if it exists)

### Server Package (`packages/server/src/`)

#### DB Queries (`db/queries.ts`)
- **`getPlayerModuleInventory()`** — reads legacy `module_inventory` JSONB column
- **`addModuleToPlayerInventory()`** — writes legacy `module_inventory` JSONB column
- **`removeModuleFromPlayerInventory()`** — writes legacy `module_inventory` JSONB column
- **`setBaseName()`** — writes legacy `base_name` column
- **`getBaseName()`** — reads legacy `base_name` column
- **`getPlayerCargo()` / `addToCargo()` / `deductCargo()`** — check if these are legacy (replaced by unified inventory `getCargoState`/`addToInventory`/`removeFromInventory`); remove if unused by active code

#### NavigationService (`rooms/services/NavigationService.ts`)
- **`handleEmergencyWarp()`** method — entire emergency warp feature
- Message handler registration for `emergencyWarp` in SectorRoom
- Any client-side emergency warp UI/button

#### worldgen (`engine/worldgen.ts`)
- Remove usage of `legacySectorType()` — worldgen should store `environment` + `contents` directly without converting back to legacy `SectorType`
- Audit all callers of `sector.type` to determine if they need updating

#### Emergency Warp UI
- `client/ui-strings.ts` — emergency warp string

### Database Migration 059

```sql
ALTER TABLE players DROP COLUMN IF EXISTS home_base;
ALTER TABLE players DROP COLUMN IF EXISTS base_name;
ALTER TABLE players DROP COLUMN IF EXISTS module_inventory;
```

### Tests

All tests referencing removed code must be updated or removed:
- `constants.test.ts` — SECTOR_WEIGHTS tests
- `fuelRework.test.ts` — EMERGENCY_WARP constant verification
- `moduleInventory.test.ts` — legacy module inventory function mocks
- Any test mocking removed query functions
- worldgen tests using `legacySectorType`

## Not In Scope

- **HullTypes / HULLS** — actively used, stays
- **Duplicate migration numbers** (044, 045, 051) — cosmetic, `IF NOT EXISTS` makes them safe
- **`artefact` in CargoState** — actively used
- **`SectorType` type itself** — may still be used by active code; only remove if fully dead after worldgen refactor

## Approach

1. **Shared first** — remove constants, types, functions; rebuild shared
2. **Server second** — remove dead queries, NavigationService emergency warp, refactor worldgen
3. **Client third** — remove references to deleted shared exports
4. **Migration last** — drop DB columns
5. **Tests throughout** — fix/remove broken tests at each step

## Risks

- **worldgen refactor** is the most complex part — `legacySectorType()` may be called from more places than initially found; careful audit needed
- **Legacy cargo queries** (`getPlayerCargo` etc.) need verification — they may still be called by active code paths despite the unified inventory migration
