# Sector Types Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split flat `SectorType` into `SectorEnvironment` (physics) + `SectorContent[]` (features), add black holes as impassable environment, update worldgen, server, and client.

**Architecture:** Add `environment` and `contents` fields to `SectorData` alongside legacy `type` for backward compat. Existing worldgen stays deterministic — environment/contents are derived from the old type. Black holes are a new pre-check in worldgen. Server handlers use `environment` for physics checks (jump blocking). Radar shows environment as base color/symbol, with black hole rendering.

**Tech Stack:** TypeScript, Vitest, Zustand, Colyseus, PostgreSQL, Canvas2D

**Design Doc:** `docs/plans/2026-03-04-issue68-sektor-typen.md`

---

### Task 1: Shared Types — Environment, Content, Derivation

**Files:**
- Modify: `packages/shared/src/types.ts:1-25`
- Create: `packages/shared/src/__tests__/sectorTypes.test.ts`

**Step 1: Add new types after SectorType (line 1)**

In `packages/shared/src/types.ts`, after line 1 (`export type SectorType = ...`), add:
```typescript
export type SectorEnvironment = 'empty' | 'nebula' | 'black_hole';
export type SectorContent =
  | 'asteroid_field'
  | 'station'
  | 'anomaly'
  | 'pirate_zone'
  | 'home_base'
  | 'player_base';
```

**Step 2: Extend SectorData interface (lines 16-25)**

Replace the `SectorData` interface with:
```typescript
export interface SectorData {
  x: number;
  y: number;
  type: SectorType;
  environment: SectorEnvironment;
  contents: SectorContent[];
  seed: number;
  discoveredBy: string | null;
  discoveredAt: string | null;
  metadata: Record<string, unknown>;
  resources?: SectorResources;
}
```

**Step 3: Add derivation utility functions**

After the `SectorData` interface, add:
```typescript
/** Derive legacy SectorType from environment + contents (for backward compat) */
export function legacySectorType(env: SectorEnvironment, contents: SectorContent[]): SectorType {
  if (contents.includes('pirate_zone') && contents.includes('asteroid_field')) return 'pirate';
  if (contents.includes('station')) return 'station';
  if (contents.includes('anomaly')) return 'anomaly';
  if (contents.includes('asteroid_field')) return 'asteroid_field';
  if (contents.includes('pirate_zone')) return 'pirate';
  if (env === 'nebula') return 'nebula';
  return 'empty';
}

/** Derive environment from legacy SectorType */
export function deriveEnvironment(type: SectorType): SectorEnvironment {
  return type === 'nebula' ? 'nebula' : 'empty';
}

/** Derive contents from legacy SectorType */
export function deriveContents(type: SectorType): SectorContent[] {
  switch (type) {
    case 'asteroid_field': return ['asteroid_field'];
    case 'station': return ['station'];
    case 'anomaly': return ['anomaly'];
    case 'pirate': return ['pirate_zone', 'asteroid_field'];
    default: return [];
  }
}
```

**Step 4: Write tests**

Create `packages/shared/src/__tests__/sectorTypes.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { legacySectorType, deriveEnvironment, deriveContents } from '../types';

describe('legacySectorType', () => {
  it('returns empty for empty env with no contents', () => {
    expect(legacySectorType('empty', [])).toBe('empty');
  });
  it('returns nebula for nebula env with no contents', () => {
    expect(legacySectorType('nebula', [])).toBe('nebula');
  });
  it('returns empty for black_hole (no legacy equivalent)', () => {
    expect(legacySectorType('black_hole', [])).toBe('empty');
  });
  it('returns station when contents include station', () => {
    expect(legacySectorType('empty', ['station'])).toBe('station');
  });
  it('returns station even in nebula env', () => {
    expect(legacySectorType('nebula', ['station'])).toBe('station');
  });
  it('returns asteroid_field for asteroid content', () => {
    expect(legacySectorType('empty', ['asteroid_field'])).toBe('asteroid_field');
  });
  it('returns pirate for pirate_zone + asteroid_field', () => {
    expect(legacySectorType('empty', ['pirate_zone', 'asteroid_field'])).toBe('pirate');
  });
  it('returns pirate for pirate_zone alone', () => {
    expect(legacySectorType('empty', ['pirate_zone'])).toBe('pirate');
  });
  it('returns anomaly for anomaly content', () => {
    expect(legacySectorType('empty', ['anomaly'])).toBe('anomaly');
  });
  it('station takes priority over asteroid_field', () => {
    expect(legacySectorType('empty', ['asteroid_field', 'station'])).toBe('station');
  });
});

describe('deriveEnvironment', () => {
  it('returns nebula for nebula type', () => {
    expect(deriveEnvironment('nebula')).toBe('nebula');
  });
  it('returns empty for all other types', () => {
    expect(deriveEnvironment('empty')).toBe('empty');
    expect(deriveEnvironment('station')).toBe('empty');
    expect(deriveEnvironment('asteroid_field')).toBe('empty');
    expect(deriveEnvironment('pirate')).toBe('empty');
    expect(deriveEnvironment('anomaly')).toBe('empty');
  });
});

describe('deriveContents', () => {
  it('returns empty array for empty/nebula', () => {
    expect(deriveContents('empty')).toEqual([]);
    expect(deriveContents('nebula')).toEqual([]);
  });
  it('returns asteroid_field for asteroid_field', () => {
    expect(deriveContents('asteroid_field')).toEqual(['asteroid_field']);
  });
  it('returns station for station', () => {
    expect(deriveContents('station')).toEqual(['station']);
  });
  it('returns pirate_zone + asteroid_field for pirate', () => {
    expect(deriveContents('pirate')).toEqual(['pirate_zone', 'asteroid_field']);
  });
  it('returns anomaly for anomaly', () => {
    expect(deriveContents('anomaly')).toEqual(['anomaly']);
  });
});
```

**Step 5: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All pass (existing + new sectorTypes tests)

Note: Adding `environment` and `contents` to `SectorData` will cause TypeScript errors in files that construct `SectorData` objects without these fields. This is expected — they will be fixed in subsequent tasks. Tests should still pass because Vitest doesn't enforce strict types at runtime.

**Step 6: Commit**

```
feat: add SectorEnvironment, SectorContent types with derivation utils (#68)
```

---

### Task 2: Shared Constants — Environment & Content

**Files:**
- Modify: `packages/shared/src/constants.ts:453-498`

**Step 1: Add environment/content constants**

After the `NEBULA_SAFE_ORIGIN` constant (line 474), add:
```typescript
// Black hole generation
export const BLACK_HOLE_SPAWN_CHANCE = 0.005;    // 0.5% of sectors far from origin
export const BLACK_HOLE_MIN_DISTANCE = 50;        // minimum Chebyshev distance from origin

// Environment modifiers (used by future AP/fuel systems)
export const NEBULA_SCANNER_MALUS = 1;            // −1 sector scan range in nebula
export const NEBULA_PIRATE_SPAWN_MODIFIER = 0.7;  // −30% pirate spawn in nebula
export const EMPTY_FUEL_MODIFIER = 0.8;           // −20% fuel cost in empty space
```

**Step 2: Add environment-keyed color and symbol maps**

After the existing `SYMBOLS` constant (line 498), add:
```typescript
import type { SectorEnvironment, SectorContent } from './types.js';

// Environment-specific radar colors (for new rendering path)
export const ENVIRONMENT_COLORS: Record<SectorEnvironment, string> = {
  empty: '#FFB000',
  nebula: '#00BFFF',
  black_hole: '#1A1A1A',
};

// Environment-specific radar symbols
export const ENVIRONMENT_SYMBOLS: Record<SectorEnvironment, string> = {
  empty: '\u00B7',     // ·
  nebula: '\u2592',    // ▒
  black_hole: 'o',
};

// Content overlay symbols for radar
export const CONTENT_SYMBOLS: Partial<Record<SectorContent, string>> = {
  asteroid_field: '\u25C6', // ◆
  station: 'S',
  home_base: 'H',
  player_base: 'B',
  anomaly: '\u25CA',        // ◊
  pirate_zone: '\u2620',    // ☠
};

// Content overlay colors
export const CONTENT_COLORS: Partial<Record<SectorContent, string>> = {
  asteroid_field: '#FF8C00',
  station: '#00FF88',
  anomaly: '#FF00FF',
  pirate_zone: '#FF3333',
  home_base: '#FFFFFF',
  player_base: '#FFFFFF',
};
```

Note: The `import type` for `SectorEnvironment` and `SectorContent` should be added to the existing import at line 1 of constants.ts.

**Step 3: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All pass

**Step 4: Commit**

```
feat: add environment/content constants — black hole, radar maps (#68)
```

---

### Task 3: DB Migration 016 + Query Updates

**Files:**
- Create: `packages/server/src/db/migrations/016_sector_environment.sql`
- Modify: `packages/server/src/db/queries.ts:236-282,1380-1399`

**Step 1: Create migration**

Create `packages/server/src/db/migrations/016_sector_environment.sql`:
```sql
-- Add environment and contents columns to sectors table
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'empty';
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS contents TEXT[] DEFAULT '{}';

-- Backfill from legacy type
UPDATE sectors SET environment = 'nebula' WHERE type = 'nebula' AND environment = 'empty';
UPDATE sectors SET contents = ARRAY['asteroid_field'] WHERE type = 'asteroid_field' AND contents = '{}';
UPDATE sectors SET contents = ARRAY['station'] WHERE type = 'station' AND contents = '{}';
UPDATE sectors SET contents = ARRAY['anomaly'] WHERE type = 'anomaly' AND contents = '{}';
UPDATE sectors SET contents = ARRAY['pirate_zone', 'asteroid_field'] WHERE type = 'pirate' AND contents = '{}';

-- Index for environment filtering
CREATE INDEX IF NOT EXISTS idx_sectors_environment ON sectors(environment);
```

**Step 2: Update getSector (lines 236-266)**

Add `environment` and `contents` to the query and return:

Update the SELECT (line 249):
```sql
SELECT x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents FROM sectors WHERE x = $1 AND y = $2
```

Update the type annotation to include:
```typescript
    environment: string;
    contents: string[];
```

Update the return object (after line 263) to include:
```typescript
    environment: (row.environment ?? 'empty') as SectorData['environment'],
    contents: (row.contents ?? []) as SectorData['contents'],
```

**Step 3: Update saveSector (lines 268-282)**

Update the INSERT to include environment and contents:
```sql
INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents)
VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
ON CONFLICT (x, y) DO NOTHING
```

Add parameters:
```typescript
    [
      sector.x,
      sector.y,
      sector.type,
      sector.seed,
      sector.discoveredBy,
      JSON.stringify({ resources: sector.resources || { ore: 0, gas: 0, crystal: 0 } }),
      sector.environment ?? 'empty',
      sector.contents ?? [],
    ]
```

**Step 4: Update getSectorsInRange (lines 1380-1399)**

Add `environment, contents` to the SELECT and return mapping:
```typescript
    environment: (r.environment ?? 'empty') as SectorData['environment'],
    contents: (r.contents ?? []) as SectorData['contents'],
```

**Step 5: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 6: Commit**

```
feat: DB migration 016 — environment/contents columns with backfill (#68)
```

---

### Task 4: World Generation — Black Holes + Environment/Contents

**Files:**
- Modify: `packages/server/src/engine/worldgen.ts:1-2,90-118`
- Modify: `packages/server/src/engine/__tests__/worldgen.test.ts` (create if doesn't exist)

**Step 1: Update imports**

In `packages/server/src/engine/worldgen.ts`, update line 1-2 imports:

Add `BLACK_HOLE_SPAWN_CHANCE, BLACK_HOLE_MIN_DISTANCE` to the constants import.
Add `SectorEnvironment, SectorContent, deriveEnvironment, deriveContents` to the types import.

**Step 2: Update generateSector (lines 90-118)**

Replace the function with:
```typescript
export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);
  const distFromOrigin = Math.max(Math.abs(x), Math.abs(y));

  // Black hole check — rare, only far from origin
  if (distFromOrigin > BLACK_HOLE_MIN_DISTANCE) {
    const bhRoll = ((seed >>> 0) & 0xFF) / 255;
    if (bhRoll < BLACK_HOLE_SPAWN_CHANCE) {
      return {
        x, y, seed,
        environment: 'black_hole',
        contents: [],
        type: 'empty',
        discoveredBy,
        discoveredAt: null,
        metadata: {},
        resources: { ore: 0, gas: 0, crystal: 0 },
      };
    }
  }

  // Legacy type generation (preserved for determinism)
  const type = isInNebulaZone(x, y) ? 'nebula' : sectorTypeFromSeed(seed);

  // Derive environment and contents from legacy type
  const environment = deriveEnvironment(type);
  const contents = deriveContents(type);

  // Special metadata: some stations are ancient variants
  const metadata: Record<string, unknown> = {};
  if (type === 'station') {
    const secondaryRoll = hashSecondary(seed);
    if (secondaryRoll < ANCIENT_STATION_CHANCE) {
      metadata.stationVariant = 'ancient';
    }
  }

  return {
    x, y, seed,
    environment,
    contents,
    type,
    resources: generateResources(type, seed),
    discoveredBy,
    discoveredAt: null,
    metadata,
  };
}
```

**Step 3: Write worldgen tests**

Create or extend `packages/server/src/engine/__tests__/worldgen.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords, isInNebulaZone } from '../worldgen.js';

describe('generateSector', () => {
  it('returns environment and contents fields', () => {
    const sector = generateSector(0, 0, 'test-user');
    expect(sector.environment).toBeDefined();
    expect(sector.contents).toBeDefined();
    expect(Array.isArray(sector.contents)).toBe(true);
  });

  it('derives legacy type that matches environment/contents', () => {
    // Test several coords
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const sector = generateSector(x, y, null);
        expect(['empty', 'nebula', 'asteroid_field', 'station', 'anomaly', 'pirate']).toContain(sector.type);
        // environment should be nebula or empty (no black holes near origin)
        expect(['empty', 'nebula']).toContain(sector.environment);
      }
    }
  });

  it('never generates black holes within BLACK_HOLE_MIN_DISTANCE', () => {
    for (let x = -49; x <= 49; x += 7) {
      for (let y = -49; y <= 49; y += 7) {
        const sector = generateSector(x, y, null);
        expect(sector.environment).not.toBe('black_hole');
      }
    }
  });

  it('generates some black holes far from origin', () => {
    let found = false;
    for (let x = 100; x < 1000 && !found; x++) {
      for (let y = 100; y < 200 && !found; y++) {
        const sector = generateSector(x, y, null);
        if (sector.environment === 'black_hole') {
          expect(sector.contents).toEqual([]);
          expect(sector.resources).toEqual({ ore: 0, gas: 0, crystal: 0 });
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('nebula sectors have environment nebula', () => {
    // Find a nebula sector
    let found = false;
    for (let x = -10; x <= 10 && !found; x++) {
      for (let y = -10; y <= 10 && !found; y++) {
        const sector = generateSector(x, y, null);
        if (sector.type === 'nebula') {
          expect(sector.environment).toBe('nebula');
          expect(sector.contents).toEqual([]);
          found = true;
        }
      }
    }
    // Nebula may not appear near origin, skip assertion if not found
  });

  it('station sectors have station in contents', () => {
    let found = false;
    for (let x = -20; x <= 20 && !found; x++) {
      for (let y = -20; y <= 20 && !found; y++) {
        const sector = generateSector(x, y, null);
        if (sector.type === 'station') {
          expect(sector.environment).toBe('empty');
          expect(sector.contents).toContain('station');
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });
});
```

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 5: Commit**

```
feat: worldgen — black holes + environment/contents derivation (#68)
```

---

### Task 5: Server Handlers — Jump Blocking & Environment Checks

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts:731-893`

**Step 1: Add black hole blocking to handleJump**

In `handleJump` (line 731), after the target sector is loaded/generated (line 779), add before the discovery recording (line 782):
```typescript
    // Block entry to black holes
    if (targetSector.environment === 'black_hole') {
      client.send('jumpResult', {
        success: false,
        error: 'BLACK_HOLE_BLOCKED',
        message: 'Schwarzes Loch erkannt — Sprung abgebrochen',
      });
      // Refund AP and fuel
      await saveAPState(auth.userId, ap);
      await saveFuelState(auth.userId, currentFuel);
      return;
    }
```

**Step 2: Add black hole blocking to handleHyperJump**

In `handleHyperJump` (line 838), after the nebula check for target (line 893), add:
```typescript
    // Black holes block hyperjump in both directions
    if (sourceSector?.environment === 'black_hole') {
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Black hole gravity prevents hyperjump' });
      return;
    }
    if (targetSectorNebula?.environment === 'black_hole') {
      client.send('error', { code: 'HYPERJUMP_FAIL', message: 'Cannot hyperjump to black hole sector' });
      return;
    }
```

**Step 3: Update nebula checks to use environment**

In `handleHyperJump`, update the existing nebula checks (lines 885, 890) to use `environment` instead of `type`:
```typescript
    if (sourceSector?.environment === 'nebula') {
      // ... existing error message
    }
    if (targetSectorNebula?.environment === 'nebula') {
      // ... existing error message
    }
```

This is functionally equivalent for now (since environment='nebula' ↔ type='nebula'), but future-proofs for combined-content sectors.

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 5: Commit**

```
feat: server — block jumps to black holes, use environment for nebula checks (#68)
```

---

### Task 6: Client — Radar, DetailPanel, State Updates

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts:200-214,369-391`
- Modify: `packages/client/src/components/DetailPanel.tsx:99-133`
- Modify: `packages/client/src/network/client.ts` (sector data mapping)
- Modify: `packages/client/src/test/mockStore.ts` (add environment/contents to mocks)

**Step 1: Update RadarRenderer — black hole support**

In `packages/client/src/canvas/RadarRenderer.ts`, update `getSectorSymbol` (line 369) to add black_hole case:
```typescript
function getSectorSymbol(type: string, environment?: string): string {
  if (environment === 'black_hole') return 'o';
  switch (type) {
    case 'asteroid_field': return SYMBOLS.asteroid_field;
    case 'nebula': return SYMBOLS.nebula;
    case 'station': return SYMBOLS.station;
    case 'anomaly': return SYMBOLS.anomaly;
    case 'pirate': return SYMBOLS.pirate;
    case 'empty':
    default: return SYMBOLS.empty;
  }
}
```

Update `getSectorLabel` (line 381):
```typescript
function getSectorLabel(type: string, environment?: string): string {
  if (environment === 'black_hole') return 'BLACK HOLE';
  switch (type) {
    case 'asteroid_field': return 'ASTEROID';
    case 'nebula': return 'NEBULA';
    case 'station': return 'STATION';
    case 'anomaly': return 'ANOMALY';
    case 'pirate': return 'PIRATE';
    case 'empty': return 'EMPTY';
    default: return type.toUpperCase();
  }
}
```

Update the render call sites (lines 201, 213) to pass `sector.environment`:
```typescript
const symbol = isHome ? SYMBOLS.homeBase : getSectorSymbol(sector.type, (sector as any).environment);
```
```typescript
const label = isHome ? 'HOME' : getSectorLabel(sector.type, (sector as any).environment);
```

Update the color resolution (lines 202-204) to handle black_hole:
```typescript
const sectorColor = isHome
  ? SECTOR_COLORS.home_base
  : (sector as any).environment === 'black_hole'
    ? '#1A1A1A'
    : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty;
```

**Step 2: Update DetailPanel sector display**

In `packages/client/src/components/DetailPanel.tsx`, update the TYPE display (lines 117-133).

After the existing TYPE line, add an environment display when it's a black hole:
```typescript
          {(sector as any).environment === 'black_hole' && (
            <div style={{ color: '#FF3333', marginTop: 4, fontSize: '0.7rem' }}>
              ⚠ SCHWARZES LOCH — UNPASSIERBAR
            </div>
          )}
```

**Step 3: Update client network mapping**

In `packages/client/src/network/client.ts`, wherever sector data messages are received and mapped to SectorData, ensure `environment` and `contents` are preserved. Find the sector data mapping in message handlers (search for `type: msg.type` or similar sector construction) and add:
```typescript
environment: msg.environment ?? 'empty',
contents: msg.contents ?? [],
```

If the client constructs SectorData objects with only partial fields (like in `handleJumpResult` or `handleScanResult`), add default `environment: 'empty'` and `contents: []` to satisfy the type.

**Step 4: Update mockStore**

In `packages/client/src/test/mockStore.ts`, add `environment: 'empty'` and `contents: []` to any mock SectorData objects (like `currentSector`).

**Step 5: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All pass

**Step 6: Commit**

```
feat: client — black hole rendering, environment display, state updates (#68)
```

---

### Task 7: Fix TypeScript Errors & Final Verification

**Files:**
- Any files with TypeScript errors from adding `environment`/`contents` to `SectorData`

**Step 1: Fix all SectorData construction sites**

After adding `environment` and `contents` to the `SectorData` interface, some files may construct `SectorData` objects without these fields. Search the codebase for places that create `SectorData` literals and add the missing fields.

Common places to fix:
- `packages/client/src/network/client.ts` — message handlers constructing SectorData
- Test files constructing mock SectorData
- Any server code building SectorData manually (besides worldgen)

For each, add:
```typescript
environment: 'empty',
contents: [],
```

**Step 2: Run all tests**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```
Expected: All pass

**Step 3: TypeScript check**

```bash
cd /home/manuel/claude/voidSector
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/client/tsconfig.json
```

Fix any new errors introduced by our changes (pre-existing errors are OK).

**Step 4: Commit**

```
fix: TypeScript fixes for sector environment/contents (#68)
```

---

### Summary

| Task | Files | Scope |
|------|-------|-------|
| 1 | shared/types.ts, shared tests | New types + derivation utils |
| 2 | shared/constants.ts | Environment/content constants |
| 3 | migration 016, db/queries.ts | DB schema + query updates |
| 4 | worldgen.ts, worldgen tests | Black holes + env/contents generation |
| 5 | SectorRoom.ts | Jump blocking for black holes |
| 6 | RadarRenderer, DetailPanel, network | Client rendering + state |
| 7 | Various | TypeScript fixes, final verification |
