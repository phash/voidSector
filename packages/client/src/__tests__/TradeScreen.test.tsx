import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TradeScreen } from '../components/TradeScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestTradeOrders: vi.fn(),
    requestMyOrders: vi.fn(),
    requestCredits: vi.fn(),
    requestStorage: vi.fn(),
    requestNpcStationData: vi.fn(),
    sendNpcTrade: vi.fn(),
    sendCancelOrder: vi.fn(),
    requestMySlates: vi.fn(),
    requestKontorOrders: vi.fn(),
    sendKontorSellTo: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('TradeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ baseStructures: [] });
  });

  it('shows no trade available when not at station or home base', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 5, y: 5 },
      currentSector: {
        x: 5,
        y: 5,
        type: 'empty',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: [],
      },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NO TRADING AVAILABLE/)).toBeTruthy();
  });

  it('shows NPC trade at player base without trading post', () => {
    mockStoreState({
      baseStructures: [{ id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 }],
      position: { x: 0, y: 0 },
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PRICES/)).toBeTruthy();
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows NPC trade UI when trading post exists at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PRICES/)).toBeTruthy();
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows NPC trade at station with cargo info (no station data yet)', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 3,
        gas: 1,
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
      npcStationData: null,
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PRICES/)).toBeTruthy();
    expect(screen.getAllByText(/STATION/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CARGO/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows stock bars and dynamic prices when npcStationData is available', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 3,
        gas: 1,
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
      npcStationData: {
        level: 1,
        name: 'Outpost',
        xp: 120,
        nextLevelXp: 500,
        inventory: [
          { itemType: 'ore', stock: 82, maxStock: 100, buyPrice: 12, sellPrice: 8 },
          { itemType: 'gas', stock: 20, maxStock: 100, buyPrice: 18, sellPrice: 15 },
          { itemType: 'crystal', stock: 0, maxStock: 100, buyPrice: 25, sellPrice: 20 },
        ],
      },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/OUTPOST LV\.1/)).toBeTruthy();
    expect(screen.getByText(/XP: 120\/500/)).toBeTruthy();
    expect(screen.getByText('82/100')).toBeTruthy();
    expect(screen.getByText('20/100')).toBeTruthy();
    expect(screen.getByText('0/100')).toBeTruthy();
    expect(screen.getByText('[UNAVAILABLE]')).toBeTruthy();
  });

  it('shows market tab at tier 2 at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 2, sector_x: 0, sector_y: 0 }],
      credits: 500,
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
      tradeOrders: [],
      myOrders: [],
    });
    render(<TradeScreen />);
    expect(screen.getByText('MARKET')).toBeTruthy();
  });

  it('hides market tab at tier 1 at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 0,
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.queryByText('MARKET')).toBeNull();
  });

  it('hides market/slates/routes tabs at station', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 3, sector_x: 0, sector_y: 0 }],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: ['station' as const],
      },
      credits: 500,
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
    });
    render(<TradeScreen />);
    expect(screen.queryByText('MARKET')).toBeNull();
    expect(screen.queryByText('ROUTES')).toBeNull();
  });

  it('shows TRADING POST tab when kontorOrders are present at station', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 5,
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
      kontorOrders: [
        {
          id: 'ko1',
          ownerId: 'other-player',
          itemType: 'ore',
          amountWanted: 500,
          amountFilled: 210,
          pricePerUnit: 2,
          active: true,
        },
      ],
    });
    render(<TradeScreen />);
    expect(screen.getByText('TRADING POST')).toBeTruthy();
  });

  it('hides TRADING POST tab when no kontorOrders', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 5,
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
      kontorOrders: [],
    });
    render(<TradeScreen />);
    expect(screen.queryByText('TRADING POST')).toBeNull();
  });

  it('sell-all button sends full playerAmount when station has sufficient capacity (#237)', () => {
    vi.mocked(network.sendNpcTrade).mockClear();
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10, y: 10, type: 'station', seed: 42,
        discoveredBy: null, discoveredAt: null, metadata: {},
        environment: 'empty' as const, contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0,
        artefact_drive: 0, artefact_cargo: 0, artefact_scanner: 0,
        artefact_armor: 0, artefact_weapon: 0, artefact_shield: 0,
        artefact_defense: 0, artefact_special: 0, artefact_mining: 0,
      },
      ship: {
        id: 's1', ownerId: 'p1',
        name: 'Test', modules: [], active: true, fuel: 10,
        stats: { cargoCap: 50, fuelMax: 50, jumpRange: 3, apCostJump: 1, fuelPerJump: 1, hp: 100, commRange: 50, scannerLevel: 2, damageMod: 0, shieldHp: 0, shieldRegen: 0, weaponAttack: 0, weaponType: 'none' as const, weaponPiercing: 0, pointDefense: 0, ecmReduction: 0, engineSpeed: 3, artefactChanceBonus: 0, safeSlotBonus: 0, hyperdriveRange: 0, hyperdriveSpeed: 0, hyperdriveRegen: 0, hyperdriveFuelEfficiency: 0, miningBonus: 0 },
      },
      npcStationData: {
        level: 1, name: 'Outpost', xp: 0, nextLevelXp: 500,
        inventory: [
          // Station has plenty of capacity: 50/200 → remaining = 150
          { itemType: 'ore', stock: 50, maxStock: 200, buyPrice: 12, sellPrice: 8 },
        ],
      },
    });
    render(<TradeScreen />);
    // The ALL button should show "ALL (5)" (no capping)
    const sellAllBtn = screen.getByTestId('sell-all-ore');
    expect(sellAllBtn.textContent).toBe('ALL (5)');
    // Click it — should send the full playerAmount (5) to the server
    fireEvent.click(sellAllBtn);
    expect(network.sendNpcTrade).toHaveBeenCalledWith('ore', 5, 'sell');
  });

  it('sell-all button caps amount when station is near full (#237)', () => {
    vi.mocked(network.sendNpcTrade).mockClear();
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10, y: 10, type: 'station', seed: 42,
        discoveredBy: null, discoveredAt: null, metadata: {},
        environment: 'empty' as const, contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0,
        artefact_drive: 0, artefact_cargo: 0, artefact_scanner: 0,
        artefact_armor: 0, artefact_weapon: 0, artefact_shield: 0,
        artefact_defense: 0, artefact_special: 0, artefact_mining: 0,
      },
      ship: {
        id: 's1', ownerId: 'p1',
        name: 'Test', modules: [], active: true, fuel: 10,
        stats: { cargoCap: 50, fuelMax: 50, jumpRange: 3, apCostJump: 1, fuelPerJump: 1, hp: 100, commRange: 50, scannerLevel: 2, damageMod: 0, shieldHp: 0, shieldRegen: 0, weaponAttack: 0, weaponType: 'none' as const, weaponPiercing: 0, pointDefense: 0, ecmReduction: 0, engineSpeed: 3, artefactChanceBonus: 0, safeSlotBonus: 0, hyperdriveRange: 0, hyperdriveSpeed: 0, hyperdriveRegen: 0, hyperdriveFuelEfficiency: 0, miningBonus: 0 },
      },
      npcStationData: {
        level: 1, name: 'Outpost', xp: 0, nextLevelXp: 500,
        inventory: [
          // Station nearly full: 197/200 → remaining = 3
          { itemType: 'ore', stock: 197, maxStock: 200, buyPrice: 5, sellPrice: 3 },
        ],
      },
    });
    render(<TradeScreen />);
    // The ALL button should show the cap
    const sellAllBtn = screen.getByTestId('sell-all-ore');
    expect(sellAllBtn.textContent).toContain('ALL (10 → max 3)');
    // Click it — should send the capped amount (3), not the full 10
    fireEvent.click(sellAllBtn);
    expect(network.sendNpcTrade).toHaveBeenCalledWith('ore', 3, 'sell');
  });

  it('sell-all button hidden when station is completely full (#237)', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10, y: 10, type: 'station', seed: 42,
        discoveredBy: null, discoveredAt: null, metadata: {},
        environment: 'empty' as const, contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0,
        artefact_drive: 0, artefact_cargo: 0, artefact_scanner: 0,
        artefact_armor: 0, artefact_weapon: 0, artefact_shield: 0,
        artefact_defense: 0, artefact_special: 0, artefact_mining: 0,
      },
      ship: {
        id: 's1', ownerId: 'p1',
        name: 'Test', modules: [], active: true, fuel: 10,
        stats: { cargoCap: 50, fuelMax: 50, jumpRange: 3, apCostJump: 1, fuelPerJump: 1, hp: 100, commRange: 50, scannerLevel: 2, damageMod: 0, shieldHp: 0, shieldRegen: 0, weaponAttack: 0, weaponType: 'none' as const, weaponPiercing: 0, pointDefense: 0, ecmReduction: 0, engineSpeed: 3, artefactChanceBonus: 0, safeSlotBonus: 0, hyperdriveRange: 0, hyperdriveSpeed: 0, hyperdriveRegen: 0, hyperdriveFuelEfficiency: 0, miningBonus: 0 },
      },
      npcStationData: {
        level: 1, name: 'Outpost', xp: 0, nextLevelXp: 500,
        inventory: [
          // Station completely full: 200/200 → remaining = 0
          { itemType: 'ore', stock: 200, maxStock: 200, buyPrice: 5, sellPrice: 3 },
        ],
      },
    });
    render(<TradeScreen />);
    // ALL button should NOT appear when station is full
    expect(screen.queryByTestId('sell-all-ore')).toBeNull();
  });

  it('disables SELL button for own orders in TRADING POST tab', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: {
        x: 10,
        y: 10,
        type: 'station',
        seed: 42,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
        environment: 'empty' as const,
        contents: ['station' as const],
      },
      credits: 200,
      cargo: {
        ore: 5,
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
      kontorOrders: [
        {
          id: 'ko1',
          ownerId: 'test-id',
          itemType: 'ore',
          amountWanted: 500,
          amountFilled: 0,
          pricePerUnit: 2,
          active: true,
        },
        {
          id: 'ko2',
          ownerId: 'other-player',
          itemType: 'gas',
          amountWanted: 200,
          amountFilled: 0,
          pricePerUnit: 5,
          active: true,
        },
      ],
    });
    render(<TradeScreen />);
    const kontorTab = screen.getByText('TRADING POST');
    fireEvent.click(kontorTab);
    const sellButtons = screen.getAllByText('SELL');
    expect(sellButtons[0]).toHaveProperty('disabled', true);
    expect(sellButtons[1]).toHaveProperty('disabled', false);
  });
});
