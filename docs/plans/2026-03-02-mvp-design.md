# VOID SECTOR — MVP Design

**Datum:** 2026-03-02
**Status:** Genehmigt

## 1. Vision & Scope

Ein 2D Space-Exploration Idle MMO mit retro CRT-Terminal-Ästhetik. Die Oberfläche ist eine **virtuelle Hardware-Konsole** — jedes UI-Element wirkt wie Teil eines analogen Hochleistungsrechners aus den 80er Jahren, komplett mit physischen Bezels, Toggle-Switches und LEDs. Amber-Monochrom (#FFB000 auf #050505). Mobile-First.

### MVP Core Loop

Erkunden und Entdecken: Spieler bewegen sich Sektor für Sektor durch ein unendliches 2D-Koordinatensystem. Jede Aktion kostet Action Points (AP), die sich idle über Zeit regenerieren. Entdeckte Sektoren bleiben persistent. Andere Spieler sind sichtbar.

### MVP Features

1. Auth (Username + Passwort)
2. Radar-Map im Terminal-Stil
3. Sektor-Sprung (kostet AP)
4. AP-System (Verbrauch + zeitbasierte Regeneration)
5. Prozedurale Weltgenerierung (Seed-basiert, persistent)
6. Multiplayer-Presence (andere Spieler im Sektor sehen)

### Explizit NICHT im MVP

- Kein Mining/Abbau
- Kein Handel/Markt
- Keine Fraktionen
- Keine Aliens/Quests
- Kein Kampf
- Keine Schiffzerstörung/Rettung

## 2. Tech-Stack

| Komponente | Technologie | Begründung |
|---|---|---|
| Game Server | Colyseus | Room-Abstraktion, State-Sync, Clustering-ready |
| Frontend | React + Canvas | Terminal-UI flexibel gestaltbar, kein Game-Engine-Overhead |
| Datenbank | PostgreSQL | Persistenz für Spieler, Sektoren, Entdeckungen |
| Cache/Ticks | Redis | AP-Regeneration, Sessions, Colyseus Presence |
| Shared Types | TypeScript Package | Geteilte Interfaces zwischen Client und Server |

### Warum kein Phaser/PixiJS?

Für die Terminal/Radar-Ästhetik reicht HTML5 Canvas mit direkten Draw-Calls. Eine Game-Engine wäre Overhead ohne Mehrwert.

### Warum kein Serverless/Blockchain?

- Blockchain: Latenz ungeeignet für Echtzeit-Gameloop, zu komplex fürs MVP
- Serverless: WebSocket-Management problematisch, Cold Starts, teure Ticks
- Zentraler Server: Einfach, schnell, ~5€/Monat, skaliert für hunderte Spieler

## 3. Architektur

```
┌─────────────────────┐         ┌──────────────────────────┐
│   React SPA         │  WS     │   Colyseus Game Server   │
│   + Canvas Radar    │◄───────►│                          │
│                     │         │  SectorRoom (pro Sektor) │
│  Terminal-UI        │         │  LobbyRoom (global)      │
│  AP-Display         │         │  GameEngine Service      │
│  Koordinaten-Nav    │         │                          │
└─────────────────────┘         └──────────┬───────────────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                         PostgreSQL     Redis         Redis
                         (Persistenz)  (AP/Ticks)   (Presence)
```

### Colyseus Rooms

**SectorRoom** (`sector:x:y`):
- Ein Room pro besuchtem Sektor
- State: Spieler im Sektor, Sektor-Daten, Anomalien
- On-demand erstellt, disposed wenn letzter Spieler leavet
- Sektor-Daten werden aus PostgreSQL geladen / generiert

**LobbyRoom** (global):
- Jeder eingeloggte Spieler
- Online-Count, globale Announcements

### Sektor-Sprung Ablauf

1. Client sendet `jump(targetX, targetY)` an aktuellen SectorRoom
2. Server validiert: genug AP? Ziel in Reichweite?
3. AP abziehen, in Redis speichern
4. Spieler aus aktuellem SectorRoom entfernen
5. Ziel-Sektor aus DB laden oder prozedural generieren + speichern
6. Spieler joint neuen SectorRoom
7. Client bekommt neuen Sektor-State + Radar-Update

### AP-Regeneration (Lazy Evaluation)

Kein serverseitiger Tick-Loop. Stattdessen:
- Redis speichert `{current, max, lastTick, regenRate}` pro Spieler
- Bei jeder Aktion: vergangene Zeit berechnen, AP addieren, dann Kosten abziehen
- Client zeigt interpolierte AP-Anzeige

## 4. Datenmodell

### PostgreSQL

**players**
```sql
id            UUID PRIMARY KEY
username      VARCHAR UNIQUE
password_hash VARCHAR
created_at    TIMESTAMP
home_base     JSONB DEFAULT '{"x":0,"y":0}'
xp            INTEGER DEFAULT 0
level         INTEGER DEFAULT 1
```

**ships** (Referenz: AEGIS Scout Mk I als Startschiff)
```sql
id            UUID PRIMARY KEY
owner_id      UUID REFERENCES players(id)
ship_class    VARCHAR DEFAULT 'aegis_scout_mk1'
fuel          INTEGER DEFAULT 100         -- Treibstoff (separat von AP)
fuel_max      INTEGER DEFAULT 100
jump_range    INTEGER DEFAULT 4           -- Max Sektoren pro Sprung
ap_cost_jump  INTEGER DEFAULT 1           -- AP-Kosten pro Sprung
cargo_cap     INTEGER DEFAULT 5           -- Laderaum-Einheiten
scanner_level INTEGER DEFAULT 1           -- Scanner-Stufe
safe_slots    INTEGER DEFAULT 1           -- Rettungskapsel-Slots
active        BOOLEAN DEFAULT TRUE        -- Aktuell genutztes Schiff
```

**sectors**
```sql
x             INTEGER
y             INTEGER
PRIMARY KEY   (x, y)
type          VARCHAR  -- empty|nebula|asteroid_field|station|anomaly|pirate
seed          INTEGER
discovered_by UUID REFERENCES players
discovered_at TIMESTAMP
metadata      JSONB
```

**player_discoveries**
```sql
player_id     UUID REFERENCES players
sector_x      INTEGER
sector_y      INTEGER
PRIMARY KEY   (player_id, sector_x, sector_y)
discovered_at TIMESTAMP
```

### Redis

```
player:ap:{id}      → HASH {current, max, lastTick, regenPerSecond}
player:pos:{id}     → HASH {x, y}
player:fuel:{id}    → HASH {current, max}
player:session:{id} → STRING (Colyseus sessionId)
```

### Schiffsklassen (Referenz aus Grafik-Material)

| Klasse | Jump Range | AP/Sprung | Cargo | Scanner | Besonderheit |
|---|---|---|---|---|---|
| AEGIS Scout Mk I | 4 Sektoren | 1 AP | 5 Units | Basic | Startschiff, Mining Laser Mount |
| VOID SEEKER Mk II "HELIOS" | 12 Sektoren | 2 AP | 25 Units | Omni-Spectral | Adaptive Shield, Dual Plasma Laser |

### Prozedurale Weltgenerierung

Seed-basiert: `seed = hash(x, y, worldSeed)`. Deterministisch — gleiche Koordinaten = gleicher Sektor.

Typ-Verteilung:
- 60% empty
- 15% asteroid_field
- 10% nebula
- 10% anomaly
- 5% station

## 5. UI Design — Hardware-Konsolen-Metapher

### Design-Philosophie

Die UI ist eine **virtuelle Hardware-Konsole**, kein klassisches Spielmenü. Jedes Element wirkt wie Teil eines analogen CRT-Monitors aus den 80ern:
- **Amber-Monochrom:** #FFB000 auf #050505
- **CRT-Effekte:** Scanlines, Bildschirmkrümmung (Vignette), Phosphor-Nachleuchten, subtiles Flimmern
- **Hardware-Rahmen:** Jeder Monitor hat einen industriellen Metall-Bezel mit physischen Toggle-Switches und glühenden LEDs
- **Audio (post-MVP):** Taktile Klick-Geräusche, Monitor-Summen, Rauschen beim Frequenzwechsel

### Multi-Monitor-System

Jeder Screen ist ein separater "CRT-Monitor":

| Monitor-ID | Name | MVP? | Hauptinhalt |
|---|---|---|---|
| **NAV-COM** | Navigation | Ja | 2D-Grid, Sektoren, Fog of War |
| **SHIP-SYS** | Raumschiff | Ja (basic) | Schiff-Status, Fuel, AP |
| **BASE-LINK** | Home-Base | Nein | Gebäude, Produktion |
| **MKT-NET** | Marktplatz | Nein | Handel, Orders |
| **COMM-DL** | Fraktion/Aliens | Nein | Chat, Quests, Reputation |

**Mobile:** Ein Monitor = ein Screen. Navigation über Hardware-Leiste am unteren Rand.
**Desktop (post-MVP):** Side-by-side Multi-Monitor-Array, konfigurierbare Anordnung.

### NAV-COM Screen (MVP-Hauptansicht)

Referenz: `planung/Inhalte/raumschiffsteuerung.jpg`

```
┌─── CRT BEZEL ──────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │  VOID SECTOR                                │ │
│ │  SYSTEM PREVIEW: NAV-COM                    │ │
│ │                                             │ │
│ │  [142/-98] [142/-98] [142/-98] [142/-98]    │ │
│ │  UNEXPLORED  FOG OF WAR                    │ │
│ │                                             │ │
│ │  [142/-98] [146/-98]  ⛏IRON  [142/-98]     │ │
│ │                        ▲                    │ │
│ │  [142/-98]  ⛏IRON   [■ HOME]  [142/-98]    │ │
│ │                       BASE                  │ │
│ │  [142/-98] [142/-98] [142/-98]  ☠PIRATE    │ │
│ │                                 SECTOR      │ │
│ │  [142/-98] [142/-98] [142/-98] [142/-98]    │ │
│ │                                             │ │
│ │ ─────────────────────────────────────────── │ │
│ │  AP: 48/100   FUEL: 75%   SAFE SLOTS: 1/3  │ │
│ │  ████████░░   ███████░░░                    │ │
│ │ ─────────────────────────────────────────── │ │
│ │  [SCAN]  [MOVE]  [MINE]  [MARKET]          │ │
│ └─────────────────────────────────────────────┘ │
│  ○ SYS STATUS    ○ NAV_SYS          [ON/OFF] ● │
└─────────────────────────────────────────────────┘
```

### SHIP-SYS Screen (MVP-Minimal)

Referenz: `planung/Inhalte/startschiff.jpg`

```
┌─── CRT BEZEL ──────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │  VOID SCOUT MK. I "AEGIS"                  │ │
│ │                                             │ │
│ │  [Wireframe-Schematik des Schiffs]          │ │
│ │                                             │ │
│ │  ION DRIVE X2 ──── [RANGE: 4 SECTORS]      │ │
│ │  CARGO HOLD ────── [CAP: 5 UNITS]          │ │
│ │  SCANNER ARRAY ─── [WEAR: LOW]             │ │
│ │  MINING LASER ──── [UPGRADE: 0]            │ │
│ │  CREW CABIN ────── [CAP: 2]                │ │
│ │                                             │ │
│ │ ─────────────────────────────────────────── │ │
│ │  SYSTEMS: ONLINE   FUEL: 100%              │ │
│ │  AP COST/SPRUNG: 1  WEAPONS: OFFLINE       │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### UI-Komponenten Stil-Guide

| Element | Stil |
|---|---|
| **Buttons** | Rechteckig, `[BRACKETED]`, invertieren bei Klick (Amber BG, schwarzer Text) |
| **Fortschrittsbalken** | Segmentiert: `[████████░░░░]` |
| **Text** | Monospace Pixel-Font, UPPERCASE für Labels |
| **Modale/Warnungen** | `WARNING: FUEL LOW` mit Rahmen und Blink-Animation |
| **Callouts** | Dünne Leader-Lines zu technischen Beschriftungen |
| **Grid-Zellen** | Zeigen Koordinaten `[x/y]`, Icons für Sektor-Typ |
| **Fog of War** | Ausgegraute Koordinaten, kein Inhalt sichtbar |

### Farbschema
- **Hintergrund:** #050505
- **Primär:** Amber #FFB000
- **Dim:** rgba(255, 176, 0, 0.4)
- **Danger/Warning:** #FF3333
- **CRT-Effekte:** Scanlines, Phosphor-Glow, Vignette, subtiles Flimmern
- **Bezel:** Dunkles industrielles Metall (#1a1a1a - #2a2a2a)

### Interaktion
- **[MOVE]** oder Tap auf Sektor = Sprung-Bestätigung (kostet AP + Fuel)
- **[SCAN]** = Umliegende Sektoren aufdecken (kostet AP)
- **Monitor-Wechsel:** Hardware-Buttons am Bezel-Rand (Mobile: Tab-Leiste unten)
- **Event-Log:** Unterer Bereich zeigt Aktions-Feedback

### Art-Asset Master-Prompt (für konsistente Grafik-Generierung)

> "A technical 2D vector schematic of [OBJEKT] for a retro-futuristic space game. The image is displayed on a vintage, curved monochrome CRT monitor with a deep amber glow on a black background. Style: Low-Fi Sci-Fi, 1980s computer terminal aesthetic. Features: sharp amber wireframe lines, monospaced pixel fonts, technical callouts with thin leader lines, visible scanlines, subtle digital noise, and a slight flickering glow. The monitor is encased in a dark, industrial metal bezel with physical toggle switches and glowing LEDs on the side. UI elements like 'SYSTEMS: ONLINE' and 'AP COST' are visible at the bottom. No 3D shading, purely flat 2D vector blueprint style."

## 6. Projekt-Struktur

```
void-sector/
├── packages/
│   ├── client/           # React + Canvas SPA
│   │   └── src/
│   │       ├── components/    # React UI
│   │       ├── canvas/        # Radar-Rendering
│   │       ├── network/       # Colyseus Client
│   │       ├── state/         # Client State (Zustand)
│   │       └── styles/        # CRT Theme
│   ├── server/           # Colyseus Game Server
│   │   └── src/
│   │       ├── rooms/         # SectorRoom, LobbyRoom
│   │       ├── engine/        # AP, Weltgenerierung
│   │       ├── db/            # PostgreSQL Queries
│   │       └── schema/        # Colyseus State Schemas
│   └── shared/           # Geteilte Typen & Konstanten
│       └── src/
│           ├── types.ts
│           └── constants.ts
├── package.json          # Workspace Root
└── docker-compose.yml    # PostgreSQL + Redis (dev)
```

## 7. Error Handling

- **Disconnect:** Colyseus Reconnection (bis 15s), Spieler bleibt im Room
- **Ungültige Aktionen:** Server validiert, Fehlermeldung im Log
- **DB-Fehler:** Retry-Logik, Sektor-Generierung ist idempotent
- **Race Conditions:** Colyseus Rooms sind single-threaded per Room

## 8. Testing (MVP)

- Unit Tests: AP-Berechnung, Sektor-Generierung (deterministische Seeds)
- Integration Tests: Room join/leave, Sprung-Validierung
- Kein E2E — manuelles Testen bei diesem Scope
