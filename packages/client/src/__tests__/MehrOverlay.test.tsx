import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MehrOverlay } from '../components/MehrOverlay';
import { mockStoreState } from '../test/mockStore';
import { useStore } from '../state/store';
import { MONITORS } from '@void-sector/shared';

const TEST_MONITORS = [
  { id: MONITORS.MINING, icon: '\u26CF', label: 'MINING' },
  { id: MONITORS.BASE_LINK, icon: '\u2302', label: 'BASE' },
  { id: MONITORS.FACTION, icon: '\u2694', label: 'FRAKTION' },
  { id: MONITORS.LOG, icon: '\u25B6', label: 'LOG' },
];

function setupStore(overrides: Record<string, unknown> = {}) {
  mockStoreState({
    moreOverlayOpen: false,
    setMoreOverlayOpen: (open: boolean) => useStore.setState({ moreOverlayOpen: open }),
    setActiveMonitor: (monitor: string) => useStore.setState({ activeMonitor: monitor }),
    clearAlert: (monitorId: string) =>
      useStore.setState((s) => {
        const next = { ...s.alerts };
        delete next[monitorId];
        return { alerts: next };
      }),
    alerts: {},
    ...overrides,
  } as any);
}

describe('MehrOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('does not render when moreOverlayOpen is false', () => {
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    expect(screen.queryByTestId('mehr-overlay')).toBeNull();
  });

  it('renders overlay when moreOverlayOpen is true', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    expect(screen.getByTestId('mehr-overlay')).toBeDefined();
  });

  it('renders all monitor cards', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    expect(screen.getByTestId('mehr-card-MINING')).toBeDefined();
    expect(screen.getByTestId('mehr-card-BASE-LINK')).toBeDefined();
    expect(screen.getByTestId('mehr-card-FACTION')).toBeDefined();
    expect(screen.getByTestId('mehr-card-LOG')).toBeDefined();
  });

  it('displays PROGRAMME title', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    expect(screen.getByText('PROGRAMME')).toBeDefined();
  });

  it('switches to selected monitor and closes overlay on card click', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    fireEvent.click(screen.getByTestId('mehr-card-MINING'));
    const state = useStore.getState();
    expect(state.activeMonitor).toBe(MONITORS.MINING);
    expect(state.moreOverlayOpen).toBe(false);
  });

  it('closes overlay on backdrop click', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    fireEvent.click(screen.getByTestId('mehr-overlay'));
    expect(useStore.getState().moreOverlayOpen).toBe(false);
  });

  it('does not close overlay when clicking inside content', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    fireEvent.click(screen.getByTestId('mehr-overlay-content'));
    expect(useStore.getState().moreOverlayOpen).toBe(true);
  });

  it('closes overlay on [X] button click', () => {
    setupStore({ moreOverlayOpen: true });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    fireEvent.click(screen.getByTestId('mehr-overlay-close'));
    expect(useStore.getState().moreOverlayOpen).toBe(false);
  });

  it('shows alert badge on monitors with active alerts', () => {
    setupStore({
      moreOverlayOpen: true,
      alerts: { [MONITORS.MINING]: true },
    });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    expect(screen.getByTestId('mehr-badge-MINING')).toBeDefined();
    expect(screen.queryByTestId('mehr-badge-LOG')).toBeNull();
  });

  it('adds alert class to card with active alert', () => {
    setupStore({
      moreOverlayOpen: true,
      alerts: { [MONITORS.FACTION]: true },
    });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    const card = screen.getByTestId('mehr-card-FACTION');
    expect(card.className).toContain('alert');
  });

  it('clears alert when selecting an alerted monitor', () => {
    setupStore({
      moreOverlayOpen: true,
      alerts: { [MONITORS.MINING]: true },
    });
    render(<MehrOverlay monitors={TEST_MONITORS} />);
    fireEvent.click(screen.getByTestId('mehr-card-MINING'));
    const state = useStore.getState();
    expect(state.alerts[MONITORS.MINING]).toBeUndefined();
  });
});
