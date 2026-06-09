# Frontier Explorers (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When the aliens wake (the existing `aliens_awakened` trigger), also launch a moderate fleet (~40) of **trader + tourist explorer NPCs** that roam the galaxy **widely** (far beyond faction borders), simulated by the slow background tick (OOM-safe), leaving BB5 traces so the galaxy feels alive.

**Architecture:** A new `explorer` civ-ship role with a pure `nextExplorerState` that does ONE long-range hop to a deterministic far target per call. Explorers are spawned idempotently from the strategic-tick wake/awake block (spawn up to a target count). The background tick advances each explorer one hop per sweep and records a trace at its new location (per-sector always; global NEWS feed throttled so it doesn't drown real-player activity). Activity (scanned/traded/mined) is chosen from the arrival sector type.

**Tech Stack:** TypeScript (ESM, `.js` server imports), Vitest (DB mocked via `vi.mock`), `@void-sector/shared` (rebuild after edits). Distances in sectors. The background tick runs every 60 universe ticks (~5 min), paging civ_ships in chunks of 300.

**Ground rules from the user (2026-06-09):** trigger = the same as the alien wake (player reaches ≥2 quadrants / ~1000 sectors); explorers roam WIDE (beyond borders), driven by the background tick (NOT the radius-limited anchor tick) so they don't re-OOM; moderate count (~40); they are traders + tourists (factions `consortium` + `tourist_guild`), friendly.

**Branch:** `feat/world-model-reset-phase3` off master (Phase 1+2 deployed). Depends on Phase 2's `aliens_awakened` flag + wake block in `strategicTickService.ts`.

---

## Design decisions (read before implementing)

- **Movement = one big hop per sweep**, not sector-by-sector (`stepToward` moves 1 sector/step → far too slow at 8 steps/5 min). `nextExplorerState` returns a full jump to a deterministic far target and increments a leg counter (stored in `spiral_step`, an existing int column). Deterministic (seeded from ship id + leg) — no `Math.random` (unavailable in this codebase's pure paths anyway; and we need testability).
- **Wide targets:** each leg targets a random direction at a radius in **[1000, 12000] sectors** from origin (beyond the alien ring at 1000–5000) — explorers spread across the deep galaxy.
- **Background tick handles explorers specially:** instead of the 8-step catch-up loop, an explorer does ONE hop + ONE trace per sweep (clean, avoids losing intermediate positions, bounds the trace rate to ~40/5 min).
- **Trace flooding guard:** explorers ALWAYS write a per-sector trace (so a player who later visits that sector sees the explorer was there), but contribute to the global `trace:recent` NEWS feed only ~1 leg in 6 (throttle) — real-player activity must not be drowned by 40 NPCs.
- **Activity by sector:** the arrival sector type picks the trace action — resource sector → `mined`, station/origin-adjacent → `traded`, else → `scanned`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/types.ts` | add `'explorer'` to the civ-ship role union | Modify |
| `packages/server/src/engine/playerTraceService.ts` | new TraceActions + per-sector-only option | Modify |
| `packages/server/src/engine/__tests__/playerTraceService.test.ts` | action/verb tests | Modify |
| `packages/server/src/engine/npcShipAI.ts` | `nextExplorerState` + `pickExplorerTarget` | Modify |
| `packages/server/src/engine/civShipService.ts` | dispatch `'explorer'` → `nextExplorerState` | Modify |
| `packages/server/src/engine/__tests__/explorerAI.test.ts` | pure state-machine + target tests | Create |
| `packages/server/src/db/civQueries.ts` | `countAliveExplorers()` + reuse `spawnNpcShip` | Modify |
| `packages/server/src/engine/explorerFleet.ts` | `spawnExplorerFleet`, `EXPLORER_TARGET`, name/faction mix | Create |
| `packages/server/src/engine/__tests__/explorerFleet.test.ts` | spawn-plan tests | Create |
| `packages/server/src/engine/strategicTickService.ts` | idempotent explorer spawn in the awake block | Modify |
| `packages/server/src/engine/backgroundTickService.ts` | explorer hop + trace branch | Modify |

---

## Task 1: Add the `explorer` civ-ship role

**Files:**
- Modify: `packages/shared/src/types.ts` (the role union, ~line 1569: `role?: 'drone' | 'trader' | 'military' | 'outlaw';`)

- [ ] **Step 1: Find + change the union.** Read `packages/shared/src/types.ts` around line 1569. Change `role?: 'drone' | 'trader' | 'military' | 'outlaw';` to `role?: 'drone' | 'trader' | 'military' | 'outlaw' | 'explorer';`. (If the union appears in more than one place — e.g. a `CivShip` interface and a DTO — update each occurrence so types stay consistent. Grep `'outlaw'` in `packages/shared/src` to find them.)

- [ ] **Step 2: Rebuild shared.** `cd packages/shared && npm run build` — must be clean.

- [ ] **Step 3: Type-check the server uses it.** `cd packages/server && npx tsc --noEmit 2>&1 | grep -iE "role|explorer" || echo "no role type errors"` — expect no new errors.

- [ ] **Step 4: Commit.**
```bash
git add packages/shared/src/types.ts packages/shared/dist
git commit -m "feat: add 'explorer' civ-ship role"
```

---

## Task 2: New trace actions for explorer activity

**Files:**
- Modify: `packages/server/src/engine/playerTraceService.ts`
- Modify: `packages/server/src/engine/__tests__/playerTraceService.test.ts`

- [ ] **Step 1: Write the failing test.** Append to `playerTraceService.test.ts`:
```typescript
import type { TraceAction } from '../playerTraceService.js';

describe('explorer trace actions (BB5/Phase 3)', () => {
  const NOW2 = 1_000_000_000_000;
  it('formats the new NPC actions with German verbs', () => {
    const msg = (action: TraceAction) =>
      traceMessage({ playerId: 'npc', playerName: 'Konsortium-Späher', action, x: 5, y: 5, ts: NOW2 }, NOW2);
    expect(msg('scanned')).toContain('Konsortium-Späher');
    expect(msg('scanned')).toMatch(/scannte|erfasste|vermaß/i);
    expect(msg('traded')).toMatch(/handelte|Waren/i);
    expect(msg('mined')).toMatch(/baute|förderte|schürfte/i);
  });
});
```
Run → FAIL (types/verbs missing): `cd packages/server && npx vitest run src/engine/__tests__/playerTraceService.test.ts`

- [ ] **Step 2: Add the actions + verbs.** In `playerTraceService.ts`:
- Extend the union: `export type TraceAction = 'explored' | 'defeated_pirates' | 'built' | 'scanned' | 'traded' | 'mined';`
- Add to `ACTION_VERB`:
```typescript
  scanned: 'vermaß diesen Sektor',
  traded: 'handelte hier mit Waren',
  mined: 'förderte hier Rohstoffe',
```

- [ ] **Step 3: Add a per-sector-only recorder (no global-feed flooding).** Add to `playerTraceService.ts`:
```typescript
/** Record a trace at a sector ONLY (no global recent-activity feed). For NPCs
 *  whose volume would otherwise drown real players' activity in NEWS. */
export async function recordSectorTrace(t: PlayerTrace): Promise<void> {
  try {
    const entry = JSON.stringify(t);
    const secKey = `trace:sec:${t.x}:${t.y}`;
    await redis.lpush(secKey, entry);
    await redis.ltrim(secKey, 0, SECTOR_TRACE_MAX - 1);
    await redis.expire(secKey, TRACE_TTL_S);
  } catch (err) {
    logger.warn({ err }, 'recordSectorTrace failed (Redis)');
  }
}
```
Run → PASS: `cd packages/server && npx vitest run src/engine/__tests__/playerTraceService.test.ts`

- [ ] **Step 4: Commit.**
```bash
git add packages/server/src/engine/playerTraceService.ts packages/server/src/engine/__tests__/playerTraceService.test.ts
git commit -m "feat: explorer trace actions (scanned/traded/mined) + per-sector-only recorder"
```

---

## Task 3: `nextExplorerState` — wide-roaming hop AI

**Files:**
- Modify: `packages/server/src/engine/npcShipAI.ts`
- Modify: `packages/server/src/engine/civShipService.ts` (dispatcher at line 80-83)
- Test: `packages/server/src/engine/__tests__/explorerAI.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `explorerAI.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { nextExplorerState, pickExplorerTarget } from '../npcShipAI.js';

const ship = (over: Record<string, unknown> = {}) =>
  ({ id: 7, x: 0, y: 0, state: 'idle', spiral_step: 0, patrol_state: {}, ...over } as any);

describe('pickExplorerTarget', () => {
  it('returns a far target in the deep-galaxy ring [1000,12000] sectors', () => {
    for (let leg = 0; leg < 20; leg++) {
      const t = pickExplorerTarget(11, leg);
      const d = Math.max(Math.abs(t.x), Math.abs(t.y));
      expect(d).toBeGreaterThanOrEqual(1000);
      expect(d).toBeLessThanOrEqual(12000);
    }
  });
  it('is deterministic for the same (id, leg)', () => {
    expect(pickExplorerTarget(11, 3)).toEqual(pickExplorerTarget(11, 3));
  });
  it('varies by leg (different targets over time)', () => {
    expect(pickExplorerTarget(11, 3)).not.toEqual(pickExplorerTarget(11, 4));
  });
});

describe('nextExplorerState', () => {
  it('hops directly to a far target and advances the leg counter', () => {
    const s = ship({ id: 11, spiral_step: 2 });
    const upd = nextExplorerState(s);
    expect(upd.x).toBeDefined();
    expect(upd.y).toBeDefined();
    expect(Math.max(Math.abs(upd.x!), Math.abs(upd.y!))).toBeGreaterThanOrEqual(1000);
    expect(upd.spiral_step).toBe(3);            // leg advanced
    expect(upd.state).toBe('exploring');
    expect(upd.x).toEqual(pickExplorerTarget(11, 2).x); // hop uses the CURRENT leg
  });
  it('keeps moving every call (never settles to {})', () => {
    const upd = nextExplorerState(ship({ id: 11 }));
    expect(Object.keys(upd).length).toBeGreaterThan(0);
  });
});
```
Run → FAIL: `cd packages/server && npx vitest run src/engine/__tests__/explorerAI.test.ts`

- [ ] **Step 2: Implement in `npcShipAI.ts`.** Add (near the other state machines). It needs a small deterministic hash — reuse the file's existing seeding style if present, else inline:
```typescript
/** Deterministic far target for an explorer's leg. Direction + radius hashed
 *  from (shipId, leg); radius in [1000, 12000] sectors (deep galaxy, beyond the
 *  alien ring). Pure + stable so tests and the sim agree. */
export function pickExplorerTarget(shipId: number, leg: number): { x: number; y: number } {
  const h = (shipId * 2654435761 + leg * 40503 + 0x9e3779b9) >>> 0;
  const angle = (h % 3600) / 3600 * Math.PI * 2;          // 0..2π
  const radius = 1000 + ((h >>> 12) % 11001);              // 1000..12000
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
}

/** Explorer AI: one long-range hop per call to a fresh deep-galaxy target.
 *  Advances the leg counter (stored in spiral_step). Always returns a change so
 *  the background tick records a trace at the new location. */
export function nextExplorerState(ship: any): any {
  const leg = ship.spiral_step ?? 0;
  const t = pickExplorerTarget(ship.id, leg);
  return { x: t.x, y: t.y, spiral_step: leg + 1, state: 'exploring' };
}
```

- [ ] **Step 3: Dispatch the role.** In `packages/server/src/engine/civShipService.ts`, import and dispatch. Change the import on line 13 to add `nextExplorerState`:
`import { nextTraderState, nextMilitaryState, nextOutlawState, nextExplorerState } from './npcShipAI.js';`
Add to the dispatcher (after line 83 `if (role === 'outlaw') return nextOutlawState(ship);`):
`  if (role === 'explorer') return nextExplorerState(ship);`

- [ ] **Step 4: Run → PASS** + dispatcher type-check.
`cd packages/server && npx vitest run src/engine/__tests__/explorerAI.test.ts && npx tsc --noEmit 2>&1 | grep -iE "civShipService|npcShipAI" || echo "clean"`

- [ ] **Step 5: Commit.**
```bash
git add packages/server/src/engine/npcShipAI.ts packages/server/src/engine/civShipService.ts packages/server/src/engine/__tests__/explorerAI.test.ts
git commit -m "feat: nextExplorerState — wide-roaming deep-galaxy hop AI"
```

---

## Task 4: Spawn plan + alive-count query

**Files:**
- Modify: `packages/server/src/db/civQueries.ts` (add `countAliveExplorers`; reuse `spawnNpcShip`)
- Create: `packages/server/src/engine/explorerFleet.ts`
- Test: `packages/server/src/engine/__tests__/explorerFleet.test.ts`

- [ ] **Step 1: Add the count query.** In `packages/server/src/db/civQueries.ts`, add to the `civQueries` object (mirror the surrounding style):
```typescript
  async countAliveExplorers(): Promise<number> {
    const { rows } = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM civ_ships
       WHERE role = 'explorer' AND (dead_until IS NULL OR dead_until < NOW())`,
    );
    return Number(rows[0]?.n ?? 0);
  },
```
(Confirm `civQueries` is an exported object with async methods + how it imports `query`; match it.)

- [ ] **Step 2: Write the failing spawn-plan test.** Create `explorerFleet.test.ts`. The spawn FLEET is impure (DB), so we test the pure spawn-PLAN builder:
```typescript
import { describe, it, expect } from 'vitest';
import { buildExplorerSpawnPlan, EXPLORER_TARGET } from '../explorerFleet.js';

describe('buildExplorerSpawnPlan', () => {
  it('plans exactly `count` ships', () => {
    expect(buildExplorerSpawnPlan(5).length).toBe(5);
  });
  it('mixes trader (consortium) and tourist (tourist_guild) factions', () => {
    const plan = buildExplorerSpawnPlan(EXPLORER_TARGET);
    const factions = new Set(plan.map((p) => p.faction));
    expect(factions.has('consortium')).toBe(true);
    expect(factions.has('tourist_guild')).toBe(true);
  });
  it('every ship is role=explorer, spawns near origin, has a name', () => {
    for (const p of buildExplorerSpawnPlan(10)) {
      expect(p.role).toBe('explorer');
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThanOrEqual(500); // launch from civilized space
    }
  });
  it('is deterministic', () => {
    expect(buildExplorerSpawnPlan(8)).toEqual(buildExplorerSpawnPlan(8));
  });
});
```
Run → FAIL: `cd packages/server && npx vitest run src/engine/__tests__/explorerFleet.test.ts`

- [ ] **Step 3: Implement `explorerFleet.ts`.**
```typescript
import { civQueries } from '../db/civQueries.js';
import { logger } from '../utils/logger.js';

export const EXPLORER_TARGET = 40;

export interface ExplorerSpawn {
  faction: string;
  ship_type: string;
  role: string;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
  name: string;
}

const TRADER_NAMES = ['Konsortium-Späher', 'Handelsläufer', 'Frachtkundschafter', 'Routenfinder'];
const TOURIST_NAMES = ['Sternenpilger', 'Fernreisender', 'Panorama-Yacht', 'Horizont-Tourist'];

/** Deterministic plan for `count` explorer ships: a 50/50 trader/tourist mix,
 *  launched from civilized space near origin (they roam outward from there). */
export function buildExplorerSpawnPlan(count: number): ExplorerSpawn[] {
  const plan: ExplorerSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const isTrader = i % 2 === 0;
    const faction = isTrader ? 'consortium' : 'tourist_guild';
    const names = isTrader ? TRADER_NAMES : TOURIST_NAMES;
    const h = (i * 2654435761 + 0x9e3779b9) >>> 0;
    const x = (h % 1001) - 500;          // -500..500 (near origin)
    const y = ((h >>> 11) % 1001) - 500;
    plan.push({
      faction,
      ship_type: 'explorer',
      role: 'explorer',
      x, y, home_x: x, home_y: y,
      name: `${names[h % names.length]} ${(h % 900) + 100}`,
    });
  }
  return plan;
}

/** Idempotently top up the explorer fleet to EXPLORER_TARGET. Safe to call every
 *  strategic tick once the aliens are awake. */
export async function ensureExplorerFleet(): Promise<void> {
  const alive = await civQueries.countAliveExplorers();
  if (alive >= EXPLORER_TARGET) return;
  const plan = buildExplorerSpawnPlan(EXPLORER_TARGET - alive);
  for (const s of plan) {
    await civQueries.spawnNpcShip({
      faction: s.faction,
      ship_type: s.ship_type,
      role: s.role,
      x: s.x, y: s.y, home_x: s.home_x, home_y: s.home_y,
      level: 1, name: s.name,
      patrol_state: {},
    });
  }
  logger.info({ spawned: plan.length, target: EXPLORER_TARGET }, 'Explorer fleet topped up');
}
```
(Verify `spawnNpcShip`'s exact param shape from civQueries.ts and match it; the recon shows `{ faction, ship_type, role, x, y, home_x, home_y, level?, name?, inventory?, patrol_state? }`.)
Run → PASS.

- [ ] **Step 4: Commit.**
```bash
git add packages/server/src/db/civQueries.ts packages/server/src/engine/explorerFleet.ts packages/server/src/engine/__tests__/explorerFleet.test.ts
git commit -m "feat: explorer fleet spawn plan + idempotent top-up + alive count"
```

---

## Task 5: Spawn the fleet from the wake/awake block

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts`

- [ ] **Step 1: Import + call.** Add `import { ensureExplorerFleet } from './explorerFleet.js';` near the other imports. In the `if (alreadyAwake || waking)` block (added in Phase 2, ~line 119-122), call the top-up BEFORE `processAlienExpansion`:
```typescript
    if (alreadyAwake || waking) {
      await ensureExplorerFleet().catch((err) => logger.error({ err }, 'ensureExplorerFleet failed'));
      await this.processAlienExpansion(allControls, expansionFrontierMax(humanFrontier));
    }
```
This spawns explorers the tick the aliens wake AND tops up after a restart (when `alreadyAwake` is true) or if some die — idempotent via the count check.

- [ ] **Step 2: Keep the strategic-tick test green.** `cd packages/server && npx vitest run src/__tests__/strategicTickService.test.ts`. If it fails because `civQueries.countAliveExplorers`/`spawnNpcShip` aren't mocked (the test mocks `db/queries.js`, not necessarily `db/civQueries.js`), add a `vi.mock('../db/civQueries.js', ...)` (or `../engine/explorerFleet.js`) returning a no-op `ensureExplorerFleet`/count 0 — mock, don't weaken assertions. Read the test's existing mocks first; simplest is to `vi.mock('../engine/explorerFleet.js', () => ({ ensureExplorerFleet: vi.fn().mockResolvedValue(undefined) }))`.

- [ ] **Step 3: tsc + commit.**
```bash
cd packages/server && npx tsc --noEmit 2>&1 | grep -i strategicTick || echo clean
git add packages/server/src/engine/strategicTickService.ts packages/server/src/__tests__/strategicTickService.test.ts
git commit -m "feat: top up the explorer fleet whenever the aliens are awake"
```

---

## Task 6: Advance + trace explorers in the background tick

**Files:**
- Modify: `packages/server/src/engine/backgroundTickService.ts`

- [ ] **Step 1: Recon.** Read `backgroundTickService.ts` — the per-ship loop (~lines 45-75): it builds `s` from the ship, runs the 8-step catch-up via `nextShipState`, then `updateShip(...)`. Note the imports (it imports `civQueries`, `nextShipState`, and the BB2 trader-export bits).

- [ ] **Step 2: Add an explorer branch.** Inside the per-ship `for (const ship of ships)` loop, BEFORE the existing 8-step catch-up, special-case explorers (one hop + one trace per sweep). Add the imports at the top: `import { recordSectorTrace, recordTrace, type TraceAction } from './playerTraceService.js';` and reuse the existing `getMineableResource` if exported (else inline a simple sector check via `generateSector`). Insert:
```typescript
    if (((ship as any).role) === 'explorer') {
      const upd = nextExplorerState(ship);
      const nx = upd.x as number, ny = upd.y as number;
      await civQueries.updateShip(ship.id as number, {
        state: upd.state, x: nx, y: ny, spiral_step: upd.spiral_step ?? 0,
      });
      // Pick an activity from the arrival sector, leave a trace.
      const sectorType = generateSector(nx, ny, null).type;
      const action: TraceAction =
        sectorType === 'asteroid_field' || sectorType === 'nebula' || sectorType === 'anomaly' ? 'mined'
        : sectorType === 'station' ? 'traded'
        : 'scanned';
      const trace = { playerId: `npc-${ship.id}`, playerName: (ship as any).name || 'Kundschafter', action, x: nx, y: ny, ts: Date.now() };
      // Per-sector always; global NEWS feed only ~1 leg in 6 (don't drown real players).
      if (((upd.spiral_step ?? 0) % 6) === 0) { await recordTrace(trace); }
      else { await recordSectorTrace(trace); }
      continue; // explorers do NOT run the 8-step drone/trader catch-up
    }
```
- Add `nextExplorerState` to the `npcShipAI.js` import (or `civShipService.js` if re-exported), and `generateSector` from its module (grep where `generateSector` is imported in civShipService.ts — likely `'@void-sector/shared'` or a worldgen module; reuse the same import path). `Date.now()` is allowed in this impure tick (it's not a pure/replayed path).

- [ ] **Step 3: Type-check + run the background-tick test.**
`cd packages/server && npx tsc --noEmit 2>&1 | grep -i backgroundTick || echo clean`
`cd packages/server && npx vitest run src/engine/__tests__/backgroundTickService.test.ts` (if it exists; if explorers break a mock, add the trace/generateSector mocks — no assertion weakening).

- [ ] **Step 4: Commit.**
```bash
git add packages/server/src/engine/backgroundTickService.ts
git commit -m "feat: background tick hops + traces explorer ships across the galaxy"
```

---

## Task 7: Client safety + full sweep + deploy

**Files:** possibly a small client guard; otherwise verification only.

- [ ] **Step 1: Client role safety.** Explorers mostly roam far from players (background-tick territory), but one could appear near a player. Grep the client for civ-ship role rendering: `grep -rn "role" packages/client/src | grep -iE "trader|outlaw|military|drone|civ"`. If the radar/render switches on role and would CRASH or mis-render an unknown `'explorer'`, add a default fallback (treat unknown roles like a generic civ ship / `'trader'` icon). If it already has a default branch, no change needed — note that and move on. Do NOT build new explorer UI for v1 (their presence is felt via traces).

- [ ] **Step 2: Full suites.**
`cd packages/shared && npx vitest run` and `cd packages/server && npx vitest run` — report the summaries. Fix real Phase-3 regressions only (benign caught log lines `redis.lrange`, `too many clients` are not failures).

- [ ] **Step 3: Deploy runbook (operational — human runs it).** No migration this phase; just code.
```bash
# prod:
cd /opt/voidsector && git pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build server client
```
No `clean-slate` needed. Explorers spawn automatically once `aliens_awakened` is true (after a human reaches ~2 quadrants). To see them immediately on the (currently dormant) prod, a human must explore out to ~1000 sectors, OR an admin can set `aliens_awakened=true` via the admin CONFIG API.

- [ ] **Step 4: Verify (after a player wakes the world, or admin-forces the flag).**
```sql
SELECT role, COUNT(*) FROM civ_ships GROUP BY role;     -- ~40 explorer
SELECT name, x, y FROM civ_ships WHERE role='explorer' ORDER BY id LIMIT 10;  -- spread out, named
```
Then watch the NEWS galaxy-activity feed for explorer traces, and confirm memory ~stable (background tick only; 40 ships is trivial).

---

## Self-Review (completed by plan author)

**Spec coverage (user directives 2026-06-09):** explorers launch at the alien-wake trigger → Task 5 ✓; roam WIDE beyond borders via the BACKGROUND tick → Tasks 3 (deep-galaxy targets) + 6 (background advances them) ✓; trader + tourist factions → Task 4 (consortium + tourist_guild mix) ✓; moderate count ~40 → `EXPLORER_TARGET=40` ✓; scan/trade/mine + traces → Tasks 2 + 6 ✓; OOM-safe → background tick only, 40 ships, no anchor-tick load ✓.

**Placeholder scan:** none — every code/test step is complete. Several "verify the exact import/param shape and match it" notes are deliberate (the executor confirms against real signatures: `spawnNpcShip` params, `generateSector`/`getMineableResource` import path, `civQueries` style).

**Type/name consistency:** `nextExplorerState`/`pickExplorerTarget` (T3→T6), `ensureExplorerFleet`/`buildExplorerSpawnPlan`/`EXPLORER_TARGET` (T4→T5), `countAliveExplorers` (T4→T4), `recordSectorTrace`/new `TraceAction`s (T2→T6), `'explorer'` role (T1→T3→T4→T6). Consistent.

**Known risks / executor verification points:** (a) `spawnNpcShip` exact param names — match civQueries.ts. (b) `generateSector` import path in backgroundTickService — reuse civShipService's. (c) the strategic-tick + background-tick tests may need new no-op mocks for the explorer calls — add mocks, never weaken assertions. (d) trace volume: throttle is 1-in-6 to the global feed; tune if NEWS still feels NPC-heavy. (e) client unknown-role handling — verify it degrades gracefully.
