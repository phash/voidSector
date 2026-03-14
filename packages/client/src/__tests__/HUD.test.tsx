import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar, SectorInfo } from '../components/HUD';
import { mockStoreState } from '../test/mockStore';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockStoreState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders AP, fuel, and credits', () => {
    render(<StatusBar />);
    expect(screen.getByText(/AP:/)).toBeInTheDocument();
    expect(screen.getByText(/FUEL:/)).toBeInTheDocument();
    expect(screen.getByText(/CR:/)).toBeInTheDocument();
  });

  it('does not show hyperdrive section when hyperdriveState is null', () => {
    mockStoreState({ hyperdriveState: null });
    render(<StatusBar />);
    expect(screen.queryByText(/HYPER:/)).toBeNull();
  });

  it('does not show hyperdrive charge bar even when hyperdriveState is present', () => {
    mockStoreState({
      hyperdriveState: {
        charge: 5,
        maxCharge: 10,
        regenPerSecond: 0.1,
        lastTick: Date.now(),
      },
    });
    render(<StatusBar />);
    // HYPER has been moved to NavControls — should not appear in StatusBar
    expect(screen.queryByText(/HYPER:/)).toBeNull();
    expect(screen.queryByText(/5\/10/)).toBeNull();
  });

  it('shows only one FULL label (AP) when hyperdrive is fully charged', () => {
    mockStoreState({
      hyperdriveState: {
        charge: 10,
        maxCharge: 10,
        regenPerSecond: 0.1,
        lastTick: Date.now(),
      },
    });
    render(<StatusBar />);
    // HYPER removed from StatusBar; only AP can show FULL here
    const fullLabels = screen.getAllByText('FULL');
    expect(fullLabels.length).toBe(1);
  });

  it('does not show hyperdrive regen rate in StatusBar', () => {
    mockStoreState({
      hyperdriveState: {
        charge: 3,
        maxCharge: 10,
        regenPerSecond: 0.25,
        lastTick: Date.now(),
      },
    });
    render(<StatusBar />);
    // HYPER removed from StatusBar; 0.25/s should not appear here
    expect(screen.queryByText(/0\.25\/s/)).toBeNull();
  });

  it('shows guest badge when isGuest is true', () => {
    mockStoreState({ isGuest: true });
    render(<StatusBar />);
    expect(screen.getByText('[GAST]')).toBeInTheDocument();
  });

  it('does not show alien credits (moved elsewhere)', () => {
    mockStoreState({ alienCredits: 42 });
    render(<StatusBar />);
    // Alien credits removed from StatusBar in Sec 5 restructure
    expect(screen.queryByText(/A-CR: 42/)).not.toBeInTheDocument();
  });
});

describe('SectorInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState();
  });

  it('renders sector position with inner coords', () => {
    mockStoreState({ position: { x: 3, y: 7 } });
    render(<SectorInfo />);
    expect(screen.getByText(/3, 7/)).toBeInTheDocument();
  });

  it('renders player count', () => {
    mockStoreState({
      players: {
        a: { sessionId: 'a', userId: 'ua', username: 'A', x: 0, y: 0, connected: true },
        b: { sessionId: 'b', userId: 'ub', username: 'B', x: 0, y: 0, connected: true },
      },
    });
    render(<SectorInfo />);
    expect(screen.getByText(/PILOTS: 2/)).toBeInTheDocument();
  });
});
