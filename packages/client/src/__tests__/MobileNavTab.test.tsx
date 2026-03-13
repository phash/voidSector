import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNavTab } from '../components/MobileNavTab';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendSlowFlight: vi.fn(),
    sendJump: vi.fn(),
    sendCancelAutopilot: vi.fn(),
  },
}));

// Mock localStorage (jsdom may not have a full implementation in this environment)
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
});

// RadarCanvas is a canvas element — mock it to avoid jsdom canvas issues
vi.mock('../components/RadarCanvas', () => ({
  RadarCanvas: ({ onSectorTap }: { onSectorTap?: (x: number, y: number) => void }) => (
    <div
      data-testid="radar-canvas-mock"
      onClick={() => onSectorTap?.(10, 7)}
    />
  ),
}));

const baseState = {
  bookmarks: [],
  autopilot: null,
  slowFlightActive: false,
  position: { x: 5, y: 5 },
};

describe('MobileNavTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    mockStoreState(baseState as any);
  });

  it('renders mode toggle with SLOW and JUMP buttons', () => {
    render(<MobileNavTab />);
    expect(screen.getByText(/SLOW/i)).toBeInTheDocument();
    expect(screen.getByText(/JUMP/i)).toBeInTheDocument();
  });

  it('defaults to JUMP mode', () => {
    render(<MobileNavTab />);
    const jumpBtn = screen.getByRole('button', { name: /JUMP/i });
    expect(jumpBtn.className).toContain('active');
  });

  it('tapping radar in JUMP mode calls sendJump', async () => {
    const { network } = await import('../network/client');
    render(<MobileNavTab />);
    await userEvent.click(screen.getByTestId('radar-canvas-mock'));
    expect(network.sendJump).toHaveBeenCalledWith(10, 7);
  });

  it('switching to SLOW mode and tapping radar calls sendSlowFlight', async () => {
    const { network } = await import('../network/client');
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /SLOW/i }));
    await userEvent.click(screen.getByTestId('radar-canvas-mock'));
    expect(network.sendSlowFlight).toHaveBeenCalledWith(10, 7);
  });

  it('persists navMode to localStorage when toggled', async () => {
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /SLOW/i }));
    expect(localStorage.getItem('vs_mobile_nav_mode')).toBe('slow');
  });

  it('reads navMode from localStorage on mount', () => {
    localStorage.setItem('vs_mobile_nav_mode', 'slow');
    render(<MobileNavTab />);
    const slowBtn = screen.getByRole('button', { name: /SLOW/i });
    expect(slowBtn.className).toContain('active');
  });

  it('renders bookmark list when bookmarks exist', () => {
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid Base' }],
    } as any);
    render(<MobileNavTab />);
    expect(screen.getByText(/Asteroid Base/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mobile\.go/i })).toBeInTheDocument();
  });

  it('bookmark GO sends sendSlowFlight in SLOW mode', async () => {
    const { network } = await import('../network/client');
    localStorage.setItem('vs_mobile_nav_mode', 'slow');
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid Base' }],
    } as any);
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /mobile\.go/i }));
    expect(network.sendSlowFlight).toHaveBeenCalledWith(10, 7);
  });

  it('bookmark GO sends sendJump in JUMP mode', async () => {
    const { network } = await import('../network/client');
    mockStoreState({
      ...baseState,
      bookmarks: [{ slot: 1, sectorX: 10, sectorY: 7, label: 'Asteroid Base' }],
    } as any);
    render(<MobileNavTab />);
    await userEvent.click(screen.getByRole('button', { name: /mobile\.go/i }));
    expect(network.sendJump).toHaveBeenCalledWith(10, 7);
  });

  it('shows slow flight progress when active', () => {
    mockStoreState({
      ...baseState,
      slowFlightActive: true,
      autopilot: { active: true, targetX: 8, targetY: 5, remaining: 3 },
    } as any);
    render(<MobileNavTab />);
    expect(screen.getByText(/mobile\.sectors/i)).toBeInTheDocument();
  });
});
