import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CockpitLayout } from '../components/CockpitLayout';
import { mockStoreState } from '../test/mockStore';
import { useStore } from '../state/store';

// Mock network
vi.mock('../network/client', () => ({
  network: {
    sendChat: vi.fn(),
    sendCancelAutopilot: vi.fn(),
  },
}));

// Mock MonitorLeds (used by UnifiedBezel)
vi.mock('../components/MonitorLeds', () => ({
  useMonitorLeds: () => [],
  LedDot: () => null,
}));

// Mock heavy child components to isolate CockpitLayout tests
vi.mock('../components/DetailPanel', () => ({
  DetailPanel: () => <div data-testid="detail-panel">DetailPanel</div>,
}));
vi.mock('../components/TechDetailPanel', () => ({
  TechDetailPanel: () => <div data-testid="tech-detail-panel">TechDetailPanel</div>,
}));
vi.mock('../components/BaseDetailPanel', () => ({
  BaseDetailPanel: () => <div data-testid="base-detail-panel">BaseDetailPanel</div>,
}));
vi.mock('../components/CargoDetailPanel', () => ({
  CargoDetailPanel: () => <div data-testid="cargo-detail-panel">CargoDetailPanel</div>,
}));
vi.mock('../components/TradeDetailPanel', () => ({
  TradeDetailPanel: () => <div data-testid="trade-detail-panel">TradeDetailPanel</div>,
}));
vi.mock('../components/MiningDetailPanel', () => ({
  MiningDetailPanel: () => <div data-testid="mining-detail-panel">MiningDetailPanel</div>,
}));
vi.mock('../components/QuestDetailPanel', () => ({
  QuestDetailPanel: () => <div data-testid="quest-detail-panel">QuestDetailPanel</div>,
}));
vi.mock('../components/TestPattern', () => ({
  TestPattern: () => <div data-testid="test-pattern">TestPattern</div>,
}));
vi.mock('../components/TvScreen', () => ({
  TvScreen: () => <div data-testid="tv-screen">TvScreen</div>,
}));
vi.mock('../components/CommsScreen', () => ({
  CommsScreen: () => <div data-testid="comms-screen">CommsScreen</div>,
}));
vi.mock('../components/ShipStatusPanel', () => ({
  ShipStatusPanel: () => <div data-testid="ship-status-panel">ShipStatusPanel</div>,
}));
vi.mock('../components/CombatStatusPanel', () => ({
  CombatStatusPanel: () => <div data-testid="combat-status-panel">CombatStatusPanel</div>,
}));
vi.mock('../components/NavControls', () => ({
  NavControls: () => <div data-testid="nav-controls">NavControls</div>,
}));
vi.mock('../components/HUD', () => ({
  SectorInfo: () => <div data-testid="sector-info">SectorInfo</div>,
  StatusBar: () => <div data-testid="status-bar">StatusBar</div>,
}));

// Mock localStorage for SettingsPanel
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    storage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  }),
  get length() {
    return Object.keys(storage).length;
  },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

const mockRenderScreen = vi.fn((monitorId: string) => (
  <div data-testid={`main-screen-${monitorId}`}>{monitorId} screen</div>
));

describe('CockpitLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      activeProgram: 'NAV-COM',
      alerts: {},
      chatChannel: 'quadrant',
      monitorPower: {},
      zoomLevel: 2,
      panOffset: { x: 0, y: 0 },
      brightness: 1.0,
      colorProfile: 'Amber Classic',
    });
  });

  it('renders the cockpit-layout container', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('cockpit-layout')).toBeInTheDocument();
  });

  it('renders all 6 sections', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    const layout = screen.getByTestId('cockpit-layout');
    expect(layout.querySelector('.cockpit-sec1')).toBeInTheDocument();
    expect(layout.querySelector('.cockpit-sec2')).toBeInTheDocument();
    expect(layout.querySelector('.cockpit-sec3')).toBeInTheDocument();
    expect(layout.querySelector('.cockpit-sec4')).toBeInTheDocument();
    expect(layout.querySelector('.cockpit-sec5')).toBeInTheDocument();
    expect(layout.querySelector('.cockpit-sec6')).toBeInTheDocument();
  });

  it('renders ProgramSelector in section 1', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('program-selector')).toBeInTheDocument();
  });

  it('renders SettingsPanel in section 4', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    // SettingsPanel renders the "EINSTELLUNGEN" header
    expect(screen.getByText('EINSTELLUNGEN')).toBeInTheDocument();
  });

  it('renders hardware controls strips', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    const hwControls = screen.getAllByTestId('hardware-controls');
    // Section 2 (dpad+zoom), Section 3 (power), Section 6 (channels)
    expect(hwControls.length).toBe(3);
  });

  it('renders main screen content via renderScreen', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(mockRenderScreen).toHaveBeenCalledWith('NAV-COM');
    expect(screen.getByTestId('main-screen-NAV-COM')).toBeInTheDocument();
  });

  it('renders DetailPanel for NAV-COM program', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
  });

  it('renders CommsScreen in section 6', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('comms-screen')).toBeInTheDocument();
  });

  it('renders navigation components in section 5', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('sector-info')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('nav-controls')).toBeInTheDocument();
    expect(screen.getByTestId('ship-status-panel')).toBeInTheDocument();
    expect(screen.getByTestId('combat-status-panel')).toBeInTheDocument();
  });

  it('changes detail panel when activeProgram changes', () => {
    mockStoreState({
      activeProgram: 'CARGO',
      alerts: {},
      chatChannel: 'quadrant',
      monitorPower: {},
      zoomLevel: 2,
      panOffset: { x: 0, y: 0 },
      brightness: 1.0,
      colorProfile: 'Amber Classic',
    });
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('cargo-detail-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
  });

  it('renders TvScreen for unknown programs (default mode)', () => {
    mockStoreState({
      activeProgram: 'UNKNOWN',
      alerts: {},
      chatChannel: 'quadrant',
      monitorPower: {},
      monitorModes: {},
      zoomLevel: 2,
      panOffset: { x: 0, y: 0 },
      brightness: 1.0,
      colorProfile: 'Amber Classic',
    });
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('tv-screen')).toBeInTheDocument();
  });

  it('renders TestPattern for unknown programs when mode is detail', () => {
    mockStoreState({
      activeProgram: 'UNKNOWN',
      alerts: {},
      chatChannel: 'quadrant',
      monitorPower: {},
      monitorModes: { DETAIL: 'detail' },
      zoomLevel: 2,
      panOffset: { x: 0, y: 0 },
      brightness: 1.0,
      colorProfile: 'Amber Classic',
    });
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('test-pattern')).toBeInTheDocument();
  });

  it('shows DISPLAY OFF when detail monitor power is off', () => {
    mockStoreState({
      activeProgram: 'NAV-COM',
      alerts: {},
      chatChannel: 'quadrant',
      monitorPower: { DETAIL: false },
      zoomLevel: 2,
      panOffset: { x: 0, y: 0 },
      brightness: 1.0,
      colorProfile: 'Amber Classic',
    });
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    // Both CockpitLayout and UnifiedBezel render "DISPLAY OFF" when power is off
    const offTexts = screen.getAllByText('DISPLAY OFF');
    expect(offTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders channel switcher inside CommsScreen (not in hw strip)', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.queryByTestId('hw-channels')).not.toBeInTheDocument();
  });

  it('renders D-Pad in section 2 hardware strip', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('hw-dpad')).toBeInTheDocument();
  });

  it('renders follow button in section 3 hardware strip', () => {
    render(<CockpitLayout renderScreen={mockRenderScreen} />);
    expect(screen.getByTestId('hw-follow')).toBeInTheDocument();
  });

  it('renders correct detail panel for each program', () => {
    const programToDetail: Record<string, string> = {
      'NAV-COM': 'detail-panel',
      TECH: 'tech-detail-panel',
      'BASE-LINK': 'base-detail-panel',
      CARGO: 'cargo-detail-panel',
      TRADE: 'trade-detail-panel',
      MINING: 'mining-detail-panel',
      QUESTS: 'quest-detail-panel',
    };

    for (const [program, testId] of Object.entries(programToDetail)) {
      mockStoreState({
        activeProgram: program,
        alerts: {},
        chatChannel: 'quadrant',
        monitorPower: {},
        zoomLevel: 2,
        panOffset: { x: 0, y: 0 },
        brightness: 1.0,
        colorProfile: 'Amber Classic',
      });
      const { unmount } = render(<CockpitLayout renderScreen={mockRenderScreen} />);
      expect(screen.getByTestId(testId)).toBeInTheDocument();
      unmount();
    }
  });
});
