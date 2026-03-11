# Die Voids — Design Spec

**Datum:** 2026-03-11
**Issue:** #267
**Status:** APPROVED
**Abhängig von:** Migration 044 (Forschung & Wissen), Phase EW (StrategicTickService)

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

## Datenmodell (Migration 045)

### Neue Tabellen

```sql
-- Cluster-Metadaten
CREATE TABLE IF NOT EXISTS void_clusters (
  id               TEXT PRIMARY KEY,        -- z.B. 'vc_1741000001'
  state            TEXT NOT NULL,           -- 'growing' | 'splitting' | 'dying'
  size             INT NOT NULL DEFAULT 0,  -- Anzahl vollständig eroberter Quadranten
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

-- Frontier-Ring: echte Sektor-Koordinaten (nur aktive Quadranten)
CREATE TABLE IF NOT EXISTS void_frontier_sectors (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  x           INT NOT NULL,
  y           INT NOT NULL,
  PRIMARY KEY (x, y)
);
```

### Änderung an bestehender Tabelle

```sql
ALTER TABLE quadrant_control
  ADD COLUMN IF NOT EXISTS void_cluster_id TEXT REFERENCES void_clusters(id);
```

`controlling_faction = 'voids'` + `void_cluster_id` identifiziert vollständig eroberte Quadranten.

---

## Void-Lifecycle

```
SPAWN → GROWING → (size >= split_threshold) → SPLITTING
                                                    ↓
                                          2–3 neue Cluster (GROWING)
                                                    ↓
                                          (collision) → SHRINK → GROWING
                                                    ↓
                                          (Pop-Cap > 48) → DYING
```

### Spawn

- Geprüft alle 4 Stunden im `VoidLifecycleService`
- Bedingung: globale Cluster-Anzahl < 32
- Spawn-Punkt: unbeanspruchter Quadrant, ≥ 50 Quadranten Mindestabstand von jedem Spieler/Civ
- Neuer Cluster: `state='growing'`, `split_threshold = random(8, 16)`, Void Hive im Origin-Quadranten

### Growing

- Pro StrategicTick (+60s): `progress += 1` für alle aktiven Quadranten jedes `growing`-Clusters
- Bei `progress = 100`: Quadrant vollständig — `quadrant_control` erhält `controlling_faction='voids'` + `void_cluster_id`, `size++`
- Expansion in Nachbar-Quadrant: wenn `size` gestiegen ist, wird ein neuer Nachbar-Quadrant (inkl. fremde Fraktionen — Voids machen keinen Halt) in `void_cluster_quadrants` eingetragen (`progress=0`)
- Frontier-Ring: `void_frontier_sectors` wird proportional zu `progress` befüllt (~100 Sektoren Rand, skaliert mit `progress/100`)

### Splitting

- Trigger: `size >= split_threshold`
- Cluster teilt sich in 2–3 Sub-Cluster (random)
- Mittlere Quadranten: `controlling_faction = NULL`, `void_cluster_id = NULL` → frei für Recovery
- Äußere Quadranten: auf neue Cluster-IDs aufgeteilt
- Jeder neue Cluster: `state='growing'`, neuer `split_threshold = random(8, 16)`

### Collision

- Trigger: zwei Cluster mit benachbarten Quadranten
- Äußere Quadranten beider Cluster werden aufgegeben (freigegeben)
- Übrig: 4–6 Quadranten pro Cluster
- Beide Cluster: `state='growing'`, fortsetzen

### Dying (Pop-Cap)

- Globale Cluster-Anzahl > 48: betroffene Cluster wechseln zu `state='dying'`
- Pro Tick: Cluster gibt 1 Quadrant auf (`controlling_faction = NULL`)
- Ziel: natürliches Einpendeln auf 16–32 aktive Cluster
- Sterberate erhöht sich proportional über 48 (`> 48` = moderat, `> 64` = aggressiv)

---

## Strukturen-Zerstörung

- Frontier-Ring rückt über Sektor mit Station/Schiff → sofortige Zerstörung
- Server sendet `{ code: 'VOID_DESTROYED', message: 'Deine Station wurde von den Voids verschluckt.' }` an betroffenen Spieler
- Schiffe im Void-Sektor ohne Shield → instant kill (Todeszone)

---

## Sektortraversierbarkeit

- Void-Sektoren (`void_frontier_sectors` oder `controlling_faction='voids'`) → `traversable: false`
- Ausnahme: Spieler mit **Void Shield**-Modul → `traversable: true`
- Autopilot weicht Void-Sektoren automatisch aus

---

## Void Hive

- 1 Hive pro Quadrant, sitzt im Quadrant-Zentrum
- `station_type = 'void_hive'` in der Stations-Tabelle
- Ohne Void Shield: Sektor unerreichbar
- Mit Void Shield + Void Gun: Hive zerstörbar → Quadrant wird freigegeben (`controlling_faction = NULL`)

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

Minimale Änderung — neuer Aufruf in `tick()`:

```typescript
async tick(repStore: RepStore): Promise<void> {
  await this.processArrivedFleets();
  const allControls = await getAllQuadrantControls();
  await this.processBorderFriction(allControls, repStore);
  await this.processAlienExpansion(allControls);
  await this.processVoidTick();   // NEU — delegiert an VoidLifecycleService
  await processWissenTick(60_000);
}
```

`VoidLifecycleService` kapselt die gesamte Void-Logik (Spawn, Progress, Split, Merge, Die).

---

## Visualisierung

### QUAD-MAP (Client)

| Zustand | Darstellung |
|---------|-------------|
| Vollständig void (`progress=100`) | Schwarz + kalter blau-weißer Glow-Border |
| In Eroberung (`progress 1–99`) | Schwarzes Tile, Opacity = `progress/100`, Rand pulsiert |
| Frontier-Quadrant (frisch gestartet) | Leichter schwarzer Schimmer |

### Radar (Canvas)

- Sektoren in `void_frontier_sectors`: schwarz mit 1px blauem Border
- Vollständig void: reines Schwarz, kein Signal

### Comms-Event

Wenn Void-Progress auf 1% in einem Quadranten adjacent zu einem Spieler steigt:
```
[VOID ALERT] Void-Aktivität in Quadrant X:Y entdeckt. Alle Schiffe evakuieren.
```

---

## Recovery

Wenn Voids einen Quadranten aufgeben (`controlling_faction = NULL`):
- Bestehender `StrategicTickService` / `expansionEngine` erkennt freien Raum
- Benachbarte Civ-Fraktionen expandieren automatisch zurück (nach bekanntem Schema)
- Keine zusätzliche Implementierung erforderlich

---

## Neue Dateien

| Datei | Inhalt |
|-------|--------|
| `packages/server/src/engine/voidLifecycleService.ts` | Spawn, Tick, Split, Merge, Die |
| `packages/server/src/db/migrations/045_void_clusters.sql` | Migration |
| `packages/server/src/engine/__tests__/voidLifecycleService.test.ts` | Unit Tests |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `packages/server/src/engine/strategicTickService.ts` | `processVoidTick()` eingehängt |
| `packages/server/src/engine/sectorTraversabilityService.ts` | Void-Check |
| `packages/shared/src/constants.ts` | `void_shield`, `void_gun` ModuleTypes |
| `packages/client/src/...QuadMap...` | Void-Rendering |
| `packages/client/src/...RadarRenderer...` | Void-Sektor-Rendering |

---

## Testing

- **Unit**: `VoidLifecycleService` — alle Lifecycle-Zustände (Spawn, Progress, Split bei threshold, Collision, Die bei Pop-Cap)
- **Unit**: Frontier-Sektor-Befüllung bei verschiedenen Progress-Werten
- **Unit**: Pop-Cap-Sterberate (moderat über 48, aggressiv über 64)
- **Integration**: Migration 045, `processVoidTick()` im StrategicTickService
- **Client**: QUAD-MAP Void-Rendering (opacity-Gradient, vollständiger Void)
- **Client**: Radar Void-Sektor-Rendering
