import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TradeScreen } from '../components/TradeScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestTradeOrders: vi.fn(),
    requestMyOrders: vi.fn(),
    requestCredits: vi.fn(),
    requestStorage: vi.fn(),
    sendNpcTrade: vi.fn(),
    sendCancelOrder: vi.fn(),
    requestMySlates: vi.fn(),
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
      currentSector: { x: 5, y: 5, type: 'empty', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/KEIN HANDEL/)).toBeTruthy();
  });

  it('shows NPC trade at home base without trading post', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 0, y: 0 },
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows NPC trade UI when trading post exists at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 100,
      storage: { ore: 10, gas: 5, crystal: 2 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
    expect(screen.getByText(/100 CR/)).toBeTruthy();
  });

  it('shows NPC trade at station with cargo info', () => {
    mockStoreState({
      baseStructures: [],
      position: { x: 10, y: 10 },
      currentSector: { x: 10, y: 10, type: 'station', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
      credits: 200,
      cargo: { ore: 3, gas: 1, crystal: 0, slates: 0 },
    });
    render(<TradeScreen />);
    expect(screen.getByText(/NPC PREISE/)).toBeTruthy();
    expect(screen.getByText(/STATION/)).toBeTruthy();
    expect(screen.getByText(/CARGO/)).toBeTruthy();
  });

  it('shows market tab at tier 2 at home base', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 2, sector_x: 0, sector_y: 0 }],
      credits: 500,
      storage: { ore: 0, gas: 0, crystal: 0 },
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
      storage: { ore: 0, gas: 0, crystal: 0 },
    });
    render(<TradeScreen />);
    expect(screen.queryByText('MARKT')).toBeNull();
  });

  it('hides market/slates/routes tabs at station', () => {
    mockStoreState({
      baseStructures: [{ id: 'tp1', type: 'trading_post', tier: 3, sector_x: 0, sector_y: 0 }],
      position: { x: 10, y: 10 },
      currentSector: { x: 10, y: 10, type: 'station', seed: 42, discoveredBy: null, discoveredAt: null, metadata: {} },
      credits: 500,
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0 },
    });
    render(<TradeScreen />);
    expect(screen.queryByText('MARKT')).toBeNull();
    expect(screen.queryByText('ROUTEN')).toBeNull();
  });
});
