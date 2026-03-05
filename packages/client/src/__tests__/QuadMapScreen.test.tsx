import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuadMapScreen } from '../components/QuadMapScreen';
import { mockStoreState } from '../test/mockStore';
import type { FirstContactEvent } from '@void-sector/shared';

// Polyfill ResizeObserver for jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

vi.mock('../network/client', () => ({
  network: {
    requestKnownQuadrants: vi.fn(),
    requestSyncQuadrants: vi.fn(),
    sendNameQuadrant: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('QuadMapScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({});
  });

  it('renders with canvas and info panel', () => {
    mockStoreState({ knownQuadrants: [] });
    const { container } = render(<QuadMapScreen />);
    expect(screen.getByText(/QUADRANTS:/)).toBeDefined();
    expect(container.textContent).toContain('KNOWN');
  });

  it('requests known quadrants on mount', () => {
    render(<QuadMapScreen />);
    expect(network.requestKnownQuadrants).toHaveBeenCalled();
  });

  it('shows known quadrant count', () => {
    mockStoreState({
      knownQuadrants: [
        { qx: 0, qy: 0, learnedAt: '2026-01-01T00:00:00.000Z' },
        { qx: 1, qy: 0, learnedAt: '2026-01-02T00:00:00.000Z' },
        { qx: 0, qy: 1, learnedAt: '2026-01-03T00:00:00.000Z' },
      ],
    });
    render(<QuadMapScreen />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows current quadrant coordinates', () => {
    mockStoreState({ position: { x: 0, y: 0 } });
    render(<QuadMapScreen />);
    expect(screen.getByText('(0, 0)')).toBeDefined();
  });

  it('renders zoom buttons', () => {
    render(<QuadMapScreen />);
    expect(screen.getByText('+')).toBeDefined();
    expect(screen.getByText('-')).toBeDefined();
    expect(screen.getByText('CENTER')).toBeDefined();
  });

  it('renders sync button', () => {
    render(<QuadMapScreen />);
    expect(screen.getByText('SYNC')).toBeDefined();
  });

  it('calls syncQuadrants on SYNC button click', async () => {
    render(<QuadMapScreen />);
    const syncBtn = screen.getByText('SYNC');
    await userEvent.click(syncBtn);
    expect(network.requestSyncQuadrants).toHaveBeenCalled();
  });

  it('renders canvas element', () => {
    const { container } = render(<QuadMapScreen />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeDefined();
    expect(canvas).not.toBeNull();
  });

  describe('FirstContactDialog', () => {
    const firstContactEvent: FirstContactEvent = {
      quadrant: {
        qx: 5,
        qy: 3,
        seed: 42,
        name: null,
        discoveredBy: 'test-id',
        discoveredAt: '2026-01-01T00:00:00.000Z',
        config: {
          seed: 42,
          resourceFactor: 1,
          stationDensity: 0.05,
          pirateDensity: 0.07,
          nebulaThreshold: 0.5,
          emptyRatio: 0.55,
        },
      },
      canName: true,
      autoName: 'Sector Alpha-42',
    };

    it('shows dialog when firstContactEvent is set', () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);
      expect(screen.getByText('FIRST CONTACT')).toBeDefined();
    });

    it('shows auto-name suggestion', () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);
      expect(screen.getByText('Sector Alpha-42')).toBeDefined();
    });

    it('shows quadrant coordinates', () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);
      expect(screen.getByText(/5, 3/)).toBeDefined();
    });

    it('shows CONFIRM and SKIP buttons', () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);
      expect(screen.getByText('CONFIRM')).toBeDefined();
      expect(screen.getByText('SKIP')).toBeDefined();
    });

    it('shows countdown timer', () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);
      expect(screen.getByText('60s')).toBeDefined();
    });

    it('sends name on confirm with valid input', async () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);

      const input = screen.getByPlaceholderText('Sector Alpha-42');
      await userEvent.type(input, 'My Quadrant');

      const confirmBtn = screen.getByText('CONFIRM');
      await userEvent.click(confirmBtn);
      expect(network.sendNameQuadrant).toHaveBeenCalledWith(5, 3, 'My Quadrant');
    });

    it('does not send name on confirm with invalid (too short) input', async () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);

      const input = screen.getByPlaceholderText('Sector Alpha-42');
      await userEvent.type(input, 'AB');

      const confirmBtn = screen.getByText('CONFIRM');
      await userEvent.click(confirmBtn);
      expect(network.sendNameQuadrant).not.toHaveBeenCalled();
    });

    it('dismisses dialog on SKIP', async () => {
      const setFirstContactEvent = vi.fn();
      mockStoreState({ firstContactEvent, setFirstContactEvent });
      render(<QuadMapScreen />);

      const skipBtn = screen.getByText('SKIP');
      await userEvent.click(skipBtn);

      // setFirstContactEvent should have been called with null
      expect(setFirstContactEvent).toHaveBeenCalledWith(null);
    });

    it('does not show dialog when no event', () => {
      mockStoreState({ firstContactEvent: null });
      render(<QuadMapScreen />);
      expect(screen.queryByText('FIRST CONTACT')).toBeNull();
    });

    it('has input field with correct placeholder', () => {
      mockStoreState({ firstContactEvent });
      render(<QuadMapScreen />);
      const input = screen.getByPlaceholderText('Sector Alpha-42');
      expect(input).toBeDefined();
    });
  });
});
