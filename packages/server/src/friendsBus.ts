import { EventEmitter } from 'events';

export interface FriendBusEvent {
  type: 'friendRequest' | 'friendAccepted' | 'friendRemoved';
  targetPlayerId: string;
  payload: Record<string, unknown>;
}

class FriendsBus extends EventEmitter {
  notify(event: FriendBusEvent): void {
    this.emit('friendEvent', event);
  }
}

export const friendsBus = new FriendsBus();
