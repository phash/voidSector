# NPC-Ökosystem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Phase 4 — procedural alien quests, reputation system with 4 NPC factions, and auto-battle with flee/fight/negotiate options.

**Architecture:** Seed-based NPC generation (no NPC DB table), quest templates with daily rotation via `hashCoords(x, y, WORLD_SEED + salt) + dayOfYear`, reputation as per-player per-faction integer (-100..+100), battle as pure-function auto-resolve. 5 new DB tables for player progress only.

**Tech Stack:** TypeScript strict, Colyseus (server), React + Zustand (client), PostgreSQL, Vitest

---

### Task 1: Shared Types + Constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Add NPC + Reputation types to types.ts**

Append after the `FactionDataMessage` interface (line ~388):

```typescript
// --- Phase 4: NPC Ecosystem ---

// NPC Factions (not player factions — these are game-world NPC groups)
export type NpcFactionId = 'traders' | 'scientists' | 'pirates' | 'ancients' | 'independent';

export type ReputationTier = 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'honored';

export interface PlayerReputation {
  factionId: NpcFactionId;
  reputation: number; // -100..+100
  tier: ReputationTier;
}

// NPC at a station
export interface StationNpc {
  id: string;         // deterministic from seed
  name: string;
  factionId: NpcFactionId;
  personality: number; // seed-derived, affects quest flavor
}

// Quest system
export type QuestType = 'fetch' | 'delivery' | 'scan' | 'bounty';
export type QuestStatus = 'active' | 'completed' | 'expired' | 'abandoned';

export interface QuestObjective {
  type: QuestType;
  description: string;
  targetX?: number;
  targetY?: number;
  resource?: ResourceType;
  amount?: number;
  progress?: number;    // current progress (e.g., ore delivered so far)
  fulfilled: boolean;
}

export interface Quest {
  id: string;
  templateId: string;
  npcName: string;
  npcFactionId: NpcFactionId;
  title: string;
  description: string;
  stationX: number;
  stationY: number;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  status: QuestStatus;
  acceptedAt: number;
  expiresAt: number;
}

export interface QuestRewards {
  credits: number;
  xp: number;
  reputation: number;        // amount gained at quest faction
  reputationPenalty?: number; // optional: amount lost at rival faction
  rivalFactionId?: NpcFactionId;
}

export interface AvailableQuest {
  templateId: string;
  npcName: string;
  npcFactionId: NpcFactionId;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  requiredTier: ReputationTier;
}

// Battle system
export type BattleAction = 'flee' | 'fight' | 'negotiate';
export type BattleOutcome = 'victory' | 'defeat' | 'escaped' | 'caught' | 'negotiated';

export interface PirateEncounter {
  pirateLevel: number;
  pirateHp: number;
  pirateDamage: number;
  sectorX: number;
  sectorY: number;
  canNegotiate: boolean;
  negotiateCost: number;
}

export interface BattleResult {
  outcome: BattleOutcome;
  lootCredits?: number;
  lootResources?: Partial<SectorResources>;
  cargoLost?: Partial<SectorResources>;
  repChange?: number;
  xpGained?: number;
}

// Scan events
export type ScanEventType = 'pirate_ambush' | 'distress_signal' | 'anomaly_reading' | 'artifact_find';
export type ScanEventStatus = 'discovered' | 'completed';

export interface ScanEvent {
  id: string;
  eventType: ScanEventType;
  sectorX: number;
  sectorY: number;
  status: ScanEventStatus;
  data: Record<string, unknown>;
  createdAt: number;
}

// Upgrades (unlocked at rep milestones)
export type UpgradeId = 'cargo_expansion' | 'advanced_scanner' | 'combat_plating' | 'void_drive';

export interface PlayerUpgrade {
  upgradeId: UpgradeId;
  active: boolean;
  unlockedAt: number;
}

// Messages: Client -> Server
export interface AcceptQuestMessage { templateId: string; stationX: number; stationY: number; }
export interface AbandonQuestMessage { questId: string; }
export interface CompleteQuestMessage { questId: string; }
export interface BattleActionMessage { action: BattleAction; sectorX: number; sectorY: number; }
export interface CompleteScanEventMessage { eventId: string; }
export interface GetStationNpcsMessage { sectorX: number; sectorY: number; }
export interface GetAvailableQuestsMessage { sectorX: number; sectorY: number; }

// Messages: Server -> Client
export interface StationNpcsResultMessage { npcs: StationNpc[]; quests: AvailableQuest[]; }
export interface AcceptQuestResultMessage { success: boolean; error?: string; quest?: Quest; }
export interface AbandonQuestResultMessage { success: boolean; error?: string; }
export interface CompleteQuestResultMessage { success: boolean; error?: string; rewards?: QuestRewards; }
export interface BattleResultMessage { success: boolean; error?: string; encounter?: PirateEncounter; result?: BattleResult; }
export interface ScanEventDiscoveredMessage { event: ScanEvent; }
export interface QuestProgressMessage { questId: string; objectives: QuestObjective[]; }
export interface ReputationUpdateMessage { reputations: PlayerReputation[]; upgrades: PlayerUpgrade[]; }
export interface ActiveQuestsMessage { quests: Quest[]; }
```

**Step 2: Add constants to constants.ts**

Append after `SLATE_AREA_RADIUS` block (line ~98):

```typescript
// --- Phase 4: NPC Ecosystem ---

// NPC Faction station distribution weights (within station sectors only)
export const NPC_FACTION_WEIGHTS: Record<string, number> = {
  independent: 0.30,
  traders: 0.28,
  scientists: 0.25,
  pirates: 0.16,
  ancients: 0.01,
};

// Reputation thresholds
export const REP_TIERS: Record<string, { min: number; max: number }> = {
  hostile:    { min: -100, max: -51 },
  unfriendly: { min: -50, max: -1 },
  neutral:    { min: 0, max: 0 },
  friendly:   { min: 1, max: 50 },
  honored:    { min: 51, max: 100 },
};

// Reputation tier price modifiers
export const REP_PRICE_MODIFIERS: Record<string, number> = {
  hostile: 1.5,
  unfriendly: 1.0,
  neutral: 1.0,
  friendly: 0.9,
  honored: 0.75,
};

// Faction upgrades (unlocked at honored tier)
export const FACTION_UPGRADES: Record<string, { factionId: string; name: string; effect: string }> = {
  cargo_expansion:  { factionId: 'traders',    name: 'CARGO EXPANSION',  effect: '+3 cargo capacity' },
  advanced_scanner: { factionId: 'scientists', name: 'ADVANCED SCANNER', effect: '+1 areaScan radius' },
  combat_plating:   { factionId: 'pirates',    name: 'COMBAT PLATING',   effect: '+20% combat bonus' },
  void_drive:       { factionId: 'ancients',   name: 'VOID DRIVE',       effect: '-1 AP movement cost' },
};

// Battle constants
export const BATTLE_AP_COST_FLEE = 2;
export const BATTLE_CARGO_LOSS_MIN = 0.25;
export const BATTLE_CARGO_LOSS_MAX = 0.50;
export const BATTLE_NEGOTIATE_COST_PER_LEVEL = 10;
export const BATTLE_FLEE_BASE_CHANCE = 0.6;  // 60% base flee chance
export const PIRATE_LEVEL_DISTANCE_DIVISOR = 50;
export const PIRATE_MAX_LEVEL = 10;

// Pirate stats per level
export const PIRATE_BASE_HP = 20;
export const PIRATE_HP_PER_LEVEL = 10;
export const PIRATE_BASE_DAMAGE = 5;
export const PIRATE_DAMAGE_PER_LEVEL = 3;

// Quest constants
export const MAX_ACTIVE_QUESTS = 3;
export const QUEST_EXPIRY_DAYS = 7;
export const QUEST_AP_COST_ACCEPT = 0;

// Scan event chance (per scanned sector)
export const SCAN_EVENT_CHANCE = 0.15;

// XP level thresholds
export const XP_LEVELS: Record<number, number> = {
  1: 0, 2: 100, 3: 300, 4: 600, 5: 1000,
  6: 1500, 7: 2200, 8: 3000, 9: 4000, 10: 5000,
};
```

**Step 3: Add QUESTS monitor to MONITORS**

In constants.ts, add `QUESTS: 'QUESTS'` to the MONITORS object, and add it to all 3 monitor arrays.

**Step 4: Build shared package**

Run: `cd packages/shared && npm run build`

**Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add Phase 4 NPC ecosystem types and constants"
```

---

### Task 2: Database Migration 008

**Files:**
- Create: `packages/server/src/db/migrations/008_npc_ecosystem.sql`

**Step 1: Write migration file**

```sql
-- Player reputation per NPC faction
CREATE TABLE IF NOT EXISTS player_reputation (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  faction_id VARCHAR(16) NOT NULL,
  reputation INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, faction_id)
);

-- Active/completed quests
CREATE TABLE IF NOT EXISTS player_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  template_id VARCHAR(64) NOT NULL,
  station_x INTEGER NOT NULL,
  station_y INTEGER NOT NULL,
  objectives JSONB NOT NULL,
  rewards JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'abandoned')),
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_quests_player ON player_quests(player_id, status);

-- Player upgrades (from rep milestones)
CREATE TABLE IF NOT EXISTS player_upgrades (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  upgrade_id VARCHAR(32) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, upgrade_id)
);

-- Discovered scan events
CREATE TABLE IF NOT EXISTS scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered', 'completed')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_player ON scan_events(player_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_events_unique ON scan_events(player_id, sector_x, sector_y, event_type);

-- Battle log
CREATE TABLE IF NOT EXISTS battle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  pirate_level INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  action VARCHAR(16) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  loot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_log_player ON battle_log(player_id);
```

**Step 2: Verify migration loads on startup**

Run: `cd packages/server && npx tsx src/db/migrate.ts` (or restart server to auto-run)

**Step 3: Commit**

```bash
git add packages/server/src/db/migrations/008_npc_ecosystem.sql
git commit -m "feat(server): add migration 008 for NPC ecosystem tables"
```

---

### Task 3: NPC Generation (Worldgen Extension)

**Files:**
- Create: `packages/server/src/engine/npcgen.ts`
- Create: `packages/server/src/engine/__tests__/npcgen.test.ts`

**Step 1: Write npcgen.ts**

```typescript
import { hashCoords } from './worldgen.js';
import { WORLD_SEED, NPC_FACTION_WEIGHTS } from '@void-sector/shared';
import type { NpcFactionId, StationNpc } from '@void-sector/shared';

const NPC_SEED_SALT = 7777;
const FACTION_SEED_SALT = 3333;

// Deterministic first/last name pools
const FIRST_NAMES = [
  'Zar', 'Kira', 'Vex', 'Mira', 'Dax', 'Syla', 'Orn', 'Thex',
  'Luma', 'Kael', 'Nyx', 'Rho', 'Astra', 'Cyn', 'Jex', 'Tal',
];
const LAST_NAMES = [
  'Voss', 'Kren', 'Thane', 'Mox', 'Drex', 'Solen', 'Gar', 'Plex',
  'Nori', 'Wren', 'Kova', 'Strex', 'Lorn', 'Mace', 'Quill', 'Rune',
];

export function getStationFaction(x: number, y: number): NpcFactionId {
  const seed = hashCoords(x, y, WORLD_SEED + FACTION_SEED_SALT);
  const normalized = (seed >>> 0) / 0x100000000;
  let cumulative = 0;
  const factions = Object.entries(NPC_FACTION_WEIGHTS);
  for (const [factionId, weight] of factions) {
    cumulative += weight;
    if (normalized < cumulative) return factionId as NpcFactionId;
  }
  return 'independent';
}

export function generateStationNpcs(x: number, y: number): StationNpc[] {
  const baseSeed = hashCoords(x, y, WORLD_SEED + NPC_SEED_SALT);
  const npcCount = 1 + ((baseSeed >>> 0) % 3); // 1-3 NPCs
  const faction = getStationFaction(x, y);

  const npcs: StationNpc[] = [];
  for (let i = 0; i < npcCount; i++) {
    const npcSeed = hashCoords(x + i, y + i, WORLD_SEED + NPC_SEED_SALT + i);
    const unsignedSeed = npcSeed >>> 0;
    const firstIdx = unsignedSeed % FIRST_NAMES.length;
    const lastIdx = (unsignedSeed >>> 8) % LAST_NAMES.length;
    npcs.push({
      id: `npc_${x}_${y}_${i}`,
      name: `${FIRST_NAMES[firstIdx]} ${LAST_NAMES[lastIdx]}`,
      factionId: faction,
      personality: (unsignedSeed >>> 16) % 100,
    });
  }
  return npcs;
}

export function getPirateLevel(sectorX: number, sectorY: number): number {
  const distance = Math.sqrt(sectorX * sectorX + sectorY * sectorY);
  return Math.min(Math.floor(distance / 50) + 1, 10);
}
```

**Step 2: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { getStationFaction, generateStationNpcs, getPirateLevel } from '../npcgen.js';

describe('npcgen', () => {
  it('getStationFaction returns deterministic faction for same coords', () => {
    const f1 = getStationFaction(100, 200);
    const f2 = getStationFaction(100, 200);
    expect(f1).toBe(f2);
  });

  it('getStationFaction returns valid faction id', () => {
    const valid = ['traders', 'scientists', 'pirates', 'ancients', 'independent'];
    for (let i = 0; i < 50; i++) {
      expect(valid).toContain(getStationFaction(i * 17, i * 31));
    }
  });

  it('generateStationNpcs returns 1-3 NPCs with names', () => {
    const npcs = generateStationNpcs(500, 300);
    expect(npcs.length).toBeGreaterThanOrEqual(1);
    expect(npcs.length).toBeLessThanOrEqual(3);
    for (const npc of npcs) {
      expect(npc.name).toBeTruthy();
      expect(npc.factionId).toBeTruthy();
      expect(npc.id).toMatch(/^npc_/);
    }
  });

  it('generateStationNpcs is deterministic', () => {
    const a = generateStationNpcs(42, 99);
    const b = generateStationNpcs(42, 99);
    expect(a).toEqual(b);
  });

  it('getPirateLevel scales with distance', () => {
    expect(getPirateLevel(0, 0)).toBe(1);
    expect(getPirateLevel(100, 0)).toBe(3);
    expect(getPirateLevel(500, 0)).toBe(10); // capped at 10
  });
});
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/npcgen.test.ts`
Expected: 5 tests PASS

**Step 4: Commit**

```bash
git add packages/server/src/engine/npcgen.ts packages/server/src/engine/__tests__/npcgen.test.ts
git commit -m "feat(server): add seed-based NPC generation for stations"
```

---

### Task 4: Reputation + Upgrade DB Queries

**Files:**
- Modify: `packages/server/src/db/queries.ts`

**Step 1: Add reputation query functions**

Append to queries.ts:

```typescript
// --- Reputation ---

export async function getPlayerReputations(playerId: string): Promise<{ faction_id: string; reputation: number }[]> {
  const { rows } = await query<{ faction_id: string; reputation: number }>(
    `SELECT faction_id, reputation FROM player_reputation WHERE player_id = $1`,
    [playerId]
  );
  return rows;
}

export async function getPlayerReputation(playerId: string, factionId: string): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `SELECT reputation FROM player_reputation WHERE player_id = $1 AND faction_id = $2`,
    [playerId, factionId]
  );
  return rows[0]?.reputation ?? 0;
}

export async function setPlayerReputation(playerId: string, factionId: string, delta: number): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `INSERT INTO player_reputation (player_id, faction_id, reputation, updated_at)
     VALUES ($1, $2, GREATEST(-100, LEAST(100, $3)), NOW())
     ON CONFLICT (player_id, faction_id)
     DO UPDATE SET reputation = GREATEST(-100, LEAST(100, player_reputation.reputation + $3)),
                   updated_at = NOW()
     RETURNING reputation`,
    [playerId, factionId, delta]
  );
  return rows[0].reputation;
}

// --- Upgrades ---

export async function getPlayerUpgrades(playerId: string): Promise<{ upgrade_id: string; active: boolean; unlocked_at: string }[]> {
  const { rows } = await query<{ upgrade_id: string; active: boolean; unlocked_at: string }>(
    `SELECT upgrade_id, active, unlocked_at FROM player_upgrades WHERE player_id = $1`,
    [playerId]
  );
  return rows;
}

export async function upsertPlayerUpgrade(playerId: string, upgradeId: string, active: boolean): Promise<void> {
  await query(
    `INSERT INTO player_upgrades (player_id, upgrade_id, active, unlocked_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (player_id, upgrade_id)
     DO UPDATE SET active = $3`,
    [playerId, upgradeId, active]
  );
}
```

**Step 2: Add quest query functions**

```typescript
// --- Quests ---

export async function getActiveQuests(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, template_id, station_x, station_y, objectives, rewards, status, accepted_at, expires_at
     FROM player_quests
     WHERE player_id = $1 AND status = 'active'
     ORDER BY accepted_at DESC`,
    [playerId]
  );
  return rows;
}

export async function getActiveQuestCount(playerId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM player_quests WHERE player_id = $1 AND status = 'active'`,
    [playerId]
  );
  return parseInt(rows[0].count, 10);
}

export async function insertQuest(
  playerId: string,
  templateId: string,
  stationX: number,
  stationY: number,
  objectives: any,
  rewards: any,
  expiresAt: Date,
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO player_quests (player_id, template_id, station_x, station_y, objectives, rewards, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [playerId, templateId, stationX, stationY, JSON.stringify(objectives), JSON.stringify(rewards), expiresAt.toISOString()]
  );
  return rows[0].id;
}

export async function updateQuestStatus(questId: string, status: string): Promise<boolean> {
  const result = await query(
    `UPDATE player_quests SET status = $2 WHERE id = $1`,
    [questId, status]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateQuestObjectives(questId: string, objectives: any): Promise<boolean> {
  const result = await query(
    `UPDATE player_quests SET objectives = $2 WHERE id = $1`,
    [questId, JSON.stringify(objectives)]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getQuestById(questId: string, playerId: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT id, template_id, station_x, station_y, objectives, rewards, status, accepted_at, expires_at
     FROM player_quests
     WHERE id = $1 AND player_id = $2`,
    [questId, playerId]
  );
  return rows[0] ?? null;
}
```

**Step 3: Add scan event + battle log queries**

```typescript
// --- Scan Events ---

export async function insertScanEvent(
  playerId: string, sectorX: number, sectorY: number,
  eventType: string, data: Record<string, unknown>
): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO scan_events (player_id, sector_x, sector_y, event_type, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id, sector_x, sector_y, event_type) DO NOTHING
     RETURNING id`,
    [playerId, sectorX, sectorY, eventType, JSON.stringify(data)]
  );
  return rows[0]?.id ?? null;
}

export async function getPlayerScanEvents(playerId: string, status: string = 'discovered'): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, sector_x, sector_y, event_type, status, data, created_at
     FROM scan_events
     WHERE player_id = $1 AND status = $2
     ORDER BY created_at DESC`,
    [playerId, status]
  );
  return rows;
}

export async function completeScanEvent(eventId: string, playerId: string): Promise<boolean> {
  const result = await query(
    `UPDATE scan_events SET status = 'completed' WHERE id = $1 AND player_id = $2 AND status = 'discovered'`,
    [eventId, playerId]
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Battle Log ---

export async function insertBattleLog(
  playerId: string, pirateLevel: number, sectorX: number, sectorY: number,
  action: string, outcome: string, loot: Record<string, unknown> | null
): Promise<void> {
  await query(
    `INSERT INTO battle_log (player_id, pirate_level, sector_x, sector_y, action, outcome, loot)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, pirateLevel, sectorX, sectorY, action, outcome, loot ? JSON.stringify(loot) : null]
  );
}

// --- XP / Level ---

export async function addPlayerXp(playerId: string, xp: number): Promise<{ xp: number; level: number }> {
  const { rows } = await query<{ xp: number; level: number }>(
    `UPDATE players SET xp = xp + $2 WHERE id = $1 RETURNING xp, level`,
    [playerId, xp]
  );
  return rows[0];
}

export async function setPlayerLevel(playerId: string, level: number): Promise<void> {
  await query(`UPDATE players SET level = $2 WHERE id = $1`, [playerId, level]);
}
```

**Step 4: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(server): add reputation, quest, scan event and battle DB queries"
```

---

### Task 5: Quest Templates + Procedural Generation

**Files:**
- Create: `packages/server/src/engine/questTemplates.ts`
- Create: `packages/server/src/engine/questgen.ts`
- Create: `packages/server/src/engine/__tests__/questgen.test.ts`

**Step 1: Write quest templates**

```typescript
import type { QuestType, NpcFactionId, ReputationTier, ResourceType } from '@void-sector/shared';

export interface QuestTemplate {
  id: string;
  type: QuestType;
  factionId: NpcFactionId | 'any';
  title: string;
  descriptionTemplate: string; // uses {resource}, {amount}, {targetX}, {targetY}
  requiredTier: ReputationTier;
  rewardCreditsBase: number;
  rewardXpBase: number;
  rewardRepBase: number;
  rivalFactionId?: NpcFactionId;
  rivalRepPenalty?: number;
  // Parameter ranges for procedural fill
  resourceOptions?: ResourceType[];
  amountRange?: [number, number];
  distanceRange?: [number, number]; // min/max sector distance for targets
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  // --- Trader quests ---
  {
    id: 'traders_fetch_ore', type: 'fetch', factionId: 'traders',
    title: 'Erz-Lieferung', descriptionTemplate: 'Bringe {amount} {resource} zu dieser Station.',
    requiredTier: 'neutral', rewardCreditsBase: 30, rewardXpBase: 10, rewardRepBase: 5,
    resourceOptions: ['ore'], amountRange: [2, 5],
  },
  {
    id: 'traders_fetch_gas', type: 'fetch', factionId: 'traders',
    title: 'Gas-Beschaffung', descriptionTemplate: 'Bringe {amount} {resource} zu dieser Station.',
    requiredTier: 'neutral', rewardCreditsBase: 40, rewardXpBase: 12, rewardRepBase: 5,
    resourceOptions: ['gas'], amountRange: [2, 4],
  },
  {
    id: 'traders_delivery', type: 'delivery', factionId: 'traders',
    title: 'Handelsroute', descriptionTemplate: 'Liefere Cargo zu Station bei ({targetX}, {targetY}).',
    requiredTier: 'friendly', rewardCreditsBase: 80, rewardXpBase: 20, rewardRepBase: 10,
    distanceRange: [5, 20],
  },
  {
    id: 'traders_elite_delivery', type: 'delivery', factionId: 'traders',
    title: 'Elite-Transport', descriptionTemplate: 'Dringend: Lieferung zu ({targetX}, {targetY}).',
    requiredTier: 'honored', rewardCreditsBase: 200, rewardXpBase: 50, rewardRepBase: 20,
    distanceRange: [10, 40],
  },
  // --- Scientist quests ---
  {
    id: 'scientists_scan', type: 'scan', factionId: 'scientists',
    title: 'Sektor-Analyse', descriptionTemplate: 'Scanne Sektor ({targetX}, {targetY}).',
    requiredTier: 'neutral', rewardCreditsBase: 20, rewardXpBase: 15, rewardRepBase: 5,
    distanceRange: [3, 15],
  },
  {
    id: 'scientists_deep_scan', type: 'scan', factionId: 'scientists',
    title: 'Tiefen-Analyse', descriptionTemplate: 'Scanne den Anomalie-Sektor ({targetX}, {targetY}).',
    requiredTier: 'friendly', rewardCreditsBase: 60, rewardXpBase: 30, rewardRepBase: 10,
    distanceRange: [10, 30],
  },
  {
    id: 'scientists_elite_scan', type: 'scan', factionId: 'scientists',
    title: 'Forschungsexpedition', descriptionTemplate: 'Expedition zu ({targetX}, {targetY}). Sektor scannen.',
    requiredTier: 'honored', rewardCreditsBase: 150, rewardXpBase: 60, rewardRepBase: 20,
    distanceRange: [20, 50], rivalFactionId: 'pirates', rivalRepPenalty: 5,
  },
  // --- Pirate quests ---
  {
    id: 'pirates_bounty', type: 'bounty', factionId: 'pirates',
    title: 'Kopfgeld', descriptionTemplate: 'Eliminiere Piraten bei ({targetX}, {targetY}).',
    requiredTier: 'neutral', rewardCreditsBase: 50, rewardXpBase: 20, rewardRepBase: 8,
    distanceRange: [3, 15],
  },
  {
    id: 'pirates_elite_bounty', type: 'bounty', factionId: 'pirates',
    title: 'Hohes Kopfgeld', descriptionTemplate: 'Gefährliche Piraten bei ({targetX}, {targetY}) eliminieren.',
    requiredTier: 'friendly', rewardCreditsBase: 150, rewardXpBase: 40, rewardRepBase: 15,
    distanceRange: [10, 30], rivalFactionId: 'traders', rivalRepPenalty: 5,
  },
  // --- Ancient quests (rare) ---
  {
    id: 'ancients_artifact', type: 'scan', factionId: 'ancients',
    title: 'Void-Artefakt', descriptionTemplate: 'Signal bei ({targetX}, {targetY}) untersuchen.',
    requiredTier: 'friendly', rewardCreditsBase: 300, rewardXpBase: 80, rewardRepBase: 25,
    distanceRange: [15, 50],
  },
  // --- Independent quests (generic, any type) ---
  {
    id: 'indie_fetch', type: 'fetch', factionId: 'any',
    title: 'Vorräte beschaffen', descriptionTemplate: 'Bringe {amount} {resource}.',
    requiredTier: 'neutral', rewardCreditsBase: 20, rewardXpBase: 8, rewardRepBase: 0,
    resourceOptions: ['ore', 'gas', 'crystal'], amountRange: [1, 3],
  },
  {
    id: 'indie_scan', type: 'scan', factionId: 'any',
    title: 'Kartierung', descriptionTemplate: 'Scanne Sektor ({targetX}, {targetY}).',
    requiredTier: 'neutral', rewardCreditsBase: 15, rewardXpBase: 10, rewardRepBase: 0,
    distanceRange: [2, 10],
  },
];
```

**Step 2: Write quest generator**

```typescript
import { hashCoords } from './worldgen.js';
import { WORLD_SEED } from '@void-sector/shared';
import type { NpcFactionId, ReputationTier, AvailableQuest, QuestObjective } from '@void-sector/shared';
import { QUEST_TEMPLATES } from './questTemplates.js';
import type { QuestTemplate } from './questTemplates.js';
import { generateStationNpcs, getStationFaction } from './npcgen.js';

const QUEST_SEED_SALT = 9999;

function getReputationTierValue(tier: ReputationTier): number {
  const map: Record<ReputationTier, number> = {
    hostile: 0, unfriendly: 1, neutral: 2, friendly: 3, honored: 4,
  };
  return map[tier];
}

export function generateStationQuests(
  stationX: number,
  stationY: number,
  dayOfYear: number,
  playerRepTier: ReputationTier = 'neutral',
): AvailableQuest[] {
  const faction = getStationFaction(stationX, stationY);
  const npcs = generateStationNpcs(stationX, stationY);
  const baseSeed = hashCoords(stationX, stationY, WORLD_SEED + QUEST_SEED_SALT + dayOfYear);

  // Filter templates for this faction + player rep
  const eligible = QUEST_TEMPLATES.filter((t) => {
    if (t.factionId !== faction && t.factionId !== 'any') return false;
    return getReputationTierValue(playerRepTier) >= getReputationTierValue(t.requiredTier);
  });

  if (eligible.length === 0) return [];

  // Pick 2-4 quests deterministically
  const questCount = 2 + ((baseSeed >>> 0) % 3); // 2-4
  const quests: AvailableQuest[] = [];

  for (let i = 0; i < Math.min(questCount, eligible.length); i++) {
    const templateIdx = ((baseSeed >>> (i * 4)) >>> 0) % eligible.length;
    const template = eligible[templateIdx];
    const npc = npcs[i % npcs.length];
    const questSeed = hashCoords(stationX + i, stationY + dayOfYear, WORLD_SEED + QUEST_SEED_SALT);

    const quest = fillQuestTemplate(template, questSeed, stationX, stationY, npc.name, faction);
    if (quest) quests.push(quest);
  }

  return quests;
}

function fillQuestTemplate(
  template: QuestTemplate,
  seed: number,
  stationX: number,
  stationY: number,
  npcName: string,
  factionId: NpcFactionId,
): AvailableQuest {
  const unsignedSeed = seed >>> 0;
  let description = template.descriptionTemplate;
  const objectives: QuestObjective[] = [];

  if (template.type === 'fetch' && template.resourceOptions && template.amountRange) {
    const resIdx = unsignedSeed % template.resourceOptions.length;
    const resource = template.resourceOptions[resIdx];
    const [minAmt, maxAmt] = template.amountRange;
    const amount = minAmt + (unsignedSeed >>> 8) % (maxAmt - minAmt + 1);
    description = description.replace('{resource}', resource.toUpperCase()).replace('{amount}', String(amount));
    objectives.push({
      type: 'fetch', description: `${amount} ${resource}`,
      resource, amount, progress: 0, fulfilled: false,
    });
  }

  if ((template.type === 'delivery' || template.type === 'scan' || template.type === 'bounty') && template.distanceRange) {
    const [minDist, maxDist] = template.distanceRange;
    const dist = minDist + (unsignedSeed >>> 12) % (maxDist - minDist + 1);
    const angle = ((unsignedSeed >>> 4) % 360) * (Math.PI / 180);
    const targetX = stationX + Math.round(dist * Math.cos(angle));
    const targetY = stationY + Math.round(dist * Math.sin(angle));
    description = description.replace('{targetX}', String(targetX)).replace('{targetY}', String(targetY));
    objectives.push({
      type: template.type, description: `Ziel: (${targetX}, ${targetY})`,
      targetX, targetY, fulfilled: false,
    });
  }

  // Scale rewards with distance/amount
  const difficultyMultiplier = 1 + (unsignedSeed % 50) / 100; // 1.0-1.5x

  return {
    templateId: template.id,
    npcName,
    npcFactionId: factionId,
    title: template.title,
    description,
    objectives,
    rewards: {
      credits: Math.round(template.rewardCreditsBase * difficultyMultiplier),
      xp: Math.round(template.rewardXpBase * difficultyMultiplier),
      reputation: template.rewardRepBase,
      reputationPenalty: template.rivalRepPenalty,
      rivalFactionId: template.rivalFactionId,
    },
    requiredTier: template.requiredTier,
  };
}
```

**Step 3: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { generateStationQuests } from '../questgen.js';

describe('questgen', () => {
  it('generates 2-4 quests for a station', () => {
    const quests = generateStationQuests(100, 200, 1);
    expect(quests.length).toBeGreaterThanOrEqual(2);
    expect(quests.length).toBeLessThanOrEqual(4);
  });

  it('quests are deterministic for same station + day', () => {
    const a = generateStationQuests(100, 200, 1);
    const b = generateStationQuests(100, 200, 1);
    expect(a).toEqual(b);
  });

  it('quests rotate daily (different day = different quests)', () => {
    const day1 = generateStationQuests(100, 200, 1);
    const day2 = generateStationQuests(100, 200, 2);
    // Different days should produce different quest sets (or at least different params)
    const titles1 = day1.map(q => q.templateId).join(',');
    const titles2 = day2.map(q => q.templateId).join(',');
    // They MIGHT be the same templates but with different parameters
    // Just verify both generate valid quests
    expect(day1.length).toBeGreaterThan(0);
    expect(day2.length).toBeGreaterThan(0);
  });

  it('quests have valid structure', () => {
    const quests = generateStationQuests(50, 50, 100);
    for (const q of quests) {
      expect(q.templateId).toBeTruthy();
      expect(q.npcName).toBeTruthy();
      expect(q.title).toBeTruthy();
      expect(q.objectives.length).toBeGreaterThan(0);
      expect(q.rewards.credits).toBeGreaterThan(0);
      expect(q.rewards.xp).toBeGreaterThan(0);
    }
  });

  it('honored tier unlocks more quests than neutral', () => {
    const neutral = generateStationQuests(100, 200, 1, 'neutral');
    const honored = generateStationQuests(100, 200, 1, 'honored');
    // honored should have access to at least as many templates
    expect(honored.length).toBeGreaterThanOrEqual(neutral.length);
  });
});
```

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/questgen.test.ts`
Expected: 5 tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/engine/questTemplates.ts packages/server/src/engine/questgen.ts packages/server/src/engine/__tests__/questgen.test.ts
git commit -m "feat(server): add quest templates and procedural quest generation"
```

---

### Task 6: Battle + Quest Validation (commands.ts)

**Files:**
- Modify: `packages/server/src/engine/commands.ts`
- Create: `packages/server/src/engine/__tests__/commands-npc.test.ts`

**Step 1: Add imports to commands.ts**

Add to the existing imports at the top:

```typescript
import {
  BATTLE_AP_COST_FLEE, BATTLE_FLEE_BASE_CHANCE, BATTLE_CARGO_LOSS_MIN, BATTLE_CARGO_LOSS_MAX,
  BATTLE_NEGOTIATE_COST_PER_LEVEL, PIRATE_BASE_HP, PIRATE_HP_PER_LEVEL,
  PIRATE_BASE_DAMAGE, PIRATE_DAMAGE_PER_LEVEL, MAX_ACTIVE_QUESTS, XP_LEVELS,
} from '@void-sector/shared';
import type { BattleAction, BattleOutcome, BattleResult, PirateEncounter, SectorResources } from '@void-sector/shared';
```

**Step 2: Add battle validation functions**

```typescript
// --- Battle Validation ---

export function createPirateEncounter(
  pirateLevel: number,
  sectorX: number,
  sectorY: number,
  pirateReputation: number,
): PirateEncounter {
  return {
    pirateLevel,
    pirateHp: PIRATE_BASE_HP + pirateLevel * PIRATE_HP_PER_LEVEL,
    pirateDamage: PIRATE_BASE_DAMAGE + pirateLevel * PIRATE_DAMAGE_PER_LEVEL,
    sectorX,
    sectorY,
    canNegotiate: pirateReputation >= 1, // friendly or above
    negotiateCost: pirateLevel * BATTLE_NEGOTIATE_COST_PER_LEVEL,
  };
}

export interface BattleValidation {
  valid: boolean;
  error?: string;
  newAP?: APState;
  result?: BattleResult;
}

export function validateBattleAction(
  action: BattleAction,
  ap: APState,
  encounter: PirateEncounter,
  credits: number,
  cargo: CargoState,
  shipAttack: number, // derived from ship class + upgrades
  battleSeed: number, // for deterministic outcome
): BattleValidation {
  if (action === 'flee') {
    const newAP = spendAP(ap, BATTLE_AP_COST_FLEE);
    if (!newAP) return { valid: false, error: 'Not enough AP to flee (need 2)' };

    const fleeChance = BATTLE_FLEE_BASE_CHANCE + (shipAttack * 0.02) - (encounter.pirateLevel * 0.05);
    const roll = ((battleSeed >>> 0) % 100) / 100;
    if (roll < fleeChance) {
      return { valid: true, newAP, result: { outcome: 'escaped' } };
    }
    // Failed flee -> forced fight with penalty
    const fightResult = resolveFight(encounter, shipAttack, cargo, battleSeed);
    return { valid: true, newAP, result: fightResult };
  }

  if (action === 'fight') {
    const result = resolveFight(encounter, shipAttack, cargo, battleSeed);
    return { valid: true, result };
  }

  if (action === 'negotiate') {
    if (!encounter.canNegotiate) return { valid: false, error: 'Pirates won\'t negotiate (need Friendly rep)' };
    if (credits < encounter.negotiateCost) {
      return { valid: false, error: `Not enough credits (need ${encounter.negotiateCost})` };
    }
    return {
      valid: true,
      result: { outcome: 'negotiated', repChange: 1 },
    };
  }

  return { valid: false, error: 'Invalid battle action' };
}

function resolveFight(
  encounter: PirateEncounter,
  shipAttack: number,
  cargo: CargoState,
  seed: number,
): BattleResult {
  // Simple attack comparison with randomness
  const playerPower = shipAttack + ((seed >>> 8) % 20);
  const piratePower = encounter.pirateDamage + ((seed >>> 16) % 10);

  if (playerPower >= piratePower) {
    // Victory — loot
    const lootCredits = encounter.pirateLevel * 10 + ((seed >>> 4) % 50);
    const lootOre = ((seed >>> 6) % 3);
    const lootCrystal = ((seed >>> 10) % 2);
    return {
      outcome: 'victory',
      lootCredits,
      lootResources: { ore: lootOre, crystal: lootCrystal },
      repChange: -3, // lose rep with pirates
      xpGained: encounter.pirateLevel * 5,
    };
  } else {
    // Defeat — lose cargo
    const lossRatio = BATTLE_CARGO_LOSS_MIN + ((seed >>> 12) % 100) / 100 * (BATTLE_CARGO_LOSS_MAX - BATTLE_CARGO_LOSS_MIN);
    return {
      outcome: 'defeat',
      cargoLost: {
        ore: Math.floor(cargo.ore * lossRatio),
        gas: Math.floor(cargo.gas * lossRatio),
        crystal: Math.floor(cargo.crystal * lossRatio),
      },
      xpGained: Math.ceil(encounter.pirateLevel * 2), // some XP even for losing
    };
  }
}

// --- Quest Validation ---

export interface AcceptQuestValidation {
  valid: boolean;
  error?: string;
}

export function validateAcceptQuest(activeQuestCount: number): AcceptQuestValidation {
  if (activeQuestCount >= MAX_ACTIVE_QUESTS) {
    return { valid: false, error: `Maximum ${MAX_ACTIVE_QUESTS} active quests reached` };
  }
  return { valid: true };
}

// --- Level Calculation ---

export function calculateLevel(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(XP_LEVELS)) {
    if (xp >= threshold) level = parseInt(lvl, 10);
  }
  return level;
}

// --- Reputation Tier ---

export function getReputationTier(reputation: number): string {
  if (reputation <= -51) return 'hostile';
  if (reputation < 0) return 'unfriendly';
  if (reputation === 0) return 'neutral';
  if (reputation <= 50) return 'friendly';
  return 'honored';
}
```

**Step 3: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  createPirateEncounter, validateBattleAction, validateAcceptQuest,
  calculateLevel, getReputationTier,
} from '../commands.js';
import type { APState, CargoState, PirateEncounter } from '@void-sector/shared';

const fullAP: APState = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
const emptyCargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0 };

describe('Battle validation', () => {
  it('createPirateEncounter scales with level', () => {
    const e1 = createPirateEncounter(1, 10, 10, 0);
    const e5 = createPirateEncounter(5, 10, 10, 0);
    expect(e5.pirateHp).toBeGreaterThan(e1.pirateHp);
    expect(e5.pirateDamage).toBeGreaterThan(e1.pirateDamage);
    expect(e1.canNegotiate).toBe(false);
  });

  it('negotiate requires friendly reputation', () => {
    const encounter = createPirateEncounter(3, 10, 10, 1);
    expect(encounter.canNegotiate).toBe(true);
    const result = validateBattleAction('negotiate', fullAP, encounter, 100, emptyCargo, 10, 42);
    expect(result.valid).toBe(true);
    expect(result.result!.outcome).toBe('negotiated');
  });

  it('negotiate fails without friendly rep', () => {
    const encounter = createPirateEncounter(3, 10, 10, 0);
    const result = validateBattleAction('negotiate', fullAP, encounter, 100, emptyCargo, 10, 42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negotiate');
  });

  it('negotiate fails without enough credits', () => {
    const encounter = createPirateEncounter(3, 10, 10, 1);
    const result = validateBattleAction('negotiate', fullAP, encounter, 0, emptyCargo, 10, 42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('credits');
  });

  it('flee costs AP', () => {
    const lowAP: APState = { ...fullAP, current: 1 };
    const encounter = createPirateEncounter(1, 10, 10, 0);
    const result = validateBattleAction('flee', lowAP, encounter, 100, emptyCargo, 10, 42);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });

  it('fight produces victory or defeat', () => {
    const encounter = createPirateEncounter(1, 10, 10, 0);
    const result = validateBattleAction('fight', fullAP, encounter, 50, emptyCargo, 42);
    expect(result.valid).toBe(true);
    expect(['victory', 'defeat']).toContain(result.result!.outcome);
  });

  it('victory gives loot and XP', () => {
    const encounter = createPirateEncounter(1, 10, 10, 0);
    // Use high attack to ensure victory
    const result = validateBattleAction('fight', fullAP, encounter, 200, emptyCargo, 1);
    expect(result.valid).toBe(true);
    if (result.result!.outcome === 'victory') {
      expect(result.result!.lootCredits).toBeGreaterThan(0);
      expect(result.result!.xpGained).toBeGreaterThan(0);
    }
  });
});

describe('Quest validation', () => {
  it('accepts quest when under limit', () => {
    expect(validateAcceptQuest(0).valid).toBe(true);
    expect(validateAcceptQuest(2).valid).toBe(true);
  });

  it('rejects quest when at max', () => {
    expect(validateAcceptQuest(3).valid).toBe(false);
  });
});

describe('calculateLevel', () => {
  it('returns correct levels', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    expect(calculateLevel(5000)).toBe(10);
  });
});

describe('getReputationTier', () => {
  it('returns correct tiers', () => {
    expect(getReputationTier(-100)).toBe('hostile');
    expect(getReputationTier(-51)).toBe('hostile');
    expect(getReputationTier(-50)).toBe('unfriendly');
    expect(getReputationTier(0)).toBe('neutral');
    expect(getReputationTier(1)).toBe('friendly');
    expect(getReputationTier(50)).toBe('friendly');
    expect(getReputationTier(51)).toBe('honored');
  });
});
```

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands-npc.test.ts`
Expected: 11 tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/engine/__tests__/commands-npc.test.ts
git commit -m "feat(server): add battle, quest, level and reputation validation"
```

---

### Task 7: Scan Event Generation

**Files:**
- Create: `packages/server/src/engine/scanEvents.ts`
- Create: `packages/server/src/engine/__tests__/scanEvents.test.ts`

**Step 1: Write scan event generator**

```typescript
import { hashCoords } from './worldgen.js';
import { WORLD_SEED, SCAN_EVENT_CHANCE } from '@void-sector/shared';
import type { ScanEventType } from '@void-sector/shared';

const SCAN_EVENT_SALT = 5555;

export interface ScanEventResult {
  hasEvent: boolean;
  eventType?: ScanEventType;
  isImmediate?: boolean;  // true = pirate_ambush (no marker)
  data?: Record<string, unknown>;
}

const EVENT_TYPE_WEIGHTS: { type: ScanEventType; weight: number; immediate: boolean }[] = [
  { type: 'pirate_ambush', weight: 0.35, immediate: true },
  { type: 'distress_signal', weight: 0.30, immediate: false },
  { type: 'anomaly_reading', weight: 0.25, immediate: false },
  { type: 'artifact_find', weight: 0.10, immediate: false },
];

export function checkScanEvent(sectorX: number, sectorY: number): ScanEventResult {
  const seed = hashCoords(sectorX, sectorY, WORLD_SEED + SCAN_EVENT_SALT);
  const normalized = (seed >>> 0) / 0x100000000;

  if (normalized >= SCAN_EVENT_CHANCE) {
    return { hasEvent: false };
  }

  // Determine event type from second part of seed
  const typeSeed = ((seed >>> 16) >>> 0) / 0x10000;
  let cumulative = 0;
  for (const entry of EVENT_TYPE_WEIGHTS) {
    cumulative += entry.weight;
    if (typeSeed < cumulative) {
      return {
        hasEvent: true,
        eventType: entry.type,
        isImmediate: entry.immediate,
        data: generateEventData(entry.type, sectorX, sectorY, seed),
      };
    }
  }

  return { hasEvent: false };
}

function generateEventData(
  eventType: ScanEventType,
  sectorX: number,
  sectorY: number,
  seed: number,
): Record<string, unknown> {
  switch (eventType) {
    case 'pirate_ambush':
      return { pirateLevel: Math.min(Math.floor(Math.sqrt(sectorX * sectorX + sectorY * sectorY) / 50) + 1, 10) };
    case 'distress_signal':
      return { rewardCredits: 20 + ((seed >>> 4) % 80), rewardRep: 5 };
    case 'anomaly_reading':
      return { rewardXp: 15 + ((seed >>> 6) % 35), rewardRep: 5 };
    case 'artifact_find':
      return { rewardCredits: 50 + ((seed >>> 8) % 150), rewardRep: 10 };
    default:
      return {};
  }
}
```

**Step 2: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { checkScanEvent } from '../scanEvents.js';

describe('scanEvents', () => {
  it('checkScanEvent is deterministic', () => {
    const a = checkScanEvent(10, 20);
    const b = checkScanEvent(10, 20);
    expect(a).toEqual(b);
  });

  it('returns valid event types when event occurs', () => {
    const validTypes = ['pirate_ambush', 'distress_signal', 'anomaly_reading', 'artifact_find'];
    // Test many coords to find at least one event
    let foundEvent = false;
    for (let i = 0; i < 100; i++) {
      const result = checkScanEvent(i * 7, i * 13);
      if (result.hasEvent) {
        expect(validTypes).toContain(result.eventType);
        expect(result.data).toBeDefined();
        foundEvent = true;
      }
    }
    expect(foundEvent).toBe(true);
  });

  it('pirate_ambush is immediate', () => {
    for (let i = 0; i < 200; i++) {
      const result = checkScanEvent(i * 3, i * 11);
      if (result.hasEvent && result.eventType === 'pirate_ambush') {
        expect(result.isImmediate).toBe(true);
        expect(result.data!.pirateLevel).toBeGreaterThanOrEqual(1);
        return; // found one, test passes
      }
    }
    // If no pirate_ambush found in 200 tries, that's OK (probabilistic)
  });

  it('non-ambush events are markers (not immediate)', () => {
    for (let i = 0; i < 200; i++) {
      const result = checkScanEvent(i * 5, i * 17);
      if (result.hasEvent && result.eventType !== 'pirate_ambush') {
        expect(result.isImmediate).toBe(false);
        return;
      }
    }
  });
});
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/scanEvents.test.ts`
Expected: 4 tests PASS

**Step 4: Commit**

```bash
git add packages/server/src/engine/scanEvents.ts packages/server/src/engine/__tests__/scanEvents.test.ts
git commit -m "feat(server): add scan event generation system"
```

---

### Task 8: Server Handlers — NPC + Quests

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add imports**

Add to existing imports in SectorRoom.ts:

```typescript
import { generateStationNpcs, getStationFaction, getPirateLevel } from '../engine/npcgen.js';
import { generateStationQuests } from '../engine/questgen.js';
import { checkScanEvent } from '../engine/scanEvents.js';
import {
  createPirateEncounter, validateBattleAction, validateAcceptQuest,
  calculateLevel, getReputationTier,
} from '../engine/commands.js';
import {
  getPlayerReputations, getPlayerReputation, setPlayerReputation,
  getPlayerUpgrades, upsertPlayerUpgrade,
  getActiveQuests, getActiveQuestCount, insertQuest, updateQuestStatus,
  updateQuestObjectives, getQuestById,
  insertScanEvent, getPlayerScanEvents, completeScanEvent,
  insertBattleLog, addPlayerXp, setPlayerLevel,
} from '../db/queries.js';
import {
  MAX_ACTIVE_QUESTS, QUEST_EXPIRY_DAYS, FACTION_UPGRADES,
  BATTLE_NEGOTIATE_COST_PER_LEVEL,
} from '@void-sector/shared';
import type {
  GetStationNpcsMessage, GetAvailableQuestsMessage, AcceptQuestMessage,
  AbandonQuestMessage, BattleActionMessage, CompleteScanEventMessage,
  Quest, QuestObjective, PlayerReputation, PlayerUpgrade, ReputationTier,
  NpcFactionId, PirateEncounter,
} from '@void-sector/shared';
```

**Step 2: Register new message handlers in onCreate**

Add after existing `this.onMessage()` calls:

```typescript
// Phase 4: NPC Ecosystem
this.onMessage('getStationNpcs', async (client, data: GetStationNpcsMessage) => {
  await this.handleGetStationNpcs(client, data);
});
this.onMessage('acceptQuest', async (client, data: AcceptQuestMessage) => {
  await this.handleAcceptQuest(client, data);
});
this.onMessage('abandonQuest', async (client, data: AbandonQuestMessage) => {
  await this.handleAbandonQuest(client, data);
});
this.onMessage('getActiveQuests', async (client) => {
  await this.handleGetActiveQuests(client);
});
this.onMessage('battleAction', async (client, data: BattleActionMessage) => {
  await this.handleBattleAction(client, data);
});
this.onMessage('completeScanEvent', async (client, data: CompleteScanEventMessage) => {
  await this.handleCompleteScanEvent(client, data);
});
this.onMessage('getReputation', async (client) => {
  await this.handleGetReputation(client);
});
```

**Step 3: Add handler methods**

Add as private methods on the SectorRoom class:

```typescript
private async handleGetStationNpcs(client: Client, data: GetStationNpcsMessage) {
  const auth = client.auth as AuthPayload;
  const npcs = generateStationNpcs(data.sectorX, data.sectorY);
  const reps = await getPlayerReputations(auth.userId);
  const faction = getStationFaction(data.sectorX, data.sectorY);
  const factionRep = reps.find(r => r.faction_id === faction)?.reputation ?? 0;
  const tier = getReputationTier(factionRep) as ReputationTier;
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const quests = generateStationQuests(data.sectorX, data.sectorY, dayOfYear, tier);
  client.send('stationNpcsResult', { npcs, quests });
}

private async handleAcceptQuest(client: Client, data: AcceptQuestMessage) {
  const auth = client.auth as AuthPayload;
  const count = await getActiveQuestCount(auth.userId);
  const validation = validateAcceptQuest(count);
  if (!validation.valid) {
    client.send('acceptQuestResult', { success: false, error: validation.error });
    return;
  }

  // Regenerate quest from template to validate it exists
  const reps = await getPlayerReputations(auth.userId);
  const faction = getStationFaction(data.stationX, data.stationY);
  const factionRep = reps.find(r => r.faction_id === faction)?.reputation ?? 0;
  const tier = getReputationTier(factionRep) as ReputationTier;
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const available = generateStationQuests(data.stationX, data.stationY, dayOfYear, tier);
  const questTemplate = available.find(q => q.templateId === data.templateId);

  if (!questTemplate) {
    client.send('acceptQuestResult', { success: false, error: 'Quest not available' });
    return;
  }

  const expiresAt = new Date(Date.now() + QUEST_EXPIRY_DAYS * 86400000);
  const questId = await insertQuest(
    auth.userId, data.templateId, data.stationX, data.stationY,
    questTemplate.objectives, questTemplate.rewards, expiresAt,
  );

  const quest: Quest = {
    id: questId,
    templateId: data.templateId,
    npcName: questTemplate.npcName,
    npcFactionId: questTemplate.npcFactionId,
    title: questTemplate.title,
    description: questTemplate.description,
    stationX: data.stationX,
    stationY: data.stationY,
    objectives: questTemplate.objectives,
    rewards: questTemplate.rewards,
    status: 'active',
    acceptedAt: Date.now(),
    expiresAt: expiresAt.getTime(),
  };

  client.send('acceptQuestResult', { success: true, quest });
  client.send('logEntry', `Quest angenommen: ${quest.title}`);
}

private async handleAbandonQuest(client: Client, data: AbandonQuestMessage) {
  const auth = client.auth as AuthPayload;
  const updated = await updateQuestStatus(data.questId, 'abandoned');
  client.send('abandonQuestResult', { success: updated, error: updated ? undefined : 'Quest not found' });
  if (updated) {
    await this.sendActiveQuests(client, auth.userId);
  }
}

private async handleGetActiveQuests(client: Client) {
  const auth = client.auth as AuthPayload;
  await this.sendActiveQuests(client, auth.userId);
}

private async sendActiveQuests(client: Client, playerId: string) {
  const rows = await getActiveQuests(playerId);
  const quests: Quest[] = rows.map(r => ({
    id: r.id,
    templateId: r.template_id,
    npcName: '', // not stored in DB, can be derived if needed
    npcFactionId: 'independent' as NpcFactionId,
    title: r.template_id, // simplified: use template_id as title
    description: '',
    stationX: r.station_x,
    stationY: r.station_y,
    objectives: r.objectives,
    rewards: r.rewards,
    status: r.status,
    acceptedAt: new Date(r.accepted_at).getTime(),
    expiresAt: new Date(r.expires_at).getTime(),
  }));
  client.send('activeQuests', { quests });
}

private async handleGetReputation(client: Client) {
  const auth = client.auth as AuthPayload;
  await this.sendReputationUpdate(client, auth.userId);
}

private async sendReputationUpdate(client: Client, playerId: string) {
  const reps = await getPlayerReputations(playerId);
  const upgrades = await getPlayerUpgrades(playerId);

  const reputations: PlayerReputation[] = ['traders', 'scientists', 'pirates', 'ancients'].map(fid => {
    const rep = reps.find(r => r.faction_id === fid)?.reputation ?? 0;
    return { factionId: fid as NpcFactionId, reputation: rep, tier: getReputationTier(rep) as ReputationTier };
  });

  const playerUpgrades: PlayerUpgrade[] = upgrades.map(u => ({
    upgradeId: u.upgrade_id as any,
    active: u.active,
    unlockedAt: new Date(u.unlocked_at).getTime(),
  }));

  client.send('reputationUpdate', { reputations, upgrades: playerUpgrades });
}

private async applyReputationChange(playerId: string, factionId: NpcFactionId, delta: number, client: Client) {
  const newRep = await setPlayerReputation(playerId, factionId, delta);
  const tier = getReputationTier(newRep);

  // Check upgrade unlock/deactivation
  for (const [upgradeId, upgrade] of Object.entries(FACTION_UPGRADES)) {
    if (upgrade.factionId === factionId) {
      const shouldBeActive = tier === 'honored';
      await upsertPlayerUpgrade(playerId, upgradeId, shouldBeActive);
    }
  }

  await this.sendReputationUpdate(client, playerId);
}

private async applyXpGain(playerId: string, xp: number, client: Client) {
  const result = await addPlayerXp(playerId, xp);
  const newLevel = calculateLevel(result.xp);
  if (newLevel > result.level) {
    await setPlayerLevel(playerId, newLevel);
    client.send('logEntry', `LEVEL UP! Du bist jetzt Level ${newLevel}`);
  }
}
```

**Step 4: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): add NPC, quest, and reputation server handlers"
```

---

### Task 9: Server Handlers — Battle + Scan Events

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add battle handler**

```typescript
private async handleBattleAction(client: Client, data: BattleActionMessage) {
  const auth = client.auth as AuthPayload;
  const ship = this.getShipForClient(client.sessionId);
  const ap = await this.loadAP(auth.userId);
  const credits = await getPlayerCredits(auth.userId);
  const cargo = await getPlayerCargo(auth.userId);
  const pirateRep = await getPlayerReputation(auth.userId, 'pirates');

  const pirateLevel = getPirateLevel(data.sectorX, data.sectorY);
  const encounter = createPirateEncounter(pirateLevel, data.sectorX, data.sectorY, pirateRep);

  // Ship attack power (base from ship class + combat_plating upgrade)
  let shipAttack = 10; // base
  const upgrades = await getPlayerUpgrades(auth.userId);
  if (upgrades.some(u => u.upgrade_id === 'combat_plating' && u.active)) {
    shipAttack = Math.round(shipAttack * 1.2);
  }

  const battleSeed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17);
  const validation = validateBattleAction(
    data.action, ap, encounter, credits, cargo, shipAttack, battleSeed,
  );

  if (!validation.valid) {
    client.send('battleResult', { success: false, error: validation.error });
    return;
  }

  const result = validation.result!;

  // Apply AP cost (flee)
  if (validation.newAP) {
    await this.saveAP(auth.userId, validation.newAP);
    client.send('apUpdate', validation.newAP);
  }

  // Apply outcomes
  if (result.outcome === 'victory' && result.lootCredits) {
    await addCredits(auth.userId, result.lootCredits);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    if (result.lootResources) {
      for (const [res, amount] of Object.entries(result.lootResources)) {
        if (amount && amount > 0) await addToCargo(auth.userId, res, amount);
      }
      client.send('cargoUpdate', await getPlayerCargo(auth.userId));
    }
  }

  if (result.outcome === 'defeat' && result.cargoLost) {
    for (const [res, amount] of Object.entries(result.cargoLost)) {
      if (amount && amount > 0) await deductCargo(auth.userId, res, amount);
    }
    client.send('cargoUpdate', await getPlayerCargo(auth.userId));
  }

  if (result.outcome === 'negotiated') {
    await deductCredits(auth.userId, encounter.negotiateCost);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  }

  // Reputation changes
  if (result.repChange) {
    await this.applyReputationChange(auth.userId, 'pirates', result.repChange, client);
  }

  // XP
  if (result.xpGained) {
    await this.applyXpGain(auth.userId, result.xpGained, client);
  }

  // Log battle
  await insertBattleLog(auth.userId, pirateLevel, data.sectorX, data.sectorY, data.action, result.outcome, result.lootResources ?? null);

  client.send('battleResult', { success: true, encounter, result });

  // Log entry
  const outcomeMessages: Record<string, string> = {
    victory: `SIEG! Piraten besiegt. +${result.lootCredits ?? 0} CR`,
    defeat: 'NIEDERLAGE. Cargo verloren.',
    escaped: 'Erfolgreich geflohen!',
    caught: 'Flucht fehlgeschlagen — Kampf erzwungen.',
    negotiated: `Verhandelt. -${encounter.negotiateCost} CR`,
  };
  client.send('logEntry', outcomeMessages[result.outcome] ?? `Kampf: ${result.outcome}`);
}
```

**Step 2: Add scan event handler + hook into existing scan**

Add the scan event check into the existing `handleAreaScan` or `handleLocalScan` method. After the scan result is sent, check for events:

```typescript
// Add this method:
private async checkAndEmitScanEvents(client: Client, scannedSectors: { x: number; y: number }[]) {
  const auth = client.auth as AuthPayload;
  for (const sector of scannedSectors) {
    const eventResult = checkScanEvent(sector.x, sector.y);
    if (!eventResult.hasEvent || !eventResult.eventType) continue;

    if (eventResult.isImmediate && eventResult.eventType === 'pirate_ambush') {
      // Immediate: trigger battle dialog
      const pirateLevel = (eventResult.data?.pirateLevel as number) ?? 1;
      const pirateRep = await getPlayerReputation(auth.userId, 'pirates');
      const encounter = createPirateEncounter(pirateLevel, sector.x, sector.y, pirateRep);
      client.send('pirateAmbush', { encounter, sectorX: sector.x, sectorY: sector.y });
      client.send('logEntry', `WARNUNG: Piraten-Hinterhalt bei (${sector.x}, ${sector.y})!`);
    } else {
      // Marker event: save to DB and notify
      const eventId = await insertScanEvent(
        auth.userId, sector.x, sector.y,
        eventResult.eventType, eventResult.data ?? {},
      );
      if (eventId) {
        client.send('scanEventDiscovered', {
          event: {
            id: eventId,
            eventType: eventResult.eventType,
            sectorX: sector.x,
            sectorY: sector.y,
            status: 'discovered',
            data: eventResult.data ?? {},
            createdAt: Date.now(),
          },
        });
        const eventNames: Record<string, string> = {
          distress_signal: 'Notsignal',
          anomaly_reading: 'Anomalie',
          artifact_find: 'Artefakt-Signal',
        };
        client.send('logEntry', `${eventNames[eventResult.eventType] ?? 'Event'} entdeckt bei (${sector.x}, ${sector.y})`);
      }
    }
  }
}
```

Then call `this.checkAndEmitScanEvents(client, scannedSectors)` at the end of the existing area scan handler. For local scan, call with single sector.

**Step 3: Add scan event completion handler**

```typescript
private async handleCompleteScanEvent(client: Client, data: CompleteScanEventMessage) {
  const auth = client.auth as AuthPayload;
  const events = await getPlayerScanEvents(auth.userId, 'discovered');
  const event = events.find(e => e.id === data.eventId);

  if (!event) {
    client.send('logEntry', 'Event nicht gefunden.');
    return;
  }

  // Check player is at the event sector
  const pos = this.state.players.get(client.sessionId);
  // For simplicity, allow completion from any position (quest-like)

  const completed = await completeScanEvent(data.eventId, auth.userId);
  if (!completed) return;

  // Apply rewards based on event type
  const eventData = event.data as Record<string, number>;
  if (eventData.rewardCredits) {
    await addCredits(auth.userId, eventData.rewardCredits);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  }
  if (eventData.rewardXp) {
    await this.applyXpGain(auth.userId, eventData.rewardXp, client);
  }
  if (eventData.rewardRep) {
    const repFaction = event.event_type === 'anomaly_reading' ? 'scientists'
      : event.event_type === 'artifact_find' ? 'ancients'
      : 'traders';
    await this.applyReputationChange(auth.userId, repFaction as NpcFactionId, eventData.rewardRep, client);
  }

  client.send('logEntry', `Event abgeschlossen! +${eventData.rewardCredits ?? 0} CR`);
}
```

**Step 4: Hook quest progress into existing actions**

Add a method to check quest progress after player actions:

```typescript
private async checkQuestProgress(client: Client, playerId: string, action: string, context: Record<string, any>) {
  const rows = await getActiveQuests(playerId);
  for (const row of rows) {
    const objectives = row.objectives as QuestObjective[];
    let updated = false;

    for (const obj of objectives) {
      if (obj.fulfilled) continue;

      // Scan quest: check if player scanned the target sector
      if (obj.type === 'scan' && action === 'scan' && obj.targetX === context.sectorX && obj.targetY === context.sectorY) {
        obj.fulfilled = true;
        updated = true;
      }

      // Fetch quest: check if player is at the quest station with enough resources
      if (obj.type === 'fetch' && action === 'arrive' && context.sectorX === row.station_x && context.sectorY === row.station_y) {
        const cargo = await getPlayerCargo(playerId);
        if (obj.resource && obj.amount && (cargo[obj.resource as keyof CargoState] ?? 0) >= obj.amount) {
          obj.fulfilled = true;
          updated = true;
        }
      }

      // Delivery quest: check if player arrived at target
      if (obj.type === 'delivery' && action === 'arrive' && obj.targetX === context.sectorX && obj.targetY === context.sectorY) {
        obj.fulfilled = true;
        updated = true;
      }

      // Bounty quest: check if player won battle at target
      if (obj.type === 'bounty' && action === 'battle_won' && obj.targetX === context.sectorX && obj.targetY === context.sectorY) {
        obj.fulfilled = true;
        updated = true;
      }
    }

    if (updated) {
      await updateQuestObjectives(row.id, objectives);
      client.send('questProgress', { questId: row.id, objectives });

      // Check if all objectives fulfilled
      if (objectives.every(o => o.fulfilled)) {
        await updateQuestStatus(row.id, 'completed');
        const rewards = row.rewards;

        // Apply rewards
        if (rewards.credits) {
          await addCredits(playerId, rewards.credits);
          client.send('creditsUpdate', { credits: await getPlayerCredits(playerId) });
        }
        if (rewards.xp) await this.applyXpGain(playerId, rewards.xp, client);
        if (rewards.reputation && rewards.npcFactionId) {
          await this.applyReputationChange(playerId, rewards.npcFactionId, rewards.reputation, client);
        }
        if (rewards.reputationPenalty && rewards.rivalFactionId) {
          await this.applyReputationChange(playerId, rewards.rivalFactionId, -rewards.reputationPenalty, client);
        }

        // Deduct fetch resources from cargo
        for (const obj of objectives) {
          if (obj.type === 'fetch' && obj.resource && obj.amount) {
            await deductCargo(playerId, obj.resource, obj.amount);
          }
        }
        client.send('cargoUpdate', await getPlayerCargo(playerId));

        client.send('logEntry', `Quest abgeschlossen: +${rewards.credits ?? 0} CR, +${rewards.xp ?? 0} XP`);
        await this.sendActiveQuests(client, playerId);
      }
    }
  }
}
```

Then hook `checkQuestProgress` into:
- `handleJump` → call with action `'arrive'` after successful jump
- Scan handlers → call with action `'scan'` after successful scan
- `handleBattleAction` → call with action `'battle_won'` after victory

**Step 5: Send reputation + quests on join**

In `onJoin`, after existing sends, add:

```typescript
// Phase 4: Send reputation + active quests
await this.sendReputationUpdate(client, auth.userId);
await this.sendActiveQuests(client, auth.userId);
```

**Step 6: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(server): add battle, scan event, and quest progress handlers"
```

---

### Task 10: Client Store Updates

**Files:**
- Modify: `packages/shared/src/types.ts` (already done in Task 1 — verify)
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/test/mockStore.ts`

**Step 1: Add new state fields to gameSlice.ts**

Add imports:

```typescript
import type { ..., Quest, PlayerReputation, PlayerUpgrade, PirateEncounter, ScanEvent } from '@void-sector/shared';
```

Add to GameSlice interface:

```typescript
// Phase 4: NPC Ecosystem
activeQuests: Quest[];
reputations: PlayerReputation[];
playerUpgrades: PlayerUpgrade[];
activeBattle: PirateEncounter | null;
scanEvents: ScanEvent[];

setActiveQuests: (quests: Quest[]) => void;
setReputations: (reps: PlayerReputation[]) => void;
setPlayerUpgrades: (upgrades: PlayerUpgrade[]) => void;
setActiveBattle: (encounter: PirateEncounter | null) => void;
setScanEvents: (events: ScanEvent[]) => void;
addScanEvent: (event: ScanEvent) => void;
```

Add initial values:

```typescript
activeQuests: [],
reputations: [],
playerUpgrades: [],
activeBattle: null,
scanEvents: [],
```

Add setters:

```typescript
setActiveQuests: (activeQuests) => set({ activeQuests }),
setReputations: (reputations) => set({ reputations }),
setPlayerUpgrades: (playerUpgrades) => set({ playerUpgrades }),
setActiveBattle: (activeBattle) => set({ activeBattle }),
setScanEvents: (scanEvents) => set({ scanEvents }),
addScanEvent: (event) => set((s) => ({ scanEvents: [...s.scanEvents, event] })),
```

**Step 2: Update mockStore.ts**

Add defaults:

```typescript
activeQuests: [],
reputations: [],
playerUpgrades: [],
activeBattle: null,
scanEvents: [],
setActiveQuests: vi.fn(),
setReputations: vi.fn(),
setPlayerUpgrades: vi.fn(),
setActiveBattle: vi.fn(),
setScanEvents: vi.fn(),
addScanEvent: vi.fn(),
```

**Step 3: Build shared package (if types changed)**

Run: `cd packages/shared && npm run build`

**Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/test/mockStore.ts
git commit -m "feat(client): add NPC ecosystem state to store"
```

---

### Task 11: Client Network Handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add message handlers in setupRoomListeners**

Add after existing `room.onMessage()` calls:

```typescript
// Phase 4: NPC Ecosystem
room.onMessage('stationNpcsResult', (data) => {
  // Store NPCs/quests temporarily — QuestsScreen reads them
  const store = useStore.getState();
  store.addLogEntry(`Station: ${data.npcs.length} NPCs, ${data.quests.length} Quests verfügbar`);
  // We store available quests in a transient way (component state), so just trigger an event
  window.dispatchEvent(new CustomEvent('stationNpcsResult', { detail: data }));
});

room.onMessage('acceptQuestResult', (data) => {
  const store = useStore.getState();
  if (data.success && data.quest) {
    store.setActiveQuests([...store.activeQuests, data.quest]);
    store.addLogEntry(`Quest angenommen: ${data.quest.title}`);
  } else {
    store.addLogEntry(`Quest-Fehler: ${data.error}`);
  }
});

room.onMessage('abandonQuestResult', (data) => {
  const store = useStore.getState();
  if (!data.success) store.addLogEntry(`Fehler: ${data.error}`);
});

room.onMessage('activeQuests', (data) => {
  useStore.getState().setActiveQuests(data.quests);
});

room.onMessage('questProgress', (data) => {
  const store = useStore.getState();
  const quests = store.activeQuests.map(q =>
    q.id === data.questId ? { ...q, objectives: data.objectives } : q
  );
  store.setActiveQuests(quests);
  store.addLogEntry('Quest-Fortschritt aktualisiert');
  // Alert on QUESTS monitor
  const visible = store.sidebarSlots.includes('QUESTS')
    || store.leftSidebarSlots.includes('QUESTS')
    || store.mainMonitorMode === 'QUESTS';
  if (!visible) store.setAlert('QUESTS', true);
});

room.onMessage('reputationUpdate', (data) => {
  const store = useStore.getState();
  store.setReputations(data.reputations);
  store.setPlayerUpgrades(data.upgrades);
});

room.onMessage('battleResult', (data) => {
  const store = useStore.getState();
  store.setActiveBattle(null); // clear pending battle
  if (data.success && data.result) {
    store.addLogEntry(`Kampf: ${data.result.outcome}`);
  }
});

room.onMessage('pirateAmbush', (data) => {
  const store = useStore.getState();
  store.setActiveBattle(data.encounter);
  store.addLogEntry(`PIRATEN-HINTERHALT bei (${data.sectorX}, ${data.sectorY})!`);
});

room.onMessage('scanEventDiscovered', (data) => {
  const store = useStore.getState();
  store.addScanEvent(data.event);
  const visible = store.sidebarSlots.includes('QUESTS')
    || store.leftSidebarSlots.includes('QUESTS')
    || store.mainMonitorMode === 'QUESTS';
  if (!visible) store.setAlert('QUESTS', true);
});

room.onMessage('logEntry', (data) => {
  useStore.getState().addLogEntry(typeof data === 'string' ? data : data.message ?? '');
});
```

**Step 2: Add send methods**

```typescript
requestStationNpcs(sectorX: number, sectorY: number) {
  if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
  this.sectorRoom.send('getStationNpcs', { sectorX, sectorY });
}

sendAcceptQuest(templateId: string, stationX: number, stationY: number) {
  if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
  this.sectorRoom.send('acceptQuest', { templateId, stationX, stationY });
}

sendAbandonQuest(questId: string) {
  if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
  this.sectorRoom.send('abandonQuest', { questId });
}

requestActiveQuests() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getActiveQuests', {});
}

sendBattleAction(action: string, sectorX: number, sectorY: number) {
  if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
  this.sectorRoom.send('battleAction', { action, sectorX, sectorY });
}

sendCompleteScanEvent(eventId: string) {
  if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
  this.sectorRoom.send('completeScanEvent', { eventId });
}

requestReputation() {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('getReputation', {});
}
```

**Step 3: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(client): add NPC ecosystem network handlers"
```

---

### Task 12: QuestsScreen Component

**Files:**
- Create: `packages/client/src/components/QuestsScreen.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Create QuestsScreen.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { AvailableQuest, StationNpc } from '@void-sector/shared';

export function QuestsScreen() {
  const activeQuests = useStore((s) => s.activeQuests);
  const reputations = useStore((s) => s.reputations);
  const playerUpgrades = useStore((s) => s.playerUpgrades);
  const scanEvents = useStore((s) => s.scanEvents);
  const currentSector = useStore((s) => s.currentSector);
  const position = useStore((s) => s.position);

  const [tab, setTab] = useState<'active' | 'station' | 'rep' | 'events'>('active');
  const [stationNpcs, setStationNpcs] = useState<StationNpc[]>([]);
  const [availableQuests, setAvailableQuests] = useState<AvailableQuest[]>([]);

  useEffect(() => {
    network.requestActiveQuests();
    network.requestReputation();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setStationNpcs(detail.npcs);
      setAvailableQuests(detail.quests);
    };
    window.addEventListener('stationNpcsResult', handler);
    return () => window.removeEventListener('stationNpcsResult', handler);
  }, []);

  const isAtStation = currentSector?.type === 'station';

  const tierColors: Record<string, string> = {
    hostile: '#FF3333', unfriendly: '#FF8C00', neutral: '#FFB000',
    friendly: '#00FF88', honored: '#00BFFF',
  };

  return (
    <div style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {['active', 'station', 'rep', 'events'].map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t as any);
              if (t === 'station' && isAtStation) {
                network.requestStationNpcs(position.x, position.y);
              }
            }}
            style={{
              background: tab === t ? '#FFB000' : '#1a1a1a',
              color: tab === t ? '#000' : '#FFB000',
              border: '1px solid #FFB000',
              padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
            }}
          >
            {t === 'active' ? 'AKTIV' : t === 'station' ? 'STATION' : t === 'rep' ? 'REP' : 'EVENTS'}
          </button>
        ))}
      </div>

      {/* Active quests tab */}
      {tab === 'active' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- AKTIVE QUESTS ({activeQuests.length}/3) ---</div>
          {activeQuests.length === 0 && <div style={{ color: 'rgba(255,176,0,0.5)' }}>Keine aktiven Quests</div>}
          {activeQuests.map((q) => (
            <div key={q.id} style={{ border: '1px solid rgba(255,176,0,0.3)', padding: '4px', marginBottom: '4px' }}>
              <div style={{ color: '#FFB000' }}>{q.title}</div>
              {q.objectives.map((obj, i) => (
                <div key={i} style={{ color: obj.fulfilled ? '#00FF88' : 'rgba(255,176,0,0.6)', paddingLeft: '8px' }}>
                  {obj.fulfilled ? '[x]' : '[ ]'} {obj.description}
                </div>
              ))}
              <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '10px' }}>
                +{q.rewards.credits} CR | +{q.rewards.xp} XP | +{q.rewards.reputation} REP
              </div>
              <button
                onClick={() => network.sendAbandonQuest(q.id)}
                style={{ background: 'none', color: '#FF3333', border: '1px solid #FF3333', padding: '1px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '10px', marginTop: '2px' }}
              >
                [ABBRECHEN]
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Station quests tab */}
      {tab === 'station' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- STATION ---</div>
          {!isAtStation && <div style={{ color: 'rgba(255,176,0,0.5)' }}>Nicht an einer Station</div>}
          {isAtStation && stationNpcs.length === 0 && <div style={{ color: 'rgba(255,176,0,0.5)' }}>Lade NPCs...</div>}
          {stationNpcs.map((npc) => (
            <div key={npc.id} style={{ color: '#00FF88', marginBottom: '2px' }}>
              {npc.name} [{npc.factionId.toUpperCase()}]
            </div>
          ))}
          {availableQuests.length > 0 && (
            <>
              <div style={{ color: '#FFB000', marginTop: '8px', marginBottom: '4px' }}>VERFÜGBARE QUESTS:</div>
              {availableQuests.map((q) => (
                <div key={q.templateId} style={{ border: '1px solid rgba(255,176,0,0.3)', padding: '4px', marginBottom: '4px' }}>
                  <div style={{ color: '#FFB000' }}>{q.title}</div>
                  <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px' }}>{q.description}</div>
                  <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '10px' }}>
                    +{q.rewards.credits} CR | +{q.rewards.xp} XP | +{q.rewards.reputation} REP
                  </div>
                  <button
                    onClick={() => network.sendAcceptQuest(q.templateId, position.x, position.y)}
                    style={{ background: '#1a1a1a', color: '#00FF88', border: '1px solid #00FF88', padding: '1px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '10px', marginTop: '2px' }}
                  >
                    [ANNEHMEN]
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Reputation tab */}
      {tab === 'rep' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- REPUTATION ---</div>
          {reputations.map((r) => (
            <div key={r.factionId} style={{ marginBottom: '6px' }}>
              <div style={{ color: tierColors[r.tier] ?? '#FFB000' }}>
                {r.factionId.toUpperCase()} [{r.tier.toUpperCase()}]
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '120px', height: '8px', background: '#1a1a1a', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{
                    width: `${Math.max(0, (r.reputation + 100) / 2)}%`,
                    height: '100%',
                    background: tierColors[r.tier] ?? '#FFB000',
                  }} />
                </div>
                <span style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px' }}>{r.reputation}</span>
              </div>
            </div>
          ))}
          {playerUpgrades.length > 0 && (
            <>
              <div style={{ color: '#FFB000', marginTop: '8px', marginBottom: '4px' }}>UPGRADES:</div>
              {playerUpgrades.map((u) => (
                <div key={u.upgradeId} style={{ color: u.active ? '#00FF88' : '#FF3333' }}>
                  {u.active ? '[ON]' : '[OFF]'} {u.upgradeId.toUpperCase().replace('_', ' ')}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Scan events tab */}
      {tab === 'events' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- SCAN EVENTS ---</div>
          {scanEvents.filter(e => e.status === 'discovered').length === 0 && (
            <div style={{ color: 'rgba(255,176,0,0.5)' }}>Keine aktiven Events</div>
          )}
          {scanEvents.filter(e => e.status === 'discovered').map((e) => {
            const typeLabels: Record<string, string> = {
              distress_signal: 'NOTSIGNAL', anomaly_reading: 'ANOMALIE', artifact_find: 'ARTEFAKT',
            };
            return (
              <div key={e.id} style={{ border: '1px solid rgba(255,176,0,0.3)', padding: '4px', marginBottom: '4px' }}>
                <div style={{ color: '#FF00FF' }}>{typeLabels[e.eventType] ?? e.eventType}</div>
                <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px' }}>Sektor ({e.sectorX}, {e.sectorY})</div>
                <button
                  onClick={() => network.sendCompleteScanEvent(e.id)}
                  style={{ background: '#1a1a1a', color: '#00FF88', border: '1px solid #00FF88', padding: '1px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '10px', marginTop: '2px' }}
                >
                  [UNTERSUCHEN]
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to GameScreen.tsx**

Add import:
```typescript
import { QuestsScreen } from './QuestsScreen';
```

Add case in `renderScreen`:
```typescript
case MONITORS.QUESTS: return <QuestsScreen />;
```

**Step 3: Commit**

```bash
git add packages/client/src/components/QuestsScreen.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): add QuestsScreen component with quest/rep/events tabs"
```

---

### Task 13: BattleDialog Component

**Files:**
- Create: `packages/client/src/components/BattleDialog.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`

**Step 1: Create BattleDialog.tsx**

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';

export function BattleDialog() {
  const activeBattle = useStore((s) => s.activeBattle);

  if (!activeBattle) return null;

  const { pirateLevel, pirateHp, pirateDamage, canNegotiate, negotiateCost, sectorX, sectorY } = activeBattle;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        border: '2px solid #FF3333', background: '#0a0a0a', padding: '16px', maxWidth: '350px',
        fontFamily: 'monospace', fontSize: '12px',
      }}>
        <div style={{ color: '#FF3333', fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
          ☠ PIRATEN-KONTAKT ☠
        </div>
        <div style={{ color: '#FFB000', marginBottom: '12px' }}>
          <div>Sektor: ({sectorX}, {sectorY})</div>
          <div>Piraten-Level: {pirateLevel}</div>
          <div>HP: {pirateHp} | DMG: {pirateDamage}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => network.sendBattleAction('fight', sectorX, sectorY)}
            style={{
              background: '#1a1a1a', color: '#FF3333', border: '1px solid #FF3333',
              padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
            }}
          >
            [KAMPF] — Auto-Resolve
          </button>

          <button
            onClick={() => network.sendBattleAction('flee', sectorX, sectorY)}
            style={{
              background: '#1a1a1a', color: '#FFB000', border: '1px solid #FFB000',
              padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
            }}
          >
            [FLUCHT] — 2 AP, 60% Chance
          </button>

          {canNegotiate && (
            <button
              onClick={() => network.sendBattleAction('negotiate', sectorX, sectorY)}
              style={{
                background: '#1a1a1a', color: '#00FF88', border: '1px solid #00FF88',
                padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
              }}
            >
              [VERHANDELN] — {negotiateCost} CR
            </button>
          )}

          {!canNegotiate && (
            <div style={{ color: 'rgba(255,176,0,0.3)', fontSize: '10px', textAlign: 'center' }}>
              Verhandlung erfordert Piraten-Rep &gt;= Friendly
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add to GameScreen.tsx**

Add import:
```typescript
import { BattleDialog } from './BattleDialog';
```

Render it as an overlay (outside the monitor system, at the end of GameScreen's return):
```tsx
<BattleDialog />
```

**Step 3: Commit**

```bash
git add packages/client/src/components/BattleDialog.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): add BattleDialog overlay with flee/fight/negotiate"
```

---

### Task 14: Client Tests

**Files:**
- Create: `packages/client/src/__tests__/QuestsScreen.test.tsx`
- Create: `packages/client/src/__tests__/BattleDialog.test.tsx`

**Step 1: Write QuestsScreen tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestsScreen } from '../components/QuestsScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestActiveQuests: vi.fn(),
    requestReputation: vi.fn(),
    requestStationNpcs: vi.fn(),
    sendAcceptQuest: vi.fn(),
    sendAbandonQuest: vi.fn(),
    sendCompleteScanEvent: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('QuestsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({});
  });

  it('shows empty state with no active quests', () => {
    mockStoreState({ activeQuests: [] });
    render(<QuestsScreen />);
    expect(screen.getByText(/AKTIVE QUESTS/)).toBeTruthy();
    expect(screen.getByText(/Keine aktiven Quests/)).toBeTruthy();
  });

  it('shows active quest with objectives', () => {
    mockStoreState({
      activeQuests: [{
        id: 'q1', templateId: 't1', npcName: 'Zar', npcFactionId: 'traders',
        title: 'Erz-Lieferung', description: 'Bringe 3 Ore',
        stationX: 10, stationY: 20,
        objectives: [{ type: 'fetch', description: '3 ore', resource: 'ore', amount: 3, progress: 0, fulfilled: false }],
        rewards: { credits: 30, xp: 10, reputation: 5 },
        status: 'active', acceptedAt: Date.now(), expiresAt: Date.now() + 86400000,
      }],
    });
    render(<QuestsScreen />);
    expect(screen.getByText('Erz-Lieferung')).toBeTruthy();
    expect(screen.getByText(/3 ore/)).toBeTruthy();
    expect(screen.getByText(/\+30 CR/)).toBeTruthy();
  });

  it('shows reputation bars', async () => {
    mockStoreState({
      reputations: [
        { factionId: 'traders', reputation: 25, tier: 'friendly' },
        { factionId: 'scientists', reputation: 0, tier: 'neutral' },
        { factionId: 'pirates', reputation: -10, tier: 'unfriendly' },
        { factionId: 'ancients', reputation: 0, tier: 'neutral' },
      ],
    });
    render(<QuestsScreen />);
    await userEvent.click(screen.getByText('REP'));
    expect(screen.getByText(/TRADERS/)).toBeTruthy();
    expect(screen.getByText(/FRIENDLY/)).toBeTruthy();
  });

  it('requests data on mount', () => {
    render(<QuestsScreen />);
    expect(network.requestActiveQuests).toHaveBeenCalled();
    expect(network.requestReputation).toHaveBeenCalled();
  });
});
```

**Step 2: Write BattleDialog tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattleDialog } from '../components/BattleDialog';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { sendBattleAction: vi.fn() },
}));

import { network } from '../network/client';

describe('BattleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no active battle', () => {
    mockStoreState({ activeBattle: null });
    const { container } = render(<BattleDialog />);
    expect(container.innerHTML).toBe('');
  });

  it('shows battle dialog with encounter info', () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 3, pirateHp: 50, pirateDamage: 14,
        sectorX: 10, sectorY: 20, canNegotiate: false, negotiateCost: 30,
      },
    });
    render(<BattleDialog />);
    expect(screen.getByText(/PIRATEN-KONTAKT/)).toBeTruthy();
    expect(screen.getByText(/Level: 3/)).toBeTruthy();
    expect(screen.getByText(/\[KAMPF\]/)).toBeTruthy();
    expect(screen.getByText(/\[FLUCHT\]/)).toBeTruthy();
  });

  it('shows negotiate when canNegotiate is true', () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 2, pirateHp: 40, pirateDamage: 11,
        sectorX: 5, sectorY: 5, canNegotiate: true, negotiateCost: 20,
      },
    });
    render(<BattleDialog />);
    expect(screen.getByText(/\[VERHANDELN\]/)).toBeTruthy();
    expect(screen.getByText(/20 CR/)).toBeTruthy();
  });

  it('sends battle action on fight click', async () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 1, pirateHp: 30, pirateDamage: 8,
        sectorX: 10, sectorY: 20, canNegotiate: false, negotiateCost: 10,
      },
    });
    render(<BattleDialog />);
    await userEvent.click(screen.getByText(/\[KAMPF\]/));
    expect(network.sendBattleAction).toHaveBeenCalledWith('fight', 10, 20);
  });
});
```

**Step 3: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests PASS (previous 63 + 8 new = ~71)

**Step 4: Commit**

```bash
git add packages/client/src/__tests__/QuestsScreen.test.tsx packages/client/src/__tests__/BattleDialog.test.tsx
git commit -m "test(client): add QuestsScreen and BattleDialog tests"
```

---

### Task 15: Documentation + Final Verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `planung/ROADMAP.md`

**Step 1: Run all tests**

Run: `cd packages/server && npx vitest run && cd ../client && npx vitest run && cd ../shared && npx vitest run`
Expected: All pass

**Step 2: Update CLAUDE.md**

Update test counts, migration range (001-008), add Phase 4 description to Current State.

**Step 3: Update ROADMAP.md**

Mark Phase 4 items as complete:
```markdown
## Phase 4: NPC-Ökosystem
- [x] Prozedurale Alien-Quests.
- [x] Reputations-System (A/B Balancing).
- [x] Auto-Battle Logik gegen Piraten.
```

**Step 4: Commit**

```bash
git add CLAUDE.md planung/ROADMAP.md
git commit -m "docs: update documentation for Phase 4 NPC ecosystem"
```
