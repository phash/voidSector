# SP6 — Kontor + Spieler-Markt verdrahten (#525)

**Datum:** 2026-06-07 · **Branch:** `feat/sp0-cleanup` (Audit-Fix-Programm).

## Befund (#525)
Client sendet `placeOrder`, `kontorGetOrders`, `kontorSellTo` (+ neu: `fulfillOrder`,
`kontorPlaceOrder`), aber der Server hat keine Handler. MARKET- + KONTOR-Tabs sind „hidden for
launch". `kontorEngine` ist komplett **inkl. Escrow** (placeKontorOrder reserviert Credits,
fillKontorOrder transferiert atomar), nur unverdrahtet. Der globale MARKET (`trade_orders`) hat
**keine** Escrow/Transfer-Logik und die UI ist read-only.

Out of scope: #424 (Station-Economy-Redesign) und #411 (Modul-Preissystem) sind eigene große Epics.

## MARKET (trade_orders) — Escrow ohne Schema-Änderung
Neues `engine/marketOrderService.ts` (pure-nah, getestet):
- `placeMarketOrder(playerId, resource, amount, pricePerUnit, type)`:
  - validiert resource∈{ore,gas,crystal,artefact}, amount/price = positive Ganzzahl.
  - **sell**: Bestand prüfen → `removeFromInventory` (Ware liegt „in" der Order).
  - **buy**: `deductCredits(amount×price)` (atomar, prüft Deckung).
  - `createTradeOrder(...)`.
- `fulfillMarketOrder(fulfillerId, orderId)` (Fulfiller ≠ Owner):
  - **sell-Order**: Fulfiller zahlt amount×price (deductCredits) → Owner bekommt Credits; Fulfiller
    bekommt die escrowte Ware.
  - **buy-Order**: Fulfiller gibt Ware (Bestand prüfen → removeFromInventory) → Owner bekommt Ware;
    Fulfiller bekommt die escrowten Credits.
  - `fulfillTradeOrder(orderId)`.
- `cancelMarketOrder(playerId, orderId)`: Escrow zurück (sell→Ware, buy→Credits) + `cancelTradeOrder`.
  Ersetzt den bisherigen Refund-losen `handleCancelOrder`.

## KONTOR (kontorEngine, fertig) — nur verdrahten
Handler in `WorldService`/`SectorRoom`, Sektor aus `getPlayerPosition`:
- `kontorGetOrders` → `getKontorOrders(sx,sy)` → `kontorUpdate {orders}`.
- `kontorPlaceOrder {resource, amount, pricePerUnit}` → `placeKontorOrder(...)` (Credits-Escrow in
  Engine) → kontorUpdate + creditsUpdate.
- `kontorSellTo {orderId, amount}` → `fillKontorOrder(orderId, sellerId, amount)` → kontorUpdate +
  cargoUpdate + creditsUpdate.

## Server-Handler (WorldService + SectorRoom-Registrierung)
`placeOrder` → orderPlaced + tradeOrders + myOrders + cargo/credits-Refresh;
`fulfillOrder {orderId}` → orderResult + tradeOrders + cargo/credits-Refresh;
`cancelOrder` → Refund (s.o.) + tradeOrders + myOrders + cargo/credits-Refresh.

## Client
- network: `sendFulfillOrder(orderId)`, `sendKontorPlaceOrder(resource, amount, pricePerUnit)`
  (sendPlaceOrder/kontorGetOrders/kontorSellTo existieren). Listener: `orderResult`.
- MARKET-Tab: Platzieren-Formular (Ressource/Menge/Preis/Buy-Sell → sendPlaceOrder) + bei fremden
  Orders ein [FÜLLEN]-Button (sendFulfillOrder); MY ORDERS mit Cancel (vorhanden). Tab sichtbar
  ab tier≥2.
- KONTOR-Tab: Platzieren-Formular (sendKontorPlaceOrder) + [VERKAUFEN] je Order (sendKontorSellTo);
  beim Öffnen kontorGetOrders. Tab sichtbar an Station/Heimat.
- HelpSlices `first_market` + `first_kontor` + [?]-Buttons.

## Tests
`marketOrderService.test.ts`: place sell/buy (Escrow zieht ab), fulfill beide Richtungen (atomar,
kein Dupe bei Unterdeckung), cancel-Refund, eigene-Order/erfüllte-Order abgelehnt.
Server- + Client-Suite grün.
