import type { Client } from 'colyseus';
import type {
  SectorData,
  ShipStats,
  HullType,
  CombatV2State,
  NpcFactionId,
  ChatMessage,
} from '@void-sector/shared';
import type { FactionBonuses } from '../../engine/factionBonuses.js';
import type { AuthPayload } from '../../auth.js';
import type { SectorRoomState } from '../schema/SectorState.js';

export interface ServiceContext {
  // Room state access
  state: SectorRoomState;
  quadrantX: number;
  quadrantY: number;

  // Per-player caches (Maps stored on room)
  clientShips: Map<string, ShipStats>;
  clientHullTypes: Map<string, HullType>;
  combatV2States: Map<string, CombatV2State>;
  autopilotTimers: Map<string, ReturnType<typeof setInterval>>;
  playerSectorData: Map<string, SectorData>;

  // Helper methods
  checkRate: (sessionId: string, action: string, intervalMs: number) => boolean;
  getShipForClient: (sessionId: string) => ShipStats;
  getPlayerBonuses: (playerId: string) => Promise<FactionBonuses>;

  // Player position helpers
  _px: (sessionId: string) => number;
  _py: (sessionId: string) => number;
  _pst: (sessionId: string) => string;

  // Communication
  send: (client: Client, type: string, data: unknown) => void;
  broadcast: (type: string, data: unknown, options?: { except?: Client }) => void;

  // Chat-specific communication (needs access to clients list)
  broadcastToFaction: (msg: ChatMessage, memberIds: Set<string>) => void;
  broadcastToSector: (msg: ChatMessage, sectorX: number, sectorY: number) => void;
  sendToPlayer: (userId: string, type: string, data: unknown) => void;

  // Dispose callbacks
  disposeCallbacks: Array<() => void>;

  // Room ID for logging
  roomId: string;

  // Cross-service callbacks (methods that stay in SectorRoom for now)
  checkFirstContact: (
    client: Client,
    auth: AuthPayload,
    targetX: number,
    targetY: number,
  ) => Promise<void>;
  checkQuestProgress: (
    client: Client,
    playerId: string,
    action: string,
    context: Record<string, unknown>,
  ) => Promise<void>;
  checkAndEmitDistressCalls: (
    client: Client,
    userId: string,
    playerX: number,
    playerY: number,
  ) => Promise<void>;
  applyReputationChange: (
    playerId: string,
    factionId: NpcFactionId,
    delta: number,
    client: Client,
  ) => Promise<void>;
  applyXpGain: (playerId: string, xp: number, client: Client) => Promise<void>;
}
