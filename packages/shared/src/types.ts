export type SectorType = 'empty' | 'nebula' | 'asteroid_field' | 'station' | 'anomaly' | 'pirate';

export type ResourceType = 'ore' | 'gas' | 'crystal';

export interface SectorResources {
  ore: number;
  gas: number;
  crystal: number;
}

export interface Coords {
  x: number;
  y: number;
}

export interface SectorData {
  x: number;
  y: number;
  type: SectorType;
  seed: number;
  discoveredBy: string | null;
  discoveredAt: string | null;
  metadata: Record<string, unknown>;
  resources?: SectorResources;
}

export interface PlayerData {
  id: string;
  username: string;
  homeBase: Coords;
  xp: number;
  level: number;
}

export type ShipClass = 'aegis_scout_mk1' | 'void_seeker_mk2';

export interface ShipData {
  id: string;
  ownerId: string;
  shipClass: ShipClass;
  fuel: number;
  fuelMax: number;
  jumpRange: number;       // max sectors per jump
  apCostJump: number;      // AP cost per jump
  cargoCap: number;        // cargo capacity in units
  scannerLevel: number;
  safeSlots: number;       // rescue pod slots
  active: boolean;
}

export interface FuelState {
  current: number;
  max: number;
}

export interface APState {
  current: number;
  max: number;
  lastTick: number;  // timestamp ms
  regenPerSecond: number;
}

export interface PlayerPosition {
  x: number;
  y: number;
}

// Messages: Client -> Server
export interface JumpMessage {
  targetX: number;
  targetY: number;
}

// Messages: Server -> Client
export interface JumpResultMessage {
  success: boolean;
  error?: string;
  newSector?: SectorData;
  apRemaining?: number;
  fuelRemaining?: number;
}

export interface ScanResultMessage {
  sectors: SectorData[];
  apRemaining: number;
}

export interface ErrorMessage {
  code: string;
  message: string;
}

export interface MiningState {
  active: boolean;
  resource: ResourceType | null;
  sectorX: number;
  sectorY: number;
  startedAt: number | null;
  rate: number;
  sectorYield: number;
}

export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
}

export interface MineMessage {
  resource: ResourceType;
}

export interface JettisonMessage {
  resource: ResourceType;
}

// Local scan
export interface LocalScanResult {
  resources: SectorResources;
  rareResources?: Record<string, number>;
  hiddenObjects?: string[];
  hiddenSignatures: boolean;
}

export type LocalScanMessage = Record<string, never>;

export interface LocalScanResultMessage {
  resources: SectorResources;
  hiddenSignatures: boolean;
}

// Structures
export type StructureType = 'comm_relay' | 'mining_station' | 'base';

export interface Structure {
  id: string;
  ownerId: string;
  type: StructureType;
  sectorX: number;
  sectorY: number;
  createdAt: string;
}

export interface BuildMessage {
  type: StructureType;
}

export interface BuildResultMessage {
  success: boolean;
  error?: string;
  structure?: Structure;
}

// Communication
export type ChatChannel = 'direct' | 'faction' | 'local';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  channel: ChatChannel;
  recipientId?: string;
  content: string;
  sentAt: number;
  delayed: boolean;
}

export interface SendChatMessage {
  channel: ChatChannel;
  recipientId?: string;
  content: string;
}

// Badges
export type BadgeType = 'ORIGIN_FIRST' | 'ORIGIN_REACHED';

export interface Badge {
  playerId: string;
  badgeType: BadgeType;
  awardedAt: string;
}
