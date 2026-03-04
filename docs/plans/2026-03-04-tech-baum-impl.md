# Tech-Baum & Schiffsmodule Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a research/tech-tree system where Tier 2+ modules must be researched at home base or found as blueprints before they can be purchased and installed.

**Architecture:** Extend existing `ModuleDefinition` with research metadata (UI labels, costs, prerequisites, timers). Research state stored in PostgreSQL (`player_research` + `active_research` tables). Timer-based research (5-30 min) with lazy evaluation (no server tick — check completion on claim). Blueprint drops integrated into existing scan event system. New `TECH` monitor in client sidebar.

**Tech Stack:** TypeScript strict, Vitest, PostgreSQL, Colyseus (server), React + Zustand (client)

**Design doc:** `docs/plans/2026-03-04-tech-baum-design.md`

---

## Task 1: Shared Types — Extend ModuleDefinition, Add ResearchState

**Files:**
- Modify: `packages/shared/src/types.ts` (lines 792-822, 829-848)

**Step 1: Add new fields to ModuleDefinition**

In `packages/shared/src/types.ts`, extend `ModuleDefinition` (line 814-822):

```typescript
export interface ModuleDefinition {
  id: string;
  category: ModuleCategory;
  tier: ModuleTier;
  name: string;
  displayName: string;
  primaryEffect: { stat: string; delta: number; label: string };
  secondaryEffects: Array<{ stat: string; delta: number; label: string }>;
  effects: Partial<ShipStats>;
  cost: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number };
  researchCost?: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number };
  researchDurationMin?: number;
  prerequisite?: string;
  factionRequirement?: { factionId: string; minTier: string };
}
```

**Step 2: Add new ShipStats fields**

After `engineSpeed: number;` (line ~848), add:

```typescript
  artefactChanceBonus: number;
  safeSlotBonus: number;
```

**Step 3: Add ResearchState type**

After `ShipRecord` interface (line ~858), add:

```typescript
export interface ResearchState {
  unlockedModules: string[];
  blueprints: string[];
  activeResearch: {
    moduleId: string;
    startedAt: number;
    completesAt: number;
  } | null;
}
```

**Step 4: Run type check**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: Errors in `constants.ts` (MODULES missing new fields) and `shipCalculator.ts` (missing new ShipStats init). This is expected — we fix these in Tasks 2-3.

**Step 5: Commit**

```
feat: add ResearchState type and extend ModuleDefinition/ShipStats
```

---

## Task 2: Shared Constants — MODULES with Research Data + Spezial Modules

**Files:**
- Modify: `packages/shared/src/constants.ts` (lines 308-462 MODULES, lines 572-619 MONITORS)

**Step 1: Add research constants**

After the `ENGINE_SPEED` block (around line 720), add:

```typescript
// Research system
export const RESEARCH_TICK_MS = 60_000; // 1 tick = 1 minute
```

**Step 2: Update ALL existing MODULES entries**

Replace the entire `MODULES` record. Every module gets `primaryEffect`, `secondaryEffects`, and Tier 2+ modules get `researchCost`, `researchDurationMin`, `prerequisite`. Tier 1 modules and basic weapon/shield/defense modules that currently have no prerequisite chain get `researchCost` + `prerequisite` only if they are Tier 2+.

Full replacement for `MODULES`:

```typescript
export const MODULES: Record<string, ModuleDefinition> = {
  // === DRIVE ===
  drive_mk1: {
    id: 'drive_mk1', category: 'drive', tier: 1,
    name: 'ION DRIVE MK.I', displayName: 'ION MK.I',
    primaryEffect: { stat: 'jumpRange', delta: 1, label: 'Sprungweite +1' },
    secondaryEffects: [{ stat: 'engineSpeed', delta: 1, label: 'Engine-Speed +1' }],
    effects: { jumpRange: 1, engineSpeed: 1 },
    cost: { credits: 100, ore: 10 },
  },
  drive_mk2: {
    id: 'drive_mk2', category: 'drive', tier: 2,
    name: 'ION DRIVE MK.II', displayName: 'ION MK.II',
    primaryEffect: { stat: 'jumpRange', delta: 2, label: 'Sprungweite +2' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 2, label: 'Engine-Speed +2' },
      { stat: 'apCostJump', delta: -0.2, label: 'AP/Sprung -0.2' },
    ],
    effects: { jumpRange: 2, apCostJump: -0.2, engineSpeed: 2 },
    cost: { credits: 300, ore: 20, crystal: 5 },
    researchCost: { credits: 200, ore: 15 },
    researchDurationMin: 5,
    prerequisite: 'drive_mk1',
  },
  drive_mk3: {
    id: 'drive_mk3', category: 'drive', tier: 3,
    name: 'ION DRIVE MK.III', displayName: 'ION MK.III',
    primaryEffect: { stat: 'jumpRange', delta: 3, label: 'Sprungweite +3' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 3, label: 'Engine-Speed +3' },
      { stat: 'apCostJump', delta: -0.5, label: 'AP/Sprung -0.5' },
    ],
    effects: { jumpRange: 3, apCostJump: -0.5, engineSpeed: 3 },
    cost: { credits: 800, ore: 40, crystal: 15 },
    researchCost: { credits: 500, ore: 30, crystal: 10, artefact: 2 },
    researchDurationMin: 12,
    prerequisite: 'drive_mk2',
  },

  // === CARGO ===
  cargo_mk1: {
    id: 'cargo_mk1', category: 'cargo', tier: 1,
    name: 'CARGO BAY MK.I', displayName: 'CARGO MK.I',
    primaryEffect: { stat: 'cargoCap', delta: 5, label: 'Frachtraum +5' },
    secondaryEffects: [],
    effects: { cargoCap: 5 },
    cost: { credits: 80 },
  },
  cargo_mk2: {
    id: 'cargo_mk2', category: 'cargo', tier: 2,
    name: 'CARGO BAY MK.II', displayName: 'CARGO MK.II',
    primaryEffect: { stat: 'cargoCap', delta: 12, label: 'Frachtraum +12' },
    secondaryEffects: [{ stat: 'safeSlotBonus', delta: 1, label: 'Safe-Slot +1' }],
    effects: { cargoCap: 12, safeSlotBonus: 1 },
    cost: { credits: 250, ore: 15 },
    researchCost: { credits: 150, ore: 10 },
    researchDurationMin: 5,
    prerequisite: 'cargo_mk1',
  },
  cargo_mk3: {
    id: 'cargo_mk3', category: 'cargo', tier: 3,
    name: 'CARGO BAY MK.III', displayName: 'CARGO MK.III',
    primaryEffect: { stat: 'cargoCap', delta: 25, label: 'Frachtraum +25' },
    secondaryEffects: [
      { stat: 'safeSlotBonus', delta: 2, label: 'Safe-Slot +2' },
      { stat: 'fuelMax', delta: 20, label: 'Fuel-Tank +20' },
    ],
    effects: { cargoCap: 25, safeSlotBonus: 2, fuelMax: 20 },
    cost: { credits: 600, ore: 30, gas: 10 },
    researchCost: { credits: 400, ore: 25, artefact: 1 },
    researchDurationMin: 10,
    prerequisite: 'cargo_mk2',
  },

  // === SCANNER ===
  scanner_mk1: {
    id: 'scanner_mk1', category: 'scanner', tier: 1,
    name: 'SCANNER MK.I', displayName: 'SCAN MK.I',
    primaryEffect: { stat: 'scannerLevel', delta: 1, label: 'Scan-Level +1' },
    secondaryEffects: [],
    effects: { scannerLevel: 1 },
    cost: { credits: 120, crystal: 5 },
  },
  scanner_mk2: {
    id: 'scanner_mk2', category: 'scanner', tier: 2,
    name: 'SCANNER MK.II', displayName: 'SCAN MK.II',
    primaryEffect: { stat: 'scannerLevel', delta: 1, label: 'Scan-Level +1' },
    secondaryEffects: [{ stat: 'commRange', delta: 50, label: 'Komm-Reichweite +50' }],
    effects: { scannerLevel: 1, commRange: 50 },
    cost: { credits: 350, crystal: 15 },
    researchCost: { credits: 200, crystal: 10 },
    researchDurationMin: 5,
    prerequisite: 'scanner_mk1',
  },
  scanner_mk3: {
    id: 'scanner_mk3', category: 'scanner', tier: 3,
    name: 'SCANNER MK.III', displayName: 'SCAN MK.III',
    primaryEffect: { stat: 'scannerLevel', delta: 2, label: 'Scan-Level +2' },
    secondaryEffects: [
      { stat: 'commRange', delta: 100, label: 'Komm-Reichweite +100' },
      { stat: 'artefactChanceBonus', delta: 0.03, label: 'Artefakt-Chance +3%' },
    ],
    effects: { scannerLevel: 2, commRange: 100, artefactChanceBonus: 0.03 },
    cost: { credits: 900, crystal: 30, gas: 10 },
    researchCost: { credits: 600, crystal: 20, artefact: 3 },
    researchDurationMin: 15,
    prerequisite: 'scanner_mk2',
  },

  // === ARMOR ===
  armor_mk1: {
    id: 'armor_mk1', category: 'armor', tier: 1,
    name: 'ARMOR PLATING MK.I', displayName: 'ARM MK.I',
    primaryEffect: { stat: 'hp', delta: 25, label: 'HP +25' },
    secondaryEffects: [],
    effects: { hp: 25 },
    cost: { credits: 100, ore: 15 },
  },
  armor_mk2: {
    id: 'armor_mk2', category: 'armor', tier: 2,
    name: 'ARMOR PLATING MK.II', displayName: 'ARM MK.II',
    primaryEffect: { stat: 'hp', delta: 50, label: 'HP +50' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.10, label: 'Schadensreduktion -10%' }],
    effects: { hp: 50, damageMod: -0.10 },
    cost: { credits: 300, ore: 30, crystal: 10 },
    researchCost: { credits: 200, ore: 20 },
    researchDurationMin: 5,
    prerequisite: 'armor_mk1',
  },
  armor_mk3: {
    id: 'armor_mk3', category: 'armor', tier: 3,
    name: 'ARMOR PLATING MK.III', displayName: 'ARM MK.III',
    primaryEffect: { stat: 'hp', delta: 100, label: 'HP +100' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.25, label: 'Schadensreduktion -25%' }],
    effects: { hp: 100, damageMod: -0.25 },
    cost: { credits: 800, ore: 50, crystal: 25 },
    researchCost: { credits: 500, ore: 40, artefact: 2 },
    researchDurationMin: 12,
    prerequisite: 'armor_mk2',
  },

  // === WEAPONS ===
  laser_mk1: {
    id: 'laser_mk1', category: 'weapon', tier: 1,
    name: 'PULS-LASER MK.I', displayName: 'LASER MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 8, label: 'ATK +8' },
    secondaryEffects: [],
    effects: { weaponAttack: 8, weaponType: 'laser' as any },
    cost: { credits: 150, crystal: 10 },
    researchCost: { credits: 200, crystal: 10 },
    researchDurationMin: 5,
  },
  laser_mk2: {
    id: 'laser_mk2', category: 'weapon', tier: 2,
    name: 'PULS-LASER MK.II', displayName: 'LASER MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 16, label: 'ATK +16' },
    secondaryEffects: [],
    effects: { weaponAttack: 16, weaponType: 'laser' as any },
    cost: { credits: 450, crystal: 25, gas: 10 },
    researchCost: { credits: 600, crystal: 25, gas: 10 },
    researchDurationMin: 10,
    prerequisite: 'laser_mk1',
  },
  laser_mk3: {
    id: 'laser_mk3', category: 'weapon', tier: 3,
    name: 'PULS-LASER MK.III', displayName: 'LASER MK.III',
    primaryEffect: { stat: 'weaponAttack', delta: 28, label: 'ATK +28' },
    secondaryEffects: [],
    effects: { weaponAttack: 28, weaponType: 'laser' as any },
    cost: { credits: 1200, crystal: 50, gas: 20 },
    researchCost: { credits: 1500, crystal: 50, gas: 20 },
    researchDurationMin: 18,
    prerequisite: 'laser_mk2',
  },
  railgun_mk1: {
    id: 'railgun_mk1', category: 'weapon', tier: 1,
    name: 'RAIL-KANONE MK.I', displayName: 'RAIL MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 12, label: 'ATK +12' },
    secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.30, label: 'Panzerbrechend 30%' }],
    effects: { weaponAttack: 12, weaponPiercing: 0.30, weaponType: 'railgun' as any },
    cost: { credits: 300, ore: 30, crystal: 15 },
    researchCost: { credits: 400, ore: 30, crystal: 15 },
    researchDurationMin: 8,
    prerequisite: 'laser_mk1',
  },
  railgun_mk2: {
    id: 'railgun_mk2', category: 'weapon', tier: 2,
    name: 'RAIL-KANONE MK.II', displayName: 'RAIL MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 22, label: 'ATK +22' },
    secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.50, label: 'Panzerbrechend 50%' }],
    effects: { weaponAttack: 22, weaponPiercing: 0.50, weaponType: 'railgun' as any },
    cost: { credits: 900, ore: 60, crystal: 30 },
    researchCost: { credits: 1000, ore: 60, crystal: 30, artefact: 1 },
    researchDurationMin: 15,
    prerequisite: 'railgun_mk1',
  },
  missile_mk1: {
    id: 'missile_mk1', category: 'weapon', tier: 1,
    name: 'RAKETEN-POD MK.I', displayName: 'RAKET MK.I',
    primaryEffect: { stat: 'weaponAttack', delta: 18, label: 'ATK +18' },
    secondaryEffects: [],
    effects: { weaponAttack: 18, weaponType: 'missile' as any },
    cost: { credits: 250, ore: 20, crystal: 5 },
    researchCost: { credits: 300, ore: 20, crystal: 5 },
    researchDurationMin: 7,
  },
  missile_mk2: {
    id: 'missile_mk2', category: 'weapon', tier: 2,
    name: 'RAKETEN-POD MK.II', displayName: 'RAKET MK.II',
    primaryEffect: { stat: 'weaponAttack', delta: 30, label: 'ATK +30' },
    secondaryEffects: [],
    effects: { weaponAttack: 30, weaponType: 'missile' as any },
    cost: { credits: 750, ore: 40, crystal: 15 },
    researchCost: { credits: 900, ore: 40, crystal: 15 },
    researchDurationMin: 12,
    prerequisite: 'missile_mk1',
  },
  emp_array: {
    id: 'emp_array', category: 'weapon', tier: 2,
    name: 'EMP-EMITTER', displayName: 'EMP',
    primaryEffect: { stat: 'weaponAttack', delta: 0, label: 'EMP (kein Schaden)' },
    secondaryEffects: [],
    effects: { weaponAttack: 0, weaponType: 'emp' as any },
    cost: { credits: 500, crystal: 20, gas: 20 },
    researchCost: { credits: 600, crystal: 20, gas: 20, artefact: 2 },
    researchDurationMin: 12,
    prerequisite: 'laser_mk2',
  },

  // === SHIELDS ===
  shield_mk1: {
    id: 'shield_mk1', category: 'shield', tier: 1,
    name: 'SCHILD-GEN MK.I', displayName: 'SHLD MK.I',
    primaryEffect: { stat: 'shieldHp', delta: 30, label: 'Schild +30' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 3, label: 'Schild-Regen +3' }],
    effects: { shieldHp: 30, shieldRegen: 3 },
    cost: { credits: 200, crystal: 15 },
    researchCost: { credits: 300, crystal: 15 },
    researchDurationMin: 7,
    prerequisite: 'armor_mk1',
  },
  shield_mk2: {
    id: 'shield_mk2', category: 'shield', tier: 2,
    name: 'SCHILD-GEN MK.II', displayName: 'SHLD MK.II',
    primaryEffect: { stat: 'shieldHp', delta: 60, label: 'Schild +60' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 6, label: 'Schild-Regen +6' }],
    effects: { shieldHp: 60, shieldRegen: 6 },
    cost: { credits: 600, crystal: 35, gas: 10 },
    researchCost: { credits: 700, crystal: 35, gas: 10, artefact: 2 },
    researchDurationMin: 15,
    prerequisite: 'shield_mk1',
  },
  shield_mk3: {
    id: 'shield_mk3', category: 'shield', tier: 3,
    name: 'SCHILD-GEN MK.III', displayName: 'SHLD MK.III',
    primaryEffect: { stat: 'shieldHp', delta: 100, label: 'Schild +100' },
    secondaryEffects: [{ stat: 'shieldRegen', delta: 12, label: 'Schild-Regen +12' }],
    effects: { shieldHp: 100, shieldRegen: 12 },
    cost: { credits: 1500, crystal: 70, gas: 25 },
    researchCost: { credits: 1500, crystal: 70, gas: 25 },
    researchDurationMin: 20,
    prerequisite: 'shield_mk2',
  },

  // === DEFENSE ===
  point_defense: {
    id: 'point_defense', category: 'defense', tier: 2,
    name: 'PUNKT-VERTEIDIGUNG', displayName: 'PD',
    primaryEffect: { stat: 'pointDefense', delta: 0.60, label: 'Punkt-Verteidigung 60%' },
    secondaryEffects: [],
    effects: { pointDefense: 0.60 },
    cost: { credits: 350, ore: 20, crystal: 10 },
    researchCost: { credits: 400, ore: 20, crystal: 10 },
    researchDurationMin: 8,
    prerequisite: 'armor_mk2',
  },
  ecm_suite: {
    id: 'ecm_suite', category: 'defense', tier: 2,
    name: 'ECM-SUITE', displayName: 'ECM',
    primaryEffect: { stat: 'ecmReduction', delta: 0.15, label: 'ECM -15% feindl. Genauigkeit' },
    secondaryEffects: [],
    effects: { ecmReduction: 0.15 },
    cost: { credits: 400, crystal: 25, gas: 15 },
    researchCost: { credits: 500, crystal: 25, gas: 15 },
    researchDurationMin: 10,
    prerequisite: 'scanner_mk2',
  },

  // === SPEZIAL-MODULE ===
  void_drive: {
    id: 'void_drive', category: 'drive', tier: 3,
    name: 'VOID DRIVE', displayName: 'VOID',
    primaryEffect: { stat: 'jumpRange', delta: 6, label: 'Sprungweite +6' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 5, label: 'Engine-Speed MAX' },
      { stat: 'fuelPerJump', delta: -3, label: 'Fuel/Sprung -3' },
    ],
    effects: { jumpRange: 6, engineSpeed: 5, fuelPerJump: -3 },
    cost: { credits: 2000, artefact: 5 },
    researchCost: { credits: 2000, artefact: 10 },
    researchDurationMin: 30,
    prerequisite: 'drive_mk3',
    factionRequirement: { factionId: 'ancients', minTier: 'honored' },
  },
  quantum_scanner: {
    id: 'quantum_scanner', category: 'scanner', tier: 3,
    name: 'QUANTUM-SCANNER', displayName: 'Q-SCAN',
    primaryEffect: { stat: 'scannerLevel', delta: 3, label: 'Scan-Level +3' },
    secondaryEffects: [
      { stat: 'commRange', delta: 200, label: 'Komm-Reichweite +200' },
      { stat: 'artefactChanceBonus', delta: 0.05, label: 'Artefakt-Chance +5%' },
    ],
    effects: { scannerLevel: 3, commRange: 200, artefactChanceBonus: 0.05 },
    cost: { credits: 1500, crystal: 50 },
    researchCost: { credits: 1500, crystal: 50, artefact: 8 },
    researchDurationMin: 25,
    prerequisite: 'scanner_mk3',
  },
  nano_armor: {
    id: 'nano_armor', category: 'armor', tier: 3,
    name: 'NANO-PANZERUNG', displayName: 'NANO',
    primaryEffect: { stat: 'hp', delta: 150, label: 'HP +150' },
    secondaryEffects: [{ stat: 'damageMod', delta: -0.35, label: 'Schadensreduktion -35%' }],
    effects: { hp: 150, damageMod: -0.35 },
    cost: { credits: 1800, ore: 50, crystal: 50 },
    researchCost: { credits: 1800, ore: 50, crystal: 50, artefact: 15 },
    researchDurationMin: 30,
    prerequisite: 'armor_mk3',
  },
};
```

**Step 3: Add TECH monitor**

In the `MONITORS` const (line ~572), add `TECH: 'TECH'`. Add `MONITORS.TECH` to `RIGHT_SIDEBAR_MONITORS`, `LEFT_SIDEBAR_MONITORS`, and `MAIN_MONITORS` arrays.

**Step 4: Run type check**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: Errors in `shipCalculator.ts` only (missing new ShipStats fields). Fix in Task 3.

**Step 5: Commit**

```
feat: update all MODULES with research data, add spezial modules, TECH monitor
```

---

## Task 3: Shared — shipCalculator + Research Validation

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts`
- Create: `packages/shared/src/research.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Update shipCalculator**

Add `artefactChanceBonus: 0` and `safeSlotBonus: 0` to the initial stats object in `calculateShipStats`, after `engineSpeed`:

```typescript
    engineSpeed: hull.baseEngineSpeed,
    artefactChanceBonus: 0,
    safeSlotBonus: 0,
```

No clamp needed for these fields (they only go up).

**Step 2: Create research validation helper**

Create `packages/shared/src/research.ts`:

```typescript
import { MODULES } from './constants.js';
import type { ResearchState, ModuleDefinition } from './types.js';

/** Returns true if a module is available without research (Tier 1 with no researchCost) */
export function isModuleFreelyAvailable(moduleId: string): boolean {
  const mod = MODULES[moduleId];
  if (!mod) return false;
  return !mod.researchCost;
}

/** Returns true if a module is unlocked (researched, blueprint, or freely available) */
export function isModuleUnlocked(moduleId: string, research: ResearchState): boolean {
  if (isModuleFreelyAvailable(moduleId)) return true;
  return research.unlockedModules.includes(moduleId) || research.blueprints.includes(moduleId);
}

/** Checks if research can be started for a module */
export function canStartResearch(
  moduleId: string,
  research: ResearchState,
  resources: { credits: number; ore: number; gas: number; crystal: number; artefact: number },
  factionTiers?: Record<string, string>,
): { valid: boolean; error?: string } {
  const mod = MODULES[moduleId];
  if (!mod) return { valid: false, error: 'Unknown module' };
  if (!mod.researchCost) return { valid: false, error: 'Module does not require research' };
  if (isModuleUnlocked(moduleId, research)) return { valid: false, error: 'Already unlocked' };
  if (research.activeResearch) return { valid: false, error: 'Research already in progress' };

  // Check prerequisite
  if (mod.prerequisite && !isModuleUnlocked(mod.prerequisite, research)) {
    return { valid: false, error: `Prerequisite not met: ${MODULES[mod.prerequisite]?.name ?? mod.prerequisite}` };
  }

  // Check faction requirement
  if (mod.factionRequirement) {
    const playerTier = factionTiers?.[mod.factionRequirement.factionId];
    if (!playerTier || !meetsMinTier(playerTier, mod.factionRequirement.minTier)) {
      return { valid: false, error: `Faction requirement: ${mod.factionRequirement.factionId} ${mod.factionRequirement.minTier}` };
    }
  }

  // Check resources
  const cost = mod.researchCost;
  if (resources.credits < cost.credits) return { valid: false, error: 'Not enough credits' };
  if ((cost.ore ?? 0) > resources.ore) return { valid: false, error: 'Not enough ore' };
  if ((cost.gas ?? 0) > resources.gas) return { valid: false, error: 'Not enough gas' };
  if ((cost.crystal ?? 0) > resources.crystal) return { valid: false, error: 'Not enough crystal' };
  if ((cost.artefact ?? 0) > resources.artefact) return { valid: false, error: 'Not enough artefacts' };

  return { valid: true };
}

const TIER_ORDER = ['hostile', 'unfriendly', 'neutral', 'friendly', 'honored'];

function meetsMinTier(current: string, required: string): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}
```

**Step 3: Export from index.ts**

Add to `packages/shared/src/index.ts`:

```typescript
export { isModuleFreelyAvailable, isModuleUnlocked, canStartResearch } from './research.js';
```

**Step 4: Type check**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: PASS (no errors)

**Step 5: Commit**

```
feat: add research validation helpers and update shipCalculator
```

---

## Task 4: Shared Tests

**Files:**
- Modify: `packages/shared/src/__tests__/shipCalculator.test.ts`
- Create: `packages/shared/src/__tests__/research.test.ts`

**Step 1: Write research tests**

Create `packages/shared/src/__tests__/research.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isModuleFreelyAvailable, isModuleUnlocked, canStartResearch } from '../research.js';
import type { ResearchState } from '../types.js';
import { MODULES } from '../constants.js';

const emptyResearch: ResearchState = {
  unlockedModules: [],
  blueprints: [],
  activeResearch: null,
};

const fullResources = { credits: 99999, ore: 9999, gas: 9999, crystal: 9999, artefact: 99 };
const noResources = { credits: 0, ore: 0, gas: 0, crystal: 0, artefact: 0 };

describe('isModuleFreelyAvailable', () => {
  it('returns true for Tier 1 modules without researchCost', () => {
    expect(isModuleFreelyAvailable('drive_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('cargo_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('armor_mk1')).toBe(true);
    expect(isModuleFreelyAvailable('scanner_mk1')).toBe(true);
  });

  it('returns false for Tier 2+ modules with researchCost', () => {
    expect(isModuleFreelyAvailable('drive_mk2')).toBe(false);
    expect(isModuleFreelyAvailable('shield_mk1')).toBe(false);
    expect(isModuleFreelyAvailable('void_drive')).toBe(false);
  });

  it('returns false for unknown module', () => {
    expect(isModuleFreelyAvailable('nonexistent')).toBe(false);
  });
});

describe('isModuleUnlocked', () => {
  it('freely available modules are always unlocked', () => {
    expect(isModuleUnlocked('drive_mk1', emptyResearch)).toBe(true);
  });

  it('researched modules are unlocked', () => {
    const research: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    expect(isModuleUnlocked('drive_mk2', research)).toBe(true);
  });

  it('blueprint modules are unlocked', () => {
    const research: ResearchState = { ...emptyResearch, blueprints: ['scanner_mk3'] };
    expect(isModuleUnlocked('scanner_mk3', research)).toBe(true);
  });

  it('locked modules are not unlocked', () => {
    expect(isModuleUnlocked('drive_mk2', emptyResearch)).toBe(false);
  });
});

describe('canStartResearch', () => {
  it('allows research when prerequisite met and resources available', () => {
    const research: ResearchState = { ...emptyResearch, unlockedModules: [] };
    // drive_mk2 needs drive_mk1 as prerequisite, but drive_mk1 is freely available
    const result = canStartResearch('drive_mk2', research, fullResources);
    expect(result.valid).toBe(true);
  });

  it('rejects when prerequisite not met', () => {
    // drive_mk3 needs drive_mk2 researched
    const result = canStartResearch('drive_mk3', emptyResearch, fullResources);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Prerequisite');
  });

  it('rejects when already unlocked', () => {
    const research: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    const result = canStartResearch('drive_mk2', research, fullResources);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Already unlocked');
  });

  it('rejects when research already in progress', () => {
    const research: ResearchState = {
      ...emptyResearch,
      activeResearch: { moduleId: 'cargo_mk2', startedAt: Date.now(), completesAt: Date.now() + 60000 },
    };
    const result = canStartResearch('drive_mk2', research, fullResources);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already in progress');
  });

  it('rejects when not enough credits', () => {
    const result = canStartResearch('drive_mk2', emptyResearch, noResources);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('credits');
  });

  it('rejects when not enough artefacts', () => {
    const research: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    const lowArtefact = { ...fullResources, artefact: 0 };
    const result = canStartResearch('drive_mk3', research, lowArtefact);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('artefact');
  });

  it('rejects freely available modules', () => {
    const result = canStartResearch('drive_mk1', emptyResearch, fullResources);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not require');
  });

  it('rejects when faction requirement not met', () => {
    const research: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk3'] };
    const result = canStartResearch('void_drive', research, fullResources, { ancients: 'friendly' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Faction');
  });

  it('allows when faction requirement met', () => {
    const research: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk3'] };
    const result = canStartResearch('void_drive', research, fullResources, { ancients: 'honored' });
    expect(result.valid).toBe(true);
  });
});

describe('MODULES primaryEffect/secondaryEffects', () => {
  it('all modules have primaryEffect', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      expect(mod.primaryEffect, `${id} missing primaryEffect`).toBeDefined();
      expect(mod.primaryEffect.label, `${id} missing primaryEffect.label`).toBeTruthy();
    }
  });

  it('all modules have secondaryEffects array', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      expect(Array.isArray(mod.secondaryEffects), `${id} missing secondaryEffects`).toBe(true);
    }
  });

  it('all Tier 2+ with researchCost have prerequisite or are root weapons', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.researchCost && !mod.prerequisite) {
        // Only laser_mk1, missile_mk1 can have research without prerequisite
        expect(['laser_mk1', 'missile_mk1']).toContain(id);
      }
    }
  });

  it('spezial modules exist', () => {
    expect(MODULES.void_drive).toBeDefined();
    expect(MODULES.quantum_scanner).toBeDefined();
    expect(MODULES.nano_armor).toBeDefined();
  });

  it('void_drive has faction requirement', () => {
    expect(MODULES.void_drive.factionRequirement).toEqual({ factionId: 'ancients', minTier: 'honored' });
  });
});
```

**Step 2: Update shipCalculator tests**

Add to `packages/shared/src/__tests__/shipCalculator.test.ts`:

```typescript
it('includes artefactChanceBonus from scanner_mk3', () => {
  const stats = calculateShipStats('scout', [{ moduleId: 'scanner_mk3', slotIndex: 0 }]);
  expect(stats.artefactChanceBonus).toBe(0.03);
});

it('includes safeSlotBonus from cargo_mk2', () => {
  const stats = calculateShipStats('scout', [{ moduleId: 'cargo_mk2', slotIndex: 0 }]);
  expect(stats.safeSlotBonus).toBe(1);
});

it('stacks safeSlotBonus from multiple cargo modules', () => {
  const stats = calculateShipStats('explorer', [
    { moduleId: 'cargo_mk2', slotIndex: 0 },
    { moduleId: 'cargo_mk3', slotIndex: 1 },
  ]);
  expect(stats.safeSlotBonus).toBe(3);
});
```

**Step 3: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```
test: add research and module research data tests
```

---

## Task 5: Server — DB Migration 018

**Files:**
- Create: `packages/server/src/db/migrations/018_research.sql`

**Step 1: Write migration**

```sql
-- Tech-Baum: Research state per player
CREATE TABLE IF NOT EXISTS player_research (
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  unlocked_modules TEXT[]  NOT NULL DEFAULT '{}',
  blueprints       TEXT[]  NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_player_research_user ON player_research(user_id);

-- Active research project (one per player)
CREATE TABLE IF NOT EXISTS active_research (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  module_id     TEXT    NOT NULL,
  started_at    BIGINT  NOT NULL,
  completes_at  BIGINT  NOT NULL
);
```

**Step 2: Commit**

```
feat: add migration 018 for research tables
```

---

## Task 6: Server — Research DB Queries

**Files:**
- Modify: `packages/server/src/db/queries.ts`

**Step 1: Add research queries**

Add at the end of `queries.ts`:

```typescript
// --- Tech-Baum: Research ---

export async function getPlayerResearch(userId: number): Promise<{ unlockedModules: string[]; blueprints: string[] }> {
  const { rows } = await query(
    'SELECT unlocked_modules, blueprints FROM player_research WHERE user_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    return { unlockedModules: [], blueprints: [] };
  }
  return {
    unlockedModules: rows[0].unlocked_modules ?? [],
    blueprints: rows[0].blueprints ?? [],
  };
}

export async function addUnlockedModule(userId: number, moduleId: string): Promise<void> {
  await query(
    `INSERT INTO player_research (user_id, unlocked_modules)
     VALUES ($1, ARRAY[$2::text])
     ON CONFLICT (user_id) DO UPDATE
     SET unlocked_modules = array_append(player_research.unlocked_modules, $2::text)`,
    [userId, moduleId]
  );
}

export async function addBlueprint(userId: number, moduleId: string): Promise<void> {
  await query(
    `INSERT INTO player_research (user_id, blueprints)
     VALUES ($1, ARRAY[$2::text])
     ON CONFLICT (user_id) DO UPDATE
     SET blueprints = array_append(player_research.blueprints, $2::text)`,
    [userId, moduleId]
  );
}

export async function getActiveResearch(userId: number): Promise<{
  moduleId: string; startedAt: number; completesAt: number;
} | null> {
  const { rows } = await query(
    'SELECT module_id, started_at, completes_at FROM active_research WHERE user_id = $1',
    [userId]
  );
  if (rows.length === 0) return null;
  return {
    moduleId: rows[0].module_id,
    startedAt: Number(rows[0].started_at),
    completesAt: Number(rows[0].completes_at),
  };
}

export async function startActiveResearch(
  userId: number, moduleId: string, startedAt: number, completesAt: number
): Promise<void> {
  await query(
    `INSERT INTO active_research (user_id, module_id, started_at, completes_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
     SET module_id = $2, started_at = $3, completes_at = $4`,
    [userId, moduleId, startedAt, completesAt]
  );
}

export async function deleteActiveResearch(userId: number): Promise<void> {
  await query('DELETE FROM active_research WHERE user_id = $1', [userId]);
}
```

**Step 2: Commit**

```
feat: add research CRUD queries
```

---

## Task 7: Server — Research Handlers in SectorRoom

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add imports**

Add to the `@void-sector/shared` import: `MODULES, RESEARCH_TICK_MS, isModuleUnlocked, isModuleFreelyAvailable, canStartResearch`

Add to `queries.ts` import: `getPlayerResearch, addUnlockedModule, addBlueprint, getActiveResearch, startActiveResearch, deleteActiveResearch`

Add to shared types import: `ResearchState`

**Step 2: Add message handlers in onCreate**

In the `onCreate` method, after the existing `onMessage` registrations, add:

```typescript
this.onMessage('startResearch', (client, data) => this.handleStartResearch(client, data));
this.onMessage('cancelResearch', (client) => this.handleCancelResearch(client));
this.onMessage('claimResearch', (client) => this.handleClaimResearch(client));
this.onMessage('activateBlueprint', (client, data) => this.handleActivateBlueprint(client, data));
this.onMessage('getResearchState', (client) => this.handleGetResearchState(client));
```

**Step 3: Add handler methods**

```typescript
private async handleGetResearchState(client: Client) {
  const auth = client.auth as AuthPayload;
  const research = await getPlayerResearch(auth.userId);
  const active = await getActiveResearch(auth.userId);
  client.send('researchState', {
    unlockedModules: research.unlockedModules,
    blueprints: research.blueprints,
    activeResearch: active,
  });
}

private async handleStartResearch(client: Client, data: { moduleId: string }) {
  const auth = client.auth as AuthPayload;
  const mod = MODULES[data.moduleId];
  if (!mod || !mod.researchCost) {
    client.send('researchResult', { success: false, error: 'Invalid module' });
    return;
  }

  // Must be at home base
  const homeBase = await getPlayerHomeBase(auth.userId);
  if (!homeBase || homeBase.x !== this.state.sector.x || homeBase.y !== this.state.sector.y) {
    client.send('researchResult', { success: false, error: 'Must be at home base' });
    return;
  }

  // Build research state
  const dbResearch = await getPlayerResearch(auth.userId);
  const active = await getActiveResearch(auth.userId);
  const researchState: ResearchState = {
    unlockedModules: dbResearch.unlockedModules,
    blueprints: dbResearch.blueprints,
    activeResearch: active,
  };

  // Get player resources
  const credits = await getPlayerCredits(auth.userId);
  const cargo = await getPlayerCargo(auth.userId);
  const storage = await getStorageInventory(auth.userId, this.state.sector.x, this.state.sector.y);

  const resources = {
    credits,
    ore: cargo.ore + (storage?.ore ?? 0),
    gas: cargo.gas + (storage?.gas ?? 0),
    crystal: cargo.crystal + (storage?.crystal ?? 0),
    artefact: cargo.artefact + (storage?.artefact ?? 0),
  };

  // Check faction tiers for spezial modules
  const reps = await getPlayerReputations(auth.userId);
  const factionTiers: Record<string, string> = {};
  for (const rep of reps) {
    const tier = getReputationTier(rep.reputation);
    factionTiers[rep.factionId] = tier;
  }

  const validation = canStartResearch(data.moduleId, researchState, resources, factionTiers);
  if (!validation.valid) {
    client.send('researchResult', { success: false, error: validation.error });
    return;
  }

  // Deduct costs (from credits first, then cargo for resources)
  const cost = mod.researchCost!;
  await deductCredits(auth.userId, cost.credits);
  if (cost.ore) await deductCargo(auth.userId, 'ore', cost.ore);
  if (cost.gas) await deductCargo(auth.userId, 'gas', cost.gas);
  if (cost.crystal) await deductCargo(auth.userId, 'crystal', cost.crystal);
  if (cost.artefact) await deductCargo(auth.userId, 'artefact', cost.artefact);

  // Start research timer
  const now = Date.now();
  const durationMs = (mod.researchDurationMin ?? 5) * RESEARCH_TICK_MS;
  await startActiveResearch(auth.userId, data.moduleId, now, now + durationMs);

  client.send('researchResult', {
    success: true,
    activeResearch: { moduleId: data.moduleId, startedAt: now, completesAt: now + durationMs },
  });
}

private async handleCancelResearch(client: Client) {
  const auth = client.auth as AuthPayload;
  const active = await getActiveResearch(auth.userId);
  if (!active) {
    client.send('researchResult', { success: false, error: 'No active research' });
    return;
  }
  await deleteActiveResearch(auth.userId);
  client.send('researchResult', { success: true, activeResearch: null });
}

private async handleClaimResearch(client: Client) {
  const auth = client.auth as AuthPayload;
  const active = await getActiveResearch(auth.userId);
  if (!active) {
    client.send('researchResult', { success: false, error: 'No active research' });
    return;
  }
  if (Date.now() < active.completesAt) {
    client.send('researchResult', { success: false, error: 'Research not complete' });
    return;
  }

  await addUnlockedModule(auth.userId, active.moduleId);
  await deleteActiveResearch(auth.userId);

  const research = await getPlayerResearch(auth.userId);
  client.send('researchResult', {
    success: true,
    claimed: active.moduleId,
    unlockedModules: research.unlockedModules,
    activeResearch: null,
  });
  client.send('logEntry', `FORSCHUNG ABGESCHLOSSEN: ${MODULES[active.moduleId]?.name ?? active.moduleId}`);
}

private async handleActivateBlueprint(client: Client, data: { moduleId: string }) {
  const auth = client.auth as AuthPayload;
  const research = await getPlayerResearch(auth.userId);
  if (!research.blueprints.includes(data.moduleId)) {
    client.send('researchResult', { success: false, error: 'Blueprint not found' });
    return;
  }

  // Move from blueprints to unlocked
  await addUnlockedModule(auth.userId, data.moduleId);
  // Remove from blueprints array
  await query(
    `UPDATE player_research SET blueprints = array_remove(blueprints, $2::text) WHERE user_id = $1`,
    [auth.userId, data.moduleId]
  );

  const updated = await getPlayerResearch(auth.userId);
  client.send('researchResult', {
    success: true,
    activated: data.moduleId,
    unlockedModules: updated.unlockedModules,
    blueprints: updated.blueprints,
  });
  client.send('logEntry', `BLAUPAUSE AKTIVIERT: ${MODULES[data.moduleId]?.name ?? data.moduleId}`);
}
```

**Step 4: Update existing buyModule handler**

In the existing `buyModule` handler, add research check after module existence validation:

```typescript
// Check if module is unlocked (research/blueprint/tier1)
const dbResearch = await getPlayerResearch(auth.userId);
const researchState: ResearchState = { ...dbResearch, activeResearch: null };
if (!isModuleUnlocked(data.moduleId, researchState)) {
  client.send('error', { code: 'MODULE_LOCKED', message: 'Module not researched' });
  return;
}
```

**Step 5: Send research state on join**

In `onJoin`, after existing ship data is sent, add:

```typescript
// Send research state
const research = await getPlayerResearch(auth.userId);
const activeResearch = await getActiveResearch(auth.userId);
client.send('researchState', {
  unlockedModules: research.unlockedModules,
  blueprints: research.blueprints,
  activeResearch: activeResearch,
});
```

**Step 6: Commit**

```
feat: add research handlers, buyModule gate, join-time research state
```

---

## Task 8: Server — Blueprint Drops in Scan Events

**Files:**
- Modify: `packages/server/src/engine/scanEvents.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts` (completeScanEvent handler)

**Step 1: Add blueprint_find to scan event types**

In `scanEvents.ts`, add to `ScanEventType`:

```typescript
export type ScanEventType = 'pirate_ambush' | 'distress_signal' | 'anomaly_reading' | 'artifact_find' | 'blueprint_find';
```

Add to `EVENT_TYPE_WEIGHTS` (adjust weights to include blueprint_find at 5%, reduce others proportionally):

```typescript
{ type: 'blueprint_find', weight: 0.05, immediate: false },
```

Adjust existing weights so total remains 1.0 (reduce `anomaly_reading` by 0.05).

In `generateEventData`, add a case for `blueprint_find` that picks a random Tier 2/3 module ID:

```typescript
case 'blueprint_find': {
  const researchModules = Object.values(MODULES).filter(m => m.researchCost);
  const pick = researchModules[seed % researchModules.length];
  return { moduleId: pick.id, moduleName: pick.name };
}
```

**Step 2: Handle blueprint_find in completeScanEvent handler**

In `SectorRoom.ts`, find the `completeScanEvent` handler. Add a case for `blueprint_find`:

```typescript
if (event.event_type === 'blueprint_find') {
  const moduleId = event.data?.moduleId as string;
  if (moduleId) {
    await addBlueprint(auth.userId, moduleId);
    client.send('blueprintFound', { moduleId, moduleName: MODULES[moduleId]?.name ?? moduleId });
    client.send('logEntry', `BLAUPAUSE GEFUNDEN: ${MODULES[moduleId]?.name ?? moduleId}`);
  }
}
```

**Step 3: Commit**

```
feat: add blueprint_find scan event type and handler
```

---

## Task 9: Server Tests — Research Flow

**Files:**
- Create: `packages/server/src/engine/__tests__/research.test.ts`

**Step 1: Write research tests**

```typescript
import { describe, it, expect } from 'vitest';
import { canStartResearch, isModuleUnlocked, isModuleFreelyAvailable } from '@void-sector/shared';
import { MODULES } from '@void-sector/shared';
import type { ResearchState } from '@void-sector/shared';

const emptyResearch: ResearchState = {
  unlockedModules: [],
  blueprints: [],
  activeResearch: null,
};

const fullRes = { credits: 99999, ore: 9999, gas: 9999, crystal: 9999, artefact: 99 };

describe('research flow integration', () => {
  it('new player can only buy tier 1 modules', () => {
    expect(isModuleUnlocked('drive_mk1', emptyResearch)).toBe(true);
    expect(isModuleUnlocked('drive_mk2', emptyResearch)).toBe(false);
    expect(isModuleUnlocked('void_drive', emptyResearch)).toBe(false);
  });

  it('researching drive_mk2 unlocks it', () => {
    const after: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    expect(isModuleUnlocked('drive_mk2', after)).toBe(true);
  });

  it('blueprint unlocks module without research', () => {
    const after: ResearchState = { ...emptyResearch, blueprints: ['scanner_mk3'] };
    expect(isModuleUnlocked('scanner_mk3', after)).toBe(true);
  });

  it('cannot research drive_mk3 without drive_mk2', () => {
    const result = canStartResearch('drive_mk3', emptyResearch, fullRes);
    expect(result.valid).toBe(false);
  });

  it('can research drive_mk3 after drive_mk2', () => {
    const after: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk2'] };
    const result = canStartResearch('drive_mk3', after, fullRes);
    expect(result.valid).toBe(true);
  });

  it('void_drive requires ancient honored', () => {
    const after: ResearchState = { ...emptyResearch, unlockedModules: ['drive_mk3'] };
    const result = canStartResearch('void_drive', after, fullRes, { ancients: 'friendly' });
    expect(result.valid).toBe(false);
  });

  it('all research modules have valid prerequisites', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.prerequisite) {
        expect(MODULES[mod.prerequisite], `${id} has invalid prerequisite ${mod.prerequisite}`).toBeDefined();
      }
    }
  });

  it('all research modules have positive duration', () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (mod.researchCost) {
        expect(mod.researchDurationMin, `${id} missing researchDurationMin`).toBeGreaterThan(0);
      }
    }
  });
});
```

**Step 2: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: ALL PASS

**Step 3: Commit**

```
test: add research flow integration tests
```

---

## Task 10: Client — GameSlice + Network Messages

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add research state to gameSlice**

Add to the `GameSlice` interface:

```typescript
  // Research / Tech tree
  research: ResearchState;
```

Add to initial state:

```typescript
  research: { unlockedModules: [], blueprints: [], activeResearch: null },
```

Add setter:

```typescript
  setResearch: (research: ResearchState) => set({ research }),
```

Import `ResearchState` from `@void-sector/shared`.

**Step 2: Add network messages**

In `packages/client/src/network/client.ts`, add message senders:

```typescript
sendStartResearch(moduleId: string) {
  this.room?.send('startResearch', { moduleId });
}

sendCancelResearch() {
  this.room?.send('cancelResearch', {});
}

sendClaimResearch() {
  this.room?.send('claimResearch', {});
}

sendActivateBlueprint(moduleId: string) {
  this.room?.send('activateBlueprint', { moduleId });
}

requestResearchState() {
  this.room?.send('getResearchState', {});
}
```

Add message listeners (in the room join handler where other listeners are registered):

```typescript
room.onMessage('researchState', (data) => {
  useStore.setState({
    research: {
      unlockedModules: data.unlockedModules ?? [],
      blueprints: data.blueprints ?? [],
      activeResearch: data.activeResearch ?? null,
    },
  });
});

room.onMessage('researchResult', (data) => {
  if (data.success) {
    const patch: Partial<StoreState> = {};
    if (data.unlockedModules) patch.research = {
      ...useStore.getState().research,
      unlockedModules: data.unlockedModules,
      blueprints: data.blueprints ?? useStore.getState().research.blueprints,
      activeResearch: data.activeResearch ?? null,
    };
    if (data.activeResearch !== undefined) {
      patch.research = { ...useStore.getState().research, ...patch.research, activeResearch: data.activeResearch };
    }
    if (Object.keys(patch).length) useStore.setState(patch);
  }
});

room.onMessage('blueprintFound', (data) => {
  useStore.setState({
    research: {
      ...useStore.getState().research,
      blueprints: [...useStore.getState().research.blueprints, data.moduleId],
    },
  });
});
```

**Step 3: Commit**

```
feat: add research state to client store and network messages
```

---

## Task 11: Client — TechTreePanel Component

**Files:**
- Create: `packages/client/src/components/TechTreePanel.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx` (or `DesktopLayout.tsx` — wherever monitors are rendered)

**Step 1: Create TechTreePanel**

Create `packages/client/src/components/TechTreePanel.tsx`. This component shows:
- Active research with progress bar and countdown timer
- Available research projects grouped by category
- Each project shows: name, costs, prerequisite status, duration
- `[FORSCHUNG STARTEN]` button (disabled if not at home base or prerequisite not met)
- `[ABBRECHEN]` button for active research
- `[ABSCHLIESSEN]` button when timer complete
- Blueprint section showing found blueprints with `[AKTIVIEREN]` button

Key store selectors: `research`, `cargo`, `credits`, `position`, `homeBase`, `ship`
Key shared imports: `MODULES`, `isModuleUnlocked`, `isModuleFreelyAvailable`
Network calls: `network.sendStartResearch()`, `network.sendClaimResearch()`, `network.sendCancelResearch()`, `network.sendActivateBlueprint()`

Use `useEffect` with `setInterval` for countdown timer display (update every second).

Group modules by category. Show Tier 1 as "FREI" (free), researched as "✓", locked as cost breakdown.

**Step 2: Register in monitor system**

In the component that renders monitors (check `DesktopLayout.tsx` or `GameScreen.tsx`), add `MONITORS.TECH` case rendering `<TechTreePanel />`.

**Step 3: Commit**

```
feat: add TechTreePanel component and register TECH monitor
```

---

## Task 12: Client — BlueprintDialog Component

**Files:**
- Create: `packages/client/src/components/BlueprintDialog.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx` (render overlay)

**Step 1: Create BlueprintDialog**

Simple overlay dialog (similar to BattleDialog pattern). Shows when `blueprintFound` message is received. Displays:
- Module name and category
- "BLAUPAUSE GEFUNDEN" header
- Primary/secondary effects preview
- `[AKTIVIEREN]` button → calls `network.sendActivateBlueprint(moduleId)`
- `[SCHLIEẞEN]` button → dismisses dialog

Use a local state `pendingBlueprint: string | null` in gameSlice or component-level state.

**Step 2: Render in GameScreen**

Add `<BlueprintDialog />` alongside other overlays (CombatV2Dialog, BattleDialog).

**Step 3: Commit**

```
feat: add BlueprintDialog overlay component
```

---

## Task 13: Client — Update Existing Components

**Files:**
- Modify: `packages/client/src/components/ModulePanel.tsx` (station shop filtering)
- Modify: `packages/client/src/components/HangarPanel.tsx` (module card display)

**Step 1: Filter station shop by research**

In ModulePanel (or wherever modules are listed for purchase), filter the module list:

```typescript
import { isModuleUnlocked } from '@void-sector/shared';

const research = useStore(s => s.research);
// Only show modules the player has unlocked
const availableModules = Object.values(MODULES).filter(m => isModuleUnlocked(m.id, research));
```

**Step 2: Show primary/secondary effects in module cards**

Wherever module effects are displayed, use `mod.primaryEffect.label` and `mod.secondaryEffects.map(e => e.label)` instead of raw `effects` object.

**Step 3: Commit**

```
feat: filter station shop by research, show primary/secondary effect labels
```

---

## Task 14: Client Tests

**Files:**
- Create: `packages/client/src/__tests__/TechTreePanel.test.tsx`
- Modify: `packages/client/src/test/mockStore.ts` (add research default)

**Step 1: Update mockStore**

Add to `mockStoreState` defaults:

```typescript
research: { unlockedModules: [], blueprints: [], activeResearch: null },
```

**Step 2: Write TechTreePanel tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechTreePanel } from '../components/TechTreePanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendStartResearch: vi.fn(),
    sendCancelResearch: vi.fn(),
    sendClaimResearch: vi.fn(),
    sendActivateBlueprint: vi.fn(),
  },
}));

describe('TechTreePanel', () => {
  it('shows TECH-BAUM header', () => {
    mockStoreState({
      research: { unlockedModules: [], blueprints: [], activeResearch: null },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    expect(screen.getByText(/TECH/)).toBeInTheDocument();
  });

  it('shows active research progress', () => {
    mockStoreState({
      research: {
        unlockedModules: [],
        blueprints: [],
        activeResearch: {
          moduleId: 'drive_mk2',
          startedAt: Date.now() - 60000,
          completesAt: Date.now() + 240000,
        },
      },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    expect(screen.getByText(/ION DRIVE MK.II/)).toBeInTheDocument();
  });

  it('shows unlocked modules with checkmark', () => {
    mockStoreState({
      research: { unlockedModules: ['drive_mk2'], blueprints: [], activeResearch: null },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    // Check that drive_mk2 shows as unlocked
    expect(screen.getByText(/ION DRIVE MK.II/)).toBeInTheDocument();
  });

  it('shows blueprints section when player has blueprints', () => {
    mockStoreState({
      research: { unlockedModules: [], blueprints: ['scanner_mk3'], activeResearch: null },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    expect(screen.getByText(/SCANNER MK.III/)).toBeInTheDocument();
    expect(screen.getByText(/AKTIVIEREN/)).toBeInTheDocument();
  });
});
```

**Step 3: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```
test: add TechTreePanel and research integration tests
```

---

## Task 15: Update Mock Ship Stats Across Tests

**Files:**
- Modify: `packages/client/src/__tests__/CargoScreen.test.tsx`
- Modify: `packages/server/src/engine/__tests__/combatV2.test.ts`
- Any other test files with hardcoded `ShipStats` objects

**Step 1: Add `artefactChanceBonus: 0, safeSlotBonus: 0` to all mock ShipStats**

Search for `ecmReduction: 0, engineSpeed:` in test files and add the two new fields.

**Step 2: Run all tests**

Run: `npm test`
Expected: ALL PASS across all 3 packages

**Step 3: Commit**

```
test: update mock ShipStats with new artefactChanceBonus and safeSlotBonus fields
```

---

## Task 16: Full Verification

**Step 1: Type check all packages**

```bash
cd packages/shared && npx tsc -b
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/client/tsconfig.json
```

Expected: Only pre-existing errors in server (app.config.ts, queries.ts). No new errors.

**Step 2: Run all tests**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected: ALL PASS in all packages.

**Step 3: Final commit if needed**

```
chore: verify tech-baum feature — all tests pass
```
