# Navigation & Grid Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix layout overflow, make radar grid dynamic, add bookmarks, implement far-navigation with autopilot, and overhaul bezel status LEDs.

**Architecture:** Five phases — (1) CSS overflow bugfix, (2) dynamic grid sizing in RadarRenderer, (3) bezel LED system, (4) bookmark system with server persistence, (5) far-navigation autopilot with discovery persistence. Each phase builds on the previous but phases 1-3 are client-only, phases 4-5 require server+client+DB changes.

**Tech Stack:** TypeScript, React, Zustand, Canvas API, Colyseus, PostgreSQL, Vitest

**Design Doc:** `docs/plans/2026-03-03-nav-grid-overhaul-design.md`

---

## Phase 1: Bug Fixes

### Task 1: CSS Overflow Fix (#22)

The entire page scrolls when it shouldn't. Root cause: `.desktop-layout-v2` has `height: 100%` but no `overflow: hidden`, so flex children can push the page beyond viewport.

**Files:**
- Modify: `packages/client/src/styles/crt.css`

**Step 1: Add overflow constraints to layout containers**

In `crt.css`, find `.desktop-layout-v2` (around line 241) and add `overflow: hidden`:

```css
.desktop-layout-v2 {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
  gap: 0;
  overflow: hidden; /* ADD */
}
```

Find `.main-area` (around line 298) and add `overflow: hidden`:

```css
.main-area {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden; /* ADD */
}
```

Find `.main-lower` (around line 324). It already has `overflow: auto` and `min-height: 0` — verify it also has a reasonable constraint. Add `max-height: 40%` as a safety:

```css
.main-lower {
  flex: 1;
  min-height: 0;
  max-height: 40%; /* ADD — prevent controls from taking over */
  overflow: auto;
  border-top: 2px solid #2a2a2a;
}
```

**Step 2: Verify fix visually**

Run: `npm run dev:client`
Open in browser. Navigate multiple times. The page should NOT scroll. The controls area should scroll internally if needed.

**Step 3: Commit**

```bash
git add packages/client/src/styles/crt.css
git commit -m "fix(client): prevent page scroll overflow in desktop layout (#22)"
```

---

### Task 2: Dynamic Grid Sizing (#21)

Replace fixed `RADAR_RADIUS` (7x7) with dynamic cell count based on canvas size and zoom level.

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/state/uiSlice.ts` (remove fixed pan limits)
- Test: `packages/client/src/__tests__/RadarRenderer.test.ts` (NEW)

**Step 1: Write test for dynamic radius calculation**

Create `packages/client/src/__tests__/RadarRenderer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CELL_SIZES, calculateVisibleRadius } from '../canvas/RadarRenderer';

describe('calculateVisibleRadius', () => {
  it('returns larger radius for smaller cells', () => {
    const zoom0 = calculateVisibleRadius(800, 600, 0); // 48x38 cells
    const zoom3 = calculateVisibleRadius(800, 600, 3); // 96x76 cells
    expect(zoom0.radiusX).toBeGreaterThan(zoom3.radiusX);
    expect(zoom0.radiusY).toBeGreaterThan(zoom3.radiusY);
  });

  it('returns at least radius 2 for tiny canvas', () => {
    const r = calculateVisibleRadius(100, 100, 3);
    expect(r.radiusX).toBeGreaterThanOrEqual(2);
    expect(r.radiusY).toBeGreaterThanOrEqual(2);
  });

  it('calculates from canvas size and cell size', () => {
    // 800px wide / 80px per cell = 10 cells visible, radius = 5
    const r = calculateVisibleRadius(800, 640, 2); // zoom 2 = 80x64
    expect(r.radiusX).toBe(5);
    expect(r.radiusY).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/client && npx vitest run src/__tests__/RadarRenderer.test.ts`
Expected: FAIL — `calculateVisibleRadius` not exported

**Step 3: Implement `calculateVisibleRadius` and refactor `drawRadar`**

In `packages/client/src/canvas/RadarRenderer.ts`:

1. Export a new function:
```ts
export function calculateVisibleRadius(canvasW: number, canvasH: number, zoomLevel: number): { radiusX: number; radiusY: number } {
  const { w, h } = CELL_SIZES[zoomLevel] ?? CELL_SIZES[2];
  const radiusX = Math.max(2, Math.floor(canvasW / w / 2));
  const radiusY = Math.max(2, Math.floor(canvasH / h / 2));
  return { radiusX, radiusY };
}
```

2. In `drawRadar`, replace the fixed radius:
```ts
// OLD:
// const radius = RADAR_RADIUS;
// NEW:
const { radiusX, radiusY } = calculateVisibleRadius(w, h, state.zoomLevel);
```
Where `w` and `h` are the canvas CSS dimensions (from `ctx.canvas.width / dpr` or passed as params).

3. Change the grid loop from:
```ts
for (let dx = -radius; dx <= radius; dx++) {
  for (let dy = -radius; dy <= radius; dy++) {
```
to:
```ts
for (let dx = -radiusX; dx <= radiusX; dx++) {
  for (let dy = -radiusY; dy <= radiusY; dy++) {
```

4. Remove the `import { RADAR_RADIUS }` from this file (no longer needed for rendering).

**Step 4: Update pan limits in uiSlice**

In `packages/client/src/state/uiSlice.ts`, the `setPanOffset` currently clamps to `[-3, 3]`. Change to allow larger pan range:

```ts
// OLD:
setPanOffset: (offset) => set({
  panOffset: {
    x: Math.max(-3, Math.min(3, offset.x)),
    y: Math.max(-3, Math.min(3, offset.y)),
  }
}),
// NEW:
setPanOffset: (offset) => set({
  panOffset: {
    x: Math.max(-50, Math.min(50, Math.round(offset.x))),
    y: Math.max(-50, Math.min(50, Math.round(offset.y))),
  }
}),
```

Also update the PAN knob range in `MonitorBezel.tsx` from `min={-3} max={3}` to `min={-20} max={20}` (or remove the knob-based panning in favor of drag-only — user preference).

**Step 5: Implement zoom-dependent cell content**

In `drawRadar`, add zoom-level checks for what content to render per cell:

```ts
// After drawing the cell border and coordinate label:
if (state.zoomLevel >= 1) {
  // Draw sector type label at bottom of cell
}
if (state.zoomLevel >= 2) {
  // Draw feature dots (jumpgate, distress, etc.)
}
if (state.zoomLevel >= 3) {
  // Draw resource counts, player names
}
```

The current code already draws most of this. Just wrap the resource/player sections in zoom-level guards.

**Step 6: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All pass including the new RadarRenderer test.

**Step 7: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts packages/client/src/state/uiSlice.ts packages/client/src/__tests__/RadarRenderer.test.ts packages/client/src/components/MonitorBezel.tsx
git commit -m "feat(client): dynamic grid sizing based on canvas size and zoom (#21)"
```

---

## Phase 2: Bezel UI

### Task 3: Status LED System for SidebarBezel

Add context-aware status LEDs to sidebar monitors. LEDs are computed from store state.

**Files:**
- Modify: `packages/client/src/components/SidebarBezel.tsx`
- Modify: `packages/client/src/components/DesktopLayout.tsx`
- Create: `packages/client/src/components/MonitorLeds.tsx`
- Test: `packages/client/src/__tests__/MonitorLeds.test.tsx` (NEW)

**Step 1: Create `MonitorLeds.tsx`**

This component reads store state and returns LED config for a given monitor:

```tsx
import { useStore } from '../state/store';

export interface LedConfig {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  blink?: boolean;
}

export function useMonitorLeds(monitorId: string): LedConfig[] {
  const fuel = useStore((s) => s.fuel);
  const mining = useStore((s) => s.mining);
  const cargo = useStore((s) => s.cargo);
  const faction = useStore((s) => s.faction);
  const alerts = useStore((s) => s.alerts);
  const autopilot = useStore((s) => s.autopilot);

  switch (monitorId) {
    case 'NAV-COM':
      return [
        { label: 'SYS', color: 'green' },
        { label: 'NAV', color: autopilot ? 'yellow' : 'green' },
      ];
    case 'SHIP-SYS':
      return [
        { label: 'PWR', color: 'green' },
        { label: 'FUEL', color: fuel && fuel.current < fuel.max * 0.2 ? 'red' : fuel && fuel.current < fuel.max * 0.5 ? 'yellow' : 'green' },
      ];
    case 'MINING':
      return [
        { label: 'RIG', color: mining?.active ? 'green' : 'gray' },
      ];
    case 'CARGO': {
      const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;
      const cap = 5; // default, will be from ship
      return [
        { label: 'CAP', color: total >= cap ? 'red' : total > cap * 0.7 ? 'yellow' : 'green' },
      ];
    }
    case 'COMMS':
      return [
        { label: 'SIG', color: 'green' },
        { label: 'MSG', color: alerts['COMMS'] ? 'yellow' : 'gray', blink: !!alerts['COMMS'] },
      ];
    case 'QUESTS':
      return [
        { label: 'QST', color: alerts['QUESTS'] ? 'yellow' : 'gray', blink: !!alerts['QUESTS'] },
      ];
    default:
      return [{ label: 'SYS', color: 'green' }];
  }
}

export function LedDot({ led }: { led: LedConfig }) {
  const colors = { green: '#00FF88', yellow: '#FFB000', red: '#FF3333', gray: '#444' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem' }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        backgroundColor: colors[led.color],
        animation: led.blink ? 'bezel-alert-pulse 1.5s infinite' : undefined,
      }} />
      <span style={{ opacity: 0.6 }}>{led.label}</span>
    </div>
  );
}
```

**Step 2: Write test**

Create `packages/client/src/__tests__/MonitorLeds.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LedDot } from '../components/MonitorLeds';

describe('LedDot', () => {
  it('renders label', () => {
    render(<LedDot led={{ label: 'SYS', color: 'green' }} />);
    expect(screen.getByText('SYS')).toBeDefined();
  });

  it('renders with correct color', () => {
    const { container } = render(<LedDot led={{ label: 'FUEL', color: 'red' }} />);
    const dot = container.querySelector('div > div');
    expect(dot?.style.backgroundColor).toBe('rgb(255, 51, 51)');
  });
});
```

**Step 3: Integrate into SidebarBezel**

In `SidebarBezel.tsx`, import `useMonitorLeds` and `LedDot`. Add a LED row at the top of the bezel frame:

```tsx
const leds = useMonitorLeds(monitorId);
// In render, above the CRT content:
<div style={{ display: 'flex', gap: 8, padding: '2px 8px' }}>
  {leds.map((led, i) => <LedDot key={i} led={led} />)}
</div>
```

**Step 4: Run tests and commit**

```bash
cd packages/client && npx vitest run
git add packages/client/src/components/MonitorLeds.tsx packages/client/src/components/SidebarBezel.tsx packages/client/src/__tests__/MonitorLeds.test.tsx packages/client/src/components/DesktopLayout.tsx
git commit -m "feat(client): add context-aware status LEDs to monitor bezels (#25)"
```

---

### Task 4: MonitorBezel LEDs + Auto-Follow Migration

Move the Auto-Follow toggle from DetailPanel content into the Detail monitor bezel. Add LEDs to main MonitorBezel.

**Files:**
- Modify: `packages/client/src/components/MonitorBezel.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Add LEDs to MonitorBezel**

In `MonitorBezel.tsx`, replace the hardcoded `statusLeds` prop with dynamic LEDs from `useMonitorLeds`:

```tsx
import { useMonitorLeds, LedDot } from './MonitorLeds';
// ...
const leds = useMonitorLeds(monitorId);
// Replace the static LED rendering with:
{leds.map((led, i) => <LedDot key={i} led={led} />)}
```

**Step 2: Move Auto-Follow toggle**

In `DetailPanel.tsx`, remove the `autoFollow` state and the toggle button entirely. Instead, add an `autoFollow` state to `uiSlice.ts` (persisted) and a small toggle button on the Detail bezel.

In `GameScreen.tsx`, the `detailArea` JSX renders the Detail monitor. Add a small auto-follow toggle button to the bezel area above the DetailPanel content:

```tsx
const autoFollow = useStore((s) => s.autoFollow);
const setAutoFollow = useStore((s) => s.setAutoFollow);
// In detailArea:
<div style={{ height: '100%', background: '#050505' }}>
  <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', ... }}>
    <span>DETAIL</span>
    <button className="vs-btn" style={{ fontSize: '0.6rem' }}
      onClick={() => setAutoFollow(!autoFollow)}>
      {autoFollow ? '\u25CF AUTO' : '\u25CB AUTO'}
    </button>
  </div>
  <DetailPanel />
</div>
```

Update `DetailPanel.tsx` to consume `autoFollow` from store instead of local state.

**Step 3: Add `autoFollow` to uiSlice**

In `uiSlice.ts`:
```ts
autoFollow: boolean; // default false
setAutoFollow: (val: boolean) => void;
// Implementation:
autoFollow: false,
setAutoFollow: (autoFollow) => set({ autoFollow }),
```

**Step 4: Run tests and commit**

```bash
cd packages/client && npx vitest run
git commit -m "feat(client): move auto-follow to bezel, add LEDs to main monitor (#25)"
```

---

## Phase 3: Bookmarks

### Task 5: DB Migration for Bookmarks

**Files:**
- Create: `packages/server/src/db/migrations/010_bookmarks.sql`

**Step 1: Create migration**

```sql
-- Bookmarks
CREATE TABLE IF NOT EXISTS player_bookmarks (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_player ON player_bookmarks(player_id);
```

**Step 2: Commit**

```bash
git add packages/server/src/db/migrations/010_bookmarks.sql
git commit -m "feat(server): add bookmarks migration (#23)"
```

---

### Task 6: Server Bookmark Queries + Handlers

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/shared/src/types.ts`

**Step 1: Add shared types**

In `packages/shared/src/types.ts`:
```ts
export interface Bookmark {
  slot: number;
  sectorX: number;
  sectorY: number;
  label: string;
}

export interface SetBookmarkMessage { slot: number; sectorX: number; sectorY: number; label: string; }
export interface ClearBookmarkMessage { slot: number; }
```

**Step 2: Add DB queries**

In `packages/server/src/db/queries.ts`:
```ts
export async function getPlayerBookmarks(playerId: string): Promise<Bookmark[]> {
  const result = await query<{ slot: number; sector_x: number; sector_y: number; label: string }>(
    'SELECT slot, sector_x, sector_y, label FROM player_bookmarks WHERE player_id = $1 ORDER BY slot',
    [playerId]
  );
  return result.rows.map(r => ({ slot: r.slot, sectorX: r.sector_x, sectorY: r.sector_y, label: r.label }));
}

export async function setPlayerBookmark(playerId: string, slot: number, sectorX: number, sectorY: number, label: string): Promise<void> {
  await query(
    `INSERT INTO player_bookmarks (player_id, slot, sector_x, sector_y, label)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id, slot) DO UPDATE SET sector_x = $3, sector_y = $4, label = $5`,
    [playerId, slot, sectorX, sectorY, label]
  );
}

export async function clearPlayerBookmark(playerId: string, slot: number): Promise<void> {
  await query('DELETE FROM player_bookmarks WHERE player_id = $1 AND slot = $2', [playerId, slot]);
}
```

**Step 3: Add message handlers in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, add in `onCreate`:
```ts
this.onMessage('getBookmarks', async (client) => {
  const auth = client.auth as AuthPayload;
  const bookmarks = await getPlayerBookmarks(auth.userId);
  client.send('bookmarksUpdate', { bookmarks });
});

this.onMessage('setBookmark', async (client, data: SetBookmarkMessage) => {
  const auth = client.auth as AuthPayload;
  if (data.slot < 1 || data.slot > 5) {
    client.send('error', { code: 'INVALID_SLOT', message: 'Bookmark slot must be 1-5' });
    return;
  }
  await setPlayerBookmark(auth.userId, data.slot, data.sectorX, data.sectorY, data.label);
  const bookmarks = await getPlayerBookmarks(auth.userId);
  client.send('bookmarksUpdate', { bookmarks });
});

this.onMessage('clearBookmark', async (client, data: ClearBookmarkMessage) => {
  const auth = client.auth as AuthPayload;
  await clearPlayerBookmark(auth.userId, data.slot);
  const bookmarks = await getPlayerBookmarks(auth.userId);
  client.send('bookmarksUpdate', { bookmarks });
});
```

Also send bookmarks on join (in `onJoin` handler):
```ts
const bookmarks = await getPlayerBookmarks(auth.userId);
client.send('bookmarksUpdate', { bookmarks });
```

**Step 4: Run server tests and commit**

```bash
cd packages/server && npx vitest run
git commit -m "feat(server): bookmark CRUD queries and message handlers (#23)"
```

---

### Task 7: Client Bookmark State + Network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/shared/src/index.ts` (export new types)

**Step 1: Add bookmark state to gameSlice**

```ts
// In interface:
bookmarks: Bookmark[];
setBookmarks: (bookmarks: Bookmark[]) => void;

// In defaults:
bookmarks: [],

// In implementation:
setBookmarks: (bookmarks) => set({ bookmarks }),
```

Import `Bookmark` from `@void-sector/shared`.

**Step 2: Add network handlers in client.ts**

```ts
room.onMessage('bookmarksUpdate', (data) => {
  useStore.getState().setBookmarks(data.bookmarks);
});
```

Add send methods:
```ts
requestBookmarks() { this.room?.send('getBookmarks'); }
sendSetBookmark(slot: number, sectorX: number, sectorY: number, label: string) {
  this.room?.send('setBookmark', { slot, sectorX, sectorY, label });
}
sendClearBookmark(slot: number) { this.room?.send('clearBookmark', { slot }); }
```

**Step 3: Update mockStore**

Add `bookmarks: []` and `setBookmarks: vi.fn()` to `mockStore.ts`.

**Step 4: Run tests and commit**

```bash
cd packages/client && npx vitest run
git commit -m "feat(client): bookmark state and network handlers (#23)"
```

---

### Task 8: BookmarkBar UI Component

**Files:**
- Create: `packages/client/src/components/BookmarkBar.tsx`
- Modify: `packages/client/src/components/MonitorBezel.tsx` (add BookmarkBar to left side)
- Modify: `packages/client/src/components/DetailPanel.tsx` (add BOOKMARK button)
- Test: `packages/client/src/__tests__/BookmarkBar.test.tsx`

**Step 1: Create BookmarkBar component**

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';
import { useEffect } from 'react';

export function BookmarkBar() {
  const bookmarks = useStore((s) => s.bookmarks);
  const position = useStore((s) => s.position);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const setSelectedSector = useStore((s) => s.setSelectedSector);

  useEffect(() => { network.requestBookmarks(); }, []);

  function jumpTo(x: number, y: number) {
    setPanOffset({ x: x - position.x, y: y - position.y });
    setSelectedSector({ x, y });
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '4px', fontSize: '0.55rem', minWidth: 48,
    }}>
      <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '2px 4px' }}
        onClick={() => jumpTo(0, 0)}>
        HOME
      </button>
      <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '2px 4px' }}
        onClick={() => jumpTo(position.x, position.y)}>
        SHIP
      </button>
      {[1, 2, 3, 4, 5].map(slot => {
        const bm = bookmarks.find(b => b.slot === slot);
        return (
          <button key={slot} className="vs-btn"
            style={{ fontSize: '0.55rem', padding: '2px 4px', opacity: bm ? 1 : 0.3 }}
            onClick={() => bm && jumpTo(bm.sectorX, bm.sectorY)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (bm) network.sendClearBookmark(slot);
            }}
            disabled={!bm}
          >
            {bm ? `${slot}: ${bm.label || `(${bm.sectorX},${bm.sectorY})`}` : `${slot}: ---`}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Add to MonitorBezel left side**

In `MonitorBezel.tsx`, inside the `.bezel-left` div, add `<BookmarkBar />` above or below the PAN knob.

**Step 3: Add BOOKMARK button in DetailPanel**

In `DetailPanel.tsx`, when a sector is selected and discovered, add a button:
```tsx
const bookmarks = useStore((s) => s.bookmarks);
// In the sector info section:
{sector && (
  <button className="vs-btn" style={{ fontSize: '0.7rem', marginTop: 4 }}
    onClick={() => {
      const freeSlot = [1,2,3,4,5].find(s => !bookmarks.find(b => b.slot === s));
      if (freeSlot) {
        network.sendSetBookmark(freeSlot, selectedSector.x, selectedSector.y, sector.type);
      }
    }}>
    [BOOKMARK]
  </button>
)}
```

**Step 4: Write test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookmarkBar } from '../components/BookmarkBar';
import { mockStoreState } from '../test/mockStore';

describe('BookmarkBar', () => {
  it('shows HOME and SHIP buttons', () => {
    mockStoreState({ bookmarks: [] });
    render(<BookmarkBar />);
    expect(screen.getByText('HOME')).toBeDefined();
    expect(screen.getByText('SHIP')).toBeDefined();
  });

  it('shows bookmark labels', () => {
    mockStoreState({
      bookmarks: [{ slot: 1, sectorX: 5, sectorY: -3, label: 'Asteroids' }],
    });
    render(<BookmarkBar />);
    expect(screen.getByText(/Asteroids/)).toBeDefined();
  });
});
```

**Step 5: Run tests and commit**

```bash
cd packages/client && npx vitest run
git commit -m "feat(client): BookmarkBar component with nav-bezel integration (#23)"
```

---

## Phase 4: Far-Navigation

### Task 9: Shared Types + Constants for Far-Nav

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add types**

In `packages/shared/src/types.ts`:
```ts
export interface AutopilotState {
  targetX: number;
  targetY: number;
  remaining: number;
  active: boolean;
}

export interface FarJumpMessage { targetX: number; targetY: number; }
export interface AutopilotUpdateMessage { x: number; y: number; remaining: number; }
export interface AutopilotCompleteMessage { x: number; y: number; }
```

**Step 2: Add constants**

In `packages/shared/src/constants.ts`:
```ts
// Far-Navigation
export const FAR_JUMP_AP_DISCOUNT = 0.5;   // 50% AP cost for known routes
export const FAR_JUMP_PIRATE_FUEL_PENALTY = 1.5; // 50% extra fuel for pirate sectors
export const AUTOPILOT_STEP_MS = 100;       // ms per sector during autopilot
export const STALENESS_DIM_HOURS = 24;      // dim sectors after 24h
export const STALENESS_FADE_DAYS = 7;       // coords-only after 7 days
```

**Step 3: Export from shared index**

Ensure the new types and constants are exported from `packages/shared/src/index.ts`.

**Step 4: Commit**

```bash
git commit -m "feat(shared): add far-navigation types and constants (#24)"
```

---

### Task 10: Discovery Persistence — Server

Discoveries already exist in DB (`discoveries` table with `player_id`, `sector_x`, `sector_y`, `discovered_at`). Add a bulk query to send all discoveries on join.

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add bulk discovery query**

In `queries.ts`:
```ts
export async function getPlayerDiscoveries(playerId: string): Promise<{ x: number; y: number; discoveredAt: number }[]> {
  const result = await query<{ sector_x: number; sector_y: number; discovered_at: string }>(
    'SELECT sector_x, sector_y, discovered_at FROM discoveries WHERE player_id = $1',
    [playerId]
  );
  return result.rows.map(r => ({
    x: r.sector_x,
    y: r.sector_y,
    discoveredAt: new Date(r.discovered_at).getTime(),
  }));
}
```

**Step 2: Send discoveries on join**

In `SectorRoom.ts` `onJoin`, after sending the sector data, also send all discoveries:
```ts
const allDiscoveries = await getPlayerDiscoveries(auth.userId);
client.send('allDiscoveries', { discoveries: allDiscoveries });
```

**Step 3: Validate route for far-jump**

In `queries.ts`:
```ts
export async function isRouteDiscovered(playerId: string, sectorX: number, sectorY: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM discoveries WHERE player_id = $1 AND sector_x = $2 AND sector_y = $3 LIMIT 1',
    [playerId, sectorX, sectorY]
  );
  return result.rows.length > 0;
}
```

**Step 4: Commit**

```bash
git commit -m "feat(server): discovery persistence and bulk query for relog (#24)"
```

---

### Task 11: Far-Jump Server Handler + Autopilot Loop

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add farJump handler**

```ts
this.onMessage('farJump', async (client, data: FarJumpMessage) => {
  await this.handleFarJump(client, data);
});
this.onMessage('cancelAutopilot', async (client) => {
  this.handleCancelAutopilot(client);
});
```

**Step 2: Implement `handleFarJump`**

```ts
private autopilotTimers = new Map<string, ReturnType<typeof setInterval>>();

private async handleFarJump(client: Client, data: FarJumpMessage) {
  const auth = client.auth as AuthPayload;

  // Validate target is discovered
  const discovered = await isRouteDiscovered(auth.userId, data.targetX, data.targetY);
  if (!discovered) {
    client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Target sector not discovered' });
    return;
  }

  // Calculate route (Manhattan path)
  const pos = await getPlayerPosition(auth.userId);
  const dx = data.targetX - pos.x;
  const dy = data.targetY - pos.y;
  const distance = Math.abs(dx) + Math.abs(dy);
  if (distance <= 1) {
    client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Use normal jump for adjacent sectors' });
    return;
  }

  // Calculate costs
  const ship = this.getShipForClient(client.sessionId);
  const apCost = Math.ceil(distance * ship.apCostJump * FAR_JUMP_AP_DISCOUNT);
  const fuelCost = distance * ship.fuelPerJump;

  // Validate AP + fuel
  const ap = await getAPState(auth.userId);
  const currentAP = calculateCurrentAP(ap, Date.now());
  if (currentAP.current < apCost) {
    client.send('error', { code: 'FAR_JUMP_FAIL', message: `Not enough AP (need ${apCost})` });
    return;
  }
  const fuel = await getFuelState(auth.userId);
  if (fuel.current < fuelCost) {
    client.send('error', { code: 'FAR_JUMP_FAIL', message: `Not enough fuel (need ${fuelCost})` });
    return;
  }

  // Deduct costs upfront
  currentAP.current -= apCost;
  await saveAPState(auth.userId, currentAP);
  fuel.current -= fuelCost;
  await saveFuelState(auth.userId, fuel);
  client.send('apUpdate', currentAP);
  client.send('fuelUpdate', fuel);

  // Build step list (simple: X first, then Y)
  const steps: { x: number; y: number }[] = [];
  let cx = pos.x, cy = pos.y;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  for (let i = 0; i < Math.abs(dx); i++) { cx += stepX; steps.push({ x: cx, y: cy }); }
  for (let i = 0; i < Math.abs(dy); i++) { cy += stepY; steps.push({ x: cx, y: cy }); }

  // Start autopilot
  let stepIndex = 0;
  client.send('autopilotStart', { targetX: data.targetX, targetY: data.targetY, totalSteps: steps.length });

  const timer = setInterval(async () => {
    if (stepIndex >= steps.length) {
      clearInterval(timer);
      this.autopilotTimers.delete(client.sessionId);
      await savePlayerPosition(auth.userId, data.targetX, data.targetY);
      client.send('autopilotComplete', { x: data.targetX, y: data.targetY });
      return;
    }
    const step = steps[stepIndex];
    await savePlayerPosition(auth.userId, step.x, step.y);
    stepIndex++;
    client.send('autopilotUpdate', { x: step.x, y: step.y, remaining: steps.length - stepIndex });
  }, AUTOPILOT_STEP_MS);

  this.autopilotTimers.set(client.sessionId, timer);
}

private handleCancelAutopilot(client: Client) {
  const timer = this.autopilotTimers.get(client.sessionId);
  if (timer) {
    clearInterval(timer);
    this.autopilotTimers.delete(client.sessionId);
    client.send('autopilotComplete', { x: -1, y: -1 }); // signal cancel
  }
}
```

Also clean up on `onLeave`:
```ts
const timer = this.autopilotTimers.get(client.sessionId);
if (timer) clearInterval(timer);
this.autopilotTimers.delete(client.sessionId);
```

**Step 3: Run server tests and commit**

```bash
cd packages/server && npx vitest run
git commit -m "feat(server): far-jump handler with autopilot loop (#24)"
```

---

### Task 12: Client Far-Nav State + Network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/test/mockStore.ts`

**Step 1: Add autopilot state**

In `gameSlice.ts`:
```ts
// Interface:
autopilot: AutopilotState | null;
setAutopilot: (state: AutopilotState | null) => void;

// Defaults:
autopilot: null,

// Implementation:
setAutopilot: (autopilot) => set({ autopilot }),
```

**Step 2: Add network handlers**

In `client.ts`:
```ts
room.onMessage('autopilotStart', (data) => {
  useStore.getState().setAutopilot({
    targetX: data.targetX, targetY: data.targetY,
    remaining: data.totalSteps, active: true,
  });
});

room.onMessage('autopilotUpdate', (data) => {
  const store = useStore.getState();
  store.setPosition({ x: data.x, y: data.y });
  store.setAutopilot({
    ...store.autopilot!,
    remaining: data.remaining,
  });
  // Auto-center camera on ship during autopilot
  store.resetPan();
});

room.onMessage('autopilotComplete', (data) => {
  const store = useStore.getState();
  store.setAutopilot(null);
  if (data.x >= 0 && data.y >= 0) {
    store.setPosition({ x: data.x, y: data.y });
    store.addLogEntry(`Autopilot: Ankunft bei (${data.x}, ${data.y})`);
  } else {
    store.addLogEntry('Autopilot abgebrochen.');
  }
});

room.onMessage('allDiscoveries', (data) => {
  const store = useStore.getState();
  const discoveries = { ...store.discoveries };
  for (const d of data.discoveries) {
    const key = `${d.x}:${d.y}`;
    if (!discoveries[key]) {
      // We only have coordinates, not full sector data — mark as discovered with timestamp
      // Full data will be loaded when the sector is visited or scanned
    }
  }
  // Store discovery timestamps for staleness
  store.setDiscoveryTimestamps(
    Object.fromEntries(data.discoveries.map(d => [`${d.x}:${d.y}`, d.discoveredAt]))
  );
});
```

Add `discoveryTimestamps: Record<string, number>` to `gameSlice` and a setter. Also add to mockStore.

Add send methods:
```ts
sendFarJump(targetX: number, targetY: number) { this.room?.send('farJump', { targetX, targetY }); }
sendCancelAutopilot() { this.room?.send('cancelAutopilot'); }
```

**Step 3: Commit**

```bash
git commit -m "feat(client): autopilot state and far-jump network handlers (#24)"
```

---

### Task 13: Far-Nav UI — NavControls + DetailPanel + Staleness

**Files:**
- Modify: `packages/client/src/components/NavControls.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Autopilot UI in NavControls**

In `NavControls.tsx`, at the top of the render, check for autopilot:

```tsx
const autopilot = useStore((s) => s.autopilot);

if (autopilot?.active) {
  return (
    <div style={{ padding: '8px 12px', textAlign: 'center' }}>
      <div style={{ color: '#FFB000', fontSize: '0.9rem', letterSpacing: '0.15em', marginBottom: 8 }}>
        AUTOPILOT AKTIV
      </div>
      <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
        Ziel: ({autopilot.targetX}, {autopilot.targetY}) | Verbleibend: {autopilot.remaining}
      </div>
      <button className="vs-btn" onClick={() => network.sendCancelAutopilot()}>
        [ABBRECHEN]
      </button>
    </div>
  );
}
```

**Step 2: Far Jump button in DetailPanel**

In `DetailPanel.tsx`, after the existing jump/refuel buttons, when a discovered non-adjacent sector is selected:

```tsx
const autopilot = useStore((s) => s.autopilot);
const ship = useStore((s) => s.ship);

// Calculate distance
const distance = Math.abs(selectedSector.x - position.x) + Math.abs(selectedSector.y - position.y);
const isAdjacent = distance <= 1;

// Show FAR JUMP button for non-adjacent discovered sectors
{sector && !isPlayerHere && !isAdjacent && !autopilot && (
  <button className="vs-btn" style={{ marginTop: 8, display: 'block' }}
    onClick={() => network.sendFarJump(selectedSector.x, selectedSector.y)}>
    [FAR JUMP → ({selectedSector.x}, {selectedSector.y})]
    {ship && ` ${Math.ceil(distance * ship.apCostJump * 0.5)}AP / ${distance * ship.fuelPerJump}F`}
  </button>
)}
```

**Step 3: Staleness rendering in RadarRenderer**

In `RadarRenderer.ts`, the `drawRadar` function draws each cell. Add staleness logic:

```ts
// After getting the sector from discoveries:
const discoveryTimestamp = state.discoveryTimestamps?.[key];
const now = Date.now();
const hoursSinceDiscovery = discoveryTimestamp ? (now - discoveryTimestamp) / (1000 * 60 * 60) : 0;
const isFaded = hoursSinceDiscovery > STALENESS_FADE_DAYS * 24;
const isDimmed = hoursSinceDiscovery > STALENESS_DIM_HOURS;

// Apply alpha based on staleness:
if (isFaded) {
  ctx.globalAlpha = 0.2; // very dim, coords only
} else if (isDimmed) {
  ctx.globalAlpha = 0.5; // dimmed
}
// ... draw cell content ...
ctx.globalAlpha = 1.0; // reset
```

Add `discoveryTimestamps` to `RadarState` interface and pass it from `RadarCanvas.tsx`.

**Step 4: Run tests and commit**

```bash
cd packages/client && npx vitest run
git commit -m "feat(client): far-jump UI, autopilot controls, staleness rendering (#24)"
```

---

## Phase 5: Tests + Polish

### Task 14: Server Integration Tests

**Files:**
- Create: `packages/server/src/engine/__tests__/farNav.test.ts`

Write tests for:
- `getPlayerDiscoveries` returns correct format
- `isRouteDiscovered` returns true/false correctly
- `getPlayerBookmarks` / `setPlayerBookmark` / `clearPlayerBookmark` CRUD
- Far-jump cost calculation (50% AP discount)

These are pure function tests (no DB needed — mock the query function).

**Step 5: Commit**

```bash
git commit -m "test(server): far-nav and bookmark query tests (#23, #24)"
```

---

### Task 15: Client Component Tests

**Files:**
- Create: `packages/client/src/__tests__/BookmarkBar.test.tsx`
- Modify: `packages/client/src/__tests__/NavControls.test.tsx`

Write tests for:
- BookmarkBar renders HOME/SHIP buttons
- BookmarkBar renders bookmark labels from store
- NavControls shows autopilot UI when `autopilot.active = true`
- NavControls hides jump buttons during autopilot
- DetailPanel shows FAR JUMP button for non-adjacent discovered sectors

**Step 6: Commit**

```bash
git commit -m "test(client): bookmark bar and autopilot UI tests (#23, #24)"
```

---

### Task 16: Relog Position Fix (#23)

**Files:**
- Modify: `packages/client/src/network/client.ts`

Ensure that on room join, the `joinResult` message sets position from server data:

```ts
room.onMessage('joinResult', (data) => {
  const store = useStore.getState();
  if (data.position) {
    store.setPosition(data.position);
  }
  // ... existing join logic
});
```

Verify the server already sends position in `joinResult`. If not, add it to the `onJoin` handler in SectorRoom.

**Commit:**
```bash
git commit -m "fix(client): center nav on actual position after relog (#23)"
```

---

### Task 17: Docs Update

**Files:**
- Modify: `CLAUDE.md`
- Modify: `planung/ROADMAP.md`

Update:
- Migration range (001-010)
- New features in current state
- Test counts

**Commit:**
```bash
git commit -m "docs: update CLAUDE.md and ROADMAP.md for nav-grid overhaul"
```
