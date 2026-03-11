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
    expect(screen.getByText('[FOUND]')).toBeDefined();
    expect(screen.getByText('[JOIN]')).toBeDefined();
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
    expect(screen.getByText('[YES]')).toBeDefined();
    expect(screen.getByText('[NO]')).toBeDefined();
  });
});

describe('FactionScreen — in faction', () => {
  beforeEach(() => { vi.clearAllMocks(); factionState('info'); });

  it('shows faction name in header on info tab', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/\[TST\] Test Faction/)).toBeDefined();
  });

  it('shows join mode and member count in info tab', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/INVITE/)).toBeDefined();
    expect(screen.getByText(/3 Members/)).toBeDefined();
  });

  it('shows only INFO/MEMBERS/UPGRADES tabs for non-leader', () => {
    factionState('info', { playerId: 'p2' }); // p2 is member, not leader
    render(<FactionScreen />);
    expect(screen.getByText('[INFO]')).toBeDefined();
    expect(screen.getByText('[MEMBERS]')).toBeDefined();
    expect(screen.getByText('[UPGRADES]')).toBeDefined();
    expect(screen.queryByText('[MGMT]')).toBeNull();
  });

  it('shows MGMT tab for leader', () => {
    render(<FactionScreen />); // default is p1 as leader
    expect(screen.getByText('[MGMT]')).toBeDefined();
  });

  it('shows [LEAVE] button in members tab for non-leader', () => {
    factionState('members', { playerId: 'p2' });
    render(<FactionScreen />);
    expect(screen.getByText('[LEAVE]')).toBeDefined();
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
    expect(screen.getByText(/UPGRADE TREE/)).toBeDefined();
  });

  it('shows management controls for leader on management tab', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/\[INVITE\]/)).toBeDefined();
    expect(screen.getByText(/\[MODE\]/)).toBeDefined();
    expect(screen.getByText(/\[DISBAND\]/)).toBeDefined();
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
    expect(screen.getByText(/ACTIVE RECRUITING/)).toBeDefined();
  });

  it('management tab shows current recruiting state from server', () => {
    factionState('management', {
      faction: { ...baseFaction, isRecruiting: true, slogan: 'We mine together' },
    });
    render(<FactionScreen />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(screen.getByDisplayValue('We mine together')).toBeDefined();
  });
});
