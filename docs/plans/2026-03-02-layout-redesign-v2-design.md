# Layout-Redesign v2 — Design Document

## Goal
Redesign the game UI from a 2-column layout (main + right sidebar) to a 3-column layout (left sidebar + split main area + right sidebar) with larger channel buttons, a new Detail panel, click-to-inspect grid cells, and a blink/alert system for important events.

## Architecture
3-column CSS Grid layout. Left and right sidebars each have 2 switchable monitor slots with oversized TV-style channel buttons. The main area splits vertically: upper 2/3 = Grid (left) + Detail panel (right), lower 1/3 = navigation/actions. A store-based alert system drives blinking channel buttons and screen borders when unread events exist.

## Layout Structure

```
┌──────────────┬───────────────────────────────────────────────┬──────────┐
│  LEFT BAR    │              MAIN AREA                        │ RIGHT BAR│
│              │                                               │          │
│ ┌──────────┐ │  ┌─────────────────────┬────────────────────┐ │ ┌──────┐ │
│ │ SLOT 1   │ │  │                     │                    │ │ │SLOT 1│ │
│ │ (Log)    │ │  │      GRID           │     DETAIL         │ │ │(MIN) │ │
│ │          │ │  │   (Radar-Canvas)    │   (Sektor-Info,    │ │ │      │ │
│ │          │ │  │                     │    Scan, Mining,   │ │ │      │ │
│ │          │ │  │                     │    Station, etc.)  │ │ │      │ │
│ [████]     │ │  │                     │                    │ │ [████] │
│ [████]     │ │  ├─────────────────────┴────────────────────┤ │ [████] │
│ ├──────────┤ │  │                                          │ │ [████] │
│ │ SLOT 2   │ │  │    NAVIGATION + ACTIONS                  │ │ [████] │
│ │ (SYS)    │ │  │    (StatusBar, NavControls, SectorInfo)  │ │ [████] │
│ │          │ │  │                                          │ │ ├──────┤ │
│ │          │ │  └──────────────────────────────────────────┘ │ │SLOT 2│ │
│ [████]     │ │                                               │ │(COM) │ │
│ [████]     │ │                                               │ │      │ │
└──────────────┴───────────────────────────────────────────────┴──────────┘
```

## Design Decisions

### 1. Left Sidebar (NEW)
- 2 switchable monitor slots, identical mechanic to right sidebar
- Default: Slot 1 = LOG (EventLog), Slot 2 = SHIP-SYS
- Own ChannelButtons per slot
- Available channels: LOG, SYS, MIN, CRG, COM, BAS (LOG is new, only for left sidebar — or available everywhere)
- Persisted in localStorage as `vs-left-sidebar-slots`

### 2. Main Area — Split
- **Upper 2/3**: CSS Grid with `1fr 1fr` — Grid left, Detail panel right
- **Lower 1/3**: StatusBar, SectorInfo, NavControls (existing components, rearranged)
- Main area switchable to selected programs (e.g., show COMMS fullscreen in main) via channel buttons or keyboard shortcut
- When switched to a program, the Grid+Detail split is replaced by the selected program fullscreen

### 3. Channel Buttons — ALL DOUBLED
- All channel buttons (left + right): 64x48px (was 32x24px)
- Larger font-size: 0.7rem (was 0.45rem)
- Same TV-style aesthetic, just bigger and more readable

### 4. Grid — Larger Cells
- Default zoom level: 2 (was 1) — uses the largest existing cell size
- Add a 4th zoom level with even larger cells: `{ w: 96, h: 76, fontSize: 18, coordSize: 11 }`
- Default becomes zoom level 2 (the new level 3 is the extra-large)

### 5. Detail Panel (NEW)
- New `selectedSector` state: `{ x: number, y: number } | null`
- Clicking a grid cell sets `selectedSector`
- Detail panel shows contextual info based on selected sector:
  - Sector type, coordinates, scan results
  - Resource selection for mining
  - Station access (if station sector)
  - Trade UI (player/NPC, if in station)
  - Deep scan option
  - Other ships in sector
- Empty state: "SELECT A SECTOR" placeholder

### 6. Blink/Alert System (NEW)
- Store state: `alerts: Record<string, boolean>` (keyed by MonitorId)
- Events that trigger alerts:
  - COMMS: new chat message received (replaces current `unreadComms` dot)
  - MINING: mining operation completed
  - BASE-LINK: construction completed
  - LOG: critical event (pirate encounter, anomaly discovered)
- Alert cleared when the monitor becomes actively visible (any slot or main area)
- CSS: `@keyframes channel-blink` — pulsing glow in theme color on button + subtle border pulse on screen content

### 7. Mobile (< 1024px)
- Both sidebars hidden
- Full tab bar at bottom (existing behavior)
- Detail panel stacks below grid or accessible via tab

## State Changes
- `leftSidebarSlots: [string, string]` — new, default `['LOG', 'SHIP-SYS']`
- `selectedSector: { x: number; y: number } | null` — new
- `alerts: Record<string, boolean>` — new, replaces `unreadComms`
- `mainMonitorMode: 'split' | MonitorId` — new, default `'split'` (Grid+Detail), or a specific program fullscreen
