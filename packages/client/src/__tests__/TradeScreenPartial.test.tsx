import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TradeScreen } from '../components/TradeScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendNpcTrade: vi.fn(),
    requestNpcStationData: vi.fn(),
    requestKontorOrders: vi.fn(),
    requestCredits: vi.fn(),
    requestStorage: vi.fn(),
    requestTradeOrders: vi.fn(),
    requestMyOrders: vi.fn(),
    requestMySlates: vi.fn(),
  },
}));

describe('TradeScreen partial sell feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows tradeMessage when set', () => {
    // tradeMessage is cleared on mount, so seed it via a custom setTradeMessage
    // mock that writes the value back into the store after the reset effect runs.
    mockStoreState({
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
      currentSector: {
        x: 5, y: 5, type: 'station', seed: 42,
        discoveredBy: null, discoveredAt: null, metadata: {},
        environment: 'empty' as const, contents: ['station' as const],
      },
      credits: 100,
      npcStationData: {
        name: 'Test Station', level: 1, xp: 0, nextLevelXp: 100, inventory: [],
      },
      tradeMessage: 'Nur 2x verkauft — Station ist fast voll',
      // The component calls setTradeMessage(null) on mount; keep the message visible.
      setTradeMessage: vi.fn(),
      position: { x: 5, y: 5 },
      baseStructures: [],
      kontorOrders: [],
    });
    render(<TradeScreen />);
    expect(screen.getByText(/Nur 2x verkauft/i)).toBeTruthy();
  });
});
