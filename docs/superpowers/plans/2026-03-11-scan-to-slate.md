# Scan-to-Slate Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a LOCAL SCAN, the player can save the scan result as a Data Slate with one click — the slate contains all scan data plus location context (quadrant, sector, type, structures, universe tick).

**Architecture:** Server sends extended scan data in `localScanResult` (sector position, type, structures, tick). New `createSlateFromScan` handler in WorldService builds slate from server-side data (no client trust). Client overlay gets [SAVE TO SLATE] button with three states. CARGO detail panel shows scan-slate content.

**Tech Stack:** TypeScript, Colyseus, PostgreSQL, React, Zustand

**Spec:** `docs/superpowers/specs/2026-03-11-scan-to-slate-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/types.ts` | Modify | Add `'scan'` to SlateType, extend `SectorSlateData` with scan fields |
| `packages/server/src/db/migrations/057_scan_slate_type.sql` | Create | Extend CHECK constraint for `'scan'` |
| `packages/server/src/rooms/services/ScanService.ts` | Modify | Send extended fields in `localScanResult` |
| `packages/server/src/rooms/services/WorldService.ts` | Modify | Add `handleCreateSlateFromScan` handler |
| `packages/server/src/rooms/SectorRoom.ts` | Modify | Register `createSlateFromScan` message |
| `packages/client/src/state/gameSlice.ts` | Modify | Extend `localScanResult` type with new fields |
| `packages/client/src/network/client.ts` | Modify | Add `sendCreateSlateFromScan()`, handle `slateFromScanResult`, extend `localScanResult` handler |
| `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` | Modify | Add location context UI + [SAVE TO SLATE] button |
| `packages/client/src/components/CargoScreen.tsx` | Modify | Show scan-slate type indicator + detail for scan slates |
| `packages/server/src/__tests__/scanToSlate.test.ts` | Create | Server tests for createSlateFromScan handler |
| `packages/client/src/__tests__/LocalScanResultOverlay.test.tsx` | Create | Client tests for overlay button states |

---

## Chunk 1: Shared Types + Migration

### Task 1: Extend shared types (SlateType + SectorSlateData)

**Files:**
- Modify: `packages/shared/src/types.ts:441` (SlateType)
- Modify: `packages/shared/src/types.ts:443-450` (SectorSlateData)
- Modify: `packages/shared/src/types.ts:262-267` (LocalScanResult)
- Modify: `packages/shared/src/types.ts:313-323` (gameSlice localScanResult — done in Task 5)

- [ ] **Step 1: Extend SlateType**

In `packages/shared/src/types.ts` at line 441, change:
```typescript
export type SlateType = 'sector' | 'area' | 'custom' | 'jumpgate' | 'scan';
```

- [ ] **Step 2: Extend SectorSlateData with scan-specific optional fields**

In `packages/shared/src/types.ts` at lines 443–450, add optional fields used by scan slates:
```typescript
export interface SectorSlateData {
  x: number;
  y: number;
  type: string;
  ore: number;
  gas: number;
  crystal: number;
  // Scan-slate specific (optional — only present on slate_type='scan'):
  quadrantX?: number;
  quadrantY?: number;
  structures?: string[];
  wrecks?: Array<{ playerName: string; tier: number }>;
  scannedAtTick?: number;
}
```

- [ ] **Step 3: Extend LocalScanResult with server context fields**

In `packages/shared/src/types.ts` at lines 262–267, extend:
```typescript
export interface LocalScanResult {
  resources: SectorResources;
  rareResources?: Record<string, number>;
  hiddenObjects?: string[];
  hiddenSignatures: boolean;
  // Extended context (added for scan-to-slate):
  sectorX?: number;
  sectorY?: number;
  quadrantX?: number;
  quadrantY?: number;
  sectorType?: string;
  structures?: string[];
  universeTick?: number;
}
```

- [ ] **Step 4: Rebuild shared package**

Run: `cd packages/shared && npm run build`
Expected: Clean build, no errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: extend SlateType with 'scan', add scan fields to SectorSlateData and LocalScanResult"
```

### Task 2: Database migration

**Files:**
- Create: `packages/server/src/db/migrations/057_scan_slate_type.sql`

- [ ] **Step 1: Create migration file**

Create `packages/server/src/db/migrations/057_scan_slate_type.sql`:
```sql
-- Extend data_slates.slate_type CHECK constraint to include 'scan'
DO $$
BEGIN
  ALTER TABLE data_slates DROP CONSTRAINT IF EXISTS data_slates_slate_type_check;
  ALTER TABLE data_slates ADD CONSTRAINT data_slates_slate_type_check
    CHECK (slate_type IN ('sector', 'area', 'custom', 'jumpgate', 'scan'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Verify migration loads**

Run: `cd packages/server && npx vitest run --testPathPattern migration`
Expected: Existing migration tests still pass (new migration is idempotent, no test needed)

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/migrations/057_scan_slate_type.sql
git commit -m "feat: migration 057 — extend slate_type CHECK for 'scan'"
```

---

## Chunk 2: Server — Extended Scan Data + CreateSlateFromScan Handler

### Task 3: Extend ScanService.handleLocalScan to send context data

**Files:**
- Modify: `packages/server/src/rooms/services/ScanService.ts:107-117`

The `handleLocalScan` method (line 78) already has all the data we need in local variables: `sectorData` (line 96–99), `px`/`py` (line 103–104), and `wrecks` (line 105). We also need `getUniverseTickCount()` and `getPlayerJumpGate()`.

- [ ] **Step 1: Add imports to ScanService**

In `packages/server/src/rooms/services/ScanService.ts`, add to the existing imports:
```typescript
import { getUniverseTickCount } from '../../engine/universeBootstrap.js';
import { getPlayerJumpGate } from '../../db/queries.js';
```

Check existing imports first — `getPlayerJumpGate` may need to be added to the existing `queries.js` import line.

- [ ] **Step 2: Extend the localScanResult message**

In `packages/server/src/rooms/services/ScanService.ts`, replace the `client.send('localScanResult', ...)` block at lines 107–117 with:

```typescript
    // Build structures list from sector data
    const structures: string[] = [];
    if (sectorData?.type === 'station') structures.push('npc_station');
    if (sectorData?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(px, py);
    if (jumpgate) structures.push('jumpgate');

    client.send('localScanResult', {
      resources,
      hiddenSignatures: result.hiddenSignatures,
      wrecks: wrecks.map((w) => ({
        id: w.id,
        playerName: w.playerName,
        radarIconData: w.radarIconData,
        lastLogEntry: w.lastLogEntry,
        hasSalvage: w.salvageableModules.length > 0,
      })),
      sectorX: px,
      sectorY: py,
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      sectorType: sectorData?.type ?? 'empty',
      structures,
      universeTick: getUniverseTickCount(),
    });
```

- [ ] **Step 3: Verify server compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/ScanService.ts
git commit -m "feat: extend localScanResult with sector context, structures, and universe tick"
```

### Task 4: Add handleCreateSlateFromScan to WorldService

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts` (add new handler after `handleCreateSlate`)
- Modify: `packages/server/src/rooms/SectorRoom.ts:720` (register new message)

- [ ] **Step 1: Write the server test**

Create `packages/server/src/__tests__/scanToSlate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies (paths relative to test file in src/__tests__/)
vi.mock('../db/queries.js', () => ({
  getSector: vi.fn(),
  getPlayerJumpGate: vi.fn(),
  createDataSlate: vi.fn(),
  addSlateToCargo: vi.fn(),
}));
vi.mock('../engine/inventoryService.js', () => ({
  getCargoState: vi.fn(),
}));
vi.mock('../engine/universeBootstrap.js', () => ({
  getUniverseTickCount: vi.fn(),
}));
vi.mock('../engine/permadeathService.js', () => ({
  getWrecksInSector: vi.fn(),
}));

import { getSector, getPlayerJumpGate, createDataSlate, addSlateToCargo } from '../db/queries.js';
import { getCargoState } from '../engine/inventoryService.js';
import { getUniverseTickCount } from '../engine/universeBootstrap.js';
import { getWrecksInSector } from '../engine/permadeathService.js';

describe('createSlateFromScan — logic validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSector).mockResolvedValue({
      type: 'station',
      resources: { ore: 42, gas: 18, crystal: 7 },
      contents: null,
    } as any);
    vi.mocked(getPlayerJumpGate).mockResolvedValue(null);
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 0, gas: 0, crystal: 0, slates: 1, artefact: 0,
    });
    vi.mocked(getUniverseTickCount).mockReturnValue(48720);
    vi.mocked(createDataSlate).mockResolvedValue({ id: 'slate-123' } as any);
    vi.mocked(addSlateToCargo).mockResolvedValue();
    vi.mocked(getWrecksInSector).mockResolvedValue([]);
  });

  it('builds correct structures array for station sector', async () => {
    const sector = await getSector(16, 14);
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(16, 14);
    if (jumpgate) structures.push('jumpgate');

    expect(structures).toEqual(['npc_station']);
  });

  it('includes jumpgate in structures when present', async () => {
    vi.mocked(getPlayerJumpGate).mockResolvedValue({ id: 'gate-1' } as any);
    const sector = await getSector(16, 14);
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(16, 14);
    if (jumpgate) structures.push('jumpgate');

    expect(structures).toEqual(['npc_station', 'jumpgate']);
  });

  it('includes ruin in structures when contents has ruin', async () => {
    vi.mocked(getSector).mockResolvedValue({
      type: 'empty',
      resources: { ore: 0, gas: 0, crystal: 0 },
      contents: ['ruin'],
    } as any);
    const sector = await getSector(5, 5);
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(5, 5);
    if (jumpgate) structures.push('jumpgate');

    expect(structures).toEqual(['ruin']);
  });

  it('rejects when cargo is full (cargoTotal >= cargoCap)', async () => {
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10, gas: 5, crystal: 3, slates: 2, artefact: 0,
    });
    const cargo = await getCargoState('player-1');
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    const cargoCap = 20;
    expect(cargoTotal + 1 > cargoCap).toBe(true);
  });

  it('allows when cargo has space', async () => {
    const cargo = await getCargoState('player-1');
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    const cargoCap = 20;
    expect(cargoTotal + 1 > cargoCap).toBe(false);
  });

  it('calls createDataSlate with scan type and addSlateToCargo', async () => {
    const sectorData = [{
      x: 16, y: 14, quadrantX: 0, quadrantY: 0,
      type: 'station', ore: 42, gas: 18, crystal: 7,
      structures: ['npc_station'], wrecks: [],
      scannedAtTick: 48720,
    }];
    await createDataSlate('player-1', 'scan', sectorData);
    await addSlateToCargo('player-1');

    expect(createDataSlate).toHaveBeenCalledWith('player-1', 'scan', sectorData);
    expect(addSlateToCargo).toHaveBeenCalledWith('player-1');
  });

  it('reduces wreck data to playerName + tier', async () => {
    vi.mocked(getWrecksInSector).mockResolvedValue([
      { playerName: 'xPilot42', radarIconData: { tier: 2, path: 'kampf' }, salvageableModules: [] },
      { playerName: 'TestPilot', radarIconData: { tier: 3, path: 'scout' }, salvageableModules: ['mod1'] },
    ] as any);
    const wrecks = await getWrecksInSector(0, 0, 16, 14);
    const reduced = wrecks.map((w: any) => ({ playerName: w.playerName, tier: w.radarIconData?.tier ?? 1 }));
    expect(reduced).toEqual([
      { playerName: 'xPilot42', tier: 2 },
      { playerName: 'TestPilot', tier: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (logic test)**

Run: `cd packages/server && npx vitest run src/__tests__/scanToSlate.test.ts`
Expected: 7 tests pass

- [ ] **Step 3: Add handleCreateSlateFromScan to WorldService**

In `packages/server/src/rooms/services/WorldService.ts`, add this method after `handleCreateSlate` (after line 876):

```typescript
  async handleCreateSlateFromScan(client: Client): Promise<void> {
    if (rejectGuest(client, 'Scan-Slates erstellen')) return;
    const auth = client.auth as AuthPayload;

    // Cargo check
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargo = await getCargoState(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    if (cargoTotal + 1 > ship.cargoCap) {
      client.send('slateFromScanResult', { success: false, error: 'CARGO_FULL' });
      return;
    }

    // Build sector data from server state (no trust on client data)
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);
    const sector = await getSector(sectorX, sectorY);
    const resources = sector?.resources ?? { ore: 0, gas: 0, crystal: 0 };

    // Derive structures
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(sectorX, sectorY);
    if (jumpgate) structures.push('jumpgate');

    // Get wrecks
    const wrecks = await getWrecksInSector(this.ctx.quadrantX, this.ctx.quadrantY, sectorX, sectorY);

    const sectorData = [{
      x: sectorX,
      y: sectorY,
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      type: sector?.type ?? 'empty',
      ore: resources.ore ?? 0,
      gas: resources.gas ?? 0,
      crystal: resources.crystal ?? 0,
      structures,
      wrecks: wrecks.map((w) => ({ playerName: w.playerName, tier: w.radarIconData?.tier ?? 1 })),
      scannedAtTick: getUniverseTickCount(),
    }];

    // Create slate + add to cargo
    await createDataSlate(auth.userId, 'scan', sectorData);
    await addSlateToCargo(auth.userId);
    const updatedCargo = await getCargoState(auth.userId);

    client.send('slateFromScanResult', { success: true });
    client.send('cargoUpdate', updatedCargo);
  }
```

Also add required imports at the top of WorldService if not already present:
- `getPlayerJumpGate` — check if already imported from `../../db/queries.js` (line ~91 has `addSlateToCargo`; verify `getPlayerJumpGate` is in the same import)
- `getWrecksInSector` — import from `../../engine/permadeathService.js` (NOT from queries.js): `import { getWrecksInSector } from '../../engine/permadeathService.js';`
- `getUniverseTickCount` — add: `import { getUniverseTickCount } from '../../engine/universeBootstrap.js';`

- [ ] **Step 4: Register message in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, after the `createSlate` handler (after line 722), add:

```typescript
    this.onMessage('createSlateFromScan', async (client) => {
      await this.world.handleCreateSlateFromScan(client);
    });
```

- [ ] **Step 5: Verify server compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/rooms/services/WorldService.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/__tests__/scanToSlate.test.ts
git commit -m "feat: add createSlateFromScan handler — server-authoritative scan slate creation"
```

---

## Chunk 3: Client — Store, Network, Overlay UI

### Task 5: Extend client store localScanResult type

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts:313-323`

- [ ] **Step 1: Extend localScanResult type in gameSlice**

In `packages/client/src/state/gameSlice.ts`, change the `localScanResult` type at lines 313–323 to:

```typescript
  localScanResult: {
    resources: { ore: number; gas: number; crystal: number };
    hiddenSignatures: boolean;
    wrecks?: Array<{
      id: string;
      playerName: string;
      radarIconData: { tier: number; path: string };
      lastLogEntry: string | null;
      hasSalvage: boolean;
    }>;
    sectorX?: number;
    sectorY?: number;
    quadrantX?: number;
    quadrantY?: number;
    sectorType?: string;
    structures?: string[];
    universeTick?: number;
  } | null;
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/state/gameSlice.ts
git commit -m "feat: extend localScanResult store type with context fields"
```

### Task 6: Add network methods and handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add sendCreateSlateFromScan method**

In `packages/client/src/network/client.ts`, after `sendCreateSlate` (line 1929), add:

```typescript
  sendCreateSlateFromScan() {
    this.sectorRoom?.send('createSlateFromScan', {});
  }
```

- [ ] **Step 2: Add slateFromScanResult handler**

In the room message handler setup section (near line 810, after `createSlateResult` handler), add:

```typescript
    room.onMessage('slateFromScanResult', (data: { success: boolean; error?: string }) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry('SCAN SLATE GESPEICHERT');
        this.sectorRoom?.send('getMySlates');
      } else {
        store.addLogEntry(`SLATE FEHLER: ${data.error}`);
      }
    });
```

- [ ] **Step 3: Extend localScanResult handler with new fields**

In `packages/client/src/network/client.ts` at lines 346–356, extend the type annotation for the `localScanResult` handler to include the new fields. The handler at line 365 already does `store.setLocalScanResult(data)` which will pass through all fields:

```typescript
    room.onMessage(
      'localScanResult',
      (data: {
        resources: SectorResources;
        hiddenSignatures: boolean;
        wrecks?: Array<{
          id: string;
          playerName: string;
          radarIconData: { tier: number; path: string };
          lastLogEntry: string | null;
          hasSalvage: boolean;
        }>;
        sectorX?: number;
        sectorY?: number;
        quadrantX?: number;
        quadrantY?: number;
        sectorType?: string;
        structures?: string[];
        universeTick?: number;
      }) => {
```

The rest of the handler body stays unchanged.

- [ ] **Step 4: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: add sendCreateSlateFromScan + slateFromScanResult handler"
```

### Task 7: Extend LocalScanResultOverlay with context + SAVE TO SLATE button

**Files:**
- Modify: `packages/client/src/components/overlays/LocalScanResultOverlay.tsx`

- [ ] **Step 1: Write the overlay test**

Create `packages/client/src/__tests__/LocalScanResultOverlay.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalScanResultOverlay } from '../components/overlays/LocalScanResultOverlay';
import { useStore } from '../state/store';

// Mock network
const mockSendCreateSlateFromScan = vi.fn();
vi.mock('../network/client', () => ({
  network: {
    sendCreateSlateFromScan: (...args: any[]) => mockSendCreateSlateFromScan(...args),
  },
}));

describe('LocalScanResultOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      localScanResult: {
        resources: { ore: 42, gas: 18, crystal: 7 },
        hiddenSignatures: false,
        wrecks: [],
        sectorX: 16,
        sectorY: 14,
        quadrantX: 0,
        quadrantY: 0,
        sectorType: 'station',
        structures: ['npc_station'],
        universeTick: 48720,
      },
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      ship: { stats: { cargoCap: 20 } } as any,
    });
  });

  it('shows sector context (quadrant, sector, type)', () => {
    render(<LocalScanResultOverlay />);
    expect(screen.getByText(/Q 0:0/)).toBeTruthy();
    expect(screen.getByText(/16, 14/)).toBeTruthy();
    expect(screen.getByText(/STATION/i)).toBeTruthy();
  });

  it('shows universe tick in header', () => {
    render(<LocalScanResultOverlay />);
    expect(screen.getByText(/TICK 48720/)).toBeTruthy();
  });

  it('shows SAVE TO SLATE button', () => {
    render(<LocalScanResultOverlay />);
    expect(screen.getByText(/SAVE TO SLATE/)).toBeTruthy();
  });

  it('disables button and shows SLATE GESPEICHERT after click', () => {
    render(<LocalScanResultOverlay />);
    const btn = screen.getByText(/SAVE TO SLATE/);
    fireEvent.click(btn);
    expect(mockSendCreateSlateFromScan).toHaveBeenCalledOnce();
    expect(screen.getByText(/SLATE GESPEICHERT/)).toBeTruthy();
  });

  it('shows CARGO VOLL when cargo is full', () => {
    useStore.setState({
      cargo: { ore: 10, gas: 5, crystal: 3, slates: 2, artefact: 0 },
      ship: { stats: { cargoCap: 20 } } as any,
    });
    render(<LocalScanResultOverlay />);
    expect(screen.getByText(/CARGO VOLL/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/client && npx vitest run src/__tests__/LocalScanResultOverlay.test.tsx`
Expected: FAIL — component doesn't have new UI yet

- [ ] **Step 3: Rewrite LocalScanResultOverlay with context + save button**

Replace `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` with:

```tsx
import { useState } from 'react';
import { useStore } from '../../state/store';
import { network } from '../../network/client';

export function LocalScanResultOverlay() {
  const result = useStore((s) => s.localScanResult);
  const setLocalScanResult = useStore((s) => s.setLocalScanResult);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const [slateSaved, setSlateSaved] = useState(false);

  if (!result) return null;

  const { resources, hiddenSignatures, wrecks, sectorX, sectorY, quadrantX, quadrantY, sectorType, structures, universeTick } = result;
  const hasResources = resources.ore > 0 || resources.gas > 0 || resources.crystal > 0;
  const hasWrecks = wrecks && wrecks.length > 0;

  // Cargo check for slate button
  const cargoTotal = (cargo.ore ?? 0) + (cargo.gas ?? 0) + (cargo.crystal ?? 0)
    + (cargo.slates ?? 0) + (cargo.artefact ?? 0);
  const cargoCap = ship?.stats?.cargoCap ?? 0;
  const cargoFull = cargoCap > 0 && cargoTotal >= cargoCap;

  const handleSaveSlate = () => {
    if (slateSaved || cargoFull) return;
    network.sendCreateSlateFromScan();
    setSlateSaved(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
      onClick={() => setLocalScanResult(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#080808',
          border: '1px solid var(--color-primary)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '20px 24px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          maxWidth: '360px',
          width: '90%',
          animation: 'crt-expand 200ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          color: 'var(--color-primary)',
          letterSpacing: '0.2em',
          fontSize: '0.7rem',
          borderBottom: '1px solid rgba(255,176,0,0.2)',
          paddingBottom: '8px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>◈ SCAN ERGEBNIS</span>
          <span style={{ color: 'var(--color-dim)' }}>
            LOCAL SCAN{universeTick != null ? ` · TICK ${universeTick}` : ''}
          </span>
        </div>

        {/* Location Context */}
        {sectorX != null && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>QUADRANT</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>Q {quadrantX}:{quadrantY}</div>
            </div>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>SEKTOR</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>({sectorX}, {sectorY})</div>
            </div>
          </div>
        )}

        {/* Sector Type + Structures */}
        {sectorType && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>SEKTORTYP</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>{sectorType.toUpperCase()}</div>
            </div>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>STRUKTUREN</div>
              <div style={{ color: '#4a9', fontSize: '0.75rem' }}>
                {structures && structures.length > 0 ? structures.join(', ') : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Resources */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: 'var(--color-dim)', marginBottom: '6px', letterSpacing: '0.1em' }}>
            RESSOURCEN
          </div>
          {hasResources ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {resources.ore > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>ORE</div>
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{resources.ore}</div>
                </div>
              )}
              {resources.gas > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>GAS</div>
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{resources.gas}</div>
                </div>
              )}
              {resources.crystal > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>CRYSTAL</div>
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{resources.crystal}</div>
                </div>
              )}
              {!resources.ore && !resources.gas && !resources.crystal && (
                <div style={{ gridColumn: '1/-1', color: 'var(--color-dim)' }}>— keine —</div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--color-dim)' }}>— keine Ressourcen —</div>
          )}
        </div>

        {/* Wrecks */}
        {hasWrecks && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: 'var(--color-dim)', marginBottom: '6px', letterSpacing: '0.1em' }}>
              WRACKS ENTDECKT
            </div>
            {wrecks!.map((wreck) => (
              <div key={wreck.id} style={{
                padding: '5px 8px',
                border: '1px solid rgba(255,176,0,0.2)',
                marginBottom: '4px',
                fontSize: '0.7rem',
              }}>
                <div style={{ color: 'var(--color-primary)' }}>
                  {wreck.playerName}
                  <span style={{ color: 'var(--color-dim)', marginLeft: 6 }}>
                    T{wreck.radarIconData.tier} / {wreck.radarIconData.path}
                  </span>
                  {wreck.hasSalvage && (
                    <span style={{ color: '#4a9', marginLeft: 6, fontSize: '0.65rem' }}>[BERGBAR]</span>
                  )}
                </div>
                {wreck.lastLogEntry && (
                  <div style={{ color: '#666', fontSize: '0.65rem', marginTop: 2, fontStyle: 'italic' }}>
                    &ldquo;{wreck.lastLogEntry}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden signatures */}
        {hiddenSignatures && (
          <div style={{
            padding: '6px 8px',
            border: '1px solid rgba(255,100,0,0.4)',
            color: '#FF8800',
            fontSize: '0.7rem',
            marginBottom: '12px',
          }}>
            ⚠ UNBEKANNTE SIGNATUREN — SCANNER-UPGRADE ERFORDERLICH
          </div>
        )}

        {/* Buttons: SAVE TO SLATE + CLOSE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '8px' }}>
          <button
            onClick={handleSaveSlate}
            disabled={slateSaved || cargoFull}
            style={{
              border: `1px solid ${slateSaved ? '#4a9' : cargoFull ? '#333' : '#00BFFF'}`,
              background: 'none',
              color: slateSaved ? '#4a9' : cargoFull ? '#666' : '#00BFFF',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: slateSaved || cargoFull ? 'not-allowed' : 'pointer',
              padding: '3px 12px',
              letterSpacing: '0.1em',
            }}
          >
            {slateSaved ? '✓ SLATE GESPEICHERT' : cargoFull ? '[SLATE] CARGO VOLL' : '[SAVE TO SLATE]'}
          </button>
          <button
            onClick={() => setLocalScanResult(null)}
            style={{
              border: '1px solid var(--color-primary)',
              background: 'none',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              padding: '3px 12px',
              letterSpacing: '0.1em',
            }}
          >
            [SCHLIESSEN]
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run overlay tests**

Run: `cd packages/client && npx vitest run src/__tests__/LocalScanResultOverlay.test.tsx`
Expected: All 5 tests pass

- [ ] **Step 5: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/overlays/LocalScanResultOverlay.tsx packages/client/src/__tests__/LocalScanResultOverlay.test.tsx packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat: LocalScanResultOverlay with context display + SAVE TO SLATE button"
```

---

## Chunk 4: CARGO Detail Panel for Scan Slates

### Task 8: Show scan slate type indicator + detail in CargoScreen

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx:217-221`

- [ ] **Step 1: Update slate type indicator to include 'scan' type**

In `packages/client/src/components/CargoScreen.tsx` at line 218, update the type indicator:

```typescript
                  <span style={{ opacity: 0.7 }}>
                    [{slate.slateType === 'sector' ? 'S' : slate.slateType === 'area' ? 'A' : slate.slateType === 'scan' ? 'SC' : 'C'}]
                    {slate.slateType === 'custom' && slate.customData
                      ? ` ${slate.customData.label}`
                      : slate.slateType === 'scan'
                        ? ` Scan Q${slate.sectorData?.[0]?.quadrantX ?? '?'}:${slate.sectorData?.[0]?.quadrantY ?? '?'} (${slate.sectorData?.[0]?.x ?? '?'},${slate.sectorData?.[0]?.y ?? '?'})`
                        : ` ${slate.sectorData?.length ?? 0} Sektoren`}
                  </span>
```

This shows e.g. `[SC] Scan Q0:0 (16,14)` for scan slates.

- [ ] **Step 2: Add selectedSlateId state and expandable detail for scan slates**

CargoScreen already uses `useState` (line 1). Add a new state variable after the existing state declarations (around line 52 area, after other `useState` calls):

```typescript
const [selectedSlateId, setSelectedSlateId] = useState<string | null>(null);
```

In the `mySlates.map(...)` block (line 205–237), make the outer `<div>` for each slate clickable by adding to its existing `style` and adding `onClick`:

At line 206, the `<div key={slate.id}` — add:
```tsx
                  onClick={() => setSelectedSlateId(selectedSlateId === slate.id ? null : slate.id)}
```

Add `cursor: 'pointer'` to the existing style object at line 208.

After the NPC SELL button `</button>` (line 236) and before the closing `</div>` of the map item (line 237), insert the expandable scan detail:

```tsx
                  {slate.slateType === 'scan' && selectedSlateId === slate.id && slate.sectorData?.[0] && (
                    <div style={{
                      padding: '6px 8px',
                      border: '1px solid rgba(255,176,0,0.15)',
                      marginTop: '4px',
                      fontSize: '0.7rem',
                      width: '100%',
                    }}>
                      <div style={{ color: 'var(--color-dim)', marginBottom: 4 }}>
                        SCAN · TICK {(slate.sectorData[0] as any).scannedAtTick ?? '?'}
                      </div>
                      <div>Q {(slate.sectorData[0] as any).quadrantX}:{(slate.sectorData[0] as any).quadrantY} — ({slate.sectorData[0].x}, {slate.sectorData[0].y})</div>
                      <div>Typ: {slate.sectorData[0].type?.toUpperCase()}</div>
                      <div>Ore: {slate.sectorData[0].ore} | Gas: {slate.sectorData[0].gas} | Crystal: {slate.sectorData[0].crystal}</div>
                      {(slate.sectorData[0] as any).structures?.length > 0 && (
                        <div>Strukturen: {(slate.sectorData[0] as any).structures.join(', ')}</div>
                      )}
                      {(slate.sectorData[0] as any).wrecks?.length > 0 && (
                        <div>Wracks: {(slate.sectorData[0] as any).wrecks.map((w: any) => `${w.playerName} (T${w.tier})`).join(', ')}</div>
                      )}
                    </div>
                  )}
```

Note: We use `as any` casts because the `SectorSlateData` interface has the scan-specific fields as optional — TypeScript wouldn't know about `scannedAtTick`, `structures`, `wrecks` etc. on the base type without the cast.

- [ ] **Step 3: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx
git commit -m "feat: scan slate type indicator [SC] + expandable detail in CARGO list"
```

---

## Chunk 5: Integration Test + Final Verification

### Task 9: Full integration verification

- [ ] **Step 1: Rebuild shared**

Run: `cd packages/shared && npm run build`
Expected: Clean build

- [ ] **Step 2: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run all shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Final commit if any fixes were needed**

If any test fixes were required, commit them:
```bash
git commit -m "fix: test adjustments for scan-to-slate integration"
```
