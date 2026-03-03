import type { StateCreator } from 'zustand';
import type { APState, SectorData, Coords, FuelState, MiningState, CargoState, ChatMessage, ChatChannel, StorageInventory, TradeOrder, DataSlate, Faction, FactionMember, FactionInvite, Quest, PlayerReputation, PlayerUpgrade, PirateEncounter, BattleResult, ScanEvent, JumpGateInfo, RescueSurvivor, DistressCall, FactionUpgradeState, TradeRoute, Bookmark, AutopilotState, ShipRecord, ShipStats, ShipModule, HullType } from '@void-sector/shared';

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
  scanEvents: ScanEvent[];

  // Phase 5: Deep Systems
  jumpGateInfo: JumpGateInfo | null;
  rescuedSurvivors: RescueSurvivor[];
  distressCalls: DistressCall[];
  factionUpgrades: FactionUpgradeState[];
  tradeRoutes: TradeRoute[];

  // Bookmarks
  bookmarks: Bookmark[];

  // Autopilot / Far-Nav
  autopilot: AutopilotState | null;
  discoveryTimestamps: Record<string, number>;

  // Ship designer
  shipList: (ShipRecord & { stats: ShipStats })[];
  moduleInventory: string[];
  baseName: string;
  homeBase: { x: number; y: number };

  // Actions
  setAuth: (token: string, playerId: string, username: string) => void;
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
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set) => ({
  token: safeGetItem('vs_token'),
  playerId: safeGetItem('vs_playerId'),
  username: safeGetItem('vs_username'),
  position: { x: 0, y: 0 },
  ap: null,
  fuel: null,
  ship: null,
  currentSector: null,
  players: {},
  discoveries: {},
  log: [],
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0, slates: 0 },
  activeMonitor: 'NAV-COM',
  chatMessages: [],
  chatChannel: 'local' as ChatChannel,
  alerts: {},
  selectedSector: null,
  baseStructures: [],
  credits: 0,
  storage: { ore: 0, gas: 0, crystal: 0 },
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

  setAuth: (token, playerId, username) => {
    safeSetItem('vs_token', token);
    safeSetItem('vs_playerId', playerId);
    safeSetItem('vs_username', username);
    set({ token, playerId, username });
  },

  clearAuth: () => {
    safeRemoveItem('vs_token');
    safeRemoveItem('vs_playerId');
    safeRemoveItem('vs_username');
    set({ token: null, playerId: null, username: null });
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
    set((s) => ({
      chatMessages: [...s.chatMessages.slice(-199), msg],
    })),
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
});
