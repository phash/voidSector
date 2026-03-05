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

class AdminBus extends EventEmitter {
  broadcast(event: AdminBroadcastEvent): void {
    this.emit('adminBroadcast', event);
  }

  questCreated(event: AdminQuestEvent): void {
    this.emit('adminQuestCreated', event);
  }
}

export const adminBus = new AdminBus();
