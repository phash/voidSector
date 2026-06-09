import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import {
  createExchangeListingWithEscrow,
  getExchangeListing,
  getOpenExchangeListings,
  buyExchangeListing,
  cancelExchangeListing,
  getMyTradeableInventory,
  getPlayerCredits,
} from '../../db/queries.js';
import { addToInventory, canAddResource, getCargoState } from '../../engine/inventoryService.js';
import { logger } from '../../utils/logger.js';

export const EXCHANGE_MAX_PRICE = 100_000_000;
const TRADE_RESOURCES = ['ore', 'gas', 'crystal'];

export function validateListing(
  itemType: string,
  itemId: string,
  quantity: number,
  price: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'BAD_QTY' };
  if (!Number.isInteger(price) || price < 1 || price > EXCHANGE_MAX_PRICE)
    return { ok: false, reason: 'BAD_PRICE' };
  if (itemType === 'resource') {
    if (!TRADE_RESOURCES.includes(itemId)) return { ok: false, reason: 'BAD_ITEM' };
    return { ok: true };
  }
  if (itemType === 'blueprint') {
    if (!itemId || itemId.length === 0) return { ok: false, reason: 'BAD_ITEM' };
    return { ok: true };
  }
  return { ok: false, reason: 'BAD_TYPE' };
}

export class ExchangeService {
  constructor(private ctx: ServiceContext) {}

  async handleList(
    client: Client,
    data: { itemType: string; itemId: string; quantity: number; price: number },
    px: number,
    py: number,
  ): Promise<void> {
    if (px !== 0 || py !== 0) {
      this.ctx.send(client, 'error', {
        code: 'NOT_AT_ORIGIN',
        message: 'Nur am Zentrum (0:0) kannst du anbieten.',
      });
      return;
    }
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    const v = validateListing(data?.itemType, data?.itemId, data?.quantity, data?.price);
    if (!v.ok) {
      this.ctx.send(client, 'error', { code: 'INVALID_LISTING', message: 'Ungültiges Angebot.' });
      return;
    }
    let listing;
    try {
      listing = await createExchangeListingWithEscrow(
        auth.userId,
        auth.username,
        data.itemType,
        data.itemId,
        data.quantity,
        data.price,
      );
    } catch (err: any) {
      const code = err?.code === 'INSUFFICIENT_ITEM' ? 'INSUFFICIENT_ITEM' : 'LISTING_FAILED';
      this.ctx.send(client, 'error', {
        code,
        message: code === 'INSUFFICIENT_ITEM' ? 'Nicht genug auf Lager.' : 'Angebot fehlgeschlagen.',
      });
      return;
    }
    await this.pushHud(client, auth.userId);
    await this.sendState(client, auth.userId);
  }

  async handleBuy(
    client: Client,
    listingId: number,
    px: number,
    py: number,
  ): Promise<void> {
    if (px !== 0 || py !== 0) {
      this.ctx.send(client, 'error', {
        code: 'NOT_AT_ORIGIN',
        message: 'Nur am Zentrum (0:0) kannst du kaufen.',
      });
      return;
    }
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    const listing = await getExchangeListing(listingId);
    if (!listing || listing.status !== 'open') {
      this.ctx.send(client, 'error', { code: 'NOT_AVAILABLE', message: 'Angebot nicht mehr verfügbar.' });
      return;
    }
    if (listing.item_type === 'resource') {
      const canHold = await canAddResource(auth.userId, listing.quantity);
      if (!canHold) {
        this.ctx.send(client, 'error', { code: 'CARGO_FULL', message: 'Nicht genug Frachtraum.' });
        return;
      }
    }
    try {
      const row = await buyExchangeListing(listingId, auth.userId, auth.username);
      this.ctx.send(client, 'exchangeBought', {
        itemType: row.item_type,
        itemId: row.item_id,
        quantity: row.quantity,
        price: row.price,
      });
      await this.pushHud(client, auth.userId, true);
    } catch (err: any) {
      const code =
        err?.code === 'INSUFFICIENT_CREDITS' ? 'INSUFFICIENT_CREDITS' : 'NOT_AVAILABLE';
      this.ctx.send(client, 'error', {
        code,
        message:
          code === 'INSUFFICIENT_CREDITS'
            ? 'Nicht genug Credits.'
            : 'Angebot nicht mehr verfügbar.',
      });
    }
    await this.sendState(client, auth.userId);
  }

  async handleCancel(
    client: Client,
    listingId: number,
    px: number,
    py: number,
  ): Promise<void> {
    if (px !== 0 || py !== 0) {
      this.ctx.send(client, 'error', { code: 'NOT_AT_ORIGIN', message: 'Nur am Zentrum (0:0).' });
      return;
    }
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    const row = await cancelExchangeListing(listingId, auth.userId);
    if (row) {
      await addToInventory(auth.userId, row.item_type as any, row.item_id, row.quantity).catch(
        (e) => logger.error({ err: e }, 'exchange refund failed'),
      );
      await this.pushHud(client, auth.userId);
    }
    await this.sendState(client, auth.userId);
  }

  private async pushHud(client: Client, userId: string, credits = false): Promise<void> {
    this.ctx.send(client, 'cargoUpdate', await getCargoState(userId));
    if (credits) {
      this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(userId) });
    }
  }

  async sendState(client: Client, userId: string): Promise<void> {
    this.ctx.send(client, 'exchangeListingsResult', {
      listings: await getOpenExchangeListings(50),
    });
    this.ctx.send(client, 'exchangeMyItems', { items: await getMyTradeableInventory(userId) });
  }
}
