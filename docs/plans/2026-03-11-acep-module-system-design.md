# ACEP Modul-System — Design Dokument

**Datum:** 2026-03-11
**Status:** IN PROGRESS — Standard-Module ✅ · Found-Module 🔄
**Verknüpft mit:** `docs/plans/2026-03-09-acep-design.md`

---

## Slot-System

| Kategorie | Specialized Slot | Stapelbar | Zusatz-Slots |
|-----------|-----------------|-----------|--------------|
| drive     | ✅              | ❌        | ✅ 1× extra  |
| weapon    | ✅              | ✅ beliebig | ✅          |
| armor     | ✅              | ✅ beliebig | ✅          |
| shield    | ✅              | ❌ unique  | ❌           |
| scanner   | ✅              | ❌ unique  | ❌           |
| mining    | ✅              | ✅        | ✅           |
| cargo     | ✅              | ✅        | ✅           |
| defense   | ❌              | ✅        | ✅ nur Zusatz |
| special   | ❌              | ✅        | ✅ nur Zusatz |

**Regeln:**
- Specialized Slot leer → keine Funktionalität in dem Bereich (kein Mining-Laser = kein Mining)
- Unique-Module (shield, scanner): max 1× pro Schiff, auch in Zusatz-Slots nicht stapelbar
- Zusatz-Slots: freigeschaltet durch AUSBAU-Level (konkrete Schwellwerte → noch offen)

---

## XP-System

### Schiffs-XP = Summe aller ACEP-Bereich-XP

```
Gesamt-XP = AUSBAU-XP + INTEL-XP + KAMPF-XP + EXPLORER-XP
```

### ACEP-Level wirkt als Multiplikator auf Module des Bereichs

| Level | Bonus |
|-------|-------|
| 1     | Basis |
| 2     | +10%  |
| 3     | +20%  |
| 4     | +35%  |
| 5     | +50%  |

*(Konkrete Level-Schwellwerte: noch offen — abhängig von Spieltempo)*

### XP-Quellen

| Aktion | AUSBAU | INTEL | KAMPF | EXPLORER |
|--------|--------|-------|-------|----------|
| Sprung | +2 | — | — | — |
| Erstentdeckter Sektor | — | — | — | +10 |
| Erstentdeckter Quadrant (Entdecker-Bonus) | — | — | — | +50 |
| Area-Scan | — | +3 | — | — |
| Anomalie gefunden | — | +8 | — | — |
| Artefakt-Signal | — | +15 | — | — |
| Mining (5 Units) | +1 | — | — | — |
| Cargo verkauft (volle Ladung) | +2 | — | — | — |
| Kampfrunde (Schaden dealt) | — | — | +2 | — |
| Kampfrunde (Schaden kassiert) | — | — | +1 | — |
| Kampf gewonnen | — | — | +10 | — |
| Ancient-Ruine gescannt | — | — | — | +15 |

---

## Standard-Module

### DRIVE — AUSBAU + EXPLORER

AUSBAU-Level-Bonus: +5% jumpRange pro Level
EXPLORER-Level-Bonus: −5% apCostJump pro Level

| ID | Name | Tier | Primär | Sekundär | Kosten |
|----|------|------|--------|----------|--------|
| `drive_mk1` | Ion Mk.I | 1 | +1 jumpRange | +1 engineSpeed | 200 CR |
| `drive_mk2` | Ion Mk.II | 2 | +2 jumpRange | −0.3 apCostJump | 500 CR + 20 ore |
| `drive_mk3` | Ion Mk.III | 3 | +3 jumpRange | −0.5 ap, −1 fuelPerJump | 1200 CR + 50 ore |
| `void_drive` | Void Drive | 5 | +5 jumpRange | engineSpeed max, −2 fuel | 5000 CR + 10 artefact |

---

### WEAPON — KAMPF

KAMPF-Level-Bonus: +8% weaponAttack pro Level
XP-Trigger: +2 KAMPF pro Kampfrunde (Schaden dealt) · +10 KAMPF Kampf gewonnen

**Laser** (präzise, kein Pierce)

| ID | Tier | ATK | Sekundär | Kosten |
|----|------|-----|----------|--------|
| `laser_mk1` | 1 | +8 | — | 150 CR |
| `laser_mk2` | 2 | +16 | +10% pierce | 400 CR + 10 crystal |
| `laser_mk3` | 3 | +28 | +20% pierce | 1000 CR + 30 crystal |

**Railgun** (hoher Pierce)

| ID | Tier | ATK | Pierce | Kosten |
|----|------|-----|--------|--------|
| `railgun_mk1` | 2 | +12 | +30% | 600 CR + 20 ore |
| `railgun_mk2` | 3 | +22 | +50% | 1500 CR + 50 ore |

**Missile** (höchster Rohschaden, blockierbar)

| ID | Tier | ATK | Sekundär | Kosten |
|----|------|-----|----------|--------|
| `missile_mk1` | 2 | +18 | — | 700 CR + 10 ore |
| `missile_mk2` | 3 | +30 | −10% Trefferchance Gegner | 1800 CR + 40 ore |

**EMP**

| ID | Tier | ATK | Sekundär | Kosten |
|----|------|-----|----------|--------|
| `emp_array` | 3 | +10 | Schild disabled 1 Runde, +30% ecmReduction | 2000 CR + 20 crystal + 5 artefact |

---

### ARMOR — KAMPF (Specialized Slot + stapelbar)

KAMPF-Level-Bonus: +6% HP, +3% Schadensreduktion pro Level
XP-Trigger: +1 KAMPF pro Kampfrunde (Schaden kassiert, pro eingebautem Armor-Modul)

| ID | Name | Tier | HP | Schadensred. | Kosten |
|----|------|------|----|-------------|--------|
| `armor_mk1` | Platte Mk.I | 1 | +25 | — | 100 CR |
| `armor_mk2` | Platte Mk.II | 2 | +50 | −8% dmg | 300 CR + 15 ore |
| `armor_mk3` | Comp. Armor | 3 | +100 | −18% dmg | 800 CR + 50 ore |
| `void_plate` | Void Plate | 4 | +150 | −25% dmg, +10 shieldHp | 2500 CR + 5 artefact |

---

### SHIELD — KAMPF + AUSBAU (unique, 1× pro Schiff)

KAMPF-Level-Bonus: +10% shieldRegen pro Level
AUSBAU-Level-Bonus: +8% shieldHp pro Level
XP-Trigger: +2 KAMPF pro blockierter Schadenseinheit · +1 AUSBAU pro überlebtem Kampf

| ID | Name | Tier | ShieldHP | Regen/s | Sekundär | Kosten |
|----|------|------|----------|---------|----------|--------|
| `shield_mk1` | Schild Mk.I | 1 | +50 | +2 | — | 300 CR |
| `shield_mk2` | Schild Mk.II | 2 | +100 | +5 | +5% Resistenz | 800 CR + 20 crystal |
| `shield_mk3` | Adv. Shield | 3 | +150 | +8 | +10% Resistenz | 2000 CR + 50 crystal |

---

### SCANNER — INTEL (unique, 1× pro Schiff)

INTEL-Level-Bonus: +1 scanRadius bei Level 3 und 5 · +5% artefactChance pro Level
XP-Trigger: +3 INTEL Area-Scan · +8 INTEL Anomalie · +15 INTEL Artefakt-Signal · +20 INTEL Erstentdeckter Sektor

| ID | Name | Tier | Scanner-Level | Sekundär | Kosten |
|----|------|------|--------------|----------|--------|
| `scanner_mk1` | Scanner Mk.I | 1 | +1 (Radius 3) | — | 200 CR |
| `scanner_mk2` | Scanner Mk.II | 2 | +1 (Radius 6) | +50 commRange | 600 CR + 10 crystal |
| `scanner_mk3` | Deep Scanner | 3 | +2 (Radius 9) | +100 commRange, +3% artefactChance | 1500 CR + 30 crystal |
| `void_scanner` | Void Eye | 5 | +3 (Radius 15) | +200 commRange, +8% artefact, Ancient-Ping | 4000 CR + 15 artefact |

---

### MINING — AUSBAU

AUSBAU-Level-Bonus: +10% miningRate pro Level
XP-Trigger: +1 AUSBAU pro 5 abgebaute Einheiten

| ID | Name | Tier | Rate | Sekundär | Kosten |
|----|------|------|------|----------|--------|
| `mining_mk1` | Mining Laser Mk.I | 1 | +0.5/s | — | 150 CR |
| `mining_mk2` | Mining Laser Mk.II | 2 | +1.0/s | +5% Sektor-Yield | 400 CR + 20 ore |
| `mining_mk3` | Industrial Miner | 3 | +2.0/s | +15% Yield, +3 cargo | 1200 CR + 60 ore |

---

### CARGO — AUSBAU

AUSBAU-Level-Bonus: +8% cargoCap pro Level
XP-Trigger: +2 AUSBAU pro vollständig verkaufter Ladung

| ID | Name | Tier | Cargo | Sekundär | Kosten |
|----|------|------|-------|----------|--------|
| `cargo_mk1` | Cargo Mk.I | 1 | +5 | — | 100 CR |
| `cargo_mk2` | Cargo Mk.II | 2 | +12 | +1 safeSlot | 300 CR + 10 ore |
| `cargo_mk3` | Bulk Hauler | 3 | +25 | +2 safeSlots, +20 fuelMax | 800 CR + 30 ore |

---

### DEFENSE — KAMPF (nur Zusatz-Slots)

KAMPF-Level-Bonus: +10% Effektivität pro Level
XP-Trigger: +3 KAMPF pro Interception / ECM-Treffer

| ID | Name | Tier | Effekt | Kosten |
|----|------|------|--------|--------|
| `point_defense` | Point Defense | 3 | +3 pointDefense (Missile-Block %) | 1200 CR + 20 crystal |
| `ecm_suite` | ECM Suite | 3 | +30% ecmReduction, −15% Trefferchance Gegner | 1500 CR + 20 crystal + 3 artefact |

---

### SPECIAL — variabel (nur Zusatz-Slots)

| ID | Name | ACEP-Pfad | Effekt | XP-Trigger | Kosten |
|----|------|----------|--------|-----------|--------|
| `artefact_scanner` | Artefakt-Detektor | EXPLORER | +5% artefactChance | +5 EXPLORER pro Artefakt-Fund | 800 CR + 5 crystal |
| `relay_booster` | Relay Booster | INTEL | +200 commRange | +1 INTEL pro Relay-Hop | 400 CR + 10 crystal |
| `cargo_shield` | Cargo Shield | AUSBAU | +2 safeSlots | +2 AUSBAU pro Kampf überlebt | 600 CR + 20 ore |
| `ancient_resonator` | Ancient Resonator | EXPLORER | Ancient-Ruinen auf Radar (Radius 5) | +10 EXPLORER pro Ancient-Scan | 3000 CR + 10 artefact |

---

## Found-Module (Unique / Quirky)

### Prinzipien
- Stärker als Standard-Äquivalent in **einer** Dimension — kein reines Upgrade
- Echter, spürbarer Drawback — kein "schwacher Nachteil den man ignoriert"
- Einmalig pro Schiff (kein Duplikat möglich, auch nicht in Zusatz-Slots)
- Quellen: Ancient-Ruinen · Quests · Pirate-Boss-Loot · Wrack-POIs (selten)
- Im UI visuell unterschieden: goldener/amber Rahmen statt grün (Standard) / blau (Researched)

---

### DRIVE — Found

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `pulse_drive` | Pulse Drive | +6 jumpRange, engineSpeed max | Jeder 3. Sprung kostet 2× AP (Überhitzung) | Ancient-Ruine |
| `ghost_drive` | Ghost Drive | Sprünge hinterlassen keinen Radar-Trail für andere Spieler | −2 jumpRange, kein Hyperjump möglich | Pirate-Quest |
| `rift_engine` | Rift Engine | Hyperjump ignoriert Pirate-Fuel-Penalty, +8 jumpRange | 5% Chance pro Sprung: landet 1–2 Sektoren daneben | Ancient-Ruine (selten) |

---

### WEAPON — Found

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `ancient_lance` | Ancient Lance | +45 ATK, +40% pierce | Feuert nur jede 2. Runde (Ladezeit) | Ancient-Ruine |
| `void_ripper` | Void Ripper | +35 ATK, ignoriert Schilde komplett | −30 HP eigenes Schiff pro Abfeuern (Rückstoß) | Wrack-POI |
| `leech_cannon` | Leech Cannon | +20 ATK + stiehlt 15 HP des Gegners (Heal) | Kein Schaden gegen Schildierte Ziele | Pirate-Boss-Loot |
| `scrambler` | Scrambler | Deaktiviert Gegner-Sonderaktionen für 2 Runden | Nur 5 ATK, kein Schaden-Fokus | Quest (Scientists) |

---

### ARMOR — Found

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `living_hull` | Living Hull | +120 HP, regeneriert 3 HP/s außerhalb von Kämpfen | Im Kampf: kein Regen, −10% Schadensreduktion | Ancient-Ruine |
| `salvage_skin` | Salvage Skin | +80 HP, +20% Schadensreduktion | −5 cargoCap (nimmt Platz ein, unförmig) | Wrack-POI |
| `reactive_plating` | Reactive Plating | Gibt 10% des kassierten Schadens als Bonus-ATK im gleichen Runde zurück | −40 HP (dünn, aber reaktiv) | Quest (K'thari) |

---

### SHIELD — Found (unique)

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `mirror_shield` | Mirror Shield | Reflektiert 20% Schaden zurück an Angreifer | +80 shieldHp (schwächer als Mk.II), keine Resistenz | Ancient-Ruine |
| `reactive_barrier` | Reactive Barrier | Nach jedem Treffer: sofortiger +30 Shield-Regen | Schild aktiviert sich erst wenn HP < 50% | Wrack-POI |
| `parasite_shell` | Parasite Shell | +200 shieldHp (stärkster Schild im Spiel) | Verbraucht 1 Fuel pro Kampfrunde | Quest (Pirates) |

---

### SCANNER — Found (unique)

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `deep_whisper` | Deep Whisper | Erkennt versteckte Ancient-Sektoren, +12% artefactChance, Radius 12 | Scan-AP-Kosten +50% | Ancient-Ruine |
| `ghost_lens` | Ghost Lens | Zeigt Spieler-Positionen in Radius 8 | Eigene Position für andere Spieler ebenfalls sichtbar (Radius 8) | Quest (Archivare) |
| `war_scanner` | War Scanner | Zeigt Piraten-Stärke vor Kampf, +20% Trefferchance im Kampf | Nur Piraten-Daten, zivile Scans −2 Radius | Pirate-Boss-Loot |

---

### MINING — Found

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `void_drill` | Void Drill | +5.0/s Mining-Rate (2.5× Industrial Miner) | Zerstört Sektor-Yield 3× schneller (Raubbau) | Ancient-Ruine |
| `crystal_leech` | Crystal Leech | Wandelt automatisch Ore → Crystal (10:1) passiv | Mining-Rate −30% | Wrack-POI |
| `swarm_harvester` | Swarm Harvester | Baut 2 Ressourcentypen gleichzeitig ab | +15 cargoCap-Verbrauch pro Minute (Sortier-Overhead) | Quest (Traders) |

---

### CARGO — Found

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `living_hold` | Living Hold | +40 cargoCap, Ressourcen verderben nie (unbegrenzte Lagerzeit) | −10 HP (Schiff-Struktur geschwächt durch Bio-Wachstum) | Ancient-Ruine |
| `compressed_vault` | Compressed Vault | +50 cargoCap, +4 safeSlots | Cargo-Transfer (be-/entladen) dauert 2× länger | Wrack-POI |
| `black_market_hold` | Black Market Hold | Verkaufspreise an NPC-Händlern +25% | Reputations-Gewinn bei Fraktionen −50% (verdächtig) | Quest (Pirates) |

---

### DEFENSE — Found (nur Zusatz-Slots)

| ID | Name | Stärke | Drawback | Quelle |
|----|------|--------|----------|--------|
| `null_field` | Null Field | Immun gegen EMP-Effekte, +50% ecmReduction | Eigene EMP-Waffen deaktiviert solange Modul aktiv | Ancient-Ruine |
| `bleed_emitter` | Bleed Emitter | Pirate-Gegner erhalten −20% ATK durch Interferenz | −50 commRange (stört eigene Kommunikation) | Wrack-POI |
| `terror_array` | Terror Array | 30% Chance: Gegner flieht ohne Kampf (Einschüchterung) | Kein Effekt gegen Ancient/K'thari-Gegner, +15% Piraten-Spawn-Chance im Sektor | Quest (K'thari Ehrenkampf) |

---

### SPECIAL — Found (nur Zusatz-Slots)

| ID | Name | ACEP-Pfad | Stärke | Drawback | Quelle |
|----|------|----------|--------|----------|--------|
| `memory_core` | Memory Core | INTEL | Sektor-Staleness-Timer 3× länger, Autopilot optimiert Routen durch bekannte Sektoren | Schiff kann keine neuen Quadranten betreten bis Modul entfernt wird (zu ängstlich) | Wrack-POI |
| `ancient_seed` | Ancient Seed | EXPLORER | Ancient-Ruinen spawnen mit 5% Chance in zuletzt besuchten Sektoren nach (Terraforming) | −20% Mining-Rate (Schiff "schützt" Ressourcen) | Ancient-Ruine (sehr selten) |
| `echo_chamber` | Echo Chamber | INTEL + KAMPF | Schiff-Persönlichkeitsmeldungen enthalten gelegentlich echte taktische Hinweise (Gegner-Schwäche) | Meldungen werden häufiger und intensiver — nicht abschaltbar | Quest (Mirror Minds / Helion) |
| `pirate_transponder` | Pirate Transponder | KAMPF | Piraten greifen Spieler nie zuerst an (gilt als einer von ihnen) | Alle anderen Fraktionen −30 Reputation sofort, Händler verweigern Handel | Pirate-Boss-Loot (sehr selten) |

---

## Offene Punkte

- [ ] AUSBAU Level-Schwellwerte für Zusatz-Slot-Freischaltung (z.B. Level 2 = +1 Slot, Level 4 = +2, Level 6 = +3)
- [ ] Konkrete XP-Schwellwerte pro Level (1–5) — abhängig von Spieltempo-Messung
- [ ] DB-Schema: `module_source VARCHAR` → `'standard'|'found'|'researched'`; `module_drawbacks JSONB` für aktive Penalties
- [ ] UI: Found-Module mit amber/gold Rahmen · Researched mit blauem Rahmen · Standard grün
- [ ] Drawback-Implementierung: welche sind passive Stats (einfach), welche brauchen Laufzeit-Logik (komplex)?
