# SP3 — P2P-Direkthandel (#225)

**Datum:** 2026-06-07 · **Branch:** `feat/sp0-cleanup` (Audit-Fix-Programm).

## Befund
- Server `engine/directTradeService.ts` ist komplett (Redis-Session, atomarer Swap, 60s TTL) und in
  `SectorRoom` verdrahtet (`tradeRequest`/`tradeOffer`/`tradeConfirm`/`tradeCancel`).
- **Client-UI fehlt komplett.** Zwei Server-Lücken blockieren ein funktionierendes UI:
  1. `tradeOfferUpdated` geht nur an den **anbietenden** Client → die Gegenseite sieht das Angebot
     bzw. den Confirm-Status nie.
  2. `executeTrade` validiert **kein** Eigentum → wer Items anbietet, die er nicht hat, verliert
     nichts (DELETE/UPDATE matcht nicht), die Gegenseite wird aber gutgeschrieben → **Item-Dupe**.

## Server
**`directTradeService.ts`:**
- `TradeSession` + `fromPlayerName`, `toPlayerName`; `initiateTrade(fromId, fromName, toId, toName)`.
- `updateOffer`: Items auf `quantity>0` (ganzzahlig) filtern, `credits = max(0, floor)`.
- `executeTrade`: vor jedem Transfer Eigentum prüfen (`getInventoryItem` je Item,
  `getPlayerCredits` für Credits) → bei Unterdeckung `throw INSUFFICIENT`, **kein** Teiltransfer.

**`SectorRoom.ts`:**
- Helper `broadcastTradeState(tradeId)`: Session holen, `tradeState`-View (Session + tradeId) an
  **beide** Spieler im Raum senden.
- `tradeRequest`: Ziel-Client im Raum suchen (sonst `TRADE_NOT_IN_RANGE`); beide müssen im selben
  Sektor stehen (`getPlayerPosition`). Namen aus `auth.username`. → `tradeStarted` an A,
  `tradeInvite {tradeId, fromPlayerId, fromPlayerName}` an B, dann `broadcastTradeState`.
- `tradeOffer`: nach `updateOffer` → `broadcastTradeState` (statt nur `tradeOfferUpdated`).
- `tradeConfirm`: nach `confirm` → `broadcastTradeState`; bei beidseitig bestätigt `executeTrade`
  (try/catch: bei Fehler `error` an beide + `tradeCancelled`), sonst `tradeComplete` + `cargoUpdate`
  + `creditsUpdate` + `inventoryUpdated` an beide.
- `tradeCancel`: `tradeCancelled` an beide.
- `getTradeState {tradeId}`: `broadcastTradeState`.

## Shared
`types.ts`: `TradeStateView` (tradeId, from/to PlayerId+Name, from/to Items+Credits, confirmedBy,
expiresAt). Reiner Typ → kein Runtime-Impact; `npm run build` in shared.

## Client
- `network/client.ts`: `sendTradeRequest(targetId)`, `sendTradeOffer(tradeId, items, credits)`,
  `sendTradeConfirm(tradeId)`, `sendTradeCancel(tradeId)`, `requestTradeState(tradeId)`. Listener:
  `tradeStarted`, `tradeInvite`, `tradeState`, `tradeComplete`, `tradeCancelled` → Store.
- Store (uiSlice): `activeTrade: TradeStateView | null`, `tradeInvitePending: {tradeId, fromPlayerId,
  fromPlayerName} | null`, `tradeStatus: 'negotiating'|'complete'|'cancelled'|null`, Setter.
- `TradeWindow.tsx` (Modal): eigene Spalte (Items aus Cargo wählen + Credits) vs. Gegenspalte
  (read-only Live-Angebot), `[BESTÄTIGEN]`/`[ABBRECHEN]`, Confirm-Status beider Seiten, `[?]`-Button.
  Offer-Änderung setzt Confirm zurück (Server tut das bereits) → UI zeigt es. Tradeable: ore/gas/
  crystal/artefact + Module + Slates aus dem Inventar.
- `TradeInviteModal.tsx`: „<Name> möchte handeln" `[ANNEHMEN]`(→requestTradeState+öffnet Fenster)/
  `[ABLEHNEN]`(→tradeCancel).
- `PlayerCardModal`: `[HANDELN]`-Button, nur wenn Ziel im selben Sektor (Position == eigene) und
  nicht self/blocked → `sendTradeRequest`.
- `CockpitLayout`: `<TradeWindow/>` + `<TradeInviteModal/>` global mounten.
- HelpSlice `first_p2p_trade` + `[?]` im TradeWindow.

## Tests
- `directTrade.test.ts` erweitern: Sanitization (neg. qty/credits) + executeTrade-Validierung
  (Dupe-Schutz: Anbieten ohne Bestand → throw, keine Gutschrift).
- Client: `TradeWindow` Render-Test (eigene/Gegenseite, Confirm-Status).
- Server- + Client-Suite grün.

## Verifikation
Zwei Clients im selben Sektor → PlayerCard [HANDELN] → beide sehen Live-Angebote → bestätigen →
Inventare/Credits korrekt; Abbruch + Ablauf (TTL) sauber.
