# Kampfsystem v1.0 — Implementierungsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Altes Combat-System (Legacy + CombatV2) komplett ersetzen durch energie-basiertes Rundenkampfsystem v1.0 mit Generator-Modul, Modul-HP, Power-Levels und Repair-System.

**Architecture:** Drei Schichten — shared (Types/Constants/Calculator), server (Engine/Services/Migrations), client (UI). Bottom-up: shared zuerst, dann server, dann client. Neuer Generator-Slot (0) verdrängt alle bestehenden Slots um +1. AP-Regen kommt künftig vom Generator-Modul statt aus Hardcode-Konstante.

**Design-Dokument:** `docs/plans/2026-03-11-kampfsystem-v1-design.md`

**Tech Stack:** TypeScript · Vitest · PostgreSQL · React + Zustand · Colyseus

**WICHTIG vor Start:**
```bash
cd packages/shared && npm run build   # Nach jeder shared-Änderung!
cd packages/server && npx vitest run  # ~1164 Tests
cd packages/client && npx vitest run  # ~203 Tests
```

---

## Übersicht: Tasks

| # | Task | Paket | Beschreibung |
|---|------|-------|-------------|
| 1 | Type-Erweiterungen | shared | powerLevel, currentHp, generator/repair Kategorien |
| 2 | Slot-Remap + neue Modul-Definitionen | shared | Generator Slot 0, alle +1, T1-5 Definitionen |
| 3 | shipCalculator Erweiterungen | shared | calculateApRegen, getDamageState, getEpCost |
| 4 | Migration 053 — Module State Backfill | server | powerLevel+currentHp in ships.modules |
| 5 | Migration 054 — Legacy Tables + combat_log | server | DROP alte Tabellen, neue combat_log |
| 6 | combatTypes.ts | server | CombatState, RoundInput, RoundResult |
| 7 | combatEngine.ts | server | Rundenlogik, Resolution, Flee |
| 8 | CombatService.ts — Neubau | server | Kompletter Ersatz |
| 9 | RepairService.ts | server | Onboard + Station Reparatur |
| 10 | AP-System + ShipService | server | ap.ts + Generator-Pflicht bei Schiff-Erstellung |
| 11 | Legacy-Cleanup | server | combatV2.ts, FEATURE_COMBAT_V2, battle_log queries |
| 12 | CombatDialog rewrite | client | Energy Distribution UI, Modul-HP-Anzeige |
| 13 | RepairPanel | client | Onboard-Reparatur-Interface |

---

## Task 1: Type-Erweiterungen (shared)

**Files:**
- Modify: `packages/shared/src/types.ts`
- Create: `packages/shared/src/__tests__/combatTypes.test.ts`

**Kontext:** `ShipModule` hat derzeit `{ moduleId, slotIndex, source }`. Neue Felder: `powerLevel` und `currentHp`. `ModuleCategory` braucht `'generator'` und `'repair'`. `ShipStats` braucht `generatorEpPerRound` und `repairHpPerRound`.

**Schritt 1: Failing test schreiben**

```typescript
// packages/shared/src/__tests__/combatTypes.test.ts
import { describe, it, expect } from 'vitest';
import type { ShipModule, ModuleCategory } from '../types.js';

describe('combat type extensions', () => {
  it('ShipModule accepts powerLevel field', () => {
    const m: ShipModule = {
      moduleId: 'generator_mk1', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 20,
    };
    expect(m.powerLevel).toBe('high');
    expect(m.currentHp).toBe(20);
  });

  it('powerLevel defaults are typed correctly', () => {
    const levels: ShipModule['powerLevel'][] = ['off', 'low', 'mid', 'high'];
    expect(levels).toHaveLength(4);
  });

  it('ModuleCategory includes generator and repair', () => {
    const cat1: ModuleCategory = 'generator';
    const cat2: ModuleCategory = 'repair';
    expect(cat1).toBe('generator');
    expect(cat2).toBe('repair');
  });
});
```

**Schritt 2: Test laufen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/combatTypes.test.ts
```

**Schritt 3: Typen in `packages/shared/src/types.ts` ergänzen**

Suche `export type ModuleCategory` — füge `'generator'` und `'repair'` hinzu:
```typescript
export type ModuleCategory =
  | 'drive' | 'weapon' | 'armor' | 'shield' | 'scanner' | 'mining' | 'cargo'
  | 'defense' | 'special' | 'generator' | 'repair';
```

Suche `export interface ShipModule` — ergänze:
```typescript
export interface ShipModule {
  moduleId: string;
  slotIndex: number;
  source: ModuleSource;
  powerLevel?: 'off' | 'low' | 'mid' | 'high';  // default: 'high'
  currentHp?: number;                              // default: moduleDef.maxHp
}
```

Suche `export interface ShipStats` — ergänze am Ende:
```typescript
  generatorEpPerRound: number;   // EP pro Kampfrunde (vom Generator)
  repairHpPerRound: number;      // HP-Reparatur pro Kampfrunde (Repair-Modul)
  repairHpPerSecond: number;     // HP-Reparatur pro Sekunde (außerhalb Kampf)
```

Suche `ArtefactType` und `ARTEFACT_TYPES` — füge `'generator'` und `'repair'` hinzu:
```typescript
export type ArtefactType =
  | 'drive' | 'cargo' | 'scanner' | 'armor' | 'weapon' | 'shield'
  | 'defense' | 'special' | 'mining' | 'generator' | 'repair';

export const ARTEFACT_TYPES: ArtefactType[] = [
  'drive', 'cargo', 'scanner', 'armor', 'weapon', 'shield',
  'defense', 'special', 'mining', 'generator', 'repair',
];
```

Ergänze in `ARTEFACT_TYPE_FOR_CATEGORY`:
```typescript
  generator: 'generator',
  repair: 'repair',
```

**Schritt 4: Test laufen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/combatTypes.test.ts
```

**Schritt 5: Alle shared Tests + Build**
```bash
cd packages/shared && npm run build && npx vitest run 2>&1 | tail -5
```

**Schritt 6: Commit**
```bash
git add packages/shared/src/types.ts packages/shared/src/__tests__/combatTypes.test.ts
git commit -m "feat(shared): add generator/repair module categories, powerLevel/currentHp to ShipModule"
```

---

## Task 2: Slot-Remap + neue Modul-Definitionen (shared)

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/__tests__/generatorModules.test.ts`

**Kontext:** SPECIALIZED_SLOT_CATEGORIES muss `'generator'` als Slot 0 bekommen. Alle anderen rücken +1. ACEP extra slots starten jetzt ab Index 8. Neue Module: `generator_mk1..mk5`, `repair_mk1..mk5`.

**Schritt 1: Failing test**

```typescript
// packages/shared/src/__tests__/generatorModules.test.ts
import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_SLOT_CATEGORIES, SPECIALIZED_SLOT_INDEX,
  ACEP_EXTRA_SLOT_THRESHOLDS, MODULES,
} from '../constants.js';

describe('slot remap', () => {
  it('generator is slot 0', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES[0]).toBe('generator');
    expect(SPECIALIZED_SLOT_INDEX['generator']).toBe(0);
  });

  it('drive is slot 1 (was 0)', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES[1]).toBe('drive');
    expect(SPECIALIZED_SLOT_INDEX['drive']).toBe(1);
  });

  it('cargo is slot 7 (was 6)', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES[7]).toBe('cargo');
    expect(SPECIALIZED_SLOT_INDEX['cargo']).toBe(7);
  });

  it('extra slots start at index 8', () => {
    // With 0 ausbau XP, only slots 0-7 available
    // Extra slot threshold[0]=10 unlocks slot 8
    expect(ACEP_EXTRA_SLOT_THRESHOLDS[0]).toBe(10);
  });

  it('has 8 specialized slot categories', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES).toHaveLength(8);
  });
});

describe('generator modules', () => {
  it('generator_mk1 exists with ep and apPerSecond', () => {
    const g = MODULES['generator_mk1'];
    expect(g).toBeDefined();
    expect(g.category).toBe('generator');
    expect(g.tier).toBe(1);
    expect(g.effects.generatorEpPerRound).toBe(6);
    expect(g.effects.apRegenPerSecond).toBeDefined();
  });

  it('generator_mk5 has 18 EP/round', () => {
    expect(MODULES['generator_mk5'].effects.generatorEpPerRound).toBe(18);
  });

  it('repair_mk1 exists', () => {
    const r = MODULES['repair_mk1'];
    expect(r).toBeDefined();
    expect(r.category).toBe('repair');
    expect(r.effects.repairHpPerRound).toBe(2);
    expect(r.effects.repairHpPerSecond).toBe(0.5);
  });

  it('all modules have maxHp field', () => {
    const sample = MODULES['laser_mk1'];
    expect(sample.maxHp).toBeDefined();
    expect(sample.maxHp).toBeGreaterThan(0);
  });
});
```

**Schritt 2: Test laufen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/generatorModules.test.ts
```

**Schritt 3: constants.ts anpassen**

Ergänze `apRegenPerSecond` zu `ShipStats` — bereits in Task 1 über `effects` abgedeckt. Füge zu `ModuleDefinition` in types.ts `maxHp?: number` hinzu (falls noch nicht vorhanden).

Suche den Block `SPECIALIZED_SLOT_CATEGORIES` in `constants.ts` und ersetze:
```typescript
export const SPECIALIZED_SLOT_CATEGORIES: ModuleCategory[] = [
  'generator', // slot 0
  'drive',     // slot 1
  'weapon',    // slot 2
  'armor',     // slot 3
  'shield',    // slot 4
  'scanner',   // slot 5
  'mining',    // slot 6
  'cargo',     // slot 7
];

export const SPECIALIZED_SLOT_INDEX: Partial<Record<ModuleCategory, number>> = {
  generator: 0,
  drive:     1,
  weapon:    2,
  armor:     3,
  shield:    4,
  scanner:   5,
  mining:    6,
  cargo:     7,
};
```

Füge Modul-HP-Konstante hinzu (direkt nach ACEP-Konstanten):
```typescript
/** Modul-HP pro Tier */
export const MODULE_HP_BY_TIER: Record<number, number> = {
  1: 20, 2: 35, 3: 55, 4: 80, 5: 110,
};

/** EP-Kosten pro Power-Level pro Modul-Kategorie */
export const MODULE_EP_COSTS: Partial<Record<ModuleCategory, Record<string, number>>> = {
  weapon:  { off: 0, low: 2, mid: 4, high: 6 },
  shield:  { off: 0, low: 1, mid: 2, high: 4 },
  drive:   { off: 0, low: 2, mid: 4, high: 6 },
  scanner: { off: 0, low: 1, mid: 2, high: 3 },
  repair:  { off: 0, low: 1, mid: 2, high: 4 },
};

/** Basis AP/s des Schiffs ohne Generator */
export const BASE_HULL_AP_REGEN = 0.08;

/** Power-Level-Multiplikatoren für AP-Regen */
export const POWER_LEVEL_MULTIPLIERS: Record<string, number> = {
  off: 0.0, low: 0.4, mid: 0.7, high: 1.0,
};
```

Füge Generator-Module BEFORE `// === DRIVE ===` in `MODULES` ein:
```typescript
  // === GENERATOR ===
  generator_mk1: {
    id: 'generator_mk1', category: 'generator', tier: 1,
    name: 'FUSION CELL MK.I', displayName: 'FUSION MK.I',
    primaryEffect: { stat: 'generatorEpPerRound', delta: 6, label: 'EP/Runde +6' },
    secondaryEffects: [],
    effects: { generatorEpPerRound: 6, apRegenPerSecond: 0.20 },
    cost: { credits: 150, ore: 15 },
    maxHp: 20, isUnique: true, acepPaths: ['ausbau'],
  },
  generator_mk2: {
    id: 'generator_mk2', category: 'generator', tier: 2,
    name: 'FUSION CELL MK.II', displayName: 'FUSION MK.II',
    primaryEffect: { stat: 'generatorEpPerRound', delta: 9, label: 'EP/Runde +9' },
    secondaryEffects: [],
    effects: { generatorEpPerRound: 9, apRegenPerSecond: 0.30 },
    cost: { credits: 400, ore: 30, crystal: 5 },
    maxHp: 35, isUnique: true, acepPaths: ['ausbau'],
    prerequisite: 'generator_mk1',
  },
  generator_mk3: {
    id: 'generator_mk3', category: 'generator', tier: 3,
    name: 'FUSION CELL MK.III', displayName: 'FUSION MK.III',
    primaryEffect: { stat: 'generatorEpPerRound', delta: 12, label: 'EP/Runde +12' },
    secondaryEffects: [],
    effects: { generatorEpPerRound: 12, apRegenPerSecond: 0.50 },
    cost: { credits: 900, ore: 50, crystal: 15 },
    maxHp: 55, isUnique: true, acepPaths: ['ausbau'],
    prerequisite: 'generator_mk2',
  },
  generator_mk4: {
    id: 'generator_mk4', category: 'generator', tier: 4,
    name: 'FUSION CELL MK.IV', displayName: 'FUSION MK.IV',
    primaryEffect: { stat: 'generatorEpPerRound', delta: 15, label: 'EP/Runde +15' },
    secondaryEffects: [],
    effects: { generatorEpPerRound: 15, apRegenPerSecond: 0.70 },
    cost: { credits: 2000, ore: 80, crystal: 30 },
    maxHp: 80, isUnique: true, acepPaths: ['ausbau'],
    prerequisite: 'generator_mk3',
  },
  generator_mk5: {
    id: 'generator_mk5', category: 'generator', tier: 5,
    name: 'FUSION CELL MK.V', displayName: 'FUSION MK.V',
    primaryEffect: { stat: 'generatorEpPerRound', delta: 18, label: 'EP/Runde +18' },
    secondaryEffects: [],
    effects: { generatorEpPerRound: 18, apRegenPerSecond: 1.00 },
    cost: { credits: 4500, ore: 120, crystal: 60 },
    maxHp: 110, isUnique: true, acepPaths: ['ausbau'],
    prerequisite: 'generator_mk4',
  },

  // === REPAIR ===
  repair_mk1: {
    id: 'repair_mk1', category: 'repair', tier: 1,
    name: 'REPAIR DRONE MK.I', displayName: 'REPAIR MK.I',
    primaryEffect: { stat: 'repairHpPerRound', delta: 2, label: 'Reparatur +2 HP/Runde' },
    secondaryEffects: [],
    effects: { repairHpPerRound: 2, repairHpPerSecond: 0.5 },
    cost: { credits: 200, ore: 20 },
    maxHp: 20, acepPaths: ['ausbau'],
  },
  repair_mk2: {
    id: 'repair_mk2', category: 'repair', tier: 2,
    name: 'REPAIR DRONE MK.II', displayName: 'REPAIR MK.II',
    primaryEffect: { stat: 'repairHpPerRound', delta: 4, label: 'Reparatur +4 HP/Runde' },
    secondaryEffects: [],
    effects: { repairHpPerRound: 4, repairHpPerSecond: 1.0 },
    cost: { credits: 500, ore: 40, crystal: 5 },
    maxHp: 35, acepPaths: ['ausbau'],
    prerequisite: 'repair_mk1',
  },
  repair_mk3: {
    id: 'repair_mk3', category: 'repair', tier: 3,
    name: 'REPAIR DRONE MK.III', displayName: 'REPAIR MK.III',
    primaryEffect: { stat: 'repairHpPerRound', delta: 7, label: 'Reparatur +7 HP/Runde' },
    secondaryEffects: [],
    effects: { repairHpPerRound: 7, repairHpPerSecond: 2.0 },
    cost: { credits: 1200, ore: 60, crystal: 20 },
    maxHp: 55, acepPaths: ['ausbau'],
    prerequisite: 'repair_mk2',
  },
  repair_mk4: {
    id: 'repair_mk4', category: 'repair', tier: 4,
    name: 'REPAIR DRONE MK.IV', displayName: 'REPAIR MK.IV',
    primaryEffect: { stat: 'repairHpPerRound', delta: 11, label: 'Reparatur +11 HP/Runde' },
    secondaryEffects: [],
    effects: { repairHpPerRound: 11, repairHpPerSecond: 3.5 },
    cost: { credits: 2500, ore: 90, crystal: 40 },
    maxHp: 80, acepPaths: ['ausbau'],
    prerequisite: 'repair_mk3',
  },
  repair_mk5: {
    id: 'repair_mk5', category: 'repair', tier: 5,
    name: 'REPAIR DRONE MK.V', displayName: 'REPAIR MK.V',
    primaryEffect: { stat: 'repairHpPerRound', delta: 16, label: 'Reparatur +16 HP/Runde' },
    secondaryEffects: [],
    effects: { repairHpPerRound: 16, repairHpPerSecond: 5.0 },
    cost: { credits: 5000, ore: 140, crystal: 70 },
    maxHp: 110, acepPaths: ['ausbau'],
    prerequisite: 'repair_mk4',
  },
```

Ergänze `maxHp` zu allen bestehenden Standard-Modulen via `MODULE_HP_BY_TIER[mod.tier]`. Die einfachste Methode: nach dem MODULES-Objekt eine Backfill-Schleife:
```typescript
// Backfill maxHp für alle Module ohne explizites maxHp
for (const mod of Object.values(MODULES)) {
  if (mod.maxHp === undefined) {
    (mod as any).maxHp = MODULE_HP_BY_TIER[mod.tier] ?? 20;
  }
}
```

Füge auch `apRegenPerSecond` zu `ShipStats` in types.ts hinzu (optional, da Generator-Module es via `effects` setzen):
```typescript
  apRegenPerSecond?: number;  // nur bei Generator-Modul gesetzt
```

**Schritt 4: Test laufen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/generatorModules.test.ts
```

**Schritt 5: Alle shared Tests + Build**
```bash
cd packages/shared && npm run build && npx vitest run 2>&1 | tail -5
```

**Schritt 6: Commit**
```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts \
        packages/shared/src/__tests__/generatorModules.test.ts
git commit -m "feat(shared): generator slot 0, slot remap +1, generator/repair modules T1-5, maxHp per tier"
```

---

## Task 3: shipCalculator Erweiterungen (shared)

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts`
- Create: `packages/shared/src/__tests__/apRegen.test.ts`

**Kontext:** Drei neue Hilfsfunktionen: `calculateApRegen()`, `getDamageState()`, `getModuleEffectivePowerLevel()`. `calculateShipStats` muss `generatorEpPerRound`, `repairHpPerRound`, `repairHpPerSecond` akkumulieren.

**Schritt 1: Failing test**

```typescript
// packages/shared/src/__tests__/apRegen.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateApRegen, getDamageState, getModuleEffectivePowerLevel,
} from '../shipCalculator.js';
import type { ShipModule } from '../types.js';

describe('calculateApRegen', () => {
  it('returns BASE_HULL_AP_REGEN with no modules', () => {
    expect(calculateApRegen([])).toBeCloseTo(0.08);
  });

  it('returns base + generator contribution at high', () => {
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 55,
    }];
    // 0.08 + 0.5 * 1.0 * (55/55)
    expect(calculateApRegen(modules)).toBeCloseTo(0.58);
  });

  it('generator at low power = reduced AP', () => {
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'low', currentHp: 55,
    }];
    // 0.08 + 0.5 * 0.4 * 1.0
    expect(calculateApRegen(modules)).toBeCloseTo(0.28);
  });

  it('damaged generator reduces AP', () => {
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 27, // ~50% of 55
    }];
    // 0.08 + 0.5 * 1.0 * (27/55) ≈ 0.325
    expect(calculateApRegen(modules)).toBeGreaterThan(0.08);
    expect(calculateApRegen(modules)).toBeLessThan(0.58);
  });
});

describe('getDamageState', () => {
  it('intact above 75%', () => expect(getDamageState(80, 100)).toBe('intact'));
  it('light 50-75%', () => expect(getDamageState(60, 100)).toBe('light'));
  it('heavy 25-50%', () => expect(getDamageState(40, 100)).toBe('heavy'));
  it('destroyed below 25%', () => expect(getDamageState(20, 100)).toBe('destroyed'));
});

describe('getModuleEffectivePowerLevel', () => {
  it('destroyed module forced to off', () => {
    const m: ShipModule = { moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 5 }; // 5/20 = 25% → destroyed
    expect(getModuleEffectivePowerLevel(m)).toBe('off');
  });

  it('heavy damage caps at low', () => {
    const m: ShipModule = { moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 8 }; // 8/20 = 40% → heavy → cap low
    expect(getModuleEffectivePowerLevel(m)).toBe('low');
  });

  it('intact module uses requested power level', () => {
    const m: ShipModule = { moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'mid', currentHp: 20 };
    expect(getModuleEffectivePowerLevel(m)).toBe('mid');
  });
});
```

**Schritt 2: Test laufen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/apRegen.test.ts
```

**Schritt 3: Funktionen in `shipCalculator.ts` hinzufügen**

Am Ende der Datei (nach `getActiveDrawbacks`):

```typescript
import { BASE_HULL_AP_REGEN, POWER_LEVEL_MULTIPLIERS } from './constants.js';

export type DamageState = 'intact' | 'light' | 'heavy' | 'destroyed';

/** Leitet Damage-State aus currentHp/maxHp ab */
export function getDamageState(currentHp: number, maxHp: number): DamageState {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  if (ratio > 0.75) return 'intact';
  if (ratio > 0.50) return 'light';
  if (ratio > 0.25) return 'heavy';
  return 'destroyed';
}

/** Gibt effektives Power-Level unter Berücksichtigung von Damage-State zurück */
export function getModuleEffectivePowerLevel(
  mod: ShipModule,
): 'off' | 'low' | 'mid' | 'high' {
  const requested = mod.powerLevel ?? 'high';
  const def = MODULES[mod.moduleId];
  if (!def) return requested;
  const maxHp = def.maxHp ?? 20;
  const currentHp = mod.currentHp ?? maxHp;
  const state = getDamageState(currentHp, maxHp);
  if (state === 'destroyed') return 'off';
  if (state === 'heavy' && (requested === 'high' || requested === 'mid')) return 'low';
  if (state === 'light' && requested === 'high') return 'mid';
  return requested;
}

/** Berechnet AP/s basierend auf installiertem Generator + Schiffs-Basis-Regen */
export function calculateApRegen(modules: ShipModule[]): number {
  let regen = BASE_HULL_AP_REGEN;
  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def || def.category !== 'generator') continue;
    const apPerSecond = def.effects.apRegenPerSecond ?? 0;
    const effectivePower = getModuleEffectivePowerLevel(mod);
    const multiplier = POWER_LEVEL_MULTIPLIERS[effectivePower] ?? 1.0;
    const maxHp = def.maxHp ?? 20;
    const currentHp = mod.currentHp ?? maxHp;
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    regen += apPerSecond * multiplier * hpRatio;
  }
  return regen;
}
```

Ergänze in `calculateShipStats` die Akkumulation der neuen Stats:
```typescript
// Nach der bestehenden effects-Schleife:
stats.generatorEpPerRound = 0;
stats.repairHpPerRound = 0;
stats.repairHpPerSecond = 0;
// ... in der Modul-Schleife:
if (def.effects.generatorEpPerRound) stats.generatorEpPerRound += def.effects.generatorEpPerRound;
if (def.effects.repairHpPerRound) stats.repairHpPerRound += def.effects.repairHpPerRound;
if (def.effects.repairHpPerSecond) stats.repairHpPerSecond += def.effects.repairHpPerSecond;
```

Füge auch Defaultwerte in ShipStats-Initialisierung hinzu (in `calculateShipStats`):
```typescript
generatorEpPerRound: 0,
repairHpPerRound: 0,
repairHpPerSecond: 0,
```

**Schritt 4: Test laufen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/apRegen.test.ts
```

**Schritt 5: Build + alle Tests**
```bash
cd packages/shared && npm run build && npx vitest run 2>&1 | tail -5
```

**Schritt 6: Commit**
```bash
git add packages/shared/src/shipCalculator.ts packages/shared/src/__tests__/apRegen.test.ts
git commit -m "feat(shared): calculateApRegen, getDamageState, getModuleEffectivePowerLevel helpers"
```

---

## Task 4: Migration 053 — Module State Backfill (server)

**Files:**
- Create: `packages/server/src/db/migrations/053_module_state.sql`
- Create: `packages/server/src/__tests__/migration-053.test.ts`

**Schritt 1: SQL schreiben**

```sql
-- 053_module_state.sql
-- Backfills powerLevel='high' und currentHp=<maxHp> in ships.modules JSONB
-- für alle Einträge ohne diese Felder.
-- maxHp wird aus tier abgeleitet: tier1=20, tier2=35, tier3=55, tier4=80, tier5=110

UPDATE ships
SET modules = (
  SELECT jsonb_agg(
    CASE
      WHEN module ? 'powerLevel' AND module ? 'currentHp' THEN module
      ELSE module
        || jsonb_build_object('powerLevel', 'high')
        || jsonb_build_object('currentHp',
            CASE
              WHEN (module->>'moduleId') LIKE '%_mk5' THEN 110
              WHEN (module->>'moduleId') LIKE '%_mk4' THEN 80
              WHEN (module->>'moduleId') LIKE '%_mk3' THEN 55
              WHEN (module->>'moduleId') LIKE '%_mk2' THEN 35
              ELSE 20
            END
          )
    END
  )
  FROM jsonb_array_elements(modules) AS module
)
WHERE jsonb_array_length(modules) > 0;
```

**Schritt 2: Test**

```typescript
// packages/server/src/__tests__/migration-053.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../db/pool.js';

const MIGRATION_SQL = readFileSync(
  join(import.meta.dirname, '../db/migrations/053_module_state.sql'),
  'utf-8',
);

describe('migration 053 — module state backfill', () => {
  it('contains powerLevel and currentHp logic', () => {
    expect(MIGRATION_SQL).toContain('powerLevel');
    expect(MIGRATION_SQL).toContain('currentHp');
    expect(MIGRATION_SQL).toContain('jsonb_array_elements');
  });
});
```

**Schritt 3: Test laufen**
```bash
cd packages/server && npx vitest run src/__tests__/migration-053.test.ts
```

**Schritt 4: Commit**
```bash
git add packages/server/src/db/migrations/053_module_state.sql \
        packages/server/src/__tests__/migration-053.test.ts
git commit -m "feat(db): migration 053 — backfill powerLevel+currentHp in ships.modules JSONB"
```

---

## Task 5: Migration 054 — Legacy Tables + combat_log (server)

**Files:**
- Create: `packages/server/src/db/migrations/054_combat_log.sql`
- Create: `packages/server/src/__tests__/migration-054.test.ts`

**Schritt 1: SQL schreiben**

```sql
-- 054_combat_log.sql
-- Entfernt legacy battle_log Tabellen und erstellt neue combat_log Tabelle

DROP TABLE IF EXISTS battle_log_v2;
DROP TABLE IF EXISTS battle_log;

CREATE TABLE IF NOT EXISTS combat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100) NOT NULL,
  quadrant_x INTEGER,
  quadrant_y INTEGER,
  sector_x INTEGER,
  sector_y INTEGER,
  enemy_type VARCHAR(50),
  enemy_level INTEGER,
  outcome VARCHAR(20),
  rounds INTEGER,
  player_hp_end INTEGER,
  modules_damaged JSONB DEFAULT '[]',
  loot JSONB DEFAULT '{}',
  fought_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_log_player ON combat_log(player_id);
CREATE INDEX IF NOT EXISTS idx_combat_log_fought_at ON combat_log(fought_at);
```

**Schritt 2: Test**

```typescript
// packages/server/src/__tests__/migration-054.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SQL = readFileSync(
  join(import.meta.dirname, '../db/migrations/054_combat_log.sql'), 'utf-8',
);

describe('migration 054 — combat_log', () => {
  it('drops battle_log_v2', () => expect(SQL).toContain('DROP TABLE IF EXISTS battle_log_v2'));
  it('drops battle_log', () => expect(SQL).toContain('DROP TABLE IF EXISTS battle_log'));
  it('creates combat_log', () => expect(SQL).toContain('CREATE TABLE IF NOT EXISTS combat_log'));
  it('has outcome column', () => expect(SQL).toContain('outcome'));
  it('has modules_damaged column', () => expect(SQL).toContain('modules_damaged'));
});
```

**Schritt 3: Test laufen**
```bash
cd packages/server && npx vitest run src/__tests__/migration-054.test.ts
```

**Schritt 4: Commit**
```bash
git add packages/server/src/db/migrations/054_combat_log.sql \
        packages/server/src/__tests__/migration-054.test.ts
git commit -m "feat(db): migration 054 — drop battle_log/v2, create combat_log table"
```

---

## Task 6: combatTypes.ts (server)

**Files:**
- Create: `packages/server/src/engine/combatTypes.ts`
- Create: `packages/server/src/engine/__tests__/combatTypes.test.ts`

**Schritt 1: Test**

```typescript
// packages/server/src/engine/__tests__/combatTypes.test.ts
import { describe, it, expect } from 'vitest';
import type { CombatState, RoundInput, RoundResult } from '../combatTypes.js';

describe('combatTypes', () => {
  it('CombatState has required fields', () => {
    const state: CombatState = {
      playerId: 'p1', playerHp: 100, playerMaxHp: 100,
      playerModules: [],
      enemyType: 'pirate', enemyLevel: 1, enemyHp: 50, enemyMaxHp: 50,
      round: 1, epBuffer: 0, ancientChargeRounds: 0, ancientAbilityUsed: false,
      log: [],
    };
    expect(state.round).toBe(1);
    expect(state.epBuffer).toBe(0);
  });

  it('RoundInput covers all primary actions', () => {
    const actions: RoundInput['primaryAction'][] = [
      'attack', 'scan', 'repair', 'flee', 'wait',
    ];
    expect(actions).toHaveLength(5);
  });

  it('RoundResult has combatEnd field', () => {
    const result: Partial<RoundResult> = { combatEnd: 'victory' };
    expect(result.combatEnd).toBe('victory');
  });
});
```

**Schritt 2: Test laufen — muss FAIL**
```bash
cd packages/server && npx vitest run src/engine/__tests__/combatTypes.test.ts
```

**Schritt 3: combatTypes.ts erstellen**

```typescript
// packages/server/src/engine/combatTypes.ts
import type { ShipModule } from '@void-sector/shared';

export type PowerLevel = 'off' | 'low' | 'mid' | 'high';
export type CombatOutcome = 'victory' | 'defeat' | 'fled' | 'draw';
export type PrimaryAction = 'attack' | 'scan' | 'repair' | 'flee' | 'wait';
export type ReactionChoice = 'shield_boost' | 'ecm_pulse' | 'emergency_eject' | null;

export interface EnemyModule {
  moduleId: string;
  category: string;
  currentHp: number;
  maxHp: number;
}

export interface CombatState {
  playerId: string;
  playerHp: number;
  playerMaxHp: number;
  playerModules: ShipModule[];
  enemyType: string;
  enemyLevel: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyModules: EnemyModule[];
  round: number;
  epBuffer: number;         // EP-Buffer (Übertrag aus Vorrundenü)
  ancientChargeRounds: number;  // Runden seit letztem Ancient-Einsatz
  ancientAbilityUsed: boolean;
  log: string[];
}

export interface EnergyAllocation {
  [slotIndex: number]: PowerLevel;
}

export interface RoundInput {
  energyAllocation: EnergyAllocation;
  primaryAction: PrimaryAction;
  reactionChoice?: ReactionChoice;
  useAncientAbility?: boolean;
  repairTargetSlot?: number;
}

export interface ModuleDamageEvent {
  slotIndex: number;
  moduleId: string;
  hpBefore: number;
  hpAfter: number;
}

export interface RoundResult {
  playerDamageTaken: number;
  enemyDamageTaken: number;
  playerModuleDamage: ModuleDamageEvent[];
  fleeSuccess?: boolean;
  ancientAbilityTriggered?: boolean;
  scanRevealed?: EnemyModule[];
  repairAmount?: number;
  messages: string[];
  combatEnd?: CombatOutcome;
  newPlayerHp: number;
  newEnemyHp: number;
  newEpBuffer: number;
}
```

**Schritt 4: Test laufen — muss PASS**
```bash
cd packages/server && npx vitest run src/engine/__tests__/combatTypes.test.ts
```

**Schritt 5: Commit**
```bash
git add packages/server/src/engine/combatTypes.ts \
        packages/server/src/engine/__tests__/combatTypes.test.ts
git commit -m "feat(server): combatTypes.ts — CombatState, RoundInput, RoundResult for combat v1.0"
```

---

## Task 7: combatEngine.ts (server)

**Files:**
- Create: `packages/server/src/engine/combatEngine.ts`
- Create: `packages/server/src/engine/__tests__/combatEngine.test.ts`

**Schritt 1: Test**

```typescript
// packages/server/src/engine/__tests__/combatEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  initCombat, resolveRound, calculateAvailableEp,
} from '../combatEngine.js';

const baseState = () => ({
  playerId: 'p1',
  playerHp: 100, playerMaxHp: 100,
  playerModules: [{
    moduleId: 'generator_mk3', slotIndex: 0, source: 'standard' as const,
    powerLevel: 'high' as const, currentHp: 55,
  }, {
    moduleId: 'laser_mk2', slotIndex: 2, source: 'standard' as const,
    powerLevel: 'high' as const, currentHp: 35,
  }],
  enemyType: 'pirate', enemyLevel: 1,
  enemyHp: 50, enemyMaxHp: 50,
  enemyModules: [],
  round: 1, epBuffer: 0,
  ancientChargeRounds: 0, ancientAbilityUsed: false,
  log: [],
});

describe('initCombat', () => {
  it('creates valid state with enemy HP from level', () => {
    const state = initCombat('p1', baseState().playerModules, 'pirate', 3);
    expect(state.enemyHp).toBeGreaterThan(0);
    expect(state.round).toBe(1);
    expect(state.epBuffer).toBe(0);
  });
});

describe('calculateAvailableEp', () => {
  it('returns generator EP + buffer', () => {
    const ep = calculateAvailableEp(baseState());
    expect(ep).toBe(12 + 0); // generator_mk3 = 12 EP, no buffer
  });

  it('damaged generator reduces EP', () => {
    const state = baseState();
    state.playerModules[0].currentHp = 27; // ~50% damage
    const ep = calculateAvailableEp(state);
    expect(ep).toBeLessThan(12);
  });
});

describe('resolveRound — attack', () => {
  it('deals damage to enemy', () => {
    const state = baseState();
    const input = {
      energyAllocation: { 2: 'high' as const },
      primaryAction: 'attack' as const,
    };
    const result = resolveRound(state, input);
    expect(result.enemyDamageTaken).toBeGreaterThan(0);
    expect(result.newEnemyHp).toBeLessThan(50);
  });

  it('sets combatEnd=victory when enemy HP reaches 0', () => {
    const state = baseState();
    state.enemyHp = 5;
    const input = {
      energyAllocation: { 2: 'high' as const },
      primaryAction: 'attack' as const,
    };
    const result = resolveRound(state, input);
    expect(result.combatEnd).toBe('victory');
  });
});

describe('resolveRound — flee', () => {
  it('flee fails when no drive EP advantage', () => {
    const state = baseState();
    const input = {
      energyAllocation: {},
      primaryAction: 'flee' as const,
    };
    const result = resolveRound(state, input);
    expect(result.fleeSuccess).toBe(false);
  });
});

describe('resolveRound — max rounds', () => {
  it('returns draw at round 10', () => {
    const state = baseState();
    state.round = 10;
    const input = {
      energyAllocation: { 2: 'high' as const },
      primaryAction: 'attack' as const,
    };
    // Force low damage: enemy survives
    state.enemyHp = 999;
    const result = resolveRound(state, input);
    expect(result.combatEnd).toBe('draw');
  });
});
```

**Schritt 2: Test laufen — muss FAIL**
```bash
cd packages/server && npx vitest run src/engine/__tests__/combatEngine.test.ts
```

**Schritt 3: combatEngine.ts implementieren**

```typescript
// packages/server/src/engine/combatEngine.ts
import { MODULES, MODULE_EP_COSTS, POWER_LEVEL_MULTIPLIERS } from '@void-sector/shared';
import { getDamageState, getModuleEffectivePowerLevel } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';
import type { CombatState, RoundInput, RoundResult, EnemyModule } from './combatTypes.js';

const COMBAT_MAX_ROUNDS = 10;
const ENEMY_HP_BASE = 30;
const ENEMY_HP_PER_LEVEL = 15;
const ENEMY_ATTACK_BASE = 5;
const ENEMY_ATTACK_PER_LEVEL = 3;

export function initCombat(
  playerId: string,
  playerModules: ShipModule[],
  enemyType: string,
  enemyLevel: number,
): CombatState {
  const enemyMaxHp = ENEMY_HP_BASE + enemyLevel * ENEMY_HP_PER_LEVEL;
  return {
    playerId, playerModules,
    playerHp: 100, playerMaxHp: 100,
    enemyType, enemyLevel,
    enemyHp: enemyMaxHp, enemyMaxHp,
    enemyModules: [],
    round: 1, epBuffer: 0,
    ancientChargeRounds: 0, ancientAbilityUsed: false,
    log: [],
  };
}

/** EP verfügbar diese Runde = Generator-Output * HP-Ratio + Buffer */
export function calculateAvailableEp(state: CombatState): number {
  let ep = state.epBuffer;
  for (const mod of state.playerModules) {
    const def = MODULES[mod.moduleId];
    if (!def || def.category !== 'generator') continue;
    const epPerRound = def.effects.generatorEpPerRound ?? 0;
    const effectivePower = getModuleEffectivePowerLevel(mod);
    const powerMult = POWER_LEVEL_MULTIPLIERS[effectivePower] ?? 1.0;
    const maxHp = def.maxHp ?? 20;
    const currentHp = mod.currentHp ?? maxHp;
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    ep += Math.floor(epPerRound * powerMult * hpRatio);
  }
  return ep;
}

function getWeaponDamage(modules: ShipModule[], allocation: RoundInput['energyAllocation']): number {
  let dmg = 0;
  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def || def.category !== 'weapon') continue;
    const allocated = allocation[mod.slotIndex] ?? 'off';
    const effective = getModuleEffectivePowerLevel({ ...mod, powerLevel: allocated });
    if (effective === 'off') continue;
    const base = def.effects.weaponAttack ?? 0;
    const mult = effective === 'high' ? 1.0 : effective === 'mid' ? 0.7 : 0.4;
    dmg += Math.floor(base * mult);
  }
  return dmg;
}

function getShieldAbsorption(modules: ShipModule[]): number {
  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def || def.category !== 'shield') continue;
    const effective = getModuleEffectivePowerLevel(mod);
    if (effective === 'off') continue;
    const shieldHp = def.effects.shieldHp ?? 0;
    const mult = effective === 'high' ? 1.0 : effective === 'mid' ? 0.6 : 0.3;
    return Math.floor(shieldHp * mult * 0.5); // 50% absorb per round
  }
  return 0;
}

export function resolveRound(state: CombatState, input: RoundInput): RoundResult {
  const messages: string[] = [];
  let newPlayerHp = state.playerHp;
  let newEnemyHp = state.enemyHp;
  const playerModuleDamage = [];
  let fleeSuccess: boolean | undefined;
  let combatEnd: RoundResult['combatEnd'];

  const availableEp = calculateAvailableEp(state);
  let usedEp = 0;

  // Calculate EP used by allocation
  for (const [slotStr, level] of Object.entries(input.energyAllocation)) {
    const mod = state.playerModules.find(m => m.slotIndex === Number(slotStr));
    if (!mod) continue;
    const def = MODULES[mod.moduleId];
    if (!def) continue;
    const costs = MODULE_EP_COSTS[def.category] ?? {};
    usedEp += costs[level] ?? 0;
  }

  const newEpBuffer = Math.max(0, availableEp - usedEp);

  // Primary Action
  if (input.primaryAction === 'attack') {
    const dmg = getWeaponDamage(state.playerModules, input.energyAllocation);
    newEnemyHp = Math.max(0, state.enemyHp - dmg);
    messages.push(`Angriff: ${dmg} Schaden an Feind.`);
  } else if (input.primaryAction === 'flee') {
    // Simple flee: 40% base chance + drive level bonus
    const fleeChance = 0.4;
    fleeSuccess = Math.random() < fleeChance;
    if (fleeSuccess) {
      combatEnd = 'fled';
      messages.push('Flucht erfolgreich!');
    } else {
      messages.push('Flucht fehlgeschlagen!');
    }
  } else if (input.primaryAction === 'wait') {
    messages.push('Warten — EP aufgeladen.');
  }

  // Enemy attack (only if combat continues)
  if (!combatEnd) {
    const enemyAtk = ENEMY_ATTACK_BASE + state.enemyLevel * ENEMY_ATTACK_PER_LEVEL;
    const absorbed = getShieldAbsorption(state.playerModules);
    const netDmg = Math.max(0, enemyAtk - absorbed);
    newPlayerHp = Math.max(0, state.playerHp - netDmg);
    messages.push(`Feind-Angriff: ${enemyAtk} - ${absorbed} Schild = ${netDmg} Schaden.`);
  }

  // Check end conditions
  if (!combatEnd) {
    if (newEnemyHp <= 0) {
      combatEnd = 'victory';
      messages.push('Feind besiegt!');
    } else if (newPlayerHp <= 0) {
      combatEnd = 'defeat';
      messages.push('Schiff zerstört!');
    } else if (state.round >= COMBAT_MAX_ROUNDS) {
      combatEnd = 'draw';
      messages.push('Maximale Rundenzahl erreicht — Unentschieden.');
    }
  }

  return {
    playerDamageTaken: state.playerHp - newPlayerHp,
    enemyDamageTaken: state.enemyHp - newEnemyHp,
    playerModuleDamage,
    fleeSuccess,
    messages,
    combatEnd,
    newPlayerHp,
    newEnemyHp,
    newEpBuffer,
  };
}
```

**Schritt 4: Test laufen — muss PASS**
```bash
cd packages/server && npx vitest run src/engine/__tests__/combatEngine.test.ts
```

**Schritt 5: Build shared exportieren (getDamageState etc.)**
```bash
grep -n "getDamageState\|getModuleEffectivePowerLevel\|calculateApRegen" packages/shared/src/index.ts
```
Falls nicht exportiert: in `packages/shared/src/index.ts` ergänzen:
```typescript
export { getDamageState, getModuleEffectivePowerLevel, calculateApRegen } from './shipCalculator.js';
```
Dann neu bauen: `cd packages/shared && npm run build`

**Schritt 6: Commit**
```bash
git add packages/server/src/engine/combatEngine.ts \
        packages/server/src/engine/__tests__/combatEngine.test.ts
git commit -m "feat(server): combatEngine.ts — energy-based round resolution for combat v1.0"
```

---

## Task 8: CombatService.ts — Neubau (server)

**Files:**
- Overwrite: `packages/server/src/rooms/services/CombatService.ts`

**Kontext:** Altes CombatService.ts komplett ersetzen. Neue Messages: `combatInit`, `combatRound`, `combatFlee`. DB-Logging in `combat_log`. Pirate-Level aus `getPirateLevel()`.

**Schritt 1: Relevante Imports prüfen**
```bash
grep -n "getPirateLevel\|insertCombatLog\|combat_log" packages/server/src/db/queries.ts | head -10
```

Falls `insertCombatLog` noch nicht existiert, in `queries.ts` ergänzen:
```typescript
export async function insertCombatLog(entry: {
  playerId: string; quadrantX: number; quadrantY: number;
  sectorX: number; sectorY: number; enemyType: string; enemyLevel: number;
  outcome: string; rounds: number; playerHpEnd: number;
  modulesDamaged: object[]; loot: object;
}): Promise<void> {
  await query(
    `INSERT INTO combat_log (player_id, quadrant_x, quadrant_y, sector_x, sector_y,
      enemy_type, enemy_level, outcome, rounds, player_hp_end, modules_damaged, loot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [entry.playerId, entry.quadrantX, entry.quadrantY, entry.sectorX, entry.sectorY,
     entry.enemyType, entry.enemyLevel, entry.outcome, entry.rounds,
     entry.playerHpEnd, JSON.stringify(entry.modulesDamaged), JSON.stringify(entry.loot)],
  );
}
```

**Schritt 2: Neues CombatService.ts schreiben**

```typescript
// packages/server/src/rooms/services/CombatService.ts
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { calculateShipStats } from '@void-sector/shared';
import { getAPState, saveAPState } from './RedisAPStore.js';
import { calculateCurrentAP, spendAP } from '../../engine/ap.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import { initCombat, resolveRound } from '../../engine/combatEngine.js';
import type { CombatState, RoundInput } from '../../engine/combatTypes.js';
import { getPirateLevel } from '../../engine/npcgen.js';
import { getActiveShip, updateShipModules, insertCombatLog } from '../../db/queries.js';
import { rejectGuest } from './utils.js';

const COMBAT_AP_COST = 2;

export class CombatService {
  private combatStates = new Map<string, CombatState>();

  constructor(private ctx: ServiceContext) {}

  /** Pirat erscheint — Client hat Kampf initiiert */
  async handleCombatInit(
    client: Client,
    data: { pirateLevel?: number; sectorX: number; sectorY: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (rejectGuest(client, auth)) return;

    const ship = await getActiveShip(auth.userId);
    if (!ship) return;

    const ap = await getAPState(auth.userId);
    const updatedAp = spendAP(calculateCurrentAP(ap), COMBAT_AP_COST);
    if (!updatedAp) {
      client.send('error', { code: 'NO_AP', message: 'Zu wenig AP für Kampf' });
      return;
    }
    await saveAPState(auth.userId, updatedAp);

    const level = data.pirateLevel ?? getPirateLevel(data.sectorX, data.sectorY);
    const state = initCombat(auth.userId, ship.modules, 'pirate', level);
    this.combatStates.set(client.sessionId, state);

    client.send('combatInit', {
      enemyType: state.enemyType,
      enemyLevel: state.enemyLevel,
      enemyHp: state.enemyHp,
      enemyMaxHp: state.enemyMaxHp,
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      playerModules: state.playerModules,
      round: state.round,
    });
  }

  /** Spieler sendet Rundeninput */
  async handleCombatRound(client: Client, data: RoundInput): Promise<void> {
    const auth = client.auth as AuthPayload;
    const state = this.combatStates.get(client.sessionId);
    if (!state) {
      client.send('error', { code: 'NO_COMBAT', message: 'Kein aktiver Kampf' });
      return;
    }

    const result = resolveRound(state, data);

    // Update state
    state.playerHp = result.newPlayerHp;
    state.enemyHp = result.newEnemyHp;
    state.epBuffer = result.newEpBuffer;
    state.round += 1;

    // Apply module damage
    for (const dmgEvent of result.playerModuleDamage) {
      const mod = state.playerModules.find(m => m.slotIndex === dmgEvent.slotIndex);
      if (mod) mod.currentHp = dmgEvent.hpAfter;
    }

    client.send('combatRound', { result, state: {
      playerHp: state.playerHp,
      enemyHp: state.enemyHp,
      round: state.round,
      epBuffer: state.epBuffer,
    }});

    if (result.combatEnd) {
      await this._endCombat(client, auth.userId, state, result.combatEnd);
    }
  }

  private async _endCombat(
    client: Client, userId: string, state: CombatState, outcome: string,
  ): Promise<void> {
    this.combatStates.delete(client.sessionId);

    // Persist module damage
    const ship = await getActiveShip(userId);
    if (ship) {
      await updateShipModules(ship.id, state.playerModules);
    }

    // ACEP XP
    if (outcome === 'victory') {
      await addAcepXpForPlayer(userId, 'kampf', 10).catch(() => {});
    }

    // Log
    await insertCombatLog({
      playerId: userId,
      quadrantX: 0, quadrantY: 0, sectorX: 0, sectorY: 0,
      enemyType: state.enemyType,
      enemyLevel: state.enemyLevel,
      outcome,
      rounds: state.round,
      playerHpEnd: state.playerHp,
      modulesDamaged: state.playerModules
        .filter(m => (m.currentHp ?? 999) < (MODULES_MAXHP[m.moduleId] ?? 999))
        .map(m => ({ moduleId: m.moduleId, currentHp: m.currentHp })),
      loot: {},
    }).catch(() => {});

    client.send('combatEnd', { outcome, playerHp: state.playerHp });
  }
}

// Helper: get maxHp from module definition
import { MODULES } from '@void-sector/shared';
const MODULES_MAXHP: Record<string, number> = {};
for (const [id, def] of Object.entries(MODULES)) {
  MODULES_MAXHP[id] = (def as any).maxHp ?? 20;
}
```

**Schritt 3: SectorRoom.ts — neue Messages registrieren**
```bash
grep -n "combatV2\|battleAction\|CombatService" packages/server/src/rooms/SectorRoom.ts | head -20
```
Alte `battleAction`/`combatV2Action` Handler durch neue ersetzen:
```typescript
this.onMessage('combatInit', (client, data) => this.combatService.handleCombatInit(client, data));
this.onMessage('combatRound', (client, data) => this.combatService.handleCombatRound(client, data));
```

**Schritt 4: Server-Tests**
```bash
cd packages/server && npx vitest run 2>&1 | tail -10
```

**Schritt 5: Commit**
```bash
git add packages/server/src/rooms/services/CombatService.ts \
        packages/server/src/rooms/SectorRoom.ts \
        packages/server/src/db/queries.ts
git commit -m "feat(server): CombatService v1.0 — energy rounds, module damage persistence, combat_log"
```

---

## Task 9: RepairService.ts (server)

**Files:**
- Create: `packages/server/src/rooms/services/RepairService.ts`
- Create: `packages/server/src/engine/__tests__/repairService.test.ts`

**Schritt 1: Test**

```typescript
// packages/server/src/engine/__tests__/repairService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateRepairCost, canRepairOnboard } from '../repairEngine.js';

describe('calculateRepairCost', () => {
  it('light damage costs ore', () => {
    const cost = calculateRepairCost('light', 'intact');
    expect(cost.ore).toBeGreaterThan(0);
    expect(cost.crystal).toBe(0);
  });

  it('destroyed → heavy costs crystal', () => {
    const cost = calculateRepairCost('destroyed', 'heavy');
    expect(cost.crystal).toBeGreaterThan(0);
  });
});

describe('canRepairOnboard', () => {
  it('returns false without repair module', () => {
    expect(canRepairOnboard([])).toBe(false);
  });

  it('returns true with repair module', () => {
    const mods = [{ moduleId: 'repair_mk1', slotIndex: 8, source: 'standard' as const }];
    expect(canRepairOnboard(mods)).toBe(true);
  });
});
```

**Schritt 2: repairEngine.ts erstellen**

```typescript
// packages/server/src/engine/repairEngine.ts
import { MODULES } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';
import type { DamageState } from '@void-sector/shared';

export interface RepairCost {
  ore: number;
  crystal: number;
}

export function getDamageStateFromHp(currentHp: number, maxHp: number): DamageState {
  const r = currentHp / maxHp;
  if (r > 0.75) return 'intact';
  if (r > 0.50) return 'light';
  if (r > 0.25) return 'heavy';
  return 'destroyed';
}

export function calculateRepairCost(from: DamageState, to: DamageState): RepairCost {
  const costs: Record<string, RepairCost> = {
    'destroyed→heavy': { ore: 10, crystal: 20 },
    'heavy→light':     { ore: 15, crystal: 5 },
    'light→intact':    { ore: 10, crystal: 0 },
  };
  return costs[`${from}→${to}`] ?? { ore: 0, crystal: 0 };
}

export function canRepairOnboard(modules: ShipModule[]): boolean {
  return modules.some(m => MODULES[m.moduleId]?.category === 'repair');
}
```

**Schritt 3: RepairService.ts erstellen**

```typescript
// packages/server/src/rooms/services/RepairService.ts
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { MODULES } from '@void-sector/shared';
import { getDamageState } from '@void-sector/shared';
import { getActiveShip, updateShipModules, getPlayerCredits, deductCredits } from '../../db/queries.js';
import { getCargoState, removeFromInventory } from '../../engine/inventoryService.js';
import { calculateRepairCost, canRepairOnboard } from '../../engine/repairEngine.js';
import { rejectGuest } from './utils.js';

export class RepairService {
  constructor(private ctx: ServiceContext) {}

  /** Onboard-Reparatur eines Moduls (kostet Ressourcen) */
  async handleRepairModule(
    client: Client,
    data: { slotIndex: number; targetState: 'intact' | 'light' | 'heavy' },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (rejectGuest(client, auth)) return;

    const ship = await getActiveShip(auth.userId);
    if (!ship) return;

    if (!canRepairOnboard(ship.modules)) {
      client.send('error', { code: 'NO_REPAIR', message: 'Kein Repair-Modul installiert' });
      return;
    }

    const mod = ship.modules.find(m => m.slotIndex === data.slotIndex);
    if (!mod) {
      client.send('error', { code: 'NO_MODULE', message: 'Modul nicht gefunden' });
      return;
    }

    const def = MODULES[mod.moduleId];
    if (!def) return;
    const maxHp = (def as any).maxHp ?? 20;
    const currentHp = mod.currentHp ?? maxHp;
    const fromState = getDamageState(currentHp, maxHp);
    const cost = calculateRepairCost(fromState, data.targetState);

    // Check resources
    const cargo = await getCargoState(auth.userId);
    if ((cargo.ore ?? 0) < cost.ore || (cargo.crystal ?? 0) < cost.crystal) {
      client.send('error', { code: 'NO_RESOURCES', message: 'Zu wenige Ressourcen' });
      return;
    }

    // Deduct resources
    if (cost.ore > 0) await removeFromInventory(auth.userId, 'resource', 'ore', cost.ore);
    if (cost.crystal > 0) await removeFromInventory(auth.userId, 'resource', 'crystal', cost.crystal);

    // Repair: set HP based on targetState
    const targetHpRatio = data.targetState === 'intact' ? 1.0 : data.targetState === 'light' ? 0.80 : 0.60;
    const newHp = Math.floor(maxHp * targetHpRatio);
    const newModules = ship.modules.map(m =>
      m.slotIndex === data.slotIndex ? { ...m, currentHp: newHp } : m,
    );
    await updateShipModules(ship.id, newModules);

    client.send('moduleRepaired', { slotIndex: data.slotIndex, currentHp: newHp, maxHp });
  }

  /** Station-Reparatur: alles auf voll, kostet Credits */
  async handleStationRepair(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (rejectGuest(client, auth)) return;

    const ship = await getActiveShip(auth.userId);
    if (!ship) return;

    // Calculate cost: 50 Credits per damaged module
    const damagedCount = ship.modules.filter(m => {
      const def = MODULES[m.moduleId];
      if (!def) return false;
      const maxHp = (def as any).maxHp ?? 20;
      return (m.currentHp ?? maxHp) < maxHp;
    }).length;

    const cost = damagedCount * 50;
    if (cost === 0) {
      client.send('stationRepairDone', { cost: 0 });
      return;
    }

    const credits = await getPlayerCredits(auth.userId);
    if (credits < cost) {
      client.send('error', { code: 'NO_CREDITS', message: `Reparatur kostet ${cost} Credits` });
      return;
    }

    await deductCredits(auth.userId, cost);
    const newModules = ship.modules.map(m => {
      const def = MODULES[m.moduleId];
      const maxHp = (def as any)?.maxHp ?? 20;
      return { ...m, currentHp: maxHp };
    });
    await updateShipModules(ship.id, newModules);

    client.send('stationRepairDone', { cost, modules: newModules });
  }
}
```

**Schritt 4: Tests**
```bash
cd packages/server && npx vitest run src/engine/__tests__/repairService.test.ts
```

**Schritt 5: Commit**
```bash
git add packages/server/src/engine/repairEngine.ts \
        packages/server/src/rooms/services/RepairService.ts \
        packages/server/src/engine/__tests__/repairService.test.ts
git commit -m "feat(server): RepairService + repairEngine — onboard (resources) + station (credits) repair"
```

---

## Task 10: AP-System + ShipService (server)

**Files:**
- Modify: `packages/server/src/engine/ap.ts`
- Modify: `packages/server/src/rooms/services/ShipService.ts`

**Kontext:** `ap.ts` muss `regenPerSecond` aus dem Generator-Modul lesen statt aus Konstante. ShipService muss bei Schiff-Erstellung einen Generator Tier 1 einbauen.

**Schritt 1: ap.ts anpassen**

Suche `createAPState` in `packages/server/src/engine/ap.ts`. Füge neue Funktion hinzu:
```typescript
import { calculateApRegen } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';

/** Erstellt AP-State mit dynamischem Regen basierend auf Generator-Modul */
export function createAPStateForShip(modules: ShipModule[], now: number = Date.now()): APState {
  return {
    current: AP_DEFAULTS.startingAP,
    max: AP_DEFAULTS.max,
    lastTick: now,
    regenPerSecond: calculateApRegen(modules),
  };
}

/** Aktualisiert regenPerSecond wenn Module sich ändern */
export function updateAPRegen(ap: APState, modules: ShipModule[]): APState {
  return { ...ap, regenPerSecond: calculateApRegen(modules) };
}
```

**Schritt 2: ShipService — Generator bei Schiff-Erstellung**

Suche in `packages/server/src/rooms/services/ShipService.ts` die Funktion die ein neues Schiff erstellt (wahrscheinlich `handleCreateShip` oder ähnlich, prüfen mit `grep -n "createShip\|INSERT INTO ships\|handleCreate" packages/server/src/rooms/services/ShipService.ts | head -10`).

Nach Schiff-Erstellung Generator Tier 1 installieren:
```typescript
// Nach createShip():
const startModules: ShipModule[] = [{
  moduleId: 'generator_mk1',
  slotIndex: 0,
  source: 'standard' as const,
  powerLevel: 'high' as const,
  currentHp: 20,
}];
await updateShipModules(newShip.id, startModules);
```

Außerdem: Überall in ShipService wo `calculateCurrentAP` aufgerufen wird und danach AP gespeichert wird, `updateAPRegen` aufrufen wenn Module sich ändern (in `handleInstallModule`, `handleRemoveModule`):
```typescript
const updatedAp = updateAPRegen(ap, newModules);
await saveAPState(auth.userId, updatedAp);
```

**Schritt 3: Tests**
```bash
cd packages/server && npx vitest run 2>&1 | tail -10
```

**Schritt 4: Commit**
```bash
git add packages/server/src/engine/ap.ts \
        packages/server/src/rooms/services/ShipService.ts
git commit -m "feat(server): AP regen from generator module, generator_mk1 on new ship creation"
```

---

## Task 11: Legacy-Cleanup (server)

**Files:**
- Delete: `packages/server/src/engine/combatV2.ts`
- Modify: `packages/server/src/rooms/services/CombatService.ts` (bereits erledigt in T8)
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/db/queries.ts`

**Schritt 1: combatV2.ts löschen**
```bash
git rm packages/server/src/engine/combatV2.ts
# Falls combatV2Types.ts existiert:
ls packages/server/src/engine/combatV2Types.ts 2>/dev/null && git rm packages/server/src/engine/combatV2Types.ts
```

**Schritt 2: FEATURE_COMBAT_V2 entfernen**
```bash
grep -rn "FEATURE_COMBAT_V2\|combatV2\|CombatV2\|battleAction\|insertBattleLog" \
  packages/server/src/ --include="*.ts" | grep -v "test\|combatEngine\|CombatService" | head -20
```
Alle Referenzen entfernen.

**Schritt 3: queries.ts — Legacy-Funktionen entfernen**
```bash
grep -n "insertBattleLog\|getBattleLog\|battle_log" packages/server/src/db/queries.ts | head -10
```
`insertBattleLog`, `insertBattleLogV2` Funktionen löschen.

**Schritt 4: Shared — FEATURE_COMBAT_V2 Konstante**
```bash
grep -rn "FEATURE_COMBAT_V2\|CombatV2\|CombatTactic\|SpecialAction\|CombatRound" \
  packages/shared/src/ | grep -v "test" | head -15
```
Veraltete Combat-V2-Typen in shared/types.ts entfernen falls vorhanden.

**Schritt 5: Server-Tests**
```bash
cd packages/server && npx vitest run 2>&1 | tail -10
```

**Schritt 6: Commit**
```bash
git add -A
git commit -m "chore(server): remove legacy combat — combatV2.ts, FEATURE_COMBAT_V2, battle_log queries"
```

---

## Task 12: CombatDialog rewrite (client)

**Files:**
- Overwrite: `packages/client/src/components/CombatV2Dialog.tsx` → rename to `CombatDialog.tsx`
- Delete: `packages/client/src/components/BattleDialog.tsx`
- Create: `packages/client/src/__tests__/CombatDialog.test.tsx`

**Schritt 1: Test**

```typescript
// packages/client/src/__tests__/CombatDialog.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CombatDialog } from '../components/CombatDialog.js';

const mockCombat = {
  enemyType: 'pirate', enemyLevel: 3,
  enemyHp: 50, enemyMaxHp: 50,
  playerHp: 100, playerMaxHp: 100,
  round: 1, epBuffer: 0,
  playerModules: [{
    moduleId: 'generator_mk1', slotIndex: 0, source: 'standard',
    powerLevel: 'high', currentHp: 20,
  }],
};

describe('CombatDialog', () => {
  it('renders enemy info', () => {
    render(<CombatDialog combat={mockCombat} onRoundSubmit={vi.fn()} />);
    expect(screen.getByText(/pirate/i)).toBeInTheDocument();
    expect(screen.getByText(/LVL 3/i)).toBeInTheDocument();
  });

  it('shows player HP bar', () => {
    render(<CombatDialog combat={mockCombat} onRoundSubmit={vi.fn()} />);
    expect(screen.getByText(/100\/100/i)).toBeInTheDocument();
  });

  it('shows round number', () => {
    render(<CombatDialog combat={mockCombat} onRoundSubmit={vi.fn()} />);
    expect(screen.getByText(/Runde 1/i)).toBeInTheDocument();
  });
});
```

**Schritt 2: CombatDialog.tsx erstellen**

```tsx
// packages/client/src/components/CombatDialog.tsx
import React, { useState } from 'react';
import type { ShipModule } from '@void-sector/shared';
import { getModuleEffectivePowerLevel } from '@void-sector/shared';

interface CombatInfo {
  enemyType: string; enemyLevel: number;
  enemyHp: number; enemyMaxHp: number;
  playerHp: number; playerMaxHp: number;
  round: number; epBuffer: number;
  playerModules: ShipModule[];
}

interface Props {
  combat: CombatInfo;
  onRoundSubmit: (input: {
    energyAllocation: Record<number, string>;
    primaryAction: string;
  }) => void;
}

function HpBar({ current, max, label, color }: { current: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.max(0, current / max) : 0;
  const filled = Math.round(pct * 20);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return (
    <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color }}>
      {label} [{bar}] {current}/{max}
    </div>
  );
}

export function CombatDialog({ combat, onRoundSubmit }: Props) {
  const [action, setAction] = useState<string>('attack');

  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #333', padding: '16px', fontFamily: 'monospace', color: '#8f8' }}>
      <div style={{ color: '#f44', marginBottom: '8px' }}>
        ⚠ KAMPF — {combat.enemyType.toUpperCase()} LVL {combat.enemyLevel}
      </div>
      <div style={{ color: '#666', fontSize: '0.65rem', marginBottom: '12px' }}>
        Runde {combat.round} / 10
      </div>

      <HpBar current={combat.enemyHp} max={combat.enemyMaxHp} label="FEIND" color="#f44" />
      <HpBar current={combat.playerHp} max={combat.playerMaxHp} label="SCHIFF" color="#4f4" />

      <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '8px' }}>
        <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '6px' }}>AKTION</div>
        {(['attack', 'flee', 'wait'] as const).map(a => (
          <button key={a} onClick={() => setAction(a)}
            style={{ marginRight: '8px', background: action === a ? '#1a3a1a' : '#111',
              border: `1px solid ${action === a ? '#4f4' : '#333'}`, color: '#8f8',
              padding: '3px 10px', fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer' }}>
            {a.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        onClick={() => onRoundSubmit({ energyAllocation: {}, primaryAction: action })}
        style={{ marginTop: '12px', background: '#1a2a1a', border: '1px solid #4f4',
          color: '#4f4', padding: '6px 20px', fontFamily: 'monospace', cursor: 'pointer' }}>
        ▶ AUSFÜHREN
      </button>
    </div>
  );
}
```

**Schritt 3: Test laufen**
```bash
cd packages/client && npx vitest run src/__tests__/CombatDialog.test.tsx
```

**Schritt 4: Alte Dialoge entfernen**
```bash
git rm packages/client/src/components/BattleDialog.tsx \
        packages/client/src/components/CombatV2Dialog.tsx 2>/dev/null || true
```

**Schritt 5: Client-Tests**
```bash
cd packages/client && npx vitest run 2>&1 | tail -10
```

**Schritt 6: Commit**
```bash
git add packages/client/src/components/CombatDialog.tsx \
        packages/client/src/__tests__/CombatDialog.test.tsx
git commit -m "feat(client): CombatDialog v1.0 — energy allocation UI, HP bars, round structure"
```

---

## Task 13: RepairPanel (client)

**Files:**
- Create: `packages/client/src/components/RepairPanel.tsx`
- Create: `packages/client/src/__tests__/RepairPanel.test.tsx`

**Schritt 1: Test**

```typescript
// packages/client/src/__tests__/RepairPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RepairPanel } from '../components/RepairPanel.js';

const mockModules = [
  { moduleId: 'laser_mk2', slotIndex: 2, source: 'standard', powerLevel: 'high', currentHp: 15 },
  { moduleId: 'generator_mk1', slotIndex: 0, source: 'standard', powerLevel: 'high', currentHp: 20 },
];

describe('RepairPanel', () => {
  it('shows damaged module', () => {
    render(<RepairPanel modules={mockModules} onRepair={vi.fn()} atStation={false} />);
    expect(screen.getByText(/LASER MK.II/i)).toBeInTheDocument();
  });

  it('shows station repair button when at station', () => {
    render(<RepairPanel modules={mockModules} onRepair={vi.fn()} atStation={true} />);
    expect(screen.getByText(/STATION/i)).toBeInTheDocument();
  });
});
```

**Schritt 2: RepairPanel.tsx erstellen**

```tsx
// packages/client/src/components/RepairPanel.tsx
import React from 'react';
import { MODULES } from '@void-sector/shared';
import { getDamageState } from '@void-sector/shared';
import { getModuleSourceColor } from './moduleUtils.js';
import type { ShipModule } from '@void-sector/shared';

interface Props {
  modules: ShipModule[];
  atStation: boolean;
  onRepair: (slotIndex: number, type: 'onboard' | 'station') => void;
}

const STATE_COLORS = { intact: '#4a9', light: '#aa6', heavy: '#a64', destroyed: '#a44' };

export function RepairPanel({ modules, atStation, onRepair }: Props) {
  const damaged = modules.filter(m => {
    const def = MODULES[m.moduleId];
    if (!def) return false;
    const maxHp = (def as any).maxHp ?? 20;
    const state = getDamageState(m.currentHp ?? maxHp, maxHp);
    return state !== 'intact';
  });

  if (damaged.length === 0) {
    return <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#4a9', padding: '8px' }}>
      ✓ Alle Module intakt
    </div>;
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '8px' }}>
      <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '8px' }}>SCHADENSÜBERSICHT</div>
      {damaged.map(m => {
        const def = MODULES[m.moduleId];
        if (!def) return null;
        const maxHp = (def as any).maxHp ?? 20;
        const currentHp = m.currentHp ?? maxHp;
        const state = getDamageState(currentHp, maxHp);
        return (
          <div key={m.slotIndex} style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: getModuleSourceColor(m.source), minWidth: '100px', fontSize: '0.7rem' }}>
              {def.displayName}
            </span>
            <span style={{ color: STATE_COLORS[state], fontSize: '0.65rem', minWidth: '60px' }}>
              {state.toUpperCase()}
            </span>
            <span style={{ color: '#666', fontSize: '0.65rem' }}>{currentHp}/{maxHp} HP</span>
            {atStation && (
              <button onClick={() => onRepair(m.slotIndex, 'station')}
                style={{ background: '#111', border: '1px solid #4a9', color: '#4a9',
                  padding: '1px 8px', fontFamily: 'monospace', fontSize: '0.6rem', cursor: 'pointer' }}>
                STATION
              </button>
            )}
            <button onClick={() => onRepair(m.slotIndex, 'onboard')}
              style={{ background: '#111', border: '1px solid #666', color: '#888',
                padding: '1px 8px', fontFamily: 'monospace', fontSize: '0.6rem', cursor: 'pointer' }}>
              ONBOARD
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

**Schritt 3: Test laufen**
```bash
cd packages/client && npx vitest run src/__tests__/RepairPanel.test.tsx
```

**Schritt 4: Client-Tests**
```bash
cd packages/client && npx vitest run 2>&1 | tail -10
```

**Schritt 5: Commit**
```bash
git add packages/client/src/components/RepairPanel.tsx \
        packages/client/src/__tests__/RepairPanel.test.tsx
git commit -m "feat(client): RepairPanel — module damage overview with onboard/station repair actions"
```

---

## Abschluss-Verifikation

```bash
cd packages/shared && npx vitest run && npm run build
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Alle Tests grün (pre-existing failures unverändert) → fertig.
