# Complete Codebase Review — Design Document (#133)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Comprehensive codebase overhaul — fix failing tests, refactor SectorRoom into service architecture with DI, add ESLint/Prettier, eliminate `any` types, implement E2E tests covering all user journeys, produce audit report.

**Architecture:** Service-oriented refactoring of SectorRoom.ts (4,605 LOC → ~500 LOC orchestrator + 10 domain services). Playwright E2E against Docker test environment.

---

## Audit Baseline (Current State)

| Metric | Value |
|--------|-------|
| Total tests | 1,210 (6 failing) |
| SectorRoom.ts | 4,605 lines, 89 message handlers |
| `any` type usage | 79 instances |
| Console statements | 46 (no structured logging) |
| ESLint config | None |
| E2E tests | None |
| Engine modules | 19 files, all with unit tests |
| Documentation | 56 plan docs, 1 compendium |

---

## Phase 1: Fix Failing Tests

6 tests fail due to calculation logic drift after feature sprints:

1. **commands.test.ts** (2 failures): Scanner radius formula changed — tests expect old values
2. **mining.test.ts** (2 failures): Mining rate affected by faction bonus integration
3. **factionUpgradeIntegration.test.ts** (1 failure): Tier 1A mining bonus misconfigured
4. **rescue.test.ts** (1 failure): Distress call probability ~0.45% vs expected ~8%

**Approach:** Update test expectations to match current (intended) calculation logic. If a calculation is genuinely broken (e.g., rescue probability off by 18x), fix the constant, not the test.

---

## Phase 2: Service Architecture for SectorRoom

### Service Registry (10 Services)

| Service | Handlers | Responsibility |
|---------|----------|---------------|
| `NavigationService` | moveSector, jump, hyperJump, autopilot (start/cancel/status), emergencyWarp | Movement, pathfinding, autopilot timers |
| `ScanService` | localScan, areaScan, scan, completeScanEvent | Scanning, scan event generation |
| `CombatService` | battleAction, combatV2Action, combatV2Flee, installDefense, repairStation | All combat, station defense |
| `MiningService` | mine, stopMine, jettison | Resource extraction, cargo ejection |
| `EconomyService` | npcTrade, placeOrder, getTradeOrders, getMyOrders, cancelOrder, transfer, upgradeStructure, refuel | Trading, transfers, structure upgrades |
| `FactionService` | createFaction, getFaction, factionAction, respondInvite, factionUpgrade | Faction CRUD, upgrades, XP |
| `QuestService` | getStationNpcs, acceptQuest, abandonQuest, getActiveQuests, getReputation, checkQuestProgress | NPC ecosystem, reputation |
| `ShipService` | getShips, switchShip, installModule, removeModule, buyModule, buyHull, renameShip, getModuleInventory, research*, activateBlueprint | Ship management, tech tree |
| `WorldService` | build, getBase, renameBase, bookmarks, slates, jumpGates, frequencyMatch, rescue, deliverSurvivors, nameQuadrant, quadrants, firstContact, distressCalls | World interaction, POIs |
| `ChatService` | chat | Message routing (sector/quadrant/faction/direct) |

*Plus: `FactoryService` and `KontorService` as sub-services of EconomyService*

### Dependency Injection Pattern

```typescript
// packages/server/src/rooms/services/ServiceContext.ts
export interface ServiceContext {
  room: SectorRoom;                    // Room reference for state access
  db: typeof queries;                  // PostgreSQL queries
  redis: RedisAPStore;                 // Redis state store
  send: (client: Client, type: string, data: unknown) => void;
  broadcast: (type: string, data: unknown) => void;
  getShipForClient: (sessionId: string) => ShipStats | null;
  getPlayerBonuses: (userId: string) => Promise<FactionBonuses>;
  checkRate: (sessionId: string, action: string, intervalMs: number) => boolean;
}
```

```typescript
// packages/server/src/rooms/services/NavigationService.ts
export class NavigationService {
  constructor(private ctx: ServiceContext) {}

  async handleMoveSector(client: Client, data: MoveSectorMessage): Promise<void> {
    // Extracted from SectorRoom lines 1241-1280
  }
  // ...
}
```

```typescript
// SectorRoom.ts (orchestrator, ~500 lines)
export class SectorRoom extends Room<SectorState> {
  private navigation!: NavigationService;
  private scanning!: ScanService;
  private combat!: CombatService;
  // ...

  async onCreate(options: any) {
    const ctx: ServiceContext = { room: this, db: queries, redis: this.redis, ... };
    this.navigation = new NavigationService(ctx);
    this.scanning = new ScanService(ctx);
    // ...

    this.onMessage('moveSector', (c, d) => this.navigation.handleMoveSector(c, d));
    this.onMessage('localScan', (c, d) => this.scanning.handleLocalScan(c, d));
    // ...
  }
}
```

### Shared State Access

Room-level maps (`clientShips`, `combatV2States`, `autopilotTimers`, `playerSectorData`, `rateLimits`) stay on SectorRoom and are accessed via `ctx.room`. This avoids duplicating state across services.

---

## Phase 3: Code Quality

### ESLint + Prettier

Root-level config with shared rules:
- `@typescript-eslint/no-explicit-any: warn` (not error — gradual migration)
- `no-console: warn` (except warn/error)
- `import/order` with groups (builtin, external, internal, parent, sibling)
- Prettier: single quotes, semicolons, 2-space indent, 100 char line width
- CI: `npm run lint` in GitHub Actions pipeline

### `any` Type Elimination (79 instances)

**Client (15 instances):** Create typed Colyseus schema interfaces for `players`, `sectors`, `discoveries`. Replace `(room.state as any).players` with typed accessors.

**Tests (50+ instances):** Create mock factory helpers:
```typescript
// packages/server/src/test/mockFactories.ts
export function mockQueryResult(rows: unknown[] = []): QueryResult {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
```

**Server (14 instances):** Type narrowing for Colyseus schema access, explicit message payload types.

### Structured Logging (pino)

Replace 46 console statements with:
```typescript
import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Usage:
logger.info({ userId, sector: `${x}:${y}` }, 'player joined sector');
logger.error({ err }, 'jump validation failed');
```

### Dead Code Removal

Analyze unused exports from `packages/shared/src/types.ts` and `constants.ts`. Remove any types/constants not imported by server or client.

---

## Phase 4: E2E Tests (Playwright)

### Infrastructure

```
docker-compose.test.yml  — PostgreSQL + Redis (test instances)
playwright.config.ts     — base URL localhost:3201, chromium
e2e/                     — test files
e2e/fixtures/            — test helpers (login, createPlayer, etc.)
```

### Test Suites (11 User Journeys)

| Suite | File | Steps |
|-------|------|-------|
| Auth | `e2e/auth.spec.ts` | Register → Login → Guest mode → Logout |
| Navigation | `e2e/navigation.spec.ts` | D-Pad move → Hyperjump → Autopilot → Emergency warp |
| Exploration | `e2e/exploration.spec.ts` | Local scan → Area scan → Scan event encounter |
| Mining | `e2e/mining.spec.ts` | Start mine → Wait → Stop → Check cargo → Jettison |
| Station | `e2e/station.spec.ts` | Visit station → NPC trade → Refuel → Buy module |
| Combat | `e2e/combat.spec.ts` | Encounter pirate → Combat V2 actions → Flee |
| Factions | `e2e/factions.spec.ts` | Create → Invite → Join → Chat → Upgrade |
| Economy | `e2e/economy.spec.ts` | Trade order → Kontor order → Factory recipe → Trade route |
| Tech Tree | `e2e/techtree.spec.ts` | Start research → Claim → Activate blueprint → Install |
| World | `e2e/world.spec.ts` | Create slate → Activate → Bookmarks → JumpGate → Rescue |
| Quadrants | `e2e/quadrants.spec.ts` | Cross-quadrant jump → First contact → Name quadrant |

### Fixtures

```typescript
// e2e/fixtures/game.ts
export async function loginAsNewPlayer(page: Page, username: string) { ... }
export async function navigateToSector(page: Page, x: number, y: number) { ... }
export async function selectProgram(page: Page, program: string) { ... }
```

---

## Phase 5: Documentation + Audit Report

### AUDIT_REPORT.md

| Metric | Before | After |
|--------|--------|-------|
| Total tests | 1,210 (6 failing) | TBD (0 failing) |
| SectorRoom.ts lines | 4,605 | ~500 |
| Service files | 1 | 11 |
| `any` usage | 79 | <5 |
| Console statements | 46 | 0 (pino logger) |
| ESLint config | None | Root + CI |
| E2E test suites | 0 | 11 |

### API Documentation

Document all 89 message handlers:
```markdown
### moveSector
**Payload:** `{ dx: number, dy: number }`
**Response:** `sectorData` message with updated sector
**Errors:** Rate limited (500ms), AP insufficient, black hole blocked
```

Save as `docs/api-reference.md`.

### Compendium Update

Update `docs/compendium.md` with service architecture diagram, new test counts, current feature list.

---

## Implementation Order

```
Phase 1 (Fix Tests)         — independent, start first
Phase 2 (Service Refactor)  — largest block, after Phase 1
Phase 3 (Code Quality)      — after Phase 2 (ESLint on refactored code)
Phase 4 (E2E Tests)         — after Phase 2 (tests against stable services)
Phase 5 (Documentation)     — last (documents final state)
```

Estimated task count: ~25 tasks across all phases.
