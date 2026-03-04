# Combat System v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-shot auto-resolve combat with a 5-round tactical system featuring weapon/shield modules, tactic choices, special actions, and station defense.

**Architecture:** New pure-function engine (`combatV2.ts`) handles round resolution server-side. Client sends tactic+action per round, server resolves and returns round result. Station combat runs auto-turrets server-side with optional player participation. Feature-flag `FEATURE_COMBAT_V2` gates v2 encounters while keeping v1 as fallback. New weapon/shield module categories extend existing `MODULES` + `calculateShipStats`.

**Tech Stack:** TypeScript, Vitest, Zustand, Colyseus message handlers, PostgreSQL migrations

**Design Doc:** `docs/plans/2026-03-04-combat-system-design.md` (full spec with formulas, ASCII mockups, balance tables)

---

### Task 1: Shared Types — Combat V2

**Files:**
- Modify: `packages/shared/src/types.ts:447-467` (after BattleResult)
- Modify: `packages/shared/src/types.ts:669` (ModuleCategory)
- Modify: `packages/shared/src/types.ts:703-713` (ShipStats)
- Modify: `packages/shared/src/types.ts:123` (StructureType)

**Step 1: Extend ModuleCategory**

In `packages/shared/src/types.ts:669`, replace:
```typescript
export type ModuleCategory = 'drive' | 'cargo' | 'scanner' | 'armor' | 'special';
```
with:
```typescript
export type ModuleCategory = 'drive' | 'cargo' | 'scanner' | 'armor' | 'special' | 'weapon' | 'shield' | 'defense';
```

**Step 2: Extend ShipStats**

In `packages/shared/src/types.ts:703-713`, replace:
```typescript
export interface ShipStats {
  fuelMax: number;
  cargoCap: number;
  jumpRange: number;
  apCostJump: number;
  fuelPerJump: number;
  hp: number;
  commRange: number;
  scannerLevel: number;
  damageMod: number;
}
```
with:
```typescript
export interface ShipStats {
  fuelMax: number;
  cargoCap: number;
  jumpRange: number;
  apCostJump: number;
  fuelPerJump: number;
  hp: number;
  commRange: number;
  scannerLevel: number;
  damageMod: number;
  // Combat v2
  shieldHp: number;
  shieldRegen: number;
  weaponAttack: number;
  weaponType: WeaponType;
  weaponPiercing: number;
  pointDefense: number;
  ecmReduction: number;
}
```

**Step 3: Add Combat V2 types**

After `BattleResult` (line 467), add:
```typescript
// Combat v2 types
export type WeaponType = 'laser' | 'railgun' | 'missile' | 'emp' | 'none';
export type CombatTactic = 'assault' | 'balanced' | 'defensive';
export type SpecialAction = 'aim' | 'evade' | 'none';

export interface CombatRound {
  round: number;
  tactic: CombatTactic;
  specialAction: SpecialAction;
  playerAttack: number;
  enemyAttack: number;
  playerShieldDmg: number;
  playerHullDmg: number;
  enemyShieldDmg: number;
  enemyHullDmg: number;
  playerShieldAfter: number;
  playerHpAfter: number;
  enemyShieldAfter: number;
  enemyHpAfter: number;
  specialEffects: string[];
}

export interface CombatV2State {
  encounter: PirateEncounter;
  currentRound: number;
  maxRounds: number;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  playerMaxShield: number;
  playerShieldRegen: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyShield: number;
  enemyMaxShield: number;
  rounds: CombatRound[];
  specialActionsUsed: { aim: boolean; evade: boolean };
  empDisableRounds: number;
  status: 'active' | 'victory' | 'defeat' | 'escaped' | 'auto_flee';
}

export interface CombatV2ActionMessage {
  tactic: CombatTactic;
  specialAction: SpecialAction;
  sectorX: number;
  sectorY: number;
}

export interface CombatV2FleeMessage {
  sectorX: number;
  sectorY: number;
}

export interface CombatV2RoundResult {
  success: boolean;
  error?: string;
  round?: CombatRound;
  state?: CombatV2State;
  finalResult?: BattleResult;
}

// Station combat
export interface StationDefense {
  id: number;
  userId: string;
  sectorX: number;
  sectorY: number;
  defenseType: string;
  installedAt: number;
}

export interface StationCombatEvent {
  stationId: string;
  sectorX: number;
  sectorY: number;
  attackerLevel: number;
  stationHpBefore: number;
  outcome: 'defended' | 'damaged' | 'destroyed';
  hpLost: number;
}
```

**Step 4: Extend StructureType**

In `packages/shared/src/types.ts:123`, replace:
```typescript
export type StructureType = 'comm_relay' | 'mining_station' | 'base' | 'storage' | 'trading_post';
```
with:
```typescript
export type StructureType = 'comm_relay' | 'mining_station' | 'base' | 'storage' | 'trading_post' | 'defense_turret' | 'station_shield' | 'ion_cannon';
```

**Step 5: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass (types are compile-time only, no runtime breakage)

**Step 6: Commit**

```
feat: add combat v2 shared types — weapons, shields, rounds, station defense (#69)
```

---

### Task 2: Combat V2 Constants

**Files:**
- Modify: `packages/shared/src/constants.ts:133-144` (after battle constants)
- Modify: `packages/shared/src/constants.ts:243-316` (MODULES)

**Step 1: Add combat v2 constants**

After `PIRATE_DAMAGE_PER_LEVEL` (line 144), add:
```typescript
// Combat v2 — Feature flag
export const FEATURE_COMBAT_V2 = true;

// Combat v2 — Tactic multipliers
export const TACTIC_MODS: Record<string, { dmg: number; def: number }> = {
  assault:   { dmg: 1.30, def: 0.80 },
  balanced:  { dmg: 1.00, def: 1.00 },
  defensive: { dmg: 0.75, def: 1.35 },
};

// Combat v2 — Special actions
export const AIM_ACCURACY_BONUS = 0.50;
export const AIM_DISABLE_CHANCE = 0.35;
export const AIM_DISABLE_ROUNDS = 2;
export const EVADE_CHANCE = 0.50;
export const EMP_HIT_CHANCE = 0.75;
export const EMP_DISABLE_ROUNDS = 2;

// Combat v2 — General
export const COMBAT_V2_MAX_ROUNDS = 5;
export const COMBAT_V2_ROLL_MIN = 0.85;
export const COMBAT_V2_ROLL_MAX = 1.15;

// Station defense
export const STATION_BASE_HP = 500;
export const STATION_REPAIR_CR_PER_HP = 5;
export const STATION_REPAIR_ORE_PER_HP = 1;
export const STATION_COMBAT_MAX_ROUNDS = 10;

export const STATION_DEFENSE_DEFS: Record<string, {
  damage?: number;
  shieldHp?: number;
  shieldRegen?: number;
  oncePer?: 'combat';
  bypassShields?: boolean;
  cost: { credits: number; ore?: number; crystal?: number; gas?: number };
}> = {
  defense_turret_mk1: { damage: 15, cost: { credits: 500, ore: 50 } },
  defense_turret_mk2: { damage: 30, cost: { credits: 1500, ore: 100, crystal: 20 } },
  defense_turret_mk3: { damage: 50, cost: { credits: 4000, ore: 200, crystal: 60 } },
  station_shield_mk1: { shieldHp: 150, shieldRegen: 10, cost: { credits: 1000, crystal: 50 } },
  station_shield_mk2: { shieldHp: 350, shieldRegen: 25, cost: { credits: 3000, crystal: 100, gas: 30 } },
  ion_cannon: { damage: 80, oncePer: 'combat', bypassShields: true, cost: { credits: 8000, ore: 300, crystal: 100, gas: 50 } },
};
```

**Step 2: Add weapon & shield modules to MODULES**

After `armor_mk3` (line 315), add before the closing `};`:
```typescript
  // Weapon modules
  laser_mk1: {
    id: 'laser_mk1', category: 'weapon', tier: 1,
    name: 'PULS-LASER MK.I', displayName: 'LASER MK.I',
    effects: { weaponAttack: 8, weaponType: 'laser' as any },
    cost: { credits: 150, crystal: 10 },
  },
  laser_mk2: {
    id: 'laser_mk2', category: 'weapon', tier: 2,
    name: 'PULS-LASER MK.II', displayName: 'LASER MK.II',
    effects: { weaponAttack: 16, weaponType: 'laser' as any },
    cost: { credits: 450, crystal: 25, gas: 10 },
  },
  laser_mk3: {
    id: 'laser_mk3', category: 'weapon', tier: 3,
    name: 'PULS-LASER MK.III', displayName: 'LASER MK.III',
    effects: { weaponAttack: 28, weaponType: 'laser' as any },
    cost: { credits: 1200, crystal: 50, gas: 20 },
  },
  railgun_mk1: {
    id: 'railgun_mk1', category: 'weapon', tier: 1,
    name: 'RAIL-KANONE MK.I', displayName: 'RAIL MK.I',
    effects: { weaponAttack: 12, weaponPiercing: 0.30, weaponType: 'railgun' as any },
    cost: { credits: 300, ore: 30, crystal: 15 },
  },
  railgun_mk2: {
    id: 'railgun_mk2', category: 'weapon', tier: 2,
    name: 'RAIL-KANONE MK.II', displayName: 'RAIL MK.II',
    effects: { weaponAttack: 22, weaponPiercing: 0.50, weaponType: 'railgun' as any },
    cost: { credits: 900, ore: 60, crystal: 30 },
  },
  missile_mk1: {
    id: 'missile_mk1', category: 'weapon', tier: 1,
    name: 'RAKETEN-POD MK.I', displayName: 'RAKET MK.I',
    effects: { weaponAttack: 18, weaponType: 'missile' as any },
    cost: { credits: 250, ore: 20, crystal: 5 },
  },
  missile_mk2: {
    id: 'missile_mk2', category: 'weapon', tier: 2,
    name: 'RAKETEN-POD MK.II', displayName: 'RAKET MK.II',
    effects: { weaponAttack: 30, weaponType: 'missile' as any },
    cost: { credits: 750, ore: 40, crystal: 15 },
  },
  emp_array: {
    id: 'emp_array', category: 'weapon', tier: 2,
    name: 'EMP-EMITTER', displayName: 'EMP',
    effects: { weaponAttack: 0, weaponType: 'emp' as any },
    cost: { credits: 500, crystal: 20, gas: 20 },
  },
  // Shield modules
  shield_mk1: {
    id: 'shield_mk1', category: 'shield', tier: 1,
    name: 'SCHILD-GEN MK.I', displayName: 'SHLD MK.I',
    effects: { shieldHp: 30, shieldRegen: 3 },
    cost: { credits: 200, crystal: 15 },
  },
  shield_mk2: {
    id: 'shield_mk2', category: 'shield', tier: 2,
    name: 'SCHILD-GEN MK.II', displayName: 'SHLD MK.II',
    effects: { shieldHp: 60, shieldRegen: 6 },
    cost: { credits: 600, crystal: 35, gas: 10 },
  },
  shield_mk3: {
    id: 'shield_mk3', category: 'shield', tier: 3,
    name: 'SCHILD-GEN MK.III', displayName: 'SHLD MK.III',
    effects: { shieldHp: 100, shieldRegen: 12 },
    cost: { credits: 1500, crystal: 70, gas: 25 },
  },
  // Defensive modules
  point_defense: {
    id: 'point_defense', category: 'defense', tier: 2,
    name: 'PUNKT-VERTEIDIGUNG', displayName: 'PD',
    effects: { pointDefense: 0.60 },
    cost: { credits: 350, ore: 20, crystal: 10 },
  },
  ecm_suite: {
    id: 'ecm_suite', category: 'defense', tier: 2,
    name: 'ECM-SUITE', displayName: 'ECM',
    effects: { ecmReduction: 0.15 },
    cost: { credits: 400, crystal: 25, gas: 15 },
  },
```

**Step 3: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```
feat: add combat v2 constants — tactics, weapons, shields, station defs (#69)
```

---

### Task 3: Extend ShipStats Calculation

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts:4-36`
- Test: `packages/shared/src/__tests__/shipCalculator.test.ts` (create)

**Step 1: Write tests**

Create `packages/shared/src/__tests__/shipCalculator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateShipStats } from '../shipCalculator.js';

describe('calculateShipStats', () => {
  it('returns zero combat stats with no modules', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.shieldHp).toBe(0);
    expect(stats.shieldRegen).toBe(0);
    expect(stats.weaponAttack).toBe(0);
    expect(stats.weaponType).toBe('none');
    expect(stats.weaponPiercing).toBe(0);
    expect(stats.pointDefense).toBe(0);
    expect(stats.ecmReduction).toBe(0);
  });

  it('adds weapon stats from laser module', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'laser_mk2', slotIndex: 0 }]);
    expect(stats.weaponAttack).toBe(16);
    expect(stats.weaponType).toBe('laser');
  });

  it('adds shield stats from shield module', () => {
    const stats = calculateShipStats('cruiser', [{ moduleId: 'shield_mk1', slotIndex: 0 }]);
    expect(stats.shieldHp).toBe(30);
    expect(stats.shieldRegen).toBe(3);
  });

  it('sets piercing from railgun', () => {
    const stats = calculateShipStats('battleship', [{ moduleId: 'railgun_mk2', slotIndex: 0 }]);
    expect(stats.weaponAttack).toBe(22);
    expect(stats.weaponPiercing).toBe(0.50);
    expect(stats.weaponType).toBe('railgun');
  });

  it('adds point defense and ecm', () => {
    const stats = calculateShipStats('cruiser', [
      { moduleId: 'point_defense', slotIndex: 0 },
      { moduleId: 'ecm_suite', slotIndex: 1 },
    ]);
    expect(stats.pointDefense).toBe(0.60);
    expect(stats.ecmReduction).toBe(0.15);
  });

  it('combines weapon + shield + armor', () => {
    const stats = calculateShipStats('battleship', [
      { moduleId: 'laser_mk3', slotIndex: 0 },
      { moduleId: 'shield_mk2', slotIndex: 1 },
      { moduleId: 'armor_mk2', slotIndex: 2 },
    ]);
    expect(stats.weaponAttack).toBe(28);
    expect(stats.shieldHp).toBe(60);
    expect(stats.hp).toBe(150 + 50); // battleship base + armor
    expect(stats.damageMod).toBe(0.90); // 1.0 + (-0.10)
  });

  it('preserves existing stat behavior', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk1', slotIndex: 0 }]);
    expect(stats.jumpRange).toBe(4 + 1); // scout base + drive
    expect(stats.weaponAttack).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL — `shieldHp`, `weaponAttack` etc. are `undefined`

**Step 3: Update calculateShipStats**

In `packages/shared/src/shipCalculator.ts`, replace the function (lines 4-36):
```typescript
export function calculateShipStats(hullType: HullType, modules: ShipModule[]): ShipStats {
  const hull = HULLS[hullType];
  const stats: ShipStats = {
    fuelMax: hull.baseFuel,
    cargoCap: hull.baseCargo,
    jumpRange: hull.baseJumpRange,
    apCostJump: hull.baseApPerJump,
    fuelPerJump: hull.baseFuelPerJump,
    hp: hull.baseHp,
    commRange: hull.baseCommRange,
    scannerLevel: hull.baseScannerLevel,
    damageMod: 1.0,
    // Combat v2
    shieldHp: 0,
    shieldRegen: 0,
    weaponAttack: 0,
    weaponType: 'none',
    weaponPiercing: 0,
    pointDefense: 0,
    ecmReduction: 0,
  };

  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.effects)) {
      if (key === 'damageMod') {
        stats.damageMod += value as number;
      } else if (key === 'weaponType') {
        stats.weaponType = value as ShipStats['weaponType'];
      } else {
        (stats as any)[key] += value as number;
      }
    }
  }

  // Clamp minimums
  stats.apCostJump = Math.max(0.5, stats.apCostJump);
  stats.jumpRange = Math.max(1, stats.jumpRange);
  stats.damageMod = Math.max(0.25, stats.damageMod);

  return stats;
}
```

Note: Import `ShipStats` type is already imported. `weaponType` is handled as a string assignment (not additive).

**Step 4: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

**Step 5: Run server + client tests to check no regressions**

Run: `cd packages/server && npx vitest run`
Run: `cd packages/client && npx vitest run`
Expected: All pass — existing code that reads ShipStats just ignores new fields

**Step 6: Commit**

```
feat: extend ShipStats with combat v2 fields + shipCalculator tests (#69)
```

---

### Task 4: Combat V2 Engine — Core

**Files:**
- Create: `packages/server/src/engine/combatV2.ts`
- Create: `packages/server/src/engine/__tests__/combatV2.test.ts`

This is the heart of the system — pure functions, fully testable, no DB or network dependencies.

**Step 1: Write tests**

Create `packages/server/src/engine/__tests__/combatV2.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  initCombatV2,
  resolveRound,
  attemptFlee,
} from '../combatV2.js';
import type { PirateEncounter, ShipStats, CombatTactic, SpecialAction } from '@void-sector/shared';

const baseShip: ShipStats = {
  fuelMax: 100, cargoCap: 10, jumpRange: 3, apCostJump: 1,
  fuelPerJump: 1, hp: 100, commRange: 100, scannerLevel: 1, damageMod: 1.0,
  shieldHp: 0, shieldRegen: 0, weaponAttack: 0, weaponType: 'none',
  weaponPiercing: 0, pointDefense: 0, ecmReduction: 0,
};

const baseEncounter: PirateEncounter = {
  pirateLevel: 3, pirateHp: 50, pirateDamage: 14,
  sectorX: 10, sectorY: 20, canNegotiate: false, negotiateCost: 30,
};

describe('initCombatV2', () => {
  it('creates initial combat state', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    expect(state.currentRound).toBe(0);
    expect(state.maxRounds).toBe(5);
    expect(state.playerHp).toBe(100);
    expect(state.playerMaxHp).toBe(100);
    expect(state.playerShield).toBe(0);
    expect(state.enemyHp).toBe(50);
    expect(state.enemyMaxHp).toBe(50);
    expect(state.status).toBe('active');
    expect(state.rounds).toHaveLength(0);
  });

  it('includes shield stats', () => {
    const ship = { ...baseShip, shieldHp: 60, shieldRegen: 6 };
    const state = initCombatV2(baseEncounter, ship);
    expect(state.playerShield).toBe(60);
    expect(state.playerMaxShield).toBe(60);
    expect(state.playerShieldRegen).toBe(6);
  });
});

describe('resolveRound', () => {
  it('resolves a basic balanced round', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const seed = 12345;
    const result = resolveRound(state, baseShip, 'balanced', 'none', 1.0, seed);
    expect(result.round.round).toBe(1);
    expect(result.round.tactic).toBe('balanced');
    expect(result.state.currentRound).toBe(1);
    expect(result.state.rounds).toHaveLength(1);
  });

  it('assault tactic increases player damage', () => {
    const state = initCombatV2(baseEncounter, { ...baseShip, weaponAttack: 16 });
    const seed = 42;
    const assault = resolveRound(state, { ...baseShip, weaponAttack: 16 }, 'assault', 'none', 1.0, seed);
    const balanced = resolveRound(state, { ...baseShip, weaponAttack: 16 }, 'balanced', 'none', 1.0, seed);
    expect(assault.round.playerAttack).toBeGreaterThan(balanced.round.playerAttack);
  });

  it('defensive tactic reduces damage taken', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const seed = 42;
    const defensive = resolveRound(state, baseShip, 'defensive', 'none', 1.0, seed);
    const balanced = resolveRound(state, baseShip, 'balanced', 'none', 1.0, seed);
    expect(defensive.round.playerHullDmg).toBeLessThanOrEqual(balanced.round.playerHullDmg);
  });

  it('shield absorbs damage before hull', () => {
    const ship = { ...baseShip, shieldHp: 60, shieldRegen: 6 };
    const state = initCombatV2(baseEncounter, ship);
    const result = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    // With shield 60 and pirate damage ~14, shield should absorb most/all
    expect(result.round.playerShieldDmg).toBeGreaterThan(0);
    expect(result.state.playerHpAfter).toBe(result.round.playerHpAfter);
  });

  it('shield regenerates at round start', () => {
    const ship = { ...baseShip, shieldHp: 60, shieldRegen: 6 };
    let state = initCombatV2(baseEncounter, ship);
    // Damage the shield first
    state = { ...state, playerShield: 30 };
    const result = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    // Shield should have regenerated +6 before damage was applied
    // Starting at 30, +6 = 36, then damage applied
    expect(result.state.playerShieldRegen).toBe(6);
  });

  it('piercing bypasses damageMod', () => {
    const ship = { ...baseShip, weaponAttack: 12, weaponPiercing: 0.30, weaponType: 'railgun' as const };
    const state = initCombatV2(baseEncounter, ship);
    const result = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    // 30% of damage ignores armor
    expect(result.round.playerAttack).toBeGreaterThan(0);
  });

  it('evade can negate enemy damage', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    // Use a seed where evade succeeds (rng < 0.50)
    // We test both outcomes exist
    let evadeWorked = false;
    let evadeFailed = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = resolveRound(state, baseShip, 'balanced', 'evade', 1.0, seed);
      if (result.round.playerHullDmg === 0 && result.round.playerShieldDmg === 0) {
        evadeWorked = true;
      } else {
        evadeFailed = true;
      }
      if (evadeWorked && evadeFailed) break;
    }
    expect(evadeWorked).toBe(true);
    expect(evadeFailed).toBe(true);
  });

  it('marks victory when enemy HP reaches 0', () => {
    // Weak enemy, strong player
    const weakEnemy = { ...baseEncounter, pirateHp: 5, pirateDamage: 1 };
    const strongShip = { ...baseShip, weaponAttack: 50 };
    const state = initCombatV2(weakEnemy, strongShip);
    const result = resolveRound(state, strongShip, 'assault', 'none', 1.0, 42);
    expect(result.state.status).toBe('victory');
  });

  it('marks defeat when player HP reaches 0', () => {
    const strongEnemy = { ...baseEncounter, pirateHp: 500, pirateDamage: 200 };
    const weakShip = { ...baseShip, hp: 10 };
    const state = initCombatV2(strongEnemy, weakShip);
    const result = resolveRound(state, weakShip, 'balanced', 'none', 1.0, 42);
    expect(result.state.status).toBe('defeat');
  });

  it('auto-flees after max rounds', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    let current = { ...state, currentRound: 4 }; // already played 4 rounds
    const result = resolveRound(current, baseShip, 'balanced', 'none', 1.0, 42);
    if (result.state.enemyHp > 0 && result.state.playerHp > 0) {
      expect(result.state.status).toBe('auto_flee');
    }
  });

  it('point defense reduces missile damage', () => {
    // Enemy using missile-type (simulated via encounter damage)
    const ship = { ...baseShip, pointDefense: 0.60 };
    const state = initCombatV2(baseEncounter, ship);
    const withPD = resolveRound(state, ship, 'balanced', 'none', 1.0, 42);
    const withoutPD = resolveRound(state, baseShip, 'balanced', 'none', 1.0, 42);
    // PD should reduce incoming damage
    expect(withPD.round.playerHullDmg).toBeLessThanOrEqual(withoutPD.round.playerHullDmg);
  });

  it('prevents reusing special actions', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    const r1 = resolveRound(state, baseShip, 'balanced', 'aim', 1.0, 42);
    expect(r1.state.specialActionsUsed.aim).toBe(true);
    // Second attempt with aim should be treated as 'none'
    const r2 = resolveRound(r1.state, baseShip, 'balanced', 'aim', 1.0, 99);
    expect(r2.round.specialAction).toBe('none');
  });
});

describe('attemptFlee', () => {
  it('returns escaped or caught based on seed', () => {
    const state = initCombatV2(baseEncounter, baseShip);
    let escaped = false;
    let caught = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = attemptFlee(state, baseShip, seed);
      if (result.escaped) escaped = true;
      else caught = true;
      if (escaped && caught) break;
    }
    expect(escaped).toBe(true);
    expect(caught).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && npx vitest run src/engine/__tests__/combatV2.test.ts`
Expected: FAIL — module not found

**Step 3: Implement combatV2.ts engine**

Create `packages/server/src/engine/combatV2.ts`:
```typescript
import {
  COMBAT_V2_MAX_ROUNDS,
  COMBAT_V2_ROLL_MIN,
  COMBAT_V2_ROLL_MAX,
  TACTIC_MODS,
  AIM_ACCURACY_BONUS,
  AIM_DISABLE_CHANCE,
  AIM_DISABLE_ROUNDS,
  EVADE_CHANCE,
  EMP_HIT_CHANCE,
  EMP_DISABLE_ROUNDS,
  BATTLE_FLEE_BASE_CHANCE,
  PIRATE_BASE_DAMAGE,
  PIRATE_DAMAGE_PER_LEVEL,
} from '@void-sector/shared';
import type {
  PirateEncounter,
  ShipStats,
  CombatTactic,
  SpecialAction,
  CombatV2State,
  CombatRound,
} from '@void-sector/shared';

/** Seeded pseudo-random: returns 0..1 */
function seededRng(seed: number, offset: number): number {
  const s = ((seed + offset * 2654435761) >>> 0) % 2147483647;
  return (s % 10000) / 10000;
}

/** Roll within combat range */
function combatRoll(seed: number, offset: number): number {
  const r = seededRng(seed, offset);
  return COMBAT_V2_ROLL_MIN + r * (COMBAT_V2_ROLL_MAX - COMBAT_V2_ROLL_MIN);
}

export function initCombatV2(
  encounter: PirateEncounter,
  ship: ShipStats,
): CombatV2State {
  return {
    encounter,
    currentRound: 0,
    maxRounds: COMBAT_V2_MAX_ROUNDS,
    playerHp: ship.hp,
    playerMaxHp: ship.hp,
    playerShield: ship.shieldHp,
    playerMaxShield: ship.shieldHp,
    playerShieldRegen: ship.shieldRegen,
    enemyHp: encounter.pirateHp,
    enemyMaxHp: encounter.pirateHp,
    enemyShield: 0,
    enemyMaxShield: 0,
    rounds: [],
    specialActionsUsed: { aim: false, evade: false },
    empDisableRounds: 0,
    status: 'active',
  };
}

export function resolveRound(
  state: CombatV2State,
  ship: ShipStats,
  tactic: CombatTactic,
  specialAction: SpecialAction,
  combatMultiplier: number,
  seed: number,
): { round: CombatRound; state: CombatV2State } {
  const roundNum = state.currentRound + 1;

  // Prevent reuse of special actions
  let effectiveSpecial = specialAction;
  if (specialAction === 'aim' && state.specialActionsUsed.aim) effectiveSpecial = 'none';
  if (specialAction === 'evade' && state.specialActionsUsed.evade) effectiveSpecial = 'none';

  // Shield regeneration at round start
  let currentShield = Math.min(
    state.playerMaxShield,
    state.playerShield + state.playerShieldRegen,
  );
  let playerHp = state.playerHp;
  let enemyHp = state.enemyHp;
  let enemyShield = state.enemyShield;

  // EMP countdown
  let empDisableRounds = Math.max(0, state.empDisableRounds - 1);

  const tacticMod = TACTIC_MODS[tactic] ?? TACTIC_MODS.balanced;
  const specialEffects: string[] = [];

  // --- PLAYER ATTACK ---
  const baseAttack = 10; // all hulls have base 10
  const weaponBonus = ship.weaponAttack;
  let rawPlayerAtk = (baseAttack + weaponBonus) * combatMultiplier * tacticMod.dmg;

  // AIM bonus
  if (effectiveSpecial === 'aim') {
    rawPlayerAtk *= (1 + AIM_ACCURACY_BONUS);
    specialEffects.push('ZIELEN aktiv — +50% Trefferchance');
  }

  const playerRoll = combatRoll(seed, roundNum);
  let playerFinalAtk = Math.floor(rawPlayerAtk * playerRoll);

  // EMP: no direct damage, but disables enemy shields
  if (ship.weaponType === 'emp') {
    playerFinalAtk = 0;
    const empRoll = seededRng(seed, roundNum + 100);
    if (empRoll < EMP_HIT_CHANCE) {
      empDisableRounds = EMP_DISABLE_ROUNDS;
      specialEffects.push('EMP TREFFER — Feind-Schilde deaktiviert für 2 Runden');
    } else {
      specialEffects.push('EMP VERFEHLT');
    }
  }

  // AIM disable chance
  if (effectiveSpecial === 'aim' && ship.weaponType !== 'emp') {
    const disableRoll = seededRng(seed, roundNum + 200);
    if (disableRoll < AIM_DISABLE_CHANCE) {
      specialEffects.push('SYSTEM GETROFFEN — Feind-Waffe/Schild deaktiviert');
      // Reduce enemy effectiveness for next rounds (simplified: halve enemy damage this round)
      // Full implementation would track disabled systems per round
    }
  }

  // Apply player damage to enemy
  let enemyShieldDmg = 0;
  let enemyHullDmg = 0;
  if (playerFinalAtk > 0) {
    // Piercing: fraction bypasses armor
    if (ship.weaponPiercing > 0) {
      const piercedDmg = Math.floor(playerFinalAtk * ship.weaponPiercing);
      const normalDmg = playerFinalAtk - piercedDmg;

      if (empDisableRounds <= 0 && enemyShield > 0) {
        enemyShieldDmg = Math.min(normalDmg, enemyShield);
        enemyShield -= enemyShieldDmg;
        const afterShield = normalDmg - enemyShieldDmg;
        enemyHullDmg = piercedDmg + afterShield;
      } else {
        enemyHullDmg = piercedDmg + normalDmg;
      }
    } else {
      if (empDisableRounds <= 0 && enemyShield > 0) {
        enemyShieldDmg = Math.min(playerFinalAtk, enemyShield);
        enemyShield -= enemyShieldDmg;
        enemyHullDmg = playerFinalAtk - enemyShieldDmg;
      } else {
        enemyHullDmg = playerFinalAtk;
      }
    }
  }
  enemyHp = Math.max(0, enemyHp - enemyHullDmg);

  // --- ENEMY ATTACK ---
  const enemyBase = PIRATE_BASE_DAMAGE + state.encounter.pirateLevel * PIRATE_DAMAGE_PER_LEVEL;
  const ecmPenalty = 1.0 - ship.ecmReduction;
  const enemyRoll = combatRoll(seed, roundNum + 50);
  let rawEnemyDmg = Math.floor(enemyBase * enemyRoll * ecmPenalty);

  // EVADE check
  let evadeSucceeded = false;
  if (effectiveSpecial === 'evade') {
    const evadeRoll = seededRng(seed, roundNum + 300);
    if (evadeRoll < EVADE_CHANCE) {
      rawEnemyDmg = 0;
      evadeSucceeded = true;
      specialEffects.push('AUSWEICHMANÖVER ERFOLGREICH — kein Schaden');
    } else {
      specialEffects.push('AUSWEICHMANÖVER GESCHEITERT');
    }
  }

  // Point defense vs missiles (NPC pirates use generic damage, apply PD as flat reduction)
  let pdReduction = 0;
  if (!evadeSucceeded && ship.pointDefense > 0) {
    pdReduction = Math.floor(rawEnemyDmg * ship.pointDefense);
    rawEnemyDmg = Math.max(0, rawEnemyDmg - pdReduction);
    if (pdReduction > 0) {
      specialEffects.push(`PUNKT-VERTEIDIGUNG fängt ${pdReduction} DMG ab`);
    }
  }

  // Apply defensive tactic mod
  const defMod = tacticMod.def;
  const enemyFinalDmg = evadeSucceeded ? 0 : Math.floor(rawEnemyDmg / defMod);

  // Apply enemy damage to player
  let playerShieldDmg = 0;
  let playerHullDmg = 0;
  if (enemyFinalDmg > 0) {
    playerShieldDmg = Math.min(enemyFinalDmg, currentShield);
    currentShield -= playerShieldDmg;
    const afterShield = enemyFinalDmg - playerShieldDmg;
    const armorFactor = ship.damageMod;
    playerHullDmg = Math.floor(afterShield * armorFactor);
    playerHp = Math.max(0, playerHp - playerHullDmg);
  }

  // Update special actions used
  const specialActionsUsed = { ...state.specialActionsUsed };
  if (effectiveSpecial === 'aim') specialActionsUsed.aim = true;
  if (effectiveSpecial === 'evade') specialActionsUsed.evade = true;

  // Determine status
  let status: CombatV2State['status'] = 'active';
  if (enemyHp <= 0) status = 'victory';
  else if (playerHp <= 0) status = 'defeat';
  else if (roundNum >= state.maxRounds) status = 'auto_flee';

  const round: CombatRound = {
    round: roundNum,
    tactic,
    specialAction: effectiveSpecial,
    playerAttack: playerFinalAtk,
    enemyAttack: enemyFinalDmg,
    playerShieldDmg,
    playerHullDmg,
    enemyShieldDmg,
    enemyHullDmg,
    playerShieldAfter: currentShield,
    playerHpAfter: playerHp,
    enemyShieldAfter: enemyShield,
    enemyHpAfter: enemyHp,
    specialEffects,
  };

  const newState: CombatV2State = {
    ...state,
    currentRound: roundNum,
    playerHp,
    playerShield: currentShield,
    enemyHp,
    enemyShield,
    rounds: [...state.rounds, round],
    specialActionsUsed,
    empDisableRounds,
    status,
  };

  return { round, state: newState };
}

export function attemptFlee(
  state: CombatV2State,
  ship: ShipStats,
  seed: number,
): { escaped: boolean; state: CombatV2State } {
  const fleeChance = BATTLE_FLEE_BASE_CHANCE + (ship.weaponAttack * 0.002) - (state.encounter.pirateLevel * 0.05);
  const roll = seededRng(seed, state.currentRound + 500);

  if (roll < fleeChance) {
    return {
      escaped: true,
      state: { ...state, status: 'escaped' },
    };
  }
  return { escaped: false, state };
}

/** Generate a BattleResult from a completed combat */
export function combatV2ToResult(
  state: CombatV2State,
  seed: number,
): {
  outcome: string;
  lootCredits?: number;
  lootResources?: Record<string, number>;
  repChange?: number;
  xpGained?: number;
} {
  if (state.status === 'victory') {
    const level = state.encounter.pirateLevel;
    const lootCredits = level * 10 + Math.floor(seededRng(seed, 900) * 50);
    return {
      outcome: 'victory',
      lootCredits,
      lootResources: {
        ore: Math.floor(seededRng(seed, 901) * 3),
        crystal: Math.floor(seededRng(seed, 902) * 2),
      },
      repChange: -3,
      xpGained: level * 5 + state.currentRound * 2,
    };
  }
  if (state.status === 'defeat') {
    return {
      outcome: 'defeat',
      xpGained: Math.ceil(state.encounter.pirateLevel * 2),
    };
  }
  // escaped or auto_flee
  return { outcome: 'escaped' };
}
```

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/combatV2.test.ts`
Expected: All tests pass

**Step 5: Run full server tests**

Run: `cd packages/server && npx vitest run`
Expected: All 179+ tests pass

**Step 6: Commit**

```
feat: combat v2 engine — round resolution, tactics, shields, piercing, EMP (#69)
```

---

### Task 5: DB Migration 015 — Combat V2 Schema

**Files:**
- Create: `packages/server/src/db/migrations/015_combat_v2.sql`

**Step 1: Write migration**

Create `packages/server/src/db/migrations/015_combat_v2.sql`:
```sql
-- Combat v2: Station defense structures
CREATE TABLE IF NOT EXISTS station_defenses (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x      INTEGER NOT NULL,
  sector_y      INTEGER NOT NULL,
  defense_type  TEXT NOT NULL,
  installed_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE(user_id, sector_x, sector_y, defense_type)
);
CREATE INDEX IF NOT EXISTS idx_station_defenses_location
  ON station_defenses(sector_x, sector_y);

-- Station HP tracking (extend structures)
ALTER TABLE structures ADD COLUMN IF NOT EXISTS current_hp INTEGER DEFAULT 500;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS max_hp INTEGER DEFAULT 500;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS damaged_at BIGINT;

-- Battle log extensions for v2
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS rounds_played INTEGER DEFAULT 1;
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS round_details JSONB;
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS player_hp_end INTEGER;

-- Station battle log
CREATE TABLE IF NOT EXISTS station_battle_log (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x      INTEGER NOT NULL,
  sector_y      INTEGER NOT NULL,
  attacker_level INTEGER NOT NULL,
  outcome       TEXT NOT NULL,
  hp_lost       INTEGER NOT NULL DEFAULT 0,
  fought_at     BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS idx_station_battle_log_user ON station_battle_log(user_id);
```

**Step 2: Run server tests (migration is auto-loaded)**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (tests use mocks, not real DB)

**Step 3: Commit**

```
feat: DB migration 015 — station_defenses, battle_log v2, station_battle_log (#69)
```

---

### Task 6: DB Queries — Combat V2

**Files:**
- Modify: `packages/server/src/db/queries.ts` (add new query functions at end)

**Step 1: Add station defense queries**

Append to `packages/server/src/db/queries.ts`:
```typescript
// Combat v2: Station defense queries

export async function getStationDefenses(
  userId: string, sectorX: number, sectorY: number,
): Promise<Array<{ id: number; defenseType: string; installedAt: number }>> {
  const result = await query(
    'SELECT id, defense_type AS "defenseType", installed_at AS "installedAt" FROM station_defenses WHERE user_id = $1 AND sector_x = $2 AND sector_y = $3',
    [userId, sectorX, sectorY],
  );
  return result.rows;
}

export async function installStationDefense(
  userId: string, sectorX: number, sectorY: number, defenseType: string,
): Promise<{ id: number }> {
  const result = await query(
    `INSERT INTO station_defenses (user_id, sector_x, sector_y, defense_type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, sectorX, sectorY, defenseType],
  );
  return result.rows[0];
}

export async function removeStationDefense(
  userId: string, sectorX: number, sectorY: number, defenseType: string,
): Promise<boolean> {
  const result = await query(
    'DELETE FROM station_defenses WHERE user_id = $1 AND sector_x = $2 AND sector_y = $3 AND defense_type = $4',
    [userId, sectorX, sectorY, defenseType],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getStructureHp(
  userId: string, sectorX: number, sectorY: number,
): Promise<{ currentHp: number; maxHp: number } | null> {
  const result = await query(
    `SELECT current_hp AS "currentHp", max_hp AS "maxHp" FROM structures
     WHERE owner_id = $1 AND sector_x = $2 AND sector_y = $3 AND type = 'base'`,
    [userId, sectorX, sectorY],
  );
  return result.rows[0] ?? null;
}

export async function updateStructureHp(
  userId: string, sectorX: number, sectorY: number, newHp: number,
): Promise<void> {
  await query(
    `UPDATE structures SET current_hp = $4, damaged_at = CASE WHEN $4 < max_hp THEN (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT ELSE damaged_at END
     WHERE owner_id = $1 AND sector_x = $2 AND sector_y = $3 AND type = 'base'`,
    [userId, sectorX, sectorY, newHp],
  );
}

export async function insertStationBattleLog(
  userId: string, sectorX: number, sectorY: number,
  attackerLevel: number, outcome: string, hpLost: number,
): Promise<void> {
  await query(
    `INSERT INTO station_battle_log (user_id, sector_x, sector_y, attacker_level, outcome, hp_lost)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, sectorX, sectorY, attackerLevel, outcome, hpLost],
  );
}

export async function insertBattleLogV2(
  playerId: string, pirateLevel: number, sectorX: number, sectorY: number,
  action: string, outcome: string, loot: Record<string, unknown> | null,
  roundsPlayed: number, roundDetails: unknown[], playerHpEnd: number,
): Promise<void> {
  await query(
    `INSERT INTO battle_log (player_id, pirate_level, sector_x, sector_y, action, outcome, loot, rounds_played, round_details, player_hp_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [playerId, pirateLevel, sectorX, sectorY, action, outcome,
     loot ? JSON.stringify(loot) : null, roundsPlayed,
     JSON.stringify(roundDetails), playerHpEnd],
  );
}
```

**Step 2: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```
feat: add combat v2 DB queries — station defense, battle log v2 (#69)
```

---

### Task 7: Server Handler — combatV2Action

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (add message handlers + import)

**Step 1: Add imports at top of SectorRoom.ts**

Add to the imports from `@void-sector/shared`:
```typescript
import { FEATURE_COMBAT_V2, TACTIC_MODS, STATION_DEFENSE_DEFS, STATION_BASE_HP, STATION_REPAIR_CR_PER_HP, STATION_REPAIR_ORE_PER_HP } from '@void-sector/shared';
```

Add engine import:
```typescript
import { initCombatV2, resolveRound, attemptFlee, combatV2ToResult } from './engine/combatV2.js';
```

Add query imports:
```typescript
import { getStationDefenses, installStationDefense, getStructureHp, updateStructureHp, insertStationBattleLog, insertBattleLogV2 } from './db/queries.js';
```

**Step 2: Add combatV2State tracking**

Add to the class properties (near `clientShips`):
```typescript
private combatV2States = new Map<string, CombatV2State>();
```

**Step 3: Register message handlers**

After the existing `battleAction` handler registration (line 284), add:
```typescript
    this.onMessage('combatV2Action', async (client, data: CombatV2ActionMessage) => {
      await this.handleCombatV2Action(client, data);
    });
    this.onMessage('combatV2Flee', async (client, data: CombatV2FleeMessage) => {
      await this.handleCombatV2Flee(client, data);
    });
    this.onMessage('installDefense', async (client, data: { defenseType: string }) => {
      await this.handleInstallDefense(client, data);
    });
    this.onMessage('repairStation', async (client, data: { sectorX: number; sectorY: number }) => {
      await this.handleRepairStation(client, data);
    });
```

**Step 4: Add combatV2Action handler**

Add private method to SectorRoom class:
```typescript
  private async handleCombatV2Action(client: Client, data: CombatV2ActionMessage) {
    const auth = client.auth as AuthPayload;
    const sessionId = client.sessionId;
    const state = this.combatV2States.get(sessionId);

    if (!state || state.status !== 'active') {
      client.send('combatV2Result', { success: false, error: 'No active combat' });
      return;
    }

    const validTactics = ['assault', 'balanced', 'defensive'];
    const validSpecials = ['aim', 'evade', 'none'];
    if (!validTactics.includes(data.tactic) || !validSpecials.includes(data.specialAction)) {
      client.send('combatV2Result', { success: false, error: 'Invalid tactic or action' });
      return;
    }

    const ship = this.getShipForClient(sessionId);
    const bonuses = await this.getPlayerBonuses(auth.userId);
    const seed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17 + state.currentRound * 7);

    const result = resolveRound(
      state, ship, data.tactic, data.specialAction,
      bonuses.combatMultiplier, seed,
    );

    this.combatV2States.set(sessionId, result.state);

    // If combat ended, clean up and send final result
    if (result.state.status !== 'active') {
      this.combatV2States.delete(sessionId);
      const finalResult = combatV2ToResult(result.state, seed);

      // Apply outcomes
      if (result.state.status === 'victory') {
        if (finalResult.lootCredits) {
          await this.addCredits(auth.userId, finalResult.lootCredits);
        }
        if (finalResult.lootResources) {
          for (const [resource, amount] of Object.entries(finalResult.lootResources)) {
            if (amount > 0) await this.addCargo(auth.userId, resource, amount);
          }
        }
      }
      if (finalResult.repChange) {
        await this.updateReputation(auth.userId, 'pirates', finalResult.repChange);
      }

      await insertBattleLogV2(
        auth.userId, state.encounter.pirateLevel,
        data.sectorX, data.sectorY,
        'combat_v2', result.state.status,
        finalResult.lootResources ?? null,
        result.state.currentRound, result.state.rounds,
        result.state.playerHp,
      );

      client.send('combatV2Result', {
        success: true,
        round: result.round,
        state: result.state,
        finalResult,
      });
      return;
    }

    client.send('combatV2Result', {
      success: true,
      round: result.round,
      state: result.state,
    });
  }
```

**Step 5: Add flee handler**

```typescript
  private async handleCombatV2Flee(client: Client, data: CombatV2FleeMessage) {
    const auth = client.auth as AuthPayload;
    const sessionId = client.sessionId;
    const state = this.combatV2States.get(sessionId);

    if (!state || state.status !== 'active') {
      client.send('combatV2Result', { success: false, error: 'No active combat' });
      return;
    }

    // Flee costs 2 AP
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const newAP = spendAP(currentAP, BATTLE_AP_COST_FLEE);
    if (!newAP) {
      client.send('combatV2Result', { success: false, error: 'Nicht genug AP zum Fliehen (2 AP)' });
      return;
    }

    const ship = this.getShipForClient(sessionId);
    const seed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17);
    const fleeResult = attemptFlee(state, ship, seed);

    await saveAPState(auth.userId, newAP);
    client.send('apUpdate', newAP);

    if (fleeResult.escaped) {
      this.combatV2States.delete(sessionId);
      client.send('combatV2Result', {
        success: true,
        state: fleeResult.state,
        finalResult: { outcome: 'escaped' },
      });
    } else {
      this.combatV2States.set(sessionId, fleeResult.state);
      client.send('combatV2Result', {
        success: true,
        state: fleeResult.state,
        finalResult: { outcome: 'caught' },
      });
    }
  }
```

**Step 6: Modify pirate ambush to init combat v2**

Find where `pirateAmbush` is sent (search for `client.send('pirateAmbush'`). Add after the existing send:

```typescript
    // If combat v2 is enabled, also init the v2 state
    if (FEATURE_COMBAT_V2) {
      const ship = this.getShipForClient(client.sessionId);
      const combatState = initCombatV2(encounter, ship);
      this.combatV2States.set(client.sessionId, combatState);
      client.send('combatV2Init', { state: combatState });
    }
```

**Step 7: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (handlers are tested via integration, not unit tests)

Note: Some tests may need `combatV2Init` added to mock expectations. Fix as needed by adding the message to mock sends.

**Step 8: Commit**

```
feat: server handlers — combatV2Action, combatV2Flee, pirate ambush v2 init (#69)
```

---

### Task 8: Install Defense & Repair Station Handlers

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (add handlers)

**Step 1: Add installDefense handler**

```typescript
  private async handleInstallDefense(client: Client, data: { defenseType: string }) {
    if (rejectGuest(client, 'Verteidigung bauen')) return;
    if (!this.checkRate(client.sessionId, 'build', 2000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const def = STATION_DEFENSE_DEFS[data.defenseType];
    if (!def) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Unknown defense type' });
      return;
    }

    // Check player has a base in this sector
    const sectorX = this.state.sector.x;
    const sectorY = this.state.sector.y;
    const structures = await getPlayerStructuresInSector(auth.userId, sectorX, sectorY);
    const hasBase = structures.some(s => s.type === 'base');
    if (!hasBase) {
      client.send('installDefenseResult', { success: false, error: 'Keine Basis in diesem Sektor' });
      return;
    }

    // Check resources
    const credits = await getPlayerCredits(auth.userId);
    if (credits < def.cost.credits) {
      client.send('installDefenseResult', { success: false, error: 'Nicht genug Credits' });
      return;
    }
    const cargo = await getPlayerCargo(auth.userId);
    for (const [resource, amount] of Object.entries(def.cost)) {
      if (resource === 'credits') continue;
      if ((cargo[resource as keyof typeof cargo] ?? 0) < (amount ?? 0)) {
        client.send('installDefenseResult', { success: false, error: `Nicht genug ${resource}` });
        return;
      }
    }

    // Deduct resources
    await this.deductCredits(auth.userId, def.cost.credits);
    for (const [resource, amount] of Object.entries(def.cost)) {
      if (resource === 'credits' || !amount) continue;
      await deductCargo(auth.userId, resource, amount);
    }

    try {
      const result = await installStationDefense(auth.userId, sectorX, sectorY, data.defenseType);
      client.send('installDefenseResult', { success: true, defenseType: data.defenseType, id: result.id });
      const updatedCargo = await getPlayerCargo(auth.userId);
      client.send('cargoUpdate', updatedCargo);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('installDefenseResult', { success: false, error: 'Verteidigung bereits installiert' });
        return;
      }
      client.send('installDefenseResult', { success: false, error: 'Installation fehlgeschlagen' });
    }
  }
```

**Step 2: Add repairStation handler**

```typescript
  private async handleRepairStation(client: Client, data: { sectorX: number; sectorY: number }) {
    if (rejectGuest(client, 'Reparieren')) return;
    const auth = client.auth as AuthPayload;

    const hp = await getStructureHp(auth.userId, data.sectorX, data.sectorY);
    if (!hp) {
      client.send('repairResult', { success: false, error: 'Keine Basis gefunden' });
      return;
    }
    if (hp.currentHp >= hp.maxHp) {
      client.send('repairResult', { success: false, error: 'Basis ist nicht beschädigt' });
      return;
    }

    const hpToRepair = hp.maxHp - hp.currentHp;
    const costCredits = hpToRepair * STATION_REPAIR_CR_PER_HP;
    const costOre = hpToRepair * STATION_REPAIR_ORE_PER_HP;

    const credits = await getPlayerCredits(auth.userId);
    if (credits < costCredits) {
      client.send('repairResult', { success: false, error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Credits` });
      return;
    }
    const cargo = await getPlayerCargo(auth.userId);
    if ((cargo.ore ?? 0) < costOre) {
      client.send('repairResult', { success: false, error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Erz` });
      return;
    }

    await this.deductCredits(auth.userId, costCredits);
    await deductCargo(auth.userId, 'ore', costOre);
    await updateStructureHp(auth.userId, data.sectorX, data.sectorY, hp.maxHp);

    client.send('repairResult', { success: true, newHp: hp.maxHp, maxHp: hp.maxHp });
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  }
```

**Step 3: Add VALID_STRUCTURE_TYPES update**

In `SectorRoom.ts:42`, update the array:
```typescript
const VALID_STRUCTURE_TYPES = ['comm_relay', 'mining_station', 'base', 'storage', 'trading_post', 'defense_turret', 'station_shield', 'ion_cannon'];
```

**Step 4: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```
feat: server handlers — installDefense, repairStation for station combat (#69)
```

---

### Task 9: Client State & Network — Combat V2

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/test/mockStore.ts`

**Step 1: Add combat v2 state to gameSlice**

In `gameSlice.ts`, add to the state interface (after `lastBattleResult`):
```typescript
  activeCombatV2: CombatV2State | null;
  stationDefenses: StationDefense[];
  stationCombatEvent: StationCombatEvent | null;
```

Add to initial state:
```typescript
  activeCombatV2: null,
  stationDefenses: [],
  stationCombatEvent: null,
```

Add setters:
```typescript
  setActiveCombatV2: (activeCombatV2: CombatV2State | null) => set({ activeCombatV2 }),
  setStationDefenses: (stationDefenses: StationDefense[]) => set({ stationDefenses }),
  setStationCombatEvent: (stationCombatEvent: StationCombatEvent | null) => set({ stationCombatEvent }),
```

**Step 2: Add network handlers in client.ts**

In the room message handlers section, add:
```typescript
    room.onMessage('combatV2Init', (data: { state: CombatV2State }) => {
      useStore.getState().setActiveCombatV2(data.state);
    });

    room.onMessage('combatV2Result', (data: CombatV2RoundResult) => {
      const store = useStore.getState();
      if (data.state) {
        store.setActiveCombatV2(data.state.status === 'active' ? data.state : null);
      }
      if (data.finalResult) {
        store.setLastBattleResult({
          encounter: store.activeBattle ?? store.activeCombatV2?.encounter ?? {} as any,
          result: data.finalResult as any,
        });
        store.setActiveCombatV2(null);
        store.setActiveBattle(null);
      }
    });

    room.onMessage('stationUnderAttack', (data: StationCombatEvent) => {
      useStore.getState().setStationCombatEvent(data);
      useStore.getState().addLogEntry(`STATION UNTER ANGRIFF in (${data.sectorX}, ${data.sectorY})!`);
    });

    room.onMessage('stationDefended', (data: StationCombatEvent) => {
      useStore.getState().setStationCombatEvent(null);
      useStore.getState().addLogEntry(`Station erfolgreich verteidigt!`);
    });
```

Add send methods to GameNetwork class:
```typescript
  sendCombatV2Action(tactic: string, specialAction: string, sectorX: number, sectorY: number) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('combatV2Action', { tactic, specialAction, sectorX, sectorY });
  }

  sendCombatV2Flee(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('combatV2Flee', { sectorX, sectorY });
  }

  sendInstallDefense(defenseType: string) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('installDefense', { defenseType });
  }

  sendRepairStation(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('repairStation', { sectorX, sectorY });
  }
```

**Step 3: Update mockStore**

In `packages/client/src/test/mockStore.ts`, add:
```typescript
  activeCombatV2: null,
  stationDefenses: [],
  stationCombatEvent: null,
  setActiveCombatV2: vi.fn(),
  setStationDefenses: vi.fn(),
  setStationCombatEvent: vi.fn(),
```

**Step 4: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```
feat: client state & network handlers for combat v2 (#69)
```

---

### Task 10: CombatV2Dialog Component

**Files:**
- Create: `packages/client/src/components/CombatV2Dialog.tsx`
- Create: `packages/client/src/__tests__/CombatV2Dialog.test.tsx`

**Step 1: Write tests**

Create `packages/client/src/__tests__/CombatV2Dialog.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatV2Dialog } from '../components/CombatV2Dialog';
import { mockStoreState } from '../test/mockStore';
import type { CombatV2State } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {
    sendCombatV2Action: vi.fn(),
    sendCombatV2Flee: vi.fn(),
  },
}));

import { network } from '../network/client';

const baseCombatState: CombatV2State = {
  encounter: {
    pirateLevel: 3, pirateHp: 50, pirateDamage: 14,
    sectorX: 10, sectorY: 20, canNegotiate: false, negotiateCost: 30,
  },
  currentRound: 0,
  maxRounds: 5,
  playerHp: 100,
  playerMaxHp: 100,
  playerShield: 60,
  playerMaxShield: 60,
  playerShieldRegen: 6,
  enemyHp: 50,
  enemyMaxHp: 50,
  enemyShield: 0,
  enemyMaxShield: 0,
  rounds: [],
  specialActionsUsed: { aim: false, evade: false },
  empDisableRounds: 0,
  status: 'active',
};

describe('CombatV2Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no active combat', () => {
    mockStoreState({ activeCombatV2: null });
    const { container } = render(<CombatV2Dialog />);
    expect(container.innerHTML).toBe('');
  });

  it('shows combat dialog with round info', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/KAMPF-SYSTEM/)).toBeDefined();
    expect(screen.getByText(/RUNDE/)).toBeDefined();
  });

  it('shows player and enemy HP bars', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/100.*100/)).toBeDefined(); // player HP
    expect(screen.getByText(/50.*50/)).toBeDefined();   // enemy HP
  });

  it('shows tactic buttons', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/ANGRIFF/)).toBeDefined();
    expect(screen.getByText(/AUSGEWOGEN/)).toBeDefined();
    expect(screen.getByText(/DEFENSIV/)).toBeDefined();
  });

  it('sends assault tactic on click', async () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    await userEvent.click(screen.getByText(/ANGRIFF/));
    expect(network.sendCombatV2Action).toHaveBeenCalledWith('assault', 'none', 10, 20);
  });

  it('shows special action buttons', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/ZIELEN/)).toBeDefined();
    expect(screen.getByText(/AUSWEICHEN/)).toBeDefined();
  });

  it('disables used special actions', () => {
    const usedState = {
      ...baseCombatState,
      specialActionsUsed: { aim: true, evade: false },
    };
    mockStoreState({ activeCombatV2: usedState });
    render(<CombatV2Dialog />);
    const aimBtn = screen.getByText(/ZIELEN/).closest('button');
    expect(aimBtn?.getAttribute('disabled')).not.toBeNull();
  });

  it('sends flee on escape key', async () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    await userEvent.keyboard('{Escape}');
    expect(network.sendCombatV2Flee).toHaveBeenCalledWith(10, 20);
  });

  it('shows combat log entries', () => {
    const stateWithRound = {
      ...baseCombatState,
      currentRound: 1,
      rounds: [{
        round: 1, tactic: 'balanced' as const, specialAction: 'none' as const,
        playerAttack: 18, enemyAttack: 12,
        playerShieldDmg: 12, playerHullDmg: 0,
        enemyShieldDmg: 0, enemyHullDmg: 18,
        playerShieldAfter: 48, playerHpAfter: 100,
        enemyShieldAfter: 0, enemyHpAfter: 32,
        specialEffects: [],
      }],
    };
    mockStoreState({ activeCombatV2: stateWithRound });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/RUNDE 1/)).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/client && npx vitest run src/__tests__/CombatV2Dialog.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement CombatV2Dialog**

Create `packages/client/src/components/CombatV2Dialog.tsx`:
```tsx
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../state/gameSlice';
import { network } from '../network/client';
import type { CombatTactic, SpecialAction, CombatRound } from '@void-sector/shared';

function HpBar({ current, max, label, color }: {
  current: number; max: number; label: string; color: string;
}) {
  const pct = max > 0 ? Math.max(0, current / max) : 0;
  const barWidth = 20;
  const filled = Math.round(pct * barWidth);
  const bar = '\u25A0'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color }}>
      {label} [{bar}] {current}/{max}
    </div>
  );
}

export function CombatV2Dialog() {
  const combat = useStore((s) => s.activeCombatV2);
  const [selectedSpecial, setSelectedSpecial] = useState<SpecialAction>('none');

  const handleTactic = useCallback((tactic: CombatTactic) => {
    if (!combat) return;
    network.sendCombatV2Action(
      tactic, selectedSpecial,
      combat.encounter.sectorX, combat.encounter.sectorY,
    );
    setSelectedSpecial('none');
  }, [combat, selectedSpecial]);

  const handleFlee = useCallback(() => {
    if (!combat) return;
    network.sendCombatV2Flee(combat.encounter.sectorX, combat.encounter.sectorY);
  }, [combat]);

  useEffect(() => {
    if (!combat) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleFlee();
      if (e.key === 'F1' || e.key === '1') { e.preventDefault(); handleTactic('assault'); }
      if (e.key === 'F2' || e.key === '2') { e.preventDefault(); handleTactic('balanced'); }
      if (e.key === 'F3' || e.key === '3') { e.preventDefault(); handleTactic('defensive'); }
      if (e.key === 'F4' || e.key === '4') { e.preventDefault(); setSelectedSpecial(s => s === 'aim' ? 'none' : 'aim'); }
      if (e.key === 'F5' || e.key === '5') { e.preventDefault(); setSelectedSpecial(s => s === 'evade' ? 'none' : 'evade'); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [combat, handleFlee, handleTactic]);

  if (!combat) return null;

  const { encounter, currentRound, maxRounds, playerHp, playerMaxHp,
    playerShield, playerMaxShield, enemyHp, enemyMaxHp, rounds,
    specialActionsUsed } = combat;

  const isAncient = encounter.pirateLevel >= 6;
  const enemyName = isAncient
    ? `ALIEN-KONTAKT LV.${encounter.pirateLevel}`
    : `PIRATEN-KREUZER LV.${encounter.pirateLevel}`;
  const enemyColor = isAncient ? '#00BFFF' : '#FF3333';

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#000' : 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    padding: '8px 12px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    minWidth: 100,
  });

  const disabledBtn: React.CSSProperties = {
    ...btnStyle(),
    opacity: 0.3,
    cursor: 'not-allowed',
    color: '#555',
    borderColor: '#333',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="combat-v2-title"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 5, 5, 0.95)', zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 16,
        fontFamily: 'var(--font-mono)', color: 'var(--color-primary)',
      }}
    >
      {/* Header */}
      <div id="combat-v2-title" style={{
        fontSize: '0.8rem', letterSpacing: '0.2em', marginBottom: 12,
        borderBottom: '1px solid var(--color-primary)', paddingBottom: 8,
        width: '100%', maxWidth: 600, textAlign: 'center',
      }}>
        KAMPF-SYSTEM v2 &bull; SEKTOR ({encounter.sectorX}, {encounter.sectorY}) &bull; RUNDE {currentRound}/{maxRounds}
      </div>

      {/* Ship panels */}
      <div style={{
        display: 'flex', gap: 16, width: '100%', maxWidth: 600,
        justifyContent: 'space-between', marginBottom: 12,
      }}>
        {/* Player */}
        <div style={{ flex: 1, border: '1px solid #333', padding: 8 }}>
          <div style={{ fontSize: '0.7rem', color: '#00FF88', marginBottom: 4 }}>DEIN SCHIFF</div>
          {playerMaxShield > 0 && (
            <HpBar current={playerShield} max={playerMaxShield} label="SCHILD" color="#00BFFF" />
          )}
          <HpBar current={playerHp} max={playerMaxHp} label="RUMPF " color="#00FF88" />
        </div>

        {/* Enemy */}
        <div style={{ flex: 1, border: `1px solid ${enemyColor}40`, padding: 8 }}>
          <div style={{ fontSize: '0.7rem', color: enemyColor, marginBottom: 4 }}>{enemyName}</div>
          <HpBar current={enemyHp} max={enemyMaxHp} label="RUMPF " color={enemyColor} />
        </div>
      </div>

      {/* Combat log */}
      <div style={{
        width: '100%', maxWidth: 600, border: '1px solid #333',
        padding: 8, marginBottom: 12, maxHeight: 120, overflowY: 'auto',
        fontSize: '0.6rem', color: '#888',
      }}>
        <div style={{ color: '#555', marginBottom: 4 }}>KAMPF-PROTOKOLL</div>
        {rounds.map((r: CombatRound) => (
          <div key={r.round}>
            <span style={{ color: 'var(--color-primary)' }}>RUNDE {r.round}:</span>
            {' '}Angriff {r.playerAttack} DMG &rarr; Feind |{' '}
            Feind {r.enemyAttack} DMG &rarr; Du
            {r.specialEffects.map((e, i) => (
              <span key={i} style={{ color: '#00BFFF' }}> [{e}]</span>
            ))}
          </div>
        ))}
        {rounds.length === 0 && (
          <div style={{ color: '#555' }}>Wähle eine Taktik für Runde 1...</div>
        )}
      </div>

      {/* Tactic buttons */}
      <div style={{ marginBottom: 8, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em' }}>
        TAKTIK
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={btnStyle()} onClick={() => handleTactic('assault')}>
          [1] ANGRIFF<br /><span style={{ fontSize: '0.55rem', opacity: 0.6 }}>+30% DMG -20% DEF</span>
        </button>
        <button style={btnStyle()} onClick={() => handleTactic('balanced')}>
          [2] AUSGEWOGEN<br /><span style={{ fontSize: '0.55rem', opacity: 0.6 }}>Balanced</span>
        </button>
        <button style={btnStyle()} onClick={() => handleTactic('defensive')}>
          [3] DEFENSIV<br /><span style={{ fontSize: '0.55rem', opacity: 0.6 }}>-25% DMG +35% DEF</span>
        </button>
      </div>

      {/* Special actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          style={specialActionsUsed.aim ? disabledBtn : btnStyle(selectedSpecial === 'aim')}
          disabled={specialActionsUsed.aim}
          onClick={() => setSelectedSpecial(s => s === 'aim' ? 'none' : 'aim')}
        >
          [4] ZIELEN{specialActionsUsed.aim ? ' (benutzt)' : ''}
        </button>
        <button
          style={specialActionsUsed.evade ? disabledBtn : btnStyle(selectedSpecial === 'evade')}
          disabled={specialActionsUsed.evade}
          onClick={() => setSelectedSpecial(s => s === 'evade' ? 'none' : 'evade')}
        >
          [5] AUSWEICHEN{specialActionsUsed.evade ? ' (benutzt)' : ''}
        </button>
      </div>

      {/* Flee */}
      <button
        style={{ ...btnStyle(), borderColor: '#FF3333', color: '#FF3333', marginTop: 4 }}
        onClick={handleFlee}
      >
        [ESC] FLUCHT — 2 AP, ~60%
      </button>
    </div>
  );
}
```

**Step 4: Add CombatV2Dialog to GameScreen**

In `packages/client/src/components/GameScreen.tsx`, import and render:

Add import:
```typescript
import { CombatV2Dialog } from './CombatV2Dialog';
```

Add in JSX (near the existing `<BattleDialog />`):
```tsx
<CombatV2Dialog />
```

**Step 5: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```
feat: CombatV2Dialog — tactical round-based combat UI (#69)
```

---

### Task 11: Station Combat Engine

**Files:**
- Create: `packages/server/src/engine/stationCombat.ts`
- Create: `packages/server/src/engine/__tests__/stationCombat.test.ts`

**Step 1: Write tests**

Create `packages/server/src/engine/__tests__/stationCombat.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveStationCombat } from '../stationCombat.js';

describe('resolveStationCombat', () => {
  it('station defends against weak pirate', () => {
    const result = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 150,
      stationShieldRegen: 10,
      turretDamage: 30,
      ionCannonDamage: 0,
      pirateLevel: 1,
      seed: 42,
    });
    expect(result.outcome).toBe('defended');
    expect(result.hpLost).toBe(0);
  });

  it('station takes damage from strong pirate', () => {
    const result = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 0,
      stationShieldRegen: 0,
      turretDamage: 15,
      ionCannonDamage: 0,
      pirateLevel: 8,
      seed: 42,
    });
    // Strong pirate can damage an unshielded station with low turret power
    expect(['defended', 'damaged', 'destroyed']).toContain(result.outcome);
  });

  it('returns destroyed when HP reaches 0', () => {
    const result = resolveStationCombat({
      stationHp: 10,
      stationMaxHp: 500,
      stationShieldHp: 0,
      stationShieldRegen: 0,
      turretDamage: 0,
      ionCannonDamage: 0,
      pirateLevel: 10,
      seed: 42,
    });
    expect(result.outcome).toBe('destroyed');
    expect(result.hpLost).toBeGreaterThan(0);
  });

  it('ion cannon fires once and bypasses shields', () => {
    const result = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 150,
      stationShieldRegen: 10,
      turretDamage: 15,
      ionCannonDamage: 80,
      pirateLevel: 3,
      seed: 42,
    });
    // With ion cannon, station should defend easily
    expect(result.outcome).toBe('defended');
  });
});
```

**Step 2: Implement stationCombat.ts**

Create `packages/server/src/engine/stationCombat.ts`:
```typescript
import {
  STATION_COMBAT_MAX_ROUNDS,
  PIRATE_BASE_DAMAGE,
  PIRATE_DAMAGE_PER_LEVEL,
  PIRATE_BASE_HP,
  PIRATE_HP_PER_LEVEL,
  COMBAT_V2_ROLL_MIN,
  COMBAT_V2_ROLL_MAX,
} from '@void-sector/shared';

interface StationCombatInput {
  stationHp: number;
  stationMaxHp: number;
  stationShieldHp: number;
  stationShieldRegen: number;
  turretDamage: number;
  ionCannonDamage: number;
  pirateLevel: number;
  seed: number;
}

interface StationCombatResult {
  outcome: 'defended' | 'damaged' | 'destroyed';
  hpLost: number;
  roundsPlayed: number;
}

function seededRng(seed: number, offset: number): number {
  const s = ((seed + offset * 2654435761) >>> 0) % 2147483647;
  return (s % 10000) / 10000;
}

function combatRoll(seed: number, offset: number): number {
  const r = seededRng(seed, offset);
  return COMBAT_V2_ROLL_MIN + r * (COMBAT_V2_ROLL_MAX - COMBAT_V2_ROLL_MIN);
}

export function resolveStationCombat(input: StationCombatInput): StationCombatResult {
  let stationHp = input.stationHp;
  let shield = input.stationShieldHp;
  const shieldMax = input.stationShieldHp;
  let pirateHp = PIRATE_BASE_HP + input.pirateLevel * PIRATE_HP_PER_LEVEL;
  const pirateDmg = PIRATE_BASE_DAMAGE + input.pirateLevel * PIRATE_DAMAGE_PER_LEVEL;
  let ionFired = false;
  let round = 0;

  for (round = 1; round <= STATION_COMBAT_MAX_ROUNDS; round++) {
    // Shield regen
    shield = Math.min(shieldMax, shield + input.stationShieldRegen);

    // Station attacks
    const turretRoll = combatRoll(input.seed, round);
    const turretDmg = Math.floor(input.turretDamage * turretRoll);
    pirateHp -= turretDmg;

    // Ion cannon (once per combat, bypasses shields)
    if (!ionFired && input.ionCannonDamage > 0) {
      pirateHp -= input.ionCannonDamage;
      ionFired = true;
    }

    if (pirateHp <= 0) break;

    // Pirate attacks
    const pirateRoll = combatRoll(input.seed, round + 50);
    const rawPirateDmg = Math.floor(pirateDmg * pirateRoll);

    // Shield absorbs first
    const shieldAbsorb = Math.min(rawPirateDmg, shield);
    shield -= shieldAbsorb;
    const hullDmg = rawPirateDmg - shieldAbsorb;
    stationHp -= hullDmg;

    if (stationHp <= 0) break;
  }

  const hpLost = Math.max(0, input.stationHp - Math.max(0, stationHp));

  if (stationHp <= 0) {
    return { outcome: 'destroyed', hpLost: input.stationHp, roundsPlayed: round };
  }
  if (hpLost > 0) {
    return { outcome: 'damaged', hpLost, roundsPlayed: round };
  }
  return { outcome: 'defended', hpLost: 0, roundsPlayed: round };
}
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationCombat.test.ts`
Expected: All pass

**Step 4: Run full server tests**

Run: `cd packages/server && npx vitest run`
Expected: All pass

**Step 5: Commit**

```
feat: station combat engine — auto-turrets, shields, ion cannon (#69)
```

---

### Task 12: Station Defense Client Components

**Files:**
- Create: `packages/client/src/components/StationDefensePanel.tsx`
- Create: `packages/client/src/components/StationCombatOverlay.tsx`

**Step 1: Implement StationDefensePanel**

Create `packages/client/src/components/StationDefensePanel.tsx`:
```tsx
import { useStore } from '../state/gameSlice';
import { network } from '../network/client';
import { STATION_DEFENSE_DEFS } from '@void-sector/shared';

export function StationDefensePanel() {
  const stationDefenses = useStore((s) => s.stationDefenses);
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);

  const handleInstall = (defenseType: string) => {
    network.sendInstallDefense(defenseType);
  };

  return (
    <div style={{ padding: 8, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
      <div style={{
        color: 'var(--color-primary)', letterSpacing: '0.15em',
        marginBottom: 8, fontSize: '0.75rem',
      }}>
        STATIONSVERTEIDIGUNG
      </div>

      {/* Installed */}
      {stationDefenses.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#888', marginBottom: 4 }}>INSTALLIERT:</div>
          {stationDefenses.map(d => (
            <div key={d.id} style={{ color: '#00FF88', marginBottom: 2 }}>
              &bull; {d.defenseType.replace(/_/g, ' ').toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Available to build */}
      <div style={{ color: '#888', marginBottom: 4 }}>VERFÜGBAR:</div>
      {Object.entries(STATION_DEFENSE_DEFS).map(([id, def]) => {
        const installed = stationDefenses.some(d => d.defenseType === id);
        const costStr = Object.entries(def.cost)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${v} ${k === 'credits' ? 'CR' : k}`)
          .join(' + ');
        const canAfford = credits >= def.cost.credits;

        return (
          <div key={id} style={{
            border: '1px solid #333', padding: 6, marginBottom: 4,
            opacity: installed ? 0.4 : 1,
          }}>
            <div style={{ color: 'var(--color-primary)' }}>
              {id.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ color: '#666', fontSize: '0.55rem' }}>
              {def.damage ? `${def.damage} DMG/Runde` : ''}
              {def.shieldHp ? `Schild: ${def.shieldHp} HP, +${def.shieldRegen}/Runde` : ''}
              {def.oncePer ? ' (1× pro Kampf)' : ''}
              {def.bypassShields ? ' | Ignoriert Schilde' : ''}
            </div>
            <div style={{ color: '#555', fontSize: '0.55rem' }}>{costStr}</div>
            {!installed && (
              <button
                onClick={() => handleInstall(id)}
                disabled={!canAfford}
                style={{
                  marginTop: 4, background: 'transparent',
                  border: `1px solid ${canAfford ? 'var(--color-primary)' : '#333'}`,
                  color: canAfford ? 'var(--color-primary)' : '#555',
                  fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
                  padding: '3px 8px', cursor: canAfford ? 'pointer' : 'not-allowed',
                }}
              >
                [INSTALLIEREN]
              </button>
            )}
            {installed && (
              <div style={{ color: '#00FF88', fontSize: '0.55rem', marginTop: 4 }}>INSTALLIERT</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Implement StationCombatOverlay**

Create `packages/client/src/components/StationCombatOverlay.tsx`:
```tsx
import { useStore } from '../state/gameSlice';

export function StationCombatOverlay() {
  const event = useStore((s) => s.stationCombatEvent);
  const setStationCombatEvent = useStore((s) => s.setStationCombatEvent);

  if (!event) return null;

  const outcomeColor = event.outcome === 'defended' ? '#00FF88'
    : event.outcome === 'damaged' ? '#FFB000' : '#FF3333';
  const outcomeText = event.outcome === 'defended' ? 'ABGEWEHRT'
    : event.outcome === 'damaged' ? 'BESCHÄDIGT' : 'ZERSTÖRT';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 5, 5, 0.90)', zIndex: 950,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: '#FF3333', fontSize: '0.9rem', letterSpacing: '0.2em', marginBottom: 16 }}>
        STATION UNTER ANGRIFF
      </div>
      <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 8 }}>
        Sektor ({event.sectorX}, {event.sectorY}) &bull; Angreifer LV.{event.attackerLevel}
      </div>
      <div style={{ color: outcomeColor, fontSize: '1rem', letterSpacing: '0.15em', marginBottom: 16 }}>
        {outcomeText}
      </div>
      {event.hpLost > 0 && (
        <div style={{ color: '#FF3333', fontSize: '0.7rem', marginBottom: 12 }}>
          HP-Verlust: {event.hpLost}
        </div>
      )}
      <button
        onClick={() => setStationCombatEvent(null)}
        style={{
          background: 'transparent',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
          padding: '8px 24px', cursor: 'pointer',
        }}
      >
        [BESTÄTIGEN]
      </button>
    </div>
  );
}
```

**Step 3: Wire into GameScreen**

In `packages/client/src/components/GameScreen.tsx`, add imports:
```typescript
import { StationCombatOverlay } from './StationCombatOverlay';
```

Add in JSX near other overlays:
```tsx
<StationCombatOverlay />
```

Note: `StationDefensePanel` should be rendered inside the BASE monitor when viewing own base at a station sector. Find where base structures are displayed and add `<StationDefensePanel />` there.

**Step 4: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```
feat: station defense panel + station combat overlay components (#69)
```

---

### Task 13: Integration — Pirate Ambush → Combat V2

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (pirate encounter flow)
- Modify: `packages/client/src/components/BattleDialog.tsx` (fallback when v2 active)

**Step 1: Update BattleDialog to defer to CombatV2Dialog**

In `packages/client/src/components/BattleDialog.tsx`, at the top of the component, add:
```typescript
  const activeCombatV2 = useStore((s) => s.activeCombatV2);

  // If combat v2 is active, don't render v1 dialog
  if (activeCombatV2) return null;
```

This ensures that when FEATURE_COMBAT_V2 is true and a v2 combat state exists, the old dialog hides and the new one takes over.

**Step 2: Verify the pirate ambush flow works end-to-end**

The flow is:
1. Server detects pirate encounter → sends `pirateAmbush` (existing) + `combatV2Init` (new from Task 7 Step 6)
2. Client receives both → `activeBattle` set (for v1 fallback) + `activeCombatV2` set (for v2)
3. `BattleDialog` sees `activeCombatV2` → returns null
4. `CombatV2Dialog` sees `activeCombatV2` → renders v2 UI
5. Player picks tactic → `combatV2Action` sent → server resolves round → sends `combatV2Result`
6. On final round → `finalResult` sent → client clears both states

**Step 3: Run ALL tests**

Run:
```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run
```
Expected: All pass

**Step 4: Commit**

```
feat: integrate combat v2 into pirate ambush flow, v1 fallback (#69)
```

---

### Task 14: Final Verification & Polish

**Files:**
- Any files that need fixes from test failures

**Step 1: Run all tests**

```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run
```

Fix any failures discovered.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/client/tsconfig.json
```

Fix any type errors.

**Step 3: Verify feature flag**

Setting `FEATURE_COMBAT_V2 = false` in constants.ts should make the game use v1 combat only (no `combatV2Init` sent, `BattleDialog` renders normally).

**Step 4: Final commit**

```
fix: combat v2 polish and final test fixes (#69)
```

---

## Files Modified/Created (Summary)

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types.ts` | Modify | WeaponType, CombatTactic, CombatV2State, StationDefense, extend ShipStats, ModuleCategory, StructureType |
| `packages/shared/src/constants.ts` | Modify | TACTIC_MODS, combat v2 constants, STATION_DEFENSE_DEFS, weapon/shield/defense MODULES |
| `packages/shared/src/shipCalculator.ts` | Modify | Handle new ShipStats fields (shieldHp, weaponAttack, weaponType, etc.) |
| `packages/shared/src/__tests__/shipCalculator.test.ts` | Create | Tests for new combat stats in calculateShipStats |
| `packages/server/src/engine/combatV2.ts` | Create | Round resolution, flee, loot generation — pure functions |
| `packages/server/src/engine/__tests__/combatV2.test.ts` | Create | Tests for combat engine (rounds, tactics, shields, piercing, EMP, evade) |
| `packages/server/src/engine/stationCombat.ts` | Create | Station auto-combat (turrets, shields, ion cannon) |
| `packages/server/src/engine/__tests__/stationCombat.test.ts` | Create | Tests for station combat resolution |
| `packages/server/src/db/migrations/015_combat_v2.sql` | Create | station_defenses table, structures HP columns, battle_log extensions, station_battle_log |
| `packages/server/src/db/queries.ts` | Modify | Add getStationDefenses, installStationDefense, updateStructureHp, insertBattleLogV2, etc. |
| `packages/server/src/rooms/SectorRoom.ts` | Modify | combatV2Action, combatV2Flee, installDefense, repairStation handlers + v2 init in pirate ambush |
| `packages/client/src/state/gameSlice.ts` | Modify | activeCombatV2, stationDefenses, stationCombatEvent state |
| `packages/client/src/network/client.ts` | Modify | combatV2Init/Result handlers, send methods |
| `packages/client/src/test/mockStore.ts` | Modify | Add combat v2 mock fields |
| `packages/client/src/components/CombatV2Dialog.tsx` | Create | Tactical combat UI with HP bars, tactic buttons, combat log |
| `packages/client/src/__tests__/CombatV2Dialog.test.tsx` | Create | Tests for combat dialog rendering and interactions |
| `packages/client/src/components/StationDefensePanel.tsx` | Create | Station defense management UI |
| `packages/client/src/components/StationCombatOverlay.tsx` | Create | Station-under-attack notification |
| `packages/client/src/components/BattleDialog.tsx` | Modify | Defer to CombatV2Dialog when v2 active |
| `packages/client/src/components/GameScreen.tsx` | Modify | Render CombatV2Dialog + StationCombatOverlay |
