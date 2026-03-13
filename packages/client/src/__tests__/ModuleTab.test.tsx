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
    const leer = screen.getAllByText(/] — leer/i);
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
    expect(screen.getByText('LEER')).toBeInTheDocument();
  });

  it('renders inventory item with select prompt', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    expect(screen.getByText('AUSWÄHLEN')).toBeInTheDocument();
  });

  it('selecting inventory module highlights compatible slots with [+] button', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    // Click module in inventory to select it
    fireEvent.click(screen.getByText('AUSWÄHLEN'));
    // Drive slot (index 1) should now show [+] and "kompatibel"
    expect(screen.getByText('[+]')).toBeInTheDocument();
    expect(screen.getByText(/kompatibel/)).toBeInTheDocument();
    // Inventory should now show "WÄHLE SLOT"
    expect(screen.getByText(/WÄHLE SLOT/)).toBeInTheDocument();
  });

  it('clicking [+] on a compatible slot calls sendInstallModule', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    // Select module
    fireEvent.click(screen.getByText('AUSWÄHLEN'));
    // Click install on compatible slot
    fireEvent.click(screen.getByText('[+]'));
    expect(network.sendInstallModule).toHaveBeenCalledWith('ship-1', 'drive_mk1', 1);
  });
});
