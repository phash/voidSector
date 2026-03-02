# VOID SECTOR — MVP Design

**Datum:** 2026-03-02
**Status:** Genehmigt

## 1. Vision & Scope

Ein 2D Space-Exploration Idle MMO mit retro CRT-Terminal-Ästhetik (Monochrome Amber/Grün). Mobile-First.

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
ship_type     VARCHAR DEFAULT 'scout'
xp            INTEGER DEFAULT 0
level         INTEGER DEFAULT 1
```

**sectors**
```sql
x             INTEGER
y             INTEGER
PRIMARY KEY   (x, y)
type          VARCHAR  -- empty|nebula|asteroid_field|station|anomaly
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
player:ap:{id}      → HASH {current, max, lastTick, regenRate}
player:pos:{id}     → HASH {x, y}
player:session:{id} → STRING (Colyseus sessionId)
```

### Prozedurale Weltgenerierung

Seed-basiert: `seed = hash(x, y, worldSeed)`. Deterministisch — gleiche Koordinaten = gleicher Sektor.

Typ-Verteilung:
- 60% empty
- 15% asteroid_field
- 10% nebula
- 10% anomaly
- 5% station

## 5. UI Design

### Screen-Layout (Mobile-First, Terminal-Ästhetik)

```
┌──────────────────────────────┐
│  VOID SECTOR       AP: 45/100│
│  ────────────────────────────│
│                              │
│     .   .   ·   .   .       │
│     .   ▓   ·   △   .       │
│     ·   ·  [■]  ·   ·       │
│     .   ·   ·   ▒   .       │
│     .   .   ·   .   .       │
│                              │
│  ────────────────────────────│
│  SECTOR: (10, -5)   NEBULA  │
│  PLAYERS: 2    SIGNALS: 3   │
│  ────────────────────────────│
│  [↑] [←] [→] [↓]   [SCAN]  │
│  ────────────────────────────│
│  > Jump to (11,-5)? [2 AP]  │
│  > Anomaly detected NE...   │
└──────────────────────────────┘
```

### Symbole
- `[■]` Eigenes Schiff
- `▓` Asteroid Field
- `▒` Nebula
- `△` Station
- `·` Entdeckter leerer Sektor
- `.` Unentdeckt (Fog of War)

### Farbschema
- Hintergrund: #0a0a0a
- Primär: Amber (#ffb000) oder Grün (#33ff33), spielerwählbar
- Dim: 40% Opacity
- Danger: #ff3333
- CRT-Effekte: Scanlines, Glow, optionales Flicker

### Interaktion
- Richtungstasten oder Tap auf Sektor = Sprung
- SCAN = Sektor-Details (kostet AP)
- Unterer Bereich = Event-Log/Console
- Swipe = Radar-View verschieben

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
