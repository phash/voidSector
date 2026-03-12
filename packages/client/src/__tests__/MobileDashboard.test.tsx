import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileDashboard } from '../components/MobileDashboard';
import { mockStoreState } from '../test/mockStore';
import { MONITORS } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {
    sendStopMine: vi.fn(),
    sendCancelAutopilot: vi.fn(),
    sendSlowFlight: vi.fn(),
    sendJump: vi.fn(),
  },
}));

const baseState = {
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0, materials: [] },
  ship: { stats: { cargoCap: 50 } },
  bookmarks: [],
  autopilot: null,
  slowFlightActive: false,
  ap: { current: 80, max: 100, lastUpdated: Date.now(), regenRate: 1 },
  currentSector: { type: 'empty', contents: [] },
  position: { x: 5, y: 5 },
};

describe('MobileDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState(baseState as any);
  });

  it('renders the MINING card', () => {
    render(<MobileDashboard />);
    expect(screen.getByText(/MINING/i)).toBeInTheDocument();
  });

  it('shows INAKTIV when mining is not active', () => {
    render(<MobileDashboard />);
    expect(screen.getByText(/INAKTIV/i)).toBeInTheDocument();
  });

  it('shows AKTIV and resource name when mining is active', () => {
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/AKTIV/i)).toBeInTheDocument();
  });

  it('renders the CARGO card with used/cap', () => {
    mockStoreState({ ...baseState, cargo: { ore: 5, gas: 3, crystal: 0, materials: [] } } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/CARGO/i)).toBeInTheDocument();
    expect(screen.getByText(/8\s*\/\s*50/)).toBeInTheDocument();
  });

  it('does not render slow flight card when inactive', () => {
    render(<MobileDashboard />);
    expect(screen.queryByText(/SLOW FLIGHT/i)).not.toBeInTheDocument();
  });

  it('renders slow flight card when slowFlightActive is true', () => {
    mockStoreState({
      ...baseState,
      slowFlightActive: true,
      autopilot: { active: true, targetX: 8, targetY: 5, remaining: 3 },
    } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/SLOW FLIGHT/i)).toBeInTheDocument();
    expect(screen.getByText(/8\s*\/\s*5/)).toBeInTheDocument();
  });

  it('renders next destination card when bookmarks exist', () => {
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid 1' }],
    } as any);
    render(<MobileDashboard />);
    expect(screen.getByText(/NÄCHSTES ZIEL/i)).toBeInTheDocument();
    expect(screen.getByText(/Asteroid 1/i)).toBeInTheDocument();
  });

  it('does not render next destination card when no bookmarks', () => {
    render(<MobileDashboard />);
    expect(screen.queryByText(/NÄCHSTES ZIEL/i)).not.toBeInTheDocument();
  });

  it('renders AP bar', () => {
    render(<MobileDashboard />);
    expect(screen.getByText(/AP/i)).toBeInTheDocument();
  });

  it('STOP button on mining card calls sendStopMine', async () => {
    const { network } = await import('../network/client');
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(network.sendStopMine).toHaveBeenCalled();
  });
});
