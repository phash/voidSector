import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendRenameShip: vi.fn(),
    sendAcepBoost: vi.fn(),
  },
}));

import { network } from '../network/client';
import { AcepTab } from '../components/AcepTab';

const mockShip = {
  id: 'ship-1',
  name: 'Test Ship',
  modules: [],
  // Per-path levels are capped at 10 (ACEP_PATH_CAP); total is the summed budget.
  acepXp: { ausbau: 2, intel: 0, kampf: 0, explorer: 0, total: 20 },
  acepEffects: {
    extraModuleSlots: 1,
    cargoMultiplier: 1,
    miningBonus: 0.15,
    scanRadiusBonus: 1,
    combatDamageBonus: 0,
    ancientDetection: false,
    helionDecoderEnabled: false,
  },
  acepTraits: ['cautious'],
  acepGeneration: 1,
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({ ship: mockShip as any, credits: 500, research: { wissen: 10 } as any });
});

describe('AcepTab', () => {
  it('renders all 7 XP path labels', () => {
    render(<AcepTab />);
    // Path labels are hardcoded uppercase strings in the component (PATHS array)
    expect(screen.getByText('AUSBAU')).toBeInTheDocument();
    expect(screen.getByText('INTEL')).toBeInTheDocument();
    expect(screen.getByText('KAMPF')).toBeInTheDocument();
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();
    expect(screen.getByText('DEFENSE')).toBeInTheDocument();
    expect(screen.getByText('TRADER')).toBeInTheDocument();
    expect(screen.getByText('MINER')).toBeInTheDocument();
  });

  it('renders total XP budget', () => {
    render(<AcepTab />);
    // Budget line renders "STUFEN: <total>/70" (level 1-10 across 7 paths)
    expect(screen.getByText(/20\/70/)).toBeInTheDocument();
  });

  it('renders active effects', () => {
    render(<AcepTab />);
    expect(screen.getByText(/acep\.effects\.extraModuleSlots/)).toBeInTheDocument();
    expect(screen.getByText(/acep\.effects\.miningBonus/)).toBeInTheDocument();
    expect(screen.getByText(/acep\.effects\.scanRadiusBonus/)).toBeInTheDocument();
  });

  it('renders traits', () => {
    render(<AcepTab />);
    expect(screen.getByText(/acep\.traits\.cautious\.label/i)).toBeInTheDocument();
  });

  it('renders ship name with rename button', () => {
    render(<AcepTab />);
    expect(screen.getByText('Test Ship')).toBeInTheDocument();
    expect(screen.getByText(/acep\.rename/i)).toBeInTheDocument();
  });

  it('boost button calls sendAcepBoost when enabled', () => {
    // Fresh ship (all paths level 0, total 0) so AUSBAU boost cost (100 CR / 5 W) is affordable.
    mockStoreState({
      ship: { ...mockShip, acepXp: { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 } } as any,
      credits: 500,
      research: { wissen: 10 } as any,
    });
    render(<AcepTab />);
    const boostBtns = screen.getAllByText(/\[\+1\]/i);
    expect(boostBtns.length).toBeGreaterThan(0);
    // Click the first [+1] button (AUSBAU path) — affordable at level 0
    fireEvent.click(boostBtns[0]);
    expect(network.sendAcepBoost).toHaveBeenCalledWith('ausbau');
  });

  it('rename button shows input field', () => {
    render(<AcepTab />);
    fireEvent.click(screen.getByText(/acep\.rename/i));
    expect(screen.getByPlaceholderText('Name...')).toBeInTheDocument();
  });

  it('typing in rename input and pressing Enter calls sendRenameShip', () => {
    render(<AcepTab />);
    fireEvent.click(screen.getByText(/acep\.rename/i));
    const input = screen.getByPlaceholderText('Name...');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'New Name');
  });

  it('typing in rename input and clicking OK calls sendRenameShip', () => {
    render(<AcepTab />);
    fireEvent.click(screen.getByText(/acep\.rename/i));
    const input = screen.getByPlaceholderText('Name...');
    fireEvent.change(input, { target: { value: 'Another Name' } });
    fireEvent.click(screen.getByText('actions.ok'));
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'Another Name');
  });

  it('[+1] button is disabled when credits are insufficient', () => {
    mockStoreState({ ship: mockShip as any, credits: 0, research: { wissen: 10 } as any });
    render(<AcepTab />);
    const boostBtns = screen.getAllByText(/\[\+1\]/i) as HTMLButtonElement[];
    expect(boostBtns.every((btn) => btn.disabled)).toBe(true);
  });

  it('renders fallback when no ship', () => {
    mockStoreState({ ship: null });
    render(<AcepTab />);
    expect(screen.getByText(/ship\.noShip/i)).toBeInTheDocument();
  });

  it('renders cargo effect when cargoMultiplier > 1', () => {
    mockStoreState({
      ship: { ...mockShip, acepEffects: { ...mockShip.acepEffects, cargoMultiplier: 1.2 } } as any,
      credits: 500, research: { wissen: 10 } as any,
    });
    render(<AcepTab />);
    expect(screen.getByText(/acep\.effects\.cargoMultiplier/)).toBeInTheDocument();
  });
});
