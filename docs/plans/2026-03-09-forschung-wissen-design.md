# Forschung & Wissen-System — Design

**Datum:** 2026-03-09
**Status:** Design abgeschlossen, bereit für Implementation

---

## Überblick

Das Forschungssystem wird um eine neue Ressource **Wissen** erweitert und grundlegend neu ausgerichtet:

- **Wissen** ersetzt Credits/Erz/Kristall als Forschungswährung
- **Typisierte Artefakte** (9 Kategorien) sind Pflicht für Tier 3–5-Module und geben Boni
- **Stationslabore** (5 Stufen) generieren Wissen passiv + schalten Tier-Grenzen frei
- **ACEP** ist die Spieler-Basis — Stationen sind Produktions- und Wissensgeneratoren
- **Canvas Tech-Baum** ersetzt die bisherige Liste im TECH-Programm

### Strategischer Loop

```
Station mit Labor → Wissen generieren
        +
Quadrant-Modifikatoren (Ancient Gates, Anomalien, etc.)
        ↓
Wissen + typisierte Artefakte → Modul erforschen
        ↓
ACEP nutzt erforschte Module
```

Stationen in Quadranten mit Ancient Jumpgates / Anomalien sind begehrte Spots (Phase EW Synergie).

---

## Wissen-Generierung

### Station Lab-Gebäude (5 Stufen)

| Stufe | Name | Schaltet frei | Basisrate |
|-------|------|---------------|-----------|
| I | Grundlabor | Tier 1 | 5 Wissen/h |
| II | Forschungslabor | Tier 2 | 12 Wissen/h |
| III | Analysestation | Tier 3 + Forschungsslot 2 | 25 Wissen/h |
| IV | Forschungsturm | Tier 4 | 45 Wissen/h |
| V | Observatorium | Tier 5 | 80 Wissen/h |

Baukosten für Lab-Stufen: Credits + Erz/Kristall (wie andere Stationsgebäude).

### Quadrant-Multiplikatoren

| Element im Sektor der Station | Multiplikator |
|-------------------------------|---------------|
| Asteroid | ×1.2 |
| Nebel | ×1.5 |
| Anomalie | ×2.0 |
| Schwarzes Loch (Nachbarsektor) | ×2.5 |
| Ancient Jumpgate | ×5.0 |

Mehrere Elemente: Multiplikatoren werden **multipliziert** (z.B. Nebel + Ancient Gate = ×7.5).

### Aktions-Boni
- Bestimmte Aktionen (Scan, Herstellung) geben Wissen-Boosts (konkrete Werte in Implementation)

### Generierungs-Mechanik
- **Spieler-global**: alle eigenen Stationen addieren ihre Raten
- **Offline**: Generierung läuft via UniverseTickEngine (60s-Intervall im StrategicTick)
- `WissenTickHandler.ts`: berechnet Δ-Zeit × Rate für alle Stationen des Spielers

---

## Typisierte Artefakte

### 9 Artefakt-Typen

```
drive · cargo · scanner · armor · weapon · shield · defense · special · mining
```

- **Typ wird zufällig** beim Fund (Scan-Events, Anomalie-Events) zugewiesen
- Gleichverteilung — kein Typ-Bias
- Im Cargo als **separate Slots**: `artefact_drive`, `artefact_shield`, etc.

### Artefakt als Forschungs-Katalysator

- Artefakte geben bei Einsatz **Wissen-Äquivalent** (Kosten sinken)
- **Passender Typ** (z.B. `artefact_drive` für Antriebsmodul) gibt +10% Bonus auf Forschungszeit-Reduktion
- **Maximum 3 Artefakte** pro Forschungsvorgang

---

## Forschungskosten

### Modul-Forschungskosten (ersetzt bisherige Credits/Erz/etc.)

| Tier | Wissen | Artefakt-Pflicht | Max. optionale Extras |
|------|--------|------------------|-----------------------|
| 1 | 100 | — | bis 3 (alle optional) |
| 2 | 300 | — | bis 3 (alle optional) |
| 3 | 800 | 1 × passend | bis 2 optional |
| 4 | 2.000 | 2 × passend | bis 1 optional |
| 5 | 5.000 | 3 × passend | — |

### Forschungsslots
- **Slot 1**: immer verfügbar (kein Labor nötig — aber Tier-Grenze ohne Labor: kein Modul forschbar)
- **Slot 2**: freigeschaltet ab Lab-Stufe III (Analysestation)

### Forschungsort
- Forschung nur möglich wenn Spieler eine Station mit passendem Lab-Level **besitzt** (beliebiger Ort)
- Kein physisches Andocken nötig — Wissen fließt über das galaktische Netz

---

## Canvas Tech-Baum

### Layout (Sec 2 — Main Monitor)

```
        ANTRIEB  FRACHT  SCANNER  PANZER  WAFFEN  SCHILD  VERTEID.  BERGBAU
Tier 5  [ MkV ]  [ MkV ]   ...
Tier 4  [ MkIV]  [ MkIV]   ...
Tier 3  [ MkIII] ...              ↑ Abhängigkeitspfeil
Tier 2  [ MkII ] ...
Tier 1  [ MkI  ] [ MkI ]   ...   (frei = kein Pfeil nötig)
```

- **Spalten**: Modul-Kategorien
- **Zeilen**: Tier 1–5 (oben = höher)
- **Abhängigkeitspfeile**: Linien zwischen Prerequisite → Nachfolger
- **Tier-Lock-Indikator**: gesperrte Reihen haben dimme Overlay-Linie mit Lab-Anforderung

### Knoten-Status & Farben

| Status | Farbe / Stil |
|--------|-------------|
| Frei (kein researchCost) | `#00FF88` solid |
| Erforscht | `#00FF88` dim |
| Aktive Forschung | Amber `#FFB000` blinkend |
| Freischaltbar (Ressourcen ok) | Amber `#FFB000` |
| Gesperrt (Prereq fehlt) | Grau dim |
| Blueprint | `#00BFFF` |
| Lab-Level zu niedrig | Rot-Outline |

### Interaktion
- Klick auf Knoten → `selectedTechModule` → TechDetailPanel (Sec 3)
- Hover → Tooltip: Name, Tier, Status-Kurzinfo
- Wissen-Anzeige oben im Canvas: `WISSEN: 1.240  RATE: +32/h`

### TechDetailPanel (Sec 3 — bleibt)
- Zeigt: Modul-Effekte, Wissen-Kosten, Artefakt-Slots (1–3), verfügbare Artefakte, Forschungs-Button
- Artefakt-Slots: Spieler wählt welche typisierte Artefakte eingesetzt werden (optional/Pflicht markiert)

---

## Architektur

### Shared (`packages/shared`)

```
types.ts:
  - ResearchCost: { wissen: number; artefacts?: Partial<Record<ArtefactType, number>> }
  - ArtefactType: 'drive' | 'cargo' | 'scanner' | 'armor' | 'weapon' | 'shield' | 'defense' | 'special' | 'mining'
  - CargoState: +9 typisierte Artefakt-Felder (artefact_drive etc.), bisheriges artefact bleibt für Legacy
  - ResearchState: + wissenBalance: number

constants.ts:
  - MODULES[*].researchCost: auf neues Format umstellen
  - WISSEN_QUADRANT_MULTIPLIERS
  - RESEARCH_LAB_LEVELS (5 Einträge)
  - ARTEFACT_TYPES

research.ts:
  - canStartResearch: prüft wissenBalance + typisierte Artefakte + Lab-Level
```

### DB (Migration 044)

```sql
-- Wissen-Balance
ALTER TABLE player_research ADD COLUMN wissen INT NOT NULL DEFAULT 0;

-- Station Lab-Level
ALTER TABLE stations ADD COLUMN research_lab_level SMALLINT NOT NULL DEFAULT 0;

-- Typisierte Artefakte in cargo
ALTER TABLE cargo ADD COLUMN artefact_drive INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_cargo INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_scanner INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_armor INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_weapon INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_shield INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_defense INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_special INT NOT NULL DEFAULT 0;
ALTER TABLE cargo ADD COLUMN artefact_mining INT NOT NULL DEFAULT 0;

-- Gleiches für player_storage
ALTER TABLE player_storage ADD COLUMN artefact_drive INT NOT NULL DEFAULT 0;
-- ... (alle 9 Typen)
```

### Server

```
WissenTickHandler.ts   — neuer Handler im StrategicTickService
                         alle 60s: Stationen mit lab_level > 0 auslesen,
                         Quadrant-Multiplikator berechnen, Δ-Wissen → DB

ShipService.ts         — handleStartResearch: prüft Lab-Level, Wissen, Artefakte
                         handleClaimResearch: Wissen-Kosten abziehen, Artefakte verbrauchen

WorldService.ts        — handleBuild: neuer Gebäudetyp 'research_lab' (Stufen 1–5)

scanEvents.ts          — Artefakt-Fund: zufälliger ArtefactType zuweisen

queries.ts             — getWissen, addWissen, deductWissen
                         getStationLabLevel, setStationLabLevel
                         getTypedArtefacts, deductTypedArtefacts
```

### Client

```
TechTreeCanvas.tsx     — neu, ersetzt TechTreePanel (Canvas, Grid-Layout)
TechDetailPanel.tsx    — erweitern: Wissen-Kosten, Artefakt-Slots
gameSlice.ts           — wissen: number, typedArtefacts: Record<ArtefactType, number>
network/client.ts      — wissenUpdate handler, typedArtefactsUpdate
```

---

## Abhängigkeiten & Reihenfolge

1. Shared-Typen + Constants aktualisieren (ArtefactType, ResearchCost, CargoState)
2. Migration 044
3. DB-Query-Funktionen
4. WissenTickHandler
5. ShipService Research-Handler updaten
6. WorldService Lab-Bau
7. scanEvents Artefakt-Typisierung
8. Client: gameSlice + network
9. TechTreeCanvas (Canvas-Komponente)
10. TechDetailPanel erweitern

---

## Offene Fragen (für Implementation)

- Aktions-Wissen-Boni: konkrete Werte für Scan/Herstellung (vorschlag: +5 Scan, +10 Herstellung)
- Wissen-Cap: gibt es ein Maximum? (Vorschlag: 50.000 — kein Cap vorerst)
- Legacy-Artefakte: bestehende `artefact`-Werte in Cargo → zufällig auf Typen aufteilen bei Migration
- Baukosten für Lab-Stufen (konkrete Credits/Erz-Werte)
