# UX, Scan, Comms & Infrastructure Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 8 features from the approved design: jump animation, radar zoom/pan, visual contrast overhaul, two-stage scan, AP display, cluster spawn, communication system, and comprehensive tests.

**Architecture:** Monorepo (packages/shared, packages/server, packages/client). Server uses Colyseus rooms + PostgreSQL + Redis. Client uses React + Zustand + Canvas. All new types go in shared, server handlers in SectorRoom.ts, client UI in component files. TDD with Vitest throughout.

**Tech Stack:** TypeScript, React 18, Zustand, Colyseus 0.15, PostgreSQL, Redis (ioredis), Canvas API, Vitest, @testing-library/react, jsdom

---

## Phase 1: Foundation (Types, Constants, DB, Test Setup)

### Task 1: Add new shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add scan types**

Add after the existing `JettisonMessage` type:

```typescript
// Local scan
export interface LocalScanResult {
  resources: SectorResources;
  rareResources?: Record<string, number>;
  hiddenObjects?: string[];
  hiddenSignatures: boolean;
}

export type LocalScanMessage = Record<string, never>;

export interface LocalScanResultMessage {
  resources: SectorResources;
  hiddenSignatures: boolean;
}
```

**Step 2: Add structure types**

```typescript
// Structures
export type StructureType = 'comm_relay' | 'mining_station' | 'base';

export interface Structure {
  id: string;
  ownerId: string;
  type: StructureType;
  sectorX: number;
  sectorY: number;
  createdAt: string;
}

export interface BuildMessage {
  type: StructureType;
}

export interface BuildResultMessage {
  success: boolean;
  error?: string;
  structure?: Structure;
}
```

**Step 3: Add communication types**

```typescript
// Communication
export type ChatChannel = 'direct' | 'faction' | 'local';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  channel: ChatChannel;
  recipientId?: string;
  content: string;
  sentAt: number;
  delayed: boolean;
}

export interface SendChatMessage {
  channel: ChatChannel;
  recipientId?: string;
  content: string;
}
```

**Step 4: Add badge types**

```typescript
// Badges
export type BadgeType = 'ORIGIN_FIRST' | 'ORIGIN_REACHED';

export interface Badge {
  playerId: string;
  badgeType: BadgeType;
  awardedAt: string;
}
```

**Step 5: Fix ScanResultMessage mismatch**

The existing `ScanResultMessage` type says `{ sector, apRemaining }` (singular) but server sends `{ sectors: SectorData[], apRemaining }`. Fix:

```typescript
// Replace existing ScanResultMessage
export interface ScanResultMessage {
  sectors: SectorData[];
  apRemaining: number;
}
```

**Step 6: Export all new types from barrel**

Update `packages/shared/src/index.ts` to re-export all new types.

**Step 7: Run `npm run build` in shared package to verify compilation**

Run: `cd packages/shared && npm run build`
Expected: No errors

**Step 8: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat(shared): add types for scan, structures, comms, badges"
```

---

### Task 2: Add new constants

**Files:**
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add scan cost constants**

```typescript
export const AP_COSTS_BY_SCANNER: Record<number, { areaScan: number; areaScanRadius: number }> = {
  1: { areaScan: 3, areaScanRadius: 2 },
  2: { areaScan: 5, areaScanRadius: 3 },
  3: { areaScan: 8, areaScanRadius: 5 },
};

export const AP_COSTS_LOCAL_SCAN = 1;
```

**Step 2: Add structure cost constants**

```typescript
export const STRUCTURE_COSTS: Record<StructureType, Record<ResourceType, number>> = {
  comm_relay: { ore: 5, gas: 0, crystal: 2 },
  mining_station: { ore: 30, gas: 15, crystal: 10 },
  base: { ore: 50, gas: 30, crystal: 25 },
};

export const STRUCTURE_AP_COSTS: Record<StructureType, number> = {
  comm_relay: 5,
  mining_station: 15,
  base: 25,
};

export const RELAY_RANGES: Record<StructureType, number> = {
  comm_relay: 500,
  mining_station: 500,
  base: 1000,
};
```

**Step 3: Add comm range constants**

Add `commRange` to each entry in `SHIP_CLASSES`:

```typescript
// In aegis_scout_mk1:
commRange: 50,
// In void_seeker_mk2:
commRange: 200,
```

**Step 4: Add sector color constants**

```typescript
export const SECTOR_COLORS: Record<SectorType | 'home_base', string> = {
  empty: '#FFB000',
  asteroid_field: '#FF8C00',
  nebula: '#00BFFF',
  station: '#00FF88',
  anomaly: '#FF00FF',
  pirate: '#FF3333',
  home_base: '#FFFFFF',
};
```

**Step 5: Add spawn constants**

```typescript
export const SPAWN_MIN_DISTANCE = 10_000_000;
export const SPAWN_DISTANCE_VARIANCE = 2_000_000;
export const SPAWN_CLUSTER_RADIUS = 100;
export const SPAWN_CLUSTER_MAX_PLAYERS = 5;
```

**Step 6: Add COMMS monitor ID**

```typescript
export const MONITORS = {
  NAV_COM: 'NAV-COM',
  SHIP_SYS: 'SHIP-SYS',
  MINING: 'MINING',
  CARGO: 'CARGO',
  COMMS: 'COMMS',
} as const;
```

**Step 7: Add import for StructureType**

Add `StructureType` and `ResourceType` to the import from `'./types.js'` if not already there.

**Step 8: Build shared package**

Run: `cd packages/shared && npm run build`
Expected: No errors

**Step 9: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat(shared): add constants for scan levels, structures, comms, spawn, sector colors"
```

---

### Task 3: Database migrations

**Files:**
- Create: `packages/server/src/db/migrations/003_structures.sql`
- Create: `packages/server/src/db/migrations/004_comms.sql`
- Create: `packages/server/src/db/migrations/005_spawn_clusters.sql`

**Step 1: Create structures migration**

File `003_structures.sql`:

```sql
CREATE TABLE IF NOT EXISTS structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES players(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sector_x, sector_y, type)
);

CREATE INDEX idx_structures_owner ON structures(owner_id);
CREATE INDEX idx_structures_sector ON structures(sector_x, sector_y);
```

**Step 2: Create comms migration**

File `004_comms.sql`:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES players(id),
  recipient_id UUID REFERENCES players(id),
  channel VARCHAR(16) NOT NULL DEFAULT 'direct',
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_messages_recipient ON messages(recipient_id, delivered);
CREATE INDEX idx_messages_channel ON messages(channel);

CREATE TABLE IF NOT EXISTS badges (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  badge_type VARCHAR(32) NOT NULL,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, badge_type)
);
```

**Step 3: Create spawn clusters migration**

File `005_spawn_clusters.sql`:

```sql
CREATE TABLE IF NOT EXISTS spawn_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_x INTEGER NOT NULL,
  center_y INTEGER NOT NULL,
  player_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_spawn_clusters_count ON spawn_clusters(player_count);
```

**Step 4: Run migrations against local DB**

Run: `psql -U voidsector -d voidsector -f packages/server/src/db/migrations/003_structures.sql && psql -U voidsector -d voidsector -f packages/server/src/db/migrations/004_comms.sql && psql -U voidsector -d voidsector -f packages/server/src/db/migrations/005_spawn_clusters.sql`
Expected: CREATE TABLE / CREATE INDEX output, no errors

**Step 5: Commit**

```bash
git add packages/server/src/db/migrations/
git commit -m "feat(server): add DB migrations for structures, comms, badges, spawn clusters"
```

---

### Task 4: Client test infrastructure

**Files:**
- Create: `packages/client/vitest.config.ts`
- Create: `packages/client/src/test/setup.ts`
- Modify: `packages/client/package.json` (add devDependencies)

**Step 1: Install test dependencies**

Run: `cd packages/client && npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-canvas-mock jsdom`
Expected: Packages installed successfully

**Step 2: Create vitest config**

File `packages/client/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      '@void-sector/shared': '../shared/src',
    },
  },
});
```

**Step 3: Create test setup file**

File `packages/client/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import 'jest-canvas-mock';
```

**Step 4: Create store mock helper**

File `packages/client/src/test/mockStore.ts`:

```typescript
import { useStore } from '../state/store';
import type { StoreState } from '../state/store';
import type { APState, SectorData, MiningState, CargoState } from '@void-sector/shared';

const defaultAP: APState = {
  current: 100,
  max: 100,
  lastTick: Date.now(),
  regenPerSecond: 0.5,
};

const defaultSector: SectorData = {
  x: 0,
  y: 0,
  type: 'empty',
  seed: 42,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
};

const defaultCargo: CargoState = { ore: 0, gas: 0, crystal: 0 };

export function mockStoreState(overrides: Partial<StoreState> = {}) {
  const state: Partial<StoreState> = {
    token: 'test-token',
    playerId: 'test-id',
    username: 'TestPilot',
    position: { x: 0, y: 0 },
    ap: defaultAP,
    fuel: { current: 100, max: 100 },
    ship: null,
    currentSector: defaultSector,
    players: {},
    discoveries: { '0:0': defaultSector },
    log: [],
    mining: null,
    cargo: defaultCargo,
    activeMonitor: 'NAV-COM',
    screen: 'game' as const,
    theme: 'amber' as const,
    jumpPending: false,
    ...overrides,
  };
  useStore.setState(state as StoreState);
}
```

**Step 5: Create network mock helper**

File `packages/client/src/test/mockNetwork.ts`:

```typescript
import { vi } from 'vitest';

export function createMockNetwork() {
  return {
    sendJump: vi.fn(),
    sendScan: vi.fn(),
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
    sendJettison: vi.fn(),
    requestAP: vi.fn(),
    requestCargo: vi.fn(),
    requestDiscoveries: vi.fn(),
    requestMiningStatus: vi.fn(),
    sendLocalScan: vi.fn(),
    sendAreaScan: vi.fn(),
    sendBuild: vi.fn(),
    sendChat: vi.fn(),
  };
}
```

**Step 6: Verify test setup works**

Create a smoke test at `packages/client/src/__tests__/setup.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Test setup', () => {
  it('renders a basic component', () => {
    render(<div data-testid="test">hello</div>);
    expect(screen.getByTestId('test')).toHaveTextContent('hello');
  });
});
```

Run: `cd packages/client && npx vitest run`
Expected: 1 test passes

**Step 7: Commit**

```bash
git add packages/client/vitest.config.ts packages/client/src/test/ packages/client/src/__tests__/setup.test.tsx packages/client/package.json package-lock.json
git commit -m "feat(client): set up vitest with jsdom, RTL, jest-canvas-mock, store/network mocks"
```

---

## Phase 2: Spawn System

### Task 5: Spawn logic — server engine

**Files:**
- Create: `packages/server/src/engine/spawn.ts`
- Create: `packages/server/src/engine/__tests__/spawn.test.ts`

**Step 1: Write failing tests for spawn position generation**

File `packages/server/src/engine/__tests__/spawn.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSpawnPosition } from '../spawn.js';
import { SPAWN_MIN_DISTANCE } from '@void-sector/shared';

describe('generateSpawnPosition', () => {
  it('returns position at least SPAWN_MIN_DISTANCE from origin', () => {
    const pos = generateSpawnPosition();
    const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
    expect(dist).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE);
  });

  it('returns integer coordinates', () => {
    const pos = generateSpawnPosition();
    expect(Number.isInteger(pos.x)).toBe(true);
    expect(Number.isInteger(pos.y)).toBe(true);
  });

  it('generates different positions on multiple calls', () => {
    const positions = Array.from({ length: 5 }, () => generateSpawnPosition());
    const unique = new Set(positions.map(p => `${p.x}:${p.y}`));
    expect(unique.size).toBeGreaterThan(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn.test.ts`
Expected: FAIL — `generateSpawnPosition` not found

**Step 3: Implement spawn position generation**

File `packages/server/src/engine/spawn.ts`:

```typescript
import { SPAWN_MIN_DISTANCE, SPAWN_DISTANCE_VARIANCE } from '@void-sector/shared';

export function generateSpawnPosition(): { x: number; y: number } {
  const angle = Math.random() * 2 * Math.PI;
  const distance = SPAWN_MIN_DISTANCE + Math.random() * SPAWN_DISTANCE_VARIANCE;
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn.test.ts`
Expected: 3 tests pass

**Step 5: Commit**

```bash
git add packages/server/src/engine/spawn.ts packages/server/src/engine/__tests__/spawn.test.ts
git commit -m "feat(server): add spawn position generation with distance constraint"
```

---

### Task 6: Spawn queries + cluster assignment

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Create: `packages/server/src/engine/__tests__/spawn-cluster.test.ts`

**Step 1: Write failing tests for cluster assignment**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignToCluster } from '../spawn.js';

// Mock the DB queries module
vi.mock('../../db/queries.js', () => ({
  findNearbyCluster: vi.fn(),
  createCluster: vi.fn(),
  incrementClusterCount: vi.fn(),
}));

import { findNearbyCluster, createCluster, incrementClusterCount } from '../../db/queries.js';

describe('assignToCluster', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('assigns to existing cluster if one is nearby and not full', async () => {
    (findNearbyCluster as any).mockResolvedValue({ id: 'c1', center_x: 100, center_y: 200, player_count: 3 });
    const result = await assignToCluster(105, 210);
    expect(incrementClusterCount).toHaveBeenCalledWith('c1');
    expect(result).toEqual({ clusterId: 'c1', x: 105, y: 210 });
  });

  it('creates new cluster if none nearby', async () => {
    (findNearbyCluster as any).mockResolvedValue(null);
    (createCluster as any).mockResolvedValue({ id: 'c2' });
    const result = await assignToCluster(105, 210);
    expect(createCluster).toHaveBeenCalledWith(105, 210);
    expect(result).toEqual({ clusterId: 'c2', x: 105, y: 210 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn-cluster.test.ts`
Expected: FAIL

**Step 3: Add DB query functions for clusters**

In `packages/server/src/db/queries.ts`, add:

```typescript
export async function findNearbyCluster(x: number, y: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT * FROM spawn_clusters
     WHERE player_count < $3
       AND ABS(center_x - $1) <= $4
       AND ABS(center_y - $2) <= $4
     ORDER BY (center_x - $1)^2 + (center_y - $2)^2
     LIMIT 1`,
    [x, y, SPAWN_CLUSTER_MAX_PLAYERS, SPAWN_CLUSTER_RADIUS]
  );
  return rows[0] || null;
}

export async function createCluster(centerX: number, centerY: number): Promise<{ id: string }> {
  const { rows } = await query(
    'INSERT INTO spawn_clusters (center_x, center_y, player_count) VALUES ($1, $2, 1) RETURNING id',
    [centerX, centerY]
  );
  return rows[0];
}

export async function incrementClusterCount(clusterId: string): Promise<void> {
  await query(
    'UPDATE spawn_clusters SET player_count = player_count + 1 WHERE id = $1',
    [clusterId]
  );
}
```

Import `SPAWN_CLUSTER_MAX_PLAYERS, SPAWN_CLUSTER_RADIUS` from `@void-sector/shared`.

**Step 4: Implement assignToCluster**

In `packages/server/src/engine/spawn.ts`:

```typescript
import { findNearbyCluster, createCluster, incrementClusterCount } from '../db/queries.js';

export async function assignToCluster(x: number, y: number): Promise<{ clusterId: string; x: number; y: number }> {
  const existing = await findNearbyCluster(x, y);
  if (existing) {
    await incrementClusterCount(existing.id);
    return { clusterId: existing.id, x, y };
  }
  const cluster = await createCluster(x, y);
  return { clusterId: cluster.id, x, y };
}
```

**Step 5: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn-cluster.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/server/src/engine/spawn.ts packages/server/src/engine/__tests__/spawn-cluster.test.ts packages/server/src/db/queries.ts
git commit -m "feat(server): add cluster assignment and spawn DB queries"
```

---

### Task 7: Wire spawn into registration

**Files:**
- Modify: `packages/server/src/auth.ts`
- Modify: `packages/server/src/db/queries.ts` (update createPlayer to accept home_base coords)

**Step 1: Update createPlayer to accept home_base coordinates**

In `queries.ts`, change `createPlayer` signature:

```typescript
export async function createPlayer(
  username: string,
  passwordHash: string,
  homeBase: { x: number; y: number } = { x: 0, y: 0 }
): Promise<PlayerData> {
  const { rows } = await query(
    'INSERT INTO players (username, password_hash, home_base) VALUES ($1, $2, $3) RETURNING id, username, home_base, xp, level',
    [username, passwordHash, JSON.stringify(homeBase)]
  );
  // ...
}
```

**Step 2: Update register in auth.ts to use spawn**

In `auth.ts`, after password hash:

```typescript
import { generateSpawnPosition, assignToCluster } from './engine/spawn.js';

// In register function, before createPlayer:
const spawnPos = generateSpawnPosition();
const cluster = await assignToCluster(spawnPos.x, spawnPos.y);
const player = await createPlayer(username, hash, { x: cluster.x, y: cluster.y });
```

**Step 3: Run existing server tests to verify nothing broke**

Run: `cd packages/server && npx vitest run`
Expected: All existing tests pass

**Step 4: Commit**

```bash
git add packages/server/src/auth.ts packages/server/src/db/queries.ts
git commit -m "feat(server): wire cluster spawn into player registration"
```

---

### Task 8: Badge system

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add badge DB queries**

In `queries.ts`:

```typescript
export async function awardBadge(playerId: string, badgeType: string): Promise<boolean> {
  const { rowCount } = await query(
    'INSERT INTO badges (player_id, badge_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [playerId, badgeType]
  );
  return (rowCount ?? 0) > 0;
}

export async function getPlayerBadges(playerId: string): Promise<Array<{ badge_type: string; awarded_at: string }>> {
  const { rows } = await query(
    'SELECT badge_type, awarded_at FROM badges WHERE player_id = $1',
    [playerId]
  );
  return rows;
}

export async function hasAnyoneBadge(badgeType: string): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM badges WHERE badge_type = $1 LIMIT 1',
    [badgeType]
  );
  return rows.length > 0;
}
```

**Step 2: Check for origin badge on jump to (0,0)**

In `SectorRoom.ts` `handleJump`, after sector generation succeeds:

```typescript
// After saving the new sector and recording discovery
if (targetX === 0 && targetY === 0) {
  const isFirst = !(await hasAnyoneBadge('ORIGIN_FIRST'));
  const badgeType = isFirst ? 'ORIGIN_FIRST' : 'ORIGIN_REACHED';
  const awarded = await awardBadge(auth.userId, badgeType);
  if (awarded) {
    client.send('badgeAwarded', { badgeType });
    if (isFirst) {
      this.broadcast('announcement', {
        message: `${auth.username} is the FIRST to reach the Origin!`,
        type: 'origin_first',
      });
    }
  }
}
```

**Step 3: Run existing tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): add origin badge system with first-arrival announcement"
```

---

### Task 9: Client — origin distance display

**Files:**
- Modify: `packages/client/src/components/HUD.tsx`

**Step 1: Add origin distance calculation to SectorInfo**

In `HUD.tsx`, inside `SectorInfo` component, add:

```typescript
const distToOrigin = Math.ceil(Math.sqrt(position.x ** 2 + position.y ** 2));
```

Render after the sector type line:

```tsx
<div style={{ color: 'var(--color-dim)', fontSize: '0.75rem' }}>
  ORIGIN: {distToOrigin.toLocaleString()} SECTORS
</div>
```

**Step 2: Verify manually (visual check)**

Run: `cd packages/client && npm run dev`
Expected: Distance to origin visible in NAV-COM

**Step 3: Commit**

```bash
git add packages/client/src/components/HUD.tsx
git commit -m "feat(client): show origin distance in sector info"
```

---

## Phase 3: Two-Stage Scan

### Task 10: Server — local scan handler

**Files:**
- Modify: `packages/server/src/engine/commands.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/engine/__tests__/commands.test.ts`

**Step 1: Write failing test for validateLocalScan**

In `commands.test.ts`, add:

```typescript
describe('validateLocalScan', () => {
  it('succeeds with sufficient AP', () => {
    const ap = createAPState(1000);
    const result = validateLocalScan(ap, 1, 1);
    expect(result.valid).toBe(true);
    expect(result.newAP).toBeDefined();
  });

  it('fails with insufficient AP', () => {
    const ap = { ...createAPState(1000), current: 0 };
    const result = validateLocalScan(ap, 1, 1);
    expect(result.valid).toBe(false);
  });

  it('returns resource info based on scanner level', () => {
    const ap = createAPState(1000);
    const result = validateLocalScan(ap, 1, 3);
    expect(result.valid).toBe(true);
    // Level 3 has hiddenSignatures: false (can see everything)
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands.test.ts`
Expected: FAIL — `validateLocalScan` not found

**Step 3: Implement validateLocalScan**

In `commands.ts`:

```typescript
import { AP_COSTS_LOCAL_SCAN } from '@void-sector/shared';

export function validateLocalScan(
  ap: APState,
  cost: number = AP_COSTS_LOCAL_SCAN,
  scannerLevel: number = 1
): { valid: boolean; error?: string; newAP?: APState; hiddenSignatures: boolean } {
  const newAP = spendAP(ap, cost, Date.now());
  if (!newAP) {
    return { valid: false, error: 'Insufficient AP', hiddenSignatures: false };
  }
  // Level 3 scanner detects everything — no hidden signatures
  const hiddenSignatures = scannerLevel < 3;
  return { valid: true, newAP, hiddenSignatures };
}
```

**Step 4: Run test**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands.test.ts`
Expected: PASS

**Step 5: Add localScan handler to SectorRoom**

In `SectorRoom.ts`, in `onCreate`:

```typescript
this.onMessage('localScan', (client) => this.handleLocalScan(client));
```

New method `handleLocalScan`:

```typescript
private async handleLocalScan(client: Client) {
  const auth = client.auth as AuthPayload;
  const ap = await getAPState(auth.userId);
  const currentAP = calculateCurrentAP(ap, Date.now());
  const scannerLevel = SHIP_CLASSES.aegis_scout_mk1.scannerLevel;

  const result = validateLocalScan(currentAP, AP_COSTS_LOCAL_SCAN, scannerLevel);
  if (!result.valid) {
    client.send('error', { code: 'LOCAL_SCAN_FAIL', message: result.error! });
    return;
  }

  await saveAPState(auth.userId, result.newAP!);

  const sectorData = await getSector(this.state.sector.x, this.state.sector.y);
  const resources = sectorData?.resources ?? { ore: 0, gas: 0, crystal: 0 };

  client.send('localScanResult', {
    resources,
    hiddenSignatures: result.hiddenSignatures,
  });
  client.send('apUpdate', result.newAP!);
}
```

**Step 6: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 7: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/commands.test.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): add local scan handler with scanner-level-dependent results"
```

---

### Task 11: Server — area scan (refactor existing scan)

**Files:**
- Modify: `packages/server/src/engine/commands.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/engine/__tests__/commands.test.ts`

**Step 1: Write failing test for validateAreaScan**

```typescript
describe('validateAreaScan', () => {
  it('returns correct radius for scanner level 1', () => {
    const ap = createAPState(1000);
    const result = validateAreaScan(ap, 1);
    expect(result.valid).toBe(true);
    expect(result.radius).toBe(2);
    expect(result.cost).toBe(3);
  });

  it('returns correct radius for scanner level 3', () => {
    const ap = createAPState(1000);
    const result = validateAreaScan(ap, 3);
    expect(result.valid).toBe(true);
    expect(result.radius).toBe(5);
    expect(result.cost).toBe(8);
  });

  it('fails with insufficient AP', () => {
    const ap = { ...createAPState(1000), current: 2 };
    const result = validateAreaScan(ap, 1); // costs 3
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands.test.ts`
Expected: FAIL

**Step 3: Implement validateAreaScan**

In `commands.ts`:

```typescript
import { AP_COSTS_BY_SCANNER } from '@void-sector/shared';

export function validateAreaScan(
  ap: APState,
  scannerLevel: number = 1
): { valid: boolean; error?: string; newAP?: APState; radius: number; cost: number } {
  const config = AP_COSTS_BY_SCANNER[scannerLevel] ?? AP_COSTS_BY_SCANNER[1];
  const newAP = spendAP(ap, config.areaScan, Date.now());
  if (!newAP) {
    return { valid: false, error: 'Insufficient AP', radius: config.areaScanRadius, cost: config.areaScan };
  }
  return { valid: true, newAP, radius: config.areaScanRadius, cost: config.areaScan };
}
```

**Step 4: Run test**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands.test.ts`
Expected: PASS

**Step 5: Refactor handleScan to use validateAreaScan**

In `SectorRoom.ts`, rename the message handler from `'scan'` to `'areaScan'` (keep `'scan'` as alias for backward compat):

```typescript
this.onMessage('areaScan', (client) => this.handleAreaScan(client));
this.onMessage('scan', (client) => this.handleAreaScan(client));
```

Rename `handleScan` to `handleAreaScan` and update to use `validateAreaScan`:

```typescript
private async handleAreaScan(client: Client) {
  const auth = client.auth as AuthPayload;
  const ap = await getAPState(auth.userId);
  const currentAP = calculateCurrentAP(ap, Date.now());
  const scannerLevel = SHIP_CLASSES.aegis_scout_mk1.scannerLevel;

  const scanResult = validateAreaScan(currentAP, scannerLevel);
  if (!scanResult.valid) {
    client.send('error', { code: 'SCAN_FAIL', message: scanResult.error! });
    return;
  }

  await saveAPState(auth.userId, scanResult.newAP!);

  const radius = scanResult.radius;
  const sectorX = this.state.sector.x;
  const sectorY = this.state.sector.y;
  const sectors: SectorData[] = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const tx = sectorX + dx;
      const ty = sectorY + dy;
      let sector = await getSector(tx, ty);
      if (!sector) {
        sector = generateSector(tx, ty, auth.userId);
        await saveSector(sector);
      }
      await addDiscovery(auth.userId, tx, ty);
      sectors.push(sector);
    }
  }

  client.send('areaScanResult', { sectors, apRemaining: scanResult.newAP!.current });
  // Keep backward compat
  client.send('scanResult', { sectors, apRemaining: scanResult.newAP!.current });
}
```

**Step 6: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 7: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/commands.test.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): refactor scan to area scan with scanner-level radius/cost"
```

---

### Task 12: Client — scan UI updates

**Files:**
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/NavControls.tsx`
- Modify: `packages/client/src/state/gameSlice.ts`

**Step 1: Add localScan and areaScan to network client**

In `client.ts`, add methods:

```typescript
sendLocalScan() {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('localScan', {});
}

sendAreaScan() {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('areaScan', {});
}
```

**Step 2: Add localScanResult listener in setupRoomListeners**

```typescript
room.onMessage('localScanResult', (data: { resources: SectorResources; hiddenSignatures: boolean }) => {
  const store = useStore.getState();
  // Update current sector with scanned resources
  if (store.currentSector) {
    store.setCurrentSector({ ...store.currentSector, resources: data.resources });
  }
  if (data.hiddenSignatures) {
    store.addLogEntry('UNKNOWN SIGNATURES DETECTED — SCANNER UPGRADE REQUIRED');
  }
  store.addLogEntry(`Local scan: Ore ${data.resources.ore}, Gas ${data.resources.gas}, Crystal ${data.resources.crystal}`);
});
```

**Step 3: Update NavControls with two scan buttons**

In `NavControls.tsx`, replace the single `[SCAN]` button with:

```tsx
<button className="vs-btn" onClick={() => network.sendLocalScan()} disabled={jumpPending}>
  [LOCAL SCAN]
</button>
<button className="vs-btn" onClick={() => network.sendAreaScan()} disabled={jumpPending}>
  [AREA SCAN]
</button>
```

**Step 4: Run client dev to verify**

Run: `cd packages/client && npm run dev`
Expected: Two scan buttons visible in NAV-COM

**Step 5: Commit**

```bash
git add packages/client/src/network/client.ts packages/client/src/components/NavControls.tsx
git commit -m "feat(client): split scan into local scan and area scan buttons"
```

---

## Phase 4: AP Display Improvements

### Task 13: AP regen timer + smooth bar

**Files:**
- Modify: `packages/client/src/components/HUD.tsx`

**Step 1: Add regen timer to StatusBar**

In `StatusBar`, compute:

```typescript
const isFull = ap && ap.current >= ap.max;
const secondsToFull = ap && !isFull
  ? Math.ceil((ap.max - ap.current) / ap.regenPerSecond)
  : 0;
```

Render format:

```tsx
<span style={{ fontSize: '0.75rem', color: 'var(--color-dim)' }}>
  {ap.regenPerSecond}/s | {isFull ? <span style={{ color: '#00FF88' }}>FULL</span> : `FULL ${secondsToFull}s`}
</span>
```

**Step 2: Add live-updating AP with useEffect interval**

Use a `useEffect` + `setInterval` (every 500ms) to update a local `displayAP` state that accounts for regen since `lastTick`:

```typescript
const [displayAP, setDisplayAP] = useState(ap?.current ?? 0);

useEffect(() => {
  if (!ap) return;
  const interval = setInterval(() => {
    const elapsed = (Date.now() - ap.lastTick) / 1000;
    const regen = Math.min(ap.current + elapsed * ap.regenPerSecond, ap.max);
    setDisplayAP(Math.floor(regen));
  }, 500);
  return () => clearInterval(interval);
}, [ap]);
```

**Step 3: Commit**

```bash
git add packages/client/src/components/HUD.tsx
git commit -m "feat(client): add AP regen timer and live-updating AP display"
```

---

### Task 14: AP flash animation on spend

**Files:**
- Modify: `packages/client/src/components/HUD.tsx`
- Modify: `packages/client/src/styles/global.css`

**Step 1: Add flash CSS animation**

In `global.css`:

```css
@keyframes ap-flash {
  0% { color: #FF3333; text-shadow: 0 0 8px #FF3333; }
  50% { color: #FFFFFF; text-shadow: 0 0 8px #FFFFFF; }
  100% { color: var(--color-primary); text-shadow: none; }
}

.ap-flash {
  animation: ap-flash 0.4s ease-out;
}
```

**Step 2: Detect AP decrease and trigger flash**

In `StatusBar`, add a `useRef` for previous AP and a `useState` for flash:

```typescript
const prevAP = useRef(ap?.current ?? 0);
const [flashing, setFlashing] = useState(false);

useEffect(() => {
  if (ap && ap.current < prevAP.current) {
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), 400);
    prevAP.current = ap.current;
    return () => clearTimeout(timer);
  }
  prevAP.current = ap?.current ?? 0;
}, [ap?.current]);
```

Apply class to AP number span:

```tsx
<span className={flashing ? 'ap-flash' : ''}>
  AP: {displayAP}/{ap.max}
</span>
```

**Step 3: Commit**

```bash
git add packages/client/src/components/HUD.tsx packages/client/src/styles/global.css
git commit -m "feat(client): add AP flash animation on spend"
```

---

### Task 15: AP cost preview on hover

**Files:**
- Modify: `packages/client/src/components/NavControls.tsx`

**Step 1: Add title attributes showing AP costs**

Add `title` to each button:

```tsx
<button title={`Jump: ${AP_COSTS.jump} AP`} ...>[↑]</button>
<button title={`Local Scan: ${AP_COSTS_LOCAL_SCAN} AP`} ...>[LOCAL SCAN]</button>
<button title={`Area Scan: ${AP_COSTS_BY_SCANNER[scannerLevel]?.areaScan ?? 3} AP`} ...>[AREA SCAN]</button>
```

Import `AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, SHIP_CLASSES` from shared.

**Step 2: Add "not enough AP" visual feedback**

When AP is insufficient, add a pulsing red style:

```typescript
const canJump = ap && ap.current >= AP_COSTS.jump;
const canLocalScan = ap && ap.current >= AP_COSTS_LOCAL_SCAN;
```

Apply conditional style:

```tsx
style={!canJump ? { borderColor: 'var(--color-danger)', opacity: 0.5 } : undefined}
```

**Step 3: Commit**

```bash
git add packages/client/src/components/NavControls.tsx
git commit -m "feat(client): add AP cost tooltips and insufficient-AP visual feedback"
```

---

## Phase 5: Visual Overhaul

### Task 16: Grid contrast improvements

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Update grid rendering parameters**

Change these constants/values:

```typescript
// Grid line opacity: 0.08 → 0.25
// Grid line width: 1 → 2
// Dim label opacity: 0.4 → 0.6
// Coordinate format: [x/y] → (x,y)
```

In `drawRadar`, find grid line drawing and update `strokeStyle` alpha and `lineWidth`. Find coordinate label rendering and change format string from `[${x}/${y}]` to `(${x},${y})`.

**Step 2: Run client to verify visually**

Run: `cd packages/client && npm run dev`
Expected: Grid lines visibly thicker, coordinates in `(x,y)` format

**Step 3: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): improve grid contrast — thicker lines, higher opacity, (x,y) format"
```

---

### Task 17: Sector type color accents

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Import SECTOR_COLORS and apply per-sector**

```typescript
import { SECTOR_COLORS } from '@void-sector/shared';
```

In the sector rendering loop, determine color:

```typescript
const sectorColor = SECTOR_COLORS[sector.type] ?? SECTOR_COLORS.empty;
```

Use `sectorColor` for both the symbol and label text color instead of the default amber.

**Step 2: Keep grid lines in amber/primary color**

Grid lines stay `rgba(255, 176, 0, 0.25)` — only sector symbols and labels change color.

**Step 3: Verify visually**

Run: `cd packages/client && npm run dev`
Expected: Nebula sectors are cyan, asteroid fields are orange, etc.

**Step 4: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): add sector type color accents on radar"
```

---

### Task 18: Brightness control

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts` (or uiSlice)
- Modify: `packages/client/src/components/MonitorBezel.tsx`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Add brightness state to uiSlice**

In `uiSlice.ts`:

```typescript
brightness: number; // 0.5 to 1.5, default 1.0
setBrightness: (val: number) => void;
```

Persist in localStorage. Initialize from localStorage or default `1.0`.

**Step 2: Add brightness knob to bezel**

In `MonitorBezel.tsx`, add a bottom panel with a draggable brightness control:

```tsx
<div className="bezel-bottom">
  <label style={{ fontSize: '0.6rem', color: '#666' }}>BRIGHTNESS</label>
  <input
    type="range"
    min="50"
    max="150"
    value={brightness * 100}
    onChange={(e) => setBrightness(Number(e.target.value) / 100)}
    style={{ /* styled as knob-like */ }}
  />
</div>
```

**Step 3: Apply brightness as CSS filter**

On the `.crt-content` div:

```tsx
style={{ filter: `brightness(${brightness})` }}
```

**Step 4: Commit**

```bash
git add packages/client/src/state/uiSlice.ts packages/client/src/components/MonitorBezel.tsx
git commit -m "feat(client): add brightness control knob on bezel"
```

---

### Task 19: Color profile system

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`
- Create: `packages/client/src/styles/themes.ts`
- Modify: `packages/client/src/components/GameScreen.tsx` (or App-level)

**Step 1: Define color profiles**

File `packages/client/src/styles/themes.ts`:

```typescript
export const COLOR_PROFILES = {
  'Amber Classic': { primary: '#FFB000', dim: 'rgba(255, 176, 0, 0.6)' },
  'Green Phosphor': { primary: '#00FF66', dim: 'rgba(0, 255, 102, 0.6)' },
  'Ice Blue': { primary: '#00CCFF', dim: 'rgba(0, 204, 255, 0.6)' },
  'High Contrast': { primary: '#FFFFFF', dim: 'rgba(255, 255, 255, 0.6)' },
} as const;

export type ColorProfileName = keyof typeof COLOR_PROFILES;
```

**Step 2: Add profile state and CSS variable application**

In `uiSlice.ts`, add `colorProfile: ColorProfileName` (default `'Amber Classic'`), persisted in localStorage.

In a `useEffect` at the App level, apply to CSS variables:

```typescript
useEffect(() => {
  const profile = COLOR_PROFILES[colorProfile];
  document.documentElement.style.setProperty('--color-primary', profile.primary);
  document.documentElement.style.setProperty('--color-dim', profile.dim);
}, [colorProfile]);
```

**Step 3: Add profile selector to SHIP-SYS monitor**

In `GameScreen.tsx` `ShipSysScreen`, add a profile dropdown:

```tsx
<div>
  <label>DISPLAY PROFILE</label>
  <select value={colorProfile} onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}>
    {Object.keys(COLOR_PROFILES).map(name => (
      <option key={name} value={name}>{name.toUpperCase()}</option>
    ))}
  </select>
</div>
```

**Step 4: Commit**

```bash
git add packages/client/src/styles/themes.ts packages/client/src/state/uiSlice.ts packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): add color profile system with 4 presets"
```

---

### Task 20: Legend/help overlay

**Files:**
- Create: `packages/client/src/components/LegendOverlay.tsx`
- Modify: `packages/client/src/components/MonitorBezel.tsx`

**Step 1: Create legend component**

File `packages/client/src/components/LegendOverlay.tsx`:

```tsx
import { SYMBOLS, SECTOR_COLORS, SECTOR_TYPES } from '@void-sector/shared';

const LEGEND_ENTRIES = [
  { symbol: SYMBOLS.ship, name: 'YOUR SHIP', color: '#FFFFFF' },
  { symbol: SYMBOLS.homeBase, name: 'HOME BASE', color: SECTOR_COLORS.home_base },
  { symbol: SYMBOLS.player, name: 'OTHER PLAYER', color: '#FFB000' },
  ...SECTOR_TYPES.map(type => ({
    symbol: SYMBOLS[type as keyof typeof SYMBOLS] ?? SYMBOLS.empty,
    name: type.toUpperCase().replace('_', ' '),
    color: SECTOR_COLORS[type],
  })),
];

export function LegendOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 400 }}>
        <h3 style={{ marginBottom: 12 }}>RADAR LEGEND</h3>
        {LEGEND_ENTRIES.map(({ symbol, name, color }) => (
          <div key={name} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
            <span style={{ color, fontSize: '1.2rem', width: 24, textAlign: 'center' }}>{symbol}</span>
            <span>{name}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--color-dim)' }}>
          Press ESC or click outside to close
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add [?] button to bezel and toggle state**

In `MonitorBezel.tsx`, add state `const [showLegend, setShowLegend] = useState(false)` and render:

```tsx
<button className="vs-btn" onClick={() => setShowLegend(true)} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
  [?]
</button>
{showLegend && <LegendOverlay onClose={() => setShowLegend(false)} />}
```

Add ESC key listener in a `useEffect`.

**Step 3: Commit**

```bash
git add packages/client/src/components/LegendOverlay.tsx packages/client/src/components/MonitorBezel.tsx
git commit -m "feat(client): add radar legend overlay with [?] help button on bezel"
```

---

### Task 21: Bezel redesign with knob controls

**Files:**
- Modify: `packages/client/src/components/MonitorBezel.tsx`
- Create: `packages/client/src/components/BezelKnob.tsx`
- Modify: `packages/client/src/styles/crt.css`

**Step 1: Create draggable knob component**

File `packages/client/src/components/BezelKnob.tsx`:

```tsx
import { useRef, useCallback } from 'react';

interface BezelKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function BezelKnob({ label, value, min, max, onChange }: BezelKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startVal = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [value]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.buttons) return;
    const delta = (startY.current - e.clientY) / 100;
    const range = max - min;
    const newVal = Math.max(min, Math.min(max, startVal.current + delta * range));
    onChange(newVal);
  }, [min, max, onChange]);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div
        ref={knobRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3a3a3a, #1a1a1a)',
          border: '2px solid #555',
          cursor: 'ns-resize',
          transform: `rotate(${rotation}deg)`,
          position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: '50%', width: 2, height: 8,
          background: '#FFB000', transform: 'translateX(-50%)',
        }} />
      </div>
      <span style={{ fontSize: '0.5rem', color: '#666', letterSpacing: '0.1em' }}>{label}</span>
    </div>
  );
}
```

**Step 2: Integrate knobs into bezel layout**

In `MonitorBezel.tsx`, restructure the bezel to include:
- Left side: PAN knob
- Right side: ZOOM knob
- Bottom center: BRIGHTNESS knob + [?] HELP button

The knobs call store actions (`setZoom`, `setPanOffset`, `setBrightness`).

**Step 3: Update bezel CSS for new layout**

In `crt.css`, update `.bezel-frame` to accommodate the new knob positions:

```css
.bezel-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 6px 12px;
  background: var(--color-bezel);
  border-top: 1px solid #333;
}
```

**Step 4: Commit**

```bash
git add packages/client/src/components/BezelKnob.tsx packages/client/src/components/MonitorBezel.tsx packages/client/src/styles/crt.css
git commit -m "feat(client): redesign bezel with draggable knob controls for zoom/pan/brightness"
```

---

## Phase 6: Radar Zoom & Pan

### Task 22: Zoom state and mousewheel

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`
- Modify: `packages/client/src/canvas/useCanvas.ts`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Add zoom state to uiSlice**

```typescript
zoomLevel: number; // 0, 1, 2 → maps to cell sizes 48, 64, 80
setZoomLevel: (level: number) => void;
```

Default `1` (64px cells, current default).

**Step 2: Update RadarRenderer to use dynamic cell size**

Replace hardcoded `CELL_W = 80` and `CELL_H = 64` with zoom-dependent values:

```typescript
const CELL_SIZES = [
  { w: 48, h: 38, fontSize: 12 },
  { w: 64, h: 50, fontSize: 14 },
  { w: 80, h: 64, fontSize: 16 },
];

export function drawRadar(ctx: CanvasRenderingContext2D, state: RadarState & { zoomLevel: number }) {
  const { w: CELL_W, h: CELL_H, fontSize } = CELL_SIZES[state.zoomLevel] ?? CELL_SIZES[1];
  // ... rest uses CELL_W, CELL_H, fontSize
}
```

**Step 3: Add mousewheel listener**

In the component that wraps the canvas (or in `useCanvas`), add:

```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const current = useStore.getState().zoomLevel;
    const next = e.deltaY < 0 ? Math.min(2, current + 1) : Math.max(0, current - 1);
    useStore.getState().setZoomLevel(next);
  };
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  return () => canvas.removeEventListener('wheel', handleWheel);
}, []);
```

**Step 4: Commit**

```bash
git add packages/client/src/state/uiSlice.ts packages/client/src/canvas/RadarRenderer.ts packages/client/src/canvas/useCanvas.ts
git commit -m "feat(client): add radar zoom with mousewheel and 3 zoom levels"
```

---

### Task 23: Pan state and drag

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/canvas/useCanvas.ts` (or wrapper component)

**Step 1: Add pan state to uiSlice**

```typescript
panOffset: { x: number; y: number }; // sector offset, clamped to ±3
setPanOffset: (offset: { x: number; y: number }) => void;
resetPan: () => void;
```

Default `{ x: 0, y: 0 }`.

**Step 2: Apply pan offset in RadarRenderer**

Instead of centering on `(position.x, position.y)`, center on `(position.x + panOffset.x, position.y + panOffset.y)`. The visible grid shifts by `panOffset`.

**Step 3: Add drag handling on canvas**

```typescript
// In useCanvas or wrapper component
let dragging = false;
let dragStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  panStart = { ...useStore.getState().panOffset };
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = Math.round((e.clientX - dragStart.x) / CELL_W);
  const dy = Math.round((e.clientY - dragStart.y) / CELL_H);
  const newX = Math.max(-3, Math.min(3, panStart.x - dx));
  const newY = Math.max(-3, Math.min(3, panStart.y + dy));
  useStore.getState().setPanOffset({ x: newX, y: newY });
});

canvas.addEventListener('pointerup', () => { dragging = false; });
```

**Step 4: Add double-click to recenter**

```typescript
canvas.addEventListener('dblclick', () => {
  useStore.getState().resetPan();
});
```

**Step 5: Commit**

```bash
git add packages/client/src/state/uiSlice.ts packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): add radar pan with drag, double-click recenter, ±3 sector limit"
```

---

## Phase 7: Jump Animation

### Task 24: Animation state machine

**Files:**
- Create: `packages/client/src/canvas/JumpAnimation.ts`

**Step 1: Define animation state interface**

```typescript
export interface JumpAnimationState {
  active: boolean;
  phase: 'glitch' | 'slide' | 'settle' | 'none';
  progress: number; // 0-1 within current phase
  direction: { dx: number; dy: number };
  startTime: number;
}

const PHASE_DURATIONS = {
  glitch: 200,
  slide: 400,
  settle: 200,
};

const TOTAL_DURATION = 800;

export function createJumpAnimation(dx: number, dy: number): JumpAnimationState {
  return {
    active: true,
    phase: 'glitch',
    progress: 0,
    direction: { dx, dy },
    startTime: performance.now(),
  };
}

export function updateJumpAnimation(state: JumpAnimationState, now: number): JumpAnimationState {
  if (!state.active) return state;

  const elapsed = now - state.startTime;
  if (elapsed >= TOTAL_DURATION) {
    return { ...state, active: false, phase: 'none', progress: 1 };
  }

  if (elapsed < PHASE_DURATIONS.glitch) {
    return { ...state, phase: 'glitch', progress: elapsed / PHASE_DURATIONS.glitch };
  }
  if (elapsed < PHASE_DURATIONS.glitch + PHASE_DURATIONS.slide) {
    const slideElapsed = elapsed - PHASE_DURATIONS.glitch;
    return { ...state, phase: 'slide', progress: slideElapsed / PHASE_DURATIONS.slide };
  }
  const settleElapsed = elapsed - PHASE_DURATIONS.glitch - PHASE_DURATIONS.slide;
  return { ...state, phase: 'settle', progress: settleElapsed / PHASE_DURATIONS.settle };
}
```

**Step 2: Commit**

```bash
git add packages/client/src/canvas/JumpAnimation.ts
git commit -m "feat(client): add jump animation state machine (800ms, 3 phases)"
```

---

### Task 25: CRT glitch effect

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`

**Step 1: Add glitch rendering in drawRadar**

After drawing the normal radar, if animation is in `'glitch'` or `'slide'` phase:

```typescript
export function drawGlitchOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  // Scanline displacement
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let y = 0; y < height; y++) {
    if (Math.random() < intensity * 0.3) {
      const shift = Math.floor((Math.random() - 0.5) * intensity * 20);
      // Shift row pixels horizontally
      const row = y * width * 4;
      const temp = new Uint8ClampedArray(width * 4);
      for (let x = 0; x < width; x++) {
        const srcX = Math.max(0, Math.min(width - 1, x + shift));
        temp.set(data.subarray(row + srcX * 4, row + srcX * 4 + 4), x * 4);
      }
      data.set(temp, row);
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Static noise flash
  if (intensity > 0.5) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(intensity - 0.5) * 0.1})`;
    for (let i = 0; i < intensity * 50; i++) {
      const nx = Math.random() * width;
      const ny = Math.random() * height;
      ctx.fillRect(nx, ny, 2, 1);
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): add CRT glitch overlay with scanline displacement and static noise"
```

---

### Task 26: Grid slide animation

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/canvas/useCanvas.ts` (or component)
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add slide offset to radar drawing**

During `'slide'` phase, apply a translate transform before drawing the grid:

```typescript
if (animation.phase === 'slide') {
  const offsetX = -animation.direction.dx * animation.progress * CELL_W * (RADAR_RADIUS * 2 + 1);
  const offsetY = animation.direction.dy * animation.progress * CELL_H * (RADAR_RADIUS * 2 + 1);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  // Draw grid normally
  // ...
  ctx.restore();
}
```

**Step 2: Trigger animation on jump**

In `client.ts`, before calling `joinSector` on jump success, start the animation:

```typescript
room.onMessage('jumpResult', async (data) => {
  useStore.getState().setJumpPending(false);
  if (data.success && data.newSector) {
    const store = useStore.getState();
    const dx = data.newSector.x - store.position.x;
    const dy = data.newSector.y - store.position.y;
    // Set animation state in store
    store.startJumpAnimation(dx, dy);
    // Wait for animation before joining new sector
    setTimeout(async () => {
      await this.joinSector(data.newSector!.x, data.newSector!.y);
    }, 800);
  }
  // ...
});
```

**Step 3: Add animation state to store**

In `uiSlice.ts`:

```typescript
jumpAnimation: JumpAnimationState | null;
startJumpAnimation: (dx: number, dy: number) => void;
clearJumpAnimation: () => void;
```

**Step 4: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts packages/client/src/network/client.ts packages/client/src/state/uiSlice.ts
git commit -m "feat(client): add grid slide animation during sector jumps"
```

---

## Phase 8: Communication & Infrastructure

### Task 27: Server — structure building

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/engine/commands.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Create: `packages/server/src/engine/__tests__/structures.test.ts`

**Step 1: Write failing test for validateBuild**

File `packages/server/src/engine/__tests__/structures.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateBuild } from '../commands.js';
import type { CargoState } from '@void-sector/shared';

describe('validateBuild', () => {
  it('succeeds with sufficient cargo and AP', () => {
    const cargo: CargoState = { ore: 10, gas: 5, crystal: 5 };
    const ap = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(true);
  });

  it('fails with insufficient ore', () => {
    const cargo: CargoState = { ore: 2, gas: 0, crystal: 5 };
    const ap = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ore');
  });

  it('fails with insufficient AP', () => {
    const cargo: CargoState = { ore: 10, gas: 5, crystal: 5 };
    const ap = { current: 2, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/structures.test.ts`
Expected: FAIL

**Step 3: Implement validateBuild**

In `commands.ts`:

```typescript
import { STRUCTURE_COSTS, STRUCTURE_AP_COSTS } from '@void-sector/shared';
import type { StructureType, CargoState, APState } from '@void-sector/shared';

export function validateBuild(
  ap: APState,
  cargo: CargoState,
  structureType: StructureType
): { valid: boolean; error?: string; newAP?: APState; costs: Record<string, number> } {
  const costs = STRUCTURE_COSTS[structureType];
  const apCost = STRUCTURE_AP_COSTS[structureType];

  // Check resources
  for (const [resource, required] of Object.entries(costs)) {
    const have = cargo[resource as keyof CargoState] ?? 0;
    if (have < required) {
      return { valid: false, error: `Insufficient ${resource}: need ${required}, have ${have}`, costs };
    }
  }

  // Check AP
  const newAP = spendAP(ap, apCost, Date.now());
  if (!newAP) {
    return { valid: false, error: `Insufficient AP: need ${apCost}`, costs };
  }

  return { valid: true, newAP, costs };
}
```

**Step 4: Run test**

Run: `cd packages/server && npx vitest run src/engine/__tests__/structures.test.ts`
Expected: PASS

**Step 5: Add structure DB queries**

In `queries.ts`:

```typescript
export async function createStructure(
  ownerId: string, type: string, sectorX: number, sectorY: number
): Promise<Structure> {
  const { rows } = await query(
    `INSERT INTO structures (owner_id, type, sector_x, sector_y)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ownerId, type, sectorX, sectorY]
  );
  return rows[0];
}

export async function getStructuresInRange(
  centerX: number, centerY: number, range: number
): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM structures
     WHERE ABS(sector_x - $1) <= $3 AND ABS(sector_y - $2) <= $3`,
    [centerX, centerY, range]
  );
  return rows;
}

export async function deductCargo(
  playerId: string, resource: string, amount: number
): Promise<void> {
  await query(
    `UPDATE cargo SET quantity = quantity - $3
     WHERE player_id = $1 AND resource = $2 AND quantity >= $3`,
    [playerId, resource, amount]
  );
}
```

**Step 6: Add build handler to SectorRoom**

In `SectorRoom.ts`, register `'build'` message and implement `handleBuild`:

```typescript
private async handleBuild(client: Client, data: BuildMessage) {
  const auth = client.auth as AuthPayload;
  const ap = await getAPState(auth.userId);
  const currentAP = calculateCurrentAP(ap, Date.now());
  const cargo = await getPlayerCargo(auth.userId);

  const result = validateBuild(currentAP, cargo, data.type);
  if (!result.valid) {
    client.send('error', { code: 'BUILD_FAIL', message: result.error! });
    return;
  }

  await saveAPState(auth.userId, result.newAP!);

  // Deduct resources
  for (const [resource, amount] of Object.entries(result.costs)) {
    if (amount > 0) {
      await deductCargo(auth.userId, resource, amount);
    }
  }

  const structure = await createStructure(
    auth.userId, data.type,
    this.state.sector.x, this.state.sector.y
  );

  client.send('buildResult', { success: true, structure });
  client.send('apUpdate', result.newAP!);
  const updatedCargo = await getPlayerCargo(auth.userId);
  client.send('cargoUpdate', updatedCargo);

  // Broadcast to room so other players see the structure
  this.broadcast('structureBuilt', {
    structure,
    sectorX: this.state.sector.x,
    sectorY: this.state.sector.y,
  });
}
```

**Step 7: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 8: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/structures.test.ts packages/server/src/db/queries.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): add structure building with resource/AP validation"
```

---

### Task 28: Server — comm range and message routing

**Files:**
- Create: `packages/server/src/engine/comms.ts`
- Create: `packages/server/src/engine/__tests__/comms.test.ts`

**Step 1: Write failing tests for distance and routing**

File `packages/server/src/engine/__tests__/comms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { canCommunicate, euclideanDistance } from '../comms.js';

describe('euclideanDistance', () => {
  it('calculates distance between two points', () => {
    expect(euclideanDistance(0, 0, 3, 4)).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(euclideanDistance(5, 5, 5, 5)).toBe(0);
  });
});

describe('canCommunicate', () => {
  it('returns true when within combined comm range', () => {
    // Player A at (0,0) range 50, Player B at (30,40) range 50 => dist 50, combined range 100
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 30, y: 40, commRange: 50 },
      [] // no relays
    )).toBe(true);
  });

  it('returns false when out of combined range and no relays', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 300, y: 400, commRange: 50 },
      []
    )).toBe(false);
  });

  it('returns true when relay chain connects players', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 1000, y: 0, commRange: 50 },
      [
        { x: 200, y: 0, range: 500 }, // relay covers 0 to 700
        { x: 700, y: 0, range: 500 }, // relay covers 200 to 1200
      ]
    )).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/comms.test.ts`
Expected: FAIL

**Step 3: Implement comm functions**

File `packages/server/src/engine/comms.ts`:

```typescript
interface CommNode {
  x: number;
  y: number;
  commRange?: number;
  range?: number;
}

export function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function canCommunicate(
  playerA: { x: number; y: number; commRange: number },
  playerB: { x: number; y: number; commRange: number },
  relays: Array<{ x: number; y: number; range: number }>
): boolean {
  // Direct communication
  const directDist = euclideanDistance(playerA.x, playerA.y, playerB.x, playerB.y);
  if (directDist <= playerA.commRange + playerB.commRange) {
    return true;
  }

  // Build graph: nodes = [playerA, ...relays, playerB]
  // BFS to find path
  const nodes: CommNode[] = [
    { x: playerA.x, y: playerA.y, range: playerA.commRange },
    ...relays,
    { x: playerB.x, y: playerB.y, range: playerB.commRange },
  ];

  const n = nodes.length;
  const visited = new Set<number>();
  const queue: number[] = [0]; // start from playerA
  visited.add(0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === n - 1) return true; // reached playerB

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      const dist = euclideanDistance(nodes[current].x, nodes[current].y, nodes[i].x, nodes[i].y);
      const reach = (nodes[current].range ?? 0) + (nodes[i].range ?? 0);
      if (dist <= reach) {
        visited.add(i);
        queue.push(i);
      }
    }
  }

  return false;
}
```

**Step 4: Run test**

Run: `cd packages/server && npx vitest run src/engine/__tests__/comms.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/engine/comms.ts packages/server/src/engine/__tests__/comms.test.ts
git commit -m "feat(server): add comm range calculation with relay chain routing"
```

---

### Task 29: Server — message persistence and delivery

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add message DB queries**

In `queries.ts`:

```typescript
export async function saveMessage(
  senderId: string, recipientId: string | null, channel: string, content: string
): Promise<{ id: string; sent_at: string }> {
  const { rows } = await query(
    `INSERT INTO messages (sender_id, recipient_id, channel, content, delivered)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, sent_at`,
    [senderId, recipientId, channel, content, recipientId === null]
  );
  return rows[0];
}

export async function getPendingMessages(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT m.*, p.username as sender_name
     FROM messages m JOIN players p ON m.sender_id = p.id
     WHERE m.recipient_id = $1 AND m.delivered = FALSE
     ORDER BY m.sent_at ASC`,
    [playerId]
  );
  return rows;
}

export async function markMessagesDelivered(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  await query(
    `UPDATE messages SET delivered = TRUE WHERE id = ANY($1)`,
    [messageIds]
  );
}

export async function getRecentMessages(channel: string, limit: number = 50): Promise<any[]> {
  const { rows } = await query(
    `SELECT m.*, p.username as sender_name
     FROM messages m JOIN players p ON m.sender_id = p.id
     WHERE m.channel = $1 AND m.delivered = TRUE
     ORDER BY m.sent_at DESC LIMIT $2`,
    [channel, limit]
  );
  return rows.reverse();
}
```

**Step 2: Add chat message handler to SectorRoom**

In `SectorRoom.ts`, register `'chat'` message:

```typescript
this.onMessage('chat', (client, data: SendChatMessage) => this.handleChat(client, data));
```

Implement:

```typescript
private async handleChat(client: Client, data: SendChatMessage) {
  const auth = client.auth as AuthPayload;

  if (!data.content || data.content.trim().length === 0) return;
  if (data.content.length > 500) {
    client.send('error', { code: 'MSG_TOO_LONG', message: 'Message too long (max 500 chars)' });
    return;
  }

  const msg = await saveMessage(auth.userId, data.recipientId ?? null, data.channel, data.content.trim());

  const chatMsg: ChatMessage = {
    id: msg.id,
    senderId: auth.userId,
    senderName: auth.username,
    channel: data.channel,
    recipientId: data.recipientId,
    content: data.content.trim(),
    sentAt: new Date(msg.sent_at).getTime(),
    delayed: false,
  };

  if (data.channel === 'local') {
    // Broadcast to all in room
    this.broadcast('chatMessage', chatMsg);
  } else if (data.channel === 'direct' && data.recipientId) {
    // Send to specific client if in room, else store as pending
    const recipientClient = this.clients.find(
      c => (c.auth as AuthPayload).userId === data.recipientId
    );
    if (recipientClient) {
      recipientClient.send('chatMessage', chatMsg);
    }
    // Also send back to sender as confirmation
    client.send('chatMessage', chatMsg);
  }
}
```

**Step 3: Deliver pending messages on join**

In `onJoin`, after the existing setup:

```typescript
// Deliver pending messages
const pending = await getPendingMessages(auth.userId);
if (pending.length > 0) {
  for (const msg of pending) {
    client.send('chatMessage', {
      id: msg.id,
      senderId: msg.sender_id,
      senderName: msg.sender_name,
      channel: msg.channel,
      recipientId: msg.recipient_id,
      content: msg.content,
      sentAt: new Date(msg.sent_at).getTime(),
      delayed: true,
    });
  }
  await markMessagesDelivered(pending.map((m: any) => m.id));
}
```

**Step 4: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): add chat message handling with pending delivery on join"
```

---

### Task 30: Client — COMMS monitor

**Files:**
- Create: `packages/client/src/components/CommsScreen.tsx`
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Add chat state to gameSlice**

```typescript
// State
chatMessages: ChatMessage[];
chatChannel: ChatChannel;
unreadComms: boolean;

// Actions
addChatMessage: (msg: ChatMessage) => void;
setChatChannel: (channel: ChatChannel) => void;
setUnreadComms: (unread: boolean) => void;
```

**Step 2: Add chat listeners to network client**

In `client.ts` `setupRoomListeners`:

```typescript
room.onMessage('chatMessage', (data: ChatMessage) => {
  useStore.getState().addChatMessage(data);
  if (useStore.getState().activeMonitor !== 'COMMS') {
    useStore.getState().setUnreadComms(true);
  }
});
```

Add `sendChat` method:

```typescript
sendChat(channel: ChatChannel, content: string, recipientId?: string) {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('chat', { channel, content, recipientId });
}
```

**Step 3: Create CommsScreen component**

File `packages/client/src/components/CommsScreen.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { ChatChannel, ChatMessage } from '@void-sector/shared';

const CHANNELS: ChatChannel[] = ['direct', 'faction', 'local'];

export function CommsScreen() {
  const messages = useStore(s => s.chatMessages);
  const channel = useStore(s => s.chatChannel);
  const setChatChannel = useStore(s => s.setChatChannel);
  const setUnreadComms = useStore(s => s.setUnreadComms);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUnreadComms(false);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [messages]);

  const filtered = messages.filter(m => m.channel === channel);

  const send = () => {
    if (!input.trim()) return;
    network.sendChat(channel, input.trim());
    setInput('');
  };

  const formatTime = (ts: number, delayed: boolean) => {
    if (delayed) {
      const ago = Math.round((Date.now() - ts) / 60000);
      return ago >= 60 ? `${Math.round(ago / 60)}h ago` : `${ago}m ago`;
    }
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 8 }}>
      {/* Channel tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {CHANNELS.map(ch => (
          <button
            key={ch}
            className="vs-btn"
            style={ch === channel ? { background: 'var(--color-primary)', color: '#000' } : {}}
            onClick={() => setChatChannel(ch)}
          >
            [{ch.toUpperCase()}]
          </button>
        ))}
      </div>

      {/* Message log */}
      <div ref={logRef} style={{
        flex: 1, overflow: 'auto', fontSize: '0.8rem',
        border: '1px solid var(--color-dim)', padding: 6,
      }}>
        {filtered.map(msg => (
          <div key={msg.id} style={{ marginBottom: 2 }}>
            <span style={{ color: 'var(--color-dim)' }}>[{formatTime(msg.sentAt, msg.delayed)}]</span>
            {' '}<span style={{ color: 'var(--color-primary)' }}>{msg.senderName}:</span>
            {' '}{msg.content}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: 'var(--color-dim)' }}>NO MESSAGES ON THIS CHANNEL</div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{
            flex: 1, background: 'transparent',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
          }}
          maxLength={500}
          placeholder="Type message..."
        />
        <button className="vs-btn" onClick={send}>[SEND]</button>
      </div>
    </div>
  );
}
```

**Step 4: Add COMMS tab to GameScreen**

In `GameScreen.tsx`, add `CommsScreen` to the monitor rendering switch and add `COMMS` button to the tab bar. Show unread indicator:

```tsx
const unreadComms = useStore(s => s.unreadComms);

// In tab bar:
<button ... onClick={() => { setActiveMonitor('COMMS'); setUnreadComms(false); }}>
  COMMS{unreadComms ? ' •' : ''}
</button>
```

**Step 5: Commit**

```bash
git add packages/client/src/components/CommsScreen.tsx packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): add COMMS monitor with channel tabs, chat input, unread indicator"
```

---

### Task 31: Client — build structure UI

**Files:**
- Modify: `packages/client/src/components/NavControls.tsx`
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add build methods to network client**

```typescript
sendBuild(type: StructureType) {
  if (!this.sectorRoom) {
    useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
    return;
  }
  this.sectorRoom.send('build', { type });
}
```

Add build result listener:

```typescript
room.onMessage('buildResult', (data: BuildResultMessage) => {
  if (data.success) {
    useStore.getState().addLogEntry(`Built ${data.structure!.type} at current sector`);
  } else {
    useStore.getState().addLogEntry(`Build failed: ${data.error}`);
  }
});
```

**Step 2: Add BUILD button to NavControls**

Add a simple dropdown or button set for building:

```tsx
<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
  <button className="vs-btn" onClick={() => network.sendBuild('comm_relay')}
    title="5 Ore, 2 Crystal, 5 AP" disabled={jumpPending}>
    [BUILD RELAY]
  </button>
  <button className="vs-btn" onClick={() => network.sendBuild('mining_station')}
    title="30 Ore, 15 Gas, 10 Crystal, 15 AP" disabled={jumpPending}>
    [BUILD STATION]
  </button>
  <button className="vs-btn" onClick={() => network.sendBuild('base')}
    title="50 Ore, 30 Gas, 25 Crystal, 25 AP" disabled={jumpPending}>
    [BUILD BASE]
  </button>
</div>
```

**Step 3: Commit**

```bash
git add packages/client/src/components/NavControls.tsx packages/client/src/network/client.ts
git commit -m "feat(client): add build structure buttons in NAV-COM"
```

---

## Phase 9: Server Tests

### Task 32: Spawn tests

**Files:**
- Already created: `packages/server/src/engine/__tests__/spawn.test.ts`

Tests already written in Task 5. Verify they still pass:

Run: `cd packages/server && npx vitest run src/engine/__tests__/spawn.test.ts`
Expected: PASS

---

### Task 33: Comms tests

**Files:**
- Already created: `packages/server/src/engine/__tests__/comms.test.ts`

Tests already written in Task 28. Add additional relay routing tests:

**Step 1: Add edge case tests**

```typescript
describe('canCommunicate edge cases', () => {
  it('handles relay chain with gap', () => {
    // Two relays too far apart to connect
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 5000, y: 0, commRange: 50 },
      [
        { x: 100, y: 0, range: 200 },
        { x: 4900, y: 0, range: 200 },
      ]
    )).toBe(false);
  });

  it('handles empty relay list', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 100 },
      { x: 50, y: 0, commRange: 100 },
      []
    )).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/comms.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/server/src/engine/__tests__/comms.test.ts
git commit -m "test(server): add edge case tests for comm relay routing"
```

---

### Task 34: Structure validation tests

**Files:**
- Already created: `packages/server/src/engine/__tests__/structures.test.ts`

Tests already written in Task 27. Add more:

**Step 1: Add additional tests**

```typescript
describe('validateBuild additional', () => {
  it('validates mining_station costs correctly', () => {
    const cargo: CargoState = { ore: 30, gas: 15, crystal: 10 };
    const ap = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    expect(validateBuild(ap, cargo, 'mining_station').valid).toBe(true);
  });

  it('validates base costs correctly', () => {
    const cargo: CargoState = { ore: 50, gas: 30, crystal: 25 };
    const ap = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    expect(validateBuild(ap, cargo, 'base').valid).toBe(true);
  });

  it('fails base with insufficient gas', () => {
    const cargo: CargoState = { ore: 50, gas: 10, crystal: 25 };
    const ap = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateBuild(ap, cargo, 'base');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('gas');
  });
});
```

**Step 2: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/structures.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/server/src/engine/__tests__/structures.test.ts
git commit -m "test(server): add additional structure validation tests"
```

---

## Phase 10: Client UI Tests

### Task 35: NavControls tests

**Files:**
- Create: `packages/client/src/__tests__/NavControls.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavControls } from '../components/NavControls';
import { mockStoreState } from '../test/mockStore';

// Mock network module
vi.mock('../network/client', () => ({
  network: {
    sendJump: vi.fn(),
    sendScan: vi.fn(),
    sendLocalScan: vi.fn(),
    sendAreaScan: vi.fn(),
    sendBuild: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('NavControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState();
  });

  it('renders directional buttons', () => {
    render(<NavControls />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/↓/)).toBeInTheDocument();
    expect(screen.getByText(/←/)).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it('calls sendJump on arrow click', async () => {
    render(<NavControls />);
    await userEvent.click(screen.getByText(/↑/));
    expect(network.sendJump).toHaveBeenCalledWith(0, 1);
  });

  it('disables buttons when jumpPending', () => {
    mockStoreState({ jumpPending: true });
    render(<NavControls />);
    const upBtn = screen.getByText(/↑/).closest('button');
    expect(upBtn).toBeDisabled();
  });

  it('shows LOCAL SCAN and AREA SCAN buttons', () => {
    render(<NavControls />);
    expect(screen.getByText(/LOCAL SCAN/)).toBeInTheDocument();
    expect(screen.getByText(/AREA SCAN/)).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run src/__tests__/NavControls.test.tsx`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/client/src/__tests__/NavControls.test.tsx
git commit -m "test(client): add NavControls unit tests"
```

---

### Task 36: MiningScreen tests

**Files:**
- Create: `packages/client/src/__tests__/MiningScreen.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiningScreen } from '../components/MiningScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('MiningScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      currentSector: {
        x: 0, y: 0, type: 'asteroid_field', seed: 42,
        discoveredBy: null, discoveredAt: null, metadata: {},
        resources: { ore: 20, gas: 2, crystal: 3 },
      },
    });
  });

  it('shows mine buttons for available resources', () => {
    render(<MiningScreen />);
    expect(screen.getByText(/MINE ORE/)).toBeInTheDocument();
  });

  it('calls sendMine on button click', async () => {
    render(<MiningScreen />);
    await userEvent.click(screen.getByText(/MINE ORE/));
    expect(network.sendMine).toHaveBeenCalledWith('ore');
  });

  it('shows STOP button when mining is active', () => {
    mockStoreState({
      mining: {
        active: true, resource: 'ore', sectorX: 0, sectorY: 0,
        startedAt: Date.now(), rate: 0.1, sectorYield: 20,
      },
    });
    render(<MiningScreen />);
    const stopBtn = screen.getByText(/STOP/).closest('button');
    expect(stopBtn).not.toBeDisabled();
  });
});
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run src/__tests__/MiningScreen.test.tsx`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/client/src/__tests__/MiningScreen.test.tsx
git commit -m "test(client): add MiningScreen unit tests"
```

---

### Task 37: CargoScreen tests

**Files:**
- Create: `packages/client/src/__tests__/CargoScreen.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CargoScreen } from '../components/CargoScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendJettison: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('CargoScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ cargo: { ore: 3, gas: 0, crystal: 1 } });
  });

  it('shows cargo quantities', () => {
    render(<CargoScreen />);
    expect(screen.getByText(/ORE/)).toBeInTheDocument();
  });

  it('disables jettison when resource is 0', () => {
    render(<CargoScreen />);
    // Gas is 0, so its jettison button should be disabled
    const gasJettison = screen.getByText(/JETTISON GAS/).closest('button');
    expect(gasJettison).toBeDisabled();
  });

  it('enables jettison when resource > 0', () => {
    render(<CargoScreen />);
    const oreJettison = screen.getByText(/JETTISON ORE/).closest('button');
    expect(oreJettison).not.toBeDisabled();
  });

  it('calls sendJettison on click', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText(/JETTISON ORE/));
    expect(network.sendJettison).toHaveBeenCalledWith('ore');
  });
});
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run src/__tests__/CargoScreen.test.tsx`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/client/src/__tests__/CargoScreen.test.tsx
git commit -m "test(client): add CargoScreen unit tests"
```

---

### Task 38: CommsScreen tests

**Files:**
- Create: `packages/client/src/__tests__/CommsScreen.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommsScreen } from '../components/CommsScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendChat: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('CommsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      chatMessages: [
        {
          id: '1', senderId: 's1', senderName: 'PhashX',
          channel: 'local' as const, content: 'Hello sector!',
          sentAt: Date.now(), delayed: false,
        },
      ],
      chatChannel: 'local' as const,
      unreadComms: false,
    });
  });

  it('renders channel tabs', () => {
    render(<CommsScreen />);
    expect(screen.getByText(/DIRECT/)).toBeInTheDocument();
    expect(screen.getByText(/LOCAL/)).toBeInTheDocument();
  });

  it('displays messages for active channel', () => {
    render(<CommsScreen />);
    expect(screen.getByText(/PhashX/)).toBeInTheDocument();
    expect(screen.getByText(/Hello sector/)).toBeInTheDocument();
  });

  it('sends message on SEND click', async () => {
    render(<CommsScreen />);
    const input = screen.getByPlaceholderText(/Type message/);
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByText(/SEND/));
    expect(network.sendChat).toHaveBeenCalledWith('local', 'Test message');
  });

  it('sends message on Enter key', async () => {
    render(<CommsScreen />);
    const input = screen.getByPlaceholderText(/Type message/);
    await userEvent.type(input, 'Test{Enter}');
    expect(network.sendChat).toHaveBeenCalled();
  });

  it('switches channel on tab click', async () => {
    render(<CommsScreen />);
    await userEvent.click(screen.getByText(/DIRECT/));
    // After switching, the "Hello sector" local message should not be visible
    expect(screen.queryByText(/Hello sector/)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run src/__tests__/CommsScreen.test.tsx`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/client/src/__tests__/CommsScreen.test.tsx
git commit -m "test(client): add CommsScreen unit tests"
```

---

### Task 39: MonitorBezel tests

**Files:**
- Create: `packages/client/src/__tests__/MonitorBezel.test.tsx`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonitorBezel } from '../components/MonitorBezel';

describe('MonitorBezel', () => {
  it('renders children inside CRT content area', () => {
    render(
      <MonitorBezel monitorId="TEST">
        <div data-testid="child">Hello</div>
      </MonitorBezel>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('displays monitor ID', () => {
    render(
      <MonitorBezel monitorId="NAV-COM">
        <div>content</div>
      </MonitorBezel>
    );
    expect(screen.getByText('NAV-COM')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run src/__tests__/MonitorBezel.test.tsx`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/client/src/__tests__/MonitorBezel.test.tsx
git commit -m "test(client): add MonitorBezel unit tests"
```

---

### Task 40: Run full test suite

**Step 1: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 2: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All pass

**Step 3: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All pass (or no tests)

**Step 4: Commit any remaining fixes**

If any tests need adjustments, fix and commit.

---

## Dependency Graph

```
Task 1 (shared types) ──┐
Task 2 (constants)    ───┤
Task 3 (DB migrations)──┤
                         ├─→ Task 5-8 (Spawn)
                         ├─→ Task 10-12 (Scan)
                         ├─→ Task 27-31 (Comms)
                         │
Task 4 (test setup)  ────┼─→ Task 35-39 (UI tests)
                         │
                     ────┼─→ Task 13-15 (AP display)
                         ├─→ Task 16-21 (Visual overhaul)
                         ├─→ Task 22-23 (Zoom/Pan)
                         └─→ Task 24-26 (Jump animation)
```

Tasks within each phase are sequential. Phases 2-8 can be executed in any order after Phase 1 completes. Phase 9-10 (tests) should be done alongside or after the features they test.

---

## Notes for the Implementer

1. **Hardcoded ship class**: The server currently hardcodes `SHIP_CLASSES.aegis_scout_mk1` everywhere. For now, continue this pattern. The `ships` DB table exists but isn't used yet — ship selection is a future feature.

2. **ScanResultMessage type fix**: Task 1 fixes the `ScanResultMessage` type mismatch (was `{ sector }`, should be `{ sectors }` array). The server already sends the array format.

3. **Canvas rendering**: `RadarRenderer.drawRadar` receives a `RadarState` object from the component. When adding zoom/pan/animation state, extend this interface rather than reading from the store directly inside the renderer.

4. **Import paths**: Server uses `.js` extensions in imports (ESM). Shared uses `.js` too. Client uses bare specifiers (Vite resolves them).

5. **Redis state**: Mining state and AP state are in Redis (via `RedisAPStore`). Chat messages and structures are in PostgreSQL. This split is intentional — ephemeral state in Redis, persistent state in Postgres.

6. **Existing scan backward compat**: Task 11 keeps the old `'scan'` message name as an alias for `'areaScan'` and sends both `'scanResult'` and `'areaScanResult'` so the client keeps working during the transition.
