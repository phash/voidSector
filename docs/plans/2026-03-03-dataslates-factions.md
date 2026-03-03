# Data Slates + Fraktionen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Phase 3 features: Data Slates (tradeable sector maps) and Factions (player groups with ranks and chat).

**Architecture:** Data Slates piggyback on the existing cargo/trade infrastructure (resource='slate' in cargo table + data_slates table for sector data). Factions introduce 3 new DB tables (factions, faction_members, faction_invites) with a new FACTION monitor. Faction chat activates the existing 'faction' ChatChannel stub in SectorRoom.handleChat.

**Tech Stack:** TypeScript, PostgreSQL, Colyseus, React, Zustand, Vitest

---

### Task 1: Shared Types + Constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add Data Slate types to types.ts**

After the `TradeOrder` interface (~line 155), add:

```typescript
// --- Data Slates ---
export type SlateType = 'sector' | 'area';

export interface SectorSlateData {
  x: number;
  y: number;
  type: string;
  ore: number;
  gas: number;
  crystal: number;
}

export interface DataSlate {
  id: string;
  creatorId: string;
  creatorName?: string;
  ownerId: string;
  slateType: SlateType;
  sectorData: SectorSlateData[];
  status: 'available' | 'listed';
  createdAt: number;
}

export interface CreateSlateMessage {
  slateType: SlateType;
}

export interface CreateSlateResultMessage {
  success: boolean;
  error?: string;
  slate?: DataSlate;
  cargo?: CargoState;
  ap?: number;
}

export interface ActivateSlateMessage {
  slateId: string;
}

export interface ActivateSlateResultMessage {
  success: boolean;
  error?: string;
  sectorsAdded?: number;
}

export interface NpcBuybackMessage {
  slateId: string;
}

export interface NpcBuybackResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  creditsEarned?: number;
}

export interface ListSlateMessage {
  slateId: string;
  price: number;
}
```

**Step 2: Add Faction types to types.ts**

After the Data Slate types, add:

```typescript
// --- Factions ---
export type FactionRank = 'leader' | 'officer' | 'member';
export type FactionJoinMode = 'open' | 'code' | 'invite';
export type FactionInviteStatus = 'pending' | 'accepted' | 'rejected';

export interface Faction {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
  leaderName?: string;
  joinMode: FactionJoinMode;
  inviteCode?: string;
  memberCount?: number;
  createdAt: number;
}

export interface FactionMember {
  playerId: string;
  playerName: string;
  rank: FactionRank;
  joinedAt: number;
  online?: boolean;
}

export interface FactionInvite {
  id: string;
  factionId: string;
  factionName: string;
  factionTag: string;
  inviterName: string;
  status: FactionInviteStatus;
  createdAt: number;
}

export interface CreateFactionMessage {
  name: string;
  tag: string;
  joinMode: FactionJoinMode;
}

export interface CreateFactionResultMessage {
  success: boolean;
  error?: string;
  faction?: Faction;
}

export interface FactionActionMessage {
  action: 'join' | 'joinCode' | 'leave' | 'invite' | 'kick' | 'promote' | 'demote' | 'setJoinMode' | 'disband';
  targetPlayerId?: string;
  targetPlayerName?: string;
  code?: string;
  joinMode?: FactionJoinMode;
}

export interface FactionActionResultMessage {
  success: boolean;
  action: string;
  error?: string;
}

export interface FactionDataMessage {
  faction: Faction | null;
  members: FactionMember[];
  invites: FactionInvite[];
}
```

**Step 3: Update CargoState in types.ts**

Change the CargoState interface from:
```typescript
export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
}
```
to:
```typescript
export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
  slates: number;
}
```

**Step 4: Add FACTION monitor and Data Slate constants to constants.ts**

Add `FACTION` to MONITORS:
```typescript
MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
  COMMS: 'COMMS',
  BASE_LINK: 'BASE-LINK',
  LOG: 'LOG',
  TRADE: 'TRADE',
  FACTION: 'FACTION',
} as const
```

Add `FACTION` to all three monitor arrays (after TRADE):
- `RIGHT_SIDEBAR_MONITORS`: add `MONITORS.FACTION`
- `LEFT_SIDEBAR_MONITORS`: add `MONITORS.FACTION`
- `MAIN_MONITORS`: add `MONITORS.FACTION`

Add Data Slate constants after NPC_SELL_SPREAD:
```typescript
export const SLATE_AP_COST_SECTOR = 1;
export const SLATE_AP_COST_AREA = 3; // base cost, scales with scanner level
export const SLATE_NPC_PRICE_PER_SECTOR = 5; // credits per sector in slate
export const SLATE_AREA_RADIUS: Record<number, number> = {
  1: 2,  // 5x5 area, 3 AP
  2: 3,  // 7x7 area, 4 AP
  3: 4,  // 9x9 area, 5 AP
};
```

**Step 5: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: PASS (5 tests, no regressions)

**Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add Data Slate + Faction types and constants"
```

---

### Task 2: Migration 007

**Files:**
- Create: `packages/server/src/db/migrations/007_slates_factions.sql`

**Step 1: Write the migration**

```sql
-- Data Slates
CREATE TABLE IF NOT EXISTS data_slates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES players(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  slate_type VARCHAR(16) NOT NULL CHECK (slate_type IN ('sector', 'area')),
  sector_data JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'listed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_slates_owner ON data_slates(owner_id);
CREATE INDEX IF NOT EXISTS idx_data_slates_creator ON data_slates(creator_id);

-- Slate reference on trade orders (for marketplace slate trading)
ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS slate_id UUID REFERENCES data_slates(id);

-- Factions
CREATE TABLE IF NOT EXISTS factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL UNIQUE,
  tag VARCHAR(5) NOT NULL UNIQUE,
  leader_id UUID REFERENCES players(id) ON DELETE CASCADE,
  join_mode VARCHAR(8) NOT NULL DEFAULT 'invite' CHECK (join_mode IN ('open', 'code', 'invite')),
  invite_code VARCHAR(16),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faction_members (
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  rank VARCHAR(8) NOT NULL DEFAULT 'member' CHECK (rank IN ('leader', 'officer', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (faction_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_faction_members_player ON faction_members(player_id);

CREATE TABLE IF NOT EXISTS faction_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES players(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status VARCHAR(8) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faction_invites_invitee ON faction_invites(invitee_id, status);
```

**Step 2: Commit**

```bash
git add packages/server/src/db/migrations/007_slates_factions.sql
git commit -m "feat(server): add migration 007 for data slates and factions"
```

---

### Task 3: Data Slate DB Queries

**Files:**
- Modify: `packages/server/src/db/queries.ts`

**Step 1: Update getPlayerCargo to include slates**

In `getPlayerCargo` function, change:
```typescript
const cargo: CargoState = { ore: 0, gas: 0, crystal: 0 };
```
to:
```typescript
const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0 };
```

And add after the for-loop that maps resource types:
```typescript
// Handle slates separately (not a ResourceType but stored in cargo table)
const slateRow = result.rows.find(r => r.resource === 'slate');
if (slateRow) cargo.slates = slateRow.quantity;
```

**Step 2: Add Data Slate query functions**

Add at the end of queries.ts (before the closing of the file):

```typescript
// --- Data Slates ---

export async function createDataSlate(
  creatorId: string,
  slateType: string,
  sectorData: any[],
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO data_slates (creator_id, owner_id, slate_type, sector_data)
     VALUES ($1, $1, $2, $3::jsonb)
     RETURNING id`,
    [creatorId, slateType, JSON.stringify(sectorData)]
  );
  return result.rows[0];
}

export async function getPlayerSlates(playerId: string): Promise<any[]> {
  const result = await query(
    `SELECT ds.id, ds.creator_id, ds.slate_type, ds.sector_data, ds.status, ds.created_at,
            p.username as creator_name
     FROM data_slates ds
     JOIN players p ON p.id = ds.creator_id
     WHERE ds.owner_id = $1 AND ds.status = 'available'
     ORDER BY ds.created_at DESC`,
    [playerId]
  );
  return result.rows;
}

export async function getSlateById(slateId: string): Promise<any | null> {
  const result = await query(
    `SELECT ds.*, p.username as creator_name
     FROM data_slates ds
     JOIN players p ON p.id = ds.creator_id
     WHERE ds.id = $1`,
    [slateId]
  );
  return result.rows[0] || null;
}

export async function deleteSlate(slateId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM data_slates WHERE id = $1',
    [slateId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateSlateStatus(slateId: string, status: string): Promise<boolean> {
  const result = await query(
    'UPDATE data_slates SET status = $2 WHERE id = $1',
    [slateId, status]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateSlateOwner(slateId: string, newOwnerId: string): Promise<boolean> {
  const result = await query(
    "UPDATE data_slates SET owner_id = $2, status = 'available' WHERE id = $1",
    [slateId, newOwnerId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addSlateToCargo(playerId: string, amount: number = 1): Promise<void> {
  await query(
    `INSERT INTO cargo (player_id, resource, quantity)
     VALUES ($1, 'slate', $2)
     ON CONFLICT (player_id, resource)
     DO UPDATE SET quantity = cargo.quantity + $2`,
    [playerId, amount]
  );
}

export async function removeSlateFromCargo(playerId: string, amount: number = 1): Promise<boolean> {
  const result = await query<{ quantity: number }>(
    `UPDATE cargo SET quantity = quantity - $2
     WHERE player_id = $1 AND resource = 'slate' AND quantity >= $2
     RETURNING quantity`,
    [playerId, amount]
  );
  return result.rows.length > 0;
}
```

**Step 3: Add slate trade order support**

Add a function for creating slate trade orders:

```typescript
export async function createSlateTradeOrder(
  playerId: string,
  slateId: string,
  price: number,
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO trade_orders (player_id, resource, amount, price_per_unit, type, slate_id)
     VALUES ($1, 'slate', 1, $2, 'sell', $3)
     RETURNING id`,
    [playerId, price, slateId]
  );
  return result.rows[0];
}

export async function getSlateTradeOrders(): Promise<any[]> {
  const result = await query(
    `SELECT t.id, t.player_id, p.username as player_name, t.price_per_unit,
            t.slate_id, t.created_at,
            ds.slate_type, ds.sector_data, ds.creator_id
     FROM trade_orders t
     JOIN players p ON p.id = t.player_id
     JOIN data_slates ds ON ds.id = t.slate_id
     WHERE t.fulfilled = FALSE AND t.resource = 'slate'
     ORDER BY t.created_at DESC`,
    []
  );
  return result.rows;
}
```

**Step 4: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(server): add Data Slate DB queries and cargo slate support"
```

---

### Task 4: Data Slate Validation + Tests

**Files:**
- Modify: `packages/server/src/engine/commands.ts`
- Create: `packages/server/src/engine/__tests__/commands-slates.test.ts`

**Step 1: Write the failing tests**

Create `packages/server/src/engine/__tests__/commands-slates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateCreateSlate, validateActivateSlate, validateNpcBuyback } from '../commands.js';
import { SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_AREA_RADIUS } from '@void-sector/shared';

describe('validateCreateSlate', () => {
  const baseState = {
    ap: 5,
    scannerLevel: 1,
    cargoTotal: 5,
    cargoCap: 20,
  };

  it('rejects if not enough AP for sector slate', () => {
    const result = validateCreateSlate({ ...baseState, ap: 0 }, 'sector');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });

  it('rejects if cargo is full', () => {
    const result = validateCreateSlate({ ...baseState, cargoTotal: 20, cargoCap: 20 }, 'sector');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cargo');
  });

  it('accepts valid sector slate', () => {
    const result = validateCreateSlate(baseState, 'sector');
    expect(result.valid).toBe(true);
    expect(result.apCost).toBe(SLATE_AP_COST_SECTOR);
  });

  it('calculates area slate AP cost from scanner level', () => {
    const result = validateCreateSlate({ ...baseState, scannerLevel: 2 }, 'area');
    expect(result.valid).toBe(true);
    expect(result.apCost).toBe(SLATE_AP_COST_AREA + 1); // base 3 + scanner level offset
    expect(result.radius).toBe(SLATE_AREA_RADIUS[2]);
  });

  it('rejects area slate if not enough AP', () => {
    const result = validateCreateSlate({ ...baseState, ap: 2, scannerLevel: 3 }, 'area');
    expect(result.valid).toBe(false);
  });
});

describe('validateNpcBuyback', () => {
  it('rejects if player has no trading post', () => {
    const result = validateNpcBuyback(false, 3);
    expect(result.valid).toBe(false);
  });

  it('calculates correct payout', () => {
    const result = validateNpcBuyback(true, 5);
    expect(result.valid).toBe(true);
    expect(result.payout).toBe(25); // 5 sectors * 5 CR
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands-slates.test.ts`
Expected: FAIL (functions not found)

**Step 3: Implement validation functions in commands.ts**

Add imports at top of `packages/server/src/engine/commands.ts`:
```typescript
import {
  SLATE_AP_COST_SECTOR,
  SLATE_AP_COST_AREA,
  SLATE_AREA_RADIUS,
  SLATE_NPC_PRICE_PER_SECTOR,
} from '@void-sector/shared';
```

Add functions:

```typescript
// --- Data Slate Validation ---

interface CreateSlateState {
  ap: number;
  scannerLevel: number;
  cargoTotal: number;
  cargoCap: number;
}

interface CreateSlateResult {
  valid: boolean;
  error?: string;
  apCost?: number;
  radius?: number;
}

export function validateCreateSlate(state: CreateSlateState, slateType: string): CreateSlateResult {
  const apCost = slateType === 'sector'
    ? SLATE_AP_COST_SECTOR
    : SLATE_AP_COST_AREA + (state.scannerLevel - 1);

  if (state.ap < apCost) {
    return { valid: false, error: `Not enough AP (need ${apCost}, have ${state.ap})` };
  }

  if (state.cargoTotal >= state.cargoCap) {
    return { valid: false, error: 'Cargo full — no space for slate' };
  }

  const radius = slateType === 'area'
    ? (SLATE_AREA_RADIUS[state.scannerLevel] ?? SLATE_AREA_RADIUS[1])
    : undefined;

  return { valid: true, apCost, radius };
}

interface NpcBuybackResult {
  valid: boolean;
  error?: string;
  payout?: number;
}

export function validateNpcBuyback(hasTradingPost: boolean, sectorCount: number): NpcBuybackResult {
  if (!hasTradingPost) {
    return { valid: false, error: 'No trading post — cannot sell to NPC' };
  }
  return { valid: true, payout: sectorCount * SLATE_NPC_PRICE_PER_SECTOR };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands-slates.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/commands-slates.test.ts
git commit -m "feat(server): add Data Slate validation with 7 tests"
```

---

### Task 5: Data Slate Server Handlers

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add imports**

Add new imports to SectorRoom.ts:
```typescript
import type {
  CreateSlateMessage,
  ActivateSlateMessage,
  NpcBuybackMessage,
  ListSlateMessage,
} from '@void-sector/shared';
import {
  SLATE_NPC_PRICE_PER_SECTOR,
} from '@void-sector/shared';
import {
  createDataSlate,
  getPlayerSlates,
  getSlateById,
  deleteSlate,
  updateSlateStatus,
  updateSlateOwner,
  addSlateToCargo,
  removeSlateFromCargo,
  createSlateTradeOrder,
} from '../db/queries.js';
import { validateCreateSlate, validateNpcBuyback } from '../engine/commands.js';
```

(Merge with existing imports from these modules.)

**Step 2: Register message handlers in onCreate**

Add after the existing `getStorage` handler:

```typescript
    this.onMessage('createSlate', async (client, data: CreateSlateMessage) => {
      await this.handleCreateSlate(client, data);
    });

    this.onMessage('getMySlates', async (client) => {
      const auth = client.auth as AuthPayload;
      const slates = await getPlayerSlates(auth.userId);
      client.send('mySlates', { slates: slates.map(this.mapSlateRow) });
    });

    this.onMessage('activateSlate', async (client, data: ActivateSlateMessage) => {
      await this.handleActivateSlate(client, data);
    });

    this.onMessage('npcBuybackSlate', async (client, data: NpcBuybackMessage) => {
      await this.handleNpcBuyback(client, data);
    });

    this.onMessage('listSlate', async (client, data: ListSlateMessage) => {
      await this.handleListSlate(client, data);
    });

    this.onMessage('acceptSlateOrder', async (client, data: { orderId: string }) => {
      await this.handleAcceptSlateOrder(client, data);
    });
```

**Step 3: Implement private handler methods**

Add to the private methods section of SectorRoom:

```typescript
  private mapSlateRow(row: any) {
    return {
      id: row.id,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      ownerId: row.owner_id,
      slateType: row.slate_type,
      sectorData: row.sector_data,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  private async handleCreateSlate(client: Client, data: CreateSlateMessage) {
    const auth = client.auth as AuthPayload;
    if (!['sector', 'area'].includes(data.slateType)) {
      client.send('createSlateResult', { success: false, error: 'Invalid slate type' });
      return;
    }

    const ship = await getPlayerShip(auth.userId);
    const ap = calculateAP(auth.userId);
    const cargo = await getPlayerCargo(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;
    const cargoCap = ship ? SHIP_CLASSES[ship.ship_class].cargoCap : SHIP_CLASSES.aegis_scout_mk1.cargoCap;
    const scannerLevel = ship ? ship.scanner_level : 1;

    const validation = validateCreateSlate(
      { ap, scannerLevel, cargoTotal, cargoCap },
      data.slateType
    );
    if (!validation.valid) {
      client.send('createSlateResult', { success: false, error: validation.error });
      return;
    }

    // Gather sector data
    let sectorData: any[];
    const playerPos = await getPlayerPosition(auth.userId);

    if (data.slateType === 'sector') {
      // Current sector only
      const sector = await getSectorData(playerPos.x, playerPos.y);
      sectorData = [{
        x: playerPos.x, y: playerPos.y,
        type: sector?.type ?? 'empty',
        ore: sector?.ore ?? 0, gas: sector?.gas ?? 0, crystal: sector?.crystal ?? 0,
      }];
    } else {
      // Area: get all discovered sectors in radius
      const radius = validation.radius!;
      const discoveries = await getPlayerDiscoveries(auth.userId);
      sectorData = [];
      for (const disc of discoveries) {
        if (Math.abs(disc.x - playerPos.x) <= radius && Math.abs(disc.y - playerPos.y) <= radius) {
          const sector = await getSectorData(disc.x, disc.y);
          if (sector) {
            sectorData.push({
              x: disc.x, y: disc.y,
              type: sector.type ?? 'empty',
              ore: sector.ore ?? 0, gas: sector.gas ?? 0, crystal: sector.crystal ?? 0,
            });
          }
        }
      }
    }

    if (sectorData.length === 0) {
      client.send('createSlateResult', { success: false, error: 'No sector data to record' });
      return;
    }

    // Deduct AP
    deductAP(auth.userId, validation.apCost!);

    // Create slate + add to cargo
    const slate = await createDataSlate(auth.userId, data.slateType, sectorData);
    await addSlateToCargo(auth.userId);
    const updatedCargo = await getPlayerCargo(auth.userId);
    const newAp = calculateAP(auth.userId);

    client.send('createSlateResult', {
      success: true,
      slate: { id: slate.id, slateType: data.slateType, sectorData, status: 'available' },
      cargo: updatedCargo,
      ap: newAp,
    });
  }

  private async handleActivateSlate(client: Client, data: ActivateSlateMessage) {
    const auth = client.auth as AuthPayload;
    const slate = await getSlateById(data.slateId);

    if (!slate || slate.owner_id !== auth.userId) {
      client.send('activateSlateResult', { success: false, error: 'Slate not found' });
      return;
    }
    if (slate.status !== 'available') {
      client.send('activateSlateResult', { success: false, error: 'Slate is listed on market' });
      return;
    }

    // Add sectors to discoveries
    const sectors = slate.sector_data as any[];
    for (const s of sectors) {
      await addDiscovery(auth.userId, s.x, s.y);
    }

    // Remove from cargo + delete slate
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    client.send('activateSlateResult', { success: true, sectorsAdded: sectors.length });
    // Refresh cargo
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  private async handleNpcBuyback(client: Client, data: NpcBuybackMessage) {
    const auth = client.auth as AuthPayload;
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    const slate = await getSlateById(data.slateId);

    if (!slate || slate.owner_id !== auth.userId || slate.status !== 'available') {
      client.send('npcBuybackResult', { success: false, error: 'Slate not found or unavailable' });
      return;
    }

    const sectorCount = (slate.sector_data as any[]).length;
    const validation = validateNpcBuyback(!!tradingPost, sectorCount);
    if (!validation.valid) {
      client.send('npcBuybackResult', { success: false, error: validation.error });
      return;
    }

    // Pay credits, remove slate
    await addCredits(auth.userId, validation.payout!);
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    const credits = await getPlayerCredits(auth.userId);
    client.send('npcBuybackResult', {
      success: true,
      credits,
      creditsEarned: validation.payout,
    });
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  private async handleListSlate(client: Client, data: ListSlateMessage) {
    const auth = client.auth as AuthPayload;
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost || tradingPost.tier < 2) {
      client.send('error', { code: 'NO_MARKET', message: 'Need Trading Post Tier 2' });
      return;
    }

    const slate = await getSlateById(data.slateId);
    if (!slate || slate.owner_id !== auth.userId || slate.status !== 'available') {
      client.send('error', { code: 'INVALID_SLATE', message: 'Slate not found or already listed' });
      return;
    }

    await updateSlateStatus(data.slateId, 'listed');
    await removeSlateFromCargo(auth.userId);
    await createSlateTradeOrder(auth.userId, data.slateId, data.price);

    client.send('orderPlaced', { success: true });
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  private async handleAcceptSlateOrder(client: Client, data: { orderId: string }) {
    const auth = client.auth as AuthPayload;
    const order = await getTradeOrderById(data.orderId);
    if (!order || order.fulfilled || order.resource !== 'slate') {
      client.send('error', { code: 'INVALID_ORDER', message: 'Order not found' });
      return;
    }

    const buyerCredits = await getPlayerCredits(auth.userId);
    if (buyerCredits < order.price_per_unit) {
      client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
      return;
    }

    // Check buyer cargo space
    const cargo = await getPlayerCargo(auth.userId);
    const ship = await getPlayerShip(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;
    const cargoCap = ship ? SHIP_CLASSES[ship.ship_class].cargoCap : SHIP_CLASSES.aegis_scout_mk1.cargoCap;
    if (cargoTotal >= cargoCap) {
      client.send('error', { code: 'CARGO_FULL', message: 'No cargo space' });
      return;
    }

    // Transfer: deduct buyer credits, add seller credits, move slate, fulfill order
    await deductCredits(auth.userId, order.price_per_unit);
    await addCredits(order.player_id, order.price_per_unit);
    await updateSlateOwner(order.slate_id, auth.userId);
    await addSlateToCargo(auth.userId);
    await fulfillTradeOrder(data.orderId);

    client.send('slateOrderAccepted', { success: true });
    const updatedCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: updatedCredits });
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
  }
```

**Notes:** The handler uses several existing query functions (`getPlayerShip`, `calculateAP`, `getPlayerCargo`, `getPlayerPosition`, `getSectorData`, `getPlayerDiscoveries`, `addDiscovery`, `deductAP`, `addCredits`, `getPlayerCredits`, `getPlayerStructure`, `fulfillTradeOrder`). Check that all are imported. Also add `getTradeOrderById` to queries.ts if it doesn't exist:

```typescript
export async function getTradeOrderById(orderId: string): Promise<any | null> {
  const result = await query(
    'SELECT * FROM trade_orders WHERE id = $1',
    [orderId]
  );
  return result.rows[0] || null;
}
```

**Step 4: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS (all existing tests still pass)

**Step 5: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts packages/server/src/db/queries.ts
git commit -m "feat(server): add Data Slate handlers (create, activate, NPC buyback, marketplace)"
```

---

### Task 6: Faction DB Queries

**Files:**
- Modify: `packages/server/src/db/queries.ts`

**Step 1: Add Faction query functions**

Add at the end of queries.ts:

```typescript
// --- Factions ---

export async function createFaction(
  leaderId: string,
  name: string,
  tag: string,
  joinMode: string,
): Promise<{ id: string; invite_code: string | null }> {
  const inviteCode = joinMode === 'code'
    ? Math.random().toString(36).substring(2, 10).toUpperCase()
    : null;

  const result = await query<{ id: string; invite_code: string | null }>(
    `INSERT INTO factions (name, tag, leader_id, join_mode, invite_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, invite_code`,
    [name, tag, leaderId, joinMode, inviteCode]
  );
  const faction = result.rows[0];

  // Add leader as member
  await query(
    `INSERT INTO faction_members (faction_id, player_id, rank)
     VALUES ($1, $2, 'leader')`,
    [faction.id, leaderId]
  );

  return faction;
}

export async function getFactionById(factionId: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name,
            (SELECT COUNT(*) FROM faction_members WHERE faction_id = f.id) as member_count
     FROM factions f
     JOIN players p ON p.id = f.leader_id
     WHERE f.id = $1`,
    [factionId]
  );
  return result.rows[0] || null;
}

export async function getPlayerFaction(playerId: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name, fm.rank as player_rank,
            (SELECT COUNT(*) FROM faction_members WHERE faction_id = f.id) as member_count
     FROM faction_members fm
     JOIN factions f ON f.id = fm.faction_id
     JOIN players p ON p.id = f.leader_id
     WHERE fm.player_id = $1`,
    [playerId]
  );
  return result.rows[0] || null;
}

export async function getFactionMembers(factionId: string): Promise<any[]> {
  const result = await query(
    `SELECT fm.player_id, p.username as player_name, fm.rank, fm.joined_at
     FROM faction_members fm
     JOIN players p ON p.id = fm.player_id
     WHERE fm.faction_id = $1
     ORDER BY
       CASE fm.rank WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
       fm.joined_at`,
    [factionId]
  );
  return result.rows;
}

export async function addFactionMember(
  factionId: string,
  playerId: string,
  rank: string = 'member',
): Promise<void> {
  await query(
    `INSERT INTO faction_members (faction_id, player_id, rank)
     VALUES ($1, $2, $3)
     ON CONFLICT (faction_id, player_id) DO NOTHING`,
    [factionId, playerId, rank]
  );
}

export async function removeFactionMember(factionId: string, playerId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM faction_members WHERE faction_id = $1 AND player_id = $2',
    [factionId, playerId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateMemberRank(
  factionId: string,
  playerId: string,
  newRank: string,
): Promise<boolean> {
  const result = await query(
    'UPDATE faction_members SET rank = $3 WHERE faction_id = $1 AND player_id = $2',
    [factionId, playerId, newRank]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateFactionJoinMode(
  factionId: string,
  joinMode: string,
): Promise<{ invite_code: string | null }> {
  const inviteCode = joinMode === 'code'
    ? Math.random().toString(36).substring(2, 10).toUpperCase()
    : null;
  await query(
    'UPDATE factions SET join_mode = $2, invite_code = $3 WHERE id = $1',
    [factionId, joinMode, inviteCode]
  );
  return { invite_code: inviteCode };
}

export async function getFactionByCode(code: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name
     FROM factions f
     JOIN players p ON p.id = f.leader_id
     WHERE f.invite_code = $1`,
    [code]
  );
  return result.rows[0] || null;
}

export async function disbandFaction(factionId: string): Promise<void> {
  // CASCADE deletes members and invites
  await query('DELETE FROM factions WHERE id = $1', [factionId]);
}

export async function createFactionInvite(
  factionId: string,
  inviterId: string,
  inviteeId: string,
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO faction_invites (faction_id, inviter_id, invitee_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [factionId, inviterId, inviteeId]
  );
  return result.rows[0];
}

export async function getPlayerFactionInvites(playerId: string): Promise<any[]> {
  const result = await query(
    `SELECT fi.id, fi.faction_id, f.name as faction_name, f.tag as faction_tag,
            p.username as inviter_name, fi.status, fi.created_at
     FROM faction_invites fi
     JOIN factions f ON f.id = fi.faction_id
     JOIN players p ON p.id = fi.inviter_id
     WHERE fi.invitee_id = $1 AND fi.status = 'pending'
     ORDER BY fi.created_at DESC`,
    [playerId]
  );
  return result.rows;
}

export async function respondToInvite(
  inviteId: string,
  playerId: string,
  accept: boolean,
): Promise<any | null> {
  const status = accept ? 'accepted' : 'rejected';
  const result = await query(
    `UPDATE faction_invites SET status = $3
     WHERE id = $1 AND invitee_id = $2 AND status = 'pending'
     RETURNING faction_id`,
    [inviteId, playerId, status]
  );
  return result.rows[0] || null;
}

export async function getPlayerIdByUsername(username: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM players WHERE username = $1',
    [username]
  );
  return result.rows[0]?.id || null;
}

export async function getFactionMembersByPlayerIds(factionId: string): Promise<string[]> {
  const result = await query<{ player_id: string }>(
    'SELECT player_id FROM faction_members WHERE faction_id = $1',
    [factionId]
  );
  return result.rows.map(r => r.player_id);
}
```

**Step 2: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(server): add Faction DB queries (CRUD, invites, membership)"
```

---

### Task 7: Faction Server Handlers + Tests

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Create: `packages/server/src/engine/__tests__/factions.test.ts`

**Step 1: Write faction permission tests**

Create `packages/server/src/engine/__tests__/factions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateFactionAction } from '../commands.js';

describe('validateFactionAction', () => {
  it('leader can kick members', () => {
    const result = validateFactionAction('kick', 'leader', 'member');
    expect(result.valid).toBe(true);
  });

  it('leader can kick officers', () => {
    const result = validateFactionAction('kick', 'leader', 'officer');
    expect(result.valid).toBe(true);
  });

  it('officer can kick members', () => {
    const result = validateFactionAction('kick', 'officer', 'member');
    expect(result.valid).toBe(true);
  });

  it('officer cannot kick officers', () => {
    const result = validateFactionAction('kick', 'officer', 'officer');
    expect(result.valid).toBe(false);
  });

  it('member cannot kick anyone', () => {
    const result = validateFactionAction('kick', 'member', 'member');
    expect(result.valid).toBe(false);
  });

  it('only leader can promote', () => {
    expect(validateFactionAction('promote', 'leader', 'member').valid).toBe(true);
    expect(validateFactionAction('promote', 'officer', 'member').valid).toBe(false);
  });

  it('only leader can demote', () => {
    expect(validateFactionAction('demote', 'leader', 'officer').valid).toBe(true);
    expect(validateFactionAction('demote', 'officer', 'member').valid).toBe(false);
  });

  it('only leader can disband', () => {
    expect(validateFactionAction('disband', 'leader', undefined).valid).toBe(true);
    expect(validateFactionAction('disband', 'officer', undefined).valid).toBe(false);
  });

  it('only leader can setJoinMode', () => {
    expect(validateFactionAction('setJoinMode', 'leader', undefined).valid).toBe(true);
    expect(validateFactionAction('setJoinMode', 'officer', undefined).valid).toBe(false);
  });
});
```

**Step 2: Implement validateFactionAction in commands.ts**

Add to `packages/server/src/engine/commands.ts`:

```typescript
// --- Faction Validation ---

interface FactionActionResult {
  valid: boolean;
  error?: string;
}

export function validateFactionAction(
  action: string,
  actorRank: string,
  targetRank?: string,
): FactionActionResult {
  // Leader-only actions
  if (['promote', 'demote', 'disband', 'setJoinMode'].includes(action)) {
    if (actorRank !== 'leader') {
      return { valid: false, error: 'Only the faction leader can do this' };
    }
    return { valid: true };
  }

  // Kick: leader can kick anyone, officer can kick members only
  if (action === 'kick') {
    if (actorRank === 'leader') return { valid: true };
    if (actorRank === 'officer' && targetRank === 'member') return { valid: true };
    return { valid: false, error: 'Insufficient rank to kick this member' };
  }

  // Invite: leader or officer
  if (action === 'invite') {
    if (actorRank === 'leader' || actorRank === 'officer') return { valid: true };
    return { valid: false, error: 'Only leaders and officers can invite' };
  }

  return { valid: true };
}
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/factions.test.ts`
Expected: PASS (10 tests)

**Step 4: Register faction handlers in SectorRoom.onCreate**

Add after the slate handlers:

```typescript
    this.onMessage('createFaction', async (client, data: CreateFactionMessage) => {
      await this.handleCreateFaction(client, data);
    });

    this.onMessage('getFaction', async (client) => {
      await this.sendFactionData(client);
    });

    this.onMessage('factionAction', async (client, data: FactionActionMessage) => {
      await this.handleFactionAction(client, data);
    });

    this.onMessage('respondInvite', async (client, data: { inviteId: string; accept: boolean }) => {
      await this.handleRespondInvite(client, data);
    });
```

**Step 5: Implement faction handler methods**

Add to the private methods section:

```typescript
  private async sendFactionData(client: Client) {
    const auth = client.auth as AuthPayload;
    const factionRow = await getPlayerFaction(auth.userId);

    if (!factionRow) {
      const invites = await getPlayerFactionInvites(auth.userId);
      client.send('factionData', { faction: null, members: [], invites });
      return;
    }

    const members = await getFactionMembers(factionRow.id);
    const invites = await getPlayerFactionInvites(auth.userId);

    client.send('factionData', {
      faction: {
        id: factionRow.id,
        name: factionRow.name,
        tag: factionRow.tag,
        leaderId: factionRow.leader_id,
        leaderName: factionRow.leader_name,
        joinMode: factionRow.join_mode,
        inviteCode: factionRow.invite_code,
        memberCount: Number(factionRow.member_count),
        createdAt: new Date(factionRow.created_at).getTime(),
      },
      members: members.map(m => ({
        playerId: m.player_id,
        playerName: m.player_name,
        rank: m.rank,
        joinedAt: new Date(m.joined_at).getTime(),
      })),
      invites,
    });
  }

  private async handleCreateFaction(client: Client, data: CreateFactionMessage) {
    const auth = client.auth as AuthPayload;

    // Validate
    if (!data.name || data.name.trim().length < 3 || data.name.trim().length > 64) {
      client.send('createFactionResult', { success: false, error: 'Name must be 3-64 characters' });
      return;
    }
    if (!data.tag || data.tag.trim().length < 3 || data.tag.trim().length > 5) {
      client.send('createFactionResult', { success: false, error: 'Tag must be 3-5 characters' });
      return;
    }
    if (!['open', 'code', 'invite'].includes(data.joinMode)) {
      client.send('createFactionResult', { success: false, error: 'Invalid join mode' });
      return;
    }

    // Check player not already in faction
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      client.send('createFactionResult', { success: false, error: 'Already in a faction' });
      return;
    }

    try {
      const faction = await createFaction(auth.userId, data.name.trim(), data.tag.trim().toUpperCase(), data.joinMode);
      await this.sendFactionData(client);
      client.send('createFactionResult', { success: true });
    } catch (err: any) {
      if (err.code === '23505') { // unique violation
        client.send('createFactionResult', { success: false, error: 'Name or tag already taken' });
      } else {
        throw err;
      }
    }
  }

  private async handleFactionAction(client: Client, data: FactionActionMessage) {
    const auth = client.auth as AuthPayload;
    const myFaction = await getPlayerFaction(auth.userId);

    if (data.action === 'join') {
      return this.handleJoinFaction(client, auth, data);
    }
    if (data.action === 'joinCode') {
      return this.handleJoinByCode(client, auth, data);
    }
    if (data.action === 'leave') {
      return this.handleLeaveFaction(client, auth, myFaction);
    }

    if (!myFaction) {
      client.send('factionActionResult', { success: false, action: data.action, error: 'Not in a faction' });
      return;
    }

    const myRank = myFaction.player_rank;

    if (data.action === 'invite') {
      return this.handleFactionInvite(client, auth, myFaction, data);
    }

    if (data.action === 'disband') {
      const v = validateFactionAction('disband', myRank);
      if (!v.valid) {
        client.send('factionActionResult', { success: false, action: 'disband', error: v.error });
        return;
      }
      await disbandFaction(myFaction.id);
      client.send('factionActionResult', { success: true, action: 'disband' });
      await this.sendFactionData(client);
      return;
    }

    if (data.action === 'setJoinMode') {
      const v = validateFactionAction('setJoinMode', myRank);
      if (!v.valid) {
        client.send('factionActionResult', { success: false, action: 'setJoinMode', error: v.error });
        return;
      }
      if (!data.joinMode || !['open', 'code', 'invite'].includes(data.joinMode)) {
        client.send('factionActionResult', { success: false, action: 'setJoinMode', error: 'Invalid mode' });
        return;
      }
      await updateFactionJoinMode(myFaction.id, data.joinMode);
      client.send('factionActionResult', { success: true, action: 'setJoinMode' });
      await this.sendFactionData(client);
      return;
    }

    // Kick, promote, demote — need target
    if (!data.targetPlayerId) {
      client.send('factionActionResult', { success: false, action: data.action, error: 'No target' });
      return;
    }

    const targetMembers = await getFactionMembers(myFaction.id);
    const target = targetMembers.find(m => m.player_id === data.targetPlayerId);
    if (!target) {
      client.send('factionActionResult', { success: false, action: data.action, error: 'Target not in faction' });
      return;
    }

    const v = validateFactionAction(data.action, myRank, target.rank);
    if (!v.valid) {
      client.send('factionActionResult', { success: false, action: data.action, error: v.error });
      return;
    }

    if (data.action === 'kick') {
      await removeFactionMember(myFaction.id, data.targetPlayerId);
    } else if (data.action === 'promote') {
      await updateMemberRank(myFaction.id, data.targetPlayerId, 'officer');
    } else if (data.action === 'demote') {
      await updateMemberRank(myFaction.id, data.targetPlayerId, 'member');
    }

    client.send('factionActionResult', { success: true, action: data.action });
    await this.sendFactionData(client);
  }

  private async handleJoinFaction(client: Client, auth: AuthPayload, data: FactionActionMessage) {
    if (!data.targetPlayerId) { // targetPlayerId = faction ID for join
      client.send('factionActionResult', { success: false, action: 'join', error: 'No faction specified' });
      return;
    }
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      client.send('factionActionResult', { success: false, action: 'join', error: 'Already in a faction' });
      return;
    }
    const faction = await getFactionById(data.targetPlayerId);
    if (!faction || faction.join_mode !== 'open') {
      client.send('factionActionResult', { success: false, action: 'join', error: 'Faction not open' });
      return;
    }
    await addFactionMember(data.targetPlayerId, auth.userId);
    client.send('factionActionResult', { success: true, action: 'join' });
    await this.sendFactionData(client);
  }

  private async handleJoinByCode(client: Client, auth: AuthPayload, data: FactionActionMessage) {
    if (!data.code) {
      client.send('factionActionResult', { success: false, action: 'joinCode', error: 'No code' });
      return;
    }
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      client.send('factionActionResult', { success: false, action: 'joinCode', error: 'Already in a faction' });
      return;
    }
    const faction = await getFactionByCode(data.code.toUpperCase());
    if (!faction || faction.join_mode !== 'code') {
      client.send('factionActionResult', { success: false, action: 'joinCode', error: 'Invalid code' });
      return;
    }
    await addFactionMember(faction.id, auth.userId);
    client.send('factionActionResult', { success: true, action: 'joinCode' });
    await this.sendFactionData(client);
  }

  private async handleLeaveFaction(client: Client, auth: AuthPayload, faction: any) {
    if (!faction) {
      client.send('factionActionResult', { success: false, action: 'leave', error: 'Not in faction' });
      return;
    }
    if (faction.player_rank === 'leader') {
      client.send('factionActionResult', { success: false, action: 'leave', error: 'Leader cannot leave — disband instead' });
      return;
    }
    await removeFactionMember(faction.id, auth.userId);
    client.send('factionActionResult', { success: true, action: 'leave' });
    await this.sendFactionData(client);
  }

  private async handleFactionInvite(client: Client, auth: AuthPayload, faction: any, data: FactionActionMessage) {
    const v = validateFactionAction('invite', faction.player_rank);
    if (!v.valid) {
      client.send('factionActionResult', { success: false, action: 'invite', error: v.error });
      return;
    }
    if (!data.targetPlayerName) {
      client.send('factionActionResult', { success: false, action: 'invite', error: 'No player name' });
      return;
    }
    const targetId = await getPlayerIdByUsername(data.targetPlayerName);
    if (!targetId) {
      client.send('factionActionResult', { success: false, action: 'invite', error: 'Player not found' });
      return;
    }
    const targetFaction = await getPlayerFaction(targetId);
    if (targetFaction) {
      client.send('factionActionResult', { success: false, action: 'invite', error: 'Player already in a faction' });
      return;
    }
    await createFactionInvite(faction.id, auth.userId, targetId);
    client.send('factionActionResult', { success: true, action: 'invite' });
  }

  private async handleRespondInvite(client: Client, data: { inviteId: string; accept: boolean }) {
    const auth = client.auth as AuthPayload;
    const invite = await respondToInvite(data.inviteId, auth.userId, data.accept);
    if (!invite) {
      client.send('factionActionResult', { success: false, action: 'respondInvite', error: 'Invite not found' });
      return;
    }
    if (data.accept) {
      await addFactionMember(invite.faction_id, auth.userId);
    }
    client.send('factionActionResult', { success: true, action: 'respondInvite' });
    await this.sendFactionData(client);
  }
```

**Step 6: Activate faction chat in handleChat**

Replace the faction stub in `handleChat`:
```typescript
    // Faction channel not yet implemented
    if (data.channel === 'faction') {
      client.send('error', { code: 'NOT_IMPLEMENTED', message: 'Faction channel coming soon' });
      return;
    }
```

with:
```typescript
    if (data.channel === 'faction') {
      const faction = await getPlayerFaction(auth.userId);
      if (!faction) {
        client.send('error', { code: 'NO_FACTION', message: 'Not in a faction' });
        return;
      }
      const msg = await saveMessage(auth.userId, null, 'faction', data.content.trim());
      const chatMsg: ChatMessage = {
        id: msg.id,
        senderId: auth.userId,
        senderName: auth.username,
        channel: 'faction',
        content: data.content.trim(),
        sentAt: new Date(msg.sent_at).getTime(),
        delayed: false,
      };
      // Broadcast to faction members in this room
      const memberIds = await getFactionMembersByPlayerIds(faction.id);
      for (const c of this.clients) {
        const cAuth = c.auth as AuthPayload;
        if (memberIds.includes(cAuth.userId)) {
          c.send('chatMessage', chatMsg);
        }
      }
      return;
    }
```

**Step 7: Add all missing imports to SectorRoom**

Make sure all the new query functions and types are imported. Add to existing import blocks:
- Types: `CreateFactionMessage`, `FactionActionMessage`, `CreateSlateMessage`, `ActivateSlateMessage`, `NpcBuybackMessage`, `ListSlateMessage`
- Queries: all new faction/slate query functions
- Commands: `validateFactionAction`

**Step 8: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS (all existing + 10 new faction + 7 slate tests)

**Step 9: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/factions.test.ts
git commit -m "feat(server): add Faction handlers, permissions, chat activation + tests"
```

---

### Task 8: Client Store

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/test/mockStore.ts`

**Step 1: Add Data Slate + Faction state to gameSlice**

Add to the state interface and initial state in gameSlice.ts:

```typescript
// State:
mySlates: DataSlate[];
faction: Faction | null;
factionMembers: FactionMember[];
factionInvites: FactionInvite[];

// Initial values:
mySlates: [],
faction: null,
factionMembers: [],
factionInvites: [],

// Actions:
setMySlates: (slates: DataSlate[]) => set({ mySlates: slates }),
setFaction: (faction: Faction | null) => set({ faction }),
setFactionMembers: (members: FactionMember[]) => set({ factionMembers: members }),
setFactionInvites: (invites: FactionInvite[]) => set({ factionInvites: invites }),
```

Add imports for `DataSlate`, `Faction`, `FactionMember`, `FactionInvite` from `@void-sector/shared`.

**Step 2: Update mockStore**

Add defaults for the new state in `packages/client/src/test/mockStore.ts`:

```typescript
mySlates: [],
faction: null,
factionMembers: [],
factionInvites: [],
setMySlates: vi.fn(),
setFaction: vi.fn(),
setFactionMembers: vi.fn(),
setFactionInvites: vi.fn(),
```

**Step 3: Fix CargoState defaults**

Update any place where initial cargo is `{ ore: 0, gas: 0, crystal: 0 }` to include `slates: 0`.
This includes gameSlice initial state and mockStore defaults.

**Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/test/mockStore.ts
git commit -m "feat(client): add Data Slate + Faction store state"
```

---

### Task 9: Client Network

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add Data Slate message handlers**

In the `setupRoom` method, add listeners:

```typescript
this.room.onMessage('mySlates', (data: { slates: DataSlate[] }) => {
  store.setMySlates(data.slates);
});

this.room.onMessage('createSlateResult', (data: any) => {
  if (data.success) {
    store.addLog('DATA SLATE ERSTELLT');
    if (data.cargo) store.setCargo(data.cargo);
    if (data.ap !== undefined) store.setAp(data.ap);
    this.room?.send('getMySlates');
  } else {
    store.addLog(`SLATE FEHLER: ${data.error}`);
  }
});

this.room.onMessage('activateSlateResult', (data: any) => {
  if (data.success) {
    store.addLog(`SLATE AKTIVIERT — ${data.sectorsAdded} Sektoren entdeckt`);
    this.room?.send('getMySlates');
    this.room?.send('getDiscoveries');
  } else {
    store.addLog(`AKTIVIERUNG FEHLGESCHLAGEN: ${data.error}`);
  }
});

this.room.onMessage('npcBuybackResult', (data: any) => {
  if (data.success) {
    store.addLog(`SLATE VERKAUFT — +${data.creditsEarned} CR`);
    store.setCredits(data.credits);
    this.room?.send('getMySlates');
  } else {
    store.addLog(`VERKAUF FEHLGESCHLAGEN: ${data.error}`);
  }
});

this.room.onMessage('slateOrderAccepted', (data: any) => {
  if (data.success) {
    store.addLog('SLATE GEKAUFT');
    this.room?.send('getMySlates');
  }
});
```

**Step 2: Add Faction message handlers**

```typescript
this.room.onMessage('factionData', (data: FactionDataMessage) => {
  store.setFaction(data.faction);
  store.setFactionMembers(data.members);
  store.setFactionInvites(data.invites);
});

this.room.onMessage('createFactionResult', (data: any) => {
  if (data.success) {
    store.addLog('FRAKTION GEGRÜNDET');
  } else {
    store.addLog(`FEHLER: ${data.error}`);
  }
});

this.room.onMessage('factionActionResult', (data: any) => {
  if (data.success) {
    store.addLog(`FRAKTION: ${data.action.toUpperCase()} OK`);
    if (data.action !== 'invite') {
      store.setAlert(MONITORS.FACTION, true);
    }
  } else {
    store.addLog(`FRAKTION FEHLER: ${data.error}`);
  }
});
```

**Step 3: Add send methods**

```typescript
// Data Slates
sendCreateSlate(slateType: 'sector' | 'area') {
  this.room?.send('createSlate', { slateType });
}

requestMySlates() {
  this.room?.send('getMySlates');
}

sendActivateSlate(slateId: string) {
  this.room?.send('activateSlate', { slateId });
}

sendNpcBuyback(slateId: string) {
  this.room?.send('npcBuybackSlate', { slateId });
}

sendListSlate(slateId: string, price: number) {
  this.room?.send('listSlate', { slateId, price });
}

sendAcceptSlateOrder(orderId: string) {
  this.room?.send('acceptSlateOrder', { orderId });
}

// Factions
requestFaction() {
  this.room?.send('getFaction');
}

sendCreateFaction(name: string, tag: string, joinMode: string) {
  this.room?.send('createFaction', { name, tag, joinMode });
}

sendFactionAction(action: string, opts: Record<string, any> = {}) {
  this.room?.send('factionAction', { action, ...opts });
}

sendRespondInvite(inviteId: string, accept: boolean) {
  this.room?.send('respondInvite', { inviteId, accept });
}
```

**Step 4: Add imports**

Add necessary type imports from `@void-sector/shared`:
```typescript
import type { DataSlate, FactionDataMessage } from '@void-sector/shared';
import { MONITORS } from '@void-sector/shared';
```
(Merge with existing imports)

**Step 5: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(client): add Data Slate + Faction network handlers"
```

---

### Task 10: CARGO Monitor — CREATE SLATE UI

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx`

**Step 1: Update CargoScreen to show slates and create button**

Add imports:
```typescript
import { SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_AREA_RADIUS } from '@void-sector/shared';
import type { DataSlate } from '@void-sector/shared';
```

Update the total calculation to include slates:
```typescript
const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;
```

Add slates CargoBar and slate list after the TOTAL bar, before jettison buttons:

```tsx
{/* Data Slates section */}
{cargo.slates > 0 && (
  <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: '8px', marginBottom: '8px' }}>
    <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>DATA SLATES: {cargo.slates}</div>
    {mySlates.map((slate: DataSlate) => (
      <div key={slate.id} style={{ fontSize: '0.8rem', marginBottom: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        <span>[{slate.slateType === 'sector' ? 'S' : 'A'}] {slate.sectorData.length} Sektoren</span>
        <button className="vs-btn vs-btn-sm" onClick={() => network.sendActivateSlate(slate.id)}>
          [AKTIVIEREN]
        </button>
        <button className="vs-btn vs-btn-sm" onClick={() => network.sendNpcBuyback(slate.id)}>
          [NPC VERKAUF]
        </button>
      </div>
    ))}
  </div>
)}

{/* Create Slate buttons */}
<div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: '8px', marginBottom: '8px' }}>
  <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>CREATE SLATE</div>
  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
    <button
      className="vs-btn"
      disabled={total >= cargoCap}
      onClick={() => network.sendCreateSlate('sector')}
    >
      [SEKTOR-SLATE {SLATE_AP_COST_SECTOR}AP]
    </button>
    <button
      className="vs-btn"
      disabled={total >= cargoCap}
      onClick={() => network.sendCreateSlate('area')}
    >
      [GEBIETS-SLATE]
    </button>
  </div>
</div>
```

Add store selector for mySlates:
```typescript
const mySlates = useStore((s) => s.mySlates);
```

Add useEffect to load slates on mount:
```typescript
useEffect(() => {
  network.requestMySlates();
}, []);
```

Add import for `useEffect`.

**Step 2: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx
git commit -m "feat(client): add Data Slate creation + management UI to CARGO monitor"
```

---

### Task 11: TRADE Monitor — Slate Marketplace

**Files:**
- Modify: `packages/client/src/components/TradeScreen.tsx`

**Step 1: Add slate marketplace tab**

Add a third tab "SLATES" that shows when trading post tier >= 2.

In the tab bar, add:
```tsx
{tier >= 2 && (
  <button
    className={`vs-btn ${tab === 'slates' ? 'vs-btn-active' : ''}`}
    onClick={() => setTab('slates')}
  >
    [SLATES]
  </button>
)}
```

Add a new tab content section for `tab === 'slates'`:

```tsx
{tab === 'slates' && (
  <div>
    <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>SLATE MARKTPLATZ</div>

    {/* My slates to list */}
    {mySlates.length > 0 && (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>MEINE SLATES:</div>
        {mySlates.map((slate: DataSlate) => (
          <div key={slate.id} style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
            <span>[{slate.slateType === 'sector' ? 'S' : 'A'}] {slate.sectorData.length} Sektoren</span>
            <input
              type="number"
              min="1"
              placeholder="CR"
              style={{ width: '60px' }}
              className="vs-input"
              id={`slate-price-${slate.id}`}
            />
            <button
              className="vs-btn vs-btn-sm"
              onClick={() => {
                const input = document.getElementById(`slate-price-${slate.id}`) as HTMLInputElement;
                const price = parseInt(input?.value || '0', 10);
                if (price > 0) network.sendListSlate(slate.id, price);
              }}
            >
              [LISTEN]
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Available slate orders */}
    <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>ANGEBOTE:</div>
    {tradeOrders
      .filter((o: any) => o.resource === 'slate')
      .map((order: any) => (
        <div key={order.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
          <span>{order.playerName}: {order.pricePerUnit} CR</span>
          <button
            className="vs-btn vs-btn-sm"
            disabled={order.playerId === playerId}
            onClick={() => network.sendAcceptSlateOrder(order.id)}
          >
            [KAUFEN]
          </button>
        </div>
      ))}
  </div>
)}
```

Add store selectors:
```typescript
const mySlates = useStore((s) => s.mySlates);
const playerId = useStore((s) => s.player?.id);
```

**Step 2: Commit**

```bash
git add packages/client/src/components/TradeScreen.tsx
git commit -m "feat(client): add Slate marketplace tab to TRADE monitor"
```

---

### Task 12: FACTION Monitor UI

**Files:**
- Create: `packages/client/src/components/FactionScreen.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Create FactionScreen component**

Create `packages/client/src/components/FactionScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { FactionJoinMode } from '@void-sector/shared';

export function FactionScreen() {
  const faction = useStore((s) => s.faction);
  const members = useStore((s) => s.factionMembers);
  const invites = useStore((s) => s.factionInvites);
  const playerId = useStore((s) => s.player?.id);

  useEffect(() => {
    network.requestFaction();
  }, []);

  if (!faction) {
    return <NoFactionView invites={invites} />;
  }

  const myRank = members.find(m => m.playerId === playerId)?.rank ?? 'member';
  const isLeader = myRank === 'leader';
  const isOfficer = myRank === 'officer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '8px' }}>
        FRAKTION
      </div>

      <div style={{ fontSize: '1rem', marginBottom: '4px' }}>
        [{faction.tag}] {faction.name}
      </div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '12px' }}>
        Modus: {faction.joinMode.toUpperCase()}
        {faction.joinMode === 'code' && faction.inviteCode && isLeader && (
          <span> | Code: {faction.inviteCode}</span>
        )}
        {' | '}{faction.memberCount} Mitglieder
      </div>

      {/* Member list */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>MITGLIEDER</div>
        {members.map(m => (
          <div key={m.playerId} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px', fontSize: '0.8rem' }}>
            <span style={{ opacity: 0.5, width: '50px' }}>
              {m.rank === 'leader' ? 'LDR' : m.rank === 'officer' ? 'OFF' : 'MBR'}
            </span>
            <span style={{ flex: 1 }}>{m.playerName}</span>
            {isLeader && m.playerId !== playerId && (
              <>
                {m.rank === 'member' && (
                  <button className="vs-btn vs-btn-sm" onClick={() =>
                    network.sendFactionAction('promote', { targetPlayerId: m.playerId })
                  }>[+]</button>
                )}
                {m.rank === 'officer' && (
                  <button className="vs-btn vs-btn-sm" onClick={() =>
                    network.sendFactionAction('demote', { targetPlayerId: m.playerId })
                  }>[-]</button>
                )}
                <button className="vs-btn vs-btn-sm" onClick={() =>
                  network.sendFactionAction('kick', { targetPlayerId: m.playerId })
                }>[X]</button>
              </>
            )}
            {isOfficer && m.rank === 'member' && m.playerId !== playerId && (
              <button className="vs-btn vs-btn-sm" onClick={() =>
                network.sendFactionAction('kick', { targetPlayerId: m.playerId })
              }>[X]</button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
        {(isLeader || isOfficer) && (
          <InviteButton />
        )}
        {isLeader && (
          <>
            <JoinModeSelector currentMode={faction.joinMode} />
            <button className="vs-btn" onClick={() => {
              if (confirm('Fraktion auflösen?')) network.sendFactionAction('disband');
            }}>[AUFLÖSEN]</button>
          </>
        )}
        {!isLeader && (
          <button className="vs-btn" onClick={() => network.sendFactionAction('leave')}>
            [VERLASSEN]
          </button>
        )}
      </div>
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

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>EINLADUNGEN</div>
          {invites.map((inv: any) => (
            <div key={inv.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span>[{inv.factionTag}] {inv.factionName} (von {inv.inviterName})</span>
              <button className="vs-btn vs-btn-sm" onClick={() => network.sendRespondInvite(inv.id, true)}>
                [JA]
              </button>
              <button className="vs-btn vs-btn-sm" onClick={() => network.sendRespondInvite(inv.id, false)}>
                [NEIN]
              </button>
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
            onChange={e => setName(e.target.value)} maxLength={64} />
          <input className="vs-input" placeholder="Tag (3-5 Zeichen)" value={tag}
            onChange={e => setTag(e.target.value.toUpperCase())} maxLength={5} />
          <select className="vs-input" value={joinMode}
            onChange={e => setJoinMode(e.target.value as FactionJoinMode)}>
            <option value="open">Offen</option>
            <option value="code">Einladungscode</option>
            <option value="invite">Nur Einladung</option>
          </select>
          <button className="vs-btn"
            disabled={name.trim().length < 3 || tag.trim().length < 3}
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
              onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8} />
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
        onChange={e => setName(e.target.value)} style={{ width: '120px' }} />
      <button className="vs-btn" disabled={!name.trim()}
        onClick={() => {
          network.sendFactionAction('invite', { targetPlayerName: name.trim() });
          setName('');
          setOpen(false);
        }}>
        [OK]
      </button>
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
      {modes.map(m => (
        <button key={m} className={`vs-btn ${m === currentMode ? 'vs-btn-active' : ''}`}
          onClick={() => {
            network.sendFactionAction('setJoinMode', { joinMode: m });
            setOpen(false);
          }}>
          [{m.toUpperCase()}]
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Wire FactionScreen into GameScreen**

In `packages/client/src/components/GameScreen.tsx`, add import:
```typescript
import { FactionScreen } from './FactionScreen';
```

Add case in `renderScreen`:
```typescript
case MONITORS.FACTION: return <FactionScreen />;
```

**Step 3: Commit**

```bash
git add packages/client/src/components/FactionScreen.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): add FACTION monitor with create/join/manage/invite UI"
```

---

### Task 13: Client Tests

**Files:**
- Modify: `packages/client/src/__tests__/CargoScreen.test.tsx`
- Create: `packages/client/src/__tests__/FactionScreen.test.tsx`

**Step 1: Add CargoScreen slate tests**

Add to `packages/client/src/__tests__/CargoScreen.test.tsx`:

```typescript
it('shows slate count when player has slates', () => {
  useStore.setState({
    cargo: { ore: 5, gas: 3, crystal: 1, slates: 2 },
    mySlates: [
      { id: 's1', creatorId: 'p1', ownerId: 'p1', slateType: 'sector', sectorData: [{ x: 0, y: 0, type: 'nebula', ore: 10, gas: 5, crystal: 0 }], status: 'available', createdAt: 0 },
    ],
    ship: { shipClass: 'aegis_scout_mk1', fuel: 100, maxFuel: 100, jumpRange: 3, cargoCap: 20, scannerLevel: 1 },
  });
  render(<CargoScreen />);
  expect(screen.getByText(/DATA SLATES: 2/)).toBeDefined();
  expect(screen.getByText(/AKTIVIEREN/)).toBeDefined();
});

it('shows create slate buttons', () => {
  useStore.setState({
    cargo: { ore: 0, gas: 0, crystal: 0, slates: 0 },
    mySlates: [],
    ship: { shipClass: 'aegis_scout_mk1', fuel: 100, maxFuel: 100, jumpRange: 3, cargoCap: 20, scannerLevel: 1 },
  });
  render(<CargoScreen />);
  expect(screen.getByText(/SEKTOR-SLATE/)).toBeDefined();
  expect(screen.getByText(/GEBIETS-SLATE/)).toBeDefined();
});
```

**Step 2: Create FactionScreen tests**

Create `packages/client/src/__tests__/FactionScreen.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FactionScreen } from '../components/FactionScreen';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({
  network: {
    requestFaction: vi.fn(),
    sendCreateFaction: vi.fn(),
    sendFactionAction: vi.fn(),
    sendRespondInvite: vi.fn(),
  },
}));

describe('FactionScreen', () => {
  beforeEach(() => {
    useStore.setState({
      faction: null,
      factionMembers: [],
      factionInvites: [],
      player: { id: 'p1', username: 'TestPlayer' },
    });
  });

  it('shows create/join when not in faction', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/Keine Fraktion/)).toBeDefined();
    expect(screen.getByText(/GRÜNDEN/)).toBeDefined();
    expect(screen.getByText(/BEITRETEN/)).toBeDefined();
  });

  it('shows faction info when in faction', () => {
    useStore.setState({
      faction: {
        id: 'f1', name: 'Test Faction', tag: 'TST', leaderId: 'p1',
        joinMode: 'invite', memberCount: 3, createdAt: Date.now(),
      },
      factionMembers: [
        { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader', joinedAt: Date.now() },
        { playerId: 'p2', playerName: 'Member1', rank: 'member', joinedAt: Date.now() },
      ],
    });
    render(<FactionScreen />);
    expect(screen.getByText(/\[TST\] Test Faction/)).toBeDefined();
    expect(screen.getByText(/TestPlayer/)).toBeDefined();
    expect(screen.getByText(/Member1/)).toBeDefined();
  });

  it('shows pending invites', () => {
    useStore.setState({
      factionInvites: [{
        id: 'inv1', factionId: 'f1', factionName: 'Cool Faction',
        factionTag: 'COOL', inviterName: 'Leader1',
        status: 'pending', createdAt: Date.now(),
      }],
    });
    render(<FactionScreen />);
    expect(screen.getByText(/COOL.*Cool Faction/)).toBeDefined();
    expect(screen.getByText(/JA/)).toBeDefined();
    expect(screen.getByText(/NEIN/)).toBeDefined();
  });

  it('shows management buttons for leader', () => {
    useStore.setState({
      faction: {
        id: 'f1', name: 'Test Faction', tag: 'TST', leaderId: 'p1',
        joinMode: 'code', inviteCode: 'ABC123', memberCount: 2, createdAt: Date.now(),
      },
      factionMembers: [
        { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader', joinedAt: Date.now() },
        { playerId: 'p2', playerName: 'Member1', rank: 'member', joinedAt: Date.now() },
      ],
    });
    render(<FactionScreen />);
    expect(screen.getByText(/EINLADEN/)).toBeDefined();
    expect(screen.getByText(/MODUS/)).toBeDefined();
    expect(screen.getByText(/AUFLÖSEN/)).toBeDefined();
    expect(screen.getByText(/ABC123/)).toBeDefined();
  });
});
```

**Step 3: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: PASS (all existing + 6 new tests)

**Step 4: Commit**

```bash
git add packages/client/src/__tests__/CargoScreen.test.tsx packages/client/src/__tests__/FactionScreen.test.tsx
git commit -m "test(client): add Data Slate + Faction UI tests"
```

---

### Task 14: Documentation Update

**Files:**
- Modify: `CLAUDE.md`
- Modify: `planung/ROADMAP.md`

**Step 1: Update CLAUDE.md**

- Update test counts to reflect new totals
- Update migration count to 001-007
- Add `feat/dataslates-factions` branch description if on feature branch

**Step 2: Update ROADMAP.md**

Mark Phase 3 items as complete:
```markdown
## Phase 3: Handel & Multiplayer
- [x] Marktplatz-System: Items zum Verkauf einstellen.
- [x] Karten-Handel: "Data Slates" von Sektoren erstellen und traden.
- [x] Fraktions-System: Gründung und gemeinsamer Chat.
```

**Step 3: Commit**

```bash
git add CLAUDE.md planung/ROADMAP.md
git commit -m "docs: update CLAUDE.md + ROADMAP for Phase 3 completion"
```

---

## Summary

14 tasks total:
1. Shared types + constants (types.ts, constants.ts)
2. Migration 007 (slates + factions tables)
3. Data Slate DB queries (queries.ts)
4. Data Slate validation + 7 tests (commands.ts)
5. Data Slate server handlers (SectorRoom.ts)
6. Faction DB queries (queries.ts)
7. Faction server handlers + 10 tests + chat activation (SectorRoom.ts, commands.ts)
8. Client store (gameSlice.ts, mockStore.ts)
9. Client network (client.ts)
10. CARGO monitor update — slate UI (CargoScreen.tsx)
11. TRADE monitor update — slate marketplace (TradeScreen.tsx)
12. FACTION monitor — new FactionScreen (FactionScreen.tsx, GameScreen.tsx)
13. Client tests — 6 new tests (CargoScreen, FactionScreen)
14. Documentation (CLAUDE.md, ROADMAP.md)

Estimated new tests: 17 server + 6 client = 23 new tests
Total after: ~90 server + ~63 client + 5 shared = ~158 tests
