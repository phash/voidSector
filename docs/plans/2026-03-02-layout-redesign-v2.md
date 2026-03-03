# Layout-Redesign v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the game UI to a 3-column layout with left sidebar, split main area (Grid + Detail), oversized channel buttons with blink alerts, and click-to-inspect grid cells.

**Architecture:** 3-column CSS Grid. Left/right sidebars have 2 switchable monitor slots each with 64x48px channel buttons. Main area splits into upper 2/3 (Grid + Detail panel side by side) and lower 1/3 (nav/actions). Alert system drives blinking buttons/screens for unread events.

**Tech Stack:** React, Zustand, CSS Grid, Canvas (RadarRenderer), TypeScript

**Design doc:** `docs/plans/2026-03-02-layout-redesign-v2-design.md`

---

## Block A: State & Constants Foundation

### Task 1: Add LOG monitor + left sidebar constants

**Files:**
- Modify: `packages/shared/src/constants.ts:155-173`

**Step 1: Add LOG to MONITORS and update sidebar arrays**

In `packages/shared/src/constants.ts`, update the MONITORS object and add separate sidebar arrays:

```typescript
export const MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
  COMMS: 'COMMS',
  BASE_LINK: 'BASE-LINK',
  LOG: 'LOG',
} as const;

export type MonitorId = typeof MONITORS[keyof typeof MONITORS];

// Right sidebar: programs (no LOG, no NAV-COM)
export const RIGHT_SIDEBAR_MONITORS: MonitorId[] = [
  MONITORS.SHIP_SYS,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
];

// Left sidebar: LOG + same programs
export const LEFT_SIDEBAR_MONITORS: MonitorId[] = [
  MONITORS.LOG,
  MONITORS.SHIP_SYS,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
];

// Main area: switchable programs (NAV-COM shown as default split view)
export const MAIN_MONITORS: MonitorId[] = [
  MONITORS.NAV_COM,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
];

// Keep for backwards compat (used by ChannelButtons currently)
export const SIDEBAR_MONITORS = RIGHT_SIDEBAR_MONITORS;
```

**Step 2: Rebuild shared package**

Run: `cd packages/shared && npx tsc`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat(shared): add LOG monitor and separate sidebar/main monitor arrays"
```

---

### Task 2: Add alerts, selectedSector, leftSidebarSlots, mainMonitorMode to store

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/test/mockStore.ts`

**Step 1: Add new UI state to uiSlice.ts**

Add to `UISlice` interface and implementation:

```typescript
// New state fields in UISlice interface:
leftSidebarSlots: [string, string];
mainMonitorMode: 'split' | string; // 'split' = Grid+Detail, or a MonitorId for fullscreen

// New actions:
setLeftSidebarSlot: (index: 0 | 1, monitor: string) => void;
setMainMonitorMode: (mode: 'split' | string) => void;
```

Implementation in `createUISlice`:

```typescript
leftSidebarSlots: JSON.parse(safeGetItem('vs-left-sidebar-slots') || '["LOG","SHIP-SYS"]') as [string, string],
mainMonitorMode: 'split' as 'split' | string,

setLeftSidebarSlot: (index, monitor) => set((s) => {
  const slots = [...s.leftSidebarSlots] as [string, string];
  slots[index] = monitor;
  safeSetItem('vs-left-sidebar-slots', JSON.stringify(slots));
  return { leftSidebarSlots: slots };
}),
setMainMonitorMode: (mode) => set({ mainMonitorMode: mode }),
```

**Step 2: Add alerts + selectedSector to gameSlice.ts**

Add to `GameSlice` interface:

```typescript
// New state:
alerts: Record<string, boolean>; // keyed by MonitorId
selectedSector: { x: number; y: number } | null;

// New actions:
setAlert: (monitorId: string, active: boolean) => void;
clearAlert: (monitorId: string) => void;
setSelectedSector: (sector: { x: number; y: number } | null) => void;
```

Implementation in `createGameSlice`:

```typescript
alerts: {},
selectedSector: null,

setAlert: (monitorId, active) => set((s) => ({
  alerts: { ...s.alerts, [monitorId]: active },
})),
clearAlert: (monitorId) => set((s) => {
  const next = { ...s.alerts };
  delete next[monitorId];
  return { alerts: next };
}),
setSelectedSector: (selectedSector) => set({ selectedSector }),
```

**Step 3: Replace `unreadComms` usage with `alerts`**

In `gameSlice.ts`, the existing `unreadComms` boolean is now replaced by `alerts['COMMS']`. Remove:
- `unreadComms: boolean` from interface
- `unreadComms: false` from defaults
- `setUnreadComms` action

Instead, callers will use `setAlert('COMMS', true)` and `clearAlert('COMMS')`.

**Step 4: Update mockStore.ts**

Add to mock state:

```typescript
alerts: {},
selectedSector: null,
leftSidebarSlots: ['LOG', 'SHIP-SYS'] as [string, string],
mainMonitorMode: 'split' as 'split' | string,
setAlert: vi.fn(),
clearAlert: vi.fn(),
setSelectedSector: vi.fn(),
setLeftSidebarSlot: vi.fn(),
setMainMonitorMode: vi.fn(),
```

Remove `unreadComms` and `setUnreadComms` from mock.

**Step 5: Update all `unreadComms` references**

Search for `unreadComms` across the client codebase. Replace:
- `useStore((s) => s.unreadComms)` → `useStore((s) => !!s.alerts['COMMS'])`
- `setUnreadComms(false)` → `clearAlert('COMMS')`
- `setUnreadComms(true)` → `setAlert('COMMS', true)`

Files likely affected: `GameScreen.tsx`, `ChannelButtons.tsx`, `network/client.ts`.

**Step 6: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass (some may need `unreadComms` → `alerts` updates).

**Step 7: Commit**

```bash
git add packages/client/src/state/uiSlice.ts packages/client/src/state/gameSlice.ts packages/client/src/test/mockStore.ts packages/client/src/components/ChannelButtons.tsx packages/client/src/components/GameScreen.tsx packages/client/src/network/client.ts
git commit -m "feat(client): add alerts system, selectedSector, left sidebar slots, mainMonitorMode"
```

---

## Block B: CSS & Channel Buttons

### Task 3: Double-size channel buttons + blink animation CSS

**Files:**
- Modify: `packages/client/src/styles/crt.css:172-218`

**Step 1: Update channel button sizes**

Replace the `.channel-btn` rule (currently 32x24px, font 0.45rem) with:

```css
.channel-btn {
  position: relative;
  width: 64px;
  height: 48px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: rgba(255, 176, 0, 0.4);
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  transition: all 0.1s;
}
```

Update `.channel-buttons` gap:

```css
.channel-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 4px;
  background: linear-gradient(180deg, #1a1a1a, #131313, #1a1a1a);
  border-left: 1px solid #2a2a2a;
}
```

**Step 2: Add blink keyframes and classes**

Append to `crt.css`:

```css
/* Alert blink animation for channel buttons */
@keyframes channel-blink {
  0%, 100% { box-shadow: 0 0 4px var(--color-primary); opacity: 1; }
  50% { box-shadow: 0 0 12px var(--color-primary); opacity: 0.7; }
}

.channel-btn.alert {
  animation: channel-blink 1s ease-in-out infinite;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* Alert blink for sidebar bezel border */
@keyframes bezel-alert-pulse {
  0%, 100% { border-color: #2a2a2a; }
  50% { border-color: var(--color-primary); }
}

.sidebar-bezel.alert {
  animation: bezel-alert-pulse 1.5s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .channel-btn.alert,
  .sidebar-bezel.alert {
    animation: none;
    border-color: var(--color-primary);
  }
}
```

**Step 3: Commit**

```bash
git add packages/client/src/styles/crt.css
git commit -m "feat(client): double-size channel buttons and add blink animation CSS"
```

---

### Task 4: Update ChannelButtons component for alerts + left sidebar support

**Files:**
- Modify: `packages/client/src/components/ChannelButtons.tsx`

**Step 1: Rewrite ChannelButtons to accept a monitors list and use alerts**

```typescript
import { useStore } from '../state/store';
import type { MonitorId } from '@void-sector/shared';

interface ChannelButtonsProps {
  slotIndex: 0 | 1;
  side: 'left' | 'right';
  monitors: MonitorId[];
}

const CHANNEL_LABELS: Record<string, string> = {
  'LOG': 'LOG',
  'SHIP-SYS': 'SYS',
  'MINING': 'MIN',
  'CARGO': 'CRG',
  'COMMS': 'COM',
  'BASE-LINK': 'BAS',
};

export function ChannelButtons({ slotIndex, side, monitors }: ChannelButtonsProps) {
  const sidebarSlots = useStore((s) =>
    side === 'left' ? s.leftSidebarSlots : s.sidebarSlots
  );
  const setSidebarSlot = useStore((s) =>
    side === 'left' ? s.setLeftSidebarSlot : s.setSidebarSlot
  );
  const alerts = useStore((s) => s.alerts);
  const clearAlert = useStore((s) => s.clearAlert);
  const activeMonitor = sidebarSlots[slotIndex];

  return (
    <div className="channel-buttons">
      {monitors.map((id) => (
        <button
          key={id}
          className={`channel-btn ${activeMonitor === id ? 'active' : ''} ${alerts[id] && activeMonitor !== id ? 'alert' : ''}`}
          onClick={() => {
            setSidebarSlot(slotIndex, id);
            if (alerts[id]) clearAlert(id);
          }}
          title={id}
        >
          {CHANNEL_LABELS[id] || id.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}
```

Note: The `.channel-dot` span for unread COMMS is removed — the entire button now blinks via `.alert` class instead.

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: ChannelButtons tests may need updating for new props (`side`, `monitors`).

**Step 3: Commit**

```bash
git add packages/client/src/components/ChannelButtons.tsx
git commit -m "feat(client): ChannelButtons supports left/right side, uses alerts for blink"
```

---

## Block C: Layout Restructure

### Task 5: Create DetailPanel component

**Files:**
- Create: `packages/client/src/components/DetailPanel.tsx`

**Step 1: Create the DetailPanel**

This component reads `selectedSector` from the store and shows sector details. For now it shows basic info — the full contextual views (mining, station, trade) will be added later as those features are built out.

```typescript
import { useStore } from '../state/store';
import { SECTOR_COLORS } from '@void-sector/shared';

export function DetailPanel() {
  const selectedSector = useStore((s) => s.selectedSector);
  const discoveries = useStore((s) => s.discoveries);
  const position = useStore((s) => s.position);
  const players = useStore((s) => s.players);

  if (!selectedSector) {
    return (
      <div style={{ padding: 16, textAlign: 'center', opacity: 0.4, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: 8 }}>SELECT A SECTOR</div>
        <div style={{ fontSize: '0.7rem' }}>CLICK ON THE GRID TO INSPECT</div>
      </div>
    );
  }

  const key = `${selectedSector.x}:${selectedSector.y}`;
  const sector = discoveries[key];
  const isPlayerHere = selectedSector.x === position.x && selectedSector.y === position.y;
  const isHome = selectedSector.x === 0 && selectedSector.y === 0;
  const playersHere = Object.values(players).filter(
    (p) => p.x === selectedSector.x && p.y === selectedSector.y
  );

  const sectorColor = sector
    ? (isHome
      ? SECTOR_COLORS.home_base
      : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty)
    : 'var(--color-dim)';

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: 8, color: sectorColor }}>
        SECTOR ({selectedSector.x}, {selectedSector.y})
      </div>

      {sector ? (
        <>
          <div>TYPE ──── <span style={{ color: sectorColor }}>{sector.type.toUpperCase()}</span></div>
          {sector.resources && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>RESOURCES</div>
              {Object.entries(sector.resources).map(([res, amount]) => (
                <div key={res}>{res.toUpperCase()} ──── {amount}</div>
              ))}
            </>
          )}
          {isPlayerHere && (
            <div style={{ marginTop: 8, color: 'var(--color-primary)' }}>
              YOU ARE HERE
            </div>
          )}
          {playersHere.length > 0 && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>SHIPS IN SECTOR</div>
              {playersHere.map((p) => (
                <div key={p.sessionId}>{p.username}</div>
              ))}
            </>
          )}
        </>
      ) : (
        <div style={{ opacity: 0.4 }}>UNEXPLORED</div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat(client): add DetailPanel component for sector inspection"
```

---

### Task 6: Add click-to-select on RadarCanvas

**Files:**
- Modify: `packages/client/src/components/RadarCanvas.tsx:53-95` (pointer event handlers)
- Modify: `packages/client/src/canvas/RadarRenderer.ts:54-115` (selected cell highlight)

**Step 1: Add click handler to RadarCanvas.tsx**

In the drag-pan `useEffect`, distinguish between a click (no drag movement) and a drag. If the pointer didn't move more than 5px, treat it as a cell click:

```typescript
let dragMoved = false;

const onPointerDown = (e: PointerEvent) => {
  dragging = true;
  dragMoved = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  const pan = useStore.getState().panOffset;
  panStartX = pan.x;
  panStartY = pan.y;
};

const onPointerMove = (e: PointerEvent) => {
  if (!dragging) return;
  const movedX = Math.abs(e.clientX - dragStartX);
  const movedY = Math.abs(e.clientY - dragStartY);
  if (movedX > 5 || movedY > 5) dragMoved = true;
  // ... existing drag logic
};

const onPointerUp = (e: PointerEvent) => {
  if (!dragMoved && dragging) {
    // Click — calculate which cell was clicked
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const state = useStore.getState();
      const { w: CELL_W, h: CELL_H } = CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1];
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = Math.round((clickX - centerX) / CELL_W);
      const dy = Math.round((clickY - centerY) / CELL_H);
      const viewX = state.position.x + state.panOffset.x;
      const viewY = state.position.y + state.panOffset.y;
      state.setSelectedSector({ x: viewX + dx, y: viewY + dy });
    }
  }
  dragging = false;
};
```

**Step 2: Draw selected cell highlight in RadarRenderer.ts**

Add `selectedSector` to the `RadarState` interface:

```typescript
interface RadarState {
  // ... existing fields
  selectedSector?: { x: number; y: number } | null;
}
```

Inside the cell drawing loop (after the cell border stroke), add a highlight for the selected cell:

```typescript
// Selected cell highlight
if (state.selectedSector && sx === state.selectedSector.x && sy === state.selectedSector.y) {
  ctx.strokeStyle = state.themeColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(cellX - CELL_W / 2 + 1, cellY - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2);
}
```

Pass `selectedSector` from RadarCanvas `draw` callback:

```typescript
drawRadar(ctx, {
  // ... existing fields
  selectedSector: state.selectedSector,
});
```

**Step 3: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/client/src/components/RadarCanvas.tsx packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): click-to-select grid cell with highlight"
```

---

### Task 7: Add larger grid zoom level

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts:6-10`
- Modify: `packages/client/src/state/uiSlice.ts:65` (max zoom)
- Modify: `packages/client/src/components/RadarCanvas.tsx:46` (max zoom in wheel handler)

**Step 1: Add 4th zoom level and change default**

In `RadarRenderer.ts`, update `CELL_SIZES`:

```typescript
export const CELL_SIZES = [
  { w: 48, h: 38, fontSize: 12, coordSize: 8 },
  { w: 64, h: 50, fontSize: 14, coordSize: 9 },
  { w: 80, h: 64, fontSize: 16, coordSize: 10 },
  { w: 96, h: 76, fontSize: 18, coordSize: 11 },
];
```

In `uiSlice.ts`, change default zoom level:

```typescript
zoomLevel: 2,  // was 1
```

Update max zoom in `setZoomLevel`:

```typescript
setZoomLevel: (level) => set({ zoomLevel: Math.max(0, Math.min(3, level)) }),
```

In `RadarCanvas.tsx` wheel handler, update max:

```typescript
const next = e.deltaY < 0 ? Math.min(3, current + 1) : Math.max(0, current - 1);
```

Also update the `BezelKnob` ZOOM max in `MonitorBezel.tsx`:

```typescript
<BezelKnob label="ZOOM" value={zoomLevel} min={0} max={3} onChange={(v) => setZoomLevel(Math.round(v))} />
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts packages/client/src/state/uiSlice.ts packages/client/src/components/RadarCanvas.tsx packages/client/src/components/MonitorBezel.tsx
git commit -m "feat(client): add 4th zoom level and default to larger grid cells"
```

---

### Task 8: Rewrite DesktopLayout to 3-column with split main area

**Files:**
- Modify: `packages/client/src/components/DesktopLayout.tsx` (full rewrite)
- Modify: `packages/client/src/styles/crt.css:220-280` (layout grid)

**Step 1: Rewrite DesktopLayout.tsx**

```typescript
import type { ReactNode } from 'react';
import { SidebarBezel } from './SidebarBezel';
import { ChannelButtons } from './ChannelButtons';
import { useStore } from '../state/store';
import { LEFT_SIDEBAR_MONITORS, RIGHT_SIDEBAR_MONITORS } from '@void-sector/shared';

interface DesktopLayoutProps {
  gridArea: ReactNode;
  detailArea: ReactNode;
  controlsArea: ReactNode;
  renderScreen: (monitorId: string) => ReactNode;
}

export function DesktopLayout({ gridArea, detailArea, controlsArea, renderScreen }: DesktopLayoutProps) {
  const leftSlots = useStore((s) => s.leftSidebarSlots);
  const rightSlots = useStore((s) => s.sidebarSlots);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const alerts = useStore((s) => s.alerts);

  return (
    <div className="desktop-layout-v2">
      {/* Left sidebar */}
      <div className="sidebar-stack sidebar-left">
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <ChannelButtons slotIndex={slotIndex} side="left" monitors={LEFT_SIDEBAR_MONITORS} />
            <div className="sidebar-slot-content">
              <SidebarBezel monitorId={leftSlots[slotIndex]} alert={!!alerts[leftSlots[slotIndex]]}>
                {renderScreen(leftSlots[slotIndex])}
              </SidebarBezel>
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="main-area">
        {mainMode === 'split' ? (
          <>
            <div className="main-upper">
              <div className="main-grid">{gridArea}</div>
              <div className="main-detail">{detailArea}</div>
            </div>
            <div className="main-lower">{controlsArea}</div>
          </>
        ) : (
          <div className="main-fullscreen">{renderScreen(mainMode)}</div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="sidebar-stack sidebar-right">
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <div className="sidebar-slot-content">
              <SidebarBezel monitorId={rightSlots[slotIndex]} alert={!!alerts[rightSlots[slotIndex]]}>
                {renderScreen(rightSlots[slotIndex])}
              </SidebarBezel>
            </div>
            <ChannelButtons slotIndex={slotIndex} side="right" monitors={RIGHT_SIDEBAR_MONITORS} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: Left sidebar has buttons on the LEFT of the screen content, right sidebar has buttons on the RIGHT. This mirrors the physical placement.

**Step 2: Update CSS for 3-column layout**

Replace `.desktop-layout` rules in `crt.css` with:

```css
/* 3-column desktop layout */
.desktop-layout-v2 {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
  gap: 0;
}

@media (min-width: 1024px) {
  .desktop-layout-v2 {
    grid-template-columns: auto 1fr auto;
  }

  .sidebar-left {
    display: flex;
    border-right: 2px solid #2a2a2a;
  }

  .sidebar-right {
    display: flex;
    border-left: 2px solid #2a2a2a;
  }
}

.sidebar-stack {
  display: none;
  flex-direction: column;
}

@media (min-width: 1024px) {
  .sidebar-stack {
    display: flex;
  }
}

.sidebar-left .sidebar-slot {
  flex-direction: row;
}

.sidebar-right .sidebar-slot {
  flex-direction: row;
}

.sidebar-slot {
  flex: 1;
  min-height: 0;
  display: flex;
}

.sidebar-slot + .sidebar-slot {
  border-top: 2px solid #2a2a2a;
}

.sidebar-slot-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

/* Main area split */
.main-area {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.main-upper {
  flex: 2;
  display: flex;
  min-height: 0;
}

.main-grid {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.main-detail {
  width: 320px;
  min-height: 0;
  overflow: auto;
  border-left: 2px solid #2a2a2a;
}

.main-lower {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-top: 2px solid #2a2a2a;
}

.main-fullscreen {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
```

**Step 3: Commit**

```bash
git add packages/client/src/components/DesktopLayout.tsx packages/client/src/styles/crt.css
git commit -m "feat(client): 3-column DesktopLayout with split main area"
```

---

### Task 9: Rewrite GameScreen to use new layout

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Refactor GameScreen to pass grid/detail/controls areas**

The current `NavComScreen` is split into three parts: the RadarCanvas goes to `gridArea`, the new DetailPanel to `detailArea`, and StatusBar/SectorInfo/NavControls to `controlsArea`.

```typescript
import { useEffect } from 'react';
import { MonitorBezel } from './MonitorBezel';
import { DesktopLayout } from './DesktopLayout';
import { RadarCanvas } from './RadarCanvas';
import { DetailPanel } from './DetailPanel';
import { StatusBar, SectorInfo } from './HUD';
import { NavControls } from './NavControls';
import { EventLog } from './EventLog';
import { MiningScreen } from './MiningScreen';
import { CargoScreen } from './CargoScreen';
import { CommsScreen } from './CommsScreen';
import { BaseScreen } from './BaseScreen';
import { useStore } from '../state/store';
import { MONITORS, SHIP_CLASSES } from '@void-sector/shared';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

function ShipSysScreen() {
  // ... unchanged from current
}

function renderScreen(monitorId: string) {
  switch (monitorId) {
    case MONITORS.NAV_COM: return <NavComScreen />;
    case MONITORS.LOG: return <EventLog />;
    case MONITORS.SHIP_SYS: return <ShipSysScreen />;
    case MONITORS.MINING: return <MiningScreen />;
    case MONITORS.CARGO: return <CargoScreen />;
    case MONITORS.COMMS: return <CommsScreen />;
    case MONITORS.BASE_LINK: return <BaseScreen />;
    default: return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

// Full NavCom screen (used when main is switched to NAV-COM in fullscreen mode)
function NavComScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <RadarCanvas />
      </div>
      <SectorInfo />
      <StatusBar />
      <NavControls />
    </div>
  );
}

export function GameScreen() {
  const colorProfile = useStore((s) => s.colorProfile);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const setMainMonitorMode = useStore((s) => s.setMainMonitorMode);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const clearAlert = useStore((s) => s.clearAlert);
  const alerts = useStore((s) => s.alerts);

  useEffect(() => {
    const profile = COLOR_PROFILES[colorProfile];
    document.documentElement.style.setProperty('--color-primary', profile.primary);
    document.documentElement.style.setProperty('--color-dim', profile.dim);
  }, [colorProfile]);

  // Grid area: just the radar canvas with a header
  const gridArea = (
    <MonitorBezel
      monitorId="NAV-COM"
      statusLeds={[
        { label: 'SYS', active: true },
        { label: 'NAV', active: true },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <RadarCanvas />
        </div>
      </div>
    </MonitorBezel>
  );

  // Detail area: sector inspection panel
  const detailArea = (
    <div style={{ height: '100%', background: '#050505' }}>
      <div style={{ padding: '6px 12px', fontSize: '0.75rem', letterSpacing: '0.2em', opacity: 0.6, borderBottom: '1px solid var(--color-dim)' }}>
        DETAIL
      </div>
      <DetailPanel />
    </div>
  );

  // Controls area: sector info, status bar, nav controls
  const controlsArea = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SectorInfo />
      <StatusBar />
      <NavControls />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DesktopLayout
        gridArea={gridArea}
        detailArea={detailArea}
        controlsArea={controlsArea}
        renderScreen={renderScreen}
      />

      {/* Mobile tabs (< 1024px) */}
      <div className="mobile-tabs">
        {[MONITORS.NAV_COM, MONITORS.SHIP_SYS, MONITORS.MINING, MONITORS.CARGO, MONITORS.COMMS, MONITORS.BASE_LINK].map((id) => (
          <button
            key={id}
            className={`vs-btn ${alerts[id] ? 'alert' : ''}`}
            style={{
              flex: 1,
              fontSize: '0.75rem',
              padding: '8px 2px',
              border: '2px solid var(--color-primary)',
              background: mainMode === id ? 'var(--color-primary)' : 'transparent',
              color: mainMode === id ? '#050505' : 'var(--color-primary)',
            }}
            onClick={() => {
              setActiveMonitor(id);
              if (alerts[id]) clearAlert(id);
            }}
          >
            [{id}]
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Update SidebarBezel to accept `alert` prop**

In `SidebarBezel.tsx`, add `alert?: boolean` prop and apply class:

```typescript
interface SidebarBezelProps {
  children: ReactNode;
  monitorId: string;
  alert?: boolean;
}

export function SidebarBezel({ children, monitorId, alert }: SidebarBezelProps) {
  // ...
  return (
    <div className={`bezel-frame sidebar-bezel ${alert ? 'alert' : ''}`}>
      {/* ... unchanged */}
    </div>
  );
}
```

**Step 3: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass. Some GameScreen tests may need adjustment.

**Step 4: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx packages/client/src/components/SidebarBezel.tsx
git commit -m "feat(client): GameScreen uses 3-column layout with grid/detail/controls split"
```

---

## Block D: Alert Wiring

### Task 10: Wire alert triggers for COMMS, MINING, LOG events

**Files:**
- Modify: `packages/client/src/network/client.ts` (message handlers)

**Step 1: Replace unreadComms with alerts**

In `network/client.ts`, find where `setUnreadComms(true)` is called (chat message handler) and replace with:

```typescript
// When new chat message arrives:
useStore.getState().setAlert('COMMS', true);
```

Add alert triggers for other events:

```typescript
// When mining completes (in mining state update handler):
// If mining goes from active to complete, set alert
if (miningState.complete) {
  useStore.getState().setAlert('MINING', true);
}

// When critical log event (pirate, anomaly):
// In the sector discovery / event handler:
if (sector.type === 'pirate' || sector.type === 'anomaly') {
  useStore.getState().setAlert('LOG', true);
}
```

**Step 2: Clear alerts when monitor becomes visible**

In `ChannelButtons.tsx`, the click handler already calls `clearAlert`. Also need to clear in `GameScreen` when a sidebar slot shows that monitor.

The simplest approach: clear alert in `ChannelButtons.onClick` (already done in Task 4) and in `SidebarBezel` via an effect:

```typescript
// In SidebarBezel, useEffect to clear alert when monitor is displayed:
useEffect(() => {
  const alerts = useStore.getState().alerts;
  if (alerts[monitorId]) {
    useStore.getState().clearAlert(monitorId);
  }
}, [monitorId]);
```

**Step 3: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/client/src/network/client.ts packages/client/src/components/SidebarBezel.tsx
git commit -m "feat(client): wire alert triggers for COMMS, MINING, LOG events"
```

---

### Task 11: Main area channel switching

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx` (add main area channel buttons)

**Step 1: Add a small channel bar to the main area**

Add a row of channel buttons at the top of the main area to switch between split view and fullscreen program views. This can be a simple horizontal button strip:

```typescript
// Inside GameScreen, above the DesktopLayout or as part of the main area
const mainChannelBar = (
  <div className="main-channel-bar">
    <button
      className={`channel-btn-small ${mainMode === 'split' ? 'active' : ''}`}
      onClick={() => setMainMonitorMode('split')}
    >
      NAV
    </button>
    {MAIN_MONITORS.filter(id => id !== MONITORS.NAV_COM).map((id) => (
      <button
        key={id}
        className={`channel-btn-small ${mainMode === id ? 'active' : ''} ${alerts[id] && mainMode !== id ? 'alert' : ''}`}
        onClick={() => {
          setMainMonitorMode(id);
          if (alerts[id]) clearAlert(id);
        }}
      >
        {id.slice(0, 3)}
      </button>
    ))}
  </div>
);
```

Add CSS for the horizontal channel bar:

```css
.main-channel-bar {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  background: #111;
  border-bottom: 1px solid #2a2a2a;
}

.channel-btn-small {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  color: rgba(255, 176, 0, 0.4);
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 2px;
  cursor: pointer;
  padding: 4px 12px;
  transition: all 0.1s;
}

.channel-btn-small:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.channel-btn-small.active {
  color: #050505;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.channel-btn-small.alert {
  animation: channel-blink 1s ease-in-out infinite;
  color: var(--color-primary);
  border-color: var(--color-primary);
}
```

Pass `mainChannelBar` into `DesktopLayout` and render it at the top of `.main-area`.

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx packages/client/src/components/DesktopLayout.tsx packages/client/src/styles/crt.css
git commit -m "feat(client): main area channel switching between split view and programs"
```

---

## Block E: Tests & Cleanup

### Task 12: Update existing tests + add new tests

**Files:**
- Modify: `packages/client/src/test/*.test.tsx` (update for new props/state)
- Create: `packages/client/src/test/DetailPanel.test.tsx`

**Step 1: Update existing tests**

- Update any tests that reference `unreadComms` to use `alerts`
- Update ChannelButtons tests for new `side` and `monitors` props
- Update GameScreen tests for new layout structure

**Step 2: Add DetailPanel tests**

```typescript
import { render, screen } from '@testing-library/react';
import { DetailPanel } from '../components/DetailPanel';
import { mockStoreState } from './mockStore';

describe('DetailPanel', () => {
  it('shows placeholder when no sector selected', () => {
    mockStoreState({ selectedSector: null });
    render(<DetailPanel />);
    expect(screen.getByText('SELECT A SECTOR')).toBeTruthy();
  });

  it('shows sector info when sector selected', () => {
    mockStoreState({
      selectedSector: { x: 5, y: 3 },
      discoveries: { '5:3': { x: 5, y: 3, type: 'nebula' } },
    });
    render(<DetailPanel />);
    expect(screen.getByText(/NEBULA/)).toBeTruthy();
  });

  it('shows YOU ARE HERE when at player position', () => {
    mockStoreState({
      selectedSector: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
      discoveries: { '0:0': { x: 0, y: 0, type: 'empty' } },
    });
    render(<DetailPanel />);
    expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
  });
});
```

**Step 3: Run all tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

Run: `cd packages/server && npx vitest run`
Expected: All server tests pass (no server changes in this plan).

**Step 4: Commit**

```bash
git add packages/client/src/test/
git commit -m "test(client): update tests for layout redesign v2 and add DetailPanel tests"
```

---

## Summary

| Task | Description | Block |
|------|-------------|-------|
| 1 | Add LOG monitor + sidebar/main arrays to shared constants | A |
| 2 | Add alerts, selectedSector, leftSidebarSlots, mainMonitorMode to store | A |
| 3 | Double-size channel buttons + blink animation CSS | B |
| 4 | Update ChannelButtons for alerts + left/right support | B |
| 5 | Create DetailPanel component | C |
| 6 | Click-to-select on RadarCanvas + highlight | C |
| 7 | Add larger grid zoom level, change default | C |
| 8 | Rewrite DesktopLayout to 3-column with split main | C |
| 9 | Rewrite GameScreen for new layout | C |
| 10 | Wire alert triggers (COMMS, MINING, LOG) | D |
| 11 | Main area channel switching | D |
| 12 | Update + add tests | E |
