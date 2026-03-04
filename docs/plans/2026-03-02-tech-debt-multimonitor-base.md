# Tech Debt + Multi-Monitor + BASE-LINK Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 tech debt items, add responsive desktop multi-monitor layout with TV-style channel buttons, and create BASE-LINK monitor screen for home base management.

**Architecture:** Server-side fixes are isolated changes to SectorRoom, spawn, and queries. Multi-monitor adds a responsive CSS Grid wrapper around the existing single-monitor GameScreen. BASE-LINK is a new monitor component backed by existing structures data.

**Tech Stack:** TypeScript strict, React + Zustand (client), Colyseus + PostgreSQL (server), Vitest for tests.

**Conventions:**
- Server imports use `.js` extension (ESM); client imports don't (bundler)
- `import type { ... }` for type-only imports
- 2-space indent, single quotes, semicolons
- Conventional commits: `feat:`, `fix:`, `test:`
- Co-author: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## Block 1: Tech Debt (4 Fixes)

### Task 1: Dynamic ship class from DB

The `ships` table already exists in `001_initial.sql` with `ship_class`, `jump_range`, `cargo_cap`, `scanner_level`, `safe_slots`, and `active` columns. Currently SectorRoom hardcodes `SHIP_CLASSES.aegis_scout_mk1` in 7 places. Fix: load the player's active ship from DB on join, cache it per-client, and use it everywhere.

**Files:**
- Create: `packages/server/src/engine/__tests__/shipLookup.test.ts`
- Modify: `packages/server/src/db/queries.ts` (add `getActiveShip` query)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (replace 7 hardcoded references)
- Modify: `packages/shared/src/types.ts` (no changes needed — `ShipData` already exists)

**Step 1: Write the failing test for getActiveShip query shape**

In `packages/server/src/engine/__tests__/shipLookup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SHIP_CLASSES } from '@void-sector/shared';
import type { ShipClass } from '@void-sector/shared';

describe('ship class lookup', () => {
  it('SHIP_CLASSES contains all defined ship classes', () => {
    const classes: ShipClass[] = ['aegis_scout_mk1', 'void_seeker_mk2'];
    for (const cls of classes) {
      expect(SHIP_CLASSES[cls]).toBeDefined();
      expect(SHIP_CLASSES[cls].jumpRange).toBeGreaterThan(0);
      expect(SHIP_CLASSES[cls].cargoCap).toBeGreaterThan(0);
      expect(SHIP_CLASSES[cls].scannerLevel).toBeGreaterThanOrEqual(1);
    }
  });

  it('resolveShipStats returns correct stats for a ship class key', () => {
    const stats = SHIP_CLASSES['aegis_scout_mk1'];
    expect(stats.jumpRange).toBe(4);
    expect(stats.cargoCap).toBe(5);
    expect(stats.scannerLevel).toBe(1);
  });
});
```

**Step 2: Run test to verify it passes (this validates our shared constant is correct)**

Run: `cd packages/server && npx vitest run src/engine/__tests__/shipLookup.test.ts`
Expected: PASS

**Step 3: Add getActiveShip query to queries.ts**

In `packages/server/src/db/queries.ts`, add after the `findPlayerByUsername` function (after line 56):

```typescript
export async function getActiveShip(playerId: string): Promise<{
  shipClass: ShipClass;
  fuel: number;
  fuelMax: number;
} | null> {
  const { rows } = await query<{
    ship_class: string;
    fuel: number;
    fuel_max: number;
  }>(
    `SELECT ship_class, fuel, fuel_max FROM ships
     WHERE owner_id = $1 AND active = TRUE LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  return {
    shipClass: rows[0].ship_class as ShipClass,
    fuel: rows[0].fuel,
    fuelMax: rows[0].fuel_max,
  };
}
```

Add the import for `ShipClass` type at the top of queries.ts:

```typescript
import type { SectorData, PlayerData, CargoState, ResourceType, ShipClass } from '@void-sector/shared';
```

**Step 4: Refactor SectorRoom to use dynamic ship class**

In `packages/server/src/rooms/SectorRoom.ts`:

4a. Add import for `getActiveShip`:
```typescript
import { getAPState, saveAPState, savePlayerPosition, getMiningState, saveMiningState } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries, getPlayerCargo, addToCargo, jettisonCargo, getCargoTotal, awardBadge, hasAnyoneBadge, createStructure, deductCargo, saveMessage, getPendingMessages, markMessagesDelivered, getActiveShip, getRecentMessages } from '../db/queries.js';
```

4b. Add a private Map to cache ship stats per client session. Add after `autoDispose = true;` (line 22):
```typescript
  private clientShips = new Map<string, typeof SHIP_CLASSES[keyof typeof SHIP_CLASSES]>();
```

4c. Add a private helper method to get ship stats for a client. Add before `handleJump`:
```typescript
  private getShipForClient(sessionId: string) {
    return this.clientShips.get(sessionId) ?? SHIP_CLASSES.aegis_scout_mk1;
  }
```

4d. In `onJoin` (after line 131, the `savePlayerPosition` call), add ship loading:
```typescript
    // Load active ship
    const activeShip = await getActiveShip(auth.userId);
    const shipClass = activeShip?.shipClass ?? 'aegis_scout_mk1';
    const shipStats = SHIP_CLASSES[shipClass];
    this.clientShips.set(client.sessionId, shipStats);

    // Send ship data to client
    client.send('shipData', {
      id: '',
      ownerId: auth.userId,
      shipClass,
      fuel: activeShip?.fuel ?? shipStats.fuelMax,
      fuelMax: shipStats.fuelMax,
      jumpRange: shipStats.jumpRange,
      apCostJump: shipStats.apCostJump,
      cargoCap: shipStats.cargoCap,
      scannerLevel: shipStats.scannerLevel,
      safeSlots: shipStats.safeSlots,
      active: true,
    });
```

4e. In `onLeave`, clean up the cache. Add at the end (before closing brace):
```typescript
    this.clientShips.delete(client.sessionId);
```

4f. Replace all 7 hardcoded `SHIP_CLASSES.aegis_scout_mk1` references:

- **Line 176** (`onLeave` mining cleanup):
  Replace `const ship = SHIP_CLASSES.aegis_scout_mk1;`
  With: `const ship = this.getShipForClient(client.sessionId);`

- **Line 213** (`handleJump` mining auto-stop):
  Replace `const ship = SHIP_CLASSES.aegis_scout_mk1;`
  With: `const ship = this.getShipForClient(client.sessionId);`

- **Line 233** (`handleJump` validation):
  Replace `SHIP_CLASSES.aegis_scout_mk1.jumpRange,`
  With: `this.getShipForClient(client.sessionId).jumpRange,`

- **Line 282** (`handleLocalScan`):
  Replace `const scannerLevel = SHIP_CLASSES.aegis_scout_mk1.scannerLevel;`
  With: `const scannerLevel = this.getShipForClient(client.sessionId).scannerLevel;`

- **Line 306** (`handleAreaScan`):
  Replace `const scannerLevel = SHIP_CLASSES.aegis_scout_mk1.scannerLevel;`
  With: `const scannerLevel = this.getShipForClient(client.sessionId).scannerLevel;`

- **Line 350** (`handleMine`):
  Replace `const ship = SHIP_CLASSES.aegis_scout_mk1;`
  With: `const ship = this.getShipForClient(client.sessionId);`

- **Line 380** (`handleStopMine`):
  Replace `const ship = SHIP_CLASSES.aegis_scout_mk1;`
  With: `const ship = this.getShipForClient(client.sessionId);`

**Step 5: Add shipData handler in client network**

In `packages/client/src/network/client.ts`, add after the `cargoUpdate` listener (after line 148):

```typescript
    // Ship data
    room.onMessage('shipData', (data: ShipData) => {
      useStore.getState().setShip(data);
    });
```

Add `ShipData` to the import from `@void-sector/shared` at the top (line 3):
```typescript
import type { APState, SectorData, MiningState, CargoState, SectorResources, ChatMessage, ChatChannel, StructureType, ShipData } from '@void-sector/shared';
```

**Step 6: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (57+)

**Step 7: Commit**

```
fix: load ship class from DB instead of hardcoding aegis_scout_mk1

Replaces 7 hardcoded SHIP_CLASSES.aegis_scout_mk1 references in
SectorRoom with dynamic lookup from the ships table. Caches ship
stats per client session for performance.
```

---

### Task 2: Wire getRecentMessages into sector join

`getRecentMessages` in `queries.ts:291-300` exists but is never called. Wire it into `onJoin` to send chat history to joining players.

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts:118-167` (onJoin method)
- Modify: `packages/client/src/network/client.ts` (add chatHistory handler)

**Step 1: Add chat history delivery to onJoin**

In `packages/server/src/rooms/SectorRoom.ts`, in the `onJoin` method, add after the pending messages block (after line 166, before the closing `}`):

```typescript
    // Send recent local chat history for this sector
    const sectorChannel = `local`;
    const recentMessages = await getRecentMessages(sectorChannel, 50);
    if (recentMessages.length > 0) {
      const history: ChatMessage[] = recentMessages.map((msg: any) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        channel: msg.channel,
        recipientId: msg.recipient_id,
        content: msg.content,
        sentAt: new Date(msg.sent_at).getTime(),
        delayed: false,
      }));
      client.send('chatHistory', history);
    }
```

Note: `getRecentMessages` was already added to the import in Task 1 Step 4a. If implementing independently, add it to the import from `'../db/queries.js'`.

**Step 2: Add chatHistory handler in client**

In `packages/client/src/network/client.ts`, add after the `chatMessage` listener (after line 156):

```typescript
    // Chat history (loaded on join)
    room.onMessage('chatHistory', (messages: ChatMessage[]) => {
      const store = useStore.getState();
      for (const msg of messages) {
        store.addChatMessage(msg);
      }
    });
```

**Step 3: Run all tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 4: Commit**

```
feat: send recent chat history to players joining a sector

Wires the existing getRecentMessages query into SectorRoom.onJoin,
sending the last 50 local messages as chatHistory to the client.
```

---

### Task 3: Catch structure duplicate constraint error

`createStructure()` in `SectorRoom.ts:437-442` has no try-catch. A UNIQUE constraint violation (same type in same sector) throws an unhandled DB error.

**Files:**
- Create: `packages/server/src/engine/__tests__/buildError.test.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts:413-451` (handleBuild method)

**Step 1: Write the test**

In `packages/server/src/engine/__tests__/buildError.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('structure duplicate detection', () => {
  it('PostgreSQL error code 23505 indicates unique_violation', () => {
    // This test documents the expected error code we catch
    const error = new Error('duplicate key value violates unique constraint') as any;
    error.code = '23505';
    expect(error.code).toBe('23505');
  });
});
```

**Step 2: Run test**

Run: `cd packages/server && npx vitest run src/engine/__tests__/buildError.test.ts`
Expected: PASS

**Step 3: Add try-catch around createStructure in handleBuild**

In `packages/server/src/rooms/SectorRoom.ts`, replace lines 437-450 (the createStructure call and everything after it in handleBuild) with:

```typescript
    let structure;
    try {
      structure = await createStructure(
        auth.userId, data.type,
        this.state.sector.x, this.state.sector.y
      );
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('buildResult', { success: false, error: 'Structure already exists in this sector' });
        return;
      }
      client.send('buildResult', { success: false, error: 'Build failed — try again' });
      return;
    }

    client.send('buildResult', { success: true, structure });
    client.send('apUpdate', result.newAP!);
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    this.broadcast('structureBuilt', {
      structure,
      sectorX: this.state.sector.x,
      sectorY: this.state.sector.y,
    });
```

**Step 4: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 5: Commit**

```
fix: catch structure duplicate constraint with clean error message

Wraps createStructure() in try-catch, returning a user-friendly error
on UNIQUE violation (23505) instead of crashing.
```

---

### Task 4: Add explicit spawn distance guard

`generateSpawnPosition()` relies on math to guarantee minimum distance but has no explicit assertion. Add a defensive check.

**Files:**
- Modify: `packages/server/src/engine/spawn.ts:4-11`
- Modify: `packages/server/src/engine/__tests__/spawn.test.ts` (add guard test)

**Step 1: Add test for the guard**

In `packages/server/src/engine/__tests__/spawn.test.ts`, add after the last test:

```typescript
  it('always produces positions >= SPAWN_MIN_DISTANCE even with edge-case math', () => {
    // Run 100 times to stress-test the guard
    for (let i = 0; i < 100; i++) {
      const pos = generateSpawnPosition();
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
      expect(dist).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE * 0.99); // allow tiny float rounding
    }
  });
```

**Step 2: Run test to verify it passes (it should, since current math is correct)**

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn.test.ts`
Expected: PASS

**Step 3: Add explicit distance guard to generateSpawnPosition**

Replace the entire function in `packages/server/src/engine/spawn.ts:4-11`:

```typescript
export function generateSpawnPosition(): { x: number; y: number } {
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = SPAWN_MIN_DISTANCE + Math.random() * SPAWN_DISTANCE_VARIANCE;
    const x = Math.round(Math.cos(angle) * distance);
    const y = Math.round(Math.sin(angle) * distance);
    if (Math.hypot(x, y) >= SPAWN_MIN_DISTANCE) {
      return { x, y };
    }
  }
  // Fallback: deterministic safe position
  return { x: SPAWN_MIN_DISTANCE, y: 0 };
}
```

**Step 4: Run all spawn tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn.test.ts`
Expected: All 4 tests pass

**Step 5: Commit**

```
fix: add explicit distance guard to spawn position generation

Adds a retry loop with Math.hypot check to guarantee spawns are
always >= SPAWN_MIN_DISTANCE from origin, with deterministic fallback.
```

---

## Block 2: Multi-Monitor Desktop Layout

### Task 5: Add sidebar state to UISlice

**Files:**
- Modify: `packages/shared/src/constants.ts:155-162` (add BASE_LINK monitor)
- Modify: `packages/client/src/state/uiSlice.ts` (add sidebarSlots state)

**Step 1: Add BASE_LINK to MONITORS constant**

In `packages/shared/src/constants.ts`, replace lines 155-162:

```typescript
export const MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
  COMMS: 'COMMS',
  BASE_LINK: 'BASE-LINK',
} as const;

export type MonitorId = typeof MONITORS[keyof typeof MONITORS];

// Sidebar-eligible monitors (all except NAV-COM which is always the main monitor)
export const SIDEBAR_MONITORS: MonitorId[] = [
  MONITORS.SHIP_SYS,
  MONITORS.MINING,
  MONITORS.CARGO,
  MONITORS.COMMS,
  MONITORS.BASE_LINK,
];
```

**Step 2: Add sidebar state to UISlice**

In `packages/client/src/state/uiSlice.ts`, add to the UISlice interface (after `jumpAnimation`):

```typescript
  sidebarSlots: [string, string];
  setSidebarSlot: (index: 0 | 1, monitor: string) => void;
```

In the `createUISlice` function, add to initial state (after `jumpAnimation: null,`):

```typescript
  sidebarSlots: JSON.parse(safeGetItem('vs-sidebar-slots') || '["SHIP-SYS","COMMS"]') as [string, string],
```

And add the action (after `clearJumpAnimation`):

```typescript
  setSidebarSlot: (index, monitor) => set((s) => {
    const slots = [...s.sidebarSlots] as [string, string];
    slots[index] = monitor;
    safeSetItem('vs-sidebar-slots', JSON.stringify(slots));
    return { sidebarSlots: slots };
  }),
```

**Step 3: Export MonitorId from shared index**

In `packages/shared/src/constants.ts`, the `MonitorId` type is already exported inline. Ensure the shared package barrel export includes it. Check if there's an index.ts in shared that re-exports — if so, add `MonitorId` to it.

**Step 4: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All pass (40+)

**Step 5: Commit**

```
feat: add BASE-LINK monitor constant and sidebar slots state

Adds 6th monitor (BASE-LINK), sidebar slot persistence in localStorage,
and SIDEBAR_MONITORS array for channel button rendering.
```

---

### Task 6: Create SidebarBezel component (compact monitor frame)

The sidebar monitors need a compact bezel — same CRT effects but without PAN/ZOOM/BRIGHTNESS knobs and with a smaller form factor.

**Files:**
- Create: `packages/client/src/components/SidebarBezel.tsx`

**Step 1: Create the component**

In `packages/client/src/components/SidebarBezel.tsx`:

```typescript
import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import '../styles/crt.css';

interface SidebarBezelProps {
  children: ReactNode;
  monitorId: string;
}

export function SidebarBezel({ children, monitorId }: SidebarBezelProps) {
  const brightness = useStore((s) => s.brightness);

  return (
    <div className="bezel-frame sidebar-bezel">
      <div className="bezel-main">
        <div className="bezel-side bezel-left" style={{ minWidth: 20, padding: '4px 2px' }}>
          <span className="bezel-label-vertical" style={{ fontSize: '0.45rem' }}>{monitorId}</span>
        </div>
        <div className="crt-wrapper">
          <div className="crt-scanlines" />
          <div className="crt-vignette" />
          <div className="crt-content" style={{ filter: `brightness(${brightness})` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note: No flicker effect on sidebar (reduces visual noise). No knobs (compact).

**Step 2: Commit**

```
feat: add compact SidebarBezel component for sidebar monitors
```

---

### Task 7: Create ChannelButtons component (TV-style)

Physical-looking channel buttons that sit on the sidebar bezel edge, like old TV channel selectors.

**Files:**
- Create: `packages/client/src/components/ChannelButtons.tsx`
- Modify: `packages/client/src/styles/crt.css` (add channel button styles)

**Step 1: Create the component**

In `packages/client/src/components/ChannelButtons.tsx`:

```typescript
import { useStore } from '../state/store';
import { SIDEBAR_MONITORS } from '@void-sector/shared';

interface ChannelButtonsProps {
  slotIndex: 0 | 1;
}

const CHANNEL_LABELS: Record<string, string> = {
  'SHIP-SYS': 'SYS',
  'MINING': 'MIN',
  'CARGO': 'CRG',
  'COMMS': 'COM',
  'BASE-LINK': 'BAS',
};

export function ChannelButtons({ slotIndex }: ChannelButtonsProps) {
  const sidebarSlots = useStore((s) => s.sidebarSlots);
  const setSidebarSlot = useStore((s) => s.setSidebarSlot);
  const unreadComms = useStore((s) => s.unreadComms);
  const activeMonitor = sidebarSlots[slotIndex];

  return (
    <div className="channel-buttons">
      {SIDEBAR_MONITORS.map((id) => (
        <button
          key={id}
          className={`channel-btn ${activeMonitor === id ? 'active' : ''}`}
          onClick={() => {
            setSidebarSlot(slotIndex, id);
            if (id === 'COMMS') useStore.getState().setUnreadComms(false);
          }}
          title={id}
        >
          {CHANNEL_LABELS[id] || id.slice(0, 3)}
          {id === 'COMMS' && unreadComms && <span className="channel-dot" />}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Add CSS for channel buttons**

Append to `packages/client/src/styles/crt.css`:

```css
/* TV-style channel selector buttons */
.channel-buttons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 2px;
  background: linear-gradient(180deg, #1a1a1a, #131313, #1a1a1a);
  border-left: 1px solid #2a2a2a;
}

.channel-btn {
  position: relative;
  width: 32px;
  height: 24px;
  font-family: var(--font-mono);
  font-size: 0.45rem;
  letter-spacing: 0.05em;
  color: rgba(255, 176, 0, 0.4);
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  transition: all 0.1s;
}

.channel-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.channel-btn.active {
  color: #050505;
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 4px var(--color-primary);
}

.channel-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-danger, #FF3333);
}
```

**Step 3: Commit**

```
feat: add TV-style channel selector buttons for sidebar monitors
```

---

### Task 8: Create DesktopLayout wrapper component

Responsive layout: desktop shows main + sidebar, mobile shows single monitor with tabs.

**Files:**
- Create: `packages/client/src/components/DesktopLayout.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx` (extract screens, use DesktopLayout)
- Modify: `packages/client/src/styles/crt.css` (add layout styles)

**Step 1: Add layout CSS**

Append to `packages/client/src/styles/crt.css`:

```css
/* Desktop multi-monitor layout */
.desktop-layout {
  display: grid;
  grid-template-columns: 1fr;
  height: 100%;
  gap: 0;
}

@media (min-width: 1024px) {
  .desktop-layout {
    grid-template-columns: 1fr 360px;
  }
}

.main-monitor {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-stack {
  display: none;
  flex-direction: column;
}

@media (min-width: 1024px) {
  .sidebar-stack {
    display: flex;
    border-left: 2px solid #2a2a2a;
  }
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
}

/* Mobile tab bar — hide on desktop */
.mobile-tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: #111;
  border-top: 2px solid #2a2a2a;
}

@media (min-width: 1024px) {
  .mobile-tabs {
    display: none;
  }
}
```

**Step 2: Create DesktopLayout**

In `packages/client/src/components/DesktopLayout.tsx`:

```typescript
import type { ReactNode } from 'react';
import { SidebarBezel } from './SidebarBezel';
import { ChannelButtons } from './ChannelButtons';
import { useStore } from '../state/store';

interface DesktopLayoutProps {
  mainMonitor: ReactNode;
  renderScreen: (monitorId: string) => ReactNode;
}

export function DesktopLayout({ mainMonitor, renderScreen }: DesktopLayoutProps) {
  const sidebarSlots = useStore((s) => s.sidebarSlots);

  return (
    <div className="desktop-layout">
      <div className="main-monitor">
        {mainMonitor}
      </div>
      <div className="sidebar-stack">
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <div className="sidebar-slot-content">
              <SidebarBezel monitorId={sidebarSlots[slotIndex]}>
                {renderScreen(sidebarSlots[slotIndex])}
              </SidebarBezel>
            </div>
            <ChannelButtons slotIndex={slotIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Refactor GameScreen to use DesktopLayout**

Rewrite `packages/client/src/components/GameScreen.tsx`. Keep NavComScreen and ShipSysScreen defined inside. Wrap with DesktopLayout:

```typescript
import { useEffect } from 'react';
import { MonitorBezel } from './MonitorBezel';
import { DesktopLayout } from './DesktopLayout';
import { RadarCanvas } from './RadarCanvas';
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

function NavComScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 12px', fontSize: '0.85rem', letterSpacing: '0.2em', opacity: 0.6 }}>
        VOID SECTOR — NAV-COM
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <RadarCanvas />
      </div>
      <SectorInfo />
      <StatusBar />
      <NavControls />
      <EventLog />
    </div>
  );
}

function ShipSysScreen() {
  const ship = useStore((s) => s.ship);
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);
  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 2 }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '16px' }}>
        {ship ? SHIP_CLASSES[ship.shipClass].name : 'NO SHIP DATA'}
      </div>
      <div>ION DRIVE ──── [RANGE: {ship?.jumpRange ?? '?'} SECTORS]</div>
      <div>CARGO HOLD ─── [CAP: {ship?.cargoCap ?? '?'} UNITS]</div>
      <div>SCANNER ────── [LEVEL: {ship?.scannerLevel ?? '?'}]</div>
      <div>SAFE SLOTS ─── [{ship?.safeSlots ?? '?'}]</div>
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
        SYSTEMS: ONLINE
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: '0.8rem' }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{
            display: 'block', marginTop: 4,
            background: 'transparent', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
          }}
        >
          {Object.keys(COLOR_PROFILES).map(name => (
            <option key={name} value={name}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function renderScreen(monitorId: string) {
  switch (monitorId) {
    case MONITORS.NAV_COM: return <NavComScreen />;
    case MONITORS.SHIP_SYS: return <ShipSysScreen />;
    case MONITORS.MINING: return <MiningScreen />;
    case MONITORS.CARGO: return <CargoScreen />;
    case MONITORS.COMMS: return <CommsScreen />;
    case MONITORS.BASE_LINK: return <BaseScreen />;
    default: return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

export function GameScreen() {
  const activeMonitor = useStore((s) => s.activeMonitor);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const colorProfile = useStore((s) => s.colorProfile);
  const unreadComms = useStore((s) => s.unreadComms);

  useEffect(() => {
    const profile = COLOR_PROFILES[colorProfile];
    document.documentElement.style.setProperty('--color-primary', profile.primary);
    document.documentElement.style.setProperty('--color-dim', profile.dim);
  }, [colorProfile]);

  const mainMonitor = (
    <MonitorBezel
      monitorId={activeMonitor}
      statusLeds={[
        { label: 'SYS', active: true },
        { label: 'NAV', active: activeMonitor === MONITORS.NAV_COM },
      ]}
    >
      {renderScreen(activeMonitor)}
    </MonitorBezel>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DesktopLayout mainMonitor={mainMonitor} renderScreen={renderScreen} />

      {/* Mobile tab bar */}
      <div className="mobile-tabs">
        {[MONITORS.NAV_COM, MONITORS.SHIP_SYS, MONITORS.MINING, MONITORS.CARGO, MONITORS.COMMS, MONITORS.BASE_LINK].map((id) => (
          <button
            key={id}
            className="vs-btn"
            style={{
              flex: 1,
              fontSize: '0.75rem',
              padding: '8px 2px',
              border: '2px solid var(--color-primary)',
              background: activeMonitor === id ? 'var(--color-primary)' : 'transparent',
              color: activeMonitor === id ? '#050505' : 'var(--color-primary)',
            }}
            onClick={() => {
              setActiveMonitor(id);
              if (id === MONITORS.COMMS) useStore.getState().setUnreadComms(false);
            }}
          >
            [{id}]{id === MONITORS.COMMS && unreadComms ? ' •' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Note: This imports `BaseScreen` which doesn't exist yet — it will be created in Task 10. Create a placeholder first so the build doesn't break:

**Step 4: Create BaseScreen placeholder**

In `packages/client/src/components/BaseScreen.tsx`:

```typescript
export function BaseScreen() {
  return (
    <div style={{ padding: '12px', fontSize: '0.8rem' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '16px', opacity: 0.6 }}>
        BASE-LINK — CONNECTING...
      </div>
      <div style={{ opacity: 0.4 }}>
        NO BASE DATA — CONSTRUCT A BASE FIRST
      </div>
    </div>
  );
}
```

**Step 5: Update mockStore for sidebar slots**

In `packages/client/src/test/mockStore.ts`, add to the state object (after `activeMonitor`):

```typescript
    sidebarSlots: ['SHIP-SYS', 'COMMS'] as [string, string],
```

**Step 6: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All pass (40+)

**Step 7: Commit**

```
feat: add responsive desktop multi-monitor layout with TV channel buttons

Desktop (≥1024px): NAV-COM main + 2 sidebar monitors with channel selectors.
Mobile: single monitor with bottom tab bar (existing behavior preserved).
```

---

## Block 3: BASE-LINK Monitor

### Task 9: Add base structures query and server endpoint

**Files:**
- Modify: `packages/server/src/db/queries.ts` (add getPlayerStructuresAtBase)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (add getBase message handler, send base on join)
- Modify: `packages/shared/src/types.ts` (add BaseStructure type)

**Step 1: Add BaseStructure type to shared types**

In `packages/shared/src/types.ts`, add after the `Structure` interface (after line 142):

```typescript
export interface BaseStructure {
  id: string;
  type: StructureType;
  sectorX: number;
  sectorY: number;
  createdAt: string;
}
```

**Step 2: Add query for player base structures**

In `packages/server/src/db/queries.ts`, add after `getStructuresInRange` (after line 248):

```typescript
export async function getPlayerBaseStructures(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT s.* FROM structures s
     JOIN players p ON p.id = $1
     WHERE s.owner_id = $1
       AND s.sector_x = (p.home_base->>'x')::int
       AND s.sector_y = (p.home_base->>'y')::int
     ORDER BY s.created_at ASC`,
    [playerId]
  );
  return rows;
}
```

**Step 3: Add getBase handler and base data on join**

In `packages/server/src/rooms/SectorRoom.ts`, add import for `getPlayerBaseStructures` in the queries import line.

Add message handler in `onCreate` (after the `chat` handler, around line 115):

```typescript
    this.onMessage('getBase', async (client) => {
      const auth = client.auth as AuthPayload;
      const structures = await getPlayerBaseStructures(auth.userId);
      client.send('baseData', { structures });
    });
```

**Step 4: Add baseData handler in client network**

In `packages/client/src/network/client.ts`, add after the `buildResult` listener:

```typescript
    // Base data
    room.onMessage('baseData', (data: { structures: any[] }) => {
      useStore.getState().setBaseStructures(data.structures);
    });
```

Add `requestBase` method to the `GameNetwork` class:

```typescript
  requestBase() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getBase', {});
  }
```

**Step 5: Add base state to GameSlice**

In `packages/client/src/state/gameSlice.ts`, add to the GameSlice interface (after `unreadComms`):

```typescript
  baseStructures: any[];
  setBaseStructures: (structures: any[]) => void;
```

Add to initial state (after `unreadComms: false,`):

```typescript
  baseStructures: [],
```

Add action (after `setUnreadComms`):

```typescript
  setBaseStructures: (baseStructures) => set({ baseStructures }),
```

**Step 6: Run all tests**

Run: `cd packages/server && npx vitest run && cd ../client && npx vitest run`
Expected: All pass

**Step 7: Commit**

```
feat: add base structures query, server endpoint, and client state
```

---

### Task 10: Create BaseScreen component

The full BASE-LINK monitor showing home base structures, resource summary, and build/transfer actions.

**Files:**
- Modify: `packages/client/src/components/BaseScreen.tsx` (replace placeholder)
- Create: `packages/client/src/__tests__/BaseScreen.test.tsx`

**Step 1: Write the test**

In `packages/client/src/__tests__/BaseScreen.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseScreen } from '../components/BaseScreen';
import { mockStoreState } from '../test/mockStore';

describe('BaseScreen', () => {
  beforeEach(() => {
    mockStoreState({
      position: { x: 5000000, y: 5000000 },
      baseStructures: [
        { id: '1', type: 'base', sector_x: 0, sector_y: 0, created_at: '2026-01-01' },
        { id: '2', type: 'comm_relay', sector_x: 0, sector_y: 0, created_at: '2026-01-02' },
      ],
      cargo: { ore: 10, gas: 5, crystal: 3 },
    });
  });

  it('renders base header', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/BASE-LINK/)).toBeTruthy();
  });

  it('shows structures list', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/BASE/i)).toBeTruthy();
    expect(screen.getByText(/COMM.RELAY/i)).toBeTruthy();
  });

  it('shows empty state when no structures', () => {
    mockStoreState({ baseStructures: [] });
    render(<BaseScreen />);
    expect(screen.getByText(/NO BASE/i)).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/client && npx vitest run src/__tests__/BaseScreen.test.tsx`
Expected: FAIL (placeholder doesn't show structure data)

**Step 3: Implement BaseScreen**

Replace `packages/client/src/components/BaseScreen.tsx`:

```typescript
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STRUCTURE_COSTS } from '@void-sector/shared';
import type { StructureType } from '@void-sector/shared';

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'KOMMANDO-KERN',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
};

export function BaseScreen() {
  const baseStructures = useStore((s) => s.baseStructures);
  const cargo = useStore((s) => s.cargo);

  useEffect(() => {
    network.requestBase();
  }, []);

  const hasBase = baseStructures.length > 0;

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8 }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '12px', opacity: 0.6 }}>
        BASE-LINK — {hasBase ? 'CONNECTED' : 'NO SIGNAL'}
      </div>

      {!hasBase ? (
        <div>
          <div style={{ opacity: 0.4, marginBottom: '12px' }}>
            NO BASE CONSTRUCTED
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
            Navigate to a sector and use [BUILD BASE] to establish your home base.
          </div>
        </div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '8px', marginBottom: '8px' }}>
            STRUCTURES
          </div>
          {baseStructures.map((s: any) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{STRUCTURE_LABELS[s.type] || s.type.toUpperCase()}</span>
              <span style={{ opacity: 0.5 }}>[ACTIVE]</span>
            </div>
          ))}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '8px', marginBottom: '8px', marginTop: '16px' }}>
            CARGO ON SHIP
          </div>
          <div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal}</div>
        </>
      )}
    </div>
  );
}
```

**Step 4: Update mockStore to include baseStructures**

In `packages/client/src/test/mockStore.ts`, add to the state object (after `unreadComms`):

```typescript
    chatMessages: [],
    chatChannel: 'local' as any,
    unreadComms: false,
    baseStructures: [],
```

**Step 5: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All pass (43+)

**Step 6: Commit**

```
feat: add BASE-LINK monitor with structures overview and cargo display
```

---

### Task 11: Final integration test and cleanup

Run all tests across all packages, verify everything works together.

**Step 1: Run all tests**

Run: `cd packages/server && npx vitest run && cd ../client && npx vitest run && cd ../shared && npx vitest run`
Expected: All pass (60+ server, 43+ client, 5 shared)

**Step 2: Quick manual smoke test (optional)**

If Docker is running:
```bash
npm run dev:server &
npm run dev:client &
```
Open http://localhost:3000, verify:
- Desktop: NAV-COM main + 2 sidebar monitors visible
- Channel buttons switch sidebar content
- BASE-LINK shows "NO BASE" placeholder
- Mobile (resize < 1024px): Falls back to tab bar

**Step 3: Final commit (if any small fixes needed)**

```
fix: integration fixes for multi-monitor layout
```

---

## Summary

| Task | Block | Description | Files Changed |
|------|-------|-------------|---------------|
| 1 | Tech Debt | Dynamic ship class from DB | queries.ts, SectorRoom.ts, client.ts |
| 2 | Tech Debt | Wire getRecentMessages | SectorRoom.ts, client.ts |
| 3 | Tech Debt | Catch structure duplicate error | SectorRoom.ts |
| 4 | Tech Debt | Spawn distance guard | spawn.ts |
| 5 | Multi-Monitor | Sidebar state + BASE_LINK constant | constants.ts, uiSlice.ts |
| 6 | Multi-Monitor | SidebarBezel component | SidebarBezel.tsx |
| 7 | Multi-Monitor | ChannelButtons (TV-style) | ChannelButtons.tsx, crt.css |
| 8 | Multi-Monitor | DesktopLayout + GameScreen refactor | DesktopLayout.tsx, GameScreen.tsx, crt.css |
| 9 | BASE-LINK | Server queries + state | queries.ts, SectorRoom.ts, gameSlice.ts |
| 10 | BASE-LINK | BaseScreen component | BaseScreen.tsx |
| 11 | Integration | Full test pass + smoke test | — |
