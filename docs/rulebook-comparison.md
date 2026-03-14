# voidSector — Regelwerk-Vergleich: Spec vs. Implementierung

> **Stand:** 2026-03-14 · Branch: `master` · Commit: `bd03ca5`
>
> Dieses Dokument vergleicht systematisch das **Spec-Regelwerk** (`rulebook-spec.md`)
> mit dem **Implementierungs-Regelwerk** (`rulebook-implementation.md`), Sektion fuer Sektion.

---

## Bewertungslegende

| Symbol | Bedeutung |
|--------|-----------|
| ✅ OK | Spec und Implementierung stimmen ueberein |
| ⚠️ Abweichung | Implementiert, aber anders als spezifiziert |
| ❌ Fehlt | In Spec definiert, aber nicht implementiert |
| ➕ Zusaetzlich | Implementiert ohne Spec-Vorgabe |

---

## 1. Universum & Navigation

### Uebereinstimmungen
- WORLD_SEED = 77 — identisch
- Quadranten-System: QUADRANT_SIZE = 500, Formel `floor((x + 250) / 500)` — identisch
- Quadrant-Konfiguration: 5 Faktoren (resourceFactor, stationDensity, pirateDensity, nebulaThreshold, emptyRatio), Bereich 0.5–1.5 — identisch
- Erstkontakt: 60s Naming-Window, Silben-basiert, 3–24 Zeichen, Namensregeln — identisch
- Content-Weights: `none`=0.90, `asteroid_field`=0.05, `pirate`=0.02, `anomaly`=0.01, `station`=0.016, `ruin`=0.004 — identisch
- Piraten nur in Frontier-Quadranten (1–5 leere Nachbar-Quadranten) — identisch
- Spawn: x in [1,5], y in [1,5] — identisch
- Black Holes: 0.5% Chance, min. Distanz 50, unpassierbar — identisch
- Umgebungsmodifikatoren: Nebel-Scanner-Malus -1, Nebel-Piraten -30%, Empty-Fuel -20% — identisch
- 15% Ancient-Stationen — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Nebel-Grid | 5000 Sektoren | 250 Sektoren (`NEBULA_ZONE_GRID=250`) | ⚠️ Abweichung |
| Nebel-Chance | 8% pro Grid-Zelle | 40% pro Grid-Zelle (`NEBULA_ZONE_CHANCE=0.4`) | ⚠️ Abweichung |
| Nebel-Min-Radius | 3 Sektoren | 2.5 Sektoren (`NEBULA_ZONE_MIN_RADIUS=2.5`) | ⚠️ Abweichung |
| Nebel-Sicherheitszone | 200 Sektoren um Ursprung | 50 Sektoren (`NEBULA_SAFE_ORIGIN=50`) | ⚠️ Abweichung |
| Ressourcen `empty` | 5/5/5 (Ore/Gas/Crystal) | 0/0/0 | ⚠️ Abweichung |
| Ressourcen `nebula` | 2/20/3 | 0/30/5 | ⚠️ Abweichung |
| Ressourcen `asteroid_field` | 20/2/3 | 50/0/8 | ⚠️ Abweichung |
| Ressourcen `anomaly` | 3/3/20 | 3/3/20 | ✅ OK |
| Passierbarkeit `star` | Nicht erwaehnt | `star` ist unpassierbar (in types.ts) | ➕ Zusaetzlich |
| Quadrant (0,0) Schutz | Nicht erwaehnt | "Zentrum" ist geschuetzt, kann nicht umbenannt werden | ➕ Zusaetzlich |
| Distanz-Tier-System (NPC) | Nicht erwaehnt | 4 Tier-Stufen basierend auf euklidischer Distanz | ➕ Zusaetzlich |

### Fehlend in Implementierung
- Spec erwaehnt `SECTOR_MAX_FEATURES = 3` (max 3 Contents pro Sektor) — nicht explizit in Implementation dokumentiert
- Spec-Sektor-Farben und -Symbole (z.B. `asteroid_field` Symbol `▓`, Amber `#FFB000`) unterscheiden sich teilweise von der Implementation (z.B. `◆` fuer asteroid_field)

### Zusaetzlich in Implementierung
- `star` und `planet` als zusaetzliche Environment-Typen
- Black-Hole-Cluster-System (Grid=200, Chance=0.003, Radius 0–4)
- `NEBULA_CONTENT_ENABLED` Feature-Flag
- Ressourcen-Variation ±30% basierend auf Seed-Bits
- Quadrant-Skalierung: `resources * quadrantConfig.resourceFactor`

---

## 2. Aktionspunkte (AP)

### Uebereinstimmungen
- Max AP = 100, Start AP = 100, Regen = 0.5 AP/s — identisch
- Lazy Evaluation (kein Tick-Loop) — identisch
- Mining = 0 AP, Lokal-Scan = 1 AP, Flucht = 2 AP — identisch
- Rettung = 5 AP, Rettung abliefern = 3 AP — identisch
- Data-Slate (Sektor) = 1 AP, Custom = 2 AP — identisch
- Wreck untersuchen = 2 AP, bergen = 3 AP — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Area-Scan Lv.1 AP | 3 AP | 3 AP | ✅ OK |
| Area-Scan Lv.2 AP | 5 AP | 6 AP | ⚠️ Abweichung |
| Area-Scan Lv.3 AP | 8 AP | 10 AP | ⚠️ Abweichung |
| Area-Scan Lv.4/5 | Nicht spezifiziert | Lv.4=14 AP, Lv.5=18 AP | ➕ Zusaetzlich |
| Area-Scan Lv.1 Radius | 2 Sektoren | 3 Sektoren | ⚠️ Abweichung |
| Area-Scan Lv.2 Radius | 3 Sektoren | 6 Sektoren | ⚠️ Abweichung |
| Area-Scan Lv.3 Radius | 5 Sektoren | 9 Sektoren | ⚠️ Abweichung |
| Data-Slate (Area) AP | 3 AP (fix) | `3 + (scannerLevel - 1)` (variabel) | ⚠️ Abweichung |
| Normaler Sprung AP | 1–2 AP (hull-abhaengig) | 1 AP (Basis, `ship.apCostJump`) | ⚠️ Abweichung |
| Hyperjump AP-Formel | Base(5) - Speed + Fuel-Faktor + Umgebungs-Malus | `max(1, 5 - (engineSpeed-1))` | ⚠️ Abweichung |
| Lab-Upgrade AP | Nicht erwaehnt | 20 AP | ➕ Zusaetzlich |

### Fehlend in Implementierung
- Spec erwaehnt Piraten-Malus +50% AP in Piraten-Sektoren — nicht in Implementierung dokumentiert
- Spec erwaehnt Treibstoff-Distanz-Faktor (+0.1 pro 100 Sektoren) fuer AP-Kosten — nicht in Implementierung

### Zusaetzlich in Implementierung
- Basis-Hull-Regen ohne Generator: 0.08 AP/s
- Generator-Module mit AP/s-Werten (MK.I=0.20 bis MK.V=1.00)
- Power-Level-Multiplikatoren (off/low/mid/high) fuer Generatoren
- NaN-Schutz und negative Zeitdifferenz-Handling in AP-Berechnung
- Scanner Level 4 und 5 mit AP-Kosten 14 bzw. 18

---

## 3. Treibstoff & Hyperdrive

### Uebereinstimmungen
- BASE_FUEL_CAPACITY = 10.000 — identisch
- BASE_FUEL_PER_JUMP = 100 — identisch
- Fuel-Formel: `max(1, ceil(100 * distance * (1 - driveEfficiency)))` — identisch
- Hyperjump permanent aktiv (kein Feature-Flag mehr) — identisch
- Lazy Evaluation fuer Hyperdrive-Charge — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Treibstoffpreis/Einheit | 2 CR (`FUEL_COST_PER_UNIT`) | 0.01 CR (Stations-Fuel) | ⚠️ Abweichung |
| Heimatbasis-Betankung | Gratis | Nicht explizit dokumentiert | ⚠️ Abweichung |
| Friendly Rep Rabatt | -10% (0.90x) | -15% (0.85x) | ⚠️ Abweichung |
| Honored Rep Rabatt | -25% (0.75x) | -35% (0.65x) | ⚠️ Abweichung |
| Feindlich Aufschlag | Nicht erwaehnt | 2.0x (feindlich), 1.3x (unfreundlich) | ➕ Zusaetzlich |
| Normale Spruenge Fuel | Nicht explizit | 0 Treibstoff | ➕ Zusaetzlich |
| Normale Sprung-Reichweite | Nicht explizit | 1 Sektor (Chebyshev) | ➕ Zusaetzlich |
| Jumpgate-Treibstoff | Nicht in Sec 3 | 1 Einheit | ➕ Zusaetzlich |

### Fehlend in Implementierung
- Fuel-UI-Details (orangener Gradient-Balken, COST/SEKTOR-Anzeige) — nur im Spec, nicht in Implementation dokumentiert (UI existiert aber wahrscheinlich im Code)

### Zusaetzlich in Implementierung
- Treibstoff-Station-Produktion (Baseline/Tick, Gas-Rate, Level-Effizienz)
- Hyperdrive GAS-Aufladung: 1 GAS = 4 Charge
- Hyperdrive max Charge nach Drive-Tier (MK.I=32 bis MK.V=512)
- Hyperdrive Regen = 4.0/s fuer alle Drives
- Minimum-Tank = 1.000
- Drive MK.IV und MK.V (Spec kennt nur bis MK.III + Void Drive)

---

## 4. Scanning & Erkundung

### Uebereinstimmungen
- Lokal-Scan: 1 AP — identisch
- SCAN_EVENT_CHANCE = 15% — identisch
- Scan-Event-Typen (pirate_ambush, distress_signal, anomaly_reading, artifact_find, blueprint_find) — identisch
- Artefakt-Drop: artifact_find=50%, anomaly_reading=8%, Piraten=3% — identisch
- Data-Slate NPC-Buyback: `sectorCount * 5 Credits` — identisch
- Custom Slates: 2 AP, 5 CR, max 20 Koordinaten, max 10 Codes, max 500 Zeichen — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Scanner Lv.1 Radius | 2 | 3 | ⚠️ Abweichung |
| Scanner Lv.2 Radius | 3 | 6 | ⚠️ Abweichung |
| Scanner Lv.3 Radius | 5 | 9 | ⚠️ Abweichung |
| Scanner Lv.4/5 | Nicht definiert | Lv.4 Radius=12, Lv.5 Radius=15 | ➕ Zusaetzlich |
| Scan-to-Slate AP | 0 AP (Scan hat bereits gekostet) | Nicht explizit in Implementation-Dokument | ⚠️ Abweichung |
| Slate-Speicher-Limit | 1 Cargo-Slot pro Slate | `memory`-Stat des Schiffs (BASE=10 + Module) | ⚠️ Abweichung |

### Fehlend in Implementierung
- Scan-Sharing (Fraktionsmitglieder teilen Scan-Daten automatisch) — nicht im Implementation-Dokument erwaehnt
- Scan-to-Slate spezifische Regeln (nur 1 Slate pro Scan, Button-Disable-Logik) — nicht dokumentiert
- SlateType `scan` — nicht im Implementation-Dokument erwaehnt

### Zusaetzlich in Implementierung
- RADAR_RADIUS = 3 Sektoren
- Versteckte Signaturen wenn scannerLevel < 3
- Staleness-System: STALENESS_DIM_HOURS=24, STALENESS_FADE_DAYS=7
- Scanner-Memory-System (BASE=10, Module erhoehen)

---

## 5. Mining & Ressourcen

### Uebereinstimmungen
- Mining kostet 0 AP — identisch
- Ressourcen-Typen: ore, gas, crystal, artefact — identisch
- NPC-Basispreise: Ore=10, Gas=15, Crystal=25 — identisch
- Kauf-Spread x1.2, Verkauf-Spread x0.8 — identisch
- RESOURCE_REGEN_DELAY_TICKS = 50 — identisch
- RESOURCE_REGEN_INTERVAL_TICKS = 12 — identisch
- Typisierte Artefakte (9 Kategorien) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Mining-Rate | 0.1 u/s | 1.0 u/s (`MINING_RATE_PER_SECOND=1`) | ⚠️ Abweichung |
| BASE_CARGO | 10 | 20 (`constants.ts:2059`) | ⚠️ Abweichung |
| cargo_mk1 | +5 (oder +10) | +10 | ⚠️ Abweichung |
| cargo_mk2 | +12 | +24 | ⚠️ Abweichung |
| cargo_mk3 | +25 | +50 | ⚠️ Abweichung |
| cargo_mk4/mk5 | Nicht definiert | mk4=+80, mk5=+120 | ➕ Zusaetzlich |
| Artefakt-Typ-Bonus | +10% Forschungszeit-Reduktion | Nicht im Implementation-Dokument | ⚠️ Abweichung |

### Fehlend in Implementierung
- Server-Side Auto-Stop Formeln (timeout basierend auf sectorYield/rate) — nicht in Implementation-Dokument
- Mine-All Modus Details (Reihenfolge Ore -> Gas -> Crystal) — nur `mineAll`-Flag erwaehnt
- Anzeige-Format "CRYSTAL 3/7" — nicht dokumentiert

### Zusaetzlich in Implementierung
- Mining-Module bis Tier 5 (mining_laser_mk1 bis mk5)
- ACEP-Mining-Bonus: `ausbau_xp * 0.006`
- Fraktions-Mining-Multiplikator
- Verarbeitete Gueter: fuel_cell, circuit_board, alloy_plate, void_shard, bio_extract
- Treibstoff-Kosten Mining: 0

---

## 6. Handel & Wirtschaft

### Uebereinstimmungen
- NPC-Basispreise (Ore=10, Gas=15, Crystal=25) — identisch
- Kauf/Verkauf-Spreads (x1.2 / x0.8) — identisch
- NPC-Station-Level (5 Stufen: Outpost bis Megastation) — identisch
- Station-XP-Quellen (Visit=+5, Handel=+1/u, Quest=+15, Zerfall=-1/h) — identisch
- Storage-Tiers (50/150/500, Kosten 0/200/1000) — identisch
- Trading-Post-Tiers (NPC TRADE/MARKTPLATZ/AUTO-TRADE) — identisch
- Handelsrouten (Max 3, 15–120 Min, 0.5 Fuel/Dist) — identisch
- Fabrik-Rezepte (5 Rezepte mit identischen Inputs, Outputs, Dauern) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Dynamische Preisformel | `round(basePrice * (2 - stockRatio))` | `round(basePrice * distanceFactor * nebulaPremium * repFactor)` | ⚠️ Abweichung |
| Restock-Rate | 2% Max-Stock/h | Nicht dokumentiert (eigenes Produktionssystem) | ⚠️ Abweichung |
| Verbrauchsrate | 1.5% Max-Stock/h | Nicht dokumentiert | ⚠️ Abweichung |
| Start-Fuellstand | 50–80% (deterministisch) | Nicht dokumentiert | ⚠️ Abweichung |
| Verkaufspreis-Formel | x0.8 vom Basispreis | `round(buyPrice * 0.6)` (60% vom Kaufpreis) | ⚠️ Abweichung |
| Rep-Preismod hostile | +50% | 1.5x (identisch) | ✅ OK |
| Rep-Preismod friendly | -10% | -10% (0.9x) | ✅ OK |
| Rep-Preismod honored | -25% | -25% (0.75x) | ✅ OK |

### Fehlend in Implementierung
- Kontor-Details (Budget-Reservierung, Selbstbefuellung-Verbot) — im Implementation-Dokument nur minimal erwaehnt
- Kontor "Einheitliches Item-System" Details (item_type + item_id) — nicht in Implementation

### Zusaetzlich in Implementierung
- Dynamische Preise mit Distanz-Faktor und Nebula-Premium
- Exotic-Ressource mit Basispreis 200
- Station-Produktion pro Tier (Erz/h, Gas/h, Kristall/h mit eigenen Werten)
- Station-Ankaufpreise (Erz=8, Gas=12, Kristall=16)

---

## 7. Kampf

### Uebereinstimmungen
- Combat v2: 5 Runden, Schadenswurf x0.85–x1.15 — identisch
- Taktik-Modifikatoren (Assault 1.3/0.8, Balanced 1.0/1.0, Defensive 0.75/1.35) — identisch
- Spezial-Aktionen (Aim +50%/35% Disable, Evade 50%, EMP 75%/2 Runden) — identisch
- Piraten-Level: `min(10, floor(distance / 50))` — identisch
- Piraten-Stats: HP=20+10*Level, Damage=5+3*Level — identisch
- Verhandeln: pirateLevel * 10 Credits — identisch
- Flucht AP: 2 — identisch
- Cargo-Verlust bei Niederlage: 25–50% — identisch
- Station-HP: 500, Max Kampfrunden: 10 — identisch
- Verteidigungsanlagen (alle 6 Module mit identischen Werten) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Waffen-Module | 8 Module (laser_mk1–3, railgun_mk1–2, missile_mk1–2, emp_array) | Gleiche 8 Module — identisch | ✅ OK |
| Schild-Module | shield_mk1–3 (30/60/100 HP, 3/6/12 Regen) | Identisch | ✅ OK |
| Kampf-Engine Runden | 5 Runden (v2) | 10 Runden (neue combatEngine) | ⚠️ Abweichung |
| Auto-Flee | Nach Runde 5 automatisch | Nach Runde 10 = Draw | ⚠️ Abweichung |
| Fluchtchance (v1) | 60% Basis | `0.6 + shipAttack*0.02 - pirateLevel*0.05` | ⚠️ Abweichung |
| Verhandeln Bedingung | Nicht spezifiziert | `pirateReputation >= 1` (friendly) | ➕ Zusaetzlich |

### Fehlend in Implementierung
- Keine explizite Dokumentation der Waffen-Mechaniken (Railgun Panzerbrechend-Formel, Missile-Abfangrate, EMP-Direktschaden=0) in der Implementation — die Module existieren aber mit korrekten Werten

### Zusaetzlich in Implementierung
- Neue Combat-Engine mit EP-System (Generator EP, Power-Level-Kosten pro Modul-Kategorie)
- Modul-Schadenszustaende (intact/light/heavy/destroyed) mit Power-Level-Caps
- Modul-HP nach Tier (20/35/55/80/110)
- Modul-Schaden im Kampf: `max(1, floor(netPlayerDamage * 0.3))`
- Reaktionen: Shield Boost (-30%), ECM Pulse (-50%), Emergency Eject (HP<15%)
- Ancient Ability (3 Runden Aufladung, Explorer Passive, Energy Pulse 20 Schaden)
- Generator-Zerstoerung = Niederlage

---

## 8. Fraktionen & Diplomatie

### Uebereinstimmungen
- NPC-Fraktionen (5 mit Gewichten: independent=30%, traders=28%, scientists=25%, pirates=16%, ancients=1%) — identisch
- Reputations-Tiers (hostile/unfriendly/neutral/friendly/honored mit Bereichen) — identisch
- Spieler-Fraktions-Upgrade-Baum (3 Tiers, gleiche Optionen und Kosten) — identisch
- Humanity Rep System (3 Tiers: <-200=0.5x, -200..+200=1.0x, >+200=1.5x) — identisch
- Alien-Fraktionen (11 implementiert inkl. humans, archivists, consortium, kthari, etc.) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Alien-Fraktionen Anzahl | 10 Rassen (8 detailliert + 2 erwaehnt) | 11 Fraktionen (inkl. humans, helions, axioms) | ⚠️ Abweichung |
| Preismod hostile | +50% | 1.5x (identisch) | ✅ OK |
| Preismod friendly | -10% | -10% (0.9x) | ✅ OK |
| Preismod honored | -25% | -25% (0.75x) | ✅ OK |

### Fehlend in Implementierung
- Fraktions-Upgrades bei honored (cargo_expansion, advanced_scanner, combat_plating, void_drive) — nicht im Implementation-Dokument
- Alien-Fraktionen Stil/Aggression-Details (K'thari militaerisch, Silent Swarm sehr hoch, etc.) — nicht in Implementation
- Rep-Quellen (4 Eintragspunkte: resolveAlienEncounter, storyChoice, Community-Quest, Alien-Interaction) — nicht in Implementation-Dokument detailliert

### Zusaetzlich in Implementierung
- Alien-Startregionen mit genauen Quadrant-Koordinaten und Radien
- Fraktions-Rang-Berechtigungen (Leader/Officer/Member)
- Menschliches Startgebiet: Quadranten (0,0) bis (4,4) — 25 Quadranten
- Kosmische Fraktions-Farben (11 Farben)

---

## 9. Quests

### Uebereinstimmungen
- Max aktive Quests: 3 — identisch
- Quest-Ablauf: 7 Tage — identisch
- Story-Quest-Kette: 9 Kapitel, gleiche Q-Dist-Werte und Titel — identisch
- Story-Quest Branch-Rep-Effekte (Kapitel 2/4/5/6/8) — identisch
- Trigger-Regel: Q-Dist >= Kapitel-Distanz + vorherige abgeschlossen — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Quest-Typen | 5 (fetch, delivery, scan, bounty, bounty_chase) | 9 (+ bounty_trail, bounty_combat, bounty_deliver, scan_deliver) | ⚠️ Abweichung |
| Max getrackte Quests | 5 | Nicht im Implementation-Dokument erwaehnt | ⚠️ Abweichung |
| Quest-Belohnungsstruktur | Credits, XP, Rep, Artefakt-Chance | Credits, XP, Rep, reputationPenalty, rivalFactionId, wissen | ⚠️ Abweichung |

### Fehlend in Implementierung
- Bounty-Chase-System Details (Trail-Laenge nach Level, Hinweis-Qualitaet, Sci-Fi-Namengenerator) — nicht dokumentiert (#268)
- Community-Quests (4 rotierende Quests: interstellar_message, great_survey, jumpgate_network, galactic_olympics) — nicht in Implementation
- Spontane Alien-Encounter Details (7 Events mit Chancen und Min Q-Dist) — nicht in Implementation
- Quest-Tracking & Journal Details (BookmarkBar VERFOLGT, blauer Radar-Puls) — nicht in Implementation
- Quest-UI-Verbesserungen (#283: Typ-Badge, Strukturierte Sektionen, ABBRECHEN-Button) — nicht in Implementation
- Quest-Rotation (taeglich, stationsabhaengig) — nicht in Implementation

### Zusaetzlich in Implementierung
- Erweiterte Quest-Typen: bounty_trail, bounty_combat, bounty_deliver, scan_deliver
- Quest-Belohnung mit `wissen`-Feld

---

## 10. ACEP (Pilot-Entwicklung)

### Uebereinstimmungen
- Gesamt-Cap: 100 XP, Pfad-Cap: 50 XP — identisch
- 4 Pfade: ausbau, intel, kampf, explorer — identisch
- AUSBAU Extra-Slots: +1 bei 10 XP, +2 bei 25, +3 bei 40, +4 bei 50 — identisch
- AUSBAU Cargo-Multiplikator: `1.0 + XP * 0.01` (max +50%) — identisch
- AUSBAU Mining-Bonus: `XP * 0.006` (max +30%) — identisch
- INTEL Scan-Radius: +1 bei 20, +2 bei 40, +3 bei 50 — identisch
- INTEL Staleness: `1.0 + XP * 0.02` (max 2.0x) — identisch
- KAMPF Schaden: `XP * 0.004` (max +20%) — identisch
- KAMPF Schild-Regen: `XP * 0.006` (max +30%) — identisch
- EXPLORER Ancient Detection ab 25 XP, Helion Decoder ab 50 XP — identisch
- EXPLORER Anomaly-Chance: `XP * 0.002` (max +10%) — identisch
- Trait-System: 6 Traits mit identischen Bedingungen und Prioritaet — identisch
- Radar-Icon-Evolution: 4 Tiers (0–19, 20–49, 50–79, 80–100) — identisch
- Permadeath: 30% XP-Vererbung, 1 Trait, 25% Modul-Bergbarkeit — identisch
- ACEP-UI: 3-Tab-Struktur (ACEP/MODULE/SHOP) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| XP-Quellen AUSBAU Mining | +2 XP | `+2 XP` (identisch) | ✅ OK |
| XP-Quellen INTEL Scan | +3 XP | `+3 XP` (identisch) | ✅ OK |
| XP-Quellen KAMPF Pirat | +5 XP | `+5 XP` (identisch) | ✅ OK |
| XP-Quellen EXPLORER Cross-Q | +2 XP | `+2 XP` (identisch) | ✅ OK |
| Radar-Icon Tier 1 | 0–24 XP | 0–19 XP | ⚠️ Abweichung |
| Radar-Icon Tier 2 | 25–49 XP | 20–49 XP | ⚠️ Abweichung |
| Boost | +5 XP (kostet Credits + Wissen), nur wenn total < 100 | +5 XP mit Kosten-Tiers nach aktuellem XP (0–19: 100CR/3W, 20–39: 300CR/8W, 40–49: 600CR/15W) | ⚠️ Abweichung |
| Eject Pod | HP = 0 (Schiff stirbt) | HP < 15% der Max-HP (Schiff ueberlebt, Cargo verloren) | ⚠️ Abweichung |
| ACEP-Level-Schwellen | Spec: 0–7/8–17/18–31/32–49/50 | Impl: 0/8/18/32/50 (identisch) | ✅ OK |

### Fehlend in Implementierung
- Persoenlichkeitssystem-Details (Kommentare nach Trait und Kontext) — nicht im Implementation-Dokument
- AUSBAU-Level-Gating fuer Forschungsslots und Fabrik — im Spec detailliert, nicht in Impl.
- Wreck Detection ab Explorer 25 XP (Tier 4/5 Wrecks auf Radar ohne Local Scan) — erwaehnt in Impl aber ohne Details

### Zusaetzlich in Implementierung
- ACEP-Level-Multiplikatoren auf Module (1.0x/1.1x/1.2x/1.35x/1.5x pro Level)
- Boost-Kosten-Tiers nach aktuellem XP-Stand
- Phoenix-Schiff Details: Generation +1, 50 Fuel Start
- Wrack-Tier-Mapping nach Total-XP

---

## 11. Schiffsmodule & Techbaum

### Uebereinstimmungen
- 8 spezialisierte Slots + Extra-Slots (AUSBAU-gated) — identisch
- Tech-Tree: 4 Branches, sternfoermig, Branch/Module/Specialization/Leaf — identisch
- Tech-Tree Kosten: Branch [150/450/1350], Module 280, Specialization 620, Leaf [180/540/1620] — identisch
- Globale Kostensteigerung: +5% pro Knoten — identisch
- Reset-Cooldown: 24h — identisch
- Research Tick: 60.000ms — identisch
- Lab-Multiplikatoren (1.0x/1.5x/2.0x/3.0x/4.0x/5.0x) — identisch
- Waffen-Module (8 Module mit identischen ATK-Werten) — identisch
- Schild-Module (3 Module mit identischen HP/Regen-Werten) — identisch
- Defense-Module (point_defense 60%, ecm_suite -15%) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| BASE_CARGO | 10 | 20 | ⚠️ Abweichung |
| BASE_ENGINE_SPEED | 2 | 2 | ✅ OK |
| BASE_MODULE_SLOTS | 3 | 8 spezialisierte + 4 Extra | ⚠️ Abweichung |
| drive_mk1 | +1 Jump, +1 Speed | +1 Jump, +1 Speed, +2000 Fuel | ⚠️ Abweichung |
| drive_mk2 | +2 Jump, +2 Speed, -0.2 AP/J | +2 Jump, +2 Speed, +4000 Fuel | ⚠️ Abweichung |
| drive_mk3 | +3 Jump, +3 Speed, -0.5 AP/J | +3 Jump, +3 Speed, +7000 Fuel | ⚠️ Abweichung |
| drive_mk4/mk5 | Nicht definiert | mk4: +4J/+4S/+12000F, mk5: +6J/+5S/+18000F | ➕ Zusaetzlich |
| cargo_mk1 | +5 Cargo | +10 Cargo | ⚠️ Abweichung |
| cargo_mk2 | +12 Cargo, +1 Safe | +24 Cargo, +1 Safe | ⚠️ Abweichung |
| cargo_mk3 | +25 Cargo, +2 Safe, +20 Fuel | +50 Cargo, +2 Safe, +2000 Fuel | ⚠️ Abweichung |
| cargo_mk4/mk5 | Nicht definiert | mk4: +80/+3 Safe/+4000F, mk5: +120/+5 Safe/+8000F | ➕ Zusaetzlich |
| scanner_mk1 | +1 Level | +1 Level, +4 Memory | ⚠️ Abweichung |
| scanner_mk2 | +1 Level, +50 Komm | +1 Level, +50 Komm, +6 Memory | ⚠️ Abweichung |
| scanner_mk3 | +2 Level, +100 Komm, +3% Art | +2 Level, +100 Komm, +3% Art, +10 Memory | ⚠️ Abweichung |
| scanner_mk4/mk5 | Nicht definiert (nur quantum_scanner) | mk4: +3/+150/+5%/+14M, mk5: +4/+250/+8%/+20M | ➕ Zusaetzlich |
| armor_mk1 | +25 HP | +25 HP (identisch) | ✅ OK |
| armor_mk2 | +50 HP, -10% Schaden | +50 HP, -0.10 damageMod | ✅ OK |
| armor_mk3 | +100 HP, -25% Schaden | +100 HP, -0.25 damageMod | ✅ OK |
| armor_mk4/mk5 | Nicht definiert (nur nano_armor) | mk4: +150/-0.30, mk5: +250/-0.40 | ➕ Zusaetzlich |
| nano_armor | +150 HP, -35% | +150 HP, -0.35 (identisch) | ✅ OK |
| Modul-Kosten | Credits + Ressourcen (detailliert) | Nicht im Implementation-Dokument (nur Stats) | ⚠️ Abweichung |
| Forschungskosten | Credits + Ressourcen + Artefakte + Zeit | Wissen + typisierte Artefakte + Dauer | ⚠️ Abweichung |

### Fehlend in Implementierung
- Spec-Modul-Kosten in Credits + Ressourcen (Impl. verwendet Wissen-basiertes System)
- Blueprints umgehen NICHT Tech-Tree-Tier-Anforderungen — im Spec erwaehnt, in Impl. ueber Tech-Tree Tier-Unlock abgebildet

### Zusaetzlich in Implementierung
- Generator-Module (5 Tiers mit EP/Runde und AP/s)
- Repair-Module (5 Tiers mit HP/Runde und HP/s)
- Mining-Module (5 Tiers, mining_laser_mk1 bis mk5)
- Found-Only Module (ca. 30 Module die nur gefunden werden, mit Drawbacks)
- Modul-Kategorie -> Tech-Branch-Mapping
- Slot-Regeln: defense/special nur in Extra-Slots, Unique-Regel fuer shield/scanner
- Stat-Berechnung mit ACEP-Multiplikator und Clamping
- Memory-System fuer Slates (BASE=10, Module erhoehen)

---

## 12. Baustellen & Strukturen

### Uebereinstimmungen
- Struktur-Baukosten (11 Typen mit identischen Ore/Gas/Crystal/AP-Werten) — identisch
- Storage-Tiers (50/150/500, Kosten 0/200/1000) — identisch
- Trading-Post-Tiers — identisch
- Fabrik-Rezepte (5 Stueck mit identischen Werten) — identisch
- Lab-Multiplikatoren (1.0x bis 5.0x) — identisch
- Jumpgate-Baukosten (500 CR + 20 Crystal + 5 Artefakte) — identisch
- Jumpgate-Upgrades (Connections 1–3, Distance 250/500/2500) — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Baustellen-Geschwindigkeit | 1 Ressource pro 2 Sekunden | 1% pro Tick, Ressourcen anteilig | ⚠️ Abweichung |
| Basis-Ressourcen fuer Basis | 60 Ressourcen total | `ceil(progress * totalNeeded / 100)` progressiv | ⚠️ Abweichung |
| Jumpgate als Struktur-AP | Nicht in Struktur-Tabelle | 10 AP (`constants.ts:97`) | ➕ Zusaetzlich |
| Fabrik-Nutzung | AUSBAU Level >= 2 (>= 8 XP) | Nicht explizit in Implementation | ⚠️ Abweichung |

### Fehlend in Implementierung
- Baustellen auf Radar sichtbar (#354) — nicht in Implementation dokumentiert
- Admin-Baustellen-Vervollstaendigung (#348) — nicht dokumentiert
- Lab-Stufen-Freischaltungen (was jede Stufe freischaltet) — nur Multiplikatoren in Impl.

### Zusaetzlich in Implementierung
- Natuerliche Jumpgates: 0.5% Spawn-Chance, Salt=777, Reisekosten 50/25 CR
- Ancient Jumpgates: 0.0001 Spawn-Rate, Reichweite 30.000–100.000
- Jumpgate-Minigame (30% Chance), Code-System (8 Zeichen)
- Kommunikationsreichweite pro Struktur (comm_relay=500, mining_station=500, base=1000)
- Lab-Upgrade-Kosten (Tier 2–5 mit Credits + Ore + Crystal)
- Lab-Upgrade AP: 20

---

## 13. Human Expansion & Kriegsfuehrung

### Uebereinstimmungen
- Conquest-Rate nach Station-Level (Lv1: 1.0/1.5, Lv2: 1.1/2.0, Lv3: 1.2/3.0) — identisch
- Pool-Max: 500, Pool-Drain/Tick: 50 — identisch
- Station-Modi: conquest/factory/battle — identisch
- Warfare-Engine: Advantage-Threshold 1.2, Loss 10%, Stalemate 5% — identisch
- Stations-Verteidigung nach Tier (100/300/700/1500) — identisch
- Conquest-Preis-Bonus-Formel — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Friction -> Conquest: Friction <= 20 | x0 (Expansion haelt) | x0 (kein Conquest moeglich) | ✅ OK |
| Friction -> Conquest: Friction <= 50 | x0.5 | x0.5 | ✅ OK |
| Friction -> Conquest: Friction <= 80 | x0.25 | x0.25 | ✅ OK |
| Friction -> Conquest: Friction > 80 | x0 -> battle | x0 -> battle | ✅ OK |
| Friction-Score Berechnung | Aus humanityRepTier abgeleitet | `clamp(0,100, round(baseFriction + (aggression-1.0)*20))` | ⚠️ Abweichung |
| Friction-States | peaceful_halt/skirmish/escalation/total_war (0–20/21–50/51–80/81–100) | Identisch | ✅ OK |
| Rep -> Tier Mapping | Nicht detailliert | >= 75=ally, >= 25=friendly, >= -25=neutral, >= -75=hostile, <-75=enemy | ➕ Zusaetzlich |
| Station-Tiers | I–IV (Outpost bis Gate Terminal) | Nicht als Expansion-Tiers dokumentiert | ⚠️ Abweichung |
| Nachbar-Pruefung | Nicht erwaehnt | Faction >= 60% in mind. 1 Nachbar-Quadrant erforderlich | ➕ Zusaetzlich |
| Crushing Threshold | Nicht erwaehnt | 10.0 (10x Vorteil = sofortiger Sieg) | ➕ Zusaetzlich |

### Fehlend in Implementierung
- Station-Tiers mit Funktionen (Outpost/Command Hub/Industrial Node/Gate Terminal) — nicht in Impl.
- Bau-Schiff und Sprungexpansion (Tier III/IV Features) — nicht dokumentiert
- Voids (Alien-Bedrohung) komplett: Todeszonen, Population 32–48, Spawn-Logik, Lifecycle, Void Shield, Void Gun — nicht in Impl. (#267)
- QUAD-MAP Visualisierungsdetails (Frontline-Glow, Conflict-Icons, War Ticker) — nicht in Impl. dokumentiert

### Zusaetzlich in Implementierung
- Expansion-Engine: Ulam-Spiral-Steps, Max 5 Stationen/Quadrant
- Mining-Drohnen pro Station (Max 3, voll nach 20 Ticks)
- Universe-Tick-Engine: 5s Tick, Faction-Expansion alle 360 Ticks (30 Min)
- Zivilisations-Meter Max: 10.000
- Share-Update-Logik: Anteile < 0.5 werden geloescht

---

## 14. Soziale Systeme

### Uebereinstimmungen
- Direkt-Handel: Redis-Sessions 60s TTL, `/trade @player`, atomarer Swap — identisch
- Rettungsmissionen: AP 5/3, Ablauf 30 Min, Belohnungen (50/10/25, 80/15/40, 100/20/50) — identisch
- XP-Level-System: 10 Levels mit identischen XP-Schwellen — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Chat-Kanaele | local, faction, direct, broadcast | direct, faction, quadrant, system | ⚠️ Abweichung |
| Notsignal-Chance | 8% pro Scan | 0.5% pro Sprung | ⚠️ Abweichung |
| Bookmark-Slots | 0=HOME, 1–5=frei, 6=SHIP (7 total) | 5 Slots (implizit durch UI) | ⚠️ Abweichung |

### Fehlend in Implementierung
- Friends System Details (#362): Migration 066, Datenmodell (player_friends, friend_requests, player_blocks) — nur Grundstruktur in Impl.
- PlayerCard Modal Details (Aktionen, Button-Zustaende) — nicht in Impl.
- Block-Check bei DIRECT-Nachrichten — nicht dokumentiert
- Spamschutz (5 Nachrichten/Minute, 24h Retention) — nicht dokumentiert
- Kommunikations-Reichweite Details (BASE_COMM_RANGE + Relays/Basen) — nicht in Impl.
- Gaeste-Einschraenkungen — nicht in Impl.
- Rate-Limit fuer Friend-Requests (1/2s) — nicht in Impl.
- Online-Status via Redis Set — nicht in Impl.
- Cross-Room-Delivery via commsBus — nicht in Impl.
- Bookmark-Farben — nicht in Impl.

### Zusaetzlich in Implementierung
- Badges: ORIGIN_FIRST, ORIGIN_REACHED
- Kontor mit Order-Typen buy/sell

---

## 15. UI & Cockpit

### Uebereinstimmungen
- 6-Sektionen-Layout mit identischen IDs und Funktionen — identisch
- Sec 4: ShipStatus + CombatStatus + Settings — identisch
- Sec 5: SectorInfo + NavControls + HardwareControls — identisch
- Sec 6: CommsScreen — identisch
- Amber-Hauptfarbe #FFB000 — identisch

### Abweichungen

| Aspekt | Spec/Anforderung | Implementierung | Bewertung |
|--------|-------------------|-----------------|-----------|
| Programme Anzahl | 12 (NAV-COM bis FRIENDS) plus 13. FRIENDS | 13 (NAV-COM, MINING, CARGO, BASE-LINK, TRADE, FACTION, QUESTS, TECH, QUAD-MAP, NEWS, LOG, ACEP, FRIENDS) | ⚠️ Abweichung |
| Programme RADAR | Eigenes Programm | Nicht als separates Programm (Teil des Hauptmonitors) | ⚠️ Abweichung |
| Programme SCAN | Eigenes Programm | Nicht als separates Programm gelistet | ⚠️ Abweichung |
| Programme TV | Werbe-Inhalte, CRT-Style Ads | "NEWS" statt "TV" | ⚠️ Abweichung |
| Programme BASE-LINK/LOG | Nicht in Spec | Zusaetzlich implementiert | ➕ Zusaetzlich |
| Station-Symbol | `△` (Dreieck) | `S` | ⚠️ Abweichung |
| Asteroid-Symbol | `▓` | `◆` | ⚠️ Abweichung |
| Anomaly-Symbol | `◇` | `◊` | ⚠️ Abweichung |
| Black-Hole-Symbol | Nicht spezifiziert | `o` | ➕ Zusaetzlich |
| Ruin-Symbol | Nicht spezifiziert | `☧` | ➕ Zusaetzlich |

### Fehlend in Implementierung
- Detail-Monitor (Sec 3) Programm-spezifische Inhalte — nicht in Impl. dokumentiert
- Inline-Fehlermeldungen (InlineError, actionError) — nicht in Impl. dokumentiert
- i18n (DE/EN Locale, Sprach-Toggle) — nicht in Impl. dokumentiert
- CRT-Aesthetik Details (Scanlines-Overlay, Vignette, Courier New) — nicht in Impl.
- Schiffsanimation (800ms, easeInOutCubic) — nicht in Impl. dokumentiert
- Autopilot (persistente Routen, max 3, Black-Hole-Avoidance) — nur Schrittgeschwindigkeit=100ms in Impl.
- willReadFrequently Canvas-Option — nicht in Impl.

### Zusaetzlich in Implementierung
- Autopilot-Schrittgeschwindigkeit: 100ms pro Sektor
- Reconnection-Timeout: 15 Sekunden
- Star-Symbol: `*`, Planet-Symbol: `●`
- Content-Symbole: meteor=`m`, relic=`R`, npc_ship=`▸`
- Hintergrundfarbe: `#050505`
- Bezel-Farbe: `#1a1a1a`

---

## Zusammenfassung

### Gesamtstatistik

| Kategorie | Anzahl |
|-----------|--------|
| ✅ **Uebereinstimmungen** (Regeln identisch) | ~128 |
| ⚠️ **Abweichungen** (implementiert, aber anders) | ~52 |
| ❌ **Fehlend in Implementierung** | ~38 |
| ➕ **Zusaetzlich in Implementierung** | ~45 |

### Uebersicht pro Sektion

| Sektion | ✅ | ⚠️ | ❌ | ➕ |
|---------|-----|-----|-----|-----|
| 1. Universum & Navigation | 10 | 7 | 2 | 5 |
| 2. Aktionspunkte (AP) | 6 | 7 | 2 | 5 |
| 3. Treibstoff & Hyperdrive | 5 | 4 | 1 | 7 |
| 4. Scanning & Erkundung | 6 | 3 | 3 | 4 |
| 5. Mining & Ressourcen | 7 | 4 | 3 | 5 |
| 6. Handel & Wirtschaft | 8 | 4 | 2 | 4 |
| 7. Kampf | 10 | 3 | 1 | 7 |
| 8. Fraktionen & Diplomatie | 5 | 1 | 3 | 4 |
| 9. Quests | 5 | 3 | 6 | 2 |
| 10. ACEP | 15 | 4 | 3 | 4 |
| 11. Schiffsmodule & Techbaum | 11 | 8 | 2 | 6 |
| 12. Baustellen & Strukturen | 7 | 3 | 3 | 6 |
| 13. Human Expansion | 8 | 2 | 4 | 5 |
| 14. Soziale Systeme | 3 | 3 | 10 | 2 |
| 15. UI & Cockpit | 5 | 5 | 7 | 6 |

### Kritische Abweichungen (nach Impact sortiert)

| # | Abweichung | Impact | Betroffene Issues |
|---|-----------|--------|-------------------|
| 1 | Nebel-Parameter (Grid 250 vs 5000, Chance 40% vs 8%, Safe 50 vs 200) | Hoch — voellig andere Nebel-Dichte | #219 |
| 2 | Mining-Rate (1.0/s vs 0.1/s) — 10x schneller als Spec | Hoch — Wirtschaftsbalance | — |
| 3 | BASE_CARGO (20 vs 10) — doppelt so viel | Hoch — Wirtschaftsbalance | Playtest-Fixes |
| 4 | Area-Scan Radien (3/6/9 vs 2/3/5) — deutlich groesser | Mittel — Balance | — |
| 5 | Area-Scan AP (3/6/10 vs 3/5/8) — teurer ab Lv.2 | Mittel — Balance | — |
| 6 | Cargo-Module (verdoppelt+) — mk1:+10 statt +5 | Mittel — Wirtschaftsbalance | Playtest-Fixes |
| 7 | Ressourcen-Yields voellig anders (empty 0/0/0 vs 5/5/5) | Mittel — Gameplay-Erlebnis | — |
| 8 | Voids (#267) komplett nicht implementiert | Hoch — Late-Game-Content fehlt | #267 |
| 9 | Community-Quests nicht implementiert | Mittel — Endgame-Content fehlt | AQ-Phase |
| 10 | Chat-Kanaele anders (quadrant/system vs local/broadcast) | Niedrig — Funktional aequivalent | — |

### Empfohlene Massnahmen

1. **Spec aktualisieren**: Nebel-Parameter, Mining-Rate, BASE_CARGO, Area-Scan-Werte, Ressourcen-Yields, Cargo-Module — diese Werte im Spec-Dokument an den aktuellen Code anpassen, da die Implementierung den aktuellen Spielstand darstellt
2. **Module Tiers 4–5**: Spec um die zusaetzlichen Module-Tiers (mk4, mk5, Generator, Repair, Mining) ergaenzen
3. **Found-Only Module**: Spec um die ~30 Found-Only Module ergaenzen
4. **Combat-Engine**: Spec um das neue EP-basierte Kampfsystem aktualisieren
5. **Fehlende Features pruefen**: Voids (#267), Community-Quests, Bounty-Chase-Details, Friends-System-Details — offene Issues tracken
6. **Soziale Systeme**: Spec und Implementation am staerksten divergent — konsolidieren

---

*Erstellt: 2026-03-14 | Automatischer Vergleich von `rulebook-spec.md` und `rulebook-implementation.md`*
