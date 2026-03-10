import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactionScreen } from '../components/FactionScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestFaction: vi.fn(),
    sendCreateFaction: vi.fn(),
    sendFactionAction: vi.fn(),
    sendRespondInvite: vi.fn(),
    sendSetRecruiting: vi.fn(),
  },
}));

const baseFaction = {
  id: 'f1', name: 'Test Faction', tag: 'TST',
  leaderId: 'p1', joinMode: 'invite' as const, memberCount: 3, createdAt: Date.now(),
};
const leaderMembers = [
  { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader' as const, joinedAt: Date.now() },
  { playerId: 'p2', playerName: 'Member1', rank: 'member' as const, joinedAt: Date.now() },
];

function factionState(tab: string, overrides: Record<string, any> = {}) {
  mockStoreState({
    faction: baseFaction,
    factionMembers: leaderMembers,
    factionUpgrades: [],
    factionInvites: [],
    playerId: 'p1',
    monitorModes: { FACTION: tab },
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

describe('FactionScreen — no faction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      faction: null, factionMembers: [], factionInvites: [], factionUpgrades: [],
      playerId: 'p1', monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
  });

  it('shows create/join when not in faction', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/NOT IN A FACTION/)).toBeDefined();
    expect(screen.getByText('[GRÜNDEN]')).toBeDefined();
    expect(screen.getByText('[BEITRETEN]')).toBeDefined();
  });

  it('shows pending invites', () => {
    mockStoreState({
      faction: null, factionMembers: [], factionUpgrades: [],
      factionInvites: [{
        id: 'inv1', factionId: 'f1', factionName: 'Cool Faction', factionTag: 'COOL',
        inviterName: 'Leader1', status: 'pending' as const, createdAt: Date.now(),
      }],
      playerId: 'p1', monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<FactionScreen />);
    expect(screen.getByText(/COOL/)).toBeDefined();
    expect(screen.getByText(/Cool Faction/)).toBeDefined();
    expect(screen.getByText(/JA/)).toBeDefined();
    expect(screen.getByText(/NEIN/)).toBeDefined();
  });
});

describe('FactionScreen — in faction', () => {
  beforeEach(() => { vi.clearAllMocks(); factionState('info'); });

  it('shows faction name in header on info tab', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/\[TST\] Test Faction/)).toBeDefined();
  });

  it('shows tab buttons', () => {
    render(<FactionScreen />);
    expect(screen.getByText('[INFO]')).toBeDefined();
    expect(screen.getByText('[MEMBERS]')).toBeDefined();
    expect(screen.getByText('[UPGRADES]')).toBeDefined();
    expect(screen.getByText('[MGMT]')).toBeDefined();
  });

  it('tab buttons call setMonitorMode', async () => {
    const setMonitorMode = vi.fn();
    factionState('info', { setMonitorMode });
    render(<FactionScreen />);
    await userEvent.click(screen.getByText('[MEMBERS]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'members');
  });

  it('shows member list on members tab', () => {
    factionState('members');
    render(<FactionScreen />);
    expect(screen.getByText(/TestPlayer/)).toBeDefined();
    expect(screen.getByText(/Member1/)).toBeDefined();
  });

  it('shows upgrade tree on upgrades tab', () => {
    factionState('upgrades');
    render(<FactionScreen />);
    expect(screen.getByText(/VERBESSERUNGSBAUM/)).toBeDefined();
  });

  it('shows management controls for leader on management tab', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/EINLADEN/)).toBeDefined();
    expect(screen.getByText(/MODUS/)).toBeDefined();
    expect(screen.getByText(/AUFLÖSEN/)).toBeDefined();
  });

  it('shows invite code in management tab for code mode', () => {
    factionState('management', {
      faction: { ...baseFaction, joinMode: 'code' as const, inviteCode: 'ABC123' },
    });
    render(<FactionScreen />);
    expect(screen.getByText(/ABC123/)).toBeDefined();
  });

  it('shows recruiting toggle in management tab for leader', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/AKTIV REKRUTIEREN/)).toBeDefined();
  });

  it('[VERLASSEN] visible for non-leader on management tab', () => {
    factionState('management', { playerId: 'p2' });
    render(<FactionScreen />);
    expect(screen.getByText(/VERLASSEN/)).toBeDefined();
  });
});
