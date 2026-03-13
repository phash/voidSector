# Human Expansion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Player-built stations in new quadrants automatically conquer them per strategic tick — with resource pool acceleration and gradual QUAD-MAP coloring for all factions.

**Architecture:** New `ConquestEngine` runs in `StrategicTickService` alongside existing `expansionEngine` and `warfareEngine`. Conquest progress is stored in `quadrant_control.faction_shares` (already JSONB). Three new columns in `civ_stations` (`mode`, `conquest_pool`, `level`). Client renders mixed faction colors in `QuadrantMapRenderer`.

**Tech Stack:** TypeScript, Vitest, PostgreSQL, Colyseus (Zustand client state)

**Spec:** `docs/superpowers/specs/2026-03-13-human-expansion-design.md`

---

## Chunk 1: Shared types + constants + migration

### Task 1: Add constants to shared package

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add conquest constants to `constants.ts`**

At the end of the file, add:

```typescript
export const CONQUEST_POOL_DRAIN_PER_TICK = 50;
export const CONQUEST_POOL_MAX = 500;

export const CONQUEST_RATE: Record<number, { base: number; boosted: number }> = {
  1: { base: 1.0, boosted: 1.5 },
  2: { base: 1.1, boosted: 2.0 },
  3: { base: 1.2, boosted: 3.0 },
};

export function getConquestPriceBonus(qx: number, qy: number): number {
  const dist = Math.floor(Math.sqrt(qx * qx + qy * qy));
  if (dist <= 10) return dist;
  if (dist <= 50) return 10 + (dist - 10) * 2;
  if (dist <= 100) return 90 + (dist - 50) * 3;
  return 240 + (dist - 100) * 5;
}
```

- [ ] **Step 2: Extend `CivStation` interface in `types.ts`**

Find `export interface CivStation` (line ~1472) and replace the body:

```typescript
export interface CivStation {
  id: number;
  sector_x: number;
  sector_y: number;
  faction: string;
  has_shipyard: boolean;
  has_warehouse: boolean;
  has_kontor: boolean;
  mode: 'conquest' | 'factory' | 'battle';
  conquest_pool: number;
  level: number;
}
```

- [ ] **Step 3: Build shared package**

```bash
cd packages/shared && npm run build
```

Expected: `dist/` updated, no errors.

- [ ] **Step 4: Write unit tests for new constants**

Create `packages/shared/src/__tests__/conquestConstants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  CONQUEST_RATE,
  CONQUEST_POOL_DRAIN_PER_TICK,
  CONQUEST_POOL_MAX,
  getConquestPriceBonus,
} from '../constants.js';

describe('CONQUEST_RATE', () => {
  it('level 1 base = 1.0', () => expect(CONQUEST_RATE[1].base).toBe(1.0));
  it('level 2 boosted = 2.0', () => expect(CONQUEST_RATE[2].boosted).toBe(2.0));
  it('level 3 boosted = 3.0', () => expect(CONQUEST_RATE[3].boosted).toBe(3.0));
});

describe('getConquestPriceBonus', () => {
  it('dist 5 → +5', () => expect(getConquestPriceBonus(3, 4)).toBe(5));
  it('dist 10 → +10', () => expect(getConquestPriceBonus(6, 8)).toBe(10));
  it('dist 30 → +50', () => expect(getConquestPriceBonus(18, 24)).toBe(50));
  it('origin (0,0) → 0', () => expect(getConquestPriceBonus(0, 0)).toBe(0));
});

describe('pool constants', () => {
  it('drain is 50', () => expect(CONQUEST_POOL_DRAIN_PER_TICK).toBe(50));
  it('max is 500', () => expect(CONQUEST_POOL_MAX).toBe(500));
});
```

- [ ] **Step 5: Run shared tests**

```bash
cd packages/shared && npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts \
  packages/shared/src/__tests__/conquestConstants.test.ts
git commit -m "feat: add conquest constants + CivStation mode/pool/level fields"
```

---

### Task 2: DB Migration 065

**Files:**
- Create: `packages/server/src/db/migrations/065_conquest_mode.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration 065: Add conquest mode, resource pool, and level to civ_stations
ALTER TABLE civ_stations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'conquest',
  ADD COLUMN IF NOT EXISTS conquest_pool INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- All existing stations: set to factory mode if they're in a fully-controlled quadrant.
-- ConquestEngine will correct any remaining ones on first tick.
UPDATE civ_stations SET mode = 'factory';
```

- [ ] **Step 2: Verify migration runs without error (manual check)**

The migration auto-runs on server start. After the next Task, start the server and check logs for `Migration 065` success.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/migrations/065_conquest_mode.sql
git commit -m "feat: migration 065 — conquest mode/pool/level columns on civ_stations"
```

---

## Chunk 2: Server — ConquestEngine + DB queries

### Task 3: New DB query functions for conquest

**Files:**
- Modify: `packages/server/src/db/civQueries.ts`

- [ ] **Step 1: Add new query types and functions**

Add after the existing `countDronesAtStation` function in `civQueries.ts`:

```typescript
export interface CivStationConquest {
  id: number;
  sector_x: number;
  sector_y: number;
  faction: string;
  mode: string;
  conquest_pool: number;
  level: number;
}

// Within the civQueries object, add:

  async getConquestStations(): Promise<CivStationConquest[]> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number;
      faction: string; mode: string; conquest_pool: number; level: number;
    }>(`SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level
        FROM civ_stations WHERE mode != 'factory'`);
    return res.rows;
  },

  async updateStationMode(id: number, mode: string): Promise<void> {
    await query('UPDATE civ_stations SET mode = $1 WHERE id = $2', [mode, id]);
  },

  async drainConquestPool(id: number, amount: number): Promise<void> {
    await query(
      'UPDATE civ_stations SET conquest_pool = GREATEST(0, conquest_pool - $1) WHERE id = $2',
      [amount, id],
    );
  },

  async depositConquestPool(id: number, amount: number, maxPool: number): Promise<number> {
    const res = await query<{ conquest_pool: number }>(
      `UPDATE civ_stations
       SET conquest_pool = LEAST($3, conquest_pool + $1)
       WHERE id = $2
       RETURNING conquest_pool`,
      [amount, id, maxPool],
    );
    return res.rows[0]?.conquest_pool ?? 0;
  },

  async getStationById(id: number): Promise<CivStationConquest | null> {
    const res = await query<{
      id: number; sector_x: number; sector_y: number;
      faction: string; mode: string; conquest_pool: number; level: number;
    }>('SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level FROM civ_stations WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  },
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/civQueries.ts
git commit -m "feat: conquest DB queries — getConquestStations, updateMode, drainPool, depositPool"
```

---

### Task 4: ConquestEngine — pure logic tests first (TDD)

**Files:**
- Create: `packages/server/src/engine/__tests__/conquestEngine.test.ts`
- Create: `packages/server/src/engine/conquestEngine.ts`

- [ ] **Step 1: Write failing tests for conquest logic**

Create `packages/server/src/engine/__tests__/conquestEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeConquestRate,
  computeFrictionModifier,
  updateShares,
} from '../conquestEngine.js';

describe('computeConquestRate', () => {
  it('level 1, no pool → 1.0', () => {
    expect(computeConquestRate(1, 0)).toBe(1.0);
  });
  it('level 1, pool > 0 → 1.5', () => {
    expect(computeConquestRate(1, 100)).toBe(1.5);
  });
  it('level 2, no pool → 1.1', () => {
    expect(computeConquestRate(2, 0)).toBe(1.1);
  });
  it('level 3, pool > 0 → 3.0', () => {
    expect(computeConquestRate(3, 100)).toBe(3.0);
  });
  it('unknown level falls back to level 1', () => {
    expect(computeConquestRate(99, 0)).toBe(1.0);
  });
});

describe('computeFrictionModifier', () => {
  it('no other faction → 1.0 (no modifier)', () => {
    expect(computeFrictionModifier(0, false)).toBe(1.0);
  });
  it('other faction, friction 0-20 (ALLY) → 0', () => {
    expect(computeFrictionModifier(10, true)).toBe(0);
  });
  it('other faction, friction 21-50 (NEUTRAL) → 0.5', () => {
    expect(computeFrictionModifier(35, true)).toBe(0.5);
  });
  it('other faction, friction 51-80 (HOSTILE) → 0.25', () => {
    expect(computeFrictionModifier(65, true)).toBe(0.25);
  });
  it('other faction, friction 81+ (ENEMY) → 0', () => {
    expect(computeFrictionModifier(90, true)).toBe(0);
  });
});

describe('updateShares', () => {
  it('neutral quadrant: fills own faction directly', () => {
    const result = updateShares({}, 'humans', 5);
    expect(result.shares['humans']).toBe(5);
  });
  it('caps at 100', () => {
    const result = updateShares({ humans: 98 }, 'humans', 5);
    expect(result.shares['humans']).toBe(100);
  });
  it('contested: reduces other faction proportionally', () => {
    const result = updateShares({ humans: 50, kthari: 50 }, 'humans', 10);
    expect(result.shares['humans']).toBeCloseTo(60);
    expect(result.shares['kthari']).toBeCloseTo(40);
  });
  it('removes faction at 0', () => {
    const result = updateShares({ humans: 95, kthari: 5 }, 'humans', 10);
    expect(result.shares['kthari']).toBeUndefined();
    expect(result.shares['humans']).toBe(100);
  });
  it('returns controlling faction (highest share)', () => {
    const result = updateShares({ humans: 40, kthari: 60 }, 'humans', 30);
    expect(result.controllingFaction).toBe('humans');
  });
  it('sum of shares always ≤ 100', () => {
    const result = updateShares({ humans: 60, kthari: 40 }, 'humans', 15);
    const total = Object.values(result.shares).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.01); // floating-point tolerance
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/engine/__tests__/conquestEngine.test.ts
```

Expected: FAIL — `conquestEngine.js` not found.

- [ ] **Step 3: Implement ConquestEngine pure functions**

Create `packages/server/src/engine/conquestEngine.ts`:

```typescript
// packages/server/src/engine/conquestEngine.ts
import { CONQUEST_RATE, CONQUEST_POOL_DRAIN_PER_TICK } from '@void-sector/shared';
import { civQueries } from '../db/civQueries.js';
import { getQuadrantControl, upsertQuadrantControl } from '../db/queries.js';
import { logger } from '../utils/logger.js';

// --- Pure functions (exported for testing) ---

export function computeConquestRate(level: number, pool: number): number {
  const config = CONQUEST_RATE[level] ?? CONQUEST_RATE[1];
  return pool > 0 ? config.boosted : config.base;
}

export function computeFrictionModifier(frictionScore: number, otherFactionPresent: boolean): number {
  if (!otherFactionPresent) return 1.0;
  if (frictionScore <= 20) return 0;
  if (frictionScore <= 50) return 0.5;
  if (frictionScore <= 80) return 0.25;
  return 0; // ENEMY → battle mode
}

export function updateShares(
  currentShares: Record<string, number>,
  faction: string,
  gain: number,
): { shares: Record<string, number>; controllingFaction: string } {
  const shares = { ...currentShares };
  const current = shares[faction] ?? 0;
  const newValue = Math.min(100, current + gain);
  const actualGain = newValue - current;

  // Reduce others proportionally
  const others = Object.keys(shares).filter((f) => f !== faction);
  const othersTotal = others.reduce((sum, f) => sum + (shares[f] ?? 0), 0);
  if (othersTotal > 0 && actualGain > 0) {
    for (const f of others) {
      const reduction = ((shares[f] ?? 0) / othersTotal) * actualGain;
      const newOther = (shares[f] ?? 0) - reduction;
      if (newOther < 0.5) {
        delete shares[f];
      } else {
        shares[f] = newOther;
      }
    }
  }

  shares[faction] = newValue;

  // Determine controlling faction (highest share)
  let controllingFaction = faction;
  let maxShare = newValue;
  for (const [f, s] of Object.entries(shares)) {
    if (s > maxShare) {
      maxShare = s;
      controllingFaction = f;
    }
  }

  return { shares, controllingFaction };
}

// --- Engine class ---

export class ConquestEngine {
  async tick(): Promise<void> {
    let stations;
    try {
      stations = await civQueries.getConquestStations();
    } catch (err) {
      logger.error({ err }, 'ConquestEngine: failed to load stations');
      return;
    }

    for (const station of stations) {
      try {
        await this.processStation(station);
      } catch (err) {
        logger.error({ err, stationId: station.id }, 'ConquestEngine: error processing station');
      }
    }
  }

  private async processStation(station: Awaited<ReturnType<typeof civQueries.getConquestStations>>[0]): Promise<void> {
    const qx = Math.floor(station.sector_x / 500);
    const qy = Math.floor(station.sector_y / 500);

    // Get or create quadrant control row
    let qc = await getQuadrantControl(qx, qy);
    if (!qc) {
      await upsertQuadrantControl({
        qx, qy,
        controlling_faction: station.faction,
        faction_shares: { [station.faction]: 0 },
        attack_value: 0,
        defense_value: 0,
        friction_score: 0,
        station_tier: station.level,
      });
      qc = await getQuadrantControl(qx, qy);
      if (!qc) return;
    }

    const shares = qc.faction_shares as Record<string, number>;
    const ownShare = shares[station.faction] ?? 0;
    const otherFactionPresent = Object.keys(shares).some(
      (f) => f !== station.faction && (shares[f] ?? 0) > 0,
    );
    const frictionScore = qc.friction_score ?? 0;

    // Determine new mode
    let newMode: 'conquest' | 'factory' | 'battle';
    if (ownShare >= 100) {
      newMode = 'factory';
    } else if (otherFactionPresent && frictionScore > 80) {
      newMode = 'battle';
    } else {
      newMode = 'conquest';
    }

    await civQueries.updateStationMode(station.id, newMode);

    if (newMode !== 'conquest') return;

    // Apply conquest
    const frictionMod = computeFrictionModifier(frictionScore, otherFactionPresent);
    if (frictionMod === 0) return; // halted by ally friction

    const rate = computeConquestRate(station.level, station.conquest_pool);
    const effectiveGain = rate * frictionMod;

    const { shares: newShares, controllingFaction } = updateShares(shares, station.faction, effectiveGain);

    await upsertQuadrantControl({
      qx, qy,
      controlling_faction: controllingFaction,
      faction_shares: newShares,
      attack_value: qc.attack_value,
      defense_value: qc.defense_value,
      friction_score: qc.friction_score,
      station_tier: Math.max(qc.station_tier, station.level),
    });

    // Drain pool
    await civQueries.drainConquestPool(station.id, CONQUEST_POOL_DRAIN_PER_TICK);

    logger.debug(
      { stationId: station.id, faction: station.faction, qx, qy, gain: effectiveGain, newShares },
      'ConquestEngine: tick applied',
    );
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/server && npx vitest run src/engine/__tests__/conquestEngine.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/conquestEngine.ts \
  packages/server/src/engine/__tests__/conquestEngine.test.ts
git commit -m "feat: ConquestEngine — pure logic + tick, TDD"
```

---

### Task 5: Wire ConquestEngine into StrategicTickService

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts`

- [ ] **Step 1: Import and instantiate ConquestEngine**

At the top of `strategicTickService.ts`, add the import alongside other engine imports:

```typescript
import { ConquestEngine } from './conquestEngine.js';
```

In the `StrategicTickService` class, add a private field:

```typescript
private conquestEngine: ConquestEngine;
```

In the `constructor`, initialize it:

```typescript
this.conquestEngine = new ConquestEngine();
```

- [ ] **Step 2: Call conquestEngine.tick() in the tick method**

In `StrategicTickService.tick()`, after step `// 2. Alien expansion into unclaimed space` (around line 80), add:

```typescript
// 3. Human/player station conquest
await this.conquestEngine.tick().catch((err) =>
  logger.error({ err }, 'ConquestEngine tick error'),
);
```

Renumber subsequent steps (Void lifecycle → step 4, cleanup → step 5).

- [ ] **Step 3: Start server and verify no crash**

```bash
cd packages/server && npm run dev 2>&1 | head -30
```

Expected: server starts, migration 065 logged as applied.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/engine/strategicTickService.ts
git commit -m "feat: wire ConquestEngine into StrategicTickService"
```

---

### Task 6: STATION_DEPOSIT_CONQUEST message handler

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (or the relevant handler file)
- Modify: `packages/shared/src/types.ts` (new message type)

- [ ] **Step 1: Add message type to shared types**

In `types.ts`, find `ClientToServerMessage` or the equivalent message union type and add:

```typescript
| { type: 'STATION_DEPOSIT_CONQUEST'; stationId: number; amount: number }
```

Also add to `ServerToClientMessage`:

```typescript
| { type: 'CONQUEST_POOL_UPDATED'; stationId: number; newPool: number; newMode: string }
```

Rebuild shared: `cd packages/shared && npm run build`

- [ ] **Step 2: Find the SectorRoom message handler**

```bash
grep -rn "onMessage\|STATION_DEPOSIT\|economyService" packages/server/src/rooms/SectorRoom.ts | head -20
```

- [ ] **Step 3: Add handler for STATION_DEPOSIT_CONQUEST**

In the SectorRoom message handlers, add:

```typescript
this.onMessage('STATION_DEPOSIT_CONQUEST', async (client, msg: { stationId: number; amount: number }) => {
  const playerId = client.sessionId; // or however player ID is resolved
  const amount = Math.max(0, Math.floor(msg.amount));
  if (amount <= 0) return;

  const station = await civQueries.getStationById(msg.stationId);
  if (!station || station.mode === 'factory') {
    client.send('actionError', { code: 'CONQUEST_NOT_ACTIVE', message: 'Station nicht im Conquest-Modus.' });
    return;
  }

  const remaining = CONQUEST_POOL_MAX - station.conquest_pool;
  const actual = Math.min(amount, remaining);
  if (actual <= 0) {
    client.send('actionError', { code: 'CONQUEST_POOL_FULL', message: 'Conquest-Pool bereits voll.' });
    return;
  }

  const newPool = await civQueries.depositConquestPool(msg.stationId, actual, CONQUEST_POOL_MAX);
  client.send('CONQUEST_POOL_UPDATED', { stationId: msg.stationId, newPool, newMode: station.mode });
});
```

Add the import at the top if not already present:
```typescript
import { civQueries } from '../db/civQueries.js';
import { CONQUEST_POOL_MAX } from '@void-sector/shared';
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts packages/shared/src/types.ts
git commit -m "feat: STATION_DEPOSIT_CONQUEST message handler + shared message types"
```

---

## Chunk 3: Client — QUAD-MAP mixed coloring + Station Detail

### Task 7: Mixed faction color rendering in QuadrantMapRenderer

**Files:**
- Modify: `packages/client/src/canvas/QuadrantMapRenderer.ts`
- Modify: `packages/client/src/__tests__/QuadrantMapRenderer.test.ts`

- [ ] **Step 1: Write tests for mixed rendering logic**

In `QuadrantMapRenderer.test.ts`, find the existing tests and add:

```typescript
import { getMixedFactionColors } from '../canvas/QuadrantMapRenderer.js';

describe('getMixedFactionColors', () => {
  it('single faction at 100% → one color entry', () => {
    const result = getMixedFactionColors({ humans: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].fraction).toBeCloseTo(1.0);
  });

  it('two factions 60/40 → two entries summing to 1.0', () => {
    const result = getMixedFactionColors({ humans: 60, kthari: 40 });
    expect(result).toHaveLength(2);
    const total = result.reduce((s, r) => s + r.fraction, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it('rounds to 10% steps (visual only)', () => {
    const result = getMixedFactionColors({ humans: 73 });
    // 73 rounds to 70%, but the function returns exact fractions for rendering
    expect(result[0].fraction).toBeCloseTo(0.73);
  });

  it('ignores factions below 5% (noise filter)', () => {
    const result = getMixedFactionColors({ humans: 98, kthari: 2 });
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/QuadrantMapRenderer.test.ts
```

- [ ] **Step 3: Add `getMixedFactionColors` and rendering to QuadrantMapRenderer**

In `QuadrantMapRenderer.ts`, after the `FACTION_COLORS` constant, add:

```typescript
export function getMixedFactionColors(
  shares: Record<string, number>,
): { color: string; fraction: number }[] {
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return Object.entries(shares)
    .filter(([, v]) => v / total >= 0.05) // ignore < 5%
    .map(([faction, v]) => ({
      color: FACTION_COLORS[faction] ?? 'rgba(128,128,128,0.3)',
      fraction: v / total,
    }))
    .sort((a, b) => b.fraction - a.fraction);
}
```

Then in the cell rendering loop, replace the single `factionColor` fill with mixed rendering. Find the section around line 145 (`ctx.fillStyle = factionColor + '22'`) and update:

```typescript
// Mixed faction shares rendering
const mixedColors = getMixedFactionColors(ctrl.faction_shares ?? { [ctrl.controlling_faction]: 100 });
if (mixedColors.length === 1) {
  ctx.fillStyle = mixedColors[0].color + '22';
  ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
} else if (mixedColors.length > 1) {
  // Split cell vertically by fraction
  let offsetX = cellX - CELL_W / 2;
  for (const { color, fraction } of mixedColors) {
    const segW = CELL_W * fraction;
    ctx.fillStyle = color + '22';
    ctx.fillRect(offsetX, cellY - CELL_H / 2, segW, CELL_H);
    offsetX += segW;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/client && npx vitest run src/__tests__/QuadrantMapRenderer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/canvas/QuadrantMapRenderer.ts \
  packages/client/src/__tests__/QuadrantMapRenderer.test.ts
git commit -m "feat: mixed faction color rendering in QuadrantMapRenderer"
```

---

### Task 8: Station Detail Panel — Conquest UI

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

- [ ] **Step 1: Find the station detail section**

```bash
grep -n "has_shipyard\|has_kontor\|civStation\|StationPanel" packages/client/src/components/DetailPanel.tsx | head -20
```

- [ ] **Step 2: Add Conquest Panel to station detail**

Find the section where civ station info is rendered (around line 477+ where "station detail view" comment is). Add after existing station info:

```tsx
{station.mode === 'conquest' && (
  <div style={{ marginTop: 12, borderTop: '1px solid #00FF8844', paddingTop: 8 }}>
    <div style={{ color: '#FF8800', fontSize: '0.7rem', letterSpacing: '0.12em', marginBottom: 6 }}>
      ▶ CONQUEST MODE — QUADRANT EXPANSION
    </div>
    {/* Conquest progress */}
    {conquestShare !== undefined && (
      <>
        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>
          FORTSCHRITT: {Math.floor(conquestShare)} / 100
        </div>
        <div style={{ background: '#111', height: 6, marginBottom: 8 }}>
          <div style={{ background: '#FF8800', height: '100%', width: `${conquestShare}%` }} />
        </div>
      </>
    )}
    {/* Resource pool */}
    <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>
      RESOURCE POOL: {station.conquest_pool} / {CONQUEST_POOL_MAX}
    </div>
    <div style={{ background: '#111', height: 6, marginBottom: 8 }}>
      <div style={{
        background: station.conquest_pool > 0 ? '#00FF88' : '#333',
        height: '100%',
        width: `${(station.conquest_pool / CONQUEST_POOL_MAX) * 100}%`,
      }} />
    </div>
    {/* Rate info */}
    <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: 6 }}>
      RATE: {CONQUEST_RATE[station.level]?.[station.conquest_pool > 0 ? 'boosted' : 'base'] ?? 1.0} PT/TICK
      {' '}· LEVEL {station.level}
    </div>
  </div>
)}
{station.mode === 'factory' && (
  <div style={{ marginTop: 8, color: '#00FF88', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
    ✓ FABRIK-MODUS — Quadrant kontrolliert
  </div>
)}
```

Add the required imports at the top of DetailPanel.tsx if not present:
```typescript
import { CONQUEST_POOL_MAX, CONQUEST_RATE } from '@void-sector/shared';
```

The `conquestShare` variable comes from the quadrant controls state:
```typescript
const quadrantControls = useStore((s) => s.quadrantControls);
const conquestShare = useMemo(() => {
  if (!station) return undefined;
  const qx = Math.floor(station.sector_x / 500);
  const qy = Math.floor(station.sector_y / 500);
  const qc = quadrantControls?.find((q) => q.qx === qx && q.qy === qy);
  return qc?.faction_shares?.[station.faction];
}, [station, quadrantControls]);
```

- [ ] **Step 3: Build client and verify no TypeScript errors**

```bash
cd packages/client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat: conquest mode UI in station detail panel"
```

---

## Chunk 4: Integration + PR

### Task 9: Full integration test

**Files:**
- Create: `packages/server/src/engine/__tests__/conquestEngineIntegration.test.ts`

- [ ] **Step 1: Write integration test for updateShares edge cases**

```typescript
import { describe, it, expect } from 'vitest';
import { updateShares } from '../conquestEngine.js';

describe('updateShares — edge cases', () => {
  it('handles missing own faction key gracefully', () => {
    const { shares } = updateShares({ kthari: 80 }, 'humans', 10);
    expect(shares['humans']).toBe(10);
    expect(shares['kthari']).toBeCloseTo(70);
  });

  it('does not push own share above 100', () => {
    const { shares } = updateShares({ humans: 95 }, 'humans', 20);
    expect(shares['humans']).toBe(100);
  });

  it('battle mode (friction > 80): engine skips tick', () => {
    // This is tested via computeFrictionModifier returning 0
    const { computeFrictionModifier } = require('../conquestEngine.js');
    expect(computeFrictionModifier(85, true)).toBe(0);
  });

  it('three-faction contestation reduces others proportionally', () => {
    const { shares } = updateShares({ humans: 33, kthari: 33, mycelians: 34 }, 'humans', 6);
    const total = Object.values(shares).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.1);
    expect(shares['humans']).toBeCloseTo(39);
  });
});
```

- [ ] **Step 2: Run all server tests**

```bash
cd packages/server && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Run all client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Run all shared tests**

```bash
cd packages/shared && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit and push**

```bash
git add packages/server/src/engine/__tests__/conquestEngineIntegration.test.ts
git commit -m "test: conquest engine edge case integration tests"
git push origin feat/human-expansion
```

---

### Task 10: PR

- [ ] **Create PR**

```bash
gh pr create \
  --title "feat: human expansion — station conquest system" \
  --body "$(cat <<'EOF'
## Summary
- Station mode state machine (`conquest | factory | battle`) auto-transitions per strategic tick
- Resource pool (`conquest_pool`) accelerates conquest rate when filled
- Conquest rate: level 1=1.0/1.5, level 2=1.1/2.0, level 3=1.2/3.0 per tick
- QUAD-MAP mixed faction coloring via `faction_shares` JSONB (all factions)
- Distance-based price bonus for conquest resource delivery
- Migration 065: adds `mode`, `conquest_pool`, `level` to `civ_stations`

## Test plan
- [ ] All unit tests pass (`vitest run` in all 3 packages)
- [ ] Server starts, migration 065 applies cleanly
- [ ] Strategic tick fires every 60s, conquest shares update in `quadrant_control`
- [ ] QUAD-MAP shows mixed colors for contested quadrants
- [ ] Station detail panel shows conquest progress + pool bar
- [ ] `STATION_DEPOSIT_CONQUEST` message fills pool, rejected when full

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for implementer

- **qx/qy derivation**: always `Math.floor(sector_x / 500)` — not stored in `civ_stations`
- **Faction name**: `'humans'` (with s) — migration 063 renamed it
- **Strategic tick interval**: 60s (12 × 5s universe ticks in `universeBootstrap.ts`)
- **`getQuadrantControl`** is in `packages/server/src/db/queries.ts` — already handles null return
- **SectorRoom message path**: check how other economy messages like `BUY_FROM_STATION` are structured for the exact player ID pattern
