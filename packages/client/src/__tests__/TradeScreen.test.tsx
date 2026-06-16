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

  it('requests NPC station data when rendered at a station', () => {
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
      npcStationData: null,
    });
    render(<TradeScreen />);
    expect(network.requestNpcStationData).toHaveBeenCalled();
  });

  it('does not request NPC station data when not at a station and no base', () => {
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
    expect(network.requestNpcStationData).not.toHaveBeenCalled();
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
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows credits at home base with trading post', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows STATION label at station sector', () => {
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
    expect(screen.getByText(/STATION/)).toBeTruthy();
  });

  it('hides market tab even at tier 2 (removed for launch — #525)', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 2, sector_x: 0, sector_y: 0 }],
      credits: 500,
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
      tradeOrders: [],
      myOrders: [],
    });
    render(<TradeScreen />);
    expect(screen.queryByText('tabs.market')).toBeNull();
  });

  it('hides market tab at tier 1 at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 0,
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.queryByText('tabs.market')).toBeNull();
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
    expect(screen.queryByText('tabs.market')).toBeNull();
    expect(screen.queryByText('tabs.routes')).toBeNull();
  });

  it('hides TRADING POST tab even with kontorOrders (removed for launch — #525)', () => {
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
    expect(screen.queryByText('programs.tradingPost')).toBeNull();
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
    expect(screen.queryByText('programs.tradingPost')).toBeNull();
  });

  // NOTE: StationTradeTab replaced the old single "sell-all" button with a per-row
  // +/- quantity SELL control. maxSell = min(cargo, maxStock - stock). These tests
  // now verify that capped behavior (#237) against the current StationTradeTab UI.

  it('SELL sends the chosen quantity when station has sufficient capacity (#237)', () => {
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
          // Station has plenty of capacity: 50/200 → maxSell = min(5, 150) = 5
          { itemType: 'ore', stock: 50, maxStock: 200, buyPrice: 12, sellPrice: 8 },
        ],
      },
    });
    render(<TradeScreen />);
    // SELL button is enabled (maxSell = 5 > 0). Default qty is 1.
    const sellBtn = screen.getByText('[SELL]');
    expect((sellBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sellBtn);
    expect(network.sendNpcTrade).toHaveBeenCalledWith('ore', 1, 'sell');
  });

  it('SELL quantity is capped by remaining station capacity (#237)', () => {
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
          // Station nearly full: 197/200 → maxSell = min(10, 3) = 3
          { itemType: 'ore', stock: 197, maxStock: 200, buyPrice: 5, sellPrice: 3 },
        ],
      },
    });
    render(<TradeScreen />);
    // Bump the sell qty past the cap: + button stops at maxSell (3).
    const plusButtons = screen.getAllByText('+');
    // First +/- pair is BUY, second is SELL.
    const sellPlus = plusButtons[1];
    fireEvent.click(sellPlus);
    fireEvent.click(sellPlus);
    fireEvent.click(sellPlus);
    fireEvent.click(sellPlus); // 5th attempt — should remain capped at 3
    const sellBtn = screen.getByText('[SELL]');
    fireEvent.click(sellBtn);
    // Sent quantity is capped at the remaining station capacity (3), never 10.
    expect(network.sendNpcTrade).toHaveBeenCalledWith('ore', 3, 'sell');
  });

  it('SELL is disabled when station is completely full (#237)', () => {
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
          // Station completely full: 200/200 → maxSell = min(5, 0) = 0
          { itemType: 'ore', stock: 200, maxStock: 200, buyPrice: 5, sellPrice: 3 },
        ],
      },
    });
    render(<TradeScreen />);
    // maxSell = 0, but playerAmount > 0, so the SELL button is present yet disabled
    // (sellQty default 1 > maxSell 0).
    const sellBtn = screen.getByText('[SELL]') as HTMLButtonElement;
    expect(sellBtn.disabled).toBe(true);
  });

  // Removed: 'disables SELL button for own orders in TRADING POST tab' — the
  // KONTOR/TRADING POST tab was hidden for launch (#525).
});
