import { EventEmitter } from 'events';
import type { CivShip } from '@void-sector/shared';

export interface CivShipsTickEvent {
  qx: number;
  qy: number;
  ships: CivShip[];
}

class CivShipBus extends EventEmitter {
  broadcastTick(event: CivShipsTickEvent): void {
    this.emit('civShipsTick', event);
  }
}

export const civShipBus = new CivShipBus();
