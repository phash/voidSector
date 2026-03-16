# ACEP Craft Sites Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace instant ACEP crafting with a construction-site-like Baustellen system where resources are deposited incrementally and production time depends on the factory module's craftSpeed.

**Architecture:** New `craft_sites` DB table mirrors the existing `construction_sites` pattern. A tick function (piggybacking on the existing universe tick) processes active craft sites. The FabrikPanel AcepTab shows either recipe selection or active craft progress. One active craft per ship.

**Tech Stack:** PostgreSQL (craft_sites table), Colyseus messages, React + Zustand (client state), Vitest (tests)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/server/src/db/craftSiteQueries.ts` | Create | CRUD for craft_sites table |
| `packages/server/src/engine/craftTickService.ts` | Create | Tick processing for craft sites |
| `packages/server/src/db/migrations/081_craft_sites.sql` | Create | craft_sites table schema |
| `packages/server/src/rooms/services/ShipService.ts` | Modify | Replace instant craft with craft site creation |
| `packages/server/src/rooms/SectorRoom.ts` | Modify | Register new messages, add craft tick |
| `packages/client/src/components/FabrikPanel.tsx` | Modify | Show craft progress or recipe list |
| `packages/client/src/network/client.ts` | Modify | New send/receive handlers |
| `packages/client/src/state/gameSlice.ts` | Modify | craftSite state |
| `packages/shared/src/constants.ts` | Modify | CRAFT_TICK_INTERVAL_MS constant |

---

## Chunk 1: Database & Server Core

### Task 1: Migration — craft_sites table

**Files:**
- Create: `packages/server/src/db/migrations/081_craft_sites.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration 081: Craft sites for ACEP ship production
CREATE TABLE IF NOT EXISTS craft_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  ship_id UUID NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  duration INT NOT NULL,
  needed_ore INT NOT NULL DEFAULT 0,
  needed_gas INT NOT NULL DEFAULT 0,
  needed_crystal INT NOT NULL DEFAULT 0,
  needed_credits INT NOT NULL DEFAULT 0,
  deposited_ore INT NOT NULL DEFAULT 0,
  deposited_gas INT NOT NULL DEFAULT 0,
  deposited_crystal INT NOT NULL DEFAULT 0,
  deposited_credits INT NOT NULL DEFAULT 0,
  paused BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ship_id)
);
CREATE INDEX IF NOT EXISTS idx_craft_sites_player ON craft_sites(player_id);
CREATE INDEX IF NOT EXISTS idx_craft_sites_ship ON craft_sites(ship_id);
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/081_craft_sites.sql
git commit -m "feat: #486 migration 081 — craft_sites table"
```

---

### Task 2: DB queries — craftSiteQueries.ts

**Files:**
- Create: `packages/server/src/db/craftSiteQueries.ts`
- Test: `packages/server/src/__tests__/craftSiteQueries.test.ts`

- [ ] **Step 1: Write the query module**

Model after `constructionQueries.ts`. Implement:

```typescript
// CraftSite interface
export interface CraftSite {
  id: string;
  player_id: string;
  ship_id: string;
  module_id: string;
  progress: number;
  duration: number;
  needed_ore: number;
  needed_gas: number;
  needed_crystal: number;
  needed_credits: number;
  deposited_ore: number;
  deposited_gas: number;
  deposited_crystal: number;
  deposited_credits: number;
  paused: boolean;
  created_at: Date;
}

// Functions:
createCraftSite(playerId, shipId, moduleId, duration, needed: {ore, gas, crystal, credits}) → CraftSite
getCraftSiteByShipId(shipId) → CraftSite | null
getCraftSiteByPlayerId(playerId) → CraftSite | null
getAllActiveCraftSites() → CraftSite[]   // for tick service
depositCraftResources(siteId, {ore, gas, crystal, credits}) → void  // also sets paused=false
setCraftProgress(siteId, progress) → void
markCraftPaused(siteId) → void
deleteCraftSite(siteId) → void
```

Key patterns from `constructionQueries.ts`:
- `depositResources` uses `deposited_ore = deposited_ore + $2` SQL
- `getAllConstructionSites()` returns all non-complete sites for tick processing

- [ ] **Step 2: Write tests**

Test file: `packages/server/src/__tests__/craftSiteQueries.test.ts`

Mock `query` from `db/pool.js`. Test:
- `createCraftSite` calls INSERT with correct params
- `getCraftSiteByShipId` returns mapped row or null
- `depositCraftResources` uses UPDATE with increment
- `deleteCraftSite` calls DELETE

- [ ] **Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/craftSiteQueries.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/craftSiteQueries.ts packages/server/src/__tests__/craftSiteQueries.test.ts
git commit -m "feat: #486 craft site DB queries + tests"
```

---

### Task 3: Craft tick service

**Files:**
- Create: `packages/server/src/engine/craftTickService.ts`
- Test: `packages/server/src/engine/__tests__/craftTickService.test.ts`

- [ ] **Step 1: Write the tick service**

Model after `constructionTickService.ts` (lines 33-88). Key differences:
- Uses `getAllActiveCraftSites()` instead of construction sites
- Progress increment: `craftSpeed` per tick (not 1)
- No proportional resource consumption — resources must be fully deposited before progress starts (paused=true until all deposited >= needed)
- On completion: call `addToInventory(site.player_id, 'module', site.module_id, 1)`, delete site, notify player

```typescript
import { getAllActiveCraftSites, setCraftProgress, deleteCraftSite } from '../db/craftSiteQueries.js';
import { addToInventory } from '../db/queries.js';

export async function processCraftTick(
  notifyPlayer: (playerId: string, event: string, data: any) => void,
): Promise<void> {
  const sites = await getAllActiveCraftSites();
  for (const site of sites) {
    if (site.paused) continue;
    // Check all resources deposited
    const allDeposited =
      site.deposited_ore >= site.needed_ore &&
      site.deposited_gas >= site.needed_gas &&
      site.deposited_crystal >= site.needed_crystal &&
      site.deposited_credits >= site.needed_credits;
    if (!allDeposited) continue;

    const newProgress = site.progress + 1; // 1 per tick; craftSpeed affects duration
    if (newProgress >= site.duration) {
      // Complete
      await addToInventory(site.player_id, 'module', site.module_id, 1);
      await deleteCraftSite(site.id);
      notifyPlayer(site.player_id, 'craftComplete', { moduleId: site.module_id });
      notifyPlayer(site.player_id, 'inventoryUpdated', {});
    } else {
      await setCraftProgress(site.id, newProgress);
    }
  }
}
```

- [ ] **Step 2: Write tests**

Test that:
- Skips paused sites
- Skips sites with insufficient deposits
- Increments progress for active, fully-deposited sites
- Completes and deletes site when progress >= duration
- Calls notifyPlayer on completion

- [ ] **Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/craftTickService.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/engine/craftTickService.ts packages/server/src/engine/__tests__/craftTickService.test.ts
git commit -m "feat: #486 craft tick service + tests"
```

---

### Task 4: Server message handlers

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add constant**

In `packages/shared/src/constants.ts`, add:
```typescript
export const CRAFT_TICK_INTERVAL_MS = 5_000; // 5 seconds, same as construction ticks
```

- [ ] **Step 2: Modify handleCraftModule → handleStartCraft**

In `ShipService.ts`, replace the instant crafting in `handleCraftModule` (lines 204-260) with craft site creation:

```typescript
async handleCraftModule(client: Client, data: { moduleId: string }): Promise<void> {
  const auth = client.auth as AuthPayload;
  const mod = MODULE_MAP.get(data.moduleId);
  if (!mod) {
    client.send('craftResult', { success: false, error: 'Unknown module' });
    return;
  }

  // 1. Check recipe access (same as before)
  const [research, bpQty, techTree] = await Promise.all([
    getPlayerResearch(auth.userId),
    getInventoryItem(auth.userId, 'blueprint', data.moduleId),
    getOrCreateTechTree(auth.userId),
  ]);
  const blueprints = bpQty >= 1 ? [data.moduleId] : [];
  const hasRecipe = research.unlockedModules.includes(data.moduleId) ||
    isModuleUnlocked(data.moduleId, mod, techTree.researched_nodes, blueprints);
  if (!hasRecipe) {
    client.send('craftResult', { success: false, error: 'No recipe available' });
    return;
  }

  // 2. Check no active craft on this ship
  const ship = await getActiveShip(auth.userId);
  if (!ship) return;
  const existing = await getCraftSiteByShipId(ship.id);
  if (existing) {
    client.send('craftResult', { success: false, error: 'Bereits eine Herstellung aktiv' });
    return;
  }

  // 3. Get factory craftSpeed from installed factory module
  const factoryMod = ship.modules.find(m => MODULE_MAP.get(m.moduleId)?.category === 'factory');
  const craftSpeed = factoryMod ? (MODULE_MAP.get(factoryMod.moduleId)?.stats['craftSpeed'] ?? 1) : 1;

  // 4. Calculate duration: total material / craftSpeed
  const totalMaterial = (mod.costOre ?? 0) + (mod.costGas ?? 0) + (mod.costCrystal ?? 0);
  const duration = Math.max(1, Math.ceil(totalMaterial / craftSpeed));

  // 5. Create craft site
  const site = await createCraftSite(auth.userId, ship.id, data.moduleId, duration, {
    ore: mod.costOre ?? 0,
    gas: mod.costGas ?? 0,
    crystal: mod.costCrystal ?? 0,
    credits: mod.costCredits ?? 0,
  });

  client.send('craftSiteUpdate', site);
  client.send('logEntry', `HERSTELLUNG GESTARTET: ${mod.name ?? data.moduleId}`);
}
```

- [ ] **Step 3: Add deposit/cancel/status handlers**

In `ShipService.ts`, add:

```typescript
async handleDepositCraftResources(
  client: Client,
  data: { ore?: number; gas?: number; crystal?: number; credits?: number },
): Promise<void> {
  const auth = client.auth as AuthPayload;
  const ship = await getActiveShip(auth.userId);
  if (!ship) return;
  const site = await getCraftSiteByShipId(ship.id);
  if (!site) {
    client.send('actionError', 'Keine aktive Herstellung');
    return;
  }

  // Clamp to needed - deposited
  const ore = Math.min(data.ore ?? 0, site.needed_ore - site.deposited_ore);
  const gas = Math.min(data.gas ?? 0, site.needed_gas - site.deposited_gas);
  const crystal = Math.min(data.crystal ?? 0, site.needed_crystal - site.deposited_crystal);
  const credits = Math.min(data.credits ?? 0, site.needed_credits - site.deposited_credits);

  // Deduct from player
  if (ore > 0) await removeFromInventory(auth.userId, 'resource', 'ore', ore);
  if (gas > 0) await removeFromInventory(auth.userId, 'resource', 'gas', gas);
  if (crystal > 0) await removeFromInventory(auth.userId, 'resource', 'crystal', crystal);
  if (credits > 0) await deductCredits(auth.userId, credits);

  // Deposit into site
  await depositCraftResources(site.id, { ore, gas, crystal, credits });

  // Refresh client
  const updated = await getCraftSiteByShipId(ship.id);
  client.send('craftSiteUpdate', updated);
  client.send('inventoryUpdated', {});
  if (credits > 0) client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
}

async handleCancelCraft(client: Client): Promise<void> {
  const auth = client.auth as AuthPayload;
  const ship = await getActiveShip(auth.userId);
  if (!ship) return;
  const site = await getCraftSiteByShipId(ship.id);
  if (!site) return;

  // Return deposited resources
  if (site.deposited_ore > 0) await addToInventory(auth.userId, 'resource', 'ore', site.deposited_ore);
  if (site.deposited_gas > 0) await addToInventory(auth.userId, 'resource', 'gas', site.deposited_gas);
  if (site.deposited_crystal > 0) await addToInventory(auth.userId, 'resource', 'crystal', site.deposited_crystal);
  if (site.deposited_credits > 0) await addCredits(auth.userId, site.deposited_credits);

  await deleteCraftSite(site.id);
  client.send('craftSiteUpdate', null);
  client.send('inventoryUpdated', {});
  client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  client.send('logEntry', 'HERSTELLUNG ABGEBROCHEN');
}

async handleGetCraftStatus(client: Client): Promise<void> {
  const auth = client.auth as AuthPayload;
  const ship = await getActiveShip(auth.userId);
  if (!ship) return;
  const site = await getCraftSiteByShipId(ship.id);
  client.send('craftSiteUpdate', site ?? null);
}
```

- [ ] **Step 4: Register messages in SectorRoom.ts**

Add after the existing `craftModule` message (line 750):

```typescript
this.onMessage('depositCraftResources', async (client, data) => {
  await this.ships.handleDepositCraftResources(client, data);
});
this.onMessage('cancelCraft', async (client) => {
  await this.ships.handleCancelCraft(client);
});
this.onMessage('getCraftStatus', async (client) => {
  await this.ships.handleGetCraftStatus(client);
});
```

- [ ] **Step 5: Add craft tick to SectorRoom**

In `SectorRoom.ts` `onCreate`, alongside the existing construction tick interval, add:

```typescript
import { processCraftTick } from '../engine/craftTickService.js';

// In onCreate, after construction tick setup:
this.clock.setInterval(() => {
  processCraftTick((playerId, event, data) => {
    for (const client of this.clients) {
      if ((client.auth as any)?.userId === playerId) {
        client.send(event, data);
      }
    }
  });
}, CRAFT_TICK_INTERVAL_MS);
```

Also send craft status on player join (in `onJoin`, after shipData):
```typescript
const craftSite = await getCraftSiteByShipId(shipRecord.id);
if (craftSite) client.send('craftSiteUpdate', craftSite);
```

- [ ] **Step 6: Build shared**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 7: Run server tests**

```bash
cd packages/server && npx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: #486 craft site server handlers + tick service"
```

---

## Chunk 2: Client UI

### Task 5: Client state & network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add craftSite state**

In `gameSlice.ts`, add to state interface and initial state:

```typescript
// State type (add to GameSlice interface):
craftSite: CraftSiteState | null;

// Type definition:
export interface CraftSiteState {
  id: string;
  module_id: string;
  progress: number;
  duration: number;
  needed_ore: number;
  needed_gas: number;
  needed_crystal: number;
  needed_credits: number;
  deposited_ore: number;
  deposited_gas: number;
  deposited_crystal: number;
  deposited_credits: number;
  paused: boolean;
}

// Initial state:
craftSite: null,

// Setter:
setCraftSite: (site: CraftSiteState | null) => void;
// Implementation:
setCraftSite: (craftSite) => set({ craftSite }),
```

- [ ] **Step 2: Add network handlers**

In `client.ts`, add message handler:

```typescript
room.onMessage('craftSiteUpdate', (data: CraftSiteState | null) => {
  useStore.getState().setCraftSite(data);
});

room.onMessage('craftComplete', (data: { moduleId: string }) => {
  useStore.getState().addLogEntry(`HERSTELLUNG ABGESCHLOSSEN: ${data.moduleId}`);
  useStore.getState().setCraftSite(null);
});
```

Add send methods:

```typescript
sendDepositCraftResources(resources: { ore?: number; gas?: number; crystal?: number; credits?: number }) {
  this.sectorRoom?.send('depositCraftResources', resources);
}

sendCancelCraft() {
  this.sectorRoom?.send('cancelCraft');
}

sendGetCraftStatus() {
  this.sectorRoom?.send('getCraftStatus');
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat: #486 client state + network for craft sites"
```

---

### Task 6: FabrikPanel AcepTab UI

**Files:**
- Modify: `packages/client/src/components/FabrikPanel.tsx`

- [ ] **Step 1: Update AcepTab to show craft progress or recipe list**

In `FabrikPanel.tsx`, modify the `AcepTab` function (lines 48-147):

```typescript
function AcepTab() {
  const { t } = useTranslation('ui');
  const inventory = useStore((s) => s.inventory);
  const ship = useStore((s) => s.ship);
  const acepBlueprints = useStore((s) => s.acepFactoryBlueprints);
  const craftSite = useStore((s) => s.craftSite);

  useEffect(() => {
    network.requestAcepBlueprints();
    network.sendGetCraftStatus();
  }, []);

  // Poll craft status every 5s while active
  useEffect(() => {
    if (!craftSite) return;
    const iv = setInterval(() => network.sendGetCraftStatus(), 5000);
    return () => clearInterval(iv);
  }, [craftSite]);

  const blueprintsInCargo = inventory.filter((i) => i.itemType === 'blueprint');
  const cargoModules = inventory.filter((i) => i.itemType === 'module');

  // If active craft → show progress
  if (craftSite) {
    return <CraftProgress site={craftSite} />;
  }

  // Otherwise show recipe list (existing code)
  return (
    <div>
      {/* existing VERFÜGBARE REZEPTE section */}
      {/* existing BLUEPRINTS IM CARGO section */}
      {/* existing cargo modules section */}
    </div>
  );
}
```

- [ ] **Step 2: Create CraftProgress component**

Add within `FabrikPanel.tsx`:

```typescript
function CraftProgress({ site }: { site: CraftSiteState }) {
  const mod = MODULE_MAP.get(site.module_id);
  const pct = site.duration > 0 ? Math.floor((site.progress / site.duration) * 100) : 0;
  const cargo = useStore((s) => s.cargo);
  const credits = useStore((s) => s.credits);

  const allDeposited =
    site.deposited_ore >= site.needed_ore &&
    site.deposited_gas >= site.needed_gas &&
    site.deposited_crystal >= site.needed_crystal &&
    site.deposited_credits >= site.needed_credits;

  function depositAll() {
    network.sendDepositCraftResources({
      ore: Math.min(cargo.ore ?? 0, site.needed_ore - site.deposited_ore),
      gas: Math.min(cargo.gas ?? 0, site.needed_gas - site.deposited_gas),
      crystal: Math.min(cargo.crystal ?? 0, site.needed_crystal - site.deposited_crystal),
      credits: Math.min(credits, site.needed_credits - site.deposited_credits),
    });
  }

  return (
    <div>
      <div style={{ ...headerStyle, marginTop: 0, color: amber }}>
        HERSTELLUNG: {mod?.name ?? site.module_id}
      </div>

      {/* Progress bar */}
      <div style={{ margin: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
          <span>{pct}%</span>
          <span>{site.progress}/{site.duration}</span>
        </div>
        <div style={{ background: '#222', height: 8, marginTop: 2 }}>
          <div style={{ background: amber, height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
        {site.paused && !allDeposited && (
          <div style={{ color: '#f44', fontSize: '0.6rem', marginTop: 2 }}>PAUSIERT — Rohstoffe fehlen</div>
        )}
      </div>

      {/* Resource status */}
      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {site.needed_ore > 0 && (
          <ResourceRow label="ORE" deposited={site.deposited_ore} needed={site.needed_ore} />
        )}
        {site.needed_gas > 0 && (
          <ResourceRow label="GAS" deposited={site.deposited_gas} needed={site.needed_gas} />
        )}
        {site.needed_crystal > 0 && (
          <ResourceRow label="CRYSTAL" deposited={site.deposited_crystal} needed={site.needed_crystal} />
        )}
        {site.needed_credits > 0 && (
          <ResourceRow label="CREDITS" deposited={site.deposited_credits} needed={site.needed_credits} />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {!allDeposited && (
          <button style={{ ...btnStyle, borderColor: amber, color: amber }} onClick={depositAll}>
            [EINZAHLEN]
          </button>
        )}
        <button style={{ ...btnStyle, borderColor: '#f44', color: '#f44' }}
          onClick={() => network.sendCancelCraft()}>
          [ABBRECHEN]
        </button>
      </div>
    </div>
  );
}

function ResourceRow({ label, deposited, needed }: { label: string; deposited: number; needed: number }) {
  const done = deposited >= needed;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: done ? green : amber }}>{label}</span>
      <span style={{ color: done ? green : '#888' }}>{deposited}/{needed}</span>
    </div>
  );
}
```

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/FabrikPanel.tsx
git commit -m "feat: #486 FABRIK craft progress UI"
```

---

## Chunk 3: Integration & Polish

### Task 7: Wire up craft completion notifications

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/engine/craftTickService.ts`

- [ ] **Step 1: Add Wissen award on craft completion**

In `craftTickService.ts`, after `addToInventory` on completion:

```typescript
import { addWissen } from '../db/queries.js';

// After addToInventory:
await addWissen(site.player_id, 3);
notifyPlayer(site.player_id, 'wissenUpdate', { wissen: await getWissen(site.player_id) });
notifyPlayer(site.player_id, 'logEntry', `HERSTELLUNG ABGESCHLOSSEN: ${site.module_id}`);
```

- [ ] **Step 2: Send craftSite status on join**

In `SectorRoom.ts` onJoin (after shipData send at ~line 1464), add:

```typescript
import { getCraftSiteByShipId } from '../db/craftSiteQueries.js';

// After client.send('shipData', ...):
const craftSite = await getCraftSiteByShipId(shipRecord.id);
if (craftSite) client.send('craftSiteUpdate', craftSite);
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: #486 craft completion wissen award + join sync"
```

---

### Task 8: Full integration test

- [ ] **Step 1: Run all test suites**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

- [ ] **Step 2: Build and deploy**

```bash
cd packages/shared && npm run build
docker compose build server client
docker compose up -d
```

- [ ] **Step 3: Manual playtest**

Use the playtest skill to verify:
1. Open FABRIK → ACEP tab
2. Select a blueprint recipe → HERSTELLEN
3. Craft site appears with progress bar
4. Deposit resources → progress starts
5. Wait for completion → module in inventory
6. Cancel flow: start craft → ABBRECHEN → resources returned

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: #486 ACEP craft sites — complete implementation"
```
