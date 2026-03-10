# Bug-Fix Batch — Design Spec
Date: 2026-03-10
Issues: #240, #238, #237, #233

---

## Übersicht

5 kleine Fixes in 4 Issues. Alle unabhängig voneinander, können parallel implementiert werden.

---

## #240 — Waren abwerfen

**Root cause:** `CargoDetailPanel.tsx:68` hat `disabled` hardcoded, kein `onClick`.

**Fix:**
- `disabled` entfernen
- `onClick` → `network.sendJettison(selectedCargoItem)` mit der vollen Menge des selektierten Items
- Server-Handler `handleJettison` in `MiningService.ts` existiert bereits und ist funktional

**Scope:** 1 Datei, Client only.

---

## #238 — Mining-Anzeige

**Root cause:** Berechnung korrekt (`MINING_RATE_PER_SECOND = 1`, cap durch `sectorYield`). Der Progress-Bar zeigt `elapsed * rate / sectorYield` — füllt sich also über `sectorYield` Sekunden. Spieler liest das als "langsame Rate" obwohl Rate 1u/s ist.

**Fix:**
- Neben `{mining.rate}u/s` den aktuellen Fortschritt als `AUSBEUTE: {mined}/{sectorYield}` anzeigen
- `mined = Math.floor(Math.min(elapsed * rate, sectorYield, cargoSpace))` — clientseitig aus `miningProgress * sectorYield` berechenbar
- Kein Server-Change nötig

**Scope:** 1 Datei, `MiningScreen.tsx`.

---

## #237 — Verkaufen geht nicht auf 0 + Alles Verkaufen

**Root cause:** `canSellToStation` gibt `ok: false` zurück wenn `remainingCapacity < amount`. Station füllt sich durch `restockRate > consumptionRate` und blockt den letzten Verkauf pro Ressource.

**Fix — Server (`npcStationEngine.ts` + `EconomyService.ts`):**
- `canSellToStation` gibt zusätzlich `effectiveAmount` zurück: `Math.min(amount, remainingCapacity)`
- `EconomyService` verwendet `effectiveAmount` statt `amount` beim Aufruf von `removeFromInventory`
- Bei `effectiveAmount < amount`: trotzdem erfolgreicher Trade, aber Response enthält `partial: true, soldAmount: effectiveAmount`

**Fix — Client (`TradeScreen.tsx`):**
- Input: `max={playerAmount}` setzen (verhindert Eingabe über Bestand)
- "ALLES"-Button pro Ressource: setzt `amount = cargo[res]` (bzw. `storage[res]`)
- Bei `partial: true` in Response: InlineError "Station konnte nur {soldAmount}x aufnehmen"
- Restkapazität der Station (pro Ressource) optional anzeigen, wenn bekannt

**Scope:** Server: `npcStationEngine.ts`, `EconomyService.ts`. Client: `TradeScreen.tsx`.

---

## #233 — Quests verschwinden nicht nach Annahme

**Root cause:** `handleGetStationNpcs` ruft `generateStationQuests` auf ohne Filter gegen aktive Quests. Derselbe Spieler sieht dieselben tagesbasierten Quest-Templates wieder.

**Fix — Server (`QuestService.ts`):**
- In `handleGetStationNpcs`: aktive/completed `templateId`s des Spielers aus `player_quests` laden
- Generierte Quests mit diesen IDs herausfiltern bevor `stationNpcsResult` gesendet wird

**Refresh-Cooldown (aus Issue):**
- Quests sollen erst nach 10 Ticks wieder erscheinen
- Einfachste Implementierung: `player_quests` mit `status = 'completed'` innerhalb der letzten 10 Ticks herausfiltern (completed_at Timestamp prüfen)
- Alternativ: Redis-Key `quest_refresh:{userId}:{stationX}:{stationY}` mit TTL = 10 × TICK_MS

**Scope:** Server only, `QuestService.ts` + ggf. `queries.ts` (getActiveTemplateIds).

---

## Datei-Übersicht

| Fix | Dateien |
|-----|---------|
| #240 | `packages/client/src/components/CargoDetailPanel.tsx` |
| #238 | `packages/client/src/components/MiningScreen.tsx` |
| #237 | `packages/server/src/engine/npcStationEngine.ts`, `packages/server/src/rooms/services/EconomyService.ts`, `packages/client/src/components/TradeScreen.tsx` |
| #233 | `packages/server/src/rooms/services/QuestService.ts`, `packages/server/src/db/queries.ts` |

---

## Tests

- **#240**: Jettison-Handler-Tests existieren (`MiningService.test.ts`) — kein neuer Test nötig
- **#238**: Kein Test nötig (reine Display-Änderung)
- **#237**: `npcStationEngine.test.ts` — Test für `canSellToStation` mit `effectiveAmount`; `economyInventory.test.ts` — Test für partial sell
- **#233**: `QuestService`-Test für Filterung akzeptierter Template-IDs
