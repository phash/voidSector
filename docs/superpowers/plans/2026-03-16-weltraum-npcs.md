# Weltraum-NPCs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NPC spaceships (TRADE, MILITARY, OUTLAW) that fly through the game world, appear on radar, and support trading, combat, and quest interactions.

**Architecture:** Extend the existing `civ_ships` table with a `role` column and new fields. Pure state-machine AI functions dispatch by role in `processCivTick()`. A new `NpcShipService` handles player interactions. Per-client broadcast filtering hides unrevealed OUTLAWs.

**Tech Stack:** TypeScript, PostgreSQL, Colyseus (rooms/schema), Vitest, React/Zustand, Canvas 2D

**Spec:** `docs/superpowers/specs/2026-03-16-weltraum-npcs-design.md`

---

## Chunk 1: Data Model & Types

### Task 1: DB Migration — civ_ships extension

**Files:**
- Create: `packages/server/src/db/migrations/076_npc_ships.sql`

- [ ] **Step 1: Write migration**

```sql
-- 076_npc_ships.sql
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'drone';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS name VARCHAR(60) DEFAULT '';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '{}';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS patrol_state JSONB DEFAULT '{}';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS dead_until TIMESTAMPTZ DEFAULT NULL;

-- Allow quest_item in inventory table
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_item_type_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_item_type_check
  CHECK (item_type IN ('resource', 'module', 'blueprint', 'prisoner', 'data_slate', 'quest_item'));
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/076_npc_ships.sql
git commit -m "feat(db): migration 076 — civ_ships NPC fields + quest_item constraint"
```

---

### Task 2: Shared types — CivShip, NpcFactionId, QuestObjective extensions

**Files:**
- Modify: `packages/shared/src/types.ts:660,685,688-707,1485-1502`

- [ ] **Step 1: Extend NpcFactionId** (line 660)

Change:
```ts
export type NpcFactionId = 'traders' | 'scientists' | 'pirates' | 'ancients' | 'independent';
```
To:
```ts
export type NpcFactionId = 'traders' | 'scientists' | 'pirates' | 'ancients' | 'independent' | 'outlaws';
```

- [ ] **Step 2: Extend QuestObjectiveType** (line 685)

Change:
```ts
export type QuestObjectiveType = QuestType | 'bounty_trail' | 'bounty_combat' | 'bounty_deliver' | 'scan_deliver';
```
To:
```ts
export type QuestObjectiveType = QuestType | 'bounty_trail' | 'bounty_combat' | 'bounty_deliver' | 'scan_deliver' | 'find_npc' | 'deliver_to_npc';
```

- [ ] **Step 3: Extend QuestObjective interface** (lines 688–707)

Add fields after the existing ones:
```ts
  targetNpcId?: number;
  targetNpcRole?: string;
  targetNpcName?: string;
  cargoItem?: string;
```

- [ ] **Step 4: Extend CivShip interface** (lines 1488–1502)

Add new fields:
```ts
  role?: 'drone' | 'trader' | 'military' | 'outlaw';
  level?: number;
  name?: string;
  inventory?: Record<string, number>;
  patrol_state?: Record<string, any>;
  dead_until?: string | null;
```

- [ ] **Step 5: Add NpcQuestOffer interface** (after CivShip)

```ts
export interface NpcQuestOffer {
  npcId: number;
  npcName: string;
  dialogText: string;
  quest: AvailableQuest;
}
```

- [ ] **Step 6: Build shared**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 7: Run shared tests**

```bash
cd packages/shared && npx vitest run
```
Expected: all 310+ tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): extend types for NPC ships — role, NpcFactionId, QuestObjective, NpcQuestOffer"
```

---

### Task 3: Shared constants — NPC spawn counts, trade prices, combat stats

**Files:**
- Modify: `packages/shared/src/constants.ts` (after line ~2601)

- [ ] **Step 1: Add NPC constants**

```ts
// NPC Ship Roles
export const NPC_SPAWN_COUNTS = {
  inner: { military: 3, outlaw: 2, trader: 4 },   // max(abs(qx),abs(qy)) <= 3
  middle: { military: 6, outlaw: 6, trader: 4 },   // 4-7
  outer: { military: 12, outlaw: 2, trader: 4 },   // >= 8
} as const;

export function getNpcZone(qx: number, qy: number): 'inner' | 'middle' | 'outer' {
  const dist = Math.max(Math.abs(qx), Math.abs(qy));
  if (dist <= 3) return 'inner';
  if (dist <= 7) return 'middle';
  return 'outer';
}

export const NPC_MILITARY_LEVELS: Record<string, number> = { inner: 2, middle: 4, outer: 6 };
export const NPC_OUTLAW_LEVEL_RANGE: Record<string, [number, number]> = {
  inner: [1, 3], middle: [2, 5], outer: [3, 7],
};

export const NPC_TRADE_BASE_PRICES: Record<string, number> = { ore: 8, gas: 12, crystal: 20 };
export const NPC_TRADE_MAX_DISTANCE_BONUS = 0.5; // up to 50% more in deep space
export const NPC_TRADE_DISTANCE_DIVISOR = 500;
export const NPC_TRADE_CAPACITY = 100; // max per resource
export const NPC_OUTLAW_DISCOUNT = 0.8; // 20% cheaper (black market)
export const NPC_OUTLAW_ARTEFACT_CHANCE = 0.3;

export const NPC_OUTLAW_RESPAWN_MS = 2 * 60 * 60 * 1000; // 2 hours
export const NPC_OUTLAW_AMBUSH_CHANCE = 0.7;
export const NPC_OUTLAW_ROAM_RADIUS = 8;
export const NPC_MILITARY_PATROL_STEPS = 50;
export const NPC_TRADE_WAIT_TICKS = 5;
export const NPC_TRADE_MAX_RANGE = 1000; // Manhattan distance for station targeting

export const NPC_OUTLAW_COMBAT_REP_GAIN = 5; // outlaws rep on victory
```

- [ ] **Step 2: Build shared + run tests**

```bash
cd packages/shared && npm run build && npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat(shared): NPC spawn counts, trade prices, combat constants"
```

---

## Chunk 2: DB Queries & Name Generation

### Task 4: NPC DB queries

**Files:**
- Modify: `packages/server/src/db/civQueries.ts`

- [ ] **Step 1: Write tests for new queries**

Create `packages/server/src/__tests__/npcQueries.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/pool.js', () => ({ query: vi.fn() }));

describe('NPC ship queries', () => {
  let query: any;
  let civQueries: any;

  beforeEach(async () => {
    vi.resetModules();
    const pool = await import('../db/pool.js');
    query = vi.mocked(pool.query);
    civQueries = await import('../db/civQueries.js');
  });

  it('getNpcShipsInSector returns alive NPCs at coordinates', async () => {
    query.mockResolvedValue({ rows: [{ id: 1, role: 'trader', x: 5, y: 10, name: 'Test' }] });
    const result = await civQueries.getNpcShipsInSector(5, 10);
    expect(result).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('role'), [5, 10]);
  });

  it('spawnNpcShip inserts with all NPC fields', async () => {
    query.mockResolvedValue({ rows: [{ id: 99 }] });
    await civQueries.spawnNpcShip({
      faction: 'humans', ship_type: 'combat', role: 'military',
      x: 10, y: 20, home_x: 10, home_y: 20, level: 4, name: 'Patrol Echo-1',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('role'), expect.any(Array));
  });

  it('updateNpcShip updates position and patrol_state', async () => {
    query.mockResolvedValue({ rows: [] });
    await civQueries.updateNpcShip(1, { x: 11, y: 21, patrol_state: { leg: 'patrol' } });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('patrol_state'), expect.any(Array));
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/npcQueries.test.ts
```
Expected: FAIL (functions don't exist yet)

- [ ] **Step 3: Implement new query functions** in `civQueries.ts`

Add after `depositConquestPool` (line ~185):

```ts
export async function getNpcShipsInSector(x: number, y: number): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM civ_ships
     WHERE x = $1 AND y = $2 AND role IN ('trader', 'military', 'outlaw')
       AND (dead_until IS NULL OR dead_until < NOW())`,
    [x, y],
  );
  return rows;
}

export async function getNpcShipById(id: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT * FROM civ_ships WHERE id = $1 AND role IN ('trader', 'military', 'outlaw')`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getAliveNpcsByRole(
  qx: number, qy: number, quadrantSize: number, role: string,
): Promise<any[]> {
  const minX = qx * quadrantSize;
  const maxX = minX + quadrantSize - 1;
  const minY = qy * quadrantSize;
  const maxY = minY + quadrantSize - 1;
  const { rows } = await query(
    `SELECT * FROM civ_ships
     WHERE role = $1 AND x >= $2 AND x <= $3 AND y >= $4 AND y <= $5
       AND (dead_until IS NULL OR dead_until < NOW())`,
    [role, minX, maxX, minY, maxY],
  );
  return rows;
}

export async function getStationsInRange(x: number, y: number, maxDist: number): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM civ_stations
     WHERE ABS(sector_x - $1) + ABS(sector_y - $2) <= $3`,
    [x, y, maxDist],
  );
  return rows;
}

export async function updateNpcShip(
  id: number,
  fields: Partial<{
    x: number; y: number; state: string;
    target_x: number | null; target_y: number | null;
    inventory: Record<string, number>;
    patrol_state: Record<string, any>;
    dead_until: string | null;
    resources_carried: number;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = k === 'patrol_state' || k === 'inventory' ? k : k;
    sets.push(`${col} = $${i}`);
    vals.push(k === 'patrol_state' || k === 'inventory' ? JSON.stringify(v) : v);
    i++;
  }
  if (sets.length === 0) return;
  vals.push(id);
  await query(`UPDATE civ_ships SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function spawnNpcShip(data: {
  faction: string; ship_type: string; role: string;
  x: number; y: number; home_x: number; home_y: number;
  level?: number; name?: string; inventory?: Record<string, number>;
  patrol_state?: Record<string, any>;
}): Promise<number> {
  const { rows } = await query(
    `INSERT INTO civ_ships (faction, ship_type, state, x, y, home_x, home_y, role, level, name, inventory, patrol_state)
     VALUES ($1, $2, 'idle', $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [data.faction, data.ship_type, data.x, data.y, data.home_x, data.home_y,
     data.role, data.level ?? 1, data.name ?? '',
     JSON.stringify(data.inventory ?? {}), JSON.stringify(data.patrol_state ?? {})],
  );
  return rows[0].id;
}

export async function resetDeadOutlaws(): Promise<number> {
  const { rowCount } = await query(
    `UPDATE civ_ships SET dead_until = NULL WHERE role = 'outlaw' AND dead_until IS NOT NULL AND dead_until < NOW()`,
    [],
  );
  return rowCount ?? 0;
}

export async function getNpcPosition(npcId: number): Promise<{ x: number; y: number } | null> {
  const { rows } = await query('SELECT x, y FROM civ_ships WHERE id = $1', [npcId]);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd packages/server && npx vitest run src/__tests__/npcQueries.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/civQueries.ts packages/server/src/__tests__/npcQueries.test.ts
git commit -m "feat(db): NPC ship queries — spawn, update, sector lookup, range search"
```

---

### Task 5: NPC name generation

**Files:**
- Create: `packages/server/src/engine/npcNamegen.ts`
- Create: `packages/server/src/__tests__/npcNamegen.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { generateNpcName } from '../engine/npcNamegen.js';

describe('generateNpcName', () => {
  it('generates trader names with Händler prefix', () => {
    const name = generateNpcName('trader', 12345);
    expect(name).toMatch(/^Händler /);
    expect(name.length).toBeGreaterThan(8);
  });

  it('generates military names with Patrouille prefix', () => {
    const name = generateNpcName('military', 67890);
    expect(name).toMatch(/^Patrouille /);
  });

  it('generates outlaw names with Outlaw prefix', () => {
    const name = generateNpcName('outlaw', 11111);
    expect(name).toMatch(/^Outlaw /);
  });

  it('is deterministic for same seed', () => {
    expect(generateNpcName('trader', 999)).toBe(generateNpcName('trader', 999));
  });

  it('differs for different seeds', () => {
    expect(generateNpcName('trader', 1)).not.toBe(generateNpcName('trader', 2));
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd packages/server && npx vitest run src/__tests__/npcNamegen.test.ts
```

- [ ] **Step 3: Implement**

```ts
const PREFIXES: Record<string, string> = {
  trader: 'Händler',
  military: 'Patrouille',
  outlaw: 'Outlaw',
};

const SYLLABLES = ['Ax', 'Bor', 'Cel', 'Dax', 'Ek', 'Fen', 'Gol', 'Hex', 'Ion', 'Jet',
  'Kra', 'Lex', 'Mor', 'Nex', 'Orn', 'Pex', 'Qin', 'Rex', 'Sol', 'Tor',
  'Urk', 'Vex', 'Wor', 'Xan', 'Yel', 'Zor'];

function hashSeed(seed: number): number {
  let h = seed | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return h >>> 0;
}

export function generateNpcName(role: string, seed: number): string {
  const prefix = PREFIXES[role] ?? 'NPC';
  const h1 = hashSeed(seed);
  const h2 = hashSeed(seed + 7919);
  const syl = SYLLABLES[h1 % SYLLABLES.length] + SYLLABLES[h2 % SYLLABLES.length].toLowerCase();
  const num = (h1 % 9) + 1;
  return `${prefix} ${syl}-${num}`;
}
```

- [ ] **Step 4: Run — verify passes**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/npcNamegen.ts packages/server/src/__tests__/npcNamegen.test.ts
git commit -m "feat(engine): deterministic NPC name generator"
```

---

## Chunk 3: Movement AI

### Task 6: Pure AI state machines

**Files:**
- Create: `packages/server/src/engine/npcShipAI.ts`
- Create: `packages/server/src/__tests__/npcShipAI.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { nextTraderState, nextMilitaryState, nextOutlawState } from '../engine/npcShipAI.js';

describe('nextTraderState', () => {
  it('idle with target → traveling', () => {
    const ship = { state: 'idle', x: 10, y: 10, patrol_state: { targetX: 50, targetY: 50, waitTicks: 0 } } as any;
    const update = nextTraderState(ship);
    expect(update.state).toBe('traveling');
  });

  it('traveling → moves toward target', () => {
    const ship = { state: 'traveling', x: 10, y: 10, patrol_state: { targetX: 12, targetY: 10 } } as any;
    const update = nextTraderState(ship);
    expect(update.x).toBe(11);
  });

  it('arriving at target → idle with waitTicks', () => {
    const ship = { state: 'traveling', x: 50, y: 50, patrol_state: { targetX: 50, targetY: 50 } } as any;
    const update = nextTraderState(ship);
    expect(update.state).toBe('idle');
    expect(update.patrol_state?.waitTicks).toBe(5);
  });

  it('idle with waitTicks > 0 → decrements', () => {
    const ship = { state: 'idle', x: 50, y: 50, patrol_state: { waitTicks: 3 } } as any;
    const update = nextTraderState(ship);
    expect(update.patrol_state?.waitTicks).toBe(2);
    expect(update.state).toBeUndefined(); // stays idle
  });
});

describe('nextMilitaryState', () => {
  it('idle → traveling to border', () => {
    const ship = { state: 'idle', x: 100, y: 100, home_x: 100, home_y: 100,
      patrol_state: { leg: 'to_border', borderX: 0, borderY: 100, stepsLeft: 50, direction: 'h' } } as any;
    const update = nextMilitaryState(ship);
    expect(update.state).toBe('traveling');
  });

  it('patrol → moves along border and decrements steps', () => {
    const ship = { state: 'traveling', x: 0, y: 100,
      patrol_state: { leg: 'patrol', borderX: 0, borderY: 100, stepsLeft: 50, direction: 'h' } } as any;
    const update = nextMilitaryState(ship);
    expect(update.patrol_state?.stepsLeft).toBe(49);
  });
});

describe('nextOutlawState', () => {
  it('skips every other tick', () => {
    const ship = { state: 'idle', x: 5, y: 5,
      patrol_state: { anchorX: 5, anchorY: 5, roamRadius: 8, skipTick: 1 } } as any;
    const update = nextOutlawState(ship);
    expect(update.patrol_state?.skipTick).toBe(0);
    expect(update.x).toBeUndefined(); // no move on skip tick
  });

  it('moves on non-skip tick', () => {
    const ship = { state: 'idle', x: 5, y: 5,
      patrol_state: { anchorX: 5, anchorY: 5, roamRadius: 8, skipTick: 0, targetX: 6, targetY: 5 } } as any;
    const update = nextOutlawState(ship);
    expect(update.patrol_state?.skipTick).toBe(1);
    expect(update.x).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd packages/server && npx vitest run src/__tests__/npcShipAI.test.ts
```

- [ ] **Step 3: Implement `npcShipAI.ts`**

```ts
import { stepToward } from './civShipService.js';
import { NPC_TRADE_WAIT_TICKS, NPC_MILITARY_PATROL_STEPS, QUADRANT_SIZE } from '@void-sector/shared';

export function nextTraderState(ship: any): any {
  const ps = ship.patrol_state ?? {};

  if (ship.state === 'idle') {
    if (ps.waitTicks > 0) {
      return { patrol_state: { ...ps, waitTicks: ps.waitTicks - 1 } };
    }
    if (ps.targetX != null && ps.targetY != null) {
      return { state: 'traveling' };
    }
    return {}; // no target yet — spawner will assign one
  }

  if (ship.state === 'traveling') {
    if (ship.x === ps.targetX && ship.y === ps.targetY) {
      // Arrived — idle + refill inventory
      return {
        state: 'idle',
        patrol_state: { ...ps, waitTicks: NPC_TRADE_WAIT_TICKS, targetX: null, targetY: null },
        inventory: generateTraderInventory(ship.x),
      };
    }
    const { nx, ny } = stepToward(ship.x, ship.y, ps.targetX, ps.targetY);
    return { x: nx, y: ny };
  }

  return {};
}

export function nextMilitaryState(ship: any): any {
  const ps = ship.patrol_state ?? {};

  if (ship.state === 'idle') {
    if (!ps.borderX && !ps.borderY) return {}; // no patrol assigned yet
    return { state: 'traveling', patrol_state: { ...ps, leg: 'to_border' } };
  }

  if (ship.state === 'traveling') {
    const leg = ps.leg ?? 'to_border';

    if (leg === 'to_border') {
      if (ship.x === ps.borderX && ship.y === ps.borderY) {
        return { patrol_state: { ...ps, leg: 'patrol', stepsLeft: NPC_MILITARY_PATROL_STEPS } };
      }
      const { nx, ny } = stepToward(ship.x, ship.y, ps.borderX, ps.borderY);
      return { x: nx, y: ny };
    }

    if (leg === 'patrol') {
      if (ps.stepsLeft <= 0) {
        return { patrol_state: { ...ps, leg: 'return' } };
      }
      const dx = ps.direction === 'h' ? 1 : 0;
      const dy = ps.direction === 'v' ? 1 : 0;
      return {
        x: ship.x + dx,
        y: ship.y + dy,
        patrol_state: { ...ps, stepsLeft: ps.stepsLeft - 1 },
      };
    }

    if (leg === 'return') {
      if (ship.x === ship.home_x && ship.y === ship.home_y) {
        return { state: 'idle', patrol_state: { ...ps, leg: 'to_border' } };
      }
      const { nx, ny } = stepToward(ship.x, ship.y, ship.home_x, ship.home_y);
      return { x: nx, y: ny };
    }
  }

  return {};
}

export function nextOutlawState(ship: any): any {
  const ps = ship.patrol_state ?? {};
  const skip = ps.skipTick ?? 0;

  // Toggle skip
  if (skip === 1) {
    return { patrol_state: { ...ps, skipTick: 0 } };
  }

  // Move tick
  const newPs = { ...ps, skipTick: 1 };

  if (ps.targetX != null && ps.targetY != null) {
    if (ship.x === ps.targetX && ship.y === ps.targetY) {
      // Pick new roam target
      return { patrol_state: { ...newPs, targetX: null, targetY: null } };
    }
    const { nx, ny } = stepToward(ship.x, ship.y, ps.targetX, ps.targetY);
    return { x: nx, y: ny, patrol_state: newPs };
  }

  // Pick new random target within roam radius
  const radius = ps.roamRadius ?? 8;
  const anchorX = ps.anchorX ?? ship.home_x;
  const anchorY = ps.anchorY ?? ship.home_y;
  const seed = Date.now() ^ (ship.id * 31);
  const dx = (seed % (radius * 2 + 1)) - radius;
  const dy = ((seed >> 8) % (radius * 2 + 1)) - radius;
  return {
    patrol_state: { ...newPs, targetX: anchorX + dx, targetY: anchorY + dy },
  };
}

function generateTraderInventory(seed: number): Record<string, number> {
  const h = ((seed >> 16) ^ seed) * 0x45d9f3b >>> 0;
  return {
    ore: 20 + (h % 31),
    gas: 10 + ((h >> 5) % 21),
    crystal: 5 + ((h >> 10) % 11),
  };
}
```

Note: `stepToward` must be exported from `civShipService.ts` (it's currently a module-level function, may need `export` added).

- [ ] **Step 4: Export `stepToward` from `civShipService.ts`** (line 35)

Change `function stepToward` to `export function stepToward`.

- [ ] **Step 5: Run tests — verify passes**

```bash
cd packages/server && npx vitest run src/__tests__/npcShipAI.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/npcShipAI.ts packages/server/src/__tests__/npcShipAI.test.ts packages/server/src/engine/civShipService.ts
git commit -m "feat(engine): NPC ship AI — trader, military, outlaw state machines"
```

---

### Task 7: Integrate AI into processCivTick

**Files:**
- Modify: `packages/server/src/engine/civShipService.ts:55,133`

- [ ] **Step 1: Modify `nextShipState` dispatch** (line 55)

Add role-based dispatch before the existing state switch:
```ts
import { nextTraderState, nextMilitaryState, nextOutlawState } from './npcShipAI.js';

// At top of nextShipState:
if (ship.dead_until && new Date(ship.dead_until) > new Date()) return {};
const role = (ship as any).role ?? 'drone';
if (role === 'trader') return nextTraderState(ship);
if (role === 'military') return nextMilitaryState(ship);
if (role === 'outlaw') return nextOutlawState(ship);
// ... existing drone logic continues
```

- [ ] **Step 2: Filter dead outlaws in processCivTick** (line 133)

In `processCivTick()`, after loading ships, filter out dead ones from broadcast:
```ts
const aliveShips = updated.filter(s =>
  (s as any).role !== 'outlaw' || !(s as any).dead_until
);
```

- [ ] **Step 3: Run existing civ ship tests**

```bash
cd packages/server && npx vitest run src/__tests__/civShip
```
Expected: existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/engine/civShipService.ts
git commit -m "feat(engine): integrate NPC AI dispatch into processCivTick"
```

---

## Chunk 4: Spawning & Visibility

### Task 8: Spawn logic + strategic tick integration

**Files:**
- Create: `packages/server/src/engine/npcSpawner.ts`
- Modify: `packages/server/src/engine/strategicTickService.ts:45`
- Modify: `packages/server/src/rooms/SectorRoom.ts:271`

- [ ] **Step 1: Write test for spawn logic**

Create `packages/server/src/__tests__/npcSpawner.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { calculateSpawnNeeds } from '../engine/npcSpawner.js';

describe('calculateSpawnNeeds', () => {
  it('returns correct counts for inner quadrant', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs.military).toBe(3);
    expect(needs.outlaw).toBe(2);
    expect(needs.trader).toBe(4);
  });

  it('returns 0 when already at capacity', () => {
    const needs = calculateSpawnNeeds(0, 0, { trader: 4, military: 3, outlaw: 2 });
    expect(needs.military).toBe(0);
    expect(needs.outlaw).toBe(0);
    expect(needs.trader).toBe(0);
  });

  it('outer quadrant has 12 military', () => {
    const needs = calculateSpawnNeeds(10, 0, { trader: 0, military: 0, outlaw: 0 });
    expect(needs.military).toBe(12);
  });
});
```

- [ ] **Step 2: Implement `npcSpawner.ts`**

```ts
import { getNpcZone, NPC_SPAWN_COUNTS, NPC_MILITARY_LEVELS, NPC_OUTLAW_LEVEL_RANGE,
  NPC_OUTLAW_ROAM_RADIUS, QUADRANT_SIZE } from '@void-sector/shared';
import { generateNpcName } from './npcNamegen.js';
import * as civQueries from '../db/civQueries.js';

export function calculateSpawnNeeds(
  qx: number, qy: number,
  current: { trader: number; military: number; outlaw: number },
): { trader: number; military: number; outlaw: number } {
  const zone = getNpcZone(qx, qy);
  const target = NPC_SPAWN_COUNTS[zone];
  return {
    trader: Math.max(0, target.trader - current.trader),
    military: Math.max(0, target.military - current.military),
    outlaw: Math.max(0, target.outlaw - current.outlaw),
  };
}

export async function ensureQuadrantNpcs(qx: number, qy: number): Promise<void> {
  const [traders, military, outlaws] = await Promise.all([
    civQueries.getAliveNpcsByRole(qx, qy, QUADRANT_SIZE, 'trader'),
    civQueries.getAliveNpcsByRole(qx, qy, QUADRANT_SIZE, 'military'),
    civQueries.getAliveNpcsByRole(qx, qy, QUADRANT_SIZE, 'outlaw'),
  ]);

  const needs = calculateSpawnNeeds(qx, qy, {
    trader: traders.length, military: military.length, outlaw: outlaws.length,
  });

  const zone = getNpcZone(qx, qy);
  const baseX = qx * QUADRANT_SIZE;
  const baseY = qy * QUADRANT_SIZE;
  const half = Math.floor(QUADRANT_SIZE / 2);

  for (let i = 0; i < needs.trader; i++) {
    const seed = (qx * 1000 + qy) * 100 + i;
    const x = baseX + (seed % QUADRANT_SIZE);
    const y = baseY + ((seed >> 8) % QUADRANT_SIZE);
    await civQueries.spawnNpcShip({
      faction: 'humans', ship_type: 'combat', role: 'trader',
      x, y, home_x: x, home_y: y, level: 1,
      name: generateNpcName('trader', seed),
    });
  }

  const milLevel = NPC_MILITARY_LEVELS[zone];
  for (let i = 0; i < needs.military; i++) {
    const seed = (qx * 1000 + qy) * 200 + i;
    const x = baseX + half;
    const y = baseY + half;
    const borderX = baseX; // patrol to left edge
    const borderY = baseY + (seed % QUADRANT_SIZE);
    await civQueries.spawnNpcShip({
      faction: 'humans', ship_type: 'combat', role: 'military',
      x, y, home_x: x, home_y: y, level: milLevel,
      name: generateNpcName('military', seed),
      patrol_state: { leg: 'to_border', borderX, borderY, stepsLeft: 50, direction: 'h' },
    });
  }

  const [minLvl, maxLvl] = NPC_OUTLAW_LEVEL_RANGE[zone];
  for (let i = 0; i < needs.outlaw; i++) {
    const seed = (qx * 1000 + qy) * 300 + i;
    const x = baseX + (seed % QUADRANT_SIZE);
    const y = baseY + ((seed >> 4) % QUADRANT_SIZE);
    const level = minLvl + (seed % (maxLvl - minLvl + 1));
    await civQueries.spawnNpcShip({
      faction: 'humans', ship_type: 'combat', role: 'outlaw',
      x, y, home_x: x, home_y: y, level,
      name: generateNpcName('outlaw', seed),
      patrol_state: { anchorX: x, anchorY: y, roamRadius: NPC_OUTLAW_ROAM_RADIUS, skipTick: 0 },
    });
  }
}
```

- [ ] **Step 3: Add lazy spawn call to SectorRoom.onCreate** (line ~271)

After existing setup in `onCreate`, after service instantiation:
```ts
// Lazy spawn NPCs for this quadrant
ensureQuadrantNpcs(this.quadrantX, this.quadrantY).catch(err =>
  logger.error({ err }, 'Failed to ensure quadrant NPCs')
);
```

- [ ] **Step 4: Add respawn to strategicTickService.tick** (line ~93, before wreck spawns)

```ts
// NPC respawn
await civQueries.resetDeadOutlaws();
// Rebalance active quadrants (rooms with players)
// (ensureQuadrantNpcs is also called lazily on room join)
```

- [ ] **Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/npcSpawner.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/npcSpawner.ts packages/server/src/__tests__/npcSpawner.test.ts \
  packages/server/src/engine/strategicTickService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(engine): NPC spawning — lazy on room join + strategic tick respawn"
```

---

### Task 9: Per-client broadcast filtering for OUTLAWs

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts:1289-1293,1738`

- [ ] **Step 1: Add `revealedOutlaws` map to SectorRoom** (near line 181)

```ts
private revealedOutlaws = new Map<string, Set<number>>();
```

- [ ] **Step 2: Change civShipBus handler** (lines 1289-1293)

Replace:
```ts
this.broadcast('civ_ships_tick', event.ships);
```
With:
```ts
for (const client of this.clients) {
  const revealed = this.revealedOutlaws.get(client.sessionId) ?? new Set();
  const visible = event.ships.filter((s: any) =>
    s.role !== 'outlaw' || revealed.has(s.id)
  );
  if (visible.length > 0) client.send('civ_ships_tick', visible);
}
```

- [ ] **Step 3: Add `revealOutlaw` method**

```ts
revealOutlaw(sessionId: string, npcId: number): void {
  if (!this.revealedOutlaws.has(sessionId)) {
    this.revealedOutlaws.set(sessionId, new Set());
  }
  this.revealedOutlaws.get(sessionId)!.add(npcId);
}
```

- [ ] **Step 4: Cleanup in `onLeave`** (line ~1738)

```ts
this.revealedOutlaws.delete(client.sessionId);
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(room): per-client OUTLAW visibility filtering + revealedOutlaws map"
```

---

### Task 10: Radar rendering — new NPC icons

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts:709-751`

- [ ] **Step 1: Add new icon rendering branches** (after line ~746)

In the civ ship rendering block, add role-based dispatch before the existing `ship_type` switch:

```ts
const role = (ship as any).role;
if (role === 'trader') {
  // Green triangle ▶
  ctx.strokeStyle = '#00FF66';
  ctx.fillStyle = '#00FF66';
  ctx.beginPath();
  ctx.moveTo(px - r, py - r);
  ctx.lineTo(px + r, py);
  ctx.lineTo(px - r, py + r);
  ctx.closePath();
  ctx.fill();
} else if (role === 'military') {
  // Blue diamond ◇
  ctx.strokeStyle = '#4488FF';
  ctx.beginPath();
  ctx.moveTo(px, py - r);
  ctx.lineTo(px + r, py);
  ctx.lineTo(px, py + r);
  ctx.lineTo(px - r, py);
  ctx.closePath();
  ctx.stroke();
} else if (role === 'outlaw') {
  // Red cross ✕
  ctx.strokeStyle = '#FF3333';
  ctx.beginPath();
  ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
  ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
  ctx.stroke();
} else if (ship.ship_type === 'mining_drone') {
  // ... existing code
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): radar icons for NPC ships — trader/military/outlaw"
```

---

## Chunk 5: NpcShipService & Interaction

### Task 11: NpcShipService — trade, communicate, attack handlers

**Files:**
- Create: `packages/server/src/rooms/services/NpcShipService.ts`
- Modify: `packages/server/src/rooms/services/ServiceContext.ts:12-89`
- Modify: `packages/server/src/rooms/SectorRoom.ts` (message registration)

- [ ] **Step 1: Create NpcShipService**

```ts
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { logger } from '../../utils/logger.js';
import { rejectGuest } from './utils.js';
import * as civQueries from '../../db/civQueries.js';
import { getPlayerCredits, addCredits, deductCredits } from '../../db/queries.js';
import { getCargoState, addToInventory, removeFromInventory, getInventoryItem } from '../../engine/inventoryService.js';
import { NPC_TRADE_BASE_PRICES, NPC_TRADE_MAX_DISTANCE_BONUS, NPC_TRADE_DISTANCE_DIVISOR,
  NPC_TRADE_CAPACITY, NPC_OUTLAW_DISCOUNT, NPC_OUTLAW_RESPAWN_MS, NPC_OUTLAW_COMBAT_REP_GAIN,
} from '@void-sector/shared';

export class NpcShipService {
  constructor(private ctx: ServiceContext) {}

  private async validateNpc(client: Client, npcId: number): Promise<any | null> {
    const auth = client.auth as AuthPayload;
    const npc = await civQueries.getNpcShipById(npcId);
    if (!npc || npc.dead_until) {
      client.send('error', { code: 'NPC_FAIL', message: 'NPC nicht verfügbar' });
      return null;
    }
    const px = this.ctx._px(client.sessionId);
    const py = this.ctx._py(client.sessionId);
    if (npc.x !== px || npc.y !== py) {
      client.send('error', { code: 'NPC_FAIL', message: 'NPC nicht in diesem Sektor' });
      return null;
    }
    return npc;
  }

  async handleNpcShipTrade(
    client: Client,
    data: { npcId: number; resource: string; amount: number; action: 'buy' | 'sell' },
  ): Promise<void> {
    if (rejectGuest(client, 'NPC-Handel')) return;
    if (!this.ctx.checkRate(client.sessionId, 'npcTrade', 1000)) return;
    const auth = client.auth as AuthPayload;
    const npc = await this.validateNpc(client, data.npcId);
    if (!npc) return;
    if (npc.role !== 'trader' && npc.role !== 'outlaw') {
      client.send('error', { code: 'NPC_FAIL', message: 'Dieser NPC handelt nicht' });
      return;
    }

    const inv = npc.inventory ?? {};
    const basePrice = NPC_TRADE_BASE_PRICES[data.resource] ?? 10;
    const distBonus = Math.min(NPC_TRADE_MAX_DISTANCE_BONUS,
      (Math.abs(npc.x - npc.home_x) + Math.abs(npc.y - npc.home_y)) / NPC_TRADE_DISTANCE_DIVISOR);
    let price = Math.round(basePrice * (1 + distBonus));
    if (npc.role === 'outlaw') price = Math.round(price * NPC_OUTLAW_DISCOUNT);

    if (data.action === 'buy') {
      const available = inv[data.resource] ?? 0;
      const qty = Math.min(data.amount, available);
      if (qty <= 0) { client.send('error', { code: 'NPC_FAIL', message: 'Nicht vorrätig' }); return; }
      const totalCost = qty * price;
      const credits = await getPlayerCredits(auth.userId);
      if (credits < totalCost) { client.send('error', { code: 'NPC_FAIL', message: 'Nicht genug Credits' }); return; }
      await deductCredits(auth.userId, totalCost);
      await addToInventory(auth.userId, 'resource', data.resource, qty);
      inv[data.resource] = available - qty;
      await civQueries.updateNpcShip(npc.id, { inventory: inv });
      client.send('npcTradeResult', { success: true, resource: data.resource, amount: qty, credits: await getPlayerCredits(auth.userId) });
      client.send('cargoUpdate', await getCargoState(auth.userId));
    } else {
      const playerHas = await getInventoryItem(auth.userId, 'resource', data.resource);
      const qty = Math.min(data.amount, playerHas, NPC_TRADE_CAPACITY - (inv[data.resource] ?? 0));
      if (qty <= 0) { client.send('error', { code: 'NPC_FAIL', message: 'Nichts zu verkaufen' }); return; }
      const totalEarned = qty * Math.round(price * 0.8);
      await removeFromInventory(auth.userId, 'resource', data.resource, qty);
      await addCredits(auth.userId, totalEarned);
      inv[data.resource] = (inv[data.resource] ?? 0) + qty;
      await civQueries.updateNpcShip(npc.id, { inventory: inv });
      client.send('npcTradeResult', { success: true, resource: data.resource, amount: qty, credits: await getPlayerCredits(auth.userId) });
      client.send('cargoUpdate', await getCargoState(auth.userId));
    }
  }

  async handleCommunicateNpc(client: Client, data: { npcId: number }): Promise<void> {
    if (rejectGuest(client, 'NPC-Kommunikation')) return;
    if (!this.ctx.checkRate(client.sessionId, 'npcComm', 1000)) return;
    const auth = client.auth as AuthPayload;
    const npc = await this.validateNpc(client, data.npcId);
    if (!npc) return;

    // Check quest progress for NPC communication
    await this.ctx.checkQuestProgress(client, auth.userId, 'communicate_npc', { npcId: data.npcId });
    client.send('npcCommunicateResult', { success: true, npcName: npc.name, role: npc.role });
  }

  async handleAttackNpc(client: Client, data: { npcId: number }): Promise<void> {
    if (rejectGuest(client, 'NPC-Angriff')) return;
    if (!this.ctx.checkRate(client.sessionId, 'npcAttack', 1000)) return;
    const npc = await this.validateNpc(client, data.npcId);
    if (!npc) return;
    if (npc.role !== 'outlaw') {
      client.send('error', { code: 'NPC_FAIL', message: 'Kann nur Outlaws angreifen' });
      return;
    }
    // Delegate to combat service — will be wired in combat integration task
    client.send('npcCombatStart', { npcId: npc.id, npcName: npc.name, level: npc.level });
  }
}
```

- [ ] **Step 2: Add to ServiceContext interface** (line ~43)

Add `npcShips?: NpcShipService;` or add as a callback pattern. Since services reference each other through ctx, the simplest approach is to add it alongside the existing service references in SectorRoom.

- [ ] **Step 3: Register messages in SectorRoom**

```ts
this.onMessage('npcShipTrade', async (client, data) => {
  await this.npcShips.handleNpcShipTrade(client, data);
});
this.onMessage('communicateNpc', async (client, data) => {
  await this.npcShips.handleCommunicateNpc(client, data);
});
this.onMessage('attackNpc', async (client, data) => {
  await this.npcShips.handleAttackNpc(client, data);
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/NpcShipService.ts \
  packages/server/src/rooms/services/ServiceContext.ts \
  packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(service): NpcShipService — trade, communicate, attack handlers"
```

---

### Task 12: Client — sectorNpcs state + DetailPanel interaction block

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/DetailPanel.tsx`

- [ ] **Step 1: Add sectorNpcs to gameSlice**

State: `sectorNpcs: any[]` (initial: `[]`)
Setter: `setSectorNpcs: (npcs: any[]) => void`

- [ ] **Step 2: Add network handlers + senders in client.ts**

Handlers:
```ts
room.onMessage('npcsInSector', (data: any[]) => {
  useStore.getState().setSectorNpcs(data);
});
room.onMessage('npcTradeResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry(`NPC-Handel: ${data.amount}x ${data.resource}`);
    store.setCredits(data.credits);
  }
});
room.onMessage('npcCommunicateResult', (data: any) => {
  if (data.success) {
    useStore.getState().addLogEntry(`Kommunikation mit ${data.npcName}`);
  }
});
```

Senders:
```ts
sendNpcShipTrade(npcId: number, resource: string, amount: number, action: 'buy' | 'sell') {
  this.sectorRoom?.send('npcShipTrade', { npcId, resource, amount, action });
}
sendCommunicateNpc(npcId: number) {
  this.sectorRoom?.send('communicateNpc', { npcId });
}
sendAttackNpc(npcId: number) {
  this.sectorRoom?.send('attackNpc', { npcId });
}
```

- [ ] **Step 3: Add NPC interaction block to DetailPanel**

After the quest target section and before mining, add:
```tsx
{sectorNpcs.length > 0 && sectorNpcs.map((npc: any) => (
  <div key={npc.id} style={{ marginTop: 8, padding: '4px 6px', border: `1px solid ${npc.role === 'trader' ? '#00FF66' : npc.role === 'military' ? '#4488FF' : '#FF3333'}`, fontSize: '0.7rem' }}>
    <div style={{ color: npc.role === 'trader' ? '#00FF66' : npc.role === 'military' ? '#4488FF' : '#FF3333', marginBottom: 2 }}>
      {npc.role === 'trader' ? '▶' : npc.role === 'military' ? '◇' : '✕'} {npc.name}
      <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.6rem' }}>[{(npc.role ?? '').toUpperCase()}]</span>
    </div>
    {npc.role === 'trader' && npc.inventory && (
      <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginBottom: 4 }}>
        ORE: {npc.inventory.ore ?? 0} · GAS: {npc.inventory.gas ?? 0} · CRYSTAL: {npc.inventory.crystal ?? 0}
      </div>
    )}
    <div style={{ display: 'flex', gap: 4 }}>
      {(npc.role === 'trader') && (
        <button className="vs-btn" style={{ fontSize: '0.65rem' }}
          onClick={() => network.sendNpcShipTrade(npc.id, 'ore', 10, 'buy')}>
          [HANDELN]
        </button>
      )}
      <button className="vs-btn" style={{ fontSize: '0.65rem' }}
        onClick={() => network.sendCommunicateNpc(npc.id)}>
        [KOMMUNIZIEREN]
      </button>
      {npc.role === 'outlaw' && (
        <button className="vs-btn" style={{ fontSize: '0.65rem', borderColor: '#FF3333', color: '#FF3333' }}
          onClick={() => network.sendAttackNpc(npc.id)}>
          [ANGREIFEN]
        </button>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts \
  packages/client/src/components/DetailPanel.tsx
git commit -m "feat(client): NPC interaction — sectorNpcs state, DetailPanel block, network handlers"
```

---

### Task 13: NavigationService — send npcsInSector on sector enter

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts`

- [ ] **Step 1: After position update in moveSector/jump handlers, query and send NPCs**

Find the sector-enter code path (where `sectorData` is sent to client) and add:
```ts
const npcsHere = await civQueries.getNpcShipsInSector(targetX, targetY);
if (npcsHere.length > 0) {
  client.send('npcsInSector', npcsHere);
}
```

Also clear sectorNpcs when leaving a sector (send empty array or handle client-side).

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/rooms/services/NavigationService.ts
git commit -m "feat(nav): send npcsInSector on sector enter"
```

---

## Chunk 6: Scan Integration & Combat

### Task 14: ScanService — OUTLAW reveal on scan

**Files:**
- Modify: `packages/server/src/rooms/services/ScanService.ts:82-248`

- [ ] **Step 1: After local scan result, check for OUTLAWs in sector**

After existing scan logic in `handleLocalScan()`, add:
```ts
// Reveal OUTLAWs in current sector
const outlawsHere = await civQueries.getNpcShipsInSector(px, py);
const outlaws = outlawsHere.filter((s: any) => s.role === 'outlaw');
if (outlaws.length > 0) {
  for (const o of outlaws) {
    // Access SectorRoom's revealOutlaw via a new ctx callback
    this.ctx.revealOutlaw?.(client.sessionId, o.id);
  }
  client.send('npcsInSector', outlawsHere);
  client.send('logEntry', `WARNUNG: ${outlaws.length} OUTLAW(s) entdeckt!`);
}
```

- [ ] **Step 2: Add `revealOutlaw` to ServiceContext interface**

```ts
revealOutlaw?: (sessionId: string, npcId: number) => void;
```

Wire in SectorRoom.onCreate:
```ts
revealOutlaw: (sid, npcId) => this.revealOutlaw(sid, npcId),
```

- [ ] **Step 3: OUTLAW ambush check** (after outlaw reveal)

```ts
// OUTLAW ambush on HOSTILE reputation
if (outlaws.length > 0) {
  const rep = await getPlayerReputation(auth.userId, 'outlaws');
  if (getReputationTier(rep) === 'hostile') {
    const seed = Date.now() ^ auth.userId.charCodeAt(0);
    if ((seed % 100) < 70) { // 70% ambush chance
      const strongest = outlaws.reduce((a: any, b: any) => (b.level > a.level ? b : a));
      // Trigger combat with this outlaw
      client.send('outlawAmbush', { npcId: strongest.id, npcName: strongest.name, level: strongest.level });
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/ScanService.ts \
  packages/server/src/rooms/services/ServiceContext.ts \
  packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(scan): OUTLAW reveal on local scan + ambush trigger"
```

---

### Task 15: QuestService — communicate_npc action

**Files:**
- Modify: `packages/server/src/rooms/services/QuestService.ts`

- [ ] **Step 1: Add `communicate_npc` handling in `checkQuestProgress`**

After existing objective type checks, add:
```ts
if (
  (obj.type === 'find_npc' || obj.type === 'deliver_to_npc') &&
  action === 'communicate_npc' &&
  obj.targetNpcId === context.npcId
) {
  if (obj.type === 'deliver_to_npc' && obj.cargoItem) {
    const hasItem = await getInventoryItem(playerId, 'quest_item', obj.cargoItem);
    if (hasItem <= 0) continue; // don't fulfill without the item
    await removeFromInventory(playerId, 'quest_item', obj.cargoItem, 1);
  }
  obj.fulfilled = true;
  updated = true;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/rooms/services/QuestService.ts
git commit -m "feat(quest): communicate_npc action for find_npc and deliver_to_npc objectives"
```

---

### Task 16: HelpSlices for NPC encounters

**Files:**
- Modify: `packages/client/src/state/helpSlice.ts`

- [ ] **Step 1: Add 4 NPC HelpSlice entries**

```ts
{
  id: 'first_npc_trade',
  title: 'HANDELS-NPC ENTDECKT',
  body: 'Ein fliegender Händler! Diese NPCs reisen zwischen Stationen.\n\n'
    + '→ [HANDELN] öffnet den Ressourcen-Handel\n'
    + '→ Preise sind besser je weiter von Stationen entfernt\n'
    + '→ Der NPC hat begrenztes Inventar\n'
    + '→ [KOMMUNIZIEREN] für Quest-Übergaben',
},
{
  id: 'first_npc_military',
  title: 'MILITÄR-PATROUILLE',
  body: 'Eine Militär-Patrouille! Diese NPCs sichern die Quadrant-Grenzen.\n\n'
    + '→ [KOMMUNIZIEREN] für Informationen oder Quest-Übergaben\n'
    + '→ Militär-NPCs bieten keinen Handel an',
},
{
  id: 'first_npc_outlaw',
  title: 'OUTLAW ENTDECKT!',
  body: 'Ein Outlaw wurde durch deinen Scan aufgedeckt!\n\n'
    + '→ [ANGREIFEN] startet einen Kampf (Combat V2)\n'
    + '→ [HANDELN] nur mit NEUTRAL+ Reputation möglich (Schwarzmarkt, 20% Rabatt)\n'
    + '→ Bei HOSTILE Reputation greifen Outlaws dich automatisch an\n'
    + '→ Besiegte Outlaws respawnen nach 2 Stunden',
},
{
  id: 'first_npc_quest',
  title: 'NPC-QUEST',
  body: 'Dieser Quest führt zu einem NPC im Weltraum.\n\n'
    + '→ NPC-Position wird im Quest-Tracker angezeigt (Bookmark-Leiste)\n'
    + '→ Achtung: NPCs bewegen sich! Die Position aktualisiert sich\n'
    + '→ Im gleichen Sektor: [KOMMUNIZIEREN] zum Abschließen\n'
    + '→ Quest-Items werden automatisch übergeben',
  articleId: 'quests',
},
```

- [ ] **Step 2: Add triggers in client.ts**

In `npcsInSector` handler:
```ts
room.onMessage('npcsInSector', (data: any[]) => {
  const store = useStore.getState();
  store.setSectorNpcs(data);
  for (const npc of data) {
    if (npc.role === 'trader') store.showTip('first_npc_trade');
    else if (npc.role === 'military') store.showTip('first_npc_military');
    else if (npc.role === 'outlaw') store.showTip('first_npc_outlaw');
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/state/helpSlice.ts packages/client/src/network/client.ts
git commit -m "feat(help): NPC encounter HelpSlices — trade, military, outlaw, quest"
```

---

## Chunk 7: Quest Templates & Tracked Quest NPC Lookup

### Task 17: NPC quest templates

**Files:**
- Modify: `packages/server/src/engine/questTemplates.ts`

- [ ] **Step 1: Add 5 NPC quest templates**

```ts
{
  id: 'traders_courier',
  type: 'delivery',
  factionId: 'traders',
  title: 'Kurierdienst',
  descriptionTemplate: 'Überbringt eine Nachricht an {targetNpcName} in der Nähe von ({targetX}, {targetY}).',
  requiredTier: 'neutral',
  rewardCreditsBase: 80,
  rewardXpBase: 25,
  rewardRepBase: 5,
  rewardWissenBase: 3,
  npcRole: 'trader',
  cargoItem: 'news',
},
{
  id: 'traders_escort_info',
  type: 'delivery',
  factionId: 'traders',
  title: 'Handelsinformationen',
  descriptionTemplate: 'Sprich mit {targetNpcName} und bringe die Marktdaten zurück zur Station.',
  requiredTier: 'neutral',
  rewardCreditsBase: 60,
  rewardXpBase: 20,
  rewardRepBase: 3,
  npcRole: 'trader',
},
{
  id: 'scientists_npc_data',
  type: 'delivery',
  factionId: 'scientists',
  title: 'Forschungsdaten',
  descriptionTemplate: 'Sammle Scan-Daten von Patrouille {targetNpcName} und bringe sie zurück.',
  requiredTier: 'neutral',
  rewardCreditsBase: 70,
  rewardXpBase: 30,
  rewardRepBase: 4,
  rewardWissenBase: 5,
  npcRole: 'military',
},
{
  id: 'outlaws_contact',
  type: 'delivery',
  factionId: 'outlaws',
  title: 'Schwarzmarkt-Lieferung',
  descriptionTemplate: 'Liefere ein Paket an {targetNpcName}. Diskretion erwünscht.',
  requiredTier: 'neutral',
  rewardCreditsBase: 120,
  rewardXpBase: 30,
  rewardRepBase: 8,
  npcRole: 'outlaw',
  cargoItem: 'package',
},
{
  id: 'outlaws_bounty_npc',
  type: 'bounty_chase',
  factionId: 'outlaws',
  title: 'Kopfgeld: Outlaw-Jäger',
  descriptionTemplate: 'Spüre {targetNpcName} auf und bringe ihn zur Rechenschaft.',
  requiredTier: 'friendly',
  rewardCreditsBase: 200,
  rewardXpBase: 50,
  rewardRepBase: 10,
  rewardWissenBase: 8,
  npcRole: 'outlaw',
},
```

Note: The `npcRole` field is new on QuestTemplate and used by questgen to select a target NPC.

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/engine/questTemplates.ts
git commit -m "feat(quest): 5 NPC quest templates — courier, info, data, contact, bounty"
```

---

### Task 18: getTrackedQuests — NPC position lookup

**Files:**
- Modify: `packages/server/src/db/queries.ts` (`getTrackedQuests` function, line ~1230)

- [ ] **Step 1: Extend getTrackedQuests for NPC targets**

After existing `trailTargetX/Y` extraction, add:
```ts
// NPC target: look up current position
let npcTargetX: number | undefined;
let npcTargetY: number | undefined;
if (currentObj?.targetNpcId) {
  const npcPos = await civQueries.getNpcPosition(currentObj.targetNpcId);
  if (npcPos) {
    npcTargetX = npcPos.x;
    npcTargetY = npcPos.y;
  }
}
```

And in the return statement, add `npcTargetX`/`npcTargetY` to the fallback chain:
```ts
targetX: firstTarget?.targetX ?? trailTargetX ?? npcTargetX ?? currentObj?.stationX,
targetY: firstTarget?.targetY ?? trailTargetY ?? npcTargetY ?? currentObj?.stationY,
```

- [ ] **Step 2: Add import**

```ts
import * as civQueries from './civQueries.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(quest): getTrackedQuests resolves NPC position for moving targets"
```

---

### Task 19: Final integration test + shared build

- [ ] **Step 1: Build shared**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 2: Run all server tests**

```bash
cd packages/server && npx vitest run
```
Expected: all existing tests + new NPC tests pass (pre-existing failures excluded).

- [ ] **Step 3: Run shared tests**

```bash
cd packages/shared && npx vitest run
```

- [ ] **Step 4: Final commit + push**

```bash
git push origin master
```
