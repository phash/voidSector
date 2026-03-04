# Tech-Baum & Schiffsmodule — Design-Dokument

**Stand:** 2026-03-04
**Basis:** Issue #68 Sektion 6, bestehender Plan `issue68-schiffsmodule-techbaum.md`
**Scope:** Research-Engine + Blueprint-System + Spezial-Module + UI

---

## 1. Überblick

### Ziel
Tier 2+ Module müssen erforscht oder durch Blaupausen freigeschaltet werden. Tier 1 bleibt frei verfügbar. Forschung findet an der Home-Base statt (Tech-Lab). Blaupausen droppen aus Anomalien, Piraten, Quests und Fraktions-Handel.

### Design-Entscheidungen
- **Effekt-Modell:** `primaryEffect`/`secondaryEffects` sind reine UI-Labels. Berechnung nutzt weiterhin `effects: Partial<ShipStats>`.
- **Timer:** Hybrid-Range 5-30 Minuten (kürzer als Original-Plan).
- **Cancel:** Keine Rückerstattung bei Forschungs-Abbruch.
- **Scope:** Alle Tier 1-3 + 3 Spezial-Module (void_drive, quantum_scanner, nano_armor).

---

## 2. Datenmodell

### Erweiterte `ModuleDefinition`
```typescript
interface ModuleDefinition {
  // ... bestehende Felder ...
  primaryEffect: { stat: string; delta: number; label: string };
  secondaryEffects: Array<{ stat: string; delta: number; label: string }>;
  researchCost?: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number };
  researchDurationMin?: number;
  prerequisite?: string;                    // Modul-ID des Vorgängers
  factionRequirement?: { factionId: string; minTier: string };
}
```

### Neue `ShipStats`-Felder
- `artefactChanceBonus: number` — scanner_mk3 (+3%), quantum_scanner (+5%)
- `safeSlotBonus: number` — cargo_mk2 (+1), cargo_mk3 (+2)

### Neuer Typ `ResearchState`
```typescript
interface ResearchState {
  unlockedModules: string[];
  blueprints: string[];
  activeResearch: {
    moduleId: string;
    startedAt: number;
    completesAt: number;
  } | null;
}
```

---

## 3. DB-Schema

Migration `016_research.sql`:
```sql
CREATE TABLE IF NOT EXISTS player_research (
  user_id          INTEGER NOT NULL REFERENCES users(id) PRIMARY KEY,
  unlocked_modules TEXT[]  NOT NULL DEFAULT '{}',
  blueprints       TEXT[]  NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS active_research (
  user_id       INTEGER NOT NULL REFERENCES users(id) PRIMARY KEY,
  module_id     TEXT    NOT NULL,
  started_at    BIGINT  NOT NULL,
  completes_at  BIGINT  NOT NULL
);
```

---

## 4. Server-Handler

4 neue Messages in `SectorRoom.ts`:

1. **`startResearch`** — Validiert: am Home-Base, Voraussetzungen erfüllt (prerequisite in unlockedModules, factionRequirement), Kosten vorhanden, kein aktives Projekt. Zieht Credits + Ressourcen + Artefakte ab. Setzt Timer.
2. **`cancelResearch`** — Bricht ab, keine Rückerstattung.
3. **`claimResearch`** — Prüft Timer abgelaufen → fügt Modul zu `unlockedModules`.
4. **`activateBlueprint`** — Blueprint aus Inventar → Modul direkt in `unlockedModules`.

Bestehender `installModule`-Handler: Prüft zusätzlich ob Modul in `unlockedModules`/`blueprints` oder Tier 1.

---

## 5. Blueprint-Drop-Integration

| Quelle | Chance | Mögliche Blueprints |
|--------|--------|---------------------|
| Anomalie-Scan (scanner T2+) | 15% | T2/T3 Module |
| Pirate-Beute (high-level) | 8% | T2 Waffen-Module |
| Quest-Belohnung (Tier 3) | Festgelegt | Kategorie-spezifisch |
| Ancient-Fraktion Honored NPC-Handel | 20% | Spezial-Module |

Neuer Scan-Event-Typ: `blueprint_find`.

---

## 6. Module-Daten & Timer

### Timer-Skalierung (Hybrid)

| Tier | Timer-Range |
|------|-------------|
| T2 | 5-10 Min |
| T3 | 10-20 Min |
| Spezial | 25-30 Min |

### Spezial-Module

| ID | Prerequisite | Faction Req | Artefakte | Effekte |
|----|-------------|-------------|-----------|---------|
| void_drive | drive_mk3 | Ancient Honored | 10 | +6 jumpRange, engineSpeed 5, -3 fuelPerJump |
| quantum_scanner | scanner_mk3 | — | 8 | +3 scannerLevel, +200 commRange, +5% artefactChance |
| nano_armor | armor_mk3 | — | 15 | +150 hp, -35% damageMod |

### Forschungs-Tabelle (alle Module)

| Projekt | Prerequisite | Research-Kosten | Artefakte | Timer |
|---------|-------------|-----------------|-----------|-------|
| drive_mk2 | drive_mk1 | 200 CR + 15 Erz | 0 | 5 Min |
| drive_mk3 | drive_mk2 | 500 CR + 30 Erz + 10 Krist | 2 | 12 Min |
| cargo_mk2 | cargo_mk1 | 150 CR + 10 Erz | 0 | 5 Min |
| cargo_mk3 | cargo_mk2 | 400 CR + 25 Erz | 1 | 10 Min |
| scanner_mk2 | scanner_mk1 | 200 CR + 10 Krist | 0 | 5 Min |
| scanner_mk3 | scanner_mk2 | 600 CR + 20 Krist | 3 | 15 Min |
| armor_mk2 | armor_mk1 | 200 CR + 20 Erz | 0 | 5 Min |
| armor_mk3 | armor_mk2 | 500 CR + 40 Erz | 2 | 12 Min |
| shield_mk1 | armor_mk1 | 300 CR + 15 Krist | 0 | 7 Min |
| shield_mk2 | shield_mk1 | 700 CR + 35 Krist + 10 Gas | 2 | 15 Min |
| shield_mk3 | shield_mk2 | 1500 CR + 70 Krist + 25 Gas | 0 | 20 Min |
| laser_mk1 | — | 200 CR + 10 Krist | 0 | 5 Min |
| laser_mk2 | laser_mk1 | 600 CR + 25 Krist + 10 Gas | 0 | 10 Min |
| laser_mk3 | laser_mk2 | 1500 CR + 50 Krist + 20 Gas | 0 | 18 Min |
| railgun_mk1 | laser_mk1 | 400 CR + 30 Erz + 15 Krist | 0 | 8 Min |
| railgun_mk2 | railgun_mk1 | 1000 CR + 60 Erz + 30 Krist | 1 | 15 Min |
| missile_mk1 | — | 300 CR + 20 Erz + 5 Krist | 0 | 7 Min |
| missile_mk2 | missile_mk1 | 900 CR + 40 Erz + 15 Krist | 0 | 12 Min |
| emp_array | laser_mk2 | 600 CR + 20 Krist + 20 Gas | 2 | 12 Min |
| point_defense | armor_mk2 | 400 CR + 20 Erz + 10 Krist | 0 | 8 Min |
| ecm_suite | scanner_mk2 | 500 CR + 25 Krist + 15 Gas | 0 | 10 Min |
| void_drive | drive_mk3 | 2000 CR | 10 | 30 Min |
| quantum_scanner | scanner_mk3 | 1500 CR + 50 Krist | 8 | 25 Min |
| nano_armor | armor_mk3 | 1800 CR + 50 Erz + 50 Krist | 15 | 30 Min |

---

## 7. Client-UI

### Neue Komponenten

1. **TechTreePanel** — Neuer Monitor `TECH` in Sidebar:
   - Aktive Forschung mit Fortschrittsbalken (Echtzeit-Countdown)
   - Verfügbare Projekte mit Kosten und Status
   - `[FORSCHUNG STARTEN]` Button (nur an Home-Base)

2. **Erweiterter ModuleCard** in SHIP-SYS:
   - Primäreffekt prominent, Sekundäreffekte als zweite Zeile
   - Gesperrte Module zeigen Research-Kosten
   - Blueprint-Badge `[BP]`

3. **BlueprintDialog** — Overlay bei Blueprint-Fund:
   - Modul-Name, Quelle, Seltenheit
   - `[AKTIVIEREN]` oder `[ALS SLATE VERKAUFEN]`

### Bestehende Änderungen
- Station-Shop zeigt nur freigeschaltete Module
- `installModule` prüft `unlockedModules` client-seitig
- Neuer Monitor: `MONITORS.TECH = 'TECH'`

---

## 8. Files Modified (Expected)

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | `ModuleDefinition` erweitert, `ResearchState` Typ, neue ShipStats-Felder |
| `packages/shared/src/constants.ts` | Alle MODULES mit primaryEffect/secondaryEffects/researchCost/prerequisite |
| `packages/shared/src/shipCalculator.ts` | Init neue ShipStats-Felder |
| `packages/shared/src/index.ts` | Exports |
| `packages/server/src/db/migrations/016_research.sql` | Neue Tabellen |
| `packages/server/src/db/queries.ts` | Research CRUD Queries |
| `packages/server/src/rooms/SectorRoom.ts` | 4 neue Handler, installModule-Validierung |
| `packages/server/src/engine/scanEvents.ts` | blueprint_find Event |
| `packages/client/src/state/gameSlice.ts` | ResearchState im Store |
| `packages/client/src/components/TechTreePanel.tsx` | **Neu**: Tech-Baum Monitor |
| `packages/client/src/components/BlueprintDialog.tsx` | **Neu**: Blueprint Overlay |
| `packages/client/src/components/GameScreen.tsx` | ModuleCard erweitert |

*Design-Ende — voidSector Tech-Baum & Schiffsmodule*
