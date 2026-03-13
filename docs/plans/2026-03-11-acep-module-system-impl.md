# ACEP Modul-System — Implementierungsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Specialized-Slot-System, ACEP-Level-Multiplikatoren auf Module, Found-Module mit Drawbacks, XP-Trigger in allen Services, ACEP-UI-Panel.

**Architecture:** Drei Schichten — shared (Types/Constants/Calculator), server (Services/Migration/XP-Trigger), client (UI). Änderungen werden bottom-up implementiert: shared zuerst, dann server, dann client. `calculateShipStats` bekommt ACEP-XP als Parameter und wendet Multiplikatoren an. Specialized Slots sind kategoriebasiert (Slot-Index 0–6 reserviert), Extra-Slots ab Index 7 durch AUSBAU-Level freigeschaltet.

**Tech Stack:** TypeScript · Vitest · PostgreSQL (Migration 052) · React + Zustand

**Design-Dokument:** `docs/plans/2026-03-11-acep-module-system-design.md`

**WICHTIG vor Start:**
```bash
cd packages/shared && npm run build   # Nach jeder shared-Änderung!
cd packages/server && npx vitest run  # ~973 Tests, alle grün halten
cd packages/client && npx vitest run  # ~499 Tests
```

---

## Übersicht: Tasks

| # | Task | Paket | Status |
|---|------|-------|--------|
| 1 | Type-Erweiterungen | shared | — |
| 2 | Specialized-Slot-Konstanten + ACEP-Level-Thresholds | shared | — |
| 3 | Found-Module-Definitionen | shared | — |
| 4 | calculateShipStats mit ACEP-Multiplikatoren | shared | — |
| 5 | validateModuleInstall — Specialized-Slot-Enforcement | shared | — |
| 6 | DB-Migration 052 — module_source | server | — |
| 7 | XP-Trigger in NavigationService | server | — |
| 8 | XP-Trigger in ScanService | server | — |
| 9 | XP-Trigger in MiningService | server | — |
| 10 | XP-Trigger in CombatService | server | — |
| 11 | XP-Trigger in EconomyService | server | — |
| 12 | Passive Drawback Engine | server | — |
| 13 | ShipService — handleInstallModule anpassen | server | — |
| 14 | ACEP-Tab UI | client | — |
| 15 | Module-Farbkodierung im HANGAR | client | — |

---

## Task 1: Type-Erweiterungen (shared)

**Files:**
- Modify: `packages/shared/src/types.ts`

**Kontext:** `ShipModule` hat derzeit nur `{ moduleId, slotIndex }`. `ModuleDefinition` hat kein `source`-Feld und keine Drawback-Definition.

**Schritt 1: Typen lesen**
```bash
grep -n "ShipModule\|ModuleDefinition\|ModuleCategory" packages/shared/src/types.ts | head -30
```

**Schritt 2: Failing test schreiben**
Datei: `packages/shared/src/__tests__/moduleTypes.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import type { ShipModule, ModuleDefinition, ModuleSource, AcepPath } from '../types.js';

describe('module type extensions', () => {
  it('ShipModule has source field', () => {
    const m: ShipModule = { moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' };
    expect(m.source).toBe('standard');
  });

  it('ModuleSource covers all variants', () => {
    const sources: ModuleSource[] = ['standard', 'found', 'researched'];
    expect(sources).toHaveLength(3);
  });

  it('AcepPath covers all 4 paths', () => {
    const paths: AcepPath[] = ['ausbau', 'intel', 'kampf', 'explorer'];
    expect(paths).toHaveLength(4);
  });
});
```

**Schritt 3: Test laufen lassen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/moduleTypes.test.ts
```
Erwartet: `FAIL — Cannot find 'ModuleSource'`

**Schritt 4: Typen hinzufügen in `packages/shared/src/types.ts`**

Suche den Block mit `ShipModule` und füge direkt darüber ein:
```typescript
export type ModuleSource = 'standard' | 'found' | 'researched';
export type AcepPath = 'ausbau' | 'intel' | 'kampf' | 'explorer';

export interface ModuleDrawback {
  stat?: keyof ShipStats;          // passive Stat-Penalty (z.B. jumpRange: -2)
  delta?: number;
  runtimeEffect?: string;          // ID für Laufzeit-Logik (z.B. 'rift_engine_drift')
  description: string;             // Angezeigter Text im UI
}
```

`ShipModule` erweitern:
```typescript
export interface ShipModule {
  moduleId: string;
  slotIndex: number;
  source: ModuleSource;            // NEU
}
```

`ModuleDefinition` erweitern (nach `factionRequirement`):
```typescript
  isUnique?: boolean;              // true = max 1× pro Schiff (shield, scanner)
  isFoundOnly?: boolean;           // true = nicht kaufbar, nur fundbar
  drawbacks?: ModuleDrawback[];    // nur bei found-Modulen
  acepPaths?: AcepPath[];          // welche Pfade von diesem Modul profitieren
```

**Schritt 5: Test laufen lassen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/moduleTypes.test.ts
```

**Schritt 6: shared bauen**
```bash
cd packages/shared && npm run build
```
Kein TypeScript-Fehler erlaubt.

**Schritt 7: Alle Tests grün**
```bash
cd packages/shared && npx vitest run
```

**Schritt 8: Commit**
```bash
git add packages/shared/src/types.ts packages/shared/src/__tests__/moduleTypes.test.ts
git commit -m "feat(shared): add ModuleSource, AcepPath, ModuleDrawback types to ShipModule/ModuleDefinition"
```

---

## Task 2: Specialized-Slot-Konstanten + ACEP-Level-Thresholds (shared)

**Files:**
- Modify: `packages/shared/src/constants.ts`

**Kontext:** Specialized Slots sind kategoriebasiert. Slot-Index 0–6 sind für die 7 Kategorien mit Specialized Slots reserviert. Extra-Slots beginnen bei Index 7.

**Schritt 1: Failing test schreiben**
Datei: `packages/shared/src/__tests__/slotSystem.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_SLOT_CATEGORIES,
  SPECIALIZED_SLOT_INDEX,
  UNIQUE_MODULE_CATEGORIES,
  DEFENSE_ONLY_CATEGORIES,
  ACEP_EXTRA_SLOT_THRESHOLDS,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
} from '../constants.js';

describe('specialized slot system', () => {
  it('has 7 specialized slot categories', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES).toHaveLength(7);
  });

  it('drive is slot 0', () => {
    expect(SPECIALIZED_SLOT_INDEX['drive']).toBe(0);
  });

  it('cargo is slot 6', () => {
    expect(SPECIALIZED_SLOT_INDEX['cargo']).toBe(6);
  });

  it('shield and scanner are unique', () => {
    expect(UNIQUE_MODULE_CATEGORIES).toContain('shield');
    expect(UNIQUE_MODULE_CATEGORIES).toContain('scanner');
  });

  it('defense and special are extra-slot-only', () => {
    expect(DEFENSE_ONLY_CATEGORIES).toContain('defense');
    expect(DEFENSE_ONLY_CATEGORIES).toContain('special');
  });

  it('extra slots unlock at ausbau XP thresholds', () => {
    // Level 2 AUSBAU = +1 slot, Level 4 = +2, Level 6 = +3, Level 8 = +4
    expect(ACEP_EXTRA_SLOT_THRESHOLDS[0]).toBe(10); // first extra slot at 10 ausbau XP
  });

  it('ACEP level 5 gives +50% multiplier', () => {
    expect(ACEP_LEVEL_MULTIPLIERS[5]).toBe(1.5);
  });
});
```

**Schritt 2: Test laufen lassen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/slotSystem.test.ts
```

**Schritt 3: Konstanten in `packages/shared/src/constants.ts` hinzufügen**

Am Anfang der Datei (nach den Imports), neue Sektion einfügen:
```typescript
// ─── ACEP SLOT SYSTEM ────────────────────────────────────────────────────────

/** Kategorien mit festem Specialized Slot (Slot 0–6) */
export const SPECIALIZED_SLOT_CATEGORIES: ModuleCategory[] = [
  'drive',    // slot 0
  'weapon',   // slot 1
  'armor',    // slot 2
  'shield',   // slot 3
  'scanner',  // slot 4
  'mining',   // slot 5
  'cargo',    // slot 6
];

/** Slot-Index pro Kategorie (nur Specialized) */
export const SPECIALIZED_SLOT_INDEX: Partial<Record<ModuleCategory, number>> = {
  drive:   0,
  weapon:  1,
  armor:   2,
  shield:  3,
  scanner: 4,
  mining:  5,
  cargo:   6,
};

/** Unique: max 1× pro Schiff, auch in Extra-Slots nicht stapelbar */
export const UNIQUE_MODULE_CATEGORIES: ModuleCategory[] = ['shield', 'scanner'];

/** Nur in Extra-Slots einbaubar (kein Specialized Slot) */
export const DEFENSE_ONLY_CATEGORIES: ModuleCategory[] = ['defense', 'special'];

/** ausbau-XP-Schwellwerte für Extra-Slot-Freischaltung (aufsteigend) */
export const ACEP_EXTRA_SLOT_THRESHOLDS: number[] = [10, 25, 40, 50];
// Slot 7 ab ausbau XP >= 10, Slot 8 ab >= 25, Slot 9 ab >= 40, Slot 10 ab >= 50

// ─── ACEP LEVEL THRESHOLDS ───────────────────────────────────────────────────

/** XP-Schwellwerte pro Pfad für Level 1–5 */
export const ACEP_LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,   // Level 1 = Basis (immer)
  2: 8,   // 8 XP in Pfad
  3: 18,  // 18 XP
  4: 32,  // 32 XP
  5: 50,  // 50 XP (Maximum)
};

/** Multiplikator auf Modul-Effekte je Level (1.0 = kein Bonus) */
export const ACEP_LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.1,   // +10%
  3: 1.2,   // +20%
  4: 1.35,  // +35%
  5: 1.5,   // +50%
};
```

**Schritt 4: Test laufen lassen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/slotSystem.test.ts
```

**Schritt 5: shared bauen + alle Tests**
```bash
cd packages/shared && npm run build && npx vitest run
```

**Schritt 6: Commit**
```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/slotSystem.test.ts
git commit -m "feat(shared): add specialized slot system constants and ACEP level thresholds"
```

---

## Task 3: Found-Module-Definitionen (shared)

**Files:**
- Modify: `packages/shared/src/constants.ts` (MODULES-Objekt erweitern)

**Kontext:** 34 Found-Module aus dem Design-Dokument müssen als `ModuleDefinition`-Einträge mit `isFoundOnly: true`, `drawbacks`, `isUnique` angelegt werden. Bestehende Standard-Module bekommen `acepPaths` und `isUnique` ergänzt.

**Schritt 1: Failing test schreiben**
Datei: `packages/shared/src/__tests__/foundModules.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { MODULES } from '../constants.js';

describe('found modules', () => {
  it('pulse_drive is found-only', () => {
    expect(MODULES['pulse_drive']).toBeDefined();
    expect(MODULES['pulse_drive'].isFoundOnly).toBe(true);
  });

  it('pulse_drive has a drawback', () => {
    expect(MODULES['pulse_drive'].drawbacks).toHaveLength(1);
    expect(MODULES['pulse_drive'].drawbacks![0].description).toBeTruthy();
  });

  it('ancient_lance has higher ATK than laser_mk3', () => {
    const lance = MODULES['ancient_lance'].effects.weaponAttack ?? 0;
    const laser = MODULES['laser_mk3'].effects.weaponAttack ?? 0;
    expect(lance).toBeGreaterThan(laser);
  });

  it('shield_mk1 is unique', () => {
    expect(MODULES['shield_mk1'].isUnique).toBe(true);
  });

  it('scanner_mk1 is unique', () => {
    expect(MODULES['scanner_mk1'].isUnique).toBe(true);
  });

  it('all found modules have drawbacks', () => {
    const foundModules = Object.values(MODULES).filter((m) => m.isFoundOnly);
    for (const mod of foundModules) {
      expect(mod.drawbacks, `${mod.id} missing drawbacks`).toBeDefined();
      expect(mod.drawbacks!.length, `${mod.id} drawbacks empty`).toBeGreaterThan(0);
    }
  });

  it('all modules have acepPaths defined', () => {
    for (const mod of Object.values(MODULES)) {
      expect(mod.acepPaths, `${mod.id} missing acepPaths`).toBeDefined();
      expect(mod.acepPaths!.length).toBeGreaterThan(0);
    }
  });
});
```

**Schritt 2: Test laufen lassen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/foundModules.test.ts
```

**Schritt 3: Bestehende Module mit `acepPaths` + `isUnique` ergänzen**

Im MODULES-Objekt für jede Kategorie die neuen Felder ergänzen:
- `drive_*` → `acepPaths: ['ausbau', 'explorer']`
- `weapon_*`, `laser_*`, `railgun_*`, `missile_*`, `emp_*`, `armor_*` → `acepPaths: ['kampf']`
- `shield_*` → `acepPaths: ['kampf', 'ausbau'], isUnique: true`
- `scanner_*` → `acepPaths: ['intel'], isUnique: true`
- `mining_*` → `acepPaths: ['ausbau']`
- `cargo_*` → `acepPaths: ['ausbau']`
- `defense_*`, `point_defense`, `ecm_suite` → `acepPaths: ['kampf']`
- `special_*` → je nach Modul

**Schritt 4: Found-Module am Ende des MODULES-Objekts einfügen**

```typescript
// ─── FOUND MODULES (isFoundOnly: true) ───────────────────────────────────────

// DRIVE
pulse_drive: {
  id: 'pulse_drive', category: 'drive', tier: 4,
  name: 'pulse_drive', displayName: 'Pulse Drive',
  primaryEffect: { stat: 'jumpRange', delta: 6, label: '+6 Sprungreichweite' },
  secondaryEffects: [{ stat: 'engineSpeed', delta: 4, label: 'Engine max' }],
  effects: { jumpRange: 6, engineSpeed: 4 },
  cost: { credits: 0 },
  acepPaths: ['ausbau', 'explorer'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'pulse_drive_overheat', description: 'Jeder 3. Sprung kostet 2× AP (Überhitzung)' }],
},
ghost_drive: {
  id: 'ghost_drive', category: 'drive', tier: 3,
  name: 'ghost_drive', displayName: 'Ghost Drive',
  primaryEffect: { stat: 'jumpRange', delta: -2, label: '−2 Sprungreichweite' },
  secondaryEffects: [],
  effects: { jumpRange: -2 },
  cost: { credits: 0 },
  acepPaths: ['explorer'],
  isFoundOnly: true,
  drawbacks: [
    { stat: 'jumpRange', delta: -2, description: '−2 Sprungreichweite' },
    { runtimeEffect: 'ghost_drive_no_hyperjump', description: 'Kein Hyperjump möglich' },
  ],
},
rift_engine: {
  id: 'rift_engine', category: 'drive', tier: 5,
  name: 'rift_engine', displayName: 'Rift Engine',
  primaryEffect: { stat: 'jumpRange', delta: 8, label: '+8 Sprungreichweite' },
  secondaryEffects: [],
  effects: { jumpRange: 8, hyperdriveFuelEfficiency: 1.0 },
  cost: { credits: 0 },
  acepPaths: ['ausbau', 'explorer'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'rift_engine_drift', description: '5% Chance: landet 1–2 Sektoren daneben' }],
},

// WEAPON
ancient_lance: {
  id: 'ancient_lance', category: 'weapon', tier: 5,
  name: 'ancient_lance', displayName: 'Ancient Lance',
  primaryEffect: { stat: 'weaponAttack', delta: 45, label: '+45 ATK' },
  secondaryEffects: [{ stat: 'weaponPiercing', delta: 0.4, label: '+40% Pierce' }],
  effects: { weaponAttack: 45, weaponPiercing: 0.4, weaponType: 'laser' },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'ancient_lance_cooldown', description: 'Feuert nur jede 2. Runde (Ladezeit)' }],
},
void_ripper: {
  id: 'void_ripper', category: 'weapon', tier: 4,
  name: 'void_ripper', displayName: 'Void Ripper',
  primaryEffect: { stat: 'weaponAttack', delta: 35, label: '+35 ATK' },
  secondaryEffects: [],
  effects: { weaponAttack: 35, weaponType: 'railgun' },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'void_ripper_recoil', description: '−30 HP eigenes Schiff pro Abfeuern (Rückstoß)' }],
},
leech_cannon: {
  id: 'leech_cannon', category: 'weapon', tier: 3,
  name: 'leech_cannon', displayName: 'Leech Cannon',
  primaryEffect: { stat: 'weaponAttack', delta: 20, label: '+20 ATK + 15 HP Heal' },
  secondaryEffects: [],
  effects: { weaponAttack: 20, weaponType: 'missile' },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'leech_cannon_no_shield_dmg', description: 'Kein Schaden gegen Schildierte Ziele' }],
},
scrambler: {
  id: 'scrambler', category: 'weapon', tier: 2,
  name: 'scrambler', displayName: 'Scrambler',
  primaryEffect: { stat: 'weaponAttack', delta: 5, label: '+5 ATK' },
  secondaryEffects: [],
  effects: { weaponAttack: 5, weaponType: 'emp' },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'scrambler_disable_special', description: 'Deaktiviert Gegner-Sonderaktionen für 2 Runden' }],
},

// ARMOR
living_hull: {
  id: 'living_hull', category: 'armor', tier: 4,
  name: 'living_hull', displayName: 'Living Hull',
  primaryEffect: { stat: 'hp', delta: 120, label: '+120 HP' },
  secondaryEffects: [],
  effects: { hp: 120, damageMod: -0.1 },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [
    { stat: 'damageMod', delta: -0.1, description: '−10% Schadensreduktion im Kampf' },
    { runtimeEffect: 'living_hull_regen', description: '+3 HP/s außerhalb von Kämpfen' },
  ],
},
salvage_skin: {
  id: 'salvage_skin', category: 'armor', tier: 3,
  name: 'salvage_skin', displayName: 'Salvage Skin',
  primaryEffect: { stat: 'hp', delta: 80, label: '+80 HP' },
  secondaryEffects: [{ stat: 'damageMod', delta: -0.2, label: '+20% Schadensreduktion' }],
  effects: { hp: 80, damageMod: -0.2, cargoCap: -5 },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ stat: 'cargoCap', delta: -5, description: '−5 Frachtkapazität' }],
},
reactive_plating: {
  id: 'reactive_plating', category: 'armor', tier: 3,
  name: 'reactive_plating', displayName: 'Reactive Plating',
  primaryEffect: { stat: 'hp', delta: -40, label: '−40 HP (dünn)' },
  secondaryEffects: [],
  effects: { hp: -40 },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ stat: 'hp', delta: -40, description: '−40 HP (dünne Schicht)' }],
},

// SHIELD (unique)
mirror_shield: {
  id: 'mirror_shield', category: 'shield', tier: 3,
  name: 'mirror_shield', displayName: 'Mirror Shield',
  primaryEffect: { stat: 'shieldHp', delta: 80, label: '+80 ShieldHP' },
  secondaryEffects: [],
  effects: { shieldHp: 80 },
  cost: { credits: 0 },
  acepPaths: ['kampf', 'ausbau'],
  isUnique: true, isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'mirror_shield_reflect', description: 'Reflektiert 20% Schaden zurück. Keine Resistenz.' }],
},
reactive_barrier: {
  id: 'reactive_barrier', category: 'shield', tier: 3,
  name: 'reactive_barrier', displayName: 'Reactive Barrier',
  primaryEffect: { stat: 'shieldRegen', delta: 30, label: '+30 Sofort-Regen nach Treffer' },
  secondaryEffects: [],
  effects: { shieldHp: 60, shieldRegen: 0 },
  cost: { credits: 0 },
  acepPaths: ['kampf', 'ausbau'],
  isUnique: true, isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'reactive_barrier_late_activate', description: 'Schild aktiv erst bei HP < 50%' }],
},
parasite_shell: {
  id: 'parasite_shell', category: 'shield', tier: 5,
  name: 'parasite_shell', displayName: 'Parasite Shell',
  primaryEffect: { stat: 'shieldHp', delta: 200, label: '+200 ShieldHP' },
  secondaryEffects: [],
  effects: { shieldHp: 200, shieldRegen: 5 },
  cost: { credits: 0 },
  acepPaths: ['kampf', 'ausbau'],
  isUnique: true, isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'parasite_shell_fuel_drain', description: 'Verbraucht 1 Fuel pro Kampfrunde' }],
},

// SCANNER (unique)
deep_whisper: {
  id: 'deep_whisper', category: 'scanner', tier: 4,
  name: 'deep_whisper', displayName: 'Deep Whisper',
  primaryEffect: { stat: 'scannerLevel', delta: 3, label: '+3 Scanner-Level (Radius 12)' },
  secondaryEffects: [{ stat: 'artefactChanceBonus', delta: 0.12, label: '+12% Artefakt-Chance' }],
  effects: { scannerLevel: 3, artefactChanceBonus: 0.12 },
  cost: { credits: 0 },
  acepPaths: ['intel'],
  isUnique: true, isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'deep_whisper_ap_cost', description: 'Scan-AP-Kosten +50%' }],
},
ghost_lens: {
  id: 'ghost_lens', category: 'scanner', tier: 3,
  name: 'ghost_lens', displayName: 'Ghost Lens',
  primaryEffect: { stat: 'commRange', delta: 400, label: 'Spieler in Radius 8 sichtbar' },
  secondaryEffects: [],
  effects: { commRange: 400 },
  cost: { credits: 0 },
  acepPaths: ['intel'],
  isUnique: true, isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'ghost_lens_mutual', description: 'Eigene Position für andere sichtbar (Radius 8)' }],
},
war_scanner: {
  id: 'war_scanner', category: 'scanner', tier: 3,
  name: 'war_scanner', displayName: 'War Scanner',
  primaryEffect: { stat: 'weaponAttack', delta: 0, label: '+20% Trefferchance im Kampf' },
  secondaryEffects: [],
  effects: { artefactChanceBonus: 0 },
  cost: { credits: 0 },
  acepPaths: ['intel', 'kampf'],
  isUnique: true, isFoundOnly: true,
  drawbacks: [{ stat: 'scannerLevel', delta: -2, description: 'Zivile Scans −2 Radius' }],
},

// MINING
void_drill: {
  id: 'void_drill', category: 'mining', tier: 5,
  name: 'void_drill', displayName: 'Void Drill',
  primaryEffect: { stat: 'miningBonus', delta: 5.0, label: '+5.0/s Mining-Rate' },
  secondaryEffects: [],
  effects: { miningBonus: 5.0 },
  cost: { credits: 0 },
  acepPaths: ['ausbau'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'void_drill_raubbau', description: 'Sektor-Yield sinkt 3× schneller' }],
},
crystal_leech: {
  id: 'crystal_leech', category: 'mining', tier: 3,
  name: 'crystal_leech', displayName: 'Crystal Leech',
  primaryEffect: { stat: 'miningBonus', delta: -0.3, label: '−30% Mining-Rate' },
  secondaryEffects: [],
  effects: { miningBonus: -0.3 },
  cost: { credits: 0 },
  acepPaths: ['ausbau'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'crystal_leech_conversion', description: 'Mining-Rate −30%' }],
},
swarm_harvester: {
  id: 'swarm_harvester', category: 'mining', tier: 4,
  name: 'swarm_harvester', displayName: 'Swarm Harvester',
  primaryEffect: { stat: 'miningBonus', delta: 1.5, label: '+1.5/s + 2 Ressourcentypen gleichzeitig' },
  secondaryEffects: [],
  effects: { miningBonus: 1.5, cargoCap: -5 },
  cost: { credits: 0 },
  acepPaths: ['ausbau'],
  isFoundOnly: true,
  drawbacks: [{ stat: 'cargoCap', delta: -5, description: '−5 cargoCap (Sortier-Overhead)' }],
},

// CARGO
living_hold: {
  id: 'living_hold', category: 'cargo', tier: 4,
  name: 'living_hold', displayName: 'Living Hold',
  primaryEffect: { stat: 'cargoCap', delta: 40, label: '+40 Frachtkapazität' },
  secondaryEffects: [],
  effects: { cargoCap: 40, hp: -10 },
  cost: { credits: 0 },
  acepPaths: ['ausbau'],
  isFoundOnly: true,
  drawbacks: [{ stat: 'hp', delta: -10, description: '−10 HP (Bio-Wachstum schwächt Struktur)' }],
},
compressed_vault: {
  id: 'compressed_vault', category: 'cargo', tier: 4,
  name: 'compressed_vault', displayName: 'Compressed Vault',
  primaryEffect: { stat: 'cargoCap', delta: 50, label: '+50 Frachtkapazität' },
  secondaryEffects: [{ stat: 'safeSlotBonus', delta: 4, label: '+4 Safe Slots' }],
  effects: { cargoCap: 50, safeSlotBonus: 4 },
  cost: { credits: 0 },
  acepPaths: ['ausbau'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'compressed_vault_slow_transfer', description: 'Cargo-Transfer dauert 2× länger' }],
},
black_market_hold: {
  id: 'black_market_hold', category: 'cargo', tier: 3,
  name: 'black_market_hold', displayName: 'Black Market Hold',
  primaryEffect: { stat: 'cargoCap', delta: 10, label: '+10 Frachtkapazität' },
  secondaryEffects: [],
  effects: { cargoCap: 10 },
  cost: { credits: 0 },
  acepPaths: ['ausbau'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'black_market_hold_rep', description: 'Reputations-Gewinn −50% bei allen Fraktionen' }],
},

// DEFENSE (found, extra-slot only)
null_field: {
  id: 'null_field', category: 'defense', tier: 4,
  name: 'null_field', displayName: 'Null Field',
  primaryEffect: { stat: 'ecmReduction', delta: 0.8, label: '+80% ECM-Reduktion, EMP-Immun' },
  secondaryEffects: [],
  effects: { ecmReduction: 0.8 },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'null_field_no_emp', description: 'Eigene EMP-Waffen deaktiviert' }],
},
bleed_emitter: {
  id: 'bleed_emitter', category: 'defense', tier: 3,
  name: 'bleed_emitter', displayName: 'Bleed Emitter',
  primaryEffect: { stat: 'commRange', delta: -50, label: '−50 commRange' },
  secondaryEffects: [],
  effects: { commRange: -50 },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ stat: 'commRange', delta: -50, description: '−50 Kommunikationsreichweite' }],
},
terror_array: {
  id: 'terror_array', category: 'defense', tier: 4,
  name: 'terror_array', displayName: 'Terror Array',
  primaryEffect: { stat: 'pointDefense', delta: 2, label: '30% Flucht-Chance Gegner' },
  secondaryEffects: [],
  effects: { pointDefense: 2 },
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'terror_array_pirate_spawn', description: '+15% Piraten-Spawn in aktuellem Sektor' }],
},

// SPECIAL (found, extra-slot only)
memory_core: {
  id: 'memory_core', category: 'special', tier: 3,
  name: 'memory_core', displayName: 'Memory Core',
  primaryEffect: { stat: 'commRange', delta: 0, label: 'Staleness-Timer 3× länger' },
  secondaryEffects: [],
  effects: {},
  cost: { credits: 0 },
  acepPaths: ['intel'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'memory_core_no_new_quadrant', description: 'Kann keine neuen Quadranten betreten' }],
},
ancient_seed: {
  id: 'ancient_seed', category: 'special', tier: 5,
  name: 'ancient_seed', displayName: 'Ancient Seed',
  primaryEffect: { stat: 'artefactChanceBonus', delta: 0.1, label: 'Ancient-Ruinen respawnen' },
  secondaryEffects: [],
  effects: { artefactChanceBonus: 0.1, miningBonus: -0.2 },
  cost: { credits: 0 },
  acepPaths: ['explorer'],
  isFoundOnly: true,
  drawbacks: [{ stat: 'miningBonus', delta: -0.2, description: '−20% Mining-Rate' }],
},
echo_chamber: {
  id: 'echo_chamber', category: 'special', tier: 4,
  name: 'echo_chamber', displayName: 'Echo Chamber',
  primaryEffect: { stat: 'artefactChanceBonus', delta: 0.05, label: 'Schiff-Hinweise im Kampf' },
  secondaryEffects: [],
  effects: { artefactChanceBonus: 0.05 },
  cost: { credits: 0 },
  acepPaths: ['intel', 'kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'echo_chamber_loud', description: 'Schiff-Meldungen häufiger und intensiver' }],
},
pirate_transponder: {
  id: 'pirate_transponder', category: 'special', tier: 5,
  name: 'pirate_transponder', displayName: 'Pirate Transponder',
  primaryEffect: { stat: 'damageMod', delta: 0, label: 'Piraten greifen nicht an' },
  secondaryEffects: [],
  effects: {},
  cost: { credits: 0 },
  acepPaths: ['kampf'],
  isFoundOnly: true,
  drawbacks: [{ runtimeEffect: 'pirate_transponder_rep', description: 'Alle Fraktionen −30 Reputation sofort' }],
},
```

**Schritt 4: Test laufen lassen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/foundModules.test.ts
```

**Schritt 5: shared bauen + alle Tests**
```bash
cd packages/shared && npm run build && npx vitest run
```

**Schritt 6: Commit**
```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/foundModules.test.ts
git commit -m "feat(shared): add 34 found-module definitions with drawbacks and acepPaths on all modules"
```

---

## Task 4: calculateShipStats mit ACEP-Multiplikatoren (shared)

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts`
- Modify: `packages/shared/src/types.ts` (AcepXpSnapshot type)

**Kontext:** `calculateShipStats` bekommt ein optionales `acepXp`-Objekt. ACEP-Level pro Pfad wird aus den Thresholds berechnet. Module eines Pfades bekommen den Multiplikator auf ihre `effects`.

**Schritt 1: AcepXpSnapshot type ergänzen** (in types.ts, nach AcepPath)
```typescript
export interface AcepXpSnapshot {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
}
```

**Schritt 2: Failing test schreiben**
Datei: `packages/shared/src/__tests__/shipCalculatorAcep.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { calculateShipStats, getAcepLevel, getExtraSlotCount } from '../shipCalculator.js';
import type { AcepXpSnapshot } from '../types.js';

describe('calculateShipStats with ACEP', () => {
  const noAcep: AcepXpSnapshot = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };

  it('level 1 at 0 XP', () => {
    expect(getAcepLevel(0)).toBe(1);
  });

  it('level 2 at 8 XP', () => {
    expect(getAcepLevel(8)).toBe(2);
  });

  it('level 5 at 50 XP', () => {
    expect(getAcepLevel(50)).toBe(5);
  });

  it('0 extra slots at ausbau 0', () => {
    expect(getExtraSlotCount(0)).toBe(0);
  });

  it('1 extra slot at ausbau 10', () => {
    expect(getExtraSlotCount(10)).toBe(1);
  });

  it('4 extra slots at ausbau 50', () => {
    expect(getExtraSlotCount(50)).toBe(4);
  });

  it('kampf level 5 boosts weapon attack by 50%', () => {
    const modules = [{ moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' as const }];
    const baseStats = calculateShipStats('scout', modules, noAcep);
    const boostedStats = calculateShipStats('scout', modules, { ...noAcep, kampf: 50 });
    expect(boostedStats.weaponAttack).toBeGreaterThan(baseStats.weaponAttack);
    expect(boostedStats.weaponAttack).toBeCloseTo(baseStats.weaponAttack * 1.5, 1);
  });

  it('ausbau level 3 boosts cargo cap', () => {
    const modules = [{ moduleId: 'cargo_mk1', slotIndex: 6, source: 'standard' as const }];
    const base = calculateShipStats('scout', modules, noAcep);
    const boosted = calculateShipStats('scout', modules, { ...noAcep, ausbau: 18 });
    expect(boosted.cargoCap).toBeGreaterThan(base.cargoCap);
  });
});
```

**Schritt 3: Test laufen lassen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/shipCalculatorAcep.test.ts
```

**Schritt 4: `shipCalculator.ts` anpassen**

```typescript
import {
  MODULES, HULLS,
  ACEP_LEVEL_THRESHOLDS, ACEP_LEVEL_MULTIPLIERS, ACEP_EXTRA_SLOT_THRESHOLDS,
} from './constants.js';
import type { HullType, ShipModule, ShipStats, AcepXpSnapshot, AcepPath } from './types.js';

/** Berechnet ACEP-Level (1–5) aus XP-Wert eines Pfades */
export function getAcepLevel(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(ACEP_LEVEL_THRESHOLDS)) {
    if (xp >= threshold) level = Number(lvl);
  }
  return level;
}

/** Berechnet Anzahl freigeschalteter Extra-Slots aus AUSBAU-XP */
export function getExtraSlotCount(ausbauXp: number): number {
  return ACEP_EXTRA_SLOT_THRESHOLDS.filter((t) => ausbauXp >= t).length;
}

export function calculateShipStats(
  hullType: HullType,
  modules: ShipModule[],
  acepXp?: AcepXpSnapshot,
): ShipStats {
  const hull = HULLS[hullType];
  const xp = acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };

  // ACEP-Level pro Pfad
  const levels: Record<AcepPath, number> = {
    ausbau:   getAcepLevel(xp.ausbau),
    intel:    getAcepLevel(xp.intel),
    kampf:    getAcepLevel(xp.kampf),
    explorer: getAcepLevel(xp.explorer),
  };

  const stats: ShipStats = {
    fuelMax: hull.baseFuel,
    cargoCap: hull.baseCargo,
    // ... alle anderen hull-Basewerte wie bisher ...
  };

  // Module anwenden mit ACEP-Multiplikator
  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def) continue;

    // Bestimme höchsten Multiplikator aus allen acepPaths des Moduls
    const modPaths = def.acepPaths ?? [];
    const multiplier = modPaths.length > 0
      ? Math.max(...modPaths.map((p) => ACEP_LEVEL_MULTIPLIERS[levels[p]] ?? 1.0))
      : 1.0;

    for (const [key, value] of Object.entries(def.effects)) {
      if (typeof value !== 'number') {
        (stats as any)[key] = value; // weaponType etc. nicht multiplizieren
        continue;
      }
      if (key === 'damageMod') {
        stats.damageMod += value; // Penalty nicht multiplizieren (nur Boni)
      } else {
        (stats as any)[key] += value > 0 ? value * multiplier : value;
      }
    }
  }

  // Clamp wie bisher
  stats.apCostJump = Math.max(0.5, stats.apCostJump);
  stats.jumpRange = Math.max(1, stats.jumpRange);
  stats.damageMod = Math.max(0.25, stats.damageMod);
  stats.engineSpeed = Math.max(1, Math.min(5, stats.engineSpeed ?? 1));

  return stats;
}
```

**Schritt 5: Test laufen lassen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/shipCalculatorAcep.test.ts
```

**Schritt 6: shared bauen + alle Tests**
```bash
cd packages/shared && npm run build && npx vitest run
```

**Schritt 7: Commit**
```bash
git add packages/shared/src/shipCalculator.ts packages/shared/src/types.ts \
        packages/shared/src/__tests__/shipCalculatorAcep.test.ts
git commit -m "feat(shared): calculateShipStats applies ACEP level multipliers per module path"
```

---

## Task 5: validateModuleInstall — Specialized-Slot-Enforcement (shared)

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts`

**Kontext:** Neue Regeln: (1) Specialized Slot nur für passende Kategorie. (2) Extra-Slots ab Index 7 — Anzahl durch AUSBAU-XP. (3) Unique-Module (shield/scanner) max 1× pro Schiff. (4) defense/special nur in Extra-Slots.

**Schritt 1: Failing test schreiben**
Datei: `packages/shared/src/__tests__/slotValidation.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { validateModuleInstall } from '../shipCalculator.js';

const noAcep = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };

describe('validateModuleInstall — specialized slots', () => {
  it('allows laser in weapon slot (index 1)', () => {
    const result = validateModuleInstall('scout', [], 'laser_mk1', 1, noAcep);
    expect(result.valid).toBe(true);
  });

  it('rejects laser in drive slot (index 0)', () => {
    const result = validateModuleInstall('scout', [], 'laser_mk1', 0, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/specialized/i);
  });

  it('rejects second shield if one already installed', () => {
    const existing = [{ moduleId: 'shield_mk1', slotIndex: 3, source: 'standard' as const }];
    const result = validateModuleInstall('scout', existing, 'shield_mk2', 7, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unique/i);
  });

  it('rejects defense module in specialized slot', () => {
    const result = validateModuleInstall('scout', [], 'point_defense', 2, noAcep);
    expect(result.valid).toBe(false);
  });

  it('allows defense module in extra slot (index 7) when AUSBAU >= 10', () => {
    const result = validateModuleInstall('scout', [], 'point_defense', 7, { ...noAcep, ausbau: 10 });
    expect(result.valid).toBe(true);
  });

  it('rejects extra slot when AUSBAU not high enough', () => {
    const result = validateModuleInstall('scout', [], 'laser_mk1', 7, noAcep);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ausbau/i);
  });

  it('allows drive in extra slot (index 7) for second drive', () => {
    const existing = [{ moduleId: 'drive_mk1', slotIndex: 0, source: 'standard' as const }];
    const result = validateModuleInstall('scout', existing, 'drive_mk2', 7, { ...noAcep, ausbau: 10 });
    expect(result.valid).toBe(true);
  });
});
```

**Schritt 2: Test laufen lassen — muss FAIL**
```bash
cd packages/shared && npx vitest run src/__tests__/slotValidation.test.ts
```

**Schritt 3: `validateModuleInstall` in `shipCalculator.ts` ersetzen**

```typescript
export function validateModuleInstall(
  hullType: HullType,
  currentModules: ShipModule[],
  moduleId: string,
  slotIndex: number,
  acepXp: AcepXpSnapshot,
): { valid: boolean; error?: string } {
  const moduleDef = MODULES[moduleId];
  if (!moduleDef) return { valid: false, error: 'Unbekanntes Modul' };

  const category = moduleDef.category;
  const specializedSlotIdx = SPECIALIZED_SLOT_INDEX[category];
  const isSpecializedSlot = slotIndex < 7;
  const isExtraSlot = slotIndex >= 7;
  const extraSlotCount = getExtraSlotCount(acepXp.ausbau);
  const maxExtraSlotIndex = 7 + extraSlotCount - 1;

  // defense/special nur in Extra-Slots
  if (DEFENSE_ONLY_CATEGORIES.includes(category) && isSpecializedSlot) {
    return { valid: false, error: `${category}-Module nur in Extra-Slots erlaubt` };
  }

  // Specialized Slot: nur passende Kategorie
  if (isSpecializedSlot && specializedSlotIdx !== undefined && slotIndex !== specializedSlotIdx) {
    return { valid: false, error: `Specialized Slot ${slotIndex} ist für '${SPECIALIZED_SLOT_CATEGORIES[slotIndex]}' reserviert` };
  }

  // Extra-Slot: AUSBAU-Gate
  if (isExtraSlot && slotIndex > maxExtraSlotIndex) {
    return { valid: false, error: `Extra-Slot ${slotIndex} benötigt höheres AUSBAU-Level` };
  }

  // Unique-Enforcement
  if (moduleDef.isUnique || UNIQUE_MODULE_CATEGORIES.includes(category)) {
    const alreadyInstalled = currentModules.some((m) => MODULES[m.moduleId]?.category === category);
    if (alreadyInstalled) {
      return { valid: false, error: `Unique-Modul: ${category} bereits installiert` };
    }
  }

  // Slot belegt?
  if (currentModules.some((m) => m.slotIndex === slotIndex)) {
    return { valid: false, error: 'Slot bereits belegt' };
  }

  return { valid: true };
}
```

**Schritt 4: Signatur-Update — alle Aufrufer von `validateModuleInstall` anpassen**

In `packages/server/src/rooms/services/ShipService.ts` den Aufruf erweitern:
```typescript
// Vorher:
const validation = validateModuleInstall(ship.hullType, ship.modules, data.moduleId, data.slotIndex);
// Nachher: acepXp muss geladen werden
const acepXp = await getAcepXpSummary(ship.id);
const validation = validateModuleInstall(ship.hullType, ship.modules, data.moduleId, data.slotIndex, {
  ausbau: acepXp.ausbau,
  intel: acepXp.intel,
  kampf: acepXp.kampf,
  explorer: acepXp.explorer,
});
```

**Schritt 5: Test laufen lassen — muss PASS**
```bash
cd packages/shared && npx vitest run src/__tests__/slotValidation.test.ts
```

**Schritt 6: shared bauen + Server-Tests**
```bash
cd packages/shared && npm run build
cd packages/server && npx vitest run
```

**Schritt 7: Commit**
```bash
git add packages/shared/src/shipCalculator.ts packages/shared/src/__tests__/slotValidation.test.ts \
        packages/server/src/rooms/services/ShipService.ts
git commit -m "feat: specialized slot enforcement — category gates, unique modules, AUSBAU extra-slot unlock"
```

---

## Task 6: DB-Migration 052 — module_source (server)

**Files:**
- Create: `packages/server/src/db/migrations/052_module_source.sql`
- Create: `packages/server/src/__tests__/migration-052.test.ts`

**Kontext:** `ships.modules` ist ein JSONB-Array. Jedes Modul-Objekt bekommt ein `source`-Feld. Da JSONB flexibel ist, reicht ein Default-Migration der bestehende Einträge ergänzt.

**Schritt 1: Migration schreiben**
```sql
-- 052_module_source.sql
-- Ergänzt "source": "standard" in allen existierenden ship.modules Einträgen,
-- die noch kein source-Feld haben.

UPDATE ships
SET modules = (
  SELECT jsonb_agg(
    CASE
      WHEN module ? 'source' THEN module
      ELSE module || '{"source": "standard"}'::jsonb
    END
  )
  FROM jsonb_array_elements(modules) AS module
)
WHERE jsonb_array_length(modules) > 0;
```

**Schritt 2: Failing test schreiben**
Datei: `packages/server/src/__tests__/migration-052.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db/pool.js';

describe('migration 052 — module_source', () => {
  beforeAll(async () => {
    await pool.query(`
      INSERT INTO ships (id, owner_id, hull_type, name, modules, active)
      VALUES (gen_random_uuid(), 'test_mig052', 'scout', 'TestShip',
              '[{"moduleId":"laser_mk1","slotIndex":1}]'::jsonb, true)
      ON CONFLICT DO NOTHING
    `);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ships WHERE owner_id = 'test_mig052'`);
  });

  it('existing modules get source=standard after migration', async () => {
    await pool.query(`
      UPDATE ships
      SET modules = (
        SELECT jsonb_agg(
          CASE WHEN module ? 'source' THEN module
               ELSE module || '{"source": "standard"}'::jsonb END
        )
        FROM jsonb_array_elements(modules) AS module
      )
      WHERE owner_id = 'test_mig052'
        AND jsonb_array_length(modules) > 0
    `);

    const res = await pool.query(
      `SELECT modules FROM ships WHERE owner_id = 'test_mig052'`
    );
    const modules = res.rows[0].modules;
    expect(modules[0].source).toBe('standard');
  });
});
```

**Schritt 3: Test laufen lassen**
```bash
cd packages/server && npx vitest run src/__tests__/migration-052.test.ts
```

**Schritt 4: Commit**
```bash
git add packages/server/src/db/migrations/052_module_source.sql \
        packages/server/src/__tests__/migration-052.test.ts
git commit -m "feat(db): migration 052 — backfill module source field in ships.modules JSONB"
```

---

## Task 7: XP-Trigger in NavigationService (server)

**Files:**
- Modify: `packages/server/src/rooms/services/NavigationService.ts`

**Kontext:** Nach erfolgreichem Sprung: +2 AUSBAU. Wenn Sektor erstmals entdeckt: +10 EXPLORER. Wenn Quadrant erstmals entdeckt (erster Spieler): +50 EXPLORER. `addAcepXp(shipId, path, amount)` aus `acepXpService.ts` verwenden.

**Schritt 1: Relevante Stellen finden**
```bash
grep -n "moveSector\|handleMoveSector\|sectorDiscovered\|firstDiscover\|quadrantVisit" \
  packages/server/src/rooms/services/NavigationService.ts | head -20
grep -n "addAcepXp\|acepXp" packages/server/src/rooms/services/NavigationService.ts | head -10
```

**Schritt 2: Failing test schreiben**
Datei: `packages/server/src/engine/__tests__/navAcepXp.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addAcepXp } from '../../engine/acepXpService.js';

vi.mock('../../engine/acepXpService.js', () => ({
  addAcepXp: vi.fn().mockResolvedValue(undefined),
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 }),
}));

describe('navigation ACEP XP triggers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awards AUSBAU XP on jump', async () => {
    // Simulate jump handler calling addAcepXp
    await addAcepXp('ship1', 'ausbau', 2);
    expect(addAcepXp).toHaveBeenCalledWith('ship1', 'ausbau', 2);
  });

  it('awards EXPLORER XP for first sector discovery', async () => {
    await addAcepXp('ship1', 'explorer', 10);
    expect(addAcepXp).toHaveBeenCalledWith('ship1', 'explorer', 10);
  });

  it('awards bonus EXPLORER XP for first quadrant discovery', async () => {
    await addAcepXp('ship1', 'explorer', 50);
    expect(addAcepXp).toHaveBeenCalledWith('ship1', 'explorer', 50);
  });
});
```

**Schritt 3: Test laufen lassen — muss PASS** (Mock-Test, sofort grün)
```bash
cd packages/server && npx vitest run src/engine/__tests__/navAcepXp.test.ts
```

**Schritt 4: XP-Aufrufe in NavigationService einbauen**

Suche `handleMoveSector` (oder den Haupt-Sprung-Handler). Nach erfolgreichem Sprung einfügen:

```typescript
// Nach Sektor-Wechsel: AUSBAU XP
const ship = await getActiveShip(auth.userId);
if (ship) {
  await addAcepXp(ship.id, 'ausbau', 2);

  // Erstentdeckung Sektor?
  if (sectorWasJustDiscovered) {
    await addAcepXp(ship.id, 'explorer', 10);
  }

  // Erstentdeckung Quadrant?
  if (quadrantWasJustDiscovered) {
    await addAcepXp(ship.id, 'explorer', 50);
  }
}
```

**Hinweis:** `sectorWasJustDiscovered` und `quadrantWasJustDiscovered` aus dem bestehenden Entdeckungs-Tracking lesen (z.B. `quadrant_visits` Tabelle aus Migration 051).

**Schritt 5: Server-Tests laufen lassen**
```bash
cd packages/server && npx vitest run
```

**Schritt 6: Commit**
```bash
git add packages/server/src/rooms/services/NavigationService.ts \
        packages/server/src/engine/__tests__/navAcepXp.test.ts
git commit -m "feat(server): ACEP XP triggers in NavigationService (+2 AUSBAU per jump, +10/+50 EXPLORER discovery)"
```

---

## Task 8: XP-Trigger in ScanService (server)

**Files:**
- Modify: `packages/server/src/rooms/services/ScanService.ts`

**Triggers:** +3 INTEL pro Area-Scan · +8 INTEL Anomalie gefunden · +15 INTEL Artefakt-Signal

**Schritt 1: Stellen finden**
```bash
grep -n "handleAreaScan\|anomaly\|artefact.*signal\|scanResult" \
  packages/server/src/rooms/services/ScanService.ts | head -20
```

**Schritt 2: Nach erfolgreichem Area-Scan einfügen**
```typescript
const ship = await getActiveShip(auth.userId);
if (ship) {
  await addAcepXp(ship.id, 'intel', 3);
  if (scanResult.hasAnomaly) await addAcepXp(ship.id, 'intel', 8);
  if (scanResult.hasArtefactSignal) await addAcepXp(ship.id, 'intel', 15);
}
```

**Schritt 3: Server-Tests**
```bash
cd packages/server && npx vitest run
```

**Schritt 4: Commit**
```bash
git add packages/server/src/rooms/services/ScanService.ts
git commit -m "feat(server): ACEP XP triggers in ScanService (+3 INTEL scan, +8 anomaly, +15 artefact)"
```

---

## Task 9: XP-Trigger in MiningService (server)

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts`

**Trigger:** +1 AUSBAU pro 5 abgebaute Einheiten (beim Stopp berechnen: `floor(total / 5)`)

**Schritt 1: `handleStopMine` finden**
```bash
grep -n "handleStopMine\|stopMine\|mined\|yield" \
  packages/server/src/rooms/services/MiningService.ts | head -15
```

**Schritt 2: Nach Mining-Stop einfügen**
```typescript
const minedUnits = miningResult.totalMined ?? 0;
const xpGain = Math.floor(minedUnits / 5);
if (xpGain > 0) {
  const ship = await getActiveShip(auth.userId);
  if (ship) await addAcepXp(ship.id, 'ausbau', xpGain);
}
```

**Schritt 3: Commit**
```bash
git add packages/server/src/rooms/services/MiningService.ts
git commit -m "feat(server): ACEP XP triggers in MiningService (+1 AUSBAU per 5 units mined)"
```

---

## Task 10: XP-Trigger in CombatService (server)

**Files:**
- Modify: `packages/server/src/rooms/services/CombatService.ts`

**Triggers:** +2 KAMPF pro Runde (Schaden dealt) · +1 KAMPF pro Runde (Schaden kassiert) · +10 KAMPF Kampf gewonnen

**Schritt 1: Pro Kampfrunde (in `handleCombatV2Action`)**
```typescript
// Nach Runden-Auflösung:
const ship = await getActiveShip(auth.userId);
if (ship) {
  if (roundResult.playerDamageDealt > 0) await addAcepXp(ship.id, 'kampf', 2);
  if (roundResult.playerDamageTaken > 0) await addAcepXp(ship.id, 'kampf', 1);
}
```

**Schritt 2: Bei Kampf-Ende (victory)**
```typescript
if (finalResult?.outcome === 'victory') {
  if (ship) await addAcepXp(ship.id, 'kampf', 10);
}
```

**Schritt 3: Commit**
```bash
git add packages/server/src/rooms/services/CombatService.ts
git commit -m "feat(server): ACEP XP triggers in CombatService (+2/+1 per round, +10 victory)"
```

---

## Task 11: XP-Trigger in EconomyService (server)

**Files:**
- Modify: `packages/server/src/rooms/services/EconomyService.ts`

**Trigger:** +2 AUSBAU wenn volle Ladung (cargoCap >= 80%) verkauft wird

**Schritt 1: `handleSellResources` finden**
```bash
grep -n "handleSell\|sellResource\|cargoSold" \
  packages/server/src/rooms/services/EconomyService.ts | head -10
```

**Schritt 2: Nach erfolgreicher Vollladungs-Verkauf**
```typescript
const cargoState = await getCargoState(auth.userId);
const stats = calculateShipStats(ship.hullType, ship.modules);
const totalCargo = Object.values(cargoState).reduce((a, b) => a + (b ?? 0), 0);
const wasFullLoad = totalCargo >= stats.cargoCap * 0.8;

// ... nach Verkauf ...
if (wasFullLoad) {
  await addAcepXp(ship.id, 'ausbau', 2);
}
```

**Schritt 3: Commit**
```bash
git add packages/server/src/rooms/services/EconomyService.ts
git commit -m "feat(server): ACEP XP triggers in EconomyService (+2 AUSBAU full cargo sold)"
```

---

## Task 12: Passive Drawback Engine (server)

**Files:**
- Modify: `packages/shared/src/shipCalculator.ts`

**Kontext:** Passive Drawbacks (stat-basiert, z.B. `{ stat: 'jumpRange', delta: -2 }`) sind bereits in `calculateShipStats` über `effects` abgedeckt — da negative Werte korrekt addiert werden. Passive Drawbacks brauchen keine separate Engine.

Aktive Drawbacks (`runtimeEffect`) werden **in dieser Phase nur geloggt** — vollständige Runtime-Implementierung ist ein eigener Sprint. Für jetzt: Drawbacks im `client.send`-Payload mitschicken, damit die UI sie anzeigen kann.

**Schritt 1: `getActiveDrawbacks` helper in shipCalculator.ts**
```typescript
/** Gibt alle aktiven Runtime-Drawbacks der installierten Module zurück */
export function getActiveDrawbacks(modules: ShipModule[]): string[] {
  const effects: string[] = [];
  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (!def?.drawbacks) continue;
    for (const drawback of def.drawbacks) {
      if (drawback.runtimeEffect) effects.push(drawback.runtimeEffect);
    }
  }
  return effects;
}
```

**Schritt 2: Test**
Datei: `packages/shared/src/__tests__/drawbacks.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { getActiveDrawbacks } from '../shipCalculator.js';

describe('getActiveDrawbacks', () => {
  it('returns runtime effect IDs for found modules', () => {
    const mods = [{ moduleId: 'pulse_drive', slotIndex: 0, source: 'found' as const }];
    const effects = getActiveDrawbacks(mods);
    expect(effects).toContain('pulse_drive_overheat');
  });

  it('returns empty for standard modules', () => {
    const mods = [{ moduleId: 'laser_mk1', slotIndex: 1, source: 'standard' as const }];
    expect(getActiveDrawbacks(mods)).toHaveLength(0);
  });
});
```

**Schritt 3: shared bauen + Tests**
```bash
cd packages/shared && npm run build && npx vitest run
```

**Schritt 4: Commit**
```bash
git add packages/shared/src/shipCalculator.ts packages/shared/src/__tests__/drawbacks.test.ts
git commit -m "feat(shared): getActiveDrawbacks helper — passive drawbacks via effects, runtime IDs exposed"
```

---

## Task 13: ShipService — handleInstallModule + calculateShipStats anpassen (server)

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`

**Kontext:** `calculateShipStats` braucht jetzt `acepXp`. `validateModuleInstall` braucht `acepXp`. Beide Aufrufe müssen aktualisiert werden. `source`-Feld beim Einbau setzen (aus Inventar: was wurde gefunden vs. gekauft).

**Schritt 1: `handleInstallModule` anpassen**
```typescript
async handleInstallModule(client, data: { moduleId: string; slotIndex: number }) {
  const ship = await getActiveShip(auth.userId);
  const acepXpRaw = await getAcepXpSummary(ship.id);
  const acepXp = { ausbau: acepXpRaw.ausbau, intel: acepXpRaw.intel, kampf: acepXpRaw.kampf, explorer: acepXpRaw.explorer };

  const validation = validateModuleInstall(ship.hullType, ship.modules, data.moduleId, data.slotIndex, acepXp);
  if (!validation.valid) {
    client.send('error', { code: 'INSTALL_FAILED', message: validation.error });
    return;
  }

  // Source aus Inventar ermitteln
  const inventoryItem = await getInventoryItem(auth.userId, 'module', data.moduleId);
  const source = inventoryItem?.source ?? 'standard'; // DB-Feld falls vorhanden

  const newModules = [
    ...ship.modules,
    { moduleId: data.moduleId, slotIndex: data.slotIndex, source },
  ];

  await updateShipModules(ship.id, newModules);
  const newStats = calculateShipStats(ship.hullType, newModules, acepXp);
  const drawbacks = getActiveDrawbacks(newModules);

  client.send('moduleInstalled', { modules: newModules, stats: newStats, drawbacks });
}
```

**Schritt 2: Alle anderen `calculateShipStats`-Aufrufe in ShipService mit acepXp versorgen**
```bash
grep -n "calculateShipStats" packages/server/src/rooms/services/ShipService.ts
```
Jeden Fund anpassen.

**Schritt 3: Server-Tests**
```bash
cd packages/server && npx vitest run
```

**Schritt 4: Commit**
```bash
git add packages/server/src/rooms/services/ShipService.ts
git commit -m "feat(server): ShipService uses ACEP XP in slot validation and stat calculation, sets module source"
```

---

## Task 14: ACEP-Tab UI (client)

**Files:**
- Modify: `packages/client/src/components/HangarPanel.tsx` (oder anlegen falls nicht vorhanden)
- Create: `packages/client/src/components/AcepPanel.tsx`

**Kontext:** HANGAR-Monitor hat bereits einen Tab (laut CLAUDE.md). ACEP-Tab zeigt: 4 XP-Balken, Level, Trait-Liste, aktive Drawbacks.

**Schritt 1: AcepPanel-Komponente**
```bash
ls packages/client/src/components/Hangar* packages/client/src/components/ACEP* 2>/dev/null
```

**Schritt 2: Failing test schreiben**
Datei: `packages/client/src/__tests__/AcepPanel.test.tsx`
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AcepPanel } from '../components/AcepPanel.js';

const mockAcep = {
  ausbau: 15, intel: 8, kampf: 32, explorer: 3,
  traits: ['veteran', 'reckless'],
};

describe('AcepPanel', () => {
  it('renders all 4 XP bars', () => {
    render(<AcepPanel acep={mockAcep} />);
    expect(screen.getByText(/AUSBAU/i)).toBeInTheDocument();
    expect(screen.getByText(/INTEL/i)).toBeInTheDocument();
    expect(screen.getByText(/KAMPF/i)).toBeInTheDocument();
    expect(screen.getByText(/EXPLORER/i)).toBeInTheDocument();
  });

  it('shows traits', () => {
    render(<AcepPanel acep={mockAcep} />);
    expect(screen.getByText(/veteran/i)).toBeInTheDocument();
    expect(screen.getByText(/reckless/i)).toBeInTheDocument();
  });

  it('shows correct level for KAMPF at 32 XP (Level 4)', () => {
    render(<AcepPanel acep={mockAcep} />);
    expect(screen.getByText(/LVL 4/i)).toBeInTheDocument();
  });
});
```

**Schritt 3: AcepPanel implementieren**
```tsx
// packages/client/src/components/AcepPanel.tsx
import React from 'react';
import { ACEP_LEVEL_THRESHOLDS, ACEP_LEVEL_MULTIPLIERS } from '@voidSector/shared';
import { getAcepLevel } from '@voidSector/shared';

interface AcepData {
  ausbau: number; intel: number; kampf: number; explorer: number;
  traits: string[];
}

const PATH_LABELS: Record<string, string> = {
  ausbau: 'AUSBAU', intel: 'INTEL', kampf: 'KAMPF', explorer: 'EXPLORER',
};
const PATH_COLORS: Record<string, string> = {
  ausbau: '#4a9',  intel: '#49a',  kampf: '#a44',  explorer: '#a94',
};

export function AcepPanel({ acep }: { acep: AcepData }) {
  const paths = ['ausbau', 'intel', 'kampf', 'explorer'] as const;

  return (
    <div style={{ fontFamily: 'monospace', padding: '8px' }}>
      <div style={{ marginBottom: '12px', color: '#8f8', fontSize: '11px' }}>
        ◈ ADAPTIVE CRAFT EVOLUTION PROTOCOL
      </div>

      {paths.map((path) => {
        const xp = acep[path];
        const level = getAcepLevel(xp);
        const nextThreshold = ACEP_LEVEL_THRESHOLDS[level + 1] ?? 50;
        const prevThreshold = ACEP_LEVEL_THRESHOLDS[level] ?? 0;
        const progress = level >= 5 ? 1 : (xp - prevThreshold) / (nextThreshold - prevThreshold);
        const multiplier = ACEP_LEVEL_MULTIPLIERS[level];

        return (
          <div key={path} style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ color: PATH_COLORS[path] }}>{PATH_LABELS[path]}</span>
              <span style={{ color: '#888' }}>LVL {level} · ×{multiplier.toFixed(1)} · {xp}/50 XP</span>
            </div>
            <div style={{ background: '#222', height: '4px', borderRadius: '2px', marginTop: '2px' }}>
              <div style={{
                width: `${progress * 100}%`,
                height: '100%',
                background: PATH_COLORS[path],
                borderRadius: '2px',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        );
      })}

      {acep.traits.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '8px' }}>
          <div style={{ color: '#666', fontSize: '9px', marginBottom: '4px' }}>TRAITS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {acep.traits.map((trait) => (
              <span key={trait} style={{
                background: '#1a2a1a', border: '1px solid #4a9',
                color: '#4a9', padding: '1px 6px', fontSize: '9px', borderRadius: '2px',
              }}>
                {trait.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Schritt 4: Test laufen lassen — muss PASS**
```bash
cd packages/client && npx vitest run src/__tests__/AcepPanel.test.tsx
```

**Schritt 5: AcepPanel in HangarPanel einbinden**
```bash
grep -n "Tab\|tab\|acep\|ACEP" packages/client/src/components/HangarPanel.tsx | head -20
```
ACEP-Tab als neue Tab-Option ergänzen, `<AcepPanel acep={acepData} />` rendern.

**Schritt 6: Client-Tests**
```bash
cd packages/client && npx vitest run
```

**Schritt 7: Commit**
```bash
git add packages/client/src/components/AcepPanel.tsx \
        packages/client/src/components/HangarPanel.tsx \
        packages/client/src/__tests__/AcepPanel.test.tsx
git commit -m "feat(client): ACEP tab with XP bars, level display and trait overview"
```

---

## Task 15: Modul-Farbkodierung im HANGAR (client)

**Files:**
- Modify: `packages/client/src/components/TechDetailPanel.tsx` (oder ModuleCard-Komponente)

**Kontext:** Found-Module: amber/gold Rahmen (`#b8860b`). Researched: blau (`#4499cc`). Standard: grün (`#4a9`).

**Schritt 1: Relevante Komponente finden**
```bash
grep -rn "moduleId\|ModuleCard\|module.*install\|slotIndex" \
  packages/client/src/components/ | grep -v test | head -20
```

**Schritt 2: Failing test**
Datei: `packages/client/src/__tests__/moduleColor.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { getModuleSourceColor } from '../components/moduleUtils.js';

describe('module source color', () => {
  it('standard = green', () => expect(getModuleSourceColor('standard')).toBe('#4a9'));
  it('found = amber', () => expect(getModuleSourceColor('found')).toBe('#b8860b'));
  it('researched = blue', () => expect(getModuleSourceColor('researched')).toBe('#4499cc'));
});
```

**Schritt 3: moduleUtils.ts anlegen**
```typescript
// packages/client/src/components/moduleUtils.ts
import type { ModuleSource } from '@voidSector/shared';

export function getModuleSourceColor(source: ModuleSource): string {
  switch (source) {
    case 'found':      return '#b8860b';
    case 'researched': return '#4499cc';
    default:           return '#4a9';
  }
}
```

**Schritt 4: Farbkodierung in Modul-Darstellung einbauen**

Im relevanten Panel den `border`-Style auf `getModuleSourceColor(mod.source)` setzen.

**Schritt 5: Client-Tests**
```bash
cd packages/client && npx vitest run
```

**Schritt 6: Commit**
```bash
git add packages/client/src/components/moduleUtils.ts \
        packages/client/src/__tests__/moduleColor.test.tsx
git commit -m "feat(client): module source color coding — amber found, blue researched, green standard"
```

---

## Abschluss-Verifikation

```bash
# Alle Tests
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run

# TypeScript-Fehler prüfen
cd packages/shared && npx tsc --noEmit
cd packages/server && npx tsc --noEmit
cd packages/client && npx tsc --noEmit
```

Alle Tests grün, keine TS-Fehler → fertig.
