# Phase 7: Modular Ship Designer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded ship system with a modular hull + module slot system, add hangar for multiple ships, and enable NPC trade at stations.

**Architecture:** Ships are defined by a hull type (Scout, Freighter, Cruiser, Explorer, Battleship) plus N module slots. Final stats = hull base stats + sum of module bonuses. Ships stored in DB with modules as JSONB array. Client shows CRT schematic drawing in SHIP-SYS monitor.

**Tech Stack:** TypeScript, Colyseus (server), React + Zustand (client), PostgreSQL (persistence), Redis (runtime state)

**Issues covered:** #19 (Custom Ship Designs), #30 (Ship/Base Rename)

---

## Task 0: Gameplay Fix — NPC Trade at Stations + Implicit Home Base

The home base is already a base — players should not need to "build a base" structure first. And NPC stations should allow direct trading without a trading post.

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (handleNpcTrade ~line 1135)
- Modify: `packages/client/src/components/TradeScreen.tsx` (remove tradingPost gate)
- Modify: `packages/client/src/components/NavControls.tsx` (remove disabled MARKET button)
- Test: `packages/server/src/__tests__/` (add trade-at-station test)

**Step 1: Server — Allow NPC trade at stations**

In `SectorRoom.ts` `handleNpcTrade`, replace the home-base-only + trading-post-required check with a dual condition: allow trade if player is at a station OR at home base.

Current code (~line 1141-1149):
```typescript
if (this.state.sector.x !== player.homeBase.x || this.state.sector.y !== player.homeBase.y) {
  client.send('npcTradeResult', { success: false, error: 'Must be at home base' });
  return;
}
const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
if (!tradingPost) {
  client.send('npcTradeResult', { success: false, error: 'No trading post built' });
  return;
}
```

Replace with:
```typescript
const isStation = this.state.sector.sectorType === 'station';
const isHomeBase = this.state.sector.x === player.homeBase.x &&
                   this.state.sector.y === player.homeBase.y;
if (!isStation && !isHomeBase) {
  client.send('npcTradeResult', { success: false, error: 'Must be at a station or home base' });
  return;
}
```

At stations, trade directly from cargo (no storage needed). At home base, trade from storage as before. Add a `source` parameter or auto-detect based on location:

```typescript
// At stations: trade from cargo directly
// At home base: trade from storage (existing behavior)
const tradeFromCargo = isStation && !isHomeBase;
```

**Step 2: Client — TradeScreen shows at stations too**

In `TradeScreen.tsx`, the current gate is `if (!tradingPost)` showing "NO TRADING POST". Change to also show when at a station sector:

```typescript
const sectorType = useStore((s) => s.sectorType);
const isStation = sectorType === 'station';
const isHomeBase = /* check if current position === home base */;

// Show trade UI if at station OR at home base
if (!isStation && !isHomeBase) {
  return <div>... NO TRADE AVAILABLE ...</div>;
}
```

At stations, show only the NPC tab (no market, no routes). At home base, show full tabs based on trading post tier.

**Step 3: Test and commit**

Run: `cd packages/server && npx vitest run`
Commit: `fix(server,client): allow NPC trade at stations and implicit home base`

---

## Task 1: Shared — Hull & Module Type Definitions

Define all hull types, module types, and the stat calculation function in shared package.

**Files:**
- Modify: `packages/shared/src/types.ts` (add HullType, ModuleType, etc.)
- Modify: `packages/shared/src/constants.ts` (add HULLS, MODULES definitions)
- Create: `packages/shared/src/shipCalculator.ts` (stat calculation)
- Modify: `packages/shared/src/index.ts` (export new module)
- Test: `packages/shared/src/__tests__/shipCalculator.test.ts`

**Step 1: Add types to `types.ts`**

```typescript
// Hull types
export type HullType = 'scout' | 'freighter' | 'cruiser' | 'explorer' | 'battleship';
export type HullSize = 'small' | 'medium' | 'large';

export type ModuleCategory = 'drive' | 'cargo' | 'scanner' | 'armor' | 'special';
export type ModuleTier = 1 | 2 | 3;

export interface HullDefinition {
  name: string;
  size: HullSize;
  slots: number;
  baseFuel: number;
  baseCargo: number;
  baseJumpRange: number;
  baseApPerJump: number;
  baseHp: number;
  baseCommRange: number;
  baseScannerLevel: number;
  unlockLevel: number;
  unlockCost: number;
}

export interface ModuleDefinition {
  id: string;
  category: ModuleCategory;
  tier: ModuleTier;
  name: string;
  displayName: string;
  effects: Partial<ShipStats>;
  cost: { credits: number; ore?: number; gas?: number; crystal?: number };
}

export interface ShipModule {
  moduleId: string;     // references ModuleDefinition.id
  slotIndex: number;    // 0-based slot position
}

export interface ShipStats {
  fuelMax: number;
  cargoCap: number;
  jumpRange: number;
  apCostJump: number;
  hp: number;
  commRange: number;
  scannerLevel: number;
  damageMod: number;      // multiplier for incoming damage (0.75 = -25%)
}

export interface ShipRecord {
  id: string;
  ownerId: string;
  hullType: HullType;
  name: string;
  modules: ShipModule[];
  active: boolean;
  createdAt: string;
}
```

Keep existing `ShipClass` type as deprecated alias for backward compat until migration is done. Update `ShipData` to extend the new system:

```typescript
export interface ShipData {
  id: string;
  ownerId: string;
  hullType: HullType;
  name: string;
  modules: ShipModule[];
  stats: ShipStats;       // calculated stats
  fuel: number;           // current fuel (runtime)
  active: boolean;
}
```

**Step 2: Add constants to `constants.ts`**

```typescript
export const HULLS: Record<HullType, HullDefinition> = {
  scout: {
    name: 'VOID SCOUT',
    size: 'small',
    slots: 3,
    baseFuel: 80,
    baseCargo: 3,
    baseJumpRange: 5,
    baseApPerJump: 1,
    baseHp: 50,
    baseCommRange: 50,
    baseScannerLevel: 1,
    unlockLevel: 1,
    unlockCost: 0,
  },
  freighter: {
    name: 'VOID FREIGHTER',
    size: 'medium',
    slots: 4,
    baseFuel: 120,
    baseCargo: 15,
    baseJumpRange: 3,
    baseApPerJump: 2,
    baseHp: 80,
    baseCommRange: 75,
    baseScannerLevel: 1,
    unlockLevel: 3,
    unlockCost: 500,
  },
  cruiser: {
    name: 'VOID CRUISER',
    size: 'medium',
    slots: 4,
    baseFuel: 150,
    baseCargo: 8,
    baseJumpRange: 4,
    baseApPerJump: 1,
    baseHp: 100,
    baseCommRange: 100,
    baseScannerLevel: 1,
    unlockLevel: 4,
    unlockCost: 1000,
  },
  explorer: {
    name: 'VOID EXPLORER',
    size: 'large',
    slots: 5,
    baseFuel: 200,
    baseCargo: 10,
    baseJumpRange: 6,
    baseApPerJump: 1,
    baseHp: 70,
    baseCommRange: 150,
    baseScannerLevel: 2,
    unlockLevel: 5,
    unlockCost: 2000,
  },
  battleship: {
    name: 'VOID BATTLESHIP',
    size: 'large',
    slots: 5,
    baseFuel: 180,
    baseCargo: 5,
    baseJumpRange: 2,
    baseApPerJump: 2,
    baseHp: 150,
    baseCommRange: 75,
    baseScannerLevel: 1,
    unlockLevel: 6,
    unlockCost: 3000,
  },
};

export const MODULES: Record<string, ModuleDefinition> = {
  drive_mk1: {
    id: 'drive_mk1', category: 'drive', tier: 1,
    name: 'ION DRIVE MK.I', displayName: 'ION MK.I',
    effects: { jumpRange: 1 },
    cost: { credits: 100, ore: 10 },
  },
  drive_mk2: {
    id: 'drive_mk2', category: 'drive', tier: 2,
    name: 'ION DRIVE MK.II', displayName: 'ION MK.II',
    effects: { jumpRange: 2, apCostJump: -0.2 },
    cost: { credits: 300, ore: 20, crystal: 5 },
  },
  drive_mk3: {
    id: 'drive_mk3', category: 'drive', tier: 3,
    name: 'ION DRIVE MK.III', displayName: 'ION MK.III',
    effects: { jumpRange: 3, apCostJump: -0.5 },
    cost: { credits: 800, ore: 40, crystal: 15 },
  },
  cargo_mk1: {
    id: 'cargo_mk1', category: 'cargo', tier: 1,
    name: 'CARGO BAY MK.I', displayName: 'CARGO MK.I',
    effects: { cargoCap: 5 },
    cost: { credits: 80 },
  },
  cargo_mk2: {
    id: 'cargo_mk2', category: 'cargo', tier: 2,
    name: 'CARGO BAY MK.II', displayName: 'CARGO MK.II',
    effects: { cargoCap: 12 },
    cost: { credits: 250, ore: 15 },
  },
  cargo_mk3: {
    id: 'cargo_mk3', category: 'cargo', tier: 3,
    name: 'CARGO BAY MK.III', displayName: 'CARGO MK.III',
    effects: { cargoCap: 25 },
    cost: { credits: 600, ore: 30, gas: 10 },
  },
  scanner_mk1: {
    id: 'scanner_mk1', category: 'scanner', tier: 1,
    name: 'SCANNER MK.I', displayName: 'SCAN MK.I',
    effects: { scannerLevel: 1 },
    cost: { credits: 120, crystal: 5 },
  },
  scanner_mk2: {
    id: 'scanner_mk2', category: 'scanner', tier: 2,
    name: 'SCANNER MK.II', displayName: 'SCAN MK.II',
    effects: { scannerLevel: 1, commRange: 50 },
    cost: { credits: 350, crystal: 15 },
  },
  scanner_mk3: {
    id: 'scanner_mk3', category: 'scanner', tier: 3,
    name: 'SCANNER MK.III', displayName: 'SCAN MK.III',
    effects: { scannerLevel: 2, commRange: 100 },
    cost: { credits: 900, crystal: 30, gas: 10 },
  },
  armor_mk1: {
    id: 'armor_mk1', category: 'armor', tier: 1,
    name: 'ARMOR PLATING MK.I', displayName: 'ARM MK.I',
    effects: { hp: 25 },
    cost: { credits: 100, ore: 15 },
  },
  armor_mk2: {
    id: 'armor_mk2', category: 'armor', tier: 2,
    name: 'ARMOR PLATING MK.II', displayName: 'ARM MK.II',
    effects: { hp: 50, damageMod: -0.10 },
    cost: { credits: 300, ore: 30, crystal: 10 },
  },
  armor_mk3: {
    id: 'armor_mk3', category: 'armor', tier: 3,
    name: 'ARMOR PLATING MK.III', displayName: 'ARM MK.III',
    effects: { hp: 100, damageMod: -0.25 },
    cost: { credits: 800, ore: 50, crystal: 25 },
  },
};
```

**Step 3: Create `shipCalculator.ts`**

```typescript
import { HULLS, MODULES } from './constants.js';
import type { HullType, ShipModule, ShipStats } from './types.js';

export function calculateShipStats(hullType: HullType, modules: ShipModule[]): ShipStats {
  const hull = HULLS[hullType];
  const base: ShipStats = {
    fuelMax: hull.baseFuel,
    cargoCap: hull.baseCargo,
    jumpRange: hull.baseJumpRange,
    apCostJump: hull.baseApPerJump,
    hp: hull.baseHp,
    commRange: hull.baseCommRange,
    scannerLevel: hull.baseScannerLevel,
    damageMod: 1.0,
  };

  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.effects)) {
      if (key === 'damageMod') {
        base.damageMod += value as number; // additive: 1.0 + (-0.25) = 0.75
      } else {
        (base as any)[key] += value as number;
      }
    }
  }

  // Clamp minimums
  base.apCostJump = Math.max(0.5, base.apCostJump);
  base.jumpRange = Math.max(1, base.jumpRange);
  base.damageMod = Math.max(0.25, base.damageMod);

  return base;
}

export function validateModuleInstall(
  hullType: HullType, currentModules: ShipModule[], moduleId: string, slotIndex: number
): { valid: boolean; error?: string } {
  const hull = HULLS[hullType];
  const moduleDef = MODULES[moduleId];
  if (!moduleDef) return { valid: false, error: 'Unknown module' };
  if (slotIndex < 0 || slotIndex >= hull.slots) return { valid: false, error: 'Invalid slot' };
  if (currentModules.some(m => m.slotIndex === slotIndex)) {
    return { valid: false, error: 'Slot occupied — remove existing module first' };
  }
  return { valid: true };
}
```

**Step 4: Write tests**

File: `packages/shared/src/__tests__/shipCalculator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateShipStats, validateModuleInstall } from '../shipCalculator';

describe('calculateShipStats', () => {
  it('returns hull base stats with no modules', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.fuelMax).toBe(80);
    expect(stats.cargoCap).toBe(3);
    expect(stats.jumpRange).toBe(5);
    expect(stats.apCostJump).toBe(1);
  });

  it('adds module bonuses', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'drive_mk2', slotIndex: 0 },
      { moduleId: 'cargo_mk1', slotIndex: 1 },
    ]);
    expect(stats.jumpRange).toBe(7);  // 5 + 2
    expect(stats.cargoCap).toBe(8);   // 3 + 5
  });

  it('clamps AP cost to minimum 0.5', () => {
    const stats = calculateShipStats('scout', [
      { moduleId: 'drive_mk3', slotIndex: 0 },  // -0.5
    ]);
    expect(stats.apCostJump).toBe(0.5);  // 1 - 0.5 = 0.5
  });

  it('stacks armor damage reduction', () => {
    const stats = calculateShipStats('cruiser', [
      { moduleId: 'armor_mk3', slotIndex: 0 },
    ]);
    expect(stats.hp).toBe(200);         // 100 + 100
    expect(stats.damageMod).toBe(0.75); // 1.0 + (-0.25)
  });
});

describe('validateModuleInstall', () => {
  it('rejects invalid slot index', () => {
    const result = validateModuleInstall('scout', [], 'drive_mk1', 5); // scout has 3 slots
    expect(result.valid).toBe(false);
  });

  it('rejects occupied slot', () => {
    const result = validateModuleInstall('scout', [{ moduleId: 'drive_mk1', slotIndex: 0 }], 'cargo_mk1', 0);
    expect(result.valid).toBe(false);
  });

  it('accepts valid install', () => {
    const result = validateModuleInstall('scout', [], 'drive_mk1', 0);
    expect(result.valid).toBe(true);
  });
});
```

**Step 5: Build and test**

Run: `cd packages/shared && npx vitest run`
Run: `cd packages/shared && npx tsc --noEmit`
Commit: `feat(shared): add hull definitions, module system, and stat calculator`

---

## Task 2: DB Migration — Ships Schema + Base Name

Migrate the ships table from flat stat columns to hull_type + modules JSONB. Add base_name to players.

**Files:**
- Create: `packages/server/src/db/migrations/011_ship_designer.sql`
- Modify: `packages/server/src/db/queries.ts` (update ship queries)

**Step 1: Write migration**

```sql
-- Phase 7: Modular Ship Designer

-- Add hull_type and modules to ships
ALTER TABLE ships ADD COLUMN IF NOT EXISTS hull_type VARCHAR(32) NOT NULL DEFAULT 'scout';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS name VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migrate existing ship_class to hull_type
UPDATE ships SET hull_type = 'scout' WHERE ship_class = 'aegis_scout_mk1';
UPDATE ships SET hull_type = 'explorer' WHERE ship_class = 'void_seeker_mk2';

-- Drop deprecated stat columns (stats now calculated from hull + modules)
ALTER TABLE ships DROP COLUMN IF EXISTS ship_class;
ALTER TABLE ships DROP COLUMN IF EXISTS fuel_max;
ALTER TABLE ships DROP COLUMN IF EXISTS jump_range;
ALTER TABLE ships DROP COLUMN IF EXISTS ap_cost_jump;
ALTER TABLE ships DROP COLUMN IF EXISTS cargo_cap;
ALTER TABLE ships DROP COLUMN IF EXISTS scanner_level;
ALTER TABLE ships DROP COLUMN IF EXISTS safe_slots;

-- Add base_name to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS base_name VARCHAR(20) NOT NULL DEFAULT '';

-- Ensure only one active ship per player (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ships_active_unique
  ON ships (owner_id) WHERE active = true;
```

**Step 2: Update ship queries in `queries.ts`**

Replace `getActiveShip`:
```typescript
export async function getActiveShip(playerId: string): Promise<ShipRecord | null> {
  const { rows } = await query<{
    id: string;
    owner_id: string;
    hull_type: string;
    name: string;
    modules: ShipModule[];
    fuel: number;
    active: boolean;
    created_at: string;
  }>(
    `SELECT id, owner_id, hull_type, name, modules, fuel, active, created_at
     FROM ships WHERE owner_id = $1 AND active = TRUE LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    ownerId: row.owner_id,
    hullType: row.hull_type as HullType,
    name: row.name,
    modules: row.modules,
    active: row.active,
    createdAt: row.created_at,
  };
}
```

Add new queries:
```typescript
export async function getPlayerShips(playerId: string): Promise<ShipRecord[]> {
  const { rows } = await query<any>(
    `SELECT id, owner_id, hull_type, name, modules, fuel, active, created_at
     FROM ships WHERE owner_id = $1 ORDER BY created_at ASC`,
    [playerId]
  );
  return rows.map(row => ({
    id: row.id,
    ownerId: row.owner_id,
    hullType: row.hull_type as HullType,
    name: row.name,
    modules: row.modules,
    active: row.active,
    createdAt: row.created_at,
  }));
}

export async function createShip(
  playerId: string, hullType: HullType, name: string
): Promise<ShipRecord> {
  // Deactivate current active ship first
  await query('UPDATE ships SET active = false WHERE owner_id = $1 AND active = true', [playerId]);
  const { rows } = await query<any>(
    `INSERT INTO ships (owner_id, hull_type, name, fuel, active)
     VALUES ($1, $2, $3, $4, true) RETURNING *`,
    [playerId, hullType, name, HULLS[hullType].baseFuel]
  );
  const row = rows[0];
  return {
    id: row.id, ownerId: row.owner_id, hullType: row.hull_type as HullType,
    name: row.name, modules: row.modules, active: row.active, createdAt: row.created_at,
  };
}

export async function switchActiveShip(playerId: string, shipId: string): Promise<boolean> {
  await query('UPDATE ships SET active = false WHERE owner_id = $1 AND active = true', [playerId]);
  const { rowCount } = await query(
    'UPDATE ships SET active = true WHERE id = $1 AND owner_id = $2',
    [shipId, playerId]
  );
  return (rowCount ?? 0) > 0;
}

export async function updateShipModules(shipId: string, modules: ShipModule[]): Promise<void> {
  await query('UPDATE ships SET modules = $1 WHERE id = $2', [JSON.stringify(modules), shipId]);
}

export async function renameShip(shipId: string, playerId: string, name: string): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE ships SET name = $1 WHERE id = $2 AND owner_id = $3',
    [name.slice(0, 20), shipId, playerId]
  );
  return (rowCount ?? 0) > 0;
}

export async function renameBase(playerId: string, name: string): Promise<void> {
  await query('UPDATE players SET base_name = $1 WHERE id = $2', [name.slice(0, 20), playerId]);
}
```

**Step 3: Test migration locally**

Run: `npm run docker:up` (restart DB)
Run: `npm run dev:server` (auto-runs migrations)
Verify: No errors in server startup
Commit: `feat(server): add ship designer migration and queries`

---

## Task 3: Server — Ship Designer Message Handlers

Add Colyseus message handlers for ship management: list ships, switch ship, install/remove modules, buy modules, rename ship/base.

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (add handlers)
- Modify: `packages/shared/src/types.ts` (add message types)

**Step 1: Add message types to shared `types.ts`**

```typescript
export interface InstallModuleMessage { shipId: string; moduleId: string; slotIndex: number; }
export interface RemoveModuleMessage { shipId: string; slotIndex: number; }
export interface BuyModuleMessage { moduleId: string; }
export interface SwitchShipMessage { shipId: string; }
export interface RenameShipMessage { shipId: string; name: string; }
export interface RenameBaseMessage { name: string; }
export interface BuyHullMessage { hullType: HullType; name: string; }
```

**Step 2: Register message handlers in SectorRoom.onCreate**

```typescript
this.onMessage('getShips', async (client) => { ... });
this.onMessage('switchShip', async (client, data: SwitchShipMessage) => { ... });
this.onMessage('installModule', async (client, data: InstallModuleMessage) => { ... });
this.onMessage('removeModule', async (client, data: RemoveModuleMessage) => { ... });
this.onMessage('buyModule', async (client, data: BuyModuleMessage) => { ... });
this.onMessage('buyHull', async (client, data: BuyHullMessage) => { ... });
this.onMessage('renameShip', async (client, data: RenameShipMessage) => { ... });
this.onMessage('renameBase', async (client, data: RenameBaseMessage) => { ... });
```

**Key handler logic:**

`getShips` — return all player ships with calculated stats:
```typescript
const ships = await getPlayerShips(auth.userId);
const shipsWithStats = ships.map(s => ({
  ...s,
  stats: calculateShipStats(s.hullType, s.modules),
}));
client.send('shipList', { ships: shipsWithStats });
```

`switchShip` — only at home base, deactivate current, activate target, recalculate stats:
```typescript
// Validate: must be at home base
// switchActiveShip in DB
// Reload ship stats into clientShips map
// Send new shipData to client
```

`installModule` — validate slot, update modules array, recalculate:
```typescript
const ship = await getActiveShip(auth.userId);
const validation = validateModuleInstall(ship.hullType, ship.modules, data.moduleId, data.slotIndex);
if (!validation.valid) { client.send('error', ...); return; }
// Check module is in player's inventory (moduleInventory table or cargo-based)
const newModules = [...ship.modules, { moduleId: data.moduleId, slotIndex: data.slotIndex }];
await updateShipModules(ship.id, newModules);
// Recalculate and send updated stats
```

`buyModule` — at station or base, deduct credits + resources, add to module inventory:
```typescript
const moduleDef = MODULES[data.moduleId];
// Validate credits and resources
// Deduct costs
// Add module to inventory
client.send('buyModuleResult', { success: true, moduleId: data.moduleId });
```

`buyHull` — at station or base, validate level + credits, create new ship:
```typescript
const hullDef = HULLS[data.hullType];
// Validate level >= hullDef.unlockLevel
// Validate credits >= hullDef.unlockCost
// Deduct credits
// Create ship (becomes active)
// Send updated shipData
```

**Step 3: Update room join to use new ship system**

Replace the current ship loading (~line 328-346) to use `calculateShipStats`:
```typescript
const shipRecord = await getActiveShip(auth.userId);
if (!shipRecord) {
  // First login — create default scout ship
  const newShip = await createShip(auth.userId, 'scout', 'AEGIS');
  shipRecord = newShip;
}
const stats = calculateShipStats(shipRecord.hullType, shipRecord.modules);
this.clientShips.set(client.sessionId, stats);
client.send('shipData', {
  id: shipRecord.id,
  ownerId: auth.userId,
  hullType: shipRecord.hullType,
  name: shipRecord.name,
  modules: shipRecord.modules,
  stats,
  fuel: fuelState.current,
  active: true,
});
```

**Step 4: Module inventory system**

For simplicity, store purchased-but-not-installed modules as a JSONB array on the player. Add to players table:
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS module_inventory JSONB NOT NULL DEFAULT '[]';
```

Add to migration file and create queries:
```typescript
export async function getModuleInventory(playerId: string): Promise<string[]> { ... }
export async function addModuleToInventory(playerId: string, moduleId: string): Promise<void> { ... }
export async function removeModuleFromInventory(playerId: string, moduleId: string): Promise<void> { ... }
```

**Step 5: Test and commit**

Run: `cd packages/server && npx vitest run`
Commit: `feat(server): add ship designer message handlers and module system`

---

## Task 4: Client — Store & Network for Ship Designer

Update the Zustand store and GameNetwork to handle the new ship data format and ship management commands.

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts` (update ShipData, add ship list, module inventory)
- Modify: `packages/client/src/network/client.ts` (add send/receive methods)

**Step 1: Update store state**

```typescript
// In GameSlice interface, add:
shipList: ShipData[];
moduleInventory: string[];    // module IDs owned but not installed
baseName: string;

// Actions:
setShipList: (ships: ShipData[]) => void;
setModuleInventory: (modules: string[]) => void;
setBaseName: (name: string) => void;
```

Update existing `ship` state to use the new `ShipData` interface with `hullType`, `name`, `modules`, `stats`.

**Step 2: Add network methods**

```typescript
// Send methods
sendGetShips() { this.room?.send('getShips'); }
sendSwitchShip(shipId: string) { this.room?.send('switchShip', { shipId }); }
sendInstallModule(shipId: string, moduleId: string, slotIndex: number) { ... }
sendRemoveModule(shipId: string, slotIndex: number) { ... }
sendBuyModule(moduleId: string) { ... }
sendBuyHull(hullType: string, name: string) { ... }
sendRenameShip(shipId: string, name: string) { ... }
sendRenameBase(name: string) { ... }

// Receive handlers (in setupRoomListeners)
room.onMessage('shipData', (data) => { useStore.setState({ ship: data }); });
room.onMessage('shipList', (data) => { useStore.setState({ shipList: data.ships }); });
room.onMessage('moduleInventory', (data) => { useStore.setState({ moduleInventory: data.modules }); });
room.onMessage('buyModuleResult', (data) => { ... });
room.onMessage('buyHullResult', (data) => { ... });
```

**Step 3: Test and commit**

Run: `cd packages/client && npx vitest run`
Commit: `feat(client): add ship designer store and network layer`

---

## Task 5: Client — SHIP-SYS Schematic Display

Replace the current simple stat list with a CRT-style schematic drawing showing hull shape + module slots + calculated stats.

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx` (rewrite ShipSysScreen)

**Step 1: Build the schematic component**

The SHIP-SYS monitor shows a two-column layout:
- Left: ASCII schematic of the ship with module slots
- Right: Ship name, hull info, module list, calculated stats

```
     ╱╲
    ╱  ╲
   ╱ SC ╲        VOID SCOUT "AEGIS"
  ┌──────┐       ─────────────────────
  │ DRIV │       HULL:    SCOUT
  │  II  │       DRIVE:   ION MK.II
  ├──────┤       CARGO:   STANDARD MK.I
  │CARGO │       SCANNER: BASIC MK.I
  │  I   │       ARMOR:   NONE
  ├──────┤       SPECIAL: NONE
  │ SCAN │       ─────────────────────
  │  I   │       FUEL: 80  CARGO: 8
  └──┬┬──┘       JUMP: 7   AP/J: 1
     ││           SCAN: 1   HP: 50
     ╲╱
```

Implement as a monospace `<pre>` block with colored highlighting for occupied slots. Each hull type gets a different ASCII shape (scout=arrow, freighter=rectangle, etc.).

Generate the schematic dynamically based on `ship.hullType`, `ship.modules`, and `ship.stats`.

**Step 2: Add bezel buttons**

In the SHIP-SYS bezel, add context buttons:
- `[MODULES]` — opens module management view (Task 6)
- `[HANGAR]` — opens hangar view (Task 6)
- `[RENAME]` — inline rename input

**Step 3: Test visually and commit**

Run: `npm run dev:client` and verify rendering
Commit: `feat(client): CRT schematic ship display in SHIP-SYS monitor`

---

## Task 6: Client — Module Management & Hangar UI

Add UI for managing modules (install/remove/buy) and switching between ships in the hangar.

**Files:**
- Create: `packages/client/src/components/ModulePanel.tsx`
- Create: `packages/client/src/components/HangarPanel.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx` (integrate panels)

**Step 1: ModulePanel component**

Shows when [MODULES] bezel button is clicked in SHIP-SYS. Two sections:

**Installed Modules:**
```
SLOT 0: [ION DRIVE MK.II]     [REMOVE]
SLOT 1: [CARGO BAY MK.I]      [REMOVE]
SLOT 2: --- EMPTY ---          [INSTALL ▼]
```

**Module Inventory:** (uninstalled modules)
```
AVAILABLE:
  SCANNER MK.I     [INSTALL → SLOT 2]
```

**Module Shop:** (at station or base)
```
BUY MODULES:
  ION DRIVE MK.I    100 CR  10 ORE    [BUY]
  CARGO BAY MK.I     80 CR            [BUY]
  ...
```

**Step 2: HangarPanel component**

Shows when [HANGAR] bezel button is clicked. Lists all player ships:

```
HANGAR ── 2 SHIPS
─────────────────────
► AEGIS         SCOUT     [ACTIVE]
  HAULER-7      FREIGHTER [SWITCH]

  [BUY NEW HULL]
```

Buy New Hull shows available hulls filtered by player level:
```
AVAILABLE HULLS:
  FREIGHTER   500 CR  LVL 3   [BUY]
  CRUISER    1000 CR  LVL 4   [LOCKED]
```

Switch only works at home base.

**Step 3: Ship/Base rename**

Add inline rename input (max 20 chars) in SHIP-SYS schematic header. Click ship name → editable input → Enter to save.

Same for base name in BASE-LINK monitor.

**Step 4: Test and commit**

Run: `npm run dev:client` and test module install/remove/buy, ship switching
Commit: `feat(client): module management, hangar, and rename UI`

---

## Task 7: Client — Radar Hull-Specific Icons

Render different ship shapes on the radar canvas based on hull type.

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/shared/src/constants.ts` (add hull pixel patterns)

**Step 1: Define hull pixel patterns in constants**

```typescript
export const HULL_RADAR_PATTERNS: Record<HullType, number[][]> = {
  scout:      [[0,1,0], [1,1,1], [0,1,0]],           // arrow
  freighter:  [[1,1,0], [1,1,1], [1,1,0]],           // wide rectangle
  cruiser:    [[0,1,0], [1,1,1], [0,1,0]],           // diamond
  explorer:   [[0,1,1,0], [1,1,1,1], [0,1,1,0]],    // elongated
  battleship: [[1,1,0], [1,1,1], [1,1,1], [1,1,0]], // heavy
};
```

**Step 2: Update radar renderer**

Replace the single-character ship rendering with pixel pattern rendering. For the player's own ship, use the active ship's hull pattern. For other players, the server must broadcast hull type info.

Add `hullType` to the player state broadcast in SectorRoom (in the players list sent to clients).

**Step 3: Update detail panel**

In DetailPanel, show other player's ship hull type and name when visible.

**Step 4: Test and commit**

Run: `npm run dev:client` and verify radar rendering
Commit: `feat(client): hull-specific ship icons on radar canvas`

---

## Task Summary

| # | Task | Scope | Dependencies |
|---|------|-------|-------------|
| 0 | NPC Trade at Stations + Implicit Home Base | Server + Client | None |
| 1 | Hull & Module Type Definitions + Calculator | Shared | None |
| 2 | DB Migration + Ship Queries | Server | Task 1 |
| 3 | Ship Designer Message Handlers | Server | Tasks 1, 2 |
| 4 | Client Store & Network | Client | Tasks 1, 3 |
| 5 | SHIP-SYS Schematic Display | Client | Task 4 |
| 6 | Module Management & Hangar UI | Client | Tasks 4, 5 |
| 7 | Radar Hull-Specific Icons | Client | Task 4 |

Tasks 0 and 1 can run in parallel. Tasks 5 and 7 can run in parallel after Task 4.
