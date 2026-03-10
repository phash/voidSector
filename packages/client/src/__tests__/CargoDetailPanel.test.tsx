import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CargoDetailPanel } from '../components/CargoDetailPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendJettison: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('CargoDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ selectedCargoItem: null });
  });

  it('renders nothing selected when selectedCargoItem is null', () => {
    mockStoreState({ selectedCargoItem: null });
    render(<CargoDetailPanel />);
    expect(screen.getByText('SELECT AN ITEM')).toBeTruthy();
  });

  it('calls sendJettison when JETTISON button clicked', async () => {
    mockStoreState({ selectedCargoItem: 'ore', cargo: { ore: 5 } as any });
    render(<CargoDetailPanel />);
    const btn = screen.getByText('[JETTISON]');
    await userEvent.click(btn);
    expect(network.sendJettison).toHaveBeenCalledWith('ore');
  });

  it('JETTISON button is not disabled', () => {
    mockStoreState({ selectedCargoItem: 'ore', cargo: { ore: 3 } as any });
    render(<CargoDetailPanel />);
    const btn = screen.getByText('[JETTISON]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});
