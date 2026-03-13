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
        → [BERGEN] pro Item (3 AP, Laufbalken ~4–8s)
          → Erfolg: Item → Cargo
          → Misserfolg: Item verloren, Folgeversuche schwieriger
        → Wreck nach allen Versuchen: verschwunden
```

---

## Datenbankschema

### Migration 061: `wrecks`

```sql
CREATE TABLE wrecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  size TEXT NOT NULL DEFAULT 'small',        -- small | medium | large
  items JSONB NOT NULL DEFAULT '[]',         -- WreckItem[]
  difficulty_modifier FLOAT NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'intact',     -- intact | investigated | salvaged
  spawned_at TIMESTAMPTZ DEFAULT NOW(),
  salvaged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wrecks_quadrant ON wrecks(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_sector ON wrecks(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_status ON wrecks(status);
```

### Migration 061: `data_slates`

```sql
CREATE TABLE data_slates (
  id UUID PRIMARY KEY,
  player_id TEXT NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  sector_type TEXT,
  has_jumpgate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_slates_player ON data_slates(player_id);
```

---

## Typen (shared)

```typescript
interface WreckItem {
  itemType: 'resource' | 'module' | 'blueprint' | 'artefact' | 'data_slate';
  itemId: string;          // 'ore', 'drive_mk2', UUID für Slates
  quantity: number;
  baseDifficulty: number;  // 0.0–1.0
  salvaged: boolean;
}

type WreckSize = 'small' | 'medium' | 'large';
// small: 2–3 Items, medium: 4–6 Items, large: 7–10 Items

type WreckStatus = 'intact' | 'investigated' | 'salvaged';
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
| artefact | 0.90 | 10% |
| data_slate | 0.65 | 35% |

**Chance-Formel:**
```typescript
function calcChance(item: WreckItem, modifier: number, explorerXp: number): number {
  const base = 1.0 - item.baseDifficulty;
  const explorerBonus = Math.min(explorerXp * 0.005, 0.25);  // max +25% bei 50 XP
  const modBonus = modifier * 0.15;                           // -0.045…+0.045
  return Math.max(0.05, Math.min(0.95, base + explorerBonus + modBonus));
}
```

**Difficulty-Modifier-Updates:**
- Erfolg: `modifier -= 0.1` (max -0.3)
- Misserfolg: `modifier += 0.15` (max +0.3)

---

## Spawning — WreckSpawnEngine

Aufgerufen vom `StrategicTickService` alle 10 Ticks (~50s):

```typescript
async function tickWreckSpawns(db: Pool): Promise<void> {
  const activeQuadrants = await getActiveQuadrants(db);
  for (const q of activeQuadrants) {
    const count = await getActiveWreckCount(db, q.x, q.y);
    if (count >= 2) continue;

    const spawnChance = calcSpawnChance(q.x, q.y);
    if (Math.random() > spawnChance) continue;

    const sector = await pickRandomEmptySector(db, q.x, q.y);
    const tier = calcTier(q.x, q.y);
    const size = pickSize(tier);
    const items = generateWreckItems(tier, size);
    await insertWreck(db, { quadrantX: q.x, quadrantY: q.y, ...sector, tier, size, items });
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
interface SalvageSession {
  wreckId: string;
  itemIndex: number;
  startedAt: number;
  duration: number;    // ms: small=4000, medium=6000, large=8000
  resolveChance: number;
}
```

**Server → Client Events:**

| Event | Payload |
|---|---|
| `wreckInvestigated` | `{ wreckId, items, size, tier }` |
| `salvageStarted` | `{ wreckId, itemIndex, duration, chance }` |
| `salvageResult` | `{ success, item, cargoUpdate, newModifier }` |
| `wreckDepleted` | `{ wreckId, sectorX, sectorY }` |

### Wreck-Queries (queries.ts)

```typescript
getWreckAtSector(sectorX, sectorY): Promise<Wreck | null>
getActiveWreckCount(qx, qy): Promise<number>
insertWreck(data): Promise<Wreck>
updateWreckInvestigated(wreckId): Promise<void>
updateWreckItem(wreckId, itemIndex, salvaged): Promise<void>
updateWreckDifficultyModifier(wreckId, modifier): Promise<void>
markWreckSalvaged(wreckId): Promise<void>
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

Öffnet nach `investigateWreck`:
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
  drive_mk2  ✓ GEBORGEN    (grün, Button weg)
  drive_mk2  ✗ VERLOREN    (rot, Button weg)
```

### Radar-Icon

Wrecks erscheinen als `⊠` im Radar-Canvas (gedimmtes Amber). Sichtbar nach Local Scan des Sektors. Verschwindet nach `wreckDepleted`.

---

## Data Slate Mechanik

**Inventory:** `itemType: 'data_slate'`, `itemId: slateId (UUID)`
**Cap:** max 5 Slates im Inventar (digital — kein Cargo-Platz)

### 3 Aktionen:

**A — Consume (Sektor aufdecken)**
- Slate aus Inventory entfernen
- Sektor → `scanned_sectors` des Spielers (wie normaler Scan)
- Sektor auf Radar sichtbar, Hyperjump möglich
- Log: `DATA SLATE KONSUMIERT — Sektor (88, 203) aufgedeckt`

**B — Verkaufen (an Station)**
- Preis: `50 + tier * 75` Credits
- Via bestehendem Trade/Economy-System

**C — Jumpgate einspeisen** (nur wenn `has_jumpgate: true`)
- Spieler muss sich an einem menschlichen Jumpgate befinden
- Neue Verbindung zum Ziel-Sektor (Reichweite abhängig von Gate-Level)
- Slate consumed
- Humanity-Pool: +25 CR (Infrastruktur-Gebühr)
- Bei Überschreitung Reichweite: `actionError: ZIEL AUSSERHALB REICHWEITE`

UI im NavDetailPanel (wenn Spieler bei Jumpgate):
```
[◈ SLATE EINSPEISEN]  → Slate-Auswahl → Gate verbindet sich
```

---

## ACEP-Integration

| Explorer-XP | Effekt |
|---|---|
| 0–50 XP | +0.5% Bergungschance pro XP (max +25%) |
| 25 XP | Ancient-Detection: Tier-4/5-Wrecks auf Radar ohne Scan sichtbar |
| 50 XP | Helion-Decoder: Artefakt-Bergung cap auf 35% statt 10% |

---

## Neue Dateien

| Datei | Typ | Beschreibung |
|---|---|---|
| `packages/server/src/db/migrations/061_wrecks.sql` | Migration | wrecks + data_slates Tabellen |
| `packages/server/src/engine/wreckSpawnEngine.ts` | Engine | Spawn-Logik, Loot-Generierung |
| `packages/server/src/rooms/services/WreckService.ts` | Service | investigate, salvage, cancel |
| `packages/server/src/db/wreckQueries.ts` | Queries | Wreck-DB-Operationen |
| `packages/client/src/components/WreckPanel.tsx` | Component | Bergungs-UI |

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `packages/shared/src/constants.ts` | WreckItem-Typen, Difficulty-Konstanten |
| `packages/shared/src/types.ts` | Wreck, WreckItem, DataSlate Interfaces |
| `packages/server/src/rooms/services/StrategicTickService.ts` | wreckSpawnEngine-Aufruf |
| `packages/server/src/rooms/SectorRoom.ts` | WreckService registrieren |
| `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` | Wreck-Eintrag + Untersuchen-Button |
| `packages/client/src/components/NavTargetPanel.tsx` | Slate-Einspeisen-Button |
| `packages/client/src/canvas/RadarRenderer.ts` | ⊠ Wreck-Icon |
| `packages/client/src/state/store.ts` | wreck/slate State |
| `packages/client/src/network/client.ts` | neue Event-Handler |
