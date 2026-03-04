# Monitor Rework — Cockpit Layout Design

> **Issue:** #107 — Monitore Rework
> **Goal:** Replace the current 3-column sidebar layout with a fixed 6-section cockpit layout. Reduce complexity from 5+ configurable monitors to a clear, hardware-inspired UI.

## Layout Overview

```
┌──────┬────────────────────────┬────────────────────────┐
│      │                        │                        │
│  1   │          2             │          3             │
│ PROG │    Main Window         │    Detail View         │
│ WAHL │    (Software)          │    (Software)          │
│      │                        │                        │
│      ├───[HW: D-Pad + Zoom]──┤───[HW: Power]──────────┤
├──────┼────────────────────────┼────────────────────────┤
│      │                        │                        │
│  4   │          5             │          6             │
│ SET- │    Navigation          │    Kommunikation       │
│ TINGS│    (fest)              │    (fest)              │
│      │                        │                        │
│      ├───[HW: D-Pad]─────────┤───[HW: Channel-Btns]──┤
└──────┴────────────────────────┴────────────────────────┘
```

**Legend:**
- Red border (wireframe) = Hardware frame — always visible, never changes
- Green area = Software display (program content)
- Blue area = Hardware buttons/sliders below each monitor

## Section 1: Program Selection Panel

Vertical button strip, left side of upper row. One button per program, all equal width. Each button has an LED indicator that blinks on unread events.

**Programs (12 total, excludes COMMS and Settings):**

| Button | Program | Monitor ID |
|--------|---------|------------|
| NAV | Radar + Navigation | NAV-COM |
| MIN | Mining Operations | MINING |
| CRG | Cargo Hold | CARGO |
| BAS | Base Management | BASE-LINK |
| TRD | Trading | TRADE |
| FAC | Faction | FACTION |
| QST | Quests | QUESTS |
| TEC | Tech Tree | TECH |
| MAP | Quadrant Map | QUAD-MAP |
| LOG | Event Log | LOG |
| MOD | Ship Modules | MODULES (new, was SHIP-SYS/modules) |
| HNG | Ship Hangar | HANGAR (new, was SHIP-SYS/hangar) |

Click switches content of sections 2+3. Active button highlighted. LED pulses on events (combat result, new quest, etc.).

## Section 2: Main Window

Large primary display. Shows the main content of the selected program. Wrapped in CRT bezel (scanlines, vignette, flicker).

**Hardware buttons below (blue area):**
- **D-Pad** (up/down/left/right): Context-dependent
  - NAV: Pan the radar map
  - List programs (TECH, BASE, CARGO, etc.): Scroll through / select items
- **Zoom slider** (multi-step): NAV = radar zoom. Others = inactive or font-size

## Section 3: Detail View

Right detail display. Shows context-dependent detail panel or a test pattern when no detail is available. Wrapped in CRT bezel.

**Program → Detail mapping:**

| Program | Detail Panel | Notes |
|---------|-------------|-------|
| NAV | DetailPanel | Sector info, station info, refuel, jumpgate |
| TECH | TechDetailPanel | Module details + research actions |
| BASE | BaseDetailPanel | Building details + actions (storage/factory/kontor) |
| CARGO | **CargoDetailPanel** (new) | Selected item details, quantity, value |
| TRADE | **TradeDetailPanel** (new) | Price info, availability, profit calculation |
| MINING | **MiningDetailPanel** (new) | Resource distribution, mining progress, yield stats |
| QUESTS | **QuestDetailPanel** (new) | Full description, rewards, progress |
| FACTION | Test pattern | — |
| QUAD-MAP | Test pattern | — |
| LOG | Test pattern | — |
| MODULES | Test pattern | — |
| HANGAR | Test pattern | — |

**Hardware buttons below (blue area):**
- **Power button** (right side): CRT shutdown animation for detail monitor. LED: green=on, orange=standby.

## Section 4: Settings Panel

Fixed content, bottom-left. Compact settings panel (not a CRT monitor — functional hardware panel):

- **Player name** (display, click to edit)
- **Color Profile** dropdown (Amber Classic / Green Phosphor / Ice Blue / High Contrast)
- **Opacity slider**
- **Contrast slider**
- **[SPIEL VERLASSEN]** button (logout/disconnect)

## Section 5: Navigation Panel

Fixed content, always visible. Contains everything currently in `controlsArea`:

- **SectorInfo**: Coordinates, sector type, pilot count, distance
- **StatusBar**: AP bar + regen, Fuel bar, Hyperdrive charge, Credits, Alien Credits
- **NavControls**: Jump arrows (↑←↓→), [LOCAL SCAN], [AREA SCAN], Build buttons, Hyperdrive status, Emergency Warp
- **ShipStatusPanel**: Ship name, hull, equipped modules, key stats
- **CombatStatusPanel**: Weapon, shield, defense, ECM, damage modifier

**Hardware buttons below (blue area):**
- Optional D-Pad as physical nav buttons (redundant to software buttons, but fits hardware aesthetic)

## Section 6: Communication Panel

Fixed content, always visible. Full CommsScreen with all 5 channels.

**Hardware buttons below (blue area):**
- Channel toggle buttons: DIRECT | FACTION | LOCAL | SECTOR | QUADRANT
- Physical hardware buttons instead of software dropdown

## Test Pattern Component

Canvas-rendered analog test pattern for detail monitors with no content:

- Classic color bars (top section)
- Grayscale ramp (middle)
- "KEIN SIGNAL" text (center)
- CRT noise/flicker overlay
- Animated static/snow effect

## What Gets Removed

- `DesktopLayout.tsx` — replaced by `CockpitLayout.tsx`
- `ChannelButtons.tsx` — no longer needed (program selection moves to Section 1)
- `SidebarBezel.tsx` — no sidebars
- Sidebar slot state (`leftSidebarSlots`, `sidebarSlots`, `leftCollapsed`, `rightCollapsed`)
- `mainMonitorMode` split/fullscreen distinction — always split (2+3)
- `mainChannelBar` — replaced by Section 1 buttons
- `MAIN_ONLY_MONITORS` concept — no sidebars to redirect from
- `ShipSysScreen` container — Settings → Section 4, Modules/Hangar → separate programs
- `SHIP_SYS_MODES` — no longer needed

## What Stays

- `renderScreen()` logic (maps program ID → component)
- UnifiedBezel CRT effects (reused for sections 2, 3, 5, 6 monitors)
- All program components (MiningScreen, CargoScreen, etc.)
- All dialog overlays (BattleDialog, CombatV2Dialog, etc.)
- Mobile layout (unchanged, separate issue)
- Alert system (LEDs on Section 1 buttons)
- Store structure (gameSlice, uiSlice)

## New Components

| Component | Purpose |
|-----------|---------|
| `CockpitLayout.tsx` | New 6-section grid layout |
| `ProgramSelector.tsx` | Section 1: vertical button strip with LEDs |
| `HardwarePanel.tsx` | Reusable hardware button strip (D-Pad, sliders, power) |
| `TestPattern.tsx` | Canvas test pattern for empty detail monitors |
| `CargoDetailPanel.tsx` | Detail panel for CARGO program |
| `TradeDetailPanel.tsx` | Detail panel for TRADE program |
| `MiningDetailPanel.tsx` | Detail panel for MINING program |
| `QuestDetailPanel.tsx` | Detail panel for QUESTS program |
| `SettingsPanel.tsx` | Section 4: fixed settings panel |

## State Changes

- Remove: `leftSidebarSlots`, `sidebarSlots`, `leftCollapsed`, `rightCollapsed`
- Remove: `mainMonitorMode` (no split/fullscreen distinction)
- Add: `activeProgram: string` (which program is selected in Section 1)
- Keep: `alerts`, `monitorPower`, `monitorChromeVisible`, `chatChannel`
- Keep: `selectedTechModule`, `selectedBaseStructure`
- Add: `selectedCargoItem`, `selectedTradeItem`, `selectedMiningResource`, `selectedQuest`

## Mobile

Unchanged for now. Separate issue. Current mobile tab system continues to work with `renderScreen()`.
