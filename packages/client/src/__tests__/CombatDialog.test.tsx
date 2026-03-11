import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatDialog } from '../components/CombatDialog';
import { mockStoreState } from '../test/mockStore';
import type { ClientCombatState } from '../state/gameSlice';

vi.mock('../network/client', () => ({
  network: {
    sendCombatRound: vi.fn(),
  },
}));

import { network } from '../network/client';

const weaponModule = {
  moduleId: 'weapon_01',
  category: 'weapon',
  tier: 2,
  currentHp: 35,
  maxHp: 35,
  powerLevel: 'high' as const,
};

const generatorModule = {
  moduleId: 'gen_01',
  category: 'generator',
  tier: 2,
  currentHp: 35,
  maxHp: 35,
  powerLevel: 'high' as const,
};

const driveModule = {
  moduleId: 'drive_01',
  category: 'drive',
  tier: 1,
  currentHp: 20,
  maxHp: 20,
  powerLevel: 'off' as const,
};

const baseCombatState: ClientCombatState = {
  playerHp: 80,
  playerMaxHp: 100,
  playerModules: [generatorModule, weaponModule, driveModule],
  epBuffer: 2,
  maxEpBuffer: 8,
  enemyType: 'pirate',
  enemyLevel: 3,
  enemyHp: 120,
  enemyMaxHp: 150,
  enemyModules: [
    { category: 'weapon', tier: 2, currentHp: 35, maxHp: 35, powerLevel: 'high', revealed: true },
    { category: 'drive', tier: 2, currentHp: 35, maxHp: 35, powerLevel: 'high', revealed: false },
  ],
  round: 2,
  ancientChargeRounds: 0,
  ancientAbilityUsed: false,
  log: ['RUNDE 1: Angriff ausgeführt.', 'Feind erleidet 12 Schaden.'],
};

describe('CombatDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no active combat', () => {
    mockStoreState({ activeCombat: null });
    const { container } = render(<CombatDialog />);
    expect(container.innerHTML).toBe('');
  });

  it('renders combat dialog with round info', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByText(/KAMPF.*RUNDE 2\/10/)).toBeDefined();
    expect(screen.getByText(/PIRATE LV\.3/i)).toBeDefined();
  });

  it('shows player and enemy HP bars', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    // HP bar uses format "80/100" and "120/150"
    expect(screen.getByText(/80\/100/)).toBeDefined();
    expect(screen.getByText(/120\/150/)).toBeDefined();
  });

  it('shows energy distribution panel with modules', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByText(/ENERGIE-VERTEILUNG/i)).toBeDefined();
    // Module rows appear in energy distribution (text-transform: uppercase)
    expect(screen.getAllByText(/WEAPON T2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DRIVE T1/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/GENERATOR T2/i)).toBeDefined();
  });

  it('shows power level buttons for each module', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    // weapon_01 should have OFF/LOW/MID/HIGH buttons
    expect(screen.getByTestId('mod-weapon_01-off')).toBeDefined();
    expect(screen.getByTestId('mod-weapon_01-low')).toBeDefined();
    expect(screen.getByTestId('mod-weapon_01-mid')).toBeDefined();
    expect(screen.getByTestId('mod-weapon_01-high')).toBeDefined();
  });

  it('ep cost calculation is correct for weapon module', () => {
    // weapon: off=0, low=2, mid=4, high=6
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    // Check EP cost labels in weapon row - high=6EP
    const highBtn = screen.getByTestId('mod-weapon_01-high');
    expect(highBtn.textContent).toContain('6EP');
    const offBtn = screen.getByTestId('mod-weapon_01-off');
    expect(offBtn.textContent).toContain('0EP');
  });

  it('submit is disabled when over EP budget', () => {
    // Create state where weapons are at HIGH (6EP) and drive at HIGH (6EP) = 12EP
    // But generator T2 at HIGH = 8EP base + 2EP buffer = 10EP → over budget
    const overBudgetState: ClientCombatState = {
      ...baseCombatState,
      playerModules: [
        { ...generatorModule, tier: 1, maxHp: 20, currentHp: 20 }, // T1 gen = 4EP output
        { ...weaponModule, powerLevel: 'high' as const }, // high = 6EP
        { ...driveModule, powerLevel: 'high' as const },  // high = 6EP
      ],
      epBuffer: 0,
    };
    mockStoreState({ activeCombat: overBudgetState });
    render(<CombatDialog />);

    // Set weapon to HIGH and drive to HIGH to exceed the T1 gen (4EP)
    fireEvent.click(screen.getByTestId('mod-weapon_01-high'));
    fireEvent.click(screen.getByTestId('mod-drive_01-high'));

    const submitBtn = screen.getByTestId('submit-round-btn');
    expect(submitBtn).toBeDefined();
    // When over budget the button is disabled
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows primary action buttons', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByTestId('action-attack')).toBeDefined();
    expect(screen.getByTestId('action-flee')).toBeDefined();
    expect(screen.getByTestId('action-wait')).toBeDefined();
    expect(screen.getByTestId('action-scan')).toBeDefined();
    expect(screen.getByTestId('action-aim')).toBeDefined();
  });

  it('shows reaction buttons', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByTestId('reaction-none')).toBeDefined();
    expect(screen.getByTestId('reaction-shield_boost')).toBeDefined();
    expect(screen.getByTestId('reaction-ecm_pulse')).toBeDefined();
  });

  it('shows combat log', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByText(/RUNDE 1: Angriff ausgeführt\./)).toBeDefined();
    expect(screen.getByText(/Feind erleidet 12 Schaden\./)).toBeDefined();
  });

  it('shows revealed enemy modules', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByText(/WEAPON T2.*35\/35 HP/i)).toBeDefined();
  });

  it('shows unknown for unrevealed enemy modules', () => {
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);
    expect(screen.getByText(/UNBEKANNT.*Scan für Details/)).toBeDefined();
  });

  it('shows victory overlay when outcome is victory', () => {
    const victoryState: ClientCombatState = {
      ...baseCombatState,
      outcome: 'victory',
      loot: { credits: 150, ore: 5 },
    };
    mockStoreState({ activeCombat: victoryState });
    render(<CombatDialog />);
    expect(screen.getByText('SIEG')).toBeDefined();
    expect(screen.getByText(/\+150 CR/)).toBeDefined();
    expect(screen.getByText(/\+5 ORE/)).toBeDefined();
  });

  it('shows defeat overlay when outcome is defeat', () => {
    const defeatState: ClientCombatState = {
      ...baseCombatState,
      outcome: 'defeat',
    };
    mockStoreState({ activeCombat: defeatState });
    render(<CombatDialog />);
    expect(screen.getByText('NIEDERLAGE')).toBeDefined();
  });

  it('shows fled overlay when outcome is fled', () => {
    const fledState: ClientCombatState = {
      ...baseCombatState,
      outcome: 'fled',
    };
    mockStoreState({ activeCombat: fledState });
    render(<CombatDialog />);
    expect(screen.getByText('FLUCHT ERFOLGREICH')).toBeDefined();
  });

  it('close button calls setActiveCombat(null)', () => {
    const victoryState: ClientCombatState = {
      ...baseCombatState,
      outcome: 'victory',
      loot: { credits: 100 },
    };
    const setActiveCombat = vi.fn();
    mockStoreState({ activeCombat: victoryState, setActiveCombat } as any);
    render(<CombatDialog />);
    fireEvent.click(screen.getByTestId('combat-close-btn'));
    expect(setActiveCombat).toHaveBeenCalledWith(null);
  });

  it('shows ancient ability when charged', () => {
    const ancientState: ClientCombatState = {
      ...baseCombatState,
      playerModules: [
        ...baseCombatState.playerModules,
        { moduleId: 'ancient_core_01', category: 'ancient_core', tier: 1, currentHp: 20, maxHp: 20, powerLevel: 'off' as const },
      ],
      ancientChargeRounds: 3,
      ancientAbilityUsed: false,
    };
    mockStoreState({ activeCombat: ancientState });
    render(<CombatDialog />);
    expect(screen.getByTestId('ancient-ability-btn')).toBeDefined();
    expect(screen.getByText(/ENERGIE-PULS/i)).toBeDefined();
  });

  it('does not show ancient ability when not charged', () => {
    mockStoreState({ activeCombat: baseCombatState });
    const { container } = render(<CombatDialog />);
    expect(container.querySelector('[data-testid="ancient-ability-btn"]')).toBeNull();
  });

  it('sends combatRound message on submit', () => {
    // Set weapon to HIGH (needs a powered weapon for attack)
    mockStoreState({ activeCombat: baseCombatState });
    render(<CombatDialog />);

    // Click attack (should be default)
    fireEvent.click(screen.getByTestId('action-attack'));
    fireEvent.click(screen.getByTestId('submit-round-btn'));

    expect(network.sendCombatRound).toHaveBeenCalled();
  });
});
