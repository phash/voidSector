import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TradeWindow } from '../components/TradeWindow';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendTradeOffer: vi.fn(),
    sendTradeConfirm: vi.fn(),
    sendTradeCancel: vi.fn(),
  },
}));

import { network } from '../network/client';

const baseTrade = {
  tradeId: 'trade:A:B:1',
  fromPlayerId: 'A',
  fromPlayerName: 'Alice',
  toPlayerId: 'B',
  toPlayerName: 'Bob',
  fromItems: [],
  fromCredits: 0,
  toItems: [{ itemType: 'module' as const, itemId: 'drive_mk2', quantity: 1 }],
  toCredits: 250,
  confirmedBy: [] as string[],
  expiresAt: Date.now() + 60000,
};

describe('TradeWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no active trade', () => {
    mockStoreState({ activeTrade: null });
    const { container } = render(<TradeWindow />);
    expect(container.firstChild).toBeNull();
  });

  it('shows my editable offer (from cargo) and the counterparty offer read-only', () => {
    mockStoreState({
      activeTrade: baseTrade,
      playerId: 'A',
      inventory: [{ itemType: 'resource', itemId: 'ore', quantity: 8 }],
    });
    render(<TradeWindow />);
    expect(screen.getByText('DIREKTHANDEL — Bob')).toBeTruthy();
    // My offer column lists ore from cargo
    expect(screen.getByText(/ORE \(8\)/)).toBeTruthy();
    // Their offer column shows their module + credits
    expect(screen.getByText(/×1/)).toBeTruthy();
    expect(screen.getByText(/CR: 250/)).toBeTruthy();
  });

  it('sends an offer when increasing an item quantity', () => {
    mockStoreState({
      activeTrade: baseTrade,
      playerId: 'A',
      inventory: [{ itemType: 'resource', itemId: 'ore', quantity: 8 }],
    });
    render(<TradeWindow />);
    fireEvent.click(screen.getByText('+'));
    expect(vi.mocked(network.sendTradeOffer)).toHaveBeenCalledWith(
      'trade:A:B:1',
      [{ itemType: 'resource', itemId: 'ore', quantity: 1 }],
      0,
    );
  });

  it('marks the counterparty as confirmed', () => {
    mockStoreState({
      activeTrade: { ...baseTrade, confirmedBy: ['B'] },
      playerId: 'A',
      inventory: [],
    });
    render(<TradeWindow />);
    expect(screen.getByText(/hat bestätigt — wartet auf dich/)).toBeTruthy();
  });

  it('confirm and cancel buttons call the network', () => {
    mockStoreState({ activeTrade: baseTrade, playerId: 'A', inventory: [] });
    render(<TradeWindow />);
    fireEvent.click(screen.getByText('[BESTÄTIGEN]'));
    fireEvent.click(screen.getByText('[ABBRECHEN]'));
    expect(vi.mocked(network.sendTradeConfirm)).toHaveBeenCalledWith('trade:A:B:1');
    expect(vi.mocked(network.sendTradeCancel)).toHaveBeenCalledWith('trade:A:B:1');
  });
});
