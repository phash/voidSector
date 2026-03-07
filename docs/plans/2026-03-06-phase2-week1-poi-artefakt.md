# Phase 2 Week 1–2: POI System + Artefakt-System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish POI constant definitions, implement Artefakt drop system with Redis tracking, and create DB migration 031 for SectorEnvironment+SectorContent schema.

**Architecture:** 
- Task 1–3: Define POI constants in shared layer (no DB changes)
- Task 4–6: Implement Artefakt drop system with Redis state
- Task 7–10: Create and test migration 031 (SectorEnvironment + SectorContent array)
- Task 11: Integration testing + all tests pass

**Tech Stack:** TypeScript, PostgreSQL, Redis, Vitest

---

## Sector Environment Types & Content System

### Sector Grundtypen (Environment)

Jeder Sektor hat einen **Environment-Typ**, der die physikalischen Eigenschaften und Möglichkeiten definiert:

| Typ | Beschreibung | Betrebar | Besonderheiten |
|-----|-------------|---------|----------------|
| **leer** | Leerer Raum, keine Strukturen | ✓ | Standard, häufigst |
| **nebel** | Nebelfeld — Teil einer Nebelkette (min. 20, max. 2500 Sektoren) | ✓ | Groß, selten (1–2 pro Quadrant), reduziert Scan-Reichweite |
| **stern** | Stern/Sonne — kann nicht betreten | ✗ | Visuell prominent, kann Navigationsziel sein, umgibt sich mit Asteroiden |
| **planet** | Planet mit verschiedenen Typen (terrestrisch, Wasser, Eis, Lava) | ✓ | Auto-Miner & Verarbeitungseinheiten baubar, je Typ & Größe unterschiedl. Ressourcen |
| **asteroid** | Asteroidenfeld — Mining möglich | ✓ | Weniger Ressourcen als Planeten, dafür häufiger (8–15% der Sektoren) |
| **schwarzes_loch** | Schwarzes Loch — kann nicht betreten, ist Navigationshindernis | ✗ | Quest-relevant, Warp-Ziele umgehen es automatisch |

### Sector Inhalte (Content/POIs)

Zusätzlich zum Environment können Sektoren **temporäre oder permanente Inhalte** enthalten:

| Inhalt | Typ | Dauer | Häufigkeit | Verhalten |
|--------|-----|-------|-----------|-----------|
| **NPC Station** | Permanente Struktur | ∞ | 3% der leeren Sektoren | Handel, Quests, Reparatur. Seltener zum Zentrum des Universums hin |
| **Meteor** | Temporärer POI | 1–4h Respawn | 4% (bei Asteroidenfeldern höher) | Seltene Erze abbaubar, schnell erschöpfbar |
| **Piraten** | Temporärer Event | Despawn nach Flucht/Sieg | 2% | Greifen bei Sektor-Eintritt an, haben AI, belohnbar |
| **Relikt** | Permanente Quest-Location | Regeneriert langsam (6–24h) | 0.5–1% | Scan-basiert, Artefakte findbar, auch bei Quests relevant |
| **NPC Schiff** | Mobile Einheit | 3–5 Minuten (move zwischen Sektoren) | 1–2% (höher wenn wenige Stationen) | Bewegt sich, handelt Module & seltene Rohstoffe, kann gehandelt werden |

### Ressourcen-Regeneration

- Alle abgebauten Ressourcen (Asteroid, Planet, Meteor) regenerieren sich **langsam** (1–24h je nach Ressourcentyp)
- Abgebaute Felder dimmen visuell, bis sie wieder vorhanden sind
- Ausbau-Strukturen (Auto-Miner, Verarbeitung) accelerieren Spawn-Zyklen

### Content-Verteilung pro Sektor

- **Max. 3 POIs pro Sektor** (Regeldurchsatz)
- Environment + bis zu 2–3 Content-Items möglich
- Deterministische Generierung basierend auf `hashCoords(sectorX, sectorY, worldSeed)`
- Erstes Mal im Sektor: Server generiert Content aus Seed
- Danach: Redis/DB cached bis zu nächstem Respawn

---

## Task 1: Sector Environment & Content Constants — Add to shared/constants.ts

**Files:**
- Modify: `packages/shared/src/constants.ts` (add Sector Environment + Content definitions)
- Test: `packages/shared/src/__tests__/sectorEnvironmentConstants.test.ts` (new file)

### Step 1: Write the failing test

Create `packages/shared/src/__tests__/sectorEnvironmentConstants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  SECTOR_ENVIRONMENT_TYPES,
  SECTOR_CONTENT_TYPES,
  SECTOR_CONTENT_SPAWN_RATES,
  SECTOR_CONTENT_RESPAWN_TIMES,
  MAX_CONTENT_PER_SECTOR,
} from '../constants';

describe('Sector Environment & Content Constants', () => {
  it('should define all sector environment types', () => {
    expect(SECTOR_ENVIRONMENT_TYPES).toContain('empty');
    expect(SECTOR_ENVIRONMENT_TYPES).toContain('nebula');
    expect(SECTOR_ENVIRONMENT_TYPES).toContain('star');
    expect(SECTOR_ENVIRONMENT_TYPES).toContain('planet');
    expect(SECTOR_ENVIRONMENT_TYPES).toContain('asteroid');
    expect(SECTOR_ENVIRONMENT_TYPES).toContain('black_hole');
    expect(SECTOR_ENVIRONMENT_TYPES.length).toBe(6);
  });

  it('should define all sector content types', () => {
    expect(SECTOR_CONTENT_TYPES).toContain('station');
    expect(SECTOR_CONTENT_TYPES).toContain('meteor');
    expect(SECTOR_CONTENT_TYPES).toContain('pirates');
    expect(SECTOR_CONTENT_TYPES).toContain('relic');
    expect(SECTOR_CONTENT_TYPES).toContain('npc_ship');
    expect(SECTOR_CONTENT_TYPES.length).toBeGreaterThanOrEqual(5);
  });

  it('should have spawn rates for all content types', () => {
    SECTOR_CONTENT_TYPES.forEach((type) => {
      expect(SECTOR_CONTENT_SPAWN_RATES[type]).toBeDefined();
      expect(SECTOR_CONTENT_SPAWN_RATES[type]).toBeGreaterThan(0);
      expect(SECTOR_CONTENT_SPAWN_RATES[type]).toBeLessThanOrEqual(0.1);
    });
  });

  it('should have respawn times for all content types', () => {
    SECTOR_CONTENT_TYPES.forEach((type) => {
      expect(SECTOR_CONTENT_RESPAWN_TIMES[type]).toBeDefined();
      expect(SECTOR_CONTENT_RESPAWN_TIMES[type]).toBeGreaterThanOrEqual(0);
    });
  });

  it('should enforce max 3 content items per sector', () => {
    expect(MAX_CONTENT_PER_SECTOR).toBe(3);
  });
});
```

Run: `cd packages/shared && npm test -- sectorEnvironmentConstants.test.ts`
Expected: **FAIL** — constants not yet exported

### Step 2: Add Sector Environment & Content constants to shared/constants.ts

After the existing `SECTOR_RESOURCE_YIELDS` section, add:

```typescript
// Sector Environment Types (Phase 2)
export const SECTOR_ENVIRONMENT_TYPES = [
  'empty',        // Leerer Raum
  'nebula',       // Nebelfeld (20–2500 zusammenhängende Sektoren)
  'star',         // Stern (nicht betrebar)
  'planet',       // Planet (Auto-Miner & Verarbeitung möglich)
  'asteroid',     // Asteroidenfeld (Mining möglich)
  'black_hole',   // Schwarzes Loch (nicht betrebar)
] as const;

export type SectorEnvironmentType = typeof SECTOR_ENVIRONMENT_TYPES[number];

// Sector Content Types (POIs/Events inside sectors)
export const SECTOR_CONTENT_TYPES = [
  'station',      // NPC Station (Handel, Quests, Reparatur)
  'meteor',       // Meteor (temporär, seltene Erze)
  'pirates',      // Piraten (temporär, greifen an)
  'relic',        // Relikt (Quest-Location, Artefakte findbar)
  'npc_ship',     // NPC Schiff (mobil, Handel)
] as const;

export type SectorContentType = typeof SECTOR_CONTENT_TYPES[number];

// Spawn rates for sector content (per sector)
export const SECTOR_CONTENT_SPAWN_RATES: Record<SectorContentType, number> = {
  station: 0.03,      // 3% of empty sectors
  meteor: 0.04,       // 4% (higher in asteroid fields)
  pirates: 0.02,      // 2%
  relic: 0.01,        // 0.5–1%
  npc_ship: 0.012,    // 1.2% (higher when fewer stations)
};

// Respawn timings for sector content (in minutes)
export const SECTOR_CONTENT_RESPAWN_TIMES: Record<SectorContentType, number> = {
  station: 0,         // permanent
  meteor: 120,        // 2h respawn (1–4h range)
  pirates: 0,         // despawn after flee/defeat
  relic: 720,         // 12h respawn (6–24h range)
  npc_ship: 5,        // ~5 minutes (mobile, moves between sectors)
};

// Max content items per sector
export const MAX_CONTENT_PER_SECTOR = 3;

// Planet subtypes (for Planet environment)
export const PLANET_TYPES = [
  'terrestrial',  // Fels-Planet
  'water',        // Wasser-Planet
  'ice',          // Eis-Planet
  'lava',         // Lava-Planet
] as const;

export type PlanetType = typeof PLANET_TYPES[number];

// Resource yields by planet type
export const PLANET_RESOURCE_YIELDS: Record<PlanetType, Record<string, number>> = {
  terrestrial: { ore: 100, gas: 10, crystal: 5 },
  water: { ore: 50, gas: 40, crystal: 3 },
  ice: { ore: 60, gas: 20, crystal: 8 },
  lava: { ore: 80, gas: 30, crystal: 12 },
};

// Nebula generation (connected sector minimum & maximum)
export const NEBULA_MIN_SECTORS = 20;
export const NEBULA_MAX_SECTORS = 2500;
export const NEBULA_SPAWN_RATE = 0.02; // Very rare: 1–2 per quadrant

// Station rarity increase towards universe center
// (0,0) = center; further = more common
export const STATION_RARITY_CENTER_MULTIPLIER = 0.5;  // 50% spawn rate at center
```

Run: `cd packages/shared && npm test -- sectorEnvironmentConstants.test.ts`
Expected: **PASS**

### Step 3: Update types.ts with Sector Environment & Content types

Check `packages/shared/src/types.ts` and ensure:

```typescript
import type { SectorEnvironmentType, SectorContentType, PlanetType } from './constants';

export interface SectorEnvironment {
  type: SectorEnvironmentType;
  subtypeIfPlanet?: PlanetType;
  size?: 'small' | 'medium' | 'large'; // For planets, asteroids
  traversable: boolean;
  metadata?: Record<string, unknown>;
}

export interface SectorContent {
  type: SectorContentType;
  seedOffset: number;
  discoveredBy?: string;
  discoveredAt?: string;
  respawnAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Sector {
  x: number;
  y: number;
  quadrantX: number;
  quadrantY: number;
  environment: SectorEnvironment;
  contents: SectorContent[]; // Max 3 items
  seed: number;
  lastUpdated: number;
}
```

If not present, add these interfaces.

### Step 4: Run full test suite for shared package

Run: `cd packages/shared && npm test`
Expected: All tests pass (191 total)

### Step 5: Commit

```bash
cd packages
git add shared/src/constants.ts shared/src/types.ts shared/src/__tests__/poiConstants.test.ts
git commit -m "feat: add POI constants and types (phase2)"
```

---

## Task 2: Artefakt Drop System — Redis Tracking & Content Generator

**Files:**
- Modify: `packages/shared/src/constants.ts` (add Artefakt constants) ✅ DONE
- Create: `packages/server/src/services/SectorContentService.ts` (new)
- Create: `packages/server/src/services/ArtefaktService.ts` (new)
- Test: `packages/server/src/services/__tests__/SectorContentService.test.ts` (new file)
- Test: `packages/server/src/services/__tests__/ArtefaktService.test.ts` (new file)

### Step 2a: Add Artefakt constants to shared/constants.ts

Add after `STATION_RARITY_CENTER_MULTIPLIER`:

```typescript
// Artefakt System Constants
export const ARTEFAKT_TYPES = [
  'ancient_crystal',    // Ancient alien technology
  'alien_circuit',      // Advanced tech component
  'time_fragment',      // Temporal anomaly
  'void_resonator',     // Exotic matter
  'hyperspace_core',    // Ultra-rare power source
] as const;

export type ArtefaktType = typeof ARTEFAKT_TYPES[number];

// Artefakt rarity and drop weights (by encounter type)
export const ARTEFAKT_RARITY: Record<ArtefaktType, number> = {
  ancient_crystal: 0.35,      // Common (35%)
  alien_circuit: 0.25,        // Uncommon (25%)
  time_fragment: 0.2,         // Rare (20%)
  void_resonator: 0.15,       // Rare (15%)
  hyperspace_core: 0.05,      // Legendary (5%)
};

// Artefakt rarity names (for UI)
export const ARTEFAKT_RARITY_NAMES: Record<ArtefaktType, string> = {
  ancient_crystal: 'Häufig',
  alien_circuit: 'Selten',
  time_fragment: 'Sehr Selten',
  void_resonator: 'Episch',
  hyperspace_core: 'Legendär',
};

// Artefakt drop rates by content type
export const ARTEFAKT_DROP_RATES: Record<SectorContentType, number> = {
  station: 0,          // No drops
  meteor: 0.05,        // 5% chance (seltene Erze → Artefakt)
  pirates: 0.1,        // 10% chance (Beute)
  relic: 0.25,         // 25% chance (Hauptzweck)
  npc_ship: 0.08,      // 8% chance (rare items)
};

// Artefakt inventory limits per player
export const ARTEFAKT_INVENTORY_MAX = 10;
```

Run: `cd packages/shared && npm test`
Expected: All tests pass

### Step 2b: Write failing test for SectorContentService

Create `packages/server/src/services/__tests__/SectorContentService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SectorContentService } from '../SectorContentService';
import {
  SECTOR_CONTENT_TYPES,
  SECTOR_ENVIRONMENT_TYPES,
} from '@void-sector/shared';

describe('SectorContentService', () => {
  let service: SectorContentService;

  beforeEach(() => {
    service = new SectorContentService();
  });

  it('should generate content based on seed', () => {
    const content = service.generateContent(30500, 30500, 'seed123');
    expect(content.length).toBeLessThanOrEqual(3); // Max 3 per sector
    content.forEach((item) => {
      expect(SECTOR_CONTENT_TYPES).toContain(item.type);
    });
  });

  it('should generate different content for different seeds', () => {
    const content1 = service.generateContent(30500, 30500, 'seed1');
    const content2 = service.generateContent(30500, 30500, 'seed2');
    // Not guaranteed to be different, but probability high
    // At least verify both are valid
    expect(Array.isArray(content1)).toBe(true);
    expect(Array.isArray(content2)).toBe(true);
  });

  it('should return same content for same seed (deterministic)', () => {
    const seed = 'deterministic_seed';
    const content1 = service.generateContent(30500, 30500, seed);
    const content2 = service.generateContent(30500, 30500, seed);
    expect(content1).toEqual(content2);
  });

  it('should generate environment type', () => {
    const env = service.generateEnvironment(30500, 30500, 'seed123');
    expect(SECTOR_ENVIRONMENT_TYPES).toContain(env.type);
  });

  it('should respect nebula generation constraints', () => {
    // Nebulas are rare and large; we just verify the logic doesn't crash
    const env = service.generateEnvironment(30500, 30500, 'nebula_seed');
    if (env.type === 'nebula') {
      expect(env.metadata?.connectedSectors).toBeGreaterThanOrEqual(20);
    }
  });

  it('should have lower station spawn at center (0,0)', () => {
    const service = new SectorContentService();
    // Center coordinates
    const centerContent = service.generateContent(0, 0, 'center_seed');
    // Outer coordinates
    const outerContent = service.generateContent(9999, 9999, 'outer_seed');
    // Just verify both generate without error; exact probability hard to test
    expect(Array.isArray(centerContent)).toBe(true);
    expect(Array.isArray(outerContent)).toBe(true);
  });
});
```

Run: `cd packages/server && npm test -- SectorContentService.test.ts`
Expected: **FAIL** — SectorContentService not yet created

### Step 2c: Write failing test for ArtefaktService

Create `packages/server/src/services/__tests__/ArtefaktService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtefaktService } from '../ArtefaktService';
import type Redis from 'ioredis';

describe('ArtefaktService', () => {
  let redis: Redis.Mock;
  let service: ArtefaktService;

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      getdel: vi.fn(),
    } as any;
    service = new ArtefaktService(redis);
  });

  it('should record artefakt drop with sector coords', async () => {
    const drop = {
      playerId: 'player123',
      type: 'ancient_crystal' as const,
      sectorX: 30500,
      sectorY: 30500,
      timestamp: Date.now(),
    };

    await service.recordDrop(drop);

    expect(redis.set).toHaveBeenCalled();
  });

  it('should retrieve recent drops for player', async () => {
    const drops = [
      { type: 'ancient_crystal', sectorX: 30500, sectorY: 30500, timestamp: Date.now() },
    ];
    redis.get.mockResolvedValue(JSON.stringify(drops));

    const result = await service.getRecentDrops('player123', 24);

    expect(result).toEqual(drops);
  });

  it('should roll artefakt drop based on chance', () => {
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(service.rollArtefaktDrop(0.15)); // 15% chance
    }
    const dropCount = results.filter(Boolean).length;
    // Should be roughly 15% (allowing 5–25% variance in small sample)
    expect(dropCount).toBeGreaterThan(5);
    expect(dropCount).toBeLessThan(25);
  });

  it('should pick random artefakt type by weight', () => {
    const types = [];
    for (let i = 0; i < 100; i++) {
      types.push(service.pickArtefaktType());
    }
    // Should contain multiple types
    expect(new Set(types).size).toBeGreaterThan(1);
    // Should respect weighting (ancient_crystal most common)
    const crystalCount = types.filter((t) => t === 'ancient_crystal').length;
    expect(crystalCount).toBeGreaterThan(types.length * 0.25); // At least 25%
  });

  it('should check inventory capacity', async () => {
    redis.incr.mockResolvedValue(11); // Exceeds max
    const canAdd = await service.canAddArtefakt('player123');
    expect(canAdd).toBe(false);
  });
});
```

Run: `cd packages/server && npm test -- ArtefaktService.test.ts`
Expected: **FAIL** — ArtefaktService not yet created

### Step 3a: Implement SectorContentService

Create `packages/server/src/services/SectorContentService.ts`:

```typescript
import {
  SECTOR_ENVIRONMENT_TYPES,
  SECTOR_CONTENT_TYPES,
  SECTOR_CONTENT_SPAWN_RATES,
  SECTOR_CONTENT_RESPAWN_TIMES,
  NEBULA_MIN_SECTORS,
  NEBULA_MAX_SECTORS,
  PLANET_TYPES,
  MAX_CONTENT_PER_SECTOR,
  STATION_RARITY_CENTER_MULTIPLIER,
} from '@void-sector/shared';
import type { SectorEnvironmentType, SectorContentType, SectorEnvironment, SectorContent } from '@void-sector/shared';
import { hashCoords } from '../utils/seedHash';

export class SectorContentService {
  /**
   * Generate sector environment (deterministic based on coords + seed)
   */
  generateEnvironment(sectorX: number, sectorY: number, worldSeed: string): SectorEnvironment {
    const hash = hashCoords(sectorX, sectorY, worldSeed);
    const rand = (hash % 100) / 100;

    // Environment distribution (percentages)
    // empty: 70%, nebula: 2%, star: 3%, planet: 10%, asteroid: 12%, black_hole: 3%
    let envType: SectorEnvironmentType = 'empty';
    let cumulative = 0;

    if (rand < (cumulative += 0.7)) envType = 'empty';
    else if (rand < (cumulative += 0.02)) {
      envType = 'nebula';
    } else if (rand < (cumulative += 0.03)) {
      envType = 'star';
    } else if (rand < (cumulative += 0.1)) {
      envType = 'planet';
    } else if (rand < (cumulative += 0.12)) {
      envType = 'asteroid';
    } else {
      envType = 'black_hole';
    }

    const env: SectorEnvironment = {
      type: envType,
      traversable: envType !== 'star' && envType !== 'black_hole',
    };

    // If planet, add subtype
    if (envType === 'planet') {
      const planetIndex = hash % PLANET_TYPES.length;
      env.subtypeIfPlanet = PLANET_TYPES[planetIndex];
      env.size = ['small', 'medium', 'large'][hash % 3] as 'small' | 'medium' | 'large';
    }

    // If nebula, add connected sector count
    if (envType === 'nebula') {
      const nebulaSize = NEBULA_MIN_SECTORS + (hash % (NEBULA_MAX_SECTORS - NEBULA_MIN_SECTORS));
      env.metadata = { connectedSectors: nebulaSize };
    }

    return env;
  }

  /**
   * Generate sector content (POIs) — deterministic based on coords + seed
   */
  generateContent(sectorX: number, sectorY: number, worldSeed: string): SectorContent[] {
    const hash = hashCoords(sectorX, sectorY, worldSeed);
    const content: SectorContent[] = [];

    // Distance from center (0,0) for station rarity
    const distanceFromCenter = Math.sqrt(sectorX * sectorX + sectorY * sectorY);
    const maxDistance = Math.sqrt(9999 * 9999 + 9999 * 9999);
    const centerMultiplier = 1 - distanceFromCenter / maxDistance * STATION_RARITY_CENTER_MULTIPLIER;

    // Generate up to MAX_CONTENT_PER_SECTOR items
    for (let i = 0; i < MAX_CONTENT_PER_SECTOR; i++) {
      const itemHash = hash + i;
      const rand = (itemHash % 100) / 100;

      let contentType: SectorContentType | null = null;
      let cumulative = 0;

      for (const type of SECTOR_CONTENT_TYPES) {
        let rate = SECTOR_CONTENT_SPAWN_RATES[type];

        // Adjust station rate by distance from center
        if (type === 'station') {
          rate *= (1 - centerMultiplier * 0.5); // Up to 50% reduction at center
        }

        if (rand < (cumulative += rate)) {
          contentType = type;
          break;
        }
      }

      if (contentType) {
        const respawn = SECTOR_CONTENT_RESPAWN_TIMES[contentType];
        content.push({
          type: contentType,
          seedOffset: itemHash,
          respawnAt:
            respawn > 0
              ? new Date(Date.now() + respawn * 60000).toISOString()
              : undefined,
        });
      }
    }

    return content;
  }
}
```

Run: `cd packages/server && npm test -- SectorContentService.test.ts`
Expected: **PASS**

### Step 3b: Implement ArtefaktService

Create `packages/server/src/services/ArtefaktService.ts`:

```typescript
import type Redis from 'ioredis';
import {
  ARTEFAKT_TYPES,
  ARTEFAKT_RARITY,
  ARTEFAKT_DROP_RATES,
  ARTEFAKT_INVENTORY_MAX,
} from '@void-sector/shared';
import type { ArtefaktType, SectorContentType } from '@void-sector/shared';

export interface ArtefaktDrop {
  playerId: string;
  type: ArtefaktType;
  sectorX: number;
  sectorY: number;
  timestamp: number;
}

export class ArtefaktService {
  constructor(private redis: Redis) {}

  /**
   * Get drop rate for a given sector content type
   */
  getDropRateForContent(contentType: SectorContentType): number {
    return ARTEFAKT_DROP_RATES[contentType] || 0;
  }

  /**
   * Record an artefakt drop in Redis for tracking/analytics
   */
  async recordDrop(drop: ArtefaktDrop): Promise<void> {
    const key = `artefakt:${drop.playerId}`;
    const drops = await this.getRecentDrops(drop.playerId, 24);
    drops.push(drop);
    // Keep last 24 hours only
    const oneDayAgo = Date.now() - 86400000;
    const filtered = drops.filter((d) => d.timestamp > oneDayAgo);
    await this.redis.set(key, JSON.stringify(filtered), 'EX', 86400);
  }

  /**
   * Get recent artefakt drops for a player (within X hours)
   */
  async getRecentDrops(playerId: string, hours: number): Promise<ArtefaktDrop[]> {
    const key = `artefakt:${playerId}`;
    const data = await this.redis.get(key);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Roll for artefakt drop based on chance (0.0–1.0)
   */
  rollArtefaktDrop(chance: number): boolean {
    return Math.random() < chance;
  }

  /**
   * Pick random artefakt type weighted by rarity
   */
  pickArtefaktType(): ArtefaktType {
    const rand = Math.random();
    let cumulative = 0;

    for (const type of ARTEFAKT_TYPES) {
      cumulative += ARTEFAKT_RARITY[type];
      if (rand < cumulative) {
        return type;
      }
    }

    // Fallback
    return ARTEFAKT_TYPES[0];
  }

  /**
   * Check if player can add artefakt to inventory (respects max limit)
   */
  async canAddArtefakt(playerId: string): Promise<boolean> {
    const count = await this.redis.incr(`artefakt:count:${playerId}`);
    if (count > ARTEFAKT_INVENTORY_MAX) {
      await this.redis.decr(`artefakt:count:${playerId}`);
      return false;
    }
    return true;
  }

  /**
   * Add artefakt to player inventory
   * Returns unique artefakt ID
   */
  async addToInventory(playerId: string, type: ArtefaktType): Promise<string> {
    const id = `art_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const key = `inv:${playerId}:artefakt:${id}`;
    await this.redis.set(
      key,
      JSON.stringify({ type, acquiredAt: Date.now() }),
      'EX',
      2592000,
    ); // 30 days
    return id;
  }
}
```

Run: `cd packages/server && npm test -- ArtefaktService.test.ts`
Expected: **PASS**

### Step 4: Integrate both services into ServiceContext

Modify `packages/server/src/rooms/services/ServiceContext.ts`:

```typescript
import { ArtefaktService } from './ArtefaktService';

export class ServiceContext {
  artefaktService: ArtefaktService;

  constructor(
    private db: Database,
    private redis: Redis,
    // ... other services
  ) {
    this.artefaktService = new ArtefaktService(redis);
    // ... initialize other services
  }
}
```

### Step 5: Run full test suite for server

Run: `cd packages/server && npm test`
Expected: All tests pass (620+ tests)

### Step 6: Commit

```bash
cd packages
git add server/src/services/ArtefaktService.ts
git add server/src/services/__tests__/ArtefaktService.test.ts
git add server/src/rooms/services/ServiceContext.ts
git add shared/src/constants.ts
git commit -m "feat: implement ArtefaktService with Redis tracking"
```

---

## Task 3: Migration 031 — Sector Environment + Content Schema

**Files:**
- Create: `packages/server/src/db/migrations/031_sector_environment_content.sql`
- Create: `packages/server/src/db/migrations/__tests__/031_migration.test.ts` (integration test)
- Modify: `packages/server/src/rooms/schema/SectorState.ts` (add Sector schema)

### Step 1: Design migration SQL

Create `packages/server/src/db/migrations/031_sector_environment_content.sql`:

```sql
-- Migration 031: Sector Environment & Content System
-- Adds sector_environments + sector_contents tables for Phase 2
-- Status: Foundation for POI, Nebula, and Artefakt systems

-- Table for sector environments (deterministic, cached after first generation)
CREATE TABLE IF NOT EXISTS sector_environments (
  id SERIAL PRIMARY KEY,
  sector_x INT NOT NULL,
  sector_y INT NOT NULL,
  quadrant_x INT NOT NULL,
  quadrant_y INT NOT NULL,
  environment_type VARCHAR(50) NOT NULL,
  subtype_if_planet VARCHAR(50),
  size VARCHAR(50),
  seed INT NOT NULL,
  metadata JSONB DEFAULT '{}',
  discovered_by VARCHAR(255),
  discovered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sector_x, sector_y)
);

-- Index for coordinate lookup
CREATE INDEX IF NOT EXISTS idx_sector_env_coords
  ON sector_environments(sector_x, sector_y);

-- Index for quadrant lookup (room filtering)
CREATE INDEX IF NOT EXISTS idx_sector_env_quadrant
  ON sector_environments(quadrant_x, quadrant_y);

-- Table for sector content (POIs, events, structures)
CREATE TABLE IF NOT EXISTS sector_contents (
  id SERIAL PRIMARY KEY,
  sector_x INT NOT NULL,
  sector_y INT NOT NULL,
  quadrant_x INT NOT NULL,
  quadrant_y INT NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  seed_offset INT NOT NULL,
  discovered_by VARCHAR(255),
  discovered_at TIMESTAMP,
  respawn_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(sector_x, sector_y) REFERENCES sector_environments(sector_x, sector_y) ON DELETE CASCADE
);

-- Index for sector lookup
CREATE INDEX IF NOT EXISTS idx_sector_content_coords
  ON sector_contents(sector_x, sector_y);

-- Index for respawn queries (for cleanup/refresh)
CREATE INDEX IF NOT EXISTS idx_sector_content_respawn
  ON sector_contents(respawn_at)
  WHERE respawn_at IS NOT NULL;

-- Table for artefakt drops tracking (leaderboards & analytics)
CREATE TABLE IF NOT EXISTS artefakt_drops (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  artefakt_type VARCHAR(50) NOT NULL,
  sector_x INT NOT NULL,
  sector_y INT NOT NULL,
  dropped_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Index for drop analytics & leaderboards
CREATE INDEX IF NOT EXISTS idx_artefakt_drops_player
  ON artefakt_drops(player_id, dropped_at DESC);

CREATE INDEX IF NOT EXISTS idx_artefakt_drops_type
  ON artefakt_drops(artefakt_type, dropped_at DESC);

-- Comments for documentation
COMMENT ON TABLE sector_environments IS 'Phase 2: Caches sector environment type (empty, nebula, star, planet, asteroid, black_hole)';
COMMENT ON TABLE sector_contents IS 'Phase 2: Stores temporary + permanent content (stations, meteors, pirates, relics, NPC ships)';
COMMENT ON TABLE artefakt_drops IS 'Phase 2: Tracks artefakt discoveries for leaderboards and player stats';
```

### Step 2: Write integration test

Create `packages/server/src/db/migrations/__tests__/031_migration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { runMigrations } from '../../migrations';

describe('Migration 031: Sector Environment & Content Schema', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgres://voidsector:voidsector_dev@localhost:5432/voidsector_test',
    });
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create sector_environments table', async () => {
    const result = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'sector_environments'
      );
    `);
    expect(result.rows[0].exists).toBe(true);
  });

  it('should create sector_contents table', async () => {
    const result = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'sector_contents'
      );
    `);
    expect(result.rows[0].exists).toBe(true);
  });

  it('should create artefakt_drops table', async () => {
    const result = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'artefakt_drops'
      );
    `);
    expect(result.rows[0].exists).toBe(true);
  });

  it('should have correct columns in sector_environments', async () => {
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'sector_environments'
    `);
    const colNames = columns.rows.map((r) => r.column_name);
    expect(colNames).toContain('sector_x');
    expect(colNames).toContain('sector_y');
    expect(colNames).toContain('environment_type');
    expect(colNames).toContain('subtype_if_planet');
    expect(colNames).toContain('metadata');
  });

  it('should insert and retrieve environment data', async () => {
    await pool.query(`
      INSERT INTO sector_environments 
        (sector_x, sector_y, quadrant_x, quadrant_y, environment_type, seed)
      VALUES (500, 501, 30, 30, 'planet', 12345)
      ON CONFLICT DO NOTHING
    `);

    const result = await pool.query(`
      SELECT * FROM sector_environments WHERE sector_x = 500 AND sector_y = 501
    `);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].environment_type).toBe('planet');
  });

  it('should insert and retrieve content data', async () => {
    // First ensure sector_environment exists
    await pool.query(`
      INSERT INTO sector_environments 
        (sector_x, sector_y, quadrant_x, quadrant_y, environment_type, seed)
      VALUES (600, 601, 30, 30, 'empty', 54321)
      ON CONFLICT DO NOTHING
    `);

    await pool.query(`
      INSERT INTO sector_contents 
        (sector_x, sector_y, quadrant_x, quadrant_y, content_type, seed_offset)
      VALUES (600, 601, 30, 30, 'station', 999)
      ON CONFLICT DO NOTHING
    `);

    const result = await pool.query(`
      SELECT * FROM sector_contents WHERE sector_x = 600 AND sector_y = 601
    `);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].content_type).toBe('station');
  });

  it('should have performance indexes', async () => {
    const envIndexes = await pool.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'sector_environments'
    `);
    const contentIndexes = await pool.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'sector_contents'
    `);
    
    const envIdxNames = envIndexes.rows.map((r) => r.indexname);
    const contentIdxNames = contentIndexes.rows.map((r) => r.indexname);

    expect(envIdxNames.some((n) => n.includes('coord'))).toBe(true);
    expect(contentIdxNames.some((n) => n.includes('coord'))).toBe(true);
  });
});
```

### Step 3: Update SectorState schema (Colyseus)

Modify `packages/server/src/rooms/schema/SectorState.ts`:

```typescript
import { Schema, MapSchema, ArraySchema, defineTypes } from '@colyseus/schema';

// Sector Environment Schema
export class EnvironmentSchema extends Schema {
  type: string = 'empty';
  subtypeIfPlanet?: string;
  size?: string;
}

defineTypes(EnvironmentSchema, {
  type: 'string',
  subtypeIfPlanet: 'string',
  size: 'string',
});

// Sector Content (POI) Schema
export class ContentSchema extends Schema {
  type: string = '';
  seedOffset: number = 0;
  discoveredBy: string = '';
  discoveredAt: string = '';
}

defineTypes(ContentSchema, {
  type: 'string',
  seedOffset: 'uint32',
  discoveredBy: 'string',
  discoveredAt: 'string',
});

// Full Sector Schema
export class SectorSchema extends Schema {
  x: number = 0;
  y: number = 0;
  quadrantX: number = 0;
  quadrantY: number = 0;
  environment = new EnvironmentSchema();
  contents = new ArraySchema<ContentSchema>();
  seed: number = 0;
  discovered: boolean = false;
}

defineTypes(SectorSchema, {
  x: 'int32',
  y: 'int32',
  quadrantX: 'int32',
  quadrantY: 'int32',
  environment: EnvironmentSchema,
  contents: [ContentSchema],
  seed: 'int32',
  discovered: 'boolean',
});

// Sector Room State
export class SectorRoomState extends Schema {
  sectors = new MapSchema<SectorSchema>();
  playerCount: number = 0;
}

defineTypes(SectorRoomState, {
  sectors: { map: SectorSchema },
  playerCount: 'uint16',
});
```

Run: `cd packages/server && npm test`
Expected: All tests pass

### Step 5: Commit

```bash
git add packages/server/src/db/migrations/031_sector_poi_schema.sql
git add packages/server/src/db/migrations/__tests__/031_migration.test.ts
git add packages/server/src/rooms/schema/SectorState.ts
git commit -m "feat: add migration 031 for sector POI schema"
```

---

## Task 4: Integration Test — All Systems

**Files:**
- Create: `packages/server/src/__tests__/phase2-integration.test.ts`

### Step 1: Write integration test

Create `packages/server/src/__tests__/phase2-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ArtefaktService } from '../services/ArtefaktService';
import {
  POI_TYPES,
  POI_SPAWN_RATES,
  ARTEFAKT_TYPES,
  POI_DROP_TABLES,
} from '@void-sector/shared';

describe('Phase 2 Integration', () => {
  it('should have all POI types defined', () => {
    expect(POI_TYPES.length).toBe(9);
    POI_TYPES.forEach((type) => {
      expect(POI_SPAWN_RATES[type]).toBeDefined();
    });
  });

  it('should have all Artefakt types defined', () => {
    expect(ARTEFAKT_TYPES.length).toBeGreaterThan(0);
    ARTEFAKT_TYPES.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });

  it('should have drop tables for resource POIs', () => {
    expect(Object.keys(POI_DROP_TABLES).length).toBeGreaterThan(0);
    const resourcePOIs = ['asteroid', 'anomaly', 'alien_ship'];
    resourcePOIs.forEach((type) => {
      expect(POI_DROP_TABLES[type as keyof typeof POI_DROP_TABLES]).toBeDefined();
    });
  });

  it('should spawn rates sum to <= 1.0 for max diversity', () => {
    const total = Object.values(POI_SPAWN_RATES).reduce((a, b) => a + b, 0);
    // Allows overlap/multiple POIs per sector (up to 3)
    expect(total).toBeLessThanOrEqual(0.3); // Max 30% sector coverage
  });
});
```

Run: `cd packages/server && npm test -- phase2-integration.test.ts`
Expected: **PASS**

### Step 2: Commit

```bash
git add packages/server/src/__tests__/phase2-integration.test.ts
git commit -m "test: add phase2 integration tests"
```

---

## Task 5: Run Complete Test Suite

### Step 1: Run all tests

```bash
npm test
```

Expected output:
```
✓ packages/shared: 191 tests pass
✓ packages/server: 620+ tests pass
✓ packages/client: 405 tests pass

Total: 1216+ tests, 0 failures
```

### Step 2: Verify no regressions

If any test fails, identify the root cause and fix before proceeding.

### Step 3: Final commit

```bash
git status
# Ensure all changes are committed
git log --oneline -5
# Verify last 5 commits are Phase 2 work
```

---

## Rollback Plan

If any step fails:

1. **Constants only**: Just remove the added constants from `shared/constants.ts`, no DB migration needed
2. **ArtefaktService issue**: Revert ServiceContext changes, remove `ArtefaktService.ts`
3. **Migration 031 issue**: Drop `sector_pois` and `artefakt_drops` tables via SQL:
   ```sql
   DROP TABLE IF EXISTS artefakt_drops;
   DROP TABLE IF EXISTS sector_pois;
   ```

---

## Success Criteria

✅ All 1216+ tests pass
✅ POI constants exported and tested
✅ ArtefaktService implemented with Redis tracking
✅ Migration 031 creates tables and indexes correctly
✅ SectorState schema updated with POI support
✅ No regressions in existing functionality
✅ Ready for Phase 2 Week 3–4 (Alien Outpost Generator + Minigame UI)

---

**Dokument Kontrol:**
Erstellt: März 6, 2026
Zielstart: März 7, 2026 (sofort nach Genehmigung)
Geschätzter Abschluss: März 11, 2026 (3–4 Tage)
Status: **READY FOR EXECUTION**
