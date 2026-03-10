import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    expect(screen.getByText('AUSWAHL TREFFEN')).toBeTruthy();
  });

  it('calls sendJettison when ABWERFEN button clicked', () => {
    mockStoreState({ selectedCargoItem: 'ore', cargo: { ore: 5 } as any });
    render(<CargoDetailPanel />);
    const btn = screen.getByText('[ABWERFEN]');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(network.sendJettison).toHaveBeenCalledWith('ore');
  });

  it('ABWERFEN button is not disabled', () => {
    mockStoreState({ selectedCargoItem: 'ore', cargo: { ore: 3 } as any });
    render(<CargoDetailPanel />);
    const btn = screen.getByText('[ABWERFEN]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});
