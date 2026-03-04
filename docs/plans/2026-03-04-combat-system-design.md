# Kampfsystem v2 — Design-Dokument

**Stand:** 2026-03-04
**Branch:** `claude/voidsector-combat-system-DBPWu`
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

### Ist-Zustand

Das aktuelle Kampfsystem ist ein **Single-Shot Auto-Resolve**:
- Ein Zufallswurf entscheidet Sieg oder Niederlage
- Spieler hat drei Optionen: `FIGHT`, `FLEE`, `NEGOTIATE`
- Kein taktisches Gameplay, kein Runden-Gefühl
- Schiffe haben HP, `damageMod` und `shipAttack` — aber kein Schildsystem
- Stationen haben keinerlei Kampfmechanik

### Ziele

1. **Mehr Spielerentscheidungen:** Taktikwahl pro Runde (3 Optionen) + Sonderaktionen (2 Optionen, limitiert)
2. **Automatisierter Kern:** Schaden-Berechnung, Shields, Armor — läuft server-seitig ohne Player-Micromanagement
3. **Waffen- & Schildmodule:** Neue Ship-Modul-Kategorien `weapon` und `shield`
4. **Stationskampf:** Stationen können sich mit Türmen + Schilden verteidigen
5. **CRT-Ästhetik:** ASCII-Kampfansicht, Monospace, Amber/Rot-Farbschema
6. **Rückwärtskompatibilität:** Bestehendes Single-Shot-System bleibt für Pirate-Ambushes erhalten; v2-Kampf optional aktivierbar

---

## 2. Waffensysteme — Offensive Module

### 2.1 Schiffswaffen

Neue Modul-Kategorie: `category: 'weapon'`
Schiffe können **maximal 1 Waffenmodul** pro Slot ausrüsten (exklusiv zu anderen Kategorien).
Ohne Waffenmodul: Basis-Angriff wie bisher (`shipAttack = 10` + Upgrades).

#### Puls-Laser — Schnelle, genaue Strahlenwaffe

```
  ╔════════════════════════════════════════════════════╗
  ║  MODUL: PULS-LASER MK.I                           ║
  ║  ─────────────────────────────────────────────── ║
  ║     ████                  ···→→→→→→               ║
  ║   ██░░░░██   ╔══════╗   ···→→→→→→→               ║
  ║   ██░░░░██ ══╣ LASER╠══ ···→→→→→→→               ║
  ║   ██░░░░██   ╚══════╝   ···→→→→→→→               ║
  ║     ████                                           ║
  ║                                                    ║
  ║  ATK: +8  |  GENAUIGKEIT: +5%  |  PIERCING: 0%   ║
  ║  Typ: Energiewaffe — nicht abfangbar               ║
  ╚════════════════════════════════════════════════════╝
```

| ID           | Name              | ATK | Genauigkeit | Piercing | Kosten                        |
|--------------|-------------------|-----|-------------|----------|-------------------------------|
| `laser_mk1`  | PULS-LASER MK.I   | +8  | +5 %        | 0 %      | 150 CR + 10 Crystal           |
| `laser_mk2`  | PULS-LASER MK.II  | +16 | +10 %       | 0 %      | 450 CR + 25 Crystal + 10 Gas  |
| `laser_mk3`  | PULS-LASER MK.III | +28 | +15 %       | 0 %      | 1200 CR + 50 Crystal + 20 Gas |

#### Rail-Kanone — Langsam, panzerbrechend

```
  ╔════════════════════════════════════════════════════╗
  ║  MODUL: RAIL-KANONE MK.I                          ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ╔══════════════════╗  ════════════════►          ║
  ║   ║░░░░░░░░░░░░░░░░░░╠══ ◆ ════════════►          ║
  ║   ╚══════════════════╝  ════════════════►          ║
  ║                          (durchdringt Schilde)     ║
  ║                                                    ║
  ║  ATK: +12  |  GENAUIGKEIT: -5%  |  PIERCING: 30% ║
  ║  Typ: Kinetisch — 30% ignoriert Panzerung          ║
  ╚════════════════════════════════════════════════════╝
```

| ID            | Name               | ATK | Genauigkeit | Piercing | Kosten                        |
|---------------|--------------------|-----|-------------|----------|-------------------------------|
| `railgun_mk1` | RAIL-KANONE MK.I   | +12 | -5 %        | 30 %     | 300 CR + 30 Ore + 15 Crystal  |
| `railgun_mk2` | RAIL-KANONE MK.II  | +22 | -5 %        | 50 %     | 900 CR + 60 Ore + 30 Crystal  |

**Piercing-Mechanik:** `finalDamage = piercing * rawDamage + (1 - piercing) * rawDamage * damageMod`
Beispiel MK.II: 30% Schaden ignoriert Panzerung komplett, 70% wird durch `damageMod` reduziert.

#### Raketen-Pod — Hoher Schaden, abfangbar

```
  ╔════════════════════════════════════════════════════╗
  ║  MODUL: RAKETEN-POD MK.I                          ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ┌──┐  ┌──┐                                      ║
  ║   │▓▓│  │▓▓│   ~~~~▶  ~~~~▶  ~~~~▶                ║
  ║   │▓▓│  │▓▓│   ~~~~▶  ~~~~▶  ~~~~▶                ║
  ║   └──┘  └──┘                                      ║
  ║                (Point-Defense kann abfangen)       ║
  ║  ATK: +18  |  GENAUIGKEIT: 0%  |  ABFANGBAR: JA  ║
  ║  Typ: Ballistisch — Punktverteidigung kann -50% dmg║
  ╚════════════════════════════════════════════════════╝
```

| ID             | Name              | ATK | Abfangrate | Kosten                       |
|----------------|-------------------|-----|------------|------------------------------|
| `missile_mk1`  | RAKETEN-POD MK.I  | +18 | -50 % dmg  | 250 CR + 20 Ore + 5 Crystal  |
| `missile_mk2`  | RAKETEN-POD MK.II | +30 | -30 % dmg  | 750 CR + 40 Ore + 15 Crystal |

#### EMP-Emitter — Systemstörer (kein Direktschaden)

```
  ╔════════════════════════════════════════════════════╗
  ║  MODUL: EMP-EMITTER                               ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║       ╔═══╗                                        ║
  ║  ≈≈≈≈╣EMP╠≈≈≈≈≈≈≈≈≈≈≈  [SHIELD DISABLED]         ║
  ║       ╚═══╝                                        ║
  ║                                                    ║
  ║  ATK: 0  |  EFFEKT: Schilde des Gegners für       ║
  ║  2 Runden deaktiviert (bei Treffer)               ║
  ║  Typ: Elektronisch — keine Panzerung wirksam       ║
  ╚════════════════════════════════════════════════════╝
```

| ID          | Name        | ATK | Effekt                             | Kosten                      |
|-------------|-------------|-----|------------------------------------|-----------------------------|
| `emp_array` | EMP-EMITTER | 0   | Gegner-Schilde 2 Runden deaktiviert| 500 CR + 20 Crystal + 20 Gas|

---

### 2.2 Stationswaffen

Station-Defensive-Gebäude (neue Strukturtypen, analog zu Storage/Trading-Post).
Türme feuern **automatisch** jede Kampfrunde — kein Spieler-Input nötig.

#### Verteidigungs-Turm

```
  ╔════════════════════════════════════════════════════════╗
  ║  STATION-STRUKTUR: VERTEIDIGUNGS-TURM MK.I            ║
  ║  ────────────────────────────────────────────────── ║
  ║                                                        ║
  ║       ╔═══╗                                            ║
  ║       ║ ▲ ║   AUTO-FEUER: 15 DMG/RUNDE                 ║
  ║   ════╬═══╬════                                        ║
  ║   ||||│███│||||                                        ║
  ║   ====│███│====                                        ║
  ║       └───┘                                            ║
  ║                                                        ║
  ║  REICHWEITE: Sektor  |  FEUERRATE: 1 Schuss/Runde     ║
  ║  Kosten: 500 CR + 50 Ore                               ║
  ╚════════════════════════════════════════════════════════╝
```

| ID                    | Name                     | Auto-DMG/Runde | Kosten                         |
|-----------------------|--------------------------|----------------|--------------------------------|
| `defense_turret_mk1`  | VERTEIDIGUNG-TURM MK.I   | 15             | 500 CR + 50 Ore                |
| `defense_turret_mk2`  | VERTEIDIGUNG-TURM MK.II  | 30             | 1500 CR + 100 Ore + 20 Crystal |
| `defense_turret_mk3`  | VERTEIDIGUNG-TURM MK.III | 50             | 4000 CR + 200 Ore + 60 Crystal |

#### Ionen-Kanone (Ultimative Stationswaffe)

```
  ╔════════════════════════════════════════════════════════╗
  ║  STATION-STRUKTUR: IONEN-KANONE                       ║
  ║  ────────────────────────────────────────────────── ║
  ║                                                        ║
  ║  ╔════════════════════════════╗                        ║
  ║  ║░░░░░░░░░░░░░░░░░░░░░░░░░░░╠════════════════▶▶▶     ║
  ║  ╚════════════════════════════╝  [SHIELDS BYPASS]      ║
  ║                                                        ║
  ║  SCHADEN: 80 (ignoriert Schilde komplett)             ║
  ║  FEUERRATE: 1× pro Kampf (Aufladezeit)                ║
  ║  Kosten: 8000 CR + 300 Ore + 100 Crystal + 50 Gas     ║
  ╚════════════════════════════════════════════════════════╝
```

---

## 3. Verteidigungssysteme — Defensive Module

### 3.1 Schildgeneratoren (Schiffe)

Neue Modul-Kategorie: `category: 'shield'`
Schilde absorbieren eingehenden Schaden **vor** der Rumpf-Panzerung.
Schildregeneration erfolgt zu **Beginn jeder Kampfrunde** (nicht zwischen Kämpfen).

```
  Schadensprioritäten (Eingehend):

  [Gegner-Angriff] → [Schild absorbiert] → [Restschaden × damageMod] → [Rumpf-HP]

  Beispiel: 25 Schaden, Schild 10/30, damageMod 0.75
  → Schild absorbiert 10 → Restschaden 15 → × 0.75 → Rumpf -11
```

```
  SCHILDGENERATOR MK.I — CRT-Darstellung:

  SCHILD [■■■■■■░░░░░░░░░░░░░░]  30/100
  RUMPF  [■■■■■■■■■■■■░░░░░░░░]  60/100
         ████ absorbed ████
```

| ID           | Name                  | Schild-HP | Regen/Runde | Kosten                        |
|--------------|-----------------------|-----------|-------------|-------------------------------|
| `shield_mk1` | SCHILD-GEN MK.I       | +30       | +3          | 200 CR + 15 Crystal           |
| `shield_mk2` | SCHILD-GEN MK.II      | +60       | +6          | 600 CR + 35 Crystal + 10 Gas  |
| `shield_mk3` | SCHILD-GEN MK.III     | +100      | +12         | 1500 CR + 70 Crystal + 25 Gas |

### 3.2 Defensivmodule

#### Punkt-Verteidigung

```
  ╔════════════════════════════════════════════════════╗
  ║  MODUL: PUNKT-VERTEIDIGUNG                        ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ~~~~▶  ~~~~▶    ≈≈≈≈   ×× ABGEFANGEN ××         ║
  ║   ~~~~▶  ~~~~▶  ≈[PD]≈                             ║
  ║   ~~~~▶  ~~~~▶    ≈≈≈≈   ×× ABGEFANGEN ××         ║
  ║                                                    ║
  ║  Abfangrate: 60% aller eingehenden Raketen-DMG    ║
  ║  Wirkt NUR gegen Raketen-Typ (missile_mk1/mk2)    ║
  ║  Kosten: 350 CR + 20 Ore + 10 Crystal             ║
  ╚════════════════════════════════════════════════════╝
```

| ID              | Name              | Effekt                     | Kosten                     |
|-----------------|-------------------|----------------------------|----------------------------|
| `point_defense` | PUNKT-VERTEIDIGUNG| -60% eingehender Raketen-DMG | 350 CR + 20 Ore + 10 Crystal |

#### ECM-Suite (Elektronische Gegenmaßnahmen)

| ID          | Name      | Effekt                          | Kosten                    |
|-------------|-----------|----------------------------------|---------------------------|
| `ecm_suite` | ECM-SUITE | -15% Feind-Trefferchance         | 400 CR + 25 Crystal + 15 Gas |

---

### 3.3 Stationsverteidigung

Stationsschilde sind **Gebäude-Strukturen** (kein Modul-Slot). Schützen nur bei Stationskampf.

```
  STATIONS-SCHILD — CRT-Darstellung:

  ╔══ STATION STATUS ════════════════════════╗
  ║  [NEXUS-7]  Eigentümer: SPIELER-NAME     ║
  ║  ─────────────────────────────────────  ║
  ║  STATIONS-SCHILD  [■■■■■■■░░░] 140/200  ║
  ║  STATIONSRUMPF    [■■■■■■■■■■]  500/500  ║
  ║  TURM MK.I × 2   AUTO: 30 DMG/RND       ║
  ╚══════════════════════════════════════════╝
```

| ID                   | Name                      | Schild-HP | Regen/Runde | Kosten                          |
|----------------------|---------------------------|-----------|-------------|---------------------------------|
| `station_shield_mk1` | STATIONS-SCHILD MK.I      | +150      | +10         | 1000 CR + 50 Crystal            |
| `station_shield_mk2` | STATIONS-SCHILD MK.II     | +350      | +25         | 3000 CR + 100 Crystal + 30 Gas  |

---

## 4. Kampfsystem v2 — Rundenkampf

### 4.1 Rundenstruktur

```
  ┌─────────────────────────────────────────────────────────┐
  │               KAMPF-RUNDENABLAUF                        │
  │                                                         │
  │  START                                                  │
  │    │                                                    │
  │    ▼                                                    │
  │  [Schild-Regen] Spieler-Schild += regenRate             │
  │    │                                                    │
  │    ▼                                                    │
  │  [Spieler-Entscheidung]                                 │
  │    ├─ Taktik wählen: ANGRIFF / AUSGEWOGEN / DEFENSIV    │
  │    └─ Sonderaktion: ZIELEN / AUSWEICHEN / keine         │
  │    │                                                    │
  │    ▼                                                    │
  │  [Angriffs-Phase] (simultan)                            │
  │    ├─ Spieler-Angriff berechnen                         │
  │    └─ Feind-Angriff berechnen                           │
  │    │                                                    │
  │    ▼                                                    │
  │  [Schadensanwendung]                                    │
  │    ├─ Schilde abziehen                                  │
  │    ├─ Panzerung anwenden                                │
  │    └─ Sondereffekte (EMP, Piercing, PD)                │
  │    │                                                    │
  │    ▼                                                    │
  │  [Sieg/Niederlage prüfen]                               │
  │    ├─ Feind HP ≤ 0 → SIEG                               │
  │    ├─ Spieler HP ≤ 0 → NIEDERLAGE                       │
  │    └─ Runde 5 abgeschlossen → AUTO-FLUCHT               │
  │    │                                                    │
  │    ▼                                                    │
  │  [Nächste Runde] ←────────────────────┘                 │
  └─────────────────────────────────────────────────────────┘
```

**Max Runden:** 5
**Kampf-AP-Kosten:** 1 AP pro Runde (bei Sieg 0 Runden-AP vergütet; bei Flucht 2 AP extra)

---

### 4.2 Spielerentscheidungen pro Runde

#### Taktik (Pflicht jede Runde)

```
  ╔══════════════════════════════════════════════════════════╗
  ║  TAKTIK-AUSWAHL                                         ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║  [F1] ██ ANGRIFF ██                                      ║
  ║       Volle Feuerkraft, weniger Deckung                  ║
  ║       Angriff: ×1.30  │  Verteidigung: ×0.80            ║
  ║                                                          ║
  ║  [F2] ▓▓ AUSGEWOGEN ▓▓                                   ║
  ║       Balanced — Standard-Kampfmodus                     ║
  ║       Angriff: ×1.00  │  Verteidigung: ×1.00            ║
  ║                                                          ║
  ║  [F3] ░░ DEFENSIV ░░                                     ║
  ║       Schwerer Beschuss, Systemschutz priorisieren       ║
  ║       Angriff: ×0.75  │  Verteidigung: ×1.35            ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
```

#### Sonderaktionen (max 1× pro Kampf)

```
  ╔══════════════════════════════════════════════════════════╗
  ║  SONDER-AKTIONEN (je 1× pro Kampf)                      ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║  [F4] ZIELEN — System anvisieren                         ║
  ║       Nächster Angriff: Treffchance +50%                 ║
  ║       Bei Treffer: 35% Chance Waffe oder Schild          ║
  ║       des Feindes für 2 Runden deaktivieren              ║
  ║       [Kombinierbar mit Taktik]                          ║
  ║                                                          ║
  ║  [F5] AUSWEICHEN — Evasive Manöver                       ║
  ║       50% Chance: Feindangriff diese Runde komplett       ║
  ║       verfehlt (kein Schaden)                            ║
  ║       [Kombinierbar mit Taktik]                          ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
```

#### Flucht (jederzeit möglich)

| Option   | AP-Kosten | Basiswahrscheinlichkeit | Modifier                           |
|----------|-----------|-------------------------|-------------------------------------|
| `[FLUCHT]` | 2 AP    | 60 %                    | +2 % pro Hull-Speed-Bonus; -5 % pro Piraten-Level |

---

### 4.3 Kampfformeln

#### Spieler-Angriffswert

```
baseAttack     = shipHull.baseAttack (10 für alle Hulls)
weaponBonus    = weaponModule.atk (0 wenn kein Modul)
factionBonus   = combatMultiplier (1.0–1.15)
tacticMod      = 1.30 | 1.00 | 0.75 (Taktik)

rawAttack = (baseAttack + weaponBonus) × factionBonus × tacticMod
roll      = rng(0.85, 1.15)  // ±15 % Würfelvariation
finalAttack = floor(rawAttack × roll)
```

#### Feind-Schadenswert

```
enemyBase     = PIRATE_BASE_DAMAGE + pirateLevel × PIRATE_DAMAGE_PER_LEVEL
ecmPenalty    = 1.0 - playerEcmSuite (0.0 oder 0.15)
evadeMod      = 0 wenn Ausweichen erfolgreich (50% rng), sonst 1.0
roll          = rng(0.85, 1.15)

rawEnemyDmg = enemyBase × roll × ecmPenalty × evadeMod
```

#### Schadens-Pipeline (Spieler empfängt Schaden)

```
step1: pdReduction   = (weaponType === 'missile') ? rawEnemyDmg × pointDefenseRate : 0
step2: afterPD       = rawEnemyDmg - pdReduction
step3: shieldDamage  = min(afterPD, currentShield)
       currentShield = max(0, currentShield - afterPD)
       afterShield   = max(0, afterPD - shieldDamage)
step4: armorFactor   = damageMod  // 0.75 bis 1.0
       hullDamage    = floor(afterShield × armorFactor)
step5: playerHp     -= hullDamage
```

#### Piercing-Schaden (Rail-Kanone)

```
piercingFraction = weaponPiercing  // 0.30 (mk1) oder 0.50 (mk2)
piercedDamage    = finalAttack × piercingFraction           // ignoriert damageMod
normalDamage     = finalAttack × (1 - piercingFraction) × damageMod
totalDamage      = piercedDamage + normalDamage
```

---

### 4.4 EMP-Effekt

```
  EMP-Sequenz:
  1. EMP feuert — kein direkter HP-Schaden
  2. Trefferroll: accuracy (base 75%)
  3. Bei Treffer: enemyShieldDisabled = true, disabledRounds = 2
  4. Deaktivierter Schild: schützt nicht, regeneriert nicht
  5. Nach 2 Runden: Schild wieder aktiv
```

---

## 5. Kampfansicht — CRT Terminal UI

### 5.1 Haupt-Kampf-Dialog (ASCII-Mockup)

```
╔══════════════════════════════════════════════════════════════════════╗
║  ● KAMPF-SYSTEM v2.4  ●  SEKTOR (47, -23)  ●  RUNDE 2 / 5  ●      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ╔══ VOID CRUISER ════════════════╗  ╔══ PIRATEN-KREUZER LV.4 ════╗ ║
║  ║   ╱╲                          ║  ║    ╱╲  ╱╲                  ║ ║
║  ║  ╱██╲     ←—LASER—→           ║  ║   ╱██╲╱██╲                 ║ ║
║  ║ ╱████╲ ══╗                    ║  ║  │╔══╗╔══╗│                ║ ║
║  ║ ╲████╱ ══╝ ·····◆·····►       ║  ║ ══╡║▓╟╢▓║╞══              ║ ║
║  ║  ╲██╱                         ║  ║  │╚══╝╚══╝│                ║ ║
║  ║   ╲╱                          ║  ║   ╲  ╱╲  ╱                 ║ ║
║  ║                                ║  ║                             ║ ║
║  ║ SCHILD [■■■■■■░░░░░░] 60/100  ║  ║ SCHILD [░░░░░░░░░░]  0/0  ║ ║
║  ║ RUMPF  [■■■■■■■■░░░░] 82/100  ║  ║ RUMPF  [■■■■■░░░░░] 48/80 ║ ║
║  ║ WAFFE: LASER MK.II             ║  ║ WAFFE: PIRATEN-BLASTER     ║ ║
║  ║ SCHILD-REGEN: +6/RUNDE         ║  ║ KEINE SCHILDE              ║ ║
║  ╚════════════════════════════════╝  ╚════════════════════════════╝ ║
║                                                                      ║
║  ═══ KAMPF-PROTOKOLL ══════════════════════════════════════════════ ║
║  > RUNDE 1: Laser MK.II feuert  →  22 DMG (Schild: 22 absorbiert)  ║
║  > RUNDE 1: Piraten-Blaster     →  14 DMG (Schild: 8, Rumpf: -5)   ║
║  > RUNDE 2: Schild regen        →  +6 HP  [60/100]                  ║
║  > RUNDE 2: Dein Zug — Taktik wählen...                             ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  ═══ TAKTIK ══════════════════════════════════════════════════════   ║
║                                                                      ║
║  [F1] ANGRIFF   +30%DMG  -20%DEF   [F2] AUSGEWOGEN  Balanced        ║
║                                    [F3] DEFENSIV   -25%DMG +35%DEF  ║
║                                                                      ║
║  [F4] ZIELEN ─ System anvisieren (1×)     [F5] AUSWEICHEN (1×)      ║
║                                                                      ║
║  [ESC] FLUCHT — 2 AP, ~63% Chance                                    ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 5.2 Sieg / Niederlage Screen

```
  ╔══ KAMPF BEENDET ══════════════════════════════════════╗
  ║                                                       ║
  ║         ██  ██ ██  ██████  ██████                    ║
  ║         ██  ██ ██  ██      ██                        ║
  ║         ██  ██ ██  ████    ████ ██                   ║
  ║         ╚████  ██  ██      ██   ██                   ║  [SIEG]
  ║         ──── oder ────                                ║
  ║         ██ ██  ██ ██████  ██████  ██████             ║
  ║         ██ ████  ██ ██      ██  ██  ██    ██         ║  [NIEDERLAGE]
  ║                                                       ║
  ╠═══════════════════════════════════════════════════════╣
  ║  ERGEBNIS:                                            ║
  ║                                                       ║
  ║  ► Runden gespielt:    2 / 5                         ║
  ║  ► Gegner-HP Rest:     0 / 80  (Vernichtet)          ║
  ║  ► Eigene HP Rest:     82 / 100                      ║
  ║  ► Schild Rest:        60 / 100                      ║
  ║                                                       ║
  ║  BEUTE:                                               ║
  ║  ► Credits: +45 CR                                   ║
  ║  ► Erz: +2  │  Kristall: +1                         ║
  ║  ► XP: +20                                           ║
  ║  ► Piraten-Reputation: -3                            ║
  ║                                                       ║
  ║  [WEITER]                                             ║
  ╚═══════════════════════════════════════════════════════╝
```

### 5.3 Stationskampf-Overlay (Station verteidigt sich)

```
  ╔══ STATION UNTER ANGRIFF ══════════════════════════════╗
  ║  [NEXUS-7]  Sektor (47, -23)                          ║
  ║  ─────────────────────────────────────────────────   ║
  ║                                                       ║
  ║  ╔══ STATION ════════════════════════════╗            ║
  ║  ║   ┌───┐   ┌───┐                       ║            ║
  ║  ║   │ ▲ │   │ ▲ │  AUTO-TÜRME: AKTIV   ║            ║
  ║  ║   ╔═══════════╗                       ║            ║
  ║  ║   ║ [NEXUS-7] ║  ←──── Piratenangriff ║            ║
  ║  ║   ╚═══════════╝                       ║            ║
  ║  ║  SCHILD  [■■■■■■■░░░] 140/200         ║            ║
  ║  ║  RUMPF   [■■■■■■■■■■]  500/500        ║            ║
  ║  ║  TURM×2  AUTO: 30 DMG/RND             ║            ║
  ║  ╚═══════════════════════════════════════╝            ║
  ║                                                       ║
  ║  FEIND:  Piraten-Kreuzer LV.3  HP: 50/60             ║
  ║                                                       ║
  ║  ─────────────────────────────────────────────────   ║
  ║  Station kämpft automatisch mit installierten Türmen. ║
  ║  Du kannst dem Kampf beitreten und die Station        ║
  ║  aktiv verteidigen.                                   ║
  ║                                                       ║
  ║  [BEITRETEN] eigener Kampf-Screen öffnet sich        ║
  ║  [IGNORIEREN] Station kämpft alleine                  ║
  ╚═══════════════════════════════════════════════════════╝
```

---

## 6. Stationskampf

### 6.1 Auslöser

Stationskampf wird ausgelöst durch:
1. **Piraten-Sektor-Überlappung:** Station in einem Piraten-Sektor gebaut → regelmäßige Angriffe
2. **Piraten-Raid-Event:** Zufälliges Event (Chance basiert auf Piraten-Reputation)
3. *(v2) PvP-Angriff:* Andere Spieler greifen Station an (spätere Phase)

### 6.2 Automatischer Ablauf

```
PIRATEN-ANGRIFF-EVENT:
  1. Server generiert Piraten-Gegner (Level = Sektordistanz)
  2. Station lädt installierte Verteidigungen aus DB
  3. Combat-Loop (max 10 Runden — Station ist stationär, mehr Runden)
     └── Pro Runde:
           - Stations-Schild regeneriert
           - Jeder Turm feuert: auto-DMG × Türme
           - Pirat greift an: pirateDmg - stationDamageMod
           - HP-Check
  4. Ergebnis:
     - ABGEWEHRT: Kleine Belohnung (Credits + Erfahrung) für Besitzer
     - STATION BESCHÄDIGT: HP reduziert, Strukturfunktion eingeschränkt
     - STATION ZERSTÖRT: Struktureintrag gelöscht (Ressourcen verloren)
  5. Client-Benachrichtigung: Push-Message 'stationUnderAttack' oder 'stationDefended'
```

### 6.3 Stationsreparatur

Nach Beschädigung:
- Reparatur kostet Credits + Ore proportional zu HP-Verlust
- `REPAIR_COST_PER_HP = 5 CR + 1 Ore` (pro HP-Punkt)
- Reparatur sofort möglich (an der eigenen Station)
- Vollständige Zerstörung → Neubau erforderlich

### 6.4 Spieler verteidigt aktiv

Wenn der Spieler sich im gleichen Sektor befindet:
- Push-Nachricht erscheint (`stationUnderAttack`)
- Spieler kann `[BEITRETEN]` klicken
- Öffnet normales `CombatDialog v2` mit dem gleichen Piraten-Gegner
- Station und Spieler kämpfen parallel (Station auto, Spieler taktisch)
- Kombinierter Schaden wird auf Piraten angerechnet

---

## 7. Balance-Tabellen

### 7.1 Effektiver Angriff nach Waffenmodul + Hull

| Hull        | Basis-ATK | +Laser MK.II | +Rail MK.I | +Rakete MK.I |
|-------------|-----------|--------------|------------|--------------|
| Scout       | 10        | 26           | 22         | 28           |
| Freighter   | 10        | 26           | 22         | 28           |
| Cruiser     | 10        | 26           | 22         | 28           |
| Explorer    | 10        | 26           | 22         | 28           |
| Battleship  | 10        | 26           | 22         | 28           |

> *Battleship-Bonus: Geplant als Hull-eigener Basis-ATK-Bonus von +5 (Phase 2)*

### 7.2 Effektive Feindangriffe nach Level (ohne Spieler-Verteidigung)

| Pirat LV | Basis-DMG | Mit Shield MK.I (+3 regen) | Mit Shield MK.II (+6 regen) |
|----------|-----------|----------------------------|-----------------------------|
| 1        | 8         | nach 4 Runden absorbiert   | nach 2 Runden absorbiert     |
| 3        | 14        | Schild hält 2 Runden       | Schild hält 4 Runden         |
| 5        | 20        | Schild hält 1 Runde        | Schild hält 3 Runden         |
| 10       | 35        | Schild hält <1 Runde       | Schild hält 1 Runde          |

### 7.3 Taktik-Empfehlungen

| Situation                              | Empfohlene Taktik |
|----------------------------------------|-------------------|
| Feind-Level viel niedriger             | ANGRIFF           |
| Feind-Level ähnlich                    | AUSGEWOGEN        |
| Feind-Level höher, HP niedrig          | DEFENSIV          |
| EMP ausgerüstet, Feind hat Schilde     | AUSGEWOGEN + ZIELEN|
| Rail-Kanone, stark gepanzerter Feind   | ANGRIFF           |
| Raketen, Feind ohne Point-Defense      | ANGRIFF           |
| Flucht gewünscht aber AP knapp         | AUSWEICHEN → FLUCHT|

---

## 8. Technische Implementierung

### 8.1 Neue Typen (`packages/shared/src/types.ts`)

```typescript
// Neue Waffentypen
export type WeaponType = 'laser' | 'railgun' | 'missile' | 'emp' | 'none';
export type CombatTactic = 'assault' | 'balanced' | 'defensive';
export type SpecialAction = 'aim' | 'evade' | 'none';

// Erweiterung ShipStats
export interface ShipStats {
  // ... bestehende Felder ...
  shieldHp: number;          // Shield-HP aus Schildmodulen
  shieldRegen: number;       // Schild-Regen pro Runde
  weaponAttack: number;      // Waffenmodul-Bonus
  weaponType: WeaponType;    // Aktiver Waffentyp
  weaponPiercing: number;    // Panzerbrechend (0.0–1.0)
  pointDefense: number;      // Raketen-Abfangrate (0.0–1.0)
  ecmReduction: number;      // Feind-Trefferreduktion (0.0–0.15)
}

// Kampfzustand (Client + Server)
export interface CombatRound {
  round: number;
  tactic: CombatTactic;
  specialAction: SpecialAction;
  playerRawAttack: number;
  playerFinalAttack: number;
  enemyRawAttack: number;
  enemyFinalAttack: number;
  playerShieldDamage: number;
  playerHullDamage: number;
  enemyShieldDamage: number;
  enemyHullDamage: number;
  playerShieldAfter: number;
  playerHpAfter: number;
  enemyShieldAfter: number;
  enemyHpAfter: number;
  specialEffects: string[];
  logLine: string;
}

export interface CombatV2State {
  encounter: PirateEncounter;
  currentRound: number;
  maxRounds: number;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  playerMaxShield: number;
  playerShieldRegen: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyShield: number;
  rounds: CombatRound[];
  specialActionsUsed: { aim: boolean; evade: boolean };
  status: 'active' | 'finished';
}

// Neue Message-Typen
export type CombatV2Action = 'tactic' | 'flee';
export interface CombatV2ActionMessage {
  tactic: CombatTactic;
  specialAction: SpecialAction;
  sectorX: number;
  sectorY: number;
}
export interface CombatV2RoundResultMessage {
  success: boolean;
  error?: string;
  round?: CombatRound;
  combatState?: CombatV2State;
  finalResult?: BattleResult;
}

// Stationskampf
export interface StationCombatEvent {
  stationId: string;
  sectorX: number;
  sectorY: number;
  attackerLevel: number;
  stationHpBefore: number;
  outcome: 'defended' | 'damaged' | 'destroyed';
  hpLost: number;
}
```

### 8.2 Neue Konstanten (`packages/shared/src/constants.ts`)

```typescript
// Combat v2 — Taktik-Multiplikatoren
export const TACTIC_ASSAULT_DMG   = 1.30;
export const TACTIC_ASSAULT_DEF   = 0.80;
export const TACTIC_BALANCED_DMG  = 1.00;
export const TACTIC_BALANCED_DEF  = 1.00;
export const TACTIC_DEFENSIVE_DMG = 0.75;
export const TACTIC_DEFENSIVE_DEF = 1.35;

// Combat v2 — Sonderaktionen
export const AIM_ACCURACY_BONUS      = 0.50;  // +50% Trefferchance
export const AIM_DISABLE_CHANCE      = 0.35;  // 35% Systemdeaktivierung
export const AIM_DISABLE_ROUNDS      = 2;
export const EVADE_CHANCE            = 0.50;  // 50% Ausweichen
export const EMP_HIT_CHANCE          = 0.75;
export const EMP_DISABLE_ROUNDS      = 2;

// Combat v2 — Allgemein
export const COMBAT_V2_MAX_ROUNDS    = 5;
export const COMBAT_V2_AP_PER_ROUND  = 1;
export const COMBAT_V2_ROLL_MIN      = 0.85;
export const COMBAT_V2_ROLL_MAX      = 1.15;

// Waffen-Module (neue Einträge in MODULES)
// → Ergänzung zur bestehenden MODULES-Konstante in constants.ts

// Stations-Türme (neue Strukturtypen)
export const STATION_DEFENSE_STRUCTURES = {
  defense_turret_mk1: { damage: 15, cost: { credits: 500,  ore: 50 } },
  defense_turret_mk2: { damage: 30, cost: { credits: 1500, ore: 100, crystal: 20 } },
  defense_turret_mk3: { damage: 50, cost: { credits: 4000, ore: 200, crystal: 60 } },
  station_shield_mk1: { shieldHp: 150, regen: 10, cost: { credits: 1000, crystal: 50 } },
  station_shield_mk2: { shieldHp: 350, regen: 25, cost: { credits: 3000, crystal: 100, gas: 30 } },
  ion_cannon:         { damage: 80, oncePer: 'combat', bypassShields: true,
                        cost: { credits: 8000, ore: 300, crystal: 100, gas: 50 } },
};

// Stationsreparatur
export const STATION_REPAIR_CREDITS_PER_HP = 5;
export const STATION_REPAIR_ORE_PER_HP     = 1;

// Stations-HP
export const STATION_BASE_HP = 500;
```

### 8.3 DB-Schema-Erweiterungen (`packages/server/src/db/migrations/`)

**Migration 011 — Combat v2 + Station Defense:**

```sql
-- Stations-HP (Erweiterung der structures-Tabelle)
ALTER TABLE structures ADD COLUMN IF NOT EXISTS current_hp   INTEGER DEFAULT 500;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS max_hp       INTEGER DEFAULT 500;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS damaged_at   BIGINT;

-- Stations-Verteidigung (eigene Tabelle)
CREATE TABLE IF NOT EXISTS station_defenses (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  sector_x      INTEGER NOT NULL,
  sector_y      INTEGER NOT NULL,
  defense_type  TEXT    NOT NULL,  -- 'defense_turret_mk1', 'station_shield_mk1', etc.
  installed_at  BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  UNIQUE(user_id, sector_x, sector_y, defense_type)
);
CREATE INDEX IF NOT EXISTS idx_station_defenses_location
  ON station_defenses(sector_x, sector_y);

-- Kampf-Log Erweiterung
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS rounds_played  INTEGER DEFAULT 1;
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS round_details  JSONB;
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS player_hp_end  INTEGER;

-- Station-Kampf-Log
CREATE TABLE IF NOT EXISTS station_battle_log (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  sector_x      INTEGER NOT NULL,
  sector_y      INTEGER NOT NULL,
  attacker_level INTEGER NOT NULL,
  outcome       TEXT    NOT NULL,
  hp_lost       INTEGER NOT NULL DEFAULT 0,
  fought_at     BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
```

### 8.4 Server-Handler-Erweiterungen (`packages/server/src/rooms/SectorRoom.ts`)

Neue Message-Handler:
- `'combatV2Action'` → `handleCombatV2Action(client, data)` — Verarbeitet Taktikwahl pro Runde
- `'installStationDefense'` → `handleInstallStationDefense(client, data)` — Baut Turm/Schild
- `'repairStation'` → `handleRepairStation(client, data)` — Repariert Station

Neue Engine-Module:
- `packages/server/src/engine/combatV2.ts` — Multi-Runden-Kampflogik
- `packages/server/src/engine/stationCombat.ts` — Stations-Verteidigungs-Automatik

Neue DB-Queries (`packages/server/src/db/queries.ts`):
- `getStationDefenses(userId, sectorX, sectorY)`
- `installStationDefense(userId, sectorX, sectorY, defenseType)`
- `getStationHp(userId, sectorX, sectorY)`
- `updateStationHp(userId, sectorX, sectorY, newHp)`
- `insertStationBattleLog(...)`

### 8.5 Client-Komponenten (`packages/client/src/components/`)

| Komponente              | Beschreibung                                    |
|-------------------------|-------------------------------------------------|
| `CombatV2Dialog.tsx`    | Haupt-Kampf-Dialog (ersetzt/ergänzt BattleDialog)|
| `CombatHpBar.tsx`       | HP + Schild-Balken-Komponente (wiederverwendbar) |
| `StationCombatOverlay.tsx` | Station-unter-Angriff-Benachrichtigung       |
| `StationDefensePanel.tsx`  | Verteidigung verwalten (Türme/Schilde bauen) |

Neue State-Felder (`packages/client/src/state/gameSlice.ts`):
- `activeCombatV2: CombatV2State | null` — Aktiver v2-Kampf
- `stationCombatEvent: StationCombatEvent | null` — Station-Alarm

---

## 9. Integrations-Punkte

### Bestehende Systeme

| System           | Integration                                              |
|------------------|----------------------------------------------------------|
| Modul-System     | Neue Kategorien `weapon` + `shield` in `MODULES`         |
| Ship-Designer    | Slot-Beschränkungen: 1 Waffe + 1 Schild empfohlen        |
| Fraktionen       | `combatMultiplier` wirkt auf Waffenschaden               |
| Quest-System     | Kampf-Quests können v2 nutzen (Bounty-Quests)            |
| Reputation       | Pirate-Rep beeinflusst Flucht + Verhandeln (wie bisher)  |
| Struktur-System  | Stationsverteidigung als neue Strukturtypen              |
| Monitor-System   | Neues `BATTLE`-Monitor optional (Kampf-Log Übersicht)    |

### Rückwärtskompatibilität

- Bestehende `PirateEncounter` / `BattleResult` Typen bleiben
- `BattleDialog.tsx` + `BattleResultDialog.tsx` bleiben für Fallback
- `handleBattleAction()` weiter aktiv für Simple-Mode
- v2-Kampf via Feature-Flag aktivierbar: `FEATURE_COMBAT_V2 = true`

---

## 10. Phasen-Plan

### Phase 1 — Neue Module (2 Tage)

- [ ] `laser_mk1/mk2/mk3` in `MODULES` + Tests
- [ ] `railgun_mk1/mk2` in `MODULES` + Tests
- [ ] `missile_mk1/mk2` in `MODULES` + Tests
- [ ] `emp_array` in `MODULES` + Tests
- [ ] `shield_mk1/mk2/mk3` in `MODULES` + Tests
- [ ] `point_defense` + `ecm_suite` in `MODULES` + Tests
- [ ] `calculateShipStats()` um neue Felder erweitern
- [ ] Ship-Designer: neue Module anzeigen + equippable

### Phase 2 — Combat Engine v2 (3 Tage)

- [ ] `combatV2.ts` Engine-Modul schreiben (Runden-Logik + Formeln)
- [ ] `CombatV2Dialog.tsx` Client-Komponente
- [ ] `CombatHpBar.tsx` wiederverwendbare HP-Bar
- [ ] Neuer Message-Handler `combatV2Action`
- [ ] State-Erweiterung `activeCombatV2`
- [ ] Tests: Kampfformeln, Taktik-Multiplikatoren, EMP, Piercing
- [ ] Integration in Pirate-Ambush-Flow

### Phase 3 — Stationskampf (2 Tage)

- [ ] Migration 011 (DB-Schema)
- [ ] `stationCombat.ts` Auto-Kampf-Engine
- [ ] `installStationDefense` + `repairStation` Handler
- [ ] `StationCombatOverlay.tsx` + `StationDefensePanel.tsx`
- [ ] Station-Battle-Log
- [ ] Tests: Stations-Auto-Kampf, Reparatur-Kosten

### Phase 4 — Balance & Polish (1 Tag)

- [ ] Balancing-Pass (Schadenzahlen, Costs)
- [ ] Kampf-Log Monitor (`BATTLE`-Monitor)
- [ ] Accessibility: Keyboard-Shortcuts für Taktiken (F1-F5)
- [ ] Alle Tests grün (Ziel: 300+ Tests)

---

## Anhang: ASCII-Schiff-Darstellungen im Kampf

### Scout (klein, wendig)
```
    ╱╲
   ╱██╲
  ╱████╲
  ╲████╱
   ╲██╱
    ╲╱
```

### Cruiser (mittelgroß, balanced)
```
  ╱╲  ╱╲
 ╱██╲╱██╲
╱████████╲
╲████████╱
 ╲██╱╲██╱
```

### Freighter (groß, langsam)
```
  ┌──────────┐
  │ ░░░░░░░░ │
══╡ ░CARGO░░ ╞══
  │ ░░░░░░░░ │
  └────┬─────┘
       │
      ═╧═
```

### Battleship (massiv, gepanzert)
```
  ████████████
 ╔════════════╗
 ║ ▓▓ [] ▓▓  ║
═╣ ▓▓████▓▓  ╠═
 ║ ▓▓ [] ▓▓  ║
 ╚════════════╝
  ████████████
```

### Explorer (lang, Sensor-Array)
```
   ─────
  ╱─────╲
 ╱───────╲
│─────────│
 ╲───┬───╱
     │
    ═╧═
    ═══
```

---

*Dokument-Ende — voidSector Combat System v2 Design*
