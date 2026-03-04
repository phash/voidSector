# Issue #68 — Sektor-Typen & Sektor-Inhalte: Design-Dokument

**Stand:** 2026-03-04
**Branch:** `claude/design-documents-sections-XnGFr`
**Bezug:** Issue #68 „Änderungen an Spielinhalten" — Sektion 2
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

### Ist-Zustand

`SectorType` ist derzeit ein flacher Union-Typ:

```typescript
export type SectorType = 'empty' | 'nebula' | 'asteroid_field' | 'station' | 'anomaly' | 'pirate';
```

Jeder Sektor hat genau **einen** Typ, der gleichzeitig Umgebung und Inhalt beschreibt.
Das führt zu Problemen:

- Eine Nebel-Station ist nicht modellierbar
- „Leer" vs. „kein Abbau möglich" ist nicht unterschieden
- Schwarze Löcher existieren nicht
- Spieler-Basen und Home-Basen sind keine eigenen Sektortypen

### Ziele

1. **Trennprinzip:** Sektor-**Typ** (Umgebung) und Sektor-**Inhalt** entkoppeln
2. **Neue Umgebung:** `black_hole` — unpassierbar, visuell dunkel, Symbol `o`
3. **Klarere Regeln:** Nebel blockiert Hyperjump; Leerer Raum erlaubt keinen Abbau
4. **Flexibles Inhalt-System:** Mehrere Inhalte pro Sektor möglich (z. B. Asteroid + Station)
5. **Rückwärtskompatibilität:** Bestehende Sektor-Generierung bleibt seed-basiert deterministisch

---

## 2. Sektor-Typen (Umgebungen)

Drei Umgebungstypen definieren die physikalischen Eigenschaften des Sektors.
Ein Sektor hat genau **einen** Typ.

### 2.1 Nebel (`nebula`)

```
  ╔════════════════════════════════════════════════════╗
  ║  SEKTOR-TYP: NEBEL                                ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ░░░▒▒▒███▒▒▒░░░░░▒▒███▒░░░                      ║
  ║   ░▒▒████████▒▒░░▒▒███████▒░                      ║
  ║   ░░▒▒▒▓▓████▓▓▒▒▒░░▒▒███▒░░                      ║
  ║   ░░░░░▒▒▒▒▒▒▒▒░░░░░░▒▒▒░░░                      ║
  ║                                                    ║
  ║  UMGEBUNG:  Gas-Ionen-Wolke                        ║
  ║  SYMBOL:    ▒  (Radar)                             ║
  ║  FARBE:     #00BFFF (CyanBlau)                     ║
  ║                                                    ║
  ║  ► Gas: Primärressource (Ertrag ×4)               ║
  ║  ► KEIN Hyperjump möglich (Ion-Interferenz)        ║
  ║  ► Normaler Sprung: +0 AP-Aufschlag               ║
  ║  ► Scanner-Reichweite: -1 Sektor                   ║
  ╚════════════════════════════════════════════════════╝
```

| Eigenschaft             | Wert                           |
|-------------------------|--------------------------------|
| Ress.-Profil            | Gas ×4, Ore ×0.5, Crystal ×0.8 |
| Hyperjump               | **Verboten** (Ion-Interferenz) |
| Normaler Sprung         | Möglich, kein Extra-AP         |
| Fuel-Verbrauch          | Normal                         |
| Scanner-Malus           | −1 Sektor Reichweite           |
| Pirate-Spawn-Chance     | −30 % (schlechte Sicht)        |

---

### 2.2 Leerer Raum (`empty`)

```
  ╔════════════════════════════════════════════════════╗
  ║  SEKTOR-TYP: LEERER RAUM                          ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║        ·            ·                              ║
  ║                ·          ·                        ║
  ║     ·                          ·                  ║
  ║          ·        ·       ·                        ║
  ║                                                    ║
  ║  UMGEBUNG:  Offenes Vakuum                         ║
  ║  SYMBOL:    ·  (Radar)                             ║
  ║  FARBE:     #FFB000 (Amber)                        ║
  ║                                                    ║
  ║  ► Kein Abbau möglich (keine natürlichen Res.)    ║
  ║  ► Hyperjump möglich                               ║
  ║  ► Beste Reisegeschwindigkeit                      ║
  ║  ► Station/Basis als Inhalt trotzdem möglich       ║
  ╚════════════════════════════════════════════════════╝
```

| Eigenschaft             | Wert                           |
|-------------------------|--------------------------------|
| Ress.-Profil            | Kein natürlicher Abbau         |
| Hyperjump               | Möglich                        |
| Normaler Sprung         | Möglich, kein Extra-AP         |
| Fuel-Verbrauch          | −20 % (ungehinderter Raum)     |
| Scanner-Malus           | Keiner                         |
| Pirate-Spawn-Chance     | Standard                       |

> **Hinweis:** Spieler-Basen, Stationen, Jumpgates können in leeren Sektoren existieren.
> Der Typ beschreibt nur die **natürliche Umgebung**, nicht mögliche Strukturen.

---

### 2.3 Schwarzes Loch (`black_hole`)

```
  ╔════════════════════════════════════════════════════╗
  ║  SEKTOR-TYP: SCHWARZES LOCH                       ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║        . . . . . . . . . .                         ║
  ║      .  ╲               ╱  .                      ║
  ║     .    ╲    ██████   ╱    .                     ║
  ║     .     ╲  ████████ ╱     .                     ║
  ║     .      ╲ ████████╱      .                     ║
  ║     .       ╲████████       .                     ║
  ║      .        ╲██████      .                      ║
  ║        . . . .  ╲████ . . .                       ║
  ║                                                    ║
  ║  UMGEBUNG:  Singularität / Gravitationsanomalie    ║
  ║  SYMBOL:    o  (Radar)                             ║
  ║  FARBE:     #1A1A1A (fast schwarz, dunkel)         ║
  ║                                                    ║
  ║  ► UNPASSIERBAR — Sprung wird automatisch          ║
  ║    abgebrochen, Schiff am Rand positioniert        ║
  ║  ► Kein Scan möglich                               ║
  ║  ► Kein Abbau möglich                              ║
  ║  ► Gravitationslinse: Scout-Scanner sieht          ║
  ║    versteckte Sektoren dahinter (+Radius)          ║
  ╚════════════════════════════════════════════════════╝
```

| Eigenschaft             | Wert                           |
|-------------------------|--------------------------------|
| Ress.-Profil            | Keins                          |
| Sprung in BL-Sektor     | **Gesperrt** — Fehler-Meldung  |
| Scan                    | Gesperrt                       |
| Gravitations-Sonderregel| Scanner-Reichweite für Nachbarn +1 |
| Spawn-Chance            | 0.5 % der Sektoren (sehr selten) |
| Visuelle Darstellung    | Dunkler Ring, Symbol `o`       |

**Fehler-Meldung bei Sprung-Versuch:**
```
  ╔══ NAVIGATION GESPERRT ════════════════════╗
  ║                                           ║
  ║  WARNUNG: SCHWARZES LOCH ERKANNT          ║
  ║  Gravitationsfeld zu stark für sicheren   ║
  ║  Einflug. Sprung abgebrochen.             ║
  ║                                           ║
  ║  Sektor [X, Y] ist unpassierbar.          ║
  ╚═══════════════════════════════════════════╝
```

---

## 3. Sektor-Inhalte

Sektor-Inhalte sind **unabhängig vom Typ** und können kombiniert werden.
Ein Asteroid-Feld-Sektor **ist** `type: 'asteroid_field'` in der aktuellen Logik —
nach der Überarbeitung wird das zu `type: 'empty' | 'nebula'` + `contents: ['asteroid_field']`.

### 3.1 Überblick — Inhalt-Typen

```
  ┌───────────────────────────────────────────────────────┐
  │                 SEKTOR-INHALTE                        │
  │                                                       │
  │  Inhalt            Vorkommen         Besonderheit     │
  │  ──────────────────────────────────────────────────  │
  │  asteroid_field    ★★★★☆ häufig      Abbau möglich   │
  │  station           ★★★☆☆ mittel      NPC-Handel      │
  │  anomaly           ★★☆☆☆ selten      Scan-Events     │
  │  pirate_zone       ★★★☆☆ mittel      Kampfgefahr     │
  │  home_base         ★★☆☆☆ (1 pro Sp.) Spieler-Base   │
  │  player_base       ★★☆☆☆ (baubar)    Spieler-Bau    │
  └───────────────────────────────────────────────────────┘
```

---

### 3.2 Asteroid-Feld (`asteroid_field`)

```
  ╔════════════════════════════════════════════════════╗
  ║  INHALT: ASTEROID-FELD                            ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║     ◆  ◇   ▲  ◆    ▲◇                            ║
  ║   ▲   ◇   ◆    ▲     ◆  ◇                        ║
  ║     ▲    ◆  ◇  ▲  ◆    ▲                         ║
  ║   ◇  ▲       ◆   ▲   ◇   ▲                       ║
  ║                                                    ║
  ║  ABBAUBAR:  Erz, Kristall (Typ-abhängig)          ║
  ║  SEKTOR-KOMBO: asteroid_field + nebula             ║
  ║              → Erz+Gas kombiniert abbaubar         ║
  ║  GEFAHR:    Kleinere Pirate-Spawn-Chance           ║
  ╚════════════════════════════════════════════════════╝
```

| Kombinierter Sektor      | Typ         | Primär-Ressourcen        |
|--------------------------|-------------|--------------------------|
| Asteroid (offen)         | `empty`     | Ore, Crystal             |
| Asteroid + Nebel         | `nebula`    | Ore, Crystal, Gas        |
| Asteroid (pirate zone)   | `empty`     | Ore — mit Kampfgefahr    |

---

### 3.3 Station (`station`)

Stationen können in **jedem** Sektor-Typ existieren (außer `black_hole`).
NPC-Stationen erscheinen durch Welt-Generierung (seed-basiert).

```
  ╔════════════════════════════════════════════════════╗
  ║  INHALT: STATION                                  ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║       ┌───────────────────┐                        ║
  ║    ───┤  ◈ NEXUS-STATION  ├───                    ║
  ║       │  NPC: 3 Händler   │                        ║
  ║       │  Reparatur: AKTIV │                        ║
  ║       └─────────┬─────────┘                        ║
  ║                 │                                  ║
  ║                 ▼                                  ║
  ║          [STATION-MENU]                            ║
  ║          Handel | Reparatur | Quests               ║
  ║                                                    ║
  ║  Verfügbar in: empty, nebula, asteroid_field       ║
  ╚════════════════════════════════════════════════════╝
```

---

### 3.4 Anomalie (`anomaly`)

Anomalien bieten Scan-Events mit besonderen Belohnungen.

```
  ╔════════════════════════════════════════════════════╗
  ║  INHALT: ANOMALIE                                 ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║      ≈≈≈≈≈≈≈≈                                      ║
  ║    ≈≈  ╔═══╗  ≈≈   ENERGIE-ANOMALIE                ║
  ║   ≈≈   ║ ❋ ║   ≈≈  Strahlung: ERHÖHT              ║
  ║    ≈≈  ╚═══╝  ≈≈                                  ║
  ║      ≈≈≈≈≈≈≈≈                                      ║
  ║                                                    ║
  ║  Scan-Event: artifact_find / anomaly_reading       ║
  ║  Belohnung:  Artefakt (selten), XP, Credits        ║
  ╚════════════════════════════════════════════════════╝
```

---

### 3.5 Piraten-Zone (`pirate_zone`)

Piraten-Zonen sind Inhalt, kein Typ. Ein Nebel **kann** eine Piraten-Zone sein.

```
  ╔════════════════════════════════════════════════════╗
  ║  INHALT: PIRATEN-ZONE                             ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║  WARNUNG: ██ PIRATEN-AKTIVITÄT ERKANNT ██          ║
  ║                                                    ║
  ║  Aufenthalts-Risiko:  HOCH                         ║
  ║  Spawn-Chance/Aktion: 35 %                         ║
  ║  Mindest-Pirate-Level: Abhängig von Distanz        ║
  ║                                                    ║
  ║  Kombination mit nebula:                           ║
  ║  → Piraten nutzen Nebel als Deckung                ║
  ║  → Scan-Reichweite −1 Sektor                       ║
  ║  → Flucht-Wahrscheinlichkeit −10 %                 ║
  ╚════════════════════════════════════════════════════╝
```

---

### 3.6 Home-Base (`home_base`)

Jeder Spieler hat genau eine Home-Base. Liegt immer in einem `empty`-Sektor.

| Eigenschaft           | Wert                                    |
|-----------------------|-----------------------------------------|
| Anzahl pro Spieler    | 1 (unveränderlich)                      |
| Sektor-Typ            | `empty`                                 |
| Bebaubar              | Ja (Strukturen wie Storage, Trading)    |
| Angriffbar            | Nein (Schutzzone, PvP nicht möglich)    |
| Symbol                | `H` auf Radar                           |

---

### 3.7 Spieler-Basis (`player_base`)

Baubare Außenposten in beliebigen Sektoren (außer `black_hole`).

| Eigenschaft           | Wert                                    |
|-----------------------|-----------------------------------------|
| Anzahl pro Spieler    | Unbegrenzt (Ressourcenkosten)           |
| Sektor-Typ            | Beliebig (nicht `black_hole`)           |
| Bebaubar              | Ja (Strukturen)                         |
| Angriffbar            | Ja (Piraten + zukünftig PvP)            |
| Symbol                | `B` auf Radar                           |

---

## 4. Kombinationsmatrix

Nicht jeder Inhalt ist in jedem Typ erlaubt:

| Inhalt          | `empty` | `nebula` | `black_hole` |
|-----------------|---------|----------|--------------|
| asteroid_field  | ✓       | ✓        | ✗            |
| station         | ✓       | ✓        | ✗            |
| anomaly         | ✓       | ✓        | ✗            |
| pirate_zone     | ✓       | ✓        | ✗            |
| home_base       | ✓ only  | ✗        | ✗            |
| player_base     | ✓       | ✓        | ✗            |

---

## 5. Radar-Darstellung

```
  ╔══ RADAR — ZONE ════════════════════════════════════╗
  ║                                                    ║
  ║    ·    ▒▒▒   ·    ·    o    ·                     ║
  ║  · B  · ▒▒▒ · · ◆ · · o · · ·                     ║
  ║    ·    ▒S▒   ·    ·    o    ·                     ║
  ║    ·    ▒▒▒   ·   H ·   o    ·                     ║
  ║  · · ◆ · · ·  · · · ·  · ·  ·                     ║
  ║                                                    ║
  ║  Legende:                                          ║
  ║  ·  = empty (leerer Raum)                          ║
  ║  ▒  = nebula                                       ║
  ║  o  = black_hole (dunkel)                          ║
  ║  ◆  = asteroid_field (Inhalt-Overlay)              ║
  ║  S  = station (Inhalt-Overlay)                     ║
  ║  H  = home_base                                    ║
  ║  B  = player_base                                  ║
  ╚════════════════════════════════════════════════════╝
```

---

## 6. Technische Implementierung

### 6.1 Neue Typen (`packages/shared/src/types.ts`)

```typescript
// Sektor-Umgebungstypen (exklusiv)
export type SectorEnvironment = 'empty' | 'nebula' | 'black_hole';

// Sektor-Inhalte (mehrfach möglich)
export type SectorContent =
  | 'asteroid_field'
  | 'station'
  | 'anomaly'
  | 'pirate_zone'
  | 'home_base'
  | 'player_base';

// Erweitertes SectorData-Interface
export interface SectorData {
  x: number;
  y: number;
  environment: SectorEnvironment;       // NEU: Umgebungstyp
  contents: SectorContent[];            // NEU: Liste von Inhalten
  type: SectorType;                     // LEGACY: bleibt für Rückwärtskompatibilität
  // ... bestehende Felder
}
```

**Legacy-Mapping** (automatisch abgeleitet):
```typescript
function legacySectorType(env: SectorEnvironment, contents: SectorContent[]): SectorType {
  if (contents.includes('pirate_zone') && contents.includes('asteroid_field')) return 'pirate';
  if (contents.includes('station')) return 'station';
  if (contents.includes('anomaly')) return 'anomaly';
  if (contents.includes('asteroid_field')) return 'asteroid_field';
  if (env === 'nebula') return 'nebula';
  return 'empty';
}
```

### 6.2 Neue Konstanten (`packages/shared/src/constants.ts`)

```typescript
// Schwarze Löcher
export const BLACK_HOLE_SPAWN_CHANCE = 0.005;    // 0.5 %
export const BLACK_HOLE_MIN_DISTANCE = 50;        // Mindest-Abstand von Ursprung

// Nebel-Regeln
export const NEBULA_BLOCKS_HYPERJUMP = true;
export const NEBULA_SCANNER_MALUS = 1;            // −1 Sektor Scan-Reichweite
export const NEBULA_PIRATE_SPAWN_MODIFIER = 0.7;  // −30 %

// Empty-Raum-Regeln
export const EMPTY_FUEL_MODIFIER = 0.8;           // −20 % Fuel

// Sektor-Inhalte — Spawn-Gewichte
export const CONTENT_WEIGHTS = {
  asteroid_field: 0.40,
  station:        0.10,
  anomaly:        0.08,
  pirate_zone:    0.15,
  // home_base + player_base: dynamisch platziert
};

// Radar-Symbole
export const SECTOR_SYMBOLS: Record<SectorEnvironment, string> = {
  empty:      '\u00B7',   // ·
  nebula:     '\u2592',   // ▒
  black_hole: 'o',
};

// Radar-Farben
export const SECTOR_COLORS: Record<SectorEnvironment, string> = {
  empty:      '#FFB000',
  nebula:     '#00BFFF',
  black_hole: '#1A1A1A',
};
```

### 6.3 Welt-Generierung (`packages/server/src/engine/worldgen.ts`)

```typescript
function generateSector(x: number, y: number, worldSeed: number): SectorData {
  const h = hashCoords(x, y, worldSeed);
  const distFromOrigin = Math.max(Math.abs(x), Math.abs(y));

  // Schwarzes Loch prüfen (selten, mindest Distanz)
  if (distFromOrigin > BLACK_HOLE_MIN_DISTANCE && (h & 0xFF) / 255 < BLACK_HOLE_SPAWN_CHANCE) {
    return { environment: 'black_hole', contents: [], type: 'empty', ... };
  }

  // Umgebungstyp bestimmen
  const envRoll = ((h >> 8) & 0xFF) / 255;
  const environment: SectorEnvironment =
    envRoll < NEBULA_ZONE_CHANCE ? 'nebula' : 'empty';

  // Inhalte bestimmen (kombinierbar)
  const contents: SectorContent[] = [];
  const contentRoll1 = ((h >> 16) & 0xFF) / 255;
  const contentRoll2 = ((h >> 24) & 0xFF) / 255;

  if (contentRoll1 < CONTENT_WEIGHTS.asteroid_field) contents.push('asteroid_field');
  if (contentRoll2 < CONTENT_WEIGHTS.station) contents.push('station');
  // ... weitere Inhalte

  return { environment, contents, type: legacySectorType(environment, contents), ... };
}
```

### 6.4 Navigation-Prüfung (Server)

```typescript
// In handleJump():
if (targetSector.environment === 'black_hole') {
  return { success: false, error: 'BLACK_HOLE_BLOCKED' };
}
if (targetSector.environment === 'nebula' && isHyperjump) {
  return { success: false, error: 'NEBULA_BLOCKS_HYPERJUMP' };
}
```

### 6.5 Neue DB-Spalten (`packages/server/src/db/migrations/012_sector_environment.sql`)

```sql
-- Erweiterung der sectors-Tabelle (falls persistent gecacht)
ALTER TABLE discovered_sectors ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'empty';
ALTER TABLE discovered_sectors ADD COLUMN IF NOT EXISTS contents    TEXT[] DEFAULT '{}';
```

---

## 7. Phasen-Plan

### Phase 1 — Typ-System (1 Tag)

- [ ] `SectorEnvironment` + `SectorContent` in `types.ts`
- [ ] Legacy-Mapping-Funktion
- [ ] `SECTOR_SYMBOLS` + `SECTOR_COLORS` aktualisieren
- [ ] Konstanten: `BLACK_HOLE_*`, `NEBULA_*`, `EMPTY_*`

### Phase 2 — Weltgenerierung (1 Tag)

- [ ] `generateSector()` erweitern (black_hole, kombinierte Inhalte)
- [ ] Schwarze Löcher: Spawn-Logik + Mindest-Distanz
- [ ] Tests: Sektor-Generierung, Schwarz-Loch-Verteilung

### Phase 3 — Navigation & Radar (1 Tag)

- [ ] Sprung-Prüfung: `black_hole` gesperrt, `nebula` kein Hyperjump
- [ ] Radar-Renderer: `black_hole`-Symbol + Farbe
- [ ] Fehlermeldungen: `BLACK_HOLE_BLOCKED`, `NEBULA_BLOCKS_HYPERJUMP`
- [ ] Tests: Navigation-Sperren

### Phase 4 — Inhalts-Overlays (0.5 Tage)

- [ ] Radar-Overlay: Inhalt-Symbole (◆, S, H, B)
- [ ] DetailPanel: Umgebungstyp + Inhalte separat anzeigen
- [ ] Scanner: Inhalte auflisten

---

*Dokument-Ende — voidSector Issue #68 / Sektion 2: Sektor-Typen & Inhalte*
