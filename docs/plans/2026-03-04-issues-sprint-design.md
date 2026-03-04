# Issues Sprint Design (#108, #110, #111, #112, #113, #114, #115)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Address 7 open issues in one sprint — layout fixes, distress frequency, radar trail, worldgen reseed, artwork display, and comm redesign.

**Architecture:** Additive changes. No breaking schema changes. Next migration: 028.

---

## Block 1: Quick-Fixes (Layout + Notrufe)

### #110 Linke Seite zu schmal
**File:** `packages/client/src/styles/crt.css:1349`
- Change `grid-template-columns: 120px 1fr 1fr` → `160px 1fr 1fr`

### #111 Oberer Bereich 60:40
**File:** `packages/client/src/styles/crt.css:1350`
- Change `grid-template-rows: 1fr 1fr` → `3fr 2fr`

### #108 Zu viele Notrufe
**File:** `packages/shared/src/constants.ts`
- `DISTRESS_CALL_CHANCE`: 0.08 → 0.005
- `distress_signal` weight in scanEvents.ts: 0.30 → 0.05
- Reduces effective distress frequency to ~1 per 30+ minutes of active play

---

## Block 2: Radar Trail (#112)

### Trail State
**File:** `packages/client/src/state/gameSlice.ts`
- Add `visitedTrail: Coords[]` (max 9 entries, FIFO)
- On every sector change (`setPosition`): prepend current position, pop if >9

### Trail Rendering
**File:** `packages/client/src/canvas/RadarRenderer.ts`
- After drawing sector cells, draw trail: line segments connecting trail positions
- Opacity fades: newest = 0.8, oldest = 0.1 (linear interpolation)
- Line style: 1px, same color as player indicator

### Empty Sector Simplification
- Empty discovered sectors: only central dot `.`, no "EMPTY" label, no coordinate text
- Undiscovered sectors: keep "UNEXPLORED" at zoom >= 1

---

## Block 3: Worldgen + Reseed (#113)

### Worldgen Changes (permanent)
**File:** `packages/shared/src/constants.ts`
- `SECTOR_RESOURCE_YIELDS.asteroid_field`: `{ ore: 50, gas: 0, crystal: 8 }` (was ore:20, gas:2, crystal:3)
- `SECTOR_RESOURCE_YIELDS.nebula`: `{ ore: 0, gas: 30, crystal: 5 }` (was ore:2, gas:20, crystal:3)
- `SECTOR_RESOURCE_YIELDS.empty`: stays `{ ore: 0, gas: 0, crystal: 0 }`
- `ENVIRONMENT_WEIGHTS.empty`: 0.55 → 0.70 (more empty fields)
- `CONTENT_WEIGHTS.none`: 0.57 → 0.45 (rebalance since env already more empty)

### Resource Regeneration
**File:** `packages/server/src/db/migrations/028_resource_regen.sql`
```sql
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS last_mined BIGINT DEFAULT NULL;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_ore INTEGER DEFAULT 0;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_gas INTEGER DEFAULT 0;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_crystal INTEGER DEFAULT 0;
```

**Logic (in worldgen.ts or new resourceRegen.ts):**
- On sector load: if `last_mined` is set, calculate elapsed minutes
- Regen: ore += elapsed × 1, gas += elapsed × 1, crystal += elapsed / 3
- Capped at max values (stored when sector first generated)
- On mine complete: set `last_mined = Date.now()`, update resource amounts

### Resource Dots on Radar Grid
**File:** `packages/client/src/canvas/RadarRenderer.ts`
- Per sector cell with resources: 2×3 dot matrix at bottom edge
- Left 3 dots: ore/gas fill (0%=none, 25%=1dot, 50%=2dots, 75%=3dots, 100%=bar)
- Right 3 dots: crystal fill (same scale)
- Dot color: amber (ore/gas) / cyan (crystal)
- Requires sector resource data in discoveries (already available via SectorData.resources)

### Reseed Script (one-time)
**File:** `packages/server/src/scripts/reseed.ts`
- Delete all sectors in quadrant (0,0) from DB
- Create 3 accounts: Phash, Smasher, Fede (password: test1234)
- Spawn positions: (20,20), (40,20), (20,40) — 20 apart, 20 from edge
- Run via `npx tsx packages/server/src/scripts/reseed.ts`

---

## Block 4: Artwork Display (#115)

### Detail Panel Artwork
**Files:** All detail panels in `packages/client/src/components/`
- When sector type is station/anomaly/pirate/nebula/asteroid: show SVG artwork in upper half of detail panel
- Use `getStationArtwork()` for stations, `getAlienArtwork()` for alien encounters
- Fallback to ASCII art from `DetailViewOverlay.tsx` SECTOR_ART
- Apply CRT styling: scanline overlay on artwork, amber/green tint via CSS filter

### Integration Points
- `MiningDetailPanel` — show asteroid/nebula artwork
- `TradeDetailPanel` — show station artwork
- `ScanDetailPanel` (if exists) — show anomaly/pirate artwork
- New `SectorArtwork` shared component that resolves type → SVG/ASCII

---

## Block 5: Comm Redesign (#114)

### Channel Renaming
**Files:** `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`
- Remove `local` channel
- Channels: `quadrant` (default, was local), `sector`, `faction`, `direct`
- Server routing: `sector` = same sector coords, `quadrant` = same quadrant room

### Wider Buttons
**File:** `packages/client/src/components/CommsScreen.tsx`, `crt.css`
- Channel buttons full width, show full text: "QUADRANT", "SEKTOR", "FRAKTION", "DIREKT"

### Player Context Menu (global)
**Files:**
- Create: `packages/client/src/components/PlayerContextMenu.tsx`
- Modify: `packages/client/src/state/uiSlice.ts` — add `contextMenu: { playerId, playerName, x, y } | null`
- Trigger from: Chat player names, Radar ship clicks, Detail panel owner info
- Menu items: "NACHRICHT SENDEN" (opens direct chat), "VISITENKARTE" (greyed out)

### Direct Chat Tabs
**File:** `packages/client/src/components/CommsScreen.tsx`
- Tab bar above chat input when channel = 'direct'
- Multiple simultaneous conversations: `directChats: Map<playerId, { name, messages }>`
- Each tab shows player name + X close button
- Clicking "NACHRICHT SENDEN" in context menu opens/focuses direct tab

### Server Routing Updates
**File:** `packages/server/src/rooms/SectorRoom.ts`
- `sector` channel: broadcast to all players with same x,y in playerSectorData
- `quadrant` channel: broadcast to all in room (= all in quadrant)
- `direct` channel: route via existing direct message system
- `faction` channel: unchanged

---

## Implementation Order

```
Block 1 (Quick-Fixes)     — independent, no dependencies
Block 2 (Radar Trail)     — independent
Block 3 (Worldgen/Reseed) — independent
Block 4 (Artwork)         — independent
Block 5 (Comm)            — independent (but largest)
```

All blocks are independent — can be done in any order. Recommended: 1 → 2 → 3 → 4 → 5 (smallest first).

---

## Verification

After each block:
1. `cd packages/shared && npx vitest run`
2. `cd packages/server && npx vitest run`
3. `cd packages/client && npx vitest run`
