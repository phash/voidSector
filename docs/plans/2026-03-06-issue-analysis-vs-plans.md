# Issue-Analyse vs. Phase 2 Rebuild-Pläne

## Status-Übersicht

**Gesamte Open Issues: ~30+**
**Analysiert: 16 (Top Priority)**

| Issue | Titel | Status | Kategorie | Plan-Referenz |
|-------|-------|--------|-----------|---|
| #161 | Enable 2nd to follow 1st | ✅ **COVERED** | UI/UX | Monitor Detail-Follow (Minor) |
| #160 | schwarzes Loch (Black Hole) | ✅ **COVERED** | Navigation | Phase 5: SectorTraversabilityService |
| #159 | Scan-Sharing | ❌ **NEEDS INCLUSION** | NPC/Economy | Phase 4: DynamicPriceService? |
| #158 | NAV-Screen nicht verschiebbar | ⚠️ **INDEPENDENT** | UI/Panels | Not in Phase 2 |
| #157 | Black Hole Kartographier-Quest | ✅ **COVERED** | Quests | Phase 4: QuestGeneratorV2 |
| #156 | Neue Quadranten: Infos | ⚠️ **PARTIALLY COVERED** | Seeding/UI | Phase 2: UniverseSeedingService |
| #155 | Move-Animation | ⚠️ **INDEPENDENT** | UI/Animation | Not in Phase 2 |
| #154 | aktueller Sektor verliert Infos | ⚠️ **INDEPENDENT** | UI Bug | Not in Phase 2 |
| #153 | Hinweise bei Fehlern | ⚠️ **INDEPENDENT** | UI/UX | Not in Phase 2 |
| #152 | Testbildschirm | ⚠️ **INDEPENDENT** | UI Feature | Not in Phase 2 |
| #151 | Quest-Programm auf Schiff | ⚠️ **INDEPENDENT** | UI Feature | Not in Phase 2 |
| #150 | First Base (freies Placement) | ❌ **NEEDS INCLUSION** | Base Building | Phase 3: Ressourcen-Yerbe |
| #149 | station rework | ❌ **NEEDS INCLUSION** | Station UI | Phase 4: NPCShipService |
| #148 | Anzeige der Möglichkeiten | ⚠️ **PARTIALLY COVERED** | UI Flow | Phase 4: Quests |
| #147 | Auto-Update NAV secondary | ✅ **COVERED** | Navigation | Phase 5: AutopilotPathfinder |
| #146 | Schiffswechsel (Multi-Ship) | ❌ **NEEDS INCLUSION** | Gameplay | Not in Phase 2 |

---

## Detaillierte Analyse

### ✅ FULLY COVERED (In neuen Plänen enthalten)

#### #160 — schwarzes Loch (Black Hole Navigation)
**Status:** COVERED  
**Plan:** restructuring-plan-sector-system.md, Phase 5 (Navigation-Update)  
**Details:**
- `SectorTraversabilityService` prüft `environment_type === 'black_hole'` → non-traversable
- WarpJumpValidator verbietet direkte Sprünge in Black Holes
- AutopilotPathfinder umgeht Black Holes automatisch
**Action:** ✅ Keine weitere Änderung nötig

#### #157 — Black Hole Kartographier-Quest
**Status:** COVERED  
**Plan:** restructuring-plan-sector-system.md, Phase 4 (NPC-Ökosystem)  
**Details:**
- `QuestGeneratorV2` generiert sektortyp-abhängige Quests
- Schwarze Löcher können nicht direkt betreten, aber Nachbar-Sektoren scannen → perfekt für 4er-Scan-Quest
**Action:** ✅ Code-Details während Phase 4 ausarbeiten (scan-from-neighbor Mechanic)

#### #161 — Enable 2nd to follow 1st
**Status:** COVERED (UI-Layer)  
**Plan:** restructuring-plan-sector-system.md, Phase 4 + UI Layer  
**Details:**
- DetailView auto-tracking nach Spieler-Position
- Hardware-Button zum Toggle
- Ist UI-Feature, nicht System-Feature → OK für Phase 2 Integration
**Action:** ✅ Minor: Kann in Phase 4 (DetailView-Handler) gebaut werden

#### #147 — Auto-Update NAV secondary
**Status:** COVERED  
**Plan:** restructuring-plan-sector-system.md, Phase 5 (Navigation)  
**Details:**
- Autopilot folgt Spieler-Position automatisch
- Hardware-Button zum Toggle
**Action:** ✅ Implementierung in Phase 5

---

### ❌ NEEDS INCLUSION (Muss in Pläne rein)

#### #159 — Scan-Sharing (Fraktion-Feature)
**Status:** NOT IN PLAN  
**Needs:** Neuer Service oder Feature-Flag  
**Details:**
```
Mechanic:
- Private Scans: Nur Scanner sieht Sector-Details
- Fraktion-Scans: Alle Fraktion-Member teilen Scan-Daten
- Reputation-Auswirkung: Höhere Reputation = bessere Scan-Sharing?
```
**Frage an dich:** 🤔
- Ist das Phase 2 (Rebuild-Kontext) oder Phase 3+ (Fraktion-Feature)?
- Soll Scan-Sharing im neuen Seeding-System Teil von `sector_environments.discovered_by` sein?
- Oder NPC-Fraktion-Präferenz beeinflussen?

**Recommendation:** DEFER zu Phase 3+ (Fraktion-Rework), aber:
- Datenbank-Schema: `sector_contents.discovered_by` → könnte auf `faction_id` erweitert werden
- Phase 2 vorbereiten: Enum für `discovery_scope: 'private' | 'faction' | 'public'`

#### #150 — First Base (freies Placement)
**Status:** NEEDS INCLUSION IN PHASE 3  
**Plan Location:** restructuring-plan-sector-system.md, Phase 3 (Ressourcen)  
**Details:**
```
Current System: Home-Base fix vorgegeben
New System:
  ├─ Spieler fliegt herum (kostenfrei)
  ├─ Wählt beliebigen LEEREN Sektor
  ├─ Baut erste Base KOSTENLOS
  └─ Restrictions:
      ├─ Keine Pirates (oder nach Defeat ok)
      ├─ Keine Nebel
      └─ Nur leere Sektoren
```

**Issue mit aktuellem Plan:**
- Phase 3 fokussiert auf Ressourcen-Yields, nicht auf Base-Building
- Base-Placement braucht:
  1. Sektor-Typ-Check (`environment_type === 'empty'`)
  2. Content-Check (keine Pirates, außer besiegt)
  3. Nebula-Check
  4. Cost-Override für erste Base

**Action Required:**
- [ ] Neuen Task in Phase 3: "BaseBuilding Service - First Base Free Placement"
- [ ] Datenbank-Migration: `bases.is_starter_base BOOLEAN` Flag

#### #146 — Schiffswechsel (Multi-Ship System)
**Status:** NOT IN PLAN  
**Complexity:** MEDIUM-HIGH  
**Details:**
```
New Feature:
- Player kann mehrere Schiffe besitzen
- Hangar auf jeder Base
- Schiff-Wechsel über neues "Ships" Window
- Schiffe haben Artwork, Name, Position, Modul-Inventar
```

**Issue mit aktuellem Plan:**
- Ist komplett neue Gameplay-Mechanic (nicht in Phase 2)
- Braucht:
  1. New DB Table: `player_ships` (hull_type, name, position, active_flag)
  2. New Service: `ShipManagementService`
  3. UI: "Ships" Window mit Cards
  4. Modul-Verteilung: Jedes Schiff hat Modul-Inventar
  5. Cargo-Transfer zwischen Schiffen

**Frage an dich:** 🤔
- Ist #146 Phase 2 (Rebuild) oder Phase 3+ (Gameplay)?
- Soll es zusammen mit Base-Relocation implementiert werden?
- Braucht Multi-Ship ein neues Schiffs-Management-UI?

#### #149 — Station Rework (Terminal UI)
**Status:** NOT IN PLAN (aber thematisch relevant)  
**Complexity:** HIGH  
**Details:**
```
New UI:
- Andocken an Stationen
- Terminal-basiertes CLI-Interface
- Separate Screens für Trade, Quests, Admin
- Background-Artwork + Station-Info
```

**Issue mit aktuellem Plan:**
- Ist UI-Rework, nicht System-Rework
- Phase 4 (NPC-Ökosystem) fokussiert auf Spawn + Quests, nicht auf Station-UI
- Braucht Brainstorming (#149 explicitly: `aufgabe: erstelle mit /brainstorm ein gutes konzept`)

**Action Required:**
- [ ] Brainstorming-Session durchführen
- [ ] Station-Terminal-Konzept erstellen
- [ ] Könnte zusammen mit Phase 4 umgesetzt werden

---

### ⚠️ PARTIALLY COVERED oder INDEPENDENT (Nicht Phase-2-Priorität)

#### #156 — Neue Quadranten: Infos (Entdecker-Info)
**Status:** PARTIALLY COVERED  
**Plan:** Phase 2 (UniverseSeedingService)  
**Details:**
```
Feature:
- Neuer Quadrant wird betreten → "DISCOVERED: 6.3.2026 by Phash"
- Jeder Quadrant hat +/- 80% Seed-Variation
- Discovery-Info auf QUAD-MAP angezeigt
```

**What's Covered:**
- UniverseSeedingService seeded Quadranten
- Deterministische Seed-Generierung ✓

**What's NOT Covered:**
- Seed-Variation pro Quadrant (aktuell: gleicher WorldSeed)
- UI für Discovery-Info auf QUAD-MAP
- Entdecker-Name speichern

**Action Required:**
- [ ] Phase 2 ergänzen: "QuadrantVariationSeed = hash(worldSeed + quadrantX + quadrantY + variation_factor)"
- [ ] DB erweitern: `quadrants.discovered_by, discovered_at, seed_offset`
- [ ] QUAD-MAP UI für Discovery-Info (nicht Phase 2, aber vorbereiten)

#### #148 — Anzeige der Möglichkeiten (Context-Menu)
**Status:** PARTIALLY COVERED  
**Plan:** Phase 4 (QuestGeneratorV2)  
**Details:**
```
UI Feature:
- Sektor-Detail zeigt Icons für verfügbare Aktionen (Trade, Quest, Refuel)
- Click auf Station → Detail-View mit Aktions-Buttons
- Buttons zum Programm-Switch (Trade → Quest → Nav)
```

**What's Covered:**
- Phase 4 generiert Quests pro Sektortyp ✓
- NPC-Ökosystem definiert, was Station bietet

**What's NOT Covered:**
- UI für Icon-Anzeige (nicht System-Feature)
- Navigation-Flow zwischen Views
- Ist UI-Rework (ähnlich #149 Station-Terminal)

**Action:** Separate UI-Task (nicht Phase 2)

#### #158, #154, #153, #155, #152, #151 — UI/UX Issues
**Status:** INDEPENDENT (Nicht im Rebuild enthalten)  
**Category:** Bug-Fixes + UI Polish  
**Action:** Könnte parallel zu Phase 2 gelöst werden, nicht blockierend

---

## Zusammenfassung: Umsetzungsplan für Issues

### 🟢 PHASE 2 REBUILD (Pläne bestehen)
- ✅ #160 schwarzes Loch
- ✅ #157 Black Hole Quest
- ✅ #161 Detail-Follow
- ✅ #147 Auto-Update NAV

**Action:** Code direkt nach Plan umsetzen, keine Änderungen nötig

---

### 🟡 PHASE 2 + PHASE 3 (Müssen in Pläne eingefügt werden)

#### #150 — First Base Free Placement
**Integration Point:** Phase 3 (Ressourcen-Yields)
**New Task 3.1:**
```
BaseBuilding Service & First-Base Mechanics
- SectorTypeCheck: empty + nicht-pirate + nicht-nebula
- Cost Override: Erste Base kostenlos
- DB Migration: bases.is_starter_base
- Server Message Handler: buildFirstBase()
```
**Estimated Effort:** 2–3 Tage
**Priority:** MEDIUM (Gameplay-Feature, aber Independent)

#### #159 — Scan-Sharing
**Integration Point:** Phase 4 (NPC-Ökosystem) **OR** Phase 3+
**Questions before proceeding:** 🤔
1. Ist Fraktion-basiertes Scan-Sharing für Phase 2 relevant?
2. Oder defer zu Fraktion-Rework Phase 3+?
3. Soll `sector_environments.discovered_by` schon Fraktion-Info tragen?

**Preliminary Action:** 
- [ ] DB-Schema vorbereiten: `sector_contents.discovery_scope: enum`
- [ ] Defer Implementierung zu Phase 3+ (Fraktion-Feature)

---

### 🔵 SEPARATE TRACKS (Nicht in Rebuild-Plan enthalten)

#### #146 — Schiffswechsel (Multi-Ship)
**Status:** Große Feature, nicht Phase 2
**Questions:** 🤔
1. Gehört das zu Phase 3 oder ist es ein separates Features-Update?
2. Wird zusammen mit Base-Relocation umgesetzt?

**Preliminary Action:**
- [ ] Design-Spec erstellen (DB-Schema, Services, UI)
- [ ] Als Phase 3A oder 3B planen

#### #149 — Station Rework (Terminal UI)
**Status:** UI-Rework, braucht Brainstorming
**Action Required:**
- [ ] `/brainstorm` session durchführen
- [ ] Terminal-Konzept erstellen
- [ ] UI-Mockups
- [ ] Implementation Plan

#### #156 — Quadrant Variation Seed
**Action Required:**
- [ ] Phase 2, Punkt "UniverseSeedingService": Seed-Variation Pro-Quadrant ergänzen
- [ ] DB Migration: `quadrants(discovered_by, discovered_at, seed_offset)`
- [ ] QUAD-MAP UI für Discovery-Info (später)

---

## Fragen für dich 🤔

### Clarifications Needed:

1. **#159 Scan-Sharing:** Ist das für Phase 2 Rebuild relevant, oder defer zu Fraktion-Rework Phase 3?

2. **#146 Multi-Ship:** Soll das zusammen mit #150 (Base Placement) als "Phase 3B Gameplay-Features" umgesetzt werden?

3. **#149 Station Rework:** Soll die Terminal-UI zusammen mit Phase 4 (NPC-Ökosystem) gebaut werden, oder später?

4. **#156 Quadrant Info:** Sind +/- 80% Seed-Variation und "DISCOVERED BY" Info für Live-Launch wichtig, oder später?

5. **UI/UX Issues (#158, #154, #155, etc.):** Können diese parallel zu Phase 2 Rebuild gelöst werden, oder blockierend?

---

## Empfohlener Execution Path

### 📋 **Phase 2 Rebuild** (3 Wochen, Pläne unverändert)
```
Phase 1: Core DB (3d)
Phase 2: Seeding (2d)
Phase 3: Ressourcen + #150 FirstBase (3d)  ← NEW TASK
Phase 4: NPC + #157 BlackHoleQuest (3d)
Phase 5: Navigation (2d)
Phase 6: Testing + Go-Live (5d)
```

### 🎯 **Phase 3+ Separate Tracks** (Parallel oder nach Phase 2)
```
Track A: #146 Multi-Ship + Base-Relocation System
Track B: #149 Station-Terminal UI (mit Brainstorm)
Track C: #156 Quadrant Variation Seed + Discovery-UI
Track D: #159 Scan-Sharing (Fraktion-Feature)
Track E: UI/UX Polish (#158, #154, #155, #152, #151, #153)
```

---

**Dokument Status:** READY FOR DISCUSSION  
**Datum:** 2026-03-06  
**Nächster Schritt:** Deine Clarifications + dann Umsetzungsplan updaten
