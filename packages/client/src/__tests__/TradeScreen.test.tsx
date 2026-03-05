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
    expect(screen.getByText(/KEIN HANDEL/)).toBeTruthy();
  });

  it('shows NPC trade at home base without trading post', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 0, y: 0 },
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows NPC trade UI when trading post exists at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
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
      cargo: { ore: 3, gas: 1, crystal: 0, slates: 0, artefact: 0 },
      npcStationData: null,
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
    expect(screen.getByText(/STATION/)).toBeTruthy();
    expect(screen.getByText(/CARGO/)).toBeTruthy();
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
      cargo: { ore: 3, gas: 1, crystal: 0, slates: 0, artefact: 0 },
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
    expect(screen.getByText('MARKT')).toBeTruthy();
  });

  it('hides market tab at tier 1 at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 0,
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.queryByText('MARKT')).toBeNull();
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
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
    });
    render(<TradeScreen />);
    expect(screen.queryByText('MARKT')).toBeNull();
    expect(screen.queryByText('ROUTEN')).toBeNull();
  });

  it('shows KONTOR tab when kontorOrders are present at station', () => {
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
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 },
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
    expect(screen.getByText('KONTOR')).toBeTruthy();
  });

  it('hides KONTOR tab when no kontorOrders', () => {
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
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      kontorOrders: [],
    });
    render(<TradeScreen />);
    expect(screen.queryByText('KONTOR')).toBeNull();
  });

  it('disables SELL button for own orders in KONTOR tab', () => {
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
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 },
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
    const kontorTab = screen.getByText('KONTOR');
    fireEvent.click(kontorTab);
    const sellButtons = screen.getAllByText('SELL');
    expect(sellButtons[0]).toHaveProperty('disabled', true);
    expect(sellButtons[1]).toHaveProperty('disabled', false);
  });
});
