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
  acepXp: { ausbau: 20, intel: 0, kampf: 0, explorer: 0, total: 20 },
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
  it('renders all 4 XP path labels', () => {
    render(<AcepTab />);
    expect(screen.getByText('AUSBAU')).toBeInTheDocument();
    expect(screen.getByText('INTEL')).toBeInTheDocument();
    expect(screen.getByText('KAMPF')).toBeInTheDocument();
    expect(screen.getByText('EXPLR')).toBeInTheDocument();
  });

  it('renders total XP budget', () => {
    render(<AcepTab />);
    expect(screen.getByText(/20\/100/)).toBeInTheDocument();
  });

  it('renders active effects', () => {
    render(<AcepTab />);
    expect(screen.getByText(/Modul-Slots/)).toBeInTheDocument();
    expect(screen.getByText(/Mining/)).toBeInTheDocument();
    expect(screen.getByText(/Scan-Radius/)).toBeInTheDocument();
  });

  it('renders traits', () => {
    render(<AcepTab />);
    expect(screen.getByText(/CAUTIOUS/i)).toBeInTheDocument();
  });

  it('renders ship name with rename button', () => {
    render(<AcepTab />);
    expect(screen.getByText('Test Ship')).toBeInTheDocument();
    expect(screen.getByText(/UMBENENNEN/i)).toBeInTheDocument();
  });

  it('boost button calls sendAcepBoost when enabled', () => {
    render(<AcepTab />);
    const boostBtns = screen.getAllByText(/\[\+5\]/i);
    expect(boostBtns.length).toBeGreaterThan(0);
    // Click the first [+5] button (AUSBAU path, xp=20, cost=300cr/8w — covered by credits:500, wissen:10)
    fireEvent.click(boostBtns[0]);
    expect(network.sendAcepBoost).toHaveBeenCalledWith('ausbau');
  });

  it('rename button shows input field', () => {
    render(<AcepTab />);
    fireEvent.click(screen.getByText(/UMBENENNEN/i));
    expect(screen.getByPlaceholderText('Name...')).toBeInTheDocument();
  });

  it('typing in rename input and pressing Enter calls sendRenameShip', () => {
    render(<AcepTab />);
    fireEvent.click(screen.getByText(/UMBENENNEN/i));
    const input = screen.getByPlaceholderText('Name...');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'New Name');
  });

  it('typing in rename input and clicking OK calls sendRenameShip', () => {
    render(<AcepTab />);
    fireEvent.click(screen.getByText(/UMBENENNEN/i));
    const input = screen.getByPlaceholderText('Name...');
    fireEvent.change(input, { target: { value: 'Another Name' } });
    fireEvent.click(screen.getByText('OK'));
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'Another Name');
  });

  it('[+5] button is disabled when credits are insufficient', () => {
    mockStoreState({ ship: mockShip as any, credits: 0, research: { wissen: 10 } as any });
    render(<AcepTab />);
    const boostBtns = screen.getAllByText(/\[\+5\]/i) as HTMLButtonElement[];
    expect(boostBtns.every((btn) => btn.disabled)).toBe(true);
  });

  it('renders fallback when no ship', () => {
    mockStoreState({ ship: null });
    render(<AcepTab />);
    expect(screen.getByText(/KEIN SCHIFF/i)).toBeInTheDocument();
  });

  it('renders cargo effect when cargoMultiplier > 1', () => {
    mockStoreState({
      ship: { ...mockShip, acepEffects: { ...mockShip.acepEffects, cargoMultiplier: 1.2 } } as any,
      credits: 500, research: { wissen: 10 } as any,
    });
    render(<AcepTab />);
    expect(screen.getByText(/20% Cargo/)).toBeInTheDocument();
  });
});
