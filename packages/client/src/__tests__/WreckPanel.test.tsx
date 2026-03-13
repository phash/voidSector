import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WreckPanel } from '../components/WreckPanel';
import { useStore } from '../state/store';
import { network } from '../network/client';

vi.mock('../network/client', () => ({
  network: { sendStartSalvage: vi.fn(), sendCancelSalvage: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    activeWreck: {
      wreckId: 'wreck-1',
      tier: 2,
      size: 'medium',
      items: [
        { itemType: 'resource', itemId: 'ore', quantity: 10, baseDifficulty: 0.20, salvaged: false },
        { itemType: 'module', itemId: 'drive_mk2', quantity: 1, baseDifficulty: 0.50, salvaged: false },
      ],
    },
    salvageSession: null,
  });
});

describe('WreckPanel', () => {
  it('renders wreck tier and items', () => {
    render(<WreckPanel />);
    expect(screen.getByText(/WRACK — TIER 2/)).toBeInTheDocument();
    expect(screen.getByText(/ORE ×10/)).toBeInTheDocument();
    expect(screen.getByText(/drive_mk2/)).toBeInTheDocument();
  });

  it('shows BERGEN buttons for unsalvaged items', () => {
    render(<WreckPanel />);
    const buttons = screen.getAllByText('[BERGEN]');
    expect(buttons).toHaveLength(2);
  });

  it('calls sendStartSalvage with item index on BERGEN click', async () => {
    render(<WreckPanel />);
    const buttons = screen.getAllByText('[BERGEN]');
    await userEvent.click(buttons[0]);
    expect(network.sendStartSalvage).toHaveBeenCalledWith(0);
  });

  it('shows progress bar during active salvage session', () => {
    useStore.setState({
      salvageSession: { wreckId: 'wreck-1', itemIndex: 0, duration: 4000, chance: 0.78, startedAt: Date.now() },
    });
    render(<WreckPanel />);
    expect(screen.getByText(/BERGUNG/)).toBeInTheDocument();
  });

  it('returns null when no activeWreck', () => {
    useStore.setState({ activeWreck: null });
    const { container } = render(<WreckPanel />);
    expect(container.firstChild).toBeNull();
  });
});
