import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';
import { AcepDetailPanel } from '../components/AcepDetailPanel';

const mockShip = {
  id: 'ship-1', name: 'T', hullType: 'scout' as const,
  modules: [],
  acepXp: { ausbau: 20, intel: 0, kampf: 0, explorer: 0, total: 20 },
  acepTraits: ['cautious'],
  acepEffects: { extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

beforeEach(() => {
  mockStoreState({
    ship: mockShip as any,
    acepActiveTab: 'acep' as const,
    acepHoveredModuleId: null,
  });
});

describe('AcepDetailPanel', () => {
  it('shows trait info for ACEP tab', () => {
    render(<AcepDetailPanel />);
    expect(screen.getByText(/CAUTIOUS/i)).toBeInTheDocument();
  });

  it('shows hover prompt for MODULE tab without hover', () => {
    mockStoreState({ ship: mockShip as any, acepActiveTab: 'module' as const, acepHoveredModuleId: null });
    render(<AcepDetailPanel />);
    expect(screen.getByText(/hovern/i)).toBeInTheDocument();
  });

  it('shows module detail for MODULE tab with hover', () => {
    mockStoreState({ ship: mockShip as any, acepActiveTab: 'module' as const, acepHoveredModuleId: 'drive_mk1' });
    render(<AcepDetailPanel />);
    // drive_mk1 should show name
    expect(screen.getByText(/drive/i)).toBeInTheDocument();
  });

  it('shows hover prompt for SHOP tab without hover', () => {
    mockStoreState({ ship: mockShip as any, acepActiveTab: 'shop' as const, acepHoveredModuleId: null });
    render(<AcepDetailPanel />);
    expect(screen.getByText(/hovern/i)).toBeInTheDocument();
  });
});
