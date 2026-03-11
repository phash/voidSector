import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TradeScreen } from '../components/TradeScreen';

vi.mock('../network/client', () => ({
  network: { sendNpcTrade: vi.fn(), requestNpcStationData: vi.fn(), requestKontorOrders: vi.fn(), requestCredits: vi.fn() },
}));
vi.mock('../state/store', () => ({
  useStore: vi.fn((selector) =>
    selector({
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      storage: { ore: 0, gas: 0, crystal: 0, artefact: 0 },
      currentSector: { type: 'station' },
      ship: { stats: { cargoCap: 50 } },
      credits: 100,
      npcStationData: { items: [], name: 'Test Station', level: 1, xp: 0, nextLevelXp: 100, inventory: [] },
      tradeMessage: 'Nur 2x verkauft — Station ist fast voll',
      setTradeMessage: vi.fn(),
      kontorStatus: null,
      position: { x: 5, y: 5 },
      setActiveProgram: vi.fn(),
      clearNavReturn: vi.fn(),
      setActionError: vi.fn(),
      actionError: null,
      alienCredits: 0,
      factoryState: null,
      baseStructures: [],
      tradeOrders: [],
      myOrders: [],
      mySlates: [],
      playerId: 'test-player',
      tradeRoutes: [],
      discoveries: [],
      homeBase: { x: 0, y: 0 },
      kontorOrders: [],
      navReturnProgram: null,
    })
  ),
}));

describe('TradeScreen partial sell feedback', () => {
  it('shows tradeMessage when set', () => {
    render(<TradeScreen />);
    expect(screen.getByText(/Nur 2x verkauft/i)).toBeTruthy();
  });
});
