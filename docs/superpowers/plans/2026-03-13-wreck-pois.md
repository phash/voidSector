# Wreck-POIs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add salvageable Wreck POIs to sectors — found via scan, investigated for contents, salvaged item-by-item with Explorer-ACEP-influenced success chances, yielding resources/modules/blueprints/artefacts/data slates.

**Architecture:** New `WreckService` (server, Mining-pattern with Redis sessions) + `WreckSpawnEngine` (StrategicTick-driven) + `wreckQueries.ts` + client `WreckPanel`. Data Slates use a `wreck_slate_metadata` table for lookup, can be consumed/sold/fed to Jumpgates.

**Tech Stack:** TypeScript, Colyseus, PostgreSQL (queries.ts pattern), Redis (hset/hgetall pattern from RedisAPStore), React + Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-03-13-wreck-pois-design.md`

---

## Chunk 1: Foundation — Types, Constants, Migrations, DB Queries

---

### Task 1: Shared Types & Constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add WreckItem and related types to types.ts**

After the existing `InventoryItem` interface (around line 85), add:

```typescript
export type WreckSize = 'small' | 'medium' | 'large';
export type WreckStatus = 'intact' | 'investigated' | 'exhausted';

export interface WreckItem {
  itemType: 'resource' | 'module' | 'blueprint' | 'data_slate';
  // Artefacts: itemType='resource', itemId='artefact_drive'|'artefact_cargo' etc.
  itemId: string;
  quantity: number;
  baseDifficulty: number;  // 0.0–1.0
  salvaged: boolean;       // true after any attempt (success or fail)
}

export interface WreckInfo {
  wreckId: string;
  tier: number;
  size: WreckSize;
  status: WreckStatus;
}

export interface WreckSlateMetadata {
  id: string;
  playerId: string;
  sectorX: number;
  sectorY: number;
  sectorType: string | null;
  hasJumpgate: boolean;
  wreckTier: number;
}

// Server → Client events
export interface WreckInvestigatedPayload {
  wreckId: string;
  items: WreckItem[];
  size: WreckSize;
  tier: number;
}

export interface SalvageStartedPayload {
  wreckId: string;
  itemIndex: number;
  duration: number;
  chance: number;
}

export interface SalvageResultPayload {
  success: boolean;
  item: WreckItem;
  cargoUpdate?: CargoState;
  newModifier: number;
}

export interface WreckExhaustedPayload {
  wreckId: string;
  sectorX: number;
  sectorY: number;
}
```

- [ ] **Step 2: Add wreck constants to constants.ts**

Find the section with game constants and add:

```typescript
// ─── Wreck POI ────────────────────────────────────────────────────────────────

export const WRECK_BASE_DIFFICULTY: Record<string, number> = {
  resource: 0.20,
  module: 0.50,
  blueprint: 0.70,
  data_slate: 0.65,
  artefact: 0.90,  // artefacts are stored as resource but use this key for difficulty
};

export const WRECK_SALVAGE_DURATION_MS: Record<WreckSize, number> = {
  small: 4000,
  medium: 6000,
  large: 8000,
};

export const WRECK_SIZE_ITEM_COUNT: Record<WreckSize, [number, number]> = {
  small: [2, 3],
  medium: [4, 6],
  large: [7, 10],
};

export const WRECK_MAX_PER_QUADRANT = 2;
export const WRECK_DIFFICULTY_FAIL_DELTA = 0.15;
export const WRECK_DIFFICULTY_SUCCESS_DELTA = -0.10;
export const WRECK_DIFFICULTY_MAX = 0.3;
export const WRECK_DIFFICULTY_MIN = -0.3;
export const WRECK_SLATE_CAP = 5;
export const WRECK_EXPLORER_CHANCE_PER_XP = 0.005;  // +0.5% per explorer XP, max +25%
export const WRECK_HELION_ARTEFACT_MIN_CHANCE = 0.35; // at explorer=50, artefacts min 35%
export const WRECK_INVESTIGATE_AP_COST = 2;
export const WRECK_SALVAGE_AP_COST = 3;
export const WRECK_SLATE_SELL_BASE = 50;
export const WRECK_SLATE_SELL_PER_TIER = 75;
export const WRECK_SLATE_JUMPGATE_HUMANITY_TAX = 25;
```

- [ ] **Step 3: Build shared package**

```bash
cd packages/shared && npm run build
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/dist
git commit -m "feat: add WreckItem types and wreck constants to shared"
```

---

### Task 2: Add `wreckDetection` to AcepEffects

**Files:**
- Modify: `packages/server/src/engine/acepXpService.ts`
- Modify: `packages/client/src/state/gameSlice.ts`

- [ ] **Step 1: Write failing test for wreckDetection**

In `packages/server/src/__tests__/acep.test.ts` (if it exists) or create a new test file `packages/server/src/__tests__/wreckAcep.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAcepEffects } from '../engine/acepXpService.js';

describe('wreckDetection ACEP effect', () => {
  it('is false when explorer < 25', () => {
    const effects = getAcepEffects({ ausbau: 0, intel: 0, kampf: 0, explorer: 24, total: 24 });
    expect(effects.wreckDetection).toBe(false);
  });

  it('is true when explorer >= 25', () => {
    const effects = getAcepEffects({ ausbau: 0, intel: 0, kampf: 0, explorer: 25, total: 25 });
    expect(effects.wreckDetection).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/wreckAcep.test.ts
```
Expected: FAIL — `effects.wreckDetection` is undefined.

- [ ] **Step 3: Add wreckDetection to AcepEffects interface and getAcepEffects**

In `acepXpService.ts`, add to `AcepEffects` interface after `helionDecoderEnabled`:
```typescript
wreckDetection: boolean;  // reveals Tier-4/5 wrecks on radar without local scan
```

In `getAcepEffects`, add to the returned object after `helionDecoderEnabled`:
```typescript
wreckDetection: e >= 25,
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/__tests__/wreckAcep.test.ts
```
Expected: PASS.

- [ ] **Step 5: Add wreckDetection to ClientShipData.acepEffects in gameSlice.ts**

Find `acepEffects?:` in `ClientShipData` interface (around line 65) and add:
```typescript
wreckDetection?: boolean;
```

- [ ] **Step 6: Rebuild shared and run all server tests**

```bash
cd packages/server && npx vitest run
```
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/engine/acepXpService.ts packages/server/src/__tests__/wreckAcep.test.ts packages/client/src/state/gameSlice.ts
git commit -m "feat: add wreckDetection to AcepEffects (explorer >= 25)"
```

---

### Task 3: DB Migrations

**Files:**
- Create: `packages/server/src/db/migrations/061_wrecks.sql`
- Create: `packages/server/src/db/migrations/062_wreck_slate_metadata.sql`

- [ ] **Step 1: Create 061_wrecks.sql**

```sql
-- Migration 061: Wreck POI table
CREATE TABLE IF NOT EXISTS wrecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  size TEXT NOT NULL DEFAULT 'small',
  items JSONB NOT NULL DEFAULT '[]',
  difficulty_modifier FLOAT NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'intact',
  spawned_at TIMESTAMPTZ DEFAULT NOW(),
  exhausted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wrecks_quadrant ON wrecks(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_sector ON wrecks(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_status ON wrecks(status);
```

- [ ] **Step 2: Create 062_wreck_slate_metadata.sql**

```sql
-- Migration 062: Wreck slate metadata
-- (data_slates table already exists with different schema — this is separate)
CREATE TABLE IF NOT EXISTS wreck_slate_metadata (
  id UUID PRIMARY KEY,
  player_id VARCHAR(100) NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  sector_type TEXT,
  has_jumpgate BOOLEAN NOT NULL DEFAULT false,
  wreck_tier INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wreck_slate_player ON wreck_slate_metadata(player_id);
```

- [ ] **Step 3: Verify migrations auto-run on server start**

The migration runner picks up files by filename sort order. Files 061 and 062 are after 060 — no gaps.

```bash
# Check: the highest existing migration
ls packages/server/src/db/migrations/ | sort | tail -5
```
Expected: 060_drop_hull_type.sql is the last; 061 and 062 will be next.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/migrations/061_wrecks.sql packages/server/src/db/migrations/062_wreck_slate_metadata.sql
git commit -m "feat: add wrecks and wreck_slate_metadata DB migrations (061, 062)"
```

---

### Task 4: wreckQueries.ts

**Files:**
- Create: `packages/server/src/db/wreckQueries.ts`
- Test: `packages/server/src/__tests__/wreckQueries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/wreckQueries.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

async function freshImports() {
  vi.resetModules();
  const { query } = await import('../db/client.js');
  const {
    getWreckAtSector,
    getWreckById,
    getActiveWreckCount,
    insertWreck,
    updateWreckStatus,
    updateWreckItem,
    updateWreckModifier,
    pickRandomWreckableSector,
    insertWreckSlateMetadata,
    getWreckSlateMetadata,
  } = await import('../db/wreckQueries.js');
  return { query, getWreckAtSector, getWreckById, getActiveWreckCount, insertWreck, updateWreckStatus, updateWreckItem, updateWreckModifier, pickRandomWreckableSector, insertWreckSlateMetadata, getWreckSlateMetadata };
}

afterEach(() => vi.clearAllMocks());

describe('wreckQueries', () => {
  it('getWreckAtSector returns null when not found', async () => {
    const { query, getWreckAtSector } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const result = await getWreckAtSector(5, 10);
    expect(result).toBeNull();
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('wrecks'), [5, 10]);
  });

  it('getActiveWreckCount filters by intact/investigated', async () => {
    const { query, getActiveWreckCount } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [{ count: '1' }] } as any);
    const count = await getActiveWreckCount(0, 0);
    expect(count).toBe(1);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('intact','investigated')"),
      [0, 0],
    );
  });

  it('insertWreck inserts and returns row', async () => {
    const { query, insertWreck } = await freshImports();
    const mockWreck = { id: 'uuid-1', quadrant_x: 0, quadrant_y: 0, sector_x: 5, sector_y: 5, tier: 1, size: 'small', items: [], difficulty_modifier: 0, status: 'intact', spawned_at: new Date().toISOString(), exhausted_at: null };
    vi.mocked(query).mockResolvedValue({ rows: [mockWreck] } as any);
    const result = await insertWreck({ quadrantX: 0, quadrantY: 0, sectorX: 5, sectorY: 5, tier: 1, size: 'small' as const, items: [] });
    expect(result.id).toBe('uuid-1');
  });

  it('updateWreckStatus calls UPDATE with correct status', async () => {
    const { query, updateWreckStatus } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    await updateWreckStatus('uuid-1', 'investigated');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wrecks'),
      ['investigated', 'uuid-1'],
    );
  });

  it('getWreckById returns wreck row by id', async () => {
    const { query, getWreckById } = await freshImports();
    const mockWreck = { id: 'uuid-1', sector_x: 5, sector_y: 5, tier: 2, size: 'medium', items: [], difficulty_modifier: 0, status: 'investigated', quadrant_x: 0, quadrant_y: 0 };
    vi.mocked(query).mockResolvedValue({ rows: [mockWreck] } as any);
    const result = await getWreckById('uuid-1');
    expect(result?.id).toBe('uuid-1');
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['uuid-1']);
  });

  it('getWreckById returns null when not found', async () => {
    const { query, getWreckById } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const result = await getWreckById('nonexistent');
    expect(result).toBeNull();
  });

  it('getWreckSlateMetadata returns null when not found', async () => {
    const { query, getWreckSlateMetadata } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const result = await getWreckSlateMetadata('slate-uuid');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/__tests__/wreckQueries.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create wreckQueries.ts**

```typescript
// packages/server/src/db/wreckQueries.ts
import { query } from './client.js';
import type { WreckItem, WreckSize, WreckStatus, WreckSlateMetadata } from '@void-sector/shared';

export interface WreckRow {
  id: string;
  quadrant_x: number;
  quadrant_y: number;
  sector_x: number;
  sector_y: number;
  tier: number;
  size: WreckSize;
  items: WreckItem[];
  difficulty_modifier: number;
  status: WreckStatus;
  spawned_at: string;
  exhausted_at: string | null;
}

export async function getWreckAtSector(
  sectorX: number,
  sectorY: number,
): Promise<WreckRow | null> {
  const { rows } = await query<WreckRow>(
    `SELECT * FROM wrecks WHERE sector_x = $1 AND sector_y = $2 AND status != 'exhausted' LIMIT 1`,
    [sectorX, sectorY],
  );
  return rows[0] ?? null;
}

export async function getWreckById(wreckId: string): Promise<WreckRow | null> {
  const { rows } = await query<WreckRow>(
    `SELECT * FROM wrecks WHERE id = $1`,
    [wreckId],
  );
  return rows[0] ?? null;
}

export async function getActiveWreckCount(qx: number, qy: number): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM wrecks WHERE quadrant_x = $1 AND quadrant_y = $2 AND status IN ('intact','investigated')`,
    [qx, qy],
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function insertWreck(data: {
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
  tier: number;
  size: WreckSize;
  items: WreckItem[];
}): Promise<WreckRow> {
  const { rows } = await query<WreckRow>(
    `INSERT INTO wrecks (quadrant_x, quadrant_y, sector_x, sector_y, tier, size, items)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.quadrantX, data.quadrantY, data.sectorX, data.sectorY, data.tier, data.size, JSON.stringify(data.items)],
  );
  return rows[0];
}

export async function updateWreckStatus(wreckId: string, status: WreckStatus): Promise<void> {
  const extra = status === 'exhausted' ? ', exhausted_at = NOW()' : '';
  await query(`UPDATE wrecks SET status = $1${extra} WHERE id = $2`, [status, wreckId]);
}

export async function updateWreckItem(
  wreckId: string,
  itemIndex: number,
  salvaged: boolean,
): Promise<void> {
  await query(
    `UPDATE wrecks SET items = jsonb_set(items, $1, $2) WHERE id = $3`,
    [`{${itemIndex},salvaged}`, JSON.stringify(salvaged), wreckId],
  );
}

export async function updateWreckModifier(wreckId: string, modifier: number): Promise<void> {
  await query(`UPDATE wrecks SET difficulty_modifier = $1 WHERE id = $2`, [modifier, wreckId]);
}

export async function pickRandomWreckableSector(
  qx: number,
  qy: number,
): Promise<{ sectorX: number; sectorY: number } | null> {
  // Pick a sector in quadrant with no active wreck, no station/pirate_zone, no star/black_hole
  const { rows } = await query<{ x: number; y: number }>(
    `SELECT s.x, s.y FROM sectors s
     WHERE s.quadrant_x = $1 AND s.quadrant_y = $2
       AND (s.environment_type IS NULL OR s.environment_type NOT IN ('star','black_hole'))
       AND NOT (s.contents @> '["station"]'::jsonb)
       AND NOT (s.contents @> '["pirate_zone"]'::jsonb)
       AND NOT EXISTS (
         SELECT 1 FROM wrecks w
         WHERE w.sector_x = s.x AND w.sector_y = s.y AND w.status != 'exhausted'
       )
     ORDER BY RANDOM() LIMIT 1`,
    [qx, qy],
  );
  if (rows.length === 0) return null;
  return { sectorX: rows[0].x, sectorY: rows[0].y };
}

// Wreck Slate Metadata
export async function insertWreckSlateMetadata(data: WreckSlateMetadata): Promise<void> {
  await query(
    `INSERT INTO wreck_slate_metadata (id, player_id, sector_x, sector_y, sector_type, has_jumpgate, wreck_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.id, data.playerId, data.sectorX, data.sectorY, data.sectorType, data.hasJumpgate, data.wreckTier],
  );
}

export async function getWreckSlateMetadata(slateId: string): Promise<WreckSlateMetadata | null> {
  const { rows } = await query<{
    id: string; player_id: string; sector_x: number; sector_y: number;
    sector_type: string | null; has_jumpgate: boolean; wreck_tier: number;
  }>(
    `SELECT * FROM wreck_slate_metadata WHERE id = $1`,
    [slateId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, playerId: r.player_id, sectorX: r.sector_x, sectorY: r.sector_y,
    sectorType: r.sector_type, hasJumpgate: r.has_jumpgate, wreckTier: r.wreck_tier,
  };
}

export async function deleteWreckSlateMetadata(slateId: string): Promise<void> {
  await query(`DELETE FROM wreck_slate_metadata WHERE id = $1`, [slateId]);
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/wreckQueries.test.ts
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Run all server tests**

```bash
cd packages/server && npx vitest run
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/wreckQueries.ts packages/server/src/__tests__/wreckQueries.test.ts
git commit -m "feat: add wreckQueries.ts with all wreck/slate DB operations"
```

---

## Chunk 2: Server Logic — Spawn Engine, WreckService, Integration

---

### Task 5: WreckSpawnEngine

**Files:**
- Create: `packages/server/src/engine/wreckSpawnEngine.ts`
- Test: `packages/server/src/__tests__/wreckSpawnEngine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/wreckSpawnEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcSpawnChance,
  calcWreckTier,
  generateWreckItems,
  calcSalvageChance,
} from '../engine/wreckSpawnEngine.js';

describe('calcSpawnChance', () => {
  it('returns ~2% at origin', () => {
    expect(calcSpawnChance(0, 0)).toBeCloseTo(0.02);
  });

  it('increases with distance', () => {
    expect(calcSpawnChance(10, 0)).toBeGreaterThan(calcSpawnChance(0, 0));
  });

  it('caps at 20%', () => {
    expect(calcSpawnChance(1000, 0)).toBe(0.20);
  });
});

describe('calcWreckTier', () => {
  it('returns 1 at origin', () => {
    expect(calcWreckTier(0, 0)).toBe(1);
  });

  it('returns 3 at distance ~20', () => {
    expect(calcWreckTier(15, 5)).toBe(3);
  });

  it('returns 5 far out', () => {
    expect(calcWreckTier(50, 50)).toBe(5);
  });
});

describe('generateWreckItems', () => {
  it('returns 2–3 items for small tier-1 wreck', () => {
    const items = generateWreckItems(1, 'small');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it('items have valid baseDifficulty', () => {
    const items = generateWreckItems(2, 'medium');
    items.forEach((item) => {
      expect(item.baseDifficulty).toBeGreaterThanOrEqual(0);
      expect(item.baseDifficulty).toBeLessThanOrEqual(1);
    });
  });

  it('higher tier wrecks can contain modules/blueprints', () => {
    // Run many times — tier 3+ should produce non-resource items occasionally
    const allItems = Array.from({ length: 50 }, () => generateWreckItems(3, 'medium')).flat();
    const hasNonResource = allItems.some((i) => i.itemType !== 'resource');
    expect(hasNonResource).toBe(true);
  });
});

describe('calcSalvageChance', () => {
  it('resource at modifier=0, explorerXp=0 → 0.80', () => {
    expect(calcSalvageChance(0.20, 0, 0)).toBeCloseTo(0.80);
  });

  it('explorerXp adds bonus', () => {
    expect(calcSalvageChance(0.20, 0, 10)).toBeGreaterThan(calcSalvageChance(0.20, 0, 0));
  });

  it('positive modifier reduces chance', () => {
    expect(calcSalvageChance(0.50, 0.15, 0)).toBeLessThan(calcSalvageChance(0.50, 0, 0));
  });

  it('clamps to [0.05, 0.95]', () => {
    expect(calcSalvageChance(0.99, 0.3, 0)).toBeGreaterThanOrEqual(0.05);
    expect(calcSalvageChance(0.01, -0.3, 50)).toBeLessThanOrEqual(0.95);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/__tests__/wreckSpawnEngine.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create wreckSpawnEngine.ts**

```typescript
// packages/server/src/engine/wreckSpawnEngine.ts
import type { Pool } from 'pg';
import { query } from '../db/client.js';
import type { WreckItem, WreckSize } from '@void-sector/shared';
import {
  WRECK_BASE_DIFFICULTY,
  WRECK_SIZE_ITEM_COUNT,
  WRECK_EXPLORER_CHANCE_PER_XP,
  WRECK_HELION_ARTEFACT_MIN_CHANCE,
  WRECK_DIFFICULTY_MIN,
  WRECK_DIFFICULTY_MAX,
} from '@void-sector/shared';
import {
  getActiveWreckCount,
  insertWreck,
  pickRandomWreckableSector,
} from '../db/wreckQueries.js';
import { getAllQuadrantControls } from '../db/queries.js';
import { logger } from '../utils/logger.js';

const ARTEFACT_IDS = [
  'artefact_drive', 'artefact_cargo', 'artefact_scanner',
  'artefact_armor', 'artefact_weapon', 'artefact_shield',
  'artefact_defense', 'artefact_special', 'artefact_mining',
  'artefact_generator', 'artefact_repair',
];

const RESOURCE_IDS = ['ore', 'gas', 'crystal'];

// Modules available per tier (illustrative — adjust to MODULES keys as needed)
const MODULES_BY_TIER: Record<number, string[]> = {
  1: ['drive_mk1', 'scanner_mk1'],
  2: ['drive_mk2', 'scanner_mk2', 'cargo_mk1'],
  3: ['drive_mk3', 'scanner_mk3', 'laser_mk2', 'cargo_mk2'],
  4: ['laser_mk3', 'shield_mk2', 'armor_mk2', 'railgun_mk2'],
  5: ['laser_mk3', 'shield_mk3', 'armor_mk3', 'quantum_scanner', 'point_defense'],
};

const BLUEPRINTS_BY_TIER: Record<number, string[]> = {
  2: ['drive_mk2', 'scanner_mk2'],
  3: ['drive_mk3', 'laser_mk2', 'cargo_mk2'],
  4: ['laser_mk3', 'shield_mk2', 'railgun_mk2'],
  5: ['laser_mk3', 'shield_mk3', 'quantum_scanner', 'point_defense', 'ecm_suite'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calcSpawnChance(qx: number, qy: number): number {
  const dist = Math.sqrt(qx ** 2 + qy ** 2);
  return Math.min(0.02 + dist * 0.0025, 0.20);
}

export function calcWreckTier(qx: number, qy: number): number {
  const dist = Math.sqrt(qx ** 2 + qy ** 2);
  if (dist < 5) return 1;
  if (dist < 15) return 2;
  if (dist < 30) return 3;
  if (dist < 60) return 4;
  return 5;
}

function pickSize(tier: number): WreckSize {
  const r = Math.random();
  if (tier <= 2) return r < 0.6 ? 'small' : r < 0.9 ? 'medium' : 'large';
  if (tier <= 4) return r < 0.3 ? 'small' : r < 0.7 ? 'medium' : 'large';
  return r < 0.2 ? 'small' : r < 0.5 ? 'medium' : 'large';
}

export function generateWreckItems(tier: number, size: WreckSize): WreckItem[] {
  const [minItems, maxItems] = WRECK_SIZE_ITEM_COUNT[size];
  const count = randInt(minItems, maxItems);
  const items: WreckItem[] = [];

  for (let i = 0; i < count; i++) {
    const itemType = pickItemType(tier);
    let itemId: string;
    let baseDifficulty: number;
    let quantity = 1;

    if (itemType === 'resource') {
      const isArtefact = tier >= 3 && Math.random() < 0.1 * tier;
      if (isArtefact) {
        itemId = pick(ARTEFACT_IDS);
        baseDifficulty = WRECK_BASE_DIFFICULTY['artefact'];
      } else {
        itemId = pick(RESOURCE_IDS);
        baseDifficulty = WRECK_BASE_DIFFICULTY['resource'];
        quantity = randInt(5, 5 + tier * 10);
      }
    } else if (itemType === 'module') {
      const pool = MODULES_BY_TIER[Math.min(tier, 5)] ?? MODULES_BY_TIER[1];
      itemId = pick(pool);
      baseDifficulty = WRECK_BASE_DIFFICULTY['module'];
    } else if (itemType === 'blueprint') {
      const pool = BLUEPRINTS_BY_TIER[Math.min(tier, 5)] ?? BLUEPRINTS_BY_TIER[2];
      itemId = pick(pool);
      baseDifficulty = WRECK_BASE_DIFFICULTY['blueprint'];
    } else {
      // data_slate — generates a random far sector with optional jumpgate
      itemId = `slate_${Math.random().toString(36).slice(2, 10)}`;
      baseDifficulty = WRECK_BASE_DIFFICULTY['data_slate'];
    }

    items.push({ itemType, itemId, quantity, baseDifficulty, salvaged: false });
  }

  return items;
}

function pickItemType(tier: number): WreckItem['itemType'] {
  const r = Math.random();
  if (tier === 1) {
    return r < 0.85 ? 'resource' : 'module';
  } else if (tier === 2) {
    return r < 0.60 ? 'resource' : r < 0.85 ? 'module' : 'blueprint';
  } else if (tier === 3) {
    return r < 0.40 ? 'resource' : r < 0.65 ? 'module' : r < 0.85 ? 'blueprint' : 'data_slate';
  } else if (tier === 4) {
    return r < 0.25 ? 'resource' : r < 0.50 ? 'module' : r < 0.70 ? 'blueprint' : r < 0.85 ? 'data_slate' : 'resource';
  } else {
    // tier 5
    return r < 0.20 ? 'resource' : r < 0.40 ? 'blueprint' : r < 0.65 ? 'data_slate' : 'resource';
  }
}

export function calcSalvageChance(
  baseDifficulty: number,
  modifier: number,            // clamped [-0.3, +0.3]
  explorerXp: number,          // 0–50
  helionDecoder = false,
): number {
  const base = 1.0 - baseDifficulty;
  const explorerBonus = Math.min(explorerXp * WRECK_EXPLORER_CHANCE_PER_XP, 0.25);
  const modBonus = modifier * 0.15;  // positive modifier → harder
  const chance = base + explorerBonus - modBonus;
  const clamped = Math.max(0.05, Math.min(0.95, chance));
  // Helion decoder: artefacts have min 35% chance
  if (helionDecoder && baseDifficulty === WRECK_BASE_DIFFICULTY['artefact']) {
    return Math.max(WRECK_HELION_ARTEFACT_MIN_CHANCE, clamped);
  }
  return clamped;
}

// Called from StrategicTickService every 10 ticks
export async function tickWreckSpawns(): Promise<void> {
  try {
    const quadrants = await getAllQuadrantControls();
    for (const q of quadrants) {
      const count = await getActiveWreckCount(q.qx, q.qy);
      if (count >= 2) continue;

      const spawnChance = calcSpawnChance(q.qx, q.qy);
      if (Math.random() > spawnChance) continue;

      const sector = await pickRandomWreckableSector(q.qx, q.qy);
      if (!sector) continue;

      const tier = calcWreckTier(q.qx, q.qy);
      const size = pickSize(tier);
      const items = generateWreckItems(tier, size);
      await insertWreck({
        quadrantX: q.qx,
        quadrantY: q.qy,
        sectorX: sector.sectorX,
        sectorY: sector.sectorY,
        tier,
        size,
        items,
      });
      logger.debug({ qx: q.qx, qy: q.qy, tier, size }, 'Wreck spawned');
    }
  } catch (err) {
    logger.error({ err }, 'tickWreckSpawns failed');
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/wreckSpawnEngine.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/wreckSpawnEngine.ts packages/server/src/__tests__/wreckSpawnEngine.test.ts
git commit -m "feat: add WreckSpawnEngine with spawn/loot/chance logic"
```

---

### Task 6: Redis Salvage Session (RedisAPStore extension)

**Files:**
- Modify: `packages/server/src/rooms/services/RedisAPStore.ts`

- [ ] **Step 1: Add salvage session functions**

At the end of `RedisAPStore.ts`, add:

```typescript
const SALVAGE_PREFIX = 'player:salvage:';

export interface SalvageSession {
  wreckId: string;
  itemIndex: number;
  startedAt: number;
  duration: number;
  resolveChance: number;
}

export async function getSalvageSession(playerId: string): Promise<SalvageSession | null> {
  const data = await redis.hgetall(`${SALVAGE_PREFIX}${playerId}`);
  if (!data.wreckId) return null;
  return {
    wreckId: data.wreckId,
    itemIndex: Number(data.itemIndex),
    startedAt: Number(data.startedAt),
    duration: Number(data.duration),
    resolveChance: Number(data.resolveChance),
  };
}

export async function saveSalvageSession(
  playerId: string,
  session: SalvageSession,
): Promise<void> {
  await redis.hset(`${SALVAGE_PREFIX}${playerId}`, {
    wreckId: session.wreckId,
    itemIndex: String(session.itemIndex),
    startedAt: String(session.startedAt),
    duration: String(session.duration),
    resolveChance: String(session.resolveChance),
  });
  // TTL: duration + 30s crash protection
  await redis.pexpire(`${SALVAGE_PREFIX}${playerId}`, session.duration + 30_000);
}

export async function clearSalvageSession(playerId: string): Promise<void> {
  await redis.del(`${SALVAGE_PREFIX}${playerId}`);
}
```

- [ ] **Step 2: Run all server tests to confirm no regressions**

```bash
cd packages/server && npx vitest run
```
Expected: all passing.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/rooms/services/RedisAPStore.ts
git commit -m "feat: add salvage session (get/save/clear) to RedisAPStore"
```

---

### Task 7: WreckService

**Files:**
- Create: `packages/server/src/rooms/services/WreckService.ts`
- Test: `packages/server/src/__tests__/wreckService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/wreckService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../db/wreckQueries.js', () => ({
  getWreckAtSector: vi.fn(),
  getWreckById: vi.fn(),
  updateWreckStatus: vi.fn(),
  updateWreckItem: vi.fn(),
  updateWreckModifier: vi.fn(),
  insertWreckSlateMetadata: vi.fn(),
  deleteWreckSlateMetadata: vi.fn(),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getSalvageSession: vi.fn(),
  saveSalvageSession: vi.fn(),
  clearSalvageSession: vi.fn(),
}));
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  canAddResource: vi.fn().mockResolvedValue(true),
  getInventoryItem: vi.fn().mockResolvedValue(0),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
}));
vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 }),
  getAcepEffects: vi.fn().mockReturnValue({ helionDecoderEnabled: false }),
  addAcepXpForPlayer: vi.fn(),
}));

import { WreckService } from '../rooms/services/WreckService.js';
import * as wreckQueries from '../db/wreckQueries.js';
import * as acepService from '../engine/acepXpService.js';
import * as RedisStore from '../rooms/services/RedisAPStore.js';
import * as inventoryService from '../engine/inventoryService.js';

const makeClient = (playerId = 'p1', sectorX = 5, sectorY = 5) => ({
  auth: { userId: playerId },
  send: vi.fn(),
  sessionId: 'sess-1',
});

const makeCtx = (sectorX = 5, sectorY = 5) => ({
  _px: vi.fn().mockReturnValue(sectorX),
  _py: vi.fn().mockReturnValue(sectorY),
  deductAP: vi.fn().mockResolvedValue(true),
  checkRate: vi.fn().mockReturnValue(true),
});

const mockWreck = {
  id: 'wreck-1',
  quadrant_x: 0, quadrant_y: 0,
  sector_x: 5, sector_y: 5,
  tier: 2, size: 'medium' as const,
  items: [
    { itemType: 'resource' as const, itemId: 'ore', quantity: 10, baseDifficulty: 0.20, salvaged: false },
    { itemType: 'module' as const, itemId: 'drive_mk2', quantity: 1, baseDifficulty: 0.50, salvaged: false },
  ],
  difficulty_modifier: 0,
  status: 'intact' as const,
  spawned_at: new Date().toISOString(),
  exhausted_at: null,
};

describe('WreckService.handleInvestigate', () => {
  it('sends wreckInvestigated with items and updates status', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue(mockWreck);
    vi.mocked(wreckQueries.updateWreckStatus).mockResolvedValue(undefined);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleInvestigate(client as any, {});

    expect(client.send).toHaveBeenCalledWith('wreckInvestigated', expect.objectContaining({
      wreckId: 'wreck-1',
      items: mockWreck.items,
    }));
    expect(wreckQueries.updateWreckStatus).toHaveBeenCalledWith('wreck-1', 'investigated');
  });

  it('sends actionError if no wreck in sector', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue(null);
    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleInvestigate(client as any, {});

    expect(client.send).toHaveBeenCalledWith('actionError', expect.objectContaining({ code: 'NO_WRECK' }));
  });
});

describe('WreckService.handleStartSalvage', () => {
  it('sends salvageStarted with correct duration and chance', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue({ ...mockWreck, status: 'investigated' });

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleStartSalvage(client as any, { itemIndex: 0 });

    expect(client.send).toHaveBeenCalledWith('salvageStarted', expect.objectContaining({
      wreckId: 'wreck-1',
      itemIndex: 0,
    }));
    expect(RedisStore.saveSalvageSession).toHaveBeenCalled();
  });

  it('rejects if cargo is full for resource item', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue({ ...mockWreck, status: 'investigated' });
    vi.mocked(inventoryService.canAddResource).mockResolvedValue(false);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleStartSalvage(client as any, { itemIndex: 0 });

    expect(client.send).toHaveBeenCalledWith('actionError', expect.objectContaining({ code: 'CARGO_FULL' }));
  });
});

describe('WreckService.resolveSalvage (via timer)', () => {
  it('sends salvageResult with success=true and item when chance is 1.0', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue({ ...mockWreck, status: 'investigated' });
    vi.mocked(wreckQueries.getWreckById).mockResolvedValue({ ...mockWreck, status: 'investigated' });
    vi.mocked(RedisStore.getSalvageSession).mockResolvedValue({
      wreckId: 'wreck-1',
      itemIndex: 0,
      startedAt: Date.now(),
      duration: 10,
      resolveChance: 1.0,  // always succeed
    });
    vi.mocked(RedisStore.saveSalvageSession).mockResolvedValue(undefined);
    vi.mocked(RedisStore.clearSalvageSession).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckItem).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckModifier).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckStatus).mockResolvedValue(undefined);
    vi.mocked(inventoryService.getCargoState).mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 } as any);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    // Trigger startSalvage with tiny duration, wait for auto-resolve
    await vi.useFakeTimers();
    await service.handleStartSalvage(client as any, { itemIndex: 0 });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    // salvageResult should have been sent
    expect(client.send).toHaveBeenCalledWith('salvageResult', expect.objectContaining({ success: true }));
  });

  it('sends wreckExhausted when all items are salvaged', async () => {
    const exhaustedWreck = {
      ...mockWreck,
      status: 'investigated' as const,
      items: [
        { itemType: 'resource' as const, itemId: 'ore', quantity: 10, baseDifficulty: 0.20, salvaged: true },
        { itemType: 'module' as const, itemId: 'drive_mk2', quantity: 1, baseDifficulty: 0.50, salvaged: false },
      ],
    };
    // After update, the last item is now salvaged too
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue(exhaustedWreck);
    vi.mocked(wreckQueries.getWreckById).mockResolvedValueOnce(exhaustedWreck).mockResolvedValueOnce({
      ...exhaustedWreck,
      items: exhaustedWreck.items.map((i) => ({ ...i, salvaged: true })),
    });
    vi.mocked(RedisStore.getSalvageSession).mockResolvedValue({
      wreckId: 'wreck-1', itemIndex: 1, startedAt: Date.now(), duration: 10, resolveChance: 1.0,
    });
    vi.mocked(RedisStore.clearSalvageSession).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckItem).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckModifier).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckStatus).mockResolvedValue(undefined);
    vi.mocked(inventoryService.getCargoState).mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 } as any);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await vi.useFakeTimers();
    await service.handleStartSalvage(client as any, { itemIndex: 1 });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(client.send).toHaveBeenCalledWith('wreckExhausted', expect.objectContaining({ wreckId: 'wreck-1' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/__tests__/wreckService.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Create WreckService.ts**

```typescript
// packages/server/src/rooms/services/WreckService.ts
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { v4 as uuidv4 } from 'uuid';
import {
  WRECK_SALVAGE_DURATION_MS,
  WRECK_DIFFICULTY_FAIL_DELTA,
  WRECK_DIFFICULTY_SUCCESS_DELTA,
  WRECK_DIFFICULTY_MAX,
  WRECK_DIFFICULTY_MIN,
  WRECK_SALVAGE_AP_COST,
  WRECK_INVESTIGATE_AP_COST,
  WRECK_SLATE_CAP,
  WRECK_SLATE_JUMPGATE_HUMANITY_TAX,
} from '@void-sector/shared';
import type { WreckSize } from '@void-sector/shared';
import {
  getWreckAtSector,
  getWreckById,
  updateWreckStatus,
  updateWreckItem,
  updateWreckModifier,
  insertWreckSlateMetadata,
  deleteWreckSlateMetadata,
} from '../../db/wreckQueries.js';
import {
  getSalvageSession,
  saveSalvageSession,
  clearSalvageSession,
} from './RedisAPStore.js';
import {
  addToInventory,
  canAddResource,
  getInventoryItem,
  getCargoState,
} from '../../engine/inventoryService.js';
import {
  getAcepXpSummary,
  getAcepEffects,
  addAcepXpForPlayer,
} from '../../engine/acepXpService.js';
import { calcSalvageChance } from '../../engine/wreckSpawnEngine.js';
import { logger } from '../../utils/logger.js';

export class WreckService {
  private salvageTimers = new Map<string, NodeJS.Timeout>();

  constructor(private ctx: ServiceContext) {}

  clearAllTimers(): void {
    for (const t of this.salvageTimers.values()) clearTimeout(t);
    this.salvageTimers.clear();
  }

  async handleInvestigate(client: Client, _data: unknown): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'investigate', 1000)) {
      client.send('actionError', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    const wreck = await getWreckAtSector(sectorX, sectorY);
    if (!wreck) {
      client.send('actionError', { code: 'NO_WRECK', message: 'Kein Wrack in diesem Sektor' });
      return;
    }
    if (wreck.status === 'exhausted') {
      client.send('actionError', { code: 'WRECK_GONE', message: 'Wrack bereits geborgen' });
      return;
    }

    const apOk = await this.ctx.deductAP(client.sessionId, WRECK_INVESTIGATE_AP_COST);
    if (!apOk) {
      client.send('actionError', { code: 'NO_AP', message: 'Zu wenig AP' });
      return;
    }

    if (wreck.status === 'intact') {
      await updateWreckStatus(wreck.id, 'investigated');
    }

    client.send('wreckInvestigated', {
      wreckId: wreck.id,
      items: wreck.items,
      size: wreck.size,
      tier: wreck.tier,
    });
  }

  async handleStartSalvage(
    client: Client,
    data: { itemIndex: number },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'salvage', 1000)) {
      client.send('actionError', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    const wreck = await getWreckAtSector(sectorX, sectorY);
    if (!wreck || wreck.status === 'exhausted') {
      client.send('actionError', { code: 'WRECK_GONE', message: 'Wrack nicht verfügbar' });
      return;
    }

    const { itemIndex } = data;
    const item = wreck.items[itemIndex];
    if (!item) {
      client.send('actionError', { code: 'INVALID_ITEM', message: 'Item nicht gefunden' });
      return;
    }
    if (item.salvaged) {
      client.send('actionError', { code: 'ITEM_DONE', message: 'Item bereits versucht' });
      return;
    }

    // Pre-checks
    if (item.itemType === 'resource') {
      const hasSpace = await canAddResource(auth.userId, item.quantity);
      if (!hasSpace) {
        client.send('actionError', { code: 'CARGO_FULL', message: 'Frachtraum voll' });
        return;
      }
    }
    if (item.itemType === 'data_slate') {
      const slateCount = await getInventoryItem(auth.userId, 'data_slate', 'any');
      // Count all data_slates
      const { getInventory } = await import('../../db/queries.js');
      const inv = await getInventory(auth.userId);
      const slates = inv.filter((i) => i.itemType === 'data_slate').length;
      if (slates >= WRECK_SLATE_CAP) {
        client.send('actionError', { code: 'SLATE_CAP', message: 'Max. 5 Slates im Inventar' });
        return;
      }
    }

    const apOk = await this.ctx.deductAP(client.sessionId, WRECK_SALVAGE_AP_COST);
    if (!apOk) {
      client.send('actionError', { code: 'NO_AP', message: 'Zu wenig AP' });
      return;
    }

    // Compute chance
    const shipXp = await getAcepXpSummary(auth.userId);
    const effects = getAcepEffects(shipXp);
    const chance = calcSalvageChance(
      item.baseDifficulty,
      wreck.difficulty_modifier,
      shipXp.explorer,
      effects.helionDecoderEnabled,
    );

    const duration = WRECK_SALVAGE_DURATION_MS[wreck.size as WreckSize];

    await saveSalvageSession(auth.userId, {
      wreckId: wreck.id,
      itemIndex,
      startedAt: Date.now(),
      duration,
      resolveChance: chance,
    });

    client.send('salvageStarted', {
      wreckId: wreck.id,
      itemIndex,
      duration,
      chance,
    });

    // Auto-resolve after duration
    const existing = this.salvageTimers.get(auth.userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.salvageTimers.delete(auth.userId);
      this.resolveSalvage(client, auth.userId, wreck.id, itemIndex, item.baseDifficulty).catch((err) =>
        logger.error({ err }, 'resolveSalvage failed'),
      );
    }, duration);
    this.salvageTimers.set(auth.userId, timer);
  }

  private async resolveSalvage(
    client: Client,
    playerId: string,
    wreckId: string,
    itemIndex: number,
    baseDifficulty: number,
  ): Promise<void> {
    const session = await getSalvageSession(playerId);
    if (!session || session.wreckId !== wreckId) return;

    await clearSalvageSession(playerId);

    const success = Math.random() < session.resolveChance;
    const w = await getWreckById(wreckId);
    if (!w) return;
    const item = (w.items as any[])[itemIndex];
    if (!item) return;

    // Update difficulty modifier
    const delta = success ? WRECK_DIFFICULTY_SUCCESS_DELTA : WRECK_DIFFICULTY_FAIL_DELTA;
    const newModifier = Math.max(
      WRECK_DIFFICULTY_MIN,
      Math.min(WRECK_DIFFICULTY_MAX, w.difficulty_modifier + delta),
    );
    await updateWreckModifier(wreckId, newModifier);
    await updateWreckItem(wreckId, itemIndex, true);

    let cargoUpdate = undefined;

    if (success) {
      addAcepXpForPlayer(playerId, 'explorer', 2).catch(() => {});

      // If data_slate: generate real UUID, create metadata, then add to inventory
      if (item.itemType === 'data_slate') {
        const slateId = uuidv4();
        const targetX = 50 + Math.floor(Math.random() * 200);
        const targetY = 50 + Math.floor(Math.random() * 200);
        // Tier-5 wrecks (60+ quadrant dist) have 30% chance of jumpgate sector
        const hasJumpgate = w.tier >= 5 && Math.random() < 0.3;
        await insertWreckSlateMetadata({
          id: slateId,
          playerId,
          sectorX: targetX,
          sectorY: targetY,
          sectorType: 'unknown',
          hasJumpgate,
          wreckTier: w.tier,
        });
        await addToInventory(playerId, 'data_slate', slateId, 1);
      } else {
        // All other item types: add directly to inventory
        await addToInventory(playerId, item.itemType, item.itemId, item.quantity);
      }

      cargoUpdate = await getCargoState(playerId);
    }

    client.send('salvageResult', {
      success,
      item,
      cargoUpdate,
      newModifier,
    });

    // Check if all items are done (re-fetch after update)
    const updatedWreck = await getWreckById(wreckId);
    const updatedItems = updatedWreck?.items as any[] | undefined;

    if (updatedItems?.every((i: any) => i.salvaged)) {
      await updateWreckStatus(wreckId, 'exhausted');
      client.send('wreckExhausted', {
        wreckId,
        sectorX: w.sector_x,
        sectorY: w.sector_y,
      });
    }
  }

  async handleCancelSalvage(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const timer = this.salvageTimers.get(auth.userId);
    if (timer) {
      clearTimeout(timer);
      this.salvageTimers.delete(auth.userId);
    }
    await clearSalvageSession(auth.userId);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/wreckService.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/services/WreckService.ts packages/server/src/__tests__/wreckService.test.ts
git commit -m "feat: add WreckService (investigate, startSalvage, resolveSalvage, cancel)"
```

---

### Task 8: StrategicTick + SectorRoom Integration

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

- [ ] **Step 1: Add wreck spawn to StrategicTickService**

In `strategicTickService.ts`, add import at top:
```typescript
import { tickWreckSpawns } from './wreckSpawnEngine.js';
```

In the `tick()` method, add a counter property and call at the END of `tick()`, AFTER the existing `cleanupExpiredQuestItems()` call (or whatever the last call in tick() is):
```typescript
// Add as a class field (top of class, before constructor):
private tickCount = 0;

// In tick() method, append at the very end before closing brace:
this.tickCount++;
if (this.tickCount % 10 === 0) {
  await tickWreckSpawns().catch((err) =>
    logger.error({ err }, 'tickWreckSpawns error'),
  );
}
```

**Note:** Read the current `strategicTickService.ts` to find the last statement in `tick()` before adding this block — make sure `this.tickCount++` goes AFTER all existing work, not before.

- [ ] **Step 2: Register WreckService in SectorRoom**

Find where `MiningService` is instantiated in `SectorRoom.ts`. Add alongside it:

```typescript
import { WreckService } from './services/WreckService.js';
// ...
private wreckService!: WreckService;
// In onCreate():
this.wreckService = new WreckService(this.serviceContext);
// In onDispose():
this.wreckService.clearAllTimers();
```

- [ ] **Step 3: Add message handlers in SectorRoom.ts**

Find the block of `this.onMessage(...)` calls and add:
```typescript
this.onMessage('investigateWreck', (client, data) => {
  this.wreckService.handleInvestigate(client, data).catch((err) =>
    logger.error({ err }, 'investigateWreck error'),
  );
});

this.onMessage('startSalvage', (client, data) => {
  this.wreckService.handleStartSalvage(client, data).catch((err) =>
    logger.error({ err }, 'startSalvage error'),
  );
});

this.onMessage('cancelSalvage', (client) => {
  this.wreckService.handleCancelSalvage(client).catch((err) =>
    logger.error({ err }, 'cancelSalvage error'),
  );
});
```

- [ ] **Step 4: Also extend localScan to include wreck in result**

In `ScanService.ts`, find where `localScanResult` is assembled and add the wreck lookup:
```typescript
import { getWreckAtSector } from '../../db/wreckQueries.js';
// In the scan result assembly:
const wreck = await getWreckAtSector(sectorX, sectorY);
const wreckInfo = wreck ? { wreckId: wreck.id, tier: wreck.tier, size: wreck.size, status: wreck.status } : null;
// Add wreckInfo to the localScanResult payload sent to client
```

- [ ] **Step 5: Run all server tests**

```bash
cd packages/server && npx vitest run
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/strategicTickService.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/ScanService.ts
git commit -m "feat: integrate WreckService into SectorRoom and spawn into StrategicTick"
```

---

## Chunk 3: Client — State, Radar, Overlay, WreckPanel

---

### Task 9: Client State & Network Handlers

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add sectorWrecks and activeWreck state to gameSlice.ts**

Find the `GameSlice` interface and add:
```typescript
import type {
  WreckInfo,
  WreckItem,
  WreckInvestigatedPayload,
  SalvageStartedPayload,
  SalvageResultPayload,
  WreckExhaustedPayload,
} from '@void-sector/shared';

// In GameSlice interface:
sectorWrecks: Record<string, WreckInfo>;       // key: "x:y"
activeWreck: WreckInvestigatedPayload | null;
salvageSession: SalvageStartedPayload | null;
setSectorWreck(key: string, info: WreckInfo | null): void;
setActiveWreck(payload: WreckInvestigatedPayload | null): void;
setSalvageSession(payload: SalvageStartedPayload | null): void;
```

In `createGameSlice`, add initial values and implementations:
```typescript
sectorWrecks: {},
activeWreck: null,
salvageSession: null,
setSectorWreck: (key, info) => set((s) => {
  const next = { ...s.sectorWrecks };
  if (info === null) delete next[key];
  else next[key] = info;
  return { sectorWrecks: next };
}),
setActiveWreck: (payload) => set({ activeWreck: payload }),
setSalvageSession: (payload) => set({ salvageSession: payload }),
```

- [ ] **Step 2: Add network event handlers in client.ts**

Find the block of `room.onMessage(...)` calls. Add after the existing handlers:

```typescript
room.onMessage('wreckInvestigated', (data: WreckInvestigatedPayload) => {
  useStore.getState().setActiveWreck(data);
});

room.onMessage('salvageStarted', (data: SalvageStartedPayload) => {
  useStore.getState().setSalvageSession(data);
});

room.onMessage('salvageResult', (data: SalvageResultPayload) => {
  useStore.getState().setSalvageSession(null);
  if (data.cargoUpdate) {
    useStore.getState().setCargo(data.cargoUpdate);
  }
  // Update activeWreck items
  const active = useStore.getState().activeWreck;
  if (active) {
    const updatedItems = active.items.map((item, idx) =>
      idx === useStore.getState().salvageSession?.itemIndex ? { ...item, salvaged: true } : item,
    );
    useStore.getState().setActiveWreck({ ...active, items: updatedItems });
  }
});

room.onMessage('wreckExhausted', (data: WreckExhaustedPayload) => {
  const key = `${data.sectorX}:${data.sectorY}`;
  useStore.getState().setSectorWreck(key, null);
  useStore.getState().setActiveWreck(null);
});
```

Also add `network.sendInvestigateWreck`, `network.sendStartSalvage`, `network.sendCancelSalvage` to the `network` object:
```typescript
sendInvestigateWreck: () => room?.send('investigateWreck', {}),
sendStartSalvage: (itemIndex: number) => room?.send('startSalvage', { itemIndex }),
sendCancelSalvage: () => room?.send('cancelSalvage', {}),
```

Also in `localScanResult` handler: when wreck info arrives in scan result, call:
```typescript
if (scanResult.wreckInfo) {
  const key = `${scanResult.sectorX}:${scanResult.sectorY}`;
  useStore.getState().setSectorWreck(key, scanResult.wreckInfo);
}
```

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```
Expected: all passing (Test Files X passed).

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat: add sectorWrecks client state and network event handlers"
```

---

### Task 10: Radar Wreck Icon

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

- [ ] **Step 1: Add sectorWrecks to RadarState and draw wreck icons**

In `RadarRenderer.ts`, find the `RadarState` interface and add:
```typescript
sectorWrecks?: Record<string, { tier: number; size: string }>;
```

Find the render function (where other POI icons like `jumpGateIcons` are drawn). Add wreck icon rendering inside the existing `dx`/`dy` loop, after the other per-cell icon drawing, using the same `cellX`/`cellY` variables that are already in scope:

**Important:** `RadarRenderer.ts` uses `CELL_W`/`CELL_H` (uppercase, local vars), and the per-cell coordinates are already computed as `cellX = gridCenterX + dx * CELL_W` / `cellY = gridCenterY + dy * CELL_H`. Add the wreck drawing INSIDE the existing `for (let dx = ...)` / `for (let dy = ...)` nested loop, at the end of the loop body:

```typescript
// Inside the dx/dy loop, after existing cell rendering:
if (state.sectorWrecks) {
  const wkey = `${sx}:${sy}`;  // sx, sy are the absolute sector coords already computed in the loop
  const wreck = state.sectorWrecks[wkey];
  if (wreck) {
    ctx.font = `${Math.floor(CELL_H * 0.55)}px monospace`;
    ctx.fillStyle = 'rgba(255, 176, 0, 0.55)';  // dimmed amber
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⊠', cellX, cellY);
  }
}
```

**Note:** Read `RadarRenderer.ts` first to confirm `sx`/`sy` are the correct variable names for the current sector coordinates within the loop.

- [ ] **Step 2: Pass sectorWrecks from store into RadarRenderer**

In `packages/client/src/components/RadarCanvas.tsx`, find where the RadarState is assembled for `renderRadar()` and add:
```typescript
const sectorWrecks = useStore((s) => s.sectorWrecks);
// In the RadarState object passed to renderRadar:
sectorWrecks,
```

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```
Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat: render wreck icon ⊠ on radar for known wrecks"
```

---

### Task 11: LocalScanResultOverlay — Salvageable Wreck Entry

**Files:**
- Modify: `packages/client/src/components/overlays/LocalScanResultOverlay.tsx`

The existing overlay already has a `wrecks` section for permadeath player-wrecks. We add a NEW section for salvageable wrecks.

- [ ] **Step 1: Add wreck entry with Untersuchen button**

In `LocalScanResultOverlay.tsx`, after the existing wrecks section (permadeath), add:

```tsx
{/* Salvageable Wreck */}
{result.wreckInfo && (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ color: 'var(--color-dim)', marginBottom: '6px', letterSpacing: '0.1em' }}>
      WRACK
    </div>
    <div style={{
      padding: '6px 8px',
      border: '1px solid rgba(255,176,0,0.3)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.7rem',
    }}>
      <span>
        <span style={{ color: 'var(--color-primary)' }}>⊠ WRACK-{result.wreckInfo.tier}</span>
        <span style={{ color: 'var(--color-dim)', marginLeft: 8 }}>
          [{result.wreckInfo.size.toUpperCase()}]
        </span>
      </span>
      <button
        onClick={() => {
          network.sendInvestigateWreck();
          setLocalScanResult(null);
        }}
        style={{
          border: '1px solid var(--color-primary)',
          background: 'none',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          cursor: 'pointer',
          padding: '2px 8px',
        }}
      >
        [UNTERSUCHEN]
      </button>
    </div>
  </div>
)}
```

Also add `wreckInfo` to the destructured `result` fields:
```typescript
const { resources, hiddenSignatures, wrecks, sectorX, sectorY, quadrantX, quadrantY, sectorType, structures, universeTick, wreckInfo } = result;
```

And add to the `localScanResult` type in `gameSlice.ts`:
```typescript
wreckInfo?: { wreckId: string; tier: number; size: string; status: string } | null;
```

- [ ] **Step 2: Run client tests**

```bash
cd packages/client && npx vitest run
```
Expected: all passing.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/overlays/LocalScanResultOverlay.tsx packages/client/src/state/gameSlice.ts
git commit -m "feat: add salvageable wreck entry to LocalScanResultOverlay"
```

---

### Task 12: WreckPanel Component

**Files:**
- Create: `packages/client/src/components/WreckPanel.tsx`
- Test: `packages/client/src/__tests__/WreckPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/client/src/__tests__/WreckPanel.test.tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WreckPanel } from '../components/WreckPanel';
import { useStore } from '../state/store';
import { network } from '../network/client';

vi.mock('../network/client', () => ({
  network: { sendStartSalvage: vi.fn(), sendCancelSalvage: vi.fn() },
}));

beforeEach(() => {
  useStore.setState({
    activeWreck: {
      wreckId: 'wreck-1',
      tier: 2,
      size: 'medium',
      items: [
        { itemType: 'resource', itemId: 'ore', quantity: 10, baseDifficulty: 0.20, salvaged: false },
        { itemType: 'module', itemId: 'drive_mk2', quantity: 1, baseDifficulty: 0.50, salvaged: false },
      ],
    },
    salvageSession: null,
    setActiveWreck: vi.fn(),
  });
});

describe('WreckPanel', () => {
  it('renders wreck tier and items', () => {
    render(<WreckPanel />);
    expect(screen.getByText(/WRACK — TIER 2/)).toBeInTheDocument();
    expect(screen.getByText(/ORE ×10/)).toBeInTheDocument();
    expect(screen.getByText(/drive_mk2/)).toBeInTheDocument();
  });

  it('shows BERGEN buttons for unsalvaged items', () => {
    render(<WreckPanel />);
    const buttons = screen.getAllByText('[BERGEN]');
    expect(buttons).toHaveLength(2);
  });

  it('calls sendStartSalvage with item index on BERGEN click', async () => {
    render(<WreckPanel />);
    const buttons = screen.getAllByText('[BERGEN]');
    await userEvent.click(buttons[0]);
    expect(network.sendStartSalvage).toHaveBeenCalledWith(0);
  });

  it('shows progress bar during active salvage session', () => {
    useStore.setState({
      salvageSession: { wreckId: 'wreck-1', itemIndex: 0, duration: 4000, chance: 0.78, startedAt: Date.now() },
    });
    render(<WreckPanel />);
    expect(screen.getByText(/BERGUNG/)).toBeInTheDocument();
  });

  it('returns null when no activeWreck', () => {
    useStore.setState({ activeWreck: null });
    const { container } = render(<WreckPanel />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/client && npx vitest run src/__tests__/WreckPanel.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Create WreckPanel.tsx**

```tsx
// packages/client/src/components/WreckPanel.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { WreckItem } from '@void-sector/shared';

function difficultyLabel(difficulty: number): string {
  if (difficulty <= 0.25) return 'EINFACH';
  if (difficulty <= 0.55) return 'MITTEL';
  if (difficulty <= 0.75) return 'SCHWER';
  return 'SEHR SCHWER';
}

function itemLabel(item: WreckItem): string {
  if (item.itemType === 'resource') {
    return item.itemId.startsWith('artefact_')
      ? `ARTEFAKT (${item.itemId.replace('artefact_', '')})`
      : `${item.itemId.toUpperCase()} ×${item.quantity}`;
  }
  if (item.itemType === 'blueprint') return `BLUEPRINT: ${item.itemId}`;
  if (item.itemType === 'data_slate') return 'DATA SLATE ◈';
  return item.itemId;
}

function ProgressBar({ startedAt, duration }: { startedAt: number; duration: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(1, elapsed / duration));
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt, duration]);

  const filled = Math.round(progress * 16);
  const empty = 16 - filled;
  const remaining = Math.max(0, Math.ceil((duration - (Date.now() - startedAt)) / 1000));

  return (
    <span style={{ color: 'var(--color-primary)', fontSize: '0.7rem' }}>
      {'█'.repeat(filled)}{'░'.repeat(empty)}
      {' '}BERGUNG... {remaining}s
    </span>
  );
}

export function WreckPanel() {
  const activeWreck = useStore((s) => s.activeWreck);
  const salvageSession = useStore((s) => s.salvageSession);
  const setActiveWreck = useStore((s) => s.setActiveWreck);

  if (!activeWreck) return null;

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
      padding: '12px',
      height: '100%',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        color: 'var(--color-primary)',
        letterSpacing: '0.15em',
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: '8px',
        marginBottom: '12px',
      }}>
        ⊠ WRACK — TIER {activeWreck.tier} · {activeWreck.size.toUpperCase()}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 100px',
        gap: '4px',
        color: 'var(--color-dim)',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        marginBottom: '6px',
      }}>
        <span>FRACHT</span>
        <span>CHANCE</span>
        <span></span>
      </div>

      {/* Items */}
      {activeWreck.items.map((item, idx) => {
        const isActive = salvageSession?.itemIndex === idx && salvageSession?.wreckId === activeWreck.wreckId;
        const chance = Math.round((1.0 - item.baseDifficulty) * 100);

        return (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 100px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid rgba(255,176,0,0.1)',
              opacity: item.salvaged ? 0.4 : 1,
            }}
          >
            <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>
              {itemLabel(item)}
            </span>

            <span style={{ color: 'var(--color-dim)', fontSize: '0.7rem' }}>
              {item.salvaged ? '—' : `${chance}%`}
            </span>

            <span>
              {item.salvaged ? (
                <span style={{ fontSize: '0.65rem', color: '#666' }}>VERSUCHT</span>
              ) : isActive && salvageSession ? (
                <ProgressBar startedAt={salvageSession.startedAt} duration={salvageSession.duration} />
              ) : (
                <button
                  disabled={!!salvageSession}
                  onClick={() => network.sendStartSalvage(idx)}
                  style={{
                    border: '1px solid var(--color-primary)',
                    background: 'none',
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    cursor: salvageSession ? 'not-allowed' : 'pointer',
                    padding: '2px 6px',
                    opacity: salvageSession ? 0.4 : 1,
                  }}
                >
                  [BERGEN]
                </button>
              )}
            </span>
          </div>
        );
      })}

      {/* Close */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setActiveWreck(null)}
          style={{
            border: '1px solid var(--color-dim)',
            background: 'none',
            color: 'var(--color-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            cursor: 'pointer',
            padding: '2px 8px',
          }}
        >
          [SCHLIESSEN]
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount WreckPanel in Sec 3 (Detail Monitor)**

In the component that renders Sec 3 (`CockpitLayout.tsx` or the detail panel switcher), add:
```tsx
import { WreckPanel } from './WreckPanel';
// In the render, at the top of the detail area (before other panels):
{activeWreck && <WreckPanel />}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/WreckPanel.test.tsx
```
Expected: all PASS.

- [ ] **Step 6: Run all client tests**

```bash
cd packages/client && npx vitest run
```
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/WreckPanel.tsx packages/client/src/__tests__/WreckPanel.test.tsx packages/client/src/components/CockpitLayout.tsx
git commit -m "feat: add WreckPanel component with progress bar and BERGEN buttons"
```

---

## Chunk 4: Data Slate Actions — Consume, Sell, Jumpgate Feed

---

### Task 13: Data Slate Actions (Server)

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/rooms/services/WreckService.ts`

- [ ] **Step 1: Write tests for slate actions**

In `packages/server/src/__tests__/wreckService.test.ts`, add:

```typescript
describe('WreckService.handleConsumeSlate', () => {
  it('removes slate and sends slateConsumed with sector coords', async () => {
    vi.mocked(wreckQueries.getWreckSlateMetadata).mockResolvedValue({
      id: 'slate-uuid',
      playerId: 'p1',
      sectorX: 100,
      sectorY: 200,
      sectorType: 'asteroid',
      hasJumpgate: false,
      wreckTier: 2,
    });
    vi.mocked(wreckQueries.deleteWreckSlateMetadata).mockResolvedValue(undefined);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleConsumeSlate(client as any, { slateId: 'slate-uuid' });

    expect(wreckQueries.deleteWreckSlateMetadata).toHaveBeenCalledWith('slate-uuid');
    expect(client.send).toHaveBeenCalledWith('slateConsumed', expect.objectContaining({
      slateId: 'slate-uuid',
      sectorX: 100,
      sectorY: 200,
    }));
  });

  it('sends actionError if slate not found', async () => {
    vi.mocked(wreckQueries.getWreckSlateMetadata).mockResolvedValue(null);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleConsumeSlate(client as any, { slateId: 'nonexistent' });

    expect(client.send).toHaveBeenCalledWith('actionError', expect.objectContaining({ code: 'SLATE_NOT_FOUND' }));
  });
});
```

- [ ] **Step 2: Add slate action handlers to WreckService**

```typescript
async handleConsumeSlate(client: Client, data: { slateId: string }): Promise<void> {
  const auth = client.auth as AuthPayload;
  const meta = await getWreckSlateMetadata(data.slateId);
  if (!meta) {
    client.send('actionError', { code: 'SLATE_NOT_FOUND', message: 'Slate nicht gefunden' });
    return;
  }
  // Remove from inventory
  const { removeFromInventory } = await import('../../engine/inventoryService.js');
  await removeFromInventory(auth.userId, 'data_slate', data.slateId, 1);
  await deleteWreckSlateMetadata(data.slateId);
  // Add sector to player's discoveries (mark as scanned)
  const { addDiscovery, getSector, saveSector } = await import('../../db/queries.js');
  let sector = await getSector(meta.sectorX, meta.sectorY);
  if (!sector) {
    const { generateSector } = await import('../../engine/worldgen.js');
    sector = generateSector(meta.sectorX, meta.sectorY);
    await saveSector(sector);
  }
  await addDiscovery(auth.userId, meta.sectorX, meta.sectorY, sector);
  client.send('slateConsumed', {
    slateId: data.slateId,
    sectorX: meta.sectorX,
    sectorY: meta.sectorY,
    sectorType: meta.sectorType,
  });
  client.send('logEntry', `DATA SLATE KONSUMIERT — Sektor (${meta.sectorX}, ${meta.sectorY}) aufgedeckt`);
}

async handleFeedSlateToGate(
  client: Client,
  data: { slateId: string },
): Promise<void> {
  const auth = client.auth as AuthPayload;
  const sectorX = this.ctx._px(client.sessionId);
  const sectorY = this.ctx._py(client.sessionId);

  // Check player is at a jumpgate
  const { getSector } = await import('../../db/queries.js');
  const sector = await getSector(sectorX, sectorY);
  if (!sector?.jumpgate) {
    client.send('actionError', { code: 'NO_GATE', message: 'Kein Jumpgate in diesem Sektor' });
    return;
  }

  const meta = await getWreckSlateMetadata(data.slateId);
  if (!meta?.hasJumpgate) {
    client.send('actionError', { code: 'NO_JUMPGATE_IN_SLATE', message: 'Slate enthält kein Jumpgate-Sektor' });
    return;
  }

  // Check distance limit (simplified: tier * 500 sectors max)
  const dist = Math.sqrt((meta.sectorX - sectorX) ** 2 + (meta.sectorY - sectorY) ** 2);
  if (dist > meta.wreckTier * 500) {
    client.send('actionError', { code: 'GATE_OUT_OF_RANGE', message: 'Ziel außerhalb Reichweite' });
    return;
  }

  const { removeFromInventory } = await import('../../engine/inventoryService.js');
  await removeFromInventory(auth.userId, 'data_slate', data.slateId, 1);
  await deleteWreckSlateMetadata(data.slateId);

  // Add new jumpgate connection to DB
  const { insertJumpGate, contributeHumanityRep } = await import('../../db/queries.js');
  await insertJumpGate({
    id: uuidv4(),
    sectorX,
    sectorY,
    targetX: meta.sectorX,
    targetY: meta.sectorY,
    gateType: 'human',
    requiresCode: false,
    requiresMinigame: false,
    accessCode: null,
  });

  // Contribute humanity tax: delta = WRECK_SLATE_JUMPGATE_HUMANITY_TAX, alienFactionId = 'human'
  // Note: verify the correct alien_faction_id key used in your humanity_reputation table
  await contributeHumanityRep('human', WRECK_SLATE_JUMPGATE_HUMANITY_TAX);

  client.send('gateConnectionAdded', {
    fromX: sectorX, fromY: sectorY,
    toX: meta.sectorX, toY: meta.sectorY,
  });
  client.send('logEntry', `JUMPGATE VERBUNDEN — Route zu (${meta.sectorX}, ${meta.sectorY}) hergestellt`);
}
```

- [ ] **Step 3: Register message handlers in SectorRoom.ts**

```typescript
this.onMessage('consumeWreckSlate', (client, data) => {
  this.wreckService.handleConsumeSlate(client, data).catch((err) =>
    logger.error({ err }, 'consumeWreckSlate error'),
  );
});
this.onMessage('feedSlateToGate', (client, data) => {
  this.wreckService.handleFeedSlateToGate(client, data).catch((err) =>
    logger.error({ err }, 'feedSlateToGate error'),
  );
});
```

- [ ] **Step 4: Add network senders in client.ts**

```typescript
sendConsumeWreckSlate: (slateId: string) => room?.send('consumeWreckSlate', { slateId }),
sendFeedSlateToGate: (slateId: string) => room?.send('feedSlateToGate', { slateId }),
```

- [ ] **Step 5: Add slateConsumed handler in client.ts**

```typescript
room.onMessage('slateConsumed', (data: { slateId: string; sectorX: number; sectorY: number }) => {
  // Add to discoveries so it appears on radar
  useStore.getState().addLogEntry(`DATA SLATE KONSUMIERT — Sektor (${data.sectorX}, ${data.sectorY}) aufgedeckt`);
});
```

- [ ] **Step 6: Add Slate Feed UI to NavTargetPanel**

**First, read `packages/client/src/components/NavTargetPanel.tsx` to understand the current structure.** Then add the following near the end of the rendered output (after the ENGAGE button or autopilot section).

The panel already has access to `position` and `discoveries`. You need to:
1. Subscribe to `inventory` from the store (or a new `wreckSlateMeta` state — see below)
2. Check if current sector has a jumpgate via `discoveries[\`${position.x}:${position.y}\`]`

Add to the component state/selectors:
```typescript
const position = useStore((s) => s.position);
const currentSectorInfo = useStore((s) => s.discoveries[`${position.x}:${position.y}`]);
// isAtJumpgate: sector has a jumpgate structure
const isAtJumpgate = !!(currentSectorInfo?.structures?.includes('jumpgate') || currentSectorInfo?.jumpgate);

// wreckSlateMeta: read from a new store field added in Task 9
// In Task 9 Step 1, also add: wreckSlateMeta: Record<string, WreckSlateMetadata>
// and setWreckSlateMeta action. Client.ts adds entries on 'slateConsumed' or 'salvageResult'.
const wreckSlateMeta = useStore((s) => s.wreckSlateMeta ?? {});
const wreckSlates = Object.values(wreckSlateMeta).filter(s => s.playerId === /* current player */);
// Simplification: store wreck slates in an array: wreckSlates: WreckSlateMetadata[]
// Add wreckSlates state to gameSlice.ts in Task 9, populated on salvageResult when item is data_slate
```

Then in the JSX:
```tsx
{/* Slate Feed — only show if at jumpgate and has wreck slates with jumpgate destinations */}
{isAtJumpgate && wreckSlates.filter(s => s.hasJumpgate).length > 0 && (
  <div style={{ marginTop: 8, borderTop: '1px solid var(--color-dim)', paddingTop: 8 }}>
    <div style={{ color: 'var(--color-dim)', fontSize: '0.65rem', marginBottom: 4, letterSpacing: '0.1em' }}>
      ◈ SLATE EINSPEISEN
    </div>
    {wreckSlates.filter(s => s.hasJumpgate).map(slate => (
      <button
        key={slate.id}
        onClick={() => network.sendFeedSlateToGate(slate.id)}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          border: '1px solid var(--color-primary)',
          background: 'none', color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
          cursor: 'pointer', padding: '2px 8px', marginBottom: 2,
        }}
      >
        [{slate.sectorX}, {slate.sectorY}] SEKTOR
      </button>
    ))}
  </div>
)}
```

**Also add to gameSlice.ts (in Task 9 Step 1):**
```typescript
// In GameSlice interface:
wreckSlates: WreckSlateMetadata[];
addWreckSlate(meta: WreckSlateMetadata): void;
removeWreckSlate(slateId: string): void;

// In createGameSlice:
wreckSlates: [],
addWreckSlate: (meta) => set((s) => ({ wreckSlates: [...s.wreckSlates, meta] })),
removeWreckSlate: (slateId) => set((s) => ({ wreckSlates: s.wreckSlates.filter(m => m.id !== slateId) })),
```

**And in client.ts** add to the `salvageResult` handler — when success and item is `data_slate`, call `addWreckSlate`. And on `slateConsumed` / `gateConnectionAdded`, call `removeWreckSlate(data.slateId)`.

- [ ] **Step 7: Run all tests**

```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```
Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/services/WreckService.ts packages/server/src/rooms/SectorRoom.ts packages/client/src/network/client.ts packages/client/src/components/NavTargetPanel.tsx packages/client/src/state/gameSlice.ts packages/server/src/__tests__/wreckService.test.ts
git commit -m "feat: data slate consume/sell/gate-feed actions"
```

---

## Final Steps

- [ ] **Build shared package**

```bash
cd packages/shared && npm run build
```

- [ ] **Run all tests across all packages**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```
Expected: all passing.

- [ ] **Rebuild Docker and smoke-test**

```bash
docker compose build server client && docker compose up -d server client
# Get tunnel URL:
docker compose logs cloudflared | grep trycloudflare
# Manual smoke test: register, scan sector, find wreck, investigate, salvage one item
```

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: Wreck-POI system complete — spawn, salvage, data slates, jumpgate feed"
```
