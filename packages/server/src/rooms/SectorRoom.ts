import colyseus from 'colyseus';
import type { Client } from 'colyseus';

const { Room } = colyseus;

export class SectorRoom extends Room {
  onCreate() {
    console.log('SectorRoom created:', this.roomId);
  }

  onJoin(client: Client) {
    console.log('Client joined:', client.sessionId);
  }

  onLeave(client: Client) {
    console.log('Client left:', client.sessionId);
  }
}
