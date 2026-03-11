# Data-Slates Redesign (#276)

## Summary

Data Slates get their own tab in CargoScreen, their own storage budget (Memory) determined by scanner modules, and a detail view in Sec 3. Slates no longer consume normal cargo space.

## Changes

### 1. Shared: `memory` Stat

**New constant:** `BASE_SCANNER_MEMORY = 2`

**New field in `ShipStats`:** `memory: number`

**Scanner module memory values — add `memory` to each scanner module's `effects` object in `MODULES` constant:**

| Module | memory |
|--------|--------|
| Base (no scanner module) | 2 |
| SCANNER MK.I | +4 |
| SCANNER MK.II | +6 |
| SCANNER MK.III | +10 |
| SCANNER MK.IV | +14 |
| SCANNER MK.V | +20 |
| QUANTUM-SCANNER | +10 |
| WAR SCANNER | +0 |

**`calculateShipStats`:** Initialize `stats.memory = BASE_SCANNER_MEMORY`. The existing effects loop will accumulate `memory` from modules automatically. Clamp `memory >= 0` at the end (safety for future negative-memory modules).

**Cargo total: introduce `getPhysicalCargoTotal(cargo)` utility** in `packages/shared/src/constants.ts`:
```typescript
export function getPhysicalCargoTotal(cargo: CargoState): number {
  return cargo.ore + cargo.gas + cargo.crystal + cargo.artefact;
}
```
All inline `cargoTotal` calculations must use this function instead of computing manually. This prevents drift.

### 2. Server: Validation Changes

**Slate creation validation (`validateCreateSlate`, `handleCreateSlateFromScan`):**
- Old check: `cargoTotal + 1 > cargoCap` (where cargoTotal includes slates)
- New check: `cargo.slates >= ship.stats.memory`

**`acceptSlateOrder` in WorldService:** Change buyer capacity check from cargo-based to memory-based (`cargo.slates >= memory`).

**Cargo-full checks (mining stop, other capacity checks):**
- Use `getPhysicalCargoTotal(cargo)` — excludes slates.

**No DB migration needed.** `cargo.slates` field stays in the `cargo` table, just no longer counted toward cargo capacity.

**`addSlateToCargo` / `removeSlateFromCargo`:** Unchanged — they increment/decrement the `slates` counter.

**`getCargoState`:** Unchanged — still returns `slates` field.

### 3. Client: CargoScreen

**New 4th tab: "SLATES"** — add `'slates'` to tab type union (`'resource' | 'module' | 'blueprint' | 'slates'`).
- Memory bar: `MEMORY: {cargo.slates}/{memory}` (similar to CargoBar style)
- Slate list with type indicators: [S] sector, [A] area, [SC] scan, [C] custom, [JG] jumpgate
- Per-slate buttons: [ACTIVATE], [NPC SELL]
- Clicking a slate sets `selectedSlateId` in store → triggers Sec 3 detail view

**RESOURCES tab changes:**
- Remove `slates` from CargoBar list
- Use `getPhysicalCargoTotal(cargo)` for total capacity calculation
- Total bar shows: `ore + gas + crystal + artefact` vs `cargoCap`

**Remove "VESSEL:" label** — legacy, no more vessels.

### 4. Client: Sec 3 Detail View

**DetailPanel** currently does not branch on `activeProgram`. Add a conditional at the top of the render: when `activeProgram === 'CARGO'` and `selectedSlateId` is set, render the slate detail view instead of the default sector view.

Slate detail content by type:
- **Header:** Slate type indicator + creation date
- **Sector/Area/Scan slates:** Coordinates, sector type, resources (ore/gas/crystal), structures, wrecks, scan tick
- **Area slates:** Scrollable list of all contained sectors
- **Custom slates:** Label, notes, coordinates, codes
- **Jumpgate slates:** Gate ID, sector coordinates, owner name

**New store field:** `selectedSlateId: string | null` in `uiSlice.ts`. Set by CargoScreen SLATES tab, cleared when switching tabs/programs.

### 5. SlateControls (Sec 5)

- Check memory budget instead of cargo cap: `disabled={cargo.slates >= memory}`
- Display: `MEMORY: {cargo.slates}/{memory}` header
- Update type indicators to include [SC] and [JG]

### 6. Overcapacity Rule

Players who already have more slates than their new memory budget allows:
- **Keep existing slates** — no auto-jettison
- **Cannot create or acquire new slates** until under capacity
- **UI:** Memory bar shows in warning/red state when `cargo.slates > memory`

## All `cargoTotal` Sites (must use `getPhysicalCargoTotal`)

| File | Location |
|------|----------|
| `packages/client/src/components/CargoScreen.tsx` | total calculation |
| `packages/client/src/components/SlateControls.tsx` | total for cargo-full check |
| `packages/client/src/components/CockpitLayout.tsx` | cargo-full indicator |
| `packages/client/src/components/TradeScreen.tsx` | cargo capacity check |
| `packages/client/src/components/MiningScreen.tsx` | mining cargo check |
| `packages/client/src/components/ProgramSelector.tsx` | cargo indicator |
| `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` | SAVE TO SLATE button |
| `packages/client/src/network/client.ts` | auto-stop mining |
| `packages/server/src/engine/commands.ts` | validateCreateSlate |
| `packages/server/src/rooms/services/WorldService.ts` | handleCreateSlate, handleCreateSlateFromScan, acceptSlateOrder |
| `packages/server/src/engine/inventoryService.ts` | getResourceTotal |

## Files to Change

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `memory` to `ShipStats` |
| `packages/shared/src/constants.ts` | Add `BASE_SCANNER_MEMORY`, `getPhysicalCargoTotal()`, scanner module `memory` effects |
| `packages/shared/src/shipCalculator.ts` | Init `memory = BASE_SCANNER_MEMORY`, clamp `>= 0` |
| `packages/server/src/engine/commands.ts` | `validateCreateSlate`: check memory; use `getPhysicalCargoTotal` |
| `packages/server/src/rooms/services/WorldService.ts` | `handleCreateSlateFromScan`, `acceptSlateOrder`: check memory; use `getPhysicalCargoTotal` |
| `packages/server/src/engine/inventoryService.ts` | `getResourceTotal`: exclude slates |
| `packages/client/src/components/CargoScreen.tsx` | 4th SLATES tab, remove slates from RESOURCES, remove VESSEL, use `getPhysicalCargoTotal` |
| `packages/client/src/components/DetailPanel.tsx` | Slate detail view when CARGO program + slate selected |
| `packages/client/src/components/SlateControls.tsx` | Memory budget, type indicators, use `getPhysicalCargoTotal` |
| `packages/client/src/components/CockpitLayout.tsx` | Use `getPhysicalCargoTotal` |
| `packages/client/src/components/TradeScreen.tsx` | Use `getPhysicalCargoTotal` |
| `packages/client/src/components/MiningScreen.tsx` | Use `getPhysicalCargoTotal` |
| `packages/client/src/components/ProgramSelector.tsx` | Use `getPhysicalCargoTotal` |
| `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` | Use `getPhysicalCargoTotal` |
| `packages/client/src/network/client.ts` | Auto-stop mining: use `getPhysicalCargoTotal` |
| `packages/client/src/state/uiSlice.ts` | Add `selectedSlateId` |

## Tests to Update

| File | Changes |
|------|---------|
| `packages/server/src/__tests__/scanToSlate.test.ts` | Cargo-full check → memory check |
| `packages/server/src/engine/__tests__/commands-slates.test.ts` | `validateCreateSlate` interface: add memory, use `getPhysicalCargoTotal` |
| `packages/client/src/__tests__/MiningAutoStop.test.ts` | cargoTotal formula excludes slates |
| `packages/shared/src/__tests__/shipCalculator.test.ts` | New tests: memory stat calculation |

## Out of Scope

- Slate trading on market (existing, unchanged)
- New slate types
- Scanner module rebalancing beyond memory values
- Mini-map visualization of slate contents
