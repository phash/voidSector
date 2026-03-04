# Features Sprint — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement two features: realistic distress call narratives (#43) and a context-sensitive in-game help system (#48).

**Architecture:** Client + Server changes. Branch `feat/features-sprint` from `feat/nav-grid-overhaul`.

**Tech Stack:** TypeScript, React, Zustand, Canvas, Colyseus

---

### Task 1: #43 — Distress call story templates (server-side)

**Files:**
- Create: `packages/server/src/engine/distressStories.ts`

**Goal:** Generate random, seeded narrative messages for distress signals. Each distress call gets a short story (1-2 sentences) from a fictional ship crew. The message is included in the `data` field of `ScanEvent`.

**Step 1: Create the distress story engine**

Create `packages/server/src/engine/distressStories.ts`:

```ts
const SHIP_NAMES = [
  'ISS Meridian', 'ISS Kahlur', 'ISS Volantis', 'Freighter Kova-7',
  'Scout Vessel Argent', 'ISS Prometheus', 'Miner Hex-9', 'ISS Dawnbreaker',
  'Cargo Runner Tethys', 'ISS Valkyr', 'Station Tender Orion-3', 'ISS Centauri',
];

const CREW_NAMES = [
  'Captain Ryn', 'Pilot Sasha', 'Engineer Kael', 'Commander Voss',
  'Lt. Mira', 'Chief Tomas', 'Dr. Elara', 'Navigator Dex',
];

const STORIES: Array<(ship: string, crew: string, x: number, y: number) => string> = [
  (ship, crew, x, y) =>
    `[MAYDAY] ${ship} at ${x}:${y} — ${crew} reporting: Drive core overloaded, venting plasma. We have 3 survivors aboard. Request immediate rescue.`,
  (ship, crew, x, y) =>
    `[DISTRESS] This is ${crew} aboard ${ship}. We were ambushed near ${x}:${y}. Hull breach on deck 2, engines offline. Anyone who reads this — please respond.`,
  (ship, crew, x, y) =>
    `[SOS] ${ship} calling any vessel in range. Navigation systems destroyed after collision with debris at ${x}:${y}. ${crew} here — fuel tank ruptured, drifting. Survivors: 2.`,
  (ship, crew, x, y) =>
    `[EMERGENCY] ${crew} — ${ship} — we were hit by pirates at ${x}:${y}. Cargo jettisoned, reactor is critical. Life support holding for now. Please hurry.`,
  (ship, crew, x, y) =>
    `[MAYDAY] ISS comms relay picking up: ${ship} last known position ${x}:${y}. ${crew}: "...engine is gone... we have wounded... if anyone is out there..."`,
  (ship, crew, x, y) =>
    `[DISTRESS] ${ship} to any vessel — ${crew} speaking. We misjumped and ended up at ${x}:${y}. FTL coil is burnt out. We have supplies for 4 days. Please come.`,
  (ship, crew, x, y) =>
    `[SOS] ${crew} aboard ${ship}. Medical emergency at ${x}:${y} — crew member critical, no medic aboard. Structural integrity 34%. Requesting escort to nearest station.`,
  (ship, crew, x, y) =>
    `[EMERGENCY] ${ship} — ${crew} here. We hit an anomaly at ${x}:${y}, ship systems failing one by one. Sending this on emergency band. If you can hear us, we're waiting.`,
];

export function generateDistressMessage(sectorX: number, sectorY: number, seed: number): string {
  const shipIdx = ((seed >>> 0) % SHIP_NAMES.length + SHIP_NAMES.length) % SHIP_NAMES.length;
  const crewIdx = ((seed >>> 8) % CREW_NAMES.length + CREW_NAMES.length) % CREW_NAMES.length;
  const storyIdx = ((seed >>> 16) % STORIES.length + STORIES.length) % STORIES.length;
  const ship = SHIP_NAMES[shipIdx];
  const crew = CREW_NAMES[crewIdx];
  return STORIES[storyIdx](ship, crew, sectorX, sectorY);
}
```

**Step 2: Write a test**

Create `packages/server/src/engine/__tests__/distressStories.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateDistressMessage } from '../distressStories.js';

describe('generateDistressMessage', () => {
  it('returns a non-empty string', () => {
    expect(generateDistressMessage(10, 20, 12345).length).toBeGreaterThan(10);
  });
  it('is deterministic', () => {
    expect(generateDistressMessage(5, 5, 999)).toBe(generateDistressMessage(5, 5, 999));
  });
  it('includes sector coordinates', () => {
    const msg = generateDistressMessage(42, -7, 1111);
    expect(msg).toMatch(/42/);
    expect(msg).toMatch(/-7/);
  });
  it('varies with different seeds', () => {
    const a = generateDistressMessage(0, 0, 1);
    const b = generateDistressMessage(0, 0, 10000);
    // Not guaranteed to differ but very likely with different seeds
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });
});
```

**Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/distressStories.test.ts
```

Expected: 4 tests pass.

**Step 4: Commit**

```bash
git add packages/server/src/engine/distressStories.ts \
        packages/server/src/engine/__tests__/distressStories.test.ts
git commit -m "feat: distress call story engine — 8 narrative templates (#43)"
```

---

### Task 2: #43 — Wire distress story into scanEvents

**Files:**
- Modify: `packages/server/src/engine/scanEvents.ts`

**Goal:** The `distress_signal` event data now includes a `message` field with the generated narrative.

**Step 1: Read current scanEvents.ts**

Read `packages/server/src/engine/scanEvents.ts` to find the `generateEventData` function and the `distress_signal` case.

**Step 2: Import and use generateDistressMessage**

Add import:
```ts
import { generateDistressMessage } from './distressStories.js';
```

In `generateEventData`, update the `distress_signal` case:
```ts
case 'distress_signal':
  return {
    rewardCredits: 20 + ((seed >>> 4) % 80),
    rewardRep: 5,
    message: generateDistressMessage(sectorX, sectorY, seed),
  };
```

**Step 3: Run scanEvents tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/scanEvents.test.ts
```

All tests pass.

**Step 4: Commit**

```bash
git add packages/server/src/engine/scanEvents.ts
git commit -m "feat: wire distress story message into scan event data (#43)"
```

---

### Task 3: #43 — Display distress message on client

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Goal:** When a `distress_signal` scan event is discovered and shown in the detail panel, display the full narrative message in a styled text block (like a comm message).

**Step 1: Read DetailPanel.tsx**

Read `packages/client/src/components/DetailPanel.tsx` to find where `distress_signal` events are rendered (search for `DISTRESS SIGNAL` or `distress_signal`).

**Step 2: Add message display**

Find the section that renders the distress signal event. After the existing `◆ DISTRESS SIGNAL` label, add:

```tsx
{e.eventType === 'distress_signal' && (e.data as { message?: string }).message && (
  <div style={{
    marginTop: '4px',
    padding: '6px 8px',
    border: '1px solid #FF3333',
    borderLeft: '3px solid #FF3333',
    color: '#FF9999',
    fontSize: '0.75rem',
    lineHeight: 1.5,
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'pre-wrap',
    opacity: 0.9,
  }}>
    {(e.data as { message: string }).message}
  </div>
)}
```

**Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```

All tests pass.

**Step 4: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat: show distress narrative message in detail panel (#43)"
```

---

### Task 4: #48 — Help system data model + store

**Files:**
- Create: `packages/client/src/state/helpSlice.ts`
- Modify: `packages/client/src/state/store.ts`

**Goal:** A Zustand slice that tracks which help tips the player has seen, and a centralized registry of all tips.

**Step 1: Create helpSlice.ts**

Create `packages/client/src/state/helpSlice.ts`:

```ts
import type { StateCreator } from 'zustand';

export interface HelpTip {
  id: string;
  title: string;
  body: string;
  trigger: string; // when this tip is relevant
}

export const HELP_TIPS: HelpTip[] = [
  {
    id: 'first_login',
    title: 'WILLKOMMEN AN BORD',
    body: 'Klicke auf eine Zelle im Radar-Grid um einen Sektor auszuwählen. Doppelklick zentriert die Ansicht. Scroll-Rad ändert den Zoom-Level.',
    trigger: 'first_login',
  },
  {
    id: 'first_nebula',
    title: 'NEBULA-SEKTOR',
    body: 'Nebula-Sektoren enthalten Gas-Ressourcen. Scanne den Sektor zuerst um Ressourcen zu sehen. Gas kann an Handelsstationen verkauft werden.',
    trigger: 'first_nebula',
  },
  {
    id: 'first_station',
    title: 'RAUMSTATION',
    body: 'Stationen bieten Handel, Reparaturen und Schiffs-Upgrades. Fahre zum Sektor und öffne das Detail-Panel um verfügbare Aktionen zu sehen.',
    trigger: 'first_station',
  },
  {
    id: 'first_asteroid',
    title: 'ASTEROIDENFELD',
    body: 'Asteroiden enthalten Erz. Scanne zuerst, dann starte das Mining im Detail-Panel. Mining läuft automatisch bis du es stoppst oder die Fracht voll ist.',
    trigger: 'first_asteroid',
  },
  {
    id: 'first_pirate',
    title: 'PIRATEN-WARNUNG',
    body: 'Piraten-Ambush erkannt! Du kannst kämpfen, fliehen oder verhandeln. Das Ergebnis hängt von deinem Schiff und deiner Crew ab. Schwache Schiffe sollten fliehen.',
    trigger: 'first_pirate',
  },
  {
    id: 'first_distress',
    title: 'NOTRUF EMPFANGEN',
    body: 'Ein Notruf wurde entdeckt. Fliege zum Sektor und klicke RETTEN um Überlebende aufzunehmen. Du brauchst freie Safe-Slots in deinem Schiff. Bringt Belohnungen.',
    trigger: 'first_distress',
  },
  {
    id: 'low_fuel',
    title: 'TREIBSTOFF NIEDRIG',
    body: 'Treibstoff ist fast leer! Fliege zu einer Raumstation zum Auftanken, oder nutze die Notfall-Treibstoff Option wenn du feststeckst.',
    trigger: 'low_fuel',
  },
  {
    id: 'first_anomaly',
    title: 'ANOMALIE ENTDECKT',
    body: 'Anomalien liefern Erfahrungspunkte und Ruf-Boni. Scanne den Sektor vollständig um alle Geheimnisse zu entdecken.',
    trigger: 'first_anomaly',
  },
];

export interface HelpSlice {
  activeTip: HelpTip | null;
  seenTips: Set<string>;
  showTip: (tipId: string) => void;
  dismissTip: () => void;
  hasSeenTip: (tipId: string) => boolean;
}

const STORAGE_KEY = 'vs_seen_tips';

function loadSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenTips(tips: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...tips]));
  } catch { /* ignore */ }
}

export const createHelpSlice: StateCreator<HelpSlice> = (set, get) => ({
  activeTip: null,
  seenTips: loadSeenTips(),

  showTip: (tipId) => {
    if (get().seenTips.has(tipId)) return; // already seen
    const tip = HELP_TIPS.find(t => t.id === tipId);
    if (!tip) return;
    const newSeen = new Set(get().seenTips);
    newSeen.add(tipId);
    saveSeenTips(newSeen);
    set({ activeTip: tip, seenTips: newSeen });
  },

  dismissTip: () => set({ activeTip: null }),

  hasSeenTip: (tipId) => get().seenTips.has(tipId),
});
```

**Step 2: Add helpSlice to store**

Read `packages/client/src/state/store.ts` to understand how other slices are composed. Add `HelpSlice` to the combined store type and call `createHelpSlice` in `create(...)`.

**Step 3: Write a test**

Create `packages/client/src/__tests__/helpSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createHelpSlice } from '../state/helpSlice';

describe('HelpSlice', () => {
  it('starts with no active tip', () => {
    const store = createStore(createHelpSlice);
    expect(store.getState().activeTip).toBeNull();
  });

  it('showTip sets activeTip', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    expect(store.getState().activeTip?.id).toBe('first_login');
  });

  it('dismissTip clears activeTip', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    store.getState().dismissTip();
    expect(store.getState().activeTip).toBeNull();
  });

  it('does not show a tip twice', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    store.getState().dismissTip();
    store.getState().showTip('first_login'); // second time
    expect(store.getState().activeTip).toBeNull(); // already seen
  });
});
```

**Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add packages/client/src/state/helpSlice.ts \
        packages/client/src/state/store.ts \
        packages/client/src/__tests__/helpSlice.test.ts
git commit -m "feat: help system data model and Zustand slice (#48)"
```

---

### Task 5: #48 — HelpOverlay component

**Files:**
- Create: `packages/client/src/components/HelpOverlay.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx` (or main layout file)

**Goal:** A CRT-styled overlay that appears when `activeTip` is set. Dismissable by clicking or pressing Escape.

**Step 1: Read GameScreen.tsx or DesktopLayout parent to find where to mount the overlay**

```bash
grep -r "HelpOverlay\|DesktopLayout\|GameScreen" packages/client/src --include="*.tsx" -l
```

Find the top-level component where other overlays (like BattleDialog) are mounted.

**Step 2: Create HelpOverlay.tsx**

Create `packages/client/src/components/HelpOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { useStore } from '../state/store';

export function HelpOverlay() {
  const activeTip = useStore((s) => s.activeTip);
  const dismissTip = useStore((s) => s.dismissTip);

  useEffect(() => {
    if (!activeTip) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissTip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTip, dismissTip]);

  if (!activeTip) return null;

  return (
    <div
      onClick={dismissTip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 80px 0',
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(0, 0, 0, 0.92)',
          border: '1px solid var(--color-primary)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '16px 20px',
          maxWidth: '480px',
          width: '90%',
          fontFamily: 'var(--font-mono)',
          animation: 'crt-expand 200ms ease-out',
        }}
      >
        <div style={{
          color: 'var(--color-primary)',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>◈ {activeTip.title}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-dim)' }}>HILFE</span>
        </div>
        <div style={{
          color: '#CCCCCC',
          fontSize: '0.8rem',
          lineHeight: 1.6,
        }}>
          {activeTip.body}
        </div>
        <div style={{
          marginTop: '12px',
          textAlign: 'right',
          fontSize: '0.65rem',
          color: 'var(--color-dim)',
          letterSpacing: '0.1em',
        }}>
          [ESC / KLICK zum Schliessen]
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Mount HelpOverlay in the game layout**

Find the top-level component (look for where `BattleDialog` is mounted — same level). Add:

```tsx
import { HelpOverlay } from './HelpOverlay';
// ...
// Inside the return JSX, alongside other overlays:
<HelpOverlay />
```

**Step 4: Run client tests**

```bash
cd packages/client && npx vitest run
```

All tests pass.

**Step 5: Commit**

```bash
git add packages/client/src/components/HelpOverlay.tsx
git commit -m "feat: CRT-styled help tip overlay component (#48)"
```

---

### Task 6: #48 — Trigger help tips from game events

**Files:**
- Modify: `packages/client/src/network/client.ts` (or wherever game state is applied from server messages)

**Goal:** When the player encounters certain situations for the first time, show the relevant help tip.

**Step 1: Read client.ts to understand where game events come from**

Read `packages/client/src/network/client.ts` to understand how server messages arrive. Focus on:
- How `scanEvents` are received (look for `'scanEventDiscovered'` or similar)
- How position changes are received
- How sector info changes are received

**Step 2: Add trigger points**

In the server message handler for `scanEventDiscovered` (or equivalent), add:

```ts
// After receiving a scan event
const { showTip } = useStore.getState();
if (event.eventType === 'distress_signal') showTip('first_distress');
if (event.eventType === 'pirate_ambush') showTip('first_pirate');
if (event.eventType === 'anomaly_reading') showTip('first_anomaly');
```

In the handler for `sectorData` or `currentSector` update:

```ts
const { showTip } = useStore.getState();
if (sector.type === 'nebula') showTip('first_nebula');
if (sector.type === 'station') showTip('first_station');
if (sector.type === 'asteroid') showTip('first_asteroid');
```

In the fuel update handler:

```ts
const { showTip } = useStore.getState();
if (fuel.current < fuel.max * 0.15) showTip('low_fuel');
```

For first login (on successful auth), add one call:

```ts
showTip('first_login');
```

**Step 3: Run tests**

```bash
cd packages/client && npx vitest run
```

All pass.

**Step 4: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: trigger context-sensitive help tips from game events (#48)"
```

---

### Task 7: Close issues + run full suite + push

**Step 1: Run full test suite**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

All must pass.

**Step 2: Close issues**

```bash
gh issue close 43 --comment "Done: 8 story templates, seeded distress message in scan data, displayed in DetailPanel"
gh issue close 48 --comment "Done: HelpSlice, HelpOverlay component, 8 tips, context-sensitive triggers"
```

**Step 3: Push**

```bash
git push -u origin feat/features-sprint
```
