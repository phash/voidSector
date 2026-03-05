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

  it('shows hyperdrive charge bar when hyperdriveState is present', () => {
    mockStoreState({
      hyperdriveState: {
        charge: 5,
        maxCharge: 10,
        regenPerSecond: 0.1,
        lastTick: Date.now(),
      },
    });
    render(<StatusBar />);
    expect(screen.getByText(/HYPER:/)).toBeInTheDocument();
    expect(screen.getByText(/5\/10/)).toBeInTheDocument();
  });

  it('shows FULL label when hyperdrive is fully charged', () => {
    mockStoreState({
      hyperdriveState: {
        charge: 10,
        maxCharge: 10,
        regenPerSecond: 0.1,
        lastTick: Date.now(),
      },
    });
    render(<StatusBar />);
    // Both AP and hyperdrive can show FULL; at least two FULL labels should be present
    const fullLabels = screen.getAllByText('FULL');
    expect(fullLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('shows regen rate for hyperdrive when not full', () => {
    mockStoreState({
      hyperdriveState: {
        charge: 3,
        maxCharge: 10,
        regenPerSecond: 0.25,
        lastTick: Date.now(),
      },
    });
    render(<StatusBar />);
    // AP has 0.5/s, hyperdrive has 0.25/s — this should be unique
    expect(screen.getByText(/0\.25\/s/)).toBeInTheDocument();
  });

  it('shows guest badge when isGuest is true', () => {
    mockStoreState({ isGuest: true });
    render(<StatusBar />);
    expect(screen.getByText('[GAST]')).toBeInTheDocument();
  });

  it('shows alien credits when present', () => {
    mockStoreState({ alienCredits: 42 });
    render(<StatusBar />);
    expect(screen.getByText(/A-CR: 42/)).toBeInTheDocument();
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
        a: { sessionId: 'a', username: 'A', x: 0, y: 0, connected: true },
        b: { sessionId: 'b', username: 'B', x: 0, y: 0, connected: true },
      },
    });
    render(<SectorInfo />);
    expect(screen.getByText(/PILOTS: 2/)).toBeInTheDocument();
  });
});
