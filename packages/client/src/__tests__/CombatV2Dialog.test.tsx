import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatV2Dialog } from '../components/CombatV2Dialog';
import { mockStoreState } from '../test/mockStore';
import type { CombatV2State } from '@void-sector/shared';

vi.mock('../network/client', () => ({
  network: {
    sendCombatV2Action: vi.fn(),
    sendCombatV2Flee: vi.fn(),
  },
}));

import { network } from '../network/client';

const baseCombatState: CombatV2State = {
  encounter: {
    pirateLevel: 3, pirateHp: 50, pirateDamage: 14,
    sectorX: 10, sectorY: 20, canNegotiate: false, negotiateCost: 30,
  },
  currentRound: 0,
  maxRounds: 5,
  playerHp: 100,
  playerMaxHp: 100,
  playerShield: 60,
  playerMaxShield: 60,
  playerShieldRegen: 6,
  enemyHp: 50,
  enemyMaxHp: 50,
  enemyShield: 0,
  enemyMaxShield: 0,
  rounds: [],
  specialActionsUsed: { aim: false, evade: false },
  empDisableRounds: 0,
  status: 'active',
};

describe('CombatV2Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no active combat', () => {
    mockStoreState({ activeCombatV2: null });
    const { container } = render(<CombatV2Dialog />);
    expect(container.innerHTML).toBe('');
  });

  it('shows combat dialog with round info', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/KAMPF-SYSTEM/)).toBeDefined();
    expect(screen.getByText(/RUNDE/)).toBeDefined();
  });

  it('shows tactic buttons', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/ANGRIFF/)).toBeDefined();
    expect(screen.getByText(/AUSGEWOGEN/)).toBeDefined();
    expect(screen.getByText(/DEFENSIV/)).toBeDefined();
  });

  it('sends assault tactic on click', async () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    await userEvent.click(screen.getByText(/ANGRIFF/));
    expect(network.sendCombatV2Action).toHaveBeenCalledWith('assault', 'none', 10, 20);
  });

  it('shows special action buttons', () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/ZIELEN/)).toBeDefined();
    expect(screen.getByText(/AUSWEICHEN/)).toBeDefined();
  });

  it('sends flee on escape key', async () => {
    mockStoreState({ activeCombatV2: baseCombatState });
    render(<CombatV2Dialog />);
    await userEvent.keyboard('{Escape}');
    expect(network.sendCombatV2Flee).toHaveBeenCalledWith(10, 20);
  });

  it('shows combat log entries', () => {
    const stateWithRound = {
      ...baseCombatState,
      currentRound: 1,
      rounds: [{
        round: 1, tactic: 'balanced' as const, specialAction: 'none' as const,
        playerAttack: 18, enemyAttack: 12,
        playerShieldDmg: 12, playerHullDmg: 0,
        enemyShieldDmg: 0, enemyHullDmg: 18,
        playerShieldAfter: 48, playerHpAfter: 100,
        enemyShieldAfter: 0, enemyHpAfter: 32,
        specialEffects: [],
      }],
    };
    mockStoreState({ activeCombatV2: stateWithRound });
    render(<CombatV2Dialog />);
    expect(screen.getByText(/RUNDE 1:/)).toBeDefined();
  });
});
