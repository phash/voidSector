# Origin Hub Goods/Blueprint Exchange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 4th (final) Origin Hub service — an **offline marketplace** at sector 0:0. A seller lists an item (a resource ore/gas/crystal, or a tradeable blueprint) at a total credit price; the item is escrowed. Any other player buys the whole listing (credits → seller, item → buyer); the seller can be offline. Cancel/expire returns the item.

**Architecture:** Migration `096` + `exchange_listings` table + queries. The **buy is one atomic `withTransaction`** (claim CAS → deduct buyer → pay seller → give item), so it's fully money-safe (no partial states). List escrows the item via `removeFromInventory` (refund on insert failure). Cancel/expire returns the item. An `ExchangeService` (mirrors BountyService) + SectorRoom handlers (list/buy/cancel/get, all 0:0-gated) + a periodic expire-refund in the strategic tick. Client: an EXCHANGE tab in the tab-ready OriginHubScreen + a "my tradeable items" fetch for the sell form.

**Tech:** TS (ESM `.js`), Vitest (server; client = vite build + vitest, NOT tsc). No shared change. Migration next = **096**. Inventory `item_type` ∈ {resource, module, blueprint, ...}; we trade **resource** + **blueprint** in v1.

**Branch:** `feat/origin-hub-exchange` off master.

---

## Key design / correctness
- **Item types v1:** `'resource'` (itemId ore/gas/crystal) + `'blueprint'` (itemId blueprint_*). Server validates type ∈ {resource, blueprint}.
- **Escrow on list:** `getInventoryItem` check → `removeFromInventory(seller, type, id, qty)` → insert listing. If insert throws/null → `addToInventory` refund.
- **Atomic buy (`withTransaction`, raw SQL on the tx client):**
  1. `UPDATE exchange_listings SET status='sold', buyer_id=$b, buyer_name=$bn, sold_at=NOW() WHERE id=$id AND status='open' AND seller_id <> $b RETURNING seller_id, price, item_type, item_id, quantity` — 0 rows → throw `NOT_AVAILABLE` (rollback).
  2. `UPDATE players SET credits = credits - $price WHERE id=$b AND credits >= $price` — rowCount 0 → throw `INSUFFICIENT_CREDITS` (rollback).
  3. `UPDATE players SET credits = credits + $price WHERE id=$seller`.
  4. `INSERT INTO inventory (...) VALUES ($b,$type,$id,$qty) ON CONFLICT (player_id,item_type,item_id) DO UPDATE SET quantity = inventory.quantity + $qty`.
  All-or-nothing. No double-sell (CAS on status='open'), no self-buy (seller<>buyer), no overdraft (credits>=price), item delivered exactly once.
- **Cancel:** `UPDATE ... SET status='cancelled' WHERE id AND seller_id=$s AND status='open' RETURNING item_type,item_id,quantity` → `addToInventory(seller,...)`.
- **Expire:** periodic `UPDATE ... SET status='expired' WHERE status='open' AND expires_at<=NOW() RETURNING seller_id,item_type,item_id,quantity` → `addToInventory` each.
- **Price:** total credits 1..100,000,000 integer (server-validated).

---

## File Structure
| File | Action |
|---|---|
| `packages/server/src/db/migrations/096_origin_exchange.sql` | Create |
| `packages/server/src/db/queries.ts` | Modify — `ExchangeListingRow` + insert/getOpen/buy(tx)/cancel/expire/myTradeable |
| `packages/server/src/rooms/services/ExchangeService.ts` | Create |
| `packages/server/src/rooms/services/__tests__/exchangeService.test.ts` | Create |
| `packages/server/src/rooms/SectorRoom.ts` | Modify — construct + 4 handlers |
| `packages/server/src/engine/strategicTickService.ts` | Modify — periodic expire-return |
| `packages/client/src/state/gameSlice.ts` | Modify — `exchangeListings` + `myTradeableItems` + setters |
| `packages/client/src/network/client.ts` | Modify — request/list/buy/cancel + handlers |
| `packages/client/src/state/helpSlice.ts` | Modify — extend first_originhub |
| `packages/client/src/components/OriginHubScreen.tsx` | Modify — EXCHANGE tab |

---

## Task 1: Server core — migration + queries + ExchangeService

- [ ] **Step 1 — failing test** `exchangeService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateListing, EXCHANGE_MAX_PRICE } from '../ExchangeService.js';

describe('validateListing', () => {
  it('accepts a resource listing', () => { expect(validateListing('resource', 'ore', 10, 500)).toMatchObject({ ok: true }); });
  it('accepts a blueprint listing', () => { expect(validateListing('blueprint', 'blueprint_turret', 1, 5000)).toMatchObject({ ok: true }); });
  it('rejects a disallowed item type', () => { expect(validateListing('prisoner', 'x', 1, 100).ok).toBe(false); });
  it('rejects a non-basic resource id', () => { expect(validateListing('resource', 'slate', 1, 100).ok).toBe(false); });
  it('rejects bad quantity / price', () => {
    expect(validateListing('resource', 'ore', 0, 100).ok).toBe(false);
    expect(validateListing('resource', 'ore', 1.5, 100).ok).toBe(false);
    expect(validateListing('resource', 'ore', 1, 0).ok).toBe(false);
    expect(validateListing('resource', 'ore', 1, EXCHANGE_MAX_PRICE + 1).ok).toBe(false);
  });
  it('rejects an empty blueprint id', () => { expect(validateListing('blueprint', '', 1, 100).ok).toBe(false); });
});
```
Run → FAIL.

- [ ] **Step 2 — migration** `096_origin_exchange.sql`:
```sql
-- 096: Origin Hub exchange — offline marketplace; sellers list escrowed items at 0:0.
CREATE TABLE IF NOT EXISTS exchange_listings (
  id          SERIAL PRIMARY KEY,
  seller_id   VARCHAR(255) NOT NULL,
  seller_name VARCHAR(255) NOT NULL,
  item_type   VARCHAR(30) NOT NULL,
  item_id     VARCHAR(64) NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  price       INTEGER NOT NULL CHECK (price > 0),
  status      VARCHAR(20) NOT NULL DEFAULT 'open',
  buyer_id    VARCHAR(255),
  buyer_name  VARCHAR(255),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sold_at     TIMESTAMP WITH TIME ZONE,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);
CREATE INDEX IF NOT EXISTS idx_exchange_open ON exchange_listings (status, created_at DESC);
```

- [ ] **Step 3 — queries** in `db/queries.ts` (confirm `query`, `withTransaction` imports; export `ExchangeListingRow`):
```typescript
export interface ExchangeListingRow {
  id: number; seller_id: string; seller_name: string; item_type: string; item_id: string;
  quantity: number; price: number; status: string; buyer_id: string | null; buyer_name: string | null;
  created_at: string; sold_at: string | null; expires_at: string;
}

export async function insertExchangeListing(sellerId: string, sellerName: string, itemType: string, itemId: string, quantity: number, price: number): Promise<ExchangeListingRow | null> {
  const res = await query<ExchangeListingRow>(
    `INSERT INTO exchange_listings (seller_id, seller_name, item_type, item_id, quantity, price)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [sellerId, sellerName, itemType, itemId, quantity, price]);
  return res.rows[0] ?? null;
}

export async function getOpenExchangeListings(limit = 50): Promise<ExchangeListingRow[]> {
  const res = await query<ExchangeListingRow>(
    `SELECT * FROM exchange_listings WHERE status='open' AND expires_at > NOW() ORDER BY created_at DESC LIMIT $1`, [limit]);
  return res.rows;
}

/** Atomic buy: claim + deduct buyer + pay seller + give item. Returns the sold row, or null/throws. */
export async function buyExchangeListing(listingId: number, buyerId: string, buyerName: string): Promise<ExchangeListingRow> {
  return withTransaction(async (client) => {
    const claim = await client.query(
      `UPDATE exchange_listings SET status='sold', buyer_id=$2, buyer_name=$3, sold_at=NOW()
       WHERE id=$1 AND status='open' AND expires_at > NOW() AND seller_id <> $2
       RETURNING *`, [listingId, buyerId, buyerName]);
    if (claim.rows.length === 0) { const e: any = new Error('NOT_AVAILABLE'); e.code = 'NOT_AVAILABLE'; throw e; }
    const row = claim.rows[0];
    const deb = await client.query(`UPDATE players SET credits = credits - $2 WHERE id=$1 AND credits >= $2`, [buyerId, row.price]);
    if ((deb.rowCount ?? 0) === 0) { const e: any = new Error('INSUFFICIENT_CREDITS'); e.code = 'INSUFFICIENT_CREDITS'; throw e; }
    await client.query(`UPDATE players SET credits = credits + $2 WHERE id=$1`, [row.seller_id, row.price]);
    await client.query(
      `INSERT INTO inventory (player_id, item_type, item_id, quantity) VALUES ($1,$2,$3,$4)
       ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET quantity = inventory.quantity + $4`,
      [buyerId, row.item_type, row.item_id, row.quantity]);
    return row as ExchangeListingRow;
  });
}

export async function cancelExchangeListing(listingId: number, sellerId: string): Promise<ExchangeListingRow | null> {
  const res = await query<ExchangeListingRow>(
    `UPDATE exchange_listings SET status='cancelled' WHERE id=$1 AND seller_id=$2 AND status='open' RETURNING *`, [listingId, sellerId]);
  return res.rows[0] ?? null;
}

export async function expireExchangeListings(): Promise<ExchangeListingRow[]> {
  const res = await query<ExchangeListingRow>(
    `UPDATE exchange_listings SET status='expired' WHERE status='open' AND expires_at <= NOW() RETURNING *`);
  return res.rows;
}

export async function getMyTradeableInventory(playerId: string): Promise<Array<{ item_type: string; item_id: string; quantity: number }>> {
  const res = await query<{ item_type: string; item_id: string; quantity: number }>(
    `SELECT item_type, item_id, quantity FROM inventory WHERE player_id=$1 AND item_type IN ('resource','blueprint') AND quantity > 0 ORDER BY item_type, item_id`, [playerId]);
  return res.rows;
}
```

- [ ] **Step 4 — ExchangeService** `rooms/services/ExchangeService.ts` (mirror BountyService: ctx, `this.ctx.send`, `AuthPayload` from `../../auth.js`; reuse `getInventoryItem`,`removeFromInventory`,`addToInventory` from where BountyService/SectorRoom import them):
```typescript
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { getInventoryItem, removeFromInventory, addToInventory } from '../../engine/inventoryService.js';
import { insertExchangeListing, getOpenExchangeListings, buyExchangeListing, cancelExchangeListing, getMyTradeableInventory } from '../../db/queries.js';

export const EXCHANGE_MAX_PRICE = 100_000_000;
const TRADE_RESOURCES = ['ore', 'gas', 'crystal'];

export function validateListing(itemType: string, itemId: string, quantity: number, price: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'BAD_QTY' };
  if (!Number.isInteger(price) || price < 1 || price > EXCHANGE_MAX_PRICE) return { ok: false, reason: 'BAD_PRICE' };
  if (itemType === 'resource') { if (!TRADE_RESOURCES.includes(itemId)) return { ok: false, reason: 'BAD_ITEM' }; return { ok: true }; }
  if (itemType === 'blueprint') { if (!itemId || itemId.length === 0) return { ok: false, reason: 'BAD_ITEM' }; return { ok: true }; }
  return { ok: false, reason: 'BAD_TYPE' };
}

export class ExchangeService {
  constructor(private ctx: ServiceContext) {}

  async handleList(client: Client, data: { itemType: string; itemId: string; quantity: number; price: number }, px: number, py: number): Promise<void> {
    if (px !== 0 || py !== 0) { this.ctx.send(client, 'error', { code: 'NOT_AT_ORIGIN', message: 'Nur am Zentrum (0:0) kannst du anbieten.' }); return; }
    const auth = client.auth as AuthPayload | null; if (!auth?.userId) return;
    const v = validateListing(data?.itemType, data?.itemId, data?.quantity, data?.price);
    if (!v.ok) { this.ctx.send(client, 'error', { code: 'INVALID_LISTING', message: 'Ungültiges Angebot.' }); return; }
    const have = await getInventoryItem(auth.userId, data.itemType as any, data.itemId);
    if (have < data.quantity) { this.ctx.send(client, 'error', { code: 'INSUFFICIENT_ITEM', message: 'Nicht genug auf Lager.' }); return; }
    try { await removeFromInventory(auth.userId, data.itemType as any, data.itemId, data.quantity); }
    catch { this.ctx.send(client, 'error', { code: 'INSUFFICIENT_ITEM', message: 'Nicht genug auf Lager.' }); return; }
    let listing;
    try { listing = await insertExchangeListing(auth.userId, auth.username, data.itemType, data.itemId, data.quantity, data.price); }
    catch { listing = null; }
    if (!listing) { await addToInventory(auth.userId, data.itemType as any, data.itemId, data.quantity).catch(() => undefined); this.ctx.send(client, 'error', { code: 'LISTING_FAILED', message: 'Angebot fehlgeschlagen — Ware zurück.' }); return; }
    await this.sendState(client, auth.userId);
  }

  async handleBuy(client: Client, listingId: number, px: number, py: number): Promise<void> {
    if (px !== 0 || py !== 0) { this.ctx.send(client, 'error', { code: 'NOT_AT_ORIGIN', message: 'Nur am Zentrum (0:0) kannst du kaufen.' }); return; }
    const auth = client.auth as AuthPayload | null; if (!auth?.userId) return;
    try {
      const row = await buyExchangeListing(listingId, auth.userId, auth.username);
      this.ctx.send(client, 'exchangeBought', { itemType: row.item_type, itemId: row.item_id, quantity: row.quantity, price: row.price });
    } catch (err: any) {
      const code = err?.code === 'INSUFFICIENT_CREDITS' ? 'INSUFFICIENT_CREDITS' : 'NOT_AVAILABLE';
      this.ctx.send(client, 'error', { code, message: code === 'INSUFFICIENT_CREDITS' ? 'Nicht genug Credits.' : 'Angebot nicht mehr verfügbar.' });
    }
    await this.sendState(client, auth.userId);
  }

  async handleCancel(client: Client, listingId: number, px: number, py: number): Promise<void> {
    if (px !== 0 || py !== 0) { this.ctx.send(client, 'error', { code: 'NOT_AT_ORIGIN', message: 'Nur am Zentrum (0:0).' }); return; }
    const auth = client.auth as AuthPayload | null; if (!auth?.userId) return;
    const row = await cancelExchangeListing(listingId, auth.userId);
    if (row) await addToInventory(auth.userId, row.item_type as any, row.item_id, row.quantity).catch(() => undefined);
    await this.sendState(client, auth.userId);
  }

  async sendState(client: Client, userId: string): Promise<void> {
    this.ctx.send(client, 'exchangeListingsResult', { listings: await getOpenExchangeListings(50) });
    this.ctx.send(client, 'exchangeMyItems', { items: await getMyTradeableInventory(userId) });
  }
}
```
> Match `getInventoryItem`/`removeFromInventory`/`addToInventory` import path to what SectorRoom/BountyService already use (BB-T1 used `engine/inventoryService.js` for remove/add, `db/queries.js` for getInventoryItem — confirm + match). Match `this.ctx.send`/`AuthPayload`. The `as any` on item_type casts to the `ItemType` union — better: import `ItemType` and cast properly if easy.
Run the test → PASS.

- [ ] **Step 5 — commit.**
```bash
git add packages/server/src/db/migrations/096_origin_exchange.sql packages/server/src/db/queries.ts packages/server/src/rooms/services/ExchangeService.ts packages/server/src/rooms/services/__tests__/exchangeService.test.ts
git commit -m "feat: ExchangeService — offline marketplace (list escrow / atomic withTransaction buy / cancel)"
```

---

## Task 2: Wire handlers + expire tick
- [ ] **SectorRoom:** declare `exchange` field; construct `this.exchange = new ExchangeService(this.serviceCtx);` next to the other origin services; handlers (0:0 via `_px/_py`):
```typescript
this.onMessage('listExchange', async (client, data: { itemType: string; itemId: string; quantity: number; price: number }) => {
  await this.exchange.handleList(client, data ?? ({} as any), this._px(client.sessionId), this._py(client.sessionId));
});
this.onMessage('buyExchange', async (client, data: { listingId: number }) => {
  await this.exchange.handleBuy(client, data?.listingId, this._px(client.sessionId), this._py(client.sessionId));
});
this.onMessage('cancelExchange', async (client, data: { listingId: number }) => {
  await this.exchange.handleCancel(client, data?.listingId, this._px(client.sessionId), this._py(client.sessionId));
});
this.onMessage('getExchange', async (client) => {
  const a = client.auth as any; await this.exchange.sendState(client, a?.userId);
});
```
Import `ExchangeService`.
- [ ] **strategicTickService:** add a periodic expire-return near the bounty refund:
```typescript
import { expireExchangeListings, addToInventory } from '../db/queries.js'; // addToInventory may be in engine/inventoryService.js — match
const _exp = await expireExchangeListings().catch(() => []);
for (const _l of _exp) await addToInventory(_l.seller_id, _l.item_type as any, _l.item_id, _l.quantity).catch(() => undefined);
```
(Import `addToInventory` from its real module. Guarded so it can't break the tick.)
- [ ] **verify + commit:** `npx tsc --noEmit | grep -iE "Exchange|SectorRoom|strategicTick" || echo clean`; `npx vitest run src/rooms/services/__tests__/exchangeService.test.ts src/__tests__/strategicTickService.test.ts` (add no-op mocks for the new queries in the strategic-tick test if needed — no weakening).
```bash
git add packages/server/src/rooms/SectorRoom.ts packages/server/src/engine/strategicTickService.ts
git commit -m "feat: wire exchange handlers (list/buy/cancel/get) + expire-return tick"
```

---

## Task 3: Client — EXCHANGE tab
- [ ] gameSlice: `exchangeListings: ExchangeListingRow[]` + `myTradeableItems: Array<{item_type,item_id,quantity}>` + setters (init []).
- [ ] network: `requestExchange(){ send('getExchange'); }`, `listExchange(itemType,itemId,quantity,price){ send('listExchange',{...}); }`, `buyExchange(listingId){ send('buyExchange',{listingId}); }`, `cancelExchange(listingId){ send('cancelExchange',{listingId}); }`. onMessage: `exchangeListingsResult`→setExchangeListings; `exchangeMyItems`→setMyTradeableItems; `exchangeBought`→showSuccessToast(`◈ Gekauft: {qty}× {itemId} für {price} CR`).
- [ ] OriginHubScreen: add `'EXCHANGE'` tab. `useEffect` on tab→`requestExchange()`. Tab content:
  - **Listings** (open, with BUY button each): show seller_name, item (`{quantity}× {itemId}` — map resource ids to ORE/GAS/KRISTALL, show blueprint ids as-is), price (CR). BUY → `buyExchange(id)` (disabled if `!atOrigin` or it's your own listing → instead show "(deins)" + a ABBRECHEN button → `cancelExchange(id)`). Empty state.
  - **Sell form** (only at 0:0): pick from `myTradeableItems` (a dropdown/list showing the player's tradeable resources + blueprints with quantities), a quantity input (1..have), a price input (1..1e8), ANBIETEN → `listExchange(type,id,qty,price)`. Disable off-origin / invalid.
- [ ] helpSlice: extend first_originhub to mention the exchange (≤6 lines total).
- [ ] verify: `vite build` clean + `vitest` pass. commit.
```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/components/OriginHubScreen.tsx packages/client/src/state/helpSlice.ts
git commit -m "feat: Origin Hub EXCHANGE tab — list + buy + cancel offline market listings"
```

---

## Task 4: Sweep + deploy
- [ ] shared+server vitest + client vite build green.
- [ ] Deploy (migration 096): `cd /opt/voidsector && git pull && docker compose ... up -d --build server client`.
- [ ] Prod verify: at 0:0 list ore → escrowed (cargo drops), appears; another player buys → credits move + item delivered; cancel returns item; `SELECT status,count(*) FROM exchange_listings GROUP BY status;`.

---

## Self-Review (plan author)
- **Coverage:** list (0:0 + item escrow + refund-on-fail) T1; atomic buy (withTransaction: claim/deduct/pay/give, no double-sell/self-buy/overdraft) T1; cancel + expire return T1/T2; handlers T2; client tab w/ sell-from-inventory + buy/cancel T3. ✓
- **Money/item safety:** buy is fully atomic in ONE transaction (better than Bounty's two-step). List escrows then inserts, refunding the item on insert failure. Cancel/expire return the escrowed item. No path loses or duplicates an item or credits.
- **Placeholders:** none; "match BountyService/inventory import paths" are deliberate executor checks.
- **Consistency:** `listExchange`/`buyExchange`/`cancelExchange`/`getExchange` (client↔server); `exchangeListingsResult`/`exchangeMyItems`/`exchangeBought` (server→client); `validateListing`/`EXCHANGE_MAX_PRICE` (service↔test); item_type/item_id/quantity/price everywhere. Aligned.
- **Verification points:** inventory fn import paths (engine/inventoryService vs db/queries); `withTransaction` client-query usage (raw `client.query`, NOT the global `query`); `ItemType` cast; strategic-tick test mocks for the new queries.
