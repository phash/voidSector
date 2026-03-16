# Tech Tree V2 — Vollständige Referenz

**Stand:** 2026-03-16
**Basis:** Techs.ods + modules_voud.drawio.xml
**Status:** Entwurf — zur Abnahme

---

## Aufbau

Der Tech-Tree besteht aus **10 unabhängigen Branches** — keine gemeinsame Wurzel. Jeder Branch steht für sich allein und kann unabhängig erforscht werden.

### Pattern pro Branch

```
[Modul Mk1] ──→ [Modul Mk2] ──→ [Modul Mk3] ──→ ...    ← Horizontaler Hauptpfad (Module, kaufbar/herstellbar)
     ↓                ↓                ↓
  [Forschung A]    [Forschung B]    [Forschung C]          ← Vertikale Forschungsknoten (Boni, kosten Wissen)
                       ↓
                    [Forschung D]                           ← Forschungsketten (manche Forschungen bauen aufeinander auf)
```

- **Hauptpfad** (horizontal): Module werden freigeschaltet → können gekauft/hergestellt werden
- **Forschungsknoten** (vertikal): Passive Boni, kosten Wissen, kein physisches Modul
- **Found-Only**: Nicht im Baum, können nur im Weltraum gefunden werden (markiert mit 🔴)

### Kosten

- **Module freischalten**: Vorheriges Modul im Pfad erforscht + Wissen-Kosten
- **Forschungsknoten**: 10 Wissen (initial, wird später balanciert)
- **Module kaufen**: Credits + Ressourcen (siehe Techs.ods für exakte Werte)

---

## Branch 1: ENGINES — "That's what moves you"

```
Ion Drive Mk1 [T1] ──→ Ion Drive Mk2 [T2] ──→ Ion Drive Mk3 [T3] ──→ Proto AM Drive [T4] ──→ AM Drive Mk1 [T5] ──→ AM Drive Mk2 [T6]
     ↓                       ↓                       ↓                       ↓                       ↓
  Jump Enhancer            Jump Speed               Efficiency              Recharge Enhancer       Improbability Jump ──→ Probability Jump
                                                                               ↓                       ↓                       ↓
                                                                            OverCharge              Rescue System           Precaution System
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Ion Drive Mk1 | Modul | 1 | JumpDist 32, Recharge 4/s, +2000 Fuel, 10 Fuel/Sektor, 200ms/Sektor |
| Ion Drive Mk2 | Modul | 2 | JumpDist 48, Recharge 6/s, +4000 Fuel, 20 Fuel/Sektor, 160ms/Sektor |
| Ion Drive Mk3 | Modul | 3 | JumpDist 64, Recharge 8/s, +8000 Fuel, 20 Fuel/Sektor, 120ms/Sektor |
| Proto AM Drive Mk1 | Modul | 4 | JumpDist 100, Recharge 6/s, +2000 Fuel, 60 Fuel/Sektor, 80ms/Sektor |
| AM Drive Mk1 | Modul | 5 | JumpDist 150, Recharge 12/s, +12000 Fuel, 60 Fuel/Sektor, 200ms/Sektor |
| AM Drive Mk2 | Modul | 6 | JumpDist 250, Recharge 16/s, +20000 Fuel, 120 Fuel/Sektor, 200ms/Sektor |
| Jump Enhancer | Forschung | — | +20% Jump-Distanz |
| Jump Speed | Forschung | — | -20% ms pro Sektor |
| Efficiency | Forschung | — | -20% Fuel-Verbrauch pro Sektor |
| Recharge Enhancer | Forschung | — | +50% Hyperdrive Recharge-Rate |
| OverCharge | Forschung | — | Einmal-Boost: doppelte Recharge für 60s, danach 30s Cooldown |
| Improbability Jump | Forschung | — | Chance auf Zufalls-Teleport bei Hyperjump (5%, bringt +500 Wissen) |
| Probability Jump | Forschung | — | Improbability Jump wird steuerbar (Ziel wählbar) |
| Rescue System | Forschung | — | +1 Safe-Slot für Überlebende |
| Precaution System | Forschung | — | -30% Fuel-Verlust bei Notlandung |

**Found-Only:**

| Modul | Tier | Fundort | Effekt |
|-------|------|---------|--------|
| 🔴 Rift-Drive | 5 | Quadrant >300 vom Zentrum | JumpDist 400, Recharge 24/s, +2000 Fuel, 10 Fuel/Sektor |
| 🔴 Void-Drive | 6 | Alien-Quadranten | JumpDist 1200, Recharge 24/s, +2000 Fuel, 10 Fuel/Sektor |

---

## Branch 2: GENERATORS — "That's what powers you"

```
Fusion Cell Mk1 [T1] ──→ Fusion Cell Mk2 [T2] ──→ Fusion Cell Mk3 [T3] ──→ Fusion Cell Mk4 [T4] ──→ AM Generator [T5] ──→ AM Generator Mk2 [T6]
     ↓                         ↓                         ↓                         ↓                       ↓
  Capacity Enhancer          Refuel                    Efficiency                Refuel Enhancer         Energy Shield ──→ Explosion Dampener
                                                                                   ↓                       ↓                    ↓
                                                                                OverCharge              Rescue System        Precaution System
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Fusion Cell Mk1 | Modul | 1 | 4 AP/s, 100 Energy/Tick (vorinstalliert) |
| Fusion Cell Mk2 | Modul | 2 | 6 AP/s, 150 Energy/Tick |
| Fusion Cell Mk3 | Modul | 3 | 8 AP/s, 200 Energy/Tick |
| Fusion Cell Mk4 | Modul | 4 | 10 AP/s, 250 Energy/Tick |
| AM Generator | Modul | 5 | 12 AP/s, 500 Energy/Tick |
| AM Generator Mk2 | Modul | 6 | 14 AP/s, 750 Energy/Tick |
| Capacity Enhancer | Forschung | — | +20% max Energy-Kapazität |
| Refuel | Forschung | — | -20% Tankkosten an Stationen |
| Efficiency | Forschung | — | -15% Energy-Verbrauch aller Module |
| Refuel Enhancer | Forschung | — | Auto-Refuel bei Station (kein manuelles Tanken nötig) |
| OverCharge | Forschung | — | Einmal-Boost: +100% Energy für 30s, danach 60s kein Regen |
| Energy Shield | Forschung | — | Energy kann als Notfall-Schild verwendet werden (1 Energy = 1 Shield) |
| Explosion Dampener | Forschung | — | -25% Splash-Schaden von Missiles |
| Rescue System | Forschung | — | +1 Safe-Slot für Überlebende |
| Precaution System | Forschung | — | Bei Schiffszerstörung: 50% Chance 1 Modul zu retten |

**Found-Only:**

| Modul | Tier | Fundort | Effekt |
|-------|------|---------|--------|
| 🔴 String Generator | 5 | Quadrant >300 vom Zentrum | 20 AP/s, 1000 Energy/Tick |
| 🔴 Void Generator | 6 | Alien-Quadranten | 40 AP/s, 1500 Energy/Tick |

---

## Branch 3: MINING — "That's what fills your cargo"

```
Mining Laser Mk1 [T1] ──→ Mining Laser Mk2 [T2] ──→ Mining Laser Mk3 [T3] ──→ Mining Laser Mk4 [T4] ──→ Mining Laser Mk5 [T5]
     ↓                          ↓                          ↓                          ↓
  Yield Enhancer              Deep Core Drill            Ore Refinery               Multi-Spectrum Mining
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Mining Laser Mk1 | Modul | 1 | Mining Speed 1u/s |
| Mining Laser Mk2 | Modul | 2 | Mining Speed 4u/s |
| Mining Laser Mk3 | Modul | 3 | Mining Speed 10u/s |
| Mining Laser Mk4 | Modul | 4 | Mining Speed 25u/s |
| Mining Laser Mk5 | Modul | 5 | Mining Speed 50u/s |
| Yield Enhancer | Forschung | — | +20% Ausbeute pro Mining-Zyklus |
| Deep Core Drill | Forschung | — | +30% Bonus auf Gas und Crystal in Nebula/Asteroid-Sektoren |
| Ore Refinery | Forschung | — | -10% Ressourcenverlust beim Verkauf (bessere Reinheit) |
| Multi-Spectrum Mining | Forschung | — | Kann 2 Ressourcentypen gleichzeitig abbauen |

---

## Branch 4: CARGO — "That's what holds your stuff"

```
Cargo Bay Mk1 [T1] ──→ Cargo Bay Mk2 [T2] ──→ Cargo Bay Mk3 [T3] ──→ Cargo Bay Mk4 [T4] ──→ Cargo Bay Mk5 [T5]
     ↓                       ↓                       ↓                       ↓
  Stack Compression        Hazmat Container         Sorting System          Void Storage
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Cargo Bay Mk1 | Modul | 1 | Frachtraum +25 |
| Cargo Bay Mk2 | Modul | 2 | Frachtraum +50 |
| Cargo Bay Mk3 | Modul | 3 | Frachtraum +100 |
| Cargo Bay Mk4 | Modul | 4 | Frachtraum +175 |
| Cargo Bay Mk5 | Modul | 5 | Frachtraum +250 |
| Stack Compression | Forschung | — | +10% Frachtraum-Kapazität |
| Hazmat Container | Forschung | — | +2 Artefakt-Slots |
| Sorting System | Forschung | — | -20% Handelszeit an Stationen |
| Void Storage | Forschung | — | +50% Frachtraum-Kapazität (nur mit T5 Cargo) |

---

## Branch 5: SCANNER — "That's what reveals the unknown"

```
Scanner Mk1 [T1] ──→ Scanner Mk2 [T2] ──→ Scanner Mk3 [T3] ──→ Scanner Mk4 [T4] ──→ Scanner Mk5 [T5]
     ↓                     ↓                     ↓                     ↓
  Signal Filter          Deep Scan              Anomaly Detector      Wissen Amplifier
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Scanner Mk1 | Modul | 1 | Scan Range 3 [Unique] |
| Scanner Mk2 | Modul | 2 | Scan Range 6 [Unique] |
| Scanner Mk3 | Modul | 3 | Scan Range 9 [Unique] |
| Scanner Mk4 | Modul | 4 | Scan Range 12 [Unique] |
| Scanner Mk5 | Modul | 5 | Scan Range 18 [Unique] |
| Signal Filter | Forschung | — | +1 Scan-Radius bei Local Scan |
| Deep Scan | Forschung | — | Zeigt Ressourcen-Qualität (hoch/mittel/niedrig) im Scan-Ergebnis |
| Anomaly Detector | Forschung | — | Zeigt Anomalien und Hidden Signatures im Area-Scan |
| Wissen Amplifier | Forschung | — | +50% Wissen pro Scan |

**Found-Only:**

| Modul | Tier | Fundort | Effekt |
|-------|------|---------|--------|
| 🔴 Quantum Scanner | 5 | Alien-Quadranten | Scan Range 36 [Unique] |

---

## Branch 6: REPAIR — "That's what keeps you alive"

```
Repair Drone Mk1 [T1] ──→ Repair Drone Mk2 [T2] ──→ Repair Drone Mk3 [T3] ──→ Repair Drone Mk4 [T4] ──→ Nano Bots Mk1 [T5]
     ↓                           ↓                           ↓                          ↓
  Emergency Patch              Hull Reinforcement           Auto-Repair                Battle Medic
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Repair Drone Mk1 | Modul | 1 | Reparatur 2 HP/Runde |
| Repair Drone Mk2 | Modul | 2 | Reparatur 4 HP/Runde |
| Repair Drone Mk3 | Modul | 3 | Reparatur 8 HP/Runde |
| Repair Drone Mk4 | Modul | 4 | Reparatur 12 HP/Runde |
| Nano Bots Mk1 | Modul | 5 | Reparatur 16 HP/Runde |
| Emergency Patch | Forschung | — | Einmal-Reparatur: +50 HP sofort (Cooldown 5min) |
| Hull Reinforcement | Forschung | — | +10% max HP für alle Module |
| Auto-Repair | Forschung | — | Passive Regen: 1 HP/Tick außerhalb von Kampf |
| Battle Medic | Forschung | — | Reparatur-Drohne kann auch im Kampf reparieren |

**Found-Only:**

| Modul | Tier | Fundort | Effekt |
|-------|------|---------|--------|
| 🔴 Nano Bots Mk2 | 5 | Alien-Quadranten | Reparatur 24 HP/Runde |

---

## Branch 7: ARMOR — "That's what takes the hits"

```
Armor Plating Mk1 [T1] ──→ Armor Plating Mk2 [T2] ──→ Armor Plating Mk3 [T3] ──→ Armor Plating Mk4 [T4] ──→ Armor Plating Mk5 [T5]
     ↓                            ↓                            ↓                            ↓
  Ablative Coating             Reactive Armor                Hull Integrity               Kinetic Dampener
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Armor Plating Mk1 | Modul | 1 | +200 HP |
| Armor Plating Mk2 | Modul | 2 | +300 HP, +10% Shield Bonus |
| Armor Plating Mk3 | Modul | 3 | +400 HP |
| Armor Plating Mk4 | Modul | 4 | +600 HP, +20% Shield Bonus |
| Armor Plating Mk5 | Modul | 5 | +800 HP, +20% Shield Bonus |
| Ablative Coating | Forschung | — | +5% generelle Schadensreduktion |
| Reactive Armor | Forschung | — | Reflektiert 10% des eingehenden Schadens |
| Hull Integrity | Forschung | — | +20% Strukturpunkte (Basis-HP des Schiffs) |
| Kinetic Dampener | Forschung | — | -25% Schaden durch Kinetic-Waffen (Railguns) |

**Found-Only:**

| Modul | Tier | Fundort | Effekt |
|-------|------|---------|--------|
| 🔴 Nano Armor | 3 | Hergestellt (teuer) | +1000 HP, -35% Schadensreduktion nach Shield |
| 🔴 Living Hull | 4 | Quadrant >300 vom Zentrum | +1500 HP, -4 AP/s (lebt, braucht Energie) |
| 🔴 Salvage Skin | 3 | Alien-Quadranten | +2500 HP |

---

## Branch 8: SHIELDS — "That's what deflects energy"

```
Schild-Gen Mk1 [T1] ──→ Schild-Gen Mk2 [T2] ──→ Schild-Gen Mk3 [T3] ──→ AM Shield Mk1 [T4] ──→ AM Shield Mk2 [T5]
     ↓                         ↓                         ↓                       ↓
  Quick Charge               Adaptive Frequency         Shield Harmonics        Overload Burst
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Schild-Gen Mk1 | Modul | 1 | Schild +100, Regen +3 |
| Schild-Gen Mk2 | Modul | 2 | Schild +200, Regen +6 |
| Schild-Gen Mk3 | Modul | 3 | Schild +400, Regen +12 |
| AM Shield Mk1 | Modul | 4 | Schild +800, Regen +12, DMG Reduction -10% |
| AM Shield Mk2 | Modul | 5 | Schild +1000, Regen +12, DMG Reduction -10% |
| Quick Charge | Forschung | — | +50% Schild-Regen-Speed |
| Adaptive Frequency | Forschung | — | -15% Schaden durch Energy-Waffen (Laser) |
| Shield Harmonics | Forschung | — | +20% Schild-Kapazität |
| Overload Burst | Forschung | — | Einmal-Skill: Schild → Schaden (1:1, Schild wird aufgebraucht) |

---

## Branch 9: WEAPONS — "That's what deals the damage"

Drei separate Sub-Branches:

### 9a: ENERGY WEAPONS — Puls-Laser

```
Puls-Laser Mk1 [T1] ──→ Puls-Laser Mk2 [T2] ──→ Puls-Laser Mk3 [T3] ──→ Puls-Laser Mk4 [T4] ──→ Puls-Laser Mk5 [T5]
     ↓                        ↓                        ↓
  Beam Focus                Overcharge Lens           Rapid Fire

  EMP-Emitter [T2] (eigener Einstieg, keine Voraussetzung)
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Puls-Laser Mk1 | Modul | 1 | ATK +8 |
| Puls-Laser Mk2 | Modul | 2 | ATK +16 |
| Puls-Laser Mk3 | Modul | 3 | ATK +28 |
| Puls-Laser Mk4 | Modul | 4 | ATK +45 |
| Puls-Laser Mk5 | Modul | 5 | ATK +70 |
| EMP-Emitter | Modul | 2 | ATK +0, Disabling-Effekt (deaktiviert 1 Gegner-Modul) |
| Beam Focus | Forschung | — | +10% Accuracy für Energy-Waffen |
| Overcharge Lens | Forschung | — | +20% DMG, +10 Energy-Kosten pro Schuss |
| Rapid Fire | Forschung | — | 2 Hits pro Runde (halber Schaden pro Hit) |

**Found-Only:**

| Modul | Tier | Fundort | Effekt |
|-------|------|---------|--------|
| 🔴 Ancient Lance | 5 | Quadrant >300 | ATK +45, Piercing 40%, Cooldown-Effekt |
| 🔴 Void Ripper | 4 | Alien-Quadranten | ATK +35, Recoil-Schaden (10% Selbstschaden) |
| 🔴 Leech Cannon | 3 | Alien-Quadranten | ATK +20, kein Shield-Schaden (direkt auf Hull) |
| 🔴 Scrambler | 2 | Alien-Quadranten | ATK +5, Disable Special (deaktiviert aktive Fähigkeit) |

### 9b: KINETIC WEAPONS — Rail-Kanone

```
Rail-Kanone Mk1 [T1] ──→ Rail-Kanone Mk2 [T2] ──→ Rail-Kanone Mk3 [T3]
     ↓                          ↓
  Piercing Rounds             Armor Shredder
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Rail-Kanone Mk1 | Modul | 1 | ATK +12, Piercing 30% |
| Rail-Kanone Mk2 | Modul | 2 | ATK +22, Piercing 50% |
| Rail-Kanone Mk3 | Modul | 3 | ATK +35, Piercing 65% |
| Piercing Rounds | Forschung | — | +10% Piercing für alle Kinetic-Waffen |
| Armor Shredder | Forschung | — | Trifft: reduziert Ziel-Armor um 20% für 3 Runden |

### 9c: MISSILE WEAPONS — Raketen-Pod

```
Raketen-Pod Mk1 [T1] ──→ Raketen-Pod Mk2 [T2] ──→ Raketen-Pod Mk3 [T3]
     ↓                          ↓
  Tracking Enhancement        Cluster Warhead
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| Raketen-Pod Mk1 | Modul | 1 | ATK +18 |
| Raketen-Pod Mk2 | Modul | 2 | ATK +30 |
| Raketen-Pod Mk3 | Modul | 3 | ATK +45 |
| Tracking Enhancement | Forschung | — | +20% Trefferchance vs ECM |
| Cluster Warhead | Forschung | — | Splash-Schaden: trifft auch ein zufälliges Nebenmodul |

---

## Branch 10: DEFENSE — "That's what keeps missiles away"

Zwei separate Sub-Branches:

### 10a: PUNKT-VERTEIDIGUNG

```
Punkt-Verteidigung Mk2 [T2] ──→ PV Mk3 [T3] ──→ PV Mk4 [T4]
     ↓                                ↓
  Flak Field                        Missile Jammer
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| PV Mk2 | Modul | 2 | Missile-Abwehr +30%, -8 AP/s |
| PV Mk3 | Modul | 3 | Missile-Abwehr +30%, -10 AP/s |
| PV Mk4 | Modul | 4 | Missile-Abwehr +30%, -12 AP/s |
| Flak Field | Forschung | — | +15% Missile-Abwehrchance |
| Missile Jammer | Forschung | — | 50% Chance: eingehende Missile verfehlt komplett |

### 10b: ECM — Electronic Counter Measures

```
ECM Suite 1 [T2] ──→ ECM Suite 2 [T3] ──→ ECM Suite 3 [T4]
     ↓                     ↓
  Ghost Signal            Sensor Overload
```

| Knoten | Typ | Tier | Effekt |
|--------|-----|------|--------|
| ECM Suite 1 | Modul | 2 | Gegner-Accuracy -15%, -8 AP/s |
| ECM Suite 2 | Modul | 3 | Gegner-Accuracy -15%, -10 AP/s |
| ECM Suite 3 | Modul | 4 | Gegner-Accuracy -15%, -12 AP/s |
| Ghost Signal | Forschung | — | +10% Dodge-Chance |
| Sensor Overload | Forschung | — | Einmal-Skill: Gegner verliert 1 Kampfrunde |

---

## Statistik

| Kategorie | Module | Forschungen | Found-Only |
|-----------|--------|-------------|------------|
| Engines | 6 | 9 | 2 |
| Generators | 6 | 9 | 2 |
| Mining | 5 | 4 | 0 |
| Cargo | 5 | 4 | 0 |
| Scanner | 5 | 4 | 1 |
| Repair | 5 | 4 | 1 |
| Armor | 5 | 4 | 3 |
| Shields | 5 | 4 | 0 |
| Weapons (3x) | 12 | 6 | 4 |
| Defense (2x) | 6 | 4 | 0 |
| **Gesamt** | **60** | **52** | **13** |

---

## Mechanik-Trennung: Exploration vs. Kampf

| Wert | Exploration | Kampf |
|------|-------------|-------|
| AP-Kosten | ✅ Bewegung, Scan, Mining | — |
| Energy-Kosten | — | ✅ Waffen, Schilde, Systeme |
| Hitpoints | — | ✅ Modulzerstörung, Schiffsschaden |
| Fuel | ✅ Hyperjump, Sektorbewegung | — |
| Wissen | ✅ Forschung freischalten | — |
| Credits | ✅ Module kaufen | — |
| Piercing % | — | ✅ Ignoriert Armor-Anteil |
| Accuracy | — | ✅ Trefferchance |
