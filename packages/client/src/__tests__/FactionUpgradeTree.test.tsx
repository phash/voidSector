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
    sendFactionUpgrade: vi.fn(),
  },
}));

const baseFaction = {
  id: 'f1',
  name: 'Test Faction',
  tag: 'TST',
  leaderId: 'p1',
  joinMode: 'invite' as const,
  memberCount: 2,
  createdAt: Date.now(),
};

const baseMembers = [
  { playerId: 'p1', playerName: 'TestPlayer', rank: 'leader' as const, joinedAt: Date.now() },
  { playerId: 'p2', playerName: 'Member1', rank: 'member' as const, joinedAt: Date.now() },
];

function upgradesState(overrides: Record<string, any> = {}) {
  mockStoreState({
    faction: baseFaction,
    factionMembers: baseMembers,
    factionUpgrades: [],
    playerId: 'p1',
    monitorModes: { FACTION: 'upgrades' },
    setMonitorMode: vi.fn(),
    ...overrides,
  } as any);
}

describe('FactionUpgradeTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows UPGRADE TREE section header', () => {
    upgradesState();
    render(<FactionScreen />);
    expect(screen.getByText('UPGRADE TREE')).toBeDefined();
  });

  it('shows tier labels with cost', () => {
    upgradesState();
    render(<FactionScreen />);
    expect(screen.getByText(/TIER 1 — 500 CR/)).toBeDefined();
    expect(screen.getByText(/TIER 2 — 1500 CR/)).toBeDefined();
    expect(screen.getByText(/TIER 3 — 5000 CR/)).toBeDefined();
  });

  it('renders option A and B buttons for each tier', () => {
    upgradesState();
    render(<FactionScreen />);
    expect(screen.getByText('MINING BOOST')).toBeDefined();
    expect(screen.getByText('CARGO EXPANSION')).toBeDefined();
    expect(screen.getByText('SCAN RANGE')).toBeDefined();
    expect(screen.getByText('AP REGEN')).toBeDefined();
    expect(screen.getByText('COMBAT BONUS')).toBeDefined();
    expect(screen.getByText('TRADE DISCOUNT')).toBeDefined();
  });

  it('shows effect descriptions', () => {
    upgradesState();
    render(<FactionScreen />);
    expect(screen.getByText('+15% mining rate')).toBeDefined();
    expect(screen.getByText('+3 cargo capacity')).toBeDefined();
    expect(screen.getByText('+1 area scan radius')).toBeDefined();
    expect(screen.getByText('+20% AP regeneration')).toBeDefined();
    expect(screen.getByText('+15% combat bonus')).toBeDefined();
    expect(screen.getByText('-10% NPC trade prices')).toBeDefined();
  });

  it('highlights chosen upgrade', () => {
    upgradesState({
      factionUpgrades: [{ tier: 1, choice: 'A', chosenAt: new Date().toISOString() }],
    });
    render(<FactionScreen />);
    // MINING BOOST button should exist and be disabled (already chosen)
    const miningButton = screen.getByText('MINING BOOST').closest('button');
    expect(miningButton).toBeDefined();
    expect(miningButton!.disabled).toBe(true);
  });
});
