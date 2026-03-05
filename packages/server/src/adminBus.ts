import { EventEmitter } from 'events';

export interface AdminBroadcastEvent {
  senderName: string;
  content: string;
  scope: 'universal' | 'individual';
  targetPlayers: string[]; // player IDs for individual scope
  channel: string;
  allowReply: boolean;
  messageId: string;
}

export interface AdminQuestEvent {
  questId: string;
  title: string;
  description: string;
  scope: 'universal' | 'individual' | 'sector';
  targetPlayers: string[];
  sectorX?: number;
  sectorY?: number;
}

export interface AdminPlayerUpdateEvent {
  playerId: string;
  updates: {
    positionX?: number;
    positionY?: number;
    credits?: number;
    cargo?: Record<string, number>;
  };
}

class AdminBus extends EventEmitter {
  broadcast(event: AdminBroadcastEvent): void {
    this.emit('adminBroadcast', event);
  }

  questCreated(event: AdminQuestEvent): void {
    this.emit('adminQuestCreated', event);
  }

  playerUpdated(event: AdminPlayerUpdateEvent): void {
    this.emit('adminPlayerUpdate', event);
  }
}

export const adminBus = new AdminBus();
