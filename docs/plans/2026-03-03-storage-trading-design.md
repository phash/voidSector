# Storage, Trading & Credits — Design

**Date:** 2026-03-03
**Status:** Approved
**Phase:** 2 completion (Roadmap: "Home-Base Bau: Lager" + Phase 3: "Marktplatz-System")

## 0. Bugfix: DetailPanel Scan Update

**Problem:** `localScanResult` handler in `network/client.ts` updates `currentSector` but NOT the `discoveries` record. DetailPanel reads from `discoveries[key]`, so scanned resources don't appear after scanning.

**Fix:** When `localScanResult` arrives, also patch the matching entry in `discoveries` with the resource data. If no entry exists yet, create one from `currentSector`.

## 1. Credits (In-Game Currency)

- New `credits INTEGER DEFAULT 0` column on `players` table (migration 006)
- Credits earned by selling resources at Trading Posts
- Credits spent buying resources or upgrading structures
- Exposed to client via existing `playerData` sync or new message
- PlayerData type gets `credits?: number` field
- Store gets `credits` state + `setCredits` action

## 2. Storage Building

**Type:** New structure type `storage` in `StructureType` union.

**Mechanics — Transfer Model:**
- Storage is a separate inventory pool at the player's home base sector
- Player manually transfers cargo <-> storage via BASE-LINK monitor UI
- Transfer only possible when player is at home base sector

**Tiers (upgrade system):**
| Tier | Capacity | Upgrade Cost |
|------|----------|-------------|
| 1    | 50 units | 0 (build cost via existing AP) |
| 2    | 150 units | 200 credits |
| 3    | 500 units | 1000 credits |

**DB:**
- `structures` table gets `tier INTEGER DEFAULT 1` column (migration 006)
- New `storage_inventory` table: `owner_id, ore, gas, crystal` (like cargo but for storage)

**Messages:**
- `transferToStorage { resource, amount }` — move from cargo to storage
- `transferFromStorage { resource, amount }` — move from storage to cargo
- `upgradeStructure { structureId }` — upgrade tier (auto-deducts credits)

## 3. Trading Post Building

**Type:** New structure type `trading_post` in `StructureType` union.

**3 Tiers with expanding functionality:**

### Tier 1 — NPC Trade (Soforthandel)
- Build at home base (same as storage, 1 per player)
- Fixed NPC buy/sell prices per resource (spread ~20%)
- Instant transactions, no other players needed
- NPC prices defined in shared constants

### Tier 2 — Player Orders (Marktplatz)
- Upgrade cost: 500 credits
- Players can place buy/sell orders visible to all Tier 2+ Trading Posts
- Orders: `{ resource, amount, pricePerUnit, type: 'buy'|'sell' }`
- Order matching: manual accept (no auto-match)
- `trade_orders` DB table

### Tier 3 — NPC Traders (Automatisiert)
- Upgrade cost: 3000 credits
- NPC traders periodically buy/sell from player orders
- Provides passive income / resource flow
- `npc_traders` config per Trading Post

**NPC Base Prices (constants):**
```
ore:     10 credits/unit
gas:     15 credits/unit
crystal: 25 credits/unit
```

Buy spread: player buys at 120% base price
Sell spread: player sells at 80% base price

## 4. TRADE Monitor

- New monitor ID `TRADE` in shared constants
- Shows in sidebar + main monitor arrays
- UI sections:
  - NPC Trade: buy/sell buttons with price display
  - My Orders (Tier 2+): list of active orders
  - Market (Tier 2+): browse all orders
  - NPC Traders (Tier 3): status display

## 5. BASE-LINK Additions

- Storage section: shows inventory, transfer buttons (only at home base)
- Building section: add storage + trading_post to buildable structures
- Upgrade button for tier progression

## Architecture Notes

- All trades require player to be at home base sector (same constraint as building)
- Trading Post and Storage are per-player buildings (1 each at home base)
- Credits never go negative (server validates)
- NPC prices are constants, not DB-driven (YAGNI — dynamic prices later if needed)
- Tier 3 NPC traders are a stretch goal — implement Tier 1+2 first, Tier 3 can follow
