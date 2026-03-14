# voidSector — Regelwerk & Spielsystem-Referenz

> **Stand:** 2026-03-14 | Basiert auf: master (alle PRs bis #306 gemergt)
>
> Dieses Dokument beschreibt **alle Spielregeln** aus Sicht der Specs und Anforderungen.
> Jede Regel referenziert die Design-Specs und GitHub-Issues, aus denen sie hervorgegangen ist.
> Numerische Werte entsprechen dem aktuell implementierten Stand.

---

## Inhaltsverzeichnis

1. [Universum & Navigation](#1-universum--navigation)
2. [Aktionspunkte (AP)](#2-aktionspunkte-ap)
3. [Treibstoff & Hyperdrive](#3-treibstoff--hyperdrive)
4. [Scanning & Erkundung](#4-scanning--erkundung)
5. [Mining & Ressourcen](#5-mining--ressourcen)
6. [Handel & Wirtschaft](#6-handel--wirtschaft)
7. [Kampf](#7-kampf)
8. [Fraktionen & Diplomatie](#8-fraktionen--diplomatie)
9. [Quests](#9-quests)
10. [ACEP (Pilot-Entwicklung)](#10-acep-pilot-entwicklung)
11. [Schiffsmodule & Techbaum](#11-schiffsmodule--techbaum)
12. [Baustellen & Strukturen](#12-baustellen--strukturen)
13. [Human Expansion & Kriegsfuehrung](#13-human-expansion--kriegsfuehrung)
14. [Soziale Systeme](#14-soziale-systeme)
15. [UI & Cockpit](#15-ui--cockpit)

---

## 1. Universum & Navigation

### 1.1 Koordinatensystem

Das Universum ist ein unbegrenztes 2D-Gitter. Koordinaten werden zweistellig dargestellt:

```
[QUAD:INNER]  z.B. [03E8:0042]
```

- **QUAD** (hex): `Math.floor((x + 250) / 500)` — Quadrant im Universum, zentriert um Ursprung
- **INNER** (dez): lokale Position im Quadranten, Bereich -250..249
- **Ursprung**: `(0,0)` liegt in der Mitte von Quadrant `(0,0)`

> Referenz: `compendium.md` Abschnitt 1–2

### 1.2 Quadranten-System

Jeder Quadrant umfasst **500 x 500 Sektoren** (`QUADRANT_SIZE = 500`).

**Colyseus-Rooms**: Pro Quadrant ein Room (`quadrant_qx_qy`). Spieler sehen sich nur, wenn sie im gleichen Sektor desselben Quadranten sind.

- **Intra-Quadrant-Bewegung**: `moveSector`-Nachricht (kein Raumwechsel)
- **Cross-Quadrant-Bewegung**: vollstaendiges Verlassen und Beitreten eines neuen Rooms

> Referenz: CLAUDE.md Architektur; #162–168 (Phase 2 Sektor-Rebuild)

### 1.3 Quadranten-Konfiguration

Jeder Quadrant erhaelt deterministisch variierende Parameter (aus `hashCoords`):

| Parameter | Bereich | Beschreibung |
|---|---|---|
| `resourceFactor` | 0.5–1.5 | Ressourcen-Multiplikator |
| `stationDensity` | 0.5–1.5 | Stationsdichte |
| `pirateDensity` | 0.5–1.5 | Piratendichte |
| `nebulaThreshold` | 0.5–1.5 | Nebel-Schwelle |
| `emptyRatio` | 0.5–1.5 | Leerraum-Anteil |

> Referenz: `compendium.md` Abschnitt 2

### 1.4 Erstkontakt-Benennung

Betritt ein Spieler einen neuen Quadranten, wird ein **First-Contact-Event** ausgeloest (#156):

- Automatischer silbenbasierter Name (2–4 Silben + Suffix)
- **60-Sekunden-Zeitfenster** zur manuellen Benennung
- Namensregeln: 3–24 Zeichen, nur Buchstaben/Zahlen/Leerzeichen/Bindestriche/Apostrophe
- Doppelte Namen nicht erlaubt
- Entdecker wird in DB gespeichert (`discovered_by`, `discovered_at`)

> Referenz: `compendium.md` Abschnitt 2; #156 (Neue Quadranten)

### 1.5 Weltseed & Generierung

```
WORLD_SEED = 77
```

Alle Sektoren werden deterministisch aus `hashCoords(x, y, WORLD_SEED)` generiert. Gleicher Seed = gleiche Karte nach jedem Server-Neustart.

**Zwei-Stufen-Generierung:**

1. **Environment-Roll** — Nebula und Black Holes werden via Zone-System bestimmt (`isInNebulaZone`, `isInBlackHoleCluster`). Rest: `empty`.
2. **Content-Roll** — Bestimmt den Inhalt des Sektors (unabhaengiger Hash).

**Salt-Prinzip** — Jedes System bekommt einen eigenen Salt:

| System | Salt |
|---|---|
| Sektoren (Basis) | `WORLD_SEED` |
| Jumpgates | `WORLD_SEED + JUMPGATE_SALT` |
| NPCs | `WORLD_SEED + NPC_SEED_SALT` |
| Quests | `WORLD_SEED + QUEST_SEED_SALT + dayOfYear` |
| Nebula-Zonen | `WORLD_SEED ^ 0xa5a5a5a5` |
| Black-Hole-Cluster | `WORLD_SEED ^ 0xb1ac4001` |

> Referenz: `compendium.md` Abschnitt 1; `seed-mechanik.md`

### 1.6 Sektor-Umgebung (Environment)

Sektoren bestehen aus zwei Schichten:

- **Environment** (`SectorEnvironment`): `empty`, `nebula`, `black_hole`
- **Content** (`SectorContent`): `asteroid_field`, `station`, `anomaly`, `pirate_zone`, `home_base`, `player_base`

Ein Sektor kann bis zu **3 Contents** gleichzeitig enthalten (`SECTOR_MAX_FEATURES = 3`).

**Umgebungsmodifikatoren:**

| Umgebung | Effekt |
|---|---|
| `nebula` | Scanner-Malus -1, Piraten -30% |
| `empty` | Treibstoffkosten -20% |
| `black_hole` | Spawn-Chance 0.5%, min. Distanz 50. **Unpassierbar** (kein Hyperjump-Ziel) (#160) |

> Referenz: `compendium.md` Abschnitt 1+3; #68 (Sektor-Typen); #160 (Black-Hole kein Ziel)

### 1.7 Sektor-Dichte (Content-Weights)

90% aller Sektoren sind vollstaendig leer. Die restlichen 10% verteilen sich:

| Content | Gewicht | Anteil |
|---|---|---|
| `none` (leer) | 0.900 | ~90% |
| `asteroid_field` | 0.050 | ~5% |
| `pirate` | 0.020 | ~2% |
| `station` | 0.016 | ~1.6% |
| `anomaly` | 0.010 | ~1% |
| `ruin` | 0.004 | ~0.4% |

Urspruenglich war `none` bei 0.45 (~45%), wurde in Playtest-Bugfix #219 auf **0.90** erhoeht, damit 90% leere Sektoren resultieren.

`pirate` erzeugt immer `['pirate_zone', 'asteroid_field']`. `station` hat 15% Chance auf `stationVariant: 'ancient'`.

> Referenz: `compendium.md` Abschnitt 1; #219 (Content-Weight-Aenderung)

### 1.8 Nebel-Zonen

Seed-basierte Blob-Generierung fuer grossflaechige Nebel:

| Parameter | Wert |
|---|---|
| Grid-Abstand | 5000 Sektoren (urspruenglich 300, geaendert in #219) |
| Entstehungschance | 8% pro Grid-Zelle |
| Min. Radius | 3 Sektoren (urspruenglich 15, geaendert in #219) |
| Max. Radius | 8 Sektoren (urspruenglich 50, geaendert in #219) |
| Sicherheitszone | 200 Sektoren um Ursprung |

> Referenz: `compendium.md` Abschnitt 1; #219 (Nebel-Zonen-Rework)

### 1.9 Sektor-Typen im Detail

| Sektortyp | Farbe | Symbol | Ressourcen (Ore/Gas/Crystal) | Besonderheiten |
|---|---|---|---|---|
| `empty` | Amber `#FFB000` | `·` | 5 / 5 / 5 | Keine |
| `asteroid_field` | Orange `#FF8C00` | `▓` | 20 / 2 / 3 | Primaere Erz-Quelle |
| `nebula` | Blau `#00BFFF` | `▒` | 2 / 20 / 3 | Primaere Gas-Quelle, Scanner-Malus -1 |
| `station` | Gruen `#00FF88` | `△` | Keine | NPC-Handel, Reparatur, Quests |
| `anomaly` | Magenta `#FF00FF` | `◇` | 3 / 3 / 20 | Primaere Kristall-Quelle, hohe XP-Boni |
| `pirate` | Rot `#FF3333` | `☠` | 8 / 3 / 8 | Auto-Kampf beim Betreten |
| `home_base` | Weiss `#FFFFFF` | `⌂` | — | Einmalig pro Spieler, Gratis-Betankung |

> Referenz: `compendium.md` Abschnitt 3

### 1.10 Piraten-Level-Skalierung

Piraten-Level skaliert mit Distanz vom Ursprung:
```
Level = floor(distanz / 50), max 10
```
- Level 1 bei Distanz 0–49
- +1 pro 50 Sektoren
- Maximum: Level 10

**Frontier-Regel**: Piraten generieren und kaempfen **nur in Frontier-Quadranten** (1–5 unkontrollierte Nachbarquadranten). In gesicherten Quadranten wird `pirate_zone` beim Generieren entfernt.

> Referenz: `compendium.md` Abschnitt 3; Phase LU (#177–184)

### 1.11 Spawn-System

Neue Spieler spawnen innerhalb eines **Radius von 5 Sektoren um (0,0)**: Koordinaten x in [1,5], y in [1,5].

Urspruenglich war das Spawn-System clusterbasiert (Distanz 10.000.000, Cluster-Radius 300, max 5 Spieler pro Cluster). Dies wurde in der Forschung/Wissen-Phase vereinfacht.

> Referenz: CLAUDE.md; `engine/spawn.ts`

### 1.12 Bookmarks

| Slot | Name | Beschreibung |
|---|---|---|
| 0 | HOME | Heimatbasis (automatisch) |
| 1–5 | Frei | Benutzerdefinierte Wegpunkte (max 5) |
| 6 | SHIP | Aktuelle Schiffsposition (automatisch) |

**Bookmark-Farben im Radar:**
- HOME: `#33FF33`
- Slot 1: `#FF6644` (rot-orange)
- Slot 2: `#44AAFF` (blau)
- Slot 3: `#FFDD22` (gelb)
- Slot 4: `#44FF88` (gruen)

Bookmark-Button ist immer sichtbar (ausserhalb des `{sector ?}`-Blocks). Zeigt `[BOOKMARKED]` wenn gespeichert, deaktiviert wenn alle 5 Slots voll (#220).

> Referenz: `compendium.md` Abschnitt 25; #220 (Bookmark-Fix)

### 1.13 Navigation & Bewegung

**Schiffsanimation**: Sanfte Interpolation von Sektor zu Sektor (800ms Dauer, `easeInOutCubic`). (#155)

**Autopilot**: Persistente Routen (max 3 aktive), automatische Betankung an Stationen, Black-Hole-Avoidance.

**Far Navigation**: Quadrant-Level-Navigation fuer unbekannte Quadranten.

> Referenz: #155 (Move-Animation); #167 (Navigation V2)

---

## 2. Aktionspunkte (AP)

### 2.1 Grundparameter

| Parameter | Wert |
|---|---|
| Max AP | 100 |
| Start AP | 100 |
| Regeneration | 0.5 AP/s (1 AP alle 2s) |

**Lazy Evaluation**: Kein Server-Tick-Loop. Bei jeder Aktion wird `calculateCurrentAP(state, Date.now())` berechnet. AP regenerieren passiv basierend auf der verstrichenen Zeit.

> Referenz: CLAUDE.md; `compendium.md` Abschnitt 5

### 2.2 AP-Kosten pro Aktion

| Aktion | AP-Kosten |
|---|---|
| Sektor-Sprung (Standard) | 1–2 AP (hull-abhaengig) |
| Local Scan | 1 AP |
| Area Scan (Scanner Lv.1) | 3 AP |
| Area Scan (Scanner Lv.2) | 5 AP |
| Area Scan (Scanner Lv.3) | 8 AP |
| Mining starten | 0 AP (Mining verbraucht keine AP) |
| Wreck untersuchen | 2 AP |
| Wreck Item bergen | 3 AP |
| Fliehen (Kampf) | 2 AP |
| Rettungsmission starten | 5 AP |
| Rettung abliefern | 3 AP |
| Data Slate erstellen (sector) | 1 AP |
| Data Slate erstellen (area) | 3 AP |
| Data Slate erstellen (custom) | 2 AP |
| Data Slate erstellen (scan) | 0 AP (Scan hat bereits AP gekostet) |
| Bauen (Struktur-abhaengig) | 5–25 AP |

> Referenz: `compendium.md` Abschnitt 5+16+23; Spec `2026-03-11-scan-to-slate-design.md`; Spec `2026-03-13-wreck-pois-design.md`

### 2.3 Hyperjump-AP-Formel

```
AP-Kosten = Base(5) - Speed-Reduktion + Treibstoff-Faktor + Umgebungs-Malus
```

| Parameter | Wert |
|---|---|
| Basis-AP | 5 |
| Speed-Reduktion | -1 AP pro Speed-Level |
| Minimum-AP | 1 |
| Treibstoff-Distanz-Faktor | +0.1 pro 100 Sektoren Distanz |
| Fuel-Max-Faktor | 2.0 (max. Verdopplung) |
| Piraten-Malus | +50% AP in Piraten-Sektoren |

> Referenz: `compendium.md` Abschnitt 22; #68 (AP-Sprung-Mechanik)

---

## 3. Treibstoff & Hyperdrive

### 3.1 Basis-Konstanten (nach Hull-Legacy-Cleanup #291)

Das Multi-Hull-System wurde entfernt (PR #303). Alle Schiffe starten mit denselben Basiswerten:

| Konstante | Wert | Beschreibung |
|---|---|---|
| `BASE_FUEL_CAPACITY` | 10.000 | Basis-Tankgroesse |
| `BASE_FUEL_PER_JUMP` | 100 | Basis-Treibstoffkosten pro Sprung |
| `BASE_CARGO` | 10 | Basis-Frachtkapazitaet (urspruenglich 3, geaendert in Playtest-Fixes) |
| `BASE_MODULE_SLOTS` | 3 | Basis-Modulslots |
| `BASE_HP` | 100 | Basis-Lebenspunkte |
| `BASE_JUMP_RANGE` | 5 | Basis-Sprungreichweite |
| `BASE_ENGINE_SPEED` | 2 | Basis-Geschwindigkeit |
| `BASE_COMM_RANGE` | 100 | Basis-Kommunikationsreichweite |
| `BASE_SCANNER_LEVEL` | 1 | Basis-Scannerstufe |

> Referenz: Spec `2026-03-13-fuel-hyperjump-hull-cleanup-design.md` (#291); Playtest-Fixes

### 3.2 Fuel-Kapazitaet

```
totalFuelMax = BASE_FUEL_CAPACITY (10.000) + sum(installedModules[].fuelMax)
```

Drive- und Cargo-Module koennen den Tank vergroessern.

### 3.3 Fuel-Kosten pro Hyperjump

```
fuelCost = max(1, ceil(BASE_FUEL_PER_JUMP * distance * (1 - driveEfficiency)))
```

- `BASE_FUEL_PER_JUMP = 100`
- `driveEfficiency` = `hyperdriveFuelEfficiency` aus eingebautem Drive-Modul (0.0–0.5)
- Kein `hullMultiplier` mehr (entfernt in #291)

**Hyperjump ist permanent aktiv** (Feature-Flag `FEATURE_HYPERDRIVE_V2` entfernt in #291). Das Charge-System (taktischer Aspekt) bleibt bestehen.

### 3.4 Betankung

| Methode | Kosten |
|---|---|
| Heimatbasis | Gratis |
| NPC-Station | 2 CR/Einheit (`FUEL_COST_PER_UNIT`) |
| Station (honored Rep) | 25% Rabatt |
| Station (friendly Rep) | 10% Rabatt |

**Kein Fuel = Stranded**: Spieler muss Hilfe anfordern oder Jumpgate nutzen.

> Referenz: `compendium.md` Abschnitt 19; Spec `2026-03-13-fuel-hyperjump-hull-cleanup-design.md`

### 3.5 Fuel-UI

- **ShipStatusPanel**: Orangener Gradient-Balken (`#f97316 -> #fb923c`), 4px hoch
- **COST/SEKTOR**: Zeigt `ship.stats.fuelPerJump`
- **NavTargetPanel**: Fuel-Kosten farbig (gruen wenn ausreichend, rot wenn nicht)

> Referenz: Spec `2026-03-13-fuel-hyperjump-hull-cleanup-design.md` (#291)

---

## 4. Scanning & Erkundung

### 4.1 Scanner-Level & Area-Scan

| Scanner-Level | Area-Scan AP-Kosten | Radius |
|---|---|---|
| 1 | 3 AP | 2 Sektoren |
| 2 | 5 AP | 3 Sektoren |
| 3 | 8 AP | 5 Sektoren |

Local Scan kostet immer **1 AP** und scannt den aktuellen Sektor.

> Referenz: `compendium.md` Abschnitt 5

### 4.2 Scan-Ereignisse

Scan-Ereignis-Chance: **15% pro Scan**

| Event-Typ | Beschreibung |
|---|---|
| `pirate_ambush` | Piraten-Ueberfall |
| `distress_signal` | Notsignal (Rettungsmission) |
| `anomaly_reading` | Anomalie-Messung (+Artefakt, 8% Chance) |
| `artifact_find` | Artefaktfund (50% Chance auf Artefakt) |
| `blueprint_find` | Bauplan-Fund |

> Referenz: `compendium.md` Abschnitt 18

### 4.3 Scan-Sharing (innerhalb Fraktion)

Fraktionsmitglieder teilen alle Scan-Daten automatisch. Nach erfolgreichem Scan werden Ergebnisse per Colyseus-Broadcast an alle online Fraktionsmitglieder gesendet.

> Referenz: #159 (Scan-Sharing); #165 (ScanSharingService)

### 4.4 Scan-to-Slate

Nach einem LOCAL SCAN kann das Ergebnis als Data Slate gespeichert werden:
- **Kostenlos** (Scan hat bereits AP gekostet), benoetigt 1 Cargo-Slot
- Ein Klick, keine Bestaetigung
- Nur 1 Slate pro Scan (Button wird nach Klick disabled: "SLATE GESPEICHERT")
- Cargo voll: Button disabled ("CARGO VOLL")
- Neuer `SlateType = 'scan'` (neben sector, area, custom, jumpgate)

Slate enthaelt: Sektor-Koordinaten, Quadrant, Typ, Ressourcen, Strukturen, Wracks, Universe Tick.

> Referenz: Spec `2026-03-11-scan-to-slate-design.md`; Migration 057

### 4.5 Data Slates

Handelbare Kartenausschnitte:

| Slate-Typ | AP-Kosten | Beschreibung |
|---|---|---|
| `sector` | 1 AP | Einzelsektor-Kartendaten |
| `area` | 3 AP | Flaechenscan (Radius 2–4, scanner-abhaengig) |
| `custom` | 2 AP | Benutzerdefiniert (Koordinaten, Codes, Notizen) |
| `jumpgate` | — | Jumpgate-Verbindungsdaten |
| `scan` | 0 AP | Scan-Ergebnis als Slate |

**NPC-Rueckkauf**: 5 CR pro enthaltenem Sektor (`SLATE_NPC_PRICE_PER_SECTOR`).

**Custom Slates**: 5 CR Kosten, max 20 Koordinaten, max 10 Codes, max 500 Zeichen Notiz.

> Referenz: `compendium.md` Abschnitt 16; Spec `2026-03-11-scan-to-slate-design.md`; Spec `2026-03-11-data-slates-redesign-design.md`

---

## 5. Mining & Ressourcen

### 5.1 Ressourcen-Typen

| Ressource | Symbol | Primaerquelle | NPC-Basispreis | Mining-Rate |
|---|---|---|---|---|
| Ore | Hammer | `asteroid_field` | 10 CR/u | 0.1 u/s |
| Gas | Diamant | `nebula` | 15 CR/u | 0.1 u/s |
| Crystal | Kristall | `anomaly` | 25 CR/u | 0.1 u/s |
| Artefakt | Symbol | Scan-Events | nicht handelbar | — |

**NPC-Preise:**
- Kauf-Spread: +20% (x1.2 — Stationen verkaufen teurer)
- Verkauf-Spread: -20% (x0.8 — Stationen kaufen billiger)

> Referenz: `compendium.md` Abschnitt 4

### 5.2 Typisierte Artefakte (9 Kategorien)

Seit dem Forschung/Wissen-Merge:

```
drive | cargo | scanner | armor | weapon | shield | defense | special | mining
```

- Typ wird zufaellig beim Fund zugewiesen (Gleichverteilung)
- Im Cargo als separate Slots: `artefact_drive`, `artefact_shield` etc.
- Passender Typ gibt +10% Bonus auf Forschungszeit-Reduktion
- Max 3 Artefakte pro Forschungsvorgang

> Referenz: Spec `2026-03-09-forschung-wissen-design.md`; Migration 044

### 5.3 Artefakt-Dropchancen

| Quelle | Chance |
|---|---|
| `artifact_find` Event | 50% |
| `anomaly_reading` | 8% |
| Piraten-Sieg | 3% |

> Referenz: `compendium.md` Abschnitt 4

### 5.4 Mining-Mechanik (Redesign #279)

Ressourcen in Sektoren sind **endlich** und regenerieren sich:

**Erschoepfung**: Nach `stopMining` wird `sectors.metadata.resources[resource]` um den gefoerderten Betrag reduziert. Mehrere Spieler teilen denselben Pool.

**Server-Side Auto-Stop**: Mining stoppt automatisch wenn Ressource erschoepft oder Cargo voll:
```
timeout = Math.ceil(sectorYield / rate) * 1000 ms
cargoTimeout = Math.ceil(cargoSpace / rate) * 1000 ms
effectiveTimeout = Math.min(timeout, cargoTimeout)
```

**Mine-All Modus** (`mineAll`-Flag): Wenn eine Ressource erschoepft ist und `mineAll === true`, wird automatisch die naechste verfuegbare Ressource abgebaut (Reihenfolge: Ore -> Gas -> Crystal).

**Regeneration (Tick-basiert)**:

| Konstante | Wert |
|---|---|
| `RESOURCE_REGEN_DELAY_TICKS` | 50 Ticks |
| `RESOURCE_REGEN_INTERVAL_TICKS` | 12 Ticks (1 Einheit pro 12 Ticks) |

```
ticksSinceMined = currentTick - last_mined_tick
if ticksSinceMined <= RESOURCE_REGEN_DELAY_TICKS:
  current = depleted_value
else:
  regen = floor((ticksSinceMined - REGEN_DELAY) / REGEN_INTERVAL)
  current = min(max, depleted + regen)
```

**Anzeige**: `CRYSTAL 3/7` (aktuell/maximum).

> Referenz: Spec `2026-03-12-mining-redesign-design.md` (#279)

### 5.5 Cargo-Module (verdoppelt)

In den Playtest-Fixes wurden Cargo-Module-Kapazitaeten verdoppelt:

| Modul | Cargo-Bonus |
|---|---|
| `cargo_mk1` | +5 (urspruenglich +5, dann +10) |
| `cargo_mk2` | +12 (verdoppelt) |
| `cargo_mk3` | +25 (verdoppelt) |

`BASE_CARGO` wurde von 3 auf **10** erhoeft.

> Referenz: Playtest-Fixes; CLAUDE.md

---

## 6. Handel & Wirtschaft

### 6.1 NPC-Stationen & Level-System

Stationen haben ein dynamisches Level-System basierend auf Spieler-Interaktion:

| Level | Name | Max Stock | XP-Schwelle |
|---|---|---|---|
| 1 | Outpost | 200 | 0 |
| 2 | Station | 500 | 500 |
| 3 | Hub | 1.200 | 2.000 |
| 4 | Port | 3.000 | 6.000 |
| 5 | Megastation | 8.000 | 15.000 |

**XP-Quellen:**

| Aktion | XP |
|---|---|
| Besuch (visit) | +5 XP |
| Handel (pro Einheit) | +1 XP |
| Quest-Abschluss | +15 XP |
| XP-Zerfall | -1 XP/Stunde |

XP faellt nie unter die Schwelle des aktuellen Levels (kein Abstieg).

> Referenz: `compendium.md` Abschnitt 15

### 6.2 Dynamische Preisgestaltung

Preis haengt vom Fuellstand der Station ab:
```
actualPrice = Math.round(basePrice * (2 - stockRatio))
```
- 100% Stock: 1x Basispreis
- 0% Stock: 2x Basispreis (doppelt)

**Inventar-Dynamik:**
- Restock-Rate: 2% des Max-Stocks pro Stunde
- Verbrauchsrate: 1.5% des Max-Stocks pro Stunde
- Start-Fuellstand: 50–80% (deterministisch aus Seed)

> Referenz: `compendium.md` Abschnitt 15

### 6.3 Kontor (Einkaufskontor)

Das Kontor ermoeglicht **Kaufauftraege** (Buy Orders) an Spieler-Basen:

- Spieler erstellt Kaufauftrag: Item-Typ, Menge, Preis/Einheit
- **Budget-Reservierung**: Credits werden bei Erstellung abgezogen
- Andere Spieler befuellen Auftraege mit Cargo und erhalten Credits
- Stornierung: Nicht befuellte Menge wird als Credits zurueckerstattet
- **Selbstbefuellung ist nicht erlaubt**

**Einheitliches Item-System** (PR #209): `item_type` + `item_id` — Handel mit Ressourcen, Modulen und Blaupausen.

> Referenz: `compendium.md` Abschnitt 13; #209 (Unified Item System)

### 6.4 Direkthandel

Redis-basierte Sessions (60s TTL). Syntax: `/trade @player`. Atomarer Swap von Items + Credits.

> Referenz: MEMORY.md (Unified Item System)

### 6.5 Handelsrouten

| Parameter | Wert |
|---|---|
| Max. Routen | 3 |
| Min. Zykluszeit | 15 Minuten |
| Max. Zykluszeit | 120 Minuten |
| Fuel pro Distanz | 0.5 |

> Referenz: `compendium.md` Abschnitt 24

---

## 7. Kampf

### 7.1 Combat v2 — Taktisches Kampfsystem

> Feature-Flag: `FEATURE_COMBAT_V2 = true` (standardmaessig aktiv)

**Grundmechanik:**
- **5 Runden** pro Kampf (`COMBAT_V2_MAX_ROUNDS = 5`)
- Jede Runde: Spieler waehlt Taktik + Spezial-Aktion
- Schadenswurf: x0.85 bis x1.15 Zufallsfaktor
- Schilde absorbieren Schaden vor HP
- Schildregeneration pro Runde

> Referenz: Spec `2026-03-04-combat-system-design.md`; `compendium.md` Abschnitt 9

### 7.2 Taktiken

| Taktik | Schadens-Mod | Verteidigungs-Mod |
|---|---|---|
| `assault` | x1.30 | x0.80 |
| `balanced` | x1.00 | x1.00 |
| `defensive` | x0.75 | x1.35 |

### 7.3 Spezial-Aktionen (einmal pro Kampf)

| Aktion | Effekt |
|---|---|
| `aim` | +50% Genauigkeit, 35% Chance Waffe fuer 2 Runden zu deaktivieren |
| `evade` | 50% Chance Schaden komplett zu vermeiden |

### 7.4 Waffen-Mechaniken

| Typ | Besonderheit |
|---|---|
| `laser` | Zuverlaessig, keine Spezialeffekte |
| `railgun` | 30–50% Panzerbrechend (ignoriert Schilde). Formel: `finalDmg = piercing * raw + (1-piercing) * raw * damageMod` |
| `missile` | Hoher Schaden, aber durch Punkt-Verteidigung abfangbar (50–60% Abfangrate) |
| `emp` | 75% Trefferchance, deaktiviert Gegner-Schilde fuer 2 Runden, 0 Direktschaden |

### 7.5 Waffen-Module

| ID | Name | Tier | ATK | Spezial | Kosten |
|---|---|---|---|---|---|
| `laser_mk1` | PULS-LASER MK.I | 1 | 8 | — | 150 CR, 10 Cry |
| `laser_mk2` | PULS-LASER MK.II | 2 | 16 | — | 450 CR, 25 Cry, 10 Gas |
| `laser_mk3` | PULS-LASER MK.III | 3 | 28 | — | 1200 CR, 50 Cry, 20 Gas |
| `railgun_mk1` | RAIL-KANONE MK.I | 1 | 12 | 30% Panzerbrechend | 300 CR, 30 Ore, 15 Cry |
| `railgun_mk2` | RAIL-KANONE MK.II | 2 | 22 | 50% Panzerbrechend | 900 CR, 60 Ore, 30 Cry |
| `missile_mk1` | RAKETEN-POD MK.I | 1 | 18 | Abfangbar | 250 CR, 20 Ore, 5 Cry |
| `missile_mk2` | RAKETEN-POD MK.II | 2 | 30 | Abfangbar | 750 CR, 40 Ore, 15 Cry |
| `emp_array` | EMP-EMITTER | 2 | 0 | Schilde 2 Runden deaktiviert | 500 CR, 20 Cry, 20 Gas |

### 7.6 Schild-Module

| ID | Name | Tier | Schild-HP | Regen/Runde | Kosten |
|---|---|---|---|---|---|
| `shield_mk1` | SCHILD-GEN MK.I | 1 | 30 | 3 | 200 CR, 15 Cry |
| `shield_mk2` | SCHILD-GEN MK.II | 2 | 60 | 6 | 600 CR, 35 Cry, 10 Gas |
| `shield_mk3` | SCHILD-GEN MK.III | 3 | 100 | 12 | 1500 CR, 70 Cry, 25 Gas |

### 7.7 Verteidigungs-Module

| ID | Name | Tier | Effekt | Kosten |
|---|---|---|---|---|
| `point_defense` | PUNKT-VERTEIDIGUNG | 2 | 60% Raketen-Abfang | 350 CR, 20 Ore, 10 Cry |
| `ecm_suite` | ECM-SUITE | 2 | -15% feindl. Genauigkeit | 400 CR, 25 Cry, 15 Gas |

### 7.8 Kampfergebnis

Nach 5 Runden oder HP = 0:
- **Sieg**: Loot (Credits, Ressourcen, Artefakte)
- **Niederlage**: 25–50% Cargo-Verlust
- **Auto-Flee**: Nach Runde 5 flieht der Spieler automatisch

### 7.9 Piraten-Kampf (Legacy/Auto-Battle)

| Parameter | Wert |
|---|---|
| Basis-Piraten-HP | 20 + 10 x Level |
| Basis-Schaden | 5 + 3 x Level |
| Fliehen-Chance | 60% Basis |
| Fliehen-AP-Kosten | 2 AP |
| Verhandeln-Kosten | 10 CR x Piraten-Level |
| Cargo-Verlust bei Niederlage | 25–50% |

> Referenz: `compendium.md` Abschnitt 17

### 7.10 Station Defense

Spieler-Basen koennen mit Verteidigungsanlagen geschuetzt werden:

| Modul | Schaden | Schild-HP | Regen | Kosten |
|---|---|---|---|---|
| `defense_turret_mk1` | 15 | — | — | 500 CR, 50 Ore |
| `defense_turret_mk2` | 30 | — | — | 1500 CR, 100 Ore, 20 Cry |
| `defense_turret_mk3` | 50 | — | — | 4000 CR, 200 Ore, 60 Cry |
| `station_shield_mk1` | — | 150 | 10 | 1000 CR, 50 Cry |
| `station_shield_mk2` | — | 350 | 25 | 3000 CR, 100 Cry, 30 Gas |
| `ion_cannon` | 80 | — | — | 8000 CR, 300 Ore, 100 Cry, 50 Gas |

Ion Cannon: 1x pro Kampf, ignoriert Schilde.

Station-Basis-HP: **500**. Max. Kampfrunden: **10**.

> Referenz: `compendium.md` Abschnitt 10

---

## 8. Fraktionen & Diplomatie

### 8.1 NPC-Fraktionen

| Fraktion | Gewicht | Beschreibung |
|---|---|---|
| `independent` | 30% | Freie Haendler, keine Bindung |
| `traders` | 28% | Handelsfokus |
| `scientists` | 25% | Forschung, Scanner-Upgrades |
| `pirates` | 16% | Feindlich, mit Verhandlungsbonus |
| `ancients` | 1% | Extrem selten, Void-Technologie |

> Referenz: `compendium.md` Abschnitt 14

### 8.2 Reputations-Stufen

| Tier | Bereich | Preismodifikator | Beschreibung |
|---|---|---|---|
| `hostile` | -100 .. -51 | +50% | Angriff on sight |
| `unfriendly` | -50 .. -1 | +0% | Misstrauisch |
| `neutral` | 0 | +0% | Standard |
| `friendly` | +1 .. +50 | -10% | Rabatt |
| `honored` | +51 .. +100 | -25% | Max. Rabatt + Upgrade-Zugang |

### 8.3 Fraktions-Upgrades (bei honored)

| ID | Fraktion | Effekt |
|---|---|---|
| `cargo_expansion` | traders | +3 Ladekapazitaet |
| `advanced_scanner` | scientists | +1 Area-Scan-Radius |
| `combat_plating` | pirates | +20% Kampfbonus |
| `void_drive` | ancients | -1 AP pro Bewegung |

### 8.4 Spieler-Fraktions-Upgrade-Baum (3 Tiers)

| Tier | Option A | Option B | Kosten |
|---|---|---|---|
| 1 | MINING BOOST +15% | CARGO EXPANSION +3 | 500 CR |
| 2 | SCAN RANGE +1 | AP REGEN +20% | 1500 CR |
| 3 | COMBAT BONUS +15% | TRADE DISCOUNT -10% | 5000 CR |

> Referenz: `compendium.md` Abschnitt 14

### 8.5 Humanity Reputation System

Server-weites Aggregat der Alien-Reputation aller Spieler. Beeinflusst Encounter-Wahrscheinlichkeiten.

**Rep-Tiers:**

| Tier | Schwelle | Chance-Modifier |
|---|---|---|
| LOW | < -200 | 0.5x Encounter-Chance |
| NEUTRAL | -200..+200 | 1.0x |
| HIGH | > +200 | 1.5x Encounter-Chance |

**Rep-Quellen (4 Eintragspunkte):**
1. `resolveAlienEncounter`: +3 (freundlich) / -2 (feindlich)
2. `storyChoice`: Effekt / 3 (abgeschwaecht)
3. Community-Quest-Abschluss: +50 (idempotent)
4. Alien-Interaction: +1 x 9 Handler

Client: `humanityReps` Zustand, ALIEN REP Tab, Toast-Tier-Anzeige im `AlienEncounterToast`.

> Referenz: CLAUDE.md; MEMORY.md (Humanity Rep System)

### 8.6 Alien-Fraktionen (10 Rassen)

Implementiert in Phase AQ und Phase EW (#170–175, #206):

| Fraktion | Stil | Aggression |
|---|---|---|
| K'thari | Militaerisch, aggressiv | Hoch |
| Silent Swarm | Schwarm-Invasion | Sehr hoch |
| Archivare | Statisch, konservativ | Sehr gering |
| Konsortium | Wirtschaftlich, friedlich | Gering |
| Touristengilde | Bunt, harmlos | Minimal |
| Mycelianer | Organisch, langsam | Gering |
| Mirror Minds | Reaktiv (spiegelt Spieler-Rep) | Variabel |
| Scrappers | Schwarzmarkt | Mittel |

Jede Fraktion hat `home_qx`, `home_qy` und expandiert priorisiert innerhalb des eigenen Kugelradius.

> Referenz: Spec `2026-03-09-expansion-warfare-design.md`; `2026-03-09-alien-races-design.md`

---

## 9. Quests

### 9.1 Grundparameter

| Parameter | Wert |
|---|---|
| Max. aktive Quests | 3 |
| Quest-Ablauf | 7 Tage |
| Quest-Typen | fetch, delivery, scan, bounty, bounty_chase |
| Quest-Rotation | taeglich (stationsabhaengig) |
| Max. getrackte Quests | 5 |

> Referenz: `compendium.md` Abschnitt 18

### 9.2 Quest-Typen

| Typ | Beschreibung | Belohnungen |
|---|---|---|
| `fetch` | Ressource beschaffen und liefern | Credits, XP, Rep |
| `delivery` | NPC-Auftrag (Waren transportieren) | Credits, XP, Rep |
| `scan` | Sektor(en) scannen und berichten | Credits, XP, Artefakt-Chance |
| `bounty` | Piraten/NPC besiegen | Credits, XP, Ressourcen |
| `bounty_chase` | Kopfgeldjagd mit Trail-Verfolgung | Credits, XP, hohe Belohnung |

### 9.3 Kopfgeld-Quest-System (bounty_chase)

Implementiert gemaess Spec `2026-03-11-bounty-quest-design.md` (#268):

**Ablauf:**
1. Quest annehmen -> Trail wird generiert (2–4 Schritte je nach Level)
2. Trail-Sektoren scannen -> Hinweise erhalten, Fortschritt
3. Finalen Sektor scannen -> Exklusiver Pirat spawnt (bountyAmbush)
4. Kampf gewinnen -> Gefangener ins Inventar (`item_type: 'prisoner'`)
5. Gefangenen an Ursprungsstation abliefern -> Belohnung

**Trail-Laenge nach Level:**

| Level | Trail-Schritte | Finale Distanz |
|---|---|---|
| 1–2 | 2 | 3–5 Sektoren von Station |
| 3–4 | 3 | 5–10 Sektoren |
| 5+ | 4 | 10–20 Sektoren |

**Hinweis-Qualitaet nach Level:**

| Level | Qualitaet | Beispiel |
|---|---|---|
| 1–2 | Exakt | "Hat S 5:8 Richtung S 5:7 verlassen." |
| 3–4 | Ungefaehr | "Spur endet irgendwo noerdlich von S 5:x." |
| 5+ | Nur Quadrant | "Letzte bekannte Position: Quadrant 1:2." |

**Sci-Fi-Namengenerator**: Silbenbasiert, deterministisch aus `hashCoords(stationX, stationY, day + BOUNTY_NAME_SALT)`.

> Referenz: Spec `2026-03-11-bounty-quest-design.md` (#268)

### 9.4 Story-Quest-Kette (9 Kapitel)

Implementiert in Phase AQ (#170–175):

| Kapitel | Q-Dist | Titel | Branch |
|---|---|---|---|
| 0 | 6 | "Das Aufbruch-Signal" | — |
| 1 | 40 | "Die Aussenposten-Anomalie" | — |
| 2 | 100 | "Erstkontakt — Die Archivare" | A: Daten teilen / B: verweigern |
| 3 | 150 | "Der erste Zweifel" | — |
| 4 | 200 | "Der K'thari-Test" | A: kaempfen / B: fliehen |
| 5 | 300 | "Die Lebende Welt" | A: schuetzen / B: zerstoeren / C: ignorieren |
| 6 | 500 | "Touristen-Invasion" | A: mitspielen / B: ablehnen |
| 7 | 1000 | "Das Unmoegliche Artefakt" | — (Axiom-Puzzle) |
| 8 | 3000 | "Der Rand" | A: Ja / B: Nein / C: Unsicher |

**Trigger-Regel**: Kapitel N triggert beim naechsten `moveSector` sobald:
- Chebyshev-Quadrant-Distanz von 0:0 >= Kapitel-Distanz
- Alle vorherigen Kapitel abgeschlossen (oder uebersprungen nach 48h Timeout)

**Branch-Reputationseffekte** (Beispiele):
- Kapitel 2 Branch A: Archivists +30
- Kapitel 4 Branch A: K'thari +50
- Kapitel 5 Branch A: Mycelians +40, K'thari -20

> Referenz: Spec `2026-03-09-aq-story-community-design.md` (#170–175)

### 9.5 Community-Quests

4 Quests, rotierend (eine aktiv gleichzeitig, 7-Tage-Deadline):

| ID | Titel | Ziel | Belohnung |
|---|---|---|---|
| `interstellar_message` | "Interstellare Botschaft" | 50.000 positive Alien-Interaktionen | Alle Alien-Reps +10 |
| `great_survey` | "Das Grosse Kartenprojekt" | 100.000 gescannte Sektoren | Archivare teilen Sternkarten |
| `jumpgate_network` | "Stabilisiertes Wurmloch-Netz" | 500 gebaute Jumpgates | Konsortium-Exklusivroute |
| `galactic_olympics` | "Erste Galaktische Olympiade" | 10.000 Touristengilde-Quests | "Tourist Attraction"-Badge |

> Referenz: Spec `2026-03-09-aq-story-community-design.md`

### 9.6 Spontane Alien-Encounter

Roll bei jedem `moveSector`, max 1 Event pro 10 Sektoren (Cooldown):

| Event | Fraktion | Min Q-Dist | Chance |
|---|---|---|---|
| Archivar-Sonde scannt Schiff | archivists | 100 | 2% |
| K'thari fordert Mautgebuehr | kthari | 200 | 5% |
| Konsortium-Haendler bietet Rabatt | consortium | 150 | 3% |
| Tourist fotografiert Schiff | tourist_guild | 500 | 8% |
| Scrapper bietet Schwarzmarkt | scrappers | 50 | 4% |
| Mirror Mind liest Emotionen | mirror_minds | 400 | 1% |
| Silent Swarm Drohne folgt | silent_swarm | 800 | 2% |

Rep-Effekt je nach Spielerwahl: +5 bis +15 oder -5 bis -15.

> Referenz: Spec `2026-03-09-aq-story-community-design.md`

### 9.7 Quest-Tracking & Journal

- Max 5 getrackte Quests
- BookmarkBar zeigt VERFOLGT-Sektion
- Blauer Radar-Puls fuer Quest-Ziel-Sektoren
- Quest-Journal als JOURNAL-Tab in QUESTS-Programm

> Referenz: MEMORY.md (Sprint Next); #151 (Quest-Journal)

### 9.8 Quest-UI-Verbesserungen (#283)

- Quest-Typ-Badge (FETCH, BOUNTY, SCAN...) im Kartenheader
- Strukturierte Sektionen ZIELE / BELOHNUNG bei Annahme-Vorschau
- Expliziter [ABBRECHEN]-Button zum Disarmen
- Collapsed Active Quests zeigen naechstes Ziel als Kurzinfo

> Referenz: Spec `2026-03-13-quest-ui-improvements-design.md` (#283)

---

## 10. ACEP (Pilot-Entwicklung)

### 10.1 Kernprinzip

**Ein Spieler. Ein Schiff. Kein Tausch, kein Kauf eines anderen Schiffs.**

Das Schiff ist kein Ausruestungsgegenstand — es ist ein Begleiter. Es waechst mit dem Spieler, entwickelt einen Charakter, und stirbt irgendwann. Sein Erbe lebt weiter.

> *"Das Schiff lernt. Der Pilot lebt."* — ACEP Paragraph 1

Das Multi-Ship-System (Schiffswechsel, Hangar) wurde vollstaendig entfernt. ACEP ersetzt es.

> Referenz: Spec `2026-03-09-acep-design.md`; `acep-pilotenhandbuch.md`; #265 (ACEP Module Shop)

### 10.2 XP-Budget

```
Total-Budget: 100 XP
Max pro Pfad: 50 XP (ACEP_PATH_CAP_SHARED)
```

XP kommt **emergent durch Aktionen** — kein manuelles Verteilen. Wer kaempft, wird ein Kampfschiff. Wer scannt, wird ein Aufklaerungsschiff.

**Boost**: +5 XP pro Boost-Aktion (kostet Credits + Wissen), nur wenn `xp.total < 100`.

> Referenz: `compendium.md` Abschnitt 20a; `acep-pilotenhandbuch.md` Kapitel 2

### 10.3 Die 4 Entwicklungspfade

#### AUSBAU — Logistik & Konstruktion

**XP-Quellen:**

| Aktion | XP |
|---|---|
| Ressourcen abbauen (Mining-Tick) | +2 XP |
| Station/Basis bauen | +10 XP |
| Modul bauen/gecraftet | +10 XP |

**Effekte:**

| XP | Effekt |
|---|---|
| >= 10 | +1 extra Modul-Slot |
| >= 25 | +2 extra Modul-Slots |
| >= 40 | +3 extra Modul-Slots |
| >= 50 | +4 extra Modul-Slots (Maximum) |
| linear | Cargo-Multiplikator: 1.0 + XP x 0.01 (max +50% bei 50 XP) |
| linear | Mining-Bonus: XP x 0.006 (max +30% bei 50 XP) |

**AUSBAU-Level-Gating**: Forschungsslot 2 und Fabrik-Nutzung werden durch AUSBAU-Level freigeschaltet (nicht mehr durch Gebaeude-Tier):

| AUSBAU-Level | XP-Bereich | Forschungsslots | Fabrik |
|---|---|---|---|
| 1 | 0–7 | 1 | — |
| 2 | 8–17 | 1 | Ja |
| 3 | 18–31 | 2 | Ja |
| 4 | 32–49 | 2 | Ja |
| 5 | 50 | 2 | Ja |

> Referenz: `compendium.md` 20a; Spec `2026-03-11-acep-program-design.md` (#241)

#### INTEL — Aufklaerung & Navigation

**XP-Quellen:**

| Aktion | XP |
|---|---|
| Sektor scannen | +3 XP |
| Neuen Quadranten entdecken | +20 XP |

**Effekte:**

| XP | Effekt |
|---|---|
| >= 20 | +1 Scan-Radius |
| >= 40 | +2 Scan-Radius |
| >= 50 | +3 Scan-Radius |
| linear | Staleness-Multiplikator: 1.0 + XP x 0.02 (Sektoren bleiben bis 2x laenger frisch) |

#### KAMPF — Gefechtserprobung

**XP-Quellen:**

| Aktion | XP |
|---|---|
| Pirat besiegt | +5 XP |
| Kampf gewonnen | +5 XP |
| Territorial-Angriff | +2–5 XP |

**Effekte:**

| XP | Effekt |
|---|---|
| linear | Schaden-Bonus: XP x 0.004 auf `combatMultiplier` (max +20% bei 50 XP) |
| linear | Schild-Regen-Bonus: XP x 0.006 (max +30% bei 50 XP) |

#### EXPLORER — Entdeckung & Erforschung

**XP-Quellen:**

| Aktion | XP |
|---|---|
| Neuen Sektor entdecken (Navigation) | +2 XP |
| Cross-Quadrant-Jump | +2 XP |
| Ancient-Ruine scannen | +15 XP |

**Effekte:**

| XP | Effekt |
|---|---|
| >= 25 | Ancient-Ruinen auf Radar sichtbar; Wreck-Detection (Tier 4/5 Wrecks auf Radar ohne Local Scan) |
| >= 50 | Helion-Decoder aktiv (kein Modul noetig); Artefakt-Bergung Minimum 35% statt 5% |
| linear | Anomalie-Chance-Bonus: XP x 0.002 (max +10% bei 50 XP) |
| linear | Bergungschance bei Wrecks: +0.5% pro XP (max +25%) |

> Referenz: `compendium.md` 20a; Spec `2026-03-13-wreck-pois-design.md`

### 10.4 Trait-System

Traits entstehen **automatisch** aus der XP-Verteilung:

| Trait | Ausloeser | Bedeutung |
|---|---|---|
| `veteran` | kampf >= 20 | Kampferprobt |
| `curious` | intel >= 20 | Unersaettlich neugierig |
| `ancient-touched` | explorer >= 15 | Hat Altes beruehrt |
| `reckless` | kampf >= 15 & ausbau <= 5 | Kaempfer, ignoriert Logistik |
| `cautious` | ausbau >= 20 & kampf <= 5 | Baumeister, meidet Konflikte |
| `scarred` | kampf >= 10 & (rest <= 40% von kampf) | Tunnelvision-Kaempfer |

**Dominanz-Prioritaet**: `ancient-touched` > `veteran` > `scarred` > `reckless` > `cautious` > `curious`

> Referenz: `compendium.md` 20a

### 10.5 Persoenlichkeitssystem

Schiffe kommentieren Situationen basierend auf ihren Traits:

| Schiffstyp | Scan-Kommentar |
|---|---|
| Junges Schiff | *(schweigt)* |
| Veteran | `SYSTEM: Scan nominal. Wir haben schlimmeres gesehen.` |
| Curious | `SYSTEM: Interessante Energiemuster. Weitere Daten erforderlich.` |
| Ancient-touched | `SYSTEM: Diese Leere... wir waren schon hier. In einer anderen Form.` |
| Reckless | `SYSTEM: Scan durch. Kein Kontakt. Schade.` |

Kontexte: `scan`, `scan_ruin`, `combat_victory`, `combat_defeat`, `mine`, `build`

> Referenz: `compendium.md` 20a; `acep-pilotenhandbuch.md` Kapitel 5

### 10.6 Radar-Icon-Evolution

Ab XP >= 20 total ueberschreibt das ACEP-System das Hull-Standard-Radar-Icon:

| Tier | XP-Gesamt | Beschreibung |
|---|---|---|
| 1 | 0–24 | Hull-Standard-Icon |
| 2 | 25–49 | Pfad-beeinflusste Variante |
| 3 | 50–74 | Ausgepraegter Charakter |
| 4 | >= 75 | Vollstaendige ACEP-Form |

Dominantes Icon-Muster nach dominantem XP-Pfad: Ausbau=breit, Intel=schmal, Kampf=spitz, Explorer=asymmetrisch.

> Referenz: `compendium.md` 20a

### 10.7 Permadeath & Legacy

Das Schiff kann sterben. Bei HP = 0:

- **Wrack** bleibt im Universum (Wrack-POI, sichtbar fuer andere Spieler)
- **Nachfolger-Schiff** erbt:
  - **30% der ACEP-XP** (verteilt auf alle Pfade)
  - **1 Trait** des Vorgaengers
- Eject-Pod rettet den Spieler

**Bergbare Module**: 25% Chance, dass Module aus Wracks geborgen werden koennen.

> Referenz: `acep-pilotenhandbuch.md` Kapitel 6; `compendium.md` 20a

### 10.8 ACEP-UI (3-Tab-Struktur)

Reorganisiert in #265 (ACEP Module Shop Redesign):

**3 Tabs**: `[ACEP]` · `[MODULE]` · `[SHOP]`

- **ACEP-Tab**: 4 XP-Pfade, [+5] Boost-Buttons, aktive Effekte, Traits, Schiff umbenennen
- **MODULE-Tab**: Installierte Slots + Inventar, Einbau/Ausbau
- **SHOP-Tab**: Modul-Einkauf (nur an Station/Base verfuegbar)

**Detail-Panel (Sec 3)**: Modul-Stats bei Hover, Schiffs-Impact-Deltas via `calculateShipStats`-Diff.

> Referenz: Spec `2026-03-11-acep-module-shop-design.md` (#265)

---

## 11. Schiffsmodule & Techbaum

### 11.1 Modul-Kategorien

8 Spezialisierte Slots mit Kategorie-Label: GEN/DRV/WPN/ARM/SHD/SCN/MIN/CGO.
Darunter Extra-Slots (freigeschaltet durch AUSBAU-Level), die jede Kategorie akzeptieren.

### 11.2 Drive-Module (Antrieb)

| ID | Name | Tier | Effekte | Kosten | Forschung |
|---|---|---|---|---|---|
| `drive_mk1` | ION DRIVE MK.I | 1 | +1 Jump, +1 Speed | 100 CR, 10 Ore | — |
| `drive_mk2` | ION DRIVE MK.II | 2 | +2 Jump, +2 Speed, -0.2 AP/J | 300 CR, 20 Ore, 5 Cry | 200 CR, 15 Ore (5 Min) |
| `drive_mk3` | ION DRIVE MK.III | 3 | +3 Jump, +3 Speed, -0.5 AP/J | 800 CR, 40 Ore, 15 Cry | 500 CR, 30 Ore, 10 Cry, 2 Art (12 Min) |
| `void_drive` | VOID DRIVE | 3 | +6 Jump, +5 Speed, -3 Fuel/J | 2000 CR, 5 Art | 2000 CR, 10 Art (30 Min) — Ancients honored |

Neuer Spieler startet immer mit `drive_mk1` ausgeruestet.

### 11.3 Cargo-Module

| ID | Name | Tier | Effekte | Kosten | Forschung |
|---|---|---|---|---|---|
| `cargo_mk1` | CARGO BAY MK.I | 1 | +5 Cargo | 80 CR | — |
| `cargo_mk2` | CARGO BAY MK.II | 2 | +12 Cargo, +1 Safe-Slot | 250 CR, 15 Ore | 150 CR, 10 Ore (5 Min) |
| `cargo_mk3` | CARGO BAY MK.III | 3 | +25 Cargo, +2 Safe-Slot, +20 Fuel | 600 CR, 30 Ore, 10 Gas | 400 CR, 25 Ore, 1 Art (10 Min) |

### 11.4 Scanner-Module

| ID | Name | Tier | Effekte | Kosten | Forschung |
|---|---|---|---|---|---|
| `scanner_mk1` | SCANNER MK.I | 1 | +1 Scan-Level | 120 CR, 5 Cry | — |
| `scanner_mk2` | SCANNER MK.II | 2 | +1 Scan-Level, +50 Komm | 350 CR, 15 Cry | 200 CR, 10 Cry (5 Min) |
| `scanner_mk3` | SCANNER MK.III | 3 | +2 Scan-Level, +100 Komm, +3% Art-Chance | 900 CR, 30 Cry, 10 Gas | 600 CR, 20 Cry, 3 Art (15 Min) |
| `quantum_scanner` | QUANTUM-SCANNER | 3 | +3 Scan-Level, +200 Komm, +5% Art-Chance | 1500 CR, 50 Cry | 1500 CR, 50 Cry, 8 Art (25 Min) |

### 11.5 Armor-Module

| ID | Name | Tier | Effekte | Kosten | Forschung |
|---|---|---|---|---|---|
| `armor_mk1` | ARMOR PLATING MK.I | 1 | +25 HP | 100 CR, 15 Ore | — |
| `armor_mk2` | ARMOR PLATING MK.II | 2 | +50 HP, -10% Schaden | 300 CR, 30 Ore, 10 Cry | 200 CR, 20 Ore (5 Min) |
| `armor_mk3` | ARMOR PLATING MK.III | 3 | +100 HP, -25% Schaden | 800 CR, 50 Ore, 25 Cry | 500 CR, 40 Ore, 2 Art (12 Min) |
| `nano_armor` | NANO-PANZERUNG | 3 | +150 HP, -35% Schaden | 1800 CR, 50 Ore, 50 Cry | 1800 CR, 50 Ore, 50 Cry, 15 Art (30 Min) |

### 11.6 Tech-Tree-Grundprinzip (Voraussetzungs-Ketten)

```
drive_mk1 -> drive_mk2 -> drive_mk3 -> void_drive (Ancients honored)
cargo_mk1 -> cargo_mk2 -> cargo_mk3
scanner_mk1 -> scanner_mk2 -> scanner_mk3 -> quantum_scanner
armor_mk1 -> armor_mk2 -> armor_mk3 -> nano_armor
                          -> point_defense
             scanner_mk2 -> ecm_suite
laser_mk1 -> laser_mk2 -> laser_mk3
           -> railgun_mk1 -> railgun_mk2
             laser_mk2 -> emp_array
missile_mk1 -> missile_mk2
armor_mk1 -> shield_mk1 -> shield_mk2 -> shield_mk3
```

- Tier-1-Module sind **frei kaufbar** (kein Research noetig)
- Tier-2- und Tier-3-Module muessen **erforscht** werden
- Nur **eine** aktive Forschung gleichzeitig (Slot 2 ab AUSBAU Level 3)
- Forschungstick: 1 Minute (`RESEARCH_TICK_MS = 60_000`)

> Referenz: `compendium.md` Abschnitt 7–8

### 11.7 Tech-Tree-Rework (Sternfoermiger Baum, #297)

Das lineare Forschungssystem wird durch einen sternfoermigen Tech Tree mit 4 Hauptaesten ersetzt:

**4 Aeste = ACEP-Pfade**: KAMPF, AUSBAU, INTEL, EXPLORER

**Knotentypen:**
- **Branch** (Hauptast): maxLevel 3. Stufen 1/2/3 schalten Tier 2/3/4 frei.
- **Module** (Modulgruppe): 3 pro Ast, exklusiv (nur 1 waehlbar), maxLevel 1
- **Spezialisierung**: 2 pro Modulgruppe, ENTWEDER/ODER, maxLevel 1
- **Blatt** (Verbesserung): 3 pro Modul, nur 1 waehlbar, maxLevel 3

**Kosten-Eskalation:**

| Tiefe | Basiskosten |
|---|---|
| Branch Stufe 1 | 150 Wissen |
| Branch Stufe 2 | 450 Wissen |
| Branch Stufe 3 | 1350 Wissen |
| Modulgruppe | 280 Wissen |
| Spezialisierung | 620 Wissen |
| Blatt Stufe 1 | 180 Wissen |
| Blatt Stufe 2 | 540 Wissen |
| Blatt Stufe 3 | 1620 Wissen |

**Globaler Aufschlag**: Jeder erforschte Knoten erhoht alle zukuenftigen Kosten um +5%.
```
effectiveCost = baseCost x (1 + totalResearched x 0.05)
```

**Reset**: Kostenlos, 24h Cooldown, kein Wissen-Refund.

> Referenz: Spec `2026-03-12-tech-tree-rework-design.md` (#297); Migration 059

### 11.8 Wissen-Generierung (aktiv)

Passive Generierung entfernt. Wissen wird aktiv durch Spielaktionen verdient:

| Service | Aktion | Basis-Wissen |
|---|---|---|
| MiningService | Erz/Gas/Crystal abbauen | +1 pro Ladung |
| ScanService | Sektor scannen | +2 |
| ScanService | Artefakt finden | +5–15 (nach Typ) |
| CombatService | NPC besiegt | +3–8 (nach Staerke) |
| CombatService | PvP gewonnen | +10 |
| NavigationService | Neuer Sektor betreten | +1 |
| NavigationService | Quadrant wechseln | +5 |
| QuestService | Quest abgeschlossen | +5–20 |
| ShipService | Modul gebaut/gecraftet | +3 |

**Lab-Multiplikator** (Struktur-basiert):

| Lab Tier | Multiplikator |
|---|---|
| 0 (kein Lab) | x1.0 |
| 1 | x1.5 |
| 2 | x2.0 |
| 3 | x3.0 |
| 4 | x4.0 |
| 5 | x5.0 |

Urspruenglich war Wissen-Generierung **passiv** durch Station-Labs (5–80 Wissen/h je Stufe). Dies wurde im Tech-Tree-Rework (#297) durch aktive Generierung mit Lab als Multiplikator ersetzt.

> Referenz: Spec `2026-03-12-tech-tree-rework-design.md` (#297)

### 11.9 Blueprints

Blueprints werden ueber Scan-Events (`blueprint_find`) gefunden. Ein Blueprint schaltet ein Modul **ohne Forschung** frei.

**Wichtig**: Blueprints umgehen NICHT die Tech-Tree-Tier-Anforderungen. Ein Blueprint fuer `drive_mk3` erfordert EXPLORER Stufe 2 (Tier 3).

> Referenz: `compendium.md` Abschnitt 8; Spec `2026-03-12-tech-tree-rework-design.md`

---

## 12. Baustellen & Strukturen

### 12.1 Baukosten

| Struktur | AP | Ore | Gas | Crystal | Funktion |
|---|---|---|---|---|---|
| `comm_relay` | 5 | 5 | 0 | 2 | Kommunikations-Reichweite +500 |
| `mining_station` | 15 | 30 | 15 | 10 | Automatisches Mining |
| `base` | 25 | 50 | 30 | 25 | Heimatbasis-Erweiterung (+1000 Komm) |
| `storage` | 10 | 20 | 10 | 5 | Storage-Gebaeude (Tier 1–3) |
| `trading_post` | 15 | 30 | 20 | 15 | Handelsposten (Tier 1–3) |
| `defense_turret` | 20 | 40 | 10 | 20 | Geschuetzturm-Plattform |
| `station_shield` | 20 | 30 | 25 | 30 | Schild-Generator-Plattform |
| `ion_cannon` | 25 | 60 | 30 | 40 | Ionenkanone-Plattform |
| `factory` | 20 | 40 | 20 | 15 | Produktionsanlage |
| `research_lab` | 25 | 30 | 25 | 30 | Forschungslabor |
| `kontor` | 15 | 20 | 10 | 10 | Einkaufskontor |

### 12.2 Progressive Bauphasen

Baustellen verarbeiten Ressourcen mit einer Geschwindigkeit von **1 Ressource pro 2 Sekunden** (lazy evaluation). Basis benoetigt **60 Ressourcen** zum Abschluss.

Baustellen sind auf dem Radar sichtbar (#354). Admin kann Baustellen via API vervollstaendigen (#348).

> Referenz: `compendium.md` Abschnitt 11; Spec `2026-03-10-baustellen-deposit-admin-design.md`; #354

### 12.3 Storage-Tiers

| Tier | Kapazitaet | Upgrade-Kosten |
|---|---|---|
| 1 | 50 | gratis |
| 2 | 150 | 200 CR |
| 3 | 500 | 1000 CR |

### 12.4 Trading-Post-Tiers

| Tier | Name | Upgrade-Kosten |
|---|---|---|
| 1 | NPC TRADE | gratis |
| 2 | MARKTPLATZ | 500 CR |
| 3 | AUTO-TRADE | 3000 CR |

### 12.5 Factory & Produktion

Die Factory verarbeitet Basis-Ressourcen zu verarbeiteten Guetern:

| Rezept | Output | Inputs | Zykluszeit | Research |
|---|---|---|---|---|
| `fuel_cell_basic` | 1x Fuel Cell | 2 Ore, 3 Gas | 120s | — |
| `alloy_plate_basic` | 1x Alloy Plate | 3 Ore, 1 Crystal | 180s | — |
| `circuit_board_t1` | 1x Circuit Board | 2 Crystal, 2 Gas | 240s | Ja |
| `void_shard_t1` | 1x Void Shard | 3 Crystal, 2 Ore | 300s | Ja |
| `bio_extract_t1` | 1x Bio Extract | 4 Gas, 1 Crystal | 360s | Ja |

- Factory bezieht Ressourcen automatisch aus angeschlossenem Storage
- Produktion laeuft als Lazy Evaluation (kein Tick-Loop)
- Fabrik-Nutzung erfordert AUSBAU Level >= 2 (>= 8 XP)

> Referenz: `compendium.md` Abschnitt 12; Spec `2026-03-12-station-production-design.md`; Spec `2026-03-11-acep-program-design.md`

### 12.6 Research Lab (Stufen)

| Stufe | Name | Schaltet frei | Lab-Multiplikator (Wissen) |
|---|---|---|---|
| I | Grundlabor | Tier 1 | x1.5 |
| II | Forschungslabor | Tier 2 | x2.0 |
| III | Analysestation | Tier 3 + Slot 2 | x3.0 |
| IV | Forschungsturm | Tier 4 | x4.0 |
| V | Observatorium | Tier 5 | x5.0 |

> Referenz: Spec `2026-03-09-forschung-wissen-design.md`; Spec `2026-03-12-tech-tree-rework-design.md`

---

## 13. Human Expansion & Kriegsfuehrung

### 13.1 Expansions-Modell

Menschen expandieren als Welle von (0,0), Aliens als Kugeln von ihren Heimat-Zentren. Implementiert in Phase EW (#206).

**Station-Tiers:**

| Tier | Bezeichnung | Funktion | Expansions-Trigger |
|---|---|---|---|
| I | Outpost | Tanken, Basis-Scans | — |
| II | Command Hub | Marktplatz, Quest-Board | — |
| III | Industrial Node | Mining-Drohnen, Bau-Schiffe | Spawnt Bau-Schiff -> Nachbar-Quadrant |
| IV | Gate Terminal | Aktiviert Jumpgates | Ermoeglicht Sprungexpansion |

> Referenz: Spec `2026-03-09-expansion-warfare-design.md` (#206)

### 13.2 Conquest-System

Spieler bauen Stationen in neuen Quadranten. Diese Stationen erobern den Quadranten automatisch pro Strategic Tick (60s).

**Station-Modi (State Machine):**

```
'conquest' | 'factory' | 'battle'
```

Automatische Transition: Bei 100% Shares -> `factory`. Bei fremder Fraktion + Friction > 80 -> `battle`.

**Conquest Rate (Level 1–3):**

| Level | Ohne Ressourcen (pool=0) | Mit Ressourcen (pool>0) |
|---|---|---|
| 1 | 1.0 Punkte/Tick | 1.5 Punkte/Tick |
| 2 | 1.1 Punkte/Tick | 2.0 Punkte/Tick |
| 3 | 1.2 Punkte/Tick | 3.0 Punkte/Tick |

100 Conquest-Punkte = Quadrant vollstaendig kontrolliert.

**Resource Pool**: `CONQUEST_POOL_MAX = 500`, drain `POOL_DRAIN_PER_TICK = 50` (nur im conquest-Modus).

> Referenz: Spec `2026-03-13-human-expansion-design.md` (#366)

### 13.3 Friction Score

Friction Score wird aus dem `humanityRepTier` abgeleitet:

| humanityRepTier | Friction | Grenz-Verhalten |
|---|---|---|
| ALLY / FRIENDLY | 0–20 | Friedlicher Halt |
| NEUTRAL | 21–50 | Scharmutzel, kein Stationsangriff |
| HOSTILE | 51–80 | Eskalation, Flottenbewegungen |
| ENEMY | 81–100 | Totaler Krieg, Invasionen |

**Friction-Modifier auf Conquest Rate:**

| Friction Score | Rate-Modifier |
|---|---|
| 0–20 (ALLY) | x0 (Expansion haelt) |
| 21–50 (NEUTRAL) | x0.5 |
| 51–80 (HOSTILE) | x0.25 |
| 81–100 (ENEMY) | x0 -> `battle` |

Wenn keine andere Fraktion im Quadrant: kein Friction Modifier (volle Rate).

> Referenz: Spec `2026-03-09-expansion-warfare-design.md`; Spec `2026-03-13-human-expansion-design.md`

### 13.4 Kampf-Aufloesung (Strategic Tick)

```
if attack > defense x 1.2:
  Verteidiger verliert 10% defense
  defense <= 0: Quadrant wechselt Besitzer

elif defense > attack x 1.2:
  Angreifer verliert 10% attack
  attack <= 0: Invasion abgebrochen

else (Patt):
  beide verlieren 5%
```

**Station-Werte (Defense):**
- Tier I: 100
- Tier II: 300
- Tier III: 700
- Tier IV: 1500

> Referenz: Spec `2026-03-09-expansion-warfare-design.md`

### 13.5 Preis-Scaling nach Distanz

Ressourcen-Kaufpreise an Conquest-Stationen steigen mit Quadrant-Distanz:

```typescript
function getConquestPriceBonus(qx, qy) {
  const dist = Math.floor(Math.sqrt(qx*qx + qy*qy));
  if (dist <= 10)  return dist;
  if (dist <= 50)  return 10 + (dist - 10) * 2;
  if (dist <= 100) return 90 + (dist - 50) * 3;
  return 240 + (dist - 100) * 5;
}
```

| Distanz | Bonus | Preis (base=10) |
|---|---|---|
| 5 | +5 | 15 |
| 10 | +10 | 20 |
| 30 | +50 | 60 |
| 50 | +90 | 100 |
| 100 | +240 | 250 |

> Referenz: Spec `2026-03-13-human-expansion-design.md`

### 13.6 QUAD-MAP Visualisierung

- Territorium-Farben: Quadranten eingefaerbt nach Fraktion
- Gemischte Kontrolle: `faction_shares` JSONB, anteilige Einfaerbung (gerundet auf 10%-Schritte)
- Frontline-Glow: Friction >= 50 -> pulsierender Rand
- Conflict-Icons: Friction >= 71 -> animierte Schwert-Icons
- War Ticker: Kriegereignisse als Lauftext

> Referenz: Spec `2026-03-09-expansion-warfare-design.md`; MEMORY.md (Phase EW)

### 13.7 Die Voids (Alien-Bedrohung)

Die Voids sind eine Alien-Zivilisation ohne Schiffe, Dialog oder Verhandlung (#267):

- **Todeszonen**: Void-Sektoren sind instant-kill ohne Void Shield
- **Population**: Max 32–48 Cluster global, natuerliches Einpendeln
- **Spawn**: Alle 4h geprueft, nur bei < 32 Clustern, Mindestabstand 50 Quadranten von bestehenden Fraktionen, nie innerhalb von 100 Quadranten von (0,0)
- **Lifecycle**: SPAWN -> GROWING -> SPLITTING (bei size >= split_threshold 8–16) -> neue Cluster
- **Split-Threshold**: Zufaellig 8–16 pro Cluster
- **Collision**: Benachbarte Cluster schrumpfen gegenseitig
- **Pop-Cap**: > 48 Cluster -> aelteste sterben (DYING)

**Late-Game-Module** (nur via Ancient Ruins):
- **Void Shield**: Erlaubt Reisen durch Void-Sektoren, -30% defense vs kinetisch
- **Void Gun**: Kann Void Hives zerstoeren, nutzbar als Waffe

> Referenz: Spec `2026-03-11-void-civilization-design.md` (#267)

---

## 14. Soziale Systeme

### 14.1 Friends System (#362)

Spieler koennen anderen Spielern Freundschaftsanfragen senden:

**Datenmodell** (Migration 066):
- `player_friends`: Bidirektionale Freundschaften (2 Rows pro Paar)
- `friend_requests`: Offene Anfragen (UNIQUE per Paar)
- `player_blocks`: Chat-Block (bidirektional geprueft)

**Regeln:**
- Gaeste (`isGuest`) koennen keine Freundschafts-Features nutzen
- Freundschaftsanfragen nur via PlayerCard (nicht per Name-Suche)
- Keine Begrenzung der Freundesanzahl
- Rate-Limit: 1 Request pro 2s

**Online-Status**: Redis Set `online_players` trackt alle connected Player-IDs.

**Cross-Room-Delivery**: Friend-Events via `commsBus` an alle Rooms verteilt.

> Referenz: Spec `2026-03-14-friends-system-design.md` (#362)

### 14.2 PlayerCard Modal

Zentrales Overlay ueber dem Cockpit, erreichbar von ueberall (Radar, Chat, FRIENDS-Programm):

- Spieler-Info: Name, Level, Position (wenn online im selben Room)
- Aktionen: [FREUND +], [MESSAGE], [BLOCK], [POSITION -> NAV-COM]
- Button-Zustaende wechseln dynamisch (Anfrage gesendet/empfangen/Freund/Blockiert)

### 14.3 Chat-System

| Kanal | Beschreibung |
|---|---|
| `local` | Lokaler Sektor-Chat |
| `faction` | Fraktions-Chat |
| `direct` | Privat-Nachrichten |
| `broadcast` | Admin-globale Nachricht |

**Block-Check**: Vor DIRECT-Nachrichten wird bidirektional geprueft ob Blocker/Blocked existiert. Absender erhaelt nur "konnte nicht zugestellt werden" (keine Info ob blockiert).

**Spamschutz**: Max 5 Nachrichten/Minute. Nachrichten bleiben 24h.

> Referenz: `compendium.md` Abschnitt 21; Spec `2026-03-14-friends-system-design.md`

### 14.4 Kommunikations-Reichweite

| Basis CommRange | Relay-Reichweite |
|---|---|
| 100 (BASE_COMM_RANGE) | `comm_relay`: +500 |
| + Scanner-Module | `base`: +1000 |

> Referenz: `compendium.md` Abschnitt 21

---

## 15. UI & Cockpit

### 15.1 6-Sektionen Cockpit-Layout

| Sektion | ID | Inhalt |
|---|---|---|
| Sec 1 | `cockpit-sec1` | Program Selector (12 Programme) |
| Sec 2 | `cockpit-sec2` | Main Monitor — RadarCanvas oder Programm-Content |
| Sec 3 | `cockpit-sec3` | Detail Monitor — Kontext-Panel pro Programm |
| Sec 4 | `cockpit-sec4` | Settings (ShipStatus + CombatStatus + Settings) |
| Sec 5 | `cockpit-sec5` | Navigation (SectorInfo + NavControls + HardwareControls) |
| Sec 6 | `cockpit-sec6` | Comms (CommsScreen) |

> Referenz: CLAUDE.md

### 15.2 Programme (Sec 1 -> Sec 2)

12 Programme im Program Selector:

1. **NAV-COM** — Navigation, Sektor-Info, Koordinaten-Eingabe
2. **RADAR** — Radar-Canvas mit Zoom/Pan
3. **SCAN** — Local Scan + Area Scan
4. **MINING** — Mining-Interface mit "ALLES ABBAUEN" (#279)
5. **TRADE** — Stations-Handel, eigene Vorraete sichtbar (#141)
6. **CARGO** — Ressourcen / Module / Blaupausen Tabs
7. **QUESTS** — Quest-Liste, Journal, Story, Community, Alien Rep
8. **FACTION** — Fraktions-Info und Upgrades
9. **TECH** — Tech-Tree-Canvas (sternfoermig, #297)
10. **QUAD-MAP** — Quadranten-Karte mit Territorium-Farben
11. **TV** — Werbe-Inhalte, CRT-Style Ads (#152)
12. **ACEP** — 3-Tab-Shell (ACEP/MODULE/SHOP) (#265)
13. **FRIENDS** — Freundesliste, Anfragen, Kontakte (#362)

> Referenz: CLAUDE.md; Spec `2026-03-11-acep-module-shop-design.md`; Spec `2026-03-14-friends-system-design.md`

### 15.3 Radar-Rendering

- **Spieler-Icons**: Gelb (#FFDD22), Dreieck-Symbol, Labels bei Zoom >= 3
- **Wrecks**: Symbol `Quadrat` in gedimmtem Amber
- **Quest-Ziele**: Blauer Radar-Puls (BURST_DURATION = 1500ms)
- **Bookmarks**: Farbcodiert (HOME gruen, Slots rot/blau/gelb/gruen)
- **ACEP-Icon-Evolution**: Ab XP >= 20 ueberschreibt ACEP das Standard-Icon
- **willReadFrequently**: Canvas-Option aktiviert fuer bessere Performance

> Referenz: CLAUDE.md; MEMORY.md

### 15.4 Detail Monitor (Sec 3)

Kontext-abhaengiges Panel je nach aktivem Programm:
- **NAV-COM**: NavDetailPanel (Sektor-Info, Capability-Icons)
- **SCAN**: Scan-Ergebnis-Overlay
- **ACEP**: AcepDetailPanel (Modul-Stats bei Hover, Impact-Deltas)
- **TECH**: TechDetailPanel (Knoten-Info, Kosten, Forschungs-Button)
- **QUESTS**: QuestDetailPanel (Quest-Details, WantedPoster bei Bounty)
- **Ohne Programm**: TV-Modus oder Standby

> Referenz: CLAUDE.md; diverse Specs

### 15.5 Inline-Fehlermeldungen

Fehler (z.B. "nicht genug Ressourcen") erscheinen als `InlineError`-Komponente am Ort der Aktion. Server sendet `{ code, message }` -> Client setzt `actionError`. (#153)

Einige Services senden plain string, andere `{ code, message }` — Client-Handler muss beide Formate verarbeiten.

> Referenz: CLAUDE.md; #153

### 15.6 i18n (Internationalisierung)

Phase A abgeschlossen: DE/EN Locale-Dateien, `i18n.ts`, `ui-helpers.ts`, alle UI-Strings externalisiert. Sprach-Toggle in SettingsPanel.

> Referenz: CLAUDE.md; Spec `2026-03-13-i18n-phase-a-design.md`

### 15.7 CRT-Aesthetik

- Scanlines-Overlay, Vignette
- Courier New / Monospace
- Amber (#FFB000) als Hauptfarbe
- Gedaempfte Farben mit Glow-Effekten
- ASCII-Art-Elemente (Kampf-UI, Modul-Diagramme)

---

## 16. Wreck-POIs (naechstes Feature)

### 16.1 Uebersicht

Wrecks sind einmalige, zufaellig gespawnte Points of Interest. Spieler finden sie via Scan, untersuchen sie, und bergen Item fuer Item.

**Status**: Geplant als naechstes Feature auf master.

### 16.2 Wreck-Tiers (nach Distanz)

| Distanz von (0,0) in Quadranten | Tier | Loot-Profil |
|---|---|---|
| 0–5 | 1 | Rohstoffe, selten Module |
| 5–15 | 2 | Module, gelegentlich Blueprints |
| 15–30 | 3 | Blueprints, Data Slates |
| 30–60 | 4 | Artefakte, seltene Module |
| 60+ | 5 | Artefakte, Blueprints, Data Slates mit Jumpgate-Sektoren |

### 16.3 Bergungsmechanik

**Spielerfluss:**
```
Local Scan -> Wreck gefunden -> [UNTERSUCHEN] (2 AP)
  -> WreckPanel: Inhaltsliste mit Bergungschancen in %
    -> [BERGEN] pro Item (3 AP, Laufbalken 4–8s)
      -> Erfolg: Item -> Cargo
      -> Misserfolg: Item verloren, Folgeversuche schwieriger
```

**Schwierigkeits-Tabelle:**

| Item-Typ | baseDifficulty | Basiswahrscheinlichkeit |
|---|---|---|
| resource | 0.20 | 80% |
| module | 0.50 | 50% |
| blueprint | 0.70 | 30% |
| artefact | 0.90 | 10% |
| data_slate | 0.65 | 35% |

**Chance-Formel:**
```
base = 1.0 - baseDifficulty
explorerBonus = min(explorerXp * 0.005, 0.25)
modBonus = modifier * 0.15
chance = max(0.05, min(0.95, base + explorerBonus - modBonus))
```

**Difficulty-Modifier nach Versuch:**
- Erfolg: modifier = max(-0.3, modifier - 0.1)
- Misserfolg: modifier = min(0.3, modifier + 0.15)

### 16.4 Wreck Data Slates

Drei Aktionen:
- **Consume**: Sektor aufdecken (wie normaler Scan)
- **Verkaufen**: `50 + tier * 75` Credits
- **Jumpgate einspeisen** (nur `has_jumpgate: true`): Neue Verbindung zum Ziel-Sektor

**Slate-Cap**: Max 5 Slates im Inventar.

### 16.5 Spawn-Engine

Aufgerufen alle 10 Ticks (~50s) vom StrategicTickService. Max 2 aktive Wrecks pro Quadrant.

```
spawnChance = min(0.02 + dist * 0.0025, 0.20)
```

> Referenz: Spec `2026-03-13-wreck-pois-design.md`; Migrationen 061+062

---

## 17. XP & Level-System (Spieler)

| Level | XP-Schwelle | Freischaltungen |
|---|---|---|
| 1 | 0 | Startschiff (gratis) |
| 2 | 100 | — |
| 3 | 300 | — |
| 4 | 600 | — |
| 5 | 1000 | — |
| 6 | 1500 | — |
| 7 | 2200 | — |
| 8 | 3000 | — |
| 9 | 4000 | — |
| 10 | 5000 | Max Level |

Hinweis: Das Multi-Hull-System (Scout/Freighter/Cruiser/Explorer/Battleship) wurde entfernt (#291, PR #303). Alle Spieler starten mit demselben Schiff, das sich durch ACEP und Module differenziert.

> Referenz: `compendium.md` Abschnitt 20

---

## 18. JumpGate-System

### 18.1 Seed-basierte Gates

| Parameter | Wert |
|---|---|
| Spawn-Chance | 2% der Sektoren |
| Fuel-Kosten | 1 Einheit |
| Reichweite | 50–10.000 Sektoren |
| Code-Laenge | 8 Zeichen |
| Minigame-Chance | 30% |
| Code-Chance | 50% |
| Frequenz-Schwelle | 90% Uebereinstimmung |

### 18.2 Player-built Gates

| Parameter | Wert |
|---|---|
| Baukosten | 500 CR + 20 Crystal + 5 Artefakte + 10 AP |
| Connection Level 1 | 1 Gate-Verbindung |
| Connection Level 2 | 2 Gates (300 CR + 15 Ore + 3 Art) |
| Connection Level 3 | 3 Gates (800 CR + 30 Ore + 8 Art) |
| Distance Level 1 | 250 Sektoren |
| Distance Level 2 | 500 Sektoren (300 CR + 15 Cry + 3 Art) |
| Distance Level 3 | 2.500 Sektoren (800 CR + 30 Cry + 8 Art) |

**Netzwerk-Routing**: BFS-Algorithmus, max 10 Hops, bidirektional.

### 18.3 Ancient Jumpgates

Spawn-Rate stark reduziert in #143:
- `ANCIENT_JUMPGATE_SPAWN_RATE = 0.0001` (1 pro 10.000 Sektoren)
- Nur in Nebel-Sektoren (`ANCIENT_JUMPGATE_NEBULA_ONLY = true`)
- Mindest-Quadrant-Distanz 100 von (0,0)
- Reichweite: 3 Quadranten

> Referenz: `compendium.md` Abschnitt 22; #143 (Ancient Gates zu haeufig); GAME_CONCEPT_2026.md Abschnitt 10

---

## 19. Rettungsmissionen

| Parameter | Wert |
|---|---|
| Rettungs-AP | 5 AP |
| Ablieferungs-AP | 3 AP |
| Ablauf | 30 Minuten |
| Notsignal-Chance | 8% pro Scan |
| Richtungs-Varianz | 0.3 |

**Belohnungen:**

| Quelle | Credits | Rep | XP |
|---|---|---|---|
| Scan-Event | 50 | 10 | 25 |
| NPC-Quest | 80 | 15 | 40 |
| Komm-Notsignal | 100 | 20 | 50 |

> Referenz: `compendium.md` Abschnitt 23

---

## 20. DB-Migrationen (Uebersicht)

Das Spiel hat 60+ Migrationen (001–060+), alle `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` (idempotent). Auto-Run beim Server-Start.

**Wichtige Migrationen:**

| Nr. | Inhalt |
|---|---|
| 007+ | Data Slates |
| 035 | Alien Reputation, Encounters |
| 039 | ACEP-Felder in `ships` |
| 042 | `story_quest_progress`, `humanity_reputation` |
| 043 | `quadrant_control`, `npc_fleet`, `faction_config` |
| 044 | `inventory`-Tabelle, Kontor-Orders |
| 045 | Usernames case-insensitive |
| 046 | `expansion_log` |
| 047 | `player_quests.tracked` |
| 048 | `player_quests.description` |
| 057 | Scan-Slate-Type |
| 059 | `player_tech_tree` |
| 060 | `DROP COLUMN hull_type` von ships |

**Geplant:**
| Nr. | Inhalt |
|---|---|
| 061 | `wrecks` Tabelle |
| 062 | `wreck_slate_metadata` |
| 065 | `civ_stations` erweitern (mode, conquest_pool, level) |
| 066 | Friends System (player_friends, friend_requests, player_blocks) |

> Referenz: CLAUDE.md; diverse Specs

---

## Anhang A: Versionshistorie der Spielregeln

| Aenderung | Urspruenglich | Geaendert zu | Referenz |
|---|---|---|---|
| Content-Weight `none` | 0.45 (~45%) | 0.90 (~90%) | #219 |
| Nebula Grid-Abstand | 300 | 5000 | #219 |
| Nebula Radius | 15–50 | 3–8 | #219 |
| BASE_CARGO | 3 | 10 | Playtest-Fixes |
| Cargo-Module | Standard | Verdoppelt | Playtest-Fixes |
| Hull-System | 5 Hull-Typen | Entfernt (BASE_*-Konstanten) | #291, PR #303 |
| Hyperjump | Feature-Flag (optional) | Permanent aktiv | #291, PR #303 |
| Spawn-System | Cluster bei 10M Distanz | Radius 5 um (0,0) | Forschung/Wissen-Phase |
| Wissen-Generierung | Passiv (Lab-Rate/h) | Aktiv (durch Spielaktionen) | #297 |
| Tech-Tree | Lineares 8x5 Grid | Sternfoermiger Baum (4 Aeste) | #297 |
| Schiffswechsel/Hangar | Vorhanden | Entfernt (ACEP ersetzt) | ACEP-Phase |
| ACEP-UI | Einzelner Screen | 3-Tab-Struktur (ACEP/MODULE/SHOP) | #265 |

---

## Anhang B: Offene Design-Fragen

| Frage | Status | Referenz |
|---|---|---|
| Modul-Artworks im ACEP Detail-Panel | Offen | #301 |
| Wreck-POIs Implementierung | Naechstes Feature | CLAUDE.md |
| i18n Phase B (EN-Texte vervollstaendigen) | Geplant | Roadmap |
| Void-Zivilisation Implementierung | Spec approved, nicht implementiert | #267 |
| Human Expansion vollstaendige Implementierung | Teilweise (#366) | Spec approved |
| Combat v3 (Waffen-Stat-Boni aus Tech Tree) | Geplant | #297 Spec |

---

*Dieses Dokument wird bei jeder Feature-Implementierung aktualisiert.*
*Erstellt: 2026-03-14 | Basiert auf: master (bd03ca5)*
