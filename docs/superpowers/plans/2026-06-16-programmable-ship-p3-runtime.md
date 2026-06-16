# Programmable Ship — Plan 3: Server Execution Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Execute compiled DSL programs on the server: headless action-cores (move/scan/mine/sell, no combat), a condition evaluator, a step-based VM, an online per-player executor, and a capped global offline scheduler — so a ship runs a script live (and offline at MK.IV+).

**Architecture:** Greenfield engine in `packages/server/src/engine/automation/` + a room `ShipComputerService`. The VM is a pure step machine: each `stepProgram()` advances one instruction (FLY moves one sector/step; SCAN/MINE/SELL complete in one step), calling injected action-cores + condition evaluator → fully unit-testable. The online executor is a per-player `setInterval` (modeled on the autopilot timer) inside the room; the offline scheduler is one global capped timer in the universe bootstrap. **MVP is combat-free**: cores never trigger pirate/combat, so automated ships take no damage and there is no permadeath path (per approved scope).

**Tech Stack:** TypeScript (server tsc clean), Vitest (mock `../db/*` + redis stores). Depends on Plan 1 (`compileProgram`, `Instr`, `Condition`) + Plan 2 (`programQueries`, `getShipComputerLevel`, AUTOMATION config, migration 099).

**Spec:** `docs/superpowers/specs/2026-06-15-programmable-ship-design.md` (§3). **Approved scope:** combat-free MVP runtime (executor never enters combat).

---

## Design contracts

**VM state** (persisted to `ship_program_state.vm_state` JSONB; `pc` is a separate column):
```ts
interface VmState { loops: number[]; fly: { tx: number; ty: number } | null; }
```
**Step result:** `{ pc, vm, status, finished, log? }` where `status ∈ 'running'|'paused'|'idle'`, `finished` true when a 'once' program ends.

**Action-core result:** `{ ok: true, ...payload } | { ok: false, reason: string }`. `reason` is a short German phrase for the log/pause.

**FLY cost model (MVP):** each sector step costs `apCostJump` AP + `fuelPerJump` fuel (from `calculateShipStats`); reuses the jump economy so fuel matters. Insufficient AP/fuel → core returns `{ ok:false, reason }` → VM pauses.

**SELL (MVP):** sells all held ore/gas/crystal to the NPC station at the current sector via the existing economy logic; if no station here → `{ ok:false, reason:'keine Station hier' }` → pause.

## File Structure
| File | Action | Responsibility |
|---|---|---|
| `packages/server/src/engine/automation/cores.ts` | create | headless `coreMoveOneSector/coreScan/coreMine/coreSell` |
| `packages/server/src/engine/automation/conditions.ts` | create | `evaluateCondition(playerId, cond)` |
| `packages/server/src/engine/automation/vm.ts` | create | pure `stepProgram(instructions, pc, vm, ctx)` |
| `packages/server/src/engine/automation/offlineScheduler.ts` | create | global capped offline tick |
| `packages/server/src/rooms/services/ShipComputerService.ts` | create | room messages + online executor |
| `packages/server/src/engine/automation/__tests__/*` | create | TDD |
| `packages/server/src/rooms/SectorRoom.ts` | modify | register messages, start/stop executor on join/leave |
| `packages/server/src/engine/universeBootstrap.ts` | modify | start offline scheduler |

**Test cmd:** `cd packages/server && npx vitest run <path>` · build: `cd packages/server && npm run build`.

---

### Task 1: Action-cores — move & scan (server)

**Files:** create `packages/server/src/engine/automation/cores.ts`; test `packages/server/src/engine/automation/__tests__/cores.move.test.ts`.

First READ to confirm exact signatures/paths: `packages/server/src/rooms/services/RedisAPStore.ts` (getAPState/saveAPState/getFuelState/saveFuelState/getPlayerPosition/savePlayerPosition), `packages/server/src/engine/ap.ts` (calculateCurrentAP), `packages/server/src/db/queries.ts` (getActiveShip, getSector, saveSector, addDiscovery, updateSectorResources), `packages/server/src/engine/worldgen*` (generateSector), `@void-sector/shared` (calculateShipStats). Adjust import paths/names in the code below to match.

- [ ] **Step 1: failing test** — `packages/server/src/engine/automation/__tests__/cores.move.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  getPlayerPosition: vi.fn(), savePlayerPosition: vi.fn(),
  getAPState: vi.fn(), saveAPState: vi.fn(), getFuelState: vi.fn(), saveFuelState: vi.fn(),
  getActiveShip: vi.fn(), getSector: vi.fn(), saveSector: vi.fn(), addDiscovery: vi.fn(),
  generateSector: vi.fn(), calculateShipStats: vi.fn(),
}));
vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition, savePlayerPosition: m.savePlayerPosition,
  getAPState: m.getAPState, saveAPState: m.saveAPState,
  getFuelState: m.getFuelState, saveFuelState: m.saveFuelState,
}));
vi.mock('../../ap.js', () => ({ calculateCurrentAP: (ap: any) => ap }));
vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip, getSector: m.getSector, saveSector: m.saveSector, addDiscovery: m.addDiscovery,
}));
vi.mock('../../worldgen.js', () => ({ generateSector: m.generateSector }));
vi.mock('@void-sector/shared', () => ({ calculateShipStats: m.calculateShipStats }));

import { coreMoveOneSector } from '../cores.js';

beforeEach(() => {
  vi.clearAllMocks();
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ apCostJump: 1, fuelPerJump: 10, cargoCap: 20, scannerLevel: 1 });
  m.getAPState.mockResolvedValue({ current: 100, max: 100, lastTick: 0, regenPerSecond: 1 });
  m.getFuelState.mockResolvedValue(1000);
  m.getSector.mockResolvedValue({ x: 1, y: 0, type: 'empty', resources: { ore: 0, gas: 0, crystal: 0 } });
});

describe('coreMoveOneSector', () => {
  it('steps one sector toward the target (diagonal allowed) and spends AP+fuel', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.x).toBe(1); expect(r.y).toBe(0); expect(r.arrived).toBe(false);
    expect(m.savePlayerPosition).toHaveBeenCalledWith('u1', 1, 0);
    expect(m.saveAPState).toHaveBeenCalled();
    expect(m.saveFuelState).toHaveBeenCalledWith('u1', 990);
  });

  it('reports arrived when the step reaches the target', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 2, y: 0 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok && r.arrived).toBe(true);
  });

  it('pauses (ok:false) when AP is insufficient', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    m.getAPState.mockResolvedValue({ current: 0, max: 100, lastTick: 0, regenPerSecond: 1 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/AP/i);
  });

  it('pauses when fuel is insufficient', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    m.getFuelState.mockResolvedValue(5);
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/treibstoff/i);
  });

  it('is a no-op arrival when already at the target', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 3, y: 0 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok && r.arrived).toBe(true);
    expect(m.savePlayerPosition).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: run → FAIL** (`cd packages/server && npx vitest run src/engine/automation/__tests__/cores.move.test.ts`).

- [ ] **Step 3: implement** — create `packages/server/src/engine/automation/cores.ts` (verify imports against the real files; the names below match the exploration):
```ts
import {
  getPlayerPosition, savePlayerPosition,
  getAPState, saveAPState, getFuelState, saveFuelState,
} from '../../rooms/services/RedisAPStore.js';
import { calculateCurrentAP } from '../ap.js';
import { getActiveShip, getSector, saveSector, addDiscovery, updateSectorResources } from '../../db/queries.js';
import { generateSector } from '../worldgen.js';
import { calculateShipStats } from '@void-sector/shared';
import { getCargoState, getResourceTotal, addToInventory, removeFromInventory } from '../inventoryService.js';

export type CoreResult<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; reason: string };

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);

async function shipStats(playerId: string) {
  const ship = await getActiveShip(playerId);
  return calculateShipStats(ship?.modules ?? []);
}

/** Move exactly one sector toward (tx,ty). Spends apCostJump AP + fuelPerJump fuel. */
export async function coreMoveOneSector(
  playerId: string, tx: number, ty: number,
): Promise<CoreResult<{ x: number; y: number; arrived: boolean }>> {
  const pos = (await getPlayerPosition(playerId)) ?? { x: 0, y: 0 };
  if (pos.x === tx && pos.y === ty) return { ok: true, x: pos.x, y: pos.y, arrived: true };

  const stats = await shipStats(playerId);
  const apCost = Math.max(0, stats.apCostJump ?? 1);
  const fuelCost = Math.max(0, stats.fuelPerJump ?? 0);

  const ap = calculateCurrentAP(await getAPState(playerId));
  if (ap.current < apCost) return { ok: false, reason: 'Nicht genug AP' };
  const fuel = (await getFuelState(playerId)) ?? 0;
  if (fuel < fuelCost) return { ok: false, reason: 'Nicht genug Treibstoff' };

  const nx = pos.x + sign(tx - pos.x);
  const ny = pos.y + sign(ty - pos.y);

  let sector = await getSector(nx, ny);
  if (!sector) {
    sector = generateSector(nx, ny, playerId, false);
    await saveSector(sector);
  }

  ap.current -= apCost;
  await saveAPState(playerId, ap);
  await saveFuelState(playerId, fuel - fuelCost);
  await savePlayerPosition(playerId, nx, ny);
  await addDiscovery(playerId, nx, ny);

  return { ok: true, x: nx, y: ny, arrived: nx === tx && ny === ty };
}
```
> If `generateSector`'s module path or arity differs, or `addDiscovery` signature differs, adjust to match the real files (you read them in the pre-step). Keep behavior identical.

- [ ] **Step 4: run → PASS**; then add the scan core + test (next sub-steps).

- [ ] **Step 5: scan core test** — `packages/server/src/engine/automation/__tests__/cores.scan.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({
  getPlayerPosition: vi.fn(), getAPState: vi.fn(), saveAPState: vi.fn(),
  getActiveShip: vi.fn(), getSector: vi.fn(), saveSector: vi.fn(), generateSector: vi.fn(), calculateShipStats: vi.fn(),
}));
vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition, savePlayerPosition: vi.fn(),
  getAPState: m.getAPState, saveAPState: m.saveAPState, getFuelState: vi.fn(), saveFuelState: vi.fn(),
}));
vi.mock('../../ap.js', () => ({ calculateCurrentAP: (ap: any) => ap }));
vi.mock('../../../db/queries.js', () => ({ getActiveShip: m.getActiveShip, getSector: m.getSector, saveSector: m.saveSector, addDiscovery: vi.fn(), updateSectorResources: vi.fn() }));
vi.mock('../../worldgen.js', () => ({ generateSector: m.generateSector }));
vi.mock('@void-sector/shared', () => ({ calculateShipStats: m.calculateShipStats }));
vi.mock('../../inventoryService.js', () => ({ getCargoState: vi.fn(), getResourceTotal: vi.fn(), addToInventory: vi.fn(), removeFromInventory: vi.fn() }));
import { coreScan } from '../cores.js';
beforeEach(() => {
  vi.clearAllMocks();
  m.getPlayerPosition.mockResolvedValue({ x: 1, y: 1 });
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ scannerLevel: 1 });
  m.getAPState.mockResolvedValue({ current: 100, max: 100, lastTick: 0, regenPerSecond: 1 });
  m.getSector.mockResolvedValue({ x: 1, y: 1, type: 'asteroid', resources: { ore: 50, gas: 0, crystal: 0 } });
});
describe('coreScan', () => {
  it('spends AP and returns the current sector resources', async () => {
    const r = await coreScan('u1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resources.ore).toBe(50);
    expect(m.saveAPState).toHaveBeenCalled();
  });
  it('pauses when AP insufficient', async () => {
    m.getAPState.mockResolvedValue({ current: 0, max: 100, lastTick: 0, regenPerSecond: 1 });
    const r = await coreScan('u1');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 6: implement coreScan** — append to `cores.ts` (use a fixed scan AP cost constant; confirm the real local-scan AP cost in `ScanService.ts`/constants and mirror it — default 3):
```ts
const SCAN_AP_COST = 3; // mirror AP_COSTS_LOCAL_SCAN base; confirm in ScanService/constants

export async function coreScan(playerId: string): Promise<CoreResult<{ resources: { ore: number; gas: number; crystal: number } }>> {
  const pos = (await getPlayerPosition(playerId)) ?? { x: 0, y: 0 };
  const ap = calculateCurrentAP(await getAPState(playerId));
  if (ap.current < SCAN_AP_COST) return { ok: false, reason: 'Nicht genug AP zum Scannen' };
  let sector = await getSector(pos.x, pos.y);
  if (!sector) { sector = generateSector(pos.x, pos.y, playerId, false); await saveSector(sector); }
  ap.current -= SCAN_AP_COST;
  await saveAPState(playerId, ap);
  const res = sector.resources ?? { ore: 0, gas: 0, crystal: 0 };
  return { ok: true, resources: { ore: res.ore ?? 0, gas: res.gas ?? 0, crystal: res.crystal ?? 0 } };
}
```

- [ ] **Step 7: run both core tests → PASS; build server** (`npm run build` exit 0).

- [ ] **Step 8: commit**
```bash
git add packages/server/src/engine/automation/cores.ts packages/server/src/engine/automation/__tests__/cores.move.test.ts packages/server/src/engine/automation/__tests__/cores.scan.test.ts
git commit -m "feat: automation action-cores — move & scan (headless)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Action-cores — mine & sell (server)

**Files:** modify `cores.ts`; test `cores.mine.test.ts`, `cores.sell.test.ts`.

Pre-step: READ `packages/server/src/engine/inventoryService.ts` (getCargoState/getResourceTotal/addToInventory/removeFromInventory signatures), `packages/server/src/rooms/services/EconomyService.ts` (the sell branch of `handleNpcTrade`: `canSellToStation`, price calc, station inventory update, `addCredits`, `recordTrade`) and `packages/server/src/db/queries.ts` for those. The sell core must reuse the SAME economy functions so prices match manual selling.

- [ ] **Step 1: failing tests** —

`cores.mine.test.ts` (mock inventory + queries + ship stats): assert `coreMine('u1','until_full')` mines up to cargo space across ore/gas/crystal, calls `addToInventory` + `updateSectorResources`, and reports `{ ok:true, mined }`; when cargo already full → `{ ok:false, reason:/voll/i }`; when sector empty → `{ ok:true, mined:0 }`.

`cores.sell.test.ts`: with a station present and cargo, `coreSell('u1','all')` deducts inventory + adds credits and returns `{ ok:true, credits }`; with no station → `{ ok:false, reason:/station/i }`.

(Write these mirroring the mock style of Task 1; assert the key calls + return shape.)

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** in `cores.ts`:
```ts
const RESOURCES: Array<'ore' | 'gas' | 'crystal'> = ['ore', 'gas', 'crystal'];

export async function coreMine(
  playerId: string, mode: 'until_full' | 'amount', amount: number,
): Promise<CoreResult<{ mined: number }>> {
  const pos = (await getPlayerPosition(playerId)) ?? { x: 0, y: 0 };
  const stats = await shipStats(playerId);
  const cap = stats.cargoCap ?? 0;
  const total = await getResourceTotal(playerId);
  let space = Math.max(0, cap - total);
  if (mode === 'amount') space = Math.min(space, amount);
  if (space <= 0) return { ok: false, reason: 'Frachtraum voll' };

  const sector = await getSector(pos.x, pos.y);
  const res = sector?.resources ?? { ore: 0, gas: 0, crystal: 0 };
  let mined = 0;
  for (const r of RESOURCES) {
    if (space <= 0) break;
    const avail = (res as Record<string, number>)[r] ?? 0;
    const take = Math.min(avail, space);
    if (take <= 0) continue;
    await addToInventory(playerId, 'resource', r, take);
    await updateSectorResources(pos.x, pos.y, r, -take);
    mined += take; space -= take;
  }
  return { ok: true, mined };
}

// coreSell: reuse EconomyService's sell helpers. Recommended: in Task 2 also extract the
// sell branch of EconomyService.handleNpcTrade into an exported headless
// `sellResourceAtStation(playerId, sx, sy, resource, amount): Promise<{ credits: number } | null>`
// (null when no station / cannot sell), and have the existing handler call it too (single source).
// Then:
export async function coreSell(
  playerId: string, target: 'all' | 'ore' | 'gas' | 'crystal',
): Promise<CoreResult<{ credits: number }>> {
  const pos = (await getPlayerPosition(playerId)) ?? { x: 0, y: 0 };
  const cargo = await getCargoState(playerId);
  const toSell = target === 'all' ? RESOURCES : [target];
  let credits = 0; let soldAny = false; let sawStation = false;
  for (const r of toSell) {
    const qty = (cargo as Record<string, number>)[r] ?? 0;
    if (qty <= 0) continue;
    const result = await sellResourceAtStation(playerId, pos.x, pos.y, r, qty); // from EconomyService
    if (result === null) { /* no station here */ continue; }
    sawStation = true; soldAny = true; credits += result.credits;
  }
  if (!sawStation) return { ok: false, reason: 'Keine Station hier zum Verkaufen' };
  return { ok: true, credits };
}
```
> Add the `sellResourceAtStation` import. If extracting from EconomyService is too invasive, implement `sellResourceAtStation` in `cores.ts` reusing the same query functions the handler uses (`canSellToStation`, price calc, station inventory upsert, `removeFromInventory`, `addCredits`, `recordTrade`) — but prefer extraction so manual + automated selling share one implementation. Document which you did in the commit.

- [ ] **Step 4: run mine+sell tests → PASS; build server.**

- [ ] **Step 5: commit**
```bash
git add packages/server/src/engine/automation/cores.ts packages/server/src/engine/automation/__tests__/cores.mine.test.ts packages/server/src/engine/automation/__tests__/cores.sell.test.ts packages/server/src/rooms/services/EconomyService.ts
git commit -m "feat: automation action-cores — mine & sell (headless, reuse economy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Condition evaluator (server)

**Files:** create `packages/server/src/engine/automation/conditions.ts`; test `__tests__/conditions.test.ts`.

- [ ] **Step 1: failing test** — mock position/sector/cargo/fuel/ship reads; assert each `Condition` kind + negation:
  - `resources`: true when sector has any ore/gas/crystal > 0.
  - `full`: true when `getResourceTotal >= cargoCap`.
  - `empty`: true when total === 0.
  - `fuel_lt`: true when fuel < value.
  - `at`: true when position equals x/y.
  - `station`: true when an NPC/player station exists at the sector (mock `getSector().type === 'station'` OR a station lookup).
  - negate flips each.

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** `conditions.ts`:
```ts
import type { Condition } from '@void-sector/shared';
import { calculateShipStats } from '@void-sector/shared';
import { getPlayerPosition, getFuelState } from '../../rooms/services/RedisAPStore.js';
import { getActiveShip, getSector } from '../../db/queries.js';
import { getResourceTotal } from '../inventoryService.js';

async function isStationHere(x: number, y: number): Promise<boolean> {
  const sector = await getSector(x, y);
  return sector?.type === 'station'; // confirm: also check player stations if SELL should work there
}

export async function evaluateCondition(playerId: string, c: Condition): Promise<boolean> {
  const v = await rawCondition(playerId, c);
  return c.negate ? !v : v;
}

async function rawCondition(playerId: string, c: Condition): Promise<boolean> {
  const pos = (await getPlayerPosition(playerId)) ?? { x: 0, y: 0 };
  switch (c.kind) {
    case 'resources': {
      const s = await getSector(pos.x, pos.y);
      const r = s?.resources ?? { ore: 0, gas: 0, crystal: 0 };
      return (r.ore ?? 0) > 0 || (r.gas ?? 0) > 0 || (r.crystal ?? 0) > 0;
    }
    case 'full': {
      const ship = await getActiveShip(playerId);
      const cap = calculateShipStats(ship?.modules ?? []).cargoCap ?? 0;
      return (await getResourceTotal(playerId)) >= cap;
    }
    case 'empty':
      return (await getResourceTotal(playerId)) === 0;
    case 'fuel_lt':
      return ((await getFuelState(playerId)) ?? 0) < c.value;
    case 'at':
      return pos.x === c.x && pos.y === c.y;
    case 'station':
      return isStationHere(pos.x, pos.y);
  }
}
```

- [ ] **Step 4: run → PASS; build server.**

- [ ] **Step 5: commit**
```bash
git add packages/server/src/engine/automation/conditions.ts packages/server/src/engine/automation/__tests__/conditions.test.ts
git commit -m "feat: automation condition evaluator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: VM step machine (server)

**Files:** create `packages/server/src/engine/automation/vm.ts`; test `__tests__/vm.test.ts`.

The VM is pure: it takes injected `ctx` (action-cores + `evaluateCondition`) so it's tested with fakes — no DB.

- [ ] **Step 1: failing test** — `vm.test.ts` builds programs via `compileProgram` (real, from shared) and drives `stepProgram` with a FAKE ctx that records calls and returns canned results. Assert:
  - A `fly 2:0` instruction takes 2 steps (one sector each) then pc advances; ctx.move called twice.
  - `scan`/`sell`/`mine` advance pc in one step and call the right core.
  - `if resources:` branches on the fake condition value (true → enters block; false → jumps past).
  - `repeat:` (infinite) loops back; `repeat 2 times:` runs body twice then exits.
  - A core returning `{ok:false, reason}` sets status `paused` and does NOT advance pc.
  - Program end with mode 'once' → `finished:true`; mode 'loop' → pc resets to 0.

```ts
import { describe, it, expect, vi } from 'vitest';
import { compileProgram } from '@void-sector/shared';
import { stepProgram, initialVmState } from '../vm.js';

function fakeCtx(over: Partial<any> = {}) {
  return {
    move: vi.fn(async (_pid: string, _tx: number, _ty: number) => ({ ok: true, x: 0, y: 0, arrived: true })),
    scan: vi.fn(async () => ({ ok: true, resources: { ore: 0, gas: 0, crystal: 0 } })),
    mine: vi.fn(async () => ({ ok: true, mined: 0 })),
    sell: vi.fn(async () => ({ ok: true, credits: 0 })),
    evalCond: vi.fn(async () => true),
    ...over,
  };
}
const ok = (src: string) => { const r = compileProgram(src, { level: 5, maxLength: 120 }); if (!r.ok) throw new Error('compile'); return r.instructions; };

describe('stepProgram', () => {
  it('fly takes one sector per step until arrival', async () => {
    const instr = ok('fly 2:0\nscan');
    const ctx = fakeCtx({
      move: vi.fn()
        .mockResolvedValueOnce({ ok: true, x: 1, y: 0, arrived: false })
        .mockResolvedValueOnce({ ok: true, x: 2, y: 0, arrived: true }),
    });
    let pc = 0, vm = initialVmState();
    let r = await stepProgram('u1', instr, pc, vm, ctx); pc = r.pc; vm = r.vm; // step 1: move
    expect(ctx.move).toHaveBeenCalledTimes(1); expect(pc).toBe(0);
    r = await stepProgram('u1', instr, pc, vm, ctx); pc = r.pc; vm = r.vm; // step 2: move arrives → pc++
    expect(pc).toBe(1);
  });

  it('pauses without advancing when a core fails', async () => {
    const instr = ok('scan');
    const ctx = fakeCtx({ scan: vi.fn(async () => ({ ok: false, reason: 'Nicht genug AP' })) });
    const r = await stepProgram('u1', instr, 0, initialVmState(), ctx);
    expect(r.status).toBe('paused'); expect(r.pc).toBe(0);
  });

  it('if-false jumps past the then-block', async () => {
    const instr = ok('if resources:\n  mine until full\nscan');
    const ctx = fakeCtx({ evalCond: vi.fn(async () => false) });
    const r = await stepProgram('u1', instr, 0, initialVmState(), ctx);
    expect(ctx.mine).not.toHaveBeenCalled();
    // pc should now point at the SCAN instruction (after the then-block)
    expect(instr[r.pc].op).toBe('SCAN');
  });

  it('repeat 2 times runs the body twice then exits', async () => {
    const instr = ok('repeat 2 times:\n  scan');
    let pc = 0, vm = initialVmState(); let scans = 0;
    const ctx = fakeCtx({ scan: vi.fn(async () => { scans++; return { ok: true, resources: { ore: 0, gas: 0, crystal: 0 } }; }) });
    for (let i = 0; i < 20; i++) { const r = await stepProgram('u1', instr, pc, vm, ctx); pc = r.pc; vm = r.vm; if (r.finished || r.status === 'idle') break; }
    expect(scans).toBe(2);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** `vm.ts`:
```ts
import type { Instr, Condition } from '@void-sector/shared';

export interface VmState { loops: number[]; fly: { tx: number; ty: number } | null; }
export const initialVmState = (): VmState => ({ loops: [], fly: null });

export interface VmCtx {
  move: (playerId: string, tx: number, ty: number) => Promise<{ ok: true; x: number; y: number; arrived: boolean } | { ok: false; reason: string }>;
  scan: (playerId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  mine: (playerId: string, mode: 'until_full' | 'amount', amount: number) => Promise<{ ok: true; mined: number } | { ok: false; reason: string }>;
  sell: (playerId: string, target: 'all' | 'ore' | 'gas' | 'crystal') => Promise<{ ok: true; credits: number } | { ok: false; reason: string }>;
  evalCond: (playerId: string, c: Condition) => Promise<boolean>;
}

export interface StepResult { pc: number; vm: VmState; status: 'running' | 'paused' | 'idle'; finished: boolean; log?: { level: 'info' | 'warn'; message: string }; }

/** Execute exactly one VM step. `mode` controls end-of-program behavior. */
export async function stepProgram(
  playerId: string, instr: Instr[], pc: number, vm: VmState, ctx: VmCtx, mode: 'once' | 'loop' = 'loop',
): Promise<StepResult> {
  if (pc >= instr.length) {
    if (mode === 'loop') return { pc: 0, vm, status: 'running', finished: false };
    return { pc, vm, status: 'idle', finished: true };
  }
  const op = instr[pc];
  const loops = [...vm.loops];
  switch (op.op) {
    case 'FLY': {
      const r = await ctx.move(playerId, op.x, op.y);
      if (!r.ok) return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      if (r.arrived) return { pc: pc + 1, vm: { ...vm, fly: null }, status: 'running', finished: false };
      return { pc, vm: { ...vm, fly: { tx: op.x, ty: op.y } }, status: 'running', finished: false };
    }
    case 'SCAN': {
      const r = await ctx.scan(playerId);
      if (!r.ok) return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      return { pc: pc + 1, vm, status: 'running', finished: false };
    }
    case 'MINE': {
      const r = await ctx.mine(playerId, op.mode, op.amount);
      if (!r.ok) return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      return { pc: pc + 1, vm, status: 'running', finished: false, log: { level: 'info', message: `${r.mined} abgebaut` } };
    }
    case 'SELL': {
      const r = await ctx.sell(playerId, op.target);
      if (!r.ok) return { pc, vm, status: 'paused', finished: false, log: { level: 'warn', message: r.reason } };
      return { pc: pc + 1, vm, status: 'running', finished: false, log: { level: 'info', message: `${r.credits} Credits erhalten` } };
    }
    case 'JUMP_IF_FALSE': {
      const truthy = await ctx.evalCond(playerId, op.cond);
      return { pc: truthy ? pc + 1 : op.target, vm, status: 'running', finished: false };
    }
    case 'JUMP':
      return { pc: op.target, vm, status: 'running', finished: false };
    case 'PUSH_LOOP':
      loops.push(op.count);
      return { pc: pc + 1, vm: { ...vm, loops }, status: 'running', finished: false };
    case 'LOOP_CHECK': {
      const top = loops[loops.length - 1];
      if (top === 0) { loops.pop(); return { pc: op.target, vm: { ...vm, loops }, status: 'running', finished: false }; }
      return { pc: pc + 1, vm, status: 'running', finished: false };
    }
    case 'LOOP_NEXT': {
      if (loops[loops.length - 1] > 0) loops[loops.length - 1] -= 1;
      return { pc: op.target, vm: { ...vm, loops }, status: 'running', finished: false };
    }
  }
}
```

- [ ] **Step 4: run → PASS; build server.**

- [ ] **Step 5: commit**
```bash
git add packages/server/src/engine/automation/vm.ts packages/server/src/engine/automation/__tests__/vm.test.ts
git commit -m "feat: automation VM step machine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: ShipComputerService + online executor + room wiring (server)

**Files:** create `packages/server/src/rooms/services/ShipComputerService.ts`; modify `packages/server/src/rooms/SectorRoom.ts`; test `__tests__/shipComputerService.test.ts`.

This is integration-heavy. READ `SectorRoom.ts` around `onMessage` registration (~464), the `ServiceContext` shape (~380), `getShipForClient`, `onJoin`/`onLeave` (online_players + autopilotTimers cleanup). Mirror the autopilot timer lifecycle.

Service responsibilities (each a method; mostly DB via `programQueries` + compile via shared):
- `handleSaveProgram(client, { name, source, mode })`: read computer level (`getShipComputerLevel(ship.modules)`; 0 → error "Kein Bordcomputer"); resolve maxLength from `getConfig('AUTOMATION_MAXLEN_MK'+level)` (fallback `AUTOMATION_PROGRAM_LIMITS[level]`); `compileProgram(source, { level, maxLength })`; on `!ok` → `client.send('programError', { errors })`; on ok → `programQueries.createProgram(...)` → `client.send('programSaved', row)`.
- `handleListPrograms(client)` → `programQueries.listProgramsForPlayer` → `client.send('programList', rows)`.
- `handleDeleteProgram(client, { id })`, `handleSetActive(client, { id })`.
- `handleStartProgram(client, { id })`: load program; recompute level + compile (authoritative); set active; init state `{pc:0, vm:initialVmState(), status:'running'}` via `saveProgramState`; start the online executor timer for this player.
- `handleStopProgram(client)`: clear timer; `saveProgramState(status:'idle')` (or `clearProgramState`).
- Online executor: `startExecutor(client, playerId, program)` — `setInterval` at `getConfig('AUTOMATION_SCHEDULER_INTERVAL_MS')` (default 1000) that: loads state, builds the real `VmCtx` (binding the cores from `cores.ts` + `evaluateCondition`), calls `stepProgram(...)`, persists `saveProgramState`, appends logs (`appendProgramLog`), and sends `client.send('programState', {...})` + action HUD updates (`apUpdate`/`cargoUpdate`/`creditsUpdate`/`sectorData` as relevant). On `paused`/`idle`/`finished`: clear the timer + persist + notify. Store timers in a `Map<sessionId, NodeJS.Timeout>` like `autopilotTimers`; clear on `onLeave`.
- Resume on join: in `onJoin`, if an active program with state.status==='running' exists for the player, restart the executor (mirrors autopilot resume). Offline progress (Task 6) means state may have advanced while away.

Register in `SectorRoom` constructor: `this.shipComputer = new ShipComputerService(this.serviceCtx);` and `this.onMessage('saveProgram'|'listPrograms'|'deleteProgram'|'setActiveProgram'|'startProgram'|'stopProgram', ...)` delegating to the service. In `onLeave`, clear the player's executor timer (do NOT pause the program's persisted status — leave it 'running' so the offline scheduler can pick it up if computer level >= 4; if level < 4, set status 'paused' with reason 'offline').

- [ ] **Step 1: failing test** — `shipComputerService.test.ts` (mock `programQueries`, `cores`, `vm`, shared `compileProgram`/`getShipComputerLevel`, and a fake `client`/`ctx`): assert
  - save with computer level 0 → sends `programError` (kein Computer), no DB write.
  - save with valid program + level 3 → `createProgram` called, `programSaved` sent.
  - save with a too-complex program for the level → `programError` with compile errors.
  - start → sets active + saves running state + starts a timer (assert `saveProgramState` called with status 'running').
  (Use fake timers / assert the immediate effects; do not assert interval internals.)

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** the service + wiring following the patterns above and the autopilot timer model. Bind the executor's `VmCtx` to the real cores:
```ts
const ctx: VmCtx = {
  move: coreMoveOneSector, scan: coreScan, mine: coreMine, sell: coreSell,
  evalCond: evaluateCondition,
};
```
Keep the service file focused; if it grows large, that's expected for a coordinator — but factor the executor loop into a private method.

- [ ] **Step 4: run service test → PASS; build server; run FULL server suite** (`npx vitest run`) → no regressions.

- [ ] **Step 5: commit**
```bash
git add packages/server/src/rooms/services/ShipComputerService.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/engine/automation/__tests__/shipComputerService.test.ts
git commit -m "feat: ShipComputerService — program CRUD + online executor + room wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Offline scheduler + bootstrap (server)

**Files:** create `packages/server/src/engine/automation/offlineScheduler.ts`; modify `packages/server/src/engine/universeBootstrap.ts`; test `__tests__/offlineScheduler.test.ts`.

The scheduler is ONE global timer with hard caps. READ `universeBootstrap.ts` for where global services start + the redis handle + `online_players` set access.

Scheduler `tickOffline()`:
1. `programQueries.getOfflineActivePrograms()` → candidate states (status running/paused).
2. Filter to players NOT in Redis `online_players` (offline only).
3. Filter to players whose computer level >= 4 (offline unlock) — need ship modules; load via `getActiveShip` + `getShipComputerLevel`. If level < 4 → set status 'paused' reason 'Offline-Ausführung braucht MK.IV' and skip.
4. Enforce offline-window cap: if `now - last_tick`... (better: track elapsed since program went offline; simplest MVP: cap total offline runtime per program via a stored timestamp — store `offline_since` in vm_state when first run offline; if `now - offline_since > windowHours` → pause reason 'Offline-Reichweite erreicht').
5. Round-robin up to `getConfig('AUTOMATION_MAX_CONCURRENT_OFFLINE')` programs per tick; for each, run up to a per-program step budget bounded by `getConfig('AUTOMATION_TICK_WORK_BUDGET') / N`. Each step uses the SAME `VmCtx` (real cores) + `stepProgram`, persisting `saveProgramState` + `appendProgramLog`. No client sends (offline).
6. Wrap everything in try/catch; never throw out of the interval.

Bootstrap: in `universeBootstrap.ts` start `setInterval(() => offlineScheduler.tickOffline().catch(logErr), getConfig('AUTOMATION_SCHEDULER_INTERVAL_MS'))` after the other global services. Log start.

- [ ] **Step 1: failing test** — `offlineScheduler.test.ts` (mock programQueries, online set, getActiveShip/getShipComputerLevel, cores/vm): assert
  - only offline players are processed (online ones skipped).
  - players with computer level < 4 get paused with the MK.IV reason and are not stepped.
  - the concurrency cap limits how many programs are stepped per tick.
  - an exception in one program does not abort the whole tick.

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** `offlineScheduler.ts` + wire into `universeBootstrap.ts`.

- [ ] **Step 4: run scheduler test → PASS; build server; FULL server suite green.**

- [ ] **Step 5: commit**
```bash
git add packages/server/src/engine/automation/offlineScheduler.ts packages/server/src/engine/universeBootstrap.ts packages/server/src/engine/automation/__tests__/offlineScheduler.test.ts
git commit -m "feat: offline program scheduler (capped) + bootstrap wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§3):** headless cores (T1-T2) ✅; condition eval (T3) ✅; VM with jump/loop semantics matching Plan 1 bytecode (T4) ✅; online executor + program CRUD + compile-with-level-gating + resume (T5) ✅; offline scheduler with concurrency cap + work budget + offline-window cap + MK.IV gate (T6) ✅; safety-net = combat-free executor (approved scope) ✅.

**Deferred (documented):** combat-while-automated + damage/drift (later iteration); unifying ALL manual handlers onto cores (only SELL is extracted for price-parity; move/scan/mine cores reuse the same primitives but the manual handlers keep their richer side-effects — acceptable, noted).

**Placeholder notes:** T1/T2/T5/T6 require reading the named files to confirm exact import paths/signatures (RedisAPStore, queries, inventoryService, EconomyService, worldgen, ServiceContext, universeBootstrap) and adjusting — this is necessary verification, not vague TODO; the behavior is fully specified.

**Type consistency:** `CoreResult`, `VmCtx`, `VmState`, `StepResult` defined once and reused; `stepProgram` signature stable; VM op handling matches Plan 1's `Instr` union and the documented loop runtime contract (PUSH_LOOP/-1 infinite, LOOP_CHECK exit-on-0, LOOP_NEXT decrement-if->0).

**Risk:** T5/T6 are integration-heavy and harder to unit-test fully; tests cover the pure VM/cores/conditions thoroughly and the service/scheduler at the decision-logic level (mocked). End-to-end is verified in the browser after Plan 4.
