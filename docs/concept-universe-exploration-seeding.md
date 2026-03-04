# Konzept: Erweitertes Universum-Exploration & Quadrant-Seed-System

## 1. Koordinatensystem

### Adressformat: `[QXXX][QYYY]:[SXXX][SYYY]`

```
[QXXX][QYYY]  →  Quadrant-Koordinaten  (32-bit, dargestellt als zwei 16-bit Hex-Gruppen)
[SXXX][SYYY]  →  Sektor im Quadranten  (0x0000 – 0xFFFF je Achse)
```

| Konzept | Adresse | Quadrant-Abstand vom Zentrum |
|---|---|---|
| Universum-Zentrum | `[0000][0000]:[0000][0000]` | 0 |
| Spawn-Ring | `[0098][9680][0000]:[####][####]` | 10.000.000 |
| Universumsrand | `[FFFF][FFFF]:[FFFF][FFFF]` | 4.294.967.295 |

- Spawn-Ring liegt bei **~0,23 % des Universum-Radius** — das Zentrum ist echtes Endgame-Territorium.
- Richtung `[0000]` → dichter, wertvoller, gefährlicher (Spätspiel)
- Richtung `[FFFF]` → unwirtschaftliche Randgebiete, hohe Leerquadranten-Rate

---

## 2. Spawn-System

Spieler spawnen in einem engen Ring bei exakt **10.000.000 Quadranten** Abstand vom Zentrum.
Das Cluster-System arbeitet auf **Quadrant-Ebene**: Spieler werden demselben Spawn-Quadranten zugewiesen, bis er voll ist.

```typescript
// packages/shared/src/constants.ts
SPAWN_QUADRANT_MIN        = 10_000_000   // Ring-Innenrand
SPAWN_QUADRANT_MAX        = 10_000_010   // Ring-Außenrand (10 Quadranten Breite)
SPAWN_CLUSTER_MAX_PLAYERS = 5            // max Spieler pro Spawn-Quadrant
```

### Ablauf bei Registrierung

```
Neuer Spieler registriert sich
  └─ Suche offenen Spawn-Quadranten auf dem Ring (10M – 10M+10)
       ├─ Quadrant mit player_count < 5 gefunden
       │     → Spieler dem Quadranten zuweisen, player_count++
       │     → Sektor-Position: zufällig innerhalb des Quadranten
       └─ Kein offener Quadrant
             → Neuen Quadranten auf dem Ring aufmachen (zufälliger Winkel)
             → Spieler als Ersten zuweisen
```

Innerhalb des gemeinsamen Quadranten spawnen die Spieler an verschiedenen **Sektoren** — nah genug um sich zu finden, aber nicht übereinander.

---

## 3. Lazy Quadrant-Generierung (Seed-on-Enter)

Ein Quadrant existiert datenbankseitig **nicht**, bis der erste Spieler ihn betritt. Erst dann wird sein Seed permanent fixiert.

```
quadrant_seed = murmurhash(
  quadrant_x XOR 0xDEAD,
  quadrant_y XOR 0xBEEF,
  WORLD_SEED
) → int32
```

Der quadrant-lokale Seed bestimmt **Abweichungsfaktoren** gegenüber den globalen Basiswerten (±50%):

```typescript
interface QuadrantConfig {
  seed:            number;  // permanent nach Erstkontakt
  resourceFactor:  number;  // 0.5 – 1.5  (±50% Ressourcen)
  stationDensity:  number;  // 0.5 – 1.5  (±50% Stationshäufigkeit)
  pirateDensity:   number;  // 0.5 – 1.5  (±50% Piraten)
  nebulaThreshold: number;  // 0.5 – 1.5  (Nebelzonen-Radius)
  emptyRatio:      number;  // 0.5 – 1.5  (Anteil leerer Sektoren)
}
```

**Invariante:** Quadrant-Seed ist nach Erstkontakt **permanent** — keine Regeneration möglich.
Sektoren innerhalb eines Quadranten erben den Quadrant-Seed statt `WORLD_SEED`.

### Beispiel-Extremfälle (durch Varianz emergent)

| Quadrant-Charakter | emptyRatio | stationDensity | resourceFactor | pirateDensity |
|---|---|---|---|---|
| Kernzone (Handelszentrum) | 0.5 | 1.5 | 1.4 | 0.6 |
| Ödnis | 1.5 | 0.5 | 0.6 | 0.7 |
| Piratennest | 0.8 | 0.6 | 0.9 | 1.5 |
| Ressourcenparadies | 0.6 | 1.2 | 1.5 | 0.8 |

---

## 4. First-Contact & Quadrant-Benennung

Wenn der erste Spieler einen Quadranten betritt, erhält er einen Naming-Prompt:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ FIRST CONTACT                                        │
│  You are the first to enter this quadrant.               │
│  Designate a name for the historical record.             │
│                                                          │
│  > _                          [max 24 Zeichen]           │
│                                                          │
│  [CONFIRM]   [SKIP → auto-name]                         │
└─────────────────────────────────────────────────────────┘
```

- **Namensregeln:** 3–24 Zeichen, alphanumerisch + Leerzeichen
- **Skip / Timeout** (60 s): Auto-Name deterministisch aus Quadrant-Seed
- **Name ist permanent** — kein Umbenennen (außer Admin-Override)
- **Broadcast:** Alle aktiven Spieler erhalten Benachrichtigung: `"[NAME] charted by <player>"`

---

## 5. Quadrant-Karte (QUAD-MAP Monitor)

Analog zur bestehenden NAV-Karte (RadarRenderer), aber auf **Quadrant-Ebene**.
1 Pixel ≙ 1 Quadrant. Keine Sektor-Typen — nur Quadrant-Namen sichtbar.

```
┌──────────────────────────────────────────────────────────────────────┐
│  QUAD-MAP  ║  zoom: 1Q  ║  cursor: [0098][9700]  ║  known: 47 quads │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   · · · · · · · [IRON REACH] · · · · · ·                             │
│   · · · [VEILED ABYSS] · · [COLDFRONT] · ·                           │
│   · · · · · · · · [*YOU*] · · · · · · · ·                            │
│   · · · · [DUSTFIELDS] · · · · · · · · · ·                           │
│   · · · · · · · · · · · · · · · · · · · · ·                          │
│                                                                        │
│   ░ = bekannt (benannt)    · = unbekannt    ▓ = aktuell              │
└──────────────────────────────────────────────────────────────────────┘
```

### Verhalten

- Nur **entdeckte/benannte** Quadranten sichtbar (echtes Fog-of-War)
- Zoom & Pan identisch zur NAV-Karte
- Klick auf Quadrant: Name, Entdecker, Datum, bekannte Sektorzahl
- **Karten-Sync** beim Anlegen an einer Station (lernt alle öffentlich bekannten Quadranten)

---

## 6. Datenbankschema (neu)

```sql
-- Migration 011_quadrants.sql

CREATE TABLE IF NOT EXISTS quadrants (
  qx            BIGINT NOT NULL,
  qy            BIGINT NOT NULL,
  seed          INTEGER NOT NULL,
  name          VARCHAR(64),
  discovered_by INTEGER REFERENCES players(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  config        JSONB NOT NULL,
  PRIMARY KEY (qx, qy)
);

CREATE TABLE IF NOT EXISTS player_known_quadrants (
  player_id   INTEGER REFERENCES players(id),
  qx          BIGINT NOT NULL,
  qy          BIGINT NOT NULL,
  learned_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, qx, qy),
  FOREIGN KEY (qx, qy) REFERENCES quadrants(qx, qy)
);

CREATE INDEX IF NOT EXISTS idx_quadrants_discovered_by
  ON quadrants(discovered_by);

CREATE INDEX IF NOT EXISTS idx_player_known_quadrants_player
  ON player_known_quadrants(player_id);
```

---

## 7. Leere Sektoren: Rare Encounters

Leere Sektoren (`type = 'empty'`) bekommen ein Encounter-System mit sehr geringen Wahrscheinlichkeiten.
Ausgelöst pro **Local-Scan** oder **Area-Scan**:

| Encounter-Typ | Basis-Wahrscheinlichkeit | Beschreibung |
|---|---|---|
| **Drifting NPC** | 0,8 % | Händler/Forscher im freien Raum. Einmalig handelbar, dann weg. |
| **Alien Signature** | 0,3 % | Unbekannte Signatur. Scan-Sequenz → Artefakt oder Feindkontakt. |
| **Artefakt-Wrack** | 0,5 % | Bergbares Objekt (einmalig). Gibt seltene Ressource oder Data-Slate. |

```typescript
const EMPTY_ENCOUNTER_CHANCES = {
  driftingNpc:   0.008,
  alienSig:      0.003,
  artifactWreck: 0.005,
};

// Scanner Level 3 → ×1.5 Erkennungsrate
const bonus = 1 + (scannerLevel - 1) * 0.25;
```

- **Deterministisch:** Selber Sektor → selber Encounter (bis consumed)
- **Einmalig:** In `sector_events` gespeichert mit `consumed_at`
- **Alien Signature:** Eigene Event-Sequenz (kein Battle-Dialog — Mystery/Curiosity-Mechanik)

---

## 8. Implementierungs-Roadmap

```
Phase A – Datenmodell
  ├─ Migration 011_quadrants.sql
  ├─ QuadrantConfig Interface in shared/types.ts
  └─ hashCoords-Erweiterung für Quadrant-Seeds

Phase B – Server-Logik
  ├─ generateQuadrant() in worldgen.ts
  ├─ generateSector() mit QuadrantConfig-Parameter
  ├─ Spawn-System auf Quadrant-Ebene (spawn.ts)
  ├─ First-Contact-Event in SectorRoom.ts
  └─ rollEmptyEncounter() in emptyEncounter.ts (neu)

Phase C – Client-UI
  ├─ QuadrantMapRenderer (analog RadarRenderer)
  ├─ QUAD-MAP Monitor-Komponente
  ├─ First-Contact-Dialog
  └─ Station-Sync: player_known_quadrants update on dock

Phase D – Balance & Tests
  ├─ Encounter-Wahrscheinlichkeiten tunen
  ├─ Quadrant-Varianz-Extremwerte validieren
  └─ Vitest-Suites für Quadrant-Seed-Determinismus
```
