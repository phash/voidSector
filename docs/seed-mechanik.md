# Seed-Mechanik — voidSector

Das Universum ist vollständig deterministisch aus einem einzigen Integer generiert.
Für jede Koordinate lässt sich der Sektor jederzeit neu berechnen — die DB speichert nur, was Spieler *entdeckt* haben.

---

## Globaler Seed

```ts
// packages/shared/src/constants.ts
export const WORLD_SEED = 77;
```

Ein fixer, hardcoded Wert für das gesamte Universum. Ändert sich nie → Welt ist nach jedem Server-Neustart identisch.

---

## `hashCoords(x, y, worldSeed)` — Kernfunktion

```ts
// packages/server/src/engine/worldgen.ts
export function hashCoords(x: number, y: number, worldSeed: number): number
```

MurmurHash-ähnlicher Algorithmus, liefert einen **signed 32-bit Integer** (passt direkt in PostgreSQL `INTEGER`):

1. `x` und `y` bekommen je einen Prime-Offset (`0x9e3779b9` / `0x517cc1b7`) → verhindert Symmetrie-Artefakte (z.B. `(1,1) ≠ (-1,-1)`)
2. Beide Werte werden separat mit dem Seed gemischt (`Math.imul` + XOR-Shifts)
3. Kombinieren + nochmals mischen
4. Rückgabe `h | 0` (signed 32-bit)

---

## Drei Hash-Ebenen pro Sektor

Für jeden Sektor `(x, y)` gibt es drei **unkorrelierte** Zufallswerte:

| Funktion | XOR-Mix | Verwendung |
|---|---|---|
| `hashCoords(x, y, WORLD_SEED)` | — | Environment-Roll (Primär) |
| `hashSecondary(primarySeed)` | `^ 0xdeadbeef` | Station ancient? Nebel-/BH-Radius |
| `hashTertiary(primarySeed)` | `^ 0xcafebabe` | Content-Roll |

Alle drei geben einen `float` `0..1` zurück (außer Primary: signed int).

---

## Generierungsablauf pro Sektor

```
hashCoords(x, y, WORLD_SEED)
      ↓ seed

Stage 1 — rollEnvironment(x, y, seed)
  ├─ Black Hole standalone?  (Distanz > MIN + seed-Roll < SPAWN_CHANCE)
  ├─ In Black-Hole-Cluster?  (hashCoords(cx,cy, WORLD_SEED ^ 0xb1ac4001))
  ├─ In Nebula-Zone?         (hashCoords(cx,cy, WORLD_SEED ^ 0xa5a5a5a5))
  └─ Weighted roll           (via hashSecondary → ENVIRONMENT_WEIGHTS)

Stage 2 — rollContent(seed, environment)
  └─ Weighted roll           (via hashTertiary → CONTENT_WEIGHTS)
     'pirate' → ['pirate_zone', 'asteroid_field']
     'none'   → []

Stage 3 — generateResources(type, seed)
  └─ Basis-Yield ±30% Variation via Seed-Bits (3 × 8 Bit aus seed)

Stage 4 — metadata
  └─ stationVariant: 'ancient'?  (hashSecondary < ANCIENT_STATION_CHANCE)
```

---

## Salt-Prinzip

Damit verschiedene Systeme **nicht mit dem Sektor-Typ korrelieren**, bekommt jedes seinen eigenen Salt:

| System | Salt |
|---|---|
| Sektoren (Basis) | `WORLD_SEED` |
| Jumpgates | `WORLD_SEED + JUMPGATE_SALT` |
| Ancient Jumpgates | `WORLD_SEED + ANCIENT_JUMPGATE_SALT` |
| NPCs (Fraktions-Roll) | `WORLD_SEED + FACTION_SEED_SALT` |
| NPCs (Instanz-Roll) | `WORLD_SEED + NPC_SEED_SALT + i` |
| Quests | `WORLD_SEED + QUEST_SEED_SALT + dayOfYear` |
| Scan-Events | `WORLD_SEED + SCAN_EVENT_SALT` |
| Rettungssignale | `WORLD_SEED + DISTRESS_SALT` |
| Nebula-Zones | `WORLD_SEED ^ 0xa5a5a5a5` |
| Black-Hole-Cluster | `WORLD_SEED ^ 0xb1ac4001` |
| Quadrant-Charakter | `WORLD_SEED ^ 0x51ad8a47` |

> **Quests** verwenden zusätzlich `dayOfYear` als Salt → Quests rotieren täglich, sind aber pro Tag deterministisch.

---

## Content Weights (Stage 2 — zweiter Roll)

Gilt für alle Nicht-Black-Hole-Sektoren. 90% aller Sektoren sind komplett leer.

| Content | Wahrscheinlichkeit |
|---|---|
| `none` (leer) | 90.0 % |
| `asteroid_field` | 5.0 % |
| `pirate` | 2.0 % |
| `station` | 1.6 % |
| `anomaly` | 1.0 % |
| `ruin` | 0.4 % |

> `pirate` → erzeugt immer `['pirate_zone', 'asteroid_field']` (Piraten haben immer auch Asteroiden)
> `station` → 15 % Chance auf `stationVariant: 'ancient'` (via `hashSecondary`)

**Stage 1** (`ENVIRONMENT_WEIGHTS`) gibt immer `empty: 1.0` zurück — Nebula und Black Holes werden **vor** diesem Roll abgefangen (Zone-Checks). Stage 1 bestimmt also nur die Umgebung (Nebula/BH/leer), Stage 2 den Inhalt.

---

## Piraten-Level

**Kein Seed** — rein distanzbasiert (Euklidisch von `(0,0)`):

```ts
// packages/server/src/engine/npcgen.ts
export function getPirateLevel(sectorX, sectorY): number {
  const distance = Math.sqrt(sectorX² + sectorY²);
  return Math.min(Math.floor(distance / 50) + 1, 10);
}
```

| Distanz von (0,0) | Level |
|---|---|
| 0–49 | 1 |
| 50–99 | 2 |
| 100–149 | 3 |
| … | … |
| ≥ 450 | 10 (Max) |

HP und Schaden skalieren linear:

```
HP     = 20 + level × 10   →  Level 1: 30 HP  · Level 10: 120 HP
Damage =  5 + level × 3    →  Level 1:  8     · Level 10:  35
```

Sonderregeln:
- **Nebula**: Piraten spawnen 30 % seltener (`NEBULA_PIRATE_SPAWN_MODIFIER = 0.7`)
- **Verhandlung** (`canNegotiate`): nur möglich wenn `pirateReputation >= 1`

---

## Zones: Nebula & Black Holes

Beide nutzen ein **grobes Grid** über der Weltkarte:

```
NEBULA_ZONE_GRID / BLACK_HOLE_CLUSTER_GRID
       ↓
Für jeden Grid-Punkt (cx, cy):
  hashCoords(cx, cy, WORLD_SEED ^ salt) → roll < ZONE_CHANCE?
    ja → hashSecondary → Radius bestimmen
         Alle Sektoren innerhalb Radius → erben den Typ
```

- Ergibt organisch wirkende **Blobs** (Nebel-Wolken, BH-Cluster)
- Origin-Bereich ist immer sicher: kein Nebel, keine Black Holes nahe `(0,0)` (`NEBULA_SAFE_ORIGIN`, `BLACK_HOLE_MIN_DISTANCE`)
- Nebula: Euklidische Distanz → runde Blobs
- Black Holes: Chebyshev-Distanz → quadratisch-eckige Cluster

---

## Ancient Ruins

```ts
// packages/server/src/engine/ancientRuinsService.ts
getRuinFragmentIndex(x, y, worldSeed)  // welches Fragment
getRuinLevel(x, y, worldSeed)          // Stufe 1–3
```

Eigene Hash-Formeln (keine `hashCoords`), aber gleiches Prinzip: `(x * prime) ^ (y * prime) ^ (worldSeed * prime)`.

---

## Zusammenfassung

```
WORLD_SEED (77)
    │
    ├─ hashCoords(x, y, seed)           → Sektor-Typ, Ressourcen, Metadata
    ├─ hashCoords(x, y, seed + salt)    → Jumpgates, NPCs, Quests, Scan-Events
    └─ hashCoords(cx, cy, seed ^ mask)  → Nebula-Zones, Black-Hole-Cluster
```

Die gesamte Weltstruktur ist **zustandslos** und **serverRestart-stabil** — nur Spieleraktionen (Entdeckungen, Mining, Faction-Conquests) verändern den DB-Zustand.
