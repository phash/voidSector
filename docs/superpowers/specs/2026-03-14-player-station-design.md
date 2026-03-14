# Player-Station Grundsystem

**Datum:** 2026-03-14
**Status:** Approved
**Issue:** #403 (Teil 1 von 4)

## Zusammenfassung

Eine universelle `player_station` ersetzt die alten Strukturtypen (`mining_station`, `trading_post`, `research_lab`). Jeder Spieler kann max 1 Station pro Quadrant bauen, in `empty`-Sektoren. Stationen haben ein Level (1-5) und zwei ausbaubare Module: FACTORY und CARGO.

## Aktueller Zustand

- `player_structures` Tabelle mit Typen `mining_station`, `trading_post`, `research_lab`
- Bau ueber `handleBuild` in WorldService mit `validateBuild`
- Strukturen haben kein Level-System
- Keine Station-Module

## Datenmodell

### Neue Tabelle `player_stations`

```sql
CREATE TABLE player_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  factory_level INTEGER NOT NULL DEFAULT 0 CHECK (factory_level BETWEEN 0 AND 5),
  cargo_level INTEGER NOT NULL DEFAULT 0 CHECK (cargo_level BETWEEN 0 AND 5),
  cargo_contents JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sector_x, sector_y),
  UNIQUE(owner_id, quadrant_x, quadrant_y)
);
CREATE INDEX idx_player_stations_owner ON player_stations(owner_id);
CREATE INDEX idx_player_stations_sector ON player_stations(sector_x, sector_y);
```

**Constraints:**
- `factory_level <= level` (enforced in application code)
- `cargo_level <= level` (enforced in application code)
- 1 Station pro Spieler pro Quadrant (UNIQUE constraint)
- 1 Station pro Sektor (UNIQUE constraint)

## Baukosten

### Station bauen und upgraden

| Aktion | Credits | Crystal | Artefakt |
|--------|---------|---------|----------|
| Station bauen (Lv1) | 500 | 5 | 1 |
| Upgrade Lv2 | 1000 | 10 | 2 |
| Upgrade Lv3 | 2000 | 20 | 4 |
| Upgrade Lv4 | 4000 | 40 | 8 |
| Upgrade Lv5 | 8000 | 80 | 16 |

Formel: `credits = 500 * 2^(level-1)`, `crystal = 5 * 2^(level-1)`, `artefact = 2^(level-1)`

### Module upgraden (Factory / Cargo)

Nur Credits: `200 * targetLevel^2`

| Zielstufe | Credits |
|-----------|---------|
| 1 | 200 |
| 2 | 800 |
| 3 | 1800 |
| 4 | 3200 |
| 5 | 5000 |

Module koennen nicht hoeher als das Station-Level sein.

## Interaktion

### Bauen (physisch vor Ort)
- Spieler muss im Sektor sein
- Sektor muss `empty` sein
- Spieler darf noch keine Station in diesem Quadranten haben
- Kosten werden abgezogen (Credits, Crystal, Artefakt aus Cargo)
- Station erscheint sofort (kein Bauzeitraum)

### Upgraden (physisch vor Ort)
- Spieler muss im Sektor der Station sein
- Station-Level oder Modul-Level erhoehen
- Modul-Level darf Station-Level nicht ueberschreiten

### Remote-Zugriff
- Produktions-Queue einsehen und steuern (FABRIK-Programm, Dropdown waehlt Station)
- Lager-Inhalt einsehen
- Kein Remote-Bauen oder -Upgraden

## Migration

### Alte Strukturen entfernen
- `mining_station`, `trading_post`, `research_lab` aus `player_structures` entfernen
- Bestehende Strukturen in `player_stations` Lv1 konvertieren (Migration)
- `STRUCTURE_COSTS` und `validateBuild` fuer alte Typen entfernen
- Build-UI fuer alte Typen entfernen

## Shared Constants

```typescript
export const STATION_BUILD_COSTS = {
  1: { credits: 500, crystal: 5, artefact: 1 },
  2: { credits: 1000, crystal: 10, artefact: 2 },
  3: { credits: 2000, crystal: 20, artefact: 4 },
  4: { credits: 4000, crystal: 40, artefact: 8 },
  5: { credits: 8000, crystal: 80, artefact: 16 },
} as const;

export const STATION_MODULE_UPGRADE_COST = (level: number) => 200 * level * level;

export const MAX_STATION_LEVEL = 5;
export const MAX_STATIONS_PER_QUADRANT = 1;
```

## Server-Handlers

### Neue Handlers in WorldService (oder neuer StationService)
- `handleBuildStation(client)` — baut Station im aktuellen Sektor
- `handleUpgradeStation(client, { stationId })` — erhoeht Station-Level
- `handleUpgradeStationModule(client, { stationId, module: 'factory' | 'cargo' })` — erhoeht Modul-Level
- `handleGetMyStations(client)` — Liste aller eigenen Stationen
- `handleGetStationDetails(client, { stationId })` — Detail einer Station (remote)

### DB Queries (neue Datei `stationQueries.ts`)
- `getPlayerStation(sectorX, sectorY)` — Station an Sektor
- `getPlayerStations(ownerId)` — Alle Stationen eines Spielers
- `getPlayerStationInQuadrant(ownerId, qx, qy)` — Prueft 1-pro-Quadrant Limit
- `insertPlayerStation(...)` — Neue Station
- `upgradeStationLevel(stationId)` — Level erhoehen
- `upgradeStationModule(stationId, module, newLevel)` — Modul-Level erhoehen

## Client Messages

```
buildStation -> buildStationResult
upgradeStation -> upgradeStationResult
upgradeStationModule -> upgradeStationModuleResult
getMyStations -> myStations
getStationDetails -> stationDetails
```

## Nicht im Scope

- FACTORY-Produktion (Spec #2: Crafting with Factories)
- VERWALTUNG-Programm UI (Spec #3)
- Blueprint-Consume in Factory (Spec #4)
- Unterhalt/Einnahmen (Follow-Up Ticket)
- DEFENSE Modul (Follow-Up)
- COMM-RELAY Modul (Follow-Up)
- Stationen in nicht-empty Sektoren (spaeter erweiterbar)

## Testplan

- [ ] Station bauen in empty Sektor
- [ ] Station bauen in nicht-empty Sektor → Fehler
- [ ] Zweite Station im gleichen Quadranten → Fehler
- [ ] Station upgraden (Level 1→2)
- [ ] Modul-Level darf Station-Level nicht ueberschreiten
- [ ] Alte Strukturen werden migriert
- [ ] Remote-Zugriff auf Station-Details
- [ ] Kosten werden korrekt abgezogen
