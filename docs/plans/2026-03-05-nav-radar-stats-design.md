# Nav/Radar Overhaul + Logbuch-Stats Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Improve the navigation UI layout, radar rendering of players and labels, and add persistent player statistics.

**Issues:** #128 (Nav UI), #129 (Player proximity), #130 (Resource bars), #131 (Label overlap), #132 (Log stats)

**Architecture:** All changes are client-side only. RadarRenderer canvas drawing, NavControls layout, gameSlice state additions, EventLog stats display.

---

## 1. D-Pad & Scan Layout (#128)

**Current:** 3x3 CSS grid D-Pad centered, scan buttons in a flex row below.

**New layout:**
```
         [ up ]
  [left] [down] [right]     [LOCAL SCAN]
                             [AREA SCAN ]
```

- D-Pad: `up` centered above, `left`/`down`/`right` in a row below
- Scan buttons: stacked vertically, positioned to the right of the D-Pad
- Outer container: `display: flex`, D-Pad on left, Scans on right
- Hyperdrive info, mining-lock warning, and emergency warp remain below

**File:** `packages/client/src/components/NavControls.tsx`

## 2. Player Icons on Radar (#129)

**Rendering (zoom >= 2):**
- One player icon per sector where other players exist (even if multiple players, only 1 icon)
- Icon: `scout` hull pattern, offset right-bottom from cell center
- Color: `#FFDD22` (yellow, distinct from own ship in themeColor)
- At zoom >= 3: username text shown (existing behavior, retained)

**Sector entry alert:**
- In `client.ts`, when `setPlayer()` is called with coordinates matching own position, trigger:
  - Log entry: `"KONTAKT: {username} betritt Sektor"`
  - Alert on NAV-COM LED: `store.setAlert('NAV-COM', true)`
- DetailPanel already auto-updates from `players` state (no change needed)

**Files:** `packages/client/src/canvas/RadarRenderer.ts`, `packages/client/src/network/client.ts`

## 3. Resource Bars to Left Edge (#130)

**Current:** Resource dots (3-dot indicators) at bottom of cell, left (ore/gas) and right (crystal).

**New:** Resource indicators move to **left edge** of cell, vertically stacked:
- Ore: top row (3 dots horizontal)
- Gas: middle row
- Crystal: bottom row
- Position: left edge of cell, vertically centered
- Avoids overlap with bottom label and center symbol

**File:** `packages/client/src/canvas/RadarRenderer.ts`

## 4. Label Layout at High Zoom (#131)

**Current:** Coordinates top-center, type label bottom-center, symbol center. At zoom 3-4, labels can collide.

**New layout per zoom level:**

| Element | Zoom 0 | Zoom 1 | Zoom 2 | Zoom 3 | Zoom 4 (Detail) |
|---------|--------|--------|--------|--------|------------------|
| Coords | hidden | top-center | top-left (small) | top-left (small) | top-center |
| Symbol | center | center | center | center | center-left |
| Type label | hidden | bottom-center | bottom-left | bottom-left | below symbol |
| Player icon | hidden | hidden | right-center | right-center + name | right side + name list |
| Resource dots | hidden | left-edge | left-edge | left-edge | text values below symbol |
| Base/structure | hidden | hidden | top-left diamond | top-left diamond | top-left diamond |

**Key principle:** Labels and icons occupy distinct zones within the cell to avoid collision.

**File:** `packages/client/src/canvas/RadarRenderer.ts`

## 5. Logbuch-Stats (#132)

**New state** in `gameSlice.ts`:
```typescript
interface PlayerStats {
  sectorsScanned: number;
  quadrantsVisited: Set<string>;   // stored as array in localStorage
  quadrantsFirstDiscovered: number;
  stationsVisited: Set<string>;    // "x:y" keys, stored as array
  playersEncountered: number;
}
```

**Tracking triggers:**
- `sectorsScanned`: increment on `localScanResult` and `areaScanResult`
- `quadrantsVisited`: add `"qx:qy"` key on `quadrantInfo` message
- `quadrantsFirstDiscovered`: increment on `firstContactEvent`
- `stationsVisited`: add `"x:y"` key when player enters a station sector
- `playersEncountered`: increment on `localScanResult` when other players are in the same sector

**Display:** Stats block at the top of EventLog component:
```
SCANS: 42 | QUADRANTEN: 3 | ENTDECKER: 1 | STATIONEN: 7 | PILOTEN: 2
```

**Persistence:** Stats saved to `localStorage` under key `vs-player-stats`, loaded on init.

**Files:** `packages/client/src/state/gameSlice.ts`, `packages/client/src/components/EventLog.tsx`, `packages/client/src/network/client.ts`
