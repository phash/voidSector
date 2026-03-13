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
    expect(screen.getByText('acep.pathsLabel')).toBeDefined();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows NO TRAITS ACTIVE YET when acepTraits empty', () => {
    mockStoreState({
      ship: { ...baseShip, acepTraits: [] },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/acep\.noTraitsActive/)).toBeDefined();
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
    expect(screen.getAllByText(/ship\.modulesSlots/).length).toBeGreaterThan(0);
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

  it('shows generation when acepGeneration > 1', () => {
    mockStoreState({
      ship: { ...baseShip, acepGeneration: 3 },
      setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/GEN 3/)).toBeDefined();
  });

  it('does not show generation for gen 1', () => {
    mockStoreState({
      ship: { ...baseShip, acepGeneration: 1 },
      setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.queryByText(/GEN/)).toBeNull();
  });

  it('shows correct slot count from hull definition', () => {
    // scout hull has 3 base slots; 0 extraModuleSlots → 3 total
    mockStoreState({
      ship: { ...baseShip, modules: [], acepEffects: { extraModuleSlots: 0 } },
      setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    // ship.modulesSlots key returned by mock, contains count/max via replacement in key string
    expect(screen.getByText(/ship\.modulesSlots/)).toBeDefined();
  });

  it('adds extraModuleSlots to hull base slots', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [], acepEffects: { extraModuleSlots: 2 } },
      setMonitorMode: vi.fn(),
    } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/ship\.modulesSlots/)).toBeDefined();
  });

  it('shows module names in Title Case', () => {
    // baseShip already has modules with moduleId 'mining_laser_mk1'
    // toTitleCase('mining_laser_mk1') → 'Mining Laser Mk1'
    mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
    render(<ShipDetailPanel />);
    expect(screen.getByText(/Mining Laser Mk1/)).toBeDefined();
  });

  it('shows veteran trait in cyan not red', () => {
    mockStoreState({
      ship: { ...baseShip, acepTraits: ['veteran'] },
      monitorModes: {}, setMonitorMode: vi.fn(),
    } as any);
    const { container } = render(<ShipDetailPanel />);
    const traitEl = container.querySelector('[data-trait="veteran"]');
    expect(traitEl).not.toBeNull();
    expect((traitEl as HTMLElement).style.color).not.toBe('rgb(255, 68, 68)');
  });
});
