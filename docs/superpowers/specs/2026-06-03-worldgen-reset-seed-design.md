# Worldgen-Reset & neue Seed/Nebel/Anomalie-Regeln

**Datum:** 2026-06-03 · **Branch:** `feat/worldgen-reset-seed` · **Status:** Design genehmigt

## Ziel

Frischer Welt-Start: neuer Seed, exakt **eine** Menschen-Base bei (0,0), Aliens
mindestens **1000 Sektoren** entfernt, und neue Verteilung von Nebel und
Anomalien. Da die Welt in der DB persistiert ist, wirken Regel-/Seed-Änderungen
nur auf **neu generierte** Sektoren — deshalb gehört ein **Welt-Reset** dazu
(Accounts bleiben erhalten, Spielfortschritt wird vollständig zurückgesetzt).

## Anforderungen (Quelle: User)

1. Seed ändern.
2. Zu Beginn existiert nur bei (0,0) eine einzelne Menschen-Base.
3. Aliens mindestens 1000 Sektoren entfernt.
4. Anomalien: im normalen, leeren Raum ≈ 0,01 %; im Nebel 10 % (jedes 10.
   Nebelfeld ist Nebel **und** Anomalie).
5. 5 % der Felder sind Nebelfelder.
6. Nebel hängen zusammen — immer mindestens 12 Felder pro Cluster.

## Entscheidungen

- **Umfang:** Welt-Reset, Accounts behalten. Spielfortschritt (Position, Schiff,
  Cargo, Credits, XP/ACEP) wird **komplett** zurückgesetzt; nur Login-Identität
  (Username, Passwort-Hash, E-Mail-Verify) bleibt.
- **Seed:** `WORLD_SEED = 104729` (vorher 77).
- **Nebelfreie Safe-Zone** um (0,0): Radius **25** Sektoren.
- **Nebel-Strategie:** bestehendes deterministisches Blob/Zonen-System retunen
  (statt Noise-Feld), weil Blobs Konnektivität und Mindestgröße deterministisch
  garantieren.

## Architektur-Überblick

Betroffene Stellen:

| Bereich | Datei |
|---------|-------|
| Konstanten (Seed, Nebel, Anomalie, Territorium) | `packages/shared/src/constants.ts` |
| Worldgen (Nebel-Zonen, Content-/Anomalie-Roll, Hashes) | `packages/server/src/engine/worldgen.ts` |
| Re-Seed beim Start (Kernwelt, Zentrum, Alien-Homes) | `packages/server/src/db/queries.ts`, `universeBootstrap.ts` |
| Reset-Script | `packages/server/src/scripts/resetWorld.ts` (neu) |
| Tests | `worldgen`-Tests in `packages/server`, ggf. `shared` |

## Detail-Design

### 1. Seed

`WORLD_SEED` in `packages/shared/src/constants.ts` von `77` auf `104729` setzen.
Nach Änderung **Pflicht**: `cd packages/shared && npm run build` (re-export aus
`dist/`). Der Seed mischt über `hashCoords`, der konkrete Wert ist unkritisch.

### 2. Single Human Base

- `ensureKernweltStation()` setzt bereits **eine** Station bei Sektor (0,0).
  `bulkEnsureFactionStations` schließt `controlling_faction = 'humans'`
  explizit aus — es entsteht keine zweite Menschen-Station am Quadranten-Zentrum.
- `ensureZentrumQuadrant()` setzt `quadrant_control` (0,0) = humans (100 %).
- `HUMAN_STARTING_TERRITORY` von 9 Quadranten (0:0–2:2) auf **`[[0, 0]]`**
  reduzieren — Konsistenz im In-Memory-Territorium (`initializeTerritoryState`).

### 3. Aliens ≥ 1000 Sektoren

- `QUADRANT_SIZE = 500`. Alle `faction_config`-Homes (Migration 043) liegen
  bereits ≥ 2001 Sektoren von (0,0) entfernt (nächste: `tourist_guild` −5:−25 →
  2001 Sektoren, `consortium` −10:−20 → 4501). Constraint **bereits erfüllt**.
- Der Reset entfernt die persistierte Über-Expansion (~76k Quadranten in
  `quadrant_control`); danach kontrollieren Aliens nur ihre fernen Home-Quadranten.
- **Neu:** Start-Assertion in `universeBootstrap.startUniverseEngine()` (nach
  `ensureAlienHomeQuadrants`), die prüft, dass jedes Alien-Home die minimale
  Chebyshev-Sektor-Distanz von 1000 zu (0,0) einhält; sonst Fehler-Log + Abbruch.
  Schützt vor versehentlich zu nahen Home-Werten in der Zukunft.

### 4. Nebel: ~5 %, zusammenhängend, Cluster ≥ 12

`packages/shared/src/constants.ts`:

| Konstante | Alt | Neu | Begründung |
|-----------|-----|-----|-----------|
| `NEBULA_ZONE_GRID` | 250 | **25** | dichteres Zentren-Raster |
| `NEBULA_ZONE_CHANCE` | 0.4 | **0.5** | Aktivierungsrate |
| `NEBULA_ZONE_MIN_RADIUS` | 2.5 | **2.5** | Scheibe ≈ 21 Sektoren ≥ 12 ✓ |
| `NEBULA_ZONE_MAX_RADIUS` | 8 | **6** | Scheibe ≈ 113 Sektoren |
| `NEBULA_SAFE_ORIGIN` | 250 | **25** | nebelfreie Start-Blase |

**Abdeckungsrechnung:** Zentren-Dichte 1/25², Aktivierung 0.5, mittlere
Scheibenfläche ≈ 62 Sektoren (E[r²] für r∈[2.5,6], plus Integer-Diskretisierung)
→ Abdeckung ≈ 62 / (625·2) ≈ **5,0 %**.

**Cluster-Garantie:** kleinste Scheibe (r=2.5) ≈ 21 Felder ≥ 12. Raster (25) >
max. Durchmesser (12) → Blobs überlappen selten, bleiben aber zusammenhängend;
gelegentliches Verschmelzen benachbarter Blobs erhöht die Größe nur (immer ≥12).

**Connectivity:** ein Blob ist eine gefüllte Kreisscheibe (per Definition
zusammenhängend). Der 3×3-Raster-Scan in `isInNebulaZone` deckt alle relevanten
Zentren ab (nächstes Zentrum ≤ grid/2 = 12.5 entfernt, max. Radius 6 < 12.5).

**Per-Sektor-Safe-Guard:** zu Beginn von `isInNebulaZone(x, y)`:
`if (x*x + y*y < NEBULA_SAFE_ORIGIN * NEBULA_SAFE_ORIGIN) return false;` —
harte nebelfreie Zone um (0,0), unabhängig von Zentren-Positionen.

### 5. Anomalien: 0,01 % leer / 10 % Nebel

- `anomaly` aus `CONTENT_WEIGHTS` **entfernen** (war 0.01 uniform). Die frei
  werdenden 0.01 fallen auf „none" (none 0.9 → 0.91), Summe bleibt 1.0.
- Neue Konstanten in `constants.ts`:
  - `EMPTY_ANOMALY_CHANCE = 0.0001` (0,01 %)
  - `NEBULA_ANOMALY_CHANCE = 0.10` (10 %)
- Neuer, dekorrelierter Hash `hashQuaternary(seed)` in `worldgen.ts` (eigene
  Konstante, unkorreliert zu primary/secondary/tertiary).
- `rollContent(seed, environment)` neu strukturiert:
  ```
  if environment === 'black_hole': return []
  const anomalyChance = environment === 'nebula'
      ? NEBULA_ANOMALY_CHANCE : EMPTY_ANOMALY_CHANCE
  if hashQuaternary(seed) < anomalyChance: return ['anomaly']   // Vorrang
  // sonst: bisheriger CONTENT_WEIGHTS-Roll (ohne anomaly)
  ```
- Folge: Anomalie-Sektoren sind „rein" (kein Misch mit station/asteroid). Im
  Nebel bleibt `environment = 'nebula'`, `contents = ['anomaly']`,
  `legacySectorType` → `'anomaly'` ⇒ **„Nebel UND Anomalie"**. Nebel-Eigenschaften
  (Scan-Malus, Buildable) bleiben über `environment` erhalten.

### 6. Reset-Script `resetWorld.ts`

Manuell auszuführen (npm-Script), Vorbild: bestehendes `reseed.ts`. Ablauf:

1. `runMigrations()`.
2. **Welt + Expansion wipen** (`DELETE FROM`): `sectors`, `quadrants`,
   `quadrant_control`, `expansion_log`, `npc_fleet`, `civ_stations`, `civ_ships`,
   Construction-Sites-Tabelle(n), Wrack-Tabelle, `npc_station_data` (außer 0:0).
3. **Spieler-Weltzustand wipen:** `player_discoveries`, `player_known_quadrants`,
   `player_known_jumpgates`, `player_bookmarks`, `player_quadrant_visits`,
   `player_station_reputation`, `autopilot_routes`, `player_auto_refuel`,
   Quest-Fortschritt, ACEP/XP-Tabellen, `cargo`, `ships`.
4. **Accounts behalten, Fortschritt resetten:** `players`-Zeilen bleiben (id,
   username, password_hash, E-Mail-Verify); pro Spieler frisches Start-Setup
   anlegen (Schiff mit Start-Modulen, Start-Credits, frischer Spawn nahe 0:0 via
   `generateSpawnPosition()`), XP/Level/ACEP auf 0.
5. **Redis flushen** (AP/Fuel/Mining/Position-Cache) — separat dokumentiert
   (`redis-cli FLUSHALL` bzw. im Script via ioredis).
6. Re-Seed passiert automatisch beim nächsten Server-Start über die `ensure*`-
   Funktionen (Kernwelt 0:0, Zentrum-Quadrant, Alien-Homes).

> Hinweis: das alte `reseed.ts` löscht `players` und legt Testaccounts neu an —
> `resetWorld.ts` ist die accounts-erhaltende Variante und ersetzt es als
> Standard-Reset.

### 7. Tests

TDD — Tests vor/parallel zur Implementierung:

- **Nebel-Abdeckung:** Stichprobe über großes Sektor-Areal → Nebel-Anteil ∈
  [4 %, 6 %].
- **Cluster ≥ 12:** Flood-Fill über ein Areal → jeder zusammenhängende
  Nebel-Cluster ≥ 12 Felder.
- **Safe-Origin:** kein Sektor mit `x²+y² < 25²` ist Nebel.
- **Anomalie-Raten:** großes Sample empty → Anteil ≈ 0,01 % (Toleranz); Sample
  Nebel → Anteil ≈ 10 %.
- **Single Base / Aliens:** `HUMAN_STARTING_TERRITORY == [[0,0]]`; Assertion
  „kein Alien-Home < 1000 Sektoren" greift.
- Bestehende Worldgen-Tests, die alte Konstanten annehmen, anpassen.

### 8. Build & Rollout

1. `cd packages/shared && npm run build` (nach Konstanten-Änderung, Pflicht).
2. Server-Tests: `cd packages/server && npx vitest run`.
3. Shared-Tests: `cd packages/shared && npx vitest run`.
4. Reset ausführen: `resetWorld.ts` + Redis-Flush.
5. Server neu starten → `ensure*` re-seeden die frische Welt.

## Risiken / Offene Punkte

- **Abdeckung ist eine Schätzung** (Integer-Diskretisierung der Scheiben). Test
  mit Toleranz [4 %, 6 %]; bei Abweichung `NEBULA_ZONE_CHANCE` feinjustieren.
- **Construction/Wrack-Tabellennamen** im Reset-Script in der Implementierung
  exakt aus dem Schema verifizieren.
- **Start-Loadout-Logik** für Account-Reset: vorhandene `createPlayer`-Setup-
  Logik wiederverwenden statt duplizieren.
