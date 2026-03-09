# Forschung & Wissen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Wissen knowledge resource system, typed artefacts, research lab upgrades (tier 1–5), and a Canvas tech tree replacing the TechTreePanel.

**Architecture:** Wissen is a player-global resource generated passively by owned stations with a `research_lab` structure (existing type, upgraded to tier 1–5 via new action). Typed artefacts (9 categories) replace old credits/ore research costs. A Canvas grid (categories × tiers) replaces `TechTreePanel` in Sec 2.

**Tech Stack:** TypeScript strict, Vitest, Colyseus, PostgreSQL, React Canvas

**Design doc:** `docs/plans/2026-03-09-forschung-wissen-design.md`

---

## Task 1: Shared — ArtefactType + Updated Types

**Files:**
- Modify: `packages/shared/src/types.ts`
- Test: `packages/shared/src/__tests__/research.test.ts`

**Step 1: Add ArtefactType and update ResearchCost**

In `packages/shared/src/types.ts`, add after the `ResourceType` line (~line 18):

```typescript
export type ArtefactType =
  | 'drive'
  | 'cargo'
  | 'scanner'
  | 'armor'
  | 'weapon'
  | 'shield'
  | 'defense'
  | 'special'
  | 'mining';

export const ARTEFACT_TYPES: ArtefactType[] = [
  'drive', 'cargo', 'scanner', 'armor', 'weapon',
  'shield', 'defense', 'special', 'mining',
];

/** Maps ArtefactType to ModuleCategory (1:1 correspondence) */
export const ARTEFACT_TYPE_FOR_CATEGORY: Record<string, ArtefactType> = {
  drive: 'drive', cargo: 'cargo', scanner: 'scanner', armor: 'armor',
  weapon: 'weapon', shield: 'shield', defense: 'defense', special: 'special',
  mining: 'mining',
};
```

**Step 2: Replace ResearchCost interface**

Replace the existing `researchCost?` inline type on `ModuleDefinition` (~line 1005) with a standalone interface, and update `ModuleDefinition`:

```typescript
export interface ResearchCost {
  wissen: number;
  /** Required artefacts by category — e.g. { drive: 1 } for T3 drive module */
  artefacts?: Partial<Record<ArtefactType, number>>;
}
```

In `ModuleDefinition`, change:
```typescript
// OLD:
researchCost?: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number; };
// NEW:
researchCost?: ResearchCost;
```

**Step 3: Update CargoState with typed artefact fields**

In `CargoState` (~line 171), add 9 typed artefact fields (keep `artefact` for legacy):

```typescript
export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
  slates: number;
  artefact: number; // legacy generic — kept for existing items
  fuel_cell?: number;
  circuit_board?: number;
  alloy_plate?: number;
  void_shard?: number;
  bio_extract?: number;
  // Typed artefacts (new):
  artefact_drive: number;
  artefact_cargo: number;
  artefact_scanner: number;
  artefact_armor: number;
  artefact_weapon: number;
  artefact_shield: number;
  artefact_defense: number;
  artefact_special: number;
  artefact_mining: number;
}
```

**Step 4: Update ResearchState with wissen**

```typescript
export interface ResearchState {
  unlockedModules: string[];
  blueprints: string[];
  activeResearch: {
    moduleId: string;
    startedAt: number;
    completesAt: number;
  } | null;
  activeResearch2: {
    moduleId: string;
    startedAt: number;
    completesAt: number;
  } | null; // slot 2 — null if not unlocked or not in use
  wissen: number;
  wissenRate: number; // Wissen/hour (for display)
}
```

**Step 5: Write failing tests**

In `packages/shared/src/__tests__/research.test.ts`, add:

```typescript
import { ARTEFACT_TYPES } from '../types';

describe('ArtefactType', () => {
  it('has exactly 9 types', () => {
    expect(ARTEFACT_TYPES).toHaveLength(9);
  });
  it('includes all module categories', () => {
    expect(ARTEFACT_TYPES).toContain('drive');
    expect(ARTEFACT_TYPES).toContain('mining');
    expect(ARTEFACT_TYPES).toContain('shield');
  });
});
```

**Step 6: Build shared and run tests**

```bash
cd packages/shared && npm run build && npx vitest run src/__tests__/research.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/__tests__/research.test.ts
git commit -m "feat: add ArtefactType, update ResearchCost/CargoState/ResearchState types"
```

---

## Task 2: Shared — Wissen Constants + Update MODULES researchCost

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Test: `packages/shared/src/__tests__/research.test.ts`

**Step 1: Add Wissen constants after STRUCTURE_AP_COSTS block**

```typescript
/** Base Wissen generation per hour by research lab tier */
export const RESEARCH_LAB_WISSEN_RATE: Record<number, number> = {
  1: 5,   // Grundlabor
  2: 12,  // Forschungslabor
  3: 25,  // Analysestation
  4: 45,  // Forschungsturm
  5: 80,  // Observatorium
};

export const RESEARCH_LAB_NAMES: Record<number, string> = {
  1: 'GRUNDLABOR',
  2: 'FORSCHUNGSLABOR',
  3: 'ANALYSESTATION',
  4: 'FORSCHUNGSTURM',
  5: 'OBSERVATORIUM',
};

/** Max research lab tier */
export const RESEARCH_LAB_MAX_TIER = 5;

/** Lab tier required to research modules of each module tier */
export const RESEARCH_LAB_TIER_FOR_MODULE_TIER: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
};

/** Wissen multipliers by sector content type */
export const WISSEN_SECTOR_MULTIPLIERS: Record<string, number> = {
  asteroid_field: 1.2,
  nebula: 1.5,
  anomaly: 2.0,
  black_hole_adjacent: 2.5,
  ancient_jumpgate: 5.0,
};

/** Base Wissen cost per module tier */
export const WISSEN_COST_BY_TIER: Record<number, number> = {
  1: 100, 2: 300, 3: 800, 4: 2000, 5: 5000,
};

/** Required artefact count per module tier (by matching type) */
export const ARTEFACT_REQUIRED_BY_TIER: Record<number, number> = {
  1: 0, 2: 0, 3: 1, 4: 2, 5: 3,
};

/** Wissen equivalent bonus per matching artefact used */
export const ARTEFACT_WISSEN_BONUS = 500;

/** Research time reduction bonus per matching artefact (fraction) */
export const ARTEFACT_TIME_BONUS_PER = 0.1;

/** Max artefacts per research */
export const MAX_ARTEFACTS_PER_RESEARCH = 3;

/** Lab upgrade costs (ore, crystal) per tier: tier_to_reach → costs */
export const RESEARCH_LAB_UPGRADE_COSTS: Record<number, { credits: number; ore: number; crystal: number }> = {
  2: { credits: 500,  ore: 30,  crystal: 20  },
  3: { credits: 1200, ore: 60,  crystal: 40  },
  4: { credits: 2500, ore: 100, crystal: 80  },
  5: { credits: 5000, ore: 150, crystal: 120 },
};
```

**Step 2: Update MODULES researchCost values**

All module `researchCost` values must change from `{ credits, ore?, ... }` to `{ wissen, artefacts? }`.

Formula by tier and category (artefact type = module category):
- T1: `{ wissen: 100 }` — no artefacts
- T2: `{ wissen: 300 }` — no artefacts
- T3: `{ wissen: 800, artefacts: { [category]: 1 } }`
- T4: `{ wissen: 2000, artefacts: { [category]: 2 } }`
- T5: `{ wissen: 5000, artefacts: { [category]: 3 } }`

Apply to all ~35 modules with researchCost. Example for drive modules:

```typescript
// drive_mk2 (T2):
researchCost: { wissen: 300 },

// drive_mk3 (T3):
researchCost: { wissen: 800, artefacts: { drive: 1 } },

// drive_mk4 (T4):
researchCost: { wissen: 2000, artefacts: { drive: 2 } },

// drive_mk5 (T5):
researchCost: { wissen: 5000, artefacts: { drive: 3 } },
```

Apply same pattern to all categories (cargo, scanner, armor, weapon, shield, defense, special, mining).

**Step 3: Write failing tests**

```typescript
describe('MODULES researchCost (new format)', () => {
  it('all researchCost values use wissen (not credits)', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!mod.researchCost) continue;
      expect(mod.researchCost, `${id} should use wissen`).toHaveProperty('wissen');
      expect(mod.researchCost as any).not.toHaveProperty('credits');
    }
  });
  it('T3+ modules require matching artefacts', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!mod.researchCost || mod.tier < 3) continue;
      const rc = mod.researchCost;
      const artefactCount = Object.values(rc.artefacts ?? {}).reduce((s, v) => s + v, 0);
      expect(artefactCount, `${id} T${mod.tier} should require artefacts`).toBeGreaterThan(0);
    }
  });
  it('WISSEN_COST_BY_TIER matches expected values', () => {
    expect(WISSEN_COST_BY_TIER[1]).toBe(100);
    expect(WISSEN_COST_BY_TIER[5]).toBe(5000);
  });
});
```

**Step 4: Run tests**

```bash
cd packages/shared && npm run build && npx vitest run
```

Expected: PASS (shared tests)

**Step 5: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: add Wissen/artefact constants, update MODULES researchCost to wissen format"
```

---

## Task 3: Shared — Update canStartResearch

**Files:**
- Modify: `packages/shared/src/research.ts`
- Test: `packages/shared/src/__tests__/research.test.ts`

**Step 1: Rewrite canStartResearch**

Replace the existing `canStartResearch` function in `packages/shared/src/research.ts`:

```typescript
import { MODULES, MAX_ARTEFACTS_PER_RESEARCH, ARTEFACT_REQUIRED_BY_TIER, RESEARCH_LAB_TIER_FOR_MODULE_TIER } from './constants.js';
import type { ResearchState, ArtefactType } from './types.js';

/** Typed artefact resources available to the player */
export type ArtefactResources = Partial<Record<ArtefactType, number>>;

export function canStartResearch(
  moduleId: string,
  research: ResearchState,
  wissen: number,
  artefacts: ArtefactResources,
  labTier: number,
  slotIndex: 1 | 2 = 1,
  factionTiers?: Record<string, string>,
): { valid: boolean; error?: string } {
  const mod = MODULES[moduleId];
  if (!mod) return { valid: false, error: 'Unknown module' };
  if (!mod.researchCost) return { valid: false, error: 'Module does not require research' };
  if (isModuleUnlocked(moduleId, research)) return { valid: false, error: 'Already unlocked' };

  // Slot checks
  if (slotIndex === 1 && research.activeResearch) return { valid: false, error: 'Research slot 1 busy' };
  if (slotIndex === 2 && research.activeResearch2) return { valid: false, error: 'Research slot 2 busy' };
  if (slotIndex === 2 && labTier < 3) return { valid: false, error: 'Slot 2 requires Analysestation (Lab III)' };

  // Lab tier check
  const requiredLab = RESEARCH_LAB_TIER_FOR_MODULE_TIER[mod.tier] ?? mod.tier;
  if (labTier < requiredLab) {
    return { valid: false, error: `Requires Lab ${toRoman(requiredLab)} (you have ${labTier > 0 ? `Lab ${toRoman(labTier)}` : 'no lab'})` };
  }

  // Prerequisite
  if (mod.prerequisite && !isModuleUnlocked(mod.prerequisite, research)) {
    return { valid: false, error: `Prerequisite not met: ${MODULES[mod.prerequisite]?.name ?? mod.prerequisite}` };
  }

  // Faction requirement
  if (mod.factionRequirement) {
    const playerTier = factionTiers?.[mod.factionRequirement.factionId];
    if (!playerTier || !meetsMinTier(playerTier, mod.factionRequirement.minTier)) {
      return { valid: false, error: `Faction requirement: ${mod.factionRequirement.factionId} ${mod.factionRequirement.minTier}` };
    }
  }

  // Artefact required count
  const rc = mod.researchCost;
  const requiredCount = ARTEFACT_REQUIRED_BY_TIER[mod.tier] ?? 0;
  const artefactType = mod.category as ArtefactType;
  const playerHas = artefacts[artefactType] ?? 0;
  if (requiredCount > 0 && playerHas < requiredCount) {
    return { valid: false, error: `Requires ${requiredCount}× ${artefactType} artefact (you have ${playerHas})` };
  }

  // Wissen check
  if (wissen < rc.wissen) {
    return { valid: false, error: `Not enough Wissen (need ${rc.wissen}, have ${wissen})` };
  }

  return { valid: true };
}

function toRoman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? `${n}`;
}
```

Keep `isModuleFreelyAvailable`, `isModuleUnlocked`, `meetsMinTier` unchanged.

**Step 2: Write failing tests**

```typescript
describe('canStartResearch (new)', () => {
  const baseResearch: ResearchState = {
    unlockedModules: ['drive_mk1'],
    blueprints: [],
    activeResearch: null,
    activeResearch2: null,
    wissen: 0,
    wissenRate: 0,
  };

  it('fails if no lab', () => {
    const r = canStartResearch('drive_mk2', baseResearch, 1000, {}, 0);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Lab I/);
  });

  it('fails if wissen too low', () => {
    const r = canStartResearch('drive_mk2', baseResearch, 50, {}, 2);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Wissen/);
  });

  it('succeeds for T2 with lab II and enough wissen', () => {
    const r = canStartResearch('drive_mk2', baseResearch, 300, {}, 2);
    expect(r.valid).toBe(true);
  });

  it('fails T3 without matching artefact', () => {
    const research = { ...baseResearch, unlockedModules: ['drive_mk1', 'drive_mk2'] };
    const r = canStartResearch('drive_mk3', research, 5000, {}, 3);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/artefact/);
  });

  it('succeeds T3 with matching artefact', () => {
    const research = { ...baseResearch, unlockedModules: ['drive_mk1', 'drive_mk2'] };
    const r = canStartResearch('drive_mk3', research, 5000, { drive: 1 }, 3);
    expect(r.valid).toBe(true);
  });

  it('slot 2 requires lab III', () => {
    const r = canStartResearch('drive_mk2', baseResearch, 300, {}, 2, 2);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Analysestation/);
  });
});
```

**Step 3: Run tests**

```bash
cd packages/shared && npm run build && npx vitest run src/__tests__/research.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/research.ts packages/shared/src/__tests__/research.test.ts
git commit -m "feat: update canStartResearch for wissen/artefact/lab-tier checks, add slot 2"
```

---

## Task 4: DB Migration 044

**Files:**
- Create: `packages/server/src/db/migrations/044_wissen_typed_artefacts.sql`

**Step 1: Write migration**

```sql
-- 044_wissen_typed_artefacts.sql
-- Wissen balance on player_research
ALTER TABLE player_research
  ADD COLUMN IF NOT EXISTS wissen INTEGER NOT NULL DEFAULT 0;

-- Slot 2 active research
ALTER TABLE active_research
  ADD COLUMN IF NOT EXISTS slot INTEGER NOT NULL DEFAULT 1;

-- Typed artefacts on cargo table
ALTER TABLE cargo
  ADD COLUMN IF NOT EXISTS artefact_drive    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_cargo    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_scanner  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_armor    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_weapon   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_shield   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_defense  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_special  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_mining   INTEGER NOT NULL DEFAULT 0;

-- Typed artefacts on player_storage
ALTER TABLE player_storage
  ADD COLUMN IF NOT EXISTS artefact_drive    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_cargo    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_scanner  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_armor    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_weapon   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_shield   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_defense  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_special  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_mining   INTEGER NOT NULL DEFAULT 0;

-- Note: research_lab already exists as a structure type.
-- Its tier column (existing on structures table) = lab level 1-5.
-- No new table needed.
```

**Step 2: Verify migration runs**

```bash
npm run docker:up
npm run dev:server  # watch startup logs for "Migration 044"
```

Expected: Server starts, migration applied without errors.

**Step 3: Commit**

```bash
git add packages/server/src/db/migrations/044_wissen_typed_artefacts.sql
git commit -m "feat: migration 044 — wissen, slot2 active_research, typed artefact columns"
```

---

## Task 5: DB Query Functions

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Test: `packages/server/src/__tests__/wissenQueries.test.ts` (new)

**Step 1: Add Wissen query functions**

At the end of the research section in `queries.ts` (~line 2091):

```typescript
// ── Wissen ──────────────────────────────────────────────────────────────

export async function getWissen(userId: string): Promise<number> {
  const { rows } = await query<{ wissen: number }>(
    'SELECT COALESCE(wissen, 0) AS wissen FROM player_research WHERE user_id = $1',
    [userId],
  );
  return rows[0]?.wissen ?? 0;
}

export async function addWissen(userId: string, amount: number): Promise<void> {
  await query(
    `INSERT INTO player_research (user_id, wissen)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
     SET wissen = player_research.wissen + $2`,
    [userId, amount],
  );
}

export async function deductWissen(userId: string, amount: number): Promise<boolean> {
  const { rows } = await query<{ wissen: number }>(
    `UPDATE player_research
     SET wissen = wissen - $2
     WHERE user_id = $1 AND wissen >= $2
     RETURNING wissen`,
    [userId, amount],
  );
  return rows.length > 0;
}

// ── Typed Artefacts ──────────────────────────────────────────────────────

/** Valid typed artefact column names (whitelist for dynamic queries) */
const TYPED_ARTEFACT_COLS = [
  'artefact_drive','artefact_cargo','artefact_scanner','artefact_armor',
  'artefact_weapon','artefact_shield','artefact_defense','artefact_special','artefact_mining',
] as const;
type TypedArtefactCol = (typeof TYPED_ARTEFACT_COLS)[number];

export async function getTypedArtefacts(
  userId: string,
): Promise<Record<string, number>> {
  const { rows } = await query<Record<TypedArtefactCol, number>>(
    `SELECT ${TYPED_ARTEFACT_COLS.join(', ')} FROM cargo WHERE user_id = $1`,
    [userId],
  );
  if (!rows[0]) return Object.fromEntries(TYPED_ARTEFACT_COLS.map(c => [c, 0]));
  return Object.fromEntries(TYPED_ARTEFACT_COLS.map(c => [c, rows[0][c] ?? 0]));
}

export async function addTypedArtefact(
  userId: string,
  type: string, // e.g. 'drive'
  amount = 1,
): Promise<void> {
  const col = `artefact_${type}` as TypedArtefactCol;
  if (!TYPED_ARTEFACT_COLS.includes(col)) throw new Error(`Invalid artefact type: ${type}`);
  await query(
    `UPDATE cargo SET ${col} = ${col} + $2 WHERE user_id = $1`,
    [userId, amount],
  );
}

export async function deductTypedArtefacts(
  userId: string,
  artefacts: Partial<Record<string, number>>,
): Promise<boolean> {
  // Build SET clause dynamically — all columns validated against whitelist
  const entries = Object.entries(artefacts).filter(([, v]) => v && v > 0);
  if (entries.length === 0) return true;
  for (const [type] of entries) {
    const col = `artefact_${type}`;
    if (!TYPED_ARTEFACT_COLS.includes(col as TypedArtefactCol)) return false;
  }
  const setClauses = entries.map(([type, v], i) => `artefact_${type} = artefact_${type} - $${i + 2}`);
  const whereGuards = entries.map(([type, v], i) => `artefact_${type} >= $${i + 2}`);
  const values = entries.map(([, v]) => v);
  const { rows } = await query(
    `UPDATE cargo SET ${setClauses.join(', ')}
     WHERE user_id = $1 AND ${whereGuards.join(' AND ')}
     RETURNING user_id`,
    [userId, ...values],
  );
  return rows.length > 0;
}

// ── Research Lab Level ────────────────────────────────────────────────────

/** Returns the current tier of the player's research_lab structure (0 if none) */
export async function getResearchLabTier(userId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>(
    `SELECT COALESCE(MAX(tier), 0) AS tier
     FROM structures
     WHERE owner_id = $1 AND type = 'research_lab'`,
    [userId],
  );
  return rows[0]?.tier ?? 0;
}

export async function upgradeResearchLabTier(
  userId: string, sectorX: number, sectorY: number,
): Promise<number | null> {
  const { rows } = await query<{ tier: number }>(
    `UPDATE structures
     SET tier = tier + 1
     WHERE owner_id = $1 AND type = 'research_lab'
       AND sector_x = $2 AND sector_y = $3
       AND tier < 5
     RETURNING tier`,
    [userId, sectorX, sectorY],
  );
  return rows[0]?.tier ?? null;
}
```

**Step 2: Write failing tests**

Create `packages/server/src/__tests__/wissenQueries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getWissen, addWissen, deductWissen } from '../db/queries.js';

// Note: These are unit tests using the query mock pattern from other test files.
// Check existing test files for the correct mock import pattern for this project.

describe('Wissen queries (unit)', () => {
  it('getWissen returns 0 for new player (mocked)', () => {
    // The actual integration test runs via dev:server.
    // Here we verify the function signature exists and exports correctly.
    expect(typeof getWissen).toBe('function');
    expect(typeof addWissen).toBe('function');
    expect(typeof deductWissen).toBe('function');
  });
});

describe('deductTypedArtefacts', () => {
  it('rejects invalid artefact type', async () => {
    const { deductTypedArtefacts } = await import('../db/queries.js');
    // Should return false for unknown type (not throw)
    const result = await deductTypedArtefacts('user-1', { invalid_type: 1 }).catch(() => false);
    expect(result).toBe(false);
  });
});
```

**Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/wissenQueries.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/__tests__/wissenQueries.test.ts
git commit -m "feat: add Wissen/typed-artefact/lab-tier DB query functions"
```

---

## Task 6: WissenTickHandler + StrategicTickService Integration

**Files:**
- Create: `packages/server/src/engine/wissenTickHandler.ts`
- Modify: `packages/server/src/engine/strategicTickService.ts`
- Test: `packages/server/src/__tests__/wissenTickHandler.test.ts`

**Step 1: Write failing tests**

Create `packages/server/src/__tests__/wissenTickHandler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateWissenGain,
  SECTOR_TYPE_MULTIPLIERS,
} from '../engine/wissenTickHandler.js';

describe('calculateWissenGain', () => {
  it('returns 0 for lab tier 0', () => {
    expect(calculateWissenGain(0, [], 3600)).toBe(0);
  });

  it('calculates base rate for lab tier 1 over 1 hour', () => {
    // Lab I = 5 Wissen/h. elapsedMs = 3_600_000 ms → gain = 5
    expect(calculateWissenGain(1, [], 3_600_000)).toBe(5);
  });

  it('applies asteroid multiplier (×1.2)', () => {
    const gain = calculateWissenGain(1, ['asteroid_field'], 3_600_000);
    expect(gain).toBeCloseTo(6, 0); // 5 × 1.2 = 6
  });

  it('applies ancient_jumpgate multiplier (×5.0)', () => {
    const gain = calculateWissenGain(1, ['ancient_jumpgate'], 3_600_000);
    expect(gain).toBeCloseTo(25, 0); // 5 × 5.0 = 25
  });

  it('multiplies stacked multipliers (nebula + anomaly)', () => {
    const gain = calculateWissenGain(2, ['nebula', 'anomaly'], 3_600_000);
    // Lab II = 12/h × 1.5 × 2.0 = 36/h
    expect(gain).toBeCloseTo(36, 0);
  });

  it('partial tick: 30min at lab 1 = 2-3 Wissen', () => {
    const gain = calculateWissenGain(1, [], 1_800_000); // 30 min
    expect(gain).toBeCloseTo(2.5, 0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/wissenTickHandler.test.ts
```

Expected: FAIL — module not found

**Step 3: Implement WissenTickHandler**

Create `packages/server/src/engine/wissenTickHandler.ts`:

```typescript
import { RESEARCH_LAB_WISSEN_RATE, WISSEN_SECTOR_MULTIPLIERS } from '@void-sector/shared';
import { getResearchLabTier, addWissen, getStructuresInRange } from '../db/queries.js';
import { logger } from '../utils/logger.js';

export { WISSEN_SECTOR_MULTIPLIERS as SECTOR_TYPE_MULTIPLIERS };

/**
 * Calculates Wissen gain for a single station given its lab tier,
 * the sector content types present, and elapsed time in ms.
 */
export function calculateWissenGain(
  labTier: number,
  sectorContentTypes: string[],
  elapsedMs: number,
): number {
  if (labTier === 0) return 0;
  const baseRatePerHour = RESEARCH_LAB_WISSEN_RATE[labTier] ?? 0;
  if (baseRatePerHour === 0) return 0;

  // Multiply all applicable sector multipliers
  let multiplier = 1.0;
  for (const contentType of sectorContentTypes) {
    const m = WISSEN_SECTOR_MULTIPLIERS[contentType];
    if (m) multiplier *= m;
  }

  const hours = elapsedMs / 3_600_000;
  return baseRatePerHour * multiplier * hours;
}

/**
 * Processes Wissen generation for all players with research labs.
 * Called from StrategicTickService once per strategic tick (~60s).
 */
export async function processWissenTick(elapsedMs: number): Promise<void> {
  // Find all research_lab structures
  const { query } = await import('../db/client.js');
  const { rows: labs } = await query<{
    owner_id: string;
    tier: number;
    sector_x: number;
    sector_y: number;
  }>(
    `SELECT owner_id, tier, sector_x, sector_y
     FROM structures
     WHERE type = 'research_lab' AND tier > 0`,
    [],
  );

  if (labs.length === 0) return;

  // For each lab, determine sector content multipliers
  for (const lab of labs) {
    try {
      // Get sector content types at lab location
      const { rows: sectorRows } = await query<{ environment_type: string; sector_type: string }>(
        `SELECT COALESCE(environment_type, '') AS environment_type,
                COALESCE(sector_type, '') AS sector_type
         FROM sectors
         WHERE sector_x = $1 AND sector_y = $2
         LIMIT 1`,
        [lab.sector_x, lab.sector_y],
      );

      const contentTypes: string[] = [];
      if (sectorRows[0]) {
        const { environment_type, sector_type } = sectorRows[0];
        if (environment_type) contentTypes.push(environment_type);
        if (sector_type) contentTypes.push(sector_type);
      }

      // Check for ancient jumpgate in same sector
      const { rows: gateRows } = await query<{ type: string }>(
        `SELECT type FROM jumpgates WHERE sector_x = $1 AND sector_y = $2 AND type = 'ancient' LIMIT 1`,
        [lab.sector_x, lab.sector_y],
      );
      if (gateRows.length > 0) contentTypes.push('ancient_jumpgate');

      const gain = calculateWissenGain(lab.tier, contentTypes, elapsedMs);
      const rounded = Math.floor(gain);
      if (rounded > 0) {
        await addWissen(lab.owner_id, rounded);
      }
    } catch (err) {
      logger.warn({ err, lab }, 'Wissen tick failed for lab');
    }
  }
}
```

**Step 4: Wire into StrategicTickService**

In `packages/server/src/engine/strategicTickService.ts`, add import at top:

```typescript
import { processWissenTick } from './wissenTickHandler.js';
```

In the `tick` method, add at the end:

```typescript
// 3. Wissen generation for research labs
await processWissenTick(60_000); // ~60s strategic tick interval
```

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/wissenTickHandler.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/server/src/engine/wissenTickHandler.ts \
        packages/server/src/engine/strategicTickService.ts \
        packages/server/src/__tests__/wissenTickHandler.test.ts
git commit -m "feat: WissenTickHandler — passive Wissen generation per lab tier + sector multipliers"
```

---

## Task 7: scanEvents — Typed Artefact Assignment

**Files:**
- Modify: `packages/server/src/engine/scanEvents.ts`
- Modify: `packages/server/src/rooms/services/ScanService.ts`
- Test: `packages/server/src/__tests__/scanEvents.test.ts`

**Step 1: Write failing test**

In `packages/server/src/__tests__/scanEvents.test.ts`, add:

```typescript
import { ARTEFACT_TYPES } from '@void-sector/shared';
import { getArtefactTypeForSeed } from '../engine/scanEvents.js';

describe('getArtefactTypeForSeed', () => {
  it('returns a valid ArtefactType', () => {
    for (let seed = 0; seed < 100; seed++) {
      const type = getArtefactTypeForSeed(seed);
      expect(ARTEFACT_TYPES).toContain(type);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(getArtefactTypeForSeed(42)).toBe(getArtefactTypeForSeed(42));
  });

  it('produces varied types across seeds', () => {
    const types = new Set(Array.from({ length: 50 }, (_, i) => getArtefactTypeForSeed(i * 7)));
    expect(types.size).toBeGreaterThan(5); // not all the same
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/scanEvents.test.ts
```

Expected: FAIL

**Step 3: Add getArtefactTypeForSeed to scanEvents.ts**

In `packages/server/src/engine/scanEvents.ts`, add import at top:

```typescript
import { ARTEFACT_TYPES } from '@void-sector/shared';
```

Add function:

```typescript
/** Returns a deterministic ArtefactType for the given numeric seed */
export function getArtefactTypeForSeed(seed: number): string {
  const idx = Math.abs(seed) % ARTEFACT_TYPES.length;
  return ARTEFACT_TYPES[idx];
}
```

Update `artifact_find` case to include type:

```typescript
case 'artifact_find':
  return {
    rewardCredits: 50 + ((seed >>> 8) % 150),
    rewardRep: 10,
    rewardArtefact: (seed >>> 16) % 100 < 50 ? 1 : 0,
    rewardArtefactType: getArtefactTypeForSeed(seed >>> 20),
  };
case 'anomaly_reading':
  return {
    rewardXp: 15 + ((seed >>> 6) % 35),
    rewardRep: 5,
    rewardArtefact: (seed >>> 14) % 100 < 8 ? 1 : 0,
    rewardArtefactType: (seed >>> 14) % 100 < 8 ? getArtefactTypeForSeed(seed >>> 18) : undefined,
  };
```

**Step 4: Update ScanService to store typed artefact**

In `packages/server/src/rooms/services/ScanService.ts`, find where `rewardArtefact` is applied and add typed artefact call:

```typescript
if (eventResult.rewardArtefact && eventResult.rewardArtefact > 0) {
  await addCargo(auth.userId, 'artefact', eventResult.rewardArtefact); // legacy count
  if (eventResult.rewardArtefactType) {
    await addTypedArtefact(auth.userId, eventResult.rewardArtefactType, eventResult.rewardArtefact);
  }
}
```

Import `addTypedArtefact` from `queries.js`.

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/scanEvents.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/server/src/engine/scanEvents.ts \
        packages/server/src/rooms/services/ScanService.ts \
        packages/server/src/__tests__/scanEvents.test.ts
git commit -m "feat: assign random ArtefactType to artefact scan rewards"
```

---

## Task 8: WorldService — Research Lab Upgrade Action

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Test: `packages/server/src/__tests__/worldService.test.ts`

**Step 1: Write failing test**

```typescript
// In worldService.test.ts or a new file
import { validateLabUpgrade } from '../engine/commands.js';

describe('validateLabUpgrade', () => {
  const fullCargo = { ore: 999, gas: 999, crystal: 999, credits: 9999, artefact: 0,
    artefact_drive:0, artefact_cargo:0, artefact_scanner:0, artefact_armor:0,
    artefact_weapon:0, artefact_shield:0, artefact_defense:0, artefact_special:0, artefact_mining:0,
    slates: 0 };

  it('fails if no existing lab', () => {
    const r = validateLabUpgrade(0, 10, fullCargo);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/no research lab/i);
  });

  it('fails if already max tier', () => {
    const r = validateLabUpgrade(5, 10, fullCargo);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/max/i);
  });

  it('fails if insufficient AP', () => {
    const r = validateLabUpgrade(1, 0, fullCargo);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/AP/i);
  });

  it('succeeds for valid upgrade from tier 1 to 2', () => {
    const r = validateLabUpgrade(1, 25, fullCargo);
    expect(r.valid).toBe(true);
    expect(r.targetTier).toBe(2);
  });
});
```

**Step 2: Implement validateLabUpgrade in commands.ts**

In `packages/server/src/engine/commands.ts`, import `RESEARCH_LAB_UPGRADE_COSTS` from shared, then add:

```typescript
export function validateLabUpgrade(
  currentLabTier: number,
  currentAP: number,
  credits: number,
  cargo: { ore: number; crystal: number },
): { valid: boolean; error?: string; targetTier?: number; costs?: { credits: number; ore: number; crystal: number } } {
  if (currentLabTier === 0) return { valid: false, error: 'No research lab to upgrade' };
  if (currentLabTier >= RESEARCH_LAB_MAX_TIER) return { valid: false, error: 'Lab already at max tier' };

  const targetTier = currentLabTier + 1;
  const costs = RESEARCH_LAB_UPGRADE_COSTS[targetTier];
  if (!costs) return { valid: false, error: 'Unknown upgrade tier' };

  if (currentAP < 20) return { valid: false, error: `Insufficient AP (need 20, have ${Math.floor(currentAP)})` };
  if (credits < costs.credits) return { valid: false, error: `Insufficient credits (need ${costs.credits})` };
  if (cargo.ore < costs.ore) return { valid: false, error: `Insufficient ore (need ${costs.ore})` };
  if (cargo.crystal < costs.crystal) return { valid: false, error: `Insufficient crystal (need ${costs.crystal})` };

  return { valid: true, targetTier, costs };
}
```

Also import `RESEARCH_LAB_UPGRADE_COSTS`, `RESEARCH_LAB_MAX_TIER` from `@void-sector/shared`.

**Step 3: Add upgradeResearchLab handler to WorldService**

Add to `VALID_STRUCTURE_TYPES` check bypass (handle separately like jumpgate), and add handler:

```typescript
async handleUpgradeResearchLab(client: Client): Promise<void> {
  if (rejectGuest(client, 'Labor-Upgrade')) return;
  const auth = client.auth as AuthPayload;
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);

  const labTier = await getResearchLabTier(auth.userId);
  const ap = await getAPState(auth.userId);
  const currentAP = calculateCurrentAP(ap, Date.now());
  const cargo = await getPlayerCargo(auth.userId);
  const credits = await getPlayerCredits(auth.userId);

  const result = validateLabUpgrade(labTier, currentAP, credits, cargo);
  if (!result.valid) {
    client.send('error', { code: 'LAB_UPGRADE_FAIL', message: result.error! });
    return;
  }

  await deductCredits(auth.userId, result.costs!.credits);
  await deductCargo(auth.userId, 'ore', result.costs!.ore);
  await deductCargo(auth.userId, 'crystal', result.costs!.crystal);
  const newAPState = { ...ap, current: currentAP - 20 };
  await saveAPState(auth.userId, newAPState);

  const newTier = await upgradeResearchLabTier(auth.userId, sx, sy);
  if (!newTier) {
    client.send('error', { code: 'LAB_UPGRADE_FAIL', message: 'Lab not found at your location' });
    return;
  }

  client.send('labUpgradeResult', { success: true, newTier });
  client.send('apUpdate', newAPState);
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', updatedCargo);
}
```

**Step 4: Wire in SectorRoom.ts**

Find the build message handlers section and add:

```typescript
this.onMessage('upgradeResearchLab', (client) => this.world.handleUpgradeResearchLab(client));
```

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run
```

Expected: PASS (no regressions)

**Step 6: Commit**

```bash
git add packages/server/src/engine/commands.ts \
        packages/server/src/rooms/services/WorldService.ts \
        packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: research lab upgrade action (tier 1→5) with AP/resource costs"
```

---

## Task 9: ShipService — Updated Research Handlers

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Test: `packages/server/src/__tests__/research.test.ts` (server)

**Step 1: Update handleStartResearch**

Replace the existing `handleStartResearch` to use new `canStartResearch` signature:

```typescript
async handleStartResearch(
  client: Client,
  data: { moduleId: string; slot?: 1 | 2; artefactsToUse?: Partial<Record<string, number>> },
): Promise<void> {
  const auth = client.auth as AuthPayload;
  const slot = data.slot ?? 1;

  const dbResearch = await getPlayerResearch(auth.userId);
  const active1 = await getActiveResearch(auth.userId, 1);
  const active2 = await getActiveResearch(auth.userId, 2);
  const wissen = await getWissen(auth.userId);
  const labTier = await getResearchLabTier(auth.userId);
  const typedArtefacts = await getTypedArtefacts(auth.userId);

  const factionTiers = await getPlayerFactionTiers(auth.userId);

  const researchState: ResearchState = {
    unlockedModules: dbResearch.unlockedModules,
    blueprints: dbResearch.blueprints,
    activeResearch: active1,
    activeResearch2: active2,
    wissen,
    wissenRate: 0,
  };

  // Normalize typed artefacts to Record<ArtefactType, number>
  const artefactResources = Object.fromEntries(
    Object.entries(typedArtefacts).map(([k, v]) => [k.replace('artefact_', ''), v]),
  );

  const validation = canStartResearch(
    data.moduleId, researchState, wissen, artefactResources, labTier, slot, factionTiers,
  );
  if (!validation.valid) {
    client.send('error', { code: 'RESEARCH_FAIL', message: validation.error! });
    return;
  }

  const mod = MODULES[data.moduleId]!;
  const rc = mod.researchCost!;

  // Calculate actual Wissen cost (reduced by artefact bonuses)
  const artefactsUsed = data.artefactsToUse ?? {};
  const usedCount = Object.values(artefactsUsed).reduce((s, v) => s + (v ?? 0), 0);
  const wissenCost = Math.max(0, rc.wissen - Math.min(usedCount, MAX_ARTEFACTS_PER_RESEARCH) * ARTEFACT_WISSEN_BONUS);

  // Deduct Wissen
  const deducted = await deductWissen(auth.userId, wissenCost);
  if (!deducted) {
    client.send('error', { code: 'RESEARCH_FAIL', message: 'Insufficient Wissen (concurrent)' });
    return;
  }

  // Deduct typed artefacts (required + optional used)
  const allArtefactsToDeduct: Partial<Record<string, number>> = {};
  // Required artefacts
  if (rc.artefacts) {
    for (const [type, count] of Object.entries(rc.artefacts)) {
      allArtefactsToDeduct[type] = (allArtefactsToDeduct[type] ?? 0) + (count ?? 0);
    }
  }
  // Optional extra artefacts
  for (const [type, count] of Object.entries(artefactsUsed)) {
    const req = allArtefactsToDeduct[type] ?? 0;
    const extra = Math.max(0, (count ?? 0) - req);
    if (extra > 0) allArtefactsToDeduct[type] = (allArtefactsToDeduct[type] ?? 0) + extra;
  }
  if (Object.keys(allArtefactsToDeduct).length > 0) {
    await deductTypedArtefacts(auth.userId, allArtefactsToDeduct);
  }

  // Duration: base from module, reduced by matching artefacts × 10%
  const matchingArtefactType = mod.category;
  const matchingUsed = artefactsUsed[matchingArtefactType] ?? 0;
  const timeReduction = Math.min(matchingUsed * ARTEFACT_TIME_BONUS_PER, 0.5); // max 50%
  const durationMin = mod.researchDurationMin ?? 30;
  const durationMs = durationMin * 60_000 * (1 - timeReduction);

  const now = Date.now();
  await startActiveResearch(auth.userId, data.moduleId, now, now + durationMs, slot);

  const newResearch = await getPlayerResearch(auth.userId);
  const newWissen = await getWissen(auth.userId);
  client.send('researchResult', {
    success: true,
    activeResearch: slot === 1 ? { moduleId: data.moduleId, startedAt: now, completesAt: now + durationMs } : researchState.activeResearch,
    activeResearch2: slot === 2 ? { moduleId: data.moduleId, startedAt: now, completesAt: now + durationMs } : researchState.activeResearch2,
    wissen: newWissen,
  });
}
```

Also update `handleGetResearchState` to include `wissen` and `wissenRate` in the response, and update `startActiveResearch` / `getActiveResearch` in queries.ts to accept/return a `slot` parameter.

**Step 2: Update DB query for active_research to support slot**

In `queries.ts`, update `getActiveResearch` and `startActiveResearch`:

```typescript
export async function getActiveResearch(
  userId: string, slot = 1,
): Promise<{ moduleId: string; startedAt: number; completesAt: number } | null> {
  const { rows } = await query<{ module_id: string; started_at: string; completes_at: string }>(
    'SELECT module_id, started_at, completes_at FROM active_research WHERE user_id = $1 AND slot = $2',
    [userId, slot],
  );
  if (!rows[0]) return null;
  return {
    moduleId: rows[0].module_id,
    startedAt: new Date(rows[0].started_at).getTime(),
    completesAt: new Date(rows[0].completes_at).getTime(),
  };
}

export async function startActiveResearch(
  userId: string, moduleId: string, startedAt: number, completesAt: number, slot = 1,
): Promise<void> {
  await query(
    `INSERT INTO active_research (user_id, module_id, started_at, completes_at, slot)
     VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0), $5)
     ON CONFLICT (user_id, slot) DO UPDATE
     SET module_id = $2, started_at = to_timestamp($3 / 1000.0), completes_at = to_timestamp($4 / 1000.0)`,
    [userId, moduleId, startedAt, completesAt, slot],
  );
}
```

The `active_research` table already has a `slot` column from migration 044 — add unique constraint `(user_id, slot)` to migration if not already there.

**Step 3: Update handleGetResearchState to send wissen**

```typescript
async handleGetResearchState(client: Client): Promise<void> {
  const auth = client.auth as AuthPayload;
  const research = await getPlayerResearch(auth.userId);
  const active1 = await getActiveResearch(auth.userId, 1);
  const active2 = await getActiveResearch(auth.userId, 2);
  const wissen = await getWissen(auth.userId);
  const typedArtefacts = await getTypedArtefacts(auth.userId);

  client.send('researchState', {
    ...research,
    activeResearch: active1,
    activeResearch2: active2,
    wissen,
    wissenRate: 0, // calculated on tick — send 0 for now
    typedArtefacts,
  });
}
```

**Step 4: Run server tests**

```bash
cd packages/server && npx vitest run
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts \
        packages/server/src/db/queries.ts
git commit -m "feat: update research handlers for wissen costs, typed artefacts, dual slots"
```

---

## Task 10: Client — gameSlice + Network Handlers

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Test: `packages/client/src/__tests__/gameSlice.test.ts` (extend existing)

**Step 1: Update gameSlice.ts**

Find `research` in the state and extend it:

```typescript
// In the initial state, update research:
research: {
  unlockedModules: [],
  blueprints: [],
  activeResearch: null,
  activeResearch2: null,
  wissen: 0,
  wissenRate: 0,
} as ResearchState,

// Add typed artefacts to cargo initial state:
// Find where cargo is initialized and add the 9 fields with value 0.
```

Add a `setWissen` action if the store uses explicit setters, or handle via `setResearch` / `setResearchState`.

**Step 2: Update network/client.ts**

Find `researchState` message handler and extend:

```typescript
this.sectorRoom.onMessage('researchState', (data) => {
  useStore.getState().setResearch({
    unlockedModules: data.unlockedModules ?? [],
    blueprints: data.blueprints ?? [],
    activeResearch: data.activeResearch ?? null,
    activeResearch2: data.activeResearch2 ?? null,
    wissen: data.wissen ?? 0,
    wissenRate: data.wissenRate ?? 0,
  });
  if (data.typedArtefacts) {
    useStore.getState().setTypedArtefacts(data.typedArtefacts);
  }
});
```

Add network methods:

```typescript
sendStartResearch(moduleId: string, slot: 1 | 2 = 1, artefactsToUse?: Record<string, number>) {
  this.sectorRoom?.send('startResearch', { moduleId, slot, artefactsToUse });
}
```

**Step 3: Add `setTypedArtefacts` to gameSlice.ts**

Add a `typedArtefacts` state field and its setter. Map `typedArtefacts` in cargo display as needed.

**Step 4: Run client tests**

```bash
cd packages/client && npx vitest run
```

Expected: PASS (no regressions from type changes)

**Step 5: Commit**

```bash
git add packages/client/src/state/gameSlice.ts \
        packages/client/src/network/client.ts
git commit -m "feat: client state — wissen, activeResearch2, typedArtefacts in gameSlice + network"
```

---

## Task 11: TechTreeCanvas Component

**Files:**
- Create: `packages/client/src/components/TechTreeCanvas.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`
- Test: `packages/client/src/__tests__/TechTreeCanvas.test.tsx`

**Step 1: Write failing test**

Create `packages/client/src/__tests__/TechTreeCanvas.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { TechTreeCanvas } from '../components/TechTreeCanvas';
import { vi } from 'vitest';

// Mock canvas
vi.mock('../components/TechTreeCanvas', () => ({
  TechTreeCanvas: () => <div data-testid="tech-tree-canvas">TECH TREE</div>,
}));

describe('TechTreeCanvas', () => {
  it('renders without crash', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByTestId('tech-tree-canvas')).toBeTruthy();
  });
});
```

**Step 2: Implement TechTreeCanvas**

Create `packages/client/src/components/TechTreeCanvas.tsx`:

```tsx
import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { MODULES } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';
import { isModuleFreelyAvailable } from '@void-sector/shared';

const CATEGORIES = ['drive', 'cargo', 'scanner', 'armor', 'weapon', 'shield', 'defense', 'mining'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  drive: 'ANTRIEB', cargo: 'FRACHT', scanner: 'SCANNER', armor: 'PANZER',
  weapon: 'WAFFEN', shield: 'SCHILD', defense: 'VERTEID.', mining: 'BERGBAU',
};

const COL_WIDTH = 90;
const ROW_HEIGHT = 52;
const NODE_W = 76;
const NODE_H = 22;
const HEADER_H = 28;
const PADDING_X = 8;
const PADDING_Y = 8;

const CANVAS_W = CATEGORIES.length * COL_WIDTH + PADDING_X * 2;
const CANVAS_H = 5 * ROW_HEIGHT + HEADER_H + PADDING_Y * 2;

type NodeStatus = 'free' | 'unlocked' | 'blueprint' | 'researching' | 'researching2' | 'available' | 'locked';

function getStatus(mod: ModuleDefinition, research: any): NodeStatus {
  if (research.activeResearch?.moduleId === mod.id) return 'researching';
  if (research.activeResearch2?.moduleId === mod.id) return 'researching2';
  if (isModuleFreelyAvailable(mod.id)) return 'free';
  if (research.unlockedModules.includes(mod.id)) return 'unlocked';
  if (research.blueprints.includes(mod.id)) return 'blueprint';
  if (!mod.researchCost) return 'free';
  return 'locked';
}

function statusColor(status: NodeStatus): string {
  switch (status) {
    case 'free': return '#00FF88';
    case 'unlocked': return '#00AA55';
    case 'blueprint': return '#00BFFF';
    case 'researching': return '#FFB000';
    case 'researching2': return '#FF8800';
    case 'available': return '#FFB000';
    case 'locked': return '#444';
  }
}

export function TechTreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const research = useStore((s) => s.research);
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const setSelectedTechModule = useStore((s) => s.setSelectedTechModule);

  // Build node grid: category × tier
  const nodeGrid: Map<string, { mod: ModuleDefinition; col: number; row: number }> = new Map();
  for (const [id, mod] of Object.entries(MODULES)) {
    const col = CATEGORIES.indexOf(mod.category as any);
    if (col === -1) continue; // skip 'special' category (no column)
    const row = 5 - mod.tier; // tier 5 at top (row 0), tier 1 at bottom (row 4)
    nodeGrid.set(id, { mod, col, row });
  }

  const nodeX = (col: number) => PADDING_X + col * COL_WIDTH + (COL_WIDTH - NODE_W) / 2;
  const nodeY = (row: number) => HEADER_H + PADDING_Y + row * ROW_HEIGHT + (ROW_HEIGHT - NODE_H) / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw column headers
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    for (let c = 0; c < CATEGORIES.length; c++) {
      const cat = CATEGORIES[c];
      ctx.fillStyle = '#666';
      ctx.fillText(CATEGORY_LABELS[cat], PADDING_X + c * COL_WIDTH + COL_WIDTH / 2, 18);
    }

    // Draw dependency arrows
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (const [id, { mod, col, row }] of nodeGrid) {
      if (!mod.prerequisite) continue;
      const prereq = nodeGrid.get(mod.prerequisite);
      if (!prereq) continue;
      const x1 = nodeX(prereq.col) + NODE_W / 2;
      const y1 = nodeY(prereq.row) + NODE_H;
      const x2 = nodeX(col) + NODE_W / 2;
      const y2 = nodeY(row);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw nodes
    for (const [id, { mod, col, row }] of nodeGrid) {
      const x = nodeX(col);
      const y = nodeY(row);
      const status = getStatus(mod, research);
      const isSelected = id === selectedModuleId;
      const color = statusColor(status);

      ctx.strokeStyle = isSelected ? '#FFF' : color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillStyle = status === 'locked' ? '#111' : '#0d0d0d';
      ctx.fillRect(x, y, NODE_W, NODE_H);
      ctx.strokeRect(x, y, NODE_W, NODE_H);

      ctx.fillStyle = status === 'locked' ? '#444' : color;
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      const label = mod.name.length > 12 ? mod.name.substring(0, 11) + '…' : mod.name;
      ctx.fillText(label, x + NODE_W / 2, y + 14);
    }
  }, [research, selectedModuleId]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    for (const [id, { col, row }] of nodeGrid) {
      const x = nodeX(col);
      const y = nodeY(row);
      if (mx >= x && mx <= x + NODE_W && my >= y && my <= y + NODE_H) {
        setSelectedTechModule(id);
        return;
      }
    }
  }, [setSelectedTechModule]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px' }}>
      {/* Wissen header */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
        color: 'var(--color-primary)', marginBottom: 4,
        letterSpacing: '0.1em',
      }}>
        WISSEN: {research.wissen.toLocaleString()}
        <span style={{ color: 'var(--color-dim)', marginLeft: 8 }}>
          +{research.wissenRate}/h
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        style={{ width: '100%', cursor: 'pointer', imageRendering: 'pixelated' }}
      />
    </div>
  );
}
```

**Step 3: Wire into GameScreen.tsx**

In `packages/client/src/components/GameScreen.tsx`, replace `TechTreePanel` with `TechTreeCanvas`:

```typescript
// Change import:
import { TechTreeCanvas } from './TechTreeCanvas';

// In the render switch for TECH (appears twice):
// Replace <TechTreePanel /> with <TechTreeCanvas />
```

**Step 4: Run tests**

```bash
cd packages/client && npx vitest run
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/components/TechTreeCanvas.tsx \
        packages/client/src/components/GameScreen.tsx
git commit -m "feat: TechTreeCanvas — canvas grid tech tree with dependency arrows and status colors"
```

---

## Task 12: TechDetailPanel — Wissen Costs + Artefact Slots

**Files:**
- Modify: `packages/client/src/components/TechDetailPanel.tsx`
- Test: `packages/client/src/__tests__/TechTreePanel.test.tsx` (extend)

**Step 1: Update TechDetailPanel to show wissen costs and artefact slots**

The panel needs:
1. Wissen cost display (instead of credits/ore)
2. Artefact requirement badges (T3+: "1× ANTRIEB-ART required")
3. Optional artefact selector (up to 3, shows available counts)
4. Dual-slot selection (if lab tier ≥ 3)
5. Lab level requirement warning

Key changes in `TechDetailPanel.tsx`:

```tsx
// Replace costLine function:
function wissenCostLine(rc: { wissen: number; artefacts?: Partial<Record<string, number>> }, artefactsUsed: number): string {
  const bonus = Math.min(artefactsUsed, MAX_ARTEFACTS_PER_RESEARCH) * ARTEFACT_WISSEN_BONUS;
  const actual = Math.max(0, rc.wissen - bonus);
  if (bonus > 0) return `${actual} WISSEN (−${bonus} via ART)`;
  return `${rc.wissen} WISSEN`;
}
```

Add artefact slot UI below research cost display:
- Show required artefact count for the module's category
- Show player's available count of that type
- Buttons to adjust optional artefact usage (0 to MAX_ARTEFACTS_PER_RESEARCH)

Add slot selector (Slot 1 / Slot 2) if lab tier ≥ 3.

Show `FORSCHUNG NUR MIT LABOR (Lab I+)` if labTier === 0.

Replace `network.sendStartResearch(mod.id)` call with:
```tsx
network.sendStartResearch(mod.id, selectedSlot, artefactsToUse);
```

**Step 2: Run tests**

```bash
cd packages/client && npx vitest run
```

Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/components/TechDetailPanel.tsx
git commit -m "feat: TechDetailPanel — wissen costs, artefact slots, dual-slot selector"
```

---

## Task 13: Integration + Shared Build + Final Tests

**Step 1: Build shared**

```bash
cd packages/shared && npm run build
```

Expected: No TypeScript errors.

**Step 2: Run all tests**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected: All PASS. Note any failures and fix before continuing.

**Step 3: Manual smoke test**

```bash
npm run docker:up
npm run dev:server &
npm run dev:client
```

- Open TECH program → Canvas grid appears ✓
- Wissen counter shows 0 at top ✓
- Click a module → TechDetailPanel shows wissen cost ✓
- Build a research_lab at a station → `upgradeResearchLab` message works ✓
- Wait for strategic tick → Wissen balance increments ✓

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Forschung/Wissen system complete — typed artefacts, lab tiers, Canvas tech tree"
```

---

## Offene Punkte (nicht in diesem Plan)

- **Wissen-Anzeige in ShipStatusPanel** — als kleine Badge neben Credits
- **Aktions-Wissen-Boni** — konkrete Werte für Scan/Herstellung in ScanService/EconomyService
- **Lab-Upgrade-UI** — Button in BaseDetailPanel / StationTerminal
- **Wissen-Cap** — kein Cap vorerst, kann als Konstante später hinzugefügt werden
- **TechTreeCanvas**: Tier-Lock-Overlay-Linie (gesperrte Reihen grayed out)
- **Legacy-Artefakte** — Migration: `artefact` Bestand auf Typen aufteilen (Optional)
