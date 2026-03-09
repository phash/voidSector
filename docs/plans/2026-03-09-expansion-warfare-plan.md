# Galactic Expansion & Warfare — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement bilateral faction expansion (human wave + alien spheres), dynamic borders driven by `humanityRepTier`-derived friction, quadrant-level Attack/Defense warfare, and visible NPC fleets on the QUAD-MAP.

**Architecture:** A `StrategicTickService` runs every 60s inside the existing `UniverseTickEngine` (Phase LU #179). Quadrant state (`quadrant_control`) stores Attack/Defense/Friction per quadrant. `FrictionEngine` maps `humanityRepTier` → friction score with per-faction aggression modifiers. `ExpansionEngine` handles border contact detection and peaceful-halt vs. war branching. NPC fleet positions live in Redis and are broadcast to clients for QUAD-MAP visualization.

**Tech Stack:** TypeScript ESM, PostgreSQL (queries.ts pattern), Redis, Colyseus, Vitest, React + Zustand

**Depends on:** Phase LU complete (UniverseTickEngine #179 must exist), migrations 028–042 done

---

## Task 1: DB Migration 043 — Expansion & Warfare Tables

**Files:**
- Create: `packages/server/src/db/migrations/043_expansion_warfare.ts`
- Modify: `packages/server/src/db/queries.ts` (append ~80 lines)

**Step 1: Write the migration file**

```typescript
// packages/server/src/db/migrations/043_expansion_warfare.ts
import type { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quadrant_control (
      qx INTEGER NOT NULL,
      qy INTEGER NOT NULL,
      controlling_faction TEXT NOT NULL DEFAULT 'human',
      faction_shares JSONB NOT NULL DEFAULT '{"human": 100}',
      attack_value INTEGER NOT NULL DEFAULT 0,
      defense_value INTEGER NOT NULL DEFAULT 0,
      friction_score INTEGER NOT NULL DEFAULT 0,
      station_tier INTEGER NOT NULL DEFAULT 0,
      last_strategic_tick TIMESTAMPTZ,
      PRIMARY KEY (qx, qy)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS npc_fleet (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      faction TEXT NOT NULL,
      fleet_type TEXT NOT NULL,
      from_qx INTEGER NOT NULL,
      from_qy INTEGER NOT NULL,
      to_qx INTEGER NOT NULL,
      to_qy INTEGER NOT NULL,
      strength INTEGER NOT NULL DEFAULT 100,
      eta TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_npc_fleet_eta ON npc_fleet (eta)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS faction_config (
      faction_id TEXT PRIMARY KEY,
      home_qx INTEGER NOT NULL DEFAULT 0,
      home_qy INTEGER NOT NULL DEFAULT 0,
      expansion_rate INTEGER NOT NULL DEFAULT 10,
      aggression FLOAT NOT NULL DEFAULT 1.0,
      expansion_style TEXT NOT NULL DEFAULT 'sphere',
      active BOOLEAN NOT NULL DEFAULT true
    )
  `);

  // Seed initial faction configs
  await pool.query(`
    INSERT INTO faction_config (faction_id, home_qx, home_qy, expansion_rate, aggression, expansion_style)
    VALUES
      ('human',         0,    0,   8,   1.0,  'wave'),
      ('kthari',        20,  -15,  5,   2.0,  'sphere'),
      ('silent_swarm',  -30,  20,  4,   2.5,  'sphere'),
      ('archivare',     15,   10,  15,  0.3,  'sphere'),
      ('konsortium',    -10, -20,  10,  0.4,  'sphere'),
      ('mycelianer',    25,   5,   12,  0.5,  'sphere'),
      ('mirror_minds',  -20,  15,  10,  1.0,  'sphere'),
      ('touristengilde',-5,  -25,  20,  0.1,  'sphere')
    ON CONFLICT (faction_id) DO NOTHING
  `);
}
```

**Step 2: Add queries to queries.ts**

Append these functions at the end of `packages/server/src/db/queries.ts`:

```typescript
// ─── Quadrant Control ───────────────────────────────────────────────────────

export async function getQuadrantControl(pool: Pool, qx: number, qy: number) {
  const res = await pool.query(
    'SELECT * FROM quadrant_control WHERE qx = $1 AND qy = $2',
    [qx, qy]
  );
  return res.rows[0] ?? null;
}

export async function upsertQuadrantControl(pool: Pool, data: {
  qx: number; qy: number; controlling_faction: string;
  faction_shares: Record<string, number>; attack_value: number;
  defense_value: number; friction_score: number; station_tier: number;
}) {
  await pool.query(`
    INSERT INTO quadrant_control
      (qx, qy, controlling_faction, faction_shares, attack_value, defense_value, friction_score, station_tier, last_strategic_tick)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (qx,qy) DO UPDATE SET
      controlling_faction = EXCLUDED.controlling_faction,
      faction_shares = EXCLUDED.faction_shares,
      attack_value = EXCLUDED.attack_value,
      defense_value = EXCLUDED.defense_value,
      friction_score = EXCLUDED.friction_score,
      station_tier = EXCLUDED.station_tier,
      last_strategic_tick = NOW()
  `, [data.qx, data.qy, data.controlling_faction,
      JSON.stringify(data.faction_shares),
      data.attack_value, data.defense_value,
      data.friction_score, data.station_tier]);
}

export async function getActiveQuadrantControls(pool: Pool) {
  const res = await pool.query('SELECT * FROM quadrant_control');
  return res.rows;
}

export async function getBorderQuadrants(pool: Pool, faction: string) {
  // Returns quadrants controlled by faction that neighbor a different faction's quadrant
  const res = await pool.query(`
    SELECT DISTINCT qc.*
    FROM quadrant_control qc
    WHERE qc.controlling_faction = $1
      AND EXISTS (
        SELECT 1 FROM quadrant_control neighbor
        WHERE neighbor.controlling_faction != $1
          AND ABS(neighbor.qx - qc.qx) <= 1
          AND ABS(neighbor.qy - qc.qy) <= 1
      )
  `, [faction]);
  return res.rows;
}

// ─── NPC Fleets ─────────────────────────────────────────────────────────────

export async function createNpcFleet(pool: Pool, data: {
  faction: string; fleet_type: string;
  from_qx: number; from_qy: number;
  to_qx: number; to_qy: number;
  strength: number; eta: Date;
}) {
  const res = await pool.query(`
    INSERT INTO npc_fleet (faction, fleet_type, from_qx, from_qy, to_qx, to_qy, strength, eta)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
  `, [data.faction, data.fleet_type, data.from_qx, data.from_qy,
      data.to_qx, data.to_qy, data.strength, data.eta]);
  return res.rows[0].id as string;
}

export async function getActiveNpcFleets(pool: Pool) {
  const res = await pool.query(
    'SELECT * FROM npc_fleet WHERE eta > NOW() ORDER BY eta'
  );
  return res.rows;
}

export async function deleteArrivedNpcFleets(pool: Pool) {
  await pool.query('DELETE FROM npc_fleet WHERE eta <= NOW()');
}

// ─── Faction Config ──────────────────────────────────────────────────────────

export async function getAllFactionConfigs(pool: Pool) {
  const res = await pool.query(
    'SELECT * FROM faction_config WHERE active = true'
  );
  return res.rows;
}

export async function getFactionConfig(pool: Pool, factionId: string) {
  const res = await pool.query(
    'SELECT * FROM faction_config WHERE faction_id = $1',
    [factionId]
  );
  return res.rows[0] ?? null;
}
```

**Step 3: Verify migration auto-runs**

Check `packages/server/src/db/migrations/index.ts` — confirm it auto-discovers and runs all `.ts` files. No manual registration needed.

**Step 4: Run server and check tables exist**

```bash
npm run docker:up
npm run dev:server
# Check logs for "Migration 043 applied"
```

**Step 5: Commit**

```bash
git add packages/server/src/db/migrations/043_expansion_warfare.ts \
        packages/server/src/db/queries.ts
git commit -m "feat: migration 043 — quadrant_control, npc_fleet, faction_config tables"
```

---

## Task 2: FrictionEngine — Rep-Tier to Friction Score

**Files:**
- Create: `packages/server/src/engine/frictionEngine.ts`
- Create: `packages/server/src/__tests__/frictionEngine.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/frictionEngine.test.ts
import { describe, it, expect } from 'vitest';
import { calculateFriction, FrictionResult } from '../engine/frictionEngine.js';

describe('calculateFriction', () => {
  it('returns 0 for ALLY rep with neutral aggression', () => {
    const result = calculateFriction('ally', 1.0);
    expect(result.score).toBe(0);
    expect(result.state).toBe('peaceful_halt');
  });

  it('returns 0 for FRIENDLY rep', () => {
    const result = calculateFriction('friendly', 1.0);
    expect(result.score).toBe(10);
    expect(result.state).toBe('peaceful_halt');
  });

  it('returns 35 for NEUTRAL rep with neutral aggression', () => {
    const result = calculateFriction('neutral', 1.0);
    expect(result.score).toBe(35);
    expect(result.state).toBe('skirmish');
  });

  it('returns 65 for HOSTILE rep with neutral aggression', () => {
    const result = calculateFriction('hostile', 1.0);
    expect(result.score).toBe(65);
    expect(result.state).toBe('escalation');
  });

  it('returns 90 for ENEMY rep with neutral aggression', () => {
    const result = calculateFriction('enemy', 1.0);
    expect(result.score).toBe(90);
    expect(result.state).toBe('total_war');
  });

  it('increases friction with high aggression multiplier (K\'thari)', () => {
    const neutral = calculateFriction('neutral', 2.0);
    expect(neutral.score).toBeGreaterThan(50); // pushes neutral into escalation
    expect(neutral.state).toBe('escalation');
  });

  it('decreases friction with low aggression multiplier (Konsortium)', () => {
    const hostile = calculateFriction('hostile', 0.4);
    expect(hostile.score).toBeLessThan(50);
    expect(hostile.state).toBe('skirmish');
  });

  it('clamps score to 0–100 range', () => {
    const ally = calculateFriction('ally', 3.0);
    expect(ally.score).toBeGreaterThanOrEqual(0);
    const enemy = calculateFriction('enemy', 3.0);
    expect(enemy.score).toBeLessThanOrEqual(100);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/__tests__/frictionEngine.test.ts
# Expected: FAIL — cannot find module '../engine/frictionEngine.js'
```

**Step 3: Implement FrictionEngine**

```typescript
// packages/server/src/engine/frictionEngine.ts

export type RepTier = 'ally' | 'friendly' | 'neutral' | 'hostile' | 'enemy';
export type FrictionState = 'peaceful_halt' | 'skirmish' | 'escalation' | 'total_war';

export interface FrictionResult {
  score: number;       // 0–100
  state: FrictionState;
}

// Base friction scores per rep tier (before aggression modifier)
const BASE_FRICTION: Record<RepTier, number> = {
  ally:     0,
  friendly: 10,
  neutral:  35,
  hostile:  65,
  enemy:    90,
};

export function calculateFriction(repTier: RepTier, aggression: number): FrictionResult {
  const base = BASE_FRICTION[repTier];
  // Aggression shifts the score: >1 = more hostile, <1 = less hostile
  // Apply a delta based on how far aggression deviates from 1.0
  const delta = (aggression - 1.0) * 20;
  const score = Math.max(0, Math.min(100, Math.round(base + delta)));

  let state: FrictionState;
  if (score <= 20)      state = 'peaceful_halt';
  else if (score <= 50) state = 'skirmish';
  else if (score <= 80) state = 'escalation';
  else                  state = 'total_war';

  return { score, state };
}

// Maps a numeric reputation value (-100..+100) to a RepTier
export function repValueToTier(rep: number): RepTier {
  if (rep >= 75)  return 'ally';
  if (rep >= 25)  return 'friendly';
  if (rep >= -25) return 'neutral';
  if (rep >= -75) return 'hostile';
  return 'enemy';
}
```

**Step 4: Run tests — confirm pass**

```bash
cd packages/server && npx vitest run src/__tests__/frictionEngine.test.ts
# Expected: PASS (8 tests)
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/frictionEngine.ts \
        packages/server/src/__tests__/frictionEngine.test.ts
git commit -m "feat: frictionEngine — humanityRepTier to friction score with aggression modifier"
```

---

## Task 3: FactionConfigService — Faction Personality Data

**Files:**
- Create: `packages/server/src/engine/factionConfigService.ts`
- Create: `packages/server/src/__tests__/factionConfigService.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/factionConfigService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FactionConfigService } from '../engine/factionConfigService.js';

const mockPool = {
  query: vi.fn(),
} as any;

describe('FactionConfigService', () => {
  let service: FactionConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FactionConfigService(mockPool);
  });

  it('loads faction configs on init', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { faction_id: 'kthari', home_qx: 20, home_qy: -15, expansion_rate: 5, aggression: 2.0, expansion_style: 'sphere', active: true },
        { faction_id: 'konsortium', home_qx: -10, home_qy: -20, expansion_rate: 10, aggression: 0.4, expansion_style: 'sphere', active: true },
      ]
    });
    await service.init();
    expect(service.getConfig('kthari')?.aggression).toBe(2.0);
    expect(service.getConfig('konsortium')?.aggression).toBe(0.4);
  });

  it('returns null for unknown faction', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await service.init();
    expect(service.getConfig('unknown_faction')).toBeNull();
  });

  it('getActiveFactions returns all loaded factions', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { faction_id: 'kthari', home_qx: 20, home_qy: -15, expansion_rate: 5, aggression: 2.0, expansion_style: 'sphere', active: true },
      ]
    });
    await service.init();
    expect(service.getActiveFactions()).toHaveLength(1);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/__tests__/factionConfigService.test.ts
# Expected: FAIL
```

**Step 3: Implement FactionConfigService**

```typescript
// packages/server/src/engine/factionConfigService.ts
import type { Pool } from 'pg';
import { getAllFactionConfigs } from '../db/queries.js';

export interface FactionConfig {
  faction_id: string;
  home_qx: number;
  home_qy: number;
  expansion_rate: number;  // ticks between expansion attempts
  aggression: number;      // friction multiplier
  expansion_style: 'sphere' | 'wave' | 'jumpgate';
  active: boolean;
}

export class FactionConfigService {
  private configs = new Map<string, FactionConfig>();

  constructor(private pool: Pool) {}

  async init(): Promise<void> {
    const rows = await getAllFactionConfigs(this.pool);
    this.configs.clear();
    for (const row of rows) {
      this.configs.set(row.faction_id, row as FactionConfig);
    }
  }

  getConfig(factionId: string): FactionConfig | null {
    return this.configs.get(factionId) ?? null;
  }

  getActiveFactions(): FactionConfig[] {
    return Array.from(this.configs.values());
  }

  // Distance from faction home to a quadrant coordinate
  distanceTo(factionId: string, qx: number, qy: number): number {
    const config = this.getConfig(factionId);
    if (!config) return Infinity;
    return Math.sqrt((config.home_qx - qx) ** 2 + (config.home_qy - qy) ** 2);
  }
}
```

**Step 4: Run tests — confirm pass**

```bash
cd packages/server && npx vitest run src/__tests__/factionConfigService.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/factionConfigService.ts \
        packages/server/src/__tests__/factionConfigService.test.ts
git commit -m "feat: FactionConfigService — faction personality + expansion config with DB loading"
```

---

## Task 4: ExpansionEngine — Border Contact Detection

**Files:**
- Create: `packages/server/src/engine/expansionEngine.ts`
- Create: `packages/server/src/__tests__/expansionEngine.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/expansionEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  checkBorderContact,
  getExpansionTarget,
  BorderContactResult,
} from '../engine/expansionEngine.js';

// Minimal quadrant map for tests
const mockControls = [
  { qx: 0, qy: 0, controlling_faction: 'human', faction_shares: { human: 100 }, station_tier: 4 },
  { qx: 1, qy: 0, controlling_faction: 'human', faction_shares: { human: 100 }, station_tier: 2 },
  { qx: 2, qy: 0, controlling_faction: 'kthari', faction_shares: { kthari: 100 }, station_tier: 3 },
];

describe('checkBorderContact', () => {
  it('detects contact when human and alien quadrant are neighbors', () => {
    const result = checkBorderContact(
      { qx: 1, qy: 0, controlling_faction: 'human' } as any,
      { qx: 2, qy: 0, controlling_faction: 'kthari' } as any
    );
    expect(result.hasContact).toBe(true);
    expect(result.factions).toContain('human');
    expect(result.factions).toContain('kthari');
  });

  it('no contact for same faction quadrants', () => {
    const result = checkBorderContact(
      { qx: 0, qy: 0, controlling_faction: 'human' } as any,
      { qx: 1, qy: 0, controlling_faction: 'human' } as any
    );
    expect(result.hasContact).toBe(false);
  });
});

describe('getExpansionTarget', () => {
  it('returns nearest unclaimed neighbor for human wave expansion', () => {
    const allControls = [
      { qx: 0, qy: 0, controlling_faction: 'human' },
      { qx: 1, qy: 0, controlling_faction: 'human' },
    ];
    const target = getExpansionTarget('human', allControls as any, 'wave');
    // Should pick an adjacent unclaimed quadrant
    expect(target).not.toBeNull();
  });

  it('returns null when fully surrounded by claimed quadrants', () => {
    // All neighbors are claimed
    const allControls = [
      { qx: 0, qy: 0, controlling_faction: 'human' },
      { qx: 1, qy: 0, controlling_faction: 'kthari' },
      { qx: -1, qy: 0, controlling_faction: 'kthari' },
      { qx: 0, qy: 1, controlling_faction: 'kthari' },
      { qx: 0, qy: -1, controlling_faction: 'kthari' },
      { qx: 1, qy: 1, controlling_faction: 'kthari' },
      { qx: -1, qy: 1, controlling_faction: 'kthari' },
      { qx: 1, qy: -1, controlling_faction: 'kthari' },
      { qx: -1, qy: -1, controlling_faction: 'kthari' },
    ];
    const target = getExpansionTarget('human', allControls as any, 'wave');
    expect(target).toBeNull();
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/__tests__/expansionEngine.test.ts
# Expected: FAIL
```

**Step 3: Implement ExpansionEngine**

```typescript
// packages/server/src/engine/expansionEngine.ts

export interface QuadrantControlRow {
  qx: number;
  qy: number;
  controlling_faction: string;
  faction_shares: Record<string, number>;
  station_tier: number;
  attack_value?: number;
  defense_value?: number;
  friction_score?: number;
}

export interface BorderContactResult {
  hasContact: boolean;
  factions: string[];
}

export function checkBorderContact(
  a: QuadrantControlRow,
  b: QuadrantControlRow
): BorderContactResult {
  if (a.controlling_faction === b.controlling_faction) {
    return { hasContact: false, factions: [] };
  }
  const isNeighbor = Math.abs(a.qx - b.qx) <= 1 && Math.abs(a.qy - b.qy) <= 1;
  if (!isNeighbor) {
    return { hasContact: false, factions: [] };
  }
  return {
    hasContact: true,
    factions: [a.controlling_faction, b.controlling_faction],
  };
}

// Returns coordinates of the best unclaimed expansion target
export function getExpansionTarget(
  faction: string,
  allControls: QuadrantControlRow[],
  style: 'sphere' | 'wave' | 'jumpgate'
): { qx: number; qy: number } | null {
  const claimedSet = new Set(allControls.map(q => `${q.qx},${q.qy}`));
  const ownedQuadrants = allControls.filter(q => q.controlling_faction === faction);

  const candidates = new Set<string>();
  for (const own of ownedQuadrants) {
    // Check all 8 neighbors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const key = `${own.qx + dx},${own.qy + dy}`;
        if (!claimedSet.has(key)) {
          candidates.add(key);
        }
      }
    }
  }

  if (candidates.size === 0) return null;

  // Pick first candidate (could be refined with distance heuristic)
  const [first] = candidates;
  const [qx, qy] = first.split(',').map(Number);
  return { qx, qy };
}

// Find all border pairs (quadrants of different factions that are neighbors)
export function findAllBorderPairs(
  allControls: QuadrantControlRow[]
): Array<{ a: QuadrantControlRow; b: QuadrantControlRow }> {
  const pairs: Array<{ a: QuadrantControlRow; b: QuadrantControlRow }> = [];
  for (let i = 0; i < allControls.length; i++) {
    for (let j = i + 1; j < allControls.length; j++) {
      const result = checkBorderContact(allControls[i], allControls[j]);
      if (result.hasContact) {
        pairs.push({ a: allControls[i], b: allControls[j] });
      }
    }
  }
  return pairs;
}
```

**Step 4: Run tests — confirm pass**

```bash
cd packages/server && npx vitest run src/__tests__/expansionEngine.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/expansionEngine.ts \
        packages/server/src/__tests__/expansionEngine.test.ts
git commit -m "feat: expansionEngine — border contact detection and expansion target selection"
```

---

## Task 5: WarfareEngine — Attack/Defense Resolution

**Files:**
- Create: `packages/server/src/engine/warfareEngine.ts`
- Create: `packages/server/src/__tests__/warfareEngine.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/warfareEngine.test.ts
import { describe, it, expect } from 'vitest';
import { resolveStrategicTick, WarfareResult } from '../engine/warfareEngine.js';

describe('resolveStrategicTick', () => {
  it('attacker wins when attack > defense * 1.2', () => {
    const result = resolveStrategicTick({ attack: 1300, defense: 1000 });
    expect(result.outcome).toBe('attacker_wins');
    expect(result.newDefense).toBe(900); // 10% reduction
    expect(result.newAttack).toBe(1300);
  });

  it('defender wins when defense > attack * 1.2', () => {
    const result = resolveStrategicTick({ attack: 800, defense: 1000 });
    expect(result.outcome).toBe('defender_wins');
    expect(result.newAttack).toBe(720); // 10% reduction
    expect(result.newDefense).toBe(1000);
  });

  it('stalemate when neither side has 1.2x advantage', () => {
    const result = resolveStrategicTick({ attack: 1000, defense: 1000 });
    expect(result.outcome).toBe('stalemate');
    expect(result.newAttack).toBe(950);   // 5% reduction
    expect(result.newDefense).toBe(950);  // 5% reduction
  });

  it('signals conquest when defense drops to 0', () => {
    const result = resolveStrategicTick({ attack: 5000, defense: 50 });
    expect(result.outcome).toBe('attacker_wins');
    expect(result.conquest).toBe(true);
    expect(result.newDefense).toBe(0);
  });

  it('signals invasion_repelled when attack drops to 0', () => {
    const result = resolveStrategicTick({ attack: 50, defense: 5000 });
    expect(result.outcome).toBe('defender_wins');
    expect(result.invasionRepelled).toBe(true);
    expect(result.newAttack).toBe(0);
  });

  it('player quest bonus modifies attack', () => {
    const result = resolveStrategicTick({ attack: 800, defense: 1000, playerAttackBonus: 300 });
    // effective attack = 1100 vs defense = 1000 → still stalemate (1100 < 1200)
    expect(result.outcome).toBe('stalemate');
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/__tests__/warfareEngine.test.ts
# Expected: FAIL
```

**Step 3: Implement WarfareEngine**

```typescript
// packages/server/src/engine/warfareEngine.ts

export interface WarfareTickInput {
  attack: number;
  defense: number;
  playerAttackBonus?: number;    // from Logistik/Sabotage quests
  playerDefenseBonus?: number;
  attackMultiplier?: number;     // from Scanning quests
}

export interface WarfareResult {
  outcome: 'attacker_wins' | 'defender_wins' | 'stalemate';
  newAttack: number;
  newDefense: number;
  conquest: boolean;         // defender reached 0 → quadrant changes owner
  invasionRepelled: boolean; // attacker reached 0 → invasion ends
}

const ADVANTAGE_THRESHOLD = 1.2;
const LOSS_ON_WIN = 0.10;
const LOSS_ON_STALEMATE = 0.05;

export function resolveStrategicTick(input: WarfareTickInput): WarfareResult {
  const effectiveAttack = Math.round(
    (input.attack + (input.playerAttackBonus ?? 0)) *
    (input.attackMultiplier ?? 1.0)
  );
  const effectiveDefense = input.defense + (input.playerDefenseBonus ?? 0);

  let newAttack = input.attack;
  let newDefense = input.defense;
  let outcome: WarfareResult['outcome'];

  if (effectiveAttack > effectiveDefense * ADVANTAGE_THRESHOLD) {
    outcome = 'attacker_wins';
    newDefense = Math.max(0, Math.round(input.defense * (1 - LOSS_ON_WIN)));
  } else if (effectiveDefense > effectiveAttack * ADVANTAGE_THRESHOLD) {
    outcome = 'defender_wins';
    newAttack = Math.max(0, Math.round(input.attack * (1 - LOSS_ON_WIN)));
  } else {
    outcome = 'stalemate';
    newAttack = Math.max(0, Math.round(input.attack * (1 - LOSS_ON_STALEMATE)));
    newDefense = Math.max(0, Math.round(input.defense * (1 - LOSS_ON_STALEMATE)));
  }

  return {
    outcome,
    newAttack,
    newDefense,
    conquest: outcome === 'attacker_wins' && newDefense === 0,
    invasionRepelled: outcome === 'defender_wins' && newAttack === 0,
  };
}

// Station defense value by tier (immobile but strong)
export const STATION_DEFENSE: Record<number, number> = {
  0: 0,
  1: 100,
  2: 300,
  3: 700,
  4: 1500,
};

// Calculate base defense for a quadrant including its station
export function calculateBaseDefense(stationTier: number, fleetStrength: number): number {
  return STATION_DEFENSE[stationTier] + fleetStrength;
}
```

**Step 4: Run tests — confirm pass**

```bash
cd packages/server && npx vitest run src/__tests__/warfareEngine.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/warfareEngine.ts \
        packages/server/src/__tests__/warfareEngine.test.ts
git commit -m "feat: warfareEngine — Attack/Defense strategic tick resolution with conquest/repel signals"
```

---

## Task 6: StrategicTickService — Wires Everything Together

**Files:**
- Create: `packages/server/src/engine/strategicTickService.ts`
- Create: `packages/server/src/__tests__/strategicTickService.test.ts`

**Prerequisite:** UniverseTickEngine (Phase LU #179) must exist. This service registers itself with the tick engine.

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/strategicTickService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrategicTickService } from '../engine/strategicTickService.js';

const mockPool = { query: vi.fn() } as any;
const mockRedis = {
  lpush: vi.fn(),
  ltrim: vi.fn(),
  setex: vi.fn(),
} as any;

describe('StrategicTickService', () => {
  let service: StrategicTickService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StrategicTickService(mockPool, mockRedis);
  });

  it('constructs without error', () => {
    expect(service).toBeDefined();
  });

  it('pushes war ticker event to Redis', async () => {
    await service.pushWarTickerEvent('K\'THARI INVASION — Quadrant [4/-2]');
    expect(mockRedis.lpush).toHaveBeenCalledWith(
      'war_ticker',
      expect.stringContaining('K\'THARI')
    );
    expect(mockRedis.ltrim).toHaveBeenCalledWith('war_ticker', 0, 9);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/__tests__/strategicTickService.test.ts
# Expected: FAIL
```

**Step 3: Implement StrategicTickService**

```typescript
// packages/server/src/engine/strategicTickService.ts
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import {
  getActiveQuadrantControls, upsertQuadrantControl,
  getAllFactionConfigs, getActiveNpcFleets,
  createNpcFleet, deleteArrivedNpcFleets,
} from '../db/queries.js';
import { FactionConfigService } from './factionConfigService.js';
import { calculateFriction, repValueToTier } from './frictionEngine.js';
import { findAllBorderPairs, getExpansionTarget } from './expansionEngine.js';
import { resolveStrategicTick, calculateBaseDefense } from './warfareEngine.js';
import { logger } from '../logger.js';

// Humanity rep store — will be filled from DB before each tick
type RepStore = Map<string, number>; // faction_id → rep value (-100..+100)

export class StrategicTickService {
  private factionConfig: FactionConfigService;

  constructor(
    private pool: Pool,
    private redis: Redis,
  ) {
    this.factionConfig = new FactionConfigService(pool);
  }

  async init(): Promise<void> {
    await this.factionConfig.init();
    logger.info('StrategicTickService initialized');
  }

  // Called by UniverseTickEngine every 60s
  async tick(repStore: RepStore): Promise<void> {
    await deleteArrivedNpcFleets(this.pool);
    const allControls = await getActiveQuadrantControls(this.pool);

    // 1. Update friction scores for all border pairs
    const borderPairs = findAllBorderPairs(allControls);
    for (const { a, b } of borderPairs) {
      // Only process human<→alien borders (extend later for alien<→alien)
      if (a.controlling_faction !== 'human' && b.controlling_faction !== 'human') continue;
      const alienFaction = a.controlling_faction === 'human' ? b.controlling_faction : a.controlling_faction;
      const humanQuadrant = a.controlling_faction === 'human' ? a : b;
      const alienQuadrant = a.controlling_faction === 'human' ? b : a;

      const rep = repStore.get(alienFaction) ?? 0;
      const repTier = repValueToTier(rep);
      const factionCfg = this.factionConfig.getConfig(alienFaction);
      const aggression = factionCfg?.aggression ?? 1.0;
      const { score, state } = calculateFriction(repTier, aggression);

      // Update friction on the alien quadrant
      await upsertQuadrantControl(this.pool, {
        ...alienQuadrant,
        faction_shares: alienQuadrant.faction_shares ?? { [alienFaction]: 100 },
        attack_value: alienQuadrant.attack_value ?? 0,
        defense_value: alienQuadrant.defense_value ?? calculateBaseDefense(alienQuadrant.station_tier, 0),
        friction_score: score,
      });

      // 2. Handle expansion / warfare based on friction state
      if (state === 'peaceful_halt') {
        // Expansion blocked — log only
      } else if (state === 'total_war') {
        await this.processWarfareTick(humanQuadrant, alienQuadrant, alienFaction);
      }
    }

    // 3. Alien expansion into unclaimed space
    await this.processAlienExpansion(allControls, repStore);
  }

  private async processWarfareTick(
    humanQ: any, alienQ: any, alienFaction: string
  ): Promise<void> {
    const result = resolveStrategicTick({
      attack: alienQ.attack_value,
      defense: humanQ.defense_value,
    });

    if (result.conquest) {
      // Alien takes the human quadrant
      await upsertQuadrantControl(this.pool, {
        ...humanQ,
        controlling_faction: alienFaction,
        faction_shares: { [alienFaction]: 100 },
        attack_value: 0,
        defense_value: calculateBaseDefense(humanQ.station_tier, 200),
        friction_score: 0,
      });
      await this.pushWarTickerEvent(
        `${alienFaction.toUpperCase()} CONQUEST — Quadrant [${humanQ.qx}/${humanQ.qy}] lost`
      );
    } else if (result.invasionRepelled) {
      await this.pushWarTickerEvent(
        `INVASION REPELLED — Quadrant [${humanQ.qx}/${humanQ.qy}] held`
      );
    }
  }

  private async processAlienExpansion(allControls: any[], repStore: RepStore): Promise<void> {
    const factions = this.factionConfig.getActiveFactions().filter(f => f.faction_id !== 'human');
    for (const faction of factions) {
      const target = getExpansionTarget(faction.faction_id, allControls, faction.expansion_style as any);
      if (!target) continue;

      const rep = repStore.get(faction.faction_id) ?? 0;
      const repTier = repValueToTier(rep);
      const { state } = calculateFriction(repTier, faction.aggression);
      if (state === 'peaceful_halt') continue; // friendly — expansion halted

      // Spawn build ship (ETA = expansion_rate minutes)
      const eta = new Date(Date.now() + faction.expansion_rate * 60_000);
      await createNpcFleet(this.pool, {
        faction: faction.faction_id,
        fleet_type: 'build_ship',
        from_qx: faction.home_qx,
        from_qy: faction.home_qy,
        to_qx: target.qx,
        to_qy: target.qy,
        strength: 50,
        eta,
      });
    }
  }

  async pushWarTickerEvent(message: string): Promise<void> {
    const event = JSON.stringify({ message, ts: Date.now() });
    await this.redis.lpush('war_ticker', event);
    await this.redis.ltrim('war_ticker', 0, 9); // keep last 10
  }
}
```

**Step 4: Run tests — confirm pass**

```bash
cd packages/server && npx vitest run src/__tests__/strategicTickService.test.ts
# Expected: PASS
```

**Step 5: Wire into UniverseTickEngine**

In `packages/server/src/engine/universeTickEngine.ts` (Phase LU):

```typescript
// Add to UniverseTickEngine class:
import { StrategicTickService } from './strategicTickService.js';

// In constructor:
this.strategicTick = new StrategicTickService(pool, redis);
this.strategicTickCounter = 0;

// In init():
await this.strategicTick.init();

// In tick() method (every 5s game tick):
this.strategicTickCounter++;
if (this.strategicTickCounter >= 12) { // 12 × 5s = 60s
  this.strategicTickCounter = 0;
  const repStore = await this.loadRepStore(); // load humanityRep from DB
  await this.strategicTick.tick(repStore);
}
```

**Step 6: Commit**

```bash
git add packages/server/src/engine/strategicTickService.ts \
        packages/server/src/__tests__/strategicTickService.test.ts
git commit -m "feat: StrategicTickService — expansion/warfare orchestration wired to UniverseTickEngine"
```

---

## Task 7: Shared Types — QUAD-MAP Expansion State

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts` (verify re-export, likely automatic)

**Step 1: Add types**

In `packages/shared/src/types.ts`, append:

```typescript
// ─── Expansion & Warfare ─────────────────────────────────────────────────────

export interface QuadrantControlState {
  qx: number;
  qy: number;
  controlling_faction: string;
  faction_shares: Record<string, number>; // e.g. { human: 70, kthari: 30 }
  friction_score: number;   // 0–100
  friction_state: 'peaceful_halt' | 'skirmish' | 'escalation' | 'total_war';
  attack_value: number;
  defense_value: number;
  station_tier: number;
}

export interface NpcFleetState {
  id: string;
  faction: string;
  fleet_type: 'build_ship' | 'invasion' | 'patrol';
  from_qx: number;
  from_qy: number;
  to_qx: number;
  to_qy: number;
  eta: number; // unix timestamp ms
}

export interface WarTickerEvent {
  message: string;
  ts: number;
}
```

**Step 2: Rebuild shared**

```bash
cd packages/shared && npm run build
```

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: shared types — QuadrantControlState, NpcFleetState, WarTickerEvent"
```

---

## Task 8: Client State — Zustand Slice for Expansion

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add state to gameSlice**

In `packages/client/src/state/gameSlice.ts`:

```typescript
// Add to GameState interface:
quadrantControls: QuadrantControlState[];
npcFleets: NpcFleetState[];
warTicker: WarTickerEvent[];

// Add to initial state:
quadrantControls: [],
npcFleets: [],
warTicker: [],

// Add to actions:
setQuadrantControls: (controls: QuadrantControlState[]) =>
  set({ quadrantControls: controls }),
setNpcFleets: (fleets: NpcFleetState[]) =>
  set({ npcFleets: fleets }),
addWarTickerEvent: (event: WarTickerEvent) =>
  set(state => ({ warTicker: [event, ...state.warTicker].slice(0, 10) })),
```

**Step 2: Add network handlers in client.ts**

In `packages/client/src/network/client.ts`, add message handlers:

```typescript
room.onMessage('quadrantControls', (data: QuadrantControlState[]) => {
  useStore.getState().setQuadrantControls(data);
});

room.onMessage('npcFleets', (data: NpcFleetState[]) => {
  useStore.getState().setNpcFleets(data);
});

room.onMessage('warTicker', (data: WarTickerEvent) => {
  useStore.getState().addWarTickerEvent(data);
});
```

**Step 3: Add SectorRoom broadcast**

In `packages/server/src/rooms/SectorRoom.ts`, after joining:

```typescript
// Broadcast initial expansion state to new client
const controls = await getActiveQuadrantControls(this.db);
const fleets = await getActiveNpcFleets(this.db);
client.send('quadrantControls', controls.map(mapControlToState));
client.send('npcFleets', fleets.map(mapFleetToState));
```

**Step 4: Run client tests**

```bash
cd packages/client && npx vitest run
# Verify no regressions
```

**Step 5: Commit**

```bash
git add packages/client/src/state/gameSlice.ts \
        packages/client/src/network/client.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: client expansion state — quadrantControls, npcFleets, warTicker in Zustand + network handlers"
```

---

## Task 9: QUAD-MAP Overlay — Territorial Colors, Conflict Icons, War Ticker

**Files:**
- Modify: `packages/client/src/components/QuadMap/` (find exact component name)
- Create: `packages/client/src/components/WarTicker.tsx`

**Step 1: Find QuadMap component**

```bash
find packages/client/src/components -name "*Quad*" -o -name "*quad*"
```

**Step 2: Add territorial color overlay to QuadMap**

In the QuadMap component, import state and add per-quadrant coloring:

```typescript
import { useStore } from '../../state/store.js';

// In component:
const quadrantControls = useStore(s => s.quadrantControls);
const npcFleets = useStore(s => s.npcFleets);

// Helper: get overlay color for a quadrant
function getQuadrantOverlay(qx: number, qy: number): string | null {
  const ctrl = quadrantControls.find(c => c.qx === qx && c.qy === qy);
  if (!ctrl) return null;

  const FACTION_COLORS: Record<string, string> = {
    human:         'rgba(64, 128, 255, 0.3)',
    kthari:        'rgba(255, 68, 68, 0.3)',
    silent_swarm:  'rgba(255, 136, 68, 0.3)',
    archivare:     'rgba(136, 255, 204, 0.3)',
    konsortium:    'rgba(255, 170, 68, 0.3)',
    mycelianer:    'rgba(68, 255, 136, 0.3)',
    mirror_minds:  'rgba(204, 136, 255, 0.3)',
    touristengilde:'rgba(255, 255, 68, 0.3)',
  };
  return FACTION_COLORS[ctrl.controlling_faction] ?? 'rgba(128,128,128,0.2)';
}

// Frontline glow for high-friction quadrants
function getFrictionGlow(qx: number, qy: number): string | null {
  const ctrl = quadrantControls.find(c => c.qx === qx && c.qy === qy);
  if (!ctrl || ctrl.friction_score < 50) return null;
  if (ctrl.friction_score >= 71) return '0 0 8px 2px rgba(255,68,68,0.8)'; // red glow
  return '0 0 6px 2px rgba(255,165,0,0.6)'; // orange glow
}
```

In the quadrant cell render:

```tsx
<div
  style={{
    backgroundColor: getQuadrantOverlay(qx, qy) ?? 'transparent',
    boxShadow: getFrictionGlow(qx, qy) ?? 'none',
    // ... existing styles
  }}
>
  {/* Conflict icon for total_war quadrants */}
  {quadrantControls.find(c => c.qx === qx && c.qy === qy)?.friction_state === 'total_war' && (
    <span style={{ fontSize: '0.6em', position: 'absolute', top: 2, right: 2 }}>⚔</span>
  )}
  {/* Build ship / fleet arrows */}
  {npcFleets.filter(f => f.to_qx === qx && f.to_qy === qy).map(f => (
    <span key={f.id} style={{ fontSize: '0.5em', color: '#aaa' }}>▶</span>
  ))}
</div>
```

**Step 3: Create WarTicker component**

```typescript
// packages/client/src/components/WarTicker.tsx
import React from 'react';
import { useStore } from '../state/store.js';

export function WarTicker() {
  const warTicker = useStore(s => s.warTicker);

  if (warTicker.length === 0) return null;

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '0.65em',
      color: '#ff8844',
      borderTop: '1px solid #333',
      padding: '2px 6px',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }}>
      {warTicker.map((evt, i) => (
        <span key={evt.ts} style={{ marginRight: 24, opacity: 1 - i * 0.08 }}>
          ▶ {evt.message}
        </span>
      ))}
    </div>
  );
}
```

**Step 4: Add WarTicker to NAV-COM monitor**

Find the NAV-COM monitor component and add `<WarTicker />` at the bottom of the QUAD-MAP view.

**Step 5: Run client tests**

```bash
cd packages/client && npx vitest run
# Expected: no regressions
```

**Step 6: Commit**

```bash
git add packages/client/src/components/WarTicker.tsx \
        packages/client/src/components/QuadMap/
git commit -m "feat: QUAD-MAP expansion overlay — territorial colors, friction glow, conflict icons, WarTicker"
```

---

## Task 10: Diplomacy & War Quest Types

**Files:**
- Modify: `packages/server/src/rooms/services/QuestService.ts`
- Create: `packages/server/src/__tests__/diplomacyQuests.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/diplomacyQuests.test.ts
import { describe, it, expect } from 'vitest';
import { generateDiplomacyQuest, generateWarSupportQuest } from '../rooms/services/QuestService.js';

describe('generateDiplomacyQuest', () => {
  it('returns a quest to increase rep with target faction', () => {
    const quest = generateDiplomacyQuest('kthari', { qx: 4, qy: -2 });
    expect(quest.type).toBe('diplomacy');
    expect(quest.target_faction).toBe('kthari');
    expect(quest.rep_reward).toBeGreaterThan(0);
  });
});

describe('generateWarSupportQuest', () => {
  it('returns a logistics quest that boosts defense', () => {
    const quest = generateWarSupportQuest('logistics', { qx: 1, qy: 0 });
    expect(quest.type).toBe('war_support');
    expect(quest.subtype).toBe('logistics');
    expect(quest.defense_bonus).toBeGreaterThan(0);
  });

  it('returns a sabotage quest that reduces enemy defense', () => {
    const quest = generateWarSupportQuest('sabotage', { qx: 4, qy: -2 });
    expect(quest.type).toBe('war_support');
    expect(quest.subtype).toBe('sabotage');
    expect(quest.enemy_defense_reduction).toBeGreaterThan(0);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd packages/server && npx vitest run src/__tests__/diplomacyQuests.test.ts
# Expected: FAIL
```

**Step 3: Add quest generators to QuestService**

In `packages/server/src/rooms/services/QuestService.ts`, add:

```typescript
export function generateDiplomacyQuest(
  targetFaction: string,
  borderQuadrant: { qx: number; qy: number }
) {
  return {
    type: 'diplomacy' as const,
    target_faction: targetFaction,
    border_qx: borderQuadrant.qx,
    border_qy: borderQuadrant.qy,
    description: `Build trust with the ${targetFaction} — deliver cultural artifacts to their border station`,
    rep_reward: 15,
    expires_hours: 48,
  };
}

export function generateWarSupportQuest(
  subtype: 'logistics' | 'sabotage' | 'scanning' | 'salvage',
  targetQuadrant: { qx: number; qy: number }
) {
  const subtypeMap = {
    logistics: { defense_bonus: 200, enemy_defense_reduction: 0,  attack_multiplier: 1.0, description: 'Deliver munitions and fuel to the front station' },
    sabotage:  { defense_bonus: 0,   enemy_defense_reduction: 150, attack_multiplier: 1.0, description: 'Hack enemy comm relays to lower their shields' },
    scanning:  { defense_bonus: 0,   enemy_defense_reduction: 0,  attack_multiplier: 1.3, description: 'Deep-space scan to reveal enemy fleet positions' },
    salvage:   { defense_bonus: 100, enemy_defense_reduction: 0,  attack_multiplier: 1.1, description: 'Collect debris from the battle for tech bonuses' },
  };

  return {
    type: 'war_support' as const,
    subtype,
    target_qx: targetQuadrant.qx,
    target_qy: targetQuadrant.qy,
    ...subtypeMap[subtype],
    expires_hours: 24,
  };
}
```

**Step 4: Run tests — confirm pass**

```bash
cd packages/server && npx vitest run src/__tests__/diplomacyQuests.test.ts
# Expected: PASS
```

**Step 5: Run full test suite to catch regressions**

```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run
```

**Step 6: Commit**

```bash
git add packages/server/src/rooms/services/QuestService.ts \
        packages/server/src/__tests__/diplomacyQuests.test.ts
git commit -m "feat: diplomacy + war support quest types — rep building, logistics, sabotage, scanning, salvage"
```

---

## Summary

| Task | Scope | Key Deliverable |
|------|-------|-----------------|
| 1 | DB | Migration 043: `quadrant_control`, `npc_fleet`, `faction_config` |
| 2 | Engine | `frictionEngine` — rep tier → friction score + state |
| 3 | Engine | `FactionConfigService` — faction personalities + aggression |
| 4 | Engine | `expansionEngine` — border detection + expansion targeting |
| 5 | Engine | `warfareEngine` — Attack/Defense tick resolution |
| 6 | Engine | `StrategicTickService` — orchestration + war ticker Redis queue |
| 7 | Shared | Types: `QuadrantControlState`, `NpcFleetState`, `WarTickerEvent` |
| 8 | Client | Zustand state + network handlers for expansion data |
| 9 | Client | QUAD-MAP territorial overlay + `WarTicker` component |
| 10 | Server | Diplomacy + war support quest generators |

**Total migrations after this phase:** 043
**New engine files:** 5 (`frictionEngine`, `factionConfigService`, `expansionEngine`, `warfareEngine`, `strategicTickService`)
**New client components:** 1 (`WarTicker`)

**Depends on:** Phase LU complete — specifically `UniverseTickEngine` (#179) which provides the 5s game tick that the 60s strategic tick plugs into.
