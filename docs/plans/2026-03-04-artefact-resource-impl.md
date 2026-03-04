# Artefact Resource System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 'artefact' as a 4th resource type — extremely rare, not mineable, not NPC-tradeable, only obtained via scan events and combat loot, always protected by safe-slot on ship loss.

**Architecture:** Introduce `MineableResourceType = 'ore' | 'gas' | 'crystal'` to avoid cascading changes to sector yields, structure costs, and NPC prices. `ResourceType = MineableResourceType | 'artefact'`. Artefact fields added explicitly to `CargoState` and `StorageInventory`. Server validation uses purpose-specific allowlists. Scan events and combat loot gain artefact drop chances.

**Tech Stack:** TypeScript, Vitest, PostgreSQL (migration), React/Zustand (client state)

---

### Task 1: Shared Types & Constants

**Files:**
- Modify: `packages/shared/src/types.ts:12-18,130-135,219-223`
- Modify: `packages/shared/src/constants.ts:1,43-50,54,56-65,90-94`
- Create: `packages/shared/src/__tests__/artefact.test.ts`

**Step 1: Add MineableResourceType and update ResourceType**

In `packages/shared/src/types.ts` (line 12):

```typescript
export type MineableResourceType = 'ore' | 'gas' | 'crystal';
export type ResourceType = MineableResourceType | 'artefact';
```

Add `artefact` to `CargoState` (line 130-135):
```typescript
export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
  slates: number;
  artefact: number;
}
```

Add `artefact` to `StorageInventory` (line 219-223):
```typescript
export interface StorageInventory {
  ore: number;
  gas: number;
  crystal: number;
  artefact: number;
}
```

Export `MineableResourceType` from the types file.

**Step 2: Update constants.ts Record types**

In `packages/shared/src/constants.ts`:

Update import (line 1): add `MineableResourceType` to the import.

Change `RESOURCE_TYPES` (line 54):
```typescript
export const RESOURCE_TYPES: MineableResourceType[] = ['ore', 'gas', 'crystal'];
```

Change `SECTOR_RESOURCE_YIELDS` type (line 43):
```typescript
export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<MineableResourceType, number>> = {
  // ... entries unchanged
};
```

Change `STRUCTURE_COSTS` type (line 56):
```typescript
export const STRUCTURE_COSTS: Record<StructureType, Record<MineableResourceType, number>> = {
  // ... entries unchanged
};
```

Change `NPC_PRICES` type (line 90):
```typescript
export const NPC_PRICES: Record<MineableResourceType, number> = {
  // ... entries unchanged
};
```

Add new constants after line 94:
```typescript
// Artefact drop chances
export const ARTEFACT_DROP_CHANCES = {
  artifact_find_event: 0.50,  // 50% on artifact_find scan event (vs crystal)
  anomaly_scan: 0.08,         // 8% bonus on anomaly_reading
  pirate_loot: 0.03,          // 3% on pirate victory
} as const;

// Artefact color and symbol for UI
export const ARTEFACT_COLOR = '#FF6B35';
export const ARTEFACT_SYMBOL = '\u273B'; // ❋
```

**Step 3: Fix ModuleDefinition cost type**

In `packages/shared/src/types.ts` (line 814):
```typescript
  cost: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number };
```

Or alternatively use `Partial<Record<MineableResourceType, number>> & { credits: number }` — but explicit fields are clearer and already established.

**Step 4: Write shared tests**

Create `packages/shared/src/__tests__/artefact.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { ResourceType, MineableResourceType, CargoState, StorageInventory } from '../types.js';
import { RESOURCE_TYPES, ARTEFACT_DROP_CHANCES, NPC_PRICES, SECTOR_RESOURCE_YIELDS } from '../constants.js';

describe('Artefact resource type', () => {
  it('ResourceType includes artefact', () => {
    const r: ResourceType = 'artefact';
    expect(r).toBe('artefact');
  });

  it('MineableResourceType excludes artefact', () => {
    const types: MineableResourceType[] = ['ore', 'gas', 'crystal'];
    expect(types).not.toContain('artefact');
  });

  it('RESOURCE_TYPES only contains mineable resources', () => {
    expect(RESOURCE_TYPES).toEqual(['ore', 'gas', 'crystal']);
    expect(RESOURCE_TYPES).not.toContain('artefact');
  });

  it('CargoState includes artefact field', () => {
    const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 5 };
    expect(cargo.artefact).toBe(5);
  });

  it('StorageInventory includes artefact field', () => {
    const storage: StorageInventory = { ore: 0, gas: 0, crystal: 0, artefact: 3 };
    expect(storage.artefact).toBe(3);
  });

  it('NPC_PRICES does not include artefact', () => {
    expect('artefact' in NPC_PRICES).toBe(false);
  });

  it('SECTOR_RESOURCE_YIELDS does not include artefact in any sector', () => {
    for (const yields of Object.values(SECTOR_RESOURCE_YIELDS)) {
      expect('artefact' in yields).toBe(false);
    }
  });

  it('ARTEFACT_DROP_CHANCES are valid probabilities', () => {
    for (const chance of Object.values(ARTEFACT_DROP_CHANCES)) {
      expect(chance).toBeGreaterThan(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
  });
});
```

**Step 5: Run tests**

```bash
cd packages/shared && npx vitest run
```

**Step 6: Fix any TS compilation errors in shared**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json
```

**Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/__tests__/artefact.test.ts
git commit -m "feat: add artefact resource type with MineableResourceType split"
```

---

### Task 2: DB Migration & Server Queries

**Files:**
- Create: `packages/server/src/db/migrations/017_artefact_storage.sql`
- Modify: `packages/server/src/db/queries.ts:345,576-582,588`

**Step 1: Create migration**

Create `packages/server/src/db/migrations/017_artefact_storage.sql`:
```sql
-- Add artefact column to storage_inventory
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS artefact INTEGER DEFAULT 0;
```

Note: The `cargo` table uses a key-value design (`resource VARCHAR(16)`, `quantity INTEGER`), so 'artefact' rows work automatically without schema changes.

**Step 2: Update getPlayerCargo default**

In `packages/server/src/db/queries.ts` (line 345):
```typescript
const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
```

**Step 3: Update getStorageInventory**

In `packages/server/src/db/queries.ts` (lines 576-582):

Change SELECT to include artefact:
```typescript
const { rows } = await query<{ ore: number; gas: number; crystal: number; artefact: number }>(
  'SELECT ore, gas, crystal, artefact FROM storage_inventory WHERE player_id = $1',
  [playerId]
);
if (rows.length === 0) return { ore: 0, gas: 0, crystal: 0, artefact: 0 };
return { ore: rows[0].ore, gas: rows[0].gas, crystal: rows[0].crystal, artefact: rows[0].artefact };
```

**Step 4: Update safeCols in updateStorageResource**

In `packages/server/src/db/queries.ts` (line 588):
```typescript
const safeCols = ['ore', 'gas', 'crystal', 'artefact'];
```

**Step 5: Update SectorResources fallbacks**

In `queries.ts` there are `{ ore: 0, gas: 0, crystal: 0 }` fallbacks for sector resources (lines ~257, ~283). These are `SectorResources` (which does NOT include artefact) — leave them unchanged.

**Step 6: Run server tests**

```bash
cd packages/server && npx vitest run
```

**Step 7: Commit**

```bash
git add packages/server/src/db/migrations/017_artefact_storage.sql packages/server/src/db/queries.ts
git commit -m "feat: add artefact DB migration and query support"
```

---

### Task 3: Server Validation & Handlers

**Files:**
- Modify: `packages/server/src/engine/commands.ts:94,116,165-176,198-210,227-232,424-426`
- Modify: `packages/server/src/rooms/SectorRoom.ts:42,461,1249,1475,1524,1668,1726,1886`

**Step 1: Update commands.ts allowlists**

In `packages/server/src/engine/commands.ts`:

Import `RESOURCE_TYPES` at top:
```typescript
import { RESOURCE_TYPES } from '@void-sector/shared';
```

`validateMine` (line 94) — keep as ore/gas/crystal:
```typescript
if (!['ore', 'gas', 'crystal'].includes(resource))
```
No change needed. Artefacts are NOT mineable.

`validateJettison` (line 116) — add artefact:
```typescript
if (!['ore', 'gas', 'crystal', 'artefact'].includes(resource))
```

`validateTransfer` (line 165-176):
- Change parameter type (line 165): `storage: StorageInventory` (already includes artefact via the type)
- Update allowlist (line 169): `if (!['ore', 'gas', 'crystal', 'artefact'].includes(resource))`
- Update storage sum (line 176): `const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;`

`validateNpcTrade` (line 198-210):
- Update parameter type (line 198): `storage: StorageInventory`
- Keep allowlist as ore/gas/crystal (line 202): `if (!['ore', 'gas', 'crystal'].includes(resource))`
  - BUT add specific artefact error BEFORE the generic check:
  ```typescript
  if (resource === 'artefact') {
    return { valid: false, error: 'Artefakte können nicht an NPCs gehandelt werden' };
  }
  ```
- Update storage sum (line 210): `const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;`

`validateNpcCargoTrade` (line 227-232):
- Keep allowlist as ore/gas/crystal (line 232)
- Add specific artefact error before generic check:
  ```typescript
  if (resource === 'artefact') {
    return { valid: false, error: 'Artefakte können nicht an NPCs gehandelt werden' };
  }
  ```

Combat defeat `cargoLost` (line 424-426) — artefact is always safe:
```typescript
cargoLost: {
  ore: Math.floor(cargo.ore * lossRatio),
  gas: Math.floor(cargo.gas * lossRatio),
  crystal: Math.floor(cargo.crystal * lossRatio),
  // artefact NOT lost — always protected by safe-slot
},
```
No artefact field needed in cargoLost since it's `Partial<SectorResources>`.

**Step 2: Update SectorRoom.ts**

Replace `VALID_RESOURCES` (line 42):
```typescript
const VALID_MINE_RESOURCES = ['ore', 'gas', 'crystal'];
const VALID_TRANSFER_RESOURCES = ['ore', 'gas', 'crystal', 'artefact'];
```

Update mine handler (line 1249):
```typescript
if (!data.resource || !VALID_MINE_RESOURCES.includes(data.resource))
```

Update transfer handler (line 1475):
```typescript
if (!isPositiveInt(data.amount) || !VALID_TRANSFER_RESOURCES.includes(data.resource))
```

Update NPC trade handler (line 1524):
```typescript
if (data.resource === 'artefact') {
  client.send('error', { code: 'ARTEFACT_NOT_TRADEABLE', message: 'Artefakte können nicht an NPCs gehandelt werden' });
  return;
}
if (!isPositiveInt(data.amount) || !VALID_MINE_RESOURCES.includes(data.resource))
```

Update place order handler (line 1668):
```typescript
if (!VALID_MINE_RESOURCES.includes(data.resource))
```
(Artefacts cannot be listed on the player market per design: "Nicht: ► NPC-Handel ► Markt")

Update cargo sums — add `+ (cargo.artefact ?? 0)`:
- Line 461 cargoMap: add `artefact: cargo.artefact ?? 0`
- Line 1726: `const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + (cargo.artefact ?? 0);`
- Line 1886: same pattern

**Step 3: Run server tests**

```bash
cd packages/server && npx vitest run
```

**Step 4: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: artefact validation — mine/trade blocking, transfer/jettison support"
```

---

### Task 4: Server Scan Events & Combat Loot

**Files:**
- Modify: `packages/server/src/engine/scanEvents.ts:57-61`
- Modify: `packages/server/src/engine/commands.ts:410-418` (victory loot)
- Modify: `packages/server/src/rooms/SectorRoom.ts:2649-2678` (completeScanEvent handler)

**Step 1: Add artefact drops to scan event data**

In `packages/server/src/engine/scanEvents.ts` (lines 57-61):

```typescript
case 'anomaly_reading':
  return {
    rewardXp: 15 + ((seed >>> 6) % 35),
    rewardRep: 5,
    rewardArtefact: ((seed >>> 14) % 100) < 8 ? 1 : 0,  // 8% chance
  };
case 'artifact_find':
  return {
    rewardCredits: 50 + ((seed >>> 8) % 150),
    rewardRep: 10,
    rewardArtefact: ((seed >>> 16) % 100) < 50 ? 1 : 0,  // 50% chance
  };
```

Import `ARTEFACT_DROP_CHANCES` is optional since we use seed-based deterministic values (matching existing pattern), not `Math.random()`.

**Step 2: Add artefact reward handling in completeScanEvent**

In `packages/server/src/rooms/SectorRoom.ts` (after line 2676, before the log entry):

```typescript
if (eventData.rewardArtefact && eventData.rewardArtefact > 0) {
  const { addCargoResource } = await import('../db/queries.js');
  await addCargoResource(auth.userId, 'artefact', eventData.rewardArtefact);
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', updatedCargo);
  client.send('logEntry', `ARTEFAKT GEFUNDEN! +${eventData.rewardArtefact} ❋`);
}
```

Note: `addCargoResource` is the function at queries.ts that does INSERT ON CONFLICT UPDATE for the cargo key-value table. Verify the exact function name by checking queries.ts exports.

**Step 3: Add artefact drop to pirate victory loot**

In `packages/server/src/engine/commands.ts` (lines 410-418), after `lootCrystal`:

```typescript
const lootArtefact = ((seed >>> 14) % 100) < 3 ? 1 : 0;  // 3% chance
return {
  outcome: 'victory',
  lootCredits,
  lootResources: { ore: lootOre, crystal: lootCrystal },
  lootArtefact,
  repChange: -3,
  xpGained: encounter.pirateLevel * 5,
};
```

Then in the combat handler in SectorRoom.ts where loot is applied, check for `lootArtefact`:
Find where `result.lootResources` is applied after battle and add:
```typescript
if ((result as any).lootArtefact) {
  await addCargoResource(auth.userId, 'artefact', (result as any).lootArtefact);
}
```

Note: The `BattleResult` type may need `lootArtefact?: number` added in types.ts.

**Step 4: Run tests**

```bash
cd packages/server && npx vitest run
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/scanEvents.ts packages/server/src/engine/commands.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: artefact drops — scan events (50%/8%), pirate loot (3%)"
```

---

### Task 5: Client State, Network & Mock

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts:209,218`
- Modify: `packages/client/src/network/client.ts:171,184,779`
- Modify: `packages/client/src/test/mockStore.ts:25,47`

**Step 1: Update gameSlice defaults**

In `packages/client/src/state/gameSlice.ts`:

Line 209 — cargo default:
```typescript
cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
```

Line 218 — storage default:
```typescript
storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
```

**Step 2: Update network/client.ts**

Line 171 — local scan log (add artefact if present):
```typescript
store.addLogEntry(`Local scan: Ore ${data.resources.ore}, Gas ${data.resources.gas}, Crystal ${data.resources.crystal}`);
```
No change — scan resources are `SectorResources` which has no artefact field.

Line 184 and 779 — discovery resource fallbacks:
```typescript
resources: { ore: 0, gas: 0, crystal: 0 }
```
No change — these are `SectorResources` (no artefact).

BUT check if there are cargo/storage fallbacks in client.ts that need updating. Search for CargoState and StorageInventory defaults in network/client.ts. If cargo defaults exist, add `artefact: 0`.

**Step 3: Update mockStore**

In `packages/client/src/test/mockStore.ts`:

Line 25 — defaultCargo:
```typescript
const defaultCargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
```

Line 47 — storage:
```typescript
storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
```

**Step 4: Run client tests**

```bash
cd packages/client && npx vitest run
```

**Step 5: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/test/mockStore.ts
git commit -m "feat: artefact client state defaults and mock store"
```

---

### Task 6: Client UI Components

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx:7-32,61,88-91`
- Modify: `packages/client/src/components/BaseScreen.tsx:64,135,146,178`
- Modify: `packages/client/src/components/TradeScreen.tsx:73,102,119,123`
- Modify: `packages/client/src/components/MiningScreen.tsx` (verify no changes needed)

**Step 1: Update CargoScreen**

In `packages/client/src/components/CargoScreen.tsx`:

Add artefact to `RESOURCE_ART` (line 7-32):
```typescript
artefact: {
  label: 'ARTEFAKT',
  icon: '\u273B',  // ❋
  color: '#FF6B35',
  dim: 'rgba(255, 107, 53, 0.5)',
},
```

Update cargo total (line 61):
```typescript
const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
```

Add artefact cargo bar after the SLATES bar (around line 91):
```tsx
<CargoBar label="ARTEFAKT" value={cargo.artefact} max={cargoCap} art={RESOURCE_ART.artefact} />
```

**Step 2: Update BaseScreen**

In `packages/client/src/components/BaseScreen.tsx`:

Update storage total (line 64):
```typescript
const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;
```

Update storage display (line 135):
```tsx
<div>ERZ: {storage.ore} &nbsp; GAS: {storage.gas} &nbsp; KRISTALL: {storage.crystal} &nbsp; ARTEFAKT: {storage.artefact}</div>
```

Update transfer buttons (line 146):
```typescript
{(['ore', 'gas', 'crystal', 'artefact'] as const).map((res) =>
```

Update cargo display (line 178):
```tsx
<div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal} &nbsp; ARTEFAKT: {cargo.artefact}</div>
```

**Step 3: Update TradeScreen**

In `packages/client/src/components/TradeScreen.tsx`:

Update cargo total (line 73):
```typescript
const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
```

Keep NPC trade buttons as ore/gas/crystal only (line 102):
```typescript
{(['ore', 'gas', 'crystal'] as ResourceType[]).map((res) =>
```
This will cause a TS error since `'ore'` etc. are now `MineableResourceType`. Fix:
```typescript
{(['ore', 'gas', 'crystal'] as const).map((res) =>
```

Update cargo display strings to add artefact (lines 119, 123):
```tsx
ERZ {cargo.ore} | GAS {cargo.gas} | KRISTALL {cargo.crystal} | ARTEFAKT {cargo.artefact}
```
```tsx
ERZ {storage.ore} | GAS {storage.gas} | KRISTALL {storage.crystal} | ARTEFAKT {storage.artefact}
```

Keep trade route dropdowns as ore/gas/crystal only (no artefact auto-trading).

**Step 4: Verify MiningScreen needs no changes**

MiningScreen uses `currentSector?.resources` (which is `SectorResources` — no artefact). Resource bars display sector yields. Mine buttons use `RESOURCE_TYPES` which stays `['ore','gas','crystal']`. No changes needed.

**Step 5: Run client tests**

```bash
cd packages/client && npx vitest run
```

**Step 6: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx packages/client/src/components/BaseScreen.tsx packages/client/src/components/TradeScreen.tsx
git commit -m "feat: artefact UI — cargo display, storage transfer, NPC trade exclusion"
```

---

### Task 7: Test Fixture Updates

**Files:**
- Modify: All test files with `CargoState` or `StorageInventory` literals

**Step 1: Update CargoState fixtures**

All CargoState literals need `artefact: 0`. Files:
- `packages/client/src/__tests__/CargoScreen.test.tsx` — lines 22, 75, 100
- `packages/client/src/__tests__/TradeScreen.test.tsx` — line 63 (cargo)
- `packages/client/src/__tests__/BaseScreen.test.tsx` — line 25
- `packages/server/src/engine/__tests__/commands-npc.test.ts` — line 9 (emptyCargo)
- `packages/server/src/engine/__tests__/structures.test.ts` — lines 8, 15, 23, 30, 36, 42

Pattern: find `slates: 0` or `slates: N` and add `, artefact: 0` after.
For structures.test.ts where CargoState might not have `slates`, add both `slates: 0, artefact: 0`.

**Step 2: Update StorageInventory fixtures**

All StorageInventory literals need `artefact: 0`. Files:
- `packages/client/src/__tests__/TradeScreen.test.tsx` — lines 39, 50, 75, 87, 99
- `packages/client/src/__tests__/BaseScreen.test.tsx` — line 61
- `packages/server/src/engine/__tests__/commands-trade.test.ts` — lines 5-6, 20, 42, 49, 74

Pattern: find `crystal: N }` in StorageInventory contexts and add `, artefact: 0`.

**Step 3: Run all tests**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

**Step 4: Fix any TS errors**

```bash
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/client/tsconfig.json
```

**Step 5: Commit**

```bash
git add -A
git commit -m "test: update fixtures for artefact resource field"
```

---

### Task 8: Final Verification & Polish

**Step 1: Run full test suite**

```bash
npm test
```

All packages should pass. Expected: 380+ tests across shared/server/client.

**Step 2: TypeScript check all packages**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/client/tsconfig.json
```

**Step 3: Fix any remaining issues found**

**Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: resolve artefact integration issues"
```

---

## Key Design Decisions

1. **`MineableResourceType` split** — avoids cascading changes to `SECTOR_RESOURCE_YIELDS`, `STRUCTURE_COSTS`, `NPC_PRICES`, and `SectorResources`. These records all stay typed with `MineableResourceType`.

2. **Artefact NOT in SectorResources** — sectors don't contain artefacts. Only obtained via events.

3. **Safe-slot protection** — artefacts NEVER lost in combat defeat. `cargoLost` in defeat handler excludes artefact.

4. **Seed-based drops** — scan events and combat use deterministic seed-based rolls (not `Math.random()`), matching existing codebase patterns for reproducibility.

5. **VALID_RESOURCES split** — replaced single `VALID_RESOURCES` array with `VALID_MINE_RESOURCES` and `VALID_TRANSFER_RESOURCES` in SectorRoom.ts for clear intent.

6. **NPC trade blocking** — explicit artefact check with German error message before generic resource check.

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | MineableResourceType, CargoState.artefact, StorageInventory.artefact |
| `packages/shared/src/constants.ts` | RESOURCE_TYPES type, Record types, ARTEFACT_DROP_CHANCES, ARTEFACT_COLOR/SYMBOL |
| `packages/shared/src/__tests__/artefact.test.ts` | New: artefact type tests |
| `packages/server/src/db/migrations/017_artefact_storage.sql` | New: storage_inventory.artefact column |
| `packages/server/src/db/queries.ts` | getPlayerCargo, getStorageInventory, safeCols |
| `packages/server/src/engine/commands.ts` | Allowlists, NPC trade blocking, combat safe-slot |
| `packages/server/src/engine/scanEvents.ts` | rewardArtefact drops |
| `packages/server/src/rooms/SectorRoom.ts` | VALID_RESOURCES split, cargo sums, scan event artefact reward |
| `packages/client/src/state/gameSlice.ts` | Default cargo/storage |
| `packages/client/src/network/client.ts` | Cargo fallbacks if any |
| `packages/client/src/test/mockStore.ts` | Default cargo/storage |
| `packages/client/src/components/CargoScreen.tsx` | RESOURCE_ART, cargo sum, artefact bar |
| `packages/client/src/components/BaseScreen.tsx` | Storage total, display, transfer buttons |
| `packages/client/src/components/TradeScreen.tsx` | Cargo total, NPC trade exclusion, display strings |
| Test fixtures (8+ files) | CargoState + StorageInventory literals |
