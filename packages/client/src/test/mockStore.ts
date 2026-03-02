import { vi } from 'vitest';
import { useStore } from '../state/store';
import type { StoreState } from '../state/store';
import type { APState, SectorData, CargoState } from '@void-sector/shared';

const defaultAP: APState = {
  current: 100,
  max: 100,
  lastTick: Date.now(),
  regenPerSecond: 0.5,
};

const defaultSector: SectorData = {
  x: 0,
  y: 0,
  type: 'empty',
  seed: 42,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
};

const defaultCargo: CargoState = { ore: 0, gas: 0, crystal: 0 };

export function mockStoreState(overrides: Partial<StoreState> = {}) {
  const state: Partial<StoreState> = {
    token: 'test-token',
    playerId: 'test-id',
    username: 'TestPilot',
    position: { x: 0, y: 0 },
    ap: defaultAP,
    fuel: { current: 100, max: 100 },
    ship: null,
    currentSector: defaultSector,
    players: {},
    discoveries: { '0:0': defaultSector },
    log: [],
    mining: null,
    cargo: defaultCargo,
    activeMonitor: 'NAV-COM',
    alerts: {},
    selectedSector: null,
    baseStructures: [],
    credits: 0,
    storage: { ore: 0, gas: 0, crystal: 0 },
    tradeOrders: [],
    myOrders: [],
    sidebarSlots: ['SHIP-SYS', 'COMMS'] as [string, string],
    leftSidebarSlots: ['LOG', 'SHIP-SYS'] as [string, string],
    mainMonitorMode: 'split' as 'split' | string,
    setAlert: vi.fn(),
    clearAlert: vi.fn(),
    setSelectedSector: vi.fn(),
    setLeftSidebarSlot: vi.fn(),
    setMainMonitorMode: vi.fn(),
    screen: 'game' as const,
    theme: 'amber' as const,
    jumpPending: false,
    ...overrides,
  };
  useStore.setState(state as StoreState);
}
