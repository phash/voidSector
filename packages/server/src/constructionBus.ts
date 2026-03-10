import { EventEmitter } from 'events';

export interface ConstructionCompletedEvent {
  siteId: string;
  sectorX: number;
  sectorY: number;
}

export const constructionBus = new EventEmitter();
constructionBus.setMaxListeners(50);
