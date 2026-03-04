# Mobile Overhaul Design — Issue #49

## Context

voidSector uses a single CSS breakpoint at 1024px. Below that, a mobile layout shows one monitor at a time via bottom tab bar. Current problems:
- TRADE, FACTION, QUESTS screens unreachable on mobile (not in tab bar)
- No zoom control on mobile (BezelKnob is desktop-only, no pinch-to-zoom)
- FrequencyMinigame keyboard/mousewheel-only — broken on touch
- No `touch-action: none` on canvas — scroll conflicts possible
- No double-tap-to-recenter on radar

## Approach: Kontext-Aware Tab-Gruppen

Extend existing architecture with context-aware tabs and touch fixes. No new layout system, no tablet breakpoint, no `useMobile` hook.

## 1. Tab-Gruppen Navigation

### Fixed Tabs (5 slots, always visible)

| Slot | Default | Context Swap |
|------|---------|--------------|
| 1 | NAV | — |
| 2 | SHIP | — |
| 3 | CARGO | At station → TRADE |
| 4 | COMMS | — |
| 5 | MEHR | — (opens overlay) |

### Context Rules
- **Station sector**: Slot 3 shows TRADE instead of CARGO (indicator dot for swap)
- **Active battle**: BattleDialog stays as modal overlay (already works)
- **Active mining**: Mining status shown as badge in NAV tab

### "MEHR" Overflow Overlay
- CRT-styled fullscreen overlay (`position: fixed`, `z-index: 900`)
- Grid of buttons: LOG, MINING, QUESTS, FACTION, TRADE (if not in main tab), CARGO (if swapped out)
- Close via X button or tap outside
- Alert badge on MEHR button when any hidden screen needs attention

### Tab Design
- Same CRT aesthetic, compact icons
- Alert dots (orange pulse) preserved
- Active tab: `border-bottom` highlight
- `min-height: 48px` touch targets

## 2. Zoom & Touch Controls

### Zoom Buttons
- +/− buttons as semi-transparent overlay, top-right of radar canvas
- Only visible below 1024px (CSS media query)
- Style: `border: 1px solid var(--color-primary)`, `background: rgba(0,0,0,0.7)`
- Tap changes `zoomLevel` ±1 (same Zustand state as BezelKnob)

### Canvas Touch Fixes
- Add `touch-action: none` on canvas element
- Double-tap detection: 2x `pointerup` within 300ms → `resetPan()`
- Existing pointer-drag for pan stays unchanged

### FrequencyMinigame
- Add horizontal `<input type="range">` slider for touch frequency control
- Keyboard controls remain (no regression)
- Slider visible on all devices

## 3. Other Mobile Fixes

### Alert System
- Existing alert badges work on current tabs
- MEHR button gets aggregate badge when any hidden screen has alerts

### Rendering
- Desktop + Mobile always rendered (CSS `display:none` toggle) — no change
- No conditional rendering to avoid state loss on resize

### CSS
- Tab buttons: `min-height: 48px`
- MEHR overlay: `position: fixed`, full viewport, `z-index: 900`
- Zoom buttons: `position: absolute` within canvas container

### No Changes To
- Desktop layout (unchanged)
- Breakpoint (stays 1024px)
- Existing monitor components (reused in new tabs)

## Files Expected to Change

| File | Changes |
|------|---------|
| `packages/client/src/styles/crt.css` | Mobile zoom button styles, MEHR overlay styles, tab touch targets |
| `packages/client/src/components/GameScreen.tsx` | Context-aware MOBILE_TABS, MEHR overlay component, zoom buttons |
| `packages/client/src/canvas/RadarCanvas.tsx` | `touch-action: none`, double-tap detection |
| `packages/client/src/components/FrequencyMinigame.tsx` | Touch slider control |
| `packages/client/src/state/uiSlice.ts` | `moreOverlayOpen` state (if needed) |
