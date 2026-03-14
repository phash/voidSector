# Player Station Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace old structure types with a universal `player_station` that has levels (1-5) and upgradeable FACTORY/CARGO modules.

**Architecture:** New DB table `player_stations`, new `stationQueries.ts` for DB access, new handlers in WorldService for build/upgrade, client build UI in DetailPanel. Migration converts existing structures. Old structure types removed.

**Tech Stack:** TypeScript, PostgreSQL (migration 068), Colyseus messages, Zustand store

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/constants.ts` | Modify | Add STATION_BUILD_COSTS, STATION_MODULE_UPGRADE_COST, remove old structure types |
| `packages/shared/src/types.ts` | Modify | Add PlayerStation interface, update StructureType |
| `packages/server/src/db/migrations/068_player_stations.sql` | Create | New table + migration of old structures |
| `packages/server/src/db/stationQueries.ts` | Create | All player_stations DB queries |
| `packages/server/src/rooms/services/WorldService.ts` | Modify | Add station handlers, remove old build types |
| `packages/server/src/rooms/SectorRoom.ts` | Modify | Register new message handlers |
| `packages/client/src/network/client.ts` | Modify | Add senders + result handlers |
| `packages/client/src/components/DetailPanel.tsx` | Modify | Replace old build buttons with station build |
| `packages/server/src/__tests__/playerStation.test.ts` | Create | Unit tests |

---

## Chunk 1: Shared Types & Constants

### Task 1: Add shared types and constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add PlayerStation interface to types.ts**

After the existing structure types, add:

```typescript
export interface PlayerStation {
  id: string;
  ownerId: string;
  sectorX: number;
  sectorY: number;
  quadrantX: number;
  quadrantY: number;
  level: number;
  factoryLevel: number;
  cargoLevel: number;
  cargoContents: Record<string, number>;
  createdAt: number;
}
```

- [ ] **Step 2: Add station constants to constants.ts**

After the existing STRUCTURE constants, add:

```typescript
export const MAX_STATION_LEVEL = 5;
export const MAX_STATIONS_PER_QUADRANT = 1;

export const STATION_BUILD_COSTS: Record<number, { credits: number; crystal: number; artefact: number }> = {
  1: { credits: 500, crystal: 5, artefact: 1 },
  2: { credits: 1000, crystal: 10, artefact: 2 },
  3: { credits: 2000, crystal: 20, artefact: 4 },
  4: { credits: 4000, crystal: 40, artefact: 8 },
  5: { credits: 8000, crystal: 80, artefact: 16 },
};

export const STATION_MODULE_UPGRADE_COST = (level: number): number => 200 * level * level;
```

- [ ] **Step 3: Build shared**

Run: `cd packages/shared && npm run build`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat: add PlayerStation types and STATION_BUILD_COSTS constants"
```

---

## Chunk 2: Database

### Task 2: Create migration

**Files:**
- Create: `packages/server/src/db/migrations/068_player_stations.sql`

- [ ] **Step 1: Write migration**

```sql
-- Player Stations: universal station replacing mining_station/trading_post/research_lab
CREATE TABLE IF NOT EXISTS player_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  factory_level INTEGER NOT NULL DEFAULT 0 CHECK (factory_level BETWEEN 0 AND 5),
  cargo_level INTEGER NOT NULL DEFAULT 0 CHECK (cargo_level BETWEEN 0 AND 5),
  cargo_contents JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sector_x, sector_y),
  UNIQUE(owner_id, quadrant_x, quadrant_y)
);
CREATE INDEX IF NOT EXISTS idx_player_stations_owner ON player_stations(owner_id);
CREATE INDEX IF NOT EXISTS idx_player_stations_sector ON player_stations(sector_x, sector_y);

-- Migrate existing structures to player_stations
INSERT INTO player_stations (owner_id, sector_x, sector_y, quadrant_x, quadrant_y, level)
SELECT DISTINCT ON (s.owner_id, (s.sector_x / 16), (s.sector_y / 16))
  s.owner_id,
  s.sector_x,
  s.sector_y,
  s.sector_x / 16,
  s.sector_y / 16,
  1
FROM structures s
WHERE s.type IN ('mining_station', 'trading_post', 'research_lab')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/068_player_stations.sql
git commit -m "feat: migration 068 — player_stations table with old structure migration"
```

---

### Task 3: Create stationQueries.ts

**Files:**
- Create: `packages/server/src/db/stationQueries.ts`

- [ ] **Step 1: Write query functions**

```typescript
import { query } from './client.js';

export interface PlayerStationRow {
  id: string;
  owner_id: string;
  sector_x: number;
  sector_y: number;
  quadrant_x: number;
  quadrant_y: number;
  level: number;
  factory_level: number;
  cargo_level: number;
  cargo_contents: Record<string, number>;
  created_at: string;
}

export async function getPlayerStationAt(sectorX: number, sectorY: number): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE sector_x = $1 AND sector_y = $2',
    [sectorX, sectorY],
  );
  return result.rows[0] ?? null;
}

export async function getPlayerStations(ownerId: string): Promise<PlayerStationRow[]> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE owner_id = $1 ORDER BY created_at ASC',
    [ownerId],
  );
  return result.rows;
}

export async function getPlayerStationInQuadrant(
  ownerId: string,
  qx: number,
  qy: number,
): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE owner_id = $1 AND quadrant_x = $2 AND quadrant_y = $3',
    [ownerId, qx, qy],
  );
  return result.rows[0] ?? null;
}

export async function insertPlayerStation(
  ownerId: string,
  sectorX: number,
  sectorY: number,
  quadrantX: number,
  quadrantY: number,
): Promise<PlayerStationRow> {
  const result = await query<PlayerStationRow>(
    `INSERT INTO player_stations (owner_id, sector_x, sector_y, quadrant_x, quadrant_y)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [ownerId, sectorX, sectorY, quadrantX, quadrantY],
  );
  return result.rows[0];
}

export async function upgradeStationLevel(stationId: string): Promise<PlayerStationRow> {
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations SET level = level + 1
     WHERE id = $1 AND level < 5 RETURNING *`,
    [stationId],
  );
  return result.rows[0];
}

export async function upgradeStationModule(
  stationId: string,
  module: 'factory' | 'cargo',
  stationLevel: number,
): Promise<PlayerStationRow | null> {
  const col = module === 'factory' ? 'factory_level' : 'cargo_level';
  const result = await query<PlayerStationRow>(
    `UPDATE player_stations SET ${col} = ${col} + 1
     WHERE id = $1 AND ${col} < $2 RETURNING *`,
    [stationId, stationLevel],
  );
  return result.rows[0] ?? null;
}

export async function getPlayerStationById(stationId: string): Promise<PlayerStationRow | null> {
  const result = await query<PlayerStationRow>(
    'SELECT * FROM player_stations WHERE id = $1',
    [stationId],
  );
  return result.rows[0] ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/stationQueries.ts
git commit -m "feat: stationQueries.ts — all player_stations DB operations"
```

---

## Chunk 3: Server Handlers

### Task 4: Write tests

**Files:**
- Create: `packages/server/src/__tests__/playerStation.test.ts`

- [ ] **Step 1: Write unit tests**

```typescript
import { describe, it, expect } from 'vitest';
import { STATION_BUILD_COSTS, STATION_MODULE_UPGRADE_COST, MAX_STATION_LEVEL } from '@void-sector/shared';

describe('Player Station Constants', () => {
  it('has 5 build cost levels', () => {
    expect(Object.keys(STATION_BUILD_COSTS)).toHaveLength(5);
  });

  it('build costs double each level', () => {
    expect(STATION_BUILD_COSTS[2].credits).toBe(STATION_BUILD_COSTS[1].credits * 2);
    expect(STATION_BUILD_COSTS[3].credits).toBe(STATION_BUILD_COSTS[2].credits * 2);
  });

  it('module upgrade cost scales quadratically', () => {
    expect(STATION_MODULE_UPGRADE_COST(1)).toBe(200);
    expect(STATION_MODULE_UPGRADE_COST(2)).toBe(800);
    expect(STATION_MODULE_UPGRADE_COST(3)).toBe(1800);
    expect(STATION_MODULE_UPGRADE_COST(5)).toBe(5000);
  });

  it('MAX_STATION_LEVEL is 5', () => {
    expect(MAX_STATION_LEVEL).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/server && npx vitest run src/__tests__/playerStation.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/__tests__/playerStation.test.ts
git commit -m "test: player station constants unit tests"
```

---

### Task 5: Add station handlers to WorldService

**Files:**
- Modify: `packages/server/src/rooms/services/WorldService.ts`

- [ ] **Step 1: Add imports**

Add to WorldService imports:
```typescript
import {
  getPlayerStationAt,
  getPlayerStationInQuadrant,
  getPlayerStations,
  getPlayerStationById,
  insertPlayerStation,
  upgradeStationLevel,
  upgradeStationModule,
} from '../../db/stationQueries.js';
import {
  STATION_BUILD_COSTS,
  STATION_MODULE_UPGRADE_COST,
  MAX_STATION_LEVEL,
} from '@void-sector/shared';
```

- [ ] **Step 2: Add handleBuildStation**

Add after the existing build handlers:

```typescript
async handleBuildStation(client: Client): Promise<void> {
  if (rejectGuest(client, 'Station bauen')) return;
  const auth = client.auth as AuthPayload;
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);

  // Must be empty sector
  const sector = await getSector(sx, sy);
  if (sector?.type !== 'empty') {
    client.send('buildStationResult', { success: false, error: 'Nur in leeren Sektoren möglich' });
    return;
  }

  // Check no existing station here
  const existing = await getPlayerStationAt(sx, sy);
  if (existing) {
    client.send('buildStationResult', { success: false, error: 'Hier steht bereits eine Station' });
    return;
  }

  // Check 1-per-quadrant limit
  const { qx, qy } = sectorToQuadrant(sx, sy);
  const inQuadrant = await getPlayerStationInQuadrant(auth.userId, qx, qy);
  if (inQuadrant) {
    client.send('buildStationResult', { success: false, error: 'Bereits eine Station in diesem Quadranten' });
    return;
  }

  // Check costs
  const costs = STATION_BUILD_COSTS[1];
  const credits = await getPlayerCredits(auth.userId);
  if (credits < costs.credits) {
    client.send('buildStationResult', { success: false, error: `${costs.credits} Credits benötigt` });
    return;
  }
  const cargo = await getCargoState(auth.userId);
  if ((cargo.crystal ?? 0) < costs.crystal) {
    client.send('buildStationResult', { success: false, error: `${costs.crystal} Crystal benötigt` });
    return;
  }
  if ((cargo.artefact ?? 0) < costs.artefact) {
    client.send('buildStationResult', { success: false, error: `${costs.artefact} Artefakt benötigt` });
    return;
  }

  // Deduct resources
  await deductCredits(auth.userId, costs.credits);
  await removeFromInventory(auth.userId, 'resource', 'crystal', costs.crystal);
  await removeFromInventory(auth.userId, 'resource', 'artefact', costs.artefact);

  // Create station
  const station = await insertPlayerStation(auth.userId, sx, sy, qx, qy);

  client.send('buildStationResult', { success: true, station });
  client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  client.send('cargoUpdate', await getCargoState(auth.userId));
  client.send('logEntry', `STATION ERRICHTET bei (${sx}, ${sy})`);
}
```

- [ ] **Step 3: Add handleUpgradeStation**

```typescript
async handleUpgradeStation(client: Client, data: { stationId: string }): Promise<void> {
  if (rejectGuest(client, 'Station upgraden')) return;
  const auth = client.auth as AuthPayload;

  const station = await getPlayerStationById(data.stationId);
  if (!station || station.owner_id !== auth.userId) {
    client.send('upgradeStationResult', { success: false, error: 'Station nicht gefunden' });
    return;
  }

  // Must be at station
  const sx = this.ctx._px(client.sessionId);
  const sy = this.ctx._py(client.sessionId);
  if (sx !== station.sector_x || sy !== station.sector_y) {
    client.send('upgradeStationResult', { success: false, error: 'Du musst an der Station sein' });
    return;
  }

  if (station.level >= MAX_STATION_LEVEL) {
    client.send('upgradeStationResult', { success: false, error: 'Maximales Level erreicht' });
    return;
  }

  const nextLevel = station.level + 1;
  const costs = STATION_BUILD_COSTS[nextLevel as keyof typeof STATION_BUILD_COSTS];
  if (!costs) {
    client.send('upgradeStationResult', { success: false, error: 'Ungültiges Level' });
    return;
  }

  // Check and deduct costs
  const credits = await getPlayerCredits(auth.userId);
  if (credits < costs.credits) {
    client.send('upgradeStationResult', { success: false, error: `${costs.credits} Credits benötigt` });
    return;
  }
  const cargo = await getCargoState(auth.userId);
  if ((cargo.crystal ?? 0) < costs.crystal || (cargo.artefact ?? 0) < costs.artefact) {
    client.send('upgradeStationResult', { success: false, error: 'Nicht genug Ressourcen' });
    return;
  }

  await deductCredits(auth.userId, costs.credits);
  await removeFromInventory(auth.userId, 'resource', 'crystal', costs.crystal);
  await removeFromInventory(auth.userId, 'resource', 'artefact', costs.artefact);

  const updated = await upgradeStationLevel(data.stationId);
  client.send('upgradeStationResult', { success: true, station: updated });
  client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  client.send('cargoUpdate', await getCargoState(auth.userId));
  client.send('logEntry', `STATION UPGRADE → Level ${nextLevel}`);
}
```

- [ ] **Step 4: Add handleUpgradeStationModule**

```typescript
async handleUpgradeStationModule(
  client: Client,
  data: { stationId: string; module: 'factory' | 'cargo' },
): Promise<void> {
  if (rejectGuest(client, 'Modul upgraden')) return;
  const auth = client.auth as AuthPayload;

  const station = await getPlayerStationById(data.stationId);
  if (!station || station.owner_id !== auth.userId) {
    client.send('upgradeStationModuleResult', { success: false, error: 'Station nicht gefunden' });
    return;
  }

  const currentModuleLevel = data.module === 'factory' ? station.factory_level : station.cargo_level;
  if (currentModuleLevel >= station.level) {
    client.send('upgradeStationModuleResult', {
      success: false,
      error: `Modul-Level kann Station-Level (${station.level}) nicht überschreiten`,
    });
    return;
  }

  const nextLevel = currentModuleLevel + 1;
  const cost = STATION_MODULE_UPGRADE_COST(nextLevel);
  const credits = await getPlayerCredits(auth.userId);
  if (credits < cost) {
    client.send('upgradeStationModuleResult', { success: false, error: `${cost} Credits benötigt` });
    return;
  }

  await deductCredits(auth.userId, cost);
  const updated = await upgradeStationModule(data.stationId, data.module, station.level);
  if (!updated) {
    client.send('upgradeStationModuleResult', { success: false, error: 'Upgrade fehlgeschlagen' });
    return;
  }

  client.send('upgradeStationModuleResult', { success: true, station: updated });
  client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  client.send('logEntry', `${data.module.toUpperCase()} UPGRADE → Level ${nextLevel}`);
}
```

- [ ] **Step 5: Add handleGetMyStations and handleGetStationDetails**

```typescript
async handleGetMyStations(client: Client): Promise<void> {
  const auth = client.auth as AuthPayload;
  const stations = await getPlayerStations(auth.userId);
  client.send('myStations', { stations });
}

async handleGetStationDetails(client: Client, data: { stationId: string }): Promise<void> {
  const auth = client.auth as AuthPayload;
  const station = await getPlayerStationById(data.stationId);
  if (!station || station.owner_id !== auth.userId) {
    client.send('stationDetails', { station: null });
    return;
  }
  client.send('stationDetails', { station });
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/WorldService.ts
git commit -m "feat: station handlers — build, upgrade, getMyStations, getDetails"
```

---

### Task 6: Register messages in SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

- [ ] **Step 1: Add message handlers**

After the existing 'build' handler, add:

```typescript
this.onMessage('buildStation', async (client) => {
  await this.world.handleBuildStation(client);
});
this.onMessage('upgradeStation', async (client, data) => {
  await this.world.handleUpgradeStation(client, data);
});
this.onMessage('upgradeStationModule', async (client, data) => {
  await this.world.handleUpgradeStationModule(client, data);
});
this.onMessage('getMyStations', async (client) => {
  await this.world.handleGetMyStations(client);
});
this.onMessage('getStationDetails', async (client, data) => {
  await this.world.handleGetStationDetails(client, data);
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: register station message handlers in SectorRoom"
```

---

## Chunk 4: Client Integration

### Task 7: Add client network methods

**Files:**
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add senders**

```typescript
sendBuildStation() {
  this.sectorRoom?.send('buildStation');
}

sendUpgradeStation(stationId: string) {
  this.sectorRoom?.send('upgradeStation', { stationId });
}

sendUpgradeStationModule(stationId: string, module: 'factory' | 'cargo') {
  this.sectorRoom?.send('upgradeStationModule', { stationId, module });
}

requestMyStations() {
  this.sectorRoom?.send('getMyStations');
}

requestStationDetails(stationId: string) {
  this.sectorRoom?.send('getStationDetails', { stationId });
}
```

- [ ] **Step 2: Add result handlers**

```typescript
room.onMessage('buildStationResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry('STATION ERRICHTET');
  } else {
    store.addLogEntry(`STATION FEHLER: ${data.error}`);
  }
});

room.onMessage('upgradeStationResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry('STATION UPGRADED');
  } else {
    store.addLogEntry(`UPGRADE FEHLER: ${data.error}`);
  }
});

room.onMessage('upgradeStationModuleResult', (data: any) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry('MODUL UPGRADED');
  } else {
    store.addLogEntry(`MODUL UPGRADE FEHLER: ${data.error}`);
  }
});

room.onMessage('myStations', (data: any) => {
  useStore.getState().setMyStations?.(data.stations);
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: client station network methods — build, upgrade, list"
```

---

### Task 8: Add build button to DetailPanel

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

- [ ] **Step 1: Add station build button**

Find the existing mining_station build button area and replace/add alongside it a station build button. The button should show when the player is in an empty sector with no existing station:

```tsx
{!playerGateInfo && sector?.type === 'empty' && (
  <div>
    <button
      className="vs-btn"
      style={{ fontSize: '0.7rem' }}
      onClick={() => network.sendBuildStation()}
    >
      [STATION BAUEN]
    </button>
    <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginTop: 2 }}>
      {STATION_BUILD_COSTS[1].credits} CR · {STATION_BUILD_COSTS[1].crystal} CRYSTAL · {STATION_BUILD_COSTS[1].artefact} ARTEFAKT
    </div>
  </div>
)}
```

Import `STATION_BUILD_COSTS` from `@void-sector/shared`.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat: station build button in DetailPanel for empty sectors"
```

---

### Task 9: Build, test, push

- [ ] **Step 1: Build shared**

Run: `cd packages/shared && npm run build`

- [ ] **Step 2: Run server tests**

Run: `cd packages/server && npx vitest run src/__tests__/playerStation.test.ts`
Expected: PASS

- [ ] **Step 3: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: No new failures

- [ ] **Step 4: Push**

```bash
git push -u origin feat/player-station
```
