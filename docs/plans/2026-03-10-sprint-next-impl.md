# Sprint Next — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 8 offene Issues implementieren: case-insensitive Usernames, Admin-Autocomplete, Kernwelt, Sim-Config + Expansion-Log, Admin-QMap Deep Zoom, immersiver Area-Scan, Trade-UI-Redesign, Quest-Journal.

**Architecture:** TypeScript Monorepo — `packages/shared` (Typen/Konstanten), `packages/server` (Colyseus, PostgreSQL, Redis), `packages/client` (React, Zustand, Canvas). Alle DB-Änderungen via Migrations in `packages/server/src/db/migrations/`. Admin-UI ist vanilla HTML/JS in `packages/server/src/admin/console.html`.

**Tech Stack:** Node.js 20, PostgreSQL 16, Redis 7, React 18, Zustand, Vitest, HTML Canvas.

**Wichtige Pfade:**
- DB-Queries: `packages/server/src/db/queries.ts`
- Migrations: `packages/server/src/db/migrations/` (nächste: 045, 046, 047)
- Admin HTML: `packages/server/src/admin/console.html`
- Universe Bootstrap: `packages/server/src/engine/universeBootstrap.ts`
- Universe Tick: `packages/server/src/engine/universeTickEngine.ts`
- Strategic Tick: `packages/server/src/engine/strategicTickService.ts`
- QuadMap: `packages/client/src/components/QuadMapScreen.tsx`
- Scan Animation: `packages/client/src/canvas/ScanAnimation.ts`
- Radar Canvas: `packages/client/src/components/RadarCanvas.tsx`
- Trade Screen: `packages/client/src/components/TradeScreen.tsx`
- Quests Screen: `packages/client/src/components/QuestsScreen.tsx`
- Game Slice: `packages/client/src/state/gameSlice.ts`
- Network Client: `packages/client/src/network/client.ts`

**Tests laufen immer so:**
```bash
cd packages/server && npx vitest run   # ~912 tests
cd packages/client && npx vitest run   # ~498 tests
cd packages/shared && npx vitest run   # ~191 tests
```

---

## Task 1: #210 — Usernames case insensitive

**Files:**
- Create: `packages/server/src/db/migrations/045_username_case_insensitive.sql`
- Modify: `packages/server/src/db/queries.ts` (eine Stelle)

**Kontext:** `findPlayerByUsername` verwendet bereits `LOWER(username) = LOWER($1)` korrekt. Aber der DB-Unique-Constraint ist noch case-sensitiv (`username VARCHAR(32) UNIQUE NOT NULL` in Migration 001). Außerdem gibt es in `queries.ts` eine zweite Stelle (ca. Zeile 1056) die `username = $1` ohne LOWER verwendet.

**Step 1: Migration schreiben**

Erstelle `packages/server/src/db/migrations/045_username_case_insensitive.sql`:
```sql
-- Drop the old case-sensitive unique constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_username_key;

-- Add a case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS players_username_lower_key ON players (lower(username));
```

**Step 2: Zweite Query-Stelle fixen**

In `packages/server/src/db/queries.ts` um Zeile 1056 gibt es:
```ts
'SELECT id FROM players WHERE username = $1'
```
Ändern zu:
```ts
'SELECT id FROM players WHERE LOWER(username) = LOWER($1)'
```

**Step 3: Tests laufen**
```bash
cd packages/server && npx vitest run --reporter=verbose 2>&1 | grep -E "PASS|FAIL|username"
```

**Step 4: Commit**
```bash
git add packages/server/src/db/migrations/045_username_case_insensitive.sql packages/server/src/db/queries.ts
git commit -m "fix: usernames case insensitive — lower() unique index + consistent queries (#210)"
```

---

## Task 2: #211 — Admin Cargo-Items Autocomplete

**Files:**
- Modify: `packages/server/src/admin/console.html` (ca. Zeile 1186–1199)

**Kontext:** Die Admin-Console ist pure HTML/JS (kein React). Der Cargo-Edit-Bereich hat ein `<input type="text">` für den Ressourcennamen. Wir ersetzen es durch ein `<input list="..."> + <datalist>` mit allen bekannten Item-Keys.

**Step 1: Datalist-HTML hinzufügen**

Direkt nach dem öffnenden `<body>` oder einmalig im HTML (vor dem `</body>`), eine `<datalist id="cargo-items">` einfügen mit allen Resource-Keys. Die Liste wird per Script aus den bekannten Werten gebaut (da die HTML-Datei statisch ist, werden die Keys hardcoded).

Füge im `<head>` oder vor `</body>` ein:
```html
<datalist id="cargo-items">
  <option value="ore">
  <option value="gas">
  <option value="crystal">
  <option value="artefact">
  <option value="artefact_drive">
  <option value="artefact_cargo">
  <option value="artefact_scanner">
  <option value="artefact_armor">
  <option value="artefact_weapon">
  <option value="artefact_shield">
  <option value="artefact_defense">
  <option value="artefact_special">
  <option value="artefact_mining">
  <option value="fuel">
  <option value="credits">
</datalist>
```

**Step 2: Input-Element anpassen**

Suche die Zeile:
```js
var inputRes = el('input', { type: 'text', style: 'width:100px', placeholder: 'resource' });
```
Ändern zu:
```js
var inputRes = el('input', { type: 'text', list: 'cargo-items', style: 'width:140px', placeholder: 'resource...' });
```

**Step 3: Manuell testen**
- Server starten: `npm run dev:server`
- http://localhost:2567/admin aufrufen
- Spieler aufklappen → Cargo-Edit → ins Resource-Feld klicken → Autocomplete erscheint

**Step 4: Commit**
```bash
git add packages/server/src/admin/console.html
git commit -m "fix: admin cargo input — datalist autocomplete for item keys (#211)"
```

---

## Task 3: #215 — Kernwelt

**Files:**
- Modify: `packages/server/src/engine/universeBootstrap.ts`
- Modify: `packages/server/src/db/queries.ts` (neue Funktion `ensureKernweltStation`)
- Modify: `packages/server/src/engine/strategicTickService.ts` (Guard für Quadrant-Namen)

**Kontext:** Beim Server-Start soll Sektor (0,0) immer eine NPC-Station namens "Zuhause" haben, und Quadrant (0,0) soll immer "Zentrum" heißen.

**Step 1: DB-Query für Kernwelt-Station schreiben**

In `packages/server/src/db/queries.ts`, neue Funktion am Ende hinzufügen:
```ts
export async function ensureKernweltStation(): Promise<void> {
  // Ensure sector (0,0) has an NPC station named "Zuhause"
  await query(`
    INSERT INTO sectors (x, y, type, resources, discovered_by, discovered_at)
    VALUES (0, 0, 'station', '{}', NULL, NOW())
    ON CONFLICT (x, y) DO UPDATE SET type = 'station'
  `);
  // Ensure the station entry exists in npc_stations
  await query(`
    INSERT INTO npc_stations (sector_x, sector_y, name, faction)
    VALUES (0, 0, 'Zuhause', 'human')
    ON CONFLICT (sector_x, sector_y) DO UPDATE SET name = 'Zuhause', faction = 'human'
  `);
}

export async function ensureZentrumQuadrant(): Promise<void> {
  // Quadrant (0,0) is always named "Zentrum"
  await query(`
    INSERT INTO quadrant_control (qx, qy, controlling_faction, faction_shares, attack_value, defense_value, friction_score, station_tier)
    VALUES (0, 0, 'human', '{"human": 100}', 0, 100, 0, 1)
    ON CONFLICT (qx, qy) DO NOTHING
  `);
  // Set name — quadrant naming is stored in quadrants table or quadrant_control
  await query(`
    UPDATE quadrant_control SET name = 'Zentrum' WHERE qx = 0 AND qy = 0
  `).catch(() => {
    // name column may not exist yet — ignore, will be added if needed
  });
}
```

> **Note:** Prüfe zuerst ob `npc_stations` eine Spalte `faction` hat und ob `sectors` eine `ON CONFLICT (x, y)` Constraint hat. Passe die Queries ggf. an die tatsächliche Schema-Struktur an (lies `packages/server/src/db/migrations/008_npc_ecosystem.sql` und `001_initial.sql`).

**Step 2: universeBootstrap.ts aufrufen**

In `packages/server/src/engine/universeBootstrap.ts`, am Anfang von `startUniverseEngine()`:
```ts
import { ensureKernweltStation, ensureZentrumQuadrant } from '../db/queries.js';

export async function startUniverseEngine(): Promise<void> {
  // Kernwelt: ensure "Zuhause" station at (0,0) and "Zentrum" quadrant
  await ensureKernweltStation();
  await ensureZentrumQuadrant();
  logger.info('Kernwelt seeded: Zuhause@(0,0), Zentrum quadrant');

  // ... rest of existing code ...
}
```

**Step 3: Quadrant-Namen-Guard (verhindert Überschreiben durch First-Contact)**

Suche in der Codebase die First-Contact-Naming-Logik:
```bash
grep -rn "nameQuadrant\|firstContact\|quadrant.*name\|name.*quadrant" packages/server/src --include="*.ts" | head -10
```

Wo immer Quadrant-Namen gesetzt werden, füge einen Guard hinzu:
```ts
if (qx === 0 && qy === 0) return; // "Zentrum" is protected
```

**Step 4: Tests**
```bash
cd packages/server && npx vitest run
```

**Step 5: Commit**
```bash
git add packages/server/src/engine/universeBootstrap.ts packages/server/src/db/queries.ts
git commit -m "feat: Kernwelt — station Zuhause at (0,0), quadrant Zentrum always seeded (#215)"
```

---

## Task 4: #207 — Sim-Config + Expansion Log

**Files:**
- Create: `packages/server/src/db/migrations/046_expansion_log.sql`
- Create: `.env.sim`
- Modify: `packages/server/src/engine/universeBootstrap.ts`
- Modify: `packages/server/src/engine/universeTickEngine.ts`
- Modify: `packages/server/src/engine/strategicTickService.ts`
- Modify: `packages/server/src/rooms/services/NavigationService.ts`
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/package.json`

### Teil A: Expansion Log Migration

**Step 1: Migration schreiben**

Erstelle `packages/server/src/db/migrations/046_expansion_log.sql`:
```sql
CREATE TABLE IF NOT EXISTS expansion_log (
  id      SERIAL PRIMARY KEY,
  ts      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  faction TEXT NOT NULL,
  qx      INT NOT NULL,
  qy      INT NOT NULL,
  event   TEXT NOT NULL
  -- event values: 'colonized' | 'conquered' | 'lost' | 'discovered'
);

CREATE INDEX IF NOT EXISTS idx_expansion_log_ts ON expansion_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_expansion_log_faction ON expansion_log (faction);
```

**Step 2: Query-Funktion hinzufügen**

In `packages/server/src/db/queries.ts`:
```ts
export async function logExpansionEvent(
  faction: string,
  qx: number,
  qy: number,
  event: 'colonized' | 'conquered' | 'lost' | 'discovered',
): Promise<void> {
  await query(
    'INSERT INTO expansion_log (faction, qx, qy, event) VALUES ($1, $2, $3, $4)',
    [faction, qx, qy, event],
  );
}
```

### Teil B: Sim-Config Env-Vars

**Step 3: `.env.sim` erstellen**

Erstelle `.env.sim` im Root:
```env
# Sim-Config — 10× speed for universe simulation testing
TICK_MULTIPLIER=10
ALIEN_EXPANSION_RATE_MUL=10
ALIEN_AGGRESSION_MUL=2
FIRST_CONTACT_MIN_QDIST=3
```

**Step 4: npm sim:server script**

In `packages/server/package.json`, im `scripts`-Abschnitt:
```json
"sim:server": "node --env-file=../../.env.sim --env-file=.env dist/index.js"
```
(Oder mit tsx für dev: `"sim:server": "tsx --env-file=../../.env.sim src/index.ts"`)

> Prüfe wie `dev:server` aktuell läuft und verwende denselben Ansatz.

### Teil C: Tick-Multiplikator

**Step 5: universeTickEngine.ts anpassen**

Lese `packages/server/src/engine/universeTickEngine.ts`. Suche die Tick-Interval-Konstante (wahrscheinlich `5000` ms). Ersetze mit:
```ts
const TICK_MULTIPLIER = parseFloat(process.env.TICK_MULTIPLIER ?? '1');
const TICK_INTERVAL_MS = Math.round(5000 / TICK_MULTIPLIER);
```

**Step 6: StrategicTickService — Expansion-Rate-Multiplier**

In `packages/server/src/engine/strategicTickService.ts`, `processAlienExpansion()`:
```ts
const EXPANSION_RATE_MUL = parseFloat(process.env.ALIEN_EXPANSION_RATE_MUL ?? '1');
const AGGRESSION_MUL = parseFloat(process.env.ALIEN_AGGRESSION_MUL ?? '1');

// Bei Faction-Config-Nutzung:
const aggression = (factionCfg?.aggression ?? 1.0) * AGGRESSION_MUL;
const eta = new Date(Date.now() + (faction.expansion_rate / EXPANSION_RATE_MUL) * 60_000);
```

### Teil D: Expansion Events loggen

**Step 7: Conquest-Event loggen**

In `strategicTickService.ts`, `processWarfareTick()`, nach dem conquest-`upsertQuadrantControl`:
```ts
import { logExpansionEvent } from '../db/queries.js';

// Nach conquest:
await logExpansionEvent(alienFaction, humanQ.qx, humanQ.qy, 'conquered');
await logExpansionEvent('human', humanQ.qx, humanQ.qy, 'lost');
```

**Step 8: Colonization-Event loggen**

Suche wo NPC-Fleets ankommen und einen leeren Quadranten besiedeln. Prüfe:
```bash
grep -n "deleteArrivedNpcFleets\|fleet.*arrive\|arrive.*fleet\|colonize" packages/server/src --include="*.ts" -r | head -10
```
Füge dort `logExpansionEvent(faction, qx, qy, 'colonized')` hinzu.

**Step 9: Discovery-Event loggen**

In `packages/server/src/rooms/services/NavigationService.ts`, suche wo Quadrant-Wechsel passiert (cross-quadrant join). Dort:
```ts
// Wenn Spieler erstmals einen Quadranten betritt:
const isNew = /* check if quadrant exists in player_known_quadrants */;
if (isNew) {
  await logExpansionEvent('human', newQx, newQy, 'discovered');
}
```

**Step 10: Tests**
```bash
cd packages/server && npx vitest run
```

**Step 11: Commit**
```bash
git add packages/server/src/db/migrations/046_expansion_log.sql packages/server/src/db/queries.ts packages/server/src/engine/universeBootstrap.ts packages/server/src/engine/universeTickEngine.ts packages/server/src/engine/strategicTickService.ts packages/server/src/rooms/services/NavigationService.ts packages/server/package.json .env.sim
git commit -m "feat: sim-config env vars + expansion_log table for universe simulation (#207)"
```

---

## Task 5: #212 — Admin QMap Deep Zoom

**Files:**
- Modify: `packages/client/src/components/QuadMapScreen.tsx`
- Modify: `packages/shared/src/constants.ts` (QUAD_CELL_SIZES erweitern)

**Kontext:** `QuadMapScreen.tsx` hat `zoomLevel` state (0–3) und `QUAD_CELL_SIZES` aus shared/constants. Buttons sind `disabled={zoomLevel === 0}` und `disabled={zoomLevel === 3}`. Die Deep-Zoom-Stufen (250×, 1000×) sind nur im Admin-Modus sichtbar.

**Step 1: Neue Zoom-Stufen in constants.ts**

Lies `packages/shared/src/constants.ts` und finde `QUAD_CELL_SIZES`. Erweitere:
```ts
// Existing: zoom levels 0-3 (normal)
// New: zoom levels 4-7 (admin deep zoom: 5×, 10×, 25×, 50×, 250×, 1000×)
// The cell sizes for deep zoom are large — one quadrant fills the entire canvas.
// Deep zoom renders a single quadrant stretched to full canvas size.
export const QUAD_DEEP_ZOOM_LEVELS = [5, 10, 25, 50, 250, 1000] as const;
```

**Step 2: QuadMapScreen.tsx erweitern**

Lies `packages/client/src/components/QuadMapScreen.tsx` vollständig.

Füge hinzu:
1. `isAdmin` aus Store lesen (prüfe ob ein `isAdmin`-Flag im State existiert, sonst aus `window.localStorage.getItem('adminToken')`)
2. `deepZoomLevel` state (Index 0–5 für die 6 Deep-Zoom-Stufen, oder `null` wenn nicht aktiv)
3. Wenn `deepZoomLevel !== null`: Canvas zeigt nur den selectedQuadrant in voller Canvas-Größe, gestreckt auf `QUAD_DEEP_ZOOM_LEVELS[deepZoomLevel]`-facher Darstellung
4. Admin-Zoom-Buttons unter den normalen Buttons, nur wenn `isAdmin`:

```tsx
const DEEP_ZOOMS = [5, 10, 25, 50, 250, 1000];

{isAdmin && (
  <div style={{ marginTop: 8, borderTop: '1px solid #333', paddingTop: 8 }}>
    <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: 4 }}>ADMIN DEEP ZOOM</div>
    {DEEP_ZOOMS.map((z) => (
      <button key={z} onClick={() => setDeepZoomLevel(z === deepZoomLevel ? null : z)}
        style={{ ...zoomBtnStyle, background: deepZoomLevel === z ? '#FFB000' : undefined }}>
        {z}×
      </button>
    ))}
  </div>
)}
```

5. Im Canvas-Draw-Callback: wenn `deepZoomLevel` aktiv, berechne Zell-Größe als `canvasWidth / QUADRANT_SIZE * deepZoomLevel` (oder ähnlich), rendere den Quadrant mit Faction-Farben, Friction-Glow und ⚔-Icons wie bei normalem Zoom.

**Step 3: Admin-Flag prüfen**

Prüfe wie `isAdmin` im State verfügbar ist:
```bash
grep -n "isAdmin\|adminToken\|admin" packages/client/src/state/gameSlice.ts | head -10
grep -n "isAdmin\|adminToken\|admin" packages/client/src/network/client.ts | head -10
```
Nutze was vorhanden ist. Falls kein `isAdmin` im State: `localStorage.getItem('adminToken') !== null` als Fallback.

**Step 4: Tests**
```bash
cd packages/client && npx vitest run
```

**Step 5: Commit**
```bash
git add packages/client/src/components/QuadMapScreen.tsx packages/shared/src/constants.ts
git commit -m "feat: admin QMap deep zoom levels 5×–1000× for alien expansion monitoring (#212)"
```

---

## Task 6: #213 — Area-Scan immersiver

**Files:**
- Modify: `packages/client/src/canvas/ScanAnimation.ts`
- Modify: `packages/client/src/components/RadarCanvas.tsx`

**Kontext:** `ScanAnimation.ts` hat `AREA_PULSE_DURATION = 800ms`, 3 Pulse. Die Wellen-Darstellung ist in `RadarCanvas.tsx` (oder `RadarRenderer.ts`). Freshly-scanned Sectors brauchen einen Brightness-Burst.

**Step 1: Wellen-Radius erweitern**

In `packages/client/src/canvas/ScanAnimation.ts`:

Aktuell rendert der Area-Scan Wellen bis `scanRange * cellSize`. Wir wollen die Wellen bis zum vollen sichtbaren Radar-Bereich:
```ts
// Ersetze NUM_PULSES von 3 → 5 für mehr Wellen
const NUM_PULSES = 5;

// Erhöhe AREA_PULSE_DURATION für langsamere, dramatischere Ausbreitung
const AREA_PULSE_DURATION = 1200; // war 800ms
```

Suche in `RadarCanvas.tsx` wo `drawScanAnimation` oder `renderScanWaves` aufgerufen wird. Der maximale Radius soll `Math.max(canvasWidth, canvasHeight) / 2` sein (voller sichtbarer Bereich), nicht nur `scanRange * cellSize`.

Finde die `radius`-Berechnung im Scan-Render-Code und ändere:
```ts
// Alt: const maxRadius = scanRange * cellSize;
// Neu:
const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY) * 1.5; // reaches corners
```

**Step 2: Brightness-Burst für frisch gescannte Sektoren**

Scan-Events landen in `scanResults` im State. Wenn ein Area-Scan abgeschlossen wird, kennen wir die Liste der neu gescannten Sektoren (coords).

In `RadarCanvas.tsx`:
1. Neues State-Ref: `freshSectors: Map<string, number>` (key = "x:y", value = timestamp when scanned)
2. Nach Scan-Completion: alle neuen Sektoren mit `Date.now()` eintragen
3. Beim Render jedes Sektors: wenn `Date.now() - freshSectors.get(key) < 2000`, Alpha/Helligkeit erhöhen (z.B. `ctx.globalAlpha = 1.0` statt normal, oder weißen Overlay mit sinkender Opacity drüberlegen)
4. Nach 2000ms: Sector aus Map entfernen

```ts
// In draw callback, beim Rendern eines Sektors:
const freshAge = Date.now() - (freshSectors.get(`${sx}:${sy}`) ?? Infinity);
if (freshAge < 2000) {
  const burst = 1 - freshAge / 2000; // 1.0 → 0.0
  ctx.fillStyle = `rgba(255, 255, 200, ${burst * 0.4})`;
  ctx.fillRect(cellX, cellY, cellW, cellH);
}
```

**Step 3: Tests**
```bash
cd packages/client && npx vitest run
```

**Step 4: Commit**
```bash
git add packages/client/src/canvas/ScanAnimation.ts packages/client/src/components/RadarCanvas.tsx
git commit -m "feat: area scan — wider waves, 5 pulses, brightness burst on freshly scanned sectors (#213)"
```

---

## Task 7: #216 — Trade UI Redesign

**Files:**
- Modify: `packages/client/src/components/TradeScreen.tsx`

**Kontext:** `TradeScreen.tsx` enthält Station-Trade und ggf. Direkthandel-UI. Ziel: zwei gleichbreite Spalten nebeneinander (Station/Anderer-Spieler links, Eigener Spieler rechts).

**Step 1: TradeScreen.tsx vollständig lesen**

```bash
wc -l packages/client/src/components/TradeScreen.tsx
```
Lies die komplette Datei um die aktuelle Struktur zu verstehen.

**Step 2: Layout auf zwei Spalten umbauen**

Das äußere Container-Element, das aktuell eine vertikale Liste rendert, wird zu:
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  height: '100%',
  overflow: 'hidden',
}}>
  {/* Linke Spalte: Station-Inventar ODER fremder Spieler */}
  <div style={{ overflowY: 'auto', borderRight: '1px solid #333', paddingRight: 8 }}>
    <div style={{ color: '#888', fontSize: '0.65rem', marginBottom: 8 }}>
      {isDirectTrade ? otherPlayerName.toUpperCase() : 'STATION'}
    </div>
    {/* Station items / other player items */}
  </div>

  {/* Rechte Spalte: Eigener Spieler */}
  <div style={{ overflowY: 'auto', paddingLeft: 8 }}>
    <div style={{ color: '#888', fontSize: '0.65rem', marginBottom: 8 }}>
      MEIN INVENTAR
    </div>
    {/* Player items */}
  </div>
</div>
```

Kauf/Tausch-Buttons bleiben inline bei den jeweiligen Items oder mittig zwischen den Spalten als Pfeil-Buttons (→ kaufen, ← verkaufen).

**Step 3: Tests**
```bash
cd packages/client && npx vitest run
```

**Step 4: Commit**
```bash
git add packages/client/src/components/TradeScreen.tsx
git commit -m "feat: trade UI — two-column layout (station/other-player left, own inventory right) (#216)"
```

---

## Task 8: #214 — Quest Journal + Tracking

### Teil A: DB + Server

**Files:**
- Create: `packages/server/src/db/migrations/047_quest_tracked.sql`
- Modify: `packages/server/src/db/queries.ts`
- Modify: `packages/server/src/rooms/services/QuestService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Migration**

Erstelle `packages/server/src/db/migrations/047_quest_tracked.sql`:
```sql
ALTER TABLE player_quests ADD COLUMN IF NOT EXISTS tracked BOOLEAN NOT NULL DEFAULT FALSE;
```

**Step 2: Query-Funktionen**

In `packages/server/src/db/queries.ts`:
```ts
export async function setQuestTracked(
  playerId: string,
  questId: string,
  tracked: boolean,
): Promise<void> {
  // Max 5 tracked at once — enforce on server
  if (tracked) {
    const { rows } = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM player_quests WHERE player_id = $1 AND tracked = TRUE',
      [playerId],
    );
    if (parseInt(rows[0].count) >= 5) {
      throw new Error('MAX_TRACKED_QUESTS');
    }
  }
  await query(
    'UPDATE player_quests SET tracked = $1 WHERE player_id = $2 AND id = $3',
    [tracked, playerId, questId],
  );
}

export async function getTrackedQuests(playerId: string): Promise<PlayerQuest[]> {
  const { rows } = await query<PlayerQuestRow>(
    `SELECT * FROM player_quests WHERE player_id = $1 AND tracked = TRUE AND status != 'completed'`,
    [playerId],
  );
  return rows.map(mapPlayerQuest);
}
```

> Passe `PlayerQuestRow` und `mapPlayerQuest` an die vorhandenen Typen an (lies `queries.ts` für bestehende Quest-Queries).

**Step 3: QuestService handler**

In `packages/server/src/rooms/services/QuestService.ts`:
```ts
async handleTrackQuest(
  client: Client,
  data: { questId: string; tracked: boolean },
): Promise<void> {
  const auth = this.ctx.getAuth(client);
  if (!auth) return;
  try {
    await setQuestTracked(auth.userId, data.questId, data.tracked);
    const tracked = await getTrackedQuests(auth.userId);
    this.ctx.send(client, 'trackedQuestsUpdate', { quests: tracked });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    this.ctx.send(client, 'error', { code: 'TRACK_QUEST_ERROR', message: msg });
  }
}
```

**Step 4: SectorRoom.ts wiring**

In `packages/server/src/rooms/SectorRoom.ts`, `onMessage`-Handler:
```ts
this.onMessage('trackQuest', (client, data) => this.quests.handleTrackQuest(client, data));
```

Außerdem im onJoin-Block, nach `requestActiveQuests`:
```ts
const trackedQuests = await getTrackedQuests(auth.userId);
client.send('trackedQuestsUpdate', { quests: trackedQuests });
```

**Step 5: Server-Tests**
```bash
cd packages/server && npx vitest run
```

**Step 6: Commit**
```bash
git add packages/server/src/db/migrations/047_quest_tracked.sql packages/server/src/db/queries.ts packages/server/src/rooms/services/QuestService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: quest tracking — tracked field, setQuestTracked, getTrackedQuests, server handler (#214 Part A)"
```

### Teil B: Client State + Network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

**Step 7: gameSlice.ts erweitern**

In `packages/client/src/state/gameSlice.ts`, zum State hinzufügen:
```ts
trackedQuests: [] as TrackedQuest[],
setTrackedQuests: (quests: TrackedQuest[]) => set({ trackedQuests: quests }),
```

Importiere `TrackedQuest` aus `@void-sector/shared` (oder definiere es lokal als `{ id: string; title: string; type: string; targetX?: number; targetY?: number; targetQx?: number; targetQy?: number }`).

**Step 8: network/client.ts erweitern**

```ts
// Handler für trackedQuestsUpdate
room.onMessage('trackedQuestsUpdate', (data: { quests: TrackedQuest[] }) => {
  store.getState().setTrackedQuests(data.quests);
});

// Neue Funktion:
sendTrackQuest(questId: string, tracked: boolean): void {
  this.room?.send('trackQuest', { questId, tracked });
}
```

**Step 9: Client-Tests**
```bash
cd packages/client && npx vitest run
```

**Step 10: Commit**
```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat: quest tracking — client state + network handler (#214 Part B)"
```

### Teil C: Journal UI

**Files:**
- Modify: `packages/client/src/components/QuestsScreen.tsx`
- Create: `packages/client/src/components/QuestJournal.tsx`

**Step 11: QuestJournal.tsx erstellen**

```tsx
// packages/client/src/components/QuestJournal.tsx
import React, { useState } from 'react';
import { useStore } from '../state/gameSlice';
import { network } from '../network/client';

type FilterType = 'all' | 'nearby' | string; // faction or quest type

export function QuestJournal() {
  const trackedQuests = useStore((s) => s.trackedQuests);
  const activeQuests = useStore((s) => s.activeQuests ?? []);
  const position = useStore((s) => s.position);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterFaction, setFilterFaction] = useState<string>('all');
  const [filterQuestType, setFilterQuestType] = useState<string>('all');

  const NEARBY_RADIUS = 50; // sectors

  const filtered = activeQuests.filter((q) => {
    if (filterType === 'nearby' && q.targetX !== undefined && position) {
      const dx = Math.abs(q.targetX - position.x);
      const dy = Math.abs(q.targetY - position.y);
      if (dx > NEARBY_RADIUS || dy > NEARBY_RADIUS) return false;
    }
    if (filterFaction !== 'all' && q.factionId !== filterFaction) return false;
    if (filterQuestType !== 'all' && q.type !== filterQuestType) return false;
    return true;
  });

  const factions = [...new Set(activeQuests.map((q) => q.factionId).filter(Boolean))];
  const questTypes = [...new Set(activeQuests.map((q) => q.type).filter(Boolean))];

  return (
    <div style={{ padding: '8px', fontSize: '0.7rem', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Filter Row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setFilterType(filterType === 'nearby' ? 'all' : 'nearby')}
          style={{ background: filterType === 'nearby' ? '#FFB000' : '#1a1a1a', color: filterType === 'nearby' ? '#000' : '#FFB000', border: '1px solid #FFB000', padding: '2px 6px', cursor: 'pointer', fontSize: '0.65rem' }}>
          IN DER NÄHE
        </button>
        <select value={filterFaction} onChange={(e) => setFilterFaction(e.target.value)}
          style={{ background: '#1a1a1a', color: '#FFB000', border: '1px solid #333', fontSize: '0.65rem', padding: '2px 4px' }}>
          <option value="all">ALLE FRAKTIONEN</option>
          {factions.map((f) => <option key={f} value={f}>{f?.toUpperCase()}</option>)}
        </select>
        <select value={filterQuestType} onChange={(e) => setFilterQuestType(e.target.value)}
          style={{ background: '#1a1a1a', color: '#FFB000', border: '1px solid #333', fontSize: '0.65rem', padding: '2px 4px' }}>
          <option value="all">ALLE TYPEN</option>
          {questTypes.map((t) => <option key={t} value={t}>{t?.toUpperCase()}</option>)}
        </select>
      </div>

      {/* Quest List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 && <div style={{ color: '#555' }}>Keine Quests gefunden.</div>}
        {filtered.map((q) => {
          const isTracked = trackedQuests.some((t) => t.id === q.id);
          const trackedCount = trackedQuests.length;
          return (
            <div key={q.id} style={{ borderBottom: '1px solid #222', padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <button
                onClick={() => network.sendTrackQuest(q.id, !isTracked)}
                disabled={!isTracked && trackedCount >= 5}
                title={isTracked ? 'Nicht mehr verfolgen' : trackedCount >= 5 ? 'Max. 5 Quests' : 'Verfolgen'}
                style={{
                  background: 'none', border: '1px solid #FFB000', color: isTracked ? '#FFB000' : '#555',
                  width: 18, height: 18, cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0,
                  opacity: (!isTracked && trackedCount >= 5) ? 0.4 : 1,
                }}>
                {isTracked ? '✓' : '○'}
              </button>
              <div>
                <div style={{ color: '#FFB000' }}>{q.title ?? q.type?.toUpperCase()}</div>
                <div style={{ color: '#888', fontSize: '0.6rem' }}>
                  {q.type} {q.factionId ? `· ${q.factionId}` : ''} {q.targetX !== undefined ? `· (${q.targetX}, ${q.targetY})` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ color: '#555', fontSize: '0.6rem' }}>
        {trackedQuests.length}/5 verfolgt
      </div>
    </div>
  );
}
```

**Step 12: Journal-Tab in QuestsScreen.tsx einfügen**

In `packages/client/src/components/QuestsScreen.tsx`:

1. Type erweitern:
```ts
const [tab, setTab] = useState<
  'active' | 'station' | 'rep' | 'events' | 'rescue' | 'story' | 'community' | 'alien_rep' | 'journal'
>('active');
```

2. `tabLabels` ergänzen:
```ts
journal: 'JOURNAL',
```

3. Tabs-Reihenfolge: `journal` ans Ende der Tab-Liste:
```ts
const tabs = ['active', 'station', 'rep', 'events', 'rescue', 'story', 'community', 'alien_rep', 'journal'];
```

4. Render-Block:
```tsx
{tab === 'journal' && <QuestJournal />}
```

5. Import hinzufügen:
```ts
import { QuestJournal } from './QuestJournal';
```

**Step 13: Client-Tests**
```bash
cd packages/client && npx vitest run
```

**Step 14: Commit**
```bash
git add packages/client/src/components/QuestJournal.tsx packages/client/src/components/QuestsScreen.tsx
git commit -m "feat: quest journal UI — JOURNAL tab with nearby/faction/type filters, track toggle (#214 Part C)"
```

### Teil D: Kartenanzeige + Rechte Seitenleiste

**Files:**
- Modify: `packages/client/src/components/RadarCanvas.tsx`
- Modify: `packages/client/src/components/BookmarkBar.tsx`

**Step 15: Blauer Puls auf Radar**

In `packages/client/src/components/RadarCanvas.tsx`, im Draw-Callback:

Lese `trackedQuests` aus dem Store. Für jeden tracked Quest mit bekannten Ziel-Koordinaten:
```ts
const trackedQuests = useStore.getState().trackedQuests;
const now = Date.now();

for (const quest of trackedQuests) {
  if (quest.targetX === undefined) continue;
  const cellX = /* Berechne Canvas-Position aus quest.targetX, quest.targetY */;
  const cellY = /* ... */;

  // Blauer pulsierender Rahmen
  const pulse = Math.sin(now / 500) * 0.5 + 0.5; // 0–1, 2Hz puls
  ctx.strokeStyle = `rgba(0, 191, 255, ${0.4 + pulse * 0.6})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(cellX, cellY, cellSize, cellSize);
}
```

Nutze `requestAnimationFrame`-Timestamp (der Radar läuft bereits at 60fps, also ist `Date.now()` ausreichend).

**Step 16: Tracked Quests in BookmarkBar**

Lies `packages/client/src/components/BookmarkBar.tsx` um die Struktur zu verstehen.

Unter den bestehenden Bookmarks, eine neue Sektion:
```tsx
{trackedQuests.length > 0 && (
  <div style={{ borderTop: '1px solid #333', marginTop: 4, paddingTop: 4 }}>
    <div style={{ fontSize: '0.55rem', color: '#555', marginBottom: 2 }}>QUESTS</div>
    {trackedQuests.map((q) => (
      <QuestSummaryEntry key={q.id} quest={q} />
    ))}
  </div>
)}
```

`QuestSummaryEntry` ist ein kleines lokales Component (in derselben Datei oder als inline-Funktion):
```tsx
function QuestSummaryEntry({ quest }: { quest: TrackedQuest }) {
  const [showPopup, setShowPopup] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowPopup(!showPopup)}
        style={{ background: 'none', border: 'none', color: '#00BFFF', fontSize: '0.6rem', cursor: 'pointer', textAlign: 'left', width: '100%', padding: '1px 0' }}>
        ▸ {quest.title?.slice(0, 20) ?? quest.type?.toUpperCase()}
      </button>
      {showPopup && (
        <div style={{
          position: 'absolute', right: '100%', top: 0, width: 180, background: '#0d0d0d',
          border: '1px solid #00BFFF', padding: 8, zIndex: 100, fontSize: '0.65rem', color: '#FFB000'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{quest.title ?? quest.type}</div>
          <div style={{ color: '#888' }}>{quest.description ?? 'Keine Details'}</div>
          {quest.targetX !== undefined && (
            <div style={{ color: '#00BFFF', marginTop: 4 }}>Ziel: ({quest.targetX}, {quest.targetY})</div>
          )}
          <button onClick={() => setShowPopup(false)}
            style={{ marginTop: 6, background: 'none', border: '1px solid #444', color: '#888', cursor: 'pointer', fontSize: '0.6rem' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 17: Final Tests**
```bash
cd packages/client && npx vitest run
cd packages/server && npx vitest run
cd packages/shared && npx vitest run
```

**Step 18: Commit**
```bash
git add packages/client/src/components/RadarCanvas.tsx packages/client/src/components/BookmarkBar.tsx
git commit -m "feat: tracked quests — blue pulse on radar, popup entries in bookmark bar (#214 Part D)"
```

---

## Abschluss

Nach allen Tasks:

```bash
# Alle Tests
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run

# Docker rebuild + restart
docker compose build server client
docker compose up -d
```

Dann `superpowers:finishing-a-development-branch` aufrufen.
