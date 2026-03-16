# TECH REWORK II — Modul- & Kampfsystem V3

**Issues:** #508, #509
**Date:** 2026-03-16
**Status:** Draft
**Depends on:** `docs/tech-tree-v2.md` (10 Branches, 60 Module, 52 Forschungen, 13 Found-Only)

---

## Overview

Complete replacement of the module system and combat engine. All legacy modules are removed. The tech tree becomes 10 independent branches (no shared root). Combat V2 is replaced by Combat V3 with an Energy-based resource system, three weapon types with a rock-paper-scissors counter mechanic, and per-module HP with Armor as a primary hull buffer.

**Breaking change:** Full DB wipe — no migration from old data. Game starts fresh after this rework.

---

## 1. Module System

### 1.1 Module Categories

10 categories, each its own tech tree branch:

| # | Category | Slot | Tiers | Role |
|---|----------|------|-------|------|
| 1 | drive | ENGINE | 1-6 | Movement, Jump, Fuel |
| 2 | generator | GENERATOR | 1-6 | AP regen, Energy production |
| 3 | mining | MINING | 1-5 | Resource extraction |
| 4 | cargo | CARGO | 1-5 | Carry capacity |
| 5 | scanner | SCANNER | 1-5 | Scan range, detection |
| 6 | repair | REPAIR | 1-5 | Module HP restoration |
| 7 | armor | ARMOR | 1-5 | Hull HP buffer |
| 8 | shield | SHIELD | 1-5 | Energy damage absorption |
| 9 | weapon_energy / weapon_kinetic / weapon_missile | WEAPON (×2 slots) | 1-5 | Damage dealing |
| 10 | defense (PV / ECM) | DEFENSE | 2-4 | Missile interception, accuracy reduction |

### 1.2 Module Stats

Every module has these fields:

```ts
interface ModuleDefinition {
  id: string;                    // e.g. 'ion_drive_mk1'
  name: string;                  // e.g. 'Ion Drive Mk1'
  category: ModuleCategory;
  tier: number;                  // 1-6
  slot: ShipSlot;
  // Costs (to purchase/craft)
  costCredits: number;
  costOre: number;
  costGas: number;
  costCrystal: number;
  costArtefact: number;          // can be typed artefact e.g. "20 Engine Artefact"
  // Combat stats
  apCost: number;                // AP/s consumed during exploration (negative = generates)
  energyCost: number;            // Energy/round consumed in combat (negative = generates)
  hitpoints: number;             // Module HP (destroyed at 0)
  // Category-specific stats
  stats: Record<string, number>; // e.g. {atk: 28, piercing: 0.5} or {shield: 400, regen: 12}
  // Metadata
  description: string;
  isFoundOnly: boolean;          // true = cannot be purchased, only found
  isUnique: boolean;             // true = only one per ship
  prerequisiteModuleId?: string; // previous module in tech tree main path
  prerequisiteResearchIds?: string[]; // required research nodes
}
```

### 1.3 Ship Slots

```
GENERATOR  [1 slot]   — exactly one, always occupied (Fusion Cell Mk1 default)
ENGINE     [1 slot]   — exactly one (Ion Drive Mk1 default)
WEAPON     [2 slots]  — any weapon type, can mix
SHIELD     [1 slot]
ARMOR      [1 slot]
SCANNER    [1 slot]   — unique per ship
MINING     [1 slot]
CARGO      [1 slot]
REPAIR     [1 slot]
DEFENSE    [1 slot]   — PV or ECM, not both
```

**Total: 10 slots.** ACEP AUSBAU path unlocks +1 slot at certain levels (existing mechanic retained).

### 1.4 Exploration Stats (derived from modules)

| Stat | Source | Used for |
|------|--------|----------|
| AP Regen | Generator apCost (negative = generates) | All actions: move, scan, mine, build |
| Fuel Capacity | Drive stats.fuelCapacity | Hyperjump range |
| Fuel/Sector | Drive stats.fuelPerSector | Movement cost |
| Jump Distance | Drive stats.jumpDistance | Hyperdrive range |
| Recharge Rate | Drive stats.rechargeRate | Hyperdrive recovery |
| Scan Range | Scanner stats.scanRange | Local/Area scan radius |
| Mining Speed | Mining stats.miningSpeed | Resource extraction rate |
| Cargo Cap | Base 20 + Cargo stats.cargoCapacity | How much can be carried |
| Scanner Memory | Base 10 (unchanged) | Data slate slots |

### 1.5 Combat Stats (derived from modules)

| Stat | Source | Used for |
|------|--------|----------|
| Energy Budget | Generator energyCost (negative = produces) | Powers all combat modules per round |
| Shield HP | Shield stats.shield | Absorbs damage before hull |
| Shield Regen | Shield stats.regen | HP recovered per round |
| Armor HP | Armor stats.hitpoints | Primary hull buffer |
| Weapon ATK | Weapon stats.atk | Damage per round |
| Weapon Type | Weapon category | Energy/Kinetic/Missile |
| Piercing % | Weapon stats.piercing | Kinetic: ignores armor |
| PV Intercept | Defense stats.interceptChance | Missile block chance |
| ECM Reduction | Defense stats.accuracyReduction | Enemy accuracy penalty |
| Module HP | Each module's hitpoints | Module survives damage |

---

## 2. Tech Tree

### 2.1 Structure

10 independent branches, no shared root. Each branch has:
- **Main path** (horizontal): Module upgrades Mk1 → Mk2 → ... → MkN
- **Research nodes** (vertical): Passive bonuses branching off main-path modules
- **Found-Only items**: Not in the tree, discovered in deep space / alien quadrants

Full tree definition: `docs/tech-tree-v2.md`

### 2.2 Research Node Data

```ts
interface ResearchNode {
  id: string;                    // e.g. 'engine_jump_enhancer'
  name: string;                  // e.g. 'Jump Enhancer'
  branch: string;                // e.g. 'engines'
  description: string;
  effect: Record<string, number | string>;  // e.g. {jumpDistanceBonus: 0.2}
  wissenCost: number;            // initially 10 for all
  prerequisiteModuleId: string;  // which main-path module unlocks this
  prerequisiteResearchId?: string; // chain: research that must come first
}
```

### 2.3 Unlocking Flow

1. Player spends **Wissen** to research a main-path module → module becomes available to purchase
2. Purchasing requires **Credits + Resources** (per module cost table)
3. Research nodes branch off main-path modules → spend Wissen to activate passive bonus
4. Research chains: some nodes require a previous research (e.g. OverCharge requires Recharge Enhancer)

### 2.4 DB Schema

```sql
-- Replaces current tech_tree / player_research tables
CREATE TABLE tech_tree_nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL CHECK (node_type IN ('module', 'research')),
  branch TEXT NOT NULL,
  name TEXT NOT NULL,
  tier INTEGER,
  data JSONB NOT NULL,              -- ModuleDefinition or ResearchNode
  prerequisite_module_id TEXT,
  prerequisite_research_id TEXT
);

CREATE TABLE player_research (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES tech_tree_nodes(id),
  researched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, node_id)
);

CREATE INDEX idx_player_research_player ON player_research(player_id);
```

---

## 3. Combat V3

### 3.1 Round Structure (max 10 rounds)

```
ROUND START
  │
  ├── 1. ENERGY PHASE
  │     Generator produces Energy (e.g. 200)
  │     Shield regenerates (regen value, modified by tactic)
  │
  ├── 2. MANAGEMENT PHASE (player input)
  │     Player sees: Energy budget vs module costs
  │     Player toggles modules ON/OFF
  │     Player selects tactic: ASSAULT / BALANCED / DEFENSIVE
  │     Constraint: total active Energy cost ≤ Energy budget
  │
  ├── 3. COMBAT PHASE (simultaneous)
  │     Both sides fire all active weapons
  │     Damage pipeline resolves (see 3.3)
  │     Active repair modules heal lowest-HP% module
  │
  └── 4. STATUS CHECK
        Ship at 0 HP (all modules destroyed) → defeat
        Enemy at 0 HP → victory
        Round 10 → draw (no loss)
        Player can flee from round 2 (60% base chance)
```

### 3.2 Tactics

| Tactic | Weapon DMG | Shield Regen | Best for |
|--------|-----------|--------------|----------|
| ASSAULT | +25% | -20% | Finishing off weakened enemy |
| BALANCED | +0% | +0% | Default, no trade-off |
| DEFENSIVE | -25% | +50% | Buying time, shield recovery |

### 3.3 Damage Pipeline

```
Weapon fires (ATK value, weapon type)
    │
    ├── ACCURACY CHECK (base 85%)
    │     Modified by: ECM (-15% per suite), research bonuses
    │     Miss → no damage
    │
    ├── MISSILE INTERCEPT (missiles only)
    │     PV intercept: 30% per PV module + Flak Field research (+15%)
    │     Intercepted → no damage
    │
    ├── SHIELD PHASE (if shield > 0)
    │     Energy weapons:  100% damage to shield
    │     Kinetic weapons:  25% to shield, 75% passes through to hull
    │     Missiles:         25% to shield, 75% passes through to hull
    │     Shield reaches 0 → excess energy-weapon damage spills to hull
    │
    └── HULL PHASE
          ARMOR absorbs first (armor HP pool)
            Energy:  100% to armor
            Kinetic: piercing% bypasses armor → direct module damage
            Missile: piercing% bypasses armor → direct module damage
          Armor at 0 → damage hits random active module
          Module at 0 HP → deactivated until repaired
          All modules at 0 → ship destroyed (defeat)
```

### 3.4 Weapon Type Summary

| Type | vs Shield | vs Hull | Special | Energy Cost |
|------|-----------|---------|---------|-------------|
| Energy (Laser) | 100% | 100% | Allrounder | High |
| Kinetic (Railgun) | 25% | 100% + Piercing bypasses Armor | Anti-hull specialist | Medium |
| Missile (Raketen) | 25% | 100% + Piercing bypasses Armor | Interceptable by PV, cheap Energy | Low |

### 3.5 Energy Management UI

```
┌──────────────────────────────────────────┐
│ ENERGY: 168 / 200  ████████████████░░ 84%│
├──────────────────────────────────────────┤
│ [ON]  Puls-Laser Mk3      26E   ATK 28  │
│ [ON]  Rail-Kanone Mk2     22E   ATK 22  │
│ [ON]  Schild-Gen Mk2     120E   SHD 200 │
│ [OFF] Repair Drone Mk2    12E   REP 4   │
│ [OFF] ECM Suite 1         40E   ACC-15%  │
│                           ────           │
│                    Aktiv: 168E           │
├──────────────────────────────────────────┤
│ Taktik: [ASSAULT] [BALANCED] [DEFENSIVE] │
│                                          │
│        [FEUERN]        [FLIEHEN]         │
└──────────────────────────────────────────┘
```

**Constraint:** Active module energy cost must not exceed budget. Player must deactivate modules if over budget before confirming round.

### 3.6 Combat Outcomes

| Outcome | Condition | Consequence |
|---------|-----------|-------------|
| Victory | Enemy all modules 0 HP | Loot (credits + resources), rep gain |
| Defeat | Player all modules 0 HP | Cargo loss, all modules set to 50% HP |
| Draw | Round 10 reached | No loss, enemy persists |
| Flee | Player chooses (round 2+), 60% success | No loss on success; on fail, enemy gets free attack |
| Negotiate | OUTLAW with UNFRIENDLY+ rep | Pay credits, no combat |

---

## 4. NPC Opponents

Level-based virtual stats (no real modules):

```ts
function generateNpcCombatStats(level: number): NpcCombatStats {
  return {
    energy: 50 + level * 30,
    shield: level * 80,
    shieldRegen: level * 2,
    armorHp: 100 + level * 60,
    weapons: [
      { type: 'energy', atk: 5 + level * 6 },
      ...(level >= 3 ? [{ type: level % 2 === 0 ? 'kinetic' : 'missile', atk: level * 4 }] : []),
    ],
    accuracy: 80 + level,
    pvIntercept: level >= 5 ? 0.25 : 0,
    ecmReduction: level >= 7 ? 0.10 : 0,
  };
}
```

| Level | Energy | Shield | Armor | W1 (Energy) | W2 | PV | ECM |
|-------|--------|--------|-------|-------------|----|----|-----|
| 1 | 80 | 80 | 160 | ATK 11 | — | — | — |
| 3 | 140 | 240 | 280 | ATK 23 | 12 Kinetic | — | — |
| 5 | 200 | 400 | 400 | ATK 35 | 20 Missile | 25% | — |
| 7 | 260 | 560 | 520 | ATK 47 | 28 Kinetic | 25% | -10% |
| 10 | 350 | 800 | 700 | ATK 65 | 40 Missile | 25% | -10% |

**NPC tactics:** Random per round (40% balanced, 30% assault, 30% defensive). Level 7+: switches to assault when player HP < 30%.

**NPC energy:** Always exactly covers their loadout (no management needed).

---

## 5. Repair System

### 5.1 In Combat

- Repair modules heal HP on the lowest-HP% module each round
- Requires Energy (must be toggled ON)
- Research "Battle Medic" required for in-combat repair (without it, repair only works outside combat)

### 5.2 After Combat (Defeat)

- All modules set to 50% of their max HP
- Modules already at 0 HP remain deactivated

### 5.3 Repair Options

| Method | Speed | Cost | Condition |
|--------|-------|------|-----------|
| Repair Module (out of combat) | Repair-rate HP per tick | Free (passive) | Repair module installed |
| Station Repair | Instant, full HP | 0.5 credits per missing HP | Docked at station |
| Auto-Repair research | 1 HP/tick all modules | Free (passive) | Research unlocked |

### 5.4 Module HP in Exploration

- Modules function normally at any HP > 0
- At 0 HP: module deactivated — no effect (no scanner = no scan, no drive = no movement)
- Deactivated modules shown as red/crossed-out in MODULE tab

---

## 6. Data Model Changes

### 6.1 New Tables (clean install, no migration)

```sql
-- Module definitions (seeded from constants, not player-editable)
CREATE TABLE module_definitions (
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

-- Research node definitions
CREATE TABLE research_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  description TEXT DEFAULT '',
  effect JSONB NOT NULL DEFAULT '{}',
  wissen_cost INTEGER DEFAULT 10,
  prerequisite_module_id TEXT,
  prerequisite_research_id TEXT
);

-- Player's researched nodes
CREATE TABLE player_research (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  researched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, node_id)
);

-- Player's installed modules (replaces current ship_modules)
CREATE TABLE player_modules (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES module_definitions(id),
  slot TEXT NOT NULL,
  current_hp INTEGER NOT NULL,
  installed BOOLEAN DEFAULT TRUE,
  UNIQUE(player_id, slot)  -- one module per slot
);

CREATE INDEX idx_player_modules_player ON player_modules(player_id);
CREATE INDEX idx_player_research_player ON player_research(player_id);
```

### 6.2 Combat State (in-memory, not persisted)

```ts
interface CombatV3State {
  round: number;
  maxRounds: number;                   // 10
  playerShield: number;
  playerShieldMax: number;
  playerShieldRegen: number;
  playerArmorHp: number;
  playerArmorMax: number;
  playerModules: CombatModule[];       // {moduleId, hp, maxHp, active, energyCost, stats}
  playerEnergyBudget: number;
  playerTactic: 'assault' | 'balanced' | 'defensive';
  enemyShield: number;
  enemyShieldMax: number;
  enemyShieldRegen: number;
  enemyArmorHp: number;
  enemyWeapons: {type: string; atk: number}[];
  enemyAccuracy: number;
  enemyPvIntercept: number;
  enemyEcmReduction: number;
  enemyTactic: string;
  outcome?: 'victory' | 'defeat' | 'draw' | 'fled';
}

interface CombatModule {
  moduleId: string;
  name: string;
  category: string;
  hp: number;
  maxHp: number;
  active: boolean;                     // toggled by player
  energyCost: number;
  stats: Record<string, number>;
}
```

---

## 7. Files Affected

### New Files
- `packages/server/src/engine/combatV3Engine.ts` — pure combat logic (damage pipeline, round resolution)
- `packages/server/src/engine/moduleDefinitions.ts` — all 60 module definitions as constants
- `packages/server/src/engine/researchDefinitions.ts` — all 52 research node definitions
- `packages/server/src/engine/npcCombatStats.ts` — NPC level → virtual stats generator
- `packages/server/src/rooms/services/CombatV3Service.ts` — room service (replaces CombatService)
- `packages/client/src/components/CombatV3Screen.tsx` — combat UI with energy management
- `packages/client/src/components/TechTreeScreen.tsx` — new tech tree UI (10 branches, collapsible)
- `packages/server/src/db/migrations/078_tech_rework.sql` — new tables (clean install)

### Removed Files
- `packages/server/src/engine/combatV2Engine.ts` (replaced)
- All old module/tech constants in `constants.ts` (MODULES, TECH_TREE sections)

### Modified Files
- `packages/shared/src/types.ts` — new interfaces (ModuleDefinition, ResearchNode, CombatV3State, CombatModule)
- `packages/shared/src/constants.ts` — remove old module constants, add combat V3 constants
- `packages/shared/src/shipCalculator.ts` — rewrite to derive stats from new module system
- `packages/server/src/rooms/SectorRoom.ts` — replace CombatService with CombatV3Service, new message handlers
- `packages/server/src/rooms/services/ShipService.ts` — rewrite module install/uninstall for new slot system
- `packages/server/src/rooms/services/ScanService.ts` — update pirate/outlaw ambush to use V3
- `packages/server/src/rooms/services/NpcShipService.ts` — update OUTLAW attack to use V3
- `packages/client/src/state/gameSlice.ts` — combat V3 state, module HP tracking
- `packages/client/src/components/AcepProgram.tsx` — MODULE tab rewrite for new slot system
- `packages/client/src/network/client.ts` — combat V3 message handlers

---

## 8. Implementation Order

1. **Module definitions + DB schema** (moduleDefinitions.ts, researchDefinitions.ts, migration)
2. **Ship calculator rewrite** (derive exploration stats from new modules)
3. **Tech tree UI** (TechTreeScreen, research/unlock flow)
4. **Combat V3 engine** (pure logic: damage pipeline, rounds)
5. **Combat V3 service + UI** (CombatV3Service, CombatV3Screen)
6. **NPC combat stats** (level-based generator)
7. **Repair system** (module HP tracking, station repair, repair module)
8. **Integration** (ScanService ambush, NpcShipService attack, pirate encounters)
9. **Remove legacy** (old modules, old combat, old tech tree)
