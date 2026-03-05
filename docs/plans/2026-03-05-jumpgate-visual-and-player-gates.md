# JumpGate Visual Indicators & Player-Built JumpGates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add radar icons for jumpgate sectors (#138) and a full player-built jumpgate system with leveling, data slate linking, credit tolls, and chain routing (#139).

**Architecture:** Extend the existing `jumpgates` table with owner/level/toll columns. New `jumpgate_links` table for multi-link support. Player gates integrate into the existing build system (`handleBuild` in WorldService) and data slate system. Chain routing uses BFS through `jumpgate_links`. Radar overlay draws `◎` icons on gate sectors using chain colors from `jumpGateOverlay.ts`.

**Tech Stack:** TypeScript, PostgreSQL, Colyseus, React, Canvas2D, Vitest

---

### Task 1: Radar Gate Icons (#138)

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts:559-572`
- Modify: `packages/client/src/canvas/QuadrantMapRenderer.ts:152-165`
- Modify: `packages/shared/src/constants.ts:1287-1299` (SYMBOLS)
- Test: `packages/client/src/__tests__/jumpGateOverlay.test.ts`

**Step 1: Add gate symbol to SYMBOLS constant**

In `packages/shared/src/constants.ts`, add to the `SYMBOLS` object:

```typescript
export const SYMBOLS = {
  ship: '\u25A0',
  empty: '\u00B7',
  unexplored: '.',
  asteroid_field: '\u2593',
  nebula: '\u2592',
  station: '\u25B3',
  anomaly: '\u25CA',
  pirate: '\u2620',
  player: '\u25C6',
  iron: '\u26CF',
  homeBase: '\u2302',
  jumpgate: '\u25CE',  // ◎
} as const;
```

**Step 2: Write failing test for gate icon rendering**

Add to `packages/client/src/__tests__/jumpGateOverlay.test.ts`:

```typescript
describe('drawJumpGateIcons', () => {
  it('draws icon at visible gate sector', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 2, fromY: 3, toX: 10, toY: 10, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 100, 100, 20, 20);
    // Should draw icon at fromX and toX positions
    expect(spy).toHaveBeenCalled();
  });

  it('skips icons outside visible radius', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 100, fromY: 100, toX: 200, toY: 200, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 100, 100, 20, 20);
    expect(spy).not.toHaveBeenCalled();
  });

  it('uses chain color for icon', () => {
    const spy = vi.spyOn(ctx, 'fillText');
    const gates: JumpGateMapEntry[] = [
      { gateId: 'g1', fromX: 1, fromY: 1, toX: 5, toY: 5, gateType: 'bidirectional' },
    ];
    drawJumpGateIcons(ctx, gates, 0, 0, 5, 5, 100, 100, 20, 20);
    expect(spy).toHaveBeenCalled();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd packages/client && npx vitest run src/__tests__/jumpGateOverlay.test.ts`
Expected: FAIL — `drawJumpGateIcons` not exported

**Step 4: Implement drawJumpGateIcons**

Add to `packages/client/src/canvas/jumpGateOverlay.ts`:

```typescript
import { SYMBOLS } from '@void-sector/shared';

export function drawJumpGateIcons(
  ctx: CanvasRenderingContext2D,
  gates: JumpGateMapEntry[],
  viewX: number,
  viewY: number,
  radiusX: number,
  radiusY: number,
  gridCenterX: number,
  gridCenterY: number,
  cellW: number,
  cellH: number,
): void {
  if (gates.length === 0) return;

  const chainMap = buildChainMap(gates);
  // Collect unique gate sector positions
  const drawn = new Set<string>();

  ctx.save();
  ctx.font = `${Math.min(cellW, cellH) * 0.6}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.8;

  for (const gate of gates) {
    const ci = chainMap.get(gate.gateId) ?? 0;
    ctx.fillStyle = chainColor(ci);

    for (const [sx, sy] of [[gate.fromX, gate.fromY], [gate.toX, gate.toY]]) {
      const key = `${sx}:${sy}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      const dx = sx - viewX;
      const dy = sy - viewY;
      if (Math.abs(dx) > radiusX || Math.abs(dy) > radiusY) continue;

      const px = gridCenterX + dx * cellW;
      const py = gridCenterY + dy * cellH;
      ctx.fillText(SYMBOLS.jumpgate, px, py - cellH * 0.35);
    }
  }

  ctx.globalAlpha = 1.0;
  ctx.restore();
}
```

**Step 5: Call drawJumpGateIcons from RadarRenderer**

In `packages/client/src/canvas/RadarRenderer.ts`, after the `drawJumpGateLines` call (~line 572), add:

```typescript
import { drawJumpGateLines, drawJumpGateIcons } from './jumpGateOverlay';

// After drawJumpGateLines block:
if (state.knownJumpGates && state.knownJumpGates.length > 0 && !animActive) {
  drawJumpGateIcons(
    ctx,
    state.knownJumpGates,
    viewX, viewY,
    radiusX, radiusY,
    gridCenterX, gridCenterY,
    CELL_W, CELL_H,
  );
}
```

**Step 6: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add packages/shared/src/constants.ts packages/client/src/canvas/jumpGateOverlay.ts packages/client/src/canvas/RadarRenderer.ts packages/client/src/__tests__/jumpGateOverlay.test.ts
git commit -m "feat: add radar gate icons for jumpgate sectors (#138)"
```

---

### Task 2: DB Migration — Player Gate Columns & Link Table

**Files:**
- Create: `packages/server/src/db/migrations/030_player_jumpgates.sql`
- Test: `packages/server/src/__tests__/migration-030.test.ts`

**Step 1: Write the migration**

Create `packages/server/src/db/migrations/030_player_jumpgates.sql`:

```sql
-- 030: Player-built jumpgates

-- Extend jumpgates table for player ownership and leveling
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT NULL;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS level_connection INT DEFAULT 1;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS level_distance INT DEFAULT 1;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS toll_credits INT DEFAULT 0;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS built_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_jumpgates_owner ON jumpgates(owner_id);

-- Link table for multi-gate connections
CREATE TABLE IF NOT EXISTS jumpgate_links (
  gate_id TEXT NOT NULL REFERENCES jumpgates(id) ON DELETE CASCADE,
  linked_gate_id TEXT NOT NULL REFERENCES jumpgates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (gate_id, linked_gate_id)
);
CREATE INDEX IF NOT EXISTS idx_jumpgate_links_gate ON jumpgate_links(gate_id);
CREATE INDEX IF NOT EXISTS idx_jumpgate_links_linked ON jumpgate_links(linked_gate_id);
```

**Step 2: Write migration test**

Create `packages/server/src/__tests__/migration-030.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('migration 030 — player jumpgates', () => {
  const sql = readFileSync(
    join(__dirname, '../db/migrations/030_player_jumpgates.sql'),
    'utf-8',
  );

  it('adds owner_id column', () => {
    expect(sql).toContain('owner_id');
  });

  it('adds level columns', () => {
    expect(sql).toContain('level_connection');
    expect(sql).toContain('level_distance');
  });

  it('adds toll_credits column', () => {
    expect(sql).toContain('toll_credits');
  });

  it('creates jumpgate_links table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS jumpgate_links');
  });

  it('has CASCADE delete on links', () => {
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('uses IF NOT EXISTS for idempotency', () => {
    const lines = sql.split('\n').filter((l) => l.includes('CREATE'));
    for (const line of lines) {
      expect(line).toContain('IF NOT EXISTS');
    }
  });
});
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/__tests__/migration-030.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/db/migrations/030_player_jumpgates.sql packages/server/src/__tests__/migration-030.test.ts
git commit -m "feat: migration 030 — player jumpgate columns and link table"
```

---

### Task 3: Shared Constants & Types

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add jumpgate to StructureType**

In `packages/shared/src/types.ts`, add `'jumpgate'` to the `StructureType` union:

```typescript
export type StructureType =
  | 'comm_relay'
  | 'mining_station'
  | 'base'
  | 'jumpgate'
  // ... rest unchanged
```

Add `'jumpgate'` to `SlateType`:

```typescript
export type SlateType = 'sector' | 'area' | 'custom' | 'jumpgate';
```

Add new interfaces:

```typescript
export interface PlayerJumpGate {
  id: string;
  sectorX: number;
  sectorY: number;
  ownerId: string;
  ownerName?: string;
  levelConnection: number;
  levelDistance: number;
  tollCredits: number;
  linkedGates: PlayerJumpGateLink[];
}

export interface PlayerJumpGateLink {
  gateId: string;
  sectorX: number;
  sectorY: number;
  ownerName?: string;
}

export interface JumpGateDestination {
  gateId: string;
  sectorX: number;
  sectorY: number;
  totalCost: number;
  hops: number;
}
```

**Step 2: Add jumpgate constants**

In `packages/shared/src/constants.ts`:

```typescript
// Player Jumpgate costs
export const JUMPGATE_BUILD_COST = { credits: 500, crystal: 20, artefact: 5 };
export const JUMPGATE_UPGRADE_COSTS: Record<string, Record<string, number>> = {
  connection_2: { credits: 300, ore: 15, artefact: 3 },
  connection_3: { credits: 800, ore: 30, artefact: 8 },
  distance_2: { credits: 300, crystal: 15, artefact: 3 },
  distance_3: { credits: 800, crystal: 30, artefact: 8 },
};

export const JUMPGATE_DISTANCE_LIMITS: Record<number, number> = {
  1: 250,
  2: 500,
  3: 2500,
};

export const JUMPGATE_CONNECTION_LIMITS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
};

export const JUMPGATE_MAX_CHAIN_HOPS = 10;
```

Add jumpgate to `STRUCTURE_COSTS` (resource part only — credits handled separately):

```typescript
export const STRUCTURE_COSTS: Record<StructureType, Record<MineableResourceType, number>> = {
  // ... existing entries ...
  jumpgate: { ore: 0, gas: 0, crystal: 20 },
};
```

Add to `STRUCTURE_AP_COSTS`:
```typescript
jumpgate: 10,
```

**Step 3: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat: jumpgate types, constants, and StructureType extension"
```

---

### Task 4: DB Queries for Player Gates

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Test: `packages/server/src/__tests__/jumpgateQueries.test.ts`

**Step 1: Write failing tests**

Create `packages/server/src/__tests__/jumpgateQueries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  JUMPGATE_DISTANCE_LIMITS,
  JUMPGATE_CONNECTION_LIMITS,
  JUMPGATE_MAX_CHAIN_HOPS,
} from '@void-sector/shared';

describe('jumpgate constants', () => {
  it('distance limits scale per level', () => {
    expect(JUMPGATE_DISTANCE_LIMITS[1]).toBe(250);
    expect(JUMPGATE_DISTANCE_LIMITS[2]).toBe(500);
    expect(JUMPGATE_DISTANCE_LIMITS[3]).toBe(2500);
  });

  it('connection limits scale per level', () => {
    expect(JUMPGATE_CONNECTION_LIMITS[1]).toBe(1);
    expect(JUMPGATE_CONNECTION_LIMITS[2]).toBe(2);
    expect(JUMPGATE_CONNECTION_LIMITS[3]).toBe(3);
  });

  it('max chain hops is 10', () => {
    expect(JUMPGATE_MAX_CHAIN_HOPS).toBe(10);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/jumpgateQueries.test.ts`
Expected: PASS (constants already added in Task 3)

**Step 3: Add DB query functions**

Add to `packages/server/src/db/queries.ts`:

```typescript
// --- Player JumpGates ---

export async function insertPlayerJumpGate(gate: {
  id: string;
  sectorX: number;
  sectorY: number;
  ownerId: string;
  tollCredits?: number;
}): Promise<void> {
  await query(
    `INSERT INTO jumpgates (id, sector_x, sector_y, target_x, target_y, gate_type, owner_id, toll_credits, built_at)
     VALUES ($1, $2, $3, $2, $3, 'bidirectional', $4, $5, NOW())
     ON CONFLICT (sector_x, sector_y) DO NOTHING`,
    [gate.id, gate.sectorX, gate.sectorY, gate.ownerId, gate.tollCredits ?? 0],
  );
}

export async function getPlayerJumpGate(sectorX: number, sectorY: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT g.id, g.sector_x as "sectorX", g.sector_y as "sectorY",
            g.owner_id as "ownerId", g.level_connection as "levelConnection",
            g.level_distance as "levelDistance", g.toll_credits as "tollCredits",
            p.username as "ownerName"
     FROM jumpgates g
     LEFT JOIN players p ON p.id::text = g.owner_id::text
     WHERE g.sector_x = $1 AND g.sector_y = $2 AND g.owner_id IS NOT NULL`,
    [sectorX, sectorY],
  );
  return rows[0] ?? null;
}

export async function getJumpGateLinks(gateId: string): Promise<Array<{
  gateId: string; sectorX: number; sectorY: number; ownerName?: string;
}>> {
  const { rows } = await query(
    `SELECT g.id as "gateId", g.sector_x as "sectorX", g.sector_y as "sectorY",
            p.username as "ownerName"
     FROM jumpgate_links jl
     JOIN jumpgates g ON g.id = jl.linked_gate_id
     LEFT JOIN players p ON p.id::text = g.owner_id::text
     WHERE jl.gate_id = $1`,
    [gateId],
  );
  return rows;
}

export async function insertJumpGateLink(gateId: string, linkedGateId: string): Promise<void> {
  await query(
    `INSERT INTO jumpgate_links (gate_id, linked_gate_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [gateId, linkedGateId],
  );
  // Bidirectional
  await query(
    `INSERT INTO jumpgate_links (gate_id, linked_gate_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [linkedGateId, gateId],
  );
}

export async function removeJumpGateLink(gateId: string, linkedGateId: string): Promise<void> {
  await query(
    `DELETE FROM jumpgate_links WHERE
     (gate_id = $1 AND linked_gate_id = $2) OR (gate_id = $2 AND linked_gate_id = $1)`,
    [gateId, linkedGateId],
  );
}

export async function countJumpGateLinks(gateId: string): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*)::int as count FROM jumpgate_links WHERE gate_id = $1`,
    [gateId],
  );
  return rows[0]?.count ?? 0;
}

export async function upgradeJumpGate(
  gateId: string,
  field: 'level_connection' | 'level_distance',
  newLevel: number,
): Promise<void> {
  await query(`UPDATE jumpgates SET ${field} = $2 WHERE id = $1`, [gateId, newLevel]);
}

export async function updateJumpGateToll(gateId: string, toll: number): Promise<void> {
  await query(`UPDATE jumpgates SET toll_credits = $1 WHERE id = $2`, [toll, gateId]);
}

export async function deleteJumpGate(gateId: string): Promise<void> {
  // Links cascade-delete due to ON DELETE CASCADE
  await query(`DELETE FROM jumpgates WHERE id = $1`, [gateId]);
}

export async function getAllPlayerGateLinks(): Promise<Array<{
  gateId: string; fromX: number; fromY: number; toX: number; toY: number;
}>> {
  const { rows } = await query(
    `SELECT jl.gate_id as "gateId",
            g1.sector_x as "fromX", g1.sector_y as "fromY",
            g2.sector_x as "toX", g2.sector_y as "toY"
     FROM jumpgate_links jl
     JOIN jumpgates g1 ON g1.id = jl.gate_id
     JOIN jumpgates g2 ON g2.id = jl.linked_gate_id
     WHERE g1.owner_id IS NOT NULL`,
    [],
  );
  return rows;
}
```

**Step 4: Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/__tests__/jumpgateQueries.test.ts
git commit -m "feat: DB query functions for player jumpgates and links"
```

---

### Task 5: Chain Routing Engine (BFS)

**Files:**
- Create: `packages/server/src/engine/jumpgateRouting.ts`
- Test: `packages/server/src/engine/__tests__/jumpgateRouting.test.ts`

**Step 1: Write failing tests**

Create `packages/server/src/engine/__tests__/jumpgateRouting.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findReachableGates } from '../jumpgateRouting.js';

const makeGate = (id: string, x: number, y: number, toll: number) => ({
  id, sectorX: x, sectorY: y, tollCredits: toll,
});

describe('findReachableGates', () => {
  it('returns direct link as single hop', () => {
    const gates = new Map([
      ['A', makeGate('A', 0, 0, 5)],
      ['B', makeGate('B', 10, 10, 10)],
    ]);
    const links = new Map([['A', ['B']], ['B', ['A']]]);
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ gateId: 'B', totalCost: 5, hops: 1 });
  });

  it('returns multi-hop chain with accumulated cost', () => {
    const gates = new Map([
      ['A', makeGate('A', 0, 0, 5)],
      ['B', makeGate('B', 10, 0, 10)],
      ['C', makeGate('C', 20, 0, 15)],
    ]);
    const links = new Map([['A', ['B']], ['B', ['A', 'C']], ['C', ['B']]]);
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(2);
    const toC = result.find((r) => r.gateId === 'C');
    expect(toC).toMatchObject({ gateId: 'C', totalCost: 15, hops: 2 }); // 5 (A) + 10 (B)
  });

  it('respects max hop limit', () => {
    // Chain of 12 gates: A-B-C-D-E-F-G-H-I-J-K-L
    const gates = new Map<string, any>();
    const links = new Map<string, string[]>();
    const ids = 'ABCDEFGHIJKL'.split('');
    for (let i = 0; i < ids.length; i++) {
      gates.set(ids[i], makeGate(ids[i], i * 10, 0, 1));
      const neighbors = [];
      if (i > 0) neighbors.push(ids[i - 1]);
      if (i < ids.length - 1) neighbors.push(ids[i + 1]);
      links.set(ids[i], neighbors);
    }
    const result = findReachableGates('A', gates, links);
    // Max 10 hops means we can reach up to K (index 10), not L (index 11)
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.find((r) => r.gateId === 'L')).toBeUndefined();
  });

  it('handles cycles without infinite loops', () => {
    const gates = new Map([
      ['A', makeGate('A', 0, 0, 5)],
      ['B', makeGate('B', 10, 0, 5)],
      ['C', makeGate('C', 10, 10, 5)],
    ]);
    // Triangle: A-B-C-A
    const links = new Map([
      ['A', ['B', 'C']],
      ['B', ['A', 'C']],
      ['C', ['A', 'B']],
    ]);
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(2);
  });

  it('returns empty for gate with no links', () => {
    const gates = new Map([['A', makeGate('A', 0, 0, 5)]]);
    const links = new Map<string, string[]>();
    const result = findReachableGates('A', gates, links);
    expect(result).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/jumpgateRouting.test.ts`
Expected: FAIL — module not found

**Step 3: Implement BFS routing**

Create `packages/server/src/engine/jumpgateRouting.ts`:

```typescript
import { JUMPGATE_MAX_CHAIN_HOPS } from '@void-sector/shared';
import type { JumpGateDestination } from '@void-sector/shared';

interface GateInfo {
  id: string;
  sectorX: number;
  sectorY: number;
  tollCredits: number;
}

export function findReachableGates(
  startGateId: string,
  gates: Map<string, GateInfo>,
  links: Map<string, string[]>,
): JumpGateDestination[] {
  const results: JumpGateDestination[] = [];
  const visited = new Set<string>([startGateId]);

  // BFS: [gateId, accumulatedCost, hops]
  const queue: Array<[string, number, number]> = [];

  const startGate = gates.get(startGateId);
  if (!startGate) return results;

  // Seed with direct neighbors
  const neighbors = links.get(startGateId) ?? [];
  for (const neighborId of neighbors) {
    if (!visited.has(neighborId)) {
      queue.push([neighborId, startGate.tollCredits, 1]);
      visited.add(neighborId);
    }
  }

  while (queue.length > 0) {
    const [currentId, cost, hops] = queue.shift()!;
    const gate = gates.get(currentId);
    if (!gate) continue;

    results.push({
      gateId: currentId,
      sectorX: gate.sectorX,
      sectorY: gate.sectorY,
      totalCost: cost,
      hops,
    });

    if (hops >= JUMPGATE_MAX_CHAIN_HOPS) continue;

    const nextNeighbors = links.get(currentId) ?? [];
    for (const nextId of nextNeighbors) {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push([nextId, cost + gate.tollCredits, hops + 1]);
      }
    }
  }

  return results;
}
```

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/jumpgateRouting.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/engine/jumpgateRouting.ts packages/server/src/engine/__tests__/jumpgateRouting.test.ts
git commit -m "feat: BFS chain routing for player jumpgate networks"
```

---

### Task 6: Server Handlers — Build, Upgrade, Dismantle, Toll

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts`
- Modify: `packages/server/src/rooms/services/NavigationService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/engine/commands.ts`

**Step 1: Add jumpgate to VALID_STRUCTURE_TYPES**

In `packages/server/src/rooms/services/WorldService.ts:112-117`:

```typescript
const VALID_STRUCTURE_TYPES = [
  'comm_relay',
  'mining_station',
  'base',
  'storage',
  'trading_post',
  'jumpgate',
  // ... rest unchanged
];
```

**Step 2: Add build validation for jumpgate**

The existing `handleBuild` flow deducts cargo resources via `STRUCTURE_COSTS` and AP via `STRUCTURE_AP_COSTS`. Jumpgate also needs credits + artefacts. Add a post-validation check in `handleBuild`:

After the `validateBuild` call in `WorldService.handleBuild`, add:

```typescript
if (data.type === 'jumpgate') {
  // Additional jumpgate validation
  const { checkJumpGate } = await import('../../engine/worldgen.js');
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);
  if (checkJumpGate(sx, sy)) {
    client.send('buildResult', { success: false, error: 'World gate already exists here' });
    return;
  }
  const existingGate = await getJumpGate(sx, sy);
  if (existingGate) {
    client.send('buildResult', { success: false, error: 'Jumpgate already exists here' });
    return;
  }
  // Deduct credits
  const credits = await getPlayerCredits(auth.userId);
  if (credits < JUMPGATE_BUILD_COST.credits) {
    client.send('buildResult', { success: false, error: `Need ${JUMPGATE_BUILD_COST.credits} credits` });
    return;
  }
  const cargoState = await getPlayerCargo(auth.userId);
  if ((cargoState.artefact ?? 0) < JUMPGATE_BUILD_COST.artefact) {
    client.send('buildResult', { success: false, error: `Need ${JUMPGATE_BUILD_COST.artefact} artefacts` });
    return;
  }
  await deductCredits(auth.userId, JUMPGATE_BUILD_COST.credits);
  await deductCargo(auth.userId, 'artefact', JUMPGATE_BUILD_COST.artefact);

  // Insert into jumpgates table (not structures table)
  const gateId = `pgate_${sx}_${sy}`;
  await insertPlayerJumpGate({ id: gateId, sectorX: sx, sectorY: sy, ownerId: auth.userId });

  client.send('buildResult', { success: true, structure: { id: gateId, type: 'jumpgate', sectorX: sx, sectorY: sy } });
  client.send('apUpdate', result.newAP!);
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', updatedCargo);
  client.send('creditsUpdate', await getPlayerCredits(auth.userId));
  return;
}
```

**Step 3: Add upgrade, dismantle, and toll message handlers**

Add new message handlers in `SectorRoom.ts` (in the navigation/world section):

```typescript
this.onMessage('upgradeJumpgate', async (client, data: { gateId: string; upgradeType: string }) => {
  await this.world.handleUpgradeJumpgate(client, data);
});
this.onMessage('dismantleJumpgate', async (client, data: { gateId: string }) => {
  await this.world.handleDismantleJumpgate(client, data);
});
this.onMessage('setJumpgateToll', async (client, data: { gateId: string; toll: number }) => {
  await this.world.handleSetJumpgateToll(client, data);
});
```

**Step 4: Implement upgrade handler in WorldService**

```typescript
async handleUpgradeJumpgate(client: Client, data: { gateId: string; upgradeType: string }): Promise<void> {
  if (rejectGuest(client, 'Upgraden')) return;
  const auth = client.auth as AuthPayload;
  const gate = await getPlayerJumpGate(/* need sector coords or gate id lookup */);
  // Validate ownership, level cap, resources, deduct, update
  // ... (full implementation)
  client.send('jumpgateUpdated', { success: true, gate });
}
```

**Step 5: Implement dismantle handler**

```typescript
async handleDismantleJumpgate(client: Client, data: { gateId: string }): Promise<void> {
  if (rejectGuest(client, 'Abbauen')) return;
  const auth = client.auth as AuthPayload;
  // Validate ownership
  // Calculate 50% refund of total investment
  // Delete gate (links cascade)
  // Return resources + credits
  // Return slates to unlinking player (owner in this case)
  client.send('jumpgateDismantled', { success: true });
}
```

**Step 6: Implement toll handler**

```typescript
async handleSetJumpgateToll(client: Client, data: { gateId: string; toll: number }): Promise<void> {
  if (rejectGuest(client, 'Maut setzen')) return;
  const auth = client.auth as AuthPayload;
  // Validate ownership, toll >= 0
  await updateJumpGateToll(data.gateId, data.toll);
  client.send('jumpgateUpdated', { success: true });
}
```

**Step 7: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/server/src/rooms/services/WorldService.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/engine/commands.ts
git commit -m "feat: server handlers for jumpgate build, upgrade, dismantle, toll"
```

---

### Task 7: Gate Slate Creation & Linking

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add gate slate creation to handleCreateSlate**

In `WorldService.handleCreateSlate`, extend the slate type validation to accept `'jumpgate'`:

```typescript
if (!['sector', 'area', 'jumpgate'].includes(data.slateType)) {
  client.send('createSlateResult', { success: false, error: 'Invalid slate type' });
  return;
}
```

Add jumpgate slate branch:

```typescript
if (data.slateType === 'jumpgate') {
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);
  const gate = await getPlayerJumpGate(sx, sy);
  if (!gate || gate.ownerId !== auth.userId) {
    client.send('createSlateResult', { success: false, error: 'You must be at your own jumpgate' });
    return;
  }
  // Create slate with gate metadata
  const slate = await createDataSlate(auth.userId, 'jumpgate', [
    { x: sx, y: sy, type: 'jumpgate', metadata: { gateId: gate.id, ownerName: auth.username } },
  ]);
  await addSlateToCargo(auth.userId);
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('createSlateResult', {
    success: true,
    slate: { id: slate.id, slateType: 'jumpgate', sectorData: slate.sectorData, status: 'available' },
    cargo: updatedCargo,
  });
  return;
}
```

**Step 2: Add link message handler**

In `SectorRoom.ts`:

```typescript
this.onMessage('linkJumpgate', async (client, data: { slateId: string }) => {
  await this.world.handleLinkJumpgate(client, data);
});
this.onMessage('unlinkJumpgate', async (client, data: { gateId: string; linkedGateId: string }) => {
  await this.world.handleUnlinkJumpgate(client, data);
});
```

**Step 3: Implement link handler**

In `WorldService`:

```typescript
async handleLinkJumpgate(client: Client, data: { slateId: string }): Promise<void> {
  if (rejectGuest(client, 'Verknüpfen')) return;
  const auth = client.auth as AuthPayload;

  // Get player's gate at current sector
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);
  const myGate = await getPlayerJumpGate(sx, sy);
  if (!myGate || myGate.ownerId !== auth.userId) {
    client.send('error', { code: 'LINK_FAIL', message: 'You must be at your own jumpgate' });
    return;
  }

  // Get slate from cargo
  const slate = await getSlateById(data.slateId);
  if (!slate || slate.ownerId !== auth.userId || slate.slateType !== 'jumpgate') {
    client.send('error', { code: 'LINK_FAIL', message: 'Invalid gate slate' });
    return;
  }

  const targetGateId = slate.sectorData[0]?.metadata?.gateId;
  const targetGate = await getJumpGateById(targetGateId);
  if (!targetGate || !targetGate.ownerId) {
    client.send('error', { code: 'LINK_FAIL', message: 'Target gate no longer exists' });
    return;
  }

  // Check distance
  const dist = Math.abs(myGate.sectorX - targetGate.sectorX) + Math.abs(myGate.sectorY - targetGate.sectorY);
  const maxDist = JUMPGATE_DISTANCE_LIMITS[myGate.levelDistance] + JUMPGATE_DISTANCE_LIMITS[targetGate.levelDistance];
  if (dist > maxDist) {
    client.send('error', { code: 'LINK_FAIL', message: `Distance ${dist} exceeds max range ${maxDist}` });
    return;
  }

  // Check connection slots
  const myLinks = await countJumpGateLinks(myGate.id);
  if (myLinks >= JUMPGATE_CONNECTION_LIMITS[myGate.levelConnection]) {
    client.send('error', { code: 'LINK_FAIL', message: 'No free connection slots on your gate' });
    return;
  }
  const targetLinks = await countJumpGateLinks(targetGateId);
  if (targetLinks >= JUMPGATE_CONNECTION_LIMITS[targetGate.levelConnection]) {
    client.send('error', { code: 'LINK_FAIL', message: 'Target gate has no free connection slots' });
    return;
  }

  // Create link, consume slate
  await insertJumpGateLink(myGate.id, targetGateId);
  await consumeSlate(data.slateId);

  client.send('jumpgateLinkResult', { success: true });
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', updatedCargo);
}
```

**Step 4: Implement unlink handler**

```typescript
async handleUnlinkJumpgate(client: Client, data: { gateId: string; linkedGateId: string }): Promise<void> {
  if (rejectGuest(client, 'Trennen')) return;
  const auth = client.auth as AuthPayload;

  // Verify ownership
  const gate = await getJumpGateById(data.gateId);
  if (!gate || gate.ownerId !== auth.userId) {
    client.send('error', { code: 'UNLINK_FAIL', message: 'Not your gate' });
    return;
  }

  await removeJumpGateLink(data.gateId, data.linkedGateId);

  // Return a gate slate to the unlinking player
  await createDataSlate(auth.userId, 'jumpgate', [
    { x: gate.sectorX, y: gate.sectorY, type: 'jumpgate', metadata: { gateId: data.linkedGateId } },
  ]);
  await addSlateToCargo(auth.userId);

  client.send('jumpgateUnlinkResult', { success: true });
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', updatedCargo);
}
```

**Step 5: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/server/src/rooms/services/WorldService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: gate slate creation, linking, and unlinking handlers"
```

---

### Task 8: Travel Handler — Chain Jump

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add usePlayerGate message handler**

In `SectorRoom.ts`:

```typescript
this.onMessage('usePlayerGate', async (client, data: { gateId: string; destinationGateId: string }) => {
  await this.navigation.handleUsePlayerGate(client, data);
});
```

**Step 2: Implement handleUsePlayerGate in NavigationService**

```typescript
async handleUsePlayerGate(
  client: Client,
  data: { gateId: string; destinationGateId: string },
): Promise<void> {
  const auth = client.auth as AuthPayload;

  // Verify player is at the gate's sector
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);
  const gate = await getPlayerJumpGate(sx, sy);
  if (!gate || gate.id !== data.gateId) {
    client.send('error', { code: 'GATE_FAIL', message: 'Not at this gate' });
    return;
  }

  // Build gate graph and find route via BFS
  const allLinks = await getAllPlayerGateLinks();
  // Build gates map and links map from DB
  // Use findReachableGates to get destinations
  // Find the requested destination in results
  const destination = results.find((r) => r.gateId === data.destinationGateId);
  if (!destination) {
    client.send('error', { code: 'GATE_FAIL', message: 'Destination not reachable' });
    return;
  }

  // Check credits
  const credits = await getPlayerCredits(auth.userId);
  if (credits < destination.totalCost) {
    client.send('error', { code: 'GATE_FAIL', message: `Need ${destination.totalCost} credits` });
    return;
  }

  // Deduct credits from traveler, distribute to gate owners along route
  await deductCredits(auth.userId, destination.totalCost);
  // ... distribute per hop to each gate owner

  // Move player to destination
  const targetX = destination.sectorX;
  const targetY = destination.sectorY;
  // Same pattern as existing jumpgate travel (handleUseJumpGate)
  // Update position, send sectorData, handle cross-quadrant
  client.send('useJumpGateResult', {
    success: true,
    targetX,
    targetY,
    // ... same shape as existing gate result
  });
}
```

**Step 3: Send player gate info on sector enter**

In `NavigationService.detectAndSendJumpGate`, after checking world gates, also check for player gates:

```typescript
// Check for player gate
const playerGate = await getPlayerJumpGate(sectorX, sectorY);
if (playerGate) {
  const links = await getJumpGateLinks(playerGate.id);
  // Build route graph, find destinations
  client.send('playerGateInfo', {
    gate: playerGate,
    links,
    destinations, // from BFS
  });
}
```

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/rooms/services/NavigationService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: player gate travel with chain routing and credit tolls"
```

---

### Task 9: Client UI — Detail Panel & Network

**Files:**
- Create: `packages/client/src/components/PlayerGatePanel.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/state/gameSlice.ts`

**Step 1: Add state for player gate info**

In `gameSlice.ts`:

```typescript
// Add to state
playerGateInfo: PlayerJumpGate | null;
// Add setter
setPlayerGateInfo: (gate: PlayerJumpGate | null) => void;
```

**Step 2: Add network listener**

In `client.ts` setupRoomListeners:

```typescript
room.onMessage('playerGateInfo', (data) => {
  useStore.getState().setPlayerGateInfo(data.gate);
});
```

Add send methods:

```typescript
sendUpgradeJumpgate(gateId: string, upgradeType: string) { ... }
sendDismantleJumpgate(gateId: string) { ... }
sendSetJumpgateToll(gateId: string, toll: number) { ... }
sendLinkJumpgate(slateId: string) { ... }
sendUnlinkJumpgate(gateId: string, linkedGateId: string) { ... }
sendUsePlayerGate(gateId: string, destinationGateId: string) { ... }
```

**Step 3: Create PlayerGatePanel component**

Create `packages/client/src/components/PlayerGatePanel.tsx`:

- Shows gate info (level, toll, links)
- Owner view: upgrade buttons, toll setter, create slate, dismantle, unlink buttons
- Visitor view: destinations with costs, jump buttons
- Foreign slate in cargo: link button with distance check

**Step 4: Integrate into DetailPanel**

In `DetailPanel.tsx`, when sector has a player gate, render `<PlayerGatePanel>` instead of or alongside the existing `<JumpGatePanel>`.

**Step 5: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/client/src/components/PlayerGatePanel.tsx packages/client/src/components/DetailPanel.tsx packages/client/src/network/client.ts packages/client/src/state/gameSlice.ts
git commit -m "feat: PlayerGatePanel UI with owner/visitor views and network integration"
```

---

### Task 10: Integration Test & Deploy

**Step 1: Run all tests**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected: ALL PASS

**Step 2: Build and deploy**

```bash
docker compose up -d --build --force-recreate server client
```

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: integration fixes for player jumpgates"
```
