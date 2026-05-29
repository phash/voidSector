# Tech-Tree Per-Category Tier Gating — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate module access by tier per category — tier 1 free, tier 2+ require Wissen-funded research — and remove the three tangled tech systems in favour of one.

**Architecture:** Per-player `players.category_tech` JSONB map `{category: unlockedTier}` (default tier 1). A new `researchCategoryTier` message raises a category's tier for Wissen. `isModuleUnlocked` (shared) gates buy/craft/shop by `module.tier ≤ unlockedTier`. The old `TECH_TREE_NODES`/`getTechTreeEffects`/`TechTreeService`/`RESEARCH_DEFINITIONS`-UI systems are removed; blueprints + Wissen economy stay.

**Tech Stack:** TypeScript monorepo — shared (tsc), server (Colyseus + node-postgres, Vitest), client (React + Zustand + Vitest/jsdom). Spec: `docs/superpowers/specs/2026-05-28-tech-tree-tier-gating-design.md`.

**Branch:** `feat/527-tech-tier-gating` (already created off the launch-blocker fixes; migration 084 follows 083).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/techGating.ts` | `getMaxTier`, `getResearchCost`, `isModuleUnlocked` (tier-map signature) | Create |
| `packages/shared/src/__tests__/techGating.test.ts` | Unit tests for the above | Create |
| `packages/shared/src/research.ts` | Old `isModuleUnlocked`/`isModuleFreelyAvailable` | Delete (logic moves to techGating) |
| `packages/shared/src/index.ts` | Re-exports | Modify (drop research.ts export, add techGating) |
| `packages/server/src/db/migrations/084_category_tech.sql` | Add `players.category_tech` | Create |
| `packages/server/src/db/techTreeQueries.ts` | `getCategoryTiers`, `bumpCategoryTier` (+ delete old tech-tree queries) | Modify |
| `packages/server/src/rooms/services/TechTreeService.ts` | Old structured tech tree | Delete |
| `packages/server/src/rooms/services/ShipService.ts` | buy/craft gating | Modify (`:148`, `:229`) |
| `packages/server/src/rooms/SectorRoom.ts` | message handlers + service wiring | Modify (research handlers) |
| `packages/shared/src/techTree.ts`, `techTreeEffects.ts` | `TECH_TREE_NODES`, `getTechTreeEffects` | Delete |
| `packages/client/src/state/gameSlice.ts` | `categoryTiers` state | Modify |
| `packages/client/src/network/client.ts` | `categoryTechUpdate` handler + `sendResearchCategoryTier` | Modify |
| `packages/client/src/components/TechTreeScreen.tsx` | Category-track UI | Rewrite |
| `packages/client/src/components/ShopTab.tsx` | Lock modules above tier | Modify (`:103`) |

---

## Task 1: Shared tier-gating module

**Files:**
- Create: `packages/shared/src/techGating.ts`
- Create: `packages/shared/src/__tests__/techGating.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/__tests__/techGating.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getMaxTier, getResearchCost, isModuleUnlocked } from '../techGating.js';

describe('getMaxTier', () => {
  it('returns the highest tier present in a category', () => {
    // weapon_energy / drive span multiple tiers in MODULE_DEFINITIONS
    expect(getMaxTier('drive')).toBeGreaterThanOrEqual(5);
    expect(getMaxTier('weapon_energy')).toBeGreaterThanOrEqual(2);
  });
  it('returns 1 for an unknown category', () => {
    expect(getMaxTier('does_not_exist')).toBe(1);
  });
});

describe('getResearchCost', () => {
  it('scales 15 per tier above 1', () => {
    expect(getResearchCost(2)).toBe(15);
    expect(getResearchCost(3)).toBe(30);
    expect(getResearchCost(6)).toBe(75);
  });
});

describe('isModuleUnlocked', () => {
  it('tier-1 module is free with no research', () => {
    expect(isModuleUnlocked('puls_laser_mk1', {}, [])).toBe(true); // weapon_energy T1
  });
  it('tier-2 module is locked until its category tier is researched', () => {
    expect(isModuleUnlocked('puls_laser_mk2', {}, [])).toBe(false); // weapon_energy T2
    expect(isModuleUnlocked('puls_laser_mk2', { weapon_energy: 2 }, [])).toBe(true);
  });
  it('found-only module requires a blueprint regardless of tier', () => {
    const foundOnly = require('../moduleDefinitions.js').MODULE_DEFINITIONS.find((m: any) => m.isFoundOnly);
    if (foundOnly) {
      expect(isModuleUnlocked(foundOnly.id, { [foundOnly.category]: 99 }, [])).toBe(false);
      expect(isModuleUnlocked(foundOnly.id, {}, [foundOnly.id])).toBe(true);
    }
  });
  it('unknown module is not unlocked', () => {
    expect(isModuleUnlocked('nope', { weapon_energy: 9 }, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/techGating.test.ts`
Expected: FAIL — `Cannot find module '../techGating.js'`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/techGating.ts`:

```typescript
import { MODULE_DEFINITIONS, MODULE_MAP } from './moduleDefinitions.js';

/** Wissen cost to raise a category to `targetTier` (>= 2). 15 per tier above 1. */
export const RESEARCH_TIER_BASE_WISSEN = 15;
export function getResearchCost(targetTier: number): number {
  return RESEARCH_TIER_BASE_WISSEN * (targetTier - 1);
}

/** Highest module tier present in a category (min 1). */
const MAX_TIER_BY_CATEGORY: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const def of MODULE_DEFINITIONS) {
    m[def.category] = Math.max(m[def.category] ?? 1, def.tier);
  }
  return m;
})();

export function getMaxTier(category: string): number {
  return MAX_TIER_BY_CATEGORY[category] ?? 1;
}

/**
 * A module is unlocked iff:
 *  - found-only: a blueprint for it is held (tier irrelevant), else
 *  - its tier <= the player's unlocked tier for its category (default 1).
 */
export function isModuleUnlocked(
  moduleId: string,
  categoryTiers: Record<string, number>,
  blueprints: string[],
): boolean {
  const def = MODULE_MAP.get(moduleId);
  if (!def) return false;
  if (def.isFoundOnly) return blueprints.includes(moduleId);
  const unlocked = categoryTiers[def.category] ?? 1;
  return def.tier <= unlocked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/__tests__/techGating.test.ts`
Expected: PASS (all cases). If `puls_laser_mk2` is not tier 2, adjust the test to a real T2 energy-weapon id from `moduleDefinitions.ts`.

- [ ] **Step 5: Wire exports, delete old research.ts**

In `packages/shared/src/index.ts`: remove the `export * from './research.js';` line (if present) and add `export * from './techGating.js';`. Then delete `packages/shared/src/research.ts` and any `research.test.ts`.

Run: `cd packages/shared && grep -rn "from './research" src/ ; grep -rn "research.js" index.ts` — expect no remaining references.

- [ ] **Step 6: Build shared + full shared suite**

Run: `cd packages/shared && npm run build && npx vitest run`
Expected: build exit 0; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/techGating.ts packages/shared/src/__tests__/techGating.test.ts packages/shared/src/index.ts
git rm packages/shared/src/research.ts
git commit -m "feat: #527 shared per-category tier-gating (techGating.ts)"
```

---

## Task 2: DB migration + category-tier queries

**Files:**
- Create: `packages/server/src/db/migrations/084_category_tech.sql`
- Modify: `packages/server/src/db/techTreeQueries.ts`

- [ ] **Step 1: Write the migration**

Create `packages/server/src/db/migrations/084_category_tech.sql`:

```sql
-- Migration 084: per-category unlocked-tier map for module gating (#527).
-- { "weapon_energy": 3, "shield": 2, ... }; missing category => tier 1.
ALTER TABLE players ADD COLUMN IF NOT EXISTS category_tech JSONB NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Add queries**

In `packages/server/src/db/techTreeQueries.ts`, add (keep `getPlayerModulesV2`; the old `getOrCreateTechTree`/`saveTechTree`/`resetTechTree` are removed in Task 5):

```typescript
/** Returns the player's per-category unlocked-tier map (missing => caller treats as 1). */
export async function getCategoryTiers(playerId: string): Promise<Record<string, number>> {
  const { rows } = await query<{ category_tech: Record<string, number> }>(
    'SELECT category_tech FROM players WHERE id = $1',
    [playerId],
  );
  return rows[0]?.category_tech ?? {};
}

/** Sets a category's unlocked tier (atomic jsonb_set; category key is whitelisted by caller). */
export async function bumpCategoryTier(playerId: string, category: string, newTier: number): Promise<void> {
  await query(
    `UPDATE players SET category_tech = jsonb_set(COALESCE(category_tech, '{}'), $2, to_jsonb($3::int), true) WHERE id = $1`,
    [playerId, `{${category}}`, newTier],
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/server && npx tsc --noEmit 2>&1 | grep techTreeQueries || echo OK`
Expected: `OK` (no new errors in this file).

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/migrations/084_category_tech.sql packages/server/src/db/techTreeQueries.ts
git commit -m "feat: #527 migration 084 + category-tier queries"
```

> Note for CLAUDE.md: bump "Next migration" to 085 after this lands.

---

## Task 3: Server `researchCategoryTier` handler

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (research handlers ~790-820; imports)
- Test: `packages/server/src/__tests__/researchCategoryTier.test.ts` (create)

- [ ] **Step 1: Write the failing test (pure validation helper)**

To keep the handler testable without Colyseus, put the validation in a pure helper. Create `packages/server/src/engine/categoryTechService.ts`:

```typescript
import { getMaxTier, getResearchCost } from '@void-sector/shared';

export interface ResearchTierPlan { ok: boolean; nextTier?: number; cost?: number; error?: string; }

/** Pure: decide whether the next tier of a category can be researched. */
export function planCategoryResearch(
  category: string,
  currentTiers: Record<string, number>,
  wissen: number,
): ResearchTierPlan {
  const max = getMaxTier(category);
  const current = currentTiers[category] ?? 1;
  if (max <= 1) return { ok: false, error: 'Kategorie hat keine höheren Tiers' };
  if (current >= max) return { ok: false, error: 'Maximales Tier erreicht' };
  const nextTier = current + 1;
  const cost = getResearchCost(nextTier);
  if (wissen < cost) return { ok: false, error: `Nicht genug Wissen (${cost} benötigt)` };
  return { ok: true, nextTier, cost };
}
```

Create `packages/server/src/engine/__tests__/categoryTechService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { planCategoryResearch } from '../categoryTechService.js';

describe('planCategoryResearch', () => {
  it('plans tier 2 from default with enough Wissen', () => {
    expect(planCategoryResearch('weapon_energy', {}, 100)).toMatchObject({ ok: true, nextTier: 2, cost: 15 });
  });
  it('rejects when Wissen is insufficient', () => {
    expect(planCategoryResearch('weapon_energy', {}, 5).ok).toBe(false);
  });
  it('rejects at max tier', () => {
    const max = require('@void-sector/shared').getMaxTier('weapon_energy');
    expect(planCategoryResearch('weapon_energy', { weapon_energy: max }, 9999).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/categoryTechService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: (impl already written in Step 1)** — confirm pass

Run: `cd packages/server && npx vitest run src/engine/__tests__/categoryTechService.test.ts`
Expected: PASS.

- [ ] **Step 4: Wire the handler in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, replace the three old research handlers (`researchTechNode`, `resetTechTree`, `researchNode` — around lines 790-820) with a single handler. First add imports near the other engine/query imports:

```typescript
import { planCategoryResearch } from '../engine/categoryTechService.js';
import { getCategoryTiers, bumpCategoryTier } from '../db/techTreeQueries.js';
import { getWissen, deductWissen } from '../db/queries.js'; // if not already imported
```

Replace the old handlers with:

```typescript
    this.onMessage('researchCategoryTier', async (client, data: { category: string }) => {
      const auth = client.auth as AuthPayload;
      const [tiers, wissen] = await Promise.all([
        getCategoryTiers(auth.userId),
        getWissen(auth.userId),
      ]);
      const plan = planCategoryResearch(data.category, tiers, wissen);
      if (!plan.ok) {
        client.send('researchResult', { success: false, error: plan.error });
        return;
      }
      const paid = await deductWissen(auth.userId, plan.cost!);
      if (!paid) {
        client.send('researchResult', { success: false, error: 'Nicht genug Wissen' });
        return;
      }
      await bumpCategoryTier(auth.userId, data.category, plan.nextTier!);
      const updated = await getCategoryTiers(auth.userId);
      client.send('categoryTechUpdate', { categoryTiers: updated });
      client.send('researchResult', { success: true });
    });

    this.onMessage('getCategoryTech', async (client) => {
      const auth = client.auth as AuthPayload;
      client.send('categoryTechUpdate', { categoryTiers: await getCategoryTiers(auth.userId) });
    });
```

Keep the existing `getPlayerResearch` handler (blueprints) untouched. Remove the `this.techTree = new TechTreeService(...)` instantiation and any `this.techTree.*` references (Task 5 deletes the service).

- [ ] **Step 5: Typecheck + test**

Run: `cd packages/server && npx tsc --noEmit 2>&1 | grep -E "SectorRoom|categoryTech" || echo OK`
Expected: `OK` (after Task 5 removes TechTreeService refs; if errors mention TechTreeService, proceed to Task 5 then re-check).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/categoryTechService.ts packages/server/src/engine/__tests__/categoryTechService.test.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: #527 researchCategoryTier handler + planCategoryResearch"
```

---

## Task 4: Gate buy/craft by category tier

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts` (`:144-151`, `:221-233`)

- [ ] **Step 1: Update imports**

In `ShipService.ts`, change the `isModuleUnlocked` import to come from `@void-sector/shared` (it now has the new signature) and add the tier query. Remove `getOrCreateTechTree` import.

```typescript
import { isModuleUnlocked } from '@void-sector/shared';
import { getCategoryTiers } from '../../db/techTreeQueries.js';
```

- [ ] **Step 2: buyModule gating**

Replace lines ~144-151:

```typescript
    const [categoryTiers, dbResearch] = await Promise.all([
      getCategoryTiers(auth.userId),
      getPlayerResearch(auth.userId),
    ]);
    if (!isModuleUnlocked(data.moduleId, categoryTiers, dbResearch.blueprints)) {
      client.send('error', { code: 'MODULE_LOCKED', message: 'Modul-Tier noch nicht erforscht' });
      return;
    }
```

- [ ] **Step 3: craft gating**

Replace lines ~221-233:

```typescript
    const [research, bpQty, categoryTiers] = await Promise.all([
      getPlayerResearch(auth.userId),
      getInventoryItem(auth.userId, 'blueprint', data.moduleId),
      getCategoryTiers(auth.userId),
    ]);
    const blueprints = bpQty >= 1 ? [data.moduleId] : [];
    const hasRecipe = research.unlockedModules.includes(data.moduleId) ||
      isModuleUnlocked(data.moduleId, categoryTiers, blueprints);
    if (!hasRecipe) {
      client.send('craftResult', { success: false, error: 'Modul-Tier noch nicht erforscht' });
      return;
    }
```

- [ ] **Step 4: Add a gating test**

Create `packages/server/src/rooms/services/__tests__/ShipService.gating.test.ts` mirroring the existing ShipService test setup (mock `../../db/techTreeQueries.js` `getCategoryTiers`, `../../db/queries.js`, inventory). Assert: buying a tier-2 module with `getCategoryTiers → {}` sends `error MODULE_LOCKED`; with `{ weapon_energy: 2 }` it proceeds past the gate. (Follow the mock pattern in `ShipService.test.ts`.)

- [ ] **Step 5: Run + typecheck**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/ShipService.gating.test.ts && npx tsc --noEmit 2>&1 | grep ShipService || echo OK`
Expected: tests pass; `OK`.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts packages/server/src/rooms/services/__tests__/ShipService.gating.test.ts
git commit -m "feat: #527 gate buy/craft by category tier"
```

---

## Task 5: Remove the retired tech systems

**Files (delete):** `packages/shared/src/techTree.ts`, `packages/shared/src/techTreeEffects.ts`, `packages/server/src/rooms/services/TechTreeService.ts`, their tests; old `getOrCreateTechTree`/`saveTechTree`/`resetTechTree` in `techTreeQueries.ts`.

- [ ] **Step 1: Find references**

Run: `cd /home/manuel/claude/voidSector && grep -rn "TechTreeService\|TECH_TREE_NODES\|getTechTreeEffects\|getOrCreateTechTree\|saveTechTree\|researchTechNode\|RESEARCH_DEFINITIONS" packages --include=*.ts --include=*.tsx | grep -v node_modules`
Record every hit.

- [ ] **Step 2: Remove server references**

Delete `TechTreeService.ts`; remove its import + `this.techTree` field + instantiation in `SectorRoom.ts`; delete `getOrCreateTechTree`/`saveTechTree`/`resetTechTree`/`TechTreeRow` from `techTreeQueries.ts` and their callers. Remove the `researchTechNode`/`resetTechTree` send methods in `client.ts`.

- [ ] **Step 3: Remove shared references**

Delete `techTree.ts` + `techTreeEffects.ts` + tests; drop their exports from `index.ts`. `RESEARCH_DEFINITIONS` (`researchDefinitions.ts`) is kept as a file but its export stays only if nothing breaks — the client UI stops importing it in Task 7.

- [ ] **Step 4: Build everything**

Run: `cd packages/shared && npm run build && cd ../server && npx tsc --noEmit && cd ../client && npx tsc --noEmit 2>&1 | tail -5`
Expected: all clean. Fix any dangling reference the grep surfaced.

- [ ] **Step 5: Full server + shared suites**

Run: `cd packages/server && npx vitest run 2>&1 | tail -3 ; cd ../shared && npx vitest run 2>&1 | tail -3`
Expected: green (delete any test that only covered removed code).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: #527 remove retired TECH_TREE_NODES / TechTreeService / getTechTreeEffects"
```

---

## Task 6: Client store + network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add store state**

In `gameSlice.ts`: add to the state interface `categoryTiers: Record<string, number>;` and action `setCategoryTiers: (t: Record<string, number>) => void;`. In the initial state add `categoryTiers: {},` and in the store creator `setCategoryTiers: (categoryTiers) => set({ categoryTiers }),`.

- [ ] **Step 2: Add network handler + sender**

In `client.ts`, near the other research handlers (~717-728) add:

```typescript
    room.onMessage('categoryTechUpdate', (data: { categoryTiers: Record<string, number> }) => {
      useStore.getState().setCategoryTiers(data.categoryTiers);
    });
```

Replace `sendResearchNode`/`researchTechNode`/`resetTechTree` methods with:

```typescript
  sendResearchCategoryTier(category: string) {
    this.sectorRoom?.send('researchCategoryTier', { category });
  }
  requestCategoryTech() {
    this.sectorRoom?.send('getCategoryTech');
  }
```

Call `this.requestCategoryTech()` wherever initial game data is requested (alongside `requestPlayerResearch()`).

- [ ] **Step 3: Build**

Run: `cd packages/client && npx tsc --noEmit 2>&1 | tail -5`
Expected: clean (errors only where TechTreeScreen/ShopTab still use old API — fixed in Task 7).

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat: #527 client categoryTiers state + network"
```

---

## Task 7: Client TechTreeScreen + ShopTab

**Files:**
- Rewrite: `packages/client/src/components/TechTreeScreen.tsx`
- Modify: `packages/client/src/components/ShopTab.tsx` (`:103`)
- Test: `packages/client/src/__tests__/TechTreeScreen.test.tsx` (replace), `ShopTab.test.tsx` (update)

- [ ] **Step 1: Rewrite TechTreeScreen as category tracks**

Replace `TechTreeScreen.tsx` body so it renders, for each category in `MODULE_DEFINITIONS`, a track with `tier n / getMaxTier(category)`, the modules grouped by tier (locked/unlocked styling via `isModuleUnlocked(mod.id, categoryTiers, blueprints)`), and a research button:

```tsx
import { MODULE_DEFINITIONS, getMaxTier, getResearchCost, isModuleUnlocked } from '@void-sector/shared';
import { useStore } from '../state/store';
import { network } from '../network/client';

const CATEGORIES = [...new Set(MODULE_DEFINITIONS.map((m) => m.category))];

export function TechTreeScreen() {
  const categoryTiers = useStore((s) => s.categoryTiers);
  const blueprints = useStore((s) => s.research?.blueprints ?? []);
  const wissen = useStore((s) => s.wissen ?? 0);
  return (
    <div data-testid="tech-tree" style={{ padding: 12, fontFamily: 'var(--font-mono)', overflowY: 'auto', height: '100%' }}>
      {CATEGORIES.map((cat) => {
        const max = getMaxTier(cat);
        if (max <= 1) return null;
        const tier = categoryTiers[cat] ?? 1;
        const nextCost = getResearchCost(tier + 1);
        const canResearch = tier < max && wissen >= nextCost;
        return (
          <div key={cat} data-testid={`track-${cat}`} style={{ marginBottom: 10, borderBottom: '1px solid #234', paddingBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-primary)' }}>{cat.toUpperCase()} — TIER {tier}/{max}</span>
              {tier < max && (
                <button data-testid={`research-${cat}`} disabled={!canResearch}
                  onClick={() => network.sendResearchCategoryTier(cat)}
                  style={{ opacity: canResearch ? 1 : 0.4 }}>
                  [FORSCHEN T{tier + 1} — {nextCost} W]
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {MODULE_DEFINITIONS.filter((m) => m.category === cat).map((m) => {
                const unlocked = isModuleUnlocked(m.id, categoryTiers, blueprints);
                return <span key={m.id} style={{ fontSize: '0.6rem', color: unlocked ? '#4a9' : '#555' }}>{m.name}{unlocked ? '' : ' 🔒'}</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

(Confirm the store fields `wissen` and `research.blueprints` exist; if named differently, use the actual selectors.)

- [ ] **Step 2: Replace the TechTreeScreen test**

Replace `TechTreeScreen.test.tsx` to mock the store (`mockStoreState({ categoryTiers: { weapon_energy: 2 }, wissen: 100 })`) and assert: a `track-weapon_energy` renders showing `TIER 2/`, the `research-weapon_energy` button exists, clicking it calls `network.sendResearchCategoryTier('weapon_energy')`.

- [ ] **Step 3: ShopTab gating**

In `ShopTab.tsx:103`, replace the `isModuleUnlocked(m.id, m, researchedNodes, research.blueprints)` filter with `isModuleUnlocked(m.id, categoryTiers, research.blueprints)` and source `categoryTiers` from the store. Update `ShopTab.test.tsx` accordingly (provide `categoryTiers` in the mock; assert tier-2 modules are hidden/disabled at default tiers).

- [ ] **Step 4: Build + client suite**

Run: `cd packages/client && npx tsc --noEmit && npm run build && npx vitest run 2>&1 | grep -E "Test Files|Tests " | tail -2`
Expected: build green; all client tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/TechTreeScreen.tsx packages/client/src/components/ShopTab.tsx packages/client/src/__tests__/TechTreeScreen.test.tsx packages/client/src/__tests__/ShopTab.test.tsx
git commit -m "feat: #527 TechTreeScreen category tracks + ShopTab tier gating"
```

---

## Task 8: Docker browser playtest validation

**Files:** none (validation).

- [ ] **Step 1: Rebuild + restart the stack**

Run: `cd /home/manuel/claude/voidSector && docker compose build server client && docker compose up -d`
Then confirm migration 084 applied: `docker compose logs server | grep 084` (expect "Migration applied"); confirm `:3201` returns 200.

- [ ] **Step 2: Playtest the gating**

With a headless Playwright script (pattern from the prior session — register `QA-####`, wait for cockpit):
1. Open ACEP → SHOP (or the buy UI); confirm a **tier-2** energy weapon is locked/disabled, a **tier-1** is available.
2. Open TECH; confirm category tracks render; click `research-weapon_energy` (needs Wissen — grant via admin API or mine/scan first).
3. After research, confirm the tier-2 module becomes available.
Capture console errors (expect 0) and screenshots.

- [ ] **Step 2b: Acceptance**

Expected: tier-1 buyable, tier-2 blocked pre-research, buyable post-research; 0 console errors.

- [ ] **Step 3: Commit any fixes** found during playtest, then push the branch and open a PR referencing #527.

---

## Self-Review

- **Spec coverage:** data model (Task 2), gating rule (Tasks 1,4), cost curve (Task 1), researchCategoryTier (Task 3), client UI/ShopTab (Tasks 6-7), removal of old systems (Task 5), migration/no-destructive (Task 2 default `{}`), testing (every task) + Docker playtest (Task 8). All spec sections covered.
- **Placeholders:** none — concrete code or exact before/after for every step. The two "follow the existing mock pattern" test steps (4.4, 7.2/7.3) reference a real sibling test file as the pattern; acceptable for test scaffolding.
- **Type consistency:** `isModuleUnlocked(moduleId, categoryTiers, blueprints)` signature used identically in Tasks 1, 4, 7. `categoryTiers: Record<string, number>` consistent across server queries, handler, store, components. `researchCategoryTier` / `categoryTechUpdate` / `getCategoryTech` message names consistent between server (Task 3) and client (Task 6).
