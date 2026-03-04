# UI Bug Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 UI bugs (#41 #42 #44 #45), increase global font size, and close related issues.

**Architecture:** Pure client-side changes — CSS, React components, Zustand UISlice, and Canvas renderer. No server changes. All fixes in `feat/nav-grid-overhaul` branch.

**Tech Stack:** React, Zustand, TypeScript, CSS, HTML Canvas, Vitest

---

### Task 1: Global font size (+12.5%)

**Files:**
- Modify: `packages/client/src/styles/global.css`

**Step 1: Add `font-size: 18px` to `:root`**

In `global.css`, find the `:root` block (line 9) and add `font-size: 18px`:

```css
:root {
  font-size: 18px;   /* ← add this line */
  --color-primary: #FFB000;
  /* ... rest unchanged ... */
}
```

**Step 2: Verify visually**

Run `npm run dev:client` and check that text throughout the UI is larger. No test needed — purely visual.

**Step 3: Commit**

```bash
git add packages/client/src/styles/global.css
git commit -m "fix: increase global font size to 18px base"
```

---

### Task 2: #41 — Fix UI growing when moving

**Files:**
- Modify: `packages/client/src/components/HUD.tsx`

**Background:** `StatusBar` and `SectorInfo` use `display: flex` without `minWidth: 0` on children. When position coordinates get longer (e.g. `(-100, 200)`), spans expand the flex container.

**Step 1: Fix StatusBar outer div**

In `HUD.tsx`, the `StatusBar` return div (around line 55) — add `minWidth: 0` and `overflow: 'hidden'`:

```tsx
<div style={{
  padding: '4px 12px',
  borderTop: '1px solid var(--color-dim)',
  borderBottom: '1px solid var(--color-dim)',
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  lineHeight: 1.8,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 16px',
  alignItems: 'center',
  minWidth: 0,       // ← add
  overflow: 'hidden', // ← add
}}>
```

**Step 2: Fix SectorInfo**

In `HUD.tsx`, the `SectorInfo` return div (around line 130) — add `minWidth: 0` and `overflow: 'hidden'`, and add `whiteSpace: 'nowrap'` to the SECTOR span:

```tsx
<div style={{
  padding: '3px 12px',
  borderTop: '1px solid var(--color-dim)',
  borderBottom: '1px solid var(--color-dim)',
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  color: 'var(--color-dim)',
  display: 'flex',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '2px 12px',
  minWidth: 0,        // ← add
  overflow: 'hidden', // ← add
}}>
  <span style={{ whiteSpace: 'nowrap' }}>SECTOR: ({position.x}, {position.y})</span>
  {/* rest unchanged */}
```

**Step 3: Verify**

Run dev server, jump to a sector far from origin like (99, -88). The HUD should not grow wider.

**Step 4: Commit**

```bash
git add packages/client/src/components/HUD.tsx
git commit -m "fix: prevent HUD flex containers from growing with long coordinates (#41)"
```

---

### Task 3: #44 — Grid labels outside the grid

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/canvas/RadarRenderer.ts` (click offset calc)
- Modify: `packages/client/src/components/RadarCanvas.tsx` (click offset)

**Background:** `FRAME_LEFT = 32` but Y-labels are drawn at `x = FRAME_LEFT - 4 = 28`, which is *inside* the grid border. Increase margins and move labels further left/below.

**Step 1: Update constants**

In `RadarRenderer.ts`, lines 41-43:

```ts
export const FRAME_LEFT = 40;   // was 32 — extra space for Y labels
export const FRAME_BOTTOM = 24; // was 20 — extra space for X labels
export const FRAME_PAD = 8;     // unchanged
```

**Step 2: Fix Y-label draw position**

In `RadarRenderer.ts`, the row-labels loop (around line 263):

```ts
// Row labels (left side) — Y galaxy coordinates
ctx.textAlign = 'right';
ctx.textBaseline = 'middle';
for (let dy = -radiusY; dy <= radiusY; dy++) {
  const sy = viewY + dy;
  const cellY = gridCenterY + dy * CELL_H;
  ctx.fillText(String(sy), FRAME_LEFT - 8, cellY); // was FRAME_LEFT - 4
}
```

**Step 3: Fix X-label draw position**

In `RadarRenderer.ts`, the column-labels loop (around line 269):

```ts
// Column labels (bottom) — X galaxy coordinates
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
for (let dx = -radiusX; dx <= radiusX; dx++) {
  const sx = viewX + dx;
  const cellX = gridCenterX + dx * CELL_W;
  ctx.fillText(String(sx), cellX, gridBottom + 4); // was gridBottom + 3
}
```

**Step 4: Update `calculateVisibleRadius`**

In `RadarRenderer.ts`, lines 14-16 (the function already uses `canvasW - 40` as a magic number — update to use the constants):

```ts
export function calculateVisibleRadius(canvasW: number, canvasH: number, zoomLevel: number): { radiusX: number; radiusY: number } {
  const { w, h } = CELL_SIZES[zoomLevel] ?? CELL_SIZES[2];
  const gridW = canvasW - FRAME_LEFT - FRAME_PAD;  // was canvasW - 40
  const gridH = canvasH - FRAME_BOTTOM - FRAME_PAD; // was canvasH - 28
  const radiusX = Math.max(2, Math.floor(gridW / w / 2));
  const radiusY = Math.max(2, Math.floor(gridH / h / 2));
  return { radiusX, radiusY };
}
```

**Step 5: Run existing RadarRenderer tests**

```bash
cd packages/client && npx vitest run src/__tests__/RadarRenderer.test.ts
```

Expected: all 5 tests pass (they test logical rendering, not pixel positions).

**Step 6: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "fix: move grid coordinate labels outside grid border (#44)"
```

---

### Task 4: #45 — Zoom level 4 (3×3 view with resource details)

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/components/RadarCanvas.tsx`
- Test: `packages/client/src/__tests__/RadarRenderer.test.ts`

**Step 1: Write failing test**

In `packages/client/src/__tests__/RadarRenderer.test.ts`, add:

```ts
it('zoom level 4 shows 3x3 grid', () => {
  const { radiusX, radiusY } = calculateVisibleRadius(600, 450, 4);
  expect(radiusX).toBe(1); // 3 cols = radius 1
  expect(radiusY).toBe(1); // 3 rows = radius 1
});
```

**Step 2: Run — verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/RadarRenderer.test.ts
```

Expected: FAIL — `calculateVisibleRadius(600, 450, 4)` currently uses `CELL_SIZES[4] ?? CELL_SIZES[2]`, falls back to zoom-2 size.

**Step 3: Add zoom level 4 support to `calculateVisibleRadius`**

In `RadarRenderer.ts`, update `calculateVisibleRadius` to handle level 4 specially:

```ts
export function calculateVisibleRadius(canvasW: number, canvasH: number, zoomLevel: number): { radiusX: number; radiusY: number } {
  if (zoomLevel === 4) {
    return { radiusX: 1, radiusY: 1 }; // always 3×3
  }
  const { w, h } = CELL_SIZES[zoomLevel] ?? CELL_SIZES[2];
  const gridW = canvasW - FRAME_LEFT - FRAME_PAD;
  const gridH = canvasH - FRAME_BOTTOM - FRAME_PAD;
  const radiusX = Math.max(2, Math.floor(gridW / w / 2));
  const radiusY = Math.max(2, Math.floor(gridH / h / 2));
  return { radiusX, radiusY };
}
```

**Step 4: Update `drawRadar` for zoom level 4 cell sizes**

At the top of `drawRadar` (around line 46), add special handling for zoom 4:

```ts
export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;

  // Zoom 4: dynamic 3×3 cell sizes
  const isDetailView = state.zoomLevel === 4;
  const cellEntry = isDetailView
    ? { w: Math.floor((w - FRAME_LEFT - FRAME_PAD) / 3), h: Math.floor((h - FRAME_BOTTOM - FRAME_PAD) / 3), fontSize: 14, coordSize: 10 }
    : (CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1]);
  const { w: CELL_W, h: CELL_H, fontSize, coordSize } = cellEntry;
  // ... rest of function unchanged
```

**Step 5: Draw detail content at zoom 4**

In `drawRadar`, find where sector labels are drawn (search for `getSectorLabel`, around line 171). After drawing the existing label, add detail rendering when `isDetailView`:

```ts
if (isDetailView && sector && cellX >= gridLeft && cellX <= gridRight) {
  const lineH = 14;
  ctx.font = `10px 'Share Tech Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let detailY = cellY + CELL_H / 2 + 6;

  // Resources
  const res = sector.resources;
  if (res) {
    if (res.ore > 0)     { ctx.fillText(`Ore: ${res.ore}`,     cellX, detailY); detailY += lineH; }
    if (res.gas > 0)     { ctx.fillText(`Gas: ${res.gas}`,     cellX, detailY); detailY += lineH; }
    if (res.crystal > 0) { ctx.fillText(`Cry: ${res.crystal}`, cellX, detailY); detailY += lineH; }
  }

  // Discovery age
  const key = `${sector.x}:${sector.y}`;
  const ts = state.discoveryTimestamps?.[key];
  if (ts) {
    const ageMs = Date.now() - ts;
    const ageH = Math.floor(ageMs / 3600000);
    const label = ageH < 1 ? '<1h' : ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`;
    ctx.fillStyle = state.dimColor;
    ctx.fillText(`~${label} ago`, cellX, detailY);
    ctx.fillStyle = cellColor; // restore
  }
}
```

Place this block **after** the existing symbol/label draw block (after the `ctx.fillText(label, ...)` line).

**Step 6: Disable pan at zoom 4 + allow zoom 4 in wheel handler**

In `RadarCanvas.tsx`, update the wheel handler:

```ts
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const current = useStore.getState().zoomLevel;
  const next = e.deltaY < 0 ? Math.min(4, current + 1) : Math.max(0, current - 1); // was min(3)
  useStore.getState().setZoomLevel(next);
};
```

In `uiSlice.ts`, line 77:

```ts
setZoomLevel: (level) => set({ zoomLevel: Math.max(0, Math.min(4, level)) }), // was min(3)
```

Also in `setPanOffset` in `uiSlice.ts` — add guard to prevent pan at zoom 4:

```ts
setPanOffset: (offset) => set((s) => {
  if (s.zoomLevel === 4) return {}; // no pan in detail view
  return {
    panOffset: {
      x: Math.max(-50, Math.min(50, Math.round(offset.x))),
      y: Math.max(-50, Math.min(50, Math.round(offset.y))),
    },
  };
}),
```

**Step 7: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/RadarRenderer.test.ts
```

Expected: all tests pass including the new zoom-4 test.

**Step 8: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts \
        packages/client/src/components/RadarCanvas.tsx \
        packages/client/src/state/uiSlice.ts \
        packages/client/src/__tests__/RadarRenderer.test.ts
git commit -m "feat: zoom level 4 — 3×3 detail view with resources and discovery age (#45)"
```

---

### Task 5: #42 — UISlice: add sidebar collapse state

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`

**Step 1: Write failing test**

In `packages/client/src/__tests__/setup.test.tsx`, add (or create a new file `packages/client/src/__tests__/uiSlice.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand';
import { createUISlice } from '../state/uiSlice';

describe('UISlice sidebar collapse', () => {
  it('defaults to both sidebars expanded', () => {
    const store = createStore(createUISlice);
    expect(store.getState().leftCollapsed).toBe(false);
    expect(store.getState().rightCollapsed).toBe(false);
  });

  it('toggles left sidebar independently', () => {
    const store = createStore(createUISlice);
    store.getState().setLeftCollapsed(true);
    expect(store.getState().leftCollapsed).toBe(true);
    expect(store.getState().rightCollapsed).toBe(false);
  });
});
```

**Step 2: Run — verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/uiSlice.test.ts
```

Expected: FAIL — `leftCollapsed` and `setLeftCollapsed` not defined.

**Step 3: Add to UISlice interface and implementation**

In `uiSlice.ts`, add to the `UISlice` interface (after line 29):

```ts
leftCollapsed: boolean;
rightCollapsed: boolean;
setLeftCollapsed: (val: boolean) => void;
setRightCollapsed: (val: boolean) => void;
```

In `createUISlice` default state (after line 61):

```ts
leftCollapsed: false,
rightCollapsed: false,
```

In `createUISlice` actions (after line 101):

```ts
setLeftCollapsed: (val) => set({ leftCollapsed: val }),
setRightCollapsed: (val) => set({ rightCollapsed: val }),
```

**Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/uiSlice.test.ts
```

Expected: 2 tests pass.

**Step 5: Commit**

```bash
git add packages/client/src/state/uiSlice.ts \
        packages/client/src/__tests__/uiSlice.test.ts
git commit -m "feat: add leftCollapsed/rightCollapsed to UISlice (#42)"
```

---

### Task 6: #42 — CSS sidebar styles (wider + collapse + CRT effect)

**Files:**
- Modify: `packages/client/src/styles/crt.css`

**Step 1: Update sidebar width from 320px to 416px**

Find the `@media (min-width: 1024px)` block with `.sidebar-left` and `.sidebar-right` (around line 264). Change width values:

```css
@media (min-width: 1024px) {
  .desktop-layout-v2 {
    grid-template-columns: auto 1fr auto;
  }

  .sidebar-left {
    display: flex;
    width: 416px;      /* was 320px */
    min-width: 416px;  /* was 320px */
    max-width: 416px;  /* was 320px */
    border-right: 2px solid #2a2a2a;
    transition: width 200ms ease, min-width 200ms ease; /* ← add */
  }

  .sidebar-right {
    display: flex;
    width: 416px;      /* was 320px */
    min-width: 416px;  /* was 320px */
    max-width: 416px;  /* was 320px */
    border-left: 2px solid #2a2a2a;
    transition: width 200ms ease, min-width 200ms ease; /* ← add */
  }
}
```

**Step 2: Add collapsed state CSS**

After the sidebar media query block, add:

```css
/* Collapsed sidebar state */
@media (min-width: 1024px) {
  .sidebar-left.collapsed {
    width: 32px;
    min-width: 32px;
    max-width: 32px;
  }

  .sidebar-right.collapsed {
    width: 32px;
    min-width: 32px;
    max-width: 32px;
  }
}

/* Hide content when collapsed */
.sidebar-left.collapsed .sidebar-slot-content,
.sidebar-right.collapsed .sidebar-slot-content {
  display: none;
}

/* Toggle button */
.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  cursor: pointer;
  background: transparent;
  border: none;
  color: var(--color-dim);
  font-size: 0.8rem;
  font-family: var(--font-mono);
  width: 100%;
  transition: color 0.1s;
}

.sidebar-toggle:hover {
  color: var(--color-primary);
}
```

**Step 3: Add CRT collapse/expand animations**

Add at the end of `crt.css`:

```css
/* CRT monitor collapse/expand animations */
@keyframes crt-collapse {
  0%   { transform: scaleX(1);    filter: brightness(1); opacity: 1; }
  50%  { transform: scaleX(0.05); filter: brightness(2); opacity: 1; }
  100% { transform: scaleX(0);    filter: brightness(0); opacity: 0; }
}

@keyframes crt-expand {
  0%   { transform: scaleX(0);    filter: brightness(2); opacity: 0; }
  50%  { transform: scaleX(0.05); filter: brightness(2); opacity: 1; }
  100% { transform: scaleX(1);    filter: brightness(1); opacity: 1; }
}

.sidebar-crt-collapse {
  animation: crt-collapse 250ms ease-in forwards;
}

.sidebar-crt-expand {
  animation: crt-expand 250ms ease-out forwards;
  transform-origin: left center;
}

.sidebar-right .sidebar-crt-collapse,
.sidebar-right .sidebar-crt-expand {
  transform-origin: right center;
}
```

**Step 4: Commit**

```bash
git add packages/client/src/styles/crt.css
git commit -m "feat: collapsible sidebar CSS — 416px wide, CRT toggle animation (#42)"
```

---

### Task 7: #42 — DesktopLayout: toggle buttons + collapse logic

**Files:**
- Modify: `packages/client/src/components/DesktopLayout.tsx`

**Step 1: Wire up collapse state and add toggle buttons**

Replace the full content of `DesktopLayout.tsx` with:

```tsx
import { useState, type ReactNode } from 'react';
import { SidebarBezel } from './SidebarBezel';
import { ChannelButtons } from './ChannelButtons';
import { useStore } from '../state/store';
import { LEFT_SIDEBAR_MONITORS, RIGHT_SIDEBAR_MONITORS } from '@void-sector/shared';

interface DesktopLayoutProps {
  gridArea: ReactNode;
  detailArea: ReactNode;
  controlsArea: ReactNode;
  mainChannelBar: ReactNode;
  renderScreen: (monitorId: string) => ReactNode;
}

export function DesktopLayout({ gridArea, detailArea, controlsArea, mainChannelBar, renderScreen }: DesktopLayoutProps) {
  const leftSlots = useStore((s) => s.leftSidebarSlots);
  const rightSlots = useStore((s) => s.sidebarSlots);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const alerts = useStore((s) => s.alerts);
  const leftCollapsed = useStore((s) => s.leftCollapsed);
  const rightCollapsed = useStore((s) => s.rightCollapsed);
  const setLeftCollapsed = useStore((s) => s.setLeftCollapsed);
  const setRightCollapsed = useStore((s) => s.setRightCollapsed);

  // Track animation state per sidebar
  const [leftAnimating, setLeftAnimating] = useState(false);
  const [rightAnimating, setRightAnimating] = useState(false);

  function toggleLeft() {
    setLeftAnimating(true);
    setTimeout(() => {
      setLeftCollapsed(!leftCollapsed);
      setLeftAnimating(false);
    }, 250);
  }

  function toggleRight() {
    setRightAnimating(true);
    setTimeout(() => {
      setRightCollapsed(!rightCollapsed);
      setRightAnimating(false);
    }, 250);
  }

  return (
    <div className="desktop-layout-v2">
      {/* Left sidebar */}
      <div className={`sidebar-stack sidebar-left${leftCollapsed ? ' collapsed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={toggleLeft}
          title={leftCollapsed ? 'Sidebar einblenden' : 'Sidebar ausblenden'}
        >
          {leftCollapsed ? '▶' : '◀'}
        </button>
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            {!leftCollapsed && (
              <ChannelButtons slotIndex={slotIndex} side="left" monitors={LEFT_SIDEBAR_MONITORS} />
            )}
            <div className={`sidebar-slot-content${leftAnimating ? (leftCollapsed ? ' sidebar-crt-expand' : ' sidebar-crt-collapse') : ''}`}>
              <SidebarBezel monitorId={leftSlots[slotIndex]} alert={!!alerts[leftSlots[slotIndex]]}>
                {renderScreen(leftSlots[slotIndex])}
              </SidebarBezel>
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="main-area">
        {mainChannelBar}
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
      <div className={`sidebar-stack sidebar-right${rightCollapsed ? ' collapsed' : ''}`}>
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <div className={`sidebar-slot-content${rightAnimating ? (rightCollapsed ? ' sidebar-crt-expand' : ' sidebar-crt-collapse') : ''}`}>
              <SidebarBezel monitorId={rightSlots[slotIndex]} alert={!!alerts[rightSlots[slotIndex]]}>
                {renderScreen(rightSlots[slotIndex])}
              </SidebarBezel>
            </div>
            {!rightCollapsed && (
              <ChannelButtons slotIndex={slotIndex} side="right" monitors={RIGHT_SIDEBAR_MONITORS} />
            )}
          </div>
        ))}
        <button
          className="sidebar-toggle"
          onClick={toggleRight}
          title={rightCollapsed ? 'Sidebar einblenden' : 'Sidebar ausblenden'}
        >
          {rightCollapsed ? '◀' : '▶'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run all client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all 118+ tests pass.

**Step 3: Verify manually**

Start dev client, click `◀` on left sidebar → CRT squish, sidebar collapses to 32px strip. Click `▶` → CRT expand, sidebar back to 416px. Both sides independent.

**Step 4: Commit**

```bash
git add packages/client/src/components/DesktopLayout.tsx
git commit -m "feat: independent collapsible sidebars with CRT toggle effect (#42)"
```

---

### Task 8: Close issues + run full test suite + push

**Step 1: Run full test suite**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

All must pass.

**Step 2: Close completed issues**

```bash
gh issue close 41 --comment "Fixed in feat/nav-grid-overhaul: min-width: 0 on HUD flex containers"
gh issue close 44 --comment "Fixed in feat/nav-grid-overhaul: FRAME_LEFT 32→40px, labels now outside grid border"
gh issue close 42 --comment "Fixed in feat/nav-grid-overhaul: sidebars 416px, independently collapsible with CRT effect"
gh issue close 45 --comment "Fixed in feat/nav-grid-overhaul: zoom level 4 = 3×3 with ore/gas/crystal + discovery age"
gh issue close 30 --comment "Implemented in earlier commit: renameShip + renameBase handlers"
gh issue close 31 --comment "Implemented: guest mode with GAST-XXXX accounts, 24h expiry"
```

**Step 3: Push**

```bash
git push
```

Expected output shows `feat/nav-grid-overhaul` updated on remote.
