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

export interface ScanMessage {}

// Messages: Server -> Client
export interface JumpResultMessage {
  success: boolean;
  error?: string;
  newSector?: SectorData;
  apRemaining?: number;
  fuelRemaining?: number;
}

export interface ScanResultMessage {
  sector: SectorData;
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
