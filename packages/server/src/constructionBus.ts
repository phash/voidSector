import { EventEmitter } from 'events';

export interface ConstructionCompletedEvent {
  siteId: string;
  sectorX: number;
  sectorY: number;
  type: string;
  ownerId: string;
  metadata?: Record<string, any> | null;
}

export const constructionBus = new EventEmitter();
constructionBus.setMaxListeners(50);
