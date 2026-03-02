import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseScreen } from '../components/BaseScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestBase: vi.fn(),
  },
}));

describe('BaseScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      position: { x: 5000000, y: 5000000 },
      baseStructures: [
        { id: '1', type: 'base', sector_x: 0, sector_y: 0, created_at: '2026-01-01' },
        { id: '2', type: 'comm_relay', sector_x: 0, sector_y: 0, created_at: '2026-01-02' },
      ],
      cargo: { ore: 10, gas: 5, crystal: 3 },
    });
  });

  it('renders base header', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/BASE-LINK/)).toBeTruthy();
  });

  it('shows structures list', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/KOMMANDO-KERN/i)).toBeTruthy();
    expect(screen.getByText(/COMM RELAY/i)).toBeTruthy();
  });

  it('shows empty state when no structures', () => {
    mockStoreState({ baseStructures: [] });
    render(<BaseScreen />);
    expect(screen.getByText(/NO BASE/i)).toBeTruthy();
  });
});
