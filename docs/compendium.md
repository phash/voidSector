# voidSector — Spielkompendium

> **Stand:** 2026-03-04 | Basis: master (alle Branches gemergt bis PR #95)
>
> Diese Datei dient als Referenz fuer Balancing, Spieldesign und zukuenftige Inhaltserweiterungen.
> Codebasis: 962-Zeilen `constants.ts`, 744 Tests (449 Server, 179 Client, 116 Shared).

---

## 1. Universum & Weltgenerierung

### Koordinatensystem

Das Universum ist ein unendliches 2D-Gitter. Koordinaten werden zweistellig dargestellt:

```
[QUAD:INNER]  →  z.B. [03E8:0042]
```

- **QUAD** (hex): `Math.floor((x + 250) / 500)` — Quadrant im Universum (zentriert, Ursprung in Quadrantmitte)
- **INNER** (dez): lokale Position im Quadranten, Bereich -250..249
- Spieler spawnen in **Clustern** ab Distanz `10_000_000` vom Ursprung
- Cluster-Radius: 300 Sektoren, max. 5 Spieler pro Cluster

### Weltseed

```ts
WORLD_SEED = 77
```

Alle Sektoren werden deterministisch aus `hashCoords(x, y, WORLD_SEED)` generiert. Gleicher Seed = gleiche Karte nach jedem Server-Neustart.

**Zwei-Stufen-Generierung:**

1. **Environment-Roll** — Nebula und Black Holes werden vor dem Roll via Zone-System abgefangen (`isInNebulaZone`, `isInBlackHoleCluster`). Alles andere: `empty`.
2. **Content-Roll** — Bestimmt den Inhalt des Sektors (unabhängiger Hash).

**Salt-Prinzip** — Jedes System bekommt seinen eigenen Salt um Korrelationen zu vermeiden:

| System           | Salt                         |
|------------------|------------------------------|
| Sektoren (Basis) | `WORLD_SEED`                 |
| Jumpgates        | `WORLD_SEED + JUMPGATE_SALT` |
| NPCs             | `WORLD_SEED + NPC_SEED_SALT` |
| Quests           | `WORLD_SEED + QUEST_SEED_SALT + dayOfYear` |
| Nebula-Zonen     | `WORLD_SEED ^ 0xa5a5a5a5`   |
| Black-Hole-Cluster | `WORLD_SEED ^ 0xb1ac4001` |

### Sektor-Dichte (Content-Weights, zweiter Roll)

90 % aller Sektoren sind vollstaendig leer. Die restlichen 10 % verteilen sich:

| Content          | Gewicht | Anteil   |
|------------------|---------|----------|
| none (leer)      | 0.900   | ~90 %    |
| asteroid_field   | 0.050   | ~5 %     |
| pirate           | 0.020   | ~2 %     |
| station          | 0.016   | ~1.6 %   |
| anomaly          | 0.010   | ~1 %     |
| ruin             | 0.004   | ~0.4 %   |

`pirate` erzeugt immer `['pirate_zone', 'asteroid_field']`. `station` hat 15 % Chance auf `stationVariant: 'ancient'`.

### Umgebungssystem (Environment + Content)

Sektoren bestehen seit dem Multi-Content-Update aus zwei Schichten:

- **Environment** (`SectorEnvironment`): `empty`, `nebula`, `black_hole`
- **Content** (`SectorContent`): `asteroid_field`, `station`, `anomaly`, `pirate_zone`, `home_base`, `player_base`

Ein Sektor kann bis zu **3 Contents** gleichzeitig enthalten (`SECTOR_MAX_FEATURES = 3`).

### Umgebungsmodifikatoren

| Umgebung    | Effekt                                    |
|-------------|------------------------------------------|
| nebula      | Scanner-Malus -1, Piraten -30 %           |
| empty       | Treibstoffkosten -20 %                    |
| black_hole  | Spawn-Chance 0.5 %, min. Distanz 50       |

### Nebel-Zonen

Seed-basierte Blob-Generierung fuer grossflaechige Nebel:

| Parameter           | Wert                    |
|---------------------|------------------------|
| Grid-Abstand        | 300 Sektoren            |
| Entstehungschance   | 8 % pro Grid-Zelle     |
| Min. Radius         | 15 Sektoren             |
| Max. Radius         | 50 Sektoren             |
| Sicherheitszone     | 200 Sektoren um Ursprung |

---

## 2. Quadranten-System

Jeder Quadrant umfasst **500 x 500** Sektoren (`QUADRANT_SIZE = 500`). Das Koordinatensystem ist zentriert: Quadrant (0,0) deckt Sektoren x∈[-250, 249], y∈[-250, 249] ab. Der Ursprung (0,0) liegt in der Mitte von Quadrant (0,0).

### Erstkontakt-Benennung

Betritt ein Spieler einen neuen Quadranten, wird ein **First-Contact-Event** ausgeloest:

- Automatischer Silben-basierter Name wird generiert (2-4 Silben + Suffix)
- Entdecker hat ein **60-Sekunden-Zeitfenster** zur Benennung
- Namensregeln: 3-24 Zeichen, nur Buchstaben/Zahlen/Leerzeichen/Bindestriche/Apostrophe
- Doppelte Namen sind nicht erlaubt

### Quadranten-Konfiguration

Jeder Quadrant erhaelt deterministisch variierende Parameter:

| Parameter       | Bereich      | Beschreibung                    |
|----------------|--------------|---------------------------------|
| resourceFactor | 0.5 – 1.5   | Ressourcen-Multiplikator         |
| stationDensity | 0.5 – 1.5   | Stationsdichte                   |
| pirateDensity  | 0.5 – 1.5   | Piratendichte                    |
| nebulaThreshold| 0.5 – 1.5   | Nebel-Schwelle                   |
| emptyRatio     | 0.5 – 1.5   | Leerraum-Anteil                  |

### QUAD-MAP Monitor

Dedizierter Monitor zur Visualisierung der Quadranten-Karte mit Canvas-Rendering.

---

## 3. Sektortypen

### `empty` — Leerer Sektor
- **Farbe:** Amber `#FFB000`
- **Ressourcen:** Ore 5, Gas 5, Crystal 5 (sehr gering)
- **Symbol:** `·`
- **Besonderheiten:** Keine

### `asteroid_field` — Asteroidenfeld
- **Farbe:** Orange `#FF8C00`
- **Ressourcen:** Ore 20, Gas 2, Crystal 3
- **Symbol:** `▓`
- **Besonderheiten:** Primaere Erz-Quelle. Scan-Ereignisse moeglich.

### `nebula` — Nebel
- **Farbe:** Blau `#00BFFF`
- **Ressourcen:** Ore 2, Gas 20, Crystal 3
- **Symbol:** `▒`
- **Besonderheiten:** Primaere Gas-Quelle. Scanner-Malus -1.

### `station` — Raumstation
- **Farbe:** Gruen `#00FF88`
- **Ressourcen:** Keine (Handelsposten)
- **Symbol:** `△`
- **Besonderheiten:** NPC-Handel, Reparatur, Schiffs-Upgrades, Ueberlebende abliefern.
  Station-Namen sind deterministisch aus Koordinaten generiert.
  15 % der Stationen sind Ancient/Spezial-Varianten.

### `anomaly` — Anomalie
- **Farbe:** Magenta `#FF00FF`
- **Ressourcen:** Ore 3, Gas 3, Crystal 20
- **Symbol:** `◇`
- **Besonderheiten:** Primaere Kristall-Quelle. Hohe XP-Boni. Seltene Scan-Ereignisse.

### `pirate` — Piraten-Sektor
- **Farbe:** Rot `#FF3333`
- **Ressourcen:** Ore 8, Gas 3, Crystal 8
- **Symbol:** `☠`
- **Besonderheiten:** Automatischer Kampf beim Betreten. Piraten-Level skaliert mit Distanz vom Ursprung (Level 1 bei Distanz 0–49, +1 pro 50 Sektoren, max. Level 10).
- **Frontier-Regel:** Piraten generieren und kaempfen **nur in Frontier-Quadranten** (1–5 unkontrollierte Nachbarquadranten). In gesicherten Quadranten (tief im Zivilisationsgebiet) wird `pirate_zone` beim Generieren entfernt; bestehende DB-Eintraege bleiben erhalten, Kampf ist aber inaktiv (`NO_PIRATES`-Error).

### `home_base` — Heimatbasis (Spezial)
- **Farbe:** Weiss `#FFFFFF`
- **Symbol:** `⌂`
- **Besonderheiten:** Einmaliger Sektor pro Spieler. Gratis-Betankung (bis 3 Schiffe), Storage, Construction.

---

## 4. Ressourcen

| Ressource | Symbol | Primaerquelle    | NPC-Basispreis | Mining-Rate |
|-----------|--------|------------------|----------------|-------------|
| Ore       | ⛏      | asteroid_field   | 10 CR/u        | 0.1 u/s     |
| Gas       | ♦      | nebula           | 15 CR/u        | 0.1 u/s     |
| Crystal   | ◈      | anomaly          | 25 CR/u        | 0.1 u/s     |
| Artefakt  | ❋      | Scan-Events      | — (nicht handelbar) | —       |

**NPC-Kauf-Spread:** +20 % (×1.2 — Stationen verkaufen teurer)
**NPC-Verkauf-Spread:** -20 % (×0.8 — Stationen kaufen billiger)

### Artefakt-Dropchancen

| Quelle               | Chance |
|-----------------------|--------|
| artifact_find Event   | 50 %   |
| anomaly_reading       | 8 %    |
| Piraten-Sieg          | 3 %    |

---

## 5. Aktionspunkte (AP)

| Parameter       | Wert            |
|-----------------|-----------------|
| Max AP          | 100             |
| Start AP        | 100             |
| Regen           | 0.5 AP/s (1 AP alle 2s) |
| Jump-Kosten     | 1–2 AP/Sprung (hull-abhaengig) |
| Scan            | 3 AP (lokal: 1 AP) |
| Area-Scan       | 3–8 AP (scanner-abhaengig) |

### Scanner-Level & Area-Scan

| Level | AP-Kosten | Radius |
|-------|-----------|--------|
| 1     | 3 AP      | 2      |
| 2     | 5 AP      | 3      |
| 3     | 8 AP      | 5      |

---

## 6. Raumschiffe

### Huelltypen

| Hull       | Name             | Groesse | Slots | Fuel | Cargo | Jump | AP/J | Fuel/J | HP  | Scanner | CommRange | Speed | Unlock    |
|------------|------------------|---------|-------|------|-------|------|------|--------|-----|---------|-----------|-------|-----------|
| scout      | VOID SCOUT       | small   | 3     | 80   | 3     | 5    | 1    | 1      | 50  | 1       | 50        | 2     | Lv.1 / gratis |
| freighter  | VOID FREIGHTER   | medium  | 4     | 120  | 15    | 3    | 2    | 2      | 80  | 1       | 75        | 1     | Lv.3 / 500 CR |
| cruiser    | VOID CRUISER     | medium  | 4     | 150  | 8     | 4    | 1    | 1      | 100 | 1       | 100       | 2     | Lv.4 / 1000 CR |
| explorer   | VOID EXPLORER    | large   | 5     | 200  | 10    | 6    | 1    | 1      | 70  | 2       | 150       | 2     | Lv.5 / 2000 CR |
| battleship | VOID BATTLESHIP  | large   | 5     | 180  | 5     | 2    | 2    | 3      | 150 | 1       | 75        | 1     | Lv.6 / 3000 CR |

**Empfehlung Balancing:**
- Scout: Schnell, wenig Cargo — Erstkontakt-Schiff
- Freighter: Traege aber maximales Cargo — Handelsspezialist
- Cruiser: Ausgeglichen — Kampf + Exploration
- Explorer: Maximale Reichweite + Scanfelder — Kartograf
- Battleship: Maximale HP, kurze Reichweite — Tank/Veteran

### Radar-Pixelicons (3×3)

```
Scout:       Explorer:
 .█.           .█.
 ███           .█.
 .█.           ███

Freighter:   Battleship:
 ███           ███
 ███           ███
 .█.           █.█

Cruiser:
 █.█
 ███
 .█.
```

---

## 7. Schiffsmodule

### Drive — Antriebssysteme

| ID          | Name              | Tier | Effekte                                   | Kosten                  | Forschung                 |
|-------------|-------------------|------|-------------------------------------------|-------------------------|---------------------------|
| drive_mk1   | ION DRIVE MK.I    | 1    | +1 Jump, +1 Speed                        | 100 CR, 10 Ore          | —                         |
| drive_mk2   | ION DRIVE MK.II   | 2    | +2 Jump, +2 Speed, -0.2 AP/J             | 300 CR, 20 Ore, 5 Cry   | 200 CR, 15 Ore (5 Min)   |
| drive_mk3   | ION DRIVE MK.III  | 3    | +3 Jump, +3 Speed, -0.5 AP/J             | 800 CR, 40 Ore, 15 Cry  | 500 CR, 30 Ore, 10 Cry, 2 Art (12 Min) |
| void_drive  | VOID DRIVE        | 3    | +6 Jump, +5 Speed, -3 Fuel/J             | 2000 CR, 5 Art          | 2000 CR, 10 Art (30 Min) — Ancients honored |

### Cargo — Lagerkapazitaet

| ID          | Name              | Tier | Effekte                                   | Kosten                  | Forschung                 |
|-------------|-------------------|------|-------------------------------------------|-------------------------|---------------------------|
| cargo_mk1   | CARGO BAY MK.I    | 1    | +5 Cargo                                 | 80 CR                   | —                         |
| cargo_mk2   | CARGO BAY MK.II   | 2    | +12 Cargo, +1 Safe-Slot                  | 250 CR, 15 Ore          | 150 CR, 10 Ore (5 Min)   |
| cargo_mk3   | CARGO BAY MK.III  | 3    | +25 Cargo, +2 Safe-Slot, +20 Fuel        | 600 CR, 30 Ore, 10 Gas  | 400 CR, 25 Ore, 1 Art (10 Min) |

### Scanner — Scansysteme

| ID            | Name             | Tier | Effekte                                   | Kosten                   | Forschung                 |
|---------------|------------------|------|-------------------------------------------|--------------------------|---------------------------|
| scanner_mk1   | SCANNER MK.I     | 1    | +1 Scan-Level                            | 120 CR, 5 Cry            | —                         |
| scanner_mk2   | SCANNER MK.II    | 2    | +1 Scan-Level, +50 Komm                  | 350 CR, 15 Cry           | 200 CR, 10 Cry (5 Min)   |
| scanner_mk3   | SCANNER MK.III   | 3    | +2 Scan-Level, +100 Komm, +3% Art-Chance | 900 CR, 30 Cry, 10 Gas   | 600 CR, 20 Cry, 3 Art (15 Min) |
| quantum_scanner| QUANTUM-SCANNER  | 3    | +3 Scan-Level, +200 Komm, +5% Art-Chance | 1500 CR, 50 Cry          | 1500 CR, 50 Cry, 8 Art (25 Min) |

### Armor — Panzerung

| ID          | Name                  | Tier | Effekte                          | Kosten                    | Forschung                 |
|-------------|-----------------------|------|----------------------------------|---------------------------|---------------------------|
| armor_mk1   | ARMOR PLATING MK.I    | 1    | +25 HP                          | 100 CR, 15 Ore            | —                         |
| armor_mk2   | ARMOR PLATING MK.II   | 2    | +50 HP, -10% Schaden            | 300 CR, 30 Ore, 10 Cry    | 200 CR, 20 Ore (5 Min)   |
| armor_mk3   | ARMOR PLATING MK.III  | 3    | +100 HP, -25% Schaden           | 800 CR, 50 Ore, 25 Cry    | 500 CR, 40 Ore, 2 Art (12 Min) |
| nano_armor   | NANO-PANZERUNG       | 3    | +150 HP, -35% Schaden           | 1800 CR, 50 Ore, 50 Cry   | 1800 CR, 50 Ore, 50 Cry, 15 Art (30 Min) |

### Waffen (Combat v2)

| ID            | Name              | Tier | Typ     | ATK | Spezial              | Kosten                      | Forschung                    |
|---------------|-------------------|------|---------|-----|----------------------|-----------------------------|------------------------------|
| laser_mk1     | PULS-LASER MK.I   | 1    | laser   | 8   | —                    | 150 CR, 10 Cry              | 200 CR, 10 Cry (5 Min)       |
| laser_mk2     | PULS-LASER MK.II  | 2    | laser   | 16  | —                    | 450 CR, 25 Cry, 10 Gas      | 600 CR, 25 Cry, 10 Gas (10 Min) |
| laser_mk3     | PULS-LASER MK.III | 3    | laser   | 28  | —                    | 1200 CR, 50 Cry, 20 Gas     | 1500 CR, 50 Cry, 20 Gas (18 Min) |
| railgun_mk1   | RAIL-KANONE MK.I  | 1    | railgun | 12  | 30% Panzerbrechend   | 300 CR, 30 Ore, 15 Cry      | 400 CR, 30 Ore, 15 Cry (8 Min) |
| railgun_mk2   | RAIL-KANONE MK.II | 2    | railgun | 22  | 50% Panzerbrechend   | 900 CR, 60 Ore, 30 Cry      | 1000 CR, 60 Ore, 30 Cry, 1 Art (15 Min) |
| missile_mk1   | RAKETEN-POD MK.I  | 1    | missile | 18  | —                    | 250 CR, 20 Ore, 5 Cry       | 300 CR, 20 Ore, 5 Cry (7 Min) |
| missile_mk2   | RAKETEN-POD MK.II | 2    | missile | 30  | —                    | 750 CR, 40 Ore, 15 Cry      | 900 CR, 40 Ore, 15 Cry (12 Min) |
| emp_array      | EMP-EMITTER       | 2    | emp     | 0   | EMP (kein Schaden)   | 500 CR, 20 Cry, 20 Gas      | 600 CR, 20 Cry, 20 Gas, 2 Art (12 Min) |

### Schilde (Combat v2)

| ID          | Name              | Tier | Schild-HP | Regen/Runde | Kosten                      | Forschung                     |
|-------------|-------------------|------|-----------|-----------|-----------------------------|-------------------------------|
| shield_mk1  | SCHILD-GEN MK.I   | 1    | 30        | 3         | 200 CR, 15 Cry              | 300 CR, 15 Cry (7 Min)        |
| shield_mk2  | SCHILD-GEN MK.II  | 2    | 60        | 6         | 600 CR, 35 Cry, 10 Gas      | 700 CR, 35 Cry, 10 Gas, 2 Art (15 Min) |
| shield_mk3  | SCHILD-GEN MK.III | 3    | 100       | 12        | 1500 CR, 70 Cry, 25 Gas     | 1500 CR, 70 Cry, 25 Gas (20 Min) |

### Verteidigungs-Module (Combat v2)

| ID             | Name                | Tier | Effekt                            | Kosten                      | Forschung                     |
|----------------|---------------------|------|-----------------------------------|-----------------------------|-------------------------------|
| point_defense  | PUNKT-VERTEIDIGUNG  | 2    | 60% Raketen-Abfang                | 350 CR, 20 Ore, 10 Cry      | 400 CR, 20 Ore, 10 Cry (8 Min) |
| ecm_suite      | ECM-SUITE           | 2    | -15% feindl. Genauigkeit          | 400 CR, 25 Cry, 15 Gas      | 500 CR, 25 Cry, 15 Gas (10 Min) |

---

## 8. Tech Tree & Forschungssystem

### Grundprinzip

- Tier-1-Module sind **frei kaufbar** (kein Research noetig)
- Tier-2- und Tier-3-Module muessen **erforscht** werden
- Forschung benoetigt: Credits, Ressourcen und teils **Artefakte**
- Nur **eine** aktive Forschung gleichzeitig moeglich
- Forschungstick: 1 Minute (`RESEARCH_TICK_MS = 60_000`)

### Voraussetzungen (Prerequisite-Ketten)

```
drive_mk1 → drive_mk2 → drive_mk3 → void_drive (Ancients honored)
cargo_mk1 → cargo_mk2 → cargo_mk3
scanner_mk1 → scanner_mk2 → scanner_mk3 → quantum_scanner
armor_mk1 → armor_mk2 → armor_mk3 → nano_armor
                        → point_defense
              scanner_mk2 → ecm_suite
laser_mk1 → laser_mk2 → laser_mk3
           → railgun_mk1 → railgun_mk2
             laser_mk2 → emp_array
missile_mk1 → missile_mk2
armor_mk1 → shield_mk1 → shield_mk2 → shield_mk3
```

### Blueprints

Blueprints koennen ueber Scan-Events (`blueprint_find`) gefunden werden. Ein Blueprint schaltet ein Modul **ohne Forschung** frei.

### Research Lab

Gebaeude an der Spielerbasis. Baukosten: 25 AP, 30 Ore, 25 Gas, 30 Crystal.

---

## 9. Combat v2 — Taktisches Kampfsystem

> Feature-Flag: `FEATURE_COMBAT_V2 = true` (standardmaessig aktiv)

### Grundmechanik

- **5 Runden** pro Kampf (`COMBAT_V2_MAX_ROUNDS = 5`)
- Jede Runde: Spieler waehlt **Taktik** + **Spezial-Aktion**
- Schadenswurf: ×0.85 bis ×1.15 Zufallsfaktor
- Schilde absorbieren Schaden vor HP
- Schildregeneration pro Runde

### Taktiken

| Taktik     | Schadens-Mod | Verteidigungs-Mod |
|------------|-------------|-------------------|
| assault    | ×1.30       | ×0.80             |
| balanced   | ×1.00       | ×1.00             |
| defensive  | ×0.75       | ×1.35             |

### Spezial-Aktionen (einmal pro Kampf)

| Aktion | Effekt                                                  |
|--------|---------------------------------------------------------|
| aim    | +50% Genauigkeit, 35% Chance Waffe fuer 2 Runden zu deaktivieren |
| evade  | 50% Chance Schaden komplett zu vermeiden                 |

### Waffen-Mechaniken

| Typ     | Besonderheit                                            |
|---------|---------------------------------------------------------|
| laser   | Zuverlaessig, keine Spezialeffekte                       |
| railgun | 30–50% Panzerbrechend (ignoriert Schilde)               |
| missile | Hoher Schaden, aber durch Punkt-Verteidigung abfangbar   |
| emp     | 75% Trefferchance, deaktiviert Waffen fuer 2 Runden     |

### Kampfergebnis

Nach 5 Runden oder HP = 0:
- **Sieg:** Loot (Credits, Ressourcen, Artefakte)
- **Niederlage:** 25–50% Cargo-Verlust
- **Auto-Flee:** Nach Runde 5 flieht der Spieler automatisch

---

## 10. Station Defense — Basisverteidigung

Spieler-Basen koennen mit Verteidigungsanlagen geschuetzt werden.

### Verteidigungsstrukturen

| Typ               | Schaden | Schild-HP | Regen | Spezial                | Baukosten (Struktur)         |
|--------------------|---------|-----------|-------|------------------------|------------------------------|
| defense_turret     | —       | —         | —     | —                      | 20 AP, 40 Ore, 10 Gas, 20 Cry |
| station_shield     | —       | —         | —     | —                      | 20 AP, 30 Ore, 25 Gas, 30 Cry |
| ion_cannon         | —       | —         | —     | —                      | 25 AP, 60 Ore, 30 Gas, 40 Cry |

### Verteidigungsmodule (installiert in Strukturen)

| ID                   | Schaden | Schild-HP | Regen | Spezial                | Kosten                                  |
|----------------------|---------|-----------|-------|------------------------|------------------------------------------|
| defense_turret_mk1   | 15      | —         | —     | —                      | 500 CR, 50 Ore                           |
| defense_turret_mk2   | 30      | —         | —     | —                      | 1500 CR, 100 Ore, 20 Cry                |
| defense_turret_mk3   | 50      | —         | —     | —                      | 4000 CR, 200 Ore, 60 Cry                |
| station_shield_mk1   | —       | 150       | 10    | —                      | 1000 CR, 50 Cry                          |
| station_shield_mk2   | —       | 350       | 25    | —                      | 3000 CR, 100 Cry, 30 Gas                |
| ion_cannon            | 80      | —         | —     | 1×/Kampf, ignoriert Schilde | 8000 CR, 300 Ore, 100 Cry, 50 Gas  |

### Station-Kampf-Parameter

| Parameter           | Wert                          |
|---------------------|-------------------------------|
| Basis-HP            | 500                           |
| Reparatur-Kosten    | 5 CR/HP + 1 Ore/HP            |
| Max. Runden         | 10                            |

---

## 11. Strukturen (Basisbau)

### Baukosten

| Struktur       | AP   | Ore | Gas | Crystal | Funktion                                |
|----------------|------|-----|-----|---------|----------------------------------------|
| comm_relay     | 5 AP | 5   | 0   | 2       | Kommunikations-Reichweite +500          |
| mining_station | 15 AP| 30  | 15  | 10      | Automatisches Mining am Sektor          |
| base           | 25 AP| 50  | 30  | 25      | Heimatbasis-Erweiterung (+1000 Komm)    |
| storage        | 10 AP| 20  | 10  | 5       | Storage-Gebaeude (Tier 1–3)             |
| trading_post   | 15 AP| 30  | 20  | 15      | Handelsposten (Tier 1–3)               |
| defense_turret | 20 AP| 40  | 10  | 20      | Geschuetzturm-Plattform                 |
| station_shield | 20 AP| 30  | 25  | 30      | Schild-Generator-Plattform              |
| ion_cannon     | 25 AP| 60  | 30  | 40      | Ionenkanone-Plattform                   |
| factory        | 20 AP| 40  | 20  | 15      | Produktionsanlage                       |
| research_lab   | 25 AP| 30  | 25  | 30      | Forschungslabor                         |
| kontor         | 15 AP| 20  | 10  | 10      | Einkaufskontor (Kaufauftraege)          |

### Progressive Basisbauphasen

Baustellen verarbeiten Ressourcen mit einer Geschwindigkeit von **1 Ressource pro 2 Sekunden** (lazy evaluation).
Basis benoetigt **60 Ressourcen** zum Abschluss (Standard).

### Storage-Tiers

| Tier | Kapazitaet | Upgrade-Kosten |
|------|-----------|----------------|
| 1    | 50        | gratis         |
| 2    | 150       | 200 CR         |
| 3    | 500       | 1000 CR        |

### Trading-Post-Tiers

| Tier | Name           | Upgrade-Kosten |
|------|----------------|----------------|
| 1    | NPC TRADE      | gratis         |
| 2    | MARKTPLATZ     | 500 CR         |
| 3    | AUTO-TRADE     | 3000 CR        |

---

## 12. Factory & Produktion

Die Factory verarbeitet Basisressourcen (Ore, Gas, Crystal) aus dem Storage zu verarbeiteten Guetern.

### Produktionsrezepte

| Rezept-ID        | Output           | Inputs                  | Zykluszeit | Research-Gate       |
|------------------|------------------|-------------------------|-----------|---------------------|
| fuel_cell_basic  | 1× Fuel Cell     | 2 Ore, 3 Gas            | 120s      | —                   |
| alloy_plate_basic| 1× Alloy Plate   | 3 Ore, 1 Crystal        | 180s      | —                   |
| circuit_board_t1 | 1× Circuit Board | 2 Crystal, 2 Gas        | 240s      | circuit_board_t1    |
| void_shard_t1    | 1× Void Shard    | 3 Crystal, 2 Ore        | 300s      | void_shard_t1       |
| bio_extract_t1   | 1× Bio Extract   | 4 Gas, 1 Crystal        | 360s      | bio_extract_t1      |

### Funktionsweise

- Factory bezieht Ressourcen automatisch aus dem angeschlossenen **Storage**
- Produktion laeuft als **Lazy Evaluation** (kein Tick-Loop)
- Fertige Produkte lagern im Factory-internen Inventar
- Transfer zum Spieler-Cargo manuell
- Rezepte mit `researchRequired` muessen vorher im Research Lab erforscht werden

---

## 13. Kontor (Einkaufskontor)

Das Kontor ermoeglicht **Kaufauftraege** (Buy Orders) an Spieler-Basen:

### Mechanik

- Spieler erstellt Kaufauftrag: Item-Typ, Menge, Preis/Einheit
- **Budget-Reservierung:** Credits werden bei Auftrags-Erstellung abgezogen
- Andere Spieler koennen Auftraege mit Cargo befuellen und Credits erhalten
- Stornierung: Nicht befuellte Menge wird als Credits zurueckerstattet
- Selbstbefuellung ist nicht erlaubt

### Auftrags-Felder

| Feld           | Beschreibung                          |
|----------------|--------------------------------------|
| itemType       | Ressource/Item-Typ                    |
| amountWanted   | Gewuenschte Menge                     |
| amountFilled   | Bereits gelieferte Menge              |
| pricePerUnit   | Preis pro Einheit (in Credits)        |
| budgetReserved | Reserviertes Budget (Menge × Preis)   |
| expiresAt      | Ablaufdatum (optional, aktuell null)  |

---

## 14. NPC-Fraktionen & Reputation

### Fraktionen

| ID           | Gewicht | Beschreibung                          |
|--------------|---------|---------------------------------------|
| independent  | 30 %    | Freie Haendler, keine Bindung         |
| traders      | 28 %    | Handelsfokus, kaufen/verkaufen viel   |
| scientists   | 25 %    | Forschung, Scanner-Upgrades           |
| pirates      | 16 %    | Feindlich, aber mit Verhandlungsbonus |
| ancients     | 1 %     | Extrem selten, Void-Technologie       |

### Reputations-Tiers

| Tier        | Bereich       | Preismodifikator | Beschreibung              |
|-------------|---------------|------------------|---------------------------|
| hostile     | -100 .. -51   | +50 %            | Angriff on sight          |
| unfriendly  | -50 .. -1     | +0 %             | Misstrauisch              |
| neutral     | 0             | +0 %             | Standard                  |
| friendly    | +1 .. +50     | -10 %            | Rabatt                    |
| honored     | +51 .. +100   | -25 %            | Max. Rabatt + Upgrade-Zugang |

### Fraktions-Upgrades (bei `honored`)

| ID                | Fraktion     | Effekt                          |
|-------------------|--------------|---------------------------------|
| cargo_expansion   | traders      | +3 Ladekapazitaet               |
| advanced_scanner  | scientists   | +1 Area-Scan-Radius             |
| combat_plating    | pirates      | +20 % Kampfbonus                |
| void_drive        | ancients     | -1 AP pro Bewegung              |

### Spieler-Fraktions-Upgrade-Baum (3 Tiers)

| Tier | Option A           | Option B             | Kosten    |
|------|--------------------|----------------------|-----------|
| 1    | MINING BOOST +15%  | CARGO EXPANSION +3   | 500 CR    |
| 2    | SCAN RANGE +1      | AP REGEN +20%        | 1500 CR   |
| 3    | COMBAT BONUS +15%  | TRADE DISCOUNT -10%  | 5000 CR   |

---

## 15. NPC-Stationslevel

Stationen haben ein dynamisches Level-System basierend auf Spieler-Interaktion.

### Level-Stufen

| Level | Name        | Max Stock | XP-Schwelle |
|-------|-------------|-----------|-------------|
| 1     | Outpost     | 200       | 0           |
| 2     | Station     | 500       | 500         |
| 3     | Hub         | 1.200     | 2.000       |
| 4     | Port        | 3.000     | 6.000       |
| 5     | Megastation | 8.000     | 15.000      |

### XP-Quellen

| Aktion              | XP                |
|---------------------|-------------------|
| Besuch (visit)      | +5 XP             |
| Handel (pro Einheit)| +1 XP             |
| Quest-Abschluss     | +15 XP            |
| XP-Zerfall          | -1 XP/Stunde      |

XP faellt nie unter die Schwelle des aktuellen Levels (kein Abstieg).

### Dynamische Preisgestaltung

Preis haengt vom Fuellstand ab:
- 100% Stock → 1× Basispreis
- 0% Stock → 2× Basispreis
- Formel: `Math.round(basePrice * (2 - stockRatio))`

### Inventar-Dynamik

- Restock-Rate: 2% des Max-Stocks pro Stunde
- Verbrauchsrate: 1.5% des Max-Stocks pro Stunde
- Start-Fuellstand: 50-80% (deterministisch aus Seed)

---

## 16. Data Slates

Data Slates sind handelbare Kartenausschnitte.

### Slate-Typen

| Typ    | AP-Kosten | Beschreibung                         |
|--------|----------|--------------------------------------|
| sector | 1 AP     | Einzelsektor-Kartendaten              |
| area   | 3 AP     | Flaechenscan (Radius 2-4, abh. von Scanner-Level) |
| custom | 2 AP     | Benutzerdefiniert (Koordinaten, Codes, Notizen) |

### Area-Scan-Radius (Slate)

| Scanner-Level | Radius |
|---------------|--------|
| 1             | 2      |
| 2             | 3      |
| 3             | 4      |

### NPC-Rueckkauf

Stationen kaufen Slates zurueck: **5 CR pro enthaltenem Sektor** (`SLATE_NPC_PRICE_PER_SECTOR`).

### Custom Slates

| Parameter         | Wert              |
|-------------------|--------------------|
| AP-Kosten         | 2                  |
| Credit-Kosten     | 5 CR               |
| Max. Koordinaten  | 20                 |
| Max. Codes        | 10                 |
| Max. Notizlaenge  | 500 Zeichen        |

---

## 17. Kampfsystem (Legacy/Auto-Battle)

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Basis-Piraten-HP       | 20 + 10× Level                 |
| Basis-Schaden          | 5 + 3× Level                   |
| Piraten-Level          | floor(distanz / 50), max 10    |
| Fliehen-Chance         | 60 % Basis                     |
| Fliehen-AP-Kosten      | 2 AP                           |
| Verhandeln-Kosten      | 10 CR × Piraten-Level          |
| Cargo-Verlust bei Niederlage | 25–50 % des Cargos      |

---

## 18. Quests

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Max. aktive Quests     | 3                               |
| Quest-Ablauf           | 7 Tage                         |
| Quest-Typen            | fetch, delivery, scan, bounty  |
| Quest-Rotation         | taeglich (stationsabhaengig)    |
| Scan-Ereignis-Chance   | 15 % pro Scan                  |

### Scan-Event-Typen

| Event-Typ       | Beschreibung                    |
|------------------|---------------------------------|
| pirate_ambush    | Piraten-Ueberfall               |
| distress_signal  | Notsignal (Rettungsmission)     |
| anomaly_reading  | Anomalie-Messung (+Artefakt)    |
| artifact_find    | Artefaktfund (50% Chance)       |
| blueprint_find   | Bauplan-Fund                    |

---

## 19. Treibstoffsystem

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Kosten pro Einheit     | 2 CR/u (`FUEL_COST_PER_UNIT`)  |
| Gratis-Betankung       | bis 3 Schiffe an Heimatbasis    |
| Reputations-Rabatt     | honored: 25 %, friendly: 10 %  |

---

## 20. XP & Level-System

| Level | XP-Schwelle | Freischaltungen                          |
|-------|-------------|------------------------------------------|
| 1     | 0           | VOID SCOUT (gratis)                      |
| 2     | 100         | —                                        |
| 3     | 300         | VOID FREIGHTER (500 CR)                  |
| 4     | 600         | VOID CRUISER (1000 CR)                   |
| 5     | 1000        | VOID EXPLORER (2000 CR)                  |
| 6     | 1500        | VOID BATTLESHIP (3000 CR)                |
| 7     | 2200        | —                                        |
| 8     | 3000        | —                                        |
| 9     | 4000        | —                                        |
| 10    | 5000        | Max Level                                |

---

## 20a. ACEP — Adaptive Craft Evolution Protocol

ACEP ist das Schiffsprogression-System von voidSector. Ein Schiff entwickelt sich durch gelebte Erfahrung — nicht durch manuelle Punktverteilung. Es lernt durch das, was der Pilot tut.

> **Was ACEP ist:** Ein bleibendes Erfahrungsgedächtnis des Schiffs. Unsichtbar im Hintergrund, spürbar in jedem Moment.
>
> **Was ACEP nicht ist:** Kein Talent-Baum. Kein Skill-System. Kein Gacha. Kein manuelles Leveln. Das Schiff lernt alleine.

### Grundprinzip

```
Punkte-Budget: 100 XP total
Max pro Pfad:   50 XP
→ Volle Spezialisierung ist möglich — aber nicht in allem gleichzeitig.
```

XP kommt **emergent durch Aktionen**. Wer kämpft, wird ein Kampfschiff. Wer scannt, wird ein Aufklärungsschiff. Wer baut und Fracht transportiert, wird ein Versorgungsschiff. Der Pilot entscheidet durch sein Verhalten — nicht durch ein Menü.

---

### Die 4 Entwicklungspfade

#### AUSBAU — Logistik & Konstruktion

*"Mehr Raum. Mehr Kapazität. Mehr Möglichkeiten."*

**XP-Quellen (implementiert):**

| Aktion | XP |
|--------|-----|
| Ressourcen abbauen (Mining-Tick) | +2 XP |
| Station bauen | +10 XP |
| Basis bauen | +10 XP |

**Effekte:**

| XP | Effekt |
|----|--------|
| ≥ 10 | +1 extra Modul-Slot |
| ≥ 25 | +2 extra Modul-Slots |
| ≥ 40 | +3 extra Modul-Slots |
| ≥ 50 | +4 extra Modul-Slots (Maximum) |
| linear | Cargo-Multiplikator: 1.0 + XP × 0.01 (max +50 % bei 50 XP) |
| linear | Mining-Bonus: XP × 0.006 (max +30 % bei 50 XP) |

---

#### INTEL — Aufklärung & Navigation

*"Daten sind Macht. Das Schiff denkt mit."*

**XP-Quellen (implementiert):**

| Aktion | XP |
|--------|-----|
| Sektor scannen | +3 XP |
| Neuen Quadranten entdecken | +20 XP |
| Ancient-Anomalie scannen (intern) | variabel |

**Effekte:**

| XP | Effekt |
|----|--------|
| ≥ 20 | +1 Scan-Radius |
| ≥ 40 | +2 Scan-Radius |
| ≥ 50 | +3 Scan-Radius |
| linear | Staleness-Multiplikator: 1.0 + XP × 0.02 (Sektoren bleiben bis zu 2× länger frisch) |

---

#### KAMPF — Gefechtserprobung

*"Das Schiff kennt seine Feinde. Es lernt aus jedem Treffer."*

**XP-Quellen (implementiert):**

| Aktion | XP |
|--------|-----|
| Pirat besiegt | +5 XP |
| Kampf gewonnen | +5 XP |
| Territorial-Angriff | +2–5 XP |

**Effekte:**

| XP | Effekt |
|----|--------|
| linear | Schaden-Bonus: XP × 0.004 auf `combatMultiplier` (max +20 % bei 50 XP) |
| linear | Schild-Regen-Bonus: XP × 0.006 (max +30 % bei 50 XP) |

---

#### EXPLORER — Entdeckung & Erforschung

*"Das Schiff spürt das Unbekannte. Es zieht es an."*

**XP-Quellen (implementiert):**

| Aktion | XP |
|--------|-----|
| Neuen Sektor entdecken (Navigation) | +2 XP |
| Ancient-Ruine scannen | +15 XP |

**Effekte:**

| XP | Effekt |
|----|--------|
| ≥ 25 | Ancient-Ruinen auf Radar sichtbar |
| ≥ 50 | Helion-Decoder aktiv (kein Modul nötig) |
| linear | Anomalie-Chance-Bonus: XP × 0.002 (max +10 % bei 50 XP) |

---

### Trait-System

Traits entstehen **automatisch** aus der XP-Verteilung. Ein Schiff kann mehrere Traits gleichzeitig tragen.

| Trait | Auslöser | Bedeutung |
|-------|----------|-----------|
| `veteran` | kampf ≥ 20 | Kampferprobt |
| `curious` | intel ≥ 20 | Unersättlich neugierig |
| `ancient-touched` | explorer ≥ 15 | Hat Altes berührt |
| `reckless` | kampf ≥ 15 & ausbau ≤ 5 | Kämpfer, ignoriert Logistik |
| `cautious` | ausbau ≥ 20 & kampf ≤ 5 | Baumeister, meidet Konflikte |
| `scarred` | kampf ≥ 10 & (rest ≤ 40 % von kampf) | Tunnelvision-Kämpfer |

Dominanz-Priorität für Persönlichkeitsauswahl: `ancient-touched` > `veteran` > `scarred` > `reckless` > `cautious` > `curious`

---

### Persönlichkeitssystem

Schiffe kommentieren Situationen basierend auf ihren Traits. Ton und Charakter ändern sich mit der Erfahrung.

| Schiffstyp | Scan-Kommentar |
|------------|----------------|
| Junges Schiff | *(schweigt)* |
| Veteran | `SYSTEM: Scan nominal. Wir haben schlimmeres gesehen.` |
| Curious | `SYSTEM: Interessante Energiemuster. Weitere Daten erforderlich.` |
| Ancient-touched | `SYSTEM: Diese Leere... wir waren schon hier. In einer anderen Form.` |
| Reckless | `SYSTEM: Scan durch. Kein Kontakt. Schade.` |

Kontexte: `scan`, `scan_ruin`, `combat_victory`, `combat_defeat`, `mine`, `build`

---

### Radar-Icon-Evolution

Ab XP ≥ 20 total überschreibt das ACEP-System das Hull-Standard-Radar-Icon.

| Tier | XP-Gesamt | Beschreibung |
|------|-----------|-------------|
| 1 | 0–24 | Hull-Standard-Icon |
| 2 | 25–49 | Pfad-beeinflusste Variante |
| 3 | 50–74 | Ausgeprägter Charakter |
| 4 | ≥ 75 | Vollständige ACEP-Form |

Das dominante Icon-Muster wird durch den dominantesten XP-Pfad bestimmt (Ausbau=breit, Intel=schmal, Kampf=spitz, Explorer=asymmetrisch).

---

### DIFF: Konzept vs. Implementierung (Stand 2026-03-10)

| Bereich | Konzept | Implementiert | Status |
|---------|---------|---------------|--------|
| XP-Budget (100 total / 50 pro Pfad) | ✅ | ✅ | OK |
| AUSBAU: Extra Slots (bis +4) | ✅ | ✅ | OK |
| AUSBAU: Cargo-Multiplikator | ✅ | ✅ | OK |
| AUSBAU: Mining-Bonus | ✅ | ✅ | OK |
| AUSBAU: Schiff nimmt größere Form an (visuell) | ✅ | ❌ | **Offen** |
| AUSBAU: XP für Bulk-Verkäufe (+2) | ✅ | ❌ | Nicht umgesetzt |
| INTEL: Scan-Radius-Bonus | ✅ | ✅ | OK |
| INTEL: Staleness-Multiplikator | ✅ | ✅ | OK |
| INTEL: Autopilot-Qualität | ✅ | ❌ | **Offen** |
| INTEL: Axiom-Puzzle-Erleichterung | ✅ | ❌ | Kein Puzzle-System |
| KAMPF: Schaden-Bonus | ✅ | ✅ | OK |
| KAMPF: Schild-Regen-Bonus | ✅ | ✅ | OK |
| KAMPF: Waffen feuern schneller | ✅ | ❌ | **Offen** |
| KAMPF: K'thari-Rang-Voraussetzungen reduziert | ✅ | ❌ | Kein K'thari-System |
| KAMPF: XP für Konvoi-Schutz (+15) | ✅ | ❌ | Kein Konvoi-System |
| EXPLORER: Ancient-Detection auf Radar | ✅ | ✅ | OK |
| EXPLORER: Helion-Decoder ohne Modul | ✅ | ✅ | OK |
| EXPLORER: Anomalie-Chance-Bonus | ✅ | ✅ | OK |
| EXPLORER: Infiltrations-Module effizienter | ✅ | ❌ | Kein Silent-Swarm |
| Traits: 6 Typen | ✅ | ✅ | OK (Auslöser vereinfacht: XP statt Event-Zähler) |
| Persönlichkeitsmeldungen | ✅ | ✅ | OK |
| Radar-Icon-Evolution (4 Tiers) | ✅ | ✅ | OK (alle 3×3, keine Icon-Größen-Skalierung) |
| Permadeath + Legacy (30 % XP-Vererbung) | ✅ | ✅ | OK |
| Wrack-POIs auf Radar | ✅ | ❌ | **Offen** |
| Heraldik-Editor | ✅ | ❌ | Deferred |
| UI-Panel (ACEP-Tab im HANGAR) | ✅ | Teilweise | ShipStatusPanel zeigt Bars, kein dedizierter ACEP-Tab |

**Legende:** ✅ = im Konzept vorgesehen | ❌ = noch nicht implementiert

---

## 21. Kommunikation & Comms-Reichweite

| Schiff        | Basis CommRange | Mit SCN MK.I | Mit SCN MK.II | Mit SCN MK.III |
|---------------|-----------------|--------------|---------------|----------------|
| scout         | 50              | 100          | 150           | 250            |
| freighter     | 75              | 125          | 175           | 275            |
| cruiser       | 100             | 150          | 200           | 300            |
| explorer      | 150             | 200          | 250           | 350            |
| battleship    | 75              | 125          | 175           | 275            |

Relay-Reichweiten: `comm_relay` +500, `base` +1000.

### Chat-Kanaele

| Kanal   | Beschreibung                            |
|---------|-----------------------------------------|
| direct  | Direktnachricht an einen Spieler        |
| faction | Fraktions-Chat                          |
| local   | Lokaler Sektor-Chat                     |

---

## 22. JumpGate-System

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Spawn-Chance           | 2% der Sektoren                 |
| Fuel-Kosten            | 1 Einheit                       |
| Reichweite             | 50 – 10.000 Sektoren           |
| Code-Laenge            | 8 Zeichen                       |
| Minigame-Chance        | 30%                             |
| Code-Chance            | 50%                             |
| Frequenz-Schwelle      | 90% Uebereinstimmung            |

- **Normale Gates:** Bidirektional zwischen zwei Sektoren
- **Wormholes:** Zufaelliger Zielsektor (unbekannt bis Scan)
- **Frequenz-Minigame:** Kalibrierung fuer guenstigere Spruenge
- **HYPERJUMP:** Direktsprung zu entfernten Sektoren

### Hyperjump-Kosten

| Parameter           | Wert                              |
|---------------------|----------------------------------|
| Basis-AP            | 5                                 |
| AP pro Speed-Stufe  | -1 AP                             |
| Minimum-AP          | 1                                 |
| Fuel-Distanz-Faktor | 0.1                               |
| Fuel-Max-Faktor     | 2.0                               |
| Piraten-Fuel-Malus  | +50%                              |

---

## 23. Rettungsmissionen

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Rettungs-AP            | 5 AP                            |
| Ablieferungs-AP        | 3 AP                            |
| Ablauf                 | 30 Minuten                      |
| Notsignal-Chance       | 8% pro Scan                     |
| Richtungs-Varianz      | 0.3                             |

### Belohnungen

| Quelle              | Credits | Rep  | XP  |
|---------------------|---------|------|-----|
| Scan-Event          | 50      | 10   | 25  |
| NPC-Quest           | 80      | 15   | 40  |
| Komm-Notsignal      | 100     | 20   | 50  |

---

## 24. Handelsrouten

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Max. Routen            | 3                               |
| Min. Zykluszeit        | 15 Minuten                      |
| Max. Zykluszeit        | 120 Minuten                     |
| Fuel pro Distanz       | 0.5                             |

---

## 25. Bookmarks

| Slot | Name | Beschreibung                        |
|------|------|-------------------------------------|
| 0    | HOME | Heimatbasis (automatisch)          |
| 1–5  | —    | Benutzerdefinierte Wegpunkte        |
| 6    | SHIP | Aktuelle Schiffsposition (auto)     |

Farben im Radar:
- HOME: `#33FF33`
- Slot 1: `#FF6644` (rot-orange)
- Slot 2: `#44AAFF` (blau)
- Slot 3: `#FFDD22` (gelb)
- Slot 4: `#44FF88` (gruen)
- Slot 5: `#FF44FF` (magenta)

---

## 26. Admin-Konsole

REST-API unter `/admin/` mit Bearer-Token-Authentifizierung (`ADMIN_TOKEN`).

### Endpunkte

| Methode | Pfad                    | Beschreibung                         |
|---------|------------------------|--------------------------------------|
| GET     | /admin/players          | Alle Spieler auflisten               |
| GET     | /admin/players/:id      | Einzelnen Spieler abrufen            |
| POST    | /admin/quests           | Admin-Quest erstellen (JSON/YAML)    |
| GET     | /admin/quests           | Quests auflisten (Filter: status)    |
| GET     | /admin/quests/:id       | Einzelne Quest abrufen               |
| PATCH   | /admin/quests/:id       | Quest-Status aendern                 |
| POST    | /admin/messages         | Broadcast-Nachricht senden           |
| GET     | /admin/messages         | Nachrichten auflisten (limit)        |
| GET     | /admin/messages/:id/replies | Antworten auf Nachricht abrufen  |
| GET     | /admin/events           | Event-Log abrufen (limit)            |
| GET     | /admin/stats            | Server-Statistiken                   |

### Admin-Quest-Scopes

| Scope       | Beschreibung                          |
|-------------|---------------------------------------|
| universal   | Fuer alle Spieler sichtbar            |
| individual  | Nur fuer bestimmte Spieler (targetPlayers) |
| sector      | An einen bestimmten Sektor gebunden   |

### Admin-Broadcast

Nachrichten werden ueber einen internen EventBus (`adminBus`) an alle aktiven SectorRoom-Instanzen gesendet. Unterstuetzte Scopes: `universal` und `individual`.

### Admin-HTML-Konsole

Unter `/admin/console.html` liegt eine CRT-stilisierte Web-Oberflaeche mit Scanline-Overlay fuer die direkte Admin-Steuerung.

---

## 27. Monitorsystem

Das UI besteht aus mehreren Monitoren im CRT-Stil:

| Monitor-ID | Beschreibung                          |
|------------|---------------------------------------|
| NAV-COM    | Radar + Navigation (Haupt-Monitor)    |
| SHIP-SYS   | Schiffssystem-Uebersicht              |
| MINING     | Mining-Steuerung                      |
| CARGO      | Fracht- und Inventarverwaltung        |
| COMMS      | Kommunikation                         |
| BASE-LINK  | Basisbau und -verwaltung              |
| LOG        | Aktivitaetsprotokoll                  |
| TRADE      | Handel (NPC + Marktplatz)             |
| FACTION    | Fraktionsverwaltung                   |
| QUESTS     | Quest-Uebersicht                      |
| TECH       | Forschungsbaum und Module             |
| QUAD-MAP   | Quadranten-Karte                      |

---

## 28. Notwarp (Emergency Warp)

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Gratis-Radius          | 200 Manhattan-Distanz zur Basis |
| Kosten ausserhalb      | 5 CR/Sektor                     |
| Fuel-Bonus nach Warp   | 10 Einheiten                    |

---

## 29. Balancing-Notizen & TODOs

### Bekannte Schwaechen

- `fuelPerJump` ist aktuell in HULLS konfiguriert (1-3), aber die SHIP_CLASSES (Legacy) nutzen andere Werte
- `safeSlots` hardcoded auf 1 (wird jetzt durch safeSlotBonus-Module erweitert)
- Spawn-Chance near origin gering (kein Guard fuer Ursprungsbereich)
- UNIQUE constraint fuer Strukturen wirft DB-Fehler statt saubere Fehlermeldung

### Geplante Erweiterungen

- **Nebel-System (#61):** Multi-Sektor-Nebel, Scan-Stoerung, Jump-Einschraenkungen
- **Alien-Artwork (#60):** ASCII-Art fuer Ancient-NPC-Begegnungen
- **Item-Artwork (#62):** Verbesserte ASCII-Art fuer Items in Inventar/Trade
- **Mobile (#49):** Touch-freundlichere UI (siehe UX-Report unten)
- **Gastautorisierung (#31):** 24h-Gastzugaenge ohne Registration

### Balancing-Prioritaeten

1. **Treibstoff-Kosten** bei langen Reisen zu niedrig (battleship fuelPerJump=3 aber kurze Reichweite)
2. **Kristall ausgewogener** — Anomalien jetzt 8% statt frueher 0.36%, Armor dennoch teuer
3. **Fraktions-Upgrade "void_drive"** sehr maechtig (-1 AP/Move, +6 Jump, +5 Speed, -3 Fuel/Jump)
4. **Piratenlevel** ab Distanz 500 = Level 10 Piraten → sehr frueh Maximum erreicht
5. **NPC-Station-Zerfall** (1 XP/h) unkritisch — aktive Stationen steigen schnell

---

## 30. UX-Report: Bekannte Inkonsistenzen

### Sprachmischung DE/EN

Die Codebasis mischt durchgehend deutsche und englische Begriffe:

- **Modul-Labels in constants.ts**: Deutsche Beschreibungen (`Sprungweite`, `Frachtraum`, `Schadensreduktion`, `Panzerbrechend`, `Komm-Reichweite`, `Artefakt-Chance`) gemischt mit englischen Begriffen (`Engine-Speed`, `Safe-Slot`, `Fuel-Tank`, `ATK`, `EMP`, `HP`)
- **UI-Strings**: Monitornamen sind englisch (`NAV-COM`, `SHIP-SYS`, `TRADE`), waehrend Ingame-Texte teilweise deutsch sind (`MARKTPLATZ`, `AUTO-TRADE`)
- **Struktur-Namen**: `kontor` (Deutsch), `comm_relay` / `mining_station` / `trading_post` (Englisch)
- **NPC-Stationslevel**: Englische Namen (`Outpost`, `Station`, `Hub`, `Port`, `Megastation`)
- **Fraktions-Upgrade-Baum**: Komplett englische Option-Namen (`MINING BOOST`, `CARGO EXPANSION`, `SCAN RANGE`)

**Empfehlung:** Einheitliche Sprache fuer alle spieler-sichtbaren Texte festlegen. Vorschlag: Englisch als Spielsprache (passt zum Sci-Fi-Setting), Deutsch nur fuer Kompendium/Doku.

### Bezel-Asymmetrie: Sidebar vs. Main Monitor

- **MonitorBezel** (Haupt-Monitor): Vollstaendiger Rahmen mit Knobs (Helligkeit, Zoom), Legend-Overlay, BookmarkBar, Power-Button, Nebula-Noise-Effekt
- **SidebarBezel**: Minimaler Rahmen mit vertikalem Label, LED-Dots, Alert-State, aber **keine Knobs, kein Power-Button, kein Legend-Overlay**
- Die beiden Bezel-Komponenten teilen keinen gemeinsamen Code → Duplikation und inkonsistente Aesthetik
- Sidebar-LEDs nutzen `minWidth: 20` + `fontSize: 0.45rem` (Inline-Styles), Main-Bezel nutzt CSS-Klassen

**Empfehlung:** Unified-Bezel-Komponente (#93) mit konfigurierbarer Komplexitaet (minimal/standard/full).

### Fehlende Mobile-Screens

Die Mobile-Tab-Leiste (`MOBILE_TABS` in `GameScreen.tsx`) enthaelt aktuell **8 Tabs**:

```
NAV, SHIP, MINE, CARGO, COMMS, BASE, TECH, QUAD
```

**Fehlende Monitore auf Mobile:**
- **TRADE** — Kein mobiler Zugang zu NPC-Handel und Marktplatz
- **FACTION** — Keine Fraktionsverwaltung auf Mobile
- **QUESTS** — Keine Quest-Uebersicht auf Mobile
- **LOG** — Kein Aktivitaetslog auf Mobile

**Empfehlung:** Context-Aware Mobile Tabs (#49, #20) mit dynamischer Tab-Leiste basierend auf aktuellem Kontext (z.B. TRADE erscheint automatisch an Stationen, QUESTS bei aktiven Quests).

### Sonstige UI-Inkonsistenzen

- **FrequencyMinigame**: Nutzt Mouse-Events, Touch-Events fehlen (#22)
- **Mobile Zoom**: Kein Pinch-to-Zoom auf dem Radar implementiert (#21)
- **Bezel auf Mobile**: Knobs und dekorative Elemente nehmen zu viel Platz ein (#23)

---

*Dieses Dokument wird bei groesseren Inhalts-Updates aktualisiert.*
