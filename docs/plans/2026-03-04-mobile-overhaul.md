# Mobile Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all game screens accessible on mobile with context-aware tabs, zoom controls, and touch fixes (Issue #49).

**Architecture:** Extend existing CSS-only breakpoint (1024px) with context-aware MOBILE_TABS, a "MEHR" overflow overlay, +/− zoom buttons on the radar, and touch-action fixes on the canvas. No new layout system, no JS breakpoint detection.

**Tech Stack:** React, Zustand, CSS media queries, Pointer Events API

---

### Task 1: Context-Aware Mobile Tabs

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx:365-477`
- Modify: `packages/client/src/state/gameSlice.ts` (add `moreOverlayOpen`)

**Step 1: Add `moreOverlayOpen` state to gameSlice**

In `packages/client/src/state/gameSlice.ts`, add to the interface (after `activeMonitor: string;`):
```typescript
  moreOverlayOpen: boolean;
```
Add to the `setActiveMonitor` line area:
```typescript
  setMoreOverlayOpen: (open: boolean) => void;
```
Add default:
```typescript
  moreOverlayOpen: false,
```
Add setter:
```typescript
  setMoreOverlayOpen: (moreOverlayOpen) => set({ moreOverlayOpen }),
```

**Step 2: Rewrite MOBILE_TABS and add context-aware logic**

In `packages/client/src/components/GameScreen.tsx`, replace the `MOBILE_TABS` constant and the mobile tabs section in the JSX.

Replace the static MOBILE_TABS (line 365-372) with a function:
```typescript
function useMobileTabs(): Array<{ id: string; icon: string; label: string }> {
  const currentSector = useStore((s) => s.currentSector);
  const isStation = currentSector?.type === 'station';

  return [
    { id: MONITORS.NAV_COM,   icon: '◉', label: 'NAV' },
    { id: MONITORS.SHIP_SYS,  icon: '⚙', label: 'SHIP' },
    isStation
      ? { id: MONITORS.TRADE,  icon: '₿', label: 'TRADE' }
      : { id: MONITORS.CARGO,  icon: '▤', label: 'CARGO' },
    { id: MONITORS.COMMS,     icon: '⌘', label: 'COMMS' },
    { id: 'MORE',             icon: '⋯', label: 'MEHR' },
  ];
}
```

**Step 3: Add MobileMoreOverlay component**

In `GameScreen.tsx`, add before the `GameScreen` component:
```typescript
const MORE_SCREENS: Array<{ id: string; icon: string; label: string }> = [
  { id: MONITORS.LOG,       icon: '▤', label: 'LOG' },
  { id: MONITORS.MINING,    icon: '⛏', label: 'MINING' },
  { id: MONITORS.QUESTS,    icon: '!', label: 'QUESTS' },
  { id: MONITORS.FACTION,   icon: '⚑', label: 'FRAKTION' },
  { id: MONITORS.BASE_LINK, icon: '⌂', label: 'BASE' },
  { id: MONITORS.CARGO,     icon: '▤', label: 'CARGO' },
  { id: MONITORS.TRADE,     icon: '₿', label: 'TRADE' },
];

function MobileMoreOverlay() {
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const setMoreOverlayOpen = useStore((s) => s.setMoreOverlayOpen);
  const clearAlert = useStore((s) => s.clearAlert);
  const alerts = useStore((s) => s.alerts);
  const currentSector = useStore((s) => s.currentSector);
  const isStation = currentSector?.type === 'station';

  // Filter out screens already in the main tab bar
  const hiddenFromMain = isStation ? MONITORS.CARGO : MONITORS.TRADE;
  const screens = MORE_SCREENS.filter(s =>
    // Always show LOG, MINING, QUESTS, FACTION, BASE
    // Show CARGO when TRADE replaced it (station), show TRADE when not at station
    s.id !== (isStation ? MONITORS.TRADE : MONITORS.CARGO)
  );

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 5, 5, 0.95)', zIndex: 900,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24,
      }}
      onClick={() => setMoreOverlayOpen(false)}
    >
      <div style={{
        color: 'var(--color-primary)', letterSpacing: '0.2em',
        fontSize: '0.85rem', marginBottom: 16,
      }}>
        MONITORS
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, width: '100%', maxWidth: 320,
      }}>
        {screens.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMonitor(id);
              setMoreOverlayOpen(false);
              if (alerts[id]) clearAlert(id);
            }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, padding: '12px 8px',
              minHeight: 64,
              background: 'transparent',
              border: `1px solid ${alerts[id] ? 'var(--color-primary)' : '#333'}`,
              color: alerts[id] ? 'var(--color-primary)' : '#888',
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              cursor: 'pointer', letterSpacing: '0.05em',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => setMoreOverlayOpen(false)}
        style={{
          marginTop: 16, background: 'transparent',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem', padding: '8px 24px', cursor: 'pointer',
        }}
      >
        [SCHLIESSEN]
      </button>
    </div>
  );
}
```

**Step 4: Update GameScreen JSX to use context-aware tabs**

In the `GameScreen` component, add:
```typescript
  const moreOverlayOpen = useStore((s) => s.moreOverlayOpen);
  const setMoreOverlayOpen = useStore((s) => s.setMoreOverlayOpen);
  const mobileTabs = useMobileTabs();
```

Replace the mobile tabs JSX (lines 463-477) with:
```tsx
      {/* Mobile tabs (< 1024px) */}
      <div className="mobile-tabs">
        {mobileTabs.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`mobile-tab-btn${activeMonitor === id ? ' active' : ''}${id !== 'MORE' && alerts[id] ? ' alert' : ''}${id === 'MORE' && Object.keys(alerts).some(k => alerts[k] && !mobileTabs.find(t => t.id === k)) ? ' alert' : ''}`}
            onClick={() => {
              if (id === 'MORE') {
                setMoreOverlayOpen(!moreOverlayOpen);
              } else {
                setActiveMonitor(id);
                setMoreOverlayOpen(false);
                if (alerts[id]) clearAlert(id);
              }
            }}
          >
            <span className="mobile-tab-icon">{icon}</span>
            <span className="mobile-tab-label">{label}</span>
          </button>
        ))}
      </div>
      {moreOverlayOpen && <MobileMoreOverlay />}
```

**Step 5: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All 125 tests pass

**Step 6: Commit**

```
feat: context-aware mobile tabs with MEHR overflow overlay (#49)
```

---

### Task 2: Mobile Zoom Buttons

**Files:**
- Modify: `packages/client/src/components/RadarCanvas.tsx:127-137`
- Modify: `packages/client/src/styles/crt.css` (add zoom button styles)

**Step 1: Add zoom button CSS**

Append to `packages/client/src/styles/crt.css`:
```css
/* Mobile zoom controls */
.mobile-zoom-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

@media (min-width: 1024px) {
  .mobile-zoom-controls {
    display: none;
  }
}

.mobile-zoom-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  font-family: var(--font-mono);
  font-size: 1.2rem;
  cursor: pointer;
  line-height: 1;
}

.mobile-zoom-btn:active {
  background: var(--color-primary);
  color: #000;
}
```

**Step 2: Add zoom buttons to RadarCanvas**

In `packages/client/src/components/RadarCanvas.tsx`, the component currently returns just a `<canvas>`. Wrap it in a container and add zoom buttons.

Replace the return (lines 127-136) with:
```tsx
  const handleZoomIn = useCallback(() => {
    const current = useStore.getState().zoomLevel;
    useStore.getState().setZoomLevel(Math.min(4, current + 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    const current = useStore.getState().zoomLevel;
    useStore.getState().setZoomLevel(Math.max(0, current - 1));
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
        }}
      />
      <div className="mobile-zoom-controls">
        <button className="mobile-zoom-btn" onClick={handleZoomIn}>+</button>
        <button className="mobile-zoom-btn" onClick={handleZoomOut}>−</button>
      </div>
    </div>
  );
```

Note: `touchAction: 'none'` is also added to the canvas style here (Task 3 touch fix).

**Step 3: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```
feat: mobile zoom +/− buttons on radar canvas (#49)
```

---

### Task 3: Canvas Touch Fixes

**Files:**
- Modify: `packages/client/src/components/RadarCanvas.tsx:61-125`

**Step 1: Add double-tap detection**

In the pointer events useEffect (line 62), add double-tap tracking variables after the drag variables:
```typescript
    let lastTapTime = 0;
```

Then modify the `onPointerUp` handler. After the existing click logic (after `state.setSelectedSector(...)` on line 108), add double-tap detection before the final `dragging = false`:
```typescript
      // Double-tap to recenter
      const now = Date.now();
      if (!dragMoved && now - lastTapTime < 300) {
        useStore.getState().resetPan();
      }
      lastTapTime = now;
```

The `dblclick` handler can stay as a fallback for desktop mice.

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```
fix: add double-tap recenter and touch-action on radar canvas (#49)
```

---

### Task 4: FrequencyMinigame Touch Slider

**Files:**
- Modify: `packages/client/src/components/FrequencyMinigame.tsx:72-99`

**Step 1: Add touch slider**

In `FrequencyMinigame.tsx`, add a range input after the canvas and before the match percentage display. Replace lines 87-98 (from after the canvas closing tag to the instruction text) with:

```tsx
      <input
        type="range"
        min={0.5}
        max={10}
        step={0.1}
        value={playerFreq}
        onChange={(e) => setPlayerFreq(Number(e.target.value))}
        style={{
          width: '100%', maxWidth: 280, display: 'block', margin: '8px auto 0',
          accentColor: '#FFB000',
        }}
      />
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.8rem' }}>
        <span style={{ color: matchPercent >= FREQUENCY_MATCH_THRESHOLD ? '#00FF88' : '#FFB000' }}>
          MATCH: {Math.floor(matchPercent * 100)}%
        </span>
        {matchPercent >= FREQUENCY_MATCH_THRESHOLD && (
          <span style={{ color: '#00FF88' }}> — LOCK ACQUIRED</span>
        )}
      </div>
      {matchPercent >= FREQUENCY_MATCH_THRESHOLD && (
        <button
          onClick={() => onComplete(true)}
          style={{
            display: 'block', margin: '8px auto 0', background: 'transparent',
            border: '1px solid #00FF88', color: '#00FF88',
            fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
            padding: '6px 16px', cursor: 'pointer',
          }}
        >
          [LOCK BESTÄTIGEN]
        </button>
      )}
      <div style={{ fontSize: '0.65rem', textAlign: 'center', opacity: 0.4, marginTop: 4 }}>
        SLIDER oder ← → zum Tunen | ESC zum Abbrechen
      </div>
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass (FrequencyMinigame tests exist)

**Step 3: Commit**

```
feat: touch slider for frequency minigame (#49)
```

---

### Task 5: CSS Polish & Touch Targets

**Files:**
- Modify: `packages/client/src/styles/crt.css`

**Step 1: Improve mobile tab touch targets**

In `crt.css`, update `.mobile-tab-btn` (line 504). Change `min-height: 52px` to `min-height: 48px` and ensure adequate padding. This is already close to spec. Just verify.

**Step 2: Add `.mobile-more-overlay` class (optional cleanup)**

If we want CSS separation, we can move the overlay inline styles to CSS. However, since inline styles work fine and keep it self-contained, this is optional.

**Step 3: Run ALL tests**

Run:
```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run
```
Expected: All pass (179 + 125 + 18 = 322)

**Step 4: Final commit**

```
fix: mobile CSS polish and touch targets (#49)
```

---

### Task 6: Manual Mobile Testing

**Not automated — verify by hand in browser DevTools mobile emulation:**

- [ ] Open Chrome DevTools → Toggle device toolbar → iPhone 14 (390px)
- [ ] NAV tab shows radar with +/− zoom buttons
- [ ] SHIP tab shows ship schematic
- [ ] CARGO tab shows cargo (when not at station)
- [ ] At station: CARGO slot becomes TRADE
- [ ] COMMS tab shows chat
- [ ] MEHR tab opens overlay with LOG, MINING, QUESTS, FACTION, BASE, CARGO/TRADE
- [ ] Selecting a monitor from MEHR overlay switches and closes
- [ ] Alert badges appear on MEHR when hidden screens have alerts
- [ ] Zoom +/− buttons change radar zoom level
- [ ] Double-tap on radar recenters
- [ ] Drag on radar pans without page scroll
- [ ] FrequencyMinigame slider works via touch
