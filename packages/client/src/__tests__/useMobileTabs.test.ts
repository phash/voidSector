import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMobileTabs } from '../hooks/useMobileTabs';
import { mockStoreState } from '../test/mockStore';
import { MONITORS } from '@void-sector/shared';
import type { SectorData } from '@void-sector/shared';

const emptySector: SectorData = {
  x: 0,
  y: 0,
  type: 'empty',
  seed: 42,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
  environment: 'empty',
  contents: [],
};

const stationSector: SectorData = {
  x: 1,
  y: 1,
  type: 'station',
  seed: 99,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
  environment: 'empty',
  contents: ['station'],
};

describe('useMobileTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ currentSector: emptySector, alerts: {} });
  });

  it('returns exactly 5 tabs', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs).toHaveLength(5);
  });

  it('has NAV as first tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[0].id).toBe(MONITORS.NAV_COM);
    expect(result.current.tabs[0].label).toBe('NAV');
  });

  it('has SHIP as second tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[1].id).toBe(MONITORS.SHIP_SYS);
    expect(result.current.tabs[1].label).toBe('SHIP');
  });

  it('has CARGO as third tab when not at station', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[2].id).toBe(MONITORS.CARGO);
    expect(result.current.tabs[2].label).toBe('CARGO');
  });

  it('has TRADE as third tab when at station', () => {
    mockStoreState({ currentSector: stationSector, alerts: {} });
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[2].id).toBe(MONITORS.TRADE);
    expect(result.current.tabs[2].label).toBe('TRADE');
  });

  it('has COMMS as fourth tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[3].id).toBe(MONITORS.COMMS);
    expect(result.current.tabs[3].label).toBe('COMMS');
  });

  it('has MEHR as fifth tab with isMehr flag', () => {
    const { result } = renderHook(() => useMobileTabs());
    const mehr = result.current.tabs[4];
    expect(mehr.label).toBe('MEHR');
    expect(mehr.isMehr).toBe(true);
  });

  // --- MEHR monitors ---

  it('returns overflow monitors in mehrMonitors', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.MINING);
    expect(ids).toContain(MONITORS.BASE_LINK);
    expect(ids).toContain(MONITORS.FACTION);
    expect(ids).toContain(MONITORS.QUESTS);
    expect(ids).toContain(MONITORS.TECH);
    expect(ids).toContain(MONITORS.QUAD_MAP);
    expect(ids).toContain(MONITORS.LOG);
  });

  it('excludes CARGO from mehrMonitors when CARGO is in tab bar (not at station)', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    // CARGO is in position 3, so should NOT be in overflow
    expect(ids).not.toContain(MONITORS.CARGO);
    // TRADE should be in overflow since it is NOT in the tab bar
    expect(ids).toContain(MONITORS.TRADE);
  });

  it('excludes TRADE from mehrMonitors when TRADE is in tab bar (at station)', () => {
    mockStoreState({ currentSector: stationSector, alerts: {} });
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    // TRADE is in position 3, so should NOT be in overflow
    expect(ids).not.toContain(MONITORS.TRADE);
    // CARGO should be in overflow since it is NOT in the tab bar
    expect(ids).toContain(MONITORS.CARGO);
  });

  // --- Alert badge aggregation ---

  it('returns 0 mehrAlertCount when no alerts', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.mehrAlertCount).toBe(0);
  });

  it('counts alerts only for monitors in the MEHR list', () => {
    mockStoreState({
      currentSector: emptySector,
      alerts: {
        [MONITORS.MINING]: true,
        [MONITORS.FACTION]: true,
        [MONITORS.NAV_COM]: true, // not in MEHR list
      },
    });
    const { result } = renderHook(() => useMobileTabs());
    // NAV-COM is not in MEHR, so only MINING + FACTION = 2
    expect(result.current.mehrAlertCount).toBe(2);
  });

  it('does not count alert for contextual tab monitor', () => {
    // Not at station, so CARGO is in tab bar, not in MEHR
    mockStoreState({
      currentSector: emptySector,
      alerts: {
        [MONITORS.CARGO]: true,
      },
    });
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.mehrAlertCount).toBe(0);
  });

  it('handles null currentSector gracefully', () => {
    mockStoreState({ currentSector: null, alerts: {} });
    const { result } = renderHook(() => useMobileTabs());
    // Falls back to CARGO (not at station)
    expect(result.current.tabs[2].id).toBe(MONITORS.CARGO);
  });
});
