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

**Lösung:** In `MiningService.handleMine` nach `validateMine`:
```
const shipStats = this.ctx.getShipForClient(client.sessionId);
result.state!.rate = MINING_RATE_PER_SECOND
  * (1 + shipStats.miningBonus)
  * bonuses.miningRateMultiplier;
```

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

1. **Client:** In `QuestsScreen`, `acceptQuestResult`-Event-Listener (oder `useEffect` auf `activeQuests`): Filter `availableQuests` nach `templateId` der akzeptierten Quest.

2. **Server-Cooldown:** In `QuestService.handleAcceptQuest` nach erfolgreichem Insert: Redis-Key `quest_cooldown:{playerId}:{stationX}:{stationY}:{templateId}` mit TTL = 10 * Tick-Intervall setzen. In `generateStationQuests`-Aufruf: akzeptierte Templates herausfiltern (Redis-Check).

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

- SHA-256 aus `err.message + location` (erste non-node_modules Stack-Zeile)
- `INSERT ... ON CONFLICT (fingerprint) DO UPDATE SET count = count + 1, last_seen = NOW()`
- Feuert fire-and-forget (kein await in kritischem Pfad)

Bestehende `logger.error`-Aufrufe in SectorRoom erhalten zusätzlich `captureError(err, context)`.

### Admin-API

4 neue Endpoints in `packages/server/src/adminRoutes.ts`:

```
GET  /admin/errors                 — { errors: ErrorLog[] }, Query-Param: ?status=new|all|ignored
POST /admin/errors/:id/ignore      — status → 'ignored'
POST /admin/errors/:id/resolve     — status → 'resolved'
DELETE /admin/errors/:id           — hard delete
```

GitHub-Issue-Link: clientseitig generiert via URL-Template:
```
https://github.com/phash/voidSector/issues/new?title=[ERROR] {message}&body={fingerprint}%0A{count}x%0A{stack}
```

### Admin-Tab "ERRORS"

Neuer Tab `ERRORS` in `packages/server/src/admin/console.html`:

- Tabelle: `LAST SEEN | COUNT | MESSAGE | LOCATION | STATUS`
- Zeile anklicken → Stack-Trace expandiert
- Zeilenbuttons: `[IGNORE]` `[RESOLVED]` `[DELETE]` `[→ GITHUB]`
- Filter-Bar oben: `[NEW]` `[ALL]` `[IGNORED]`
- Badge im Tab-Header zeigt Anzahl `new`-Fehler

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

Nächste freie Nummer: **055** (nach 054_combat_log.sql)

---

## Nicht im Scope

- Station-`maxStock`-Erhöhung (separates Balancing-Ticket)
- Quest-NPC-Cooldown-Anzeige im UI (nächste Iteration)
- Pino-Transport direktintegration (fire-and-forget via `captureError` reicht)
