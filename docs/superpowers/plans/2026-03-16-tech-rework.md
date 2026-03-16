# TECH REWORK Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all modules, the tech tree, and the combat system with Combat V3 (Energy-based, 3 weapon types, module HP, Armor buffer) and 10 independent tech tree branches.

**Architecture:** Clean-slate DB (no migration). New `moduleDefinitions.ts` and `researchDefinitions.ts` as source of truth. Pure `combatV3Engine.ts` for combat logic. `CombatV3Service` replaces `CombatService`. Ship calculator rewritten to derive stats from new modules. TechTreeScreen replaces radial TechTreeCanvas with collapsible branch layout.

**Tech Stack:** TypeScript, PostgreSQL, Colyseus, Vitest, React/Zustand, Canvas 2D

**Spec:** `docs/superpowers/specs/2026-03-16-tech-rework-design.md`
**Tech Tree:** `docs/tech-tree-v2.md`

**BREAKING CHANGE:** Full DB wipe after this rework. No migration from old data.

---

## Chunk 1: Module & Research Definitions

### Task 1: Module definitions constant

**Files:**
- Create: `packages/shared/src/moduleDefinitions.ts`

All 60 modules from `docs/tech-tree-v2.md` + `Techs.ods` values as a typed constant array. Each entry follows the `ModuleDefinition` interface from the spec (section 1.2). Group by category. Include all cost, stat, and prerequisite data.

- [ ] **Step 1: Create moduleDefinitions.ts** with the `ModuleDefinition` interface and the `MODULE_DEFINITIONS` array. Use the exact values from `docs/tech-tree-v2.md` tables and `Techs.ods` spreadsheet for costs, AP, energy, HP, and category-specific stats. Export both the interface and the array.

Key categories and their stats fields:
```ts
// drive: {jumpDistance, rechargeRate, fuelCapacity, fuelPerSector, msPerSector}
// generator: {apRegen, energyPerRound} — apRegen negative = generates
// mining: {miningSpeed}
// cargo: {cargoCapacity}
// scanner: {scanRange}
// repair: {repairRate}
// armor: {hitpoints, shieldBonus?, damageReduction?}
// shield: {shield, regen, damageReduction?}
// weapon_energy: {atk, energyCostPerRound}
// weapon_kinetic: {atk, piercing}
// weapon_missile: {atk}
// defense_pv: {interceptChance}
// defense_ecm: {accuracyReduction}
```

- [ ] **Step 2: Write test** `packages/shared/src/__tests__/moduleDefinitions.test.ts`
```ts
describe('MODULE_DEFINITIONS', () => {
  it('has 60 modules', () => { expect(MODULE_DEFINITIONS).toHaveLength(60); });
  it('all have required fields', () => {
    for (const m of MODULE_DEFINITIONS) {
      expect(m.id).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.tier).toBeGreaterThan(0);
      expect(m.hitpoints).toBeGreaterThan(0);
    }
  });
  it('Ion Drive Mk1 has correct stats', () => {
    const m = MODULE_DEFINITIONS.find(m => m.id === 'ion_drive_mk1')!;
    expect(m.tier).toBe(1);
    expect(m.stats.jumpDistance).toBe(32);
    expect(m.costCredits).toBe(250);
  });
  it('found-only modules have isFoundOnly=true', () => {
    const found = MODULE_DEFINITIONS.filter(m => m.isFoundOnly);
    expect(found.length).toBe(13);
  });
});
```

- [ ] **Step 3: Run tests**
```bash
cd packages/shared && npx vitest run src/__tests__/moduleDefinitions.test.ts
```

- [ ] **Step 4: Commit**
```bash
git commit -am "feat: #508 module definitions — 60 modules across 10 categories"
```

---

### Task 2: Research definitions constant

**Files:**
- Create: `packages/shared/src/researchDefinitions.ts`

All 52 research nodes from `docs/tech-tree-v2.md`. Each node has: id, name, branch, description, effect (bonus object), wissenCost, prerequisiteModuleId, optional prerequisiteResearchId.

- [ ] **Step 1: Create researchDefinitions.ts** with `ResearchNode` interface and `RESEARCH_DEFINITIONS` array. 52 entries grouped by branch.

Effect format examples:
```ts
// {jumpDistanceBonus: 0.2}      = +20% jump distance
// {miningSpeedBonus: 0.2}       = +20% mining speed
// {shieldRegenMultiplier: 1.5}  = +50% shield regen
// {accuracyBonus: 0.1}          = +10% accuracy
```

- [ ] **Step 2: Write test** `packages/shared/src/__tests__/researchDefinitions.test.ts`
```ts
describe('RESEARCH_DEFINITIONS', () => {
  it('has 52 research nodes', () => { expect(RESEARCH_DEFINITIONS).toHaveLength(52); });
  it('all reference valid branches', () => {
    const branches = new Set(['engines','generators','mining','cargo','scanner','repair','armor','shields','weapon_energy','weapon_kinetic','weapon_missile','defense_pv','defense_ecm']);
    for (const r of RESEARCH_DEFINITIONS) expect(branches.has(r.branch)).toBe(true);
  });
  it('all have wissenCost of 10', () => {
    for (const r of RESEARCH_DEFINITIONS) expect(r.wissenCost).toBe(10);
  });
});
```

- [ ] **Step 3: Run + commit**
```bash
git commit -am "feat: #508 research definitions — 52 nodes across all branches"
```

---

### Task 3: Shared types — new interfaces

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new interfaces** (after existing combat types):
```ts
// Combat V3
interface CombatV3State { round, maxRounds, playerShield/Max/Regen, playerArmorHp/Max, playerModules: CombatModule[], playerEnergyBudget, playerTactic, enemy*, outcome? }
interface CombatModule { moduleId, name, category, hp, maxHp, active, energyCost, stats }
interface CombatV3RoundResult { round, playerDamageDealt, enemyDamageDealt, playerShield, enemyShield, playerArmorHp, enemyArmorHp, modulesDestroyed: string[], roundLog: string[] }
interface NpcCombatStats { energy, shield, shieldRegen, armorHp, weapons: {type, atk}[], accuracy, pvIntercept, ecmReduction }
```

- [ ] **Step 2: Build shared**
```bash
cd packages/shared && npm run build
```

- [ ] **Step 3: Commit**
```bash
git commit -am "feat: #508 shared types — CombatV3State, CombatModule, NpcCombatStats"
```

---

### Task 4: DB migration (clean install)

**Files:**
- Create: `packages/server/src/db/migrations/078_tech_rework.sql`

- [ ] **Step 1: Write migration**
```sql
-- Module definitions (seeded from constants)
CREATE TABLE IF NOT EXISTS module_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier INTEGER NOT NULL,
  slot TEXT NOT NULL,
  cost_credits INTEGER DEFAULT 0,
  cost_ore INTEGER DEFAULT 0,
  cost_gas INTEGER DEFAULT 0,
  cost_crystal INTEGER DEFAULT 0,
  cost_artefact TEXT DEFAULT '0',
  ap_cost REAL DEFAULT 0,
  energy_cost REAL DEFAULT 0,
  hitpoints INTEGER DEFAULT 20,
  stats JSONB NOT NULL DEFAULT '{}',
  description TEXT DEFAULT '',
  is_found_only BOOLEAN DEFAULT FALSE,
  is_unique BOOLEAN DEFAULT FALSE,
  prerequisite_module_id TEXT
);

-- Research definitions
CREATE TABLE IF NOT EXISTS research_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  description TEXT DEFAULT '',
  effect JSONB NOT NULL DEFAULT '{}',
  wissen_cost INTEGER DEFAULT 10,
  prerequisite_module_id TEXT,
  prerequisite_research_id TEXT
);

-- Player research progress
CREATE TABLE IF NOT EXISTS player_research_v2 (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  researched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, node_id)
);

-- Player installed modules (new slot system)
CREATE TABLE IF NOT EXISTS player_modules_v2 (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  current_hp INTEGER NOT NULL,
  installed BOOLEAN DEFAULT TRUE,
  UNIQUE(player_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_player_modules_v2_player ON player_modules_v2(player_id);
CREATE INDEX IF NOT EXISTS idx_player_research_v2_player ON player_research_v2(player_id);
```

- [ ] **Step 2: Commit**
```bash
git commit -am "feat: #508 migration 078 — tech rework tables (clean install)"
```

---

## Chunk 2: Combat V3 Engine (Pure Logic)

### Task 5: NPC combat stats generator

**Files:**
- Create: `packages/server/src/engine/npcCombatStats.ts`
- Create: `packages/server/src/__tests__/npcCombatStats.test.ts`

- [ ] **Step 1: Write tests**
```ts
describe('generateNpcCombatStats', () => {
  it('level 1 has basic stats', () => {
    const s = generateNpcCombatStats(1);
    expect(s.energy).toBe(80);
    expect(s.shield).toBe(80);
    expect(s.armorHp).toBe(160);
    expect(s.weapons).toHaveLength(1);
    expect(s.weapons[0].atk).toBe(11);
  });
  it('level 5 has PV and 2 weapons', () => {
    const s = generateNpcCombatStats(5);
    expect(s.pvIntercept).toBe(0.25);
    expect(s.weapons).toHaveLength(2);
  });
  it('level 7 has ECM', () => {
    const s = generateNpcCombatStats(7);
    expect(s.ecmReduction).toBe(0.10);
  });
  it('level 10 is the strongest', () => {
    const s = generateNpcCombatStats(10);
    expect(s.energy).toBe(350);
    expect(s.shield).toBe(800);
    expect(s.armorHp).toBe(700);
  });
});
```

- [ ] **Step 2: Implement** — direct formula from spec section 4.

- [ ] **Step 3: Run + commit**

---

### Task 6: Combat V3 engine — core round resolution

**Files:**
- Create: `packages/server/src/engine/combatV3Engine.ts`
- Create: `packages/server/src/__tests__/combatV3Engine.test.ts`

This is the most critical file. Pure functions, no side effects.

- [ ] **Step 1: Write tests for initCombatV3**
```ts
describe('initCombatV3', () => {
  it('initializes from player modules and NPC stats', () => {
    const state = initCombatV3(mockPlayerModules, mockNpcStats);
    expect(state.round).toBe(0);
    expect(state.maxRounds).toBe(10);
    expect(state.playerShield).toBeGreaterThan(0);
    expect(state.playerArmorHp).toBeGreaterThan(0);
    expect(state.playerEnergyBudget).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Write tests for energy validation**
```ts
describe('validateEnergyBudget', () => {
  it('rejects if active modules exceed budget', () => {
    const result = validateEnergyBudget(state, ['weapon1', 'shield1']); // total > budget
    expect(result.valid).toBe(false);
  });
  it('accepts if within budget', () => {
    const result = validateEnergyBudget(state, ['weapon1']);
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 3: Write tests for damage pipeline**
```ts
describe('resolveDamage', () => {
  it('energy weapon deals 100% to shield', () => {
    const result = resolveDamage({ type: 'energy', atk: 100 }, target, 1.0);
    expect(result.shieldDamage).toBe(100);
    expect(result.armorDamage).toBe(0);
  });
  it('kinetic weapon deals 25% to shield, 75% to hull', () => {
    const result = resolveDamage({ type: 'kinetic', atk: 100, piercing: 0.5 }, target, 1.0);
    expect(result.shieldDamage).toBe(25);
    expect(result.hullDamage).toBeGreaterThan(0);
  });
  it('missile can be intercepted by PV', () => {
    const result = resolveDamage({ type: 'missile', atk: 100 }, targetWithPV, 1.0);
    // PV has 30% intercept — test with seed that hits/misses
  });
  it('armor absorbs hull damage before modules', () => {
    const result = resolveDamage({ type: 'energy', atk: 500 }, targetNoShield, 1.0);
    expect(result.armorDamage).toBeGreaterThan(0);
  });
  it('piercing bypasses armor to hit modules directly', () => {
    const result = resolveDamage({ type: 'kinetic', atk: 100, piercing: 0.5 }, targetNoShield, 1.0);
    expect(result.moduleDamage).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Write tests for round resolution**
```ts
describe('resolveRoundV3', () => {
  it('both sides fire and take damage', () => {
    const {newState, roundResult} = resolveRoundV3(state, {activeModules: [...], tactic: 'balanced'}, seed);
    expect(roundResult.round).toBe(1);
    expect(roundResult.playerDamageDealt).toBeGreaterThan(0);
  });
  it('tactic assault gives +25% weapon damage', () => {
    const assault = resolveRoundV3(state, {activeModules, tactic: 'assault'}, seed);
    const balanced = resolveRoundV3(state, {activeModules, tactic: 'balanced'}, seed);
    expect(assault.roundResult.playerDamageDealt).toBeGreaterThan(balanced.roundResult.playerDamageDealt);
  });
  it('shield regenerates each round', () => {
    const damagedState = {...state, playerShield: 50}; // max 200, regen 6
    const {newState} = resolveRoundV3(damagedState, input, seed);
    expect(newState.playerShield).toBeGreaterThanOrEqual(56);
  });
  it('module at 0 HP is deactivated', () => {
    // Set up state where a module takes lethal damage
    const {newState} = resolveRoundV3(stateWithWeakModule, input, seed);
    const destroyed = newState.playerModules.find(m => m.hp <= 0);
    expect(destroyed?.active).toBe(false);
  });
  it('all modules destroyed = defeat', () => {
    const {newState} = resolveRoundV3(nearDeathState, input, seed);
    expect(newState.outcome).toBe('defeat');
  });
});
```

- [ ] **Step 5: Write tests for flee**
```ts
describe('attemptFleeV3', () => {
  it('cannot flee round 1', () => {
    expect(attemptFleeV3({...state, round: 1}, seed).success).toBe(false);
  });
  it('can flee from round 2', () => {
    // With controlled seed for 60% chance
  });
});
```

- [ ] **Step 6: Implement combatV3Engine.ts**

Core functions:
```ts
export function initCombatV3(playerModules: CombatModule[], npcStats: NpcCombatStats): CombatV3State
export function validateEnergyBudget(state: CombatV3State, activeModuleIds: string[]): { valid: boolean; error?: string }
export function resolveRoundV3(state: CombatV3State, input: { activeModules: string[]; tactic: string }, seed: number): { newState: CombatV3State; roundResult: CombatV3RoundResult }
export function attemptFleeV3(state: CombatV3State, seed: number): { success: boolean; newState: CombatV3State }
```

The damage pipeline (internal):
```ts
function resolveDamage(weapon, target, accuracyMod, pvIntercept, seed): DamageResult
function applyDamageToTarget(target, damageResult): void  // mutates target shield/armor/modules
function selectRepairTarget(modules): CombatModule | null  // lowest HP% module
```

- [ ] **Step 7: Run all tests**
```bash
cd packages/server && npx vitest run src/__tests__/combatV3Engine.test.ts src/__tests__/npcCombatStats.test.ts
```

- [ ] **Step 8: Commit**
```bash
git commit -am "feat: #508 Combat V3 engine — damage pipeline, round resolution, energy validation"
```

---

## Chunk 3: Ship Calculator & Service

### Task 7: Ship calculator rewrite

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts` (full rewrite, keep function signatures compatible where possible)

The new calculator derives exploration stats from V2 modules.

- [ ] **Step 1: Write tests** `packages/shared/src/__tests__/shipCalculatorV2.test.ts`
```ts
describe('calculateShipStats (V2)', () => {
  it('default ship with Fusion Cell Mk1 + Ion Drive Mk1', () => {
    const stats = calculateShipStats([
      {moduleId: 'fusion_cell_mk1', slot: 'generator'},
      {moduleId: 'ion_drive_mk1', slot: 'engine'},
    ]);
    expect(stats.apRegen).toBe(4);
    expect(stats.jumpDistance).toBe(32);
    expect(stats.fuelCapacity).toBe(2000);
  });
  it('sums cargo capacity', () => {
    const stats = calculateShipStats([
      {moduleId: 'fusion_cell_mk1', slot: 'generator'},
      {moduleId: 'ion_drive_mk1', slot: 'engine'},
      {moduleId: 'cargo_bay_mk3', slot: 'cargo'},
    ]);
    expect(stats.cargoCap).toBe(120); // base 20 + 100
  });
  it('derives combat stats (energy budget, shield, armor)', () => {
    const stats = calculateShipStats([
      {moduleId: 'fusion_cell_mk3', slot: 'generator'},
      {moduleId: 'ion_drive_mk1', slot: 'engine'},
      {moduleId: 'schild_gen_mk2', slot: 'shield'},
      {moduleId: 'armor_plating_mk1', slot: 'armor'},
    ]);
    expect(stats.energyBudget).toBe(200);
    expect(stats.shieldHp).toBe(200);
    expect(stats.armorHp).toBe(200);
  });
});
```

- [ ] **Step 2: Rewrite `calculateShipStats`** — reads from `MODULE_DEFINITIONS` lookup by moduleId, sums category-specific stats, returns both exploration and combat stats.

- [ ] **Step 3: Run tests + commit**
```bash
git commit -am "feat: #508 ship calculator rewrite — derives stats from new module definitions"
```

---

### Task 8: CombatV3Service (server)

**Files:**
- Create: `packages/server/src/rooms/services/CombatV3Service.ts`

- [ ] **Step 1: Create service** with handlers:
```ts
class CombatV3Service {
  constructor(private ctx: ServiceContext) {}

  // In-memory combat sessions
  private sessions = new Map<string, { state: CombatV3State; npcStats: NpcCombatStats }>();

  async handleCombatV3Start(client, data: { npcLevel: number; npcId?: number }): Promise<void>
  // - Load player's installed modules from DB
  // - Generate NPC stats from level
  // - Init combat state
  // - Store in sessions map
  // - Send 'combatV3Start' to client

  async handleCombatV3Action(client, data: { activeModules: string[]; tactic: string }): Promise<void>
  // - Validate energy budget
  // - Resolve round
  // - Check outcome (victory/defeat/draw)
  // - On victory: generate loot, handle NPC death (outlaw dead_until)
  // - On defeat: set all modules to 50% HP in DB
  // - Send 'combatV3Round' to client

  async handleCombatV3Flee(client): Promise<void>
  // - Attempt flee
  // - On fail: enemy gets free attack round
  // - Send result
}
```

- [ ] **Step 2: Register in SectorRoom** — add message handlers `combatV3Start`, `combatV3Action`, `combatV3Flee`

- [ ] **Step 3: Commit**
```bash
git commit -am "feat: #508 CombatV3Service — start, action, flee handlers"
```

---

## Chunk 4: Tech Tree UI

### Task 9: Tech tree data queries

**Files:**
- Create: `packages/server/src/db/techTreeQueries.ts`

- [ ] **Step 1: Implement queries**
```ts
export async function getPlayerResearch(playerId: string): Promise<string[]>
// Returns array of researched node IDs

export async function addPlayerResearch(playerId: string, nodeId: string): Promise<void>
// Insert into player_research_v2

export async function getPlayerModules(playerId: string): Promise<PlayerModule[]>
// Returns installed modules with current_hp

export async function installPlayerModule(playerId: string, moduleId: string, slot: string, maxHp: number): Promise<void>
export async function removePlayerModule(playerId: string, slot: string): Promise<void>
export async function updateModuleHp(playerId: string, slot: string, hp: number): Promise<void>
export async function setAllModulesHpPercent(playerId: string, percent: number): Promise<void>
// After defeat: set all to 50%

export async function seedDefinitions(): Promise<void>
// Inserts MODULE_DEFINITIONS + RESEARCH_DEFINITIONS into DB tables (idempotent)
```

- [ ] **Step 2: Commit**
```bash
git commit -am "feat: #508 tech tree DB queries — research, modules, seeding"
```

---

### Task 10: Tech tree UI — collapsible branches

**Files:**
- Create: `packages/client/src/components/TechTreeScreen.tsx` (replaces TechTreeCanvas for V2)

- [ ] **Step 1: Build component** — renders 10 collapsible branches. Each branch shows:
- Branch header (clickable to expand/collapse): "ENGINES — That's what moves you"
- Horizontal main path: module nodes connected by arrows
- Vertical research nodes branching down from main-path modules
- Node states: locked (grey), available (amber border), researched (green)
- Click on available node → spend Wissen → node becomes researched
- Research cost shown on hover

- [ ] **Step 2: Wire into AcepProgram** — add a new tab `tech` that renders `<TechTreeScreen />`

- [ ] **Step 3: Network messages** — `researchNode` message → server validates prerequisites + Wissen cost → `addPlayerResearch` → sends updated research list

- [ ] **Step 4: Commit**
```bash
git commit -am "feat: #508 TechTreeScreen — 10 collapsible branches with research flow"
```

---

## Chunk 5: Combat V3 UI

### Task 11: Combat V3 client screen

**Files:**
- Create: `packages/client/src/components/CombatV3Screen.tsx`

- [ ] **Step 1: Build component** with 4 areas:
1. **Status bar**: Player shield/armor/module HP vs Enemy shield/armor
2. **Energy management**: Module list with ON/OFF toggles, energy bar
3. **Tactic selector**: ASSAULT / BALANCED / DEFENSIVE buttons
4. **Action buttons**: [FEUERN] [FLIEHEN] (flee from round 2)
5. **Round log**: scrolling text of what happened

- [ ] **Step 2: Network integration**
```ts
// Handlers:
room.onMessage('combatV3Start', (data) => { store.setCombatV3(data.state); });
room.onMessage('combatV3Round', (data) => { store.setCombatV3(data.newState); store.addCombatLog(data.roundResult); });
room.onMessage('combatV3End', (data) => { store.setCombatV3(null); /* show outcome */ });

// Senders:
sendCombatV3Action(activeModules: string[], tactic: string)
sendCombatV3Flee()
```

- [ ] **Step 3: Add combatV3 state to gameSlice**
```ts
combatV3: CombatV3State | null;
combatV3Log: CombatV3RoundResult[];
setCombatV3: (state) => void;
addCombatV3Round: (result) => void;
```

- [ ] **Step 4: Commit**
```bash
git commit -am "feat: #508 CombatV3Screen — energy management UI, tactic selector, round log"
```

---

## Chunk 6: Repair & Integration

### Task 12: Repair system

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts` (or new RepairService method)

- [ ] **Step 1: Station repair handler**
```ts
async handleStationRepair(client): Promise<void>
// - Must be at station
// - Calculate missing HP across all modules
// - Cost = missingHp * 0.5 credits
// - Deduct credits, set all modules to max HP
```

- [ ] **Step 2: Out-of-combat passive repair** (in universe tick or lazy eval)
- If player has repair module installed: heal repair-rate HP per tick on lowest-HP module
- If "Auto-Repair" research: heal 1 HP/tick on all modules

- [ ] **Step 3: Commit**
```bash
git commit -am "feat: #508 repair system — station repair, passive repair, auto-repair research"
```

---

### Task 13: Integration — wire combat triggers

**Files:**
- Modify: `packages/server/src/rooms/services/ScanService.ts` — pirate/outlaw encounters trigger V3
- Modify: `packages/server/src/rooms/services/NpcShipService.ts` — OUTLAW attack → V3
- Modify: `packages/server/src/rooms/SectorRoom.ts` — register V3 messages, replace V2 references

- [ ] **Step 1: Update ScanService** — pirate ambush calls `combatV3Service.handleCombatV3Start` instead of V2

- [ ] **Step 2: Update NpcShipService** — `handleAttackNpc` calls V3

- [ ] **Step 3: Update SectorRoom** — register `combatV3Start`, `combatV3Action`, `combatV3Flee` messages; instantiate `CombatV3Service`

- [ ] **Step 4: Commit**
```bash
git commit -am "feat: #508 integration — pirate/outlaw encounters use Combat V3"
```

---

### Task 14: Legacy removal

**Files:**
- Remove: `packages/server/src/engine/combatV2Engine.ts`
- Modify: `packages/shared/src/constants.ts:500-1842` — remove old `MODULES` object
- Modify: `packages/server/src/rooms/services/CombatService.ts` — remove V2 handlers (keep station defense/repair if still used)
- Modify: `packages/client/src/components/TechTreeCanvas.tsx` — remove or mark deprecated (replaced by TechTreeScreen)

- [ ] **Step 1: Remove combatV2Engine.ts**
- [ ] **Step 2: Remove MODULES constant** from constants.ts (lines 500-1842)
- [ ] **Step 3: Remove V2 handlers** from CombatService (handleCombatV2Start, handleCombatV2Action, handleCombatV2Flee)
- [ ] **Step 4: Update imports** — any file importing from combatV2Engine or referencing old MODULES
- [ ] **Step 5: Run all tests** — fix broken imports/references
```bash
cd packages/server && npx vitest run
cd packages/shared && npx vitest run
```
- [ ] **Step 6: Commit**
```bash
git commit -am "feat: #509 remove legacy — old modules, combat V2, radial tech tree"
```

---

### Task 15: Final build + push

- [ ] **Step 1: Build shared**
```bash
cd packages/shared && npm run build
```

- [ ] **Step 2: Run all server tests**
```bash
cd packages/server && npx vitest run
```

- [ ] **Step 3: Run all shared tests**
```bash
cd packages/shared && npx vitest run
```

- [ ] **Step 4: Push**
```bash
git push origin feat/508-tech-rework
```
