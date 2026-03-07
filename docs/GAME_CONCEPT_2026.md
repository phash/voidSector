# voidSector — Gesamt-Spiel-Konzept (März 2026)

**Status**: Basierend auf aktueller Implementierung (Master) + geplante Features (planung/)
**Zielplattformen**: Desktop (Primary) + Mobile (Secondary)
**Genre**: Multiplayer 2D Space-Exploration Idle MMO mit CRT-Terminal-Ästhetik
**Führende Dokumente**: `/docs/plans/` Dateien + neue `planung/` Verzeichnis

---

## 1. KERNVISION

### Überblick

voidSector ist ein **asynchrones Raumfahrt-Idle-MMO**, bei dem Spieler:
- Eine **riesige, prozedurale Universum** (10.000 × 10.000 Quadranten) erkunden
- **Ressourcen abbauen**, mit NPCs handeln, und Wissenschaft betreiben
- **Taktische Kämpfe** führen, **Raumschiffe kaufen/upgraden**, und **ein Handelsnetzwerk** aufbauen
- Mit anderen Spielern **interagieren** über Nachrichtengruppen, Fraktionen, und JumpGate-Netzwerke
- **Kein Zeitdruck** — alles kann in eigenem Tempo getan werden

### Technische Grundprinzipien

- **Seed-basierte Generierung**: Alle Sektoren sind deterministische, wiederholbar berechnet
- **Lazy Evaluation**: Keine Server-Tick-Loop; Aktionen berechnen den aktuellen State
- **Stateless Rooms**: Pro Quadrant ein Colyseus-Room, nicht pro Sektor
- **AP-System**: Alle Aktionen kosten Action Points, regenerieren nach Zeit
- **Quadranten-Zonierung**: 10.000 Sektoren pro Quadrant, Spieler sehen sich nur wenn im gleichen Sektor

---

## 2. UNIVERSUM & SEKTOREN (SEKTOR-TYPEN)

### Architektur

```
Universe (0..9999 × 0..9999 Quadranten)
    ↓
Quadrant (0..9999 × 0..9999 Sektoren)
    ↓
Sector (sectorX, sectorY)
    ├─ Environment (SectorEnvironment) — Physikalische Eigenschaft
    └─ Contents[] (SectorContent[]) — Bis zu 3 Features
```

### SectorEnvironment (Neue Struktur ab Issue #68)

Definiert die **Physik** und visuelle Atmosphäre:

| Typ | Beschreibung | Wirkung | Farbe |
|-----|-------------|--------|--------|
| `empty` | Leeres Weltall | Keine Effekte | Schwarz |
| `nebula` | Nebel-Wolke | -20% Scan-Reichweite | Lila/Pink |
| `black_hole` | Schwarzes Loch | **Unpassierbar**, -50% Jump-AP-Kosten, -10% Scan, visuell dunkel | Dunkelrot |

**Generierung**: Seed-basiert (via `hashCoords`), ~5% black_holes, ~12% nebulas, Rest empty.

### SectorContent (Neue Struktur ab Issue #68)

Ein Sektor kann **0–3 Contents** haben (z.B. Asteroid + Alien Outpost + JumpGate).

| Content | Häufigkeit | Beschreibung | Belohnung |
|---------|-----------|-------------|-----------|
| `asteroid` | 8% | Abbaubare Ressource (Ore/Gas/Crystal) | Ore/Gas/Crystal |
| `station` | 3% | NPC-Handelsstation oder Spieler-Base | Trade, Quests |
| `alien_outpost` | 0.5% | Alien-Ruine mit Minigame | Artefakt, Bauplan |
| `alien_ship` | 0.3% | Temporäres Alien-Raumschiff (24–72h) | Ressourcen, Artefakt |
| `npc_ship` | 1.2% | NPC-Raumschiff (Handel/Feind) | Trade, Combat |
| `wormhole` | 0.8% | Temporales Raumtor | Jump zu Random-Sektor |
| `jumpgate` | 2% | Deterministisches Jump-Gate | Jump zu Zielsektor |
| `anomaly` | 4% | Sensor-Anomalie (scannen für Belohnung) | Artefakt, Bauplan, Codes |
| `poi_signal` | 0.2% | Unbekanntes Signal (Custom POI) | Variabel |

**Spawn-Logik** (Zone-basiert):
- **Empty Zone** (Distanz > 2000 Sektoren): Nur asteroids
- **Cluster Edge**: Mischung aus asteroids, anomalies, häufige stations
- **Cluster Core** (innerste 200 Sektoren): alien_outposts, alien_ships, Premium-POIs

**Rendering im Client**:
- Asteroid-Symbol (⬢), Station-Symbol (◆), Alien (⊕), Wormhole (◉), JumpGate (⊗)
- Mehrere Contents überlagern Symbole

---

## 3. RESSOURCEN-SYSTEM (NEU: ARTEFAKTE)

### Vier Rohstoffe

| Ressource | Typ | Quellen | NPC-Handel | Bes. Slot |
|-----------|-----|---------|-----------|-----------|
| **Ore** | Häufig | Asteroids (50%), Anomalies (8%) | ✅ Kaufbar | Nein |
| **Gas** | Häufig | Asteroids (30%), Anomalies (8%) | ✅ Kaufbar | Nein |
| **Crystal** | Selten | Asteroids (15%), Anomalies (8%) | ✅ Kaufbar | Nein |
| **Artefakt** | Extrem Selten | Anomalies (8%), Pirate-Loot (3%), Quests, Ancient-Handel (15%), Wormhole (10%) | ❌ **NICHT** NPC-handelbar | **Ja** (Safe Slot) |

### Artefakt-System (Issue #68 — Ressourcen-Artefakt)

**Eigenschaften**:
- Symbol: `❋`, Farbe: `#FF6B35` (Orange)
- **Nicht stackbar** — Inventar-Slot pro Artefakt
- **Immer gerettet** — Beim Sterben im Safe-Slot erhalten
- **Spieler-Tausch** möglich (via Nachrichtengruppe/direkter Trade)
- **Primärer Zweck**: Tech-Tree Tier 2–3 Research (Blaupausen)

**Drop-Chancen**:
- Anomalie-Scan: 8%
- Pirate-Loot: 3%
- Quest-Belohnung: Zufällig
- Ancient-Faction Handel: 15%
- Wormhole-Transit: 10% (Surprise-Bonus)

**NPC Umgang**:
- NPCs **kaufen NICHT** Artefakte
- NPCs **verkaufen** Artefakte nur als Tier-2/3-Reward (z.B. bei Honored-Rang)
- Ancient-Fraktion verkauft Artefakte gegen hohe Credits (>5000 CR)

---

## 4. RAUMSCHIFF-SYSTEM (ERWEITERT)

### Hull-Typen & Freischaltung

| Hull | Level | Kosten | Base-HP | Base-Fuel | Primär-Effekt | Sekundär-Effekt |
|------|-------|--------|---------|-----------|----------------|-----------------|
| Scout | 1 | Gratis | 30 | 50 | +2 Speed | +1 Scan |
| Freighter | 3 | 500 CR | 50 | 60 | +5 Cargo | +1 Mining |
| Cruiser | 4 | 1000 CR | 70 | 55 | +2 Armor | +1 Combat |
| Explorer | 5 | 2000 CR | 40 | 80 | +3 Scan | +1 Jump |
| Battleship | 6 | 3000 CR | 100 | 45 | +3 Weapons | +2 Combat |

**Upgrade-Pools**:
- **Antrieb**: Hyperdrive MK.I–III, Void-Drive (Ancient)
- **Waffen**: Laser MK.I–III, Railgun, Missile, EMP, Point Defense, ECM
- **Schilde**: Shield MK.I–III, Regenerative Shield
- **Speicher**: Cargo MK.I–III
- **Scanner**: Scanner MK.I–III
- **Rüstung**: Armor MK.I–III

### Tech-Tree & Research (Issue #68 — Schiffsmodule-Techbaum)

**Tier 1** (Immer verfügbar):
- MK.I Module für alle Kategorien
- Keine Artefakt-Anforderung
- Blaupausen via NPC-Trade oder Levelauf

**Tier 2** (Benötigt 1 Artefakt):
- MK.II Module
- Research kostet: 1 Artefakt + 100 Credits + 5 Ore
- Blaupause-Quelle: Anomalien (8%), Alien-Outposts, Quests

**Tier 3** (Benötigt 2 Artefakte):
- MK.III Module + Spezial-Module (Void-Drive, Point Defense, ECM)
- Research kostet: 2 Artefakte + 300 Credits + 20 Crystal
- Blaupause-Quelle: Alien-Outposts (Premium), Honored-Rank Quests

**Modul-Effekte** (Primär + Sekundär):
- Laser MK.I: +1 Damage, +1% Shield-Pierce
- Railgun: +2 Damage, -1 Accuracy (vs. Movement)
- Missile: +3 Damage (low accuracy), +1 vs. Shields
- EMP: Special (disables), +1 vs. Electronics
- Hyperdrive v2: -1 AP/Jump, +1 Jump, +1 Speed (geplant)
- Void-Drive (Ancient): -2 AP/Jump, +3 Speed, +3 Fuel/Jump (Ancient-exclusive)

---

## 5. NAVIGATION & MOVEMENT

### AP-Kosten (Issue #68 — AP-Sprung-Mechanik)

**Hypersprung-Kosten (Standard)**:
```
AP-Kosten = Base-5 - (Speed-1) + Treibstoff-Faktor + Umgebungs-Malus
```

| Parameter | Wert | Anmerkung |
|-----------|------|-----------|
| Base | 5 AP | Basis-Kosten für jeden Jump |
| Speed-Reduktion | -1 AP pro Speed-Level | Speed 3 = -2 AP |
| Treibstoff-Faktor | +0.1 pro 100 Sektoren Distanz | Max ×2 (verdoppelt) bei 10K+ Distanz |
| Piraten-Malus | +50% AP in pirate_sector | Nur in Pirate-kontrollierten Sektoren |
| Black-Hole-Bonus | -50% AP (unpassierbar) | Kann nicht durchgesprungen werden! |
| Nebula-Malus | -20% Acc (nicht AP) | Nur Genauigkeit betroffen |

**Beispiele**:
- Scout (Speed 3) springt 500 Sektoren: 5 - 2 + 0.5 = **3.5 AP** ≈ 4 AP
- Battleship (Speed 1) springt 10K Sektoren: 5 - 0 + 2.0 = **7 AP**
- Pirat in Pirate-Sektor: ×1.5 AP-Kosten

### Treibstoff-System

- **Verbrauch**: 1 Fuel pro Jump (Standard)
- **Max Fuel**: Abhängig vom Hull (Scout 50, Battleship 45, etc.)
- **Betankung**: Gratis an Basis (bis 3 Schiffe), NPC-Stationen (gegen Credits)
- **Kein Fuel** = Stranded (muss Hilfe anfordern oder einen Jump-Gate nutzen)

### Navigation Features

#### Bookmarks (Implementiert)
- HOME (automatisch)
- SHIP (aktuelles Schiff-Position)
- 5 benutzerdefinierte Slots (farbcodiert)

#### Autopilot (Implementiert, erweitert geplant)
- **Persistent Routes**: 3 aktive Routen max
- **Zielsektor**: Manuell eingeben oder auf Entdeckungs-Bookmark klicken
- **Automatische Betankung**: An Basis-Stationen unterwegs
- **Black-Hole-Avoidance**: Autopilot umgeht unpassierbare black_holes

#### Far Navigation (Geplant)
- **Quadrant-Level Navigation**: Zum Erreichen von unbekannten Quadranten
- **Hypersprung Chain**: Multiple Jumps ohne manuellen Input
- **Rückseiten-Entdeckung**: Neuer Quadrant wird automatisch benannt (60-Sekunden-Fenster)

---

## 6. COMBAT-SYSTEM (v2 — Implementiert)

### 5-Runden-Taktik-Kampf

**Spieler vs. NPC**:
1. **Setup-Phase**: Spieler wählt Taktik (Assault/Balanced/Defensive)
2. **Runden 1–4**: Aktion pro Runde (Normal Attack, Special Action)
3. **Runde 5**: Final Round mit Bonusschaden (winner takes all)

**Waff-System**:
- Laser: Konstante Genauigkeit, durchschnittlich Schaden
- Railgun: Hoher Schaden, niedrige Genauigkeit
- Missile: Sehr hoher Schaden, nur vs. Großziele
- EMP: Special (disables NPC für eine Runde)

**Schilde & Rüstung**:
- Shield MK.I–III: Absorbieren erste N Schaden
- Armor MK.I–III: Reduktion von Schaden um X%
- Regenerative Shield (Special): Rückkehr von 1 Shield pro Runde

**Auto-Combat** (NPC-Umgang):
- Spieler wählt Taktik (Negotiate, Flee, Fight)
- System simuliert 5 Runden basierend auf Hull + Modul-Stats
- Belohnung: Credits, Ressourcen, oder Flucht

**Station Defense**:
- Turrets (Laser, Railgun)
- Shields (Rechnung-Style)
- Ion Cannon (Special)
- Auto-Combat vs. angreifende Spieler/NPCs

---

## 7. WIRTSCHAFTS-SYSTEM

### NPC-Handel

**Station-NPCs** (3 pro Station, nach Sektor-Typ):
- Trader (Ressourcen, Credits)
- Scientist (Research-Module, Blaupausen — für Artefakte!)
- Merchant (Schiff-Module, Upgrades)

**Dynamische Preise** (Reputation-basiert):
- Neutral (-50..+50): Basis-Preis
- Liked (+50..+100): -20% Kaufpreis, +10% Verkaufspreis
- Honored (100): Extra-Angebote (Tier-2/3 Module, Artefakte)

**Station-Level & NPC-Spawn**:
- Level 1: 2 NPCs (Trader, Merchant)
- Level 2: 3 NPCs (+ Scientist)
- Level 3: Spezialisierte NPCs, bessere Preise
- Level 4–5: Exklusives Loot (Blaupausen, Ancient-Module)

**XP-System**: +1 XP pro besuchter Station (täglich), Level steigt automatisch

### Player-to-Player Economy

**Spieler-Basen** (nicht implementiert, geplant):
- Custom Bases mit Speicher, Factory, Kontor
- Verkauf von Ressourcen/Modulen an andere Spieler
- Platzierter Loot (Artefakte?) für Freunde

**Handelsrouten** (Implementiert):
- 3 aktive Routen max
- Automatische Cargo-Transfers zwischen Stationen
- Zyklus: 15–120 Minuten
- Gewinn: 10–50 Credits pro Zyklus

### Currency & Credits

- **Credits**: Primäre Währung (verdient durch Trade, Quests, Loot)
- **Alien-Credits**: Spezielle Währung für Ancient-Faction (nicht stackbar wie Artefakte?)
- **No P2P Credit-Trade**: Nur Ressourcen/Module handelbar

---

## 8. FACTION & REPUTATION SYSTEM (Implementiert)

### 4 Fraktionen + Independent

| Fraktion | Fokus | Upgrade-Baum | Exklusiv |
|----------|-------|-------------|----------|
| Trader | Wirtschaft | Trade-Boni (+Credits, -Kosten) | Gunship (Hull special) |
| Scientist | Forschung | Research-Boni (-Artefakte, -Zeit) | Void-Drive (Speed & Fuel) |
| Pirate | Kampf | Combat-Boni (+Damage, Shield) | Korsar-Suite (Hacking-Modul) |
| Ancient | Exotisch | Tier-3-Artefakte, ancient_gates | Ancient-Module (ultra-rare) |
| Independent | Neutral | Minor-Boni | Keine Exklusiva |

### Reputations-Stufen

| Stufe | Range | Effekt | Unlock |
|-------|-------|--------|--------|
| Hated | -100..-60 | -50% Trade-Preise (böse!) | Keine |
| Disliked | -59..-20 | -20% Preise | Keine |
| Neutral | -19..+19 | Basis-Preise | Basis-Quest |
| Liked | +20..+50 | -10% Buy, +10% Sell | Mittlere Quests |
| Honored | +50..+100 | Extra-Angebote, Tier-2/3 Modules | Tier-2 Research, Ancient-Alien-Outposts |

**Verlieren von Rep**: NPC-Kampf, Pirate-Angreifer werden hated bei Trader-Faction

---

## 9. QUEST-SYSTEM (Implementiert, erweitert geplant)

### Procedural Quests (täglich)

**Typen**:
- **Fetch**: Item von Punkt A zu Punkt B bringen
- **Delivery**: NPC-Auftrag (Ressourcen liefern)
- **Scan**: Anomalie scannen und berichten
- **Bounty**: Pirate/NPC-Schiff zerstören

**Belohnungen**:
- Credits (50–500 basierend auf Schwierigkeit)
- Ressourcen (Ore, Gas, Crystal)
- Artefakte (3% Chance)
- Blaupausen (1% Chance)
- Reputation (+5..+20)

**Daily Rotation**: Quests ändern sich täglich, keine Wiederholungen

### Rettungs-Missionen (Implementiert)

- **Auslöser**: Scan-Event findet gestrandeten Überlebenden
- **Aufgabe**: Überlebenden zu Basis bringen
- **Belohnung**: +20 Reputation, +100 Credits, Artefakt (5% Chance)

### Story-Quests (Geplant)

- Multi-Step-Quests (z.B. "Ancient Mystery")
- Belohnungen: Tier-2/3-Blaupausen, Artefakte, Exklusiv-Module

---

## 10. JUMPGATE-SYSTEM (Implementiert + erweitert geplant)

### Seed-basierte Gates (2% Chance)

**Typen**:
- **Bidirectional** (60%): Beide Richtungen funktionieren
- **Wormhole** (40%): Nur Einbahnstraße

**Sicherung**:
- 50% benötigen **Access Code** (8-stellig, Spieler merkt sich)
- 30% benötigen **Frequency Minigame** (Spieler stimmt Welle ab)
- 20% Open (kein Zugang erforderlich)

**Zieldistanz**: 50–10.000 Sektoren (nicht uniform, bevorzugt kürzere)

### Player-built Gates (Geplant, aber gebaut)

**Baukosten**: 500 CR + 20 Crystal + 5 Artefakte + 10 AP

**Upgrade-System**:
- **Connection Level** (1–3): Wieviele andere Gates kann man verknüpfen?
  - Level 1: 1 Gate
  - Level 2: 2 Gates (Kosten: 300 CR + 15 Ore + 3 Artefakte)
  - Level 3: 3 Gates (Kosten: 800 CR + 30 Ore + 8 Artefakte)

- **Distance Level** (1–3): Maximale Sprung-Reichweite
  - Level 1: 250 Sektoren
  - Level 2: 500 Sektoren (Kosten: 300 CR + 15 Crystal + 3 Artefakte)
  - Level 3: 2.500 Sektoren (Kosten: 800 CR + 30 Crystal + 8 Artefakte)

**Netzwerk-Routing** (BFS-Algorithmus):
- Gates können verknüpft werden (via Data Slate)
- Automatische Bi-Direktionalität
- Max 10 Hops zur Berechnung von Zielen
- Manhattan-Distance muss ≤ kombinierte Reichweite sein

**Toll-System** (Implementiert, nicht aktiv):
- Besitzer kann Gebühr pro Jump setzen
- Spieler zahlt Toll beim Springen
- Noch nicht UI-implementiert

### Alien Gates (Geplant)

- **Separate Technologie**: Nicht von Spielern gebaut
- **Sicherung**: Spezielle Frequenz-Minigame (nicht Sinus, eher Muster-Matching?)
- **Rarity**: < 0.5% Chance (häufiger in Alien-Outposts)

---

## 11. PUNKTE-OF-INTEREST (POI) SYSTEM (Geplant — Issue #68)

### POI-Typen Übersicht

| POI | Häufigkeit | Art | Minigame | Belohnung | Dauer |
|-----|-----------|-----|----------|-----------|--------|
| Alien Outpost | 0.5% | Permanent | Dekodierung | Artefakt + Bauplan | 1 Scan-Session |
| Alien Ship | 0.3% | Temporär | Kommunikation | Ressourcen + Artefakt | 24–72h |
| Anomaly | 4% | Persistent | Scan | Artefakt (8%), Bauplan (1%), Code | 1 Scan-Session |
| NPC Ship | 1.2% | Persistent | Combat/Trade | Credits, Ressourcen | Nach Interaktion |
| Wormhole | 0.8% | Temporär | Keine | Jump zu Random-Sektor | 12–48h |
| JumpGate | 2% | Permanent | Frequency/Code | Jump zu deterministisch Zielsektor | Unbegrenzt |

### Alien Outpost (Detailed)

**Häufigkeit**: 0.5% (sehr selten)
**Spawn-Zones**: Nur in Cluster-Kern (inner 200 Sektoren von Cluster-Center)
**Zustand**:
- Dormant (68%): Inaktiv, keine Drohnen, leicht zu scannen
- Active (32%): Aktiv, Wächter-Drohnen (+Combat-Schwierigkeit), bessere Loot

**Minigame**: **Dekodierungs-Rätsel**
- Spieler sieht eine Sequenz von Symbolen (⬢, ◆, ✱, ⊕)
- Muss die nächste in der Reihe erraten (Pattern-Matching)
- 3 Versuche, höhere Reward bei schneller Lösung

**Belohnungen** (garantiert):
- Artefakt (100%)
- Bauplan (Random Tier 2/3)
- Alien-Credits (100–500)

**Loot-Table** (bei Active):
- Crystal +200 (vs. dormant +50)
- Alien-Codes für andere Gates
- Exklusiv-Module (10% Chance)

### Alien Ship (Detailed)

**Häufigkeit**: 0.3%
**Dauer**: 24–72 Stunden Despawn
**Bewegung**: Schweift durch Cluster-Zone (random walk)

**Zustand**:
- Dormant (50%): Passiv, einfacher zu andocken
- Active (50%): Aktiv, kann fliehen, Combat möglich

**Minigame**: **Kommunikations-Rätsel**
- Spieler muss auf Alien-Signale antworten (Frequenz-Matching ähnlich JumpGate, aber Muster-basiert)
- Bei Erfolg: Andockung, Ressourcen-Zugang

**Belohnungen** (bei erfolgreichem Andocken):
- Ressourcen (200 Ore + 100 Gas + 50 Crystal)
- Artefakt (3%)
- Ancient-Codes (5%)

**Combat-Belohnung** (bei Zerstörung):
- Pirate-Loot (Credits, Ressourcen)
- Aber: Reputation-Malus mit Alien-Faction

### Anomaly (Detailed)

**Häufigkeit**: 4% (relativ häufig)
**Persistenz**: Bleiben bis gescannt

**Scan-Typen**:
- **Local Scan**: Nähere Analyse
- **Area Scan**: Bereichs-Überblick (aber teuer: 10 AP, 1 Fuel)

**Belohnungen** (bei erfolgreichem Scan):
- Artefakt (8% Chance) ← **Primäre Quelle**
- Bauplan (1% Chance)
- Gate-Code (3% Chance)
- Ressourcen (immer 10–50 Ore/Gas/Crystal)

**Special-Typen** (Scan-Events):
- **Pirate Ambush**: Combat mit Piraten
- **Distress Call**: Überlebender (Rettungsmission)
- **Artifact Cache**: Extra Artefakt-Loot (5% Chance bei Active)

### Wormhole (Detailed)

**Häufigkeit**: 0.8%
**Dauer**: 12–48 Stunden (dann despawnt)

**Typen**:
- **Stable Wormhole**: Jump zu bekanntem Zielsektor (immer gleich)
- **Unstable Wormhole**: Jump zu random-Sektor (Überraschung!)
- **One-Way Wormhole**: Nur in eine Richtung begehbar

**Zielsektor** (bei Unstable):
- Kann in **beliebiges Quadrant** liegen
- Boost-Effekt: Artefakt-Chance beim Transit (+10%)

**Belohnung**: Jump-Kosten reduziert (nur 0.5 AP statt normal)

---

## 12. RADAR & NAVIGATION UI (Neu geplant — Issue #68)

### D-Pad Layout (Geplant)

```
        [▲ ZOOM-IN]

[◀ PAN-LEFT]  [◼ CENTER]  [▶ PAN-RIGHT]

        [▼ ZOOM-OUT]
```

**Buttons** (rechts neben Radar):
- D-Pad: 4 Richtungen (Zoom + Pan)
- CENTER: Reset auf Spieler
- POWER: Radar an/aus
- CHANNEL: Scroll durch Radar-Modi (World, Cluster, Local)

### Player-Icons im Radar

**Rendering** (bei Zoom ≥ 2):
- **Farbe**: Gelb (#FFDD22)
- **Form**: Δ-Symbol (Dreieck)
- **Label**: Username unter Icon (bei Zoom ≥ 3)

**Kontakt-Alert**:
- Log-Eintrag: "KONTAKT: [Username] betritt Sektor"
- Audio-Signal (optional, wenn Sound-Feature kommt)

### Resource-Bars

**Verschiebung** zur linken Kante (aus Cockpit-Layout):
- **Ore** (oben)
- **Gas** (Mitte)
- **Crystal** (unten)
- **Artefakte** (spezieller Slot neben Fuel)

### Logbuch & Statistiken (Persistente Sammlung)

**Stat-Kategorien**:
- Sektoren gescannt (Total)
- Stationen besucht
- Quadranten entdeckt
- Fraktionen: Honors erreicht
- Kämpfe gewonnen
- Andere Piloten getroffen (nur Anzahl, keine Namen)
- Artefakte gefunden
- Blaupausen entdeckt

---

## 13. CHAT & KOMMUNIKATION (Implementiert)

### Multi-Channel Messaging

**Kanäle**:
- **Local**: Nur Spieler im gleichen Sektor
- **Quadrant**: Alle im gleichen Quadrant
- **Faction**: Alle in der gleichen Fraktion
- **Direct**: Privat mit anderem Spieler
- **Broadcast** (Admin): Globale Nachricht von Admins

**Features**:
- Nachrichten bleiben 24h (dann gelöscht)
- Blockieren möglich
- Spamschutz (max 5 Nachrichten/Minute)

---

## 14. IMPLEMENTATION-STATUS & ROADMAP

### Phase 1 (DONE — Master Branch)

✅ Kern-Engine, Cockpit-Layout, 10 Domain Services
✅ Combat v2, Tech-Tree, NPC-Ecosystem, JumpGates
✅ Fuel-System, Autopilot, Rettungsmissionen, Quadranten
✅ Admin-Konsole, E2E-Tests, Code-Refactoring

### Phase 2 (IN PROGRESS — Planned, nicht gestartet)

🔄 **POI-System**: Alien Outposts, Anomalies, Wormholes
🔄 **Artefakt-Integration**: Drop-Chancen, Research-Gates, Safe-Slot
🔄 **Sektor-Umgebung & Contents**: Black-Holes, Mehrfach-Contents
🔄 **Nav-UI Polish**: D-Pad, Player-Icons, Stats
🔄 **Sprachstandardisierung**: Deutsche oder Englische UI? (OFFENE FRAGE)

### Phase 3 (PLANNED)

⏳ **Alien-Gates-Extended**: Muster-Minigame, Rare-Drops
⏳ **Player-Basen**: Bau-System, Custom Bases mit Speicher
⏳ **FEATURE_HYPERDRIVE_V2**: Auflade-System (Design ausstehend)
⏳ **WorldService Split**: Micro-Services für Bookmarks, Slates, etc.

---

## 15. OFFENE FRAGEN & GAPS

### Design-Entscheidungen (Klärung benötigt)

| Frage | Status | Impact | Option A | Option B |
|-------|--------|--------|----------|----------|
| **Sprache** | ❌ OFFEN | Hoch | Nur Deutsch | Englisch (international) |
| **Artefakt NPC-Verkauf** | ❌ OFFEN | Mittel | Ancient-Faction (15% zu CR) | Scientist-NPC (vs. Artefakt) |
| **Player-Basen** | ❌ OFFEN | Hoch | Phase 3 Feature | Starten in Phase 2 |
| **FEATURE_HYPERDRIVE_V2** | ❌ OFFEN | Mittel | Auflade-Mechanik | Energy-Regeneration |
| **Alien-Minigame** | ❌ OFFEN | Mittel | Muster-Matching | Rhythmus-Basiert |
| **Safe-Slot Expandable** | ❌ OFFEN | Niedrig | Fixed 1 Slot | +1 per Module-Level |

### Code-Lücken (Tech-Debt)

| Lücke | Priorität | Lösung |
|-------|-----------|--------|
| `fuelPerJump` Hardcoded (1) | Niedrig | Hull-Config pro Typ implementieren |
| `safeSlots` Hardcoded (1) | Niedrig | Module-System erweitern (+safe-slots Property) |
| WorldService zu groß (892 Z.) | Mittel | Aufteilen in 4 Services |
| Spawn-Cluster Origin-Nähe | Niedrig | Guard-Clause bei 10K+ Distanz (nur Cluster-Edge) |
| Structure UNIQUE-Fehler | Niedrig | DB-Error zu Clean Message konvertieren |
| Frequency-Minigame Mobile | Mittel | Touch-Events implementieren |

### Balancing-Issues (aus Kompendium)

| Issue | Auswirkung | Fix-Richtung |
|-------|-----------|-------------|
| Void-Drive zu mächtig | Ancient-Spieler überpowered | Treibstoff-Kosten erhöhen oder Speed-Boni senken |
| Kristall-Produktion zu niedrig | Tech-Tree bottleneck | Anomaly-Drops erhöhen (8% → 12%) |
| Pirate-Level früh zu hoch | Neue Spieler verlieren | Starting-Zone (0–500 Sektoren) Pirate-frei machen |
| Station-XP zu niedrig | Progression langsam | 2 XP/Stunde (statt 1) oder Bonus-Events |

---

## 16. TECHNISCHE ARCHITEKTUR (BESTÄTIGT)

### Stack

- **Backend**: Node.js + Colyseus (1 Room pro Quadrant)
- **Database**: PostgreSQL (30+ Migrations)
- **Cache**: Redis (AP State, Fuel, Position)
- **Frontend**: React + Zustand + Canvas (Radar)
- **Deployment**: Docker Compose, Cloudflare Tunnel (Quick Tunnel)

### Testing

- **Unit Tests**: 1.216 (Server 620 + Client 405 + Shared 191)
- **E2E Tests**: 54 Playwright Specs
- **Coverage**: ~75% (Target: >80%)

### Performance

- **Latency**: < 100ms (lokale Tests)
- **Quadrant Room**: Max 100 Spieler (nicht getestet)
- **DB Queries**: < 50ms (mit Indexes)

---

## 17. NEXT STEPS (PRIORISIERT)

### Woche 1–2 (Phase 2 Kickoff)

1. **Klärung** offener Design-Fragen (Sprache, Artefakt-NPC-Handel, Safe-Slot)
2. **POI-Konstanten** zu shared/constants.ts hinzufügen
3. **Artefakt-System**: Redis-Tracking, Drop-Chancen implementieren
4. **Migration 031**: Sektor-Environment + SectorContent-Array Schema

### Woche 3–4

5. **Alien-Outpost-Generator**: Seed-basierte Generierung
6. **Dekodierungs-Minigame**: Canvas-UI implementieren
7. **Nav-UI D-Pad**: Neues Layout + Player-Icon-Rendering
8. **Tests** für POI-System (Unit + E2E)

### Woche 5+

9. **Wormhole & Anomaly-Full-Impl**: Drop-Chancen, Special-Events
10. **Sprachstandardisierung**: UI-Strings unified (DE oder EN)
11. **WorldService Split**: Refactor für bessere Wartbarkeit
12. **FEATURE_HYPERDRIVE_V2**: Design-Clarification + Implementierung

---

## ZUSAMMENFASSUNG

**voidSector ist ein mature, gut-architektiertes Space-Exploration-Spiel** mit:
- ✅ Stabiler Kern-Engine (1.216 Tests, 0 Fehler)
- ✅ Rich Content (Combat, Tech-Tree, NPCs, JumpGates)
- ✅ Klare Roadmap (POI-System, Artefakte, UI-Polish)

**Die nächsten Phasen** konzentrieren sich auf:
- 🔄 **Komplexere POI-Interaktionen** (Minigames, Minigames, Minigames!)
- 🔄 **Artefakt-Balance**: Integration in Research & Trade
- 🔄 **Multi-Sector-Exploration**: Alien-Zonen, Wormholes
- 🔄 **UI/UX-Verbesserungen**: Radar-Polish, Mobile-Support

**Kritische offene Fragen** müssen vor Phase-2-Start geklärt werden:
- Sprachstandardisierung
- Artefakt-NPC-Handelsmechanik
- Player-Base-Timing

Dieses Konzept-Dokument sollte als **Master-Referenz** für alle zukünftigen Features dienen.

---

**Dokument Kontrolle:**
Erstellt: März 2026
Zuletzt aktualisiert: März 6, 2026
Autor: Design Review (Lead-Dokumente: `/docs/plans/` + `/planung/`)
Status: **GÜLTIG FÜR IMPLEMENTATION**
