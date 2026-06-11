import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OriginHubScreen } from '../components/OriginHubScreen';
import { useStore } from '../state/store';
import { network } from '../network/client';

vi.mock('../network/client', () => ({
  network: {
    requestOriginNotices: vi.fn(),
    requestBounties: vi.fn(),
    requestStarterBounties: vi.fn(),
    claimStarterBounty: vi.fn(),
    requestActiveCommunityQuest: vi.fn(),
    requestExchange: vi.fn(),
  },
}));

function setup(over: Record<string, unknown> = {}) {
  useStore.setState({
    position: { x: 0, y: 0 },
    cargo: { ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 },
    starterBountyClaims: [],
    bounties: [],
    credits: 100,
    ...over,
  } as any);
  render(<OriginHubScreen />);
  fireEvent.click(screen.getByText('BOUNTY'));
}

describe('OriginHub — STARTHILFE-Aufträge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all starter bounties with rewards', () => {
    setup();
    expect(screen.getByTestId('starter-bounty-item-starter_ore')).toBeTruthy();
    expect(screen.getByTestId('starter-bounty-item-starter_gas')).toBeTruthy();
    expect(screen.getByTestId('starter-bounty-item-starter_crystal')).toBeTruthy();
    expect(screen.getByText('+60 CR · +3 Wissen')).toBeTruthy();
  });

  it('enables ABGEBEN at origin with enough cargo and sends claim', () => {
    setup();
    const btn = screen.getByTestId('starter-bounty-claim-starter_ore') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(network.claimStarterBounty).toHaveBeenCalledWith('starter_ore');
  });

  it('disables ABGEBEN away from origin', () => {
    setup({ position: { x: 3, y: 1 } });
    const btn = screen.getByTestId('starter-bounty-claim-starter_ore') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables ABGEBEN with insufficient cargo', () => {
    setup({ cargo: { ore: 4, gas: 0, crystal: 0, slates: 0, artefact: 0 } });
    const btn = screen.getByTestId('starter-bounty-claim-starter_ore') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('marks claimed bounty as ERLEDIGT without claim button', () => {
    setup({ starterBountyClaims: ['starter_ore'] });
    expect(screen.getByText('✓ ERLEDIGT')).toBeTruthy();
    expect(screen.queryByTestId('starter-bounty-claim-starter_ore')).toBeNull();
  });

  it('requests starter bounties when BOUNTY tab opens', () => {
    setup();
    expect(network.requestStarterBounties).toHaveBeenCalled();
  });
});
