# Sector Probabilities (#219) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make 90% of sectors empty and tune nebula zones to appear as 1–2 connected clusters per 500×500 quadrant (20–200 sectors each).

**Architecture:** Two constant changes in `packages/shared/src/constants.ts`. `CONTENT_WEIGHTS.none` is already `0.9` (90% empty). The main fix is reducing `NEBULA_ZONE_GRID` from 5000 → 250 so nebula clusters appear 1–2× per quadrant. `NEBULA_ZONE_MIN_RADIUS` drops from 3 → 2.5 to allow blobs of ~20 sectors. Existing DB rows are unaffected (sector type is stored on discovery); a clean DB reset shows full effect.

**Tech Stack:** TypeScript, `packages/shared/src/constants.ts`, Vitest

---

### Task 1: Tune nebula zone constants for 1–2 clusters per quadrant

**Files:**
- Modify: `packages/shared/src/constants.ts:1323-1326`

**Step 1: Understand current math**

- `QUADRANT_SIZE = 500` → quadrant is 500×500 sectors
- Current `NEBULA_ZONE_GRID = 5000` → (500/5000)² × 0.4 ≈ 0.004 blobs/quadrant (almost none)
- Target: 1–2 blobs/quadrant → need (500/grid)² × 0.4 ≈ 1.5 → grid ≈ 250
- Blob size: `radius=3` → π×3² ≈ 28 sectors; `radius=2.5` → π×2.5² ≈ 20 sectors ✓

**Step 2: Edit constants**

Change in `packages/shared/src/constants.ts` (lines ~1323–1326):

```typescript
export const NEBULA_ZONE_GRID = 250;         // was 5_000; 1-2 clusters per 500×500 quadrant
export const NEBULA_ZONE_CHANCE = 0.4;       // unchanged: 40% of centers activate
export const NEBULA_ZONE_MIN_RADIUS = 2.5;   // was 3; ~20 sectors min (π×r²)
export const NEBULA_ZONE_MAX_RADIUS = 8;     // unchanged: ~200 sectors max
```

**Step 3: Run unit tests**

```bash
cd /e/claude/voidSector && npm run test -w packages/shared -- --reporter=verbose 2>&1 | head -40
```

Expected: all existing tests pass.

**Step 4: Write nebula distribution test**

Create `packages/server/src/engine/__tests__/nebulaZones.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isInNebulaZone } from '../worldgen.js';

describe('isInNebulaZone distribution', () => {
  it('produces 1-2 blobs per 500x500 quadrant on average', () => {
    // Sample a 500×500 quadrant starting at (1000, 1000) — safely past NEBULA_SAFE_ORIGIN
    const qx = 1000, qy = 1000;
    let nebulaCount = 0;
    const total = 500 * 500;
    for (let dx = 0; dx < 500; dx++) {
      for (let dy = 0; dy < 500; dy++) {
        if (isInNebulaZone(qx + dx, qy + dy)) nebulaCount++;
      }
    }
    const fraction = nebulaCount / total;
    // With 1-2 blobs of ~20-200 sectors, expect 0.01%-0.2% nebula coverage
    expect(fraction).toBeGreaterThan(0.0);
    expect(fraction).toBeLessThan(0.5); // less than 50% nebula
    // At least some nebula exists in this quadrant
    expect(nebulaCount).toBeGreaterThan(0);
  });

  it('no nebula near origin', () => {
    // Within NEBULA_SAFE_ORIGIN=200, expect no nebula
    let found = false;
    for (let x = -200; x <= 200 && !found; x++) {
      for (let y = -200; y <= 200 && !found; y++) {
        if (isInNebulaZone(x, y)) found = true;
      }
    }
    expect(found).toBe(false);
  });
});
```

**Step 5: Run new test**

```bash
cd /e/claude/voidSector && npm run test -w packages/server -- --reporter=verbose nebulaZones 2>&1 | head -30
```

Expected: PASS

**Step 6: Rebuild shared dist (constants exported)**

```bash
cd /e/claude/voidSector && npm run build -w packages/shared 2>&1 | tail -5
```

Expected: Build complete with no errors.

**Step 7: Commit**

```bash
cd /e/claude/voidSector
git add packages/shared/src/constants.ts packages/server/src/engine/__tests__/nebulaZones.test.ts
git commit -m "feat(#219): tune nebula zones — 1-2 clusters per quadrant, 20-200 sectors each"
```

---

### Task 2: Verify 90% empty sectors and clean up dead code

**Files:**
- Modify: `packages/shared/src/constants.ts:24-31` (add comment)
- No logic change — `CONTENT_WEIGHTS.none = 0.9` is already correct

**Step 1: Verify current CONTENT_WEIGHTS**

`CONTENT_WEIGHTS` in `constants.ts:1371`:
```typescript
export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.9,            // 90% empty ✓
  asteroid_field: 0.05,
  pirate: 0.02,
  anomaly: 0.01,
  station: 0.016,
  ruin: 0.004,
};
```
Sum of non-empty: 0.1. This matches 90% empty target. No code change needed.

**Step 2: Add clarifying comment to dead SECTOR_WEIGHTS**

`SECTOR_WEIGHTS` is never imported in server or shared code — it's legacy. Add a deprecation comment so future readers know:

```typescript
/** @deprecated Not used in worldgen. See CONTENT_WEIGHTS + ENVIRONMENT_WEIGHTS in worldgen.ts. */
export const SECTOR_WEIGHTS: Record<SectorType, number> = {
```

**Step 3: Commit**

```bash
cd /e/claude/voidSector
git add packages/shared/src/constants.ts
git commit -m "chore(#219): mark SECTOR_WEIGHTS as deprecated (dead code)"
```

---

### Task 3: Smoke test in running game

**Step 1: Restart server with clean sectors**

```bash
cd /e/claude/voidSector
docker-compose down
docker-compose up -d
```

**Step 2: Observe sectors in game**

- Log in as phash
- Navigate to coords (1000, 1000) — should encounter nebula clusters
- Observe radar: nebula sectors should appear as connected blobs, not isolated dots
- Open ~5 unexplored sectors near (1000, 1000) to verify mix: mostly empty, occasional asteroid/nebula

> Note: pre-existing explored sectors in DB keep their old type. New discoveries use updated weights.

**Step 3: No further commit needed**
