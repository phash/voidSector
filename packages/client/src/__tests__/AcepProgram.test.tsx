import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendAcepBoost: vi.fn(),
    sendRenameShip: vi.fn(),
    sendGetModuleInventory: vi.fn(),
    sendRemoveModule: vi.fn(),
    sendInstallModule: vi.fn(),
    sendBuyModule: vi.fn(),
  },
}));

import { AcepProgram } from '../components/AcepProgram';

const mockShip = {
  id: 'ship-1', name: 'Test Ship', hullType: 'scout' as const,
  modules: [],
  acepXp: { ausbau: 5, intel: 0, kampf: 0, explorer: 0, total: 5 },
  acepEffects: { extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
  acepTraits: [],
  acepGeneration: 1,
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

const setAcepActiveTab = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({
    ship: mockShip as any,
    credits: 500,
    research: { wissen: 10 } as any,
    cargo: { ore: 0, gas: 0, crystal: 0, artefact: 0, slates: 0 } as any,
    moduleInventory: [],
    acepActiveTab: 'acep' as const,
    acepHoveredModuleId: null,
    currentSector: null,
    baseStructures: [],
    setAcepActiveTab,
    setAcepHoveredModuleId: vi.fn(),
  });
});

describe('AcepProgram', () => {
  it('renders 3 tab buttons', () => {
    render(<AcepProgram />);
    expect(screen.getByText(/\[ACEP\]/i)).toBeInTheDocument();
    expect(screen.getByText(/\[MODULE\]/i)).toBeInTheDocument();
    expect(screen.getByText(/\[SHOP\]/i)).toBeInTheDocument();
  });

  it('ACEP tab is active by default', () => {
    render(<AcepProgram />);
    // AcepTab content visible
    expect(screen.getByText('AUSBAU')).toBeInTheDocument();
  });

  it('clicking MODULE tab calls setAcepActiveTab', () => {
    render(<AcepProgram />);
    fireEvent.click(screen.getByText(/\[MODULE\]/i));
    expect(setAcepActiveTab).toHaveBeenCalledWith('module');
  });

  it('clicking SHOP tab calls setAcepActiveTab', () => {
    render(<AcepProgram />);
    fireEvent.click(screen.getByText(/\[SHOP\]/i));
    expect(setAcepActiveTab).toHaveBeenCalledWith('shop');
  });

  it('shows MODULE tab content when acepActiveTab is module', () => {
    mockStoreState({
      ship: mockShip as any,
      credits: 500,
      research: { wissen: 10 } as any,
      cargo: { ore: 0, gas: 0, crystal: 0, artefact: 0, slates: 0 } as any,
      moduleInventory: [],
      acepActiveTab: 'module' as const,
      acepHoveredModuleId: null,
      currentSector: null,
      baseStructures: [],
      setAcepActiveTab,
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<AcepProgram />);
    expect(screen.getByText(/INSTALLIERT/i)).toBeInTheDocument();
  });

  it('shows NO ACTIVE SHIP fallback when ship is null', () => {
    mockStoreState({ ship: null, acepActiveTab: 'acep' as const, setAcepActiveTab, setAcepHoveredModuleId: vi.fn() });
    render(<AcepProgram />);
    expect(screen.getByText(/NO ACTIVE SHIP/i)).toBeInTheDocument();
  });
});
