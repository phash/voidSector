import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactionScreen } from '../components/FactionScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestFaction: vi.fn(),
    sendCreateFaction: vi.fn(),
    sendFactionAction: vi.fn(),
    sendRespondInvite: vi.fn(),
  },
}));

describe('FactionScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      faction: null,
      factionMembers: [],
      factionInvites: [],
      playerId: 'p1',
    } as any);
  });

  it('shows create/join when not in faction', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/Keine Fraktion/)).toBeDefined();
    expect(screen.getByText('[GRÜNDEN]')).toBeDefined();
    expect(screen.getByText('[BEITRETEN]')).toBeDefined();
  });

  it('shows faction info when in faction', () => {
    mockStoreState({
      faction: {
        id: 'f1',
        name: 'Test Faction',
        tag: 'TST',
        leaderId: 'p1',
        joinMode: 'invite' as const,
        memberCount: 3,
        createdAt: Date.now(),
      },
      factionMembers: [
        { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader' as const, joinedAt: Date.now() },
        { playerId: 'p2', playerName: 'Member1', rank: 'member' as const, joinedAt: Date.now() },
      ],
      playerId: 'p1',
    } as any);
    render(<FactionScreen />);
    expect(screen.getByText(/\[TST\] Test Faction/)).toBeDefined();
    expect(screen.getByText(/TestPlayer/)).toBeDefined();
    expect(screen.getByText(/Member1/)).toBeDefined();
  });

  it('shows pending invites', () => {
    mockStoreState({
      factionInvites: [
        {
          id: 'inv1',
          factionId: 'f1',
          factionName: 'Cool Faction',
          factionTag: 'COOL',
          inviterName: 'Leader1',
          status: 'pending' as const,
          createdAt: Date.now(),
        },
      ],
      playerId: 'p1',
    } as any);
    render(<FactionScreen />);
    expect(screen.getByText(/COOL/)).toBeDefined();
    expect(screen.getByText(/Cool Faction/)).toBeDefined();
    expect(screen.getByText(/JA/)).toBeDefined();
    expect(screen.getByText(/NEIN/)).toBeDefined();
  });

  it('shows management buttons for leader', () => {
    mockStoreState({
      faction: {
        id: 'f1',
        name: 'Test Faction',
        tag: 'TST',
        leaderId: 'p1',
        joinMode: 'code' as const,
        inviteCode: 'ABC123',
        memberCount: 2,
        createdAt: Date.now(),
      },
      factionMembers: [
        { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader' as const, joinedAt: Date.now() },
        { playerId: 'p2', playerName: 'Member1', rank: 'member' as const, joinedAt: Date.now() },
      ],
      playerId: 'p1',
    } as any);
    render(<FactionScreen />);
    expect(screen.getByText(/EINLADEN/)).toBeDefined();
    expect(screen.getByText(/MODUS/)).toBeDefined();
    expect(screen.getByText(/AUFLÖSEN/)).toBeDefined();
    expect(screen.getByText(/ABC123/)).toBeDefined();
  });
});
