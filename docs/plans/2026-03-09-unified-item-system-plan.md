# Unified Item System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace cargo/module_inventory/blueprints with a unified inventory table; extend Kontor and add direct player trade for all item types.

**Architecture:** Single `inventory` table (player_id, item_type, item_id, quantity) replaces three separate storage systems. Factory Werkstatt enables crafting from blueprints/research. Kontor extended with item_type. New direct-trade flow for same-sector players.

**Tech Stack:** PostgreSQL (migrations), TypeScript ESM, Vitest, Colyseus message handlers, React/Zustand client.

**Design doc:** `docs/plans/2026-03-09-unified-item-system-design.md`

**Read before starting:**
- `packages/server/src/db/queries.ts` — existing addToCargo/deductCargo patterns
- `packages/server/src/rooms/services/MiningService.ts` — cargo usage
- `packages/server/src/rooms/services/ShipService.ts` — module + research handlers
- `packages/shared/src/types.ts` — CargoState, ResourceType

---

## Task 1: DB Migration 044 — inventory table

**Files:**
- Create: `packages/server/src/db/migrations/044_unified_inventory.sql`

**Step 1: Write failing test**

```typescript
// packages/server/src/__tests__/migration-044.test.ts
import { describe, it, expect } from 'vitest';
import { query } from '../db/db.js';

vi.mock('../db/db.js', () => ({ query: vi.fn() }));

describe('migration 044 schema', () => {
  it('inventory table has required columns', async () => {
    const { rows } = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory'
    `);
    const cols = rows.map((r: any) => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('player_id');
    expect(cols).toContain('item_type');
    expect(cols).toContain('item_id');
    expect(cols).toContain('quantity');
  });
});
```

Run: `cd packages/server && npx vitest run src/__tests__/migration-044.test.ts`
Expected: FAIL (table does not exist yet)

**Step 2: Create migration**

```sql
-- packages/server/src/db/migrations/044_unified_inventory.sql
-- Unified inventory: replaces cargo, module_inventory, player_research.blueprints

CREATE TABLE IF NOT EXISTS inventory (
  id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100) NOT NULL,
  item_type TEXT         NOT NULL CHECK (item_type IN ('resource', 'module', 'blueprint')),
  item_id   TEXT         NOT NULL,
  quantity  INTEGER      NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (player_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory (player_id);
CREATE INDEX IF NOT EXISTS idx_inventory_player_type ON inventory (player_id, item_type);

-- Kontor: extend to support all item types
-- item_type replaces the resource-only assumption
ALTER TABLE kontor_orders
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'resource';
```

**Step 3: Verify migration runs**

Run: `cd packages/server && npx vitest run src/__tests__/migration-044.test.ts`
Expected: PASS (after DB restart with migration applied)

**Step 4: Commit**

```bash
git add packages/server/src/db/migrations/044_unified_inventory.sql
git commit -m "feat: migration 044 — unified inventory table + kontor item_type"
```

---

## Task 2: Shared types + inventory query functions

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/server/src/db/queries.ts`

**Step 1: Write failing test**

```typescript
// packages/server/src/__tests__/inventoryQueries.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/db.js', () => ({ query: vi.fn() }));

import { getInventory, upsertInventory, deductInventory } from '../db/queries.js';

describe('inventory queries', () => {
  it('getInventory returns typed items', async () => {
    const { query } = await import('../db/db.js');
    vi.mocked(query).mockResolvedValue({
      rows: [{ item_type: 'resource', item_id: 'ore', quantity: 5 }]
    } as any);
    const items = await getInventory('player1');
    expect(items[0].itemType).toBe('resource');
    expect(items[0].itemId).toBe('ore');
    expect(items[0].quantity).toBe(5);
  });

  it('upsertInventory inserts or increments', async () => {
    const { query } = await import('../db/db.js');
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    await upsertInventory('player1', 'resource', 'ore', 3);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['player1', 'resource', 'ore', 3]
    );
  });
});
```

Run: `cd packages/server && npx vitest run src/__tests__/inventoryQueries.test.ts`
Expected: FAIL

**Step 2: Add shared types**

In `packages/shared/src/types.ts`, add after the ResourceType definitions:

```typescript
export type ItemType = 'resource' | 'module' | 'blueprint';

export interface InventoryItem {
  itemType: ItemType;
  itemId: string;    // 'ore' | 'drive_mk2' | 'scanner_mk3' etc.
  quantity: number;
}
```

**Step 3: Add query functions to queries.ts**

Add at end of `packages/server/src/db/queries.ts`:

```typescript
import type { InventoryItem, ItemType } from '@void-sector/shared';

export async function getInventory(playerId: string): Promise<InventoryItem[]> {
  const res = await query<{ item_type: string; item_id: string; quantity: number }>(
    `SELECT item_type, item_id, quantity FROM inventory WHERE player_id = $1`,
    [playerId],
  );
  return res.rows.map(r => ({ itemType: r.item_type as ItemType, itemId: r.item_id, quantity: r.quantity }));
}

export async function getInventoryItem(
  playerId: string, itemType: ItemType, itemId: string,
): Promise<number> {
  const res = await query<{ quantity: number }>(
    `SELECT quantity FROM inventory WHERE player_id = $1 AND item_type = $2 AND item_id = $3`,
    [playerId, itemType, itemId],
  );
  return res.rows[0]?.quantity ?? 0;
}

export async function upsertInventory(
  playerId: string, itemType: ItemType, itemId: string, delta: number,
): Promise<void> {
  await query(
    `INSERT INTO inventory (player_id, item_type, item_id, quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id, item_type, item_id)
     DO UPDATE SET quantity = inventory.quantity + $4`,
    [playerId, itemType, itemId, delta],
  );
}

export async function deductInventory(
  playerId: string, itemType: ItemType, itemId: string, amount: number,
): Promise<void> {
  const res = await query(
    `UPDATE inventory SET quantity = quantity - $4
     WHERE player_id = $1 AND item_type = $2 AND item_id = $3 AND quantity >= $4
     RETURNING quantity`,
    [playerId, itemType, itemId, amount],
  );
  if (res.rows.length === 0) throw new Error(`Insufficient ${itemType}:${itemId}`);
  if (res.rows[0].quantity === 0) {
    await query(
      `DELETE FROM inventory WHERE player_id = $1 AND item_type = $2 AND item_id = $3`,
      [playerId, itemType, itemId],
    );
  }
}

export async function transferInventoryItem(
  fromPlayerId: string, toPlayerId: string,
  itemType: ItemType, itemId: string, quantity: number,
): Promise<void> {
  await deductInventory(fromPlayerId, itemType, itemId, quantity);
  await upsertInventory(toPlayerId, itemType, itemId, quantity);
}
```

**Step 4: Build shared, run tests**

```bash
cd packages/shared && npm run build
cd ../server && npx vitest run src/__tests__/inventoryQueries.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/server/src/db/queries.ts
git commit -m "feat: InventoryItem shared type + inventory CRUD queries"
```

---

## Task 3: inventoryService.ts — business logic layer

**Files:**
- Create: `packages/server/src/engine/inventoryService.ts`
- Create: `packages/server/src/__tests__/inventoryService.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/inventoryService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getInventory: vi.fn(),
  getInventoryItem: vi.fn(),
  upsertInventory: vi.fn(),
  deductInventory: vi.fn(),
  transferInventoryItem: vi.fn(),
  getCargoCapForPlayer: vi.fn().mockResolvedValue(20),
}));

import {
  addToInventory,
  removeFromInventory,
  getResourceTotal,
  canAddResource,
} from '../engine/inventoryService.js';

describe('inventoryService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('addToInventory calls upsertInventory', async () => {
    const { upsertInventory } = await import('../db/queries.js');
    await addToInventory('p1', 'resource', 'ore', 5);
    expect(vi.mocked(upsertInventory)).toHaveBeenCalledWith('p1', 'resource', 'ore', 5);
  });

  it('canAddResource false when over cap', async () => {
    const { getInventory, getCargoCapForPlayer } = await import('../db/queries.js');
    vi.mocked(getInventory).mockResolvedValue([
      { itemType: 'resource', itemId: 'ore', quantity: 18 },
      { itemType: 'resource', itemId: 'gas', quantity: 4 },
    ]);
    vi.mocked(getCargoCapForPlayer).mockResolvedValue(20);
    const result = await canAddResource('p1', 3);
    expect(result).toBe(false);
  });

  it('canAddResource true when under cap', async () => {
    const { getInventory, getCargoCapForPlayer } = await import('../db/queries.js');
    vi.mocked(getInventory).mockResolvedValue([
      { itemType: 'resource', itemId: 'ore', quantity: 5 },
    ]);
    vi.mocked(getCargoCapForPlayer).mockResolvedValue(20);
    const result = await canAddResource('p1', 3);
    expect(result).toBe(true);
  });
});
```

Run: `cd packages/server && npx vitest run src/__tests__/inventoryService.test.ts`
Expected: FAIL

**Step 2: Implement inventoryService.ts**

```typescript
// packages/server/src/engine/inventoryService.ts
import type { ItemType } from '@void-sector/shared';
import {
  getInventory,
  upsertInventory,
  deductInventory,
  transferInventoryItem,
  getCargoCapForPlayer,
} from '../db/queries.js';

export { transferInventoryItem };

export async function addToInventory(
  playerId: string, itemType: ItemType, itemId: string, quantity: number,
): Promise<void> {
  await upsertInventory(playerId, itemType, itemId, quantity);
}

export async function removeFromInventory(
  playerId: string, itemType: ItemType, itemId: string, quantity: number,
): Promise<void> {
  await deductInventory(playerId, itemType, itemId, quantity);
}

/** Sum of all resource quantities (for cargo cap check). */
export async function getResourceTotal(playerId: string): Promise<number> {
  const items = await getInventory(playerId);
  return items
    .filter(i => i.itemType === 'resource')
    .reduce((sum, i) => sum + i.quantity, 0);
}

/** Returns true if adding `amount` resources stays within cargo cap. */
export async function canAddResource(playerId: string, amount: number): Promise<boolean> {
  const [total, cap] = await Promise.all([
    getResourceTotal(playerId),
    getCargoCapForPlayer(playerId),
  ]);
  return total + amount <= cap;
}
```

Note: `getCargoCapForPlayer` needs to be added to queries.ts — it should look up the player's ship cargo cap (from ship stats). Add this query:

```typescript
// In queries.ts:
export async function getCargoCapForPlayer(playerId: string): Promise<number> {
  const res = await query<{ cargo_cap: number }>(
    `SELECT s.cargo_cap FROM ships s WHERE s.owner_id = $1 AND s.active = TRUE LIMIT 1`,
    [playerId],
  );
  return res.rows[0]?.cargo_cap ?? 20; // default fallback
}
```

**Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/inventoryService.test.ts
```
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/engine/inventoryService.ts packages/server/src/__tests__/inventoryService.test.ts
git commit -m "feat: inventoryService — addToInventory, removeFromInventory, cargo cap check"
```

---

## Task 4: Migrate MiningService — cargo → inventory

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts`

**Context:** MiningService currently calls `addToCargo(playerId, resource, amount)`. This must become `addToInventory(playerId, 'resource', resource, amount)`.

**Step 1: Write failing test**

```typescript
// packages/server/src/__tests__/miningInventory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  canAddResource: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../db/queries.js', () => ({
  addToCargo: vi.fn(), // should NOT be called
  // ... other mocks as needed
}));

import { addToInventory } from '../../engine/inventoryService.js';
import { addToCargo } from '../../db/queries.js';

describe('MiningService uses inventory', () => {
  it('calls addToInventory not addToCargo on mine complete', async () => {
    // Simulate completing a mine action
    // Import and call the relevant handler after mock setup
    expect(vi.mocked(addToInventory)).toHaveBeenCalledWith(
      expect.any(String), 'resource', expect.any(String), expect.any(Number)
    );
    expect(vi.mocked(addToCargo)).not.toHaveBeenCalled();
  });
});
```

**Step 2: Update MiningService**

In `packages/server/src/rooms/services/MiningService.ts`:

- Add import: `import { addToInventory, canAddResource } from '../../engine/inventoryService.js';`
- Remove import of `addToCargo` from queries
- Replace `await addToCargo(auth.userId, result.resource, result.mined)` with:

```typescript
if (!(await canAddResource(auth.userId, result.mined))) {
  client.send('miningResult', { success: false, error: 'Cargo full' });
  return;
}
await addToInventory(auth.userId, 'resource', result.resource, result.mined);
```

- Update `jettison` handler: replace `deductCargo` with `removeFromInventory`
- Update any cargo-state reads to use `getInventory` filtered by type=resource

**Step 3: Run full server tests**

```bash
cd packages/server && npx vitest run
```
Expected: All previously passing tests still pass

**Step 4: Commit**

```bash
git add packages/server/src/rooms/services/MiningService.ts
git commit -m "refactor: MiningService uses inventory instead of cargo"
```

---

## Task 5: Migrate remaining resource operations

**Files:**
- Modify: `packages/server/src/rooms/services/EconomyService.ts`
- Modify: `packages/server/src/rooms/services/ScanService.ts`
- Modify: `packages/server/src/rooms/services/QuestService.ts`
- Modify: `packages/server/src/db/queries.ts` (update addToCargo/deductCargo callers)

**Pattern for each service:** Replace all `addToCargo`/`deductCargo` calls with `addToInventory`/`removeFromInventory` using `itemType='resource'`.

Search for all remaining callers:
```bash
grep -rn "addToCargo\|deductCargo" packages/server/src/rooms/
```

For each occurrence:
- `addToCargo(playerId, resource, qty)` → `addToInventory(playerId, 'resource', resource, qty)`
- `deductCargo(playerId, resource, qty)` → `removeFromInventory(playerId, 'resource', resource, qty)`
- `getPlayerCargo(playerId)` → `getInventory(playerId)` filtered to type=resource, shaped as CargoState for backwards compat

**Backwards-compat helper** (add to inventoryService.ts):

```typescript
import type { CargoState } from '@void-sector/shared';
import { getInventory } from '../db/queries.js';

export async function getCargoState(playerId: string): Promise<CargoState> {
  const items = await getInventory(playerId);
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
  for (const item of items.filter(i => i.itemType === 'resource')) {
    if (item.itemId in cargo) cargo[item.itemId as keyof CargoState] = item.quantity;
  }
  return cargo;
}
```

**Step: Run full server tests after each service migration**

```bash
cd packages/server && npx vitest run
```

**Step: Commit after all resource services migrated**

```bash
git add packages/server/src/rooms/services/
git commit -m "refactor: all resource operations use unified inventory"
```

---

## Task 6: Migrate module inventory (ShipService)

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Modify: `packages/server/src/engine/permadeathService.ts`

**Context:** Currently `handleBuyModule()` installs directly to ship. With unified inventory, buying goes to inventory first, then install separately.

**Changes to ShipService:**

`handleBuyModule()`:
- After deducting credits → `addToInventory(playerId, 'module', moduleId, 1)` instead of adding to ship slot directly
- Send `inventoryUpdated` message instead of `shipData`

`handleInstallModule()`:
- Check `getInventoryItem(playerId, 'module', moduleId) >= 1` before installing
- On install: `removeFromInventory(playerId, 'module', moduleId, 1)` + add to ship slot

`handleRemoveModule()` (currently removes to nowhere):
- On remove: `addToInventory(playerId, 'module', moduleId, 1)` + remove from ship slot

**permadeathService.ts:**
- Replace `module_inventory` JSONB update with `addToInventory(playerId, 'module', moduleId, 1)` for salvaged modules

**Step: Write test**

```typescript
// packages/server/src/__tests__/moduleInventory.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
}));

// Test that installModule checks inventory and deducts
it('installModule deducts from inventory', async () => {
  // ...
  expect(vi.mocked(removeFromInventory)).toHaveBeenCalledWith(
    expect.any(String), 'module', expect.any(String), 1
  );
});

// Test that removeModule adds to inventory
it('removeModule adds to inventory', async () => {
  // ...
  expect(vi.mocked(addToInventory)).toHaveBeenCalledWith(
    expect.any(String), 'module', expect.any(String), 1
  );
});
```

**Step: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts packages/server/src/engine/permadeathService.ts
git commit -m "refactor: module buy/install/remove uses unified inventory"
```

---

## Task 7: Migrate blueprints to inventory

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts` (`handleActivateBlueprint`)
- Modify: `packages/server/src/rooms/services/ScanService.ts` (blueprint drops from ruins)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (alien encounter blueprint drops)

**Context:** Blueprints previously stored in `player_research.blueprints[]`. Now they are `inventory` items (type=blueprint, quantity always 1).

**handleActivateBlueprint** changes:
- Check `getInventoryItem(playerId, 'blueprint', moduleId) >= 1`
- Remove from inventory: `removeFromInventory(playerId, 'blueprint', moduleId, 1)`
- Add to `player_research.unlocked_modules` as before

**Blueprint drops** (ruins, alien encounters):
- Replace `addBlueprintToPlayer(playerId, moduleId)` DB call with `upsertInventory(playerId, 'blueprint', moduleId, 1)`

Note: blueprints have quantity max 1 (per design). Add check in upsertInventory call:

```typescript
const existing = await getInventoryItem(playerId, 'blueprint', moduleId);
if (existing === 0) {
  await addToInventory(playerId, 'blueprint', moduleId, 1);
  client.send('logEntry', `BLAUPAUSE ERHALTEN: ${moduleId}`);
}
```

**Step: Run tests**

```bash
cd packages/server && npx vitest run
```

**Step: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts packages/server/src/rooms/services/ScanService.ts
git commit -m "refactor: blueprints stored in unified inventory"
```

---

## Task 8: Factory Werkstatt — crafting from blueprints/research

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts` (add craft handler)
- Modify: `packages/server/src/__tests__/werkstatt.test.ts` (new)

**New message handler: `craftModule`**

```typescript
// In ShipService — new handler
async handleCraftModule(client: Client, data: { moduleId: string }): Promise<void> {
  const auth = client.auth as AuthPayload;
  const mod = MODULES[data.moduleId];
  if (!mod || !mod.cost) {
    client.send('craftResult', { success: false, error: 'Unknown module' });
    return;
  }

  // Check recipe available: either researched or has blueprint
  const research = await getPlayerResearch(auth.userId);
  const hasBp = await getInventoryItem(auth.userId, 'blueprint', data.moduleId);
  if (!research.unlockedModules.includes(data.moduleId) && hasBp === 0) {
    client.send('craftResult', { success: false, error: 'No recipe available' });
    return;
  }

  // Check resources (uses cost, not researchCost)
  const credits = await getPlayerCredits(auth.userId);
  if (credits < mod.cost.credits) {
    client.send('craftResult', { success: false, error: 'Not enough credits' });
    return;
  }
  // Check ore/gas/crystal from inventory
  // ...deduct resources, deduct credits, start factory timer or instant if no timer...

  // Simple: instant craft (timer integration is future work)
  await deductCredits(auth.userId, mod.cost.credits);
  if (mod.cost.ore) await removeFromInventory(auth.userId, 'resource', 'ore', mod.cost.ore);
  if (mod.cost.gas) await removeFromInventory(auth.userId, 'resource', 'gas', mod.cost.gas);
  if (mod.cost.crystal) await removeFromInventory(auth.userId, 'resource', 'crystal', mod.cost.crystal);

  await addToInventory(auth.userId, 'module', data.moduleId, 1);
  client.send('craftResult', { success: true, moduleId: data.moduleId });
  client.send('logEntry', `HERGESTELLT: ${mod.name}`);
}
```

Register in `SectorRoom.ts`:
```typescript
onMessage('craftModule', (client, data) => this.ships.handleCraftModule(client, data));
```

**Step: Write test**

```typescript
// packages/server/src/__tests__/werkstatt.test.ts
it('craftModule adds module to inventory when researched', async () => { /* ... */ });
it('craftModule fails without recipe', async () => { /* ... */ });
it('craftModule blueprint allows crafting without research', async () => { /* ... */ });
```

**Step: Run tests + commit**

```bash
cd packages/server && npx vitest run
git add packages/server/src/rooms/services/ShipService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: Werkstatt — craftModule handler (blueprint + research recipes)"
```

---

## Task 9: Kontor Extension — all item types

**Files:**
- Modify: `packages/server/src/db/queries.ts` (kontor queries)
- Modify: `packages/server/src/rooms/services/EconomyService.ts` (Kontor handlers)

**Context:** Kontor already has buy/sell orders for resources. Migration 044 added `item_type` column. Now extend the query layer to pass item_type through.

**Update kontor query functions** in queries.ts to include `item_type`:

```typescript
// Existing createKontorOrder → add item_type parameter
export async function createKontorOrder(params: {
  playerId: string;
  orderType: 'BUY' | 'SELL';
  itemType: 'resource' | 'module' | 'blueprint';
  itemId: string;
  quantity: number;
  pricePerUnit: number;
}): Promise<void> {
  await query(
    `INSERT INTO kontor_orders (player_id, order_type, item_type, item_id, quantity, price_per_unit)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.playerId, params.orderType, params.itemType, params.itemId, params.quantity, params.pricePerUnit],
  );
}
```

**Update EconomyService:** Kontor message handlers pass `item_type` through. When a SELL order is matched and fulfilled: use `transferInventoryItem` instead of cargo-specific calls.

**Step: Run tests + commit**

```bash
cd packages/server && npx vitest run
git commit -m "feat: Kontor handles modules + blueprints via item_type"
```

---

## Task 10: Direct trade — /trade @player

**Files:**
- Create: `packages/server/src/engine/directTradeService.ts`
- Create: `packages/server/src/__tests__/directTrade.test.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Trade session (in-memory, Redis-backed):**

```typescript
// packages/server/src/engine/directTradeService.ts
import type { Redis } from 'ioredis';
import type { InventoryItem } from '@void-sector/shared';

interface TradeOffer {
  fromPlayerId: string;
  toPlayerId: string;
  fromItems: InventoryItem[];
  fromCredits: number;
  toItems: InventoryItem[];
  toCredits: number;
  confirmedBy: string[];   // playerIds that confirmed
  expiresAt: number;
}

const TRADE_TTL_MS = 60_000; // 60s timeout

export class DirectTradeService {
  constructor(private redis: Redis) {}

  async initiateTrade(fromPlayerId: string, toPlayerId: string): Promise<string> {
    const tradeId = `trade:${fromPlayerId}:${toPlayerId}:${Date.now()}`;
    const session: TradeOffer = {
      fromPlayerId, toPlayerId,
      fromItems: [], fromCredits: 0,
      toItems: [], toCredits: 0,
      confirmedBy: [],
      expiresAt: Date.now() + TRADE_TTL_MS,
    };
    await this.redis.setex(tradeId, 60, JSON.stringify(session));
    return tradeId;
  }

  async getSession(tradeId: string): Promise<TradeOffer | null> {
    const raw = await this.redis.get(tradeId);
    return raw ? JSON.parse(raw) : null;
  }

  async updateOffer(tradeId: string, playerId: string, items: InventoryItem[], credits: number): Promise<void> {
    const session = await this.getSession(tradeId);
    if (!session || Date.now() > session.expiresAt) throw new Error('Trade expired');
    if (playerId === session.fromPlayerId) {
      session.fromItems = items; session.fromCredits = credits;
    } else {
      session.toItems = items; session.toCredits = credits;
    }
    session.confirmedBy = []; // reset confirmations on offer change
    await this.redis.setex(tradeId, 60, JSON.stringify(session));
  }

  async confirm(tradeId: string, playerId: string): Promise<boolean> {
    const session = await this.getSession(tradeId);
    if (!session || Date.now() > session.expiresAt) return false;
    if (!session.confirmedBy.includes(playerId)) session.confirmedBy.push(playerId);
    await this.redis.setex(tradeId, 60, JSON.stringify(session));
    return session.confirmedBy.includes(session.fromPlayerId) &&
           session.confirmedBy.includes(session.toPlayerId);
  }

  async cancelTrade(tradeId: string): Promise<void> {
    await this.redis.del(tradeId);
  }
}
```

**Message handlers in SectorRoom.ts:**

```typescript
onMessage('tradeRequest', (client, data: { targetPlayerId: string }) => {
  this.directTrade.handleRequest(client, data);
});
onMessage('tradeOffer', (client, data) => this.directTrade.handleOffer(client, data));
onMessage('tradeConfirm', (client, data) => this.directTrade.handleConfirm(client, data));
onMessage('tradeCancel', (client, data) => this.directTrade.handleCancel(client, data));
```

**Step: Write tests**

```typescript
// packages/server/src/__tests__/directTrade.test.ts
it('initiateTrade stores session in Redis', async () => { /* ... */ });
it('confirm returns true when both players confirmed', async () => { /* ... */ });
it('getSession returns null after TTL', async () => { /* ... */ });
```

**Step: Run tests + commit**

```bash
cd packages/server && npx vitest run
git commit -m "feat: DirectTradeService — session init, offer, confirm, cancel"
```

---

## Task 11: Client — Inventory screen + Kontor MODULE tab

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx`
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/TradeScreen.tsx` (Kontor filter)

**gameSlice additions:**

```typescript
// In ClientShipData or a new inventorySlice:
inventory: InventoryItem[];  // all items (resources + modules + blueprints)
setInventory: (items: InventoryItem[]) => void;
```

**client.ts — new message handler:**

```typescript
room.onMessage('inventoryState', (data: { items: InventoryItem[] }) => {
  useStore.getState().setInventory(data.items);
});
```

**CargoScreen.tsx:** Add tabs RESSOURCEN | MODULE | BLAUPAUSEN. Ressourcen-Tab = existing view. Module-Tab lists module items with [INSTALL] button. Blaupausen-Tab lists blueprints with [CRAFT] and [SELL] buttons.

**TradeScreen.tsx — Kontor:** Add item_type filter dropdown above order list. Pass item_type when creating new orders.

**Direct trade UI:** Simple overlay in CommsScreen or as modal — shows trade session with two columns (Ich biete / Partner bietet), confirm button.

**Step: Run client tests**

```bash
cd packages/client && npx vitest run
```
Expected: All passing

**Step: Commit**

```bash
git add packages/client/src/
git commit -m "feat: client inventory screen, Kontor MODULE/BLUEPRINT tabs, direct trade UI"
```

---

## Task 12: Remove ship buying + switch (ACEP cleanup)

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/client/src/components/HangarPanel.tsx`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/server/src/engine/npcgen.ts`

**Remove from ShipService:**
- `handleBuyHull()` — delete entirely
- `handleSwitchShip()` — delete entirely

**Remove from SectorRoom.ts:**
```typescript
// Delete these lines:
onMessage('buyHull', ...)
onMessage('switchShip', ...)
```

**Remove from HangarPanel.tsx:**
- Buy hull UI (hull selector, price display, buy button)
- Ship list with switch button → replace with single active ship display

**Remove from client.ts:**
- `sendBuyHull()` method
- `sendSwitchShip()` method

**Remove from npcgen.ts:**
- `hasShipyard()` function (only used for ship buying)
- `STATION_SHIPYARD_LEVEL_THRESHOLD` constant (if only used there)

**Archive design docs:**
- Rename `docs/plans/2026-03-04-issue68-raumschiffe-kauf.md` → add `[REMOVED]` prefix in title

**Step: Run all tests**

```bash
cd packages/server && npx vitest run
cd ../client && npx vitest run
```
Expected: Tests for removed features fail → delete those test files too.

**Step: Commit**

```bash
git add -A
git commit -m "feat: remove ship buying/switching — ACEP replaces multi-ship system"
```

---

## Execution Checklist

After all tasks complete:
- [ ] `inventory` table replaces cargo/module_inventory/blueprints in all services
- [ ] `craftModule` handler produces modules from blueprint or research
- [ ] Kontor handles all item types (resource/module/blueprint)
- [ ] Direct trade session works (initiate/offer/confirm/cancel)
- [ ] Client shows inventory by category (resources/modules/blueprints)
- [ ] Ship buying and switching removed
- [ ] All server tests pass
- [ ] All client tests pass
