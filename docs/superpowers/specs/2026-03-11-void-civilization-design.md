# Die Voids — Design Spec

**Datum:** 2026-03-11
**Issue:** #267
**Status:** APPROVED
**Abhängig von:** Migration 055 (error_logs), Phase EW (StrategicTickService)

---

## Überblick

Die Voids sind eine neue Alien-Zivilisation ohne Schiffe, ohne Dialog, ohne Verhandlung. Sie breiten sich Sektor für Sektor aus, zerstören alle Strukturen in ihrem Weg und machen Quadranten zur Todeszone. Sie sind kein Feind den man bekämpfen kann — zumindest nicht in der Frühphase.

---

## Kernprinzipien

- **Keine Schiffe, keine Kommunikation** — Voids sind eine Naturgewalt, kein Gesprächspartner
- **Todeszonen** — Void-Sektoren sind instant-kill für Spieler ohne Void Shield
- **Selbst-regulierende Population** — Max 32–48 Cluster global, natürliches Einpendeln
- **Late-Game-Konter** — Ancient Void Shield + Void Gun, nur via Ancient Ruins findbar
- **Recovery gratis** — bestehender StrategicTickService übernimmt Rückeroberung nach Void-Rückzug

---

## Datenmodell (Migration 056)

### Neue Tabellen

```sql
-- Cluster-Metadaten
CREATE TABLE IF NOT EXISTS void_clusters (
  id               TEXT PRIMARY KEY,        -- z.B. 'vc_1741000001'
  state            TEXT NOT NULL,           -- 'growing' | 'splitting' | 'dying'
  size             INT NOT NULL DEFAULT 0,  -- AKTUELL vollständig kontrollierende Quadranten
                                            -- (nimmt ab bei Splitting/Dying)
  split_threshold  INT NOT NULL,            -- 8–16, beim Spawn zufällig gewürfelt
  spawned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin_qx        INT NOT NULL,
  origin_qy        INT NOT NULL
);

-- Progress pro Quadrant (0–100%)
CREATE TABLE IF NOT EXISTS void_cluster_quadrants (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  qx          INT NOT NULL,
  qy          INT NOT NULL,
  progress    INT NOT NULL DEFAULT 0,       -- 0–100
  PRIMARY KEY (cluster_id, qx, qy)
);

-- Frontier-Ring: echte Sektor-Koordinaten im aktiven Rand
-- PK ist (cluster_id, x, y) — zwei Cluster-Frontiers können denselben Sektor nicht
-- gleichzeitig beanspruchen: erster Insert gewinnt (ON CONFLICT DO NOTHING).
CREATE TABLE IF NOT EXISTS void_frontier_sectors (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  x           INT NOT NULL,
  y           INT NOT NULL,
  PRIMARY KEY (cluster_id, x, y)
);
-- Für Traversability-Lookup: schneller Check ob (x,y) überhaupt void ist
CREATE INDEX IF NOT EXISTS idx_void_frontier_xy ON void_frontier_sectors(x, y);
```

### Änderung an bestehender Tabelle

```sql
ALTER TABLE quadrant_control
  ADD COLUMN IF NOT EXISTS void_cluster_id TEXT REFERENCES void_clusters(id);
```

`controlling_faction = 'voids'` + `void_cluster_id` identifiziert vollständig eroberte Quadranten.

### `QuadrantControlRow` Interface (queries.ts)

```typescript
export interface QuadrantControlRow {
  qx: number;
  qy: number;
  controlling_faction: string;
  faction_shares: Record<string, number>;
  attack_value: number;
  defense_value: number;
  friction_score: number;
  station_tier: number;
  last_strategic_tick: Date | null;
  void_cluster_id: string | null;   // NEU
}
```

### Neue Query-Funktionen in queries.ts

```typescript
getVoidClusters(): Promise<VoidClusterRow[]>
getVoidClusterById(id: string): Promise<VoidClusterRow | null>
upsertVoidCluster(cluster: VoidClusterRow): Promise<void>
deleteVoidCluster(id: string): Promise<void>
getVoidClusterQuadrants(clusterId: string): Promise<VoidClusterQuadrantRow[]>
upsertVoidClusterQuadrant(clusterId: string, qx: number, qy: number, progress: number): Promise<void>
deleteVoidClusterQuadrant(clusterId: string, qx: number, qy: number): Promise<void>
getVoidFrontierSectors(clusterId: string): Promise<Array<{x: number; y: number}>>
replaceVoidFrontierSectors(clusterId: string, qx: number, qy: number, sectors: Array<{x: number; y: number}>): Promise<void>  // löscht alte Rows für diesen Quadranten, insertet neue — alles in einer Transaktion
deleteVoidFrontierSectorsForQuadrant(clusterId: string, qx: number, qy: number): Promise<void>
isVoidFrontierSector(x: number, y: number): Promise<boolean>  // nutzt idx_void_frontier_xy
createVoidHive(qx: number, qy: number, clusterId: string): Promise<void>
deleteVoidHive(qx: number, qy: number): Promise<void>
```

---

## Void-Lifecycle

```
SPAWN → GROWING → (size >= split_threshold) → SPLITTING → 2–3 neue Cluster (GROWING)
         ↑                                                         |
         └──────────────── (collision: beide schrumpfen) ─────────┘
                                          ↓
                                  (Pop-Cap > 48) → DYING
```

### Spawn

- Geprüft alle 4 Stunden im `VoidLifecycleService` (alle 240 StrategicTicks)
- Bedingung: globale Cluster-Anzahl (Summe aller `void_clusters`-Rows) < 32
- Spawn-Punkt: unbeanspruchter Quadrant (`controlling_faction IS NULL`), ≥ 50 Quadranten Mindestabstand von jedem Quadranten mit `controlling_faction != NULL`
- **Mindestabstand vom Ursprung:** Spawn nie innerhalb von 100 Quadranten von `(0,0)` — verhindert Bedrohung der menschlichen Startzone auf einer leeren Karte
- Neuer Cluster: `state='growing'`, `size=0`, `split_threshold = random(8, 16)`, Void Hive-Station im Origin-Quadranten (via `createVoidHive`-Query)

### Growing

- Pro StrategicTick: `progress += 1` für alle Rows in `void_cluster_quadrants` mit `progress < 100`
- Bei `progress = 100`: Quadrant vollständig
  - `quadrant_control` erhält `controlling_faction='voids'`, `void_cluster_id=<id>`
  - `size++` auf `void_clusters`
  - Eintrag bleibt in `void_cluster_quadrants` (progress=100, als Referenz für Split-Geometrie)
  - 1 neuer Nachbar-Quadrant wird hinzugefügt: via `getExpansionTarget`-Logik (nächster freier oder fremder Quadrant, diagonal-inklusiv), neuer Eintrag mit `progress=0`
  - Void Hive für diesen Quadranten anlegen: `createVoidHive(qx, qy, clusterId)`
  - `void_frontier_sectors` für diesen Quadranten löschen (vollständig, kein Frontier mehr)
- Frontier-Ring für `progress < 100`-Quadranten: nach Progress-Update via `replaceVoidFrontierSectors` (siehe Frontier-Algorithmus unten); Reihenfolge: erst alten Ring löschen, dann Strukturen-Check, dann neuen Ring einfügen (alles in einer DB-Transaktion)
- Wenn `size >= split_threshold` → `state = 'splitting'` (wird in nächstem Tick verarbeitet)

### Splitting

Trigger: Cluster mit `state='splitting'` im aktuellen Tick.

**Partitionierungsregel (Outer vs Middle):**
1. Berechne geometrischen Schwerpunkt aller `progress=100`-Quadranten des Clusters
2. Sortiere Quadranten nach Distanz zum Schwerpunkt (absteigend = äußere zuerst)
3. Teile in `n` Gruppen auf (n = random(2, 3)):
   - Gruppen werden durch Nearest-Centroid-Zuweisung gebildet: n Seeds = n am weitesten voneinander entfernte Quadranten
   - Jeder Quadrant wird dem nächsten Seed zugewiesen
4. Quadranten die keiner Gruppe mit ≥ 2 Mitgliedern angehören (isolierte Mittelpunkte) → `controlling_faction = NULL`, `void_cluster_id = NULL`
5. Jede valide Gruppe → neuer `void_clusters`-Eintrag, `state='growing'`, neues `split_threshold`

Der alte Cluster-Eintrag wird nach dem Split gelöscht.

### Collision

- Trigger: zwei verschiedene Cluster haben benachbarte vollständige Quadranten (Nachbarschaft: cardinal-only, `|dx| + |dy| = 1`)
- Für jeden der beiden Cluster:
  - Behalte die 3 Quadranten mit dem größten Abstand zum Mittelpunkt des jeweils anderen Clusters
  - Gib alle anderen Quadranten frei (`controlling_faction = NULL`, `void_cluster_id = NULL`, `size--`)
- Minimum: je Cluster bleiben mindestens 2 Quadranten — kein Cluster stirbt durch Collision allein
- Beide Cluster: `state='growing'` (falls noch nicht)

### Dying (Pop-Cap)

- Globale Cluster-Anzahl > 48: die ältesten Cluster (nach `spawned_at` aufsteigend) wechseln zu `state='dying'`
  Anzahl sterbender Cluster = `floor((count - 48) / 2) + 1`
- Pro Tick pro `dying`-Cluster: gibt zunächst vollständige Quadranten (`progress=100`) frei, dann teilweise
  - Vollständige Quadranten: `quadrant_control` → `controlling_faction=NULL`, `void_cluster_id=NULL`; Void Hive löschen; `size--`
  - Teilweise Quadranten: Eintrag aus `void_cluster_quadrants` löschen, `void_frontier_sectors` für diesen Quadranten löschen
  - Reihenfolge innerhalb: Quadrant mit niedrigstem `progress` zuerst
- Wenn Cluster keine Quadranten mehr hat: `void_clusters`-Row löschen (ON DELETE CASCADE räumt alle abhängigen Rows auf)
- Ziel: natürliches Einpendeln auf ~16–32 aktive Cluster

---

## Frontier-Algorithmus

`void_frontier_sectors` trackt die **aktive Front** für Quadranten mit progress 1–99. Modell: eine Linie die von West nach Ost durch den Quadranten schiebt (simpel, deterministisch, kein Richtungsbezug zur Expansion).

**Berechnung pro Quadrant:**
- Quadrant-Origin: `ox = qx * QUADRANT_SIZE`, `oy = qy * QUADRANT_SIZE` (QUADRANT_SIZE = 10000)
- Frontier-Y: `fy = oy + floor(progress / 100 * QUADRANT_SIZE)`
- Frontier-Sektoren: alle `(x, fy)` für `x` von `ox` bis `ox + 99` → **100 Sektoren** (eine Zeile quer durch den Quadranten)
- Bei `progress = 100`: Frontier löschen (vollständig void, kein Frontier-Lookup nötig)

**Performance:** Nur 100 Rows pro aktivem Quadranten-Tick. `replaceVoidFrontierSectors` löscht die 100 alten Rows für diesen Quadranten und insertet 100 neue — alles in einer Transaktion. Kein vollständiger Disk-Scan nötig.

**Multi-Cluster-Overlap:** Zwei Cluster können frontier-Sektoren an denselben Koordinaten haben. `PRIMARY KEY (cluster_id, x, y)` erlaubt das; `idx_void_frontier_xy` macht den Traversability-Lookup auf `(x, y)` effizient (gibt true zurück wenn irgendein Cluster diesen Sektor als frontier hat). Kein Race-Handling nötig — es reicht, dass mindestens ein Cluster einen Sektor als blockiert markiert.

**Traversability für vollständig eroberte Quadranten:** `isVoidBlocked(x, y, quadrantControls, voidFrontierSet)` prüft:
1. Liegt `(x, y)` in einem Quadranten mit `controlling_faction='voids'`? → blocked (pure Berechnung: `qx = floor(x/10000)`, kein DB-Lookup)
2. Liegt `(x, y)` in `voidFrontierSet`? → blocked
3. Sonst → nicht blockiert

Dieser Algorithmus ist simpel und deterministisch. Er modelliert eine "Front" die sich von Nord nach Süd durch den Quadranten schiebt.

---

## Strukturen-Zerstörung

- Wenn `replaceVoidFrontierSectors` einen Sektor mit Station/Schiff überdeckt → sofortige Zerstörung
- Prüfung: vor dem Insert wird geprüft ob in `sectors` oder `ships` eine Row mit `(x, y)` existiert
- Server sendet `{ code: 'VOID_DESTROYED', message: 'Deine Station wurde von den Voids verschluckt.' }` an betroffene Spieler (via SectorRoom broadcast)
- Schiffe im Void-Sektor ohne Shield → instant kill beim Betreten (wie Todeszone)

---

## Sektortraversierbarkeit

`sectorTraversabilityService` ist eine pure Funktion — Void-Status wird als zusätzlicher Parameter injiziert:

```typescript
// Neue Funktion, separate von getSectorTraversability:
export function isVoidBlocked(
  x: number,
  y: number,
  voidSectorSet: Set<string>,   // Set<"x,y">, vorgeladen aus void_frontier_sectors + quadrant_control
  playerModules: string[],
): boolean {
  if (!voidSectorSet.has(`${x},${y}`)) return false;
  return !playerModules.includes('void_shield');
}
```

Der `voidSectorSet` wird einmal pro Request aus Redis-Cache oder DB geladen (TTL 30s). `findPath` im Autopilot bekommt diesen Set als Parameter.

---

## Void Hive

- 1 Hive pro vollständig erobertem Quadranten (bei `progress=100`), sitzt im Quadrant-Zentrum: `(qx * 10000 + 5000, qy * 10000 + 5000)`
- `station_type = 'void_hive'` (free-text string, kein Enum-Eintrag nötig) in der bestehenden `stations`-Tabelle
- Zusätzliche Spalte `void_cluster_id TEXT` auf `stations` (in Migration 056): ermöglicht `deleteVoidHive` per `WHERE station_type='void_hive' AND x=cx AND y=cy`
- Query-Funktionen: `createVoidHive(qx, qy, clusterId)` + `deleteVoidHive(qx, qy)` in `queries.ts`
- `createVoidHive` wird aufgerufen wenn `progress` eines Quadranten auf 100 springt
- `deleteVoidHive` wird aufgerufen wenn der Quadrant freigegeben wird (Dying, Collision, Hive-Zerstörung)
- Ohne Void Shield: Sektor ist Todeszone → unerreichbar
- Mit Void Shield + Void Gun: Hive via normalen Kampf zerstörbar → bei HP=0: Quadrant freigegeben (`controlling_faction = NULL`, `void_cluster_id = NULL`, `size--`), `deleteVoidHive` aufrufen

---

## Late-Game-Module (Ancient Ruins)

Beide Module nur via `ancientRuinsService` findbar — sehr seltener Drop.

| Modul | Effekt im Void | Effekt im Kampf |
|-------|---------------|-----------------|
| **Void Shield** | Erlaubt Reisen durch Void-Sektoren | Normale Schutzwirkung, aber `-30% defense vs kinetic` |
| **Void Gun** | Kann Void Hives zerstören | Nutzbar als Waffe, nur effektiv vs Void |

Neue `ModuleType`-Einträge in `constants.ts`: `'void_shield'`, `'void_gun'`.

---

## StrategicTickService Integration

Minimale Änderung — `processVoidTick()` nach dem bestehenden `processAlienExpansion`-Block einhängen:

```typescript
// In StrategicTickService.tick() — nach Zeile 73 ("await this.processAlienExpansion(allControls)")
await this.voidLifecycle.tick();   // NEU

// Im Konstruktor:
private voidLifecycle: VoidLifecycleService;
constructor(private redis: Redis) {
  this.factionConfig = new FactionConfigService();
  this.voidLifecycle = new VoidLifecycleService(redis);
}
```

`VoidLifecycleService` kapselt die gesamte Void-Logik (Spawn, Progress, Split, Collision, Die). Es werden keine bestehenden Methoden in `StrategicTickService` umbenannt oder umstrukturiert.

---

## Visualisierung

### QUAD-MAP (Client)

| Zustand | Darstellung |
|---------|-------------|
| Vollständig void (`progress=100`) | Schwarz + kalter blau-weißer Glow-Border (`#050508`, border: `1px solid #aaaacc`, box-shadow: `0 0 4px #ffffff22`) |
| In Eroberung (`progress 1–99`) | Schwarzes Tile, Opacity = `progress/100`, kein Glow |
| Kein Void | Normal (leer, human, alien) |

### Radar (Canvas)

- Sektoren in `void_frontier_sectors` (eigener Quadrant des Spielers): schwarz mit 1px blauem Border (`#aaaacc`)
- Vollständig void-Quadrant: alle Sektoren schwarz, kein Signal

### Comms-Event

Wenn ein Quadrant `progress = 1` erreicht: Alert an alle Spieler in Räumen deren `quadrantX` und `quadrantY` (Room-Parameter) innerhalb von `|qx ± 1|, |qy ± 1|` liegen. Prüfung über `appInstance.driver.matchMaker.query('quadrant_*')` — Räume deren Namen auf den Quadrant-Bereich passen. Kein DB-Lookup nötig.
```
[VOID ALERT] Void-Aktivität in Quadrant X:Y entdeckt. Alle Schiffe evakuieren.
```
Keine aktiven Räume in der Nähe → kein Alert.

---

## Recovery

Wenn Voids einen Quadranten aufgeben (`controlling_faction = NULL`, `void_cluster_id = NULL`):
- Bestehender `StrategicTickService` / `expansionEngine` erkennt freien Raum
- Benachbarte Civ-Fraktionen expandieren automatisch zurück (nach bekanntem Schema)
- Keine zusätzliche Implementierung erforderlich

---

## Neue Dateien

| Datei | Inhalt |
|-------|--------|
| `packages/server/src/engine/voidLifecycleService.ts` | Spawn, Tick, Split, Merge, Die |
| `packages/server/src/db/migrations/056_void_clusters.sql` | Migration |
| `packages/server/src/engine/__tests__/voidLifecycleService.test.ts` | Unit Tests |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `packages/server/src/engine/strategicTickService.ts` | `processVoidTick()` eingehängt |
| `packages/server/src/engine/sectorTraversabilityService.ts` | `isVoidBlocked()` hinzufügen |
| `packages/server/src/db/queries.ts` | `QuadrantControlRow` + 10 neue Void-Query-Funktionen |
| `packages/shared/src/constants.ts` | `void_shield`, `void_gun` ModuleTypes |
| `packages/client/src/...QuadMap...` | Void-Rendering (opacity-Gradient + Glow) |
| `packages/client/src/...RadarRenderer...` | Void-Sektor-Rendering |

---

## Testing

- **Unit**: `VoidLifecycleService` — alle Lifecycle-Zustände (Spawn, Progress, Split bei threshold, Collision, Die bei Pop-Cap)
- **Unit**: Split-Partitionierung — Nearest-Centroid korrekt, isolierte Quadranten werden freigegeben
- **Unit**: Frontier-Algorithmus — depth bei progress=0/50/100, ON CONFLICT handling
- **Unit**: Pop-Cap-Auswahl — älteste Cluster sterben zuerst, korrekte Anzahl
- **Unit**: `isVoidBlocked` — mit/ohne void_shield Modul
- **Integration**: Migration 056 idempotent, `processVoidTick()` im StrategicTickService
- **Client**: QUAD-MAP Void-Rendering (opacity-Gradient, vollständiger Void mit Glow)
- **Client**: Radar Void-Sektor-Rendering
