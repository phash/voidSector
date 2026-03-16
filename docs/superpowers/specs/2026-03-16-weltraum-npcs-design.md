# Weltraum-NPCs — Design Spec

**Issue:** #501
**Date:** 2026-03-16
**Status:** Draft

---

## Overview

NPC spaceships fly through the game world, visible on radar, interactable, and integrated into the quest system. Three NPC roles: TRADE (green), MILITARY (blue), OUTLAW (red). They extend the existing `civ_ships` infrastructure.

---

## 1. Data Model

### civ_ships Table Extension (Migration 076)

```sql
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'drone';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS name VARCHAR(60) DEFAULT '';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '{}';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS patrol_state JSONB DEFAULT '{}';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS dead_until TIMESTAMPTZ DEFAULT NULL;

-- Allow quest_item in inventory table
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_item_type_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_item_type_check
  CHECK (item_type IN ('resource', 'module', 'blueprint', 'prisoner', 'data_slate', 'quest_item'));
```

- `role`: `'drone'` (existing), `'trader'`, `'military'`, `'outlaw'` — **this is the dispatch field** (not `ship_type`)
- `level`: NPC strength 1-10 (OUTLAW combat, scanner visibility threshold)
- `name`: Display name (deterministic from seed, e.g. "Händler Voss-3")
- `inventory`: TRADE/OUTLAW cargo `{ore: N, gas: N, crystal: N, artefact?: N}`
- `patrol_state`: State machine context per role:
  - TRADE: `{targetX, targetY, waitTicks, stationName}`
  - MILITARY: `{leg, borderX, borderY, stepsLeft, direction}`
  - OUTLAW: `{anchorX, anchorY, roamRadius, skipTick}` — `skipTick` toggles 0/1 for half-speed
- `dead_until`: OUTLAW respawn timer, NULL = alive

### Type Changes (shared/types.ts)

```ts
// Extend CivShip interface (NOT CivShipType — role is a separate field)
interface CivShip {
  // ... existing fields ...
  role: 'drone' | 'trader' | 'military' | 'outlaw';
  level: number;
  name: string;
  inventory: Record<string, number>;
  patrol_state: Record<string, any>;
  dead_until?: string | null;
}

// New faction
type NpcFactionId = 'traders' | 'scientists' | 'pirates' | 'ancients' | 'independent' | 'outlaws';

// New objective types added to QuestObjectiveType union
type QuestObjectiveType = QuestType | 'bounty_trail' | 'bounty_combat' | 'bounty_deliver'
  | 'scan_deliver' | 'find_npc' | 'deliver_to_npc';
```

### Quest Objective Extension

```ts
interface QuestObjective {
  // ... existing fields ...
  targetNpcId?: number;      // civ_ships.id
  targetNpcRole?: string;    // 'trader' | 'military' | 'outlaw'
  targetNpcName?: string;    // display name
  cargoItem?: string;        // 'news' | 'package' | 'npc_data'
}
```

### NPC Quest Offer Message

```ts
interface NpcQuestOffer {
  npcId: number;
  npcName: string;
  dialogText: string;         // NPC speech before quest offer
  quest: AvailableQuest;      // standard quest structure, can be accepted directly
}
```

---

## 2. Movement AI

All NPCs move 1 sector per tick (5s) via extended `processCivTick()`. Each role has a pure state-machine function. **Dispatch is on `ship.role`** (not `ship_type`).

### TRADE NPCs

State: `idle` → `traveling` (to target station) → `idle` (wait 5 ticks) → `traveling` (new station) → ...

- Target selection: query `getStationsInRange(x, y, 1000)` — new query returning NPC stations within Manhattan distance
- Movement: `stepToward()` (existing, 1 sector/tick, diagonal allowed)
- Inventory refills at stations (reset to random stock), depletes through player trades
- `patrol_state`: `{targetX, targetY, waitTicks, stationName}`

### MILITARY NPCs

State: `idle` → `traveling` (to quadrant border) → `patrol` (50 steps along border) → `returning` (to station) → `idle` → ...

- `patrol_state.leg`: `'to_border'` | `'patrol'` | `'return'`
- Border coordinates: quadrant edges are at absolute coords `qx * QUADRANT_SIZE` to `qx * QUADRANT_SIZE + QUADRANT_SIZE - 1`. Border patrol targets the min/max row or column of the quadrant.
- `patrol_state`: `{leg, borderX, borderY, stepsLeft, direction: 'h'|'v'}`

### OUTLAW NPCs

State: `idle` → `roaming` (random within roamRadius around anchor)

- Prefer nebula/asteroid sectors (70% chance to target these if in radius)
- `roamRadius`: 8 sectors from spawn point
- Effective speed: 0.5 sectors/tick — `patrol_state.skipTick` toggles 0/1 each tick; move only when `skipTick === 0`
- On death: `dead_until = NOW() + 2h`, filtered from broadcasts until respawn
- `patrol_state`: `{anchorX, anchorY, roamRadius, skipTick}`

### Dispatch in processCivTick()

```ts
function nextShipState(ship: CivShip): Partial<CivShip> {
  if (ship.dead_until && new Date(ship.dead_until) > new Date()) return {}; // dead, skip
  switch (ship.role) {
    case 'trader': return nextTraderState(ship);
    case 'military': return nextMilitaryState(ship);
    case 'outlaw': return nextOutlawState(ship);
    default: return nextDroneState(ship); // existing drone logic
  }
}
```

---

## 3. Spawning

### Quadrant Zones

| Zone | Condition (max(abs(qx), abs(qy))) | MILITARY | OUTLAW | TRADE |
|------|-------------------------------------|----------|--------|-------|
| Inner | ≤ 3 | 3 | 2 | 4 |
| Middle | 4–7 | 6 | 6 | 4 |
| Outer | ≥ 8 | 12 | 2 | 4 |

### Lazy Spawn (SectorRoom join)

When first player enters a quadrant: `ensureQuadrantNpcs(qx, qy)` checks existing NPC count and spawns missing ones.

- MILITARY: start at NPC station or quadrant center, level = zone-based (2/4/6)
- TRADE: start at random station, level = 1
- OUTLAW: start at random nebula/asteroid sector, level = random (zone-scaled 1-3/2-5/3-7)
- Names: `generateNpcName(role, seed)` — deterministic from coordinates

### Strategic Tick Respawn (60s)

- OUTLAW with `dead_until < NOW()`: reset `dead_until = NULL`, pick new spawn point in quadrant
- Under-populated quadrants (for rooms with active players): fill to target count
- New quadrant conquest: immediately spawn 12 MILITARY, TRADE+OUTLAW follow next tick

---

## 4. Visibility & Radar

### Icons

| Type | Color | Symbol | Visible |
|------|-------|--------|---------|
| TRADE | `#00FF66` | ▶ triangle | Always |
| MILITARY | `#4488FF` | ◇ diamond (existing combat style) | Always |
| OUTLAW | `#FF3333` | ✕ cross | Only when revealed |

### OUTLAW Reveal Rules

- Local scan in same sector → revealed
- Area scan when player scanner level > outlaw level → revealed in adjacent sectors
- Revealed status stored in `SectorRoom.revealedOutlaws: Map<string, Set<number>>` (sessionId → Set of npcIds)
- Cleaned up in `onLeave()` handler
- Resets on quadrant change (new room)

### Broadcast Filtering

The existing `civShipBus` handler in SectorRoom changes from `this.broadcast()` to per-client `client.send()`:

```ts
// Before (room-wide):
this.broadcast('civ_ships_tick', ships);

// After (per-client filtered):
for (const client of this.clients) {
  const revealed = this.revealedOutlaws.get(client.sessionId) ?? new Set();
  const visible = ships.filter(s =>
    s.role !== 'outlaw' || revealed.has(s.id)
  );
  client.send('civ_ships_tick', visible);
}
```

Dead OUTLAWs (`dead_until` in the future) are also filtered out in `processCivTick()` before broadcasting.

---

## 5. Interaction (DetailPanel)

When player is in the same sector as an NPC, a block appears in the DetailPanel showing NPC name, type, faction, and action buttons.

### Interaction Matrix

| Action | TRADE | MILITARY | OUTLAW |
|--------|-------|----------|--------|
| [HANDELN] | always | — | NEUTRAL+ rep |
| [KOMMUNIZIEREN] | always | always | NEUTRAL+ rep |
| [ANGREIFEN] | — | — | always |
| Auto-ambush | — | — | HOSTILE rep (70% on scan) |

### Validation Guards (all handlers)

Every NPC interaction handler must validate before processing:
1. NPC exists in DB and `dead_until IS NULL`
2. NPC is in the same sector as the player (`ship.x === playerX && ship.y === playerY`)
3. Rate limit (1000ms per action)

On failure: `{ code: 'NPC_FAIL', message: '...' }`

### Trade with TRADE NPCs

- Resources only: ore, gas, crystal
- Price: `basePrice * (1 + min(0.5, distanceToStation / 500))` — up to 50% bonus in deep space
- `distanceToStation`: Manhattan distance from NPC position to nearest NPC station (cached in `patrol_state`)
- NPC inventory: 20-50 ore, 10-30 gas, 5-15 crystal (refills at stations)
- Capacity limit: 100 per resource

### Trade with OUTLAW NPCs (NEUTRAL+ rep)

- Same mechanics as TRADE but 20% discount (black market)
- Artefacts in inventory with 30% chance
- Server handler: `NpcShipService.handleNpcShipTrade()`

### Quest Communication

[KOMMUNIZIEREN] triggers `checkQuestProgress(client, userId, 'communicate_npc', { npcId })`:
- `find_npc` objectives: matched when `obj.targetNpcId === context.npcId`, marked fulfilled
- `deliver_to_npc` objectives: same match + checks `cargoItem` in inventory via `getInventoryItem()`, removes it, marks fulfilled
- NPC can offer follow-up quest via `npcQuestOffer` message (payload: `NpcQuestOffer` interface)

### OUTLAW Auto-Ambush

Integrated into `ScanService.handleLocalScan()` after existing scan event checks:
- If OUTLAW in sector AND player outlaws-rep tier === `'hostile'`: 70% chance to trigger
- Creates combat encounter via `CombatService.handleCombatV2Start()` with `npcId` context
- Same flow as pirate ambush but with OUTLAW stats

---

## 6. Combat (OUTLAW)

### Trigger

- Manual: [ANGREIFEN] button in DetailPanel → `sendAttackNpc(npcId)`
- Automatic: HOSTILE rep scan in OUTLAW sector (via ScanService integration, 70% chance)

### Mechanics

Reuses Combat V2 system (`combatV2Engine.ts`):
- `pirateLevel = outlaw.level`
- `canNegotiate = true` if rep ≥ UNFRIENDLY
- Same round-based flow: tactic, special actions, flee

### Consequences

- **Victory:** Credits + resource loot, outlaw `dead_until = NOW() + 2h`, +5 outlaws rep
- **Defeat:** Lose cargo (like pirates)
- **Flee/Negotiate:** No lasting consequence
- Bounty quest combat: if quest objective `bounty_combat` has matching `targetNpcId`, victory fulfills it + gives `prisoner` item

---

## 7. NPC Quests

### New Quest Templates

| Template | Objective Type | Flow |
|----------|---------------|------|
| `traders_courier` | `deliver_to_npc` | Station → find TRADE NPC → deliver NEWS → return to station |
| `traders_escort_info` | `find_npc` | Station → find TRADE NPC → communicate → return with INFO |
| `scientists_npc_data` | `find_npc` | Station → find MILITARY NPC → get scan data → return |
| `outlaws_contact` | `deliver_to_npc` | Station → find OUTLAW NPC → deliver package → follow-up quest |
| `outlaws_bounty_npc` | `bounty_chase` | Station → trail → find OUTLAW → combat → prisoner → return |

### NPC Position Tracking

`getTrackedQuests()` in `queries.ts` is extended: when an objective has `targetNpcId`, the function performs a secondary lookup `SELECT x, y FROM civ_ships WHERE id = $1` and returns these as `targetX`/`targetY`. This means the tracked quest target updates as the NPC moves.

### New Cargo Items

`ItemType = 'quest_item'` (added to inventory constraint in migration 076): `'news'`, `'package'`, `'npc_data'`
- Created in inventory on quest accept via `addToInventory(playerId, 'quest_item', itemId, 1)`
- Removed on delivery to NPC or quest expiry cleanup

---

## 8. New Service: NpcShipService

20th domain service, registered in `ServiceContext` interface and instantiated in `SectorRoom.onCreate()`.

### Handlers

| Message | Handler | Purpose |
|---------|---------|---------|
| `npcShipTrade` | `handleNpcShipTrade(client, {npcId, resource, amount, action})` | Buy/sell with TRADE/OUTLAW |
| `communicateNpc` | `handleCommunicateNpc(client, {npcId})` | Quest delivery + dialog |
| `attackNpc` | `handleAttackNpc(client, {npcId})` | Initiate combat with OUTLAW |

### Integration Points

| Service | Change |
|---------|--------|
| `ScanService` | After local scan: query OUTLAWs in sector → add to `revealedOutlaws`, send updated `civ_ships_tick` to client |
| `ScanService` | After area scan: query OUTLAWs in range where scanner > level → add to `revealedOutlaws` |
| `ScanService` | OUTLAW ambush check in `handleLocalScan()` after scan events |
| `QuestService` | New action `'communicate_npc'` in `checkQuestProgress()` matching `find_npc` and `deliver_to_npc` |
| `CombatService` | `handleCombatV2Start()` accepts optional `npcId`; on victory sets `dead_until` on the NPC |
| `NavigationService` | On sector enter (`moveSector`, `jump`): query NPCs at new sector → send `npcsInSector` message |

### Client Changes

| File | Change |
|------|--------|
| `gameSlice.ts` | New state: `sectorNpcs: CivShip[]` |
| `DetailPanel.tsx` | Render NPC interaction block when `sectorNpcs.length > 0` |
| `RadarRenderer.ts` | New icon branches for `role === 'trader' / 'military' / 'outlaw'` |
| `client.ts` | Handlers: `npcsInSector`, `npcTradeOffer`, `npcQuestOffer`, `npcCombatResult` |
| `client.ts` | Senders: `sendNpcShipTrade()`, `sendCommunicateNpc()`, `sendAttackNpc()` |

### Tick Integration

| Tick | New Logic |
|------|-----------|
| Universe (5s) | `processCivTick()` extended: dispatch on `ship.role`, new AI functions, filter dead OUTLAWs |
| Strategic (60s) | `ensureQuadrantNpcs()` for respawn + rebalancing active rooms |

---

## 9. HelpSlices

Per project rules, new features need HelpSlice onboarding:

| ID | Trigger | Content |
|----|---------|---------|
| `first_npc_trade` | First encounter with TRADE NPC in sector | Explains trading with mobile NPCs, price bonuses in deep space |
| `first_npc_outlaw` | First OUTLAW revealed by scan | Explains OUTLAW mechanics: reputation, combat, black market trade |
| `first_npc_military` | First MILITARY NPC in sector | Explains patrols, communication |
| `first_npc_quest` | First NPC quest accepted | Explains find/deliver mechanics, moving targets |

---

## 10. New DB Queries (civQueries.ts)

| Function | Purpose |
|----------|---------|
| `getNpcShipsInSector(x, y)` | All alive NPCs at coordinates (for DetailPanel) |
| `getNpcShipById(id)` | Single NPC by ID (for interaction validation) |
| `getAliveNpcsByRole(qx, qy, role)` | Count/list for spawn balancing |
| `getStationsInRange(x, y, maxDist)` | NPC stations within Manhattan distance (TRADE target selection) |
| `updateNpcShip(id, fields)` | Update position + state + inventory + dead_until |
| `spawnNpcShip(data)` | Insert new NPC with role, level, name, position |
| `resetDeadOutlaws()` | Set `dead_until = NULL` where `dead_until < NOW()` |
| `getNpcPosition(npcId)` | x, y for quest tracking (called by `getTrackedQuests`) |

---

## 11. Migration Summary

| # | Purpose |
|---|---------|
| 076 | civ_ships: role, level, name, inventory, patrol_state, dead_until; inventory constraint adds quest_item |
| 077 | outlaws faction: ensure reputation system accepts 'outlaws' (no table changes needed — `player_reputation` rows are created on first rep change) |

Note: Migration 077 may be a no-op since the reputation system auto-creates rows. Kept as placeholder for any outlaws-specific config constants.

---

## 12. Files Affected

### New Files
- `packages/server/src/rooms/services/NpcShipService.ts`
- `packages/server/src/engine/npcShipAI.ts` (pure state machine functions: nextTraderState, nextMilitaryState, nextOutlawState)
- `packages/server/src/engine/npcNamegen.ts` (deterministic name generation)
- `packages/server/src/db/migrations/076_npc_ships.sql`
- `packages/server/src/db/migrations/077_outlaws_faction.sql`

### Modified Files
- `packages/shared/src/types.ts` — CivShip interface (role, level, name, inventory, patrol_state, dead_until), NpcFactionId (+outlaws), QuestObjectiveType (+find_npc, deliver_to_npc), QuestObjective (+targetNpcId, cargoItem), NpcQuestOffer interface
- `packages/shared/src/constants.ts` — NPC_SPAWN_COUNTS, NPC_TRADE_PRICES, OUTLAW_COMBAT_STATS, NPC_NAMES
- `packages/server/src/engine/civShipService.ts` — dispatch on `ship.role` to new AI functions in processCivTick
- `packages/server/src/engine/npcShipAI.ts` — (new) pure state machine functions
- `packages/server/src/engine/questTemplates.ts` — 5 new NPC quest templates
- `packages/server/src/engine/questgen.ts` — NPC quest generation with targetNpcId selection
- `packages/server/src/engine/strategicTickService.ts` — ensureQuadrantNpcs(), resetDeadOutlaws()
- `packages/server/src/rooms/SectorRoom.ts` — message registration, lazy spawn on join, per-client broadcast filter, revealedOutlaws map, cleanup on leave
- `packages/server/src/rooms/services/ServiceContext.ts` — add NpcShipService to interface + constructor
- `packages/server/src/rooms/services/ScanService.ts` — OUTLAW reveal on local/area scan, ambush trigger
- `packages/server/src/rooms/services/QuestService.ts` — communicate_npc action in checkQuestProgress
- `packages/server/src/rooms/services/CombatService.ts` — accept npcId, set dead_until on OUTLAW victory
- `packages/server/src/rooms/services/NavigationService.ts` — send npcsInSector on sector enter
- `packages/server/src/db/civQueries.ts` — 8 new query functions (see section 10), extend updateShip for new fields
- `packages/server/src/db/queries.ts` — getTrackedQuests NPC position lookup
- `packages/client/src/state/gameSlice.ts` — sectorNpcs state + setter
- `packages/client/src/state/helpSlice.ts` — 4 NPC HelpSlice entries
- `packages/client/src/components/DetailPanel.tsx` — NPC interaction block
- `packages/client/src/canvas/RadarRenderer.ts` — new icon rendering for trader/military/outlaw by role
- `packages/client/src/network/client.ts` — handlers + senders for NPC interaction messages
