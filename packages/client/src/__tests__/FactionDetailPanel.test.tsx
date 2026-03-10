import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionDetailPanel } from '../components/FactionDetailPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { requestHumanityReps: vi.fn() },
}));

const faction = {
  id: 'f1', name: 'STELLAR COMPACT', tag: 'SC',
  leaderId: 'p1', joinMode: 'invite' as const, memberCount: 7, createdAt: Date.now(),
};
const members = [
  { playerId: 'p1', playerName: 'Alpha', rank: 'leader' as const, joinedAt: Date.now() },
  { playerId: 'p2', playerName: 'Beta', rank: 'officer' as const, joinedAt: Date.now() },
];

function memberState(overrides: Record<string, any> = {}) {
  mockStoreState({
    faction,
    factionMembers: members,
    factionUpgrades: [],
    playerId: 'p1',
    humanityReps: {},
    recruitingFactions: [],
    monitorModes: {},
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

function noFactionState(overrides: Record<string, any> = {}) {
  mockStoreState({
    faction: null,
    factionMembers: [],
    factionUpgrades: [],
    playerId: 'p1',
    humanityReps: {},
    recruitingFactions: [],
    monitorModes: {},
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

describe('FactionDetailPanel — State A (member)', () => {
  beforeEach(() => { vi.clearAllMocks(); memberState(); });

  it('shows faction name and member count', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/STELLAR COMPACT/)).toBeDefined();
    expect(screen.getByText(/7 MEMBERS/)).toBeDefined();
  });

  it('shows player rank as LEADER', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/LEADER/)).toBeDefined();
  });

  it('shows OFFICER rank for officer player', () => {
    memberState({ playerId: 'p2' });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/OFFICER/)).toBeDefined();
  });

  it('shows active upgrades', () => {
    memberState({
      factionUpgrades: [{ tier: 1, choice: 'A', chosenAt: Date.now() }],
    });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/AKTIVE UPGRADES/)).toBeDefined();
  });

  it('shows next tier info when upgrades remain', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NÄCHSTER UPGRADE/)).toBeDefined();
    expect(screen.getByText(/TIER 1/)).toBeDefined();
  });

  it('[MEMBERS →] calls setMonitorMode(FACTION, members)', async () => {
    const setMonitorMode = vi.fn();
    memberState({ setMonitorMode });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[MEMBERS →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'members');
  });

  it('[UPGRADES →] calls setMonitorMode(FACTION, upgrades)', async () => {
    const setMonitorMode = vi.fn();
    memberState({ setMonitorMode });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[UPGRADES →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'upgrades');
  });
});

describe('FactionDetailPanel — State B (non-member)', () => {
  beforeEach(() => { vi.clearAllMocks(); noFactionState(); });

  it('shows LOADING when humanityReps empty', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/HUMANITY REP: LOADING/)).toBeDefined();
  });

  it('shows humanity rep tier and value', () => {
    noFactionState({
      humanityReps: {
        aliens1: { repValue: 12, tier: 'NEUTRAL' as const },
      },
    });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NEUTRAL/)).toBeDefined();
    expect(screen.getByText(/\+12/)).toBeDefined();
  });

  it('shows NO CONNECTION when no recruiting factions', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NO CONNECTION TO NETWORK/)).toBeDefined();
  });

  it('shows recruiting faction card with name and slogan', () => {
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'STELLAR COMPACT', color: null, slogan: 'Mine together', memberCount: 7 },
      ],
    });
    render(<FactionDetailPanel />);
    expect(screen.getAllByText(/STELLAR COMPACT/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mine together/)).toBeDefined();
    expect(screen.getByText(/1 OF 1/)).toBeDefined();
  });

  it('does not show progress dots when only 1 recruiting faction', () => {
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'IRON VEIL', color: null, slogan: null, memberCount: 4 },
      ],
    });
    render(<FactionDetailPanel />);
    expect(screen.queryByTestId('progress-dots')).toBeNull();
  });

  it('shows progress dots for multiple recruiting factions', () => {
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'A', color: null, slogan: 'Slogan A', memberCount: 3 },
        { factionId: 'f2', name: 'B', color: null, slogan: 'Slogan B', memberCount: 5 },
      ],
    });
    render(<FactionDetailPanel />);
    expect(screen.getByTestId('progress-dots')).toBeDefined();
  });

  it('faction card button calls setMonitorMode(FACTION, info)', async () => {
    const setMonitorMode = vi.fn();
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'IRON VEIL', color: null, slogan: null, memberCount: 4 },
      ],
      setMonitorMode,
    });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[IRON VEIL →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'info');
  });
});
