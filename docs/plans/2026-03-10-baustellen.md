# Baustellen — Construction Sites (#231) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace instant structure creation with a 100-tick construction process. Players deposit resources progressively; the site pauses when the resource buffer runs dry. When progress reaches 100 and all resources are consumed, the structure materializes.

**Architecture:**
1. **DB migration 050**: new `construction_sites` table (sector_x/y unique, progress 0–100, deposited/total ore/gas/crystal)
2. **Server**: `handleBuild` → creates `construction_site` (deducts AP only, not resources). New `constructionSiteService.ts` processes per-tick: advance progress if enough deposited, else mark paused.
3. **Network**: new message `depositConstruction` (client → server) lets any player add resources to a site.
4. **Universe bootstrap**: call `processConstructionTick()` in the tick callback alongside `processCivTick()`.
5. **Client**: `DetailPanel.tsx` shows "IN BAU" when a construction site exists in sector. New `ConstructionPanel` (inline in DetailPanel) shows progress bar + deposit button.

**Tech Stack:** PostgreSQL, Node.js/TypeScript, FastAPI/Colyseus, React, Vitest

---

### Task 1: DB migration for construction_sites

**Files:**
- Create: `packages/server/src/db/migrations/050_construction_sites.sql`

**Step 1: Create migration file**

```sql
-- Migration 050: Construction Sites
-- Structures now require 100 ticks to build with progressive resource delivery.

CREATE TABLE IF NOT EXISTS construction_sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  type         VARCHAR(50)  NOT NULL,            -- 'mining_station' | 'jumpgate'
  sector_x     INTEGER      NOT NULL,
  sector_y     INTEGER      NOT NULL,
  progress     INTEGER      NOT NULL DEFAULT 0,  -- 0..100 ticks
  -- Resources needed (total, mirrors STRUCTURE_COSTS[type])
  needed_ore     INTEGER NOT NULL DEFAULT 0,
  needed_gas     INTEGER NOT NULL DEFAULT 0,
  needed_crystal INTEGER NOT NULL DEFAULT 0,
  -- Resources deposited so far by any player
  deposited_ore     INTEGER NOT NULL DEFAULT 0,
  deposited_gas     INTEGER NOT NULL DEFAULT 0,
  deposited_crystal INTEGER NOT NULL DEFAULT 0,
  paused       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sector_x, sector_y)
);

CREATE INDEX IF NOT EXISTS idx_construction_sites_sector
  ON construction_sites (sector_x, sector_y);

CREATE INDEX IF NOT EXISTS idx_construction_sites_owner
  ON construction_sites (owner_id);
```

**Step 2: Apply migration**

```bash
cd /e/claude/voidSector
docker-compose exec db psql -U postgres -d voidsector -f /dev/stdin < packages/server/src/db/migrations/050_construction_sites.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX` (no errors)

**Step 3: Commit migration**

```bash
cd /e/claude/voidSector
git add packages/server/src/db/migrations/050_construction_sites.sql
git commit -m "feat(#231): migration 050 — construction_sites table"
```

---

### Task 2: DB queries for construction_sites

**Files:**
- Create: `packages/server/src/db/constructionQueries.ts`

**Step 1: Write the failing test**

Create `packages/server/src/db/__tests__/constructionQueries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
// Note: requires live DB — skip in CI if DB not available
import {
  createConstructionSite,
  getConstructionSite,
  depositResources,
  advanceProgress,
  deleteConstructionSite,
  getAllConstructionSites,
} from '../constructionQueries.js';

// These tests require a running DB. If DB unavailable, tests skip gracefully.
const TEST_OWNER = 'test-owner-uuid'; // Assumes a test player exists or we insert one

describe('constructionQueries', { skip: !process.env.TEST_DB }, () => {
  let siteId: string;

  beforeEach(async () => {
    // cleanup
    await deleteConstructionSite(100, 100).catch(() => {});
    siteId = await createConstructionSite(TEST_OWNER, 'mining_station', 100, 100, 30, 15, 10);
  });

  it('creates a site and retrieves it', async () => {
    const site = await getConstructionSite(100, 100);
    expect(site).toBeTruthy();
    expect(site!.type).toBe('mining_station');
    expect(site!.needed_ore).toBe(30);
    expect(site!.progress).toBe(0);
    expect(site!.paused).toBe(false);
  });

  it('deposits resources', async () => {
    await depositResources(siteId, 10, 5, 3);
    const site = await getConstructionSite(100, 100);
    expect(site!.deposited_ore).toBe(10);
    expect(site!.deposited_gas).toBe(5);
    expect(site!.deposited_crystal).toBe(3);
  });

  it('advances progress when resources available', async () => {
    // Deposit all needed resources
    await depositResources(siteId, 30, 15, 10);
    const advanced = await advanceProgress(siteId, 1);
    expect(advanced).toBe(true);
    const site = await getConstructionSite(100, 100);
    expect(site!.progress).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /e/claude/voidSector && npm run test -w packages/server -- constructionQueries 2>&1 | head -20
```

Expected: FAIL (functions don't exist yet)

**Step 3: Create constructionQueries.ts**

```typescript
// packages/server/src/db/constructionQueries.ts
import { db } from './connection.js';
import { STRUCTURE_COSTS } from '@void-sector/shared';
import type { StructureType } from '@void-sector/shared';

export interface ConstructionSite {
  id: string;
  owner_id: string;
  type: StructureType;
  sector_x: number;
  sector_y: number;
  progress: number;
  needed_ore: number;
  needed_gas: number;
  needed_crystal: number;
  deposited_ore: number;
  deposited_gas: number;
  deposited_crystal: number;
  paused: boolean;
  created_at: Date;
}

export async function createConstructionSite(
  ownerId: string,
  type: StructureType,
  sectorX: number,
  sectorY: number,
  neededOre: number,
  neededGas: number,
  neededCrystal: number,
): Promise<string> {
  const result = await db.query(
    `INSERT INTO construction_sites
       (owner_id, type, sector_x, sector_y, needed_ore, needed_gas, needed_crystal)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [ownerId, type, sectorX, sectorY, neededOre, neededGas, neededCrystal],
  );
  return result.rows[0].id;
}

export async function getConstructionSite(
  sectorX: number,
  sectorY: number,
): Promise<ConstructionSite | null> {
  const result = await db.query(
    'SELECT * FROM construction_sites WHERE sector_x=$1 AND sector_y=$2',
    [sectorX, sectorY],
  );
  return result.rows[0] ?? null;
}

export async function getConstructionSiteById(id: string): Promise<ConstructionSite | null> {
  const result = await db.query('SELECT * FROM construction_sites WHERE id=$1', [id]);
  return result.rows[0] ?? null;
}

export async function getAllConstructionSites(): Promise<ConstructionSite[]> {
  const result = await db.query('SELECT * FROM construction_sites ORDER BY created_at');
  return result.rows;
}

export async function depositResources(
  siteId: string,
  ore: number,
  gas: number,
  crystal: number,
): Promise<void> {
  await db.query(
    `UPDATE construction_sites
     SET deposited_ore     = deposited_ore     + $2,
         deposited_gas     = deposited_gas     + $3,
         deposited_crystal = deposited_crystal + $4,
         paused = false
     WHERE id = $1`,
    [siteId, ore, gas, crystal],
  );
}

/**
 * Try to advance progress by 1 tick.
 * Uses linear resource consumption: at progress p, need ceil(p * needed_X / 100) of each resource.
 * Returns true if progress was advanced.
 */
export async function advanceProgress(siteId: string, newProgress: number): Promise<boolean> {
  const result = await db.query(
    `UPDATE construction_sites
     SET progress = $2, paused = false
     WHERE id = $1 AND progress = $2 - 1
     RETURNING id`,
    [siteId, newProgress],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markPaused(siteId: string): Promise<void> {
  await db.query('UPDATE construction_sites SET paused=true WHERE id=$1', [siteId]);
}

export async function deleteConstructionSite(sectorX: number, sectorY: number): Promise<void> {
  await db.query(
    'DELETE FROM construction_sites WHERE sector_x=$1 AND sector_y=$2',
    [sectorX, sectorY],
  );
}

export async function deleteConstructionSiteById(id: string): Promise<void> {
  await db.query('DELETE FROM construction_sites WHERE id=$1', [id]);
}
```

**Step 4: Run test**

```bash
cd /e/claude/voidSector && npm run test -w packages/server -- constructionQueries 2>&1 | head -20
```

Expected: PASS (or SKIP if no TEST_DB env var)

**Step 5: Commit**

```bash
cd /e/claude/voidSector
git add packages/server/src/db/constructionQueries.ts packages/server/src/db/__tests__/constructionQueries.test.ts
git commit -m "feat(#231): construction site DB queries"
```

---

### Task 3: Construction tick service

**Files:**
- Create: `packages/server/src/engine/constructionTickService.ts`
- Modify: `packages/server/src/engine/universeBootstrap.ts`

**Step 1: Write the failing test**

Create `packages/server/src/engine/__tests__/constructionTick.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/constructionQueries.js', () => ({
  getAllConstructionSites: vi.fn(),
  advanceProgress: vi.fn(),
  markPaused: vi.fn(),
  deleteConstructionSiteById: vi.fn(),
}));
vi.mock('../../db/queries.js', () => ({
  createStructure: vi.fn(),
}));

import { processConstructionTick } from '../constructionTickService.js';
import { getAllConstructionSites, advanceProgress, markPaused } from '../../db/constructionQueries.js';

describe('processConstructionTick', () => {
  beforeEach(() => vi.clearAllMocks());

  it('advances site when enough resources deposited', async () => {
    (getAllConstructionSites as any).mockResolvedValue([{
      id: 'site-1', owner_id: 'player-1', type: 'mining_station',
      sector_x: 5, sector_y: 5, progress: 0,
      needed_ore: 30, needed_gas: 15, needed_crystal: 10,
      deposited_ore: 30, deposited_gas: 15, deposited_crystal: 10,
      paused: false,
    }]);
    (advanceProgress as any).mockResolvedValue(true);

    await processConstructionTick();

    expect(advanceProgress).toHaveBeenCalledWith('site-1', 1);
    expect(markPaused).not.toHaveBeenCalled();
  });

  it('pauses site when insufficient resources', async () => {
    (getAllConstructionSites as any).mockResolvedValue([{
      id: 'site-2', owner_id: 'player-1', type: 'mining_station',
      sector_x: 6, sector_y: 6, progress: 50,
      needed_ore: 30, needed_gas: 15, needed_crystal: 10,
      deposited_ore: 10, deposited_gas: 0, deposited_crystal: 0, // not enough
      paused: false,
    }]);

    await processConstructionTick();

    expect(markPaused).toHaveBeenCalledWith('site-2');
    expect(advanceProgress).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /e/claude/voidSector && npm run test -w packages/server -- constructionTick 2>&1 | head -20
```

Expected: FAIL

**Step 3: Create constructionTickService.ts**

```typescript
// packages/server/src/engine/constructionTickService.ts
import {
  getAllConstructionSites,
  advanceProgress,
  markPaused,
  deleteConstructionSiteById,
} from '../db/constructionQueries.js';
import { createStructure } from '../db/queries.js';
import { logger } from '../logger.js';

/**
 * Resource threshold check: at tick progress p (0-based next tick),
 * the site needs ceil(p * needed / 100) resources to have been deposited.
 */
function resourcesNeededAtProgress(p: number, total: number): number {
  return Math.ceil((p * total) / 100);
}

export async function processConstructionTick(): Promise<void> {
  const sites = await getAllConstructionSites();
  if (sites.length === 0) return;

  for (const site of sites) {
    const nextProgress = site.progress + 1;
    const oreNeeded     = resourcesNeededAtProgress(nextProgress, site.needed_ore);
    const gasNeeded     = resourcesNeededAtProgress(nextProgress, site.needed_gas);
    const crystalNeeded = resourcesNeededAtProgress(nextProgress, site.needed_crystal);

    const hasResources =
      site.deposited_ore     >= oreNeeded &&
      site.deposited_gas     >= gasNeeded &&
      site.deposited_crystal >= crystalNeeded;

    if (!hasResources) {
      if (!site.paused) await markPaused(site.id);
      continue;
    }

    if (nextProgress >= 100) {
      // Construction complete — create the real structure
      try {
        await createStructure(site.owner_id, site.type, site.sector_x, site.sector_y);
        await deleteConstructionSiteById(site.id);
        logger.info({ type: site.type, x: site.sector_x, y: site.sector_y }, 'Construction complete');
      } catch (err) {
        logger.error({ err, siteId: site.id }, 'Failed to complete construction');
      }
      continue;
    }

    await advanceProgress(site.id, nextProgress);
  }
}
```

**Step 4: Register in universeBootstrap.ts**

In `packages/server/src/engine/universeBootstrap.ts`, add import:

```typescript
import { processConstructionTick } from './constructionTickService.js';
```

In the tick callback (after `await processCivTick();`), add:

```typescript
await processConstructionTick();
```

**Step 5: Run tests**

```bash
cd /e/claude/voidSector && npm run test -w packages/server -- constructionTick 2>&1 | head -30
```

Expected: PASS

**Step 6: Commit**

```bash
cd /e/claude/voidSector
git add packages/server/src/engine/constructionTickService.ts \
        packages/server/src/engine/__tests__/constructionTick.test.ts \
        packages/server/src/engine/universeBootstrap.ts
git commit -m "feat(#231): construction tick service — advances progress per universe tick"
```

---

### Task 4: Modify handleBuild to create construction site

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts`
- Modify: `packages/shared/src/types.ts` (add ConstructionSite type + message type)

**Step 1: Add shared types**

In `packages/shared/src/types.ts`, after `BuildMessage`:

```typescript
export interface ConstructionSiteState {
  id: string;
  type: StructureType;
  sectorX: number;
  sectorY: number;
  progress: number;       // 0-100
  neededOre: number;
  neededGas: number;
  neededCrystal: number;
  depositedOre: number;
  depositedGas: number;
  depositedCrystal: number;
  paused: boolean;
}

export interface DepositConstructionMessage {
  siteId: string;
  ore: number;
  gas: number;
  crystal: number;
}
```

**Step 2: Modify handleBuild in WorldService.ts**

Find `handleBuild` in `packages/server/src/rooms/services/WorldService.ts:255`.

Change the build flow for `mining_station` (jumpgate stays instant — too expensive to make gradual):

After the AP validation block, before `createStructure`, replace the structure creation with:

```typescript
// Create construction site instead of instant structure
const costs = STRUCTURE_COSTS[data.type];
const siteId = await createConstructionSite(
  auth.userId,
  data.type,
  this.ctx._px(client.sessionId),
  this.ctx._py(client.sessionId),
  costs.ore,
  costs.gas ?? 0,
  costs.crystal ?? 0,
);

const site: ConstructionSiteState = {
  id: siteId,
  type: data.type,
  sectorX: this.ctx._px(client.sessionId),
  sectorY: this.ctx._py(client.sessionId),
  progress: 0,
  neededOre: costs.ore,
  neededGas: costs.gas ?? 0,
  neededCrystal: costs.crystal ?? 0,
  depositedOre: 0,
  depositedGas: 0,
  depositedCrystal: 0,
  paused: false,
};

client.send('buildResult', { success: true, constructionSite: site });
client.send('apUpdate', result.newAP!);
this.ctx.broadcast('constructionSiteCreated', {
  site,
  sectorX: site.sectorX,
  sectorY: site.sectorY,
});
```

Note: `STRUCTURE_COSTS` check for existing construction site or structure must happen too — add before creating site:

```typescript
const existingSite = await getConstructionSite(
  this.ctx._px(client.sessionId),
  this.ctx._py(client.sessionId),
);
if (existingSite) {
  client.send('buildResult', { success: false, error: 'Construction already in progress here' });
  return;
}
```

**Step 3: Add depositConstruction message handler in SectorRoom.ts**

In `packages/server/src/rooms/SectorRoom.ts`, add message handler:

```typescript
this.onMessage('depositConstruction', async (client, data: DepositConstructionMessage) => {
  await this.world.handleDepositConstruction(client, data);
});
```

Add `handleDepositConstruction` to `WorldService.ts`:

```typescript
async handleDepositConstruction(client: Client, data: DepositConstructionMessage): Promise<void> {
  if (rejectGuest(client, 'Ressourcen liefern')) return;
  const auth = client.auth as AuthPayload;

  const site = await getConstructionSiteById(data.siteId);
  if (!site) {
    client.send('error', { code: 'INVALID_INPUT', message: 'Construction site not found' });
    return;
  }

  const cargo = await getCargoState(auth.userId);
  const ore     = Math.min(data.ore,     cargo.ore);
  const gas     = Math.min(data.gas,     cargo.gas);
  const crystal = Math.min(data.crystal, cargo.crystal);

  if (ore + gas + crystal === 0) {
    client.send('error', { code: 'BUILD_FAIL', message: 'No resources to deposit' });
    return;
  }

  // Cap deposits at what's still needed
  const capOre     = Math.min(ore,     site.needed_ore     - site.deposited_ore);
  const capGas     = Math.min(gas,     site.needed_gas     - site.deposited_gas);
  const capCrystal = Math.min(crystal, site.needed_crystal - site.deposited_crystal);

  if (capOre > 0) await removeFromInventory(auth.userId, 'resource', 'ore',     capOre);
  if (capGas > 0) await removeFromInventory(auth.userId, 'resource', 'gas',     capGas);
  if (capCrystal > 0) await removeFromInventory(auth.userId, 'resource', 'crystal', capCrystal);

  await depositResources(data.siteId, capOre, capGas, capCrystal);

  const updatedSite = await getConstructionSiteById(data.siteId);
  client.send('constructionSiteUpdate', updatedSite);
  const updatedCargo = await getCargoState(auth.userId);
  client.send('cargoUpdate', updatedCargo);
}
```

**Step 4: Typecheck**

```bash
cd /e/claude/voidSector && npm run typecheck -w packages/server 2>&1 | tail -15
```

Expected: no errors

**Step 5: Commit**

```bash
cd /e/claude/voidSector
git add packages/shared/src/types.ts \
        packages/server/src/rooms/services/WorldService.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(#231): handleBuild creates construction site; depositConstruction handler"
```

---

### Task 5: Client state and network for construction sites

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add constructionSites state to gameSlice.ts**

In `packages/client/src/state/gameSlice.ts`:

1. Import `ConstructionSiteState` from `@void-sector/shared`
2. Add to state interface:
   ```typescript
   constructionSites: ConstructionSiteState[];
   setConstructionSites: (sites: ConstructionSiteState[]) => void;
   upsertConstructionSite: (site: ConstructionSiteState) => void;
   removeConstructionSite: (siteId: string) => void;
   ```
3. Initialize: `constructionSites: []`
4. Implement:
   ```typescript
   setConstructionSites: (sites) => set({ constructionSites: sites }),
   upsertConstructionSite: (site) => set((s) => ({
     constructionSites: s.constructionSites.some(c => c.id === site.id)
       ? s.constructionSites.map(c => c.id === site.id ? site : c)
       : [...s.constructionSites, site],
   })),
   removeConstructionSite: (siteId) => set((s) => ({
     constructionSites: s.constructionSites.filter(c => c.id !== siteId),
   })),
   ```

**Step 2: Add network handlers in client.ts**

In `packages/client/src/network/client.ts`, in the room message handlers:

```typescript
room.onMessage('constructionSiteCreated', (data: { site: ConstructionSiteState }) => {
  useStore.getState().upsertConstructionSite(data.site);
});
room.onMessage('constructionSiteUpdate', (data: ConstructionSiteState) => {
  useStore.getState().upsertConstructionSite(data);
});
room.onMessage('constructionSiteCompleted', (data: { siteId: string }) => {
  useStore.getState().removeConstructionSite(data.siteId);
});
```

Add network send function:

```typescript
sendDepositConstruction(siteId: string, ore: number, gas: number, crystal: number) {
  this.sectorRoom?.send('depositConstruction', { siteId, ore, gas, crystal });
}
```

**Step 3: Broadcast construction site completed from server**

In `constructionTickService.ts`, after `deleteConstructionSiteById(site.id)`, broadcast via the existing `civShipBus` pattern — but since we don't have a dedicated construction bus, use `SectorRoom` approach. Add a simple export to signal completion. Actually simplest: in SectorRoom, after calling `processConstructionTick`, check for completed sites to broadcast.

**Alternative (simpler)**: In the server `buildResult` handler, when structure completes (progress=100), the server already calls `this.ctx.broadcast('structureBuilt', ...)` — that's handled in `constructionTickService.ts` calling `createStructure` then a broadcast. This requires the tick service to access a broadcast function.

**Simplest approach**: Add an exported `pendingCompletions` Set in constructionTickService, SectorRoom polls it every tick:

```typescript
// constructionTickService.ts
export const pendingCompletions: { siteId: string; sectorX: number; sectorY: number }[] = [];
```

Then in `SectorRoom.ts` tick callback, read and broadcast `pendingCompletions`.

**Step 4: Typecheck**

```bash
cd /e/claude/voidSector && npm run typecheck -w packages/client 2>&1 | tail -10
```

**Step 5: Commit**

```bash
cd /e/claude/voidSector
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat(#231): client state and network for construction sites"
```

---

### Task 6: DetailPanel — show construction site status and deposit UI

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Step 1: Find the sector's construction site in the panel**

In `DetailPanel.tsx`, add:

```typescript
const constructionSites = useStore((s) => s.constructionSites);
// In render (where sectorX/sectorY are known):
const constructionSite = constructionSites.find(
  (c) => c.sectorX === selectedSector.x && c.sectorY === selectedSector.y,
);
```

**Step 2: Show "IN BAU" banner instead of build buttons when site exists**

Replace the `isPlayerHere && <buildButtons>` block with:

```typescript
{isPlayerHere && constructionSite ? (
  <ConstructionSitePanel site={constructionSite} />
) : isPlayerHere && !constructionSite ? (
  <div>... existing build buttons ...</div>
) : null}
```

**Step 3: Create inline ConstructionSitePanel component**

Add at top of DetailPanel.tsx (or extract to own file if it grows large):

```typescript
function ConstructionSitePanel({ site }: { site: ConstructionSiteState }) {
  const cargo = useStore((s) => s.cargo);
  const pct = site.progress;

  const remainOre     = Math.max(0, site.neededOre     - site.depositedOre);
  const remainGas     = Math.max(0, site.neededGas     - site.depositedGas);
  const remainCrystal = Math.max(0, site.neededCrystal - site.depositedCrystal);

  const canDeposit = cargo.ore >= 1 || cargo.gas >= 1 || cargo.crystal >= 1;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-dim)', letterSpacing: '0.15em', marginBottom: 4 }}>
        {site.type === 'mining_station' ? 'STATION' : 'JUMPGATE'} — IN BAU
        {site.paused && <span style={{ color: '#ff4444', marginLeft: 6 }}>⏸ PAUSIERT</span>}
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginBottom: 6 }}>
        {pct}/100 Ticks
      </div>
      {/* Resource status */}
      {[
        ['ORE',     site.depositedOre,     site.neededOre,     remainOre],
        ['GAS',     site.depositedGas,     site.neededGas,     remainGas],
        ['CRYSTAL', site.depositedCrystal, site.neededCrystal, remainCrystal],
      ].filter(([,, needed]) => (needed as number) > 0).map(([label, deposited, needed, remain]) => (
        <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
          <span style={{ color: 'var(--color-dim)' }}>{label as string}</span>
          <span style={{ color: (remain as number) > 0 ? '#ffaa00' : 'var(--color-primary)' }}>
            {deposited as number}/{needed as number}
          </span>
        </div>
      ))}
      {/* Deposit button */}
      {canDeposit && (
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginTop: 6 }}
          onClick={() => network.sendDepositConstruction(
            site.id,
            Math.min(cargo.ore, remainOre),
            Math.min(cargo.gas, remainGas),
            Math.min(cargo.crystal, remainCrystal),
          )}
        >
          [RESSOURCEN LIEFERN]
        </button>
      )}
    </div>
  );
}
```

**Step 4: Typecheck**

```bash
cd /e/claude/voidSector && npm run typecheck -w packages/client 2>&1 | tail -10
```

Expected: no errors

**Step 5: Run full test suite**

```bash
cd /e/claude/voidSector && npm run test 2>&1 | tail -20
```

Expected: same or better pass rate as before

**Step 6: Commit**

```bash
cd /e/claude/voidSector
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat(#231): DetailPanel shows construction site — progress bar, resource delivery"
```

---

### Task 7: End-to-end smoke test + broadcast completion signal

**Files:**
- Modify: `packages/server/src/engine/constructionTickService.ts` (add pendingCompletions)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (broadcast completions)

**Step 1: Add pendingCompletions to constructionTickService.ts**

```typescript
export const pendingCompletions: Array<{ siteId: string; sectorX: number; sectorY: number }> = [];
```

When construction completes (before `deleteConstructionSiteById`):
```typescript
pendingCompletions.push({ siteId: site.id, sectorX: site.sector_x, sectorY: site.sector_y });
```

**Step 2: In SectorRoom tick callback, broadcast completions**

In the tick registration inside `SectorRoom.ts`:

```typescript
// After processConstructionTick() is called (via universeBootstrap):
// SectorRoom reads pendingCompletions and broadcasts
```

Actually cleaner: SectorRoom subscribes to a completion bus. Since civ uses `civShipBus`, create `constructionBus`:

Create `packages/server/src/constructionBus.ts`:
```typescript
import { EventEmitter } from 'events';
export const constructionBus = new EventEmitter();
constructionBus.setMaxListeners(50);
```

In `constructionTickService.ts`, import `constructionBus` and emit:
```typescript
constructionBus.emit('completed', { siteId: site.id, sectorX: site.sector_x, sectorY: site.sector_y });
```

In `SectorRoom.ts`, subscribe in `onCreate`:
```typescript
const onCompleted = (data: { siteId: string; sectorX: number; sectorY: number }) => {
  this.broadcast('constructionSiteCompleted', data);
};
constructionBus.on('completed', onCompleted);
this._disposeCallbacks.push(() => constructionBus.off('completed', onCompleted));
```

**Step 3: Typecheck and test**

```bash
cd /e/claude/voidSector && npm run typecheck && npm run test 2>&1 | tail -20
```

**Step 4: Manual smoke test**

1. Start server: `docker-compose up -d`
2. Log in as phash
3. Navigate to empty sector
4. Open DetailPanel → click [BUILD STATION]
5. Verify: "STATION — IN BAU" appears, progress=0, resources needed shown
6. Click [RESSOURCEN LIEFERN] (if you have ore/gas/crystal)
7. Wait a few ticks (5s each) → progress bar increases
8. After 100 ticks: structure appears, construction panel disappears

**Step 5: Commit**

```bash
cd /e/claude/voidSector
git add packages/server/src/constructionBus.ts \
        packages/server/src/engine/constructionTickService.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(#231): broadcast construction completion via event bus"
```
