# Mining, Cargo & UI Overhaul — Design

**Datum:** 2026-03-02
**Status:** Genehmigt

## 1. Scope

Fünf Arbeitsbereiche in einer Iteration:

1. **Bugfix Navigation** — Login-Flow und Room-Verbindung fixen
2. **UI-Overhaul** — Lesbarkeit verbessern, 4-Tab Bottom-Bar
3. **Mining-System** — Idle-Mining mit Lazy Evaluation, 3 Ressourcen
4. **Cargo-System** — Begrenzter Laderaum, Jettison
5. **Tests** — Unit-Tests für alle Room-Kommandos

## 2. Bugfix Navigation

**Problem:** `sendJump()`/`sendScan()` geben leise auf wenn `sectorRoom === null`. Der Room-Join nach Login kann fehlschlagen ohne sichtbaren Fehler.

**Fix:**
- Login-Flow umdrehen: `joinSector()` muss erfolgreich sein **bevor** `setScreen('game')` aufgerufen wird
- `sendJump`/`sendScan` loggen "NOT CONNECTED" im Event-Log wenn kein Room
- Room-Join-Fehler im LoginScreen anzeigen
- Reconnect bei Disconnect: automatisch Room re-join versuchen

## 3. UI-Overhaul

### Bottom-Bar (Monitor-Tabs)

4 feste Tabs, statisch fixiert am unteren Bildschirmrand:

```
[NAV-COM]  [SHIP-SYS]  [MINING]  [CARGO]
```

- **Inaktiv:** `color: #FFB000` (Amber) auf `background: #050505` (Schwarz)
- **Aktiv:** `color: #050505` (Schwarz) auf `background: #FFB000` (Amber) — invertiert

### Lesbarkeit

| Element | Alt | Neu |
|---|---|---|
| Body Fontgröße | 0.8rem | 1rem |
| Tab-Labels | 0.65rem | 0.85rem |
| Radar Grid lineWidth | 0.5 | 1.0 |
| Button Padding | 6px 10px | 8px 14px |
| Borders | 1px | 2px (an relevanten Stellen) |

### Bezel-Frame

Bleibt unverändert — nur Inhalte werden lesbarer.

## 4. Mining-System

### Architektur: Hybrid (Redis + PostgreSQL)

- **Redis:** Aktiver Mining-Timer (wie AP-System)
- **PostgreSQL:** Persistentes Cargo-Inventar

### Shared Types

```typescript
type ResourceType = 'ore' | 'gas' | 'crystal';

interface MiningState {
  active: boolean;
  resource: ResourceType | null;
  startedAt: number | null;    // Unix timestamp
  rate: number;                // units per second
  minedSoFar: number;          // bereits abgerechnete Einheiten
}

interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
}

// SectorData erweitert um:
interface SectorResources {
  ore: number;      // Yield (max minable)
  gas: number;
  crystal: number;
}
```

### Sektortyp → Ressourcen-Mapping

| Sektortyp | Erz | Gas | Kristalle |
|---|---|---|---|
| EMPTY | 5 | 5 | 5 |
| NEBULA | 2 | 20 | 3 |
| ASTEROID_FIELD | 20 | 2 | 3 |
| ANOMALY | 3 | 3 | 20 |
| STATION | 0 | 0 | 0 |

Werte werden seed-basiert leicht variiert (±30%).

### Mining-Flow

1. Client sendet `mine` mit `{ resource: ResourceType }`
2. Server validiert: Sektor hat Ressource? Cargo hat Platz? Kein Mining aktiv?
3. Server speichert MiningState in Redis
4. Client zeigt Mining-UI im MINING-Monitor
5. Lazy Eval bei `getMiningStatus`: `mined = min(elapsed * rate, sectorYield, cargoSpace)`
6. `stopMine` → Lazy Eval → Ergebnis ins PostgreSQL-Cargo
7. Auto-Stop bei Sektor-Wechsel oder vollem Cargo

### MINING-Monitor

```
── MINING OPERATIONS ──────────
SECTOR (3, -2) — NEBULA

  ORE     ▪▪░░░░░░░░   5
  GAS     ▪▪▪▪▪▪▪▪░░  20
  CRYSTAL ▪▪░░░░░░░░   3

STATUS: MINING GAS ◆ 2.4u/s
MINED:  ████░░░░░░  12/20

[MINE ORE]  [MINE GAS]  [MINE CRYSTAL]
                [STOP]
```

## 5. Cargo-System

### Datenmodell

PostgreSQL-Tabelle `cargo`:

```sql
CREATE TABLE cargo (
  player_id UUID REFERENCES players(id),
  resource TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, resource)
);
```

### Cargo-Kapazität

`cargoCap` auf ShipData definiert Gesamtkapazität (Summe aller Ressourcen). AEGIS_SCOUT_MK1: `cargoCap = 50`.

### CARGO-Monitor

```
── CARGO HOLD ──────────────────
VESSEL: VOID SCOUT MK. I
CAPACITY: 17/50

  ORE      ████░░░░░░  12
  GAS      ██░░░░░░░░   5
  CRYSTAL  ░░░░░░░░░░   0

[JETTISON ORE]  [JETTISON GAS]  [JETTISON CRYSTAL]
```

### Jettison

- Löscht **alle** Einheiten einer Ressource
- Event-Log: "Jettisoned 12 units of ORE"
- Server-Validierung: Ressource muss > 0 sein

### Cargo-Updates an Client

- Bei Room-Join: Initialer Cargo-Stand
- Nach Mining-Stop: Aktualisierter Cargo
- Nach Jettison: Aktualisierter Cargo

## 6. Tests

Unit-Tests für alle SectorRoom Message-Handler (Vitest):

| Kommando | Tests |
|---|---|
| `jump` | Gültiger Jump (AP, Range), ungültig (kein AP, außer Range) |
| `scan` | Sektoren enthüllt, AP korrekt abgezogen |
| `mine` | Mining startet, Fehler bei vollem Cargo, Fehler bei fehlender Ressource |
| `stopMine` | Lazy Eval korrekt, Cargo updated, Redis-State gelöscht |
| `jettison` | Cargo geleert, Fehler bei leerer Ressource |
| `getAP` | Lazy Regen korrekt |

### Testarchitektur

Handler-Logik aus SectorRoom in testbare Pure Functions extrahieren. Tests verwenden Mock-DB/Redis statt echte Connections.

## 7. Neue Colyseus Messages

| Message | Richtung | Payload |
|---|---|---|
| `mine` | Client → Server | `{ resource: ResourceType }` |
| `stopMine` | Client → Server | `{}` |
| `jettison` | Client → Server | `{ resource: ResourceType }` |
| `miningUpdate` | Server → Client | `MiningState` |
| `cargoUpdate` | Server → Client | `CargoState` |
