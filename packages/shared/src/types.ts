export type SectorType = 'empty' | 'nebula' | 'asteroid_field' | 'station' | 'anomaly' | 'pirate';

export type ResourceType = 'ore' | 'gas' | 'crystal';

export type ProcessedItemType = 'fuel_cell' | 'circuit_board' | 'alloy_plate' | 'void_shard' | 'bio_extract';

export type AnyItemType = ResourceType | ProcessedItemType;

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
  credits?: number;
  alienCredits?: number;
  isGuest?: boolean;
}

export type ShipClass = 'aegis_scout_mk1' | 'void_seeker_mk2';

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
  slates: number;
  fuel_cell?: number;
  circuit_board?: number;
  alloy_plate?: number;
  void_shard?: number;
  bio_extract?: number;
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
export type StructureType = 'comm_relay' | 'mining_station' | 'base' | 'storage' | 'trading_post' | 'defense_turret' | 'station_shield' | 'ion_cannon' | 'factory' | 'research_lab' | 'kontor';

export interface Structure {
  id: string;
  ownerId: string;
  type: StructureType;
  sectorX: number;
  sectorY: number;
  createdAt: string;
}

export interface BaseStructure {
  id: string;
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

export interface StorageInventory {
  ore: number;
  gas: number;
  crystal: number;
  fuel_cell?: number;
  circuit_board?: number;
  alloy_plate?: number;
  void_shard?: number;
  bio_extract?: number;
}

export interface TransferMessage {
  resource: ResourceType;
  amount: number;
  direction: 'toStorage' | 'fromStorage';
}

export interface TransferResultMessage {
  success: boolean;
  error?: string;
  cargo?: CargoState;
  storage?: StorageInventory;
}

export interface UpgradeStructureMessage {
  structureId: string;
}

export interface UpgradeResultMessage {
  success: boolean;
  error?: string;
  newTier?: number;
  creditsRemaining?: number;
}

export type TradeOrderType = 'buy' | 'sell';

export interface TradeOrder {
  id: string;
  playerId: string;
  playerName: string;
  resource: ResourceType;
  amount: number;
  pricePerUnit: number;
  type: TradeOrderType;
  createdAt: string;
}

export interface NpcTradeMessage {
  resource: ResourceType;
  amount: number;
  action: 'buy' | 'sell';
}

export interface NpcTradeResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  cargo?: CargoState;
  storage?: StorageInventory;
}

export interface PlaceOrderMessage {
  resource: ResourceType;
  amount: number;
  pricePerUnit: number;
  type: TradeOrderType;
}

export interface AcceptOrderMessage {
  orderId: string;
}

// --- Data Slates ---
export type SlateType = 'sector' | 'area' | 'custom';

export interface SectorSlateData {
  x: number;
  y: number;
  type: string;
  ore: number;
  gas: number;
  crystal: number;
}

export interface DataSlate {
  id: string;
  creatorId: string;
  creatorName?: string;
  ownerId: string;
  slateType: SlateType;
  sectorData: SectorSlateData[];
  status: 'available' | 'listed';
  createdAt: number;
  customData?: CustomSlateData;
}

export interface CreateSlateMessage {
  slateType: SlateType;
}

export interface CreateSlateResultMessage {
  success: boolean;
  error?: string;
  slate?: DataSlate;
  cargo?: CargoState;
  ap?: number;
}

export interface ActivateSlateMessage {
  slateId: string;
}

export interface ActivateSlateResultMessage {
  success: boolean;
  error?: string;
  sectorsAdded?: number;
}

export interface NpcBuybackMessage {
  slateId: string;
}

export interface NpcBuybackResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  creditsEarned?: number;
}

export interface ListSlateMessage {
  slateId: string;
  price: number;
}

// --- Factions ---
export type FactionRank = 'leader' | 'officer' | 'member';
export type FactionJoinMode = 'open' | 'code' | 'invite';
export type FactionInviteStatus = 'pending' | 'accepted' | 'rejected';

export interface Faction {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
  leaderName?: string;
  joinMode: FactionJoinMode;
  inviteCode?: string;
  memberCount?: number;
  createdAt: number;
}

export interface FactionMember {
  playerId: string;
  playerName: string;
  rank: FactionRank;
  joinedAt: number;
  online?: boolean;
}

export interface FactionInvite {
  id: string;
  factionId: string;
  factionName: string;
  factionTag: string;
  inviterName: string;
  status: FactionInviteStatus;
  createdAt: number;
}

export interface CreateFactionMessage {
  name: string;
  tag: string;
  joinMode: FactionJoinMode;
}

export interface CreateFactionResultMessage {
  success: boolean;
  error?: string;
  faction?: Faction;
}

export interface FactionActionMessage {
  action: 'join' | 'joinCode' | 'leave' | 'invite' | 'kick' | 'promote' | 'demote' | 'setJoinMode' | 'disband';
  targetPlayerId?: string;
  targetPlayerName?: string;
  code?: string;
  joinMode?: FactionJoinMode;
}

export interface FactionActionResultMessage {
  success: boolean;
  action: string;
  error?: string;
}

export interface FactionDataMessage {
  faction: Faction | null;
  members: FactionMember[];
  invites: FactionInvite[];
}

// --- Phase 4: NPC Ecosystem ---

// NPC Factions (not player factions — these are game-world NPC groups)
export type NpcFactionId = 'traders' | 'scientists' | 'pirates' | 'ancients' | 'independent';

export type ReputationTier = 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'honored';

export interface PlayerReputation {
  factionId: NpcFactionId;
  reputation: number;
  tier: ReputationTier;
}

export interface StationNpc {
  id: string;
  name: string;
  factionId: NpcFactionId;
  personality: number;
}

export type QuestType = 'fetch' | 'delivery' | 'scan' | 'bounty';
export type QuestStatus = 'active' | 'completed' | 'expired' | 'abandoned';

export interface QuestObjective {
  type: QuestType;
  description: string;
  targetX?: number;
  targetY?: number;
  resource?: ResourceType;
  amount?: number;
  progress?: number;
  fulfilled: boolean;
}

export interface Quest {
  id: string;
  templateId: string;
  npcName: string;
  npcFactionId: NpcFactionId;
  title: string;
  description: string;
  stationX: number;
  stationY: number;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  status: QuestStatus;
  acceptedAt: number;
  expiresAt: number;
}

export interface QuestRewards {
  credits: number;
  xp: number;
  reputation: number;
  reputationPenalty?: number;
  rivalFactionId?: NpcFactionId;
}

export interface AvailableQuest {
  templateId: string;
  npcName: string;
  npcFactionId: NpcFactionId;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  requiredTier: ReputationTier;
}

export type BattleAction = 'flee' | 'fight' | 'negotiate';
export type BattleOutcome = 'victory' | 'defeat' | 'escaped' | 'caught' | 'negotiated';

export interface PirateEncounter {
  pirateLevel: number;
  pirateHp: number;
  pirateDamage: number;
  sectorX: number;
  sectorY: number;
  canNegotiate: boolean;
  negotiateCost: number;
}

export interface BattleResult {
  outcome: BattleOutcome;
  lootCredits?: number;
  lootResources?: Partial<SectorResources>;
  cargoLost?: Partial<SectorResources>;
  repChange?: number;
  xpGained?: number;
}

// Combat v2 types
export type WeaponType = 'laser' | 'railgun' | 'missile' | 'emp' | 'none';
export type CombatTactic = 'assault' | 'balanced' | 'defensive';
export type SpecialAction = 'aim' | 'evade' | 'none';

export interface CombatRound {
  round: number;
  tactic: CombatTactic;
  specialAction: SpecialAction;
  playerAttack: number;
  enemyAttack: number;
  playerShieldDmg: number;
  playerHullDmg: number;
  enemyShieldDmg: number;
  enemyHullDmg: number;
  playerShieldAfter: number;
  playerHpAfter: number;
  enemyShieldAfter: number;
  enemyHpAfter: number;
  specialEffects: string[];
}

export interface CombatV2State {
  encounter: PirateEncounter;
  currentRound: number;
  maxRounds: number;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  playerMaxShield: number;
  playerShieldRegen: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyShield: number;
  enemyMaxShield: number;
  rounds: CombatRound[];
  specialActionsUsed: { aim: boolean; evade: boolean };
  empDisableRounds: number;
  status: 'active' | 'victory' | 'defeat' | 'escaped' | 'auto_flee';
}

export interface CombatV2ActionMessage {
  tactic: CombatTactic;
  specialAction: SpecialAction;
  sectorX: number;
  sectorY: number;
}

export interface CombatV2FleeMessage {
  sectorX: number;
  sectorY: number;
}

export interface CombatV2RoundResult {
  success: boolean;
  error?: string;
  round?: CombatRound;
  state?: CombatV2State;
  finalResult?: BattleResult;
}

// Station combat
export interface StationDefense {
  id: number;
  userId: string;
  sectorX: number;
  sectorY: number;
  defenseType: string;
  installedAt: number;
}

export interface StationCombatEvent {
  stationId: string;
  sectorX: number;
  sectorY: number;
  attackerLevel: number;
  stationHpBefore: number;
  outcome: 'defended' | 'damaged' | 'destroyed';
  hpLost: number;
}

export type ScanEventType = 'pirate_ambush' | 'distress_signal' | 'anomaly_reading' | 'artifact_find';
export type ScanEventStatus = 'discovered' | 'completed';

export interface ScanEvent {
  id: string;
  eventType: ScanEventType;
  sectorX: number;
  sectorY: number;
  status: ScanEventStatus;
  data: Record<string, unknown>;
  createdAt: number;
}

export type UpgradeId = 'cargo_expansion' | 'advanced_scanner' | 'combat_plating' | 'void_drive';

export interface PlayerUpgrade {
  upgradeId: UpgradeId;
  active: boolean;
  unlockedAt: number;
}

// Messages: Client -> Server
export interface AcceptQuestMessage { templateId: string; stationX: number; stationY: number; }
export interface AbandonQuestMessage { questId: string; }
export interface CompleteQuestMessage { questId: string; }
export interface BattleActionMessage { action: BattleAction; sectorX: number; sectorY: number; }
export interface CompleteScanEventMessage { eventId: string; }
export interface GetStationNpcsMessage { sectorX: number; sectorY: number; }
export interface GetAvailableQuestsMessage { sectorX: number; sectorY: number; }

// Messages: Server -> Client
export interface StationNpcsResultMessage { npcs: StationNpc[]; quests: AvailableQuest[]; }
export interface AcceptQuestResultMessage { success: boolean; error?: string; quest?: Quest; }
export interface AbandonQuestResultMessage { success: boolean; error?: string; }
export interface CompleteQuestResultMessage { success: boolean; error?: string; rewards?: QuestRewards; }
export interface BattleResultMessage { success: boolean; error?: string; encounter?: PirateEncounter; result?: BattleResult; }
export interface ScanEventDiscoveredMessage { event: ScanEvent; }
export interface QuestProgressMessage { questId: string; objectives: QuestObjective[]; }
export interface ReputationUpdateMessage { reputations: PlayerReputation[]; upgrades: PlayerUpgrade[]; }
export interface ActiveQuestsMessage { quests: Quest[]; }

// --- Phase 5: Deep Systems ---

// Fuel
export interface RefuelMessage { amount: number; }
export interface RefuelResultMessage { success: boolean; error?: string; fuel?: FuelState; credits?: number; }

// Faction Upgrades (player faction upgrade tree)
export type FactionUpgradeChoice = 'A' | 'B';
export interface FactionUpgradeTier {
  tier: number;
  optionA: { name: string; effect: string; };
  optionB: { name: string; effect: string; };
  cost: number;
}
export interface FactionUpgradeState {
  tier: number;
  choice: FactionUpgradeChoice;
  chosenAt: number;
}
export interface FactionUpgradeMessage { tier: number; choice: FactionUpgradeChoice; }
export interface FactionUpgradeResultMessage { success: boolean; error?: string; upgrades?: FactionUpgradeState[]; }

// JumpGates
export type JumpGateType = 'bidirectional' | 'wormhole';
export interface JumpGate {
  id: string;
  sectorX: number;
  sectorY: number;
  targetX: number;
  targetY: number;
  gateType: JumpGateType;
  requiresCode: boolean;
  requiresMinigame: boolean;
}
export interface JumpGateInfo {
  id: string;
  gateType: JumpGateType;
  requiresCode: boolean;
  requiresMinigame: boolean;
  hasCode: boolean;
}
export interface UseJumpGateMessage { gateId: string; accessCode?: string; }
export interface UseJumpGateResultMessage {
  success: boolean;
  error?: string;
  requiresMinigame?: boolean;
  targetX?: number;
  targetY?: number;
  fuel?: FuelState;
}
export interface FrequencyMatchResultMessage { gateId: string; matched: boolean; }

// Rescue Missions
export interface RescueSurvivor {
  id: string;
  sectorX: number;
  sectorY: number;
  survivorCount: number;
  sourceType: string;
  rescuedAt: number;
}
export interface DistressCall {
  id: string;
  direction: string;
  estimatedDistance: number;
  receivedAt: number;
  expiresAt: number;
  targetX: number;
  targetY: number;
}
export interface RescueMessage { sectorX: number; sectorY: number; }
export interface RescueResultMessage {
  success: boolean;
  error?: string;
  survivorsRescued?: number;
  safeSlotsFree?: number;
}
export interface DeliverSurvivorsMessage { stationX: number; stationY: number; }
export interface DeliverSurvivorsResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  rep?: number;
  xp?: number;
}

// Trade Routes
export interface TradeRoute {
  id: string;
  ownerId: string;
  tradingPostId: string;
  targetX: number;
  targetY: number;
  sellResource: ResourceType | null;
  sellAmount: number;
  buyResource: ResourceType | null;
  buyAmount: number;
  cycleMinutes: number;
  active: boolean;
  lastCycleAt: number | null;
}
export interface ConfigureRouteMessage {
  tradingPostId: string;
  targetX: number;
  targetY: number;
  sellResource: ResourceType | null;
  sellAmount: number;
  buyResource: ResourceType | null;
  buyAmount: number;
  cycleMinutes: number;
}
export interface ConfigureRouteResultMessage {
  success: boolean;
  error?: string;
  route?: TradeRoute;
}
export interface ToggleRouteMessage { routeId: string; active: boolean; }
export interface DeleteRouteMessage { routeId: string; }

// Custom Data Slates (extends existing SlateType)
export interface CustomSlateData {
  label: string;
  coordinates?: Coords[];
  codes?: string[];
  notes?: string;
}
export interface CreateCustomSlateMessage {
  label: string;
  coordinates?: Coords[];
  codes?: string[];
  notes?: string;
}

// --- Bookmarks ---
export interface Bookmark {
  slot: number;
  sectorX: number;
  sectorY: number;
  label: string;
}

export interface SetBookmarkMessage { slot: number; sectorX: number; sectorY: number; label: string; }
export interface ClearBookmarkMessage { slot: number; }

// --- Hyperjump / Autopilot ---
export interface AutopilotState {
  targetX: number;
  targetY: number;
  remaining: number;
  active: boolean;
}

export interface HyperJumpMessage { targetX: number; targetY: number; }
export interface AutopilotUpdateMessage { x: number; y: number; remaining: number; }
export interface AutopilotCompleteMessage { x: number; y: number; }

// --- Phase 7: Ship Designer ---
export type HullType = 'scout' | 'freighter' | 'cruiser' | 'explorer' | 'battleship';
export type HullSize = 'small' | 'medium' | 'large';
export type ModuleCategory = 'drive' | 'cargo' | 'scanner' | 'armor' | 'special' | 'weapon' | 'shield' | 'defense';
export type ModuleTier = 1 | 2 | 3;

export interface HullDefinition {
  name: string;
  size: HullSize;
  slots: number;
  baseFuel: number;
  baseCargo: number;
  baseJumpRange: number;
  baseApPerJump: number;
  baseFuelPerJump: number;
  baseHp: number;
  baseCommRange: number;
  baseScannerLevel: number;
  unlockLevel: number;
  unlockCost: number;
}

export interface ModuleDefinition {
  id: string;
  category: ModuleCategory;
  tier: ModuleTier;
  name: string;
  displayName: string;
  effects: Partial<ShipStats>;
  cost: { credits: number; ore?: number; gas?: number; crystal?: number };
}

export interface ShipModule {
  moduleId: string;
  slotIndex: number;
}

export interface ShipStats {
  fuelMax: number;
  cargoCap: number;
  jumpRange: number;
  apCostJump: number;
  fuelPerJump: number;
  hp: number;
  commRange: number;
  scannerLevel: number;
  damageMod: number;
  // Combat v2
  shieldHp: number;
  shieldRegen: number;
  weaponAttack: number;
  weaponType: WeaponType;
  weaponPiercing: number;
  pointDefense: number;
  ecmReduction: number;
}

export interface ShipRecord {
  id: string;
  ownerId: string;
  hullType: HullType;
  name: string;
  modules: ShipModule[];
  active: boolean;
  createdAt: string;
}

// --- Economy Overhaul ---

export interface NpcStationData {
  stationX: number;
  stationY: number;
  level: number;
  xp: number;
  visitCount: number;
  tradeVolume: number;
}

export interface NpcStationInventoryItem {
  itemType: AnyItemType;
  stock: number;
  maxStock: number;
  buyPrice: number;   // NPC pays this to player (player sells)
  sellPrice: number;  // NPC charges this to player (player buys)
  available: boolean; // can player buy this?
  accepts: boolean;   // can player sell this? (stock < max)
}

export interface NpcStationInfo {
  station: NpcStationData;
  inventory: NpcStationInventoryItem[];
}

export interface GetStationInventoryMessage {
  sectorX: number;
  sectorY: number;
}

export interface StationInventoryResultMessage {
  success: boolean;
  error?: string;
  info?: NpcStationInfo;
}

export interface NpcTradeV2Message {
  itemType: AnyItemType;
  amount: number;
  action: 'buy' | 'sell';
  sectorX: number;
  sectorY: number;
}

export interface NpcTradeV2ResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  cargo?: CargoState;
  storage?: StorageInventory;
  inventory?: NpcStationInventoryItem[];
}

// Production recipes
export interface RecipeInput {
  resource: ResourceType;
  amount: number;
}

export interface ProductionRecipe {
  id: string;
  outputItem: ProcessedItemType;
  outputAmount: number;
  inputs: RecipeInput[];
  cycleSeconds: number;
  researchRequired: string | null;
}

// Factory state (server → client)
export interface FactoryStatus {
  structureId: string;
  activeRecipeId: string | null;
  cycleStartedAt: number | null;
  cycleSeconds: number;
  output: Partial<Record<ProcessedItemType, number>>;
  progress: number; // 0..1
}

export interface FactorySetRecipeMessage {
  structureId: string;
  recipeId: string | null;
}

export interface FactoryCollectMessage {
  structureId: string;
}

export interface FactoryStatusMessage {
  factory: FactoryStatus | null;
}

// Research
export interface ResearchStartMessage {
  recipeId: string;
}

export interface ResearchStatusMessage {
  unlocked: string[];
  active: ActiveResearch | null;
}

export interface ActiveResearch {
  recipeId: string;
  startedAt: number;
  completesAt: number;
}

// Kontor
export interface KontorOrder {
  id: string;
  ownerId: string;
  ownerName?: string;
  sectorX: number;
  sectorY: number;
  itemType: AnyItemType;
  amountWanted: number;
  amountFilled: number;
  pricePerUnit: number;
  budgetReserved: number;
  active: boolean;
  createdAt: number;
}

export interface KontorPlaceOrderMessage {
  itemType: AnyItemType;
  amountWanted: number;
  pricePerUnit: number;
}

export interface KontorCancelOrderMessage {
  orderId: string;
}

export interface KontorSellMessage {
  orderId: string;
  amount: number;
}

export interface KontorOrdersMessage {
  orders: KontorOrder[];
}
