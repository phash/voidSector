import { EventEmitter } from 'events';
import type { ChatMessage } from '@void-sector/shared';

export interface CommsBroadcastEvent {
  channel: 'sector' | 'quadrant';
  sectorX: number;
  sectorY: number;
  quadrantX: number;
  quadrantY: number;
  message: ChatMessage;
}

class CommsBus extends EventEmitter {
  broadcast(event: CommsBroadcastEvent): void {
    this.emit('commsBroadcast', event);
  }
}

export const commsBus = new CommsBus();
