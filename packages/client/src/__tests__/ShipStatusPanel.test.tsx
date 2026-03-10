import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShipStatusPanel } from '../components/ShipStatusPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendRenameShip: vi.fn(),
  },
}));

import { network } from '../network/client';

const baseStats = {
  fuelMax: 200,
  cargoCap: 50,
  jumpRange: 5,
  apCostJump: 1,
  fuelPerJump: 1,
  hp: 100,
  commRange: 50,
  scannerLevel: 2,
  damageMod: 0,
  shieldHp: 0,
  shieldRegen: 0,
  weaponAttack: 0,
  weaponType: 'none' as const,
  weaponPiercing: 0,
  pointDefense: 0,
  ecmReduction: 0,
  engineSpeed: 3,
  artefactChanceBonus: 0,
  safeSlotBonus: 0,
  hyperdriveRange: 0,
  hyperdriveSpeed: 0,
  hyperdriveRegen: 0,
  hyperdriveFuelEfficiency: 0,
  miningBonus: 0,
};

const baseShip = {
  id: 'ship-1',
  ownerId: 'player-1',
  hullType: 'scout' as const,
  name: 'Astral Hawk',
  modules: [],
  stats: baseStats,
  fuel: 100,
  active: true,
};

describe('ShipStatusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ ship: baseShip });
  });

  it('renders NO SHIP DATA when ship is null', () => {
    mockStoreState({ ship: null });
    render(<ShipStatusPanel />);
    expect(screen.getByText('NO SHIP DATA')).toBeInTheDocument();
  });

  it('renders the ship name', () => {
    render(<ShipStatusPanel />);
    expect(screen.getByText('Astral Hawk')).toBeInTheDocument();
  });

  it('clicking the ship name enters rename mode (shows input)', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);

    const nameEl = screen.getByText('Astral Hawk');
    await user.click(nameEl);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('Astral Hawk');
  });

  it('pressing Enter commits the rename and calls sendRenameShip', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('Astral Hawk'));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Nova Falcon');
    await user.keyboard('{Enter}');

    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'Nova Falcon');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('pressing Escape cancels the rename without calling sendRenameShip', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('Astral Hawk'));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Something Else');
    await user.keyboard('{Escape}');

    expect(network.sendRenameShip).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('commits rename on blur', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);
    await user.click(screen.getByText('Astral Hawk'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'BLUR NAME');
    await user.tab(); // triggers blur
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'BLUR NAME');
  });

  it('Escape cancels without calling sendRenameShip', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);
    await user.click(screen.getByText('Astral Hawk'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'CHANGED');
    await user.keyboard('{Escape}');
    expect(network.sendRenameShip).not.toHaveBeenCalled();
  });

  it('does not call sendRenameShip when blur fires after Escape', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);
    await user.click(screen.getByText('Astral Hawk'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'CHANGED');
    // Press Escape to cancel
    await user.keyboard('{Escape}');
    // Then explicitly trigger blur (simulates browser firing blur after Escape)
    fireEvent.blur(document.activeElement || document.body);
    // sendRenameShip must NOT have been called
    expect(network.sendRenameShip).not.toHaveBeenCalled();
  });

  it('does not call sendRenameShip when name is unchanged', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('Astral Hawk'));
    await user.keyboard('{Enter}');

    expect(network.sendRenameShip).not.toHaveBeenCalled();
  });

  it('renders ACEP bars when ship.acepXp is present', () => {
    mockStoreState({
      ship: {
        ...baseShip,
        acepXp: { ausbau: 10, intel: 20, kampf: 5, explorer: 30, total: 65 },
      },
    });
    render(<ShipStatusPanel />);

    expect(screen.getByText('ACEP')).toBeInTheDocument();
    expect(screen.getByText('CONSTRUCTION')).toBeInTheDocument();
    expect(screen.getByText('INTEL')).toBeInTheDocument();
    expect(screen.getByText('COMBAT')).toBeInTheDocument();
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();
    expect(screen.getByText('BUDGET: 65/100')).toBeInTheDocument();
  });

  it('does not render ACEP section when ship.acepXp is absent', () => {
    render(<ShipStatusPanel />);
    expect(screen.queryByText('ACEP')).not.toBeInTheDocument();
  });

  it('shows CARGO tab content by default', () => {
    mockStoreState({
      ship: baseShip,
      cargo: {
        ore: 5,
        gas: 3,
        crystal: 1,
        slates: 0,
        artefact: 2,
        artefact_drive: 0,
        artefact_cargo: 0,
        artefact_scanner: 0,
        artefact_armor: 0,
        artefact_weapon: 0,
        artefact_shield: 0,
        artefact_defense: 0,
        artefact_special: 0,
        artefact_mining: 0,
      },
    });
    render(<ShipStatusPanel />);

    expect(screen.getByText('[CARGO]')).toBeInTheDocument();
    expect(screen.getByText('ORE')).toBeInTheDocument();
    expect(screen.getByText('GAS')).toBeInTheDocument();
    expect(screen.getByText('CRYSTAL')).toBeInTheDocument();
    expect(screen.getByText('CAPACITY')).toBeInTheDocument();
  });

  it('switching to MINING tab shows mining content', async () => {
    const user = userEvent.setup();
    mockStoreState({
      ship: baseShip,
      mining: {
        active: true,
        resource: 'ore' as const,
        sectorX: 1,
        sectorY: 2,
        startedAt: Date.now(),
        rate: 2,
        sectorYield: 100,
      },
    });
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('[MINING]'));

    expect(screen.getByText('RESOURCE')).toBeInTheDocument();
    expect(screen.getByText('ORE')).toBeInTheDocument();
    expect(screen.getByText('RATE')).toBeInTheDocument();
    expect(screen.getByText('2/tick')).toBeInTheDocument();
  });

  it('shows INAKTIV in MINING tab when mining is null', async () => {
    const user = userEvent.setup();
    mockStoreState({ ship: baseShip, mining: null });
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('[MINING]'));

    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });

  it('switching to STATS tab shows ship stats', async () => {
    const user = userEvent.setup();
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('[STATS]'));

    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText('SPEED')).toBeInTheDocument();
    expect(screen.getByText('SCANNER')).toBeInTheDocument();
    expect(screen.getByText('JUMP RANGE')).toBeInTheDocument();
    expect(screen.getByText('FUEL')).toBeInTheDocument();
  });

  it('shows hyperdrive charge bar when maxCharge > 0', () => {
    mockStoreState({
      ship: baseShip,
      hyperdriveState: { charge: 75, maxCharge: 100, regenPerSecond: 1, lastTick: Date.now() },
    });
    render(<ShipStatusPanel />);

    expect(screen.getByText('HYPERDRIVE')).toBeInTheDocument();
    expect(screen.getByText('CHARGE')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('does not show hyperdrive section when maxCharge is 0', () => {
    mockStoreState({
      ship: baseShip,
      hyperdriveState: { charge: 0, maxCharge: 0, regenPerSecond: 0, lastTick: Date.now() },
    });
    render(<ShipStatusPanel />);

    expect(screen.queryByText('HYPERDRIVE')).not.toBeInTheDocument();
  });

  it('does not show hyperdrive section when hyperdriveState is null', () => {
    mockStoreState({ ship: baseShip, hyperdriveState: null });
    render(<ShipStatusPanel />);

    expect(screen.queryByText('HYPERDRIVE')).not.toBeInTheDocument();
  });

  it('renders [MODULES] quick link', () => {
    render(<ShipStatusPanel />);

    expect(screen.getByText('[MODULES]')).toBeInTheDocument();
  });

  it('clicking [MODULES] calls setActiveProgram with MODULES', async () => {
    const user = userEvent.setup();
    const setActiveProgram = vi.fn();
    mockStoreState({ ship: baseShip, setActiveProgram });
    render(<ShipStatusPanel />);

    await user.click(screen.getByText('[MODULES]'));

    expect(setActiveProgram).toHaveBeenCalledWith('MODULES');
  });

});
