# Wreck-POIs — Design Spec

**Datum:** 2026-03-13
**Feature:** Wrack-POIs auf dem Radar — Bergung, Data Slates, Jumpgate-Verknüpfung

---

## Ziel

Wrecks sind einmalige, zufällig gespawnte Points of Interest in Sektoren. Spieler finden sie via Scan, untersuchen sie, und versuchen Item für Item zu bergen. Der Explorer-ACEP-Pfad beeinflusst die Erfolgschancen. Data Slates aus Wrecks können Sektoren aufdecken oder Jumpgate-Verbindungen herstellen.

---

## Spielerfluss

```
Local Scan
  → Wreck ⊠ im Sektor gefunden (Name + Größe, kein Inhalt)
    → [UNTERSUCHEN] (2 AP)
      → WreckPanel öffnet: Inhaltsliste mit Bergungschancen in %
      → Alle Items sofort sichtbar (kein progressives Aufdecken — YAGNI)
        → [BERGEN] pro Item (3 AP, Laufbalken ~4–8s)
          → Erfolg: Item → Cargo
          → Misserfolg: Item verloren, Folgeversuche schwieriger
        → Wreck nach allen Versuchen: status = 'exhausted', verschwindet
```

---

## Datenbankschema

### Migration 061: `wrecks`

```sql
CREATE TABLE IF NOT EXISTS wrecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  size TEXT NOT NULL DEFAULT 'small',         -- small | medium | large
  items JSONB NOT NULL DEFAULT '[]',          -- WreckItem[]
  difficulty_modifier FLOAT NOT NULL DEFAULT 0.0,  -- klamped [-0.3, +0.3]
  status TEXT NOT NULL DEFAULT 'intact',      -- intact | investigated | exhausted
  spawned_at TIMESTAMPTZ DEFAULT NOW(),
  exhausted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wrecks_quadrant ON wrecks(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_sector ON wrecks(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_status ON wrecks(status);
```

### Migration 062: `wreck_slate_metadata`

Die existierende `data_slates`-Tabelle (Migration 007+) hat ein anderes Schema (`creator_id`, `slate_type`, `sector_data` JSONB). Wreck-Slates erhalten eine **eigene Metadaten-Tabelle** — der Inventory-Eintrag bleibt `itemType: 'data_slate'`, `itemId: UUID`.

```sql
CREATE TABLE IF NOT EXISTS wreck_slate_metadata (
  id UUID PRIMARY KEY,                  -- entspricht itemId in inventory
  player_id VARCHAR(100) NOT NULL,      -- konsistent mit inventory.player_id
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  sector_type TEXT,
  has_jumpgate BOOLEAN NOT NULL DEFAULT false,
  wreck_tier INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wreck_slate_player ON wreck_slate_metadata(player_id);
```

---

## Typen (shared)

```typescript
// WreckItem.itemType entspricht ItemType — kein 'artefact' als eigener Type.
// Artefakte werden als itemType: 'resource', itemId: 'artefact_drive' etc. gespeichert
// (konsistent mit bestehender addTypedArtefact()-Logik im Server)

interface WreckItem {
  itemType: 'resource' | 'module' | 'blueprint' | 'data_slate';
  // Artefakte: itemType='resource', itemId='artefact_drive'|'artefact_cargo'|etc.
  itemId: string;          // 'ore', 'drive_mk2', UUID für Slates
  quantity: number;
  baseDifficulty: number;  // 0.0–1.0, siehe Tabelle unten
  salvaged: boolean;       // true nach Versuch (egal ob Erfolg oder Misserfolg)
}

type WreckSize = 'small' | 'medium' | 'large';
// small: 2–3 Items, medium: 4–6 Items, large: 7–10 Items

type WreckStatus = 'intact' | 'investigated' | 'exhausted';
// 'exhausted' = alle Items versucht (egal ob geborgen oder verloren)
```

---

## Tier-System

| Distanz von (0,0) in Quadranten | Tier | Loot-Profil |
|---|---|---|
| 0–5 | 1 | Rohstoffe, selten Module |
| 5–15 | 2 | Module, gelegentlich Blueprints |
| 15–30 | 3 | Blueprints, Data Slates |
| 30–60 | 4 | Artefakte, seltene Module |
| 60+ | 5 | Artefakte, Blueprints, Data Slates mit Jumpgate-Sektoren |

---

## Schwierigkeits-Tabelle

| Item-Typ | baseDifficulty | Basiswahrscheinlichkeit |
|---|---|---|
| resource | 0.20 | 80% |
| module | 0.50 | 50% |
| blueprint | 0.70 | 30% |
| artefact (resource) | 0.90 | 10% |
| data_slate | 0.65 | 35% |

**Chance-Formel:**

```typescript
// modifier ist geklammt auf [-0.3, +0.3] (DB-Constraint)
// explorerXp ist geklammt auf [0, 50] (ACEP-Maximum)
function calcChance(item: WreckItem, modifier: number, explorerXp: number): number {
  const base = 1.0 - item.baseDifficulty;
  const explorerBonus = Math.min(explorerXp * 0.005, 0.25);   // max +25% bei 50 XP
  const modBonus = modifier * 0.15;    // [-0.3]*0.15=–0.045 … [+0.3]*0.15=+0.045
  // modBonus negativ → schwieriger (modifier > 0 nach Misserfolg)
  // modBonus positiv → leichter (modifier < 0 nach Erfolg)
  return Math.max(0.05, Math.min(0.95, base + explorerBonus - modBonus));
}
```

**Difficulty-Modifier-Updates nach Versuch:**
- Erfolg: `modifier = Math.max(-0.3, modifier - 0.1)` (leichter)
- Misserfolg: `modifier = Math.min(0.3, modifier + 0.15)` (schwerer)

**ACEP Helion-Decoder (Explorer ≥ 50 XP):**
`calcChance` für Artefakte: Minimum 0.35 statt 0.05 (override der `Math.max(0.05,...)` Klammer).

---

## Spawning — WreckSpawnEngine

Aufgerufen vom `StrategicTickService` alle 10 Ticks (~50s).

```typescript
// packages/server/src/engine/wreckSpawnEngine.ts

async function tickWreckSpawns(db: Pool): Promise<void> {
  // getAllQuadrantControls() existiert bereits in strategicTickService
  const quadrants = await getAllQuadrantControls(db);
  for (const q of quadrants) {
    // Nur 'intact' + 'investigated' zählen — 'exhausted' nicht
    const count = await getActiveWreckCount(db, q.quadrantX, q.quadrantY);
    if (count >= 2) continue;

    const spawnChance = calcSpawnChance(q.quadrantX, q.quadrantY);
    if (Math.random() > spawnChance) continue;

    // Sektor ohne existierendes Wreck und ohne station/pirate_zone in contents
    const sector = await pickRandomWreckableSector(db, q.quadrantX, q.quadrantY);
    if (!sector) continue;

    const tier = calcTier(q.quadrantX, q.quadrantY);
    const size = pickSize(tier);
    const items = generateWreckItems(tier, size);
    await insertWreck(db, { quadrantX: q.quadrantX, quadrantY: q.quadrantY, ...sector, tier, size, items });
  }
}

function calcSpawnChance(qx: number, qy: number): number {
  const dist = Math.sqrt(qx ** 2 + qy ** 2);
  return Math.min(0.02 + dist * 0.0025, 0.20);
}

function calcTier(qx: number, qy: number): number {
  const dist = Math.sqrt(qx ** 2 + qy ** 2);
  if (dist < 5) return 1;
  if (dist < 15) return 2;
  if (dist < 30) return 3;
  if (dist < 60) return 4;
  return 5;
}
```

**`pickRandomWreckableSector`** — neue Query in `wreckQueries.ts`:
Wählt einen zufälligen Sektor im Quadranten, der:
- kein aktives Wreck hat (`status != 'exhausted'` oder kein Eintrag)
- keine `station` oder `pirate_zone` in `sector.contents`
- kein `star` oder `black_hole` als `environment_type`

---

## Server-Architektur

### WreckService (neuer Domain-Service)

Registriert im `ServiceContext`, analog zu `MiningService`.

**Commands:**

| Command | AP | Beschreibung |
|---|---|---|
| `investigateWreck` | 2 | Deckt Wreck-Inhalt auf, setzt status → investigated |
| `startSalvage` | 3 | Startet Bergung eines Items (Redis-Session) |
| `cancelSalvage` | 0 | Bricht laufende Session ab |

**Redis-Session:**
```typescript
// Key: `salvage:${playerId}`
// TTL: duration + 30_000 ms (Crash-Schutz — Session verfällt automatisch)
interface SalvageSession {
  wreckId: string;
  itemIndex: number;
  startedAt: number;
  duration: number;         // ms: small=4000, medium=6000, large=8000
  resolveChance: number;    // finale Chance inkl. Explorer-Bonus + Modifier
}
```

**Edge Cases in `startSalvage`:**
- Cargo voll (bei resource): `actionError: { code: 'CARGO_FULL', message: '...' }` — Bergung verweigert, kein AP-Verbrauch
- Slate-Cap erreicht (bei data_slate): `actionError: { code: 'SLATE_CAP', message: 'Max. 5 Slates im Inventar' }` — Bergung verweigert
- Wreck bereits `exhausted`: `actionError: { code: 'WRECK_GONE', message: '...' }`
- Item bereits `salvaged: true`: `actionError: { code: 'ITEM_DONE', message: '...' }`

**Slate-Cap:** 5 Einträge mit `itemType: 'data_slate'` im Inventory → Bergung eines weiteren Slates verweigert.

**Server → Client Events:**

| Event | Payload |
|---|---|
| `wreckInvestigated` | `{ wreckId, items, size, tier }` |
| `salvageStarted` | `{ wreckId, itemIndex, duration, chance }` |
| `salvageResult` | `{ success, item, cargoUpdate?, newModifier }` |
| `wreckExhausted` | `{ wreckId, sectorX, sectorY }` — Client entfernt ⊠ aus Radar |

### Wreck-Queries (`wreckQueries.ts`)

```typescript
getWreckAtSector(sectorX, sectorY): Promise<Wreck | null>
getActiveWreckCount(qx, qy): Promise<number>        // status IN ('intact','investigated')
insertWreck(data): Promise<Wreck>
updateWreckStatus(wreckId, status): Promise<void>
updateWreckItem(wreckId, itemIndex, salvaged): Promise<void>
updateWreckModifier(wreckId, modifier): Promise<void>
pickRandomWreckableSector(qx, qy): Promise<{sectorX,sectorY} | null>

// Data Slates
insertWreckSlateMetadata(data: WreckSlateMetadata): Promise<void>
getWreckSlateMetadata(slateId: string): Promise<WreckSlateMetadata | null>
```

---

## Client-UI

### LocalScanResultOverlay (erweitert)

Zeigt Wreck-Eintrag wenn vorhanden:
```
WRECKS
  ⊠ WRACK-3 [MITTELGROSS]    [UNTERSUCHEN]
```

### WreckPanel (neu, Sec 3 — Detail Monitor)

Öffnet nach `wreckInvestigated`:
```
⊠ WRACK — TIER 3 · MITTELGROSS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FRACHT               CHANCE
  ────────────────────────────
  ORE ×12              78%    [BERGEN]
  drive_mk2            41%    [BERGEN]
  blueprint: laser_mk3 18%    [BERGEN]
  ARTEFAKT (drive)      7%    [BERGEN]
  DATA SLATE ◈         22%    [BERGEN]
  ────────────────────────────
                       [SCHLIESSEN]
```

Während Bergung (Laufbalken ersetzt Button):
```
  drive_mk2            41%
  ████████░░░░░░░░  BERGUNG...  4s
```

Nach Ergebnis:
```
  drive_mk2  ✓ GEBORGEN    (grün, button weg)
  drive_mk2  ✗ VERLOREN    (rot, button weg)
```

### Radar-Icon & Client-State

- Wrecks erscheinen als `⊠` in gedimmtem Amber im Radar-Canvas.
- `localScanResult` liefert optional `wreck: { wreckId, size, tier } | null` mit.
- Client-Store (`gameSlice`) erhält `sectorWrecks: Record<string, WreckInfo>` (Key: `${x}:${y}`).
- Bei `wreckExhausted`: Eintrag aus `sectorWrecks` entfernen → RadarRenderer zeigt kein Icon mehr.

---

## Data Slate Mechanik

**Inventory:** `itemType: 'data_slate'`, `itemId: UUID` (lookup via `wreck_slate_metadata`)
**Cap:** max 5 Slates (geprüft in `startSalvage` vor Bergungsstart)

### 3 Aktionen:

**A — Consume (Sektor aufdecken)**
- Slate + Metadata-Eintrag entfernen
- Sektor → `scanned_sectors` des Spielers (wie normaler Scan)
- Sektor auf Radar sichtbar, Hyperjump möglich
- Log: `DATA SLATE KONSUMIERT — Sektor (88, 203) aufgedeckt`

**B — Verkaufen (an Station)**
- Preis: `50 + tier * 75` Credits (Tier aus `wreck_slate_metadata.wreck_tier`)
- Trade-Screen listet Slates als verkaufbare Items
- Slate + Metadata entfernen nach Verkauf

**C — Jumpgate einspeisen** (nur wenn `has_jumpgate: true`)
- Spieler muss sich an einem menschlichen Jumpgate befinden
- Neue Verbindung zum Ziel-Sektor (Reichweite abhängig von Gate-Level)
- Bei Überschreitung Reichweite: `actionError: { code: 'GATE_OUT_OF_RANGE' }`
- Slate consumed, Humanity-Pool +25 CR
- UI im NavDetailPanel (wenn Spieler bei Jumpgate):

```
[◈ SLATE EINSPEISEN]  → Slate-Auswahl → Gate verbindet sich
```

---

## ACEP-Integration

| Explorer-XP | Effekt |
|---|---|
| 0–50 XP | +0.5% Bergungschance pro XP (max +25%) |
| ≥ 25 XP | Wreck-Detection: Tier-4/5-Wrecks auf Radar ohne Local Scan sichtbar (eigenes Flag `wreckDetection` in `AcepEffects`, getrennt von `ancientDetection`) |
| 50 XP | Helion-Decoder: Artefakt-Bergung Minimum 35% statt 5% |

---

## Neue Dateien

| Datei | Beschreibung |
|---|---|
| `packages/server/src/db/migrations/061_wrecks.sql` | wrecks Tabelle |
| `packages/server/src/db/migrations/062_wreck_slate_metadata.sql` | wreck_slate_metadata Tabelle |
| `packages/server/src/engine/wreckSpawnEngine.ts` | Spawn-Logik, Loot-Generierung |
| `packages/server/src/rooms/services/WreckService.ts` | investigate, salvage, cancel |
| `packages/server/src/db/wreckQueries.ts` | Wreck-DB-Operationen |
| `packages/client/src/components/WreckPanel.tsx` | Bergungs-UI |

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `packages/shared/src/constants.ts` | Wreck-Konstanten (Difficulty, Tiers, Spawn-Chancen) |
| `packages/shared/src/types.ts` | WreckItem, WreckSize, WreckStatus, WreckInfo Interfaces; `wreckDetection` in AcepEffects |
| `packages/server/src/rooms/services/StrategicTickService.ts` | wreckSpawnEngine-Aufruf alle 10 Ticks |
| `packages/server/src/rooms/SectorRoom.ts` | WreckService registrieren |
| `packages/client/src/state/store.ts` | `sectorWrecks` State, wreckExhausted Handler |
| `packages/client/src/network/client.ts` | Event-Handler für wreckInvestigated, salvageStarted, salvageResult, wreckExhausted |
| `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` | Wreck-Eintrag + Untersuchen-Button |
| `packages/client/src/canvas/RadarRenderer.ts` | ⊠ Wreck-Icon, sectorWrecks aus Store |
| `packages/client/src/components/NavTargetPanel.tsx` | Slate-Einspeisen-Button bei Jumpgate |
| `packages/shared/src/acepEngine.ts` | `wreckDetection` Flag zu AcepEffects |
