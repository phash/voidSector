import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMobileTabs } from '../hooks/useMobileTabs';
import { mockStoreState } from '../test/mockStore';
import { MONITORS } from '@void-sector/shared';
import type { SectorData } from '@void-sector/shared';

const emptySector: SectorData = {
  x: 0, y: 0, type: 'empty', seed: 42,
  discoveredBy: null, discoveredAt: null, metadata: {}, environment: 'empty', contents: [],
};

const MOBILE_HOME_ID = '__HOME__';

describe('useMobileTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ currentSector: emptySector, alerts: {} });
  });

  it('returns exactly 5 tabs', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs).toHaveLength(5);
  });

  it('HOME is first tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[0].id).toBe(MOBILE_HOME_ID);
    expect(result.current.tabs[0].label).toBe('HOME');
  });

  it('NAV is second tab with NAV-COM id', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[1].id).toBe(MONITORS.NAV_COM);
    expect(result.current.tabs[1].label).toBe('NAV');
  });

  it('MINE is third tab with MINING id', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[2].id).toBe(MONITORS.MINING);
    expect(result.current.tabs[2].label).toBe('MINE');
  });

  it('QUESTS is fourth tab', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs[3].id).toBe(MONITORS.QUESTS);
    expect(result.current.tabs[3].label).toBe('QUESTS');
  });

  it('MEHR is fifth tab with isMehr flag', () => {
    const { result } = renderHook(() => useMobileTabs());
    const mehr = result.current.tabs[4];
    expect(mehr.label).toBe('MEHR');
    expect(mehr.isMehr).toBe(true);
  });

  it('MEHR contains SHIP-SYS', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.SHIP_SYS);
  });

  it('MEHR contains COMMS', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.COMMS);
  });

  it('MEHR contains TRADE', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).toContain(MONITORS.TRADE);
  });

  it('MEHR does NOT contain MINING (it is a main tab)', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).not.toContain(MONITORS.MINING);
  });

  it('MEHR does NOT contain QUESTS (it is a main tab)', () => {
    const { result } = renderHook(() => useMobileTabs());
    const ids = result.current.mehrMonitors.map((m) => m.id);
    expect(ids).not.toContain(MONITORS.QUESTS);
  });

  it('counts alerts only for monitors in MEHR list', () => {
    mockStoreState({
      currentSector: emptySector,
      alerts: {
        [MONITORS.COMMS]: true,
        [MONITORS.SHIP_SYS]: true,
        [MONITORS.NAV_COM]: true, // not in MEHR
      },
    });
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.mehrAlertCount).toBe(2);
  });

  it('returns 0 mehrAlertCount when no alerts', () => {
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.mehrAlertCount).toBe(0);
  });

  it('handles null currentSector gracefully', () => {
    mockStoreState({ currentSector: null, alerts: {} });
    const { result } = renderHook(() => useMobileTabs());
    expect(result.current.tabs).toHaveLength(5);
  });
});
