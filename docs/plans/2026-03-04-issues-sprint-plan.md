# Issues Sprint Implementation Plan (#108, #110, #111, #112, #113, #114, #115)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix 7 open issues: layout sizing, distress frequency, radar trail, worldgen/reseed with resource regeneration, artwork display, and comm redesign.

**Architecture:** Additive changes on existing patterns. CSS grid tweaks, constant tuning, new Canvas rendering, DB migration 028, new React components. All blocks independent.

**Tech Stack:** TypeScript, React 18, Canvas 2D, Zustand, Colyseus, PostgreSQL, Vitest

---

## Task 1: Layout Quick-Fixes (#110 left side too narrow, #111 top/bottom 60:40)

**Files:**
- Modify: `packages/client/src/styles/crt.css:1349-1350`
- Test: `packages/client/src/__tests__/CockpitLayout.test.tsx` (if exists, otherwise visual)

**Changes:**

In `packages/client/src/styles/crt.css`, line 1349:
```css
/* BEFORE */
grid-template-columns: 120px 1fr 1fr;
grid-template-rows: 1fr 1fr;

/* AFTER */
grid-template-columns: 160px 1fr 1fr;
grid-template-rows: 3fr 2fr;
```

That's the entire change. `160px` gives the program selector more room. `3fr 2fr` = 60:40 vertical split.

**Verify:** `cd packages/client && npx vitest run` — all tests pass.

**Commit:** `fix: widen program selector to 160px and set 60:40 row split (#110, #111)`

---

## Task 2: Reduce Distress Call Frequency (#108)

**Files:**
- Modify: `packages/shared/src/constants.ts:1168` — DISTRESS_CALL_CHANCE
- Modify: `packages/server/src/engine/scanEvents.ts:17` — distress_signal weight
- Test: `packages/server/src/engine/__tests__/scanEvents.test.ts`

**Changes:**

In `packages/shared/src/constants.ts`, line 1168:
```typescript
// BEFORE
export const DISTRESS_CALL_CHANCE = 0.08;
// AFTER
export const DISTRESS_CALL_CHANCE = 0.005;
```

In `packages/server/src/engine/scanEvents.ts`, line 17:
```typescript
// BEFORE
{ type: 'distress_signal', weight: 0.30, immediate: false },
// AFTER
{ type: 'distress_signal', weight: 0.05, immediate: false },
```

Rebalance remaining weights to sum ~1.0. Increase others proportionally:
```typescript
const EVENT_TYPE_WEIGHTS: { type: ScanEventType; weight: number; immediate: boolean }[] = [
  { type: 'pirate_ambush', weight: 0.40, immediate: true },
  { type: 'distress_signal', weight: 0.05, immediate: false },
  { type: 'anomaly_reading', weight: 0.30, immediate: false },
  { type: 'artifact_find', weight: 0.15, immediate: false },
  { type: 'blueprint_find', weight: 0.10, immediate: false },
];
```

**Test:** Update any tests that assert on these specific weight values. The `checkDistressCall` function in rescue.ts uses DISTRESS_CALL_CHANCE directly so it auto-adjusts.

**Verify:** `cd packages/shared && npx vitest run && cd ../server && npx vitest run`

**Commit:** `fix: reduce distress call frequency to ~0.5% and rebalance scan events (#108)`

---

## Task 3: Radar Trail System (#112)

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts` — add `visitedTrail` state + updater
- Modify: `packages/client/src/canvas/RadarRenderer.ts` — draw trail + simplify empty sectors
- Test: `packages/client/src/__tests__/radarTrail.test.ts` (new)

### Step 1: Add trail state to gameSlice

In `packages/client/src/state/gameSlice.ts`, add to the `GameSlice` interface (after `position: Coords;` around line 58):
```typescript
  // Radar trail (last 9 visited sectors)
  visitedTrail: Coords[];
```

Add initial value in the store creation (where `position` is initialized):
```typescript
  visitedTrail: [],
```

Add updater — find the `setPosition` action. Wherever `setPosition` updates `position`, also update the trail:
```typescript
  pushTrail: (pos: Coords) => {
    const trail = get().visitedTrail;
    // Don't add duplicate of last position
    if (trail.length > 0 && trail[0].x === pos.x && trail[0].y === pos.y) return;
    set({ visitedTrail: [pos, ...trail].slice(0, 9) });
  },
```

Call `pushTrail` from the existing `setPosition` action — when position changes, push old position to trail:
```typescript
  setPosition: (pos: Coords) => {
    const old = get().position;
    if (old.x !== pos.x || old.y !== pos.y) {
      get().pushTrail(old);
    }
    set({ position: pos });
  },
```

### Step 2: Draw trail on radar

In `packages/client/src/canvas/RadarRenderer.ts`, add to the `RadarState` interface (around line 41-61):
```typescript
  visitedTrail?: Coords[];
```

In the `drawRadar` function, **after** the main cell loop ends (after the `}` closing the `for dy` and `for dx` loops, around line 300) and **before** the frame drawing, add trail rendering:

```typescript
  // === Trail line ===
  if (state.visitedTrail && state.visitedTrail.length > 0) {
    const trail = state.visitedTrail;
    // Start from player position
    let prevScreenX = gridCenterX + (state.position.x - viewX) * CELL_W;
    let prevScreenY = gridCenterY + (state.position.y - viewY) * CELL_H;

    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const screenX = gridCenterX + (t.x - viewX) * CELL_W;
      const screenY = gridCenterY + (t.y - viewY) * CELL_H;

      // Only draw if both points are within visible grid
      const inBoundsX = Math.abs(t.x - viewX) <= radiusX;
      const inBoundsY = Math.abs(t.y - viewY) <= radiusY;
      if (!inBoundsX || !inBoundsY) {
        prevScreenX = screenX;
        prevScreenY = screenY;
        continue;
      }

      const opacity = 0.8 - (i / trail.length) * 0.7; // 0.8 → 0.1
      ctx.strokeStyle = state.themeColor;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(prevScreenX, prevScreenY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();

      // Small dot at trail position
      ctx.fillStyle = state.themeColor;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      prevScreenX = screenX;
      prevScreenY = screenY;
    }
  }
```

### Step 3: Simplify empty discovered sectors

In the cell rendering loop (around line 218-243 of RadarRenderer.ts), change the `else if (sector)` block. When `sector.type === 'empty'`, only draw a centered dot — no "EMPTY" label:

Find this code (line 218):
```typescript
      } else if (sector) {
```

Replace the sector rendering block with:
```typescript
      } else if (sector) {
        if (sector.type === 'empty' && (sector as any).environment !== 'black_hole') {
          // Empty sectors: just a small centered dot
          ctx.fillStyle = state.dimColor.replace(/[\d.]+\)$/, '0.3)');
          ctx.beginPath();
          ctx.arc(cellX, cellY, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const symbol = isHome ? SYMBOLS.homeBase : getSectorSymbol(sector.type, (sector as any).environment);
          const sectorColor = isHome
            ? SECTOR_COLORS.home_base
            : (sector as any).environment === 'black_hole'
              ? '#1A1A1A'
              : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty;
          ctx.fillStyle = sectorColor;
          ctx.shadowBlur = 0;
          ctx.fillText(symbol, cellX, cellY);

          if (state.zoomLevel >= 1) {
            ctx.font = COORD_FONT;
            ctx.fillStyle = sectorColor;
            ctx.textBaseline = 'bottom';
            const label = isHome ? 'HOME' : getSectorLabel(sector.type, (sector as any).environment);
            ctx.fillText(label, cellX, cellY + CELL_H / 2 - 2);
          }
        }
```

### Step 4: Wire trail in RadarCanvas/useCanvas

Find where `drawRadar` is called (likely in `RadarCanvas.tsx` or `useCanvas.ts`) and add `visitedTrail` to the state passed to it:
```typescript
visitedTrail: useStore.getState().visitedTrail,
```

### Step 5: Write test

Create `packages/client/src/__tests__/radarTrail.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useStore } from '../state/store';
import { mockStoreState } from '../test/mockStore';

describe('visitedTrail', () => {
  it('pushes old position to trail on setPosition', () => {
    mockStoreState({ position: { x: 0, y: 0 }, visitedTrail: [] });
    useStore.getState().setPosition({ x: 1, y: 0 });
    expect(useStore.getState().visitedTrail).toEqual([{ x: 0, y: 0 }]);
  });

  it('limits trail to 9 entries', () => {
    const trail = Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0 }));
    mockStoreState({ position: { x: 10, y: 0 }, visitedTrail: trail });
    useStore.getState().setPosition({ x: 11, y: 0 });
    const result = useStore.getState().visitedTrail;
    expect(result).toHaveLength(9);
    expect(result[0]).toEqual({ x: 10, y: 0 }); // newest
  });

  it('does not duplicate consecutive positions', () => {
    mockStoreState({ position: { x: 5, y: 5 }, visitedTrail: [{ x: 4, y: 5 }] });
    useStore.getState().setPosition({ x: 5, y: 5 }); // same position
    expect(useStore.getState().visitedTrail).toHaveLength(1); // no change
  });
});
```

**Verify:** `cd packages/client && npx vitest run`

**Commit:** `feat: add radar trail line and simplify empty sector rendering (#112)`

---

## Task 4: Worldgen Rebalance + Resource Regeneration (#113 — worldgen part)

**Files:**
- Modify: `packages/shared/src/constants.ts:45-52` — SECTOR_RESOURCE_YIELDS
- Modify: `packages/shared/src/constants.ts:908-921` — ENVIRONMENT_WEIGHTS, CONTENT_WEIGHTS
- Modify: `packages/server/src/engine/worldgen.ts:176-189` — generateResources (ensure asteroid always has ore, nebula always has gas)
- Create: `packages/server/src/db/migrations/028_resource_regen.sql`
- Modify: `packages/server/src/db/queries.ts` — update getSector/saveSector for regen fields
- Test: `packages/server/src/engine/__tests__/worldgenRebalance.test.ts` (new)

### Step 1: Update resource yields

In `packages/shared/src/constants.ts`, lines 45-52, change SECTOR_RESOURCE_YIELDS:
```typescript
export const SECTOR_RESOURCE_YIELDS: Record<SectorType, Record<MineableResourceType, number>> = {
  empty:          { ore: 0,  gas: 0,  crystal: 0  },
  nebula:         { ore: 0,  gas: 30, crystal: 5  },
  asteroid_field: { ore: 50, gas: 0,  crystal: 8  },
  anomaly:        { ore: 3,  gas: 3,  crystal: 20 },
  station:        { ore: 0,  gas: 0,  crystal: 0  },
  pirate:         { ore: 8,  gas: 3,  crystal: 8  },
};
```

### Step 2: Update environment/content weights

In `packages/shared/src/constants.ts`, lines 908-921:
```typescript
export const ENVIRONMENT_WEIGHTS: Record<string, number> = {
  empty: 0.70,
  nebula: 0.15,
};

export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.45,
  asteroid_field: 0.25,
  pirate: 0.10,
  anomaly: 0.05,
  station: 0.08,
};
```

Note: CONTENT_WEIGHTS intentionally sum to <1.0 — the remaining gap falls through to `none` as default in `rollContent()`.

### Step 3: Add resource regen constants

In `packages/shared/src/constants.ts`, add near the mining constants:
```typescript
// Resource regeneration (per minute)
export const RESOURCE_REGEN_PER_MINUTE = 1;         // ore & gas regen per minute
export const CRYSTAL_REGEN_PER_MINUTE = 1 / 3;      // crystal regens slower (1 per 3 min)
```

### Step 4: DB migration for regen tracking

Create `packages/server/src/db/migrations/028_resource_regen.sql`:
```sql
-- Resource regeneration: track last mined time and max resource values
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS last_mined BIGINT DEFAULT NULL;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_ore INTEGER DEFAULT 0;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_gas INTEGER DEFAULT 0;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_crystal INTEGER DEFAULT 0;
```

### Step 5: Update getSector with regen logic

In `packages/server/src/db/queries.ts`, update the `getSector` function (line 236-270).

Change the SQL query to include new columns:
```sql
SELECT x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents, last_mined, max_ore, max_gas, max_crystal FROM sectors WHERE x = $1 AND y = $2
```

After extracting resources from metadata, apply regeneration:
```typescript
import { RESOURCE_REGEN_PER_MINUTE, CRYSTAL_REGEN_PER_MINUTE } from '@void-sector/shared';

// ... inside getSector, after line 257:
  const meta = row.metadata || {};
  let resources = (meta.resources as SectorData['resources']) || { ore: 0, gas: 0, crystal: 0 };

  // Apply resource regeneration if sector was mined
  if (row.last_mined && (row.max_ore > 0 || row.max_gas > 0 || row.max_crystal > 0)) {
    const elapsedMinutes = (Date.now() - Number(row.last_mined)) / 60000;
    resources = {
      ore: Math.min(row.max_ore, resources.ore + Math.floor(elapsedMinutes * RESOURCE_REGEN_PER_MINUTE)),
      gas: Math.min(row.max_gas, resources.gas + Math.floor(elapsedMinutes * RESOURCE_REGEN_PER_MINUTE)),
      crystal: Math.min(row.max_crystal, resources.crystal + Math.floor(elapsedMinutes * CRYSTAL_REGEN_PER_MINUTE)),
    };
  }
```

### Step 6: Update saveSector to store max values

In `packages/server/src/db/queries.ts`, update `saveSector` (line 272-288) to also save max values on first discovery:
```typescript
export async function saveSector(sector: SectorData): Promise<void> {
  const res = sector.resources || { ore: 0, gas: 0, crystal: 0 };
  await query(
    `INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents, max_ore, max_gas, max_crystal)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11)
     ON CONFLICT (x, y) DO NOTHING`,
    [
      sector.x, sector.y, sector.type, sector.seed, sector.discoveredBy,
      JSON.stringify({ resources: res }),
      sector.environment ?? 'empty',
      sector.contents ?? [],
      res.ore, res.gas, res.crystal,
    ]
  );
}
```

### Step 7: Add updateSectorResources for mining depletion

Add a new query function in `queries.ts`:
```typescript
export async function updateSectorResources(
  x: number, y: number,
  resources: { ore: number; gas: number; crystal: number }
): Promise<void> {
  await query(
    `UPDATE sectors SET metadata = jsonb_set(metadata, '{resources}', $3::jsonb), last_mined = $4
     WHERE x = $1 AND y = $2`,
    [x, y, JSON.stringify(resources), Date.now()]
  );
}
```

**Note:** The `handleStopMine` handler in SectorRoom.ts should call `updateSectorResources` after deducting mined resources. Check if this already happens — if not, wire it in. The mining system uses `sectorData.resources` to validate but may not persist depletion. If mining already depletes resources in DB, just add the `last_mined` update.

### Step 8: Test

Create `packages/server/src/engine/__tests__/worldgenRebalance.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { SECTOR_RESOURCE_YIELDS, ENVIRONMENT_WEIGHTS, CONTENT_WEIGHTS } from '@void-sector/shared';

describe('worldgen rebalance', () => {
  it('asteroids always have ore', () => {
    expect(SECTOR_RESOURCE_YIELDS.asteroid_field.ore).toBeGreaterThan(0);
  });

  it('asteroids have crystal', () => {
    expect(SECTOR_RESOURCE_YIELDS.asteroid_field.crystal).toBeGreaterThan(0);
  });

  it('nebula always has gas', () => {
    expect(SECTOR_RESOURCE_YIELDS.nebula.gas).toBeGreaterThan(0);
  });

  it('nebula has crystal', () => {
    expect(SECTOR_RESOURCE_YIELDS.nebula.crystal).toBeGreaterThan(0);
  });

  it('empty has no resources', () => {
    const e = SECTOR_RESOURCE_YIELDS.empty;
    expect(e.ore + e.gas + e.crystal).toBe(0);
  });

  it('environment weights favor empty (70%+)', () => {
    expect(ENVIRONMENT_WEIGHTS.empty).toBeGreaterThanOrEqual(0.70);
  });
});
```

**Verify:** `cd packages/shared && npx vitest run && cd ../server && npx vitest run`

**Commit:** `feat: rebalance worldgen yields, add resource regeneration (#113)`

---

## Task 5: Resource Dots on Radar Grid (#113 — UI part)

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts` — draw resource dots per cell
- Test: Visual verification

In the cell rendering loop, **after** the sector content rendering (after the `else if (sector)` block), add resource dot rendering for discovered sectors with resources:

```typescript
      // Resource fill indicator dots (2×3 at bottom of cell)
      if (sector?.resources && state.zoomLevel >= 1) {
        const res = sector.resources;
        const maxRes = (sector as any).maxResources;
        const dotY = cellY + CELL_H / 2 - 6;
        const dotSpacing = 3;
        const dotRadius = 1.5;

        // Left side: ore or gas (whichever is primary)
        const primaryRes = res.ore > 0 ? res.ore : res.gas;
        const primaryMax = maxRes ? (res.ore > 0 ? maxRes.ore : maxRes.gas) : primaryRes;
        const primaryColor = res.ore > 0 ? state.themeColor : '#66CCFF';

        if (primaryMax > 0) {
          const pct = Math.min(1, primaryRes / primaryMax);
          const activeDots = pct >= 1 ? -1 : Math.ceil(pct * 3); // -1 = bar
          for (let d = 0; d < 3; d++) {
            const dx = cellX - 8 + d * dotSpacing;
            if (activeDots === -1) {
              // Full bar
              ctx.fillStyle = primaryColor;
              ctx.globalAlpha = 0.9;
              ctx.fillRect(cellX - 8, dotY - 1, 3 * dotSpacing, 2);
              ctx.globalAlpha = 1;
              break;
            }
            ctx.fillStyle = primaryColor;
            ctx.globalAlpha = d < activeDots ? 0.9 : 0.15;
            ctx.beginPath();
            ctx.arc(dx, dotY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Right side: crystal
        if (res.crystal > 0 || (maxRes && maxRes.crystal > 0)) {
          const crystalMax = maxRes?.crystal ?? res.crystal;
          const pct = crystalMax > 0 ? Math.min(1, res.crystal / crystalMax) : 0;
          const activeDots = pct >= 1 ? -1 : Math.ceil(pct * 3);
          for (let d = 0; d < 3; d++) {
            const dx = cellX + 4 + d * dotSpacing;
            if (activeDots === -1) {
              ctx.fillStyle = '#66CCFF';
              ctx.globalAlpha = 0.9;
              ctx.fillRect(cellX + 4, dotY - 1, 3 * dotSpacing, 2);
              ctx.globalAlpha = 1;
              break;
            }
            ctx.fillStyle = '#66CCFF';
            ctx.globalAlpha = d < activeDots ? 0.9 : 0.15;
            ctx.beginPath();
            ctx.arc(dx, dotY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
```

**Note:** `maxResources` needs to be added to `SectorData` type or passed via metadata. The simplest approach: store max values when sector is first discovered and include them in the client-side `SectorData`. If this is too complex for the initial pass, use the current resource values as the denominator (dots always show 100% for undepleted sectors, which is fine — they only show depletion after mining).

**Verify:** `cd packages/client && npx vitest run`

**Commit:** `feat: add resource indicator dots to radar grid (#113)`

---

## Task 6: Reseed Script (#113 — one-time script)

**Files:**
- Create: `packages/server/src/scripts/reseed.ts`

```typescript
import { query } from '../db/client.js';
import { runMigrations } from '../db/client.js';
import { createPlayer } from '../db/queries.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

async function reseed() {
  await runMigrations();
  console.log('Migrations complete');

  // 1. Delete all sectors in quadrant (0,0) — sectors with x: 0..9999, y: 0..9999
  const deleted = await query(
    'DELETE FROM sectors WHERE x >= 0 AND x < 10000 AND y >= 0 AND y < 10000'
  );
  console.log(`Deleted ${deleted.rowCount} sectors in quadrant (0,0)`);

  // 2. Create test accounts
  const passwordHash = await bcrypt.hash('test1234', SALT_ROUNDS);
  const accounts = [
    { username: 'Phash', homeBase: { x: 20, y: 20 } },
    { username: 'Smasher', homeBase: { x: 40, y: 20 } },
    { username: 'Fede', homeBase: { x: 20, y: 40 } },
  ];

  for (const acct of accounts) {
    try {
      const player = await createPlayer(acct.username, passwordHash, acct.homeBase);
      console.log(`Created ${acct.username} (id: ${player.id}) at (${acct.homeBase.x}, ${acct.homeBase.y})`);
    } catch (err: any) {
      if (err.code === '23505') {
        console.log(`${acct.username} already exists — skipping`);
      } else {
        throw err;
      }
    }
  }

  console.log('Reseed complete');
  process.exit(0);
}

reseed().catch(err => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
```

**Run:** `cd packages/server && npx tsx src/scripts/reseed.ts`

**Commit:** `feat: add one-time reseed script for quadrant (0,0) (#113)`

---

## Task 7: Artwork in Detail Panels (#115)

**Files:**
- Create: `packages/client/src/components/SectorArtwork.tsx` — shared artwork component
- Modify: `packages/client/src/components/MiningDetailPanel.tsx` — add artwork
- Modify: `packages/client/src/components/TradeDetailPanel.tsx` — add artwork
- Test: `packages/client/src/__tests__/SectorArtwork.test.tsx` (new)

### Step 1: Create shared SectorArtwork component

Create `packages/client/src/components/SectorArtwork.tsx`:
```tsx
import { getStationArtwork } from '../assets/stations';
import { getAlienArtwork } from '../assets/aliens';

// ASCII art fallback (subset from DetailViewOverlay)
const SECTOR_ASCII: Record<string, string[]> = {
  asteroid_field: [
    '    .  *  .',
    '  *  ___  .',
    ' . /   \\  *',
    '  | * * | .',
    '   \\___/',
    '  *  .  *',
  ],
  nebula: [
    '  . ~ ~ ~ .',
    ' ~ . * . ~ ~',
    '~ * . ~ . * ~',
    ' ~ ~ . ~ ~ ~',
    '  . ~ * ~ .',
  ],
  station: [
    '   [===]',
    '  /|   |\\',
    ' / | H | \\',
    '|  |___|  |',
    ' \\_______/',
  ],
  anomaly: [
    '   / \\ / \\',
    '  | ? ? ? |',
    '   \\ | / ',
    '    \\|/',
    '     *',
  ],
  pirate: [
    '    _____',
    '   / x x \\',
    '  |  ___  |',
    '   \\/ | \\/',
    '      |',
  ],
};

interface SectorArtworkProps {
  sectorType: string;
  stationVariant?: string;
  faction?: string;
}

export function SectorArtwork({ sectorType, stationVariant, faction }: SectorArtworkProps) {
  // Try SVG first
  let svgUrl: string | undefined;
  if (sectorType === 'station') {
    svgUrl = getStationArtwork(stationVariant ?? 'trading_post')
      ?? getStationArtwork(faction ?? 'independent')
      ?? undefined;
  } else {
    svgUrl = getAlienArtwork(sectorType) ?? undefined;
  }

  if (svgUrl) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0',
      }}>
        <img
          src={svgUrl}
          alt={sectorType}
          style={{
            width: '100%',
            maxWidth: 180,
            maxHeight: 120,
            height: 'auto',
            filter: 'drop-shadow(0 0 6px var(--color-primary))',
            opacity: 0.85,
          }}
        />
      </div>
    );
  }

  // ASCII fallback
  const ascii = SECTOR_ASCII[sectorType];
  if (!ascii) return null;

  return (
    <div style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      lineHeight: 1.3,
      color: 'var(--color-primary)',
      textAlign: 'center',
      opacity: 0.7,
      padding: '4px 0',
    }}>
      {ascii.map((line, i) => (
        <div key={i} style={{ whiteSpace: 'pre' }}>{line}</div>
      ))}
    </div>
  );
}
```

### Step 2: Add to MiningDetailPanel

In `packages/client/src/components/MiningDetailPanel.tsx`, import and use:
```typescript
import { SectorArtwork } from './SectorArtwork';
```

Add artwork above "SEKTOR-RESSOURCEN" header (inside the `return` with resources):
```tsx
  return (
    <div style={panelStyle}>
      <SectorArtwork sectorType={currentSector?.type ?? 'empty'} />
      <div style={{ /* existing SEKTOR-RESSOURCEN header */ }}>
```

### Step 3: Add to TradeDetailPanel

In `packages/client/src/components/TradeDetailPanel.tsx`, import and add above station name:
```typescript
import { SectorArtwork } from './SectorArtwork';
```

```tsx
  return (
    <div style={panelStyle}>
      <SectorArtwork
        sectorType="station"
        stationVariant={(currentSector?.metadata as any)?.stationVariant}
      />
      <div style={{ /* existing station name */ }}>
```

### Step 4: Test

Create `packages/client/src/__tests__/SectorArtwork.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectorArtwork } from '../components/SectorArtwork';

vi.mock('../assets/stations', () => ({
  getStationArtwork: () => null,
}));
vi.mock('../assets/aliens', () => ({
  getAlienArtwork: () => null,
}));

describe('SectorArtwork', () => {
  it('renders ASCII art for asteroid_field', () => {
    const { container } = render(<SectorArtwork sectorType="asteroid_field" />);
    expect(container.textContent).toContain('*');
  });

  it('renders ASCII art for nebula', () => {
    const { container } = render(<SectorArtwork sectorType="nebula" />);
    expect(container.textContent).toContain('~');
  });

  it('renders nothing for unknown type', () => {
    const { container } = render(<SectorArtwork sectorType="unknown" />);
    expect(container.innerHTML).toBe('');
  });
});
```

**Verify:** `cd packages/client && npx vitest run`

**Commit:** `feat: add sector artwork to detail panels (#115)`

---

## Task 8: Comm Channel Rename — local → remove, quadrant as default (#114 — channels)

**Files:**
- Modify: `packages/shared/src/types.ts:218` — ChatChannel type
- Modify: `packages/client/src/state/gameSlice.ts:297` — default channel
- Modify: `packages/client/src/components/CockpitLayout.tsx:129` — channel list
- Modify: `packages/client/src/test/mockStore.ts:163` — mock default
- Modify: `packages/server/src/rooms/SectorRoom.ts:2537-2602` — remove 'local' routing, keep sector/quadrant
- Test: Update `packages/client/src/__tests__/CommsScreen.test.tsx`

### Step 1: Update ChatChannel type

In `packages/shared/src/types.ts`, line 218:
```typescript
// BEFORE
export type ChatChannel = 'direct' | 'faction' | 'local' | 'sector' | 'quadrant';
// AFTER
export type ChatChannel = 'direct' | 'faction' | 'sector' | 'quadrant';
```

### Step 2: Update default channel

In `packages/client/src/state/gameSlice.ts`, line 297:
```typescript
// BEFORE
chatChannel: 'local' as ChatChannel,
// AFTER
chatChannel: 'quadrant' as ChatChannel,
```

In `packages/client/src/test/mockStore.ts`, line 163:
```typescript
// BEFORE
chatChannel: 'local' as const,
// AFTER
chatChannel: 'quadrant' as const,
```

### Step 3: Update channel buttons

In `packages/client/src/components/CockpitLayout.tsx`, line 129:
```typescript
// BEFORE
channels={['direct', 'faction', 'local', 'sector', 'quadrant']}
// AFTER
channels={['quadrant', 'sector', 'faction', 'direct']}
```

### Step 4: Server — remove 'local' handling

In `packages/server/src/rooms/SectorRoom.ts`:

1. Remove the nebula interference block for 'local' (lines 2537-2543)
2. Update VALID_CHANNELS (line 2546):
```typescript
const VALID_CHANNELS = ['direct', 'faction', 'sector', 'quadrant'] as const;
```
3. Remove the `if (data.channel === 'local')` broadcast block (line 2598-2599) — `quadrant` already broadcasts to all in room

### Step 5: Update sector channel routing

The `sector` channel should only send to players in the same sector, not broadcast to the whole room. Update the existing sector handler (around line 2600-2612):

```typescript
    if (data.channel === 'sector') {
      // Only send to players in the SAME sector
      const senderX = this._px(client.sessionId);
      const senderY = this._py(client.sessionId);
      for (const c of this.clients) {
        if (this._px(c.sessionId) === senderX && this._py(c.sessionId) === senderY) {
          c.send('chatMessage', chatMsg);
        }
      }
    } else if (data.channel === 'quadrant') {
```

### Step 6: Update tests

In `packages/client/src/__tests__/CommsScreen.test.tsx`, change all `'local'` references to `'quadrant'`.

**Verify:** `cd packages/shared && npx vitest run && cd ../server && npx vitest run && cd ../client && npx vitest run`

**Commit:** `feat: remove local channel, default to quadrant, fix sector routing (#114)`

---

## Task 9: Wider Comm Channel Buttons (#114 — UI)

**Files:**
- Modify: `packages/client/src/components/ChannelButtons.tsx` (or wherever channel buttons are styled)
- Modify: `packages/client/src/styles/crt.css` — channel button styles

The channel buttons need to show full text ("QUADRANT", "SEKTOR", "FRAKTION", "DIREKT") and be wider.

Find the `ChannelButtons` component and update button labels from abbreviated to full German:
```typescript
const CHANNEL_LABELS: Record<string, string> = {
  quadrant: 'QUADRANT',
  sector: 'SEKTOR',
  faction: 'FRAKTION',
  direct: 'DIREKT',
};
```

Ensure buttons use `flex: 1` or `width: 100%` to fill available space, and increase min-height to 32px for better touch targets.

**Verify:** `cd packages/client && npx vitest run`

**Commit:** `feat: widen channel buttons with full German labels (#114)`

---

## Task 10: Player Context Menu (#114 — interaction)

**Files:**
- Create: `packages/client/src/components/PlayerContextMenu.tsx`
- Modify: `packages/client/src/state/uiSlice.ts` — add contextMenu state
- Modify: `packages/client/src/components/CommsScreen.tsx` — trigger on player name click
- Modify: `packages/client/src/components/CockpitLayout.tsx` — render PlayerContextMenu overlay
- Test: `packages/client/src/__tests__/PlayerContextMenu.test.tsx` (new)

### Step 1: Add context menu state to uiSlice

In `packages/client/src/state/uiSlice.ts`, add to the UISlice interface:
```typescript
  contextMenu: { playerId: string; playerName: string; x: number; y: number } | null;
  openContextMenu: (playerId: string, playerName: string, x: number, y: number) => void;
  closeContextMenu: () => void;
```

Add initial state and actions:
```typescript
  contextMenu: null,
  openContextMenu: (playerId, playerName, x, y) => set({ contextMenu: { playerId, playerName, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),
```

### Step 2: Create PlayerContextMenu component

Create `packages/client/src/components/PlayerContextMenu.tsx`:
```tsx
import { useStore } from '../state/store';

export function PlayerContextMenu() {
  const menu = useStore(s => s.contextMenu);
  const close = useStore(s => s.closeContextMenu);
  const setChatChannel = useStore(s => s.setChatChannel);

  if (!menu) return null;

  const startDirectMessage = () => {
    setChatChannel('direct');
    // Set recipient in comms
    useStore.setState({
      directRecipient: { id: menu.playerId, name: menu.playerName },
    });
    close();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="context-menu-backdrop"
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
        }}
        onClick={close}
      />
      {/* Menu */}
      <div
        data-testid="context-menu"
        style={{
          position: 'fixed',
          left: menu.x,
          top: menu.y,
          zIndex: 101,
          background: '#0a0a0a',
          border: '1px solid var(--color-primary)',
          padding: 4,
          minWidth: 160,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
        }}
      >
        <div style={{
          padding: '2px 8px',
          color: 'var(--color-primary)',
          borderBottom: '1px solid var(--color-dim)',
          marginBottom: 4,
          fontWeight: 'bold',
        }}>
          {menu.playerName}
        </div>
        <div
          style={{ padding: '4px 8px', cursor: 'pointer', color: 'var(--color-primary)' }}
          onClick={startDirectMessage}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-dim)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          NACHRICHT SENDEN
        </div>
        <div
          style={{ padding: '4px 8px', color: 'var(--color-dim)', cursor: 'not-allowed', opacity: 0.5 }}
        >
          VISITENKARTE (bald)
        </div>
      </div>
    </>
  );
}
```

### Step 3: Add to CommsScreen — clickable player names

In `packages/client/src/components/CommsScreen.tsx`, in the message rendering (around line 130), wrap the sender name in a clickable span:

```tsx
const openContextMenu = useStore(s => s.openContextMenu);

// In the message rendering:
<span
  style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
  onClick={(e) => openContextMenu(msg.senderId, msg.senderName, e.clientX, e.clientY)}
>
  {msg.senderName}:
</span>
```

### Step 4: Render in CockpitLayout

In `packages/client/src/components/CockpitLayout.tsx`, add the context menu overlay:
```tsx
import { PlayerContextMenu } from './PlayerContextMenu';

// At the end of the CockpitLayout return, before closing div:
<PlayerContextMenu />
```

### Step 5: Wire context menu from Radar (ship clicks)

In `RadarCanvas.tsx` (or wherever canvas click events are handled), detect clicks on other player positions and trigger `openContextMenu`. This depends on the existing click handling architecture — look for `onClick` or `handleCanvasClick`.

### Step 6: Test

Create `packages/client/src/__tests__/PlayerContextMenu.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerContextMenu } from '../components/PlayerContextMenu';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({ network: {} }));

describe('PlayerContextMenu', () => {
  it('renders nothing when no context menu', () => {
    mockStoreState({ contextMenu: null });
    const { container } = render(<PlayerContextMenu />);
    expect(container.innerHTML).toBe('');
  });

  it('renders menu when contextMenu is set', () => {
    mockStoreState({
      contextMenu: { playerId: 'p1', playerName: 'Phash', x: 100, y: 100 },
    });
    render(<PlayerContextMenu />);
    expect(screen.getByText('Phash')).toBeInTheDocument();
    expect(screen.getByText('NACHRICHT SENDEN')).toBeInTheDocument();
    expect(screen.getByText(/VISITENKARTE/)).toBeInTheDocument();
  });

  it('closes on backdrop click', () => {
    mockStoreState({
      contextMenu: { playerId: 'p1', playerName: 'Phash', x: 100, y: 100 },
    });
    render(<PlayerContextMenu />);
    fireEvent.click(screen.getByTestId('context-menu-backdrop'));
    // contextMenu should be set to null — verify via store
  });
});
```

**Verify:** `cd packages/client && npx vitest run`

**Commit:** `feat: add player context menu for direct messaging (#114)`

---

## Task 11: Deploy and Run Reseed

After all changes are committed and tests pass:

1. Push to remote
2. Rebuild server: `cd packages/server && npm run build`
3. Rebuild client: `cd packages/client && npm run build`
4. Run reseed script: `cd packages/server && npx tsx src/scripts/reseed.ts`
5. **DO NOT restart cloudflared**

**Verify:** Open game, check layout proportions, visit sectors, verify trail appears, check chat channels.

---

## Summary of Changes by File

| File | Tasks |
|------|-------|
| `packages/client/src/styles/crt.css` | 1 (layout) |
| `packages/shared/src/constants.ts` | 2, 4 (distress, yields, weights, regen) |
| `packages/shared/src/types.ts` | 8 (ChatChannel) |
| `packages/server/src/engine/scanEvents.ts` | 2 (weights) |
| `packages/client/src/state/gameSlice.ts` | 3, 8 (trail, channel) |
| `packages/client/src/canvas/RadarRenderer.ts` | 3, 5 (trail, dots, empty sectors) |
| `packages/server/src/db/migrations/028_resource_regen.sql` | 4 (new) |
| `packages/server/src/db/queries.ts` | 4 (regen logic) |
| `packages/server/src/engine/worldgen.ts` | 4 (if needed) |
| `packages/server/src/scripts/reseed.ts` | 6 (new) |
| `packages/client/src/components/SectorArtwork.tsx` | 7 (new) |
| `packages/client/src/components/MiningDetailPanel.tsx` | 7 (artwork) |
| `packages/client/src/components/TradeDetailPanel.tsx` | 7 (artwork) |
| `packages/client/src/components/CockpitLayout.tsx` | 8, 10 (channels, context menu) |
| `packages/client/src/components/CommsScreen.tsx` | 8, 10 (channel, clicks) |
| `packages/server/src/rooms/SectorRoom.ts` | 8 (remove local, fix sector routing) |
| `packages/client/src/components/ChannelButtons.tsx` | 9 (wider) |
| `packages/client/src/components/PlayerContextMenu.tsx` | 10 (new) |
| `packages/client/src/state/uiSlice.ts` | 10 (context menu state) |
