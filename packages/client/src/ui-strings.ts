// packages/client/src/ui-strings.ts

/** Wraps a string in CRT bracket notation: ACCEPT → [ACCEPT] */
export function btn(label: string): string {
  return `[${label}]`;
}

/** Wraps a disabled button label with its blocking reason: JUMP → [JUMP — NO AP] */
export function btnDisabled(label: string, reason: string): string {
  return `[${label} — ${reason}]`;
}

/** Central UI string constants. Raw strings only — use btn()/btnDisabled() for buttons. */
export const UI = {

  // ─── ACTIONS (always wrap with btn() or btnDisabled()) ──────────────
  actions: {
    ACCEPT: 'ACCEPT',
    CANCEL: 'CANCEL',
    UNDOCK: 'UNDOCK',
    RENAME: 'RENAME',
    INSTALL: 'INSTALL',
    CRAFT: 'CRAFT',
    ACTIVATE: 'ACTIVATE',
    JETTISON: 'JETTISON',
    NAVIGATE: 'NAVIGATE',
    INVESTIGATE: 'INVESTIGATE',
    CREATE: 'CREATE',
    SELL: 'SELL',
    CLOSE: 'CLOSE',
    CLAIM: 'CLAIM',
    ABANDON: 'ABANDON',
    DISBAND: 'DISBAND',
    JUMP: 'JUMP',
    SCAN: 'SCAN',
    MINE: 'MINE',
    STOP: 'STOP',
    OK: 'OK',
  },

  // ─── TABS & SECTION HEADERS ──────────────────────────────────────────
  tabs: {
    RESOURCES: 'RESOURCES',
    MODULES: 'MODULES',
    BLUEPRINTS: 'BLUEPRINTS',
    ACTIVE: 'ACTIVE',
    AVAILABLE: 'AVAILABLE',
    REPUTATION: 'REPUTATION',
    STORY: 'STORY',
    MARKET: 'MARKET',
    ROUTES: 'ROUTES',
    MEMBERS: 'MEMBERS',
    JOURNAL: 'JOURNAL',
    SETTINGS: 'SETTINGS',
    RESCUE: 'RESCUE',
    COMMUNITY: 'COMMUNITY',
    TRADE: 'TRADE',
    QUESTS: 'QUESTS',
  },

  // ─── STATUS & LABELS ─────────────────────────────────────────────────
  status: {
    LOADING: 'LOADING...',
    ACTIVE: 'ACTIVE',
    IDLE: 'IDLE',
    COMPLETED: 'COMPLETED',
    AUTOPILOT_ACTIVE: 'AUTOPILOT ACTIVE',
    MINING_LOCKED: '⚠ MINING ACTIVE — NAV LOCKED',
    EMERGENCY_WARP: 'EMERGENCY WARP AVAILABLE',
    TRACKED: 'TRACKED',
    TARGET: 'TARGET',
    PROGRESS: 'PROGRESS',
    DEADLINE: 'DEADLINE',
    REWARD: 'REWARD',
    YIELD: 'YIELD',
    AMOUNT: 'AMOUNT',
    DIRECTION: 'DIRECTION',
    DISTANCE: 'DISTANCE',
    UPGRADE_TREE: 'UPGRADE TREE',
    FREE: 'FREE',
    OBJECTIVES: 'OBJECTIVES',
    DELIVERY: 'DELIVERY',
    BOUNTY: 'BOUNTY',
    DIPLOMACY: 'DIPLOMACY',
    WAR: 'WAR',
    NEARBY: 'NEARBY',
    ALL_FACTIONS: 'ALL FACTIONS',
    ALL_TYPES: 'ALL TYPES',
    DISTRESS_SIGNAL: 'DISTRESS SIGNAL',
    SURVIVORS: 'SURVIVORS ON BOARD',
    YOUR_SHIP: 'YOUR SHIP',
    NO_SHIP: 'NO SHIP',
    RENAME_HINT: 'Click to rename',
  },

  // ─── EMPTY STATES ────────────────────────────────────────────────────
  empty: {
    NO_QUESTS_FILTERED: 'NO QUESTS (FILTER ACTIVE)',
    NO_MODULES: 'NO MODULES IN INVENTORY',
    NO_BLUEPRINTS: 'NO BLUEPRINTS IN INVENTORY',
    NO_SHIP: 'NO SHIP',
    NO_TRADE: 'NO TRADING AVAILABLE',
    NO_COMMUNITY_QUEST: 'NO ACTIVE COMMUNITY QUEST',
    NO_CONTACTS: 'NO CONTACTS',
    NO_MESSAGES: 'NO MESSAGES ON THIS CHANNEL',
    NO_RESOURCES: 'NO RESOURCES IN THIS SECTOR. NAVIGATE TO AN ASTEROID FIELD OR NEBULA.',
    NO_ACTIVE_EVENTS: 'NO ACTIVE EVENTS',
    NO_ACTIVE_DISTRESS: 'NO ACTIVE DISTRESS CALLS',
    NAVIGATE_TO_STATION: 'Navigate to a station or your home base to trade.',
  },

  // ─── PROGRAMS (ProgramSelector labels) ──────────────────────────────
  programs: {
    NAV_COM: 'NAV-COM',
    MINING: 'MINING',
    CARGO: 'CARGO',
    QUESTS: 'QUESTS',
    FACTION: 'FACTION',
    COMMS: 'COMMS',
    TECH: 'TECH',
    BASE: 'BASE-LINK',
    QUAD_MAP: 'QUAD-MAP',
    TV: 'TV',
    TRADING_POST: 'TRADING POST',
  },

  // ─── DISABLED REASONS (use with btnDisabled()) ───────────────────────
  reasons: {
    NO_AP: 'NO AP',
    CARGO_FULL: 'CARGO FULL',
    NOT_AT_STATION: 'NOT AT STATION',
    MINING_ACTIVE: 'MINING ACTIVE',
    INSUFFICIENT_CREDITS: 'NO CREDITS',
    OUT_OF_RANGE: 'OUT OF RANGE',
    AP_COST: (n: number) => `COSTS ${n} AP`,
  },

} as const;
