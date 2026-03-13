# Mining Screen Improvements — Issue #293

## Problem

1. **Resource bars don't update live** — MiningScreen shows `currentSector.resources` which only refreshes after mining stops + new scan. Players see stale values during mining.
2. **Detail panel is useless** — MiningDetailPanel (Sec 3) shows redundant resource numbers and generic sector artwork. No value beyond what the main monitor already shows.

## Solution

### 1. Live Resource Bars (MiningScreen — Sec 2)

Client-side countdown of resource bars during active mining. Only the actively-mined resource bar counts down; other resource bars stay at their `currentSector.resources` values.

**Implementation:**
- When `mining.active && mining.startedAt`, calculate displayed resource amount for the mined resource:
  ```
  elapsed = (Date.now() - mining.startedAt) / 1000
  mined = Math.floor(elapsed * mining.rate)
  capped = Math.min(mined, mining.sectorYield, remainingCargoSpace)
  displayedAmount = sectorResource - capped
  ```
- Clamped by both `mining.sectorYield` and remaining cargo space (`cargoCap - cargoTotal`) to match server-side `calculateMinedAmount()` logic
- Update via existing 200ms interval (matches progress bar tick in MiningScreen lines 30-46)
- Clamp to 0 minimum
- Optional: CSS blink/flash on the ResourceBar when value decreases
- On mining stop: server sends `sectorData` with real depleted values (new behavior — see Edge Cases)

**Files changed:**
- `packages/client/src/components/MiningScreen.tsx` — ResourceBar calculation + blink effect

### 2. Mining Detail Panel Rebuild (MiningDetailPanel — Sec 3)

Complete replacement of current panel content when mining is active.

**Layout (top to bottom):**

#### a) Mining CRT Artwork (~8-10 lines ASCII)
Resource-specific animated ASCII art:
- **Ore**: Drill/pickaxe hammering into asteroid
- **Gas**: Extraction nozzle with particle clouds
- **Crystal**: Laser cutting through crystal formation

Animation: 2-3 frames rotating on a timer (~500ms), same pattern as existing SectorArtwork.

#### b) Story Fragment
Douglas-Adams-style text block in CRT terminal aesthetic. 2-4 sentences per fragment. Fade-in CSS animation when a new fragment appears.

#### c) Progress Indicator
Subtle footer: `[FRAGMENT 7/82]` or chapter-based label like `[KAPITEL 2 — DER VOGONE]`

#### d) Idle State
When mining inactive but story has started: show last unlocked fragment + artwork, with hint text: `MINE TO CONTINUE THE STORY...`

**Files changed:**
- `packages/client/src/components/MiningDetailPanel.tsx` — complete rewrite
- `packages/client/src/components/MiningArtwork.tsx` — new: animated ASCII art per resource type

### 3. Story System

**Content:** "The Hitchhiker's Guide to Mining" — a fictional entry from a galactic mining handbook. Absurd bureaucracy in space, philosophizing machines, answers nobody understands. ~80-100 handwritten fragments.

**Story file:**
- `packages/client/src/data/miningStory.ts` — array of story fragments with optional chapter titles

**Persistence:**
- New column `mining_story_index INTEGER NOT NULL DEFAULT 0` on `players` table — Migration **058**
- Redis key `mining:story:{playerId}` — tracks `totalMinedSinceLastFragment` (volatile, survives session but not Redis restart — acceptable since it only loses partial progress toward next fragment)

**Trigger:** Every **10 mined units** → next fragment unlocked. Uses `result.mined` (actual amount transferred to cargo) as the counter input.

**Flow:**
1. Mining stops → server gets `result.mined` from `stopMining()`
2. Server adds `result.mined` to Redis counter `totalMinedSinceLastFragment`
3. While counter ≥ 10: increment `mining_story_index` in DB, subtract 10 from counter
4. If index changed: send `miningStoryUpdate` message to client

**Story progress must be tracked in ALL three mining-stop paths:**
- `MiningService.handleStopMine()` — manual stop (player clicks STOP)
- `MiningService.handleAutoStop()` — timer-based (sector depleted or cargo full)
- `SectorRoom.onLeave()` — player disconnects (line 1428+)

Extract a shared helper `updateStoryProgress(playerId, minedAmount)` in MiningService to avoid duplication across all three paths. `onLeave` calls it via `this.mining.updateStoryProgress()`.

**Mine-all chain:** Each chain segment's `result.mined` accumulates into the story counter. So mining 6 ore + 4 gas = 10 total → triggers a fragment.

**After last fragment:** Display "THE END" with an Easter egg message. Story index stays at max, no loop.

### 4. Network Messages

**New message: `miningStoryUpdate`** (Server → Client)
```typescript
{
  storyIndex: number;       // current unlocked fragment index
}
```
- Sent on: room join (via `onJoin` — query `mining_story_index` from DB alongside existing player load), and mining stop (when new fragment unlocked)
- Client reads fragments from local `miningStory.ts` up to `storyIndex`

**New server behavior: `sectorData` after mining stop**
- After each mining stop (all three paths), server sends `sectorData` with updated resource values so client ResourceBars sync to real values

**No new Client → Server messages needed.** Story progress is a side-effect of the existing mining stop flow.

### 5. Database Migration (058)

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS mining_story_index INTEGER NOT NULL DEFAULT 0;
```

Idempotent via `IF NOT EXISTS`. Compatible with PostgreSQL 9.6+ (project uses PG 16).

### 6. Store Changes

**gameSlice:**
- New state: `miningStoryIndex: number` (default 0)
- New action: `setMiningStoryIndex(index: number)`

### 7. Implementation Order

1. `packages/shared/src/types.ts` — add `MiningStoryUpdate` type
2. `cd packages/shared && npm run build` — **required before server/client can use new type**
3. Migration 058
4. Server-side: queries, MiningService story helper, SectorRoom join/sectorData-after-stop
5. Client-side: gameSlice, network handler, MiningScreen live bars, MiningDetailPanel rewrite
6. Story content (`miningStory.ts`) + artwork (`MiningArtwork.tsx`)

### 8. Edge Cases

| Case | Behavior |
|------|----------|
| Mining stops early (manual) | `result.mined` added to story counter, partial progress preserved |
| Cargo fills mid-mining | Auto-stop fires, `result.mined` = actual amount that fit, counts toward story |
| Player disconnects | `onLeave` stops mining, saves story progress, no message sent (player gone) |
| Player reconnects | `onJoin` sends `miningStoryUpdate` with current `storyIndex` from DB |
| Redis counter lost | Only loses partial progress toward next fragment (max 9 units lost), acceptable |
| Mine-all chain | Each segment's mined amount accumulates in counter across the chain |
| Story complete | Index stays at max, "THE END" shown, mining still works but no new fragments |

### 9. Files Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types.ts` | Edit | MiningStoryUpdate type |
| `packages/client/src/components/MiningScreen.tsx` | Edit | Live resource bar countdown + blink |
| `packages/client/src/components/MiningDetailPanel.tsx` | Rewrite | Story panel with artwork + fragments |
| `packages/client/src/components/MiningArtwork.tsx` | New | Animated ASCII art per resource type |
| `packages/client/src/data/miningStory.ts` | New | ~80-100 story fragments |
| `packages/client/src/state/gameSlice.ts` | Edit | Add miningStoryIndex state |
| `packages/client/src/network/client.ts` | Edit | Handle miningStoryUpdate message |
| `packages/server/src/rooms/services/MiningService.ts` | Edit | Story progress helper + sectorData after stop |
| `packages/server/src/rooms/SectorRoom.ts` | Edit | Send story index on join, call story helper in onLeave |
| `packages/server/src/db/queries.ts` | Edit | get/update mining_story_index queries |
| `packages/server/src/db/migrations/058_mining_story.sql` | New | Add mining_story_index column |
