# Design: Bug-Sprint + Admin-Fehlermonitoring

**Datum:** 2026-03-11
**Issues:** #240, #237, #238, #232, #233, #252
**Status:** Approved

---

## Scope

Fünf Gameplay-Bugs beheben + neues Admin-Fehlermonitoring-Feature implementieren.

---

## Bug-Fixes

### #240 — Jettison "hat keine Funktion"

**Problem:** Zwei-Klick-Confirm (`useConfirm`) ist nicht intuitiv. Nutzer klickt einmal, sieht keine sichtbare Reaktion, gibt auf.

**Lösung:** `useConfirm` in `CargoScreen` entfernen. Single-Click mit 1s `disabled`-State nach Auslösung (verhindert Doppelklick). Kein Modal nötig — Cargo-Update-Feedback aus Server reicht.

**Wichtig:** Es gibt **zwei** Jettison-Codepfade in `CargoScreen.tsx`:
1. `RESOURCE_TYPES.map` Loop (ore, gas, crystal)
2. Eigenständiger `artefact`-Button (unter dem Loop)
Beide müssen auf Single-Click umgestellt werden.

**Dateien:** `packages/client/src/components/CargoScreen.tsx`

---

### #237 — Verkaufen: 1 Einheit bleibt immer übrig

**Problem:** `canSellToStation` gibt `effectiveAmount < amount` zurück wenn Stations-Kapazität erschöpft. Die "partial"-Meldung (`setTradeMessage`) ist im Trade-Screen nur als kleiner Text sichtbar.

**Lösung:**
- `TradeMessage` mit `InlineError`-Styling (gelb, prominent) im Trade-Screen
- `ALL`-Button zeigt verfügbare Station-Kapazität an: `ALL (3 → max 2)`
- Server-seitig keine Änderung nötig — Logik korrekt

**Dateien:** `packages/client/src/components/TradeScreen.tsx`

---

### #238 — Mining-Rate ignoriert Modul-Bonus

**Problem:** `mining_mk1` gibt `miningBonus: 0.15` in Ship-Stats. `MiningService.handleMine` ruft `getPlayerBonuses()` auf, das nur ACEP- und Fraktions-Boni enthält — nicht den Ship-Modul-Bonus. Ergebnis: Mining-Module haben keinen Effekt auf die Rate.

**Lösung:** In `MiningService.handleMine` ist `ship` bereits vor `validateMine` als `const ship = this.ctx.getShipForClient(client.sessionId)` deklariert. Zeile 70 (`result.state!.rate *= bonuses.miningRateMultiplier`) **ersetzen** durch:
```typescript
result.state!.rate = MINING_RATE_PER_SECOND
  * (1 + (ship.miningBonus ?? 0))
  * bonuses.miningRateMultiplier;
```
**Nicht** eine neue Zeile ergänzen — das würde den Fraktions-Multiplikator doppelt anwenden.

**Dateien:** `packages/server/src/rooms/services/MiningService.ts`

---

### #232 — Mining + Cargo UX

**Problem:** Drei separate UX-Mängel:
1. Cargo-Anzeige im Mining-View zu unauffällig
2. Mining stoppt nicht automatisch bei vollem Cargo
3. Sektor-Detailansicht hat keinen Link zum Mining-Programm

**Lösung:**

1. **Cargo-Bar:** `MiningScreen` nutzt `CargoBar`-Komponente (aus `CargoScreen`) statt plaintext `CARGO: x/y`. Farbe wechselt bei >80% auf amber, bei 100% auf rot.

2. **Auto-Stop:** In `client.ts` im `cargoUpdate`-Handler: wenn `store.mining?.active && cargoTotal >= cargoCap` → `network.sendStopMine()`.

3. **Detail-Link:** In `MiningDetailPanel` oder `DetailPanel`: Button `[→ MINING]` wenn `currentSector.resources` vorhanden und Spieler im Sektor. Nutzt `setActiveProgram('MINING')`.

**Dateien:**
- `packages/client/src/components/MiningScreen.tsx`
- `packages/client/src/network/client.ts`
- `packages/client/src/components/MiningDetailPanel.tsx`

---

### #233 — Quests verschwinden nicht nach Annahme

**Problem:** `acceptQuestResult` fügt Quest zu `activeQuests` im Store hinzu, aber `availableQuests` (lokaler React-State in `QuestsScreen`) wird nicht aktualisiert. Angenommene Quest bleibt in der "VERFÜGBAR"-Liste.

Zusätzlich: Neue Quests erscheinen sofort nach Ablehnung/Reload statt erst nach 10 Ticks.

**Lösung:**

1. **Client:** In `QuestsScreen`: `useEffect` auf `activeQuests` (aus Store). Extrahiert alle `templateId`-Werte der aktiven Quests und filtert `availableQuests` so, dass kein Template doppelt erscheint:
```typescript
useEffect(() => {
  const acceptedTemplateIds = new Set(activeQuests.map(q => q.templateId));
  setAvailableQuests(prev => prev.filter(q => !acceptedTemplateIds.has(q.templateId)));
}, [activeQuests]);
```

2. **Server-Cooldown:** Die tägliche Rotation (`dayOfYear`) verhindert bereits, dass Quests nach einem Tag erneut erscheinen. Zusätzlich: in `QuestService.handleAcceptQuest` nach erfolgreichem Insert eine Redis-Key `quest_cooldown:{playerId}:{stationKey}:{templateId}` mit TTL = `UNIVERSE_TICK_INTERVAL_MS * 10` (ms → s) setzen. In `generateStationQuests`-Aufruf: Redis-Check vor Rückgabe. `UNIVERSE_TICK_INTERVAL_MS` aus `engine/universeBootstrap.ts` verwenden.

**Dateien:**
- `packages/client/src/components/QuestsScreen.tsx`
- `packages/server/src/rooms/services/QuestService.ts`

---

## Feature: Admin-Fehlermonitoring (#252)

### Datenbankschicht

**Migration 055** — neue Tabelle `error_logs`:

```sql
CREATE TABLE IF NOT EXISTS error_logs (
  id            SERIAL PRIMARY KEY,
  fingerprint   VARCHAR(64) UNIQUE NOT NULL,   -- SHA-256(message + location)
  message       TEXT NOT NULL,
  location      TEXT,                          -- file:line aus stack
  stack         TEXT,
  count         INTEGER NOT NULL DEFAULT 1,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        VARCHAR(16) NOT NULL DEFAULT 'new',  -- 'new'|'ignored'|'resolved'
  github_issue_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_error_logs_status ON error_logs(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs(last_seen DESC);
```

### Server-Transport

Datei: `packages/server/src/utils/errorLogTransport.ts`

```typescript
export async function captureError(err: Error, context: string): Promise<void>
```

- Nutzt den bestehenden `query`-Helper aus `../../db/queries.js` (gleicher Import wie im gesamten Server)
- SHA-256 aus `err.message + location` (erste non-node_modules Stack-Zeile)
- `INSERT ... ON CONFLICT (fingerprint) DO UPDATE SET count = count + 1, last_seen = NOW()`
- Alle DB-Fehler intern silently catchen (`try/catch` innerhalb der Funktion) — darf nie nach außen werfen
- Aufrufer nutzt fire-and-forget: `captureError(err, context).catch(() => {})` in SectorRoom-Handlern

Bestehende `logger.error`-Aufrufe in SectorRoom erhalten zusätzlich `captureError(err, context)`.

### Admin-API

4 neue Endpoints in `packages/server/src/adminRoutes.ts`. Jeder Endpoint ruft wie alle bestehenden Routen `await logAdminEvent(...)` auf:

```
GET  /admin/errors                 — { errors: ErrorLog[] }, Query-Param: ?status=new|all|ignored  → logAdminEvent('list_errors', { status })
POST /admin/errors/:id/ignore      — status → 'ignored'   → logAdminEvent('ignore_error', { id })
POST /admin/errors/:id/resolve     — status → 'resolved'  → logAdminEvent('resolve_error', { id })
DELETE /admin/errors/:id           — hard delete           → logAdminEvent('delete_error', { id })
```

GitHub-Issue-Link: clientseitig generiert via URL-Template. Alle Parameter mit `encodeURIComponent` kodieren:
```javascript
const url = `https://github.com/phash/voidSector/issues/new?title=${encodeURIComponent('[ERROR] ' + message)}&body=${encodeURIComponent(body)}`;
```

### Admin-Tab "ERRORS"

Neuer Tab `ERRORS` in `packages/server/src/admin/console.html`:

- Tabelle: `LAST SEEN | COUNT | MESSAGE | LOCATION | STATUS`
- Zeile anklicken → Stack-Trace expandiert
- Zeilenbuttons: `[IGNORE]` `[RESOLVED]` `[DELETE]` `[→ GITHUB]`
- Filter-Bar oben: `[NEW]` `[ALL]` `[IGNORED]`
- Badge im Tab-Header zeigt Anzahl `new`-Fehler
- **Auth:** Alle fetch-Aufrufe des Tabs verwenden `Authorization: Bearer ${adminToken}` Header (gleich wie alle anderen Tabs in `console.html`)

---

## Testplan

| Feature | Test |
|---------|------|
| #240 Jettison | Unit: CargoScreen — Click fires sendJettison direkt |
| #237 Partial Sell | Existing npcStationEngine tests — kein neuer Test nötig |
| #238 Mining Rate | Unit: MiningService — rate enthält miningBonus |
| #232 Auto-Stop | Unit: client cargoUpdate-Handler — sendStopMine wird aufgerufen |
| #233 Quest-Filter | Unit: QuestsScreen — akzeptierte Quest verschwindet aus Liste |
| #252 captureError | Unit: errorLogTransport — upsert mit fingerprint |
| #252 Admin-API | Unit: adminRoutes — GET/POST/DELETE errors |

---

## Migration

Nächste freie Nummer: **055** (nach 054_combat_log.sql).
**Hinweis:** Es existieren bereits zwei `051_*`-Dateien (`051_faction_recruiting.sql` + `051_quadrant_visits.sql`) — Pre-existing Conflict, nicht reproduzieren. Vor Erstellen der neuen Datei höchste vorhandene Nummer verifizieren.

---

## Nicht im Scope

- Station-`maxStock`-Erhöhung (separates Balancing-Ticket)
- Quest-NPC-Cooldown-Anzeige im UI (nächste Iteration)
- Pino-Transport direktintegration (fire-and-forget via `captureError` reicht)
