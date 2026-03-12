import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CargoScreen } from '../components/CargoScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendJettison: vi.fn(),
    requestMySlates: vi.fn(),
    sendActivateSlate: vi.fn(),
    sendNpcBuyback: vi.fn(),
    sendCreateSlate: vi.fn(),
    requestInventory: vi.fn(),
    sendInstallModule: vi.fn(),
    sendActivateBlueprint: vi.fn(),
    sendCraftModule: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('CargoScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      cargo: {
        ore: 3,
        gas: 0,
        crystal: 1,
        slates: 0,
        artefact: 0,
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
  });

  it('shows cargo labels', () => {
    render(<CargoScreen />);
    // Multiple elements match /ORE/ (cargo bar + jettison button), so use getAllByText
    expect(screen.getAllByText(/ORE/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GAS/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CRYSTAL/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows jettison buttons', () => {
    render(<CargoScreen />);
    expect(screen.getByText('[JETTISON ORE]')).toBeInTheDocument();
    expect(screen.getByText('[JETTISON GAS]')).toBeInTheDocument();
    expect(screen.getByText('[JETTISON CRYSTAL]')).toBeInTheDocument();
  });

  it('disables jettison when resource is 0', () => {
    render(<CargoScreen />);
    // Gas is 0
    const gasBtn = screen.getByText('[JETTISON GAS]').closest('button');
    expect(gasBtn).toBeDisabled();
  });

  it('enables jettison when resource > 0', () => {
    render(<CargoScreen />);
    const oreBtn = screen.getByText('[JETTISON ORE]').closest('button');
    expect(oreBtn).not.toBeDisabled();

    const crystalBtn = screen.getByText('[JETTISON CRYSTAL]').closest('button');
    expect(crystalBtn).not.toBeDisabled();
  });

  it('calls sendJettison on single click', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('[JETTISON ORE]'));
    expect(network.sendJettison).toHaveBeenCalledWith('ore');
  });

  it('shows CARGO HOLD header', () => {
    render(<CargoScreen />);
    expect(screen.getByText(/CARGO HOLD/)).toBeInTheDocument();
  });

  it('shows capacity info', () => {
    render(<CargoScreen />);
    // total = 3 + 0 + 1 = 4
    expect(screen.getByText(/CAPACITY/)).toBeInTheDocument();
  });

  it('shows slate count when player has slates', async () => {
    mockStoreState({
      cargo: {
        ore: 1,
        gas: 0,
        crystal: 0,
        slates: 2,
        artefact: 0,
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
      mySlates: [
        {
          id: 's1',
          creatorId: 'p1',
          ownerId: 'p1',
          slateType: 'sector',
          sectorData: [{ x: 0, y: 0, type: 'nebula', ore: 10, gas: 5, crystal: 0 }],
          status: 'available' as const,
          createdAt: 0,
        },
      ],
      ship: {
        id: 'ship1',
        ownerId: 'p1',
        hullType: 'scout' as const,
        name: 'Test Ship',
        modules: [],
        fuel: 100,
        active: true,
        stats: {
          fuelMax: 100,
          cargoCap: 20,
          jumpRange: 3,
          apCostJump: 1,
          fuelPerJump: 1,
          hp: 50,
          commRange: 50,
          scannerLevel: 1,
          damageMod: 0,
          shieldHp: 0,
          shieldRegen: 0,
          weaponAttack: 0,
          weaponType: 'none' as const,
          weaponPiercing: 0,
          pointDefense: 0,
          ecmReduction: 0,
          engineSpeed: 2,
          artefactChanceBonus: 0,
          safeSlotBonus: 0,
          hyperdriveRange: 0,
          hyperdriveSpeed: 0,
          hyperdriveRegen: 0,
          hyperdriveFuelEfficiency: 0,
          miningBonus: 0,
        },
      },
    });
    render(<CargoScreen />);
    // Slate content moved to SLATES tab — switch to it first
    await userEvent.click(screen.getByText('SLATES'));
    expect(screen.getByText(/MEMORY: 2/)).toBeDefined();
    expect(screen.getByText(/\[ACTIVATE\]/)).toBeDefined();
  });

  it('does not show create slate buttons (moved to SlateControls)', () => {
    mockStoreState({
      cargo: {
        ore: 0,
        gas: 0,
        crystal: 0,
        slates: 0,
        artefact: 0,
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
      mySlates: [],
      ship: {
        id: 'ship1',
        ownerId: 'p1',
        hullType: 'scout' as const,
        name: 'Test Ship',
        modules: [],
        fuel: 100,
        active: true,
        stats: {
          fuelMax: 100,
          cargoCap: 20,
          jumpRange: 3,
          apCostJump: 1,
          fuelPerJump: 1,
          hp: 50,
          commRange: 50,
          scannerLevel: 1,
          damageMod: 0,
          shieldHp: 0,
          shieldRegen: 0,
          weaponAttack: 0,
          weaponType: 'none' as const,
          weaponPiercing: 0,
          pointDefense: 0,
          ecmReduction: 0,
          engineSpeed: 2,
          artefactChanceBonus: 0,
          safeSlotBonus: 0,
          hyperdriveRange: 0,
          hyperdriveSpeed: 0,
          hyperdriveRegen: 0,
          hyperdriveFuelEfficiency: 0,
          miningBonus: 0,
        },
      },
    });
    render(<CargoScreen />);
    expect(screen.queryByText(/SECTOR-SLATE/)).toBeNull();
    expect(screen.queryByText(/AREA-SLATE/)).toBeNull();
  });
});
