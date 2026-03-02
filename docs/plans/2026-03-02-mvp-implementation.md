# VOID SECTOR MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable multiplayer space exploration game with terminal/radar UI where players explore an infinite 2D grid sector by sector, spending AP that regenerates over time.

**Architecture:** Colyseus game server with SectorRoom per visited sector, React + Canvas client with CRT aesthetic, PostgreSQL for persistence, Redis for AP state and Colyseus presence. Monorepo with npm workspaces and shared TypeScript types.

**Tech Stack:** Colyseus 0.15+, React 18, HTML5 Canvas, Zustand, PostgreSQL, Redis, Vite, Vitest, TypeScript

**Reference:** See `docs/plans/2026-03-02-mvp-design.md` for the full approved design.

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `docker-compose.yml`
- Create: `.gitignore`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "void-sector",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:server": "npm run dev -w packages/server",
    "dev:client": "npm run dev -w packages/client",
    "build": "npm run build -w packages/shared && npm run build -w packages/server && npm run build -w packages/client",
    "test": "npm test -w packages/shared -w packages/server -w packages/client"
  }
}
```

**Step 2: Create base tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 3: Create shared package**

`packages/shared/package.json`:
```json
{
  "name": "@void-sector/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 4: Create server package**

`packages/server/package.json`:
```json
{
  "name": "@void-sector/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@void-sector/shared": "*",
    "colyseus": "^0.15.0",
    "@colyseus/tools": "^0.15.0",
    "@colyseus/schema": "^2.0.0",
    "@colyseus/monitor": "^0.15.0",
    "pg": "^8.12.0",
    "ioredis": "^5.4.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@types/bcrypt": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.4.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

**Step 5: Create client package**

`packages/client/package.json`:
```json
{
  "name": "@void-sector/client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@void-sector/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "colyseus.js": "^0.15.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/client/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

**Step 6: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: voidsector
      POSTGRES_USER: voidsector
      POSTGRES_PASSWORD: voidsector_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
.env
*.local
```

**Step 8: Install dependencies**

Run: `npm install`

**Step 9: Verify workspace setup**

Run: `npm run build -w packages/shared`
Expected: Succeeds (empty build, no source files yet)

**Step 10: Start Docker services**

Run: `docker compose up -d`
Expected: PostgreSQL on :5432, Redis on :6379

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with shared/server/client packages"
```

---

## Task 2: Shared Types & Constants

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/__tests__/constants.test.ts`

**Step 1: Write the failing test for constants**

```ts
// packages/shared/src/__tests__/constants.test.ts
import { describe, it, expect } from 'vitest';
import { SECTOR_TYPES, SECTOR_WEIGHTS, AP_COSTS, AP_DEFAULTS } from '../constants';

describe('constants', () => {
  it('sector weights sum to 1', () => {
    const sum = Object.values(SECTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('every sector type has a weight', () => {
    for (const type of SECTOR_TYPES) {
      expect(SECTOR_WEIGHTS[type]).toBeDefined();
    }
  });

  it('AP defaults are sane', () => {
    expect(AP_DEFAULTS.max).toBeGreaterThan(0);
    expect(AP_DEFAULTS.regenPerSecond).toBeGreaterThan(0);
    expect(AP_COSTS.jump).toBeGreaterThan(0);
    expect(AP_COSTS.scan).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL — modules not found

**Step 3: Write types.ts**

```ts
// packages/shared/src/types.ts

export type SectorType = 'empty' | 'nebula' | 'asteroid_field' | 'station' | 'anomaly';

export interface Coords {
  x: number;
  y: number;
}

export interface SectorData {
  x: number;
  y: number;
  type: SectorType;
  seed: number;
  discoveredBy: string | null;
  discoveredAt: string | null;
  metadata: Record<string, unknown>;
}

export interface PlayerData {
  id: string;
  username: string;
  homeBase: Coords;
  shipType: string;
  xp: number;
  level: number;
}

export interface APState {
  current: number;
  max: number;
  lastTick: number;  // timestamp ms
  regenPerSecond: number;
}

export interface PlayerPosition {
  x: number;
  y: number;
}

// Messages: Client -> Server
export interface JumpMessage {
  targetX: number;
  targetY: number;
}

export interface ScanMessage {}

// Messages: Server -> Client
export interface JumpResultMessage {
  success: boolean;
  error?: string;
  newSector?: SectorData;
  apRemaining?: number;
}

export interface ScanResultMessage {
  sector: SectorData;
  apRemaining: number;
}

export interface ErrorMessage {
  code: string;
  message: string;
}
```

**Step 4: Write constants.ts**

```ts
// packages/shared/src/constants.ts
import type { SectorType } from './types.js';

export const SECTOR_TYPES: SectorType[] = [
  'empty', 'nebula', 'asteroid_field', 'station', 'anomaly'
];

export const SECTOR_WEIGHTS: Record<SectorType, number> = {
  empty: 0.60,
  asteroid_field: 0.15,
  nebula: 0.10,
  anomaly: 0.10,
  station: 0.05,
};

export const AP_DEFAULTS = {
  max: 100,
  startingAP: 100,
  regenPerSecond: 0.5,  // 1 AP every 2 seconds
};

export const AP_COSTS = {
  jump: 5,
  scan: 3,
};

export const WORLD_SEED = 42;

export const JUMP_RANGE = 1;  // max sectors per jump (explored territory)
export const RADAR_RADIUS = 2;  // visible sectors around player

export const RECONNECTION_TIMEOUT_S = 15;

// UI Symbols
export const SYMBOLS = {
  ship: '■',
  empty: '·',
  unexplored: '.',
  asteroid_field: '▓',
  nebula: '▒',
  station: '△',
  anomaly: '◊',
  player: '◆',
} as const;

// Colors
export const THEME = {
  amber: {
    primary: '#ffb000',
    dim: 'rgba(255, 176, 0, 0.4)',
    bg: '#0a0a0a',
    danger: '#ff3333',
  },
  green: {
    primary: '#33ff33',
    dim: 'rgba(51, 255, 51, 0.4)',
    bg: '#0a0a0a',
    danger: '#ff3333',
  },
} as const;
```

**Step 5: Write index.ts barrel export**

```ts
// packages/shared/src/index.ts
export * from './types.js';
export * from './constants.js';
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run`
Expected: PASS — all 3 tests

**Step 7: Build shared package**

Run: `npm run build -w packages/shared`
Expected: Compiles to dist/

**Step 8: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types and game constants"
```

---

## Task 3: Database Setup

**Files:**
- Create: `packages/server/src/db/migrations/001_initial.sql`
- Create: `packages/server/src/db/client.ts`
- Create: `packages/server/src/db/queries.ts`
- Create: `packages/server/.env`

**Step 1: Write migration SQL**

```sql
-- packages/server/src/db/migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  home_base JSONB DEFAULT '{"x":0,"y":0}',
  ship_type VARCHAR(32) DEFAULT 'scout',
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1
);

CREATE TABLE sectors (
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  type VARCHAR(32) NOT NULL,
  seed INTEGER NOT NULL,
  discovered_by UUID REFERENCES players(id),
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (x, y)
);

CREATE TABLE player_discoveries (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, sector_x, sector_y)
);

CREATE INDEX idx_sectors_discovered_by ON sectors(discovered_by);
CREATE INDEX idx_discoveries_player ON player_discoveries(player_id);
```

**Step 2: Write .env**

```env
# packages/server/.env
DATABASE_URL=postgres://voidsector:voidsector_dev@localhost:5432/voidsector
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
PORT=2567
```

**Step 3: Write database client**

```ts
// packages/server/src/db/client.ts
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function runMigrations(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const migrationsDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'migrations'
  );
  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
    console.log(`Migration applied: ${file}`);
  }
}

export { pool };
```

**Step 4: Write database queries**

```ts
// packages/server/src/db/queries.ts
import { query } from './client.js';
import type { SectorData, PlayerData } from '@void-sector/shared';

export async function createPlayer(
  username: string,
  passwordHash: string
): Promise<PlayerData> {
  const result = await query<{
    id: string; username: string; home_base: { x: number; y: number };
    ship_type: string; xp: number; level: number;
  }>(
    `INSERT INTO players (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, home_base, ship_type, xp, level`,
    [username, passwordHash]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    homeBase: row.home_base,
    shipType: row.ship_type,
    xp: row.xp,
    level: row.level,
  };
}

export async function findPlayerByUsername(
  username: string
): Promise<(PlayerData & { passwordHash: string }) | null> {
  const result = await query<{
    id: string; username: string; password_hash: string;
    home_base: { x: number; y: number }; ship_type: string;
    xp: number; level: number;
  }>(
    'SELECT id, username, password_hash, home_base, ship_type, xp, level FROM players WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    homeBase: row.home_base,
    shipType: row.ship_type,
    xp: row.xp,
    level: row.level,
  };
}

export async function getSector(x: number, y: number): Promise<SectorData | null> {
  const result = await query<{
    x: number; y: number; type: string; seed: number;
    discovered_by: string | null; discovered_at: string | null;
    metadata: Record<string, unknown>;
  }>(
    'SELECT x, y, type, seed, discovered_by, discovered_at, metadata FROM sectors WHERE x = $1 AND y = $2',
    [x, y]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    x: row.x,
    y: row.y,
    type: row.type as SectorData['type'],
    seed: row.seed,
    discoveredBy: row.discovered_by,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
  };
}

export async function saveSector(sector: SectorData): Promise<void> {
  await query(
    `INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (x, y) DO NOTHING`,
    [sector.x, sector.y, sector.type, sector.seed, sector.discoveredBy, sector.metadata]
  );
}

export async function addDiscovery(
  playerId: string,
  sectorX: number,
  sectorY: number
): Promise<void> {
  await query(
    `INSERT INTO player_discoveries (player_id, sector_x, sector_y)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [playerId, sectorX, sectorY]
  );
}

export async function getPlayerDiscoveries(
  playerId: string
): Promise<Array<{ x: number; y: number }>> {
  const result = await query<{ sector_x: number; sector_y: number }>(
    'SELECT sector_x, sector_y FROM player_discoveries WHERE player_id = $1',
    [playerId]
  );
  return result.rows.map(row => ({ x: row.sector_x, y: row.sector_y }));
}
```

**Step 5: Run migration against Docker PostgreSQL**

Run: `docker compose up -d && cd packages/server && npx tsx -e "import { runMigrations } from './src/db/client.js'; await runMigrations();"`
Expected: "Migration applied: 001_initial.sql"

**Step 6: Commit**

```bash
git add packages/server/src/db/ packages/server/.env docker-compose.yml
git commit -m "feat: add database schema, migrations, and query layer"
```

---

## Task 4: World Generation Engine

**Files:**
- Create: `packages/server/src/engine/worldgen.ts`
- Test: `packages/server/src/engine/__tests__/worldgen.test.ts`

**Step 1: Write the failing test**

```ts
// packages/server/src/engine/__tests__/worldgen.test.ts
import { describe, it, expect } from 'vitest';
import { generateSector, hashCoords } from '../worldgen.js';
import { WORLD_SEED, SECTOR_TYPES } from '@void-sector/shared';

describe('worldgen', () => {
  it('hashCoords is deterministic', () => {
    const a = hashCoords(10, -5, WORLD_SEED);
    const b = hashCoords(10, -5, WORLD_SEED);
    expect(a).toBe(b);
  });

  it('hashCoords differs for different coords', () => {
    const a = hashCoords(10, -5, WORLD_SEED);
    const b = hashCoords(11, -5, WORLD_SEED);
    expect(a).not.toBe(b);
  });

  it('generateSector returns valid sector data', () => {
    const sector = generateSector(10, -5, 'player-1');
    expect(sector.x).toBe(10);
    expect(sector.y).toBe(-5);
    expect(SECTOR_TYPES).toContain(sector.type);
    expect(typeof sector.seed).toBe('number');
    expect(sector.discoveredBy).toBe('player-1');
  });

  it('generateSector is deterministic', () => {
    const a = generateSector(10, -5, 'player-1');
    const b = generateSector(10, -5, 'player-2');
    expect(a.type).toBe(b.type);
    expect(a.seed).toBe(b.seed);
    // discoveredBy differs — that's per-player
  });

  it('generates roughly correct distribution over many sectors', () => {
    const counts: Record<string, number> = {};
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const sector = generateSector(i, i * 7 - 3000, null);
      counts[sector.type] = (counts[sector.type] || 0) + 1;
    }
    // empty should be roughly 60% (allow wide margin)
    expect(counts['empty']! / n).toBeGreaterThan(0.45);
    expect(counts['empty']! / n).toBeLessThan(0.75);
    // station should be roughly 5%
    expect(counts['station']! / n).toBeGreaterThan(0.01);
    expect(counts['station']! / n).toBeLessThan(0.12);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/worldgen.test.ts`
Expected: FAIL — module not found

**Step 3: Implement worldgen.ts**

```ts
// packages/server/src/engine/worldgen.ts
import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED } from '@void-sector/shared';
import type { SectorData, SectorType } from '@void-sector/shared';

/**
 * Simple deterministic hash for coordinates.
 * Uses a variant of MurmurHash-like mixing.
 */
export function hashCoords(x: number, y: number, worldSeed: number): number {
  let h = worldSeed | 0;
  h = Math.imul(h ^ (x | 0), 0x9e3779b9);
  h = Math.imul(h ^ (y | 0), 0x517cc1b7);
  h = h ^ (h >>> 16);
  h = Math.imul(h, 0x85ebca6b);
  h = h ^ (h >>> 13);
  h = Math.imul(h, 0xc2b2ae35);
  h = h ^ (h >>> 16);
  return h >>> 0; // unsigned 32-bit
}

function sectorTypeFromSeed(seed: number): SectorType {
  const normalized = (seed % 10000) / 10000; // 0..1
  let cumulative = 0;
  for (const type of SECTOR_TYPES) {
    cumulative += SECTOR_WEIGHTS[type];
    if (normalized < cumulative) return type;
  }
  return 'empty'; // fallback
}

export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);
  const type = sectorTypeFromSeed(seed);

  return {
    x,
    y,
    type,
    seed,
    discoveredBy,
    discoveredAt: new Date().toISOString(),
    metadata: {},
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/engine/__tests__/worldgen.test.ts`
Expected: PASS — all 5 tests

**Step 5: Commit**

```bash
git add packages/server/src/engine/
git commit -m "feat: add deterministic seed-based world generation"
```

---

## Task 5: AP Engine

**Files:**
- Create: `packages/server/src/engine/ap.ts`
- Test: `packages/server/src/engine/__tests__/ap.test.ts`

**Step 1: Write the failing test**

```ts
// packages/server/src/engine/__tests__/ap.test.ts
import { describe, it, expect } from 'vitest';
import { createAPState, calculateCurrentAP, spendAP } from '../ap.js';
import { AP_DEFAULTS, AP_COSTS } from '@void-sector/shared';

describe('AP engine', () => {
  it('creates AP state with defaults', () => {
    const ap = createAPState();
    expect(ap.current).toBe(AP_DEFAULTS.startingAP);
    expect(ap.max).toBe(AP_DEFAULTS.max);
    expect(ap.regenPerSecond).toBe(AP_DEFAULTS.regenPerSecond);
  });

  it('calculateCurrentAP regenerates over time', () => {
    const now = Date.now();
    const ap = {
      current: 50,
      max: 100,
      lastTick: now - 10_000, // 10 seconds ago
      regenPerSecond: 0.5,
    };
    const result = calculateCurrentAP(ap, now);
    // 10 seconds * 0.5 = 5 AP regenerated
    expect(result.current).toBe(55);
    expect(result.lastTick).toBe(now);
  });

  it('calculateCurrentAP caps at max', () => {
    const now = Date.now();
    const ap = {
      current: 98,
      max: 100,
      lastTick: now - 60_000, // 60 seconds ago
      regenPerSecond: 0.5,
    };
    const result = calculateCurrentAP(ap, now);
    expect(result.current).toBe(100); // capped
  });

  it('spendAP deducts correctly', () => {
    const ap = { current: 50, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = spendAP(ap, AP_COSTS.jump);
    expect(result).not.toBeNull();
    expect(result!.current).toBe(50 - AP_COSTS.jump);
  });

  it('spendAP returns null when not enough AP', () => {
    const ap = { current: 2, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = spendAP(ap, AP_COSTS.jump);
    expect(result).toBeNull();
  });

  it('spendAP regenerates first, then spends', () => {
    const now = Date.now();
    const ap = {
      current: 3, // not enough for jump (5)
      max: 100,
      lastTick: now - 10_000, // 10s ago → +5 AP → 8 AP
      regenPerSecond: 0.5,
    };
    const result = spendAP(ap, AP_COSTS.jump, now);
    expect(result).not.toBeNull();
    expect(result!.current).toBe(3); // 8 - 5 = 3
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/ap.test.ts`
Expected: FAIL — module not found

**Step 3: Implement ap.ts**

```ts
// packages/server/src/engine/ap.ts
import { AP_DEFAULTS } from '@void-sector/shared';
import type { APState } from '@void-sector/shared';

export function createAPState(now: number = Date.now()): APState {
  return {
    current: AP_DEFAULTS.startingAP,
    max: AP_DEFAULTS.max,
    lastTick: now,
    regenPerSecond: AP_DEFAULTS.regenPerSecond,
  };
}

export function calculateCurrentAP(ap: APState, now: number = Date.now()): APState {
  const elapsed = (now - ap.lastTick) / 1000;
  if (elapsed <= 0) return { ...ap, lastTick: now };

  const regenerated = elapsed * ap.regenPerSecond;
  const newCurrent = Math.min(ap.max, ap.current + regenerated);

  return {
    ...ap,
    current: Math.floor(newCurrent),
    lastTick: now,
  };
}

/**
 * Regenerates AP first (lazy evaluation), then attempts to spend.
 * Returns new AP state if successful, null if insufficient AP.
 */
export function spendAP(
  ap: APState,
  cost: number,
  now: number = Date.now()
): APState | null {
  const updated = calculateCurrentAP(ap, now);
  if (updated.current < cost) return null;
  return { ...updated, current: updated.current - cost };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/engine/__tests__/ap.test.ts`
Expected: PASS — all 6 tests

**Step 5: Commit**

```bash
git add packages/server/src/engine/
git commit -m "feat: add AP engine with lazy regeneration"
```

---

## Task 6: Colyseus Server + Auth

**Files:**
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/app.config.ts`
- Create: `packages/server/src/auth.ts`

**Step 1: Write auth module**

```ts
// packages/server/src/auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createPlayer, findPlayerByUsername } from './db/queries.js';
import type { PlayerData } from '@void-sector/shared';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SALT_ROUNDS = 10;

export interface AuthPayload {
  userId: string;
  username: string;
}

export async function register(
  username: string,
  password: string
): Promise<{ player: PlayerData; token: string }> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const player = await createPlayer(username, passwordHash);
  const token = jwt.sign({ userId: player.id, username: player.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
  return { player, token };
}

export async function login(
  username: string,
  password: string
): Promise<{ player: PlayerData; token: string } | null> {
  const found = await findPlayerByUsername(username);
  if (!found) return null;

  const valid = await bcrypt.compare(password, found.passwordHash);
  if (!valid) return null;

  const { passwordHash: _, ...player } = found;
  const token = jwt.sign({ userId: player.id, username: player.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
  return { player, token };
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
```

**Step 2: Write app.config.ts**

```ts
// packages/server/src/app.config.ts
import config from '@colyseus/tools';
import { monitor } from '@colyseus/monitor';
import { SectorRoom } from './rooms/SectorRoom.js';
import { register, login } from './auth.js';
import { runMigrations } from './db/client.js';

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('sector', SectorRoom);
  },

  initializeExpress: (app) => {
    app.use(express => express.json());

    app.post('/api/register', async (req, res) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }
        if (username.length < 3 || username.length > 32) {
          return res.status(400).json({ error: 'Username must be 3-32 characters' });
        }
        if (password.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const result = await register(username, password);
        res.json({ token: result.token, player: result.player });
      } catch (err: any) {
        if (err.code === '23505') { // unique violation
          return res.status(409).json({ error: 'Username already taken' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/api/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        const result = await login(username, password);
        if (!result) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ token: result.token, player: result.player });
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/healthz', (_req, res) => res.json({ ok: true }));
    app.use('/colyseus', monitor());
  },

  beforeListen: async () => {
    await runMigrations();
    console.log('Migrations complete, server starting...');
  },
});
```

**Step 3: Write server entry point**

```ts
// packages/server/src/index.ts
import { listen } from '@colyseus/tools';
import app from './app.config.js';
import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT || 2567);
listen(app, port);
```

**Step 4: Create a stub SectorRoom so the server can start**

```ts
// packages/server/src/rooms/SectorRoom.ts
import { Room, Client } from 'colyseus';

export class SectorRoom extends Room {
  onCreate() {
    console.log('SectorRoom created:', this.roomId);
  }

  onJoin(client: Client) {
    console.log('Client joined:', client.sessionId);
  }

  onLeave(client: Client) {
    console.log('Client left:', client.sessionId);
  }
}
```

**Step 5: Verify the server starts**

Run: `cd packages/server && npx tsx src/index.ts`
Expected: Server starts on port 2567, migrations run, no errors. Ctrl+C to stop.

**Step 6: Commit**

```bash
git add packages/server/src/
git commit -m "feat: add Colyseus server with auth endpoints"
```

---

## Task 7: Colyseus State Schemas

**Files:**
- Create: `packages/server/src/rooms/schema/SectorState.ts`

**Step 1: Write Colyseus state schemas**

```ts
// packages/server/src/rooms/schema/SectorState.ts
import { Schema, MapSchema, type } from '@colyseus/schema';

export class PlayerSchema extends Schema {
  @type('string') sessionId: string = '';
  @type('string') userId: string = '';
  @type('string') username: string = '';
  @type('int32') x: number = 0;
  @type('int32') y: number = 0;
  @type('boolean') connected: boolean = true;
}

export class SectorSchema extends Schema {
  @type('int32') x: number = 0;
  @type('int32') y: number = 0;
  @type('string') sectorType: string = 'empty';
  @type('int32') seed: number = 0;
}

export class SectorRoomState extends Schema {
  @type(SectorSchema) sector = new SectorSchema();
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type('uint16') playerCount: number = 0;
}
```

**Step 2: Commit**

```bash
git add packages/server/src/rooms/schema/
git commit -m "feat: add Colyseus state schemas for SectorRoom"
```

---

## Task 8: SectorRoom Implementation

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Create: `packages/server/src/rooms/services/RedisAPStore.ts`

**Step 1: Write Redis AP store**

```ts
// packages/server/src/rooms/services/RedisAPStore.ts
import Redis from 'ioredis';
import dotenv from 'dotenv';
import type { APState } from '@void-sector/shared';
import { createAPState } from '../../engine/ap.js';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const KEY_PREFIX = 'player:ap:';

export async function getAPState(playerId: string): Promise<APState> {
  const data = await redis.hgetall(`${KEY_PREFIX}${playerId}`);
  if (!data.current) {
    const fresh = createAPState();
    await saveAPState(playerId, fresh);
    return fresh;
  }
  return {
    current: Number(data.current),
    max: Number(data.max),
    lastTick: Number(data.lastTick),
    regenPerSecond: Number(data.regenPerSecond),
  };
}

export async function saveAPState(playerId: string, ap: APState): Promise<void> {
  await redis.hset(`${KEY_PREFIX}${playerId}`, {
    current: String(ap.current),
    max: String(ap.max),
    lastTick: String(ap.lastTick),
    regenPerSecond: String(ap.regenPerSecond),
  });
}

export async function getPlayerPosition(
  playerId: string
): Promise<{ x: number; y: number } | null> {
  const data = await redis.hgetall(`player:pos:${playerId}`);
  if (!data.x) return null;
  return { x: Number(data.x), y: Number(data.y) };
}

export async function savePlayerPosition(
  playerId: string,
  x: number,
  y: number
): Promise<void> {
  await redis.hset(`player:pos:${playerId}`, { x: String(x), y: String(y) });
}

export { redis };
```

**Step 2: Implement SectorRoom**

Replace the stub with the full implementation:

```ts
// packages/server/src/rooms/SectorRoom.ts
import { Room, Client, ServerError } from 'colyseus';
import { SectorRoomState, PlayerSchema, SectorSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { spendAP, calculateCurrentAP } from '../engine/ap.js';
import { getAPState, saveAPState, savePlayerPosition } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries } from '../db/queries.js';
import { AP_COSTS, JUMP_RANGE, RADAR_RADIUS, RECONNECTION_TIMEOUT_S } from '@void-sector/shared';
import type { SectorData, JumpMessage } from '@void-sector/shared';

interface SectorRoomOptions {
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
  autoDispose = true;

  static async onAuth(token: string) {
    if (!token) throw new ServerError(401, 'No token');
    try {
      return verifyToken(token);
    } catch {
      throw new ServerError(403, 'Invalid token');
    }
  }

  async onCreate(options: SectorRoomOptions) {
    const { sectorX, sectorY } = options;
    this.setState(new SectorRoomState());

    // Load or generate sector
    let sectorData = await getSector(sectorX, sectorY);
    if (!sectorData) {
      sectorData = generateSector(sectorX, sectorY, null);
      await saveSector(sectorData);
    }

    this.state.sector.x = sectorData.x;
    this.state.sector.y = sectorData.y;
    this.state.sector.sectorType = sectorData.type;
    this.state.sector.seed = sectorData.seed;

    this.roomId = `sector:${sectorX}:${sectorY}`;

    // Handle jump message
    this.onMessage('jump', async (client, data: JumpMessage) => {
      await this.handleJump(client, data);
    });

    // Handle scan message
    this.onMessage('scan', async (client) => {
      await this.handleScan(client);
    });

    // Handle AP query
    this.onMessage('getAP', async (client) => {
      const auth = client.auth as AuthPayload;
      const ap = await getAPState(auth.userId);
      const updated = calculateCurrentAP(ap);
      await saveAPState(auth.userId, updated);
      client.send('apUpdate', updated);
    });

    // Handle discoveries query
    this.onMessage('getDiscoveries', async (client) => {
      const auth = client.auth as AuthPayload;
      const discoveries = await getPlayerDiscoveries(auth.userId);
      client.send('discoveries', discoveries);
    });
  }

  async onJoin(client: Client, _options: any, auth: AuthPayload) {
    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.userId = auth.userId;
    player.username = auth.username;
    player.x = this.state.sector.x;
    player.y = this.state.sector.y;
    player.connected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerCount = this.state.players.size;

    // Save position
    await savePlayerPosition(auth.userId, this.state.sector.x, this.state.sector.y);

    // Record discovery
    await addDiscovery(auth.userId, this.state.sector.x, this.state.sector.y);

    // Send initial AP state
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    await saveAPState(auth.userId, updated);
    client.send('apUpdate', updated);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;

    if (!consented) {
      try {
        await this.allowReconnection(client, RECONNECTION_TIMEOUT_S);
        if (player) player.connected = true;
        return;
      } catch {
        // reconnection timed out
      }
    }

    this.state.players.delete(client.sessionId);
    this.state.playerCount = this.state.players.size;
  }

  private async handleJump(client: Client, data: JumpMessage) {
    const auth = client.auth as AuthPayload;
    const { targetX, targetY } = data;

    // Validate range
    const dx = Math.abs(targetX - this.state.sector.x);
    const dy = Math.abs(targetY - this.state.sector.y);
    if (dx > JUMP_RANGE || dy > JUMP_RANGE || (dx === 0 && dy === 0)) {
      client.send('jumpResult', { success: false, error: 'Target out of range' });
      return;
    }

    // Spend AP
    const ap = await getAPState(auth.userId);
    const newAP = spendAP(ap, AP_COSTS.jump);
    if (!newAP) {
      client.send('jumpResult', { success: false, error: 'Not enough AP' });
      return;
    }
    await saveAPState(auth.userId, newAP);

    // Load or generate target sector
    let targetSector = await getSector(targetX, targetY);
    if (!targetSector) {
      targetSector = generateSector(targetX, targetY, auth.userId);
      await saveSector(targetSector);
    }

    // Record discovery
    await addDiscovery(auth.userId, targetX, targetY);

    // Tell client to switch rooms
    client.send('jumpResult', {
      success: true,
      newSector: targetSector,
      apRemaining: newAP.current,
    });

    // Client will leave this room and join the new sector room
  }

  private async handleScan(client: Client) {
    const auth = client.auth as AuthPayload;

    const ap = await getAPState(auth.userId);
    const newAP = spendAP(ap, AP_COSTS.scan);
    if (!newAP) {
      client.send('error', { code: 'NO_AP', message: 'Not enough AP to scan' });
      return;
    }
    await saveAPState(auth.userId, newAP);

    // Get surrounding sectors
    const surroundings: SectorData[] = [];
    for (let dx = -RADAR_RADIUS; dx <= RADAR_RADIUS; dx++) {
      for (let dy = -RADAR_RADIUS; dy <= RADAR_RADIUS; dy++) {
        const sx = this.state.sector.x + dx;
        const sy = this.state.sector.y + dy;
        let sector = await getSector(sx, sy);
        if (!sector) {
          sector = generateSector(sx, sy, auth.userId);
          await saveSector(sector);
        }
        await addDiscovery(auth.userId, sx, sy);
        surroundings.push(sector);
      }
    }

    client.send('scanResult', { sectors: surroundings, apRemaining: newAP.current });
  }
}
```

**Step 3: Update app.config.ts to use Express properly**

Replace the `initializeExpress` section to handle JSON body parsing correctly:

```ts
// In packages/server/src/app.config.ts, update initializeExpress:
import express from 'express';

// ...in initializeExpress:
  initializeExpress: (app) => {
    app.use(express.json());

    // ... rest of routes stay the same
  },
```

**Step 4: Verify server starts with the full SectorRoom**

Run: `cd packages/server && npx tsx src/index.ts`
Expected: Server starts, no errors.

**Step 5: Commit**

```bash
git add packages/server/src/
git commit -m "feat: implement SectorRoom with jump, scan, AP spending"
```

---

## Task 9: Client Scaffolding + CRT Theme

**Files:**
- Create: `packages/client/index.html`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`
- Create: `packages/client/src/styles/crt.css`
- Create: `packages/client/src/styles/global.css`
- Create: `packages/client/src/components/CRTOverlay.tsx`

**Step 1: Create Vite config**

```ts
// packages/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:2567',
      '/colyseus': {
        target: 'ws://localhost:2567',
        ws: true,
      },
    },
  },
});
```

**Step 2: Create index.html**

```html
<!-- packages/client/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>VOID SECTOR</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 3: Create global.css**

```css
/* packages/client/src/styles/global.css */
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-primary: #ffb000;
  --color-dim: rgba(255, 176, 0, 0.4);
  --color-bg: #0a0a0a;
  --color-danger: #ff3333;
  --font-mono: 'Share Tech Mono', 'Courier New', Courier, monospace;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-primary);
  font-family: var(--font-mono);
}
```

**Step 4: Create crt.css**

```css
/* packages/client/src/styles/crt.css */

.crt-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.crt-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  background:
    linear-gradient(
      rgba(18, 16, 16, 0) 50%,
      rgba(0, 0, 0, 0.25) 50%
    ),
    linear-gradient(
      90deg,
      rgba(255, 0, 0, 0.03),
      rgba(0, 255, 0, 0.02),
      rgba(0, 0, 255, 0.03)
    );
  background-size: 100% 3px, 3px 100%;
}

.crt-flicker {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 11;
  background: rgba(18, 16, 16, 0.1);
  animation: crt-flicker 0.15s infinite;
}

@keyframes crt-flicker {
  0%   { opacity: 0.27; }
  10%  { opacity: 0.24; }
  20%  { opacity: 0.39; }
  30%  { opacity: 0.40; }
  40%  { opacity: 0.26; }
  50%  { opacity: 0.25; }
  60%  { opacity: 0.30; }
  70%  { opacity: 0.18; }
  80%  { opacity: 0.43; }
  90%  { opacity: 0.33; }
  100% { opacity: 0.27; }
}

.crt-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 9;
  background: radial-gradient(
    ellipse at center,
    transparent 60%,
    rgba(0, 0, 0, 0.7) 100%
  );
}
```

**Step 5: Create CRTOverlay component**

```tsx
// packages/client/src/components/CRTOverlay.tsx
import type { ReactNode } from 'react';
import '../styles/crt.css';

export function CRTOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="crt-wrapper">
      <div className="crt-scanlines" />
      <div className="crt-flicker" />
      <div className="crt-vignette" />
      {children}
    </div>
  );
}
```

**Step 6: Create App.tsx and main.tsx**

```tsx
// packages/client/src/App.tsx
import { CRTOverlay } from './components/CRTOverlay';
import './styles/global.css';

export function App() {
  return (
    <CRTOverlay>
      <div style={{ padding: '16px', position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontSize: '1.2rem', letterSpacing: '0.2em' }}>
          VOID SECTOR
        </h1>
        <p style={{ marginTop: '8px', opacity: 0.6 }}>
          SYSTEM INITIALIZING...
        </p>
      </div>
    </CRTOverlay>
  );
}
```

```tsx
// packages/client/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 7: Verify client starts**

Run: `cd packages/client && npx vite`
Expected: Dev server on :3000, shows "VOID SECTOR" with CRT scanlines and glow.

**Step 8: Commit**

```bash
git add packages/client/
git commit -m "feat: scaffold React client with CRT overlay theme"
```

---

## Task 10: Zustand Store

**Files:**
- Create: `packages/client/src/state/store.ts`
- Create: `packages/client/src/state/gameSlice.ts`
- Create: `packages/client/src/state/uiSlice.ts`

**Step 1: Create game state slice**

```ts
// packages/client/src/state/gameSlice.ts
import type { StateCreator } from 'zustand';
import type { APState, SectorData, Coords } from '@void-sector/shared';

export interface PlayerPresence {
  sessionId: string;
  username: string;
  x: number;
  y: number;
  connected: boolean;
}

export interface GameSlice {
  // Auth
  token: string | null;
  playerId: string | null;
  username: string | null;

  // Position
  position: Coords;

  // AP
  ap: APState | null;

  // Current sector
  currentSector: SectorData | null;

  // Players in current sector
  players: Record<string, PlayerPresence>;

  // Discovered sectors (fog of war map)
  discoveries: Record<string, SectorData>;

  // Event log
  log: string[];

  // Actions
  setAuth: (token: string, playerId: string, username: string) => void;
  clearAuth: () => void;
  setPosition: (pos: Coords) => void;
  setAP: (ap: APState) => void;
  setCurrentSector: (sector: SectorData) => void;
  setPlayer: (sessionId: string, player: PlayerPresence) => void;
  removePlayer: (sessionId: string) => void;
  clearPlayers: () => void;
  addDiscoveries: (sectors: SectorData[]) => void;
  addLogEntry: (message: string) => void;
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set) => ({
  token: localStorage.getItem('vs_token'),
  playerId: localStorage.getItem('vs_playerId'),
  username: localStorage.getItem('vs_username'),
  position: { x: 0, y: 0 },
  ap: null,
  currentSector: null,
  players: {},
  discoveries: {},
  log: [],

  setAuth: (token, playerId, username) => {
    localStorage.setItem('vs_token', token);
    localStorage.setItem('vs_playerId', playerId);
    localStorage.setItem('vs_username', username);
    set({ token, playerId, username });
  },

  clearAuth: () => {
    localStorage.removeItem('vs_token');
    localStorage.removeItem('vs_playerId');
    localStorage.removeItem('vs_username');
    set({ token: null, playerId: null, username: null });
  },

  setPosition: (position) => set({ position }),
  setAP: (ap) => set({ ap }),
  setCurrentSector: (sector) => set({ currentSector: sector }),

  setPlayer: (sessionId, player) =>
    set((s) => ({ players: { ...s.players, [sessionId]: player } })),

  removePlayer: (sessionId) =>
    set((s) => {
      const next = { ...s.players };
      delete next[sessionId];
      return { players: next };
    }),

  clearPlayers: () => set({ players: {} }),

  addDiscoveries: (sectors) =>
    set((s) => {
      const next = { ...s.discoveries };
      for (const sector of sectors) {
        next[`${sector.x}:${sector.y}`] = sector;
      }
      return { discoveries: next };
    }),

  addLogEntry: (message) =>
    set((s) => ({
      log: [...s.log.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`],
    })),
});
```

**Step 2: Create UI state slice**

```ts
// packages/client/src/state/uiSlice.ts
import type { StateCreator } from 'zustand';

export type Screen = 'login' | 'game';
export type ThemeColor = 'amber' | 'green';

export interface UISlice {
  screen: Screen;
  theme: ThemeColor;
  jumpPending: boolean;

  setScreen: (screen: Screen) => void;
  setTheme: (theme: ThemeColor) => void;
  setJumpPending: (pending: boolean) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  screen: 'login',
  theme: (localStorage.getItem('vs_theme') as ThemeColor) || 'amber',
  jumpPending: false,

  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    localStorage.setItem('vs_theme', theme);
    set({ theme });
  },
  setJumpPending: (jumpPending) => set({ jumpPending }),
});
```

**Step 3: Compose the store**

```ts
// packages/client/src/state/store.ts
import { create } from 'zustand';
import { createGameSlice, type GameSlice } from './gameSlice';
import { createUISlice, type UISlice } from './uiSlice';

export type StoreState = GameSlice & UISlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createGameSlice(...a),
  ...createUISlice(...a),
}));
```

**Step 4: Commit**

```bash
git add packages/client/src/state/
git commit -m "feat: add Zustand store with game and UI slices"
```

---

## Task 11: Colyseus Client Network Layer

**Files:**
- Create: `packages/client/src/network/client.ts`

**Step 1: Write the network layer**

```ts
// packages/client/src/network/client.ts
import { Client, Room } from 'colyseus.js';
import { useStore } from '../state/store';
import type { APState, SectorData } from '@void-sector/shared';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';

class GameNetwork {
  private client: Client;
  private sectorRoom: Room | null = null;

  constructor() {
    this.client = new Client(WS_URL);
  }

  async joinSector(x: number, y: number): Promise<void> {
    const store = useStore.getState();
    if (!store.token) throw new Error('Not authenticated');

    // Leave current room
    if (this.sectorRoom) {
      await this.sectorRoom.leave();
      this.sectorRoom = null;
      store.clearPlayers();
    }

    this.client.auth.token = store.token;
    this.sectorRoom = await this.client.joinOrCreate('sector', {
      sectorX: x,
      sectorY: y,
    });

    this.setupRoomListeners(this.sectorRoom);
    store.setPosition({ x, y });
    store.addLogEntry(`Entered sector (${x}, ${y})`);
  }

  private setupRoomListeners(room: Room) {
    const store = useStore.getState;

    // State change: sync players
    room.state.players.onAdd((player: any, sessionId: string) => {
      useStore.getState().setPlayer(sessionId, {
        sessionId,
        username: player.username,
        x: player.x,
        y: player.y,
        connected: player.connected,
      });
    });

    room.state.players.onRemove((_player: any, sessionId: string) => {
      useStore.getState().removePlayer(sessionId);
    });

    // Sector data
    room.onStateChange.once((state: any) => {
      const sector: SectorData = {
        x: state.sector.x,
        y: state.sector.y,
        type: state.sector.sectorType,
        seed: state.sector.seed,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
      };
      useStore.getState().setCurrentSector(sector);
      useStore.getState().addDiscoveries([sector]);
    });

    // AP updates
    room.onMessage('apUpdate', (ap: APState) => {
      useStore.getState().setAP(ap);
    });

    // Jump result
    room.onMessage('jumpResult', async (data: {
      success: boolean;
      error?: string;
      newSector?: SectorData;
      apRemaining?: number;
    }) => {
      useStore.getState().setJumpPending(false);
      if (data.success && data.newSector) {
        useStore.getState().addDiscoveries([data.newSector]);
        useStore.getState().addLogEntry(
          `Jumped to (${data.newSector.x}, ${data.newSector.y}) — ${data.newSector.type}`
        );
        // Leave current room and join new sector
        await this.joinSector(data.newSector.x, data.newSector.y);
      } else {
        useStore.getState().addLogEntry(`Jump failed: ${data.error}`);
      }
    });

    // Scan result
    room.onMessage('scanResult', (data: {
      sectors: SectorData[];
      apRemaining: number;
    }) => {
      useStore.getState().addDiscoveries(data.sectors);
      useStore.getState().setAP({
        ...useStore.getState().ap!,
        current: data.apRemaining,
      });
      useStore.getState().addLogEntry(
        `Scan complete: ${data.sectors.length} sectors revealed`
      );
    });

    // Discoveries
    room.onMessage('discoveries', (data: Array<{ x: number; y: number }>) => {
      // These are just coordinates — we don't have full sector data yet
      // but we can mark them as discovered
      useStore.getState().addLogEntry(`Loaded ${data.length} discovered sectors`);
    });

    // Errors
    room.onMessage('error', (data: { code: string; message: string }) => {
      useStore.getState().addLogEntry(`ERROR: ${data.message}`);
    });

    room.onLeave((code) => {
      if (code > 1000) {
        useStore.getState().addLogEntry(`Disconnected (code: ${code})`);
      }
    });
  }

  sendJump(targetX: number, targetY: number) {
    if (!this.sectorRoom) return;
    useStore.getState().setJumpPending(true);
    this.sectorRoom.send('jump', { targetX, targetY });
  }

  sendScan() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('scan', {});
  }

  requestAP() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getAP', {});
  }

  requestDiscoveries() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getDiscoveries', {});
  }
}

export const network = new GameNetwork();
```

**Step 2: Commit**

```bash
git add packages/client/src/network/
git commit -m "feat: add Colyseus client network layer"
```

---

## Task 12: Login Screen

**Files:**
- Create: `packages/client/src/components/LoginScreen.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Write login screen**

```tsx
// packages/client/src/components/LoginScreen.tsx
import { useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const API_URL = import.meta.env.VITE_API_URL || '';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const setAuth = useStore((s) => s.setAuth);
  const setScreen = useStore((s) => s.setScreen);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/register' : '/api/login';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unknown error');
        return;
      }
      setAuth(data.token, data.player.id, data.player.username);
      setScreen('game');
      await network.joinSector(0, 0); // spawn at home base
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '16px',
      position: 'relative',
      zIndex: 1,
    }}>
      <h1 style={{ fontSize: '1.5rem', letterSpacing: '0.3em', marginBottom: '32px' }}>
        VOID SECTOR
      </h1>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '300px',
      }}>
        <input
          type="text"
          placeholder="USERNAME"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
          minLength={3}
          maxLength={32}
          required
        />
        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          minLength={6}
          required
        />
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>{error}</div>}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'CONNECTING...' : isRegister ? 'REGISTER' : 'LOGIN'}
        </button>
        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          style={{ ...buttonStyle, opacity: 0.6, border: 'none' }}
        >
          {isRegister ? 'HAVE ACCOUNT? LOGIN' : 'NEW PILOT? REGISTER'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  padding: '10px 12px',
  fontSize: '0.9rem',
  letterSpacing: '0.1em',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  padding: '10px 12px',
  fontSize: '0.9rem',
  letterSpacing: '0.2em',
  cursor: 'pointer',
  textTransform: 'uppercase',
};
```

**Step 2: Update App.tsx to route between screens**

```tsx
// packages/client/src/App.tsx
import { CRTOverlay } from './components/CRTOverlay';
import { LoginScreen } from './components/LoginScreen';
import { useStore } from './state/store';
import './styles/global.css';

export function App() {
  const screen = useStore((s) => s.screen);

  return (
    <CRTOverlay>
      {screen === 'login' && <LoginScreen />}
      {screen === 'game' && (
        <div style={{ position: 'relative', zIndex: 1, padding: 16 }}>
          <p>GAME SCREEN — TODO</p>
        </div>
      )}
    </CRTOverlay>
  );
}
```

**Step 3: Commit**

```bash
git add packages/client/src/
git commit -m "feat: add login/register screen"
```

---

## Task 13: Radar Canvas Renderer

**Files:**
- Create: `packages/client/src/canvas/useCanvas.ts`
- Create: `packages/client/src/canvas/RadarRenderer.ts`
- Create: `packages/client/src/components/RadarCanvas.tsx`

**Step 1: Create useCanvas hook**

```ts
// packages/client/src/canvas/useCanvas.ts
import { useRef, useLayoutEffect, useEffect, useCallback } from 'react';

type DrawFn = (ctx: CanvasRenderingContext2D) => void;

export function useCanvas(draw: DrawFn) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle DPR and resize
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [resize]);

  // Animation loop
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const render = () => {
      draw(ctx);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  return canvasRef;
}
```

**Step 2: Create RadarRenderer**

```ts
// packages/client/src/canvas/RadarRenderer.ts
import { SYMBOLS, THEME, RADAR_RADIUS } from '@void-sector/shared';
import type { SectorData, Coords } from '@void-sector/shared';
import type { PlayerPresence } from '../state/gameSlice';

const CELL_SIZE = 36; // px per grid cell
const FONT_SIZE = 16;
const FONT = `${FONT_SIZE}px 'Share Tech Mono', 'Courier New', monospace`;

interface RadarState {
  position: Coords;
  discoveries: Record<string, SectorData>;
  players: Record<string, PlayerPresence>;
  currentSector: SectorData | null;
  themeColor: string;
  dimColor: string;
}

export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState) {
  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;

  // Clear
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;
  const radius = RADAR_RADIUS;

  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw grid
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const sx = state.position.x + dx;
      const sy = state.position.y + dy;
      const screenX = centerX + dx * CELL_SIZE;
      const screenY = centerY + dy * CELL_SIZE;

      const key = `${sx}:${sy}`;
      const sector = state.discoveries[key];

      if (dx === 0 && dy === 0) {
        // Player ship
        drawGlowText(ctx, SYMBOLS.ship, screenX, screenY, state.themeColor, 10);
      } else if (sector) {
        const symbol = getSectorSymbol(sector.type);
        const color = dx === 0 && dy === 0 ? state.themeColor : state.dimColor;
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
        ctx.fillText(symbol, screenX, screenY);
      } else {
        // Unexplored
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.shadowBlur = 0;
        ctx.fillText(SYMBOLS.unexplored, screenX, screenY);
      }
    }
  }

  // Draw other players
  for (const player of Object.values(state.players)) {
    if (player.x === state.position.x && player.y === state.position.y) {
      // Player is in the same sector — draw offset slightly
      const offsetX = centerX + (Math.random() - 0.5) * 8;
      const offsetY = centerY + 12;
      drawGlowText(ctx, SYMBOLS.player, offsetX, offsetY, state.themeColor, 6);
    }
  }

  // Draw crosshair / grid lines
  ctx.strokeStyle = state.dimColor;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.2;
  // Horizontal
  ctx.beginPath();
  ctx.moveTo(centerX - radius * CELL_SIZE - 10, centerY);
  ctx.lineTo(centerX + radius * CELL_SIZE + 10, centerY);
  ctx.stroke();
  // Vertical
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius * CELL_SIZE - 10);
  ctx.lineTo(centerX, centerY + radius * CELL_SIZE + 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Coordinate labels at edges
  ctx.font = `${FONT_SIZE * 0.7}px 'Share Tech Mono', monospace`;
  ctx.fillStyle = state.dimColor;
  for (let dx = -radius; dx <= radius; dx++) {
    const sx = state.position.x + dx;
    const screenX = centerX + dx * CELL_SIZE;
    ctx.fillText(String(sx), screenX, centerY + (radius + 1) * CELL_SIZE);
  }
  for (let dy = -radius; dy <= radius; dy++) {
    const sy = state.position.y + dy;
    const screenY = centerY + dy * CELL_SIZE;
    ctx.fillText(String(sy), centerX - (radius + 1) * CELL_SIZE, screenY);
  }
}

function getSectorSymbol(type: string): string {
  switch (type) {
    case 'asteroid_field': return SYMBOLS.asteroid_field;
    case 'nebula': return SYMBOLS.nebula;
    case 'station': return SYMBOLS.station;
    case 'anomaly': return SYMBOLS.anomaly;
    case 'empty':
    default: return SYMBOLS.empty;
  }
}

function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  blur: number
) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur / 3;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}
```

**Step 3: Create RadarCanvas component**

```tsx
// packages/client/src/components/RadarCanvas.tsx
import { useCallback } from 'react';
import { useCanvas } from '../canvas/useCanvas';
import { drawRadar } from '../canvas/RadarRenderer';
import { useStore } from '../state/store';
import { THEME } from '@void-sector/shared';

export function RadarCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const state = useStore.getState();
    const themeColors = THEME[state.theme];

    drawRadar(ctx, {
      position: state.position,
      discoveries: state.discoveries,
      players: state.players,
      currentSector: state.currentSector,
      themeColor: themeColors.primary,
      dimColor: themeColors.dim,
    });
  }, []);

  const canvasRef = useCanvas(draw);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
```

**Step 4: Commit**

```bash
git add packages/client/src/canvas/ packages/client/src/components/RadarCanvas.tsx
git commit -m "feat: add radar canvas renderer with CRT glow effects"
```

---

## Task 14: Game Screen + HUD + Navigation

**Files:**
- Create: `packages/client/src/components/GameScreen.tsx`
- Create: `packages/client/src/components/HUD.tsx`
- Create: `packages/client/src/components/NavControls.tsx`
- Create: `packages/client/src/components/EventLog.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Create HUD component**

```tsx
// packages/client/src/components/HUD.tsx
import { useStore } from '../state/store';

export function HUD() {
  const ap = useStore((s) => s.ap);
  const position = useStore((s) => s.position);
  const currentSector = useStore((s) => s.currentSector);
  const playerCount = Object.keys(useStore((s) => s.players)).length;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderBottom: '1px solid var(--color-dim)',
      fontSize: '0.8rem',
      letterSpacing: '0.1em',
    }}>
      <span>VOID SECTOR</span>
      <span>AP: {ap ? `${ap.current}/${ap.max}` : '---'}</span>
    </div>
  );
}

export function SectorInfo() {
  const position = useStore((s) => s.position);
  const currentSector = useStore((s) => s.currentSector);
  const players = useStore((s) => s.players);
  const playerCount = Object.keys(players).length;

  return (
    <div style={{
      padding: '6px 12px',
      borderTop: '1px solid var(--color-dim)',
      borderBottom: '1px solid var(--color-dim)',
      fontSize: '0.75rem',
      display: 'flex',
      justifyContent: 'space-between',
      letterSpacing: '0.1em',
    }}>
      <span>SECTOR: ({position.x}, {position.y})</span>
      <span>{currentSector?.type?.toUpperCase() || '---'}</span>
      <span>PILOTS: {playerCount}</span>
    </div>
  );
}
```

**Step 2: Create NavControls component**

```tsx
// packages/client/src/components/NavControls.tsx
import { useStore } from '../state/store';
import { network } from '../network/client';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '1.2rem',
  width: '44px',
  height: '44px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const scanBtnStyle: React.CSSProperties = {
  ...btnStyle,
  width: 'auto',
  padding: '0 16px',
  fontSize: '0.8rem',
  letterSpacing: '0.15em',
};

export function NavControls() {
  const position = useStore((s) => s.position);
  const jumpPending = useStore((s) => s.jumpPending);

  function jump(dx: number, dy: number) {
    if (jumpPending) return;
    network.sendJump(position.x + dx, position.y + dy);
  }

  function scan() {
    network.sendScan();
  }

  return (
    <div style={{
      padding: '8px 12px',
      display: 'flex',
      justifyContent: 'center',
      gap: '8px',
      alignItems: 'center',
    }}>
      <button style={btnStyle} onClick={() => jump(0, -1)} disabled={jumpPending}>↑</button>
      <button style={btnStyle} onClick={() => jump(-1, 0)} disabled={jumpPending}>←</button>
      <button style={btnStyle} onClick={() => jump(0, 1)} disabled={jumpPending}>↓</button>
      <button style={btnStyle} onClick={() => jump(1, 0)} disabled={jumpPending}>→</button>
      <div style={{ width: '16px' }} />
      <button style={scanBtnStyle} onClick={scan} disabled={jumpPending}>SCAN</button>
    </div>
  );
}
```

**Step 3: Create EventLog component**

```tsx
// packages/client/src/components/EventLog.tsx
import { useRef, useEffect } from 'react';
import { useStore } from '../state/store';

export function EventLog() {
  const log = useStore((s) => s.log);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '6px 12px',
      fontSize: '0.7rem',
      opacity: 0.7,
      lineHeight: 1.6,
    }}>
      {log.map((entry, i) => (
        <div key={i}>&gt; {entry}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 4: Create GameScreen component**

```tsx
// packages/client/src/components/GameScreen.tsx
import { RadarCanvas } from './RadarCanvas';
import { HUD, SectorInfo } from './HUD';
import { NavControls } from './NavControls';
import { EventLog } from './EventLog';

export function GameScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      zIndex: 1,
    }}>
      <HUD />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <RadarCanvas />
      </div>
      <SectorInfo />
      <NavControls />
      <EventLog />
    </div>
  );
}
```

**Step 5: Update App.tsx**

```tsx
// packages/client/src/App.tsx
import { CRTOverlay } from './components/CRTOverlay';
import { LoginScreen } from './components/LoginScreen';
import { GameScreen } from './components/GameScreen';
import { useStore } from './state/store';
import './styles/global.css';

export function App() {
  const screen = useStore((s) => s.screen);

  return (
    <CRTOverlay>
      {screen === 'login' && <LoginScreen />}
      {screen === 'game' && <GameScreen />}
    </CRTOverlay>
  );
}
```

**Step 6: Verify client renders game screen**

Run: `cd packages/client && npx vite`
Expected: Login screen renders. After setting screen to 'game' manually, game layout visible.

**Step 7: Commit**

```bash
git add packages/client/src/
git commit -m "feat: add game screen with radar, HUD, navigation, and event log"
```

---

## Task 15: Integration Test

**Files:** None new — this is a manual verification task.

**Step 1: Start infrastructure**

Run: `docker compose up -d`

**Step 2: Start server**

Run: `cd packages/server && npx tsx src/index.ts`
Expected: Migrations run, server on :2567

**Step 3: Start client**

Run: `cd packages/client && npx vite`
Expected: Dev server on :3000

**Step 4: Test the full flow**

1. Open http://localhost:3000
2. Register a new account
3. Verify you enter the game screen
4. See the radar with your ship at (0,0)
5. Click navigation arrows to jump to adjacent sectors
6. Verify AP decreases
7. Click SCAN to reveal surrounding sectors
8. Verify discovered sectors show on radar
9. Open a second browser tab, register another account
10. Jump to the same sector — verify both players appear

**Step 5: Fix any issues found during integration**

If issues are found, fix them in the relevant file and re-test.

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from manual testing"
```

---

## Task 16: Final Cleanup & Dev Scripts

**Files:**
- Modify: `packages/server/.env` (ensure not committed to git)
- Create: `packages/server/.env.example`
- Modify: `.gitignore`
- Modify: root `package.json`

**Step 1: Create .env.example**

```env
# packages/server/.env.example
DATABASE_URL=postgres://voidsector:voidsector_dev@localhost:5432/voidsector
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-this-in-production
PORT=2567
```

**Step 2: Update .gitignore**

Ensure `.env` files (but not `.env.example`) are excluded.

```
node_modules/
dist/
.env
.env.local
*.local
```

**Step 3: Add a convenience dev script to root package.json**

Add to root `package.json` scripts:
```json
"dev": "npm run dev:server & npm run dev:client",
"docker:up": "docker compose up -d",
"docker:down": "docker compose down"
```

**Step 4: Verify full dev workflow**

Run:
```bash
npm run docker:up
npm run dev
```
Expected: PostgreSQL + Redis start, server starts on :2567, client on :3000.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: add dev scripts and env example"
```

---

## Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Monorepo scaffolding | — |
| 2 | Shared types & constants | 1 |
| 3 | Database setup | 1 |
| 4 | World generation engine | 2 |
| 5 | AP engine | 2 |
| 6 | Colyseus server + auth | 3 |
| 7 | Colyseus state schemas | 2 |
| 8 | SectorRoom implementation | 4, 5, 6, 7 |
| 9 | Client scaffolding + CRT theme | 1 |
| 10 | Zustand store | 2, 9 |
| 11 | Colyseus client network layer | 10 |
| 12 | Login screen | 10, 11 |
| 13 | Radar canvas renderer | 2, 10 |
| 14 | Game screen + HUD + navigation | 11, 12, 13 |
| 15 | Integration test | 8, 14 |
| 16 | Final cleanup | 15 |

**Parallelizable work:**
- Tasks 4 + 5 (both just need Task 2)
- Tasks 9 + 3 (independent: client scaffold vs DB setup)
- Tasks 10 + 6 + 7 (after their deps)
- Tasks 12 + 13 (both need Task 10, but are independent)
