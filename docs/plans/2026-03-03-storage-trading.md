# Storage, Trading & Credits — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Credits currency, Storage building (3 tiers, transfer model), Trading Post building (3 tiers: NPC trade, player orders, NPC traders), TRADE monitor, and fix the DetailPanel scan bug.

**Architecture:** Credits as DB column on players. Storage as new structure type with `storage_inventory` table. Trading Post with `trade_orders` table. All trades require player at home base. NPC prices as shared constants. New TRADE monitor in sidebar/main arrays.

**Tech Stack:** TypeScript, React, Zustand, Colyseus, PostgreSQL, Vitest

**Design doc:** `docs/plans/2026-03-03-storage-trading-design.md`

---

## Block A: Bugfix + Foundation

### Task 1: Fix DetailPanel not updating after localScan

**Files:**
- Modify: `packages/client/src/network/client.ts:132-141`
- Test: `packages/client/src/__tests__/DetailPanel.test.tsx`

**Step 1: Write the failing test**

Add to `packages/client/src/__tests__/DetailPanel.test.tsx`:

```typescript
it('updates resources after local scan (discoveries sync)', () => {
  // Sector is in discoveries but without resources
  mockStoreState({
    selectedSector: { x: 0, y: 0 },
    position: { x: 0, y: 0 },
    discoveries: {
      '0:0': { x: 0, y: 0, type: 'asteroid_field', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
    },
  });
  // Simulate what localScanResult handler should do: patch discoveries
  const store = useStore.getState();
  const resources = { ore: 30, gas: 5, crystal: 10 };
  const key = '0:0';
  const existing = store.discoveries[key];
  store.addDiscoveries([{ ...existing, resources }]);

  render(<DetailPanel />);
  expect(screen.getByText(/ORE/)).toBeTruthy();
  expect(screen.getByText(/30/)).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/client && npx vitest run src/__tests__/DetailPanel.test.tsx`
Expected: PASS (this tests the store behavior, not the network handler)

**Step 3: Fix the localScanResult handler**

In `packages/client/src/network/client.ts`, change the `localScanResult` handler (line 132-141):

```typescript
room.onMessage('localScanResult', (data: { resources: SectorResources; hiddenSignatures: boolean }) => {
  const store = useStore.getState();
  if (store.currentSector) {
    const updatedSector = { ...store.currentSector, resources: data.resources };
    store.setCurrentSector(updatedSector);
    // Also patch discoveries so DetailPanel sees the resources
    store.addDiscoveries([updatedSector]);
  }
  if (data.hiddenSignatures) {
    store.addLogEntry('UNKNOWN SIGNATURES DETECTED — SCANNER UPGRADE REQUIRED');
  }
  store.addLogEntry(`Local scan: Ore ${data.resources.ore}, Gas ${data.resources.gas}, Crystal ${data.resources.crystal}`);
});
```

**Step 4: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/client/src/network/client.ts packages/client/src/__tests__/DetailPanel.test.tsx
git commit -m "fix(client): sync localScanResult to discoveries so DetailPanel shows resources"
```

---

### Task 2: Add credits to shared types + constants, NPC prices

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add credits to PlayerData**

In `packages/shared/src/types.ts`, add `credits` to `PlayerData`:

```typescript
export interface PlayerData {
  id: string;
  username: string;
  homeBase: Coords;
  xp: number;
  level: number;
  credits?: number;
}
```

**Step 2: Add new structure types and trading types**

In `packages/shared/src/types.ts`, update `StructureType` and add trading types:

```typescript
export type StructureType = 'comm_relay' | 'mining_station' | 'base' | 'storage' | 'trading_post';

export interface StorageInventory {
  ore: number;
  gas: number;
  crystal: number;
}

export interface TransferMessage {
  resource: ResourceType;
  amount: number;
  direction: 'toStorage' | 'fromStorage';
}

export interface TransferResultMessage {
  success: boolean;
  error?: string;
  cargo?: CargoState;
  storage?: StorageInventory;
}

export interface UpgradeStructureMessage {
  structureId: string;
}

export interface UpgradeResultMessage {
  success: boolean;
  error?: string;
  newTier?: number;
  creditsRemaining?: number;
}

export type TradeOrderType = 'buy' | 'sell';

export interface TradeOrder {
  id: string;
  playerId: string;
  playerName: string;
  resource: ResourceType;
  amount: number;
  pricePerUnit: number;
  type: TradeOrderType;
  createdAt: string;
}

export interface NpcTradeMessage {
  resource: ResourceType;
  amount: number;
  action: 'buy' | 'sell';
}

export interface NpcTradeResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  cargo?: CargoState;
  storage?: StorageInventory;
}

export interface PlaceOrderMessage {
  resource: ResourceType;
  amount: number;
  pricePerUnit: number;
  type: TradeOrderType;
}

export interface AcceptOrderMessage {
  orderId: string;
}
```

**Step 3: Add NPC prices and structure costs to constants**

In `packages/shared/src/constants.ts`, add:

```typescript
// NPC Trade Prices (base prices per unit in credits)
export const NPC_PRICES: Record<ResourceType, number> = {
  ore: 10,
  gas: 15,
  crystal: 25,
};

export const NPC_BUY_SPREAD = 1.2;   // player pays 120% to buy from NPC
export const NPC_SELL_SPREAD = 0.8;  // player gets 80% selling to NPC

// Storage tiers
export const STORAGE_TIERS: Record<number, { capacity: number; upgradeCost: number }> = {
  1: { capacity: 50, upgradeCost: 0 },
  2: { capacity: 150, upgradeCost: 200 },
  3: { capacity: 500, upgradeCost: 1000 },
};

// Trading Post tiers
export const TRADING_POST_TIERS: Record<number, { name: string; upgradeCost: number }> = {
  1: { name: 'NPC TRADE', upgradeCost: 0 },
  2: { name: 'MARKTPLATZ', upgradeCost: 500 },
  3: { name: 'AUTO-TRADE', upgradeCost: 3000 },
};
```

Also update `STRUCTURE_COSTS` and `STRUCTURE_AP_COSTS`:

```typescript
export const STRUCTURE_COSTS: Record<StructureType, Record<ResourceType, number>> = {
  comm_relay: { ore: 5, gas: 0, crystal: 2 },
  mining_station: { ore: 30, gas: 15, crystal: 10 },
  base: { ore: 50, gas: 30, crystal: 25 },
  storage: { ore: 20, gas: 10, crystal: 5 },
  trading_post: { ore: 30, gas: 20, crystal: 15 },
};

export const STRUCTURE_AP_COSTS: Record<StructureType, number> = {
  comm_relay: 5,
  mining_station: 15,
  base: 25,
  storage: 10,
  trading_post: 15,
};
```

Add `TRADE` to MONITORS:

```typescript
export const MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
  COMMS: 'COMMS',
  BASE_LINK: 'BASE-LINK',
  LOG: 'LOG',
  TRADE: 'TRADE',
} as const;
```

Add TRADE to `RIGHT_SIDEBAR_MONITORS`, `LEFT_SIDEBAR_MONITORS`, and `MAIN_MONITORS`.

**Step 4: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add credits, storage, trading types and NPC price constants"
```

---

### Task 3: DB migration 006 — credits, storage_inventory, structure tier, trade_orders

**Files:**
- Create: `packages/server/src/db/migrations/006_trading.sql`

**Step 1: Write the migration**

```sql
-- Add credits to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Add tier to structures
ALTER TABLE structures ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;

-- Storage inventory (per player, like cargo but for base storage)
CREATE TABLE IF NOT EXISTS storage_inventory (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  ore INTEGER DEFAULT 0,
  gas INTEGER DEFAULT 0,
  crystal INTEGER DEFAULT 0
);

-- Trade orders
CREATE TABLE IF NOT EXISTS trade_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  resource VARCHAR(16) NOT NULL,
  amount INTEGER NOT NULL,
  price_per_unit INTEGER NOT NULL,
  type VARCHAR(8) NOT NULL CHECK (type IN ('buy', 'sell')),
  fulfilled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_orders_player ON trade_orders(player_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_active ON trade_orders(fulfilled, resource);
```

**Step 2: Commit**

```bash
git add packages/server/src/db/migrations/006_trading.sql
git commit -m "feat(server): add migration 006 for credits, storage, structure tiers, trade orders"
```

---

## Block B: Server — Storage & Credits

### Task 4: Add DB query functions for credits, storage, trading

**Files:**
- Modify: `packages/server/src/db/queries.ts`

**Step 1: Add credits queries**

Append to `packages/server/src/db/queries.ts`:

```typescript
export async function getPlayerCredits(playerId: string): Promise<number> {
  const { rows } = await query<{ credits: number }>(
    'SELECT credits FROM players WHERE id = $1',
    [playerId]
  );
  return rows[0]?.credits ?? 0;
}

export async function addCredits(playerId: string, amount: number): Promise<number> {
  const { rows } = await query<{ credits: number }>(
    'UPDATE players SET credits = credits + $2 WHERE id = $1 RETURNING credits',
    [playerId, amount]
  );
  return rows[0].credits;
}

export async function deductCredits(playerId: string, amount: number): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE players SET credits = credits - $2 WHERE id = $1 AND credits >= $2',
    [playerId, amount]
  );
  return (rowCount ?? 0) > 0;
}
```

**Step 2: Add storage queries**

```typescript
export async function getStorageInventory(playerId: string): Promise<{ ore: number; gas: number; crystal: number }> {
  const { rows } = await query<{ ore: number; gas: number; crystal: number }>(
    'SELECT ore, gas, crystal FROM storage_inventory WHERE player_id = $1',
    [playerId]
  );
  if (rows.length === 0) return { ore: 0, gas: 0, crystal: 0 };
  return { ore: rows[0].ore, gas: rows[0].gas, crystal: rows[0].crystal };
}

export async function updateStorageResource(
  playerId: string, resource: ResourceType, delta: number
): Promise<boolean> {
  // Upsert: create row if not exists, then add delta
  const { rowCount } = await query(
    `INSERT INTO storage_inventory (player_id, ${resource})
     VALUES ($1, GREATEST(0, $2))
     ON CONFLICT (player_id) DO UPDATE
     SET ${resource} = GREATEST(0, storage_inventory.${resource} + $2)`,
    [playerId, delta]
  );
  return (rowCount ?? 0) > 0;
}
```

**Step 3: Add structure tier query**

```typescript
export async function getStructureTier(structureId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>(
    'SELECT tier FROM structures WHERE id = $1',
    [structureId]
  );
  return rows[0]?.tier ?? 1;
}

export async function upgradeStructureTier(structureId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>(
    'UPDATE structures SET tier = tier + 1 WHERE id = $1 RETURNING tier',
    [structureId]
  );
  return rows[0].tier;
}

export async function getPlayerStructure(
  playerId: string, type: string
): Promise<{ id: string; tier: number; sector_x: number; sector_y: number } | null> {
  const { rows } = await query<{ id: string; tier: number; sector_x: number; sector_y: number }>(
    `SELECT s.id, s.tier, s.sector_x, s.sector_y FROM structures s
     JOIN players p ON p.id = $1
     WHERE s.owner_id = $1 AND s.type = $2
       AND s.sector_x = (p.home_base->>'x')::int
       AND s.sector_y = (p.home_base->>'y')::int`,
    [playerId, type]
  );
  return rows[0] ?? null;
}
```

**Step 4: Add trade order queries**

```typescript
export async function createTradeOrder(
  playerId: string, resource: ResourceType, amount: number, pricePerUnit: number, type: 'buy' | 'sell'
): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO trade_orders (player_id, resource, amount, price_per_unit, type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [playerId, resource, amount, pricePerUnit, type]
  );
  return rows[0];
}

export async function getActiveTradeOrders(): Promise<any[]> {
  const { rows } = await query(
    `SELECT t.*, p.username as player_name FROM trade_orders t
     JOIN players p ON t.player_id = p.id
     WHERE t.fulfilled = FALSE ORDER BY t.created_at DESC`
  );
  return rows;
}

export async function getPlayerTradeOrders(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM trade_orders WHERE player_id = $1 AND fulfilled = FALSE ORDER BY created_at DESC`,
    [playerId]
  );
  return rows;
}

export async function fulfillTradeOrder(orderId: string): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE trade_orders SET fulfilled = TRUE WHERE id = $1 AND fulfilled = FALSE',
    [orderId]
  );
  return (rowCount ?? 0) > 0;
}

export async function cancelTradeOrder(orderId: string, playerId: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM trade_orders WHERE id = $1 AND player_id = $2 AND fulfilled = FALSE',
    [orderId, playerId]
  );
  return (rowCount ?? 0) > 0;
}
```

**Step 5: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(server): add DB queries for credits, storage, structure tiers, trade orders"
```

---

### Task 5: Server command validation for transfer + NPC trade

**Files:**
- Modify: `packages/server/src/engine/commands.ts`

**Step 1: Add transfer validation**

Append to `packages/server/src/engine/commands.ts`:

```typescript
import { NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, STORAGE_TIERS, TRADING_POST_TIERS } from '@void-sector/shared';
import type { StorageInventory, ResourceType } from '@void-sector/shared';

export interface TransferValidation {
  valid: boolean;
  error?: string;
}

export function validateTransfer(
  direction: 'toStorage' | 'fromStorage',
  resource: ResourceType,
  amount: number,
  cargo: CargoState,
  storage: StorageInventory,
  storageTier: number,
): TransferValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive' };
  if (!['ore', 'gas', 'crystal'].includes(resource)) return { valid: false, error: 'Invalid resource' };

  const tierConfig = STORAGE_TIERS[storageTier];
  if (!tierConfig) return { valid: false, error: 'Invalid storage tier' };

  if (direction === 'toStorage') {
    if (cargo[resource] < amount) return { valid: false, error: `Not enough ${resource} in cargo` };
    const storageTotal = storage.ore + storage.gas + storage.crystal;
    if (storageTotal + amount > tierConfig.capacity) {
      return { valid: false, error: `Storage full (${storageTotal}/${tierConfig.capacity})` };
    }
  } else {
    if (storage[resource] < amount) return { valid: false, error: `Not enough ${resource} in storage` };
  }

  return { valid: true };
}

export interface NpcTradeValidation {
  valid: boolean;
  error?: string;
  totalPrice: number;
}

export function validateNpcTrade(
  action: 'buy' | 'sell',
  resource: ResourceType,
  amount: number,
  credits: number,
  storage: StorageInventory,
  storageTier: number,
): NpcTradeValidation {
  if (amount <= 0) return { valid: false, error: 'Amount must be positive', totalPrice: 0 };
  if (!['ore', 'gas', 'crystal'].includes(resource)) return { valid: false, error: 'Invalid resource', totalPrice: 0 };

  const basePrice = NPC_PRICES[resource];
  const tierConfig = STORAGE_TIERS[storageTier];

  if (action === 'buy') {
    const totalPrice = Math.ceil(basePrice * NPC_BUY_SPREAD * amount);
    if (credits < totalPrice) return { valid: false, error: `Need ${totalPrice} credits (have ${credits})`, totalPrice };
    const storageTotal = storage.ore + storage.gas + storage.crystal;
    if (storageTotal + amount > tierConfig.capacity) {
      return { valid: false, error: 'Storage full', totalPrice };
    }
    return { valid: true, totalPrice };
  } else {
    const totalPrice = Math.floor(basePrice * NPC_SELL_SPREAD * amount);
    if (storage[resource] < amount) return { valid: false, error: `Not enough ${resource} in storage`, totalPrice };
    return { valid: true, totalPrice };
  }
}
```

**Step 2: Write tests**

Create `packages/server/src/__tests__/commands-trade.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateTransfer, validateNpcTrade } from '../engine/commands';

describe('validateTransfer', () => {
  const cargo = { ore: 10, gas: 5, crystal: 2 };
  const storage = { ore: 20, gas: 10, crystal: 5 };

  it('allows toStorage when cargo has enough', () => {
    const result = validateTransfer('toStorage', 'ore', 5, cargo, storage, 1);
    expect(result.valid).toBe(true);
  });

  it('rejects toStorage when cargo insufficient', () => {
    const result = validateTransfer('toStorage', 'ore', 20, cargo, storage, 1);
    expect(result.valid).toBe(false);
  });

  it('rejects toStorage when storage full', () => {
    const fullStorage = { ore: 45, gas: 3, crystal: 2 }; // total 50 = tier 1 cap
    const result = validateTransfer('toStorage', 'ore', 1, cargo, fullStorage, 1);
    expect(result.valid).toBe(false);
  });

  it('allows fromStorage when storage has enough', () => {
    const result = validateTransfer('fromStorage', 'ore', 10, cargo, storage, 1);
    expect(result.valid).toBe(true);
  });

  it('rejects fromStorage when storage insufficient', () => {
    const result = validateTransfer('fromStorage', 'ore', 30, cargo, storage, 1);
    expect(result.valid).toBe(false);
  });
});

describe('validateNpcTrade', () => {
  const storage = { ore: 20, gas: 10, crystal: 5 };

  it('allows selling when storage has resources', () => {
    const result = validateNpcTrade('sell', 'ore', 5, 0, storage, 1);
    expect(result.valid).toBe(true);
    expect(result.totalPrice).toBe(40); // 10 * 0.8 * 5 = 40
  });

  it('allows buying when credits sufficient', () => {
    const result = validateNpcTrade('buy', 'ore', 5, 100, storage, 2);
    expect(result.valid).toBe(true);
    expect(result.totalPrice).toBe(60); // ceil(10 * 1.2 * 5) = 60
  });

  it('rejects buying when credits insufficient', () => {
    const result = validateNpcTrade('buy', 'crystal', 10, 50, storage, 2);
    expect(result.valid).toBe(false);
  });

  it('rejects selling when storage empty', () => {
    const result = validateNpcTrade('sell', 'ore', 30, 0, storage, 1);
    expect(result.valid).toBe(false);
  });
});
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/__tests__/commands-trade.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/__tests__/commands-trade.test.ts
git commit -m "feat(server): add transfer and NPC trade validation with tests"
```

---

### Task 6: Wire storage + trade message handlers in SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add imports**

Add to imports in `SectorRoom.ts`:

```typescript
import { getStorageInventory, updateStorageResource, getPlayerCredits, addCredits, deductCredits, getPlayerStructure, upgradeStructureTier, createTradeOrder, getActiveTradeOrders, getPlayerTradeOrders, fulfillTradeOrder, cancelTradeOrder } from '../db/queries.js';
import { validateTransfer, validateNpcTrade } from '../engine/commands.js';
import type { TransferMessage, NpcTradeMessage, UpgradeStructureMessage, PlaceOrderMessage, AcceptOrderMessage, StorageInventory } from '@void-sector/shared';
import { STORAGE_TIERS, TRADING_POST_TIERS } from '@void-sector/shared';
```

**Step 2: Register message handlers in onCreate**

Add to `onCreate` method after the existing `getBase` handler:

```typescript
// Send credits on join (add to onJoin too)
this.onMessage('getCredits', async (client) => {
  const auth = client.auth as AuthPayload;
  const credits = await getPlayerCredits(auth.userId);
  client.send('creditsUpdate', { credits });
});

// Storage transfer
this.onMessage('transfer', async (client, data: TransferMessage) => {
  await this.handleTransfer(client, data);
});

// NPC trade
this.onMessage('npcTrade', async (client, data: NpcTradeMessage) => {
  await this.handleNpcTrade(client, data);
});

// Upgrade structure
this.onMessage('upgradeStructure', async (client, data: UpgradeStructureMessage) => {
  await this.handleUpgradeStructure(client, data);
});

// Trade orders
this.onMessage('placeOrder', async (client, data: PlaceOrderMessage) => {
  await this.handlePlaceOrder(client, data);
});

this.onMessage('getTradeOrders', async (client) => {
  const orders = await getActiveTradeOrders();
  client.send('tradeOrders', { orders });
});

this.onMessage('getMyOrders', async (client) => {
  const auth = client.auth as AuthPayload;
  const orders = await getPlayerTradeOrders(auth.userId);
  client.send('myOrders', { orders });
});

this.onMessage('cancelOrder', async (client, data: { orderId: string }) => {
  const auth = client.auth as AuthPayload;
  const cancelled = await cancelTradeOrder(data.orderId, auth.userId);
  client.send('cancelOrderResult', { success: cancelled });
});

// Storage inventory request
this.onMessage('getStorage', async (client) => {
  const auth = client.auth as AuthPayload;
  const storage = await getStorageInventory(auth.userId);
  client.send('storageUpdate', storage);
});
```

**Step 3: Add handler methods**

Add as private methods on the class:

```typescript
private async handleTransfer(client: Client, data: TransferMessage) {
  const auth = client.auth as AuthPayload;
  const { resource, amount, direction } = data;

  // Must be at home base
  const player = await findPlayerByUsername(auth.username);
  if (!player) { client.send('error', { code: 'NO_PLAYER', message: 'Player not found' }); return; }
  if (this.state.sector.x !== player.homeBase.x || this.state.sector.y !== player.homeBase.y) {
    client.send('transferResult', { success: false, error: 'Must be at home base' });
    return;
  }

  const storageStruct = await getPlayerStructure(auth.userId, 'storage');
  if (!storageStruct) {
    client.send('transferResult', { success: false, error: 'No storage built' });
    return;
  }

  const cargo = await getPlayerCargo(auth.userId);
  const storage = await getStorageInventory(auth.userId);
  const result = validateTransfer(direction, resource, amount, cargo, storage, storageStruct.tier);
  if (!result.valid) {
    client.send('transferResult', { success: false, error: result.error });
    return;
  }

  if (direction === 'toStorage') {
    const deducted = await deductCargo(auth.userId, resource, amount);
    if (!deducted) { client.send('transferResult', { success: false, error: 'Cargo changed' }); return; }
    await updateStorageResource(auth.userId, resource, amount);
  } else {
    await updateStorageResource(auth.userId, resource, -amount);
    await addToCargo(auth.userId, resource, amount);
  }

  const updatedCargo = await getPlayerCargo(auth.userId);
  const updatedStorage = await getStorageInventory(auth.userId);
  client.send('transferResult', { success: true, cargo: updatedCargo, storage: updatedStorage });
  client.send('cargoUpdate', updatedCargo);
  client.send('storageUpdate', updatedStorage);
}

private async handleNpcTrade(client: Client, data: NpcTradeMessage) {
  const auth = client.auth as AuthPayload;
  const { resource, amount, action } = data;

  // Must be at home base
  const player = await findPlayerByUsername(auth.username);
  if (!player) return;
  if (this.state.sector.x !== player.homeBase.x || this.state.sector.y !== player.homeBase.y) {
    client.send('npcTradeResult', { success: false, error: 'Must be at home base' });
    return;
  }

  const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
  if (!tradingPost) {
    client.send('npcTradeResult', { success: false, error: 'No trading post built' });
    return;
  }

  const storageStruct = await getPlayerStructure(auth.userId, 'storage');
  const storageTier = storageStruct?.tier ?? 1;
  const credits = await getPlayerCredits(auth.userId);
  const storage = await getStorageInventory(auth.userId);

  const result = validateNpcTrade(action, resource, amount, credits, storage, storageTier);
  if (!result.valid) {
    client.send('npcTradeResult', { success: false, error: result.error });
    return;
  }

  if (action === 'sell') {
    await updateStorageResource(auth.userId, resource, -amount);
    const newCredits = await addCredits(auth.userId, result.totalPrice);
    const updatedStorage = await getStorageInventory(auth.userId);
    client.send('npcTradeResult', { success: true, credits: newCredits, storage: updatedStorage });
    client.send('creditsUpdate', { credits: newCredits });
    client.send('storageUpdate', updatedStorage);
  } else {
    const deducted = await deductCredits(auth.userId, result.totalPrice);
    if (!deducted) { client.send('npcTradeResult', { success: false, error: 'Credits changed' }); return; }
    await updateStorageResource(auth.userId, resource, amount);
    const newCredits = await getPlayerCredits(auth.userId);
    const updatedStorage = await getStorageInventory(auth.userId);
    client.send('npcTradeResult', { success: true, credits: newCredits, storage: updatedStorage });
    client.send('creditsUpdate', { credits: newCredits });
    client.send('storageUpdate', updatedStorage);
  }
}

private async handleUpgradeStructure(client: Client, data: UpgradeStructureMessage) {
  const auth = client.auth as AuthPayload;
  const { structureId } = data;

  const struct = await query<{ id: string; type: string; tier: number; owner_id: string }>(
    'SELECT id, type, tier, owner_id FROM structures WHERE id = $1',
    [structureId]
  );
  const row = struct.rows[0];
  if (!row || row.owner_id !== auth.userId) {
    client.send('upgradeResult', { success: false, error: 'Structure not found' });
    return;
  }

  const tierMap = row.type === 'storage' ? STORAGE_TIERS : row.type === 'trading_post' ? TRADING_POST_TIERS : null;
  if (!tierMap) {
    client.send('upgradeResult', { success: false, error: 'Not upgradeable' });
    return;
  }

  const nextTier = row.tier + 1;
  const nextConfig = tierMap[nextTier];
  if (!nextConfig) {
    client.send('upgradeResult', { success: false, error: 'Already max tier' });
    return;
  }

  const cost = nextConfig.upgradeCost;
  if (cost > 0) {
    const deducted = await deductCredits(auth.userId, cost);
    if (!deducted) {
      client.send('upgradeResult', { success: false, error: `Need ${cost} credits` });
      return;
    }
  }

  const newTier = await upgradeStructureTier(structureId);
  const credits = await getPlayerCredits(auth.userId);
  client.send('upgradeResult', { success: true, newTier, creditsRemaining: credits });
  client.send('creditsUpdate', { credits });

  // Refresh base structures
  const structures = await getPlayerBaseStructures(auth.userId);
  client.send('baseData', { structures });
}

private async handlePlaceOrder(client: Client, data: PlaceOrderMessage) {
  const auth = client.auth as AuthPayload;
  const { resource, amount, pricePerUnit, type } = data;

  const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
  if (!tradingPost || tradingPost.tier < 2) {
    client.send('error', { code: 'NO_MARKET', message: 'Need Trading Post Tier 2+' });
    return;
  }

  if (amount <= 0 || pricePerUnit <= 0) {
    client.send('error', { code: 'INVALID_ORDER', message: 'Invalid amount or price' });
    return;
  }

  // For sell orders, lock resources from storage
  if (type === 'sell') {
    const storage = await getStorageInventory(auth.userId);
    if (storage[resource] < amount) {
      client.send('error', { code: 'INSUFFICIENT', message: `Not enough ${resource} in storage` });
      return;
    }
    await updateStorageResource(auth.userId, resource, -amount);
  } else {
    // For buy orders, lock credits
    const totalCost = pricePerUnit * amount;
    const deducted = await deductCredits(auth.userId, totalCost);
    if (!deducted) {
      client.send('error', { code: 'INSUFFICIENT', message: 'Not enough credits' });
      return;
    }
  }

  const order = await createTradeOrder(auth.userId, resource, amount, pricePerUnit, type);
  client.send('orderPlaced', { success: true, orderId: order.id });
}
```

**Note:** The `handleUpgradeStructure` method uses `query` directly — import it at the top:
```typescript
import { query } from '../db/client.js';
```
Alternatively, use a dedicated query function. The inline approach is acceptable for now.

Actually, better to add `findPlayerByUsername` to the imports from queries since we need it. It's already exported.

**Step 4: Send credits on join**

In the `onJoin` method, after sending initial cargo, add:

```typescript
// Send credits
const credits = await getPlayerCredits(auth.userId);
client.send('creditsUpdate', { credits });

// Send storage
const storage = await getStorageInventory(auth.userId);
client.send('storageUpdate', storage);
```

**Step 5: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): wire transfer, NPC trade, upgrade, and order handlers in SectorRoom"
```

---

## Block C: Client — State & Network

### Task 7: Add credits, storage, trade state to Zustand store

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`

**Step 1: Add state fields and actions**

Add to `GameSlice` interface:

```typescript
// Credits
credits: number;

// Storage
storage: StorageInventory;

// Trade orders
tradeOrders: TradeOrder[];
myOrders: TradeOrder[];

// Actions
setCredits: (credits: number) => void;
setStorage: (storage: StorageInventory) => void;
setTradeOrders: (orders: TradeOrder[]) => void;
setMyOrders: (orders: TradeOrder[]) => void;
```

Add import:
```typescript
import type { ..., StorageInventory, TradeOrder } from '@void-sector/shared';
```

Add initial state in `createGameSlice`:
```typescript
credits: 0,
storage: { ore: 0, gas: 0, crystal: 0 },
tradeOrders: [],
myOrders: [],
```

Add actions:
```typescript
setCredits: (credits) => set({ credits }),
setStorage: (storage) => set({ storage }),
setTradeOrders: (tradeOrders) => set({ tradeOrders }),
setMyOrders: (myOrders) => set({ myOrders }),
```

**Step 2: Update mockStore**

In `packages/client/src/test/mockStore.ts`, add defaults:

```typescript
credits: 0,
storage: { ore: 0, gas: 0, crystal: 0 },
tradeOrders: [],
myOrders: [],
```

**Step 3: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/test/mockStore.ts
git commit -m "feat(client): add credits, storage, trade orders to Zustand store"
```

---

### Task 8: Wire network handlers for credits, storage, trade

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add message listeners in setupRoomListeners**

Add after existing `baseData` handler:

```typescript
// Credits update
room.onMessage('creditsUpdate', (data: { credits: number }) => {
  useStore.getState().setCredits(data.credits);
});

// Storage update
room.onMessage('storageUpdate', (data: StorageInventory) => {
  useStore.getState().setStorage(data);
});

// Transfer result
room.onMessage('transferResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry('Transfer complete');
  } else {
    store.addLogEntry(`Transfer failed: ${data.error}`);
  }
});

// NPC trade result
room.onMessage('npcTradeResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry('Trade complete');
  } else {
    store.addLogEntry(`Trade failed: ${data.error}`);
  }
});

// Upgrade result
room.onMessage('upgradeResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry(`Upgraded to tier ${data.newTier}`);
  } else {
    store.addLogEntry(`Upgrade failed: ${data.error}`);
  }
});

// Trade orders
room.onMessage('tradeOrders', (data: { orders: any[] }) => {
  useStore.getState().setTradeOrders(data.orders);
});

room.onMessage('myOrders', (data: { orders: any[] }) => {
  useStore.getState().setMyOrders(data.orders);
});

room.onMessage('orderPlaced', (data: any) => {
  if (data.success) {
    useStore.getState().addLogEntry('Order placed');
  }
});
```

**Step 2: Add send methods to GameNetwork class**

```typescript
sendTransfer(resource: string, amount: number, direction: 'toStorage' | 'fromStorage') {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('transfer', { resource, amount, direction });
}

sendNpcTrade(resource: string, amount: number, action: 'buy' | 'sell') {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('npcTrade', { resource, amount, action });
}

sendUpgradeStructure(structureId: string) {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('upgradeStructure', { structureId });
}

sendPlaceOrder(resource: string, amount: number, pricePerUnit: number, type: 'buy' | 'sell') {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('placeOrder', { resource, amount, pricePerUnit, type });
}

requestTradeOrders() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getTradeOrders', {});
}

requestMyOrders() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getMyOrders', {});
}

requestStorage() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getStorage', {});
}

requestCredits() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getCredits', {});
}

sendCancelOrder(orderId: string) {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('cancelOrder', { orderId });
}
```

**Step 3: Add import**

Add `StorageInventory` to the import from shared:
```typescript
import type { ..., StorageInventory } from '@void-sector/shared';
```

**Step 4: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(client): wire network handlers for credits, storage, trade"
```

---

## Block D: Client — UI Components

### Task 9: Update BaseScreen with storage transfer UI

**Files:**
- Modify: `packages/client/src/components/BaseScreen.tsx`

**Step 1: Add storage section**

Rewrite `BaseScreen.tsx` to include storage transfer buttons and upgrade UI:

```typescript
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STORAGE_TIERS, TRADING_POST_TIERS } from '@void-sector/shared';

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'KOMMANDO-KERN',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
  storage: 'LAGER',
  trading_post: 'HANDELSPLATZ',
};

export function BaseScreen() {
  const baseStructures = useStore((s) => s.baseStructures);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const credits = useStore((s) => s.credits);
  const position = useStore((s) => s.position);
  const [transferAmount, setTransferAmount] = useState(1);

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
  }, []);

  const hasBase = baseStructures.some((s: any) => s.type === 'base');
  const storageStruct = baseStructures.find((s: any) => s.type === 'storage');
  const tradingPostStruct = baseStructures.find((s: any) => s.type === 'trading_post');
  const storageTier = storageStruct?.tier ?? 0;
  const storageCap = storageTier > 0 ? STORAGE_TIERS[storageTier]?.capacity ?? 0 : 0;
  const storageTotal = storage.ore + storage.gas + storage.crystal;

  const btnStyle = {
    background: 'transparent',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    padding: '2px 6px',
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '12px', opacity: 0.6 }}>
        BASE-LINK — {hasBase ? 'CONNECTED' : 'NO SIGNAL'}
      </div>

      <div style={{ marginBottom: 8 }}>CREDITS: {credits}</div>

      {!hasBase ? (
        <div>
          <div style={{ opacity: 0.4, marginBottom: '12px' }}>NO BASE CONSTRUCTED</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
            Navigate to a sector and use [BUILD BASE] to establish your home base.
          </div>
        </div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            STRUCTURES
          </div>
          {baseStructures.map((s: any) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{STRUCTURE_LABELS[s.type] || s.type.toUpperCase()}</span>
              <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>
                {s.tier > 1 ? `T${s.tier}` : ''} [ACTIVE]
              </span>
            </div>
          ))}

          {/* Storage Section */}
          {storageStruct && (
            <>
              <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
                LAGER ({storageTotal}/{storageCap})
              </div>
              <div>ERZ: {storage.ore} &nbsp; GAS: {storage.gas} &nbsp; KRISTALL: {storage.crystal}</div>

              <div style={{ marginTop: 8, fontSize: '0.7rem' }}>
                <label>MENGE: </label>
                <input
                  type="number" min={1} value={transferAmount}
                  onChange={(e) => setTransferAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {(['ore', 'gas', 'crystal'] as const).map((res) => (
                  <div key={res} style={{ display: 'flex', gap: 2 }}>
                    <button style={btnStyle} onClick={() => network.sendTransfer(res, transferAmount, 'toStorage')}>
                      {res.toUpperCase()} &rarr; LAGER
                    </button>
                    <button style={btnStyle} onClick={() => network.sendTransfer(res, transferAmount, 'fromStorage')}>
                      LAGER &rarr; {res.toUpperCase()}
                    </button>
                  </div>
                ))}
              </div>

              {/* Upgrade storage */}
              {storageTier < 3 && (
                <button style={{ ...btnStyle, marginTop: 8 }} onClick={() => network.sendUpgradeStructure(storageStruct.id)}>
                  UPGRADE LAGER T{storageTier + 1} ({STORAGE_TIERS[storageTier + 1]?.upgradeCost} CR)
                </button>
              )}
            </>
          )}

          {/* Upgrade trading post */}
          {tradingPostStruct && (tradingPostStruct.tier ?? 1) < 3 && (
            <button
              style={{ ...btnStyle, marginTop: 8 }}
              onClick={() => network.sendUpgradeStructure(tradingPostStruct.id)}
            >
              UPGRADE HANDELSPLATZ T{(tradingPostStruct.tier ?? 1) + 1} ({TRADING_POST_TIERS[(tradingPostStruct.tier ?? 1) + 1]?.upgradeCost} CR)
            </button>
          )}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
            CARGO ON SHIP
          </div>
          <div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal}</div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/BaseScreen.tsx
git commit -m "feat(client): add storage transfer UI and upgrade buttons to BaseScreen"
```

---

### Task 10: Create TradeScreen component (TRADE monitor)

**Files:**
- Create: `packages/client/src/components/TradeScreen.tsx`

**Step 1: Create the component**

```typescript
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD } from '@void-sector/shared';
import type { ResourceType } from '@void-sector/shared';

export function TradeScreen() {
  const credits = useStore((s) => s.credits);
  const storage = useStore((s) => s.storage);
  const baseStructures = useStore((s) => s.baseStructures);
  const tradeOrders = useStore((s) => s.tradeOrders);
  const myOrders = useStore((s) => s.myOrders);
  const [amount, setAmount] = useState(1);
  const [tab, setTab] = useState<'npc' | 'market'>('npc');

  const tradingPost = baseStructures.find((s: any) => s.type === 'trading_post');
  const tier = tradingPost?.tier ?? 0;

  useEffect(() => {
    if (tier >= 2) {
      network.requestTradeOrders();
      network.requestMyOrders();
    }
  }, [tier]);

  if (!tradingPost) {
    return (
      <div style={{ padding: 16, textAlign: 'center', opacity: 0.4, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: 8 }}>NO TRADING POST</div>
        <div style={{ fontSize: '0.7rem' }}>Build a Trading Post at your home base.</div>
      </div>
    );
  }

  const btnStyle = {
    background: 'transparent',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    padding: '3px 8px',
    cursor: 'pointer',
  };

  const tabStyle = (active: boolean) => ({
    ...btnStyle,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#050505' : 'var(--color-primary)',
  });

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '8px', opacity: 0.6 }}>
        TRADE — T{tier} | {credits} CR
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button style={tabStyle(tab === 'npc')} onClick={() => setTab('npc')}>NPC HANDEL</button>
        {tier >= 2 && <button style={tabStyle(tab === 'market')} onClick={() => setTab('market')}>MARKT</button>}
      </div>

      {/* Amount input */}
      <div style={{ fontSize: '0.7rem', marginBottom: 8 }}>
        <label>MENGE: </label>
        <input
          type="number" min={1} value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}
        />
      </div>

      {tab === 'npc' && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            NPC PREISE (KAUF / VERKAUF)
          </div>
          {(['ore', 'gas', 'crystal'] as ResourceType[]).map((res) => {
            const buyPrice = Math.ceil(NPC_PRICES[res] * NPC_BUY_SPREAD * amount);
            const sellPrice = Math.floor(NPC_PRICES[res] * NPC_SELL_SPREAD * amount);
            return (
              <div key={res} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 60 }}>{res.toUpperCase()}</span>
                <button style={btnStyle} onClick={() => network.sendNpcTrade(res, amount, 'buy')}>
                  KAUFEN ({buyPrice} CR)
                </button>
                <button style={btnStyle} onClick={() => network.sendNpcTrade(res, amount, 'sell')}>
                  VERKAUFEN ({sellPrice} CR)
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
            LAGER: ERZ {storage.ore} | GAS {storage.gas} | KRISTALL {storage.crystal}
          </div>
        </div>
      )}

      {tab === 'market' && tier >= 2 && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            MARKT ORDERS
          </div>
          {tradeOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE ORDERS</div>
          ) : (
            tradeOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                [{o.type.toUpperCase()}] {o.amount}x {o.resource.toUpperCase()} @ {o.price_per_unit} CR — {o.player_name}
              </div>
            ))
          )}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '12px' }}>
            MEINE ORDERS
          </div>
          {myOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE EIGENEN ORDERS</div>
          ) : (
            myOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', display: 'flex', gap: 8 }}>
                [{o.type}] {o.amount}x {o.resource} @ {o.price_per_unit}
                <button style={{ ...btnStyle, fontSize: '0.6rem' }} onClick={() => network.sendCancelOrder(o.id)}>X</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/TradeScreen.tsx
git commit -m "feat(client): create TradeScreen component with NPC trade and market UI"
```

---

### Task 11: Wire TRADE monitor into GameScreen + DesktopLayout

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Import TradeScreen and add to renderScreen**

Add import:
```typescript
import { TradeScreen } from './TradeScreen';
```

Add case in `renderScreen`:
```typescript
case MONITORS.TRADE: return <TradeScreen />;
```

**Step 2: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): wire TRADE monitor into GameScreen renderScreen"
```

---

### Task 12: Write tests for TradeScreen + BaseScreen storage

**Files:**
- Create: `packages/client/src/__tests__/TradeScreen.test.tsx`
- Create: `packages/client/src/__tests__/BaseScreen.test.tsx`

**Step 1: TradeScreen tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TradeScreen } from '../components/TradeScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestTradeOrders: vi.fn(),
    requestMyOrders: vi.fn(),
    sendNpcTrade: vi.fn(),
    sendCancelOrder: vi.fn(),
  },
}));

describe('TradeScreen', () => {
  beforeEach(() => {
    mockStoreState({ baseStructures: [] });
  });

  it('shows no trading post message when none built', () => {
    render(<TradeScreen />);
    expect(screen.getByText('NO TRADING POST')).toBeTruthy();
  });

  it('shows NPC trade UI when trading post exists', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows market tab at tier 2', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 2, sector_x: 0, sector_y: 0 }],
      credits: 500,
      storage: { ore: 0, gas: 0, crystal: 0 },
      tradeOrders: [],
      myOrders: [],
    });
    render(<TradeScreen />);
    expect(screen.getByText('MARKT')).toBeTruthy();
  });
});
```

**Step 2: BaseScreen storage tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseScreen } from '../components/BaseScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestBase: vi.fn(),
    requestStorage: vi.fn(),
    requestCredits: vi.fn(),
    sendTransfer: vi.fn(),
    sendUpgradeStructure: vi.fn(),
  },
}));

describe('BaseScreen', () => {
  beforeEach(() => {
    mockStoreState({ baseStructures: [] });
  });

  it('shows no base message', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/NO BASE CONSTRUCTED/)).toBeTruthy();
  });

  it('shows credits', () => {
    mockStoreState({
      baseStructures: [{ id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 250,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/CREDITS: 250/)).toBeTruthy();
  });

  it('shows storage when built', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 's1', type: 'storage', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      storage: { ore: 10, gas: 5, crystal: 2 },
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/LAGER/)).toBeTruthy();
    expect(screen.getByText(/ERZ: 10/)).toBeTruthy();
  });
});
```

**Step 3: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/client/src/__tests__/TradeScreen.test.tsx packages/client/src/__tests__/BaseScreen.test.tsx
git commit -m "test(client): add TradeScreen and BaseScreen storage tests"
```

---

## Block E: Integration & Polish

### Task 13: Update RELAY_RANGES for new structure types

**Files:**
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add storage and trading_post to RELAY_RANGES**

```typescript
export const RELAY_RANGES: Record<StructureType, number> = {
  comm_relay: 500,
  mining_station: 500,
  base: 1000,
  storage: 0,
  trading_post: 0,
};
```

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests PASS across all packages

**Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "fix(shared): add storage and trading_post to RELAY_RANGES"
```

---

### Task 14: Update CLAUDE.md test counts + ROADMAP

**Files:**
- Modify: `CLAUDE.md`
- Modify: `planung/ROADMAP.md`

**Step 1: Update test counts**

Update the test count line in `CLAUDE.md` to reflect the new totals.

**Step 2: Mark roadmap items**

In `planung/ROADMAP.md`, mark Storage, Dock (via storage/trading), and Marktplatz items as done:

```markdown
## Phase 2: Interaktion & Loop
- [x] Ressourcen-Generierung in Sektoren.
- [x] Scanning-System (Aufdecken von Ressourcen/Gefahren).
- [x] Mining-Mechanik (Dauer abhängig von Tool-Level).
- [x] Home-Base Bau: Erste Gebäude (Lager, Dock).

## Phase 3: Handel & Multiplayer
- [x] Marktplatz-System: Items zum Verkauf einstellen.
```

**Step 3: Commit**

```bash
git add CLAUDE.md planung/ROADMAP.md
git commit -m "docs: update test counts and roadmap progress"
```

---

## Summary

| Block | Tasks | Focus |
|-------|-------|-------|
| A | 1-3 | Bugfix + types + DB migration |
| B | 4-6 | Server queries + validation + handlers |
| C | 7-8 | Client store + network wiring |
| D | 9-11 | UI components (BaseScreen, TradeScreen, monitor wiring) |
| E | 12-14 | Tests + docs + polish |

**Total: 14 tasks, ~60 min estimated implementation time**

**Dependencies:**
- Task 2 before Tasks 4-5 (types needed)
- Task 3 before Task 6 (DB tables needed)
- Task 7 before Task 8 (store before network)
- Tasks 9-10 after Task 8 (network before UI)
- Task 11 after Task 10 (component before wiring)
- Task 12 after Tasks 9-10 (components before tests)
