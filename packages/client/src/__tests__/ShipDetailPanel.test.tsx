// packages/client/src/__tests__/ShipDetailPanel.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShipDetailPanel } from '../components/ShipDetailPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({ network: {} }));

const baseShip = {
  id: 's1',
  ownerId: 'p1',
  hullType: 'scout' as const,
  name: 'NIGHTFALL',
  modules: [
    { moduleId: 'mining_laser_mk1', slotIndex: 0 },
    { moduleId: 'cargo_expander_small', slotIndex: 1 },
  ],
  stats: {
    fuelMax: 100, cargoCap: 50, jumpRange: 3, apCostJump: 1, fuelPerJump: 5,
    hp: 80, commRange: 3, scannerLevel: 1, damageMod: 1, shieldHp: 0,
    shieldRegen: 0, weaponAttack: 5, weaponType: 'kinetic' as const,
    weaponPiercing: 0, pointDefense: 0, ecmReduction: 0, engineSpeed: 1,
    artefactChanceBonus: 0,
  },
  fuel: 100,
  active: true,
};

describe('ShipDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ ship: null, monitorModes: {}, setMonitorMode: vi.fn() } as any);
  });

  it('renders nothing when no ship', () => {
    const { container } = render(<ShipDetailPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('shows ship name', () => {
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/NIGHTFALL/)).toBeDefined();
  });

  it('shows ACEP path labels when acepXp present', () => {
    mockStoreState({
      ship: {
        ...baseShip,
        acepXp: { ausbau: 34, intel: 22, kampf: 48, explorer: 10, total: 114 },
      },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText('CNST')).toBeDefined();
    expect(screen.getByText('34')).toBeDefined();
    expect(screen.getByText('CMBT')).toBeDefined();
  });

  it('shows zero bars when no acepXp', () => {
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText('ACEP PATHS')).toBeDefined();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows NO TRAITS ACTIVE YET when acepTraits empty', () => {
    mockStoreState({
      ship: { ...baseShip, acepTraits: [] },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/NO TRAITS ACTIVE YET/)).toBeDefined();
  });

  it('shows active traits from acepTraits', () => {
    mockStoreState({
      ship: {
        ...baseShip,
        acepXp: { ausbau: 34, intel: 0, kampf: 48, explorer: 0, total: 82 },
        acepTraits: ['reckless', 'veteran'],
      },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/RECKLESS/)).toBeDefined();
    expect(screen.getByText(/VETERAN/)).toBeDefined();
  });

  it('shows module section', () => {
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getAllByText(/MODULES/).length).toBeGreaterThan(0);
  });

  it('[ACEP →] button calls setMonitorMode with SHIP-SYS and acep', async () => {
    const setMonitorMode = vi.fn();
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode } as any);
    render(<ShipDetailPanel />);
    await userEvent.click(screen.getByText('[ACEP →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('SHIP-SYS', 'acep');
  });

  it('[MODULES →] button calls setMonitorMode with SHIP-SYS and modules', async () => {
    const setMonitorMode = vi.fn();
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode } as any);
    render(<ShipDetailPanel />);
    await userEvent.click(screen.getByText('[MODULES →]'));
    expect(setMonitorMode).toHaveBeenCalledWith('SHIP-SYS', 'modules');
  });
});
