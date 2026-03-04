/**
 * adminBus — in-process event bus for admin → game-room communication.
 *
 * Because the admin REST routes and the Colyseus SectorRooms run in the
 * same Node.js process we can use a plain event bus as a zero-latency
 * message channel. SectorRooms subscribe on creation and unsubscribe on
 * dispose, so there are no dangling listeners.
 *
 * Uses a minimal self-contained implementation to avoid requiring @types/node.
 */

export interface AdminBroadcast {
  id: string;
  adminName: string;
  scope: 'universal' | 'quadrant' | 'individual';
  content: string;
  /** For 'quadrant' scope: sector coordinates */
  targetSectorX?: number;
  targetSectorY?: number;
  /** For 'individual' scope: player IDs */
  targetPlayerIds?: string[];
  allowReply: boolean;
  sentAt: number;
}

export interface AdminQuestOffer {
  adminQuestId: string;
  scope: 'universal' | 'individual' | 'sector';
  title: string;
  description: string;
  objectives: unknown[];
  rewards: unknown;
  npcName: string;
  npcFactionId: string;
  introText?: string | null;
  /** For 'individual': which players to offer to */
  targetPlayerIds?: string[];
  /** For 'sector': which sector hosts this quest */
  targetSectorX?: number;
  targetSectorY?: number;
}

export interface AdminGameEvent {
  eventType: string;
  label?: string;
  payload: Record<string, unknown>;
  targetSectorX?: number;
  targetSectorY?: number;
}

// ── Minimal typed event bus ────────────────────────────────────────────────────

type AdminBusEvents = {
  'admin:comm': AdminBroadcast;
  'admin:questOffer': AdminQuestOffer;
  'admin:event': AdminGameEvent;
};

type EventKey = keyof AdminBusEvents;

class AdminBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _listeners: Map<EventKey, Set<(p: any) => void>> = new Map();

  on<K extends EventKey>(event: K, fn: (payload: AdminBusEvents[K]) => void): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(fn);
  }

  off<K extends EventKey>(event: K, fn: (payload: AdminBusEvents[K]) => void): void {
    this._listeners.get(event)?.delete(fn);
  }

  private _emit<K extends EventKey>(event: K, payload: AdminBusEvents[K]): void {
    this._listeners.get(event)?.forEach(fn => {
      try { fn(payload); } catch (err) {
        console.error(`[adminBus] handler error for ${event}:`, err);
      }
    });
  }

  /** Broadcast a COMM message to relevant rooms */
  broadcastComm(msg: AdminBroadcast): void {
    this._emit('admin:comm', msg);
  }

  /** Offer an admin quest to relevant rooms */
  offerQuest(offer: AdminQuestOffer): void {
    this._emit('admin:questOffer', offer);
  }

  /** Trigger a game event in relevant rooms */
  triggerEvent(event: AdminGameEvent): void {
    this._emit('admin:event', event);
  }
}

// Singleton — imported by both adminRoutes.ts and SectorRoom.ts
export const adminBus = new AdminBus();
