# Phase 3-N — FACTION + SHIP-SYS Detail Panels Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contextual detail panels for FACTION and SHIP-SYS programs in Section 3 of the cockpit, plus the faction recruiting feature and a tab system for FactionScreen.

**Architecture:** Two new components (`FactionDetailPanel`, `ShipDetailPanel`) wire into `CockpitLayout.getDetailForProgram()`. Tab navigation uses the existing `monitorModes`/`setMonitorMode` Zustand pattern — no new slice fields. Faction recruiting adds a DB migration, server broadcast, and client state field. `FactionScreen` is rebuilt with a tab bar (`info | members | upgrades | management`). `ShipSysScreen` in `GameScreen.tsx` gets an `'acep'` placeholder branch.

**Tech Stack:** React, Zustand, Colyseus, PostgreSQL, Vitest + React Testing Library

---

## Chunk 1: Server + Client Foundation

### Task 1: DB Migration 051

**Files:**
- Create: `packages/server/src/db/migrations/051_faction_recruiting.sql`

- [ ] **Step 1: Create the SQL migration file**

```sql
-- Migration 051: Faction Recruiting
-- Allows faction leaders to mark their faction as actively recruiting,
-- add a slogan, and optionally a color for display in the recruitment panel.

ALTER TABLE factions
  ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS slogan        VARCHAR(160),
  ADD COLUMN IF NOT EXISTS color         VARCHAR(7);
```

- [ ] **Step 2: Run server tests to verify baseline still passes**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass (migration runs at server startup, not during tests; this just confirms no regressions)

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/migrations/051_faction_recruiting.sql
git commit -m "feat: migration 051 — faction recruiting columns (is_recruiting, slogan, color)"
```

---

### Task 2: Server DB Queries

**Files:**
- Modify: `packages/server/src/db/queries.ts`

Three changes: add `getRecruitingFactions`, add `setFactionRecruiting`, update `getPlayerShips` to return `acep_traits`.

- [ ] **Step 1: Add `getRecruitingFactions` query**

In `queries.ts`, find the last faction-related function (search for `getFactionUpgrades`). Add after it:

```ts
export interface RecruitingFactionRow {
  id: string;
  name: string;
  color: string | null;
  slogan: string | null;
  member_count: string;
}

export async function getRecruitingFactions(): Promise<RecruitingFactionRow[]> {
  const { rows } = await query<RecruitingFactionRow>(
    `SELECT f.id, f.name, f.color, f.slogan, COUNT(fm.player_id)::text AS member_count
     FROM factions f
     LEFT JOIN faction_members fm ON fm.faction_id = f.id
     WHERE f.is_recruiting = TRUE
     GROUP BY f.id, f.name, f.color, f.slogan`,
  );
  return rows;
}

export async function setFactionRecruiting(
  factionId: string,
  isRecruiting: boolean,
  slogan: string | null,
): Promise<void> {
  await query(
    `UPDATE factions SET is_recruiting = $2, slogan = $3 WHERE id = $1`,
    [factionId, isRecruiting, slogan],
  );
}
```

- [ ] **Step 2: Update `getPlayerShips` to include `acep_traits`**

Find `getPlayerShips` (around line 147). Update it:

```ts
export async function getPlayerShips(
  playerId: string,
): Promise<(ShipRecord & { acepTraits: string[] })[]> {
  const { rows } = await query<any>(
    `SELECT id, owner_id, hull_type, name, modules, fuel, active, created_at, acep_traits
     FROM ships WHERE owner_id = $1 ORDER BY created_at ASC`,
    [playerId],
  );
  return rows.map((row: any) => ({
    id: row.id,
    ownerId: row.owner_id,
    hullType: row.hull_type as HullType,
    name: row.name,
    modules: row.modules,
    active: row.active,
    createdAt: row.created_at,
    acepTraits: Array.isArray(row.acep_traits) ? row.acep_traits : [],
  }));
}
```

- [ ] **Step 3: Run server tests**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat: add getRecruitingFactions, setFactionRecruiting; include acep_traits in getPlayerShips"
```

---

### Task 3: Server Services + SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Modify: `packages/server/src/rooms/services/FactionService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

- [ ] **Step 1: Update `ShipService.handleGetShips` to include `acepTraits`**

In `ShipService.ts`, `handleGetShips` (~line 55). The `getPlayerShips` now returns `acepTraits`. Pass it through:

```ts
async handleGetShips(client: Client): Promise<void> {
  const auth = client.auth as AuthPayload;
  const ships = await getPlayerShips(auth.userId);
  const shipsWithStats = await Promise.all(
    ships.map(async (s) => {
      const acepXp = await getAcepXpSummary(s.id);
      return {
        ...s,
        stats: calculateShipStats(s.hullType, s.modules),
        acepXp,
        acepEffects: getAcepEffects(acepXp),
        acepTraits: s.acepTraits,
      };
    }),
  );
  client.send('shipList', { ships: shipsWithStats });
}
```

- [ ] **Step 2: Add imports to FactionService**

At the top of `FactionService.ts`, add to the existing import from `../../db/queries.js`:

```ts
import {
  // ... existing imports stay ...
  getRecruitingFactions,
  setFactionRecruiting,
} from '../../db/queries.js';
```

- [ ] **Step 3: Add `sendRecruitingFactions`, `broadcastRecruitingFactions`, `handleSetRecruiting` to FactionService**

Add these three methods to the `FactionService` class, after the existing methods:

```ts
async sendRecruitingFactions(client: Client): Promise<void> {
  const rows = await getRecruitingFactions();
  const recruitingFactions = rows.map((r) => ({
    factionId: r.id,
    name: r.name,
    color: r.color,
    slogan: r.slogan,
    memberCount: Number(r.member_count),
  }));
  this.ctx.send(client, 'recruitingFactionsUpdate', recruitingFactions);
}

async broadcastRecruitingFactions(): Promise<void> {
  const rows = await getRecruitingFactions();
  const recruitingFactions = rows.map((r) => ({
    factionId: r.id,
    name: r.name,
    color: r.color,
    slogan: r.slogan,
    memberCount: Number(r.member_count),
  }));
  this.ctx.broadcast('recruitingFactionsUpdate', recruitingFactions);
}

async handleSetRecruiting(
  client: Client,
  data: { isRecruiting: boolean; slogan?: string },
): Promise<void> {
  const auth = client.auth as AuthPayload;
  const myFaction = await getPlayerFaction(auth.userId);
  if (!myFaction || myFaction.player_rank !== 'leader') {
    this.ctx.send(client, 'setRecruitingResult', {
      success: false,
      error: 'Only faction leader can set recruiting',
    });
    return;
  }
  await setFactionRecruiting(myFaction.id, data.isRecruiting, data.slogan ?? null);
  this.ctx.send(client, 'setRecruitingResult', { success: true });
  await this.broadcastRecruitingFactions();
}
```

- [ ] **Step 4: Register message and add onJoin call in SectorRoom**

In `SectorRoom.ts`, in the faction message block (lines 533–545, after the existing `factionUpgrade` handler):

```ts
this.onMessage('setRecruiting', (client, data) =>
  this.factions.handleSetRecruiting(client, data),
);
```

In `onJoin` (~line 1226), right after `await this.quests.handleGetTrackedQuests(client)` in the "Phase 4: Send reputation + active quests" block:

```ts
// Send recruiting factions to new client
await this.factions.sendRecruitingFactions(client);
```

- [ ] **Step 5: Run server tests**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts \
        packages/server/src/rooms/services/FactionService.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: server recruiting — setRecruiting handler, broadcastRecruitingFactions, acepTraits in shipList"
```

---

### Task 4: Client — gameSlice Additions

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`

- [ ] **Step 1: Add `acepTraits` to `ClientShipData`**

In `gameSlice.ts`, find `ClientShipData` interface (~line 57). Add after the `acepEffects?` block closing brace:

```ts
acepTraits?: string[];
```

- [ ] **Step 2: Define `RecruitingFaction` type and add state**

After the `ClientShipData` interface (after line 76), add:

```ts
export interface RecruitingFaction {
  factionId: string;
  name: string;
  color: string | null;
  slogan: string | null;
  memberCount: number;
}
```

Find where `faction: Faction | null` is declared in the state interface. Add:

```ts
recruitingFactions: RecruitingFaction[];
```

Find the initial state (`faction: null`). Add:

```ts
recruitingFactions: [],
```

Find the actions interface section (where `setFactionUpgrades` is declared). Add:

```ts
setRecruitingFactions: (factions: RecruitingFaction[]) => void;
```

Find the store implementation (where `setFactionUpgrades` is implemented). Add:

```ts
setRecruitingFactions: (recruitingFactions) => set({ recruitingFactions }),
```

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts
git commit -m "feat: add acepTraits to ClientShipData; add RecruitingFaction type and recruitingFactions state"
```

---

### Task 5: Client — Network Handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Update `shipList` handler to merge `acepTraits`**

Find the `shipList` handler (~line 487). The current code only merges `acepXp` and `acepEffects`. Update it to also merge `acepTraits`:

```ts
room.onMessage('shipList', (data: { ships: any[] }) => {
  useStore.setState({ shipList: data.ships });
  const activeShip = data.ships.find((s: any) => s.active);
  if (activeShip) {
    const current = useStore.getState().ship;
    if (current) {
      useStore.setState({
        ship: {
          ...current,
          ...(activeShip.acepXp && { acepXp: activeShip.acepXp }),
          ...(activeShip.acepEffects && { acepEffects: activeShip.acepEffects }),
          ...(activeShip.acepTraits !== undefined && { acepTraits: activeShip.acepTraits }),
        },
      });
    }
  }
});
```

- [ ] **Step 2: Add `recruitingFactionsUpdate` handler**

Find the `humanityReps` handler (~line 1593). Add right after it:

```ts
room.onMessage('recruitingFactionsUpdate', (data: any[]) => {
  useStore.getState().setRecruitingFactions(data);
});
```

- [ ] **Step 3: Add `sendSetRecruiting` to the network class**

Find `requestHumanityReps` (~line 2277). Add after it:

```ts
sendSetRecruiting(isRecruiting: boolean, slogan: string | null): void {
  this.sectorRoom?.send('setRecruiting', { isRecruiting, slogan });
}
```

- [ ] **Step 4: Run client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: network handlers for recruitingFactionsUpdate, acepTraits in shipList, sendSetRecruiting"
```

---

## Chunk 2: New Detail Panels

### Task 6: ShipDetailPanel

**Files:**
- Create: `packages/client/src/components/ShipDetailPanel.tsx`
- Create: `packages/client/src/__tests__/ShipDetailPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// packages/client/src/__tests__/ShipDetailPanel.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShipDetailPanel } from '../components/ShipDetailPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({ network: {} }));

const baseShip = {
  id: 's1',
  ownerId: 'p1',
  hullType: 'scout' as const,
  name: 'NIGHTFALL',
  modules: [
    { moduleId: 'mining_laser_mk1', slotIndex: 0 },
    { moduleId: 'cargo_expander_small', slotIndex: 1 },
  ],
  stats: {
    fuelMax: 100, cargoCap: 50, jumpRange: 3, apCostJump: 1, fuelPerJump: 5,
    hp: 80, commRange: 3, scannerLevel: 1, damageMod: 1, shieldHp: 0,
    shieldRegen: 0, weaponAttack: 5, weaponType: 'kinetic' as const,
    weaponPiercing: 0, pointDefense: 0, ecmReduction: 0, engineSpeed: 1,
    artefactChanceBonus: 0,
  },
  fuel: 100,
  active: true,
};

describe('ShipDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ ship: null, monitorModes: {}, setMonitorMode: vi.fn() } as any);
  });

  it('renders nothing when no ship', () => {
    const { container } = render(<ShipDetailPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('shows ship name', () => {
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/NIGHTFALL/)).toBeDefined();
  });

  it('shows ACEP path labels when acepXp present', () => {
    mockStoreState({
      ship: {
        ...baseShip,
        acepXp: { ausbau: 34, intel: 22, kampf: 48, explorer: 10, total: 114 },
      },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText('CNST')).toBeDefined();
    expect(screen.getByText('34')).toBeDefined();
    expect(screen.getByText('CMBT')).toBeDefined();
  });

  it('shows zero bars when no acepXp', () => {
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText('ACEP PATHS')).toBeDefined();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows NO TRAITS ACTIVE YET when acepTraits empty', () => {
    mockStoreState({
      ship: { ...baseShip, acepTraits: [] },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/NO TRAITS ACTIVE YET/)).toBeDefined();
  });

  it('shows active traits from acepTraits', () => {
    mockStoreState({
      ship: {
        ...baseShip,
        acepXp: { ausbau: 34, intel: 0, kampf: 48, explorer: 0, total: 82 },
        acepTraits: ['reckless', 'veteran'],
      },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/RECKLESS/)).toBeDefined();
    expect(screen.getByText(/VETERAN/)).toBeDefined();
  });

  it('shows module section', () => {
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/MODULES/)).toBeDefined();
  });

  it('[ACEP →] button calls setMonitorMode with SHIP-SYS and acep', async () => {
    const setMonitorMode = vi.fn();
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode } as any);
    render(<ShipDetailPanel />);
    await userEvent.click(screen.getByText('[ACEP →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('SHIP-SYS', 'acep');
  });

  it('[MODULES →] button calls setMonitorMode with SHIP-SYS and modules', async () => {
    const setMonitorMode = vi.fn();
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode } as any);
    render(<ShipDetailPanel />);
    await userEvent.click(screen.getByText('[MODULES →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('SHIP-SYS', 'modules');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/client && npx vitest run src/__tests__/ShipDetailPanel.test.tsx
```

Expected: FAIL — component does not exist yet

- [ ] **Step 3: Implement `ShipDetailPanel`**

```tsx
// packages/client/src/components/ShipDetailPanel.tsx
import { useStore } from '../state/store';
import { MONITORS } from '@void-sector/shared';

const ACEP_DETAIL_PATHS = [
  { key: 'ausbau' as const, label: 'CNST', color: '#ffaa00' },
  { key: 'intel'  as const, label: 'INTL', color: '#00ffcc' },
  { key: 'kampf'  as const, label: 'CMBT', color: '#ff4444' },
  { key: 'explorer' as const, label: 'EXPL', color: '#8888ff' },
];

function acepBar(xp: number, max = 50): string {
  const filled = Math.round((xp / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export function ShipDetailPanel() {
  const ship = useStore((s) => s.ship);
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  if (!ship) return null;

  const xp = ship.acepXp;
  const traits = ship.acepTraits ?? [];
  const installedModules = ship.modules ?? [];
  // Rough max-slots estimate: installed + 2 free (real cap is hull-dependent)
  const maxSlots = Math.max(installedModules.length + 2, 3);
  const freeSlots = maxSlots - installedModules.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      {/* Header */}
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', color: '#888', marginBottom: '8px' }}>
        ⬡ {ship.name}
      </div>

      {/* ACEP Paths */}
      <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: '6px 8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '1px', color: '#555', marginBottom: '6px' }}>
          ACEP PATHS
        </div>
        {ACEP_DETAIL_PATHS.map(({ key, label, color }) => {
          const val = xp ? xp[key] : 0;
          return (
            <div
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '3px' }}
            >
              <span style={{ color, width: '32px' }}>{label}</span>
              <span style={{ color, letterSpacing: '-1px', flex: 1, margin: '0 6px' }}>{acepBar(val)}</span>
              <span style={{ color: '#555', width: '24px', textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
        {/* Traits */}
        <div style={{ borderTop: '1px solid #1a1a1a', marginTop: '5px', paddingTop: '5px', fontSize: '0.67rem' }}>
          {traits.length > 0 ? (
            traits.map((t, i) => (
              <span key={t}>
                {i > 0 && <span style={{ color: '#333' }}> · </span>}
                <span style={{ color: '#ff4444' }}>⬡ {t.toUpperCase()}</span>
              </span>
            ))
          ) : (
            <span style={{ color: '#444' }}>NO TRAITS ACTIVE YET</span>
          )}
        </div>
      </div>

      {/* Modules */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '1px', color: '#555', marginBottom: '4px' }}>
          MODULES · {installedModules.length}/{maxSlots} SLOTS
        </div>
        {installedModules.length > 0 ? (
          <div style={{ color: '#aaa', fontSize: '0.68rem', lineHeight: 1.4 }}>
            {installedModules.map((m) => m.moduleId.replace(/_/g, ' ')).join(' · ')}
          </div>
        ) : (
          <div style={{ color: '#444', fontSize: '0.65rem' }}>No modules installed</div>
        )}
        <div style={{ color: '#444', fontSize: '0.65rem', marginTop: '2px' }}>
          {freeSlots} slot{freeSlots !== 1 ? 's' : ''} free
        </div>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: '4px', marginTop: 'auto' }}>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.SHIP_SYS, 'acep')}
        >
          [ACEP →]
        </button>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.SHIP_SYS, 'modules')}
        >
          [MODULES →]
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run ShipDetailPanel tests**

```bash
cd packages/client && npx vitest run src/__tests__/ShipDetailPanel.test.tsx
```

Expected: all 9 tests pass

- [ ] **Step 5: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/ShipDetailPanel.tsx \
        packages/client/src/__tests__/ShipDetailPanel.test.tsx
git commit -m "feat: ShipDetailPanel — ACEP paths, traits, module slots for SHIP-SYS Section 3"
```

---

### Task 7: FactionDetailPanel

**Files:**
- Create: `packages/client/src/components/FactionDetailPanel.tsx`
- Create: `packages/client/src/__tests__/FactionDetailPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// packages/client/src/__tests__/FactionDetailPanel.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionDetailPanel } from '../components/FactionDetailPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { requestHumanityReps: vi.fn() },
}));

const faction = {
  id: 'f1', name: 'STELLAR COMPACT', tag: 'SC',
  leaderId: 'p1', joinMode: 'invite' as const, memberCount: 7, createdAt: Date.now(),
};
const members = [
  { playerId: 'p1', playerName: 'Alpha', rank: 'leader' as const, joinedAt: Date.now() },
  { playerId: 'p2', playerName: 'Beta', rank: 'officer' as const, joinedAt: Date.now() },
];

function memberState(overrides: Record<string, any> = {}) {
  mockStoreState({
    faction,
    factionMembers: members,
    factionUpgrades: [],
    playerId: 'p1',
    humanityReps: {},
    recruitingFactions: [],
    monitorModes: {},
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

function noFactionState(overrides: Record<string, any> = {}) {
  mockStoreState({
    faction: null,
    factionMembers: [],
    factionUpgrades: [],
    playerId: 'p1',
    humanityReps: {},
    recruitingFactions: [],
    monitorModes: {},
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

describe('FactionDetailPanel — State A (member)', () => {
  beforeEach(() => { vi.clearAllMocks(); memberState(); });

  it('shows faction name and member count', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/STELLAR COMPACT/)).toBeDefined();
    expect(screen.getByText(/7 MEMBERS/)).toBeDefined();
  });

  it('shows player rank as LEADER', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/LEADER/)).toBeDefined();
  });

  it('shows OFFICER rank for officer player', () => {
    memberState({ playerId: 'p2' });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/OFFICER/)).toBeDefined();
  });

  it('shows active upgrades', () => {
    memberState({
      factionUpgrades: [{ tier: 1, choice: 'A', chosenAt: Date.now() }],
    });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/AKTIVE UPGRADES/)).toBeDefined();
  });

  it('shows next tier info when upgrades remain', () => {
    // No upgrades chosen — tier 1 is next
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NÄCHSTER UPGRADE/)).toBeDefined();
    expect(screen.getByText(/TIER 1/)).toBeDefined();
  });

  it('[MEMBERS →] calls setMonitorMode(FACTION, members)', async () => {
    const setMonitorMode = vi.fn();
    memberState({ setMonitorMode });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[MEMBERS →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'members');
  });

  it('[UPGRADES →] calls setMonitorMode(FACTION, upgrades)', async () => {
    const setMonitorMode = vi.fn();
    memberState({ setMonitorMode });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[UPGRADES →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'upgrades');
  });
});

describe('FactionDetailPanel — State B (non-member)', () => {
  beforeEach(() => { vi.clearAllMocks(); noFactionState(); });

  it('shows LOADING when humanityReps empty', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/HUMANITY REP: LOADING/)).toBeDefined();
  });

  it('shows humanity rep tier and value', () => {
    noFactionState({
      humanityReps: {
        aliens1: { repValue: 12, tier: 'NEUTRAL' as const },
      },
    });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NEUTRAL/)).toBeDefined();
    expect(screen.getByText(/\+12/)).toBeDefined();
  });

  it('shows NO CONNECTION when no recruiting factions', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NO CONNECTION TO NETWORK/)).toBeDefined();
  });

  it('shows recruiting faction card with name and slogan', () => {
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'STELLAR COMPACT', color: null, slogan: 'Mine together', memberCount: 7 },
      ],
    });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/STELLAR COMPACT/)).toBeDefined();
    expect(screen.getByText(/Mine together/)).toBeDefined();
    expect(screen.getByText(/1 OF 1/)).toBeDefined();
  });

  it('does not show progress dots when only 1 recruiting faction', () => {
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'IRON VEIL', color: null, slogan: null, memberCount: 4 },
      ],
    });
    render(<FactionDetailPanel />);
    expect(screen.queryByTestId('progress-dots')).toBeNull();
  });

  it('shows progress dots for multiple recruiting factions', () => {
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'A', color: null, slogan: 'Slogan A', memberCount: 3 },
        { factionId: 'f2', name: 'B', color: null, slogan: 'Slogan B', memberCount: 5 },
      ],
    });
    render(<FactionDetailPanel />);
    expect(screen.getByTestId('progress-dots')).toBeDefined();
  });

  it('faction card button calls setMonitorMode(FACTION, info)', async () => {
    const setMonitorMode = vi.fn();
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'IRON VEIL', color: null, slogan: null, memberCount: 4 },
      ],
      setMonitorMode,
    });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[IRON VEIL →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'info');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/client && npx vitest run src/__tests__/FactionDetailPanel.test.tsx
```

Expected: FAIL — component does not exist yet

- [ ] **Step 3: Implement `FactionDetailPanel`**

```tsx
// packages/client/src/components/FactionDetailPanel.tsx
import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { MONITORS, FACTION_UPGRADE_TIERS } from '@void-sector/shared';
import { network } from '../network/client';

function getRepTier(rep: number): string {
  if (rep < -200) return 'FEINDSELIG';
  if (rep > 200) return 'FREUNDLICH';
  return 'NEUTRAL';
}

export function FactionDetailPanel() {
  const faction = useStore((s) => s.faction);
  if (faction) return <FactionMemberPanel />;
  return <FactionRecruitPanel />;
}

function FactionMemberPanel() {
  const faction = useStore((s) => s.faction)!;
  const members = useStore((s) => s.factionMembers);
  const factionUpgrades = useStore((s) => s.factionUpgrades);
  const playerId = useStore((s) => s.playerId);
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';

  const activeUpgrades = factionUpgrades.map((u) => {
    const tierDef = FACTION_UPGRADE_TIERS[u.tier];
    const opt = u.choice === 'A' ? tierDef.optionA : tierDef.optionB;
    return opt.name;
  });

  const nextTierNum = [1, 2, 3].find((t) => !factionUpgrades.some((u) => u.tier === t));
  const nextTierDef = nextTierNum ? FACTION_UPGRADE_TIERS[nextTierNum] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', color: '#ffb000', marginBottom: '8px' }}>
        ◈ {faction.name} · {faction.memberCount} MEMBERS
      </div>

      <div style={{ background: '#0a0800', border: '1px solid #222', padding: '6px 8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>DEIN RANG</div>
        <div style={{ color: '#fff', fontSize: '0.9rem' }}>{myRank.toUpperCase()}</div>
      </div>

      {activeUpgrades.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>AKTIVE UPGRADES</div>
          <div style={{ color: '#aaa', fontSize: '0.68rem' }}>
            {activeUpgrades.map((u) => `✓ ${u}`).join('  ')}
          </div>
        </div>
      )}

      {nextTierDef && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>NÄCHSTER UPGRADE</div>
          <div style={{ color: '#ffb000', fontSize: '0.68rem' }}>
            → TIER {nextTierNum} — {nextTierDef.cost} CR
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', marginTop: 'auto' }}>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.FACTION, 'members')}
        >
          [MEMBERS →]
        </button>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.FACTION, 'upgrades')}
        >
          [UPGRADES →]
        </button>
      </div>
    </div>
  );
}

function FactionRecruitPanel() {
  const humanityReps = useStore((s) => s.humanityReps);
  const recruitingFactions = useStore((s) => s.recruitingFactions);
  const setMonitorMode = useStore((s) => s.setMonitorMode);
  const [cardIdx, setCardIdx] = useState(0);

  useEffect(() => {
    network.requestHumanityReps();
  }, []);

  useEffect(() => {
    if (recruitingFactions.length <= 1) return;
    const t = setInterval(() => {
      setCardIdx((i) => (i + 1) % recruitingFactions.length);
    }, 5000);
    return () => clearInterval(t);
  }, [recruitingFactions.length]);

  const repEntries = Object.values(humanityReps);
  const totalRep = repEntries.reduce((sum, e) => sum + e.repValue, 0);
  const repTier = repEntries.length > 0 ? getRepTier(totalRep) : null;
  const currentCard = recruitingFactions[cardIdx] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '10px' }}>
        {repTier ? (
          <>
            ◈ HUMANITY REP:{' '}
            <span style={{ color: '#00ffcc' }}>
              {repTier} {totalRep >= 0 ? '+' : ''}{totalRep}
            </span>
          </>
        ) : (
          <span style={{ color: '#555' }}>◈ HUMANITY REP: LOADING...</span>
        )}
      </div>

      {recruitingFactions.length === 0 ? (
        <div style={{ color: '#444', fontSize: '0.7rem' }}>NO CONNECTION TO NETWORK...</div>
      ) : (
        <>
          <div style={{ fontSize: '0.62rem', letterSpacing: '1px', color: '#ffb000', marginBottom: '6px' }}>
            ◈ OPEN RECRUITMENT · {cardIdx + 1} OF {recruitingFactions.length}
          </div>

          {currentCard && (
            <div
              style={{
                border: '1px solid rgba(255,176,0,0.33)',
                background: '#0a0800',
                padding: '8px 10px',
                marginBottom: '6px',
                flex: 1,
              }}
            >
              <div style={{ color: '#ffb000', fontSize: '0.75rem', marginBottom: '4px' }}>
                ⬡ {currentCard.name}
              </div>
              {currentCard.slogan && (
                <div style={{ color: '#aaa', fontSize: '0.68rem', lineHeight: 1.5, marginBottom: '4px' }}>
                  &ldquo;{currentCard.slogan}&rdquo;
                </div>
              )}
              <div style={{ color: '#555', fontSize: '0.62rem' }}>
                {currentCard.memberCount} Mitglieder
              </div>
            </div>
          )}

          {recruitingFactions.length > 1 && (
            <div
              data-testid="progress-dots"
              style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}
            >
              {recruitingFactions.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: '3px',
                    background: i === cardIdx ? '#ffb000' : '#333',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          )}

          {currentCard && (
            <button
              className="vs-btn"
              style={{ fontSize: '0.65rem', width: '100%', textAlign: 'left' }}
              onClick={() => setMonitorMode(MONITORS.FACTION, 'info')}
            >
              [{currentCard.name} →]
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run FactionDetailPanel tests**

```bash
cd packages/client && npx vitest run src/__tests__/FactionDetailPanel.test.tsx
```

Expected: all tests pass

- [ ] **Step 5: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/FactionDetailPanel.tsx \
        packages/client/src/__tests__/FactionDetailPanel.test.tsx
git commit -m "feat: FactionDetailPanel — rank/upgrades for members, humanity rep + recruiting cards for non-members"
```

---

## Chunk 3: FactionScreen Tabs + Wiring

### Task 8: FactionScreen — Tab System Rebuild

**Files:**
- Modify: `packages/client/src/components/FactionScreen.tsx`
- Modify: `packages/client/src/__tests__/FactionScreen.test.tsx`

The current `FactionScreen` is a flat layout. This task rebuilds it with four tabs: `info | members | upgrades | management`. `NoFactionView` (create/join) is preserved unchanged. Tab state comes from `monitorModes[MONITORS.FACTION]`.

- [ ] **Step 1: Update `FactionScreen.test.tsx` for the new tab structure**

Replace the entire test file:

```tsx
// packages/client/src/__tests__/FactionScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionScreen } from '../components/FactionScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestFaction: vi.fn(),
    sendCreateFaction: vi.fn(),
    sendFactionAction: vi.fn(),
    sendRespondInvite: vi.fn(),
    sendSetRecruiting: vi.fn(),
  },
}));

const baseFaction = {
  id: 'f1', name: 'Test Faction', tag: 'TST',
  leaderId: 'p1', joinMode: 'invite' as const, memberCount: 3, createdAt: Date.now(),
};
const leaderMembers = [
  { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader' as const, joinedAt: Date.now() },
  { playerId: 'p2', playerName: 'Member1', rank: 'member' as const, joinedAt: Date.now() },
];

function factionState(tab: string, overrides: Record<string, any> = {}) {
  mockStoreState({
    faction: baseFaction,
    factionMembers: leaderMembers,
    factionUpgrades: [],
    factionInvites: [],
    playerId: 'p1',
    monitorModes: { FACTION: tab },
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

describe('FactionScreen — no faction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      faction: null, factionMembers: [], factionInvites: [], factionUpgrades: [],
      playerId: 'p1', monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
  });

  it('shows create/join when not in faction', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/Keine Fraktion/)).toBeDefined();
    expect(screen.getByText('[GRÜNDEN]')).toBeDefined();
    expect(screen.getByText('[BEITRETEN]')).toBeDefined();
  });

  it('shows pending invites', () => {
    mockStoreState({
      faction: null, factionMembers: [], factionUpgrades: [],
      factionInvites: [{
        id: 'inv1', factionId: 'f1', factionName: 'Cool Faction', factionTag: 'COOL',
        inviterName: 'Leader1', status: 'pending' as const, createdAt: Date.now(),
      }],
      playerId: 'p1', monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<FactionScreen />);
    expect(screen.getByText(/COOL/)).toBeDefined();
    expect(screen.getByText(/Cool Faction/)).toBeDefined();
    expect(screen.getByText(/JA/)).toBeDefined();
    expect(screen.getByText(/NEIN/)).toBeDefined();
  });
});

describe('FactionScreen — in faction', () => {
  beforeEach(() => { vi.clearAllMocks(); factionState('info'); });

  it('shows faction name in header on info tab', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/\[TST\] Test Faction/)).toBeDefined();
  });

  it('shows tab buttons', () => {
    render(<FactionScreen />);
    expect(screen.getByText('[INFO]')).toBeDefined();
    expect(screen.getByText('[MEMBERS]')).toBeDefined();
    expect(screen.getByText('[UPGRADES]')).toBeDefined();
    expect(screen.getByText('[MGMT]')).toBeDefined();
  });

  it('tab buttons call setMonitorMode', async () => {
    const setMonitorMode = vi.fn();
    factionState('info', { setMonitorMode });
    render(<FactionScreen />);
    await userEvent.click(screen.getByText('[MEMBERS]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'members');
  });

  it('shows member list on members tab', () => {
    factionState('members');
    render(<FactionScreen />);
    expect(screen.getByText(/TestPlayer/)).toBeDefined();
    expect(screen.getByText(/Member1/)).toBeDefined();
  });

  it('shows upgrade tree on upgrades tab', () => {
    factionState('upgrades');
    render(<FactionScreen />);
    expect(screen.getByText(/VERBESSERUNGSBAUM/)).toBeDefined();
  });

  it('shows management controls for leader on management tab', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/EINLADEN/)).toBeDefined();
    expect(screen.getByText(/MODUS/)).toBeDefined();
    expect(screen.getByText(/AUFLÖSEN/)).toBeDefined();
  });

  it('shows invite code in management tab for code mode', () => {
    factionState('management', {
      faction: { ...baseFaction, joinMode: 'code' as const, inviteCode: 'ABC123' },
    });
    render(<FactionScreen />);
    expect(screen.getByText(/ABC123/)).toBeDefined();
  });

  it('shows recruiting toggle in management tab for leader', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/AKTIV REKRUTIEREN/)).toBeDefined();
  });

  it('[VERLASSEN] visible for non-leader on management tab', () => {
    factionState('management', { playerId: 'p2' });
    render(<FactionScreen />);
    expect(screen.getByText(/VERLASSEN/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the updated tests — they should fail (component not yet rebuilt)**

```bash
cd packages/client && npx vitest run src/__tests__/FactionScreen.test.tsx
```

Expected: multiple failures (tab structure doesn't exist yet)

- [ ] **Step 3: Rebuild `FactionScreen.tsx` with tabs**

Replace the entire file:

```tsx
// packages/client/src/components/FactionScreen.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MONITORS, FACTION_UPGRADE_TIERS } from '@void-sector/shared';
import type { FactionJoinMode, FactionUpgradeChoice } from '@void-sector/shared';

type FactionTab = 'info' | 'members' | 'upgrades' | 'management';

export function FactionScreen() {
  const faction = useStore((s) => s.faction);
  const invites = useStore((s) => s.factionInvites);

  useEffect(() => {
    network.requestFaction();
  }, []);

  if (!faction) {
    return <NoFactionView invites={invites} />;
  }

  return <FactionTabView />;
}

function FactionTabView() {
  const faction = useStore((s) => s.faction)!;
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);
  const tab = (useStore((s) => s.monitorModes[MONITORS.FACTION]) ?? 'info') as FactionTab;
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';
  const isLeader = myRank === 'leader';

  const tabs: { id: FactionTab; label: string }[] = [
    { id: 'info', label: '[INFO]' },
    { id: 'members', label: '[MEMBERS]' },
    { id: 'upgrades', label: '[UPGRADES]' },
    { id: 'management', label: '[MGMT]' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      {/* Header — always visible */}
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '4px' }}>
        FRAKTION
      </div>
      <div style={{ fontSize: '1rem', marginBottom: '8px' }}>
        [{faction.tag}] {faction.name}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`vs-btn${tab === t.id ? ' vs-btn-active' : ''}`}
            style={{ fontSize: '0.7rem' }}
            onClick={() => setMonitorMode(MONITORS.FACTION, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'info' && <InfoTab faction={faction} />}
        {tab === 'members' && <MembersTab isLeader={isLeader} isOfficer={myRank === 'officer'} />}
        {tab === 'upgrades' && <UpgradesTab isLeader={isLeader} />}
        {tab === 'management' && <ManagementTab isLeader={isLeader} />}
      </div>
    </div>
  );
}

function InfoTab({ faction }: { faction: any }) {
  return (
    <div style={{ fontSize: '0.8rem' }}>
      <div style={{ opacity: 0.7, marginBottom: '6px' }}>
        Modus: {faction.joinMode.toUpperCase()} | {faction.memberCount} Mitglieder
      </div>
    </div>
  );
}

function MembersTab({ isLeader, isOfficer }: { isLeader: boolean; isOfficer: boolean }) {
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);

  return (
    <div>
      <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>MITGLIEDER</div>
      {members.map((m) => (
        <div
          key={m.playerId}
          style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px', fontSize: '0.8rem' }}
        >
          <span style={{ opacity: 0.5, width: '32px' }}>
            {m.rank === 'leader' ? 'LDR' : m.rank === 'officer' ? 'OFF' : 'MBR'}
          </span>
          <span style={{ flex: 1 }}>{m.playerName}</span>
          {isLeader && m.playerId !== playerId && (
            <>
              {m.rank === 'member' && (
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                  onClick={() => network.sendFactionAction('promote', { targetPlayerId: m.playerId })}
                >
                  [+]
                </button>
              )}
              {m.rank === 'officer' && (
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                  onClick={() => network.sendFactionAction('demote', { targetPlayerId: m.playerId })}
                >
                  [-]
                </button>
              )}
              <button
                className="vs-btn"
                style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                onClick={() => network.sendFactionAction('kick', { targetPlayerId: m.playerId })}
              >
                [X]
              </button>
            </>
          )}
          {isOfficer && m.rank === 'member' && m.playerId !== playerId && (
            <button
              className="vs-btn"
              style={{ fontSize: '0.7rem', padding: '1px 4px' }}
              onClick={() => network.sendFactionAction('kick', { targetPlayerId: m.playerId })}
            >
              [X]
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function UpgradesTab({ isLeader }: { isLeader: boolean }) {
  const factionUpgrades = useStore((s) => s.factionUpgrades);

  return (
    <div>
      <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '6px', letterSpacing: '0.1em' }}>
        VERBESSERUNGSBAUM
      </div>
      {[1, 2, 3].map((tier) => {
        const tierDef = FACTION_UPGRADE_TIERS[tier];
        const chosen = factionUpgrades.find((u) => u.tier === tier);
        const prevChosen = tier === 1 || factionUpgrades.some((u) => u.tier === tier - 1);

        return (
          <div key={tier} style={{ marginBottom: 12, opacity: prevChosen ? 1 : 0.3 }}>
            <div style={{ fontSize: '0.75rem', marginBottom: 4, opacity: 0.6 }}>
              TIER {tier} — {tierDef.cost} CR
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['A', 'B'] as FactionUpgradeChoice[]).map((choice) => {
                const opt = choice === 'A' ? tierDef.optionA : tierDef.optionB;
                const isChosen = chosen?.choice === choice;
                const isOtherChosen = chosen && chosen.choice !== choice;
                return (
                  <button
                    key={choice}
                    disabled={!!chosen || !isLeader || !prevChosen}
                    onClick={() => network.sendFactionUpgrade(tier, choice)}
                    style={{
                      flex: 1,
                      background: isChosen ? 'rgba(255,176,0,0.2)' : 'transparent',
                      border: `1px solid ${isChosen ? '#FFB000' : 'rgba(255,176,0,0.3)'}`,
                      color: isOtherChosen ? 'rgba(255,176,0,0.3)' : '#FFB000',
                      padding: '6px',
                      fontFamily: 'inherit',
                      fontSize: '0.75rem',
                      cursor: chosen || !isLeader ? 'default' : 'pointer',
                      textDecoration: isOtherChosen ? 'line-through' : 'none',
                    }}
                  >
                    <div>{opt.name}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{opt.effect}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManagementTab({ isLeader }: { isLeader: boolean }) {
  const faction = useStore((s) => s.faction)!;
  const [recruiting, setRecruiting] = useState(false);
  const [slogan, setSlogan] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {isLeader && faction.joinMode === 'code' && faction.inviteCode && (
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Code: {faction.inviteCode}</div>
      )}

      {/* Invite + join mode + disband / leave */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {isLeader && <InviteButton />}
        {isLeader && <JoinModeSelector currentMode={faction.joinMode} />}
        {isLeader && (
          <button
            className="vs-btn"
            onClick={() => {
              if (confirm('Fraktion auflösen?')) network.sendFactionAction('disband');
            }}
          >
            [AUFLÖSEN]
          </button>
        )}
        {!isLeader && (
          <button className="vs-btn" onClick={() => network.sendFactionAction('leave')}>
            [VERLASSEN]
          </button>
        )}
      </div>

      {/* Recruiting section — leader only */}
      {isLeader && (
        <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '6px' }}>RECRUITING</div>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={recruiting}
              onChange={(e) => setRecruiting(e.target.checked)}
            />
            AKTIV REKRUTIEREN
          </label>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>
            Slogan (max 160 Zeichen):
          </div>
          <textarea
            className="vs-input"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value.slice(0, 160))}
            maxLength={160}
            rows={3}
            style={{ width: '100%', resize: 'none', marginBottom: '4px' }}
          />
          <div style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'right', marginBottom: '6px' }}>
            {slogan.length}/160
          </div>
          <button
            className="vs-btn"
            onClick={() => network.sendSetRecruiting(recruiting, slogan || null)}
          >
            [SPEICHERN]
          </button>
        </div>
      )}
    </div>
  );
}

function NoFactionView({ invites }: { invites: any[] }) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [joinMode, setJoinMode] = useState<FactionJoinMode>('invite');
  const [code, setCode] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '8px' }}>
        FRAKTION
      </div>
      <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '12px' }}>Keine Fraktion</div>

      {invites.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>EINLADUNGEN</div>
          {invites.map((inv: any) => (
            <div
              key={inv.id}
              style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem', flexWrap: 'wrap' }}
            >
              <span>[{inv.factionTag}] {inv.factionName}</span>
              <span style={{ opacity: 0.5 }}>von {inv.inviterName}</span>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendRespondInvite(inv.id, true)}>[JA]</button>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendRespondInvite(inv.id, false)}>[NEIN]</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button className={`vs-btn ${tab === 'create' ? 'vs-btn-active' : ''}`} onClick={() => setTab('create')}>
          [GRÜNDEN]
        </button>
        <button className={`vs-btn ${tab === 'join' ? 'vs-btn-active' : ''}`} onClick={() => setTab('join')}>
          [BEITRETEN]
        </button>
      </div>

      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input className="vs-input" placeholder="Fraktionsname" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={64} />
          <input className="vs-input" placeholder="Tag (3-5 Zeichen)" value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={5} />
          <select className="vs-input" value={joinMode} onChange={(e) => setJoinMode(e.target.value as FactionJoinMode)}>
            <option value="open">Offen</option>
            <option value="code">Einladungscode</option>
            <option value="invite">Nur Einladung</option>
          </select>
          <button className="vs-btn" disabled={name.trim().length < 3 || tag.trim().length < 3}
            onClick={() => network.sendCreateFaction(name.trim(), tag.trim(), joinMode)}>
            [FRAKTION GRÜNDEN]
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Einladungscode eingeben:</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="vs-input" placeholder="CODE" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
            <button className="vs-btn" disabled={code.length < 4}
              onClick={() => network.sendFactionAction('joinCode', { code })}>
              [BEITRETEN]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteButton() {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return <button className="vs-btn" onClick={() => setOpen(true)}>[EINLADEN]</button>;
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <input className="vs-input" placeholder="Spielername" value={name}
        onChange={(e) => setName(e.target.value)} style={{ width: '120px' }} />
      <button className="vs-btn" disabled={!name.trim()}
        onClick={() => {
          network.sendFactionAction('invite', { targetPlayerName: name.trim() });
          setName('');
          setOpen(false);
        }}>[OK]</button>
      <button className="vs-btn" onClick={() => setOpen(false)}>[X]</button>
    </div>
  );
}

function JoinModeSelector({ currentMode }: { currentMode: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <button className="vs-btn" onClick={() => setOpen(true)}>[MODUS]</button>;
  }

  const modes: FactionJoinMode[] = ['open', 'code', 'invite'];
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {modes.map((m) => (
        <button key={m}
          className={`vs-btn ${m === currentMode ? 'vs-btn-active' : ''}`}
          onClick={() => { network.sendFactionAction('setJoinMode', { joinMode: m }); setOpen(false); }}
        >
          [{m.toUpperCase()}]
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run FactionScreen tests**

```bash
cd packages/client && npx vitest run src/__tests__/FactionScreen.test.tsx
```

Expected: all tests pass

- [ ] **Step 5: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass (including FactionUpgradeTree tests which test the upgrade tree logic independently)

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/FactionScreen.tsx \
        packages/client/src/__tests__/FactionScreen.test.tsx
git commit -m "feat: FactionScreen tab system (info/members/upgrades/management) + recruiting UI"
```

---

### Task 9: CockpitLayout + GameScreen Wiring

**Files:**
- Modify: `packages/client/src/components/CockpitLayout.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

- [ ] **Step 1: Write a test for `getDetailForProgram` FACTION and SHIP-SYS**

Check if a `CockpitLayout.test.tsx` exists:

```bash
ls packages/client/src/__tests__/CockpitLayout.test.tsx 2>/dev/null || echo "no test file"
```

If no test file exists, create a minimal one:

```tsx
// packages/client/src/__tests__/CockpitLayout.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CockpitLayout } from '../components/CockpitLayout';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({ network: { requestHumanityReps: vi.fn(), requestFaction: vi.fn() } }));
// Mock child components to avoid pulling in their deps
vi.mock('../components/ProgramSelector', () => ({ ProgramSelector: () => null }));
vi.mock('../components/SettingsPanel', () => ({ SettingsPanel: () => null }));
vi.mock('../components/HardwareControls', () => ({ HardwareControls: () => null }));
vi.mock('../components/UnifiedBezel', () => ({ UnifiedBezel: ({ children }: any) => <div>{children}</div> }));
vi.mock('../components/HUD', () => ({ SectorInfo: () => null, StatusBar: () => null }));
vi.mock('../components/NavControls', () => ({ NavControls: () => null }));
vi.mock('../components/ShipStatusPanel', () => ({ ShipStatusPanel: () => null }));
vi.mock('../components/CombatStatusPanel', () => ({ CombatStatusPanel: () => null }));
vi.mock('../components/CommsScreen', () => ({ CommsScreen: () => null }));
vi.mock('../components/PlayerContextMenu', () => ({ PlayerContextMenu: () => null }));
vi.mock('../components/overlays/StoryEventOverlay', () => ({ StoryEventOverlay: () => null }));
vi.mock('../components/overlays/FirstContactNewsOverlay', () => ({ FirstContactNewsOverlay: () => null }));
vi.mock('../components/overlays/AlienEncounterToast', () => ({ AlienEncounterToast: () => null }));

describe('CockpitLayout getDetailForProgram', () => {
  it('renders FactionDetailPanel in Section 3 when FACTION active', () => {
    mockStoreState({
      activeProgram: 'FACTION',
      faction: null,
      factionMembers: [], factionUpgrades: [], factionInvites: [],
      playerId: 'p1',
      humanityReps: {}, recruitingFactions: [],
      monitorModes: { DETAIL: 'detail' },
      monitorPower: { DETAIL: true },
      setMonitorMode: vi.fn(),
      zoomLevel: 1, panOffset: { x: 0, y: 0 },
      chatChannel: 'sector' as const,
      channelAlerts: {},
      autoFollow: false,
    } as any);
    render(<CockpitLayout renderScreen={() => null} />);
    // FactionDetailPanel renders for non-member: shows LOADING text
    expect(screen.getByText(/HUMANITY REP: LOADING/)).toBeDefined();
  });

  it('renders ShipDetailPanel in Section 3 when SHIP-SYS active', () => {
    mockStoreState({
      activeProgram: 'SHIP-SYS',
      ship: {
        id: 's1', ownerId: 'p1', hullType: 'scout' as const, name: 'NIGHTFALL',
        modules: [], stats: {} as any, fuel: 100, active: true,
      },
      monitorModes: { DETAIL: 'detail' },
      monitorPower: { DETAIL: true },
      setMonitorMode: vi.fn(),
      zoomLevel: 1, panOffset: { x: 0, y: 0 },
      chatChannel: 'sector' as const,
      channelAlerts: {},
      autoFollow: false,
    } as any);
    render(<CockpitLayout renderScreen={() => null} />);
    expect(screen.getByText(/NIGHTFALL/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run new test to confirm failure**

```bash
cd packages/client && npx vitest run src/__tests__/CockpitLayout.test.tsx
```

Expected: FAIL (FACTION and SHIP-SYS not wired into getDetailForProgram yet)

- [ ] **Step 3: Wire panels into `CockpitLayout.tsx`**

In `CockpitLayout.tsx`, add two imports after the existing detail panel imports:

```ts
import { FactionDetailPanel } from './FactionDetailPanel';
import { ShipDetailPanel } from './ShipDetailPanel';
```

In `getDetailForProgram`, add two new cases before the `default`:

```ts
case 'FACTION':
  return <FactionDetailPanel />;
case 'SHIP-SYS':
  return <ShipDetailPanel />;
```

- [ ] **Step 4: Add `'acep'` placeholder to `ShipSysScreen` in `GameScreen.tsx`**

In `GameScreen.tsx`, find the `ShipSysView` type (~line 40):

```ts
type ShipSysView = 'settings' | 'modules' | 'hangar';
```

Change to:

```ts
type ShipSysView = 'settings' | 'modules' | 'hangar' | 'acep';
```

In `ShipSysScreen` (~line 246), add the `acep` branch:

```tsx
{view === 'acep' && (
  <div style={{ padding: '12px', color: '#555', fontSize: '0.8rem' }}>
    ACEP — COMING SOON
  </div>
)}
```

- [ ] **Step 5: Run CockpitLayout tests**

```bash
cd packages/client && npx vitest run src/__tests__/CockpitLayout.test.tsx
```

Expected: all tests pass

- [ ] **Step 6: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass

- [ ] **Step 7: Run server tests to confirm no regressions**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/components/CockpitLayout.tsx \
        packages/client/src/components/GameScreen.tsx \
        packages/client/src/__tests__/CockpitLayout.test.tsx
git commit -m "feat: wire FactionDetailPanel + ShipDetailPanel into CockpitLayout; add acep placeholder in ShipSysScreen"
```

---

## Final Verification

- [ ] **Run all tests one final time**

```bash
cd packages/client && npx vitest run
cd packages/server && npx vitest run
cd packages/shared && npx vitest run
```

Expected: all pass

- [ ] **TypeScript check**

```bash
cd packages/client && npx tsc --noEmit
cd packages/server && npx tsc --noEmit
```

Expected: no type errors
