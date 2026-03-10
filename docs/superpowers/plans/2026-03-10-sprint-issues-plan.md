# Sprint Issues Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 open issues + ACEP-Panel roadmap item across 5 independent blocks: ACEP Panel, Modul-Umbau, Wissen-Integration, Quest-Erfüllung, Animation-Fix + QuadMap Fog-of-War.

**Architecture:** Each block is independently deployable. Blocks A+C share the Wissen-Deduct-Path (Block C adds Wissen, Block A spends it) — implement C before A if running sequentially. Block E.1 (#243) is a trivial 1-line fix; start there.

**Tech Stack:** TypeScript strict · Colyseus (server rooms) · React + Zustand (client) · PostgreSQL + Redis · Vitest

**Spec:** `docs/superpowers/specs/2026-03-10-sprint-issues-design.md`

> **⚠ Spec correction:** The spec says `addWissen(shipId, ...)` against `ships.wissen`. This is wrong. Wissen lives in `player_research.wissen`. Always use `addWissen(userId, amount)` / `deductWissen(userId, amount)` / `getWissen(userId)` from `queries.ts` with the **player's user ID**, never a ship ID.

---

## Chunk 1: Block E.1 — Smooth Sector Move (#243)

**Root cause:** In `packages/client/src/network/client.ts` (~line 148–152), `resetPan()` is called synchronously after `startShipMoveAnimation()`, snapping the viewport before the 600ms animation completes.

### Files
- Modify: `packages/client/src/network/client.ts` (~line 151)

### Task 1: Fix resetPan timing

- [ ] **Read** `packages/client/src/network/client.ts` lines 138–160 to confirm exact location of `resetPan()` call after `startShipMoveAnimation`.

- [ ] **Apply fix** — delay resetPan by animation duration:

```typescript
// packages/client/src/network/client.ts  — inside joinSector(), same-quadrant branch
// BEFORE:
store.startShipMoveAnimation(oldPos.x, oldPos.y, x, y);
store.setPosition({ x, y });
store.resetPan();          // ← snap → ruckt
store.addLogEntry(`Entered sector (${x}, ${y})`);

// AFTER:
store.startShipMoveAnimation(oldPos.x, oldPos.y, x, y);
store.setPosition({ x, y });
setTimeout(() => useStore.getState().resetPan(), 600); // match animation duration
store.addLogEntry(`Entered sector (${x}, ${y})`);
```

- [ ] **Verify** no existing tests break:

```bash
cd packages/client && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass (no test covers this timing path).

- [ ] **Commit:**

```bash
git add packages/client/src/network/client.ts
git commit -m "fix(#243): delay resetPan by 600ms to match moveSector animation"
```

---

## Chunk 2: Block C — Wissen-Integration (#248)

### Files
- Modify: `packages/server/src/rooms/services/ScanService.ts`
- Modify: `packages/server/src/rooms/services/QuestService.ts`
- Modify: `packages/shared/src/types.ts` — add `wissen?: number` to `QuestRewards`
- Modify: `packages/client/src/components/TechTreePanel.tsx` — show Wissen in header
- Modify: `packages/client/src/components/HUD.tsx` (or `SectorInfo`) — show Wissen in Section 5
- Test: `packages/server/src/__tests__/wissenScan.test.ts` (new)

**Key facts:**
- `getWissen(userId)` and `addWissen(userId, amount)` already exist in `packages/server/src/db/queries.ts`
- `deductWissen(userId, amount)` also exists (returns boolean)
- `ResearchState` in `packages/shared/src/types.ts` already has `wissen?: number`
- Redis key for daily cap: `wissen_daily:{userId}:{YYYY-MM-DD}` (TTL 26h)
- `ScanService` has `ctx.redis` for Redis access

### Task 2: Shared — add `wissen` to QuestRewards

- [ ] **Read** `packages/shared/src/types.ts` lines 618–626 to confirm `QuestRewards` interface.

- [ ] **Edit** `packages/shared/src/types.ts`:

```typescript
// Find QuestRewards interface, add wissen field:
export interface QuestRewards {
  credits: number;
  xp: number;
  reputation: number;
  reputationPenalty?: number;
  rivalFactionId?: NpcFactionId;
  wissen?: number;   // ← ADD
}
```

- [ ] **Build shared:**

```bash
cd packages/shared && npm run build
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add packages/shared/src/types.ts packages/shared/dist
git commit -m "feat(#248): add wissen field to QuestRewards"
```

### Task 3: Server — Wissen-Daily-Cap helper

- [ ] **Read** `packages/server/src/rooms/services/ScanService.ts` lines 1–30 to check Redis usage pattern.

- [ ] **Add** a helper function at the top of `ScanService.ts` (before the class):

```typescript
// packages/server/src/rooms/services/ScanService.ts
// Add after imports:

const WISSEN_DAILY_CAP_BASE = 200;
const WISSEN_DAILY_CAP_FRONTIER = 300; // Q-dist > 3 from origin

function todayKey(userId: string): string {
  return `wissen_daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

async function addWissenCapped(
  redis: import('ioredis').Redis,
  userId: string,
  amount: number,
  isFrontier: boolean,
): Promise<number> {
  const cap = isFrontier ? WISSEN_DAILY_CAP_FRONTIER : WISSEN_DAILY_CAP_BASE;
  const key = todayKey(userId);
  const current = Number(await redis.get(key) ?? '0');
  const remaining = Math.max(0, cap - current);
  const actual = Math.min(amount, remaining);
  if (actual <= 0) return 0;
  await redis.set(key, current + actual, 'EX', 93600); // 26h TTL
  return actual;
}
```

- [ ] **Write failing test** in `packages/server/src/__tests__/wissenScan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addWissenCapped } from '../rooms/services/ScanService.js'; // will need export

describe('addWissenCapped', () => {
  let redis: any;
  beforeEach(() => {
    redis = { get: vi.fn(), set: vi.fn() };
  });

  it('adds wissen up to base cap', async () => {
    redis.get.mockResolvedValue('150');
    const added = await addWissenCapped(redis, 'u1', 100, false);
    expect(added).toBe(50); // cap 200 - current 150 = 50
  });

  it('uses frontier cap when isFrontier', async () => {
    redis.get.mockResolvedValue('150');
    const added = await addWissenCapped(redis, 'u1', 100, true);
    expect(added).toBe(100); // cap 300 - current 150 = 150, capped at request 100
  });

  it('returns 0 when cap exhausted', async () => {
    redis.get.mockResolvedValue('200');
    const added = await addWissenCapped(redis, 'u1', 50, false);
    expect(added).toBe(0);
  });
});
```

- [ ] **Export** `addWissenCapped` from `ScanService.ts` (add `export` keyword).

- [ ] **Run test:**

```bash
cd packages/server && npx vitest run src/__tests__/wissenScan.test.ts
```

Expected: PASS (3 tests).

- [ ] **Commit:**

```bash
git add packages/server/src/rooms/services/ScanService.ts \
        packages/server/src/__tests__/wissenScan.test.ts
git commit -m "feat(#248): add Wissen daily-cap helper with Redis"
```

### Task 4: Server — Area-Scan Wissen (+1 pro neuer Sektor)

- [ ] **Read** `packages/server/src/rooms/services/ScanService.ts` — find `handleAreaScan` method. Look for where newly discovered sectors are counted (search for `addDiscoveries` or the sector-discovery check).

- [ ] **Find** the block where area scan determines new vs. known sectors. After the existing discovery logic, add:

```typescript
// Inside handleAreaScan, after discovering sectors:
// (find: const newSectors = ... or similar count of newly discovered sectors)
// isFrontier: Q-dist from origin
const isFrontier = Math.max(Math.abs(this.ctx.quadrantX), Math.abs(this.ctx.quadrantY)) > 3;
if (newSectorCount > 0) {
  const wissenGained = await addWissenCapped(
    this.ctx.redis, auth.userId, newSectorCount, isFrontier,
  );
  if (wissenGained > 0) {
    await addWissen(auth.userId, wissenGained);
    // researchState push happens via existing handleGetResearchState or onJoin
  }
}
```

Note: `addWissen` is already imported from `queries.js` in other services — add import to ScanService if missing.

- [ ] **Run server tests:**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Commit:**

```bash
git add packages/server/src/rooms/services/ScanService.ts
git commit -m "feat(#248): area scan awards +1 Wissen per newly discovered sector"
```

### Task 5: Server — Local-Scan Wissen (+10/+25 pro Sektor)

- [ ] **Read** `packages/server/src/rooms/services/ScanService.ts` — find `handleLocalScan`. Locate where sector type is checked and where the result is sent to the client.

- [ ] **Add** Wissen logic after the scan result is computed but before `client.send`:

```typescript
// Classify sector for Wissen bonus
function wissenForSector(sectorType: string, neighborType?: string): number {
  const special = ['anomaly', 'asteroid_field', 'nebula'].includes(sectorType)
    || neighborType === 'black_hole'
    || neighborType === 'star';
  return special ? 25 : 10;
}

// Inside handleLocalScan, after scan result computed:
// Only award Wissen for unknown / first-time scan of this sector
const isNewSector = !knownSectorIds.has(`${sector.x}:${sector.y}`); // adapt to existing check
if (isNewSector) {
  const base = wissenForSector(sector.type);
  const isFrontier = Math.max(Math.abs(this.ctx.quadrantX), Math.abs(this.ctx.quadrantY)) > 3;
  const wissenGained = await addWissenCapped(this.ctx.redis, auth.userId, base, isFrontier);
  if (wissenGained > 0) await addWissen(auth.userId, wissenGained);
}
```

- [ ] **Run server tests:**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/server/src/rooms/services/ScanService.ts
git commit -m "feat(#248): local scan awards +10/+25 Wissen per new sector with daily cap"
```

### Task 6: Server — Quest rewards Wissen

- [ ] **Read** `packages/server/src/rooms/services/QuestService.ts` lines ~290–340 — find the block where `rewards.credits` and `rewards.xp` are awarded after quest completion.

- [ ] **Add** Wissen award after existing reward lines:

```typescript
// After: if (rewards.xp) await this.applyXpGain(...)
if (rewards.wissen) {
  await addWissen(auth.userId, rewards.wissen);
}
```

- [ ] **Update** quest templates to include Wissen in rewards. Search for `generateDiplomacyQuest`, `generateWarSupportQuest`, and community-quest definitions. Add `wissen` values:
  - Delivery quests: `wissen: 2`
  - Exploration/scan quests: `wissen: 3`
  - Community quests: `wissen: 5`

- [ ] **Commit:**

```bash
git add packages/server/src/rooms/services/QuestService.ts
git commit -m "feat(#248): quest completion rewards Wissen (2/3/5 by type)"
```

### Task 7: Client — Show Wissen in HUD Section 5

- [ ] **Read** `packages/client/src/components/HUD.tsx` (or wherever `SectorInfo` / credits display lives in Section 5) to find credits display.

- [ ] **Find** the credits display element. Add Wissen next to it:

```tsx
// In SectorInfo or Section 5 HUD component, after credits display:
const wissen = useStore((s) => s.research.wissen ?? 0);

// In JSX, next to credits:
<span style={{ color: 'var(--color-primary)', marginLeft: 8 }}>
  ◈ {wissen} W
</span>
```

- [ ] **Read** `packages/client/src/components/TechTreePanel.tsx` — find the header area.

- [ ] **Add** Wissen display to TechTreePanel header:

```tsx
const wissen = useStore((s) => s.research.wissen ?? 0);
// In header JSX:
<span style={{ opacity: 0.8 }}>◈ WISSEN: {wissen}</span>
```

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/client/src/components/
git commit -m "feat(#248): display Wissen in Section 5 HUD and TECH panel"
```

---

## Chunk 3: Block A — ACEP-Panel (#239, #246 + Roadmap UI)

### Files
- Modify: `packages/server/src/db/queries.ts` — extend `getActiveShip`/`getPlayerShips` to include `acep_generation`, `acep_traits`
- Modify: `packages/server/src/rooms/services/ShipService.ts` — include generation + traits in ship push; add `handleAcepBoost`
- Modify: `packages/server/src/rooms/SectorRoom.ts` — register `acepBoost` message handler
- Modify: `packages/server/src/engine/acepXpService.ts` — add `getBoostCost()`, `boostAcepPath()`
- Modify: `packages/client/src/components/HangarPanel.tsx` — rewrite as ACEP panel
- Modify: `packages/client/src/state/gameSlice.ts` — add `acepGeneration`, `acepTraits` to ShipState
- Modify: `packages/client/src/network/client.ts` — add `sendAcepBoost()`
- Test: `packages/server/src/engine/__tests__/acepBoost.test.ts` (new)

**Key facts:**
- `wissen` is in `player_research.wissen` — use `deductWissen(userId, amount)` from `queries.ts`
- `deductCredits(playerId, amount)` already in `queries.ts`
- `acep_generation` and `acep_traits` columns exist in `ships` table (migration 039) but are NOT in the current SELECT queries
- `calculateTraits(xp)` from `traitCalculator.ts` returns `AcepTrait[]`
- Wissen balance is NOT pushed automatically — it comes via `researchState` message. For the boost button, the client needs to know current wissen, which it already has via `useStore(s => s.research.wissen)`.

### Task 8: Shared — extend ShipRecord with ACEP fields (do this first)

- [ ] **Read** `packages/shared/src/types.ts` line ~1127 — confirm `ShipRecord` interface.

- [ ] **Edit** `packages/shared/src/types.ts` — add to `ShipRecord`:

```typescript
export interface ShipRecord {
  id: string;
  ownerId: string;
  hullType: HullType;
  name: string;
  modules: ShipModule[];
  active: boolean;
  createdAt: string;
  shipColor?: string;
  acepGeneration?: number;   // ← ADD
  acepTraits?: string[];     // ← ADD
}
```

- [ ] **Build shared:**

```bash
cd packages/shared && npm run build
```

- [ ] **Commit:**

```bash
git add packages/shared/src/types.ts packages/shared/dist
git commit -m "feat(#239): extend ShipRecord with acepGeneration and acepTraits"
```

### Task 8b: Server — extend getActiveShip with ACEP generation + traits

- [ ] **Read** `packages/server/src/db/queries.ts` lines 119–165 (getActiveShip + getPlayerShips).

- [ ] **Edit** both queries to include `acep_generation` and `acep_traits`:

```typescript
// In getActiveShip:
// Change SELECT to:
`SELECT id, owner_id, hull_type, name, modules, fuel, active, created_at,
        acep_generation, acep_traits
 FROM ships WHERE owner_id = $1 AND active = TRUE LIMIT 1`

// In the return mapping, add:
acepGeneration: row.acep_generation ?? 1,
acepTraits: (row.acep_traits ?? []) as string[],
```

Apply the same change to `getPlayerShips`.

- [ ] **Update** `ShipRecord` type (if defined in queries.ts) to include `acepGeneration: number` and `acepTraits: string[]`.

- [ ] **Run server tests:**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(#239): include acep_generation and acep_traits in getActiveShip queries"
```

### Task 9: Server — boostAcepPath() in acepXpService

- [ ] **Read** `packages/server/src/engine/acepXpService.ts` in full to understand existing structure.

- [ ] **Write failing test** `packages/server/src/engine/__tests__/acepBoost.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBoostCost, BOOST_COST_TIERS } from '../acepXpService.js';

describe('getBoostCost', () => {
  it('returns tier 0 cost at 0 XP', () => {
    expect(getBoostCost(0)).toEqual({ credits: 100, wissen: 3 });
  });
  it('returns tier 0 cost at 19 XP', () => {
    expect(getBoostCost(19)).toEqual({ credits: 100, wissen: 3 });
  });
  it('returns tier 1 cost at 20 XP', () => {
    expect(getBoostCost(20)).toEqual({ credits: 300, wissen: 8 });
  });
  it('returns tier 2 cost at 40 XP', () => {
    expect(getBoostCost(40)).toEqual({ credits: 600, wissen: 15 });
  });
  it('returns null at cap (50 XP)', () => {
    expect(getBoostCost(50)).toBeNull();
  });
});
```

- [ ] **Run test to confirm it fails:**

```bash
cd packages/server && npx vitest run src/engine/__tests__/acepBoost.test.ts
```

Expected: FAIL — `getBoostCost is not exported`.

- [ ] **Add** to `packages/server/src/engine/acepXpService.ts`:

```typescript
export const BOOST_COST_TIERS = [
  { minXp: 40, credits: 600, wissen: 15 },
  { minXp: 20, credits: 300, wissen: 8 },
  { minXp: 0,  credits: 100, wissen: 3 },
] as const;

/** Returns boost cost for +5 XP at the given current-path XP, or null if at cap. */
export function getBoostCost(currentXp: number): { credits: number; wissen: number } | null {
  if (currentXp >= ACEP_PATH_CAP) return null;
  const tier = BOOST_COST_TIERS.find((t) => currentXp >= t.minXp)!;
  return { credits: tier.credits, wissen: tier.wissen };
}

/**
 * Spend Credits + Wissen to add +5 XP to a path.
 * Returns error string on failure, undefined on success.
 */
export async function boostAcepPath(
  shipId: string,
  path: AcepPath,
  playerId: string,
): Promise<string | undefined> {
  const xp = await getAcepXpSummary(shipId);
  if (xp.total >= ACEP_TOTAL_CAP) return 'ACEP-Gesamt-Cap erreicht';
  const currentPathXp = xp[path];
  const cost = getBoostCost(currentPathXp);
  if (!cost) return 'Pfad-Cap erreicht';

  const creditsOk = await deductCredits(playerId, cost.credits);
  if (!creditsOk) return 'Zu wenig Credits';

  const wissenOk = await deductWissen(playerId, cost.wissen);
  if (!wissenOk) {
    await addCredits(playerId, cost.credits); // refund
    return 'Zu wenig Wissen';
  }

  await addAcepXp(shipId, path, 5);
  return undefined; // success
}
```

Add imports at top of file:
```typescript
import { deductCredits, addCredits, deductWissen } from '../db/queries.js';
```

- [ ] **Run tests:**

```bash
cd packages/server && npx vitest run src/engine/__tests__/acepBoost.test.ts
```

Expected: PASS (5 tests).

- [ ] **Commit:**

```bash
git add packages/server/src/engine/acepXpService.ts \
        packages/server/src/engine/__tests__/acepBoost.test.ts
git commit -m "feat(#239): add getBoostCost() and boostAcepPath() to acepXpService"
```

### Task 10: Server — register acepBoost message handler

- [ ] **Read** `packages/server/src/rooms/services/ShipService.ts` lines 50–80 to see existing handler pattern.

- [ ] **Add** handler method to `ShipService`:

```typescript
async handleAcepBoost(client: Client, data: { path: AcepPath }): Promise<void> {
  const auth = client.auth as AuthPayload;
  const ship = await getActiveShip(auth.userId);
  if (!ship) { client.send('error', { code: 'NO_SHIP', message: 'Kein aktives Schiff' }); return; }

  const error = await boostAcepPath(ship.id, data.path, auth.userId);
  if (error) { client.send('actionError', error); return; }

  // Re-push updated ship state
  await this.handleGetShips(client);
  // Re-push wissen
  await this.handleGetResearchState(client); // or equivalent
}
```

Add import: `import { boostAcepPath, AcepPath } from '../../engine/acepXpService.js';`

- [ ] **Register** in `packages/server/src/rooms/SectorRoom.ts` — find where other ShipService handlers are registered (search for `handleGetShips`) and add:

```typescript
this.onMessage('acepBoost', (client, data) => this.services.ship.handleAcepBoost(client, data));
```

- [ ] **Run server tests:**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/server/src/rooms/services/ShipService.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(#239): register acepBoost message handler in ShipService + SectorRoom"
```

### Task 11: Client — add acepGeneration + acepTraits to ShipState

- [ ] **Read** `packages/client/src/state/gameSlice.ts` lines 60–90 to see ShipState interface.

- [ ] **Edit** ShipState in `gameSlice.ts`:

```typescript
// Add to ShipState interface:
acepGeneration?: number;
acepTraits?: string[];
```

- [ ] **Update** the place where `shipList` message sets ship state — make sure `acepGeneration` and `acepTraits` are mapped through (they come from the server's `shipList` response which now includes them from Task 8).

- [ ] **Add** `sendAcepBoost` to `packages/client/src/network/client.ts`:

```typescript
sendAcepBoost(path: 'ausbau' | 'intel' | 'kampf' | 'explorer') {
  this.sectorRoom?.send('acepBoost', { path });
}
```

- [ ] **Commit:**

```bash
git add packages/client/src/state/gameSlice.ts \
        packages/client/src/network/client.ts
git commit -m "feat(#239): add acepGeneration/acepTraits to ShipState; add sendAcepBoost()"
```

### Task 12: Client — rewrite HangarPanel as ACEP Panel

- [ ] **Read** `packages/client/src/components/HangarPanel.tsx` in full.

- [ ] **Overwrite** `packages/client/src/components/HangarPanel.tsx` with the ACEP Panel:

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';
import { getBoostCost } from '../../../server/src/engine/acepXpService'; // ← NO! import type only via shared
```

**Important:** The boost cost tiers must come from shared or be duplicated in the client (server logic should not be imported on client). Create a small helper in the client:

```typescript
// At top of HangarPanel.tsx (or in a small util):
type AcepPath = 'ausbau' | 'intel' | 'kampf' | 'explorer';
function boostCost(xp: number): { credits: number; wissen: number } | null {
  if (xp >= 50) return null;
  if (xp >= 40) return { credits: 600, wissen: 15 };
  if (xp >= 20) return { credits: 300, wissen: 8 };
  return { credits: 100, wissen: 3 };
}

const PATHS: Array<{ key: AcepPath; label: string; color: string }> = [
  { key: 'ausbau',   label: 'AUSBAU',   color: '#FFB000' },
  { key: 'intel',    label: 'INTEL',    color: '#00CFFF' },
  { key: 'kampf',    label: 'KAMPF',    color: '#FF4444' },
  { key: 'explorer', label: 'EXPLORER', color: '#00FF88' },
];
```

Full component:

```tsx
export function HangarPanel() {
  const ship = useStore((s) => s.ship);
  const wissen = useStore((s) => s.research.wissen ?? 0);
  const credits = useStore((s) => s.credits ?? 0);
  const [renamingShipId, setRenamingShipId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { network.sendGetShips(); }, []);

  if (!ship) return <div style={emptyStyle}>KEIN SCHIFF</div>;

  const xp = ship.acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 };
  const effects = ship.acepEffects;
  const gen = ship.acepGeneration ?? 1;
  const traits = ship.acepTraits ?? [];
  const baseSlots = 3;
  const extraSlots = effects?.extraModuleSlots ?? 0;
  const installedModules = ship.modules?.length ?? 0;

  return (
    <div style={panelStyle}>
      {/* Ship header */}
      <div style={sectionHeader}>DEIN SCHIFF</div>
      <div style={row}>
        <span>
          <span style={{ color: 'var(--color-primary)' }}>{ship.name}</span>
          <span style={{ color: 'var(--color-dim)', marginLeft: 6 }}>ACEP GEN-{gen}</span>
        </span>
        <span>
          {renamingShipId === ship.id ? (
            <span style={{ display: 'flex', gap: 2 }}>
              <input style={inputStyle} value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(ship.id)}
                maxLength={20} autoFocus placeholder="Name..." />
              <button style={btn} onClick={() => handleRename(ship.id)}>OK</button>
              <button style={btn} onClick={() => setRenamingShipId(null)}>X</button>
            </span>
          ) : (
            <button style={btn} onClick={() => { setRenamingShipId(ship.id); setRenameValue(ship.name); }}>
              UMBENENNEN
            </button>
          )}
        </span>
      </div>

      {/* XP paths */}
      <div style={sectionHeader}>ENTWICKLUNGSPFADE</div>
      {PATHS.map(({ key, label, color }) => {
        const pathXp = xp[key] ?? 0;
        const cost = boostCost(pathXp);
        const canBoost = cost !== null && credits >= cost.credits && wissen >= cost.wissen
          && xp.total < 100;
        return (
          <div key={key} style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <span style={{ color }}>{label}</span>
              <span style={{ color: 'var(--color-dim)' }}>{pathXp}/50</span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div style={barTrack}>
                <div style={{ ...barFill, width: `${(pathXp / 50) * 100}%`, background: color }} />
              </div>
              {cost && (
                <button
                  style={{ ...btn, opacity: canBoost ? 1 : 0.4 }}
                  disabled={!canBoost}
                  title={`+5 XP: ${cost.credits} Cr · ${cost.wissen} W`}
                  onClick={() => network.sendAcepBoost(key)}
                >
                  +5 XP
                </button>
              )}
              {!cost && <span style={{ color: '#00FF88', fontSize: '0.55rem' }}>MAX</span>}
            </div>
            {cost && (
              <div style={{ color: 'var(--color-dim)', fontSize: '0.5rem', marginTop: 1 }}>
                {cost.credits} Cr · {cost.wissen} W
              </div>
            )}
          </div>
        );
      })}
      <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', marginTop: 2 }}>
        GESAMT: {xp.total}/100
      </div>

      {/* Module slots */}
      <div style={sectionHeader}>MODUL-SLOTS</div>
      <div style={{ color: 'var(--color-primary)' }}>
        {installedModules}/{baseSlots + extraSlots} SLOTS BELEGT
        {extraSlots > 0 && (
          <span style={{ color: '#FFB000', marginLeft: 6 }}>+{extraSlots} AUSBAU</span>
        )}
      </div>

      {/* Active Effects */}
      {effects && (
        <>
          <div style={sectionHeader}>AKTIVE EFFEKTE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {extraSlots > 0 && <span style={effectTag}>+{extraSlots} Modul-Slots</span>}
            {effects.scanRadiusBonus > 0 && <span style={effectTag}>+{effects.scanRadiusBonus} Scan-Radius</span>}
            {effects.miningBonus > 0 && <span style={effectTag}>+{Math.round(effects.miningBonus * 100)}% Mining</span>}
            {effects.combatDamageBonus > 0 && <span style={effectTag}>+{Math.round(effects.combatDamageBonus * 100)}% Schaden</span>}
            {effects.ancientDetection && <span style={effectTag}>Ancient-Erkennung</span>}
            {effects.helionDecoderEnabled && <span style={effectTag}>Helion-Decoder</span>}
          </div>
        </>
      )}

      {/* Traits */}
      {traits.length > 0 && (
        <>
          <div style={sectionHeader}>TRAITS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {traits.map((t) => (
              <span key={t} style={{ color: '#00CFFF', fontSize: '0.55rem' }}>◈ {t.toUpperCase()}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );

  function handleRename(shipId: string) {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameShip(shipId, renameValue.trim());
      setRenamingShipId(null);
      setRenameValue('');
    }
  }
}

// ── Styles ─────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
  lineHeight: 1.5, overflow: 'auto', height: '100%',
};
const emptyStyle: React.CSSProperties = {
  padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', opacity: 0.4,
};
const sectionHeader: React.CSSProperties = {
  borderBottom: '1px solid var(--color-dim)', paddingBottom: 2, marginBottom: 4,
  marginTop: 8, fontSize: '0.6rem', letterSpacing: '0.15em', opacity: 0.7,
};
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '2px 0', borderBottom: '1px solid rgba(255,176,0,0.1)',
};
const btn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem', padding: '1px 4px', cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-dim)',
  color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem', padding: '2px 4px', width: '100%', maxWidth: 140,
};
const barTrack: React.CSSProperties = {
  flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2,
};
const barFill: React.CSSProperties = {
  height: '100%', borderRadius: 2, transition: 'width 0.3s',
};
const effectTag: React.CSSProperties = {
  color: '#FFB000', fontSize: '0.55rem', opacity: 0.85,
};
```

Also add `import { useState, useEffect } from 'react';` at the top.

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

Fix any snapshot/render failures.

- [ ] **Remove hull-type display** from `packages/client/src/components/CargoScreen.tsx` — find any `hullType`, `hull?.name`, or "VOID SCOUT" / "AEGIS" display strings and remove or replace with ship name only.

- [ ] **Commit:**

```bash
git add packages/client/src/components/HangarPanel.tsx \
        packages/client/src/components/CargoScreen.tsx
git commit -m "feat(#239,#246): ACEP panel replaces HangarPanel; remove hull-type UI references"
```

---

## Chunk 4: Block B — Modul-Shop + Create-Slates (#247, #245)

### Files
- Modify: `packages/client/src/components/StationTerminalOverlay.tsx` — add FABRIK tab
- Modify: `packages/client/src/components/CargoScreen.tsx` — remove HERSTELLEN tab, keep MODULE tab with install button
- Create: `packages/client/src/components/FabrikPanel.tsx` — craft UI for station
- Create: `packages/client/src/components/SlateControls.tsx` — extracted from CargoScreen
- Modify: `packages/client/src/components/NavControls.tsx` — add SlateControls at bottom

### Task 13: Extract SlateControls from CargoScreen (#245)

- [ ] **Read** `packages/client/src/components/CargoScreen.tsx` — find the "CREATE SLATES" / Slate-creation section (lines with `sendCreateSlate`, `sendCreateCustomSlate`). Note the exact JSX block.

- [ ] **Create** `packages/client/src/components/SlateControls.tsx`:

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';
import { useState } from 'react';

const s: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
  borderTop: '1px solid var(--color-dim)', marginTop: 6, paddingTop: 4,
};
const btn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
  fontSize: '0.55rem', padding: '1px 4px', cursor: 'pointer', marginRight: 3, marginTop: 2,
};

export function SlateControls() {
  const [customLabel, setCustomLabel] = useState('');
  const [customX, setCustomX] = useState('');
  const [customY, setCustomY] = useState('');

  return (
    <div style={s}>
      <div style={{ opacity: 0.6, letterSpacing: '0.1em', marginBottom: 3 }}>── KARTEN ──</div>
      <button style={btn} onClick={() => network.sendCreateSlate('sector')}>SEKTOR-SLATE</button>
      <button style={btn} onClick={() => network.sendCreateSlate('area')}>AREA-SLATE</button>
      {/* Custom slate inputs — copy existing logic from CargoScreen */}
      <div style={{ marginTop: 3 }}>
        <input placeholder="Label" value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          style={{ ...btn, width: 60, marginRight: 2 }} />
        <input placeholder="X" value={customX}
          onChange={(e) => setCustomX(e.target.value)}
          style={{ ...btn, width: 30, marginRight: 2 }} />
        <input placeholder="Y" value={customY}
          onChange={(e) => setCustomY(e.target.value)}
          style={{ ...btn, width: 30, marginRight: 2 }} />
        <button style={btn} onClick={() => {
          const x = parseInt(customX, 10);
          const y = parseInt(customY, 10);
          if (!isNaN(x) && !isNaN(y) && customLabel.trim()) {
            network.sendCreateCustomSlate({ label: customLabel.trim(), x, y });
            setCustomLabel(''); setCustomX(''); setCustomY('');
          }
        }}>CUSTOM</button>
      </div>
    </div>
  );
}
```

- [ ] **Remove** the slate-creation JSX block from `CargoScreen.tsx`.

- [ ] **Import and add** `<SlateControls />` at the bottom of `packages/client/src/components/NavControls.tsx`.

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/client/src/components/SlateControls.tsx \
        packages/client/src/components/CargoScreen.tsx \
        packages/client/src/components/NavControls.tsx
git commit -m "feat(#245): move Create-Slates from CargoScreen to Section 5 (SlateControls)"
```

### Task 14: Create FabrikPanel for station (#247)

- [ ] **Read** `packages/client/src/components/CargoScreen.tsx` — find the HERSTELLEN/craft tab (lines with `sendCraftModule`, blueprint display). Copy the blueprint-list logic.

**Note on slotIndex:** `sendInstallModule('', itemId, 0)` passes `slotIndex: 0` hardcoded. This is identical to the existing `CargoScreen.tsx` behavior (line 363) — the server finds the first free slot. This is the correct pattern to copy.

- [ ] **Create** `packages/client/src/components/FabrikPanel.tsx`:

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';

export function FabrikPanel() {
  const inventory = useStore((s) => s.inventoryState);
  const ship = useStore((s) => s.ship);

  const blueprints = inventory?.filter((i) => i.type === 'blueprint') ?? [];
  const cargoModules = inventory?.filter((i) => i.type === 'module') ?? [];

  const installedIds = new Set((ship?.modules ?? []).map((m) => m.moduleId));

  return (
    <div style={panel}>
      {/* Craft section */}
      <div style={header}>HERSTELLEN</div>
      {blueprints.length === 0 ? (
        <div style={{ opacity: 0.4 }}>KEINE BLAUPAUSEN</div>
      ) : (
        blueprints.map((bp) => (
          <div key={bp.itemId} style={itemRow}>
            <span>{bp.itemId.toUpperCase()}</span>
            <button style={btn} onClick={() => network.sendCraftModule(bp.itemId)}>
              HERSTELLEN
            </button>
          </div>
        ))
      )}

      {/* Install from cargo section */}
      {cargoModules.length > 0 && (
        <>
          <div style={{ ...header, marginTop: 8 }}>INSTALLIEREN</div>
          {cargoModules.map((m) => (
            <div key={m.itemId} style={itemRow}>
              <span>{m.itemId.toUpperCase()}</span>
              <button style={btn}
                disabled={installedIds.has(m.itemId)}
                onClick={() => network.sendInstallModule('', m.itemId, 0)}>
                {installedIds.has(m.itemId) ? 'EINGEBAUT' : 'INSTALLIEREN'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
  color: '#00FF88', overflowY: 'auto', height: '100%',
};
const header: React.CSSProperties = {
  borderBottom: '1px solid rgba(0,255,136,0.3)', paddingBottom: 3,
  marginBottom: 6, letterSpacing: '0.1em', opacity: 0.7,
};
const itemRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '3px 0', borderBottom: '1px solid rgba(0,255,136,0.1)',
};
const btn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #00FF88', color: '#00FF88',
  fontFamily: 'var(--font-mono)', fontSize: '0.55rem', padding: '1px 5px', cursor: 'pointer',
};
```

- [ ] **Remove** craft/blueprint section from `CargoScreen.tsx` MODULE tab — keep only installed modules + the install-from-cargo button.

- [ ] **Commit:**

```bash
git add packages/client/src/components/FabrikPanel.tsx \
        packages/client/src/components/CargoScreen.tsx
git commit -m "feat(#247): create FabrikPanel; remove craft section from CargoScreen"
```

### Task 15: Add FABRIK tab to StationTerminalOverlay (#247)

- [ ] **Read** `packages/client/src/components/StationTerminalOverlay.tsx` in full.

- [ ] **Edit** to add FABRIK tab:

```typescript
// Change TerminalProgram type:
type TerminalProgram = 'hangar' | 'fabrik' | 'handel' | 'quests' | 'forschung';

// Add to PROGRAM_LABELS:
fabrik: 'FABRIK',
```

- [ ] **Add** import and render:

```typescript
import { FabrikPanel } from './FabrikPanel';

// In JSX content area:
{program === 'fabrik' && <FabrikPanel />}
```

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/client/src/components/StationTerminalOverlay.tsx
git commit -m "feat(#247): add FABRIK tab to StationTerminalOverlay for module crafting"
```

---

## Chunk 5: Block D — Quest-Erfüllung (#242)

### Files
- Modify: `packages/server/src/rooms/services/QuestService.ts` — add `handleDeliverQuestResources`
- Modify: `packages/server/src/rooms/SectorRoom.ts` — register message handler
- Create: `packages/client/src/components/QuestCompleteOverlay.tsx`
- Modify: `packages/client/src/components/QuestsScreen.tsx` — add deliver button
- Modify: `packages/client/src/state/gameSlice.ts` — add questComplete queue
- Modify: `packages/client/src/network/client.ts` — add handler for `questComplete` event

**Key facts:**
- `Quest.objectives[0].type === 'delivery'` for delivery quests
- `Quest.objectives[0].requiredItems` has `{ itemId, count }` structure — check shared types for exact shape
- Player must be at a station: `currentSector.type === 'station'`
- `removeFromInventory(userId, itemId, count)` exists in `inventoryService.ts`
- Rewards are awarded via existing `awardQuestReward` pattern in QuestService

### Task 16: Server — deliverQuestResources handler

- [ ] **Read** `packages/server/src/rooms/services/QuestService.ts` lines 260–340 — find how delivery quest check works and how rewards are applied.

- [ ] **Read** `packages/shared/src/types.ts` lines 591–615 — confirm `QuestObjective` shape (especially `type`, `requiredItems`, `currentCount`, `targetCount`).

**⚠ QuestObjective shape (read this before implementing):**
The actual `QuestObjective` in `packages/shared/src/types.ts` uses:
```typescript
{ type: QuestType; resource?: ResourceType; amount?: number; progress?: number; fulfilled: boolean; }
```
There is no `itemId`, `targetCount`, or `currentCount`. Use `resource` for the item and `amount` for the target quantity. `progress` tracks how much has been delivered so far.

**⚠ Station check pattern:**
Do NOT use `this.ctx.room.state`. The correct pattern (from existing QuestService) is: the quest row has `station_x` and `station_y` columns; the client passes its current sector coordinates. Accept `{ questId, sectorX, sectorY }` from client and verify `sectorX === row.station_x && sectorY === row.station_y`.

- [ ] **Read** `packages/server/src/rooms/services/QuestService.ts` lines 255–340 carefully — understand how `context.sectorX / sectorY` is used in `checkQuestProgress`. Note the exact column names (`station_x`, `station_y`) and objectives JSONB structure.

- [ ] **Add** handler to `QuestService`:

```typescript
async handleDeliverQuestResources(
  client: Client,
  data: { questId: string; sectorX: number; sectorY: number },
): Promise<void> {
  const auth = client.auth as AuthPayload;

  // Load quest — must be active delivery quest belonging to this player
  const { rows } = await query<any>(
    `SELECT * FROM player_quests WHERE id = $1 AND player_id = $2 AND status = 'active'`,
    [data.questId, auth.userId],
  );
  if (!rows[0]) { this.ctx.send(client, 'actionError', 'Quest nicht gefunden'); return; }
  const questRow = rows[0];

  // Station check: player must be at the quest's station
  if (data.sectorX !== questRow.station_x || data.sectorY !== questRow.station_y) {
    this.ctx.send(client, 'actionError', 'Falsche Station');
    return;
  }

  const objectives: QuestObjective[] = questRow.objectives;
  const deliveryIdx = objectives.findIndex((o) => o.type === 'delivery' && !o.fulfilled);
  if (deliveryIdx === -1) { this.ctx.send(client, 'actionError', 'Keine offene Lieferaufgabe'); return; }

  const obj = objectives[deliveryIdx];
  const resource = obj.resource;
  if (!resource) { this.ctx.send(client, 'actionError', 'Keine Ressource definiert'); return; }

  const targetAmount = obj.amount ?? 0;
  const alreadyDelivered = obj.progress ?? 0;
  const remaining = targetAmount - alreadyDelivered;

  // How much does the player have?
  const available = await getResourceTotal(auth.userId, resource);
  const toDeliver = Math.min(available, remaining);
  if (toDeliver <= 0) { this.ctx.send(client, 'actionError', 'Keine Ressourcen zum Abliefern'); return; }

  // Deduct from inventory
  await removeFromInventory(auth.userId, resource, toDeliver);

  const newProgress = alreadyDelivered + toDeliver;
  const fulfilled = newProgress >= targetAmount;

  // Update objective progress in JSONB
  await query(
    `UPDATE player_quests
     SET objectives = jsonb_set(objectives, $1, $2)
     WHERE id = $3`,
    [
      `{${deliveryIdx},progress}`,
      JSON.stringify(newProgress),
      questRow.id,
    ],
  );
  if (fulfilled) {
    await query(
      `UPDATE player_quests
       SET objectives = jsonb_set(objectives, $1, 'true'::jsonb), status = 'completed'
       WHERE id = $2`,
      [`{${deliveryIdx},fulfilled}`, questRow.id],
    );
    const rewards = questRow.rewards as QuestRewards;
    if (rewards.credits) await addCredits(auth.userId, rewards.credits);
    if (rewards.wissen) await addWissen(auth.userId, rewards.wissen);
    this.ctx.send(client, 'questComplete', {
      questId: questRow.id,
      title: questRow.title,
      rewards: { credits: rewards.credits ?? 0, wissen: rewards.wissen ?? 0 },
    });
  } else {
    this.ctx.send(client, 'questDeliveryProgress', {
      questId: questRow.id,
      delivered: toDeliver,
      newProgress,
      targetAmount,
    });
  }

  // Re-push active quests list
  await this.handleGetActiveQuests(client);
}
```

Add imports: `addWissen` from `'../../db/queries.js'`, `getResourceTotal` and `removeFromInventory` from `'../../engine/inventoryService.js'`.

- [ ] **Register** in `SectorRoom.ts`:

```typescript
this.onMessage('deliverQuestResources', (client, data) =>
  this.services.quest.handleDeliverQuestResources(client, data));
```

- [ ] **Run server tests:**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/server/src/rooms/services/QuestService.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(#242): add deliverQuestResources handler with partial delivery support"
```

### Task 17: Client — deliver button in QuestsScreen

- [ ] **Read** `packages/client/src/components/QuestsScreen.tsx` — find where active quests are rendered, particularly the delivery quest type display.

- [ ] **Add** deliver button logic:

```tsx
// In QuestsScreen, inside quest render:
const atStation = useStore((s) => s.currentSector?.type === 'station');
const isDelivery = quest.objectives?.some((o: any) => o.type === 'delivery');
const obj = quest.objectives?.find((o: any) => o.type === 'delivery');

{isDelivery && atStation && (
  <div style={{ marginTop: 4 }}>
    {obj && (
      <span style={{ color: 'var(--color-dim)', fontSize: '0.55rem' }}>
        {obj.currentCount ?? 0}/{obj.targetCount} {obj.itemId?.toUpperCase()}
      </span>
    )}
    <button
      style={deliverBtn}
      onClick={() => network.sendDeliverQuestResources(quest.id)}
    >
      ROHSTOFFE ABLIEFERN
    </button>
  </div>
)}
```

- [ ] **Add** `sendDeliverQuestResources(questId: string)` to `packages/client/src/network/client.ts` — must pass current sector coordinates:

```typescript
sendDeliverQuestResources(questId: string) {
  const { x, y } = useStore.getState().position;
  this.sectorRoom?.send('deliverQuestResources', { questId, sectorX: x, sectorY: y });
}
```

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/client/src/components/QuestsScreen.tsx \
        packages/client/src/network/client.ts
git commit -m "feat(#242): add ROHSTOFFE ABLIEFERN button in QuestsScreen for delivery quests"
```

### Task 18: Client — QuestCompleteOverlay

- [ ] **Create** `packages/client/src/components/QuestCompleteOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';

interface QuestCompleteEvent {
  questId: string;
  title: string;
  rewards: { credits: number; wissen: number };
}

// Add to gameSlice: questCompleteQueue: QuestCompleteEvent[]
// Actions: pushQuestComplete, shiftQuestComplete

export function QuestCompleteOverlay() {
  const queue = useStore((s) => s.questCompleteQueue ?? []);
  const shift = useStore((s) => s.shiftQuestComplete);
  const [visible, setVisible] = useState(false);
  const current = queue[0];

  useEffect(() => {
    if (current) {
      setVisible(true);
      const t = setTimeout(() => { setVisible(false); setTimeout(shift, 300); }, 5000);
      return () => clearTimeout(t);
    }
  }, [current?.questId]);

  if (!current || !visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16, zIndex: 8500,
      background: '#050505', border: '1px solid #00FF88',
      padding: '10px 14px', fontFamily: 'var(--font-mono)',
      color: '#00FF88', fontSize: '0.65rem', maxWidth: 260,
    }}>
      <div style={{ opacity: 0.6, marginBottom: 4 }}>◈ QUEST ABGESCHLOSSEN</div>
      <div style={{ color: 'var(--color-primary)', marginBottom: 6 }}>{current.title}</div>
      <div>
        {current.rewards.credits > 0 && <span>+{current.rewards.credits} CR  </span>}
        {current.rewards.wissen > 0 && <span>+{current.rewards.wissen} W</span>}
      </div>
    </div>
  );
}
```

- [ ] **Add** `questCompleteQueue`, `pushQuestComplete`, `shiftQuestComplete` to `packages/client/src/state/gameSlice.ts`.

- [ ] **Register** `questComplete` message handler in `packages/client/src/network/client.ts`:

```typescript
room.onMessage('questComplete', (data) => {
  useStore.getState().pushQuestComplete(data);
});
```

- [ ] **Mount** `<QuestCompleteOverlay />` in `packages/client/src/components/GameScreen.tsx` (alongside other overlay components).

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/client/src/components/QuestCompleteOverlay.tsx \
        packages/client/src/state/gameSlice.ts \
        packages/client/src/network/client.ts \
        packages/client/src/components/GameScreen.tsx
git commit -m "feat(#242): QuestCompleteOverlay with 5s auto-dismiss; questComplete event handler"
```

---

## Chunk 6: Block E.2 — QuadMap Fog-of-War (#244)

### Files
- Create: `packages/server/src/db/migrations/049_player_quadrant_visits.sql`
- Modify: `packages/server/src/db/queries.ts` — add `recordQuadrantVisit`, `getVisitedQuadrants`, `getPlayerAlienContacts`
- Modify: `packages/server/src/rooms/SectorRoom.ts` — record visit on join; filter QuadMap response
- Modify: `packages/client/src/components/QuadMapScreen.tsx` — render fog for unvisited quadrants
- Test: `packages/server/src/__tests__/quadrantFog.test.ts` (new)

**Key facts:**
- `getQuadrant(qx, qy)` exists in queries.ts
- QuadMap response is built inside `SectorRoom.ts` around the `requestQuadMap` handler
- Alien faction filtering: check `alien_encounters` table — `WHERE player_id = $1 AND faction_id = $2`
- Client `QuadMapScreen.tsx` already colors quadrants by `quadrant_control` data

### Task 19: Migration 049 — player_quadrant_visits

- [ ] **Create** `packages/server/src/db/migrations/049_player_quadrant_visits.sql`:

```sql
CREATE TABLE IF NOT EXISTS player_quadrant_visits (
  player_id VARCHAR(100) NOT NULL,
  qx        INTEGER NOT NULL,
  qy        INTEGER NOT NULL,
  first_visited_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, qx, qy)
);
CREATE INDEX IF NOT EXISTS idx_pqv_player ON player_quadrant_visits (player_id);
```

- [ ] **Run migration** (auto-applied on server start; verify by checking migration runner):

```bash
cd packages/server && grep -r "migrations" src/db/ --include="*.ts" | head -5
```

Confirm the pattern for loading migrations (e.g. glob `migrations/*.sql` in order).

- [ ] **Commit:**

```bash
git add packages/server/src/db/migrations/049_player_quadrant_visits.sql
git commit -m "feat(#244): migration 049 — player_quadrant_visits for QuadMap fog-of-war"
```

### Task 20: Server — record visits + filter QuadMap

- [ ] **Add** to `packages/server/src/db/queries.ts`:

```typescript
export async function recordQuadrantVisit(playerId: string, qx: number, qy: number): Promise<void> {
  await query(
    `INSERT INTO player_quadrant_visits (player_id, qx, qy)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [playerId, qx, qy],
  );
}

export async function getVisitedQuadrants(
  playerId: string,
): Promise<Set<string>> {
  const { rows } = await query<{ qx: number; qy: number }>(
    'SELECT qx, qy FROM player_quadrant_visits WHERE player_id = $1',
    [playerId],
  );
  return new Set(rows.map((r) => `${r.qx}:${r.qy}`));
}

export async function getPlayerAlienContactIds(playerId: string): Promise<Set<string>> {
  const { rows } = await query<{ alien_faction_id: string }>(
    'SELECT DISTINCT alien_faction_id FROM alien_encounters WHERE player_id = $1',
    [playerId],
  );
  return new Set(rows.map((r) => r.alien_faction_id));
}
```

- [ ] **Record visit** in `SectorRoom.ts` — find where player joins (`onJoin` or the initial join handler), after `this.quadrantX`/`this.quadrantY` is known:

```typescript
// After player is authenticated and quadrant is established:
import { recordQuadrantVisit } from '../db/queries.js';
// ...
await recordQuadrantVisit(auth.userId, this.quadrantX, this.quadrantY);
```

- [ ] **Filter QuadMap response** — read the `requestQuadMap` handler in `SectorRoom.ts`. After fetching `quadrant_control` rows, filter them:

```typescript
import { getVisitedQuadrants, getPlayerAlienContactIds } from '../db/queries.js';

// Inside requestQuadMap handler:
const [visited, alienContacts] = await Promise.all([
  getVisitedQuadrants(auth.userId),
  getPlayerAlienContactIds(auth.userId),
]);

// Filter quadrant_control entries:
const filtered = allQuadrants.filter((q) => visited.has(`${q.qx}:${q.qy}`));

// For each entry, hide alien faction if uncontacted:
const sanitized = filtered.map((q) => {
  if (q.controllingFaction && !humanFactionIds.has(q.controllingFaction)
      && !alienContacts.has(q.controllingFaction)) {
    return { ...q, controllingFaction: null, factionShares: {} }; // hide alien
  }
  return q;
});

client.send('quadMapData', { quadrants: sanitized, ... });
```

Note: `humanFactionIds` = set of player/human faction identifiers. Read the existing QuadMap handler to find exact structure.

- [ ] **Write test** `packages/server/src/__tests__/quadrantFog.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Test the filter logic in isolation (pure function extracted):
function filterQuadMapForPlayer(
  quadrants: any[],
  visited: Set<string>,
  alienContacts: Set<string>,
  humanFactionIds: Set<string>,
) {
  return quadrants
    .filter((q) => visited.has(`${q.qx}:${q.qy}`))
    .map((q) => {
      if (q.controllingFaction
          && !humanFactionIds.has(q.controllingFaction)
          && !alienContacts.has(q.controllingFaction)) {
        return { ...q, controllingFaction: null };
      }
      return q;
    });
}

describe('filterQuadMapForPlayer', () => {
  it('hides unvisited quadrants', () => {
    const result = filterQuadMapForPlayer(
      [{ qx: 5, qy: 3, controllingFaction: null }],
      new Set(['1:1']), new Set(), new Set(),
    );
    expect(result).toHaveLength(0);
  });

  it('shows visited human quadrant', () => {
    const result = filterQuadMapForPlayer(
      [{ qx: 1, qy: 1, controllingFaction: 'TERRAN' }],
      new Set(['1:1']), new Set(), new Set(['TERRAN']),
    );
    expect(result[0].controllingFaction).toBe('TERRAN');
  });

  it('hides alien faction without contact', () => {
    const result = filterQuadMapForPlayer(
      [{ qx: 1, qy: 1, controllingFaction: 'ARCHIVARE' }],
      new Set(['1:1']), new Set(), new Set(['TERRAN']),
    );
    expect(result[0].controllingFaction).toBeNull();
  });

  it('shows alien faction after contact', () => {
    const result = filterQuadMapForPlayer(
      [{ qx: 1, qy: 1, controllingFaction: 'ARCHIVARE' }],
      new Set(['1:1']), new Set(['ARCHIVARE']), new Set(['TERRAN']),
    );
    expect(result[0].controllingFaction).toBe('ARCHIVARE');
  });
});
```

- [ ] **Run test:**

```bash
cd packages/server && npx vitest run src/__tests__/quadrantFog.test.ts
```

Expected: PASS (4 tests).

- [ ] **Run all server tests:**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/server/src/db/queries.ts \
        packages/server/src/rooms/SectorRoom.ts \
        packages/server/src/__tests__/quadrantFog.test.ts
git commit -m "feat(#244): QuadMap fog-of-war — filter by player visits; hide uncontacted aliens"
```

### Task 21: Client — render fog in QuadMapScreen

- [ ] **Read** `packages/client/src/components/QuadMapScreen.tsx` lines ~197–280 to understand how quadrant tiles are rendered.

- [ ] **Update** tile render logic — unvisited (missing from server response) tiles show fog:

The server now only sends visited quadrants, so the client simply renders whatever it receives. Unvisited quadrants have no entry → no tile. Optionally, render a fog tile for surrounding empty cells.

For a clean fog effect:
1. Compute bounding box of visited quadrants
2. For each cell in bounding box that has no data → render dim `░` tile

```tsx
// In QuadMapScreen, when rendering the grid:
// Existing: quadrants.map(q => <QuadrantTile key={...} data={q} />)
// Add after: for empty neighbors within ±2 of visited range, render fog tile

function FogTile({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, opacity: 0.15, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--color-dim)', fontSize: '0.5rem' }}>
      ???
    </div>
  );
}
```

- [ ] **Run client tests:**

```bash
cd packages/client && npx vitest run --reporter=dot 2>&1 | tail -10
```

- [ ] **Commit:**

```bash
git add packages/client/src/components/QuadMapScreen.tsx
git commit -m "feat(#244): QuadMapScreen fog-of-war — unvisited quadrants show ??? tile"
```

---

## Final: Run all tests + integration check

- [ ] **Run all tests:**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected totals: shared ~205, server ~1110+, client ~550+

- [ ] **Start dev server and verify manually:**
  - moveSector animation smooth (no snap)
  - ACEP Panel shows XP bars + boost button, costs shown
  - Boost button deducts credits + wissen, updates bars
  - FABRIK tab visible at station
  - Craft action moves blueprint → cargo module
  - SlateControls visible in Section 5
  - Wissen shown in HUD + TECH
  - Area scan / local scan awards wissen
  - Delivery quest shows ABLIEFERN button at station
  - Partial delivery updates progress; full delivery shows popup
  - QuadMap only shows visited quadrants; uncontacted aliens hidden

```bash
npm run docker:up
npm run dev:server &
npm run dev:client
```

- [ ] **Final commit with summary:**

```bash
git commit --allow-empty -m "chore: all tests passing — #239 #242 #243 #244 #245 #246 #247 #248 + ACEP panel"
```
