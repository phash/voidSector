import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendGetModuleInventory: vi.fn(),
    sendRemoveModule: vi.fn(),
    sendInstallModule: vi.fn(),
  },
}));

import { network } from '../network/client';
import { ModuleTab } from '../components/ModuleTab';

const mockShip = {
  id: 'ship-1',
  name: 'Test Ship',
  hullType: 'scout' as const,
  modules: [
    { slotIndex: 0, moduleId: 'generator_mk2', currentHp: 2, maxHp: 3, source: 'standard' as const },
  ],
  acepXp: { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 },
  acepEffects: { extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
  acepTraits: [],
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({
    ship: mockShip as any,
    moduleInventory: [],
    setAcepHoveredModuleId: vi.fn(),
  });
});

describe('ModuleTab', () => {
  it('calls sendGetModuleInventory on mount', () => {
    render(<ModuleTab />);
    expect(network.sendGetModuleInventory).toHaveBeenCalledTimes(1);
  });

  it('renders occupied slot with category label', () => {
    render(<ModuleTab />);
    expect(screen.getByText(/\[GEN\]/i)).toBeInTheDocument();
  });

  it('renders empty slots as leer', () => {
    render(<ModuleTab />);
    const leer = screen.getAllByText(/leer/i);
    expect(leer.length).toBeGreaterThan(0);
  });

  it('remove button calls sendRemoveModule with ship.id and slotIndex', () => {
    render(<ModuleTab />);
    const removeBtn = screen.getByText(/\[×\]/i);
    fireEvent.click(removeBtn);
    expect(network.sendRemoveModule).toHaveBeenCalledWith('ship-1', 0);
  });

  it('shows LEER when inventory is empty', () => {
    render(<ModuleTab />);
    expect(screen.getByText(/LEER/i)).toBeInTheDocument();
  });

  it('renders inventory item with install button', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    expect(screen.getByText(/INST/i)).toBeInTheDocument();
  });

  it('INST button calls sendInstallModule', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    fireEvent.click(screen.getByText(/INST/i));
    expect(network.sendInstallModule).toHaveBeenCalled();
  });
});
