# Points of Interest — JumpGates (Erweiterung)

**Stand:** 2026-03-04
**Branch:** `claude/poi-design-documents-DHxCE`
**Bezug:** POI-System — JumpGates (AlienTech & Spieler-gebaut)
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick

Das bestehende JumpGate-System (`bidirectional` / `wormhole`) wird zu einem vollständigen
Reise-Netzwerk erweitert. Zwei neue Typen kommen hinzu:

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                   JUMPGATE-TYPEN                                ║
  ║                                                                  ║
  ║  ⊕  ALIEN JUMPGATE           ⊗  SPIELER JUMPGATE                ║
  ║  ──────────────────────────  ──────────────────────────────     ║
  ║  Quelle:  Welt-Generierung   Quelle:  Spieler baut              ║
  ║  Typ:     AlienTech          Typ:     Human-Tech                 ║
  ║  Distanz: 50–50.000 Sekt.   Distanz: 100–? Sektoren            ║
  ║  Upgrades: Erforschung       Upgrades: Bau + Forschung          ║
  ║  Access:   Code/Minigame     Access:   Offen / Passcode         ║
  ║  Richtung: Bidirektional     Richtung: Bidirektional            ║
  ║                                                                  ║
  ║  Bestehend:                                                      ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  bidirectional  Normales Gate (50–10.000)   Zufällig platziert  ║
  ║  wormhole       Einbahnstrasse (zufällig)   Siehe Wormhole-Dok  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 2. Alien JumpGate (`jumpgate_alien`)

### 2.1 Beschreibung

Massige, geometrisch perfekte Tore aus Alien-Metall. Viel größer als Spieler-Gates.
Funktionieren noch nach Jahrtausenden. Können erforscht und "kalibriert" werden.

```
  ╔══ ALIEN JUMPGATE — VISUAL ══════════════════════════════════════╗
  ║                                                                  ║
  ║        ████████████████████████                                 ║
  ║       ██◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈██                                ║
  ║      ██◈◈◈                ◈◈◈██     ⊕  ALIEN JUMPGATE          ║
  ║      ██◈◈  ┌────────────┐  ◈◈██     Zustand: AKTIV             ║
  ║      ██◈◈  │ ≈≈≈≈≈≈≈≈≈≈ │  ◈◈██     Ziel: [2A4F:1B93]         ║
  ║      ██◈◈  │ ≈≈ PORTAL ≈│  ◈◈██     Distanz: 8.234 Sekt.      ║
  ║      ██◈◈  └────────────┘  ◈◈██     Zugang: MINIGAME           ║
  ║      ██◈◈◈                ◈◈◈██     Erforschung: 0/3 Stufen    ║
  ║       ██◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈◈██                                ║
  ║        ████████████████████████                                 ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 2.2 Unterschiede zum bestehenden JumpGate

| Eigenschaft           | Bestehendes Gate        | Alien JumpGate              |
|-----------------------|-------------------------|-----------------------------|
| Spawn-Methode         | `hashCoords` (2%)       | `hashCoords` (0.08%)        |
| Max. Distanz          | 10.000 Sektoren         | 50.000 Sektoren             |
| Access                | Code oder Minigame      | Immer Minigame (Alien-Tech) |
| Fuel-Kosten           | 1 Fuel                  | 2 Fuel (stärker)            |
| Erforschbar           | Nein                    | Ja (3 Stufen)               |
| Upgrade möglich       | Nein                    | Ja (durch Erforschung)      |
| Animation             | Standard Gate           | Erweiterte Animation        |
| Radar-Symbol          | `[G]`                   | `⊕` (Violett/Orange)        |

### 2.3 Erforschungs-Stufen

| Stufe | Bedingung                           | Effekt                                     | Reward              |
|-------|-------------------------------------|--------------------------------------------|---------------------|
| 1     | Minigame ≥ 85%                      | Ziel-Koordinaten sichtbar                  | +200 XP             |
| 2     | Stufe 1 + nochmaliger Besuch 24h+   | Minigame-Schwelle sinkt auf 75%           | +500 XP, Artefakt   |
| 3     | Stufe 2 + Ancient-Rep ≥ 20          | Gate "kalibriert": +10.000 Sektoren Bonus | +1000 XP, Bauplan   |

Erforschung ist **spieler-individuell** — jeder Spieler muss selbst forschen.

### 2.4 Frequenz-Minigame (Erweiterung)

Das bestehende Frequenz-Minigame wird für Alien JumpGates erweitert:

```
  ╔══ ALIEN JUMPGATE — FREQUENZ-KALIBRIERUNG ═══════════════════════╗
  ║                                                                  ║
  ║  ALIEN RESONANZ-MUSTER — SYNCHRONISIERUNG                       ║
  ║  Zeit: 45 Sekunden (länger als normales Gate)                   ║
  ║                                                                  ║
  ║  Kanal A:  ─╱╲──╱╲╱──╱╱╲──╱╲╱╱──╲─  [Alien-Frequenz]         ║
  ║  Kanal B:  ──────╱╲──────╱╲──────  [Alien-Rhythmus]           ║
  ║                                                                  ║
  ║  Dein Signal:  ─────── [←  ─── →] ───────                     ║
  ║                Amplitude: 85%  Phase: +3Hz                      ║
  ║                                                                  ║
  ║  Kanal A Match:  █████████░  82%                                ║
  ║  Kanal B Match:  ██████████  91%                                ║
  ║  Gesamt:         █████████░  87%  ←── Schwelle: 85%            ║
  ║                                                                  ║
  ║  ≥85% für 5s → PORTAL ÖFFNET SICH                              ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Alien-Gate: Zwei Kanäle** statt einem (höhere Schwierigkeit).
Mit Stufe-2-Erforschung sinkt die Schwelle auf 75% (einkanalig).

---

## 3. Spieler JumpGate (`jumpgate_player`)

### 3.1 Konzept

Spieler können eigene JumpGates bauen und dauerhaft mit einem anderen Gate verlinken.
Das Ziel-Gate wird über **Koordinateneingabe** festgelegt. Beide Gates müssen existieren.

```
  ╔══ SPIELER JUMPGATE — VISUAL ════════════════════════════════════╗
  ║                                                                  ║
  ║         ████████████████                                        ║
  ║        ██▓▓▓▓▓▓▓▓▓▓▓▓▓▓██                                      ║
  ║       ██▓▓  ┌────────┐  ▓▓██     ⊗  SPIELER JUMPGATE           ║
  ║       ██▓▓  │≈≈≈≈≈≈≈≈│  ▓▓██     Besitzer: APEX_CORP           ║
  ║       ██▓▓  └────────┘  ▓▓██     Ziel: [0F2A:00B1]             ║
  ║       ██▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓██     Distanz: 1.234 Sektoren        ║
  ║        ████████████████          Stufe: 2                       ║
  ║                                  Zugang: OFFEN                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 3.2 Bau-Voraussetzungen

Spieler-JumpGates bauen setzt das bestehende Bau-System voraus:

```typescript
// Neue Structure-Type
export type StructureType =
  | 'comm_relay' | 'mining_station' | 'base' | 'storage' | 'trading_post'
  | 'jumpgate';  // NEU

// Baukosten
const JUMPGATE_BUILD_COST: ResourceCost = {
  ore:     200,
  gas:     100,
  crystal: 150,
  credits: 5000,
};

const JUMPGATE_BUILD_AP = 50;  // Sehr hoher AP-Aufwand

// Relay-Reichweite (für Kommunikation)
const JUMPGATE_RELAY_RANGE = 2000;  // Sektoren
```

### 3.3 Verbindungs-System

Nach dem Bau muss das Gate mit einem Ziel verbunden werden:

```
  ╔══ JUMPGATE — VERBINDUNG EINRICHTEN ═════════════════════════════╗
  ║                                                                  ║
  ║  DEIN JUMPGATE — VERBINDUNG KONFIGURIEREN                       ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Ziel-Koordinaten eingeben:                                      ║
  ║  X: [    1234    ]  Y: [    5678    ]                            ║
  ║                                                                  ║
  ║  [PRÜFEN]                                                        ║
  ║                                                                  ║
  ║  Prüfung: ■ Koordinaten gültig                                  ║
  ║           ■ Ziel-Gate existiert: SPIELER-GATE (BETA_STATION)    ║
  ║           ■ Distanz: 1.234 Sektoren  ✓ (Max: 2.000)            ║
  ║           ■ Ziel-Gate hat freien Eingang: JA                    ║
  ║           ■ Ziel-Spieler stimmt zu: AUSSTEHEND...               ║
  ║                                                                  ║
  ║  [VERBINDUNG ANFORDERN] [ABBRECHEN]                              ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Verbindungsregeln:**

1. **Ziel-Gate muss existieren** — Koordinaten werden geprüft, ob ein Gate vorhanden ist
2. **Distanz-Limit** — Abhängig von Stufe (Start: 2.000 Sektoren)
3. **Gegenseitige Verbindung** — Beide Gates zeigen aufeinander (bidirektional)
4. **Ziel-Besitzer-Zustimmung** — Ziel-Gate-Besitzer muss Verbindung akzeptieren
5. **Ein Gate — eine Verbindung** — Gate kann nur mit einem anderen Gate verbunden sein
6. **Verbindung trennbar** — Besitzer kann Verbindung jederzeit kappen

### 3.4 Ziel-Besitzer-Zustimmung

```
  ╔══ JUMPGATE VERBINDUNGSANFRAGE ══════════════════════════════════╗
  ║                                                                  ║
  ║  SYSTEM-NACHRICHT                                                ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Spieler NOVA_CORP möchte sein JumpGate bei [1234:5678]         ║
  ║  mit deinem JumpGate bei [0F2A:00B1] verbinden.                 ║
  ║                                                                  ║
  ║  Distanz: 1.234 Sektoren                                        ║
  ║  Ihr Gate bleibt DEIN Eigentum — du kannst die Verbindung       ║
  ║  jederzeit trennen.                                              ║
  ║                                                                  ║
  ║  [AKZEPTIEREN] [ABLEHNEN]                                        ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 3.5 Zugangs-Kontrolle

Gate-Besitzer kann den Zugang konfigurieren:

| Modus          | Beschreibung                                             |
|----------------|----------------------------------------------------------|
| `open`         | Jeder kann benutzen (Standard)                           |
| `faction_only` | Nur Fraktion-Mitglieder können benutzen                  |
| `whitelist`    | Nur bestimmte Spieler (Whitelist-System)                 |
| `passcode`     | Passcode erforderlich (Besitzer gibt Codes weiter)       |
| `toll`         | Nutzung kostet Credits (Besitzer erhält Einnahmen)       |

**Toll-System:**

```
  ╔══ JUMPGATE MAUT ════════════════════════════════════════════════╗
  ║                                                                  ║
  ║  ⊗ JUMPGATE [0F2A:00B1]  →  [1234:5678]                        ║
  ║  Besitzer: APEX_CORP                                             ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  MAUT: 50 Credits pro Durchflug                                  ║
  ║  Dein Guthaben: 4.200 Credits                                    ║
  ║                                                                  ║
  ║  [BEZAHLEN & SPRINGEN] [ABBRECHEN]                               ║
  ╚══════════════════════════════════════════════════════════════════╝
```

Maut geht direkt an den Gate-Besitzer. Besitzer sieht Einnahmen-Übersicht.

### 3.6 Upgrade-System

Spieler-Gates können durch Forschung verbessert werden:

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║            JUMPGATE UPGRADE-BAUM                                ║
  ║                                                                  ║
  ║  STUFE 1 (Standard)         Stufe 2 (1.000 Credits + 50 Crystal)║
  ║  ──────────────────         ─────────────────────────────────── ║
  ║  Max. Distanz: 2.000        Max. Distanz: 5.000 Sektoren        ║
  ║  Fuel-Kosten: 2             Fuel-Kosten: 1.5                    ║
  ║  Stabilität: 80%            Stabilität: 90%                     ║
  ║  Modus: Open/Passcode       Modus: + Faction/Whitelist/Toll     ║
  ║                                                                  ║
  ║  STUFE 3 (5.000 Cr + Ancient-Rep ≥ 20 + Alien-Bauplan)         ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  Max. Distanz: 15.000 Sektoren                                   ║
  ║  Fuel-Kosten: 1                                                  ║
  ║  Stabilität: 98%                                                 ║
  ║  Bonus: +1 Slot (kann 2 Verbindungen halten — A↔B, A↔C)       ║
  ║                                                                  ║
  ║  STUFE 4 (20.000 Cr + navigation_crystal Artefakt)              ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  Max. Distanz: 50.000 Sektoren (Alien-Gate-Niveau)              ║
  ║  Fuel-Kosten: 1                                                  ║
  ║  Stabilität: 99%                                                 ║
  ║  Bonus: Quantensprung (kein Fuel-Verbrauch alle 10 Durchflüge)  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Upgrade-Voraussetzungen:**

| Stufe | Credits | Ressourcen           | Sondervoraussetzung               |
|-------|---------|----------------------|-----------------------------------|
| 1→2   | 1.000   | 50 Ore + 30 Crystal  | —                                 |
| 2→3   | 5.000   | 100 Crystal + 50 Gas | Ancient-Rep ≥ 20 + Alien-Bauplan  |
| 3→4   | 20.000  | 200 Crystal          | `navigation_crystal`-Artefakt     |

### 3.7 Stabilität

JumpGates haben eine Stabilität (80–99%). Bei instabilen Durchflügen:

| Stabilität | Risiko                                       |
|------------|----------------------------------------------|
| < 70%      | 5% Chance: Ziel-Sektor falsch (±5 Sektoren) |
| < 80%      | 1% Chance: Fuel-Verlust +2 extra            |
| 80–95%     | Stabil, kein Risiko                          |
| ≥ 95%      | Quantum-stabil: kosmetischer Bonus-Effekt   |

---

## 4. JumpGate-Durchflug-Animation

Alle JumpGate-Typen haben eine Durchflug-Animation ähnlich einem Sektor-Wechsel,
aber mit visuell unterschiedlichem Style:

```
  ╔══ JUMPGATE — ANIMATIONS-KONZEPT ════════════════════════════════╗
  ║                                                                  ║
  ║  PHASE 1: EINFLUG (0.5s)                                        ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  Normaler Radar blendet aus (Fade to Black)                     ║
  ║  CRT-Scan-Linien verstärken sich                                ║
  ║  Ton: Frequenz-Anstieg                                          ║
  ║                                                                  ║
  ║  PHASE 2: TUNNEL (1.0s)                                         ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  Hyperraum-Tunnel: konzentrische Kreise (Canvas)                ║
  ║  Spieler-Gate: Amber-Farbige Kreise                             ║
  ║  Alien-Gate:   Violette + orange Spirale (schneller)            ║
  ║  Wormhole:     Cyan-Grüne Störung, flackernde Kreise            ║
  ║  Text: "HYPERSPRUNG AKTIV... [ZIEL: X:Y]"                       ║
  ║                                                                  ║
  ║  PHASE 3: ANKUNFT (0.5s)                                        ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  Radar blendet ein (Fade from Black)                            ║
  ║  Position: Ziel-Sektor                                          ║
  ║  Text: "HYPERSPRUNG ABGESCHLOSSEN"                              ║
  ║  Fuel-Anzeige aktualisiert sich                                 ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Technisch:** 2s Client-seitige Canvas-Animation, Server-seitig sofortiger Sektor-Wechsel
(gleich wie bisher). Animation blockiert keine Server-Logik.

---

## 5. JumpGate-Netzwerk-Übersicht (Monitor)

Ein neues `GATES`-Monitor zeigt alle bekannten JumpGates:

```
  ╔══ GATES MONITOR ════════════════════════════════════════════════╗
  ║  ► BEKANNTE SPRUNGPUNKTE ◄                         [GATES]     ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  TYP  KOORDINATEN   ZIEL(E)        DIST.   ZUGANG   STATUS     ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║  ⊕    [03E8:0042]   [1A3F:5B22]   8.234   MINIGAME  AKTIV     ║
  ║  ⊗    [0F2A:00B1]   [1234:5678]   1.234   OFFEN     AKTIV     ║
  ║  ⊛    [0001:0001]   3 ZIELE        —      OFFEN     HUB       ║
  ║  ⊕    [2B4C:1D88]   UNBEKANNT     ????    MINIGAME  ERKD. 0/3 ║
  ║                                                                  ║
  ║  Bekannte Gates: 4   |   Eigene Gates: 2   |   Hubs: 1         ║
  ║                                                                  ║
  ║  [GATE ANSTEUERN] [GATE BAUEN] [HUB BAUEN] [UPGRADE]           ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 5a. JumpGate-Hub-System

### 5a.1 Konzept

Ein **JumpGate-Hub** ist ein erweitertes Spieler-JumpGate der Stufe 3+, das mit mehreren
anderen Gates gleichzeitig verbunden sein kann. Hubs sind das Rückgrat langer
Handels- und Reiserouten im Universum.

```
  ╔══ JUMPGATE-HUB — KONZEPT ═══════════════════════════════════════╗
  ║                                                                  ║
  ║         Gate A ─────────────────────────── Gate B               ║
  ║          ⊗                                    ⊗                 ║
  ║           ╲                                  ╱                  ║
  ║            ╲                                ╱                   ║
  ║             ╲   ┌──────────────────────┐   ╱                   ║
  ║              ╲  │ ⊛  HUB [0F2A:00B1]  │  ╱                    ║
  ║               ╲ │ Verbunden: A, B, C   │ ╱                     ║
  ║                ╲└──────────────────────┘╱                      ║
  ║                            │                                    ║
  ║                           ╱│╲                                   ║
  ║                          ╱ │ ╲                                  ║
  ║                        ⊗   ⊗  ⊕                                ║
  ║                     Gate C Gate D (Alien)                       ║
  ║                                                                  ║
  ║  Hub-Symbol: ⊛ (unterscheidet sich von normalem ⊗)             ║
  ║  Ein Hub kann bis zu N Gates verbinden (N = Hub-Stufe)          ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 5a.2 Hub-Stufen und Verbindungs-Kapazität

| Hub-Stufe | Max. Verbindungen | Forschungskosten              | Voraussetzung           |
|-----------|-------------------|-------------------------------|-------------------------|
| Hub-1     | 3                 | 15.000 Cr + 300 Crystal       | Gate Stufe 3 + 24h      |
| Hub-2     | 5                 | 50.000 Cr + 500 Crystal       | Hub-1 + Ancient-Rep ≥30 |
| Hub-3     | 8                 | 200.000 Cr + alien_data_core  | Hub-2 + Ancient-Rep ≥60 |

> **Hub-Forschung ist teuer** — Ressourcen-intensiv und benötigt hohe Ancient-Reputation,
> weil Hub-Technologie auf alien-inspirierten Bauplänen basiert.

### 5a.3 Hub-Bau-Voraussetzungen

```typescript
const JUMPGATE_HUB_RESEARCH_COST_TIER1 = {
  credits: 15_000,
  crystal: 300,
  ore:     150,
  gas:     100,
  ap:      100,
  requirement: { gateLevel: 3 },   // Gate muss Stufe 3 sein
};

const JUMPGATE_HUB_RESEARCH_COST_TIER2 = {
  credits: 50_000,
  crystal: 500,
  ore:     250,
  gas:     200,
  ap:      150,
  requirement: { hubLevel: 1, ancientRep: 30 },
};

const JUMPGATE_HUB_RESEARCH_COST_TIER3 = {
  credits: 200_000,
  crystal: 1_000,
  ore:     500,
  gas:     300,
  ap:      200,
  requirement: { hubLevel: 2, ancientRep: 60, artifact: 'alien_data_core' },
};
```

### 5a.4 Routen-Planung durch Hubs

Ein Hub ermöglicht es, über mehrere Gates eine **Route** zu planen.
Spieler wählen Start-Gate und Ziel — das System berechnet die kürzeste Kette:

```
  ╔══ HUB — ROUTEN-PLANUNG ═════════════════════════════════════════╗
  ║                                                                  ║
  ║  ⊛ HUB [0F2A:00B1] — VERBINDUNGEN                              ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  VERBUNDENE GATES:                                               ║
  ║  ► ⊗ Gate A [1234:5678]  — Distanz: 1.234 Sekt.  — Maut: 0 Cr  ║
  ║  ► ⊗ Gate B [8F2A:1B3C]  — Distanz: 4.500 Sekt.  — Maut: 50 Cr ║
  ║  ► ⊕ Gate C [3B4D:2E5F]  — Distanz: 8.234 Sekt.  — Maut: 0 Cr  ║
  ║    (Alien Gate — Minigame erforderlich)                          ║
  ║                                                                  ║
  ║  ROUTE ZU ZIEL [9999:8888]:                                      ║
  ║  HUB → Gate B → [weiterer Hub?] → Ziel                          ║
  ║  Gesamt-Maut: 50 Cr  |  Fuel: 3                                 ║
  ║                                                                  ║
  ║  [ROUTE STARTEN] [GATE VERBINDEN] [KONFIGURIEREN]               ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 5a.5 Hub-Einnahmen

Hub-Besitzer erhält Maut von **allen Gates**, die mit dem Hub verbunden sind,
falls Maut für die jeweiligen Gates konfiguriert ist. Einnahmen-Übersicht:

```
  ╔══ HUB — EINNAHMEN ══════════════════════════════════════════════╗
  ║  ► EINNAHMEN ÜBERSICHT — HUB [0F2A:00B1]                       ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Letzte 24h:                                                     ║
  ║  Gate A → B:  14 Durchflüge × 50 Cr  =   700 Cr               ║
  ║  Gate A → C:   3 Durchflüge × 0 Cr   =     0 Cr               ║
  ║  Gate B → A:   8 Durchflüge × 50 Cr  =   400 Cr               ║
  ║  Gate B → C:   2 Durchflüge × 50 Cr  =   100 Cr               ║
  ║  ────────────────────────────────────────────────               ║
  ║  Gesamt:       27 Durchflüge          = 1.200 Cr               ║
  ║                                                                  ║
  ║  Wartungskosten letzte 24h:           −  240 Cr               ║
  ║  Netto-Einnahmen:                     =   960 Cr               ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 5b. DetailView — JumpGate im Sektor

### 5b.1 Sektor-Betreten mit JumpGate

Wenn der Spieler einen Sektor betritt oder den Sektor scannt, in dem ein JumpGate liegt,
erscheint im **DetailPanel** ein JumpGate-Eintrag. Beim Anklicken öffnet sich
die JumpGate-Detailansicht:

```
  ╔══ DETAIL PANEL — SEKTOR [0F2A:00B1] ═══════════════════════════╗
  ║  SEKTOR-TYP: LEER                                               ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  INHALTE:                                                        ║
  ║  ► ⊛ JUMPGATE-HUB  (Spieler: APEX_CORP)     [DETAIL ÖFFNEN ▶] ║
  ║  ► ◈ NPC AUSSENPOSTEN (Händler)              [DETAIL ÖFFNEN ▶] ║
  ║                                                                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 5b.2 JumpGate DetailView — Ziele & Kosten

```
  ╔══ JUMPGATE-HUB — DETAILANSICHT ════════════════════════════════╗
  ║                                                                  ║
  ║  ⊛  HUB [0F2A:00B1]   Besitzer: APEX_CORP   Stufe: HUB-2      ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ERREICHBARE ZIELE:                                              ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ⊗  Gate NOVA-1 [1234:5678]   — DIREKT                         ║
  ║     Distanz:  1.234 Sektoren                                    ║
  ║     Maut:     0 Credits (offen)                                 ║
  ║     Fuel:     1                                                  ║
  ║     Gesamt:   0 Cr + 1 Fuel                                     ║
  ║     [SPRINGEN →]                                                 ║
  ║                                                                  ║
  ║  ⊗  Gate BETA-7 [8F2A:1B3C]   — DIREKT                         ║
  ║     Distanz:  4.500 Sektoren                                    ║
  ║     Maut:     50 Credits                                        ║
  ║     Fuel:     1                                                  ║
  ║     Gesamt:   50 Cr + 1 Fuel                                    ║
  ║     [SPRINGEN →]                                                 ║
  ║                                                                  ║
  ║  ⊗  Gate OMEGA-3 [9999:8888]  — VIA HUB (2 Sprünge)           ║
  ║     Route: HUB → BETA-7 → OMEGA-3                              ║
  ║     Maut:     50 + 30 = 80 Credits                              ║
  ║     Fuel:     2                                                  ║
  ║     Gesamt:   80 Cr + 2 Fuel                                    ║
  ║     [ROUTE STARTEN →]                                            ║
  ║                                                                  ║
  ║  Eigener Betrieb: [KONFIGURIEREN] [UPGRADE] [EINNAHMEN]        ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Route-Starten-Mechanik:**
- Bei Einzel-Sprung: Sofort (wie bisher)
- Bei Multi-Sprung-Route: Spieler bestätigt Gesamt-Kosten, dann Auto-Sequenz
  jeder Sprung wird einzeln durchgeführt (inkl. Animation), Abbruch jederzeit möglich

### 5b.3 Konfigurationsansicht (nur Besitzer)

```
  ╔══ JUMPGATE — KONFIGURATION ═════════════════════════════════════╗
  ║                                                                  ║
  ║  ⊗  GATE [0F2A:00B1]   Eigenes Gate                            ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ZUGANG:  [OFFEN ▼]                                             ║
  ║    ● Offen (alle)                                               ║
  ║    ○ Nur Fraktion                                                ║
  ║    ○ Whitelist                                                   ║
  ║    ○ Passcode                                                    ║
  ║    ○ Maut                                                        ║
  ║                                                                  ║
  ║  MAUT:    [   50  ] Credits pro Durchflug                       ║
  ║                                                                  ║
  ║  VERBUNDENES GATE: [1234:5678] — NOVA-1                        ║
  ║  [VERBINDUNG TRENNEN]                                            ║
  ║  [ANDERES GATE VERBINDEN]                                        ║
  ║                                                                  ║
  ║  [SPEICHERN]  [ABBRECHEN]                                        ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 5c. Wartungskosten (Maintenance)

### 5c.1 Konzept

JumpGates kosten Credits im Betrieb. Wartungskosten fallen **täglich** an und werden
automatisch vom Spieler-Konto abgezogen. Bei fehlendem Guthaben wird das Gate deaktiviert.

### 5c.2 Wartungskosten-Tabelle

| Gate-Typ            | Kosten/Tag | Gate deaktiviert wenn... |
|---------------------|------------|--------------------------|
| Spieler-Gate Stufe 1| 50 Cr      | Guthaben < 0             |
| Spieler-Gate Stufe 2| 120 Cr     | Guthaben < 0             |
| Spieler-Gate Stufe 3| 300 Cr     | Guthaben < 0             |
| Spieler-Gate Stufe 4| 800 Cr     | Guthaben < 0             |
| Hub Stufe 1         | 500 Cr     | Guthaben < 0             |
| Hub Stufe 2         | 1.500 Cr   | Guthaben < 0             |
| Hub Stufe 3         | 5.000 Cr   | Guthaben < 0             |

> **Alien-Gates:** Keine Wartungskosten (selbst-erhaltende Alien-Technologie).

### 5c.3 Deaktivierungs-Mechanik

```
  ╔══ GATE DEAKTIVIERT ═════════════════════════════════════════════╗
  ║                                                                  ║
  ║  ⚠  JUMPGATE [0F2A:00B1] — OFFLINE                             ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Gate deaktiviert: Keine Credits für Wartung verfügbar.         ║
  ║  Ausstehende Wartungskosten: 300 Credits                         ║
  ║                                                                  ║
  ║  [WARTUNG BEZAHLEN] → Gate reaktiviert sich sofort              ║
  ║                                                                  ║
  ║  Hinweis: Nach 7 Tagen ohne Bezahlung verliert das Gate         ║
  ║           seine Verbindung (muss neu verlinkt werden).          ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Deaktiviertes Gate:**
- Auf dem Radar als ausgegrautes ⊗ sichtbar (statt normal)
- Durchflug nicht möglich
- Verbindung bleibt erhalten für 7 Tage
- Nach 7 Tagen: Verbindung getrennt, Gate bleibt als leere Struktur

### 5c.4 Maut als Wartungs-Finanzierung

Das Maut-System ist der natürliche Weg, Wartungskosten zu decken:

| Szenario               | Durchflüge/Tag nötig (um kostendeckend zu sein) |
|------------------------|--------------------------------------------------|
| Gate Stufe 1 + 50 Cr   | 1 Durchflug/Tag                                 |
| Gate Stufe 2 + 50 Cr   | 3 Durchflüge/Tag                                |
| Gate Stufe 3 + 100 Cr  | 3 Durchflüge/Tag                                |
| Hub Stufe 1 + 50 Cr    | 10 Durchflüge/Tag (über alle Hub-Verbindungen)  |
| Hub Stufe 2 + 50 Cr    | 30 Durchflüge/Tag                               |

---

## 6. Technische Implementierung

### 6.1 Erweiterung der bestehenden DB

```sql
-- Erweiterung von jumpgates-Tabelle
ALTER TABLE jumpgates
  ADD COLUMN IF NOT EXISTS gate_subtype TEXT DEFAULT 'standard'
    CHECK (gate_subtype IN ('standard', 'alien', 'player')),
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS upgrade_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'open'
    CHECK (access_mode IN ('open', 'faction_only', 'whitelist', 'passcode', 'toll')),
  ADD COLUMN IF NOT EXISTS toll_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exploration_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stability INTEGER DEFAULT 80;

-- Verbindungsanfragen
CREATE TABLE IF NOT EXISTS jumpgate_link_requests (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  source_x     INTEGER NOT NULL,
  source_y     INTEGER NOT NULL,
  target_x     INTEGER NOT NULL,
  target_y     INTEGER NOT NULL,
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- JumpGate Maut-Einnahmen-Log
CREATE TABLE IF NOT EXISTS jumpgate_toll_log (
  id         TEXT PRIMARY KEY,
  gate_id    TEXT NOT NULL,
  payer_id   TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  paid_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Erforschungs-Fortschritt (pro Spieler)
CREATE TABLE IF NOT EXISTS jumpgate_exploration (
  player_id  TEXT NOT NULL,
  gate_id    TEXT NOT NULL,
  level      INTEGER DEFAULT 0,
  last_visit TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, gate_id)
);

-- JumpGate-Hub-Verbindungen (m:n)
CREATE TABLE IF NOT EXISTS jumpgate_hub_links (
  hub_gate_id   TEXT NOT NULL REFERENCES jumpgates(id) ON DELETE CASCADE,
  linked_gate_id TEXT NOT NULL REFERENCES jumpgates(id) ON DELETE CASCADE,
  linked_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (hub_gate_id, linked_gate_id)
);

-- Wartungskosten-Log (tägliche Abbuchung)
CREATE TABLE IF NOT EXISTS jumpgate_maintenance_log (
  id         TEXT PRIMARY KEY,
  gate_id    TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  paid_at    TIMESTAMPTZ DEFAULT NOW(),
  was_deactivated BOOLEAN DEFAULT FALSE
);

-- Gate-Status (aktiv / deaktiviert wegen fehlender Wartung)
-- Wird als Spalte in jumpgates geführt:
ALTER TABLE jumpgates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS hub_level INTEGER DEFAULT 0,  -- 0 = kein Hub
  ADD COLUMN IF NOT EXISTS deactivated_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS maintenance_debt INTEGER DEFAULT 0;
```

### 6.2 Neue Konstanten

```typescript
// Spieler-JumpGate Bau
export const JUMPGATE_BUILD_ORE     = 200;
export const JUMPGATE_BUILD_GAS     = 100;
export const JUMPGATE_BUILD_CRYSTAL = 150;
export const JUMPGATE_BUILD_CREDITS = 5000;
export const JUMPGATE_BUILD_AP      = 50;

// Distanz-Limits pro Stufe
export const JUMPGATE_MAX_RANGE_TIER: Record<number, number> = {
  1: 2_000,
  2: 5_000,
  3: 15_000,
  4: 50_000,
};

// Upgrade-Kosten
export const JUMPGATE_UPGRADE_COST: Record<number, { credits: number; ore: number; crystal: number; gas: number }> = {
  2: { credits: 1_000, ore: 50,  crystal: 30, gas: 0  },
  3: { credits: 5_000, ore: 0,   crystal: 100, gas: 50 },
  4: { credits: 20_000, ore: 0,  crystal: 200, gas: 0  },
};

// Alien JumpGate
export const JUMPGATE_ALIEN_SALT           = 999;
export const JUMPGATE_ALIEN_CHANCE         = 0.0008;
export const JUMPGATE_ALIEN_MAX_RANGE      = 50_000;
export const JUMPGATE_ALIEN_FUEL_COST      = 2;
export const JUMPGATE_ALIEN_MINIGAME_THRESHOLD = 0.85;

// Animation
export const JUMPGATE_ANIMATION_DURATION_MS = 2000;

// Hub-System
export const JUMPGATE_HUB_MAX_LINKS: Record<number, number> = {
  1: 3,
  2: 5,
  3: 8,
};

export const JUMPGATE_HUB_RESEARCH_COST: Record<number, {
  credits: number; crystal: number; ore: number; gas: number; ap: number;
}> = {
  1: { credits: 15_000, crystal: 300, ore: 150, gas: 100, ap: 100 },
  2: { credits: 50_000, crystal: 500, ore: 250, gas: 200, ap: 150 },
  3: { credits: 200_000, crystal: 1_000, ore: 500, gas: 300, ap: 200 },
};

// Wartungskosten (Credits/Tag)
export const JUMPGATE_MAINTENANCE_COST_PER_DAY: Record<string, number> = {
  'player_tier1': 50,
  'player_tier2': 120,
  'player_tier3': 300,
  'player_tier4': 800,
  'hub_tier1':    500,
  'hub_tier2':    1_500,
  'hub_tier3':    5_000,
};

// Deaktivierungs-Toleranz
export const JUMPGATE_DEACTIVATION_GRACE_DAYS = 7;  // Nach 7 Tagen ohne Zahlung: Verbindung getrennt
```

### 6.3 Neue Message-Typen

```typescript
// Spieler baut JumpGate
export interface BuildJumpGateMessage {
  sectorX: number;
  sectorY: number;
}

// Spieler verlinkt JumpGate
export interface LinkJumpGateMessage {
  sourceSectorX: number;
  sourceSectorY: number;
  targetSectorX: number;
  targetSectorY: number;
}

// Ziel-Spieler antwortet auf Verbindungsanfrage
export interface JumpGateLinkResponseMessage {
  requestId: string;
  accept: boolean;
}

// Spieler upgraded JumpGate
export interface UpgradeJumpGateMessage {
  sectorX: number;
  sectorY: number;
}

// Alien-Gate-Erforschung
export interface ExploreAlienGateMessage {
  gateId: string;
  minigameScore: number;
}

// Gate-Konfiguration ändern
export interface ConfigureJumpGateMessage {
  sectorX: number;
  sectorY: number;
  accessMode: 'open' | 'faction_only' | 'whitelist' | 'passcode' | 'toll';
  tollAmount?: number;
  passcode?: string;
}

// Hub erforschen (Stufe 1–3)
export interface ResearchJumpGateHubMessage {
  sectorX: number;
  sectorY: number;
  targetHubLevel: 1 | 2 | 3;
}

// Gate mit Hub verlinken (Hub-Besitzer verlinkt fremdes Gate nach Zustimmung)
export interface HubLinkGateMessage {
  hubSectorX: number;
  hubSectorY: number;
  targetSectorX: number;
  targetSectorY: number;
}

// Gate aus Hub entfernen
export interface HubUnlinkGateMessage {
  hubSectorX: number;
  hubSectorY: number;
  targetSectorX: number;
  targetSectorY: number;
}

// Wartung bezahlen (Gate reaktivieren)
export interface PayGateMaintenanceMessage {
  sectorX: number;
  sectorY: number;
}

// Route über mehrere Gates starten
export interface StartGateRouteMessage {
  steps: Array<{ sectorX: number; sectorY: number }>;  // Geordnete Gate-Sequenz
}

// DetailView: Gate-Info für Sektor anfordern
export interface RequestGateDetailMessage {
  sectorX: number;
  sectorY: number;
}

export interface GateDetailResultMessage {
  gateId: string;
  gateSubtype: 'standard' | 'alien' | 'player';
  hubLevel: number;
  isActive: boolean;
  ownerName?: string;
  destinations: Array<{
    targetSectorX: number;
    targetSectorY: number;
    gateLabel: string;
    distanceSectors: number;
    tollCredits: number;
    fuelCost: number;
    accessMode: string;
    requiresMinigame: boolean;
    hops: number;           // 1 = direkt, 2+ = via Hub-Route
    routeSteps?: Array<{ sectorX: number; sectorY: number }>;
  }>;
  maintenanceCostPerDay?: number;  // Nur für eigene Gates
  maintenanceDebt?: number;        // Ausstehende Schulden
}
```

---

*Dokument-Ende — voidSector POI: JumpGates (Erweiterung)*
