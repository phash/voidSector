# Lebendiges Universum — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dynamisches Universum mit NPC-Fraktionsexpansion, Territoriumskontrolle und spielergetriebener Menschheitszivilisation.

**Architecture:** Server-side Universe Tick (5s) außerhalb der Colyseus-Rooms als eigenständiger Service. Fraktionsterritorium wird pro Quadrant in DB berechnet. NPC-Expansion läuft als Simulation auf Tick-Basis ohne Echtzeit-Physik.

**Tech Stack:** PostgreSQL (Territory/Fleet tables), Redis (Tick-State-Cache), Colyseus (Room-Integration), pino (Logging), Vitest (Tests)

**Abhängigkeiten:** Phase 2 (#162) muss zuerst implementiert sein (Sektortypen, POI-System). Alien Quest System (#170) läuft parallel und nutzt die hier aufgebauten Fraktionsdaten.

**Kontext:**
- Bestehender `FactionService.ts` = Spieler-Gilden (getrennt!)
- Hier neu: **Cosmic Factions** = KI-gesteuerte Zivilisationen (Humans, Archivare, K'thari etc.)
- Bestehende NPC-Fraktionen (`traders/scientists/pirates/ancients`) bleiben, werden aber in cosmic factions eingebettet
- Kein live Server, kein Datenverlust → fresh seed nach Rebuild

---

## Überblick der Phasen

| Phase | Issue | Inhalt |
|-------|-------|--------|
| LU-1 | #163 (nach) | Cosmic Faction DB + TerritoryService |
| LU-2 | neu | UniverseTickEngine (5s-Loop) |
| LU-3 | neu | NPC Expansion Cycle (Frachter + Koloniegründung) |
| LU-4 | neu | Human Civilization Meter (Spielerbeiträge) |
| LU-5 | neu | Visible Economy + QUAD-MAP Faction Colors |

---

## Phase LU-1: Cosmic Faction Foundation

### Task 1.1: Constants für Cosmic Factions (shared)

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.ts`

**Step 1: Constants schreiben (failing test zuerst)**

```typescript
// packages/shared/src/constants.ts — ergänzen

export const COSMIC_FACTION_IDS = [
  'humans', 'archivists', 'consortium', 'kthari',
  'mycelians', 'mirror_minds', 'tourist_guild',
  'silent_swarm', 'helions', 'axioms', 'scrappers'
] as const;
export type CosmicFactionId = typeof COSMIC_FACTION_IDS[number];

// Startterritorie der Menschheit: Quadranten 0:0 bis 4:4 (25 Quadranten)
export const HUMAN_STARTING_TERRITORY: Array<[number, number]> = [
  [0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],
  [0,3],[1,3],[2,3],[3,0],[3,1],[3,2],[3,3],[4,0],[4,1],
  [4,2],[4,3],[0,4],[1,4],[2,4],[3,4],[4,4]
];

// Alien-Startgebiete (verstreut, nicht überlappend mit Menschen)
export const ALIEN_STARTING_REGIONS: Record<CosmicFactionId, { qx: number; qy: number; radius: number }[]> = {
  humans: [], // defined by HUMAN_STARTING_TERRITORY
  archivists: [{ qx: 95, qy: 105, radius: 3 }, { qx: 110, qy: 90, radius: 2 }],
  consortium: [{ qx: 200, qy: 210, radius: 4 }],
  kthari: [{ qx: 270, qy: 280, radius: 5 }, { qx: 290, qy: 260, radius: 3 }],
  mycelians: [{ qx: 410, qy: 420, radius: 3 }],
  mirror_minds: [{ qx: 550, qy: 560, radius: 2 }],
  tourist_guild: [{ qx: 690, qy: 700, radius: 6 }],
  silent_swarm: [{ qx: 1090, qy: 1100, radius: 8 }],
  helions: [{ qx: 1400, qy: 1390, radius: 4 }],
  axioms: [{ qx: 2800, qy: 2790, radius: 2 }],
  scrappers: [{ qx: 65, qy: 70, radius: 2 }, { qx: 80, qy: 65, radius: 2 }],
};

// Territorial expansion speed (Ticks zwischen Expansionsschritten)
export const FACTION_EXPANSION_INTERVAL_TICKS = 360; // 30 Min bei 5s-Tick
export const FACTION_MAX_STATIONS_PER_QUADRANT = 5;
export const UNIVERSE_TICK_MS = 5_000; // 5 Sekunden
```

**Step 2: Types ergänzen**

```typescript
// packages/shared/src/types.ts — ergänzen

export interface CosmicFaction {
  id: CosmicFactionId;
  name: string;
  color: string; // hex, für QUAD-MAP
  description: string;
  expansionRate: number; // 0.0–1.0, relativ zu humans
  minDistanceFromOrigin: number; // Sektoren, ab wann sie aktiv sind
}

export interface QuadrantTerritory {
  quadrantX: number;
  quadrantY: number;
  dominantFaction: CosmicFactionId | null;
  factionShares: Record<string, number>; // factionId → 0–100%
  totalStations: number;
  lastUpdated: number; // Unix timestamp
}

export interface CosmicNpcFleet {
  id: string;
  factionId: CosmicFactionId;
  type: 'freighter' | 'mining' | 'military' | 'scout';
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
  targetQuadrantX: number | null;
  targetQuadrantY: number | null;
  targetSectorX: number | null;
  targetSectorY: number | null;
  cargoOre: number;
  cargoGas: number;
  cargoCrystal: number;
  ticksToTarget: number;
  state: 'idle' | 'mining' | 'traveling' | 'building' | 'patrolling';
}
```

**Step 3: Test schreiben**

```typescript
// packages/shared/src/__tests__/cosmicFactions.test.ts

import { describe, it, expect } from 'vitest';
import {
  COSMIC_FACTION_IDS, HUMAN_STARTING_TERRITORY,
  ALIEN_STARTING_REGIONS, FACTION_EXPANSION_INTERVAL_TICKS
} from '../constants.js';

describe('CosmicFaction constants', () => {
  it('has humans as first faction', () => {
    expect(COSMIC_FACTION_IDS[0]).toBe('humans');
  });

  it('has 25 human starting quadrants', () => {
    expect(HUMAN_STARTING_TERRITORY).toHaveLength(25);
  });

  it('alien starting regions do not overlap with human territory (0:0 to 4:4)', () => {
    const humanSet = new Set(HUMAN_STARTING_TERRITORY.map(([x, y]) => `${x}:${y}`));
    for (const [factionId, regions] of Object.entries(ALIEN_STARTING_REGIONS)) {
      if (factionId === 'humans') continue;
      for (const region of regions) {
        for (let dx = -region.radius; dx <= region.radius; dx++) {
          for (let dy = -region.radius; dy <= region.radius; dy++) {
            const key = `${region.qx + dx}:${region.qy + dy}`;
            expect(humanSet.has(key), `${factionId} overlaps humans at ${key}`).toBe(false);
          }
        }
      }
    }
  });

  it('expansion interval is positive', () => {
    expect(FACTION_EXPANSION_INTERVAL_TICKS).toBeGreaterThan(0);
  });
});
```

**Step 4: Tests laufen**
```bash
cd packages/shared && npx vitest run src/__tests__/cosmicFactions.test.ts
```
Erwartung: PASS (nur Constants, keine Implementierung nötig)

**Step 5: Commit**
```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts packages/shared/src/__tests__/cosmicFactions.test.ts
git commit -m "feat: add cosmic faction constants and types for living universe"
```

---

### Task 1.2: DB Migration 031 — Cosmic Factions + Territory

**Files:**
- Create: `packages/server/src/db/migrations/031_cosmic_factions.sql`
- Create: `packages/server/src/db/cosmicFactionQueries.ts`

**Step 1: SQL Migration schreiben**

```sql
-- packages/server/src/db/migrations/031_cosmic_factions.sql

-- Cosmic faction Stammdaten
CREATE TABLE IF NOT EXISTS cosmic_factions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#888888',
  description TEXT,
  expansion_rate FLOAT NOT NULL DEFAULT 0.5,
  min_distance_from_origin INTEGER NOT NULL DEFAULT 0,
  total_stations INTEGER NOT NULL DEFAULT 0,
  total_quadrants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quadrant-Territorium (pro Quadrant)
CREATE TABLE IF NOT EXISTS quadrant_territory (
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  dominant_faction_id VARCHAR(50) REFERENCES cosmic_factions(id),
  faction_shares JSONB NOT NULL DEFAULT '{}',
  total_stations INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (quadrant_x, quadrant_y)
);
CREATE INDEX IF NOT EXISTS idx_quadrant_territory_dominant ON quadrant_territory(dominant_faction_id);

-- NPC Kosmische Stationen (NPC-Fraktion-owned, nicht Spieler-Stationen)
CREATE TABLE IF NOT EXISTS cosmic_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id VARCHAR(50) NOT NULL REFERENCES cosmic_factions(id),
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  station_level INTEGER NOT NULL DEFAULT 1,
  station_type VARCHAR(30) NOT NULL DEFAULT 'colony', -- 'homeworld'|'colony'|'outpost'|'military'
  resources_ore INTEGER NOT NULL DEFAULT 0,
  resources_gas INTEGER NOT NULL DEFAULT 0,
  resources_crystal INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  founded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cosmic_stations_faction ON cosmic_stations(faction_id);
CREATE INDEX IF NOT EXISTS idx_cosmic_stations_quadrant ON cosmic_stations(quadrant_x, quadrant_y);

-- NPC-Flotten (bewegliche Schiffe)
CREATE TABLE IF NOT EXISTS cosmic_npc_fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id VARCHAR(50) NOT NULL REFERENCES cosmic_factions(id),
  fleet_type VARCHAR(20) NOT NULL DEFAULT 'freighter', -- 'freighter'|'mining'|'military'|'scout'
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  target_quadrant_x INTEGER,
  target_quadrant_y INTEGER,
  target_sector_x INTEGER,
  target_sector_y INTEGER,
  cargo_ore INTEGER NOT NULL DEFAULT 0,
  cargo_gas INTEGER NOT NULL DEFAULT 0,
  cargo_crystal INTEGER NOT NULL DEFAULT 0,
  ticks_to_target INTEGER NOT NULL DEFAULT 0,
  state VARCHAR(20) NOT NULL DEFAULT 'idle', -- 'idle'|'mining'|'traveling'|'building'|'patrolling'
  home_station_id UUID REFERENCES cosmic_stations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cosmic_npc_fleets_faction ON cosmic_npc_fleets(faction_id);
CREATE INDEX IF NOT EXISTS idx_cosmic_npc_fleets_quadrant ON cosmic_npc_fleets(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_cosmic_npc_fleets_state ON cosmic_npc_fleets(state);

-- Human Civilization Meter (Spielerbeiträge)
CREATE TABLE IF NOT EXISTS human_civilization (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- single row
  expansion_score INTEGER NOT NULL DEFAULT 0,
  total_stations_built INTEGER NOT NULL DEFAULT 0,
  total_ore_mined BIGINT NOT NULL DEFAULT 0,
  total_transports_completed INTEGER NOT NULL DEFAULT 0,
  total_convoys_protected INTEGER NOT NULL DEFAULT 0,
  last_expansion_tick BIGINT NOT NULL DEFAULT 0,
  ticks_to_next_expansion INTEGER NOT NULL DEFAULT 360,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Universe tick counter (global state)
CREATE TABLE IF NOT EXISTS universe_tick_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_tick BIGINT NOT NULL DEFAULT 0,
  last_tick_at TIMESTAMPTZ,
  tick_duration_ms INTEGER NOT NULL DEFAULT 5000,
  is_running BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: Basis-Fraktionsdaten
INSERT INTO cosmic_factions (id, name, color, expansion_rate, min_distance_from_origin) VALUES
  ('humans',       'Menschheit',           '#4488ff', 1.0,   0),
  ('archivists',   'Die Archivare',        '#88ffcc', 0.3, 140000),
  ('consortium',   'Das Konsortium',       '#ffaa44', 0.4, 210000),
  ('kthari',       'K''thari Dominion',    '#ff4444', 0.6, 280000),
  ('mycelians',    'Die Mycelianer',       '#44ff88', 0.2, 420000),
  ('mirror_minds', 'Mirror Minds',         '#cc88ff', 0.2, 560000),
  ('tourist_guild','Touristengilde',       '#ffff44', 0.5, 700000),
  ('silent_swarm', 'Silent Swarm',         '#ff8844', 0.8, 1100000),
  ('helions',      'Helion Kollektiv',     '#ff44ff', 0.3, 1400000),
  ('axioms',       'Die Axiome',           '#ffffff', 0.1, 2800000),
  ('scrappers',    'Die Scrappers',        '#aaaaaa', 0.7,  70000)
ON CONFLICT (id) DO NOTHING;

-- Initial universe tick state
INSERT INTO universe_tick_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO human_civilization (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

**Step 2: Query-Funktionen schreiben**

```typescript
// packages/server/src/db/cosmicFactionQueries.ts
import { pool } from './client.js';
import type { CosmicFactionId, QuadrantTerritory, CosmicNpcFleet } from '@voidsector/shared';

export async function getCosmicFaction(factionId: CosmicFactionId) {
  const r = await pool.query(
    'SELECT * FROM cosmic_factions WHERE id = $1',
    [factionId]
  );
  return r.rows[0] ?? null;
}

export async function getAllCosmicFactions() {
  const r = await pool.query('SELECT * FROM cosmic_factions ORDER BY min_distance_from_origin');
  return r.rows;
}

export async function getQuadrantTerritory(qx: number, qy: number): Promise<QuadrantTerritory | null> {
  const r = await pool.query(
    'SELECT * FROM quadrant_territory WHERE quadrant_x = $1 AND quadrant_y = $2',
    [qx, qy]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    quadrantX: row.quadrant_x,
    quadrantY: row.quadrant_y,
    dominantFaction: row.dominant_faction_id,
    factionShares: row.faction_shares,
    totalStations: row.total_stations,
    lastUpdated: new Date(row.last_updated).getTime(),
  };
}

export async function upsertQuadrantTerritory(territory: QuadrantTerritory): Promise<void> {
  await pool.query(
    `INSERT INTO quadrant_territory
       (quadrant_x, quadrant_y, dominant_faction_id, faction_shares, total_stations, last_updated)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (quadrant_x, quadrant_y) DO UPDATE SET
       dominant_faction_id = EXCLUDED.dominant_faction_id,
       faction_shares = EXCLUDED.faction_shares,
       total_stations = EXCLUDED.total_stations,
       last_updated = NOW()`,
    [
      territory.quadrantX, territory.quadrantY,
      territory.dominantFaction,
      JSON.stringify(territory.factionShares),
      territory.totalStations,
    ]
  );
}

export async function getCosmicStationsInQuadrant(qx: number, qy: number) {
  const r = await pool.query(
    'SELECT * FROM cosmic_stations WHERE quadrant_x = $1 AND quadrant_y = $2 AND is_active = true',
    [qx, qy]
  );
  return r.rows;
}

export async function createCosmicStation(params: {
  factionId: CosmicFactionId;
  qx: number; qy: number;
  sx: number; sy: number;
  stationType: string;
}): Promise<string> {
  const r = await pool.query(
    `INSERT INTO cosmic_stations
       (faction_id, quadrant_x, quadrant_y, sector_x, sector_y, station_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [params.factionId, params.qx, params.qy, params.sx, params.sy, params.stationType]
  );
  return r.rows[0].id;
}

export async function getFleetsForFaction(factionId: CosmicFactionId): Promise<CosmicNpcFleet[]> {
  const r = await pool.query(
    'SELECT * FROM cosmic_npc_fleets WHERE faction_id = $1',
    [factionId]
  );
  return r.rows.map(mapFleetRow);
}

export async function getFleetsInQuadrant(qx: number, qy: number): Promise<CosmicNpcFleet[]> {
  const r = await pool.query(
    'SELECT * FROM cosmic_npc_fleets WHERE quadrant_x = $1 AND quadrant_y = $2',
    [qx, qy]
  );
  return r.rows.map(mapFleetRow);
}

export async function upsertCosmicFleet(fleet: CosmicNpcFleet): Promise<void> {
  await pool.query(
    `INSERT INTO cosmic_npc_fleets
       (id, faction_id, fleet_type, quadrant_x, quadrant_y, sector_x, sector_y,
        target_quadrant_x, target_quadrant_y, target_sector_x, target_sector_y,
        cargo_ore, cargo_gas, cargo_crystal, ticks_to_target, state, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
     ON CONFLICT (id) DO UPDATE SET
       quadrant_x=EXCLUDED.quadrant_x, quadrant_y=EXCLUDED.quadrant_y,
       sector_x=EXCLUDED.sector_x, sector_y=EXCLUDED.sector_y,
       target_quadrant_x=EXCLUDED.target_quadrant_x, target_quadrant_y=EXCLUDED.target_quadrant_y,
       target_sector_x=EXCLUDED.target_sector_x, target_sector_y=EXCLUDED.target_sector_y,
       cargo_ore=EXCLUDED.cargo_ore, cargo_gas=EXCLUDED.cargo_gas, cargo_crystal=EXCLUDED.cargo_crystal,
       ticks_to_target=EXCLUDED.ticks_to_target, state=EXCLUDED.state, updated_at=NOW()`,
    [
      fleet.id, fleet.factionId, fleet.type,
      fleet.quadrantX, fleet.quadrantY, fleet.sectorX, fleet.sectorY,
      fleet.targetQuadrantX, fleet.targetQuadrantY, fleet.targetSectorX, fleet.targetSectorY,
      fleet.cargoOre, fleet.cargoGas, fleet.cargoCrystal,
      fleet.ticksToTarget, fleet.state,
    ]
  );
}

export async function getCurrentTick(): Promise<number> {
  const r = await pool.query('SELECT current_tick FROM universe_tick_state WHERE id = 1');
  return r.rows[0]?.current_tick ?? 0;
}

export async function incrementTick(): Promise<number> {
  const r = await pool.query(
    `UPDATE universe_tick_state
     SET current_tick = current_tick + 1, last_tick_at = NOW(), updated_at = NOW()
     WHERE id = 1
     RETURNING current_tick`
  );
  return r.rows[0].current_tick;
}

export async function getHumanCivilization() {
  const r = await pool.query('SELECT * FROM human_civilization WHERE id = 1');
  return r.rows[0];
}

export async function addToHumanExpansionScore(amount: number): Promise<void> {
  await pool.query(
    `UPDATE human_civilization SET
       expansion_score = expansion_score + $1,
       updated_at = NOW()
     WHERE id = 1`,
    [amount]
  );
}

function mapFleetRow(row: any): CosmicNpcFleet {
  return {
    id: row.id,
    factionId: row.faction_id,
    type: row.fleet_type,
    quadrantX: row.quadrant_x, quadrantY: row.quadrant_y,
    sectorX: row.sector_x, sectorY: row.sector_y,
    targetQuadrantX: row.target_quadrant_x, targetQuadrantY: row.target_quadrant_y,
    targetSectorX: row.target_sector_x, targetSectorY: row.target_sector_y,
    cargoOre: row.cargo_ore, cargoGas: row.cargo_gas, cargoCrystal: row.cargo_crystal,
    ticksToTarget: row.ticks_to_target,
    state: row.state,
  };
}
```

**Step 3: Test für Queries schreiben** (Integration-Test mit Test-DB)

```typescript
// packages/server/src/__tests__/cosmicFactionQueries.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAllCosmicFactions, getCosmicFaction } from '../db/cosmicFactionQueries.js';

// Nur ausführen wenn TEST_DB_URL gesetzt (CI/CD Integration tests)
const runIntegration = !!process.env.TEST_DB_URL;

describe.skipIf(!runIntegration)('CosmicFactionQueries', () => {
  it('returns seeded factions', async () => {
    const factions = await getAllCosmicFactions();
    expect(factions.length).toBeGreaterThanOrEqual(11);
    const humans = factions.find(f => f.id === 'humans');
    expect(humans).toBeDefined();
    expect(humans.expansion_rate).toBe(1.0);
  });

  it('getCosmicFaction returns null for unknown id', async () => {
    const r = await getCosmicFaction('unknown_faction' as any);
    expect(r).toBeNull();
  });
});
```

**Step 4: Migration testen**
```bash
cd packages/server && npx vitest run src/__tests__/cosmicFactionQueries.test.ts
```

**Step 5: Commit**
```bash
git add packages/server/src/db/migrations/031_cosmic_factions.sql
git add packages/server/src/db/cosmicFactionQueries.ts
git add packages/server/src/__tests__/cosmicFactionQueries.test.ts
git commit -m "feat: add cosmic faction DB migration 031 and queries"
```

---

### Task 1.3: TerritoryService

**Files:**
- Create: `packages/server/src/engine/territoryEngine.ts`
- Create: `packages/server/src/__tests__/territoryEngine.test.ts`

**Step 1: Test schreiben**

```typescript
// packages/server/src/__tests__/territoryEngine.test.ts
import { describe, it, expect } from 'vitest';
import { calculateQuadrantControl, seedHumanStartingTerritory } from '../engine/territoryEngine.js';

describe('TerritoryEngine', () => {
  describe('calculateQuadrantControl', () => {
    it('returns null dominant faction for empty quadrant', () => {
      const result = calculateQuadrantControl([]);
      expect(result.dominantFaction).toBeNull();
      expect(result.factionShares).toEqual({});
      expect(result.totalStations).toBe(0);
    });

    it('returns single faction as dominant when no competition', () => {
      const stations = [
        { faction_id: 'humans', station_level: 1 },
        { faction_id: 'humans', station_level: 2 },
        { faction_id: 'humans', station_level: 1 },
      ];
      const result = calculateQuadrantControl(stations);
      expect(result.dominantFaction).toBe('humans');
      expect(result.factionShares['humans']).toBe(100);
      expect(result.totalStations).toBe(3);
    });

    it('calculates contested quadrant shares by station level', () => {
      const stations = [
        { faction_id: 'humans', station_level: 3 },  // weight: 3
        { faction_id: 'kthari', station_level: 1 },   // weight: 1
        { faction_id: 'kthari', station_level: 1 },   // weight: 1
      ];
      const result = calculateQuadrantControl(stations);
      // total weight = 5: humans 60%, kthari 40%
      expect(result.dominantFaction).toBe('humans');
      expect(result.factionShares['humans']).toBeCloseTo(60, 0);
      expect(result.factionShares['kthari']).toBeCloseTo(40, 0);
    });

    it('returns contested when ≤50% for any faction', () => {
      const stations = [
        { faction_id: 'humans', station_level: 1 },
        { faction_id: 'kthari', station_level: 1 },
      ];
      const result = calculateQuadrantControl(stations);
      // 50/50 — dominant is the one with more stations (tie: first alphabetically)
      expect(result.factionShares['humans']).toBe(50);
      expect(result.factionShares['kthari']).toBe(50);
    });
  });

  describe('seedHumanStartingTerritory', () => {
    it('generates territory entries for all 25 human starting quadrants', () => {
      const territories = seedHumanStartingTerritory();
      expect(territories).toHaveLength(25);
      territories.forEach(t => {
        expect(t.dominantFaction).toBe('humans');
        expect(t.factionShares['humans']).toBe(100);
      });
    });
  });
});
```

**Step 2: Test ausführen (FAIL erwartet)**
```bash
cd packages/server && npx vitest run src/__tests__/territoryEngine.test.ts
```
Erwartung: FAIL — "cannot find module"

**Step 3: TerritoryEngine implementieren**

```typescript
// packages/server/src/engine/territoryEngine.ts
import { HUMAN_STARTING_TERRITORY, ALIEN_STARTING_REGIONS } from '@voidsector/shared';
import type { CosmicFactionId, QuadrantTerritory } from '@voidsector/shared';
import { logger } from '../utils/logger.js';

interface StationWeight {
  faction_id: string;
  station_level: number;
}

export function calculateQuadrantControl(stations: StationWeight[]): QuadrantTerritory {
  if (stations.length === 0) {
    return {
      quadrantX: 0, quadrantY: 0,
      dominantFaction: null,
      factionShares: {},
      totalStations: 0,
      lastUpdated: Date.now(),
    };
  }

  // Gewicht = station_level (Level 3 zählt 3x)
  const weights: Record<string, number> = {};
  for (const s of stations) {
    weights[s.faction_id] = (weights[s.faction_id] ?? 0) + s.station_level;
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const shares: Record<string, number> = {};
  for (const [fid, w] of Object.entries(weights)) {
    shares[fid] = Math.round((w / totalWeight) * 100);
  }

  // Dominant = höchster Anteil
  const dominant = Object.entries(shares).reduce(
    (best, [fid, pct]) => pct > best[1] ? [fid, pct] : best,
    ['', 0]
  )[0] as CosmicFactionId | '';

  return {
    quadrantX: 0, quadrantY: 0, // wird vom Aufrufer überschrieben
    dominantFaction: dominant || null,
    factionShares: shares,
    totalStations: stations.length,
    lastUpdated: Date.now(),
  };
}

export function seedHumanStartingTerritory(): QuadrantTerritory[] {
  return HUMAN_STARTING_TERRITORY.map(([qx, qy]) => ({
    quadrantX: qx,
    quadrantY: qy,
    dominantFaction: 'humans' as CosmicFactionId,
    factionShares: { humans: 100 },
    totalStations: 3, // Starter-Stationen pro Quadrant
    lastUpdated: Date.now(),
  }));
}

export function seedAlienStartingTerritories(): QuadrantTerritory[] {
  const territories: QuadrantTerritory[] = [];

  for (const [factionId, regions] of Object.entries(ALIEN_STARTING_REGIONS)) {
    if (factionId === 'humans') continue;
    for (const region of regions) {
      for (let dx = -region.radius; dx <= region.radius; dx++) {
        for (let dy = -region.radius; dy <= region.radius; dy++) {
          if (dx * dx + dy * dy > region.radius * region.radius) continue; // Kreis statt Quadrat
          territories.push({
            quadrantX: region.qx + dx,
            quadrantY: region.qy + dy,
            dominantFaction: factionId as CosmicFactionId,
            factionShares: { [factionId]: 100 },
            totalStations: 2 + Math.floor(Math.random() * 3), // 2–4 Stationen
            lastUpdated: Date.now(),
          });
        }
      }
    }
  }

  logger.info({ count: territories.length }, 'Seeded alien starting territories');
  return territories;
}

export async function recalculateQuadrantTerritory(
  qx: number, qy: number,
  stations: StationWeight[]
): Promise<QuadrantTerritory> {
  const result = calculateQuadrantControl(stations);
  return { ...result, quadrantX: qx, quadrantY: qy };
}
```

**Step 4: Tests ausführen (PASS)**
```bash
cd packages/server && npx vitest run src/__tests__/territoryEngine.test.ts
```
Erwartung: PASS alle 4 Tests

**Step 5: Commit**
```bash
git add packages/server/src/engine/territoryEngine.ts
git add packages/server/src/__tests__/territoryEngine.test.ts
git commit -m "feat: add TerritoryEngine with faction control calculation"
```

---

## Phase LU-2: Universe Tick Engine

### Task 2.1: UniverseTickService

**Files:**
- Create: `packages/server/src/engine/universeTickEngine.ts`
- Create: `packages/server/src/__tests__/universeTickEngine.test.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Test schreiben**

```typescript
// packages/server/src/__tests__/universeTickEngine.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniverseTickEngine } from '../engine/universeTickEngine.js';

describe('UniverseTickEngine', () => {
  let engine: UniverseTickEngine;

  beforeEach(() => {
    engine = new UniverseTickEngine({ tickIntervalMs: 100, enabled: true });
  });

  afterEach(() => {
    engine.stop();
  });

  it('starts and increments tick count', async () => {
    await engine.start();
    await new Promise(r => setTimeout(r, 250));
    expect(engine.getCurrentTick()).toBeGreaterThanOrEqual(2);
    engine.stop();
  });

  it('calls registered tick handlers', async () => {
    const handler = vi.fn();
    engine.registerHandler('test', handler);
    await engine.start();
    await new Promise(r => setTimeout(r, 150));
    engine.stop();
    expect(handler).toHaveBeenCalledWith(expect.any(Number)); // tick number
  });

  it('does not start when disabled', async () => {
    const disabledEngine = new UniverseTickEngine({ tickIntervalMs: 100, enabled: false });
    await disabledEngine.start();
    await new Promise(r => setTimeout(r, 250));
    expect(disabledEngine.getCurrentTick()).toBe(0);
  });

  it('unregisters handlers', async () => {
    const handler = vi.fn();
    engine.registerHandler('test', handler);
    engine.unregisterHandler('test');
    await engine.start();
    await new Promise(r => setTimeout(r, 150));
    engine.stop();
    expect(handler).not.toHaveBeenCalled();
  });

  it('stop prevents further ticks', async () => {
    await engine.start();
    await new Promise(r => setTimeout(r, 150));
    const tickAfterStop = engine.getCurrentTick();
    engine.stop();
    await new Promise(r => setTimeout(r, 200));
    expect(engine.getCurrentTick()).toBe(tickAfterStop);
  });
});
```

**Step 2: Test ausführen (FAIL)**
```bash
cd packages/server && npx vitest run src/__tests__/universeTickEngine.test.ts
```

**Step 3: UniverseTickEngine implementieren**

```typescript
// packages/server/src/engine/universeTickEngine.ts
import { logger } from '../utils/logger.js';

type TickHandler = (tick: number) => Promise<void> | void;

interface TickEngineOptions {
  tickIntervalMs: number;
  enabled: boolean;
}

export class UniverseTickEngine {
  private handlers = new Map<string, TickHandler>();
  private currentTick = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly options: TickEngineOptions;
  private running = false;

  constructor(options: TickEngineOptions) {
    this.options = options;
  }

  registerHandler(name: string, handler: TickHandler): void {
    this.handlers.set(name, handler);
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  async start(): Promise<void> {
    if (!this.options.enabled) {
      logger.info('UniverseTickEngine disabled — skipping start');
      return;
    }
    if (this.running) return;
    this.running = true;
    logger.info({ intervalMs: this.options.tickIntervalMs }, 'UniverseTickEngine starting');

    this.intervalHandle = setInterval(async () => {
      if (!this.running) return;
      this.currentTick++;
      const tick = this.currentTick;
      const tickStart = Date.now();

      for (const [name, handler] of this.handlers) {
        try {
          await handler(tick);
        } catch (err) {
          logger.error({ err, handler: name, tick }, 'Tick handler error');
        }
      }

      const duration = Date.now() - tickStart;
      if (duration > this.options.tickIntervalMs * 0.8) {
        logger.warn({ tick, duration }, 'Tick took too long');
      }
    }, this.options.tickIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

// Singleton für den Server
let _instance: UniverseTickEngine | null = null;

export function getUniverseTickEngine(): UniverseTickEngine {
  if (!_instance) {
    _instance = new UniverseTickEngine({
      tickIntervalMs: parseInt(process.env.UNIVERSE_TICK_MS ?? '5000'),
      enabled: process.env.UNIVERSE_TICK_ENABLED !== 'false',
    });
  }
  return _instance;
}
```

**Step 4: In index.ts registrieren**

```typescript
// packages/server/src/index.ts — nach gameServer.listen():
import { getUniverseTickEngine } from './engine/universeTickEngine.js';

// nach dem gameServer-Start:
const tickEngine = getUniverseTickEngine();
await tickEngine.start();

// Graceful shutdown:
process.on('SIGTERM', () => {
  tickEngine.stop();
  // ... bestehender shutdown-code
});
```

**Step 5: Tests ausführen (PASS)**
```bash
cd packages/server && npx vitest run src/__tests__/universeTickEngine.test.ts
```
Erwartung: PASS alle 5 Tests

**Step 6: Commit**
```bash
git add packages/server/src/engine/universeTickEngine.ts
git add packages/server/src/__tests__/universeTickEngine.test.ts
git commit -m "feat: add UniverseTickEngine with 5s simulation loop"
```

---

### Task 2.2: TerritoryTickHandler (Tick-Integration)

**Files:**
- Create: `packages/server/src/engine/territoryTickHandler.ts`
- Create: `packages/server/src/__tests__/territoryTickHandler.test.ts`

**Step 1: Test schreiben**

```typescript
// packages/server/src/__tests__/territoryTickHandler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerritoryTickHandler } from '../engine/territoryTickHandler.js';

// Mock der DB-Queries
vi.mock('../db/cosmicFactionQueries.js', () => ({
  getCosmicStationsInQuadrant: vi.fn().mockResolvedValue([]),
  upsertQuadrantTerritory: vi.fn().mockResolvedValue(undefined),
  getCurrentTick: vi.fn().mockResolvedValue(0),
  incrementTick: vi.fn().mockResolvedValue(1),
}));

describe('TerritoryTickHandler', () => {
  let handler: TerritoryTickHandler;

  beforeEach(() => {
    handler = new TerritoryTickHandler();
    vi.clearAllMocks();
  });

  it('creates handler instance', () => {
    expect(handler).toBeDefined();
    expect(handler.handle).toBeDefined();
  });

  it('handle() runs without error on tick 1', async () => {
    await expect(handler.handle(1)).resolves.not.toThrow();
  });

  it('tracks "dirty" quadrants that need territory recalculation', () => {
    handler.markQuadrantDirty(5, 10);
    expect(handler.getDirtyCount()).toBe(1);
    handler.markQuadrantDirty(5, 10); // duplicate
    expect(handler.getDirtyCount()).toBe(1);
    handler.markQuadrantDirty(6, 11);
    expect(handler.getDirtyCount()).toBe(2);
  });

  it('clears dirty queue after processing', async () => {
    handler.markQuadrantDirty(0, 0);
    await handler.handle(1);
    expect(handler.getDirtyCount()).toBe(0);
  });
});
```

**Step 2: Test ausführen (FAIL)**
```bash
cd packages/server && npx vitest run src/__tests__/territoryTickHandler.test.ts
```

**Step 3: TerritoryTickHandler implementieren**

```typescript
// packages/server/src/engine/territoryTickHandler.ts
import { getCosmicStationsInQuadrant, upsertQuadrantTerritory } from '../db/cosmicFactionQueries.js';
import { recalculateQuadrantTerritory } from './territoryEngine.js';
import { logger } from '../utils/logger.js';

export class TerritoryTickHandler {
  private dirtyQuadrants = new Set<string>();

  markQuadrantDirty(qx: number, qy: number): void {
    this.dirtyQuadrants.add(`${qx}:${qy}`);
  }

  getDirtyCount(): number {
    return this.dirtyQuadrants.size;
  }

  async handle(tick: number): Promise<void> {
    if (this.dirtyQuadrants.size === 0) return;

    const toProcess = [...this.dirtyQuadrants];
    this.dirtyQuadrants.clear();

    for (const key of toProcess) {
      const [qx, qy] = key.split(':').map(Number);
      try {
        const stations = await getCosmicStationsInQuadrant(qx, qy);
        const territory = await recalculateQuadrantTerritory(qx, qy, stations);
        await upsertQuadrantTerritory(territory);
      } catch (err) {
        logger.error({ err, qx, qy, tick }, 'Failed to recalculate quadrant territory');
      }
    }

    logger.debug({ tick, processed: toProcess.length }, 'Territory recalculation complete');
  }
}

// Singleton
let _territoryHandler: TerritoryTickHandler | null = null;
export function getTerritoryTickHandler(): TerritoryTickHandler {
  if (!_territoryHandler) _territoryHandler = new TerritoryTickHandler();
  return _territoryHandler;
}
```

**Step 4: Tests PASS**
```bash
cd packages/server && npx vitest run src/__tests__/territoryTickHandler.test.ts
```

**Step 5: Commit**
```bash
git add packages/server/src/engine/territoryTickHandler.ts
git add packages/server/src/__tests__/territoryTickHandler.test.ts
git commit -m "feat: add TerritoryTickHandler with dirty-queue pattern"
```

---

## Phase LU-3: NPC Expansion Cycle

### Task 3.1: CosmicExpansionEngine

**Files:**
- Create: `packages/server/src/engine/cosmicExpansionEngine.ts`
- Create: `packages/server/src/__tests__/cosmicExpansionEngine.test.ts`

Der Expansionszyklus:
```
Station produziert Ressourcen (Mining-Ticks)
→ Bei genug Ressourcen: Frachter spawnen
→ Frachter sucht benachbarten leeren Quadranten
→ Frachter reist (ticksToTarget)
→ Frachter baut neue Outpost-Station
→ TerritoryHandler wird dirty markiert
```

**Step 1: Test schreiben**

```typescript
// packages/server/src/__tests__/cosmicExpansionEngine.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  findExpansionTarget,
  calculateExpansionReadiness,
  shouldFactionExpand,
} from '../engine/cosmicExpansionEngine.js';

vi.mock('../db/cosmicFactionQueries.js', () => ({
  getQuadrantTerritory: vi.fn().mockResolvedValue(null), // null = free
  getCosmicStationsInQuadrant: vi.fn().mockResolvedValue([]),
  getAllCosmicFactions: vi.fn().mockResolvedValue([
    { id: 'humans', expansion_rate: 1.0, min_distance_from_origin: 0 }
  ]),
}));

describe('CosmicExpansionEngine', () => {
  describe('calculateExpansionReadiness', () => {
    it('returns 0 for empty station list', () => {
      expect(calculateExpansionReadiness([])).toBe(0);
    });

    it('returns higher score for more/higher-level stations', () => {
      const low = calculateExpansionReadiness([
        { resources_ore: 100, resources_gas: 50, station_level: 1 }
      ]);
      const high = calculateExpansionReadiness([
        { resources_ore: 500, resources_gas: 200, station_level: 3 },
        { resources_ore: 300, resources_gas: 100, station_level: 2 },
      ]);
      expect(high).toBeGreaterThan(low);
    });

    it('reaches threshold at 1000+ total resources', () => {
      const score = calculateExpansionReadiness([
        { resources_ore: 800, resources_gas: 400, station_level: 2 }
      ]);
      expect(score).toBeGreaterThan(0.9);
    });
  });

  describe('shouldFactionExpand', () => {
    it('returns false when expansion score is below threshold', () => {
      expect(shouldFactionExpand(0.3, 1.0, 1)).toBe(false);
    });

    it('returns true when score is high and tick aligns', () => {
      expect(shouldFactionExpand(1.0, 1.0, 360)).toBe(true);
    });

    it('respects faction expansion_rate (slow factions less likely)', () => {
      // Low expansion rate → higher bar required
      const fastFaction = shouldFactionExpand(0.8, 1.0, 360);
      const slowFaction = shouldFactionExpand(0.8, 0.2, 360);
      expect(fastFaction).toBe(true);
      expect(slowFaction).toBe(false);
    });
  });

  describe('findExpansionTarget', () => {
    it('returns a neighboring quadrant', async () => {
      const target = await findExpansionTarget(5, 5, 'humans');
      // Soll einer von 8 Nachbar-Quadranten sein
      expect(target).not.toBeNull();
      if (target) {
        const dx = Math.abs(target.qx - 5);
        const dy = Math.abs(target.qy - 5);
        expect(dx + dy).toBeGreaterThan(0);
        expect(dx).toBeLessThanOrEqual(2);
        expect(dy).toBeLessThanOrEqual(2);
      }
    });
  });
});
```

**Step 2: Test ausführen (FAIL)**
```bash
cd packages/server && npx vitest run src/__tests__/cosmicExpansionEngine.test.ts
```

**Step 3: CosmicExpansionEngine implementieren**

```typescript
// packages/server/src/engine/cosmicExpansionEngine.ts
import { getQuadrantTerritory } from '../db/cosmicFactionQueries.js';
import type { CosmicFactionId } from '@voidsector/shared';
import { FACTION_EXPANSION_INTERVAL_TICKS } from '@voidsector/shared';

interface StationForExpansion {
  resources_ore: number;
  resources_gas: number;
  station_level: number;
}

export function calculateExpansionReadiness(stations: StationForExpansion[]): number {
  if (stations.length === 0) return 0;

  const totalResources = stations.reduce(
    (sum, s) => sum + s.resources_ore + s.resources_gas,
    0
  );
  const totalLevel = stations.reduce((sum, s) => sum + s.station_level, 0);

  // Score 0–1: basiert auf Ressourcen (1000+) + Stationslevel
  const resourceScore = Math.min(totalResources / 1200, 1.0);
  const levelScore = Math.min(totalLevel / 8, 1.0);

  return resourceScore * 0.7 + levelScore * 0.3;
}

export function shouldFactionExpand(
  readinessScore: number,
  expansionRate: number,
  currentTick: number
): boolean {
  // Nur bei Expansion-Interval-Ticks
  if (currentTick % FACTION_EXPANSION_INTERVAL_TICKS !== 0) return false;

  // Threshold: Basis 0.7, modifiziert durch expansionRate
  const threshold = 0.7 / Math.max(expansionRate, 0.1);
  return readinessScore >= Math.min(threshold, 1.0);
}

export async function findExpansionTarget(
  fromQx: number, fromQy: number,
  factionId: CosmicFactionId
): Promise<{ qx: number; qy: number } | null> {
  // Prüfe alle 8 Nachbarn (+ diagonal)
  const candidates: Array<{ qx: number; qy: number; priority: number }> = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const qx = fromQx + dx;
      const qy = fromQy + dy;
      if (qx < 0 || qy < 0) continue;

      const territory = await getQuadrantTerritory(qx, qy);

      if (!territory || !territory.dominantFaction) {
        // Leer → bestes Ziel
        candidates.push({ qx, qy, priority: 10 });
      } else if (territory.dominantFaction === factionId) {
        // Eigenes Gebiet → niedrigere Prio (Stationsverstärkung)
        candidates.push({ qx, qy, priority: 1 });
      }
      // Feindliches Gebiet: nur militärische Fraktionen expandieren dort (TODO Phase LU-4)
    }
  }

  if (candidates.length === 0) return null;

  // Wähle bestes Ziel (höchste Prio, dann zufällig)
  const best = candidates.sort((a, b) => b.priority - a.priority);
  const topPrio = best[0].priority;
  const topCandidates = best.filter(c => c.priority === topPrio);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

export function calculateFleetTravelTicks(fromQx: number, fromQy: number, toQx: number, toQy: number): number {
  const distance = Math.sqrt((toQx - fromQx) ** 2 + (toQy - fromQy) ** 2);
  // 1 Quadrant = 12 Ticks (1 Minute bei 5s-Tick)
  return Math.max(1, Math.round(distance * 12));
}
```

**Step 4: Tests PASS**
```bash
cd packages/server && npx vitest run src/__tests__/cosmicExpansionEngine.test.ts
```

**Step 5: Commit**
```bash
git add packages/server/src/engine/cosmicExpansionEngine.ts
git add packages/server/src/__tests__/cosmicExpansionEngine.test.ts
git commit -m "feat: add CosmicExpansionEngine with NPC colonization logic"
```

---

### Task 3.2: ExpansionTickHandler (Verbindet alles)

**Files:**
- Create: `packages/server/src/engine/expansionTickHandler.ts`
- Create: `packages/server/src/__tests__/expansionTickHandler.test.ts`
- Modify: `packages/server/src/index.ts` (Handler registrieren)

**Step 1: Test schreiben**

```typescript
// packages/server/src/__tests__/expansionTickHandler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpansionTickHandler } from '../engine/expansionTickHandler.js';

vi.mock('../db/cosmicFactionQueries.js', () => ({
  getAllCosmicFactions: vi.fn().mockResolvedValue([
    { id: 'humans', expansion_rate: 1.0, min_distance_from_origin: 0 }
  ]),
  getCosmicStationsInQuadrant: vi.fn().mockResolvedValue([
    { faction_id: 'humans', station_level: 2, resources_ore: 600, resources_gas: 300,
      quadrant_x: 0, quadrant_y: 0, id: 'station-1' }
  ]),
  getFleetsForFaction: vi.fn().mockResolvedValue([]),
  upsertCosmicFleet: vi.fn().mockResolvedValue(undefined),
  createCosmicStation: vi.fn().mockResolvedValue('new-station-id'),
  getCurrentTick: vi.fn().mockResolvedValue(360),
}));

vi.mock('../engine/territoryTickHandler.js', () => ({
  getTerritoryTickHandler: () => ({ markQuadrantDirty: vi.fn() }),
}));

describe('ExpansionTickHandler', () => {
  let handler: ExpansionTickHandler;

  beforeEach(() => {
    handler = new ExpansionTickHandler();
    vi.clearAllMocks();
  });

  it('constructs without error', () => {
    expect(handler).toBeDefined();
  });

  it('handle() resolves without error', async () => {
    await expect(handler.handle(360)).resolves.not.toThrow();
  });

  it('skips ticks that are not expansion intervals', async () => {
    const { getAllCosmicFactions } = await import('../db/cosmicFactionQueries.js');
    await handler.handle(1); // nicht Tick 360
    // Bei Tick 1 sollte keine Expansion geprüft werden
    expect(vi.mocked(getAllCosmicFactions)).not.toHaveBeenCalled();
  });
});
```

**Step 2: Test ausführen (FAIL)**
```bash
cd packages/server && npx vitest run src/__tests__/expansionTickHandler.test.ts
```

**Step 3: ExpansionTickHandler implementieren**

```typescript
// packages/server/src/engine/expansionTickHandler.ts
import {
  getAllCosmicFactions, getCosmicStationsInQuadrant,
  getFleetsForFaction, upsertCosmicFleet, createCosmicStation,
} from '../db/cosmicFactionQueries.js';
import {
  calculateExpansionReadiness, shouldFactionExpand,
  findExpansionTarget, calculateFleetTravelTicks,
} from './cosmicExpansionEngine.js';
import { getTerritoryTickHandler } from './territoryTickHandler.js';
import { FACTION_EXPANSION_INTERVAL_TICKS } from '@voidsector/shared';
import type { CosmicFactionId, CosmicNpcFleet } from '@voidsector/shared';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export class ExpansionTickHandler {
  async handle(tick: number): Promise<void> {
    // Nur alle FACTION_EXPANSION_INTERVAL_TICKS ausführen
    if (tick % FACTION_EXPANSION_INTERVAL_TICKS !== 0) {
      // Flotten bewegen sich jeden Tick
      await this.moveFleets(tick);
      return;
    }

    const factions = await getAllCosmicFactions();
    const territoryHandler = getTerritoryTickHandler();

    for (const faction of factions) {
      try {
        await this.processFactionExpansion(faction, tick, territoryHandler);
      } catch (err) {
        logger.error({ err, factionId: faction.id }, 'Faction expansion error');
      }
    }
  }

  private async processFactionExpansion(faction: any, tick: number, territoryHandler: any): Promise<void> {
    // Heuristic: Schaue nur einen repräsentativen Quadranten an
    // TODO: In Phase LU-4 wird dies auf alle Quadranten der Fraktion ausgeweitet
    const stationsInCore = await getCosmicStationsInQuadrant(0, 0);
    const factionStations = stationsInCore.filter((s: any) => s.faction_id === faction.id);

    const readiness = calculateExpansionReadiness(factionStations);
    if (!shouldFactionExpand(readiness, faction.expansion_rate, tick)) return;

    // Finde Expansionsziel
    const representativeQx = factionStations[0]?.quadrant_x ?? 0;
    const representativeQy = factionStations[0]?.quadrant_y ?? 0;

    const target = await findExpansionTarget(representativeQx, representativeQy, faction.id);
    if (!target) {
      logger.debug({ factionId: faction.id }, 'No expansion target found');
      return;
    }

    // Spawne Frachter
    const fleet: CosmicNpcFleet = {
      id: randomUUID(),
      factionId: faction.id as CosmicFactionId,
      type: 'freighter',
      quadrantX: representativeQx, quadrantY: representativeQy,
      sectorX: 5000, sectorY: 5000, // Zentrum des Quadranten
      targetQuadrantX: target.qx, targetQuadrantY: target.qy,
      targetSectorX: 5000, targetSectorY: 5000,
      cargoOre: 500, cargoGas: 200, cargoCrystal: 100,
      ticksToTarget: calculateFleetTravelTicks(representativeQx, representativeQy, target.qx, target.qy),
      state: 'traveling',
    };

    await upsertCosmicFleet(fleet);
    logger.info({ factionId: faction.id, target }, 'Faction expansion fleet dispatched');
  }

  private async moveFleets(tick: number): Promise<void> {
    // Vereinfachte Flottenbewegung: ticksToTarget decrementieren
    // Vollständige Implementierung in Phase LU-4
  }
}

let _instance: ExpansionTickHandler | null = null;
export function getExpansionTickHandler(): ExpansionTickHandler {
  if (!_instance) _instance = new ExpansionTickHandler();
  return _instance;
}
```

**Step 4: In index.ts registrieren**

```typescript
// packages/server/src/index.ts — nach tickEngine.start():
import { getExpansionTickHandler } from './engine/expansionTickHandler.js';
import { getTerritoryTickHandler } from './engine/territoryTickHandler.js';

tickEngine.registerHandler('territory', (tick) => getTerritoryTickHandler().handle(tick));
tickEngine.registerHandler('expansion', (tick) => getExpansionTickHandler().handle(tick));
```

**Step 5: Tests PASS**
```bash
cd packages/server && npx vitest run src/__tests__/expansionTickHandler.test.ts
```

**Step 6: Commit**
```bash
git add packages/server/src/engine/expansionTickHandler.ts
git add packages/server/src/__tests__/expansionTickHandler.test.ts
git commit -m "feat: add ExpansionTickHandler integrating NPC colonization into tick loop"
```

---

## Phase LU-4: Human Civilization Meter

### Task 4.1: HumanCivilizationService

**Spieleraktionen, die zur menschlichen Expansion beitragen:**

| Aktion | Score-Beitrag |
|--------|-------------|
| Mining (pro Einheit) | +0.1 |
| Station bauen | +50 |
| Frachter begleiten (Escort) | +20 |
| Neuen Quadranten entdecken | +10 |
| Alien-Angriff abwehren | +30 |

**Files:**
- Create: `packages/server/src/engine/humanCivilizationService.ts`
- Create: `packages/server/src/__tests__/humanCivilizationService.test.ts`
- Modify: `packages/server/src/rooms/services/MiningService.ts` (Score-Hook)
- Modify: `packages/server/src/rooms/services/WorldService.ts` (Station-Build-Hook)

**Step 1: Test schreiben**

```typescript
// packages/server/src/__tests__/humanCivilizationService.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  HumanCivilizationService,
  CIVILIZATION_SCORE_WEIGHTS,
} from '../engine/humanCivilizationService.js';

vi.mock('../db/cosmicFactionQueries.js', () => ({
  addToHumanExpansionScore: vi.fn().mockResolvedValue(undefined),
  getHumanCivilization: vi.fn().mockResolvedValue({
    expansion_score: 500,
    total_stations_built: 10,
    ticks_to_next_expansion: 360,
    last_expansion_tick: 0,
  }),
}));

describe('HumanCivilizationService', () => {
  it('has correct score weights', () => {
    expect(CIVILIZATION_SCORE_WEIGHTS.mining).toBe(0.1);
    expect(CIVILIZATION_SCORE_WEIGHTS.stationBuild).toBe(50);
    expect(CIVILIZATION_SCORE_WEIGHTS.newQuadrant).toBe(10);
  });

  it('recordMining adds correct score', async () => {
    const service = new HumanCivilizationService();
    await service.recordMining(100); // 100 Einheiten

    const { addToHumanExpansionScore } = await import('../db/cosmicFactionQueries.js');
    expect(vi.mocked(addToHumanExpansionScore)).toHaveBeenCalledWith(10); // 100 * 0.1
  });

  it('recordStationBuild adds 50 score', async () => {
    const service = new HumanCivilizationService();
    await service.recordStationBuild();

    const { addToHumanExpansionScore } = await import('../db/cosmicFactionQueries.js');
    expect(vi.mocked(addToHumanExpansionScore)).toHaveBeenCalledWith(50);
  });

  it('getStatus returns civilization data', async () => {
    const service = new HumanCivilizationService();
    const status = await service.getStatus();
    expect(status.expansionScore).toBe(500);
    expect(status.totalStationsBuilt).toBe(10);
  });
});
```

**Step 2: Service implementieren**

```typescript
// packages/server/src/engine/humanCivilizationService.ts
import {
  addToHumanExpansionScore,
  getHumanCivilization,
} from '../db/cosmicFactionQueries.js';
import { logger } from '../utils/logger.js';

export const CIVILIZATION_SCORE_WEIGHTS = {
  mining: 0.1,          // pro Ressourcen-Einheit
  stationBuild: 50,     // pro gebautem Station
  freighterEscort: 20,  // pro Escort abgeschlossen
  newQuadrant: 10,      // pro entdecktem Quadrant
  alienDefense: 30,     // pro abgewehrtem Alien-Angriff
} as const;

export class HumanCivilizationService {
  async recordMining(amount: number): Promise<void> {
    const score = Math.floor(amount * CIVILIZATION_SCORE_WEIGHTS.mining);
    if (score <= 0) return;
    await addToHumanExpansionScore(score);
  }

  async recordStationBuild(): Promise<void> {
    await addToHumanExpansionScore(CIVILIZATION_SCORE_WEIGHTS.stationBuild);
    logger.info('Human civilization: station built (+50 score)');
  }

  async recordNewQuadrantDiscovery(): Promise<void> {
    await addToHumanExpansionScore(CIVILIZATION_SCORE_WEIGHTS.newQuadrant);
  }

  async recordAlienDefense(): Promise<void> {
    await addToHumanExpansionScore(CIVILIZATION_SCORE_WEIGHTS.alienDefense);
    logger.info('Human civilization: alien defense (+30 score)');
  }

  async getStatus() {
    const row = await getHumanCivilization();
    return {
      expansionScore: row.expansion_score,
      totalStationsBuilt: row.total_stations_built,
      ticksToNextExpansion: row.ticks_to_next_expansion,
    };
  }
}

let _instance: HumanCivilizationService | null = null;
export function getHumanCivService(): HumanCivilizationService {
  if (!_instance) _instance = new HumanCivilizationService();
  return _instance;
}
```

**Step 3: Hook in MiningService**

In `packages/server/src/rooms/services/MiningService.ts`, in der mine-Methode nach erfolgreichem Mining:

```typescript
// Nach dem erfolgreichen mining-Ergebnis:
import { getHumanCivService } from '../../engine/humanCivilizationService.js';

// Im MiningService, nach dem mining-yield:
if (player.factionId === undefined || player.factionId === null) {
  // Spieler = Mensch, kein Alien
  const civService = getHumanCivService();
  await civService.recordMining(totalYield).catch(() => {}); // fire-and-forget, non-blocking
}
```

**Step 4: Tests PASS**
```bash
cd packages/server && npx vitest run src/__tests__/humanCivilizationService.test.ts
```

**Step 5: Alle Server-Tests laufen**
```bash
cd packages/server && npx vitest run
```
Erwartung: Alle bestehenden Tests weiterhin PASS

**Step 6: Commit**
```bash
git add packages/server/src/engine/humanCivilizationService.ts
git add packages/server/src/__tests__/humanCivilizationService.test.ts
git add packages/server/src/rooms/services/MiningService.ts
git commit -m "feat: add HumanCivilizationService with player contribution tracking"
```

---

## Phase LU-5: QUAD-MAP Faction Colors + Visible Economy

### Task 5.1: Territory API Endpoint

**Files:**
- Modify: `packages/server/src/adminRoutes.ts` (oder neues `universeRoutes.ts`)
- Create: `packages/server/src/__tests__/territoryRoutes.test.ts`

**Step 1: Territory-Route hinzufügen**

```typescript
// packages/server/src/adminRoutes.ts — ergänzen (oder neue Datei universeRoutes.ts)

// GET /universe/territory?qx=0&qy=0&radius=10
app.get('/universe/territory', async (req, res) => {
  const qx = parseInt(req.query.qx as string ?? '0');
  const qy = parseInt(req.query.qy as string ?? '0');
  const radius = Math.min(parseInt(req.query.radius as string ?? '5'), 50); // max 50

  const territories = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const territory = await getQuadrantTerritory(qx + dx, qy + dy);
      if (territory) territories.push(territory);
    }
  }

  res.json({ territories, center: { qx, qy }, radius });
});

// GET /universe/factions
app.get('/universe/factions', async (_req, res) => {
  const factions = await getAllCosmicFactions();
  res.json({ factions });
});
```

**Step 2: Client-seitige Territory-Abfrage**

In `packages/client/src/network/GameNetwork.ts`:

```typescript
async getTerritoryAround(qx: number, qy: number, radius: number = 5) {
  const url = `${this.serverUrl}/universe/territory?qx=${qx}&qy=${qy}&radius=${radius}`;
  const r = await fetch(url);
  return r.json();
}
```

**Step 3: QUAD-MAP Faction-Overlay**

In `packages/client/src/components/QuadMap/QuadMapCanvas.tsx` (oder entsprechende Datei):

```typescript
// Faction-Farben für die Canvas-Darstellung
const FACTION_COLORS: Record<string, string> = {
  humans:       '#4488ff',
  archivists:   '#88ffcc',
  consortium:   '#ffaa44',
  kthari:       '#ff4444',
  mycelians:    '#44ff88',
  mirror_minds: '#cc88ff',
  tourist_guild:'#ffff44',
  silent_swarm: '#ff8844',
  helions:      '#ff44ff',
  axioms:       '#ffffff',
  scrappers:    '#aaaaaa',
};

// In der drawQuadrant-Funktion:
function drawQuadrantWithTerritory(ctx: CanvasRenderingContext2D, qx: number, qy: number, territory: QuadrantTerritory | null) {
  const x = qx * CELL_SIZE;
  const y = qy * CELL_SIZE;

  if (!territory || !territory.dominantFaction) {
    ctx.fillStyle = '#111111'; // leer/unbekannt
  } else {
    const color = FACTION_COLORS[territory.dominantFaction] ?? '#555555';
    const dominance = (territory.factionShares[territory.dominantFaction] ?? 50) / 100;

    // Alpha basiert auf Kontrolldominanz (50% = leicht, 100% = voll)
    ctx.globalAlpha = 0.2 + dominance * 0.5;
    ctx.fillStyle = color;
  }

  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  ctx.globalAlpha = 1.0;
}
```

**Step 4: Client Store ergänzen**

In `packages/client/src/store/gameSlice.ts`:

```typescript
// State ergänzen:
quadrantTerritories: Record<string, QuadrantTerritory>; // key: "qx:qy"
cosmicFactions: CosmicFaction[];

// Actions:
setQuadrantTerritories: (territories: QuadrantTerritory[]) => void;
setCosmicFactions: (factions: CosmicFaction[]) => void;
```

**Step 5: Test für Territory-Rendering**

```typescript
// packages/client/src/__tests__/QuadMapTerritory.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTerritoryColor } from '../components/QuadMap/QuadMapCanvas.js';

describe('QuadMap Territory Rendering', () => {
  it('returns dark color for empty quadrant', () => {
    const color = calculateTerritoryColor(null);
    expect(color).toBe('#111111');
  });

  it('returns faction color for dominated quadrant', () => {
    const territory = {
      dominantFaction: 'humans',
      factionShares: { humans: 100 },
    };
    const color = calculateTerritoryColor(territory as any);
    expect(color).toContain('ff'); // humans = #4488ff
  });
});
```

**Step 6: Commit**
```bash
git add packages/server/src/adminRoutes.ts
git add packages/client/src/network/GameNetwork.ts
git add packages/client/src/components/QuadMap/
git add packages/client/src/store/gameSlice.ts
git add packages/client/src/__tests__/QuadMapTerritory.test.ts
git commit -m "feat: add territory API and faction color overlay for QUAD-MAP"
```

---

### Task 5.2: NPC Fleet Visibility auf Radar (bonus)

**Files:**
- Modify: `packages/server/src/rooms/services/ScanService.ts`
- Modify: `packages/client/src/components/Radar/RadarRenderer.ts`

Freundliche NPC-Flotten (gleiche Fraktion = Menschen) werden immer auf dem Radar sichtbar.

```typescript
// ScanService.ts — in den Radar/Scan-Response Daten:
const cosmicFleets = await getFleetsInQuadrant(player.quadrantX, player.quadrantY);
const friendlyFleets = cosmicFleets.filter(f => f.factionId === 'humans');
// In den Scan-Response hinzufügen: { cosmicFleets: friendlyFleets }

// RadarRenderer.ts — neue Render-Methode:
private drawCosmicFleet(fleet: CosmicNpcFleet) {
  // Kleines Dreiecks-Symbol für NPC-Frachter
  this.ctx.strokeStyle = '#4488ff';
  this.ctx.lineWidth = 1;
  // ... drawTriangle at fleet position
}
```

**Commit:**
```bash
git commit -m "feat: show friendly NPC fleets on player radar"
```

---

## Phase LU-6: Seeding & Universe Initialization

### Task 6.1: UniverseSeedingService

**Files:**
- Create: `packages/server/src/engine/universeSeedingService.ts`
- Create: `packages/server/src/scripts/seedUniverse.ts`

```typescript
// packages/server/src/engine/universeSeedingService.ts
import {
  seedHumanStartingTerritory,
  seedAlienStartingTerritories,
} from './territoryEngine.js';
import {
  upsertQuadrantTerritory,
  createCosmicStation,
  getCurrentTick,
} from '../db/cosmicFactionQueries.js';
import { logger } from '../utils/logger.js';

export async function seedUniverseIfEmpty(): Promise<void> {
  const tick = await getCurrentTick();
  if (tick > 0) {
    logger.info('Universe already seeded, skipping');
    return;
  }

  logger.info('Seeding universe for first time...');

  // 1. Menschheits-Startgebiet (25 Quadranten)
  const humanTerritories = seedHumanStartingTerritory();
  for (const territory of humanTerritories) {
    await upsertQuadrantTerritory(territory);
    // 3 Starter-Stationen pro Quadrant
    for (let i = 0; i < 3; i++) {
      await createCosmicStation({
        factionId: 'humans',
        qx: territory.quadrantX, qy: territory.quadrantY,
        sx: 2000 + i * 3000, sy: 2000 + i * 2000,
        stationType: i === 0 ? 'homeworld' : 'colony',
      });
    }
  }

  // 2. Alien-Startgebiete
  const alienTerritories = seedAlienStartingTerritories();
  for (const territory of alienTerritories) {
    await upsertQuadrantTerritory(territory);
    await createCosmicStation({
      factionId: territory.dominantFaction!,
      qx: territory.quadrantX, qy: territory.quadrantY,
      sx: 5000, sy: 5000,
      stationType: 'colony',
    });
  }

  logger.info({
    humanQuadrants: humanTerritories.length,
    alienQuadrants: alienTerritories.length,
  }, 'Universe seeding complete');
}
```

**Script für manuelles Seeding:**
```typescript
// packages/server/src/scripts/seedUniverse.ts
import { seedUniverseIfEmpty } from '../engine/universeSeedingService.js';
import { logger } from '../utils/logger.js';

(async () => {
  await seedUniverseIfEmpty();
  logger.info('Done');
  process.exit(0);
})();
```

In `packages/server/src/index.ts`:
```typescript
import { seedUniverseIfEmpty } from './engine/universeSeedingService.js';
// Nach DB-Migration-Check, vor gameServer.start():
await seedUniverseIfEmpty();
```

**package.json script hinzufügen:**
```json
"seed:universe": "tsx src/scripts/seedUniverse.ts"
```

**Commit:**
```bash
git add packages/server/src/engine/universeSeedingService.ts
git add packages/server/src/scripts/seedUniverse.ts
git commit -m "feat: add UniverseSeedingService for fresh universe initialization"
```

---

## Phase LU-7: Tests + Admin-Dashboard

### Task 7.1: Admin-Dashboard Erweiterung

In der bestehenden Admin-Konsole (`packages/client/src/components/Admin/`) eine neue Ansicht:

```
UNIVERSE STATUS
───────────────
Universe Tick:  #1,247,830 (running)
Tick Interval:  5.0s

FACTION TERRITORIES
Menschheit:   25 Quadranten  (growing)
K'thari:      15 Quadranten  (stable)
Die Archivare: 8 Quadranten  (stable)
...

ACTIVE FLEETS
3 Frachter unterwegs
1 Scout-Flotte aktiv

HUMAN CIVILIZATION
Expansion Score: 4,230
Stations Built:  47
Next Expansion:  ~2 min
```

**Step 1: Admin-Route für Universe-Status**

```typescript
// packages/server/src/adminRoutes.ts
app.get('/admin/universe-status', requireAdmin, async (_req, res) => {
  const [factions, civilization, tick] = await Promise.all([
    getAllCosmicFactions(),
    getHumanCivilization(),
    getCurrentTick(),
  ]);
  res.json({ factions, civilization, tick });
});
```

**Step 2: Admin-Panel Komponente**

```typescript
// packages/client/src/components/Admin/UniverseStatusPanel.tsx
// Zeigt: tick counter, faction territory counts, active fleets, human civ score
```

### Task 7.2: Vollständige Test-Suite

```bash
# Alle Tests ausführen:
npm test

# Ziel-Coverage für neue Dateien:
# territoryEngine.ts:          > 90%
# cosmicExpansionEngine.ts:    > 85%
# universeTickEngine.ts:       > 85%
# humanCivilizationService.ts: > 90%
```

**Step 1: Edge Cases testen**

```typescript
// packages/server/src/__tests__/cosmicExpansionEngine.edge.test.ts

describe('Expansion edge cases', () => {
  it('does not expand into negative quadrant coordinates', async () => {
    const target = await findExpansionTarget(0, 0, 'humans');
    if (target) {
      expect(target.qx).toBeGreaterThanOrEqual(0);
      expect(target.qy).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles faction with 0.0 expansion_rate', () => {
    const shouldExpand = shouldFactionExpand(1.0, 0.0, 360);
    expect(shouldExpand).toBe(false); // expansion_rate 0 → niemals expandieren
  });
});
```

**Commit:**
```bash
git commit -m "test: add edge case coverage for cosmic expansion engine"
```

---

## Abschluss-Commit und PR

```bash
# Alle Tests final ausführen:
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run

# Branch push + PR:
git push origin fix/quality-sprint
gh pr create \
  --title "feat: Lebendiges Universum — Faction Territory + NPC Expansion" \
  --body "Closes #162 (partial), neue Issues für #170 Abhängigkeiten erfüllt"
```

---

## Zusammenfassung: Neue Dateien

| Datei | Typ | Beschreibung |
|-------|-----|-------------|
| `packages/shared/src/__tests__/cosmicFactions.test.ts` | Test | Constants-Tests |
| `packages/server/src/db/migrations/031_cosmic_factions.sql` | Migration | Neue Tabellen |
| `packages/server/src/db/cosmicFactionQueries.ts` | DB | Query-Funktionen |
| `packages/server/src/engine/territoryEngine.ts` | Engine | Quadrant-Kontrolle |
| `packages/server/src/engine/universeTickEngine.ts` | Engine | 5s-Tick-Loop |
| `packages/server/src/engine/territoryTickHandler.ts` | Handler | Territory-Dirty-Queue |
| `packages/server/src/engine/cosmicExpansionEngine.ts` | Engine | Expansions-Logik |
| `packages/server/src/engine/expansionTickHandler.ts` | Handler | NPC-Expansion-Tick |
| `packages/server/src/engine/humanCivilizationService.ts` | Service | Spieler-Beiträge |
| `packages/server/src/engine/universeSeedingService.ts` | Service | Universe-Init |
| `packages/client/src/__tests__/QuadMapTerritory.test.ts` | Test | QUAD-MAP Tests |

## Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `packages/shared/src/constants.ts` | COSMIC_FACTION_IDS + Territory-Constants |
| `packages/shared/src/types.ts` | CosmicFaction, QuadrantTerritory, CosmicNpcFleet |
| `packages/server/src/index.ts` | Tick Engine + Handlers registrieren |
| `packages/server/src/adminRoutes.ts` | /universe/* Endpoints |
| `packages/server/src/rooms/services/MiningService.ts` | Civ-Score Hook |
| `packages/client/src/components/QuadMap/QuadMapCanvas.tsx` | Faction-Color-Overlay |
| `packages/client/src/store/gameSlice.ts` | Territory State |
| `packages/client/src/network/GameNetwork.ts` | Territory-Fetch |
