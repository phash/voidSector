import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseScreen } from '../components/BaseScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestBase: vi.fn(),
    requestStorage: vi.fn(),
    requestCredits: vi.fn(),
    sendTransfer: vi.fn(),
    sendUpgradeStructure: vi.fn(),
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
      cargo: { ore: 10, gas: 5, crystal: 3, slates: 0, artefact: 0 },
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

  it('shows credits', () => {
    mockStoreState({
      baseStructures: [{ id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 250,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/CREDITS: 250/)).toBeTruthy();
  });

  it('shows storage section when storage built', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 's1', type: 'storage', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getAllByText(/LAGER/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ERZ: 10/)).toBeTruthy();
  });

  it('shows structure list with labels', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'c1', type: 'comm_relay', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getByText('KOMMANDO-KERN')).toBeTruthy();
    expect(screen.getByText('COMM RELAY')).toBeTruthy();
  });
});
