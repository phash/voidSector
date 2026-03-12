import type { StateCreator } from 'zustand';
import { BURST_DURATION } from '../canvas/RadarRenderer';
import type {
  APState,
  SectorData,
  Coords,
  FuelState,
  MiningState,
  CargoState,
  ChatMessage,
  ChatChannel,
  StorageInventory,
  TradeOrder,
  DataSlate,
  Faction,
  FactionMember,
  FactionInvite,
  Quest,
  PlayerReputation,
  PlayerUpgrade,
  PirateEncounter,
  BattleResult,
  ScanEvent,
  JumpGateInfo,
  JumpGateMapEntry,
  RescueSurvivor,
  DistressCall,
  FactionUpgradeState,
  TradeRoute,
  Bookmark,
  AutopilotState,
  ShipRecord,
  ShipStats,
  ShipModule,
  HullType,
  CombatV2State,
  StationDefense,
  StationCombatEvent,
  ResearchState,
  FirstContactEvent,
  HyperdriveState,
  AutoRefuelConfig,
  PlayerJumpGate,
  JumpGateDestination,
  QuadrantControlState,
  NpcFleetState,
  CivShip,
  WarTickerEvent,
  InventoryItem,
  ConstructionSiteState,
  QuestRewards,
} from '@void-sector/shared';

export interface QuestCompleteEntry {
  id: string;
  title: string;
  rewards: QuestRewards;
}

/**
 * Extended ship data as sent by the server in the new ship designer system.
 * Combines ShipRecord fields with computed stats and current fuel.
 */
export interface ClientShipData {
  id: string;
  ownerId: string;
  hullType: HullType;
  name: string;
  modules: ShipModule[];
  stats: ShipStats;
  fuel: number;
  active: boolean;
  acepXp?: { ausbau: number; intel: number; kampf: number; explorer: number; total: number };
  acepEffects?: {
    extraModuleSlots: number;
    cargoMultiplier: number;
    miningBonus: number;
    scanRadiusBonus: number;
    combatDamageBonus: number;
    ancientDetection: boolean;
    helionDecoderEnabled: boolean;
  };
  acepGeneration?: number;
  acepTraits?: string[];
}

export interface RecruitingFaction {
  factionId: string;
  name: string;
  color: string | null;
  slogan: string | null;
  memberCount: number;
}

export interface AutopilotStatusInfo {
  targetX: number;
  targetY: number;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'paused' | 'complete';
  useHyperjump: boolean;
  pauseReason?: string;
  eta?: number;
}

export interface StoryEventPayload {
  chapterId: number;
  title: string;
  flavorText: string;
  branches?: Array<{ id: string; label: string }>;
}

export interface AlienEncounterEventPayload {
  factionId: string;
  eventType: string;
  eventText: string;
  canRespond: boolean;
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
  humanityTier?: 'FEINDSELIG' | 'NEUTRAL' | 'FREUNDLICH';
}

export interface StoryProgressPayload {
  currentChapter: number;
  completedChapters: number[];
  branchChoices: Record<string, string>;
  chapters: Array<{ id: number; title: string; minQDist: number; hasBranch: boolean }>;
}

export interface TrackedQuest {
  questId: string;
  title: string;
  type: string;
  description: string;
  targetX?: number;
  targetY?: number;
}

export interface CommunityQuestPayload {
  id: number;
  title: string;
  description: string | null;
  targetCount: number;
  currentCount: number;
  rewardType: string | null;
  expiresAt: number | null;
  status: string;
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded or private mode */
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

// ─── Kampfsystem v1 client types ────────────────────────────────────────────

export interface ClientModule {
  moduleId: string;
  category: string;
  tier: number;
  currentHp: number;
  maxHp: number;
  powerLevel: 'off' | 'low' | 'mid' | 'high';
}

export interface ClientEnemyModule {
  category: string;
  tier: number;
  currentHp: number;
  maxHp: number;
  powerLevel: 'off' | 'low' | 'mid' | 'high';
  revealed: boolean;
}

export interface ClientCombatState {
  playerHp: number;
  playerMaxHp: number;
  playerModules: ClientModule[];
  epBuffer: number;
  maxEpBuffer: number;
  enemyType: string;
  enemyLevel: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyModules: ClientEnemyModule[];
  round: number;
  ancientChargeRounds: number;
  ancientAbilityUsed: boolean;
  log: string[];
  outcome?: 'ongoing' | 'victory' | 'defeat' | 'fled' | 'draw' | 'ejected';
  loot?: { credits?: number; ore?: number; crystal?: number };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerStats {
  sectorsScanned: number;
  quadrantsVisited: string[]; // "qx:qy" keys
  quadrantsFirstDiscovered: number;
  stationsVisited: string[]; // "x:y" keys
  playersEncountered: number;
}

const PLAYER_STATS_KEY = 'vs-player-stats';

const defaultPlayerStats: PlayerStats = {
  sectorsScanned: 0,
  quadrantsVisited: [],
  quadrantsFirstDiscovered: 0,
  stationsVisited: [],
  playersEncountered: 0,
};

function loadPlayerStats(): PlayerStats {
  const raw = safeGetItem(PLAYER_STATS_KEY);
  if (!raw) return { ...defaultPlayerStats };
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultPlayerStats, ...parsed };
  } catch {
    return { ...defaultPlayerStats };
  }
}

function savePlayerStats(stats: PlayerStats): void {
  safeSetItem(PLAYER_STATS_KEY, JSON.stringify(stats));
}

export interface PlayerPresence {
  sessionId: string;
  username: string;
  x: number;
  y: number;
  connected: boolean;
}

export interface BountyEncounterState {
  questId: string;
  targetName: string;
  targetLevel: number;
  sectorX: number;
  sectorY: number;
}

export interface GameSlice {
  // Auth
  token: string | null;
  playerId: string | null;
  username: string | null;
  isGuest: boolean;

  // Position
  position: Coords;
  visitedTrail: Coords[];

  // AP & Fuel
  ap: APState | null;
  fuel: FuelState | null;

  // Ship (new designer format)
  ship: ClientShipData | null;

  // Current sector
  currentSector: SectorData | null;

  // Players in current sector
  players: Record<string, PlayerPresence>;

  // Discovered sectors (fog of war map)
  discoveries: Record<string, SectorData>;

  // Event log
  log: string[];

  // Inline action error (shown near the action that caused it)
  actionError: { code: string; message: string } | null;

  // Mining
  mining: MiningState | null;
  miningStoryIndex: number;

  // Cargo
  cargo: CargoState;

  // Active monitor
  activeMonitor: string;

  // Chat / COMMS
  chatMessages: ChatMessage[];
  chatChannel: ChatChannel;
  recentContacts: Array<{ id: string; name: string }>;
  channelAlerts: Record<string, boolean>;

  // Alerts
  alerts: Record<string, boolean>;

  // Selected sector (radar click)
  selectedSector: { x: number; y: number } | null;

  // LocalScan result popup
  localScanResult: {
    resources: { ore: number; gas: number; crystal: number };
    hiddenSignatures: boolean;
    wrecks?: Array<{
      id: string;
      playerName: string;
      radarIconData: { tier: number; path: string };
      lastLogEntry: string | null;
      hasSalvage: boolean;
    }>;
    sectorX?: number;
    sectorY?: number;
    quadrantX?: number;
    quadrantY?: number;
    sectorType?: string;
    structures?: string[];
    universeTick?: number;
  } | null;

  // Base
  baseStructures: any[];

  // Credits
  credits: number;
  alienCredits: number;
  alienReputations: Record<string, number>;
  humanityReps: Record<string, { repValue: number; tier: 'FEINDSELIG' | 'NEUTRAL' | 'FREUNDLICH' }>;

  // Storage
  storage: StorageInventory;

  // Trade orders
  tradeOrders: TradeOrder[];
  myOrders: TradeOrder[];

  // Data Slates
  mySlates: DataSlate[];

  // Faction
  faction: Faction | null;
  recruitingFactions: RecruitingFaction[];
  factionMembers: FactionMember[];
  factionInvites: FactionInvite[];

  // Phase 4: NPC Ecosystem
  activeQuests: Quest[];
  reputations: PlayerReputation[];
  playerUpgrades: PlayerUpgrade[];
  activeBattle: PirateEncounter | null;
  bountyEncounter: BountyEncounterState | null;
  lastBattleResult: { encounter: PirateEncounter; result: BattleResult } | null;
  activeCombatV2: CombatV2State | null;
  stationDefenses: StationDefense[];
  stationCombatEvent: StationCombatEvent | null;
  scanEvents: ScanEvent[];

  // Kampfsystem v1 — energy-based round combat
  activeCombat: ClientCombatState | null;

  // Phase 5: Deep Systems
  jumpGateInfo: JumpGateInfo | null;
  knownJumpGates: JumpGateMapEntry[];
  rescuedSurvivors: RescueSurvivor[];
  distressCalls: DistressCall[];
  factionUpgrades: FactionUpgradeState[];
  tradeRoutes: TradeRoute[];

  // Bookmarks
  bookmarks: Bookmark[];

  // Autopilot / Hyperjump
  autopilot: AutopilotState | null;
  slowFlightActive: boolean;
  discoveryTimestamps: Record<string, number>;

  // Brightness burst: sector keys → timestamp when revealed by area scan
  scanBurstTimestamps: Record<string, number>;

  // Hyperdrive
  hyperdriveState: HyperdriveState | null;
  autoRefuelConfig: AutoRefuelConfig;

  // Territory claims for QUAD-MAP overlay (quadrantKey "qx:qy" → player_name)
  territoryMap: Record<string, { playerName: string; playerId: string; defenseRating: string }>;

  // Ship designer
  shipList: (ShipRecord & { stats: ShipStats })[];
  moduleInventory: string[];
  baseName: string;

  // Research / Tech tree
  research: ResearchState;
  typedArtefacts: Record<string, number>;
  labTier: number;
  pendingBlueprint: string | null;

  // NPC Station
  npcStationData: {
    level: number;
    name: string;
    xp: number;
    nextLevelXp: number;
    inventory: Array<{
      itemType: string;
      stock: number;
      maxStock: number;
      buyPrice: number;
      sellPrice: number;
    }>;
  } | null;

  // Factory
  factoryState: {
    activeRecipe: {
      id: string;
      outputItem: string;
      outputAmount: number;
      cycleSeconds: number;
    } | null;
    progress: number;
    completedCycles: number;
    output: Record<string, number>;
    error?: string;
  } | null;

  // Kontor
  kontorOrders: Array<{
    id: string;
    ownerId: string;
    itemType: string;
    amountWanted: number;
    amountFilled: number;
    pricePerUnit: number;
    active: boolean;
  }>;

  // Nav target (for autopilot UI)
  navTarget: { x: number; y: number } | null;
  autopilotStatus: AutopilotStatusInfo | null;

  // UI selection state (#103, #104, #107)
  selectedTechModule: string | null;
  selectedBaseStructure: string | null;
  selectedCargoItem: string | null;
  selectedQuest: string | null;

  // Direct chat pre-selection (from context menu)
  directChatRecipient: { id: string; name: string } | null;

  // Player stats (logbuch)
  playerStats: PlayerStats;

  // Ship move animation (#155)
  shipMoveAnimation: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    startTime: number;
    duration: number;
  } | null;

  // Player Gates
  playerGateInfo: { gate: PlayerJumpGate; destinations: JumpGateDestination[] } | null;

  // Quadrant system
  knownQuadrants: Array<{
    qx: number;
    qy: number;
    learnedAt: string;
    name?: string;
    discoveredByName?: string;
  }>;
  currentQuadrant: { qx: number; qy: number; name?: string | null } | null;
  firstContactEvent: FirstContactEvent | null;

  // News events
  newsItems: Array<{
    id: number;
    event_type: string;
    headline: string;
    summary: string | null;
    player_name: string | null;
    quadrant_x: number | null;
    quadrant_y: number | null;
    created_at: string;
  }>;

  // Ancient Ruins
  activeAncientRuinScan: {
    fragmentIndex: number;
    fragmentText: string;
    ruinLevel: 1 | 2 | 3;
    artefactFound: boolean;
    sectorX: number;
    sectorY: number;
  } | null;
  loreFragmentCount: number;

  // QuadMap Fog-of-War
  visitedQuadrants: Set<string>; // "qx:qy" keys of physically visited quadrants

  // Quest completion
  questCompleteQueue: QuestCompleteEntry[];

  // AQ Story / Community
  storyEvent: StoryEventPayload | null;
  alienEncounterEvent: AlienEncounterEventPayload | null;
  storyProgress: StoryProgressPayload | null;
  activeCommunityQuest: CommunityQuestPayload | null;

  // Expansion & Warfare
  quadrantControls: QuadrantControlState[];
  npcFleets: NpcFleetState[];
  civShips: CivShip[];
  warTicker: WarTickerEvent[];

  // Construction Sites
  constructionSites: ConstructionSiteState[];

  // Unified Inventory
  inventory: InventoryItem[];

  // Tracked quests
  trackedQuests: TrackedQuest[];

  // Trade feedback (partial sell message)
  tradeMessage: string | null;

  // Actions
  setAuth: (token: string, playerId: string, username: string, isGuest?: boolean) => void;
  clearAuth: () => void;
  setPosition: (pos: Coords) => void;
  pushTrail: (pos: Coords) => void;
  setAP: (ap: APState) => void;
  setFuel: (fuel: FuelState) => void;
  setShip: (ship: ClientShipData) => void;
  setCurrentSector: (sector: SectorData) => void;
  setPlayer: (sessionId: string, player: PlayerPresence) => void;
  removePlayer: (sessionId: string) => void;
  clearPlayers: () => void;
  addDiscoveries: (sectors: SectorData[]) => void;
  addLogEntry: (message: string) => void;
  setActionError: (error: { code: string; message: string } | null) => void;
  setTradeMessage: (message: string | null) => void;
  setActiveMonitor: (monitor: string) => void;
  setMining: (mining: MiningState) => void;
  setMiningStoryIndex: (index: number) => void;
  setCargo: (cargo: CargoState) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatChannel: (channel: ChatChannel) => void;
  addRecentContact: (id: string, name: string) => void;
  setChannelAlert: (channel: string, active: boolean) => void;
  clearChannelAlert: (channel: string) => void;
  setAlert: (monitorId: string, active: boolean) => void;
  clearAlert: (monitorId: string) => void;
  setSelectedSector: (sector: { x: number; y: number } | null) => void;
  setLocalScanResult: (result: GameSlice['localScanResult']) => void;
  setBaseStructures: (structures: any[]) => void;
  setCredits: (credits: number) => void;
  setStorage: (storage: StorageInventory) => void;
  setTradeOrders: (orders: TradeOrder[]) => void;
  setMyOrders: (orders: TradeOrder[]) => void;
  setMySlates: (slates: DataSlate[]) => void;
  setFaction: (faction: Faction | null) => void;
  setFactionMembers: (members: FactionMember[]) => void;
  setFactionInvites: (invites: FactionInvite[]) => void;
  setActiveQuests: (quests: Quest[]) => void;
  setReputations: (reps: PlayerReputation[]) => void;
  setPlayerUpgrades: (upgrades: PlayerUpgrade[]) => void;
  setActiveBattle: (encounter: PirateEncounter | null) => void;
  setBountyEncounter: (encounter: BountyEncounterState | null) => void;
  setLastBattleResult: (
    result: { encounter: PirateEncounter; result: BattleResult } | null,
  ) => void;
  setActiveCombatV2: (activeCombatV2: CombatV2State | null) => void;
  setActiveCombat: (state: ClientCombatState | null) => void;
  setStationDefenses: (stationDefenses: StationDefense[]) => void;
  setStationCombatEvent: (stationCombatEvent: StationCombatEvent | null) => void;
  setScanEvents: (events: ScanEvent[]) => void;
  addScanEvent: (event: ScanEvent) => void;
  removeScanEvent: (eventId: string) => void;
  setJumpGateInfo: (gate: JumpGateInfo | null) => void;
  setKnownJumpGates: (gates: JumpGateMapEntry[]) => void;
  setRescuedSurvivors: (survivors: RescueSurvivor[]) => void;
  addDistressCall: (call: DistressCall) => void;
  removeDistressCall: (id: string) => void;
  setFactionUpgrades: (upgrades: FactionUpgradeState[]) => void;
  setRecruitingFactions: (factions: RecruitingFaction[]) => void;
  setTradeRoutes: (routes: TradeRoute[]) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setAutopilot: (state: AutopilotState | null) => void;
  setSlowFlightActive: (active: boolean) => void;
  setDiscoveryTimestamps: (timestamps: Record<string, number>) => void;
  addScanBurstTimestamps: (keys: string[], now: number) => void;
  setTerritoryMap: (
    map: Record<string, { playerName: string; playerId: string; defenseRating: string }>,
  ) => void;
  setShipList: (ships: (ShipRecord & { stats: ShipStats })[]) => void;
  setModuleInventory: (modules: string[]) => void;
  setBaseName: (name: string) => void;
  setResearch: (research: ResearchState) => void;
  setTypedArtefacts: (artefacts: Record<string, number>) => void;
  setLabTier: (tier: number) => void;
  setPendingBlueprint: (moduleId: string | null) => void;
  setNpcStationData: (data: GameSlice['npcStationData']) => void;
  setFactoryState: (data: GameSlice['factoryState']) => void;
  setKontorOrders: (orders: GameSlice['kontorOrders']) => void;
  startShipMoveAnimation: (fromX: number, fromY: number, toX: number, toY: number) => void;
  clearShipMoveAnimation: () => void;
  setPlayerGateInfo: (
    info: { gate: PlayerJumpGate; destinations: JumpGateDestination[] } | null,
  ) => void;
  setKnownQuadrants: (quadrants: Array<{ qx: number; qy: number; learnedAt: string }>) => void;
  setCurrentQuadrant: (q: { qx: number; qy: number; name?: string | null } | null) => void;
  setFirstContactEvent: (event: FirstContactEvent | null) => void;
  setActiveAncientRuinScan: (scan: GameSlice['activeAncientRuinScan']) => void;
  setNewsItems: (items: GameSlice['newsItems']) => void;
  setHyperdriveState: (state: HyperdriveState | null) => void;
  setAutoRefuelConfig: (config: AutoRefuelConfig) => void;
  setNavTarget: (target: { x: number; y: number } | null) => void;
  setAutopilotStatus: (status: AutopilotStatusInfo | null) => void;
  setSelectedTechModule: (id: string | null) => void;
  setSelectedBaseStructure: (id: string | null) => void;
  setSelectedCargoItem: (item: string | null) => void;
  setSelectedQuest: (questId: string | null) => void;
  setDirectChatRecipient: (recipient: { id: string; name: string } | null) => void;
  incrementStat: (key: keyof PlayerStats) => void;
  addToStatSet: (key: 'quadrantsVisited' | 'stationsVisited', value: string) => void;
  setVisitedQuadrants: (quadrants: Array<{ qx: number; qy: number }>) => void;
  addQuestComplete: (entry: QuestCompleteEntry) => void;
  shiftQuestComplete: () => void;
  setStoryEvent: (e: StoryEventPayload | null) => void;
  setAlienEncounterEvent: (e: AlienEncounterEventPayload | null) => void;
  setStoryProgress: (p: StoryProgressPayload | null) => void;
  setActiveCommunityQuest: (q: CommunityQuestPayload | null) => void;
  setHumanityReps: (
    reps: Record<string, { repValue: number; tier: 'FEINDSELIG' | 'NEUTRAL' | 'FREUNDLICH' }>,
  ) => void;
  setQuadrantControls: (controls: QuadrantControlState[]) => void;
  setNpcFleets: (fleets: NpcFleetState[]) => void;
  setCivShips: (ships: CivShip[]) => void;
  addWarTickerEvent: (event: WarTickerEvent) => void;
  setInventory: (items: InventoryItem[]) => void;
  setTrackedQuests: (quests: TrackedQuest[]) => void;
  setConstructionSites: (sites: ConstructionSiteState[]) => void;
  upsertConstructionSite: (site: ConstructionSiteState) => void;
  removeConstructionSite: (siteId: string) => void;
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set, get) => ({
  token: safeGetItem('vs_token'),
  playerId: safeGetItem('vs_playerId'),
  username: safeGetItem('vs_username'),
  isGuest: safeGetItem('vs_isGuest') === 'true',
  position: { x: 0, y: 0 },
  visitedTrail: [],
  ap: null,
  fuel: null,
  ship: null,
  currentSector: null,
  players: {},
  discoveries: {},
  log: [],
  actionError: null,
  mining: null,
  miningStoryIndex: 0,
  cargo: {
    ore: 0,
    gas: 0,
    crystal: 0,
    slates: 0,
    artefact: 0,
    artefact_drive: 0,
    artefact_cargo: 0,
    artefact_scanner: 0,
    artefact_armor: 0,
    artefact_weapon: 0,
    artefact_shield: 0,
    artefact_defense: 0,
    artefact_special: 0,
    artefact_mining: 0,
  },
  activeMonitor: 'NAV-COM',
  chatMessages: [],
  chatChannel: 'quadrant' as ChatChannel,
  recentContacts: [],
  channelAlerts: {},
  alerts: {},
  selectedSector: null,
  localScanResult: null,
  baseStructures: [],
  credits: 0,
  alienCredits: 0,
  alienReputations: {},
  humanityReps: {},
  storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
  tradeOrders: [],
  myOrders: [],
  mySlates: [],
  faction: null,
  recruitingFactions: [],
  factionMembers: [],
  factionInvites: [],
  activeQuests: [],
  reputations: [],
  playerUpgrades: [],
  activeBattle: null,
  bountyEncounter: null,
  lastBattleResult: null,
  activeCombatV2: null,
  activeCombat: null,
  stationDefenses: [],
  stationCombatEvent: null,
  scanEvents: [],
  jumpGateInfo: null,
  knownJumpGates: [],
  rescuedSurvivors: [],
  distressCalls: [],
  factionUpgrades: [],
  tradeRoutes: [],
  bookmarks: [],
  autopilot: null,
  slowFlightActive: false,
  discoveryTimestamps: {},
  scanBurstTimestamps: {},
  territoryMap: {},
  shipList: [],
  moduleInventory: [],
  baseName: '',
  research: {
    unlockedModules: [],
    blueprints: [],
    activeResearch: null,
    activeResearch2: null,
    wissen: 0,
    wissenRate: 0,
  },
  typedArtefacts: {} as Record<string, number>,
  labTier: 0,
  pendingBlueprint: null,
  npcStationData: null,
  factoryState: null,
  kontorOrders: [],
  navTarget: null,
  autopilotStatus: null,
  selectedTechModule: null,
  selectedBaseStructure: null,
  selectedCargoItem: null,
  selectedQuest: null,
  directChatRecipient: null,
  playerStats: loadPlayerStats(),
  shipMoveAnimation: null,
  playerGateInfo: null,
  knownQuadrants: [],
  currentQuadrant: null,
  firstContactEvent: null,
  activeAncientRuinScan: null,
  loreFragmentCount: 0,
  newsItems: [],
  hyperdriveState: null,
  autoRefuelConfig: { enabled: false, maxPricePerUnit: 10 },
  visitedQuadrants: new Set<string>(),
  questCompleteQueue: [],
  storyEvent: null,
  alienEncounterEvent: null,
  storyProgress: null,
  activeCommunityQuest: null,
  quadrantControls: [],
  npcFleets: [],
  civShips: [],
  warTicker: [],
  inventory: [],
  trackedQuests: [],
  constructionSites: [],
  tradeMessage: null,

  setAuth: (token, playerId, username, isGuest = false) => {
    safeSetItem('vs_token', token);
    safeSetItem('vs_playerId', playerId);
    safeSetItem('vs_username', username);
    if (isGuest) safeSetItem('vs_isGuest', 'true');
    else safeRemoveItem('vs_isGuest');
    set({ token, playerId, username, isGuest });
  },

  clearAuth: () => {
    safeRemoveItem('vs_token');
    safeRemoveItem('vs_playerId');
    safeRemoveItem('vs_username');
    safeRemoveItem('vs_isGuest');
    set({ token: null, playerId: null, username: null, isGuest: false });
  },

  setPosition: (pos) => {
    const old = get().position;
    if (old.x !== pos.x || old.y !== pos.y) {
      get().pushTrail(old);
    }
    set({ position: pos });
  },

  pushTrail: (pos) => {
    const trail = get().visitedTrail;
    if (trail.length > 0 && trail[0].x === pos.x && trail[0].y === pos.y) return;
    set({ visitedTrail: [pos, ...trail].slice(0, 9) });
  },

  setAP: (ap) => set({ ap }),
  setFuel: (fuel) => set({ fuel }),
  setShip: (ship) => set({ ship }),
  setCurrentSector: (sector) => set({ currentSector: sector }),

  setPlayer: (sessionId, player) =>
    set((s) => ({ players: { ...s.players, [sessionId]: player } })),

  removePlayer: (sessionId) =>
    set((s) => {
      const next = { ...s.players };
      delete next[sessionId];
      return { players: next };
    }),

  clearPlayers: () => set({ players: {} }),

  addDiscoveries: (sectors) =>
    set((s) => {
      const next = { ...s.discoveries };
      for (const sector of sectors) {
        next[`${sector.x}:${sector.y}`] = sector;
      }
      return { discoveries: next };
    }),

  addLogEntry: (message) =>
    set((s) => ({
      log: [...s.log.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`],
    })),

  setActionError: (actionError) => set({ actionError }),
  setTradeMessage: (tradeMessage) => set({ tradeMessage }),

  setActiveMonitor: (activeMonitor) => set({ activeMonitor }),
  setMining: (mining) => set({ mining }),
  setMiningStoryIndex: (index) => set({ miningStoryIndex: index }),
  setCargo: (cargo) => set({ cargo }),

  addChatMessage: (msg) =>
    set((s) => {
      // Deduplicate by message ID
      if (s.chatMessages.some((m) => m.id === msg.id)) return s;
      return { chatMessages: [...s.chatMessages.slice(-199), msg] };
    }),
  setChatChannel: (chatChannel) =>
    set((s) => {
      const next = { ...s.channelAlerts };
      delete next[chatChannel];
      return { chatChannel, channelAlerts: next };
    }),
  addRecentContact: (id, name) =>
    set((s) => {
      const MAX_CONTACTS = 20;
      const filtered = s.recentContacts.filter((c) => c.id !== id);
      return { recentContacts: [{ id, name }, ...filtered].slice(0, MAX_CONTACTS) };
    }),
  setChannelAlert: (channel, active) =>
    set((s) => ({
      channelAlerts: { ...s.channelAlerts, [channel]: active },
    })),
  clearChannelAlert: (channel) =>
    set((s) => {
      const next = { ...s.channelAlerts };
      delete next[channel];
      return { channelAlerts: next };
    }),
  setAlert: (monitorId, active) =>
    set((s) => ({
      alerts: { ...s.alerts, [monitorId]: active },
    })),
  clearAlert: (monitorId) =>
    set((s) => {
      const next = { ...s.alerts };
      delete next[monitorId];
      return { alerts: next };
    }),
  setSelectedSector: (selectedSector) => set({ selectedSector }),
  setLocalScanResult: (localScanResult) => set({ localScanResult }),
  setBaseStructures: (baseStructures) => set({ baseStructures }),
  setCredits: (credits) => set({ credits }),
  setStorage: (storage) => set({ storage }),
  setTradeOrders: (tradeOrders) => set({ tradeOrders }),
  setMyOrders: (myOrders) => set({ myOrders }),
  setMySlates: (mySlates) => set({ mySlates }),
  setFaction: (faction) => set({ faction }),
  setFactionMembers: (factionMembers) => set({ factionMembers }),
  setFactionInvites: (factionInvites) => set({ factionInvites }),
  setActiveQuests: (activeQuests) => set({ activeQuests }),
  setReputations: (reputations) => set({ reputations }),
  setPlayerUpgrades: (playerUpgrades) => set({ playerUpgrades }),
  setActiveBattle: (activeBattle) => set({ activeBattle }),
  setBountyEncounter: (bountyEncounter) => set({ bountyEncounter }),
  setLastBattleResult: (lastBattleResult) => set({ lastBattleResult }),
  setActiveCombatV2: (activeCombatV2) => set({ activeCombatV2 }),
  setActiveCombat: (activeCombat) => set({ activeCombat }),
  setStationDefenses: (stationDefenses) => set({ stationDefenses }),
  setStationCombatEvent: (stationCombatEvent) => set({ stationCombatEvent }),
  setScanEvents: (scanEvents) => set({ scanEvents }),
  addScanEvent: (event) => set((s) => ({ scanEvents: [...s.scanEvents, event] })),
  removeScanEvent: (eventId) =>
    set((s) => ({ scanEvents: s.scanEvents.filter((e) => e.id !== eventId) })),
  setJumpGateInfo: (jumpGateInfo) => set({ jumpGateInfo }),
  setKnownJumpGates: (knownJumpGates) => set({ knownJumpGates }),
  setRescuedSurvivors: (rescuedSurvivors) => set({ rescuedSurvivors }),
  addDistressCall: (call) => set((s) => ({ distressCalls: [...s.distressCalls, call] })),
  removeDistressCall: (id) =>
    set((s) => ({ distressCalls: s.distressCalls.filter((d) => d.id !== id) })),
  setFactionUpgrades: (factionUpgrades) => set({ factionUpgrades }),
  setRecruitingFactions: (recruitingFactions) => set({ recruitingFactions }),
  setTradeRoutes: (tradeRoutes) => set({ tradeRoutes }),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  setAutopilot: (autopilot) => set({ autopilot }),
  setSlowFlightActive: (slowFlightActive) => set({ slowFlightActive }),
  setDiscoveryTimestamps: (discoveryTimestamps) => set({ discoveryTimestamps }),
  addScanBurstTimestamps: (keys, now) =>
    set((s) => {
      const updated = { ...s.scanBurstTimestamps };
      for (const k of keys) updated[k] = now;
      // Remove stale entries (older than BURST_DURATION)
      for (const k of Object.keys(updated)) {
        if (now - updated[k] > BURST_DURATION) delete updated[k];
      }
      return { scanBurstTimestamps: updated };
    }),
  setTerritoryMap: (territoryMap) => set({ territoryMap }),
  setShipList: (shipList) => set({ shipList }),
  setModuleInventory: (moduleInventory) => set({ moduleInventory }),
  setBaseName: (baseName) => set({ baseName }),
  setResearch: (research) => set({ research }),
  setTypedArtefacts: (artefacts) => set({ typedArtefacts: artefacts }),
  setLabTier: (tier) => set({ labTier: tier }),
  setPendingBlueprint: (pendingBlueprint) => set({ pendingBlueprint }),
  setNpcStationData: (npcStationData) => set({ npcStationData }),
  setFactoryState: (factoryState) => set({ factoryState }),
  setKontorOrders: (kontorOrders) => set({ kontorOrders }),
  startShipMoveAnimation: (fromX, fromY, toX, toY) =>
    set({
      shipMoveAnimation: { fromX, fromY, toX, toY, startTime: performance.now(), duration: 600 },
    }),
  clearShipMoveAnimation: () => set({ shipMoveAnimation: null }),
  setPlayerGateInfo: (playerGateInfo) => set({ playerGateInfo }),
  setKnownQuadrants: (knownQuadrants) => set({ knownQuadrants }),
  setCurrentQuadrant: (currentQuadrant) => set({ currentQuadrant }),
  setFirstContactEvent: (firstContactEvent) => set({ firstContactEvent }),
  setActiveAncientRuinScan: (activeAncientRuinScan) =>
    set((s) => ({
      activeAncientRuinScan,
      loreFragmentCount: activeAncientRuinScan ? s.loreFragmentCount + 1 : s.loreFragmentCount,
    })),
  setNewsItems: (newsItems) => set({ newsItems }),
  setHyperdriveState: (hyperdriveState) => set({ hyperdriveState }),
  setAutoRefuelConfig: (autoRefuelConfig) => set({ autoRefuelConfig }),
  setNavTarget: (navTarget) => set({ navTarget }),
  setAutopilotStatus: (autopilotStatus) => set({ autopilotStatus }),
  setSelectedTechModule: (selectedTechModule) => set({ selectedTechModule }),
  setSelectedBaseStructure: (selectedBaseStructure) => set({ selectedBaseStructure }),
  setSelectedCargoItem: (selectedCargoItem) => set({ selectedCargoItem }),
  setSelectedQuest: (selectedQuest) => set({ selectedQuest }),
  setDirectChatRecipient: (directChatRecipient) => set({ directChatRecipient }),

  incrementStat: (key) =>
    set((s) => {
      const current = s.playerStats[key];
      if (typeof current !== 'number') return s;
      const next = { ...s.playerStats, [key]: current + 1 };
      savePlayerStats(next);
      return { playerStats: next };
    }),

  addToStatSet: (key, value) =>
    set((s) => {
      const arr = s.playerStats[key];
      if (arr.includes(value)) return s;
      const next = { ...s.playerStats, [key]: [...arr, value] };
      savePlayerStats(next);
      return { playerStats: next };
    }),

  setVisitedQuadrants: (quadrants) =>
    set({ visitedQuadrants: new Set(quadrants.map((q) => `${q.qx}:${q.qy}`)) }),
  addQuestComplete: (entry) =>
    set((s) => ({ questCompleteQueue: [...s.questCompleteQueue, entry] })),
  shiftQuestComplete: () =>
    set((s) => ({ questCompleteQueue: s.questCompleteQueue.slice(1) })),
  setStoryEvent: (e) => set({ storyEvent: e }),
  setAlienEncounterEvent: (e) => set({ alienEncounterEvent: e }),
  setStoryProgress: (p) => set({ storyProgress: p }),
  setActiveCommunityQuest: (q) => set({ activeCommunityQuest: q }),
  setHumanityReps: (reps) => set({ humanityReps: reps }),
  setQuadrantControls: (controls) => set({ quadrantControls: controls }),
  setNpcFleets: (fleets) => set({ npcFleets: fleets }),
  setCivShips: (ships) => set({ civShips: ships }),
  addWarTickerEvent: (event) =>
    set((state) => ({ warTicker: [event, ...state.warTicker].slice(0, 10) })),
  setInventory: (inventory) => set({ inventory }),
  setTrackedQuests: (trackedQuests) => set({ trackedQuests }),
  setConstructionSites: (sites) => set({ constructionSites: sites }),
  upsertConstructionSite: (site) => set((s) => ({
    constructionSites: s.constructionSites.some((c) => c.id === site.id)
      ? s.constructionSites.map((c) => (c.id === site.id ? site : c))
      : [...s.constructionSites, site],
  })),
  removeConstructionSite: (siteId) => set((s) => ({
    constructionSites: s.constructionSites.filter((c) => c.id !== siteId),
  })),
});
