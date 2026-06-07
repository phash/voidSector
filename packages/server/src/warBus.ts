import { EventEmitter } from 'events';
import type { WarTickerEvent } from '@void-sector/shared';

/**
 * In-process bus for server-wide war-ticker / strategic news events. The strategic
 * tick emits here; every SectorRoom subscribes and broadcasts to its clients so
 * territory changes are visible in real time (QW2 — previously war-ticker events
 * were lpush'd to a Redis list that nothing ever read).
 */
class WarBus extends EventEmitter {
  broadcast(event: WarTickerEvent): void {
    this.emit('warEvent', event);
  }
}

export const warBus = new WarBus();
// Every SectorRoom subscribes; raise the cap so many concurrent rooms don't trip
// Node's default 10-listener warning (mirrors constructionBus).
warBus.setMaxListeners(50);
