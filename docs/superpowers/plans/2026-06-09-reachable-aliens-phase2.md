# Reachable Aliens + Always-Buy Sink (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the 7 alien factions into reach (homes relocated into the **1000–5000 sector ring**), keep them dormant until a human reaches the ring, then expand toward the player frontier — and make 0:0 an always-buy sink for ore/gas/crystal.

**Architecture:** A migration relocates `faction_config` homes; the home-guard gains a max bound; a persistent `aliens_awakened` game_config flag plus a human-frontier query drive a wake-trigger in the strategic tick that replaces the Phase-1 `ALIEN_EXPANSION_ENABLED` kill-switch; `getExpansionTarget` gains a frontier-distance bound; and `canSellToStation` special-cases 0:0 to always accept basic resources.

**Tech Stack:** TypeScript (ESM, `.js` server imports), Vitest (DB mocked via `vi.mock`), PostgreSQL migrations (auto-run on boot, next number **093**), `@void-sector/shared` (rebuild after edits). `QUADRANT_SIZE=500`; centered `sectorToQuadrant`; distances are Chebyshev.

**Ground truth (verified on prod 2026-06-09):** `faction_config` has **7 active aliens** — archivists(15,10) consortium(-10,-20) kthari(20,-15) mirror_minds(-20,15) mycelians(25,5) silent_swarm(-30,20) tourist_guild(-5,-25) — currently 7.5k–15k sectors out. `ALIEN_STARTING_REGIONS` (constants) is NOT the runtime source — do not touch it.

**Depends on:** Phase 1 (`feat/world-model-reset`, merged to master). This branch is `feat/world-model-reset-phase2` off master. Deferred to a later phase: the 100 frontier NPCs (Phase 3).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/server/src/db/migrations/093_alien_homes_ring.sql` | Relocate 7 alien homes into the ring | Create |
| `packages/server/src/engine/__tests__/alienHomesRing.test.ts` | Assert the 7 new coords are inside the guard bounds | Create |
| `packages/server/src/engine/alienHomeGuard.ts` | Add optional `maxDist` bound | Modify |
| `packages/server/src/engine/__tests__/alienHomeGuard.test.ts` | min + max guard tests | Create/extend |
| `packages/shared/src/constants.ts` | `ALIEN_WAKE_FRONTIER_QUADRANTS`, `EXPANSION_FRONTIER_MARGIN` | Modify |
| `packages/server/src/engine/gameConfigSeed.ts` | Register `aliens_awakened` (default false) | Modify |
| `packages/server/src/db/queries.ts` | `getHumanFrontierMaxDistance()` | Modify |
| `packages/server/src/engine/expansionEngine.ts` | `shouldWakeAliens`, `expansionFrontierMax`, `getExpansionTarget` bound | Modify |
| `packages/server/src/engine/__tests__/expansionEngine.test.ts` | pure tests for the above | Create/extend |
| `packages/server/src/engine/strategicTickService.ts` | wake-trigger + frontier-bound expansion (replaces kill-switch) | Modify |
| `packages/server/src/engine/npcStationEngine.ts` | 0:0 always-buy sink in `canSellToStation` | Modify |
| `packages/server/src/engine/__tests__/originSink.test.ts` | sink tests | Create |
| `packages/server/src/engine/universeBootstrap.ts` | pass max bound to the guard | Modify |

---

## Task 1: Migration 093 — relocate the 7 alien homes into the 1000–5000 ring

**Files:**
- Create: `packages/server/src/db/migrations/093_alien_homes_ring.sql`
- Test: `packages/server/src/engine/__tests__/alienHomesRing.test.ts`

New coordinates (Chebyshev quadrant-distance D; nearest-sector distance = D·500−250, all within [1000,5000]; spread across all four diagonals):

| faction | qx | qy | D | sectors |
|---|---|---|---|---|
| kthari | 3 | 1 | 3 | 1250 |
| archivists | -1 | 4 | 4 | 1750 |
| consortium | 5 | -2 | 5 | 2250 |
| mycelians | -6 | -3 | 6 | 2750 |
| mirror_minds | 2 | 7 | 7 | 3250 |
| silent_swarm | -8 | 4 | 8 | 3750 |
| tourist_guild | 4 | -9 | 9 | 4250 |

- [ ] **Step 1: Write the failing test.** Create `packages/server/src/engine/__tests__/alienHomesRing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { quadrantNearestSectorDistance } from '../alienHomeGuard.js';
import { QUADRANT_SIZE } from '@void-sector/shared';

// The new ring homes set by migration 093 (keep in sync with the migration).
const RING_HOMES: Record<string, { qx: number; qy: number }> = {
  kthari: { qx: 3, qy: 1 },
  archivists: { qx: -1, qy: 4 },
  consortium: { qx: 5, qy: -2 },
  mycelians: { qx: -6, qy: -3 },
  mirror_minds: { qx: 2, qy: 7 },
  silent_swarm: { qx: -8, qy: 4 },
  tourist_guild: { qx: 4, qy: -9 },
};

describe('migration 093 alien ring homes', () => {
  it('places all 7 homes inside the 1000–5000 sector ring', () => {
    for (const [faction, { qx, qy }] of Object.entries(RING_HOMES)) {
      const d = quadrantNearestSectorDistance(qx, qy, QUADRANT_SIZE);
      expect(d, `${faction} distance`).toBeGreaterThanOrEqual(1000);
      expect(d, `${faction} distance`).toBeLessThanOrEqual(5000);
    }
  });
  it('has no two factions sharing a home quadrant and none at origin', () => {
    const keys = Object.values(RING_HOMES).map((h) => `${h.qx}:${h.qy}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('0:0');
  });
});
```

- [ ] **Step 2: Run → expect FAIL** (the helper exists, but `quadrantNearestSectorDistance` is exported from alienHomeGuard — if the test fails only because a coord is out of range, the coords are wrong; this test passes once the constants above are correct, so it actually goes RED→GREEN with the migration in Step 3. Run it to confirm GREEN math first):
  `cd packages/server && npx vitest run src/engine/__tests__/alienHomesRing.test.ts`
  (If a distance assertion fails, the coord is outside the ring — fix the coord in BOTH this file and the migration.)

- [ ] **Step 3: Create the migration.** `packages/server/src/db/migrations/093_alien_homes_ring.sql`:

```sql
-- 093: Relocate alien faction homes into the reachable 1000–5000 sector ring
-- (2–10 quadrants from origin). faction_config is the runtime source of alien
-- homes (read by ensureAlienHomeQuadrants). Idempotent UPDATEs to fixed coords.
UPDATE faction_config SET home_qx = 3,  home_qy = 1  WHERE faction_id = 'kthari';
UPDATE faction_config SET home_qx = -1, home_qy = 4  WHERE faction_id = 'archivists';
UPDATE faction_config SET home_qx = 5,  home_qy = -2 WHERE faction_id = 'consortium';
UPDATE faction_config SET home_qx = -6, home_qy = -3 WHERE faction_id = 'mycelians';
UPDATE faction_config SET home_qx = 2,  home_qy = 7  WHERE faction_id = 'mirror_minds';
UPDATE faction_config SET home_qx = -8, home_qy = 4  WHERE faction_id = 'silent_swarm';
UPDATE faction_config SET home_qx = 4,  home_qy = -9 WHERE faction_id = 'tourist_guild';
```

- [ ] **Step 4: Run the test → expect PASS** (math + uniqueness). `cd packages/server && npx vitest run src/engine/__tests__/alienHomesRing.test.ts`

- [ ] **Step 5: Commit.**
```bash
git add packages/server/src/db/migrations/093_alien_homes_ring.sql packages/server/src/engine/__tests__/alienHomesRing.test.ts
git commit -m "feat: migration 093 relocates 7 alien homes into the 1000-5000 sector ring"
```

---

## Task 2: Extend the home-guard with a max bound

**Files:**
- Modify: `packages/server/src/engine/alienHomeGuard.ts` (the `assertAlienHomesFarFromOrigin` at lines 46-62)
- Modify: `packages/server/src/engine/universeBootstrap.ts` (the call at line 43)
- Test: `packages/server/src/engine/__tests__/alienHomeGuard.test.ts`

- [ ] **Step 1: Write the failing test.** Create `packages/server/src/engine/__tests__/alienHomeGuard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { assertAlienHomesFarFromOrigin } from '../alienHomeGuard.js';

const SIZE = 500;
const home = (faction_id: string, home_qx: number, home_qy: number) => ({ faction_id, home_qx, home_qy });

describe('assertAlienHomesFarFromOrigin (min + max)', () => {
  it('passes when all alien homes are within [min,max]', () => {
    expect(() =>
      assertAlienHomesFarFromOrigin([home('kthari', 3, 1), home('silent_swarm', -8, 4)], SIZE, 1000, 5000),
    ).not.toThrow();
  });
  it('throws when a home is too close (below min)', () => {
    expect(() => assertAlienHomesFarFromOrigin([home('kthari', 1, 0)], SIZE, 1000, 5000)).toThrow(/minimum 1000/);
  });
  it('throws when a home is too far (above max)', () => {
    expect(() => assertAlienHomesFarFromOrigin([home('kthari', 20, 0)], SIZE, 1000, 5000)).toThrow(/maximum 5000/);
  });
  it('ignores the human faction', () => {
    expect(() => assertAlienHomesFarFromOrigin([home('humans', 0, 0)], SIZE, 1000, 5000)).not.toThrow();
  });
  it('max is optional — backward compatible (min-only)', () => {
    expect(() => assertAlienHomesFarFromOrigin([home('kthari', 20, 0)], SIZE, 1000)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run → expect FAIL** (`maxDist` not handled): `cd packages/server && npx vitest run src/engine/__tests__/alienHomeGuard.test.ts`

- [ ] **Step 3: Add the max bound.** In `packages/server/src/engine/alienHomeGuard.ts`, replace the `assertAlienHomesFarFromOrigin` function (lines 46-62) with:

```typescript
/**
 * Throws if any non-human faction home is outside [minDist, maxDist] sectors of
 * origin. `maxDist` is optional (omit for a min-only guard). Startup guardrail
 * after alien homes are seeded.
 */
export function assertAlienHomesFarFromOrigin(
  homes: FactionHome[],
  quadrantSize: number,
  minDist: number,
  maxDist?: number,
): void {
  for (const h of homes) {
    // 'humans' is the live faction_config id (migration 063); 'human' kept for any pre-migration data.
    if (h.faction_id === 'human' || h.faction_id === 'humans') continue;
    const dist = quadrantNearestSectorDistance(h.home_qx, h.home_qy, quadrantSize);
    if (dist < minDist) {
      throw new Error(
        `Alien home "${h.faction_id}" at quadrant (${h.home_qx},${h.home_qy}) is only ` +
          `${dist} sectors from origin (minimum ${minDist}).`,
      );
    }
    if (maxDist !== undefined && dist > maxDist) {
      throw new Error(
        `Alien home "${h.faction_id}" at quadrant (${h.home_qx},${h.home_qy}) is ` +
          `${dist} sectors from origin (maximum ${maxDist}).`,
      );
    }
  }
}
```

- [ ] **Step 4: Run → expect PASS.** `cd packages/server && npx vitest run src/engine/__tests__/alienHomeGuard.test.ts`

- [ ] **Step 5: Pass the max at boot.** In `packages/server/src/engine/universeBootstrap.ts` line 43, change:
`assertAlienHomesFarFromOrigin(factionHomes, QUADRANT_SIZE, 1000);`
to:
`assertAlienHomesFarFromOrigin(factionHomes, QUADRANT_SIZE, 1000, 5000);`

- [ ] **Step 6: Run the bootstrap test (must stay green).** `cd packages/server && npx vitest run src/__tests__/universeBootstrap.test.ts`
  (If it constructs real `factionHomes` and the test DB still has the OLD far homes, the new max bound could throw. The bootstrap test almost certainly mocks `getAllFactionConfigs` — if it now throws because a mocked home exceeds 5000, update the MOCK's home coords to a ring value like `{home_qx:3,home_qy:1}`, not the production code. If unclear, report NEEDS_CONTEXT.)

- [ ] **Step 7: Commit.**
```bash
git add packages/server/src/engine/alienHomeGuard.ts packages/server/src/engine/universeBootstrap.ts packages/server/src/engine/__tests__/alienHomeGuard.test.ts
git commit -m "feat: alien-home guard enforces the 1000-5000 sector ring (max bound)"
```

---

## Task 3: `aliens_awakened` flag, frontier constants, and the human-frontier query

**Files:**
- Modify: `packages/shared/src/constants.ts` (near `QUADRANT_SIZE`, ~line 971)
- Modify: `packages/server/src/engine/gameConfigSeed.ts` (the `CONFIG_SEED` array at line 436)
- Modify: `packages/server/src/db/queries.ts` (add after `getVisitedQuadrantSet`, ~line 3476)
- Test: `packages/server/src/db/__tests__/humanFrontier.test.ts` (create)

- [ ] **Step 1: Add the shared constants.** In `packages/shared/src/constants.ts`, directly below the Phase-1 kill-switch block (after `ALIEN_EXPANSION_ENABLED`), add:

```typescript
// ── Reachable-aliens (Phase 2) ──────────────────────────────────────────────
// Aliens wake once a human has discovered a quadrant at least this many quadrants
// from origin (2 q ≈ 1000 sectors = the inner edge of the alien ring).
export const ALIEN_WAKE_FRONTIER_QUADRANTS = 2;
// Once awake, a faction may only claim quadrants within this many quadrants of the
// outermost human-discovered quadrant — expansion follows the player frontier.
export const EXPANSION_FRONTIER_MARGIN = 5;
```
Then rebuild: `cd packages/shared && npm run build` (clean build).

- [ ] **Step 2: Register the config key.** In `packages/server/src/engine/gameConfigSeed.ts`, add an entry to the `CONFIG_SEED` array (line 436+), matching the existing `{ key, category, description, getDefault }` shape:

```typescript
  { key: 'aliens_awakened', category: 'aliens', description: 'Alien expansion has woken (a human reached the alien ring). Persistent; default false.', getDefault: () => false },
```

- [ ] **Step 3: Write the failing query test.** Create `packages/server/src/db/__tests__/humanFrontier.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.fn();
vi.mock('../client.js', () => ({ query: (...a: unknown[]) => query(...a), runMigrations: vi.fn() }));

import { getHumanFrontierMaxDistance } from '../queries.js';

describe('getHumanFrontierMaxDistance', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the max Chebyshev quadrant distance any human has visited', async () => {
    query.mockResolvedValue({ rows: [{ max_dist: 7 }] });
    await expect(getHumanFrontierMaxDistance()).resolves.toBe(7);
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toMatch(/player_quadrant_visits/);
  });
  it('returns 0 when nobody has explored', async () => {
    query.mockResolvedValue({ rows: [{ max_dist: 0 }] });
    await expect(getHumanFrontierMaxDistance()).resolves.toBe(0);
  });
});
```

- [ ] **Step 4: Run → expect FAIL** (`getHumanFrontierMaxDistance` not exported): `cd packages/server && npx vitest run src/db/__tests__/humanFrontier.test.ts`
  > Note: if mocking `../client.js` is not how queries.ts imports `query`, read the top of `queries.ts` and mock the ACTUAL client module path. Adjust the mock to match.

- [ ] **Step 5: Add the query.** In `packages/server/src/db/queries.ts`, after `getVisitedQuadrantSet` (~line 3476), add:

```typescript
/**
 * Max Chebyshev quadrant-distance from origin that ANY human has discovered.
 * `player_quadrant_visits` is human-only and stores quadrant (qx,qy). 0 if empty.
 */
export async function getHumanFrontierMaxDistance(): Promise<number> {
  const res = await query<{ max_dist: number }>(
    `SELECT COALESCE(MAX(GREATEST(ABS(qx), ABS(qy))), 0)::int AS max_dist
     FROM player_quadrant_visits`,
  );
  return res.rows[0]?.max_dist ?? 0;
}
```

- [ ] **Step 6: Run → expect PASS.** `cd packages/server && npx vitest run src/db/__tests__/humanFrontier.test.ts`

- [ ] **Step 7: Commit.**
```bash
git add packages/shared/src/constants.ts packages/shared/dist packages/server/src/engine/gameConfigSeed.ts packages/server/src/db/queries.ts packages/server/src/db/__tests__/humanFrontier.test.ts
git commit -m "feat: aliens_awakened config key + frontier constants + human-frontier query"
```

---

## Task 4: Pure wake/frontier helpers + frontier-bounded `getExpansionTarget`

**Files:**
- Modify: `packages/server/src/engine/expansionEngine.ts`
- Test: `packages/server/src/engine/__tests__/expansionEngine.test.ts` (create if absent; else extend)

- [ ] **Step 1: Write the failing tests.** Create/extend `packages/server/src/engine/__tests__/expansionEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldWakeAliens, expansionFrontierMax, getExpansionTarget } from '../expansionEngine.js';
import type { QuadrantControlRow } from '../../db/queries.js';

const ctrl = (qx: number, qy: number, f: string) =>
  ({ qx, qy, controlling_faction: f } as unknown as QuadrantControlRow);

describe('shouldWakeAliens', () => {
  it('wakes once a human reaches >=2 quadrants and not already awake', () => {
    expect(shouldWakeAliens(false, 2)).toBe(true);
    expect(shouldWakeAliens(false, 5)).toBe(true);
  });
  it('does not wake below the threshold', () => {
    expect(shouldWakeAliens(false, 1)).toBe(false);
  });
  it('does not re-wake when already awake', () => {
    expect(shouldWakeAliens(true, 9)).toBe(false);
  });
});

describe('expansionFrontierMax', () => {
  it('is the human frontier plus the margin', () => {
    expect(expansionFrontierMax(2)).toBe(7);
    expect(expansionFrontierMax(0)).toBe(5);
  });
});

describe('getExpansionTarget frontier bound', () => {
  const controls = [ctrl(3, 1, 'kthari')]; // home at distance 3
  it('rejects a target beyond the bound', () => {
    // neighbors of (3,1) reach distance 4 (e.g. (4,1)); bound 3 blocks all of them
    expect(getExpansionTarget('kthari', controls, 'sphere', 3)).toBeNull();
  });
  it('allows a target within the bound', () => {
    const t = getExpansionTarget('kthari', controls, 'sphere', 5);
    expect(t).not.toBeNull();
    expect(Math.max(Math.abs(t!.qx), Math.abs(t!.qy))).toBeLessThanOrEqual(5);
  });
  it('is unbounded when maxDistance is omitted (back-compat)', () => {
    expect(getExpansionTarget('kthari', controls, 'sphere')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run → expect FAIL** (helpers + param missing): `cd packages/server && npx vitest run src/engine/__tests__/expansionEngine.test.ts`

- [ ] **Step 3: Implement.** In `packages/server/src/engine/expansionEngine.ts`:

Add imports + pure helpers near the top (after the existing imports):
```typescript
import { ALIEN_WAKE_FRONTIER_QUADRANTS, EXPANSION_FRONTIER_MARGIN } from '@void-sector/shared';

/** True when aliens should transition from dormant to awake this tick. */
export function shouldWakeAliens(alreadyAwake: boolean, humanFrontierQuadrants: number): boolean {
  return !alreadyAwake && humanFrontierQuadrants >= ALIEN_WAKE_FRONTIER_QUADRANTS;
}

/** The outermost quadrant-distance aliens may expand to, given the human frontier. */
export function expansionFrontierMax(humanFrontierQuadrants: number): number {
  return humanFrontierQuadrants + EXPANSION_FRONTIER_MARGIN;
}
```

Modify `getExpansionTarget` (lines 29-57) to accept an optional `maxDistance` (Chebyshev quadrant distance from origin) and skip out-of-bound candidates:
```typescript
export function getExpansionTarget(
  faction: string,
  allControls: QuadrantControlRow[],
  _style: 'sphere' | 'wave' | 'jumpgate',
  maxDistance?: number,
): { qx: number; qy: number } | null {
  const claimedSet = new Set(allControls.map((q) => `${q.qx},${q.qy}`));
  const ownedQuadrants = allControls.filter((q) => q.controlling_faction === faction);

  if (ownedQuadrants.length === 0) return null;

  const candidates = new Set<string>();
  for (const own of ownedQuadrants) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = own.qx + dx;
        const ny = own.qy + dy;
        // Frontier bound: aliens only expand within the player frontier + margin.
        if (maxDistance !== undefined && Math.max(Math.abs(nx), Math.abs(ny)) > maxDistance) continue;
        const key = `${nx},${ny}`;
        if (!claimedSet.has(key)) {
          candidates.add(key);
        }
      }
    }
  }

  if (candidates.size === 0) return null;

  const [first] = candidates;
  const [qx, qy] = first.split(',').map(Number);
  return { qx, qy };
}
```

- [ ] **Step 4: Run → expect PASS.** `cd packages/server && npx vitest run src/engine/__tests__/expansionEngine.test.ts`

- [ ] **Step 5: Commit.**
```bash
git add packages/server/src/engine/expansionEngine.ts packages/server/src/engine/__tests__/expansionEngine.test.ts
git commit -m "feat: wake/frontier pure helpers + frontier-bounded getExpansionTarget"
```

---

## Task 5: Wire the wake-trigger + frontier-bound into the strategic tick

Replaces the Phase-1 `ALIEN_EXPANSION_ENABLED` kill-switch with the persistent `aliens_awakened` flag + frontier logic. The decision logic is the pure helpers from Task 4 (already tested); this task is the wiring.

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts`

- [ ] **Step 1: Recon.** Read `strategicTickService.ts`: the imports block (line 21-27), the `ALIEN_EXPANSION_ENABLED` gate (~line 108-112), and `processAlienExpansion` (~line 215-248). Confirm the `gameConfig` singleton import path (`./gameConfigService.js` → `gameConfig`) and the module-level `getConfig` (`./gameConfigApply.js`).

- [ ] **Step 2: Update imports.** In `strategicTickService.ts`:
- Remove `ALIEN_EXPANSION_ENABLED` from the `@void-sector/shared` import on line 24 (it's no longer used here; leave the constant in shared).
- Add to the existing `expansionEngine.js` import (line 21): `shouldWakeAliens, expansionFrontierMax` →
  `import { findAllBorderPairs, getExpansionTarget, shouldWakeAliens, expansionFrontierMax } from './expansionEngine.js';`
- Add: `import { getConfig } from './gameConfigApply.js';`
- Add: `import { gameConfig } from './gameConfigService.js';`
- Add: `import { getHumanFrontierMaxDistance } from '../db/queries.js';`

- [ ] **Step 3: Replace the gate.** Replace the Phase-1 block (currently):
```typescript
    // 2. Alien expansion into unclaimed space (frozen for the sole-station launch;
    //    Phase 2 re-enables this behind the aliens_awakened wake-trigger).
    if (ALIEN_EXPANSION_ENABLED) {
      await this.processAlienExpansion(allControls);
    }
```
with:
```typescript
    // 2. Alien expansion — dormant until a human reaches the alien ring (~1000
    //    sectors / 2 quadrants), then expands within the player frontier + margin.
    const humanFrontier = await getHumanFrontierMaxDistance();
    const alreadyAwake = (getConfig('aliens_awakened') as boolean) ?? false;
    if (shouldWakeAliens(alreadyAwake, humanFrontier)) {
      await gameConfig.set('aliens_awakened', true, 'aliens', 'Humans reached the alien ring');
      await this.pushWarTickerEvent('◆ Etwas Fremdes erwacht in der Tiefe…').catch(() => undefined);
      logger.info({ humanFrontier }, 'Aliens awakened — expansion enabled');
    }
    if (alreadyAwake || shouldWakeAliens(alreadyAwake, humanFrontier)) {
      await this.processAlienExpansion(allControls, expansionFrontierMax(humanFrontier));
    }
```

- [ ] **Step 4: Thread the bound into `processAlienExpansion`.** Change its signature + the `getExpansionTarget` call:
```typescript
  private async processAlienExpansion(
    allControls: QuadrantControlRow[],
    frontierMax: number,
  ): Promise<void> {
    const factions = this.factionConfig.getActiveFactions().filter((f) => f.faction_id !== 'humans');

    for (const faction of factions) {
      const target = getExpansionTarget(
        faction.faction_id,
        allControls,
        faction.expansion_style as 'sphere' | 'wave' | 'jumpgate',
        frontierMax,
      );
      if (!target) continue;
      // ... rest unchanged (eta, createNpcFleet, logExpansionEvent) ...
```
(Leave everything below the `getExpansionTarget` call exactly as-is.)

- [ ] **Step 5: Verify the existing strategic-tick tests still pass.**
`cd packages/server && npx vitest run src/engine/__tests__/strategicTickService.test.ts`
(If there is no such test file, run any test that imports strategicTickService; otherwise the type-check at build time + the Task-7 full sweep covers it. If a test mocks the tick and breaks on the new awaited calls, add mocks for `getHumanFrontierMaxDistance`/`gameConfig` returning defaults — do NOT weaken assertions. Report NEEDS_CONTEXT if unclear.)

- [ ] **Step 6: Commit.**
```bash
git add packages/server/src/engine/strategicTickService.ts
git commit -m "feat: alien expansion wakes at the player frontier (replaces Phase-1 kill-switch)"
```

> Testability note: the wake DECISION is the pure `shouldWakeAliens`/`expansionFrontierMax`/`getExpansionTarget` (fully tested in Task 4). This task is wiring; its correctness is covered by Task 4's pure tests + the full-suite sweep (Task 7). No bespoke private-method test is added (it would require mocking the entire tick).

---

## Task 6: 0:0 always-buy sink for ore/gas/crystal

**Files:**
- Modify: `packages/server/src/engine/npcStationEngine.ts` (`canSellToStation`, lines 315-342)
- Test: `packages/server/src/engine/__tests__/originSink.test.ts`

- [ ] **Step 1: Write the failing test.** Create `packages/server/src/engine/__tests__/originSink.test.ts`. Mock the station inventory helper so we can drive a full station:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Drive canSellToStation with a controllable inventory item + station init no-op.
const item = { itemType: 'ore', stock: 8000, maxStock: 8000, restockRate: 0, consumptionRate: 0, lastUpdated: new Date().toISOString() };
vi.mock('../../db/npcStationQueries.js', async (orig) => ({
  ...(await orig<typeof import('../../db/npcStationQueries.js')>()),
  getStationData: vi.fn().mockResolvedValue({ stationX: 0, stationY: 0, level: 5, xp: 15000, visitCount: 0, tradeVolume: 0, lastXpDecay: new Date().toISOString() }),
  getStationInventory: vi.fn().mockResolvedValue([item]),
  getStationInventoryItem: vi.fn().mockImplementation(async (_x: number, _y: number, t: string) => (t === item.itemType ? item : { ...item, itemType: t })),
  upsertStationData: vi.fn(),
  upsertInventoryItem: vi.fn(),
}));

import { canSellToStation } from '../npcStationEngine.js';

describe('0:0 always-buy sink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('0:0 accepts the FULL amount of ore even when inventory is full', async () => {
    const r = await canSellToStation(0, 0, 'ore', 500);
    expect(r.ok).toBe(true);
    expect(r.effectiveAmount).toBe(500); // not clamped to remaining capacity (0)
    expect(r.price).toBeGreaterThan(0);  // pays a floor price at full stock
  });

  it('a non-origin station at full stock takes nothing (normal capacity rule)', async () => {
    const r = await canSellToStation(7, 7, 'ore', 500);
    expect(r.effectiveAmount).toBe(0);
    expect(r.ok).toBe(false);
  });

  it('0:0 does NOT special-case non-basic resources', async () => {
    const r = await canSellToStation(0, 0, 'fuel', 500); // 'fuel' is not ore/gas/crystal
    expect(r.effectiveAmount).toBe(0); // full station, no sink for non-basics
  });
});
```

- [ ] **Step 2: Run → expect FAIL** (0:0 currently clamps to capacity 0): `cd packages/server && npx vitest run src/engine/__tests__/originSink.test.ts`

- [ ] **Step 3: Implement the sink.** In `packages/server/src/engine/npcStationEngine.ts`, modify `canSellToStation` (lines 315-342). Replace the body from `const currentStock = ...` through the `effectiveAmount` line so the origin sink bypasses the capacity clamp (price logic unchanged — at full stock `stockRatio=1` already yields the base·spread floor):

```typescript
  const currentStock = calculateCurrentStock(item);
  // 0:0 is the galaxy trade sink: it ALWAYS accepts basic resources (excess is
  // sunk — EconomyService caps stored stock at maxStock). Reliable place to sell.
  const isOriginSink = x === 0 && y === 0 && (itemType === 'ore' || itemType === 'gas' || itemType === 'crystal');
  const remainingCapacity = item.maxStock - currentStock;
  const effectiveAmount = isOriginSink ? amount : Math.min(amount, remainingCapacity);
  const stockRatio = item.maxStock > 0 ? currentStock / item.maxStock : 0;
  const basePrice = NPC_PRICES[itemType as MineableResourceType] ?? 0;
  const dynamicPrice = calculatePrice(basePrice, stockRatio);
  const unitPrice = Math.round(
    dynamicPrice * ((getConfig('NPC_SELL_SPREAD') as typeof NPC_SELL_SPREAD) ?? NPC_SELL_SPREAD),
  );
  const totalPrice = unitPrice * effectiveAmount;

  return {
    ok: effectiveAmount > 0,
    capacity: isOriginSink ? amount : remainingCapacity,
    price: totalPrice,
    effectiveAmount,
  };
```

- [ ] **Step 4: Run → expect PASS.** `cd packages/server && npx vitest run src/engine/__tests__/originSink.test.ts`

- [ ] **Step 5: Commit.**
```bash
git add packages/server/src/engine/npcStationEngine.ts packages/server/src/engine/__tests__/originSink.test.ts
git commit -m "feat: 0:0 always-buy sink — accepts ore/gas/crystal even when full"
```

---

## Task 7: Full sweep + deploy runbook (Phase 1 + Phase 2)

**Files:** none (verification + ops doc).

- [ ] **Step 1: Full suites.** Run:
- `cd packages/shared && npx vitest run`
- `cd packages/server && npx vitest run`
Report the `Test Files … / Tests …` summary for each (the trailing `EACCES results.json` line on server is benign). If any test fails: fix REAL regressions caused by Phase 2 (do not weaken unrelated tests); flag pre-existing failures with evidence.

- [ ] **Step 2: Deploy runbook (operational — the human runs this; do NOT execute ssh/docker here).**
This single deploy ships BOTH Phase 1 (already on master) and Phase 2. Migration 093 relocates homes; the one-off `clean-slate` then re-seeds the NEW ring homes and wipes the old territory.
```bash
# on the prod box:
cd /opt/voidsector && git pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build server client   # migration 093 runs on boot
docker compose -f docker-compose.yml -f docker-compose.caddy.yml \
  run --rm --workdir /app/packages/server --no-deps server npm run clean-slate                  # re-seeds NEW ring homes
```

- [ ] **Step 3: Verify prod (read-only SQL).**
```sql
SELECT faction_id, home_qx, home_qy FROM faction_config WHERE faction_id <> 'humans' ORDER BY faction_id; -- ring coords
SELECT COUNT(*) FROM civ_stations;                                  -- 0
SELECT COUNT(*) FROM quadrant_control;                              -- 8 (1 human + 7 alien homes)
SELECT level FROM npc_station_data WHERE station_x=0 AND station_y=0; -- 5
SELECT value FROM game_config WHERE key='aliens_awakened';          -- false (until a human reaches 2 quadrants out)
```
Expected: 7 alien homes at the ring coords; `civ_stations=0`; `quadrant_control=8`; 0:0 level 5; `aliens_awakened=false`.

---

## Self-Review (completed by plan author)

**Spec coverage (`2026-06-09-world-model-reset-design.md` Phase 2 + §1.2 sink):**
- Homes into 1000–5000 ring → Task 1 (migration) + Task 2 (guard max). ✓
- `aliens_awakened` flag + wake at ≥2 q → Task 3 (flag + query) + Task 4 (`shouldWakeAliens`) + Task 5 (wiring). ✓
- Replace `ALIEN_EXPANSION_ENABLED` with the trigger → Task 5. ✓
- Frontier-bound expansion → Task 4 (`getExpansionTarget` bound, `expansionFrontierMax`) + Task 5 (threading). ✓
- Always-buy sink at 0:0 → Task 6. ✓

**Placeholder scan:** none — every code/test step is complete. The one "no bespoke test" call-out (Task 5) is justified (logic lives in tested pure helpers).

**Type/name consistency:** `getHumanFrontierMaxDistance` (Task 3 → 5), `shouldWakeAliens`/`expansionFrontierMax` (Task 4 → 5), `getExpansionTarget(..., maxDistance?)` (Task 4 → 5), `ALIEN_WAKE_FRONTIER_QUADRANTS`/`EXPANSION_FRONTIER_MARGIN` (Task 3 → 4), `aliens_awakened` key (Task 3 → 5), `isOriginSink` (Task 6). All consistent. Ring coords identical in Task 1 test + migration.

**Known executor verification points:** confirm the `query` client import path for the `humanFrontier` mock (Task 3); confirm `gameConfig` singleton + `getConfig` import paths (Task 5); confirm `getStationData/getStationInventoryItem/upsert*` module for the sink mock (Task 6 — Phase 1 found it is `db/npcStationQueries.js`); confirm `player_quadrant_visits` stores quadrant (not sector) coords (migration 051 — verified in recon).
