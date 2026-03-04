# Navigation & Grid Overhaul — Design

**Issues:** #21, #22, #23, #24, #25

**Goal:** Fix the layout overflow bug, make the radar grid fill available space dynamically, add bookmarks, implement far-navigation with autopilot, and add consistent bezel buttons with context-aware status LEDs.

**Architecture:** Four interconnected changes to the nav/grid system: (1) CSS fix + dynamic grid sizing in RadarRenderer, (2) bookmark system with server persistence, (3) far-navigation autopilot with reduced costs for known routes, (4) bezel UI overhaul with per-monitor status LEDs.

---

## 1. Grid Sizing & Overflow Fix (#21, #22)

### Overflow Bug (#22)

The `main-lower` section (controls + build buttons) has no max-height constraint and pushes the layout beyond 100vh, causing the page to scroll. The fix:
- Add `min-height: 0` to all flex children in the layout chain
- Add `overflow: hidden` or `overflow: auto` to `main-lower`
- Ensure the build buttons wrap or scroll within their container

### Dynamic Grid (#21)

Replace the fixed `RADAR_RADIUS = 3` (7x7 grid) with dynamic cell count:

- **Zoom level controls cell size** (keep existing `CELL_SIZES` array)
- **Visible cell count is derived per frame**: `colsVisible = Math.floor(canvasWidth / cellW)`, `rowsVisible = Math.floor(canvasHeight / cellH)`
- RADAR_RADIUS is no longer used for rendering — replaced by `radiusX = Math.floor(colsVisible / 2)` and `radiusY = Math.floor(rowsVisible / 2)`
- Pan limits become dynamic: `±radiusX` and `±radiusY`
- The grid always fills the full canvas, centered on `position + panOffset`

### Cell Content by Zoom Level

| Zoom | Cell Size | Content |
|------|-----------|---------|
| 0 | 48x38 | Symbol + coordinates only |
| 1 | 64x50 | + sector type label |
| 2 | 80x64 | + sector type + feature dots |
| 3 | 96x76 | + resource counts, player names, feature icons |

### Files Changed

- `packages/client/src/canvas/RadarRenderer.ts` — dynamic radius calculation, per-zoom content
- `packages/client/src/styles/crt.css` — overflow fix on `.main-lower`, `min-height: 0` on flex children
- `packages/client/src/state/uiSlice.ts` — remove fixed pan limits, make dynamic
- `packages/shared/src/constants.ts` — `RADAR_RADIUS` stays for server scan radius, no longer used for client grid

---

## 2. Bookmarks & Relog Fix (#23)

### Relog Position Fix

The `joinResult` message already sends the player position from DB. Ensure the client sets `position` from server data on join, not defaulting to `{0, 0}`. The view should center on the player's actual position.

### Bookmark System

**7 slots:** HomeBase (fixed at 0,0), Ship (always current position), 5 custom

**Server persistence:** New DB table:
```sql
CREATE TABLE IF NOT EXISTS player_bookmarks (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, slot)
);
```

**UI:** Vertical bookmark bar inside the NAV-COM bezel, left side:
```
┌─ NAV-COM ──────────────────────┐
│┌──────┐                         │
││ ⌂ HOME│  ┌──────────────────┐  │
││ ◆ SHIP│  │                  │  │
││ 1: ... │  │   Radar Grid     │  │
││ 2: ... │  │                  │  │
││ 3: ... │  └──────────────────┘  │
││ 4: --- │                         │
││ 5: --- │                         │
│└──────┘                         │
└─────────────────────────────────┘
```

- Click bookmark → sets `panOffset` to center view on that sector (camera move, NOT ship move)
- In DetailPanel: `[BOOKMARK]` button to save selected sector to next free slot
- Right-click or long-press on custom bookmark → clear/rename

**Messages:**
- `getBookmarks` → `bookmarksUpdate` (on join)
- `setBookmark { slot, sectorX, sectorY, label }` → `bookmarkSet`
- `clearBookmark { slot }` → `bookmarkCleared`

### Files Changed

- `packages/server/src/db/migrations/010_bookmarks_autopilot.sql`
- `packages/server/src/db/queries.ts` — getBookmarks, setBookmark, clearBookmark
- `packages/server/src/rooms/SectorRoom.ts` — message handlers
- `packages/client/src/state/gameSlice.ts` — bookmarks state
- `packages/client/src/network/client.ts` — bookmark message handlers
- `packages/client/src/components/BookmarkBar.tsx` — NEW: bookmark bar component
- `packages/client/src/components/MonitorBezel.tsx` — integrate BookmarkBar on left side
- `packages/client/src/components/DetailPanel.tsx` — add BOOKMARK button

---

## 3. Far-Navigation (#24)

### Concept

Players can jump to any **discovered** sector, not just adjacent ones. The ship travels automatically at regular speed.

### Cost Model

- Each sector on the route costs **50% normal AP** + **100% normal fuel**
- For `aegis_scout_mk1` (apCostJump=1, fuelPerJump=5): 100 sectors = 50 AP + 500 fuel
- Server validates before departure: enough AP + fuel for full route required
- Pirate sectors on the route are bypassed (ship avoids them) at +50% fuel cost per bypassed sector

### Autopilot Flow

1. Client sends `farJump { targetX, targetY }`
2. Server validates: target discovered, enough AP + fuel, calculates route
3. Server deducts full AP + fuel upfront
4. Server sets player state to `autopilot: true` with route data
5. Server runs a `setInterval(100ms)` loop moving the player sector by sector
6. Each step: sends `autopilotUpdate { x, y, remaining }` to client
7. On arrival: sends `autopilotComplete { x, y }`, joins player to target sector room
8. Client can send `cancelAutopilot` to stop mid-route (remaining AP/fuel NOT refunded — you've already traveled)

### Client UI

- DetailPanel: `[FAR JUMP → (x,y)]` button when selected sector is discovered & not adjacent
- Cost preview: `45 AP / 200 FUEL / ~12s`
- During autopilot: NavControls replaced with `AUTOPILOT AKTIV → (x,y) [ABBRECHEN]`
- Camera auto-follows ship during autopilot
- Navigation buttons disabled during autopilot

### Discovery Persistence

The `discoveries` table already exists with `discovered_at` timestamp. Changes:
- On room join: server sends all player discoveries (paginated if > 1000)
- Client populates `discoveries` map from server data
- Staleness visual: `> 24h` since scan → dimmed colors, `> 7d` → coordinates only (no symbol/type)

### State

```ts
// gameSlice
autopilot: {
  targetX: number;
  targetY: number;
  remaining: number;
  active: boolean;
} | null;
```

### Files Changed

- `packages/server/src/db/migrations/010_bookmarks_autopilot.sql` — (shared migration)
- `packages/server/src/rooms/SectorRoom.ts` — farJump, cancelAutopilot handlers, autopilot loop
- `packages/server/src/db/queries.ts` — getPlayerDiscoveries (bulk), route validation
- `packages/shared/src/constants.ts` — FAR_JUMP_AP_DISCOUNT, AUTOPILOT_STEP_MS, STALENESS thresholds
- `packages/shared/src/types.ts` — AutopilotState, FarJumpMessage
- `packages/client/src/state/gameSlice.ts` — autopilot state
- `packages/client/src/network/client.ts` — farJump, autopilot handlers
- `packages/client/src/components/NavControls.tsx` — autopilot UI
- `packages/client/src/components/DetailPanel.tsx` — far jump button
- `packages/client/src/canvas/RadarRenderer.ts` — staleness rendering

---

## 4. Bezel Buttons & Status LEDs (#25)

### Consistent Bezel Buttons

All monitor bezels (sidebar + main) get uniform button placement:
- **Top-right corner** of each bezel frame: functional buttons
- Auto-Follow toggle moves from DetailPanel content into the Detail monitor's bezel frame
- Buttons can contain a status LED dot to indicate active state

### Per-Monitor Status LEDs

Each monitor gets 1-3 context-aware LEDs. Colors: green (OK), yellow/blink (attention), red (warning), gray (inactive).

| Monitor | LED 1 | LED 2 | LED 3 |
|---------|-------|-------|-------|
| NAV-COM | SYS (online) | NAV (autopilot?) | SCAN (staleness) |
| SHIP-SYS | PWR (online) | FUEL (low=red) | — |
| MINING | RIG (active?) | CAP (full=red) | — |
| CARGO | CAP (level) | SLT (slates) | — |
| COMMS | SIG (signal) | MSG (new=blink) | — |
| BASE-LINK | LNK (in range?) | BLD (building?) | — |
| TRADE | MKT (available?) | RTE (route active?) | — |
| FACTION | FAC (joined?) | REP (change?) | — |
| QUESTS | QST (active?) | NEW (new=blink) | — |
| LOG | REC (recording) | ALT (alert?) | — |

LED state is computed from store state in the bezel component — no new server messages needed.

### Files Changed

- `packages/client/src/components/SidebarBezel.tsx` — add LED slots, button positions
- `packages/client/src/components/MonitorBezel.tsx` — consistent button layout
- `packages/client/src/components/DetailPanel.tsx` — remove Auto-Follow from content (→ bezel)
- `packages/client/src/components/DesktopLayout.tsx` — pass LED config to bezels
- `packages/client/src/styles/crt.css` — LED styles, button positions

---

## Implementation Priority

1. **Overflow fix** (#22) — critical bug, quick fix
2. **Dynamic grid** (#21) — visual impact, contained change
3. **Bezel buttons + LEDs** (#25) — UI polish, no server changes
4. **Bookmarks** (#23) — server + client, moderate complexity
5. **Far-Navigation** (#24) — most complex, needs autopilot loop + discovery persistence
