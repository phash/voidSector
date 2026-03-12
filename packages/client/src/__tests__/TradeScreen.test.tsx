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

  it('shows credits at home base', () => {
    mockStoreState({
      baseStructures: [],
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
