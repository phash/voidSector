import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationManagePanel } from '../StationManagePanel';
import { mockStoreState } from '../../test/mockStore';

vi.mock('../../network/client', () => ({
  network: {
    sendBuildStationExpansion: vi.fn(),
    sendStationMarketTrade: vi.fn(),
  },
}));

const station = {
  id: 's1',
  level: 2,
  factory_level: 0,
  cargo_level: 0,
  markt_level: 1,
  werft_level: 0,
  refinery_level: 0,
  sensor_level: 0,
  trade_volume: 1500,
  building_expansion: null,
  build_complete_at: null,
  cargo_contents: {},
  sector_x: 1,
  sector_y: 2,
  sectorX: 1,
  sectorY: 2,
  ownerId: 'player1',
};

describe('StationManagePanel expansions', () => {
  beforeEach(() => {
    mockStoreState({});
  });

  it('shows expansions and a Betrieb indicator', () => {
    render(<StationManagePanel station={station as any} />);
    expect(screen.getAllByText(/Markt/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Werft/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/BETRIEB/i)).toBeInTheDocument();
  });

  it('renders all 6 expansion types', () => {
    render(<StationManagePanel station={station as any} />);
    expect(screen.getAllByText(/Fabrik/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Lager/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Markt/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Werft/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Raffinerie/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Sensor/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Markt section when markt_level >= 1', () => {
    render(<StationManagePanel station={station as any} />);
    // MARKT section header plus resource rows
    const marktElements = screen.getAllByText(/MARKT/i);
    expect(marktElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/KAUFEN/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/VERKAUFEN/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does not show Markt section when markt_level is 0', () => {
    const noMarkt = { ...station, markt_level: 0 };
    render(<StationManagePanel station={noMarkt as any} />);
    expect(screen.queryByText(/\[KAUFEN\]/)).toBeNull();
  });

  it('shows build-in-progress row when building_expansion is set', () => {
    const building = {
      ...station,
      building_expansion: 'cargo',
      build_complete_at: new Date(Date.now() + 60000).toISOString(),
    };
    render(<StationManagePanel station={building as any} />);
    expect(screen.getByText(/LAGER BAUT/i)).toBeInTheDocument();
  });

  it('disables Bauen buttons when a build is in progress', () => {
    const building = {
      ...station,
      building_expansion: 'cargo',
      build_complete_at: new Date(Date.now() + 60000).toISOString(),
    };
    render(<StationManagePanel station={building as any} />);
    const bauenBtns = screen.getAllByRole('button', { name: /BAUEN/i });
    bauenBtns.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('shows tier-locked hint when expansion level would exceed station level', () => {
    // Station level 1 — all expansions at 0, so nextLevel=1 <= stationLevel=1 (not tier-locked for level 1)
    // But with level=1 and trying level 2 (which would be currentLevel+1=1, nextLevel=1 <= stationLevel=1 — OK)
    // For level 1 station, factory LV1 is fine; LV2 would need station LV2
    const lvl1Station = { ...station, level: 1, factory_level: 1, markt_level: 0 };
    render(<StationManagePanel station={lvl1Station as any} />);
    // factory at LV1, station LV1 — nextLevel=2 > stationLevel=1 → tier locked
    expect(screen.getByText(/STATION STUFE 2 NÖTIG/i)).toBeInTheDocument();
  });

  it('shows [?] help button', () => {
    render(<StationManagePanel station={station as any} />);
    expect(screen.getByTitle('Hilfe')).toBeInTheDocument();
  });

  it('shows trade_volume in Betrieb bar', () => {
    render(<StationManagePanel station={station as any} />);
    expect(screen.getByText(/1.500|1500/)).toBeInTheDocument();
  });
});
