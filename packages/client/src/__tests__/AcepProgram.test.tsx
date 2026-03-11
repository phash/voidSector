import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({
  network: {
    sendUninstallModule: vi.fn(),
    sendGetShips: vi.fn(),
  },
}));

import { network } from '../network/client';
import { AcepProgram } from '../components/AcepProgram';

const mockShip = {
  id: 'ship-1',
  name: 'Test Ship',
  hullType: 'scout' as const,
  modules: [
    { slotIndex: 0, moduleId: 'generator_mk2', currentHp: 2, maxHp: 3, source: 'standard' as const },
  ],
  acepXp: { ausbau: 18, intel: 8, kampf: 4, explorer: 0, total: 30 },
  acepEffects: {
    extraModuleSlots: 1,
    cargoMultiplier: 1,
    miningBonus: 0,
    scanRadiusBonus: 0,
    combatDamageBonus: 0,
    ancientDetection: false,
    helionDecoderEnabled: false,
  },
  acepTraits: ['VETERAN'],
  slots: 8,
  cargoCap: 50,
  hp: 100,
  maxHp: 100,
  speed: 1,
  shield: 0,
  maxShield: 0,
  armor: 0,
  damage: 10,
  scanRadius: 3,
  miningPower: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({ ship: mockShip as any });
});

describe('AcepProgram', () => {
  it('renders the header', () => {
    render(<AcepProgram />);
    expect(screen.getByText(/ACEP/i)).toBeInTheDocument();
  });

  it('shows occupied slot with category code', () => {
    render(<AcepProgram />);
    // [GEN] is the category code for slot 0 (generator)
    expect(screen.getByText(/\[GEN\]/i)).toBeInTheDocument();
  });

  it('shows empty slot with dash', () => {
    render(<AcepProgram />);
    // Slots 1-7 are empty — should show at least one "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('clicking empty slot calls setActiveProgram(MODULES)', () => {
    const mockSetActiveProgram = vi.fn();
    mockStoreState({ ship: mockShip as any, setActiveProgram: mockSetActiveProgram });
    render(<AcepProgram />);
    // Click DRV slot (slot 1, empty)
    const drvSlot = screen.getByTestId('acep-slot-1');
    fireEvent.click(drvSlot);
    expect(mockSetActiveProgram).toHaveBeenCalledWith('MODULES');
  });

  it('clicking occupied slot shows UNINSTALL button', () => {
    render(<AcepProgram />);
    const genSlot = screen.getByTestId('acep-slot-0');
    fireEvent.click(genSlot);
    expect(screen.getByText(/UNINSTALL/i)).toBeInTheDocument();
  });

  it('UNINSTALL button calls sendUninstallModule', () => {
    render(<AcepProgram />);
    fireEvent.click(screen.getByTestId('acep-slot-0'));
    fireEvent.click(screen.getByText(/UNINSTALL/i));
    expect(network.sendUninstallModule).toHaveBeenCalledWith(0);
  });

  it('renders AUSBAU XP bar', () => {
    render(<AcepProgram />);
    expect(screen.getByText(/AUSBAU/i)).toBeInTheDocument();
  });

  it('shows extra slot when extraModuleSlots > 0', () => {
    render(<AcepProgram />);
    // ausbau: 18 = level 3, getExtraSlotCount(18) should return >= 1
    expect(screen.getByTestId('acep-slot-8')).toBeInTheDocument();
  });
});
