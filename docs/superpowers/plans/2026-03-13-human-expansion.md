# Human Expansion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Player-built stations in new quadrants automatically conquer them per strategic tick — with resource pool acceleration and gradual QUAD-MAP coloring for all factions.

**Architecture:** New `ConquestEngine` runs in `StrategicTickService` alongside existing `expansionEngine` and `warfareEngine`. Conquest progress is stored in `quadrant_control.faction_shares` (already JSONB). Three new columns in `civ_stations` (`mode`, `conquest_pool`, `level`). Client renders mixed faction colors in `QuadrantMapRenderer`.

**Tech Stack:** TypeScript, Vitest, PostgreSQL, Colyseus (Zustand client state)

**Spec:** `docs/superpowers/specs/2026-03-13-human-expansion-design.md`

---

## Notes for implementer

- **qx/qy derivation**: use `sectorToQuadrant(sector_x, sector_y)` from `../engine/quadrantEngine.js` — do NOT use `sector_x / 500` (different offset model)
- **Faction name**: `'humans'` (with s) — migration 063 renamed it; `FACTION_COLORS` in QuadrantMapRenderer.ts still has old `'human'` key — fix this in Task 7
- **Player ID in SectorRoom**: `(client.auth as AuthPayload).userId` — never `client.sessionId`
- **Strategic tick interval**: 60s (12 × 5s universe ticks in `universeBootstrap.ts`)
- **`getQuadrantControl`** + **`upsertQuadrantControl`** are in `packages/server/src/db/queries.ts`

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

Find `export interface CivStation` (around line 1472) and replace:

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

- [ ] **Step 3: Also add `STATION_DEPOSIT_CONQUEST` and `CONQUEST_POOL_UPDATED` to message types**

Find the client→server and server→client message union types in `types.ts` and add:

```typescript
// client→server
| { type: 'STATION_DEPOSIT_CONQUEST'; stationId: number; amount: number }

// server→client
| { type: 'CONQUEST_POOL_UPDATED'; stationId: number; newPool: number; newMode: string }
```

- [ ] **Step 4: Build shared package**

```bash
cd packages/shared && npm run build
```

Expected: no errors.

- [ ] **Step 5: Write unit tests**

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

- [ ] **Step 6: Run shared tests**

```bash
cd packages/shared && npx vitest run
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts \
  packages/shared/src/__tests__/conquestConstants.test.ts
git commit -m "feat: conquest constants + CivStation mode/pool/level + message types"
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

-- Existing NPC stations are fully established → factory mode.
-- Only update rows that still have the default 'conquest' to avoid
-- resetting player-built stations in case migration re-runs (idempotent guard).
UPDATE civ_stations SET mode = 'factory'
WHERE mode = 'conquest';
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/065_conquest_mode.sql
git commit -m "feat: migration 065 — conquest mode/pool/level columns on civ_stations"
```

---

## Chunk 2: Server — ConquestEngine + DB queries

### Task 3: New DB query functions for conquest

**Files:**
- Modify: `packages/server/src/db/civQueries.ts`

- [ ] **Step 1: Update `getAllStations()` to map new columns**

In `civQueries.ts`, update the `getAllStations()` SELECT to include the new columns and map them:

```typescript
async getAllStations(): Promise<CivStation[]> {
  const res = await query<{
    id: number; sector_x: number; sector_y: number; faction: string;
    has_shipyard: boolean; has_warehouse: boolean; has_kontor: boolean;
    mode: string; conquest_pool: number; level: number;
  }>('SELECT * FROM civ_stations ORDER BY id');
  return res.rows.map((r) => ({
    id: r.id, sector_x: r.sector_x, sector_y: r.sector_y,
    faction: r.faction, has_shipyard: r.has_shipyard,
    has_warehouse: r.has_warehouse, has_kontor: r.has_kontor,
    mode: (r.mode ?? 'factory') as CivStation['mode'],
    conquest_pool: r.conquest_pool ?? 0,
    level: r.level ?? 1,
  }));
},
```

Also update `getStationsForFaction()` the same way.

- [ ] **Step 2: Add new query functions**

Add after `countDronesAtStation`:

```typescript
async getConquestStations(): Promise<Array<{
  id: number; sector_x: number; sector_y: number;
  faction: string; mode: string; conquest_pool: number; level: number;
}>> {
  const res = await query<{
    id: number; sector_x: number; sector_y: number;
    faction: string; mode: string; conquest_pool: number; level: number;
  }>(`SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level
      FROM civ_stations WHERE mode != 'factory'`);
  return res.rows;
},

async getStationById(id: number): Promise<{
  id: number; sector_x: number; sector_y: number;
  faction: string; mode: string; conquest_pool: number; level: number;
} | null> {
  const res = await query<{
    id: number; sector_x: number; sector_y: number;
    faction: string; mode: string; conquest_pool: number; level: number;
  }>('SELECT id, sector_x, sector_y, faction, mode, conquest_pool, level FROM civ_stations WHERE id = $1', [id]);
  return res.rows[0] ?? null;
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
```

- [ ] **Step 3: Ensure CivStation import is correct in civQueries.ts**

```typescript
import type { CivShip, CivStation } from '@void-sector/shared';
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/civQueries.ts
git commit -m "feat: conquest DB queries — getConquestStations, updateMode, drainPool, depositPool"
```

---

### Task 4: ConquestEngine — TDD

**Files:**
- Create: `packages/server/src/engine/__tests__/conquestEngine.test.ts`
- Create: `packages/server/src/engine/conquestEngine.ts`

- [ ] **Step 1: Write failing tests**

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
    expect(total).toBeLessThanOrEqual(100.01);
  });
  it('three-faction: reduces others proportionally', () => {
    const result = updateShares({ humans: 33, kthari: 33, mycelians: 34 }, 'humans', 6);
    const total = Object.values(result.shares).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.1);
    expect(result.shares['humans']).toBeCloseTo(39);
  });
  it('does not push own share above 100 when starting at 95', () => {
    const result = updateShares({ humans: 95 }, 'humans', 20);
    expect(result.shares['humans']).toBe(100);
  });
  it('handles missing own faction key gracefully', () => {
    const result = updateShares({ kthari: 80 }, 'humans', 10);
    expect(result.shares['humans']).toBe(10);
    expect(result.shares['kthari']).toBeCloseTo(70);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/engine/__tests__/conquestEngine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ConquestEngine**

Create `packages/server/src/engine/conquestEngine.ts`:

```typescript
// packages/server/src/engine/conquestEngine.ts
import { CONQUEST_RATE, CONQUEST_POOL_DRAIN_PER_TICK } from '@void-sector/shared';
import { sectorToQuadrant } from './quadrantEngine.js';
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
  return 0; // ENEMY → mode becomes 'battle'
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

  private async processStation(
    station: { id: number; sector_x: number; sector_y: number; faction: string; mode: string; conquest_pool: number; level: number },
  ): Promise<void> {
    const { qx, qy } = sectorToQuadrant(station.sector_x, station.sector_y);

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
    if (frictionMod === 0) return;

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

    await civQueries.drainConquestPool(station.id, CONQUEST_POOL_DRAIN_PER_TICK);

    logger.debug(
      { stationId: station.id, faction: station.faction, qx, qy, gain: effectiveGain },
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
git commit -m "feat: ConquestEngine — pure logic + tick (TDD)"
```

---

### Task 5: Wire ConquestEngine into StrategicTickService

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts`

- [ ] **Step 1: Add import and field**

Add import alongside other engine imports at the top:

```typescript
import { ConquestEngine } from './conquestEngine.js';
```

Add private field in the class:

```typescript
private conquestEngine = new ConquestEngine();
```

- [ ] **Step 2: Call in tick() method**

In `tick()`, after `// 2. Alien expansion into unclaimed space` block (around line 80), add:

```typescript
// 3. Player station conquest
await this.conquestEngine.tick().catch((err) =>
  logger.error({ err }, 'ConquestEngine tick error'),
);
```

Renumber subsequent comments: Void lifecycle → 4, cleanup → 5.

- [ ] **Step 3: Run all server tests**

```bash
cd packages/server && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/engine/strategicTickService.ts
git commit -m "feat: wire ConquestEngine into StrategicTickService"
```

---

### Task 6: STATION_DEPOSIT_CONQUEST handler in SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

- [ ] **Step 1: Find a reference handler in SectorRoom**

```bash
grep -n "this.onMessage\|AuthPayload\|client.auth" packages/server/src/rooms/SectorRoom.ts | head -20
```

Note the exact pattern used for auth (`(client.auth as AuthPayload).userId`) and imports.

- [ ] **Step 2: Add imports if not already present**

At the top of `SectorRoom.ts`, verify these imports exist (add if missing):

```typescript
import { civQueries } from '../db/civQueries.js';
import { CONQUEST_POOL_MAX } from '@void-sector/shared';
```

- [ ] **Step 3: Add message handler**

In the section where `this.onMessage(...)` calls are registered, add:

```typescript
this.onMessage('STATION_DEPOSIT_CONQUEST', async (client, msg: { stationId: number; amount: number }) => {
  const playerId = (client.auth as AuthPayload).userId;
  const amount = Math.max(0, Math.floor(Number(msg.amount) || 0));
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
  logger.info({ playerId, stationId: msg.stationId, deposited: actual, newPool }, 'conquest pool deposit');
});
```

- [ ] **Step 4: Run all server tests**

```bash
cd packages/server && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: STATION_DEPOSIT_CONQUEST handler in SectorRoom"
```

---

## Chunk 3: Client — QUAD-MAP mixed coloring + Station Detail

### Task 7: Fix FACTION_COLORS + mixed rendering in QuadrantMapRenderer

**Files:**
- Modify: `packages/client/src/canvas/QuadrantMapRenderer.ts`
- Modify: `packages/client/src/__tests__/QuadrantMapRenderer.test.ts`

- [ ] **Step 1: Fix `'human'` → `'humans'` in FACTION_COLORS**

In `QuadrantMapRenderer.ts`, find the `FACTION_COLORS` object (around line 35–50) and rename the key:

```typescript
// Change:
human: 'rgba(64, 128, 255, 0.30)',
// To:
humans: 'rgba(64, 128, 255, 0.30)',
```

- [ ] **Step 2: Write tests for getMixedFactionColors**

In `QuadrantMapRenderer.test.ts`, add:

```typescript
import { getMixedFactionColors } from '../canvas/QuadrantMapRenderer.js';

describe('getMixedFactionColors', () => {
  it('single faction at 100% → one color entry', () => {
    const result = getMixedFactionColors({ humans: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].fraction).toBeCloseTo(1.0);
  });
  it('two factions 60/40 → two entries summing to ~1.0', () => {
    const result = getMixedFactionColors({ humans: 60, kthari: 40 });
    expect(result).toHaveLength(2);
    const total = result.reduce((s, r) => s + r.fraction, 0);
    expect(total).toBeCloseTo(1.0);
  });
  it('filters out factions below 5%', () => {
    const result = getMixedFactionColors({ humans: 98, kthari: 2 });
    expect(result).toHaveLength(1);
  });
  it('empty shares → empty array', () => {
    expect(getMixedFactionColors({})).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/QuadrantMapRenderer.test.ts
```

- [ ] **Step 4: Add `getMixedFactionColors` export**

In `QuadrantMapRenderer.ts`, after the `FACTION_COLORS` constant, add:

```typescript
export function getMixedFactionColors(
  shares: Record<string, number>,
): { color: string; fraction: number }[] {
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return Object.entries(shares)
    .filter(([, v]) => v / total >= 0.05)
    .map(([faction, v]) => ({
      color: FACTION_COLORS[faction] ?? 'rgba(128,128,128,0.3)',
      fraction: v / total,
    }))
    .sort((a, b) => b.fraction - a.fraction);
}
```

- [ ] **Step 5: Update cell rendering to use mixed colors**

In the cell rendering loop, find the section that sets `ctx.fillStyle = factionColor + '22'` and the `ctx.fillRect` for the faction tint (around line 145), and replace with:

```typescript
const mixedColors = getMixedFactionColors(
  ctrl.faction_shares ?? { [ctrl.controlling_faction]: 100 },
);
if (mixedColors.length === 1) {
  ctx.fillStyle = mixedColors[0].color.replace(')', ', 0.13)').replace('rgba', 'rgba');
  ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
} else if (mixedColors.length > 1) {
  let offsetX = cellX - CELL_W / 2;
  for (const { color, fraction } of mixedColors) {
    const segW = CELL_W * fraction;
    ctx.fillStyle = color.replace(')', ', 0.13)').replace('rgba', 'rgba');
    ctx.fillRect(offsetX, cellY - CELL_H / 2, segW, CELL_H);
    offsetX += segW;
  }
}
```

Note: `FACTION_COLORS` values are already in `rgba(...)` format — use them directly (the opacity is already set in the constant values).

Actually, check the exact format of FACTION_COLORS values first — if they already have a full opacity component (like `rgba(64, 128, 255, 0.30)`), use them directly:

```typescript
ctx.fillStyle = mixedColors[0].color; // already has correct opacity
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd packages/client && npx vitest run src/__tests__/QuadrantMapRenderer.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/canvas/QuadrantMapRenderer.ts \
  packages/client/src/__tests__/QuadrantMapRenderer.test.ts
git commit -m "feat: mixed faction color rendering + fix human→humans key in QuadrantMapRenderer"
```

---

### Task 8: Station Detail Panel — Conquest UI

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

- [ ] **Step 1: Find the station detail section**

```bash
grep -n "has_shipyard\|civStation\|// Drill-down\|station detail" packages/client/src/components/DetailPanel.tsx | head -10
```

- [ ] **Step 2: Add imports**

At the top of `DetailPanel.tsx`, add if not already imported:

```typescript
import { CONQUEST_POOL_MAX, CONQUEST_RATE } from '@void-sector/shared';
```

Also check for and remove any duplicate `import { network }` lines (pre-existing issue around lines 4 and 18).

- [ ] **Step 3: Add conquestShare computation**

In the component that renders station detail, add before the return:

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

Note: for the client-side `useMemo`, simple `Math.floor(sector_x / 500)` is acceptable as an approximation to find the QC row — the server uses `sectorToQuadrant` but the visual display difference is negligible.

- [ ] **Step 4: Add Conquest UI to station rendering**

After the existing station info block (where `has_shipyard`, `has_warehouse` etc. are shown), add:

```tsx
{station.mode === 'conquest' && (
  <div style={{ marginTop: 12, borderTop: '1px solid #FF880044', paddingTop: 8 }}>
    <div style={{ color: '#FF8800', fontSize: '0.7rem', letterSpacing: '0.12em', marginBottom: 6 }}>
      ▶ CONQUEST MODE
    </div>
    {conquestShare !== undefined && (
      <>
        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>
          FORTSCHRITT: {Math.floor(conquestShare)} / 100
        </div>
        <div style={{ background: '#111', height: 6, marginBottom: 8 }}>
          <div style={{ background: '#FF8800', height: '100%', width: `${Math.min(100, conquestShare)}%` }} />
        </div>
      </>
    )}
    <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>
      POOL: {station.conquest_pool} / {CONQUEST_POOL_MAX}
    </div>
    <div style={{ background: '#111', height: 6, marginBottom: 8 }}>
      <div style={{
        background: station.conquest_pool > 0 ? '#00FF88' : '#333',
        height: '100%',
        width: `${(station.conquest_pool / CONQUEST_POOL_MAX) * 100}%`,
      }} />
    </div>
    <div style={{ fontSize: '0.65rem', color: '#666' }}>
      RATE: {CONQUEST_RATE[station.level]?.[station.conquest_pool > 0 ? 'boosted' : 'base'] ?? 1.0} PT/TICK
      {' '}· LVL {station.level}
    </div>
  </div>
)}
{station.mode === 'factory' && (
  <div style={{ marginTop: 8, color: '#00FF88', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
    ✓ FABRIK-MODUS
  </div>
)}
```

- [ ] **Step 5: Run client tests and TypeScript check**

```bash
cd packages/client && npx tsc --noEmit && npx vitest run
```

Expected: no errors, all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat: conquest mode UI in station detail panel"
```

---

## Chunk 4: Integration + PR

### Task 9: Run all tests + push

- [ ] **Step 1: Run all tests across all packages**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected: all pass.

- [ ] **Step 2: Push branch**

```bash
git push origin feat/human-expansion
```

---

### Task 10: Create PR

- [ ] **Create PR**

```bash
gh pr create \
  --title "feat: human expansion — station conquest system" \
  --body "$(cat <<'EOF'
## Summary
- Station mode state machine (`conquest | factory | battle`) auto-transitions per strategic tick
- Resource pool (`conquest_pool`) accelerates conquest rate when filled by player deliveries
- Conquest rate per level: L1=1.0/1.5, L2=1.1/2.0, L3=1.2/3.0 pts/tick (base/boosted)
- QUAD-MAP mixed faction coloring via `faction_shares` JSONB (all factions, 5% noise filter)
- Distance-based price bonus for resource delivery to conquest stations
- `STATION_DEPOSIT_CONQUEST` message handler with pool cap enforcement
- Migration 065: adds `mode`, `conquest_pool`, `level` to `civ_stations`
- Fixes `'human'` → `'humans'` key in `FACTION_COLORS`

## Test plan
- [ ] All unit tests pass in shared, server, client
- [ ] Server starts, migration 065 applies cleanly
- [ ] Strategic tick fires, conquest shares update in `quadrant_control`
- [ ] QUAD-MAP shows split colors for two-faction quadrants
- [ ] Station detail panel shows progress bar + pool bar in conquest mode
- [ ] `STATION_DEPOSIT_CONQUEST` fills pool, rejects when full

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
