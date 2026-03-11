import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionDetailPanel } from '../components/FactionDetailPanel';
import { mockStoreState } from '../test/mockStore';
import { FACTION_UPGRADE_TIERS } from '@void-sector/shared';

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
    expect(screen.getByText(/ACTIVE UPGRADES/)).toBeDefined();
  });

  it('shows next tier info when upgrades remain', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NEXT UPGRADE/)).toBeDefined();
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

  it('shows next upgrade with both option names', () => {
    memberState({ factionUpgrades: [] });
    render(<FactionDetailPanel />);
    const tierDef = FACTION_UPGRADE_TIERS[1];
    expect(screen.getByText(new RegExp(tierDef.optionA.name, 'i'))).toBeDefined();
    expect(screen.getByText(new RegExp(tierDef.optionB.name, 'i'))).toBeDefined();
  });

  it('shows active upgrade effects, not just names', () => {
    memberState({
      factionUpgrades: [{ tier: 1, choice: 'A' as const, chosenAt: Date.now() }],
    });
    render(<FactionDetailPanel />);
    const effect = FACTION_UPGRADE_TIERS[1].optionA.effect;
    expect(screen.getByText(new RegExp(effect.replace(/[+%]/g, '\\$&'), 'i'))).toBeDefined();
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

  it('shows NO OPEN RECRUITMENT when no recruiting factions', () => {
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NO OPEN RECRUITMENT/)).toBeDefined();
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

  it('faction card button calls setActiveProgram(FACTION)', async () => {
    const setActiveProgram = vi.fn();
    noFactionState({
      recruitingFactions: [
        { factionId: 'f1', name: 'IRON VEIL', color: null, slogan: null, memberCount: 4 },
      ],
      setActiveProgram,
    });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText('[IRON VEIL →]'));
    expect(setActiveProgram).toHaveBeenCalledWith('FACTION');
  });

  it('shows NO OPEN RECRUITMENT when recruitingFactions empty', () => {
    noFactionState({ recruitingFactions: [] });
    render(<FactionDetailPanel />);
    expect(screen.getByText(/NO OPEN RECRUITMENT/)).toBeDefined();
  });

  it('recruit panel button calls setActiveProgram FACTION', async () => {
    const setActiveProgram = vi.fn();
    noFactionState({
      recruitingFactions: [{ factionId: 'f1', name: 'STAR CORP', color: null, slogan: 'We recruit', memberCount: 5 }],
      setActiveProgram,
    });
    render(<FactionDetailPanel />);
    await userEvent.click(screen.getByText(/\[STAR CORP →\]/));
    expect(setActiveProgram).toHaveBeenCalledWith('FACTION');
  });
});
