# voidSector — Regelwerk (Implementation)

> Dieses Dokument beschreibt **alle Spielregeln exakt so, wie sie im Code implementiert sind**.
> Jede Regel enthält die genauen Konstanten, Formeln und Quelldateien.
>
> Stand: 2026-03-14 · Branch: `master` · Commit: `bd03ca5`

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
13. [Human Expansion & Kriegsführung](#13-human-expansion--kriegsführung)
14. [Soziale Systeme](#14-soziale-systeme)
15. [UI & Cockpit](#15-ui--cockpit)

---

## 1. Universum & Navigation

### 1.1 Welt-Seed und deterministische Generierung

- **WORLD_SEED** = `77` (`constants.ts:47`)
- Jeder Sektor wird deterministisch aus `hashCoords(x, y, WORLD_SEED)` generiert (`worldgen.ts:36-48`)
- Hash-Funktion: MurmurHash-ähnliches Mixing mit Primzahlen, liefert signed 32-bit Integer
- Origin ist **(0,0)** — die Welt erstreckt sich in alle Richtungen

### 1.2 Quadranten-System

- **QUADRANT_SIZE** = `500` Sektoren (`constants.ts:2212`)
- Quadrant-Koordinaten: `qx = floor((x + 250) / 500)`, `qy = floor((y + 250) / 500)` (`quadrantEngine.ts:21-27`)
- Innere Koordinate: `abs - floor((abs + 250) / 500) * 500`, Bereich `[-250, 249]` (`constants.ts:2218-2221`)
- Quadrant-Name: Silben-basiert aus Seed, 2-4 Silben + Suffix (`quadrantEngine.ts:136-147`)
- Namensregeln: 3-24 Zeichen, nur `[a-zA-Z0-9 '\-]` (`quadrantEngine.ts:149-163`)
- **Naming-Window**: 60 Sekunden nach Entdeckung (`quadrantEngine.ts:194`)
- Quadrant (0,0) darf nicht umbenannt werden ("Zentrum" ist geschützt, `quadrantEngine.ts:202`)
- Rooms: Ein Colyseus-Room pro Quadrant (`quadrant_qx_qy`)

### 1.3 Quadrant-Konfiguration

Jeder Quadrant hat eigene Faktoren, deterministisch aus Seed:
- `resourceFactor`: 0.5–1.5 (skaliert Ressourcen-Yields)
- `stationDensity`: 0.5–1.5
- `pirateDensity`: 0.5–1.5
- `nebulaThreshold`: 0.5–1.5
- `emptyRatio`: 0.5–1.5

Quelle: `quadrantEngine.ts:29-44`

### 1.4 Zwei-Stufen-Weltgenerierung

**Stufe 1: Umgebung (Environment)** (`worldgen.ts:151-180`)

| Environment | Gewicht | Beschreibung |
|-------------|---------|--------------|
| `empty` | 1.0 | Standard |
| `nebula` | Zone-basiert | Nur über `isInNebulaZone()` |
| `black_hole` | 0.5% Einzelchance + Cluster | Impassabel |
| `star` | — | Impassabel (nur über SECTOR_ENVIRONMENT_WEIGHTS) |
| `planet` | — | Nur über erweiterte Weights |

Schwarze Löcher:
- **BLACK_HOLE_SPAWN_CHANCE** = `0.005` (0.5% pro Sektor, nur ab Distanz > 50) (`constants.ts:1905`)
- **BLACK_HOLE_MIN_DISTANCE** = `50` Chebyshev-Distanz vom Ursprung (`constants.ts:1906`)
- Cluster: Grid `200`, Chance `0.003`, Radius `0-4` Sektoren (`constants.ts:1907-1910`)

Nebel-Zonen:
- **NEBULA_ZONE_GRID** = `250` (1-2 Cluster pro 500×500-Quadrant) (`constants.ts:1847`)
- **NEBULA_ZONE_CHANCE** = `0.4` (40% der Grid-Zellen werden zu Nebel-Zentren) (`constants.ts:1848`)
- **NEBULA_ZONE_MIN_RADIUS** = `2.5`, **MAX** = `8` Sektoren (`constants.ts:1849-1850`)
- **NEBULA_SAFE_ORIGIN** = `50` (keine Nebel innerhalb 50 Sektoren vom Ursprung) (`constants.ts:1851`)

**Stufe 2: Inhalt (Content)** (`worldgen.ts:186-204`)

| Content | Gewicht |
|---------|---------|
| `none` | 0.90 (90% leer) |
| `asteroid_field` | 0.05 |
| `pirate` | 0.02 (generiert `pirate_zone` + `asteroid_field`) |
| `anomaly` | 0.01 |
| `station` | 0.016 |
| `ruin` | 0.004 |

Quelle: `constants.ts:1895-1902`

- Black Holes haben nie Content
- Nebel bekommen Content nur wenn `NEBULA_CONTENT_ENABLED = true` (`constants.ts:1913`)
- Piraten spawnen nur in **Frontier-Quadranten** (1-5 leere Nachbar-Quadranten) (`expansionEngine.ts:79-93`)
- 15% der Stationen sind "ancient" Varianten (`ANCIENT_STATION_CHANCE = 0.15`, `constants.ts:1842`)

### 1.5 Ressourcen-Yields nach Sektortyp

| Typ | Erz | Gas | Kristall |
|-----|-----|-----|----------|
| `empty` | 0 | 0 | 0 |
| `nebula` | 0 | 30 | 5 |
| `asteroid_field` | 50 | 0 | 8 |
| `anomaly` | 3 | 3 | 20 |
| `station` | 0 | 0 | 0 |
| `pirate` | 8 | 3 | 8 |

Quelle: `constants.ts:53-60`

Variation: ±30% pro Ressource basierend auf Seed-Bits (`worldgen.ts:206-219`)
Quadrant-Skalierung: `resources * quadrantConfig.resourceFactor` (`worldgen.ts:283-292`)

### 1.6 Umgebungsmodifikatoren

- **NEBULA_SCANNER_MALUS** = `-1` Sektor Scan-Reichweite in Nebeln (`constants.ts:1916`)
- **NEBULA_PIRATE_SPAWN_MODIFIER** = `0.7` (-30% Piraten-Spawn in Nebeln) (`constants.ts:1917`)
- **EMPTY_FUEL_MODIFIER** = `0.8` (-20% Treibstoffkosten im leeren Raum) (`constants.ts:1918`)

### 1.7 Passierbarkeit

Nicht passierbar (`types.ts:185-187`):
- `star` (Sterne)
- `black_hole` (Schwarze Löcher)

### 1.8 Spawn-System

- Spawn-Koordinaten: `x ∈ [1,5]`, `y ∈ [1,5]` — innerhalb Radius 5 vom Ursprung (`spawn.ts:3-8`)
- Cluster-System: Neue Spieler werden einem bestehenden Cluster zugewiesen oder ein neuer wird erstellt (`spawn.ts:10-21`)
- Legacy-Konstanten (nicht mehr für Spawn verwendet): `SPAWN_MIN_DISTANCE = 10.000.000`, `SPAWN_CLUSTER_RADIUS = 300` (`constants.ts:1838-1841`)

### 1.9 Distanz-Tier-System (NPC-Stationen)

| Tier | Distanz (euklidisch vom Ursprung) | Label |
|------|-----------------------------------|-------|
| 1 | 0–14 | MK1 |
| 2 | 15–39 | MK2 |
| 3 | 40–99 | MK3 |
| 4 | 100+ | MK4 |

Formel: `dist = sqrt(x² + y²)` (`stationProduction.ts:113-119`)

---

## 2. Aktionspunkte (AP)

### 2.1 Basis-Werte

| Parameter | Wert | Quelle |
|-----------|------|--------|
| Max AP | `100` | `constants.ts:25` |
| Start-AP | `100` | `constants.ts:26` |
| Basis-Regen | `0.5 AP/s` (1 AP alle 2 Sekunden) | `constants.ts:27` |
| Basis-Hull-Regen (ohne Generator) | `0.08 AP/s` | `constants.ts:476` |

### 2.2 Lazy Evaluation

AP wird **nicht** per Tick berechnet, sondern **lazy** bei jeder Aktion (`ap.ts:13-33`):

```
elapsed = (now - lastTick) / 1000
regenerated = elapsed * regenPerSecond
newCurrent = min(max, current + regenerated)
current = floor(newCurrent)
```

- NaN-Schutz: Korrupte Redis-Daten werden auf Defaults zurückgesetzt (`ap.ts:15-18`)
- Negative Zeitdifferenz: Keine Regeneration (`ap.ts:21`)

### 2.3 AP-Kosten

| Aktion | AP-Kosten | Quelle |
|--------|-----------|--------|
| Normaler Sprung | `1` (Basis, aus `ship.apCostJump`) | `constants.ts:31` |
| Area-Scan (Scanner Lv.1) | `3` | `constants.ts:38` |
| Area-Scan (Scanner Lv.2) | `6` | `constants.ts:39` |
| Area-Scan (Scanner Lv.3) | `10` | `constants.ts:40` |
| Area-Scan (Scanner Lv.4) | `14` | `constants.ts:41` |
| Area-Scan (Scanner Lv.5) | `18` | `constants.ts:42` |
| Lokal-Scan | `1` | `constants.ts:45` |
| Mining | `0` | `constants.ts:33` |
| Flucht (Kampf) | `2` | `constants.ts:313` |
| Bauen (variiert) | Siehe Strukturen | `constants.ts:84-97` |
| Lab-Upgrade | `20` | `commands.ts:559` |
| Data-Slate (Sektor) | `1` | `constants.ts:260` |
| Data-Slate (Area) | `3 + (scannerLevel - 1)` | `commands.ts:334` |
| Custom Data-Slate | `2` | `constants.ts:2159` |
| Rettung | `5` | `constants.ts:2141` |
| Rettung abliefern | `3` | `constants.ts:2142` |
| Wreck untersuchen | `2` | `constants.ts:2785` |
| Wreck bergen | `3` | `constants.ts:2786` |

### 2.4 AP-Regeneration mit Generator-Modul

Formel (`shipCalculator.ts:223-237`):
```
regen = BASE_HULL_AP_REGEN (0.08)
+ Σ generator.apRegenPerSecond * powerLevelMultiplier * (currentHp / maxHp)
```

Power-Level-Multiplikatoren (`constants.ts:479-481`):
| Level | Multiplikator |
|-------|--------------|
| `off` | 0.0 |
| `low` | 0.4 |
| `mid` | 0.7 |
| `high` | 1.0 |

Generator AP/s-Werte nach Tier:
| Generator | AP/s |
|-----------|------|
| MK.I | 0.20 |
| MK.II | 0.30 |
| MK.III | 0.50 |
| MK.IV | 0.70 |
| MK.V | 1.00 |

### 2.5 spendAP-Mechanik

1. Zuerst Regeneration berechnen (lazy eval)
2. Prüfe ob `current >= cost`
3. Neuer Wert: `floor(current - cost)`

Quelle: `ap.ts:39-43`

---

## 3. Treibstoff & Hyperdrive

### 3.1 Basis-Treibstoffwerte

| Parameter | Wert | Quelle |
|-----------|------|--------|
| Basis-Tank | `10.000` | `constants.ts:2057` |
| Minimum-Tank | `1.000` | `constants.ts:2053` |
| Basis-Kosten/Sprung | `100` (nur für Hyperjumps) | `constants.ts:2058` |
| Treibstoffpreis/Einheit | `0.01 Credits` | `constants.ts:2052` |
| Jumpgate-Treibstoff | `1` | `constants.ts:2124` |

### 3.2 Normale Sprünge

- Kosten: **0 Treibstoff** (`constants.ts:2183`)
- AP-Kosten: `1` (Basis) − Module-Boni (`constants.ts:2182`)
- Reichweite: `1` Sektor (Chebyshev-Distanz) (`constants.ts:2184`)
- Validierung: `dx <= jumpRange && dy <= jumpRange && !(dx === 0 && dy === 0)` (`commands.ts:64-68`)

### 3.3 Hyperjump-System (V2)

**AP-Formel** (`jumpCalc.ts:10-11`):
```
AP = max(HYPERJUMP_MIN_AP, HYPERJUMP_BASE_AP - (engineSpeed - 1) * HYPERJUMP_AP_PER_SPEED)
   = max(1, 5 - (engineSpeed - 1) * 1)
```

| Engine-Speed | AP-Kosten |
|-------------|-----------|
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |

**Treibstoff-Formel V2** (`jumpCalc.ts:29-38`):
```
cost = max(1, ceil(BASE_FUEL_PER_JUMP * distance * (1 - driveEfficiency)))
     = max(1, ceil(100 * distance * (1 - efficiency)))
```

- `driveEfficiency` wird auf `[0, 1]` geclamped
- Höhere Drive-Module geben bessere Effizienz (z.B. MK.III = 0.2, MK.V = 0.5)

**Engine-Speed-Mapping** (`constants.ts:2196-2204`):

| Modul | Speed |
|-------|-------|
| none | 1 |
| drive_mk1 | 2 |
| drive_mk2 | 3 |
| drive_mk3 | 4 |
| drive_mk4 | 5 |
| drive_mk5 | 5 |
| void_drive | 5 |

### 3.4 Hyperdrive-Aufladung

Lazy Evaluation analog zu AP (`hyperdriveCalc.ts:25-30`):
```
elapsed = max(0, (now - lastTick) / 1000)
charge = min(maxCharge, charge + elapsed * regenPerSecond)
```

- Start: Voll aufgeladen (`hyperdriveCalc.ts:7-18`)
- Alle Drives haben `hyperdriveRegen: 4.0` pro Sekunde
- Maximale Ladung nach Drive-Tier: MK.I=32, MK.II=64, MK.III=128, MK.IV=256, MK.V=512, VoidDrive=192

### 3.5 Treibstoff-Station-Produktion

| Parameter | Wert | Quelle |
|-----------|------|--------|
| Baseline pro Tick (ohne Gas) | `10` | `constants.ts:2068` |
| Rate mit Gas pro Tick | `100` | `constants.ts:2069` |
| Gas verbraucht pro Tick | `1` | `constants.ts:2070` |
| Max Stock | `50.000` | `constants.ts:2071` |

Level-Effizienz (`constants.ts:2073-2079`):
| Level | Multiplikator |
|-------|--------------|
| 1 | 1.0× |
| 2 | 1.2× |
| 3 | 1.4× |
| 4 | 1.6× |
| 5 | 2.0× |

### 3.6 Treibstoffpreis-Modifikator nach Reputation

`getFuelRepPriceModifier(reputation)` (`constants.ts:2083-2089`):

| Reputation | Multiplikator |
|------------|--------------|
| < -50 (feindlich) | 2.0× |
| -50 bis -11 (unfreundlich) | 1.3× |
| -10 bis +25 (neutral) | 1.0× |
| +26 bis +50 (freundlich) | 0.85× |
| > +50 (geehrt) | 0.65× |

### 3.7 Hyperdrive GAS-Aufladung

- **HYPERDRIVE_CHARGE_PER_GAS** = `4` (1 GAS → 4 Hyperdrive-Ladung) (`constants.ts:2807`)

---

## 4. Scanning & Erkundung

### 4.1 Radar-Radius

- **RADAR_RADIUS** = `3` Sektoren um den Spieler (`constants.ts:49`)

### 4.2 Area-Scan

AP-Kosten und Radius nach Scanner-Level (`constants.ts:37-43`):

| Scanner-Level | AP-Kosten | Radius |
|--------------|-----------|--------|
| 1 | 3 | 3 |
| 2 | 6 | 6 |
| 3 | 10 | 9 |
| 4 | 14 | 12 |
| 5 | 18 | 15 |

Validierung: `commands.ts:99-114`

### 4.3 Lokal-Scan

- AP-Kosten: `1` (`constants.ts:45`)
- Versteckte Signaturen: Wenn `scannerLevel < 3` → `hiddenSignatures = true` (`commands.ts:95`)

### 4.4 Scan-Events

- **SCAN_EVENT_CHANCE** = `0.15` (15% bei jedem Scan) (`constants.ts:383`)
- Typen: `pirate_ambush`, `distress_signal`, `anomaly_reading`, `artifact_find`, `blueprint_find`

### 4.5 Artefakt-Drop-Chancen

| Quelle | Chance | Quelle |
|--------|--------|--------|
| `artifact_find` Scan-Event | 50% | `constants.ts:250` |
| `anomaly_reading` Bonus | 8% | `constants.ts:251` |
| Piraten-Beute | 3% | `constants.ts:252` |

### 4.6 Data Slates

**Sektor-Slate:**
- AP-Kosten: `1` (`constants.ts:260`)
- Erstellt Daten des aktuellen Sektors

**Area-Slate:**
- AP-Kosten: `3 + (scannerLevel - 1)` (`commands.ts:334`)
- Radius nach Scanner-Level (`constants.ts:263-267`):
  | Level | Radius |
  |-------|--------|
  | 1 | 2 |
  | 2 | 3 |
  | 3 | 4 |

**Speicher-Limit:** Slate-Anzahl begrenzt durch `memory`-Stat des Schiffs (`commands.ts:340`)
- **BASE_SCANNER_MEMORY** = `10` (`constants.ts:269`)
- Module können Memory erhöhen (z.B. Scanner MK.I +4, MK.II +6, MK.III +10)

**NPC-Buyback:** `sectorCount * 5 Credits` (`constants.ts:262`)

**Custom Slates:**
- AP-Kosten: `2` (`constants.ts:2159`)
- Credit-Kosten: `5` (`constants.ts:2160`)
- Max Koordinaten: `20` (`constants.ts:2161`)
- Max Codes: `10` (`constants.ts:2162`)
- Max Notiz-Länge: `500` (`constants.ts:2163`)

### 4.7 Staleness-System

- **STALENESS_DIM_HOURS** = `24` (Sektoren dimmen nach 24h) (`constants.ts:2209`)
- **STALENESS_FADE_DAYS** = `7` (nur noch Koordinaten nach 7 Tagen) (`constants.ts:2210`)

---

## 5. Mining & Ressourcen

### 5.1 Mining-Mechanik

- **MINING_RATE_PER_SECOND** = `1` Einheit/Sekunde (`constants.ts:62`)
- AP-Kosten: `0` (Mining ist kostenlos) (`constants.ts:33`)
- Treibstoff-Kosten: `0` (`constants.ts:2176`)

**Menge berechnen** (`mining.ts:37-47`):
```
elapsed = (now - startedAt) / 1000
raw = elapsed * rate
mined = floor(min(raw, sectorYield, cargoSpace))
```

### 5.2 Mining-Validierung

Bedingungen (`commands.ts:122-147`):
1. Ressource muss `ore`, `gas` oder `crystal` sein
2. Nicht bereits am Minen
3. Sektor muss die Ressource enthalten (> 0)
4. Frachtraum darf nicht voll sein
5. `mineAll`-Flag: Schürft alle verfügbaren Ressourcen-Typen

### 5.3 Mining-Bonus

Gesamtbonus = Modul-Mining-Bonus + ACEP-Mining-Bonus + Fraktions-Mining-Multiplikator

Mining-Module (`constants.ts:1087-1164`):

| Modul | miningBonus |
|-------|------------|
| mining_laser_mk1 | +15% |
| mining_laser_mk2 | +30% |
| mining_laser_mk3 | +50% |
| mining_laser_mk4 | +75% |
| mining_laser_mk5 | +100% |

ACEP-Mining-Bonus: `ausbau_xp * 0.006` (max +30% bei Cap) (`acepXpService.ts:64`)

### 5.4 Ressourcen-Regeneration

- **RESOURCE_REGEN_DELAY_TICKS** = `50` Ticks Verzögerung (`constants.ts:64`)
- **RESOURCE_REGEN_INTERVAL_TICKS** = `12` Ticks pro Einheit (1 pro 60s) (`constants.ts:65`)

### 5.5 Ressourcen-Typen

Minebar: `ore`, `gas`, `crystal` (`types.ts:25`)
Ressource (erweitert): `ore`, `gas`, `crystal`, `artefact` (`types.ts:26`)
Item-Typen: `resource`, `module`, `blueprint`, `prisoner`, `data_slate` (`types.ts:28`)

Verarbeitete Güter:
- `fuel_cell`, `circuit_board`, `alloy_plate`, `void_shard`, `bio_extract` (`types.ts:1287-1292`)

### 5.6 Cargo-System

- **BASE_CARGO** = `20` (`constants.ts:2059`)
- Physischer Cargo-Total: `ore + gas + crystal + artefact` (`constants.ts:271-273`)
- Cargo-Kapazität = BASE_CARGO + Modul-Effekte (ACEP-Multiplikator angewendet)
- Inventar: Unified `inventory`-Tabelle für Ressourcen, Module, Blaupausen

Cargo-Module (`constants.ts:676-1344`):
| Modul | cargoCap | safeSlotBonus |
|-------|----------|---------------|
| cargo_mk1 | +10 | — |
| cargo_mk2 | +24 | +1 |
| cargo_mk3 | +50 | +2 |
| cargo_mk4 | +80 | +3 |
| cargo_mk5 | +120 | +5 |

---

## 6. Handel & Wirtschaft

### 6.1 NPC-Basispreise

| Ressource | Basispreis (Credits/Einheit) |
|-----------|----------------------------|
| Erz | 10 |
| Gas | 15 |
| Kristall | 25 |

Quelle: `constants.ts:164-168`

### 6.2 NPC-Handels-Spreads

- **Kaufpreis** (Spieler kauft): `ceil(basePrice * 1.2 * amount)` (`constants.ts:170`)
- **Verkaufspreis** (Spieler verkauft): `floor(basePrice * 0.8 * amount)` (`constants.ts:171`)
- Artefakte können **nicht** an NPCs gehandelt werden (`commands.ts:250-256`)

### 6.3 Dynamische Preise

Quelle: `dynamicPriceService.ts`

Basis-Preise:
| Ressource | Preis |
|-----------|-------|
| ore | 10 |
| gas | 15 |
| crystal | 25 |
| exotic | 200 |

**Kaufpreis-Formel** (`dynamicPriceService.ts:22-41`):
```
distanceFactor = 1.0 + min(chebyshev / 5000, 1.0)
nebulaPremium = 1.2 wenn Nebula, sonst 1.0
repFactor = 1.0 - reputationModifier * 0.5
price = round(basePrice * distanceFactor * nebulaPremium * repFactor)
```

**Verkaufspreis**: `round(buyPrice * 0.6)` (60% des Kaufpreises) (`dynamicPriceService.ts:48-57`)

### 6.4 Reputations-Preismodifikatoren

| Tier | Multiplikator |
|------|--------------|
| hostile | 1.5× |
| unfriendly | 1.0× |
| neutral | 1.0× |
| friendly | 0.9× |
| honored | 0.75× |

Quelle: `constants.ts:293-299`

### 6.5 NPC-Station-Level

| Level | Name | Max Stock | XP-Schwelle |
|-------|------|-----------|-------------|
| 1 | Outpost | 200 | 0 |
| 2 | Station | 500 | 500 |
| 3 | Hub | 1.200 | 2.000 |
| 4 | Port | 3.000 | 6.000 |
| 5 | Megastation | 8.000 | 15.000 |

Quelle: `constants.ts:174-180`

Station-XP-Quellen:
- **Besuch**: +5 XP (`constants.ts:244`)
- **Handel pro Einheit**: +1 XP (`constants.ts:245`)
- **Quest abgeschlossen**: +15 XP (`constants.ts:246`)
- **XP-Verfall**: -1 XP/Stunde (`constants.ts:243`)

### 6.6 Station-Produktion (NPC-Stationen)

Passive Ressourcen-Generierung pro Tier (`stationProduction.ts:47-111`):

| Tier | Erz/h | Gas/h | Kristall/h | Max Stockpile |
|------|-------|-------|-----------|---------------|
| 1 | 2 | 1 | 0 | 100 |
| 2 | 4 | 2 | 1 | 150 |
| 3 | 6 | 3 | 2 | 200 |
| 4 | 8 | 4 | 3 | 300 |

Ankaufpreise (Station kauft von Spieler): Erz=8, Gas=12, Kristall=16 (`stationProduction.ts:45`)

### 6.7 Fabrik-Produktion

Rezepte (`constants.ts:183-241`):

| Rezept | Input | Output | Dauer (s) | Forschung |
|--------|-------|--------|-----------|-----------|
| fuel_cell_basic | 2 Erz + 3 Gas | 1 Fuel Cell | 120 | Nein |
| alloy_plate_basic | 3 Erz + 1 Kristall | 1 Alloy Plate | 180 | Nein |
| circuit_board_t1 | 2 Kristall + 2 Gas | 1 Circuit Board | 240 | Ja |
| void_shard_t1 | 3 Kristall + 2 Erz | 1 Void Shard | 300 | Ja |
| bio_extract_t1 | 4 Gas + 1 Kristall | 1 Bio Extract | 360 | Ja |

### 6.8 Lager-System (Storage)

| Tier | Kapazität | Upgrade-Kosten (Credits) |
|------|-----------|-------------------------|
| 1 | 50 | 0 |
| 2 | 150 | 200 |
| 3 | 500 | 1.000 |

Quelle: `constants.ts:399-403`

### 6.9 Handelsposten-Tiers

| Tier | Name | Upgrade-Kosten |
|------|------|----------------|
| 1 | NPC TRADE | 0 |
| 2 | MARKTPLATZ | 500 |
| 3 | AUTO-TRADE | 3.000 |

Quelle: `constants.ts:406-410`

### 6.10 Handelsrouten

- **Max Routen**: `3` (`constants.ts:2153`)
- **Min Zyklus**: `15` Minuten (`constants.ts:2154`)
- **Max Zyklus**: `120` Minuten (`constants.ts:2155`)
- **Treibstoff/Distanz**: `0.5` (`constants.ts:2156`)

---

## 7. Kampf

### 7.1 Piraten-Generierung

**Piraten-Level** (`constants.ts:318-319`):
```
level = min(PIRATE_MAX_LEVEL, floor(distance / PIRATE_LEVEL_DISTANCE_DIVISOR))
      = min(10, floor(distance / 50))
```

**Piraten-Stats** (`constants.ts:321-324`):
```
HP = 20 + level * 10
Damage = 5 + level * 3
```

**Verhandeln** (`commands.ts:406-414`):
- Möglich wenn `pirateReputation >= 1` (friendly)
- Kosten: `pirateLevel * 10` Credits

### 7.2 Kampf v1 (Legacy)

**Flucht** (`commands.ts:433-443`):
- AP-Kosten: `2` (`constants.ts:313`)
- Fluchtchance: `0.6 + shipAttack * 0.02 - pirateLevel * 0.05`
- Roll: `(battleSeed >>> 0) % 100 / 100`
- Bei gescheiterter Flucht: normaler Kampf

**Kampf-Auflösung** (`commands.ts:466-502`):
```
playerPower = shipAttack + (seed >>> 8) % 20
piratePower = pirateDamage + (seed >>> 16) % 10
```

**Sieg**: `playerPower >= piratePower`
- Beute: `pirateLevel * 10 + (seed >>> 4) % 50` Credits
- 3% Artefakt-Chance
- Rep-Änderung: -3
- XP: `pirateLevel * 5`

**Niederlage**:
- Cargo-Verlust: `25-50%` jeder Ressource (`constants.ts:314-315`)
- XP: `ceil(pirateLevel * 2)`

### 7.3 Kampf v2 (Taktik-System)

**Max Runden**: `5` (`constants.ts:342`)
**Schadens-Roll**: `0.85–1.15` Multiplikator (`constants.ts:343-344`)

Taktik-Modifikatoren (`constants.ts:327-331`):
| Taktik | Schaden | Verteidigung |
|--------|---------|-------------|
| Assault | 1.3× | 0.8× |
| Balanced | 1.0× | 1.0× |
| Defensive | 0.75× | 1.35× |

Spezialaktionen:
- **Aim**: +50% Genauigkeit, 35% Disable-Chance für 2 Runden (`constants.ts:334-336`)
- **Evade**: 50% Ausweich-Chance (`constants.ts:337`)
- **EMP**: 75% Treffer-Chance, 2 Runden Deaktivierung (`constants.ts:338-339`)

### 7.4 Kampf-Engine (Neues System)

Quelle: `combatEngine.ts`

**Initialisierung** (`combatEngine.ts:48-84`):
- Max EP-Puffer: `generatorTier * 2`
- Max Runden: `10` (Draw bei Erreichen)

**EP-Berechnung pro Runde** (`combatEngine.ts:93-113`):
```
generatorEp = epPerRound * (currentHp / maxHp) * powerLevelMultiplier
availableEp = generatorEp + epBuffer
```

EP-Kosten pro Modul-Kategorie (`constants.ts:467-473`):

| Kategorie | off | low | mid | high |
|-----------|-----|-----|-----|------|
| weapon | 0 | 2 | 4 | 6 |
| shield | 0 | 1 | 2 | 4 |
| drive | 0 | 2 | 4 | 6 |
| scanner | 0 | 1 | 2 | 3 |
| repair | 0 | 1 | 2 | 4 |

**Waffen-Schaden** (`combatEngine.ts:168`):
```
weaponDamage = weaponTier * 8 * powerMultiplier
```
- Aim: `+20%` Bonus (`combatEngine.ts:171`)

**Schild-Absorption** (`combatEngine.ts:176-178`):
```
shieldAbsorption = shieldTier * 4 * powerMultiplier
```

**Feind-Schaden** (`combatEngine.ts:299`):
```
enemyWeaponDamage = enemyLevel * 5
```

**Modul-Schaden** (`combatEngine.ts:330-337`):
```
moduleDamage = max(1, floor(netPlayerDamage * 0.3))
```
- Trifft zufälliges Spieler-Modul

**Reaktionen** (`combatEngine.ts:351-374`):
- Shield Boost: -30% eingehender Schaden
- ECM Pulse: -50% eingehender Schaden
- Emergency Eject: Bei HP < 15% — Cargo verloren, garantierte Flucht

**Ancient Ability** (`combatEngine.ts:377-400`):
- Aufladung: 3 Runden ohne Nutzung
- Explorer Passive: Alle feindlichen Module aufdecken
- Energy Pulse: 20 direkter Schaden (ignoriert Schilde)
- Einmal pro Kampf

**Niederlage-Bedingungen** (`combatEngine.ts:402-430`):
1. Generator zerstört → Defeat
2. Player HP ≤ 0 → Defeat
3. Enemy HP ≤ 0 → Victory
4. Runde ≥ 10 → Draw

### 7.5 Modul-Schadenszustände

| Ratio (HP/maxHP) | Zustand |
|-------------------|---------|
| > 0.75 | `intact` |
| > 0.50 | `light` |
| > 0.25 | `heavy` |
| ≤ 0.25 | `destroyed` |

Quelle: `shipCalculator.ts:197-204`

Power-Level-Caps nach Schadenszustand (`shipCalculator.ts:207-220`):
- `destroyed`: immer `off`
- `heavy`: maximal `low`
- `light`: maximal `mid`
- `intact`: keine Einschränkung

### 7.6 Modul-HP nach Tier

| Tier | HP |
|------|----|
| 1 | 20 |
| 2 | 35 |
| 3 | 55 |
| 4 | 80 |
| 5 | 110 |

Quelle: `constants.ts:462-464`

### 7.7 Station-Verteidigung

- **Stations-HP**: `500` (`constants.ts:347`)
- **Reparaturkosten**: 5 Credits/HP + 1 Erz/HP (`constants.ts:348-349`)
- **Max Kampf-Runden**: `10` (`constants.ts:350`)

Verteidigungsanlagen (`constants.ts:352-378`):

| Typ | Schaden | Schild | Regen | Spezial |
|-----|---------|--------|-------|---------|
| defense_turret_mk1 | 15 | — | — | — |
| defense_turret_mk2 | 30 | — | — | — |
| defense_turret_mk3 | 50 | — | — | — |
| station_shield_mk1 | — | 150 | 10 | — |
| station_shield_mk2 | — | 350 | 25 | — |
| ion_cannon | 80 | — | — | 1× pro Kampf, ignoriert Schilde |

---

## 8. Fraktionen & Diplomatie

### 8.1 NPC-Fraktionen

Gewichtung (`constants.ts:277-283`):
| Fraktion | Gewicht |
|----------|---------|
| independent | 0.30 |
| traders | 0.28 |
| scientists | 0.25 |
| pirates | 0.16 |
| ancients | 0.01 |

### 8.2 Reputations-Tiers

| Tier | Min | Max |
|------|-----|-----|
| hostile | -100 | -51 |
| unfriendly | -50 | -1 |
| neutral | 0 | 0 |
| friendly | 1 | 50 |
| honored | 51 | 100 |

Quelle: `constants.ts:285-291`

Tier-Berechnung (`commands.ts:530-536`):
```
rep ≤ -51 → hostile
rep < 0   → unfriendly
rep == 0  → neutral
rep ≤ 50  → friendly
rep > 50  → honored
```

### 8.3 Spieler-Fraktions-Upgrade-Baum

3 Tiers mit je 2 Optionen (`constants.ts:2096-2119`):

| Tier | Option A | Option B | Kosten |
|------|----------|----------|--------|
| 1 | MINING BOOST (+15% Rate) | CARGO EXPANSION (+3 Cargo) | 500 |
| 2 | SCAN RANGE (+1 Radius) | AP REGEN (+20% Regen) | 1.500 |
| 3 | COMBAT BONUS (+15%) | TRADE DISCOUNT (-10% Preise) | 5.000 |

Implementierte Boni (`factionBonuses.ts:28-51`):

| Tier.Wahl | Effekt |
|-----------|--------|
| 1.A | `miningRateMultiplier = 1.15` |
| 1.B | `cargoCapBonus = 3` |
| 2.A | `scanRadiusBonus = 1` |
| 2.B | `apRegenMultiplier = 1.2` |
| 3.A | `combatMultiplier = 1.15` |
| 3.B | `tradePriceMultiplier = 0.9` |

### 8.4 Fraktions-Aktionen

Rangbasierte Berechtigungen (`commands.ts:372-396`):
- **Leader**: Alles (promote, demote, disband, setJoinMode, kick, invite)
- **Officer**: kick (nur members), invite
- **Member**: join, leave

### 8.5 Kosmische Fraktionen (Alien-Rassen)

11 Fraktionen (`constants.ts:2230-2243`):
`humans`, `archivists`, `consortium`, `kthari`, `mycelians`, `mirror_minds`, `tourist_guild`, `silent_swarm`, `helions`, `axioms`, `scrappers`

Menschliches Startgebiet: Quadranten (0,0) bis (4,4) — 25 Quadranten (`constants.ts:2246-2272`)

Alien-Startregionen (Distanz von Ursprung) (`constants.ts:2275-2299`):
| Fraktion | Position (qx,qy) | Radius |
|----------|-------------------|--------|
| scrappers | (65,70) + (80,65) | 2 |
| archivists | (95,105) + (110,90) | 3+2 |
| consortium | (200,210) | 4 |
| kthari | (270,280) + (290,260) | 5+3 |
| mycelians | (410,420) | 3 |
| mirror_minds | (550,560) | 2 |
| tourist_guild | (690,700) | 6 |
| silent_swarm | (1090,1100) | 8 |
| helions | (1400,1390) | 4 |
| axioms | (2800,2790) | 2 |

### 8.6 Humanity-Reputation

3-Tier-System (`humanityRepTier.ts`):

| Rep-Wert | Tier | Encounter-Modifier |
|----------|------|--------------------|
| < -200 | FEINDSELIG | 0.5× |
| -200 bis +200 | NEUTRAL | 1.0× |
| > +200 | FREUNDLICH | 1.5× |

---

## 9. Quests

### 9.1 Basis-Regeln

- **Max aktive Quests**: `3` (`constants.ts:380`)
- **Quest-Ablauf**: `7` Tage (`constants.ts:381`)
- Quest-Typen: `fetch`, `delivery`, `scan`, `bounty`, `bounty_chase`, `bounty_trail`, `bounty_combat`, `bounty_deliver`, `scan_deliver` (`types.ts:653-662`)

### 9.2 Story-Quest-Kette

9 Kapitel, distanzbasiert (Chebyshev-Quadrant-Distanz) (`storyQuestChain.ts:25-179`):

| Kapitel | Min Q-Dist | Titel | Branches |
|---------|-----------|-------|----------|
| 0 | 6 | DAS AUFBRUCH-SIGNAL | — |
| 1 | 40 | DIE AUSSENPOSTEN-ANOMALIE | — |
| 2 | 100 | ERSTKONTAKT — DIE ARCHIVARE | A: +30 archivists, B: -5 archivists |
| 3 | 150 | DER ERSTE ZWEIFEL | — |
| 4 | 200 | DER K'THARI-TEST | A: +50 kthari, B: -20 kthari |
| 5 | 300 | DIE LEBENDE WELT | A: +40 mycelians/-20 kthari, B: -50 mycelians, C: — |
| 6 | 500 | TOURISTEN-INVASION | A: +30 tourist_guild, B: -10 tourist_guild |
| 7 | 1000 | DAS UNMÖGLICHE ARTEFAKT | — |
| 8 | 3000 | DER RAND | A: —, B: +10 archivists/+5 mycelians, C: +5 archivists |

Freischaltung (`storyQuestChain.ts:186-200`):
- `currentQDist >= chapter.minQDist`
- Vorheriges Kapitel muss abgeschlossen sein
- Noch nicht abgeschlossen

### 9.3 Quest-Belohnungen

Belohnungsstruktur (`types.ts:704-711`):
- `credits`, `xp`, `reputation`, `reputationPenalty?`, `rivalFactionId?`, `wissen?`

---

## 10. ACEP (Pilot-Entwicklung)

### 10.1 XP-Budget

- **Gesamt-Cap**: `100` XP (`acepXpService.ts:21`)
- **Pfad-Cap**: `50` XP pro Pfad (`acepXpService.ts:20`)
- 4 Pfade: `ausbau`, `intel`, `kampf`, `explorer`

### 10.2 ACEP-Level-Schwellwerte

| Level | XP-Schwelle |
|-------|------------|
| 1 | 0 |
| 2 | 8 |
| 3 | 18 |
| 4 | 32 |
| 5 | 50 |

Quelle: `constants.ts:445-451`

### 10.3 ACEP-Level-Multiplikatoren

Diese Multiplikatoren werden auf positive Modul-Effekte angewendet (`constants.ts:453-459`):

| Level | Multiplikator |
|-------|--------------|
| 1 | 1.0× |
| 2 | 1.1× |
| 3 | 1.2× |
| 4 | 1.35× |
| 5 | 1.5× |

Anwendung (`shipCalculator.ts:91-108`): Für jedes Modul wird der höchste ACEP-Level seiner `acepPaths` bestimmt. Positive Stat-Werte werden mit dem Multiplikator multipliziert. Negative Werte bleiben unverändert. `damageMod` ist immer additiv.

### 10.4 Extra-Slot-Freischaltung

Schwellwerte (ausbau-XP) (`constants.ts:441`):

| Slots freigeschaltet | Benötigtes ausbau-XP |
|---------------------|---------------------|
| 1 | 10 |
| 2 | 25 |
| 3 | 40 |
| 4 | 50 |

### 10.5 ACEP-Effekte (Gameplay)

Quelle: `acepXpService.ts:54-80`

**AUSBAU-Pfad:**
- Extra Modul-Slots: 1 (bei 10 XP), 2 (25), 3 (40), 4 (50)
- Cargo-Multiplikator: `1.0 + ausbau * 0.01` (max 1.50× bei 50 XP)
- Mining-Bonus: `ausbau * 0.006` (max +30%)

**INTEL-Pfad:**
- Scan-Radius-Bonus: +1 (bei 20 XP), +2 (40), +3 (50)
- Staleness-Multiplikator: `1.0 + intel * 0.02` (max 2.0×)

**KAMPF-Pfad:**
- Combat-Damage-Bonus: `kampf * 0.004` (max +20%)
- Shield-Regen-Bonus: `kampf * 0.006` (max +30%)

**EXPLORER-Pfad:**
- Ancient Detection: ab 25 XP
- Anomaly-Chance-Bonus: `explorer * 0.002` (max +0.1)
- Helion Decoder: ab 50 XP
- Wreck Detection: ab 25 XP

### 10.6 ACEP-Boost (Credits+Wissen → +5 XP)

Kosten-Tiers (`constants.ts:2540-2553`):

| Aktuelles XP | Credits | Wissen |
|-------------|---------|--------|
| 0–19 | 100 | 3 |
| 20–39 | 300 | 8 |
| 40–49 | 600 | 15 |
| ≥ 50 | — (Cap) | — |

Jeder Boost gibt `+5 XP` in den gewählten Pfad (`acepXpService.ts:160-182`).

### 10.7 Trait-System

6 Traits, basierend auf XP-Verteilung (`traitCalculator.ts:21-51`):

| Trait | Bedingung |
|-------|-----------|
| `veteran` | kampf ≥ 20 |
| `curious` | intel ≥ 20 |
| `ancient-touched` | explorer ≥ 15 |
| `reckless` | kampf ≥ 15 UND ausbau ≤ 5 |
| `cautious` | ausbau ≥ 20 UND kampf ≤ 5 |
| `scarred` | kampf ≥ 10 UND (intel + ausbau + explorer) ≤ kampf * 0.4 |

Prioritätsreihenfolge für dominanten Trait (`traitCalculator.ts:58-71`):
`ancient-touched` > `veteran` > `scarred` > `reckless` > `cautious` > `curious`

### 10.8 Radar-Icon-Evolution

ACEP-XP-Tiers (`constants.ts:2494-2507`):

| Total XP | Tier | Grid-Größe |
|----------|------|-----------|
| 0–19 | 1 | 3×3 |
| 20–49 | 2 | 5×5 |
| 50–79 | 3 | 7×7 |
| 80–100 | 4 | 9×9 |

Dominanter Pfad (> 40% des Totals) bestimmt die Form (`constants.ts:2509-2524`):
- `ausbau`: Festung
- `intel`: Kristall/Diamant
- `kampf`: Speer/Lanze
- `explorer`: Asymmetrisch/Galaxie
- `none`: Standard (wenn kein Pfad > 40%)

### 10.9 Permadeath & Legacy

Quelle: `permadeathService.ts`

**Schiffszerstörung** (`permadeathService.ts:98-186`):
1. Wrack-POI wird erstellt
2. 25% Chance pro Modul auf Bergbarkeit (deterministisch)
3. Altes Schiff deaktiviert (bleibt in DB)
4. Neues "Phoenix"-Schiff mit:
   - 30% des XP jedes Pfads (floor)
   - 1 dominanter Trait
   - Generation +1
   - 50 Fuel Start

**Wrack-Tier** (für Radar-Icon):
| Total XP | Tier |
|----------|------|
| 80+ | 4 |
| 50+ | 3 |
| 20+ | 2 |
| < 20 | 1 |

**Eject Pod** (`permadeathService.ts:192-194`):
- Bedingung: HP < 15% der Max-HP
- Effekt: Alle Cargo gelöscht, Schiff überlebt

---

## 11. Schiffsmodule & Techbaum

### 11.1 Basis-Schiffswerte

| Stat | Basiswert | Quelle |
|------|-----------|--------|
| fuelMax | 10.000 | `constants.ts:2057` |
| cargoCap | 20 | `constants.ts:2059` |
| jumpRange | 5 | `constants.ts:2062` |
| apCostJump | 1 | `shipCalculator.ts:48` |
| fuelPerJump | 100 | `constants.ts:2058` |
| hp | 100 | `constants.ts:2061` |
| commRange | 100 | `constants.ts:2064` |
| scannerLevel | 1 | `constants.ts:2065` |
| damageMod | 1.0 | `shipCalculator.ts:53` |
| engineSpeed | 2 | `constants.ts:2063` |
| memory | 10 | `constants.ts:269` |

### 11.2 Slot-System

8 spezialisierte Slots + bis zu 4 Extra-Slots (`constants.ts:415-438`):

| Slot | Kategorie |
|------|-----------|
| 0 | generator |
| 1 | drive |
| 2 | weapon |
| 3 | armor |
| 4 | shield |
| 5 | scanner |
| 6 | mining |
| 7 | cargo |
| 8-11 | Extra (AUSBAU-gated) |

**Slot-Regeln** (`shipCalculator.ts:124-179`):
- Spezialisierte Slots: Nur passende Kategorie
- `defense` und `special` Module: **Nur** in Extra-Slots
- Extra-Slots: Freigeschaltet durch AUSBAU-XP (10/25/40/50)
- **Unique-Module** (shield, scanner): Max 1 pro Schiff
- Slot darf nicht doppelt belegt sein

### 11.3 Stat-Berechnung

Quelle: `shipCalculator.ts:40-122`

1. Start mit Basis-Werten
2. ACEP-Level pro Pfad berechnen
3. Für jedes Modul:
   - ACEP-Multiplikator = höchster Level unter den `acepPaths`
   - Positive Stat-Werte: `stat += value * multiplier`
   - Negative Stat-Werte: `stat += value` (kein Multiplikator)
   - `damageMod`: Immer additiv (kein Multiplikator)
   - Nicht-numerische Werte (z.B. `weaponType`): Direkt zuweisen

**Clamping** (`shipCalculator.ts:113-120`):
- `apCostJump` ≥ 0.5
- `jumpRange` ≥ 1
- `damageMod` ≥ 0.25
- `engineSpeed` ∈ [1, 5]
- `hyperdriveFuelEfficiency` ∈ [0, 1]
- `memory` ≥ 0 (gerundet)
- `fuelMax` ≥ 1.000

### 11.4 Alle Module (Standard)

**Generator** (Unique pro Schiff, Slot 0):
| ID | Tier | EP/Runde | AP/s | HP |
|----|------|---------|------|-----|
| generator_mk1 | 1 | 6 | 0.20 | 20 |
| generator_mk2 | 2 | 9 | 0.30 | 35 |
| generator_mk3 | 3 | 12 | 0.50 | 55 |
| generator_mk4 | 4 | 15 | 0.70 | 80 |
| generator_mk5 | 5 | 18 | 1.00 | 110 |

**Repair** (Slot beliebig):
| ID | Tier | HP/Runde | HP/s |
|----|------|---------|------|
| repair_mk1 | 1 | 2 | 0.5 |
| repair_mk2 | 2 | 4 | 1.0 |
| repair_mk3 | 3 | 7 | 2.0 |
| repair_mk4 | 4 | 11 | 3.5 |
| repair_mk5 | 5 | 16 | 5.0 |

**Drive** (Slot 1):
| ID | Tier | jumpRange | engineSpeed | hyperdriveRange | fuelMax |
|----|------|-----------|-------------|-----------------|---------|
| drive_mk1 | 1 | +1 | +1 | 32 | +2.000 |
| drive_mk2 | 2 | +2 | +2 | 64 | +4.000 |
| drive_mk3 | 3 | +3 | +3 | 128 | +7.000 |
| drive_mk4 | 4 | +4 | +4 | 256 | +12.000 |
| drive_mk5 | 5 | +6 | +5 | 512 | +18.000 |
| void_drive | 3 | +6 | +5 | 192 | — |

**Waffen** (Slot 2):
| ID | Tier | ATK | Typ | Piercing |
|----|------|-----|-----|----------|
| laser_mk1 | 1 | 8 | laser | — |
| laser_mk2 | 2 | 16 | laser | — |
| laser_mk3 | 3 | 28 | laser | — |
| railgun_mk1 | 1 | 12 | railgun | 0.3 |
| railgun_mk2 | 2 | 22 | railgun | 0.5 |
| missile_mk1 | 1 | 18 | missile | — |
| missile_mk2 | 2 | 30 | missile | — |
| emp_array | 2 | 0 | emp | — |

**Schild** (Unique, Slot 4):
| ID | Tier | Shield HP | Regen |
|----|------|----------|-------|
| shield_mk1 | 1 | 30 | 3 |
| shield_mk2 | 2 | 60 | 6 |
| shield_mk3 | 3 | 100 | 12 |

**Armor** (Slot 3):
| ID | Tier | HP | damageMod |
|----|------|----|-----------|
| armor_mk1 | 1 | +25 | — |
| armor_mk2 | 2 | +50 | -0.10 |
| armor_mk3 | 3 | +100 | -0.25 |
| armor_mk4 | 4 | +150 | -0.30 |
| armor_mk5 | 5 | +250 | -0.40 |
| nano_armor | 3 | +150 | -0.35 |

**Scanner** (Unique, Slot 5):
| ID | Tier | scannerLevel | commRange | artefactChanceBonus | memory |
|----|------|-------------|-----------|--------------------:|--------|
| scanner_mk1 | 1 | +1 | — | — | +4 |
| scanner_mk2 | 2 | +1 | +50 | — | +6 |
| scanner_mk3 | 3 | +2 | +100 | +3% | +10 |
| scanner_mk4 | 4 | +3 | +150 | +5% | +14 |
| scanner_mk5 | 5 | +4 | +250 | +8% | +20 |
| quantum_scanner | 3 | +3 | +200 | +5% | +10 |

**Mining** (Slot 6):
| ID | Tier | miningBonus | artefactChanceBonus |
|----|------|------------|--------------------:|
| mining_laser_mk1 | 1 | +15% | — |
| mining_laser_mk2 | 2 | +30% | +1% |
| mining_laser_mk3 | 3 | +50% | +2% |
| mining_laser_mk4 | 4 | +75% | +4% |
| mining_laser_mk5 | 5 | +100% | +8% |

**Cargo** (Slot 7):
| ID | Tier | cargoCap | safeSlotBonus | fuelMax |
|----|------|----------|--------------|---------|
| cargo_mk1 | 1 | +10 | — | — |
| cargo_mk2 | 2 | +24 | +1 | — |
| cargo_mk3 | 3 | +50 | +2 | +2.000 |
| cargo_mk4 | 4 | +80 | +3 | +4.000 |
| cargo_mk5 | 5 | +120 | +5 | +8.000 |

**Defense** (Nur Extra-Slots):
| ID | Tier | Effekt |
|----|------|--------|
| point_defense | 2 | pointDefense 0.6 |
| ecm_suite | 2 | ecmReduction 0.15 |

### 11.5 Found-Only Module

Diese können nicht erforscht/gebaut werden, nur gefunden:

**Drives**: pulse_drive (T4), ghost_drive (T3), rift_engine (T5)
**Weapons**: ancient_lance (T5, +45 ATK, 40% Piercing), void_ripper (T4, +35), leech_cannon (T3), scrambler (T2)
**Armor**: living_hull (T4, +120 HP), salvage_skin (T3, +80 HP), reactive_plating (T3, -40 HP mit Rückschlag)
**Shields**: mirror_shield (T3, +80), reactive_barrier (T3, +60), parasite_shell (T5, +200, +5 Regen), void_shield (T5)
**Scanner**: deep_whisper (T4, +3 Level, +12% Artefakt), ghost_lens (T3, +400 Komm), war_scanner (T3, -2 Level)
**Mining**: void_drill (T5, +500%), crystal_leech (T3, -30%), swarm_harvester (T4, +150%)
**Cargo**: living_hold (T4, +80), compressed_vault (T4, +100, +4 Safe), black_market_hold (T3, +20)
**Defense**: null_field (T4, 80% ECM), bleed_emitter (T3, -50 Komm), terror_array (T4, +2 PD)
**Special**: memory_core (T3), ancient_seed (T5, +10% Artefakt), echo_chamber (T4, +5% Artefakt), pirate_transponder (T5)
**Void**: void_gun (T5, +20 ATK, ×5 vs Void)

Alle Found-Only Module haben **Drawbacks** (Nachteile), z.B.:
- `pulse_drive_overheat`: Jeder 3. Sprung kostet 2× AP
- `ghost_drive_no_hyperjump`: Kein Hyperjump möglich
- `rift_engine_drift`: 5% Chance auf 1-2 Sektoren Abdrift
- `ancient_lance_cooldown`: Feuert nur jede 2. Runde

### 11.6 Forschungs-System

Module mit `researchCost` müssen erforscht werden bevor sie gebaut werden können.

Forschungskosten bestehen aus:
- `wissen`: Wissens-Ressource
- `artefacts`: Typisierte Artefakte nach Kategorie (z.B. `{ drive: 1 }`)
- `researchDurationMin`: Forschungsdauer in Minuten

**Research Tick**: `60.000ms` (1 Minute) (`constants.ts:2206`)

**Freischaltung** (`research.ts:5-47`):
1. Kein `researchCost` → frei verfügbar
2. Blueprint vorhanden → freigeschaltet
3. Tech-Tree Tier-Unlock → Modul-Tier ≤ freigeschalteter Tier

Kategorie → Tech-Branch-Mapping:
- weapon → kampf
- shield, armor, defense, cargo, mining, generator, repair → ausbau
- scanner → intel
- drive → explorer
- special → kein Branch (nur Blueprint/found)

### 11.7 Techbaum

4 Branches mit je 3 Ebenen + Blatt-Knoten (`techTree.ts`)

**Struktur** (pro Branch):
1. **Branch-Root** (Lvl 1-3): Kosten [150, 450, 1350] Wissen. Schaltet Tier N+1 frei.
2. **Module** (Lvl 1): 280 Wissen. Exklusive Gruppe (1 von 3 wählbar).
3. **Specialization** (Lvl 1): 620 Wissen. Exklusive Gruppe (1 von 2 wählbar).
4. **Leaf** (Lvl 1-3): Kosten [180, 540, 1620] Wissen. Stat-Bonus pro Level.

**Globale Kostensteigerung**: `+5%` pro erforschtem Knoten (`techTree.ts:297`)
```
escalation = 1 + totalResearched * 0.05
finalCost = ceil(baseCost * escalation)
```

**Reset-Cooldown**: 24 Stunden (`techTree.ts:300`)

Stat-Boni pro Blatt-Level:
- Schaden/Stärke/Präzision/Effizienz: +15% pro Level
- Reichweite/Geschwindigkeit/Regeneration/Autopilot: +20% pro Level
- Treibstoff-Regeneration/Entdeckung: +10% pro Level

### 11.8 Forschungslabor

| Tier | Wissen-Multiplikator | Upgrade-Kosten |
|------|---------------------|----------------|
| 0 (keins) | 1.0× | — |
| 1 | 1.5× | (Baukosten) |
| 2 | 2.0× | 500 Cr + 30 Erz + 20 Kristall |
| 3 | 3.0× | 1.200 Cr + 60 Erz + 40 Kristall |
| 4 | 4.0× | 2.500 Cr + 100 Erz + 80 Kristall |
| 5 | 5.0× | 5.000 Cr + 150 Erz + 120 Kristall |

Max Tier: `5` (`constants.ts:112`)
AP-Kosten für Upgrade: `20` (`commands.ts:559`)

---

## 12. Baustellen & Strukturen

### 12.1 Struktur-Typen und Kosten

| Typ | Erz | Gas | Kristall | AP |
|-----|-----|-----|----------|-----|
| comm_relay | 5 | 0 | 2 | 5 |
| mining_station | 30 | 15 | 10 | 15 |
| base | 50 | 30 | 25 | 25 |
| storage | 20 | 10 | 5 | 10 |
| trading_post | 30 | 20 | 15 | 15 |
| defense_turret | 40 | 10 | 20 | 20 |
| station_shield | 30 | 25 | 30 | 20 |
| ion_cannon | 60 | 30 | 40 | 25 |
| factory | 40 | 20 | 15 | 20 |
| research_lab | 30 | 25 | 30 | 25 |
| kontor | 20 | 10 | 10 | 15 |
| jumpgate | 0 | 0 | 20 | 10 |

Quelle: `constants.ts:69-97`

### 12.2 Baustellen-Fortschritt

Quelle: `constructionTickService.ts`

- Fortschritt: 0-100% (1% pro Tick)
- Pro % werden Ressourcen anteilig benötigt: `ceil(progress * totalNeeded / 100)`
- Bei fehlendem Material: Baustelle pausiert
- Bei 100%: Struktur wird erstellt und Baustelle gelöscht

### 12.3 Kommunikationsreichweite

| Struktur | Reichweite |
|----------|-----------|
| comm_relay | 500 |
| mining_station | 500 |
| base | 1.000 |
| Andere | 0 |

Quelle: `constants.ts:125-138`

### 12.4 Spieler-Jumpgates

**Baukosten**: 500 Credits + 20 Kristall + 5 Artefakte (`constants.ts:141`)

**Upgrade-Kosten** (`constants.ts:142-147`):
| Upgrade | Credits | Material | Artefakte |
|---------|---------|----------|-----------|
| connection_2 | 300 | 15 Erz | 3 |
| connection_3 | 800 | 30 Erz | 8 |
| distance_2 | 300 | 15 Kristall | 3 |
| distance_3 | 800 | 30 Kristall | 8 |

**Distanz-Limits** (`constants.ts:149-153`):
| Level | Max Distanz |
|-------|------------|
| 1 | 250 |
| 2 | 500 |
| 3 | 2.500 |

**Connection-Limits** (`constants.ts:155-159`):
| Level | Max Verbindungen |
|-------|-----------------|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |

**Max Chain-Hops**: `10` (`constants.ts:161`)

### 12.5 Natürliche Jumpgates

- **Spawn-Chance**: `0.5%` (1 in 200 Sektoren) (`constants.ts:2122`)
- **Jumpgate-Salt**: `777` (`constants.ts:2123`)
- **Reisekosten**: `50 Credits` (öffentlich), `25 Credits` (Spieler-gebaut) (`constants.ts:2125-2126`)
- **Treibstoffkosten**: `1` (`constants.ts:2124`)
- **Reichweite**: 50–10.000 Sektoren (`constants.ts:2127-2128`)
- **Code-Länge**: `8` Zeichen (`constants.ts:2129`)
- **Minigame-Chance**: `30%` (`constants.ts:2130`)
- **Code-Chance**: `50%` (`constants.ts:2131`)
- **Frequenz-Match-Schwelle**: `0.9` (`constants.ts:2132`)

**Ancient Jumpgates** (extrem selten):
- **Spawn-Rate**: `0.0001` (1 pro 10.000 Sektoren) (`constants.ts:2135`)
- **Reichweite**: 30.000–100.000 Sektoren (`constants.ts:2137-2138`)

---

## 13. Human Expansion & Kriegsführung

### 13.1 Conquest-Engine

Quelle: `conquestEngine.ts`

**Conquest-Rate nach Station-Level** (`constants.ts:2801-2805`):

| Level | Basis | Geboostet (mit Pool) |
|-------|-------|---------------------|
| 1 | 1.0 | 1.5 |
| 2 | 1.1 | 2.0 |
| 3 | 1.2 | 3.0 |

- **Pool-Max**: `500` (`constants.ts:2799`)
- **Pool-Drain pro Tick**: `50` (`constants.ts:2798`)

**Friction-Modifikator** (`conquestEngine.ts:18-24`):
- Kein anderer Faction: 1.0
- Friction ≤ 20: 0 (kein Conquest möglich)
- Friction ≤ 50: 0.5
- Friction ≤ 80: 0.25
- Friction > 80: 0 (Battle-Modus)

**Nachbar-Prüfung**: Faction muss in mindestens einem der 8 Nachbar-Quadranten ≥ 60% Kontrolle haben (`conquestEngine.ts:9`)

**Station-Modi**:
- `conquest`: Expansion läuft (Anteile wachsen)
- `factory`: 100% Kontrolle erreicht (Produktion)
- `battle`: Friction > 80 (Krieg)

**Share-Update** (`conquestEngine.ts:26-63`):
- Neuer Anteil: `min(100, current + gain)`
- Andere Fraktionen verlieren proportional
- Anteile < 0.5 werden gelöscht
- Kontrolle geht an höchsten Anteil

### 13.2 Friction-Engine

Quelle: `frictionEngine.ts`

**Basis-Friction nach Diplomatie-Tier**:
| Tier | Basis |
|------|-------|
| ally | 0 |
| friendly | 10 |
| neutral | 35 |
| hostile | 65 |
| enemy | 90 |

**Formel** (`frictionEngine.ts:19-31`):
```
score = clamp(0, 100, round(baseFriction + (aggression - 1.0) * 20))
```

**Friction-State**:
| Score | State |
|-------|-------|
| 0–20 | peaceful_halt |
| 21–50 | skirmish |
| 51–80 | escalation |
| 81–100 | total_war |

**Rep → Tier** (`frictionEngine.ts:33-39`):
| Rep | Tier |
|-----|------|
| ≥ 75 | ally |
| ≥ 25 | friendly |
| ≥ -25 | neutral |
| ≥ -75 | hostile |
| < -75 | enemy |

### 13.3 Warfare-Engine

Quelle: `warfareEngine.ts`

**Schwellwerte**:
- `ADVANTAGE_THRESHOLD = 1.2` (20% Vorteil nötig)
- `CRUSHING_THRESHOLD = 10.0` (10× Vorteil = sofortiger Sieg)
- `LOSS_ON_WIN = 0.1` (10% Verlust des Verlierers)
- `LOSS_ON_STALEMATE = 0.05` (5% beiderseitiger Verlust)

**Auflösung** (`warfareEngine.ts:24-64`):
```
effectiveAttack = round((attack + playerAttackBonus) * attackMultiplier)
effectiveDefense = defense + playerDefenseBonus
```

- Angreifer gewinnt: `effectiveAttack > effectiveDefense * 1.2`
- Verteidiger gewinnt: `effectiveDefense > effectiveAttack * 1.2`
- Patt: Sonst

**Stations-Verteidigung** (`warfareEngine.ts:66-76`):
| Station-Tier | Basis-Verteidigung |
|-------------|-------------------|
| 0 | 0 |
| 1 | 100 |
| 2 | 300 |
| 3 | 700 |
| 4 | 1.500 |

### 13.4 Expansion-Engine

Quelle: `expansionEngine.ts`

**Expansion-Ziel**: Nächster unbesetzter Quadrant angrenzend an eigenes Territorium (`expansionEngine.ts:29-57`)

**Grenzkontakt**: Zwei Quadranten mit unterschiedlichen Fraktionen sind Nachbarn wenn Chebyshev-Distanz ≤ 1 (`expansionEngine.ts:9-24`)

**Frontier-Quadrant**: 1-5 leere Nachbar-Quadranten (weder 0 noch 6-8) (`expansionEngine.ts:79-93`)

### 13.5 Conquest-Preis-Bonus

`getConquestPriceBonus(qx, qy)` (`constants.ts:2809-2815`):
```
dist = floor(sqrt(qx² + qy²))
dist ≤ 10:  bonus = dist
dist ≤ 50:  bonus = 10 + (dist-10) * 2
dist ≤ 100: bonus = 90 + (dist-50) * 3
dist > 100: bonus = 240 + (dist-100) * 5
```

### 13.6 Universe-Tick-Engine

- **UNIVERSE_TICK_MS** = `5.000ms` (5 Sekunden) (`constants.ts:2556`)
- **FACTION_EXPANSION_INTERVAL_TICKS** = `360` (30 Minuten) (`constants.ts:2557`)
- **Max Stationen pro Quadrant**: `5` (`constants.ts:2571`)
- **Max Mining-Drohnen pro Station**: `3` (`constants.ts:2563`)
- **Mining-Drohne voll nach**: `20` Ticks (`constants.ts:2566`)
- **Max Ulam-Spiral-Steps**: `200` (`constants.ts:2569`)
- **Zivilisations-Meter Max**: `10.000` (`constants.ts:2572`)

---

## 14. Soziale Systeme

### 14.1 Chat-System

Kanäle: `direct`, `faction`, `quadrant`, `system` (`types.ts:388`)

### 14.2 Freundschafts-System

- Freunde, Freundschafts-Anfragen, Blockierungen (`types.ts:1507-1536`)
- Spielerkarte zeigt: Name, Level, Online-Status, Position, Freundschafts-Status

### 14.3 Bookmarks

- 5 Slots (`constants.ts` — implizit durch UI-Logik)
- Speichert Sektor-Koordinaten + Label

### 14.4 Direkt-Handel

- Redis-Sessions mit 60s TTL
- Atomarer Swap: Items + Credits
- Trigger per Chat-Befehl `/trade @player`

### 14.5 Kontor (Marktplatz)

- Spieler können Kauf/Verkauf-Orders platzieren
- Order-Typen: `buy`, `sell` (`types.ts:447`)
- Unterstützt Ressourcen, Module und Blaupausen

### 14.6 Rettungsmissionen

| Parameter | Wert |
|-----------|------|
| AP-Kosten (Rettung) | 5 |
| AP-Kosten (Abliefern) | 3 |
| Ablauf | 30 Minuten |
| Notruf-Chance | 0.5% pro Sprung |
| Richtungs-Varianz | ±30% |

Belohnungen (`constants.ts:2146-2150`):
| Quelle | Credits | Rep | XP |
|--------|---------|-----|-----|
| Scan-Event | 50 | 10 | 25 |
| NPC-Quest | 80 | 15 | 40 |
| Comm-Notruf | 100 | 20 | 50 |

### 14.7 Badges

2 Typen (`types.ts:408`):
- `ORIGIN_FIRST`: Erster Entdecker des Ursprungs
- `ORIGIN_REACHED`: Ursprung erreicht

### 14.8 XP-Level-System

| Level | XP-Schwelle |
|-------|------------|
| 1 | 0 |
| 2 | 100 |
| 3 | 300 |
| 4 | 600 |
| 5 | 1.000 |
| 6 | 1.500 |
| 7 | 2.200 |
| 8 | 3.000 |
| 9 | 4.000 |
| 10 | 5.000 |

Quelle: `constants.ts:385-396`

---

## 15. UI & Cockpit

### 15.1 6-Sektionen-Layout

| Sektion | ID | Inhalt |
|---------|-----|--------|
| Sec 1 | `cockpit-sec1` | Programm-Selektor |
| Sec 2 | `cockpit-sec2` | Hauptmonitor (Radar/Programm) |
| Sec 3 | `cockpit-sec3` | Detail-Monitor (Kontext-Panel) |
| Sec 4 | `cockpit-sec4` | Settings (ShipStatus + CombatStatus + Settings) |
| Sec 5 | `cockpit-sec5` | Navigation (SectorInfo + NavControls + HardwareControls) |
| Sec 6 | `cockpit-sec6` | Comms (CommsScreen) |

### 15.2 Programme (Section 1)

13 wählbare Programme (`constants.ts:2015-2029`):
`NAV-COM`, `MINING`, `CARGO`, `BASE-LINK`, `TRADE`, `FACTION`, `QUESTS`, `TECH`, `QUAD-MAP`, `NEWS`, `LOG`, `ACEP`, `FRIENDS`

### 15.3 Radar-Symbole

Umgebungs-Symbole (`constants.ts:1946-1953`):
| Environment | Symbol |
|-------------|--------|
| empty | · |
| nebula | ▒ |
| black_hole | o |
| star | * |
| planet | ● |
| asteroid | ◆ |

Content-Symbole (`constants.ts:1956-1966`):
| Content | Symbol |
|---------|--------|
| asteroid_field | ◆ |
| station | S |
| player_base | B |
| anomaly | ◊ |
| pirate_zone | ☠ |
| meteor | m |
| relic | R |
| npc_ship | ▸ |
| ruin | ☧ |

### 15.4 Farbschema

Amber-Monochrom-Theme (`constants.ts:1982-1991`):
- Primary: `#FFB000`
- Dim: `rgba(255, 176, 0, 0.6)`
- Background: `#050505`
- Danger: `#FF3333`
- Bezel: `#1a1a1a`

### 15.5 Autopilot

- **Schritt-Geschwindigkeit**: `100ms` pro Sektor (`constants.ts:2208`)
- Benötigt Hyperdrive-Charge und Treibstoff

### 15.6 Reconnection

- **Timeout**: `15` Sekunden (`constants.ts:51`)

---

## Anhang A: Wreck-POI-System

### A.1 Wreck-Untersuchung

| Parameter | Wert | Quelle |
|-----------|------|--------|
| Untersuchungs-AP | 2 | `constants.ts:2785` |
| Bergungs-AP | 3 | `constants.ts:2786` |
| Max pro Quadrant | 2 | `constants.ts:2777` |
| Slate-Cap | 5 | `constants.ts:2782` |

### A.2 Wreck-Schwierigkeitsgrade

Basis-Schwierigkeit nach Item-Typ (`constants.ts:2757-2763`):
| Item-Typ | Schwierigkeit |
|----------|--------------|
| resource | 0.20 |
| module | 0.50 |
| blueprint | 0.70 |
| data_slate | 0.65 |
| artefact | 0.90 |

Modifier-Änderungen:
- **Fehlschlag**: `+0.15` (schwerer) (`constants.ts:2778`)
- **Erfolg**: `-0.10` (leichter) (`constants.ts:2779`)
- **Modifier-Range**: [-0.3, +0.3] (`constants.ts:2780-2781`)

### A.3 Wreck-Größen

| Größe | Items | Bergungs-Dauer |
|-------|-------|---------------|
| small | 2-3 | 4.000ms |
| medium | 4-6 | 6.000ms |
| large | 7-10 | 8.000ms |

Quelle: `constants.ts:2765-2775`

### A.4 Explorer-Bonus

- **Chance pro XP**: `+0.5%` pro Explorer-XP (`constants.ts:2783`)
- Bei explorer=50: Artefakte mindestens 35% Chance (`constants.ts:2784`)

### A.5 Wreck-Slate-Verkauf

- **Basispreis**: 50 Credits (`constants.ts:2787`)
- **Pro Tier**: +75 Credits (`constants.ts:2788`)
- **Jumpgate-Steuer**: 25 Credits für die Menschheit (`constants.ts:2789`)

---

## Anhang B: Alien-Encounter-Wahrscheinlichkeiten

Die Begegnungs-Chance wird durch den Humanity-Rep-Tier modifiziert:
- FEINDSELIG (< -200): 0.5× Encounter-Chance
- NEUTRAL (-200 bis +200): 1.0× Encounter-Chance
- FREUNDLICH (> +200): 1.5× Encounter-Chance

Quelle: `humanityRepTier.ts:1-13`

---

## Anhang C: Kosmische Fraktions-Farben

| Fraktion | Farbe |
|----------|-------|
| humans | #4488FF |
| archivists | #88FF88 |
| consortium | #FF8844 |
| kthari | #FF4488 |
| mycelians | #88FFCC |
| mirror_minds | #CCCCFF |
| tourist_guild | #FFCC44 |
| silent_swarm | #884488 |
| helions | #FF8800 |
| axioms | #44CCFF |
| scrappers | #AAAAAA |

Quelle: `constants.ts:2302-2314`
