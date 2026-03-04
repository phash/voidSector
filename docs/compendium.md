# voidSector — Spielkompendium

> **Stand:** 2026-03-04 | Basis: feat/nav-grid-overhaul + Sprints A–C
>
> Diese Datei dient als Referenz für Balancing, Spieldesign und zukünftige Inhaltserweiterungen.

---

## 1. Universum & Weltgenerierung

### Koordinatensystem

Das Universum ist ein unendliches 2D-Gitter. Koordinaten werden zweistellig dargestellt:

```
[QUAD:INNER]  →  z.B. [03E8:0042]
```

- **QUAD** (hex): `Math.floor(x / 10_000)` — Quadrant im Universum
- **INNER** (dez): `x % 10_000` — Lokale Position im Quadranten
- Spieler spawnen in **Clustern** ab Distanz `10_000_000` vom Ursprung

### Weltseed

```ts
WORLD_SEED = 42
```

Alle Sektoren werden deterministisch aus `hashCoords(x, y, WORLD_SEED)` generiert. Gleicher Seed → gleiche Karte.

### Sektor-Dichte (2 % non-leer)

| Sektortyp       | Gewicht | Anteil   |
|-----------------|---------|----------|
| empty           | 0.98    | ~98 %    |
| asteroid_field  | 0.0067  | ~0.67 %  |
| nebula          | 0.0044  | ~0.44 %  |
| anomaly         | 0.0036  | ~0.36 %  |
| pirate          | 0.0031  | ~0.31 %  |
| station         | 0.0022  | ~0.22 %  |

---

## 2. Sektortypen

### `empty` — Leerer Sektor
- **Farbe:** Amber `#FFB000`
- **Ressourcen:** Ore 5, Gas 5, Crystal 5 (sehr gering)
- **Symbol:** `·`
- **Besonderheiten:** Keine

### `asteroid_field` — Asteroidenfeld
- **Farbe:** Orange `#FF8C00`
- **Ressourcen:** Ore 20, Gas 2, Crystal 3
- **Symbol:** `▓`
- **Besonderheiten:** Primäre Erz-Quelle. Scan-Ereignisse möglich.

### `nebula` — Nebel
- **Farbe:** Blau `#00BFFF`
- **Ressourcen:** Ore 2, Gas 20, Crystal 3
- **Symbol:** `▒`
- **Besonderheiten:** Primäre Gas-Quelle. Komm-Störung in Plänen (#65).

### `station` — Raumstation
- **Farbe:** Grün `#00FF88`
- **Ressourcen:** Keine (Handelsposten)
- **Symbol:** `△`
- **Besonderheiten:** NPC-Handel, Reparatur, Schiffs-Upgrades, Überlebende abliefern.
  Station-Namen sind deterministisch aus Koordinaten generiert.

### `anomaly` — Anomalie
- **Farbe:** Magenta `#FF00FF`
- **Ressourcen:** Ore 3, Gas 3, Crystal 20
- **Symbol:** `◇`
- **Besonderheiten:** Primäre Kristall-Quelle. Hohe XP-Boni. Seltene Scan-Ereignisse.

### `pirate` — Piraten-Sektor
- **Farbe:** Rot `#FF3333`
- **Ressourcen:** Ore 8, Gas 3, Crystal 8
- **Symbol:** `☠`
- **Besonderheiten:** Automatischer Kampf beim Betreten. Piraten-Level skaliert mit Distanz vom Ursprung.

### `home_base` — Heimatbasis (Spezial)
- **Farbe:** Weiß `#FFFFFF`
- **Symbol:** `⌂`
- **Besonderheiten:** Einmaliger Sektor pro Spieler. Gratis-Betankung (bis 3 Schiffe), Storage, Construction.

---

## 3. Ressourcen

| Ressource | Symbol | Primärquelle     | NPC-Basispreis | Mining-Rate |
|-----------|--------|------------------|----------------|-------------|
| Ore       | ⛏      | asteroid_field   | 10 CR/u        | 0.1 u/s     |
| Gas       | ♦      | nebula           | 15 CR/u        | 0.1 u/s     |
| Crystal   | ◈      | anomaly          | 25 CR/u        | 0.1 u/s     |

**NPC-Kauf-Spread:** +20 % (Stationen kaufen billiger)
**NPC-Verkauf-Spread:** -20 % (Stationen verkaufen teurer)

---

## 4. Aktionspunkte (AP)

| Parameter       | Wert            |
|-----------------|-----------------|
| Max AP          | 100             |
| Start AP        | 100             |
| Regen           | 0.5 AP/s (1 AP alle 2s) |
| Jump-Kosten     | 1–2 AP/Sprung (hull-abhängig) |
| Scan            | 3 AP (lokal: 1 AP) |
| Area-Scan       | 3–8 AP (scanner-abhängig) |

### Scanner-Level & Area-Scan

| Level | AP-Kosten | Radius |
|-------|-----------|--------|
| 1     | 3 AP      | 2      |
| 2     | 5 AP      | 3      |
| 3     | 8 AP      | 5      |

---

## 5. Raumschiffe

### Hülltypen

| Hull       | Name             | Größe  | Slots | Fuel | Cargo | Jump | AP/J | Fuel/J | HP  | Scanner | CommRange | Unlock    |
|------------|------------------|--------|-------|------|-------|------|------|--------|-----|---------|-----------|-----------|
| scout      | VOID SCOUT       | small  | 3     | 80   | 3     | 5    | 1    | 1      | 50  | 1       | 50        | Level 1 / gratis |
| freighter  | VOID FREIGHTER   | medium | 4     | 120  | 15    | 3    | 2    | 2      | 80  | 1       | 75        | Level 3 / 500 CR |
| cruiser    | VOID CRUISER     | medium | 4     | 150  | 8     | 4    | 1    | 1      | 100 | 1       | 100       | Level 4 / 1000 CR |
| explorer   | VOID EXPLORER    | large  | 5     | 200  | 10    | 6    | 1    | 1      | 70  | 2       | 150       | Level 5 / 2000 CR |
| battleship | VOID BATTLESHIP  | large  | 5     | 180  | 5     | 2    | 2    | 3      | 150 | 1       | 75        | Level 6 / 3000 CR |

**Empfehlung Balancing:**
- Scout: Schnell, wenig Cargo — Erstkontakt-Schiff ✓
- Freighter: Träge aber maximales Cargo — Handelsspezialist ✓
- Cruiser: Ausgeglichen — Kampf + Exploration ✓
- Explorer: Maximale Reichweite + Scanfelder — Kartograf ✓
- Battleship: Maximale HP, kurze Reichweite — Tank/Veteran ✓

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

## 6. Schiffsmodule

### Drive — Antriebssysteme

| ID          | Name              | Tier | Effekte                     | Kosten                  |
|-------------|-------------------|------|-----------------------------|-------------------------|
| drive_mk1   | ION DRIVE MK.I    | 1    | +1 jumpRange                | 100 CR, 10 Ore          |
| drive_mk2   | ION DRIVE MK.II   | 2    | +2 jumpRange, -0.2 AP/Jump  | 300 CR, 20 Ore, 5 Cry   |
| drive_mk3   | ION DRIVE MK.III  | 3    | +3 jumpRange, -0.5 AP/Jump  | 800 CR, 40 Ore, 15 Cry  |

### Cargo — Lagerkapazität

| ID          | Name              | Tier | Effekte                     | Kosten                  |
|-------------|-------------------|------|-----------------------------|-------------------------|
| cargo_mk1   | CARGO BAY MK.I    | 1    | +5 cargoCap                 | 80 CR                   |
| cargo_mk2   | CARGO BAY MK.II   | 2    | +12 cargoCap                | 250 CR, 15 Ore          |
| cargo_mk3   | CARGO BAY MK.III  | 3    | +25 cargoCap                | 600 CR, 30 Ore, 10 Gas  |

### Scanner — Scansysteme

| ID            | Name           | Tier | Effekte                           | Kosten                   |
|---------------|----------------|------|-----------------------------------|--------------------------|
| scanner_mk1   | SCANNER MK.I   | 1    | +1 scannerLevel                   | 120 CR, 5 Cry            |
| scanner_mk2   | SCANNER MK.II  | 2    | +1 scannerLevel, +50 commRange    | 350 CR, 15 Cry           |
| scanner_mk3   | SCANNER MK.III | 3    | +2 scannerLevel, +100 commRange   | 900 CR, 30 Cry, 10 Gas   |

### Armor — Panzerung

| ID          | Name                  | Tier | Effekte                          | Kosten                    |
|-------------|-----------------------|------|----------------------------------|---------------------------|
| armor_mk1   | ARMOR PLATING MK.I    | 1    | +25 HP                           | 100 CR, 15 Ore            |
| armor_mk2   | ARMOR PLATING MK.II   | 2    | +50 HP, -10% Schaden eingehend   | 300 CR, 30 Ore, 10 Cry    |
| armor_mk3   | ARMOR PLATING MK.III  | 3    | +100 HP, -25% Schaden eingehend  | 800 CR, 50 Ore, 25 Cry    |

---

## 7. Strukturen (Basisbau)

### Baukosten

| Struktur       | AP   | Ore | Gas | Crystal | Funktion                              |
|----------------|------|-----|-----|---------|---------------------------------------|
| comm_relay     | 5 AP | 5   | 0   | 2       | Kommunikations-Reichweite +500        |
| mining_station | 15 AP| 30  | 15  | 10      | Automatisches Mining am Sektor        |
| base           | 25 AP| 50  | 30  | 25      | Heimatbasis-Erweiterung               |
| storage        | 10 AP| 20  | 10  | 5       | Storage-Gebäude (Tier 1–3)            |
| trading_post   | 15 AP| 30  | 20  | 15      | Handelsposten (Tier 1–3)              |

### Progressive Basisbauphasen

Baustellen verarbeiten Ressourcen mit einer Geschwindigkeit von **1 Ressource pro 2 Sekunden** (lazy evaluation).
Basis benötigt **60 Ressourcen** zum Abschluss (Standard).

### Storage-Tiers

| Tier | Kapazität | Upgrade-Kosten |
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

## 8. NPC-Fraktionen & Reputation

### Fraktionen

| ID           | Gewicht | Beschreibung                          |
|--------------|---------|---------------------------------------|
| independent  | 30 %    | Freie Händler, keine Bindung          |
| traders      | 28 %    | Handelsfokus, kaufen/verkaufen viel   |
| scientists   | 25 %    | Forschung, Scanner-Upgrades           |
| pirates      | 16 %    | Feindlich, aber mit Verhandlungsbonus |
| ancients     | 1 %     | Extrem selten, Void-Technologie        |

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
| cargo_expansion   | traders      | +3 Ladekapazität               |
| advanced_scanner  | scientists   | +1 Area-Scan-Radius            |
| combat_plating    | pirates      | +20 % Kampfbonus               |
| void_drive        | ancients     | -1 AP pro Bewegung             |

---

## 9. Kampfsystem

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

## 10. Quests

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Max. aktive Quests     | 3                               |
| Quest-Ablauf           | 7 Tage                         |
| Quest-Typen            | fetch, delivery, scan, bounty  |
| Quest-Rotation         | täglich (stationsabhängig)      |
| Scan-Ereignis-Chance   | 15 % pro Scan                  |

---

## 11. Treibstoffsystem

| Parameter              | Wert                            |
|------------------------|---------------------------------|
| Kosten pro Einheit     | 10 CR/u (Basis)                |
| Gratis-Betankung       | bis 3 Schiffe an Heimatbasis    |
| Reputations-Rabatt     | honored: 25 %, friendly: 10 %  |

---

## 12. XP & Level-System

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

## 13. Kommunikation & Comms-Reichweite

| Schiff        | Basis CommRange | Mit SCN MK.I | Mit SCN MK.II | Mit SCN MK.III |
|---------------|-----------------|--------------|---------------|----------------|
| scout         | 50              | 100          | 150           | 250            |
| freighter     | 75              | 125          | 175           | 275            |
| cruiser       | 100             | 150          | 200           | 300            |
| explorer      | 150             | 200          | 250           | 350            |
| battleship    | 75              | 125          | 175           | 275            |

Relay-Reichweiten: `comm_relay` +500, `base` +1000.

---

## 14. JumpGate-System

- **Normale Gates:** Bidirektional zwischen zwei Sektoren
- **Wormholes:** Zufälliger Zielsektor (unbekannt bis Scan)
- **Frequenz-Minigame:** Kalibrierung für günstigere Sprünge
- **HYPERJUMP:** Direktsprung zu entfernten Sektoren, AP-Rabatt für JumpGates

---

## 15. Bookmarks

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
- Slot 4: `#44FF88` (grün)
- Slot 5: `#FF44FF` (magenta)

---

## 16. Balancing-Notizen & TODOs

### Bekannte Schwächen

- `fuelPerJump` ist aktuell konstant 1 für alle Hüllen (vereinfacht)
- `safeSlots` hardcoded auf 1 (sollte aus Modulen berechnet werden)
- Spawn-Chance near origin gering (kein Guard für Ursprungsbereich)
- UNIQUE constraint für Strukturen wirft DB-Fehler statt saubere Fehlermeldung

### Geplante Erweiterungen

- **Nebel-System (#61):** Multi-Sektor-Nebel, Scan-Störung, Jump-Einschränkungen
- **Alien-Artwork (#60):** ASCII-Art für Ancient-NPC-Begegnungen
- **Item-Artwork (#62):** Verbesserte ASCII-Art für Items in Inventar/Trade
- **Mobile (#49):** Touch-freundlichere UI
- **Gastautorisierung (#31):** 24h-Gastzugänge ohne Registration

### Balancing-Prioritäten

1. **Treibstoff-Kosten** bei langen Reisen zu niedrig (battleship fuelPerJump=3 aber kurze Reichweite)
2. **Kristall zu selten** — Anomalien 0.36 % Häufigkeit macht Armor sehr teuer
3. **Fraktions-Upgrade "void_drive"** sehr mächtig (-1 AP/Move)
4. **Piratenlevel** ab Distanz 500 = Level 10 Piraten → sehr früh Maximum erreicht

---

*Dieses Dokument wird bei größeren Inhalts-Updates aktualisiert.*
