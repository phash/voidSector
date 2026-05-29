# Tech-Tree: Per-Category Tier Gating — Design Spec

**Issue:** #527 · **Date:** 2026-05-28 · **Status:** approved (design)

## Problem

The codebase has three half-built, disconnected "tech" systems:

1. **RESEARCH_DEFINITIONS** (53 nodes, branches = module categories) — rendered by the client `TechTreeScreen`; researching sends `researchNode` → flat `player_research_v2` list. Nodes carry `effect` (stat bonus) + `prerequisiteModuleId` → an *enhancement* model. The effects are **never applied** to ship stats.
2. **TECH_TREE_NODES** + `getTechTreeEffects` (branch/leaf, branches kampf/ausbau/intel/explorer) — the *gating* model (`unlockedTiers` per branch). Populated only via `researchTechNode`/`TechTreeService`, which the client **never calls**.
3. **Module gating** (`isModuleUnlocked` in `ShipService.buyModule`/craft + `ShopTab`) reads system 2's `researched_nodes`, but `isModuleFreelyAvailable` returns `true` for every non-found module → **gating is a no-op**; all tiers buyable from minute one.

Net effect: the TECH program is cosmetic; node IDs between the systems don't overlap; nothing gates module access.

## Goal

A single, canonical tech tree whose **only** job (for now) is **tier gating per module category**: tier 1 free, tier 2+ require research. Decisions locked with the user:

- **Purpose:** tier unlocking (gating), not enhancement.
- **Granularity:** per module category (~13 axes), 1:1 research ↔ module category.
- **Approach:** linear tier ladder per category (simplest; removes the 2–3 tangled systems).
- Enhancement/flavour (named nodes + stat bonuses) is explicitly **out of scope** — may be an additive layer later.

## Architecture

### Data model
- **Per-player state:** new column `players.category_tech JSONB NOT NULL DEFAULT '{}'` (migration 084). Shape: `{ "weapon_energy": 3, "shield": 2, … }` = highest unlocked tier per category. Missing key → tier **1**.
- **Max tier per category:** derived at runtime from `MODULE_DEFINITIONS` (`getMaxTier(category)`), no hardcoding.

### Gating rule
A module is buyable/craftable ⇔ `module.tier ≤ unlockedTier(category)` (default 1).
- Tier 1 is always free → starter modules (all tier 1: `puls_laser_mk1`, `ion_drive_mk1`, `mining_laser_mk1`, `fusion_cell_mk1`) stay usable from the start.
- **Found-only modules** (`isFoundOnly`) keep their existing blueprint requirement, independent of tier.
- Categories whose lowest module is tier 2 (e.g. `defense`) are locked until researched — intended (advanced gear).
- Already-installed modules above the unlocked tier are **kept** (gating only affects new buy/craft).

### Cost
`getResearchCost(targetTier) = RESEARCH_TIER_BASE_WISSEN × (targetTier − 1)`, base **15** → T2=15, T3=30, T4=45, T5=60, T6=75. Tunable constant ("good for a start").

## Components

### Shared — `packages/shared/src/techGating.ts` (new)
- `getMaxTier(category: string): number` — from MODULE_DEFINITIONS.
- `getResearchCost(targetTier: number): number`.
- `isModuleUnlocked(moduleId, categoryTiers: Record<string, number>, blueprints: string[]): boolean` — **new signature** (tier map, not researchedNodes). Found-only → requires blueprint; else `tier ≤ categoryTiers[category] ?? 1`.
- `isModuleFreelyAvailable` removed / folded in (no longer blanket-true).

### Server
- **Migration 084:** add `category_tech` column.
- **Queries:** `getCategoryTiers(playerId)`, `bumpCategoryTier(playerId, category, newTier)`.
- **Handler `researchCategoryTier`** (`{ category }`): compute next tier = current+1; validate `≤ getMaxTier`; not already there; deduct `getResearchCost(next)` Wissen (refund-safe); bump; send `categoryTechUpdate` with the full map.
- **ShipService** `buyModule` (~148) + craft (~229): gate via `isModuleUnlocked(moduleId, categoryTiers, blueprints)`.
- **Remove (dead after this):** `TechTreeService`, `TECH_TREE_NODES`, `getTechTreeEffects`/`techTreeEffects.ts`, handlers `researchTechNode` + `resetTechTree`, the flat `researchNode` handler. **Keep:** blueprint storage + Wissen economy.

### Client
- **`TechTreeScreen`:** render the ~13 category tracks from `MODULE_DEFINITIONS`; per track show current `tier n/max`, the modules per tier (locked/unlocked styling), and a `[Forschen Tier n+1 — X Wissen]` button → `network.sendResearchCategoryTier(category)`. Disable when at max tier or insufficient Wissen.
- **`ShopTab`:** disable/grey modules with `tier > unlocked` (uses new `isModuleUnlocked`).
- **Store:** hold `categoryTiers`; handle `categoryTechUpdate`. `RESEARCH_DEFINITIONS` no longer used by the UI (file kept for a possible future enhancement layer).

## Migration of existing data
- `category_tech` defaults to `{}` → everyone at tier 1. **No destructive migration.** Existing installed modules are kept. `tech_tree` / `player_research_v2` tables go dormant (blueprints may still be read where relevant). 2 players + test ships → negligible impact.

## Testing
- **Shared:** `isModuleUnlocked` (tier gating + found-only/blueprint), `getMaxTier`, `getResearchCost`.
- **Server:** `researchCategoryTier` (validate next-only, cap at max, deduct Wissen, refund on insufficient); `buyModule`/craft reject a locked tier, allow an unlocked one.
- **Client:** TechTreeScreen renders tracks + research button sends correct message; ShopTab disables locked modules.
- **Docker browser playtest:** new pilot can buy a tier-1 module, cannot buy a tier-2 module, researches the category, then can.

## Risks / edge cases
- Starter modules must stay buyable (all tier 1 — verified).
- Found-only/blueprint path preserved.
- Wissen earn rate must make research reachable (tunable cost).
- Removing the old systems: verified `getTechTreeEffects` is consumed only by the (retired) `TechTreeService`; nothing in stat calc depends on it.

## Out of scope (future, additive)
- Named research nodes + applied stat bonuses (the RESEARCH_DEFINITIONS enhancement layer).
- Cross-category prerequisites / a branching graph (current model is independent linear ladders).
