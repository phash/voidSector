import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShipBlock, CargoBlock } from '../components/ShipBlock';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { sendRenameShip: vi.fn() },
}));
import { network } from '../network/client';

const baseStats = {
  fuelMax: 200, cargoCap: 50, jumpRange: 5, apCostJump: 1, fuelPerJump: 1,
  hp: 100, commRange: 50, scannerLevel: 2, damageMod: 0,
  shieldHp: 0, shieldRegen: 0, weaponAttack: 0, weaponType: 'none' as const,
  weaponPiercing: 0, pointDefense: 0, ecmReduction: 0, engineSpeed: 3,
  artefactChanceBonus: 0, safeSlotBonus: 0,
  hyperdriveRange: 0, hyperdriveSpeed: 0, hyperdriveRegen: 0,
  hyperdriveFuelEfficiency: 0, miningBonus: 0,
};

const baseShip = {
  id: 'ship-1', ownerId: 'player-1',
  name: 'Astral Hawk', modules: [], stats: baseStats, fuel: 100, active: true,
};

const baseCargo = {
  ore: 3, gas: 1, crystal: 0, slates: 0, artefact: 0,
  artefact_drive: 0, artefact_cargo: 0, artefact_scanner: 0,
  artefact_armor: 0, artefact_weapon: 0, artefact_shield: 0,
  artefact_defense: 0, artefact_special: 0, artefact_mining: 0,
};

describe('ShipBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ ship: baseShip });
  });

  it('renders ── SHIP ── header', () => {
    render(<ShipBlock />);
    expect(screen.getByText(/── SHIP ──/)).toBeInTheDocument();
  });

  it('renders NO DATA when ship is null', () => {
    mockStoreState({ ship: null });
    render(<ShipBlock />);
    expect(screen.getByText('NO DATA')).toBeInTheDocument();
  });

  it('renders ship name', () => {
    render(<ShipBlock />);
    expect(screen.getByText('Astral Hawk')).toBeInTheDocument();
  });

  it('shows HP bar based on module HP when modules present', () => {
    mockStoreState({
      ship: {
        ...baseShip,
        modules: [
          // generator_mk1 has maxHp: 20 in MODULES; currentHp: 15 → HP: 15/20
          { moduleId: 'generator_mk1', slotIndex: 0, currentHp: 15, source: 'standard' as const },
        ],
      },
    });
    render(<ShipBlock />);
    expect(screen.getByText(/HP: 15\/20/)).toBeInTheDocument();
  });

  it('shows full HP when no modules', () => {
    render(<ShipBlock />);
    // stats.hp = 100, no modules → 100/100
    expect(screen.getByText(/HP: 100\/100/)).toBeInTheDocument();
  });

  it('shows INTAKT label for full HP', () => {
    render(<ShipBlock />);
    expect(screen.getByText(/INTAKT/)).toBeInTheDocument();
  });

  it('clicking ship name enters rename mode', async () => {
    const user = userEvent.setup();
    render(<ShipBlock />);
    await user.click(screen.getByText('Astral Hawk'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('commit rename calls sendRenameShip', async () => {
    const user = userEvent.setup();
    render(<ShipBlock />);
    await user.click(screen.getByText('Astral Hawk'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Nova Wing');
    await user.keyboard('{Enter}');
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'Nova Wing');
  });
});

describe('CargoBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ ship: baseShip, cargo: baseCargo });
  });

  it('renders ── CARGO ── header', () => {
    render(<CargoBlock />);
    expect(screen.getByText(/── CARGO ──/)).toBeInTheDocument();
  });

  it('returns null when ship is null', () => {
    mockStoreState({ ship: null, cargo: baseCargo });
    const { container } = render(<CargoBlock />);
    expect(container.firstChild).toBeNull();
  });

  it('shows ore/gas/crystal counts', () => {
    render(<CargoBlock />);
    expect(screen.getByText('3')).toBeInTheDocument(); // ore
    expect(screen.getByText('1')).toBeInTheDocument(); // gas
  });

  it('shows used/capacity', () => {
    render(<CargoBlock />);
    // ore=3, gas=1 → used=4, cap=50
    expect(screen.getByText('[4/50]')).toBeInTheDocument();
  });

  it('shows [CARGO ▶] button', () => {
    render(<CargoBlock />);
    expect(screen.getByText('[CARGO ▶]')).toBeInTheDocument();
  });

  it('[CARGO ▶] sets activeProgram to CARGO', async () => {
    const user = userEvent.setup();
    const setActiveProgram = vi.fn();
    mockStoreState({ ship: baseShip, cargo: baseCargo, setActiveProgram });
    render(<CargoBlock />);
    await user.click(screen.getByText('[CARGO ▶]'));
    expect(setActiveProgram).toHaveBeenCalledWith('CARGO');
  });

  it('sums typed artefacts into ART count', () => {
    mockStoreState({
      ship: baseShip,
      cargo: { ...baseCargo, artefact: 1, artefact_drive: 2, artefact_weapon: 1 },
    });
    render(<CargoBlock />);
    // ART total = 1+2+1 = 4
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
