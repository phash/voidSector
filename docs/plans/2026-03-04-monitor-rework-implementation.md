# Monitor Rework — Cockpit Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the 3-column sidebar layout with a fixed 6-section cockpit layout per issue #107.

**Architecture:** New `CockpitLayout.tsx` replaces `DesktopLayout.tsx`. Fixed grid: program-selector (1), main+detail monitors (2+3), settings (4), navigation (5), comms (6). Programs only switch sections 2+3. Sections 4-6 are permanent. New detail panels for CARGO, TRADE, MINING, QUESTS. Canvas test-pattern for programs without detail.

**Tech Stack:** React, Zustand, CSS Grid, Canvas API, Vitest + RTL

---

## Task 1: Add `activeProgram` to UI Store + New Monitor Constants

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/client/src/state/uiSlice.ts`

Add `COCKPIT_PROGRAMS` constant listing all selectable programs. Add `activeProgram` state to uiSlice (replaces `mainMonitorMode` for desktop). Persist to localStorage.

**shared/constants.ts — append after `MAIN_ONLY_MONITORS`:**

```typescript
/** Programs selectable in Section 1 of the cockpit layout */
export const COCKPIT_PROGRAMS: MonitorId[] = [
  MONITORS.NAV_COM,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.BASE_LINK,
  MONITORS.TRADE,
  MONITORS.FACTION,
  MONITORS.QUESTS,
  MONITORS.TECH,
  MONITORS.QUAD_MAP,
  MONITORS.LOG,
];

/** Labels for cockpit program buttons */
export const COCKPIT_PROGRAM_LABELS: Record<string, string> = {
  'NAV-COM': 'NAV',
  'MINING': 'MIN',
  'CARGO': 'CRG',
  'BASE-LINK': 'BAS',
  'TRADE': 'TRD',
  'FACTION': 'FAC',
  'QUESTS': 'QST',
  'TECH': 'TEC',
  'QUAD-MAP': 'MAP',
  'LOG': 'LOG',
  'MODULES': 'MOD',
  'HANGAR': 'HNG',
};
```

Note: MODULES and HANGAR are NOT new monitor IDs — they are sub-modes of SHIP-SYS. We keep SHIP-SYS out of the cockpit programs list and instead add 'MODULES' and 'HANGAR' as virtual programs in the `CockpitLayout` only. The `renderScreen()` function will handle them.

**uiSlice.ts — add to interface and implementation:**

```typescript
// In UISlice interface, add:
activeProgram: string;
setActiveProgram: (program: string) => void;

// In createUISlice, add:
activeProgram: safeGetItem('vs-active-program') || 'NAV-COM',
setActiveProgram: (program) => {
  safeSetItem('vs-active-program', program);
  set({ activeProgram: program });
},
```

**Test:** `packages/client/src/__tests__/cockpitStore.test.ts` — verify activeProgram defaults, persists, and updates.

**Commit:** `feat: add activeProgram state and COCKPIT_PROGRAMS constant (#107)`

---

## Task 2: Create TestPattern Canvas Component

**Files:**
- Create: `packages/client/src/components/TestPattern.tsx`

Canvas-rendered analog test pattern for detail monitors with no content. Classic color bars, grayscale, "KEIN SIGNAL" text, animated noise.

```tsx
import { useRef, useEffect } from 'react';

const COLORS = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000'];

export function TestPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      const w = canvas!.width = canvas!.offsetWidth;
      const h = canvas!.height = canvas!.offsetHeight;
      if (w === 0 || h === 0) return;

      // Color bars (top 60%)
      const barH = h * 0.6;
      const barW = w / COLORS.length;
      COLORS.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(i * barW, 0, barW + 1, barH);
      });

      // Grayscale ramp (middle 15%)
      const grayH = h * 0.15;
      const grayY = barH;
      for (let i = 0; i < 16; i++) {
        const v = Math.round((i / 15) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect((i / 16) * w, grayY, w / 16 + 1, grayH);
      }

      // Black area with "KEIN SIGNAL" (bottom 25%)
      const bottomY = grayY + grayH;
      const bottomH = h - bottomY;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, bottomY, w, bottomH);

      // Text
      ctx.font = `bold ${Math.max(14, w * 0.04)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#aaa';
      ctx.fillText('KEIN SIGNAL', w / 2, bottomY + bottomH * 0.5);

      // Noise overlay
      const now = performance.now();
      ctx.globalAlpha = 0.06 + Math.sin(now / 300) * 0.02;
      const imageData = ctx.createImageData(w, Math.min(bottomH, 40));
      for (let i = 0; i < imageData.data.length; i += 4) {
        const v = Math.random() * 255;
        imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = v;
        imageData.data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, bottomY + bottomH - 40);
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      data-testid="test-pattern"
    />
  );
}
```

**Test:** `packages/client/src/__tests__/TestPattern.test.tsx` — renders without error, canvas element present.

**Commit:** `feat: add TestPattern canvas component (#107)`

---

## Task 3: Create ProgramSelector Component (Section 1)

**Files:**
- Create: `packages/client/src/components/ProgramSelector.tsx`
- Create: `packages/client/src/__tests__/ProgramSelector.test.tsx`

Vertical button strip with LED indicators. Each button selects a program for sections 2+3.

```tsx
import { useStore } from '../state/store';
import { COCKPIT_PROGRAMS, COCKPIT_PROGRAM_LABELS } from '@void-sector/shared';

const EXTRA_PROGRAMS = ['MODULES', 'HANGAR'];

export function ProgramSelector() {
  const activeProgram = useStore((s) => s.activeProgram);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const alerts = useStore((s) => s.alerts);

  const allPrograms = [...COCKPIT_PROGRAMS, ...EXTRA_PROGRAMS];

  return (
    <div className="program-selector" data-testid="program-selector">
      {allPrograms.map((id) => {
        const isActive = activeProgram === id;
        const hasAlert = !!alerts[id];
        const label = COCKPIT_PROGRAM_LABELS[id] ?? id.slice(0, 3);
        return (
          <button
            key={id}
            className={`program-btn${isActive ? ' active' : ''}${hasAlert ? ' alert' : ''}`}
            data-testid={`program-btn-${id}`}
            onClick={() => setActiveProgram(id)}
          >
            <span className={`program-led${hasAlert ? ' blink' : ''}${isActive ? ' on' : ''}`} />
            <span className="program-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**Test:** Renders all 12 buttons. Clicking sets activeProgram. Active button has `.active` class. Alert LED blinks.

**Commit:** `feat: add ProgramSelector component (#107)`

---

## Task 4: Create SettingsPanel Component (Section 4)

**Files:**
- Create: `packages/client/src/components/SettingsPanel.tsx`

Compact settings: player name, color profile, brightness/contrast, logout.

```tsx
import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

export function SettingsPanel() {
  const username = useStore((s) => s.username);
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);
  const brightness = useStore((s) => s.brightness);
  const setBrightness = useStore((s) => s.setBrightness);
  const setScreen = useStore((s) => s.setScreen);

  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const handleRename = () => {
    if (nameValue.trim() && nameValue.length <= 20) {
      network.sendRenamePlayer?.(nameValue.trim());
      setRenaming(false);
    }
  };

  const handleLogout = () => {
    try { localStorage.removeItem('vs_token'); } catch {}
    setScreen('login');
    window.location.reload();
  };

  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--color-dim)',
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    padding: '2px 4px',
  };

  return (
    <div className="settings-panel" data-testid="settings-panel">
      <div className="settings-header">SYSTEM</div>

      {/* Player name */}
      <div className="settings-row">
        {renaming ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, maxWidth: 100 }}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value.slice(0, 20))}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              maxLength={20} autoFocus placeholder="Name..."
            />
            <button className="vs-btn-sm" onClick={handleRename}>OK</button>
            <button className="vs-btn-sm" onClick={() => setRenaming(false)}>X</button>
          </div>
        ) : (
          <button className="vs-btn-sm" onClick={() => { setRenaming(true); setNameValue(username || ''); }}>
            {username || 'PILOT'}
          </button>
        )}
      </div>

      {/* Color profile */}
      <div className="settings-row">
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{ ...inputStyle, width: '100%' }}
        >
          {Object.keys(COLOR_PROFILES).map((name) => (
            <option key={name} value={name}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Brightness */}
      <div className="settings-row">
        <label className="settings-label">BRT</label>
        <input
          type="range" min={0.3} max={1.5} step={0.1}
          value={brightness}
          onChange={(e) => setBrightness(parseFloat(e.target.value))}
          className="settings-slider"
        />
      </div>

      {/* Logout */}
      <button className="vs-btn-danger" onClick={handleLogout} data-testid="logout-btn">
        VERLASSEN
      </button>
    </div>
  );
}
```

**Test:** Renders player name, color profile dropdown, brightness slider, logout button. Logout clears token.

**Commit:** `feat: add SettingsPanel component (#107)`

---

## Task 5: Create New Detail Panels (CARGO, TRADE, MINING, QUESTS)

**Files:**
- Create: `packages/client/src/components/CargoDetailPanel.tsx`
- Create: `packages/client/src/components/TradeDetailPanel.tsx`
- Create: `packages/client/src/components/MiningDetailPanel.tsx`
- Create: `packages/client/src/components/QuestDetailPanel.tsx`
- Modify: `packages/client/src/state/gameSlice.ts` — add `selectedCargoItem`, `selectedQuest`

These are lightweight detail panels. Each reads a selection state from the store and displays details.

**gameSlice.ts additions:**

```typescript
// In GameSlice interface:
selectedCargoItem: string | null;
selectedQuest: string | null;
setSelectedCargoItem: (item: string | null) => void;
setSelectedQuest: (questId: string | null) => void;

// In createGameSlice:
selectedCargoItem: null,
selectedQuest: null,
setSelectedCargoItem: (item) => set({ selectedCargoItem: item }),
setSelectedQuest: (questId) => set({ selectedQuest: questId }),
```

**CargoDetailPanel.tsx** — shows selected cargo item info (resource type, quantity, value estimate, jettison button).

**MiningDetailPanel.tsx** — shows current sector resources, mining status, yield rates, mining history.

**TradeDetailPanel.tsx** — shows selected trade item price at current station, player cargo/storage amounts, buy/sell quick action.

**QuestDetailPanel.tsx** — shows selected quest full description, all objectives with progress, rewards breakdown, abandon button.

Each panel shows "AUSWAHL TREFFEN" prompt when nothing is selected, using the same CRT monospace styling as existing detail panels.

**Test:** Each panel renders empty state + selected state.

**Commit:** `feat: add detail panels for cargo, trade, mining, quests (#107)`

---

## Task 6: Create HardwareControls Component

**Files:**
- Create: `packages/client/src/components/HardwareControls.tsx`

Reusable hardware button strip for the blue areas below each monitor. Configurable: D-Pad, zoom slider, power button, channel buttons.

```tsx
interface HardwareControlsProps {
  /** Show D-Pad (up/down/left/right) */
  dpad?: boolean;
  onDpad?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  /** Show zoom slider */
  zoom?: boolean;
  zoomValue?: number;
  onZoom?: (level: number) => void;
  /** Show power button */
  power?: boolean;
  powerOn?: boolean;
  onPower?: () => void;
  /** Show channel buttons */
  channels?: string[];
  activeChannel?: string;
  onChannel?: (channel: string) => void;
}
```

Renders a horizontal strip of hardware-styled controls. Uses CSS classes `hw-controls`, `hw-dpad`, `hw-slider`, `hw-power-btn`, `hw-channel-btn`.

**Test:** Renders configured controls. D-Pad fires callbacks. Power toggles.

**Commit:** `feat: add HardwareControls reusable component (#107)`

---

## Task 7: Create CockpitLayout Component + CSS

**Files:**
- Create: `packages/client/src/components/CockpitLayout.tsx`
- Modify: `packages/client/src/styles/crt.css` — add cockpit grid classes

This is the core component. CSS Grid with 6 sections.

**CSS grid:**

```css
.cockpit-layout {
  display: grid;
  grid-template-columns: 120px 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0;
  height: 100%;
  min-height: 0;
  background: #0a0a0a;
}

.cockpit-sec1 { grid-column: 1; grid-row: 1; }
.cockpit-sec2 { grid-column: 2; grid-row: 1; }
.cockpit-sec3 { grid-column: 3; grid-row: 1; }
.cockpit-sec4 { grid-column: 1; grid-row: 2; }
.cockpit-sec5 { grid-column: 2; grid-row: 2; }
.cockpit-sec6 { grid-column: 3; grid-row: 2; }

/* Each section is a flex column: monitor area + hardware strip */
.cockpit-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 2px solid #1a1a1a;
}

.cockpit-monitor {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cockpit-hw-strip {
  flex-shrink: 0;
  border-top: 2px solid #1a1a1a;
  background: #0d0d0d;
  padding: 4px 8px;
}
```

**CockpitLayout.tsx:**

```tsx
import { useStore } from '../state/store';
import { ProgramSelector } from './ProgramSelector';
import { SettingsPanel } from './SettingsPanel';
import { HardwareControls } from './HardwareControls';
import { TestPattern } from './TestPattern';
import { UnifiedBezel } from './UnifiedBezel';

// Import all screens
import { DetailPanel } from './DetailPanel';
import { TechDetailPanel } from './TechDetailPanel';
import { BaseDetailPanel } from './BaseDetailPanel';
import { CargoDetailPanel } from './CargoDetailPanel';
import { TradeDetailPanel } from './TradeDetailPanel';
import { MiningDetailPanel } from './MiningDetailPanel';
import { QuestDetailPanel } from './QuestDetailPanel';
import { CommsScreen } from './CommsScreen';
// ... all other screen imports

interface CockpitLayoutProps {
  renderScreen: (monitorId: string) => ReactNode;
}

function getDetailForProgram(programId: string): ReactNode {
  switch (programId) {
    case 'NAV-COM': return <DetailPanel />;
    case 'TECH': return <TechDetailPanel />;
    case 'BASE-LINK': return <BaseDetailPanel />;
    case 'CARGO': return <CargoDetailPanel />;
    case 'TRADE': return <TradeDetailPanel />;
    case 'MINING': return <MiningDetailPanel />;
    case 'QUESTS': return <QuestDetailPanel />;
    default: return <TestPattern />;
  }
}

export function CockpitLayout({ renderScreen }: CockpitLayoutProps) {
  const activeProgram = useStore((s) => s.activeProgram);
  const chatChannel = useStore((s) => s.chatChannel);
  const setChatChannel = useStore((s) => s.setChatChannel);
  // ... zoom, pan state for hardware controls

  const mainContent = renderScreen(activeProgram);
  const detailContent = getDetailForProgram(activeProgram);

  return (
    <div className="cockpit-layout">
      {/* Section 1: Program Selector */}
      <div className="cockpit-sec1 cockpit-section">
        <ProgramSelector />
      </div>

      {/* Section 2: Main Monitor */}
      <div className="cockpit-sec2 cockpit-section">
        <div className="cockpit-monitor">
          <UnifiedBezel variant="sidebar" monitorId={activeProgram}>
            {mainContent}
          </UnifiedBezel>
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls
            dpad
            onDpad={handleDpad}
            zoom
            zoomValue={zoomLevel}
            onZoom={setZoomLevel}
          />
        </div>
      </div>

      {/* Section 3: Detail Monitor */}
      <div className="cockpit-sec3 cockpit-section">
        <div className="cockpit-monitor">
          <UnifiedBezel variant="sidebar" monitorId="DETAIL">
            {detailContent}
          </UnifiedBezel>
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls power powerOn={detailPowerOn} onPower={handleDetailPower} />
        </div>
      </div>

      {/* Section 4: Settings */}
      <div className="cockpit-sec4 cockpit-section">
        <SettingsPanel />
      </div>

      {/* Section 5: Navigation */}
      <div className="cockpit-sec5 cockpit-section">
        <div className="cockpit-monitor">
          {/* SectorInfo + StatusBar + NavControls + ShipStatusPanel + CombatStatusPanel */}
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls dpad onDpad={handleNavDpad} />
        </div>
      </div>

      {/* Section 6: Communication */}
      <div className="cockpit-sec6 cockpit-section">
        <div className="cockpit-monitor">
          <CommsScreen />
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls
            channels={['direct', 'faction', 'local', 'sector', 'quadrant']}
            activeChannel={chatChannel}
            onChannel={setChatChannel}
          />
        </div>
      </div>
    </div>
  );
}
```

**Test:** `packages/client/src/__tests__/CockpitLayout.test.tsx` — all 6 sections render, program switching changes main+detail content, settings panel present, comms panel present.

**Commit:** `feat: add CockpitLayout component with CSS grid (#107)`

---

## Task 8: Update renderScreen for MODULES and HANGAR

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`

Add `MODULES` and `HANGAR` as virtual program cases in `renderScreen()`. Remove `ShipSysScreen` and `NavComScreen` from renderScreen (NAV-COM now renders RadarCanvas directly from CockpitLayout's gridArea pattern).

```typescript
// In renderScreen(), add cases:
case 'MODULES': return <ModulePanel />;
case 'HANGAR': return <HangarPanel />;

// For NAV-COM, simplify — the CockpitLayout wraps it in a UnifiedBezel,
// so no need for the NavComScreen wrapper with its own controls.
case MONITORS.NAV_COM: return (
  <div style={{ display: 'flex', height: '100%' }}>
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <RadarCanvas />
    </div>
    <BookmarkBar />
  </div>
);
```

Remove `ShipSysScreen`, `NavComScreen`, `TechScreen`, `BaseSplitScreen` from GameScreen — their layout is now handled by `CockpitLayout`'s section 2+3 split.

**Commit:** `feat: update renderScreen for cockpit layout (#107)`

---

## Task 9: Wire CockpitLayout into GameScreen

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`

Replace `<DesktopLayout>` with `<CockpitLayout>` in the desktop view. Keep mobile layout unchanged.

```tsx
// In GameScreen, replace DesktopLayout usage:
<CockpitLayout renderScreen={renderScreen} />

// Remove: gridArea, detailArea, controlsArea, mainChannelBar definitions
// Remove: getBezelConfig callback (COMMS mode now handled by HardwareControls in section 6)
// Remove: SHIP_SYS_MODES, ShipSysScreen, SettingsView (moved to SettingsPanel)
// Keep: all dialog overlays, mobile layout, mobile tabs
```

**Test:** Run full client test suite. Update any broken tests referencing old layout.

**Commit:** `feat: wire CockpitLayout into GameScreen (#107)`

---

## Task 10: CSS Styling + Polish

**Files:**
- Modify: `packages/client/src/styles/crt.css`

Style all new components:

- `.program-selector` — dark panel, vertical flex, 100% height
- `.program-btn` — full-width, monospace, border-bottom, hover/active states
- `.program-led` — 6px circle, positioned left of label, color states (off/on/blink)
- `.settings-panel` — compact, dark background, gap between rows
- `.vs-btn-sm` — small variant button
- `.vs-btn-danger` — red border/text variant
- `.hw-controls` — horizontal flex, gap 4px, dark bg
- `.hw-dpad` — 2x2 grid of small arrow buttons
- `.hw-slider` — styled range input
- `.hw-power-btn` — round button with LED dot
- `.hw-channel-btn` — toggle button, active state highlighted
- `.cockpit-section` borders — subtle glow on active section

**Commit:** `feat: style cockpit layout components (#107)`

---

## Task 11: Clean Up Removed Components

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx` — remove dead code
- Modify: `packages/client/src/state/uiSlice.ts` — deprecate sidebar state (keep for mobile)
- Modify: `packages/client/src/styles/crt.css` — remove unused sidebar/desktop-layout classes
- DO NOT delete: `DesktopLayout.tsx`, `ChannelButtons.tsx` — may still be used by mobile or as fallback

Remove from GameScreen:
- `ShipSysScreen`, `SettingsView`, `SHIP_SYS_MODES`
- `NavComScreen` (if fully replaced)
- `TechScreen`, `BaseSplitScreen` (layout now in CockpitLayout)
- `mainChannelBar`, `gridArea`, `detailArea`, `controlsArea` variables
- `getBezelConfig` callback
- COMMS_MODES constant (channel switching now via hardware buttons)

Clean up CSS:
- Mark `.desktop-layout-v2`, `.main-area`, `.main-upper`, `.main-lower`, `.main-fullscreen`, `.main-grid`, `.main-detail`, `.main-channel-bar`, `.sidebar-stack`, `.sidebar-slot`, `.channel-buttons` as deprecated (comment, don't delete — mobile still uses some)

**Test:** Full test suite passes. No runtime errors.

**Commit:** `refactor: clean up dead code from old layout (#107)`

---

## Task 12: Final Verification

**Files:** None (verification only)

1. `cd packages/shared && npx vitest run` — all pass
2. `cd packages/server && npx vitest run` — all pass
3. `cd packages/client && npx vitest run` — all pass
4. `cd packages/client && npx tsc --noEmit` — no new errors (pre-existing ChannelButtons error OK)
5. Docker rebuild + manual smoke test:
   - All 12 programs selectable via Section 1
   - NAV shows radar + DetailPanel in section 3
   - TECH shows TechTreePanel + TechDetailPanel
   - BASE shows BaseOverview + BaseDetailPanel
   - CARGO/TRADE/MINING/QUESTS show new detail panels
   - FACTION/QUAD-MAP/LOG/MODULES/HANGAR show test pattern in section 3
   - Section 4 settings functional (color profile, brightness, logout)
   - Section 5 nav controls always visible
   - Section 6 comms with channel hardware buttons
   - CRT effects (scanlines, vignette, flicker) on sections 2+3
   - Alert LEDs blink on program buttons
   - Mobile layout unchanged

**Commit:** None (verification only)

---

## Implementation Order & Dependencies

```
Task 1 (store + constants) — independent, start first
Task 2 (TestPattern)       — independent
Task 3 (ProgramSelector)   — depends on Task 1
Task 4 (SettingsPanel)     — independent
Task 5 (Detail panels)     — depends on Task 1 (store state)
Task 6 (HardwareControls)  — independent
Task 7 (CockpitLayout)     — depends on Tasks 1-6
Task 8 (renderScreen)      — depends on Task 7
Task 9 (Wire into GameScreen) — depends on Tasks 7, 8
Task 10 (CSS)              — depends on Tasks 3, 4, 6, 7
Task 11 (Cleanup)          — depends on Task 9
Task 12 (Verification)     — depends on all
```

**Parallel tracks:**
- Track A: Task 1 → Task 3 → Task 7
- Track B: Task 2, Task 4, Task 5, Task 6 (all independent)
- Merge: Task 7 (needs all of Track A + B)
- Sequential: Task 8 → Task 9 → Task 10 → Task 11 → Task 12
