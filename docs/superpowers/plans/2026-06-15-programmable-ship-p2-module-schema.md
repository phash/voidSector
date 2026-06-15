# Programmable Ship — Plan 2: Module, Schema & Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the `computer` ship module (MK.I–MK.V), persist ship programs + runtime state + logs (migration 099 + queries), expose AUTOMATION tuning via `game_config`, and a shared helper to read a ship's computer level — the data/persistence foundation the runtime (Plan 3) and UI (Plan 4) build on.

**Architecture:** `computer` is a normal data-driven module (`MODULE_DEFINITIONS`) that installs into the **AUSBAU ACEP extra slot** (non-disruptive: no change to the 9 specialized slots, gives a slot trade-off vs drive/generator/repair). Computer level = max tier among installed `category:'computer'` modules. Programs persist in three new tables; queries follow the repo's mock-the-`query`-helper test pattern. AUTOMATION limits live in `game_config` (shared scalar defaults → seeded → runtime-tunable).

**Tech Stack:** TypeScript (shared: clean `tsc`; server: clean `tsc`), Vitest. Postgres (`gen_random_uuid`, `JSONB`, `BIGSERIAL` all already used).

**Spec:** `docs/superpowers/specs/2026-06-15-programmable-ship-design.md` (§2, §4). **Plan 1** (DSL core) already merged into this branch.

---

## Design decisions locked for this plan
- **Slot:** `computer` → AUSBAU ACEP extra-slot category (add `'computer'` to the `ausbau` `AcepSlotDef.categories`). NO new specialized slot (avoids shifting the extra-slot index boundary that `slotValidation.test.ts`/`slotSystem.test.ts` encode at index 9).
- **`ArtefactType`** gains `'computer'` (since `ModuleCategory = ArtefactType`) + a `ARTEFACT_TYPE_FOR_CATEGORY` entry. Client `DRAW_ROUTINES` (a `Record<ModuleCategory, DrawFn>`) will then miss `'computer'` — that's a **tsc-only** error in the client, which is verified via Vite/vitest (not tsc), so it does NOT block; the proper computer artwork is added in Plan 4.
- **Program key:** one row per `(player_id, name)`; runtime state keyed by `player_id` (one active program/player in MVP).
- **Computer level:** `getShipComputerLevel(modules)` = max tier of installed `category:'computer'` modules, else 0.

## File Structure
| File | Action | Responsibility |
|---|---|---|
| `packages/shared/src/types.ts` | modify | add `'computer'` to `ArtefactType` + `ARTEFACT_TYPE_FOR_CATEGORY` |
| `packages/shared/src/constants.ts` | modify | add `'computer'` to the 4 `ausbau` `AcepSlotDef` entries |
| `packages/shared/src/moduleDefinitions.ts` | modify | add `computer_mk1`..`mk5` |
| `packages/shared/src/shipCalculator.ts` | modify | add `getShipComputerLevel()` |
| `packages/shared/src/automation/types.ts` | modify | add AUTOMATION_* scalar config defaults |
| `packages/shared/src/index.ts` | modify | export `getShipComputerLevel` |
| `packages/server/src/engine/gameConfigSeed.ts` | modify | seed AUTOMATION_* keys |
| `packages/server/src/db/migrations/099_ship_programs.sql` | create | program tables |
| `packages/server/src/db/programQueries.ts` | create | program CRUD/state/logs queries |
| various `__tests__` | create/modify | TDD + count fixups |

**Test commands:** `cd packages/shared && npx vitest run` · `cd packages/server && npx vitest run` · builds: `cd packages/shared && npm run build`, `cd packages/server && npm run build` (server tsc is clean & authoritative).

---

### Task 1: Slot & category integration (shared)

**Files:** modify `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`; test `packages/shared/src/__tests__/computerSlot.test.ts`.

- [ ] **Step 1: Write the failing test** — create `packages/shared/src/__tests__/computerSlot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ARTEFACT_TYPE_FOR_CATEGORY } from '../types.js';
import { ACEP_PATH_SLOT_UNLOCKS } from '../constants.js';

describe('computer slot & category integration', () => {
  it('maps the computer category to itself in ARTEFACT_TYPE_FOR_CATEGORY', () => {
    expect(ARTEFACT_TYPE_FOR_CATEGORY.computer).toBe('computer');
  });

  it('allows the computer category in every AUSBAU extra slot', () => {
    const ausbau = ACEP_PATH_SLOT_UNLOCKS.filter((s) => s.path === 'ausbau');
    expect(ausbau.length).toBeGreaterThan(0);
    for (const slot of ausbau) {
      expect(slot.categories).toContain('computer');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd packages/shared && npx vitest run src/__tests__/computerSlot.test.ts` → FAIL (`ARTEFACT_TYPE_FOR_CATEGORY.computer` undefined).

- [ ] **Step 3: Implement** —

In `packages/shared/src/types.ts`, add `| 'computer'` to the `ArtefactType` union (after `| 'factory';` → before the closing) so it reads:
```ts
export type ArtefactType =
  | 'drive'
  | 'cargo'
  | 'scanner'
  | 'armor'
  | 'weapon'
  | 'shield'
  | 'defense'
  | 'special'
  | 'mining'
  | 'generator'
  | 'repair'
  | 'factory'
  | 'computer';
```
Do NOT add `'computer'` to the `ARTEFACT_TYPES` array (computer is not a lootable artefact). Add the map entry to `ARTEFACT_TYPE_FOR_CATEGORY` (after `factory: 'factory',`):
```ts
  factory: 'factory',
  computer: 'computer',
};
```

In `packages/shared/src/constants.ts`, add `'computer'` to the `categories` array of each of the 4 `ausbau` entries in `ACEP_PATH_SLOT_UNLOCKS` (levels 2, 4, 8, 10) so each reads:
```ts
  { path: 'ausbau', level: 2, label: 'ENG', categories: ['drive', 'generator', 'repair', 'computer'] },
  { path: 'ausbau', level: 4, label: 'ENG', categories: ['drive', 'generator', 'repair', 'computer'] },
  { path: 'ausbau', level: 8, label: 'ENG', categories: ['drive', 'generator', 'repair', 'computer'] },
  { path: 'ausbau', level: 10, label: 'ENG', categories: ['drive', 'generator', 'repair', 'computer'] },
```

- [ ] **Step 4: Run test + full shared suite** — `cd packages/shared && npx vitest run src/__tests__/computerSlot.test.ts` → PASS, then `npx vitest run` → all pass (no slot-count tests change, since specialized slots stay at 9).

- [ ] **Step 5: Build shared** — `cd packages/shared && npm run build` → tsc exit 0.

- [ ] **Step 6: Commit**
```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/__tests__/computerSlot.test.ts packages/shared/dist
git commit -m "feat: computer module category + AUSBAU slot integration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: computer module definitions MK.I–V (shared)

**Files:** modify `packages/shared/src/moduleDefinitions.ts`, `packages/shared/src/__tests__/moduleDefinitions.test.ts`; test `packages/shared/src/__tests__/computerModules.test.ts`.

- [ ] **Step 1: Write the failing test** — create `packages/shared/src/__tests__/computerModules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MODULE_DEFINITIONS, MODULE_MAP } from '../moduleDefinitions.js';

describe('computer modules MK.I-V', () => {
  const computers = MODULE_DEFINITIONS.filter((m) => m.category === 'computer');

  it('defines exactly 5 computer modules, tiers 1-5, slot "computer"', () => {
    expect(computers).toHaveLength(5);
    expect(computers.map((m) => m.tier).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const m of computers) {
      expect(m.slot).toBe('computer');
      expect(m.hitpoints).toBeGreaterThan(0);
      expect(m.isFoundOnly).toBe(false);
    }
  });

  it('MK.I is the cheapest and chains via prerequisites', () => {
    expect(MODULE_MAP.get('computer_mk1')!.tier).toBe(1);
    expect(MODULE_MAP.get('computer_mk2')!.prerequisiteModuleId).toBe('computer_mk1');
    expect(MODULE_MAP.get('computer_mk5')!.prerequisiteModuleId).toBe('computer_mk4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd packages/shared && npx vitest run src/__tests__/computerModules.test.ts` → FAIL (0 computer modules).

- [ ] **Step 3: Implement** — In `packages/shared/src/moduleDefinitions.ts`, insert these 5 entries into the `MODULE_DEFINITIONS` array (just before the closing `];` at line ~1541):

```ts
  // ─── COMPUTER (ship automation) ───────────────────────────────────────────
  {
    id: 'computer_mk1',
    name: 'Bordcomputer Mk1',
    category: 'computer',
    tier: 1,
    slot: 'computer',
    costCredits: 300,
    costOre: 0,
    costGas: 0,
    costCrystal: 0,
    costArtefact: '0',
    apCost: 0,
    energyCost: 20,
    hitpoints: 15,
    stats: {},
    description: 'Automatisiert einfache Befehlsfolgen — nur während das Spiel im Browser läuft.',
    isFoundOnly: false,
    isUnique: false,
  },
  {
    id: 'computer_mk2',
    name: 'Bordcomputer Mk2',
    category: 'computer',
    tier: 2,
    slot: 'computer',
    costCredits: 1200,
    costOre: 0,
    costGas: 0,
    costCrystal: 40,
    costArtefact: '0',
    apCost: 0,
    energyCost: 25,
    hitpoints: 15,
    stats: {},
    description: 'Erlaubt Bedingungen (if/else) und Schleifen — online.',
    isFoundOnly: false,
    isUnique: false,
    prerequisiteModuleId: 'computer_mk1',
  },
  {
    id: 'computer_mk3',
    name: 'Bordcomputer Mk3',
    category: 'computer',
    tier: 3,
    slot: 'computer',
    costCredits: 4000,
    costOre: 60,
    costGas: 60,
    costCrystal: 100,
    costArtefact: '0',
    apCost: 0,
    energyCost: 30,
    hitpoints: 15,
    stats: {},
    description: 'Verschachtelte Logik, repeat N times und alle Bedingungen — online.',
    isFoundOnly: false,
    isUnique: false,
    prerequisiteModuleId: 'computer_mk2',
  },
  {
    id: 'computer_mk4',
    name: 'Bordcomputer Mk4',
    category: 'computer',
    tier: 4,
    slot: 'computer',
    costCredits: 12000,
    costOre: 120,
    costGas: 120,
    costCrystal: 200,
    costArtefact: '0',
    apCost: 0,
    energyCost: 40,
    hitpoints: 15,
    stats: {},
    description: 'Schaltet Offline-Ausführung frei (Schiff handelt, während du weg bist).',
    isFoundOnly: false,
    isUnique: false,
    prerequisiteModuleId: 'computer_mk3',
  },
  {
    id: 'computer_mk5',
    name: 'Bordcomputer Mk5',
    category: 'computer',
    tier: 5,
    slot: 'computer',
    costCredits: 30000,
    costOre: 250,
    costGas: 250,
    costCrystal: 400,
    costArtefact: '0',
    apCost: 0,
    energyCost: 50,
    hitpoints: 15,
    stats: {},
    description: 'Volles Feature-Set, längstes Offline-Fenster und Scheduler-Priorität.',
    isFoundOnly: false,
    isUnique: false,
    prerequisiteModuleId: 'computer_mk4',
  },
```

In `packages/shared/src/__tests__/moduleDefinitions.test.ts`, update the count test: change `it('has 76 modules', () => { expect(MODULE_DEFINITIONS).toHaveLength(76); });` to `it('has 81 modules', () => { expect(MODULE_DEFINITIONS).toHaveLength(81); });`.

- [ ] **Step 4: Run tests** — `cd packages/shared && npx vitest run` → all pass (count now 81, computer module tests green). If any OTHER count/category assertion fails (e.g. a "categories" list test), update it to include `computer` and report it.

- [ ] **Step 5: Build shared** — `cd packages/shared && npm run build` → tsc exit 0.

- [ ] **Step 6: Commit**
```bash
git add packages/shared/src/moduleDefinitions.ts packages/shared/src/__tests__/moduleDefinitions.test.ts packages/shared/src/__tests__/computerModules.test.ts packages/shared/dist
git commit -m "feat: computer modules MK.I-V (ship automation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: getShipComputerLevel helper (shared)

**Files:** modify `packages/shared/src/shipCalculator.ts`, `packages/shared/src/index.ts`; test `packages/shared/src/__tests__/computerLevel.test.ts`.

- [ ] **Step 1: Write the failing test** — create `packages/shared/src/__tests__/computerLevel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getShipComputerLevel } from '../shipCalculator.js';
import type { ShipModule } from '../types.js';

const mod = (moduleId: string, slotIndex = 0): ShipModule => ({ moduleId, slotIndex, source: 'built' });

describe('getShipComputerLevel', () => {
  it('returns 0 when no computer is installed', () => {
    expect(getShipComputerLevel([mod('ion_drive_mk1'), mod('fusion_cell_mk1', 1)])).toBe(0);
  });

  it('returns the tier of the installed computer', () => {
    expect(getShipComputerLevel([mod('computer_mk3', 9)])).toBe(3);
  });

  it('returns the MAX tier when several computers are present', () => {
    expect(getShipComputerLevel([mod('computer_mk1', 9), mod('computer_mk4', 10)])).toBe(4);
  });
});
```

> Note: `ModuleSource` — confirm the literal used elsewhere (the test uses `'built'`). If the codebase uses a different source literal, match it; `source` value does not affect this helper.

- [ ] **Step 2: Run test to verify it fails** — `cd packages/shared && npx vitest run src/__tests__/computerLevel.test.ts` → FAIL (`getShipComputerLevel` not exported).

- [ ] **Step 3: Implement** — In `packages/shared/src/shipCalculator.ts`, add (near the other exported helpers, and ensure `MODULE_MAP` is imported — it already is at line ~21):

```ts
/** Highest tier among installed `computer` modules (the ship-computer level); 0 if none. */
export function getShipComputerLevel(modules: Array<{ moduleId: string }>): number {
  let level = 0;
  for (const m of modules) {
    const def = MODULE_MAP.get(m.moduleId);
    if (def?.category === 'computer' && def.tier > level) level = def.tier;
  }
  return level;
}
```

In `packages/shared/src/index.ts`, add `getShipComputerLevel` to the existing `shipCalculator` export list (the line beginning `export { calculateShipStats, ... } from './shipCalculator.js';`).

- [ ] **Step 4: Run test + build** — `cd packages/shared && npx vitest run src/__tests__/computerLevel.test.ts` → PASS; `npm run build` → tsc exit 0.

- [ ] **Step 5: Commit**
```bash
git add packages/shared/src/shipCalculator.ts packages/shared/src/index.ts packages/shared/src/__tests__/computerLevel.test.ts packages/shared/dist
git commit -m "feat: getShipComputerLevel(modules) shared helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: AUTOMATION game_config defaults + seed

**Files:** modify `packages/shared/src/automation/types.ts`, `packages/server/src/engine/gameConfigSeed.ts`; tests `packages/shared/src/automation/__tests__/configDefaults.test.ts`, `packages/server/src/__tests__/automationConfigSeed.test.ts`.

- [ ] **Step 1: Write the failing tests** —

`packages/shared/src/automation/__tests__/configDefaults.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK4,
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK5,
  AUTOMATION_MAX_CONCURRENT_OFFLINE,
  AUTOMATION_TICK_WORK_BUDGET,
  AUTOMATION_SCHEDULER_INTERVAL_MS,
} from '../types.js';

describe('automation config defaults', () => {
  it('defines offline windows for MK.IV and MK.V', () => {
    expect(AUTOMATION_OFFLINE_WINDOW_HOURS_MK4).toBe(4);
    expect(AUTOMATION_OFFLINE_WINDOW_HOURS_MK5).toBe(12);
  });
  it('defines scheduler safety caps', () => {
    expect(AUTOMATION_MAX_CONCURRENT_OFFLINE).toBeGreaterThan(0);
    expect(AUTOMATION_TICK_WORK_BUDGET).toBeGreaterThan(0);
    expect(AUTOMATION_SCHEDULER_INTERVAL_MS).toBeGreaterThanOrEqual(250);
  });
});
```

`packages/server/src/__tests__/automationConfigSeed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CONFIG_SEED } from '../engine/gameConfigSeed.js';

describe('automation config seed', () => {
  it('seeds program-length limits for MK.I-V and scheduler caps under category "automation"', () => {
    const keys = CONFIG_SEED.filter((e) => e.category === 'automation').map((e) => e.key);
    for (const k of ['AUTOMATION_MAXLEN_MK1', 'AUTOMATION_MAXLEN_MK5', 'AUTOMATION_OFFLINE_WINDOW_HOURS_MK4', 'AUTOMATION_MAX_CONCURRENT_OFFLINE', 'AUTOMATION_TICK_WORK_BUDGET', 'AUTOMATION_SCHEDULER_INTERVAL_MS']) {
      expect(keys).toContain(k);
    }
  });
  it('MK.I length default resolves to 10', () => {
    const e = CONFIG_SEED.find((x) => x.key === 'AUTOMATION_MAXLEN_MK1')!;
    expect(e.getDefault()).toBe(10);
  });
});
```
> Confirm `CONFIG_SEED` and the `ConfigSeedEntry` shape (`{ key, category, description, getDefault }`) by reading `gameConfigSeed.ts`; if `CONFIG_SEED` is not exported, export it (it must be for the test).

- [ ] **Step 2: Run tests to verify they fail** — `cd packages/shared && npx vitest run src/automation/__tests__/configDefaults.test.ts` and `cd packages/server && npx vitest run src/__tests__/automationConfigSeed.test.ts` → both FAIL.

- [ ] **Step 3: Implement** —

In `packages/shared/src/automation/types.ts`, append (below `AUTOMATION_PROGRAM_LIMITS`):
```ts
/** Offline-execution window (hours) per computer tier. Server may override via game_config. */
export const AUTOMATION_OFFLINE_WINDOW_HOURS_MK4 = 4;
export const AUTOMATION_OFFLINE_WINDOW_HOURS_MK5 = 12;

/** Offline-scheduler safety caps (used by Plan 3). Server may override via game_config. */
export const AUTOMATION_MAX_CONCURRENT_OFFLINE = 50;
export const AUTOMATION_TICK_WORK_BUDGET = 200;
export const AUTOMATION_SCHEDULER_INTERVAL_MS = 1000;
```

In `packages/server/src/engine/gameConfigSeed.ts`, import the automation defaults from `@void-sector/shared` and append these entries to the `CONFIG_SEED` array:
```ts
  { key: 'AUTOMATION_MAXLEN_MK1', category: 'automation', description: 'Max Programm-Anweisungen (Computer MK.I)', getDefault: () => AUTOMATION_PROGRAM_LIMITS[1] },
  { key: 'AUTOMATION_MAXLEN_MK2', category: 'automation', description: 'Max Programm-Anweisungen (Computer MK.II)', getDefault: () => AUTOMATION_PROGRAM_LIMITS[2] },
  { key: 'AUTOMATION_MAXLEN_MK3', category: 'automation', description: 'Max Programm-Anweisungen (Computer MK.III)', getDefault: () => AUTOMATION_PROGRAM_LIMITS[3] },
  { key: 'AUTOMATION_MAXLEN_MK4', category: 'automation', description: 'Max Programm-Anweisungen (Computer MK.IV)', getDefault: () => AUTOMATION_PROGRAM_LIMITS[4] },
  { key: 'AUTOMATION_MAXLEN_MK5', category: 'automation', description: 'Max Programm-Anweisungen (Computer MK.V)', getDefault: () => AUTOMATION_PROGRAM_LIMITS[5] },
  { key: 'AUTOMATION_OFFLINE_WINDOW_HOURS_MK4', category: 'automation', description: 'Offline-Fenster Stunden (MK.IV)', getDefault: () => AUTOMATION_OFFLINE_WINDOW_HOURS_MK4 },
  { key: 'AUTOMATION_OFFLINE_WINDOW_HOURS_MK5', category: 'automation', description: 'Offline-Fenster Stunden (MK.V)', getDefault: () => AUTOMATION_OFFLINE_WINDOW_HOURS_MK5 },
  { key: 'AUTOMATION_MAX_CONCURRENT_OFFLINE', category: 'automation', description: 'Max gleichzeitige Offline-Programme im Scheduler', getDefault: () => AUTOMATION_MAX_CONCURRENT_OFFLINE },
  { key: 'AUTOMATION_TICK_WORK_BUDGET', category: 'automation', description: 'Max Instruktions-Schritte pro Scheduler-Tick', getDefault: () => AUTOMATION_TICK_WORK_BUDGET },
  { key: 'AUTOMATION_SCHEDULER_INTERVAL_MS', category: 'automation', description: 'Scheduler-Tick-Intervall (ms)', getDefault: () => AUTOMATION_SCHEDULER_INTERVAL_MS },
```
Add the imports to the existing `import { ... } from '@void-sector/shared';` in that file: `AUTOMATION_PROGRAM_LIMITS, AUTOMATION_OFFLINE_WINDOW_HOURS_MK4, AUTOMATION_OFFLINE_WINDOW_HOURS_MK5, AUTOMATION_MAX_CONCURRENT_OFFLINE, AUTOMATION_TICK_WORK_BUDGET, AUTOMATION_SCHEDULER_INTERVAL_MS`.

- [ ] **Step 4: Build shared first (server depends on it), then run tests** —
```bash
cd packages/shared && npm run build && npx vitest run src/automation/__tests__/configDefaults.test.ts
cd ../server && npx vitest run src/__tests__/automationConfigSeed.test.ts && npm run build
```
Expected: both test files PASS, both builds exit 0.

- [ ] **Step 5: Commit**
```bash
git add packages/shared/src/automation/types.ts packages/shared/dist packages/server/src/engine/gameConfigSeed.ts packages/shared/src/automation/__tests__/configDefaults.test.ts packages/server/src/__tests__/automationConfigSeed.test.ts
git commit -m "feat: AUTOMATION game_config defaults + seed (limits, offline windows, scheduler caps)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migration 099 — program tables (server)

**Files:** create `packages/server/src/db/migrations/099_ship_programs.sql`; test `packages/server/src/__tests__/migration099.test.ts`.

- [ ] **Step 1: Write the failing test** — create `packages/server/src/__tests__/migration099.test.ts` (lightweight static check — no DB needed):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('migration 099 ship_programs', () => {
  const sql = readFileSync(join(__dirname, '../db/migrations/099_ship_programs.sql'), 'utf-8');
  it('creates the three program tables idempotently', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ship_programs');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ship_program_state');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ship_program_logs');
  });
  it('keys runtime state by player_id and stores vm_state JSONB', () => {
    expect(sql).toMatch(/ship_program_state[\s\S]*player_id\s+VARCHAR\(255\)\s+PRIMARY KEY/);
    expect(sql).toMatch(/vm_state\s+JSONB/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd packages/server && npx vitest run src/__tests__/migration099.test.ts` → FAIL (file missing).

- [ ] **Step 3: Implement** — create `packages/server/src/db/migrations/099_ship_programs.sql`:

```sql
-- Migration 099: Programmable Ship — program definitions, runtime VM state, execution logs.

CREATE TABLE IF NOT EXISTS ship_programs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id   VARCHAR(255) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  source      TEXT NOT NULL,
  mode        VARCHAR(8) NOT NULL DEFAULT 'loop',   -- 'once' | 'loop'
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, name)
);

CREATE TABLE IF NOT EXISTS ship_program_state (
  player_id     VARCHAR(255) PRIMARY KEY,
  program_id    TEXT NOT NULL,
  pc            INT NOT NULL DEFAULT 0,
  vm_state      JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(12) NOT NULL DEFAULT 'idle', -- idle|running|paused|drift|error
  paused_reason TEXT,
  last_tick     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ship_program_logs (
  id         BIGSERIAL PRIMARY KEY,
  player_id  VARCHAR(255) NOT NULL,
  program_id TEXT,
  ts         TIMESTAMP NOT NULL DEFAULT NOW(),
  level      VARCHAR(8) NOT NULL DEFAULT 'info',    -- info|warn|error
  message    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ship_programs_player ON ship_programs(player_id);
CREATE INDEX IF NOT EXISTS idx_ship_programs_active ON ship_programs(player_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ship_program_logs_player ON ship_program_logs(player_id, ts DESC);
```

- [ ] **Step 4: Run test** — `cd packages/server && npx vitest run src/__tests__/migration099.test.ts` → PASS.

- [ ] **Step 5: (Best-effort) apply against local Docker postgres if running** — if `docker ps` shows `voidsector-postgres-1`:
```bash
docker exec -i voidsector-postgres-1 bash -c 'psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB' < packages/server/src/db/migrations/099_ship_programs.sql
```
Expected: `CREATE TABLE`/`CREATE INDEX` lines, no errors. If Docker isn't running, skip — the migration auto-runs on server startup; report that you skipped.

- [ ] **Step 6: Commit**
```bash
git add packages/server/src/db/migrations/099_ship_programs.sql packages/server/src/__tests__/migration099.test.ts
git commit -m "feat: migration 099 — ship program tables (programs/state/logs)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: programQueries.ts (server)

**Files:** create `packages/server/src/db/programQueries.ts`; test `packages/server/src/__tests__/programQueries.test.ts`.

Follows the repo pattern: `vi.mock('../db/client.js', () => ({ query: vi.fn() }))`, assert SQL fragments + params.

- [ ] **Step 1: Write the failing test** — create `packages/server/src/__tests__/programQueries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

async function fresh() {
  vi.resetModules();
  const { query } = await import('../db/client.js');
  const q = await import('../db/programQueries.js');
  return { query: vi.mocked(query), q };
}

describe('programQueries', () => {
  it('createProgram inserts source/mode and returns the row', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [{ id: 'p1', player_id: 'u1', name: 'Loop', source: 'scan', mode: 'loop', is_active: false }] } as any);
    const row = await q.createProgram('u1', 'Loop', 'scan', 'loop');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ship_programs'), ['u1', 'Loop', 'scan', 'loop']);
    expect(row.id).toBe('p1');
  });

  it('listProgramsForPlayer selects by player ordered', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.listProgramsForPlayer('u1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM ship_programs WHERE player_id = $1'), ['u1']);
  });

  it('setActiveProgram clears others then activates one (transactional intent)', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.setActiveProgram('u1', 'p1');
    const sqls = query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes('UPDATE ship_programs SET is_active = FALSE'))).toBe(true);
    expect(sqls.some((s) => s.includes('is_active = TRUE'))).toBe(true);
  });

  it('saveProgramState upserts keyed by player_id', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.saveProgramState('u1', { programId: 'p1', pc: 3, vmState: { loops: [] }, status: 'running', pausedReason: null });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ship_program_state'), expect.arrayContaining(['u1', 'p1', 3]));
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (player_id)');
  });

  it('getActiveProgramState returns null when absent', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    expect(await q.getActiveProgramState('u1')).toBeNull();
  });

  it('appendProgramLog inserts a log row', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.appendProgramLog('u1', 'p1', 'info', 'gestartet');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ship_program_logs'), ['u1', 'p1', 'info', 'gestartet']);
  });

  it('getOfflineActivePrograms joins active programs with running/paused state', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.getOfflineActivePrograms();
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ship_program_state');
    expect(sql).toContain("status IN ('running', 'paused')");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd packages/server && npx vitest run src/__tests__/programQueries.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — create `packages/server/src/db/programQueries.ts`:

```ts
import { query } from './client.js';

export interface ShipProgramRow {
  id: string;
  player_id: string;
  name: string;
  source: string;
  mode: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProgramStateRow {
  player_id: string;
  program_id: string;
  pc: number;
  vm_state: unknown;
  status: string;
  paused_reason: string | null;
  last_tick?: string;
}

export interface ProgramStateInput {
  programId: string;
  pc: number;
  vmState: unknown;
  status: string;
  pausedReason: string | null;
}

export async function createProgram(
  playerId: string,
  name: string,
  source: string,
  mode: string,
): Promise<ShipProgramRow> {
  const { rows } = await query<ShipProgramRow>(
    `INSERT INTO ship_programs (player_id, name, source, mode)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id, name)
     DO UPDATE SET source = EXCLUDED.source, mode = EXCLUDED.mode, updated_at = NOW()
     RETURNING *`,
    [playerId, name, source, mode],
  );
  return rows[0];
}

export async function listProgramsForPlayer(playerId: string): Promise<ShipProgramRow[]> {
  const { rows } = await query<ShipProgramRow>(
    'SELECT * FROM ship_programs WHERE player_id = $1 ORDER BY updated_at DESC',
    [playerId],
  );
  return rows;
}

export async function getProgram(id: string): Promise<ShipProgramRow | null> {
  const { rows } = await query<ShipProgramRow>('SELECT * FROM ship_programs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function deleteProgram(playerId: string, id: string): Promise<void> {
  await query('DELETE FROM ship_programs WHERE id = $1 AND player_id = $2', [id, playerId]);
}

export async function setActiveProgram(playerId: string, programId: string): Promise<void> {
  await query('UPDATE ship_programs SET is_active = FALSE WHERE player_id = $1', [playerId]);
  await query('UPDATE ship_programs SET is_active = TRUE WHERE id = $1 AND player_id = $2', [programId, playerId]);
}

export async function saveProgramState(playerId: string, s: ProgramStateInput): Promise<void> {
  await query(
    `INSERT INTO ship_program_state (player_id, program_id, pc, vm_state, status, paused_reason, last_tick)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (player_id) DO UPDATE SET
       program_id = EXCLUDED.program_id, pc = EXCLUDED.pc, vm_state = EXCLUDED.vm_state,
       status = EXCLUDED.status, paused_reason = EXCLUDED.paused_reason, last_tick = NOW()`,
    [playerId, s.programId, s.pc, JSON.stringify(s.vmState), s.status, s.pausedReason],
  );
}

export async function getActiveProgramState(playerId: string): Promise<ProgramStateRow | null> {
  const { rows } = await query<ProgramStateRow>('SELECT * FROM ship_program_state WHERE player_id = $1', [playerId]);
  return rows[0] ?? null;
}

export async function clearProgramState(playerId: string): Promise<void> {
  await query('DELETE FROM ship_program_state WHERE player_id = $1', [playerId]);
}

export async function appendProgramLog(
  playerId: string,
  programId: string | null,
  level: string,
  message: string,
): Promise<void> {
  await query(
    'INSERT INTO ship_program_logs (player_id, program_id, level, message) VALUES ($1, $2, $3, $4)',
    [playerId, programId, level, message],
  );
}

export async function getRecentLogs(playerId: string, limit = 50): Promise<Array<{ ts: string; level: string; message: string }>> {
  const { rows } = await query<{ ts: string; level: string; message: string }>(
    'SELECT ts, level, message FROM ship_program_logs WHERE player_id = $1 ORDER BY ts DESC LIMIT $2',
    [playerId, limit],
  );
  return rows;
}

/** Active programs whose runtime state is running/paused — the offline scheduler's work-list (Plan 3). */
export async function getOfflineActivePrograms(): Promise<ProgramStateRow[]> {
  const { rows } = await query<ProgramStateRow>(
    `SELECT st.* FROM ship_program_state st
     JOIN ship_programs p ON p.id = st.program_id AND p.is_active = TRUE
     WHERE st.status IN ('running', 'paused')`,
  );
  return rows;
}
```

- [ ] **Step 4: Run test + build server** — `cd packages/server && npx vitest run src/__tests__/programQueries.test.ts` → PASS; `npm run build` → tsc exit 0.

- [ ] **Step 5: Commit**
```bash
git add packages/server/src/db/programQueries.ts packages/server/src/__tests__/programQueries.test.ts
git commit -m "feat: programQueries — ship program CRUD, state, logs persistence

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§2 module/gating data, §4 data model):**
- `computer` module MK.I–V, slot trade-off → Tasks 1, 2. ✅
- Read computer level from installed modules → Task 3. ✅
- AUTOMATION tuning in game_config (limits, offline windows, scheduler caps) → Task 4. ✅
- Migration 099 (programs/state/logs) → Task 5. ✅
- Program persistence queries + offline work-list → Task 6. ✅
- Deferred (correctly): runtime VM/executor/scheduler (Plan 3), AUTOMAT UI + starter-ship computer pre-install + onboarding (Plan 4).

**Placeholder scan:** Tasks 1/2/4 ask the implementer to confirm exact existing shapes (`ModuleSource` literal, `CONFIG_SEED` export, any extra count/category assertions) and update — these are bounded "match the codebase" verifications with the build/test as the gate, not vague TODOs.

**Type/contract consistency:** `getShipComputerLevel(modules)` signature stable (Task 3, used by Plan 3/4). `programQueries` row/input interfaces (`ShipProgramRow`, `ProgramStateRow`, `ProgramStateInput`) defined once (Task 6). Migration 099 schema (Task 5) matches what `saveProgramState`/`getOfflineActivePrograms` (Task 6) and Plan 3's VM expect (`player_id` PK, `vm_state` JSONB, `pc`, `status`).

**Risk notes:** (a) Client `DRAW_ROUTINES` Record will be tsc-incomplete for `'computer'` — non-blocking (client uses Vite/vitest), fixed in Plan 4. (b) Computer needs ACEP ausbau lvl 2 to install via the normal flow → early-game access handled by pre-installing `computer_mk1` on the starter ship in Plan 4.
