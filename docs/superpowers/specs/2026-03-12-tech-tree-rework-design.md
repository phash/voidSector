# Tech Tree Rework — Design

**Date:** 2026-03-12
**Scope:** Sternförmiger Tech Tree, aktive Wissen-Generierung, Ablösung altes Forschungssystem
**Status:** Approved
**Issue:** #297

---

## Zusammenfassung

Das lineare Modul-Forschungssystem (8×5 Grid, passive Wissen-Generierung) wird durch einen sternförmigen Tech Tree mit 4 Hauptästen ersetzt. Wissen wird aktiv durch Spielaktionen verdient (Mining, Scan, Combat, Exploration), wobei ein Forschungslab an Bord als Multiplikator wirkt. Der Tech Tree enthält exklusive Verzweigungen (Entweder/Oder) und upgradbare Verbesserungen (Blätter) mit Trade-offs. Spieler können den Baum kostenlos resetten (24h Cooldown).

ACEP bleibt als separates System für passive Boni (Radar-Icon, Traits, Persönlichkeit). Der Tech Tree ist die mechanische Progression (Module freischalten, Stat-Boni).

---

## Baumstruktur

### 4 Hauptäste (= ACEP-Pfade)

Jeder Ast hat 3 Stufen. Jede Stufe schaltet die nächste Tier-Stufe der abhängigen Module frei. Stufe 0 ist der Ausgangszustand (Tier 1 benutzbar), Stufen 1–3 werden erforscht.

**Branch-Stufen und Tier-Unlocks:**
- Stufe 0 (Start): Alle Module Tier 1 benutzbar
- Stufe 1 (erforscht): Tier 2 + Modulgruppen erforschbar
- Stufe 2 (erforscht): Tier 3
- Stufe 3 (erforscht): Tier 4

Modulgruppen und ihre Spezialisierungen werden unabhängig von Branch-Stufen erforscht — sie sind horizontale Spezialisierung, nicht vertikale Tier-Progression.

**Knotentypen und Level-Modell:**

Jeder Knoten hat eine nodeId und ein Level in `researched_nodes`. Level 0 = nicht erforscht.

- **Branch** (Hauptast): KAMPF, AUSBAU, INTEL, EXPLORER — **ein Knoten pro Ast, maxLevel: 3**. Level 1→2→3 schaltet Tier 2→3→4 frei. NodeId: `"kampf"`, `"ausbau"`, `"intel"`, `"explorer"`. Kosten steigen pro Level (150/450/1350).
- **Module** (Modulgruppe): 3 pro Ast, exklusiv (nur 1 wählbar). **maxLevel: 1** (erforscht oder nicht). NodeId: `"kampf.laser"`, `"kampf.missile"`, etc.
- **Specialization** (Spezialisierung): 2 pro Modulgruppe, ENTWEDER/ODER. **maxLevel: 1**. NodeId: `"kampf.laser.phaser"`, etc.
- **Leaf** (Verbesserung): 3 pro Modul/Spezialisierung, nur 1 wählbar. **maxLevel: 3** (3× upgradebar). NodeId: `"kampf.laser.dmg"`, `"kampf.laser.range"`, etc.

Beispiel `researched_nodes`: `{ "kampf": 2, "ausbau": 1, "kampf.laser": 1, "kampf.laser.dmg": 2 }`
→ KAMPF Stufe 2 (Tier 3), AUSBAU Stufe 1 (Tier 2), LASER erforscht, Laser-Schaden Level 2/3.

### KAMPF (Waffen & Angriff)

**Stufe 0:** Alle Waffen Tier 1 benutzbar
**Stufe 1:** Alle Waffen Tier 2 + 3 Waffengruppen erforschbar:

- **LASER** — Präzisionswaffe, hohe Reichweite, niedriger Energieverbrauch
  - Blätter: Schaden | Reichweite | Energieeffizienz
  - Spezialisierungen: PHASER (Schilddurchdringung) ODER IMPULSLASER (Burst-DPS)
- **MISSILE** — Hoher Burst-Schaden, Munitionsverbrauch
  - Blätter: Schaden | Reichweite | Energieeffizienz
  - Spezialisierungen: ANTI-MATTER MISSILE (Einzelziel) ODER MISSILE SWARM (Flächenschaden)
- **RAILGUN** — Höchster Einzelschaden, lange Nachladezeit
  - Blätter: Schaden | Reichweite | Energieeffizienz
  - Spezialisierungen: POWERGUN (max. Durchschlag) ODER MULTI GUN (Schnellfeuer)

### AUSBAU (Schiffsbau & Verteidigung)

**Stufe 0:** Shield/Cargo/Mining Tier 1 benutzbar
**Stufe 1:** Tier 2 + 3 Modulgruppen:

- **SCHILD** — Verteidigungssysteme
  - Blätter: Stärke | Regeneration | Effizienz
  - Spezialisierungen: DEFLEKTOR (kinetisch) ODER ENERGIESCHILD (Energie-Waffen)
- **CARGO** — Frachtsysteme
  - Blätter: Kapazität | Gewicht | Schutz
  - Spezialisierungen: SCHMUGGLERFACH (versteckter Frachtraum) ODER MASSENFRACHTER (max. Kapazität)
- **MINING** — Abbausysteme
  - Blätter: Ausbeute | Geschwindigkeit | Reichweite
  - Spezialisierungen: TIEFBOHRER (seltene Ressourcen) ODER STRIP-MINER (Massenabbau)

### INTEL (Aufklärung & Information)

**Stufe 0:** Scanner/Sensor/Lab Tier 1 benutzbar
**Stufe 1:** Tier 2 + 3 Modulgruppen:

- **SCANNER** — Sektoranalyse
  - Blätter: Reichweite | Detailgrad | Scanzeit
  - Spezialisierungen: DEEP-SCANNER (Fernreichweite) ODER BIO-SCANNER (Anomalien/Leben)
- **SENSOR** — Echtzeiterfassung
  - Blätter: Präzision | Tarnentdeckung | Reichweite
  - Spezialisierungen: TAKTIK-ARRAY (Kampfinfo) ODER SURVEY-SONDE (Ressourcen-Kartierung)
- **LABOR** — Forschungseinrichtung
  - Blätter: Wissen-Rate | Effizienz | Kapazität
  - Spezialisierungen: FORSCHUNGSLAB (Wissen-Boost) ODER ANALYSE-LAB (Artefakt-Analyse)

### EXPLORER (Erkundung & Mobilität)

**Stufe 0:** Drive/Fuel/Nav Tier 1 benutzbar
**Stufe 1:** Tier 2 + 3 Modulgruppen:

- **ANTRIEB** — Fortbewegung
  - Blätter: AP-Effizienz | Geschwindigkeit | Sprungreichweite
  - Spezialisierungen: WARP-CORE (weite Sprünge) ODER IONEN-ANTRIEB (AP-Effizienz)
- **TREIBSTOFF** — Energieversorgung
  - Blätter: Tankgröße | Verbrauch | Regeneration
  - Spezialisierungen: FUEL-PROZESSOR (Erz→Fuel) ODER SOLAR-KOLLEKTOR (passive Regen)
- **NAVIGATION** — Wegfindung
  - Blätter: Autopilot-Range | Routen-Effizienz | Entdeckung
  - Spezialisierungen: PATHFINDER-AI (optimale Routen) ODER KARTOGRAPH (Sektoren aufdecken)

### Knotenanzahl

| Typ | Pro Ast | Gesamt | maxLevel |
|-----|---------|--------|----------|
| Branch | 1 | 4 | 3 |
| Module | 3 | 12 | 1 |
| Spezialisierung | 6 | 24 | 1 |
| Blätter (Module) | 9 | 36 | 3 |
| Blätter (Specs) | 18 | 72 | 3 |
| **Gesamt (Knoten)** | **37** | **148** | — |

Hinweis: 148 einzigartige Knoten im Baum. Branch- und Leaf-Knoten sind levelbar (maxLevel 3), Module/Spezialisierungen sind 0/1. Ein Spieler kann durch Exklusivität max. ~20 Knoten gleichzeitig erforscht haben.

---

## Exklusivität & Regeln

**Modulgruppen:** Pro Ast-Stufe nur EINE Modulgruppe wählbar (z.B. LASER blockiert MISSILE + RAILGUN).

**Spezialisierungen:** Pro Modulgruppe nur EINE Spezialisierung (z.B. PHASER blockiert IMPULSLASER).

**Blätter:** Pro Modul/Spezialisierung nur EINES der 3 Blätter wählbar, aber bis zu 3× upgradebar (Kosten steigen stark: ×1/×3/×9).

**Vererbung (top-down):** Blatt-Verbesserungen eines Moduls gelten auch für dessen Kind-Spezialisierungen. Beispiel: LASER hat Blatt "Schaden +15%" erforscht → wenn danach PHASER (Kind von LASER) gewählt wird, erbt PHASER den +15% Schaden-Bonus. Richtung: Eltern-Modul → Kind-Spezialisierung. `getTechTreeEffects()` sammelt Effekte von Blättern des Parent-Moduls und addiert sie zu den Effekten der Spezialisierung.

---

## Kosten-Eskalation (Hybrid)

### Tiefenbasierte Basiskosten

| Tiefe | Basiskosten |
|-------|------------|
| Branch Stufe 1 | 150 Wissen |
| Branch Stufe 2 | 450 Wissen |
| Branch Stufe 3 | 1350 Wissen |
| Modulgruppe | 280 Wissen |
| Spezialisierung | 620 Wissen |
| Blatt Stufe 1 | 180 Wissen |
| Blatt Stufe 2 | 540 Wissen |
| Blatt Stufe 3 | 1620 Wissen |

### Globaler Aufschlag

Jeder erforschte Knoten erhöht alle zukünftigen Kosten um +5%. Leaf-Upgrades (Stufe 2, 3) zählen ebenfalls — jedes Upgrade ist eine separate Forschung die `totalResearched` erhöht. Das ist beabsichtigt: tiefe Spezialisierung in einem Blatt macht alles andere teurer.

```
effectiveCost = baseCost × (1 + totalResearched × 0.05)
```

Bei 10 erforschten Knoten: +50%. Bei 20: +100% (doppelte Kosten).

---

## Wissen-Generierung (aktiv)

### Passive Generierung entfernt

`processWissenTick()` wird aus dem `StrategicTickService` entfernt. Struktur-Labs generieren kein Wissen mehr passiv.

### Aktive Generierung durch Spielaktionen

| Service | Aktion | Basis-Wissen |
|---------|--------|-------------|
| MiningService | Erz/Gas/Crystal abbauen | +1 pro Ladung |
| ScanService | Sektor scannen | +2 |
| ScanService | Artefakt finden | +5–15 (nach Typ) |
| CombatService | NPC besiegt | +3–8 (nach Stärke) |
| CombatService | PvP gewonnen | +10 |
| NavigationService | Neuer Sektor betreten | +1 |
| NavigationService | Quadrant wechseln | +5 |
| QuestService | Quest abgeschlossen | +5–20 (nach Schwierigkeit) |
| ShipService | Modul gebaut/gecraftet | +3 |

### Lab-Multiplikator (Struktur-basiert)

Das Forschungslab ist eine platzierte Struktur (`structures` Tabelle, `type = 'research_lab'`). Die bestehende Funktion `getResearchLabTier(userId)` in `queries.ts` liefert den Tier. Lab-Strukturen bleiben bestehen, verlieren aber die passive Wissen-Generierung — stattdessen wirken sie als Multiplikator auf aktiv verdientes Wissen.

| Lab Tier | Multiplikator |
|----------|--------------|
| 0 (kein Lab) | ×1.0 |
| 1 | ×1.5 |
| 2 | ×2.0 |
| 3 | ×3.0 |
| 4 | ×4.0 |
| 5 | ×5.0 |

### Neue Funktion

```typescript
// wissenService.ts — in packages/shared/src/constants.ts als LAB_WISSEN_MULTIPLIER exportiert
async function awardWissen(playerId: string, baseAmount: number): Promise<void> {
  const labTier = await getResearchLabTier(playerId);  // bestehende Funktion in queries.ts
  const multiplier = LAB_WISSEN_MULTIPLIER[labTier] ?? 1.0;
  const gain = Math.floor(baseAmount * multiplier);
  if (gain > 0) await addWissen(playerId, gain);
}
```

---

## DB-Migration 059: `player_tech_tree`

```sql
CREATE TABLE IF NOT EXISTS player_tech_tree (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  researched_nodes JSONB NOT NULL DEFAULT '{}',
  total_researched INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ
);
```

**Felder:**
- `researched_nodes`: `{ "kampf": 1, "kampf.laser": 1, "kampf.laser.dmg": 2 }` — nodeId → level
- `total_researched`: Gesamtzahl erforschter Knoten (für globalen Aufschlag)
- `last_reset_at`: Zeitstempel des letzten Resets (24h Cooldown)

---

## Server-Nachrichten

| Client → Server | Daten | Response |
|----------------|-------|----------|
| `getTechTree` | — | `techTreeUpdate` |
| `researchTechNode` | `{ nodeId: string }` | `techTreeUpdate`, `wissenUpdate` |
| `resetTechTree` | — | `techTreeUpdate` |

### `researchTechNode`-Handler

```
1. Lade player_tech_tree (INSERT IF NOT EXISTS)
2. Validiere: nodeId existiert in TECH_TREE_NODES
3. Validiere: Parent erforscht
4. Validiere: Exklusiv-Gruppe — kein anderer Knoten aus Gruppe bereits erforscht
5. Validiere: aktuelles Level < maxLevel (3 für Branch/Leaf, 1 für Module/Spec)
6. Berechne: effectiveCost = baseCost × (1 + total × 0.05)
7. Validiere: Spieler hat genug Wissen
8. Abziehen: Wissen -= Kosten
9. Update: researched_nodes[nodeId] = level + 1, total_researched++
10. Speichern + techTreeUpdate + wissenUpdate senden
```

### `resetTechTree`-Handler

```
1. Lade player_tech_tree
2. Validiere: last_reset_at älter als 24h (oder null)
3. Reset: researched_nodes = {}, total_researched = 0
4. Update: last_reset_at = NOW()
5. Speichern + techTreeUpdate senden
```

Kein Wissen-Rückerstattung beim Reset.

---

## Effekte-System

### `getTechTreeEffects(researchedNodes)`

Zentrale Pure-Funktion in shared:

```typescript
interface TechTreeEffects {
  unlockedTiers: Record<string, number>;  // module category → max usable tier
  statBonuses: Record<TechStatKey, number>;  // stat → additiver Bonus (Dezimal, z.B. 0.15 = +15%)
}

// Definierte Stat-Keys (Mapping von Blatt-Verbesserungen auf Gameplay-Effekte)
type TechStatKey =
  // KAMPF
  | 'weapon_damage'       // Schaden-Blatt
  | 'weapon_range'        // Reichweite-Blatt
  | 'weapon_efficiency'   // Energieeffizienz-Blatt
  // AUSBAU
  | 'shield_strength'     // Schild-Stärke
  | 'shield_regen'        // Schild-Regeneration
  | 'shield_efficiency'   // Schild-Effizienz
  | 'cargo_capacity'      // Cargo-Kapazität
  | 'cargo_weight'        // Cargo-Gewicht
  | 'cargo_protection'    // Cargo-Schutz
  | 'mining_yield'        // Mining-Ausbeute
  | 'mining_speed'        // Mining-Geschwindigkeit
  | 'mining_range'        // Mining-Reichweite
  // INTEL
  | 'scan_range'          // Scanner-Reichweite
  | 'scan_detail'         // Scanner-Detailgrad
  | 'scan_speed'          // Scan-Geschwindigkeit
  | 'sensor_precision'    // Sensor-Präzision
  | 'sensor_stealth'      // Tarnentdeckung
  | 'sensor_range'        // Sensor-Reichweite
  | 'lab_wissen_rate'     // Labor Wissen-Rate
  | 'lab_efficiency'      // Labor-Effizienz
  | 'lab_capacity'        // Labor-Kapazität
  // EXPLORER
  | 'drive_ap_efficiency' // AP-Effizienz
  | 'drive_speed'         // Geschwindigkeit
  | 'drive_jump_range'    // Sprungreichweite
  | 'fuel_capacity'       // Tankgröße
  | 'fuel_consumption'    // Treibstoffverbrauch
  | 'fuel_regen'          // Treibstoff-Regeneration
  | 'nav_autopilot'       // Autopilot-Range
  | 'nav_route_efficiency'// Routen-Effizienz
  | 'nav_discovery';      // Entdeckungsrate
```

Effekte werden mit top-down Vererbung berechnet: Blätter eines Eltern-Moduls (z.B. LASER) addieren sich zu den Effekten der Kind-Spezialisierung (z.B. PHASER).

### Integration in Services

- **ShipService**: `unlockedTiers` prüfen beim Modul-Ausrüsten (ersetzt bisherige `researchModule`/`isModuleUnlocked`-Checks)
- **CombatService**: `statBonuses.weapon_damage` etc. bei Schadensberechnung (Platzhalter bis Combat v3)
- **MiningService**: `statBonuses.mining_yield/speed` bei Abbau
- **ScanService**: `statBonuses.scan_range/detail/speed` bei Scans
- **NavigationService**: `statBonuses.drive_ap_efficiency/jump_range` bei Bewegung

---

## Tech Tree Canvas (UI)

### Layout

Sternförmig, radial vom Zentrum:
- TECH CORE im Zentrum
- 4 Äste in 90°-Abständen (KAMPF oben, AUSBAU links, INTEL rechts, EXPLORER unten)
- Knoten-Positionen: `polarToCartesian(angle, depth × ringSpacing)`
- Modulgruppen fächern sich ±30° vom Ast-Winkel auf
- Blätter/Spezialisierungen fächern weiter auf

### Knotenformen

| Typ | Form | Größe |
|-----|------|-------|
| TECH CORE | Kreis, grüner Glow | 90px |
| Branch | Hexagon, Ast-Farbe | 110×50px |
| Module | Abgerundetes Rechteck | 100×42px |
| Spezialisierung | Abgerundetes Rechteck | 100×42px |
| Blatt | Kleiner Kreis mit Icon | 32px |

### Knotenstatus

| Status | Darstellung |
|--------|------------|
| `researched` | Voll leuchtend, Ast-Farbe, Glow-Schatten |
| `available` | Gedämpfte Farbe, pulsierender Glow |
| `locked` | Grau (#333), 30% Opacity |
| `exclusive_blocked` | Dunkelrot, durchgestrichen |

### Ast-Farben

| Ast | Farbe |
|-----|-------|
| KAMPF | #ff4444 (Rot) |
| AUSBAU | #4488ff (Blau) |
| INTEL | #bb44ff (Lila) |
| EXPLORER | #44ff88 (Grün) |

### Interaktion

- **Pan**: Maus-Drag
- **Zoom**: Mausrad (0.3×–3×), +/−-Buttons
- **Klick**: Info-Panel rechts einblenden
- **Doppelklick**: Forschungs-Bestätigungsdialog

### Info-Panel

Rechts eingeblendet bei Knoten-Klick:
- Knotenname, Typ, Status
- Kosten (inkl. globalem Aufschlag)
- Beschreibungstext
- Effekte (+/− mit Farbe)
- Bei Blättern: Stufe, Kosten pro Stufe
- Exklusiv-Warnung
- [ERFORSCHEN]-Button

### Header

```
TECH TREE /// FORSCHUNGSBAUM    [WISSEN: 1,247]    ERFORSCHT: 7 /// AUFSCHLAG: +35%
```

### CRT-Ästhetik

Scanlines-Overlay, Vignette, Courier New Monospace, gedämpfte Farben mit Glow — konsistent mit dem Rest des Spiels.

---

## Migration & Entfernen

### Entfernen

- `processWissenTick()` Aufruf aus StrategicTickService (passive Wissen-Generierung)
- `wissenTickHandler.ts` (Datei löschen)
- `startResearch`/`cancelResearch`/`claimResearch`-Handler aus SectorRoom (zeitgesteuerte Forschung)
- `researchModule`-Handler aus SectorRoom (alte Modul-Forschung)
- `WISSEN_COST_BY_TIER`, `RESEARCH_LAB_TIER_FOR_MODULE_TIER` Konstanten
- `RESEARCH_LAB_NAMES` Konstanten
- `WISSEN_SECTOR_MULTIPLIERS` Konstanten
- `ResearchState.activeResearch`/`activeResearch2`/`wissenRate` Felder im Client (zeitgesteuerte Forschung + passive Rate)
- Altes TechTreeCanvas.tsx (komplett ersetzen)

### Behalten

- `addWissen()` in queries.ts — wird von neuem `awardWissen()` aufgerufen
- `ResearchState.wissen` im Client — bleibt für Wissen-Anzeige
- `getResearchLabTier()` in queries.ts — wird von `awardWissen()` für Multiplikator genutzt
- Lab-Strukturen in DB (structures Tabelle) — bleiben bestehen, werden zum Wissen-Multiplikator (statt passive Generierung)

### Bestehende Systeme: unlockedModules / Blueprints

- `ResearchState.unlockedModules[]` wird durch `TechTreeEffects.unlockedTiers` ersetzt. `isModuleUnlocked()` in `research.ts` prüft künftig gegen Tech Tree statt gegen die alte unlocked-Liste.
- `ResearchState.blueprints[]` und Blueprint-Drops aus Scan-Events bleiben vorerst bestehen (Blueprint-Crafting ist separate Mechanik am Schiff). Blueprints umgehen NICHT die Tech-Tree-Tier-Anforderungen — ein Blueprint für drive_mk3 kann nur aktiviert werden, wenn der Spieler EXPLORER Stufe 2 (Tier 3) erforscht hat.

### Bestehende Spieler

Spieler starten mit leerem Tech Tree. Alte `research_progress`-Daten bleiben in DB, werden nicht migriert. Bei kleiner Playtest-Spielerbasis akzeptabel.

---

## Reset-Mechanik

- **Kosten:** Kostenlos
- **Cooldown:** 24 Stunden
- **Effekt:** Alle erforschten Knoten werden gelöscht, total_researched auf 0
- **Kein Wissen-Refund** — investiertes Wissen ist verloren
- **Timer:** Wird im UI angezeigt (RESET TREE mit Countdown)

---

## Out of Scope

- Waffensystem-Implementierung (Laser/Missile/Railgun Kampfmechanik — kommt mit Combat v3). KAMPF-Knoten im Baum existieren und sind erforschbar, aber Waffen-Stat-Boni werden erst mit Combat v3 gameplay-wirksam.
- Konkrete Stat-Werte für alle 156 Knoten (Balancing — kommt iterativ). Initial werden repräsentative Werte für den KAMPF-Ast implementiert, andere Äste erhalten Platzhalter-Werte.
- Lab-Struktur-Rework (bleiben bestehen, verlieren nur passive Funktion)
- ACEP-UI-Panel (separates Issue)
- Sound-Effekte für Forschung

---

## Technische Hinweise

### TECH CORE Knoten

TECH CORE ist kein erforschbarer Knoten — es ist der Ausgangspunkt im Zentrum des Baums. Alle 4 Branch-Knoten haben `parent: null` (direkt vom Core erreichbar). TECH CORE existiert nur als UI-Element, nicht im Datenmodell.

### `wissenRate` im Client

`ResearchState.wissenRate` wird entfernt (keine passive Rate mehr). Stattdessen kann optional ein `wissenGainedThisSession`-Counter angezeigt werden, ist aber out of scope für die erste Iteration.
