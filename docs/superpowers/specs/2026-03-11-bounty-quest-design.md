# Kopfgeld-Quest System — Design Spec

**Issue:** #268
**Date:** 2026-03-11
**Status:** Approved

---

## Goal

Implement a `bounty_chase` quest type where players track a named pirate across a pre-determined trail of sectors, fight an exclusive (player-only) encounter at the end, capture the target as a prisoner item, and return to the origin station to collect the reward.

---

## Architecture

### Approach

New quest template type `bounty_chase` within the existing `QuestService`. No new DB tables or migrations needed. Trail state is stored in the existing `objectives` JSONB column of `player_quests`.

### Shared Type Changes Required

`packages/shared/src/types.ts` must be updated and rebuilt (`npm run build` in `packages/shared`):

- **`QuestType`** union: add `'bounty_chase' | 'bounty_trail' | 'bounty_combat' | 'bounty_deliver'`
- **`ItemType`** union: add `'prisoner'`

### Trail Generation Hookpoint

Trail generation (trail coords, target name, target level) happens inside `QuestService.handleAcceptQuest()` after template lookup, before DB insert — not in `questgen.ts`. The `questgen.ts` generates available quest templates at stations; the per-player trail is generated at accept time in `QuestService`.

### Files to Create/Modify

| File | Change |
|------|--------|
| `packages/server/src/engine/questTemplates.ts` | Add `bounty_chase` template type |
| `packages/server/src/engine/questgen.ts` | Generate trail + target name on quest accept |
| `packages/server/src/engine/bountyNameGen.ts` | **New** — Sci-Fi name generator |
| `packages/server/src/rooms/services/QuestService.ts` | Handle `bounty_trail`, `bounty_combat`, `bounty_deliver` objectives |
| `packages/server/src/rooms/services/ScanService.ts` | Check for active bounty_chase quest on scan, trigger exclusive spawn |
| `packages/server/src/rooms/services/CombatService.ts` | On bounty combat victory: add prisoner to inventory, mark objective |
| `packages/client/src/components/QuestDetailPanel.tsx` | Add `WantedPoster` component, layout B (poster left / info right) |
| `packages/shared/src/types.ts` | Add `'bounty_chase' \| 'bounty_trail' \| 'bounty_combat' \| 'bounty_deliver'` to `QuestType` union; add `'prisoner'` to `ItemType` union; add objective interfaces |

---

## Data Model

### Quest Objectives JSONB

Three sequential objectives stored in `player_quests.objectives`:

```typescript
// Objective 1: Follow the trail
{
  type: 'bounty_trail',
  trail: [
    { x: 5, y: 8, hint: "Zyr'ex Korath hat S 5:8 Richtung S 5:7 verlassen." },
    { x: 5, y: 7, hint: "Das Ziel ist in der Nähe!" }
  ],
  currentStep: 0,       // index into trail[], incremented on each matching scan
  targetName: "Zyr'ex Korath",
  targetLevel: 4,
  fulfilled: false
}

// Objective 2: Fight the target
{
  type: 'bounty_combat',
  sectorX: 7,
  sectorY: 7,
  targetName: "Zyr'ex Korath",
  targetLevel: 4,
  fulfilled: false
}

// Objective 3: Return prisoner to station
{
  type: 'bounty_deliver',
  stationX: 10,
  stationY: 15,
  fulfilled: false
}
```

### Prisoner Inventory Item

On combat victory, a prisoner item is added to the player's inventory using the existing `inventory` table — no migration needed:

```
item_type: 'prisoner'
item_id:   <questId>
quantity:  1
```

Removed from inventory on quest completion (`bounty_deliver` fulfilled).

---

## Trail Generation

Generated deterministically at quest acceptance time using `hashCoords(stationX, stationY, dayOfYear + BOUNTY_TRAIL_SALT)`.

### Trail Length by Level

| Level | Trail Steps | Final Sector Distance |
|-------|------------|----------------------|
| 1–2   | 2          | 3–5 sectors from station |
| 3–4   | 3          | 5–10 sectors from station |
| 5+    | 4          | 10–20 sectors from station |

### Direction

- Start sector: seeded direction from quest station, within trail-length range
- Each subsequent step: 1–4 sectors in a roughly consistent direction (±45° variance)
- Final sector (combat): 1–3 sectors beyond last trail step

### Hint Vagheit by Level

| Level | Hint Quality | Example |
|-------|-------------|---------|
| 1–2   | Exact next sector | `"Hat S 5:8 Richtung S 5:7 verlassen."` |
| 3–4   | Approximate (X exact, Y obscured) | `"Spur endet irgendwo nördlich von S 5:x."` |
| 5+    | Quadrant only | `"Letzte bekannte Position: Quadrant 1:2."` |

**Wrong sector scan:** Returns `"Keine Spur gefunden."` — no trail progress, no step consumed.

---

## Exclusive Spawn Mechanic

### Current System

`ScanService.handleLocalScan()` calls `checkScanEvent(x, y, env)` which is deterministic per sector — all players see the same event in the same sector.

### Bounty Override

When a player scans a sector:

1. `ScanService` checks: does this player have an active `bounty_chase` quest where `bounty_combat.sectorX/Y` matches the scanned sector AND `bounty_trail.fulfilled === true`?
2. **Yes** → skip `checkScanEvent()`, send `bountyAmbush` message with `{ targetName, targetLevel }` from the quest objective
3. **No** → normal scan event flow

Redis deduplication key: `bounty_spawn:{playerId}:{questId}` (TTL 3600s) — prevents re-triggering if the player leaves and re-enters the sector without fighting.

### Combat Resolution

- Combat proceeds through the existing `CombatService` (same energy system)
- Enemy stats generated via `generateEnemyModules('pirate', targetLevel)` (existing signature: `enemyType: string, enemyLevel: number`)
- On **victory**: `addToInventory(playerId, 'prisoner', questId, 1)`, mark `bounty_combat.fulfilled = true`
- On **defeat/fled**: Redis key remains, player can retry on next scan

---

## Quest Progress Flow

```
acceptQuest(bounty_chase)
  → generate trail, targetName, targetLevel
  → insert player_quest with 3 objectives

Scan trail sector N (matching currentStep, NOT the combat sector)
  → checkQuestProgress('scan', {x, y})
  → trail.currentStep++, update hint in questProgress message
  → if currentStep === trail.length: mark bounty_trail.fulfilled = true
  Note: bounty_trail only matches trail coords; combat sector coord is
  exclusively in bounty_combat and handled separately by ScanService.

Scan final combat sector (bounty_trail.fulfilled === true)
  → ScanService detects bounty override (skips checkQuestProgress for this scan)
  → send bountyAmbush

CombatService.handleCombatResult(victory)
  → addToInventory('prisoner', questId)
  → checkQuestProgress('battle_won', {x, y})
  → mark bounty_combat.fulfilled = true

Arrive at origin station (with prisoner in inventory)
  → checkQuestProgress('arrive', {x, y})   // uses existing 'arrive' action string
  → remove prisoner from inventory
  → mark bounty_deliver.fulfilled = true
  → award rewards, send questComplete   // existing message
```

---

## Sci-Fi Name Generator

New file `packages/server/src/engine/bountyNameGen.ts`. Syllable-based, seeded by `hashCoords(stationX, stationY, day + BOUNTY_NAME_SALT)`.

```typescript
const PREFIXES = ["Zyr'", "Vel'", "Kael", "Dra", "Xan", "Mor'", "Thal", "Ix"];
const MIDS    = ["ex", "an", "dran", "ix", "aen", "ven", "kar"];
const LASTS   = ["Korath", "Skaros", "Veth", "Arix", "Moor", "Drath", "Xen"];
```

Result: `{PREFIX}{MID} {LAST}` → e.g., `"Zyr'ex Korath"`, `"Vel'dran Arix"`

Exported pure function `generateBountyName(seed: number): string` — easily testable.

---

## Client UI

### QuestDetailPanel — Layout B

For `bounty_chase` quests, `QuestDetailPanel` renders a `WantedPoster` component:

```
┌─────────────────────────────────┐
│ ◈ QUEST-DETAIL          AKTIV  │
├─────────────────────────────────┤
│ ┌──────────┐  ZYR'EX KORATH    │
│ │  WANTED  │  Typ: Pirat Kl.IV │
│ │  ◉_◉    │  Von: Station ALPHA│
│ │ ZYR'EX   │  Belohnung: 12.5k¢│
│ │  KORATH  │  XP: +240         │
│ │ 12.500 ¢ │                   │
│ │ LVL4 ████│                   │
│ └──────────┘                   │
│ ◈ HINWEIS                      │
│ Hat S 5:8 Richtung S 5:7...    │
├─────────────────────────────────┤
│ ✓ Sektor 5:8 untersuchen       │
│ ▶ Sektor 5:7 untersuchen       │
│ ○ Ziel ausschalten             │
│ ○ Gefangenen abliefern         │
└─────────────────────────────────┘
```

The hint updates live via the existing `questProgress` WebSocket message.

The `bounty_chase` type is detected client-side via the `Quest.objectives[0].type === 'bounty_trail'` check (the existing `Quest` type exposes `objectives` as the raw JSONB array). No additional `questType` field needed on the client.

### QuestJournal

In the quest list, `bounty_chase` quests show:
- Quest title: `"Kopfgeld: Zyr'ex Korath"`
- Level badge: `[LVL 4]` in red
- Current objective summary beneath

---

## Network Messages

| Message | Direction | Purpose |
|---------|-----------|---------|
| `bountyAmbush` | Server→Client | Triggers exclusive pirate encounter at final sector |
| `questProgress` | Server→Client | Updated hint text after each trail scan |
| `questComplete` | Server→Client | Reuses existing completion message on delivery |

---

## Error Handling

- **Player leaves combat sector without fighting:** Redis TTL keeps spawn slot alive for 1h; re-scan re-triggers `bountyAmbush`
- **Quest expires while prisoner in inventory:** Prisoner item removed via expiry cleanup (existing quest expiry handler extended)
- **Player dies (permadeath):** Prisoner item lost with cargo; quest must be re-accepted
- **Player manually abandons quest:** `handleAbandonQuest` must call `removeFromInventory(playerId, 'prisoner', questId, 1)` if `bounty_combat.fulfilled === true` (prisoner already captured). Extend existing `handleAbandonQuest` in `QuestService`.

---

## Testing

- Unit tests for `generateBountyName` (pure function, seeded)
- Unit tests for trail generation (length, direction, hint vagheit per level)
- Integration test: accept → scan trail → scan combat sector → `bountyAmbush` triggered
- Integration test: combat victory → prisoner in inventory → deliver → quest complete

---

## Out of Scope (Follow-up Issues)

- **Scan quests → Data Slates:** Physical item created on scan, must be returned to station
- **Cargo quests → Cargo-Space requirement:** Require available cargo capacity, complete only on delivery to station
