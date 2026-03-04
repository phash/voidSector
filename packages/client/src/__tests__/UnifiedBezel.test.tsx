import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UnifiedBezel } from '../components/UnifiedBezel';
import { mockStoreState } from '../test/mockStore';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({
  network: {},
}));

/** Set up store with real setMonitorPower/setMonitorChromeVisible actions */
function setupStore(overrides: Record<string, unknown> = {}) {
  mockStoreState({
    monitorPower: {},
    monitorChromeVisible: {},
    brightness: 1,
    zoomLevel: 2,
    panOffset: { x: 0, y: 0 },
    autoFollow: false,
    setMonitorPower: (monitorId: string, on: boolean) =>
      useStore.setState((s) => ({
        monitorPower: { ...s.monitorPower, [monitorId]: on },
      })),
    setMonitorChromeVisible: (monitorId: string, visible: boolean) =>
      useStore.setState((s) => ({
        monitorChromeVisible: { ...s.monitorChromeVisible, [monitorId]: visible },
      })),
    setZoomLevel: (level: number) =>
      useStore.setState({ zoomLevel: Math.max(0, Math.min(4, level)) }),
    ...overrides,
  } as any);
}

describe('UnifiedBezel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Variant rendering ──

  describe('variants', () => {
    it('renders sidebar variant with correct class', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="COMMS">
          <div>content</div>
        </UnifiedBezel>
      );
      const bezel = screen.getByTestId('unified-bezel-COMMS');
      expect(bezel.className).toContain('unified-bezel-sidebar');
    });

    it('renders main variant with correct class', () => {
      render(
        <UnifiedBezel variant="main" monitorId="NAV-COM">
          <div>content</div>
        </UnifiedBezel>
      );
      const bezel = screen.getByTestId('unified-bezel-NAV-COM');
      expect(bezel.className).toContain('unified-bezel-main');
    });

    it('displays children content', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div data-testid="child">Test content</div>
        </UnifiedBezel>
      );
      expect(screen.getByTestId('child')).toHaveTextContent('Test content');
    });

    it('displays monitor ID as program label in top chrome', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="SHIP-SYS">
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByText('SHIP-SYS', { selector: '.unified-bezel-program-label' })).toBeDefined();
    });
  });

  // ── Power toggle ──

  describe('power toggle', () => {
    it('defaults to power on (no off-screen overlay)', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.queryByTestId('unified-bezel-off-screen')).toBeNull();
    });

    it('shows off-screen overlay when power is off', () => {
      setupStore({ monitorPower: { LOG: false } });
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByTestId('unified-bezel-off-screen')).toBeDefined();
      expect(screen.getByText('DISPLAY OFF')).toBeDefined();
    });

    it('calls setMonitorPower when power button is clicked (turning off)', () => {
      vi.useFakeTimers();
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      const powerBtn = screen.getByRole('button', { name: 'Monitor power' });
      fireEvent.click(powerBtn);
      // After shutdown animation
      act(() => { vi.advanceTimersByTime(500); });
      const state = useStore.getState();
      expect(state.monitorPower['LOG']).toBe(false);
      vi.useRealTimers();
    });

    it('turns on when power is off and button is clicked', () => {
      setupStore({ monitorPower: { LOG: false } });
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      const powerBtn = screen.getByRole('button', { name: 'Monitor power' });
      fireEvent.click(powerBtn);
      const state = useStore.getState();
      expect(state.monitorPower['LOG']).toBe(true);
    });

    it('shows green power LED when on', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      const led = screen.getByTestId('unified-bezel-power-led');
      // jsdom normalises hex to rgb
      expect(led.style.backgroundColor).toBe('rgb(0, 255, 136)');
    });

    it('shows orange power LED when off (standby)', () => {
      setupStore({ monitorPower: { LOG: false } });
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      const led = screen.getByTestId('unified-bezel-power-led');
      expect(led.style.backgroundColor).toBe('rgb(255, 176, 0)');
    });
  });

  // ── Mode cycling ──

  describe('mode cycling', () => {
    it('displays current mode label', () => {
      render(
        <UnifiedBezel
          variant="sidebar"
          monitorId="COMMS"
          modes={['direct', 'faction', 'sector', 'quadrant']}
          currentMode="direct"
          onModeChange={vi.fn()}
        >
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByTestId('unified-bezel-mode-label')).toHaveTextContent('DIRECT');
    });

    it('cycles to next mode on > click', () => {
      const onModeChange = vi.fn();
      render(
        <UnifiedBezel
          variant="sidebar"
          monitorId="COMMS"
          modes={['direct', 'faction', 'sector', 'quadrant']}
          currentMode="direct"
          onModeChange={onModeChange}
        >
          <div>content</div>
        </UnifiedBezel>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Next mode' }));
      expect(onModeChange).toHaveBeenCalledWith('faction');
    });

    it('cycles to previous mode on < click', () => {
      const onModeChange = vi.fn();
      render(
        <UnifiedBezel
          variant="sidebar"
          monitorId="COMMS"
          modes={['direct', 'faction', 'sector', 'quadrant']}
          currentMode="direct"
          onModeChange={onModeChange}
        >
          <div>content</div>
        </UnifiedBezel>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Previous mode' }));
      expect(onModeChange).toHaveBeenCalledWith('quadrant');
    });

    it('wraps around to first mode from last', () => {
      const onModeChange = vi.fn();
      render(
        <UnifiedBezel
          variant="sidebar"
          monitorId="COMMS"
          modes={['direct', 'faction', 'sector', 'quadrant']}
          currentMode="quadrant"
          onModeChange={onModeChange}
        >
          <div>content</div>
        </UnifiedBezel>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Next mode' }));
      expect(onModeChange).toHaveBeenCalledWith('direct');
    });

    it('does not show < > buttons for single mode', () => {
      render(
        <UnifiedBezel
          variant="sidebar"
          monitorId="LOG"
          modes={['default']}
          currentMode="default"
        >
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.queryByRole('button', { name: 'Next mode' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Previous mode' })).toBeNull();
    });
  });

  // ── Chrome toggle ──

  describe('chrome toggle', () => {
    it('shows top and bottom chrome by default', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByTestId('unified-bezel-chrome-top')).toBeDefined();
      expect(screen.getByTestId('unified-bezel-chrome-bottom')).toBeDefined();
    });

    it('hides chrome bars when chrome is toggled off', () => {
      setupStore({ monitorChromeVisible: { LOG: false } });
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.queryByTestId('unified-bezel-chrome-top')).toBeNull();
      expect(screen.queryByTestId('unified-bezel-chrome-bottom')).toBeNull();
    });

    it('shows restore button when chrome is hidden', () => {
      setupStore({ monitorChromeVisible: { LOG: false } });
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      const restoreBtn = screen.getByRole('button', { name: 'Toggle chrome' });
      expect(restoreBtn).toBeDefined();
      expect(restoreBtn).toHaveTextContent('[+]');
    });

    it('toggles chrome visibility on click', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG">
          <div>content</div>
        </UnifiedBezel>
      );
      // Chrome is visible, button shows [_]
      const toggleBtn = screen.getByTitle('Hide chrome bars');
      fireEvent.click(toggleBtn);
      const state = useStore.getState();
      expect(state.monitorChromeVisible['LOG']).toBe(false);
    });
  });

  // ── Alert LED ──

  describe('alert LED', () => {
    it('adds alert class when alert prop is true', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="COMMS" alert={true}>
          <div>content</div>
        </UnifiedBezel>
      );
      const bezel = screen.getByTestId('unified-bezel-COMMS');
      expect(bezel.className).toContain('unified-bezel-alert');
    });

    it('does not add alert class when alert prop is false', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="COMMS" alert={false}>
          <div>content</div>
        </UnifiedBezel>
      );
      const bezel = screen.getByTestId('unified-bezel-COMMS');
      expect(bezel.className).not.toContain('unified-bezel-alert');
    });
  });

  // ── Main variant extras ──

  describe('main variant extras', () => {
    it('shows zoom slider when showZoomSlider is true', () => {
      render(
        <UnifiedBezel variant="main" monitorId="NAV-COM" showZoomSlider>
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByTestId('unified-bezel-zoom')).toBeDefined();
      expect(screen.getByRole('slider', { name: 'Zoom level' })).toBeDefined();
    });

    it('does not show zoom slider for sidebar variant', () => {
      render(
        <UnifiedBezel variant="sidebar" monitorId="LOG" showZoomSlider>
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.queryByTestId('unified-bezel-zoom')).toBeNull();
    });

    it('shows pan arrows when showNavControls is true on main', () => {
      render(
        <UnifiedBezel variant="main" monitorId="NAV-COM" showNavControls>
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByTestId('unified-bezel-pan-arrows')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Pan up' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Pan left' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Pan right' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Pan down' })).toBeDefined();
    });

    it('shows auto-follow toggle when showNavControls is true', () => {
      render(
        <UnifiedBezel variant="main" monitorId="NAV-COM" showNavControls>
          <div>content</div>
        </UnifiedBezel>
      );
      expect(screen.getByRole('button', { name: 'Toggle auto-follow' })).toBeDefined();
    });

    it('updates zoom level when slider changes', () => {
      render(
        <UnifiedBezel variant="main" monitorId="NAV-COM" showZoomSlider>
          <div>content</div>
        </UnifiedBezel>
      );
      const slider = screen.getByRole('slider', { name: 'Zoom level' });
      fireEvent.change(slider, { target: { value: '3' } });
      const state = useStore.getState();
      expect(state.zoomLevel).toBe(3);
    });
  });
});
