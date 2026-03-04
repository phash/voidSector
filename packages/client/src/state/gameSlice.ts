import type { StateCreator } from 'zustand';
import type { APState, SectorData, Coords, FuelState, MiningState, CargoState, ChatMessage, ChatChannel, StorageInventory, TradeOrder, DataSlate, Faction, FactionMember, FactionInvite, Quest, PlayerReputation, PlayerUpgrade, PirateEncounter, BattleResult, ScanEvent, JumpGateInfo, RescueSurvivor, DistressCall, FactionUpgradeState, TradeRoute, Bookmark, AutopilotState, ShipRecord, ShipStats, ShipModule, HullType, CombatV2State, StationDefense, StationCombatEvent, ResearchState, FirstContactEvent } from '@void-sector/shared';

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
}

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or private mode */ }
}

function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

export interface PlayerPresence {
  sessionId: string;
  username: string;
  x: number;
  y: number;
  connected: boolean;
}

export interface GameSlice {
  // Auth
  token: string | null;
  playerId: string | null;
  username: string | null;
  isGuest: boolean;

  // Position
  position: Coords;

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

  // Mining
  mining: MiningState | null;

  // Cargo
  cargo: CargoState;

  // Active monitor
  activeMonitor: string;

  // Chat / COMMS
  chatMessages: ChatMessage[];
  chatChannel: ChatChannel;

  // Alerts
  alerts: Record<string, boolean>;

  // Selected sector (radar click)
  selectedSector: { x: number; y: number } | null;

  // Base
  baseStructures: any[];

  // Credits
  credits: number;
  alienCredits: number;

  // Storage
  storage: StorageInventory;

  // Trade orders
  tradeOrders: TradeOrder[];
  myOrders: TradeOrder[];

  // Data Slates
  mySlates: DataSlate[];

  // Faction
  faction: Faction | null;
  factionMembers: FactionMember[];
  factionInvites: FactionInvite[];

  // Phase 4: NPC Ecosystem
  activeQuests: Quest[];
  reputations: PlayerReputation[];
  playerUpgrades: PlayerUpgrade[];
  activeBattle: PirateEncounter | null;
  lastBattleResult: { encounter: PirateEncounter; result: BattleResult } | null;
  activeCombatV2: CombatV2State | null;
  stationDefenses: StationDefense[];
  stationCombatEvent: StationCombatEvent | null;
  scanEvents: ScanEvent[];

  // Phase 5: Deep Systems
  jumpGateInfo: JumpGateInfo | null;
  rescuedSurvivors: RescueSurvivor[];
  distressCalls: DistressCall[];
  factionUpgrades: FactionUpgradeState[];
  tradeRoutes: TradeRoute[];

  // Bookmarks
  bookmarks: Bookmark[];

  // Autopilot / Hyperjump
  autopilot: AutopilotState | null;
  discoveryTimestamps: Record<string, number>;

  // Ship designer
  shipList: (ShipRecord & { stats: ShipStats })[];
  moduleInventory: string[];
  baseName: string;
  homeBase: { x: number; y: number };

  // Research / Tech tree
  research: ResearchState;
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
    activeRecipe: { id: string; outputItem: string; outputAmount: number; cycleSeconds: number } | null;
    progress: number;
    completedCycles: number;
    output: Record<string, number>;
    error?: string;
  } | null;

  // Kontor
  kontorOrders: Array<{
    id: string; ownerId: string; itemType: string;
    amountWanted: number; amountFilled: number;
    pricePerUnit: number; active: boolean;
  }>;

  // Quadrant system
  knownQuadrants: Array<{ qx: number; qy: number; learnedAt: string }>;
  currentQuadrant: { qx: number; qy: number } | null;
  firstContactEvent: FirstContactEvent | null;

  // Actions
  setAuth: (token: string, playerId: string, username: string, isGuest?: boolean) => void;
  clearAuth: () => void;
  setPosition: (pos: Coords) => void;
  setAP: (ap: APState) => void;
  setFuel: (fuel: FuelState) => void;
  setShip: (ship: ClientShipData) => void;
  setCurrentSector: (sector: SectorData) => void;
  setPlayer: (sessionId: string, player: PlayerPresence) => void;
  removePlayer: (sessionId: string) => void;
  clearPlayers: () => void;
  addDiscoveries: (sectors: SectorData[]) => void;
  addLogEntry: (message: string) => void;
  setActiveMonitor: (monitor: string) => void;
  setMining: (mining: MiningState) => void;
  setCargo: (cargo: CargoState) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatChannel: (channel: ChatChannel) => void;
  setAlert: (monitorId: string, active: boolean) => void;
  clearAlert: (monitorId: string) => void;
  setSelectedSector: (sector: { x: number; y: number } | null) => void;
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
  setLastBattleResult: (result: { encounter: PirateEncounter; result: BattleResult } | null) => void;
  setActiveCombatV2: (activeCombatV2: CombatV2State | null) => void;
  setStationDefenses: (stationDefenses: StationDefense[]) => void;
  setStationCombatEvent: (stationCombatEvent: StationCombatEvent | null) => void;
  setScanEvents: (events: ScanEvent[]) => void;
  addScanEvent: (event: ScanEvent) => void;
  setJumpGateInfo: (gate: JumpGateInfo | null) => void;
  setRescuedSurvivors: (survivors: RescueSurvivor[]) => void;
  addDistressCall: (call: DistressCall) => void;
  removeDistressCall: (id: string) => void;
  setFactionUpgrades: (upgrades: FactionUpgradeState[]) => void;
  setTradeRoutes: (routes: TradeRoute[]) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setAutopilot: (state: AutopilotState | null) => void;
  setDiscoveryTimestamps: (timestamps: Record<string, number>) => void;
  setShipList: (ships: (ShipRecord & { stats: ShipStats })[]) => void;
  setModuleInventory: (modules: string[]) => void;
  setBaseName: (name: string) => void;
  setHomeBase: (coords: { x: number; y: number }) => void;
  setResearch: (research: ResearchState) => void;
  setPendingBlueprint: (moduleId: string | null) => void;
  setNpcStationData: (data: GameSlice['npcStationData']) => void;
  setFactoryState: (data: GameSlice['factoryState']) => void;
  setKontorOrders: (orders: GameSlice['kontorOrders']) => void;
  setKnownQuadrants: (quadrants: Array<{ qx: number; qy: number; learnedAt: string }>) => void;
  setCurrentQuadrant: (q: { qx: number; qy: number } | null) => void;
  setFirstContactEvent: (event: FirstContactEvent | null) => void;
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set) => ({
  token: safeGetItem('vs_token'),
  playerId: safeGetItem('vs_playerId'),
  username: safeGetItem('vs_username'),
  isGuest: safeGetItem('vs_isGuest') === 'true',
  position: { x: 0, y: 0 },
  ap: null,
  fuel: null,
  ship: null,
  currentSector: null,
  players: {},
  discoveries: {},
  log: [],
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
  activeMonitor: 'NAV-COM',
  chatMessages: [],
  chatChannel: 'local' as ChatChannel,
  alerts: {},
  selectedSector: null,
  baseStructures: [],
  credits: 0,
  alienCredits: 0,
  storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
  tradeOrders: [],
  myOrders: [],
  mySlates: [],
  faction: null,
  factionMembers: [],
  factionInvites: [],
  activeQuests: [],
  reputations: [],
  playerUpgrades: [],
  activeBattle: null,
  lastBattleResult: null,
  activeCombatV2: null,
  stationDefenses: [],
  stationCombatEvent: null,
  scanEvents: [],
  jumpGateInfo: null,
  rescuedSurvivors: [],
  distressCalls: [],
  factionUpgrades: [],
  tradeRoutes: [],
  bookmarks: [],
  autopilot: null,
  discoveryTimestamps: {},
  shipList: [],
  moduleInventory: [],
  baseName: '',
  homeBase: { x: 0, y: 0 },
  research: { unlockedModules: [], blueprints: [], activeResearch: null },
  pendingBlueprint: null,
  npcStationData: null,
  factoryState: null,
  kontorOrders: [],
  knownQuadrants: [],
  currentQuadrant: null,
  firstContactEvent: null,

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

  setPosition: (position) => set({ position }),
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

  setActiveMonitor: (activeMonitor) => set({ activeMonitor }),
  setMining: (mining) => set({ mining }),
  setCargo: (cargo) => set({ cargo }),

  addChatMessage: (msg) =>
    set((s) => {
      // Deduplicate by message ID
      if (s.chatMessages.some(m => m.id === msg.id)) return s;
      return { chatMessages: [...s.chatMessages.slice(-199), msg] };
    }),
  setChatChannel: (chatChannel) => set({ chatChannel }),
  setAlert: (monitorId, active) => set((s) => ({
    alerts: { ...s.alerts, [monitorId]: active },
  })),
  clearAlert: (monitorId) => set((s) => {
    const next = { ...s.alerts };
    delete next[monitorId];
    return { alerts: next };
  }),
  setSelectedSector: (selectedSector) => set({ selectedSector }),
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
  setLastBattleResult: (lastBattleResult) => set({ lastBattleResult }),
  setActiveCombatV2: (activeCombatV2) => set({ activeCombatV2 }),
  setStationDefenses: (stationDefenses) => set({ stationDefenses }),
  setStationCombatEvent: (stationCombatEvent) => set({ stationCombatEvent }),
  setScanEvents: (scanEvents) => set({ scanEvents }),
  addScanEvent: (event) => set((s) => ({ scanEvents: [...s.scanEvents, event] })),
  setJumpGateInfo: (jumpGateInfo) => set({ jumpGateInfo }),
  setRescuedSurvivors: (rescuedSurvivors) => set({ rescuedSurvivors }),
  addDistressCall: (call) => set((s) => ({ distressCalls: [...s.distressCalls, call] })),
  removeDistressCall: (id) => set((s) => ({ distressCalls: s.distressCalls.filter(d => d.id !== id) })),
  setFactionUpgrades: (factionUpgrades) => set({ factionUpgrades }),
  setTradeRoutes: (tradeRoutes) => set({ tradeRoutes }),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  setAutopilot: (autopilot) => set({ autopilot }),
  setDiscoveryTimestamps: (discoveryTimestamps) => set({ discoveryTimestamps }),
  setShipList: (shipList) => set({ shipList }),
  setModuleInventory: (moduleInventory) => set({ moduleInventory }),
  setBaseName: (baseName) => set({ baseName }),
  setHomeBase: (homeBase) => set({ homeBase }),
  setResearch: (research) => set({ research }),
  setPendingBlueprint: (pendingBlueprint) => set({ pendingBlueprint }),
  setNpcStationData: (npcStationData) => set({ npcStationData }),
  setFactoryState: (factoryState) => set({ factoryState }),
  setKontorOrders: (kontorOrders) => set({ kontorOrders }),
  setKnownQuadrants: (knownQuadrants) => set({ knownQuadrants }),
  setCurrentQuadrant: (currentQuadrant) => set({ currentQuadrant }),
  setFirstContactEvent: (firstContactEvent) => set({ firstContactEvent }),
});
