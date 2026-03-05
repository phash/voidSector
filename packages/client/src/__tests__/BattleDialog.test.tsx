import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattleDialog } from '../components/BattleDialog';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { sendBattleAction: vi.fn() },
}));

import { network } from '../network/client';

describe('BattleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no active battle', () => {
    mockStoreState({ activeBattle: null });
    const { container } = render(<BattleDialog />);
    expect(container.innerHTML).toBe('');
  });

  it('shows battle dialog with encounter info', () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 3,
        pirateHp: 50,
        pirateDamage: 14,
        sectorX: 10,
        sectorY: 20,
        canNegotiate: false,
        negotiateCost: 30,
      },
    });
    render(<BattleDialog />);
    expect(screen.getByText(/PIRATEN-KONTAKT/)).toBeDefined();
    expect(screen.getByText(/Piraten-Level: 3/)).toBeDefined();
    expect(screen.getByText(/\[KAMPF\]/)).toBeDefined();
    expect(screen.getByText(/\[FLUCHT\]/)).toBeDefined();
  });

  it('shows negotiate when canNegotiate is true', () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 2,
        pirateHp: 40,
        pirateDamage: 11,
        sectorX: 5,
        sectorY: 5,
        canNegotiate: true,
        negotiateCost: 20,
      },
    });
    render(<BattleDialog />);
    expect(screen.getByText(/\[VERHANDELN\]/)).toBeDefined();
    expect(screen.getByText(/20 CR/)).toBeDefined();
  });

  it('hides negotiate when canNegotiate is false', () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 1,
        pirateHp: 30,
        pirateDamage: 8,
        sectorX: 10,
        sectorY: 20,
        canNegotiate: false,
        negotiateCost: 10,
      },
    });
    render(<BattleDialog />);
    expect(screen.queryByText(/\[VERHANDELN\]/)).toBeNull();
    expect(screen.getByText(/Verhandlung erfordert/)).toBeDefined();
  });

  it('sends battle action on fight click', async () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 1,
        pirateHp: 30,
        pirateDamage: 8,
        sectorX: 10,
        sectorY: 20,
        canNegotiate: false,
        negotiateCost: 10,
      },
    });
    render(<BattleDialog />);
    await userEvent.click(screen.getByText(/\[KAMPF\]/));
    expect(network.sendBattleAction).toHaveBeenCalledWith('fight', 10, 20);
  });

  it('sends flee action on flee click', async () => {
    mockStoreState({
      activeBattle: {
        pirateLevel: 1,
        pirateHp: 30,
        pirateDamage: 8,
        sectorX: 5,
        sectorY: 15,
        canNegotiate: false,
        negotiateCost: 10,
      },
    });
    render(<BattleDialog />);
    await userEvent.click(screen.getByText(/\[FLUCHT\]/));
    expect(network.sendBattleAction).toHaveBeenCalledWith('flee', 5, 15);
  });
});
