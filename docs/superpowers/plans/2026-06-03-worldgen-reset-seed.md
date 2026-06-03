# Worldgen-Reset & neue Seed/Nebel/Anomalie-Regeln — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frischer Welt-Start mit neuem Seed, einer einzelnen Menschen-Base bei (0,0), Aliens ≥ 1000 Sektoren entfernt, sowie neuer Nebel- (~5 %, zusammenhängende Cluster ≥ 12) und Anomalie-Verteilung (0,01 % im leeren Raum, 10 % im Nebel) — inkl. accounts-erhaltendem Welt-Reset-Script.

**Architecture:** Deterministische Worldgen über `hashCoords(x, y, WORLD_SEED)`. Nebel wird über ein retuntes Blob/Zonen-System erzeugt (`isInNebulaZone`), Anomalien über einen separaten, umgebungsabhängigen Roll mit eigenem Hash. Konstanten leben in `packages/shared`, die Generierungslogik in `packages/server/src/engine/worldgen.ts`. Der Reset ist ein einmalig manuell auszuführendes Script; die frische Welt wird beim nächsten Server-Start durch bestehende `ensure*`-Funktionen geseedet.

**Tech Stack:** TypeScript (strict), Vitest, PostgreSQL, Redis (ioredis), tsx-Runner.

---

## Wichtige Mess-Ergebnisse (vorab verifiziert)

Mit `WORLD_SEED=104729`, `GRID=25`, `CHANCE=0.54`, `MIN_RADIUS=2.5`, `MAX_RADIUS=6`, `SAFE_ORIGIN=25` (per Stand-alone-Simulation gemessen über 4 Regionen):

| Region | Nebel-Abdeckung | Kleinster Cluster |
|--------|-----------------|-------------------|
| 1000:1000 | 5.13 % | 21 |
| 3000:-2000 | 5.28 % | 21 |
| -4000:5000 | 4.96 % | 21 |
| 50000:50000 | 5.10 % | 21 |

Safe-Origin-Verletzungen (Sektoren mit x²+y²<25² als Nebel): **0**.
→ Test-Bänder: Abdeckung ∈ [0.04, 0.06], kleinster Cluster ≥ 12. Beide mit großem Sicherheitsabstand.

## File Structure

| Datei | Verantwortung | Aktion |
|-------|---------------|--------|
| `packages/shared/src/constants.ts` | Seed, Nebel-Zonen, Anomalie-Chancen, `HUMAN_STARTING_TERRITORY`, `CONTENT_WEIGHTS` | Modify |
| `packages/server/src/engine/worldgen.ts` | `isInNebulaZone` Safe-Guard, `hashQuaternary`, `anomalyChanceForEnvironment`, `rollContent`-Umbau | Modify |
| `packages/server/src/engine/alienHomeGuard.ts` | Pure Distanz-Helper + Assertion | Create |
| `packages/server/src/engine/universeBootstrap.ts` | Assertion verdrahten | Modify |
| `packages/server/src/scripts/resetWorld.ts` | Accounts-erhaltender Welt-Reset | Create |
| `packages/server/package.json` | npm-Script `reset:world` | Modify |
| `packages/server/src/engine/__tests__/nebulaZones.test.ts` | Nebel-Tests (Abdeckung, Cluster, Safe-Origin) | Modify |
| `packages/server/src/engine/__tests__/worldgen.test.ts` | Safe-Origin-Test anpassen | Modify |
| `packages/server/src/engine/__tests__/anomalyGeneration.test.ts` | Anomalie-Tests | Create |
| `packages/server/src/engine/__tests__/alienHomeGuard.test.ts` | Distanz-Helper-Tests | Create |
| `packages/server/src/engine/__tests__/livingUniverse.test.ts` | Human-Territory 9→1 | Modify |
| `packages/server/src/scripts/__tests__/resetWorld.test.ts` | Reset-Tabellenlisten | Create |

> **Build-Regel:** Nach jeder Änderung an `packages/shared/src/constants.ts` **muss** `cd packages/shared && npm run build` laufen, bevor Server-Tests die neuen Werte sehen (Server importiert kompiliertes `dist/`).

---

## Task 1: WORLD_SEED ändern (77 → 104729)

**Files:**
- Modify: `packages/shared/src/constants.ts:46`
- Test: `packages/shared/src/__tests__/worldSeed.test.ts` (neu)

- [ ] **Step 1: Failing-Test schreiben**

Create `packages/shared/src/__tests__/worldSeed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WORLD_SEED } from '../constants.js';

describe('WORLD_SEED', () => {
  it('is set to the fresh-world value 104729', () => {
    expect(WORLD_SEED).toBe(104729);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd packages/shared && npx vitest run src/__tests__/worldSeed.test.ts`
Expected: FAIL — `expected 77 to be 104729`.

- [ ] **Step 3: Konstante ändern**

In `packages/shared/src/constants.ts:46` ändern:

```typescript
export const WORLD_SEED = 104729;
```

- [ ] **Step 4: Shared bauen + Test laufen lassen — muss passen**

Run: `cd packages/shared && npm run build && npx vitest run src/__tests__/worldSeed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/worldSeed.test.ts packages/shared/dist
git commit -m "feat: change WORLD_SEED to 104729 for fresh world"
```

---

## Task 2: Nebel — ~5 % Abdeckung, Cluster ≥ 12, 25-Sektoren-Safe-Zone

**Files:**
- Modify: `packages/shared/src/constants.ts:491-495`
- Modify: `packages/server/src/engine/worldgen.ts:74` (`isInNebulaZone`)
- Modify: `packages/server/src/engine/__tests__/nebulaZones.test.ts`
- Modify: `packages/server/src/engine/__tests__/worldgen.test.ts:76-83` (Safe-Origin-Test)

- [ ] **Step 1: Nebel-Tests neu schreiben (Failing)**

Ersetze den **kompletten** Inhalt von `packages/server/src/engine/__tests__/nebulaZones.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isInNebulaZone } from '../worldgen.js';
import { NEBULA_SAFE_ORIGIN } from '@void-sector/shared';

/** Sample a square region and return a boolean nebula grid. */
function sampleRegion(x0: number, y0: number, n: number): boolean[][] {
  const grid: boolean[][] = [];
  for (let dx = 0; dx < n; dx++) {
    grid[dx] = [];
    for (let dy = 0; dy < n; dy++) {
      grid[dx][dy] = isInNebulaZone(x0 + dx, y0 + dy);
    }
  }
  return grid;
}

/** Smallest 4-connected nebula component NOT touching the region border. */
function smallestInteriorCluster(grid: boolean[][]): number {
  const n = grid.length;
  const seen = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  let smallest = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!grid[i][j] || seen[i][j]) continue;
      let touchesBorder = false;
      let size = 0;
      const stack: [number, number][] = [[i, j]];
      seen[i][j] = true;
      while (stack.length) {
        const [a, b] = stack.pop()!;
        size++;
        if (a === 0 || b === 0 || a === n - 1 || b === n - 1) touchesBorder = true;
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const na = a + da;
          const nb = b + db;
          if (na >= 0 && nb >= 0 && na < n && nb < n && grid[na][nb] && !seen[na][nb]) {
            seen[na][nb] = true;
            stack.push([na, nb]);
          }
        }
      }
      if (!touchesBorder && size < smallest) smallest = size;
    }
  }
  return smallest;
}

describe('nebula generation', () => {
  it('covers ~5% of a region far from origin', () => {
    const n = 500;
    const grid = sampleRegion(1000, 1000, n);
    let count = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (grid[i][j]) count++;
    const fraction = count / (n * n);
    expect(fraction).toBeGreaterThanOrEqual(0.04);
    expect(fraction).toBeLessThanOrEqual(0.06);
  });

  it('every contiguous nebula cluster has at least 12 sectors', () => {
    const grid = sampleRegion(1000, 1000, 500);
    expect(smallestInteriorCluster(grid)).toBeGreaterThanOrEqual(12);
  });

  it('has no nebula within NEBULA_SAFE_ORIGIN of the origin', () => {
    const r = NEBULA_SAFE_ORIGIN;
    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        if (x * x + y * y < r * r) {
          expect(isInNebulaZone(x, y)).toBe(false);
        }
      }
    }
  });

  it('is deterministic for the same coordinates', () => {
    expect(isInNebulaZone(1234, 5678)).toBe(isInNebulaZone(1234, 5678));
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd packages/server && npx vitest run src/engine/__tests__/nebulaZones.test.ts`
Expected: FAIL — Abdeckung liegt mit alten Konstanten (~0.05 %) weit unter 0.04.

- [ ] **Step 3: Nebel-Konstanten anpassen**

In `packages/shared/src/constants.ts` die Nebel-Zonen-Block (Zeilen 491–495) ersetzen durch:

```typescript
export const NEBULA_ZONE_GRID = 25;     // dichtes Zentren-Raster für ~5 % Abdeckung
export const NEBULA_ZONE_CHANCE = 0.54;  // gemessen: ~5,0–5,3 % Abdeckung
export const NEBULA_ZONE_MIN_RADIUS = 2.5; // gefüllte Scheibe ≈ 21 Sektoren (≥ 12)
export const NEBULA_ZONE_MAX_RADIUS = 6;   // gefüllte Scheibe ≈ 113 Sektoren
export const NEBULA_SAFE_ORIGIN = 25;      // nebelfreie Start-Blase um (0,0)
```

- [ ] **Step 4: Per-Sektor-Safe-Guard in `isInNebulaZone` einbauen**

In `packages/server/src/engine/worldgen.ts`, am Anfang des Funktionskörpers von `isInNebulaZone` (direkt nach `export function isInNebulaZone(x: number, y: number): boolean {`, vor `const grid = NEBULA_ZONE_GRID;`) einfügen:

```typescript
  // Hard nebula-free bubble around the origin (independent of blob centers).
  if (x * x + y * y < NEBULA_SAFE_ORIGIN * NEBULA_SAFE_ORIGIN) return false;
```

- [ ] **Step 5: Shared bauen + Nebel-Test laufen lassen — muss passen**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/engine/__tests__/nebulaZones.test.ts`
Expected: PASS (alle 4 Tests).

- [ ] **Step 6: Alten Safe-Origin-Test in worldgen.test.ts anpassen**

In `packages/server/src/engine/__tests__/worldgen.test.ts` den Test `isInNebulaZone: origin area is safe (no nebula zones near spawn)` (Zeilen 76–83) ersetzen durch:

```typescript
  it('isInNebulaZone: origin area is safe (no nebula within NEBULA_SAFE_ORIGIN)', () => {
    for (let x = -NEBULA_SAFE_ORIGIN; x <= NEBULA_SAFE_ORIGIN; x++) {
      for (let y = -NEBULA_SAFE_ORIGIN; y <= NEBULA_SAFE_ORIGIN; y++) {
        if (x * x + y * y < NEBULA_SAFE_ORIGIN * NEBULA_SAFE_ORIGIN) {
          expect(isInNebulaZone(x, y)).toBe(false);
        }
      }
    }
  });
```

Und den Import-Block oben in der Datei um `NEBULA_SAFE_ORIGIN` ergänzen (zur bestehenden `@void-sector/shared`-Import-Zeile hinzufügen).

- [ ] **Step 7: worldgen-Suite laufen lassen — muss passen**

Run: `cd packages/server && npx vitest run src/engine/__tests__/worldgen.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/dist packages/server/src/engine/worldgen.ts packages/server/src/engine/__tests__/nebulaZones.test.ts packages/server/src/engine/__tests__/worldgen.test.ts
git commit -m "feat: retune nebula to ~5% coverage, clusters >=12, 25-sector safe zone"
```

---

## Task 3: Anomalien umgebungsabhängig (0,01 % leer / 10 % Nebel)

**Files:**
- Modify: `packages/shared/src/constants.ts:539-546` (`CONTENT_WEIGHTS`) + neue Anomalie-Konstanten
- Modify: `packages/server/src/engine/worldgen.ts` (neuer Hash, Helper, `rollContent`-Umbau)
- Create: `packages/server/src/engine/__tests__/anomalyGeneration.test.ts`

- [ ] **Step 1: Anomalie-Tests schreiben (Failing)**

Create `packages/server/src/engine/__tests__/anomalyGeneration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSector, anomalyChanceForEnvironment } from '../worldgen.js';
import { EMPTY_ANOMALY_CHANCE, NEBULA_ANOMALY_CHANCE } from '@void-sector/shared';

describe('anomalyChanceForEnvironment', () => {
  it('returns the empty-space rate (0.01%) for empty', () => {
    expect(anomalyChanceForEnvironment('empty')).toBe(0.0001);
    expect(EMPTY_ANOMALY_CHANCE).toBe(0.0001);
  });
  it('returns the nebula rate (10%) for nebula', () => {
    expect(anomalyChanceForEnvironment('nebula')).toBe(0.1);
    expect(NEBULA_ANOMALY_CHANCE).toBe(0.1);
  });
  it('returns 0 for black holes', () => {
    expect(anomalyChanceForEnvironment('black_hole')).toBe(0);
  });
});

describe('anomaly distribution over generated sectors', () => {
  it('makes ~10% of nebula sectors anomalies and keeps empty-space anomalies very rare', () => {
    let nebula = 0;
    let nebulaAnomaly = 0;
    let empty = 0;
    let emptyAnomaly = 0;
    // 400x400 region far from origin (~160k sectors, ~8k nebula).
    for (let x = 1000; x < 1400; x++) {
      for (let y = 1000; y < 1400; y++) {
        const s = generateSector(x, y, null);
        const isAnomaly = s.contents.includes('anomaly');
        if (s.environment === 'nebula') {
          nebula++;
          if (isAnomaly) nebulaAnomaly++;
        } else if (s.environment === 'empty') {
          empty++;
          if (isAnomaly) emptyAnomaly++;
        }
      }
    }
    expect(nebula).toBeGreaterThan(2000); // enough samples to be meaningful
    const nebulaFraction = nebulaAnomaly / nebula;
    expect(nebulaFraction).toBeGreaterThanOrEqual(0.08);
    expect(nebulaFraction).toBeLessThanOrEqual(0.12);
    // Empty-space anomalies are ~0.01% — assert they are at least an order of
    // magnitude rarer than 0.1% (statistical exactness of 0.0001 is covered by
    // the deterministic helper test above, not flaky sampling).
    const emptyFraction = emptyAnomaly / empty;
    expect(emptyFraction).toBeLessThan(0.001);
  });

  it('nebula+anomaly sectors keep environment=nebula (Nebel UND Anomalie)', () => {
    let checked = 0;
    for (let x = 1000; x < 1600 && checked < 1; x++) {
      for (let y = 1000; y < 1600; y++) {
        const s = generateSector(x, y, null);
        if (s.environment === 'nebula' && s.contents.includes('anomaly')) {
          expect(s.type).toBe('anomaly'); // legacy type prioritises anomaly
          expect(s.environment).toBe('nebula'); // but it is still a nebula
          checked++;
          break;
        }
      }
    }
    expect(checked).toBe(1);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd packages/server && npx vitest run src/engine/__tests__/anomalyGeneration.test.ts`
Expected: FAIL — `anomalyChanceForEnvironment` und `EMPTY_ANOMALY_CHANCE`/`NEBULA_ANOMALY_CHANCE` existieren noch nicht.

- [ ] **Step 3: Anomalie-Konstanten in shared anlegen**

In `packages/shared/src/constants.ts` den `CONTENT_WEIGHTS`-Block (Zeilen 539–546) ersetzen durch (anomaly entfernt, dessen 0.01 fällt auf `none`):

```typescript
export const CONTENT_WEIGHTS: Record<string, number> = {
  none: 0.91,
  asteroid_field: 0.05,
  pirate: 0.02,
  station: 0.016,
  ruin: 0.004,
};

// Umgebungsabhängige Anomalie-Wahrscheinlichkeit (eigener, dekorrelierter Roll).
export const EMPTY_ANOMALY_CHANCE = 0.0001; // 0,01 % im normalen, leeren Raum
export const NEBULA_ANOMALY_CHANCE = 0.1;   // 10 % im Nebel (jedes 10. Nebelfeld)
```

- [ ] **Step 4: Hash + Helper + rollContent-Umbau in worldgen.ts**

In `packages/server/src/engine/worldgen.ts`:

4a. Den Import-Block oben (`from '@void-sector/shared'`) um die zwei neuen Konstanten ergänzen:

```typescript
  EMPTY_ANOMALY_CHANCE,
  NEBULA_ANOMALY_CHANCE,
```

4b. Nach `hashTertiary` (nach Zeile 67) den vierten Hash + den Helper einfügen:

```typescript
// Quaternary hash — uncorrelated with primary/secondary/tertiary (anomaly roll)
function hashQuaternary(seed: number): number {
  let h = seed ^ 0x27d4eb2f;
  h = Math.imul(h, 0x165667b1);
  h = h ^ (h >>> 15);
  h = Math.imul(h, 0xc2b2ae35);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0x100000000; // 0..1
}

/** Anomaly probability for a sector, by environment. */
export function anomalyChanceForEnvironment(env: SectorEnvironment): number {
  if (env === 'nebula') return NEBULA_ANOMALY_CHANCE;
  if (env === 'black_hole') return 0;
  return EMPTY_ANOMALY_CHANCE;
}
```

4c. Die Funktion `rollContent` (Zeilen 186–204) **komplett ersetzen** durch:

```typescript
function rollContent(seed: number, environment: SectorEnvironment): SectorContent[] {
  if (environment === 'black_hole') return [];

  // Environment-aware anomaly roll (independent hash) takes precedence — this is
  // what produces "every 10th nebula field is also an anomaly".
  if (hashQuaternary(seed) < anomalyChanceForEnvironment(environment)) {
    return ['anomaly'];
  }

  // For nebula, only roll other content if enabled
  if (environment === 'nebula' && !NEBULA_CONTENT_ENABLED) return [];

  // Use tertiary hash for content roll (uncorrelated with environment roll)
  const roll = hashTertiary(seed);
  let cumulative = 0;
  for (const [contentKey, weight] of Object.entries(CONTENT_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) {
      if (contentKey === 'none') return [];
      if (contentKey === 'pirate') return ['pirate_zone', 'asteroid_field'];
      return [contentKey as SectorContent];
    }
  }
  return [];
}
```

- [ ] **Step 5: Shared bauen + Anomalie-Test laufen lassen — muss passen**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/engine/__tests__/anomalyGeneration.test.ts`
Expected: PASS (alle 5 Tests).

- [ ] **Step 6: Volle worldgen-bezogene Suites laufen lassen (Regression)**

Run: `cd packages/server && npx vitest run src/engine/__tests__/worldgen.test.ts src/engine/__tests__/worldgenRebalance.test.ts src/engine/__tests__/sectorContentService.test.ts`
Expected: PASS. (Falls ein Test eine entfernte `CONTENT_WEIGHTS.anomaly` referenziert: dort auf die neue Logik umstellen — der Anomalie-Roll ist jetzt umgebungsabhängig, nicht mehr Teil von `CONTENT_WEIGHTS`.)

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/dist packages/server/src/engine/worldgen.ts packages/server/src/engine/__tests__/anomalyGeneration.test.ts
git commit -m "feat: environment-aware anomalies (0.01% empty / 10% nebula)"
```

---

## Task 4: Einzelne Menschen-Base — HUMAN_STARTING_TERRITORY auf (0,0)

**Files:**
- Modify: `packages/shared/src/constants.ts:902-914`
- Modify: `packages/server/src/engine/__tests__/livingUniverse.test.ts:24`

- [ ] **Step 1: Bestehenden Territory-Test auf 1 anpassen (Failing)**

In `packages/server/src/engine/__tests__/livingUniverse.test.ts` Zeile 24 ändern von:

```typescript
    expect(state.factionQuadrants.get('humans')?.size).toBe(9);
```

zu:

```typescript
    expect(state.factionQuadrants.get('humans')?.size).toBe(1);
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd packages/server && npx vitest run src/engine/__tests__/livingUniverse.test.ts -t "humans"`
Expected: FAIL — `expected 9 to be 1` (Konstante noch 9 Quadranten).

- [ ] **Step 3: HUMAN_STARTING_TERRITORY reduzieren**

In `packages/shared/src/constants.ts` den Block (Zeilen 902–914) ersetzen durch:

```typescript
export const HUMAN_STARTING_TERRITORY: Array<[number, number]> = [
  [0, 0],
];
```

- [ ] **Step 4: Shared bauen + Test laufen lassen — muss passen**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/engine/__tests__/livingUniverse.test.ts`
Expected: PASS (gesamte Datei — die übrigen Tests iterieren über `HUMAN_STARTING_TERRITORY` und bleiben gültig).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/dist packages/server/src/engine/__tests__/livingUniverse.test.ts
git commit -m "feat: start humans with a single base at 0:0 (was 9 quadrants)"
```

---

## Task 5: Guardrail — Alien-Homes ≥ 1000 Sektoren von (0,0)

**Files:**
- Create: `packages/server/src/engine/alienHomeGuard.ts`
- Create: `packages/server/src/engine/__tests__/alienHomeGuard.test.ts`
- Modify: `packages/server/src/engine/universeBootstrap.ts`

- [ ] **Step 1: Helper-Tests schreiben (Failing)**

Create `packages/server/src/engine/__tests__/alienHomeGuard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  quadrantNearestSectorDistance,
  assertAlienHomesFarFromOrigin,
} from '../alienHomeGuard.js';

const S = 500;

describe('quadrantNearestSectorDistance', () => {
  it('is the Chebyshev distance to the nearest sector of the quadrant', () => {
    expect(quadrantNearestSectorDistance(2, 0, S)).toBe(1000); // 2*500
    expect(quadrantNearestSectorDistance(1, 0, S)).toBe(500);  // too close
    expect(quadrantNearestSectorDistance(0, 0, S)).toBe(0);    // origin
    // Negative quadrant -5 spans [-2500,-2001]; nearest sector x=-2001.
    expect(quadrantNearestSectorDistance(-5, -25, S)).toBe(12001); // max(2001,12001)
  });
});

describe('assertAlienHomesFarFromOrigin', () => {
  it('passes when all non-human homes are >= minDist', () => {
    const homes = [
      { faction_id: 'human', home_qx: 0, home_qy: 0 },
      { faction_id: 'kthari', home_qx: 20, home_qy: -15 },
      { faction_id: 'tourist_guild', home_qx: -5, home_qy: -25 },
    ];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).not.toThrow();
  });

  it('throws when an alien home is closer than minDist', () => {
    const homes = [
      { faction_id: 'human', home_qx: 0, home_qy: 0 },
      { faction_id: 'too_close', home_qx: 1, home_qy: 0 }, // 500 < 1000
    ];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).toThrow(/too_close/);
  });

  it('ignores the human faction', () => {
    const homes = [{ faction_id: 'human', home_qx: 0, home_qy: 0 }];
    expect(() => assertAlienHomesFarFromOrigin(homes, S, 1000)).not.toThrow();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd packages/server && npx vitest run src/engine/__tests__/alienHomeGuard.test.ts`
Expected: FAIL — Modul `alienHomeGuard.js` existiert nicht.

- [ ] **Step 3: Helper implementieren**

Create `packages/server/src/engine/alienHomeGuard.ts`:

```typescript
/**
 * Guardrail: keep alien faction homes far from the human origin (0,0).
 * Pure, DB-free helpers so they can be unit-tested in isolation.
 */

export interface FactionHome {
  faction_id: string;
  home_qx: number;
  home_qy: number;
}

/** Distance (in sectors, per axis) from origin to the nearest edge of a quadrant. */
function nearestAxisDistance(q: number, quadrantSize: number): number {
  if (q > 0) return q * quadrantSize;
  if (q < 0) return Math.abs(q) * quadrantSize - (quadrantSize - 1);
  return 0;
}

/**
 * Chebyshev distance from origin to the closest sector contained in quadrant (qx,qy).
 * Each axis is independent, so the closest sector minimises both axes simultaneously.
 */
export function quadrantNearestSectorDistance(
  qx: number,
  qy: number,
  quadrantSize: number,
): number {
  return Math.max(
    nearestAxisDistance(qx, quadrantSize),
    nearestAxisDistance(qy, quadrantSize),
  );
}

/**
 * Throws if any non-human faction home is closer than minDist sectors to origin.
 * Used as a startup guardrail after alien homes are seeded.
 */
export function assertAlienHomesFarFromOrigin(
  homes: FactionHome[],
  quadrantSize: number,
  minDist: number,
): void {
  for (const h of homes) {
    if (h.faction_id === 'human' || h.faction_id === 'humans') continue;
    const dist = quadrantNearestSectorDistance(h.home_qx, h.home_qy, quadrantSize);
    if (dist < minDist) {
      throw new Error(
        `Alien home "${h.faction_id}" at quadrant (${h.home_qx},${h.home_qy}) is only ` +
          `${dist} sectors from origin (minimum ${minDist}).`,
      );
    }
  }
}
```

- [ ] **Step 4: Test laufen lassen — muss passen**

Run: `cd packages/server && npx vitest run src/engine/__tests__/alienHomeGuard.test.ts`
Expected: PASS.

- [ ] **Step 5: Assertion in universeBootstrap verdrahten**

In `packages/server/src/engine/universeBootstrap.ts`:

5a. Imports oben ergänzen:

```typescript
import { QUADRANT_SIZE } from '@void-sector/shared';
import { getAllFactionConfigs } from '../db/queries.js';
import { assertAlienHomesFarFromOrigin } from './alienHomeGuard.js';
```

5b. In `startUniverseEngine()` direkt nach der Zeile
`const alienSeeded = await ensureAlienHomeQuadrants();` einfügen:

```typescript
  const factionHomes = await getAllFactionConfigs();
  assertAlienHomesFarFromOrigin(factionHomes, QUADRANT_SIZE, 1000);
```

> Hinweis: `getAllFactionConfigs()` liefert Zeilen mit `faction_id`, `home_qx`, `home_qy` (siehe `ensureAlienHomeQuadrants`). Falls der Typname beim Import abweicht, nur die Funktion importieren — die `FactionHome`-Felder passen strukturell.

- [ ] **Step 6: Server-Build prüfen (Typecheck der Verdrahtung)**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "universeBootstrap|alienHomeGuard" || echo "no type errors in touched files"`
Expected: `no type errors in touched files`.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/engine/alienHomeGuard.ts packages/server/src/engine/__tests__/alienHomeGuard.test.ts packages/server/src/engine/universeBootstrap.ts
git commit -m "feat: startup guardrail asserting alien homes >=1000 sectors from origin"
```

---

## Task 6: Accounts-erhaltendes Welt-Reset-Script

**Files:**
- Create: `packages/server/src/scripts/resetWorld.ts`
- Create: `packages/server/src/scripts/__tests__/resetWorld.test.ts`
- Modify: `packages/server/package.json` (npm-Script)

> Designnote: Position liegt in Redis (`player:pos:*`) → Flush genügt; auf `lastPosition ?? {0,0}` startet der Spieler an der Base (0,0). Schiff wird in `SectorRoom.onJoin` lazy neu erzeugt (inkl. Starter-Modulen + 100 Credits), wenn kein aktives Schiff existiert. ACEP-XP sind Spalten auf `ships` → werden durch Löschen der Schiffe automatisch zurückgesetzt. Das Script muss daher nur löschen + Scalars zurücksetzen + Redis flushen; den Rest erledigt der nächste Login.

- [ ] **Step 1: Test für die Tabellenlisten schreiben (Failing)**

Create `packages/server/src/scripts/__tests__/resetWorld.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WORLD_RESET_TABLES, PLAYER_PROGRESS_TABLES } from '../resetWorld.js';

describe('resetWorld table lists', () => {
  it('never deletes the players account table', () => {
    expect(WORLD_RESET_TABLES).not.toContain('players');
    expect(PLAYER_PROGRESS_TABLES).not.toContain('players');
  });

  it('wipes core world + expansion tables', () => {
    for (const t of ['sectors', 'quadrants', 'quadrant_control', 'expansion_log', 'civ_stations', 'civ_ships']) {
      expect(WORLD_RESET_TABLES).toContain(t);
    }
  });

  it('wipes per-player progress (ships reset ACEP) but not accounts', () => {
    for (const t of ['ships', 'cargo', 'inventory', 'player_discoveries']) {
      expect(PLAYER_PROGRESS_TABLES).toContain(t);
    }
  });

  it('orders ships after tables that reference it', () => {
    const idx = (t: string) => PLAYER_PROGRESS_TABLES.indexOf(t);
    expect(idx('ships')).toBeGreaterThan(idx('cargo'));
    expect(idx('ships')).toBeGreaterThan(idx('inventory'));
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd packages/server && npx vitest run src/scripts/__tests__/resetWorld.test.ts`
Expected: FAIL — `resetWorld.js` existiert nicht.

- [ ] **Step 3: Reset-Script implementieren**

Create `packages/server/src/scripts/resetWorld.ts`:

```typescript
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query, runMigrations } from '../db/client.js';
import { logger } from '../utils/logger.js';

dotenv.config();

/** World + cosmic + npc tables — fully cleared. Re-seeded on next server start. */
export const WORLD_RESET_TABLES = [
  'civ_ships',
  'civ_stations',
  'npc_station_inventory',
  'npc_station_data',
  'cosmic_npc_fleets',
  'npc_fleet',
  'construction_sites',
  'craft_sites',
  'wreck_slate_metadata',
  'ship_wrecks',
  'wrecks',
  'player_drones',
  'player_stations',
  'void_cluster_quadrants',
  'expansion_log',
  'quadrant_territory',
  'quadrant_control',
  'sectors',
  'quadrants',
];

/**
 * Per-player progress tables — rows deleted, but the `players` account rows are
 * kept. Order matters: children before parents (e.g. cargo/inventory before ships).
 */
export const PLAYER_PROGRESS_TABLES = [
  'cargo',
  'inventory',
  'storage_inventory',
  'acep_blueprints',
  'player_discoveries',
  'player_known_jumpgates',
  'player_known_quadrants',
  'player_quadrant_visits',
  'player_bookmarks',
  'autopilot_routes',
  'player_auto_refuel',
  'player_station_reputation',
  'player_reputation',
  'alien_reputation',
  'player_quests',
  'story_quest_progress',
  'player_research_v2',
  'player_modules_v2',
  'player_tech_tree',
  'player_upgrades',
  'player_civ_contributions',
  'player_distress_calls',
  'player_friends',
  'friend_requests',
  'player_blocks',
  'faction_invites',
  'faction_members',
  'faction_upgrades',
  'factions',
  'humanity_reputation',
  'civilization_meter',
  'messages',
  'ships',
];

async function deleteTable(table: string): Promise<void> {
  try {
    const del = await query(`DELETE FROM ${table}`);
    logger.info({ table, rowCount: del.rowCount }, 'Cleared table');
  } catch (err) {
    logger.info({ table, error: (err as Error).message }, 'Skipped table');
  }
}

async function resetWorld(): Promise<void> {
  await runMigrations();
  logger.info('Migrations complete');

  for (const table of WORLD_RESET_TABLES) await deleteTable(table);
  for (const table of PLAYER_PROGRESS_TABLES) await deleteTable(table);

  // Keep accounts, reset their scalar progress fields.
  try {
    const upd = await query(
      'UPDATE players SET xp = 0, level = 1, credits = 0, alien_credits = 0',
    );
    logger.info({ rowCount: upd.rowCount }, 'Reset player scalar fields');
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to reset player fields');
  }

  // Flush Redis (AP / fuel / mining / position / online caches).
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await redis.flushall();
  await redis.quit();
  logger.info('Redis flushed');

  logger.info(
    'Reset complete. Restart the server — ensure* functions re-seed the fresh world ' +
      '(Kernwelt station @0:0, Zentrum quadrant, alien homes).',
  );
  process.exit(0);
}

// Only auto-run when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.endsWith('resetWorld.ts')
  || process.argv[1]?.endsWith('resetWorld.js');
if (invokedDirectly) {
  resetWorld().catch((err) => {
    logger.error({ err }, 'Reset failed');
    process.exit(1);
  });
}
```

- [ ] **Step 4: Test laufen lassen — muss passen**

Run: `cd packages/server && npx vitest run src/scripts/__tests__/resetWorld.test.ts`
Expected: PASS (das Importieren des Moduls löst dank `invokedDirectly`-Guard keinen DB/Redis-Zugriff aus).

- [ ] **Step 5: npm-Script ergänzen**

In `packages/server/package.json` im `scripts`-Block die `test`-Zeile um eine weitere Zeile ergänzen:

```json
    "test": "vitest run",
    "reset:world": "tsx src/scripts/resetWorld.ts"
```

(Komma nach `"vitest run"` nicht vergessen.)

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/scripts/resetWorld.ts packages/server/src/scripts/__tests__/resetWorld.test.ts packages/server/package.json
git commit -m "feat: accounts-preserving world reset script (resetWorld.ts)"
```

---

## Task 7: Gesamt-Verifikation & Doku

**Files:** keine Code-Änderung (nur Verifikation + ggf. CLAUDE.md-Notiz)

- [ ] **Step 1: Shared bauen + alle Test-Suites laufen lassen**

Run:
```bash
cd packages/shared && npm run build && npx vitest run
cd ../server && npx vitest run
```
Expected: alle PASS. Falls vereinzelte Tests durch geänderte Konstanten brechen (z. B. Annahmen über 1 % Anomalie-Anteil oder alte Nebel-Abdeckung), an die neue Spec anpassen — Werte aus dieser Plan-Datei sind maßgeblich.

- [ ] **Step 2: Reset lokal ausführen (gegen laufende DB/Redis)**

> Destruktiv — nur auf der gewünschten Umgebung ausführen. Voraussetzung: `docker compose up -d` (postgres, redis) läuft, Server **gestoppt**.

Run: `cd packages/server && npm run reset:world`
Expected: Logs „Cleared table …" für die Welt-/Progress-Tabellen, „Reset player scalar fields", „Redis flushed", „Reset complete …".

- [ ] **Step 3: Server starten und frische Welt prüfen**

```bash
docker compose up -d   # bzw. npm run dev:server
```
Dann prüfen, dass (0,0) eine Station ist und (0,0)=humans kontrolliert wird:
```bash
docker exec voidsector-postgres-1 bash -c 'psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT type FROM sectors WHERE x=0 AND y=0; SELECT controlling_faction FROM quadrant_control WHERE qx=0 AND qy=0; SELECT COUNT(*) AS alien_controlled FROM quadrant_control WHERE controlling_faction NOT IN (\"humans\");"'
```
Expected: `type=station`, `controlling_faction=humans`, und nur die wenigen Alien-Home-Quadranten kontrolliert (keine ~76k mehr). Der Server darf nicht mit der Alien-Distanz-Assertion abbrechen.

- [ ] **Step 4: Commit (falls Test-Anpassungen aus Step 1 nötig waren)**

```bash
git add -A
git commit -m "test: align remaining worldgen tests with reset/seed/nebula/anomaly changes"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung:**
- Seed ändern → Task 1 ✓
- Single Base 0:0 → Task 4 (`HUMAN_STARTING_TERRITORY=[[0,0]]`) + bestehende `ensureKernweltStation` (Task 7 Step 3 verifiziert) ✓
- Aliens ≥ 1000 Sektoren → Task 5 (Guardrail) + Reset entfernt Über-Expansion (Task 6) ✓
- Anomalien 0,01 % / 10 % → Task 3 ✓
- Nebel 5 %, Cluster ≥ 12 → Task 2 (mit Mess-Daten verifiziert) ✓
- Welt-Reset, Accounts behalten → Task 6 ✓

**Placeholder-Scan:** keine TBD/TODO; alle Schritte enthalten konkreten Code/Befehle. ✓

**Typ-Konsistenz:** `anomalyChanceForEnvironment(env: SectorEnvironment)` konsistent in Task 3 verwendet; `WORLD_RESET_TABLES`/`PLAYER_PROGRESS_TABLES` als benannte Exports in Task 6 definiert und in Tests referenziert; `quadrantNearestSectorDistance`/`assertAlienHomesFarFromOrigin`/`FactionHome` in Task 5 konsistent. ✓

**Bekannte Risiken / Hinweise für den Umsetzer:**
- Reset-Tabellennamen wie `player_research_v2`/`player_modules_v2`: falls Schema abweicht, fängt der `try/catch`-Skip in `deleteTable` das ab (Pattern aus bestehendem `reseed.ts`).
- Falls weitere Tests (außerhalb der hier genannten) alte Worldgen-Annahmen kodieren, in Task 7 Step 1 anpassen.
