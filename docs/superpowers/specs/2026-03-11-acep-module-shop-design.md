# ACEP Module Shop Redesign — Design Spec

**Issue:** #265
**Date:** 2026-03-11

---

## Goal

Reorganize the ACEP program into a clear 3-tab structure (ACEP · MODULE · SHOP), removing the hidden MODULES route and consolidating all ship-related UI into one coherent program with contextual detail monitor support.

---

## Background / Problem

Currently the ACEP program shows both XP paths and module slots on one screen. A separate hidden `MODULES` program handles shop/install actions but has no selector button — users can't find it. Boost buttons are buried in the Detail Monitor (HangarPanel). The result: unclear identity, poor discoverability.

---

## Design Decisions

### Program Structure

- **Button**: `ACEP` stays as the 12th program in the selector (no rename)
- **3 Tabs**: `[ACEP]` · `[MODULE]` · `[SHOP]`
- **Default tab**: `[ACEP]`

### Tab Sizing / Visual Style

- Font size: ~1rem (monospace)
- Padding: 7–14px per section
- ACEP progress bar height: 10px; HP bars in module rows: block-char style (`██░░`)
- Matches v3 mockup approved during brainstorming

---

## Tab Content

### Tab [ACEP] — Charakterentwicklung

4 XP paths displayed as rows:

| Element | Detail |
|---|---|
| Label | Colored by path: AUSBAU (#FFB000) · INTEL (#4af) · KAMPF (#f44) · EXPLR (#4fa) |
| Counter | `current/max · LvN` right-aligned |
| Progress bar | 10px height, filled to current/max ratio |
| `[+5]` button | Active only when: `xp.total < 100 && credits >= cost.credits && wissen >= cost.wissen` |

The total XP budget is 100 across all 4 paths (max 50 per individual path via `ACEP_PATH_CAP_SHARED`). Boost cost is in both credits and Wissen — mirror the existing `HangarPanel.tsx` disable logic exactly.

Below paths, two sections separated by horizontal lines:

**AKTIVE EFFEKTE**: lists all active bonuses derived from current path levels (e.g. `+2 Modul-Slots`, `+1 Scan-Radius`, `+20% Cargo`)

**TRAITS**: badge row of active traits. Use same border color as current `AcepPanel.tsx` (`#4a9` for all traits).

Budget display: total XP spent / 100 shown near top.

**Ship rename input**: moved from `HangarPanel.tsx` into the `AcepTab.tsx` header area (above the XP paths). Same `sendRenameShip` network call. Drop the `sendGetShips()` useEffect from `HangarPanel` — ships are already loaded via the main room join flow.

### Tab [MODULE] — Schiff-Hardware

Two sections:

**INSTALLIERT (N/M Slots)**:
- Occupied slot: `[TYP]` label + module name + block-char HP bar (in the list row) + `[×]` uninstall button
- Empty slot: `[TYP] — leer` dimmed, no button
- Uninstall: call `network.sendRemoveModule(ship.id, slotIndex)` (defined in `client.ts:2262`). Note: existing `AcepProgram.tsx:140` calls a non-existent `sendUninstallModule` — this refactor should fix it to use `sendRemoveModule`.

**INVENTAR (N Module)**:
- On mount: fire `network.sendGetModuleInventory()` in `useEffect` (owned by `ModuleTab.tsx`)
- `moduleInventory` in store is `string[]` (module ID strings). Look up each via `MODULES[moduleId]` from shared constants to get `ModuleDefinition` for display
- Each item shows: module name + short description from `ModuleDefinition` + `[INST]` button
- Module name color: `#FFB000` (inventory items are bare IDs — no source field available)
- `[INST]` disabled condition: no compatible empty slot exists. Compatible means: module's category matches slot's `SPECIALIZED_SLOT_CATEGORIES[slotIndex]` entry, OR slot index ≥ 8 (extra/flexible slots accept any module). Target is first matching empty slot.
- Empty inventory: render `"LEER"` with reduced opacity (same as existing `ModulePanel.tsx` pattern)
- Hover on any module (occupied or inventory) → sets `acepHoveredModuleId` in Zustand store

### Tab [SHOP] — Modul-Einkauf

**Station/base availability check**:
```ts
const atStation = currentSector?.type === 'station' || baseStructures.some(s => s.type === 'base');
```
Data sources: `currentSector` and `baseStructures` from Zustand store (same as current `ModulePanel.tsx` lines 74–76).

**When `atStation` is true:**
- Show only modules where `isModuleUnlocked(m.id, research)` returns true (same filter as current `ModulePanel.tsx:164`). `research` comes from the Zustand store.
- List of available modules: name + short effect + price (CR + resource) + `[KAUFEN]` button
- Module name color via `getModuleSourceColor()` from `moduleUtils.ts`
- `[KAUFEN]` affordability check: button disabled when any of the following fails:
  - `credits >= def.cost.credits` (store field: `credits`)
  - `def.cost.ore === undefined || cargo.ore >= def.cost.ore` (store field: `cargo.ore`)
  - `def.cost.gas === undefined || cargo.gas >= def.cost.gas` (store field: `cargo.gas`)
  - `def.cost.crystal === undefined || cargo.crystal >= def.cost.crystal` (store field: `cargo.crystal`)
  - `def.cost.artefact === undefined || cargo.artefact >= def.cost.artefact` (store field: `cargo.artefact`)
- Hover → sets `acepHoveredModuleId` in Zustand store

**When `atStation` is false:**
- Tab remains visible and selectable
- Content replaced by info box: `"Modul-Shop nur an Station oder Home Base verfügbar"`

---

## Detail Monitor (Sec 3) Behavior

### State routing across Sec 2 / Sec 3 boundary

`CockpitLayout.tsx` renders Sec 3 content via `getDetailForProgram(activeProgram)` — a pure switch with no access to Sec 2 component state. To pass hover and tab state to `AcepDetailPanel`, add two fields to `uiSlice` in Zustand:

```ts
acepActiveTab: 'acep' | 'module' | 'shop';   // default: 'acep'
acepHoveredModuleId: string | null;            // default: null
```

- `AcepProgram.tsx` sets `acepActiveTab` on tab change
- `ModuleTab.tsx` and `ShopTab.tsx` set `acepHoveredModuleId` on mouse enter/leave
- `AcepDetailPanel.tsx` reads both from store — no props needed
- Add `case 'ACEP': return <AcepDetailPanel />;` in `getDetailForProgram`

### ACEP tab (no hover needed)
- Lists active trait names with short explanations
- Fallback (no traits): brief ACEP summary (budget, path overview)

### MODULE tab (on hover)
- Module name + type badge
- **Ship impact deltas**: call `calculateShipStats(ship.hullType, installedModules, acepXp)` with and without the hovered module in the module list, then diff the resulting `ShipStats` objects. Display non-zero deltas as: `Bewegung: 100% → +25% = 125%`
- HP bar with numeric value (`HP: 6/10`) — numeric display is Detail Monitor only; list row shows block-char bar
- Fallback (no hover): `"Modul hovern für Details"`

### SHOP tab (on hover)
- Module name + type badge + price
- **What would change**: same `calculateShipStats` diff approach as MODULE tab — add candidate module to current installed list, diff stats
- If same module category slot already occupied: `"Ersetzt: <currentModuleName>"` note
- If slot empty: `"Installiert in: [TYP]-Slot"` note
- Fallback (no hover): `"Modul hovern für Details"`

**`calculateShipStats` signature**: `calculateShipStats(hullType: HullType, modules: ShipModule[], acepXp?: AcepXpSnapshot)`. Get `hullType` from `ship.hullType`, `modules` from `ship.modules`, `acepXp` from `ship.acepXp`.

---

## Component Architecture

### Files removed

| File | Reason |
|---|---|
| `AcepPanel.tsx` | Replaced by `AcepTab.tsx` |
| `ModulePanel.tsx` | Split into `ModuleTab.tsx` + `ShopTab.tsx` |
| `HangarPanel.tsx` | Boost buttons + ship rename move to `AcepTab.tsx`; file removed |

### New files

| File | Responsibility |
|---|---|
| `AcepProgram.tsx` | Root: 3-tab shell, sets `acepActiveTab` in store on tab change |
| `AcepTab.tsx` | XP paths, `[+5]` boost buttons, active effects, traits, ship rename input |
| `ModuleTab.tsx` | Installed slots + inventory; fires `sendGetModuleInventory()` on mount |
| `ShopTab.tsx` | Module purchase list with station-availability gate |
| `AcepDetailPanel.tsx` | Sec 3 panel: reads `acepActiveTab` + `acepHoveredModuleId` from store |

### Files modified

| File | Change |
|---|---|
| `CockpitLayout.tsx` | Add `case 'ACEP': return <AcepDetailPanel />;` to `getDetailForProgram` |
| `gameSlice.ts` / `uiSlice.ts` | Add `acepActiveTab` and `acepHoveredModuleId` fields + setters |

### Files unchanged

- Selector button registration (Sec 1) — no rename, no reorder
- Server handlers for module install / uninstall / buy
- `MODULES` constants and `ModuleDefinition` types in shared
- `calculateShipStats()` in shared
- `getModuleSourceColor()` in `moduleUtils.ts`
- `SPECIALIZED_SLOT_CATEGORIES` in shared
- `sendRemoveModule(shipId, slotIndex)`, `sendGetModuleInventory()` on network client
