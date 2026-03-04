# Phase 6 & 7 Design: UI-Polish + Modularer Schiffsdesigner

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan.

**Goal:** Polish the game UI (Phase 6) and build a modular ship designer with hangar system (Phase 7).

**Issues covered:** #16, #17, #25, #27, #28, #29 (Phase 6), #19, #30 (Phase 7)

---

## Phase 6: UI-Polish

### 6.1 HUD Compact Layout (#28)

Merge StatusBar and SectorInfo into 2 compact lines using full width:

```
AP: 100/100 █████████████ 0.5/s | FUEL: 7/100 █░░░░░░░░░░░░
SECTOR: (3, -5)  ASTEROID  PILOTS: 2  ORIGIN: 847
```

- AP and Fuel on one line, larger font (0.8rem)
- Sector info on second line
- Warnings (TANK LEER, NIEDRIG) replace fuel right-side when active
- Single compact block, no separate borders between AP and Sector

**Files:** `HUD.tsx`

### 6.2 Refuel at Base (#29)

Expand server refuel condition: allow refuel when `sectorType === 'station'` OR when player owns a `base` structure in the current sector. Same price as stations.

**Files:** `SectorRoom.ts` (handleRefuel), `DetailPanel.tsx` (refuel button condition)

### 6.3 Monitor Alignment (#27)

Consistent padding (8px 12px) in all monitors. Labels left-aligned, values right-aligned with monospace tabular layout:

```
ION DRIVE ────── RANGE: 4
CARGO HOLD ───── CAP:   5
SCANNER ──────── LEVEL: 1
```

**Files:** `ShipSysScreen` (in GameScreen.tsx), `MiningScreen.tsx`, `CargoScreen.tsx`, etc.

### 6.4 Consistent Bezel Buttons (#25)

Unified layout for all bezels:
- **Left top**: Monitor ID label
- **Left bottom**: Context buttons (varies by monitor)
- **Right top**: Status LEDs
- **Right bottom**: ON/OFF toggle

Move Auto-Follow toggle from DetailPanel overlay to NAV-COM bezel frame.

**Files:** `MonitorBezel.tsx`, `SidebarBezel.tsx`, `GameScreen.tsx`

### 6.5 UI Tweaks (#16)

- **Vignette**: Weaken from 65%→100% to 75%→100% gradient
- **Fixed monitor widths**: Sidebars 320px (already set), verify consistency
- **Scrollbars**: Already CRT-styled, verify consistency across all monitors

**Files:** `crt.css`

### 6.6 Mining Detail Update (#17)

- DetailPanel shows live mining status when mining in current sector
- Resource display updates with mining rate indicator
- Nav-lock during mining already implemented

**Files:** `DetailPanel.tsx`

---

## Phase 7: Modular Ship Designer

### 7.1 Core Concept

Each ship = **Hull** (preset) + **Module Slots**. Hull determines base shape and stats. Modules modify stats.

### 7.2 Hull Classes

| Hull | Size | Slots | Base Fuel | Base Cargo | Base Jump | Base AP/J | Character |
|---|---|---|---|---|---|---|---|
| Scout | Small | 3 | 80 | 3 | 5 | 1 | Fast, agile |
| Freighter | Medium | 4 | 120 | 15 | 3 | 2 | Hauler |
| Cruiser | Medium | 4 | 150 | 8 | 4 | 1 | Allrounder |
| Explorer | Large | 5 | 200 | 10 | 6 | 1 | Discovery |
| Battleship | Large | 5 | 180 | 5 | 2 | 2 | Combat |

Hulls unlock via level or credits. Players start with Scout.

### 7.3 Module Types

| Type | Effect | Tiers | MK I | MK II | MK III |
|---|---|---|---|---|---|
| Drive | +Jump Range, -AP/Jump | I–III | +1 range | +2 range, -0.2 AP | +3 range, -0.5 AP |
| Cargo Bay | +Cargo Cap | I–III | +5 | +12 | +25 |
| Scanner | +Scanner Level, +Comm Range | I–III | +1 lvl | +1 lvl, +50 comm | +2 lvl, +100 comm |
| Armor | +HP, pirate damage reduction | I–III | +25 HP | +50 HP, -10% dmg | +100 HP, -25% dmg |
| Special | Unique effects | Unique | Cloak, Auto-Miner, Fuel Recycler, etc. |

Modules purchased at stations (credits + resources) or earned as quest rewards.

### 7.4 Stat Calculation

```
Final Stats = Hull Base + Σ Module Bonuses
```

### 7.5 Visual: Schematic Drawing (CRT Style)

SHIP-SYS monitor displays technical top-down schematic:

```
     ╱╲
    ╱  ╲
   ╱ SC ╲        VOID SCOUT "AEGIS"
  ┌──────┐       ─────────────────────
  │ DRIV │       HULL:    SCOUT
  │  II  │       DRIVE:   ION MK.II
  ├──────┤       CARGO:   STANDARD MK.I
  │CARGO │       SCANNER: BASIC MK.I
  │  I   │       ARMOR:   NONE
  ├──────┤       SPECIAL: NONE
  │ SCAN │       ─────────────────────
  │  I   │       FUEL: 80  CARGO: 8
  └──┬┬──┘       JUMP: 7   AP/J: 1
     ││           SCAN: 1   HP: 50
     ╲╱
```

**Radar**: Ship rendered as small 3x3/5x5 symbol derived from hull type (Scout=arrow, Freighter=rectangle, etc.).

**Detail Panel**: Other players show compact ship icon + name.

### 7.6 Hangar System

- Players can own multiple ships
- Ships stored in **Hangar** at base
- Switch active ship: only at own base
- Build new ship: buy hull + install modules (at station or base)

**Database:**
```sql
CREATE TABLE ships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  hull_type TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  modules JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, active) WHERE active = true  -- only one active ship
);
```

### 7.7 Ship & Base Rename (#30)

- Ships get custom name (max 20 chars)
- Base gets custom name (max 20 chars)
- Visible in SHIP-SYS monitor, radar (tooltip), detail panel

**Database:**
- `ships.name` column (already in schema above)
- `players.base_name TEXT DEFAULT ''` column addition

### 7.8 Module Purchase Flow

1. Player docks at station or is at own base
2. Opens SHIP-SYS monitor → [MODULES] button
3. Sees available modules with cost (credits + resources)
4. Buys module → goes to ship inventory
5. Installs module into empty slot → stats recalculate
6. Can swap/remove modules (removed goes back to inventory)

### 7.9 Ship Icons for Radar

Each hull type has a distinct 3x3 pixel pattern for the radar canvas:

```
Scout:      Freighter:   Cruiser:     Explorer:    Battleship:
  ▲           ■■           ◆           ▽▽            ██
 ▲▲          ■■■■         ◆◆◆          ▽▽▽          ████
  ▲           ■■          ◆◆           ▽▽▽▽         ████
                                        ▽▽           ██
```

Rendered in player's color profile primary color. Own ship highlighted.
