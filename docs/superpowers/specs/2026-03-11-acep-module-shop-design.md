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
- Progress bar height: 10px
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
| `[+5]` button | Active only when ≥5 XP remain in 100-point budget |

Below paths, two sections separated by horizontal lines:

**AKTIVE EFFEKTE**: lists all active bonuses derived from current path levels (e.g. `+2 Modul-Slots`, `+1 Scan-Radius`, `+20% Cargo`)

**TRAITS**: badge row of active traits, colored borders matching trait category

Budget display: total XP spent / 100 shown near top.

### Tab [MODULE] — Schiff-Hardware

Two sections:

**INSTALLIERT (N/M Slots)**:
- Occupied slot: `[TYP]` label + module name + HP bar (block chars) + `[×]` uninstall button
- Empty slot: `[TYP] — leer` dimmed, no button

**INVENTAR (N Module)**:
- Each module: name + short description + `[INST]` button
- `[INST]` disabled if matching slot is already occupied
- Hover triggers Detail Monitor module-effect panel

### Tab [SHOP] — Modul-Einkauf

**When at station or home base:**
- List of available modules: name + short effect + price (CR + resource) + `[KAUFEN]` button
- Hover triggers Detail Monitor showing ship-impact delta

**When not at station/base:**
- Tab remains visible and selectable
- Content replaced by info box: `"Modul-Shop nur an Station oder Home Base verfügbar"`

---

## Detail Monitor (Sec 3) Behavior

Contextual per active tab:

### ACEP tab (no hover needed)
- Lists active trait names with short explanations
- Fallback (no traits): brief ACEP summary (budget, path overview)

### MODULE tab (on hover)
- Module name + type badge
- Current module stats
- **Ship impact deltas**: e.g. `Bewegung: 100% → +25% = 125%`, `Scan-Radius: 3 → +1 = 4`
- HP bar with numeric value (`HP: 6/10`)
- Fallback (no hover): `"Modul hovern für Details"`

### SHOP tab (on hover)
- Module name + type badge + price
- **What would change**: same delta format as MODULE tab
- If same module type already installed: `"Ersetzt: drive_mk1"` note
- If slot is empty: `"Installiert in: [DRV]-Slot"` note
- Fallback (no hover): `"Modul hovern für Details"`

**Data source**: deltas computed client-side from `moduleEffects` definitions in shared. No additional server calls.

---

## Component Architecture

### Files removed / merged

| File | Action |
|---|---|
| `ModulePanel.tsx` | Merged into new `AcepProgram.tsx` (Shop tab) |
| `HangarPanel.tsx` | Boost buttons move to ACEP tab; file removed |

### New files

| File | Responsibility |
|---|---|
| `AcepProgram.tsx` | Root component, 3-tab shell, hover state, active tab state |
| `AcepTab.tsx` | XP paths, boost buttons, active effects, traits |
| `ModuleTab.tsx` | Installed module slots + inventory install actions |
| `ShopTab.tsx` | Module purchase list; disabled state when not at station |
| `AcepDetailPanel.tsx` | Detail Monitor panel, switches content by active tab + hover |

### Files unchanged

- Selector button registration (Sec 1) — no rename, no reorder
- Server handlers for module install / uninstall / buy
- `moduleEffects` definitions in shared
- `shipState.atStation` flag in Zustand store

### State management

- Hover target: local `useState` in `AcepProgram.tsx` (passed as prop)
- Active tab: local `useState` in `AcepProgram.tsx`
- Station availability: read from existing `shipState.atStation`
- No new global store additions needed
